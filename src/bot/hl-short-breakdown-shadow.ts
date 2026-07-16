import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import {
  advanceHlShortShadowPosition,
  computeHlShortBreakdownFeatures,
  createHlShortShadowPosition,
  HL_SHORT_BREAKDOWN_CANDIDATE,
  HL_SHORT_BREAKDOWN_POLICY,
  HL_SHORT_BREAKDOWN_POLICY_SIGNATURE,
  HL_SHORT_BREAKDOWN_POLICY_VERSION,
  HlShortAssetSample,
  HlShortBookSample,
  HlShortBreakdownFeatures,
  HlShortMinuteCandle,
  HlShortShadowClose,
  HlShortShadowEntryMode,
  HlShortShadowPosition,
  HlShortTakerMinute,
} from "./hl-short-breakdown-policy";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const POLL_MS = 5_000;
const MINUTE = 60_000;
const RETENTION_MS = 48 * 60 * 60_000;
const MAX_CATCHUP_MS = RETENTION_MS - 60 * MINUTE;

type TrackStatus = "pending" | "open" | "closed";

interface PersistedTrack {
  mode: HlShortShadowEntryMode;
  entryTime: number;
  status: TrackStatus;
  position: HlShortShadowPosition | null;
  close: HlShortShadowClose | null;
}

interface PersistedRun {
  signalId: string;
  decisionTs: number;
  features: HlShortBreakdownFeatures;
  tracks: PersistedTrack[];
}

interface ShadowCounters {
  decisions: number;
  healthyDecisions: number;
  rawSignals: number;
  openedRuns: number;
  skippedActive: number;
  immediateCloses: number;
  delayedCloses: number;
  immediatePnlPct: number;
  delayedPnlPct: number;
  immediateStressPnlPct: number;
  delayedStressPnlPct: number;
}

interface HlShortBreakdownShadowStateV1 {
  version: 1;
  symbol: "HYPEUSDT";
  candidate: typeof HL_SHORT_BREAKDOWN_CANDIDATE;
  policyVersion: typeof HL_SHORT_BREAKDOWN_POLICY_VERSION;
  policySignature: string;
  createdAt: number;
  updatedAt: number;
  lastPollAt: number | null;
  lastDecisionTs: number | null;
  lastDecisionReady: boolean | null;
  lastDecisionBlockers: string[];
  lastRawSignalTs: number | null;
  integrity: {
    healthy: boolean;
    reason: string | null;
    observedAt: number | null;
    gapMs: number | null;
  };
  runs: PersistedRun[];
  counters: ShadowCounters;
}

export interface HlShortBreakdownShadowHealthV1 {
  version: 1;
  symbol: "HYPEUSDT";
  candidate: typeof HL_SHORT_BREAKDOWN_CANDIDATE;
  policyVersion: typeof HL_SHORT_BREAKDOWN_POLICY_VERSION;
  policySignature: string;
  shadowOnly: true;
  processStartedAt: number;
  writtenAt: number;
  status: "warming_up" | "healthy" | "degraded";
  statusReasons: string[];
  poll: {
    lastAt: number | null;
    intervalMs: number;
  };
  decision: {
    lastTs: number | null;
    ageMs: number | null;
    ready: boolean | null;
    blockers: string[];
  };
  sources: Array<{
    name: string;
    path: string;
    exists: boolean;
    latestSourceTs: number | null;
    ageMs: number | null;
    error: string | null;
  }>;
  active: {
    runs: number;
    immediateOpenOrPending: number;
    delayedOpenOrPending: number;
  };
  integrity: HlShortBreakdownShadowStateV1["integrity"];
  counters: ShadowCounters;
}

interface TailStatus {
  name: string;
  filePath: string;
  exists: boolean;
  error: string | null;
}

class JsonlTailer {
  private offset = 0;
  private remainder = "";
  private initialized = false;
  private readonly onRow: (row: Record<string, unknown>) => void;
  readonly status: TailStatus;

  constructor(
    name: string,
    filePath: string,
    private readonly bootstrapBytes: number,
    onRow: (row: Record<string, unknown>) => void,
  ) {
    this.status = { name, filePath, exists: false, error: null };
    this.onRow = onRow;
  }

  private consume(text: string, discardFirstPartial: boolean): void {
    let input = text;
    if (discardFirstPartial) {
      const newline = input.indexOf("\n");
      input = newline >= 0 ? input.slice(newline + 1) : "";
    }
    const combined = this.remainder + input;
    const lines = combined.split(/\r?\n/);
    this.remainder = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        this.onRow(JSON.parse(line));
      } catch {
        // Skip a malformed complete row. Collector and health checks retain the error boundary.
      }
    }
  }

  private bootstrap(): void {
    const stat = fs.statSync(this.status.filePath);
    const start = Math.max(0, stat.size - this.bootstrapBytes);
    const length = stat.size - start;
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(this.status.filePath, "r");
    try {
      if (length > 0) fs.readSync(fd, buffer, 0, length, start);
    } finally {
      fs.closeSync(fd);
    }
    this.offset = stat.size;
    this.remainder = "";
    this.consume(buffer.toString("utf8"), start > 0);
    this.initialized = true;
  }

  poll(): void {
    try {
      if (!fs.existsSync(this.status.filePath)) {
        this.status.exists = false;
        this.status.error = "missing";
        return;
      }
      this.status.exists = true;
      const stat = fs.statSync(this.status.filePath);
      if (!this.initialized || stat.size < this.offset) {
        this.bootstrap();
      } else if (stat.size > this.offset) {
        const length = stat.size - this.offset;
        const buffer = Buffer.alloc(length);
        const fd = fs.openSync(this.status.filePath, "r");
        try {
          fs.readSync(fd, buffer, 0, length, this.offset);
        } finally {
          fs.closeSync(fd);
        }
        this.offset = stat.size;
        this.consume(buffer.toString("utf8"), false);
      }
      this.status.error = null;
    } catch (err: any) {
      this.status.error = err?.message ?? String(err);
    }
  }
}

function finite(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function upsertByTimestamp<T extends { timestamp: number }>(rows: T[], row: T): void {
  const last = rows.at(-1);
  if (!last || row.timestamp > last.timestamp) {
    rows.push(row);
    return;
  }
  if (row.timestamp === last.timestamp) {
    rows[rows.length - 1] = row;
    return;
  }
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (rows[mid].timestamp < row.timestamp) lo = mid + 1;
    else hi = mid;
  }
  if (lo < rows.length && rows[lo].timestamp === row.timestamp) rows[lo] = row;
  else rows.splice(lo, 0, row);
}

function insertByTimestamp<T extends { timestamp: number }>(rows: T[], row: T): void {
  const last = rows.at(-1);
  if (!last || row.timestamp >= last.timestamp) {
    rows.push(row);
    return;
  }
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (rows[mid].timestamp <= row.timestamp) lo = mid + 1;
    else hi = mid;
  }
  rows.splice(lo, 0, row);
}

function defaultCounters(): ShadowCounters {
  return {
    decisions: 0,
    healthyDecisions: 0,
    rawSignals: 0,
    openedRuns: 0,
    skippedActive: 0,
    immediateCloses: 0,
    delayedCloses: 0,
    immediatePnlPct: 0,
    delayedPnlPct: 0,
    immediateStressPnlPct: 0,
    delayedStressPnlPct: 0,
  };
}

function defaultState(now: number): HlShortBreakdownShadowStateV1 {
  return {
    version: 1,
    symbol: "HYPEUSDT",
    candidate: HL_SHORT_BREAKDOWN_CANDIDATE,
    policyVersion: HL_SHORT_BREAKDOWN_POLICY_VERSION,
    policySignature: HL_SHORT_BREAKDOWN_POLICY_SIGNATURE,
    createdAt: now,
    updatedAt: now,
    lastPollAt: null,
    lastDecisionTs: null,
    lastDecisionReady: null,
    lastDecisionBlockers: [],
    lastRawSignalTs: null,
    integrity: { healthy: true, reason: null, observedAt: null, gapMs: null },
    runs: [],
    counters: defaultCounters(),
  };
}

function readState(filePath: string, now: number): HlShortBreakdownShadowStateV1 {
  if (!fs.existsSync(filePath)) return defaultState(now);
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<HlShortBreakdownShadowStateV1>;
  if (parsed.version !== 1 || parsed.symbol !== "HYPEUSDT" || parsed.candidate !== HL_SHORT_BREAKDOWN_CANDIDATE) {
    throw new Error("unsupported HYPE HL short shadow state");
  }
  if (parsed.policyVersion !== HL_SHORT_BREAKDOWN_POLICY_VERSION || parsed.policySignature !== HL_SHORT_BREAKDOWN_POLICY_SIGNATURE) {
    throw new Error("HYPE HL short shadow policy changed; archive state before starting a new observation cohort");
  }
  if (!parsed.integrity) parsed.integrity = { healthy: true, reason: null, observedAt: null, gapMs: null };
  return parsed as HlShortBreakdownShadowStateV1;
}

function atomicWriteJson(filePath: string, value: unknown): { success: true } | { success: false; error: string } {
  const dir = path.dirname(filePath);
  const temp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(value));
    fs.renameSync(temp, filePath);
    return { success: true };
  } catch (err: any) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch { /* best effort */ }
    return { success: false, error: err?.message ?? String(err) };
  }
}

export class HlShortBreakdownShadow {
  private readonly symbol = "HYPEUSDT" as const;
  private readonly rootDir: string;
  private readonly dataDir: string;
  private readonly stateFile: string;
  private readonly healthFile: string;
  private readonly eventsFile: string;
  private readonly processStartedAt: number;
  private readonly candles: HlShortMinuteCandle[] = [];
  private readonly taker: HlShortTakerMinute[] = [];
  private readonly book: HlShortBookSample[] = [];
  private readonly asset: HlShortAssetSample[] = [];
  private readonly tailers: JsonlTailer[];
  private state: HlShortBreakdownShadowStateV1;
  private dryRun = false;
  private runtimeErrors: string[] = [];

  constructor(rootDir: string = process.cwd(), now: number = Date.now()) {
    this.rootDir = path.resolve(rootDir);
    this.dataDir = path.join(this.rootDir, "data");
    this.stateFile = path.join(this.dataDir, `${this.symbol}_hl_short_breakdown_shadow_state.json`);
    this.healthFile = path.join(this.dataDir, `${this.symbol}_hl_short_breakdown_shadow_health.json`);
    this.eventsFile = path.join(this.dataDir, `${this.symbol}_hl_short_breakdown_shadow.jsonl`);
    this.processStartedAt = now;
    this.state = readState(this.stateFile, now);
    this.tailers = [
      new JsonlTailer("bybit_1m", path.join(this.dataDir, `${this.symbol}_1m.jsonl`), 8 * 1024 * 1024, row => this.ingestCandle(row)),
      new JsonlTailer("hl_taker_1m", path.join(this.dataDir, `${this.symbol}_taker_hyperliquid.jsonl`), 8 * 1024 * 1024, row => this.ingestTaker(row)),
      new JsonlTailer("hl_ob_bands", path.join(this.dataDir, `${this.symbol}_ob_bands_hyperliquid.jsonl`), 32 * 1024 * 1024, row => this.ingestBook(row)),
      new JsonlTailer("hl_asset_ctx", path.join(this.dataDir, `${this.symbol}_asset_ctx_hyperliquid.jsonl`), 8 * 1024 * 1024, row => this.ingestAsset(row)),
    ];
  }

  private ingestCandle(row: Record<string, unknown>): void {
    const timestamp = finite(row.ts ?? row.timestamp);
    const open = finite(row.o ?? row.open);
    const high = finite(row.h ?? row.high);
    const low = finite(row.l ?? row.low);
    const close = finite(row.c ?? row.close);
    if (timestamp === null || open === null || high === null || low === null || close === null) return;
    upsertByTimestamp(this.candles, { timestamp, open, high, low, close, volume: finite(row.v ?? row.volume) ?? undefined });
  }

  private ingestTaker(row: Record<string, unknown>): void {
    const timestamp = finite(row.timestamp ?? row.ts);
    const buyNotional = finite(row.buyNotional ?? row.buyVol);
    const sellNotional = finite(row.sellNotional ?? row.sellVol);
    if (timestamp === null || buyNotional === null || sellNotional === null) return;
    upsertByTimestamp(this.taker, { timestamp, buyNotional, sellNotional });
  }

  private ingestBook(row: Record<string, unknown>): void {
    const timestamp = finite(row.timestamp ?? row.ts);
    const imbalance05 = finite(row.imbalance_0_5);
    if (timestamp === null || imbalance05 === null) return;
    insertByTimestamp(this.book, { timestamp, imbalance05 });
  }

  private ingestAsset(row: Record<string, unknown>): void {
    const timestamp = finite(row.timestamp ?? row.ts);
    if (timestamp === null) return;
    upsertByTimestamp(this.asset, { timestamp });
  }

  private appendEvent(type: string, eventId: string, now: number, detail: Record<string, unknown>): void {
    if (this.dryRun) return;
    try {
      if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
      fs.appendFileSync(this.eventsFile, JSON.stringify({
        ts: new Date(now).toISOString(),
        timestamp: now,
        symbol: this.symbol,
        candidate: HL_SHORT_BREAKDOWN_CANDIDATE,
        policyVersion: HL_SHORT_BREAKDOWN_POLICY_VERSION,
        shadowOnly: true,
        event: type,
        eventId,
        ...detail,
      }) + "\n");
    } catch (err: any) {
      this.runtimeErrors.push(`event_write:${err?.message ?? err}`);
    }
  }

  private prune(now: number): void {
    const cutoff = now - RETENTION_MS;
    while (this.candles.length && this.candles[0].timestamp < cutoff) this.candles.shift();
    while (this.taker.length && this.taker[0].timestamp < cutoff) this.taker.shift();
    while (this.book.length && this.book[0].timestamp < cutoff) this.book.shift();
    while (this.asset.length && this.asset[0].timestamp < cutoff) this.asset.shift();
  }

  private hasActiveImmediate(): boolean {
    return this.state.runs.some(run => run.tracks.some(track => track.mode === "decision_open" && track.status !== "closed"));
  }

  private openRun(features: HlShortBreakdownFeatures): void {
    const signalId = `hlbp-${this.symbol}-${features.decisionTs}`;
    const tracks: PersistedTrack[] = [
      { mode: "decision_open", entryTime: features.decisionTs, status: "pending", position: null, close: null },
      { mode: "delay_1m_open", entryTime: features.decisionTs + MINUTE, status: "pending", position: null, close: null },
    ];
    this.state.runs.push({ signalId, decisionTs: features.decisionTs, features, tracks });
    this.state.counters.openedRuns++;
    this.appendEvent("signal", `signal:${signalId}`, features.decisionTs, { signalId, features });
  }

  private evaluateDecision(decisionTs: number): void {
    const features = computeHlShortBreakdownFeatures({
      decisionTs,
      candles: this.candles,
      taker: this.taker,
      book: this.book,
      asset: this.asset,
    });
    this.state.lastDecisionTs = decisionTs;
    this.state.lastDecisionReady = features.ready;
    this.state.lastDecisionBlockers = features.blockers;
    this.state.counters.decisions++;
    if (features.ready) this.state.counters.healthyDecisions++;
    let outcome = features.ready ? "not_fired" : "blocked_inputs";
    if (features.fired) {
      const cooldown = this.state.lastRawSignalTs !== null
        && decisionTs - this.state.lastRawSignalTs < HL_SHORT_BREAKDOWN_POLICY.rawSignalCooldownMs;
      if (cooldown) {
        outcome = "blocked_cooldown";
      } else {
        this.state.lastRawSignalTs = decisionTs;
        this.state.counters.rawSignals++;
        if (this.hasActiveImmediate()) {
          outcome = "skipped_active";
          this.state.counters.skippedActive++;
        } else {
          outcome = "opened_shadow_run";
          this.openRun(features);
        }
      }
    }
    this.appendEvent("decision", `decision:${decisionTs}`, decisionTs, { decisionTs, outcome, features });
    console.log(`[hl-short-shadow] decision=${new Date(decisionTs).toISOString()} ready=${features.ready} fired=${features.fired} outcome=${outcome}`);
  }

  private recordClose(run: PersistedRun, track: PersistedTrack, close: HlShortShadowClose): void {
    if (track.mode === "decision_open") {
      this.state.counters.immediateCloses++;
      this.state.counters.immediatePnlPct += close.pnlPctAfterFees;
      this.state.counters.immediateStressPnlPct += close.pnlPctStressFees;
    } else {
      this.state.counters.delayedCloses++;
      this.state.counters.delayedPnlPct += close.pnlPctAfterFees;
      this.state.counters.delayedStressPnlPct += close.pnlPctStressFees;
    }
    this.appendEvent("close", `close:${run.signalId}:${track.mode}`, close.exitTime, { signalId: run.signalId, decisionTs: run.decisionTs, close });
    console.log(`[hl-short-shadow] close ${run.signalId} ${track.mode} ${close.outcome} pnl=${close.pnlPctAfterFees.toFixed(3)}% stress=${close.pnlPctStressFees.toFixed(3)}%`);
  }

  private updateRuns(untilExclusive = Infinity): void {
    const candleByTs = new Map(this.candles.map(candle => [candle.timestamp, candle]));
    for (const run of this.state.runs) {
      for (const track of run.tracks) {
        if (track.status === "pending") {
          const entryCandle = candleByTs.get(track.entryTime);
          if (!entryCandle || entryCandle.timestamp >= untilExclusive) continue;
          track.position = createHlShortShadowPosition(track.mode, track.entryTime, entryCandle.open);
          track.status = "open";
          this.appendEvent("open", `open:${run.signalId}:${track.mode}`, track.entryTime, {
            signalId: run.signalId,
            decisionTs: run.decisionTs,
            mode: track.mode,
            entryTime: track.entryTime,
            entryPrice: entryCandle.open,
            tpPrice: track.position.tpPrice,
            stopPrice: track.position.stopPrice,
            expiresAt: track.position.expiresAt,
          });
        }
        if (track.status !== "open" || !track.position) continue;
        const pendingCandles = this.candles.filter(candle =>
          candle.timestamp >= track.entryTime
          && candle.timestamp < untilExclusive
          && (track.position!.lastProcessedCandleTs === null || candle.timestamp > track.position!.lastProcessedCandleTs!),
        );
        for (const candle of pendingCandles) {
          const advanced = advanceHlShortShadowPosition(track.position, candle);
          track.position = advanced.position;
          if (advanced.close) {
            track.status = "closed";
            track.close = advanced.close;
            this.recordClose(run, track, advanced.close);
            break;
          }
        }
      }
    }
    this.state.runs = this.state.runs.filter(run => run.tracks.some(track => track.status !== "closed"));
  }

  private latestSourceTs(name: string): number | null {
    if (name === "bybit_1m") return this.candles.at(-1)?.timestamp ?? null;
    if (name === "hl_taker_1m") return this.taker.at(-1)?.timestamp ?? null;
    if (name === "hl_ob_bands") return this.book.at(-1)?.timestamp ?? null;
    return this.asset.at(-1)?.timestamp ?? null;
  }

  private health(now: number): HlShortBreakdownShadowHealthV1 {
    const statusReasons = [...this.runtimeErrors];
    if (!this.state.integrity.healthy) statusReasons.push(this.state.integrity.reason ?? "observation_integrity_unhealthy");
    const sources = this.tailers.map(tailer => {
      const latestSourceTs = this.latestSourceTs(tailer.status.name);
      const ageMs = latestSourceTs === null ? null : Math.max(0, now - latestSourceTs);
      if (!tailer.status.exists || tailer.status.error) statusReasons.push(`${tailer.status.name}:${tailer.status.error ?? "missing"}`);
      const maxAgeMs = tailer.status.name === "hl_ob_bands" ? 2 * MINUTE : 3 * MINUTE;
      if (ageMs === null || ageMs > maxAgeMs) statusReasons.push(`${tailer.status.name}:stale`);
      return {
        name: tailer.status.name,
        path: path.relative(this.rootDir, tailer.status.filePath).replace(/\\/g, "/"),
        exists: tailer.status.exists,
        latestSourceTs,
        ageMs,
        error: tailer.status.error,
      };
    });
    const decisionAge = this.state.lastDecisionTs === null ? null : Math.max(0, now - this.state.lastDecisionTs);
    if (decisionAge !== null && decisionAge > 20 * MINUTE) statusReasons.push("decision_stale");
    if (this.state.lastDecisionReady === false) statusReasons.push("latest_decision_inputs_incomplete");
    const warming = this.state.lastDecisionTs === null && now - this.processStartedAt < 3 * MINUTE;
    return {
      version: 1,
      symbol: this.symbol,
      candidate: HL_SHORT_BREAKDOWN_CANDIDATE,
      policyVersion: HL_SHORT_BREAKDOWN_POLICY_VERSION,
      policySignature: HL_SHORT_BREAKDOWN_POLICY_SIGNATURE,
      shadowOnly: true,
      processStartedAt: this.processStartedAt,
      writtenAt: now,
      status: warming ? "warming_up" : statusReasons.length > 0 ? "degraded" : "healthy",
      statusReasons: [...new Set(statusReasons)],
      poll: { lastAt: this.state.lastPollAt, intervalMs: POLL_MS },
      decision: {
        lastTs: this.state.lastDecisionTs,
        ageMs: decisionAge,
        ready: this.state.lastDecisionReady,
        blockers: this.state.lastDecisionBlockers,
      },
      sources,
      active: {
        runs: this.state.runs.length,
        immediateOpenOrPending: this.state.runs.filter(run => run.tracks.some(track => track.mode === "decision_open" && track.status !== "closed")).length,
        delayedOpenOrPending: this.state.runs.filter(run => run.tracks.some(track => track.mode === "delay_1m_open" && track.status !== "closed")).length,
      },
      integrity: { ...this.state.integrity },
      counters: { ...this.state.counters },
    };
  }

  poll(now: number = Date.now(), args: { dryRun?: boolean } = {}): HlShortBreakdownShadowHealthV1 {
    const originalState = args.dryRun ? JSON.parse(JSON.stringify(this.state)) as HlShortBreakdownShadowStateV1 : null;
    this.dryRun = args.dryRun === true;
    this.runtimeErrors = [];
    for (const tailer of this.tailers) tailer.poll();
    this.prune(now);
    const latestCandle = this.candles.at(-1);
    if (latestCandle) {
      const latestClosedBoundary = Math.floor((latestCandle.timestamp + MINUTE) / HL_SHORT_BREAKDOWN_POLICY.decisionIntervalMs)
        * HL_SHORT_BREAKDOWN_POLICY.decisionIntervalMs;
      if (latestClosedBoundary <= now) {
        let decisions: number[] = [];
        if (this.state.lastDecisionTs === null) {
          decisions = [latestClosedBoundary];
        } else if (latestClosedBoundary > this.state.lastDecisionTs) {
          const gap = latestClosedBoundary - this.state.lastDecisionTs;
          if (gap > MAX_CATCHUP_MS) {
            this.runtimeErrors.push(`catchup_gap_exceeds_${MAX_CATCHUP_MS}`);
            this.state.integrity = {
              healthy: false,
              reason: "catchup_gap_exceeded_retained_window",
              observedAt: now,
              gapMs: gap,
            };
            for (const run of this.state.runs) {
              this.appendEvent("run_abandoned_catchup_gap", `abandoned:${run.signalId}`, now, {
                signalId: run.signalId,
                decisionTs: run.decisionTs,
                gapMs: gap,
              });
            }
            this.state.runs = [];
            this.appendEvent("catchup_gap", `catchup_gap:${latestClosedBoundary}`, now, { previousDecisionTs: this.state.lastDecisionTs, latestClosedBoundary, gapMs: gap });
            decisions = [latestClosedBoundary];
          } else {
            for (let ts = this.state.lastDecisionTs + HL_SHORT_BREAKDOWN_POLICY.decisionIntervalMs; ts <= latestClosedBoundary; ts += HL_SHORT_BREAKDOWN_POLICY.decisionIntervalMs) decisions.push(ts);
          }
        }
        for (const decisionTs of decisions) {
          this.updateRuns(decisionTs);
          this.evaluateDecision(decisionTs);
        }
      }
    }
    this.updateRuns();
    this.state.lastPollAt = now;
    this.state.updatedAt = now;
    let health = this.health(now);
    if (!this.dryRun) {
      const stateWrite = atomicWriteJson(this.stateFile, this.state);
      if (!stateWrite.success) {
        this.runtimeErrors.push(`state_write:${stateWrite.error}`);
        console.error(`[hl-short-shadow] state write failed: ${stateWrite.error}`);
        health = this.health(now);
      }
      const healthWrite = atomicWriteJson(this.healthFile, health);
      if (!healthWrite.success) console.error(`[hl-short-shadow] health write failed: ${healthWrite.error}`);
    }
    if (originalState) this.state = originalState;
    this.dryRun = false;
    return health;
  }
}

function parseArg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find(arg => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const once = args.includes("--once");
  const dryRun = args.includes("--dry-run");
  const rootDir = parseArg("root") ?? process.cwd();
  const symbol = (parseArg("symbol") ?? "HYPEUSDT").toUpperCase();
  if (symbol !== "HYPEUSDT") throw new Error("hl-short-breakdown shadow is frozen for HYPEUSDT only");
  const shadow = new HlShortBreakdownShadow(rootDir);
  if (once) {
    const health = shadow.poll(Date.now(), { dryRun });
    console.log(JSON.stringify(health, null, 2));
    if (health.status === "degraded") process.exitCode = 2;
    return;
  }
  console.log(`[hl-short-shadow] ${symbol} ${HL_SHORT_BREAKDOWN_CANDIDATE} started; shadowOnly=true policy=${HL_SHORT_BREAKDOWN_POLICY_SIGNATURE} poll=${POLL_MS / 1000}s`);
  while (true) {
    try {
      const health = shadow.poll();
      if (health.status !== "healthy") console.log(`[hl-short-shadow] status=${health.status} reasons=${health.statusReasons.join(",") || "none"}`);
    } catch (err: any) {
      console.error(`[hl-short-shadow] poll failed: ${err?.message ?? err}`);
    }
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(`[hl-short-shadow] fatal: ${err?.message ?? err}`);
    process.exit(1);
  });
}
