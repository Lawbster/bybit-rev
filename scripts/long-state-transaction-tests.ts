import assert from "assert";
import fs from "fs";
import path from "path";
import { FullCloseIntent, LongOpenIntent } from "../src/bot/long-transaction";
import { buildProRataAllocation } from "../src/bot/partial-close-transaction";
import { StateManager } from "../src/bot/state";

function tempState(name: string): string {
  return path.join("data", `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

function cleanup(stateFile: string): void {
  const full = path.resolve(process.cwd(), stateFile);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

function closeEnough(actual: number, expected: number, eps = 1e-8): void {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
}

function addPos(state: StateManager, id: string, qty: number, entryPrice: number, entryTime: number): void {
  const position = state.addPosition({
    entryPrice,
    entryTime,
    qty,
    notional: qty * entryPrice,
    level: state.get().positions.length,
  });
  position.id = id;
  state.save();
}

function openIntent(orderLinkId: string): LongOpenIntent {
  return {
    kind: "long_open",
    action: "open",
    orderLinkId,
    symbol: "HYPEUSDT",
    createdAt: 1_700_000_000_000,
    level: 2,
    requestedNotional: 125,
    preLocalQty: 5,
    preExchangeQty: 5,
    qtyStep: 0.01,
    lastObservedStatus: "created",
    lastCheckedAt: 0,
  };
}

function fullCloseIntent(state: StateManager, orderLinkId: string): FullCloseIntent {
  const qty = state.get().positions.reduce((sum, pos) => sum + pos.qty, 0);
  return {
    kind: "full_close",
    action: "close",
    orderLinkId,
    symbol: "HYPEUSDT",
    createdAt: 1_700_000_100_000,
    reason: "test",
    preLocalQty: qty,
    preExchangeQty: qty,
    qtyStep: 0.01,
    allocation: buildProRataAllocation(state.get().positions),
    prePositionCount: state.get().positions.length,
    preAvgEntry: state.get().positions.reduce((sum, pos) => sum + pos.entryPrice * pos.qty, 0) / qty,
    appliedQty: 0,
    appliedExecNotional: 0,
    appliedPnl: 0,
    appliedFees: 0,
    lastObservedStatus: "created",
    lastCheckedAt: 0,
  };
}

function testOpenCommitIsAtomicAndReplaySafe(): void {
  const file = tempState("long-open-atomic");
  try {
    const state = new StateManager(file);
    state.beginLongOpen(openIntent("open-1"));
    state.enterTransactionRecovery("open-1");
    const first = state.commitPendingLongOpen("open-1", {
      orderId: "exchange-open-1",
      status: "Filled",
      filledQty: 10,
      cumulativeExecNotional: 125,
      avgPrice: 12.5,
      executionIds: ["exec-open-1"],
    }, 1_700_000_000_500);
    assert.equal(first.replayed, false);

    const reloaded = new StateManager(file);
    assert.equal(reloaded.get().pendingOrder, null);
    assert.equal(reloaded.get().positions.length, 1);
    assert.equal(reloaded.get().positions[0].id, "pos_open-1");
    assert.equal(reloaded.get().positions[0].orderId, "exchange-open-1");
    assert.equal(reloaded.get().positions[0].orderLinkId, "open-1");
    closeEnough(reloaded.get().positions[0].qty, 10);
    assert.equal(reloaded.getCompletedLongTransaction("open-1")?.executionIds[0], "exec-open-1");

    const replay = reloaded.commitPendingLongOpen("open-1", {
      orderId: "exchange-open-1",
      status: "Filled",
      filledQty: 10,
      cumulativeExecNotional: 125,
      avgPrice: 12.5,
    }, 1_700_000_000_600);
    assert.equal(replay.replayed, true);
    assert.equal(reloaded.get().positions.length, 1);
    assert.equal(reloaded.isRecoveryMode(), true);
    assert.equal(reloaded.clearTransactionRecovery("open-1"), true);
    assert.equal(reloaded.isRecoveryMode(), false);
  } finally {
    cleanup(file);
  }
}

function testFullCloseIncrementalPartialIsIdempotent(): void {
  const file = tempState("long-close-partial");
  try {
    const state = new StateManager(file);
    addPos(state, "p1", 4, 10, 100);
    addPos(state, "p2", 6, 10, 200);
    state.setDesiredLongTp({ price: 12, positionQtyBasis: 10, activeTpPct: 1, updatedAt: 300, syncStatus: "confirmed" });
    state.beginFullClose(fullCloseIntent(state, "close-partial"));
    state.enterTransactionRecovery("close-partial");

    const first = state.applyObservedFullCloseFill("close-partial", 2, 24, "PartiallyFilled", 400, 0);
    closeEnough(first.deltaQty, 2);
    closeEnough(first.remainingQty, 8);
    closeEnough(state.get().realizedPnl, 4);
    assert.equal(state.getDesiredLongTp(), null);
    assert.equal(state.get().lastAddTime, 200);

    const reloaded = new StateManager(file);
    const replay = reloaded.applyObservedFullCloseFill("close-partial", 2, 24, "PartiallyFilled", 500, 0);
    closeEnough(replay.deltaQty, 0);
    closeEnough(reloaded.get().realizedPnl, 4);

    const second = reloaded.applyObservedFullCloseFill("close-partial", 5, 60, "PartiallyFilledCanceled", 600, 0);
    closeEnough(second.deltaQty, 3);
    closeEnough(second.remainingQty, 5);
    closeEnough(reloaded.get().realizedPnl, 10);
    const finalized = reloaded.finalizePendingFullClose(
      "close-partial",
      "partial_terminal",
      "exchange-close-partial",
      "PartiallyFilledCanceled",
      ["exec-close-1", "exec-close-2"],
      700,
    );
    assert.equal(finalized.replayed, false);

    const finalReload = new StateManager(file);
    assert.equal(finalReload.get().pendingOrder, null);
    closeEnough(finalReload.get().positions.reduce((sum, pos) => sum + pos.qty, 0), 5);
    closeEnough(finalReload.get().realizedPnl, 10);
    assert.equal(finalReload.get().totalBatchCloses, 1);
    assert.equal(finalReload.getCompletedLongTransaction("close-partial")?.outcome, "partial_terminal");
    assert.equal(finalReload.isRecoveryMode(), true);
    assert.equal(finalReload.clearTransactionRecovery("close-partial"), true);
  } finally {
    cleanup(file);
  }
}

function testFullCloseCrashBetweenApplyAndFinalizeDoesNotDoubleCount(): void {
  const file = tempState("long-close-replay");
  try {
    const state = new StateManager(file);
    addPos(state, "p1", 4, 10, 100);
    addPos(state, "p2", 6, 10, 200);
    state.beginFullClose(fullCloseIntent(state, "close-full"));
    state.applyObservedFullCloseFill("close-full", 10, 120, "Filled", 300, 0);
    closeEnough(state.get().realizedPnl, 20);
    assert.equal(state.get().totalBatchCloses, 0);
    assert.equal(state.get().positions.length, 0);

    const afterCrash = new StateManager(file);
    const replayApply = afterCrash.applyObservedFullCloseFill("close-full", 10, 120, "Filled", 400, 0);
    closeEnough(replayApply.deltaQty, 0);
    closeEnough(afterCrash.get().realizedPnl, 20);
    afterCrash.finalizePendingFullClose("close-full", "committed", "exchange-close-full", "Filled", ["exec-full"], 500);

    const finalized = new StateManager(file);
    closeEnough(finalized.get().realizedPnl, 20);
    assert.equal(finalized.get().totalBatchCloses, 1);
    const replayFinalize = finalized.finalizePendingFullClose("close-full", "committed", "exchange-close-full", "Filled", ["exec-full"], 600);
    assert.equal(replayFinalize.replayed, true);
    assert.equal(finalized.get().totalBatchCloses, 1);
  } finally {
    cleanup(file);
  }
}

function testRejectAndPendingExclusivity(): void {
  const file = tempState("long-reject");
  try {
    const state = new StateManager(file);
    state.beginLongOpen(openIntent("open-reject"));
    assert.throws(() => state.beginLongOpen(openIntent("open-other")), /pending order/);
    const receipt = state.rejectPendingLongTransaction("open-reject", "", "Rejected", 100);
    assert.equal(receipt.outcome, "rejected");
    assert.equal(state.get().pendingOrder, null);
    assert.equal(state.get().positions.length, 0);
    const replay = state.rejectPendingLongTransaction("open-reject", "", "Rejected", 200);
    assert.equal(replay.completedAt, 100);
  } finally {
    cleanup(file);
  }
}

function testFullCloseFeesAndReceiptTotals(): void {
  const file = tempState("long-close-fees");
  try {
    const state = new StateManager(file);
    addPos(state, "p1", 10, 10, 100);
    state.beginFullClose(fullCloseIntent(state, "close-fees"));
    const applied = state.applyObservedFullCloseFill("close-fees", 4, 48, "PartiallyFilledCanceled", 200, 0.001);
    closeEnough(applied.totalFees, 0.088);
    closeEnough(applied.totalPnl, 7.912);
    const finalized = state.finalizePendingFullClose(
      "close-fees", "partial_terminal", "exchange-close-fees", "PartiallyFilledCanceled", ["fee-e1"], 300,
    );
    closeEnough(finalized.receipt.totalFees, 0.088);
    closeEnough(finalized.receipt.totalPnl, 7.912);
    closeEnough(state.get().totalFees, 0.088);
    closeEnough(state.get().realizedPnl, 7.912);
    assert.equal(state.get().totalBatchCloses, 1);
  } finally {
    cleanup(file);
  }
}

function testVersionTwoStateLoadsWithTransactionDefaults(): void {
  const file = tempState("long-state-v2-migration");
  try {
    const full = path.resolve(process.cwd(), file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify({
      version: 2,
      positions: [],
      realizedPnl: 0,
      totalFees: 0,
      pendingOrder: null,
    }));
    const state = new StateManager(file);
    assert.equal(state.get().version, 3);
    assert.deepEqual(state.get().completedLongTransactions, []);
    assert.equal(state.get().recoveryOwnerOrderLinkId, null);
  } finally {
    cleanup(file);
  }
}

testOpenCommitIsAtomicAndReplaySafe();
testFullCloseIncrementalPartialIsIdempotent();
testFullCloseCrashBetweenApplyAndFinalizeDoesNotDoubleCount();
testRejectAndPendingExclusivity();
testFullCloseFeesAndReceiptTotals();
testVersionTwoStateLoadsWithTransactionDefaults();

console.log("long state transaction tests passed");
