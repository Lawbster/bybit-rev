import {
  Executor,
  genOrderLinkId,
  LongExecutionResult,
  mergeOrderAndExecutionEvidence,
  TradingStopResult,
} from "./executor";
import {
  MakerTpCloseSource,
  MakerTpOrderState,
  MakerTpReceipt,
} from "./maker-tp-transaction";
import { FullCloseIntent } from "./long-transaction";
import {
  executeFullCloseTransaction,
  LongTransactionResult,
  reconcileExternalFlatLong,
  resolvePendingLongTransaction,
} from "./long-transaction-coordinator";
import { buildProRataAllocation } from "./partial-close-transaction";
import { StateManager } from "./state";

export type MakerTpCoordinatorOutcome =
  | "active"
  | "full_committed"
  | "cancelled_zero_fill"
  | "fallback_required"
  | "pending"
  | "rejected"
  | "failed";

export interface MakerTpCoordinatorResult {
  outcome: MakerTpCoordinatorOutcome;
  orderLinkId: string;
  orderId: string;
  status: string;
  filledQty: number;
  avgPrice: number | null;
  totalPnl: number;
  totalFees: number;
  positionsClosed: number;
  remainingQty: number;
  synced: boolean;
  receipt?: MakerTpReceipt;
  error?: string;
}

interface BaseRequest {
  state: StateManager;
  executor: Executor;
  symbol: string;
  now: number;
  entryFeeRate: number;
  makerExitFeeRate: number;
  touchGraceMs: number;
}

export interface EnsureMakerTpRequest extends BaseRequest {
  price: number;
  activeTpPct: number;
  closeReason: string;
  orderLinkId?: string;
}

export interface ResolveMakerTpRequest extends BaseRequest {
  initialExecution?: LongExecutionResult;
}

function totalQty(state: StateManager): number {
  return state.get().positions.reduce((sum, position) => sum + position.qty, 0);
}

function tolerance(qtyStep: number): number {
  return Math.max(qtyStep / 2, 1e-8);
}

function qtyMatches(a: number, b: number, qtyStep: number): boolean {
  return Math.abs(a - b) <= tolerance(qtyStep);
}

const PROTECTION_VERIFY_ATTEMPTS = 5;
const PROTECTION_VERIFY_DELAY_MS = 150;

async function verifyLongTp(
  executor: Executor,
  symbol: string,
  expectedPrice: number,
): Promise<TradingStopResult> {
  let tick = 0.0001;
  try { tick = (await executor.getInstrumentLotInfo(symbol)).priceTick ?? tick; } catch { /* use conservative fallback */ }
  const expected = Number(expectedPrice.toFixed(4));
  let lastObserved: number | null = null;
  for (let attempt = 0; attempt < PROTECTION_VERIFY_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, PROTECTION_VERIFY_DELAY_MS));
    try {
      const snapshot = await executor.getLongPositionProtection(symbol);
      lastObserved = snapshot.takeProfit;
      if (snapshot.size <= 0) {
        return { success: false, status: "failed", error: "long position flat while verifying native TP" };
      }
      if (Math.abs(snapshot.takeProfit - expected) <= Math.max(tick / 2, 1e-8)) {
        return { success: true, status: "confirmed" };
      }
    } catch { /* retry boundedly */ }
  }
  return {
    success: false,
    status: "failed",
    error: `native TP verification mismatch expected=${expected} observed=${lastObserved ?? "unknown"}`,
  };
}

export async function setVerifiedLongPositionTp(
  executor: Executor,
  symbol: string,
  price: number,
): Promise<TradingStopResult> {
  const submitted = await executor.setPositionTp(symbol, price, 1);
  const verified = await verifyLongTp(executor, symbol, price);
  if (verified.success) return verified;
  return {
    ...verified,
    error: `${submitted.success ? "set acknowledged" : `set failed: ${submitted.error ?? submitted.retMsg ?? "unknown"}`}; ${verified.error}`,
  };
}

export async function clearVerifiedLongPositionTp(
  executor: Executor,
  symbol: string,
): Promise<TradingStopResult> {
  const submitted = await executor.clearPositionTp(symbol, 1);
  let lastObserved: number | null = null;
  for (let attempt = 0; attempt < PROTECTION_VERIFY_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, PROTECTION_VERIFY_DELAY_MS));
    try {
      const snapshot = await executor.getLongPositionProtection(symbol);
      lastObserved = snapshot.takeProfit;
      if (snapshot.size <= 0) {
        return { success: false, status: "failed", error: "long position flat while verifying native TP clear" };
      }
      if (Math.abs(snapshot.takeProfit) <= 1e-12) return { success: true, status: "confirmed" };
    } catch { /* retry boundedly */ }
  }
  return {
    success: false,
    status: "failed",
    error: `${submitted.success ? "clear acknowledged" : `clear failed: ${submitted.error ?? submitted.retMsg ?? "unknown"}`}; native TP clear unverified observed=${lastObserved ?? "unknown"}`,
  };
}

function validateActiveMakerOrder(maker: MakerTpOrderState, execution: LongExecutionResult): string | null {
  const evidence = execution.orderEvidence;
  if (!evidence?.found) return "active maker order lacks exact exchange order evidence";
  if (evidence.orderLinkId !== maker.orderLinkId) return `maker orderLinkId mismatch ${evidence.orderLinkId}`;
  if (maker.orderId && evidence.orderId !== maker.orderId) return `maker orderId mismatch ${evidence.orderId}`;
  if (evidence.side !== "Sell") return `maker side mismatch ${evidence.side ?? "unknown"}`;
  if (evidence.orderType !== "Limit") return `maker order type mismatch ${evidence.orderType ?? "unknown"}`;
  if (evidence.timeInForce !== "PostOnly") return `maker timeInForce mismatch ${evidence.timeInForce ?? "unknown"}`;
  if (evidence.positionIdx !== 1) return `maker positionIdx mismatch ${evidence.positionIdx ?? "unknown"}`;
  if (evidence.reduceOnly !== true) return "maker reduceOnly not confirmed";
  const expectedQty = maker.submittedQty ?? execution.submittedQty;
  if (!qtyMatches(expectedQty, maker.requestedQty, maker.qtyStep)) {
    return `maker submitted/requested qty mismatch ${expectedQty}/${maker.requestedQty}`;
  }
  if (evidence.qty === undefined || !qtyMatches(evidence.qty, expectedQty, maker.qtyStep)) {
    return `maker exchange qty mismatch ${evidence.qty ?? "unknown"}/${expectedQty}`;
  }
  if (
    evidence.leavesQty === undefined
    || !qtyMatches(evidence.leavesQty + execution.cumExecQty, evidence.qty, maker.qtyStep)
  ) {
    return "maker leaves quantity does not reconcile with cumulative fills";
  }
  const expectedPrice = maker.exchangePrice ?? execution.quotePrice;
  const priceTolerance = Math.max((maker.priceTick ?? 0) / 2, 1e-8);
  if (evidence.price === undefined || Math.abs(evidence.price - expectedPrice) > priceTolerance) {
    return `maker exchange price mismatch ${evidence.price ?? "unknown"}/${expectedPrice}`;
  }
  return null;
}

function fromReceipt(receipt: MakerTpReceipt, remainingQty: number): MakerTpCoordinatorResult {
  return {
    outcome: receipt.outcome === "full_committed" ? "full_committed"
      : receipt.outcome === "cancelled_zero_fill" ? "cancelled_zero_fill"
      : "fallback_required",
    orderLinkId: receipt.orderLinkId,
    orderId: receipt.orderId,
    status: receipt.terminalStatus,
    filledQty: receipt.filledQty,
    avgPrice: receipt.avgPrice,
    totalPnl: receipt.totalPnl,
    totalFees: receipt.totalFees,
    positionsClosed: receipt.positionsClosed,
    remainingQty,
    synced: true,
    receipt,
  };
}

function pendingResult(
  maker: MakerTpOrderState,
  execution: LongExecutionResult | null,
  remainingQty: number,
  synced: boolean,
  error?: string,
): MakerTpCoordinatorResult {
  return {
    outcome: maker.phase === "fallback_required" ? "fallback_required" : "pending",
    orderLinkId: maker.orderLinkId,
    orderId: execution?.orderId || maker.orderId,
    status: execution?.status ?? maker.lastObservedStatus,
    filledQty: maker.appliedQty,
    avgPrice: maker.appliedQty > 0 ? maker.appliedExecNotional / maker.appliedQty : null,
    totalPnl: maker.appliedPnl,
    totalFees: maker.appliedFees,
    positionsClosed: 0,
    remainingQty,
    synced,
    error,
  };
}

async function observeMakerTpExecution(
  executor: Executor,
  maker: MakerTpOrderState,
): Promise<LongExecutionResult> {
  const [order, executions] = await Promise.all([
    executor.queryOrderExecution(maker.symbol, maker.orderLinkId),
    executor.queryOrderExecutions(maker.symbol, maker.orderLinkId, true),
  ]);
  const merged = mergeOrderAndExecutionEvidence(order, executions);
  let remainingLongQty: number | null = null;
  try { remainingLongQty = await executor.getLongPositionSize(maker.symbol); } catch { remainingLongQty = null; }
  return {
    outcome: order.found ? (order.terminal ? "terminal" : "accepted_unresolved") : "unknown",
    orderId: merged.orderId || maker.orderId,
    orderLinkId: maker.orderLinkId,
    status: order.found ? order.status : (executions.found ? "execution_only" : order.status),
    terminal: order.found && order.terminal,
    submittedQty: maker.requestedQty,
    quotePrice: maker.price,
    cumExecQty: merged.cumExecQty,
    cumExecNotional: merged.cumExecNotional,
    avgPrice: merged.avgPrice,
    remainingLongQty,
    qtyStep: maker.qtyStep,
    executionIds: merged.executionIds,
    orderEvidence: order,
    executionIdentityConfirmed: executions.identityConfirmed === true,
    ...(merged.lastExecTime === undefined ? {} : { lastExecTime: merged.lastExecTime }),
    ...(order.error || executions.error ? { error: order.error ?? executions.error } : {}),
  };
}

async function classifyExecution(
  req: ResolveMakerTpRequest,
  makerAtStart: MakerTpOrderState,
  execution: LongExecutionResult,
  preserveTerminalForFallback = false,
): Promise<MakerTpCoordinatorResult> {
  const { state } = req;
  const orderEvidence = execution.orderEvidence;
  const evidenceLinkMismatch = orderEvidence?.found === true
    && orderEvidence.orderLinkId !== makerAtStart.orderLinkId;
  const evidenceOrderMismatch = orderEvidence?.found === true
    && !!makerAtStart.orderId
    && !!orderEvidence.orderId
    && orderEvidence.orderId !== makerAtStart.orderId;
  const resultOrderMismatch = !!makerAtStart.orderId
    && !!execution.orderId
    && execution.orderId !== makerAtStart.orderId;
  if (execution.orderLinkId !== makerAtStart.orderLinkId || evidenceLinkMismatch || evidenceOrderMismatch || resultOrderMismatch) {
    state.markMakerTpOrder(makerAtStart.orderLinkId, {
      phase: "recovery",
      status: `${execution.status}:identity_mismatch`,
      checkedAt: req.now,
    });
    state.enterTransactionRecovery(makerAtStart.orderLinkId);
    return pendingResult(
      state.getMakerTpOrder()!,
      execution,
      totalQty(state),
      false,
      "maker execution identity does not match durable owner",
    );
  }
  if (
    (execution.orderId && !makerAtStart.orderId)
    || (execution.quotePrice > 0 && makerAtStart.exchangePrice === null)
    || (execution.submittedQty > 0 && makerAtStart.submittedQty === null)
  ) {
    state.markMakerTpOrder(makerAtStart.orderLinkId, {
      ...(execution.orderId ? { orderId: execution.orderId } : {}),
      ...(execution.quotePrice > 0 ? { exchangePrice: execution.quotePrice } : {}),
      ...(execution.submittedQty > 0 ? { submittedQty: execution.submittedQty } : {}),
      status: execution.status,
      checkedAt: req.now,
    });
  }

  let appliedDeltaQty = 0;
  if (execution.cumExecQty > makerAtStart.makerCumExecQty + 1e-9) {
    const orderIdentityConfirmed = orderEvidence?.found === true
      && orderEvidence.orderLinkId === makerAtStart.orderLinkId
      && (!makerAtStart.orderId || !orderEvidence.orderId || orderEvidence.orderId === makerAtStart.orderId);
    if (!orderIdentityConfirmed && execution.executionIdentityConfirmed !== true) {
      state.markMakerTpOrder(makerAtStart.orderLinkId, {
        phase: "recovery",
        status: `${execution.status}:fill_identity_unverified`,
        checkedAt: req.now,
      });
      state.enterTransactionRecovery(makerAtStart.orderLinkId);
      return pendingResult(
        state.getMakerTpOrder()!,
        execution,
        totalQty(state),
        false,
        "maker fill lacks exact order identity evidence",
      );
    }
    const notional = execution.cumExecNotional ?? (
      execution.avgPrice !== null ? execution.avgPrice * execution.cumExecQty : 0
    );
    if (notional <= 0) {
      state.markMakerTpOrder(makerAtStart.orderLinkId, {
        phase: "recovery",
        status: `${execution.status}:missing_notional`,
        checkedAt: req.now,
      });
      state.enterTransactionRecovery(makerAtStart.orderLinkId);
      return pendingResult(state.getMakerTpOrder()!, execution, totalQty(state), false, "maker fill missing execution notional");
    }
    try {
      const applied = state.applyObservedMakerTpFill(
        makerAtStart.orderLinkId,
        execution.cumExecQty,
        notional,
        execution.executionIds,
        execution.status,
        req.now,
        req.entryFeeRate,
        req.makerExitFeeRate,
      );
      appliedDeltaQty = applied.deltaQty;
    } catch (err: any) {
      state.markMakerTpOrder(makerAtStart.orderLinkId, {
        phase: "recovery",
        status: `${execution.status}:apply_failed`,
        checkedAt: req.now,
      });
      state.enterTransactionRecovery(makerAtStart.orderLinkId);
      return pendingResult(state.getMakerTpOrder()!, execution, totalQty(state), false, err.message);
    }
  } else {
    state.markMakerTpOrder(makerAtStart.orderLinkId, {
      status: execution.status,
      checkedAt: req.now,
    });
  }

  const maker = state.getMakerTpOrder()!;
  let exchangeQty = execution.remainingLongQty;
  if (exchangeQty === null) {
    try { exchangeQty = await req.executor.getLongPositionSize(maker.symbol); } catch { exchangeQty = null; }
  }
  const localRemaining = totalQty(state);
  if (appliedDeltaQty > 1e-9 && localRemaining > tolerance(maker.qtyStep)) {
    const observedAt = execution.lastExecTime && execution.lastExecTime > 0
      ? Math.min(req.now, execution.lastExecTime)
      : req.now;
    state.requestMakerTpClose(maker.orderLinkId, {
      reason: maker.closeRequest?.reason ?? maker.closeReason,
      source: maker.closeRequest?.source ?? "maker_partial",
      requestedAt: observedAt,
      fallbackAfterAt: observedAt + req.touchGraceMs,
    }, req.now);
  }
  if (exchangeQty === null) {
    state.markMakerTpOrder(maker.orderLinkId, { phase: "recovery", status: `${execution.status}:position_unknown`, checkedAt: req.now });
    state.enterTransactionRecovery(maker.orderLinkId);
    return pendingResult(maker, execution, localRemaining, false, "exchange long quantity unavailable");
  }
  const synced = qtyMatches(exchangeQty, localRemaining, maker.qtyStep);
  if (!synced) {
    // The native TP can win the narrow handoff race between observing the
    // maker order active and clearing the exchange-native TP. Only import that
    // close after the maker order is terminal and exact, non-receipted exchange
    // evidence accounts for the entire locally remaining quantity.
    if (exchangeQty <= tolerance(maker.qtyStep) && execution.terminal) {
      const makerOutcome = maker.appliedQty > 1e-9 ? "partial_committed" : "cancelled_zero_fill";
      const prefix = state.finalizeMakerTpOrder(maker.orderLinkId, makerOutcome, execution.status, req.now).receipt;
      state.clearTransactionRecovery(maker.orderLinkId);
      const external = await reconcileExternalFlatLong({
        state,
        executor: req.executor,
        symbol: maker.symbol,
        feeRate: req.entryFeeRate,
        now: req.now,
        reason: maker.closeRequest?.reason ?? maker.closeReason,
        externalEvidenceStartTime: Math.max(0, maker.createdAt - 6 * 60_000),
        ...(prefix.filledQty > 0 ? { makerTpPrefixOrderLinkId: prefix.orderLinkId } : {}),
      });
      const combined = combineMakerTpFallbackResult(state, external);
      if (combined.outcome === "committed" && combined.avgPrice !== null) {
        return {
          outcome: "full_committed",
          orderLinkId: combined.orderLinkId,
          orderId: combined.orderId,
          status: combined.status,
          filledQty: combined.filledQty,
          avgPrice: combined.avgPrice,
          totalPnl: combined.totalPnl,
          totalFees: combined.totalFees,
          positionsClosed: prefix.prePositionCount,
          remainingQty: 0,
          synced: true,
          receipt: prefix,
        };
      }
      return {
        outcome: "pending",
        orderLinkId: combined.orderLinkId,
        orderId: combined.orderId,
        status: combined.status,
        filledQty: combined.filledQty,
        avgPrice: combined.avgPrice,
        totalPnl: combined.totalPnl,
        totalFees: combined.totalFees,
        positionsClosed: combined.positionsClosed,
        remainingQty: combined.remainingQty,
        synced: false,
        receipt: prefix,
        error: combined.error ?? "exchange flat after maker/native handoff without exact external close evidence",
      };
    }
    state.markMakerTpOrder(maker.orderLinkId, { phase: "recovery", status: `${execution.status}:qty_mismatch`, checkedAt: req.now });
    state.enterTransactionRecovery(maker.orderLinkId);
    return pendingResult(maker, execution, localRemaining, false, `exchange/local residual mismatch ${exchangeQty}/${localRemaining}`);
  }

  const exchangeFlat = exchangeQty <= tolerance(maker.qtyStep);
  const fullEvidence = maker.appliedQty >= maker.requestedQty - tolerance(maker.qtyStep);
  if (exchangeFlat && fullEvidence) {
    const finalized = state.finalizeMakerTpOrder(maker.orderLinkId, "full_committed", execution.status, req.now);
    state.clearTransactionRecovery(maker.orderLinkId);
    return fromReceipt(finalized.receipt, 0);
  }

  if (execution.outcome === "not_submitted" || execution.outcome === "rejected") {
    if (maker.appliedQty <= 1e-9 && qtyMatches(exchangeQty, maker.requestedQty, maker.qtyStep)) {
      const finalized = state.finalizeMakerTpOrder(maker.orderLinkId, "cancelled_zero_fill", execution.status, req.now);
      state.clearTransactionRecovery(maker.orderLinkId);
      return { ...fromReceipt(finalized.receipt, localRemaining), outcome: "rejected", error: execution.error };
    }
    state.markMakerTpOrder(maker.orderLinkId, { phase: "recovery", status: `${execution.status}:position_changed`, checkedAt: req.now });
    state.enterTransactionRecovery(maker.orderLinkId);
    return pendingResult(maker, execution, localRemaining, synced, execution.error ?? "maker rejected after position changed");
  }

  if (execution.terminal) {
    if (maker.appliedQty <= 1e-9) {
      if (/filled/i.test(execution.status)) {
        state.markMakerTpOrder(maker.orderLinkId, {
          phase: "recovery",
          status: `${execution.status}:zero_fill_contradiction`,
          checkedAt: req.now,
        });
        state.enterTransactionRecovery(maker.orderLinkId);
        return pendingResult(
          state.getMakerTpOrder()!,
          execution,
          localRemaining,
          false,
          "terminal filled status has no durable fill evidence",
        );
      }
      if (preserveTerminalForFallback) {
        state.markMakerTpOrder(maker.orderLinkId, { phase: "fallback_required", status: execution.status, checkedAt: req.now });
        state.clearTransactionRecovery(maker.orderLinkId);
        return pendingResult(state.getMakerTpOrder()!, execution, localRemaining, true);
      }
      const finalized = state.finalizeMakerTpOrder(maker.orderLinkId, "cancelled_zero_fill", execution.status, req.now);
      state.clearTransactionRecovery(maker.orderLinkId);
      return fromReceipt(finalized.receipt, localRemaining);
    }
    state.markMakerTpOrder(maker.orderLinkId, { phase: "fallback_required", status: execution.status, checkedAt: req.now });
    state.clearTransactionRecovery(maker.orderLinkId);
    return pendingResult(state.getMakerTpOrder()!, execution, localRemaining, true);
  }

  const explicitlyActive = execution.outcome === "accepted_unresolved"
    && !["accepted_unconfirmed", "not_found", "error", "execution_only"].includes(execution.status);
  if (explicitlyActive) {
    const contractError = validateActiveMakerOrder(state.getMakerTpOrder()!, execution);
    if (contractError) {
      state.markMakerTpOrder(maker.orderLinkId, { phase: "recovery", status: `${execution.status}:contract_unverified`, checkedAt: req.now });
      state.enterTransactionRecovery(maker.orderLinkId);
      return pendingResult(state.getMakerTpOrder()!, execution, localRemaining, false, contractError);
    }
    state.markMakerTpOrder(maker.orderLinkId, { phase: "active", status: execution.status, checkedAt: req.now });
    state.clearTransactionRecovery(maker.orderLinkId);
    return {
      outcome: "active",
      orderLinkId: maker.orderLinkId,
      orderId: execution.orderId || maker.orderId,
      status: execution.status,
      filledQty: maker.appliedQty,
      avgPrice: maker.appliedQty > 0 ? maker.appliedExecNotional / maker.appliedQty : null,
      totalPnl: maker.appliedPnl,
      totalFees: maker.appliedFees,
      positionsClosed: Math.max(0, maker.prePositionCount - state.get().positions.length),
      remainingQty: localRemaining,
      synced: true,
    };
  }

  state.markMakerTpOrder(maker.orderLinkId, { phase: "recovery", status: execution.status, checkedAt: req.now });
  state.enterTransactionRecovery(maker.orderLinkId);
  return pendingResult(state.getMakerTpOrder()!, execution, localRemaining, true, execution.error ?? "maker order terminal state unresolved");
}

export async function ensureMakerTpOrder(req: EnsureMakerTpRequest): Promise<MakerTpCoordinatorResult> {
  if (req.state.getPendingOrder()) {
    return {
      outcome: "failed", orderLinkId: "", orderId: "", status: "pending_exists",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: totalQty(req.state), synced: false, error: "another long transaction is pending",
    };
  }
  const existing = req.state.getMakerTpOrder();
  if (existing) {
    if (Math.abs(existing.price - req.price) <= 1e-8 && qtyMatches(existing.requestedQty, totalQty(req.state), existing.qtyStep)) {
      return resolveMakerTpOrder(req);
    }
    return pendingResult(existing, null, totalQty(req.state), false, "maker TP replacement required before new intent");
  }

  const positions = req.state.get().positions;
  const localQty = totalQty(req.state);
  if (positions.length === 0 || localQty <= 0 || req.price <= 0) {
    return {
      outcome: "failed", orderLinkId: "", orderId: "", status: "no_local_position",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: localQty, synced: false, error: "cannot place maker TP without local long quantity",
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
    return {
      outcome: "failed", orderLinkId: "", orderId: "", status: "preflight_failed",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: localQty, synced: false, error: err.message,
    };
  }
  if (!qtyMatches(exchangeQty, localQty, lotInfo.qtyStep)) {
    return {
      outcome: "failed", orderLinkId: "", orderId: "", status: "preflight_qty_mismatch",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: localQty, synced: false, error: `exchange/local qty mismatch ${exchangeQty}/${localQty}`,
    };
  }

  const totalNotional = positions.reduce((sum, position) => sum + position.entryPrice * position.qty, 0);
  const orderLinkId = req.orderLinkId ?? genOrderLinkId("maker_tp");
  const intent: MakerTpOrderState = {
    version: 2,
    symbol: req.symbol,
    orderLinkId,
    orderId: "",
    phase: "intent_persisted",
    closeReason: req.closeReason,
    activeTpPct: req.activeTpPct,
    price: req.price,
    exchangePrice: null,
    requestedQty: localQty,
    submittedQty: null,
    qtyStep: lotInfo.qtyStep,
    priceTick: lotInfo.priceTick ?? null,
    allocation: buildProRataAllocation(positions),
    prePositionCount: positions.length,
    preAvgEntry: totalNotional / localQty,
    preOldestEntryTime: Math.min(...positions.map(position => position.entryTime)),
    createdAt: req.now,
    updatedAt: req.now,
    touchedAt: null,
    fallbackDeadlineAt: null,
    closeRequest: null,
    lastObservedStatus: "intent_persisted",
    lastCheckedAt: req.now,
    makerCumExecQty: 0,
    makerCumExecNotional: 0,
    appliedQty: 0,
    appliedExecNotional: 0,
    appliedPnl: 0,
    appliedFees: 0,
    executionIds: [],
  };
  req.state.beginMakerTpOrder(intent);

  let execution: LongExecutionResult;
  try {
    execution = await req.executor.placeLongMakerTpDetailed(req.symbol, localQty, req.price, orderLinkId);
  } catch (err: any) {
    req.state.markMakerTpOrder(orderLinkId, { phase: "recovery", status: "submit_exception", checkedAt: req.now });
    req.state.enterTransactionRecovery(orderLinkId);
    return pendingResult(req.state.getMakerTpOrder()!, null, localQty, false, err.message);
  }
  return classifyExecution(req, intent, execution);
}

export async function resolveMakerTpOrder(req: ResolveMakerTpRequest): Promise<MakerTpCoordinatorResult> {
  const maker = req.state.getMakerTpOrder();
  if (!maker) {
    return {
      outcome: "failed", orderLinkId: "", orderId: "", status: "no_maker_tp",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: totalQty(req.state), synced: false, error: "no maker TP transaction",
    };
  }
  const completed = req.state.getCompletedMakerTpOrder(maker.orderLinkId);
  if (completed) return fromReceipt(completed, totalQty(req.state));
  try {
    const execution = req.initialExecution ?? await observeMakerTpExecution(req.executor, maker);
    return classifyExecution(req, maker, execution);
  } catch (err: any) {
    req.state.markMakerTpOrder(maker.orderLinkId, { phase: "recovery", status: "resolver_error", checkedAt: req.now });
    req.state.enterTransactionRecovery(maker.orderLinkId);
    return pendingResult(req.state.getMakerTpOrder()!, null, totalQty(req.state), false, err.message);
  }
}

export async function cancelAndResolveMakerTpOrder(
  req: ResolveMakerTpRequest,
  preserveTerminalForFallback = false,
): Promise<MakerTpCoordinatorResult> {
  const maker = req.state.getMakerTpOrder();
  if (!maker) {
    return {
      outcome: "cancelled_zero_fill", orderLinkId: "", orderId: "", status: "no_maker_tp",
      filledQty: 0, avgPrice: null, totalPnl: 0, totalFees: 0, positionsClosed: 0,
      remainingQty: totalQty(req.state), synced: true,
    };
  }
  req.state.markMakerTpOrder(maker.orderLinkId, {
    phase: "cancel_requested",
    status: "cancel_requested",
    checkedAt: req.now,
  });
  let execution: LongExecutionResult;
  try {
    execution = await req.executor.cancelLongMakerTpDetailed(maker.symbol, maker.orderLinkId, maker.orderId || undefined);
  } catch (err: any) {
    req.state.markMakerTpOrder(maker.orderLinkId, { phase: "recovery", status: "cancel_exception", checkedAt: req.now });
    req.state.enterTransactionRecovery(maker.orderLinkId);
    return pendingResult(req.state.getMakerTpOrder()!, null, totalQty(req.state), false, err.message);
  }
  const classified = await classifyExecution(req, maker, execution, preserveTerminalForFallback);
  if (classified.outcome === "active") {
    req.state.markMakerTpOrder(maker.orderLinkId, {
      phase: "cancel_requested",
      status: `${classified.status}:cancel_unconfirmed`,
      checkedAt: req.now,
    });
    req.state.enterTransactionRecovery(maker.orderLinkId);
    return {
      ...classified,
      outcome: "pending",
      synced: false,
      error: execution.error ?? "maker TP remains active after cancel request",
    };
  }
  return classified;
}

/**
 * Disable/rollback handoff for an already-durable maker owner. The feature
 * flag controls creation only: an existing exchange owner is first covered by
 * an exactly verified native TP, then cancelled and resolved transactionally.
 */
export async function retireMakerTpToNative(
  req: ResolveMakerTpRequest,
): Promise<MakerTpCoordinatorResult> {
  const maker = req.state.getMakerTpOrder();
  if (!maker) return cancelAndResolveMakerTpOrder(req);
  if (maker.closeRequest) {
    return pendingResult(
      maker,
      null,
      totalQty(req.state),
      false,
      "maker TP has a durable close request and cannot be retired to native protection",
    );
  }

  const restored = await setVerifiedLongPositionTp(req.executor, maker.symbol, maker.price);
  if (!restored.success) {
    // A native TP may have won the race and flattened the position. Resolve
    // once before retaining recovery so exact exchange evidence can commit it.
    const observed = await resolveMakerTpOrder({ ...req, now: Date.now() });
    if (observed.outcome === "full_committed") return observed;
    const current = req.state.getMakerTpOrder();
    if (current) {
      req.state.markMakerTpOrder(current.orderLinkId, {
        phase: "recovery",
        status: "native_restore_unverified",
        checkedAt: req.now,
      });
      req.state.enterTransactionRecovery(current.orderLinkId);
      return pendingResult(
        req.state.getMakerTpOrder()!,
        null,
        totalQty(req.state),
        false,
        restored.error ?? "native TP restore could not be verified",
      );
    }
    return observed;
  }

  return cancelAndResolveMakerTpOrder(req);
}

export function finalizePartialMakerTpForFallback(
  state: StateManager,
  orderLinkId: string,
  terminalStatus: string,
  completedAt: number,
): MakerTpReceipt {
  const maker = state.getMakerTpOrder();
  if (!maker || maker.orderLinkId !== orderLinkId || maker.phase !== "fallback_required") {
    throw new Error(`maker TP ${orderLinkId} is not ready for fallback finalization`);
  }
  return state.finalizeMakerTpOrder(orderLinkId, "partial_committed", terminalStatus, completedAt).receipt;
}

export function combineMakerTpFallbackResult(
  state: StateManager,
  result: LongTransactionResult,
): LongTransactionResult {
  const prefixId = result.makerTpPrefixOrderLinkId;
  if (!prefixId) return result;
  const prefix = state.getCompletedMakerTpOrder(prefixId);
  if (!prefix || prefix.filledQty <= 0 || prefix.avgPrice === null) return result;
  const totalFilled = prefix.filledQty + result.filledQty;
  const avgPrice = totalFilled > 0 && result.avgPrice !== null
    ? (prefix.avgPrice * prefix.filledQty + result.avgPrice * result.filledQty) / totalFilled
    : prefix.avgPrice;
  return {
    ...result,
    filledQty: totalFilled,
    avgPrice,
    totalPnl: prefix.totalPnl + result.totalPnl,
    totalFees: prefix.totalFees + result.totalFees,
    positionsClosed: result.remainingQty <= 0
      ? prefix.prePositionCount
      : Math.max(result.positionsClosed, prefix.positionsClosed),
    preAvgEntry: prefix.preAvgEntry,
    prePositionCount: prefix.prePositionCount,
    closeReason: result.closeReason ?? prefix.closeReason,
  };
}

export async function executeMakerTpMarketFallback(
  req: ResolveMakerTpRequest & { reason: string; source?: MakerTpCloseSource },
): Promise<LongTransactionResult> {
  const makerAtStart = req.state.getMakerTpOrder();
  if (!makerAtStart) {
    return executeFullCloseTransaction({
      state: req.state,
      executor: req.executor,
      symbol: req.symbol,
      feeRate: req.entryFeeRate,
      now: req.now,
      reason: req.reason,
    });
  }
  const closeRequest = req.state.requestMakerTpClose(makerAtStart.orderLinkId, {
    reason: req.reason,
    source: req.source ?? makerAtStart.closeRequest?.source ?? "forced",
    requestedAt: req.now,
    fallbackAfterAt: req.now,
  }, req.now);
  const maker = req.state.getMakerTpOrder()!;
  // Re-establish the exact exchange-native TP before cancelling the resting
  // maker. This keeps exchange-side protection across the cancel/fallback
  // handoff and lets the existing exact-evidence resolver handle a native fill
  // that wins the race. A forced close still proceeds if this best-effort
  // protection restore fails; retaining a stale position would be worse.
  try { await setVerifiedLongPositionTp(req.executor, maker.symbol, maker.price); } catch { /* fallback remains authoritative */ }
  const cancelled = await cancelAndResolveMakerTpOrder(req, true);
  if (cancelled.outcome === "full_committed" && cancelled.receipt) {
    return {
      outcome: "committed",
      kind: "full_close",
      orderLinkId: cancelled.orderLinkId,
      orderId: cancelled.orderId,
      status: cancelled.status,
      filledQty: cancelled.filledQty,
      avgPrice: cancelled.avgPrice,
      totalPnl: cancelled.totalPnl,
      totalFees: cancelled.totalFees,
      positionsClosed: cancelled.receipt.prePositionCount,
      remainingQty: 0,
      preAvgEntry: cancelled.receipt.preAvgEntry,
      prePositionCount: cancelled.receipt.prePositionCount,
      synced: true,
      closeReason: cancelled.receipt.closeReason,
    };
  }
  if (cancelled.outcome === "pending" || cancelled.outcome === "active" || cancelled.outcome === "failed") {
    return {
      outcome: "pending",
      kind: "full_close",
      orderLinkId: cancelled.orderLinkId,
      orderId: cancelled.orderId,
      status: cancelled.status,
      filledQty: cancelled.filledQty,
      avgPrice: cancelled.avgPrice,
      totalPnl: cancelled.totalPnl,
      totalFees: cancelled.totalFees,
      positionsClosed: cancelled.positionsClosed,
      remainingQty: cancelled.remainingQty,
      preAvgEntry: maker.preAvgEntry,
      prePositionCount: maker.prePositionCount,
      synced: false,
      closeReason: closeRequest.reason,
      error: cancelled.error ?? "maker TP cancellation unresolved",
    };
  }

  if (cancelled.outcome !== "fallback_required") {
    return {
      outcome: "pending",
      kind: "full_close",
      orderLinkId: cancelled.orderLinkId,
      orderId: cancelled.orderId,
      status: cancelled.status,
      filledQty: cancelled.filledQty,
      avgPrice: cancelled.avgPrice,
      totalPnl: cancelled.totalPnl,
      totalFees: cancelled.totalFees,
      positionsClosed: cancelled.positionsClosed,
      remainingQty: cancelled.remainingQty,
      preAvgEntry: maker.preAvgEntry,
      prePositionCount: maker.prePositionCount,
      synced: false,
      closeReason: closeRequest.reason,
      error: cancelled.error ?? `unexpected maker fallback state ${cancelled.outcome}`,
    };
  }

  const positions = req.state.get().positions;
  const localQty = totalQty(req.state);
  let qtyStep: number;
  let exchangeQty: number;
  try {
    const [lotInfo, observedExchangeQty] = await Promise.all([
      req.executor.getInstrumentLotInfo(req.symbol),
      req.executor.getLongPositionSize(req.symbol),
    ]);
    qtyStep = lotInfo.qtyStep;
    exchangeQty = observedExchangeQty;
  } catch (err: any) {
    req.state.markMakerTpOrder(maker.orderLinkId, { phase: "recovery", status: "fallback_preflight_failed", checkedAt: req.now });
    req.state.enterTransactionRecovery(maker.orderLinkId);
    return {
      outcome: "pending", kind: "full_close", orderLinkId: maker.orderLinkId, orderId: maker.orderId,
      status: "fallback_preflight_failed", filledQty: maker.appliedQty,
      avgPrice: maker.appliedQty > 0 ? maker.appliedExecNotional / maker.appliedQty : null,
      totalPnl: maker.appliedPnl, totalFees: maker.appliedFees,
      positionsClosed: Math.max(0, maker.prePositionCount - positions.length), remainingQty: localQty,
      preAvgEntry: maker.preAvgEntry, prePositionCount: maker.prePositionCount, synced: false,
      closeReason: closeRequest.reason, error: err.message,
    };
  }
  const exchangeFlat = exchangeQty <= tolerance(qtyStep);
  if (!exchangeFlat && !qtyMatches(exchangeQty, localQty, qtyStep)) {
    req.state.markMakerTpOrder(maker.orderLinkId, { phase: "recovery", status: "fallback_qty_mismatch", checkedAt: req.now });
    req.state.enterTransactionRecovery(maker.orderLinkId);
    return {
      outcome: "pending", kind: "full_close", orderLinkId: maker.orderLinkId, orderId: maker.orderId,
      status: "fallback_qty_mismatch", filledQty: maker.appliedQty,
      avgPrice: maker.appliedQty > 0 ? maker.appliedExecNotional / maker.appliedQty : null,
      totalPnl: maker.appliedPnl, totalFees: maker.appliedFees,
      positionsClosed: Math.max(0, maker.prePositionCount - positions.length), remainingQty: localQty,
      preAvgEntry: maker.preAvgEntry, prePositionCount: maker.prePositionCount, synced: false,
      closeReason: closeRequest.reason,
      error: `fallback exchange/local residual mismatch ${exchangeQty}/${localQty}`,
    };
  }

  const fallbackOrderLinkId = genOrderLinkId("maker_fallback");
  const residualNotional = positions.reduce((sum, position) => sum + position.entryPrice * position.qty, 0);
  const fallbackIntent: FullCloseIntent = {
    kind: "full_close",
    action: "close",
    orderLinkId: fallbackOrderLinkId,
    symbol: req.symbol,
    createdAt: req.now,
    reason: closeRequest.reason,
    externalEvidenceStartTime: Math.max(0, maker.createdAt - 6 * 60_000),
    preLocalQty: localQty,
    preExchangeQty: exchangeQty,
    qtyStep,
    allocation: buildProRataAllocation(positions),
    prePositionCount: positions.length,
    preAvgEntry: localQty > 0 ? residualNotional / localQty : maker.preAvgEntry,
    appliedQty: 0,
    appliedExecNotional: 0,
    appliedPnl: 0,
    appliedFees: 0,
    lastObservedStatus: "maker_fallback_created",
    lastCheckedAt: req.now,
    ...(maker.appliedQty > 1e-9 ? { makerTpPrefixOrderLinkId: maker.orderLinkId } : {}),
  };
  req.state.transitionMakerTpToFullClose(maker.orderLinkId, cancelled.status, fallbackIntent, req.now);
  const execution: LongExecutionResult = exchangeFlat ? {
    outcome: "already_flat",
    orderId: "no_position",
    orderLinkId: fallbackOrderLinkId,
    status: "exchange_flat_before_fallback_submit",
    terminal: true,
    submittedQty: 0,
    quotePrice: 0,
    cumExecQty: 0,
    cumExecNotional: null,
    avgPrice: null,
    remainingLongQty: 0,
    qtyStep,
    executionIds: [],
  } : await req.executor.closeAllLongsDetailed(req.symbol, fallbackOrderLinkId);
  const market = await resolvePendingLongTransaction({
    state: req.state,
    executor: req.executor,
    symbol: req.symbol,
    feeRate: req.entryFeeRate,
    now: req.now,
    initialExecution: execution,
  });
  return combineMakerTpFallbackResult(req.state, market);
}
