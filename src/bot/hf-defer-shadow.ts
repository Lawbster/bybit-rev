import fs from "fs";
import path from "path";
import { BotConfig } from "./bot-config";
import { Candle } from "../fetch-candles";
import { LadderPosition } from "./state";
import { ExitDecision } from "./strategy";

type HfDeferState = {
  phase: "idle" | "pending";
  ladderId: string;
  triggerTs: number;
  dueTs: number;
  triggerPrice: number;
  avgEntry: number;
  totalQty: number;
  totalNotional: number;
  depth: number;
  pnlPct: number;
  oldestHours: number;
  ret12hPct: number;
  hardReason: string;
  estimatedNetPnlAtTrigger: number;
};

type HfDeferEvent = "would_defer" | "defer_outcome" | "reset";

export type HfDeferShadowDecision = {
  ts: string;
  timestamp: number;
  source: string;
  symbol: string;
  event: HfDeferEvent;
  fired: boolean;
  firedCandidates: string[];
  price: number;
  ladder: {
    id: string;
    depth: number;
    avgEntry: number | null;
    pnlPct: number | null;
    totalNotional: number;
    oldestAgeHours: number | null;
  };
  trigger: {
    hardReason: string | null;
    ret12hPct: number | null;
    delayMin: number;
    triggerPrice: number | null;
    triggerIso: string | null;
    dueIso: string | null;
  };
  outcome: {
    duePrice: number | null;
    priceDeltaPct: number | null;
    estimatedNetPnlAtTrigger: number | null;
    estimatedNetPnlAtDue: number | null;
    estimatedDelta: number | null;
    betterThanImmediate: boolean | null;
  };
  state: HfDeferState;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const FIVE_MIN = 5 * 60_000;
const TWELVE_HOURS = 12 * 3600_000;
const stateCache = new Map<string, HfDeferState>();

function cleanState(): HfDeferState {
  return {
    phase: "idle",
    ladderId: "",
    triggerTs: 0,
    dueTs: 0,
    triggerPrice: 0,
    avgEntry: 0,
    totalQty: 0,
    totalNotional: 0,
    depth: 0,
    pnlPct: 0,
    oldestHours: 0,
    ret12hPct: 0,
    hardReason: "",
    estimatedNetPnlAtTrigger: 0,
  };
}

function statePath(symbol: string): string {
  return path.join(DATA_DIR, `${symbol}_hf_defer_shadow_state.json`);
}

function loadState(symbol: string): HfDeferState {
  const cached = stateCache.get(symbol);
  if (cached) return cached;
  const file = statePath(symbol);
  if (fs.existsSync(file)) {
    try {
      const parsed = { ...cleanState(), ...JSON.parse(fs.readFileSync(file, "utf8")) } as HfDeferState;
      stateCache.set(symbol, parsed);
      return parsed;
    } catch {
      // Ignore torn local copies and start clean.
    }
  }
  const state = cleanState();
  stateCache.set(symbol, state);
  return state;
}

function saveState(symbol: string, state: HfDeferState): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  stateCache.set(symbol, state);
  fs.writeFileSync(statePath(symbol), JSON.stringify(state, null, 2));
}

function iso(ts: number | null): string | null {
  return typeof ts === "number" && Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : null;
}

function ladderId(positions: LadderPosition[]): string {
  if (!positions.length) return "";
  return `ladder_${Math.min(...positions.map(pos => pos.entryTime))}`;
}

function ladderStats(positions: LadderPosition[], price: number, nowMs: number) {
  const totalQty = positions.reduce((sum, p) => sum + p.qty, 0);
  const totalNotional = positions.reduce((sum, p) => sum + p.notional, 0);
  const avgEntry = totalQty > 0
    ? positions.reduce((sum, p) => sum + p.entryPrice * p.qty, 0) / totalQty
    : null;
  const oldest = positions.length ? Math.min(...positions.map(p => p.entryTime)) : null;
  return {
    id: ladderId(positions),
    depth: positions.length,
    avgEntry,
    pnlPct: avgEntry !== null ? (price / avgEntry - 1) * 100 : null,
    totalQty,
    totalNotional,
    oldestAgeHours: oldest !== null ? (nowMs - oldest) / 3600000 : null,
  };
}

function netPnlFromAvg(avgEntry: number, totalQty: number, totalNotional: number, exitPrice: number, feeRate: number): number {
  const exitNotional = totalQty * exitPrice;
  return (exitPrice - avgEntry) * totalQty - totalNotional * feeRate - exitNotional * feeRate;
}

function completedCandles(candles5m: Candle[], nowMs: number): Candle[] {
  return candles5m
    .filter(c => c.timestamp + FIVE_MIN <= nowMs)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function ret12hPct(candles5m: Candle[], price: number, nowMs: number): number | null {
  const bars = completedCandles(candles5m, nowMs);
  if (!bars.length) return null;
  const anchorTs = nowMs - TWELVE_HOURS;
  let anchor: Candle | null = null;
  for (const candle of bars) {
    if (candle.timestamp <= anchorTs) anchor = candle;
    else break;
  }
  if (!anchor || anchor.close <= 0) return null;
  return (price / anchor.close - 1) * 100;
}

function buildDecision(args: {
  symbol: string;
  nowMs: number;
  price: number;
  event: HfDeferEvent;
  firedCandidates: string[];
  state: HfDeferState;
  cfg: NonNullable<BotConfig["hfDeferShadow"]>;
  duePrice?: number | null;
  estimatedNetPnlAtDue?: number | null;
}): HfDeferShadowDecision {
  const state = args.state;
  const estimatedDelta =
    typeof args.estimatedNetPnlAtDue === "number"
      ? args.estimatedNetPnlAtDue - state.estimatedNetPnlAtTrigger
      : null;
  return {
    ts: new Date(args.nowMs).toISOString(),
    timestamp: args.nowMs,
    source: "hedgeguy-bot",
    symbol: args.symbol,
    event: args.event,
    fired: args.firedCandidates.length > 0,
    firedCandidates: args.firedCandidates,
    price: args.price,
    ladder: {
      id: state.ladderId,
      depth: state.depth,
      avgEntry: state.avgEntry || null,
      pnlPct: state.pnlPct,
      totalNotional: state.totalNotional,
      oldestAgeHours: state.oldestHours,
    },
    trigger: {
      hardReason: state.hardReason || null,
      ret12hPct: Number.isFinite(state.ret12hPct) ? state.ret12hPct : null,
      delayMin: args.cfg.delayMin,
      triggerPrice: state.triggerPrice || null,
      triggerIso: iso(state.triggerTs),
      dueIso: iso(state.dueTs),
    },
    outcome: {
      duePrice: args.duePrice ?? null,
      priceDeltaPct: args.duePrice && state.triggerPrice > 0 ? (args.duePrice / state.triggerPrice - 1) * 100 : null,
      estimatedNetPnlAtTrigger: state.estimatedNetPnlAtTrigger,
      estimatedNetPnlAtDue: args.estimatedNetPnlAtDue ?? null,
      estimatedDelta,
      betterThanImmediate: estimatedDelta !== null ? estimatedDelta > 0 : null,
    },
    state,
  };
}

export function evaluateHfDeferShadow(args: {
  symbol: string;
  nowMs: number;
  price: number;
  positions: LadderPosition[];
  candles5m: Candle[];
  config: BotConfig;
  hardFlat: ExitDecision;
}): HfDeferShadowDecision | null {
  const cfg = args.config.hfDeferShadow;
  if (!cfg?.enabled || args.hardFlat.action !== "flatten" || args.positions.length === 0) return null;

  const previous = loadState(args.symbol);
  const id = ladderId(args.positions);
  if (previous.phase === "pending" && previous.ladderId === id) return null;

  const stats = ladderStats(args.positions, args.price, args.nowMs);
  const r12 = ret12hPct(args.candles5m, args.price, args.nowMs);
  if (
    stats.depth < cfg.minDepth ||
    stats.avgEntry === null ||
    stats.oldestAgeHours === null ||
    r12 === null ||
    r12 <= cfg.ret12hMin
  ) {
    return null;
  }

  const next: HfDeferState = {
    phase: "pending",
    ladderId: id,
    triggerTs: args.nowMs,
    dueTs: args.nowMs + cfg.delayMin * 60_000,
    triggerPrice: args.price,
    avgEntry: stats.avgEntry,
    totalQty: stats.totalQty,
    totalNotional: stats.totalNotional,
    depth: stats.depth,
    pnlPct: stats.pnlPct ?? 0,
    oldestHours: stats.oldestAgeHours,
    ret12hPct: r12,
    hardReason: args.hardFlat.reason,
    estimatedNetPnlAtTrigger: netPnlFromAvg(stats.avgEntry, stats.totalQty, stats.totalNotional, args.price, args.config.feeRate),
  };
  saveState(args.symbol, next);

  return buildDecision({
    symbol: args.symbol,
    nowMs: args.nowMs,
    price: args.price,
    event: "would_defer",
    firedCandidates: ["hf_defer30_slow_chop_shadow"],
    state: next,
    cfg,
  });
}

export function resolveHfDeferShadow(args: {
  symbol: string;
  nowMs: number;
  price: number;
  config: BotConfig;
}): HfDeferShadowDecision | null {
  const cfg = args.config.hfDeferShadow;
  if (!cfg?.enabled) return null;

  const previous = loadState(args.symbol);
  if (previous.phase !== "pending") return null;
  if (args.nowMs < previous.dueTs) return null;

  const duePnl = netPnlFromAvg(previous.avgEntry, previous.totalQty, previous.totalNotional, args.price, args.config.feeRate);
  const decision = buildDecision({
    symbol: args.symbol,
    nowMs: args.nowMs,
    price: args.price,
    event: "defer_outcome",
    firedCandidates: ["hf_defer30_outcome_shadow"],
    state: previous,
    cfg,
    duePrice: args.price,
    estimatedNetPnlAtDue: duePnl,
  });

  saveState(args.symbol, cleanState());
  return decision;
}

export function writeHfDeferShadowSignal(symbol: string, decision: HfDeferShadowDecision): void {
  const outPath = path.join(DATA_DIR, `${symbol}_hf_defer_shadow.jsonl`);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(outPath, JSON.stringify(decision) + "\n");
}
