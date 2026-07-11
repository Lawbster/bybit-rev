import {
  Executor,
  genOrderLinkId,
  LongExecutionResult,
  mergeOrderAndExecutionEvidence,
} from "./executor";
import {
  FullCloseIntent,
  LongOpenIntent,
  LongTransactionReceipt,
} from "./long-transaction";
import { buildProRataAllocation } from "./partial-close-transaction";
import { LegacyPendingOrder, StateManager } from "./state";

export type LongTransactionOutcome =
  | "committed"
  | "partial_terminal"
  | "pending"
  | "rejected"
  | "failed";

export type LongTransactionResult = {
  outcome: LongTransactionOutcome;
  kind: "long_open" | "full_close";
  orderLinkId: string;
  orderId: string;
  status: string;
  filledQty: number;
  avgPrice: number | null;
  totalPnl: number;
  totalFees: number;
  positionsClosed: number;
  remainingQty: number;
  preAvgEntry: number;
  prePositionCount: number;
  synced: boolean;
  error?: string;
};

type BaseRequest = {
  state: StateManager;
  executor: Executor;
  symbol: string;
  feeRate: number;
  now: number;
};

export type LongOpenTransactionRequest = BaseRequest & {
  notional: number;
  leverage: number;
  level: number;
  orderLinkId?: string;
};

export type FullCloseTransactionRequest = BaseRequest & {
  reason: string;
  orderLinkId?: string;
};

export type ResolveLongTransactionRequest = BaseRequest & {
  initialExecution?: LongExecutionResult;
};

const NATIVE_EVIDENCE_LOOKBACK_MS = 30_000;
const NATIVE_EVIDENCE_FUTURE_MS = 5_000;
const MAX_BYBIT_EVIDENCE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function totalQty(state: StateManager): number {
  return state.get().positions.reduce((sum, pos) => sum + pos.qty, 0);
}

function tolerance(qtyStep: number): number {
  return Math.max(qtyStep / 2, 1e-8);
}

function qtyMatches(a: number, b: number, qtyStep: number): boolean {
  return Math.abs(a - b) <= tolerance(qtyStep);
}

function fromReceipt(
  receipt: LongTransactionReceipt,
  remainingQty: number,
  preAvgEntry: number,
  prePositionCount: number,
  synced: boolean,
): LongTransactionResult {
  return {
    outcome: receipt.outcome === "partial_terminal" ? "partial_terminal"
      : receipt.outcome === "rejected" ? "rejected" : "committed",
    kind: receipt.kind,
    orderLinkId: receipt.orderLinkId,
    orderId: receipt.orderId,
    status: receipt.terminalStatus,
    filledQty: receipt.filledQty,
    avgPrice: receipt.avgPrice,
    totalPnl: receipt.totalPnl,
    totalFees: receipt.totalFees,
    positionsClosed: receipt.positionsClosed,
    remainingQty,
    preAvgEntry,
    prePositionCount,
    synced,
  };
}

function pendingResult(
  pending: LongOpenIntent | FullCloseIntent,
  execution: LongExecutionResult | null,
  remainingQty: number,
  error?: string,
): LongTransactionResult {
  return {
    outcome: "pending",
    kind: pending.kind,
    orderLinkId: pending.orderLinkId,
    orderId: execution?.orderId ?? "",
    status: execution?.status ?? pending.lastObservedStatus,
    filledQty: execution?.cumExecQty ?? (pending.kind === "full_close" ? pending.appliedQty : 0),
    avgPrice: execution?.avgPrice ?? null,
    totalPnl: pending.kind === "full_close" ? (pending.appliedPnl ?? 0) : 0,
    totalFees: pending.kind === "full_close" ? (pending.appliedFees ?? 0) : 0,
    positionsClosed: 0,
    remainingQty,
    preAvgEntry: pending.kind === "full_close" ? pending.preAvgEntry : 0,
    prePositionCount: pending.kind === "full_close" ? pending.prePositionCount : 0,
    synced: false,
    error,
  };
}

async function observePendingExecution(
  executor: Executor,
  pending: LongOpenIntent | FullCloseIntent,
): Promise<LongExecutionResult> {
  const [order, executions, lotInfo] = await Promise.all([
    executor.queryOrderExecution(pending.symbol, pending.orderLinkId),
    executor.queryOrderExecutions(pending.symbol, pending.orderLinkId),
    executor.getInstrumentLotInfo(pending.symbol),
  ]);
  const merged = mergeOrderAndExecutionEvidence(order, executions);
  const { cumExecQty, cumExecNotional, avgPrice } = merged;
  let remainingLongQty: number | null = null;
  try { remainingLongQty = await executor.getLongPositionSize(pending.symbol); } catch { remainingLongQty = null; }

  return {
    outcome: order.found ? (order.terminal ? "terminal" : "accepted_unresolved") : "unknown",
    orderId: merged.orderId,
    orderLinkId: pending.orderLinkId,
    status: order.found ? order.status : (executions.found ? "execution_only" : order.status),
    terminal: order.found && order.terminal,
    submittedQty: pending.kind === "full_close" ? pending.preExchangeQty : 0,
    quotePrice: 0,
    cumExecQty,
    cumExecNotional,
    avgPrice,
    remainingLongQty,
    qtyStep: lotInfo.qtyStep,
    executionIds: merged.executionIds,
    error: order.error ?? executions.error,
  };
}

async function verifyAndMaybeClearTransactionRecovery(
  state: StateManager,
  executor: Executor,
  orderLinkId: string,
  symbol: string,
  qtyStep: number,
): Promise<boolean> {
  try {
    const exchangeQty = await executor.getLongPositionSize(symbol);
    const synced = qtyMatches(exchangeQty, totalQty(state), qtyStep);
    if (synced) state.clearTransactionRecovery(orderLinkId);
    return synced;
  } catch {
    return false;
  }
}

async function resolveOpen(
  req: ResolveLongTransactionRequest,
  pending: LongOpenIntent,
  execution: LongExecutionResult,
): Promise<LongTransactionResult> {
  const { state, executor } = req;
  if (execution.outcome === "not_submitted" || execution.outcome === "rejected") {
    const receipt = state.rejectPendingLongTransaction(pending.orderLinkId, execution.orderId, execution.status, req.now);
    state.clearTransactionRecovery(pending.orderLinkId);
    return fromReceipt(receipt, totalQty(state), 0, 0, true);
  }

  if (execution.outcome === "terminal") {
    if (execution.cumExecQty <= 0) {
      const receipt = state.rejectPendingLongTransaction(pending.orderLinkId, execution.orderId, execution.status, req.now);
      state.clearTransactionRecovery(pending.orderLinkId);
      return fromReceipt(receipt, totalQty(state), 0, 0, true);
    }
    const notional = execution.cumExecNotional ?? (
      execution.avgPrice !== null ? execution.avgPrice * execution.cumExecQty : 0
    );
    const avgPrice = execution.avgPrice ?? (notional > 0 ? notional / execution.cumExecQty : 0);
    if (notional <= 0 || avgPrice <= 0) {
      state.markLongTransactionUnknown(pending.orderLinkId, `${execution.status}:missing_notional`, req.now);
      state.enterTransactionRecovery(pending.orderLinkId);
      return pendingResult(pending, execution, totalQty(state), "terminal open fill missing execution notional");
    }
    const committed = state.commitPendingLongOpen(pending.orderLinkId, {
      orderId: execution.orderId,
      status: execution.status,
      filledQty: execution.cumExecQty,
      cumulativeExecNotional: notional,
      avgPrice,
      executionIds: execution.executionIds,
    }, req.now);
    const synced = await verifyAndMaybeClearTransactionRecovery(
      state, executor, pending.orderLinkId, pending.symbol, pending.qtyStep,
    );
    if (!synced) state.enterTransactionRecovery(pending.orderLinkId);
    return fromReceipt(committed.receipt, totalQty(state), 0, 0, synced);
  }

  state.markLongTransactionUnknown(pending.orderLinkId, execution.status, req.now);
  state.enterTransactionRecovery(pending.orderLinkId);
  return pendingResult(pending, execution, totalQty(state), execution.error);
}

async function exactExternalCloseEvidence(
  req: ResolveLongTransactionRequest,
  pending: FullCloseIntent,
): Promise<{ qty: number; notional: number; orderId: string; status: string; executionIds: string[] } | null> {
  if (pending.appliedQty > 1e-9) return null;
  const tol = tolerance(pending.qtyStep);
  const startTime = pending.externalEvidenceStartTime ?? (pending.createdAt - NATIVE_EVIDENCE_LOOKBACK_MS);
  const endTime = req.now + NATIVE_EVIDENCE_FUTURE_MS;
  const receipts = req.state.get().completedLongTransactions;
  const receiptedExecIds = new Set(receipts.flatMap(receipt => receipt.executionIds));
  const receiptedOrderIds = new Set(receipts.map(receipt => receipt.orderId).filter(Boolean));

  // Primary truth: individual executions with side/position filtering already
  // applied by the executor.
  const executions = (await req.executor.queryRecentLongCloseExecutions(pending.symbol, startTime, endTime))
    .filter(execution => !receiptedExecIds.has(execution.execId));
  const executionQty = executions.reduce((sum, execution) => sum + execution.closedSize, 0);
  if (
    executions.length > 0 &&
    Math.abs(executionQty - pending.preLocalQty) <= tol &&
    executions.every(execution => execution.execPrice > 0)
  ) {
    return {
      qty: executionQty,
      notional: executions.reduce((sum, execution) => sum + execution.closedSize * execution.execPrice, 0),
      orderId: [...new Set(executions.map(execution => execution.orderId).filter(Boolean))].join(","),
      status: "external_execution_evidence",
      executionIds: executions.map(execution => execution.execId),
    };
  }

  // Fallback only: closed-PnL rows must uniquely cover the exact quantity and
  // carry non-receipted order identities.
  const closedPnl = (await req.executor.queryRecentClosedPnl(pending.symbol, startTime, endTime))
    .filter(row =>
      row.side === "Sell" &&
      !receiptedOrderIds.has(row.orderId) &&
      !receiptedExecIds.has(`pnl:${row.orderId}`)
    );
  const closedQty = closedPnl.reduce((sum, row) => sum + row.closedSize, 0);
  if (
    closedPnl.length > 0 &&
    Math.abs(closedQty - pending.preLocalQty) <= tol &&
    closedPnl.every(row => row.orderId && row.avgExitPrice > 0)
  ) {
    return {
      qty: closedQty,
      notional: closedPnl.reduce((sum, row) => sum + row.closedSize * row.avgExitPrice, 0),
      orderId: [...new Set(closedPnl.map(row => row.orderId))].join(","),
      status: "external_closed_pnl_evidence",
      executionIds: closedPnl.map(row => `pnl:${row.orderId}`),
    };
  }
  return null;
}

async function resolveExternalFlatClose(
  req: ResolveLongTransactionRequest,
  pending: FullCloseIntent,
  execution: LongExecutionResult,
): Promise<LongTransactionResult | null> {
  const evidence = await exactExternalCloseEvidence(req, pending);
  if (!evidence) return null;
  req.state.applyObservedFullCloseFill(
    pending.orderLinkId,
    evidence.qty,
    evidence.notional,
    evidence.status,
    req.now,
    req.feeRate,
  );
  const finalized = req.state.finalizePendingFullClose(
    pending.orderLinkId,
    "external_close",
    evidence.orderId,
    evidence.status,
    evidence.executionIds,
    req.now,
  );
  req.state.clearTransactionRecovery(pending.orderLinkId);
  return fromReceipt(finalized.receipt, totalQty(req.state), pending.preAvgEntry, pending.prePositionCount, true);
}

async function resolveFullClose(
  req: ResolveLongTransactionRequest,
  pending: FullCloseIntent,
  execution: LongExecutionResult,
): Promise<LongTransactionResult> {
  const { state, executor } = req;
  let exchangeQty = execution.remainingLongQty;
  if (exchangeQty === null) {
    try { exchangeQty = await executor.getLongPositionSize(pending.symbol); } catch { exchangeQty = null; }
  }

  if (execution.outcome === "already_flat" || (exchangeQty !== null && exchangeQty <= tolerance(pending.qtyStep) && execution.cumExecQty <= 0)) {
    const external = await resolveExternalFlatClose(req, pending, execution);
    if (external) return external;
    state.markLongTransactionUnknown(pending.orderLinkId, `${execution.status}:flat_without_exact_evidence`, req.now);
    state.enterTransactionRecovery(pending.orderLinkId);
    return pendingResult(pending, execution, totalQty(state), "exchange flat without exact non-receipted close evidence");
  }

  if (execution.outcome === "not_submitted" || execution.outcome === "rejected") {
    if (exchangeQty !== null && qtyMatches(exchangeQty, pending.preExchangeQty, pending.qtyStep)) {
      const receipt = state.rejectPendingLongTransaction(pending.orderLinkId, execution.orderId, execution.status, req.now);
      state.clearTransactionRecovery(pending.orderLinkId);
      return fromReceipt(receipt, totalQty(state), pending.preAvgEntry, pending.prePositionCount, true);
    }
    state.markLongTransactionUnknown(pending.orderLinkId, `${execution.status}:position_changed`, req.now);
    state.enterTransactionRecovery(pending.orderLinkId);
    return pendingResult(pending, execution, totalQty(state), "rejected/not-submitted close but exchange quantity changed or is unknown");
  }

  if (execution.cumExecQty > pending.appliedQty + 1e-9) {
    const notional = execution.cumExecNotional ?? (
      execution.avgPrice !== null ? execution.avgPrice * execution.cumExecQty : 0
    );
    if (notional <= 0) {
      state.markLongTransactionUnknown(pending.orderLinkId, `${execution.status}:missing_notional`, req.now);
      state.enterTransactionRecovery(pending.orderLinkId);
      return pendingResult(pending, execution, totalQty(state), "close fill missing execution notional");
    }
    state.applyObservedFullCloseFill(
      pending.orderLinkId,
      execution.cumExecQty,
      notional,
      execution.status,
      req.now,
      req.feeRate,
    );
  }

  const currentPending = state.getPendingOrder();
  if (!currentPending || currentPending.kind !== "full_close") {
    throw new Error(`full close pending disappeared during resolution: ${pending.orderLinkId}`);
  }
  const localRemaining = totalQty(state);
  if (exchangeQty === null) {
    state.markLongTransactionUnknown(pending.orderLinkId, `${execution.status}:position_unknown`, req.now);
    state.enterTransactionRecovery(pending.orderLinkId);
    return pendingResult(currentPending, execution, localRemaining, "exchange position unavailable");
  }
  const synced = qtyMatches(exchangeQty, localRemaining, pending.qtyStep);

  const executionCoversFull = currentPending.appliedQty >= pending.preLocalQty - tolerance(pending.qtyStep);
  const exchangeFlat = exchangeQty <= tolerance(pending.qtyStep);
  if (exchangeFlat && executionCoversFull) {
    const finalized = state.finalizePendingFullClose(
      pending.orderLinkId,
      "committed",
      execution.orderId,
      execution.status,
      execution.executionIds,
      req.now,
    );
    state.clearTransactionRecovery(pending.orderLinkId);
    return fromReceipt(finalized.receipt, 0, pending.preAvgEntry, pending.prePositionCount, true);
  }

  if (exchangeFlat && !executionCoversFull) {
    const external = await resolveExternalFlatClose(req, currentPending, execution);
    if (external) return external;
    state.markLongTransactionUnknown(pending.orderLinkId, `${execution.status}:mixed_flat_ambiguous`, req.now);
    state.enterTransactionRecovery(pending.orderLinkId);
    return pendingResult(currentPending, execution, localRemaining, "exchange flat but bot execution does not cover full local quantity");
  }

  if (execution.outcome === "terminal" && synced && currentPending.appliedQty > 0) {
    state.enterTransactionRecovery(pending.orderLinkId);
    const finalized = state.finalizePendingFullClose(
      pending.orderLinkId,
      "partial_terminal",
      execution.orderId,
      execution.status,
      execution.executionIds,
      req.now,
    );
    return fromReceipt(finalized.receipt, localRemaining, pending.preAvgEntry, pending.prePositionCount, true);
  }

  if (execution.outcome === "terminal" && currentPending.appliedQty <= 1e-9 && qtyMatches(exchangeQty, pending.preExchangeQty, pending.qtyStep)) {
    const receipt = state.rejectPendingLongTransaction(pending.orderLinkId, execution.orderId, execution.status, req.now);
    state.clearTransactionRecovery(pending.orderLinkId);
    return fromReceipt(receipt, localRemaining, pending.preAvgEntry, pending.prePositionCount, true);
  }

  state.markLongTransactionUnknown(pending.orderLinkId, execution.status, req.now);
  state.enterTransactionRecovery(pending.orderLinkId);
  return pendingResult(currentPending, execution, localRemaining, synced ? execution.error : "exchange/local residual quantity mismatch");
}

export async function resolvePendingLongTransaction(
  req: ResolveLongTransactionRequest,
): Promise<LongTransactionResult> {
  const pending = req.state.getPendingOrder();
  if (!pending || (pending.kind !== "long_open" && pending.kind !== "full_close")) {
    return {
      outcome: "failed", kind: "long_open", orderLinkId: "", orderId: "", status: "no_pending",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: totalQty(req.state), preAvgEntry: 0, prePositionCount: 0, synced: false,
      error: "no pending long transaction",
    };
  }
  const completed = req.state.getCompletedLongTransaction(pending.orderLinkId);
  if (completed) {
    return fromReceipt(
      completed,
      totalQty(req.state),
      pending.kind === "full_close" ? pending.preAvgEntry : 0,
      pending.kind === "full_close" ? pending.prePositionCount : 0,
      true,
    );
  }

  let execution: LongExecutionResult;
  try {
    execution = req.initialExecution ?? await observePendingExecution(req.executor, pending);
  } catch (err: any) {
    req.state.markLongTransactionUnknown(pending.orderLinkId, "resolver_error", req.now);
    req.state.enterTransactionRecovery(pending.orderLinkId);
    return pendingResult(pending, null, totalQty(req.state), err.message);
  }
  try {
    return pending.kind === "long_open"
      ? await resolveOpen(req, pending, execution)
      : await resolveFullClose(req, pending, execution);
  } catch (err: any) {
    const current = req.state.getPendingOrder();
    if (current && (current.kind === "long_open" || current.kind === "full_close") && current.orderLinkId === pending.orderLinkId) {
      req.state.markLongTransactionUnknown(pending.orderLinkId, "resolution_apply_error", req.now);
      req.state.enterTransactionRecovery(pending.orderLinkId);
      return pendingResult(current, execution, totalQty(req.state), err.message);
    }
    req.state.setRecoveryMode(true);
    return {
      outcome: "failed",
      kind: pending.kind,
      orderLinkId: pending.orderLinkId,
      orderId: execution.orderId,
      status: "resolution_apply_error",
      filledQty: execution.cumExecQty,
      avgPrice: execution.avgPrice,
      totalPnl: 0,
      totalFees: 0,
      positionsClosed: 0,
      remainingQty: totalQty(req.state),
      preAvgEntry: pending.kind === "full_close" ? pending.preAvgEntry : 0,
      prePositionCount: pending.kind === "full_close" ? pending.prePositionCount : 0,
      synced: false,
      error: err.message,
    };
  }
}

export async function migrateAndResolveLegacyPendingLongTransaction(
  req: BaseRequest,
  legacy: LegacyPendingOrder,
): Promise<LongTransactionResult> {
  if (legacy.action !== "open" && (legacy.action !== "close" || legacy.partialClose)) {
    return {
      outcome: "failed", kind: "long_open", orderLinkId: legacy.orderLinkId, orderId: "", status: "unsupported_legacy",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: totalQty(req.state), preAvgEntry: 0, prePositionCount: 0, synced: false,
      error: `unsupported legacy pending action ${legacy.action}`,
    };
  }

  const [lotInfo, order, executions, exchangeQty] = await Promise.all([
    req.executor.getInstrumentLotInfo(req.symbol),
    req.executor.queryOrderExecution(req.symbol, legacy.orderLinkId),
    req.executor.queryOrderExecutions(req.symbol, legacy.orderLinkId),
    req.executor.getLongPositionSize(req.symbol),
  ]);
  const localQty = totalQty(req.state);
  const merged = mergeOrderAndExecutionEvidence(order, executions);
  const { cumExecQty, cumExecNotional, avgPrice } = merged;
  const orderId = merged.orderId;
  const initial: LongExecutionResult = {
    outcome: order.found ? (order.terminal ? "terminal" : "accepted_unresolved") : "unknown",
    orderId,
    orderLinkId: legacy.orderLinkId,
    status: order.found ? order.status : (executions.found ? "execution_only" : order.status),
    terminal: order.found && order.terminal,
    submittedQty: legacy.action === "close" ? localQty : 0,
    quotePrice: 0,
    cumExecQty,
    cumExecNotional,
    avgPrice,
    remainingLongQty: exchangeQty,
    qtyStep: lotInfo.qtyStep,
    executionIds: merged.executionIds,
    error: order.error ?? executions.error,
  };

  if (legacy.action === "open") {
    req.state.setPendingOrder({
      kind: "long_open",
      action: "open",
      orderLinkId: legacy.orderLinkId,
      symbol: legacy.symbol,
      createdAt: legacy.createdAt,
      level: req.state.get().positions.length,
      requestedNotional: legacy.notional,
      preLocalQty: localQty,
      preExchangeQty: Math.max(0, exchangeQty - cumExecQty),
      qtyStep: lotInfo.qtyStep,
      lastObservedStatus: "legacy_migrated",
      lastCheckedAt: req.now,
    });

    const existing = req.state.get().positions.find(position =>
      (orderId && position.orderId === orderId) ||
      position.orderId === legacy.orderLinkId ||
      position.orderLinkId === legacy.orderLinkId
    );
    if (existing && qtyMatches(exchangeQty, localQty, lotInfo.qtyStep)) {
      const receipt = req.state.adoptAlreadyCommittedLongTransaction(
        legacy.orderLinkId,
        orderId || existing.orderId || "",
        order.status || "legacy_already_committed",
        existing.qty,
        existing.entryPrice,
        executions.executionIds,
        req.now,
      );
      return fromReceipt(receipt, localQty, 0, 0, true);
    }
    return resolvePendingLongTransaction({ ...req, initialExecution: initial });
  }

  const positions = req.state.get().positions;
  const preAvgEntry = localQty > 0
    ? positions.reduce((sum, position) => sum + position.entryPrice * position.qty, 0) / localQty
    : 0;
  req.state.setPendingOrder({
    kind: "full_close",
    action: "close",
    orderLinkId: legacy.orderLinkId,
    symbol: legacy.symbol,
    createdAt: legacy.createdAt,
    reason: "legacy_pending_migration",
    preLocalQty: localQty,
    preExchangeQty: localQty,
    qtyStep: lotInfo.qtyStep,
    allocation: buildProRataAllocation(positions),
    prePositionCount: positions.length,
    preAvgEntry,
    appliedQty: 0,
    appliedExecNotional: 0,
    appliedPnl: 0,
    appliedFees: 0,
    lastObservedStatus: "legacy_migrated",
    lastCheckedAt: req.now,
  });

  if (localQty <= tolerance(lotInfo.qtyStep) && exchangeQty <= tolerance(lotInfo.qtyStep)) {
    const receipt = req.state.adoptAlreadyCommittedLongTransaction(
      legacy.orderLinkId,
      orderId,
      order.status || "legacy_both_flat",
      cumExecQty,
      avgPrice,
      executions.executionIds,
      req.now,
    );
    return fromReceipt(receipt, 0, 0, 0, true);
  }
  return resolvePendingLongTransaction({ ...req, initialExecution: initial });
}

export async function reconcileExternalFlatLong(
  req: BaseRequest & { orderLinkId?: string },
): Promise<LongTransactionResult> {
  if (req.state.getPendingOrder()) {
    return {
      outcome: "failed", kind: "full_close", orderLinkId: "", orderId: "", status: "pending_exists",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: totalQty(req.state), preAvgEntry: 0, prePositionCount: 0, synced: false,
      error: `pending order already active: ${req.state.getPendingOrder()?.orderLinkId}`,
    };
  }
  const positions = req.state.get().positions;
  const preLocalQty = totalQty(req.state);
  if (positions.length === 0 || preLocalQty <= 0) {
    return {
      outcome: "rejected", kind: "full_close", orderLinkId: "", orderId: "", status: "no_local_position",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: 0, preAvgEntry: 0, prePositionCount: 0, synced: true,
    };
  }

  let lotInfo;
  let exchangeQty: number;
  try {
    [lotInfo, exchangeQty] = await Promise.all([
      req.executor.getInstrumentLotInfo(req.symbol),
      req.executor.getLongPositionSize(req.symbol),
    ]);
  } catch (err: any) {
    req.state.setRecoveryMode(true);
    return {
      outcome: "failed", kind: "full_close", orderLinkId: "", orderId: "", status: "external_reconcile_query_failed",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: preLocalQty, preAvgEntry: 0, prePositionCount: positions.length, synced: false,
      error: err.message,
    };
  }
  if (exchangeQty > tolerance(lotInfo.qtyStep)) {
    req.state.setRecoveryMode(true);
    return {
      outcome: "failed", kind: "full_close", orderLinkId: "", orderId: "", status: "exchange_not_flat",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: preLocalQty, preAvgEntry: 0, prePositionCount: positions.length, synced: false,
      error: `external-flat reconciliation called with exchange qty ${exchangeQty}`,
    };
  }

  const stateLastUpdated = req.state.get().lastUpdated;
  const earliestAvailable = Math.max(0, req.now - MAX_BYBIT_EVIDENCE_WINDOW_MS + 1_000);
  const evidenceStartTime = Math.min(
    req.now,
    Math.max(earliestAvailable, stateLastUpdated - NATIVE_EVIDENCE_LOOKBACK_MS),
  );
  const preAvgEntry = positions.reduce((sum, position) => sum + position.entryPrice * position.qty, 0) / preLocalQty;
  const orderLinkId = req.orderLinkId ?? genOrderLinkId("external_close");
  req.state.beginFullClose({
    kind: "full_close",
    action: "close",
    orderLinkId,
    symbol: req.symbol,
    createdAt: req.now,
    reason: "startup_exchange_flat_reconciliation",
    externalEvidenceStartTime: evidenceStartTime,
    preLocalQty,
    preExchangeQty: 0,
    qtyStep: lotInfo.qtyStep,
    allocation: buildProRataAllocation(positions),
    prePositionCount: positions.length,
    preAvgEntry,
    appliedQty: 0,
    appliedExecNotional: 0,
    appliedPnl: 0,
    appliedFees: 0,
    lastObservedStatus: "external_flat_detected",
    lastCheckedAt: req.now,
  });
  return resolvePendingLongTransaction({
    ...req,
    initialExecution: {
      outcome: "already_flat",
      orderId: "no_position",
      orderLinkId,
      status: "external_flat_detected",
      terminal: true,
      submittedQty: 0,
      quotePrice: 0,
      cumExecQty: 0,
      cumExecNotional: null,
      avgPrice: null,
      remainingLongQty: 0,
      qtyStep: lotInfo.qtyStep,
      executionIds: [],
    },
  });
}

export async function executeLongOpenTransaction(
  req: LongOpenTransactionRequest,
): Promise<LongTransactionResult> {
  if (req.state.getPendingOrder()) {
    return {
      outcome: "failed", kind: "long_open", orderLinkId: "", orderId: "", status: "pending_exists",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: totalQty(req.state), preAvgEntry: 0, prePositionCount: 0, synced: false,
      error: `pending order already active: ${req.state.getPendingOrder()?.orderLinkId}`,
    };
  }
  const lotInfo = await req.executor.getInstrumentLotInfo(req.symbol);
  const preLocalQty = totalQty(req.state);
  const preExchangeQty = await req.executor.getLongPositionSize(req.symbol);
  if (!qtyMatches(preLocalQty, preExchangeQty, lotInfo.qtyStep)) {
    req.state.setRecoveryMode(true);
    return {
      outcome: "failed", kind: "long_open", orderLinkId: "", orderId: "", status: "pre_state_mismatch",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: preLocalQty, preAvgEntry: 0, prePositionCount: 0, synced: false,
      error: `pre-open exchange/local mismatch ${preExchangeQty}/${preLocalQty}`,
    };
  }

  const orderLinkId = req.orderLinkId ?? genOrderLinkId("open");
  req.state.beginLongOpen({
    kind: "long_open", action: "open", orderLinkId, symbol: req.symbol, createdAt: req.now,
    level: req.level, requestedNotional: req.notional, preLocalQty, preExchangeQty,
    qtyStep: lotInfo.qtyStep, lastObservedStatus: "created", lastCheckedAt: req.now,
  });
  const execution = await req.executor.openLongDetailed(req.symbol, req.notional, req.leverage, orderLinkId);
  return resolvePendingLongTransaction({ ...req, initialExecution: execution });
}

export async function executeFullCloseTransaction(
  req: FullCloseTransactionRequest,
): Promise<LongTransactionResult> {
  if (req.state.getPendingOrder()) {
    return {
      outcome: "failed", kind: "full_close", orderLinkId: "", orderId: "", status: "pending_exists",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: totalQty(req.state), preAvgEntry: 0, prePositionCount: 0, synced: false,
      error: `pending order already active: ${req.state.getPendingOrder()?.orderLinkId}`,
    };
  }
  const positions = req.state.get().positions;
  const preLocalQty = totalQty(req.state);
  if (positions.length === 0 || preLocalQty <= 0) {
    return {
      outcome: "rejected", kind: "full_close", orderLinkId: "", orderId: "", status: "no_local_position",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: 0, preAvgEntry: 0, prePositionCount: 0, synced: true,
    };
  }
  const lotInfo = await req.executor.getInstrumentLotInfo(req.symbol);
  const preExchangeQty = await req.executor.getLongPositionSize(req.symbol);
  const preAvgEntry = positions.reduce((sum, pos) => sum + pos.entryPrice * pos.qty, 0) / preLocalQty;
  if (preExchangeQty > tolerance(lotInfo.qtyStep) && !qtyMatches(preLocalQty, preExchangeQty, lotInfo.qtyStep)) {
    req.state.setRecoveryMode(true);
    return {
      outcome: "failed",
      kind: "full_close",
      orderLinkId: "",
      orderId: "",
      status: "pre_state_mismatch",
      filledQty: 0,
      avgPrice: null,
      totalPnl: 0,
      totalFees: 0,
      positionsClosed: 0,
      remainingQty: preLocalQty,
      preAvgEntry,
      prePositionCount: positions.length,
      synced: false,
      error: `pre-close exchange/local mismatch ${preExchangeQty}/${preLocalQty}`,
    };
  }
  const orderLinkId = req.orderLinkId ?? genOrderLinkId("close");
  req.state.beginFullClose({
    kind: "full_close", action: "close", orderLinkId, symbol: req.symbol, createdAt: req.now,
    reason: req.reason, preLocalQty, preExchangeQty, qtyStep: lotInfo.qtyStep,
    allocation: buildProRataAllocation(positions), prePositionCount: positions.length, preAvgEntry,
    appliedQty: 0, appliedExecNotional: 0, appliedPnl: 0, appliedFees: 0,
    lastObservedStatus: "created", lastCheckedAt: req.now,
  });

  const execution = await req.executor.closeAllLongsDetailed(req.symbol, orderLinkId);
  return resolvePendingLongTransaction({ ...req, initialExecution: execution });
}
