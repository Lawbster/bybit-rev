/** Frozen descriptive features, never future outcomes or exchange/trading code. */
import assert from "assert/strict";
export const HOUR = 3_600_000;
export interface Hour { end: number; close: number }
export interface Fit { slope: number; intercept: number; r2: number; sigma: number; slopeSe: number; n: number }
export function ols(xs: number[], ys: number[]): Fit | null {
  assert(xs.length === ys.length && xs.every(Number.isFinite) && ys.every(Number.isFinite));
  const n = xs.length; if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let xx = 0, yy = 0, xy = 0;
  for (let i = 0; i < n; i++) { xx += (xs[i] - mx) ** 2; yy += (ys[i] - my) ** 2; xy += (xs[i] - mx) * (ys[i] - my); }
  if (xx <= 1e-20 || yy <= 1e-20) return null;
  const slope = xy / xx, intercept = my - slope * mx;
  const sse = xs.reduce((s, x, i) => s + (ys[i] - intercept - slope * x) ** 2, 0), sigma = Math.sqrt(sse / (n - 2));
  return { slope, intercept, r2: Math.max(0, Math.min(1, 1 - sse / yy)), sigma, slopeSe: sigma / Math.sqrt(xx), n };
}
export interface Options { trainingHours: number; minimumPairs: number; publicationLagMs: number }
export interface Features {
  at: number; sourceEnd: number; sourceAvailableAt: number; trainingEnd: number;
  ready: boolean; reasons: string[]; trainingPairs: number;
  beta: number | null; betaSe: number | null; r2: number | null;
  residual1hPct: number | null; residual4hPct: number | null; residualZ: number | null;
  hypeReturn4hPct: number | null; btcReturn4hPct: number | null;
  relativeWeak: boolean | null; rawWeak: boolean | null;
  persistence: { ready: boolean; reason: string | null; phi: number | null; phiSe: number | null;
    halfLifeHours: number | null; deviationZ: number | null; pairs: number };
}
export class RelativeTape {
  private asset = new Map<number, number>(); private market = new Map<number, number>();
  constructor(asset: Hour[], market: Hour[]) {
    for (const [rows, dest] of [[asset, this.asset], [market, this.market]] as const) for (const c of rows) {
      assert(Number.isSafeInteger(c.end) && c.end % HOUR === 0 && c.close > 0 && Number.isFinite(c.close));
      assert(!dest.has(c.end), "Duplicate hour"); dest.set(c.end, c.close);
    }
  }
  feature(at: number, o: Options): Features {
    assert(Number.isSafeInteger(at) && at >= 0 && Number.isInteger(o.trainingHours) && o.trainingHours >= 8);
    assert(Number.isInteger(o.minimumPairs) && o.minimumPairs >= 6 && o.minimumPairs <= o.trainingHours);
    assert(Number.isSafeInteger(o.publicationLagMs) && o.publicationLagMs >= 0 && o.publicationLagMs < HOUR);
    // At the same wall clock a 60s publication lag can make the latest hour unavailable.
    // Explicitly use the latest available CLOSED hour; never fill missing source hours.
    const sourceEnd = Math.floor((at - o.publicationLagMs) / HOUR) * HOUR;
    const trainingEnd = sourceEnd - 4 * HOUR; // entire evaluated 4h excluded from regression
    const f: Features = { at, sourceEnd, sourceAvailableAt: sourceEnd + o.publicationLagMs, trainingEnd,
      ready: false, reasons: [], trainingPairs: 0, beta: null, betaSe: null, r2: null,
      residual1hPct: null, residual4hPct: null, residualZ: null, hypeReturn4hPct: null,
      btcReturn4hPct: null, relativeWeak: null, rawWeak: null,
      persistence: { ready: false, reason: "relative_inputs_unavailable", phi: null, phiSe: null, halfLifeHours: null, deviationZ: null, pairs: 0 } };
    const pair = (t: number) => this.asset.has(t) && this.market.has(t);
    const ret = (m: Map<number, number>, t: number) => Math.log(m.get(t)! / m.get(t - HOUR)!);
    const xs: number[] = [], ys: number[] = [], spreadTimes: number[] = [];
    for (let t = trainingEnd - o.trainingHours * HOUR; t <= trainingEnd; t += HOUR) {
      if (pair(t)) spreadTimes.push(t);
      if (t > trainingEnd - o.trainingHours * HOUR && pair(t) && pair(t - HOUR)) {
        xs.push(ret(this.market, t)); ys.push(ret(this.asset, t));
      }
    }
    f.trainingPairs = xs.length;
    if (xs.length < o.minimumPairs) f.reasons.push("training_coverage_incomplete");
    if (![0, 1, 2, 3, 4].every(k => pair(sourceEnd - k * HOUR))) f.reasons.push("signal_coverage_incomplete");
    if (f.reasons.length) return f;
    const fit = ols(xs, ys);
    if (!fit || fit.sigma < 1e-10) { f.reasons.push("degenerate_market_or_residual_variance"); return f; }
    f.beta = fit.slope; f.betaSe = fit.slopeSe; f.r2 = fit.r2;
    const residual = (t: number) => ret(this.asset, t) - fit.intercept - fit.slope * ret(this.market, t);
    f.residual1hPct = 100 * Math.expm1(residual(sourceEnd));
    f.residual4hPct = 100 * Math.expm1([0, 1, 2, 3].reduce((s, k) => s + residual(sourceEnd - k * HOUR), 0));
    f.residualZ = residual(sourceEnd) / fit.sigma;
    f.hypeReturn4hPct = (this.asset.get(sourceEnd)! / this.asset.get(sourceEnd - 4 * HOUR)! - 1) * 100;
    f.btcReturn4hPct = (this.market.get(sourceEnd)! / this.market.get(sourceEnd - 4 * HOUR)! - 1) * 100;
    f.relativeWeak = f.residual1hPct < 0 && f.residual4hPct < 0;
    f.rawWeak = ret(this.asset, sourceEnd) < 0 && f.hypeReturn4hPct < 0; f.ready = true;
    // A rolling, detrended beta-adjusted log spread. Descriptive AR(1), NOT a
    // stationarity/cointegration test: estimated beta and detrending can induce reversion.
    const spread = (t: number) => Math.log(this.asset.get(t)!) - fit.slope * Math.log(this.market.get(t)!);
    const times = spreadTimes.map(t => (t - trainingEnd) / HOUR), values = spreadTimes.map(spread);
    const trend = ols(times, values);
    if (!trend) { f.persistence.reason = "degenerate_spread"; return f; }
    const detrended = new Map(spreadTimes.map((t, i) => [t, values[i] - trend.intercept - trend.slope * times[i]]));
    const ax: number[] = [], ay: number[] = [];
    for (const t of spreadTimes) if (detrended.has(t - HOUR)) { ax.push(detrended.get(t - HOUR)!); ay.push(detrended.get(t)!); }
    f.persistence.pairs = ax.length;
    const ar = ols(ax, ay);
    if (ax.length < o.minimumPairs || !ar) { f.persistence.reason = "persistence_fit_unavailable"; return f; }
    f.persistence.phi = ar.slope; f.persistence.phiSe = ar.slopeSe;
    const spreadSigma = Math.sqrt(values.reduce((s, _, i) => s + detrended.get(spreadTimes[i])! ** 2, 0) / (values.length - 2));
    f.persistence.deviationZ = spreadSigma > 1e-10 ? (spread(sourceEnd) - trend.intercept - trend.slope * 4) / spreadSigma : null;
    if (ar.slope <= 0 || ar.slope >= 1) { f.persistence.reason = "phi_outside_positive_stationary_range"; return f; }
    // Conventional OLS interval is only a fragility screen, not calibrated evidence
    // after estimating beta/trend, serial dependence and selection on this same data.
    if (ar.slope + 1.96 * ar.slopeSe >= 1 || ar.slope - 1.96 * ar.slopeSe <= 0) {
      f.persistence.reason = "phi_uncertainty_crosses_boundary"; return f;
    }
    f.persistence.ready = true; f.persistence.reason = null;
    f.persistence.halfLifeHours = -Math.log(2) / Math.log(ar.slope); return f;
  }
}
