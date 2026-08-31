import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { MakerTpOrderState } from "../src/bot/maker-tp-transaction";
import { buildProRataAllocation } from "../src/bot/partial-close-transaction";
import { StateManager } from "../src/bot/state";

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

function intent(state: StateManager, orderLinkId = "maker-1"): MakerTpOrderState {
  const positions = state.get().positions;
  return {
    version: 2,
    symbol: "HYPEUSDT",
    orderLinkId,
    orderId: "",
    phase: "intent_persisted",
    closeReason: "TP",
    activeTpPct: 1.4,
    price: 13,
    exchangePrice: null,
    requestedQty: 10,
    submittedQty: null,
    qtyStep: 0.01,
    priceTick: 0.001,
    allocation: buildProRataAllocation(positions),
    prePositionCount: positions.length,
    preAvgEntry: 11.2,
    preOldestEntryTime: 100,
    createdAt: 300,
    updatedAt: 300,
    touchedAt: null,
    fallbackDeadlineAt: null,
    closeRequest: null,
    lastObservedStatus: "intent_persisted",
    lastCheckedAt: 300,
    makerCumExecQty: 0,
    makerCumExecNotional: 0,
    appliedQty: 0,
    appliedExecNotional: 0,
    appliedPnl: 0,
    appliedFees: 0,
    executionIds: [],
  };
}

function approx(actual: number, expected: number, tolerance = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function testDurablePartialFillAndReplay(): void {
  const file = tempState("maker-state-partial");
  try {
    const state = new StateManager(file);
    seed(state);
    state.setDesiredLongTp({
      price: 13,
      positionQtyBasis: 10,
      activeTpPct: 1.4,
      updatedAt: 300,
      syncStatus: "confirmed",
    });
    state.beginMakerTpOrder(intent(state));
    state.markMakerTpOrder("maker-1", {
      orderId: "exchange-maker-1",
      phase: "active",
      status: "New",
      checkedAt: 310,
    });

    const first = state.applyObservedMakerTpFill(
      "maker-1", 4, 52, ["exec-1"], "PartiallyFilled", 320, 0.00055, 0.0002,
    );
    approx(first.deltaQty, 4);
    approx(first.fillPrice!, 13);
    approx(first.remainingQty, 6);
    approx(state.getDesiredLongTp()?.positionQtyBasis ?? 0, 6);
    const pnlAfterFirst = state.get().realizedPnl;
    const feesAfterFirst = state.get().totalFees;

    const reloaded = new StateManager(file);
    const replay = reloaded.applyObservedMakerTpFill(
      "maker-1", 4, 52, ["exec-1"], "PartiallyFilled", 330, 0.00055, 0.0002,
    );
    assert.equal(replay.deltaQty, 0);
    approx(reloaded.get().realizedPnl, pnlAfterFirst);
    approx(reloaded.get().totalFees, feesAfterFirst);

    const second = reloaded.applyObservedMakerTpFill(
      "maker-1", 6, 78, ["exec-1", "exec-2"], "Cancelled", 340, 0.00055, 0.0002,
    );
    approx(second.deltaQty, 2);
    approx(second.remainingQty, 4);
    const finalized = reloaded.finalizeMakerTpOrder("maker-1", "partial_committed", "Cancelled", 350);
    assert.equal(finalized.receipt.filledQty, 6);
    assert.deepEqual(finalized.receipt.executionIds, ["exec-1", "exec-2"]);
    assert.equal(reloaded.getMakerTpOrder(), null);
    assert.equal(reloaded.get().totalBatchCloses, 0);

    const afterFinalizeReload = new StateManager(file);
    assert.equal(afterFinalizeReload.getCompletedMakerTpOrder("maker-1")?.filledQty, 6);
  } finally {
    cleanup(file);
  }
}

function testFullFillAndZeroFillFinalization(): void {
  const fullFile = tempState("maker-state-full");
  const zeroFile = tempState("maker-state-zero");
  try {
    const full = new StateManager(fullFile);
    seed(full);
    full.beginMakerTpOrder(intent(full, "maker-full"));
    const applied = full.applyObservedMakerTpFill(
      "maker-full", 10, 130, ["full-1"], "Filled", 400, 0.00055, 0.0002,
    );
    approx(applied.remainingQty, 0);
    const finalized = full.finalizeMakerTpOrder("maker-full", "full_committed", "Filled", 410);
    assert.equal(finalized.receipt.positionsClosed, 2);
    assert.equal(full.get().positions.length, 0);
    assert.equal(full.get().totalBatchCloses, 1);

    const zero = new StateManager(zeroFile);
    seed(zero);
    zero.beginMakerTpOrder(intent(zero, "maker-zero"));
    const cancelled = zero.finalizeMakerTpOrder("maker-zero", "cancelled_zero_fill", "Cancelled", 500);
    assert.equal(cancelled.receipt.filledQty, 0);
    assert.equal(zero.get().positions.length, 2);
    assert.equal(zero.get().totalBatchCloses, 0);
  } finally {
    cleanup(fullFile);
    cleanup(zeroFile);
  }
}

function testInvalidEvidenceFailsWithoutMutation(): void {
  const file = tempState("maker-state-invalid");
  try {
    const state = new StateManager(file);
    seed(state);
    state.beginMakerTpOrder(intent(state, "maker-invalid"));
    assert.throws(() => state.applyObservedMakerTpFill(
      "maker-invalid", 11, 143, ["overfill"], "Filled", 600, 0.00055, 0.0002,
    ), /overfill/);
    assert.equal(state.get().positions.length, 2);
    assert.equal(state.get().positions.reduce((sum, pos) => sum + pos.qty, 0), 10);
    assert.equal(state.get().realizedPnl, 0);
  } finally {
    cleanup(file);
  }
}

function main(): void {
  testDurablePartialFillAndReplay();
  testFullFillAndZeroFillFinalization();
  testInvalidEvidenceFailsWithoutMutation();
  console.log("maker TP transaction state tests passed");
}

main();
