/** AG10-E1: two fixed research-only timer restraints. No runtime writes. */
import assert from "assert/strict";
import { POLICIES as L15, config, AgeHighController, type Policy, type R } from "./age10-gate-policy";
import type { PriceContext } from "./aggressive10-discriminator-context";
export { config, AgeHighController, type R };
export const LEAD = "age10__minus_deep_stress__minus_tp_cooldown";
export type SelectivePolicy = Policy & { restraint?: "vwap_roc" | "hour_structure" };
export const CONTROLS: SelectivePolicy[] = ["baseline", "tp_age10", LEAD].map(id => structuredClone(L15.find(p => p.id === id)!));
export const VARIANTS: SelectivePolicy[] = ["vwap_roc", "hour_structure"].map(restraint => ({
  ...structuredClone(CONTROLS[2]), id: `aggressive10_selective_${restraint}`, restraint: restraint as SelectivePolicy["restraint"]
}));
export const POLICIES = [...CONTROLS, ...VARIANTS];
export const SCREEN = { minimumRecentNetDelta: 1000, minimumPublishedNetDelta: 0, minimumMonthlyDelta: -250,
  maximumDrawdownIncreasePp: 0, minimumInterventionEpisodes: 20 };
export function validate(d: R) {
  assert.deepEqual(d.controls, CONTROLS); assert.deepEqual(d.variants, VARIANTS);
  assert.equal(d.runs, 26); assert.equal(d.newTradingDefinitions, 2);
  assert.equal(d.start, "2026-05-17T20:43:00Z"); assert.equal(d.cutoff, "2026-09-10T05:08:00Z");
  assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055);
  assert.deepEqual(d.sourceLags, [0, 60000]); assert.deepEqual(d.screen, SCREEN);
}
/** Last completed hour/session only. Undefined context restores the original guard. */
export function hourlyWeakness(kind: SelectivePolicy["restraint"], p: R): boolean | null {
  if (!kind) return false;
  if (!p.hour || !p.previousHour || !Number.isFinite(p.roc1h)) return null;
  if (kind === "hour_structure") return p.hour.high < p.previousHour.high && p.hour.close < p.previousHour.low;
  if (!Number.isFinite(p.sessionVwap)) return null;
  return p.hour.close < p.sessionVwap && p.roc1h < 0;
}
export function selectiveBlock(kind: SelectivePolicy["restraint"], originalWouldBlock: boolean, weak: boolean | null) {
  return !!kind && originalWouldBlock && weak !== false;
}
/** Shared causal primitives from the frozen diagnostic; no future outcomes accepted. */
export class SelectiveContext {
  readonly cache = new Map<number, R>();
  constructor(readonly price: PriceContext) {}
  at(at: number, lag: number) {
    const asOf = at - lag; assert([0, 60000].includes(lag));
    if (!this.cache.has(asOf)) {
      const p = this.price.at(asOf, asOf); // Entry-anchored fields are not used.
      this.cache.set(asOf, { asOf, hour: p.hour, previousHour: p.previousHour, roc1h: p.roc1h, sessionVwap: p.sessionVwap });
    }
    return this.cache.get(asOf)!;
  }
}
export function qualification(rows: R[], comparisons: R[], d: R) {
  return VARIANTS.map(p => {
    const xs = rows.filter(x => x.primary && x.policy === p.id), failures: string[] = [], incremental: string[] = [];
    for (const x of xs) {
      const c = comparisons.find(c => c.name === x.name)!, recent = x.window === "hl_extended";
      if (c.baseline.pnlDelta < (recent ? d.screen.minimumRecentNetDelta : d.screen.minimumPublishedNetDelta)) failures.push(`${x.model}:net`);
      if (c.baseline.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`);
      if (c.baseline.worstMonthDelta < d.screen.minimumMonthlyDelta) failures.push(`${x.model}:monthly`);
      if (recent && x.counts.blockEpisodes < d.screen.minimumInterventionEpisodes) failures.push(`${x.model}:thin_new_intervention`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:nonpositive_equity`);
      if (recent ? c.parent.pnlDelta <= 0 : c.parent.pnlDelta < 0) incremental.push(`${x.model}:parent_net`);
      if (c.parent.ddReductionPp < -1e-9) incremental.push(`${x.model}:parent_drawdown`);
      if (c.parent.worstMonthDelta < d.screen.minimumMonthlyDelta) incremental.push(`${x.model}:parent_monthly`);
      if (recent && x.counts.blockEpisodes < 20) incremental.push(`${x.model}:thin_new_intervention`);
    }
    return { policy: p.id, minimumRecentParentDelta: Math.min(...xs.filter(x => x.window === "hl_extended").map(x => comparisons.find(c => c.name === x.name)!.parent.pnlDelta)),
      aggregateBaselineAllFour: xs.every(x => { const c = comparisons.find(c => c.name === x.name)!.baseline; return c.pnlDelta > 0 && c.ddReductionPp >= -1e-9; }),
      passesBaselineScreen: !failures.length, failures, passesIncrementalScreen: !incremental.length, incrementalFailures: incremental, deployable: false };
  }).sort((a, b) => b.minimumRecentParentDelta - a.minimumRecentParentDelta);
}
