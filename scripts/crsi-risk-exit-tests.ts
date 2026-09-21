import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import type { FeatureBar, StandaloneOptions } from "./indicator-standalone-engine";
import { runCrsiStandalone } from "./crsi-extremes-engine";
import { runCrsiRiskExit, type RiskExitRule } from "./crsi-risk-exit-engine";

const M = 60_000, H = 60 * M, TF = 15 * M, T = Date.UTC(2026, 7, 1);
let groups = 0;
function test(name: string, body: () => void): void { body(); groups++; console.log(`PASS ${name}`); }
function near(a: number, b: number, label: string): void { assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-8, `${label}: ${a} != ${b}`); }
function rule(exitPolicy: RiskExitRule["exitPolicy"] = "baseline12h", entryMode: RiskExitRule["entryMode"] = "back_out"): RiskExitRule {
  return { id: `crsi_15m_95_${entryMode}_long__${exitPolicy}`, entryMode, exitPolicy };
}
function bars(values: Array<number | null>, start = T - 2 * TF): FeatureBar[] {
  return values.map((crsi, i) => {
    const at = start + i * TF;
    return { candle: { timestamp: at, open: 100, high: 101, low: 99, close: 100, volume: 10, turnover: 1000 },
      feature: { timestamp: at, rsi14: 50, crsi, roc5: 0, atr14: 1, atrPct: 1, adx14: 20,
        plusDI14: 10, minusDI14: 10, vwapUtcDay: 100, rvol20: 1 }, barEnd: at + TF, availableAt: at + TF };
  });
}
function minutes(count: number, quote: (i: number) => Partial<Candle> = () => ({})): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const overrides = quote(i), open = overrides.open ?? 100, close = overrides.close ?? open;
    return { timestamp: T + i * M, open, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1,
      close, volume: 10, turnover: open * 10, ...overrides };
  });
}
function options(count: number, delayMs = 0): StandaloneOptions {
  return { start: T, end: T + count * M, delayMs, notional: 1000, equity: 10_000, feeRate: .001, holdMs: 12 * H };
}

test("baseline12h exactly preserves old I02 entries, ledgers, monthly accounting and stats for both entry modes/delays", () => {
  const cs = minutes(48 * 60 + 5, i => ({ open: 100 + Math.sin(i / 70) * 4 + i / 2000 }));
  const pattern = [50, 5, 10, 50, 90, 3, 4, 20, 95, 65];
  const fs = bars(Array.from({ length: 200 }, (_, i) => pattern[i % pattern.length]));
  for (const entryMode of ["into", "back_out"] as const) for (const delay of [0, M]) {
    const previous = runCrsiStandalone(cs, fs, { id: "old", family: "crsi_extreme", side: "long", exit: "fixed12h",
      timeframeMs: TF, upper: 95, mode: entryMode }, options(cs.length, delay));
    const next = runCrsiRiskExit(cs, fs, rule("baseline12h", entryMode), options(cs.length, delay));
    const { rule: oldRule, ...oldBody } = previous, { rule: newRule, ...newBody } = next;
    assert.deepEqual(newBody, oldBody, `${entryMode} ${delay}`);
  }
});

test("all observed stop levels are inclusive and execute at the next available open, not the threshold", () => {
  for (const [policy, level] of [["stop3", 97], ["stop5", 95], ["stop8", 92]] as const) {
    const cs = minutes(3, i => i === 0 ? { low: level, close: 98 } : { open: 80 });
    const result = runCrsiRiskExit(cs, bars([5, 10]), rule(policy), options(cs.length));
    assert.equal(result.trades.length, 1); const trade = result.trades[0];
    assert.equal(trade.entryAt, T); assert.equal(trade.exitDecisionAt, T + M); assert.equal(trade.exitAt, T + M);
    assert.equal(trade.exitPrice, 80); assert.notEqual(trade.exitPrice, level); assert.equal(trade.reason, "observed_stop");
    near(trade.pricePnl, -200, "actual gap loss is not capped at nominal stop percent");
    near(trade.fees, 1.8, "fees use entry1000 and exit800 notionals"); near(trade.net, -201.8, "after-fee gap loss");
  }
});

test("a barely missed stop does not fire, while an observed prior low still triggers after rebound", () => {
  const clear = runCrsiRiskExit(minutes(3, () => ({ low: 97.0001 })), bars([5, 10]), rule("stop3"), options(3));
  assert.equal(clear.trades.length, 0); assert.ok(clear.open);
  const cs = minutes(3, i => i === 0 ? { low: 97, close: 100 } : { open: 110 });
  const rebound = runCrsiRiskExit(cs, bars([5, 10]), rule("stop3"), options(3));
  assert.equal(rebound.trades[0].exitPrice, 110); assert.equal(rebound.trades[0].reason, "observed_stop");
  near(rebound.trades[0].net, 97.9, "observed-stop liquidation may be profitable after rebound");
});

test("current minute low cannot trigger early; delayed entry ignores lows before the position existed", () => {
  for (const delay of [0, M]) {
    const cs = minutes(5, i => i === 0 ? { low: delay ? 50 : 99 } : i === 1 ? { low: 97 } : i === 3 ? { open: 80 } : {});
    const result = runCrsiRiskExit(cs, bars([5, 10]), rule("stop3"), options(cs.length, delay));
    assert.equal(result.trades[0].entryAt, T + delay);
    assert.equal(result.trades[0].exitDecisionAt, T + 2 * M, "only the now-closed entry/held minute low is visible");
    assert.equal(result.trades[0].exitAt, T + 2 * M + delay);
  }
});

test("pending observed stop is not cancelled by recovery or replaced by later candles", () => {
  const cs = minutes(5, i => i === 1 ? { low: 97 } : i === 2 ? { open: 120, low: 119 } : i === 3 ? { open: 125 } : {});
  const r = runCrsiRiskExit(cs, bars([5, 10]), rule("stop3"), options(cs.length, M));
  assert.equal(r.trades[0].exitDecisionAt, T + 2 * M); assert.equal(r.trades[0].exitAt, T + 3 * M);
  assert.equal(r.trades[0].exitPrice, 125); assert.equal(r.trades[0].reason, "observed_stop");
});

test("stop has priority over simultaneous timeout and timeout has priority over simultaneous CRSI exit", () => {
  const count = 12 * 60 + 3;
  const cs = minutes(count, i => i === 12 * 60 - 1 ? { low: 97 } : {});
  const stop = runCrsiRiskExit(cs, bars([5, 10]), rule("stop3"), options(count));
  assert.equal(stop.trades[0].exitDecisionAt, T + 12 * H); assert.equal(stop.trades[0].reason, "observed_stop");
  const values = [5, 10, ...Array(47).fill(10), 90];
  for (const policy of ["crsi50", "crsi80"] as const) {
    const timeout = runCrsiRiskExit(minutes(count), bars(values), rule(policy), options(count));
    assert.equal(timeout.trades[0].exitDecisionAt, T + 12 * H); assert.equal(timeout.trades[0].reason, "timeout");
  }
});

test("timeout6h measures six hours from actual fill and delays its exit too", () => {
  for (const delay of [0, M]) {
    const count = 6 * 60 + 3, cs = minutes(count);
    const result = runCrsiRiskExit(cs, bars([5, 10]), rule("timeout6h"), options(count, delay));
    assert.equal(result.trades.length, 1); assert.equal(result.trades[0].entryAt, T + delay);
    assert.equal(result.trades[0].exitDecisionAt, T + delay + 6 * H);
    assert.equal(result.trades[0].exitAt, T + 2 * delay + 6 * H); assert.equal(result.trades[0].reason, "timeout");
  }
});

test("CRSI exits use inclusive completed15m thresholds and cannot close on their entry decision", () => {
  for (const [policy, threshold] of [["crsi50", 50], ["crsi80", 80]] as const) for (const delay of [0, M]) {
    const count = 32, cs = minutes(count);
    const result = runCrsiRiskExit(cs, bars([5, 10, threshold - .001, threshold]), rule(policy), options(count, delay));
    assert.equal(result.trades.length, 1); assert.equal(result.trades[0].exitDecisionAt, T + 2 * TF);
    assert.equal(result.trades[0].exitAt, T + 2 * TF + delay);
    assert.equal(result.trades[0].reason, "crsi_exit");
    const sameEntry = runCrsiRiskExit(cs, bars([5, 95, 95]), rule(policy), options(count, delay));
    assert.equal(sameEntry.trades[0].exitDecisionAt, T + TF, "entry CRSI already above threshold must wait for a subsequent decision");
  }
});

test("null CRSI does not trigger an indicator exit or act like zero", () => {
  const count = 47, result = runCrsiRiskExit(minutes(count), bars([5, 10, null, 0, 50]), rule("crsi50"), options(count));
  assert.equal(result.trades[0].exitDecisionAt, T + 3 * TF);
});

test("early exits change subsequent paths only when a genuinely fresh CRSI entry cross occurs", () => {
  const cs = minutes(61), fs = bars([5, 10, 60, 5, 10, 20]);
  const result = runCrsiRiskExit(cs, fs, rule("crsi50"), options(cs.length));
  assert.equal(result.trades.length, 1); assert.equal(result.trades[0].exitAt, T + TF);
  assert.ok(result.open); assert.equal(result.open.signalAt, T + 3 * TF); assert.equal(result.open.entryAt, T + 3 * TF);
  assert.equal(result.stats.rawSignals, 2); assert.equal(result.stats.skippedOccupied, 0);
  near(result.open.qty * result.open.entryPrice, 1000, "re-entry stays fixed notional");
});

test("terminal pending exits remain unfilled; stop observation at excluded cutoff is not yet a decision", () => {
  const fs = bars([5, 10]);
  const pending = runCrsiRiskExit(minutes(3, i => i === 1 ? { low: 97 } : {}), fs, rule("stop3"), options(3, M));
  assert.equal(pending.trades.length, 0); assert.ok(pending.open); assert.equal(pending.stats.pendingAtEnd, true);
  const notObserved = runCrsiRiskExit(minutes(2, i => i === 1 ? { low: 97 } : {}), fs, rule("stop3"), options(2));
  assert.equal(notObserved.trades.length, 0); assert.ok(notObserved.open); assert.equal(notObserved.stats.pendingAtEnd, false);
});

test("future price/CRSI changes cannot alter earlier completed stop decisions or fills", () => {
  const count = 61, cs = minutes(count, i => i === 0 ? { low: 97 } : {}), fs = bars([5, 10, 20, 20, 20, 20]);
  const r = rule("stop3"), short = runCrsiRiskExit(cs.slice(0, 15), fs.slice(0, 2), r, options(15));
  const future = cs.map((c, i) => i < 15 ? c : { ...c, open: 999_999, high: 1_000_000, low: 1, close: 500_000 });
  const features = fs.map(f => f.barEnd <= T + TF ? f : { ...f, feature: { ...f.feature, crsi: f.barEnd % (2 * TF) ? 0 : 100 } });
  const full = runCrsiRiskExit(future, features, r, options(count));
  assert.deepEqual(full.trades.filter(t => t.exitAt < T + TF), short.trades);
});

test("malformed source windows and feature provenance fail closed", () => {
  const cs = minutes(61), fs = bars([5, 10, 20]);
  assert.throws(() => runCrsiRiskExit(cs.filter((_, i) => i !== 10), fs, rule(), options(cs.length)));
  assert.throws(() => runCrsiRiskExit(cs, [fs[0], fs[2]], rule(), options(cs.length)));
  assert.throws(() => runCrsiRiskExit(cs, [{ ...fs[0], availableAt: fs[0].barEnd - 1 }, ...fs.slice(1)], rule(), options(cs.length)));
  assert.throws(() => runCrsiRiskExit(cs, [{ ...fs[0], feature: { ...fs[0].feature, timestamp: T } }, ...fs.slice(1)], rule(), options(cs.length)));
});

console.log(`CRSI risk-exit tests passed (${groups} independent groups; causal observed stops, fresh re-entry and I02 overlap)`);
