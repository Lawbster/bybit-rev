import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { LadderAlerter } from "./ladder-alerter";
import {
  DEFAULT_OPERATIONAL_HEALTH_THRESHOLDS,
  evaluateOperationalHealth,
  OperationalHealthInputs,
  OperationalSourceFileHealth,
  OperationalSourceGroupHealth,
} from "./operational-health";
import {
  advanceOperationalIncidentState,
  markOperationalNotificationAttempted,
  markOperationalNotificationDelivered,
  PlannedOperationalNotification,
  readOperationalWatchdogState,
  writeOperationalWatchdogState,
} from "./operational-watchdog-state";
import { readRuntimeHealthSnapshot, RuntimeHealthSnapshotV1 } from "./runtime-health";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const POLL_MS = 10_000;
const CONTINUOUS_STREAM_MAX_AGE_MS = 10 * 60_000;
const BINANCE_TAKER_MAX_AGE_MS = 12 * 60_000;

interface CollectorHealthRow {
  timestamp: number;
  perSymbol: Array<{
    symbol: string;
    streams: Record<string, { exists?: boolean; mtimeMs?: number; ageMinutes?: number }>;
  }>;
}

export function readLastValidJsonLine<T>(filePath: string, maxBytes = 256 * 1024): T {
  const stat = fs.statSync(filePath);
  if (stat.size <= 0) throw new Error(`empty JSONL file: ${filePath}`);
  const bytes = Math.min(stat.size, maxBytes);
  const buffer = Buffer.alloc(bytes);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, bytes, stat.size - bytes);
  } finally {
    fs.closeSync(fd);
  }

  const lines = buffer.toString("utf8").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index--) {
    try { return JSON.parse(lines[index]) as T; } catch { /* fall back to preceding complete row */ }
  }
  throw new Error(`no valid JSON row in tail of ${filePath}`);
}

function statAge(filePath: string, now: number): { exists: boolean; ageMs: number | null } {
  try {
    const stat = fs.statSync(filePath);
    return { exists: true, ageMs: Math.max(0, now - stat.mtimeMs) };
  } catch {
    return { exists: false, ageMs: null };
  }
}

function collectorFileHealth(
  symbolRow: CollectorHealthRow["perSymbol"][number] | undefined,
  streamName: string,
  maxAgeMs: number,
  now: number,
): OperationalSourceFileHealth {
  const stream = symbolRow?.streams?.[streamName];
  return {
    name: streamName,
    exists: stream?.exists === true,
    ageMs: typeof stream?.mtimeMs === "number" ? Math.max(0, now - stream.mtimeMs) : null,
    maxAgeMs,
  };
}

function directFileHealth(dataDir: string, name: string, maxAgeMs: number, now: number): OperationalSourceFileHealth {
  const health = statAge(path.join(dataDir, name), now);
  return { name, ...health, maxAgeMs };
}

export function buildSourceGroups(args: {
  now: number;
  symbol: string;
  dataDir: string;
  collector: CollectorHealthRow | null;
}): OperationalSourceGroupHealth[] {
  const row = args.collector?.perSymbol?.find(item => item.symbol === args.symbol);
  return [
    {
      key: "bybit_pulse_stale",
      label: "Bybit",
      files: [
        "_market.jsonl",
        "_1m.jsonl",
        "_oi_live.jsonl",
        "_funding_live.jsonl",
        "_ob_bands.jsonl",
      ].map(name => collectorFileHealth(row, name, CONTINUOUS_STREAM_MAX_AGE_MS, args.now)),
    },
    {
      key: "binance_pulse_stale",
      label: "Binance",
      files: [
        collectorFileHealth(row, "_oi_live_binance.jsonl", CONTINUOUS_STREAM_MAX_AGE_MS, args.now),
        collectorFileHealth(row, "_funding_live_binance.jsonl", CONTINUOUS_STREAM_MAX_AGE_MS, args.now),
        collectorFileHealth(row, "_taker_binance.jsonl", BINANCE_TAKER_MAX_AGE_MS, args.now),
      ],
    },
    {
      key: "hyperliquid_pulse_stale",
      label: "Hyperliquid",
      files: [
        `${args.symbol}_taker_hyperliquid.jsonl`,
        `${args.symbol}_oi_live_hyperliquid.jsonl`,
        `${args.symbol}_funding_live_hyperliquid.jsonl`,
        `${args.symbol}_ob_bands_hyperliquid.jsonl`,
        `${args.symbol}_asset_ctx_hyperliquid.jsonl`,
      ].map(name => directFileHealth(args.dataDir, name, CONTINUOUS_STREAM_MAX_AGE_MS, args.now)),
    },
  ];
}

function appendEvent(filePath: string, row: Record<string, unknown>): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(filePath, JSON.stringify(row) + "\n");
  } catch (err: any) {
    console.error(`[watchdog] event log write failed: ${err?.message ?? err}`);
  }
}

function evidenceFields(notification: PlannedOperationalNotification): Array<{ name: string; value: string }> {
  const evidence = notification.observation?.evidence ?? {};
  return Object.entries(evidence).map(([name, value]) => ({
    name,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}

export class OperationalWatchdog {
  private readonly symbol: string;
  private readonly rootDir: string;
  private readonly dataDir: string;
  private readonly runtimeFile: string;
  private readonly collectorFile: string;
  private readonly stateFile: string;
  private readonly eventsFile: string;
  private readonly alerter: LadderAlerter;
  private readonly startedAt: number;
  private firstInputErrorAt: number | null = null;
  private lastInputError: string | undefined;

  constructor(symbol: string, rootDir: string = process.cwd(), startedAt: number = Date.now()) {
    this.symbol = symbol;
    this.rootDir = path.resolve(rootDir);
    this.dataDir = path.join(this.rootDir, "data");
    this.runtimeFile = path.join(this.dataDir, `${symbol}_runtime_health.json`);
    this.collectorFile = path.join(this.dataDir, "collector_health.jsonl");
    this.stateFile = path.join(this.dataDir, `${symbol}_operational_watchdog_state.json`);
    this.eventsFile = path.join(this.dataDir, `${symbol}_operational_health_events.jsonl`);
    this.alerter = new LadderAlerter(symbol);
    this.startedAt = startedAt;
  }

  collectInputs(now: number): OperationalHealthInputs {
    const errors: string[] = [];
    const runtimeStat = statAge(this.runtimeFile, now);
    let runtime: RuntimeHealthSnapshotV1 | null = null;
    if (runtimeStat.exists) {
      try { runtime = readRuntimeHealthSnapshot(this.runtimeFile); }
      catch (err: any) { errors.push(`runtime: ${err?.message ?? err}`); }
    }

    const collectorStat = statAge(this.collectorFile, now);
    let collector: CollectorHealthRow | null = null;
    if (collectorStat.exists) {
      try { collector = readLastValidJsonLine<CollectorHealthRow>(this.collectorFile); }
      catch (err: any) { errors.push(`collector: ${err?.message ?? err}`); }
    }

    if (errors.length > 0) {
      if (this.firstInputErrorAt === null) this.firstInputErrorAt = now;
      this.lastInputError = errors.join("; ");
    } else {
      this.firstInputErrorAt = null;
      this.lastInputError = undefined;
    }

    return {
      now,
      watchdogStartedAt: this.startedAt,
      runtime,
      runtimeFileAgeMs: runtimeStat.ageMs,
      collectorHealthAgeMs: collector?.timestamp
        ? Math.max(0, now - collector.timestamp)
        : collectorStat.ageMs,
      sourceGroups: buildSourceGroups({ now, symbol: this.symbol, dataDir: this.dataDir, collector }),
      inputErrorAgeMs: this.firstInputErrorAt === null ? null : now - this.firstInputErrorAt,
      ...(this.lastInputError === undefined ? {} : { inputError: this.lastInputError }),
    };
  }

  async poll(args: { dryRun: boolean }): Promise<{ incidents: ReturnType<typeof evaluateOperationalHealth>; sent: number }> {
    const now = Date.now();
    const inputs = this.collectInputs(now);
    const observations = evaluateOperationalHealth(inputs);
    if (args.dryRun) return { incidents: observations, sent: 0 };

    const state = readOperationalWatchdogState(this.stateFile, now);
    const clearBlockedKeys = new Set<string>();
    if (state.incidents.recovery_mode?.active && (!inputs.runtime || inputs.runtime.reconciliation.synced !== true)) {
      clearBlockedKeys.add("recovery_mode");
    }
    const advanced = advanceOperationalIncidentState({ now, observations, state, clearBlockedKeys });
    const beforeSendWrite = writeOperationalWatchdogState(this.stateFile, advanced.state);
    if (!beforeSendWrite.success) console.error(`[watchdog] state write failed: ${beforeSendWrite.error}`);

    let sent = 0;
    for (const notification of advanced.notifications) {
      markOperationalNotificationAttempted(advanced.state, notification, now);
      const attemptWrite = writeOperationalWatchdogState(this.stateFile, advanced.state);
      if (!attemptWrite.success) console.error(`[watchdog] state write failed: ${attemptWrite.error}`);
      const observation = notification.observation;
      const summary = notification.lifecycle === "cleared"
        ? `Cleared: ${observation?.summary ?? notification.key}`
        : observation?.summary ?? notification.key;
      const delivered = await this.alerter.notifyOperationalIncident({
        key: notification.key,
        lifecycle: notification.lifecycle,
        severity: notification.severity,
        summary,
        activeSince: notification.activeSince,
        durationMs: notification.durationMs,
        evidence: evidenceFields(notification),
      });
      appendEvent(this.eventsFile, {
        ts: new Date(now).toISOString(),
        timestamp: now,
        symbol: this.symbol,
        key: notification.key,
        lifecycle: notification.lifecycle,
        severity: notification.severity,
        delivered,
        evidence: observation?.evidence ?? {},
      });
      if (delivered) {
        markOperationalNotificationDelivered(advanced.state, notification, now);
        sent++;
      }
    }
    const afterSendWrite = writeOperationalWatchdogState(this.stateFile, advanced.state);
    if (!afterSendWrite.success) console.error(`[watchdog] state write failed: ${afterSendWrite.error}`);
    return { incidents: observations, sent };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const symbolArg = args.find(arg => arg.startsWith("--symbol="));
  const symbol = symbolArg?.split("=")[1] || "HYPEUSDT";
  const once = args.includes("--once");
  const dryRun = args.includes("--dry-run");
  const selfTest = args.includes("--self-test-alert");
  const startedAt = once ? Date.now() - DEFAULT_OPERATIONAL_HEALTH_THRESHOLDS.mainHeartbeatWarnMs : Date.now();
  const watchdog = new OperationalWatchdog(symbol, process.cwd(), startedAt);

  if (selfTest) {
    const alerter = new LadderAlerter(symbol);
    const delivered = await alerter.notifyOperationalIncident({
      key: "watchdog_self_test",
      lifecycle: "active",
      severity: "warning",
      summary: "Explicit operational-watchdog webhook self-test.",
      activeSince: Date.now(),
      durationMs: 0,
      evidence: [{ name: "Mode", value: "self-test only" }],
    });
    console.log(JSON.stringify({ selfTest: true, delivered }));
    process.exitCode = delivered ? 0 : 1;
    return;
  }

  if (once) {
    const result = await watchdog.poll({ dryRun });
    console.log(JSON.stringify({ symbol, dryRun, incidents: result.incidents, sent: result.sent }, null, 2));
    if (dryRun && result.incidents.length > 0) process.exitCode = 2;
    return;
  }

  console.log(`[watchdog] ${symbol} operational watchdog started; poll=${POLL_MS / 1000}s; alertOnly=true`);
  while (true) {
    try {
      const result = await watchdog.poll({ dryRun: false });
      if (result.incidents.length > 0) {
        console.log(`[watchdog] active=${result.incidents.map(row => `${row.key}:${row.severity}`).join(",")} sent=${result.sent}`);
      }
    } catch (err: any) {
      console.error(`[watchdog] poll failed: ${err?.message ?? err}`);
    }
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(`[watchdog] fatal: ${err?.message ?? err}`);
    process.exit(1);
  });
}
