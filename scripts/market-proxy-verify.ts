/** Independent forecast normal equations, Pearson calculation, SOL aggregation and archive joins. */
import fs from "fs";
import path from "path";
import readline from "readline";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson } from "./research-workflow";
const H = 3600000, M = 60000;
type R = Record<string, any>;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const near = (a: number, b: number) => assert(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function independentFit(xs: number[], ys: number[]) {
  const n = xs.length, sx = sum(xs), sy = sum(ys), xx = n * sum(xs.map(x => x * x)) - sx * sx;
  const xy = n * sum(xs.map((x, i) => x * ys[i])) - sx * sy;
  return { beta: xy / xx, intercept: (sy - xy / xx * sx) / n,
    correlation: xy / Math.sqrt(xx * (n * sum(ys.map(y => y * y)) - sy * sy)) };
}
async function main() {
  const root = path.resolve(__dirname, ".."), key = process.argv[2], dir = jobDirectory(root, key), out = path.join(dir, "output");
  const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8")), plan = read(path.join(dir, "plan.json")), state = read(path.join(dir, "state.json"));
  assert.equal(state.status, "complete"); await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const d = plan.card.definition, inputs = read(path.join(out, "hourly-inputs.json"));
  const cutoff = Date.parse(d.cutoff), seed = Math.floor(Date.parse(d.start) / H) * H - 176 * H;
  const solMinutes = new Map<number, R>();
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(root, "data/SOLUSDT_1m.jsonl")), crlfDelay: Infinity })) {
    if (!line.trim()) continue; const r = JSON.parse(line); if (r.ts >= seed && r.ts + M <= cutoff) solMinutes.set(r.ts, r);
  }
  const solHours = [];
  for (let t = Math.ceil(seed / H) * H; t + H <= cutoff; t += H) {
    if (Array.from({ length: 60 }, (_, k) => t + k * M).every(ts => solMinutes.has(ts))) solHours.push({ end: t + H, close: solMinutes.get(t + H - M)!.c });
  }
  assert.deepEqual(inputs.SOLUSDT, solHours);
  const symbols = ["HYPEUSDT", "BTCUSDT", "SOLUSDT"], maps: Record<string, Map<number, number>> = {};
  for (const s of symbols) maps[s] = new Map(inputs[s].map((x: R) => [x.end, x.close]));
  const common = (t: number) => symbols.every(s => maps[s].has(t));
  const ret = (s: string, t: number) => common(t) && common(t - H) ? Math.log(maps[s].get(t)! / maps[s].get(t - H)!) : null;
  const lines = (f: string): R[] => fs.readFileSync(path.join(out, f), "utf8").trim().split("\n").map(x => JSON.parse(x));
  const forecasts = lines("forecast-features.jsonl"), labels = lines("forecast-labels.jsonl"), labelMap = new Map(labels.map(x => [`${x.at}/${x.lag}`, x.actual]));
  let fitChecks = 0, missingChecks = 0;
  for (const f of forecasts) {
    const end = Math.floor((f.at - f.lag) / H) * H, ahead = (f.at + H - end) / H;
    assert.equal(f.trainingEnd, end); assert.equal(f.sourceEnd, end); assert.equal(f.horizonHours, ahead); assert(end + f.lag <= f.at);
    const y: number[] = [], xx: number[][] = [[], [], []];
    for (let z = end - 167 * H; z <= end; z += H) {
      const yy = ret("HYPEUSDT", z), xs = symbols.map(s => ret(s, z - ahead * H));
      if (yy === null || xs.some(x => x === null)) continue;
      y.push(yy); xs.forEach((x, i) => xx[i].push(x!));
    }
    assert.equal(f.trainingPairs, y.length);
    if (y.length < 160 || symbols.some(s => ret(s, end) === null)) { assert(!f.ready); missingChecks++; }
    else { assert(f.ready); near(f.rollingMean, sum(y) / y.length);
      symbols.forEach((s, i) => { const fit = independentFit(xx[i], y); near(f.predicted[s], fit.intercept + fit.beta * ret(s, end)!); fitChecks++; }); }
    const label = labelMap.get(`${f.at}/${f.lag}`);
    const actual = f.at + H <= cutoff && maps.HYPEUSDT.has(f.at + H) && maps.HYPEUSDT.has(f.at)
      ? Math.log(maps.HYPEUSDT.get(f.at + H)! / maps.HYPEUSDT.get(f.at)!) : null;
    if (actual === null) assert.equal(label, null); else near(label, actual);
  }
  const report = read(path.join(out, "summary.json")), relations = read(path.join(out, "correlation-rows.json")); let corrChecks = 0;
  for (const row of relations) {
    assert([1, 4].includes(row.span) && row.at - row.span * H >= Date.parse(d.start) && row.at <= cutoff);
    for (let k = 0; k <= row.span; k++) assert(common(row.at - k * H));
    for (const s of symbols) near(row[s], Math.log(maps[s].get(row.at)! / maps[s].get(row.at - row.span * H)!));
  }
  for (const span of [1, 4]) {
    const all = relations.filter((x: R) => x.span === span), r = report.correlations[String(span)];
    for (const [period, rows] of [["total", all], ...Object.keys(r.monthly).map(month => [month, all.filter((x: R) => x.iso.startsWith(month))])]) {
      const xs = rows as R[], target = period === "total" ? r.total : r.monthly[period as string]; assert.equal(target.n, xs.length);
      for (const s of ["BTC", "SOL"]) { near(target[s], independentFit(xs.map(x => x[`${s}USDT`]), xs.map(x => x.HYPEUSDT)).correlation); corrChecks++; }
    }
  }
  const pressure = read(path.join(out, "landmarks.json")), original = read(path.join(root, d.rr01Archive, "output/landmarks.json"));
  for (const x of pressure) { const o = original.find((y: R) => y.key === x.key && y.lag === x.lag); assert(o);
    assert.equal(x.remainingValueChange, o.remainingValueChange); assert.deepEqual(x.outcome, o.outcome); }
  let relativeChecks = 0;
  for (const row of lines("features.jsonl")) for (const s of ["BTCUSDT", "SOLUSDT"]) {
    const f = row.features[s]; assert.equal(f.referenceSymbol, s); assert(!("btcReturn4hPct" in f));
    if (!f.ready) continue;
    const end = Math.floor((row.at - row.lag) / H) * H, train = end - 4 * H, x: number[] = [], y: number[] = [];
    for (let t = train - 167 * H; t <= train; t += H) {
      const xx = ret(s, t), yy = ret("HYPEUSDT", t); if (xx !== null && yy !== null) { x.push(xx); y.push(yy); }
    }
    const fit = independentFit(x, y); near(f.beta, fit.beta); near(f.r2, fit.correlation ** 2);
    const residual = (t: number) => ret("HYPEUSDT", t)! - fit.intercept - fit.beta * ret(s, t)!;
    near(f.residual1hPct, 100 * Math.expm1(residual(end)));
    near(f.residual4hPct, 100 * Math.expm1(sum([0, 1, 2, 3].map(k => residual(end - k * H)))));
    near(f.marketReturn4hPct, 100 * (maps[s].get(end)! / maps[s].get(end - 4 * H)! - 1));
    relativeChecks++;
  }
  // Check reported forecast error skill independently, on identical scored rows.
  for (const lag of [0, 60000]) {
    const good = forecasts.filter(x => x.lag === lag && x.ready && labelMap.get(`${x.at}/${x.lag}`) !== null);
    const y = good.map(x => labelMap.get(`${x.at}/${x.lag}`)!);
    const err = sum(good.map((x, i) => (y[i] - x.rollingMean) ** 2));
    const total = report.forecasts[String(lag)].total; assert.equal(total.scored, good.length);
    near(total.rollingMeanRmsePct, Math.sqrt(err / good.length) * 100);
    for (const s of symbols) near(total.models[s].mseSkillVsMeanPct, (1 - sum(good.map((x, i) => (y[i] - x.predicted[s]) ** 2)) / err) * 100);
  }
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const result = { passed: true, key, independentlyAggregatedSolHours: solHours.length, fitChecks, missingChecks,
    forecastLabelChecks: labels.length, correlationChecks: corrChecks, pressureJoins: pressure.length, relativeChecks, economicReplay: false, liveChanges: 0 };
  atomicJson(path.join(dir, "verification.json"), result); console.log(JSON.stringify(result, null, 2));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
