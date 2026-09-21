import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import { computeResearchFeatures } from "../src/research/indicator-features";
import { runStandalone, type FeatureBar, type StandaloneOptions } from "./indicator-standalone-engine";
import { runRsiStandalone, rsiEntrySignal, type RsiRule } from "./rsi-standalone-engine";
const M = 60_000, H = 60 * M, T = Date.UTC(2026, 7, 1), TF = [5 * M, 15 * M, 30 * M, H, 4 * H];
let groups = 0;
const test = (name: string, fn: () => void) => { fn(); groups++; console.log(`PASS ${name}`); };
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function rule(tf = H, upper = 70, mode: RsiRule["mode"] = "back_out", side: RsiRule["side"] = "long",
  exit: RsiRule["exit"] = "fixed12h"): RsiRule {
  return { id: "fixture", family: "rsi_extreme", timeframeMs: tf, upper, mode, side, exit };
}
function features(values: Array<number | null>, tf = H): FeatureBar[] {
  return values.map((rsi14, i) => { const at = T + (i - 2) * tf;
    return { candle: { timestamp: at, open: 100, high: 101, low: 99, close: 100, volume: 10, turnover: 1000 },
      feature: { timestamp: at, rsi14, crsi: null, roc5: null, atr14: null, atrPct: null, adx14: null,
        plusDI14: null, minusDI14: null, vwapUtcDay: null, rvol20: null }, barEnd: at + tf, availableAt: at + tf }; });
}
function tape(count: number, f: (i: number) => Partial<Candle> = () => ({})): Candle[] {
  return Array.from({ length: count }, (_, i) => { const over = f(i), open = over.open ?? 100, close = over.close ?? open;
    return { timestamp: T + i * M, open, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1,
      close, volume: 10, turnover: open * 10, ...over }; });
}
const opts = (count: number, delayMs = 0): StandaloneOptions => ({ start: T, end: T + count * M, delayMs,
  notional: 1000, equity: 10000, feeRate: .001, holdMs: 12 * H });

test("all 200 extreme definitions preserve inclusive entry and strict recovery boundaries", () => {
  let n = 0;
  for (const tf of TF) for (const u of [60, 70, 80, 90, 95]) for (const mode of ["into", "back_out"] as const)
    for (const side of ["long", "short"] as const) for (const exit of ["fixed12h", "indicator_or12h"] as const) {
      const r = rule(tf, u, mode, side, exit), level = side === "long" ? 100 - u : u, sign = side === "long" ? 1 : -1;
      const [a, b] = mode === "into" ? features([level + sign, level], tf) : features([level, level + sign], tf);
      assert(rsiEntrySignal(r, a, b)); assert(!rsiEntrySignal(r, a, { ...b, feature: { ...b.feature, rsi14: a.feature.rsi14 } }));
      n++;
    }
  assert.equal(n, 200);
});
test("ten RSI50 center rules are trend-following, not contrarian extremes", () => {
  for (const tf of TF) for (const side of ["long", "short"] as const) {
    const r = { ...rule(tf, 50, "back_out", side), family: "rsi_center" as const };
    const fs = features(side === "long" ? [50, 51] : [50, 49], tf);
    assert(rsiEntrySignal(r, fs[0], fs[1]));
    const reverse = features(side === "long" ? [51, 50] : [49, 50], tf);
    assert(!rsiEntrySignal(r, reverse[0], reverse[1]));
  }
});
test("RSI zero is valid; null, range errors, stale and prematurely available features never trigger", () => {
  const r = rule(H, 95, "into"), f = features([6, 0]); assert(rsiEntrySignal(r, f[0], f[1]));
  for (const x of [null, NaN, Infinity, -1, 101]) assert(!rsiEntrySignal(r, f[0], { ...f[1], feature: { ...f[1].feature, rsi14: x } }));
  assert(!rsiEntrySignal(r, undefined, f[1]));
  assert(!rsiEntrySignal(r, { ...f[0], barEnd: f[0].barEnd - H }, f[1]));
  assert(!rsiEntrySignal(r, f[0], { ...f[1], availableAt: f[1].barEnd - 1 }));
});
test("Wilder14 output agrees with independently weighted recurrence on every declared timeframe", () => {
  for (const tf of TF) {
    const cs = Array.from({ length: 150 }, (_, i) => { const close = 100 + Math.sin(i * .71) * 4 + Math.cos(i * .13) * 2;
      return { timestamp: T + i * tf, open: close, high: close + 1, low: close - 1, close, volume: 10, turnover: close * 10 }; });
    const fs = computeResearchFeatures(cs, tf), gains = cs.slice(1).map((c, i) => Math.max(0, c.close - cs[i].close)),
      losses = cs.slice(1).map((c, i) => Math.max(0, cs[i].close - c.close));
    for (let i = 0; i < cs.length; i++) {
      if (i < 14) { assert.equal(fs[i].rsi14, null); continue; }
      const weighted = (xs: number[]) => {
        let v = xs.slice(0, 14).reduce((a, b) => a + b, 0) / 14 * (13 / 14) ** (i - 14);
        for (let j = 14; j < i; j++) v += xs[j] / 14 * (13 / 14) ** (i - j - 1);
        return v;
      };
      const g = weighted(gains), l = weighted(losses); near(fs[i].rsi14!, g + l === 0 ? 50 : 100 * g / (g + l));
    }
    assert.deepEqual(computeResearchFeatures(cs.slice(0, 70), tf), fs.slice(0, 70));
  }
});
test("all four hourly70 recovery rules and two clocks preserve exact I01 paths at both delays", () => {
  const cs = tape(36 * 60 + 3, i => ({ open: 100 + Math.sin(i / 50) * 5 }));
  const fs = features(Array.from({ length: 40 }, (_, i) => [20, 35, 60, 80, 65, 40][i % 6]));
  for (const side of ["long", "short"] as const) for (const delay of [0, M]) {
    for (const exit of ["fixed12h", "indicator_or12h"] as const) {
      const old = runStandalone(cs, fs, { id: "old", family: "rsi_recovery", side, exit }, opts(cs.length, delay));
      const current = runRsiStandalone(cs, fs, rule(H, 70, "back_out", side, exit), opts(cs.length, delay));
      const { rule: a, ...aa } = old, { rule: b, ...bb } = current; assert.deepEqual(aa, bb);
    }
    const old = runStandalone(cs, fs, { id: "clock", family: "clock", side, exit: "fixed12h" }, opts(cs.length, delay));
    const current = runRsiStandalone(cs, fs, { ...rule(H, 50, "back_out", side), family: "clock" }, opts(cs.length, delay));
    const { rule: a, ...aa } = old, { rule: b, ...bb } = current; assert.deepEqual(aa, bb);
  }
});
test("neutral exit uses selected completed clock, strictly after entry, inclusive50 and actual delayed open", () => {
  for (const tf of TF) for (const delay of [0, M]) for (const side of ["long", "short"] as const) {
    const count = tf / M + 3, fs = features(side === "long" ? [20, 60, 50] : [80, 40, 50], tf);
    const cs = tape(count, i => ({ open: i === tf / M + delay / M ? 110 : 100 }));
    const out = runRsiStandalone(cs, fs, rule(tf, 70, "back_out", side, "indicator_or12h"), opts(count, delay));
    assert.equal(out.trades.length, 1); const t = out.trades[0];
    assert.equal(t.entryAt, T + delay); assert.equal(t.exitDecisionAt, T + tf); assert.equal(t.exitAt, T + tf + delay);
    assert.equal(t.exitPrice, 110); assert.equal(t.reason, "indicator");
    near(t.pricePnl, side === "long" ? 100 : -100); near(t.fees, 2.1);
  }
});
test("timeout wins ties and a pending neutral exit cannot be cancelled by a new oscillator value", () => {
  const n = 12 * 60 + 3, fs = features([20, 35, ...Array(11).fill(35), 50]);
  const r = rule(H, 70, "back_out", "long", "indicator_or12h");
  assert.equal(runRsiStandalone(tape(n), fs, r, opts(n)).trades[0].reason, "timeout");
  const r5 = rule(5 * M, 70, "back_out", "long", "indicator_or12h"), vals = features([20, 35, 50, 10], 5 * M);
  const out = runRsiStandalone(tape(12), vals, r5, opts(12, M)); assert.equal(out.trades[0].exitAt, T + 6 * M);
});
test("early neutral exits permit only fresh crosses; no occupied signal backlog", () => {
  const fs = features([20, 35, 20, 35, 50, 20, 35], 5 * M), r = rule(5 * M, 70, "back_out", "long", "indicator_or12h");
  const out = runRsiStandalone(tape(26), fs, r, opts(26));
  assert.equal(out.stats.rawSignals, 3); assert.equal(out.stats.skippedOccupied, 1);
  assert.equal(out.trades[0].exitAt, T + 15 * M); assert.equal(out.open!.entryAt, T + 25 * M);
});
test("empty extreme samples remain zero trades; terminal pending does not fabricate fills", () => {
  const r = rule(5 * M, 95, "into"), f = features([50, 50, 50], 5 * M);
  assert.equal(runRsiStandalone(tape(5), f, r, opts(5)).stats.net, 0);
  const pending = runRsiStandalone(tape(1), features([6, 5], 5 * M), r, opts(1, M));
  assert.equal(pending.stats.pendingAtEnd, true); assert.equal(pending.open, null); assert.equal(pending.trades.length, 0);
});
test("future features/candle extremes cannot alter prefix output; invalid tape/grid fails", () => {
  const cs = tape(61), fs = features([20, 35, 55, 20, 35, 55], 15 * M), r = rule(15 * M, 70, "back_out", "long", "indicator_or12h");
  assert.deepEqual(runRsiStandalone(cs, fs, r, opts(30)), runRsiStandalone(cs.slice(0, 30), fs.filter(f => f.barEnd <= T + 30 * M), r, opts(30)));
  assert.throws(() => runRsiStandalone(cs.filter((_, i) => i !== 10), fs, r, opts(cs.length)));
  assert.throws(() => runRsiStandalone(cs, fs, { ...r, upper: 75 }, opts(cs.length)));
  assert.throws(() => runRsiStandalone(cs, fs, { ...r, timeframeMs: 86400000 }, opts(cs.length)));
});
console.log(`RSI standalone tests passed (${groups} groups; 210 definitions, math, causality, I01 parity)`);
