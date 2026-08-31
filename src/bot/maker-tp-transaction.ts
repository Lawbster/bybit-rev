import type { ProRataAllocation } from "./partial-close-transaction";

export type MakerTpPhase =
  | "intent_persisted"
  | "active"
  | "cancel_requested"
  | "fallback_required"
  | "recovery";

export type MakerTpCloseSource =
  | "tp_touch"
  | "maker_partial"
  | "forced"
  | "emergency"
  | "operator";

export interface MakerTpCloseRequest {
  reason: string;
  source: MakerTpCloseSource;
  requestedAt: number;
  fallbackAfterAt: number;
}

export interface MakerTpOrderState {
  version: 2;
  symbol: string;
  orderLinkId: string;
  orderId: string;
  phase: MakerTpPhase;
  closeReason: string;
  activeTpPct: number;
  price: number;
  exchangePrice: number | null;
  requestedQty: number;
  submittedQty: number | null;
  qtyStep: number;
  priceTick: number | null;
  allocation: ProRataAllocation;
  prePositionCount: number;
  preAvgEntry: number;
  preOldestEntryTime: number;
  createdAt: number;
  updatedAt: number;
  touchedAt: number | null;
  fallbackDeadlineAt: number | null;
  closeRequest: MakerTpCloseRequest | null;
  lastObservedStatus: string;
  lastCheckedAt: number;
  makerCumExecQty: number;
  makerCumExecNotional: number;
  appliedQty: number;
  appliedExecNotional: number;
  appliedPnl: number;
  appliedFees: number;
  executionIds: string[];
}

export interface MakerTpReceipt {
  orderLinkId: string;
  orderId: string;
  closeReason: string;
  outcome: "cancelled_zero_fill" | "partial_committed" | "full_committed";
  terminalStatus: string;
  filledQty: number;
  avgPrice: number | null;
  executionIds: string[];
  totalPnl: number;
  totalFees: number;
  positionsClosed: number;
  prePositionCount: number;
  preAvgEntry: number;
  preOldestEntryTime: number;
  completedAt: number;
}

export interface MakerTpApplyResult {
  deltaQty: number;
  deltaPnl: number;
  deltaFees: number;
  fillPrice: number | null;
  remainingQty: number;
}

export interface MakerTpFinalizeResult {
  receipt: MakerTpReceipt;
  replayed: boolean;
}
