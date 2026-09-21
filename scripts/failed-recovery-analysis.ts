/** Diagnostic only: labels and features are kept separate; no order/policy imports. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
export type Row = Record<string, any>;
export const M = 60000, H = 60 * M;
export const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + Number(r[key]), 0);
export function candleAt(cs: Candle[], at: number) {
  const i = (at - cs[0].endTs) / M; assert(Number.isInteger(i) && i >= 0 && i < cs.length);
  assert.equal(cs[i].endTs, at); return cs[i];
}
function ema(values: number[], period: number) {
  assert(values.length >= period); let v = values.slice(0, period).reduce((s, x) => s + x, 0) / period;
  const out = [v]; for (const x of values.slice(period)) { v += (x - v) * 2 / (period + 1); out.push(v); } return out;
}
export function priceFeatures(cs: Candle[], at: number): Row {
  const c = candleAt(cs, at), i = (at - cs[0].endTs) / M, rows = cs.slice(i - 59, i + 1);
  assert.equal(rows.length, 60); const volume = sum(rows, "volume"), vwap = volume > 0 ? sum(rows, "turnover") / volume : null;
  const end4h = Math.floor(at / (4 * H)) * 4 * H;
  const closes: number[] = [];
  for (let n = 248; n >= 0; n--) closes.push(candleAt(cs, end4h - n * 4 * H).close);
  const e200 = ema(closes, 200).at(-1)!, e50 = ema(closes, 50), last = closes.at(-1)!;
  return { at, sourceEnd: c.endTs, price: c.close, vwap60: vwap, vwapDistancePct: vwap ? (c.close / vwap - 1) * 100 : null,
    roc15: (c.close / candleAt(cs, at - 15 * M).close - 1) * 100,
    roc60: (c.close / candleAt(cs, at - H).close - 1) * 100,
    roc240: (c.close / candleAt(cs, at - 4 * H).close - 1) * 100,
    roc720: (c.close / candleAt(cs, at - 12 * H).close - 1) * 100,
    trend: { sourceEnd: end4h, close: last, ema200: e200, ema50: e50.at(-1), ema50Prev: e50.at(-2),
      distancePct: (last / e200 - 1) * 100, blocked: last < e200 && e50.at(-1)! < e50.at(-2)! } };
}
export function supportResponse(cs: Candle[], at: number, priorSr: Row, currentSr: Row): Row {
  const end = Math.floor(at / (5 * M)) * 5 * M, level = priorSr.nearestSupport?.zone ?? null;
  const bars = [end - 5 * M, end].map(t => {
    const i = (t - cs[0].endTs) / M, rows = cs.slice(i - 4, i + 1); assert.equal(rows.length, 5);
    assert(rows.every((c, k) => c.ts === t - 5 * M + k * M));
    return { start: t - 5 * M, end: t, close: rows[4].close, high: Math.max(...rows.map(c => c.high)) };
  });
  const healthy = priorSr.coverage.healthy && currentSr.coverage.healthy && level !== null;
  if (level) assert(level.lastTouchKnownAt <= at - 15 * M);
  const boundary = level ? level.price * .999 : null;
  const broken = healthy ? bars.every(b => b.close < boundary!) : null;
  return { knownAt: at - 15 * M, frozenLevel: level, bars, healthy, broken,
    failedRetest: healthy ? broken && bars.some(b => b.high >= boundary!) : null };
}
const and = (...xs: Array<boolean | null>): boolean | null => xs.some(x => x === null) ? null : xs.every(Boolean);
export function descriptors(price: Row, previousPrice: Row, pulse: Row, previousPulse: Row, sr: Row, cs: Candle[]): Record<string, boolean | null> {
  const weak = (p: Row): boolean | null => p.vwap60 === null ? null : p.price < p.vwap60 && p.roc60 <= 0;
  const sell15 = (p: Row) => p.flow15.healthy ? p.flow15.ratio <= .85 : null;
  const both = (p: Row) => and(sell15(p), p.flow60.healthy ? p.flow60.ratio <= .9 : null);
  const asset = pulse.asset.changes[0];
  const noReclaim = previousPrice.vwap60 === null ? null : Array.from({ length: 15 }, (_, i) => candleAt(cs, price.at - i * M).close).every(p => p <= previousPrice.vwap60);
  return { D1: price.trend.blocked, D2: weak(price), D3: and(weak(price), weak(previousPrice), noReclaim),
    D4: sell15(pulse), D5: both(pulse), D6: and(both(pulse), both(previousPulse)),
    D7: and(both(pulse), asset.healthy ? asset.nativeOiChangePct < 0 : null),
    D8: and(both(pulse), asset.healthy ? asset.markedOiChangePct < 0 : null), D9: sr.broken, D10: sr.failedRetest };
}
export function inventoryAt(events: Row[], index: number) {
  let lo = 0, hi = events.length;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (events[m].event.fillIndex <= index) lo = m + 1; else hi = m; }
  return lo ? events[lo - 1] : null;
}
export function summarize(xs: Row[]) {
  const done = xs.filter(x => x.outcome !== null), wins = done.filter(x => x.outcome.pnl > 0), losses = done.filter(x => x.outcome.pnl < 0);
  const down = done.filter(x => x.remainingValueChange < 0), up = done.filter(x => x.remainingValueChange > 0);
  const downside = -sum(down, "remainingValueChange"), recovery = sum(up, "remainingValueChange");
  return { observations: xs.length, completed: done.length, censored: xs.length - done.length,
    wins: wins.length, losses: losses.length, winningDollars: wins.reduce((s, x) => s + x.outcome.pnl, 0), losingDollars: -losses.reduce((s, x) => s + x.outcome.pnl, 0),
    completedNet: done.reduce((s, x) => s + x.outcome.pnl, 0), marksAtObservation: sum(done, "netEpisodeMark"),
    furtherDeclines: down.length, furtherRecoveries: up.length, declineFraction: done.length ? down.length / done.length : null,
    subsequentDownside: downside, subsequentRecovery: recovery, diagnosticBalance: downside - recovery,
    largestDeclineShare: downside ? Math.max(...down.map(x => -x.remainingValueChange)) / downside : null };
}
export function classify(rows: Row[], id: string, delay: number) {
  const value = (x: Row) => x.warnings[String(delay)][id];
  return { baseline: summarize(rows), flagged: summarize(rows.filter(x => value(x) === true)),
    unflagged: summarize(rows.filter(x => value(x) === false)), unknown: summarize(rows.filter(x => value(x) === null)) };
}
