import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import { buildRejectionGroups } from './high-touch-rejection-signals';
import { referenceGroups } from './high-touch-rejection-verify';
import { highSignals } from './high-touch-short-signals';
import { rejectionAttribution } from './high-touch-rejection-study';
import type { Candle } from './hype-freerun-canonical-replay';
const c = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../research-inputs/high-touch-rejection-ht03-2026-09-18.json'), 'utf8'));
const M = 60000, start = Date.UTC(2026, 0, 1);
let scenarios = 0;
for (let seed = 1; seed <= 8; seed++) {
  let random = seed;
  const next = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296; };
  const cs: Candle[] = Array.from({ length: 240 }, (_, i) => {
    const open = 99 + next() * 3, close = 99 + next() * 3;
    return { ts: start + i * M, endTs: start + (i + 1) * M, open, close,
      high: Math.max(open, close) + next() * 2, low: Math.min(open, close) - next() * 2, volume: 1, turnover: 100 };
  });
  const anchors = highSignals(cs, 4).groups[0].evidence;
  assert(anchors.length > 10);
  const all = buildRejectionGroups(cs, anchors);
  assert.deepEqual(all, referenceGroups(cs, anchors, c.groups));
  for (const length of [60, 120, 239]) {
    const prefix = cs.slice(0, length), known = anchors.filter(a => a.observationEnd <= prefix.at(-1)!.endTs);
    const receiptCutoff = prefix.at(-1)!.endTs + M;
    const before = buildRejectionGroups(prefix, known);
    assert.deepEqual(before, referenceGroups(prefix, known, c.groups));
    const poison = cs.map((b, i) => i < length ? b : { ...b, open: 1000, high: 1100, low: 900, close: 1000 });
    const after = buildRejectionGroups(poison, known);
    for (const g of before) assert.deepEqual(g.signals, after.find(x => x.id === g.id)!.signals.filter(s => s.at <= receiptCutoff));
    scenarios++;
  }
}
const shared = { id: 'same', entryAt: 1, net: 10 }, old = { id: 'rescheduled', entryAt: 2, net: -20 };
const changed = { id: 'rescheduled', entryAt: 3, net: 5 };
const attr = rejectionAttribution({ trades: [shared, old], open: { net: -3 } }, { trades: [shared, changed], open: { net: -1 } });
assert.equal(attr.shared, 1); assert.equal(attr.changedTimeSameAnchor, 1); assert.equal(attr.delta, 27);
assert.equal(attr.deltaWithoutTwoLargestAvoidedLosses, 7);
assert.throws(() => rejectionAttribution({ trades: [shared] }, { trades: [{ ...shared, net: 99 }] }));
console.log(`HT03 independent-reference synthetic checks passed (${scenarios} prefix/poison scenarios, 10 groups; attribution identities).`);
