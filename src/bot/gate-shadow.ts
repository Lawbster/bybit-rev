import fs from "fs";
import path from "path";
import { Candle } from "../fetch-candles";
import { BotConfig } from "./bot-config";
import { LadderPosition } from "./state";
import { buildScoreFeatures } from "./score-partial-flatten";

const DATA_DIR = path.join(process.cwd(), "data");

export interface GateShadowContext {
  blockReason: string;
  trendBlocked: boolean;
  trendLastClose?: number | null;
  trendEma200?: number | null;
  trendEma200DistPct?: number | null;
  trendEma50SlopePct?: number | null;
  overextendedBlocked: boolean;
  riskOffBlocked: boolean;
  regimeBlocked: boolean;
  srBlocked: boolean;
  ladderKillBlocked: boolean;
  priceDropOk: boolean;
  timeGateOk: boolean;
}

export interface GateShadowCandidate {
  name: string;
  fired: boolean;
  reason: string;
}

export interface GateShadowDecision {
  fired: boolean;
  candidates: GateShadowCandidate[];
  features: Record<string, number | null>;
}

function n(value: number | null | undefined, fallback = NaN): number {
  return value === null || value === undefined ? fallback : value;
}

function reason(parts: string[]): string {
  return parts.filter(Boolean).join("; ");
}

export async function evaluateGateShadowCandidates(
  symbol: string,
  nowMs: number,
  price: number,
  positions: LadderPosition[],
  candles5m: Candle[],
  config: BotConfig,
  ctx: GateShadowContext,
): Promise<GateShadowDecision> {
  const features = await buildScoreFeatures(symbol, nowMs, price, positions, candles5m);
  if (typeof ctx.trendEma200DistPct === "number" && Number.isFinite(ctx.trendEma200DistPct)) {
    features.ema200_4h_distPct = ctx.trendEma200DistPct;
  }
  if (typeof ctx.trendEma50SlopePct === "number" && Number.isFinite(ctx.trendEma50SlopePct)) {
    features.ema50_4h_slopePct = ctx.trendEma50SlopePct;
  }
  features.trendHostile4h = ctx.trendBlocked ? 1 : 0;

  const emaDist = n(features.ema200_4h_distPct);
  const rsi1h = n(features.rsi1h);
  const crsi4h = n(features.crsi4h);
  const btc4h = n(features.btc4hPct);
  const taker4h = n(features.taker4h);
  const oiBreadth4h = n(features.oiBreadth4h);
  const rsi5m = n(features.rsi5m);
  const bb5m = n(features.bb20_5m_z);
  const fundingHl = n(features.fundingHl);

  const trendNearEma = ctx.trendBlocked && emaDist >= -0.35;
  const overextendedShadow = ctx.overextendedBlocked && positions.length === 0;
  const candidates: GateShadowCandidate[] = [
    {
      name: "trend_near_ema_override_shadow",
      fired: trendNearEma,
      reason: reason([
        `trendBlocked=${ctx.trendBlocked}`,
        `ema200_4h_distPct=${Number.isFinite(emaDist) ? emaDist.toFixed(3) : "n/a"} >= -0.35`,
      ]),
    },
    {
      name: "trend_reclaim_shadow",
      fired: trendNearEma && btc4h > 0 && taker4h > 1 && oiBreadth4h > 0,
      reason: reason([
        `nearEma=${trendNearEma}`,
        `btc4h=${Number.isFinite(btc4h) ? btc4h.toFixed(3) : "n/a"} > 0`,
        `taker4h=${Number.isFinite(taker4h) ? taker4h.toFixed(3) : "n/a"} > 1`,
        `oiBreadth4h=${Number.isFinite(oiBreadth4h) ? oiBreadth4h.toFixed(3) : "n/a"} > 0`,
      ]),
    },
    {
      name: "overextended_override_shadow",
      fired: overextendedShadow,
      reason: reason([
        `overextendedBlocked=${ctx.overextendedBlocked}`,
        `slope12h=${features.slope12hPct?.toFixed(3) ?? "n/a"}`,
        `rsi1h=${Number.isFinite(rsi1h) ? rsi1h.toFixed(1) : "n/a"}`,
        `crsi4h=${Number.isFinite(crsi4h) ? crsi4h.toFixed(1) : "n/a"}`,
      ]),
    },
    {
      name: "trend_capitulation_shadow",
      fired: ctx.trendBlocked &&
        (rsi5m <= 40.86 || bb5m <= -1.199) &&
        crsi4h <= 35.14 &&
        fundingHl <= 0.00000499,
      reason: reason([
        `trendBlocked=${ctx.trendBlocked}`,
        `rsi5m=${Number.isFinite(rsi5m) ? rsi5m.toFixed(1) : "n/a"} <= 40.86 OR bb5m=${Number.isFinite(bb5m) ? bb5m.toFixed(3) : "n/a"} <= -1.199`,
        `crsi4h=${Number.isFinite(crsi4h) ? crsi4h.toFixed(1) : "n/a"} <= 35.14`,
        `fundingHl=${Number.isFinite(fundingHl) ? fundingHl.toFixed(8) : "n/a"} <= 0.00000499`,
      ]),
    },
  ];

  return {
    fired: candidates.some(candidate => candidate.fired),
    candidates,
    features,
  };
}

export function writeGateShadowSignal(
  symbol: string,
  nowMs: number,
  price: number,
  ctx: GateShadowContext,
  decision: GateShadowDecision,
): void {
  try {
    const outPath = path.join(DATA_DIR, `${symbol}_gate_shadow_signals.jsonl`);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(outPath, JSON.stringify({
      ts: new Date(nowMs).toISOString(),
      timestamp: nowMs,
      source: "hedgeguy-bot",
      symbol,
      price,
      blockReason: ctx.blockReason,
      fired: decision.fired,
      firedCandidates: decision.candidates.filter(candidate => candidate.fired).map(candidate => candidate.name),
      candidates: decision.candidates,
      context: ctx,
      features: decision.features,
    }) + "\n");
  } catch {
    // Gate shadow telemetry must never affect trading.
  }
}
