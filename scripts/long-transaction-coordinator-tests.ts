import assert from "assert";
import fs from "fs";
import path from "path";
import {
  AggregatedExecutionEvidence,
  ClosedPnlEvidence,
  Executor,
  InstrumentLotInfo,
  LongCloseExecutionEvidence,
  LongExecutionResult,
  OrderExecutionState,
} from "../src/bot/executor";
import {
  executeFullCloseTransaction,
  executeLongOpenTransaction,
  migrateAndResolveLegacyPendingLongTransaction,
  reconcileExternalFlatLong,
  resolvePendingLongTransaction,
} from "../src/bot/long-transaction-coordinator";
import { StateManager } from "../src/bot/state";

function tempState(name: string): string {
  return path.join("data", `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

function cleanup(file: string): void {
  const full = path.resolve(process.cwd(), file);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

function addPos(state: StateManager, id: string, qty: number, price = 10): void {
  const pos = state.addPosition({
    entryPrice: price,
    entryTime: 1_700_000_000_000 + state.get().positions.length,
    qty,
    notional: qty * price,
    level: state.get().positions.length,
  });
  pos.id = id;
  state.save();
}

function result(overrides: Partial<LongExecutionResult>): LongExecutionResult {
  return {
    outcome: "accepted_unresolved",
    orderId: "order-1",
    orderLinkId: "tx-1",
    status: "New",
    terminal: false,
    submittedQty: 10,
    quotePrice: 10,
    cumExecQty: 0,
    cumExecNotional: null,
    avgPrice: null,
    remainingLongQty: null,
    qtyStep: 0.01,
    executionIds: [],
    ...overrides,
  };
}

type FakeOptions = {
  positionSizes?: number[];
  openResult?: LongExecutionResult;
  closeResult?: LongExecutionResult;
  orderState?: OrderExecutionState;
  executions?: AggregatedExecutionEvidence;
  recentExecutions?: LongCloseExecutionEvidence[];
  closedPnl?: ClosedPnlEvidence[];
};

function fakeExecutor(options: FakeOptions): Executor {
  const sizes = [...(options.positionSizes ?? [0])];
  let lastSize = sizes[sizes.length - 1] ?? 0;
  const nextSize = () => {
    if (sizes.length > 0) lastSize = sizes.shift()!;
    return lastSize;
  };
  const lot: InstrumentLotInfo = { qtyStep: 0.01, minOrderQty: 0.01, qtyDecimals: 2 };
  const orderState = options.orderState ?? {
    found: false,
    orderId: "",
    orderLinkId: "tx-1",
    status: "not_found",
    terminal: false,
    filledQty: 0,
    avgPrice: 0,
    cumExecQty: 0,
    cumExecNotional: null,
  };
  const executions = options.executions ?? {
    found: false,
    orderId: "",
    orderLinkId: "tx-1",
    executionIds: [],
    cumExecQty: 0,
    cumExecNotional: null,
    avgPrice: null,
  };

  return {
    getMode: () => "LIVE",
    getPrice: async () => 10,
    getCandles: async () => [],
    getInstrumentLotInfo: async () => lot,
    getLongPositionSize: async () => nextSize(),
    openLongDetailed: async () => options.openResult ?? result({}),
    closeAllLongsDetailed: async () => options.closeResult ?? result({}),
    queryOrderExecution: async () => orderState,
    queryOrderExecutions: async () => executions,
    queryRecentLongCloseExecutions: async () => options.recentExecutions ?? [],
    queryRecentClosedPnl: async () => options.closedPnl ?? [],
    openLong: async () => ({ success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0 }),
    closeAllLongs: async () => ({ success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0 }),
    reduceLongQty: async () => ({ success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0 }),
    reduceLongQtyDetailed: async () => ({ accepted: false, orderId: "", orderLinkId: "", status: "unused", terminal: true, submittedQty: 0, quotePrice: 0, cumExecQty: 0, cumExecNotional: null, avgPrice: null }),
    openShort: async () => ({ success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0 }),
    closeShort: async () => ({ success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0 }),
    setPositionTp: async () => ({ success: true, status: "confirmed" }),
    setPositionSl: async () => ({ success: true, status: "confirmed" }),
    ensureHedgeMode: async () => true,
    queryOrder: async () => ({ found: orderState.found, status: orderState.status, filledQty: orderState.cumExecQty, avgPrice: orderState.avgPrice }),
    getWalletEquity: async () => 0,
  };
}

async function testUnknownOpenRetainsPendingEvenWithoutOrderId(): Promise<void> {
  const file = tempState("coord-open-unknown");
  try {
    const state = new StateManager(file);
    const executor = fakeExecutor({
      positionSizes: [0],
      openResult: result({ outcome: "unknown", orderId: "", orderLinkId: "open-unknown", status: "submit_unknown", error: "ECONNRESET" }),
    });
    const resolved = await executeLongOpenTransaction({
      state, executor, symbol: "HYPEUSDT", feeRate: 0, now: 100, notional: 100, leverage: 1, level: 0, orderLinkId: "open-unknown",
    });
    assert.equal(resolved.outcome, "pending");
    assert.equal(state.get().pendingOrder?.orderLinkId, "open-unknown");
    assert.equal(state.isRecoveryMode(), true);
    assert.equal(state.getRecoveryOwnerOrderLinkId(), "open-unknown");
    assert.equal(state.get().positions.length, 0);
  } finally { cleanup(file); }
}

async function testTerminalPartialOpenCommitsActualFill(): Promise<void> {
  const file = tempState("coord-open-partial");
  try {
    const state = new StateManager(file);
    const executor = fakeExecutor({
      positionSizes: [0, 4],
      openResult: result({
        outcome: "terminal", orderLinkId: "open-partial", status: "PartiallyFilledCanceled", terminal: true,
        submittedQty: 10, cumExecQty: 4, cumExecNotional: 44, avgPrice: 11, executionIds: ["open-e1"],
      }),
    });
    const resolved = await executeLongOpenTransaction({
      state, executor, symbol: "HYPEUSDT", feeRate: 0, now: 100, notional: 100, leverage: 1, level: 0, orderLinkId: "open-partial",
    });
    assert.equal(resolved.outcome, "committed");
    assert.equal(resolved.synced, true);
    assert.equal(state.get().pendingOrder, null);
    assert.equal(state.get().positions.length, 1);
    assert.equal(state.get().positions[0].qty, 4);
    assert.equal(state.get().positions[0].entryPrice, 11);
  } finally { cleanup(file); }
}

async function testFullClosePartialThenTerminalIsAppliedOnce(): Promise<void> {
  const file = tempState("coord-close-partial");
  try {
    const state = new StateManager(file);
    addPos(state, "p1", 4);
    addPos(state, "p2", 6);
    const firstExecutor = fakeExecutor({
      positionSizes: [10],
      closeResult: result({
        outcome: "accepted_unresolved", orderLinkId: "close-partial", status: "PartiallyFilled",
        cumExecQty: 2, cumExecNotional: 24, avgPrice: 12, remainingLongQty: 8, executionIds: ["c1"],
      }),
    });
    const first = await executeFullCloseTransaction({
      state, executor: firstExecutor, symbol: "HYPEUSDT", feeRate: 0, now: 100, reason: "test", orderLinkId: "close-partial",
    });
    assert.equal(first.outcome, "pending");
    assert.equal(state.get().positions.reduce((sum, pos) => sum + pos.qty, 0), 8);

    const terminalExecutor = fakeExecutor({
      positionSizes: [5],
      orderState: {
        found: true, orderId: "order-1", orderLinkId: "close-partial", status: "PartiallyFilledCanceled",
        terminal: true, filledQty: 5, avgPrice: 12, cumExecQty: 5, cumExecNotional: 60,
      },
      executions: {
        found: true, orderId: "order-1", orderLinkId: "close-partial", executionIds: ["c1", "c2"],
        cumExecQty: 5, cumExecNotional: 60, avgPrice: 12,
      },
    });
    const terminal = await resolvePendingLongTransaction({
      state, executor: terminalExecutor, symbol: "HYPEUSDT", feeRate: 0, now: 200,
    });
    assert.equal(terminal.outcome, "partial_terminal");
    assert.equal(terminal.synced, true);
    assert.equal(state.get().pendingOrder, null);
    assert.equal(state.get().positions.reduce((sum, pos) => sum + pos.qty, 0), 5);
    assert.equal(state.get().realizedPnl, 10);
    assert.equal(state.get().totalBatchCloses, 1);
    assert.equal(state.isRecoveryMode(), true);
  } finally { cleanup(file); }
}

async function testTerminalPartialMismatchRetainsPending(): Promise<void> {
  const file = tempState("coord-close-mismatch");
  try {
    const state = new StateManager(file);
    addPos(state, "p1", 10);
    const executor = fakeExecutor({
      positionSizes: [10],
      closeResult: result({
        outcome: "terminal", orderLinkId: "close-mismatch", status: "PartiallyFilledCanceled", terminal: true,
        cumExecQty: 4, cumExecNotional: 48, avgPrice: 12, remainingLongQty: 5,
      }),
    });
    const resolved = await executeFullCloseTransaction({
      state, executor, symbol: "HYPEUSDT", feeRate: 0, now: 100, reason: "test", orderLinkId: "close-mismatch",
    });
    assert.equal(resolved.outcome, "pending");
    assert.equal(state.get().pendingOrder?.orderLinkId, "close-mismatch");
    assert.equal(state.isRecoveryMode(), true);
    assert.equal(state.get().positions.reduce((sum, pos) => sum + pos.qty, 0), 6);
  } finally { cleanup(file); }
}

async function testPreCloseMismatchDoesNotCreateFakePending(): Promise<void> {
  const file = tempState("coord-pre-close-mismatch");
  try {
    const state = new StateManager(file);
    addPos(state, "p1", 10);
    const executor = fakeExecutor({ positionSizes: [8] });
    const resolved = await executeFullCloseTransaction({
      state, executor, symbol: "HYPEUSDT", feeRate: 0, now: 100, reason: "test", orderLinkId: "must-not-persist",
    });
    assert.equal(resolved.outcome, "failed");
    assert.equal(resolved.status, "pre_state_mismatch");
    assert.equal(state.get().pendingOrder, null);
    assert.equal(state.get().positions[0].qty, 10);
    assert.equal(state.isRecoveryMode(), true);
  } finally { cleanup(file); }
}

async function testTerminalFullCloseAndDefinitiveReject(): Promise<void> {
  const fullFile = tempState("coord-close-full");
  const rejectFile = tempState("coord-close-reject");
  try {
    const fullState = new StateManager(fullFile);
    addPos(fullState, "p1", 10);
    const fullExecutor = fakeExecutor({
      positionSizes: [10],
      closeResult: result({
        outcome: "terminal", orderLinkId: "close-full", status: "Filled", terminal: true,
        cumExecQty: 10, cumExecNotional: 120, avgPrice: 12, remainingLongQty: 0, executionIds: ["full-e1"],
      }),
    });
    const full = await executeFullCloseTransaction({
      state: fullState, executor: fullExecutor, symbol: "HYPEUSDT", feeRate: 0, now: 100, reason: "test", orderLinkId: "close-full",
    });
    assert.equal(full.outcome, "committed");
    assert.equal(fullState.get().positions.length, 0);
    assert.equal(fullState.get().realizedPnl, 20);
    assert.equal(fullState.get().totalBatchCloses, 1);

    const rejectState = new StateManager(rejectFile);
    addPos(rejectState, "p1", 10);
    const rejectExecutor = fakeExecutor({
      positionSizes: [10, 10],
      closeResult: result({ outcome: "rejected", orderLinkId: "close-reject", status: "Rejected", terminal: true, orderId: "", error: "explicit reject" }),
    });
    const rejected = await executeFullCloseTransaction({
      state: rejectState, executor: rejectExecutor, symbol: "HYPEUSDT", feeRate: 0, now: 100, reason: "test", orderLinkId: "close-reject",
    });
    assert.equal(rejected.outcome, "rejected");
    assert.equal(rejectState.get().pendingOrder, null);
    assert.equal(rejectState.get().positions[0].qty, 10);
    assert.equal(rejectState.isRecoveryMode(), false);
  } finally {
    cleanup(fullFile);
    cleanup(rejectFile);
  }
}

async function testImpossibleOverfillFailsClosedWithoutLocalMutation(): Promise<void> {
  const file = tempState("coord-close-overfill");
  try {
    const state = new StateManager(file);
    addPos(state, "p1", 10);
    const executor = fakeExecutor({
      positionSizes: [10],
      closeResult: result({
        outcome: "terminal", orderLinkId: "close-overfill", status: "Filled", terminal: true,
        cumExecQty: 11, cumExecNotional: 132, avgPrice: 12, remainingLongQty: 0,
      }),
    });
    const resolved = await executeFullCloseTransaction({
      state, executor, symbol: "HYPEUSDT", feeRate: 0, now: 100, reason: "test", orderLinkId: "close-overfill",
    });
    assert.equal(resolved.outcome, "pending");
    assert.match(resolved.error ?? "", /allocation delta/);
    assert.equal(state.get().positions[0].qty, 10);
    assert.equal(state.get().realizedPnl, 0);
    assert.equal(state.get().pendingOrder?.orderLinkId, "close-overfill");
    assert.equal(state.isRecoveryMode(), true);
  } finally { cleanup(file); }
}

async function testNativeExecutionEvidenceCommitsAndAmbiguityFailsClosed(): Promise<void> {
  const exactFile = tempState("coord-native-exact");
  const ambiguousFile = tempState("coord-native-ambiguous");
  try {
    const exactState = new StateManager(exactFile);
    addPos(exactState, "p1", 10);
    const exactExecutor = fakeExecutor({
      positionSizes: [0],
      closeResult: result({ outcome: "already_flat", orderLinkId: "native-exact", status: "already_flat", terminal: true, remainingLongQty: 0 }),
      recentExecutions: [{ execId: "native-e1", orderId: "native-order", orderLinkId: "", execTime: 100, closedSize: 10, execQty: 10, execPrice: 12 }],
    });
    const exact = await executeFullCloseTransaction({
      state: exactState, executor: exactExecutor, symbol: "HYPEUSDT", feeRate: 0, now: 100, reason: "native TP", orderLinkId: "native-exact",
    });
    assert.equal(exact.outcome, "committed");
    assert.equal(exact.status, "external_execution_evidence");
    assert.equal(exactState.get().positions.length, 0);
    assert.equal(exactState.get().realizedPnl, 20);

    const ambiguousState = new StateManager(ambiguousFile);
    addPos(ambiguousState, "p1", 10);
    const ambiguousExecutor = fakeExecutor({
      positionSizes: [0],
      closeResult: result({ outcome: "already_flat", orderLinkId: "native-ambiguous", status: "already_flat", terminal: true, remainingLongQty: 0 }),
      recentExecutions: [{ execId: "native-e2", orderId: "native-order-2", orderLinkId: "", execTime: 100, closedSize: 9, execQty: 9, execPrice: 12 }],
    });
    const ambiguous = await executeFullCloseTransaction({
      state: ambiguousState, executor: ambiguousExecutor, symbol: "HYPEUSDT", feeRate: 0, now: 100, reason: "native TP", orderLinkId: "native-ambiguous",
    });
    assert.equal(ambiguous.outcome, "pending");
    assert.equal(ambiguousState.get().positions.length, 1);
    assert.equal(ambiguousState.get().pendingOrder?.orderLinkId, "native-ambiguous");
    assert.equal(ambiguousState.isRecoveryMode(), true);
  } finally {
    cleanup(exactFile);
    cleanup(ambiguousFile);
  }
}

async function testNativeClosedPnlIsStrictFallback(): Promise<void> {
  const file = tempState("coord-native-pnl");
  try {
    const state = new StateManager(file);
    addPos(state, "p1", 10);
    const executor = fakeExecutor({
      positionSizes: [0],
      closeResult: result({ outcome: "already_flat", orderLinkId: "native-pnl", status: "already_flat", terminal: true, remainingLongQty: 0 }),
      recentExecutions: [],
      closedPnl: [{ orderId: "native-pnl-order", side: "Sell", updatedTime: 100, closedSize: 10, avgExitPrice: 12, closedPnl: 20 }],
    });
    const resolved = await executeFullCloseTransaction({
      state, executor, symbol: "HYPEUSDT", feeRate: 0, now: 100, reason: "native TP", orderLinkId: "native-pnl",
    });
    assert.equal(resolved.outcome, "committed");
    assert.equal(resolved.status, "external_closed_pnl_evidence");
    assert.equal(state.get().realizedPnl, 20);
  } finally { cleanup(file); }
}

async function testStartupExternalFlatCommitsOnlyFromExactEvidence(): Promise<void> {
  const exactFile = tempState("coord-startup-flat-exact");
  const ambiguousFile = tempState("coord-startup-flat-ambiguous");
  try {
    const exactState = new StateManager(exactFile);
    addPos(exactState, "p1", 10);
    const exactExecutor = fakeExecutor({
      positionSizes: [0, 0],
      recentExecutions: [{
        execId: "startup-flat-e1",
        orderId: "native-tp-order",
        orderLinkId: "",
        execTime: Date.now(),
        closedSize: 10,
        execQty: 10,
        execPrice: 12,
      }],
    });
    const exact = await reconcileExternalFlatLong({
      state: exactState,
      executor: exactExecutor,
      symbol: "HYPEUSDT",
      feeRate: 0,
      now: Date.now(),
      orderLinkId: "startup-flat-exact",
    });
    assert.equal(exact.outcome, "committed");
    assert.equal(exact.status, "external_execution_evidence");
    assert.equal(exactState.get().positions.length, 0);
    assert.equal(exactState.get().realizedPnl, 20);
    assert.equal(exactState.get().pendingOrder, null);

    const ambiguousState = new StateManager(ambiguousFile);
    addPos(ambiguousState, "p1", 10);
    const ambiguousExecutor = fakeExecutor({
      positionSizes: [0],
      recentExecutions: [{
        execId: "startup-flat-e2",
        orderId: "native-tp-order-2",
        orderLinkId: "",
        execTime: Date.now(),
        closedSize: 9,
        execQty: 9,
        execPrice: 12,
      }],
    });
    const ambiguous = await reconcileExternalFlatLong({
      state: ambiguousState,
      executor: ambiguousExecutor,
      symbol: "HYPEUSDT",
      feeRate: 0,
      now: Date.now(),
      orderLinkId: "startup-flat-ambiguous",
    });
    assert.equal(ambiguous.outcome, "pending");
    assert.equal(ambiguousState.get().positions.length, 1);
    assert.equal(ambiguousState.get().positions[0].qty, 10);
    assert.equal(ambiguousState.get().realizedPnl, 0);
    assert.equal(ambiguousState.get().pendingOrder?.orderLinkId, "startup-flat-ambiguous");
    assert.equal(ambiguousState.isRecoveryMode(), true);
  } finally {
    cleanup(exactFile);
    cleanup(ambiguousFile);
  }
}

async function testNotFoundAloneNeverClearsPending(): Promise<void> {
  const file = tempState("coord-not-found");
  try {
    const state = new StateManager(file);
    const initialExecutor = fakeExecutor({
      positionSizes: [0],
      openResult: result({ outcome: "unknown", orderId: "", orderLinkId: "open-not-found", status: "submit_unknown" }),
    });
    await executeLongOpenTransaction({
      state, executor: initialExecutor, symbol: "HYPEUSDT", feeRate: 0, now: 100, notional: 100, leverage: 1, level: 0, orderLinkId: "open-not-found",
    });
    const resolver = fakeExecutor({ positionSizes: [0] });
    const resultAfterRestart = await resolvePendingLongTransaction({
      state, executor: resolver, symbol: "HYPEUSDT", feeRate: 0, now: 200,
    });
    assert.equal(resultAfterRestart.outcome, "pending");
    assert.equal(state.get().pendingOrder?.orderLinkId, "open-not-found");
  } finally { cleanup(file); }
}

async function testLegacyTerminalPartialCloseUsesCoordinatorMath(): Promise<void> {
  const file = tempState("coord-legacy-close");
  try {
    const state = new StateManager(file);
    addPos(state, "p1", 10);
    const legacy = {
      orderLinkId: "legacy-close",
      action: "close" as const,
      symbol: "HYPEUSDT",
      notional: 0,
      createdAt: 100,
    };
    state.setPendingOrder(legacy);
    const executor = fakeExecutor({
      positionSizes: [6],
      orderState: {
        found: true, orderId: "legacy-order", orderLinkId: "legacy-close", status: "PartiallyFilledCanceled",
        terminal: true, filledQty: 4, avgPrice: 12, cumExecQty: 4, cumExecNotional: 48,
      },
      executions: {
        found: true, orderId: "legacy-order", orderLinkId: "legacy-close", executionIds: ["legacy-e1"],
        cumExecQty: 4, cumExecNotional: 48, avgPrice: 12,
      },
    });
    const resolved = await migrateAndResolveLegacyPendingLongTransaction({
      state, executor, symbol: "HYPEUSDT", feeRate: 0, now: 200,
    }, legacy);
    assert.equal(resolved.outcome, "partial_terminal");
    assert.equal(state.get().positions.reduce((sum, pos) => sum + pos.qty, 0), 6);
    assert.equal(state.get().realizedPnl, 8);
    assert.equal(state.get().pendingOrder, null);
  } finally { cleanup(file); }
}

async function testLegacyCommittedOpenIsAdoptedWithoutDuplicate(): Promise<void> {
  const file = tempState("coord-legacy-open-adopt");
  try {
    const state = new StateManager(file);
    const existing = state.addPosition({
      entryPrice: 11, entryTime: 100, qty: 4, notional: 44, level: 0, orderId: "legacy-open-order",
    });
    existing.id = "existing-open";
    state.save();
    const legacy = {
      orderLinkId: "legacy-open",
      action: "open" as const,
      symbol: "HYPEUSDT",
      notional: 44,
      createdAt: 100,
    };
    state.setPendingOrder(legacy);
    const executor = fakeExecutor({
      positionSizes: [4],
      orderState: {
        found: true, orderId: "legacy-open-order", orderLinkId: "legacy-open", status: "Filled",
        terminal: true, filledQty: 4, avgPrice: 11, cumExecQty: 4, cumExecNotional: 44,
      },
      executions: {
        found: true, orderId: "legacy-open-order", orderLinkId: "legacy-open", executionIds: ["legacy-open-e1"],
        cumExecQty: 4, cumExecNotional: 44, avgPrice: 11,
      },
    });
    const resolved = await migrateAndResolveLegacyPendingLongTransaction({
      state, executor, symbol: "HYPEUSDT", feeRate: 0, now: 200,
    }, legacy);
    assert.equal(resolved.outcome, "committed");
    assert.equal(state.get().positions.length, 1);
    assert.equal(state.get().pendingOrder, null);
    assert.equal(state.getCompletedLongTransaction("legacy-open")?.orderId, "legacy-open-order");
  } finally { cleanup(file); }
}

async function testLegacyStartupImportedOpenUsingLinkIdIsNotDuplicated(): Promise<void> {
  const file = tempState("coord-legacy-open-link-adopt");
  try {
    const state = new StateManager(file);
    const existing = state.addPosition({
      entryPrice: 11, entryTime: 100, qty: 4, notional: 44, level: 0,
      // Historical startup import stored the client link in orderId.
      orderId: "legacy-open-link",
    });
    existing.id = "existing-link-open";
    state.save();
    const legacy = {
      orderLinkId: "legacy-open-link",
      action: "open" as const,
      symbol: "HYPEUSDT",
      notional: 44,
      createdAt: 100,
    };
    state.setPendingOrder(legacy);
    const executor = fakeExecutor({
      positionSizes: [4],
      orderState: {
        found: true, orderId: "actual-exchange-order", orderLinkId: "legacy-open-link", status: "Filled",
        terminal: true, filledQty: 4, avgPrice: 11, cumExecQty: 4, cumExecNotional: 44,
      },
      executions: {
        found: true, orderId: "actual-exchange-order", orderLinkId: "legacy-open-link", executionIds: ["legacy-link-e1"],
        cumExecQty: 4, cumExecNotional: 44, avgPrice: 11,
      },
    });
    const resolved = await migrateAndResolveLegacyPendingLongTransaction({
      state, executor, symbol: "HYPEUSDT", feeRate: 0, now: 200,
    }, legacy);
    assert.equal(resolved.outcome, "committed");
    assert.equal(state.get().positions.length, 1);
    assert.equal(state.get().positions[0].id, "existing-link-open");
    assert.equal(state.get().pendingOrder, null);
    assert.equal(state.getCompletedLongTransaction("legacy-open-link")?.orderId, "actual-exchange-order");
  } finally { cleanup(file); }
}

async function main(): Promise<void> {
  await testUnknownOpenRetainsPendingEvenWithoutOrderId();
  await testTerminalPartialOpenCommitsActualFill();
  await testFullClosePartialThenTerminalIsAppliedOnce();
  await testTerminalPartialMismatchRetainsPending();
  await testPreCloseMismatchDoesNotCreateFakePending();
  await testTerminalFullCloseAndDefinitiveReject();
  await testImpossibleOverfillFailsClosedWithoutLocalMutation();
  await testNativeExecutionEvidenceCommitsAndAmbiguityFailsClosed();
  await testNativeClosedPnlIsStrictFallback();
  await testStartupExternalFlatCommitsOnlyFromExactEvidence();
  await testNotFoundAloneNeverClearsPending();
  await testLegacyTerminalPartialCloseUsesCoordinatorMath();
  await testLegacyCommittedOpenIsAdoptedWithoutDuplicate();
  await testLegacyStartupImportedOpenUsingLinkIdIsNotDuplicated();
  console.log("long transaction coordinator tests passed");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
