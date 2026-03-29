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
  peakEquity: number;          // high-water mark

  // Filter state
  riskOffUntil: number;        // ms timestamp — market risk-off cooldown
  lastTrendCheck: {            // cached 4h trend gate result
    timestamp: number;
    blocked: boolean;
    reason: string;
  };

  // Recovery
  recoveryMode: boolean;         // true = no new adds, manage exit only
  recoveryTpOrderId: string;     // exchange order ID of recovery TP limit (for cleanup)
  pendingOrder: PendingOrder | null;  // in-flight order for crash recovery

  // Meta
  startedAt: number;           // when bot first started
  lastUpdated: number;         // last state save
  version: number;             // state schema version
}

export interface PendingOrder {
  orderLinkId: string;         // client-generated idempotency key
  action: "open" | "close";
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
  peakEquity: 0,
  riskOffUntil: 0,
  lastTrendCheck: { timestamp: 0, blocked: false, reason: "" },
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

  recordBlockedAdd(): void {
    this.state.totalBlockedAdds++;
    // Don't save on every block — too frequent. Save periodically in main loop.
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
}
