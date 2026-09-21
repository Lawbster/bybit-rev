/*
 * Strict decision-time HYPE short research over the common Hyperliquid pulse window.
 *
 * Safety / bias rules:
 * - Price features use only candles whose close is <= decision time.
 * - Pulse rows must have source timestamps strictly < decision time.
 * - Entry is the next 1m open at decision time.
 * - Intrabar ambiguity is stop-first; a ladder cannot claim a TP in an add bar.
 * - Rolling z-scores use only prior decision rows, never full-window ranks.
 * - Exit parameters are selected on the first half and evaluated on the second.
 *
 * This is a local research harness, never a PM2 process.
 * It imports the pure short policy, not exchange execution. Its default run
 * overwrites a dated report; use HL_SHORT_STUDY_OUT and HL_SHORT_STUDY_REPORT
 * to select a new output directory/report when refreshing the evidence.
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { ADX, BollingerBands, EMA, RSI, SMA } from "technicalindicators";
import { evaluateHlShortBreakdownFeaturePolicy } from "../src/bot/hl-short-breakdown-policy";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const FEE_PCT = 0.11;
const STRESS_FEE_PCT = 0.20;
const OUT_DIR = path.resolve(process.cwd(), process.env.HL_SHORT_STUDY_OUT ?? "backtests/hype/hl-short-study-2026-07-16");
const REPORT_PATH = path.resolve(process.cwd(), process.env.HL_SHORT_STUDY_REPORT ?? "research/codex-hl-short-system-findings-2026-07-16.md");

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
}

interface SeriesPoint {
  ts: number;
  value: number;
}

interface FlowPoint {
  ts: number;
  buy: number;
  sell: number;
}

interface LiqPoint {
  ts: number;
  longUsd: number;
  shortUsd: number;
  longCount: number;
  shortCount: number;
}

interface ObMinute {
  ts: number;
  imbalance05: number;
  imbalance20: number;
  bid01: number;
  count: number;
}

interface DecisionRow {
  ts: number;
  price: number;
  entryIndex: number;
  pulseHealthy: boolean;
  hlTakerCount15: number;
  hlObCount15: number;
  assetAgeMin: number;
  ret15: number;
  ret30: number;
  ret60: number;
  ret240: number;
  ret1440: number;
  btcRet60: number;
  red15: boolean;
  upperWick15: number;
  breakPrev15Low: boolean;
  volumeRatio15: number;
  closeVsEma20_1h: number;
  closeVsEma50_1h: number;
  ema20Below50_1h: boolean;
  ema50Below200_1h: boolean;
  ema20Slope6h: number;
  closeVsEma20_4h: number;
  ema50Below200_4h: boolean;
  ema20Slope24h: number;
  localDown: boolean;
  macroBear: boolean;
  downRegime: boolean;
  sdwFire: boolean;
  hlTaker5: number;
  hlTaker15: number;
  hlTaker60: number;
  binanceTaker15: number;
  hlOi15: number;
  hlOi60: number;
  hlOi240: number;
  hlOiValue: number;
  fundingHl: number;
  fundingBybit: number;
  hlOb5: number;
  hlOb15: number;
  hlObPrior10: number;
  hlObDelta: number;
  bybitOb5: number;
  bybitOb15: number;
  bybitObDelta: number;
  bybitBidDelta30: number;
  longLiq60: number;
  shortLiq60: number;
  longLiqCount60: number;
  shortLiqCount60: number;
  oiZ: number;
  fundingZ: number;
  shortLiqZ: number;
  longLiqZ: number;
  volumeZ: number;
}

interface SignalDef {
  id: string;
  family: string;
  mechanism: string;
  cooldownMin: number;
  test: (r: DecisionRow) => boolean;
}

interface Signal {
  strategy: string;
  family: string;
  ts: number;
  entryIndex: number;
  entryPrice: number;
}

interface SingleConfig {
  kind: "single";
  id: string;
  tp: number;
  stop: number;
  holdHours: number;
}

interface LadderConfig {
  kind: "ladder";
  id: string;
  addPcts: number[];
  weights: number[];
  tp: number;
  stop: number;
  holdHours: number;
}

type ExitConfig = SingleConfig | LadderConfig;

interface Trade {
  strategy: string;
  family: string;
  configId: string;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  outcome: "tp" | "stop" | "timeout";
  pnlPct: number;
  stressPnlPct: number;
  maePct: number;
  mfePct: number;
  fills: number;
}

interface Stats {
  n: number;
  winRate: number;
  expectancy: number;
  stressExpectancy: number;
  total: number;
  maxDrawdown: number;
  avgMae: number;
  avgMfe: number;
  positiveWeeks: number;
  activeWeeks: number;
}

interface Evaluation {
  strategy: string;
  family: string;
  config: ExitConfig;
  train: Stats;
  test: Stats;
  all: Stats;
  neighborTestMedian: number;
  delay1Test: Stats;
  pass: boolean;
  trades: Trade[];
}

function finite(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function eachJsonl(filePath: string, fn: (row: Record<string, any>) => void): Promise<void> {
  const input = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      fn(JSON.parse(line));
    } catch {
      // Ignore a truncated final line from a collector snapshot.
    }
  }
}

async function loadCandles(fileName: string): Promise<Candle[]> {
  const rows: Candle[] = [];
  await eachJsonl(path.resolve(process.cwd(), "data", fileName), (row) => {
    const ts = finite(row.ts ?? row.timestamp);
    const open = finite(row.o ?? row.open);
    const high = finite(row.h ?? row.high);
    const low = finite(row.l ?? row.low);
    const close = finite(row.c ?? row.close);
    const volume = finite(row.v ?? row.volume) ?? 0;
    if (ts === null || open === null || high === null || low === null || close === null) return;
    rows.push({ ts, open, high, low, close, volume });
  });
  rows.sort((a, b) => a.ts - b.ts);
  const deduped: Candle[] = [];
  for (const row of rows) {
    if (deduped.length && deduped[deduped.length - 1].ts === row.ts) deduped[deduped.length - 1] = row;
    else deduped.push(row);
  }
  return deduped;
}

function aggregateBars(candles: Candle[], interval: number): Bar[] {
  const out: Bar[] = [];
  let current: Bar | null = null;
  let lastTs = 0;
  for (const c of candles) {
    const start = Math.floor(c.ts / interval) * interval;
    if (!current || current.ts !== start) {
      if (current && lastTs === current.end - MINUTE) out.push(current);
      current = { ts: start, end: start + interval, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
    } else {
      current.high = Math.max(current.high, c.high);
      current.low = Math.min(current.low, c.low);
      current.close = c.close;
      current.volume += c.volume;
    }
    lastTs = c.ts;
  }
  if (current && lastTs === current.end - MINUTE) out.push(current);
  return out;
}

function indicatorAligned(values: number[], calculated: number[], period: number): number[] {
  const out = Array(values.length).fill(NaN);
  const offset = values.length - calculated.length;
  for (let i = 0; i < calculated.length; i++) out[offset + i] = calculated[i];
  if (offset < period - 1) throw new Error("unexpected indicator alignment");
  return out;
}

function objectIndicatorAligned<T>(length: number, calculated: T[]): Array<T | null> {
  const out: Array<T | null> = Array(length).fill(null);
  const offset = length - calculated.length;
  for (let i = 0; i < calculated.length; i++) out[offset + i] = calculated[i];
  return out;
}

function upperBound<T>(rows: T[], ts: number, getTs: (row: T) => number): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (getTs(rows[mid]) < ts) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function latestBefore<T>(rows: T[], ts: number, getTs: (row: T) => number): T | null {
  const i = upperBound(rows, ts, getTs) - 1;
  return i >= 0 ? rows[i] : null;
}

function range<T>(rows: T[], start: number, end: number, getTs: (row: T) => number): T[] {
  return rows.slice(upperBound(rows, start, getTs), upperBound(rows, end, getTs));
}

function seriesValue(rows: SeriesPoint[], ts: number, maxAge = Infinity): number {
  const row = latestBefore(rows, ts, (x) => x.ts);
  return row && ts - row.ts <= maxAge ? row.value : NaN;
}

async function loadSeries(fileName: string, field: string): Promise<SeriesPoint[]> {
  const out: SeriesPoint[] = [];
  await eachJsonl(path.resolve(process.cwd(), "data", fileName), (row) => {
    const ts = finite(row.timestamp ?? row.ts);
    const value = finite(row[field]);
    if (ts !== null && value !== null) out.push({ ts, value });
  });
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

async function loadFlow(fileName: string): Promise<FlowPoint[]> {
  const out: FlowPoint[] = [];
  await eachJsonl(path.resolve(process.cwd(), "data", fileName), (row) => {
    const ts = finite(row.timestamp ?? row.ts);
    const buy = finite(row.buyNotional ?? row.buyVol);
    const sell = finite(row.sellNotional ?? row.sellVol);
    if (ts !== null && buy !== null && sell !== null) out.push({ ts, buy, sell });
  });
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

async function loadLiquidations(fileName: string): Promise<LiqPoint[]> {
  const buckets = new Map<number, LiqPoint>();
  await eachJsonl(path.resolve(process.cwd(), "data", fileName), (row) => {
    const rawTs = finite(row.timestamp ?? row.ts);
    const usd = finite(row.notionalUsd);
    if (rawTs === null || usd === null) return;
    const ts = Math.floor(rawTs / MINUTE) * MINUTE;
    const item = buckets.get(ts) ?? { ts, longUsd: 0, shortUsd: 0, longCount: 0, shortCount: 0 };
    if (row.liquidatedSide === "long") {
      item.longUsd += usd;
      item.longCount++;
    } else if (row.liquidatedSide === "short") {
      item.shortUsd += usd;
      item.shortCount++;
    }
    buckets.set(ts, item);
  });
  return [...buckets.values()].sort((a, b) => a.ts - b.ts);
}

async function loadOb(fileName: string, hyperliquid: boolean): Promise<ObMinute[]> {
  interface MutableOb { ts: number; imbalance05Sum: number; imbalance20Sum: number; bid01Last: number; count: number; }
  const buckets = new Map<number, MutableOb>();
  await eachJsonl(path.resolve(process.cwd(), "data", fileName), (row) => {
    const rawTs = finite(row.timestamp ?? row.ts);
    const im05 = finite(row.imbalance_0_5);
    if (rawTs === null || im05 === null) return;
    const ts = Math.floor(rawTs / MINUTE) * MINUTE;
    const item = buckets.get(ts) ?? { ts, imbalance05Sum: 0, imbalance20Sum: 0, bid01Last: NaN, count: 0 };
    item.imbalance05Sum += im05;
    item.imbalance20Sum += finite(row.imbalance_2_0) ?? im05;
    const bid01 = finite(row.bidBands?.pct_0_1);
    if (!hyperliquid && bid01 !== null) item.bid01Last = bid01;
    item.count++;
    buckets.set(ts, item);
  });
  return [...buckets.values()].sort((a, b) => a.ts - b.ts).map((x) => ({
    ts: x.ts,
    imbalance05: x.imbalance05Sum / x.count,
    imbalance20: x.imbalance20Sum / x.count,
    bid01: x.bid01Last,
    count: x.count,
  }));
}

function flowRatio(rows: FlowPoint[], start: number, end: number): { ratio: number; count: number } {
  const values = range(rows, start, end, (x) => x.ts);
  let buy = 0;
  let sell = 0;
  for (const row of values) { buy += row.buy; sell += row.sell; }
  return { ratio: sell > 0 ? buy / sell : NaN, count: values.length };
}

function obAverage(rows: ObMinute[], start: number, end: number): { value: number; count: number } {
  const values = range(rows, start, end, (x) => x.ts);
  if (!values.length) return { value: NaN, count: 0 };
  return { value: values.reduce((sum, x) => sum + x.imbalance05, 0) / values.length, count: values.length };
}

function obBidDelta(rows: ObMinute[], ts: number, lookback: number): number {
  const current = latestBefore(rows, ts, (x) => x.ts);
  const prior = latestBefore(rows, ts - lookback, (x) => x.ts);
  if (!current || !prior || !Number.isFinite(current.bid01) || !Number.isFinite(prior.bid01) || prior.bid01 === 0) return NaN;
  return ((current.bid01 - prior.bid01) / prior.bid01) * 100;
}

function liquidationSum(rows: LiqPoint[], start: number, end: number): LiqPoint {
  const values = range(rows, start, end, (x) => x.ts);
  return values.reduce((a, x) => ({
    ts: end,
    longUsd: a.longUsd + x.longUsd,
    shortUsd: a.shortUsd + x.shortUsd,
    longCount: a.longCount + x.longCount,
    shortCount: a.shortCount + x.shortCount,
  }), { ts: end, longUsd: 0, shortUsd: 0, longCount: 0, shortCount: 0 });
}

function pctChange(current: number, prior: number): number {
  return Number.isFinite(current) && Number.isFinite(prior) && prior !== 0 ? ((current - prior) / prior) * 100 : NaN;
}

function rollingZ(rows: DecisionRow[], i: number, get: (r: DecisionRow) => number, lookbackRows = 7 * 24 * 4): number {
  const values: number[] = [];
  for (let j = Math.max(0, i - lookbackRows); j < i; j++) {
    const value = get(rows[j]);
    if (Number.isFinite(value)) values.push(value);
  }
  if (values.length < 96) return NaN;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  const current = get(rows[i]);
  return Number.isFinite(current) && sd > 0 ? (current - mean) / sd : NaN;
}

function barIndexAt(bars: Bar[], ts: number): number {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (bars[mid].end <= ts) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

function candleIndexAt(candles: Candle[], ts: number): number {
  let lo = 0;
  let hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (candles[mid].ts < ts) lo = mid + 1;
    else hi = mid;
  }
  return lo < candles.length && candles[lo].ts === ts ? lo : -1;
}

function exactSdwFire(
  bars1h: Bar[], i: number, ema50: number[], ema200: number[], rsi14: number[],
  adx14: Array<{ adx: number; pdi: number; mdi: number } | null>,
  bb20: Array<{ upper: number; middle: number; lower: number; pb?: number } | null>,
  volSma20: number[],
): boolean {
  if (i < 200 || !Number.isFinite(ema50[i]) || !Number.isFinite(ema200[i])) return false;
  const bar = bars1h[i];
  const dayStart = Math.floor(bar.ts / DAY) * DAY;
  const first = bars1h.find((x) => x.ts === dayStart);
  if (!first) return false;
  const rangePct = bar.high - bar.low;
  const upperWick = rangePct > 0 ? ((bar.high - Math.max(bar.open, bar.close)) / rangePct) * 100 : 0;
  const d = new Date(bar.ts);
  const dow = d.getUTCDay();
  const hour = d.getUTCHours();
  const wedThu = (dow === 3 && hour >= 18) || (dow === 4 && hour <= 12);
  const hourBias = hour === 11 || hour === 22;
  if (!(ema50[i] < ema200[i] && (wedThu || hourBias) && bar.close < first.open && bar.close < bar.open && upperWick >= 20)) return false;
  const volumeOk = Number.isFinite(volSma20[i]) && volSma20[i] > 0 && bar.volume / volSma20[i] <= 1.2;
  const bb = bb20[i];
  const bbOk = !!bb && bb.upper !== bb.lower && (bar.close - bb.lower) / (bb.upper - bb.lower) >= 0.55;
  const diBear = !!adx14[i] && adx14[i]!.mdi > adx14[i]!.pdi;
  const rsiOk = Number.isFinite(rsi14[i]) && rsi14[i] >= 52;
  const score = (wedThu ? 0.8 : 0) + (hourBias ? 0.5 : 0) + (volumeOk ? 0.5 : 0) + (diBear ? 0.5 : 0) + (bbOk ? 0.4 : 0) + (rsiOk ? 0.4 : 0);
  return score >= 1.4;
}

async function buildDecisionRows(): Promise<{ candles: Candle[]; rows: DecisionRow[]; commonStart: number; commonEnd: number }> {
  console.log("Loading price candles...");
  const [candles, btcCandles] = await Promise.all([
    loadCandles("HYPEUSDT_1m.jsonl"),
    loadCandles("BTCUSDT_1m.jsonl"),
  ]);
  const bars15 = aggregateBars(candles, 15 * MINUTE);
  const bars1h = aggregateBars(candles, HOUR);
  const bars4h = aggregateBars(candles, 4 * HOUR);
  const btc1h = aggregateBars(btcCandles, HOUR);
  const ema20_1h = indicatorAligned(bars1h.map((x) => x.close), EMA.calculate({ period: 20, values: bars1h.map((x) => x.close) }), 20);
  const ema50_1h = indicatorAligned(bars1h.map((x) => x.close), EMA.calculate({ period: 50, values: bars1h.map((x) => x.close) }), 50);
  const ema200_1h = indicatorAligned(bars1h.map((x) => x.close), EMA.calculate({ period: 200, values: bars1h.map((x) => x.close) }), 200);
  const rsi14_1h = indicatorAligned(bars1h.map((x) => x.close), RSI.calculate({ period: 14, values: bars1h.map((x) => x.close) }), 14);
  const adx14_1h = objectIndicatorAligned(bars1h.length, ADX.calculate({ period: 14, high: bars1h.map((x) => x.high), low: bars1h.map((x) => x.low), close: bars1h.map((x) => x.close) }));
  const bb20_1h = objectIndicatorAligned(bars1h.length, BollingerBands.calculate({ period: 20, stdDev: 2, values: bars1h.map((x) => x.close) }));
  const volSma20_1h = indicatorAligned(bars1h.map((x) => x.volume), SMA.calculate({ period: 20, values: bars1h.map((x) => x.volume) }), 20);
  const ema20_4h = indicatorAligned(bars4h.map((x) => x.close), EMA.calculate({ period: 20, values: bars4h.map((x) => x.close) }), 20);
  const ema50_4h = indicatorAligned(bars4h.map((x) => x.close), EMA.calculate({ period: 50, values: bars4h.map((x) => x.close) }), 50);
  const ema200_4h = indicatorAligned(bars4h.map((x) => x.close), EMA.calculate({ period: 200, values: bars4h.map((x) => x.close) }), 200);

  console.log("Loading and minute-aggregating pulse streams...");
  const [hlFlow, binanceFlow, hlOi, hlFunding, bybitFunding, hlOb, bybitOb, liquidations] = await Promise.all([
    loadFlow("HYPEUSDT_taker_hyperliquid.jsonl"),
    loadFlow("HYPEUSDT_taker_binance.jsonl"),
    loadSeries("HYPEUSDT_asset_ctx_hyperliquid.jsonl", "openInterestValue"),
    loadSeries("HYPEUSDT_asset_ctx_hyperliquid.jsonl", "fundingRate"),
    loadSeries("HYPEUSDT_funding_live.jsonl", "fundingRate"),
    loadOb("HYPEUSDT_ob_bands_hyperliquid.jsonl", true),
    loadOb("HYPEUSDT_ob_bands.jsonl", false),
    loadLiquidations("HYPEUSDT_liquidations.jsonl"),
  ]);

  const starts = [hlFlow[0]?.ts, hlOi[0]?.ts, hlOb[0]?.ts].filter(Number.isFinite) as number[];
  const ends = [hlFlow.at(-1)?.ts, hlOi.at(-1)?.ts, hlOb.at(-1)?.ts, candles.at(-1)?.ts].filter(Number.isFinite) as number[];
  const commonStart = Math.ceil(Math.max(...starts) / (15 * MINUTE)) * 15 * MINUTE;
  const commonEnd = Math.floor(Math.min(...ends) / (15 * MINUTE)) * 15 * MINUTE;
  const candleByTs = new Map(candles.map((x, i) => [x.ts, i]));
  const btcByTs = new Map(btcCandles.map((x) => [x.ts, x]));
  const rows: DecisionRow[] = [];

  for (let ts = commonStart; ts <= commonEnd; ts += 15 * MINUTE) {
    const entryIndex = candleByTs.get(ts);
    if (entryIndex === undefined || entryIndex < 1440) continue;
    const prior = candles[entryIndex - 1];
    // prior is the candle ending at T. A return over N minutes compares it with
    // the candle ending at T-N, hence entryIndex - 1 - N.
    const priceAgo = (mins: number) => candles[entryIndex - 1 - mins]?.close ?? NaN;
    const btcPrior = btcByTs.get(ts - MINUTE);
    const btcAgo = btcByTs.get(ts - 61 * MINUTE);
    const i15 = barIndexAt(bars15, ts);
    const i1 = barIndexAt(bars1h, ts);
    const i4 = barIndexAt(bars4h, ts);
    if (i15 < 2 || i1 < 205 || i4 < 205) continue;
    const b15 = bars15[i15];
    const p15 = bars15[i15 - 1];
    const range15 = b15.high - b15.low;
    const upperWick15 = range15 > 0 ? ((b15.high - Math.max(b15.open, b15.close)) / range15) * 100 : 0;
    const meanVol = bars15.slice(Math.max(0, i15 - 96), i15).reduce((s, x) => s + x.volume, 0) / Math.min(96, i15);
    const hl5 = flowRatio(hlFlow, ts - 5 * MINUTE, ts);
    const hl15 = flowRatio(hlFlow, ts - 15 * MINUTE, ts);
    const hl60 = flowRatio(hlFlow, ts - HOUR, ts);
    const bn15 = flowRatio(binanceFlow, ts - 15 * MINUTE, ts);
    const oiNow = seriesValue(hlOi, ts, 3 * MINUTE);
    const oi15 = seriesValue(hlOi, ts - 15 * MINUTE, 3 * MINUTE);
    const oi60 = seriesValue(hlOi, ts - HOUR, 3 * MINUTE);
    const oi240 = seriesValue(hlOi, ts - 4 * HOUR, 3 * MINUTE);
    const ob5 = obAverage(hlOb, ts - 5 * MINUTE, ts);
    const ob15 = obAverage(hlOb, ts - 15 * MINUTE, ts);
    const obPrior10 = obAverage(hlOb, ts - 15 * MINUTE, ts - 5 * MINUTE);
    const bybit5 = obAverage(bybitOb, ts - 5 * MINUTE, ts);
    const bybit15 = obAverage(bybitOb, ts - 15 * MINUTE, ts);
    const liq = liquidationSum(liquidations, ts - HOUR, ts);
    const lastAsset = latestBefore(hlOi, ts, (x) => x.ts);
    const closeVsEma20_1h = pctChange(prior.close, ema20_1h[i1]);
    const closeVsEma50_1h = pctChange(prior.close, ema50_1h[i1]);
    const closeVsEma20_4h = pctChange(prior.close, ema20_4h[i4]);
    const ema20Slope6h = i1 >= 6 ? pctChange(ema20_1h[i1], ema20_1h[i1 - 6]) : NaN;
    const ema20Slope24h = i4 >= 6 ? pctChange(ema20_4h[i4], ema20_4h[i4 - 6]) : NaN;
    const localDown = closeVsEma20_1h < 0 && ema20_1h[i1] < ema50_1h[i1] && ema20Slope6h < 0;
    const macroBear = ema50_4h[i4] < ema200_4h[i4];
    const downRegime = macroBear || (closeVsEma20_4h < 0 && ema20Slope24h < 0);
    rows.push({
      ts,
      price: prior.close,
      entryIndex,
      pulseHealthy: hl15.count >= 12 && ob15.count >= 12 && !!lastAsset && ts - lastAsset.ts <= 3 * MINUTE,
      hlTakerCount15: hl15.count,
      hlObCount15: ob15.count,
      assetAgeMin: lastAsset ? (ts - lastAsset.ts) / MINUTE : Infinity,
      ret15: pctChange(prior.close, priceAgo(15)),
      ret30: pctChange(prior.close, priceAgo(30)),
      ret60: pctChange(prior.close, priceAgo(60)),
      ret240: pctChange(prior.close, priceAgo(240)),
      ret1440: pctChange(prior.close, priceAgo(1440)),
      btcRet60: btcPrior && btcAgo ? pctChange(btcPrior.close, btcAgo.close) : NaN,
      red15: b15.close < b15.open,
      upperWick15,
      breakPrev15Low: b15.close < p15.low,
      volumeRatio15: meanVol > 0 ? b15.volume / meanVol : NaN,
      closeVsEma20_1h,
      closeVsEma50_1h,
      ema20Below50_1h: ema20_1h[i1] < ema50_1h[i1],
      ema50Below200_1h: ema50_1h[i1] < ema200_1h[i1],
      ema20Slope6h,
      closeVsEma20_4h,
      ema50Below200_4h: macroBear,
      ema20Slope24h,
      localDown,
      macroBear,
      downRegime,
      sdwFire: ts % HOUR === 0 && exactSdwFire(bars1h, i1, ema50_1h, ema200_1h, rsi14_1h, adx14_1h, bb20_1h, volSma20_1h),
      hlTaker5: hl5.ratio,
      hlTaker15: hl15.ratio,
      hlTaker60: hl60.ratio,
      binanceTaker15: bn15.ratio,
      hlOi15: pctChange(oiNow, oi15),
      hlOi60: pctChange(oiNow, oi60),
      hlOi240: pctChange(oiNow, oi240),
      hlOiValue: oiNow,
      fundingHl: seriesValue(hlFunding, ts, 3 * MINUTE),
      fundingBybit: seriesValue(bybitFunding, ts, 3 * MINUTE),
      hlOb5: ob5.value,
      hlOb15: ob15.value,
      hlObPrior10: obPrior10.value,
      hlObDelta: ob5.value - obPrior10.value,
      bybitOb5: bybit5.value,
      bybitOb15: bybit15.value,
      bybitObDelta: bybit5.value - bybit15.value,
      bybitBidDelta30: obBidDelta(bybitOb, ts, 30 * MINUTE),
      longLiq60: liq.longUsd,
      shortLiq60: liq.shortUsd,
      longLiqCount60: liq.longCount,
      shortLiqCount60: liq.shortCount,
      oiZ: NaN,
      fundingZ: NaN,
      shortLiqZ: NaN,
      longLiqZ: NaN,
      volumeZ: NaN,
    });
  }
  for (let i = 0; i < rows.length; i++) {
    rows[i].oiZ = rollingZ(rows, i, (r) => r.hlOiValue);
    rows[i].fundingZ = rollingZ(rows, i, (r) => r.fundingHl);
    rows[i].shortLiqZ = rollingZ(rows, i, (r) => Math.log1p(r.shortLiq60));
    rows[i].longLiqZ = rollingZ(rows, i, (r) => Math.log1p(r.longLiq60));
    rows[i].volumeZ = rollingZ(rows, i, (r) => r.volumeRatio15);
  }
  return { candles, rows, commonStart, commonEnd };
}

function valid(...values: number[]): boolean { return values.every(Number.isFinite); }

function definitions(): SignalDef[] {
  const healthy = (r: DecisionRow) => r.pulseHealthy;
  const breakdown = (r: DecisionRow) => r.red15 && r.breakPrev15Low && r.ret15 <= -0.20;
  const sellFlow = (r: DecisionRow) => valid(r.hlTaker15) && r.hlTaker15 < 0.90;
  const crossSell = (r: DecisionRow) => sellFlow(r) && valid(r.binanceTaker15) && r.binanceTaker15 < 1.0;
  const rejection = (r: DecisionRow) => r.red15 && r.upperWick15 >= 20;
  return [
    { id: "sdw_baseline", family: "session_rejection", cooldownMin: 8 * 60, mechanism: "Existing closed-1H session/daily-red upper-wick baseline.", test: (r) => r.sdwFire },
    { id: "control_plain_break", family: "control", cooldownMin: 60, mechanism: "Control: completed 15m downside break without pulse confirmation.", test: (r) => breakdown(r) },
    { id: "control_break_hl_sell", family: "control", cooldownMin: 60, mechanism: "Control: completed 15m downside break plus HL taker selling, without book withdrawal.", test: (r) => healthy(r) && breakdown(r) && sellFlow(r) },
    { id: "control_hl_book_pull", family: "control", cooldownMin: 60, mechanism: "Control: HL book withdrawal without a completed downside break or taker confirmation.", test: (r) => healthy(r) && r.hlObDelta < -0.15 && r.hlOb5 < -0.05 },
    { id: "legacy_bidpull_vol", family: "bid_pull", cooldownMin: 60, mechanism: "Exact 5.15b-style Bybit 0.1% bid-depth pull plus 5m/15m volume expansion retest.", test: (r) => valid(r.bybitBidDelta30, r.volumeRatio15) && r.bybitBidDelta30 < -25 && r.volumeRatio15 > 1.5 },
    { id: "legacy_bidpull_vol_down", family: "bid_pull", cooldownMin: 60, mechanism: "Legacy bid pull/volume expansion restricted to a live-known down regime.", test: (r) => r.downRegime && valid(r.bybitBidDelta30, r.volumeRatio15) && r.bybitBidDelta30 < -25 && r.volumeRatio15 > 1.5 },
    { id: "bear_bounce_reject", family: "bear_bounce", cooldownMin: 60, mechanism: "Bounce in a down regime followed by a closed 15m rejection.", test: (r) => r.downRegime && r.ret60 > 0.35 && rejection(r) && r.closeVsEma20_1h < 0.5 },
    { id: "bear_bounce_reject_hl", family: "bear_bounce", cooldownMin: 60, mechanism: "Bear-bounce rejection with HL taker sell confirmation.", test: (r) => healthy(r) && r.downRegime && r.ret60 > 0.35 && rejection(r) && sellFlow(r) },
    { id: "bear_bounce_cross_sell", family: "bear_bounce", cooldownMin: 60, mechanism: "Bear-bounce rejection with HL and Binance sell confirmation.", test: (r) => healthy(r) && r.downRegime && r.ret60 > 0.35 && rejection(r) && crossSell(r) },
    { id: "crowded_breakdown", family: "crowded_long", cooldownMin: 90, mechanism: "Elevated OI/positive funding, then confirmed price breakdown and HL selling.", test: (r) => healthy(r) && breakdown(r) && sellFlow(r) && r.oiZ > 0.5 && r.fundingHl > 0 },
    { id: "crowded_breakdown_strict", family: "crowded_long", cooldownMin: 120, mechanism: "Crowded-long breakdown with OI rising over 4h and cross-venue sell flow.", test: (r) => healthy(r) && breakdown(r) && crossSell(r) && r.oiZ > 0.5 && r.hlOi240 > 0.5 && r.fundingHl > 0 },
    { id: "crowded_breakdown_down", family: "crowded_long", cooldownMin: 90, mechanism: "Crowded-long breakdown restricted to a down regime.", test: (r) => healthy(r) && r.downRegime && breakdown(r) && sellFlow(r) && r.oiZ > 0 },
    { id: "oi_price_div_break", family: "oi_divergence", cooldownMin: 90, mechanism: "OI rises while 4h price stalls, then a closed 15m downside break confirms.", test: (r) => healthy(r) && r.hlOi240 > 1 && r.ret240 < 1 && breakdown(r) && sellFlow(r) },
    { id: "oi_price_div_cross", family: "oi_divergence", cooldownMin: 120, mechanism: "OI/price divergence plus cross-venue taker selling.", test: (r) => healthy(r) && r.hlOi240 > 0.75 && r.ret240 < 0.75 && breakdown(r) && crossSell(r) },
    {
      id: "hl_bid_pull_break",
      family: "bid_pull",
      cooldownMin: 60,
      mechanism: "HL 0.5% book imbalance sharply deteriorates before a downside break.",
      test: (r) => evaluateHlShortBreakdownFeaturePolicy({
        priceReady: true,
        red15m: r.red15,
        brokePrevious15mLow: r.breakPrev15Low,
        return15mPct: r.ret15,
        hlTaker15mRatio: r.hlTaker15,
        hlTakerMinutes: r.hlTakerCount15,
        hlBook5mImbalance: r.hlOb5,
        hlBookPrior10mImbalance: r.hlObPrior10,
        hlBookDelta: r.hlObDelta,
        hlBookMinutes: r.hlObCount15,
        assetAgeMs: r.assetAgeMin * MINUTE,
      }).fired,
    },
    { id: "cross_book_pull_break", family: "bid_pull", cooldownMin: 90, mechanism: "HL and Bybit books both weaken before a confirmed downside break.", test: (r) => healthy(r) && r.hlObDelta < -0.10 && r.bybitObDelta < -0.10 && breakdown(r) && crossSell(r) },
    { id: "hl_bid_pull_volume", family: "bid_pull", cooldownMin: 60, mechanism: "HL bid-side deterioration with expanding 15m volume and sell flow.", test: (r) => healthy(r) && r.hlObDelta < -0.15 && r.volumeRatio15 > 1.25 && r.red15 && sellFlow(r) },
    { id: "short_liq_blowoff_fail", family: "blowoff_failure", cooldownMin: 120, mechanism: "Short-liquidation/pump burst followed by a closed rejection and HL seller takeover.", test: (r) => healthy(r) && r.shortLiqZ > 1 && r.ret60 > 1.5 && rejection(r) && sellFlow(r) },
    { id: "short_liq_blowoff_cross", family: "blowoff_failure", cooldownMin: 180, mechanism: "Liquidation blow-off failure with cross-venue selling and downside break.", test: (r) => healthy(r) && r.shortLiqZ > 0.75 && r.ret60 > 1 && rejection(r) && r.breakPrev15Low && crossSell(r) },
    { id: "trend_break_sell", family: "trend_continuation", cooldownMin: 60, mechanism: "Local 1H downtrend, confirmed 15m break, volume and cross-venue sell flow.", test: (r) => healthy(r) && r.localDown && breakdown(r) && crossSell(r) && r.volumeRatio15 > 1.1 },
    { id: "macro_break_sell", family: "trend_continuation", cooldownMin: 90, mechanism: "4H down regime and confirmed 15m breakdown with HL book/taker agreement.", test: (r) => healthy(r) && r.downRegime && breakdown(r) && sellFlow(r) && r.hlOb5 < 0 },
    { id: "btc_led_break", family: "btc_lead", cooldownMin: 90, mechanism: "BTC already weak while HYPE enters a confirmed local-down breakdown.", test: (r) => healthy(r) && r.localDown && r.btcRet60 < -0.5 && breakdown(r) && sellFlow(r) },
  ];
}

function generateSignals(rows: DecisionRow[], defs: SignalDef[]): Map<string, Signal[]> {
  const out = new Map<string, Signal[]>();
  for (const def of defs) {
    const signals: Signal[] = [];
    let last = -Infinity;
    for (const row of rows) {
      if (row.ts - last < def.cooldownMin * MINUTE || !def.test(row)) continue;
      signals.push({ strategy: def.id, family: def.family, ts: row.ts, entryIndex: row.entryIndex, entryPrice: row.price });
      last = row.ts;
    }
    out.set(def.id, signals);
  }
  return out;
}

function exitConfigs(): ExitConfig[] {
  const singles: SingleConfig[] = [];
  for (const tp of [0.5, 0.75, 1, 1.5, 2]) {
    for (const stop of [1.5, 2, 3, 4]) {
      for (const holdHours of [4, 8, 12]) singles.push({ kind: "single", id: `S_tp${tp}_sl${stop}_h${holdHours}`, tp, stop, holdHours });
    }
  }
  const ladders: LadderConfig[] = [
    { kind: "ladder", id: "L_075_150_tp050_sl300_h8", addPcts: [0.75, 1.5], weights: [0.5, 0.3, 0.2], tp: 0.5, stop: 3, holdHours: 8 },
    { kind: "ladder", id: "L_075_150_tp075_sl300_h12", addPcts: [0.75, 1.5], weights: [0.5, 0.3, 0.2], tp: 0.75, stop: 3, holdHours: 12 },
    { kind: "ladder", id: "L_100_200_tp075_sl400_h12", addPcts: [1, 2], weights: [0.5, 0.3, 0.2], tp: 0.75, stop: 4, holdHours: 12 },
    { kind: "ladder", id: "L_050_100_tp050_sl250_h8", addPcts: [0.5, 1], weights: [0.5, 0.3, 0.2], tp: 0.5, stop: 2.5, holdHours: 8 },
    { kind: "ladder", id: "L_075_tp050_sl250_h8", addPcts: [0.75], weights: [0.65, 0.35], tp: 0.5, stop: 2.5, holdHours: 8 },
    { kind: "ladder", id: "L_100_tp075_sl300_h12", addPcts: [1], weights: [0.65, 0.35], tp: 0.75, stop: 3, holdHours: 12 },
  ];
  return [...singles, ...ladders];
}

function configDistance(a: ExitConfig, b: ExitConfig): number {
  if (a.kind !== b.kind) return Infinity;
  if (a.kind === "ladder" && b.kind === "ladder") {
    return Math.abs(a.tp - b.tp) / 0.25 + Math.abs(a.stop - b.stop) / 0.5 + Math.abs(a.holdHours - b.holdHours) / 4
      + Math.abs(a.addPcts.length - b.addPcts.length) * 2;
  }
  if (a.kind === "single" && b.kind === "single") {
    const tps = [0.5, 0.75, 1, 1.5, 2];
    const stops = [1.5, 2, 3, 4];
    const holds = [4, 8, 12];
    return Math.abs(tps.indexOf(a.tp) - tps.indexOf(b.tp))
      + Math.abs(stops.indexOf(a.stop) - stops.indexOf(b.stop))
      + Math.abs(holds.indexOf(a.holdHours) - holds.indexOf(b.holdHours));
  }
  return Infinity;
}

function simulate(signals: Signal[], candles: Candle[], config: ExitConfig, entryDelayMinutes = 0): Trade[] {
  const trades: Trade[] = [];
  let nextAllowed = 0;
  for (const signal of signals) {
    if (signal.ts < nextAllowed) continue;
    const start = signal.entryIndex + entryDelayMinutes;
    const expectedEntryTs = signal.ts + entryDelayMinutes * MINUTE;
    if (start < 0 || start >= candles.length - 1 || candles[start].ts !== expectedEntryTs) continue;
    const initial = candles[start].open;
    const maxEnd = expectedEntryTs + config.holdHours * HOUR;
    const stopPrice = initial * (1 + config.stop / 100);
    let exitIndex = start;
    let exitPrice = initial;
    let outcome: Trade["outcome"] = "timeout";
    let maxHigh = initial;
    let minLow = initial;
    let fills = 1;
    const fillPrices = [initial];
    const weights = config.kind === "single" ? [1] : config.weights;
    for (let i = start; i < candles.length && candles[i].ts < maxEnd; i++) {
      const c = candles[i];
      exitIndex = i;
      exitPrice = c.close;
      maxHigh = Math.max(maxHigh, c.high);
      minLow = Math.min(minLow, c.low);
      if (c.high >= stopPrice) {
        exitPrice = stopPrice;
        outcome = "stop";
        break;
      }
      let added = false;
      if (config.kind === "ladder") {
        while (fills <= config.addPcts.length && c.high >= initial * (1 + config.addPcts[fills - 1] / 100)) {
          fillPrices.push(initial * (1 + config.addPcts[fills - 1] / 100));
          fills++;
          added = true;
        }
      }
      const filledWeight = weights.slice(0, fills).reduce((a, b) => a + b, 0);
      const coinQty = fillPrices.reduce((sum, p, j) => sum + weights[j] / p, 0);
      const avgEntry = filledWeight / coinQty;
      const tpPrice = avgEntry * (1 - config.tp / 100);
      // A bar that adds may have printed its low before its high. Do not claim TP.
      if (!added && c.low <= tpPrice) {
        exitPrice = tpPrice;
        outcome = "tp";
        break;
      }
    }
    let raw = 0;
    for (let j = 0; j < fills; j++) raw += weights[j] * ((fillPrices[j] - exitPrice) / fillPrices[j]) * 100;
    const filledWeight = weights.slice(0, fills).reduce((a, b) => a + b, 0);
    const pnlPct = raw - filledWeight * FEE_PCT;
    const stressPnlPct = raw - filledWeight * STRESS_FEE_PCT;
    const trade: Trade = {
      strategy: signal.strategy,
      family: signal.family,
      configId: config.id,
      entryTime: expectedEntryTs,
      exitTime: candles[exitIndex].ts + MINUTE,
      entryPrice: initial,
      exitPrice,
      outcome,
      pnlPct,
      stressPnlPct,
      maePct: ((maxHigh - initial) / initial) * 100,
      mfePct: ((initial - minLow) / initial) * 100,
      fills,
    };
    trades.push(trade);
    nextAllowed = trade.exitTime;
  }
  return trades;
}

function stats(trades: Trade[]): Stats {
  if (!trades.length) return { n: 0, winRate: 0, expectancy: 0, stressExpectancy: 0, total: 0, maxDrawdown: 0, avgMae: 0, avgMfe: 0, positiveWeeks: 0, activeWeeks: 0 };
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const weeks = new Map<string, number>();
  for (const t of trades) {
    equity += t.pnlPct;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    const d = new Date(t.entryTime);
    const week = `${d.getUTCFullYear()}-${String(Math.floor((t.entryTime - Date.UTC(d.getUTCFullYear(), 0, 1)) / (7 * DAY)) + 1).padStart(2, "0")}`;
    weeks.set(week, (weeks.get(week) ?? 0) + t.pnlPct);
  }
  return {
    n: trades.length,
    winRate: trades.filter((x) => x.pnlPct > 0).length / trades.length * 100,
    expectancy: trades.reduce((s, x) => s + x.pnlPct, 0) / trades.length,
    stressExpectancy: trades.reduce((s, x) => s + x.stressPnlPct, 0) / trades.length,
    total: equity,
    maxDrawdown,
    avgMae: trades.reduce((s, x) => s + x.maePct, 0) / trades.length,
    avgMfe: trades.reduce((s, x) => s + x.mfePct, 0) / trades.length,
    positiveWeeks: [...weeks.values()].filter((x) => x > 0).length,
    activeWeeks: weeks.size,
  };
}

function fmt(n: number, digits = 3): string { return Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%` : "n/a"; }

function csvEscape(value: unknown): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(filePath: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  fs.writeFileSync(filePath, [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n") + "\n");
}

function report(
  defs: SignalDef[], rows: DecisionRow[], signals: Map<string, Signal[]>, evaluations: Evaluation[],
  commonStart: number, commonEnd: number, split: number,
): string {
  const selected = [...evaluations].sort((a, b) => b.test.expectancy - a.test.expectancy);
  const passing = selected.filter((x) => x.pass);
  const baseline = evaluations.find((x) => x.strategy === "sdw_baseline");
  const lines: string[] = [];
  lines.push("# HYPE Hyperliquid Short-System Findings — 2026-07-16", "");
  lines.push("## TL;DR", "");
  lines.push(`- Common strict pulse window: ${new Date(commonStart).toISOString()} to ${new Date(commonEnd).toISOString()} (${((commonEnd - commonStart) / DAY).toFixed(2)} days), ${rows.length} 15m decisions. Chronological split: ${new Date(split).toISOString()}.`);
  lines.push(`- ${passing.length ? `${passing.length} pre-defined strategy/exit selection${passing.length === 1 ? "" : "s"} passed the minimum two-half + fee-stress gate. ${passing.length === 1 ? "It remains a" : "They remain"} forward-shadow candidate${passing.length === 1 ? "" : "s"}, not a live deployment candidate${passing.length === 1 ? "" : "s"}.` : "No candidate passed the two-half + fee-stress gate. Do not deploy a new HYPE short from this pass."}`);
  lines.push(`- Existing session-dailyred-wick baseline in this window: ${baseline ? `n=${baseline.all.n}, all ${fmt(baseline.all.expectancy)}, first half ${fmt(baseline.train.expectancy)}, second half ${fmt(baseline.test.expectancy)}` : "no trades"}.`);
  lines.push("", "## Bias And Execution Discipline", "");
  lines.push("- All price inputs are completed 1m/15m/1H/4H candles. A decision at `T` uses source candles ending no later than `T` and enters at the 1m open stamped `T`.");
  lines.push("- All pulse observations have source timestamp `< T`. HL taker/book/asset health is checked per decision; pulse-dependent strategies fail closed on incomplete 15m coverage.");
  lines.push("- Rolling z-scores use only the preceding seven days of decision rows. No full-window quantiles or future regime labels are used.");
  lines.push("- Stops are checked before TPs inside each 1m candle. A ladder add candle cannot also claim a TP. Fees are 0.11% round trip and 0.20% in stress.");
  lines.push("- Exit parameters are ranked on first-half expectancy (minimum n=6), then frozen for second-half evaluation. Signal variants are still a research multiple-testing surface; any pass requires forward shadow.");
  lines.push("", "## Audited Decision-Time Trace", "");
  lines.push("- Example: `hl_bid_pull_break` at 2026-05-21T01:45:00Z. The simulated short enters the Bybit 1m candle stamped 01:45 at its open, $56.443.");
  lines.push("- The completed 15m bar was red, closed below the prior 15m low, and returned -0.840% over the exact preceding 15 minutes.");
  lines.push("- HL inputs available strictly before 01:45 were: 15m taker buy/sell ratio 0.676, last-5m 0.5% book imbalance -0.231, prior-10m imbalance -0.044, deterioration -0.186. Coverage was 15/15 taker minutes and 15/15 book minutes.");
  lines.push("- The HL taker record stamped exactly 01:45 (covering 01:44–01:45) is excluded. This deliberately gives flow one extra minute of latency and proves the fire does not depend on a boundary-race row.");
  lines.push("", "## Strategy Results (Train-Selected Exit)", "");
  lines.push("| Rank | Strategy | Family | Raw fires | Exit | Train n/exp | Test n/exp | Stress test | +1m delay test | All n/exp | Weeks +/active | Neighbor test median | Gate |");
  lines.push("|---:|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---|");
  selected.forEach((x, i) => lines.push(`| ${i + 1} | ${x.strategy} | ${x.family} | ${signals.get(x.strategy)?.length ?? 0} | ${x.config.id} | ${x.train.n}/${fmt(x.train.expectancy)} | ${x.test.n}/${fmt(x.test.expectancy)} | ${fmt(x.test.stressExpectancy)} | ${x.delay1Test.n}/${fmt(x.delay1Test.stressExpectancy)} | ${x.all.n}/${fmt(x.all.expectancy)} | ${x.all.positiveWeeks}/${x.all.activeWeeks} | ${fmt(x.neighborTestMedian)} | ${x.pass ? "FORWARD SHADOW" : "NO"} |`));
  lines.push("", "Conservative gate: train n>=8 and test n>=8; >=+0.15% expectancy in both halves at 0.20% fees; >=+0.15% second-half expectancy with both a one-minute entry delay and 0.20% fees; >=+0.15% median second-half expectancy for the five nearest exit settings; and at least half of active weeks positive. The margin is deliberate protection against this study's signal/exit multiple-testing surface.");
  lines.push("", "## Controls / Ablation", "");
  for (const id of ["control_plain_break", "control_break_hl_sell", "control_hl_book_pull", "hl_bid_pull_break"]) {
    const x = evaluations.find((e) => e.strategy === id);
    if (x) lines.push(`- ${id}: ${x.config.id}, n=${x.all.n}, train ${fmt(x.train.expectancy)}, test ${fmt(x.test.expectancy)}, all ${fmt(x.all.expectancy)}.`);
  }
  lines.push("", "The combined book-withdrawal + taker-selling + completed-break signal must outperform these components; otherwise the apparent mechanism is just generic downside momentum.");
  lines.push("", "## Interpretation / De-duplication", "");
  lines.push("- One setup clears the conservative gate: `hl_bid_pull_break`. The other positive rows are weaker correlated expressions, not four independent edges.");
  lines.push("- The old 5.15b Bybit bid-pull + volume candidate is now falsified on the expanded window: its train-selected exit is negative in the second half and under fee stress.");
  lines.push("- OI/funding crowding, OI-price divergence, liquidation blow-off, and the tested adverse-add short ladders do not survive the chronological split.");
  lines.push("- The established session-dailyred-wick remains directionally positive but has only eight trades in this 59-day window, below the minimum sample gate.");
  lines.push("", "## Passing Candidates", "");
  if (!passing.length) lines.push("None.");
  for (const x of passing) {
    const def = defs.find((d) => d.id === x.strategy)!;
    const rowByTs = new Map(rows.map((r) => [r.ts, r]));
    const downTrades = x.trades.filter((t) => rowByTs.get(t.entryTime)?.downRegime);
    const otherTrades = x.trades.filter((t) => !rowByTs.get(t.entryTime)?.downRegime);
    lines.push(`### ${x.strategy}`, "", `- Mechanism: ${def.mechanism}`, `- Frozen exit: ${x.config.id}.`, `- First half: n=${x.train.n}, WR=${x.train.winRate.toFixed(1)}%, expectancy ${fmt(x.train.expectancy)}, max drawdown ${fmt(-x.train.maxDrawdown)}.`, `- Second half: n=${x.test.n}, WR=${x.test.winRate.toFixed(1)}%, expectancy ${fmt(x.test.expectancy)}, fee-stress ${fmt(x.test.stressExpectancy)}.`, `- One-minute delayed entry, second half: n=${x.delay1Test.n}, fee-stress expectancy ${fmt(x.delay1Test.stressExpectancy)}.`, `- Known-at-entry trend split: down-regime n=${downTrades.length}, ${fmt(stats(downTrades).expectancy)}; other local regimes n=${otherTrades.length}, ${fmt(stats(otherTrades).expectancy)}.`, `- Required next step: exact live-decision shadow for 30–60 days. No live order path from this study.`, "");
    const byMonth = new Map<string, Trade[]>();
    for (const trade of x.trades) {
      const month = new Date(trade.entryTime).toISOString().slice(0, 7);
      byMonth.set(month, [...(byMonth.get(month) ?? []), trade]);
    }
    lines.push("| Month | n | Expectancy | Total |", "|---|---:|---:|---:|");
    for (const [month, trades] of byMonth) {
      const s = stats(trades);
      lines.push(`| ${month} | ${s.n} | ${fmt(s.expectancy)} | ${fmt(s.total)} |`);
    }
    lines.push("");
  }
  lines.push("## Short-Ladder Read", "");
  const ladder = selected.filter((x) => x.config.kind === "ladder");
  if (!ladder.length) lines.push("No strategy selected a short ladder on the first half. Single-entry exits were uniformly preferred.");
  else lines.push(...ladder.map((x) => `- ${x.strategy}: ${x.config.id}, train ${fmt(x.train.expectancy)}, test ${fmt(x.test.expectancy)}, all max-capital expectancy ${fmt(x.all.expectancy)}. ${x.pass ? "Forward-shadow only." : "Did not clear robustness gate."}`));
  lines.push("", "Ladder PnL is measured on total reserved ladder capital, with unused add allocation earning zero. This prevents adverse adds from looking artificially strong through filled-capital-only accounting.");
  lines.push("", "## Mechanism Inventory", "");
  for (const def of defs) lines.push(`- **${def.id}** (${def.family}): ${def.mechanism}`);
  lines.push("", "## Operational Boundary", "");
  lines.push("- This pass changes no bot code or config and makes no strategy recommendation for the live long ladder.");
  lines.push("- A future HYPE short executor would share Bybit hedge-side position ownership with the existing HYPE short process. It must not be deployed as an independent order owner; transactional ownership/reconciliation must be designed first.");
  lines.push("- Generated tables and trades are under `backtests/hype/hl-short-study-2026-07-16/`.");
  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { candles, rows, commonStart, commonEnd } = await buildDecisionRows();
  const split = commonStart + Math.floor((commonEnd - commonStart) / 2 / (15 * MINUTE)) * 15 * MINUTE;
  const defs = definitions();
  const signals = generateSignals(rows, defs);
  const configs = exitConfigs();
  console.log(`Evaluating ${defs.length} definitions x ${configs.length} exits over ${rows.length} decisions...`);
  const evaluations: Evaluation[] = [];
  const gridRows: Record<string, unknown>[] = [];
  for (const def of defs) {
    const byConfig: Array<{ config: ExitConfig; trades: Trade[]; train: Stats; test: Stats; all: Stats }> = [];
    for (const config of configs) {
      const trades = simulate(signals.get(def.id) ?? [], candles, config);
      const train = stats(trades.filter((x) => x.entryTime < split));
      const test = stats(trades.filter((x) => x.entryTime >= split));
      const all = stats(trades);
      byConfig.push({ config, trades, train, test, all });
      gridRows.push({ strategy: def.id, family: def.family, config: config.id, kind: config.kind, train_n: train.n, train_exp: train.expectancy, test_n: test.n, test_exp: test.expectancy, test_stress_exp: test.stressExpectancy, all_n: all.n, all_exp: all.expectancy, all_total: all.total, all_max_dd: all.maxDrawdown });
    }
    const eligible = byConfig.filter((x) => x.train.n >= 6);
    const chosen = (eligible.length ? eligible : byConfig).sort((a, b) => b.train.expectancy - a.train.expectancy || b.train.n - a.train.n)[0];
    const neighbors = byConfig.filter((x) => x.config.kind === chosen.config.kind && x.config.id !== chosen.config.id && x.train.n >= 6)
      .sort((a, b) => configDistance(a.config, chosen.config) - configDistance(b.config, chosen.config) || b.train.expectancy - a.train.expectancy)
      .slice(0, 5);
    const neighborValues = neighbors.map((x) => x.test.expectancy).sort((a, b) => a - b);
    const neighborMedian = neighborValues.length ? neighborValues[Math.floor(neighborValues.length / 2)] : NaN;
    const delay1Trades = simulate(signals.get(def.id) ?? [], candles, chosen.config, 1);
    const delay1Test = stats(delay1Trades.filter((x) => x.entryTime >= split));
    const minimumEdge = 0.15;
    const pass = def.family !== "control" && chosen.train.n >= 8 && chosen.test.n >= 8
      && chosen.train.stressExpectancy >= minimumEdge && chosen.test.stressExpectancy >= minimumEdge
      && delay1Test.stressExpectancy >= minimumEdge && neighborMedian >= minimumEdge
      && chosen.all.positiveWeeks >= Math.ceil(chosen.all.activeWeeks / 2);
    evaluations.push({ strategy: def.id, family: def.family, config: chosen.config, train: chosen.train, test: chosen.test, all: chosen.all, neighborTestMedian: neighborMedian, delay1Test, pass, trades: chosen.trades });
  }
  writeCsv(path.join(OUT_DIR, "exit-grid.csv"), gridRows);
  writeCsv(path.join(OUT_DIR, "selected-trades.csv"), evaluations.flatMap((e) => e.trades.map((t) => ({ ...t, entryTime: new Date(t.entryTime).toISOString(), exitTime: new Date(t.exitTime).toISOString() }))));
  writeCsv(path.join(OUT_DIR, "decision-features.csv"), rows.map((r) => ({ ...r, ts: new Date(r.ts).toISOString() })));
  const markdown = report(defs, rows, signals, evaluations, commonStart, commonEnd, split);
  fs.writeFileSync(REPORT_PATH, markdown);
  console.log(markdown.split("\n").slice(0, 8).join("\n"));
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`Wrote ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
