import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  ClosedPnlEvidence,
  InstrumentLotInfo,
  ShortCloseExecutionEvidence,
  ShortExecutionResult,
  ShortPositionSnapshot,
  ShortProtectionResult,
  TransactionalShortExecutor,
} from "../src/bot/executor";
import { HL_SHORT_BREAKDOWN_POLICY } from "../src/bot/hl-short-breakdown-policy";
import { HlShortLiveStateStore } from "../src/bot/hl-short-live-state";
import { HlShortTransactionCoordinator } from "../src/bot/hl-short-transaction-coordinator";

const NOW = 2_000_000_000_000;
const LOT: InstrumentLotInfo = { qtyStep: 0.01, minOrderQty: 0.01, qtyDecimals: 2 };

function execution(overrides: Partial<ShortExecutionResult> = {}): ShortExecutionResult {
  return {
    outcome: "terminal",
    orderId: "order-open",
    orderLinkId: "",
    status: "Filled",
    terminal: true,
    submittedQty: 400,
    quotePrice: 62.5,
    cumExecQty: 400,
    cumExecNotional: 25_000,
    cumExecFee: 13.75,
    avgPrice: 62.5,
    remainingShortQty: 400,
    qtyStep: LOT.qtyStep,
    executionIds: ["exec-open"],
    ...overrides,
  };
}

class FakeShortExecutor implements TransactionalShortExecutor {
  hedgeMode = true;
  position: ShortPositionSnapshot = { size: 0, avgPrice: 0, takeProfit: 0, stopLoss: 0, positionIdx: 2, updatedTime: NOW };
  openResult: ShortExecutionResult | null = null;
  closeResult: ShortExecutionResult | null = null;
  observedResult: ShortExecutionResult | null = null;
  protectionSuccess = true;
  protectionCalls = 0;
  closeCalls = 0;
  recentExecutions: ShortCloseExecutionEvidence[] = [];
  recentClosedPnl: ClosedPnlEvidence[] = [];

  async ensureHedgeMode(): Promise<boolean> { return this.hedgeMode; }
  async getInstrumentLotInfo(): Promise<InstrumentLotInfo> { return LOT; }
  async getShortPositionSnapshot(): Promise<ShortPositionSnapshot> { return { ...this.position }; }

  async openShortDetailed(
    _symbol: string,
    _notional: number,
    _leverage: number,
    orderLinkId: string,
  ): Promise<ShortExecutionResult> {
    const result = { ...(this.openResult ?? execution()), orderLinkId };
    if (result.terminal && result.cumExecQty > 0) {
      this.position = { ...this.position, size: result.remainingShortQty ?? result.cumExecQty, avgPrice: result.avgPrice ?? 0 };
    }
    return result;
  }

  async closeShortDetailed(_symbol: string, expectedQty: number, orderLinkId: string): Promise<ShortExecutionResult> {
    this.closeCalls++;
    const result = { ...(this.closeResult ?? execution({
      orderId: "order-close",
      cumExecQty: expectedQty,
      cumExecNotional: expectedQty * 61,
      cumExecFee: expectedQty * 61 * 0.00055,
      avgPrice: 61,
      remainingShortQty: 0,
      executionIds: ["exec-close"],
    })), orderLinkId };
    if (result.terminal && result.cumExecQty > 0 && result.remainingShortQty !== null) {
      this.position = { ...this.position, size: result.remainingShortQty };
    }
    return result;
  }

  async observeShortOrder(_symbol: string, orderLinkId: string): Promise<ShortExecutionResult> {
    return { ...(this.observedResult ?? execution({ outcome: "unknown", status: "not_found", terminal: false, cumExecQty: 0, cumExecNotional: null, cumExecFee: 0, avgPrice: null, remainingShortQty: this.position.size, executionIds: [] })), orderLinkId };
  }

  async setShortPositionProtection(_symbol: string, takeProfit: number, stopLoss: number): Promise<ShortProtectionResult> {
    this.protectionCalls++;
    if (!this.protectionSuccess) {
      return { success: false, status: "failed", takeProfit, stopLoss, tickSize: 0.001, error: "simulated protection failure" };
    }
    this.position = { ...this.position, takeProfit, stopLoss };
    return { success: true, status: "confirmed", takeProfit, stopLoss, tickSize: 0.001 };
  }

  async queryRecentShortCloseExecutions(): Promise<ShortCloseExecutionEvidence[]> { return this.recentExecutions; }
  async queryRecentShortClosedPnl(): Promise<ClosedPnlEvidence[]> { return this.recentClosedPnl; }
  async queryRecentClosedPnl(): Promise<ClosedPnlEvidence[]> { return []; }
}

function harness(): {
  dir: string;
  store: HlShortLiveStateStore;
  executor: FakeShortExecutor;
  coordinator: HlShortTransactionCoordinator;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hl-short-tx-"));
  const store = new HlShortLiveStateStore(path.join(dir, "state.json"), NOW);
  const executor = new FakeShortExecutor();
  const coordinator = new HlShortTransactionCoordinator(store, executor, { leverage: 25, feeRate: 0.00055 });
  return { dir, store, executor, coordinator };
}

async function openPosition(h: ReturnType<typeof harness>, now = NOW): Promise<void> {
  const result = await h.coordinator.executeOpen(`hlbp-HYPEUSDT-${now}`, now, 25_000, now);
  assert.equal(result.outcome, "committed");
  assert.equal(h.store.get().pending, null);
  assert.equal(h.store.get().position?.qty, 400);
  assert.equal(h.store.get().position?.protectionStatus, "confirmed");
}

async function main(): Promise<void> {
  {
    const h = harness();
    await openPosition(h);
    const position = h.store.get().position!;
    assert.equal(position.entryTime, NOW, "maximum hold starts from durable intent time");
    assert.equal(position.expiresAt, NOW + HL_SHORT_BREAKDOWN_POLICY.maximumHoldMs);
    assert.equal(position.takeProfit, 61.25);
    assert.equal(position.stopLoss, 65);
    assert.equal(h.store.get().receipts.filter(row => row.kind === "short_open").length, 1);
    await h.coordinator.reconcile(NOW + 5_000);
    assert.equal(h.executor.protectionCalls, 1, "confirmed exchange bracket is verified without recreating it every poll");
    fs.rmSync(h.dir, { recursive: true, force: true });
  }

  {
    const h = harness();
    await openPosition(h);
    h.executor.closeResult = execution({
      outcome: "unknown", orderId: "", status: "submit_unknown", terminal: false,
      cumExecQty: 0, cumExecNotional: null, cumExecFee: 0, avgPrice: null,
      remainingShortQty: 400, executionIds: [],
    });
    const first = await h.coordinator.executeClose("manual", NOW + 1_000);
    assert.equal(first.outcome, "pending");
    assert.ok(h.store.get().pending, "unknown close submit retains durable close intent");
    assert.equal(h.store.get().position?.qty, 400);

    h.executor.position = { ...h.executor.position, size: 0 };
    h.executor.observedResult = execution({
      orderId: "resolved-close",
      cumExecQty: 400,
      cumExecNotional: 24_400,
      cumExecFee: 13.42,
      avgPrice: 61,
      remainingShortQty: 0,
      executionIds: ["resolved-close-exec"],
    });
    const reloaded = new HlShortLiveStateStore(path.join(h.dir, "state.json"), NOW + 5_000);
    const restarted = new HlShortTransactionCoordinator(reloaded, h.executor, { leverage: 25, feeRate: 0.00055 });
    const resolved = await restarted.resolvePending(NOW + 5_000);
    assert.equal(resolved.outcome, "committed");
    assert.equal(reloaded.get().pending, null);
    assert.equal(reloaded.get().position, null);
    const receiptCount = reloaded.get().receipts.length;
    await restarted.reconcile(NOW + 10_000);
    assert.equal(reloaded.get().receipts.length, receiptCount, "resolved close is not double-applied after restart");
    fs.rmSync(h.dir, { recursive: true, force: true });
  }

  {
    const h = harness();
    await openPosition(h);
    h.executor.closeResult = execution({
      orderId: "partial-close",
      cumExecQty: 100,
      cumExecNotional: 6_100,
      cumExecFee: 3.355,
      avgPrice: 61,
      remainingShortQty: 300,
      executionIds: ["partial-close-exec"],
    });
    const result = await h.coordinator.executeClose("manual", NOW + 1_000);
    assert.equal(result.outcome, "partial_terminal");
    assert.equal(h.store.get().position?.qty, 300);
    assert.equal(h.store.get().position?.protectionStatus, "pending");
    assert.equal(h.store.get().pending, null);
    assert.equal(h.store.get().recoveryMode, true);
    const reconciled = await h.coordinator.reconcile(NOW + 2_000);
    assert.equal(reconciled.status, "short_synced_and_protected");
    assert.equal(h.store.get().position?.protectionStatus, "confirmed");
    assert.equal(h.store.get().recoveryMode, false);
    fs.rmSync(h.dir, { recursive: true, force: true });
  }

  {
    const h = harness();
    await openPosition(h);
    h.executor.position = { ...h.executor.position, size: 0, takeProfit: 0, stopLoss: 0 };
    h.executor.recentClosedPnl = [{
      orderId: "native-pnl-order",
      side: "Buy",
      updatedTime: NOW + 60_000,
      closedSize: 400,
      avgExitPrice: 65,
      closedPnl: -1_015,
      openFee: 13.75,
      closeFee: 14.3,
    }];
    const result = await h.coordinator.reconcile(NOW + 60_000);
    assert.equal(result.status, "native_closed_pnl_evidence");
    assert.equal(h.store.get().position, null);
    assert.equal(h.store.get().realizedPnl, -1_015, "closed-PnL fallback is applied as exchange net truth");
    fs.rmSync(h.dir, { recursive: true, force: true });
  }

  {
    const h = harness();
    h.executor.openResult = execution({
      outcome: "unknown", status: "submit_unknown", terminal: false, orderId: "", cumExecQty: 0,
      cumExecNotional: null, cumExecFee: 0, avgPrice: null, remainingShortQty: null, executionIds: [],
    });
    const first = await h.coordinator.executeOpen(`hlbp-HYPEUSDT-${NOW}`, NOW, 25_000, NOW);
    assert.equal(first.outcome, "pending");
    assert.ok(h.store.get().pending, "unknown submit retains durable intent");
    assert.equal(h.store.get().recoveryMode, true);

    h.executor.position = { ...h.executor.position, size: 400, avgPrice: 62.5 };
    h.executor.observedResult = execution({ orderLinkId: h.store.get().pending!.orderLinkId });
    const reloaded = new HlShortLiveStateStore(path.join(h.dir, "state.json"), NOW + 10_000);
    const restarted = new HlShortTransactionCoordinator(reloaded, h.executor, { leverage: 25, feeRate: 0.00055 });
    const resolved = await restarted.resolvePending(NOW + 10_000);
    assert.equal(resolved.outcome, "committed");
    assert.equal(reloaded.get().pending, null);
    assert.equal(reloaded.get().position?.qty, 400);
    assert.equal(reloaded.get().position?.entryTime, NOW, "restart does not extend maximum hold");
    assert.equal(reloaded.get().recoveryMode, false);
    fs.rmSync(h.dir, { recursive: true, force: true });
  }

  {
    const h = harness();
    h.executor.openResult = execution({ remainingShortQty: 0 });
    h.executor.recentExecutions = [{
      execId: "instant-native-exec",
      orderId: "instant-native-stop",
      orderLinkId: "",
      execTime: NOW + 500,
      closedSize: 400,
      execQty: 400,
      execPrice: 65,
      execFee: 14.3,
    }];
    const result = await h.coordinator.executeOpen(`hlbp-HYPEUSDT-${NOW}`, NOW, 25_000, NOW + 1_000);
    assert.equal(result.outcome, "committed", "immediate provisional TP/SL close is imported from exact evidence");
    assert.equal(h.store.get().pending, null);
    assert.equal(h.store.get().position, null);
    assert.equal(h.store.get().receipts.filter(row => row.kind === "short_open").length, 1);
    assert.equal(h.store.get().receipts.filter(row => row.outcome === "native_close").length, 1);
    fs.rmSync(h.dir, { recursive: true, force: true });
  }

  {
    const h = harness();
    h.executor.openResult = execution({
      outcome: "rejected", status: "submit_rejected", terminal: true, orderId: "", cumExecQty: 0,
      cumExecNotional: null, cumExecFee: 0, avgPrice: null, remainingShortQty: 0, executionIds: [], error: "rejected",
    });
    const result = await h.coordinator.executeOpen(`hlbp-HYPEUSDT-${NOW}`, NOW, 25_000, NOW);
    assert.equal(result.outcome, "rejected");
    assert.equal(h.store.get().pending, null);
    assert.equal(h.store.get().position, null);
    assert.equal(h.store.get().recoveryMode, false);
    fs.rmSync(h.dir, { recursive: true, force: true });
  }

  {
    const h = harness();
    await openPosition(h);
    const realizedBefore = h.store.get().realizedPnl;
    h.executor.position = { ...h.executor.position, size: 0, takeProfit: 0, stopLoss: 0 };
    h.executor.recentExecutions = [{
      execId: "native-exec",
      orderId: "native-tp-order",
      orderLinkId: "",
      execTime: NOW + 60_000,
      closedSize: 400,
      execQty: 400,
      execPrice: 61.25,
      execFee: 13.475,
    }];
    const result = await h.coordinator.reconcile(NOW + 60_000);
    assert.equal(result.outcome, "committed");
    assert.equal(h.store.get().position, null);
    assert.ok(h.store.get().realizedPnl > realizedBefore);
    const receiptCount = h.store.get().receipts.length;
    await h.coordinator.reconcile(NOW + 65_000);
    assert.equal(h.store.get().receipts.length, receiptCount, "native close evidence is receipted exactly once");
    fs.rmSync(h.dir, { recursive: true, force: true });
  }

  {
    const h = harness();
    await openPosition(h);
    h.executor.position = { ...h.executor.position, size: 399 };
    const result = await h.coordinator.executeClose("manual", NOW + 1_000);
    assert.equal(result.outcome, "recovery");
    assert.equal(result.status, "pre_close_qty_mismatch");
    assert.equal(h.store.get().pending, null, "mismatch is checked before writing a fake close intent");
    assert.equal(h.executor.closeCalls, 0);
    fs.rmSync(h.dir, { recursive: true, force: true });
  }

  {
    const h = harness();
    await openPosition(h);
    h.executor.protectionSuccess = false;
    h.executor.position = { ...h.executor.position, takeProfit: 0, stopLoss: 0 };
    assert.equal((await h.coordinator.reconcile(NOW + 1_000)).outcome, "recovery");
    assert.equal((await h.coordinator.reconcile(NOW + 2_000)).outcome, "recovery");
    const third = await h.coordinator.reconcile(NOW + 3_000);
    assert.equal(third.outcome, "committed", "third failed protection confirmation flattens transactionally");
    assert.equal(h.executor.closeCalls, 1);
    assert.equal(h.store.get().position, null);
    assert.equal(h.store.get().pending, null);
    fs.rmSync(h.dir, { recursive: true, force: true });
  }

  {
    const h = harness();
    h.executor.position = { ...h.executor.position, size: 100, avgPrice: 62 };
    const result = await h.coordinator.reconcile(NOW);
    assert.equal(result.outcome, "recovery");
    assert.equal(result.status, "orphan_exchange_short");
    assert.equal(h.store.get().position, null, "orphan exchange short is never silently imported");
    fs.rmSync(h.dir, { recursive: true, force: true });
  }

  console.log("hl short transaction coordinator tests passed");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
