import assert from "assert/strict";
import { trailingHighIndices, highFeature } from "./near-high-policy";
import { EXTENDED_DAYS, EXTENDED_POLICIES, ExtendedHighController, btcStrength } from "./near-high-extension-policy";
const M = 60000;
const cs = Array.from({ length: 47000 }, (_, i) => ({ ts: i * M, endTs: (i + 1) * M, open: 100, close: 100,
  high: 100.5 + (i % 17) / 100, low: 99, volume: 1, turnover: 100 }));
assert.equal(EXTENDED_POLICIES.length, 36); assert.equal(new Set(EXTENDED_POLICIES.map(p => p.id)).size, 36);
for (const days of EXTENDED_DAYS) {
  const w = days * 1440, idx = trailingHighIndices(cs, w);
  for (const i of [w - 1, w, cs.length - 1]) {
    const f = btcStrength(cs, idx, cs[i].endTs, days, 0)!; assert(f.strong); assert.equal(f.high, Math.max(...cs.slice(i - w + 1, i + 1).map(c => c.high)));
    assert.equal(f.sourceEnd, cs[i].endTs); assert.equal(f.returnSourceEnd, cs[i - 240].endTs);
    assert.deepEqual(f, btcStrength(cs.slice(0, i + 1), idx.slice(0, i + 1), cs[i].endTs, days, 0));
  }
  assert.equal(btcStrength(cs, idx, cs[w - 2].endTs, days, 0), null);
  const cutoff = cs.length - 2, poisoned = cs.map((c, i) => i <= cutoff ? c : { ...c, high: 1000000, close: 999999 });
  assert.deepEqual(btcStrength(cs, idx, cs[cutoff].endTs, days, 0), btcStrength(poisoned, trailingHighIndices(poisoned, w), cs[cutoff].endTs, days, 0));
  const lagged = btcStrength(cs, idx, cs.at(-1)!.endTs, days, M)!;
  assert.equal(lagged.sourceEnd, cs.at(-2)!.endTs); assert.equal(lagged.availableAt, cs.at(-1)!.endTs);
}
const gap = cs.filter((_, i) => i !== 45000), gi = trailingHighIndices(gap, 1440);
assert.equal(btcStrength(gap, gi, cs[45000].endTs, 1, 0), null);
assert.equal(btcStrength(gap, gi, cs[45001].endTs, 1, 0), null);
assert.equal(btcStrength(gap, gi, cs[46439].endTs, 1, 0), null);
assert(btcStrength(gap, gi, cs[46440].endTs, 1, 0)?.strong);
const weak = cs.map((c, i) => i === cs.length - 1 ? { ...c, close: 99.99 } : c);
assert.equal(btcStrength(weak, trailingHighIndices(weak, 1440), weak.at(-1)!.endTs, 1, 0)!.strong, false);
const far = cs.map((c, i) => i > cs.length - 242 ? { ...c, high: 100, close: 99 } : c);
assert.equal(btcStrength(far, trailingHighIndices(far, 1440), far.at(-1)!.endTs, 1, 0)!.strong, false);
const policy = EXTENDED_POLICIES.find(p => p.id === "btc_block_3d_2pct")!;
const inv = Array(7).fill({ entryTime: 0, qty: 1, notional: 100, entryPrice: 100 });
const d: any = { index: 5000, at: 5001 * M, episode: 1, nextDepth: 8, price: 100, priceDropOk: true };
for (const [hype, btc, expected] of [[{ distancePct: 1 }, { strong: true }, false], [{ distancePct: 1 }, { strong: false }, true],
  [{ distancePct: 1 }, null, true], [null, { strong: true }, true], [{ distancePct: 3 }, null, false]] as const) {
  const c = new ExtendedHighController(policy, () => hype, () => btc); c.inner.inventory = inv;
  assert.equal(c.add(d), expected); assert.equal(c.counts.vetoes, Number(expected));
  c.inner.inventory = inv.slice(0, 6); assert.equal(c.add({ ...d, nextDepth: 7 }), false);
}
const exit = new ExtendedHighController(EXTENDED_POLICIES.find(p => p.id === "exit_3d_2pct")!, () => ({ distancePct: 1 }), () => { throw Error("Exit must never consult BTC"); });
exit.inner.inventory = inv;
const r: any = { ...d, depth: 7, canReduce: true, at: 4 * 3600000 };
assert.equal(exit.reduce({ ...r, canReduce: false }), null); assert.equal(exit.reduce(r)?.fraction, 1);
const hi = trailingHighIndices(cs, 3 * 1440), f = highFeature(cs, hi, 5000, 3, d.at, 100, M)!;
assert(f.highAt <= f.sourceEnd && f.availableAt <= d.at);
console.log("L12 passed: all horizons, prefix/future poison, full-window readiness, exact BTC source/ROC timing, minute-gap reset, delayed sources, weakening/strong BTC, HYPE/BTC unknown, shallow/deep, raw veto only, unchanged exit priority");
