import fs from "fs";
import path from "path";

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

  // Exit cooldown
  forcedExitCooldownUntil: number;  // ms timestamp — no new adds until this time (post hard-flatten/emergency)

  // Stress hedge
  hedgePosition: HedgePosition | null;
  hedgeLastCloseTime: number;      // ms — for cooldown tracking
  hedgeLastCloseWasKill: boolean;  // true if last close was a kill stop (use longer cooldown)

  // Recovery
  recoveryMode: boolean;         // true = no new adds, manage exit only
  recoveryTpOrderId: string;     // exchange order ID of recovery TP limit (for cleanup)
  pendingOrder: PendingOrder | null;  // in-flight order for crash recovery

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

export interface PendingOrder {
  orderLinkId: string;         // client-generated idempotency key
  action: "open" | "close" | "hedge_open" | "hedge_close";
  symbol: string;
  notional: number;
  createdAt: number;           // ms timestamp
}

const EMPTY_STATE: BotState = {
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
  forcedExitCooldownUntil: 0,
  hedgePosition: null,
  hedgeLastCloseTime: 0,
  hedgeLastCloseWasKill: false,
  recoveryMode: false,
  recoveryTpOrderId: "",
  pendingOrder: null,
  startedAt: Date.now(),
  lastUpdated: Date.now(),
  version: 1,
};

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
      return { ...EMPTY_STATE, startedAt: Date.now(), lastUpdated: Date.now() };
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
      console.log(`Loaded state: ${raw.positions?.length || 0} open positions, $${raw.realizedPnl?.toFixed(2) || 0} realized PnL`);
      return { ...EMPTY_STATE, ...raw };
    } catch (err) {
      console.error(`Failed to load state from ${this.filePath}, starting fresh:`, err);
      return { ...EMPTY_STATE, startedAt: Date.now(), lastUpdated: Date.now() };
    }
  }

  save(): void {
    this.state.lastUpdated = Date.now();
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Write to temp file then rename (atomic on most filesystems)
    const tmp = this.filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.filePath);
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
