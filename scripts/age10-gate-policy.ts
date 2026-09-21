/** L15: three predeclared 10h combinations; unchanged L14 policy primitives. */
import assert from "assert/strict";
import { CONTROLS as C14, VARIANTS as V14, type Policy, type R } from "./age-high-refinement-policy";
export { config, size, AgeHighController, type Policy, type R } from "./age-high-refinement-policy";
export const PARENT = "tp_age10";
export const AGGRESSIVE = "plus_minus_deep_stress__minus_tp_cooldown";
export const CONTROLS: Policy[] = ["baseline", "age8__exit_2d_1pct", PARENT,
  "plus_minus_deep_stress", "plus_minus_tp_cooldown", AGGRESSIVE].map(id => {
  const p = [...C14, ...V14].find(p => p.id === id); assert(p); return structuredClone(p);
});
export const VARIANTS: Policy[] = [["minus_tp_cooldown"], ["minus_deep_stress"], ["minus_deep_stress", "minus_tp_cooldown"]]
  .map(legs => ({ ...structuredClone(CONTROLS.find(p => p.id === PARENT)!), id: `age10__${legs.join("__")}`, legs }));
export const POLICIES = [...CONTROLS, ...VARIANTS];
export const SENSITIVITY = [PARENT, AGGRESSIVE, ...VARIANTS.map(p => p.id)];
export function validate(d: R) {
  assert.deepEqual(d.controls, CONTROLS); assert.deepEqual(d.variants, VARIANTS);
  assert.equal(new Set(POLICIES.map(p => p.id)).size, 9);
  assert.equal(d.runs, 46); assert.equal(d.newTradingDefinitions, 3);
  assert.equal(d.start, "2026-05-17T20:43:00Z"); assert.equal(d.cutoff, "2026-09-10T05:08:00Z");
  assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055);
  assert.deepEqual(d.sourceLags, [0, 60000]); assert.deepEqual(d.sensitivityPolicies, SENSITIVITY);
  assert.deepEqual(d.screen, { minimumRecentNetDelta: 1000, minimumPublishedNetDelta: 0, minimumMonthlyDelta: -250,
    maximumDrawdownIncreasePp: 0, minimumInterventionEpisodes: 20 });
}
