/** F02 research policy. No live execution/config imports. */
import assert from "assert/strict";
import { ClosedBarSeries } from "../src/research/closed-bars";
import { computeVolumeFlowValues } from "../src/research/volume-flow-features";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchReductionDecision, ResearchReductionIntent } from "./replay-causal-engine";
export const M = 60000, TF = 30 * M;
export type MfiEvidence = { value: number | null; sourceEnd: number | null; availableAt: number | null };
export function mfiTape(cs: Candle[], seed: number) {
  const minutes = cs.filter(c => c.ts >= seed).map(c => ({ timestamp: c.ts, open: c.open, high: c.high, low: c.low,
    close: c.close, volume: c.volume, turnover: c.turnover }));
  const bars = ClosedBarSeries.fromHistorical(minutes, { sourceIntervalMs: M, targetIntervalMs: TF, publicationLagMs: 0 }).bars;
  const values = computeVolumeFlowValues(bars.map(b => b.candle), TF, "mfi", 14);
  return (at: number, lag: number): MfiEvidence => {
    assert(Number.isSafeInteger(at) && Number.isSafeInteger(lag) && lag >= 0);
    let lo = 0, hi = bars.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (bars[mid].barEnd + lag <= at) lo = mid + 1; else hi = mid; }
    const i = lo - 1, b = bars[i];
    if (!b || b.barEnd !== Math.floor((at - lag) / TF) * TF) return { value: null, sourceEnd: null, availableAt: null };
    assert(b.barEnd + lag <= at);
    return { value: values[i].vfValue, sourceEnd: b.barEnd, availableAt: b.barEnd + lag };
  };
}
export type ExitPolicy = { id: string; fraction: number; mfiRequired: boolean };
export type ExitObservation = { episode: number; firstAt: number; dueAt: number; firstPct: number; firstDepth: number;
  at: number | null; depth: number | null; grossPct: number | null; mfi: MfiEvidence | null;
  status: string; existingPendingReason: string | null };
export class DistressExitController {
  readonly observations: ExitObservation[] = [];
  private readonly seen = new Set<number>();
  private waiting: ExitObservation[] = [];
  constructor(readonly policy: ExitPolicy, private readonly source: (at: number, lag: number) => MfiEvidence,
    private readonly sourceLagMs = 0, private readonly fillDelayMs = 0) {
    assert([0, .5, 1].includes(policy.fraction));
    assert([sourceLagMs, fillDelayMs].every(n => Number.isSafeInteger(n) && n >= 0));
  }
  readonly decide = (d: Readonly<ResearchReductionDecision>): ResearchReductionIntent | null => {
    if (d.depth >= 9 && d.grossPct !== null && d.grossPct <= -3 && !this.seen.has(d.episode)) {
      this.seen.add(d.episode);
      const row: ExitObservation = { episode: d.episode, firstAt: d.at, dueAt: d.at + 60 * M, firstPct: d.grossPct, firstDepth: d.depth,
        at: null, depth: null, grossPct: null, mfi: null, status: "waiting", existingPendingReason: null };
      this.observations.push(row); this.waiting.push(row);
    }
    let action: ResearchReductionIntent | null = null;
    for (const row of this.waiting) {
      if (d.at < row.dueAt) continue;
      Object.assign(row, { at: d.at, depth: d.depth, grossPct: d.grossPct, existingPendingReason: d.existingPendingReason });
      if (d.at !== row.dueAt) row.status = "checkpoint_missing";
      else if (d.episode !== row.episode || d.depth === 0) row.status = "episode_already_closed";
      else if (d.depth < 9) row.status = "depth_reduced";
      else {
        row.mfi = this.source(d.at, this.sourceLagMs);
        if (!d.canReduce) row.status = "ordinary_exit_priority";
        else if (this.policy.fraction === 0) row.status = "baseline_observed";
        else if (this.policy.mfiRequired && row.mfi.value === null) row.status = "mfi_unknown";
        else if (this.policy.mfiRequired && row.mfi.value! > 20) row.status = "mfi_not_low";
        else {
          row.status = "scheduled"; assert.equal(action, null);
          action = { fraction: this.policy.fraction, reason: `research_exit:${this.policy.id}`, fillDelayMs: this.fillDelayMs };
        }
      }
    }
    this.waiting = this.waiting.filter(r => r.status === "waiting"); return action;
  };
  finish() { for (const row of this.waiting) row.status = "cutoff_before_checkpoint"; this.waiting = []; }
}
