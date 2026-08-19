import type { LongTransactionResult } from "./long-transaction-coordinator";

export type FullCloseFinalizationContext = {
  requestedReason: string;
  preRungs: number;
  preAvgEntry: number;
  preOldestEntryTime: number;
};

export type FullCloseAuditRecord = {
  positionsClosed: number;
  totalPnl: number;
  totalFees: number;
  avgEntry: number;
  exitPrice: number;
  closeReason: string;
};

export type FullCloseNotification = {
  reason: string;
  rungs: number;
  avgEntry: number;
  exitPrice: number;
  pnlUsd: number;
  holdHours: number;
};

export type FullCloseFinalizationEffects = {
  refreshCapital: () => Promise<void>;
  recordClose: (record: FullCloseAuditRecord) => void;
  notifyClose: (notification: FullCloseNotification) => Promise<void>;
  clearOneShotOverride: () => void;
  closeLadderHedge: (reason: string, exitPrice: number) => Promise<void>;
  clearRecovery: () => Promise<void>;
  applyTpCooldown: () => void;
};

export function isTpLifecycleClose(requestedReason: string, closeReason?: string): boolean {
  const reasons = [requestedReason, closeReason]
    .filter((reason): reason is string => typeof reason === "string")
    .map(reason => reason.trim().toUpperCase());
  return reasons.some(reason => (
    reason === "NATIVE_TP"
    || reason === "TP"
    || reason.startsWith("TP (")
    || reason === "STALE TP"
    || reason.startsWith("STALE TP (")
  ));
}

export async function finalizeCommittedFullClose(
  result: LongTransactionResult,
  context: FullCloseFinalizationContext,
  effects: FullCloseFinalizationEffects,
  now: number = Date.now(),
): Promise<void> {
  if (
    result.kind !== "full_close"
    || result.outcome !== "committed"
    || result.avgPrice === null
    || result.remainingQty !== 0
    || !result.synced
  ) {
    throw new Error(
      `cannot finalize unresolved full close ${result.orderLinkId}: ${result.outcome}/${result.status} remaining=${result.remainingQty} synced=${result.synced}`,
    );
  }

  const exitPrice = result.avgPrice;
  const closeReason = result.closeReason ?? context.requestedReason;
  const tpLifecycle = isTpLifecycleClose(context.requestedReason, result.closeReason);
  const holdHours = Math.max(0, now - context.preOldestEntryTime) / 3_600_000;

  await effects.refreshCapital();
  effects.recordClose({
    positionsClosed: result.positionsClosed,
    totalPnl: result.totalPnl,
    totalFees: result.totalFees,
    avgEntry: context.preAvgEntry,
    exitPrice,
    closeReason,
  });
  await effects.notifyClose({
    reason: context.requestedReason,
    rungs: context.preRungs,
    avgEntry: context.preAvgEntry,
    exitPrice,
    pnlUsd: result.totalPnl,
    holdHours,
  });

  if (tpLifecycle) effects.clearOneShotOverride();
  await effects.closeLadderHedge(
    tpLifecycle ? "ladder TP" : `ladder flattened (${context.requestedReason})`,
    exitPrice,
  );
  await effects.clearRecovery();
  if (tpLifecycle) effects.applyTpCooldown();
}
