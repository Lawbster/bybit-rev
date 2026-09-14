import type { Executor } from "./executor";
import type { StateManager } from "./state";

export function hasRecoveryInventory(state: StateManager): boolean {
  return state.isRecoveryMode() && state.get().positions.some(p => p.orderId === "recovered_from_exchange");
}

/** Keep legacy identity until terminal evidence AND any fills are receipted. */
export async function retireRecoveryOrder(state: StateManager, executor: Executor, symbol: string): Promise<boolean> {
  const id = state.getRecoveryTpOrderId();
  if (!id) return true;
  const observed = await executor.retireLegacyRecoveryTpOrder?.(symbol, id);
  const receipted = state.get().completedLongTransactions.some(r => r.orderId === id && r.filledQty >= (observed?.filledQty ?? Infinity));
  if (!observed?.terminal || (observed.filledQty !== 0 && !receipted)) {
    state.setRecoveryMode(true);
    return false;
  }
  state.setRecoveryTpOrderId("");
  return true;
}

/** Durable desired target precedes every idempotent native TP request. No local PnL inference. */
export async function maintainRecoveryProtection(
  state: StateManager, executor: Executor, symbol: string, activeTpPct: number,
): Promise<{ success: boolean; error?: string }> {
  if (state.getPendingOrder() || state.getMakerTpOrder()) return { success: false, error: "transaction owner still active" };
  if (!hasRecoveryInventory(state) && !state.getRecoveryTpOrderId()) return { success: true };
  const positions = state.get().positions;
  if (!positions.length) {
    if (await executor.getLongPositionSize(symbol) !== 0) return { success: false, error: "exchange not flat for recovery retirement" };
    return { success: await retireRecoveryOrder(state, executor, symbol) };
  }
  const qty = positions.reduce((sum, p) => sum + p.qty, 0);
  const price = positions.reduce((sum, p) => sum + p.qty * p.entryPrice, 0) / qty * (1 + activeTpPct / 100);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(activeTpPct) || activeTpPct <= 0) return { success: false, error: "invalid recovery target" };
  state.setDesiredLongTp({ price, positionQtyBasis: qty, activeTpPct, updatedAt: Date.now(), syncStatus: "pending" });
  const result = await executor.setRecoveryPositionTp?.(symbol, price, qty);
  if (!result?.success) {
    const error = `${result?.error ?? "recovery native TP unsupported"}; observed qty=${result?.observedQty ?? "unknown"} TP=${result?.observedTp ?? "unknown"}`;
    state.markDesiredLongTpFailed(price, Date.now(), error);
    return { success: false, error };
  }
  state.markDesiredLongTpConfirmed(price, Date.now());
  // Native protection must be proven before removing a legacy resting safety net.
  if (!(await retireRecoveryOrder(state, executor, symbol))) return { success: false, error: "legacy recovery identity/fills remain unresolved" };
  // Never clear generic recovery just because TP/quantity now matches.
  return { success: true };
}
