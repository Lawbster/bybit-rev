/** L10 research vetoes only. Owns no exchange, engine, or persisted trading state. */
import assert from "assert/strict";
import type { ResearchAddDecision, ResearchInventoryEvent } from "./replay-causal-engine";
export type R = Record<string, any>;
export type ConstructionPolicy = { id: string; family: "spacing" | "budget" | "recycle"; multiple?: number; capDepth?: number; mode?: string };
export const freshCost = (depth: number, base: number, scale: number) => Array.from({ length: depth }, (_, k) => base * scale ** k).reduce((a, b) => a + b, 0);
export function constructionDecision(p: ConstructionPolicy | null, d: Readonly<ResearchAddDecision>, inventory: readonly R[],
  trim: { at: number; price: number } | null, feature: R | null, cfg: R): R {
  const common = { veto: false, applicable: false, unknown: false };
  if (!p || !inventory.length) return { ...common, reason: "baseline_or_flat" };
  if (p.family === "recycle") {
    if (!trim) return { ...common, reason: "no_trim_anchor" };
    assert(d.at >= trim.at);
    const resetPrice = trim.price * (1 - cfg.priceTriggerPct / 100), elapsed = d.at - trim.at;
    const veto = p.mode === "wait60" ? elapsed < 3600000 : elapsed < 4 * 3600000 && d.price > resetPrice;
    return { ...common, applicable: true, veto, reason: veto ? "post_trim_wait" : "post_trim_released", trim, resetPrice, elapsed };
  }
  if (d.nextDepth < 8) return { ...common, reason: "shallow" };
  const qty = inventory.reduce((n, x) => n + x.qty, 0), cost = inventory.reduce((n, x) => n + x.notional, 0);
  if (p.family === "budget") {
    const grossPct = (d.price * qty / cost - 1) * 100;
    const cap = freshCost(p.capDepth!, cfg.basePositionUsdt, cfg.addScaleFactor);
    const requested = cfg.basePositionUsdt * cfg.addScaleFactor ** (d.nextDepth - 1);
    return { ...common, applicable: true, veto: grossPct <= -1 && cost + requested > cap + 1e-8,
      reason: "underwater_budget", grossPct, cap, cost, requested };
  }
  const valid = feature && feature.endTs <= d.at && feature.availableAt <= d.at && feature.healthy && feature.atr14 !== null && feature.atr14 > 0;
  if (!valid) return { ...common, applicable: true, veto: true, unknown: true, reason: "atr_unavailable" };
  const lastEntry = inventory.at(-1)!.entryPrice;
  const requiredDistance = Math.max(lastEntry * cfg.priceTriggerPct / 100, p.multiple! * feature.atr14);
  return { ...common, applicable: true, veto: d.price > lastEntry - requiredDistance, reason: "atr_spacing", lastEntry, requiredDistance, feature };
}
export class ConstructionController {
  inventory: readonly R[] = [];
  trim: { at: number; price: number } | null = null;
  observations: R[] = [];
  decisions: Array<[number, number, boolean, boolean, boolean]> = [];
  counts = { checks: 0, applicable: 0, vetoes: 0, unknown: 0 };
  intervened = new Set<number>();
  private lastSignature = "";
  constructor(readonly policy: ConstructionPolicy | null, readonly cfg: R, readonly source: (at: number) => R | null) {}
  readonly observe = (x: Readonly<ResearchInventoryEvent>) => {
    assert.deepEqual(this.inventory, x.before);
    if (x.event.kind === "partial") this.trim = { at: x.event.fillAt!, price: x.event.price! };
    if (x.event.kind === "open" || !x.after.length) this.trim = null;
    this.inventory = x.after;
  };
  readonly decide = (d: Readonly<ResearchAddDecision>): boolean => {
    assert.equal(d.nextDepth, this.inventory.length + 1);
    const source = this.policy?.family === "spacing" ? this.source(d.at) : null;
    const result = constructionDecision(this.policy, d, this.inventory, this.trim, source, this.cfg);
    this.decisions.push([d.index, d.episode, d.priceDropOk, result.veto, result.unknown]);
    this.counts.checks++; this.counts.applicable += Number(result.applicable); this.counts.vetoes += Number(result.veto); this.counts.unknown += Number(result.unknown);
    if (result.veto) this.intervened.add(d.episode);
    // One row at each change in permission/source and each fill. Repeated minute
    // attempts are counted but not falsely presented as independent episodes.
    const signature = JSON.stringify([d.episode, this.inventory.map(x => x.id), result.veto, result.reason, result.unknown, source?.endTs, this.trim]);
    if (signature !== this.lastSignature) {
      this.observations.push({ decision: { ...d }, inventory: this.inventory, trim: this.trim, result }); this.lastSignature = signature;
    }
    return result.veto;
  };
}
