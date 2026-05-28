import fs from "fs";
import path from "path";
import { BotConfig } from "./bot-config";
import { LadderPosition } from "./state";
import { computeOnChainFeatures, OnChainFeatures } from "./shadow-logger";

type Candle1m = {
  ts: number;
  endTs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
};

type Candidate = {
  name: string;
  fired: boolean;
  reason: string;
};

type ShadowState = {
  active: boolean;
  exitTs: number;
  exitPrice: number;
  postExitLow: number;
  cooldownUntil: number;
  ladderDepth: number;
  ladderAvgEntry: number | null;
  ladderPnlPct: number | null;
  triggerCandidates: string[];
};

export type PullbackExitShadowDecision = {
  ts: string;
  timestamp: number;
  source: string;
  symbol: string;
  event: "trigger" | "reentry";
  fired: boolean;
  firedCandidates: string[];
  candidates: Candidate[];
  price: number;
  ladder: {
    depth: number;
    avgEntry: number | null;
    pnlPctAtClosedCandle: number | null;
    totalNotional: number;
    oldestAgeHours: number | null;
  };
  candle: {
    ts: number;
    endTs: number;
    iso: string;
    open: number;
    high: number;
    low: number;
    close: number;
    ageSec: number;
  };
  features: {
    vwap24h: number | null;
    priorLow12h: number | null;
    ret12hPct: number | null;
    ret1hPct: number | null;
    ret2hPct: number | null;
    belowVwap: boolean;
    lowerLow: boolean;
    hasEnoughCandles: boolean;
  };
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
  shadow: {
    active: boolean;
    exitTs: number | null;
    exitIso: string | null;
    exitPrice: number | null;
    postExitLow: number | null;
    cooldownUntil: number | null;
    cooldownUntilIso: string | null;
    reclaimPrice: number | null;
    waited: boolean | null;
    reclaim: boolean | null;
    momentumOk: boolean | null;
  };
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const ONE_MIN = 60_000;
const TAIL_BYTES = 2 * 1024 * 1024;
const stateCache = new Map<string, ShadowState>();

function num(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function iso(ts: number | null): string | null {
  return typeof ts === "number" && Number.isFinite(ts) ? new Date(ts).toISOString() : null;
}

function pct(now: number | null, prev: number | null): number | null {
  return now !== null && prev !== null && prev > 0 ? (now / prev - 1) * 100 : null;
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
  const raw = buffer.toString("utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (start > 0) lines.shift();
  return lines;
}

function readClosedCandles(symbol: string, nowMs: number): Candle1m[] {
  const file = path.join(DATA_DIR, `${symbol}_1m.jsonl`);
  const rows: Candle1m[] = [];
  for (const line of readTailLines(file)) {
    try {
      const row = JSON.parse(line);
      const ts = parseTs(row.timestamp ?? row.ts ?? row.iso);
      const open = num(row.open ?? row.o);
      const high = num(row.high ?? row.h);
      const low = num(row.low ?? row.l);
      const close = num(row.close ?? row.c);
      if (ts === null || open === null || high === null || low === null || close === null) continue;
      const c: Candle1m = {
        ts,
        endTs: ts + ONE_MIN,
        open,
        high,
        low,
        close,
        volume: num(row.volume ?? row.v) ?? 0,
        turnover: num(row.turnover ?? row.t) ?? ((num(row.volume ?? row.v) ?? 0) * close),
      };
      if (c.endTs <= nowMs) rows.push(c);
    } catch {
      // Ignore partial copy tails.
    }
  }
  rows.sort((a, b) => a.ts - b.ts);
  return rows;
}

function statePath(symbol: string): string {
  return path.join(DATA_DIR, `${symbol}_pullback_exit_shadow_state.json`);
}

function loadState(symbol: string): ShadowState {
  const cached = stateCache.get(symbol);
  if (cached) return cached;
  const file = statePath(symbol);
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      const state = { active: false, ...parsed } as ShadowState;
      stateCache.set(symbol, state);
      return state;
    } catch {
      // Fall through to a clean shadow state.
    }
  }
  const clean: ShadowState = {
    active: false,
    exitTs: 0,
    exitPrice: 0,
    postExitLow: Infinity,
    cooldownUntil: 0,
    ladderDepth: 0,
    ladderAvgEntry: null,
    ladderPnlPct: null,
    triggerCandidates: [],
  };
  stateCache.set(symbol, clean);
  return clean;
}

function saveState(symbol: string, state: ShadowState): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  stateCache.set(symbol, state);
  fs.writeFileSync(statePath(symbol), JSON.stringify(state, null, 2));
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
    depth: positions.length,
    avgEntry: avg,
    pnlPctAtClosedCandle: avg !== null ? (price / avg - 1) * 100 : null,
    totalNotional: positions.reduce((sum, p) => sum + p.notional, 0),
    oldestAgeHours: oldest !== null ? (nowMs - oldest) / 3600000 : null,
  };
}

function lastAtOrBefore(candles: Candle1m[], endTs: number): Candle1m | null {
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].endTs <= endTs) return candles[i];
  }
  return null;
}

function vwap(candles: Candle1m[]): number | null {
  const volume = candles.reduce((sum, c) => sum + c.volume, 0);
  const turnover = candles.reduce((sum, c) => sum + c.turnover, 0);
  return volume > 0 ? turnover / volume : null;
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

function makeDecision(args: {
  symbol: string;
  nowMs: number;
  event: "trigger" | "reentry";
  firedCandidates: string[];
  candidates: Candidate[];
  livePrice: number;
  ladder: ReturnType<typeof ladderStats>;
  latest: Candle1m;
  features: PullbackExitShadowDecision["features"];
  pulse: OnChainFeatures | null;
  hl: ReturnType<typeof hlComponents>;
  state: ShadowState;
  waited: boolean | null;
  reclaim: boolean | null;
  momentumOk: boolean | null;
  reclaimPrice: number | null;
}): PullbackExitShadowDecision {
  return {
    ts: new Date(args.nowMs).toISOString(),
    timestamp: args.nowMs,
    source: "hedgeguy-bot",
    symbol: args.symbol,
    event: args.event,
    fired: args.firedCandidates.length > 0,
    firedCandidates: args.firedCandidates,
    candidates: args.candidates,
    price: args.livePrice,
    ladder: args.ladder,
    candle: {
      ts: args.latest.ts,
      endTs: args.latest.endTs,
      iso: new Date(args.latest.endTs).toISOString(),
      open: args.latest.open,
      high: args.latest.high,
      low: args.latest.low,
      close: args.latest.close,
      ageSec: (args.nowMs - args.latest.endTs) / 1000,
    },
    features: args.features,
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
    shadow: {
      active: args.state.active,
      exitTs: args.state.active ? args.state.exitTs : null,
      exitIso: args.state.active ? iso(args.state.exitTs) : null,
      exitPrice: args.state.active ? args.state.exitPrice : null,
      postExitLow: args.state.active ? args.state.postExitLow : null,
      cooldownUntil: args.state.active ? args.state.cooldownUntil : null,
      cooldownUntilIso: args.state.active ? iso(args.state.cooldownUntil) : null,
      reclaimPrice: args.reclaimPrice,
      waited: args.waited,
      reclaim: args.reclaim,
      momentumOk: args.momentumOk,
    },
  };
}

export async function evaluatePullbackExitShadow(args: {
  symbol: string;
  nowMs: number;
  price: number;
  positions: LadderPosition[];
  config: BotConfig;
}): Promise<PullbackExitShadowDecision | null> {
  const cfg = args.config.pullbackExitShadow;
  if (!cfg?.enabled) return null;

  const candles = readClosedCandles(args.symbol, args.nowMs);
  if (!candles.length) return null;
  const latest = candles[candles.length - 1];
  if ((args.nowMs - latest.endTs) / 1000 > cfg.staleCandleMaxSec) return null;

  const lookbackLowStart = latest.endTs - cfg.lowerLowLookbackMin * ONE_MIN;
  const priorLowBars = candles.filter(c => c.endTs > lookbackLowStart && c.endTs < latest.endTs);
  const vwapStart = latest.endTs - cfg.vwapLookbackMin * ONE_MIN;
  const vwapBars = candles.filter(c => c.endTs > vwapStart && c.endTs <= latest.endTs);
  const c12h = lastAtOrBefore(candles, latest.endTs - cfg.lowerLowLookbackMin * ONE_MIN);
  const c1h = lastAtOrBefore(candles, latest.endTs - 60 * ONE_MIN);
  const c2h = lastAtOrBefore(candles, latest.endTs - 120 * ONE_MIN);
  const priorLow12h = priorLowBars.length ? Math.min(...priorLowBars.map(c => c.low)) : null;
  const vwap24h = vwap(vwapBars);
  const ret12hPct = pct(latest.close, c12h?.close ?? null);
  const ret1hPct = pct(latest.close, c1h?.close ?? null);
  const ret2hPct = pct(latest.close, c2h?.close ?? null);
  const belowVwap = vwap24h !== null && latest.close < vwap24h;
  const lowerLow = priorLow12h !== null && latest.close <= priorLow12h * (1 + cfg.lowerLowBufferPct / 100);
  const hasEnoughCandles = priorLowBars.length >= cfg.lowerLowLookbackMin * 0.95 && vwapBars.length >= cfg.vwapLookbackMin * 0.95;
  const features = {
    vwap24h,
    priorLow12h,
    ret12hPct,
    ret1hPct,
    ret2hPct,
    belowVwap,
    lowerLow,
    hasEnoughCandles,
  };

  const state = loadState(args.symbol);
  const ladder = ladderStats(args.positions, latest.close, args.nowMs);
  const pulse = await computeOnChainFeatures(args.symbol, latest.endTs).catch(() => null);
  const hl = hlComponents(pulse);
  const reclaimPrice = state.active && Number.isFinite(state.postExitLow)
    ? state.postExitLow * (1 + cfg.reclaimPct / 100)
    : null;

  if (state.active) {
    state.postExitLow = Math.min(state.postExitLow, latest.low);
    const activeReclaimPrice = Number.isFinite(state.postExitLow)
      ? state.postExitLow * (1 + cfg.reclaimPct / 100)
      : reclaimPrice;
    const waited = latest.endTs >= state.cooldownUntil;
    const reclaim = activeReclaimPrice !== null && latest.close >= activeReclaimPrice;
    const momentumOk =
      (ret1hPct !== null && ret1hPct >= cfg.momentumRet1hMin) ||
      (ret2hPct !== null && ret2hPct >= cfg.momentumRet2hMin);

    if (waited && reclaim && momentumOk) {
      const candidates: Candidate[] = [{
        name: "vwap_lowerlow_deep8_reclaim_reentry_shadow",
        fired: true,
        reason: `waited=${waited}; close=${latest.close.toFixed(4)} >= reclaim=${reclaimPrice?.toFixed(4) ?? "NA"}; ret1h=${ret1hPct?.toFixed(3) ?? "NA"}%; ret2h=${ret2hPct?.toFixed(3) ?? "NA"}%`,
      }];
      const decision = makeDecision({
        symbol: args.symbol,
        nowMs: args.nowMs,
        event: "reentry",
        firedCandidates: candidates.map(c => c.name),
        candidates,
        livePrice: args.price,
        ladder,
        latest,
        features,
        pulse,
        hl,
        state,
        waited,
        reclaim,
        momentumOk,
        reclaimPrice: activeReclaimPrice,
      });
      saveState(args.symbol, { ...state, active: false });
      return decision;
    }

    saveState(args.symbol, state);
    return null;
  }

  const candleTrigger =
    hasEnoughCandles &&
    ladder.depth >= cfg.minDepth &&
    ladder.pnlPctAtClosedCandle !== null &&
    ladder.pnlPctAtClosedCandle <= cfg.pnlPctMax &&
    belowVwap &&
    lowerLow &&
    ret12hPct !== null &&
    ret12hPct <= cfg.ret12hMax;

  const candidates: Candidate[] = [
    {
      name: "vwap_lowerlow_deep8_exit_shadow",
      fired: candleTrigger,
      reason: `depth=${ladder.depth}>=${cfg.minDepth}; ladderPnl=${ladder.pnlPctAtClosedCandle?.toFixed(2) ?? "NA"}<=${cfg.pnlPctMax}; belowVwap=${belowVwap}; lowerLow=${lowerLow}; ret12h=${ret12hPct?.toFixed(3) ?? "NA"}<=${cfg.ret12hMax}`,
    },
    {
      name: "vwap_lowerlow_deep8_hl3_exit_shadow",
      fired: candleTrigger && hl.score !== null && hl.score >= 3,
      reason: `candleTrigger=${candleTrigger}; hlScore=${hl.score ?? "NA"}/4; funding=${hl.fundingNegative}; sellPressure=${hl.sellPressure}; oiUnwind=${hl.oiUnwind}; askWall=${hl.askWall}`,
    },
    {
      name: "vwap_lowerlow_deep8_hl4_exit_shadow",
      fired: candleTrigger && hl.score !== null && hl.score >= 4,
      reason: `candleTrigger=${candleTrigger}; hlScore=${hl.score ?? "NA"}/4; funding=${hl.fundingNegative}; sellPressure=${hl.sellPressure}; oiUnwind=${hl.oiUnwind}; askWall=${hl.askWall}`,
    },
  ];
  const firedCandidates = candidates.filter(c => c.fired).map(c => c.name);
  if (!firedCandidates.length) return null;

  const nextState: ShadowState = {
    active: true,
    exitTs: latest.endTs,
    exitPrice: latest.close,
    postExitLow: latest.low,
    cooldownUntil: latest.endTs + cfg.cooldownMin * ONE_MIN,
    ladderDepth: ladder.depth,
    ladderAvgEntry: ladder.avgEntry,
    ladderPnlPct: ladder.pnlPctAtClosedCandle,
    triggerCandidates: firedCandidates,
  };
  saveState(args.symbol, nextState);

  return makeDecision({
    symbol: args.symbol,
    nowMs: args.nowMs,
    event: "trigger",
    firedCandidates,
    candidates,
    livePrice: args.price,
    ladder,
    latest,
    features,
    pulse,
    hl,
    state: nextState,
    waited: null,
    reclaim: null,
    momentumOk: null,
    reclaimPrice: nextState.postExitLow * (1 + cfg.reclaimPct / 100),
  });
}

export function writePullbackExitShadowSignal(symbol: string, decision: PullbackExitShadowDecision): void {
  const outPath = path.join(DATA_DIR, `${symbol}_pullback_exit_shadow.jsonl`);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(outPath, JSON.stringify(decision) + "\n");
}
