import fs from "fs";
import path from "path";
import {
  allocationDeltaForCumulative,
  PartialCloseIntent,
  PartialCloseReceipt,
} from "./partial-close-transaction";

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

export type PendingOrder = LegacyPendingOrder | PartialCloseIntent;

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
    startedAt: Date.now(),
    lastUpdated: Date.now(),
    version: 2,
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
      return { ...emptyState(), ...raw };
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

  beginPartialClose(intent: PartialCloseIntent): void {
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
    this.save();
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

  // ── Pending order tracking ──

  setPendingOrder(order: PendingOrder): void {
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
