/** RR03: known four-hour paths, never future labels or an ex-post turning point. */
import { HOUR as H, ols } from "./relative-reversion-features";
import { logReturn, SYMBOLS, type Maps } from "./market-proxy-comparison";
export type R = Record<string, any>;
export function trajectoryClass(increments: number[]) {
  if (increments.length !== 4 || !increments.every(Number.isFinite)) throw Error("Four finite increments required");
  let value = 0; const cumulative = increments.map(x => value += x);
  const state = cumulative.slice(0, 3).some(x => x > 0) && cumulative[3] <= 0 && increments[3] < 0 ? "failed_reclaim"
    : increments[2] > 0 && increments[3] > 0 ? "recovering"
    : cumulative.every(x => x <= 0) && increments[2] <= 0 && increments[3] <= 0 ? "persistent_weak" : "mixed";
  return { state, increments, cumulative };
}
export function trajectory(maps: Maps, at: number, lag: number): R {
  const sourceEnd = Math.floor((at - lag) / H) * H, trainingEnd = sourceEnd - 4 * H;
  const xs: number[][] = [[], [], []], ys: number[] = [];
  for (let t = trainingEnd - 167 * H; t <= trainingEnd; t += H) {
    const r = SYMBOLS.map(s => logReturn(maps[s], t)); if (r.some(x => x === null)) continue;
    r.forEach((x, j) => xs[j].push(x!)); ys.push(r[0]!);
  }
  const steps = [3, 2, 1, 0].map(k => SYMBOLS.map(s => logReturn(maps[s], sourceEnd - k * H)));
  const result: R = { at, lag, sourceEnd, availableAt: sourceEnd + lag, trainingEnd, trainingPairs: ys.length,
    ready: false, reason: null, paths: {} };
  if (ys.length < 160 || steps.some(x => x.some(v => v === null))) { result.reason = "common_coverage"; return result; }
  const fits = [null, ols(xs[1], ys), ols(xs[2], ys)];
  if (!fits[1] || !fits[2]) { result.reason = "degenerate_fit"; return result; }
  result.ready = true;
  SYMBOLS.forEach((s, j) => {
    const fit = fits[j], increments = steps.map(r => r[0]! - (fit ? fit.intercept + fit.slope * r[j]! : 0));
    result.paths[s] = { ...trajectoryClass(increments), beta: fit?.slope ?? 0, intercept: fit?.intercept ?? 0, r2: fit?.r2 ?? null };
  });
  return result;
}
export function groupRows(xs: R[], key: (x: R) => string, summarize: (x: R[]) => any): R {
  return Object.fromEntries([...new Set(xs.map(key))].sort().map(k => [k, summarize(xs.filter(x => key(x) === k))]));
}
