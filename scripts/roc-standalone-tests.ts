import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import { computeResearchFeatures } from "../src/research/indicator-features";
import { runStandalone, type FeatureBar, type StandaloneOptions } from "./indicator-standalone-engine";
import { computeRocValues, rocEntrySignal, rocExitSignal, runRocStandalone, type RocRule, type RocFeatureBar } from "./roc-standalone-engine";
const M = 60_000, H = 60 * M, T = Date.UTC(2026, 7, 1), TF = [5 * M, 15 * M, 30 * M, H, 4 * H];
let groups = 0;
const test = (name: string, fn: () => void) => { fn(); groups++; console.log(`PASS ${name}`); };
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function rule(tf = H, lag = 5, m = 0, mode: RocRule["mode"] = "momentum",
  side: RocRule["side"] = "long", exit: RocRule["exit"] = "fixed12h"): RocRule {
  return { id: "fixture", family: "roc", timeframeMs: tf, lookbackBars: lag, magnitudePct: m, mode, side, exit };
}
function features(values: Array<number | null>, tf = H, period = 5): RocFeatureBar[] {
  return values.map((roc, i) => { const timestamp = T + (i - 2) * tf;
    return { candle: { timestamp, open: 100, high: 101, low: 99, close: 100, volume: 10, turnover: 1000 },
      feature: { timestamp, roc, rocLookbackBars: period, roc5: period === 5 ? roc : null,
        rsi14: null, crsi: null, atr14: null, atrPct: null, adx14: null, plusDI14: null,
        minusDI14: null, vwapUtcDay: null, rvol20: null }, barEnd: timestamp + tf, availableAt: timestamp + tf }; });
}
function tape(count: number, f: (i: number) => Partial<Candle> = () => ({})): Candle[] {
  return Array.from({ length: count }, (_, i) => { const over = f(i), open = over.open ?? 100, close = over.close ?? open;
    return { timestamp: T + i * M, open, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1,
      close, volume: 10, turnover: open * 10, ...over }; });
}
const opts = (n: number, delayMs = 0): StandaloneOptions => ({ start: T, end: T + n * M, delayMs,
  notional: 1000, equity: 10000, feeRate: .001, holdMs: 12 * H });
const legacyFeature = (f: RocFeatureBar["feature"]) => { const { roc, rocLookbackBars, ...old } = f; return old; };

test("all600 definitions preserve exact signs, magnitude and equality boundaries", () => {
  let n = 0;
  for (const tf of TF) for (const lag of [1, 5, 12]) for (const m of [0, 1, 2, 4])
    for (const mode of (m === 0 ? ["momentum"] : ["momentum", "into", "back_out"]) as RocRule["mode"][])
      for (const side of ["long", "short"] as const) for (const exit of ["fixed12h", "indicator_or12h"] as const) {
        const r = rule(tf, lag, m, mode, side, exit), sign = side === "long" ? 1 : -1;
        const signed = mode === "momentum" ? [m, m + .5] : mode === "into" ? [-m + .5, -m] : [-m, -m + .5];
        const f = features(signed.map(x => sign * x), tf, lag);
        assert(rocEntrySignal(r, f[0], f[1]));
        assert(!rocEntrySignal(r, f[0], { ...f[1], feature: { ...f[1].feature, roc: f[0].feature.roc } as RocFeatureBar["feature"] }));
        if (mode !== "into") {
          const equality = features([sign * (mode === "momentum" ? m - .5 : -m - .5), sign * (mode === "momentum" ? m : -m)], tf, lag);
          assert(!rocEntrySignal(r, equality[0], equality[1]));
        }
        n++;
      }
  assert.equal(n, 600);
});
test("ROC math: N+1 closes, percent units, independent difference formula and exact ROC5 identity", () => {
  for (const tf of TF) for (const n of [1, 5, 12]) {
    const cs = Array.from({ length: 70 }, (_, i) => {
      const close = 50 + i * .15 + Math.sin(i * .79) * 4;
      return { timestamp: T + i * tf, open: close, high: close + 1, low: close - 1, close, volume: 10, turnover: close * 10 };
    });
    const values = computeRocValues(cs, tf, n);
    for (let i = 0; i < cs.length; i++) {
      if (i < n) assert.equal(values[i], null);
      else near(values[i]!, (cs[i].close - cs[i - n].close) / cs[i - n].close * 100);
    }
    if (n === 5) assert.deepEqual(values, computeResearchFeatures(cs, tf).map(x => x.roc5));
    assert.deepEqual(computeRocValues(cs.slice(0, 30), tf, n), values.slice(0, 30));
  }
});
test("ROC crossing can come from changing denominator while numerator price remains flat", () => {
  const prices = [110, 90, 100, 100, 100, 100, 100];
  const cs = prices.map((close, i) => ({ timestamp: T + i * H, close }));
  const values = computeRocValues(cs, H, 5);
  near(values[5]!, -100 / 11); near(values[6]!, 100 / 9);
  assert.equal(cs[5].close, cs[6].close);
  const f = features(values.slice(5), H, 5); assert(rocEntrySignal(rule(), f[0], f[1]));
});
test("zero and unbounded positive ROC valid; null/nonfinite/impossible/stale/mismatched lookback fails closed", () => {
  const r = rule(H, 5, 1, "back_out"), f = features([-2, 0]);
  assert(rocEntrySignal(r, f[0], f[1]));
  for (const roc of [null, NaN, Infinity, -100, -101]) assert(!rocEntrySignal(r, f[0], { ...f[1], feature: { ...f[1].feature, roc } as RocFeatureBar["feature"] }));
  const hot = features([3, 1000]); assert(rocEntrySignal(rule(H, 5, 4, "into", "short"), hot[0], hot[1]));
  assert(!rocEntrySignal(r, undefined, f[1]));
  assert(!rocEntrySignal(r, f[0], { ...f[1], availableAt: f[1].barEnd - 1 }));
  assert(!rocEntrySignal(r, { ...f[0], barEnd: f[0].barEnd - H }, f[1]));
  assert(!rocEntrySignal(r, f[0], { ...f[1], feature: { ...f[1].feature, rocLookbackBars: 12 } as RocFeatureBar["feature"] }));
});
test("gaps, duplicate/out-of-order timestamps, zero prices and undeclared periods are rejected", () => {
  const cs = Array.from({ length: 20 }, (_, i) => ({ timestamp: T + i * H, close: 100 }));
  assert.throws(() => computeRocValues(cs.filter((_, i) => i !== 5), H, 5));
  assert.throws(() => computeRocValues([...cs, cs[19]], H, 5));
  assert.throws(() => computeRocValues(cs.map((c, i) => ({ ...c, close: i === 10 ? 0 : c.close })), H, 5));
  assert.throws(() => computeRocValues(cs, H, 7)); assert.throws(() => computeRocValues(cs, 86400000, 5));
  assert(computeRocValues(cs, H, 12).slice(12).every(x => x === 0));
});
test("four original hourly ROC5 zero-cross rules and clocks retain exact old accounting/trade paths", () => {
  const cs = tape(36 * 60 + 3, i => ({ open: 100 + Math.sin(i / 50) * 5 }));
  const fs = features(Array.from({ length: 40 }, (_, i) => [-2, 1, 3, -1, -3, 0][i % 6]));
  const oldFs: FeatureBar[] = fs.map(f => ({ ...f, feature: legacyFeature(f.feature) }));
  for (const side of ["long", "short"] as const) for (const delay of [0, M]) {
    for (const exit of ["fixed12h", "indicator_or12h"] as const) {
      const old = runStandalone(cs, oldFs, { id: "old", family: "roc_cross", side, exit }, opts(cs.length, delay));
      const fresh = runRocStandalone(cs, fs, rule(H, 5, 0, "momentum", side, exit), opts(cs.length, delay));
      assert.deepEqual(fresh.stats, old.stats); assert.deepEqual(fresh.monthly, old.monthly); assert.deepEqual(fresh.open, old.open);
      assert.deepEqual(fresh.trades.map(t => ({ ...t, entryFeature: t.entryFeature ? legacyFeature(t.entryFeature as RocFeatureBar["feature"]) : null })), old.trades);
    }
    const old = runStandalone(cs, oldFs, { id: "clock", family: "clock", side, exit: "fixed12h" }, opts(cs.length, delay));
    const fresh = runRocStandalone(cs, oldFs, { ...rule(H, 5, 0, "momentum", side), family: "clock" }, opts(cs.length, delay));
    const { rule: aa, ...a } = old, { rule: bb, ...b } = fresh; assert.deepEqual(a, b);
  }
});
test("momentum zero reversal and fade zero recovery exits are opposite, subsequent, inclusive and delayed", () => {
  for (const tf of TF) for (const lag of [1, 5, 12]) for (const delay of [0, M])
    for (const mode of ["momentum", "into", "back_out"] as const) for (const side of ["long", "short"] as const) {
      const sign = side === "long" ? 1 : -1, vals = mode === "momentum" ? [0, 2, 0] : mode === "into" ? [0, -2, 0] : [-2, -.5, 0];
      const f = features(vals.map(v => sign * v), tf, lag), r = rule(tf, lag, 1, mode, side, "indicator_or12h"), count = tf / M + 3;
      const cs = tape(count, i => ({ open: i === tf / M + delay / M ? 110 : 100 }));
      const out = runRocStandalone(cs, f, r, opts(count, delay));
      assert.equal(out.trades.length, 1); const t = out.trades[0];
      assert.equal(t.entryAt, T + delay); assert.equal(t.exitDecisionAt, T + tf); assert.equal(t.exitAt, T + tf + delay);
      assert.equal(t.exitPrice, 110); assert.equal(t.reason, "indicator"); near(t.pricePnl, sign * 100); near(t.fees, 2.1);
      const fSignedPositive = { ...f[2], feature: { ...f[2].feature, roc: sign } };
      assert.equal(rocExitSignal(r, fSignedPositive), mode !== "momentum");
    }
});
test("recovery jumping past zero cannot exit on the entry-time feature", () => {
  const fs = features([-2, 2, 1], 5 * M), r = rule(5 * M, 5, 1, "back_out", "long", "indicator_or12h");
  const out = runRocStandalone(tape(7), fs, r, opts(7));
  assert.equal(out.trades[0].entryAt, T); assert.equal(out.trades[0].exitAt, T + 5 * M);
});
test("timeout priority; pending signal exit is immutable even if momentum returns", () => {
  const fs = features([-2, -.5, ...Array(11).fill(-.5), 0]), r = rule(H, 5, 1, "back_out", "long", "indicator_or12h");
  assert.equal(runRocStandalone(tape(12 * 60 + 3), fs, r, opts(12 * 60 + 3)).trades[0].reason, "timeout");
  const small = features([-2, -.5, 0, -2], 5 * M), r5 = rule(5 * M, 5, 1, "back_out", "long", "indicator_or12h");
  assert.equal(runRocStandalone(tape(12), small, r5, opts(12, M)).trades[0].exitAt, T + 6 * M);
});
test("fresh-cross rearm, occupied skips and cutoff pending entries/exits", () => {
  const r = rule(5 * M, 5, 1, "back_out", "long", "indicator_or12h");
  const out = runRocStandalone(tape(26), features([-2, -.5, -2, -.5, 0, -2, -.5], 5 * M), r, opts(26));
  assert.equal(out.stats.rawSignals, 3); assert.equal(out.stats.skippedOccupied, 1);
  assert.equal(out.trades[0].exitAt, T + 15 * M); assert.equal(out.open!.entryAt, T + 25 * M);
  const pending = runRocStandalone(tape(1), features([-2, -.5], 5 * M), r, opts(1, M));
  assert.equal(pending.stats.pendingAtEnd, true); assert.equal(pending.open, null); assert.equal(pending.trades.length, 0);
  const pe = runRocStandalone(tape(6), features([-2, -.5, 0], 5 * M), r, opts(6, M));
  assert.equal(pe.stats.pendingAtEnd, true); assert(pe.open); assert.equal(pe.trades.length, 0);
});
test("future prefixes, altered execution-minute extremes and unrelated indicators cannot change decisions", () => {
  const cs = tape(61), fs = features([-2, -.5, 1, -2, -.5, 1], 15 * M), r = rule(15 * M, 5, 1, "back_out", "long", "indicator_or12h");
  assert.deepEqual(runRocStandalone(cs, fs, r, opts(30)), runRocStandalone(cs.slice(0, 30), fs.filter(f => f.barEnd <= T + 30 * M), r, opts(30)));
  const mutate = cs.map(c => ({ ...c, high: 1000, low: 1 }));
  const changedFeatures = fs.map(f => ({ ...f, feature: { ...f.feature, rsi14: 100, crsi: 0, roc5: 99, atr14: 50 } }));
  const a = runRocStandalone(cs, fs, r, opts(61)), b = runRocStandalone(mutate, changedFeatures, r, opts(61));
  const identity = (x: typeof a) => x.trades.map(({ entryFeature, ...t }) => t);
  assert.deepEqual(identity(a), identity(b)); assert.deepEqual(a.open, b.open);
  assert.throws(() => runRocStandalone(cs, fs, { ...r, lookbackBars: 12 }, opts(61)));
  assert.throws(() => runRocStandalone(cs.filter((_, i) => i !== 10), fs, r, opts(61)));
  assert.throws(() => runRocStandalone(cs, fs, { ...r, magnitudePct: .5 }, opts(61)));
});
console.log(`ROC standalone tests passed (${groups} groups;600 definitions, independent math, causality, I01 parity)`);
