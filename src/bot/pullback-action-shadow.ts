import fs from "fs";
import path from "path";
import { BotConfig } from "./bot-config";
import { LadderPosition, ScorePartialFlattenState } from "./state";
import { PullbackExitShadowDecision } from "./pullback-exit-shadow";
import { computeOnChainFeatures, OnChainFeatures } from "./shadow-logger";

type Candle1m = {
  ts: number;
  endTs: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type Phase = "idle" | "armed" | "watching" | "exited";

type ActionState = {
  phase: Phase;
  ladderId: string;
  armedAt: number;
  armedPrice: number | null;
  armedDepth: number;
  armedPnlPct: number | null;
  armSources: string[];
  armReason: string;
  triggerTs: number;
  triggerPrice: number | null;
  postTriggerLow: number | null;
  watchUntil: number;
  failedAt: number;
  failedPrice: number | null;
  reentryAfter: number;
  actionClosePct: number;
};

type Candidate = {
  name: string;
  fired: boolean;
  reason: string;
};

export type PullbackActionShadowDecision = {
  ts: string;
  timestamp: number;
  source: string;
  symbol: string;
  event: "armed" | "watch_started" | "reclaim_cleared" | "would_act" | "would_reenter" | "reset";
  fired: boolean;
  firedCandidates: string[];
  candidates: Candidate[];
  price: number;
  ladder: {
    id: string;
    depth: number;
    avgEntry: number | null;
    pnlPct: number | null;
    totalNotional: number;
    oldestAgeHours: number | null;
  };
  candle: {
    ts: number | null;
    endTs: number | null;
    iso: string | null;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    ageSec: number | null;
  };
  state: ActionState;
  pullback?: {
    event: string;
    firedCandidates: string[];
    candleClose: number;
    ladderPnlPct: number | null;
    ret12hPct: number | null;
    hlScore: number | null;
  } | null;
  hl: {
    score: number | null;
    fundingNegative: boolean | null;
    sellPressure: boolean | null;
    takerFade: boolean | null;
    oiUnwind: boolean | null;
    askWall: boolean | null;
    hlTaker15m: number | null;
    hlTaker1h: number | null;
    hlAssetOi1hPct: number | null;
    hlAssetOi4hPct: number | null;
    hlFundingNow: number | null;
    hlObImbalance05: number | null;
    hlObAskBid05Ratio: number | null;
  };
  action: {
    wouldExit: boolean;
    wouldTrim: boolean;
    closePct: number;
    estimatedCloseQty: number;
    estimatedRealizedPnl: number | null;
    reclaimPrice: number | null;
    watchUntilIso: string | null;
    reentryAfterIso: string | null;
  };
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const ONE_MIN = 60_000;
const TAIL_BYTES = 512 * 1024;
const stateCache = new Map<string, ActionState>();

function cleanState(): ActionState {
  return {
    phase: "idle",
    ladderId: "",
    armedAt: 0,
    armedPrice: null,
    armedDepth: 0,
    armedPnlPct: null,
    armSources: [],
    armReason: "",
    triggerTs: 0,
    triggerPrice: null,
    postTriggerLow: null,
    watchUntil: 0,
    failedAt: 0,
    failedPrice: null,
    reentryAfter: 0,
    actionClosePct: 0,
  };
}

function num(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function iso(ts: number | null): string | null {
  return typeof ts === "number" && Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : null;
}

function parseTs(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Date.parse(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readTailLines(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  const stat = fs.statSync(file);
  const start = Math.max(0, stat.size - TAIL_BYTES);
  const length = stat.size - start;
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(file, "r");
  try {
    fs.readSync(fd, buffer, 0, length, start);
  } finally {
    fs.closeSync(fd);
  }
  const lines = buffer.toString("utf8").split(/\r?\n/).filter(Boolean);
  if (start > 0) lines.shift();
  return lines;
}

function latestClosedCandle(symbol: string, nowMs: number, staleSec: number): Candle1m | null {
  const file = path.join(DATA_DIR, `${symbol}_1m.jsonl`);
  let latest: Candle1m | null = null;
  for (const line of readTailLines(file)) {
    try {
      const row = JSON.parse(line);
      const ts = parseTs(row.timestamp ?? row.ts ?? row.iso);
      const open = num(row.open ?? row.o);
      const high = num(row.high ?? row.h);
      const low = num(row.low ?? row.l);
      const close = num(row.close ?? row.c);
      if (ts === null || open === null || high === null || low === null || close === null) continue;
      const candle = { ts, endTs: ts + ONE_MIN, open, high, low, close };
      if (candle.endTs <= nowMs && (!latest || candle.endTs > latest.endTs)) latest = candle;
    } catch {
      // Ignore partial copy tails.
    }
  }
  if (!latest) return null;
  return (nowMs - latest.endTs) / 1000 <= staleSec ? latest : null;
}

function statePath(symbol: string): string {
  return path.join(DATA_DIR, `${symbol}_pullback_action_shadow_state.json`);
}

function loadState(symbol: string): ActionState {
  const cached = stateCache.get(symbol);
  if (cached) return cached;
  const file = statePath(symbol);
  if (fs.existsSync(file)) {
    try {
      const parsed = { ...cleanState(), ...JSON.parse(fs.readFileSync(file, "utf8")) } as ActionState;
      stateCache.set(symbol, parsed);
      return parsed;
    } catch {
      // Use a clean state if the file is corrupted by a partial copy.
    }
  }
  const state = cleanState();
  stateCache.set(symbol, state);
  return state;
}

function saveState(symbol: string, state: ActionState): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  stateCache.set(symbol, state);
  fs.writeFileSync(statePath(symbol), JSON.stringify(state, null, 2));
}

function ladderId(positions: LadderPosition[]): string {
  if (!positions.length) return "";
  return `ladder_${Math.min(...positions.map(pos => pos.entryTime))}`;
}

function avgEntry(positions: LadderPosition[]): number | null {
  const qty = positions.reduce((sum, p) => sum + p.qty, 0);
  if (qty <= 0) return null;
  return positions.reduce((sum, p) => sum + p.entryPrice * p.qty, 0) / qty;
}

function ladderStats(positions: LadderPosition[], price: number, nowMs: number) {
  const avg = avgEntry(positions);
  const oldest = positions.length ? Math.min(...positions.map(p => p.entryTime)) : null;
  return {
    id: ladderId(positions),
    depth: positions.length,
    avgEntry: avg,
    pnlPct: avg !== null ? (price / avg - 1) * 100 : null,
    totalNotional: positions.reduce((sum, p) => sum + p.notional, 0),
    oldestAgeHours: oldest !== null ? (nowMs - oldest) / 3600000 : null,
  };
}

function closeShareEstimate(positions: LadderPosition[], price: number, closePct: number, feeRate: number): { qty: number; pnl: number | null } {
  const share = Math.max(0, Math.min(0.95, closePct));
  let qty = 0;
  let pnl = 0;
  for (const pos of positions) {
    const closeQty = pos.qty * share;
    const entryNotional = pos.notional * share;
    const exitNotional = closeQty * price;
    qty += closeQty;
    pnl += (price - pos.entryPrice) * closeQty - entryNotional * feeRate - exitNotional * feeRate;
  }
  return { qty, pnl: Number.isFinite(pnl) ? pnl : null };
}

function mergeSources(...sources: string[][]): string[] {
  return Array.from(new Set(sources.flat().filter(Boolean)));
}

function hlComponents(pulse: OnChainFeatures | null) {
  if (!pulse) {
    return {
      score: null,
      fundingNegative: null,
      sellPressure: null,
      takerFade: null,
      oiUnwind: null,
      askWall: null,
      hlFundingNow: null,
    };
  }

  const hlFundingNow = pulse.hlAssetFundingNow ?? pulse.fdHlNow;
  const fundingNegative = hlFundingNow !== null && hlFundingNow < 0;
  const takerFade =
    pulse.hlTaker15m !== null &&
    pulse.hlTaker1h !== null &&
    pulse.hlTaker15m < pulse.hlTaker1h * 0.75;
  const sellPressure =
    (pulse.hlTaker15m !== null && pulse.hlTaker15m <= 0.85) ||
    (pulse.hlTaker1h !== null && pulse.hlTaker1h <= 0.90) ||
    takerFade;
  const oiUnwind =
    (pulse.hlAssetOi1hPct !== null && pulse.hlAssetOi1hPct <= -0.50) ||
    (pulse.hlAssetOi4hPct !== null && pulse.hlAssetOi4hPct <= -1.00);
  const askWall =
    (pulse.hlObImbalance05 !== null && pulse.hlObImbalance05 <= -0.20) ||
    (pulse.hlObAskBid05Ratio !== null && pulse.hlObAskBid05Ratio >= 1.35);
  const score = [fundingNegative, sellPressure, oiUnwind, askWall].filter(Boolean).length;

  return { score, fundingNegative, sellPressure, takerFade, oiUnwind, askWall, hlFundingNow };
}

function buildDecision(args: {
  symbol: string;
  nowMs: number;
  event: PullbackActionShadowDecision["event"];
  firedCandidates: string[];
  candidates: Candidate[];
  price: number;
  positions: LadderPosition[];
  candle: Candle1m | null;
  state: ActionState;
  pullback: PullbackExitShadowDecision | null;
  pulse: OnChainFeatures | null;
  hl: ReturnType<typeof hlComponents>;
  config: BotConfig;
}): PullbackActionShadowDecision {
  const stats = ladderStats(args.positions, args.candle?.close ?? args.price, args.nowMs);
  const actionPrice = args.candle?.close ?? args.price;
  const close = closeShareEstimate(args.positions, actionPrice, args.state.actionClosePct || args.config.pullbackActionShadow?.actionClosePct || 0.5, args.config.feeRate);
  const reclaimPrice = args.state.postTriggerLow !== null
    ? args.state.postTriggerLow * (1 + (args.config.pullbackActionShadow?.reclaimPct ?? 1.2) / 100)
    : null;
  return {
    ts: new Date(args.nowMs).toISOString(),
    timestamp: args.nowMs,
    source: "hedgeguy-bot",
    symbol: args.symbol,
    event: args.event,
    fired: args.firedCandidates.length > 0,
    firedCandidates: args.firedCandidates,
    candidates: args.candidates,
    price: args.price,
    ladder: stats,
    candle: {
      ts: args.candle?.ts ?? null,
      endTs: args.candle?.endTs ?? null,
      iso: iso(args.candle?.endTs ?? null),
      open: args.candle?.open ?? null,
      high: args.candle?.high ?? null,
      low: args.candle?.low ?? null,
      close: args.candle?.close ?? null,
      ageSec: args.candle ? (args.nowMs - args.candle.endTs) / 1000 : null,
    },
    state: args.state,
    pullback: args.pullback ? {
      event: args.pullback.event,
      firedCandidates: args.pullback.firedCandidates,
      candleClose: args.pullback.candle.close,
      ladderPnlPct: args.pullback.ladder.pnlPctAtClosedCandle,
      ret12hPct: args.pullback.features.ret12hPct,
      hlScore: args.pullback.hl.score,
    } : null,
    hl: {
      score: args.hl.score,
      fundingNegative: args.hl.fundingNegative,
      sellPressure: args.hl.sellPressure,
      takerFade: args.hl.takerFade,
      oiUnwind: args.hl.oiUnwind,
      askWall: args.hl.askWall,
      hlTaker15m: args.pulse?.hlTaker15m ?? null,
      hlTaker1h: args.pulse?.hlTaker1h ?? null,
      hlAssetOi1hPct: args.pulse?.hlAssetOi1hPct ?? null,
      hlAssetOi4hPct: args.pulse?.hlAssetOi4hPct ?? null,
      hlFundingNow: args.hl.hlFundingNow,
      hlObImbalance05: args.pulse?.hlObImbalance05 ?? null,
      hlObAskBid05Ratio: args.pulse?.hlObAskBid05Ratio ?? null,
    },
    action: {
      wouldExit: args.event === "would_act",
      wouldTrim: args.event === "would_act",
      closePct: args.state.actionClosePct || args.config.pullbackActionShadow?.actionClosePct || 0.5,
      estimatedCloseQty: close.qty,
      estimatedRealizedPnl: close.pnl,
      reclaimPrice,
      watchUntilIso: iso(args.state.watchUntil),
      reentryAfterIso: iso(args.state.reentryAfter),
    },
  };
}

export async function evaluatePullbackActionShadow(args: {
  symbol: string;
  nowMs: number;
  price: number;
  positions: LadderPosition[];
  config: BotConfig;
  scoreLatch: ScorePartialFlattenState | null;
  pullback: PullbackExitShadowDecision | null;
}): Promise<PullbackActionShadowDecision | null> {
  const cfg = args.config.pullbackActionShadow;
  if (!cfg?.enabled) return null;

  const previous = loadState(args.symbol);
  const id = ladderId(args.positions);
  const candle = latestClosedCandle(args.symbol, args.nowMs, cfg.staleCandleMaxSec);
  const emptyPulse: OnChainFeatures | null = null;
  const emptyHl = hlComponents(null);

  if (!args.positions.length) {
    if (previous.phase !== "idle") {
      const next = cleanState();
      saveState(args.symbol, next);
      return buildDecision({
        symbol: args.symbol,
        nowMs: args.nowMs,
        event: "reset",
        firedCandidates: ["pullback_action_reset_flat_shadow"],
        candidates: [{ name: "pullback_action_reset_flat_shadow", fired: true, reason: "ladder is flat" }],
        price: args.price,
        positions: args.positions,
        candle,
        state: next,
        pullback: args.pullback,
        pulse: emptyPulse,
        hl: emptyHl,
        config: args.config,
      });
    }
    return null;
  }

  if (previous.phase !== "idle" && previous.ladderId && previous.ladderId !== id) {
    const next = cleanState();
    saveState(args.symbol, next);
    return buildDecision({
      symbol: args.symbol,
      nowMs: args.nowMs,
      event: "reset",
      firedCandidates: ["pullback_action_reset_ladder_changed_shadow"],
      candidates: [{ name: "pullback_action_reset_ladder_changed_shadow", fired: true, reason: `ladder changed ${previous.ladderId} -> ${id}` }],
      price: args.price,
      positions: args.positions,
      candle,
      state: next,
      pullback: args.pullback,
      pulse: emptyPulse,
      hl: emptyHl,
      config: args.config,
    });
  }

  if (!candle) return null;

  const pulse = await computeOnChainFeatures(args.symbol, candle.endTs).catch(() => null);
  const hl = hlComponents(pulse);
  let state = { ...previous };
  const ladder = ladderStats(args.positions, candle.close, args.nowMs);
  const scoreArmed =
    cfg.armScorePartial &&
    args.scoreLatch?.ladderId === id &&
    args.scoreLatch.firedAt > 0 &&
    args.nowMs - args.scoreLatch.firedAt <= cfg.armMaxAgeMin * ONE_MIN;
  const pullbackHlScore = args.pullback?.hl.score ?? null;
  const armHlScore = hl.score ?? pullbackHlScore;
  const hlArmed = armHlScore !== null && armHlScore >= cfg.armHlScoreMin;
  const candidates: Candidate[] = [
    {
      name: "score_partial_arm_shadow",
      fired: scoreArmed,
      reason: `scoreLatch=${args.scoreLatch?.ladderId ?? "none"}; ladder=${id}; ageMin=${args.scoreLatch ? ((args.nowMs - args.scoreLatch.firedAt) / ONE_MIN).toFixed(1) : "NA"} <= ${cfg.armMaxAgeMin}`,
    },
    {
      name: "hl_pulse_arm_shadow",
      fired: hlArmed,
      reason: `hlScore=${armHlScore ?? "NA"} >= ${cfg.armHlScoreMin}; funding=${hl.fundingNegative}; sellPressure=${hl.sellPressure}; oiUnwind=${hl.oiUnwind}; askWall=${hl.askWall}`,
    },
  ];

  if (state.phase === "idle" && (scoreArmed || hlArmed)) {
    state = {
      ...cleanState(),
      phase: "armed",
      ladderId: id,
      armedAt: args.nowMs,
      armedPrice: candle.close,
      armedDepth: ladder.depth,
      armedPnlPct: ladder.pnlPct,
      armSources: candidates.filter(c => c.fired).map(c => c.name),
      armReason: candidates.filter(c => c.fired).map(c => c.reason).join("; "),
      actionClosePct: Math.max(0, Math.min(0.95, cfg.actionClosePct)),
    };
    saveState(args.symbol, state);
    return buildDecision({
      symbol: args.symbol,
      nowMs: args.nowMs,
      event: "armed",
      firedCandidates: state.armSources,
      candidates,
      price: args.price,
      positions: args.positions,
      candle,
      state,
      pullback: args.pullback,
      pulse,
      hl,
      config: args.config,
    });
  }

  if (state.phase === "armed" && args.nowMs - state.armedAt > cfg.armMaxAgeMin * ONE_MIN) {
    state = cleanState();
    saveState(args.symbol, state);
    return buildDecision({
      symbol: args.symbol,
      nowMs: args.nowMs,
      event: "reset",
      firedCandidates: ["pullback_action_arm_expired_shadow"],
      candidates: [{ name: "pullback_action_arm_expired_shadow", fired: true, reason: `armed age > ${cfg.armMaxAgeMin}m` }],
      price: args.price,
      positions: args.positions,
      candle,
      state,
      pullback: args.pullback,
      pulse,
      hl,
      config: args.config,
    });
  }

  const confirmation =
    args.pullback?.event === "trigger" &&
    args.pullback.firedCandidates.includes("vwap_lowerlow_deep8_exit_shadow") &&
    args.pullback.ladder.depth >= cfg.minDepth &&
    (args.pullback.ladder.pnlPctAtClosedCandle ?? Infinity) <= cfg.pnlPctMax &&
    (args.pullback.hl.score ?? -Infinity) >= cfg.confirmationHlScoreMin;

  if ((state.phase === "idle" || state.phase === "armed") && confirmation) {
    const armSources = state.phase === "armed" ? state.armSources : [];
    const hlSource = (args.pullback?.hl.score ?? 0) >= cfg.confirmationHlScoreMin ? ["pullback_hl_confirmation_shadow"] : [];
    state = {
      ...state,
      phase: "watching",
      ladderId: id,
      armedAt: state.armedAt || args.nowMs,
      armedPrice: state.armedPrice ?? candle.close,
      armedDepth: state.armedDepth || ladder.depth,
      armedPnlPct: state.armedPnlPct ?? ladder.pnlPct,
      armSources: mergeSources(armSources, candidates.filter(c => c.fired).map(c => c.name), hlSource),
      armReason: state.armReason || "pullback confirmation armed action directly",
      triggerTs: args.pullback!.candle.endTs,
      triggerPrice: args.pullback!.candle.close,
      postTriggerLow: args.pullback!.candle.low,
      watchUntil: args.pullback!.candle.endTs + cfg.watchMin * ONE_MIN,
      failedAt: 0,
      failedPrice: null,
      reentryAfter: 0,
      actionClosePct: Math.max(0, Math.min(0.95, cfg.actionClosePct)),
    };
    saveState(args.symbol, state);
    return buildDecision({
      symbol: args.symbol,
      nowMs: args.nowMs,
      event: "watch_started",
      firedCandidates: ["pullback_action_watch_started_shadow"],
      candidates: [
        ...candidates,
        { name: "pullback_action_watch_started_shadow", fired: true, reason: `watch ${cfg.watchMin}m after pullback confirmation; reclaim=${cfg.reclaimPct}%` },
      ],
      price: args.price,
      positions: args.positions,
      candle,
      state,
      pullback: args.pullback,
      pulse,
      hl,
      config: args.config,
    });
  }

  if (state.phase === "watching") {
    const postLow = Math.min(state.postTriggerLow ?? candle.low, candle.low);
    const reclaimPrice = postLow * (1 + cfg.reclaimPct / 100);
    state = { ...state, postTriggerLow: postLow };
    if (candle.close >= reclaimPrice) {
      const cleared = { ...state, phase: "idle" as Phase };
      saveState(args.symbol, cleanState());
      return buildDecision({
        symbol: args.symbol,
        nowMs: args.nowMs,
        event: "reclaim_cleared",
        firedCandidates: ["pullback_action_reclaim_cleared_shadow"],
        candidates: [{ name: "pullback_action_reclaim_cleared_shadow", fired: true, reason: `close ${candle.close.toFixed(4)} >= reclaim ${reclaimPrice.toFixed(4)} before watch expiry` }],
        price: args.price,
        positions: args.positions,
        candle,
        state: cleared,
        pullback: args.pullback,
        pulse,
        hl,
        config: args.config,
      });
    }
    if (candle.endTs >= state.watchUntil) {
      state = {
        ...state,
        phase: "exited",
        failedAt: candle.endTs,
        failedPrice: candle.close,
        reentryAfter: candle.endTs + cfg.reentryCooldownMin * ONE_MIN,
      };
      saveState(args.symbol, state);
      return buildDecision({
        symbol: args.symbol,
        nowMs: args.nowMs,
        event: "would_act",
        firedCandidates: ["pullback_action_would_exit_shadow", "pullback_action_would_trim_shadow"],
        candidates: [
          { name: "pullback_action_would_exit_shadow", fired: true, reason: `no reclaim within ${cfg.watchMin}m; would full-exit at candle close` },
          { name: "pullback_action_would_trim_shadow", fired: true, reason: `no reclaim within ${cfg.watchMin}m; would trim ${(state.actionClosePct * 100).toFixed(0)}% at candle close` },
        ],
        price: args.price,
        positions: args.positions,
        candle,
        state,
        pullback: args.pullback,
        pulse,
        hl,
        config: args.config,
      });
    }
    saveState(args.symbol, state);
  }

  if (state.phase === "exited") {
    const postLow = Math.min(state.postTriggerLow ?? candle.low, candle.low);
    const reclaimPrice = postLow * (1 + cfg.reentryReclaimPct / 100);
    state = { ...state, postTriggerLow: postLow };
    if (candle.endTs >= state.reentryAfter && candle.close >= reclaimPrice) {
      const doneState = { ...state };
      saveState(args.symbol, cleanState());
      return buildDecision({
        symbol: args.symbol,
        nowMs: args.nowMs,
        event: "would_reenter",
        firedCandidates: ["pullback_action_would_reenter_shadow"],
        candidates: [{ name: "pullback_action_would_reenter_shadow", fired: true, reason: `cooldown elapsed; close ${candle.close.toFixed(4)} >= reclaim ${reclaimPrice.toFixed(4)}` }],
        price: args.price,
        positions: args.positions,
        candle,
        state: doneState,
        pullback: args.pullback,
        pulse,
        hl,
        config: args.config,
      });
    }
    saveState(args.symbol, state);
  }

  return null;
}

export function writePullbackActionShadowSignal(symbol: string, decision: PullbackActionShadowDecision): void {
  const outPath = path.join(DATA_DIR, `${symbol}_pullback_action_shadow.jsonl`);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(outPath, JSON.stringify(decision) + "\n");
}
