import fs from "fs";
import path from "path";
import { BotConfig } from "./bot-config";
import { LadderPosition } from "./state";
import { OnChainFeatures } from "./shadow-logger";

type DeepAddGuardResult = {
  blocked: boolean;
  reason: string;
  stress: boolean;
  reasons: string[];
};

type Candidate = {
  name: string;
  stress: boolean;
  wouldBlock: boolean;
  reason: string;
  components: Record<string, number | boolean | null>;
};

export type DeepAddStressShadowDecision = {
  ts: string;
  timestamp: number;
  source: string;
  symbol: string;
  price: number;
  fired: boolean;
  firedCandidates: string[];
  differentFromLiveGuard: boolean;
  candidates: Candidate[];
  liveGuard: DeepAddGuardResult;
  ladder: {
    depth: number;
    nextDepth: number;
    avgEntry: number | null;
    pnlPct: number | null;
    totalNotional: number;
    oldestAgeHours: number | null;
  };
  addContext: {
    priceDropOk: boolean;
    mode: "requirePriceDrop" | "block";
    minDepth: number;
    fundingRateMax: number;
  };
  pulse: Record<string, number | boolean | null>;
};

function avgEntry(positions: LadderPosition[]): number | null {
  const qty = positions.reduce((s, p) => s + p.qty, 0);
  if (qty <= 0) return null;
  return positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / qty;
}

function ladderStats(positions: LadderPosition[], price: number, nowMs: number) {
  const avg = avgEntry(positions);
  const oldest = positions.length ? Math.min(...positions.map(p => p.entryTime)) : null;
  return {
    depth: positions.length,
    nextDepth: positions.length + 1,
    avgEntry: avg,
    pnlPct: avg ? ((price - avg) / avg) * 100 : null,
    totalNotional: positions.reduce((s, p) => s + p.notional, 0),
    oldestAgeHours: oldest ? (nowMs - oldest) / 3600000 : null,
  };
}

function finite(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fmtPct(value: number | null): string {
  return finite(value) ? `${(value * 100).toFixed(4)}%` : "NA";
}

function fmt(value: number | null, digits = 3): string {
  return finite(value) ? value.toFixed(digits) : "NA";
}

function shouldBlock(stress: boolean, priceDropOk: boolean, mode: "requirePriceDrop" | "block"): boolean {
  if (!stress) return false;
  return mode === "block" || !priceDropOk;
}

export function evaluateDeepAddStressShadow(args: {
  symbol: string;
  nowMs: number;
  price: number;
  positions: LadderPosition[];
  priceDropOk: boolean;
  pulse: OnChainFeatures;
  liveGuard: DeepAddGuardResult;
  config: BotConfig;
}): DeepAddStressShadowDecision | null {
  const cfg = args.config.deepAddStressGuard;
  if (!cfg?.enabled) return null;
  if (args.positions.length < cfg.minDepth) return null;

  const mode = cfg.mode;
  const fundingRateMax = cfg.fundingRateMax;
  const byFundingNeg = finite(args.pulse.fdByNow) && args.pulse.fdByNow < fundingRateMax;
  const bnFundingNeg = finite(args.pulse.fdBnNow) && args.pulse.fdBnNow < fundingRateMax;
  const hlLegacyFundingNeg = finite(args.pulse.fdHlNow) && args.pulse.fdHlNow < fundingRateMax;
  const hlSocketFundingNeg = finite(args.pulse.hlAssetFundingNow) && args.pulse.hlAssetFundingNow < fundingRateMax;
  const hlAnyFundingNeg = hlLegacyFundingNeg || hlSocketFundingNeg;

  const hlTakerFade =
    finite(args.pulse.hlTaker15m) &&
    finite(args.pulse.hlTaker1h) &&
    args.pulse.hlTaker15m < args.pulse.hlTaker1h * 0.75;
  const hlSellPressure =
    (finite(args.pulse.hlTaker15m) && args.pulse.hlTaker15m <= 0.85) ||
    (finite(args.pulse.hlTaker1h) && args.pulse.hlTaker1h <= 0.90) ||
    hlTakerFade;
  const hlOiUnwind =
    (finite(args.pulse.hlAssetOi1hPct) && args.pulse.hlAssetOi1hPct <= -0.50) ||
    (finite(args.pulse.hlAssetOi4hPct) && args.pulse.hlAssetOi4hPct <= -1.00) ||
    (finite(args.pulse.oiHl4hPct) && args.pulse.oiHl4hPct <= -1.00);
  const hlAskWall =
    (finite(args.pulse.hlObImbalance05) && args.pulse.hlObImbalance05 <= -0.20) ||
    (finite(args.pulse.hlObAskBid05Ratio) && args.pulse.hlObAskBid05Ratio >= 1.35);

  const hlPulseComponents = {
    hlAnyFundingNeg,
    hlSellPressure,
    hlOiUnwind,
    hlAskWall,
  };
  const hlPulseScore = Object.values(hlPulseComponents).filter(Boolean).length;

  const candidates: Candidate[] = [];
  const pushCandidate = (
    name: string,
    stress: boolean,
    reason: string,
    components: Record<string, number | boolean | null>,
  ) => {
    candidates.push({
      name,
      stress,
      wouldBlock: shouldBlock(stress, args.priceDropOk, mode),
      reason,
      components,
    });
  };

  pushCandidate(
    "legacy_bybit_binance_funding_shadow",
    byFundingNeg || bnFundingNeg,
    `bybit=${fmtPct(args.pulse.fdByNow)}; binance=${fmtPct(args.pulse.fdBnNow)}`,
    {
      byFundingNeg,
      bnFundingNeg,
      fdByNow: args.pulse.fdByNow,
      fdBnNow: args.pulse.fdBnNow,
    },
  );
  pushCandidate(
    "legacy_hl_funding_shadow",
    hlLegacyFundingNeg,
    `legacyHL=${fmtPct(args.pulse.fdHlNow)}`,
    {
      hlLegacyFundingNeg,
      fdHlNow: args.pulse.fdHlNow,
    },
  );
  pushCandidate(
    "socket_hl_funding_shadow",
    hlSocketFundingNeg,
    `socketHL=${fmtPct(args.pulse.hlAssetFundingNow)}`,
    {
      hlSocketFundingNeg,
      hlAssetFundingNow: args.pulse.hlAssetFundingNow,
    },
  );
  pushCandidate(
    "socket_hl_pulse_2of4_shadow",
    hlPulseScore >= 2,
    `score=${hlPulseScore}/4; funding=${hlAnyFundingNeg}; sellPressure=${hlSellPressure}; oiUnwind=${hlOiUnwind}; askWall=${hlAskWall}`,
    {
      ...hlPulseComponents,
      hlPulseScore,
      hlTaker15m: args.pulse.hlTaker15m,
      hlTaker1h: args.pulse.hlTaker1h,
      hlAssetOi1hPct: args.pulse.hlAssetOi1hPct,
      hlAssetOi4hPct: args.pulse.hlAssetOi4hPct,
      oiHl4hPct: args.pulse.oiHl4hPct,
      hlObImbalance05: args.pulse.hlObImbalance05,
      hlObAskBid05Ratio: args.pulse.hlObAskBid05Ratio,
    },
  );
  pushCandidate(
    "socket_hl_pulse_3of4_shadow",
    hlPulseScore >= 3,
    `score=${hlPulseScore}/4; funding=${hlAnyFundingNeg}; sellPressure=${hlSellPressure}; oiUnwind=${hlOiUnwind}; askWall=${hlAskWall}`,
    {
      ...hlPulseComponents,
      hlPulseScore,
      hlTaker15m: args.pulse.hlTaker15m,
      hlTaker1h: args.pulse.hlTaker1h,
      hlAssetOi1hPct: args.pulse.hlAssetOi1hPct,
      hlAssetOi4hPct: args.pulse.hlAssetOi4hPct,
      oiHl4hPct: args.pulse.oiHl4hPct,
      hlObImbalance05: args.pulse.hlObImbalance05,
      hlObAskBid05Ratio: args.pulse.hlObAskBid05Ratio,
    },
  );

  const firedCandidates = candidates.filter(c => c.wouldBlock).map(c => c.name);
  const differentFromLiveGuard = candidates.some(c => c.wouldBlock !== args.liveGuard.blocked);

  return {
    ts: new Date(args.nowMs).toISOString(),
    timestamp: args.nowMs,
    source: "hedgeguy-bot",
    symbol: args.symbol,
    price: args.price,
    fired: firedCandidates.length > 0,
    firedCandidates,
    differentFromLiveGuard,
    candidates,
    liveGuard: args.liveGuard,
    ladder: ladderStats(args.positions, args.price, args.nowMs),
    addContext: {
      priceDropOk: args.priceDropOk,
      mode,
      minDepth: cfg.minDepth,
      fundingRateMax,
    },
    pulse: {
      fdByNow: args.pulse.fdByNow,
      fdBnNow: args.pulse.fdBnNow,
      fdHlNow: args.pulse.fdHlNow,
      hlAssetFundingNow: args.pulse.hlAssetFundingNow,
      oiBn4hPct: args.pulse.oiBn4hPct,
      oiHl4hPct: args.pulse.oiHl4hPct,
      hlAssetOi1hPct: args.pulse.hlAssetOi1hPct,
      hlAssetOi4hPct: args.pulse.hlAssetOi4hPct,
      hlTaker15m: args.pulse.hlTaker15m,
      hlTaker1h: args.pulse.hlTaker1h,
      hlTaker4h: args.pulse.hlTaker4h,
      hlTaker15mNetNotional: args.pulse.hlTaker15mNetNotional,
      hlTaker1hNetNotional: args.pulse.hlTaker1hNetNotional,
      hlObImbalance05: args.pulse.hlObImbalance05,
      hlObAskBid05Ratio: args.pulse.hlObAskBid05Ratio,
      hlObImbalance2: args.pulse.hlObImbalance2,
      hlObAskBid2Ratio: args.pulse.hlObAskBid2Ratio,
      hlObAgeSec: args.pulse.hlObAgeSec,
    },
  };
}

export function writeDeepAddStressShadowSignal(symbol: string, decision: DeepAddStressShadowDecision): void {
  const outPath = path.resolve(process.cwd(), "data", `${symbol}_deep_add_stress_shadow.jsonl`);
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(outPath, JSON.stringify(decision) + "\n");
}
