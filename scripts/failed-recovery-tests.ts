import assert from "assert/strict";
import { EMA } from "technicalindicators";
import { M, H, priceFeatures, supportResponse, descriptors, summarize, inventoryAt } from "./failed-recovery-analysis";
import { evidence, IndicatorContextTape } from "./indicator-hl-sr-context";
import { read } from "./hype-failed-recovery-study";
const spec = read("research-inputs/failed-recovery-2026-09-08.json");
const cs = Array.from({ length: 61000 }, (_, i) => { const p = 100 + i / 100000 + Math.sin(i / 100); return { ts: i * M, endTs: (i + 1) * M,
  open: p, close: p, high: p + .1, low: p - .1, volume: 2, turnover: 2 * p }; });
const at = 60557 * M, p = priceFeatures(cs, at), prefix = cs.filter(c => c.endTs <= at);
assert.deepEqual(priceFeatures(prefix, at), p);
const end = Math.floor(at / (4 * H)) * 4 * H, closes = Array.from({ length: 249 }, (_, i) => cs[(end - (248 - i) * 4 * H) / M - 1].close);
assert(Math.abs(EMA.calculate({ period: 200, values: closes }).at(-1)! - p.trend.ema200) < 1e-10);
assert(p.trend.sourceEnd <= at && p.trend.sourceEnd % (4 * H) === 0);
const prior = { coverage: { healthy: true }, nearestSupport: { zone: { price: 200, lastTouchKnownAt: at - 30 * M } } };
const sr = supportResponse(cs, at, prior, prior); assert.equal(sr.broken, true); assert.equal(sr.failedRetest, false);
assert(sr.bars.every((b: { end: number }) => b.end <= at && b.end % (5 * M) === 0)); assert.equal(sr.bars.at(-1)!.end, at - 2 * M);
assert.equal(supportResponse(cs, at, { ...prior, nearestSupport: null }, prior).broken, null);
assert.throws(() => supportResponse(cs, at, { ...prior, nearestSupport: { zone: { price: 200, lastTouchKnownAt: at } } }, prior));
const futureChanged = cs.map(c => c.endTs > at ? { ...c, close: 999, high: 1000, turnover: 1998 } : c);
assert.deepEqual(supportResponse(futureChanged, at, prior, prior), sr); assert.deepEqual(priceFeatures(futureChanged, at), p);
assert.equal(inventoryAt([{ event: { fillIndex: 1 }, episode: 1 }, { event: { fillIndex: 2 }, episode: 2 }], 1)!.episode, 1);
const pulse = { flow15: { healthy: true, ratio: .8 }, flow60: { healthy: true, ratio: .85 }, asset: { changes: [{ healthy: true, nativeOiChangePct: 1, markedOiChangePct: -2 }] } };
let d = descriptors(p, priceFeatures(cs, at - 15 * M), pulse, pulse, sr, cs);
assert.equal(d.D5, true); assert.equal(d.D7, false); assert.equal(d.D8, true);
d = descriptors(p, p, { ...pulse, flow15: { healthy: false, ratio: .8 } }, pulse, sr, cs);
assert.equal(d.D4, null); assert.equal(d.D5, null); assert.equal(d.D7, null);
const xs = [{ outcome: { pnl: -100 }, netEpisodeMark: -400, remainingValueChange: 300 },
  { outcome: { pnl: -700 }, netEpisodeMark: -300, remainingValueChange: -400 }, { outcome: null, netEpisodeMark: -500, remainingValueChange: null }];
const s = summarize(xs); assert.equal(s.losses, 2); assert.equal(s.furtherDeclines, 1); assert.equal(s.furtherRecoveries, 1);
assert.equal(s.diagnosticBalance, 100); assert.equal(s.censored, 1); assert.equal(s.marksAtObservation, -700);
const t = 100 * M, tape = new IndicatorContextTape(spec), delayed = new IndicatorContextTape(spec);
for (let n = 1; n <= 60; n++) {
  const end = t - n * M, raw = { timestamp: end, windowStart: end - M, windowEnd: end, buyNotional: 8, sellNotional: 10, buyVol: 8, sellVol: 10, buyCount: 1, sellCount: 1 };
  const r = evidence("hlTaker", raw, "fixture", n); tape.add(r);
  delayed.add(evidence("hlTaker", { ...raw, writtenAt: r.availableAt + 15000 }, "fixture", n));
}
tape.seal(); delayed.seal(); assert.equal(tape.snapshot(t).flow15.samples, 14); assert(tape.snapshot(t).flow15.healthy);
assert.equal(delayed.snapshot(t).flow15.samples, 13); assert.equal(delayed.snapshot(t).flow15.healthy, false);
const before = tape.snapshot(t); tape.add(evidence("hlTaker", { timestamp: t + M, windowStart: t, windowEnd: t + M, buyNotional: 100000, sellNotional: 1, buyVol: 100000, sellVol: 1, buyCount: 1, sellCount: 1 }, "future", 1)); tape.seal();
assert.deepEqual(tape.snapshot(t), before);
console.log("failed recovery: closed-prefix, EMA, real5m boundary, frozen support, future/unknown/delay, native vs marked OI, censored and remaining-value fixtures passed");
