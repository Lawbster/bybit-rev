import assert from "assert/strict";
import { trailingHighIndices, highFeature, HighController, HIGH_POLICIES, nearHigh } from "./near-high-policy";
const M = 60000;
const bars = Array.from({ length: 100 }, (_, i) => ({ ts: i * M, endTs: (i + 1) * M, open: 100, close: 100, high: 101 + (i * 17 % 9), low: 99, volume: 1, turnover: 100 }));
for (const w of [1, 3, 9, 50]) {
  const idx = trailingHighIndices(bars, w);
  for (let i = 0; i < bars.length; i++) {
    if (i < w - 1) assert.equal(idx[i], -1);
    else assert.equal(bars[idx[i]].high, Math.max(...bars.slice(i - w + 1, i + 1).map(c => c.high)));
  }
  const changed = bars.map((x, i) => i < 70 ? x : { ...x, high: x.high * 100 });
  assert.deepEqual(idx.slice(0, 70), trailingHighIndices(changed, w).slice(0, 70));
  assert.deepEqual(idx.slice(0, 70), trailingHighIndices(bars.slice(0, 70), w));
}
const gap = bars.filter((_, i) => i !== 70), gi = trailingHighIndices(gap, 3);
assert.equal(gi[70], -1); assert.equal(gi[71], -1); assert(gi[72] >= 0);
assert(nearHigh({ distancePct: 1 }, 1)); assert(!nearHigh({ distancePct: 1.001 }, 1)); assert(!nearHigh(null, 2));
const ix = trailingHighIndices(bars, 3), f = highFeature(bars, ix, 10, 3 / 1440, bars[10].endTs, 120, M)!;
assert.equal(f.sourceEnd, bars[9].endTs); assert(f.highAt <= f.sourceEnd); assert.equal(f.distancePct, 0); assert(f.aboveReference);
const inv: any = [{ entryTime: 0, qty: 1, notional: 100, entryPrice: 100 }];
const c = new HighController(HIGH_POLICIES.find(x => x.id === "exit_7d_1pct")!, () => ({ distancePct: .9 })); c.inventory = inv;
const d: any = { at: 4 * 3600000, index: 239, episode: 1, depth: 1, price: 100, qty: 1, cost: 100, grossPct: 0, canReduce: true, existingPendingReason: null };
assert.equal(c.reduce({ ...d, at: d.at - 1 }), null); assert.equal(c.reduce({ ...d, canReduce: false }), null);
assert.equal(c.reduce(d)?.fraction, 1); assert.equal(c.reduce({ ...d, depth: 0 }), null);
const unknownExit = new HighController(c.policy, () => null); unknownExit.inventory = inv; assert.equal(unknownExit.reduce(d), null);
const block = new HighController(HIGH_POLICIES[0], () => ({ distancePct: .9 })); block.inventory = Array(7).fill(inv[0]);
const a: any = { at: M, index: 0, episode: 1, nextDepth: 8, price: 100, priceDropOk: true };
assert(block.add(a)); block.inventory = Array(6).fill(inv[0]); assert(!block.add({ ...a, nextDepth: 7 }));
const unknownBlock = new HighController(HIGH_POLICIES[0], () => null); unknownBlock.inventory = Array(7).fill(inv[0]); assert(unknownBlock.add(a));
console.log("near-high tests passed: exact trailing windows, boundaries, gap reset, future perturbation/prefix, lag, breakout, stale age, priority, shallow/deep, missingness");
