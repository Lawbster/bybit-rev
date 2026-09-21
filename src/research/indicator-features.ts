import type { Candle } from "../fetch-candles";

/** New research definitions, NOT replacements for rounded/live legacy gates. */
export const RESEARCH_FEATURE_FORMULA_VERSION = "research-features-v1-wilder-prior-rank";

export const RESEARCH_FEATURE_METADATA = Object.freeze({
  seedPolicy: "fixed-first-input-bar-no-gap-reseed",
  timestampConvention: "UTC source-bar start; final value is not available at start",
  rounding: "none",
  rsi14: { period: 14, firstValidIndex: 14, warmupBars: 15, units: "0..100",
    formula: "Wilder mean gains/losses; flat=50, gains-only=100, losses-only=0" },
  crsi: { firstValidIndex: 101, warmupBars: 102, units: "0..100",
    formula: "mean(RSI3(close), RSI2(streak), strict-less rank versus PRIOR100 simple returns)" },
  roc5: { period: 5, firstValidIndex: 5, warmupBars: 6, units: "percent",
    formula: "100 * (close / close[5 bars ago] - 1)" },
  atr14: { period: 14, firstValidIndex: 14, warmupBars: 15, units: "quote/base price",
    formula: "Wilder TR starting at bar1 with prior close; first value mean of TR1..14" },
  atrPct: { firstValidIndex: 14, warmupBars: 15, units: "percent",
    formula: "100 * ATR14 / current close" },
  adx14: { period: 14, firstValidIndex: 27, warmupBars: 28, units: "0..100",
    formula: "Wilder mean of DX; first value mean of DX14..27; zero DI sum gives DX0" },
  plusDI14: { period: 14, firstValidIndex: 14, warmupBars: 15, units: "0..100",
    formula: "100 * Wilder(+DM) / Wilder(TR); tied directional moves excluded; zero TR gives0" },
  minusDI14: { period: 14, firstValidIndex: 14, warmupBars: 15, units: "0..100",
    formula: "100 * Wilder(-DM) / Wilder(TR); tied directional moves excluded; zero TR gives0" },
  vwapUtcDay: { units: "quote/base price", warmupBars: null,
    formula: "sum(actual turnover) / sum(base volume), complete UTC-day prefix from00:00 required" },
  rvol20: { period: 20, firstValidIndex: 20, warmupBars: 21, units: "ratio",
    formula: "current volume / mean(PRIOR20 volumes); zero prior mean gives null" },
} as const);

export interface ResearchFeature {
  timestamp: number;
  rsi14: number | null;
  crsi: number | null;
  roc5: number | null;
  atr14: number | null;
  atrPct: number | null;
  adx14: number | null;
  plusDI14: number | null;
  minusDI14: number | null;
  vwapUtcDay: number | null;
  rvol20: number | null;
}

const DAY_MS = 86_400_000;

/** First period observations seed a simple mean; later observations use 1/N. */
class WilderMean {
  private count = 0;
  private sum = 0;
  private value: number | null = null;

  constructor(private readonly period: number) {}

  next(observation: number): number | null {
    if (this.value === null) {
      this.sum += observation;
      if (++this.count === this.period) this.value = this.sum / this.period;
    } else {
      this.value = (this.value * (this.period - 1) + observation) / this.period;
    }
    return this.value;
  }
}

class WilderRsi {
  private previous: number | null = null;
  private readonly gains: WilderMean;
  private readonly losses: WilderMean;

  constructor(period: number) {
    this.gains = new WilderMean(period);
    this.losses = new WilderMean(period);
  }

  next(value: number): number | null {
    const previous = this.previous;
    this.previous = value;
    if (previous === null) return null;
    const change = value - previous;
    const gain = this.gains.next(Math.max(change, 0));
    const loss = this.losses.next(Math.max(-change, 0));
    if (gain === null || loss === null) return null;
    if (gain === 0 && loss === 0) return 50;
    if (loss === 0) return 100;
    if (gain === 0) return 0;
    return 100 - 100 / (1 + gain / loss);
  }
}

function validate(candles: readonly Readonly<Candle>[], intervalMs: number): void {
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0 || DAY_MS % intervalMs !== 0) {
    throw new Error("Research feature interval must be a positive integer divisor of one UTC day");
  }
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!Number.isSafeInteger(c.timestamp) || c.timestamp < 0 || c.timestamp % intervalMs !== 0
        || !Number.isSafeInteger(c.timestamp + intervalMs)) {
      throw new Error(`Invalid UTC interval-aligned timestamp at bar ${i}`);
    }
    if (![c.open, c.high, c.low, c.close].every(x => Number.isFinite(x) && x > 0)
        || ![c.volume, c.turnover].every(x => Number.isFinite(x) && x >= 0)
        || c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close)) {
      throw new Error(`Invalid OHLCV at ${c.timestamp}`);
    }
    if (i > 0 && c.timestamp !== candles[i - 1].timestamp + intervalMs) {
      throw new Error(`Non-contiguous, duplicate or unordered feature bars at ${c.timestamp}`);
    }
  }
}

/**
 * Pure, unrounded feature math on a fixed, contiguous FINAL candle prefix.
 * Returns one row per input bar, including null values during feature warmup.
 * The first input bar fixes recursive initialization; do not slide/reseed it
 * between evaluations. Gaps are rejected, never bridged or silently reseeded.
 *
 * This batch function is NOT an as-of lookup: timestamp is the bar START.
 * Callers must use the closed-bar timing layer to establish the latest eligible
 * closed bar and availability of every dependency since the fixed seed. Future
 * archived rows may be precomputed, but may not be joined to earlier decisions.
 * No quote/typical-price VWAP approximation and no rounded legacy indicator
 * implementation is imported. Volume and turnover must use one venue's base
 * and quote units respectively. Non-UTC sessions need a different definition.
 */
export function computeResearchFeatures(
  candles: readonly Readonly<Candle>[], intervalMs: number,
): ResearchFeature[] {
  validate(candles, intervalMs);
  const rsi14 = new WilderRsi(14);
  const rsi3 = new WilderRsi(3);
  const streakRsi2 = new WilderRsi(2);
  const tr14 = new WilderMean(14);
  const plusDm14 = new WilderMean(14);
  const minusDm14 = new WilderMean(14);
  const dx14 = new WilderMean(14);
  const returns: number[] = [];
  const output: ResearchFeature[] = [];
  let streak = 0;
  let dayStart: number | null = null;
  let dayComplete = false;
  let dayVolume = 0;
  let dayTurnover = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const previous = i > 0 ? candles[i - 1] : null;
    let atr: number | null = null;
    let plusDi: number | null = null;
    let minusDi: number | null = null;
    let adx: number | null = null;
    if (previous) {
      const change = c.close - previous.close;
      streak = change > 0 ? Math.max(streak, 0) + 1
        : change < 0 ? Math.min(streak, 0) - 1 : 0;
      const tr = Math.max(c.high - c.low, Math.abs(c.high - previous.close),
        Math.abs(c.low - previous.close));
      const up = c.high - previous.high;
      const down = previous.low - c.low;
      atr = tr14.next(tr);
      const plusDm = plusDm14.next(up > 0 && up > down ? up : 0);
      const minusDm = minusDm14.next(down > 0 && down > up ? down : 0);
      if (atr !== null && plusDm !== null && minusDm !== null) {
        plusDi = atr === 0 ? 0 : 100 * plusDm / atr;
        minusDi = atr === 0 ? 0 : 100 * minusDm / atr;
        const sumDi = plusDi + minusDi;
        adx = dx14.next(sumDi === 0 ? 0 : 100 * Math.abs(plusDi - minusDi) / sumDi);
      }
    }

    const rsi = rsi14.next(c.close);
    const shortRsi = rsi3.next(c.close);
    const streakRsi = streakRsi2.next(streak);
    let crsi: number | null = null;
    if (previous) {
      const currentReturn = c.close / previous.close - 1;
      // Before appending return i, indexes [length-100,length) are the 100
      // preceding returns. The current return is never in its own comparison.
      if (returns.length >= 100 && shortRsi !== null && streakRsi !== null) {
        let lower = 0;
        for (let j = returns.length - 100; j < returns.length; j++) {
          if (returns[j] < currentReturn) lower++;
        }
        crsi = (shortRsi + streakRsi + lower) / 3; // lower / 100 * 100 = percent rank
      }
      returns.push(currentReturn);
    }

    const currentDay = Math.floor(c.timestamp / DAY_MS) * DAY_MS;
    if (dayStart !== currentDay) {
      dayStart = currentDay;
      dayComplete = c.timestamp === currentDay;
      dayVolume = 0;
      dayTurnover = 0;
    }
    dayVolume += c.volume;
    dayTurnover += c.turnover;

    let rvol: number | null = null;
    if (i >= 20) {
      let priorVolume = 0;
      for (let j = i - 20; j < i; j++) priorVolume += candles[j].volume;
      if (priorVolume > 0) rvol = c.volume / (priorVolume / 20);
    }

    const row: ResearchFeature = {
      timestamp: c.timestamp,
      rsi14: rsi,
      crsi,
      roc5: i >= 5 ? 100 * (c.close / candles[i - 5].close - 1) : null,
      atr14: atr,
      atrPct: atr === null ? null : 100 * atr / c.close,
      adx14: adx,
      plusDI14: plusDi,
      minusDI14: minusDi,
      vwapUtcDay: dayComplete && dayVolume > 0 ? dayTurnover / dayVolume : null,
      rvol20: rvol,
    };
    if (Object.values(row).some(value => value !== null && !Number.isFinite(value))) {
      throw new Error(`Non-finite research feature at ${c.timestamp}`);
    }
    output.push(row);
  }
  return output;
}
