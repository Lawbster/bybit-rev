import * as assert from "assert";
import {
  finalizeCommittedFullClose,
  isTpLifecycleClose,
} from "../src/bot/long-close-finalizer";
import type { LongTransactionResult } from "../src/bot/long-transaction-coordinator";

function committed(overrides: Partial<LongTransactionResult> = {}): LongTransactionResult {
  return {
    outcome: "committed",
    kind: "full_close",
    orderLinkId: "close-1",
    orderId: "order-1",
    status: "external_execution_evidence",
    filledQty: 26.78,
    avgPrice: 71.21,
    totalPnl: 25.685,
    totalFees: 2.082,
    positionsClosed: 2,
    remainingQty: 0,
    preAvgEntry: 70.1731,
    prePositionCount: 2,
    synced: true,
    closeReason: "NATIVE_TP",
    ...overrides,
  };
}

async function testNativeTpRunsCompleteLifecycle(): Promise<void> {
  const calls: string[] = [];
  let audit: any = null;
  let notification: any = null;
  await finalizeCommittedFullClose(
    committed(),
    {
      requestedReason: "TP",
      preRungs: 2,
      preAvgEntry: 70.1731,
      preOldestEntryTime: 1_000,
    },
    {
      refreshCapital: async () => { calls.push("capital"); },
      recordClose: record => { calls.push("audit"); audit = record; },
      notifyClose: async notice => { calls.push("notify"); notification = notice; },
      clearOneShotOverride: () => { calls.push("override"); },
      closeLadderHedge: async () => { calls.push("hedge"); },
      clearRecovery: async () => { calls.push("recovery"); },
      applyTpCooldown: () => { calls.push("cooldown"); },
    },
    3_601_000,
  );

  assert.deepStrictEqual(calls, ["capital", "audit", "notify", "override", "hedge", "recovery", "cooldown"]);
  assert.strictEqual(audit.closeReason, "NATIVE_TP");
  assert.strictEqual(audit.exitPrice, 71.21);
  assert.strictEqual(notification.reason, "TP");
  assert.strictEqual(notification.holdHours, 1);
}

async function testNonTpCloseSkipsTpOnlyEffects(): Promise<void> {
  const calls: string[] = [];
  await finalizeCommittedFullClose(
    committed({ closeReason: "HARD FLATTEN" }),
    {
      requestedReason: "HARD FLATTEN",
      preRungs: 2,
      preAvgEntry: 70,
      preOldestEntryTime: 1_000,
    },
    {
      refreshCapital: async () => { calls.push("capital"); },
      recordClose: () => { calls.push("audit"); },
      notifyClose: async () => { calls.push("notify"); },
      clearOneShotOverride: () => { calls.push("override"); },
      closeLadderHedge: async () => { calls.push("hedge"); },
      clearRecovery: async () => { calls.push("recovery"); },
      applyTpCooldown: () => { calls.push("cooldown"); },
    },
    2_000,
  );
  assert.deepStrictEqual(calls, ["capital", "audit", "notify", "hedge", "recovery"]);
}

async function testUnresolvedCloseCannotFinalize(): Promise<void> {
  await assert.rejects(
    finalizeCommittedFullClose(
      committed({ outcome: "pending", remainingQty: 26.78, synced: false }),
      { requestedReason: "TP", preRungs: 2, preAvgEntry: 70, preOldestEntryTime: 1_000 },
      {
        refreshCapital: async () => undefined,
        recordClose: () => undefined,
        notifyClose: async () => undefined,
        clearOneShotOverride: () => undefined,
        closeLadderHedge: async () => undefined,
        clearRecovery: async () => undefined,
        applyTpCooldown: () => undefined,
      },
    ),
    /cannot finalize unresolved full close/,
  );
}

async function main(): Promise<void> {
  assert.strictEqual(isTpLifecycleClose("TP"), true);
  assert.strictEqual(isTpLifecycleClose("TP (REST)"), true);
  assert.strictEqual(isTpLifecycleClose("STALE TP (REST)"), true);
  assert.strictEqual(isTpLifecycleClose("manual flatten", "NATIVE_TP"), true);
  assert.strictEqual(isTpLifecycleClose("HARD FLATTEN", "HARD FLATTEN"), false);
  await testNativeTpRunsCompleteLifecycle();
  await testNonTpCloseSkipsTpOnlyEffects();
  await testUnresolvedCloseCannotFinalize();
  console.log("long close finalizer tests passed");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
