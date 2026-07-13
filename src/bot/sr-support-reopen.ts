import fs from "fs";
import path from "path";
import type { OnChainFeatures } from "./shadow-logger";
import type { SRMemoryZoneHit } from "./sr-memory-zones";

export const SR_SUPPORT_REOPEN_CANDIDATE = "zone30_hl_support_reopen_buy_pressure";

export const SR_SUPPORT_REOPEN_POLICY = {
  takerBuyRatioMin: 1.20,
  bidImbalanceMin: 0.20,
  askBidRatioMax: 0.75,
  oi1hExpansionMinPct: 0.25,
  oi4hExpansionMinPct: 0.75,
} as const;

export interface SRSupportReopenActionConfig {
  enabled: boolean;
  minNextDepth: number;
  supportBufferPct: number;
  maxOrderBookAgeSec: number;
  maxTakerAgeSec: number;
  minTaker15mSamples: number;
  minTaker1hSamples: number;
  maxAssetAgeSec: number;
  maxAssetAnchorLagSec: number;
}

export interface HLSupportConfirmation {
  buyPressure: boolean;
  buyPressure15m: boolean;
  buyPressure1h: boolean;
  bidWall: boolean;
  oiExpansion: boolean;
  oiExpansion1h: boolean;
  oiExpansion4h: boolean;
}

export interface SRSupportReopenDecision {
  candidate: typeof SR_SUPPORT_REOPEN_CANDIDATE;
  eligible: boolean;
  blockers: string[];
  support: {
    price: number;
    distPct: number;
    touches: number;
    highTouches: number;
    lowTouches: number;
    confirmTs: number;
  } | null;
  context: {
    contextHealthy: boolean;
    liveGuardBlocked: boolean;
    liveGuardReasons: string[];
    fundingStressOnly: boolean;
    priceDropOk: boolean;
    nextDepth: number;
  };
  health: {
    orderBookFresh: boolean;
    taker15mHealthy: boolean;
    taker1hHealthy: boolean;
    assetNowFresh: boolean;
    asset1hAnchorFresh: boolean;
    asset4hAnchorFresh: boolean;
  };
  confirmation: HLSupportConfirmation;
  pulse: {
    hlTaker15m: number | null;
    hlTaker1h: number | null;
    hlTaker15mSamples: number;
    hlTaker1hSamples: number;
    hlTakerAgeSec: number | null;
    hlObImbalance05: number | null;
    hlObAskBid05Ratio: number | null;
    hlObAgeSec: number | null;
    hlAssetOi1hPct: number | null;
    hlAssetOi4hPct: number | null;
    hlAssetAgeSec: number | null;
    hlAsset1hAnchorLagSec: number | null;
    hlAsset4hAnchorLagSec: number | null;
  };
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Exact buy-pressure/bid-wall/OI-expansion discriminator used by the replay. */
export function evaluateHLSupportConfirmation(args: {
  hlTaker15m: number | null;
  hlTaker1h: number | null;
  hlObImbalance05: number | null;
  hlObAskBid05Ratio: number | null;
  hlAssetOi1hPct: number | null;
  hlAssetOi4hPct: number | null;
  allowTaker15m?: boolean;
  allowTaker1h?: boolean;
  allowOi1h?: boolean;
  allowOi4h?: boolean;
}): HLSupportConfirmation {
  const buyPressure15m = args.allowTaker15m !== false &&
    finite(args.hlTaker15m) && args.hlTaker15m >= SR_SUPPORT_REOPEN_POLICY.takerBuyRatioMin;
  const buyPressure1h = args.allowTaker1h !== false &&
    finite(args.hlTaker1h) && args.hlTaker1h >= SR_SUPPORT_REOPEN_POLICY.takerBuyRatioMin;
  const bidWall =
    (finite(args.hlObImbalance05) && args.hlObImbalance05 >= SR_SUPPORT_REOPEN_POLICY.bidImbalanceMin) ||
    (finite(args.hlObAskBid05Ratio) && args.hlObAskBid05Ratio <= SR_SUPPORT_REOPEN_POLICY.askBidRatioMax);
  const oiExpansion1h = args.allowOi1h !== false &&
    finite(args.hlAssetOi1hPct) && args.hlAssetOi1hPct >= SR_SUPPORT_REOPEN_POLICY.oi1hExpansionMinPct;
  const oiExpansion4h = args.allowOi4h !== false &&
    finite(args.hlAssetOi4hPct) && args.hlAssetOi4hPct >= SR_SUPPORT_REOPEN_POLICY.oi4hExpansionMinPct;
  return {
    buyPressure: buyPressure15m || buyPressure1h,
    buyPressure15m,
    buyPressure1h,
    bidWall,
    oiExpansion: oiExpansion1h || oiExpansion4h,
    oiExpansion1h,
    oiExpansion4h,
  };
}

export function evaluateSRSupportReopen(args: {
  contextHealthy: boolean;
  liveGuardBlocked: boolean;
  liveGuardReasons: string[];
  fundingStressOnly: boolean;
  priceDropOk: boolean;
  nextDepth: number;
  support: SRMemoryZoneHit | null;
  pulse: OnChainFeatures;
  config: SRSupportReopenActionConfig;
}): SRSupportReopenDecision {
  const { pulse, config } = args;
  const orderBookFresh = finite(pulse.hlObAgeSec) && pulse.hlObAgeSec <= config.maxOrderBookAgeSec;
  const takerAgeFresh = finite(pulse.hlTakerAgeSec) && pulse.hlTakerAgeSec <= config.maxTakerAgeSec;
  const taker15mHealthy = takerAgeFresh &&
    (pulse.hlTaker15mSamples ?? 0) >= config.minTaker15mSamples;
  const taker1hHealthy = takerAgeFresh &&
    (pulse.hlTaker1hSamples ?? 0) >= config.minTaker1hSamples;
  const assetNowFresh = finite(pulse.hlAssetAgeSec) && pulse.hlAssetAgeSec <= config.maxAssetAgeSec;
  const asset1hAnchorFresh = assetNowFresh && finite(pulse.hlAsset1hAnchorLagSec) &&
    pulse.hlAsset1hAnchorLagSec <= config.maxAssetAnchorLagSec;
  const asset4hAnchorFresh = assetNowFresh && finite(pulse.hlAsset4hAnchorLagSec) &&
    pulse.hlAsset4hAnchorLagSec <= config.maxAssetAnchorLagSec;
  const confirmation = evaluateHLSupportConfirmation({
    hlTaker15m: pulse.hlTaker15m,
    hlTaker1h: pulse.hlTaker1h,
    hlObImbalance05: pulse.hlObImbalance05,
    hlObAskBid05Ratio: pulse.hlObAskBid05Ratio,
    hlAssetOi1hPct: pulse.hlAssetOi1hPct,
    hlAssetOi4hPct: pulse.hlAssetOi4hPct,
    allowTaker15m: taker15mHealthy,
    allowTaker1h: taker1hHealthy,
    allowOi1h: asset1hAnchorFresh,
    allowOi4h: asset4hAnchorFresh,
  });
  const supportDistPct = args.support ? args.support.dist * 100 : null;
  const blockers: string[] = [];
  if (!config.enabled) blockers.push("action_disabled");
  if (!args.contextHealthy) blockers.push("sr_context_unhealthy");
  if (!args.liveGuardBlocked) blockers.push("deep_stress_guard_not_blocking");
  if (!args.fundingStressOnly) blockers.push("deep_stress_not_funding_only");
  if (args.priceDropOk) blockers.push("not_time_only_add");
  if (args.nextDepth < config.minNextDepth) blockers.push("depth_below_minimum");
  if (!args.support) blockers.push("no_confirmed_support");
  else if (supportDistPct === null || supportDistPct > config.supportBufferPct) blockers.push("support_too_far");
  if (!orderBookFresh) blockers.push("hl_orderbook_unhealthy");
  if (!taker15mHealthy && !taker1hHealthy) blockers.push("hl_taker_unhealthy");
  if (!assetNowFresh || (!asset1hAnchorFresh && !asset4hAnchorFresh)) blockers.push("hl_asset_context_unhealthy");
  if (!confirmation.buyPressure) blockers.push("hl_buy_pressure_absent");
  if (!confirmation.bidWall) blockers.push("hl_bid_wall_absent");
  if (!confirmation.oiExpansion) blockers.push("hl_oi_expansion_absent");

  return {
    candidate: SR_SUPPORT_REOPEN_CANDIDATE,
    eligible: blockers.length === 0,
    blockers,
    support: args.support ? {
      price: args.support.lv.price,
      distPct: args.support.dist * 100,
      touches: args.support.lv.touches,
      highTouches: args.support.lv.highTouches,
      lowTouches: args.support.lv.lowTouches,
      confirmTs: args.support.lv.confirmTs,
    } : null,
    context: {
      contextHealthy: args.contextHealthy,
      liveGuardBlocked: args.liveGuardBlocked,
      liveGuardReasons: args.liveGuardReasons,
      fundingStressOnly: args.fundingStressOnly,
      priceDropOk: args.priceDropOk,
      nextDepth: args.nextDepth,
    },
    health: {
      orderBookFresh,
      taker15mHealthy,
      taker1hHealthy,
      assetNowFresh,
      asset1hAnchorFresh,
      asset4hAnchorFresh,
    },
    confirmation,
    pulse: {
      hlTaker15m: pulse.hlTaker15m,
      hlTaker1h: pulse.hlTaker1h,
      hlTaker15mSamples: pulse.hlTaker15mSamples ?? 0,
      hlTaker1hSamples: pulse.hlTaker1hSamples ?? 0,
      hlTakerAgeSec: pulse.hlTakerAgeSec ?? null,
      hlObImbalance05: pulse.hlObImbalance05,
      hlObAskBid05Ratio: pulse.hlObAskBid05Ratio,
      hlObAgeSec: pulse.hlObAgeSec,
      hlAssetOi1hPct: pulse.hlAssetOi1hPct,
      hlAssetOi4hPct: pulse.hlAssetOi4hPct,
      hlAssetAgeSec: pulse.hlAssetAgeSec ?? null,
      hlAsset1hAnchorLagSec: pulse.hlAsset1hAnchorLagSec ?? null,
      hlAsset4hAnchorLagSec: pulse.hlAsset4hAnchorLagSec ?? null,
    },
  };
}

export function writeSRSupportReopenEvent(symbol: string, row: Record<string, unknown>): void {
  try {
    const outPath = path.resolve(process.cwd(), "data", `${symbol}_sr_support_reopen_actions.jsonl`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.appendFileSync(outPath, JSON.stringify(row) + "\n");
  } catch {
    // Best-effort action telemetry must never affect order flow.
  }
}
