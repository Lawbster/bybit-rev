/** L14: frozen local-only extension of L13; no live or executor imports. */
import assert from "assert/strict";
import type { BotConfig } from "../src/bot/bot-config";
import type { ResearchInventoryEvent, ResearchReductionDecision, ResearchSizeDecision } from "./replay-causal-engine";
export type R = Record<string, any>;
export const PARENT = "age8__exit_2d_1pct";
export type Policy = { id: string; ageHours: number | null; days: number | null; proximityPct: number; exitAgeHours: number; legs: string[] };
const anchor: Policy = { id: PARENT, ageHours: 8, days: 2, proximityPct: 1, exitAgeHours: 4, legs: [] };
export const CONTROLS: Policy[] = [
  { ...anchor, id: "baseline", ageHours: null, days: null },
  { ...anchor, id: "age8", days: null },
  { ...anchor, id: "exit_2d_1pct", ageHours: null }, anchor,
  ...["minus_sr_partial", "minus_tp_cooldown"].map(id => ({ ...anchor, id, ageHours: null, days: null, legs: [id] }))
];
export const VARIANTS: Policy[] = [
  ...[6, 10, 12].map(ageHours => ({ ...anchor, id: `tp_age${ageHours}`, ageHours })),
  ...[.5, .75, 1.25, 1.5, 2].map(proximityPct => ({ ...anchor, id: `near_${proximityPct}pct`, proximityPct })),
  ...[5, 6, 8].map(exitAgeHours => ({ ...anchor, id: `exit_age${exitAgeHours}`, exitAgeHours })),
  ...[1, 3, 5, 6].map(days => ({ ...anchor, id: `high_${days}d`, days })),
  ...[
    ["last11_50"], ["minus_deep_stress"], ["minus_sr_partial"], ["minus_tp_cooldown"],
    ["last11_50", "minus_deep_stress"], ["last11_50", "minus_sr_partial"],
    ["last11_50", "minus_tp_cooldown"], ["minus_deep_stress", "minus_sr_partial"],
    ["minus_deep_stress", "minus_tp_cooldown"]
  ].map(legs => ({ ...anchor, id: `plus_${legs.join("__")}`, legs }))
];
export const POLICIES = [...CONTROLS, ...VARIANTS];
export function validate(d: R) {
  assert.deepEqual(d.controls, CONTROLS); assert.deepEqual(d.variants, VARIANTS);
  assert.equal(VARIANTS.length, 24); assert.equal(new Set(POLICIES.map(p => p.id)).size, 30);
  assert.equal(d.runs, 170); assert.equal(d.start, "2026-05-17T20:43:00Z"); assert.equal(d.cutoff, "2026-09-10T05:08:00Z");
  assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055); assert.deepEqual(d.sourceLags, [0, 60000]);
}
export function config(current: BotConfig, p: Policy): BotConfig {
  const c = structuredClone(current);
  for (const [leg, owner] of [["minus_deep_stress", c.deepAddStressGuard], ["minus_sr_partial", c.srPartialExitAction], ["minus_tp_cooldown", c.tpCooldown]] as const) {
    assert.equal(owner?.enabled, true); if (p.legs.includes(leg)) owner!.enabled = false;
  }
  return c;
}
export const size = (p: Policy, d: Readonly<ResearchSizeDecision>) => d.requestedNotional * (p.legs.includes("last11_50") && d.nextDepth === 11 ? .5 : 1);
export class AgeHighController {
  inventory: readonly R[] = [];
  rows: Array<[number, number, number, boolean, boolean]> = [];
  traces: R[] = [];
  constructor(readonly policy: Policy, readonly source: (index: number, at: number, price: number) => R | null) {}
  readonly observe = (e: Readonly<ResearchInventoryEvent>) => { assert.deepEqual(e.before, this.inventory); this.inventory = e.after; };
  readonly reduce = (d: Readonly<ResearchReductionDecision>) => {
    if (this.policy.days === null || !d.depth) return null;
    assert.equal(d.depth, this.inventory.length);
    const ageMs = d.at - Math.min(...this.inventory.map(p => p.entryTime));
    const eligible = d.canReduce && ageMs >= this.policy.exitAgeHours * 3600000;
    const f = eligible ? this.source(d.index, d.at, d.price) : null;
    const fire = eligible && f !== null && f.distancePct <= this.policy.proximityPct + 1e-10;
    this.rows.push([d.index, d.episode, d.depth, d.canReduce, fire]);
    if (!fire) return null;
    this.traces.push({ decision: d, ageMs, feature: f, inventory: this.inventory });
    // Retain historical close-reason identity for exact parent/high controls.
    return { fraction: 1, reason: `research_exit:exit_${this.policy.days}d_${this.policy.proximityPct}pct`, fillDelayMs: 0 };
  };
}
