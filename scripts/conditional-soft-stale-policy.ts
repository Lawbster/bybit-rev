/** F06 one-way target-deferral permission. Local replay only. */
import assert from "assert/strict";
import type { ResearchTpDecision } from "./replay-causal-engine";
export type R = Record<string, any>;
export type SoftStaleFamily = "structure" | "vwap" | "resistance" | "age";
export type Context = { healthy: boolean; allowed: boolean; evidence: R };
export class SoftStaleController {
  readonly observations: R[] = [];
  readonly counts = { checks: 0, eligibleChecks: 0, deferredChecks: 0, unknownChecks: 0 };
  private episode = -1;
  private phase: "unseen" | "extending" | "releasing" | "released" = "unseen";
  private releaseAt = Infinity;
  constructor(readonly family: SoftStaleFamily, readonly maxAgeHours: number, readonly delay: number,
    readonly source: (d: Readonly<ResearchTpDecision>) => Context) {}
  readonly decide = (d: Readonly<ResearchTpDecision>): boolean => {
    this.counts.checks++;
    if (d.episode !== this.episode) { this.episode = d.episode; this.phase = "unseen"; this.releaseAt = Infinity; }
    const age = (d.at - d.oldestEntryTime) / 3600000;
    assert(age >= 0 && d.basePct <= d.normalPct);
    const eligible = d.basePct < d.normalPct;
    if (eligible) this.counts.eligibleChecks++;
    if (this.phase === "released") return false;
    if (this.phase === "releasing") {
      if (d.at < this.releaseAt) { this.counts.deferredChecks++; return true; }
      this.phase = "released"; this.observations.push({ status: "released", ...d, releaseAt: this.releaseAt }); return false;
    }
    if (this.phase === "unseen" && !eligible) return false;
    const context = age >= this.maxAgeHours ? { healthy: true, allowed: false, evidence: { reason: "age_limit" } }
      : this.family === "age" ? { healthy: true, allowed: true, evidence: { reason: "unconditional_age_control" } } : this.source(d);
    if (!context.healthy) this.counts.unknownChecks++;
    if (context.healthy && context.allowed) {
      if (this.phase === "unseen") { this.phase = "extending"; this.observations.push({ status: "extended", ...d, age, context }); }
      this.counts.deferredChecks++; return true;
    }
    if (this.phase === "unseen") { this.phase = "released"; this.observations.push({ status: "refused", ...d, age, context }); return false; }
    this.releaseAt = d.at + this.delay;
    this.phase = this.delay ? "releasing" : "released";
    this.observations.push({ status: "release_requested", ...d, age, context, releaseAt: this.releaseAt });
    if (this.delay) this.counts.deferredChecks++;
    return this.delay > 0;
  };
}
