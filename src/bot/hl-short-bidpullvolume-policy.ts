import type {
  HlShortAssetSample,
  HlShortBookSample,
  HlShortMinuteCandle,
  HlShortShadowClose,
  HlShortShadowEntryMode,
  HlShortShadowOutcome,
  HlShortShadowPosition,
  HlShortTakerMinute,
} from "./hl-short-breakdown-policy";

// Frozen research candidate from the 2026-07-16 short-system study, refreshed
// 2026-08-10 (research/codex-hl-short-system-refresh-2026-08-10.md, rank 3,
// FORWARD SHADOW). Exact source definition, scripts/hype-custom-hl-short-study.ts:
//   healthy && hlObDelta < -0.15 && volumeRatio15 > 1.25 && red15 && hlTaker15 < 0.90
// with train-selected exit S_tp1.5_sl4_h4 and a 60m raw-signal cooldown.
// Observation only: this candidate has no live order path and must never share
// the hl_bid_pull_break journal, candidate id, or signal id namespace.
export const HL_SHORT_BIDPULLVOLUME_POLICY_VERSION = 1 as const;
export const HL_SHORT_BIDPULLVOLUME_CANDIDATE = "hl_bid_pull_volume";
export const HL_SHORT_BIDPULLVOLUME_POLICY = Object.freeze({
  decisionIntervalMs: 15 * 60_000,
  maximumHlBookDelta: -0.15,
  minimumVolumeRatio15: 1.25,
  maximumHlTaker15mRatio: 0.90,
  minimumTakerMinutes: 12,
  minimumBookMinutes: 12,
  maximumAssetAgeMs: 3 * 60_000,
  // The study's volume baseline is the mean of the prior 96 completed 15m bars
  // (24h). Live evaluation fails closed unless the full baseline is present.
  volumeBaselineBars: 96,
  rawSignalCooldownMs: 60 * 60_000,
  takeProfitPct: 1.5,
  stopLossPct: 4,
  maximumHoldMs: 4 * 60 * 60_000,
  baseRoundTripFeePct: 0.11,
  stressRoundTripFeePct: 0.20,
});

export const HL_SHORT_BIDPULLVOLUME_POLICY_SIGNATURE = [
  HL_SHORT_BIDPULLVOLUME_CANDIDATE,
  `v${HL_SHORT_BIDPULLVOLUME_POLICY_VERSION}`,
  `obDelta<${HL_SHORT_BIDPULLVOLUME_POLICY.maximumHlBookDelta}`,
  `vol15>${HL_SHORT_BIDPULLVOLUME_POLICY.minimumVolumeRatio15}`,
  "red15",
  `taker<${HL_SHORT_BIDPULLVOLUME_POLICY.maximumHlTaker15mRatio}`,
  `tp${HL_SHORT_BIDPULLVOLUME_POLICY.takeProfitPct}`,
  `sl${HL_SHORT_BIDPULLVOLUME_POLICY.stopLossPct}`,
  `hold${HL_SHORT_BIDPULLVOLUME_POLICY.maximumHoldMs}`,
].join("|");

export interface HlShortBidPullVolumeFeatures {
  decisionTs: number;
  candidate: typeof HL_SHORT_BIDPULLVOLUME_CANDIDATE;
  policyVersion: typeof HL_SHORT_BIDPULLVOLUME_POLICY_VERSION;
  ready: boolean;
  fired: boolean;
  blockers: string[];
  price: {
    current15mOpen: number | null;
    current15mClose: number | null;
    red15m: boolean;
    current15mVolume: number | null;
    baselineMeanVolume15m: number | null;
    volumeRatio15: number | null;
    currentBarMinutes: number;
    baselineMinutes: number;
  };
  pulse: {
    hlTaker15mRatio: number | null;
    hlTakerMinutes: number;
    hlBook5mImbalance: number | null;
    hlBookPrior10mImbalance: number | null;
    hlBookDelta: number | null;
    hlBookMinutes: number;
    assetAgeMs: number | null;
  };
}

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function completedMinuteRange<T extends { timestamp: number }>(rows: T[], start: number, end: number): T[] {
  return rows.filter(row => row.timestamp >= start && row.timestamp < end);
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function aggregateBookMinutes(samples: HlShortBookSample[], start: number, end: number): Map<number, number> {
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const sample of completedMinuteRange(samples, start, end)) {
    const minute = Math.floor(sample.timestamp / 60_000) * 60_000;
    const current = buckets.get(minute) ?? { sum: 0, count: 0 };
    current.sum += sample.imbalance05;
    current.count++;
    buckets.set(minute, current);
  }
  return new Map([...buckets].map(([minute, bucket]) => [minute, bucket.sum / bucket.count]));
}

export function computeHlShortBidPullVolumeFeatures(args: {
  decisionTs: number;
  candles: HlShortMinuteCandle[];
  taker: HlShortTakerMinute[];
  book: HlShortBookSample[];
  asset: HlShortAssetSample[];
}): HlShortBidPullVolumeFeatures {
  const { decisionTs } = args;
  const policy = HL_SHORT_BIDPULLVOLUME_POLICY;
  const candleByTs = new Map(args.candles.map(candle => [candle.timestamp, candle]));

  const currentBar: HlShortMinuteCandle[] = [];
  for (let ts = decisionTs - 15 * 60_000; ts < decisionTs; ts += 60_000) {
    const candle = candleByTs.get(ts);
    if (candle && finite(candle.volume)) currentBar.push(candle);
  }
  const currentOpen = currentBar.length === 15 ? currentBar[0].open : null;
  const currentClose = currentBar.length === 15 ? currentBar[14].close : null;
  const red15m = currentOpen !== null && currentClose !== null && currentClose < currentOpen;
  const currentVolume = currentBar.length === 15
    ? currentBar.reduce((sum, candle) => sum + (candle.volume as number), 0)
    : null;

  // Baseline window covers the 96 completed 15m bars immediately preceding the
  // current bar: [decisionTs - 15m - 96*15m, decisionTs - 15m).
  const baselineStart = decisionTs - (policy.volumeBaselineBars + 1) * 15 * 60_000;
  const baselineEnd = decisionTs - 15 * 60_000;
  let baselineMinutes = 0;
  let baselineVolume = 0;
  for (let ts = baselineStart; ts < baselineEnd; ts += 60_000) {
    const candle = candleByTs.get(ts);
    if (candle && finite(candle.volume)) {
      baselineMinutes++;
      baselineVolume += candle.volume as number;
    }
  }
  const baselineComplete = baselineMinutes === policy.volumeBaselineBars * 15;
  const baselineMeanVolume = baselineComplete ? baselineVolume / policy.volumeBaselineBars : null;
  const volumeRatio15 = currentVolume !== null && baselineMeanVolume !== null && baselineMeanVolume > 0
    ? currentVolume / baselineMeanVolume
    : null;

  // The timestamp is the collector's availability boundary. A row stamped at
  // decisionTs is excluded even when its exchangeTimestamp is slightly earlier.
  const taker = completedMinuteRange(args.taker, decisionTs - 15 * 60_000, decisionTs);
  const takerBuy = taker.reduce((sum, row) => sum + row.buyNotional, 0);
  const takerSell = taker.reduce((sum, row) => sum + row.sellNotional, 0);
  const hlTaker15mRatio = takerSell > 0 ? takerBuy / takerSell : null;
  const hlTakerMinutes = new Set(taker.map(row => row.timestamp)).size;

  const bookMinutes = aggregateBookMinutes(args.book, decisionTs - 15 * 60_000, decisionTs);
  const last5 = [...bookMinutes].filter(([ts]) => ts >= decisionTs - 5 * 60_000).map(([, value]) => value);
  const prior10 = [...bookMinutes].filter(([ts]) => ts < decisionTs - 5 * 60_000).map(([, value]) => value);
  const hlBook5mImbalance = average(last5);
  const hlBookPrior10mImbalance = average(prior10);
  const hlBookDelta = hlBook5mImbalance !== null && hlBookPrior10mImbalance !== null
    ? hlBook5mImbalance - hlBookPrior10mImbalance
    : null;
  const latestAsset = args.asset.filter(row => row.timestamp < decisionTs).sort((a, b) => b.timestamp - a.timestamp)[0];
  const assetAgeMs = latestAsset ? decisionTs - latestAsset.timestamp : null;

  const blockers: string[] = [];
  if (currentBar.length !== 15) blockers.push("price_coverage_incomplete");
  if (!baselineComplete) blockers.push("volume_baseline_incomplete");
  if (hlTakerMinutes < policy.minimumTakerMinutes) blockers.push("hl_taker_coverage_incomplete");
  if (bookMinutes.size < policy.minimumBookMinutes) blockers.push("hl_book_coverage_incomplete");
  if (!finite(assetAgeMs) || assetAgeMs > policy.maximumAssetAgeMs) blockers.push("hl_asset_context_stale");
  const ready = blockers.length === 0;

  if (!red15m) blockers.push("not_red_15m");
  if (!finite(volumeRatio15) || volumeRatio15 <= policy.minimumVolumeRatio15) blockers.push("volume_not_expanding");
  if (!finite(hlTaker15mRatio) || hlTaker15mRatio >= policy.maximumHlTaker15mRatio) blockers.push("hl_taker_not_sell_dominant");
  if (!finite(hlBookDelta) || hlBookDelta >= policy.maximumHlBookDelta) blockers.push("hl_book_not_deteriorating");
  const fired = ready && blockers.length === 0;

  return {
    decisionTs,
    candidate: HL_SHORT_BIDPULLVOLUME_CANDIDATE,
    policyVersion: HL_SHORT_BIDPULLVOLUME_POLICY_VERSION,
    ready,
    fired,
    blockers,
    price: {
      current15mOpen: currentOpen,
      current15mClose: currentClose,
      red15m,
      current15mVolume: currentVolume,
      baselineMeanVolume15m: baselineMeanVolume,
      volumeRatio15,
      currentBarMinutes: currentBar.length,
      baselineMinutes,
    },
    pulse: {
      hlTaker15mRatio,
      hlTakerMinutes,
      hlBook5mImbalance,
      hlBookPrior10mImbalance,
      hlBookDelta,
      hlBookMinutes: bookMinutes.size,
      assetAgeMs,
    },
  };
}

export function createHlShortBidPullVolumeShadowPosition(
  mode: HlShortShadowEntryMode,
  entryTime: number,
  entryPrice: number,
): HlShortShadowPosition {
  return {
    mode,
    entryTime,
    entryPrice,
    tpPrice: entryPrice * (1 - HL_SHORT_BIDPULLVOLUME_POLICY.takeProfitPct / 100),
    stopPrice: entryPrice * (1 + HL_SHORT_BIDPULLVOLUME_POLICY.stopLossPct / 100),
    expiresAt: entryTime + HL_SHORT_BIDPULLVOLUME_POLICY.maximumHoldMs,
    minPrice: entryPrice,
    maxPrice: entryPrice,
    lastProcessedCandleTs: null,
  };
}

export function advanceHlShortBidPullVolumeShadowPosition(
  position: HlShortShadowPosition,
  candle: HlShortMinuteCandle,
): { position: HlShortShadowPosition; close: HlShortShadowClose | null } {
  if (candle.timestamp < position.entryTime) return { position, close: null };
  if (position.lastProcessedCandleTs !== null && candle.timestamp <= position.lastProcessedCandleTs) return { position, close: null };
  const next: HlShortShadowPosition = {
    ...position,
    minPrice: Math.min(position.minPrice, candle.low),
    maxPrice: Math.max(position.maxPrice, candle.high),
    lastProcessedCandleTs: candle.timestamp,
  };
  const candleEnd = candle.timestamp + 60_000;
  let outcome: HlShortShadowOutcome | null = null;
  let exitPrice = candle.close;
  if (candle.high >= position.stopPrice) {
    outcome = "stop";
    exitPrice = position.stopPrice;
  } else if (candle.low <= position.tpPrice) {
    outcome = "tp";
    exitPrice = position.tpPrice;
  } else if (candleEnd >= position.expiresAt) {
    outcome = "timeout";
  }
  if (!outcome) return { position: next, close: null };
  const grossPnlPct = ((position.entryPrice - exitPrice) / position.entryPrice) * 100;
  return {
    position: next,
    close: {
      mode: position.mode,
      entryTime: position.entryTime,
      exitTime: candleEnd,
      entryPrice: position.entryPrice,
      exitPrice,
      outcome,
      grossPnlPct,
      pnlPctAfterFees: grossPnlPct - HL_SHORT_BIDPULLVOLUME_POLICY.baseRoundTripFeePct,
      pnlPctStressFees: grossPnlPct - HL_SHORT_BIDPULLVOLUME_POLICY.stressRoundTripFeePct,
      maePct: ((next.maxPrice - position.entryPrice) / position.entryPrice) * 100,
      mfePct: ((position.entryPrice - next.minPrice) / position.entryPrice) * 100,
      holdMinutes: (candleEnd - position.entryTime) / 60_000,
    },
  };
}
