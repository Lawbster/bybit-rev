import type { ProRataAllocation } from "./partial-close-transaction";

/** Captured with the order intent, before any cancel/submission. Observation only. */
export interface ForcedCloseObservationIntent {
  symbol: string; profileId: string | null; requestedAt: number; reason: string;
  allocation: ProRataAllocation;
  makerAppliedQty: number; makerAppliedNotional: number;
}
export interface ForcedCloseObservation {
  intent: ForcedCloseObservationIntent;
  fullFlat: boolean;
  cause: "owned_market" | "maker_tp" | "external";
  finalExecTime: number | null;
  filledQty: number;
  exitNotional: number;
  unscorable: string | null;
}
export function isPostFlattenReason(reason: string): boolean {
  return reason.startsWith("HARD FLATTEN:") || reason.startsWith("EMERGENCY KILL:");
}

export function validateForcedCloseObservationIntent(value: ForcedCloseObservationIntent | undefined): void {
  if (!value) return;
  if (typeof value.symbol !== "string" || !value.symbol || typeof value.reason !== "string"
    || !(value.profileId === null || typeof value.profileId === "string")
    || !Number.isSafeInteger(value.requestedAt) || value.requestedAt <= 0
    || !Number.isFinite(value.makerAppliedQty) || value.makerAppliedQty < 0
    || !Number.isFinite(value.makerAppliedNotional) || value.makerAppliedNotional < 0
    || value.allocation?.mode !== "pro_rata" || !Array.isArray(value.allocation.targets) || !value.allocation.targets.length
    || value.allocation.targets.some(p => !p.positionId || !Number.isFinite(p.preQty) || p.preQty <= 0
      || !Number.isFinite(p.preNotional) || p.preNotional <= 0)
    || !Number.isFinite(value.allocation.preTotalQty)
    || Math.abs(value.allocation.targets.reduce((n, p) => n + p.preQty, 0) - value.allocation.preTotalQty) > 1e-8) {
    throw new Error("invalid forced-close observation intent");
  }
}
