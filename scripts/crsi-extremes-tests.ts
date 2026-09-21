import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import { runStandalone, type FeatureBar, type StandaloneOptions } from "./indicator-standalone-engine";
import { crsiEntrySignal, runCrsiStandalone, type CrsiRule } from "./crsi-extremes-engine";

const M = 60_000, H = 60 * M, T = Date.UTC(2026, 7, 1);
let groups = 0;
function test(name: string, body: () => void): void { body(); groups++; console.log(`PASS ${name}`); }
function near(a: number, b: number, label: string): void { assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-8, `${label}: ${a} != ${b}`); }
function rule(timeframeMs = H, upper = 80, mode: "into" | "back_out" = "back_out", side: "long" | "short" = "long"): CrsiRule {
  return { id: `crsi_${timeframeMs / M}m_${upper}_${mode}_${side}`, family: "crsi_extreme", side, exit: "fixed12h", timeframeMs, upper, mode };
}
function bar(at: number, tf: number, crsi: number | null): FeatureBar {
  return { candle: { timestamp: at, open: 100, high: 101, low: 99, close: 100, volume: 10, turnover: 1000 },
    feature: { timestamp: at, rsi14: 50, crsi, roc5: 0, atr14: 1, atrPct: 1, adx14: 20,
      plusDI14: 10, minusDI14: 10, vwapUtcDay: 100, rvol20: 1 }, barEnd: at + tf, availableAt: at + tf };
}
function bars(values: Array<number | null>, tf = H, start = T - 2 * tf): FeatureBar[] { return values.map((v, i) => bar(start + i * tf, tf, v)); }
function minutes(count: number, get: (i: number) => number = () => 100): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const price = get(i); return { timestamp: T + i * M, open: price, high: price + 1,
      low: Math.max(0.1, price - 1), close: price, volume: 10, turnover: price * 10 };
  });
}
function options(count: number, delayMs = 0): StandaloneOptions {
  return { start: T, end: T + count * M, delayMs, notional: 1000, equity: 10_000, feeRate: .001, holdMs: 12 * H };
}

test("all 36 frozen definitions have explicit threshold-equality and crossing direction semantics", () => {
  for (const tf of [15 * M, 30 * M, H]) for (const upper of [80, 90, 95]) for (const mode of ["into", "back_out"] as const)
    for (const side of ["long", "short"] as const) {
      const r = rule(tf, upper, mode, side), level = side === "short" ? upper : 100 - upper;
      const intoSign = side === "short" ? 1 : -1;
      const [a, b] = mode === "into" ? [level - intoSign, level] : [level, level - intoSign];
      assert.equal(crsiEntrySignal(r, bar(T - 2 * tf, tf, a), bar(T - tf, tf, b)), true, `${r.id} exact threshold crossing`);
      const touchA = mode === "into" ? level : level + intoSign;
      assert.equal(crsiEntrySignal(r, bar(T - 2 * tf, tf, touchA), bar(T - tf, tf, level)), false, `${r.id} no duplicate threshold touch`);
      const sustained = mode === "into" ? level + intoSign : level - intoSign;
      assert.equal(crsiEntrySignal(r, bar(T - 2 * tf, tf, sustained), bar(T - tf, tf, sustained)), false, `${r.id} sustained state is not crossing`);
      assert.equal(crsiEntrySignal(r, bar(T - 2 * tf, tf, b), bar(T - tf, tf, a)), false, `${r.id} reverse crossing belongs to other mode`);
    }
});

test("zero is a real CRSI level, while absent/nonfinite values and nonadjacent features cannot signal", () => {
  const into = rule(H, 95, "into", "long"), back = rule(H, 95, "back_out", "long");
  assert.equal(crsiEntrySignal(into, bar(T - 2 * H, H, 6), bar(T - H, H, 0)), true);
  assert.equal(crsiEntrySignal(back, bar(T - 2 * H, H, 0), bar(T - H, H, 6)), true);
  for (const tf of [15 * M, 30 * M, H]) {
    const r = rule(tf), previous = bar(T - 2 * tf, tf, 10), current = bar(T - tf, tf, 30);
    assert.equal(crsiEntrySignal(r, undefined, current), false);
    assert.equal(crsiEntrySignal(r, bar(T - 3 * tf, tf, 10), current), false);
    for (const missing of [null, NaN, Infinity]) {
      assert.equal(crsiEntrySignal(r, bar(T - 2 * tf, tf, missing), current), false);
      assert.equal(crsiEntrySignal(r, previous, bar(T - tf, tf, missing)), false);
    }
  }
});

test("engine rejects rules outside the frozen CRSI-only grid", () => {
  const cs = minutes(2), fs = bars([10, 30]);
  for (const invalid of [{ upper: 81 }, { upper: NaN }, { timeframeMs: 5 * M }, { timeframeMs: 0 },
    { mode: "always" }, { family: "rsi" }, { side: "both" }, { exit: "indicator_or12h" }])
    assert.throws(() => runCrsiStandalone(cs, fs, { ...rule(), ...invalid } as CrsiRule, options(cs.length)), /frozen CRSI grid/);
});

test("15m/30m/1h signals use their exact closed boundary and never signal-candle execution prices", () => {
  for (const tf of [15 * M, 30 * M, H]) for (const delay of [0, M]) {
    const cs = minutes(12 * 60 + 3, i => i === 0 ? 100 : i === 1 ? 102 : i >= 12 * 60 ? 110 : 105);
    const fs = bars([10, 30, 95, 5], tf);
    fs[1] = { ...fs[1], candle: { ...fs[1].candle, open: 500, high: 999, low: 1, close: 900 } };
    const result = runCrsiStandalone(cs, fs, rule(tf), options(cs.length, delay));
    assert.equal(result.trades.length, 1); const t = result.trades[0];
    assert.equal(t.signalAt, T); assert.equal(t.entryAt, T + delay); assert.equal(t.entryPrice, delay ? 102 : 100);
    assert.equal(t.exitDecisionAt, t.entryAt + 12 * H); assert.equal(t.exitAt, t.exitDecisionAt + delay);
    assert.equal(t.exitPrice, 110); assert.equal(t.reason, "timeout");
  }
});

test("opposite CRSI movement cannot create an indicator exit or a queued replacement position", () => {
  const cs = minutes(14 * 60), fs = bars([10, 30, 95, 5, 30, ...Array(54).fill(30)], 15 * M);
  const result = runCrsiStandalone(cs, fs, rule(15 * M), options(cs.length));
  assert.equal(result.stats.rawSignals, 2); assert.equal(result.stats.skippedOccupied, 1);
  assert.equal(result.trades.length, 1); assert.equal(result.trades[0].exitAt, T + 12 * H);
  assert.equal(result.trades[0].reason, "timeout"); assert.equal(result.open, null);
});

test("independent long/short price and actual-notional fee accounting", () => {
  for (const side of ["long", "short"] as const) {
    const price = side === "long" ? 110 : 90, cs = minutes(12 * 60 + 1, i => i < 12 * 60 ? 100 : price);
    const fs = bars(side === "long" ? [10, 30] : [90, 70]);
    const result = runCrsiStandalone(cs, fs, rule(H, 80, "back_out", side), options(cs.length));
    const t = result.trades[0]; near(t.qty, 10, "entry quantity"); near(t.pricePnl, 100, "signed price PnL");
    near(t.fees, side === "long" ? 2.1 : 1.9, "actual entry/exit notional fees");
    near(t.net, side === "long" ? 97.9 : 98.1, "after-fee trade PnL"); near(result.stats.net, t.net, "account net");
  }
});

test("new hourly80 back_out and rolling-clock paths exactly match the frozen old engine on synthetic inputs", () => {
  const cs = minutes(48 * 60 + 5, i => 100 + Math.sin(i / 70) * 5 + i / 2000);
  const pattern = [50, 10, 30, 50, 90, 70, 10, 40, 95, 65];
  const fs = bars(Array.from({ length: 52 }, (_, i) => pattern[i % pattern.length]));
  for (const side of ["long", "short"] as const) for (const delay of [0, M]) {
    const old = runStandalone(cs, fs, { id: "old", family: "crsi_recovery", side, exit: "fixed12h" }, options(cs.length, delay));
    const current = runCrsiStandalone(cs, fs, rule(H, 80, "back_out", side), options(cs.length, delay));
    const { rule: oldRule, ...oldBody } = old, { rule: newRule, ...newBody } = current;
    assert.deepEqual(newBody, oldBody, `CRSI legacy overlap ${side} delay${delay}`);
    const oldClock = runStandalone(cs, fs, { id: "clock", family: "clock", side, exit: "fixed12h" }, options(cs.length, delay));
    const newClock = runCrsiStandalone(cs, fs, { ...rule(), id: `clock_${side}`, family: "clock", side }, options(cs.length, delay));
    const { rule: oldClockRule, ...oldClockBody } = oldClock, { rule: newClockRule, ...newClockBody } = newClock;
    assert.deepEqual(newClockBody, oldClockBody, `clock overlap ${side} delay${delay}`);
  }
});

test("cutoff censors pending entry/exit and marks open inventory without inventing a completed trade", () => {
  const fs = bars([10, 30]);
  const pending = runCrsiStandalone(minutes(1), fs, rule(), options(1, M));
  assert.equal(pending.stats.pendingAtEnd, true); assert.equal(pending.open, null); near(pending.stats.net, 0, "unexecuted entry");
  const mark = runCrsiStandalone(minutes(2, i => i ? 110 : 100), fs, rule(), options(2));
  assert.equal(mark.trades.length, 0); assert.ok(mark.open); near(mark.stats.openNet, 97.9, "liquidation mark after both fees");
  near(mark.stats.feesPaid, 1, "only entry fee is paid");
  const count = 12 * 60 + 2, pendingExit = runCrsiStandalone(minutes(count), fs, rule(), options(count, M));
  assert.equal(pendingExit.trades.length, 0); assert.ok(pendingExit.open); assert.equal(pendingExit.stats.pendingAtEnd, true);
});

test("source gaps, wrong timeframe/feature identity and premature/late final availability fail explicitly", () => {
  for (const tf of [15 * M, 30 * M, H]) {
    const cs = minutes(60), fs = bars([10, 30, 50], tf), r = rule(tf);
    assert.throws(() => runCrsiStandalone(cs.filter((_, i) => i !== 10), fs, r, options(cs.length)));
    assert.throws(() => runCrsiStandalone(cs, [fs[0], fs[2]], r, options(cs.length)));
    assert.throws(() => runCrsiStandalone(cs, [fs[0], { ...fs[1], feature: { ...fs[1].feature, timestamp: T } }], r, options(cs.length)));
    for (const delta of [-1, 1]) assert.throws(() => runCrsiStandalone(cs, [fs[0], { ...fs[1], availableAt: fs[1].barEnd + delta }], r, options(cs.length)));
    assert.throws(() => runCrsiStandalone(cs, [{ ...fs[0], barEnd: fs[0].barEnd + M }], r, options(cs.length)));
  }
});

test("future candles and CRSI extremes cannot change earlier completed fills", () => {
  const tf = 15 * M, cs = minutes(26 * 60, i => i < 13 * 60 ? 100 + i / 1000 : i % 2 ? 1_000_000 : 2);
  const fs = bars([10, 30, ...Array(120).fill(30)], tf), r = rule(tf);
  const first = runCrsiStandalone(cs.slice(0, 13 * 60), fs.slice(0, 54), r, options(13 * 60));
  const changed = fs.map(f => f.barEnd <= T + 13 * H ? f : { ...f, feature: { ...f.feature, crsi: f.barEnd % H ? 0 : 100 } });
  const later = runCrsiStandalone(cs, changed, r, options(cs.length));
  assert.deepEqual(later.trades.filter(t => t.exitAt < T + 13 * H), first.trades);
});

console.log(`CRSI extremes tests passed (${groups} independent groups; 36 frozen definitions, accounting and legacy overlap)`);
