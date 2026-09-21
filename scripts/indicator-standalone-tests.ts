import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import type { ResearchFeature } from "../src/research/indicator-features";
import { entrySignal, exitSignal, runStandalone, HOUR as H, MINUTE as M,
  type FeatureBar, type StandaloneOptions, type StandaloneRule } from "./indicator-standalone-engine";

// Result-independent fixtures only: no archive reads, research output writes,
// trading imports or thresholds derived from HYPE performance.
const D = 24 * H, T = Date.UTC(2026, 7, 1);
let groups = 0;
function test(name: string, body: () => void): void { body(); groups++; console.log(`PASS ${name}`); }
function near(actual: number, expected: number, label: string, tolerance = 1e-8): void {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual}`);
}
function rule(family: StandaloneRule["family"] = "rsi_recovery", side: "long" | "short" = "long",
  exit: StandaloneRule["exit"] = "fixed12h"): StandaloneRule {
  return { id: `${family}_${side}_${exit}`, family, side, exit };
}
function feature(timestamp: number, change: Partial<ResearchFeature> = {}): ResearchFeature {
  return { timestamp, rsi14: 40, crsi: 40, roc5: 1, atr14: 1, atrPct: 1, adx14: 20,
    plusDI14: 20, minusDI14: 10, vwapUtcDay: 100, rvol20: 1, ...change };
}
function bar(timestamp: number, change: Partial<ResearchFeature> = {}, close = 100): FeatureBar {
  return { candle: { timestamp, open: close, high: close + 1, low: close - 1, close,
    volume: 10, turnover: 10 * close }, feature: feature(timestamp, change),
    barEnd: timestamp + H, availableAt: timestamp + H };
}
function bars(values: number[], start = T - 2 * H): FeatureBar[] {
  return values.map((rsi14, i) => bar(start + i * H, { rsi14 }));
}
function minutes(start: number, count: number, price: (i: number) => number | Partial<Candle> = () => 100): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const quote = price(i), change = typeof quote === "number" ? { open: quote, close: quote } : quote;
    const open = change.open ?? 100, close = change.close ?? open;
    return { timestamp: start + i * M, open, high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1, close, volume: 10, turnover: 10 * open, ...change };
  });
}
function options(count: number, change: Partial<StandaloneOptions> = {}, start = T): StandaloneOptions {
  return { start, end: start + count * M, delayMs: 0, notional: 1000, equity: 10_000,
    feeRate: 0.001, holdMs: 12 * H, ...change };
}

test("entry crossings enforce exact thresholds in both directions and never fire ongoing states", () => {
  for (const [family, field, longAt, shortAt] of [
    ["rsi_recovery", "rsi14", 30, 70], ["crsi_recovery", "crsi", 20, 80], ["roc_cross", "roc5", 0, 0],
  ] as const) for (const side of ["long", "short"] as const) {
    const r = rule(family, side), threshold = side === "long" ? longAt : shortAt, sign = side === "long" ? 1 : -1;
    const previous = bar(T + H, { [field]: threshold }), current = bar(T + 2 * H, { [field]: threshold + sign });
    assert.equal(entrySignal(r, previous, current), true, `${family} ${side} crosses from equality`);
    assert.equal(entrySignal(r, bar(T + H, { [field]: threshold - sign }), bar(T + 2 * H, { [field]: threshold })), false, "touch is not crossing");
    assert.equal(entrySignal(r, bar(T + H, { [field]: threshold + sign }), current), false, "ongoing qualifying level is not new cross");
    assert.equal(entrySignal(r, current, previous), false, "reverse chronology is not contiguous");
    assert.equal(entrySignal(r, undefined, current), false, "must know preceding closed bar");
    for (const missing of [null, NaN]) {
      assert.equal(entrySignal(r, bar(T + H, { [field]: missing }), current), false);
      assert.equal(entrySignal(r, previous, bar(T + 2 * H, { [field]: missing })), false);
    }
  }
});

test("VWAP entries use each bar's own anchor, suppress midnight resets and require contiguous bars", () => {
  const previous = bar(T + H, { vwapUtcDay: 101 }, 100), current = bar(T + 2 * H, { vwapUtcDay: 109 }, 110);
  assert.equal(entrySignal(rule("vwap_cross"), previous, current), true);
  assert.equal(entrySignal(rule("vwap_cross", "short"), bar(T + H, { vwapUtcDay: 99 }, 100),
    bar(T + 2 * H, { vwapUtcDay: 111 }, 110)), true);
  assert.equal(entrySignal(rule("vwap_cross"), bar(T + 23 * H, { vwapUtcDay: 101 }, 100),
    bar(T + D, { vwapUtcDay: 99 }, 100)), false, "new-day anchor reset cannot create entry");
  assert.equal(entrySignal(rule("vwap_cross"), previous, bar(T + 3 * H, { vwapUtcDay: 109 }, 110)), false, "gap");
  assert.equal(entrySignal(rule("vwap_cross"), previous, bar(T + 2 * H, { vwapUtcDay: null }, 110)), false);
});

test("indicator exits are inclusive, direction-correct and disabled under fixed timeout rules", () => {
  for (const family of ["rsi_recovery", "crsi_recovery", "roc_cross", "vwap_cross"] as const) {
    const field = family === "rsi_recovery" ? "rsi14" : family === "crsi_recovery" ? "crsi"
      : family === "roc_cross" ? "roc5" : "vwapUtcDay";
    const center = family === "roc_cross" ? 0 : family === "vwap_cross" ? 100 : 50;
    for (const side of ["long", "short"] as const) {
      const r = rule(family, side, "indicator_or12h"), atThreshold = bar(T, { [field]: center });
      assert.equal(exitSignal(r, atThreshold), true, `${family} ${side} equality exits`);
      const qualifyingStep = family === "roc_cross" ? side === "long" ? -1 : 1 : side === "long" ? 1 : -1;
      assert.equal(exitSignal(r, bar(T, { [field]: center + qualifyingStep })), true, "beyond exit threshold");
      assert.equal(exitSignal(r, bar(T, { [field]: center - qualifyingStep })), false, "wrong side of exit threshold");
      assert.equal(exitSignal(rule(family, side), atThreshold), false, "fixed horizon ignores indicator");
      assert.equal(exitSignal(r, bar(T, { [field]: null })), false, "missing feature is not an exit");
    }
  }
  assert.equal(exitSignal(rule("clock", "long", "indicator_or12h"), bar(T)), false);
  assert.equal(exitSignal(rule("vwap_cross", "long", "indicator_or12h"), bar(T + D, { vwapUtcDay: 100 }, 100)), true,
    "unlike entries, VWAP exits may use a newly reset daily anchor");
});

test("both entry and indicator exit fill the scheduled minute open, including +1m delay", () => {
  const cs = minutes(T, 63, i => i === 0 ? { open: 100, close: 105, high: 150, low: 50 }
    : i === 1 ? 102 : i === 60 ? { open: 110, close: 109, high: 200, low: 20 } : i === 61 ? 108 : 106);
  const fs = bars([20, 40, 60]);
  for (const delayMs of [0, M]) {
    const result = runStandalone(cs, fs, rule("rsi_recovery", "long", "indicator_or12h"), options(cs.length, { delayMs }));
    assert.equal(result.trades.length, 1);
    const trade = result.trades[0];
    assert.equal(trade.signalAt, T); assert.equal(trade.entryAt, T + delayMs);
    assert.equal(trade.exitDecisionAt, T + H); assert.equal(trade.exitAt, T + H + delayMs);
    assert.equal(trade.entryPrice, delayMs === 0 ? 100 : 102);
    assert.equal(trade.exitPrice, delayMs === 0 ? 110 : 108);
    assert.equal(trade.reason, "indicator");
  }
});

test("timeout starts at actual fill, receives exit delay and takes precedence over simultaneous indicator exit", () => {
  const cs = minutes(T, 65, i => 100 + i / 10), fs = bars([20, 40, 60]);
  const r = rule("rsi_recovery", "long", "indicator_or12h");
  const zero = runStandalone(cs, fs, r, options(cs.length, { holdMs: H }));
  assert.equal(zero.trades[0].exitDecisionAt, T + H); assert.equal(zero.trades[0].reason, "timeout");
  // Fixed-only avoids the T+H indicator exit: fill00:01 -> timeout01:01 -> exit01:02.
  const delayed = runStandalone(cs, fs, rule(), options(cs.length, { holdMs: H, delayMs: M }));
  assert.equal(delayed.trades[0].entryAt, T + M);
  assert.equal(delayed.trades[0].exitDecisionAt, T + H + M);
  assert.equal(delayed.trades[0].exitAt, T + H + 2 * M);
  assert.equal(delayed.trades[0].reason, "timeout");
});

test("new entry cannot exit on the same decision even if its indicator already exceeds exit threshold", () => {
  const cs = minutes(T, 62), fs = bars([20, 60, 60]);
  for (const delayMs of [0, M]) {
    const result = runStandalone(cs, fs, rule("rsi_recovery", "long", "indicator_or12h"), options(cs.length, { delayMs }));
    assert.equal(result.trades.length, 1);
    assert.equal(result.trades[0].entryAt, T + delayMs);
    assert.equal(result.trades[0].exitDecisionAt, T + H);
    assert.ok(result.trades[0].exitAt > result.trades[0].entryAt);
  }
});

test("occupied crossings are counted, skipped and never queued; sustained levels do not reenter", () => {
  const cs = minutes(T, 14 * 60), fs = bars([20, 40, 20, 40, ...Array(12).fill(40)]);
  const result = runStandalone(cs, fs, rule(), options(cs.length));
  assert.equal(result.stats.rawSignals, 2); assert.equal(result.stats.skippedOccupied, 1);
  assert.equal(result.trades.length, 1); assert.equal(result.trades[0].entryAt, T);
  assert.equal(result.trades[0].exitAt, T + 12 * H);
  assert.equal(result.open, null); assert.equal(result.stats.pendingAtEnd, false);
  near(result.stats.exposureHours, 12, "exposure ends at exit open");
});

test("hand accounting: fixed notional long and short fees use each actual execution notional", () => {
  for (const side of ["long", "short"] as const) {
    const exitPrice = side === "long" ? 110 : 90;
    const fs = bars(side === "long" ? [20, 40] : [80, 60]);
    const cs = minutes(T, 3, i => i < 1 ? 100 : exitPrice);
    const result = runStandalone(cs, fs, rule("rsi_recovery", side), options(cs.length, { holdMs: M }));
    const trade = result.trades[0];
    near(trade.qty, 10, "1000 / 100 entry quantity"); near(trade.pricePnl, 100, "directional price PnL");
    near(trade.fees, side === "long" ? 2.1 : 1.9, "entry1000*0.001 plus exit notional fee");
    near(trade.net, side === "long" ? 97.9 : 98.1, "net after both fees exactly once");
    near(result.stats.net, trade.net, "marked equity agrees with closed trade");
    near(result.stats.feesPaid, trade.fees, "paid execution fees");
    near(result.stats.turnoverIncludingMarkedExit, side === "long" ? 2100 : 1900, "two actual notionals");
    assert.equal(result.stats.wins, 1); assert.equal(result.stats.losses, 0);
    near(result.stats.winningDollars, trade.net, "winning dollars already net of costs");
  }
});

test("flat-price trades lose their fees; zero-cost flat trades are breakeven, not wins", () => {
  const cs = minutes(T, 3), fs = bars([20, 40]);
  const paid = runStandalone(cs, fs, rule(), options(cs.length, { holdMs: M }));
  assert.equal(paid.stats.losses, 1); near(paid.stats.losingDollars, -2, "both fees on no price movement");
  const free = runStandalone(cs, fs, rule(), options(cs.length, { holdMs: M, feeRate: 0 }));
  assert.equal(free.stats.breakeven, 1); assert.equal(free.stats.wins, 0); assert.equal(free.stats.losses, 0);
  near(free.stats.net, 0, "zero-cost flat account");
});

test("subsequent trades retain fixed entry notional rather than compounding profits", () => {
  const cs = minutes(T, 3, i => [100, 110, 121][i]);
  const result = runStandalone(cs, bars([40], T - H), rule("clock"), options(3, { holdMs: M }));
  assert.equal(result.trades.length, 2);
  near(result.trades[0].qty, 10, "first quantity");
  near(result.trades[1].qty, 1000 / 110, "second quantity still uses exactly1000 notional");
  near(result.trades[0].net, 97.9, "first roundtrip");
  near(result.trades[1].net, 97.9, "second roundtrip does not compound first profit");
  near(result.stats.closedNet, 195.8, "two completed trades");
  assert.ok(result.open); near(result.open.qty, 1000 / 121, "third fixed-size entry");
  near(result.stats.net, 193.8, "closed profit less marked third roundtrip fees");
});

test("end-of-window inventory is marked with an estimated exit fee but is not a closed trade", () => {
  const cs = minutes(T, 10, i => i === 0 ? 100 : 110), fs = bars([20, 40]);
  const result = runStandalone(cs, fs, rule(), options(cs.length));
  assert.equal(result.trades.length, 0); assert.ok(result.open);
  near(result.open.entryPrice, 100, "entry"); near(result.open.markedPrice, 110, "last eligible close");
  near(result.open.net, 97.9, "100 unrealized minus paid1 and reserved1.1");
  near(result.stats.closedNet, 0, "not falsely counted realized"); near(result.stats.openNet, 97.9, "open net");
  near(result.stats.feesPaid, 1, "hypothetical closing fee not reported as already paid");
  near(result.stats.net, 97.9, "net liquidation mark"); assert.equal(result.stats.pendingAtEnd, false);
  near(result.stats.exposureHours, 10 / 60, "minutes held including final minute");
});

test("pending entry and exit at cutoff are censored without retroactive fill", () => {
  const fs = bars([20, 40, 60]);
  const pendingEntry = runStandalone(minutes(T, 1), fs, rule(), options(1, { delayMs: M }));
  assert.equal(pendingEntry.stats.pendingAtEnd, true); assert.equal(pendingEntry.open, null);
  near(pendingEntry.stats.feesPaid, 0, "unfilled entry has no fee"); near(pendingEntry.stats.net, 0, "unfilled entry has no PnL");
  const count = 61, pendingExit = runStandalone(minutes(T, count), fs,
    rule("rsi_recovery", "long", "indicator_or12h"), options(count, { delayMs: M }));
  assert.equal(pendingExit.stats.pendingAtEnd, true); assert.ok(pendingExit.open);
  assert.equal(pendingExit.trades.length, 0); near(pendingExit.stats.net, -2, "open liquidation value includes both sides once");
  const timeoutBeyondCutoff = runStandalone(minutes(T, 60), fs, rule(), options(60, { holdMs: H }));
  assert.ok(timeoutBeyondCutoff.open); assert.equal(timeoutBeyondCutoff.stats.pendingAtEnd, false,
    "a decision exactly at excluded cutoff has not happened yet");
});

test("monthly closed PnL and marked changes reconcile independently across a month boundary", () => {
  const start = Date.UTC(2026, 7, 31, 23), cs = minutes(start, 61, i => i === 0 ? 100 : i < 60 ? 95 : 90);
  const fs = bars([20, 40], start - 2 * H);
  const result = runStandalone(cs, fs, rule(), options(cs.length, { holdMs: H }, start));
  assert.equal(result.monthly.length, 2);
  const august = result.monthly[0], september = result.monthly[1];
  assert.equal(august.month, "2026-08"); assert.equal(september.month, "2026-09");
  near(august.closedNet, 0, "August has no realized exit"); near(september.closedNet, -101.9, "September closes price loss100 and both fees1.9");
  near(august.markedNet, -51.95, "August mark95 includes entry fee1 and reserved0.95");
  near(september.markedNet, -49.95, "September incremental equity change, not duplicated entire loss");
  near(august.feesPaid, 1, "entry fee month"); near(september.feesPaid, 0.9, "exit fee month");
  near(result.monthly.reduce((sum, month) => sum + month.closedNet, 0), result.stats.closedNet, "monthly realized sum");
  near(result.monthly.reduce((sum, month) => sum + month.markedNet, 0), result.stats.net, "monthly marked sum");
  near(result.monthly.reduce((sum, month) => sum + month.feesPaid, 0), result.stats.feesPaid, "monthly cash fee sum");
});

test("rolling clock control restarts after close fill and does not lose half its exposure under +1m latency", () => {
  const count = 24 * 60 + 6, cs = minutes(T, count), fs = bars(Array(27).fill(40), T - H);
  const zero = runStandalone(cs, fs, rule("clock"), options(count));
  assert.equal(zero.trades.length, 2); assert.equal(zero.trades[0].entryAt, T);
  assert.equal(zero.trades[0].exitAt, T + 12 * H); assert.equal(zero.trades[1].entryAt, T + 12 * H);
  assert.equal(zero.trades[1].exitAt, T + 24 * H); assert.ok(zero.open);
  assert.equal(zero.open.entryAt, T + 24 * H); assert.equal(zero.stats.skippedOccupied, 0);
  const delayed = runStandalone(cs, fs, rule("clock"), options(count, { delayMs: M }));
  assert.equal(delayed.trades.length, 2); assert.equal(delayed.trades[0].entryAt, T + M);
  assert.equal(delayed.trades[0].exitAt, T + 12 * H + 2 * M);
  assert.equal(delayed.trades[1].signalAt, T + 12 * H + 2 * M);
  assert.equal(delayed.trades[1].entryAt, T + 12 * H + 3 * M);
  assert.equal(delayed.trades[1].exitAt, T + 24 * H + 4 * M);
  assert.equal(delayed.stats.rawSignals, 5); assert.equal(delayed.stats.skippedOccupied, 2);
  assert.ok(delayed.open); assert.equal(delayed.open.entryAt, T + 24 * H + 5 * M);
  near(delayed.stats.exposureHours, (count - 3) / 60, "only actual entry delay gaps remove exposure");
  near(zero.stats.net, -6, "two closes plus marked third round trip costs");
  near(delayed.stats.net, -6, "same fixed-price lifecycle costs with latency");
});

test("gaps, incomplete windows and unfinalized feature availability are rejected", () => {
  const cs = minutes(T, 120), fs = bars([20, 40, 60, 40]);
  assert.throws(() => runStandalone(cs.filter((_, i) => i !== 5), fs, rule(), options(cs.length)), /minute tape/);
  assert.throws(() => runStandalone(cs.slice(1), fs, rule(), options(cs.length)), /study window/);
  assert.throws(() => runStandalone(cs.slice(0, -1), fs, rule(), options(cs.length)), /study window/);
  assert.throws(() => runStandalone(cs, [fs[0], fs[2]], rule(), options(cs.length)), /contiguous/);
  assert.throws(() => runStandalone(cs, [...fs].reverse(), rule(), options(cs.length)), /contiguous/);
  assert.throws(() => runStandalone(cs, [fs[0], { ...fs[1], availableAt: fs[1].barEnd - 1 }], rule(), options(cs.length)), /zero publication lag/);
  assert.throws(() => runStandalone(cs, [fs[0], { ...fs[1], availableAt: fs[1].barEnd + 1 }], rule(), options(cs.length)), /zero publication lag/);
  assert.throws(() => runStandalone(cs, [fs[0], { ...fs[1], feature: { ...fs[1].feature, timestamp: fs[1].feature.timestamp + H } }],
    rule(), options(cs.length)), /hourly features/, "feature identity must match its source candle");
  for (const timestamp of [NaN, Infinity, T + 0.5, T + M])
    assert.throws(() => runStandalone(cs, [{ ...fs[0], candle: { ...fs[0].candle, timestamp },
      feature: { ...fs[0].feature, timestamp }, barEnd: timestamp + H, availableAt: timestamp + H }],
    rule(), options(cs.length)), /hourly features/, `invalid hourly timestamp ${timestamp}`);
  for (const timestamp of [NaN, Infinity, T + 0.5])
    assert.throws(() => runStandalone([{ ...cs[0], timestamp }, ...cs.slice(1)], fs,
      rule(), options(cs.length)), /minute tape/, `invalid minute timestamp ${timestamp}`);
  for (const change of [{ delayMs: -M }, { delayMs: 1 }, { holdMs: 0 }, { holdMs: 1 }, { feeRate: -1 }, { notional: 0 }])
    assert.throws(() => runStandalone(cs, fs, rule(), options(cs.length, change)), /options/);
});

test("drawdown uses correctly signed mark/adverse prices against observed close-equity peaks", () => {
  for (const side of ["long", "short"] as const) {
    const cs = minutes(T, 2, i => side === "long"
      ? i === 0 ? { open: 100, close: 105, high: 110, low: 90 } : { open: 105, close: 100, high: 106, low: 95 }
      : i === 0 ? { open: 100, close: 95, high: 110, low: 90 } : { open: 95, close: 100, high: 105, low: 94 });
    const result = runStandalone(cs, bars(side === "long" ? [20, 40] : [80, 60]), rule("rsi_recovery", side),
      options(cs.length, { equity: 1000, feeRate: 0 }));
    near(result.stats.maxCloseDrawdownPct, 50 / 1050 * 100, "close equity1050 falls to1000");
    near(result.stats.maxAdverseDrawdownPct, 10, "initial adverse900 vs priorclose peak1000, not invented intrabar ordering");
    assert.equal(result.stats.bankrupt, false);
  }
});

test("future feature/price extremes cannot change earlier fills or give signal-bar wick prices", () => {
  const fs = bars([20, 40, 60, 60, 20, 60, 60]), cutoff = T + 3 * H;
  const cs = minutes(T, 6 * 60 + 1, i => i < 3 * 60 ? 100 + i / 100 : i % 2 ? 100_000 : 2);
  const r = rule("rsi_recovery", "long", "indicator_or12h");
  const earlier = runStandalone(cs.slice(0, 3 * 60), fs.slice(0, 4), r, options(3 * 60));
  const later = runStandalone(cs, fs, r, options(cs.length));
  assert.deepEqual(later.trades.filter(trade => trade.exitAt < cutoff), earlier.trades);
  const extreme = fs.map((f, i) => i < 4 ? f : { ...f,
    candle: { ...f.candle, open: 1_000_000, high: 2_000_000, low: 1, close: 999_999 },
    feature: { ...f.feature, rsi14: i % 2 ? 0 : 100, crsi: i % 2 ? 100 : 0, roc5: 999_999 } });
  const changed = runStandalone(cs, extreme, r, options(cs.length));
  assert.deepEqual(changed.trades.filter(trade => trade.exitAt < cutoff), earlier.trades);
  assert.equal(earlier.trades[0].entryPrice, cs[0].open);
  assert.equal(earlier.trades[0].exitPrice, cs[60].open);
});

console.log(`indicator standalone tests passed (${groups} groups; frozen signals, execution causality and independent accounting)`);
