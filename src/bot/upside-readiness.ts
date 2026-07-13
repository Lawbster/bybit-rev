import fs from "fs";
import path from "path";
import { EMA } from "technicalindicators";
import { Candle } from "../fetch-candles";
import { aggregate } from "./sr-levels";

const DAY_MS = 86_400_000;
const FIVE_MIN_MS = 5 * 60_000;
const FOUR_HOURS_MS = 4 * 3_600_000;
const HISTORY_WINDOW_MS = 30 * DAY_MS;
const MATCH_WINDOW_MS = 10 * 60_000;
const DECISION_TAIL_BYTES = 32 * 1024 * 1024;

export const UPSIDE_READINESS_POLICY = {
  floorBaseUsdt: 800,
  candidateBaseUsdt: 900,
  equityMin: 36_500,
  trailing30dPnlMin: 3_000,
  tailStepdownDays: 7,
  euphoriaNearHighPct: 10,
} as const;

export interface RealizedPnlWindow {
  pnl: number | null;
  anchorAt: number | null;
  anchorLagMs: number | null;
  healthy: boolean;
}

export interface GrindMidFeatures {
  observedAt: number;
  hlTaker1h: number | null;
  hlAssetOi4hPct: number | null;
  realizedVol30Pct: number | null;
  takerMinuteSamples: number;
  candleMinuteSamples: number;
  dataHealthy: boolean;
  eligible: boolean;
}

export interface UpsideOperationalHistory {
  windowStart: number;
  historyHealthy: boolean;
  tpCycles: number;
  forcedCloses: number;
  otherFullCloses: number;
  unclassifiedFullCloses: number;
  lastUnclassifiedFullCloseAt: number | null;
  srPartialExits: number;
  lastForcedExitAt: number | null;
  lastForcedExitReason: string | null;
}

export interface UpsideMarketClamp {
  observedAt: number;
  price: number;
  high14d: number | null;
  distanceFromHigh14dPct: number | null;
  lastCompleted4hClose: number | null;
  ema2004h: number | null;
  aboveEma200: boolean | null;
  euphoriaCapActive: boolean;
  dataHealthy: boolean;
}

export interface UpsideReadinessSnapshotV1 {
  version: 1;
  symbol: string;
  writtenAt: number;
  shadowOnly: true;
  policy: "GF900_GRIND_MID_READINESS";
  configuredBaseUsdt: number;
  thresholds: typeof UPSIDE_READINESS_POLICY;
  account: {
    equity: number;
    equityGate: boolean;
    trailing30dRealizedPnl: number | null;
    trailing30dAnchorAt: number | null;
    trailing30dCoverageHealthy: boolean;
    pnlGate: boolean;
  };
  market: UpsideMarketClamp;
  forcedExit: {
    lastAt: number | null;
    reason: string | null;
    daysSince: number | null;
    tailStepdownActive: boolean;
    lastUnclassifiedFullCloseAt: number | null;
    unclassifiedCloseWithin7d: boolean;
  };
  grindMid: GrindMidFeatures;
  counts30d: {
    tpCycles: number;
    forcedCloses: number;
    otherFullCloses: number;
    unclassifiedFullCloses: number;
    srPartialExits: number;
  };
  eligibility: {
    eligible: boolean;
    wouldUseBaseUsdt: 800 | 900;
    blockers: string[];
  };
}

interface JsonRow { [key: string]: any }
interface TimedJsonRow { row: JsonRow; ts: number }

function parseTs(row: JsonRow): number | null {
  const raw = row.timestamp ?? row.ts ?? row.time;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readJsonLines(filePath: string): JsonRow[] {
  try {
    return fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .flatMap(line => {
        try { return [JSON.parse(line) as JsonRow]; } catch { return []; }
      });
  } catch {
    return [];
  }
}

function readJsonTail(filePath: string, maxBytes: number): { rows: JsonRow[] } {
  try {
    const stat = fs.statSync(filePath);
    const bytes = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(bytes);
    const fd = fs.openSync(filePath, "r");
    try { fs.readSync(fd, buffer, 0, bytes, stat.size - bytes); } finally { fs.closeSync(fd); }
    const lines = buffer.toString("utf8").split(/\r?\n/);
    if (bytes < stat.size) lines.shift();
    return {
      rows: lines.filter(Boolean).flatMap(line => {
        try { return [JSON.parse(line) as JsonRow]; } catch { return []; }
      }),
    };
  } catch {
    return { rows: [] };
  }
}

function timedRows(filePath: string, maxBytes: number): TimedJsonRow[] {
  return readJsonTail(filePath, maxBytes).rows
    .map(row => ({ row, ts: parseTs(row) }))
    .filter((item): item is TimedJsonRow => item.ts !== null)
    .sort((a, b) => a.ts - b.ts);
}

function lastBefore(rows: TimedJsonRow[], timestamp: number): TimedJsonRow | null {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].ts <= timestamp) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? rows[lo - 1] : null;
}

/** Exact read-only counterpart of the replay's grind_mid discriminator. */
export function buildGrindMidFeatures(symbol: string, now: number, dataDir: string): GrindMidFeatures {
  const takerRows = timedRows(path.join(dataDir, `${symbol}_taker_hyperliquid.jsonl`), 6 * 1024 * 1024);
  const assetRows = timedRows(path.join(dataDir, `${symbol}_asset_ctx_hyperliquid.jsonl`), 6 * 1024 * 1024);
  const candleRows = timedRows(path.join(dataDir, `${symbol}_1m.jsonl`), 2 * 1024 * 1024);

  const takerWindow = takerRows.filter(item => item.ts > now - 3_600_000 && item.ts <= now);
  const buyNotional = takerWindow.reduce((sum, item) => sum + (num(item.row.buyNotional) ?? 0), 0);
  const sellNotional = takerWindow.reduce((sum, item) => sum + (num(item.row.sellNotional) ?? 0), 0);
  const hlTaker1h = sellNotional > 0 ? buyNotional / sellNotional : null;

  const oiNowRow = lastBefore(assetRows, now);
  const oiPrevRow = lastBefore(assetRows, now - FOUR_HOURS_MS);
  const oiNow = num(oiNowRow?.row.openInterestValue);
  const oiPrev = num(oiPrevRow?.row.openInterestValue);
  const hlAssetOi4hPct = oiNow !== null && oiPrev !== null && oiPrev !== 0
    ? ((oiNow - oiPrev) / oiPrev) * 100
    : null;

  const completed1m = candleRows
    .filter(item => item.ts + 60_000 <= now && num(item.row.c ?? item.row.close) !== null);
  const unique1m = [...new Map(completed1m.map(item => [item.ts, item])).values()].slice(-31);
  const continuous1m = unique1m.length === 31 && unique1m.every(
    (item, index) => index === 0 || item.ts - unique1m[index - 1].ts === 60_000,
  );
  const returns: number[] = [];
  if (continuous1m) {
    for (let index = 1; index < unique1m.length; index++) {
      const previous = num(unique1m[index - 1].row.c ?? unique1m[index - 1].row.close);
      const current = num(unique1m[index].row.c ?? unique1m[index].row.close);
      if (previous === null || current === null || previous <= 0) break;
      returns.push(((current - previous) / previous) * 100);
    }
  }
  const realizedVol30Pct = returns.length === 30
    ? Math.sqrt(returns.reduce((sum, value) => sum + value * value, 0) / returns.length)
    : null;

  const takerMinuteSamples = new Set(takerWindow.map(item => Math.floor(item.ts / 60_000))).size;
  const latestTaker = lastBefore(takerRows, now);
  const takerFresh = !!latestTaker && now - latestTaker.ts <= 2 * 60_000;
  const oiCurrentFresh = !!oiNowRow && now - oiNowRow.ts <= 2 * 60_000;
  const oiAnchorLag = oiPrevRow ? now - FOUR_HOURS_MS - oiPrevRow.ts : Infinity;
  const oiAnchorFresh = oiAnchorLag >= 0 && oiAnchorLag <= 10 * 60_000;
  const dataHealthy = takerMinuteSamples >= 55 && takerFresh && oiCurrentFresh && oiAnchorFresh && realizedVol30Pct !== null;
  const eligible = dataHealthy &&
    hlTaker1h !== null && hlTaker1h >= 1.20 &&
    hlAssetOi4hPct !== null && hlAssetOi4hPct >= 1.5 &&
    realizedVol30Pct !== null && realizedVol30Pct <= 0.15;

  return {
    observedAt: now,
    hlTaker1h,
    hlAssetOi4hPct,
    realizedVol30Pct,
    takerMinuteSamples,
    candleMinuteSamples: unique1m.length,
    dataHealthy,
    eligible,
  };
}

function utcDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function readTrailingRealizedPnl(args: {
  logDir: string;
  now: number;
  currentRealizedPnl: number;
  maxAnchorLagMs?: number;
}): RealizedPnlWindow {
  const cutoff = args.now - HISTORY_WINDOW_MS;
  const maxAnchorLagMs = args.maxAnchorLagMs ?? 15 * 60_000;
  let anchor: { ts: number; realizedPnl: number } | null = null;

  for (let daysBack = 0; daysBack <= 2; daysBack++) {
    const day = cutoff - daysBack * DAY_MS;
    const rows = readJsonLines(path.join(args.logDir, `equity_${utcDateKey(day)}.jsonl`));
    for (const row of rows) {
      const ts = parseTs(row);
      const realizedPnl = Number(row.realizedPnl);
      if (ts !== null && ts <= cutoff && Number.isFinite(realizedPnl) && (!anchor || ts > anchor.ts)) {
        anchor = { ts, realizedPnl };
      }
    }
    if (anchor) break;
  }

  if (!anchor) return { pnl: null, anchorAt: null, anchorLagMs: null, healthy: false };
  const anchorLagMs = cutoff - anchor.ts;
  return {
    pnl: args.currentRealizedPnl - anchor.realizedPnl,
    anchorAt: anchor.ts,
    anchorLagMs,
    healthy: anchorLagMs <= maxAnchorLagMs,
  };
}

function isForcedExitReason(reason: string): boolean {
  return [
    "HARD FLATTEN:",
    "EMERGENCY KILL:",
    "FUNDING SPIKE:",
    "PULLBACK EXIT ACTION:",
    "PULLBACK ACTION:",
    "EUPHORIA",
    "DEEP TAIL",
  ].some(prefix => reason.toUpperCase().startsWith(prefix));
}

export function readUpsideOperationalHistory(args: {
  rootDir: string;
  logDir: string;
  symbol: string;
  now: number;
}): UpsideOperationalHistory {
  const windowStart = args.now - HISTORY_WINDOW_MS;
  const decisionsPath = path.join(args.rootDir, "data", `${args.symbol}_decisions.jsonl`);
  const decisionTail = readJsonTail(decisionsPath, DECISION_TAIL_BYTES);
  const parsedDecisionRows = decisionTail.rows
    .map(row => ({ row, ts: parseTs(row) }))
    .filter((item): item is { row: JsonRow; ts: number } => item.ts !== null);
  const decisions = parsedDecisionRows
    .filter(item => item.ts >= windowStart - MATCH_WINDOW_MS && item.ts <= args.now)
    .filter(item => item.row.decision === "tp_fill" || item.row.decision === "flatten")
    .sort((a, b) => a.ts - b.ts);
  const earliestDecisionTs = parsedDecisionRows.length > 0
    ? Math.min(...parsedDecisionRows.map(item => item.ts))
    : null;
  const historyHealthy = earliestDecisionTs !== null && earliestDecisionTs <= windowStart;

  const batchCloses: Array<{ ts: number; positionsClosed: number | null }> = [];
  for (let offset = 0; offset <= 30; offset++) {
    const dayTs = args.now - offset * DAY_MS;
    const rows = readJsonLines(path.join(args.logDir, `trades_${utcDateKey(dayTs)}.jsonl`));
    for (const row of rows) {
      const ts = parseTs(row);
      if (row.action !== "BATCH_CLOSE" || ts === null || ts < windowStart || ts > args.now) continue;
      const positionsClosed = Number(row.positionsClosed);
      batchCloses.push({ ts, positionsClosed: Number.isFinite(positionsClosed) ? positionsClosed : null });
    }
  }
  batchCloses.sort((a, b) => a.ts - b.ts);

  const usedDecisions = new Set<number>();
  let tpCycles = 0;
  let forcedCloses = 0;
  let otherFullCloses = 0;
  let unclassifiedFullCloses = 0;
  let lastUnclassifiedFullCloseAt: number | null = null;
  let lastForcedExitAt: number | null = null;
  let lastForcedExitReason: string | null = null;

  for (const close of batchCloses) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < decisions.length; index++) {
      if (usedDecisions.has(index)) continue;
      const decision = decisions[index];
      const distance = Math.abs(close.ts - decision.ts);
      const decisionRungs = Number(decision.row.rungs);
      const rungsMatch = close.positionsClosed === null || !Number.isFinite(decisionRungs) || decisionRungs === close.positionsClosed;
      if (distance <= MATCH_WINDOW_MS && rungsMatch && distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    }
    if (bestIndex < 0) {
      unclassifiedFullCloses++;
      if (lastUnclassifiedFullCloseAt === null || close.ts > lastUnclassifiedFullCloseAt) {
        lastUnclassifiedFullCloseAt = close.ts;
      }
      continue;
    }
    usedDecisions.add(bestIndex);
    const matched = decisions[bestIndex];
    if (matched.row.decision === "tp_fill") {
      tpCycles++;
      continue;
    }
    const reason = String(matched.row.reason ?? "");
    if (isForcedExitReason(reason)) {
      forcedCloses++;
      if (lastForcedExitAt === null || matched.ts > lastForcedExitAt) {
        lastForcedExitAt = matched.ts;
        lastForcedExitReason = reason;
      }
    } else {
      otherFullCloses++;
    }
  }

  const partialRows = readJsonTail(
    path.join(args.rootDir, "data", `${args.symbol}_sr_partial_exit_actions.jsonl`),
    8 * 1024 * 1024,
  ).rows;
  const srPartialExits = partialRows.filter(row => {
    const ts = parseTs(row);
    return row.event === "executed" && ts !== null && ts >= windowStart && ts <= args.now;
  }).length;

  return {
    windowStart,
    historyHealthy,
    tpCycles,
    forcedCloses,
    otherFullCloses,
    unclassifiedFullCloses,
    lastUnclassifiedFullCloseAt,
    srPartialExits,
    lastForcedExitAt,
    lastForcedExitReason,
  };
}

export function evaluateUpsideMarketClamp(args: {
  candles5m: Candle[];
  now: number;
  price: number;
  contextHealthy: boolean;
}): UpsideMarketClamp {
  const completed = args.candles5m
    .filter(candle => candle.timestamp + FIVE_MIN_MS + 10_000 <= args.now)
    .sort((a, b) => a.timestamp - b.timestamp);
  const highWindowStart = args.now - 14 * DAY_MS;
  const highWindow = completed.filter(candle => candle.timestamp + FIVE_MIN_MS > highWindowStart);
  const high14d = highWindow.length > 0 ? Math.max(...highWindow.map(candle => candle.high)) : null;
  const distanceFromHigh14dPct = high14d !== null && high14d > 0
    ? ((high14d - args.price) / high14d) * 100
    : null;

  const completed4h = aggregate(completed, 240)
    .filter(candle => candle.timestamp + FOUR_HOURS_MS <= args.now)
    .slice(-249);
  const closes4h = completed4h.map(candle => candle.close);
  const emaValues = closes4h.length >= 200 ? EMA.calculate({ period: 200, values: closes4h }) : [];
  const lastCompleted4hClose = closes4h.length > 0 ? closes4h[closes4h.length - 1] : null;
  const ema2004h = emaValues.length > 0 ? emaValues[emaValues.length - 1] : null;
  const aboveEma200 = lastCompleted4hClose !== null && ema2004h !== null
    ? lastCompleted4hClose >= ema2004h
    : null;
  const hasFull14d = highWindow.length > 0 && highWindow[0].timestamp <= highWindowStart + FIVE_MIN_MS;
  const dataHealthy = args.contextHealthy && hasFull14d && aboveEma200 !== null && distanceFromHigh14dPct !== null;
  const euphoriaCapActive = dataHealthy && aboveEma200 === true &&
    distanceFromHigh14dPct !== null &&
    distanceFromHigh14dPct <= UPSIDE_READINESS_POLICY.euphoriaNearHighPct;

  return {
    observedAt: args.now,
    price: args.price,
    high14d,
    distanceFromHigh14dPct,
    lastCompleted4hClose,
    ema2004h,
    aboveEma200,
    euphoriaCapActive,
    dataHealthy,
  };
}

export function evaluateUpsideReadiness(args: {
  symbol: string;
  now: number;
  configuredBaseUsdt: number;
  equity: number;
  trailingPnl: RealizedPnlWindow;
  history: UpsideOperationalHistory;
  market: UpsideMarketClamp;
  grindMid: GrindMidFeatures;
  operationalBlockers?: string[];
}): UpsideReadinessSnapshotV1 {
  const equityGate = args.equity >= UPSIDE_READINESS_POLICY.equityMin;
  const pnlGate = args.trailingPnl.healthy && args.trailingPnl.pnl !== null &&
    args.trailingPnl.pnl >= UPSIDE_READINESS_POLICY.trailing30dPnlMin;
  const daysSince = args.history.lastForcedExitAt === null
    ? null
    : Math.max(0, (args.now - args.history.lastForcedExitAt) / DAY_MS);
  const tailStepdownActive = daysSince !== null && daysSince < UPSIDE_READINESS_POLICY.tailStepdownDays;
  const recentUnclassifiedClose = args.history.lastUnclassifiedFullCloseAt !== null &&
    args.now - args.history.lastUnclassifiedFullCloseAt < UPSIDE_READINESS_POLICY.tailStepdownDays * DAY_MS;
  const blockers: string[] = [];
  if (args.configuredBaseUsdt !== UPSIDE_READINESS_POLICY.floorBaseUsdt) blockers.push("configured_base_not_800");
  if (!args.trailingPnl.healthy) blockers.push("trailing_30d_pnl_history_incomplete");
  if (!args.history.historyHealthy) blockers.push("operational_history_incomplete");
  if (!args.market.dataHealthy) blockers.push("market_context_incomplete");
  if (args.now - args.market.observedAt > 10 * 60_000) blockers.push("market_context_stale");
  if (!args.grindMid.dataHealthy) blockers.push("grind_mid_data_incomplete");
  if (!equityGate) blockers.push("equity_below_36500");
  if (!pnlGate && args.trailingPnl.healthy) blockers.push("trailing_30d_pnl_below_3000");
  if (!args.grindMid.eligible && args.grindMid.dataHealthy) blockers.push("grind_mid_not_active");
  if (tailStepdownActive) blockers.push("forced_exit_within_7d");
  if (recentUnclassifiedClose) blockers.push("unclassified_full_close_within_7d");
  if (args.market.euphoriaCapActive) blockers.push("euphoria_cap_active");
  for (const operationalBlocker of args.operationalBlockers ?? []) {
    blockers.push(`operational_${operationalBlocker}`);
  }
  const eligible = blockers.length === 0;

  return {
    version: 1,
    symbol: args.symbol,
    writtenAt: args.now,
    shadowOnly: true,
    policy: "GF900_GRIND_MID_READINESS",
    configuredBaseUsdt: args.configuredBaseUsdt,
    thresholds: UPSIDE_READINESS_POLICY,
    account: {
      equity: args.equity,
      equityGate,
      trailing30dRealizedPnl: args.trailingPnl.pnl,
      trailing30dAnchorAt: args.trailingPnl.anchorAt,
      trailing30dCoverageHealthy: args.trailingPnl.healthy,
      pnlGate,
    },
    market: args.market,
    forcedExit: {
      lastAt: args.history.lastForcedExitAt,
      reason: args.history.lastForcedExitReason,
      daysSince,
      tailStepdownActive,
      lastUnclassifiedFullCloseAt: args.history.lastUnclassifiedFullCloseAt,
      unclassifiedCloseWithin7d: recentUnclassifiedClose,
    },
    grindMid: args.grindMid,
    counts30d: {
      tpCycles: args.history.tpCycles,
      forcedCloses: args.history.forcedCloses,
      otherFullCloses: args.history.otherFullCloses,
      unclassifiedFullCloses: args.history.unclassifiedFullCloses,
      srPartialExits: args.history.srPartialExits,
    },
    eligibility: {
      eligible,
      wouldUseBaseUsdt: eligible ? 900 : 800,
      blockers,
    },
  };
}

export function writeUpsideReadinessSnapshot(
  filePath: string,
  snapshot: UpsideReadinessSnapshotV1,
): { success: true } | { success: false; error: string } {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  const tempPath = path.join(dir, `.${path.basename(resolved)}.${process.pid}.${Date.now()}.tmp`);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(snapshot));
    fs.renameSync(tempPath, resolved);
    return { success: true };
  } catch (err: any) {
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* best effort */ }
    return { success: false, error: err?.message ?? String(err) };
  }
}

export function appendUpsideOpenAssessment(
  filePath: string,
  snapshot: UpsideReadinessSnapshotV1,
  openedAt: number,
): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(filePath, JSON.stringify({
      timestamp: openedAt,
      ts: new Date(openedAt).toISOString(),
      event: "ladder_open_readiness",
      ...snapshot,
    }) + "\n");
  } catch {
    // Telemetry is best-effort and must never affect an open.
  }
}
