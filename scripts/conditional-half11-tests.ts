import assert from "assert/strict";
import { conditionalHalf11 as size, HALF11_VARIANTS as variants, type Half11Input } from "./conditional-half11-policy";
import { LadderIndicatorTape } from "./ladder-indicator-policy";
import { observationAvailability, firstDecisionAt } from "./replay-causality";
const T = Date.UTC(2026, 7, 1), H = 3600000;
const minutes = Array.from({ length: 48 * 60 }, (_, i) => { const p = 150 - i / 600;
  return { timestamp: T + i * 60000, open: p, high: p + 1, low: p - 1, close: p, volume: 10, turnover: p * 10 }; });
const tape = new LadderIndicatorTape(minutes), d: Half11Input = { at: T + 12 * H, nextDepth: 11, requestedNotional: 16000,
  aboveEma200: true, ret12h: 0, hour: tape.at(T + 12 * H), taker15m: .85, taker1h: .9, samples15m: 14, samples1h: 55, takerAgeSec: 90 };
let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log(`PASS ${name}`); }
test("exact five identities, three new overlays", () => assert.equal(variants.length, 5));
test("only eleven changes, no veto or recursive fraction", () => {
  for (const v of variants) for (const nextDepth of [1, 5, 9, 10, 12]) assert.equal(size(v, { ...d, nextDepth, aboveEma200: false }).notional, 16000);
  for (let i = 0; i < 3; i++) assert.equal(size("last11_50", d).notional, 8000);
  assert.equal(size("baseline", { ...d, aboveEma200: false }).notional, 16000);
});
test("structure OR, exact return boundary and unknown disjunct", () => {
  for (const [aboveEma200, ret12h, weak, unknown] of [[true, -2, true, false], [true, -1.999, false, false],
    [false, 5, true, false], [false, null, true, false], [null, -2, true, false], [null, 0, false, true], [true, null, false, true]] as const) {
    const r = size("structure_half11", { ...d, aboveEma200, ret12h }); assert.equal(r.weak, weak); assert.equal(r.unknown, unknown);
  }
});
test("hourly VWAP AND ROC; strict VWAP and inclusive ROC", () => {
  for (const [close, roc5, weak] of [[99, 0, true], [100, -1, false], [99, .01, false], [101, -1, false]] as const) {
    const hour = { ...d.hour!, close, features: { ...d.hour!.features, vwapUtcDay: 100, roc5 } };
    assert.equal(size("vwap_roc_half11", { ...d, hour }).weak, weak);
  }
});
test("unknown, stale, unclosed or invalid hourly inputs do not reduce size", () => {
  for (const hour of [null, { ...d.hour!, availableAt: d.at + 1 }, { ...d.hour!, barEnd: d.at + H },
    { ...d.hour!, barStart: d.hour!.barStart - H }, { ...d.hour!, close: NaN },
    { ...d.hour!, features: { ...d.hour!.features, roc5: null } }]) {
    const r = size("vwap_roc_half11", { ...d, hour }); assert(r.unknown); assert.equal(r.notional, 16000);
  }
});
test("both HL windows required; thresholds and age boundaries", () => {
  assert(size("hl_two_window_half11", d).weak);
  for (const change of [{ taker15m: .851 }, { taker1h: .901 }, { taker15m: .405825, taker1h: 1.53197 }]) {
    assert(!size("hl_two_window_half11", { ...d, ...change }).weak);
  }
  for (const change of [{ samples15m: 13 }, { samples1h: 54 }, { taker15m: null }, { taker1h: NaN },
    { takerAgeSec: 90.001 }, { takerAgeSec: -1 }, { samples15m: NaN }]) {
    const r = size("hl_two_window_half11", { ...d, ...change }); assert(r.unknown); assert.equal(r.notional, 16000);
  }
});
test("hour-boundary and midnight features use only their own closed bars", () => {
  for (const at of [T + 12 * H - 1, T + 12 * H, T + 24 * H, T + 24 * H + 1]) {
    const prefix = minutes.filter(c => c.timestamp + 60000 <= at);
    const c = tape.at(at); assert.deepEqual(c, new LadderIndicatorTape(prefix).at(at));
    assert(c && c.barEnd <= at && c.barStart === Math.floor(at / H) * H - H);
    const today = minutes.filter(m => m.timestamp >= Math.floor(c.barStart / (24 * H)) * 24 * H && m.timestamp + 60000 <= c.barEnd);
    assert(Math.abs(c.features.vwapUtcDay! - today.reduce((s, x) => s + x.turnover, 0) / today.reduce((s, x) => s + x.volume, 0)) < 1e-9);
  }
});
test("delivery lag moves availability, never the event window", () => {
  const row = { timestamp: T, windowEnd: T, buyNotional: 1, sellNotional: 2 };
  const original = observationAvailability(row, "hl_taker"); assert.equal(original, T + 60000);
  for (const lag of [15000, 60000]) {
    const delayed = { ...row, receivedAt: original + lag };
    assert.equal(delayed.windowEnd, T); assert.equal(firstDecisionAt(observationAvailability(delayed, "hl_taker")), T + 120000);
  }
});
console.log(`conditional half11 tests passed (${n} groups)`);
