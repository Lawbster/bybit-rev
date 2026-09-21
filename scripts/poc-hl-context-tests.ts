import fs from 'fs';
import assert from 'assert/strict';
import { money, predicate, partition, extraSnapshot, sourceReferences, CARD } from './poc-hl-context';
import { TpHlTape, normalize, MIN } from './tp-hl-event-features';
const c = JSON.parse(fs.readFileSync(CARD, 'utf8')), T = Date.parse('2026-06-01T00:00:00Z');
let tests = 0;
const test = (name: string, f: () => void) => { f(); tests++; console.log('PASS ' + name); };
const taker = (end: number, extra = {}) => ({ timestamp: end, windowStart: end - MIN, windowEnd: end, buyNotional: 200, sellNotional: 100,
  buyVol: 2, sellVol: 1, buyCount: 2, sellCount: 1, largeBuyNotional: 50, largeSellNotional: 10, ...extra });
function tape() { const t = new TpHlTape(c); for (let i = 0; i <= 80; i++) t.add(normalize('taker', taker(T - i * MIN), 'taker', i + 1)); t.seal(); return t; }
test('full monetary identity and unknowns not counted as zero trades', () => {
  const x = money([{ net: 20 }, { net: -9 }]); assert.equal(x.net, 11); assert.equal(x.wins, 1); assert.equal(x.avgLoss, -9); assert.equal(money([]).average, null);
});
test('missing required feature stays unknown in compound predicate', () => {
  assert.equal(predicate({ a: 0, b: null }, [['a', '>', 10], ['b', '<', 1]]), null);
  assert.equal(predicate({ a: 0 }, [['a', '<=', 0]]), true);
});
test('partition dollar/count conservation, fixed chronological split', () => {
  const events = [{ id: 'a', net: 10, month: '2026-06', signalAt: T - 1, features: { x: 1 } },
    { id: 'b', net: -3, month: '2026-06', signalAt: T, features: { x: -1 } },
    { id: 'c', net: 50, month: '2026-06', signalAt: T, features: { x: null } }];
  const p = partition(events, { id: 'x', conditions: [['x', '>', 0]] }, T);
  assert.equal(p.baselineKnown.net, 7); assert.equal(p.missing.net, 50); assert.equal(p.early.condition.n, 1); assert.equal(p.late.other.n, 1);
});
test('weighted 1h and 15m flow excludes just-ended unpublished bucket', () => {
  const s = extraSnapshot(tape(), T, c); assert.equal(s.sources.taker60.samples, 59); assert.equal(s.features.takerRatio60, 2);
  assert.equal(s.sources.taker15.samples, 14); assert.equal(s.features.largeNetShare15, 40 / 300);
});
test('future source poisoning leaves all metrics and provenance unchanged', () => {
  const t = tape(), before = extraSnapshot(t, T, c);
  t.add(normalize('asset', { timestamp: T + 1, openInterest: 1e10, markPrice: 100 }, 'asset', 1));
  t.add(normalize('taker', taker(T + MIN, { buyNotional: 1e15 }), 'future', 1)); t.seal();
  assert.deepEqual(extraSnapshot(t, T, c), before);
});
test('later publication does not contaminate prior completed window', () => {
  const t = tape(), before = extraSnapshot(t, T, c);
  t.add(normalize('taker', taker(T - MIN, { buyNotional: 1e10, writtenAt: T + MIN }), 'later', 1)); t.seal();
  assert.deepEqual(extraSnapshot(t, T, c), before);
});
test('OI uses native quantities and valid historical anchors', () => {
  const t = tape(); for (const span of [0, 60, 240]) t.add(normalize('asset', { timestamp: T - span * MIN - 1000, openInterest: span ? 100 : 101, openInterestValue: span ? 10000 : 9000 }, 'asset', span + 1));
  t.seal(); const s = extraSnapshot(t, T, c);
  assert(Math.abs(s.features.assetNativeOiChange60Pct - 1) < 1e-10); assert(Math.abs(s.features.assetNativeOiChange240Pct - 1) < 1e-10);
  assert.equal(extraSnapshot(t, T + 2 * MIN, c).features.assetNativeOiChange60Pct, null);
});
test('all references respect query clocks, including prior flow section', () => {
  for (const r of sourceReferences(extraSnapshot(tape(), T, c))) assert(r.availableAt <= r.queryAt && r.sourceAt <= r.queryAt);
});
test('source-delay sensitivity uses no data later than delayed knowledge time', () => {
  const s = extraSnapshot(tape(), T - MIN, c);
  assert.equal(s.sources.taker15.sources.at(-1).sourceAt, T - 2 * MIN);
});
test('sixteen diagnostic predicates, not outcome-optimized thresholds', () => {
  assert.equal(c.diagnosticPredicates.length, 16); assert.equal(c.newEconomicDefinitions, 0); assert.equal(c.relativeMinutes.length, 16);
});
console.log(`PH01 ${tests} tests passed`);
