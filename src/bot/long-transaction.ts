import type { ProRataAllocation } from "./partial-close-transaction";

export type LongTransactionKind = "long_open" | "full_close";

export type LongOpenIntent = {
  kind: "long_open";
  action: "open";
  partialClose?: never;
  orderLinkId: string;
  symbol: string;
  createdAt: number;
  level: number;
  requestedNotional: number;
  preLocalQty: number;
  preExchangeQty: number;
  qtyStep: number;
  lastObservedStatus: string;
  lastCheckedAt: number;
};

export type FullCloseIntent = {
  kind: "full_close";
  action: "close";
  partialClose?: never;
  orderLinkId: string;
  symbol: string;
  createdAt: number;
  reason: string;
  externalEvidenceStartTime?: number;
  preLocalQty: number;
  preExchangeQty: number;
  qtyStep: number;
  allocation: ProRataAllocation;
  prePositionCount: number;
  preAvgEntry: number;
  appliedQty: number;
  appliedExecNotional: number;
  appliedPnl: number;
  appliedFees: number;
  lastObservedStatus: string;
  lastCheckedAt: number;
};

export type LongTransactionIntent = LongOpenIntent | FullCloseIntent;

export type LongTransactionReceiptOutcome =
  | "committed"
  | "partial_terminal"
  | "rejected"
  | "external_close";

export type LongTransactionReceipt = {
  kind: LongTransactionKind;
  orderLinkId: string;
  orderId: string;
  outcome: LongTransactionReceiptOutcome;
  terminalStatus: string;
  filledQty: number;
  avgPrice: number | null;
  executionIds: string[];
  totalPnl: number;
  totalFees: number;
  positionsClosed: number;
  completedAt: number;
};

export type LongExecutionCommit = {
  orderId: string;
  status: string;
  filledQty: number;
  cumulativeExecNotional: number;
  avgPrice: number;
  executionIds?: string[];
};

export type LongOpenCommitResult = {
  receipt: LongTransactionReceipt;
  positionId: string;
  replayed: boolean;
};

export type LongCloseApplyResult = {
  deltaQty: number;
  totalPnl: number;
  totalFees: number;
  fillPrice: number | null;
  remainingQty: number;
};

export type LongCloseFinalizeResult = {
  receipt: LongTransactionReceipt;
  replayed: boolean;
};
