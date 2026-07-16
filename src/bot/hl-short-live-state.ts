import fs from "fs";
import path from "path";
import {
  HL_SHORT_BREAKDOWN_CANDIDATE,
  HL_SHORT_BREAKDOWN_POLICY_SIGNATURE,
  HL_SHORT_BREAKDOWN_POLICY_VERSION,
} from "./hl-short-breakdown-policy";

export type HlShortPendingIntent = HlShortOpenIntent | HlShortCloseIntent;

export interface HlShortOpenIntent {
  kind: "short_open";
  orderLinkId: string;
  signalId: string;
  decisionTs: number;
  createdAt: number;
  requestedNotional: number;
  qtyStep: number;
  lastObservedStatus: string;
  lastCheckedAt: number;
}

export interface HlShortCloseIntent {
  kind: "short_close";
  orderLinkId: string;
  signalId: string;
  createdAt: number;
  reason: "timeout" | "manual" | "protection_failure";
  preQty: number;
  preEntryPrice: number;
  qtyStep: number;
  evidenceStartAt: number;
  lastObservedStatus: string;
  lastCheckedAt: number;
}

export interface HlShortManagedPosition {
  signalId: string;
  decisionTs: number;
  entryTime: number;
  entryPrice: number;
  qty: number;
  initialQty: number;
  notional: number;
  openOrderId: string;
  openOrderLinkId: string;
  openExecutionIds: string[];
  entryFeesRemaining: number;
  takeProfit: number;
  stopLoss: number;
  expiresAt: number;
  protectionStatus: "pending" | "confirmed" | "failed";
  protectionFailureCount: number;
  lastProtectionCheckAt: number;
  lastProtectionError?: string;
}

export interface HlShortReceipt {
  kind: "short_open" | "short_close" | "signal_skip";
  signalId: string;
  orderLinkId: string;
  orderId: string;
  outcome: "committed" | "partial_terminal" | "rejected" | "native_close" | "skipped";
  terminalStatus: string;
  reason?: string;
  filledQty: number;
  avgPrice: number | null;
  executionIds: string[];
  pnl: number;
  fees: number;
  completedAt: number;
}

export interface HlShortLiveStateV1 {
  version: 1;
  symbol: "HYPEUSDT";
  candidate: typeof HL_SHORT_BREAKDOWN_CANDIDATE;
  policyVersion: typeof HL_SHORT_BREAKDOWN_POLICY_VERSION;
  policySignature: string;
  createdAt: number;
  updatedAt: number;
  eventOffset: number | null;
  lastSignalId: string | null;
  lastSignalAt: number | null;
  lastSignalOutcome: string | null;
  processedSignalIds: string[];
  position: HlShortManagedPosition | null;
  pending: HlShortPendingIntent | null;
  receipts: HlShortReceipt[];
  realizedPnl: number;
  totalFees: number;
  recoveryMode: boolean;
  recoveryReason: string | null;
  lastReconcileAt: number | null;
  lastExchangeQty: number | null;
}

export interface ShortOpenCommit {
  orderId: string;
  status: string;
  filledQty: number;
  avgPrice: number;
  executionIds: string[];
  entryFees: number;
  takeProfit: number;
  stopLoss: number;
  expiresAt: number;
}

export interface ShortCloseCommit {
  orderId: string;
  status: string;
  filledQty: number;
  avgPrice: number;
  executionIds: string[];
  exitFees: number;
  completedAt: number;
  native: boolean;
  pnlOverride?: number;
}

const MAX_RECEIPTS = 256;
const MAX_SIGNAL_IDS = 512;

function defaultState(now: number): HlShortLiveStateV1 {
  return {
    version: 1,
    symbol: "HYPEUSDT",
    candidate: HL_SHORT_BREAKDOWN_CANDIDATE,
    policyVersion: HL_SHORT_BREAKDOWN_POLICY_VERSION,
    policySignature: HL_SHORT_BREAKDOWN_POLICY_SIGNATURE,
    createdAt: now,
    updatedAt: now,
    eventOffset: null,
    lastSignalId: null,
    lastSignalAt: null,
    lastSignalOutcome: null,
    processedSignalIds: [],
    position: null,
    pending: null,
    receipts: [],
    realizedPnl: 0,
    totalFees: 0,
    recoveryMode: false,
    recoveryReason: null,
    lastReconcileAt: null,
    lastExchangeQty: null,
  };
}

function atomicWrite(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2));
    fs.renameSync(temp, filePath);
  } catch (err) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch { /* best effort */ }
    throw err;
  }
}

function rememberSignal(state: HlShortLiveStateV1, signalId: string): void {
  if (!state.processedSignalIds.includes(signalId)) state.processedSignalIds.push(signalId);
  if (state.processedSignalIds.length > MAX_SIGNAL_IDS) {
    state.processedSignalIds.splice(0, state.processedSignalIds.length - MAX_SIGNAL_IDS);
  }
}

function rememberReceipt(state: HlShortLiveStateV1, receipt: HlShortReceipt): void {
  const duplicate = state.receipts.some(existing =>
    existing.kind === receipt.kind
    && existing.signalId === receipt.signalId
    && existing.orderLinkId === receipt.orderLinkId
    && existing.outcome === receipt.outcome,
  );
  if (!duplicate) state.receipts.push(receipt);
  if (state.receipts.length > MAX_RECEIPTS) state.receipts.splice(0, state.receipts.length - MAX_RECEIPTS);
}

export class HlShortLiveStateStore {
  private state: HlShortLiveStateV1;
  readonly filePath: string;

  constructor(filePath: string, now: number = Date.now()) {
    this.filePath = path.resolve(filePath);
    this.state = this.load(now);
  }

  private load(now: number): HlShortLiveStateV1 {
    if (!fs.existsSync(this.filePath)) return defaultState(now);
    const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as Partial<HlShortLiveStateV1>;
    if (
      parsed.version !== 1
      || parsed.symbol !== "HYPEUSDT"
      || parsed.candidate !== HL_SHORT_BREAKDOWN_CANDIDATE
      || parsed.policyVersion !== HL_SHORT_BREAKDOWN_POLICY_VERSION
      || parsed.policySignature !== HL_SHORT_BREAKDOWN_POLICY_SIGNATURE
    ) {
      throw new Error("unsupported or policy-mismatched HYPE HL short live state");
    }
    return { ...defaultState(now), ...parsed } as HlShortLiveStateV1;
  }

  get(): Readonly<HlShortLiveStateV1> {
    return this.state;
  }

  private mutate(fn: (state: HlShortLiveStateV1) => void, now: number = Date.now()): void {
    fn(this.state);
    this.state.updatedAt = now;
    atomicWrite(this.filePath, this.state);
  }

  save(now: number = Date.now()): void {
    this.mutate(() => undefined, now);
  }

  initializeEventOffset(offset: number, now: number): void {
    if (this.state.eventOffset !== null) return;
    this.mutate(state => { state.eventOffset = offset; }, now);
  }

  advanceEventOffset(offset: number, now: number): void {
    if (this.state.eventOffset === offset) return;
    this.mutate(state => { state.eventOffset = offset; }, now);
  }

  isSignalKnown(signalId: string): boolean {
    return this.state.processedSignalIds.includes(signalId)
      || this.state.position?.signalId === signalId
      || this.state.pending?.signalId === signalId;
  }

  recordSignalSkip(signalId: string, decisionTs: number, reason: string, now: number): void {
    this.mutate(state => {
      rememberSignal(state, signalId);
      state.lastSignalId = signalId;
      state.lastSignalAt = decisionTs;
      state.lastSignalOutcome = reason;
      rememberReceipt(state, {
        kind: "signal_skip",
        signalId,
        orderLinkId: "",
        orderId: "",
        outcome: "skipped",
        terminalStatus: "skipped",
        reason,
        filledQty: 0,
        avgPrice: null,
        executionIds: [],
        pnl: 0,
        fees: 0,
        completedAt: now,
      });
    }, now);
  }

  beginOpen(intent: HlShortOpenIntent): void {
    if (this.state.pending) throw new Error(`short pending already active: ${this.state.pending.orderLinkId}`);
    if (this.state.position) throw new Error(`short position already active: ${this.state.position.signalId}`);
    this.mutate(state => {
      state.pending = intent;
      state.lastSignalId = intent.signalId;
      state.lastSignalAt = intent.decisionTs;
      state.lastSignalOutcome = "open_pending";
    }, intent.createdAt);
  }

  beginClose(intent: HlShortCloseIntent): void {
    if (this.state.pending) throw new Error(`short pending already active: ${this.state.pending.orderLinkId}`);
    if (!this.state.position) throw new Error("cannot begin short close without local position");
    this.mutate(state => { state.pending = intent; }, intent.createdAt);
  }

  observePending(orderLinkId: string, status: string, now: number): void {
    this.mutate(state => {
      if (!state.pending || state.pending.orderLinkId !== orderLinkId) throw new Error(`short pending mismatch: ${orderLinkId}`);
      state.pending.lastObservedStatus = status;
      state.pending.lastCheckedAt = now;
    }, now);
  }

  commitOpen(orderLinkId: string, commit: ShortOpenCommit, now: number): HlShortReceipt {
    const pending = this.state.pending;
    if (!pending || pending.kind !== "short_open" || pending.orderLinkId !== orderLinkId) {
      const existing = this.state.receipts.find(receipt => receipt.kind === "short_open" && receipt.orderLinkId === orderLinkId);
      if (existing) return existing;
      throw new Error(`short open pending mismatch: ${orderLinkId}`);
    }
    const receipt: HlShortReceipt = {
      kind: "short_open",
      signalId: pending.signalId,
      orderLinkId,
      orderId: commit.orderId,
      outcome: "committed",
      terminalStatus: commit.status,
      filledQty: commit.filledQty,
      avgPrice: commit.avgPrice,
      executionIds: [...new Set(commit.executionIds)],
      pnl: 0,
      fees: commit.entryFees,
      completedAt: now,
    };
    this.mutate(state => {
      state.position = {
        signalId: pending.signalId,
        decisionTs: pending.decisionTs,
        // Start the maximum-hold clock when durable intent was written, not when
        // a later resolver happened to observe the fill after a crash/restart.
        entryTime: pending.createdAt,
        entryPrice: commit.avgPrice,
        qty: commit.filledQty,
        initialQty: commit.filledQty,
        notional: commit.avgPrice * commit.filledQty,
        openOrderId: commit.orderId,
        openOrderLinkId: orderLinkId,
        openExecutionIds: [...new Set(commit.executionIds)],
        entryFeesRemaining: commit.entryFees,
        takeProfit: commit.takeProfit,
        stopLoss: commit.stopLoss,
        expiresAt: commit.expiresAt,
        protectionStatus: "pending",
        protectionFailureCount: 0,
        lastProtectionCheckAt: 0,
      };
      state.pending = null;
      state.totalFees += commit.entryFees;
      state.lastSignalOutcome = "open_committed";
      rememberSignal(state, pending.signalId);
      rememberReceipt(state, receipt);
    }, now);
    return receipt;
  }

  rejectOpen(orderLinkId: string, orderId: string, status: string, reason: string | undefined, now: number): HlShortReceipt {
    const pending = this.state.pending;
    if (!pending || pending.kind !== "short_open" || pending.orderLinkId !== orderLinkId) {
      const existing = this.state.receipts.find(receipt => receipt.kind === "short_open" && receipt.orderLinkId === orderLinkId);
      if (existing) return existing;
      throw new Error(`short open pending mismatch: ${orderLinkId}`);
    }
    const receipt: HlShortReceipt = {
      kind: "short_open",
      signalId: pending.signalId,
      orderLinkId,
      orderId,
      outcome: "rejected",
      terminalStatus: status,
      reason,
      filledQty: 0,
      avgPrice: null,
      executionIds: [],
      pnl: 0,
      fees: 0,
      completedAt: now,
    };
    this.mutate(state => {
      state.pending = null;
      state.lastSignalOutcome = `open_rejected:${status}`;
      rememberSignal(state, pending.signalId);
      rememberReceipt(state, receipt);
    }, now);
    return receipt;
  }

  commitClose(orderLinkId: string, commit: ShortCloseCommit): HlShortReceipt {
    const pending = this.state.pending;
    if (!pending || pending.kind !== "short_close" || pending.orderLinkId !== orderLinkId) {
      const existing = this.state.receipts.find(receipt => receipt.kind === "short_close" && receipt.orderLinkId === orderLinkId);
      if (existing) return existing;
      throw new Error(`short close pending mismatch: ${orderLinkId}`);
    }
    return this.applyClose(pending.signalId, orderLinkId, pending.reason, commit);
  }

  commitNativeClose(commit: ShortCloseCommit): HlShortReceipt {
    const position = this.state.position;
    if (!position) {
      const existing = this.state.receipts.find(receipt => receipt.kind === "short_close" && receipt.orderId === commit.orderId);
      if (existing) return existing;
      throw new Error("cannot commit native short close without local position");
    }
    return this.applyClose(position.signalId, `native:${commit.orderId}`, "native_tp_sl", commit);
  }

  private applyClose(signalId: string, orderLinkId: string, reason: string, commit: ShortCloseCommit): HlShortReceipt {
    const position = this.state.position;
    if (!position || position.signalId !== signalId) throw new Error(`short close position mismatch: ${signalId}`);
    const appliedQty = Math.min(commit.filledQty, position.qty);
    if (appliedQty <= 0 || commit.avgPrice <= 0) throw new Error("short close commit has no positive fill");
    const fraction = Math.min(1, appliedQty / position.qty);
    const allocatedEntryFees = position.entryFeesRemaining * fraction;
    const grossPnl = (position.entryPrice - commit.avgPrice) * appliedQty;
    const calculatedPnl = grossPnl - allocatedEntryFees - commit.exitFees;
    const pnl = commit.pnlOverride ?? calculatedPnl;
    const remainingQty = Math.max(0, position.qty - appliedQty);
    const terminal = remainingQty <= 1e-8;
    const receipt: HlShortReceipt = {
      kind: "short_close",
      signalId,
      orderLinkId,
      orderId: commit.orderId,
      outcome: commit.native ? "native_close" : terminal ? "committed" : "partial_terminal",
      terminalStatus: commit.status,
      reason,
      filledQty: appliedQty,
      avgPrice: commit.avgPrice,
      executionIds: [...new Set(commit.executionIds)],
      pnl,
      fees: allocatedEntryFees + commit.exitFees,
      completedAt: commit.completedAt,
    };
    this.mutate(state => {
      state.realizedPnl += pnl;
      state.totalFees += commit.exitFees;
      if (terminal) {
        state.position = null;
      } else if (state.position) {
        state.position.qty = remainingQty;
        state.position.notional = remainingQty * state.position.entryPrice;
        state.position.entryFeesRemaining = Math.max(0, state.position.entryFeesRemaining - allocatedEntryFees);
        state.position.protectionStatus = "pending";
      }
      if (
        state.pending?.orderLinkId === orderLinkId
        || (commit.native && state.pending?.kind === "short_close")
      ) state.pending = null;
      rememberReceipt(state, receipt);
    }, commit.completedAt);
    return receipt;
  }

  rejectClose(orderLinkId: string, orderId: string, status: string, reason: string | undefined, now: number): HlShortReceipt {
    const pending = this.state.pending;
    if (!pending || pending.kind !== "short_close" || pending.orderLinkId !== orderLinkId) {
      const existing = this.state.receipts.find(receipt => receipt.kind === "short_close" && receipt.orderLinkId === orderLinkId);
      if (existing) return existing;
      throw new Error(`short close pending mismatch: ${orderLinkId}`);
    }
    const receipt: HlShortReceipt = {
      kind: "short_close",
      signalId: pending.signalId,
      orderLinkId,
      orderId,
      outcome: "rejected",
      terminalStatus: status,
      reason,
      filledQty: 0,
      avgPrice: null,
      executionIds: [],
      pnl: 0,
      fees: 0,
      completedAt: now,
    };
    this.mutate(state => {
      state.pending = null;
      rememberReceipt(state, receipt);
    }, now);
    return receipt;
  }

  markProtection(
    status: "confirmed" | "failed",
    now: number,
    error?: string,
    takeProfit?: number,
    stopLoss?: number,
  ): void {
    this.mutate(state => {
      if (!state.position) return;
      state.position.protectionStatus = status;
      state.position.lastProtectionCheckAt = now;
      state.position.lastProtectionError = error;
      if (status === "failed") {
        state.position.protectionFailureCount++;
      } else {
        state.position.protectionFailureCount = 0;
        if (takeProfit !== undefined) state.position.takeProfit = takeProfit;
        if (stopLoss !== undefined) state.position.stopLoss = stopLoss;
      }
    }, now);
  }

  enterRecovery(reason: string, now: number): void {
    this.mutate(state => {
      state.recoveryMode = true;
      state.recoveryReason = reason;
    }, now);
  }

  clearRecovery(now: number): void {
    if (!this.state.recoveryMode && this.state.recoveryReason === null) return;
    this.mutate(state => {
      state.recoveryMode = false;
      state.recoveryReason = null;
    }, now);
  }

  recordReconcile(exchangeQty: number | null, now: number): void {
    this.mutate(state => {
      state.lastReconcileAt = now;
      state.lastExchangeQty = exchangeQty;
    }, now);
  }
}
