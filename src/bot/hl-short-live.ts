import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { LiveExecutor } from "./executor";
import {
  HL_SHORT_BREAKDOWN_CANDIDATE,
  HL_SHORT_BREAKDOWN_POLICY_SIGNATURE,
  HL_SHORT_BREAKDOWN_POLICY_VERSION,
  HlShortBreakdownFeatures,
} from "./hl-short-breakdown-policy";
import type { HlShortBreakdownShadowHealthV1 } from "./hl-short-breakdown-shadow";
import { HlShortLiveStateStore } from "./hl-short-live-state";
import { HlShortTransactionCoordinator } from "./hl-short-transaction-coordinator";
import { LadderAlerter } from "./ladder-alerter";
import { BotLogger } from "./monitor";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

interface HlShortLiveConfig {
  enabled: boolean;
  entryEnabled: boolean;
  symbol: "HYPEUSDT";
  notionalUsdt: number;
  leverage: number;
  feeRate: number;
  pollIntervalMs: number;
  maximumSignalAgeMs: number;
  maximumShadowHealthAgeMs: number;
  signalJournalFile: string;
  shadowHealthFile: string;
  stateFile: string;
  healthFile: string;
  logDir: string;
}

interface HlShortSignalEvent {
  timestamp: number;
  symbol: "HYPEUSDT";
  candidate: typeof HL_SHORT_BREAKDOWN_CANDIDATE;
  policyVersion: typeof HL_SHORT_BREAKDOWN_POLICY_VERSION;
  shadowOnly: true;
  event: "signal";
  eventId: string;
  signalId: string;
  features: HlShortBreakdownFeatures;
}

export interface HlShortLiveHealthV1 {
  version: 1;
  symbol: "HYPEUSDT";
  candidate: typeof HL_SHORT_BREAKDOWN_CANDIDATE;
  policyVersion: typeof HL_SHORT_BREAKDOWN_POLICY_VERSION;
  policySignature: string;
  executionOwner: true;
  enabled: boolean;
  entryEnabled: boolean;
  processStartedAt: number;
  writtenAt: number;
  status: "disabled" | "healthy" | "recovery" | "degraded";
  statusReasons: string[];
  poll: { lastAt: number | null; intervalMs: number };
  journal: { file: string; offset: number | null; size: number | null; error: string | null };
  shadow: { fileAgeMs: number | null; status: string | null; healthy: boolean; error: string | null };
  position: {
    active: boolean;
    signalId: string | null;
    qty: number;
    entryPrice: number | null;
    notional: number;
    takeProfit: number | null;
    stopLoss: number | null;
    expiresAt: number | null;
    protectionStatus: string | null;
    protectionFailureCount: number;
  };
  pending: {
    active: boolean;
    kind: string | null;
    orderLinkId: string | null;
    ageMs: number | null;
    lastObservedStatus: string | null;
  };
  recovery: { active: boolean; reason: string | null };
  reconciliation: { lastAt: number | null; exchangeQty: number | null };
  totals: { realizedPnl: number; fees: number; receipts: number; processedSignals: number };
}

function parseArg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find(arg => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function atomicWriteJson(filePath: string, value: unknown): void {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const temp = path.join(path.dirname(absolute), `.${path.basename(absolute)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2));
    fs.renameSync(temp, absolute);
  } catch (err) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch { /* best effort */ }
    throw err;
  }
}

function acquireOwnerLock(config: HlShortLiveConfig): () => void {
  const lockFile = path.resolve(path.dirname(config.stateFile), `${config.symbol}_hl_short_live_owner.lock`);
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  if (fs.existsSync(lockFile)) {
    let activePid = 0;
    try { activePid = Number(JSON.parse(fs.readFileSync(lockFile, "utf8"))?.pid ?? 0); } catch { /* stale/invalid */ }
    if (activePid > 0) {
      try {
        process.kill(activePid, 0);
        throw new Error(`another HYPE short owner is already active (pid ${activePid})`);
      } catch (err: any) {
        if (err?.code !== "ESRCH") throw err;
      }
    }
    fs.unlinkSync(lockFile);
  }
  const token = `${process.pid}:${Date.now()}`;
  const fd = fs.openSync(lockFile, "wx");
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token, createdAt: Date.now() }));
  fs.closeSync(fd);
  return () => {
    try {
      const current = JSON.parse(fs.readFileSync(lockFile, "utf8"));
      if (current?.token === token) fs.unlinkSync(lockFile);
    } catch { /* best effort */ }
  };
}

export function loadHlShortLiveConfig(filePath: string): HlShortLiveConfig {
  const config = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")) as HlShortLiveConfig;
  if (config.symbol !== "HYPEUSDT") throw new Error("HL short live owner is HYPEUSDT-only");
  if (typeof config.enabled !== "boolean" || typeof config.entryEnabled !== "boolean") {
    throw new Error("HL short enabled and entryEnabled flags must be explicit booleans");
  }
  if (!config.enabled && config.entryEnabled) throw new Error("HL short entries cannot be enabled while the execution owner is disabled");
  if (config.notionalUsdt !== 25_000) throw new Error("frozen HL short notional must remain $25,000");
  if (config.leverage !== 25) throw new Error("HYPE cross-margin leverage must match the 25x long owner");
  if (!Number.isFinite(config.feeRate) || config.feeRate < 0) throw new Error("invalid HL short fee rate");
  if (!Number.isFinite(config.pollIntervalMs) || config.pollIntervalMs < 1_000) throw new Error("invalid HL short poll interval");
  if (!Number.isFinite(config.maximumSignalAgeMs) || config.maximumSignalAgeMs <= 0) throw new Error("invalid signal age limit");
  return config;
}

function fileAge(filePath: string, now: number): number | null {
  try { return Math.max(0, now - fs.statSync(path.resolve(filePath)).mtimeMs); }
  catch { return null; }
}

function readShadowHealth(config: HlShortLiveConfig, now: number): {
  health: HlShortBreakdownShadowHealthV1 | null;
  ageMs: number | null;
  healthy: boolean;
  error: string | null;
} {
  const ageMs = fileAge(config.shadowHealthFile, now);
  try {
    const health = JSON.parse(fs.readFileSync(path.resolve(config.shadowHealthFile), "utf8")) as HlShortBreakdownShadowHealthV1;
    if (
      health.version !== 1
      || health.symbol !== config.symbol
      || health.candidate !== HL_SHORT_BREAKDOWN_CANDIDATE
      || health.policyVersion !== HL_SHORT_BREAKDOWN_POLICY_VERSION
      || health.policySignature !== HL_SHORT_BREAKDOWN_POLICY_SIGNATURE
      || health.shadowOnly !== true
    ) throw new Error("shadow health identity/policy mismatch");
    const healthy = health.status === "healthy" && ageMs !== null && ageMs <= config.maximumShadowHealthAgeMs;
    return { health, ageMs, healthy, error: healthy ? null : `shadow_${health.status}_or_stale` };
  } catch (err: any) {
    return { health: null, ageMs, healthy: false, error: err?.message ?? String(err) };
  }
}

function validateSignalEvent(raw: unknown): HlShortSignalEvent {
  const event = raw as Partial<HlShortSignalEvent>;
  if (
    event.event !== "signal"
    || event.symbol !== "HYPEUSDT"
    || event.candidate !== HL_SHORT_BREAKDOWN_CANDIDATE
    || event.policyVersion !== HL_SHORT_BREAKDOWN_POLICY_VERSION
    || event.shadowOnly !== true
    || typeof event.signalId !== "string"
    || !event.signalId.startsWith(`hlbp-HYPEUSDT-`)
    || !event.features
    || event.features.candidate !== HL_SHORT_BREAKDOWN_CANDIDATE
    || event.features.policyVersion !== HL_SHORT_BREAKDOWN_POLICY_VERSION
    || event.features.ready !== true
    || event.features.fired !== true
    || event.features.decisionTs !== Number(event.signalId.split("-").at(-1))
  ) throw new Error("invalid or non-firing HL short signal event");
  return event as HlShortSignalEvent;
}

export function readJournalChunk(filePath: string, offset: number): {
  rows: unknown[];
  nextOffset: number;
  size: number;
} {
  const absolute = path.resolve(filePath);
  const stat = fs.statSync(absolute);
  if (stat.size < offset) throw new Error(`signal journal truncated from ${offset} to ${stat.size}`);
  if (stat.size === offset) return { rows: [], nextOffset: offset, size: stat.size };
  const length = stat.size - offset;
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(absolute, "r");
  try { fs.readSync(fd, buffer, 0, length, offset); }
  finally { fs.closeSync(fd); }
  const lastNewline = buffer.lastIndexOf(0x0a);
  if (lastNewline < 0) return { rows: [], nextOffset: offset, size: stat.size };
  const complete = buffer.subarray(0, lastNewline + 1).toString("utf8");
  const rows = complete.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => JSON.parse(line));
  return { rows, nextOffset: offset + lastNewline + 1, size: stat.size };
}

export class HlShortLiveOwner {
  private readonly startedAt: number;
  private readonly config: HlShortLiveConfig;
  private readonly state: HlShortLiveStateStore;
  private readonly logger: BotLogger;
  private readonly alerter: LadderAlerter;
  private readonly coordinator: HlShortTransactionCoordinator | null;
  private lastPollAt: number | null = null;
  private journalSize: number | null = null;
  private journalError: string | null = null;
  private shadowStatus = { fileAgeMs: null as number | null, status: null as string | null, healthy: false, error: null as string | null };

  constructor(config: HlShortLiveConfig, startedAt = Date.now()) {
    this.startedAt = startedAt;
    this.config = config;
    this.logger = new BotLogger(config.logDir);
    this.alerter = new LadderAlerter(config.symbol);
    this.state = new HlShortLiveStateStore(config.stateFile, startedAt);
    if (!config.enabled && (this.state.get().position || this.state.get().pending || this.state.get().recoveryMode)) {
      throw new Error("cannot disable HYPE short execution owner while managed transaction state is active");
    }
    if (config.enabled) {
      const apiKey = process.env.BYBIT_API_KEY;
      const apiSecret = process.env.BYBIT_API_SECRET;
      if (!apiKey || !apiSecret) throw new Error("enabled HL short owner requires BYBIT_API_KEY and BYBIT_API_SECRET");
      this.coordinator = new HlShortTransactionCoordinator(
        this.state,
        new LiveExecutor(apiKey, apiSecret, this.logger),
        { symbol: config.symbol, leverage: config.leverage, feeRate: config.feeRate },
      );
    } else {
      this.coordinator = null;
    }
  }

  async initialize(now = Date.now()): Promise<void> {
    const journalPath = path.resolve(this.config.signalJournalFile);
    const journalSize = fs.statSync(journalPath).size;
    this.journalSize = journalSize;
    if (this.state.get().eventOffset === null) {
      this.state.initializeEventOffset(journalSize, now);
      this.logger.info(`HL short live cursor initialized at journal end (${journalSize}); historical signals will not replay`);
    }
    if (this.coordinator) {
      if (!await this.coordinator.executor.ensureHedgeMode(this.config.symbol)) {
        this.state.enterRecovery("startup_hedge_mode_unconfirmed", now);
      } else {
        const result = await this.coordinator.reconcile(now);
        this.logger.info(`HL short startup reconciliation: ${result.status} remaining=${result.remainingQty ?? "unknown"}`);
      }
    }
    this.writeHealth(now);
  }

  private async handleSignal(event: HlShortSignalEvent, shadowHealthy: boolean, now: number): Promise<void> {
    if (this.state.isSignalKnown(event.signalId)) return;
    const ageMs = Math.max(0, now - event.features.decisionTs);
    if (!this.config.enabled || !this.config.entryEnabled) {
      this.state.recordSignalSkip(
        event.signalId,
        event.features.decisionTs,
        this.config.enabled ? "new_short_entries_disabled" : "live_owner_disabled",
        now,
      );
      return;
    }
    if (!shadowHealthy) {
      this.state.recordSignalSkip(event.signalId, event.features.decisionTs, "shadow_health_unconfirmed", now);
      return;
    }
    if (ageMs > this.config.maximumSignalAgeMs) {
      this.state.recordSignalSkip(event.signalId, event.features.decisionTs, `signal_stale:${ageMs}`, now);
      return;
    }
    const result = await this.coordinator!.executeOpen(event.signalId, event.features.decisionTs, this.config.notionalUsdt, now);
    this.logger.info(`HL short signal ${event.signalId}: ${result.outcome}/${result.status} qty=${result.remainingQty ?? "unknown"}`);
    const position = this.state.get().position;
    if (result.outcome === "committed" && result.action === "open" && position) {
      await this.alerter.notifyShortOpened(
        "hl",
        position.entryPrice,
        position.takeProfit,
        position.stopLoss,
        position.qty,
        position.notional,
        position.expiresAt,
      );
    } else if (result.outcome === "committed" && result.action === "close" && result.avgPrice !== null) {
      const openReceipt = [...this.state.get().receipts].reverse().find(receipt =>
        receipt.kind === "short_open" && receipt.signalId === event.signalId && receipt.avgPrice !== null,
      );
      if (openReceipt?.avgPrice) {
        await this.alerter.notifyShortClosed(
          "hl",
          result.status,
          openReceipt.avgPrice,
          result.avgPrice,
          result.pnl,
          Math.max(0, now - openReceipt.completedAt) / 3_600_000,
        );
      }
    }
  }

  async poll(now = Date.now()): Promise<HlShortLiveHealthV1> {
    this.lastPollAt = now;
    const shadow = readShadowHealth(this.config, now);
    this.shadowStatus = {
      fileAgeMs: shadow.ageMs,
      status: shadow.health?.status ?? null,
      healthy: shadow.healthy,
      error: shadow.error,
    };
    if (this.coordinator) {
      const beforePosition = this.state.get().position ? { ...this.state.get().position! } : null;
      const reconcile = await this.coordinator.reconcile(now);
      if (reconcile.outcome === "recovery" || reconcile.outcome === "pending") {
        this.logger.warn(`HL short reconcile: ${reconcile.outcome}/${reconcile.status}${reconcile.error ? ` ${reconcile.error}` : ""}`);
      } else if (
        beforePosition
        && reconcile.action === "close"
        && reconcile.outcome === "committed"
        && reconcile.avgPrice !== null
        && !this.state.get().position
      ) {
        this.logger.info(`HL SHORT CLOSED: ${reconcile.status} PnL=$${reconcile.pnl.toFixed(2)} @ $${reconcile.avgPrice.toFixed(4)}`);
        await this.alerter.notifyShortClosed(
          "hl",
          reconcile.status,
          beforePosition.entryPrice,
          reconcile.avgPrice,
          reconcile.pnl,
          Math.max(0, now - beforePosition.entryTime) / 3_600_000,
        );
      }
    }

    const offset = this.state.get().eventOffset;
    if (offset === null) throw new Error("HL short journal cursor is not initialized");
    try {
      const chunk = readJournalChunk(this.config.signalJournalFile, offset);
      this.journalSize = chunk.size;
      this.journalError = null;
      for (const row of chunk.rows) {
        const rawEvent = row as { event?: unknown };
        if (rawEvent.event !== "signal") continue;
        try {
          const event = validateSignalEvent(row);
          const healthConfirmsDecision = shadow.healthy
            && shadow.health !== null
            && shadow.health.writtenAt >= event.features.decisionTs
            && shadow.health.decision.lastTs !== null
            && shadow.health.decision.lastTs >= event.features.decisionTs;
          await this.handleSignal(event, healthConfirmsDecision, now);
        } catch (err: any) {
          this.journalError = `signal_event:${err?.message ?? err}`;
          this.state.enterRecovery(this.journalError, now);
          throw err;
        }
      }
      this.state.advanceEventOffset(chunk.nextOffset, now);
    } catch (err: any) {
      this.journalError = err?.message ?? String(err);
      if (this.config.enabled) this.state.enterRecovery(`signal_journal:${this.journalError}`, now);
      this.logger.logError(`HL short signal journal: ${this.journalError}`);
    }
    return this.writeHealth(now);
  }

  private buildHealth(now: number): HlShortLiveHealthV1 {
    const state = this.state.get();
    const position = state.position;
    const pending = state.pending;
    const reasons = [
      ...(state.recoveryReason ? [state.recoveryReason] : []),
      ...(this.journalError ? [`journal:${this.journalError}`] : []),
      ...(this.config.entryEnabled && !this.shadowStatus.healthy ? [`shadow:${this.shadowStatus.error ?? "unhealthy"}`] : []),
    ];
    const status: HlShortLiveHealthV1["status"] = !this.config.enabled ? "disabled"
      : state.recoveryMode ? "recovery"
      : reasons.length > 0 ? "degraded" : "healthy";
    return {
      version: 1,
      symbol: this.config.symbol,
      candidate: HL_SHORT_BREAKDOWN_CANDIDATE,
      policyVersion: HL_SHORT_BREAKDOWN_POLICY_VERSION,
      policySignature: HL_SHORT_BREAKDOWN_POLICY_SIGNATURE,
      executionOwner: true,
      enabled: this.config.enabled,
      entryEnabled: this.config.entryEnabled,
      processStartedAt: this.startedAt,
      writtenAt: now,
      status,
      statusReasons: reasons,
      poll: { lastAt: this.lastPollAt, intervalMs: this.config.pollIntervalMs },
      journal: { file: this.config.signalJournalFile, offset: state.eventOffset, size: this.journalSize, error: this.journalError },
      shadow: { ...this.shadowStatus },
      position: {
        active: position !== null,
        signalId: position?.signalId ?? null,
        qty: position?.qty ?? 0,
        entryPrice: position?.entryPrice ?? null,
        notional: position?.notional ?? 0,
        takeProfit: position?.takeProfit ?? null,
        stopLoss: position?.stopLoss ?? null,
        expiresAt: position?.expiresAt ?? null,
        protectionStatus: position?.protectionStatus ?? null,
        protectionFailureCount: position?.protectionFailureCount ?? 0,
      },
      pending: {
        active: pending !== null,
        kind: pending?.kind ?? null,
        orderLinkId: pending?.orderLinkId ?? null,
        ageMs: pending ? Math.max(0, now - pending.createdAt) : null,
        lastObservedStatus: pending?.lastObservedStatus ?? null,
      },
      recovery: { active: state.recoveryMode, reason: state.recoveryReason },
      reconciliation: { lastAt: state.lastReconcileAt, exchangeQty: state.lastExchangeQty },
      totals: { realizedPnl: state.realizedPnl, fees: state.totalFees, receipts: state.receipts.length, processedSignals: state.processedSignalIds.length },
    };
  }

  private writeHealth(now: number): HlShortLiveHealthV1 {
    const health = this.buildHealth(now);
    atomicWriteJson(this.config.healthFile, health);
    return health;
  }
}

async function dryRun(config: HlShortLiveConfig): Promise<void> {
  const now = Date.now();
  const stateExists = fs.existsSync(path.resolve(config.stateFile));
  const state = stateExists ? new HlShortLiveStateStore(config.stateFile, now).get() : null;
  const shadow = readShadowHealth(config, now);
  let journalSize: number | null = null;
  let journalError: string | null = null;
  try { journalSize = fs.statSync(path.resolve(config.signalJournalFile)).size; }
  catch (err: any) { journalError = err?.message ?? String(err); }
  console.log(JSON.stringify({
    dryRun: true,
    executionEnabled: config.enabled,
    entryEnabled: config.entryEnabled,
    frozenNotionalUsdt: config.notionalUsdt,
    frozenExit: { takeProfitPct: 2, stopLossPct: 4, maximumHoldHours: 12 },
    leverage: config.leverage,
    shadow: { healthy: shadow.healthy, status: shadow.health?.status ?? null, ageMs: shadow.ageMs, error: shadow.error },
    state: state ? { pending: state.pending, position: state.position, recoveryMode: state.recoveryMode, recoveryReason: state.recoveryReason, eventOffset: state.eventOffset } : null,
    journal: {
      size: journalSize,
      error: journalError,
      unreadBytes: journalSize === null || state?.eventOffset === null || state?.eventOffset === undefined
        ? 0 : Math.max(0, journalSize - state.eventOffset),
    },
    safeToStartDisarmed: !config.enabled && shadow.healthy && journalSize !== null,
  }, null, 2));
}

async function exchangePreflight(config: HlShortLiveConfig): Promise<void> {
  const apiKey = process.env.BYBIT_API_KEY;
  const apiSecret = process.env.BYBIT_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("exchange preflight requires BYBIT_API_KEY and BYBIT_API_SECRET");
  const now = Date.now();
  const logger = new BotLogger(config.logDir);
  const executor = new LiveExecutor(apiKey, apiSecret, logger);
  const [exchange, lotInfo] = await Promise.all([
    executor.getShortPositionSnapshot(config.symbol),
    executor.getInstrumentLotInfo(config.symbol),
  ]);
  const state = fs.existsSync(path.resolve(config.stateFile))
    ? new HlShortLiveStateStore(config.stateFile, now).get() : null;
  let legacyPosition: unknown = "unknown";
  try {
    const legacyConfig = JSON.parse(fs.readFileSync(path.resolve("wed-short-config.json"), "utf8"));
    const legacyState = JSON.parse(fs.readFileSync(path.resolve(legacyConfig.stateFile), "utf8"));
    legacyPosition = legacyState?.position ?? null;
  } catch { /* reported as unknown and therefore not safe */ }
  let mainHedgeEnabled: boolean | "unknown" = "unknown";
  let mainHedgePosition: unknown = "unknown";
  let mainPendingOrder: unknown = "unknown";
  let mainLeverage: number | "unknown" = "unknown";
  try {
    const mainConfig = JSON.parse(fs.readFileSync(path.resolve("bot-config.json"), "utf8"));
    mainHedgeEnabled = mainConfig?.hedge?.enabled === true;
    mainLeverage = typeof mainConfig?.leverage === "number" ? mainConfig.leverage : "unknown";
    const mainState = JSON.parse(fs.readFileSync(path.resolve(mainConfig.stateFile ?? "bot-state.json"), "utf8"));
    mainHedgePosition = mainState?.hedgePosition ?? null;
    mainPendingOrder = mainState?.pendingOrder ?? null;
  } catch { /* reported as unknown and therefore not safe */ }
  const shadow = readShadowHealth(config, now);
  const exchangeFlat = exchange.size <= Math.max(lotInfo.qtyStep / 2, 1e-8);
  const newStateFlat = !state?.position && !state?.pending && state?.recoveryMode !== true;
  const legacyFlat = legacyPosition === null;
  const safeToRetireLegacy = exchangeFlat && legacyFlat;
  const mainHedgeFlat = mainHedgePosition === null;
  const mainPendingClear = mainPendingOrder === null;
  const leverageMatchesLong = mainLeverage === config.leverage;
  const safeToArm = safeToRetireLegacy
    && newStateFlat
    && shadow.healthy
    && mainHedgeEnabled === false
    && mainHedgeFlat
    && mainPendingClear
    && leverageMatchesLong;
  console.log(JSON.stringify({
    readOnly: true,
    symbol: config.symbol,
    configured: { executionEnabled: config.enabled, entryEnabled: config.entryEnabled, notionalUsdt: config.notionalUsdt, leverage: config.leverage },
    exchangeShort: exchange,
    qtyStep: lotInfo.qtyStep,
    legacyWedShortPosition: legacyPosition,
    mainHedgeEnabled,
    mainHedgePosition,
    mainPendingOrder,
    mainLeverage,
    transactionalState: state ? {
      position: state.position,
      pending: state.pending,
      recoveryMode: state.recoveryMode,
      recoveryReason: state.recoveryReason,
      eventOffset: state.eventOffset,
    } : null,
    shadow: { healthy: shadow.healthy, status: shadow.health?.status ?? null, ageMs: shadow.ageMs, error: shadow.error },
    checks: {
      exchangeFlat,
      legacyFlat,
      newStateFlat,
      shadowHealthy: shadow.healthy,
      mainHedgeDisabled: mainHedgeEnabled === false,
      mainHedgeFlat,
      mainPendingClear,
      leverageMatchesLong,
    },
    safeToRetireLegacy,
    safeToArm,
  }, null, 2));
  if (!safeToArm) process.exitCode = 2;
}

async function main(): Promise<void> {
  const configPath = parseArg("config") ?? "hl-short-live-config.json";
  const config = loadHlShortLiveConfig(configPath);
  const once = process.argv.includes("--once");
  const isDryRun = process.argv.includes("--dry-run");
  if (process.argv.includes("--exchange-preflight")) {
    await exchangePreflight(config);
    return;
  }
  if (isDryRun) {
    await dryRun(config);
    return;
  }
  const releaseOwnerLock = acquireOwnerLock(config);
  process.once("exit", releaseOwnerLock);
  process.once("SIGINT", () => { releaseOwnerLock(); process.exit(0); });
  process.once("SIGTERM", () => { releaseOwnerLock(); process.exit(0); });
  const owner = new HlShortLiveOwner(config);
  await owner.initialize();
  const first = await owner.poll();
  console.log(`[hl-short-live] enabled=${config.enabled} entries=${config.entryEnabled} status=${first.status} notional=$${config.notionalUsdt} position=${first.position.qty} pending=${first.pending.kind ?? "none"}`);
  if (once) return;
  for (;;) {
    await sleep(config.pollIntervalMs);
    try { await owner.poll(); }
    catch (err: any) { console.error(`[hl-short-live] poll failed: ${err?.message ?? err}`); }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(`[hl-short-live] fatal: ${err?.stack ?? err}`);
    process.exit(1);
  });
}
