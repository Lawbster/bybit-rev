import assert from "assert/strict";
import { inventoryAtDecision } from "./conditional-soft-stale-check";
import { auditSoftStalePath } from "./conditional-soft-stale-path-audit";
const t = Date.UTC(2026, 8, 1), m = 60000;
const p = { id: "p1", entryTime: t, entryPrice: 100, notional: 800, qty: 8, level: 0 };
const p2 = { id: "p2", entryTime: t + m, entryPrice: 102, notional: 1080, qty: 1080 / 102, level: 1 };
const events: any[] = [
  { event: { kind: "open", fillAt: t, fillIndex: 0 }, episode: 1, after: [p] },
  { event: { kind: "open", fillAt: t + m, fillIndex: 1 }, episode: 1, after: [p, p2] }
];
assert.equal(inventoryAtDecision(events, 0).length, 1, "next-open fill timestamp equals previous close but must not leak into its inventory");
assert.equal(inventoryAtDecision(events, 1).length, 2);
const cs: any[] = [0, 1].map(i => ({ ts: t + i * m, endTs: t + (i + 1) * m, close: i ? 102 : 100 }));
const targets = [{ index: 0, episode: 1, pct: 1.4, targetPrice: 101.4 }, { index: 1, episode: 1, pct: 1.4, targetPrice: 1880 / (8 + 1080 / 102) * 1.014 }];
const row = { name: "fixture", startIdx: 0, endIdx: 2, control: true, policy: { id: "baseline" }, pendingAtEnd: null };
auditSoftStalePath(cs, events, targets, [], row, {}, {}, {});
assert.throws(() => auditSoftStalePath(cs, events, [{ ...targets[0], targetPrice: targets[1].targetPrice }, targets[1]], [], row, {}, {}, {}), /inventory target/);
assert.throws(() => auditSoftStalePath(cs, events, [{ ...targets[0], pct: .5 }, targets[1]], [], row, {}, {}, {}), /target policy/);
console.log("F06 audit regressions passed: same-epoch next-open ordering and incorrect target rejection");
