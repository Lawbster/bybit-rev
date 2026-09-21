/**
 * Causal free-running audit of a narrow late-rung rule:
 *
 *   When the next add is rung 11 and price is within X% of a high that was
 *   knowable at that minute, defer the add until price is farther below that
 *   high. Test both the UTC-session high and rolling 24h high, and both:
 *     - all: block timer and price-drop rung-11 adds;
 *     - time_only: block timer-only rung-11 adds; real price-drop adds pass.
 *
 * The trigger series includes only the current and earlier completed 1m bars.
 * Run hype-current-regime-60d-audit.ts first so the selected deployed damaged-
 * regime latch intervals are refreshed through the same data end.
 */

import fs from "fs";
import path from "path";
import {
  ROOT,
  buildSeries,
  ensureDir,
  iso,
  lowerBound,
  runEngine,
  writeCsv,
  type Candle,
  type EngineParams,
  type EngineResult,
  type Series,
} from "./hype-freerun-canonical-replay";
import { attachDormantSeries } from "./hype-dormant-edge-replay";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const HL_START = Date.parse("2026-05-17T20:43:00Z");
const ONE_YEAR_START = Date.parse("2025-07-01T00:00:00Z");
const SELECTED_LATCH = "ladder_lock_deep4_hl_sell_release_2x4h_inside1";
const SOURCE_DIR = path.join(ROOT, "backtests", "hype", "current-regime-60d-2026-08-14");
const OUT = path.join(ROOT, "backtests", "hype", "rung11-daily-high-delay-2026-08-20");

type HighKind = "utc_day" | "rolling_24h";
type DelayMode = "all" | "time_only";

type Variant = {
  id: string;
  ruleShape: "baseline" | "same_threshold" | "arm_then_drop";
  highKind: HighKind | "none";
  thresholdPct: number | null;
  armWithinPct: number | null;
  releaseDropPct: number | null;
  delayMode: DelayMode | "none";
  triggerKey?: string;
  releaseKey?: string;
};

type Interval = { start: number; end: number };

function parseSelectedLatchIntervals(): Interval[] {
  const file = path.join(SOURCE_DIR, "pause-intervals.csv");
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}; run scripts/hype-current-regime-60d-audit.ts first`);
  }
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const variantAt = header.indexOf("variant");
  const startAt = header.indexOf("startIso");
  const endAt = header.indexOf("endIso");
  if ([variantAt, startAt, endAt].some(index => index < 0)) {
    throw new Error(`Unexpected pause interval schema in ${file}`);
  }
  return lines.slice(1).flatMap(line => {
    const cells = line.split(",");
    if (cells[variantAt] !== SELECTED_LATCH) return [];
    const start = Date.parse(cells[startAt]);
    const end = cells[endAt] ? Date.parse(cells[endAt]) : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(start) || (!Number.isFinite(end) && end !== Number.POSITIVE_INFINITY)) return [];
    return [{ start, end }];
  });
}

function attachSelectedLatch(series: Series, intervals: Interval[]): void {
  let cursor = 0;
  series.regimeFlat = series.regimeFlat.map((alreadyFlat, i) => {
    const ts = series.candles[i].endTs;
    while (cursor < intervals.length && intervals[cursor].end <= ts) cursor++;
    const selected = cursor < intervals.length && ts >= intervals[cursor].start && ts < intervals[cursor].end;
    return alreadyFlat || selected;
  });
}

function buildUtcDayHigh(candles: Candle[]): number[] {
  const out = new Array<number>(candles.length);
  let day = -1;
  let high = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < candles.length; i++) {
    const currentDay = Math.floor(candles[i].ts / DAY);
    if (currentDay !== day) {
      day = currentDay;
      high = candles[i].high;
    } else {
      high = Math.max(high, candles[i].high);
    }
    out[i] = high;
  }
  return out;
}

function buildRollingHigh(candles: Candle[], windowMs: number): number[] {
  const out = new Array<number>(candles.length);
  const deque: number[] = [];
  let head = 0;
  for (let i = 0; i < candles.length; i++) {
    const cutoff = candles[i].endTs - windowMs;
    while (head < deque.length && candles[deque[head]].endTs <= cutoff) head++;
    while (deque.length > head && candles[deque[deque.length - 1]].high <= candles[i].high) deque.pop();
    deque.push(i);
    out[i] = candles[deque[head]].high;
    if (head > 4096) {
      deque.splice(0, head);
      head = 0;
    }
  }
  return out;
}

function keyPart(value: number): string {
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", "p");
}

function attachHighTriggers(series: Series, highs: Record<HighKind, number[]>): Variant[] {
  series.extraTriggers = new Map(series.extraTriggers ?? []);
  const variants: Variant[] = [{
    id: "current_with_damaged_latch",
    ruleShape: "baseline",
    highKind: "none",
    thresholdPct: null,
    armWithinPct: null,
    releaseDropPct: null,
    delayMode: "none",
  }];
  const thresholds = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
  for (const highKind of ["utc_day", "rolling_24h"] as HighKind[]) {
    for (const thresholdPct of thresholds) {
      const triggerKey = `rung11_near_${highKind}_${keyPart(thresholdPct)}`;
      series.extraTriggers.set(triggerKey, series.candles.map((candle, i) => {
        const high = highs[highKind][i];
        return high > 0 && ((high - candle.close) / high) * 100 <= thresholdPct;
      }));
      for (const delayMode of ["all", "time_only"] as DelayMode[]) {
        variants.push({
          id: `r11_${highKind}_within_${keyPart(thresholdPct)}pct_${delayMode}`,
          ruleShape: "same_threshold",
          highKind,
          thresholdPct,
          armWithinPct: thresholdPct,
          releaseDropPct: thresholdPct,
          delayMode,
          triggerKey,
        });
      }
    }
    for (const armWithinPct of [0.25, 0.5, 0.75]) {
      const armKey = `rung11_arm_${highKind}_${keyPart(armWithinPct)}`;
      series.extraTriggers.set(armKey, series.candles.map((candle, i) => {
        const high = highs[highKind][i];
        return high > 0 && ((high - candle.close) / high) * 100 <= armWithinPct;
      }));
      for (const releaseDropPct of [0.75, 1, 1.5, 2]) {
        if (releaseDropPct <= armWithinPct) continue;
        const releaseKey = `rung11_release_${highKind}_${keyPart(releaseDropPct)}`;
        if (!series.extraTriggers.has(releaseKey)) {
          series.extraTriggers.set(releaseKey, series.candles.map((candle, i) => {
            const high = highs[highKind][i];
            return high > 0 && ((high - candle.close) / high) * 100 >= releaseDropPct;
          }));
        }
        for (const delayMode of ["all", "time_only"] as DelayMode[]) {
          variants.push({
            id: `r11_${highKind}_arm_${keyPart(armWithinPct)}pct_drop_${keyPart(releaseDropPct)}pct_${delayMode}`,
            ruleShape: "arm_then_drop",
            highKind,
            thresholdPct: null,
            armWithinPct,
            releaseDropPct,
            delayMode,
            triggerKey: armKey,
            releaseKey,
          });
        }
      }
    }
  }
  return variants;
}

function currentParams(variant: Variant): EngineParams {
  return {
    id: variant.id,
    maxPositions: 11,
    hardFlattenHours: 12,
    hardFlattenPct: -2,
    cooldownMode: "live4h",
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
    ...(variant.ruleShape === "same_threshold" && variant.triggerKey ? {
      deepAddPause: {
        triggerKey: variant.triggerKey,
        minNextDepth: 11,
        pauseMin: 1,
        blockPriceDrop: variant.delayMode === "all",
      },
    } : {}),
    ...(variant.ruleShape === "arm_then_drop" && variant.triggerKey && variant.releaseKey ? {
      lateRungHighDelay: {
        armKey: variant.triggerKey,
        releaseKey: variant.releaseKey,
        minNextDepth: 11,
        blockPriceDrop: variant.delayMode === "all",
      },
    } : {}),
  };
}

function closeValue(close: EngineResult["closes"][number]): number {
  return close.pnl + close.trimPnlInEpisode + close.hedgePnlInEpisode;
}

function total(result: EngineResult): number {
  return result.realized + result.openPnl;
}

function summarize(window: string, variant: Variant, result: EngineResult, baseline: EngineResult) {
  const affectedEpisodes = new Set(result.actions
    .filter(action => action.kind === "deep_add_pause" || action.kind === "late_rung_high_delay_arm")
    .map(action => action.episode));
  const affectedCloses = result.closes.filter(close => affectedEpisodes.has(close.episode));
  return {
    window,
    variant: variant.id,
    ruleShape: variant.ruleShape,
    highKind: variant.highKind,
    thresholdPct: variant.thresholdPct ?? "",
    armWithinPct: variant.armWithinPct ?? "",
    releaseDropPct: variant.releaseDropPct ?? "",
    delayMode: variant.delayMode,
    totalPnl: Number(total(result).toFixed(2)),
    deltaVsCurrent: Number((total(result) - total(baseline)).toFixed(2)),
    realizedPnl: Number(result.realized.toFixed(2)),
    openPnl: Number(result.openPnl.toFixed(2)),
    closes: result.closes.length,
    tpCycles: result.closes.filter(close => close.reason === "tp" || close.reason === "stale_tp").length,
    hardFlattens: result.closes.filter(close => close.reason === "hard_flatten").length,
    emergencyKills: result.closes.filter(close => close.reason === "emergency_kill").length,
    rung11Closes: result.closes.filter(close => close.maxDepth >= 11).length,
    affectedEpisodes: affectedEpisodes.size,
    affectedEventuallyReached11: affectedCloses.filter(close => close.maxDepth >= 11).length,
    affectedClosedBefore11: affectedCloses.filter(close => close.maxDepth < 11).length,
    blockedDecisionMinutes: (result.blocked.deepPause ?? 0) + (result.blocked.lateRungHighDelay ?? 0),
    worstClose: Number(result.worstClose.toFixed(2)),
    maxDrawdownPct: Number(result.maxDrawdownPct.toFixed(2)),
    minEquity: Number(result.minEquity.toFixed(2)),
    maxOpenNotional: Number(result.maxOpenNotional.toFixed(2)),
  };
}

function monthlyRows(window: string, variant: Variant, result: EngineResult, baseline: EngineResult) {
  const collect = (source: EngineResult) => {
    const out = new Map<string, number>();
    for (const close of source.closes) {
      const month = close.closeIso.slice(0, 7);
      out.set(month, (out.get(month) ?? 0) + closeValue(close));
    }
    return out;
  };
  const current = collect(result);
  const base = collect(baseline);
  return [...new Set([...current.keys(), ...base.keys()])].sort().map(month => ({
    window,
    variant: variant.id,
    month,
    realizedPnl: Number((current.get(month) ?? 0).toFixed(2)),
    deltaVsCurrent: Number(((current.get(month) ?? 0) - (base.get(month) ?? 0)).toFixed(2)),
  }));
}

function eventRows(window: string, variant: Variant, result: EngineResult, series: Series, highs: Record<HighKind, number[]>) {
  if (variant.highKind === "none") return [];
  const firstByEpisode = new Map<number, EngineResult["actions"][number]>();
  for (const action of result.actions) {
    if ((action.kind === "deep_add_pause" || action.kind === "late_rung_high_delay_arm")
      && !firstByEpisode.has(action.episode)) firstByEpisode.set(action.episode, action);
  }
  const closeByEpisode = new Map(result.closes.map(close => [close.episode, close]));
  return [...firstByEpisode.values()].map(action => {
    const index = Math.min(series.candles.length - 1, lowerBound(series.candles, action.ts, candle => candle.endTs));
    const high = highs[variant.highKind as HighKind][index];
    const close = closeByEpisode.get(action.episode);
    return {
      window,
      variant: variant.id,
      episode: action.episode,
      firstBlockedIso: action.iso,
      price: Number(action.price.toFixed(4)),
      knownHigh: Number(high.toFixed(4)),
      distanceFromHighPct: Number((((high - action.price) / high) * 100).toFixed(4)),
      outcome: close?.reason ?? "open_at_data_end",
      closeIso: close?.closeIso ?? "",
      maxDepth: close?.maxDepth ?? result.openDepth,
      pnl: close ? Number(closeValue(close).toFixed(2)) : "",
    };
  });
}

async function main(): Promise<void> {
  ensureDir(OUT);
  const base = await buildSeries();
  await attachDormantSeries(base, Math.max(0, lowerBound(base.candles, HL_START - 14 * DAY, candle => candle.endTs)));
  const intervals = parseSelectedLatchIntervals();
  attachSelectedLatch(base, intervals);
  const highs: Record<HighKind, number[]> = {
    utc_day: buildUtcDayHigh(base.candles),
    rolling_24h: buildRollingHigh(base.candles, DAY),
  };
  const variants = attachHighTriggers(base, highs);
  const end = base.candles[base.candles.length - 1].endTs;
  const windows = [
    { id: "one_year", start: ONE_YEAR_START },
    { id: "hl_full", start: HL_START },
    { id: "recent_60d", start: end - 60 * DAY },
    { id: "recent_30d", start: end - 30 * DAY },
  ];
  const summary: Record<string, string | number>[] = [];
  const monthly: Record<string, string | number>[] = [];
  const events: Record<string, string | number>[] = [];

  for (const window of windows) {
    const startIdx = lowerBound(base.candles, window.start, candle => candle.endTs);
    const results = variants.map(variant => runEngine(currentParams(variant), base, { startIdx }));
    const baseline = results[0];
    for (let i = 0; i < variants.length; i++) {
      summary.push(summarize(window.id, variants[i], results[i], baseline));
      monthly.push(...monthlyRows(window.id, variants[i], results[i], baseline));
      if (window.id === "one_year") events.push(...eventRows(window.id, variants[i], results[i], base, highs));
    }
  }

  writeCsv(path.join(OUT, "summary.csv"), summary);
  writeCsv(path.join(OUT, "monthly.csv"), monthly);
  writeCsv(path.join(OUT, "events.csv"), events);
  const ranking = summary
    .filter(row => row.window === "one_year" && row.variant !== variants[0].id)
    .sort((a, b) => Number(b.deltaVsCurrent) - Number(a.deltaVsCurrent));
  const baseline = summary.find(row => row.window === "one_year" && row.variant === variants[0].id);
  console.log(JSON.stringify({
    dataEnd: iso(end),
    noLookahead: "highs use only current/earlier completed 1m candles",
    selectedLatch: { id: SELECTED_LATCH, intervals: intervals.map(value => ({ start: iso(value.start), end: Number.isFinite(value.end) ? iso(value.end) : "open" })) },
    baseline,
    top: ranking.slice(0, 12),
    bottom: ranking.slice(-5),
    outputs: OUT,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
