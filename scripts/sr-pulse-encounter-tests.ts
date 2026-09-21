import assert from "assert/strict";
import fs from "fs";
import path from "path";
import { M, aggregateComplete, chartWindow, buildFrames, discoverEncounters, attachOutcomes, outcome, pressure, classifyResponse, selectControls, matchControls, blockInterval, type Frame, type StudySpec, type Control } from "./sr-pulse-encounters";
import { summarizeStudy } from "./sr-pulse-encounter-analysis";
import { ReplayMarketInputs } from "./replay-market-inputs";
import { DEFAULT_SR_MEMORY_ZONE_CONFIG } from "../src/bot/sr-memory-zones";
import type { Candle } from "./hype-freerun-canonical-replay";

const spec: StudySpec = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../research-inputs/sr-pulse-encounters/hype-2026-09-05.json"), "utf8"));
const T = Date.parse("2026-06-10T00:00:00Z");
const zone = { price: 100, touches: 2, highTouches: 2, lowTouches: 0, confirmTs: T - 7200000,
  touchData: [{ ts: T - 7200000, price: 99.9, side: "resistance" as const }, { ts: T - 3600000, price: 100.1, side: "resistance" as const }] };
function frame(at: number, close = 99.5): Frame {
  return { at, bar: { ts: at - 5 * M, endTs: at, open: close, high: close + .05, low: close - .05, close, volume: 10, turnover: 1000 },
    zones: [structuredClone(zone)], srHealthy: true, ret15m: 0, ret1h: 0, rv1hPct: .5, tr14Pct: .3, regime: "above_rising", ema200DistPct: 1,
    taker15: 1.3, taker1h: 1.1, buy15: 130, sell15: 100, net15: 30, samples15: 14, takerAgeSec: 60, flowHealthy: true, relativeVolume15: 1.5,
    bookImbalance: -.3, bookBid: 1000, bookAsk: 2000, bookAgeSec: 10, bookHealthy: true,
    nativeOi1hPct: 0, markedOi1hPct: 1, assetAgeSec: 10, assetAnchorLagSec: 5, binance1h: 1.2 };
}
const frames = [frame(T), frame(T + 5 * M, 99.8), frame(T + 10 * M, 99.7), frame(T + 15 * M, 99.7), frame(T + 20 * M, 99.7)];
const e = discoverEncounters(frames, spec).rows[0];
assert.equal(e.at, T + 5 * M); assert.equal(e.decisionAt, T + 20 * M); assert.equal(e.levelKnownAt, T);
assert.equal(e.response, "hold"); assert.equal(e.pressure, "with"); assert.equal(e.bookPersistence, "ask");
assert.equal(e.future4h, null); assert.equal(e.primaryHealthy, true);
assert.equal(discoverEncounters(frames.slice(0, -1), spec).rows[0].response, null, "unobserved confirmation is never assumed");
const newLevel = structuredClone(frames); newLevel[0].zones = [];
assert.equal(discoverEncounters(newLevel, spec).rows.length, 0, "a level first discovered during the touching bar cannot explain that bar");
const moved = structuredClone(frames); moved.slice(2).forEach(f => { f.zones[0].price = 110; });
assert.equal(discoverEncounters(moved, spec).rows[0].level.price, 100, "freeze the encounter level");
assert.equal(discoverEncounters(moved, spec).rows[0].response, "hold");
const sick = structuredClone(frames); sick.at(-1)!.flowHealthy = false;
assert.equal(discoverEncounters(sick, spec).rows[0].primaryHealthy, false);
assert.equal(discoverEncounters(sick, spec).rows[0].pressure, "unknown");
const repeated = [...frames, frame(T + 25 * M), frame(T + 30 * M, 99.8)];
assert.equal(discoverEncounters(repeated, spec).rows.length, 1, "do not count the same near-term episode twice");
assert.equal(classifyResponse("support", 100, [frame(T, 99.8), frame(T + 5 * M, 99.8)], spec), "break");
assert.equal(classifyResponse("support", 100, [frame(T, 100.2), frame(T + 5 * M, 100.2)], spec), "hold");
assert.equal(classifyResponse("resistance", 100, [frame(T, 99.8), frame(T + 5 * M, 100.2)], spec), "unresolved");
for (const side of ["support", "resistance"] as const) {
  const sign = side === "resistance" ? 1 : -1;
  const boundary = 100 + sign * spec.responseBoundaryPct;
  const atBoundary = [frame(T, boundary), frame(T + 5 * M, boundary)];
  assert.equal(classifyResponse(side, 100, atBoundary, spec), "break", "inclusive decimal boundary survives floating-point division");
  const inside = boundary - sign * .000001;
  assert.equal(classifyResponse(side, 100, [frame(T, inside), frame(T + 5 * M, inside)], spec), "unresolved", "numerical tolerance must not widen the strategy boundary");
}
assert.equal(pressure("support", { ...frame(T), taker15: .8 }, spec), "with");

const bars: Candle[] = Array.from({ length: 301 }, (_, i) => ({ ts: T + i * M, endTs: T + (i + 1) * M, open: i < 20 ? 50 : i === 20 ? 100 : 101,
  close: 102, high: 103, low: i < 20 ? 40 : 99, volume: 1, turnover: 100 }));
const index = new Map(bars.map((c, i) => [c.ts, i]));
const label = outcome(bars, index, e.decisionAt, 240)!;
assert.equal(label.entryAt, e.decisionAt); assert.equal(label.entry, 100); assert.equal(label.lowPct, (99 / 100 - 1) * 100);
assert.equal(label.delayedRetPct, (102 / 101 - 1) * 100); assert.equal(label.endAt, e.decisionAt + 240 * M);
assert.equal(outcome(bars.slice(0, 250), index, e.decisionAt, 240), null, "censored outcomes stay unknown");
const gapped = bars.filter((_, i) => i !== 30);
assert.equal(outcome(gapped, new Map(gapped.map((b, i) => [b.ts, i])), e.decisionAt, 240), null);
assert.equal(aggregateComplete(bars.slice(0, 4), 5).length, 0);
const hourlyChart = chartWindow(aggregateComplete(bars, 60), T + 90 * M);
assert(!hourlyChart.some(c => c.ts === T + 60 * M), "hourly bar crossing D cannot reveal its future close before the visual boundary");
assert(hourlyChart.some(c => c.ts === T) && hourlyChart.some(c => c.ts === T + 120 * M));
const featureCopy = JSON.stringify(discoverEncounters(frames, spec));
attachOutcomes([e], bars, spec);
bars.slice(20).forEach(b => { b.close *= .5; });
assert.equal(JSON.stringify(discoverEncounters(frames, spec)), featureCopy, "future price mutations cannot alter encounter features");

const cs: Control[] = [2, 1].map(days => ({ frame: { ...frame(T - days * 86400000), zones: [{ ...zone, price: 80 }] }, future4h: null }));
const before = structuredClone(e); before.controlAt = null;
matchControls([before], cs, spec); const matched = before.controlAt;
cs[0].future4h = { ...label, retPct: -99 }; cs[1].future4h = { ...label, retPct: 99 };
const after = structuredClone(e); after.controlAt = null;
matchControls([after], cs, spec); assert.equal(after.controlAt, matched, "outcomes cannot select a matched control");
assert(matched !== null && matched + 241 * M <= e.at);
const duplicate = structuredClone(e); duplicate.id += "-second";
matchControls([after, duplicate], cs, spec); assert.notEqual(after.controlAt, duplicate.controlAt, "without replacement");
const away = Array.from({ length: 4 }, (_, i) => ({ ...frame(T - (3 - i) * 5 * M), zones: [{ ...zone, price: 80 }] }));
assert.equal(selectControls(away, spec).length, 1); away[1].zones = [zone];
assert.equal(selectControls(away, spec).length, 0, "away controls cannot contain a near-level observation");

// Production S/R prefix engine and sampled pulse tape: future append cannot
// revise historical frame/zone/features, including rolling 4h EMA strata.
const history: Candle[] = Array.from({ length: 40 * 1440 + 180 }, (_, i) => {
  const ts = T - 40 * 86400000 + i * M, price = 100 + Math.sin(i / 80) + .2 * Math.sin(i / 7);
  return { ts, endTs: ts + M, open: price, close: price + .01, high: price + .05, low: price - .05, volume: 10, turnover: 1000 };
});
const smallSpec = { ...spec, start: new Date(T).toISOString(), end: new Date(T + 60 * M).toISOString() };
const cfg = { ...DEFAULT_SR_MEMORY_ZONE_CONFIG, enabled: true }, tape = new ReplayMarketInputs(); tape.seal();
const a = buildFrames(history.filter(c => c.endTs <= T + 60 * M), cfg, tape, smallSpec);
const b = buildFrames(history, cfg, tape, smallSpec);
assert.deepEqual(a, b); assert(a.length > 0 && a.every(f => f.srHealthy));
assert(a.some(f => f.zones.length > 0), "nonempty confirmed zone test");
const sample = summarizeStudy([e], cs, spec);
assert.equal(sample.passing.length, 0, "a tiny profitable sample must never pass");
const pair = [1, 3].map(retPct => ({ ...structuredClone(e), future4h: { ...label, retPct } }));
const pairSummary = summarizeStudy(pair, [], spec);
assert.equal(pairSummary.candidates.find(c => c.id === "resistance_hold_with")!.medianPct, -2, "even-size median averages the central pair");
const x = Array.from({ length: 20 }, (_, i) => ({ at: T + i * 86400000, value: i % 3 }));
assert.deepEqual(blockInterval(x, x, spec), blockInterval(x, x, spec));
assert.equal(blockInterval(x, x, spec).low, 0);
console.log("S/R encounter tests passed: known/frozen levels, delayed confirmation, non-overlap, missingness, future-prefix invariance, exact outcome boundaries, label-blind controls and thin-sample rejection");
