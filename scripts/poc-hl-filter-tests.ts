import fs from 'fs';
import assert from 'assert/strict';
import { TpHlTape, normalize, MIN as M } from './tp-hl-event-features';
import { weeklyTable, opportunity, admitted, execute, comparison } from './poc-hl-filter-engine';
import type { Candle } from './hype-freerun-canonical-replay';
const spec = JSON.parse(fs.readFileSync('research-inputs/poc-hl-context-ph01-2026-09-17.json', 'utf8'));
const T = Date.parse('2026-06-01T00:00:00Z'), at = T + 60 * M;
let count = 0;
const test = (name: string, fn: () => void) => { fn(); count++; console.log('PASS ' + name); };
const candles = (n: number): Candle[] => Array.from({ length: n }, (_, i) => ({ ts: T + i * M, endTs: T + (i + 1) * M,
  open: 100, high: 101, low: 99, close: 100, volume: 2, turnover: 200 }));
function pulse() {
  const t = new TpHlTape(spec);
  for (let i = 0; i < 22; i++) {
    const end = at - i * M, buy = i <= 4 ? 30 : 60;
    t.add(normalize('taker', { timestamp: end, windowEnd: end, windowStart: end - M,
      buyNotional: buy, sellNotional: 100 - buy, buyVol: buy, sellVol: 100 - buy, buyCount: 1, sellCount: 1 }, 'taker', i + 1));
  }
  t.add(normalize('book', { timestamp: at - 1000, exchangeTimestamp: at - 1000,
    bidBands: { pct_0_5: 100 }, askBands: { pct_0_5: 100 }, bidBandsTruncated: { pct_0_5: false },
    askBandsTruncated: { pct_0_5: false }, bandResolutionTooCoarse: { pct_0_5: false } }, 'book', 1));
  t.add(normalize('asset', { timestamp: at - 1000, openInterest: 100 }, 'asset', 1)); t.seal(); return t;
}
test('all three rules share fail-closed coverage; warning alone versus compound', () => {
  const covered = { covered: true, warningB: true, warningC: false };
  assert(admitted(covered, 'A')); assert(!admitted(covered, 'B')); assert(admitted(covered, 'C'));
  for (const rule of ['A', 'B', 'C'] as const) assert(!admitted({ ...covered, covered: false }, rule));
});
test('fixed feature clocks and strict below-VWAP rule', () => {
  const x = opportunity({ id: 'x', signalAt: at }, pulse(), weeklyTable(candles(100)), 0);
  assert(x.covered); assert(Math.abs(x.acceleration + .3) < 1e-10); assert(x.warningB); assert(!x.warningC);
  assert.equal(x.weekly.barEnd, T + 45 * M); assert.equal(x.weekly.availableAt, T + 46 * M);
  assert(x.sources.taker5.sources.every((r: any) => r.availableAt <= at && r.sourceAt < at));
});
test('future publication and future candles do not alter earlier decisions', () => {
  const t = pulse(), cs = candles(100), table = weeklyTable(cs), s = { id: 'x', signalAt: at };
  const old = opportunity(s, t, table, 0);
  t.add(normalize('taker', { timestamp: at - M, windowStart: at - 2 * M, windowEnd: at - M,
    writtenAt: at + 1, buyNotional: 1e10, sellNotional: 0, buyVol: 1, sellVol: 0, buyCount: 1, sellCount: 0 }, 'late', 1));
  t.add(normalize('asset', { timestamp: at + 1, openInterest: 1e10 }, 'future', 1)); t.seal();
  const changed = cs.map(c => c.ts >= at ? { ...c, open: 1000, high: 1000, low: 1000, close: 1000, turnover: 2000 } : c);
  assert.deepEqual(opportunity(s, t, weeklyTable(changed), 0), old);
  assert.deepEqual(opportunity(s, t, weeklyTable(cs.filter(c => c.endTs <= at)), 0), old);
});
test('missing or conflicting minute makes acceleration unknown, not permissive', () => {
  const t = pulse(); t.add(normalize('taker', { timestamp: at - M, windowEnd: at - M, windowStart: at - 2 * M,
    buyNotional: 80, sellNotional: 20, buyVol: 80, sellVol: 20, buyCount: 1, sellCount: 1 }, 'conflict', 1)); t.seal();
  const x = opportunity({ id: 'x', signalAt: at }, t, weeklyTable(candles(100)), 0);
  assert.equal(x.acceleration, null); assert(!x.covered);
});
test('source-delay changes knowledge only, not the touch decision timestamp', () => {
  const x = opportunity({ id: 'x', signalAt: at }, pulse(), weeklyTable(candles(100)), M);
  assert.equal(x.queryAt, at - M); assert.equal(x.signalAt, at); assert(!x.covered, 'Fresh book/asset not yet available');
});
test('filter occupancy admits a replacement instead of subtracting baseline losses', () => {
  const cs = candles(100), o = { start: T, end: T + 100 * M, delay: 0, hold: 12 * M, notional: 10000, equity: 32000, fee: .00055 };
  const ops = [1, 4, 14].map((i, j) => ({ id: String(j), signalAt: T + i * M, queryAt: T + i * M,
    covered: true, warningB: j === 0, warningC: false }));
  const a = execute(cs, ops, 'A', o), b = execute(cs, ops, 'B', o);
  assert.deepEqual(a.trades.map(t => t.id), ['0', '2']); assert.deepEqual(b.trades.map(t => t.id), ['1']);
  const attr = comparison(a, b); assert.equal(attr.directVeto.n, 1); assert.equal(attr.displacedByReplacement.n, 1); assert.equal(attr.replacement.n, 1);
  assert(Math.abs(attr.summary.delta - (b.stats.net - a.stats.net)) < 1e-9);
});
test('action delay preserves original entry and timeout delay conventions', () => {
  const cs = candles(100), o = { start: T, end: T + 100 * M, delay: M, hold: 12 * M, notional: 10000, equity: 32000, fee: .00055 };
  const run = execute(cs, [{ id: 'x', signalAt: T, queryAt: T, covered: true, warningB: false, warningC: false }], 'A', o);
  assert.equal(run.trades[0].entryAt, T + M); assert.equal(run.trades[0].exitAt, T + 14 * M); assert.equal(run.trades[0].net, -11);
});
test('cutoff keeps open inventory marked and outside win/loss count', () => {
  const cs = candles(10), o = { start: T, end: T + 10 * M, delay: 0, hold: 12 * M, notional: 10000, equity: 32000, fee: .00055 };
  const run = execute(cs, [{ id: 'x', signalAt: T, queryAt: T, covered: true, warningB: false, warningC: false }], 'A', o);
  assert.equal(run.trades.length, 0); assert.equal(run.open.net, -11); assert.equal(run.stats.net, -11);
});
console.log(`PH02 ${count} tests passed`);
