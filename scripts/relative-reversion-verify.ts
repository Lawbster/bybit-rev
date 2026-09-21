/** Independent arithmetic/join check; does not use RelativeTape, ols or study summaries. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { loadMinutes } from "./relative-reversion-study";
import { jobDirectory, verifyPins, atomicJson, type Plan } from "./research-workflow";
const H = 3600000, M = 60000;
type R = Record<string, any>;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
function regression(x: number[], y: number[]) {
  const n = x.length, sx = sum(x), sy = sum(y);
  const b = (n * sum(x.map((v, i) => v * y[i])) - sx * sy) / (n * sum(x.map(v => v * v)) - sx * sx), a = (sy - b * sx) / n;
  const error = sum(x.map((v, i) => (y[i] - a - b * v) ** 2)), total = sum(y.map(v => (v - sy / n) ** 2));
  return { a, b, sigma: Math.sqrt(error / (n - 2)), r2: 1 - error / total,
    se: Math.sqrt(error / (n - 2) / sum(x.map(v => (v - sx / n) ** 2))) };
}
function near(a: number, b: number, key: string) { assert(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${key}: ${a} != ${b}`); }
function hourly(cs: R[]) {
  const counts = new Map<number, number>(), closes = new Map<number, number>();
  for (const c of cs) {
    const end = (Math.floor(c.ts / H) + 1) * H; counts.set(end, (counts.get(end) ?? 0) + 1);
    if (c.endTs === end) closes.set(end, c.close);
  }
  return new Map([...closes].filter(([end]) => counts.get(end) === 60));
}
async function main() {
  const root = path.resolve(__dirname, ".."), key = process.argv[2], dir = jobDirectory(root, key), output = path.join(dir, "output");
  const plan: Plan = JSON.parse(fs.readFileSync(path.join(dir, "plan.json"), "utf8")), d = plan.card.definition;
  const state = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf8")); assert.equal(state.status, "complete");
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const cutoff = Date.parse(d.cutoff), asset = await loadMinutes(root, d.asset, cutoff, d.repair), market = await loadMinutes(root, d.market, cutoff);
  const a = hourly(asset.candles), b = hourly(market.candles), pair = (t: number) => a.has(t) && b.has(t);
  const features: R[] = fs.readFileSync(path.join(output, "features.jsonl"), "utf8").trim().split("\n").map(x => JSON.parse(x));
  let checked = 0, missing = 0, arChecked = 0;
  for (const row of features) {
    const f = row.features, end = Math.floor((row.at - row.lag) / H) * H, train = end - 4 * H;
    assert.equal(f.sourceEnd, end); assert.equal(f.trainingEnd, train); assert(f.sourceAvailableAt <= row.at);
    const ts: number[] = [], x: number[] = [], y: number[] = [];
    for (let t = train - d.trainingHours * H; t <= train; t += H) {
      if (pair(t)) ts.push(t);
      if (t > train - d.trainingHours * H && pair(t) && pair(t - H)) {
        x.push(Math.log(b.get(t)! / b.get(t - H)!)); y.push(Math.log(a.get(t)! / a.get(t - H)!));
      }
    }
    assert.equal(f.trainingPairs, x.length);
    if (x.length < d.minimumPairs || ![0, 1, 2, 3, 4].every(k => pair(end - k * H))) { assert.equal(f.ready, false); missing++; continue; }
    const fit = regression(x, y); assert.equal(f.ready, true);
    near(f.beta, fit.b, "beta"); near(f.betaSe, fit.se, "beta SE"); near(f.r2, fit.r2, "r2");
    const residual = (t: number) => Math.log(a.get(t)! / a.get(t - H)!) - fit.a - fit.b * Math.log(b.get(t)! / b.get(t - H)!);
    near(f.residual1hPct, 100 * Math.expm1(residual(end)), "residual1h");
    near(f.residual4hPct, 100 * Math.expm1(sum([0, 1, 2, 3].map(k => residual(end - k * H)))), "residual4h");
    near(f.residualZ, residual(end) / fit.sigma, "z");
    assert.equal(f.relativeWeak, residual(end) < 0 && sum([0, 1, 2, 3].map(k => residual(end - k * H))) < 0);
    const spread = (t: number) => Math.log(a.get(t)!) - fit.b * Math.log(b.get(t)!);
    const trend = regression(ts.map(t => (t - train) / H), ts.map(spread));
    const detrend = (t: number) => spread(t) - trend.a - trend.b * ((t - train) / H), consecutive = ts.filter(t => ts.includes(t - H));
    const ar = regression(consecutive.map(t => detrend(t - H)), consecutive.map(detrend));
    near(f.persistence.phi, ar.b, "phi"); near(f.persistence.phiSe, ar.se, "phi SE");
    if (f.persistence.ready) { near(f.persistence.halfLifeHours, -Math.log(2) / Math.log(ar.b), "half life"); assert(ar.b + 1.96 * ar.se < 1 && ar.b - 1.96 * ar.se > 0); }
    const sd = Math.sqrt(sum(ts.map(t => detrend(t) ** 2)) / (ts.length - 2));
    near(f.persistence.deviationZ, (spread(end) - trend.a - trend.b * 4) / sd, "spread deviation");
    checked++; arChecked++;
  }
  const cs = new Map(asset.candles.map(c => [c.ts, c]));
  const outcomes: R[] = fs.readFileSync(path.join(output, "grid-outcomes.jsonl"), "utf8").trim().split("\n").map(x => JSON.parse(x));
  let outcomesChecked = 0;
  for (const row of outcomes) {
    const end = row.at + d.outcomeHours * H;
    if (end > cutoff) { assert.equal(row.outcome.reason, "right_censored"); continue; }
    const bars = Array.from({ length: d.outcomeHours * 60 }, (_, i) => cs.get(row.at + i * M)); assert(bars.every(Boolean));
    assert(row.outcome.ready); const entry = bars[0]!.open;
    near(row.outcome.returnPct, (bars.at(-1)!.close / entry - 1) * 100, "outcome return");
    near(row.outcome.adversePct, (Math.min(...bars.map(x => x!.low)) / entry - 1) * 100, "outcome low");
    near(row.outcome.favorablePct, (Math.max(...bars.map(x => x!.high)) / entry - 1) * 100, "outcome high"); outcomesChecked++;
  }
  const old: R[] = JSON.parse(fs.readFileSync(path.join(root, d.landmarks), "utf8"));
  const joined: R[] = JSON.parse(fs.readFileSync(path.join(output, "landmarks.json"), "utf8"));
  for (const row of joined) {
    const original = old.find(x => x.key === row.key); assert(original);
    assert.deepEqual(row.outcome, original.outcome); assert.equal(row.remainingValueChange, original.remainingValueChange);
    assert.equal(row.netEpisodeMark, original.netEpisodeMark); assert.equal(row.at, original.at);
  }
  const summary = JSON.parse(fs.readFileSync(path.join(output, "summary.json"), "utf8"));
  for (const [key, cohort] of Object.entries(summary.landmarks) as [string, R][]) {
    const rows = joined.filter(x => `${x.model}/lag${x.lag}` === key), done = rows.filter(x => x.outcome);
    assert.equal(cohort.baseline.observations, rows.length); assert.equal(cohort.baseline.completed, done.length);
    near(cohort.baseline.completedNet, sum(done.map(x => x.outcome.pnl)), "cohort PnL");
    near(cohort.baseline.subsequentDownside, -sum(done.map(x => Math.min(0, x.remainingValueChange))), "continuation loss");
    near(cohort.baseline.subsequentRecovery, sum(done.map(x => Math.max(0, x.remainingValueChange))), "continuation recovery");
  }
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const result = { passed: true, key, checked, missing, arChecked, outcomesChecked, exactLandmarkJoins: joined.length,
    economicReplay: false, liveChanges: 0, limitations: "Independent formulas and hourly aggregation; common validated minute loader/repair. Descriptive fits, not stationarity or economic certification." };
  // Outside the immutable worker artifacts; never rewrite the completed summary.
  atomicJson(path.join(dir, "verification.json"), result); console.log(JSON.stringify(result, null, 2));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
