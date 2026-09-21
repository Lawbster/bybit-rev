/** Audit-only regression: distinguish pre-arm ordinary and post-arm research exits. */
import assert from "assert/strict";
import { auditSoftStalePath } from "./conditional-soft-stale-path-audit";
import { auditCombinationTargetPath } from "./ladder-combination-target-audit";
const T = Date.UTC(2026, 8, 1), M = 60000;
const p = { id: "p", entryTime: T - 4 * 3600000, entryPrice: 100, notional: 800, qty: 8, level: 0 };
const cs: any[] = [0, 1].map(i => ({ ts: T + i * M, endTs: T + (i + 1) * M, close: 100 }));
const open = { event: { kind: "open", fillAt: T, fillIndex: 0 }, episode: 1, after: [p] } as any;
const close = (reason: string) => ({ event: { kind: "close", reason, decisionAt: T + M, decisionIndex: 0, fillAt: T + M, fillIndex: 1 }, episode: 1, after: [] }) as any;
const t = [{ index: 0, episode: 1, pct: 1.4, targetPrice: 101.4 }];
const o = [{ status: "extended", at: T + M, episode: 1 }];
const one = { checks: 1, eligibleChecks: 1, deferredChecks: 1, unknownChecks: 0 }, zero = { checks: 0, eligibleChecks: 0, deferredChecks: 0, unknownChecks: 0 };
const x = { name: "post-arm-close", startIdx: 0, endIdx: 2, control: false, policy: { id: "age8", family: "age" }, sensitivity: { sourceLagMs: 0, releaseDelayMs: 0 }, audit: one, pendingAtEnd: null };
const ev = [open, close("research_exit:exit_2d_1pct")];
assert.throws(() => auditSoftStalePath(cs, ev, t, o, x, {}, {}, {}), /first eligibility/);
assert.deepEqual(auditCombinationTargetPath(cs, ev, t, o, x, {}, {}, {}), one);
assert.throws(() => auditCombinationTargetPath(cs, ev, [{ ...t[0], pct: .5 }], o, x, {}, {}, {}), /target policy/);
const ordinary = [open, close("hard_flatten")], pre = { ...x, audit: zero };
assert.deepEqual(auditCombinationTargetPath(cs, ordinary, [], [], pre, {}, {}, {}), zero);
assert.deepEqual(auditCombinationTargetPath(cs, ordinary, [], [], pre, {}, {}, {}), auditSoftStalePath(cs, ordinary, [], [], pre, {}, {}, {}));
const pending = { ...x, endIdx: 1, pendingAtEnd: { kind: "close", reason: "research_exit:exit_2d_1pct", decisionIndex: 0 } };
assert.deepEqual(auditCombinationTargetPath(cs.slice(0, 1), [open], t, o, pending, {}, {}, {}), one);
assert.deepEqual(auditCombinationTargetPath(cs.slice(0, 1), [open], [], [], { ...pending, audit: zero, pendingAtEnd: { ...pending.pendingAtEnd, reason: "hard_flatten" } }, {}, {}, {}), zero);
// Pro-rata partial preserves average/target price but quiesces and rearms at a NEW index.
// Compressed price-change telemetry alone must not be treated as a full arm ledger.
const partial: any = { event: { kind: "partial", reason: "research_exit:mfi_weekly_half", decisionIndex: 0, fillIndex: 1, fillAt: T + M }, episode: 1,
  after: [{ ...p, qty: 4, notional: 400 }] };
const arms: any[] = [];
auditCombinationTargetPath(cs, [open, partial], t, o, { ...x, audit: { ...one, checks: 2, eligibleChecks: 2, deferredChecks: 2 } }, {}, {}, {}, v => arms.push(v));
assert.deepEqual(arms.map(a => a.armedIndex), [0, 1]); assert.equal(arms[0].targetPrice, arms[1].targetPrice);
console.log("L13 audit-only ordering tests passed: research post-arm/ordinary pre-arm, pending cutoff and incorrect-target rejection");
