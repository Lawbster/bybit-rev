/** Matched-sample market relationships and causal next-hour forecasts; no orders. */
import assert from "assert/strict";
import { HOUR as H, ols, type Hour } from "./relative-reversion-features";
export const SYMBOLS = ["HYPEUSDT", "BTCUSDT", "SOLUSDT"] as const;
export type SymbolName = typeof SYMBOLS[number];
export type Maps = Record<SymbolName, Map<number, number>>;
export const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export function correlation(x: number[], y: number[]): number | null {
  const fit = ols(x, y); return fit ? Math.sign(fit.slope) * Math.sqrt(fit.r2) : null;
}
export function commonMaps(rows: Record<SymbolName, Hour[]>): Maps {
  const maps = Object.fromEntries(SYMBOLS.map(s => [s, new Map(rows[s].map(x => [x.end, x.close]))])) as Maps;
  for (const s of SYMBOLS) assert.equal(maps[s].size, rows[s].length, "Duplicate hours");
  const times = [...maps.HYPEUSDT.keys()].filter(t => SYMBOLS.every(s => maps[s].has(t)));
  return Object.fromEntries(SYMBOLS.map(s => [s, new Map(times.map(t => [t, maps[s].get(t)!]))])) as Maps;
}
export function logReturn(m: Map<number, number>, end: number, span = 1): number | null {
  assert(Number.isSafeInteger(span) && span > 0);
  for (let k = 0; k <= span; k++) if (!m.has(end - k * H)) return null;
  return Math.log(m.get(end)! / m.get(end - span * H)!);
}
export interface Forecast {
  at: number; lag: number; sourceEnd: number; targetEnd: number; horizonHours: number;
  ready: boolean; trainingPairs: number; rollingMean: number | null;
  predicted: Record<SymbolName, number | null>; trainingEnd: number;
}
export function forecast(maps: Maps, at: number, lag: number): Forecast {
  assert(at % H === 0 && [0, 60000].includes(lag));
  const sourceEnd = Math.floor((at - lag) / H) * H, targetEnd = at + H, horizonHours = (targetEnd - sourceEnd) / H;
  const row: Forecast = { at, lag, sourceEnd, targetEnd, horizonHours, trainingEnd: sourceEnd,
    ready: false, trainingPairs: 0, rollingMean: null, predicted: { HYPEUSDT: null, BTCUSDT: null, SOLUSDT: null } };
  const y: number[] = [], xs: Record<SymbolName, number[]> = { HYPEUSDT: [], BTCUSDT: [], SOLUSDT: [] };
  for (let t = sourceEnd - 167 * H; t <= sourceEnd; t += H) {
    const value = logReturn(maps.HYPEUSDT, t), predictors = SYMBOLS.map(s => logReturn(maps[s], t - horizonHours * H));
    if (value === null || predictors.some(x => x === null)) continue;
    y.push(value); SYMBOLS.forEach((s, i) => xs[s].push(predictors[i]!));
  }
  row.trainingPairs = y.length;
  if (y.length < 160 || SYMBOLS.some(s => logReturn(maps[s], sourceEnd) === null)) return row;
  const fits = SYMBOLS.map(s => ols(xs[s], y)); if (fits.some(f => !f)) return row;
  row.rollingMean = mean(y);
  SYMBOLS.forEach((s, i) => { row.predicted[s] = fits[i]!.intercept + fits[i]!.slope * logReturn(maps[s], sourceEnd)!; });
  assert(sourceEnd + lag <= at && sourceEnd < targetEnd); row.ready = true; return row;
}
export function forecastSummary(rows: Array<Forecast & { actual: number | null }>) {
  const xs = rows.filter(x => x.ready && x.actual !== null);
  const baselineError = xs.reduce((n, x) => n + (x.actual! - x.rollingMean!) ** 2, 0);
  return { n: rows.length, scored: xs.length, unscored: rows.length - xs.length,
    rollingMeanRmsePct: xs.length ? Math.sqrt(baselineError / xs.length) * 100 : null,
    models: Object.fromEntries(SYMBOLS.map(s => {
      const error = xs.reduce((n, x) => n + (x.actual! - x.predicted[s]!) ** 2, 0);
      return [s, { rmsePct: xs.length ? Math.sqrt(error / xs.length) * 100 : null,
        mseSkillVsMeanPct: baselineError > 0 ? 100 * (1 - error / baselineError) : null,
        directionAccuracy: xs.length ? xs.filter(x => Math.sign(x.actual!) === Math.sign(x.predicted[s]!)).length / xs.length : null }];
    })) };
}
