import assert from "assert";
import {
  evaluateOperationalHealth,
  OperationalHealthInputs,
} from "../src/bot/operational-health";
import { RuntimeHealthSnapshotV1 } from "../src/bot/runtime-health";

const NOW = 1_000_000;

function healthyRuntime(): RuntimeHealthSnapshotV1 {
  return {
    version: 1,
    symbol: "HYPEUSDT",
    processStartedAt: NOW - 600_000,
    writtenAt: NOW,
    mode: "LIVE",
    mainLoop: { lastCycleAt: NOW, cycleCount: 100 },
    websocket: { connected: true, lastPriceAt: NOW, ageMs: 0, stale: false },
    context: {
      healthy: true,
      horizonDays: 14,
      expectedBars: 4032,
      actualContinuousBars: 4032,
      earliestContinuousTs: NOW - 14 * 86400000,
      latestClosedTs: NOW - 300000,
    },
    reconciliation: {
      lastAttemptAt: NOW,
      lastSuccessAt: NOW,
      status: "synced",
      synced: true,
      exchangeFlat: false,
      localLongQty: 10,
      exchangeLongQty: 10,
      absDiff: 0,
      tolerance: 0.005,
    },
    transaction: { pending: false },
    recovery: { active: false, ownerOrderLinkId: null },
    desiredLongTp: {
      present: true,
      price: 68,
      positionQtyBasis: 10,
      activeTpPct: 1.4,
      syncStatus: "confirmed",
      updatedAt: NOW,
      ageMs: 0,
    },
    positions: { rungs: 1, localLongQty: 10 },
  };
}

function healthyInput(): OperationalHealthInputs {
  return {
    now: NOW,
    watchdogStartedAt: NOW - 600_000,
    runtime: healthyRuntime(),
    runtimeFileAgeMs: 0,
    collectorHealthAgeMs: 0,
    sourceGroups: [],
    inputErrorAgeMs: null,
  };
}

function keys(input: OperationalHealthInputs): string[] {
  return evaluateOperationalHealth(input).map(row => row.key);
}

function incident(input: OperationalHealthInputs, key: string) {
  return evaluateOperationalHealth(input).find(row => row.key === key);
}

assert.deepEqual(evaluateOperationalHealth(healthyInput()), []);

{
  const input = healthyInput();
  input.runtime!.recovery = { active: true, ownerOrderLinkId: "order-1" };
  assert.equal(incident(input, "recovery_mode")?.severity, "critical");
}

{
  const input = healthyInput();
  input.runtime!.reconciliation = {
    ...input.runtime!.reconciliation,
    synced: false,
    status: "quantity_mismatch",
    absDiff: 1,
  };
  assert.equal(incident(input, "reconciliation_unsynced")?.severity, "critical");
}

{
  const input = healthyInput();
  input.runtime!.reconciliation.lastSuccessAt = NOW - 13 * 60_000;
  assert.ok(keys(input).includes("reconciliation_stale"));
  input.runtime!.reconciliation.deferredBy = "pending:order-1";
  assert.ok(!keys(input).includes("reconciliation_stale"));
}

{
  const input = healthyInput();
  input.runtime!.reconciliation.lastSuccessAt = null;
  input.runtime!.reconciliation.synced = null;
  input.runtime!.processStartedAt = NOW - 5 * 60_000;
  assert.ok(!keys(input).includes("reconciliation_stale"));
  input.runtime!.processStartedAt = NOW - 13 * 60_000;
  assert.ok(keys(input).includes("reconciliation_stale"));
}

{
  const input = healthyInput();
  input.runtime!.transaction = { pending: true, kind: "partial_close", orderLinkId: "p1", ageMs: 29_000 };
  assert.ok(!keys(input).includes("pending_order_stale"));
  input.runtime!.transaction.ageMs = 31_000;
  assert.equal(incident(input, "pending_order_stale")?.severity, "warning");
  input.runtime!.transaction.ageMs = 121_000;
  assert.equal(incident(input, "pending_order_stale")?.severity, "critical");
}

{
  const input = healthyInput();
  input.runtime!.desiredLongTp = {
    present: true,
    syncStatus: "failed",
    price: 68,
    updatedAt: NOW - 61_000,
    ageMs: 61_000,
    lastError: "synthetic",
  };
  assert.equal(incident(input, "tp_sync_failed")?.severity, "warning");
  input.runtime!.desiredLongTp.ageMs = 301_000;
  assert.equal(incident(input, "tp_sync_failed")?.severity, "critical");
  input.runtime!.positions.localLongQty = 0;
  assert.ok(!keys(input).includes("tp_sync_failed"));
}

{
  const input = healthyInput();
  input.runtime!.websocket = { connected: true, lastPriceAt: NOW - 31_000, ageMs: 31_000, stale: true };
  assert.equal(incident(input, "ws_feed_stale")?.severity, "warning");
  input.runtime!.websocket.ageMs = 121_000;
  assert.equal(incident(input, "ws_feed_stale")?.severity, "critical");
}

{
  const input = healthyInput();
  input.runtime!.context.healthy = false;
  input.runtime!.context.actualContinuousBars = 4031;
  input.runtime!.context.firstMissingTs = NOW - 600_000;
  assert.ok(keys(input).includes("context_incomplete"));
}

{
  const input = healthyInput();
  input.runtimeFileAgeMs = 91_000;
  assert.equal(incident(input, "main_heartbeat_stale")?.severity, "critical");
}

{
  const input = healthyInput();
  input.runtime!.mainLoop.lastCycleAt = NOW - 61_000;
  assert.equal(incident(input, "main_loop_stale")?.severity, "warning");
  input.runtime!.mainLoop.lastCycleAt = NOW - 181_000;
  assert.equal(incident(input, "main_loop_stale")?.severity, "critical");
  input.runtimeFileAgeMs = 91_000;
  assert.ok(!keys(input).includes("main_loop_stale"), "stale heartbeat suppresses duplicate loop alert");
}

{
  const input = healthyInput();
  input.runtime!.desiredLongTp = { present: false, missingSince: NOW - 61_000, ageMs: 61_000 };
  assert.equal(incident(input, "long_without_tp_intent")?.severity, "warning");
  input.runtime!.desiredLongTp.ageMs = 301_000;
  assert.equal(incident(input, "long_without_tp_intent")?.severity, "critical");
  input.runtime!.transaction = { pending: true, kind: "full_close", ageMs: 10_000 };
  assert.ok(!keys(input).includes("long_without_tp_intent"), "pending transaction suppresses missing TP alert");
  input.runtime!.transaction = { pending: false };
  input.runtime!.recovery.active = true;
  assert.ok(!keys(input).includes("long_without_tp_intent"), "recovery suppresses missing TP alert");
}

{
  const input = healthyInput();
  input.runtime!.desiredLongTp.positionQtyBasis = 9;
  assert.equal(incident(input, "tp_intent_qty_mismatch")?.severity, "warning");
  input.runtime!.transaction = { pending: true, kind: "partial_close", ageMs: 10_000 };
  assert.ok(!keys(input).includes("tp_intent_qty_mismatch"), "pending transaction suppresses transient TP basis mismatch");
  input.runtime!.transaction = { pending: false };
  input.runtime!.recovery.active = true;
  assert.ok(!keys(input).includes("tp_intent_qty_mismatch"), "recovery suppresses TP basis mismatch");
}

{
  const input = healthyInput();
  input.mainProcessRestart = {
    previousProcessStartedAt: NOW - 1_000_000,
    currentProcessStartedAt: NOW - 10_000,
    observedAt: NOW,
  };
  assert.equal(incident(input, "main_process_restarted")?.severity, "warning");
}

{
  const input = healthyInput();
  input.shortBreakdownShadow = {
    fileAgeMs: 0,
    status: "healthy",
    statusReasons: [],
    processStartedAt: NOW - 10 * 60_000,
    lastDecisionTs: NOW - 5 * 60_000,
    lastDecisionReady: true,
  };
  assert.ok(!keys(input).some(key => key.startsWith("hl_short_shadow_")));
  input.shortBreakdownShadow.fileAgeMs = 91_000;
  assert.equal(incident(input, "hl_short_shadow_heartbeat_stale")?.severity, "warning");
  input.shortBreakdownShadow.fileAgeMs = 0;
  input.shortBreakdownShadow.status = "degraded";
  input.shortBreakdownShadow.statusReasons = ["hl_taker_1m:stale"];
  assert.equal(incident(input, "hl_short_shadow_degraded")?.severity, "warning");
  input.shortBreakdownShadow.status = "warming_up";
  input.shortBreakdownShadow.statusReasons = [];
  input.shortBreakdownShadow.processStartedAt = NOW - 2 * 60_000;
  assert.ok(!keys(input).includes("hl_short_shadow_degraded"));
  input.shortBreakdownShadow.processStartedAt = NOW - 4 * 60_000;
  assert.ok(keys(input).includes("hl_short_shadow_degraded"));
}

{
  const input = healthyInput();
  input.shortLive = {
    fileAgeMs: 0,
    enabled: true,
    status: "healthy",
    statusReasons: [],
    positionActive: false,
    positionQty: 0,
    protectionStatus: null,
    pendingActive: false,
    pendingKind: null,
    pendingOrderLinkId: null,
    pendingAgeMs: null,
    recoveryActive: false,
    recoveryReason: null,
  };
  assert.ok(!keys(input).some(key => key.startsWith("hl_short_live_")));
  input.shortLive.positionActive = true;
  input.shortLive.positionQty = 400;
  input.shortLive.protectionStatus = "failed";
  assert.equal(incident(input, "hl_short_live_unprotected")?.severity, "critical");
  input.shortLive.protectionStatus = "confirmed";
  input.shortLive.pendingActive = true;
  input.shortLive.pendingKind = "short_close";
  input.shortLive.pendingOrderLinkId = "hlsc-1";
  input.shortLive.pendingAgeMs = 31_000;
  assert.equal(incident(input, "hl_short_live_pending_stale")?.severity, "warning");
  input.shortLive.pendingAgeMs = 121_000;
  assert.equal(incident(input, "hl_short_live_pending_stale")?.severity, "critical");
  input.shortLive.pendingActive = false;
  input.shortLive.recoveryActive = true;
  input.shortLive.status = "recovery";
  input.shortLive.recoveryReason = "quantity_mismatch";
  assert.equal(incident(input, "hl_short_live_recovery")?.severity, "critical");
  input.shortLive.recoveryActive = false;
  input.shortLive.status = "healthy";
  input.shortLive.fileAgeMs = 91_000;
  assert.equal(incident(input, "hl_short_live_heartbeat_stale")?.severity, "critical");
  input.shortLive.enabled = false;
  assert.equal(incident(input, "hl_short_live_heartbeat_stale")?.severity, "warning");
}

{
  const input = healthyInput();
  input.collectorHealthAgeMs = 12 * 60_000 + 1;
  assert.ok(keys(input).includes("collector_health_stale"));
}

{
  const input = healthyInput();
  input.sourceGroups = [{
    key: "hyperliquid_pulse_stale",
    label: "Hyperliquid",
    files: [
      { name: "continuous.jsonl", exists: true, ageMs: 61_000, maxAgeMs: 60_000 },
      { name: "fresh.jsonl", exists: true, ageMs: 1_000, maxAgeMs: 60_000 },
    ],
  }];
  assert.ok(keys(input).includes("hyperliquid_pulse_stale"));
}

{
  const input = healthyInput();
  input.inputErrorAgeMs = 61_000;
  input.inputError = "synthetic parse error";
  assert.ok(keys(input).includes("watchdog_input_error"));
}

console.log("operational health tests passed");
