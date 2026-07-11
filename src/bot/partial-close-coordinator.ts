import { Executor, genOrderLinkId, normalizeQtyDown } from "./executor";
import {
  PartialCloseAllocation,
  PartialCloseDesiredPostCommit,
  PartialCloseStrategy,
  intentPreLocalQty,
} from "./partial-close-transaction";
import { StateManager } from "./state";

export type PartialCloseCoordinatorRequest = {
  symbol: string;
  exchangeMode: boolean;
  now: number;
  quotePrice: number;
  feeRate: number;
  strategy: PartialCloseStrategy;
  orderAction: string;
  actionKey: string;
  requestedQty: number;
  allocation: PartialCloseAllocation;
  desiredPostCommit: PartialCloseDesiredPostCommit;
  state: StateManager;
  executor: Executor;
};

export type PartialCloseCoordinatorOutcome =
  | "committed"
  | "pending"
  | "rejected"
  | "failed"
  | "already_completed";

export type PartialCloseCoordinatorResult = {
  outcome: PartialCloseCoordinatorOutcome;
  orderLinkId?: string;
  orderId?: string;
  status?: string;
  terminal?: boolean;
  submittedQty: number;
  filledQty: number;
  fillPrice: number | null;
  totalPnl: number;
  totalFees: number;
  positionsClosed: number;
  positionsReduced: number;
  remainingRungs: number;
  error?: string;
};

function emptyResult(outcome: PartialCloseCoordinatorOutcome, error?: string): PartialCloseCoordinatorResult {
  return {
    outcome,
    submittedQty: 0,
    filledQty: 0,
    fillPrice: null,
    totalPnl: 0,
    totalFees: 0,
    positionsClosed: 0,
    positionsReduced: 0,
    remainingRungs: 0,
    error,
  };
}

export async function executePartialCloseTransaction(
  req: PartialCloseCoordinatorRequest,
): Promise<PartialCloseCoordinatorResult> {
  const { state, executor } = req;
  if (state.hasCompletedPartialAction(req.actionKey)) {
    return emptyResult("already_completed");
  }
  if (state.getPendingOrder()) {
    return emptyResult("failed", `pending order already active: ${state.getPendingOrder()?.orderLinkId}`);
  }

  const prePositions = state.get().positions;
  const preLocalQty = intentPreLocalQty(req.allocation);
  const preExchangeQty = req.exchangeMode
    ? await executor.getLongPositionSize(req.symbol)
    : prePositions.reduce((sum, pos) => sum + pos.qty, 0);
  const lotInfo = await executor.getInstrumentLotInfo(req.symbol);
  const submittedQty = normalizeQtyDown(
    Math.min(req.requestedQty, preLocalQty, preExchangeQty || preLocalQty),
    lotInfo.qtyStep,
  );

  if (submittedQty <= 0) return emptyResult("failed", "partial close quantity normalized to zero");
  if (submittedQty < lotInfo.minOrderQty) {
    return emptyResult("failed", `partial close quantity ${submittedQty} below minOrderQty ${lotInfo.minOrderQty}`);
  }

  const orderLinkId = genOrderLinkId(req.orderAction);
  state.beginPartialClose({
    kind: "partial_close",
    action: "close",
    orderLinkId,
    symbol: req.symbol,
    strategy: req.strategy,
    actionKey: req.actionKey,
    createdAt: req.now,
    preLocalQty,
    preExchangeQty,
    requestedQty: req.requestedQty,
    submittedQty,
    qtyStep: lotInfo.qtyStep,
    allocation: req.allocation,
    appliedQty: 0,
    appliedExecNotional: 0,
    lastObservedStatus: "created",
    lastCheckedAt: req.now,
    desiredPostCommit: req.desiredPostCommit,
  });

  const preCount = prePositions.length;

  if (!req.exchangeMode) {
    const observedNotional = submittedQty * req.quotePrice;
    const stateResult = state.applyObservedPartialFill(
      orderLinkId,
      submittedQty,
      observedNotional,
      "Filled",
      req.now,
      req.feeRate,
    );
    state.finalizePartialClose(orderLinkId, "Filled", req.now);
    const remainingRungs = state.get().positions.length;
    return {
      outcome: "committed",
      orderLinkId,
      orderId: orderLinkId,
      status: "Filled",
      terminal: true,
      submittedQty,
      filledQty: submittedQty,
      fillPrice: stateResult.fillPrice,
      totalPnl: stateResult.totalPnl,
      totalFees: stateResult.totalFees,
      positionsClosed: Math.max(0, preCount - remainingRungs),
      positionsReduced: preCount,
      remainingRungs,
    };
  }

  const reduce = await executor.reduceLongQtyDetailed(req.symbol, submittedQty, orderLinkId);
  if (!reduce.accepted) {
    state.rejectPartialClose(orderLinkId, reduce.status, Date.now());
    return {
      ...emptyResult("failed", reduce.error ?? reduce.status),
      orderLinkId,
      orderId: reduce.orderId,
      status: reduce.status,
      terminal: reduce.terminal,
      submittedQty,
    };
  }

  let applied = { deltaQty: 0, totalPnl: 0, totalFees: 0, fillPrice: null as number | null };
  const observedNotional = reduce.cumExecNotional ?? (
    reduce.avgPrice !== null && reduce.cumExecQty > 0 ? reduce.avgPrice * reduce.cumExecQty : null
  );
  if (reduce.cumExecQty > 0 && observedNotional !== null) {
    applied = state.applyObservedPartialFill(
      orderLinkId,
      reduce.cumExecQty,
      observedNotional,
      reduce.status,
      Date.now(),
      req.feeRate,
    );
  }

  const remainingRungs = state.get().positions.length;
  const base = {
    orderLinkId,
    orderId: reduce.orderId,
    status: reduce.status,
    terminal: reduce.terminal,
    submittedQty,
    filledQty: reduce.cumExecQty,
    fillPrice: reduce.avgPrice,
    totalPnl: applied.totalPnl,
    totalFees: applied.totalFees,
    positionsClosed: Math.max(0, preCount - remainingRungs),
    positionsReduced: applied.deltaQty > 0 ? preCount : 0,
    remainingRungs,
  };

  if (reduce.terminal) {
    if (reduce.cumExecQty > 0) {
      state.finalizePartialClose(orderLinkId, reduce.status, Date.now());
      return { ...base, outcome: "committed" };
    }
    state.rejectPartialClose(orderLinkId, reduce.status, Date.now());
    return { ...base, outcome: "rejected" };
  }

  state.markPartialUnknown(orderLinkId, reduce.status, Date.now());
  return { ...base, outcome: "pending" };
}
