import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { Executor, LongExecutionResult } from "../src/bot/executor";
import {
  cancelAndResolveMakerTpOrder,
  combineMakerTpFallbackResult,
  ensureMakerTpOrder,
  executeMakerTpMarketFallback,
  finalizePartialMakerTpForFallback,
  retireMakerTpToNative,
  resolveMakerTpOrder,
} from "../src/bot/maker-tp-coordinator";
import { StateManager } from "../src/bot/state";
import { resolvePendingLongTransaction } from "../src/bot/long-transaction-coordinator";

function tempState(name: string): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`)), "state.json");
}

function cleanup(file: string): void {
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
}

function seed(state: StateManager): void {
  const a = state.addPosition({ entryPrice: 10, entryTime: 100, qty: 4, notional: 40, level: 0 });
  const b = state.addPosition({ entryPrice: 12, entryTime: 200, qty: 6, notional: 72, level: 1 });
  a.id = "p-a";
  b.id = "p-b";
  state.save();
}

function result(overrides: Partial<LongExecutionResult> = {}): LongExecutionResult {
  const merged: LongExecutionResult = {
    outcome: "accepted_unresolved",
    orderId: "maker-order",
    orderLinkId: "maker-link",
    status: "New",
    terminal: false,
    submittedQty: 10,
    quotePrice: 13,
    cumExecQty: 0,
    cumExecNotional: null,
    avgPrice: null,
    remainingLongQty: 10,
    qtyStep: 0.01,
    executionIds: [],
    ...overrides,
  };
  if (!overrides.orderEvidence) {
    merged.orderEvidence = {
      found: true,
      orderId: merged.orderId,
      orderLinkId: merged.orderLinkId,
      status: merged.status,
      terminal: merged.terminal,
      filledQty: merged.cumExecQty,
      avgPrice: merged.avgPrice ?? 0,
      cumExecQty: merged.cumExecQty,
      cumExecNotional: merged.cumExecNotional,
      price: merged.quotePrice,
      qty: merged.submittedQty,
      leavesQty: Math.max(0, merged.submittedQty - merged.cumExecQty),
      side: "Sell",
      positionIdx: 1,
      reduceOnly: true,
      timeInForce: "PostOnly",
      orderType: "Limit",
    };
  }
  return merged;
}

type FakeOptions = {
  positionSizes?: number[];
  placeResult?: LongExecutionResult;
  cancelResult?: LongExecutionResult;
  marketCloseResult?: LongExecutionResult;
  orderResult?: ReturnType<Executor["queryOrderExecution"]> extends Promise<infer T> ? T : never;
  executionResult?: ReturnType<Executor["queryOrderExecutions"]> extends Promise<infer T> ? T : never;
  recentLongCloses?: Awaited<ReturnType<Executor["queryRecentLongCloseExecutions"]>>;
  recentClosedPnl?: Awaited<ReturnType<Executor["queryRecentClosedPnl"]>>;
  failProtectionVerification?: boolean;
  priceTick?: number;
  calls?: { cancel: number; setTp: number; tpPrices?: number[] };
};

function fakeExecutor(options: FakeOptions = {}): Executor {
  const sizes = [...(options.positionSizes ?? [10])];
  let lastSize = sizes[0] ?? 10;
  let nativeTp = 0;
  return {
    getInstrumentLotInfo: async () => ({
      qtyStep: 0.01,
      minOrderQty: 0.01,
      qtyDecimals: 2,
      priceTick: options.priceTick ?? 0.001,
    }),
    getLongPositionSize: async () => {
      if (sizes.length > 0) lastSize = sizes.shift()!;
      return lastSize;
    },
    placeLongMakerTpDetailed: async () => options.placeResult ?? result(),
    cancelLongMakerTpDetailed: async () => {
      if (options.calls) options.calls.cancel++;
      return options.cancelResult ?? result({
        outcome: "terminal", status: "Cancelled", terminal: true, remainingLongQty: lastSize,
      });
    },
    closeAllLongsDetailed: async () => options.marketCloseResult ?? result({
      outcome: "terminal", orderLinkId: "fallback-link", status: "Filled", terminal: true,
      cumExecQty: lastSize, cumExecNotional: lastSize * 14, avgPrice: 14,
      remainingLongQty: 0, executionIds: ["fallback-exec"],
    }),
    setPositionTp: async (_symbol: string, price: number) => {
      if (options.calls) options.calls.setTp++;
      options.calls?.tpPrices?.push(price);
      if (!options.failProtectionVerification) nativeTp = price;
      return { success: true, status: "confirmed" };
    },
    clearPositionTp: async () => {
      if (!options.failProtectionVerification) nativeTp = 0;
      return { success: true, status: "confirmed" };
    },
    getLongPositionProtection: async () => ({
      size: lastSize,
      takeProfit: nativeTp,
      stopLoss: 0,
      updatedTime: 0,
    }),
    queryOrderExecution: async (_symbol: string, orderLinkId: string) => options.orderResult ?? ({
      found: true, orderId: "maker-order", orderLinkId, status: "New", terminal: false,
      filledQty: 0, avgPrice: 0, cumExecQty: 0, cumExecNotional: null,
      price: 13, qty: 10, leavesQty: 10, side: "Sell", positionIdx: 1,
      reduceOnly: true, timeInForce: "PostOnly", orderType: "Limit",
    }),
    queryOrderExecutions: async (_symbol: string, orderLinkId: string) => options.executionResult ?? ({
      found: false, orderId: "", orderLinkId, executionIds: [], cumExecQty: 0,
      cumExecNotional: null, avgPrice: null,
    }),
    queryRecentLongCloseExecutions: async () => options.recentLongCloses ?? [],
    queryRecentClosedPnl: async () => options.recentClosedPnl ?? [],
  } as unknown as Executor;
}

const base = {
  symbol: "HYPEUSDT",
  entryFeeRate: 0.00055,
  makerExitFeeRate: 0.0002,
  touchGraceMs: 2_000,
  activeTpPct: 1.4,
};

async function testActiveIntentIsDurable(): Promise<void> {
  const file = tempState("maker-coord-active");
  try {
    const state = new StateManager(file);
    seed(state);
    const placed = await ensureMakerTpOrder({
      ...base, state, executor: fakeExecutor(), now: 300, price: 13, closeReason: "TP", orderLinkId: "maker-link",
    });
    assert.equal(placed.outcome, "active");
    assert.equal(state.getMakerTpOrder()?.phase, "active");
    assert.equal(state.getMakerTpOrder()?.orderId, "maker-order");

    const reloaded = new StateManager(file);
    const resolved = await resolveMakerTpOrder({ ...base, state: reloaded, executor: fakeExecutor(), now: 310 });
    assert.equal(resolved.outcome, "active");
    assert.equal(reloaded.isRecoveryMode(), false);
  } finally { cleanup(file); }
}

async function testExplicitRejectClearsZeroFill(): Promise<void> {
  const file = tempState("maker-coord-reject");
  try {
    const state = new StateManager(file);
    seed(state);
    const rejected = await ensureMakerTpOrder({
      ...base,
      state,
      executor: fakeExecutor({ placeResult: result({ outcome: "rejected", status: "Rejected", terminal: true, error: "post-only" }) }),
      now: 300,
      price: 13,
      closeReason: "TP",
      orderLinkId: "maker-link",
    });
    assert.equal(rejected.outcome, "rejected");
    assert.equal(state.getMakerTpOrder(), null);
    assert.equal(state.get().positions.length, 2);
    assert.equal(state.isRecoveryMode(), false);
  } finally { cleanup(file); }
}

async function testUnknownSubmitRetainsIntentInRecovery(): Promise<void> {
  const file = tempState("maker-coord-unknown");
  try {
    const state = new StateManager(file);
    seed(state);
    const unknown = await ensureMakerTpOrder({
      ...base,
      state,
      executor: fakeExecutor({ placeResult: result({ outcome: "unknown", orderId: "", status: "submit_unknown", remainingLongQty: null }) }),
      now: 300,
      price: 13,
      closeReason: "TP",
      orderLinkId: "maker-link",
    });
    assert.equal(unknown.outcome, "pending");
    assert.equal(state.getMakerTpOrder()?.orderLinkId, "maker-link");
    assert.equal(state.isRecoveryMode(), true);
  } finally { cleanup(file); }
}

async function testFullFillCommitsExactlyOnce(): Promise<void> {
  const file = tempState("maker-coord-full");
  try {
    const state = new StateManager(file);
    seed(state);
    const full = result({
      outcome: "terminal", status: "Filled", terminal: true, cumExecQty: 10,
      cumExecNotional: 130, avgPrice: 13, remainingLongQty: 0, executionIds: ["maker-e1"],
    });
    const closed = await ensureMakerTpOrder({
      ...base, state, executor: fakeExecutor({ positionSizes: [10], placeResult: full }),
      now: 300, price: 13, closeReason: "TP", orderLinkId: "maker-link",
    });
    assert.equal(closed.outcome, "full_committed");
    assert.equal(closed.filledQty, 10);
    assert.equal(state.get().positions.length, 0);
    assert.equal(state.get().totalBatchCloses, 1);
    const pnl = state.get().realizedPnl;

    const reloaded = new StateManager(file);
    assert.equal(reloaded.getCompletedMakerTpOrder("maker-link")?.filledQty, 10);
    assert.equal(reloaded.get().realizedPnl, pnl);
  } finally { cleanup(file); }
}

async function testCancelRaceAppliesPartialThenRequiresFallback(): Promise<void> {
  const file = tempState("maker-coord-cancel-partial");
  try {
    const state = new StateManager(file);
    seed(state);
    const executor = fakeExecutor({
      positionSizes: [10],
      cancelResult: result({
        outcome: "terminal", status: "PartiallyFilledCanceled", terminal: true,
        cumExecQty: 4, cumExecNotional: 52, avgPrice: 13, remainingLongQty: 6,
        executionIds: ["maker-partial"],
      }),
    });
    const placed = await ensureMakerTpOrder({
      ...base, state, executor, now: 300, price: 13, closeReason: "TP", orderLinkId: "maker-link",
    });
    assert.equal(placed.outcome, "active");
    const cancelled = await cancelAndResolveMakerTpOrder({ ...base, state, executor, now: 400 });
    assert.equal(cancelled.outcome, "fallback_required");
    assert.equal(cancelled.filledQty, 4);
    assert.equal(cancelled.remainingQty, 6);
    assert.equal(state.getMakerTpOrder()?.phase, "fallback_required");
    assert.equal(state.get().positions.reduce((sum, position) => sum + position.qty, 0), 6);

    const receipt = finalizePartialMakerTpForFallback(state, "maker-link", "PartiallyFilledCanceled", 410);
    assert.equal(receipt.filledQty, 4);
    assert.equal(state.getMakerTpOrder(), null);
    assert.equal(state.get().totalBatchCloses, 0);
  } finally { cleanup(file); }
}

async function testQuantityMismatchFailsClosed(): Promise<void> {
  const file = tempState("maker-coord-mismatch");
  try {
    const state = new StateManager(file);
    seed(state);
    const mismatched = result({
      outcome: "terminal", status: "PartiallyFilledCanceled", terminal: true,
      cumExecQty: 4, cumExecNotional: 52, avgPrice: 13, remainingLongQty: 7,
      executionIds: ["maker-partial"],
    });
    const resultAfterFill = await ensureMakerTpOrder({
      ...base, state, executor: fakeExecutor({ positionSizes: [10], placeResult: mismatched }),
      now: 300, price: 13, closeReason: "TP", orderLinkId: "maker-link",
    });
    assert.equal(resultAfterFill.outcome, "pending");
    assert.equal(resultAfterFill.synced, false);
    assert.equal(state.getMakerTpOrder()?.phase, "recovery");
    assert.equal(state.isRecoveryMode(), true);
  } finally { cleanup(file); }
}

async function testPartialMakerThenMarketFallbackCombinesOneClose(): Promise<void> {
  const file = tempState("maker-coord-fallback");
  try {
    const state = new StateManager(file);
    seed(state);
    const executor = fakeExecutor({
      positionSizes: [10, 6],
      cancelResult: result({
        outcome: "terminal", status: "PartiallyFilledCanceled", terminal: true,
        cumExecQty: 4, cumExecNotional: 52, avgPrice: 13, remainingLongQty: 6,
        executionIds: ["maker-partial"],
      }),
      marketCloseResult: result({
        outcome: "terminal", orderId: "fallback-order", orderLinkId: "fallback-link",
        status: "Filled", terminal: true, submittedQty: 6, cumExecQty: 6,
        cumExecNotional: 84, avgPrice: 14, remainingLongQty: 0,
        executionIds: ["fallback-exec"],
      }),
    });
    assert.equal((await ensureMakerTpOrder({
      ...base, state, executor, now: 300, price: 13, closeReason: "TP", orderLinkId: "maker-link",
    })).outcome, "active");

    const closed = await executeMakerTpMarketFallback({ ...base, state, executor, now: 400, reason: "TP" });
    assert.equal(closed.outcome, "committed");
    assert.equal(closed.filledQty, 10);
    assert.equal(closed.avgPrice, 13.6);
    assert.equal(closed.prePositionCount, 2);
    assert.equal(closed.positionsClosed, 2);
    assert.equal(state.get().positions.length, 0);
    assert.equal(state.get().totalBatchCloses, 1);
    assert.equal(state.getCompletedMakerTpOrder("maker-link")?.outcome, "partial_committed");
    const fallbackReceipt = state.get().completedLongTransactions.find(receipt => receipt.orderId === "fallback-order");
    assert.equal(fallbackReceipt?.makerTpPrefixOrderLinkId, "maker-link");
  } finally { cleanup(file); }
}

async function testFallbackUnknownSurvivesRestartWithPrefix(): Promise<void> {
  const file = tempState("maker-coord-fallback-restart");
  try {
    const state = new StateManager(file);
    seed(state);
    const initialExecutor = fakeExecutor({
      positionSizes: [10, 6],
      cancelResult: result({
        outcome: "terminal", status: "PartiallyFilledCanceled", terminal: true,
        cumExecQty: 4, cumExecNotional: 52, avgPrice: 13, remainingLongQty: 6,
        executionIds: ["maker-partial"],
      }),
      marketCloseResult: result({
        outcome: "unknown", orderId: "", orderLinkId: "fallback-unknown",
        status: "submit_unknown", terminal: false, submittedQty: 6,
        cumExecQty: 0, cumExecNotional: null, avgPrice: null,
        remainingLongQty: null, executionIds: [],
      }),
    });
    assert.equal((await ensureMakerTpOrder({
      ...base, state, executor: initialExecutor, now: 300, price: 13,
      closeReason: "TP", orderLinkId: "maker-link",
    })).outcome, "active");
    const pending = await executeMakerTpMarketFallback({
      ...base, state, executor: initialExecutor, now: 400, reason: "TP",
    });
    assert.equal(pending.outcome, "pending");
    assert.equal(state.getMakerTpOrder(), null);
    assert.equal(state.getPendingOrder()?.kind, "full_close");
    assert.equal((state.getPendingOrder() as any).makerTpPrefixOrderLinkId, "maker-link");

    const reloaded = new StateManager(file);
    const resolver = fakeExecutor({
      positionSizes: [0],
      orderResult: {
        found: true, orderId: "fallback-order", orderLinkId: "fallback-unknown",
        status: "Filled", terminal: true, filledQty: 6, avgPrice: 14,
        cumExecQty: 6, cumExecNotional: 84,
      },
      executionResult: {
        found: true, orderId: "fallback-order", orderLinkId: "fallback-unknown",
        executionIds: ["fallback-exec"], cumExecQty: 6, cumExecNotional: 84, avgPrice: 14,
      },
    });
    const resolved = await resolvePendingLongTransaction({
      state: reloaded, executor: resolver, symbol: "HYPEUSDT", feeRate: base.entryFeeRate, now: 500,
    });
    const combined = combineMakerTpFallbackResult(reloaded, resolved);
    assert.equal(combined.outcome, "committed");
    assert.equal(combined.filledQty, 10);
    assert.equal(combined.avgPrice, 13.6);
    assert.equal(combined.prePositionCount, 2);
    assert.equal(reloaded.get().positions.length, 0);
  } finally { cleanup(file); }
}

async function testZeroFillFallbackPersistsMarketIntentBeforeSubmitResolution(): Promise<void> {
  const file = tempState("maker-coord-zero-fallback-restart");
  try {
    const state = new StateManager(file);
    seed(state);
    const executor = fakeExecutor({
      positionSizes: [10, 10],
      cancelResult: result({
        outcome: "terminal",
        status: "Cancelled",
        terminal: true,
        cumExecQty: 0,
        cumExecNotional: null,
        avgPrice: null,
        remainingLongQty: 10,
      }),
      marketCloseResult: result({
        outcome: "unknown",
        orderId: "",
        orderLinkId: "fallback-unknown",
        status: "submit_unknown",
        terminal: false,
        submittedQty: 10,
        cumExecQty: 0,
        cumExecNotional: null,
        avgPrice: null,
        remainingLongQty: null,
        executionIds: [],
      }),
    });
    assert.equal((await ensureMakerTpOrder({
      ...base,
      state,
      executor,
      now: 300,
      price: 13,
      closeReason: "TP",
      orderLinkId: "maker-link",
    })).outcome, "active");
    const pending = await executeMakerTpMarketFallback({
      ...base,
      state,
      executor,
      now: 400,
      reason: "TP",
    });
    assert.equal(pending.outcome, "pending");
    assert.equal(state.getMakerTpOrder(), null);
    assert.equal(state.getPendingOrder()?.kind, "full_close");
    assert.equal(state.getCompletedMakerTpOrder("maker-link")?.outcome, "cancelled_zero_fill");
    assert.equal((state.getPendingOrder() as any).makerTpPrefixOrderLinkId, undefined);

    const reloaded = new StateManager(file);
    assert.equal(reloaded.getPendingOrder()?.kind, "full_close");
    assert.equal(reloaded.get().positions.reduce((sum, position) => sum + position.qty, 0), 10);
  } finally { cleanup(file); }
}

async function testNativeTpWinsMakerHandoffWithExactEvidence(): Promise<void> {
  const file = tempState("maker-coord-native-race");
  try {
    const state = new StateManager(file);
    seed(state);
    assert.equal((await ensureMakerTpOrder({
      ...base,
      state,
      executor: fakeExecutor({ positionSizes: [10] }),
      now: 300,
      price: 13,
      closeReason: "TP",
      orderLinkId: "maker-link",
    })).outcome, "active");

    const nativeExecutor = fakeExecutor({
      positionSizes: [0],
      orderResult: {
        found: true,
        orderId: "maker-order",
        orderLinkId: "maker-link",
        status: "Cancelled",
        terminal: true,
        filledQty: 0,
        avgPrice: 0,
        cumExecQty: 0,
        cumExecNotional: null,
      },
      recentLongCloses: [{
        execId: "native-exec",
        orderId: "native-tp-order",
        orderLinkId: "",
        execTime: 350,
        execQty: 10,
        closedSize: 10,
        execPrice: 13.1,
        createType: "CreateByTakeProfit",
        stopOrderType: "TakeProfit",
      }],
    });
    const resolved = await resolveMakerTpOrder({
      ...base,
      state,
      executor: nativeExecutor,
      now: 400,
    });
    assert.equal(resolved.outcome, "full_committed");
    assert.equal(resolved.filledQty, 10);
    assert.equal(resolved.avgPrice, 13.1);
    assert.equal(state.get().positions.length, 0);
    assert.equal(state.get().totalBatchCloses, 1);
    assert.equal(state.getCompletedMakerTpOrder("maker-link")?.outcome, "cancelled_zero_fill");
    assert.equal(state.get().completedLongTransactions.at(-1)?.reason, "NATIVE_TP");
    assert.equal(state.isRecoveryMode(), false);
  } finally { cleanup(file); }
}

async function testNativeTpRaceWithoutExactEvidenceFailsClosed(): Promise<void> {
  const file = tempState("maker-coord-native-ambiguous");
  try {
    const state = new StateManager(file);
    seed(state);
    assert.equal((await ensureMakerTpOrder({
      ...base,
      state,
      executor: fakeExecutor({ positionSizes: [10] }),
      now: 300,
      price: 13,
      closeReason: "TP",
      orderLinkId: "maker-link",
    })).outcome, "active");
    const resolved = await resolveMakerTpOrder({
      ...base,
      state,
      executor: fakeExecutor({
        positionSizes: [0],
        orderResult: {
          found: true,
          orderId: "maker-order",
          orderLinkId: "maker-link",
          status: "Cancelled",
          terminal: true,
          filledQty: 0,
          avgPrice: 0,
          cumExecQty: 0,
          cumExecNotional: null,
        },
      }),
      now: 400,
    });
    assert.equal(resolved.outcome, "pending");
    assert.equal(state.getMakerTpOrder(), null);
    assert.equal(state.getPendingOrder()?.kind, "full_close");
    assert.equal(state.isRecoveryMode(), true);
    assert.equal(state.get().positions.length, 2);
  } finally { cleanup(file); }
}

async function testMakerPartialThenNativeTpResidualCombinesOnce(): Promise<void> {
  const file = tempState("maker-coord-native-partial");
  try {
    const state = new StateManager(file);
    seed(state);
    assert.equal((await ensureMakerTpOrder({
      ...base,
      state,
      executor: fakeExecutor({ positionSizes: [10] }),
      now: 300,
      price: 13,
      closeReason: "TP",
      orderLinkId: "maker-link",
    })).outcome, "active");
    const resolved = await resolveMakerTpOrder({
      ...base,
      state,
      executor: fakeExecutor({
        positionSizes: [0],
        orderResult: {
          found: true,
          orderId: "maker-order",
          orderLinkId: "maker-link",
          status: "PartiallyFilledCanceled",
          terminal: true,
          filledQty: 4,
          avgPrice: 13,
          cumExecQty: 4,
          cumExecNotional: 52,
        },
        executionResult: {
          found: true,
          orderId: "maker-order",
          orderLinkId: "maker-link",
          executionIds: ["maker-exec"],
          cumExecQty: 4,
          cumExecNotional: 52,
          avgPrice: 13,
        },
        recentLongCloses: [{
          execId: "native-residual-exec",
          orderId: "native-residual-order",
          orderLinkId: "",
          execTime: 350,
          execQty: 6,
          closedSize: 6,
          execPrice: 13.1,
          createType: "CreateByTakeProfit",
          stopOrderType: "TakeProfit",
        }],
      }),
      now: 400,
    });
    assert.equal(resolved.outcome, "full_committed");
    assert.equal(resolved.filledQty, 10);
    assert.ok(Math.abs((resolved.avgPrice ?? 0) - 13.06) < 1e-9);
    assert.equal(state.get().positions.length, 0);
    assert.equal(state.get().totalBatchCloses, 1);
    assert.equal(state.getCompletedMakerTpOrder("maker-link")?.outcome, "partial_committed");
    assert.equal(state.get().completedLongTransactions.at(-1)?.makerTpPrefixOrderLinkId, "maker-link");
  } finally { cleanup(file); }
}

async function testActivePartialStartsDurableFallbackWithoutPriceTouch(): Promise<void> {
  const file = tempState("maker-coord-active-partial-deadline");
  try {
    const state = new StateManager(file);
    seed(state);
    const partial = result({
      cumExecQty: 4,
      cumExecNotional: 52,
      avgPrice: 13,
      remainingLongQty: 6,
      executionIds: ["maker-partial-live"],
      lastExecTime: 250,
    });
    const placed = await ensureMakerTpOrder({
      ...base,
      state,
      executor: fakeExecutor({ positionSizes: [10], placeResult: partial }),
      now: 300,
      price: 13,
      closeReason: "TP",
      orderLinkId: "maker-link",
    });
    assert.equal(placed.outcome, "active");
    assert.equal(state.get().positions.reduce((sum, position) => sum + position.qty, 0), 6);
    assert.deepEqual(state.getMakerTpOrder()?.closeRequest, {
      reason: "TP",
      source: "maker_partial",
      requestedAt: 250,
      fallbackAfterAt: 2250,
    });
  } finally { cleanup(file); }
}

async function testActiveOrderContractMismatchFailsClosed(): Promise<void> {
  const file = tempState("maker-coord-contract-mismatch");
  try {
    const state = new StateManager(file);
    seed(state);
    const bad = result();
    bad.orderEvidence = { ...bad.orderEvidence!, timeInForce: "GoodTillCancel" };
    const placed = await ensureMakerTpOrder({
      ...base,
      state,
      executor: fakeExecutor({ placeResult: bad }),
      now: 300,
      price: 13,
      closeReason: "TP",
      orderLinkId: "maker-link",
    });
    assert.equal(placed.outcome, "pending");
    assert.match(placed.error ?? "", /timeInForce mismatch/);
    assert.equal(state.getMakerTpOrder()?.phase, "recovery");
    assert.equal(state.isRecoveryMode(), true);
  } finally { cleanup(file); }
}

async function testContradictoryFilledWithoutEvidenceFailsClosed(): Promise<void> {
  const file = tempState("maker-coord-zero-filled-contradiction");
  try {
    const state = new StateManager(file);
    seed(state);
    const contradictory = result({
      outcome: "terminal",
      status: "Filled",
      terminal: true,
      remainingLongQty: 10,
    });
    const placed = await ensureMakerTpOrder({
      ...base,
      state,
      executor: fakeExecutor({ placeResult: contradictory }),
      now: 300,
      price: 13,
      closeReason: "TP",
      orderLinkId: "maker-link",
    });
    assert.equal(placed.outcome, "pending");
    assert.match(placed.error ?? "", /no durable fill evidence/);
    assert.equal(state.getMakerTpOrder()?.phase, "recovery");
    assert.equal(state.isRecoveryMode(), true);
  } finally { cleanup(file); }
}

async function testDurableForcedCloseSurvivesCancelCrashWindow(): Promise<void> {
  const file = tempState("maker-coord-close-request-crash");
  try {
    const state = new StateManager(file);
    seed(state);
    assert.equal((await ensureMakerTpOrder({
      ...base,
      state,
      executor: fakeExecutor({ positionSizes: [10] }),
      now: 300,
      price: 13,
      closeReason: "TP",
      orderLinkId: "maker-link",
    })).outcome, "active");
    state.requestMakerTpClose("maker-link", {
      reason: "HARD FLATTEN",
      source: "forced",
      requestedAt: 350,
      fallbackAfterAt: 350,
    }, 350);
    // Emulate a process death after exchange cancellation but before the
    // atomic maker->market-intent transition.
    state.markMakerTpOrder("maker-link", {
      phase: "fallback_required",
      status: "Cancelled",
      checkedAt: 351,
    });

    const reloaded = new StateManager(file);
    const executor = fakeExecutor({
      positionSizes: [10, 10],
      cancelResult: result({
        outcome: "terminal", status: "Cancelled", terminal: true,
        remainingLongQty: 10,
      }),
      marketCloseResult: result({
        outcome: "terminal", orderId: "fallback-order", orderLinkId: "fallback-link",
        status: "Filled", terminal: true, submittedQty: 10, cumExecQty: 10,
        cumExecNotional: 140, avgPrice: 14, remainingLongQty: 0,
        executionIds: ["fallback-exec"],
      }),
    });
    const closed = await executeMakerTpMarketFallback({
      ...base,
      state: reloaded,
      executor,
      now: 400,
      reason: reloaded.getMakerTpOrder()!.closeRequest!.reason,
      source: reloaded.getMakerTpOrder()!.closeRequest!.source,
    });
    assert.equal(closed.outcome, "committed");
    assert.equal(closed.closeReason, "HARD FLATTEN");
    assert.equal(reloaded.getCompletedMakerTpOrder("maker-link")?.closeReason, "HARD FLATTEN");
    assert.equal(reloaded.get().completedLongTransactions.at(-1)?.reason, "HARD FLATTEN");
    assert.equal(reloaded.get().positions.length, 0);
  } finally { cleanup(file); }
}

async function testDisabledOwnerRestoresNativeBeforeCancellation(): Promise<void> {
  const file = tempState("maker-coord-retire-native-first");
  try {
    const state = new StateManager(file);
    seed(state);
    const calls = { cancel: 0, setTp: 0 };
    const executor = fakeExecutor({ positionSizes: [10], calls });
    assert.equal((await ensureMakerTpOrder({
      ...base, state, executor, now: 300, price: 13, closeReason: "TP", orderLinkId: "maker-link",
    })).outcome, "active");
    const retired = await retireMakerTpToNative({ ...base, state, executor, now: 400 });
    assert.equal(retired.outcome, "cancelled_zero_fill");
    assert.equal(calls.setTp, 1);
    assert.equal(calls.cancel, 1);
    assert.equal(state.getMakerTpOrder(), null);
  } finally { cleanup(file); }
}

async function testDisabledOwnerNormalizesNativeTpBeforeCancellation(): Promise<void> {
  const file = tempState("maker-coord-retire-native-tick-normalized");
  try {
    const state = new StateManager(file);
    seed(state);
    const calls = { cancel: 0, setTp: 0, tpPrices: [] as number[] };
    const executor = fakeExecutor({ positionSizes: [10], priceTick: 0.01, calls });
    assert.equal((await ensureMakerTpOrder({
      ...base,
      state,
      executor,
      now: 300,
      price: 85.76889337533754,
      closeReason: "TP",
      orderLinkId: "maker-link",
    })).outcome, "active");

    const retired = await retireMakerTpToNative({ ...base, state, executor, now: 400 });
    assert.equal(retired.outcome, "cancelled_zero_fill");
    assert.deepEqual(calls.tpPrices, [85.76]);
    assert.equal(calls.cancel, 1);
    assert.equal(state.getMakerTpOrder(), null);
  } finally { cleanup(file); }
}

async function testDisabledOwnerRetainsMakerWhenNativeRestoreUnverified(): Promise<void> {
  const file = tempState("maker-coord-retire-native-unverified");
  try {
    const state = new StateManager(file);
    seed(state);
    const calls = { cancel: 0, setTp: 0 };
    const executor = fakeExecutor({ positionSizes: [10, 10], calls, failProtectionVerification: true });
    assert.equal((await ensureMakerTpOrder({
      ...base, state, executor, now: 300, price: 13, closeReason: "TP", orderLinkId: "maker-link",
    })).outcome, "active");
    const retired = await retireMakerTpToNative({ ...base, state, executor, now: 400 });
    assert.equal(retired.outcome, "pending");
    assert.equal(calls.cancel, 0);
    assert.equal(state.getMakerTpOrder()?.phase, "recovery");
    assert.equal(state.isRecoveryMode(), true);
  } finally { cleanup(file); }
}

async function main(): Promise<void> {
  await testActiveIntentIsDurable();
  await testExplicitRejectClearsZeroFill();
  await testUnknownSubmitRetainsIntentInRecovery();
  await testFullFillCommitsExactlyOnce();
  await testCancelRaceAppliesPartialThenRequiresFallback();
  await testQuantityMismatchFailsClosed();
  await testPartialMakerThenMarketFallbackCombinesOneClose();
  await testFallbackUnknownSurvivesRestartWithPrefix();
  await testZeroFillFallbackPersistsMarketIntentBeforeSubmitResolution();
  await testNativeTpWinsMakerHandoffWithExactEvidence();
  await testNativeTpRaceWithoutExactEvidenceFailsClosed();
  await testMakerPartialThenNativeTpResidualCombinesOnce();
  await testActivePartialStartsDurableFallbackWithoutPriceTouch();
  await testActiveOrderContractMismatchFailsClosed();
  await testContradictoryFilledWithoutEvidenceFailsClosed();
  await testDurableForcedCloseSurvivesCancelCrashWindow();
  await testDisabledOwnerRestoresNativeBeforeCancellation();
  await testDisabledOwnerNormalizesNativeTpBeforeCancellation();
  await testDisabledOwnerRetainsMakerWhenNativeRestoreUnverified();
  console.log("maker TP coordinator tests passed");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
