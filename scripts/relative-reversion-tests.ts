import assert from "assert/strict";
import { ols, RelativeTape, HOUR as H, type Hour } from "./relative-reversion-features";
import { hours, futureOutcome, validateDefinition } from "./relative-reversion-study";
import type { Candle } from "./hype-freerun-canonical-replay";
const near = (a: number, b: number, e = 1e-10) => assert(Math.abs(a - b) <= e, `${a} != ${b}`);
const fit = ols([1, 2, 3, 4], [3, 5, 7, 9])!; near(fit.slope, 2); near(fit.intercept, 1); near(fit.r2, 1);
assert.equal(ols([1, 1, 1], [1, 2, 3]), null); assert.equal(ols([1, 2, 3], [1, 1, 1]), null);
assert.throws(() => ols([1, NaN, 2], [1, 2, 3]));
// Deterministic independent returns, common trend and a mean-reverting log spread.
let seed = 1729; const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 - .5; };
const asset: Hour[] = [], market: Hour[] = []; let m = 10, spread = 0;
for (let i = 0; i < 500; i++) {
  m += .0003 + noise() * .015; spread = .82 * spread + noise() * .004;
  market.push({ end: (1000 + i) * H, close: Math.exp(m) });
  asset.push({ end: (1000 + i) * H, close: Math.exp(1.5 * m - 11 + spread + i * .0001) });
}
const tape = new RelativeTape(asset, market), at = asset[300].end;
const opts = { trainingHours: 168, minimumPairs: 160, publicationLagMs: 0 };
const f = tape.feature(at, opts); assert(f.ready); assert(f.beta! > 1.3 && f.beta! < 1.7);
assert(f.persistence.ready); assert(f.persistence.halfLifeHours! > 1 && f.persistence.halfLifeHours! < 8);
near(f.trainingEnd, at - 4 * H); assert(f.sourceAvailableAt <= at);
// Independently calculate the normal-equation regression (not the production ols).
const endIdx = 296, xs: number[] = [], ys: number[] = [];
for (let i = endIdx - 167; i <= endIdx; i++) {
  xs.push(Math.log(market[i].close / market[i - 1].close)); ys.push(Math.log(asset[i].close / asset[i - 1].close));
}
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const beta = (168 * sum(xs.map((x, i) => x * ys[i])) - sum(xs) * sum(ys)) / (168 * sum(xs.map(x => x * x)) - sum(xs) ** 2);
const alpha = (sum(ys) - beta * sum(xs)) / 168;
near(f.beta!, beta); near(f.residual1hPct!, Math.expm1(Math.log(asset[300].close / asset[299].close) - alpha
  - beta * Math.log(market[300].close / market[299].close)) * 100);
// Poison all future bars and vary history length: decision must remain byte-identical.
const poison = (rows: Hour[]) => rows.map(x => x.end > at ? { ...x, close: x.close * 100 } : x);
assert.deepEqual(new RelativeTape(poison(asset), poison(market)).feature(at, opts), f);
assert.deepEqual(new RelativeTape(asset.filter(x => x.end <= at), market.filter(x => x.end <= at)).feature(at, opts), f);
// Alter evaluation window drastically: fitted beta must NOT change.
const altered = asset.map(x => x.end > at - 4 * H && x.end <= at ? { ...x, close: x.close * 2 } : x);
near(new RelativeTape(altered, market).feature(at, opts).beta!, f.beta!);
const lagged = tape.feature(at, { ...opts, publicationLagMs: 60000 });
assert.equal(lagged.sourceEnd, at - H); assert.equal(tape.feature(at + 60000, { ...opts, publicationLagMs: 60000 }).sourceEnd, at);
const gap = (rows: Hour[], i: number) => rows.filter((_, k) => k !== i);
assert.equal(new RelativeTape(asset, gap(market, 299)).feature(at, opts).ready, false);
const trainingGap = new RelativeTape(asset, gap(market, 200)).feature(at, opts);
assert.equal(trainingGap.trainingPairs, 166); assert(trainingGap.ready); // two adjacent returns excluded, no bridge
assert.equal(new RelativeTape(asset, market.filter((_, i) => i < 180 || i > 190)).feature(at, opts).ready, false);
assert.equal(new RelativeTape(asset, market.map(x => ({ ...x, close: 100 }))).feature(at, opts).ready, false);
assert.throws(() => new RelativeTape([...asset, asset[0]], market));
// Complete-minute aggregation: even a non-boundary missing minute invalidates its hour.
const base = 2000 * H;
const cs: Candle[] = Array.from({ length: 120 }, (_, i) => ({ ts: base + i * 60000, endTs: base + (i + 1) * 60000,
  open: 100, high: 101, low: 99, close: 100, volume: 1, turnover: 100 }));
assert.equal(hours(cs, base).length, 2); assert.equal(hours(cs.filter((_, i) => i !== 17), base).length, 1);
const byTs = new Map(cs.map(c => [c.ts, c]));
const outcome = futureOutcome(byTs, base + H, 1, base + 2 * H); assert(outcome.ready); near(outcome.returnPct, 0);
byTs.set(base, { ...cs[0], low: 1, high: 1000 });
assert.deepEqual(futureOutcome(byTs, base + H, 1, base + 2 * H), outcome); // no predecision extremes
assert.equal(futureOutcome(byTs, base + H, 2, base + 2 * H).reason, "right_censored");
byTs.delete(base + 80 * 60000); assert.equal(futureOutcome(byTs, base + H, 1, base + 2 * H).reason, "outcome_gap");
assert.throws(() => validateDefinition({ asset: "HYPEUSDT", market: "HYPEUSDT" }));
console.log("relative/reversion tests passed: independent OLS, synthetic persistence, prefix/future poison, lag boundaries, gaps, censoring");
