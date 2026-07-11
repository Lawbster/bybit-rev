import assert from "assert";
import fs from "fs";
import path from "path";
import { StateManager } from "../src/bot/state";
import {
  allocatedForCumulative,
  buildProRataAllocation,
  buildSelectedIdsAllocation,
  PartialCloseIntent,
} from "../src/bot/partial-close-transaction";

function closeEnough(actual: number, expected: number, eps = 1e-8): void {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
}

function tempState(name: string): string {
  const file = path.join("data", `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  const full = path.resolve(process.cwd(), file);
  if (fs.existsSync(full)) fs.unlinkSync(full);
  return file;
}

function cleanup(stateFile: string): void {
  const full = path.resolve(process.cwd(), stateFile);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

function addPos(state: StateManager, idSeed: number, qty: number, entryPrice = 10): void {
  const pos = state.addPosition({
    entryPrice,
    entryTime: 1_700_000_000_000 + idSeed,
    qty,
    notional: qty * entryPrice,
    level: idSeed,
  });
  // Stable IDs make the expected allocation easier to read.
  pos.id = `p${idSeed}`;
  state.save();
}

function selectedIntent(state: StateManager, orderLinkId: string, ids: string[], submittedQty: number): PartialCloseIntent {
  const positions = state.get().positions;
  const allocation = buildSelectedIdsAllocation(positions, ids);
  const preQty = positions.reduce((sum, p) => sum + p.qty, 0);
  return {
    kind: "partial_close",
    action: "close",
    orderLinkId,
    symbol: "HYPEUSDT",
    strategy: "sr_memory",
    actionKey: `sr:${orderLinkId}`,
    createdAt: 1_700_000_100_000,
    preLocalQty: preQty,
    preExchangeQty: preQty,
    requestedQty: submittedQty,
    submittedQty,
    qtyStep: 0.1,
    allocation,
    appliedQty: 0,
    appliedExecNotional: 0,
    lastObservedStatus: "created",
    lastCheckedAt: 0,
    desiredPostCommit: { srCooldownUntil: 1_700_000_200_000 },
  };
}

function proRataIntent(state: StateManager, orderLinkId: string, submittedQty: number): PartialCloseIntent {
  const positions = state.get().positions;
  const allocation = buildProRataAllocation(positions);
  const preQty = positions.reduce((sum, p) => sum + p.qty, 0);
  return {
    kind: "partial_close",
    action: "close",
    orderLinkId,
    symbol: "HYPEUSDT",
    strategy: "pullback_trim",
    actionKey: `pb:${orderLinkId}`,
    createdAt: 1_700_000_100_000,
    preLocalQty: preQty,
    preExchangeQty: preQty,
    requestedQty: submittedQty,
    submittedQty,
    qtyStep: 0.1,
    allocation,
    appliedQty: 0,
    appliedExecNotional: 0,
    lastObservedStatus: "created",
    lastCheckedAt: 0,
    desiredPostCommit: { pullbackActionKey: `pb:${orderLinkId}` },
  };
}

function testSelectedPartialFillLeavesResidual(): void {
  const file = tempState("partial-close-selected");
  try {
    const state = new StateManager(file);
    addPos(state, 1, 40);
    addPos(state, 2, 50);
    addPos(state, 3, 60);
    addPos(state, 4, 33.4);

    state.beginPartialClose(selectedIntent(state, "reduce-1", ["p1", "p2", "p3", "p4"], 183.4));
    const result = state.applyObservedPartialFill("reduce-1", 183.3, 183.3 * 11, "Filled", 1_700_000_101_000, 0.00055);
    closeEnough(result.deltaQty, 183.3);

    const remaining = state.get().positions;
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, "p4");
    closeEnough(remaining[0].qty, 0.1, 1e-7);
    closeEnough(remaining[0].notional, 1, 1e-6);

    const noOp = state.applyObservedPartialFill("reduce-1", 183.3, 183.3 * 11, "Filled", 1_700_000_102_000, 0.00055);
    closeEnough(noOp.deltaQty, 0);
    closeEnough(state.get().positions[0].qty, 0.1, 1e-7);

    const receipt = state.finalizePartialClose("reduce-1", "Filled", 1_700_000_103_000);
    assert.equal(receipt.filledQty, 183.3);
    assert.equal(state.get().pendingOrder, null);
    assert.equal(state.hasCompletedPartialAction("sr:reduce-1"), true);
    assert.equal(state.get().totalBatchCloses, 1);
  } finally {
    cleanup(file);
  }
}

function testProRataIncrementalEqualsOneShot(): void {
  const fileA = tempState("partial-close-prorata-a");
  const fileB = tempState("partial-close-prorata-b");
  try {
    const a = new StateManager(fileA);
    const b = new StateManager(fileB);
    for (const state of [a, b]) {
      addPos(state, 1, 10);
      addPos(state, 2, 30);
      addPos(state, 3, 60);
    }

    a.beginPartialClose(proRataIntent(a, "reduce-a", 50));
    a.applyObservedPartialFill("reduce-a", 20, 220, "PartiallyFilled", 1, 0.00055);
    a.applyObservedPartialFill("reduce-a", 50, 550, "Filled", 2, 0.00055);

    b.beginPartialClose(proRataIntent(b, "reduce-b", 50));
    b.applyObservedPartialFill("reduce-b", 50, 550, "Filled", 2, 0.00055);

    const aq = a.get().positions.map(p => p.qty);
    const bq = b.get().positions.map(p => p.qty);
    assert.deepEqual(aq.map(q => +q.toFixed(10)), bq.map(q => +q.toFixed(10)));
    closeEnough(aq.reduce((sum, q) => sum + q, 0), 50);
  } finally {
    cleanup(fileA);
    cleanup(fileB);
  }
}

function testRejectZeroFillClearsWithoutReceipt(): void {
  const file = tempState("partial-close-reject");
  try {
    const state = new StateManager(file);
    addPos(state, 1, 10);
    state.beginPartialClose(proRataIntent(state, "reduce-zero", 5));
    state.rejectPartialClose("reduce-zero", "Rejected", 1_700_000_101_000);
    assert.equal(state.get().pendingOrder, null);
    assert.equal(state.hasCompletedPartialAction("pb:reduce-zero"), false);
    assert.equal(state.get().positions.length, 1);
    closeEnough(state.get().positions[0].qty, 10);
  } finally {
    cleanup(file);
  }
}

function testAllocationPureFunctions(): void {
  const positions = [
    { id: "a", entryPrice: 1, entryTime: 1, qty: 1, notional: 1, level: 0 },
    { id: "b", entryPrice: 1, entryTime: 1, qty: 3, notional: 3, level: 1 },
  ];
  const allocation = buildProRataAllocation(positions);
  assert.deepEqual(allocatedForCumulative(allocation, 2), [
    { positionId: "a", closeQty: 0.5 },
    { positionId: "b", closeQty: 1.5 },
  ]);
}

testSelectedPartialFillLeavesResidual();
testProRataIncrementalEqualsOneShot();
testRejectZeroFillClearsWithoutReceipt();
testAllocationPureFunctions();

console.log("partial-close transaction tests passed");
