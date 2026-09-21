import assert from 'assert/strict';
import { replay, type Action } from './poc-indicator-bias-engine';
import { resolveLimitEntry } from './structural-limit-entry';
import { auditStructuralReplay } from './structural-replay-audit';
const M = 60000, start = Date.UTC(2026, 0, 31, 23, 55);
const candles = (n = 60) => Array.from({ length: n }, (_, i) => ({ ts: start + i * M, endTs: start + (i + 1) * M,
  open: 102, high: 103, low: 101, close: 102, volume: 1, turnover: 102 }));
const a = (id = 'a', at = start, model: 'touch' | 'open' = 'touch'): Action => ({ id, at, side: 1, stop: 98, target: 108,
  expiresAt: at + 10 * M, entry: { price: 100, expiresAt: at + 5 * M, model } });
const opts = (end = start + 40 * M, delay = 0, targetFirst = false) => ({ start, end, delay, targetFirst,
  hold: 10 * M, notional: 10000, equity: 32000, fee: .00055 });
let checks = 0;
function check(cs: ReturnType<typeof candles>, xs: Action[], o = opts()) { const r = replay(cs, xs, o); auditStructuralReplay(cs, xs, o, r); checks++; return r; }
let cs = candles(); cs[2] = { ...cs[2], low: 99, close: 101 };
let r = check(cs, [a()]); assert.equal(r.trades[0].entryAt, start + 2 * M); assert.equal(r.trades[0].entryPrice, 100);
assert.equal(r.trades[0].exitAt, start + 12 * M, 'hold starts at fill, not signal');
r = check(cs, [a('open', start, 'open')]); assert.equal(r.trades.length, 0); assert.equal(r.entryIntents[0].ignoredTouches, 1);
assert.equal(r.entryIntents[0].phase, 'expired');
r = check(cs, [a('delayed', start)], opts(start + 40 * M, 3 * M)); assert.equal(r.trades.length, 0, 'no retrospective fill');
// Boundary touch cannot fill an expired intent. New signals can submit at expiry.
cs = candles(); cs[5] = { ...cs[5], low: 99, close: 100 };
r = check(cs, [a(), a('overlap', start + M), a('at-expiry', start + 5 * M)]);
assert.equal(r.entryIntents[0].phase, 'expired'); assert.equal(r.stats.skippedOccupied, 1);
assert.equal(r.trades[0].id, 'at-expiry'); assert.equal(r.trades[0].entryAt, start + 5 * M);
// Existing order crosses stop: entry and loss, not an invalidation.
cs = candles(); cs[2] = { ...cs[2], open: 96, high: 97, low: 95, close: 96 };
r = check(cs, [a()]); assert.equal(r.entryIntents[0].phase, 'filled');
assert.deepEqual([r.trades[0].reason, r.trades[0].entryPrice, r.trades[0].exitPrice], ['stop', 100, 96]); assert(r.trades[0].net < -400);
r = check(cs, [a('open-gap', start, 'open')]); assert.equal(r.trades[0].exitPrice, 96);
// Bracket already invalid before placement: no order exists to fill.
r = check(cs, [a()], opts(start + 40 * M, 2 * M)); assert.equal(r.entryIntents[0].phase, 'invalidated'); assert.equal(r.trades.length, 0);
cs = candles(); cs[2] = { ...cs[2], high: 109, low: 97, close: 102 };
r = check(cs, [a()]); assert.equal(r.trades[0].reason, 'stop'); assert.equal(r.entryAmbiguous, 1);
r = check(cs, [a()], opts(start + 40 * M, 0, true)); assert.equal(r.trades[0].reason, 'target');
// Entry bar's pre-entry high is not a proven post-entry target hit.
cs[2] = { ...cs[2], low: 99 };
r = check(cs, [a()]); assert.equal(r.trades[0].reason, 'timeout'); assert.equal(r.entryAmbiguous, 1);
r = check(cs, [a()], opts(start + 40 * M, 0, true)); assert.equal(r.trades[0].reason, 'target');
cs[2] = { ...cs[2], close: 108 };
r = check(cs, [a()]); assert.equal(r.trades[0].reason, 'target'); assert.equal(r.entryAmbiguous, 0);
// Marketable cap charged without favorable price improvement.
cs = candles(); cs[0] = { ...cs[0], open: 99, low: 98.5, close: 101 };
r = check(cs, [a()]); assert.equal(r.trades[0].entryPrice, 100);
// A later target-open cancels only while unfilled.
cs = candles(); cs[2] = { ...cs[2], open: 109, high: 110, low: 100, close: 109 };
r = check(cs, [a()]); assert.equal(r.entryIntents[0].phase, 'invalidated'); assert.equal(r.trades.length, 0);
cs = candles(); r = check(cs, [a()], opts(start + 3 * M)); assert.equal(r.stats.pendingAtEnd, true); assert.equal(r.entryIntents[0].phase, 'cutoff');
// Decisions through the expiry are prefix-invariant, even if later prices change.
const intent = resolveLimitEntry(cs, a(), 0, start + 40 * M);
cs[10] = { ...cs[10], open: 90, high: 150, low: 80, close: 140 };
assert.deepEqual(resolveLimitEntry(cs.slice(0, 5), a(), 0, start + 5 * M), intent);
r = check(cs, [a()]); r.entryIntents[0].phase = 'filled';
assert.throws(() => auditStructuralReplay(cs, [a()], opts(), r));
// Signal occurs after the old sweep, so that old low cannot enter this order.
cs = candles(); cs[0] = { ...cs[0], low: 90 };
r = check(cs, [a('known-later', start + M)]); assert.equal(r.trades.length, 0);
console.log(`structural-limit-entry tests passed (${checks} independently audited paths)`);
