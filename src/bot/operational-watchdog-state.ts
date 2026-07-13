import fs from "fs";
import path from "path";
import {
  OperationalIncidentObservation,
  OperationalSeverity,
} from "./operational-health";

export type OperationalAlertLifecycle = "active" | "escalated" | "reminder" | "cleared";

export interface OperationalIncidentState {
  key: string;
  active: boolean;
  severity: OperationalSeverity;
  firstObservedAt: number;
  activeSince: number | null;
  lastObservedAt: number;
  consecutiveUnhealthy: number;
  consecutiveHealthy: number;
  lastAlertAttemptAt: number | null;
  lastSuccessfulAlertAt: number | null;
  lastPayloadFingerprint: string | null;
  pendingLifecycle: OperationalAlertLifecycle | null;
  latestObservation: OperationalIncidentObservation | null;
}

export interface OperationalWatchdogStateV1 {
  version: 1;
  updatedAt: number;
  incidents: Record<string, OperationalIncidentState>;
  lastRuntimeProcessStartedAt: number | null;
  runtimeRestartObservedAt: number | null;
  runtimeRestartPreviousProcessStartedAt: number | null;
  lastRuntimeRungs: number | null;
  pendingUpsideOpenObservedAt: number | null;
}

export interface PlannedOperationalNotification {
  key: string;
  lifecycle: OperationalAlertLifecycle;
  severity: OperationalSeverity;
  observation: OperationalIncidentObservation | null;
  activeSince: number | null;
  durationMs: number;
  fingerprint: string;
}

export interface OperationalLifecycleOptions {
  warningActivateSamples: number;
  clearSamples: number;
  warningReminderMs: number;
  criticalReminderMs: number;
  deliveryRetryMs: number;
}

export const DEFAULT_OPERATIONAL_LIFECYCLE_OPTIONS: OperationalLifecycleOptions = {
  warningActivateSamples: 2,
  clearSamples: 2,
  warningReminderMs: 4 * 3600000,
  criticalReminderMs: 30 * 60000,
  deliveryRetryMs: 60_000,
};

export function emptyOperationalWatchdogState(now: number): OperationalWatchdogStateV1 {
  return {
    version: 1,
    updatedAt: now,
    incidents: {},
    lastRuntimeProcessStartedAt: null,
    runtimeRestartObservedAt: null,
    runtimeRestartPreviousProcessStartedAt: null,
    lastRuntimeRungs: null,
    pendingUpsideOpenObservedAt: null,
  };
}

function fingerprint(observation: OperationalIncidentObservation | null, lifecycle: OperationalAlertLifecycle): string {
  if (!observation) return `${lifecycle}:cleared`;
  const evidence = Object.keys(observation.evidence)
    .sort()
    .map(key => `${key}=${JSON.stringify(observation.evidence[key])}`)
    .join("|");
  return `${lifecycle}:${observation.severity}:${observation.summary}:${evidence}`;
}

export function advanceOperationalIncidentState(args: {
  now: number;
  observations: OperationalIncidentObservation[];
  state: OperationalWatchdogStateV1;
  clearBlockedKeys?: Set<string>;
  options?: OperationalLifecycleOptions;
}): { state: OperationalWatchdogStateV1; notifications: PlannedOperationalNotification[] } {
  const options = args.options ?? DEFAULT_OPERATIONAL_LIFECYCLE_OPTIONS;
  const observations = new Map(args.observations.map(row => [row.key, row]));
  const keys = new Set([...Object.keys(args.state.incidents), ...observations.keys()]);
  const notifications: PlannedOperationalNotification[] = [];

  for (const key of keys) {
    const observation = observations.get(key) ?? null;
    let incident = args.state.incidents[key];
    if (!incident) {
      if (!observation) continue;
      incident = {
        key,
        active: false,
        severity: observation.severity,
        firstObservedAt: args.now,
        activeSince: null,
        lastObservedAt: args.now,
        consecutiveUnhealthy: 0,
        consecutiveHealthy: 0,
        lastAlertAttemptAt: null,
        lastSuccessfulAlertAt: null,
        lastPayloadFingerprint: null,
        pendingLifecycle: null,
        latestObservation: observation,
      };
      args.state.incidents[key] = incident;
    }

    if (observation) {
      const wasSeverity = incident.severity;
      incident.latestObservation = observation;
      incident.lastObservedAt = args.now;
      incident.consecutiveUnhealthy++;
      incident.consecutiveHealthy = 0;
      incident.severity = observation.severity;

      const activateSamples = observation.severity === "critical" ? 1 : options.warningActivateSamples;
      if (!incident.active && incident.consecutiveUnhealthy >= activateSamples) {
        incident.active = true;
        incident.activeSince = args.now;
        incident.pendingLifecycle = "active";
        incident.lastAlertAttemptAt = null;
      } else if (incident.active && wasSeverity === "warning" && observation.severity === "critical") {
        incident.pendingLifecycle = "escalated";
        incident.lastAlertAttemptAt = null;
      } else if (incident.active && incident.pendingLifecycle === null) {
        const reminderMs = observation.severity === "critical"
          ? options.criticalReminderMs
          : options.warningReminderMs;
        if (incident.lastSuccessfulAlertAt === null || args.now - incident.lastSuccessfulAlertAt >= reminderMs) {
          incident.pendingLifecycle = incident.lastSuccessfulAlertAt === null ? "active" : "reminder";
          incident.lastAlertAttemptAt = null;
        }
      }
    } else {
      incident.consecutiveUnhealthy = 0;
      incident.consecutiveHealthy++;
      if (
        incident.active &&
        incident.consecutiveHealthy >= options.clearSamples &&
        !args.clearBlockedKeys?.has(key)
      ) {
        incident.active = false;
        incident.pendingLifecycle = "cleared";
        incident.lastAlertAttemptAt = null;
      }
    }

    if (
      incident.pendingLifecycle &&
      (incident.lastAlertAttemptAt == null || args.now - incident.lastAlertAttemptAt >= options.deliveryRetryMs)
    ) {
      const payloadFingerprint = fingerprint(incident.latestObservation, incident.pendingLifecycle);
      notifications.push({
        key,
        lifecycle: incident.pendingLifecycle,
        severity: incident.severity,
        observation: incident.latestObservation,
        activeSince: incident.activeSince,
        durationMs: incident.activeSince === null ? 0 : Math.max(0, args.now - incident.activeSince),
        fingerprint: payloadFingerprint,
      });
    }
  }

  args.state.updatedAt = args.now;
  return { state: args.state, notifications };
}

export function markOperationalNotificationAttempted(
  state: OperationalWatchdogStateV1,
  notification: PlannedOperationalNotification,
  attemptedAt: number,
): void {
  const incident = state.incidents[notification.key];
  if (!incident) return;
  incident.lastAlertAttemptAt = attemptedAt;
}

export function markOperationalNotificationDelivered(
  state: OperationalWatchdogStateV1,
  notification: PlannedOperationalNotification,
  deliveredAt: number,
): void {
  const incident = state.incidents[notification.key];
  if (!incident) return;
  incident.lastSuccessfulAlertAt = deliveredAt;
  incident.lastPayloadFingerprint = notification.fingerprint;
  if (incident.pendingLifecycle === notification.lifecycle) incident.pendingLifecycle = null;
}

export function readOperationalWatchdogState(filePath: string, now: number): OperationalWatchdogStateV1 {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (parsed?.version !== 1 || typeof parsed.incidents !== "object") throw new Error("invalid watchdog state");
    return {
      ...parsed,
      lastRuntimeProcessStartedAt: typeof parsed.lastRuntimeProcessStartedAt === "number"
        ? parsed.lastRuntimeProcessStartedAt
        : null,
      runtimeRestartObservedAt: typeof parsed.runtimeRestartObservedAt === "number"
        ? parsed.runtimeRestartObservedAt
        : null,
      runtimeRestartPreviousProcessStartedAt: typeof parsed.runtimeRestartPreviousProcessStartedAt === "number"
        ? parsed.runtimeRestartPreviousProcessStartedAt
        : null,
      lastRuntimeRungs: typeof parsed.lastRuntimeRungs === "number" ? parsed.lastRuntimeRungs : null,
      pendingUpsideOpenObservedAt: typeof parsed.pendingUpsideOpenObservedAt === "number"
        ? parsed.pendingUpsideOpenObservedAt
        : null,
    } as OperationalWatchdogStateV1;
  } catch {
    return emptyOperationalWatchdogState(now);
  }
}

export function writeOperationalWatchdogState(
  filePath: string,
  state: OperationalWatchdogStateV1,
): { success: true } | { success: false; error: string } {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  const tempPath = path.join(dir, `.${path.basename(resolved)}.${process.pid}.${Date.now()}.tmp`);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(state));
    fs.renameSync(tempPath, resolved);
    return { success: true };
  } catch (err: any) {
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* best effort */ }
    return { success: false, error: err?.message ?? String(err) };
  }
}
