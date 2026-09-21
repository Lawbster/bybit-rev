/** F04 adds only the frozen weekly context veto; original controller remains unchanged. */
import assert from "assert/strict";
import { ClosedBarSeries } from "../src/research/closed-bars";
import { computeVwapVolumeValues } from "../src/research/vwap-volume-features";
import { DistressExitController, M, type ExitPolicy, type ExitObservation, type MfiEvidence } from "./mfi-distress-exit-policy";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchReductionDecision, ResearchReductionIntent } from "./replay-causal-engine";
export const H = 60 * M;
export type WeeklyEvidence = { sourceStart: number | null; sourceEnd: number | null; availableAt: number | null;
  weekStart: number | null; close: number | null; vwap: number | null; distancePct: number | null;
  roc5: number | null; rocAnchorEnd: number | null; ready: boolean; passes: boolean | null };
export type WeeklyPolicy = ExitPolicy & { weeklyRequired: boolean };
export type WeeklyObservation = ExitObservation & { weekly?: WeeklyEvidence };
export function weeklyTape(cs: Candle[], seed: number): (at: number, lag: number) => WeeklyEvidence {
  const minutes = cs.filter(c => c.ts >= seed).map(c => ({ timestamp: c.ts, open: c.open, high: c.high, low: c.low,
    close: c.close, volume: c.volume, turnover: c.turnover }));
  const bars = ClosedBarSeries.fromHistorical(minutes, { sourceIntervalMs: M, targetIntervalMs: H, publicationLagMs: 0 }).bars;
  const values = computeVwapVolumeValues(bars.map(b => b.candle), H);
  return (at, lag) => {
    assert(Number.isSafeInteger(at) && Number.isSafeInteger(lag) && lag >= 0);
    let lo = 0, hi = bars.length;
    while (lo < hi) { const i = (lo + hi) >>> 1; if (bars[i].barEnd + lag <= at) lo = i + 1; else hi = i; }
    const i = lo - 1, b = bars[i], empty: WeeklyEvidence = { sourceStart: null, sourceEnd: null, availableAt: null, weekStart: null,
      close: null, vwap: null, distancePct: null, roc5: null, rocAnchorEnd: null, ready: false, passes: null };
    if (!b || b.barEnd !== Math.floor((at - lag) / H) * H) return empty;
    const v = values[i], anchor = bars[i - 5];
    const roc = anchor && anchor.barEnd === b.barEnd - 5 * H ? 100 * (b.candle.close / anchor.candle.close - 1) : null;
    const ready = v.vvWeek !== null && roc !== null;
    assert(b.barEnd + lag <= at);
    return { sourceStart: b.candle.timestamp, sourceEnd: b.barEnd, availableAt: b.barEnd + lag, weekStart: v.vvWeekStart,
      close: b.candle.close, vwap: v.vvWeek, distancePct: v.vvWeekDistance, roc5: roc, rocAnchorEnd: anchor?.barEnd ?? null,
      ready, passes: ready ? b.candle.close < v.vvWeek! && roc! <= 0 : null };
  };
}
export class WeeklyExitController {
  readonly original: DistressExitController;
  get observations(): WeeklyObservation[] { return this.original.observations; }
  constructor(readonly policy: WeeklyPolicy, mfi: (at: number, lag: number) => MfiEvidence,
    private readonly weekly: (at: number, lag: number) => WeeklyEvidence, readonly sourceLagMs = 0, fillDelayMs = 0) {
    assert(!policy.weeklyRequired || policy.fraction === .5 && policy.mfiRequired);
    this.original = new DistressExitController(policy, mfi, sourceLagMs, fillDelayMs);
  }
  readonly decide = (d: Readonly<ResearchReductionDecision>): ResearchReductionIntent | null => {
    const intent = this.original.decide(d);
    if (!intent || !this.policy.weeklyRequired) return intent;
    const o = this.observations.find(x => x.episode === d.episode && x.at === d.at); assert(o?.status === "scheduled");
    o.weekly = this.weekly(d.at, this.sourceLagMs);
    if (!o.weekly.ready) { o.status = "weekly_unknown"; return null; }
    if (!o.weekly.passes) { o.status = "weekly_not_weak"; return null; }
    return intent;
  };
  finish() { this.original.finish(); }
}
