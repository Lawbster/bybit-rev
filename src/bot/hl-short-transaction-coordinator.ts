import {
  ClosedPnlEvidence,
  genOrderLinkId,
  ShortCloseExecutionEvidence,
  ShortExecutionResult,
  TransactionalShortExecutor,
} from "./executor";
import {
  HL_SHORT_BREAKDOWN_POLICY,
} from "./hl-short-breakdown-policy";
import {
  HlShortLiveStateStore,
  HlShortManagedPosition,
  HlShortReceipt,
} from "./hl-short-live-state";

export type HlShortTransactionOutcome =
  | "committed"
  | "partial_terminal"
  | "pending"
  | "rejected"
  | "skipped"
  | "recovery";

export interface HlShortTransactionResult {
  outcome: HlShortTransactionOutcome;
  action: "open" | "close" | "reconcile" | "protection";
  status: string;
  orderLinkId: string;
  orderId: string;
  filledQty: number;
  avgPrice: number | null;
  remainingQty: number | null;
  pnl: number;
  error?: string;
}

export interface HlShortCoordinatorOptions {
  symbol?: "HYPEUSDT";
  leverage: number;
  feeRate: number;
  maximumProtectionFailures?: number;
}

const NATIVE_EVIDENCE_LOOKBACK_MS = 30_000;
const NATIVE_EVIDENCE_FUTURE_MS = 5_000;
const MAX_BYBIT_EVIDENCE_WINDOW_MS = 7 * 24 * 60 * 60_000;

function tolerance(qtyStep: number): number {
  return Math.max(qtyStep / 2, 1e-8);
}

function qtyMatches(a: number, b: number, qtyStep: number): boolean {
  return Math.abs(a - b) <= tolerance(qtyStep);
}

function priceMatches(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1e-8, Math.max(Math.abs(a), Math.abs(b)) * 1e-10);
}

function pendingResult(
  action: HlShortTransactionResult["action"],
  execution: ShortExecutionResult,
): HlShortTransactionResult {
  return {
    outcome: "pending",
    action,
    status: execution.status,
    orderLinkId: execution.orderLinkId,
    orderId: execution.orderId,
    filledQty: execution.cumExecQty,
    avgPrice: execution.avgPrice,
    remainingQty: execution.remainingShortQty,
    pnl: 0,
    error: execution.error,
  };
}

function receiptResult(receipt: HlShortReceipt, remainingQty: number): HlShortTransactionResult {
  return {
    outcome: receipt.outcome === "partial_terminal" ? "partial_terminal"
      : receipt.outcome === "rejected" ? "rejected" : "committed",
    action: receipt.kind === "short_open" ? "open" : "close",
    status: receipt.terminalStatus,
    orderLinkId: receipt.orderLinkId,
    orderId: receipt.orderId,
    filledQty: receipt.filledQty,
    avgPrice: receipt.avgPrice,
    remainingQty,
    pnl: receipt.pnl,
    error: receipt.reason,
  };
}

function evidenceWindow(position: HlShortManagedPosition, now: number): { startTime: number; endTime: number } {
  return {
    startTime: Math.max(now - MAX_BYBIT_EVIDENCE_WINDOW_MS, position.entryTime - NATIVE_EVIDENCE_LOOKBACK_MS),
    endTime: now + NATIVE_EVIDENCE_FUTURE_MS,
  };
}

function groupExecutionEvidence(rows: ShortCloseExecutionEvidence[]): Array<{
  orderId: string;
  orderLinkId: string;
  qty: number;
  avgPrice: number;
  fees: number;
  executionIds: string[];
  completedAt: number;
}> {
  const groups = new Map<string, ShortCloseExecutionEvidence[]>();
  for (const row of rows) {
    if (!row.orderId || row.execQty <= 0 || row.execPrice <= 0) continue;
    const group = groups.get(row.orderId) ?? [];
    group.push(row);
    groups.set(row.orderId, group);
  }
  return [...groups.entries()].map(([orderId, group]) => {
    const qty = group.reduce((sum, row) => sum + row.execQty, 0);
    const notional = group.reduce((sum, row) => sum + row.execQty * row.execPrice, 0);
    return {
      orderId,
      orderLinkId: group.find(row => row.orderLinkId)?.orderLinkId ?? "",
      qty,
      avgPrice: qty > 0 ? notional / qty : 0,
      fees: group.reduce((sum, row) => sum + row.execFee, 0),
      executionIds: group.map(row => row.execId),
      completedAt: Math.max(...group.map(row => row.execTime)),
    };
  });
}

export class HlShortTransactionCoordinator {
  readonly state: HlShortLiveStateStore;
  readonly executor: TransactionalShortExecutor;
  readonly symbol: "HYPEUSDT";
  readonly leverage: number;
  readonly feeRate: number;
  readonly maximumProtectionFailures: number;

  constructor(
    state: HlShortLiveStateStore,
    executor: TransactionalShortExecutor,
    options: HlShortCoordinatorOptions,
  ) {
    this.state = state;
    this.executor = executor;
    this.symbol = options.symbol ?? "HYPEUSDT";
    this.leverage = options.leverage;
    this.feeRate = options.feeRate;
    this.maximumProtectionFailures = options.maximumProtectionFailures ?? 3;
  }

  async executeOpen(signalId: string, decisionTs: number, notional: number, now: number): Promise<HlShortTransactionResult> {
    const current = this.state.get();
    if (this.state.isSignalKnown(signalId)) {
      return { outcome: "skipped", action: "open", status: "signal_already_processed", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: current.position?.qty ?? 0, pnl: 0 };
    }
    if (current.pending || current.position || current.recoveryMode) {
      this.state.recordSignalSkip(signalId, decisionTs, current.recoveryMode ? "recovery_active" : "short_owner_busy", now);
      return { outcome: "skipped", action: "open", status: current.recoveryMode ? "recovery_active" : "short_owner_busy", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: current.position?.qty ?? 0, pnl: 0 };
    }
    if (!await this.executor.ensureHedgeMode(this.symbol)) {
      this.state.recordSignalSkip(signalId, decisionTs, "hedge_mode_unconfirmed", now);
      this.state.enterRecovery("hedge_mode_unconfirmed", now);
      return { outcome: "recovery", action: "open", status: "hedge_mode_unconfirmed", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: null, pnl: 0 };
    }

    const [position, lotInfo] = await Promise.all([
      this.executor.getShortPositionSnapshot(this.symbol),
      this.executor.getInstrumentLotInfo(this.symbol),
    ]);
    if (position.size > tolerance(lotInfo.qtyStep)) {
      this.state.recordSignalSkip(signalId, decisionTs, "orphan_exchange_short", now);
      this.state.enterRecovery(`orphan_exchange_short:${position.size}`, now);
      return { outcome: "recovery", action: "open", status: "orphan_exchange_short", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: position.size, pnl: 0 };
    }

    const orderLinkId = genOrderLinkId("hlso");
    this.state.beginOpen({
      kind: "short_open",
      orderLinkId,
      signalId,
      decisionTs,
      createdAt: now,
      requestedNotional: notional,
      qtyStep: lotInfo.qtyStep,
      lastObservedStatus: "intent_written",
      lastCheckedAt: now,
    });
    const execution = await this.executor.openShortDetailed(
      this.symbol,
      notional,
      this.leverage,
      orderLinkId,
      HL_SHORT_BREAKDOWN_POLICY.takeProfitPct / 100,
      HL_SHORT_BREAKDOWN_POLICY.stopLossPct / 100,
    );
    return this.resolveOpen(execution, now);
  }

  async executeClose(
    reason: "timeout" | "manual" | "protection_failure",
    now: number,
  ): Promise<HlShortTransactionResult> {
    const current = this.state.get();
    if (!current.position) {
      return { outcome: "skipped", action: "close", status: "no_local_short", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: 0, pnl: 0 };
    }
    if (current.pending) {
      return { outcome: "pending", action: "close", status: "pending_already_active", orderLinkId: current.pending.orderLinkId, orderId: "", filledQty: 0, avgPrice: null, remainingQty: current.position.qty, pnl: 0 };
    }

    const [position, lotInfo] = await Promise.all([
      this.executor.getShortPositionSnapshot(this.symbol),
      this.executor.getInstrumentLotInfo(this.symbol),
    ]);
    if (!qtyMatches(position.size, current.position.qty, lotInfo.qtyStep)) {
      this.state.enterRecovery(`pre_close_qty_mismatch:exchange=${position.size}:local=${current.position.qty}`, now);
      return { outcome: "recovery", action: "close", status: "pre_close_qty_mismatch", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: position.size, pnl: 0 };
    }

    const orderLinkId = genOrderLinkId("hlsc");
    this.state.beginClose({
      kind: "short_close",
      orderLinkId,
      signalId: current.position.signalId,
      createdAt: now,
      reason,
      preQty: current.position.qty,
      preEntryPrice: current.position.entryPrice,
      qtyStep: lotInfo.qtyStep,
      evidenceStartAt: now - NATIVE_EVIDENCE_LOOKBACK_MS,
      lastObservedStatus: "intent_written",
      lastCheckedAt: now,
    });
    const execution = await this.executor.closeShortDetailed(this.symbol, current.position.qty, orderLinkId);
    return this.resolveClose(execution, now);
  }

  async resolvePending(now: number): Promise<HlShortTransactionResult> {
    const pending = this.state.get().pending;
    if (!pending) {
      return { outcome: "skipped", action: "reconcile", status: "no_pending", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: this.state.get().position?.qty ?? 0, pnl: 0 };
    }
    const execution = await this.executor.observeShortOrder(this.symbol, pending.orderLinkId);
    return pending.kind === "short_open" ? this.resolveOpen(execution, now) : this.resolveClose(execution, now);
  }

  private async resolveOpen(execution: ShortExecutionResult, now: number): Promise<HlShortTransactionResult> {
    const pending = this.state.get().pending;
    if (!pending || pending.kind !== "short_open" || pending.orderLinkId !== execution.orderLinkId) {
      throw new Error(`cannot resolve non-matching short open ${execution.orderLinkId}`);
    }
    this.state.observePending(pending.orderLinkId, execution.status, now);
    const exchangeQty = execution.remainingShortQty ?? (await this.executor.getShortPositionSnapshot(this.symbol)).size;

    if (execution.terminal && execution.cumExecQty > 0 && execution.avgPrice && execution.avgPrice > 0) {
      if (exchangeQty > execution.cumExecQty + tolerance(pending.qtyStep)) {
        this.state.enterRecovery(`open_fill_plus_orphan_qty:fill=${execution.cumExecQty}:exchange=${exchangeQty}`, now);
        return pendingResult("open", execution);
      }
      const receipt = this.state.commitOpen(pending.orderLinkId, {
        orderId: execution.orderId,
        status: execution.status,
        filledQty: execution.cumExecQty,
        avgPrice: execution.avgPrice,
        executionIds: execution.executionIds,
        entryFees: execution.cumExecFee > 0 ? execution.cumExecFee : execution.cumExecQty * execution.avgPrice * this.feeRate,
        takeProfit: execution.avgPrice * (1 - HL_SHORT_BREAKDOWN_POLICY.takeProfitPct / 100),
        stopLoss: execution.avgPrice * (1 + HL_SHORT_BREAKDOWN_POLICY.stopLossPct / 100),
        expiresAt: pending.createdAt + HL_SHORT_BREAKDOWN_POLICY.maximumHoldMs,
      }, now);
      if (!qtyMatches(exchangeQty, execution.cumExecQty, pending.qtyStep)) {
        // A provisional native TP/SL can close immediately after the entry fill
        // but before this process observes it. Commit the proven open first,
        // then import the exact close evidence; never strand the open intent.
        return this.resolveNativeClose(exchangeQty, pending.qtyStep, now);
      }
      const protection = await this.ensureProtection(now);
      if (protection.outcome === "committed") this.state.clearRecovery(now);
      else return { ...protection, action: "open", orderLinkId: pending.orderLinkId, orderId: receipt.orderId };
      return receiptResult(receipt, this.state.get().position?.qty ?? 0);
    }

    if (
      (execution.outcome === "not_submitted" || execution.outcome === "rejected")
      && execution.cumExecQty <= tolerance(pending.qtyStep)
    ) {
      const receipt = this.state.rejectOpen(pending.orderLinkId, execution.orderId, execution.status, execution.error, now);
      if (exchangeQty <= tolerance(pending.qtyStep)) this.state.clearRecovery(now);
      else this.state.enterRecovery(`orphan_exchange_short_after_rejected_open:${exchangeQty}`, now);
      return receiptResult(receipt, exchangeQty);
    }

    if (
      execution.terminal
      && execution.cumExecQty <= tolerance(pending.qtyStep)
      && exchangeQty <= tolerance(pending.qtyStep)
    ) {
      const receipt = this.state.rejectOpen(pending.orderLinkId, execution.orderId, execution.status, execution.error, now);
      this.state.clearRecovery(now);
      return receiptResult(receipt, 0);
    }

    this.state.enterRecovery(`short_open_unresolved:${execution.status}`, now);
    return pendingResult("open", execution);
  }

  private async resolveClose(execution: ShortExecutionResult, now: number): Promise<HlShortTransactionResult> {
    const pending = this.state.get().pending;
    const position = this.state.get().position;
    if (!pending || pending.kind !== "short_close" || pending.orderLinkId !== execution.orderLinkId || !position) {
      throw new Error(`cannot resolve non-matching short close ${execution.orderLinkId}`);
    }
    this.state.observePending(pending.orderLinkId, execution.status, now);
    const exchangeQty = execution.remainingShortQty ?? (await this.executor.getShortPositionSnapshot(this.symbol)).size;

    if (execution.terminal && execution.cumExecQty > 0 && execution.avgPrice && execution.avgPrice > 0) {
      const expectedRemaining = Math.max(0, position.qty - Math.min(position.qty, execution.cumExecQty));
      if (!qtyMatches(exchangeQty, expectedRemaining, pending.qtyStep)) {
        this.state.enterRecovery(`close_fill_qty_mismatch:expected=${expectedRemaining}:exchange=${exchangeQty}`, now);
        return pendingResult("close", execution);
      }
      const receipt = this.state.commitClose(pending.orderLinkId, {
        orderId: execution.orderId,
        status: execution.status,
        filledQty: execution.cumExecQty,
        avgPrice: execution.avgPrice,
        executionIds: execution.executionIds,
        exitFees: execution.cumExecFee > 0 ? execution.cumExecFee : execution.cumExecQty * execution.avgPrice * this.feeRate,
        completedAt: now,
        native: false,
      });
      if (exchangeQty <= tolerance(pending.qtyStep)) this.state.clearRecovery(now);
      else this.state.enterRecovery(`terminal_partial_short_close:${exchangeQty}`, now);
      return receiptResult(receipt, this.state.get().position?.qty ?? 0);
    }

    if (execution.outcome === "already_flat" || (execution.terminal && exchangeQty <= tolerance(pending.qtyStep))) {
      return this.resolveNativeClose(exchangeQty, pending.qtyStep, now);
    }

    if (execution.outcome === "not_submitted" || execution.outcome === "rejected") {
      const receipt = this.state.rejectClose(pending.orderLinkId, execution.orderId, execution.status, execution.error, now);
      this.state.enterRecovery(`short_close_not_submitted:${execution.status}`, now);
      return receiptResult(receipt, position.qty);
    }

    this.state.enterRecovery(`short_close_unresolved:${execution.status}`, now);
    return pendingResult("close", execution);
  }

  async ensureProtection(now: number): Promise<HlShortTransactionResult> {
    const position = this.state.get().position;
    if (!position) {
      return { outcome: "skipped", action: "protection", status: "no_local_short", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: 0, pnl: 0 };
    }
    const result = await this.executor.setShortPositionProtection(this.symbol, position.takeProfit, position.stopLoss);
    if (result.success && result.status === "confirmed") {
      this.state.markProtection("confirmed", now, undefined, result.takeProfit, result.stopLoss);
      return { outcome: "committed", action: "protection", status: "confirmed", orderLinkId: position.openOrderLinkId, orderId: position.openOrderId, filledQty: 0, avgPrice: null, remainingQty: position.qty, pnl: 0 };
    }

    this.state.markProtection("failed", now, result.error ?? result.status);
    this.state.enterRecovery(`short_protection_${result.status}:${result.error ?? "unconfirmed"}`, now);
    const updated = this.state.get().position;
    if (
      result.status !== "position_missing"
      && updated
      && updated.protectionFailureCount >= this.maximumProtectionFailures
      && !this.state.get().pending
    ) {
      return this.executeClose("protection_failure", now);
    }
    return { outcome: "recovery", action: "protection", status: result.status, orderLinkId: position.openOrderLinkId, orderId: position.openOrderId, filledQty: 0, avgPrice: null, remainingQty: position.qty, pnl: 0, error: result.error };
  }

  private async resolveNativeClose(exchangeQty: number, qtyStep: number, now: number): Promise<HlShortTransactionResult> {
    const position = this.state.get().position;
    if (!position) {
      return { outcome: "skipped", action: "reconcile", status: "already_flat", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: 0, pnl: 0 };
    }
    const targetClosedQty = Math.max(0, position.qty - exchangeQty);
    if (targetClosedQty <= tolerance(qtyStep)) {
      this.state.enterRecovery(`exchange_short_missing_close_evidence:exchange=${exchangeQty}:local=${position.qty}`, now);
      return { outcome: "recovery", action: "reconcile", status: "no_closed_quantity", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: exchangeQty, pnl: 0 };
    }

    const usedExecutionIds = new Set(this.state.get().receipts.flatMap(receipt => receipt.executionIds));
    const usedOrderIds = new Set(this.state.get().receipts.map(receipt => receipt.orderId).filter(Boolean));
    const window = evidenceWindow(position, now);
    const executions = await this.executor.queryRecentShortCloseExecutions(this.symbol, window.startTime, window.endTime);
    const candidates = groupExecutionEvidence(executions.filter(row => !usedExecutionIds.has(row.execId)))
      .filter(group => !usedOrderIds.has(group.orderId) && qtyMatches(group.qty, targetClosedQty, qtyStep));
    if (candidates.length === 1) {
      const candidate = candidates[0];
      const receipt = this.state.commitNativeClose({
        orderId: candidate.orderId,
        status: "native_execution_evidence",
        filledQty: candidate.qty,
        avgPrice: candidate.avgPrice,
        executionIds: candidate.executionIds,
        exitFees: candidate.fees,
        completedAt: candidate.completedAt,
        native: true,
      });
      if (qtyMatches(this.state.get().position?.qty ?? 0, exchangeQty, qtyStep)) {
        if (exchangeQty <= tolerance(qtyStep)) this.state.clearRecovery(now);
        else this.state.enterRecovery(`native_partial_short_close:${exchangeQty}`, now);
      }
      return receiptResult(receipt, this.state.get().position?.qty ?? 0);
    }

    const closedPnlRows = await this.executor.queryRecentShortClosedPnl(this.symbol, window.startTime, window.endTime);
    const pnlCandidates = closedPnlRows.filter(row =>
      !usedOrderIds.has(row.orderId)
      && qtyMatches(row.closedSize, targetClosedQty, qtyStep)
      && row.avgExitPrice > 0,
    );
    if (candidates.length === 0 && pnlCandidates.length === 1) {
      const candidate = pnlCandidates[0];
      const receipt = this.state.commitNativeClose({
        orderId: candidate.orderId,
        status: "native_closed_pnl_evidence",
        filledQty: candidate.closedSize,
        avgPrice: candidate.avgExitPrice,
        executionIds: [],
        exitFees: candidate.closeFee ?? 0,
        completedAt: candidate.updatedTime,
        native: true,
        pnlOverride: candidate.closedPnl,
      });
      if (exchangeQty <= tolerance(qtyStep)) this.state.clearRecovery(now);
      else this.state.enterRecovery(`native_partial_short_close:${exchangeQty}`, now);
      return receiptResult(receipt, this.state.get().position?.qty ?? 0);
    }

    const ambiguity = candidates.length > 1 || pnlCandidates.length > 1 ? "ambiguous" : "missing";
    this.state.enterRecovery(`native_short_close_evidence_${ambiguity}:exec=${candidates.length}:pnl=${pnlCandidates.length}`, now);
    return { outcome: "recovery", action: "reconcile", status: `native_evidence_${ambiguity}`, orderLinkId: this.state.get().pending?.orderLinkId ?? "", orderId: "", filledQty: targetClosedQty, avgPrice: null, remainingQty: exchangeQty, pnl: 0 };
  }

  async reconcile(now: number): Promise<HlShortTransactionResult> {
    if (this.state.get().pending) {
      const pending = await this.resolvePending(now);
      if (this.state.get().pending || pending.outcome === "pending") return pending;
    }

    const [exchange, lotInfo] = await Promise.all([
      this.executor.getShortPositionSnapshot(this.symbol),
      this.executor.getInstrumentLotInfo(this.symbol),
    ]);
    this.state.recordReconcile(exchange.size, now);
    const local = this.state.get().position;
    if (!local && exchange.size > tolerance(lotInfo.qtyStep)) {
      this.state.enterRecovery(`orphan_exchange_short:${exchange.size}`, now);
      return { outcome: "recovery", action: "reconcile", status: "orphan_exchange_short", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: exchange.size, pnl: 0 };
    }
    if (!local) {
      this.state.clearRecovery(now);
      return { outcome: "committed", action: "reconcile", status: "flat_synced", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: 0, pnl: 0 };
    }
    if (!qtyMatches(local.qty, exchange.size, lotInfo.qtyStep)) {
      if (exchange.size < local.qty - tolerance(lotInfo.qtyStep)) {
        return this.resolveNativeClose(exchange.size, lotInfo.qtyStep, now);
      }
      this.state.enterRecovery(`short_qty_mismatch:exchange=${exchange.size}:local=${local.qty}`, now);
      return { outcome: "recovery", action: "reconcile", status: "quantity_mismatch", orderLinkId: "", orderId: "", filledQty: 0, avgPrice: null, remainingQty: exchange.size, pnl: 0 };
    }

    const exchangeProtectionConfirmed = local.protectionStatus === "confirmed"
      && exchange.takeProfit > 0
      && exchange.stopLoss > 0
      && priceMatches(exchange.takeProfit, local.takeProfit)
      && priceMatches(exchange.stopLoss, local.stopLoss);
    if (!exchangeProtectionConfirmed) {
      const protection = await this.ensureProtection(now);
      if (protection.outcome !== "committed") return protection;
    }
    this.state.clearRecovery(now);
    const refreshed = this.state.get().position;
    if (refreshed && now >= refreshed.expiresAt && !this.state.get().pending) {
      return this.executeClose("timeout", now);
    }
    return { outcome: "committed", action: "reconcile", status: "short_synced_and_protected", orderLinkId: refreshed?.openOrderLinkId ?? "", orderId: refreshed?.openOrderId ?? "", filledQty: 0, avgPrice: null, remainingQty: refreshed?.qty ?? 0, pnl: 0 };
  }
}
