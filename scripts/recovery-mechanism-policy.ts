/** F05 event-state policies. No future prices, live executor or live state access. */
import assert from "assert/strict";
import type { ResearchReductionDecision, ResearchReductionIntent, ResearchAddDecision } from "./replay-causal-engine";
import type { WeeklyExitController } from "./mfi-weekly-exit-policy";
import { M, B, type Frame, type R } from "./recovery-mechanism-sources";
export type Policy = { id: string; family: "weekly" | "support" | "rebound" | "buy_failure" | "sell_oi"; action: "freeze" | "half_freeze" | "half_ordinary"; hl: boolean };
export type Sources = { frame: (at: number, lag: number) => Frame | null; support: (end: number, price: number) => R | null; pulse: (at: number, lag: number) => R };
export class RecoveryController {
  readonly observations: R[] = []; readonly vetoes: R[] = [];
  private seen = new Set<number>(); private state: R | null = null;
  private freeze: { episode: number; at: number } | null = null;
  private lastFrame = -Infinity;
  constructor(readonly policy: Policy, readonly cfg: R, readonly source: Sources, readonly sourceLag: number, readonly delay: number, readonly weekly?: WeeklyExitController) {}
  private log(d: Readonly<ResearchReductionDecision>, status: string, extra: R = {}): R {
    const r = { at: d.at, episode: d.episode, depth: d.depth, grossPct: d.grossPct, price: d.price, canReduce: d.canReduce,
      pendingReason: d.existingPendingReason, status, ...extra }; this.observations.push(r); return r;
  }
  private act(d: Readonly<ResearchReductionDecision>, extra: R): ResearchReductionIntent | null {
    assert(d.canReduce); this.log(d, "signal", { action: this.policy.action, effectiveAt: d.at + this.delay, ...extra });
    this.state = null;
    if (this.policy.action === "freeze") { this.freeze = { episode: d.episode, at: d.at + this.delay }; return null; }
    return { fraction: .5, reason: `research_exit:${this.policy.id}`, fillDelayMs: this.delay };
  }
  readonly veto = (d: Readonly<ResearchAddDecision>): boolean => {
    const blocked = this.freeze !== null && this.freeze.episode === d.episode && d.at >= this.freeze.at;
    if (blocked) this.vetoes.push({ at: d.at, episode: d.episode, nextDepth: d.nextDepth, effectiveAt: this.freeze!.at });
    return blocked;
  };
  readonly decide = (d: Readonly<ResearchReductionDecision>): ResearchReductionIntent | null => {
    if (this.freeze && (d.depth === 0 || d.episode !== this.freeze.episode)) this.freeze = null;
    if (this.policy.family === "weekly") {
      const r = this.weekly!.decide(d); if (!r) return null;
      const o = this.weekly!.observations.find(o => o.episode === d.episode && o.at === d.at)!;
      return this.act(d, { weekly: o });
    }
    if (this.state && (d.episode !== this.state.episode || d.depth < this.cfg.minDepth || d.grossPct === null || d.grossPct >= 0 || d.at > this.state.expiresAt)) {
      this.log(d, "invalidated", { arm: this.state.arm, reason: d.episode !== this.state.episode || !d.depth ? "closed" : d.depth < this.cfg.minDepth ? "depth" : d.grossPct !== null && d.grossPct >= 0 ? "recovered" : "expired" }); this.state = null;
    }
    const f = this.source.frame(d.at, this.sourceLag);
    if (!f) { if (this.state) { this.log(d, "invalidated", { arm: this.state.arm, reason: "missing_frame" }); this.state = null; } return null; }
    if (f.end <= this.lastFrame) return null;
    const gap = this.lastFrame !== -Infinity && f.end !== this.lastFrame + B; this.lastFrame = f.end;
    if (this.state && gap) { this.log(d, "invalidated", { arm: this.state.arm, reason: "frame_gap" }); this.state = null; }
    if (!this.state && !this.seen.has(d.episode) && d.depth >= this.cfg.minDepth && d.grossPct !== null && d.grossPct <= this.cfg.armGrossPct) {
      this.seen.add(d.episode);
      const support = this.policy.family === "support" ? this.source.support(f.end, f.close) : null;
      const arm = this.log(d, "armed", { frame: f, support, expiresAt: d.at + this.cfg.expiryMinutes * M });
      if (this.policy.family === "support" && (!support || support.distancePct > this.cfg.supportMaxDistancePct)) { this.log(d, "invalidated", { arm, reason: "support_unknown_or_far" }); return null; }
      this.state = { episode: d.episode, arm, expiresAt: arm.expiresAt, phase: "watch", lowClose: f.close, support, referenceHigh: f.prior15High };
      return null;
    }
    const s = this.state; if (!s) return null;
    const below = 1 - this.cfg.breakBufferPct / 100, above = 1 + this.cfg.reclaimBufferPct / 100;
    let pulse: R | null = null, previousPulse: R | null = null;
    if (this.policy.hl) {
      pulse = this.source.pulse(d.at, this.sourceLag);
      if (this.policy.family === "sell_oi") previousPulse = this.source.pulse(d.at - B, this.sourceLag);
      if (!pulse.flowHealthy || (this.policy.family === "sell_oi" && (!pulse.oiHealthy || !previousPulse!.flowHealthy))) {
        this.log(d, "invalidated", { arm: s.arm, frame: f, pulse, previousPulse, reason: "pulse_unknown" }); this.state = null; return null;
      }
    }
    const row = this.log(d, "observe", { armAt: s.arm.at, phase: s.phase, frame: f, pulse, previousPulse });
    const invalidate = (reason: string) => { row.status = "invalidated"; row.reason = reason; this.state = null; };
    const progress = (phase: string, extra: R) => { row.status = "transition"; row.nextPhase = phase; Object.assign(s, extra, { phase }); s.transitions = [...(s.transitions ?? []), row]; };
    const fire = () => {
      if (!d.canReduce) { row.status = "ordinary_exit_priority"; this.state = null; return null; }
      return this.act(d, { arm: s.arm, transitions: s.transitions ?? [], frame: f, pulse, previousPulse });
    };
    if (this.policy.family === "support") {
      const level = s.support.price;
      if (s.phase !== "watch" && f.close >= level * above) { invalidate("support_reclaimed"); return null; }
      if (s.phase === "watch" && f.close < level * below) progress("broken", {});
      else if (s.phase === "broken" && f.high >= level * below && f.close < level * below) progress("retested", { failLow: f.low });
      else if (s.phase === "retested" && f.close < s.failLow * below) return fire();
    } else if (this.policy.family === "rebound") {
      if (f.close >= s.referenceHigh) { invalidate("high_reclaimed"); return null; }
      if (s.phase === "watch") {
        if (f.close >= s.lowClose * (1 + this.cfg.reboundPct / 100)) progress("bounced", { failLow: f.low });
        else s.lowClose = Math.min(s.lowClose, f.close);
      } else if (f.close < s.failLow * below) return fire();
    } else {
      if (s.phase !== "watch" && f.close >= s.failHigh * above) { invalidate("pressure_reversed"); return null; }
      const ready = this.policy.family === "buy_failure" ? pulse!.ratio >= this.cfg.flowBuyRatio && f.roc15 <= 0
        : pulse!.ratio <= this.cfg.flowSellRatio && pulse!.ratio < previousPulse!.ratio && pulse!.nativeOi1hPct >= this.cfg.nativeOiMinPct;
      if (s.phase === "watch" && ready) progress("pressure", { failLow: f.low, failHigh: f.high });
      else if (s.phase === "pressure" && f.close < s.failLow * below) return fire();
    }
    return null;
  };
  finish() { this.weekly?.finish(); if (this.state) { this.observations.push({ status: "censored", episode: this.state.episode, arm: this.state.arm }); this.state = null; } }
}
