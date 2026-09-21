import assert from "assert/strict";
import { M, buildRejectionGroups, type Candle, type HighEvidence } from "./high-touch-rejection-signals";
const T = 1_800_000_000_000;
function c(i: number, close = 100, high = 101, low = 99, open = 100): Candle { return { ts: T + i * M, endTs: T + (i + 1) * M, open, high, low, close, volume: 1, turnover: 1 }; }
function a(id: string, i: number, high = 100): HighEvidence { const x = c(i); return { id, kind: "exact_touch", at: x.endTs + M, observationStart: x.ts, observationEnd: x.endTs, sourceStart: x.ts - 2880 * M, sourceEnd: x.ts - M, referenceAvailableAt: x.ts, high, open: x.open, low: x.low, observedHigh: x.high, close: x.close, distancePct: 0 }; }
function evidence(cs: Candle[], id: string, i: number, high: number): HighEvidence { const x = cs[i]; return { ...a(id, i, high), open: x.open, low: x.low, observedHigh: x.high, close: x.close }; }
function group(cs: Candle[], as: HighEvidence[], id: string) { return buildRejectionGroups(cs, as).find(x => x.id === id)!; }
// suffix changes cannot alter a receipt/R; first recross, equality and inclusive deadline are exact.
const cs = Array.from({ length: 25 }, (_, i) => c(i)); cs[2] = c(2, 101, 102); cs[3] = c(3, 100); cs[4] = c(4, 99); cs[7] = c(7, 99);
const x = a("z", 2); x.high = 100; x.close = 101; x.observedHigh = 102; const fb = group(cs, [x], "failed_break_5m").decisions[0]; assert.equal(fb.at, cs[4].endTs + M); assert.equal(fb.close, 99);
assert.equal(group(cs, [x], "close_back").decisions[0].status, "not_qualified");
const y = a("a", 7); y.close = 99; y.high = 100; const poison = group(cs, [y], "confirm_5m"); assert.equal(poison.decisions[0].sourceStart! >= y.at, true); assert.equal(poison.decisions[0].at, Math.ceil(y.at / (5 * M)) * 5 * M + 6 * M);
const p = cs.slice(0, 9); assert.equal(group(p, [y], "wait_5m").decisions[0].status, "censored"); assert.equal(group(cs, [y], "wait_5m").decisions[0].status, "emitted");
const changedHigh = cs.map(q => ({ ...q })); changedHigh[20].high = 1000; assert.deepEqual(group(changedHigh, [x], "failed_break_5m").signals, group(cs, [x], "failed_break_5m").signals);
const late = cs.map(q => ({ ...q })); for (let i = 3; i < 7; i++) late[i] = c(i, 100); late[7] = c(7, 99); assert.equal(group(late, [x], "failed_break_5m").decisions[0].at, late[7].endTs + M);
const expired = Array.from({ length: 12 }, (_, i) => c(i)); expired[2] = c(2, 101, 102); for (let i = 3; i < 8; i++) expired[i] = c(i, 100); expired[8] = c(8, 99);
const ex = evidence(expired, "expiry", 2, 100); const missed = group(expired, [ex], "failed_break_5m").decisions[0]; assert.equal(missed.status, "not_qualified"); assert.equal(missed.sourceEnd, expired[7].endTs); assert.equal(missed.close, 100);
const cutoff = group(expired.slice(0, 7), [ex], "failed_break_5m").decisions[0]; assert.equal(cutoff.status, "censored"); assert.equal(cutoff.sourceEnd, expired[6].endTs);
const zc = cs.slice(); zc[6] = c(6, 100, 100, 100); const zero = a("zero", 6); zero.high = 101; zero.close = 100; zero.open = 100; zero.observedHigh = 100; zero.low = 100; assert.equal(group(zc, [zero], "wick_reject").decisions[0].status, "not_qualified");
const d1 = a("b", 7); d1.close = 99; const d2 = a("a", 7); d2.close = 99; const dd = group(cs, [d1, d2], "wait_5m"); assert.equal(dd.signals.length, 1); assert.equal(dd.signals[0].id, "a"); assert.equal(dd.decisions[0].winnerId, "a");
const gap = cs.slice(); gap.splice(6, 1); assert.throws(() => buildRejectionGroups(gap, [x]), /continuous minutes/);
// Every group has an eligible receipt before this prefix cutoff.  Future highs,
// including one during the recross watch, cannot revise frozen references/receipts.
const all = Array.from({ length: 80 }, (_, i) => c(i)); all[10] = c(10, 99, 102, 98); all[19] = c(19, 99); all[29] = c(29, 99); all[30] = c(30, 101, 102); all[31] = c(31, 99);
const anchors = [evidence(all, "reject", 10, 100), evidence(all, "break", 30, 100)];
const full = buildRejectionGroups(all, anchors), prefix = buildRejectionGroups(all.slice(0, 70), anchors);
assert.equal(full.length, 10); for (const g of full) { assert(g.signals.length > 0, `${g.id} emitted`); assert.deepEqual(prefix.find(x => x.id === g.id)!.signals, g.signals, `${g.id} prefix`); }
const watchHigh = all.map(q => ({ ...q })); watchHigh[31].high = 1000; const suffixHigh = all.map(q => ({ ...q })); suffixHigh[70].high = 1000;
for (const changed of [watchHigh, suffixHigh]) assert.deepEqual(buildRejectionGroups(changed, anchors).map(g => g.signals), full.map(g => g.signals));
console.log("high-touch-rejection tests passed");
