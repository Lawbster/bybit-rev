import {
  RSI, MACD, BollingerBands, EMA, SMA, ATR, Stochastic,
  OBV, VWAP, CCI, ADX, ROC, StochasticRSI, WilliamsR,
  CrossUp, CrossDown,
} from "technicalindicators";
import { Candle } from "./fetch-candles";

export interface IndicatorSnapshot {
  timestamp: number;
  price: number;
  // Trend
  ema9: number;
  ema21: number;
  ema50: number;
  sma200: number;
  emaTrend: "bull" | "bear" | "neutral"; // ema9 vs ema21
  priceVsEma50: number;  // % above/below ema50
  // Momentum
  rsi14: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  stochK: number;
  stochD: number;
  williamsR: number;
  roc5: number;   // 5-period rate of change
  roc20: number;
  // Volatility
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  bbWidth: number;       // (upper-lower)/middle as %
  bbPosition: number;    // where price sits in BB (0=lower, 1=upper)
  atr14: number;
  atrPercent: number;    // atr as % of price
  // Volume
  volumeRatio: number;   // current vol / 20-period avg vol
  obvSlope: number;      // OBV change over 5 periods
  // Price action
  candleBody: number;    // (close-open)/open as %
  upperWick: number;     // upper wick as % of candle range
  lowerWick: number;     // lower wick as % of candle range
  priceChange5: number;  // % change over last 5 candles
  priceChange20: number; // % change over last 20 candles
}

/**
 * Compute all indicators for the full candle series.
 * Returns a map of timestamp → snapshot for O(1) lookup.
 */
export function computeIndicators(candles: Candle[]): Map<number, IndicatorSnapshot> {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const opens = candles.map((c) => c.open);

  // Pre-compute all indicator series
  const ema9 = EMA.calculate({ period: 9, values: closes });
  const ema21 = EMA.calculate({ period: 21, values: closes });
  const ema50 = EMA.calculate({ period: 50, values: closes });
  const sma200 = SMA.calculate({ period: 200, values: closes });

  const rsi14 = RSI.calculate({ period: 14, values: closes });

  const macd = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const stoch = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
    signalPeriod: 3,
  });

  const bb = BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2,
  });

  const atr = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });

  const willR = WilliamsR.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes,
  });

  const roc5 = ROC.calculate({ period: 5, values: closes });
  const roc20 = ROC.calculate({ period: 20, values: closes });

  const obv = OBV.calculate({ close: closes, volume: volumes });

  // Volume moving average (20-period)
  const volSma20 = SMA.calculate({ period: 20, values: volumes });

  // Build the map — align by index offset
  // Each indicator starts at a different index depending on its period
  const n = candles.length;
  const result = new Map<number, IndicatorSnapshot>();

  // Offsets (indicator array is shorter than candles by period-1)
  const off = {
    ema9: n - ema9.length,
    ema21: n - ema21.length,
    ema50: n - ema50.length,
    sma200: n - sma200.length,
    rsi14: n - rsi14.length,
    macd: n - macd.length,
    stoch: n - stoch.length,
    bb: n - bb.length,
    atr: n - atr.length,
    willR: n - willR.length,
    roc5: n - roc5.length,
    roc20: n - roc20.length,
    obv: n - obv.length,
    volSma20: n - volSma20.length,
  };

  // Start from where all indicators are available
  const startIdx = Math.max(...Object.values(off));

  for (let i = startIdx; i < n; i++) {
    const c = candles[i];
    const bbVal = bb[i - off.bb];
    const macdVal = macd[i - off.macd];
    const stochVal = stoch[i - off.stoch];
    const atrVal = atr[i - off.atr];
    const ema9Val = ema9[i - off.ema9];
    const ema21Val = ema21[i - off.ema21];
    const ema50Val = ema50[i - off.ema50];

    const range = c.high - c.low;
    const body = Math.abs(c.close - c.open);

    const obvIdx = i - off.obv;
    const obvSlope = obvIdx >= 5
      ? obv[obvIdx] - obv[obvIdx - 5]
      : 0;

    const volIdx = i - off.volSma20;
    const volRatio = volSma20[volIdx] > 0 ? c.volume / volSma20[volIdx] : 1;

    result.set(c.timestamp, {
      timestamp: c.timestamp,
      price: c.close,
      // Trend
      ema9: ema9Val,
      ema21: ema21Val,
      ema50: ema50Val,
      sma200: sma200[i - off.sma200],
      emaTrend: ema9Val > ema21Val ? "bull" : ema9Val < ema21Val ? "bear" : "neutral",
      priceVsEma50: ((c.close - ema50Val) / ema50Val) * 100,
      // Momentum
      rsi14: rsi14[i - off.rsi14],
      macdLine: macdVal.MACD ?? 0,
      macdSignal: macdVal.signal ?? 0,
      macdHist: macdVal.histogram ?? 0,
      stochK: stochVal.k,
      stochD: stochVal.d,
      williamsR: willR[i - off.willR],
      roc5: roc5[i - off.roc5],
      roc20: roc20[i - off.roc20],
      // Volatility
      bbUpper: bbVal.upper,
      bbMiddle: bbVal.middle,
      bbLower: bbVal.lower,
      bbWidth: ((bbVal.upper - bbVal.lower) / bbVal.middle) * 100,
      bbPosition: bbVal.upper !== bbVal.lower
        ? (c.close - bbVal.lower) / (bbVal.upper - bbVal.lower)
        : 0.5,
      atr14: atrVal,
      atrPercent: (atrVal / c.close) * 100,
      // Volume
      volumeRatio: volRatio,
      obvSlope,
      // Price action
      candleBody: ((c.close - c.open) / c.open) * 100,
      upperWick: range > 0 ? (c.high - Math.max(c.open, c.close)) / range : 0,
      lowerWick: range > 0 ? (Math.min(c.open, c.close) - c.low) / range : 0,
      priceChange5: i >= 5 ? ((c.close - candles[i - 5].close) / candles[i - 5].close) * 100 : 0,
      priceChange20: i >= 20 ? ((c.close - candles[i - 20].close) / candles[i - 20].close) * 100 : 0,
    });
  }

  return result;
}

/**
 * Compute the latest RSI value from a closes array.
 * Returns null if not enough data.
 */
export function computeRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const values = RSI.calculate({ period, values: closes });
  return values.length > 0 ? values[values.length - 1] : null;
}

/**
 * Compute the latest ROC value from a closes array.
 * Returns null if not enough data.
 */
export function computeRoc(closes: number[], period = 5): number | null {
  if (closes.length < period + 1) return null;
  const values = ROC.calculate({ period, values: closes });
  return values.length > 0 ? values[values.length - 1] : null;
}

/**
 * Find the closest indicator snapshot to a given timestamp.
 */
export function getSnapshotAt(
  indicators: Map<number, IndicatorSnapshot>,
  targetMs: number,
  candleIntervalMs: number = 300000, // 5m default
): IndicatorSnapshot | null {
  // Round down to nearest candle
  const aligned = Math.floor(targetMs / candleIntervalMs) * candleIntervalMs;

  // Try exact, then nearby
  for (const offset of [0, -candleIntervalMs, candleIntervalMs, -2 * candleIntervalMs]) {
    const snap = indicators.get(aligned + offset);
    if (snap) return snap;
  }
  return null;
}
