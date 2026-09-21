/** Local descriptive study. Decision features and future outcome labels are separate. */
import { EMA } from "technicalindicators";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { SRMemoryZoneConfig, SRMemoryZoneLevel } from "../src/bot/sr-memory-zones";
import { ReplaySrContext } from "./replay-sr-context";
import type { ReplayMarketInputs } from "./replay-market-inputs";

export const M = 60_000, DAY = 1440 * M;
export type Side = "support" | "resistance";
export type Pressure = "with" | "against" | "neutral" | "unknown";
export type Response = "hold" | "break" | "unresolved";
export interface StudySpec {
  version: number; id: string; symbol: string; start: string; end: string; split: string;
  repairFile: string; baselineDir: string; approachBandPct: number; responseMinutes: number;
  responseBoundaryPct: number; responseConsecutiveCloses: number; primaryHorizonMinutes: number;
  secondaryHorizonMinutes: number; encounterSeparationMinutes: number; controlCadenceMinutes: number;
  controlClearancePct: number; controlLookbackDays: number; controlRet15mTolerancePct: number;
  controlVolRatioMax: number; takerBuyMin: number; takerSellMax: number;
  minTaker15mSamples: number; maxTakerAgeSec: number; maxBookAgeSec: number;
  bookPersistenceThreshold: number; configuredRoundTripCostPct: number; stressRoundTripCostPct: number;
  bootstrapRepeats: number; bootstrapBlockDays: number; minimumCandidateN: number; minimumHalfN: number;
  minimumMatchedN: number; minimumMatchedHalfN: number; minimumMonthN: number;
  minimumPopulatedMonths: number; worstMonthlyDeltaFloorPct: number;
}
export interface Frame {
  at: number; bar: Candle; zones: SRMemoryZoneLevel[]; srHealthy: boolean;
  ret15m: number; ret1h: number; rv1hPct: number; tr14Pct: number; regime: string; ema200DistPct: number;
  taker15: number | null; taker1h: number | null; buy15: number | null; sell15: number | null;
  net15: number | null; samples15: number; takerAgeSec: number | null; flowHealthy: boolean;
  relativeVolume15: number | null;
  bookImbalance: number | null; bookBid: number | null; bookAsk: number | null; bookAgeSec: number | null;
  bookHealthy: boolean; nativeOi1hPct: number | null; markedOi1hPct: number | null;
  assetAgeSec: number | null; assetAnchorLagSec: number | null; binance1h: number | null;
}
export interface Label {
  entryAt: number; endAt: number; entry: number; exit: number; retPct: number; delayedRetPct: number;
  highPct: number; lowPct: number;
}
/** Do not draw a higher-timeframe bar's future close on the decision's left. */
export function chartWindow(candles: Candle[], at: number): Candle[] {
  return candles.filter(c => c.ts >= at - 6 * 3600000 && c.endTs <= at + 4 * 3600000 &&
    (c.endTs <= at || c.ts >= at));
}
export interface Encounter {
  id: string; side: Side; at: number; decisionAt: number; levelKnownAt: number;
  level: SRMemoryZoneLevel; approach: Frame; decision: Frame | null; response: Response | null;
  pressure: Pressure; primaryHealthy: boolean; bookPersistence: string;
  nextUp: number | null; nextDown: number | null;
  future1h: Label | null; future4h: Label | null; futureHitNextUp: boolean | null; futureHitNextDown: boolean | null;
  controlAt: number | null; controlDistance: number | null;
}

export function aggregateComplete(candles: Candle[], minutes: number): Candle[] {
  const span = minutes * M, out: Candle[] = [];
  for (let i = 0; i < candles.length;) {
    const start = Math.floor(candles[i].ts / span) * span, block: Candle[] = [];
    while (i < candles.length && candles[i].ts < start + span) block.push(candles[i++]);
    if (block.length !== minutes || block.some((c, k) => c.ts !== start + k * M || c.endTs !== c.ts + M)) continue;
    out.push({ ts: start, endTs: start + span, open: block[0].open, close: block.at(-1)!.close,
      high: Math.max(...block.map(c => c.high)), low: Math.min(...block.map(c => c.low)),
      volume: block.reduce((a, c) => a + c.volume, 0), turnover: block.reduce((a, c) => a + c.turnover, 0) });
  }
  return out;
}

/** Completed-4h research strata use the canonical rolling 249-bar EMA basis. */
export function buildFrames(candles: Candle[], cfg: SRMemoryZoneConfig, tape: Pick<ReplayMarketInputs, "snapshot">, spec: StudySpec): Frame[] {
  const five = aggregateComplete(candles, 5), four = aggregateComplete(candles, 240);
  const sr = new ReplaySrContext(candles, cfg), frames: Frame[] = [];
  let j = -1, regime = "unknown", ema200DistPct = NaN;
  const from = Date.parse(spec.start) - 60 * M, until = Date.parse(spec.end);
  for (let i = 288; i < five.length; i++) {
    const c = five[i], at = c.endTs;
    if (at < from || at > until) continue;
    let changed = false;
    while (j + 1 < four.length && four[j + 1].endTs <= at) { j++; changed = true; }
    if (changed && j >= 200) {
      const closes = four.slice(Math.max(0, j - 248), j + 1).map(b => b.close);
      const e200 = EMA.calculate({ period: 200, values: closes }).at(-1)!, e50 = EMA.calculate({ period: 50, values: closes });
      ema200DistPct = (four[j].close / e200 - 1) * 100;
      regime = `${four[j].close >= e200 ? "above" : "below"}_${e50.at(-1)! >= e50.at(-2)! ? "rising" : "falling"}`;
    }
    const returns = five.slice(i - 11, i + 1).map((b, k) => Math.log(b.close / five[i - 12 + k].close) * 100);
    const avg = mean(returns)!, rv1hPct = Math.sqrt(returns.reduce((s, x) => s + (x - avg) ** 2, 0));
    const tr14Pct = mean(five.slice(i - 13, i + 1).map((b, k) => Math.max(b.high - b.low, Math.abs(b.high - five[i - 14 + k].close), Math.abs(b.low - five[i - 14 + k].close)) / c.close * 100))!;
    const ctx = sr.at(at), snap = tape.snapshot(at), p = snap.pulse;
    const flowHealthy = p.hlTaker15m !== null && (p.hlTaker15mSamples ?? 0) >= spec.minTaker15mSamples &&
      p.hlTakerAgeSec !== null && p.hlTakerAgeSec !== undefined && p.hlTakerAgeSec >= 0 && p.hlTakerAgeSec <= spec.maxTakerAgeSec;
    const bookHealthy = p.hlObImbalance05 !== null && p.hlObAgeSec !== null && p.hlObAgeSec >= 0 && p.hlObAgeSec <= spec.maxBookAgeSec;
    const earlier = [15, 30, 45].map(k => frames[frames.length - k / 5]);
    const priorVolume = earlier.every((f, k) => f && f.at === at - (k + 1) * 15 * M && f.flowHealthy && f.buy15 !== null && f.sell15 !== null)
      ? mean(earlier.map(f => f.buy15! + f.sell15!)) : null;
    const relativeVolume15 = flowHealthy && priorVolume !== null && priorVolume > 0 && p.hlTaker15mBuyNotional != null && p.hlTaker15mSellNotional != null
      ? (p.hlTaker15mBuyNotional + p.hlTaker15mSellNotional) / priorVolume : null;
    frames.push({ at, bar: c, zones: ctx.engine.getZones(at), srHealthy: ctx.coverage.healthy,
      ret15m: (c.close / five[i - 3].close - 1) * 100, ret1h: (c.close / five[i - 12].close - 1) * 100,
      rv1hPct, tr14Pct, regime, ema200DistPct, taker15: p.hlTaker15m ?? null, taker1h: p.hlTaker1h ?? null,
      buy15: p.hlTaker15mBuyNotional ?? null, sell15: p.hlTaker15mSellNotional ?? null, net15: p.hlTaker15mNetNotional ?? null,
      samples15: p.hlTaker15mSamples ?? 0, takerAgeSec: p.hlTakerAgeSec ?? null, flowHealthy, relativeVolume15,
      bookImbalance: p.hlObImbalance05, bookBid: p.hlObBid05Usd, bookAsk: p.hlObAsk05Usd, bookAgeSec: p.hlObAgeSec, bookHealthy,
      nativeOi1hPct: snap.research.nativeOi1hPct, markedOi1hPct: snap.research.markedOi1hPct,
      assetAgeSec: p.hlAssetAgeSec ?? null, assetAnchorLagSec: p.hlAsset1hAnchorLagSec ?? null, binance1h: p.taker1h });
  }
  return frames;
}

export function pressure(side: Side, f: Frame, spec: StudySpec): Pressure {
  if (!f.flowHealthy || f.taker15 === null) return "unknown";
  const buy = f.taker15 >= spec.takerBuyMin, sell = f.taker15 <= spec.takerSellMax;
  if (!buy && !sell) return "neutral";
  return (side === "resistance" ? buy : sell) ? "with" : "against";
}
export function classifyResponse(side: Side, level: number, frames: Frame[], spec: StudySpec): Response {
  const sign = side === "resistance" ? 1 : -1;
  const closes = frames.slice(-spec.responseConsecutiveCloses).map(f => sign * (f.bar.close / level - 1) * 100);
  if (closes.length !== spec.responseConsecutiveCloses) return "unresolved";
  // Roundoff allowance in percentage points, not an economic price buffer.
  const epsilon = 64 * Number.EPSILON * 100;
  if (closes.every(x => x >= spec.responseBoundaryPct - epsilon)) return "break";
  if (closes.every(x => x <= -spec.responseBoundaryPct + epsilon)) return "hold";
  return "unresolved";
}
export function discoverEncounters(frames: Frame[], spec: StudySpec) {
  const byAt = new Map(frames.map(f => [f.at, f])), rows: Encounter[] = [];
  const audit = { rawApproaches: 0, suppressed: 0, unhealthySr: 0, responseCensored: 0 };
  let nextAt = -Infinity;
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i], prev = frames[i - 1];
    if (f.at < Date.parse(spec.start) || f.at - prev.at !== 5 * M) continue;
    if (!prev.srHealthy || !f.srHealthy) { audit.unhealthySr++; continue; }
    const candidates: Array<{ side: Side; level: SRMemoryZoneLevel; dist: number }> = [];
    for (const level of prev.zones) {
      const dist = (level.price / prev.bar.close - 1) * 100;
      if (prev.bar.close < level.price * (1 - spec.approachBandPct / 100) && f.bar.high >= level.price * (1 - spec.approachBandPct / 100)) candidates.push({ side: "resistance", level, dist });
      if (prev.bar.close > level.price * (1 + spec.approachBandPct / 100) && f.bar.low <= level.price * (1 + spec.approachBandPct / 100)) candidates.push({ side: "support", level, dist: -dist });
    }
    if (!candidates.length) continue;
    audit.rawApproaches += candidates.length;
    if (f.at < nextAt) { audit.suppressed += candidates.length; continue; }
    candidates.sort((a, b) => a.dist - b.dist || a.level.price - b.level.price);
    const { side, level } = candidates[0]; audit.suppressed += candidates.length - 1;
    nextAt = f.at + spec.encounterSeparationMinutes * M;
    const decisionAt = f.at + spec.responseMinutes * M;
    const responseFrames = Array.from({ length: spec.responseMinutes / 5 }, (_, k) => byAt.get(f.at + (k + 1) * 5 * M));
    const d = responseFrames.every(x => x?.srHealthy) ? responseFrames.at(-1)! ?? null : null;
    if (!d) audit.responseCensored++;
    const books = responseFrames.slice(-3);
    const persistent = books.length === 3 && books.every(x => x?.bookHealthy);
    const bookPersistence = !persistent ? "unknown" : books.every(x => x!.bookImbalance! >= spec.bookPersistenceThreshold) ? "bid" :
      books.every(x => x!.bookImbalance! <= -spec.bookPersistenceThreshold) ? "ask" : "mixed";
    rows.push({ id: `${side}-${f.at}`, side, at: f.at, decisionAt, levelKnownAt: prev.at, level: structuredClone(level), approach: f, decision: d,
      response: d ? classifyResponse(side, level.price, responseFrames as Frame[], spec) : null,
      pressure: d ? pressure(side, d, spec) : "unknown", primaryHealthy: !!d && f.flowHealthy && d.flowHealthy,
      bookPersistence, nextUp: d?.zones.filter(z => z.price > d.bar.close).sort((a, b) => a.price - b.price)[0]?.price ?? null,
      nextDown: d?.zones.filter(z => z.price < d.bar.close).sort((a, b) => b.price - a.price)[0]?.price ?? null,
      future1h: null, future4h: null, futureHitNextUp: null, futureHitNextDown: null, controlAt: null, controlDistance: null });
  }
  return { rows, audit };
}

export function outcome(candles: Candle[], index: Map<number, number>, at: number, horizon: number): Label | null {
  const i = index.get(at); if (i === undefined || horizon < 2) return null;
  const bars = candles.slice(i, i + horizon);
  if (bars.length !== horizon || bars.some((b, k) => b.ts !== at + k * M || b.endTs !== at + (k + 1) * M)) return null;
  const entry = bars[0].open, exit = bars.at(-1)!.close;
  return { entryAt: at, endAt: at + horizon * M, entry, exit, retPct: (exit / entry - 1) * 100,
    delayedRetPct: (exit / bars[1].open - 1) * 100,
    highPct: (Math.max(...bars.map(b => b.high)) / entry - 1) * 100, lowPct: (Math.min(...bars.map(b => b.low)) / entry - 1) * 100 };
}
export function attachOutcomes(rows: Encounter[], candles: Candle[], spec: StudySpec) {
  const index = new Map(candles.map((c, i) => [c.ts, i]));
  for (const e of rows) {
    if (!e.decision) continue;
    e.future1h = outcome(candles, index, e.decisionAt, spec.secondaryHorizonMinutes);
    e.future4h = outcome(candles, index, e.decisionAt, spec.primaryHorizonMinutes);
    if (e.future4h) {
      e.futureHitNextUp = e.nextUp === null ? null : e.future4h.entry * (1 + e.future4h.highPct / 100) >= e.nextUp;
      e.futureHitNextDown = e.nextDown === null ? null : e.future4h.entry * (1 + e.future4h.lowPct / 100) <= e.nextDown;
    }
  }
}
export interface Control { frame: Frame; future4h: Label | null }
export function selectControls(frames: Frame[], spec: StudySpec): Control[] {
  const byAt = new Map(frames.map(f => [f.at, f]));
  return frames.filter(f => f.at >= Date.parse(spec.start) && f.at % (spec.controlCadenceMinutes * M) === 0 &&
    [0, 5, 10, 15].every(k => {
      const p = byAt.get(f.at - k * M);
      return p && p.srHealthy && p.zones.length > 0 && p.zones.every(z => Math.abs(z.price / p.bar.close - 1) * 100 > spec.controlClearancePct);
    }) && f.flowHealthy && byAt.get(f.at - spec.responseMinutes * M)?.flowHealthy).map(frame => ({ frame, future4h: null }));
}
/** Matches use pre-outcome covariates only; labels may be attached afterward. */
export function matchControls(events: Encounter[], controls: Control[], spec: StudySpec) {
  const used = new Set<number>();
  for (const e of events) {
    if (!e.primaryHealthy || !e.decision) continue;
    const f = e.decision;
    const options = controls.filter(c => !used.has(c.frame.at) && c.frame.at + (spec.primaryHorizonMinutes + 1) * M <= e.at &&
      c.frame.at >= e.decisionAt - spec.controlLookbackDays * DAY && c.frame.regime === f.regime && pressure(e.side, c.frame, spec) === e.pressure &&
      Math.abs(c.frame.ret15m - f.ret15m) <= spec.controlRet15mTolerancePct && c.frame.rv1hPct > 0 && f.rv1hPct > 0 &&
      Math.max(c.frame.rv1hPct / f.rv1hPct, f.rv1hPct / c.frame.rv1hPct) <= spec.controlVolRatioMax)
      .map(c => ({ c, distance: Math.abs(c.frame.ret15m - f.ret15m) / spec.controlRet15mTolerancePct + Math.abs(Math.log(c.frame.rv1hPct / f.rv1hPct)) + .1 * (e.decisionAt - c.frame.at) / (spec.controlLookbackDays * DAY) }))
      .sort((a, b) => a.distance - b.distance || a.c.frame.at - b.c.frame.at);
    if (options[0]) { e.controlAt = options[0].c.frame.at; e.controlDistance = options[0].distance; used.add(e.controlAt); }
  }
}
export function mean(xs: number[]): number | null { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
export function direction(side: Side, response: "hold" | "break"): number { return (side === "support" ? 1 : -1) * (response === "hold" ? 1 : -1); }
export function month(at: number): string { return new Date(at).toISOString().slice(0, 7); }

/** Fixed calendar-week cluster resampling; not IID minute-row error bars. */
export function blockInterval(a: Array<{ at: number; value: number }>, b: Array<{ at: number; value: number }>, spec: StudySpec) {
  const span = spec.bootstrapBlockDays * DAY, groups = new Map<number, { a: number[]; b: number[] }>();
  for (const [name, rows] of [["a", a], ["b", b]] as const) for (const r of rows) {
    const key = Math.floor(r.at / span); if (!groups.has(key)) groups.set(key, { a: [], b: [] }); groups.get(key)![name].push(r.value);
  }
  const blocks = [...groups.values()], samples: number[] = []; let seed = 9052026;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  if (!a.length || !b.length || blocks.length < 4) return { low: null, high: null, blocks: blocks.length };
  for (let i = 0; i < spec.bootstrapRepeats; i++) {
    const x: number[] = [], y: number[] = [];
    for (let k = 0; k < blocks.length; k++) { const g = blocks[Math.floor(random() * blocks.length)]; x.push(...g.a); y.push(...g.b); }
    if (x.length && y.length) samples.push(mean(x)! - mean(y)!);
  }
  samples.sort((x, y) => x - y);
  return { low: samples.length ? samples[Math.floor(samples.length * .05)] : null, high: samples.length ? samples[Math.floor(samples.length * .95)] : null, blocks: blocks.length };
}
