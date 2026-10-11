import assert from 'assert/strict';
import { ClosedBarSeries, type FinalCandleObservation } from '../src/research/closed-bars';
import { computeResearchFeatures } from '../src/research/indicator-features';
import { computeAdxDmiValues } from '../src/research/adx-dmi-features';
import { INDICATOR_SEED as SEED, TIMED_RULES, TIMED_SOURCES, TimedIndicatorMap,
  timedMapsFromReceipts, timedCrossing, timedExitAt } from '../src/bot/portfolio/timed-indicator-signals';
import { MINUTE as M } from '../src/bot/portfolio/contract';
import { allocateGroup } from '../src/bot/portfolio/allocation';

let count = 0;
function test(name: string, fn: () => void) { try { fn(); count++; } catch (e) { throw new Error(name, { cause: e }); } }
const candles = Array.from({ length: 12_000 }, (_, i) => {
  const close = 100 + 10 * Math.sin(i / 400) + Math.cos(i / 31);
  return { timestamp: SEED + i * M, open: close, high: close + .1, low: close - .1, close, volume: 1, turnover: close };
});
const observations: FinalCandleObservation[] = candles.map(candle => ({ candle, final: true, receivedAt: candle.timestamp + M + 500 }));
const cutoff = candles.at(-1)!.timestamp + 2 * M;
const maps = timedMapsFromReceipts(observations, cutoff);
const rows = maps.CRSI.rows;
const crossing = rows.find(r => r.crossing)!;
assert(crossing, 'synthetic CRSI stream must cross');

test('crossings retain strict current/non-strict previous thresholds and directions', () => {
  assert(timedCrossing('L2', 25, 25.00000001, 1));
  assert(!timedCrossing('L2', 24, 25, 1));
  assert(!timedCrossing('L2', 25.01, 26, 1));
  assert(!timedCrossing('L2', 25, 26, 0));
  assert(!timedCrossing('L2', 25, 26, -1));
  assert(timedCrossing('R5', 40, 40.00000001, -1));
  assert(!timedCrossing('R5', 40, 41, 1));
  assert(!timedCrossing('R5', 39, 40, -1));
  assert(timedCrossing('CRSI', 5, 5.00000001, null));
  assert(!timedCrossing('CRSI', 5.00000001, 6, null));
  for (const v of [null, NaN, Infinity, -1, 101]) {
    assert(!timedCrossing('CRSI', v, 6, null));
    assert(!timedCrossing('CRSI', 5, v, null));
  }
});
test('warmup stays unavailable rather than coercing null to zero', () => {
  assert.equal(maps.L2.decision(maps.L2.rows[0].scheduledAt).status, 'warming_up');
  assert.equal(maps.CRSI.decision(rows[100].scheduledAt).status, 'warming_up');
});
test('formulas and fixed seed reproduce shared helpers for every source bar', () => {
  for (const s of TIMED_SOURCES) {
    const rule = TIMED_RULES[s];
    const series = ClosedBarSeries.fromObservations(observations, { sourceIntervalMs: M, targetIntervalMs: rule.timeframe });
    const cs = series.bars.map(b => b.candle);
    const values = s === 'CRSI' ? computeResearchFeatures(cs, rule.timeframe).map(f => f.crsi)
      : computeAdxDmiValues(cs, rule.timeframe, rule.period).map(f => f.dmAdx);
    assert.deepEqual(maps[s].rows.map(r => r.current), values);
    assert.deepEqual(maps[s].rows.map(r => r.previous), [null, ...values.slice(0, -1)]);
  }
});
test('exact native IDs and twelve-hour-plus-minute planned expiry', () => {
  const d = maps.CRSI.decision(crossing.scheduledAt);
  assert(d.status === 'signal');
  assert.equal(d.signal.id, 'I02:CRSI:' + crossing.sourceEnd);
  assert.equal(d.signal.side, 1);
  assert.equal(d.signal.decisionAt, crossing.sourceEnd + M);
  assert.equal(d.signal.eligibleAt, d.signal.decisionAt);
  assert.equal(d.signal.expiresAt, d.signal.eligibleAt + 721 * M);
  assert.equal(d.signal.stop, undefined); assert.equal(d.signal.target, undefined);
  assert(d.signal.knownAt <= d.signal.decisionAt);
  const accepted = allocateGroup({ at: d.at, price: crossing.close, priceKnownAt: crossing.knownAt,
    equity: 19_000, heldMargin: 0, feeRate: .00055, occupied: [], pending: [], signals: [d.signal] });
  assert.equal(accepted[0].reason, 'accepted');
  assert.equal(accepted[0].reservation!.requestedNotional, 20_000 / 3);
});
test('no early, stale or deferred entry; same scheduled-minute ID is stable', () => {
  assert.equal(maps.CRSI.decision(crossing.scheduledAt - 1).status, 'outside_entry_window');
  assert.deepEqual(maps.CRSI.decision(crossing.scheduledAt + M - 1), maps.CRSI.decision(crossing.scheduledAt));
  assert.equal(maps.CRSI.decision(crossing.scheduledAt + M).status, 'outside_entry_window');
  assert.equal(maps.CRSI.decision(rows.at(-1)!.scheduledAt + 15 * M).status, 'missing_bar');
});
test('timeout follows actual fill seconds, not the scheduled entry or acknowledgement', () => {
  assert.equal(timedExitAt(crossing.scheduledAt + 521), crossing.scheduledAt + 521 + 721 * M);
  for (const at of [NaN, -1, 1.5, Number.MAX_SAFE_INTEGER]) assert.throws(() => timedExitAt(at));
});
test('late final source candle never backdates a decision or exposes future features', () => {
  const delayed = observations.map(r => r.candle.timestamp === crossing.sourceEnd - M
    ? { ...r, receivedAt: crossing.scheduledAt + 1 } : r);
  const m = timedMapsFromReceipts(delayed, cutoff).CRSI;
  assert.deepEqual(m.decision(crossing.scheduledAt), {
    source: 'CRSI', at: crossing.scheduledAt, timing: 'observed_final_receipt', status: 'late_inputs',
  });
  assert.equal(m.decision(crossing.scheduledAt + 1000).status, 'late_inputs');
  assert.equal(m.decision(crossing.scheduledAt + M).status, 'outside_entry_window');
});
test('old delayed recursive dependency blocks even with a timely newest candle', () => {
  const delayed = observations.map((r, i) => i === 0 ? { ...r, receivedAt: crossing.scheduledAt + 1 } : r);
  const m = timedMapsFromReceipts(delayed, cutoff).CRSI;
  assert.equal(m.rows.find(r => r.sourceEnd === crossing.sourceEnd)!.knownAt, crossing.scheduledAt + 1);
  assert.equal(m.decision(crossing.scheduledAt).status, 'late_inputs');
});
test('prefix rebuild and restart do not change features or decisions', () => {
  for (const n of [3600, 6600, 9600]) {
    const prefix = observations.slice(0, n), now = prefix.at(-1)!.receivedAt;
    const a = timedMapsFromReceipts(prefix, now), b = timedMapsFromReceipts(observations, now);
    const restarted = timedMapsFromReceipts(JSON.parse(JSON.stringify(prefix)), now);
    for (const s of TIMED_SOURCES) {
      assert.deepEqual(a[s].rows, b[s].rows); assert.deepEqual(a[s].rows, restarted[s].rows);
      assert.deepEqual(a[s].rows, maps[s].rows.slice(0, a[s].rows.length));
    }
  }
});
test('future-poisoned final revision cannot affect an earlier as-of build', () => {
  const n = 6600, now = observations[n - 1].receivedAt;
  const poison: FinalCandleObservation = { final: true, receivedAt: now + 2 * M,
    candle: { ...observations[0].candle, close: 5, low: 5 } };
  const a = timedMapsFromReceipts(observations, now), b = timedMapsFromReceipts([...observations, poison], now);
  for (const s of TIMED_SOURCES) assert.deepEqual(a[s].rows, b[s].rows);
  assert.throws(() => timedMapsFromReceipts([...observations, poison], cutoff), /Conflicting/);
});
test('missing internal minute or missing seed rejects instead of reseeding/bridging', () => {
  assert.throws(() => timedMapsFromReceipts(observations.filter((_, i) => i !== 1300), cutoff), /prefix incomplete/);
  assert.throws(() => timedMapsFromReceipts(observations.slice(30), cutoff), /seed unavailable/);
});
test('forming, pre-close, malformed receipts and conflicting final rows fail closed', () => {
  assert.throws(() => timedMapsFromReceipts([{ ...observations[0], final: false } as any, ...observations.slice(1)], cutoff), /forming/i);
  assert.throws(() => timedMapsFromReceipts([{ ...observations[0], receivedAt: SEED }, ...observations.slice(1)], cutoff), /precedes/);
  assert.throws(() => timedMapsFromReceipts([{ ...observations[0], receivedAt: NaN }], cutoff), /epoch/);
  assert.throws(() => timedMapsFromReceipts([...observations, { ...observations[0], candle: { ...candles[0], volume: 4 } }], cutoff), /Conflicting/);
});
test('invalid source timeframe and rolling seed cannot be silently accepted', () => {
  const thirty = ClosedBarSeries.fromObservations(observations, { sourceIntervalMs: M, targetIntervalMs: 30 * M });
  assert.throws(() => new TimedIndicatorMap('L2', thirty), /minute-derived/);
  assert.throws(() => new TimedIndicatorMap('SF08' as any, thirty), /unknown/);
  assert.throws(() => maps.CRSI.decision(NaN), /epoch/);
});
test('compiled features are independent of caller mutation and immutable', () => {
  const x = JSON.parse(JSON.stringify(observations)) as FinalCandleObservation[];
  const m = timedMapsFromReceipts(x, cutoff).CRSI, original = m.rows[110].current;
  (x[110].candle as any).close = 1;
  assert.equal(m.rows[110].current, original);
  assert.throws(() => { (m.rows[110] as any).current = 100; });
});
console.log(JSON.stringify({ passed: true, cases: count, sources: TIMED_SOURCES, exchangeCalls: 0 }));
