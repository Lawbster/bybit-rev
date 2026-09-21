import assert from "assert/strict";
import { contrasts, andKnown, attribution, splitRows, assertAsOf } from "./mfi-recovery-context";
const c = (v: any = {}, hl: any = {}) => ({ values: v, delayedValues: v, hl: { features: hl, quality: { flow15Healthy: true, flow60Healthy: true } },
  hlDelayed: { features: {}, quality: {} }, price: { price: 99, trend: { blocked: true } }, delayedPrice: { price: 98, trend: { blocked: false } } });
assert.equal(andKnown(false, null), null, "Unknown remains explicit even when another condition is false");
const now = c({ m30_mfi14: 15, m60_macdHist: -1, m240_adx: 25, m240_minusDI: 22, m240_plusDI: 10 }, { takerRatio15: .85, takerRatio60: .9 });
const first = c({ m30_mfi14: 18, m60_macdHist: -2 }); first.price.price = 100;
const primary = contrasts(now, first, now, { healthy: true, broken: true });
assert.equal(primary.C2, true); assert.equal(primary.C4, true); assert.equal(primary.C6, true); assert.equal(primary.C7, true); assert.equal(primary.C10, true);
assert.equal(primary.C11, null); assert.equal(primary.C12, null);
const delayed = contrasts(now, first, now, { healthy: false }, true);
assert.equal(delayed.C1, false); assert.equal(delayed.C5, null); assert.equal(delayed.C6, null);
now.values.m30_mfi14 = 19; assert.equal(contrasts(now, first, now, { healthy: true, broken: false }).C4, false);
assert.throws(() => assertAsOf({ nested: [{ availableAt: 101 }] }, 100)); assert.equal(assertAsOf({ sourceEnd: 99 }, 100), 1);
const xs = [
  { id: 1, selected: true, delta: 100, baselineOutcome: { pnl: -200 }, halfOutcome: { pnl: -100 }, flag: true },
  { id: 2, selected: true, delta: -50, baselineOutcome: { pnl: -20 }, halfOutcome: { pnl: -70 }, flag: false },
  { id: 3, selected: true, delta: -30, baselineOutcome: { pnl: 10 }, halfOutcome: { pnl: -20 }, flag: null },
  { id: 4, selected: false, delta: null, baselineOutcome: { pnl: 90 }, halfOutcome: { pnl: 90 }, flag: true },
].map(x => ({ ...x, model: "test", iso: "2026-06-01", flags: { primary: { C1: x.flag }, source60: { C1: x.flag } } }));
const a = attribution(xs); assert.equal(a.observations, 4); assert.equal(a.selected, 3); assert.equal(a.balance, 20);
assert.equal(a.harmful, 2); assert.equal(a.harmfulDespiteBaselineLoss, 1, "A future loser can be a bad early exit");
const splits = splitRows(xs, [{ id: "C1", name: "test" }]); assert.equal(splits.length, 4);
assert.equal(splits[0].flagged.balance, 100); assert.equal(splits[0].unknown.balance, -30); assert.equal(splits[0].unflagged.balance, -50);
const withFutureLabel = { ...now, outcome: { pnl: 1e9 }, delta: -1e9 };
assert.deepEqual(contrasts(withFutureLabel, first, now, { healthy: false }), contrasts(now, first, now, { healthy: false }));
console.log("F03 context/label separation, unknowns, timing and contribution tests passed");
