import assert from 'assert/strict';
import { ClosedBarSeries } from '../src/research/closed-bars';
import { MacdSignalMap, macdExitDecision, type MacdPublication } from '../src/bot/portfolio/macd-signals';
import { INDICATOR_SEED } from '../src/bot/portfolio/timed-indicator-signals';
import { StructuralSignalMap, STRUCTURAL_SEED } from '../src/bot/portfolio/structural-signals';
import { causalPivots, aggregate } from '../src/strategies/price-action-signals';
import { allocateGroup } from '../src/bot/portfolio/allocation';
import { emptyLedger, reserveGroup } from '../src/bot/portfolio/ledger';
import { MINUTE as M } from '../src/bot/portfolio/contract';
const TF = 240 * M;
let cases = 0;
function test(name: string, fn: () => void) { try { fn(); cases++; } catch (e) { throw new Error(name, { cause: e }); } }
const candles = Array.from({ length: 160 * 240 }, (_, i) => {
  const close = 100 + 20 * Math.sin(i / 2000);
  return { timestamp: INDICATOR_SEED + i * M, open: close, high: close + .1, low: close - .1, close, volume: 1, turnover: close };
});
const build = (cs = candles) => new MacdSignalMap(ClosedBarSeries.fromHistorical(cs, {
  sourceIntervalMs: M, targetIntervalMs: TF, publicationLagMs: 0,
}));
const map = build(), crossing = map.rows.find(r => r.crossing)!; assert(crossing);
const at = crossing.sourceEnd;
const frame = { at, price: crossing.close, priceKnownAt: at, equity: 19_000, heldMargin: 0,
  feeRate: .00055, occupied: [], pending: [] };
test('MACD zero-lag research clocks and exact sign crossing', () => {
  const d = map.entry(at); assert(d.status === 'signal');
  assert.equal(d.signal.id, 'I06:R3:' + at); assert.equal(d.signal.eligibleAt, at + M);
  assert.equal(d.signal.expiresAt, at + 722 * M); assert.equal(d.signal.side, -1);
  assert(d.feature.previous! >= 0 && d.feature.current! < 0);
  assert.equal(allocateGroup({ ...frame, signals: [d.signal] })[0].reason, 'accepted');
  assert.equal(map.entry(at + M).status, 'outside_decision_window');
  assert.equal(map.entry(at - 1).status, 'outside_decision_window');
});
test('real MACD receipt is not backdated; the original fill boundary stays fixed', () => {
  const obs = candles.map(candle => ({ candle, final: true as const, receivedAt: candle.timestamp + M + 300 }));
  const observed = new MacdSignalMap(ClosedBarSeries.fromObservations(obs, { sourceIntervalMs: M, targetIntervalMs: TF }));
  assert.equal(observed.entry(at).status, 'inputs_unavailable');
  const d = observed.entry(at + 400); assert(d.status === 'signal');
  assert.equal(d.signal.knownAt, at + 300); assert.equal(d.signal.decisionAt, at + 400);
  assert.equal(d.signal.eligibleAt, at + M); assert.equal(d.arrivalDelayMs, 400);
  const s = emptyLedger('123');
  assert.equal(reserveGroup(s, { ...frame, at: at + 400, signals: [d.signal] })[0].reason, 'accepted');
  const again = observed.entry(at + 600); assert(again.status === 'signal');
  assert.throws(() => reserveGroup(s, { ...frame, at: at + 600, signals: [again.signal] }), /consumed/);
});
test('late MACD receipt cannot enter after its decision window', () => {
  const obs = candles.map(candle => ({ candle, final: true as const, receivedAt: candle.timestamp + 2 * M }));
  const m = new MacdSignalMap(ClosedBarSeries.fromObservations(obs, { sourceIntervalMs: M, targetIntervalMs: TF }));
  assert.equal(m.entry(at + M - 1).status, 'inputs_unavailable');
  assert.equal(m.entry(at + M).status, 'outside_decision_window');
});
test('off-grid decisions are allowed only for MACD before its original execution boundary', () => {
  const d = map.entry(at + 300); assert(d.status === 'signal');
  assert.throws(() => allocateGroup({ ...frame, at: at + 300, signals: [{ ...d.signal, source: 'R5' }] }), /clock/);
  assert.throws(() => allocateGroup({ ...frame, at: at + 300, signals: [{ ...d.signal, eligibleAt: at + 2 * M }] }), /clock/);
  assert.throws(() => allocateGroup({ ...frame, at: at + 300, signals: [{ ...d.signal, knownAt: at + 400 }] }), /clock/);
});
const entry = at + M, timeout = entry + 720 * M;
const publication = (t: number, knownAt = t): MacdPublication => ({ sourceEnd: t, knownAt,
  previous: -1, current: 0, close: 100, crossing: false, exit: true });
test('timeout works with an empty/gapped indicator feed and is not postponed after downtime', () => {
  assert.equal(macdExitDecision(entry, timeout - 1, []), null);
  assert.deepEqual(macdExitDecision(entry, timeout, []), {
    reason: 'timeout', causeAt: timeout, observedAt: timeout, executeAt: timeout + M, overdueMs: 0,
  });
  const d = macdExitDecision(entry, timeout + 10 * M, [])!;
  assert.equal(d.executeAt, timeout + 10 * M); assert.equal(d.overdueMs, 9 * M);
});
test('only subsequent, received MACD bars can reverse; equality exits; timeout wins ties', () => {
  assert.equal(macdExitDecision(entry, entry, [publication(at)]), null);
  assert.equal(macdExitDecision(entry, at + TF, [publication(at + TF, at + TF + 300)]), null);
  const d = macdExitDecision(entry, at + TF + 300, [publication(at + TF, at + TF + 300)])!;
  assert.equal(d.reason, 'indicator'); assert.equal(d.executeAt, at + TF + 300 + M);
  // Synthetic entry aligned to a 4h clock makes the timeout/indicator tie exact.
  assert.equal(macdExitDecision(at, at + 3 * TF, [publication(at + 3 * TF)])!.reason, 'timeout');
  assert.throws(() => macdExitDecision(entry, entry - 1, []), /precedes/);
});
test('MACD feature/policy prefixes and restart are invariant to later candles', () => {
  const cs = candles.filter(c => c.timestamp + M <= at);
  assert.deepEqual(build(cs).entry(at), map.entry(at));
  assert.deepEqual(build(JSON.parse(JSON.stringify(cs))).entry(at), map.entry(at));
  const poisoned = candles.map(c => c.timestamp >= at ? { ...c, open: 1, high: 1, low: 1, close: 1 } : c);
  assert.deepEqual(build(poisoned).entry(at), map.entry(at));
});
test('MACD rolling seed and internal gaps cannot be silently bridged', () => {
  assert.throws(() => build(candles.slice(240)), /seed/);
  assert.throws(() => build(candles.filter((_, i) => i !== 2000)), /incomplete/);
});

const structuralMinutes = Array.from({ length: 3000 }, (_, i) => ({ ts: STRUCTURAL_SEED + i * M,
  endTs: STRUCTURAL_SEED + (i + 1) * M, availableAt: STRUCTURAL_SEED + (i + 2) * M,
  open: 100, high: 101, low: 99, close: 100, volume: 1, turnover: 100 }));
const cutoff = structuralMinutes.at(-1)!.availableAt;
test('structural prefix validation rejects gaps, duplicates, false final receipts and seed drift', () => {
  assert.throws(() => new StructuralSignalMap(structuralMinutes.slice(1), cutoff), /seed/);
  assert.throws(() => new StructuralSignalMap(structuralMinutes.filter((_, i) => i !== 100), cutoff), /prefix/);
  assert.throws(() => new StructuralSignalMap([...structuralMinutes, structuralMinutes[0]], cutoff), /prefix/);
  assert.throws(() => new StructuralSignalMap([{ ...structuralMinutes[0], availableAt: STRUCTURAL_SEED }, ...structuralMinutes.slice(1)], cutoff), /prefix/);
});
test('structural maps exclude future receipts, never reuse stale signals and cannot certify a later observation', () => {
  const m = new StructuralSignalMap(structuralMinutes, cutoff);
  assert.equal(m.rows.length, 0);
  const clock = Math.floor((cutoff - M) / (60 * M)) * 60 * M + M;
  assert.equal(m.decision('PA07', clock).status, 'no_signal');
  assert.equal(m.decision('PA07', clock + M).status, 'outside_entry_window');
  assert.equal(m.decision('PA07', clock + 60 * M).status, 'inputs_unavailable');
  const poisoned = { ...structuralMinutes[0], close: 900, availableAt: cutoff + 1 };
  assert.deepEqual(new StructuralSignalMap([...structuralMinutes, poisoned], cutoff).rows, m.rows);
});
test('receipt-aware PA07 pivots include ALL neighbours, not just the final bar', () => {
  const base = Math.ceil(STRUCTURAL_SEED / TF) * TF;
  const bars = [101, 103, 110, 105, 102].map((high, i) => ({ timestamp: base + i * TF,
    open: 100, close: 100, high, low: 99, volume: 1, turnover: 100, availableAt: base + (i + 1) * TF + M }));
  const nominal = causalPivots(bars, TF, 2, M).find(p => p.kind === 'high')!;
  assert.equal(nominal.availableAt, base + 5 * TF + M);
  bars[0].availableAt = base + 6 * TF;
  assert.equal(causalPivots(bars, TF, 2, M).find(p => p.kind === 'high')!.availableAt, base + 6 * TF);
});
test('shared PA07 aggregation preserves bare-candle shape and validates receipt provenance', () => {
  const raw = structuralMinutes.map(({ availableAt, ...c }) => c);
  assert(aggregate(raw, 60 * M).every(c => c.availableAt === undefined));
  assert(aggregate(structuralMinutes, 60 * M).every(c => c.availableAt === c.timestamp + 61 * M));
  assert.throws(() => aggregate([{ ...raw[0], availableAt: structuralMinutes[0].availableAt }, ...raw.slice(1)], 60 * M), /mixed/);
});
console.log(JSON.stringify({ passed: true, cases, exchangeCalls: 0 }));
