import assert from "assert/strict";
import fs from "fs";
import path from "path";
import { TpHlTape, normalize, availableAt, MIN, Row, stats } from "./tp-hl-event-features";
import { parseLog, batchLogMatches, classifyBatch, monetaryGroup, reasonClass } from "./tp-hl-event-catalog";
import { summarize, csv } from "./hype-tp-hl-event-atlas";

const spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../research-inputs/tp-hl-events-2026-09-07.json"), "utf8"));
const T = Date.parse("2026-08-01T12:00:00Z");
let tests = 0;
function test(name: string, f: () => void) { f(); tests++; console.log(`PASS ${name}`); }
function tape(rows: Array<[any, Row]>) { const t = new TpHlTape(spec); rows.forEach(([k, r], i) => t.add(normalize(k, r, k, i + 1))); t.seal(); return t; }
const flow = (end: number, buy = 300, sell = 100, extra: Row = {}) => ({ timestamp: end, windowStart: end - MIN, windowEnd: end,
  buyNotional: buy, sellNotional: sell, buyVol: buy, sellVol: sell, buyCount: 3, sellCount: 1,
  largeBuyNotional: 100, largeSellNotional: 0, largeBuyCount: 1, largeSellCount: 0, ...extra });
const book = (sample: number, source = sample, bid = 300, ask = 100, extra: Row = {}) => ({ timestamp: sample, exchangeTimestamp: source,
  bidBands: { pct_0_25: bid, pct_0_5: bid, pct_2_0: bid }, askBands: { pct_0_25: ask, pct_0_5: ask, pct_2_0: ask },
  bidBandsTruncated: { pct_0_25: false, pct_0_5: false, pct_2_0: false }, askBandsTruncated: { pct_0_25: false, pct_0_5: false, pct_2_0: false },
  bandResolutionTooCoarse: { pct_0_25: false, pct_0_5: false, pct_2_0: false }, ...extra });
const candle = (start: number, close = 100, extra: Row = {}) => ({ timestamp: start, open: close, high: close + 1, low: close - 1, close, volume: 10, ...extra });

test("60s lag excludes an ended but unpublished bucket; missing minute is not zero", () => {
  const t = tape(Array.from({ length: 16 }, (_, i) => ["taker", flow(T - i * MIN)]));
  const s = t.snapshot(T + 1234), optimistic = t.snapshot(T + 1234, 0);
  assert.equal(s.quality.flow15Samples, 14); assert.equal(optimistic.quality.flow15Samples, 15);
  assert.equal(s.features.turnover15Usd, 14 * 400); assert.equal(s.features.buyShare15, .75);
  assert.equal(s.sources.taker15.sources.at(-1)?.sourceAt <= T - MIN, true);
  assert.equal(s.quality.historicalArrivalProven, false);
});
test("actual receipt/written clocks are not backdated to bucket end", () => {
  const r = normalize("taker", flow(T, 300, 100, { receivedAt: T + 5000, writtenAt: T + 15000 }), "x", 1);
  assert.equal(availableAt(r, MIN), T + 15000);
  assert.equal(tape([["taker", flow(T, 300, 100, { writtenAt: T + 15000 })]]).latest("taker", T + 10000, 0), null);
});
test("same-minute future book never joins; cached source clock governs stale status", () => {
  const t = tape([["book", book(T - 1000)], ["book", book(T + 1000, T + 900, 1, 1000)]]);
  assert.equal(t.snapshot(T).features.bookImbalance05, .5);
  const stale = tape([["book", book(T - 1, T - 100000)]]).snapshot(T);
  assert.equal(stale.features.bookImbalance05, null); assert.equal(stale.sources.book.fresh, false);
});
test("coarse, truncated and absent book bands fail closed", () => {
  const t = tape([["book", book(T, T, 300, 100, { bandResolutionTooCoarse: { pct_0_5: true } })]]);
  assert.equal(t.snapshot(T).features.bookImbalance05, null);
});
test("duplicate minute copies deduplicate, future conflicts do not retroactively contaminate", () => {
  const t = tape([["taker", flow(T)], ["taker", flow(T)], ["taker", flow(T, 5, 7, { writtenAt: T + 2 * MIN })]]);
  assert.equal(t.flow(T + MIN, 5, MIN).samples, 1);
  assert.equal(t.flow(T + 2 * MIN, 5, MIN).ambiguous, 1);
  assert.equal(t.latest("taker", T + 2 * MIN, MIN), null);
});
test("weighted flow is ratio of sums, not mean of bucket ratios; all-buy is not infinite", () => {
  const t = tape(Array.from({ length: 15 }, (_, i) => ["taker", flow(T - i * MIN, i === 1 ? 900 : 10, 0)]));
  const s = t.snapshot(T);
  assert.equal(s.features.buyShare15, 1); assert.equal(s.features.takerRatio15, null);
  assert.equal(tape(Array.from({ length: 15 }, (_, i) => ["taker", flow(T - i * MIN, 0, 0)])).snapshot(T).features.buyShare15, null);
});
test("native OI and price-marked OI are distinct; negative funding is preserved", () => {
  const t = tape([["asset", { timestamp: T - 15 * MIN, openInterest: 100, openInterestValue: 10000, markPrice: 100 }],
    ["asset", { timestamp: T, openInterest: 100, openInterestValue: 11000, markPrice: 110 }],
    ["funding", { timestamp: T, fundingRate: -.00001, fundingIntervalHours: 1 }]]);
  const s = t.snapshot(T); assert.equal(s.features.assetNativeOiChange15Pct, 0);
  assert.ok(Math.abs(s.features.assetMarkedOiChange15Pct - 10) < 1e-10); assert.equal(s.features.fundingPerHour, -.00001);
});
test("closed candles require end plus lag; gaps and conflicting closed copies mask return", () => {
  const rs: Array<[any, Row]> = Array.from({ length: 18 }, (_, i) => ["candle1m", candle(T - i * MIN, 100 + i)]);
  const t = tape(rs), s = t.snapshot(T + 1);
  assert.equal(s.sources.candle1m.sourceAt, T - MIN); assert.equal(s.features.hlClosedPrice, 102);
  assert.equal(s.quality.candle15Healthy, true);
  assert.equal(tape(rs.filter((_, i) => i !== 8)).snapshot(T + 1).features.hlClosedReturn15Pct, null);
  assert.equal(tape([...rs, ["candle1m", candle(T - 2 * MIN, 200)]]).snapshot(T + 1).features.hlClosedPrice, null);
});
test("prefix invariance across all sources", () => {
  const past: Array<[any, Row]> = [["book", book(T - 1)], ["asset", { timestamp: T - 1, openInterest: 100 }], ["taker", flow(T - MIN)]];
  const future: Array<[any, Row]> = [["book", book(T + 1)], ["asset", { timestamp: T + 1, openInterest: 999 }], ["taker", flow(T + MIN)], ["candle1m", candle(T)]];
  assert.deepEqual(tape(past).snapshot(T), tape([...past, ...future]).snapshot(T));
});
const b: Row = { ts: "2026-08-01T12:00:01.123Z", positionsClosed: 2, totalPnl: 22, totalFees: 3, avgEntry: 100, exitPrice: 101.4, file: "j", line: 1, raw: {} };
const log = parseLog("p", 3, "[2026-08-01 12:00:01] BATCH CLOSE HYPEUSDT: 2 positions, PnL $22.00, fees $3.00, avg entry $100.0000 → exit $101.4000")!;
const hit = parseLog("p", 2, "[2026-08-01 12:00:00] BATCH TP HIT: bid $101.40 >= TP $101.4000 (avg entry $100.0000)")!;
test("multi-field journal/PM2 match and explicit versus inferred reasons", () => {
  assert.equal(batchLogMatches(log, b), true); assert.equal(batchLogMatches(log, { ...b, totalPnl: 23 }), false);
  const e = classifyBatch(b, [log], [hit], [], spec);
  assert.equal(e.cohort, "long_tp_log_supported"); assert.equal(e.eventAt, T); assert.equal(e.timingExact, false);
  assert.equal(classifyBatch({ ...b, closeReason: "EXTERNAL_CLOSE_UNCLASSIFIED" }, [log], [hit], [], spec).cohort, "long_unclassified");
  assert.equal(classifyBatch({ ...b, closeReason: "TP", totalPnl: -1 }, [], [], [], spec).cohort, "long_tp_explicit");
  assert.equal(reasonClass("positive close"), "unknown");
});
test("conflicting forced context is not promoted; missing close/old hit cannot classify", () => {
  const forced = parseLog("p", 1, "[2026-08-01 12:00:00] FLATTEN: HARD FLATTEN: hostile")!;
  assert.equal(classifyBatch(b, [log], [hit, forced], [], spec).cohort, "long_unclassified");
  assert.equal(classifyBatch(b, [], [hit], [], spec).cohort, "long_unclassified");
  assert.equal(classifyBatch({ ...b, closeReason: "TP" }, [], [], [], spec).impactAnalysisEligible, false);
});
test("verified August 20 execution anchors before delayed journal, preserving booked PnL", () => {
  const evidence = spec.operatorEvidence[0];
  const e = classifyBatch({ ...b, ts: evidence.journalAt, closeReason: "NATIVE_TP", totalPnl: evidence.closedPnl,
    exitPrice: evidence.avgExitPrice }, [], [], [], spec);
  assert.equal(e.eventAt, 1787240408797); assert.ok(e.journalDelayMs > 58 * MIN); assert.equal(e.timingExact, true);
  assert.throws(() => classifyBatch({ ...b, ts: evidence.journalAt, closeReason: "NATIVE_TP" }, [], [], [], spec));
});
test("money totals keep losing TPs and fees already charged; statistics keep true zero", () => {
  const m = monetaryGroup([{ bookedPnl: 10, bookedFees: 1 }, { bookedPnl: -4, bookedFees: 1 }]);
  assert.deepEqual([m.n, m.wins, m.losses, m.winningDollars, m.losingDollars, m.bookedPnl, m.bookedFees], [2, 1, 1, 10, -4, 6, 2]);
  assert.equal(stats([null, 0, 2]).mean, 1);
});
test("summary separates all closes from TPs, with paired trajectories and explicit reference", () => {
  const events = [{ id: "a", owner: "ladder", cohort: "long_tp_explicit", impactAnalysisEligible: true, month: "2026-08", utcHour: 12, utcFourHourBlock: 12, bookedPnl: 10 },
    { id: "b", owner: "ladder", cohort: "long_forced", impactAnalysisEligible: false, month: "2026-08", utcHour: 12, bookedPnl: -20 }];
  const frames = Array.from({ length: 16 }, (_, i) => ({ eventId: "a", offsetMinutes: i - 15, features: { x: i }, quality: { coreHealthy: true } }));
  const refs = Array.from({ length: 12 }, () => ({ month: "2026-08", utcHour: 12, utcFourHourBlock: 12, features: { x: 5 }, quality: { coreHealthy: true } }));
  const s = summarize(events, new Map([["a", frames[15]]]), refs, frames);
  assert.equal(s.allLongCloses.bookedPnl, -10); assert.equal(s.tp.bookedPnl, 10);
  assert.equal(s.comparisons.alignedTp.x.monthHourStandardized.difference, 10);
  assert.equal(s.pairedLeadIn.x.impactMinusStart.mean, 15);
});
test("CSV quotes nested JSON, literal quotes, commas and multiline text using doubled quotes", () => {
  assert.equal(csv([{ id: "a", object: { x: 1 }, text: 'quote "x",\nnext', missing: null }]),
    'id,object,text,missing\na,"{""x"":1}","quote ""x"",\nnext",\n');
});
console.log(`TP/HL event tests passed (${tests}).`);
