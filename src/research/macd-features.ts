/** Research-only MACD; explicit SMA seeds, null warmup, no truthiness on zero. */
import type { Candle } from "../fetch-candles";
export interface MacdValues { macdFastEma: number | null; macdSlowEma: number | null; macdLine: number | null; macdSignal: number | null; macdHist: number | null }
export const MACD_FORMULA_VERSION = "macd-ema-sma-seeds-v1";
export function computeMacdValues(cs: readonly Pick<Candle, "timestamp" | "close">[], interval: number, fast: number, slow: number, signal: number): MacdValues[] {
  if (!Number.isSafeInteger(interval) || interval <= 0 || 86400000 % interval
    || ![fast, slow, signal].every(x => Number.isSafeInteger(x) && x > 0) || fast >= slow)
    throw new Error("Invalid MACD interval/periods");
  const ema = (period: number) => {
    let count = 0, sum = 0, value: number | null = null;
    return (input: number): number | null => {
      if (value === null) { sum += input; count++; if (count === period) value = sum / period; }
      else value = value + 2 / (period + 1) * (input - value);
      if (!Number.isFinite(sum) || (value !== null && !Number.isFinite(value))) throw new Error("Unrepresentable MACD");
      return value;
    };
  };
  const fastEma = ema(fast), slowEma = ema(slow), signalEma = ema(signal);
  return cs.map((c, i) => {
    if (!Number.isSafeInteger(c.timestamp) || c.timestamp < 0 || c.timestamp % interval
      || (i > 0 && c.timestamp !== cs[i-1].timestamp + interval) || !Number.isFinite(c.close) || c.close <= 0)
      throw new Error("Invalid/gapped MACD close tape");
    const f = fastEma(c.close), s = slowEma(c.close), line = f === null || s === null ? null : f - s;
    const sig = line === null ? null : signalEma(line), hist = line === null || sig === null ? null : line - sig;
    if ([line, sig, hist].some(x => x !== null && !Number.isFinite(x))) throw new Error("Unrepresentable MACD");
    return { macdFastEma: f, macdSlowEma: s, macdLine: line, macdSignal: sig, macdHist: hist };
  });
}

