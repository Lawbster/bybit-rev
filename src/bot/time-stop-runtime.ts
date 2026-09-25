import type { Aggressive10HighSnapshot } from "./aggressive10-policy";
import type { TimeStopCooldownPolicy } from "./close-cooldown";
import { ExactMinuteHistory, referenceMinuteStart } from "./time-stop-history";
import { evaluateTimeStop, TIME_STOP_LOOKBACK_MS, TIME_STOP_RESEARCH_PARAMS, TimeStopPosition } from "./time-stop";

export type TimeStopMode = "off" | "shadow" | "live";
export interface TimeStopHealth {
  mode: TimeStopMode; eligible: boolean; reason: string; unavailableSince: number | null;
  decisionAt: number | null; referenceAt: number | null; referencePrice: number | null;
  fire: boolean; grossPct: number | null; ret7dPct: number | null; lastError: string | null;
}

/** No orders and no awaited I/O. Caller must recheck inventory/TP/ownership under the mutation guard. */
export class TimeStopRuntime {
  private health: TimeStopHealth;
  constructor(readonly mode: TimeStopMode, private readonly history: ExactMinuteHistory) {
    this.health = { mode, eligible: false, reason: "inactive", unavailableSince: null, decisionAt: null,
      referenceAt: null, referencePrice: null, fire: false, grossPct: null, ret7dPct: null, lastError: null };
  }
  snapshot(): TimeStopHealth { return { ...this.health }; }
  evaluate(active: boolean, positions: readonly TimeStopPosition[], high: Aggressive10HighSnapshot, now: number): TimeStopCooldownPolicy | null {
    const eligible = this.mode !== "off" && active && positions.length > 0
      && now - Math.min(...positions.map(p => p.entryTime)) >= 40 * 3_600_000;
    this.health = { ...this.health, eligible, fire: false, grossPct: null, ret7dPct: null,
      decisionAt: high.decisionAt, referenceAt: null, referencePrice: null, lastError: this.history.status().lastError };
    if (!eligible) { this.health.reason = "inactive"; this.health.unavailableSince = null; return null; }
    if (!high.healthy || high.decisionAt === null || !Number.isSafeInteger(high.decisionAt) || high.decisionAt % 60_000 !== 0
      || high.close === null || !Number.isFinite(high.close) || high.close <= 0) {
      this.health.reason = "decision_context_unavailable";
      this.health.unavailableSince ??= now; return null;
    }
    const referenceAt = high.decisionAt - TIME_STOP_LOOKBACK_MS;
    const start = referenceMinuteStart(high.decisionAt, TIME_STOP_LOOKBACK_MS);
    void this.history.request(start);
    const referencePrice = this.history.get(start);
    const decision = evaluateTimeStop({ positions, decisionClose: high.close, decisionCloseTime: high.decisionAt,
      referenceClose: referencePrice, referenceCloseTime: referencePrice === null ? null : referenceAt }, TIME_STOP_RESEARCH_PARAMS);
    Object.assign(this.health, { referenceAt, referencePrice, grossPct: decision.grossPct, ret7dPct: decision.ret7dPct,
      reason: decision.reason, fire: decision.fire && high.decisionReady });
    if (referencePrice === null) this.health.unavailableSince ??= now;
    else this.health.unavailableSince = null;
    if (!high.decisionReady || now < high.decisionAt || now - high.decisionAt > 30_000) {
      this.health.fire = false; this.health.reason = "decision_window_expired"; return null;
    }
    if (!decision.fire || referencePrice === null) return null;
    return { kind: "weak_week_time_stop", requestedAt: now, decisionAt: high.decisionAt,
      decisionPrice: high.close, referenceAt, referencePrice };
  }
}

/** Checked again inside the single long-side mutation guard, not only in the outer loop. */
export function timedExitMutationAllowed(input: {
  now: number; decisionAt: number; expectedInventory: string | undefined; actualInventory: string;
  pending: boolean; recovery: boolean; makerClosing: boolean; tpHit: boolean; stalePrice: boolean;
}): boolean {
  return !input.pending && !input.recovery && !input.makerClosing && !input.tpHit && !input.stalePrice
    && input.expectedInventory === input.actualInventory && input.now >= input.decisionAt
    && input.now - input.decisionAt <= 30_000;
}
