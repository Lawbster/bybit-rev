import assert from "assert/strict";
import fs from "fs";
import { computeIndicators, getSnapshotAt } from "../src/indicators";
import type { Candle } from "../src/fetch-candles";
import { ClosedBarSeries, type FinalCandleObservation } from "../src/research/closed-bars";
import { ClosedIndicatorSeries } from "../src/research/closed-indicators";

const M = 60_000, H = 60 * M, D = 24 * H;
const T = Date.UTC(2026, 7, 1);
function candles(count: number, interval = M, start = T): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const open = 100 + i / 100 + Math.sin(i / 7);
    return { timestamp: start + i * interval, open, high: open + 2, low: open - 2,
      close: open + Math.cos(i / 9), volume: i + 1, turnover: (i + 1) * open };
  });
}
function series(cs: readonly Candle[], source = M, target = source, lag = 0): ClosedBarSeries {
  return ClosedBarSeries.fromHistorical(cs, { sourceIntervalMs: source, targetIntervalMs: target, publicationLagMs: lag });
}
function observations(cs: readonly Candle[], interval = M): FinalCandleObservation[] {
  return cs.map(candle => ({ candle, receivedAt: candle.timestamp + interval, final: true }));
}
const indicators = (source: ClosedBarSeries, seedBarStart = T) => new ClosedIndicatorSeries(source, { seedBarStart });
let checks = 0;
function test(name: string, fn: () => void): void { fn(); checks++; console.log(`PASS ${name}`); }

test("exact close boundaries across 1m, 5m, 1h, 4h and UTC daily", () => {
  for (const interval of [M, 5 * M, H, 4 * H, D]) {
    const tape = series(candles(interval / M * 2), M, interval);
    assert.equal(tape.windowAt(T + interval - 1, 1).ready, false);
    const exact = tape.windowAt(T + interval, 1);
    assert.ok(exact.ready); assert.equal(exact.bars[0].candle.timestamp, T);
    assert.equal(exact.bars[0].barEnd, T + interval);
    assert.equal(exact.availableAt, T + interval);
    const mid = tape.windowAt(T + interval + 1, 1);
    assert.ok(mid.ready); assert.deepEqual(mid.bars, exact.bars);
    const next = tape.windowAt(T + 2 * interval, 1);
    assert.ok(next.ready); assert.equal(next.bars[0].candle.timestamp, T + interval);
  }
});

test("aggregation requires every constituent, including first/last source bar", () => {
  const cs = candles(15);
  const tape = series(cs, M, 5 * M);
  const c = tape.bars[0].candle;
  assert.equal(c.open, cs[0].open); assert.equal(c.close, cs[4].close);
  assert.equal(c.high, Math.max(...cs.slice(0, 5).map(b => b.high)));
  assert.equal(c.low, Math.min(...cs.slice(0, 5).map(b => b.low)));
  assert.equal(c.volume, 15); assert.equal(c.turnover, cs.slice(0, 5).reduce((s, b) => s + b.turnover, 0));
  for (const missing of [0, 2, 4]) {
    const gapped = series(cs.filter((_, i) => i !== missing), M, 5 * M);
    assert.equal(gapped.windowAt(T + 5 * M, 1).ready, false);
    assert.equal(gapped.windowAt(T + 10 * M, 1).ready, true);
    assert.equal(gapped.windowAt(T + 10 * M, 2).ready, false);
  }
  assert.equal(series(cs.slice(0, 4), M, 5 * M).bars.length, 0);
});

test("delayed source receipt and explicit modeled publication lag", () => {
  const cs = candles(5), rows = observations(cs);
  rows[1].receivedAt = T + 5 * M + 1200;
  const tape = ClosedBarSeries.fromObservations(rows, { sourceIntervalMs: M, targetIntervalMs: 5 * M });
  assert.deepEqual(tape.availability, { mode: "observed_final_receipt" });
  assert.equal(tape.windowAt(T + 5 * M + 1199, 1).ready, false);
  const received = tape.windowAt(T + 5 * M + 1200, 1);
  assert.ok(received.ready); assert.equal(received.availableAt, rows[1].receivedAt);
  const modeled = series(cs, M, 5 * M, 2000);
  assert.deepEqual(modeled.availability, { mode: "modeled_bar_end", publicationLagMs: 2000 });
  assert.equal(modeled.windowAt(T + 5 * M + 1999, 1).ready, false);
  assert.equal(modeled.windowAt(T + 5 * M + 2000, 1).ready, true);
});

test("sort/deduplicate finals, preserve earliest identical receipt, reject conflicting revisions", () => {
  const cs = candles(5), rows = observations(cs);
  const duplicate = { ...rows[1], candle: { ...rows[1].candle }, receivedAt: T + 10 * M };
  const tape = ClosedBarSeries.fromObservations([...rows, duplicate].reverse(), { sourceIntervalMs: M, targetIntervalMs: 5 * M });
  assert.deepEqual(tape.bars, series(cs, M, 5 * M).bars);
  assert.throws(() => series([...cs, { ...cs[1], volume: 999 }]), /Conflicting final/);
  cs[0].open = 999;
  assert.notEqual(tape.bars[0].candle.open, 999, "input mutation cannot rewrite copied history");
  assert.ok(Object.isFrozen(tape.bars)); assert.ok(Object.isFrozen(tape.bars[0].candle));
});

test("invalid intervals, timestamps, OHLCV and forming updates fail explicitly", () => {
  const cs = candles(2);
  for (const interval of [0, -1, 1.5, NaN, 7 * D]) assert.throws(() => series(cs, M, interval));
  assert.throws(() => series(cs, 5 * M, 3 * M), /Intervals/);
  assert.throws(() => series(cs, M, M, -1), /publication lag/);
  assert.throws(() => ClosedBarSeries.fromHistorical(cs, { sourceIntervalMs: M, targetIntervalMs: M,
    publicationLagMs: undefined as unknown as number }), /publication lag/);
  for (const patch of [{ timestamp: T + 1 }, { timestamp: NaN }, { high: 1 }, { low: 200 },
    { volume: -1 }, { turnover: Infinity }, { close: 0 }]) assert.throws(() => series([{ ...cs[0], ...patch }]));
  assert.throws(() => ClosedBarSeries.fromObservations([{ candle: cs[0], receivedAt: T, final: true }],
    { sourceIntervalMs: M, targetIntervalMs: M }), /precedes/);
  assert.throws(() => ClosedBarSeries.fromObservations([{ candle: cs[0], receivedAt: T + M, final: false } as unknown as FinalCandleObservation],
    { sourceIntervalMs: M, targetIntervalMs: M }), /forming/);
  for (const at of [NaN, -1, T + .5]) assert.throws(() => series(cs).windowAt(at, 1));
  for (const count of [0, -1, 1.5, Infinity]) assert.throws(() => series(cs).windowAt(T + M, count));
});

test("closed indicator lookup has neither current/future nor stale fallback", () => {
  const cs = candles(230), legacy = computeIndicators(cs), tape = indicators(series(cs));
  const at = T + 220 * M;
  assert.equal(getSnapshotAt(legacy, at, M)?.timestamp, at, "legacy helper unchanged and start-keyed");
  const exact = tape.at(at); assert.ok(exact.ready);
  assert.equal(exact.snapshot.barStart, at - M);
  assert.equal(exact.snapshot.barEnd, at);
  assert.deepEqual(exact.snapshot.values, legacy.get(at - M), "formula values preserved, not retuned");
  assert.equal(exact.snapshot.seedBarStart, T); assert.equal(exact.snapshot.contiguousBars, 220);
  const missingCurrent = new Map(legacy); missingCurrent.delete(at);
  missingCurrent.delete(at - M); missingCurrent.delete(at - 2 * M);
  assert.equal(getSnapshotAt(missingCurrent, at, M)?.timestamp, at + M, "fixture demonstrates the unsafe legacy future fallback");
  const missingClosed = indicators(series(cs.filter(c => c.timestamp !== at - M)));
  assert.deepEqual(missingClosed.at(at), { ready: false, decisionAt: at, expectedBarStart: at - M, reason: "missing_bar" });
  assert.equal(tape.at(T + 231 * M).ready, false, "no stale fallback when the next bar is absent");
});

test("explicit warmup, fixed seed, gap blocking and delayed indicator dependency", () => {
  const cs = candles(450), full = indicators(series(cs));
  assert.equal(full.at(T + 199 * M).ready, false);
  assert.equal(full.at(T + 200 * M).ready, true);
  const gap = indicators(series(cs.filter((_, i) => i !== 220)));
  const warming = gap.at(T + 420 * M);
  assert.ok(!warming.ready); assert.equal(warming.reason, "indicator_history_not_available");
  assert.equal(gap.at(T + 421 * M).ready, false, "never silently reseed after a gap");
  const explicitNewStudy = indicators(series(cs), T + 221 * M).at(T + 421 * M);
  assert.ok(explicitNewStudy.ready); assert.equal(explicitNewStudy.snapshot.seedBarStart, T + 221 * M);
  assert.throws(() => indicators(series(cs), T + 1), /fixed indicator seed/);
  const rows = observations(cs); rows[3].receivedAt = T + 220 * M + 500;
  const delayed = indicators(ClosedBarSeries.fromObservations(rows, { sourceIntervalMs: M, targetIntervalMs: M }));
  const blocked = delayed.at(T + 220 * M);
  assert.ok(!blocked.ready); assert.equal(blocked.reason, "indicator_history_not_available");
  assert.equal(delayed.at(T + 220 * M + 499).ready, false);
  const arrived = delayed.at(T + 220 * M + 500); assert.ok(arrived.ready);
  assert.equal(arrived.snapshot.availableAt, rows[3].receivedAt);
});

test("future append and prefix recomputation preserve complete indicator snapshots", () => {
  const cs = candles(260), full = indicators(series(cs));
  for (const count of [200, 201, 219, 249]) {
    const at = T + count * M;
    const prefix = indicators(series(cs.slice(0, count)));
    assert.deepEqual(full.at(at), prefix.at(at));
    const extremeFuture = cs.map((c, i) => i < count ? c : { ...c, open: 1e6, high: 2e6, low: 1, close: 1e6, volume: 1e9, turnover: 1e15 });
    assert.deepEqual(indicators(series(extremeFuture)).at(at), prefix.at(at));
    const early = full.at(at - 1), prefixEarly = indicators(series(cs.slice(0, count - 1)));
    assert.deepEqual(early, prefixEarly.at(at - 1));
    const one = full.at(at), two = prefix.at(at);
    assert.equal(one.ready && one.snapshot.values.rsi14 < 30, two.ready && two.snapshot.values.rsi14 < 30,
      "a simple decision inherits the same prefix invariance");
  }
});

test("non-finite outputs are unavailable, not neutral indicators", () => {
  const cs = candles(220).map(c => ({ ...c, open: 100, high: 100, low: 100, close: 100 }));
  const result = indicators(series(cs)).at(T + 220 * M);
  assert.ok(!result.ready); assert.equal(result.reason, "non_finite_indicator");
});

test("forming higher-timeframe extremes cannot affect a closed feature", () => {
  for (const target of [5 * M, H, 4 * H, D]) {
    const source = target === 5 * M ? M : 5 * M;
    const cs = candles(222 * target / source, source);
    const decision = T + 220 * target + Math.floor(target / 2);
    const full = indicators(series(cs, source, target)).at(decision);
    assert.ok(full.ready); assert.equal(full.snapshot.barStart, T + 219 * target);
    const observedPrefix = cs.filter(c => c.timestamp + source <= decision);
    assert.deepEqual(indicators(series(observedPrefix, source, target)).at(decision), full);
    const extreme = cs.map(c => c.timestamp < T + 220 * target ? c
      : { ...c, open: 1e6, high: 2e6, low: 1, close: 1e6 });
    assert.deepEqual(indicators(series(extreme, source, target)).at(decision), full);
  }
});

test("future receipts bridging an old gap cannot retrospectively seed signals", () => {
  const cs = candles(500), rows = observations(cs);
  rows[10].receivedAt = T + 480 * M + 500;
  const options = { sourceIntervalMs: M, targetIntervalMs: M };
  const full = indicators(ClosedBarSeries.fromObservations(rows, options));
  for (const at of [T + 450 * M, T + 480 * M + 499, T + 480 * M + 500]) {
    const prefix = indicators(ClosedBarSeries.fromObservations(rows.filter(r => r.receivedAt <= at), options));
    assert.deepEqual(full.at(at), prefix.at(at), "a future-delivered old candle cannot rewrite a historical signal");
  }
  const at = T + 450 * M;
  const postGapSeed = T + 11 * M;
  const before = indicators(ClosedBarSeries.fromObservations(rows.filter(r => r.receivedAt <= at), options), postGapSeed);
  const after = indicators(ClosedBarSeries.fromObservations(rows, options), postGapSeed);
  assert.ok(before.at(at).ready); assert.deepEqual(after.at(at), before.at(at), "explicit later seed ignores earlier history consistently");
});

// Optional, read-only smoke check on a normalized local candle JSON array. No
// fetch, output writer, live config, state or exchange API is used by this script.
const fileIdx = process.argv.indexOf("--history-file");
if (fileIdx >= 0) {
  const file = process.argv[fileIdx + 1];
  if (!file || !fs.existsSync(file)) throw new Error("--history-file requires an existing normalized 5m candle JSON array");
  test("local 5m history: hourly feature equals historical prefix at exact close", () => {
    const raw: Candle[] = JSON.parse(fs.readFileSync(file, "utf8"));
    // Bounded smoke window, not a new replay dataset or an accuracy certificate.
    const cs = raw.slice(-12 * 260);
    const tape = series(cs, 5 * M, H);
    assert.ok(tape.bars.length >= 230, "at least 230 complete hourly bars required");
    const end = tape.bars[tape.bars.length - 10].barEnd;
    const seed = tape.bars[0].candle.timestamp; // freeze once; don't infer separately for each query
    const full = indicators(tape, seed).at(end);
    const prefix = indicators(series(cs.filter(c => c.timestamp + 5 * M <= end), 5 * M, H), seed).at(end);
    assert.ok(full.ready, JSON.stringify(full)); assert.deepEqual(full, prefix);
    console.log(JSON.stringify({ historyFile: file, decisionAt: new Date(end).toISOString(),
      barStart: new Date(full.snapshot.barStart).toISOString(), availableAt: new Date(full.snapshot.availableAt).toISOString(),
      seedBarStart: new Date(full.snapshot.seedBarStart).toISOString(), availability: tape.availability,
      rsi14: full.snapshot.values.rsi14, ema50: full.snapshot.values.ema50, prefixEqual: true }));
  });
}
console.log(`Closed indicator timing tests passed (${checks} groups). No strategy/PnL test was run.`);
