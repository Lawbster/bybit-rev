import assert from "assert/strict";
import { PriceContext, PulseContext, descriptors, IDS, M, H, type R } from "./aggressive10-discriminator-context";
import { summarize } from "./aggressive10-discriminator-study";
import type { Candle } from "./hype-freerun-canonical-replay";
const T = Date.UTC(2026, 0, 1);
const cs: Candle[] = Array.from({ length: 96 * 60 }, (_, i) => ({ ts: T + i * M, endTs: T + (i + 1) * M,
  open: 100, high: 100.2, low: 99.8, close: 100, volume: i % 10 + 1, turnover: 100 * (i % 10 + 1) }));
for (let i = 60 * 60; i < 61 * 60; i++) cs[i] = { ...cs[i], open: 108, high: 110, low: 106, close: 107, turnover: cs[i].volume * 107 };
for (let i = 61 * 60; i < cs.length; i++) cs[i] = { ...cs[i], open: 105, high: 105.5, low: 104, close: 104.5, turnover: cs[i].volume * 104.5 };
const at = T + (61 * 60 + 45) * M, ctx = new PriceContext(cs), p = ctx.at(at, T + 60 * H);
const absent: R = { flow15: { healthy: false }, flow60: { healthy: false }, book: { healthy: false } };
const flags = descriptors(p, absent, absent, at, null);
assert.equal(p.anchor.endTs, T + 61 * H); assert(p.distance2dPct > 1); assert(flags.remembered_high_break);
assert.equal(flags.near_high_weak_hour, false); assert.equal(flags.flow_book_sell, null);
assert.equal(descriptors(ctx.at(T + (61 * 60 + 15) * M, T + 60 * H), absent, absent, at, null).remembered_high_break, false, "Both15m closes must be strictly after confirmed anchor");
assert.equal(ctx.at(T + 60 * H + 59 * M, T + 60 * H).hour.endTs, T + 60 * H, "No forming hourly candle");
const prefix = cs.filter(c => c.endTs <= at), modified = cs.map(c => c.endTs > at ? { ...c, high: 10000, close: 9999, turnover: 9999 * c.volume } : c);
assert.deepEqual(new PriceContext(prefix).at(at, T + 60 * H), p);
assert.deepEqual(new PriceContext(modified).at(at, T + 60 * H), p, "Future OHLC cannot alter high, hourly features, anchor or VWAP");
const raw = cs.filter(c => c.ts >= T + 60 * H && c.endTs <= at);
assert(Math.abs(p.ladderVwap - raw.reduce((n, c) => n + c.turnover, 0) / raw.reduce((n, c) => n + c.volume, 0)) < 1e-8);
const q = { minTaker15mSamples: 14, minTaker1hSamples: 55, maxTakerAgeSec: 90, maxBookAgeSec: 30, maxAssetAgeSec: 60, maxAssetAnchorLagSec: 120 };
const pulse = new PulseContext(q), flowRows: R[] = [];
for (let i = -80; i <= -1; i++) {
  const end = at + i * M, row = { timestamp: end, windowStart: end - M, windowEnd: end,
    buyNotional: 2, sellNotional: 1, buyVol: 2, sellVol: 1, buyCount: 1, sellCount: 1, firstTradeTime: end - M + 1, lastTradeTime: end - 1 };
  flowRows.push(row); pulse.add("hlTaker", row, flowRows.length);
}
pulse.seal(); const base = pulse.at(at, at); assert(base.flow15.healthy); assert(base.flow60.healthy); assert.equal(base.flow15.ratio, 2);
assert.equal(base.flow15.samples, 14); assert.equal(base.flow15.ageSec, 60);
const delayed = pulse.at(at - M, at); assert.equal(delayed.flow15.ageSec, 120); assert(!delayed.flow15.healthy, "Extra60s must retain added staleness");
const future = { ...flowRows.at(-1), timestamp: at, windowStart: at - M, windowEnd: at, receivedAt: at + M, buyNotional: 100000, firstTradeTime: at - 1, lastTradeTime: at - 1 };
pulse.add("hlTaker", future, 100); pulse.seal(); assert.deepEqual(pulse.at(at, at), base, "Future receipt cannot enter current flow");
const duplicate = new PulseContext(q); flowRows.forEach((r, i) => duplicate.add("hlTaker", r, i)); duplicate.add("hlTaker", flowRows.at(-1)!, 101); duplicate.seal();
assert(!duplicate.at(at, at).flow15.healthy); assert.equal(duplicate.at(at, at).flow15.duplicates, 1);
const good = { ...base, flow15: { ...base.flow15, ratio: 2.63 }, flow60: { ...base.flow60, ratio: .916 } };
const goodFlags = descriptors({ ...p, ret15m: .2 }, good, good, at, null);
assert(goodFlags.buying_recovery); assert.equal(goodFlags.flow_deterioration, false, "A below1 hourly ratio alone is not deteriorating fast flow");
assert.deepEqual(Object.keys(goodFlags), IDS);
const labels = new Map([['a', { pnl: 100, guardedSameEntryPnl: 50 }], ['b', { pnl: -1000, guardedSameEntryPnl: null }], ['c', { pnl: null }]]);
const s = summarize([{ labelId: 'a' }, { labelId: 'b' }, { labelId: 'c' }], labels);
assert.equal(s.net, -900); assert.equal(s.unfinished, 1); assert.equal(s.netWithoutLargestLoss, 100); assert.equal(s.matchedDelta, 50);
console.log("AG10-D1 tests passed: closed-hour/15m anchor timing, future-prefix OHLC and receipt invariance, independent VWAP, missing/duplicate/stale flow, buying exception and cohort accounting");
