import fs from "fs";
import path from "path";
import {
  allocationDeltaForCumulative,
  PartialCloseIntent,
  PartialCloseReceipt,
} from "./partial-close-transaction";
import {
  FullCloseIntent,
  LongCloseApplyResult,
  LongCloseFinalizeResult,
  LongExecutionCommit,
  LongOpenCommitResult,
  LongOpenIntent,
  LongTransactionIntent,
  LongTransactionReceipt,
  LongTransactionReceiptOutcome,
} from "./long-transaction";
import {
  DamagedRegimeLatchState,
  EMPTY_DAMAGED_REGIME_LATCH_STATE,
} from "./damaged-regime-latch";
import {
  MakerTpApplyResult,
  MakerTpCloseRequest,
  MakerTpFinalizeResult,
  MakerTpOrderState,
  MakerTpPhase,
  MakerTpReceipt,
} from "./maker-tp-transaction";

// ─────────────────────────────────────────────
// Persistent ladder state — survives restarts
// ─────────────────────────────────────────────

export interface LadderPosition {
  id: string;                // unique ID (timestamp-based)
  entryPrice: number;
  entryTime: number;         // ms timestamp
  qty: number;               // base asset quantity
  notional: number;          // USDT notional at entry
  level: number;             // ladder level (0-based)
  orderId?: string;          // exchange order ID (live mode)
  orderLinkId?: string;      // client-generated transaction ID (live mode)
}

export interface BotState {
  // Ladder
  positions: LadderPosition[];
  lastAddTime: number;         // ms timestamp of last add
  totalBatchCloses: number;    // lifetime batch close count
  totalBlockedAdds: number;    // lifetime blocked-by-filter count

  // Capital tracking
  realizedPnl: number;         // cumulative realized PnL
  totalFees: number;           // cumulative fees paid
  totalFunding: number;        // cumulative funding fees paid
  lastFundingSettlement: number; // ms timestamp of last funding deduction
  peakEquity: number;          // high-water mark

  // Filter state
  riskOffUntil: number;        // ms timestamp — market risk-off cooldown
  lastTrendCheck: {            // cached 4h trend gate result
    timestamp: number;
    blocked: boolean;
    reason: string;
  };
  regime: {                    // regime circuit breaker state
    redStreak: number;
    greenStreak: number;
    flatActive: boolean;
    lastDayProcessed: number;  // UTC day index
  };
  damagedRegimeLatch: DamagedRegimeLatchState;

  // Score partial-flatten latch
  scorePartialFlatten: ScorePartialFlattenState | null;

  // Exit cooldown
  forcedExitCooldownUntil: number;  // ms timestamp — no new adds until this time (post hard-flatten/emergency)
  srPartialExitActionUntil: number; // ms timestamp — throttle live S/R partial exits across restarts

  // Stress hedge
  hedgePosition: HedgePosition | null;
  hedgeLastCloseTime: number;      // ms — for cooldown tracking
  hedgeLastCloseWasKill: boolean;  // true if last close was a kill stop (use longer cooldown)

  // Recovery
  recoveryMode: boolean;         // true = no new adds, manage exit only
  recoveryTpOrderId: string;     // exchange order ID of recovery TP limit (for cleanup)
  pendingOrder: PendingOrder | null;  // in-flight order for crash recovery
  completedPartialActions: PartialCloseReceipt[]; // bounded idempotency receipts for partial closes
  completedLongTransactions: LongTransactionReceipt[]; // bounded receipts for open/full-close replay safety
  recoveryOwnerOrderLinkId: string | null; // transaction allowed to clear recovery after verified sync
  desiredLongTp: DesiredLongTp | null; // desired native exchange TP and sync status
  makerTpOrder: MakerTpOrderState | null; // durable resting maker-TP owner (separate from pendingOrder)
  completedMakerTpOrders: MakerTpReceipt[]; // bounded maker execution receipts for replay safety

  // Meta
  startedAt: number;           // when bot first started
  lastUpdated: number;         // last state save
  version: number;             // state schema version
}

export interface HedgePosition {
  entryPrice: number;
  entryTime: number;
  qty: number;
  notional: number;
  tpPrice: number;     // entryPrice * (1 - tpPct/100)
  killPrice: number;   // entryPrice * (1 + killPct/100)
  orderId?: string;
}

export interface LegacyPendingOrder {
  kind?: "legacy";
  orderLinkId: string;         // client-generated idempotency key
  action: "open" | "close" | "hedge_open" | "hedge_close";
  symbol: string;
  notional: number;
  createdAt: number;           // ms timestamp
  /** Set for partial (reduce) closes: which position indices the fill should remove.
   *  Lets startup reconciliation import a fill that landed before state was updated. */
  partialClose?: { indices: number[] };
}

export type PendingOrder = LegacyPendingOrder | PartialCloseIntent | LongTransactionIntent;

export interface DesiredLongTp {
  price: number;
  positionQtyBasis: number;
  activeTpPct: number;
  updatedAt: number;
  syncStatus: "pending" | "confirmed" | "failed";
  /** Executable long-exit quote captured when this TP intent was created. */
  bestBidAtIntent?: number;
  /** Timestamp of the WebSocket quote used for bestBidAtIntent. */
  bestBidObservedAt?: number;
  lastError?: string;
}

export interface ScorePartialFlattenState {
  ladderId: string;
  firedAt: number;
  score: number;
  action: "shadow" | "partial_flatten";
}

function emptyState(): BotState {
  return {
    positions: [],
    lastAddTime: 0,
    totalBatchCloses: 0,
    totalBlockedAdds: 0,
    realizedPnl: 0,
    totalFees: 0,
    totalFunding: 0,
    lastFundingSettlement: 0,
    peakEquity: 0,
    riskOffUntil: 0,
    lastTrendCheck: { timestamp: 0, blocked: false, reason: "" },
    regime: { redStreak: 0, greenStreak: 0, flatActive: false, lastDayProcessed: 0 },
    damagedRegimeLatch: { ...EMPTY_DAMAGED_REGIME_LATCH_STATE },
    scorePartialFlatten: null,
    forcedExitCooldownUntil: 0,
    srPartialExitActionUntil: 0,
    hedgePosition: null,
    hedgeLastCloseTime: 0,
    hedgeLastCloseWasKill: false,
    recoveryMode: false,
    recoveryTpOrderId: "",
    pendingOrder: null,
    completedPartialActions: [],
    completedLongTransactions: [],
    recoveryOwnerOrderLinkId: null,
    desiredLongTp: null,
    makerTpOrder: null,
    completedMakerTpOrders: [],
    startedAt: Date.now(),
    lastUpdated: Date.now(),
    version: 6,
  };
}

export class StateManager {
  private state: BotState;
  private filePath: string;

  constructor(stateFile: string) {
    this.filePath = path.resolve(process.cwd(), stateFile);
    this.state = this.load();
  }

  private load(): BotState {
    if (!fs.existsSync(this.filePath)) {
      console.log(`No existing state at ${this.filePath}, starting fresh`);
      return emptyState();
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
      console.log(`Loaded state: ${raw.positions?.length || 0} open positions, $${raw.realizedPnl?.toFixed(2) || 0} realized PnL`);
      return {
        ...emptyState(),
        ...raw,
        damagedRegimeLatch: {
          ...EMPTY_DAMAGED_REGIME_LATCH_STATE,
          ...(raw.damagedRegimeLatch || {}),
        },
        completedMakerTpOrders: Array.isArray(raw.completedMakerTpOrders) ? raw.completedMakerTpOrders : [],
        makerTpOrder: raw.makerTpOrder ? {
          ...raw.makerTpOrder,
          version: 2,
          exchangePrice: raw.makerTpOrder.exchangePrice ?? null,
          submittedQty: raw.makerTpOrder.submittedQty ?? null,
          priceTick: raw.makerTpOrder.priceTick ?? null,
          closeRequest: raw.makerTpOrder.closeRequest ?? (
            raw.makerTpOrder.phase === "fallback_required" || raw.makerTpOrder.fallbackDeadlineAt != null
              ? {
                  reason: raw.makerTpOrder.closeReason ?? "TP",
                  source: typeof raw.makerTpOrder.touchedAt === "number" ? "tp_touch" : "maker_partial",
                  requestedAt: raw.makerTpOrder.touchedAt ?? raw.makerTpOrder.updatedAt ?? Date.now(),
                  fallbackAfterAt: raw.makerTpOrder.fallbackDeadlineAt ?? raw.makerTpOrder.updatedAt ?? Date.now(),
                }
              : null
          ),
        } : null,
        version: 6,
      };
    } catch (err) {
      console.error(`Failed to load state from ${this.filePath}, starting fresh:`, err);
      return emptyState();
    }
  }

  save(): void {
    this.state.lastUpdated = Date.now();
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Write to temp file then rename (atomic on most filesystems)
    const tmp = this.filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    try {
      fs.renameSync(tmp, this.filePath);
    } catch (err: any) {
      // Windows can throw EPERM when replacing an existing file during rapid
      // local test saves. Linux/VPS uses the atomic rename path above.
      if (err?.code === "EPERM" && process.platform === "win32") {
        if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
        fs.renameSync(tmp, this.filePath);
      } else {
        throw err;
      }
    }
  }

  get(): BotState {
    return this.state;
  }

  // ── Position management ──

  addPosition(pos: Omit<LadderPosition, "id">): LadderPosition {
    const full: LadderPosition = {
      ...pos,
      id: `pos_${Date.now()}_${this.state.positions.length}`,
    };
    this.state.positions.push(full);
    this.state.lastAddTime = pos.entryTime;
    this.save();
    return full;
  }

  closeAllPositions(exitPrice: number, exitTime: number, feeRate: number): {
    totalPnl: number;
    totalFees: number;
    positionsClosed: number;
  } {
    let totalPnl = 0;
    let totalFees = 0;

    for (const pos of this.state.positions) {
      const pnlRaw = (exitPrice - pos.entryPrice) * pos.qty;
      const entryFee = pos.notional * feeRate;
      const exitFee = exitPrice * pos.qty * feeRate;
      const pnl = pnlRaw - entryFee - exitFee;
      totalPnl += pnl;
      totalFees += entryFee + exitFee;
    }

    const count = this.state.positions.length;
    this.state.realizedPnl += totalPnl;
    this.state.totalFees += totalFees;
    this.state.totalBatchCloses++;
    this.state.positions = [];
    this.state.scorePartialFlatten = null;
    this.save();

    return { totalPnl, totalFees, positionsClosed: count };
  }

  /** Close a subset of positions by index. PnL calculated per-rung at exitPrice.
   *  Removes them from state, reanchors lastAddTime to the latest remaining rung,
   *  bumps batchClose counter, persists. Used for SR partial-flatten on resistance touch. */
  closePositionsByIndices(
    indices: number[],
    exitPrice: number,
    exitTime: number,
    feeRate: number,
  ): { totalPnl: number; totalFees: number; positionsClosed: number } {
    if (indices.length === 0) return { totalPnl: 0, totalFees: 0, positionsClosed: 0 };
    const idxSet = new Set(indices);
    let totalPnl = 0;
    let totalFees = 0;
    for (let i = 0; i < this.state.positions.length; i++) {
      if (!idxSet.has(i)) continue;
      const pos = this.state.positions[i];
      const pnlRaw = (exitPrice - pos.entryPrice) * pos.qty;
      const entryFee = pos.notional * feeRate;
      const exitFee = exitPrice * pos.qty * feeRate;
      totalPnl += pnlRaw - entryFee - exitFee;
      totalFees += entryFee + exitFee;
    }
    const remaining = this.state.positions.filter((_, i) => !idxSet.has(i));
    this.state.positions = remaining;
    this.state.realizedPnl += totalPnl;
    this.state.totalFees += totalFees;
    this.state.totalBatchCloses++;
    // Reanchor lastAddTime to most recent remaining rung so the time-gate stays sane
    this.state.lastAddTime = remaining.length > 0
      ? Math.max(...remaining.map(p => p.entryTime))
      : 0;
    this.save();
    return { totalPnl, totalFees, positionsClosed: indices.length };
  }

  reducePositionsByShare(
    share: number,
    exitPrice: number,
    exitTime: number,
    feeRate: number,
  ): { totalPnl: number; totalFees: number; positionsReduced: number; share: number } {
    const clamped = Math.max(0, Math.min(1, share));
    if (clamped <= 0 || this.state.positions.length === 0) {
      return { totalPnl: 0, totalFees: 0, positionsReduced: 0, share: 0 };
    }

    let totalPnl = 0;
    let totalFees = 0;
    for (const pos of this.state.positions) {
      const closeQty = pos.qty * clamped;
      const entryNotional = pos.notional * clamped;
      const exitNotional = closeQty * exitPrice;
      const pnlRaw = (exitPrice - pos.entryPrice) * closeQty;
      const fees = entryNotional * feeRate + exitNotional * feeRate;
      totalPnl += pnlRaw - fees;
      totalFees += fees;
      pos.qty *= 1 - clamped;
      pos.notional *= 1 - clamped;
    }

    const positionsReduced = this.state.positions.length;
    this.state.positions = this.state.positions.filter(pos => pos.qty > 0.0000001 && pos.notional > 0.01);
    this.state.realizedPnl += totalPnl;
    this.state.totalFees += totalFees;
    this.state.totalBatchCloses++;
    if (this.state.positions.length === 0) {
      this.state.lastAddTime = 0;
      this.state.scorePartialFlatten = null;
    }
    this.save();
    return { totalPnl, totalFees, positionsReduced, share: clamped };
  }

  hasCompletedPartialAction(actionKey: string): boolean {
    return this.state.completedPartialActions.some(receipt => receipt.actionKey === actionKey);
  }

  getCompletedLongTransaction(orderLinkId: string): LongTransactionReceipt | null {
    return this.state.completedLongTransactions.find(receipt => receipt.orderLinkId === orderLinkId) ?? null;
  }

  private recordLongTransactionReceipt(receipt: LongTransactionReceipt): void {
    this.state.completedLongTransactions = [
      ...this.state.completedLongTransactions.filter(existing => existing.orderLinkId !== receipt.orderLinkId),
      receipt,
    ].slice(-64);
  }

  getMakerTpOrder(): MakerTpOrderState | null {
    return this.state.makerTpOrder;
  }

  getCompletedMakerTpOrder(orderLinkId: string): MakerTpReceipt | null {
    return this.state.completedMakerTpOrders.find(receipt => receipt.orderLinkId === orderLinkId) ?? null;
  }

  beginMakerTpOrder(intent: MakerTpOrderState): void {
    if (this.state.pendingOrder) {
      throw new Error(`cannot begin maker TP with pending order ${this.state.pendingOrder.orderLinkId}`);
    }
    if (this.state.makerTpOrder && this.state.makerTpOrder.orderLinkId !== intent.orderLinkId) {
      throw new Error(`maker TP already active: ${this.state.makerTpOrder.orderLinkId}`);
    }
    if (this.getCompletedMakerTpOrder(intent.orderLinkId)) {
      throw new Error(`maker TP already completed: ${intent.orderLinkId}`);
    }
    this.state.makerTpOrder = intent;
    this.save();
  }

  markMakerTpOrder(
    orderLinkId: string,
    update: {
      orderId?: string;
      exchangePrice?: number | null;
      submittedQty?: number | null;
      phase?: MakerTpPhase;
      status?: string;
      checkedAt: number;
      touchedAt?: number | null;
      fallbackDeadlineAt?: number | null;
    },
  ): void {
    const maker = this.state.makerTpOrder;
    if (!maker || maker.orderLinkId !== orderLinkId) {
      throw new Error(`no matching maker TP for ${orderLinkId}`);
    }
    if (update.orderId !== undefined) maker.orderId = update.orderId;
    if (update.exchangePrice !== undefined) maker.exchangePrice = update.exchangePrice;
    if (update.submittedQty !== undefined) maker.submittedQty = update.submittedQty;
    if (update.phase !== undefined) maker.phase = update.phase;
    if (update.status !== undefined) maker.lastObservedStatus = update.status;
    if (update.touchedAt !== undefined) maker.touchedAt = update.touchedAt;
    if (update.fallbackDeadlineAt !== undefined) maker.fallbackDeadlineAt = update.fallbackDeadlineAt;
    maker.lastCheckedAt = update.checkedAt;
    maker.updatedAt = update.checkedAt;
    this.save();
  }

  requestMakerTpClose(orderLinkId: string, request: MakerTpCloseRequest, checkedAt: number): MakerTpCloseRequest {
    const maker = this.state.makerTpOrder;
    if (!maker || maker.orderLinkId !== orderLinkId) {
      throw new Error(`no matching maker TP for close request ${orderLinkId}`);
    }
    const priority: Record<MakerTpCloseRequest["source"], number> = {
      tp_touch: 1,
      maker_partial: 1,
      forced: 2,
      operator: 3,
      emergency: 4,
    };
    const existing = maker.closeRequest;
    maker.closeRequest = existing ? {
      reason: priority[request.source] > priority[existing.source] ? request.reason : existing.reason,
      source: priority[request.source] > priority[existing.source] ? request.source : existing.source,
      requestedAt: Math.min(existing.requestedAt, request.requestedAt),
      fallbackAfterAt: Math.min(existing.fallbackAfterAt, request.fallbackAfterAt),
    } : { ...request };
    maker.touchedAt = maker.touchedAt ?? request.requestedAt;
    maker.fallbackDeadlineAt = maker.closeRequest.fallbackAfterAt;
    maker.updatedAt = checkedAt;
    maker.lastCheckedAt = checkedAt;
    this.save();
    return { ...maker.closeRequest };
  }

  applyObservedMakerTpFill(
    orderLinkId: string,
    cumulativeQty: number,
    cumulativeExecNotional: number,
    executionIds: string[],
    status: string,
    checkedAt: number,
    entryFeeRate: number,
    makerExitFeeRate: number,
  ): MakerTpApplyResult {
    const maker = this.state.makerTpOrder;
    if (!maker || maker.orderLinkId !== orderLinkId) {
      throw new Error(`no matching maker TP for ${orderLinkId}`);
    }
    const tolerance = Math.max(maker.qtyStep / 2, 1e-8);
    if (cumulativeQty < maker.makerCumExecQty - 1e-9) {
      throw new Error(`observed maker TP qty regressed for ${orderLinkId}: ${cumulativeQty} < ${maker.makerCumExecQty}`);
    }
    if (cumulativeQty > maker.requestedQty + tolerance) {
      throw new Error(`observed maker TP overfill for ${orderLinkId}: ${cumulativeQty} > ${maker.requestedQty}`);
    }
    if (cumulativeExecNotional < maker.makerCumExecNotional - 1e-6) {
      throw new Error(`observed maker TP notional regressed for ${orderLinkId}`);
    }

    const deltaQty = cumulativeQty - maker.makerCumExecQty;
    const deltaExecNotional = cumulativeExecNotional - maker.makerCumExecNotional;
    maker.lastObservedStatus = status;
    maker.lastCheckedAt = checkedAt;
    maker.updatedAt = checkedAt;
    maker.executionIds = [...new Set([...maker.executionIds, ...executionIds])];

    if (deltaQty <= 1e-9) {
      this.save();
      return {
        deltaQty: 0,
        deltaPnl: 0,
        deltaFees: 0,
        fillPrice: null,
        remainingQty: this.state.positions.reduce((sum, pos) => sum + pos.qty, 0),
      };
    }
    if (deltaExecNotional <= 0) {
      throw new Error(`positive maker TP fill for ${orderLinkId} has no execution notional`);
    }

    const fillPrice = deltaExecNotional / deltaQty;
    const nextAppliedQty = maker.appliedQty + deltaQty;
    const deltas = allocationDeltaForCumulative(maker.allocation, maker.appliedQty, nextAppliedQty);
    const allocationQty = deltas.reduce((sum, slice) => sum + slice.closeQty, 0);
    if (Math.abs(allocationQty - deltaQty) > Math.max(1e-7, maker.qtyStep / 1000)) {
      throw new Error(`maker TP allocation delta ${allocationQty} does not match fill delta ${deltaQty}`);
    }

    const byId = new Map(this.state.positions.map(pos => [pos.id, pos]));
    for (const delta of deltas) {
      const pos = byId.get(delta.positionId);
      if (!pos) throw new Error(`maker TP allocation target missing from state: ${delta.positionId}`);
      if (delta.closeQty > pos.qty + 1e-8) {
        throw new Error(`maker TP delta exceeds current qty for ${delta.positionId}`);
      }
    }

    let deltaPnl = 0;
    let deltaFees = 0;
    for (const delta of deltas) {
      const pos = byId.get(delta.positionId)!;
      const entryNotional = pos.notional * (delta.closeQty / pos.qty);
      const exitNotional = delta.closeQty * fillPrice;
      const pnlRaw = (fillPrice - pos.entryPrice) * delta.closeQty;
      const fees = entryNotional * entryFeeRate + exitNotional * makerExitFeeRate;
      deltaPnl += pnlRaw - fees;
      deltaFees += fees;
      pos.qty -= delta.closeQty;
      pos.notional -= entryNotional;
    }

    this.state.positions = this.state.positions.filter(pos => pos.qty > 0.0000001 && pos.notional > 0.01);
    this.state.realizedPnl += deltaPnl;
    this.state.totalFees += deltaFees;
    maker.makerCumExecQty = cumulativeQty;
    maker.makerCumExecNotional = cumulativeExecNotional;
    maker.appliedQty = nextAppliedQty;
    maker.appliedExecNotional += deltaExecNotional;
    maker.appliedPnl += deltaPnl;
    maker.appliedFees += deltaFees;
    this.state.lastAddTime = this.state.positions.length > 0
      ? Math.max(...this.state.positions.map(pos => pos.entryTime))
      : 0;
    const remainingQty = this.state.positions.reduce((sum, pos) => sum + pos.qty, 0);
    if (this.state.positions.length === 0) this.state.scorePartialFlatten = null;
    if (remainingQty <= tolerance) {
      this.state.desiredLongTp = null;
    } else if (this.state.desiredLongTp) {
      this.state.desiredLongTp.positionQtyBasis = remainingQty;
      this.state.desiredLongTp.updatedAt = checkedAt;
      this.state.desiredLongTp.syncStatus = "confirmed";
      delete this.state.desiredLongTp.lastError;
    }

    this.save();
    return { deltaQty, deltaPnl, deltaFees, fillPrice, remainingQty };
  }

  finalizeMakerTpOrder(
    orderLinkId: string,
    outcome: MakerTpReceipt["outcome"],
    terminalStatus: string,
    completedAt: number,
  ): MakerTpFinalizeResult {
    const completed = this.getCompletedMakerTpOrder(orderLinkId);
    if (completed) return { receipt: completed, replayed: true };
    const maker = this.state.makerTpOrder;
    if (!maker || maker.orderLinkId !== orderLinkId) {
      throw new Error(`no matching maker TP to finalize for ${orderLinkId}`);
    }
    if (outcome === "cancelled_zero_fill" && maker.appliedQty > 1e-9) {
      throw new Error(`cannot finalize filled maker TP ${orderLinkId} as zero-fill`);
    }
    if (outcome !== "cancelled_zero_fill" && maker.appliedQty <= 1e-9) {
      throw new Error(`cannot finalize zero-fill maker TP ${orderLinkId} as ${outcome}`);
    }
    if (outcome === "full_committed") {
      const remainingQty = this.state.positions.reduce((sum, pos) => sum + pos.qty, 0);
      if (remainingQty > Math.max(maker.qtyStep / 2, 1e-8)) {
        throw new Error(`cannot finalize full maker TP ${orderLinkId} with local residual ${remainingQty}`);
      }
    }

    const receipt: MakerTpReceipt = {
      orderLinkId,
      orderId: maker.orderId,
      closeReason: maker.closeRequest?.reason ?? maker.closeReason,
      outcome,
      terminalStatus,
      filledQty: maker.appliedQty,
      avgPrice: maker.appliedQty > 0 ? maker.appliedExecNotional / maker.appliedQty : null,
      executionIds: [...maker.executionIds],
      totalPnl: maker.appliedPnl,
      totalFees: maker.appliedFees,
      positionsClosed: Math.max(0, maker.prePositionCount - this.state.positions.length),
      prePositionCount: maker.prePositionCount,
      preAvgEntry: maker.preAvgEntry,
      preOldestEntryTime: maker.preOldestEntryTime,
      completedAt,
    };
    this.state.completedMakerTpOrders = [
      ...this.state.completedMakerTpOrders.filter(existing => existing.orderLinkId !== orderLinkId),
      receipt,
    ].slice(-64);
    if (outcome === "full_committed") this.state.totalBatchCloses++;
    this.state.makerTpOrder = null;
    this.save();
    return { receipt, replayed: false };
  }

  transitionMakerTpToFullClose(
    makerOrderLinkId: string,
    terminalStatus: string,
    fullCloseIntent: FullCloseIntent,
    completedAt: number,
  ): MakerTpReceipt {
    if (this.state.pendingOrder) {
      throw new Error(`cannot transition maker TP with pending order ${this.state.pendingOrder.orderLinkId}`);
    }
    const maker = this.state.makerTpOrder;
    if (!maker || maker.orderLinkId !== makerOrderLinkId) {
      throw new Error(`no matching maker TP to transition for ${makerOrderLinkId}`);
    }
    const remainingQty = this.state.positions.reduce((sum, position) => sum + position.qty, 0);
    const tolerance = Math.max(maker.qtyStep / 2, 1e-8);
    if (remainingQty <= tolerance) {
      throw new Error(`cannot transition maker TP ${makerOrderLinkId} to a residual close while locally flat`);
    }
    if (Math.abs(fullCloseIntent.preLocalQty - remainingQty) > tolerance) {
      throw new Error(`maker TP fallback intent qty ${fullCloseIntent.preLocalQty} does not match local residual ${remainingQty}`);
    }
    if (maker.appliedQty > 1e-9 && fullCloseIntent.makerTpPrefixOrderLinkId !== makerOrderLinkId) {
      throw new Error(`partial maker TP ${makerOrderLinkId} requires its receipt prefix on fallback intent`);
    }

    const receipt: MakerTpReceipt = {
      orderLinkId: maker.orderLinkId,
      orderId: maker.orderId,
      closeReason: maker.closeRequest?.reason ?? maker.closeReason,
      outcome: maker.appliedQty > 1e-9 ? "partial_committed" : "cancelled_zero_fill",
      terminalStatus,
      filledQty: maker.appliedQty,
      avgPrice: maker.appliedQty > 0 ? maker.appliedExecNotional / maker.appliedQty : null,
      executionIds: [...maker.executionIds],
      totalPnl: maker.appliedPnl,
      totalFees: maker.appliedFees,
      positionsClosed: Math.max(0, maker.prePositionCount - this.state.positions.length),
      prePositionCount: maker.prePositionCount,
      preAvgEntry: maker.preAvgEntry,
      preOldestEntryTime: maker.preOldestEntryTime,
      completedAt,
    };
    this.state.completedMakerTpOrders = [
      ...this.state.completedMakerTpOrders.filter(existing => existing.orderLinkId !== makerOrderLinkId),
      receipt,
    ].slice(-64);
    this.state.makerTpOrder = null;
    this.state.pendingOrder = fullCloseIntent;
    this.save();
    return receipt;
  }

  beginLongOpen(intent: LongOpenIntent): void {
    if (this.state.makerTpOrder) {
      throw new Error(`cannot begin long open with active maker TP ${this.state.makerTpOrder.orderLinkId}`);
    }
    if (this.state.pendingOrder) {
      throw new Error(`cannot begin long open with pending order ${this.state.pendingOrder.orderLinkId}`);
    }
    if (this.getCompletedLongTransaction(intent.orderLinkId)) {
      throw new Error(`long transaction already completed: ${intent.orderLinkId}`);
    }
    this.state.pendingOrder = intent;
    this.save();
  }

  beginFullClose(intent: FullCloseIntent): void {
    if (this.state.makerTpOrder) {
      throw new Error(`cannot begin full close with active maker TP ${this.state.makerTpOrder.orderLinkId}`);
    }
    if (this.state.pendingOrder) {
      throw new Error(`cannot begin full close with pending order ${this.state.pendingOrder.orderLinkId}`);
    }
    if (this.getCompletedLongTransaction(intent.orderLinkId)) {
      throw new Error(`long transaction already completed: ${intent.orderLinkId}`);
    }
    this.state.pendingOrder = intent;
    this.save();
  }

  markLongTransactionUnknown(orderLinkId: string, status: string, checkedAt: number): void {
    const pending = this.state.pendingOrder;
    if (
      !pending ||
      (pending.kind !== "long_open" && pending.kind !== "full_close") ||
      pending.orderLinkId !== orderLinkId
    ) {
      throw new Error(`no matching pending long transaction for ${orderLinkId}`);
    }
    pending.lastObservedStatus = status;
    pending.lastCheckedAt = checkedAt;
    this.save();
  }

  commitPendingLongOpen(
    orderLinkId: string,
    execution: LongExecutionCommit,
    completedAt: number,
  ): LongOpenCommitResult {
    const completed = this.getCompletedLongTransaction(orderLinkId);
    if (completed) {
      const existing = this.state.positions.find(pos => pos.orderLinkId === orderLinkId || pos.orderId === completed.orderId);
      return { receipt: completed, positionId: existing?.id ?? "", replayed: true };
    }

    const pending = this.state.pendingOrder;
    if (!pending || pending.kind !== "long_open" || pending.orderLinkId !== orderLinkId) {
      throw new Error(`no matching pending long open for ${orderLinkId}`);
    }
    if (execution.filledQty <= 0 || execution.avgPrice <= 0 || execution.cumulativeExecNotional <= 0) {
      throw new Error(`cannot commit invalid long open execution for ${orderLinkId}`);
    }

    const positionId = `pos_${orderLinkId}`;
    if (this.state.positions.some(pos => pos.id === positionId || pos.orderLinkId === orderLinkId)) {
      throw new Error(`long open position already exists without receipt: ${orderLinkId}`);
    }

    this.state.positions.push({
      id: positionId,
      entryPrice: execution.avgPrice,
      entryTime: pending.createdAt,
      qty: execution.filledQty,
      notional: execution.cumulativeExecNotional,
      level: pending.level,
      orderId: execution.orderId,
      orderLinkId,
    });
    this.state.lastAddTime = pending.createdAt;

    const receipt: LongTransactionReceipt = {
      kind: "long_open",
      orderLinkId,
      orderId: execution.orderId,
      outcome: "committed",
      terminalStatus: execution.status,
      filledQty: execution.filledQty,
      avgPrice: execution.avgPrice,
      executionIds: execution.executionIds ?? [],
      totalPnl: 0,
      totalFees: 0,
      positionsClosed: 0,
      completedAt,
    };
    this.recordLongTransactionReceipt(receipt);
    this.state.pendingOrder = null;
    this.save();
    return { receipt, positionId, replayed: false };
  }

  applyObservedFullCloseFill(
    orderLinkId: string,
    cumulativeQty: number,
    cumulativeExecNotional: number,
    status: string,
    checkedAt: number,
    feeRate: number,
  ): LongCloseApplyResult {
    const pending = this.state.pendingOrder;
    if (!pending || pending.kind !== "full_close" || pending.orderLinkId !== orderLinkId) {
      throw new Error(`no matching pending full close for ${orderLinkId}`);
    }
    if (cumulativeQty < pending.appliedQty - 1e-9) {
      throw new Error(`observed cumulative qty regressed for ${orderLinkId}: ${cumulativeQty} < ${pending.appliedQty}`);
    }
    if (cumulativeExecNotional < pending.appliedExecNotional - 1e-6) {
      throw new Error(`observed cumulative notional regressed for ${orderLinkId}`);
    }

    const deltaQty = cumulativeQty - pending.appliedQty;
    const deltaExecNotional = cumulativeExecNotional - pending.appliedExecNotional;
    pending.lastObservedStatus = status;
    pending.lastCheckedAt = checkedAt;

    if (deltaQty <= 1e-9) {
      this.save();
      return {
        deltaQty: 0,
        totalPnl: 0,
        totalFees: 0,
        fillPrice: null,
        remainingQty: this.state.positions.reduce((sum, pos) => sum + pos.qty, 0),
      };
    }
    if (deltaExecNotional <= 0) {
      throw new Error(`positive full-close fill for ${orderLinkId} has no executable notional`);
    }

    const fillPrice = deltaExecNotional / deltaQty;
    const deltas = allocationDeltaForCumulative(pending.allocation, pending.appliedQty, cumulativeQty);
    const deltaSum = deltas.reduce((sum, slice) => sum + slice.closeQty, 0);
    if (Math.abs(deltaSum - deltaQty) > Math.max(1e-7, pending.qtyStep / 1000)) {
      throw new Error(`full-close allocation delta ${deltaSum} does not match fill delta ${deltaQty}`);
    }

    let totalPnl = 0;
    let totalFees = 0;
    const byId = new Map(this.state.positions.map(pos => [pos.id, pos]));
    for (const delta of deltas) {
      const pos = byId.get(delta.positionId);
      if (!pos) throw new Error(`pending full-close target missing from state: ${delta.positionId}`);
      if (delta.closeQty > pos.qty + 1e-8) {
        throw new Error(`full-close delta exceeds current qty for ${delta.positionId}`);
      }
    }
    for (const delta of deltas) {
      const pos = byId.get(delta.positionId)!;

      const entryNotional = pos.notional * (delta.closeQty / pos.qty);
      const exitNotional = delta.closeQty * fillPrice;
      const pnlRaw = (fillPrice - pos.entryPrice) * delta.closeQty;
      const fees = entryNotional * feeRate + exitNotional * feeRate;
      totalPnl += pnlRaw - fees;
      totalFees += fees;
      pos.qty -= delta.closeQty;
      pos.notional -= entryNotional;
    }

    this.state.positions = this.state.positions.filter(pos => pos.qty > 0.0000001 && pos.notional > 0.01);
    this.state.realizedPnl += totalPnl;
    this.state.totalFees += totalFees;
    pending.appliedQty = cumulativeQty;
    pending.appliedExecNotional = cumulativeExecNotional;
    pending.appliedPnl = (pending.appliedPnl ?? 0) + totalPnl;
    pending.appliedFees = (pending.appliedFees ?? 0) + totalFees;
    this.state.lastAddTime = this.state.positions.length > 0
      ? Math.max(...this.state.positions.map(pos => pos.entryTime))
      : 0;
    if (this.state.positions.length === 0) this.state.scorePartialFlatten = null;
    // Any executed reduction invalidates the previous native-TP quantity basis.
    this.state.desiredLongTp = null;

    const remainingQty = this.state.positions.reduce((sum, pos) => sum + pos.qty, 0);
    this.save();
    return { deltaQty, totalPnl, totalFees, fillPrice, remainingQty };
  }

  finalizePendingFullClose(
    orderLinkId: string,
    outcome: Extract<LongTransactionReceiptOutcome, "committed" | "partial_terminal" | "external_close">,
    orderId: string,
    terminalStatus: string,
    executionIds: string[],
    completedAt: number,
    reasonOverride?: string,
  ): LongCloseFinalizeResult {
    const completed = this.getCompletedLongTransaction(orderLinkId);
    if (completed) return { receipt: completed, replayed: true };

    const pending = this.state.pendingOrder;
    if (!pending || pending.kind !== "full_close" || pending.orderLinkId !== orderLinkId) {
      throw new Error(`no matching pending full close to finalize for ${orderLinkId}`);
    }
    if (pending.appliedQty <= 1e-9) {
      throw new Error(`cannot finalize zero-fill full close ${orderLinkId}`);
    }

    const receipt: LongTransactionReceipt = {
      kind: "full_close",
      orderLinkId,
      orderId,
      outcome,
      terminalStatus,
      reason: reasonOverride ?? pending.reason,
      filledQty: pending.appliedQty,
      avgPrice: pending.appliedExecNotional / pending.appliedQty,
      executionIds,
      totalPnl: pending.appliedPnl ?? 0,
      totalFees: pending.appliedFees ?? 0,
      positionsClosed: Math.max(0, (pending.prePositionCount ?? pending.allocation.targets.length) - this.state.positions.length),
      completedAt,
      ...(pending.makerTpPrefixOrderLinkId
        ? { makerTpPrefixOrderLinkId: pending.makerTpPrefixOrderLinkId }
        : {}),
    };
    this.recordLongTransactionReceipt(receipt);
    this.state.totalBatchCloses++;
    this.state.pendingOrder = null;
    this.save();
    return { receipt, replayed: false };
  }

  rejectPendingLongTransaction(
    orderLinkId: string,
    orderId: string,
    terminalStatus: string,
    completedAt: number,
  ): LongTransactionReceipt {
    const completed = this.getCompletedLongTransaction(orderLinkId);
    if (completed) return completed;

    const pending = this.state.pendingOrder;
    if (
      !pending ||
      (pending.kind !== "long_open" && pending.kind !== "full_close") ||
      pending.orderLinkId !== orderLinkId
    ) {
      throw new Error(`no matching pending long transaction to reject for ${orderLinkId}`);
    }
    if (pending.kind === "full_close" && pending.appliedQty > 1e-9) {
      throw new Error(`cannot reject full close ${orderLinkId} after applied fill`);
    }

    const receipt: LongTransactionReceipt = {
      kind: pending.kind,
      orderLinkId,
      orderId,
      outcome: "rejected",
      terminalStatus,
      ...(pending.kind === "full_close" ? { reason: pending.reason } : {}),
      ...(pending.kind === "full_close" && pending.makerTpPrefixOrderLinkId
        ? { makerTpPrefixOrderLinkId: pending.makerTpPrefixOrderLinkId }
        : {}),
      filledQty: 0,
      avgPrice: null,
      executionIds: [],
      totalPnl: 0,
      totalFees: 0,
      positionsClosed: 0,
      completedAt,
    };
    this.recordLongTransactionReceipt(receipt);
    this.state.pendingOrder = null;
    this.save();
    return receipt;
  }

  adoptAlreadyCommittedLongTransaction(
    orderLinkId: string,
    orderId: string,
    terminalStatus: string,
    filledQty: number,
    avgPrice: number | null,
    executionIds: string[],
    completedAt: number,
  ): LongTransactionReceipt {
    const completed = this.getCompletedLongTransaction(orderLinkId);
    if (completed) return completed;
    const pending = this.state.pendingOrder;
    if (
      !pending ||
      (pending.kind !== "long_open" && pending.kind !== "full_close") ||
      pending.orderLinkId !== orderLinkId
    ) {
      throw new Error(`no matching pending long transaction to adopt for ${orderLinkId}`);
    }
    const receipt: LongTransactionReceipt = {
      kind: pending.kind,
      orderLinkId,
      orderId,
      outcome: "committed",
      terminalStatus,
      ...(pending.kind === "full_close" ? { reason: pending.reason } : {}),
      ...(pending.kind === "full_close" && pending.makerTpPrefixOrderLinkId
        ? { makerTpPrefixOrderLinkId: pending.makerTpPrefixOrderLinkId }
        : {}),
      filledQty,
      avgPrice,
      executionIds,
      totalPnl: 0,
      totalFees: 0,
      positionsClosed: 0,
      completedAt,
    };
    this.recordLongTransactionReceipt(receipt);
    this.state.pendingOrder = null;
    this.save();
    return receipt;
  }

  beginPartialClose(intent: PartialCloseIntent): void {
    if (this.state.makerTpOrder) {
      throw new Error(`cannot begin partial close with active maker TP ${this.state.makerTpOrder.orderLinkId}`);
    }
    if (this.state.pendingOrder) {
      throw new Error(`cannot begin partial close with pending order ${this.state.pendingOrder.orderLinkId}`);
    }
    this.state.pendingOrder = intent;
    this.save();
  }

  applyObservedPartialFill(
    orderLinkId: string,
    cumulativeQty: number,
    cumulativeExecNotional: number,
    status: string,
    checkedAt: number,
    feeRate: number,
  ): { deltaQty: number; totalPnl: number; totalFees: number; fillPrice: number | null } {
    const pending = this.state.pendingOrder;
    if (!pending || pending.kind !== "partial_close" || pending.orderLinkId !== orderLinkId) {
      throw new Error(`no matching pending partial close for ${orderLinkId}`);
    }

    if (cumulativeQty < pending.appliedQty - 1e-9) {
      throw new Error(`observed cumulative qty regressed for ${orderLinkId}: ${cumulativeQty} < ${pending.appliedQty}`);
    }
    if (cumulativeExecNotional < pending.appliedExecNotional - 1e-6) {
      throw new Error(`observed cumulative notional regressed for ${orderLinkId}`);
    }

    const deltaQty = cumulativeQty - pending.appliedQty;
    const deltaExecNotional = cumulativeExecNotional - pending.appliedExecNotional;

    pending.lastObservedStatus = status;
    pending.lastCheckedAt = checkedAt;

    if (deltaQty <= 1e-9) {
      this.save();
      return { deltaQty: 0, totalPnl: 0, totalFees: 0, fillPrice: null };
    }
    if (deltaExecNotional <= 0) {
      throw new Error(`positive partial fill for ${orderLinkId} has no executable notional`);
    }

    const fillPrice = deltaExecNotional / deltaQty;
    const deltas = allocationDeltaForCumulative(pending.allocation, pending.appliedQty, cumulativeQty);
    const deltaSum = deltas.reduce((sum, slice) => sum + slice.closeQty, 0);
    if (Math.abs(deltaSum - deltaQty) > Math.max(1e-7, pending.qtyStep / 1000)) {
      throw new Error(`allocation delta ${deltaSum} does not match fill delta ${deltaQty}`);
    }

    let totalPnl = 0;
    let totalFees = 0;
    const byId = new Map(this.state.positions.map(pos => [pos.id, pos]));

    for (const delta of deltas) {
      const pos = byId.get(delta.positionId);
      if (!pos) throw new Error(`pending partial target missing from state: ${delta.positionId}`);
      if (delta.closeQty > pos.qty + 1e-8) {
        throw new Error(`partial close delta exceeds current qty for ${delta.positionId}`);
      }

      const entryNotional = pos.notional * (delta.closeQty / pos.qty);
      const exitNotional = delta.closeQty * fillPrice;
      const pnlRaw = (fillPrice - pos.entryPrice) * delta.closeQty;
      const fees = entryNotional * feeRate + exitNotional * feeRate;
      totalPnl += pnlRaw - fees;
      totalFees += fees;

      pos.qty -= delta.closeQty;
      pos.notional -= entryNotional;
    }

    this.state.positions = this.state.positions.filter(pos => pos.qty > 0.0000001 && pos.notional > 0.01);
    this.state.realizedPnl += totalPnl;
    this.state.totalFees += totalFees;
    pending.appliedQty = cumulativeQty;
    pending.appliedExecNotional = cumulativeExecNotional;
    if (this.state.positions.length === 0) {
      this.state.lastAddTime = 0;
      this.state.scorePartialFlatten = null;
    }

    this.save();
    return { deltaQty, totalPnl, totalFees, fillPrice };
  }

  finalizePartialClose(orderLinkId: string, terminalStatus: string, completedAt: number): PartialCloseReceipt {
    const pending = this.state.pendingOrder;
    if (!pending || pending.kind !== "partial_close" || pending.orderLinkId !== orderLinkId) {
      throw new Error(`no matching pending partial close to finalize for ${orderLinkId}`);
    }
    if (pending.appliedQty <= 1e-9) {
      throw new Error(`cannot finalize zero-fill partial close ${orderLinkId}; reject it instead`);
    }

    const receipt: PartialCloseReceipt = {
      actionKey: pending.actionKey,
      orderLinkId,
      strategy: pending.strategy,
      filledQty: pending.appliedQty,
      completedAt,
    };
    this.state.completedPartialActions = [
      ...this.state.completedPartialActions.filter(existing => existing.actionKey !== receipt.actionKey),
      receipt,
    ].slice(-32);

    if (typeof pending.desiredPostCommit.srCooldownUntil === "number") {
      this.state.srPartialExitActionUntil = pending.desiredPostCommit.srCooldownUntil;
    }
    if (pending.desiredPostCommit.scoreLatch) {
      this.state.scorePartialFlatten = pending.desiredPostCommit.scoreLatch;
    }

    pending.lastObservedStatus = terminalStatus;
    pending.lastCheckedAt = completedAt;
    this.state.totalBatchCloses++;
    this.state.pendingOrder = null;
    this.save();
    return receipt;
  }

  rejectPartialClose(orderLinkId: string, terminalStatus: string, checkedAt: number): void {
    const pending = this.state.pendingOrder;
    if (!pending || pending.kind !== "partial_close" || pending.orderLinkId !== orderLinkId) {
      throw new Error(`no matching pending partial close to reject for ${orderLinkId}`);
    }
    if (pending.appliedQty > 1e-9) {
      throw new Error(`cannot reject partial close ${orderLinkId} after applied fill`);
    }
    pending.lastObservedStatus = terminalStatus;
    pending.lastCheckedAt = checkedAt;
    this.state.pendingOrder = null;
    this.save();
  }

  markPartialUnknown(orderLinkId: string, status: string, checkedAt: number): void {
    const pending = this.state.pendingOrder;
    if (!pending || pending.kind !== "partial_close" || pending.orderLinkId !== orderLinkId) {
      throw new Error(`no matching pending partial close to mark unknown for ${orderLinkId}`);
    }
    pending.lastObservedStatus = status;
    pending.lastCheckedAt = checkedAt;
    this.save();
  }

  markScorePartialFlatten(fired: ScorePartialFlattenState): void {
    this.state.scorePartialFlatten = fired;
    this.save();
  }

  recordBlockedAdd(): void {
    this.state.totalBlockedAdds++;
    // Don't save on every block — too frequent. Save periodically in main loop.
  }

  /** Deduct funding fee from capital. Called at each 8h settlement when positions are open. */
  deductFunding(fundingRate: number, currentPrice: number): { fundingCost: number } {
    const totalNotional = this.state.positions.reduce(
      (s, p) => s + currentPrice * p.qty, 0,
    );
    const fundingCost = totalNotional * fundingRate;
    this.state.totalFunding += fundingCost;
    this.state.realizedPnl -= fundingCost;
    this.state.lastFundingSettlement = Date.now();
    return { fundingCost };
  }

  updateEquity(equity: number): void {
    if (equity > this.state.peakEquity) {
      this.state.peakEquity = equity;
    }
  }

  updateRiskOff(until: number): void {
    this.state.riskOffUntil = until;
  }

  updateTrendCheck(timestamp: number, blocked: boolean, reason: string): void {
    this.state.lastTrendCheck = { timestamp, blocked, reason };
  }

  updateRegime(next: { redStreak: number; greenStreak: number; flatActive: boolean; lastDayProcessed: number }): void {
    this.state.regime = { ...next };
  }

  updateDamagedRegimeLatch(next: DamagedRegimeLatchState): void {
    this.state.damagedRegimeLatch = { ...next };
    this.save();
  }

  // ── Forced exit cooldown ──

  setForcedExitCooldown(until: number): void {
    this.state.forcedExitCooldownUntil = until;
    this.save();
  }

  isForcedExitCooldown(now: number): boolean {
    return now < this.state.forcedExitCooldownUntil;
  }

  setSrPartialExitActionCooldown(until: number): void {
    this.state.srPartialExitActionUntil = until;
    this.save();
  }

  isSrPartialExitActionCooldown(now: number): boolean {
    return now < (this.state.srPartialExitActionUntil ?? 0);
  }

  // ── Recovery mode ──

  setRecoveryMode(enabled: boolean): void {
    this.state.recoveryMode = enabled;
    // Generic recovery changes are not owned by a transaction and therefore
    // must not be auto-cleared when a pending order later resolves.
    this.state.recoveryOwnerOrderLinkId = null;
    this.save();
  }

  enterTransactionRecovery(orderLinkId: string): void {
    if (!this.state.recoveryMode) {
      this.state.recoveryMode = true;
      this.state.recoveryOwnerOrderLinkId = orderLinkId;
    } else if (this.state.recoveryOwnerOrderLinkId !== orderLinkId) {
      this.state.recoveryOwnerOrderLinkId = null;
    }
    this.save();
  }

  clearTransactionRecovery(orderLinkId: string): boolean {
    if (!this.state.recoveryMode || this.state.recoveryOwnerOrderLinkId !== orderLinkId) {
      return false;
    }
    this.state.recoveryMode = false;
    this.state.recoveryOwnerOrderLinkId = null;
    this.save();
    return true;
  }

  getRecoveryOwnerOrderLinkId(): string | null {
    return this.state.recoveryOwnerOrderLinkId;
  }

  isRecoveryMode(): boolean {
    return this.state.recoveryMode;
  }

  setRecoveryTpOrderId(orderId: string): void {
    this.state.recoveryTpOrderId = orderId;
    this.save();
  }

  getRecoveryTpOrderId(): string {
    return this.state.recoveryTpOrderId;
  }

  setDesiredLongTp(tp: Omit<DesiredLongTp, "syncStatus"> & { syncStatus?: DesiredLongTp["syncStatus"] }): void {
    this.state.desiredLongTp = {
      ...tp,
      syncStatus: tp.syncStatus ?? "pending",
    };
    this.save();
  }

  markDesiredLongTpConfirmed(price: number, updatedAt: number): void {
    if (!this.state.desiredLongTp || Math.abs(this.state.desiredLongTp.price - price) > 1e-8) {
      this.state.desiredLongTp = {
        price,
        positionQtyBasis: 0,
        activeTpPct: 0,
        updatedAt,
        syncStatus: "confirmed",
      };
    } else {
      this.state.desiredLongTp.syncStatus = "confirmed";
      this.state.desiredLongTp.updatedAt = updatedAt;
      delete this.state.desiredLongTp.lastError;
    }
    this.save();
  }

  markDesiredLongTpFailed(price: number, updatedAt: number, error: string): void {
    if (!this.state.desiredLongTp || Math.abs(this.state.desiredLongTp.price - price) > 1e-8) {
      this.state.desiredLongTp = {
        price,
        positionQtyBasis: 0,
        activeTpPct: 0,
        updatedAt,
        syncStatus: "failed",
        lastError: error,
      };
    } else {
      this.state.desiredLongTp.syncStatus = "failed";
      this.state.desiredLongTp.updatedAt = updatedAt;
      this.state.desiredLongTp.lastError = error;
    }
    this.save();
  }

  getDesiredLongTp(): DesiredLongTp | null {
    return this.state.desiredLongTp;
  }

  // ── Pending order tracking ──

  setPendingOrder(order: PendingOrder): void {
    if (this.state.pendingOrder && this.state.pendingOrder.orderLinkId !== order.orderLinkId) {
      throw new Error(`pending order already active: ${this.state.pendingOrder.orderLinkId}`);
    }
    this.state.pendingOrder = order;
    this.save();
  }

  clearPendingOrder(): void {
    this.state.pendingOrder = null;
    this.save();
  }

  getPendingOrder(): PendingOrder | null {
    return this.state.pendingOrder;
  }

  // ── Stress hedge ──

  openHedge(pos: HedgePosition): void {
    this.state.hedgePosition = pos;
    this.save();
  }

  closeHedge(exitPrice: number, exitTime: number, feeRate: number, wasKill = false): { pnl: number; fees: number } {
    const pos = this.state.hedgePosition;
    if (!pos) return { pnl: 0, fees: 0 };

    // Short PnL: profit when price fell below entry
    const pnlRaw = (pos.entryPrice - exitPrice) * pos.qty;
    const entryFee = pos.notional * feeRate;
    const exitFee = exitPrice * pos.qty * feeRate;
    const fees = entryFee + exitFee;
    const pnl = pnlRaw - fees;

    this.state.realizedPnl += pnl;
    this.state.totalFees += fees;
    this.state.hedgePosition = null;
    this.state.hedgeLastCloseTime = exitTime;
    this.state.hedgeLastCloseWasKill = wasKill;
    this.save();

    return { pnl, fees };
  }

  /** Clear hedge state without recording PnL — used by reconciliation when state is stale. */
  clearHedge(): void {
    this.state.hedgePosition = null;
    this.save();
  }
}
