/*
 * Focused, research-only review of HYPE long trend/regime blockers.
 *
 * Reuses the parity-validated free-running ladder engine and changes only the
 * precomputed, closed-bar gate series. No live bot or executor code is imported.
 *
 * Usage:
 *   npx ts-node scripts/hype-trend-blocker-regime-review.ts
 */

import path from "path";
import { EMA } from "technicalindicators";
import {
  buildSeries,
  Candle,
  EngineParams,
  ensureDir,
  iso,
  lowerBound,
  runEngine,
  Series,
  writeCsv,
} from "./hype-freerun-canonical-replay";
import { attachDormantSeries } from "./hype-dormant-edge-replay";

const MINUTE = 60_000;
const FOUR_HOURS = 4 * 60 * MINUTE;
const DAY = 24 * 60 * MINUTE;
const START = Date.parse(process.env.SIM_START ?? "2025-07-01T00:00:00Z");
const END = process.env.SIM_END ? Date.parse(process.env.SIM_END) : Number.POSITIVE_INFINITY;
const OUT = path.join(process.cwd(), "backtests", "hype", "trendlock-timing-review-2026-08-11");

type TrendBar = {
  ts: number;
  endTs: number;
  close: number;
  ema200: number | null;
  ema50: number | null;
  ema50Prev: number | null;
  ema50SlopePct: number | null;
  belowEmaPct: number | null;
  currentBlocked: boolean;
};

type Variant = {
  id: string;
  trend: "none" | "current" | "below_ema" | "deep_1pct" | "deep_2pct"
    | "slope_0p01pct" | "slope_0p02pct" | "slope_0p05pct"
    | "rearm_2bars" | "rearm_3bars" | "rearm_4bars";
  redDays: 4 | 5;
  hardFlattenHours?: 8 | 10 | 12;
  hardFlattenIgnoreTrend?: boolean;
  cooldownMode?: EngineParams["cooldownMode"];
  reentry?: EngineParams["reentry"];
  tpCooldownOverrideMin?: number;
};

const VARIANTS: Variant[] = [
  { id: "baseline_current", trend: "current", redDays: 5 },
  { id: "trend_disabled_diagnostic", trend: "none", redDays: 5 },
  { id: "trend_below_ema200", trend: "below_ema", redDays: 5 },
  { id: "trend_hostile_or_1pct_below", trend: "deep_1pct", redDays: 5 },
  { id: "trend_hostile_or_2pct_below", trend: "deep_2pct", redDays: 5 },
  { id: "trend_slope_margin_0p01pct", trend: "slope_0p01pct", redDays: 5 },
  { id: "trend_slope_margin_0p02pct", trend: "slope_0p02pct", redDays: 5 },
  { id: "trend_slope_margin_0p05pct", trend: "slope_0p05pct", redDays: 5 },
  { id: "trend_rearm_after_2_clean_4h", trend: "rearm_2bars", redDays: 5 },
  { id: "trend_rearm_after_3_clean_4h", trend: "rearm_3bars", redDays: 5 },
  { id: "trend_rearm_after_4_clean_4h", trend: "rearm_4bars", redDays: 5 },
  { id: "regime_red4_green2", trend: "current", redDays: 4 },
  { id: "hard_flatten_10h_minus2", trend: "current", redDays: 5, hardFlattenHours: 10 },
  { id: "hard_flatten_8h_minus2", trend: "current", redDays: 5, hardFlattenHours: 8 },
  { id: "hard_flatten_12h_minus2_ignore_trend", trend: "current", redDays: 5, hardFlattenIgnoreTrend: true },
  { id: "forced_reentry_immediate", trend: "current", redDays: 5, reentry: { mode: "immediate" } },
  { id: "forced_reentry_fixed_8h", trend: "current", redDays: 5, cooldownMode: "8h" },
  { id: "forced_reentry_fixed_12h", trend: "current", redDays: 5, cooldownMode: "12h" },
  { id: "forced_reentry_no_new_low_4h", trend: "current", redDays: 5, reentry: { mode: "no_new_low", noNewLowHours: 4 } },
  { id: "forced_reentry_vwap_reclaim", trend: "current", redDays: 5, reentry: { mode: "vwap_reclaim" } },
  { id: "tp_cooldown_always_30m", trend: "current", redDays: 5, tpCooldownOverrideMin: 30 },
  { id: "tp_cooldown_always_60m", trend: "current", redDays: 5, tpCooldownOverrideMin: 60 },
  { id: "tp_cooldown_always_120m", trend: "current", redDays: 5, tpCooldownOverrideMin: 120 },
  { id: "tp_cooldown_always_240m", trend: "current", redDays: 5, tpCooldownOverrideMin: 240 },
];

const WINDOWS = [
  { id: "one_year", start: START },
  { id: "hl_era", start: Math.max(START, Date.parse("2026-05-17T20:43:00Z")) },
  { id: "recent_30d", start: Math.max(START, Date.parse("2026-07-12T18:22:00Z")) },
  { id: "post_july20", start: Math.max(START, Date.parse("2026-07-20T00:00:00Z")) },
].filter((window, index, all) => all.findIndex(other => other.start === window.start) === index);

function aggregate4h(candles: Candle[]): Array<{ ts: number; endTs: number; close: number }> {
  const out: Array<{ ts: number; endTs: number; close: number }> = [];
  let current: { ts: number; endTs: number; close: number } | null = null;
  for (const candle of candles) {
    const ts = Math.floor(candle.ts / FOUR_HOURS) * FOUR_HOURS;
    if (!current || current.ts !== ts) {
      current = { ts, endTs: ts + FOUR_HOURS, close: candle.close };
      out.push(current);
    } else {
      current.close = candle.close;
    }
  }
  return out;
}

function buildTrendBars(candles: Candle[]): TrendBar[] {
  const bars = aggregate4h(candles);
  return bars.map((bar, index) => {
    const completed = bars.slice(0, index + 1).slice(-249);
    const closes = completed.map(row => row.close);
    const ema200Values = EMA.calculate({ period: 200, values: closes });
    const ema50Values = EMA.calculate({ period: 50, values: closes });
    // Canonical/live parity intentionally waits for EMA200 plus one prior bar,
    // because EMA50 slope also needs a completed previous observation.
    const ready = completed.length >= 201;
    const ema200 = ready && ema200Values.length ? ema200Values[ema200Values.length - 1] : null;
    const ema50 = ready && ema50Values.length ? ema50Values[ema50Values.length - 1] : null;
    const ema50Prev = ready && ema50Values.length >= 2 ? ema50Values[ema50Values.length - 2] : null;
    const ema50SlopePct = ema50 !== null && ema50Prev !== null && ema50Prev !== 0
      ? ((ema50 - ema50Prev) / ema50Prev) * 100
      : null;
    const belowEmaPct = ema200 !== null ? ((ema200 - bar.close) / ema200) * 100 : null;
    const currentBlocked = ema200 !== null && ema50 !== null && ema50Prev !== null
      ? bar.close < ema200 && ema50 < ema50Prev
      : false;
    return { ...bar, ema200, ema50, ema50Prev, ema50SlopePct, belowEmaPct, currentBlocked };
  });
}

function mapTrendToMinutes(candles: Candle[], bars: TrendBar[], mode: Variant["trend"]): boolean[] {
  const barStates = new Map<number, boolean>();
  let blocked = false;
  let cleanBars = 0;
  for (const bar of bars) {
    if (mode === "rearm_2bars" || mode === "rearm_3bars" || mode === "rearm_4bars") {
      const required = mode === "rearm_2bars" ? 2 : mode === "rearm_3bars" ? 3 : 4;
      if (bar.currentBlocked) {
        blocked = true;
        cleanBars = 0;
      } else if (blocked) {
        cleanBars++;
        if (cleanBars >= required) blocked = false;
      }
      barStates.set(bar.ts, blocked);
      continue;
    }
    const slopeMargin = mode === "slope_0p01pct" ? 0.01
      : mode === "slope_0p02pct" ? 0.02
        : mode === "slope_0p05pct" ? 0.05
          : null;
    const state = mode === "none"
      ? false
      : mode === "below_ema"
      ? (bar.belowEmaPct !== null && bar.belowEmaPct > 0)
      : mode === "deep_1pct"
        ? bar.currentBlocked || (bar.belowEmaPct !== null && bar.belowEmaPct >= 1)
        : mode === "deep_2pct"
          ? bar.currentBlocked || (bar.belowEmaPct !== null && bar.belowEmaPct >= 2)
          : slopeMargin !== null
            ? (bar.belowEmaPct !== null && bar.belowEmaPct > 0 && (bar.ema50SlopePct === null || bar.ema50SlopePct < slopeMargin))
            : bar.currentBlocked;
    barStates.set(bar.ts, state);
  }

  const out = new Array<boolean>(candles.length).fill(false);
  let completedIndex = -1;
  for (let i = 0; i < candles.length; i++) {
    while (completedIndex + 1 < bars.length && bars[completedIndex + 1].endTs <= candles[i].endTs) completedIndex++;
    if (completedIndex >= 0) out[i] = barStates.get(bars[completedIndex].ts) ?? false;
  }
  return out;
}

function buildRegimeSeries(candles: Candle[], redDaysToFlat: number, greenDaysToArm = 2): boolean[] {
  const daily = new Map<number, number>();
  for (const candle of candles) daily.set(Math.floor(candle.ts / DAY) * DAY, candle.close);
  const days = Array.from(daily, ([ts, close]) => ({ ts, endTs: ts + DAY, close })).sort((a, b) => a.ts - b.ts);
  const states = new Map<number, boolean>();
  let redStreak = 0;
  let greenStreak = 0;
  let flat = false;
  for (let i = 0; i < days.length; i++) {
    if (i > 0) {
      const red = days[i].close < days[i - 1].close;
      if (!flat) {
        redStreak = red ? redStreak + 1 : 0;
        if (redStreak >= redDaysToFlat) {
          flat = true;
          greenStreak = 0;
        }
      } else {
        greenStreak = red ? 0 : greenStreak + 1;
        if (greenStreak >= greenDaysToArm) {
          flat = false;
          redStreak = 0;
          greenStreak = 0;
        }
      }
    }
    states.set(days[i].ts, flat);
  }
  const out = new Array<boolean>(candles.length).fill(false);
  let completedIndex = -1;
  for (let i = 0; i < candles.length; i++) {
    while (completedIndex + 1 < days.length && days[completedIndex + 1].endTs <= candles[i].endTs) completedIndex++;
    if (completedIndex >= 0) out[i] = states.get(days[completedIndex].ts) ?? false;
  }
  return out;
}

function params(variant: Variant): EngineParams {
  return {
    id: variant.id,
    maxPositions: 11,
    hardFlattenHours: variant.hardFlattenHours ?? 12,
    hardFlattenPct: -2,
    hardFlattenIgnoreTrend: variant.hardFlattenIgnoreTrend,
    cooldownMode: variant.cooldownMode ?? "live4h",
    reentry: variant.reentry,
    tpCooldownOverrideMin: variant.tpCooldownOverrideMin,
    pullbackMode: "none",
    srExec: {
      partialExit: {
        minDepth: 6,
        keepRungs: 3,
        bufferPct: 0.3,
        minLadderPnlPct: 0.25,
        requirePlanProfit: true,
        pulse: "deteriorating",
        cooldownMin: 60,
      },
      supportReopen: { minNextDepth: 5, bufferPct: 1, mode: "buy_pressure" },
    },
  };
}

function month(ts: number): string {
  return iso(ts).slice(0, 7);
}

async function main(): Promise<void> {
  ensureDir(OUT);
  const base = await buildSeries();
  const endIdx = Number.isFinite(END) ? lowerBound(base.candles, END, candle => candle.endTs) : base.candles.length;
  const earliest = Math.min(...WINDOWS.map(window => window.start));
  const attachFrom = Math.max(0, lowerBound(base.candles, earliest, candle => candle.endTs) - 2 * 1440);
  await attachDormantSeries(base, attachFrom);

  const trendBars = buildTrendBars(base.candles);
  const trendByMode = new Map<Variant["trend"], boolean[]>();
  for (const variant of VARIANTS) {
    if (!trendByMode.has(variant.trend)) trendByMode.set(variant.trend, mapTrendToMinutes(base.candles, trendBars, variant.trend));
  }
  const currentMismatch = trendByMode.get("current")!.reduce((sum, value, i) => sum + (value !== base.trendBlocked[i] ? 1 : 0), 0);
  if (currentMismatch !== 0) throw new Error(`Trend parity failed: ${currentMismatch} minute states differ from canonical engine`);
  const regime5Check = buildRegimeSeries(base.candles, 5);
  const regimeMismatch = regime5Check.reduce((sum, value, i) => sum + (value !== base.regimeFlat[i] ? 1 : 0), 0);
  if (regimeMismatch !== 0) throw new Error(`Regime parity failed: ${regimeMismatch} minute states differ from canonical engine`);
  const regimeByDays = new Map<number, boolean[]>([
    [5, base.regimeFlat],
    [4, buildRegimeSeries(base.candles, 4)],
  ]);

  const summary: Record<string, unknown>[] = [];
  const monthly: Record<string, unknown>[] = [];
  const latestCloses: Record<string, unknown>[] = [];

  for (const window of WINDOWS) {
    const startIdx = lowerBound(base.candles, window.start, candle => candle.endTs);
    const results = new Map<string, ReturnType<typeof runEngine>>();
    for (const variant of VARIANTS) {
      const series: Series = {
        ...base,
        trendBlocked: trendByMode.get(variant.trend)!,
        regimeFlat: regimeByDays.get(variant.redDays)!,
      };
      const result = runEngine(params(variant), series, { startIdx, endIdx });
      results.set(variant.id, result);
    }
    const baseline = results.get("baseline_current")!;
    const baselineTotal = baseline.realized + baseline.openPnl;
    for (const variant of VARIANTS) {
      const result = results.get(variant.id)!;
      const total = result.realized + result.openPnl;
      summary.push({
        window: window.id,
        start: iso(base.candles[startIdx].endTs),
        end: iso(base.candles[endIdx - 1].endTs),
        variant: variant.id,
        hardFlattenHours: variant.hardFlattenHours ?? 12,
        totalPnl: total,
        deltaVsBaseline: total - baselineTotal,
        realizedPnl: result.realized,
        openPnl: result.openPnl,
        closes: result.closes.length,
        tp: result.closes.filter(close => close.reason === "tp").length,
        staleTp: result.closes.filter(close => close.reason === "stale_tp").length,
        hardFlatten: result.closes.filter(close => close.reason === "hard_flatten").length,
        emergencyKill: result.closes.filter(close => close.reason === "emergency_kill").length,
        partialExits: result.trims.length,
        partialPnl: result.trims.reduce((sum, trim) => sum + trim.pnl, 0),
        worstClose: result.worstClose,
        maxDrawdownPct: result.maxDrawdownPct,
        maxDepth: result.maxDepthSeen,
        blockedTrendMinutes: result.blocked.trend,
        blockedRegimeMinutes: result.blocked.regime,
      });
      if (window.id === "one_year") {
        const byMonth = new Map<string, number>();
        for (const close of result.closes) {
          const key = month(close.closeTs);
          byMonth.set(key, (byMonth.get(key) ?? 0) + close.pnl + close.trimPnlInEpisode);
        }
        for (const key of Array.from(byMonth.keys()).sort()) {
          monthly.push({ variant: variant.id, month: key, realizedPnl: byMonth.get(key) });
        }
      }
      for (const close of result.closes.filter(close => close.closeTs >= Date.parse("2026-07-20T00:00:00Z"))) {
        latestCloses.push({ window: window.id, ...close });
      }
    }
  }

  const eventBars = trendBars
    .filter(bar => bar.ts >= Date.parse("2026-07-20T00:00:00Z") && bar.endTs <= base.candles[endIdx - 1].endTs)
    .map(bar => ({
      barStart: iso(bar.ts),
      barEnd: iso(bar.endTs),
      close: bar.close,
      ema200: bar.ema200,
      ema50: bar.ema50,
      ema50Prev: bar.ema50Prev,
      ema50SlopePct: bar.ema50SlopePct,
      belowEmaPct: bar.belowEmaPct,
      currentBlocked: bar.currentBlocked,
    }));

  writeCsv(path.join(OUT, "summary.csv"), summary);
  writeCsv(path.join(OUT, "monthly.csv"), monthly);
  writeCsv(path.join(OUT, "latest-closes.csv"), latestCloses);
  writeCsv(path.join(OUT, "recent-trend-bars.csv"), eventBars);
  console.log(JSON.stringify({
    trendParityMismatchMinutes: currentMismatch,
    regimeParityMismatchMinutes: regimeMismatch,
    windows: WINDOWS.map(window => ({ id: window.id, start: iso(window.start) })),
    eventBars,
    summary,
    outputs: OUT,
  }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
