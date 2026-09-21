/*
 * Frozen hl_bid_pull_break regime-suspension revalidation.
 *
 * Predeclared before inspecting variant outcomes:
 * - preserve TP 1.95%, SL 4%, 12h maximum hold and 60m raw-signal cooldown;
 * - test only causal higher-timeframe entry suspensions;
 * - compare exact decision-open and one-minute-delayed entry paths;
 * - require old-evidence damage >= -1.0pp, untouched improvement >= +4.0pp,
 *   positive full-period delta, no old month below -1.0pp, and >=30 retained
 *   old-evidence trades on both paths;
 * - do not alter live config from this research harness.
 */

import fs from "fs";
import path from "path";
import { EMA } from "technicalindicators";
import { evaluateHlShortBreakdownFeaturePolicy } from "../src/bot/hl-short-breakdown-policy";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TP_PCT = 1.95;
const STOP_PCT = 4;
const HOLD_MS = 12 * HOUR;
const CONFIGURED_FEE_PCT = 0.11;
const STRESS_FEE_PCT = 0.20;
const NOTIONAL_USD = 25_000;
const TRAIN_END = Date.parse("2026-06-16T10:45:00.000Z");
const FIRST_FORWARD_START = Date.parse("2026-07-16T01:00:00.000Z");
const UNTOUCHED_START = Date.parse("2026-08-09T11:45:00.000Z");
const OUT_DIR = path.resolve(process.cwd(), "backtests/hype/hl-short-regime-revalidation-2026-09-04");
const HISTORICAL_DECISIONS = path.resolve(process.cwd(), "backtests/hype/hl-short-study-2026-08-10/decision-features.csv");
const SHADOW_EVENTS = path.resolve(process.cwd(), "data/HYPEUSDT_hl_short_breakdown_shadow.jsonl");
const CANDLES_FILE = path.resolve(process.cwd(), "data/HYPEUSDT_1m.jsonl");

interface Candle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Bar extends Candle {
  end: number;
  count: number;
}

interface Signal {
  ts: number;
  source: "historical_decision_grid" | "production_shadow" | "both";
}

interface SignalFeatures extends Signal {
  price: number;
  entryOpen: number;
  ret24hPct: number;
  ret72hPct: number;
  ret7dPct: number;
  ema20_1h: number;
  ema50_1h: number;
  ema20_4h: number;
  ema50_4h: number;
  ema200_4h: number;
  ema200DistPct: number;
  ema20Slope24hPct: number;
  localDown: boolean;
  downRegime: boolean;
  bullAligned: boolean;
  rallyLatchActive: boolean;
}

interface Trade {
  variant: string;
  delayMinutes: number;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  outcome: "tp" | "stop" | "timeout";
  grossPnlPct: number;
  pnlPct: number;
  stressPnlPct: number;
  maePct: number;
  mfePct: number;
}

interface Variant {
  id: string;
  family: string;
  description: string;
  allow: (feature: SignalFeatures) => boolean;
  diagnosticOnly?: boolean;
}

interface Stats {
  n: number;
  total: number;
  stressTotal: number;
  winRate: number;
  maxDrawdown: number;
  stops: number;
  timeouts: number;
}

function csvRows(filePath: string): Array<Record<string, string>> {
  const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => Object.fromEntries(line.split(",").map((value, index) => [headers[index], value])));
}

function jsonlRows(filePath: string): Array<Record<string, any>> {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean).flatMap(line => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

function loadCandles(): Candle[] {
  const byTs = new Map<number, Candle>();
  for (const row of jsonlRows(CANDLES_FILE)) {
    const ts = Number(row.ts ?? row.timestamp);
    const open = Number(row.o ?? row.open);
    const high = Number(row.h ?? row.high);
    const low = Number(row.l ?? row.low);
    const close = Number(row.c ?? row.close);
    if (![ts, open, high, low, close].every(Number.isFinite)) continue;
    byTs.set(ts, { ts, open, high, low, close, volume: Number(row.v ?? row.volume ?? 0) });
  }
  return [...byTs.values()].sort((a, b) => a.ts - b.ts);
}

function historicalSignals(): number[] {
  const rows = csvRows(HISTORICAL_DECISIONS);
  const signals: number[] = [];
  let last = -Infinity;
  for (const row of rows) {
    const ts = Date.parse(row.ts);
    if (ts - last < HOUR) continue;
    const decision = evaluateHlShortBreakdownFeaturePolicy({
      priceReady: true,
      red15m: row.red15 === "true",
      brokePrevious15mLow: row.breakPrev15Low === "true",
      return15mPct: Number(row.ret15),
      hlTaker15mRatio: Number(row.hlTaker15),
      hlTakerMinutes: Number(row.hlTakerCount15),
      hlBook5mImbalance: Number(row.hlOb5),
      hlBookPrior10mImbalance: Number(row.hlObPrior10),
      hlBookDelta: Number(row.hlObDelta),
      hlBookMinutes: Number(row.hlObCount15),
      assetAgeMs: Number(row.assetAgeMin) * MINUTE,
    });
    if (!decision.fired) continue;
    signals.push(ts);
    last = ts;
  }
  return signals;
}

function mergeSignals(): { signals: Signal[]; historicalCount: number; shadowCount: number; overlapCount: number } {
  const historical = historicalSignals();
  const shadow = [...new Set(jsonlRows(SHADOW_EVENTS)
    .filter(row => row.event === "signal" && Number.isFinite(Number(row.decisionTs ?? row.timestamp)))
    .map(row => Number(row.decisionTs ?? row.timestamp)))];
  const source = new Map<number, Signal["source"]>();
  for (const ts of historical) source.set(ts, "historical_decision_grid");
  let overlapCount = 0;
  for (const ts of shadow) {
    if (source.has(ts)) {
      source.set(ts, "both");
      overlapCount++;
    } else {
      source.set(ts, "production_shadow");
    }
  }
  return {
    signals: [...source].map(([ts, value]) => ({ ts, source: value })).sort((a, b) => a.ts - b.ts),
    historicalCount: historical.length,
    shadowCount: shadow.length,
    overlapCount,
  };
}

function aggregateBars(candles: Candle[], interval: number): Bar[] {
  const buckets = new Map<number, Bar>();
  for (const candle of candles) {
    const ts = Math.floor(candle.ts / interval) * interval;
    const existing = buckets.get(ts);
    if (!existing) {
      buckets.set(ts, { ...candle, ts, end: ts + interval, count: 1 });
    } else {
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close;
      existing.volume += candle.volume;
      existing.count++;
    }
  }
  const expected = interval / MINUTE;
  return [...buckets.values()].filter(bar => bar.count === expected).sort((a, b) => a.ts - b.ts);
}

function alignedEma(bars: Bar[], period: number): number[] {
  const result = EMA.calculate({ period, values: bars.map(bar => bar.close) });
  return [...Array(bars.length - result.length).fill(NaN), ...result];
}

function lastCompletedBarIndex(bars: Bar[], ts: number): number {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (bars[mid].end <= ts) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

function pct(now: number, prior: number): number {
  return prior !== 0 ? ((now - prior) / prior) * 100 : NaN;
}

function buildSignalFeatures(signals: Signal[], candles: Candle[]): SignalFeatures[] {
  const candleByTs = new Map(candles.map(candle => [candle.ts, candle]));
  const bars1h = aggregateBars(candles, HOUR);
  const bars4h = aggregateBars(candles, 4 * HOUR);
  const ema20_1h = alignedEma(bars1h, 20);
  const ema50_1h = alignedEma(bars1h, 50);
  const ema20_4h = alignedEma(bars4h, 20);
  const ema50_4h = alignedEma(bars4h, 50);
  const ema200_4h = alignedEma(bars4h, 200);
  const latchByBar = new Array<boolean>(bars4h.length).fill(false);
  let latch = false;
  let releaseBars = 0;
  for (let i = 0; i < bars4h.length; i++) {
    const prior7d = candleByTs.get(bars4h[i].end - 7 * DAY - MINUTE)?.close;
    const ret7d = prior7d ? pct(bars4h[i].close, prior7d) : NaN;
    const slope = i >= 6 ? pct(ema20_4h[i], ema20_4h[i - 6]) : NaN;
    const dist = pct(bars4h[i].close, ema200_4h[i]);
    const bullAligned = bars4h[i].close > ema20_4h[i]
      && ema20_4h[i] > ema50_4h[i]
      && ema50_4h[i] > ema200_4h[i]
      && slope > 0;
    if (!latch && bullAligned && dist >= 15 && ret7d >= 15) latch = true;
    if (latch) {
      const release = bars4h[i].close <= ema20_4h[i] || ret7d < 5;
      releaseBars = release ? releaseBars + 1 : 0;
      if (releaseBars >= 2) {
        latch = false;
        releaseBars = 0;
      }
    }
    latchByBar[i] = latch;
  }

  return signals.map(signal => {
    const prior = candleByTs.get(signal.ts - MINUTE);
    const entry = candleByTs.get(signal.ts);
    const i1 = lastCompletedBarIndex(bars1h, signal.ts);
    const i4 = lastCompletedBarIndex(bars4h, signal.ts);
    if (!prior || !entry || i1 < 50 || i4 < 200) throw new Error(`missing causal price context for ${new Date(signal.ts).toISOString()}`);
    const prior24h = candleByTs.get(signal.ts - DAY - MINUTE)?.close ?? NaN;
    const prior72h = candleByTs.get(signal.ts - 3 * DAY - MINUTE)?.close ?? NaN;
    const prior7d = candleByTs.get(signal.ts - 7 * DAY - MINUTE)?.close ?? NaN;
    const slope1h = i1 >= 6 ? pct(ema20_1h[i1], ema20_1h[i1 - 6]) : NaN;
    const slope4h = i4 >= 6 ? pct(ema20_4h[i4], ema20_4h[i4 - 6]) : NaN;
    const localDown = prior.close < ema20_1h[i1] && ema20_1h[i1] < ema50_1h[i1] && slope1h < 0;
    const macroBear = ema50_4h[i4] < ema200_4h[i4];
    const downRegime = macroBear || (prior.close < ema20_4h[i4] && slope4h < 0);
    const bullAligned = prior.close > ema20_4h[i4]
      && ema20_4h[i4] > ema50_4h[i4]
      && ema50_4h[i4] > ema200_4h[i4]
      && slope4h > 0;
    return {
      ...signal,
      price: prior.close,
      entryOpen: entry.open,
      ret24hPct: pct(prior.close, prior24h),
      ret72hPct: pct(prior.close, prior72h),
      ret7dPct: pct(prior.close, prior7d),
      ema20_1h: ema20_1h[i1],
      ema50_1h: ema50_1h[i1],
      ema20_4h: ema20_4h[i4],
      ema50_4h: ema50_4h[i4],
      ema200_4h: ema200_4h[i4],
      ema200DistPct: pct(prior.close, ema200_4h[i4]),
      ema20Slope24hPct: slope4h,
      localDown,
      downRegime,
      bullAligned,
      rallyLatchActive: latchByBar[i4],
    };
  });
}

const VARIANTS: Variant[] = [
  { id: "baseline", family: "control", description: "No higher-timeframe suspension.", allow: () => true },
  { id: "allow_down_regime", family: "existing_regime", description: "Allow only the original causal downRegime definition.", allow: feature => feature.downRegime },
  { id: "allow_local_down", family: "existing_regime", description: "Allow only the original causal localDown definition.", allow: feature => feature.localDown },
  { id: "suspend_bull_alignment", family: "trend_alignment", description: "Suspend when price/EMA20/EMA50/EMA200 are bull-aligned with positive 24h EMA20 slope.", allow: feature => !feature.bullAligned },
  { id: "suspend_ema200_ext15", family: "ema_extension", description: "Suspend at >=15% above completed-4h EMA200.", allow: feature => feature.ema200DistPct < 15 },
  { id: "suspend_ema200_ext20", family: "ema_extension", description: "Suspend at >=20% above completed-4h EMA200.", allow: feature => feature.ema200DistPct < 20 },
  { id: "suspend_ret7d_20", family: "rally_speed", description: "Suspend after a causal seven-day gain >=20%.", allow: feature => feature.ret7dPct < 20 },
  { id: "suspend_ext15_ret7d15", family: "composite", description: "Suspend only when EMA200 extension and seven-day gain are both >=15%.", allow: feature => !(feature.ema200DistPct >= 15 && feature.ret7dPct >= 15) },
  { id: "suspend_ext15_ret7d10_pullback", family: "composite", description: "Suspend an overextended weekly rally when the trailing 24h return is nonpositive.", allow: feature => !(feature.ema200DistPct >= 15 && feature.ret7dPct >= 10 && feature.ret24hPct <= 0) },
  { id: "suspend_bull_ext10_ret7d10", family: "composite", description: "Suspend bull alignment when EMA200 extension and seven-day gain are both >=10%.", allow: feature => !(feature.bullAligned && feature.ema200DistPct >= 10 && feature.ret7dPct >= 10) },
  { id: "suspend_rally_latch", family: "persistent", description: "Latch after bull alignment + >=15% EMA extension + >=15% seven-day gain; release after two 4h closes below EMA20 or ret7d<5%.", allow: feature => !feature.rallyLatchActive },
  { id: "all_paused", family: "diagnostic", description: "No entries; diagnostic pause comparator only.", allow: () => false, diagnosticOnly: true },
];

function simulate(features: SignalFeatures[], candles: Candle[], variant: Variant, delayMinutes: number): { trades: Trade[]; blocked: number; busy: number } {
  const candleIndex = new Map(candles.map((candle, index) => [candle.ts, index]));
  const trades: Trade[] = [];
  let blocked = 0;
  let busy = 0;
  let nextAllowed = -Infinity;
  for (const feature of features) {
    if (feature.ts < nextAllowed) {
      busy++;
      continue;
    }
    if (!variant.allow(feature)) {
      blocked++;
      continue;
    }
    const entryTs = feature.ts + delayMinutes * MINUTE;
    const start = candleIndex.get(entryTs);
    if (start === undefined) throw new Error(`missing entry candle ${new Date(entryTs).toISOString()}`);
    const entryPrice = candles[start].open;
    const target = entryPrice * (1 - TP_PCT / 100);
    const stop = entryPrice * (1 + STOP_PCT / 100);
    const expiresAt = entryTs + HOLD_MS;
    let exitPrice = entryPrice;
    let exitTime = entryTs;
    let outcome: Trade["outcome"] = "timeout";
    let maxHigh = entryPrice;
    let minLow = entryPrice;
    for (let i = start; i < candles.length && candles[i].ts < expiresAt; i++) {
      const candle = candles[i];
      maxHigh = Math.max(maxHigh, candle.high);
      minLow = Math.min(minLow, candle.low);
      exitPrice = candle.close;
      exitTime = candle.ts + MINUTE;
      if (candle.high >= stop) {
        outcome = "stop";
        exitPrice = stop;
        break;
      }
      if (candle.low <= target) {
        outcome = "tp";
        exitPrice = target;
        break;
      }
    }
    const grossPnlPct = ((entryPrice - exitPrice) / entryPrice) * 100;
    trades.push({
      variant: variant.id,
      delayMinutes,
      entryTime: entryTs,
      exitTime,
      entryPrice,
      exitPrice,
      outcome,
      grossPnlPct,
      pnlPct: grossPnlPct - CONFIGURED_FEE_PCT,
      stressPnlPct: grossPnlPct - STRESS_FEE_PCT,
      maePct: pct(maxHigh, entryPrice),
      mfePct: ((entryPrice - minLow) / entryPrice) * 100,
    });
    nextAllowed = exitTime;
  }
  return { trades, blocked, busy };
}

function stats(trades: Trade[]): Stats {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const trade of trades) {
    equity += trade.pnlPct;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  return {
    n: trades.length,
    total: equity,
    stressTotal: trades.reduce((sum, trade) => sum + trade.stressPnlPct, 0),
    winRate: trades.length ? trades.filter(trade => trade.pnlPct > 0).length / trades.length : 0,
    maxDrawdown,
    stops: trades.filter(trade => trade.outcome === "stop").length,
    timeouts: trades.filter(trade => trade.outcome === "timeout").length,
  };
}

function cohort(trades: Trade[], id: string): Trade[] {
  if (id === "train") return trades.filter(trade => trade.entryTime < TRAIN_END);
  if (id === "prior_test") return trades.filter(trade => trade.entryTime >= TRAIN_END && trade.entryTime < FIRST_FORWARD_START);
  if (id === "first_forward") return trades.filter(trade => trade.entryTime >= FIRST_FORWARD_START && trade.entryTime < UNTOUCHED_START);
  if (id === "old_evidence") return trades.filter(trade => trade.entryTime < UNTOUCHED_START);
  if (id === "untouched") return trades.filter(trade => trade.entryTime >= UNTOUCHED_START);
  return trades;
}

function monthTotals(trades: Trade[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const trade of trades) {
    const month = new Date(trade.entryTime).toISOString().slice(0, 7);
    out.set(month, (out.get(month) ?? 0) + trade.stressPnlPct);
  }
  return out;
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath: string, rows: Array<Record<string, unknown>>): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  fs.writeFileSync(filePath, [headers.join(","), ...rows.map(row => headers.map(header => csvEscape(row[header])).join(","))].join("\n") + "\n");
}

function assertNear(actual: number, expected: number, label: string): void {
  if (Math.abs(actual - expected) > 1e-6) throw new Error(`${label} parity failed: expected ${expected}, got ${actual}`);
}

function assertShadowReplayParity(trades: Trade[]): { exact: number; delay1m: number } {
  const closeByKey = new Map<string, Record<string, any>>();
  for (const row of jsonlRows(SHADOW_EVENTS)) {
    if (row.event !== "close" || Number(row.policyVersion) !== 2 || !Number.isFinite(Number(row.decisionTs)) || !row.close?.mode) continue;
    closeByKey.set(`${Number(row.decisionTs)}:${row.close.mode}`, row);
  }
  const matched = { exact: 0, delay1m: 0 };
  for (const trade of trades) {
    const signalTs = trade.entryTime - trade.delayMinutes * MINUTE;
    const mode = trade.delayMinutes === 0 ? "decision_open" : "delay_1m_open";
    const evidence = closeByKey.get(`${signalTs}:${mode}`);
    if (!evidence) continue;
    if (evidence.close.outcome !== trade.outcome) {
      throw new Error(`shadow outcome parity failed for ${new Date(signalTs).toISOString()} ${mode}: expected ${evidence.close.outcome}, got ${trade.outcome}`);
    }
    assertNear(trade.entryPrice, Number(evidence.close.entryPrice), `shadow entry ${new Date(signalTs).toISOString()} ${mode}`);
    assertNear(trade.stressPnlPct, Number(evidence.close.pnlPctStressFees), `shadow stress PnL ${new Date(signalTs).toISOString()} ${mode}`);
    if (trade.delayMinutes === 0) matched.exact++;
    else matched.delay1m++;
  }
  if (matched.exact !== 13 || matched.delay1m !== 12) {
    throw new Error(`shadow replay coverage parity failed: ${JSON.stringify(matched)}`);
  }
  return matched;
}

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const candles = loadCandles();
  const merged = mergeSignals();
  const features = buildSignalFeatures(merged.signals, candles);
  const simulations = new Map<string, ReturnType<typeof simulate>>();
  for (const variant of VARIANTS) {
    simulations.set(`${variant.id}:0`, simulate(features, candles, variant, 0));
    simulations.set(`${variant.id}:1`, simulate(features, candles, variant, 1));
  }

  const baselineExact = simulations.get("baseline:0")!;
  const baselineDelay = simulations.get("baseline:1")!;
  const baselineOld = stats(cohort(baselineExact.trades, "old_evidence"));
  const baselineFull = stats(baselineExact.trades);
  const baselineUntouched = stats(cohort(baselineExact.trades, "untouched"));
  assertNear(baselineOld.stressTotal, 38.29483031097172, "old TP1.95 stress baseline");
  assertNear(baselineFull.total, 22.880443564502343, "expanded configured baseline");
  assertNear(baselineFull.stressTotal, 17.750443564502344, "expanded stress baseline");
  if (merged.historicalCount !== 51 || merged.shadowCount !== 21 || merged.overlapCount !== 8 || features.length !== 64) {
    throw new Error(`signal parity failed: ${JSON.stringify({ ...merged, signals: merged.signals.length })}`);
  }
  const shadowReplayParity = assertShadowReplayParity([...baselineExact.trades, ...baselineDelay.trades]);

  const summaryRows: Array<Record<string, unknown>> = [];
  const cohortRows: Array<Record<string, unknown>> = [];
  const monthlyRows: Array<Record<string, unknown>> = [];
  const tradeRows: Array<Record<string, unknown>> = [];
  const baselineMonthsExact = monthTotals(baselineExact.trades);
  const baselineMonthsDelay = monthTotals(baselineDelay.trades);
  const baselineOldMonthsExact = monthTotals(cohort(baselineExact.trades, "old_evidence"));

  for (const variant of VARIANTS) {
    const exact = simulations.get(`${variant.id}:0`)!;
    const delay = simulations.get(`${variant.id}:1`)!;
    const exactFull = stats(exact.trades);
    const delayFull = stats(delay.trades);
    const exactOld = stats(cohort(exact.trades, "old_evidence"));
    const delayOld = stats(cohort(delay.trades, "old_evidence"));
    const exactNew = stats(cohort(exact.trades, "untouched"));
    const delayNew = stats(cohort(delay.trades, "untouched"));
    const baselineDelayOld = stats(cohort(baselineDelay.trades, "old_evidence"));
    const baselineDelayNew = stats(cohort(baselineDelay.trades, "untouched"));
    const exactMonths = monthTotals(exact.trades);
    const delayMonths = monthTotals(delay.trades);
    const exactOldMonths = monthTotals(cohort(exact.trades, "old_evidence"));
    const oldMonths = [...baselineOldMonthsExact.keys()];
    const worstOldMonthDelta = Math.min(...oldMonths.map(month => (exactOldMonths.get(month) ?? 0) - (baselineOldMonthsExact.get(month) ?? 0)));
    const oldExactDelta = exactOld.stressTotal - baselineOld.stressTotal;
    const oldDelayDelta = delayOld.stressTotal - baselineDelayOld.stressTotal;
    const untouchedExactDelta = exactNew.stressTotal - baselineUntouched.stressTotal;
    const untouchedDelayDelta = delayNew.stressTotal - baselineDelayNew.stressTotal;
    const fullExactDelta = exactFull.stressTotal - baselineFull.stressTotal;
    const fullDelayDelta = delayFull.stressTotal - stats(baselineDelay.trades).stressTotal;
    const passesGate = !variant.diagnosticOnly
      && variant.id !== "baseline"
      && exactOld.n >= 30
      && delayOld.n >= 30
      && oldExactDelta >= -1
      && oldDelayDelta >= -1
      && untouchedExactDelta >= 4
      && untouchedDelayDelta >= 4
      && fullExactDelta > 0
      && fullDelayDelta > 0
      && worstOldMonthDelta >= -1;
    summaryRows.push({
      variant: variant.id,
      family: variant.family,
      description: variant.description,
      exact_n: exactFull.n,
      exact_stress_total: exactFull.stressTotal,
      exact_stress_usd: exactFull.stressTotal * NOTIONAL_USD / 100,
      exact_delta: fullExactDelta,
      delay_n: delayFull.n,
      delay_stress_total: delayFull.stressTotal,
      delay_delta: fullDelayDelta,
      old_exact_n: exactOld.n,
      old_exact_delta: oldExactDelta,
      old_delay_n: delayOld.n,
      old_delay_delta: oldDelayDelta,
      untouched_exact_n: exactNew.n,
      untouched_exact_total: exactNew.stressTotal,
      untouched_exact_delta: untouchedExactDelta,
      untouched_delay_n: delayNew.n,
      untouched_delay_total: delayNew.stressTotal,
      untouched_delay_delta: untouchedDelayDelta,
      worst_old_month_delta: worstOldMonthDelta,
      exact_max_dd: exactFull.maxDrawdown,
      exact_stops: exactFull.stops,
      exact_timeouts: exactFull.timeouts,
      exact_blocked: exact.blocked,
      exact_busy: exact.busy,
      passes_gate: passesGate,
    });
    for (const cohortId of ["train", "prior_test", "first_forward", "old_evidence", "untouched", "full"]) {
      const exactStats = stats(cohort(exact.trades, cohortId));
      const delayStats = stats(cohort(delay.trades, cohortId));
      const baseExactStats = stats(cohort(baselineExact.trades, cohortId));
      const baseDelayStats = stats(cohort(baselineDelay.trades, cohortId));
      cohortRows.push({
        variant: variant.id,
        cohort: cohortId,
        exact_n: exactStats.n,
        exact_stress_total: exactStats.stressTotal,
        exact_delta: exactStats.stressTotal - baseExactStats.stressTotal,
        delay_n: delayStats.n,
        delay_stress_total: delayStats.stressTotal,
        delay_delta: delayStats.stressTotal - baseDelayStats.stressTotal,
      });
    }
    const months = [...new Set([...baselineMonthsExact.keys(), ...exactMonths.keys(), ...delayMonths.keys()])].sort();
    for (const month of months) {
      monthlyRows.push({
        variant: variant.id,
        month,
        exact_stress_total: exactMonths.get(month) ?? 0,
        exact_delta: (exactMonths.get(month) ?? 0) - (baselineMonthsExact.get(month) ?? 0),
        delay_stress_total: delayMonths.get(month) ?? 0,
        delay_delta: (delayMonths.get(month) ?? 0) - (baselineMonthsDelay.get(month) ?? 0),
      });
    }
    for (const trade of [...exact.trades, ...delay.trades]) {
      const feature = features.find(item => item.ts === trade.entryTime - trade.delayMinutes * MINUTE);
      tradeRows.push({
        ...trade,
        entryTime: new Date(trade.entryTime).toISOString(),
        exitTime: new Date(trade.exitTime).toISOString(),
        signalTime: feature ? new Date(feature.ts).toISOString() : "",
        ema200DistPct: feature?.ema200DistPct ?? "",
        ret7dPct: feature?.ret7dPct ?? "",
        ret24hPct: feature?.ret24hPct ?? "",
        bullAligned: feature?.bullAligned ?? "",
        downRegime: feature?.downRegime ?? "",
        localDown: feature?.localDown ?? "",
        rallyLatchActive: feature?.rallyLatchActive ?? "",
      });
    }
  }

  const baselineTradeBySignal = new Map(baselineExact.trades.map(trade => [trade.entryTime, trade]));
  writeCsv(path.join(OUT_DIR, "signal-features.csv"), features.map(feature => ({
    ...feature,
    ts: new Date(feature.ts).toISOString(),
    baselineOutcome: baselineTradeBySignal.get(feature.ts)?.outcome ?? "busy",
    baselineStressPnlPct: baselineTradeBySignal.get(feature.ts)?.stressPnlPct ?? "",
  })));
  writeCsv(path.join(OUT_DIR, "variant-summary.csv"), summaryRows);
  writeCsv(path.join(OUT_DIR, "cohort-results.csv"), cohortRows);
  writeCsv(path.join(OUT_DIR, "monthly-results.csv"), monthlyRows);
  writeCsv(path.join(OUT_DIR, "variant-trades.csv"), tradeRows);
  const run = {
    generatedAt: new Date().toISOString(),
    dataEnd: new Date(candles.at(-1)!.ts + MINUTE).toISOString(),
    cohorts: {
      trainEnd: new Date(TRAIN_END).toISOString(),
      firstForwardStart: new Date(FIRST_FORWARD_START).toISOString(),
      untouchedStart: new Date(UNTOUCHED_START).toISOString(),
    },
    signals: {
      historical: merged.historicalCount,
      shadow: merged.shadowCount,
      overlap: merged.overlapCount,
      merged: features.length,
      shadowReplayParity,
    },
    baseline: {
      exact: baselineFull,
      delay1m: stats(baselineDelay.trades),
      oldEvidence: baselineOld,
      untouched: baselineUntouched,
    },
    gates: {
      oldEvidenceMinimumDelta: -1,
      untouchedMinimumDelta: 4,
      minimumRetainedOldTrades: 30,
      worstOldMonthMinimumDelta: -1,
      fullDeltaMustBePositive: true,
      bothEntryPathsRequired: true,
    },
    passing: summaryRows.filter(row => row.passes_gate).map(row => row.variant),
  };
  fs.writeFileSync(path.join(OUT_DIR, "run.json"), JSON.stringify(run, null, 2) + "\n");
  console.table(summaryRows.map(row => ({
    variant: row.variant,
    oldDelta: Number(row.old_exact_delta).toFixed(3),
    newDelta: Number(row.untouched_exact_delta).toFixed(3),
    newDelayDelta: Number(row.untouched_delay_delta).toFixed(3),
    fullDelta: Number(row.exact_delta).toFixed(3),
    worstOldMonth: Number(row.worst_old_month_delta).toFixed(3),
    pass: row.passes_gate,
  })));
  console.log(JSON.stringify(run, null, 2));
  console.log(`Wrote ${OUT_DIR}`);
}

main();
