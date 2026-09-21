/** RR02: SOL versus BTC on identical source clocks, training samples and outcomes. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { loadMinutes, hours, futureOutcome } from "./relative-reversion-study";
import { RelativeTape, HOUR as H } from "./relative-reversion-features";
import { summarize } from "./failed-recovery-analysis";
import { SYMBOLS, commonMaps, logReturn, correlation, forecast, forecastSummary, mean, type SymbolName } from "./market-proxy-comparison";
import { atomicJson, inside, verifyPins, type Plan } from "./research-workflow";
type R = Record<string, any>;
export function validateProxyCard(d: R) {
  assert.deepEqual(d.symbols, [...SYMBOLS]); assert.equal(d.start, "2026-05-17T20:43:00Z"); assert.equal(d.cutoff, "2026-09-10T05:08:00Z");
  assert.equal(d.trainingHours, 168); assert.equal(d.minimumPairs, 160); assert.deepEqual(d.lagsMs, [0, 60000]);
  assert.equal(d.newTradingDefinitions, 0); assert(d.rr01Archive.includes("63b277ce"));
}
function group(xs: R[], key: (x: R) => string, summary: (rows: R[]) => any) {
  return Object.fromEntries([...new Set(xs.map(key))].sort().map(k => [k, summary(xs.filter(x => key(x) === k))]));
}
function pressure(xs: R[]) {
  return { baseline: summarize(xs), byProxy: Object.fromEntries(["BTCUSDT", "SOLUSDT"].map(s => [s,
    group(xs, x => String(x.features[s].relativeWeak), summarize)])),
    disagreements: group(xs, x => `BTC=${x.features.BTCUSDT.relativeWeak}/SOL=${x.features.SOLUSDT.relativeWeak}`, summarize) };
}
function persistenceBucket(f: R) {
  if (!f.persistence.ready) return "unknown";
  if (f.persistence.deviationZ >= 0) return "not_below_trend";
  return f.persistence.halfLifeHours <= 4 ? "below_le4h" : f.persistence.halfLifeHours <= 8 ? "below_4to8h" : "below_gt8h";
}
function taggedFeature(referenceSymbol: string, f: R) {
  // RR01's legacy field name is BTC-specific. Never label SOL's return as BTC.
  const { btcReturn4hPct, ...rest } = f;
  return { ...rest, referenceSymbol, marketReturn4hPct: btcReturn4hPct };
}
function gridSummary(xs: R[]) {
  const completed = xs.filter(x => x.outcome.ready);
  return { n: xs.length, completed: completed.length, meanForward12hPct: mean(completed.map(x => x.outcome.returnPct)),
    meanAdverse12hPct: mean(completed.map(x => x.outcome.adversePct)) };
}
export async function runProxyStudy(root: string, plan: Plan, out: string) {
  const d = plan.card.definition; validateProxyCard(d); const read = (f: string) => JSON.parse(fs.readFileSync(inside(root, f), "utf8"));
  const parent = read(`${d.rr01Archive}/plan.json`), state = read(`${d.rr01Archive}/state.json`); assert.equal(state.status, "complete");
  const parentReport = read(`${d.rr01Archive}/verification.json`); assert.equal(parentReport.passed, true);
  const required = [`${d.rr01Archive}/output/features.jsonl`, `${d.rr01Archive}/output/landmarks.json`, `${d.rr01Archive}/output/summary.json`];
  for (const file of [...required, "data/HYPEUSDT_1_full.json", "data/HYPEUSDT_1m.jsonl", "data/BTCUSDT_1_full.json",
    "data/BTCUSDT_1m.jsonl", "data/SOLUSDT_1m.jsonl", d.repair]) assert(plan.card.inputs.includes(file), `Missing pin ${file}`);
  await verifyPins(root, state.artifacts.filter((x: R) => required.includes(x.file)));
  for (const p of parent.pins.filter((x: R) => x.file.startsWith("data/") || x.file === d.repair)) {
    assert.equal(plan.pins.find(x => x.file === p.file)?.sha256, p.sha256, `Changed RR01 data: ${p.file}`);
  }
  const start = Date.parse(d.start), cutoff = Date.parse(d.cutoff), seed = Math.floor(start / H) * H - 176 * H;
  console.log("[RR02] loading common HYPE/BTC/SOL closed-bar coverage; SOL collector-only mode");
  const h = await loadMinutes(root, "HYPEUSDT", cutoff, d.repair), b = await loadMinutes(root, "BTCUSDT", cutoff);
  const sol = await loadMinutes(root, "SOLUSDT", cutoff, undefined, null);
  const raw = { HYPEUSDT: hours(h.candles, seed), BTCUSDT: hours(b.candles, seed), SOLUSDT: hours(sol.candles, seed) };
  const maps = commonMaps(raw), commonRows = Object.fromEntries(SYMBOLS.map(s => [s, [...maps[s]].map(([end, close]) => ({ end, close }))]));
  const tapes = { BTCUSDT: new RelativeTape(commonRows.HYPEUSDT, commonRows.BTCUSDT), SOLUSDT: new RelativeTape(commonRows.HYPEUSDT, commonRows.SOLUSDT) };
  // Pair-only BTC reproduces ALL original RR01 feature objects before introducing
  // the SOL intersection. Do not mistake changed sample coverage for a factor edge.
  const btcNative = new RelativeTape(raw.HYPEUSDT, raw.BTCUSDT);
  const saved: R[] = fs.readFileSync(inside(root, required[0]), "utf8").trim().split("\n").map(x => JSON.parse(x));
  for (const x of saved) assert.deepEqual(btcNative.feature(x.at, { trainingHours: 168, minimumPairs: 160, publicationLagMs: x.lag }), x.features);
  console.log(`[RR02] ${saved.length} exact archived BTC feature checks passed`);
  const relations: R[] = [];
  for (const span of [1, 4]) for (let end = Math.ceil(start / (span * H)) * span * H + span * H; end <= cutoff; end += span * H) {
    const returns = Object.fromEntries(SYMBOLS.map(s => [s, logReturn(maps[s], end, span)]));
    if (Object.values(returns).some(v => v === null)) continue;
    relations.push({ at: end, iso: new Date(end).toISOString(), span, ...returns });
  }
  const relSummary = (xs: R[]) => ({ n: xs.length, BTC: correlation(xs.map(x => x.BTCUSDT), xs.map(x => x.HYPEUSDT)),
    SOL: correlation(xs.map(x => x.SOLUSDT), xs.map(x => x.HYPEUSDT)), BTC_SOL: correlation(xs.map(x => x.BTCUSDT), xs.map(x => x.SOLUSDT)) });
  const forecastRows: R[] = [];
  const actualHype = new Map(raw.HYPEUSDT.map(x => [x.end, x.close]));
  for (const lag of d.lagsMs) for (let at = Math.ceil(start / H) * H; at <= cutoff; at += H) {
    const f = forecast(maps, at, lag); forecastRows.push({ ...f, iso: new Date(at).toISOString(),
      actual: at + H <= cutoff ? logReturn(actualHype, at + H) : null });
  }
  const cs = new Map(h.candles.map(x => [x.ts, x])), grid: R[] = [], landmarks: R[] = [], features: R[] = [];
  const oldLandmarks: R[] = read(required[1]);
  for (const lag of d.lagsMs) {
    const opts = { trainingHours: 168, minimumPairs: 160, publicationLagMs: lag };
    const atFeatures = (at: number) => Object.fromEntries((["BTCUSDT", "SOLUSDT"] as const).map(s => [s, taggedFeature(s, tapes[s].feature(at, opts))]));
    for (let at = Math.ceil(start / (4 * H)) * 4 * H; at <= cutoff; at += 4 * H) {
      const f = atFeatures(at); features.push({ kind: "grid", at, lag, features: f });
      grid.push({ at, iso: new Date(at).toISOString(), lag, features: f, outcome: futureOutcome(cs, at, 12, cutoff) });
    }
    for (const x of oldLandmarks.filter(x => x.lag === lag)) {
      const f = atFeatures(x.at); features.push({ kind: "landmark", key: x.key, at: x.at, lag, features: f });
      landmarks.push({ ...x, features: f });
    }
  }
  const summarizeGrid = (xs: R[]) => ({ baseline: gridSummary(xs), commonReady: xs.filter(x => x.features.BTCUSDT.ready && x.features.SOLUSDT.ready).length,
    byProxy: Object.fromEntries(["BTCUSDT", "SOLUSDT"].map(s => [s, {
      meanRollingR2: mean(xs.filter(x => x.features[s].ready).map(x => x.features[s].r2)),
      weak: group(xs, x => String(x.features[s].relativeWeak), gridSummary),
      persistence: group(xs, x => persistenceBucket(x.features[s]), gridSummary) }])) });
  const report = { window: { start: d.start, cutoff: d.cutoff }, liveChanges: 0, newTradingDefinitions: 0,
    data: [h.audit, b.audit, sol.audit], commonHours: maps.HYPEUSDT.size,
    correlations: group(relations, x => String(x.span), xs => ({ total: relSummary(xs), monthly: group(xs, x => x.iso.slice(0, 7), relSummary) })),
    forecasts: group(forecastRows, x => String(x.lag), xs => ({ total: forecastSummary(xs as any), monthly: group(xs, x => x.iso.slice(0, 7), z => forecastSummary(z as any)) })),
    grid: group(grid, x => String(x.lag), xs => ({ ...summarizeGrid(xs), monthly: group(xs, x => x.iso.slice(0, 7), summarizeGrid) })),
    pressure: group(landmarks, x => `${x.model}/lag${x.lag}`, xs => ({ ...pressure(xs), monthly: group(xs, x => x.iso.slice(0, 7), pressure),
      persistence: Object.fromEntries(["BTCUSDT", "SOLUSDT"].map(s => [s, group(xs, x => persistenceBucket(x.features[s]), summarize)])) })),
    latest: Object.fromEntries((["BTCUSDT", "SOLUSDT"] as const).map(s => [s, taggedFeature(s, tapes[s].feature(cutoff, { trainingHours: 168, minimumPairs: 160, publicationLagMs: 0 }))])),
    limitations: d.limits };
  const write = (name: string, x: unknown) => atomicJson(path.join(out, name), x);
  write("summary.json", report); write("correlation-rows.json", relations); write("landmarks.json", landmarks);
  write("hourly-inputs.json", raw); // Independent checker can reconstruct the intersection, no opaque feature-only verification.
  const jsonl = (name: string, rows: R[]) => fs.writeFileSync(path.join(out, name), rows.map(x => JSON.stringify(x)).join("\n") + "\n");
  jsonl("features.jsonl", features); jsonl("grid-labels.jsonl", grid.map(({ features: _, ...x }) => x));
  jsonl("forecast-features.jsonl", forecastRows.map(({ actual: _, ...x }) => x));
  jsonl("forecast-labels.jsonl", forecastRows.map(x => ({ at: x.at, lag: x.lag, actual: x.actual })));
  write("validation.json", { passed: true, exactBtcFeatures: saved.length, featureRows: features.length,
    forecastRows: forecastRows.length, newTradingDefinitions: 0, economicReplay: false, liveChanges: 0 });
  console.log(`[RR02] ${relations.length} return observations, ${forecastRows.length} forecast rows, ${landmarks.length} pressure rows; no strategy replay`);
}
