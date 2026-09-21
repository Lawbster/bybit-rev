import assert from 'assert/strict';
import { aggregate, indicatorTape, pivots, dailySignals, failureTriggers, replay, compare, M, H, D, type Action } from './poc-indicator-bias-engine';
import { runSchedule } from './poc-bounce-engine';
import type { Candle } from './hype-freerun-canonical-replay';
const T = Date.UTC(2026, 0, 1);
const make = (n: number): Candle[] => Array.from({ length: n }, (_, i) => {
  const open = 100 + 5 * Math.sin(i / 450), close = 100 + 5 * Math.sin((i + 1) / 450);
  return { ts: T + i * M, endTs: T + (i + 1) * M, open, close, high: Math.max(open, close) + .1,
    low: Math.min(open, close) - .1, volume: 1, turnover: (open + close) / 2 };
});
const cs = make(22 * 1440), tape = indicatorTape(cs), at = T + 20 * D + 7 * H;
const poisoned = cs.map(c => c.ts >= at ? { ...c, open: c.open * 3, high: c.high * 3, low: c.low * 3, close: c.close * 3, turnover: c.turnover * 3 } : c);
assert.deepEqual(indicatorTape(poisoned).at(at), tape.at(at), 'future bars cannot change an entry snapshot');
assert.deepEqual(indicatorTape(cs.filter(c => c.endTs <= at)).at(at), tape.at(at), 'prefix invariance');
for (const s of tape.at(at).sources) assert(s.barEnd + M <= at && s.barEnd < at);
assert.equal(tape.at(at).sources.find(s => s.timeframeMinutes === 60)!.barEnd, at - H);
const bars4 = aggregate(cs, 4 * H), daily = aggregate(cs, D), ps = pivots(bars4, 2);
assert(ps.length > 0);
for (const p of ps) assert.equal(p.availableAt, p.pivotAt + 3 * 4 * H + M);
const cutoff = T + 19 * D;
assert.deepEqual(pivots(aggregate(cs.filter(c => c.endTs <= cutoff), 4 * H), 2), ps.filter(p => p.availableAt <= cutoff + M));
assert.deepEqual(dailySignals(poisoned, aggregate(poisoned, 4 * H), aggregate(poisoned, D), 2, 0, 'previous_day').decisions.filter(d => d.at <= at),
  dailySignals(cs, bars4, daily, 2, 0, 'previous_day').decisions.filter(d => d.at <= at));
for (const s of dailySignals(cs, bars4, daily, 2, 0, 'previous_day').signals) {
  assert(s.evidence!.rangeHigh.availableAt <= s.at && s.evidence!.rangeLow.availableAt <= s.at);
  assert(s.evidence!.priceAvailableAt <= s.at && s.evidence!.priorDayAvailableAt <= s.at);
  assert(s.evidence!.location <= .4 || s.evidence!.location >= .6);
}
assert.equal(compare({ x: null }, [['x', '<', 0]]), null);
const options = { start: T, end: T + 22 * D, hold: 12 * H, delay: 0, notional: 10000, equity: 32000, fee: .00055 };
const schedule: Action[] = [0, 11, 12, 24, 47, 90, 527].map(h => ({ id: String(h), at: T + h * H, side: 1 }));
for (const delay of [0, M]) {
  const a = runSchedule(cs, schedule, { ...options, delay }), b = replay(cs, schedule, { ...options, delay });
  for (const [k, v] of Object.entries(a.stats)) assert.deepEqual((b.stats as any)[k], v, k);
  assert.deepEqual(a.monthly, b.monthly);
}
const f = failureTriggers([{ id: 'x', signalAt: T + M, lower: 110 }], aggregate(cs, 15 * M), 2).get('x')!;
assert.equal(f.firstBarStart, T + 15 * M); assert.equal(f.at, T + 46 * M);
assert(!failureTriggers([{ id: 'x', signalAt: T + M, lower: 90 }], aggregate(cs, 15 * M), 1).size);
const flat = make(180).map(c => ({ ...c, open: 100, close: 100, high: 100, low: 100 }));
flat[5] = { ...flat[5], high: 110, low: 90 };
const one: Action[] = [{ id: 'both', at: T, side: 1, stop: 95, target: 105 }];
const o = { ...options, end: T + 180 * M, hold: H };
const a = replay(flat, one, o), b = replay(flat, one, { ...o, targetFirst: true });
assert.equal(a.trades[0].reason, 'stop'); assert.equal(b.trades[0].reason, 'target');
assert(a.trades[0].r < -1 && b.trades[0].r < 1); assert.equal(a.stats.ambiguous, 1);
const shorts = replay(flat, [{ ...one[0], side: -1, stop: 105, target: 95 }], o);
assert.equal(shorts.trades[0].exitPrice, 105); assert(shorts.trades[0].net < 0);
const gap = flat.map(c => ({ ...c })); gap[5] = { ...gap[5], open: 93, close: 93, high: 94, low: 91 };
assert.equal(replay(gap, one, o).trades[0].exitPrice, 93, 'stop gaps cannot fill at stale stop');
assert.equal(replay(flat, [{ ...one[0], target: 99 }], o).stats.cancelled, 1);
const failure = replay(flat, [{ id: 'cut', at: T, side: 1, failureAt: T + 3 * M }], o);
assert.equal(failure.trades[0].exitAt, T + 3 * M);
assert.equal(failure.trades[0].reason, 'poc_failure');
const delayed = replay(flat, [{ id: 'cut', at: T, side: 1, failureAt: T + 3 * M }], { ...o, delay: M });
assert.equal(delayed.trades[0].entryAt, T + M); assert.equal(delayed.trades[0].exitAt, T + 4 * M);
console.log('PI01/DB01 tests passed: prefix/future invariance, causal pivots, session clocks, baseline parity, failures, shorts, gaps, ambiguity, fees/R');
