import fs from "fs";
import path from "path";
import { BotConfig } from "./bot-config";
import { LadderPosition } from "./state";
import { TrendGateResult } from "./strategy";

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

type Phase = "idle" | "watching" | "cooldown" | "fired";

type Candidate = {
  name: string;
  fired: boolean;
  reason: string;
};

type EuphoriaStopState = {
  phase: Phase;
  ladderId: string;
  triggerTs: number;
  triggerPrice: number | null;
  triggerLow: number | null;
  postLow: number | null;
  watchUntil: number;
  cooldownUntil: number;
  firedAt: number;
  firedPrice: number | null;
};

export type EuphoriaStopShadowDecision = {
  ts: string;
  timestamp: number;
  source: string;
  symbol: string;
  event: "watch_started" | "reclaim_cleared" | "would_exit" | "expired_no_lower_low" | "reset";
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
    estimatedFullExitPnl: number | null;
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
  features: {
    vwap24h: number | null;
    priceVsVwapPct: number | null;
    hasEnoughCandles: boolean;
    aboveEma200: boolean;
    trendLastClose: number | null;
    trendEma200: number | null;
    trendEma200DistPct: number | null;
    postLow: number | null;
    triggerLow: number | null;
    reclaimPrice: number | null;
    madeLowerLow: boolean | null;
  };
  state: EuphoriaStopState;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const ONE_MIN = 60_000;
const TAIL_BYTES = 2 * 1024 * 1024;
const stateCache = new Map<string, EuphoriaStopState>();

function cleanState(): EuphoriaStopState {
  return {
    phase: "idle",
    ladderId: "",
    triggerTs: 0,
    triggerPrice: null,
    triggerLow: null,
    postLow: null,
    watchUntil: 0,
    cooldownUntil: 0,
    firedAt: 0,
    firedPrice: null,
  };
}

function num(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseTs(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Date.parse(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function iso(ts: number | null): string | null {
  return typeof ts === "number" && Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : null;
}

function pct(now: number | null, prev: number | null): number | null {
  return now !== null && prev !== null && prev > 0 ? (now / prev - 1) * 100 : null;
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

function readClosedCandles(symbol: string, nowMs: number): Candle1m[] {
  const file = path.join(DATA_DIR, `${symbol}_1m.jsonl`);
  const candles: Candle1m[] = [];
  for (const line of readTailLines(file)) {
    try {
      const row = JSON.parse(line);
      const ts = parseTs(row.timestamp ?? row.ts ?? row.iso);
      const open = num(row.open ?? row.o);
      const high = num(row.high ?? row.h);
      const low = num(row.low ?? row.l);
      const close = num(row.close ?? row.c);
      if (ts === null || open === null || high === null || low === null || close === null) continue;
      const volume = num(row.volume ?? row.v) ?? 0;
      const candle: Candle1m = {
        ts,
        endTs: ts + ONE_MIN,
        open,
        high,
        low,
        close,
        volume,
        turnover: num(row.turnover ?? row.t) ?? volume * close,
      };
      if (candle.endTs <= nowMs) candles.push(candle);
    } catch {
      // Ignore partial copy tails.
    }
  }
  candles.sort((a, b) => a.ts - b.ts);
  return candles;
}

function statePath(symbol: string): string {
  return path.join(DATA_DIR, `${symbol}_euphoria_stop_shadow_state.json`);
}

function loadState(symbol: string): EuphoriaStopState {
  const cached = stateCache.get(symbol);
  if (cached) return cached;
  const file = statePath(symbol);
  if (fs.existsSync(file)) {
    try {
      const parsed = { ...cleanState(), ...JSON.parse(fs.readFileSync(file, "utf8")) } as EuphoriaStopState;
      stateCache.set(symbol, parsed);
      return parsed;
    } catch {
      // Fall through to clean state.
    }
  }
  const state = cleanState();
  stateCache.set(symbol, state);
  return state;
}

function saveState(symbol: string, state: EuphoriaStopState): void {
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

function fullExitPnl(positions: LadderPosition[], price: number, feeRate: number): number | null {
  if (!positions.length) return null;
  let pnl = 0;
  for (const pos of positions) {
    const entryFee = pos.notional * feeRate;
    const exitFee = price * pos.qty * feeRate;
    pnl += (price - pos.entryPrice) * pos.qty - entryFee - exitFee;
  }
  return pnl;
}

function ladderStats(positions: LadderPosition[], price: number, nowMs: number, feeRate: number) {
  const avg = avgEntry(positions);
  const oldest = positions.length ? Math.min(...positions.map(p => p.entryTime)) : null;
  return {
    id: ladderId(positions),
    depth: positions.length,
    avgEntry: avg,
    pnlPct: avg !== null ? (price / avg - 1) * 100 : null,
    totalNotional: positions.reduce((sum, p) => sum + p.notional, 0),
    oldestAgeHours: oldest !== null ? (nowMs - oldest) / 3600000 : null,
    estimatedFullExitPnl: fullExitPnl(positions, price, feeRate),
  };
}

function vwap(candles: Candle1m[]): number | null {
  const volume = candles.reduce((sum, c) => sum + c.volume, 0);
  const turnover = candles.reduce((sum, c) => sum + c.turnover, 0);
  return volume > 0 ? turnover / volume : null;
}

function makeDecision(args: {
  symbol: string;
  nowMs: number;
  event: EuphoriaStopShadowDecision["event"];
  firedCandidates: string[];
  candidates: Candidate[];
  price: number;
  positions: LadderPosition[];
  candle: Candle1m | null;
  state: EuphoriaStopState;
  config: BotConfig;
  trend: TrendGateResult;
  vwap24h: number | null;
  hasEnoughCandles: boolean;
  madeLowerLow: boolean | null;
}): EuphoriaStopShadowDecision {
  const actionPrice = args.candle?.close ?? args.price;
  const ladder = ladderStats(args.positions, actionPrice, args.nowMs, args.config.feeRate);
  const trendEma200 = args.trend.ema200 > 0 ? args.trend.ema200 : null;
  const trendLastClose = args.trend.lastClose > 0 ? args.trend.lastClose : null;
  const postLow = args.state.postLow;
  const reclaimPrice = postLow !== null
    ? postLow * (1 + (args.config.euphoriaStopShadow?.reclaimPct ?? 1.2) / 100)
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
    ladder,
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
    features: {
      vwap24h: args.vwap24h,
      priceVsVwapPct: pct(actionPrice, args.vwap24h),
      hasEnoughCandles: args.hasEnoughCandles,
      aboveEma200: trendLastClose !== null && trendEma200 !== null && trendLastClose > trendEma200,
      trendLastClose,
      trendEma200,
      trendEma200DistPct: pct(trendLastClose, trendEma200),
      postLow,
      triggerLow: args.state.triggerLow,
      reclaimPrice,
      madeLowerLow: args.madeLowerLow,
    },
    state: args.state,
  };
}

export async function evaluateEuphoriaStopShadow(args: {
  symbol: string;
  nowMs: number;
  price: number;
  positions: LadderPosition[];
  config: BotConfig;
  trend: TrendGateResult;
}): Promise<EuphoriaStopShadowDecision | null> {
  const cfg = args.config.euphoriaStopShadow;
  if (!cfg?.enabled) return null;

  const state = loadState(args.symbol);
  const id = ladderId(args.positions);
  const candles = readClosedCandles(args.symbol, args.nowMs);
  const latest = candles[candles.length - 1] ?? null;

  if (!args.positions.length) {
    if (state.phase !== "idle") {
      const next = cleanState();
      saveState(args.symbol, next);
      return makeDecision({
        symbol: args.symbol,
        nowMs: args.nowMs,
        event: "reset",
        firedCandidates: ["euphoria_stop_reset_flat_shadow"],
        candidates: [{ name: "euphoria_stop_reset_flat_shadow", fired: true, reason: "ladder is flat" }],
        price: args.price,
        positions: args.positions,
        candle: latest,
        state: next,
        config: args.config,
        trend: args.trend,
        vwap24h: null,
        hasEnoughCandles: false,
        madeLowerLow: null,
      });
    }
    return null;
  }

  if (state.phase !== "idle" && state.ladderId && state.ladderId !== id) {
    const next = cleanState();
    saveState(args.symbol, next);
    return makeDecision({
      symbol: args.symbol,
      nowMs: args.nowMs,
      event: "reset",
      firedCandidates: ["euphoria_stop_reset_ladder_changed_shadow"],
      candidates: [{ name: "euphoria_stop_reset_ladder_changed_shadow", fired: true, reason: `ladder changed ${state.ladderId} -> ${id}` }],
      price: args.price,
      positions: args.positions,
      candle: latest,
      state: next,
      config: args.config,
      trend: args.trend,
      vwap24h: null,
      hasEnoughCandles: false,
      madeLowerLow: null,
    });
  }

  if (!latest) return null;
  if ((args.nowMs - latest.endTs) / 1000 > cfg.staleCandleMaxSec) return null;

  const vwapStart = latest.endTs - cfg.vwapLookbackMin * ONE_MIN;
  const vwapBars = candles.filter(c => c.endTs > vwapStart && c.endTs <= latest.endTs);
  const vwap24h = vwap(vwapBars);
  const hasEnoughCandles = vwapBars.length >= cfg.vwapLookbackMin * 0.95;
  const aboveEma200 = args.trend.ema200 > 0 && args.trend.lastClose > args.trend.ema200;
  const belowVwap = vwap24h !== null && latest.close < vwap24h;
  const ladder = ladderStats(args.positions, latest.close, args.nowMs, args.config.feeRate);

  if (state.phase === "fired") return null;
  if (state.phase === "cooldown") {
    if (latest.endTs < state.cooldownUntil) return null;
    saveState(args.symbol, cleanState());
  }

  const activeState = loadState(args.symbol);

  if (activeState.phase === "watching") {
    const postLow = Math.min(activeState.postLow ?? latest.low, latest.low);
    const nextState = { ...activeState, postLow };
    const reclaimPrice = postLow * (1 + cfg.reclaimPct / 100);
    const madeLowerLow = activeState.triggerLow !== null && postLow < activeState.triggerLow;

    if (latest.close >= reclaimPrice) {
      const cooldownState = {
        ...nextState,
        phase: "cooldown" as Phase,
        cooldownUntil: latest.endTs + cfg.cooldownMin * ONE_MIN,
      };
      saveState(args.symbol, cooldownState);
      return makeDecision({
        symbol: args.symbol,
        nowMs: args.nowMs,
        event: "reclaim_cleared",
        firedCandidates: ["euphoria_stop_reclaim_cleared_shadow"],
        candidates: [{ name: "euphoria_stop_reclaim_cleared_shadow", fired: true, reason: `close ${latest.close.toFixed(4)} >= reclaim ${reclaimPrice.toFixed(4)}` }],
        price: args.price,
        positions: args.positions,
        candle: latest,
        state: cooldownState,
        config: args.config,
        trend: args.trend,
        vwap24h,
        hasEnoughCandles,
        madeLowerLow,
      });
    }

    if (latest.endTs >= activeState.watchUntil) {
      if (madeLowerLow) {
        const firedState = {
          ...nextState,
          phase: "fired" as Phase,
          firedAt: latest.endTs,
          firedPrice: latest.close,
        };
        saveState(args.symbol, firedState);
        return makeDecision({
          symbol: args.symbol,
          nowMs: args.nowMs,
          event: "would_exit",
          firedCandidates: ["euphoria_stop_would_exit_shadow"],
          candidates: [{ name: "euphoria_stop_would_exit_shadow", fired: true, reason: `failed reclaim ${cfg.watchMin}m; postLow ${postLow.toFixed(4)} < triggerLow ${activeState.triggerLow?.toFixed(4) ?? "NA"}` }],
          price: args.price,
          positions: args.positions,
          candle: latest,
          state: firedState,
          config: args.config,
          trend: args.trend,
          vwap24h,
          hasEnoughCandles,
          madeLowerLow,
        });
      }

      const cooldownState = {
        ...nextState,
        phase: "cooldown" as Phase,
        cooldownUntil: latest.endTs + cfg.cooldownMin * ONE_MIN,
      };
      saveState(args.symbol, cooldownState);
      return makeDecision({
        symbol: args.symbol,
        nowMs: args.nowMs,
        event: "expired_no_lower_low",
        firedCandidates: ["euphoria_stop_expired_no_lower_low_shadow"],
        candidates: [{ name: "euphoria_stop_expired_no_lower_low_shadow", fired: true, reason: `failed reclaim ${cfg.watchMin}m but no lower low during watch` }],
        price: args.price,
        positions: args.positions,
        candle: latest,
        state: cooldownState,
        config: args.config,
        trend: args.trend,
        vwap24h,
        hasEnoughCandles,
        madeLowerLow,
      });
    }

    saveState(args.symbol, nextState);
    return null;
  }

  const trigger =
    hasEnoughCandles &&
    ladder.depth >= cfg.minDepth &&
    ladder.pnlPct !== null &&
    ladder.pnlPct <= cfg.pnlPctMax &&
    aboveEma200 &&
    belowVwap;

  const candidates: Candidate[] = [{
    name: "euphoria_stop_watch_shadow",
    fired: trigger,
    reason: `depth=${ladder.depth}>=${cfg.minDepth}; pnl=${ladder.pnlPct?.toFixed(2) ?? "NA"}<=${cfg.pnlPctMax}; aboveEma200=${aboveEma200}; belowVwap=${belowVwap}; hasEnoughCandles=${hasEnoughCandles}`,
  }];

  if (!trigger) return null;

  const nextState: EuphoriaStopState = {
    phase: "watching",
    ladderId: id,
    triggerTs: latest.endTs,
    triggerPrice: latest.close,
    triggerLow: latest.low,
    postLow: latest.low,
    watchUntil: latest.endTs + cfg.watchMin * ONE_MIN,
    cooldownUntil: 0,
    firedAt: 0,
    firedPrice: null,
  };
  saveState(args.symbol, nextState);

  return makeDecision({
    symbol: args.symbol,
    nowMs: args.nowMs,
    event: "watch_started",
    firedCandidates: ["euphoria_stop_watch_shadow"],
    candidates,
    price: args.price,
    positions: args.positions,
    candle: latest,
    state: nextState,
    config: args.config,
    trend: args.trend,
    vwap24h,
    hasEnoughCandles,
    madeLowerLow: false,
  });
}

export function writeEuphoriaStopShadowSignal(symbol: string, decision: EuphoriaStopShadowDecision): void {
  const outPath = path.join(DATA_DIR, `${symbol}_euphoria_stop_shadow.jsonl`);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(outPath, JSON.stringify(decision) + "\n");
}
