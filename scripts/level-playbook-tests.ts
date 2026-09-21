import assert from 'assert/strict';
import fs from 'fs';
import { buildAtlas, valueAt, sourceEndAt, FIELDS, COLUMN, M, H, D, type Atlas } from './level-playbook-map';
import { buildSignals, DEFINITIONS } from './level-playbook-signals';
import type { Candle } from './hype-freerun-canonical-replay';
const c = JSON.parse(fs.readFileSync('research-inputs/level-playbook-lv01-2026-09-17.json', 'utf8'));
const near = (actual: number, expected: number) => assert(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function candles(start: number, minutes: number, price = 100): Candle[] {
  return Array.from({ length: minutes }, (_, i) => ({ ts: start + i * M, endTs: start + (i + 1) * M,
    open: price, high: price + 2, low: price - 1, close: price + 1, volume: 2, turnover: 2 * (price + .25) }));
}
const start = Date.UTC(2026, 0, 1), cs = candles(start, 33 * 1440), a = buildAtlas(cs, []);
assert.equal(FIELDS.length, 32); assert.equal(DEFINITIONS.length, 32);
assert(Number.isNaN(valueAt(a, start + M, 'dOpen')));
assert.equal(valueAt(a, start + 2 * M, 'dOpen'), 100);
assert(Number.isNaN(valueAt(a, start + D, 'pdHigh')));
assert.equal(valueAt(a, start + D + M, 'pdHigh'), 102);
assert.equal(valueAt(a, start + D + M, 'pdLow'), 99);
assert.equal(valueAt(a, start + D + M, 'pdMid'), 100.5);
near(valueAt(a, start + D + M, 'vwapPD'), 100 + 2 / 3);
assert.equal(valueAt(a, start + D + M, 'actualPD'), 100.25);
assert(Number.isNaN(valueAt(a, start + D, 'vwap24')));
near(valueAt(a, start + D + M, 'vwap24'), 100 + 2 / 3);
assert.equal(valueAt(a, start + 31 * D + M, 'pmHigh'), 102);
assert.equal(valueAt(a, start + 31 * D - M, 'vwapM'), 100.5);
assert.equal(valueAt(a, start + 31 * D - M, 'actualM'), 100.25);
assert(Number.isNaN(valueAt(a, start + 4 * D + M, 'pwHigh')), 'Leading partial week unavailable');
assert.equal(valueAt(a, start + 11 * D + M, 'pwHigh'), 102);
assert(Number.isNaN(valueAt(a, start + D + M, 'dHigh')), 'No first minute of new day observed yet');
assert.equal(valueAt(a, start + D + 2 * M, 'dHigh'), 102);
assert.equal(sourceEndAt(a, start + 100 * M), start + 99 * M);
const partial = buildAtlas(cs.slice(5, 1440 * 3), []);
assert(Number.isNaN(valueAt(partial, start + D + M, 'pdOpen')));
assert.equal(valueAt(partial, start + 2 * D + M, 'pdOpen'), 100);
const prefix = buildAtlas(cs.slice(0, 2000), []);
assert.deepEqual(prefix.values, a.values.slice(0, prefix.values.length), 'No future candle changes prefix map');
const zero = buildAtlas(candles(start, 10).map(b => ({ ...b, volume: 0, turnover: 0 })), []);
assert(Number.isNaN(valueAt(zero, start + 5 * M, 'vwapD')));
assert.equal(valueAt(zero, start + 5 * M, 'dHigh'), 102);

function controlledAtlas(tape: Candle[]): Atlas {
  const x = buildAtlas(tape, []); x.values.fill(NaN);
  for (let i = 0; i < tape.length; i++) x.values[i * FIELDS.length + COLUMN.dOpen] = 100;
  return x;
}
const tape = candles(start, 240, 99).map(b => ({ ...b, open: 99, high: 99.1, low: 98.9, close: 99 }));
function setBar(i: number, open: number, high: number, low: number, close: number) {
  for (let j = i * 15; j < (i + 1) * 15; j++) Object.assign(tape[j], { open, high, low, close });
}
setBar(2, 99, 101.1, 98.9, 101); // breakout ends45m, published46m
setBar(3, 101, 101.1, 99.95, 100.5); // cannot use immediate next15m bar (begins45m)
setBar(4, 100.5, 100.8, 100.05, 100.5); // eligible retest beginning60m
let sig = buildSignals(tape, controlledAtlas(tape), c).signals.dOpen_retest;
assert(sig.length > 0); assert.equal(sig[0].at, start + 76 * M); assert.equal(sig[0].side, 1);
assert.equal(sig[0].evidence.breakoutAvailableAt, start + 46 * M);
assert.equal(sig[0].evidence.frozenAt, start + 30 * M);
assert(sig[0].evidence.referenceAvailableAt <= sig[0].evidence.frozenAt);
assert(sig[0].evidence.reactionStart >= sig[0].evidence.breakoutAvailableAt);
const before = buildSignals(tape.slice(0, 90), controlledAtlas(tape.slice(0, 90)), c).signals.dOpen_retest;
assert.deepEqual(before, sig.filter(s => s.at < start + 90 * M), 'Signal prefix invariance');
setBar(4, 100.5, 100.8, 98.8, 99); // invalidate before later rebound
sig = buildSignals(tape, controlledAtlas(tape), c).signals.dOpen_retest;
assert(!sig.some(s => s.at === start + 76 * M));
const constant = candles(start, 240).map(b => ({ ...b, high: 100, low: 100, open: 100, close: 100 }));
const moving = controlledAtlas(constant);
for (let i = 0; i < constant.length; i++) moving.values[i * FIELDS.length + COLUMN.dOpen] = i < 80 ? 99 : 101;
assert.equal(buildSignals(constant, moving, c).signals.dOpen_retest.length, 0, 'Moving/reset reference alone cannot be a breakout');
console.log('LV01 tests passed: 32 fields/definitions, complete-period coverage, UTC boundaries, availability, VWAP formulas, zero volume, prefix invariance, retest sequencing/invalidation and reset-only rejection.');
