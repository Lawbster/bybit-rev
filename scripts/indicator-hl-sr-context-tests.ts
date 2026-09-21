import assert from "assert/strict";
import { evidence, IndicatorContextTape, validFlow, M, H, attachSr } from "./indicator-hl-sr-context";
import { ReplaySrContext } from "./replay-sr-context";
const spec = { quality: { minTaker15mSamples: 14, minTaker1hSamples: 55, maxTakerAgeSec: 90, maxBookAgeSec: 30, maxAssetAgeSec: 60, maxAssetAnchorLagSec: 120 } };
const T = Date.UTC(2026, 5, 1, 12), flow = (end: number, extra = {}) => ({ timestamp: end, windowStart: end - M, windowEnd: end,
  buyNotional: 8, sellNotional: 10, buyVol: 8, sellVol: 10, buyCount: 1, sellCount: 1, firstTradeTime: end - 1000, lastTradeTime: end - 1, ...extra });
const tape = new IndicatorContextTape(spec);
for (let i = 0; i < 61; i++) tape.add(evidence("hlTaker", flow(T - i * M), "flow", i + 1));
const bands = { pct_0_25: 10, pct_0_5: 20, pct_2_0: 100 }, flags = { pct_0_25: false, pct_0_5: false, pct_2_0: false };
const book = (at: number, extra = {}) => ({ timestamp: at, exchangeTimestamp: at - 1000, bidBands: bands, askBands: bands,
  bidBandsTruncated: flags, askBandsTruncated: flags, bandResolutionTooCoarse: flags, ...extra });
tape.add(evidence("book", book(T - 10_000), "book", 1));
for (const [at, oi, price] of [[T - 4 * H - 10_000, 100, 2], [T - H - 10_000, 100, 2], [T - 10_000, 100, 3]])
  tape.add(evidence("asset", { timestamp: at, openInterest: oi, markPrice: price }, "asset", at));
tape.seal(); const a = tape.snapshot(T);
assert(a.flow15.healthy && a.flow60.healthy && a.book.healthy && a.asset.changes.every((c: any) => c.healthy));
assert.equal(a.flow15.samples, 14); assert.equal(a.flow15.ratio, .8);
assert.equal(a.asset.changes[0].nativeOiChangePct, 0); assert.equal(a.asset.changes[0].markedOiChangePct, 50);
assert(a.flow15.sources.every((r: any) => r.sourceAt < T && r.eligibleAt <= T));
const late = evidence("hlTaker", flow(T - 2 * M, { writtenAt: T + M }), "late", 1); assert(late.eligibleAt > T);
const prefix = new IndicatorContextTape(spec); tape.records.forEach(r => prefix.add(r)); prefix.add(late);
prefix.add(evidence("book", book(T + M, { bidBands: { ...bands, pct_0_5: 9999 } }), "future", 1)); prefix.seal();
assert.deepEqual(prefix.snapshot(T), a);
const dup = new IndicatorContextTape(spec); tape.records.forEach(r => dup.add(r)); dup.add(evidence("hlTaker", flow(T - M), "duplicate", 1)); dup.seal();
assert.equal(dup.snapshot(T).flow15.healthy, false); assert.equal(dup.snapshot(T).flow15.duplicates, 1);
assert(!validFlow(evidence("hlTaker", flow(T - M, { firstTradeTime: T - 3 * M }), "bad", 1)));
const coarse = new IndicatorContextTape(spec); coarse.add(evidence("book", book(T - 5000, { bandResolutionTooCoarse: { ...flags, pct_0_5: true } }), "coarse", 1)); coarse.seal();
assert.equal(coarse.snapshot(T).book.healthy, false); assert.equal(coarse.snapshot(T).flow15.healthy, false);
assert.equal(tape.snapshot(T + 3 * M).book.healthy, false);
const cfg = { enabled: true, tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: .0045, minTouches: 2, bufferPct: 1, recentDays: 14 };
const cs = Array.from({ length: 16 * 1440 }, (_, i) => { const p = 100 + 2 * Math.sin(i / 50); return { ts: T - 16 * 24 * H + i * M, endTs: T - 16 * 24 * H + (i + 1) * M, open: p, close: p, high: p + .1, low: p - .1, volume: 1, turnover: p }; });
const full = attachSr(cs, T, new ReplaySrContext(cs, cfg)); assert(full.coverage.healthy);
assert(full.zones.every((z: any) => z.touchData.every((t: any) => t.ts <= T) && z.usableAt <= T));
const withoutMinute = cs.filter((_, i) => i !== cs.length - 100);
assert(!new ReplaySrContext(withoutMinute, cfg).at(T).coverage.healthy);
const earlier = T - 6 * H, pc = cs.filter(c => c.endTs <= earlier);
assert.deepEqual(attachSr(cs, earlier, new ReplaySrContext(cs, cfg)), attachSr(pc, earlier, new ReplaySrContext(pc, cfg)));
console.log("H00 fixtures passed: availability, modeled lag, future/late exclusion, duplicate ambiguity, source freshness, book quality, native/marked OI, closed-prefix S/R and gaps.");
