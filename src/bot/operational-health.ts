import { RuntimeHealthSnapshotV1 } from "./runtime-health";

export type OperationalSeverity = "warning" | "critical";

export interface OperationalIncidentObservation {
  key: string;
  severity: OperationalSeverity;
  summary: string;
  evidence: Record<string, string | number | boolean | null>;
}

export interface OperationalSourceFileHealth {
  name: string;
  exists: boolean;
  ageMs: number | null;
  maxAgeMs: number;
}

export interface OperationalSourceGroupHealth {
  key: "bybit_pulse_stale" | "binance_pulse_stale" | "hyperliquid_pulse_stale";
  label: string;
  files: OperationalSourceFileHealth[];
}

export interface OperationalHealthInputs {
  now: number;
  watchdogStartedAt: number;
  runtime: RuntimeHealthSnapshotV1 | null;
  runtimeFileAgeMs: number | null;
  collectorHealthAgeMs: number | null;
  sourceGroups: OperationalSourceGroupHealth[];
  inputErrorAgeMs: number | null;
  inputError?: string;
  mainProcessRestart?: {
    previousProcessStartedAt: number;
    currentProcessStartedAt: number;
    observedAt: number;
  };
  shortBreakdownShadow?: {
    fileAgeMs: number | null;
    status: "warming_up" | "healthy" | "degraded";
    statusReasons: string[];
    processStartedAt: number;
    lastDecisionTs: number | null;
    lastDecisionReady: boolean | null;
  };
  shortLive?: {
    fileAgeMs: number | null;
    enabled: boolean;
    status: "disabled" | "healthy" | "recovery" | "degraded";
    statusReasons: string[];
    positionActive: boolean;
    positionQty: number;
    protectionStatus: string | null;
    pendingActive: boolean;
    pendingKind: string | null;
    pendingOrderLinkId: string | null;
    pendingAgeMs: number | null;
    recoveryActive: boolean;
    recoveryReason: string | null;
  };
}

export interface OperationalHealthThresholds {
  mainHeartbeatWarnMs: number;
  mainLoopWarnMs: number;
  mainLoopCriticalMs: number;
  pendingWarnMs: number;
  pendingCriticalMs: number;
  tpFailedWarnMs: number;
  tpFailedCriticalMs: number;
  tpMissingWarnMs: number;
  tpMissingCriticalMs: number;
  wsWarnMs: number;
  wsCriticalMs: number;
  reconciliationStaleMs: number;
  collectorHealthStaleMs: number;
  inputErrorWarnMs: number;
  shortShadowHeartbeatWarnMs: number;
  shortShadowWarmupMs: number;
  shortLiveHeartbeatWarnMs: number;
  shortLivePendingWarnMs: number;
  shortLivePendingCriticalMs: number;
}

export const DEFAULT_OPERATIONAL_HEALTH_THRESHOLDS: OperationalHealthThresholds = {
  mainHeartbeatWarnMs: 90_000,
  mainLoopWarnMs: 60_000,
  mainLoopCriticalMs: 180_000,
  pendingWarnMs: 30_000,
  pendingCriticalMs: 120_000,
  tpFailedWarnMs: 60_000,
  tpFailedCriticalMs: 300_000,
  tpMissingWarnMs: 60_000,
  tpMissingCriticalMs: 300_000,
  wsWarnMs: 30_000,
  wsCriticalMs: 120_000,
  reconciliationStaleMs: 12 * 60_000,
  collectorHealthStaleMs: 12 * 60_000,
  inputErrorWarnMs: 60_000,
  shortShadowHeartbeatWarnMs: 90_000,
  shortShadowWarmupMs: 3 * 60_000,
  shortLiveHeartbeatWarnMs: 90_000,
  shortLivePendingWarnMs: 30_000,
  shortLivePendingCriticalMs: 120_000,
};

function incident(
  key: string,
  severity: OperationalSeverity,
  summary: string,
  evidence: OperationalIncidentObservation["evidence"],
): OperationalIncidentObservation {
  return { key, severity, summary, evidence };
}

export function evaluateOperationalHealth(
  input: OperationalHealthInputs,
  thresholds: OperationalHealthThresholds = DEFAULT_OPERATIONAL_HEALTH_THRESHOLDS,
): OperationalIncidentObservation[] {
  const incidents: OperationalIncidentObservation[] = [];
  const runtimeAge = input.runtimeFileAgeMs;

  if (
    input.now - input.watchdogStartedAt >= thresholds.mainHeartbeatWarnMs &&
    (runtimeAge === null || runtimeAge > thresholds.mainHeartbeatWarnMs)
  ) {
    incidents.push(incident(
      "main_heartbeat_stale",
      "critical",
      "Main bot runtime heartbeat is stale or missing.",
      { runtimeFileAgeMs: runtimeAge },
    ));
  }

  const runtime = input.runtime;
  if (runtime) {
    const mainLoopAge = Math.max(0, input.now - runtime.mainLoop.lastCycleAt);
    if (
      runtimeAge !== null &&
      runtimeAge <= thresholds.mainHeartbeatWarnMs &&
      mainLoopAge > thresholds.mainLoopWarnMs
    ) {
      incidents.push(incident(
        "main_loop_stale",
        mainLoopAge > thresholds.mainLoopCriticalMs ? "critical" : "warning",
        "Main bot heartbeat is fresh but its trading loop is stale.",
        { mainLoopAgeMs: mainLoopAge, cycleCount: runtime.mainLoop.cycleCount },
      ));
    }

    if (runtime.recovery.active) {
      incidents.push(incident(
        "recovery_mode",
        "critical",
        "Main bot is in recovery mode; new adds are blocked.",
        { ownerOrderLinkId: runtime.recovery.ownerOrderLinkId },
      ));
    }

    if (runtime.reconciliation.synced === false && !runtime.reconciliation.deferredBy) {
      incidents.push(incident(
        "reconciliation_unsynced",
        "critical",
        "Latest exchange/local reconciliation is not synchronized.",
        {
          status: runtime.reconciliation.status,
          reason: runtime.reconciliation.reason ?? null,
          localLongQty: runtime.reconciliation.localLongQty ?? null,
          exchangeLongQty: runtime.reconciliation.exchangeLongQty ?? null,
          absDiff: runtime.reconciliation.absDiff ?? null,
          tolerance: runtime.reconciliation.tolerance ?? null,
        },
      ));
    }

    const reconciliationAge = runtime.reconciliation.lastSuccessAt === null
      ? input.now - runtime.processStartedAt
      : input.now - runtime.reconciliation.lastSuccessAt;
    if (
      runtime.reconciliation.synced !== false &&
      !runtime.reconciliation.deferredBy &&
      (reconciliationAge === null || reconciliationAge > thresholds.reconciliationStaleMs)
    ) {
      incidents.push(incident(
        "reconciliation_stale",
        "warning",
        "No recent successful exchange/local reconciliation.",
        { reconciliationAgeMs: reconciliationAge, status: runtime.reconciliation.status },
      ));
    }

    if (runtime.transaction.pending) {
      const pendingAge = runtime.transaction.ageMs ?? (
        runtime.transaction.createdAt === undefined ? 0 : input.now - runtime.transaction.createdAt
      );
      if (pendingAge > thresholds.pendingWarnMs) {
        incidents.push(incident(
          "pending_order_stale",
          pendingAge > thresholds.pendingCriticalMs ? "critical" : "warning",
          "A durable order intent has remained pending beyond its normal confirmation window.",
          {
            kind: runtime.transaction.kind ?? null,
            orderLinkId: runtime.transaction.orderLinkId ?? null,
            pendingAgeMs: pendingAge,
            lastObservedStatus: runtime.transaction.lastObservedStatus ?? null,
          },
        ));
      }
    }

    const tp = runtime.desiredLongTp;
    if (
      runtime.positions.localLongQty > 0 &&
      tp.present &&
      !runtime.transaction.pending &&
      !runtime.recovery.active
    ) {
      const qtyBasis = tp.positionQtyBasis;
      const qtyDiff = typeof qtyBasis === "number" && Number.isFinite(qtyBasis)
        ? Math.abs(qtyBasis - runtime.positions.localLongQty)
        : null;
      const localStateTolerance = Math.max(1e-8, runtime.positions.localLongQty * 1e-9);
      if (qtyDiff === null || qtyDiff > localStateTolerance) {
        incidents.push(incident(
          "tp_intent_qty_mismatch",
          "warning",
          "Desired native TP quantity basis does not match current local long quantity.",
          {
            positionQtyBasis: qtyBasis ?? null,
            localLongQty: runtime.positions.localLongQty,
            absDiff: qtyDiff,
            localStateTolerance,
            syncStatus: tp.syncStatus ?? null,
          },
        ));
      }
    }
    if (
      runtime.positions.localLongQty > 0 &&
      !tp.present &&
      !runtime.transaction.pending &&
      !runtime.recovery.active
    ) {
      const missingAge = tp.ageMs ?? (
        tp.missingSince === undefined ? 0 : Math.max(0, input.now - tp.missingSince)
      );
      if (missingAge > thresholds.tpMissingWarnMs) {
        incidents.push(incident(
          "long_without_tp_intent",
          missingAge > thresholds.tpMissingCriticalMs ? "critical" : "warning",
          "A local long position has no durable desired native TP intent.",
          { localLongQty: runtime.positions.localLongQty, missingAgeMs: missingAge },
        ));
      }
    }
    if (runtime.positions.localLongQty > 0 && tp.present && tp.syncStatus === "failed") {
      const failedAge = tp.ageMs ?? (tp.updatedAt === undefined ? 0 : input.now - tp.updatedAt);
      if (failedAge > thresholds.tpFailedWarnMs) {
        incidents.push(incident(
          "tp_sync_failed",
          failedAge > thresholds.tpFailedCriticalMs ? "critical" : "warning",
          "Desired native long TP remains unsynchronized.",
          {
            tpPrice: tp.price ?? null,
            activeTpPct: tp.activeTpPct ?? null,
            failedAgeMs: failedAge,
            error: tp.lastError ?? null,
          },
        ));
      }
    }

    const wsAge = runtime.websocket.ageMs;
    if (runtime.websocket.stale || (wsAge !== null && wsAge > thresholds.wsWarnMs)) {
      incidents.push(incident(
        "ws_feed_stale",
        wsAge !== null && wsAge > thresholds.wsCriticalMs ? "critical" : "warning",
        "Main ticker WebSocket is stale; REST TP fallback should be active.",
        { connected: runtime.websocket.connected, ageMs: wsAge },
      ));
    }

    if (!runtime.context.healthy) {
      incidents.push(incident(
        "context_incomplete",
        "warning",
        "Configured S/R candle coverage is incomplete; S/R actions should be fail-closed.",
        {
          horizonDays: runtime.context.horizonDays,
          actualBars: runtime.context.actualContinuousBars,
          expectedBars: runtime.context.expectedBars,
          firstMissingTs: runtime.context.firstMissingTs ?? null,
          reason: runtime.context.reason ?? null,
        },
      ));
    }
  }

  if (input.mainProcessRestart) {
    incidents.push(incident(
      "main_process_restarted",
      "warning",
      "Main bot process start identity changed.",
      {
        previousProcessStartedAt: input.mainProcessRestart.previousProcessStartedAt,
        currentProcessStartedAt: input.mainProcessRestart.currentProcessStartedAt,
        observedAt: input.mainProcessRestart.observedAt,
      },
    ));
  }

  const shortShadow = input.shortBreakdownShadow;
  if (shortShadow) {
    if (shortShadow.fileAgeMs === null || shortShadow.fileAgeMs > thresholds.shortShadowHeartbeatWarnMs) {
      incidents.push(incident(
        "hl_short_shadow_heartbeat_stale",
        "warning",
        "HYPE HL short-breakdown shadow heartbeat is stale.",
        {
          fileAgeMs: shortShadow.fileAgeMs,
          status: shortShadow.status,
          lastDecisionTs: shortShadow.lastDecisionTs,
        },
      ));
    } else if (
      shortShadow.status === "degraded"
      || (shortShadow.status === "warming_up" && input.now - shortShadow.processStartedAt > thresholds.shortShadowWarmupMs)
    ) {
      incidents.push(incident(
        "hl_short_shadow_degraded",
        "warning",
        "HYPE HL short-breakdown shadow is not producing healthy decision telemetry.",
        {
          status: shortShadow.status,
          reasons: shortShadow.statusReasons.join(","),
          lastDecisionTs: shortShadow.lastDecisionTs,
          lastDecisionReady: shortShadow.lastDecisionReady,
        },
      ));
    }
  }

  const shortLive = input.shortLive;
  if (shortLive) {
    if (shortLive.fileAgeMs === null || shortLive.fileAgeMs > thresholds.shortLiveHeartbeatWarnMs) {
      incidents.push(incident(
        "hl_short_live_heartbeat_stale",
        shortLive.enabled ? "critical" : "warning",
        "HYPE transactional short-owner heartbeat is stale.",
        { fileAgeMs: shortLive.fileAgeMs, enabled: shortLive.enabled, status: shortLive.status },
      ));
    }
    if (shortLive.enabled && (shortLive.recoveryActive || shortLive.status === "recovery" || shortLive.status === "degraded")) {
      incidents.push(incident(
        "hl_short_live_recovery",
        "critical",
        "HYPE transactional short owner is fail-closed in recovery/degraded state.",
        {
          status: shortLive.status,
          recoveryReason: shortLive.recoveryReason,
          statusReasons: shortLive.statusReasons.join(","),
        },
      ));
    }
    if (shortLive.enabled && shortLive.positionActive && shortLive.protectionStatus !== "confirmed") {
      incidents.push(incident(
        "hl_short_live_unprotected",
        "critical",
        "Managed HYPE short does not have confirmed paired native TP/SL protection.",
        {
          positionQty: shortLive.positionQty,
          protectionStatus: shortLive.protectionStatus,
        },
      ));
    }
    if (
      shortLive.enabled
      && shortLive.pendingActive
      && shortLive.pendingAgeMs !== null
      && shortLive.pendingAgeMs > thresholds.shortLivePendingWarnMs
    ) {
      incidents.push(incident(
        "hl_short_live_pending_stale",
        shortLive.pendingAgeMs > thresholds.shortLivePendingCriticalMs ? "critical" : "warning",
        "A durable HYPE short order intent remains unresolved.",
        {
          kind: shortLive.pendingKind,
          orderLinkId: shortLive.pendingOrderLinkId,
          pendingAgeMs: shortLive.pendingAgeMs,
        },
      ));
    }
  }

  if (input.collectorHealthAgeMs === null || input.collectorHealthAgeMs > thresholds.collectorHealthStaleMs) {
    incidents.push(incident(
      "collector_health_stale",
      "warning",
      "Collector health heartbeat is stale or missing.",
      { collectorHealthAgeMs: input.collectorHealthAgeMs },
    ));
  }

  for (const group of input.sourceGroups) {
    const stale = group.files.filter(file => !file.exists || file.ageMs === null || file.ageMs > file.maxAgeMs);
    if (stale.length > 0) {
      incidents.push(incident(
        group.key,
        "warning",
        `${group.label} pulse inputs are stale or missing.`,
        {
          staleFiles: stale.map(file => `${file.name}:${file.exists ? `${file.ageMs}ms` : "missing"}`).join(", "),
        },
      ));
    }
  }

  if (input.inputErrorAgeMs !== null && input.inputErrorAgeMs > thresholds.inputErrorWarnMs) {
    incidents.push(incident(
      "watchdog_input_error",
      "warning",
      "Watchdog input files have repeatedly failed to parse or read.",
      { errorAgeMs: input.inputErrorAgeMs, error: input.inputError ?? null },
    ));
  }

  return incidents.sort((a, b) => a.key.localeCompare(b.key));
}
