import fs from "fs";
import path from "path";
import { BollingerBands, MACD } from "technicalindicators";
import { BotConfig } from "./bot-config";
import { LadderPosition } from "./state";
import { OnChainFeatures } from "./shadow-logger";
import { Candle } from "../fetch-candles";

type Candidate = {
  name: string;
  fired: boolean;
  reason: string;
};

export type HedgeShadowDecision = {
  ts: string;
  timestamp: number;
  source: string;
  symbol: string;
  price: number;
  fired: boolean;
  firedCandidates: string[];
  candidates: Candidate[];
  ladder: {
    depth: number;
    avgEntry: number | null;
    pnlPct: number | null;
    totalNotional: number;
    oldestAgeHours: number | null;
  };
  technical: Record<string, number | boolean | null>;
  pulse: Record<string, number | boolean | null>;
};

function completed(candles: Candle[], intervalMs: number, nowMs: number): Candle[] {
  return candles
    .filter(c => c.timestamp + intervalMs <= nowMs)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function avg(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
}

function pctB(candles1h: Candle[], nowMs: number): number | null {
  const bars = completed(candles1h, 3600000, nowMs);
  const closes = bars.map(c => c.close);
  if (closes.length < 22) return null;
  const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
  const last = bb[bb.length - 1];
  const close = closes[closes.length - 1];
  if (!last || last.upper === last.lower) return null;
  return (close - last.lower) / (last.upper - last.lower);
}

function macdFalling(candles4h: Candle[], nowMs: number): { cur: number | null; prior: number | null; falling: boolean } {
  const bars = completed(candles4h, 4 * 3600000, nowMs);
  const closes = bars.map(c => c.close);
  if (closes.length < 40) return { cur: null, prior: null, falling: false };
  const macd = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  if (macd.length < 2) return { cur: null, prior: null, falling: false };
  const cur = macd[macd.length - 1].histogram ?? null;
  const prior = macd[macd.length - 2].histogram ?? null;
  return { cur, prior, falling: cur !== null && prior !== null && cur < prior };
}

function high3d(candles5m: Candle[], nowMs: number): number | null {
  const bars = completed(candles5m, 5 * 60000, nowMs).filter(c => c.timestamp >= nowMs - 3 * 24 * 3600000);
  if (!bars.length) return null;
  return Math.max(...bars.map(c => c.high));
}

function ladderStats(positions: LadderPosition[], price: number, nowMs: number) {
  const totalNotional = positions.reduce((s, p) => s + p.notional, 0);
  const totalQty = positions.reduce((s, p) => s + p.qty, 0);
  const avgEntry = totalQty > 0 ? positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty : null;
  const oldest = positions.length ? Math.min(...positions.map(p => p.entryTime)) : null;
  return {
    depth: positions.length,
    avgEntry,
    pnlPct: avgEntry ? ((price - avgEntry) / avgEntry) * 100 : null,
    totalNotional,
    oldestAgeHours: oldest ? (nowMs - oldest) / 3600000 : null,
  };
}

export function evaluateHedgeShadowCandidates(args: {
  symbol: string;
  nowMs: number;
  price: number;
  positions: LadderPosition[];
  candles5m: Candle[];
  candles1h: Candle[];
  candles4h: Candle[];
  pulse: OnChainFeatures;
  config: BotConfig;
}): HedgeShadowDecision | null {
  const shadowCfg = args.config.hedgeShadow;
  if (!shadowCfg?.enabled) return null;

  const ladder = ladderStats(args.positions, args.price, args.nowMs);
  const minDepth = shadowCfg.minDepth ?? 1;
  const bb1h = pctB(args.candles1h, args.nowMs);
  const macd4h = macdFalling(args.candles4h, args.nowMs);
  const h3d = high3d(args.candles5m, args.nowMs);
  const priceVs3dHighPct = h3d ? ((args.price - h3d) / h3d) * 100 : null;
  const oiBreadth4h = avg([args.pulse.oiBy4hPct, args.pulse.oiBn4hPct, args.pulse.oiHl4hPct]);
  const anyFundingNegative = [args.pulse.fdByNow, args.pulse.fdBnNow, args.pulse.fdHlNow]
    .some(v => typeof v === "number" && v < 0);

  const enoughLadder = ladder.depth >= minDepth;
  const pnlPct = ladder.pnlPct ?? 0;
  const taker4h = args.pulse.taker4h;
  const btc4h = args.pulse.btc4hMovePct;
  const liqLong = args.pulse.liq4hLongUsd ?? 0;
  const liqRatio = args.pulse.liq4hLongShortRatio;

  const d1Top =
    priceVs3dHighPct !== null && priceVs3dHighPct >= -0.1 &&
    bb1h !== null && bb1h >= 0.9 &&
    macd4h.falling;
  const pulseFade =
    (taker4h !== null && taker4h <= 1.05) ||
    (oiBreadth4h !== null && oiBreadth4h <= 0) ||
    anyFundingNegative ||
    (btc4h !== null && btc4h <= 0);

  const downsidePulse =
    enoughLadder &&
    pnlPct <= -1.5 &&
    ((oiBreadth4h !== null && oiBreadth4h <= -0.75) || (args.pulse.oiHl4hPct !== null && args.pulse.oiHl4hPct <= -1.0)) &&
    ((taker4h !== null && taker4h <= 0.95) || (btc4h !== null && btc4h <= -0.35) || anyFundingNegative);

  const cascadePulse =
    enoughLadder &&
    ladder.depth >= Math.max(5, minDepth) &&
    pnlPct <= -2.5 &&
    liqLong >= 25000 &&
    (liqRatio === null || liqRatio >= 1.5) &&
    ((oiBreadth4h !== null && oiBreadth4h <= 0) || anyFundingNegative);

  const candidates: Candidate[] = [
    {
      name: "d1_top_pulse_shadow",
      fired: enoughLadder && d1Top && pulseFade,
      reason: `depth=${ladder.depth}; priceVs3dHigh=${priceVs3dHighPct?.toFixed(3) ?? "NA"}%; bb1hPctB=${bb1h?.toFixed(3) ?? "NA"}; macd4hFalling=${macd4h.falling}; pulseFade=${pulseFade}`,
    },
    {
      name: "ladder_downside_pulse_shadow",
      fired: downsidePulse,
      reason: `depth=${ladder.depth}; pnl=${ladder.pnlPct?.toFixed(2) ?? "NA"}%; oiBreadth4h=${oiBreadth4h?.toFixed(3) ?? "NA"}; taker4h=${taker4h?.toFixed(3) ?? "NA"}; btc4h=${btc4h?.toFixed(3) ?? "NA"}%; anyFundingNegative=${anyFundingNegative}`,
    },
    {
      name: "cascade_liq_pulse_shadow",
      fired: cascadePulse,
      reason: `depth=${ladder.depth}; pnl=${ladder.pnlPct?.toFixed(2) ?? "NA"}%; liqLong4h=$${liqLong.toFixed(0)}; liqLongShortRatio=${liqRatio?.toFixed(3) ?? "NA"}; oiBreadth4h=${oiBreadth4h?.toFixed(3) ?? "NA"}; anyFundingNegative=${anyFundingNegative}`,
    },
  ];

  const firedCandidates = candidates.filter(c => c.fired).map(c => c.name);

  return {
    ts: new Date(args.nowMs).toISOString(),
    timestamp: args.nowMs,
    source: "hedgeguy-bot",
    symbol: args.symbol,
    price: args.price,
    fired: firedCandidates.length > 0,
    firedCandidates,
    candidates,
    ladder,
    technical: {
      high3d: h3d,
      priceVs3dHighPct,
      bb1hPctB: bb1h,
      macd4hCur: macd4h.cur,
      macd4hPrior: macd4h.prior,
      macd4hFalling: macd4h.falling,
    },
    pulse: {
      taker4h: args.pulse.taker4h,
      liq4hLongUsd: args.pulse.liq4hLongUsd,
      liq4hShortUsd: args.pulse.liq4hShortUsd,
      liq4hLongShortRatio: args.pulse.liq4hLongShortRatio,
      oiBy4hPct: args.pulse.oiBy4hPct,
      oiBn4hPct: args.pulse.oiBn4hPct,
      oiHl4hPct: args.pulse.oiHl4hPct,
      oiBreadth4h,
      fdByNow: args.pulse.fdByNow,
      fdBnNow: args.pulse.fdBnNow,
      fdHlNow: args.pulse.fdHlNow,
      anyFundingNegative,
      btc4hMovePct: args.pulse.btc4hMovePct,
    },
  };
}

export function writeHedgeShadowSignal(symbol: string, decision: HedgeShadowDecision): void {
  const outPath = path.resolve(process.cwd(), "data", `${symbol}_hedge_shadow_signals.jsonl`);
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(outPath, JSON.stringify(decision) + "\n");
}
