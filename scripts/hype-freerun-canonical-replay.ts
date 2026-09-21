/**
 * CURRENT ENTRY POINT: scripts/hype-replay-current-stack-validation.ts.
 * runEngine defaults to causal_next_open, shared current S/R policies and a
 * quality-aware input tape. Legacy variants must explicitly use legacy_ohlc
 * (or runLegacyEngine) and are NOT certified by the new execution tests.
 * The inherited description below documents the ARCHIVED engine only.
 */
/**
 * Fable-5 free-running historical replay for the HYPE ladder.
 * September 4: source-time alignment and full-window feature coverage repaired.
 * This remains a minute-candle execution model, NOT exact live/maker parity.
 *
 * Goal: a free-running simulation that models the FULL live gate/exit stack —
 * including post-exit cooldown and re-entry behavior — faithfully enough to be
 * reconciled against live episodes (logs/trades_*.jsonl) before testing
 * hard-flatten / cooldown variants that anchored episode replay cannot prove.
 *
 * Modeled (live formulas copied from src/bot/*):
 * - time adds (30m) + price-trigger adds (0.3% below LAST rung entry)
 * - martingale sizing base*1.35^level, max 11
 * - addThrottle (depth>=5, slope6h<=-0.5 -> interval x2)
 * - deepAddStressGuard (depth>=5, any-venue funding<0 blocks time adds, price-drop adds pass)
 * - trend gate (4H EMA200/EMA50, last 249 COMPLETED bars, live fetch-window semantics)
 * - BTC risk-off (last two completed BTC 1H closes, ret < -3 -> block 120m, re-arming)
 * - ladder-local kill (>=12h underwater AND avgPnl<=-3 blocks adds)
 * - overextended entry (first rung only: slope12h>=2.55 AND crsi4H<=56.9 AND rsi1H>=59.4)
 * - regime breaker (5 red daily closes -> flat, 2 green -> arm)
 * - batch TP 1.4 (candle-high touch), soft stale (>=4h & pnl<0.5 -> TP 0.5)
 * - hard flatten (variant hours/pct AND trend hostile), emergency kill -14
 * - funding spike guard (depth>=8, bybit funding >= 0.00012)
 * - tpCooldown (rsi1H>60 -> 30m, shares the forced-cooldown slot like live)
 * - forced-exit cooldown modes: live4h (end of next completed 4H bar), 8h, 12h, 16h
 * - lastAddTime PERSISTS across TP closes (live quirk: first re-entry usually immediate)
 * - pullbackExitShadow flush trigger (vwap24h / lowerLow12h / ret12h<=-6, depth>=8, pnl<=-2)
 *   with one-shot active state + reclaim re-arm, exactly like live
 * - pullback action modes:
 *     none      — segment A live behavior (before 2026-06-06T19:32Z)
 *     full_exit — segment B live behavior (flatten on flush trigger, cd now+240m)
 *     trim      — segment C / current live behavior (flush trigger + HL>=2 -> 45m watch ->
 *                 failed 1.2% reclaim -> trim 50% notional, NO cooldown)
 *     liveSegmented — switches by date (parity baseline)
 * - HL pulse score (fundingNegative / sellPressure / oiUnwind / askWall) recomputed offline
 *   from raw HL jsonl files with the shadow-logger formulas
 *
 * NOT modeled (documented gaps): SR partial-flatten & SR skip-add (0 fires in 81MB pm2 log),
 * scorePartialFlatten arm source for the trim machine (arming is irrelevant to trim behavior:
 * watch starts from idle on confirmation), funding settlement on held positions, WS-stale /
 * recovery-mode add blocks, exchange fill slippage (exits fill at 1m close, TP at target).
 *
 * Usage:
 *   npx ts-node scripts/hype-freerun-canonical-replay.ts                 # parity + sweep
 *   MODE=parity npx ts-node scripts/hype-freerun-canonical-replay.ts
 *   MODE=sweep SIM_START=2026-05-17T20:43:00Z npx ts-node scripts/hype-freerun-canonical-replay.ts
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { EMA, RSI } from "technicalindicators";
import { CausalMinuteLatest, observationAvailability, addAtAvailability, isClosedBy, REPLAY_CAUSALITY_VERSION } from "./replay-causality";
import { runCausalLongReplay } from "./replay-causal-engine";
import type { ReplayMarketInputs } from "./replay-market-inputs";
import { applyCandleRepair, readCandleRepair } from "./replay-candle-repair";

type AnyRow = Record<string, any>;

export type Candle = {
  ts: number;
  endTs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
};

type Position = {
  entryTs: number;
  entryPrice: number;
  qty: number;
  notional: number;
  level: number;
};

export type PullbackMode = "none" | "full_exit" | "trim" | "liveSegmented";

/** Phase-1 configurable pullback action (overrides legacy pullbackMode machinery). */
export type PbActionCfg = {
  action: "full_exit" | "trim" | "hedge";
  closePct: number;               // trim share / hedge notional share of ladder
  timing: "immediate" | "failed_reclaim" | "failed_reclaim_lowerlow" | "failed_reclaim_belowvwap";
  watchMin: number;
  reclaimPct: number;
  hlConfirmMin: number;           // 0 = no HL requirement
};

/** Phase-2 euphoria-regime stop (trend-independent, AND-gated). */
export type EuphoriaCfg = {
  minDepth: number;
  pnlMax: number;                 // e.g. -7
  ret12hMax: number | null;       // e.g. -6, null = no requirement
  requireAboveEma200: boolean;    // true = fire only where hard flatten cannot
  requireBelowVwap: boolean;
  avgEntryNearHighPct: number | null; // ladder avgEntry >= high14d*(1 - X/100)
  watchMin: number;               // failed-reclaim watch
  reclaimPct: number;
  hlScoreMin: number | null;      // at watch expiry: (hlScore >= min) OR (lowerLowAlt && new low in watch)
  lowerLowAlt: boolean;
};

/** Phase-3 condition-based re-entry after forced exits (replaces time cooldown). */
export type ReentryCfg = {
  mode: "immediate" | "vwap_reclaim" | "no_new_low" | "hl_normalized" | "drop_reclaim";
  noNewLowHours?: number;
  dropPct?: number;
  reclaimPct?: number;
};

/**
 * Synthetic hedge overlay driven by a precomputed market-side trigger series
 * (s.extraTriggers[triggerKey], per 1m candle). Ladder-side conditions applied
 * in-engine. Enter short at candle close; TP/kill bracket; force-close with ladder.
 */
/**
 * Post-exit continuation flip: open a short AT our own forced exit (the exit
 * already confirms failed reclaim / breakdown), cover on the same reclaim+momentum
 * signal the pullback machinery uses for re-entry, or on kill/maxHold, or when
 * the ladder re-opens. Optionally accrues 8h funding (shorts RECEIVE positive funding).
 */
export type ShortFlipCfg = {
  trigger: "forced_all" | "eu_only" | "pullback_only";
  sizePctOfClosed: number;      // short notional as fraction of the closed ladder notional
  reclaimPct: number;           // cover when close >= postLow*(1+reclaimPct) with momentum
  killPct: number | null;       // cover when high >= entry*(1+killPct); null = no kill
  maxHoldHours: number;
  fundingAccrual: boolean;      // credit bybit funding at 8h UTC boundaries
};

/** Dynamic base-notional policy, applied at ladder open. Rules compose: start from
 *  equityPct/watermark (or floorBase), then tail-stepdown and euphoria-cap clamp down. */
export type SizingPolicyCfg = {
  floorBase: number;
  capBase: number;
  equityPct?: number;                                    // base = equity * pct/100, clamped
  watermarkSteps?: Array<{ equityMin: number; base: number }>;
  tailStepdownDays?: number;                             // floorBase for N days after a forced exit
  euphoriaCapBase?: number;                              // cap when above EMA200 and within 10% of 14d high
  /** Above-floor base allowed only while extraTriggers[grindGateKey] is true
   *  (and has been true for grindPersistMin minutes, if set). */
  grindGateKey?: string;
  grindPersistMin?: number;
  /** Research-only: hold the selected base until equity moves this percentage from the last sizing anchor. */
  rebalanceBandPct?: number;
};

/** Orderly-low deep-add timing modifier: pause deep adds while the trigger is active. */
export type DeepAddPauseCfg = {
  triggerKey: string;        // extraTriggers key marking orderly-low minutes
  minNextDepth: number;      // applies when positions.length + 1 >= this
  pauseMin: number;          // pause duration from each trigger observation
  blockPriceDrop: boolean;   // false = only time-based adds blocked (capitulation adds pass)
  reopenKey?: string;        // extraTriggers key that immediately lifts the pause
};

export type HedgeOverlayCfg = {
  triggerKey: string;
  minDepth: number;
  pnlMax: number | null;      // require ladder pnl <= this, null = no requirement
  sizePct: number;            // fraction of current ladder notional
  tpPct: number;              // close hedge when price <= entry*(1 - tpPct/100)
  killPct: number;            // close hedge when price >= entry*(1 + killPct/100)
  cooldownMin: number;        // min gap between hedge opens
};

export type EngineParams = {
  id: string;
  /** Legacy OHLC results are reproduction-only. New research defaults to causal execution. */
  executionModel?: "causal_next_open" | "legacy_ohlc";
  tpExecutionModel?: "close_confirmed" | "resting_touch";
  maxPositions: number;
  hardFlattenHours: number;
  hardFlattenPct: number;
  cooldownMode: "live4h" | "0h" | "8h" | "12h" | "16h";
  /** Research-only override: fixed cooldown after every TP/stale TP. Undefined preserves live RSI-gated behavior. */
  tpCooldownOverrideMin?: number;
  pullbackMode: PullbackMode;
  /** Diagnostic: drop the live "trend hostile" requirement on hard flatten. */
  hardFlattenIgnoreTrend?: boolean;
  /** When set, replaces the legacy pullbackMode action machinery (trigger stays identical). */
  pullbackActionCfg?: PbActionCfg;
  euphoriaStop?: EuphoriaCfg;
  /** When set, forced exits use this re-entry gate instead of the time cooldown. */
  reentry?: ReentryCfg;
  /** Ladder-shape overrides (Phase D). Defaults = live config values. */
  baseUsdt?: number;
  addScale?: number;
  priceTriggerPct?: number;
  addIntervalMin?: number;
  /** Depth cap in euphoria regime (above EMA200 and close within nearHighPct of 14d high). */
  euphoriaMaxDepth?: { maxPositions: number; nearHighPct: number };
  /** Synthetic hedge overlay (Phase C). */
  hedgeOverlay?: HedgeOverlayCfg;
  /** Post-exit continuation short (flip). */
  shortFlip?: ShortFlipCfg;
  /** TP fill model: require candle high >= tp*(1+buf/100) before filling at tp.
   *  0 (default) = raw high-touch (optimistic). Calibrated against live fills. */
  tpFillBufferPct?: number;
  /** Deep-tail backstop (below euphoria/pullback layers). */
  deepTail?: DeepTailCfg;
  /** Dynamic base sizing, evaluated at each ladder OPEN (never mid-ladder). */
  sizingPolicy?: SizingPolicyCfg;
  /** Research-only external account contribution included in sizing equity (for shared-account overlays). */
  sizingEquityAdjustment?: (candleIndex: number) => number;
  /** Orderly-low deep-add pause (Task B, pulse-to-policy). */
  deepAddPause?: DeepAddPauseCfg;
  /** Research-only late-rung delay: arm near a known high, release after a
   *  causal pullback. Both keys address s.extraTriggers boolean series. */
  lateRungHighDelay?: {
    armKey: string;
    releaseKey: string;
    minNextDepth: number;
    blockPriceDrop: boolean;
  };
  /** Score partial-flatten as ACTION: proportional close on recorded score fires
   *  (extraTriggers[triggerKey]); one-shot per ladder; ladder continues normally. */
  scorePartialAction?: { triggerKey: string; closePct: number; maxAgeH: number | null; minDepth: number; pnlMax: number };
  /** Hard-flatten softener: intervene at the exact moment hard flatten would fire. */
  hfSoftener?: {
    mode: "defer" | "trim_watch";
    deferMin?: number;          // defer: wait N minutes, re-check, flatten if still true
    ret12hMin?: number;         // only soften when ret12h above this (slow chop, not flush)
    supportBufferPct?: number;  // optional: also require a confirmed memory-zone support below price
    trimPct?: number;           // trim_watch: share closed immediately
    watchMin?: number;          // trim_watch: reclaim window for the remainder
    reclaimPct?: number;        // close >= hfPrice*(1+reclaimPct/100) = reclaimed
  };
  /** S/R execution actions (Phase B). */
  srExec?: SrExecCfg;
};

export type ActionEvent = {
  variant: string;
  episode: number;
  ts: number;
  iso: string;
  kind: string;                   // pb_trigger | pb_watch_cancel | pb_full_exit | pb_trim | hedge_open | hedge_close | eu_trigger | eu_watch_cancel | eu_stop | reentry_ok
  price: number;
  depth: number;
  pnlPct: number | "";
  ret12h: number | "";
  hlScore: number | "";
  vwapDistPct: number | "";
  distHigh14dPct: number | "";
  detail: string;
};

export type CloseEvent = {
  variant: string;
  episode: number;
  entryIso: string;
  closeIso: string;
  closeTs: number;
  reason: string;
  rungs: number;
  maxDepth: number;
  avgEntry: number;
  exitPrice: number;
  pnl: number;
  holdHours: number;
  minPnlPct: number;
  trimsInEpisode: number;
  trimPnlInEpisode: number;
  hedgePnlInEpisode: number;
  baseUsed: number;
};

export type TrimEvent = {
  variant: string;
  episode: number;
  ts: number;
  iso: string;
  price: number;
  closedShare: number;
  pnl: number;
  depth: number;
};

export const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
export const OUT_DIR = path.join(ROOT, "backtests", "hype");
const REPORT = path.join(ROOT, "research", "fable-5-freerun-canonical-replay-findings.md");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "bot-config.json"), "utf8"));

// CLI-arg shim so skill allowlists can match plain `npx ts-node scripts/... --mode=...`
// invocations (PowerShell env-prefixed commands defeat prefix permission patterns).
// Runs on import, so sibling scripts inherit it for SET/SIM_START too.
for (const arg of process.argv.slice(2)) {
  const m = /^--(mode|set|start|end|equity)=(.+)$/.exec(arg);
  if (!m) continue;
  const key = { mode: "MODE", set: "SET", start: "SIM_START", end: "SIM_END", equity: "SIM_EQUITY" }[m[1]]!;
  process.env[key] = m[2];
}

const MODE = (process.env.MODE ?? "all") as "all" | "parity" | "sweep";
export const START_TS = Date.parse(process.env.SIM_START ?? "2026-05-17T20:43:00Z");
const END_TS = process.env.SIM_END ? Date.parse(process.env.SIM_END) : Number.POSITIVE_INFINITY;
const INITIAL_EQUITY = Number(process.env.SIM_EQUITY ?? 32_000);

// Live-behavior segment boundaries (bot-config.json commit times, UTC).
const SEG_FULL_EXIT_START = Date.parse("2026-06-06T19:32:00Z"); // 6c07090 enable pullbackExitAction
const SEG_TRIM_START = Date.parse("2026-06-26T11:02:00Z");      // 4b07f25 switch to trim

const BASE_USDT = Number(CONFIG.basePositionUsdt ?? 800);
const ADD_SCALE = Number(CONFIG.addScaleFactor ?? 1.35);
const TP_PCT = Number(CONFIG.tpPct ?? 1.4);
const PRICE_TRIGGER_PCT = Number(CONFIG.priceTriggerPct ?? 0.3);
const ADD_INTERVAL_MIN = Number(CONFIG.addIntervalMin ?? 30);
const FEE = Number(CONFIG.feeRate ?? 0.00055);
const STALE_HOURS = Number(CONFIG.exits?.staleHours ?? 4);
const STALE_TP_PCT = Number(CONFIG.exits?.reducedTpPct ?? 0.5);
const EMERGENCY_KILL_PCT = Number(CONFIG.exits?.emergencyKillPct ?? -14);
const FUNDING_SPIKE_DEPTH = Number(CONFIG.exits?.fundingSpikeGuard?.minRungs ?? 8);
const FUNDING_SPIKE_RATE = Number(CONFIG.exits?.fundingSpikeGuard?.maxFundingRate ?? 0.00012);
const THROTTLE_DEPTH = Number(CONFIG.addThrottle?.depth ?? 5);
const THROTTLE_MULT = Number(CONFIG.addThrottle?.mult ?? 2);
const THROTTLE_SLOPE = Number(CONFIG.addThrottle?.slopeThreshold ?? -0.5);
const DEEP_STRESS_MIN_DEPTH = Number(CONFIG.deepAddStressGuard?.minDepth ?? 5);
const TP_COOLDOWN_MIN = Number(CONFIG.tpCooldown?.cooldownMin ?? 30);
const TP_COOLDOWN_RSI = Number(CONFIG.tpCooldown?.rsi1hThreshold ?? 60);
const TREND_EMA_LONG = Number(CONFIG.filters?.trendEmaLong ?? 200);
const TREND_EMA_SHORT = Number(CONFIG.filters?.trendEmaShort ?? 50);
const LIVE_HYPE_4H_FETCH_LIMIT = 250;
const BTC_DROP_PCT = Number(CONFIG.filters?.btcDropPct ?? -3);
const RISK_OFF_COOLDOWN_MIN = Number(CONFIG.filters?.riskOffCooldownMin ?? 120);
const LADDER_KILL_HOURS = Number(CONFIG.filters?.maxUnderwaterHours ?? 12);
const LADDER_KILL_PCT = Number(CONFIG.filters?.maxUnderwaterPct ?? -3);
const OVEREXT = CONFIG.filters?.overextendedEntry ?? { enabled: true, slope12hMin: 2.55, crsi4HMax: 56.9, rsi1HMin: 59.4 };
const REGIME_RED_DAYS = Number(CONFIG.filters?.regimeBreaker?.redDaysToFlat ?? 5);
const REGIME_GREEN_DAYS = Number(CONFIG.filters?.regimeBreaker?.greenDaysToArm ?? 2);
const PB = CONFIG.pullbackExitShadow ?? {};
const PB_MIN_DEPTH = Number(PB.minDepth ?? 8);
const PB_PNL_MAX = Number(PB.pnlPctMax ?? -2);
const PB_RET12H_MAX = Number(PB.ret12hMax ?? -6);
const PB_LL_LOOKBACK_MIN = Number(PB.lowerLowLookbackMin ?? 720);
const PB_LL_BUFFER_PCT = Number(PB.lowerLowBufferPct ?? 0.2);
const PB_VWAP_LOOKBACK_MIN = Number(PB.vwapLookbackMin ?? 1440);
const PB_COOLDOWN_MIN = Number(PB.cooldownMin ?? 240);
const PB_RECLAIM_PCT = Number(PB.reclaimPct ?? 1.2);
const PB_MOM_RET1H_MIN = Number(PB.momentumRet1hMin ?? 0);
const PB_MOM_RET2H_MIN = Number(PB.momentumRet2hMin ?? 0.5);
const PBA = CONFIG.pullbackActionShadow ?? {};
const PBA_CONFIRM_HL = Number(PBA.confirmationHlScoreMin ?? 2);
const PBA_WATCH_MIN = Number(PBA.watchMin ?? 45);
const PBA_RECLAIM_PCT = Number(PBA.reclaimPct ?? 1.2);
const PBA_CLOSE_PCT = Math.max(0, Math.min(0.95, Number(CONFIG.pullbackAction?.closePct ?? PBA.actionClosePct ?? 0.5)));
const PBA_REENTRY_COOLDOWN_MIN = Number(PBA.reentryCooldownMin ?? 240);
const PBA_REENTRY_RECLAIM_PCT = Number(PBA.reentryReclaimPct ?? 1.2);
const PB_EXIT_ACTION_COOLDOWN_MIN = Number(CONFIG.pullbackExitAction?.cooldownMin ?? 240);

const ONE_MIN = 60_000;
const ONE_HOUR = 3_600_000;
const FOUR_HOURS = 4 * ONE_HOUR;
const DAY_MS = 86_400_000;

// ── util ─────────────────────────────────────────────────────────────────────

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function iso(ts: number): string {
  return new Date(ts).toISOString();
}

export function r(value: number | null | undefined, dp = 4): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  const m = 10 ** dp;
  return Math.round(value * m) / m;
}

function csvEscape(value: any): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeCsv(file: string, rows: Record<string, any>[]): void {
  if (!rows.length) {
    fs.writeFileSync(file, "", "utf8");
    return;
  }
  const cols = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row).forEach(key => set.add(key));
    return set;
  }, new Set<string>()));
  const lines = [cols.join(",")];
  for (const row of rows) lines.push(cols.map(col => csvEscape(row[col])).join(","));
  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
}

function parseTsAny(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

export async function streamJsonl(file: string, onRow: (row: AnyRow) => void, options: { optional?: boolean } = {}): Promise<void> {
  if (!fs.existsSync(file)) {
    if (options.optional) return;
    throw new Error(`Missing replay input: ${file}`);
  }
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    if (!line.trim()) continue;
    let row: AnyRow;
    try { row = JSON.parse(line); }
    catch { throw new Error(`Malformed replay JSON: ${file}:${lineNo}; finish/repeat the data sync`); }
    onRow(row); // Programming/data-validation errors must not silently remove observations.
  }
}

export function lowerBound<T>(rows: T[], target: number, getTs: (row: T) => number): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (getTs(rows[mid]) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ── candle loading ───────────────────────────────────────────────────────────

export async function loadCandles1m(symbol: string, dataDir = DATA, cutoff = END_TS, repairFile?: string): Promise<Candle[]> {
  const byTs = new Map<number, Candle>();
  const push = (row: AnyRow) => {
    const start = Number(row.timestamp ?? row.ts);
    const open = Number(row.open ?? row.o);
    const high = Number(row.high ?? row.h);
    const low = Number(row.low ?? row.l);
    const close = Number(row.close ?? row.c);
    if (![start, open, high, low, close].every(Number.isFinite)) return;
    const volume = Number(row.volume ?? row.v ?? 0) || 0;
    const turnover = Number(row.turnover ?? row.t ?? 0) || volume * close;
    byTs.set(start, { ts: start, endTs: start + ONE_MIN, open, high, low, close, volume, turnover });
  };
  const fullPath = path.join(dataDir, `${symbol}_1_full.json`);
  if (fs.existsSync(fullPath)) {
    for (const row of JSON.parse(fs.readFileSync(fullPath, "utf8"))) push(row);
  }
  await streamJsonl(path.join(dataDir, `${symbol}_1m.jsonl`), push, { optional: true });
  if (!byTs.size) throw new Error(`No 1m candles for ${symbol}`);
  const candles = Array.from(byTs.values())
    .filter(c => isClosedBy(c.ts, ONE_MIN, cutoff))
    .sort((a, b) => a.ts - b.ts);
  return repairFile ? applyCandleRepair(candles, readCandleRepair(repairFile), symbol, cutoff) : candles;
}

function aggregateCandles(candles: Candle[], bucketMs: number): Candle[] {
  const buckets = new Map<number, Candle>();
  for (const c of candles) {
    const bucket = Math.floor(c.ts / bucketMs) * bucketMs;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, { ...c, ts: bucket, endTs: bucket + bucketMs });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
      existing.turnover += c.turnover;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
}

// ── per-minute derived series (all ladder-independent, shared across variants) ─

export type Series = {
  marketInputs?: ReplayMarketInputs;
  btcRet4h?: Array<number | null>;
  /** Present only on rebuilt series; historical archives are not v2-certified. */
  causalityVersion?: string;
  candles: Candle[];
  trendBlocked: boolean[];
  aboveEma200: boolean[];
  ret6h: number[];
  bybitFunding: Array<number | null>;
  fundingStress: boolean[];
  rsi1H: Array<number | null>;
  crsi4H: Array<number | null>;
  slope12h: Array<number | null>;
  riskOffBlocked: boolean[];
  regimeFlat: boolean[];
  vwap24h: Array<number | null>;
  priorLow12h: Array<number | null>;
  ret12h: Array<number | null>;
  ret1h: Array<number | null>;
  ret2h: Array<number | null>;
  pbHasEnough: boolean[];
  hlScore: Array<number | null>;
  hlSellPressure: boolean[];
  high14d: Array<number | null>;
  /** Optional precomputed market-side trigger series (per 1m candle), keyed by family name. */
  extraTriggers?: Map<string, boolean[]>;
  /** Optional per-minute S/R context (distance % to nearest active zone, null = none in range). */
  srResistDistPct?: Array<number | null>;
  srSupportDistPct?: Array<number | null>;
  /** Optional pulse-context series (sr-shadow / hedge-shadow definitions), set by the dormant-edge script. */
  pulseHostile?: boolean[];
  pulseDeteriorating?: boolean[];
  pulseReclaim?: boolean[];
  hlAskWall?: boolean[];
  hlExhaustion?: boolean[];   // sellPressure || takerFade || oiUnwind
  hlSupportBoost?: boolean[]; // buyPressure && bidWall && oiExpansion
  /** Memory-zone levels per 30m bar (sorted prices), confirmed as of bar start. */
  srZones?: Array<{ ts: number; prices: number[] }>;
  /** Optional deep-tail series (attached by the deep-tail runner). */
  ret3h?: Array<number | null>;
  vwap1h?: Array<number | null>;
  btcRet1h?: Array<number | null>;
};

/** Deep-tail backstop mechanisms (trend-independent; below the pullback/partial layers). */
export type DeepTailCfg = {
  mechanism: "time_underwater" | "crash_velocity" | "failed_shelf" | "ek_softener";
  minDepth: number;
  pnlMax: number;
  persistMin?: number;              // time_underwater: condition continuous for N minutes
  requireNoVwapReclaim?: boolean;   // time_underwater: also require close < 1h VWAP throughout
  ret1hMax?: number | null;         // crash_velocity / ek_softener confirm
  ret3hMax?: number | null;         // crash_velocity
  requireBtcWeak?: boolean;         // crash_velocity: BTC 1h return <= 0
  shelfWaitMin?: number;            // failed_shelf: below broken support for N minutes
  closePct?: number;                // ek_softener: 1 = full exit, <1 = proportional partial
};

/** Phase-B S/R execution actions (sr-memory-zone context). */
export type SrExecCfg = {
  /** Block adds when nearest resistance within bufferPct. nextDepth semantics (shadow: deep5 = depth+1>=5). */
  skipAdd?: { minNextDepth: number; timeOnly: boolean; pulse: "hostile" | "deteriorating" | "none"; bufferPct: number };
  /** Close most-profitable rungs keeping worst keepRungs when price within bufferPct of resistance. */
  partialExit?: { minDepth: number; keepRungs: number; bufferPct: number; minLadderPnlPct: number | null; requirePlanProfit: boolean; pulse: "hostile" | "deteriorating" | "none"; cooldownMin: number };
  /** Tighten TP to the stale target while TP path is blocked by resistance and HL pressure is hostile. */
  profitProtect?: { minDepth: number; minLadderPnlPct: number; mode: "askwall" | "exhaustion"; tpBufferPct: number; nearBufferPct: number };
  /** Allow deep-stress-blocked time adds when near support with confirming pulse. */
  supportReopen?: { minNextDepth: number; bufferPct: number; mode: "reclaim" | "buy_pressure" };
};

function buildTrendSeries(candles: Candle[]): { blocked: boolean[]; above: boolean[] } {
  const all4h = aggregateCandles(candles, FOUR_HOURS);
  const blockedOut: boolean[] = [];
  const aboveOut: boolean[] = [];
  const cache = new Map<number, { blocked: boolean; above: boolean }>();
  let lastCompletedIdx = -1;
  for (const c of candles) {
    while (lastCompletedIdx + 1 < all4h.length && all4h[lastCompletedIdx + 1].endTs <= c.endTs) {
      lastCompletedIdx++;
    }
    if (lastCompletedIdx < 0) {
      blockedOut.push(false);
      aboveOut.push(false);
      continue;
    }
    const cacheKey = all4h[lastCompletedIdx].ts;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      blockedOut.push(cached.blocked);
      aboveOut.push(cached.above);
      continue;
    }
    // Live fetches latest 250 native 4H candles and drops the active one -> 249 completed.
    const completed = all4h.slice(0, lastCompletedIdx + 1).slice(-(LIVE_HYPE_4H_FETCH_LIMIT - 1));
    let blocked = false;
    let above = false;
    if (completed.length >= TREND_EMA_LONG + 1) {
      const closes = completed.map(x => x.close);
      const emaLong = EMA.calculate({ period: TREND_EMA_LONG, values: closes });
      const emaShort = EMA.calculate({ period: TREND_EMA_SHORT, values: closes });
      const lastClose = closes[closes.length - 1];
      const ema200 = emaLong[emaLong.length - 1];
      const ema50 = emaShort[emaShort.length - 1];
      const ema50Prev = emaShort[emaShort.length - 2];
      blocked = lastClose < ema200 && ema50 < ema50Prev;
      above = lastClose >= ema200;
    }
    cache.set(cacheKey, { blocked, above });
    blockedOut.push(blocked);
    aboveOut.push(above);
  }
  return { blocked: blockedOut, above: aboveOut };
}

/** Rolling max high over the trailing 14 days (inclusive of current bar). */
function buildHigh14d(candles: Candle[]): Array<number | null> {
  const windowMs = 14 * DAY_MS;
  const out: Array<number | null> = new Array(candles.length).fill(null);
  const deque: number[] = []; // indices, highs decreasing
  let start = 0;
  for (let i = 0; i < candles.length; i++) {
    const cutoff = candles[i].endTs - windowMs;
    while (start < i && candles[start].endTs <= cutoff) {
      if (deque.length && deque[0] === start) deque.shift();
      start++;
    }
    while (deque.length && deque[0] < start) deque.shift();
    while (deque.length && candles[deque[deque.length - 1]].high <= candles[i].high) deque.pop();
    deque.push(i);
    out[i] = candles[deque[0]].high;
  }
  return out;
}

export function buildReturnSeries(candles: Candle[], windowMs: number): number[] {
  const out: number[] = [];
  let idx = 0;
  for (const c of candles) {
    const target = c.endTs - windowMs;
    while (idx + 1 < candles.length && candles[idx + 1].endTs <= target) idx++;
    const past = candles[idx];
    out.push(past && past.close > 0 && past.endTs <= target + ONE_MIN ? ((c.close - past.close) / past.close) * 100 : 0);
  }
  return out;
}

type TsRate = { ts: number; rate: number };

export async function loadFundingRows(file: string): Promise<TsRate[]> {
  const out: TsRate[] = [];
  const full = path.isAbsolute(file) ? file : path.join(DATA, file);
  if (file.endsWith(".json") && fs.existsSync(full)) {
    for (const row of JSON.parse(fs.readFileSync(full, "utf8"))) {
      const ts = observationAvailability(row);
      const rate = Number(row.fundingRate);
      if (Number.isFinite(ts) && Number.isFinite(rate)) out.push({ ts, rate });
    }
  } else {
    await streamJsonl(full, row => {
      const ts = observationAvailability(row);
      const rate = Number(row.fundingRate);
      if (Number.isFinite(ts) && Number.isFinite(rate)) out.push({ ts, rate });
    });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

function seriesLastBefore(candles: Candle[], rows: TsRate[]): Array<number | null> {
  let idx = 0;
  return candles.map(c => {
    while (idx + 1 < rows.length && rows[idx + 1].ts <= c.endTs) idx++;
    return rows.length && rows[idx].ts <= c.endTs ? rows[idx].rate : null;
  });
}

/**
 * rsi1H / crsi4H with the LIVE convention: aggregated buckets INCLUDE the
 * still-forming bucket (technical-engine aggregates the rolling 5m window
 * without dropping the partial bar). slope12h uses COMPLETED 1H bars only
 * (native REST fetch with dropIncompleteCandle).
 */
export function buildContextIndicators(candles: Candle[]): {
  rsi1H: Array<number | null>;
  crsi4H: Array<number | null>;
  slope12h: Array<number | null>;
} {
  const rsi1H: Array<number | null> = new Array(candles.length).fill(null);
  const crsi4H: Array<number | null> = new Array(candles.length).fill(null);
  const slope12h: Array<number | null> = new Array(candles.length).fill(null);

  // Completed-bucket close arrays, grown incrementally.
  const done1h: number[] = [];
  const done4h: number[] = [];
  let cur1hBucket = -1;
  let cur4hBucket = -1;
  let cur1hClose = 0;
  let cur4hClose = 0;

  const RSI_WINDOW = 200; // live: c1H.slice(-200)
  const CRSI_WINDOW = 400;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const b1 = Math.floor(c.ts / ONE_HOUR);
    const b4 = Math.floor(c.ts / FOUR_HOURS);
    if (b1 !== cur1hBucket) {
      if (cur1hBucket >= 0) done1h.push(cur1hClose);
      cur1hBucket = b1;
    }
    if (b4 !== cur4hBucket) {
      if (cur4hBucket >= 0) done4h.push(cur4hClose);
      cur4hBucket = b4;
    }
    cur1hClose = c.close;
    cur4hClose = c.close;
    // Compute across ALL loaded history. A wrapper can trade earlier than START_TS;
    // tying feature coverage to that environment variable silently disabled filters.

    // rsi1H: RSI(14) on last 200 1H closes including the forming bucket.
    if (done1h.length >= 15) {
      const closes = done1h.slice(-(RSI_WINDOW - 1)).concat(cur1hClose);
      const vals = RSI.calculate({ period: 14, values: closes });
      rsi1H[i] = vals.length ? vals[vals.length - 1] : null;
    }
    // crsi4H: Connors RSI on 4H closes including the forming bucket.
    if (done4h.length >= 101) {
      const closes = done4h.slice(-(CRSI_WINDOW - 1)).concat(cur4hClose);
      crsi4H[i] = computeCrsi(closes);
    }
    // slope12h: completed 1H closes only, last vs 13 back.
    if (done1h.length >= 13) {
      const lastClose = done1h[done1h.length - 1];
      const close12hAgo = done1h[done1h.length - 13];
      slope12h[i] = ((lastClose - close12hAgo) / close12hAgo) * 100;
    }
  }
  return { rsi1H, crsi4H, slope12h };
}

// Exact copy of technical-engine computeCrsi.
function computeCrsi(closes: number[], rsiPeriod = 3, streakPeriod = 2, lookback = 100): number | null {
  if (closes.length < Math.max(rsiPeriod + 1, lookback + 1)) return null;
  const rsi3vals = RSI.calculate({ period: rsiPeriod, values: closes });
  const rsi3 = rsi3vals[rsi3vals.length - 1];
  const streaks: number[] = [];
  let streak = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) streak = streak > 0 ? streak + 1 : 1;
    else if (closes[i] < closes[i - 1]) streak = streak < 0 ? streak - 1 : -1;
    else streak = 0;
    streaks.push(streak);
  }
  const streakRsi = RSI.calculate({ period: streakPeriod, values: streaks });
  const streakRsiVal = streakRsi[streakRsi.length - 1];
  const ret1d = (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2] * 100;
  const historical = closes.slice(-lookback - 1);
  const rets = historical.slice(1).map((v, i) => (v - historical[i]) / historical[i] * 100);
  const rank = rets.filter(x => x < ret1d).length / rets.length * 100;
  return +((rsi3 + streakRsiVal + rank) / 3).toFixed(2);
}

/** BTC risk-off: stateful re-arming block series evaluated per HYPE 1m candle. */
function buildRiskOffSeries(candles: Candle[], btc1m: Candle[]): boolean[] {
  const btc1h = aggregateCandles(btc1m, ONE_HOUR);
  const out: boolean[] = new Array(candles.length).fill(false);
  let riskOffUntil = 0;
  let completedIdx = -1;
  for (let i = 0; i < candles.length; i++) {
    const now = candles[i].endTs;
    while (completedIdx + 1 < btc1h.length && btc1h[completedIdx + 1].endTs <= now) completedIdx++;
    if (now < riskOffUntil) {
      out[i] = true;
      continue;
    }
    if (completedIdx < 1) continue;
    const ret = ((btc1h[completedIdx].close - btc1h[completedIdx - 1].close) / btc1h[completedIdx - 1].close) * 100;
    if (ret < BTC_DROP_PCT) {
      riskOffUntil = now + RISK_OFF_COOLDOWN_MIN * ONE_MIN;
      out[i] = true;
    }
  }
  return out;
}

/** Regime breaker: consecutive red UTC daily closes -> flat; green days re-arm. */
function buildRegimeSeries(candles: Candle[]): boolean[] {
  const daily = aggregateCandles(candles, DAY_MS);
  const out: boolean[] = new Array(candles.length).fill(false);
  let redStreak = 0;
  let greenStreak = 0;
  let flatActive = false;
  let lastDayProcessed = daily.length ? Math.floor(daily[0].ts / DAY_MS) : 0;
  let dIdx = 0;
  for (let i = 0; i < candles.length; i++) {
    const todayIdx = Math.floor(candles[i].endTs / DAY_MS);
    while (dIdx + 1 < daily.length && Math.floor(daily[dIdx + 1].ts / DAY_MS) < todayIdx) {
      dIdx++;
      const dayIdx = Math.floor(daily[dIdx].ts / DAY_MS);
      if (dayIdx <= lastDayProcessed) continue;
      const isRed = daily[dIdx].close < daily[dIdx - 1].close;
      if (!flatActive) {
        if (isRed) {
          redStreak++;
          if (redStreak >= REGIME_RED_DAYS) {
            flatActive = true;
            greenStreak = 0;
          }
        } else {
          redStreak = 0;
        }
      } else {
        if (!isRed) {
          greenStreak++;
          if (greenStreak >= REGIME_GREEN_DAYS) {
            flatActive = false;
            redStreak = 0;
            greenStreak = 0;
          }
        } else {
          greenStreak = 0;
        }
      }
      lastDayProcessed = dayIdx;
    }
    out[i] = flatActive;
  }
  return out;
}

/** Rolling price features for the pullback flush trigger (exact shadow formulas). */
function buildPullbackFeatures(candles: Candle[]): {
  vwap24h: Array<number | null>;
  priorLow12h: Array<number | null>;
  ret12h: Array<number | null>;
  ret1h: Array<number | null>;
  ret2h: Array<number | null>;
  hasEnough: boolean[];
} {
  const n = candles.length;
  const vwap24h: Array<number | null> = new Array(n).fill(null);
  const priorLow12h: Array<number | null> = new Array(n).fill(null);
  const ret12h: Array<number | null> = new Array(n).fill(null);
  const ret1h: Array<number | null> = new Array(n).fill(null);
  const ret2h: Array<number | null> = new Array(n).fill(null);
  const hasEnough: boolean[] = new Array(n).fill(false);

  // Prefix sums for vwap window (bars with endTs in (endTs - lookback, endTs]).
  const cumVol: number[] = new Array(n + 1).fill(0);
  const cumTurn: number[] = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    cumVol[i + 1] = cumVol[i] + candles[i].volume;
    cumTurn[i + 1] = cumTurn[i] + candles[i].turnover;
  }

  // Monotonic deque for rolling min low over prior 12h (bars strictly BEFORE current).
  const deque: number[] = []; // candle indices, lows increasing
  let llStart = 0; // first index with endTs > lookbackLowStart

  let vwapStartIdx = 0;
  let i12 = 0;
  let i1 = 0;
  let i2 = 0;

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    // vwap window start (endTs > c.endTs - lookback)
    const vwapCutoff = c.endTs - PB_VWAP_LOOKBACK_MIN * ONE_MIN;
    while (vwapStartIdx < i && candles[vwapStartIdx].endTs <= vwapCutoff) vwapStartIdx++;
    const vol = cumVol[i + 1] - cumVol[vwapStartIdx];
    const turn = cumTurn[i + 1] - cumTurn[vwapStartIdx];
    vwap24h[i] = vol > 0 ? turn / vol : null;
    const vwapBars = i + 1 - vwapStartIdx;

    // prior-low window: bars with endTs in (c.endTs - lookback, c.endTs) — EXCLUDES current bar.
    const llCutoff = c.endTs - PB_LL_LOOKBACK_MIN * ONE_MIN;
    while (llStart < i && candles[llStart].endTs <= llCutoff) {
      if (deque.length && deque[0] === llStart) deque.shift();
      llStart++;
    }
    // pop expired head (belt & suspenders when llStart jumped past deque head)
    while (deque.length && deque[0] < llStart) deque.shift();
    const llBars = i - llStart;
    priorLow12h[i] = deque.length ? candles[deque[0]].low : null;

    // returns vs last candle at-or-before offset
    const retAt = (idxRef: number, offsetMs: number, cursor: number): [number | null, number] => {
      const target = c.endTs - offsetMs;
      let k = cursor;
      while (k + 1 < n && candles[k + 1].endTs <= target) k++;
      const past = candles[k];
      const val = past && past.endTs <= target && past.close > 0 ? ((c.close - past.close) / past.close) * 100 : null;
      return [val, k];
    };
    [ret12h[i], i12] = retAt(i, PB_LL_LOOKBACK_MIN * ONE_MIN, i12);
    [ret1h[i], i1] = retAt(i, 60 * ONE_MIN, i1);
    [ret2h[i], i2] = retAt(i, 120 * ONE_MIN, i2);

    hasEnough[i] = llBars >= PB_LL_LOOKBACK_MIN * 0.95 && vwapBars >= PB_VWAP_LOOKBACK_MIN * 0.95;

    // push current bar into deque for FUTURE bars' prior-low windows
    while (deque.length && candles[deque[deque.length - 1]].low >= c.low) deque.pop();
    deque.push(i);
  }
  return { vwap24h, priorLow12h, ret12h, ret1h, ret2h, hasEnough };
}

// ── HL pulse score (offline recomputation of shadow-logger hlComponents) ─────

export async function buildHlScoreSeries(candles: Candle[], fromIdx = 0, dataDir = DATA): Promise<{ score: Array<number | null>; sellPressure: boolean[] }> {
  // taker: per-minute buy/sell notional buckets
  const takerBuy = new Map<number, number>();
  const takerSell = new Map<number, number>();
  await streamJsonl(path.join(dataDir, "HYPEUSDT_taker_hyperliquid.jsonl"), row => {
    const at = observationAvailability(row, "hl_taker");
    addAtAvailability(takerBuy, at, Number(row.buyNotional) || 0);
    addAtAvailability(takerSell, at, Number(row.sellNotional) || 0);
  });

  // asset ctx: per-minute last {oiValue, fundingRate}
  const assetByMinute = new CausalMinuteLatest<{ oi: number | null; funding: number | null }>();
  await streamJsonl(path.join(dataDir, "HYPEUSDT_asset_ctx_hyperliquid.jsonl"), row => {
    const at = observationAvailability(row);
    const oiVal = Number(row.openInterestValue);
    const oi = Number.isFinite(oiVal)
      ? oiVal
      : (Number.isFinite(Number(row.openInterest)) && Number.isFinite(Number(row.markPrice))
        ? Number(row.openInterest) * Number(row.markPrice)
        : null);
    const funding = Number.isFinite(Number(row.fundingRate)) ? Number(row.fundingRate) : null;
    assetByMinute.observe(at, { oi, funding });
  });
  const assetMinutes = Array.from(assetByMinute.keys()).sort((a, b) => a - b);

  // ob bands: per-minute last {imbalance05, bid05, ask05}
  const obByMinute = new CausalMinuteLatest<{ imb: number | null; bid05: number | null; ask05: number | null }>();
  await streamJsonl(path.join(dataDir, "HYPEUSDT_ob_bands_hyperliquid.jsonl"), row => {
    const at = observationAvailability(row);
    const imb = Number.isFinite(Number(row.imbalance_0_5)) ? Number(row.imbalance_0_5) : null;
    const bid05 = Number.isFinite(Number(row.bidBands?.pct_0_5)) ? Number(row.bidBands.pct_0_5) : null;
    const ask05 = Number.isFinite(Number(row.askBands?.pct_0_5)) ? Number(row.askBands.pct_0_5) : null;
    obByMinute.observe(at, { imb, bid05, ask05 });
  });
  const obMinutes = Array.from(obByMinute.keys()).sort((a, b) => a - b);

  // HL funding fallback (fdHlNow)
  const fdHl = await loadFundingRows(path.join(dataDir, "HYPEUSDT_funding_live_hyperliquid.jsonl"));

  const out: Array<number | null> = new Array(candles.length).fill(null);
  const sellOut: boolean[] = new Array(candles.length).fill(false);

  // Rolling taker sums over trailing 15m / 60m minute-buckets.
  let assetIdx = -1;
  let asset1hIdx = -1;
  let asset4hIdx = -1;
  let obIdx = -1;
  let fdIdx = -1;

  const lastAtOrBefore = (arr: number[], idx: number, target: number): number => {
    let k = idx;
    while (k + 1 < arr.length && arr[k + 1] <= target) k++;
    return k;
  };

  for (let i = fromIdx; i < candles.length; i++) {
    const now = candles[i].endTs;

    let buy15 = 0, sell15 = 0, buy60 = 0, sell60 = 0;
    for (let m = now - 60 * ONE_MIN + ONE_MIN; m <= now; m += ONE_MIN) {
      const b = takerBuy.get(m) ?? 0;
      const s = takerSell.get(m) ?? 0;
      buy60 += b;
      sell60 += s;
      if (m > now - 15 * ONE_MIN) {
        buy15 += b;
        sell15 += s;
      }
    }
    const hlTaker15m = sell15 > 0 ? buy15 / sell15 : null;
    const hlTaker1h = sell60 > 0 ? buy60 / sell60 : null;

    assetIdx = lastAtOrBefore(assetMinutes, Math.max(assetIdx, 0), now);
    asset1hIdx = lastAtOrBefore(assetMinutes, Math.max(asset1hIdx, 0), now - ONE_HOUR);
    asset4hIdx = lastAtOrBefore(assetMinutes, Math.max(asset4hIdx, 0), now - FOUR_HOURS);
    const assetNow = assetMinutes.length && assetMinutes[assetIdx] <= now ? assetByMinute.get(assetMinutes[assetIdx])! : null;
    const asset1h = assetMinutes.length && assetMinutes[asset1hIdx] <= now - ONE_HOUR ? assetByMinute.get(assetMinutes[asset1hIdx])! : null;
    const asset4h = assetMinutes.length && assetMinutes[asset4hIdx] <= now - FOUR_HOURS ? assetByMinute.get(assetMinutes[asset4hIdx])! : null;

    const oiNow = assetNow?.oi ?? null;
    const oi1hPct = oiNow !== null && asset1h?.oi ? ((oiNow - asset1h.oi) / asset1h.oi) * 100 : null;
    const oi4hPct = oiNow !== null && asset4h?.oi ? ((oiNow - asset4h.oi) / asset4h.oi) * 100 : null;

    obIdx = lastAtOrBefore(obMinutes, Math.max(obIdx, 0), now);
    const obNow = obMinutes.length && obMinutes[obIdx] <= now ? obByMinute.get(obMinutes[obIdx])! : null;
    const askBid05 = obNow && obNow.bid05 !== null && obNow.bid05 > 0 ? (obNow.ask05 ?? 0) / obNow.bid05 : null;

    while (fdIdx + 1 < fdHl.length && fdHl[fdIdx + 1].ts <= now) fdIdx++;
    const fdHlNow = fdHl.length && fdIdx >= 0 && fdHl[fdIdx].ts <= now ? fdHl[fdIdx].rate : null;
    const hlFundingNow = assetNow?.funding ?? fdHlNow;

    const fundingNegative = hlFundingNow !== null && hlFundingNow < 0;
    const takerFade = hlTaker15m !== null && hlTaker1h !== null && hlTaker15m < hlTaker1h * 0.75;
    const sellPressure =
      (hlTaker15m !== null && hlTaker15m <= 0.85) ||
      (hlTaker1h !== null && hlTaker1h <= 0.90) ||
      takerFade;
    const oiUnwind =
      (oi1hPct !== null && oi1hPct <= -0.50) ||
      (oi4hPct !== null && oi4hPct <= -1.00);
    const askWall =
      (obNow?.imb !== null && obNow?.imb !== undefined && obNow.imb <= -0.20) ||
      (askBid05 !== null && askBid05 >= 1.35);

    out[i] = [fundingNegative, sellPressure, oiUnwind, askWall].filter(Boolean).length;
    sellOut[i] = sellPressure;
  }
  return { score: out, sellPressure: sellOut };
}

// ── live episode reconstruction (parity anchors) ─────────────────────────────

export type LiveEpisode = {
  index: number;
  opens: Array<{ ts: number; price: number; notional: number }>;
  firstOpenTs: number;
  closeTs: number;
  closePnl: number;
  rungs: number;
  exitPrice: number;
  avgEntry: number;
  liveReason: string;
};

export function loadLiveEpisodes(): LiveEpisode[] {
  const logsDir = path.join(ROOT, "logs");
  const files = fs.readdirSync(logsDir)
    .filter(f => /^trades_\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .sort();
  const rows: AnyRow[] = [];
  for (const f of files) {
    for (const line of fs.readFileSync(path.join(logsDir, f), "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (row.symbol === "HYPEUSDT" || row.action === "BATCH_CLOSE") rows.push(row);
      } catch { /* partial line */ }
    }
  }
  rows.sort((a, b) => parseTsAny(a.ts) - parseTsAny(b.ts));

  // flatten decisions give live exit reasons
  const flattenReasons: Array<{ ts: number; reason: string }> = [];
  const decisionsFile = path.join(DATA, "HYPEUSDT_decisions.jsonl");
  if (fs.existsSync(decisionsFile)) {
    for (const line of fs.readFileSync(decisionsFile, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (row.decision === "flatten") flattenReasons.push({ ts: Number(row.ts), reason: String(row.reason ?? "") });
      } catch { /* ignore */ }
    }
  }

  const episodes: LiveEpisode[] = [];
  let opens: Array<{ ts: number; price: number; notional: number }> = [];
  for (const row of rows) {
    const ts = parseTsAny(row.ts);
    if (row.action === "OPEN_LONG" && row.success) {
      opens.push({ ts, price: Number(row.price), notional: Number(row.notional) });
    } else if (row.action === "BATCH_CLOSE") {
      if (!opens.length) continue;
      const near = flattenReasons.find(fr => Math.abs(fr.ts - ts) <= 2 * ONE_MIN);
      const pnl = Number(row.totalPnl);
      episodes.push({
        index: episodes.length,
        opens,
        firstOpenTs: opens[0].ts,
        closeTs: ts,
        closePnl: pnl,
        rungs: Number(row.positionsClosed),
        exitPrice: Number(row.exitPrice),
        avgEntry: Number(row.avgEntry),
        liveReason: near ? near.reason : (pnl > 0 ? "tp_or_manual" : "forced_or_manual"),
      });
      opens = [];
    }
  }
  return episodes;
}

// ── engine ───────────────────────────────────────────────────────────────────

type PbExitState = { active: boolean; postExitLow: number; cooldownUntil: number };
type PbActionState = {
  phase: "idle" | "watching" | "exited";
  postTriggerLow: number;
  watchUntil: number;
  reentryAfter: number;
};

export type EngineResult = {
  executionAudit?: { model: string; tpModel: string; events: import("./replay-causal-engine").ExecutionEvent[]; pendingAtEnd: unknown; lastAddTime: number; srCooldownUntil: number; fundingIncluded: boolean; makerCertified: boolean };
  closes: CloseEvent[];
  trims: TrimEvent[];
  actions: ActionEvent[];
  realized: number;
  openPnl: number;
  openDepth: number;
  maxDepthSeen: number;
  worstClose: number;
  bestClose: number;
  maxDrawdownPct: number;
  minEquity: number;
  blocked: Record<string, number>;
  endedFlatAtIdx: number | null;
  flips: number;
  flipPnl: number;
  flipFunding: number;
  maxOpenNotional: number;
  snapshots: EngineSnapshot[];
};

export type EngineSnapshot = {
  candleTs: number;
  ts: number;
  price: number;
  realizedPnl: number;
  longOpenPnl: number;
  engineOpenPnl: number;
  equity: number;
  longNotional: number;
  longQty: number;
  longAvgEntry: number | null;
  depth: number;
};

function pullbackModeAt(mode: PullbackMode, ts: number): "none" | "full_exit" | "trim" {
  if (mode !== "liveSegmented") return mode;
  if (ts >= SEG_TRIM_START) return "trim";
  if (ts >= SEG_FULL_EXIT_START) return "full_exit";
  return "none";
}

function forcedCooldownUntil(ts: number, mode: EngineParams["cooldownMode"]): number {
  if (mode === "live4h") return (Math.floor(ts / FOUR_HOURS) + 2) * FOUR_HOURS;
  return ts + Number(mode.replace("h", "")) * ONE_HOUR;
}

function avgEntryOf(positions: Position[]): number | null {
  const qty = positions.reduce((sum, p) => sum + p.qty, 0);
  return qty > 0 ? positions.reduce((sum, p) => sum + p.entryPrice * p.qty, 0) / qty : null;
}

function closePnlAll(positions: Position[], price: number): number {
  let pnl = 0;
  for (const p of positions) {
    pnl += (price - p.entryPrice) * p.qty - p.notional * FEE - p.qty * price * FEE;
  }
  return pnl;
}

export function runEngine(
  params: EngineParams,
  s: Series,
  opts: {
    startIdx: number;
    endIdx?: number;
    seed?: { ts: number; price: number; notional?: number };
    stopWhenFlat?: boolean;
    recordSnapshots?: boolean;
  },
): EngineResult {
  if (params.executionModel !== "legacy_ohlc") return runCausalLongReplay(params, s, opts, CONFIG, INITIAL_EQUITY);
  return runLegacyEngine(params, s, opts);
}

/** Archived execution assumptions only; never use as a new causal profit control. */
export function runLegacyEngine(
  params: EngineParams,
  s: Series,
  opts: { startIdx: number; endIdx?: number; seed?: { ts: number; price: number; notional?: number }; stopWhenFlat?: boolean; recordSnapshots?: boolean },
): EngineResult {
  const candles = s.candles;
  const endIdx = Math.min(opts.endIdx ?? candles.length, candles.length);
  assertContextCoverage(s, opts.startIdx, endIdx);
  const pBase = params.baseUsdt ?? BASE_USDT;
  const pScale = params.addScale ?? ADD_SCALE;
  const pTrig = params.priceTriggerPct ?? PRICE_TRIGGER_PCT;
  const pInterval = params.addIntervalMin ?? ADD_INTERVAL_MIN;
  const positions: Position[] = [];
  const closes: CloseEvent[] = [];
  const trims: TrimEvent[] = [];
  const snapshots: EngineSnapshot[] = [];
  const blocked: Record<string, number> = {
    trend: 0, riskOff: 0, regime: 0, ladderKill: 0, deepStress: 0, overextended: 0, cooldown: 0,
  };
  let realized = 0;
  let episode = 0;
  let entryIso = "";
  let lastAddTs = 0; // persists across TP closes, like live
  let cooldownUntil = 0;
  let minPnlPct = 0;
  let maxDepthThisEpisode = 0;
  let maxDepthSeen = 0;
  let trimsThisEpisode = 0;
  let trimPnlThisEpisode = 0;
  let peakEquity = INITIAL_EQUITY;
  let minEquity = INITIAL_EQUITY;
  let maxDrawdownPct = 0;
  let worstClose = Number.POSITIVE_INFINITY;
  let bestClose = Number.NEGATIVE_INFINITY;
  let endedFlatAtIdx: number | null = null;

  const pbExit: PbExitState = { active: false, postExitLow: Infinity, cooldownUntil: 0 };
  const pbAction: PbActionState = { phase: "idle", postTriggerLow: Infinity, watchUntil: 0, reentryAfter: 0 };
  const actions: ActionEvent[] = [];
  // Phase-1 configurable action watch state.
  const cfgWatch = { phase: "idle" as "idle" | "watching" | "exited", postLow: Infinity, triggerLow: Infinity, watchUntil: 0, reentryAfter: 0 };
  // Boxed so closure assignments don't fight TS control-flow narrowing.
  const hedgeBox: { cur: { qty: number; entryPrice: number; entryTs: number } | null } = { cur: null };
  let hedgePnlThisEpisode = 0;
  // Phase-C overlay hedge (separate from the Phase-1 pullback-action hedge).
  const ovBox: { cur: { qty: number; entryPrice: number; entryTs: number } | null } = { cur: null };
  let ovLastOpenTs = 0;
  // Post-exit continuation flip.
  const flipBox: { cur: { qty: number; notional: number; entryPrice: number; entryTs: number; postLow: number; fundingBucket: number; accruedFunding: number } | null } = { cur: null };
  let flipCount = 0;
  let flipPnlTotal = 0;
  let flipFundingTotal = 0;
  // Deep-tail backstop state.
  let dtPersist = 0;
  let dtShelfSince = 0;
  let dtCooldownUntil = 0;
  // Dynamic sizing state: base for the CURRENT episode, chosen at ladder open.
  let curBase = pBase;
  let sizingAnchorEquity: number | null = null;
  let sizingAnchorBase: number | null = null;
  let addPauseUntil = 0;
  let addPauseLoggedTs = 0;
  let lateRungHighDelayActive = false;
  // Score-partial action + hard-flatten softener state.
  let scorePartialFired = false;
  let hfDeferUntil = 0;
  let hfDeferUsed = false;
  let hfWatchUntil = 0;
  let hfWatchPrice = 0;
  let hfSuppressUntil = 0;
  let lastForcedExitTs = -Infinity;
  let maxOpenNotionalSeen = 0;
  const pickBase = (i: number): number => {
    const sp = params.sizingPolicy;
    if (!sp) return pBase;
    const adjustment = params.sizingEquityAdjustment?.(i) ?? 0;
    const equity = INITIAL_EQUITY + realized + adjustment;
    const baseAtEquity = (value: number): number => {
      let selected = sp.floorBase;
      if (sp.equityPct !== undefined) selected = value * sp.equityPct / 100;
      if (sp.watermarkSteps) {
        for (const step of sp.watermarkSteps) if (value >= step.equityMin) selected = Math.max(selected, step.base);
      }
      return Math.min(sp.capBase, Math.max(sp.floorBase, selected));
    };
    let b = baseAtEquity(equity);
    if (sp.rebalanceBandPct !== undefined) {
      const band = sp.rebalanceBandPct / 100;
      if (!(band > 0 && band < 1)) throw new Error(`invalid sizing rebalance band ${sp.rebalanceBandPct}`);
      if (
        sizingAnchorEquity === null
        || sizingAnchorBase === null
        || equity <= sizingAnchorEquity * (1 - band)
        || equity >= sizingAnchorEquity * (1 + band)
      ) {
        sizingAnchorEquity = equity;
        sizingAnchorBase = b;
      }
      b = sizingAnchorBase;
    }
    if (sp.grindGateKey) {
      const g = s.extraTriggers?.get(sp.grindGateKey);
      let ok = !!g?.[i];
      if (ok && sp.grindPersistMin) {
        for (let k = Math.max(0, i - sp.grindPersistMin); k <= i && ok; k++) ok = !!g![k];
      }
      if (!ok) b = sp.floorBase;
    }
    if (sp.tailStepdownDays && s.candles[i].endTs - lastForcedExitTs < sp.tailStepdownDays * DAY_MS) b = sp.floorBase;
    if (sp.euphoriaCapBase !== undefined) {
      const high14 = s.high14d[i];
      const nearHigh = high14 !== null && ((high14 - s.candles[i].close) / high14) * 100 <= 10;
      if (s.aboveEma200[i] && nearHigh) b = Math.min(b, sp.euphoriaCapBase);
    }
    return b;
  };
  // Phase-B S/R zone pointer + action state.
  let srIdx = -1;
  let srPartialLastTs = 0;
  let srProtectActiveLogged = false;
  const srZonesAt = (ts: number): number[] | null => {
    const zones = s.srZones;
    if (!zones || !zones.length) return null;
    while (srIdx + 1 < zones.length && zones[srIdx + 1].ts <= ts) srIdx++;
    return srIdx >= 0 ? zones[srIdx].prices : null;
  };
  /** Distance in % from px to nearest zone above/below, or null if none within maxPct. */
  const srDist = (prices: number[] | null, px: number, above: boolean, maxPct: number): number | null => {
    if (!prices || !prices.length) return null;
    let best: number | null = null;
    for (const zp of prices) {
      if (above && zp > px) { best = ((zp - px) / px) * 100; break; }
      if (!above && zp < px) best = ((px - zp) / px) * 100;
      if (!above && zp >= px) break;
    }
    return best !== null && best <= maxPct ? best : null;
  };
  const pulseOk = (kind: "hostile" | "deteriorating" | "none", i: number): boolean => {
    if (kind === "none") return true;
    if (kind === "hostile") return s.pulseHostile?.[i] ?? false;
    return s.pulseDeteriorating?.[i] ?? false;
  };
  // Phase-2 euphoria watch state.
  const eu = { watching: false, postLow: Infinity, triggerLow: Infinity, watchUntil: 0, cooldownUntil: 0 };
  // Phase-3 re-entry gate state.
  const reentryBox: { cur: { exitPrice: number; postLow: number; lastNewLowTs: number } | null } = { cur: null };

  const ctxOf = (i: number, depth: number, pnlPct: number | null): Pick<ActionEvent, "ret12h" | "hlScore" | "vwapDistPct" | "distHigh14dPct" | "pnlPct"> => {
    const c = s.candles[i];
    const vwap = s.vwap24h[i];
    const high = s.high14d[i];
    return {
      pnlPct: pnlPct === null ? "" : r(pnlPct, 4),
      ret12h: s.ret12h[i] === null ? "" : r(s.ret12h[i] as number, 4),
      hlScore: s.hlScore[i] === null ? "" : (s.hlScore[i] as number),
      vwapDistPct: vwap === null ? "" : r(((c.close - vwap) / vwap) * 100, 4),
      distHigh14dPct: high === null ? "" : r(((high - c.close) / high) * 100, 4),
    };
  };
  const logAction = (i: number, kind: string, depth: number, pnlPct: number | null, detail: string) => {
    actions.push({
      variant: params.id,
      episode,
      ts: s.candles[i].endTs,
      iso: iso(s.candles[i].endTs),
      kind,
      price: s.candles[i].close,
      depth,
      ...ctxOf(i, depth, pnlPct),
      detail,
    });
  };
  const closeHedge = (i: number, why: string) => {
    const h = hedgeBox.cur;
    if (!h) return;
    const px = s.candles[i].close;
    const pnl = (h.entryPrice - px) * h.qty - h.entryPrice * h.qty * FEE - px * h.qty * FEE;
    realized += pnl;
    hedgePnlThisEpisode += pnl;
    logAction(i, "hedge_close", positions.length, null, `${why}; pnl=${pnl.toFixed(2)}`);
    hedgeBox.cur = null;
  };
  const closeFlip = (i: number, px: number, why: string) => {
    const f = flipBox.cur;
    if (!f) return;
    const pnl = (f.entryPrice - px) * f.qty - f.entryPrice * f.qty * FEE - px * f.qty * FEE + f.accruedFunding;
    realized += pnl;
    flipPnlTotal += pnl;
    flipFundingTotal += f.accruedFunding;
    logAction(i, "flip_close", positions.length, null, `${why}; px=${px.toFixed(4)}; pnl=${pnl.toFixed(2)}; funding=${f.accruedFunding.toFixed(2)}; holdH=${((s.candles[i].endTs - f.entryTs) / ONE_HOUR).toFixed(1)}`);
    flipBox.cur = null;
  };
  const FLIP_REASONS: Record<string, string[]> = {
    forced_all: ["hard_flatten", "emergency_kill", "funding_spike", "pullback_exit", "pullback_action_exit", "euphoria_stop"],
    eu_only: ["euphoria_stop"],
    pullback_only: ["pullback_exit", "pullback_action_exit"],
  };
  const closeOverlay = (i: number, px: number, why: string) => {
    const h = ovBox.cur;
    if (!h) return;
    const pnl = (h.entryPrice - px) * h.qty - h.entryPrice * h.qty * FEE - px * h.qty * FEE;
    realized += pnl;
    hedgePnlThisEpisode += pnl;
    logAction(i, "ovhedge_close", positions.length, null, `${why}; px=${px.toFixed(4)}; pnl=${pnl.toFixed(2)}`);
    ovBox.cur = null;
  };
  const setupForcedReentry = (i: number, endTsForced: number) => {
    if (params.reentry) {
      reentryBox.cur = { exitPrice: s.candles[i].close, postLow: s.candles[i].low, lastNewLowTs: s.candles[i].endTs };
      cooldownUntil = 0;
    } else {
      cooldownUntil = endTsForced;
    }
  };
  /** Execute the Phase-1 configured action. Returns "closed" | "trimmed" | "hedged" | "noop". */
  const actConfigured = (i: number, pnlPct: number): "closed" | "trimmed" | "hedged" | "noop" => {
    const cfg = params.pullbackActionCfg!;
    const c = s.candles[i];
    if (cfg.action === "full_exit") {
      logAction(i, "pb_full_exit", positions.length, pnlPct, `watch=${cfg.watchMin}m reclaim=${cfg.reclaimPct}%`);
      recordClose(i, "pullback_action_exit", c.close);
      setupForcedReentry(i, c.endTs + PB_EXIT_ACTION_COOLDOWN_MIN * ONE_MIN);
      return "closed";
    }
    if (cfg.action === "trim") {
      let pnl = 0;
      const share = Math.max(0, Math.min(0.95, cfg.closePct));
      for (const p of positions) {
        const closeQty = p.qty * share;
        const entryNotional = p.notional * share;
        pnl += (c.close - p.entryPrice) * closeQty - entryNotional * FEE - closeQty * c.close * FEE;
        p.qty -= closeQty;
        p.notional -= entryNotional;
      }
      realized += pnl;
      trimsThisEpisode++;
      trimPnlThisEpisode += pnl;
      trims.push({
        variant: params.id, episode, ts: c.endTs, iso: iso(c.endTs), price: c.close,
        closedShare: share, pnl: r(pnl, 4), depth: positions.length,
      });
      logAction(i, "pb_trim", positions.length, pnlPct, `share=${share}; pnl=${pnl.toFixed(2)}`);
      cfgWatch.phase = "exited";
      cfgWatch.reentryAfter = c.endTs + PBA_REENTRY_COOLDOWN_MIN * ONE_MIN;
      return "trimmed";
    }
    if (cfg.action === "hedge" && !hedgeBox.cur) {
      const totalQty = positions.reduce((sum, p) => sum + p.qty, 0);
      const h = { qty: totalQty * cfg.closePct, entryPrice: c.close, entryTs: c.endTs };
      hedgeBox.cur = h;
      logAction(i, "hedge_open", positions.length, pnlPct, `qty=${h.qty.toFixed(3)} share=${cfg.closePct}`);
      cfgWatch.phase = "exited";
      cfgWatch.reentryAfter = c.endTs + PBA_REENTRY_COOLDOWN_MIN * ONE_MIN;
      return "hedged";
    }
    return "noop";
  };

  if (opts.seed) {
    const notional = opts.seed.notional ?? pBase;
    positions.push({
      entryTs: opts.seed.ts,
      entryPrice: opts.seed.price,
      qty: notional / opts.seed.price,
      notional,
      level: 0,
    });
    lastAddTs = opts.seed.ts;
    entryIso = iso(opts.seed.ts);
    episode = 1;
    maxDepthThisEpisode = 1;
    maxDepthSeen = 1;
  }

  const recordClose = (i: number, reason: string, exitPrice: number) => {
    const c = candles[i];
    closeHedge(i, `ladder closed (${reason})`);
    closeOverlay(i, c.close, `ladder closed (${reason})`);
    const avg = avgEntryOf(positions) ?? 0;
    const pnl = closePnlAll(positions, exitPrice);
    realized += pnl;
    worstClose = Math.min(worstClose, pnl);
    bestClose = Math.max(bestClose, pnl);
    closes.push({
      variant: params.id,
      episode,
      entryIso,
      closeIso: iso(c.endTs),
      closeTs: c.endTs,
      reason,
      rungs: positions.length,
      maxDepth: maxDepthThisEpisode,
      avgEntry: r(avg, 6),
      exitPrice: r(exitPrice, 6),
      pnl: r(pnl, 4),
      holdHours: r((c.endTs - Math.min(...positions.map(p => p.entryTs))) / ONE_HOUR, 3),
      minPnlPct: r(minPnlPct, 4),
      trimsInEpisode: trimsThisEpisode,
      trimPnlInEpisode: r(trimPnlThisEpisode, 4),
      hedgePnlInEpisode: r(hedgePnlThisEpisode, 4),
      baseUsed: curBase,
    });
    const closedNotional = positions.reduce((sum, p) => sum + p.notional, 0);
    positions.length = 0;
    minPnlPct = 0;
    maxDepthThisEpisode = 0;
    trimsThisEpisode = 0;
    trimPnlThisEpisode = 0;
    hedgePnlThisEpisode = 0;
    pbAction.phase = "idle";
    pbAction.postTriggerLow = Infinity;
    cfgWatch.phase = "idle";
    cfgWatch.postLow = Infinity;
    eu.watching = false;
    eu.postLow = Infinity;
    dtPersist = 0;
    dtShelfSince = 0;
    scorePartialFired = false;
    hfDeferUntil = 0;
    hfDeferUsed = false;
    hfWatchUntil = 0;
    hfSuppressUntil = 0;
    if (["hard_flatten", "emergency_kill", "funding_spike", "pullback_exit", "pullback_action_exit", "euphoria_stop", "deep_tail"].includes(reason)) {
      lastForcedExitTs = c.endTs;
    }
    // Post-exit continuation flip: the forced exit itself is the short trigger.
    const fc = params.shortFlip;
    if (fc && !flipBox.cur && FLIP_REASONS[fc.trigger].includes(reason)) {
      const notional = closedNotional * fc.sizePctOfClosed;
      if (notional > 0) {
        flipBox.cur = {
          qty: notional / c.close,
          notional,
          entryPrice: c.close,
          entryTs: c.endTs,
          postLow: c.low,
          fundingBucket: Math.floor(c.endTs / (8 * ONE_HOUR)),
          accruedFunding: 0,
        };
        flipCount++;
        logAction(i, "flip_open", 0, null, `after ${reason}; notional=${notional.toFixed(0)}`);
      }
    }
  };

  for (let i = opts.startIdx; i < endIdx; i++) {
    const c = candles[i];
    try {

    // ── continuation-flip management (runs in flat and open states) ──
    if (flipBox.cur && params.shortFlip) {
      const fc = params.shortFlip;
      const f = flipBox.cur;
      if (fc.fundingAccrual) {
        const bucket = Math.floor(c.endTs / (8 * ONE_HOUR));
        while (f.fundingBucket < bucket) {
          f.fundingBucket++;
          const rate = s.bybitFunding[i];
          if (rate !== null) f.accruedFunding += rate * f.notional; // short receives positive funding
        }
      }
      f.postLow = Math.min(f.postLow, c.low);
      const ageH = (c.endTs - f.entryTs) / ONE_HOUR;
      const killPrice = fc.killPct !== null ? f.entryPrice * (1 + fc.killPct / 100) : Infinity;
      const reclaimPrice = f.postLow * (1 + fc.reclaimPct / 100);
      const momentumOk =
        (s.ret1h[i] !== null && (s.ret1h[i] as number) >= PB_MOM_RET1H_MIN) ||
        (s.ret2h[i] !== null && (s.ret2h[i] as number) >= PB_MOM_RET2H_MIN);
      if (c.high >= killPrice) closeFlip(i, killPrice, "kill");
      else if (c.close >= reclaimPrice && momentumOk) closeFlip(i, c.close, "reclaim");
      else if (ageH >= fc.maxHoldHours) closeFlip(i, c.close, "max_hold");
    }

    const hActive = hedgeBox.cur;
    const ovActive = ovBox.cur;
    const fActive = flipBox.cur;
    const hedgeMark = (hActive ? (hActive.entryPrice - c.close) * hActive.qty : 0)
      + (ovActive ? (ovActive.entryPrice - c.close) * ovActive.qty : 0)
      + (fActive ? (fActive.entryPrice - c.close) * fActive.qty + fActive.accruedFunding : 0);
    const markPnl = (positions.length ? closePnlAll(positions, c.close) : 0) + hedgeMark;
    const equity = INITIAL_EQUITY + realized + markPnl;
    peakEquity = Math.max(peakEquity, equity);
    minEquity = Math.min(minEquity, equity);
    if (peakEquity > 0) maxDrawdownPct = Math.max(maxDrawdownPct, ((peakEquity - equity) / peakEquity) * 100);

    // ── exits ──
    if (positions.length > 0) {
      const avg = avgEntryOf(positions)!;
      const pnlPct = ((c.close - avg) / avg) * 100;
      minPnlPct = Math.min(minPnlPct, pnlPct);
      const ageH = (c.endTs - Math.min(...positions.map(p => p.entryTs))) / ONE_HOUR;
      // Phase-B profit protect: tighten TP to the stale target while resistance blocks the TP path.
      let srProtect = false;
      if (params.srExec?.profitProtect) {
        const cfg = params.srExec.profitProtect;
        const zones = srZonesAt(c.ts);
        const tpTarget = avg * (1 + TP_PCT / 100);
        const tpBlocked = srDist(zones, tpTarget, true, cfg.tpBufferPct) !== null;
        const nearR = srDist(zones, c.close, true, cfg.nearBufferPct) !== null;
        const wideR = srDist(zones, c.close, true, 3.0) !== null;
        const askWall = s.hlAskWall?.[i] ?? false;
        if (positions.length >= cfg.minDepth && pnlPct >= cfg.minLadderPnlPct && askWall) {
          if (cfg.mode === "askwall") srProtect = tpBlocked || nearR;
          else srProtect = (nearR || wideR || tpBlocked) && (s.hlExhaustion?.[i] ?? false);
        }
        if (srProtect && !srProtectActiveLogged) {
          logAction(i, "sr_protect_on", positions.length, pnlPct, `mode=${cfg.mode}`);
          srProtectActiveLogged = true;
        } else if (!srProtect) {
          srProtectActiveLogged = false;
        }
      }
      const activeTpPct = srProtect || (ageH >= STALE_HOURS && pnlPct < STALE_TP_PCT) ? STALE_TP_PCT : TP_PCT;
      const tp = avg * (1 + activeTpPct / 100);

      let reason = "";
      let exitPrice = 0;
      if (c.high >= tp * (1 + (params.tpFillBufferPct ?? 0) / 100)) {
        reason = activeTpPct < TP_PCT ? "stale_tp" : "tp";
        exitPrice = tp;
      } else if (pnlPct <= EMERGENCY_KILL_PCT) {
        reason = "emergency_kill";
        exitPrice = c.close;
      } else if (positions.length >= FUNDING_SPIKE_DEPTH && s.bybitFunding[i] !== null && (s.bybitFunding[i] as number) >= FUNDING_SPIKE_RATE) {
        reason = "funding_spike";
        exitPrice = c.close;
      } else if (ageH >= params.hardFlattenHours && pnlPct <= params.hardFlattenPct && (params.hardFlattenIgnoreTrend || s.trendBlocked[i]) && c.endTs >= hfSuppressUntil) {
        const soft = params.hfSoftener;
        const ret12hOk = soft?.ret12hMin !== undefined && s.ret12h[i] !== null && (s.ret12h[i] as number) > soft.ret12hMin;
        const supportDist = soft?.supportBufferPct === undefined
          ? null
          : srDist(srZonesAt(c.endTs), c.close, false, soft.supportBufferPct);
        const supportOk = soft?.supportBufferPct === undefined || supportDist !== null;
        const slowChop = ret12hOk && supportOk;
        if (!soft || !slowChop) {
          reason = "hard_flatten";
          exitPrice = c.close;
        } else if (soft.mode === "defer") {
          if (!hfDeferUsed) {
            hfDeferUsed = true;
            hfDeferUntil = c.endTs + (soft.deferMin ?? 30) * ONE_MIN;
            logAction(i, "hf_defer", positions.length, pnlPct, `defer ${soft.deferMin ?? 30}m; ret12h=${s.ret12h[i]}; supportDist=${supportDist ?? "na"}`);
          }
          if (c.endTs >= hfDeferUntil) {
            reason = "hard_flatten";
            exitPrice = c.close;
          }
        } else {
          // trim_watch: proportional trim now, reclaim watch on the remainder.
          if (hfWatchUntil === 0) {
            const share = Math.min(0.95, soft.trimPct ?? 0.5);
            let pnl = 0;
            for (const p of positions) {
              const cq = p.qty * share;
              const en = p.notional * share;
              pnl += (c.close - p.entryPrice) * cq - en * FEE - cq * c.close * FEE;
              p.qty -= cq;
              p.notional -= en;
            }
            realized += pnl;
            trimsThisEpisode++;
            trimPnlThisEpisode += pnl;
            trims.push({ variant: params.id, episode, ts: c.endTs, iso: iso(c.endTs), price: c.close, closedShare: share, pnl: r(pnl, 4), depth: positions.length });
            hfWatchUntil = c.endTs + (soft.watchMin ?? 30) * ONE_MIN;
            hfWatchPrice = c.close;
            logAction(i, "hf_trim_watch", positions.length, pnlPct, `trim ${share}; watch ${soft.watchMin ?? 30}m; pnl=${pnl.toFixed(2)}`);
          } else if (c.close >= hfWatchPrice * (1 + (soft.reclaimPct ?? 0.5) / 100)) {
            hfWatchUntil = 0;
            hfSuppressUntil = c.endTs + 4 * ONE_HOUR;
            logAction(i, "hf_watch_reclaimed", positions.length, pnlPct, `keep remainder; suppress hf 4h`);
          } else if (c.endTs >= hfWatchUntil) {
            reason = "hard_flatten";
            exitPrice = c.close;
          }
        }
      }

      if (reason) {
        recordClose(i, reason, exitPrice);
        if (reason === "tp" || reason === "stale_tp") {
          if (params.tpCooldownOverrideMin !== undefined) {
            cooldownUntil = c.endTs + params.tpCooldownOverrideMin * ONE_MIN;
          } else {
            const rsi = s.rsi1H[i];
            cooldownUntil = rsi !== null && rsi > TP_COOLDOWN_RSI ? c.endTs + TP_COOLDOWN_MIN * ONE_MIN : 0;
          }
        } else {
          setupForcedReentry(i, forcedCooldownUntil(c.endTs, params.cooldownMode));
        }
        if (opts.stopWhenFlat) {
          endedFlatAtIdx = i;
          break;
        }
        continue;
      }

      // ── Score partial-flatten ACTION (recorded score fires; one-shot per ladder) ──
      if (params.scorePartialAction && !scorePartialFired && positions.length > 0) {
        const sp = params.scorePartialAction;
        const trigOk = s.extraTriggers?.get(sp.triggerKey)?.[i];
        if (trigOk && positions.length >= sp.minDepth && pnlPct <= sp.pnlMax && (sp.maxAgeH === null || ageH <= sp.maxAgeH)) {
          const share = Math.min(0.95, sp.closePct);
          let pnl = 0;
          for (const p of positions) {
            const cq = p.qty * share;
            const en = p.notional * share;
            pnl += (c.close - p.entryPrice) * cq - en * FEE - cq * c.close * FEE;
            p.qty -= cq;
            p.notional -= en;
          }
          realized += pnl;
          trimsThisEpisode++;
          trimPnlThisEpisode += pnl;
          trims.push({ variant: params.id, episode, ts: c.endTs, iso: iso(c.endTs), price: c.close, closedShare: share, pnl: r(pnl, 4), depth: positions.length });
          scorePartialFired = true;
          logAction(i, "score_partial", positions.length, pnlPct, `share=${share}; ageH=${ageH.toFixed(1)}; pnl=${pnl.toFixed(2)}`);
        }
      }

      // ── Phase-2 euphoria-regime stop (trend-independent, failed-reclaim gated) ──
      if (params.euphoriaStop && positions.length > 0) {
        const cfg = params.euphoriaStop;
        if (eu.watching) {
          const madeLowerLow = c.low < eu.triggerLow;
          eu.postLow = Math.min(eu.postLow, c.low);
          const reclaimPrice = eu.postLow * (1 + cfg.reclaimPct / 100);
          if (c.close >= reclaimPrice) {
            eu.watching = false;
            eu.cooldownUntil = c.endTs + 240 * ONE_MIN;
            logAction(i, "eu_watch_cancel", positions.length, pnlPct, `reclaimed ${reclaimPrice.toFixed(4)}`);
          } else if (c.endTs >= eu.watchUntil) {
            const hlOk = cfg.hlScoreMin !== null && (s.hlScore[i] ?? -Infinity) >= cfg.hlScoreMin;
            const llOk = cfg.lowerLowAlt && (madeLowerLow || eu.postLow < eu.triggerLow);
            const fire = cfg.hlScoreMin === null && !cfg.lowerLowAlt ? true : (hlOk || llOk);
            eu.watching = false;
            eu.cooldownUntil = c.endTs + 240 * ONE_MIN;
            if (fire) {
              logAction(i, "eu_stop", positions.length, pnlPct, `failed reclaim ${cfg.watchMin}m; hlOk=${hlOk} llOk=${llOk}`);
              recordClose(i, "euphoria_stop", c.close);
              setupForcedReentry(i, forcedCooldownUntil(c.endTs, params.cooldownMode));
              if (opts.stopWhenFlat) {
                endedFlatAtIdx = i;
                break;
              }
              continue;
            }
            logAction(i, "eu_watch_expire_nofire", positions.length, pnlPct, `hlOk=${hlOk} llOk=${llOk}`);
          }
        } else if (c.endTs >= eu.cooldownUntil) {
          const avgE = avgEntryOf(positions)!;
          const high14 = s.high14d[i];
          const trigger =
            positions.length >= cfg.minDepth &&
            pnlPct <= cfg.pnlMax &&
            (cfg.ret12hMax === null || (s.ret12h[i] !== null && (s.ret12h[i] as number) <= cfg.ret12hMax)) &&
            (!cfg.requireAboveEma200 || s.aboveEma200[i]) &&
            (!cfg.requireBelowVwap || (s.vwap24h[i] !== null && c.close < (s.vwap24h[i] as number))) &&
            (cfg.avgEntryNearHighPct === null || (high14 !== null && avgE >= high14 * (1 - cfg.avgEntryNearHighPct / 100)));
          if (trigger) {
            eu.watching = true;
            eu.postLow = c.low;
            eu.triggerLow = c.low;
            eu.watchUntil = c.endTs + cfg.watchMin * ONE_MIN;
            logAction(i, "eu_trigger", positions.length, pnlPct, `watch ${cfg.watchMin}m reclaim ${cfg.reclaimPct}%`);
          }
        }
      }

      // ── Deep-tail backstop (trend-independent, below euphoria/pullback layers) ──
      if (params.deepTail && positions.length > 0 && c.endTs >= dtCooldownUntil) {
        const dt = params.deepTail;
        const ladderOk = positions.length >= dt.minDepth && pnlPct <= dt.pnlMax;
        let fire = false;
        let why = "";
        if (dt.mechanism === "time_underwater") {
          const vwapOk = !dt.requireNoVwapReclaim || (s.vwap1h?.[i] != null && c.close < (s.vwap1h[i] as number));
          if (ladderOk && vwapOk) dtPersist++;
          else dtPersist = 0;
          if (dtPersist >= (dt.persistMin ?? 60)) {
            fire = true;
            why = `underwater ${dtPersist}m at depth>=${dt.minDepth} pnl<=${dt.pnlMax}`;
          }
        } else if (dt.mechanism === "crash_velocity") {
          const v1 = dt.ret1hMax == null || (s.ret1h[i] !== null && (s.ret1h[i] as number) <= dt.ret1hMax);
          const v3 = dt.ret3hMax == null || (s.ret3h?.[i] != null && (s.ret3h[i] as number) <= dt.ret3hMax);
          const btcOk = !dt.requireBtcWeak || (s.btcRet1h?.[i] != null && (s.btcRet1h[i] as number) <= 0);
          if (ladderOk && v1 && v3 && btcOk) {
            fire = true;
            why = `velocity ret1h=${s.ret1h[i]} ret3h=${s.ret3h?.[i]}`;
          }
        } else if (dt.mechanism === "failed_shelf") {
          // Just below a broken support: a zone within 1% ABOVE price, close below it.
          const zoneAbove = srDist(srZonesAt(c.ts), c.close, true, 1.0);
          if (zoneAbove !== null) {
            if (dtShelfSince === 0) dtShelfSince = c.endTs;
          } else {
            dtShelfSince = 0;
          }
          const heldMin = dtShelfSince > 0 ? (c.endTs - dtShelfSince) / ONE_MIN : 0;
          if (ladderOk && heldMin >= (dt.shelfWaitMin ?? 60)) {
            fire = true;
            why = `below shelf ${heldMin.toFixed(0)}m`;
          }
        } else if (dt.mechanism === "ek_softener") {
          const confirm = dt.ret1hMax == null || (s.ret1h[i] !== null && (s.ret1h[i] as number) <= dt.ret1hMax);
          if (ladderOk && confirm) {
            fire = true;
            why = `ek_softener pnl<=${dt.pnlMax} ret1h=${s.ret1h[i]}`;
          }
        }
        if (fire) {
          const share = dt.mechanism === "ek_softener" ? Math.min(1, dt.closePct ?? 1) : 1;
          logAction(i, "deep_tail_fire", positions.length, pnlPct, `${dt.mechanism}; ${why}; share=${share}`);
          dtPersist = 0;
          dtShelfSince = 0;
          dtCooldownUntil = c.endTs + 240 * ONE_MIN;
          if (share >= 1) {
            recordClose(i, "deep_tail", c.close);
            setupForcedReentry(i, forcedCooldownUntil(c.endTs, params.cooldownMode));
            if (opts.stopWhenFlat) { endedFlatAtIdx = i; break; }
            continue;
          }
          let pnl = 0;
          for (const p of positions) {
            const closeQty = p.qty * share;
            const entryNotional = p.notional * share;
            pnl += (c.close - p.entryPrice) * closeQty - entryNotional * FEE - closeQty * c.close * FEE;
            p.qty -= closeQty;
            p.notional -= entryNotional;
          }
          realized += pnl;
          trimsThisEpisode++;
          trimPnlThisEpisode += pnl;
          trims.push({ variant: params.id, episode, ts: c.endTs, iso: iso(c.endTs), price: c.close, closedShare: share, pnl: r(pnl, 4), depth: positions.length });
        }
      }

      // ── Phase-B partial exit at resistance: close most-profitable rungs, keep worst K ──
      if (params.srExec?.partialExit && positions.length > 0) {
        const cfg = params.srExec.partialExit;
        const nearR = srDist(srZonesAt(c.ts), c.close, true, cfg.bufferPct) !== null;
        if (
          nearR &&
          positions.length >= cfg.minDepth &&
          positions.length > cfg.keepRungs &&
          (cfg.minLadderPnlPct === null || pnlPct >= cfg.minLadderPnlPct) &&
          pulseOk(cfg.pulse, i) &&
          c.endTs - srPartialLastTs >= cfg.cooldownMin * ONE_MIN
        ) {
          const ranked = positions
            .map((p, idx) => ({ idx, upnl: (c.close - p.entryPrice) * p.qty }))
            .sort((x, y) => y.upnl - x.upnl);
          const closeSet = ranked.slice(0, positions.length - cfg.keepRungs);
          let pnl = 0;
          for (const { idx } of closeSet) {
            const p = positions[idx];
            pnl += (c.close - p.entryPrice) * p.qty - p.notional * FEE - p.qty * c.close * FEE;
          }
          if (!cfg.requirePlanProfit || pnl > 0) {
            const closeIdx = new Set(closeSet.map(x => x.idx));
            const remaining = positions.filter((_, idx) => !closeIdx.has(idx));
            positions.length = 0;
            positions.push(...remaining);
            realized += pnl;
            trimsThisEpisode++;
            trimPnlThisEpisode += pnl;
            trims.push({
              variant: params.id, episode, ts: c.endTs, iso: iso(c.endTs), price: c.close,
              closedShare: r(closeSet.length / (closeSet.length + remaining.length), 4), pnl: r(pnl, 4), depth: positions.length,
            });
            logAction(i, "sr_partial_exit", positions.length, pnlPct, `closed=${closeSet.length} keep=${cfg.keepRungs} pnl=${pnl.toFixed(2)}`);
            // Live closePositionsByIndices reanchors lastAddTime to the newest remaining rung.
            lastAddTs = Math.max(...positions.map(p => p.entryTs));
            srPartialLastTs = c.endTs;
          }
        }
      }

      // ── Phase-C overlay hedge: bracket first (kill checked before TP), then trigger ──
      if (params.hedgeOverlay) {
        const cfg = params.hedgeOverlay;
        const ov = ovBox.cur;
        if (ov) {
          const killPrice = ov.entryPrice * (1 + cfg.killPct / 100);
          const tpPrice = ov.entryPrice * (1 - cfg.tpPct / 100);
          if (c.high >= killPrice) closeOverlay(i, killPrice, "kill");
          else if (c.low <= tpPrice) closeOverlay(i, tpPrice, "tp");
        }
        if (!ovBox.cur) {
          const trig = s.extraTriggers?.get(cfg.triggerKey);
          const ladderOk = positions.length >= cfg.minDepth && (cfg.pnlMax === null || pnlPct <= cfg.pnlMax);
          if (trig && trig[i] && ladderOk && c.endTs - ovLastOpenTs >= cfg.cooldownMin * ONE_MIN) {
            const totalNotional = positions.reduce((sum, p) => sum + p.notional, 0);
            ovBox.cur = { qty: (totalNotional * cfg.sizePct) / c.close, entryPrice: c.close, entryTs: c.endTs };
            ovLastOpenTs = c.endTs;
            logAction(i, "ovhedge_open", positions.length, pnlPct, `${cfg.triggerKey}; size=${cfg.sizePct}; tp=${cfg.tpPct}; kill=${cfg.killPct}`);
          }
        }
      }

      // ── pullback flush trigger + action machinery (on the CLOSED candle) ──
      const pbMode = pullbackModeAt(params.pullbackMode, c.endTs);
      const cfg1 = params.pullbackActionCfg;
      if (pbExit.active) {
        pbExit.postExitLow = Math.min(pbExit.postExitLow, c.low);
        const reclaimPrice = pbExit.postExitLow * (1 + PB_RECLAIM_PCT / 100);
        const waited = c.endTs >= pbExit.cooldownUntil;
        const reclaim = c.close >= reclaimPrice;
        const momentumOk =
          (s.ret1h[i] !== null && (s.ret1h[i] as number) >= PB_MOM_RET1H_MIN) ||
          (s.ret2h[i] !== null && (s.ret2h[i] as number) >= PB_MOM_RET2H_MIN);
        if (waited && reclaim && momentumOk) {
          pbExit.active = false;
          closeHedge(i, "pullback reclaim");
        }
      } else {
        const candleTrigger =
          s.pbHasEnough[i] &&
          positions.length >= PB_MIN_DEPTH &&
          pnlPct <= PB_PNL_MAX &&
          s.vwap24h[i] !== null && c.close < (s.vwap24h[i] as number) &&
          s.priorLow12h[i] !== null && c.close <= (s.priorLow12h[i] as number) * (1 + PB_LL_BUFFER_PCT / 100) &&
          s.ret12h[i] !== null && (s.ret12h[i] as number) <= PB_RET12H_MAX;

        if (candleTrigger) {
          pbExit.active = true;
          pbExit.postExitLow = c.low;
          pbExit.cooldownUntil = c.endTs + PB_COOLDOWN_MIN * ONE_MIN;

          if (cfg1) {
            // Phase-1 configurable action path.
            const hlOk = cfg1.hlConfirmMin <= 0 || (s.hlScore[i] ?? -Infinity) >= cfg1.hlConfirmMin;
            if (hlOk && cfgWatch.phase === "idle") {
              logAction(i, "pb_trigger", positions.length, pnlPct, `timing=${cfg1.timing}`);
              if (cfg1.timing === "immediate") {
                const acted = actConfigured(i, pnlPct);
                if (acted === "closed") {
                  if (opts.stopWhenFlat) { endedFlatAtIdx = i; break; }
                  continue;
                }
              } else {
                cfgWatch.phase = "watching";
                cfgWatch.postLow = c.low;
                cfgWatch.triggerLow = c.low;
                cfgWatch.watchUntil = c.endTs + cfg1.watchMin * ONE_MIN;
              }
            }
          } else {
            if (pbMode === "full_exit") {
              recordClose(i, "pullback_exit", c.close);
              cooldownUntil = c.endTs + PB_EXIT_ACTION_COOLDOWN_MIN * ONE_MIN;
              if (opts.stopWhenFlat) {
                endedFlatAtIdx = i;
                break;
              }
              continue;
            }
            if (pbMode === "trim" && (pbAction.phase === "idle") && (s.hlScore[i] ?? -Infinity) >= PBA_CONFIRM_HL) {
              pbAction.phase = "watching";
              pbAction.postTriggerLow = c.low;
              pbAction.watchUntil = c.endTs + PBA_WATCH_MIN * ONE_MIN;
            }
          }
        }
      }

      // Phase-1 watch processing.
      if (cfg1 && cfgWatch.phase === "watching" && positions.length > 0) {
        cfgWatch.postLow = Math.min(cfgWatch.postLow, c.low);
        const reclaimPrice = cfgWatch.postLow * (1 + cfg1.reclaimPct / 100);
        if (c.close >= reclaimPrice) {
          cfgWatch.phase = "idle";
          cfgWatch.postLow = Infinity;
          logAction(i, "pb_watch_cancel", positions.length, pnlPct, `reclaimed ${reclaimPrice.toFixed(4)}`);
        } else if (c.endTs >= cfgWatch.watchUntil) {
          let condOk = true;
          if (cfg1.timing === "failed_reclaim_lowerlow") condOk = cfgWatch.postLow < cfgWatch.triggerLow;
          if (cfg1.timing === "failed_reclaim_belowvwap") condOk = s.vwap24h[i] !== null && c.close < (s.vwap24h[i] as number);
          if (condOk) {
            const acted = actConfigured(i, pnlPct);
            if (acted === "closed") {
              if (opts.stopWhenFlat) { endedFlatAtIdx = i; break; }
              continue;
            }
          } else {
            cfgWatch.phase = "idle";
            cfgWatch.postLow = Infinity;
            logAction(i, "pb_watch_expire_nofire", positions.length, pnlPct, `timing cond failed (${cfg1.timing})`);
          }
        }
      } else if (cfg1 && cfgWatch.phase === "exited") {
        cfgWatch.postLow = Math.min(cfgWatch.postLow, c.low);
        const reclaimPrice = cfgWatch.postLow * (1 + PBA_REENTRY_RECLAIM_PCT / 100);
        if (c.endTs >= cfgWatch.reentryAfter && c.close >= reclaimPrice) {
          cfgWatch.phase = "idle";
          cfgWatch.postLow = Infinity;
        }
      }

      if (pbAction.phase === "watching" && positions.length > 0) {
        pbAction.postTriggerLow = Math.min(pbAction.postTriggerLow, c.low);
        const reclaimPrice = pbAction.postTriggerLow * (1 + PBA_RECLAIM_PCT / 100);
        if (c.close >= reclaimPrice) {
          pbAction.phase = "idle";
          pbAction.postTriggerLow = Infinity;
        } else if (c.endTs >= pbAction.watchUntil) {
          // TRIM: reduce every rung's qty/notional by closePct; rung count unchanged; no cooldown.
          let pnl = 0;
          for (const p of positions) {
            const closeQty = p.qty * PBA_CLOSE_PCT;
            const entryNotional = p.notional * PBA_CLOSE_PCT;
            pnl += (c.close - p.entryPrice) * closeQty - entryNotional * FEE - closeQty * c.close * FEE;
            p.qty -= closeQty;
            p.notional -= entryNotional;
          }
          realized += pnl;
          trimsThisEpisode++;
          trimPnlThisEpisode += pnl;
          trims.push({
            variant: params.id,
            episode,
            ts: c.endTs,
            iso: iso(c.endTs),
            price: c.close,
            closedShare: PBA_CLOSE_PCT,
            pnl: r(pnl, 4),
            depth: positions.length,
          });
          pbAction.phase = "exited";
          pbAction.reentryAfter = c.endTs + PBA_REENTRY_COOLDOWN_MIN * ONE_MIN;
        }
      } else if (pbAction.phase === "exited") {
        pbAction.postTriggerLow = Math.min(pbAction.postTriggerLow, c.low);
        const reclaimPrice = pbAction.postTriggerLow * (1 + PBA_REENTRY_RECLAIM_PCT / 100);
        if (c.endTs >= pbAction.reentryAfter && c.close >= reclaimPrice) {
          pbAction.phase = "idle";
          pbAction.postTriggerLow = Infinity;
        }
      }
    }

    // ── first entry ──
    if (positions.length === 0) {
      // Never carry a rung-specific wait into the next ladder episode.
      lateRungHighDelayActive = false;
      // Phase-3 condition-based re-entry gate (replaces time cooldown after forced exits).
      const rw = reentryBox.cur;
      if (rw && params.reentry) {
        if (c.low < rw.postLow) {
          rw.postLow = c.low;
          rw.lastNewLowTs = c.endTs;
        }
        const m = params.reentry;
        let ok = false;
        if (m.mode === "immediate") ok = true;
        else if (m.mode === "vwap_reclaim") ok = s.vwap24h[i] !== null && c.close >= (s.vwap24h[i] as number);
        else if (m.mode === "no_new_low") ok = (c.endTs - rw.lastNewLowTs) / ONE_HOUR >= (m.noNewLowHours ?? 4);
        else if (m.mode === "hl_normalized") ok = !s.hlSellPressure[i];
        else if (m.mode === "drop_reclaim") {
          const dropped = rw.postLow <= rw.exitPrice * (1 - (m.dropPct ?? 2) / 100);
          const reclaimed = c.close >= rw.postLow * (1 + (m.reclaimPct ?? 1.2) / 100);
          ok = dropped && reclaimed;
        }
        if (!ok) {
          blocked.cooldown++;
          continue;
        }
        logAction(i, "reentry_ok", 0, null, `mode=${m.mode}`);
        reentryBox.cur = null;
      }
      if (c.endTs < cooldownUntil) {
        blocked.cooldown++;
        continue;
      }
      const timeOk = (c.endTs - lastAddTs) / ONE_MIN >= pInterval;
      if (!timeOk) continue;
      if (s.trendBlocked[i]) { blocked.trend++; continue; }
      if (s.riskOffBlocked[i]) { blocked.riskOff++; continue; }
      if (s.regimeFlat[i]) { blocked.regime++; continue; }
      if (OVEREXT?.enabled) {
        const sl = s.slope12h[i];
        const cr = s.crsi4H[i];
        const rs = s.rsi1H[i];
        if (sl !== null && cr !== null && rs !== null &&
          sl >= Number(OVEREXT.slope12hMin) && cr <= Number(OVEREXT.crsi4HMax) && rs >= Number(OVEREXT.rsi1HMin)) {
          blocked.overextended++;
          continue;
        }
      }
      episode++;
      closeFlip(i, c.close, "ladder reopened");
      curBase = pickBase(i);
      const notional = curBase;
      positions.push({ entryTs: c.endTs, entryPrice: c.close, qty: notional / c.close, notional, level: 0 });
      entryIso = iso(c.endTs);
      lastAddTs = c.endTs;
      maxDepthThisEpisode = 1;
      maxDepthSeen = Math.max(maxDepthSeen, 1);
      continue;
    }

    // ── adds ──
    let effectiveMax = params.maxPositions;
    if (params.euphoriaMaxDepth) {
      const high14 = s.high14d[i];
      const nearHigh = high14 !== null && ((high14 - c.close) / high14) * 100 <= params.euphoriaMaxDepth.nearHighPct;
      if (s.aboveEma200[i] && nearHigh) effectiveMax = params.euphoriaMaxDepth.maxPositions;
    }
    if (positions.length >= effectiveMax) continue;
    const last = positions[positions.length - 1];
    const effectiveInterval = positions.length >= THROTTLE_DEPTH && s.ret6h[i] <= THROTTLE_SLOPE
      ? pInterval * THROTTLE_MULT
      : pInterval;
    const timeOk = (c.endTs - lastAddTs) / ONE_MIN >= effectiveInterval;
    const triggerPrice = last.entryPrice * (1 - pTrig / 100);
    const priceDropOk = c.low <= triggerPrice;
    if (!timeOk && !priceDropOk) continue;

    if (positions.length >= DEEP_STRESS_MIN_DEPTH && s.fundingStress[i] && !priceDropOk) {
      // Phase-B support reopen: unblock a stress-blocked time add near confirmed support.
      const ro = params.srExec?.supportReopen;
      let reopened = false;
      if (ro && positions.length + 1 >= ro.minNextDepth) {
        const nearS = srDist(srZonesAt(c.ts), c.close, false, ro.bufferPct) !== null;
        const conf = ro.mode === "reclaim" ? (s.pulseReclaim?.[i] ?? false) : (s.hlSupportBoost?.[i] ?? false);
        if (nearS && conf) {
          reopened = true;
          logAction(i, "sr_support_reopen", positions.length, null, `mode=${ro.mode}`);
        }
      }
      if (!reopened) {
        blocked.deepStress++;
        continue;
      }
    }
    // Orderly-low deep-add pause (Task B): pause deep adds while the low looks
    // orderly (sellers not exhausted); capitulation adds pass unless blockPriceDrop.
    if (params.deepAddPause && positions.length + 1 >= params.deepAddPause.minNextDepth) {
      const dp = params.deepAddPause;
      const trig = s.extraTriggers?.get(dp.triggerKey);
      if (trig?.[i]) addPauseUntil = Math.max(addPauseUntil, c.endTs + dp.pauseMin * ONE_MIN);
      if (c.endTs < addPauseUntil) {
        const reopen = dp.reopenKey ? s.extraTriggers?.get(dp.reopenKey)?.[i] : false;
        if (reopen) {
          addPauseUntil = 0;
        } else if (!priceDropOk || dp.blockPriceDrop) {
          blocked.deepPause = (blocked.deepPause ?? 0) + 1;
          if (c.endTs - addPauseLoggedTs > 30 * ONE_MIN) {
            addPauseLoggedTs = c.endTs;
            logAction(i, "deep_add_pause", positions.length, null, `orderly-low pause until ${iso(addPauseUntil)}`);
          }
          continue;
        }
      }
    }
    // Phase-B resistance skip-add.
    if (params.srExec?.skipAdd) {
      const sk = params.srExec.skipAdd;
      const isTimeOnly = timeOk && !priceDropOk;
      if (
        positions.length + 1 >= sk.minNextDepth &&
        (!sk.timeOnly || isTimeOnly) &&
        pulseOk(sk.pulse, i) &&
        srDist(srZonesAt(c.ts), c.close, true, sk.bufferPct) !== null
      ) {
        blocked.srSkipAdd = (blocked.srSkipAdd ?? 0) + 1;
        continue;
      }
    }
    if (s.trendBlocked[i]) { blocked.trend++; continue; }
    if (s.riskOffBlocked[i]) { blocked.riskOff++; continue; }
    {
      const avg = avgEntryOf(positions)!;
      const pnlPct = ((c.close - avg) / avg) * 100;
      const underwaterH = (c.endTs - Math.min(...positions.map(p => p.entryTs))) / ONE_HOUR;
      if (underwaterH >= LADDER_KILL_HOURS && pnlPct <= LADDER_KILL_PCT) {
        blocked.ladderKill++;
        continue;
      }
    }
    if (s.regimeFlat[i]) { blocked.regime++; continue; }

    // Research-only exact high/pullback hysteresis. This runs after every
    // existing add gate so an "arm" represents an add the current stack would
    // otherwise place. Trigger/release inputs are causal per-minute series.
    const highDelay = params.lateRungHighDelay;
    if (highDelay && positions.length + 1 >= highDelay.minNextDepth) {
      const arm = s.extraTriggers?.get(highDelay.armKey)?.[i] ?? false;
      const release = s.extraTriggers?.get(highDelay.releaseKey)?.[i] ?? false;
      if (!lateRungHighDelayActive && arm) {
        lateRungHighDelayActive = true;
        logAction(i, "late_rung_high_delay_arm", positions.length, null, `arm=${highDelay.armKey}`);
      }
      if (lateRungHighDelayActive) {
        if (release || (!highDelay.blockPriceDrop && priceDropOk)) {
          logAction(i, "late_rung_high_delay_release", positions.length, null,
            release ? `release=${highDelay.releaseKey}` : "price_drop_bypass");
          lateRungHighDelayActive = false;
        } else {
          blocked.lateRungHighDelay = (blocked.lateRungHighDelay ?? 0) + 1;
          continue;
        }
      }
    }

    const level = positions.length;
    const notional = curBase * Math.pow(pScale, level);
    const addPrice = priceDropOk ? Math.min(c.close, triggerPrice) : c.close;
    positions.push({ entryTs: c.endTs, entryPrice: addPrice, qty: notional / addPrice, notional, level });
    maxOpenNotionalSeen = Math.max(maxOpenNotionalSeen, positions.reduce((sum, p) => sum + p.notional, 0));
    lastAddTs = c.endTs;
    maxDepthThisEpisode = Math.max(maxDepthThisEpisode, positions.length);
    maxDepthSeen = Math.max(maxDepthSeen, positions.length);
    } finally {
      if (opts.recordSnapshots) {
        const longNotional = positions.reduce((sum, p) => sum + p.notional, 0);
        const longQty = positions.reduce((sum, p) => sum + p.qty, 0);
        const longOpenPnl = positions.length ? closePnlAll(positions, c.close) : 0;
        const h = hedgeBox.cur;
        const ov = ovBox.cur;
        const f = flipBox.cur;
        const auxiliaryOpenPnl =
          (h ? (h.entryPrice - c.close) * h.qty : 0) +
          (ov ? (ov.entryPrice - c.close) * ov.qty : 0) +
          (f ? (f.entryPrice - c.close) * f.qty + f.accruedFunding : 0);
        const engineOpenPnl = longOpenPnl + auxiliaryOpenPnl;
        snapshots.push({
          candleTs: c.ts,
          ts: c.endTs,
          price: c.close,
          realizedPnl: realized,
          longOpenPnl,
          engineOpenPnl,
          equity: INITIAL_EQUITY + realized + engineOpenPnl,
          longNotional,
          longQty,
          longAvgEntry: avgEntryOf(positions),
          depth: positions.length,
        });
      }
    }
  }

  const lastCandle = candles[Math.min(endIdx, candles.length) - 1];
  const openPnl = positions.length && lastCandle ? closePnlAll(positions, lastCandle.close) : 0;

  return {
    closes,
    trims,
    actions,
    realized,
    openPnl,
    openDepth: positions.length,
    maxDepthSeen,
    worstClose: Number.isFinite(worstClose) ? worstClose : 0,
    bestClose: Number.isFinite(bestClose) ? bestClose : 0,
    maxDrawdownPct,
    minEquity,
    blocked,
    endedFlatAtIdx,
    flips: flipCount,
    flipPnl: flipPnlTotal,
    flipFunding: flipFundingTotal,
    maxOpenNotional: maxOpenNotionalSeen,
    snapshots,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

export function assertContextCoverage(s: Pick<Series, "candles" | "rsi1H" | "crsi4H" | "slope12h">, start: number, end: number): void {
  for (let i = start; i < end; i++) {
    if (![s.rsi1H[i], s.crsi4H[i], s.slope12h[i]].every(x => typeof x === "number" && Number.isFinite(x))) {
      throw new Error(`Replay context unavailable at ${iso(s.candles[i].endTs)}; load sufficient historical warm-up instead of silently bypassing filters`);
    }
  }
}

export async function buildSeries(options: { candleRepairFile?: string } = {}): Promise<Series> {
  console.error("[load] HYPE 1m candles...");
  const candles = await loadCandles1m("HYPEUSDT", DATA, END_TS, options.candleRepairFile);
  console.error(`[load] ${candles.length} HYPE 1m candles ${iso(candles[0].ts)} -> ${iso(candles[candles.length - 1].endTs)}`);

  console.error("[load] BTC 1m candles...");
  const btc = await loadCandles1m("BTCUSDT");

  console.error("[build] trend / returns / funding series...");
  const trend = buildTrendSeries(candles);
  const ret6h = buildReturnSeries(candles, 6 * ONE_HOUR);

  const fdBy = (await loadFundingRows("HYPEUSDT_funding.json")).concat(await loadFundingRows("HYPEUSDT_funding_live.jsonl")).sort((a, b) => a.ts - b.ts);
  const fdBn = await loadFundingRows("HYPEUSDT_funding_live_binance.jsonl");
  const fdHl = await loadFundingRows("HYPEUSDT_funding_live_hyperliquid.jsonl");
  const bySeries = seriesLastBefore(candles, fdBy);
  const bnSeries = seriesLastBefore(candles, fdBn);
  const hlSeries = seriesLastBefore(candles, fdHl);
  const fundingStress = candles.map((_, i) =>
    [bySeries[i], bnSeries[i], hlSeries[i]].some(rate => rate !== null && rate < 0));

  console.error("[build] context indicators (rsi1H/crsi4H/slope12h)...");
  const ctx = buildContextIndicators(candles);

  console.error("[build] risk-off / regime series...");
  const riskOffBlocked = buildRiskOffSeries(candles, btc);
  const regimeFlat = buildRegimeSeries(candles);

  console.error("[build] pullback price features...");
  const pbf = buildPullbackFeatures(candles);

  console.error("[build] HL pulse score...");
  const hl = await buildHlScoreSeries(candles);

  return {
    causalityVersion: REPLAY_CAUSALITY_VERSION,
    candles,
    trendBlocked: trend.blocked,
    aboveEma200: trend.above,
    ret6h,
    bybitFunding: bySeries,
    fundingStress,
    rsi1H: ctx.rsi1H,
    crsi4H: ctx.crsi4H,
    slope12h: ctx.slope12h,
    riskOffBlocked,
    regimeFlat,
    vwap24h: pbf.vwap24h,
    priorLow12h: pbf.priorLow12h,
    ret12h: pbf.ret12h,
    ret1h: pbf.ret1h,
    ret2h: pbf.ret2h,
    pbHasEnough: pbf.hasEnough,
    hlScore: hl.score,
    hlSellPressure: hl.sellPressure,
    high14d: buildHigh14d(candles),
  };
}

export function weekKey(ts: number): string {
  // UTC Monday of the week
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7;
  const monday = ts - day * DAY_MS - (ts % DAY_MS);
  return iso(monday).slice(0, 10);
}

async function main(): Promise<void> {
  ensureDir(OUT_DIR);
  const series = await buildSeries();
  const candles = series.candles;
  const startIdx = lowerBound(candles, START_TS, c => c.endTs);
  const windowEndIso = iso(candles[candles.length - 1].endTs);

  const parityRows: Record<string, any>[] = [];
  let paritySummary: Record<string, any> = {};

  if (MODE === "all" || MODE === "parity") {
    console.error("[parity] episode-synced replay vs live trades...");
    const episodes = loadLiveEpisodes().filter(e => e.firstOpenTs >= START_TS && e.closeTs <= (Number.isFinite(END_TS) ? END_TS : Infinity));
    const liveParams: EngineParams = {
      id: "live_segmented_16h_-3_cdlive4h",
      maxPositions: 11,
      hardFlattenHours: 16,
      hardFlattenPct: -3,
      cooldownMode: "live4h",
      pullbackMode: "liveSegmented",
    };
    for (const ep of episodes) {
      const epStartIdx = lowerBound(candles, ep.firstOpenTs, c => c.endTs);
      if (epStartIdx >= candles.length) continue;
      const result = runEngine(liveParams, series, {
        startIdx: epStartIdx,
        seed: { ts: ep.firstOpenTs, price: ep.opens[0].price, notional: ep.opens[0].notional },
        stopWhenFlat: true,
      });
      const simClose = result.closes[0] ?? null;
      parityRows.push({
        episode: ep.index,
        liveOpenIso: iso(ep.firstOpenTs),
        liveCloseIso: iso(ep.closeTs),
        liveRungs: ep.rungs,
        livePnl: r(ep.closePnl, 2),
        liveReason: ep.liveReason,
        simCloseIso: simClose ? simClose.closeIso : "OPEN_AT_DATA_END",
        simRungs: simClose ? simClose.rungs : result.openDepth,
        simMaxDepth: simClose ? simClose.maxDepth : result.maxDepthSeen,
        simPnl: simClose ? r(simClose.pnl + simClose.trimPnlInEpisode, 2) : r(result.openPnl, 2),
        simReason: simClose ? simClose.reason : "open",
        simTrims: simClose ? simClose.trimsInEpisode : result.trims.length,
        closeDeltaMin: simClose ? r((simClose.closeTs - ep.closeTs) / ONE_MIN, 1) : "",
        pnlDelta: simClose ? r(simClose.pnl + simClose.trimPnlInEpisode - ep.closePnl, 2) : "",
        rungsMatch: simClose ? (simClose.rungs === ep.rungs ? 1 : 0) : 0,
      });
    }
    const closed = parityRows.filter(row => row.simReason !== "open");
    const absDeltas = closed.map(row => Math.abs(Number(row.closeDeltaMin))).sort((a, b) => a - b);
    const pnlDeltas = closed.map(row => Number(row.pnlDelta));
    paritySummary = {
      episodes: parityRows.length,
      closedInSim: closed.length,
      rungsMatched: closed.filter(row => row.rungsMatch === 1).length,
      medianAbsCloseDeltaMin: absDeltas.length ? r(absDeltas[Math.floor(absDeltas.length / 2)], 1) : "",
      meanPnlDelta: pnlDeltas.length ? r(pnlDeltas.reduce((a, b) => a + b, 0) / pnlDeltas.length, 2) : "",
      sumLivePnl: r(parityRows.reduce((a, row) => a + Number(row.livePnl), 0), 2),
      sumSimPnl: r(closed.reduce((a, row) => a + Number(row.simPnl), 0), 2),
    };
    writeCsv(path.join(OUT_DIR, "fable5-freerun-parity.csv"), parityRows);
    console.error(`[parity] ${JSON.stringify(paritySummary)}`);
  }

  const summaries: Record<string, any>[] = [];
  const allCloses: CloseEvent[] = [];
  const allTrims: TrimEvent[] = [];
  const weeklyRows: Record<string, any>[] = [];

  if (MODE === "all" || MODE === "sweep") {
    console.error("[sweep] free-running variants...");
    const variants: EngineParams[] = [];
    // Live-segmented baseline: what the live config sequence would free-run to.
    variants.push({ id: "baseline_liveSegmented_hf16_-3_cdlive4h", maxPositions: 11, hardFlattenHours: 16, hardFlattenPct: -3, cooldownMode: "live4h", pullbackMode: "liveSegmented" });
    // No-pullback references.
    for (const [h, p] of [[16, -3], [12, -2]] as Array<[number, number]>) {
      variants.push({ id: `hf${h}h_${p}pct_cdlive4h_pbnone`, maxPositions: 11, hardFlattenHours: h, hardFlattenPct: p, cooldownMode: "live4h", pullbackMode: "none" });
    }
    // Grid: hard flatten x cooldown, with current live trim action on.
    for (const [h, p] of [[16, -3], [12, -2], [12, -3]] as Array<[number, number]>) {
      for (const cd of ["live4h", "8h", "12h", "16h"] as EngineParams["cooldownMode"][]) {
        variants.push({ id: `hf${h}h_${p}pct_cd${cd}_pbtrim`, maxPositions: 11, hardFlattenHours: h, hardFlattenPct: p, cooldownMode: cd, pullbackMode: "trim" });
      }
    }
    // Diagnostic: hard flatten without the trend-hostile requirement (euphoria-crash hole).
    for (const [h, p] of [[16, -3], [12, -2], [12, -3], [12, -4], [12, -5]] as Array<[number, number]>) {
      variants.push({ id: `hf${h}h_${p}pct_cdlive4h_pbnone_noTrendReq`, maxPositions: 11, hardFlattenHours: h, hardFlattenPct: p, cooldownMode: "live4h", pullbackMode: "none", hardFlattenIgnoreTrend: true });
      variants.push({ id: `hf${h}h_${p}pct_cdlive4h_pbtrim_noTrendReq`, maxPositions: 11, hardFlattenHours: h, hardFlattenPct: p, cooldownMode: "live4h", pullbackMode: "trim", hardFlattenIgnoreTrend: true });
    }

    for (const variant of variants) {
      const result = runEngine(variant, series, { startIdx });
      allCloses.push(...result.closes);
      allTrims.push(...result.trims);
      const trimPnl = result.trims.reduce((a, t) => a + t.pnl, 0);
      summaries.push({
        variant: variant.id,
        hardFlattenHours: variant.hardFlattenHours,
        hardFlattenPct: variant.hardFlattenPct,
        cooldownMode: variant.cooldownMode,
        pullbackMode: variant.pullbackMode,
        realizedPnl: r(result.realized, 2),
        openPnl: r(result.openPnl, 2),
        totalPnl: r(result.realized + result.openPnl, 2),
        closes: result.closes.length,
        tp: result.closes.filter(x => x.reason === "tp").length,
        staleTp: result.closes.filter(x => x.reason === "stale_tp").length,
        hardFlatten: result.closes.filter(x => x.reason === "hard_flatten").length,
        emergencyKill: result.closes.filter(x => x.reason === "emergency_kill").length,
        fundingSpike: result.closes.filter(x => x.reason === "funding_spike").length,
        pullbackExit: result.closes.filter(x => x.reason === "pullback_exit").length,
        trims: result.trims.length,
        trimPnl: r(trimPnl, 2),
        openDepth: result.openDepth,
        maxDepthSeen: result.maxDepthSeen,
        worstClose: r(result.worstClose, 2),
        bestClose: r(result.bestClose, 2),
        maxDrawdownPct: r(result.maxDrawdownPct, 2),
        minEquity: r(result.minEquity, 2),
        blockedTrend: result.blocked.trend,
        blockedRiskOff: result.blocked.riskOff,
        blockedRegime: result.blocked.regime,
        blockedLadderKill: result.blocked.ladderKill,
        blockedDeepStress: result.blocked.deepStress,
        blockedOverextended: result.blocked.overextended,
      });

      const byWeek = new Map<string, { pnl: number; closes: number; worst: number }>();
      for (const cl of result.closes) {
        const wk = weekKey(cl.closeTs);
        const agg = byWeek.get(wk) ?? { pnl: 0, closes: 0, worst: Infinity };
        agg.pnl += cl.pnl + cl.trimPnlInEpisode;
        agg.closes++;
        agg.worst = Math.min(agg.worst, cl.pnl);
        byWeek.set(wk, agg);
      }
      for (const [wk, agg] of Array.from(byWeek.entries()).sort()) {
        weeklyRows.push({
          variant: variant.id,
          weekStart: wk,
          realizedPnl: r(agg.pnl, 2),
          closes: agg.closes,
          worstClose: r(agg.worst === Infinity ? 0 : agg.worst, 2),
        });
      }
    }

    summaries.sort((a, b) => Number(b.totalPnl) - Number(a.totalPnl));
    writeCsv(path.join(OUT_DIR, "fable5-freerun-summary.csv"), summaries);
    writeCsv(path.join(OUT_DIR, "fable5-freerun-closes.csv"), allCloses as unknown as Record<string, any>[]);
    writeCsv(path.join(OUT_DIR, "fable5-freerun-trims.csv"), allTrims as unknown as Record<string, any>[]);
    writeCsv(path.join(OUT_DIR, "fable5-freerun-weekly.csv"), weeklyRows);
  }

  console.log(JSON.stringify({
    window: { start: iso(START_TS), end: windowEndIso },
    parity: paritySummary,
    sweepTop: summaries.slice(0, 8),
    outputs: {
      parity: path.join(OUT_DIR, "fable5-freerun-parity.csv"),
      summary: path.join(OUT_DIR, "fable5-freerun-summary.csv"),
      closes: path.join(OUT_DIR, "fable5-freerun-closes.csv"),
      weekly: path.join(OUT_DIR, "fable5-freerun-weekly.csv"),
      trims: path.join(OUT_DIR, "fable5-freerun-trims.csv"),
    },
  }, null, 2));
}

if (require.main === module) {
  console.error("Archived sweep CLI disabled. Use scripts/hype-replay-current-stack-validation.ts for the current causal baseline; legacy callers must opt into legacy_ohlc explicitly.");
  process.exitCode = 1;
}
