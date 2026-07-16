export const HL_SHORT_BREAKDOWN_POLICY_VERSION = 1 as const;
export const HL_SHORT_BREAKDOWN_CANDIDATE = "hl_bid_pull_break";
export const HL_SHORT_BREAKDOWN_POLICY = Object.freeze({
  decisionIntervalMs: 15 * 60_000,
  minimumReturn15mPct: -0.20,
  maximumHlTaker15mRatio: 0.90,
  maximumHlBook5mImbalance: -0.05,
  maximumHlBookDelta: -0.15,
  minimumTakerMinutes: 12,
  minimumBookMinutes: 12,
  maximumAssetAgeMs: 3 * 60_000,
  rawSignalCooldownMs: 60 * 60_000,
  takeProfitPct: 2,
  stopLossPct: 4,
  maximumHoldMs: 12 * 60 * 60_000,
  baseRoundTripFeePct: 0.11,
  stressRoundTripFeePct: 0.20,
});

export const HL_SHORT_BREAKDOWN_POLICY_SIGNATURE = [
  HL_SHORT_BREAKDOWN_CANDIDATE,
  `v${HL_SHORT_BREAKDOWN_POLICY_VERSION}`,
  `ret<=${HL_SHORT_BREAKDOWN_POLICY.minimumReturn15mPct}`,
  `taker<${HL_SHORT_BREAKDOWN_POLICY.maximumHlTaker15mRatio}`,
  `ob5<${HL_SHORT_BREAKDOWN_POLICY.maximumHlBook5mImbalance}`,
  `obDelta<${HL_SHORT_BREAKDOWN_POLICY.maximumHlBookDelta}`,
  `tp${HL_SHORT_BREAKDOWN_POLICY.takeProfitPct}`,
  `sl${HL_SHORT_BREAKDOWN_POLICY.stopLossPct}`,
  `hold${HL_SHORT_BREAKDOWN_POLICY.maximumHoldMs}`,
].join("|");

export interface HlShortMinuteCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface HlShortTakerMinute {
  timestamp: number;
  buyNotional: number;
  sellNotional: number;
}

export interface HlShortBookSample {
  timestamp: number;
  imbalance05: number;
}

export interface HlShortAssetSample {
  timestamp: number;
}

export interface HlShortBreakdownFeatures {
  decisionTs: number;
  candidate: typeof HL_SHORT_BREAKDOWN_CANDIDATE;
  policyVersion: typeof HL_SHORT_BREAKDOWN_POLICY_VERSION;
  ready: boolean;
  fired: boolean;
  blockers: string[];
  price: {
    current15mOpen: number | null;
    current15mClose: number | null;
    previous15mLow: number | null;
    return15mPct: number | null;
    red15m: boolean;
    brokePrevious15mLow: boolean;
    continuousMinutes: number;
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

export interface HlShortBreakdownFeaturePolicyInput {
  priceReady: boolean;
  red15m: boolean;
  brokePrevious15mLow: boolean;
  return15mPct: number | null;
  hlTaker15mRatio: number | null;
  hlTakerMinutes: number;
  hlBook5mImbalance: number | null;
  hlBookPrior10mImbalance: number | null;
  hlBookDelta: number | null;
  hlBookMinutes: number;
  assetAgeMs: number | null;
}

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

export function evaluateHlShortBreakdownFeaturePolicy(
  input: HlShortBreakdownFeaturePolicyInput,
): { ready: boolean; fired: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!input.priceReady) blockers.push("price_coverage_incomplete");
  if (input.hlTakerMinutes < HL_SHORT_BREAKDOWN_POLICY.minimumTakerMinutes) blockers.push("hl_taker_coverage_incomplete");
  if (input.hlBookMinutes < HL_SHORT_BREAKDOWN_POLICY.minimumBookMinutes) blockers.push("hl_book_coverage_incomplete");
  if (!finite(input.assetAgeMs) || input.assetAgeMs > HL_SHORT_BREAKDOWN_POLICY.maximumAssetAgeMs) blockers.push("hl_asset_context_stale");
  const ready = blockers.length === 0;

  if (!input.red15m) blockers.push("not_red_15m");
  if (!input.brokePrevious15mLow) blockers.push("did_not_break_previous_15m_low");
  if (!finite(input.return15mPct) || input.return15mPct > HL_SHORT_BREAKDOWN_POLICY.minimumReturn15mPct) blockers.push("return_15m_not_weak_enough");
  if (!finite(input.hlTaker15mRatio) || input.hlTaker15mRatio >= HL_SHORT_BREAKDOWN_POLICY.maximumHlTaker15mRatio) blockers.push("hl_taker_not_sell_dominant");
  if (!finite(input.hlBook5mImbalance) || input.hlBook5mImbalance >= HL_SHORT_BREAKDOWN_POLICY.maximumHlBook5mImbalance) blockers.push("hl_book_5m_not_ask_heavy");
  if (!finite(input.hlBookDelta) || input.hlBookDelta >= HL_SHORT_BREAKDOWN_POLICY.maximumHlBookDelta) blockers.push("hl_book_not_deteriorating");
  return { ready, fired: ready && blockers.length === 0, blockers };
}

function minuteMap(candles: HlShortMinuteCandle[]): Map<number, HlShortMinuteCandle> {
  const out = new Map<number, HlShortMinuteCandle>();
  for (const candle of candles) out.set(candle.timestamp, candle);
  return out;
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

export function computeHlShortBreakdownFeatures(args: {
  decisionTs: number;
  candles: HlShortMinuteCandle[];
  taker: HlShortTakerMinute[];
  book: HlShortBookSample[];
  asset: HlShortAssetSample[];
}): HlShortBreakdownFeatures {
  const { decisionTs } = args;
  const candles = minuteMap(args.candles);
  const required: HlShortMinuteCandle[] = [];
  for (let ts = decisionTs - 30 * 60_000; ts < decisionTs; ts += 60_000) {
    const candle = candles.get(ts);
    if (candle) required.push(candle);
  }
  const current15m = required.filter(row => row.timestamp >= decisionTs - 15 * 60_000);
  const previous15m = required.filter(row => row.timestamp < decisionTs - 15 * 60_000);
  const returnAnchor = candles.get(decisionTs - 16 * 60_000);
  const currentOpen = current15m.length === 15 ? current15m[0].open : null;
  const currentClose = current15m.length === 15 ? current15m[14].close : null;
  const previousLow = previous15m.length === 15 ? Math.min(...previous15m.map(row => row.low)) : null;
  const return15mPct = currentClose !== null && returnAnchor && returnAnchor.close !== 0
    ? ((currentClose - returnAnchor.close) / returnAnchor.close) * 100
    : null;
  const red15m = currentOpen !== null && currentClose !== null && currentClose < currentOpen;
  const brokePrevious15mLow = currentClose !== null && previousLow !== null && currentClose < previousLow;

  // The timestamp is the collector's availability boundary. A row stamped at
  // decisionTs is excluded even when its exchangeTimestamp is slightly earlier.
  const taker = completedMinuteRange(args.taker, decisionTs - 15 * 60_000, decisionTs);
  const takerBuy = taker.reduce((sum, row) => sum + row.buyNotional, 0);
  const takerSell = taker.reduce((sum, row) => sum + row.sellNotional, 0);
  const hlTaker15mRatio = takerSell > 0 ? takerBuy / takerSell : null;

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
  const policy = evaluateHlShortBreakdownFeaturePolicy({
    priceReady: required.length === 30 && current15m.length === 15 && previous15m.length === 15,
    red15m,
    brokePrevious15mLow,
    return15mPct,
    hlTaker15mRatio,
    hlTakerMinutes: new Set(taker.map(row => row.timestamp)).size,
    hlBook5mImbalance,
    hlBookPrior10mImbalance,
    hlBookDelta,
    hlBookMinutes: bookMinutes.size,
    assetAgeMs,
  });

  return {
    decisionTs,
    candidate: HL_SHORT_BREAKDOWN_CANDIDATE,
    policyVersion: HL_SHORT_BREAKDOWN_POLICY_VERSION,
    ...policy,
    price: {
      current15mOpen: currentOpen,
      current15mClose: currentClose,
      previous15mLow: previousLow,
      return15mPct,
      red15m,
      brokePrevious15mLow,
      continuousMinutes: required.length,
    },
    pulse: {
      hlTaker15mRatio,
      hlTakerMinutes: new Set(taker.map(row => row.timestamp)).size,
      hlBook5mImbalance,
      hlBookPrior10mImbalance,
      hlBookDelta,
      hlBookMinutes: bookMinutes.size,
      assetAgeMs,
    },
  };
}

export type HlShortShadowEntryMode = "decision_open" | "delay_1m_open";
export type HlShortShadowOutcome = "tp" | "stop" | "timeout";

export interface HlShortShadowPosition {
  mode: HlShortShadowEntryMode;
  entryTime: number;
  entryPrice: number;
  tpPrice: number;
  stopPrice: number;
  expiresAt: number;
  minPrice: number;
  maxPrice: number;
  lastProcessedCandleTs: number | null;
}

export interface HlShortShadowClose {
  mode: HlShortShadowEntryMode;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  outcome: HlShortShadowOutcome;
  grossPnlPct: number;
  pnlPctAfterFees: number;
  pnlPctStressFees: number;
  maePct: number;
  mfePct: number;
  holdMinutes: number;
}

export function createHlShortShadowPosition(
  mode: HlShortShadowEntryMode,
  entryTime: number,
  entryPrice: number,
): HlShortShadowPosition {
  return {
    mode,
    entryTime,
    entryPrice,
    tpPrice: entryPrice * (1 - HL_SHORT_BREAKDOWN_POLICY.takeProfitPct / 100),
    stopPrice: entryPrice * (1 + HL_SHORT_BREAKDOWN_POLICY.stopLossPct / 100),
    expiresAt: entryTime + HL_SHORT_BREAKDOWN_POLICY.maximumHoldMs,
    minPrice: entryPrice,
    maxPrice: entryPrice,
    lastProcessedCandleTs: null,
  };
}

export function advanceHlShortShadowPosition(
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
      pnlPctAfterFees: grossPnlPct - HL_SHORT_BREAKDOWN_POLICY.baseRoundTripFeePct,
      pnlPctStressFees: grossPnlPct - HL_SHORT_BREAKDOWN_POLICY.stressRoundTripFeePct,
      maePct: ((next.maxPrice - position.entryPrice) / position.entryPrice) * 100,
      mfePct: ((position.entryPrice - next.minPrice) / position.entryPrice) * 100,
      holdMinutes: (candleEnd - position.entryTime) / 60_000,
    },
  };
}
