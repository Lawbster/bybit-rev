/** Frozen ROC-only standalone research. New local artifacts; no live/config writes. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import { ClosedBarSeries, CLOSED_BAR_TIMING_VERSION } from "../src/research/closed-bars";
import { computeResearchFeatures, RESEARCH_FEATURE_FORMULA_VERSION } from "../src/research/indicator-features";
import { HOUR, MINUTE, runStandalone, type FeatureBar, type StandaloneOptions, type StandaloneRule } from "./indicator-standalone-engine";
import { runRocStandalone, rocEntrySignal, computeRocValues, type RocRule, type RocResult } from "./roc-standalone-engine";

const root = path.resolve(__dirname, "..");
const definition = "research-inputs/indicators/roc-standalone-2026-09-06.json";
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const json = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
async function sha(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
const key = (w: string, d: number, id: string) => `${w}|${d}|${id}`;

async function main() {
  const spec = read(path.join(root, definition));
  assert.deepEqual(spec.timeframesMs, [5 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 4 * HOUR]);
  assert.deepEqual(spec.lookbackBars, [1, 5, 12]); assert.deepEqual(spec.magnitudesPct, [1, 2, 4]);
  assert.deepEqual(spec.entryModes, ["momentum", "into", "back_out"]);
  assert.deepEqual(spec.exits, ["fixed12h", "indicator_or12h"]);
  assert.deepEqual(spec.sides, ["long", "short"]); assert.deepEqual(spec.executionDelaysMs, [0, MINUTE]);
  assert.equal(spec.holdMs, 12 * HOUR); assert.equal(spec.strategyDefinitionCount, 600); assert.equal(spec.symbol, "HYPEUSDT");
  const args = process.argv.slice(2);
  assert(args.length === 0 || (args.length === 2 && args[0] === "--out"), "Only --out NEW_DIRECTORY is supported");
  const out = path.resolve(root, args[1] ?? `backtests/hype/${spec.id}`), rel = path.relative(path.join(root, "backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Use NEW output directory inside backtests");
  const priorDir = path.join(root, spec.priorArtifactDirectory), prior = read(path.join(priorDir, "manifest.json"));
  const priorVerified = read(path.join(priorDir, "verification.json")); assert.equal(priorVerified.passed, true);
  for (const field of ["historyEnd", "indicatorSeedBarStart", "repairFile", "notionalUsdt", "initialEquity", "feeRatePerSide", "holdMs", "windows", "executionDelaysMs", "extraFixedPathCostBpsPerSide"])
    assert.deepEqual(spec[field], prior.spec[field], `Must preserve I01 ${field}`);
  // Preserve archival reproducibility: no edit to old pinned engine/feature/loader files.
  for (const p of [...prior.sources, ...prior.inputs]) assert.equal(await sha(path.join(root, p.file)), p.sha256, `I01 source/input drift: ${p.file}`);
  for (const p of priorVerified.artifacts) assert.equal(await sha(path.join(priorDir, p.file)), p.sha256, `I01 evidence drift: ${p.file}`);
  const inputFiles: string[] = prior.inputs.map((p: any) => p.file).concat(
    ["manifest.json", "verification.json", "validation.json", "results.json", "monthly.json", "trades.jsonl"].map(f => `${spec.priorArtifactDirectory}/${f}`));
  const inputs = await Promise.all(inputFiles.map(async file => ({ file, sha256: await sha(path.join(root, file)), bytes: fs.statSync(path.join(root, file)).size })));
  const sourceFiles = [definition, "scripts/roc-standalone-engine.ts", "scripts/hype-roc-standalone-study.ts",
    "scripts/roc-standalone-tests.ts", "scripts/roc-standalone-results-check.ts", "scripts/roc-standalone-path-check.ts",
    ...prior.sources.map((p: any) => p.file)] as string[];
  const sources = await Promise.all([...new Set(sourceFiles)].map(async file => ({ file, sha256: await sha(path.join(root, file)) })));
  process.env.SIM_START = spec.indicatorSeedBarStart; process.env.SIM_END = spec.historyEnd;
  const core = await import("./hype-freerun-canonical-replay");
  const seed = Date.parse(spec.indicatorSeedBarStart), end = Date.parse(spec.historyEnd);
  console.log("[input] same fingerprinted I01 minute snapshot and explicit repair; no ladder replay");
  const minutes: Candle[] = (await core.loadCandles1m(spec.symbol, path.join(root, "data"), end, path.join(root, spec.repairFile)))
    .filter(c => c.ts >= seed).map(c => ({ timestamp: c.ts, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover }));
  assert.equal(minutes.length, prior.minuteRows); assert.equal(minutes.at(-1)!.timestamp + MINUTE, end);
  minutes.forEach((c, i) => assert.equal(c.timestamp, seed + i * MINUTE, "Minute continuity"));
  const baseFeatures = new Map<number, FeatureBar[]>(), features = new Map<string, FeatureBar[]>();
  const featureKey = (tf: number, period: number) => `${tf}:${period}`;
  let prefixChecks = 0;
  for (const tf of spec.timeframesMs as number[]) {
    const bars = ClosedBarSeries.fromHistorical(minutes, { sourceIntervalMs: MINUTE, targetIntervalMs: tf, publicationLagMs: 0 });
    const closed = bars.bars.map(b => b.candle), base = computeResearchFeatures(closed, tf);
    const oldRows = bars.bars.map((b, i) => ({ ...b, feature: base[i] })); baseFeatures.set(tf, oldRows);
    for (const period of spec.lookbackBars as number[]) {
      const values = computeRocValues(closed, tf, period);
      if (period === 5) values.forEach((v, i) => assert.equal(v, base[i].roc5, "Original ROC5 exact math"));
      const rows = bars.bars.map((b, i) => ({ ...b, feature: { ...base[i], roc: values[i], rocLookbackBars: period } }));
      features.set(featureKey(tf, period), rows);
      for (const i of [800, Math.floor(rows.length / 2), rows.length - 3]) {
        const at = rows[i].barEnd;
        const prefix = ClosedBarSeries.fromHistorical(minutes.slice(0, (at - seed) / MINUTE), { sourceIntervalMs: MINUTE, targetIntervalMs: tf, publicationLagMs: 0 });
        assert.deepEqual(computeRocValues(prefix.bars.map(b => b.candle), tf, period).at(-1), rows[i].feature.roc);
        const lookup = bars.windowAt(at, i + 1); assert(lookup.ready); assert.equal(lookup.availableAt, at); prefixChecks++;
      }
    }
    console.log(`[features] ${tf / MINUTE}m ${oldRows.length} closed bars; three lags / nine actual-data prefix checks passed`);
  }
  const rules: RocRule[] = [];
  for (const timeframeMs of spec.timeframesMs) for (const lookbackBars of spec.lookbackBars) {
    for (const magnitudePct of [0, ...spec.magnitudesPct]) for (const mode of magnitudePct === 0 ? ["momentum"] : spec.entryModes)
      for (const side of spec.sides) for (const exit of spec.exits) rules.push({
        id: `roc_${timeframeMs / MINUTE}m_n${lookbackBars}_m${magnitudePct}_${mode}_${side}_${exit}`,
        family: "roc", side, exit, timeframeMs, lookbackBars, magnitudePct, mode });
  }
  const controls: RocRule[] = spec.sides.map((side: "long" | "short") => ({ id: `clock_${side}`, family: "clock", side,
    exit: "fixed12h", timeframeMs: HOUR, lookbackBars: 5, magnitudePct: 0, mode: "momentum" }));
  assert.equal(rules.length, 600); assert.equal(new Set(rules.map(r => r.id)).size, 600);
  // Added ROC/lag provenance is checked before projecting the legacy ledger.
  const legacyTrades = (ts: any[]) => ts.map(t => {
    if (!t.entryFeature || !("roc" in t.entryFeature)) return t;
    const { roc, rocLookbackBars, ...entryFeature } = t.entryFeature;
    assert.equal(rocLookbackBars, 5); assert.equal(roc, entryFeature.roc5);
    return { ...t, entryFeature };
  });
  const options = (w: any, delayMs: number): StandaloneOptions => ({ start: Date.parse(w.start), end: Date.parse(w.end), delayMs,
    notional: spec.notionalUsdt, equity: spec.initialEquity, feeRate: spec.feeRatePerSide, holdMs: spec.holdMs });
  const priorResults = read(path.join(priorDir, "results.json")), priorMonthly = read(path.join(priorDir, "monthly.json"));
  const priorTrades = fs.readFileSync(path.join(priorDir, "trades.jsonl"), "utf8").trim().split(/\r?\n/).map(s => JSON.parse(s));
  const cache = new Map<string, RocResult>(), parity: any[] = [];
  for (const w of spec.windows) for (const delayMs of spec.executionDelaysMs) {
    for (const r of [...controls, ...rules.filter(r => r.timeframeMs === HOUR && r.lookbackBars === 5 && r.magnitudePct === 0)]) {
      const oldRule: StandaloneRule = { id: r.family === "clock" ? r.id : `roc_cross_${r.side}_${r.exit}`,
        family: r.family === "clock" ? "clock" : "roc_cross", side: r.side, exit: r.exit };
      const old = runStandalone(minutes, baseFeatures.get(HOUR)!, oldRule, options(w, delayMs));
      const fresh = runRocStandalone(minutes, r.family === "clock" ? baseFeatures.get(HOUR)! : features.get(featureKey(HOUR, 5))!, r, options(w, delayMs));
      assert.deepEqual(fresh.stats, old.stats); assert.deepEqual(legacyTrades(fresh.trades), old.trades);
      assert.deepEqual(fresh.monthly, old.monthly); assert.deepEqual(fresh.open, old.open);
      const saved = priorResults.find((x: any) => x.window === w.id && x.delayMs === delayMs && x.id === oldRule.id); assert(saved);
      for (const [f, value] of Object.entries(old.stats)) assert.deepEqual(saved[f], value, `Saved I01 stat mismatch ${oldRule.id}/${f}`);
      assert.deepEqual(saved.open, old.open);
      const storedTrades = priorTrades.filter(x => x.window === w.id && x.delayMs === delayMs && x.id === oldRule.id)
        .map(({ window, delayMs, id, ...t }: any) => t);
      // JSON archival format canonicalizes IEEE -0 to 0. Engine-to-engine
      // comparison above remains strict; compare serialized ledgers to disk.
      assert.deepEqual(JSON.parse(JSON.stringify(old.trades)), storedTrades);
      for (const m of old.monthly) {
        const p = priorMonthly.find((x: any) => x.window === w.id && x.delayMs === delayMs && x.id === oldRule.id && x.month === m.month); assert(p);
        for (const [f, value] of Object.entries(m)) assert.deepEqual(p[f], value);
      }
      cache.set(key(w.id, delayMs, r.id), fresh);
      parity.push({ window: w.id, delayMs, id: r.id, priorId: oldRule.id, trades: fresh.stats.trades, net: fresh.stats.net, exactLedgerStatsMonths: true });
    }
  }
  assert.equal(parity.length, 24); console.log("[parity] all 24 overlapping old/new cases match saved I01 ledgers, stats and months exactly");
  fs.mkdirSync(out, { recursive: true });
  json(path.join(out, "manifest.json"), { spec, node: process.version, sources, inputs, minuteRows: minutes.length, seed,
    formulaVersion: RESEARCH_FEATURE_FORMULA_VERSION + "|roc-unrounded-lags-1-5-12-v1", timingVersion: CLOSED_BAR_TIMING_VERSION,
    closedBars: [...baseFeatures].map(([timeframeMs, rows]) => ({ timeframeMs, count: rows.length })),
    availability: { mode: "modeled_bar_end", publicationLagMs: 0 }, missingMinutes: 0 });
  json(path.join(out, "overlap-parity.json"), parity);
  const results: any[] = [], monthly: any[] = [], traces: any[] = [];
  const ledgerFile = path.join(out, "trades.jsonl"); fs.writeFileSync(ledgerFile, "", { flag: "wx" });
  for (const w of spec.windows) for (const delayMs of spec.executionDelaysMs) for (const rule of [...controls, ...rules]) {
    const rows = rule.family === "clock" ? baseFeatures.get(rule.timeframeMs)! : features.get(featureKey(rule.timeframeMs, rule.lookbackBars))!;
    const r = cache.get(key(w.id, delayMs, rule.id)) ?? runRocStandalone(minutes, rows, rule, options(w, delayMs));
    const baseline = rule.family === "clock" ? null : results.find(x => x.window === w.id && x.delayMs === delayMs && x.id === `clock_${rule.side}`);
    results.push({ window: w.id, start: w.start, end: w.end, delayMs, ...rule, ...r.stats,
      baselineId: baseline?.id ?? null, deltaVsClock: baseline ? r.stats.net - baseline.net : null,
      deltaVsOwnFixed12h: rule.exit === "indicator_or12h" ? r.stats.net - results.find(x => x.window === w.id && x.delayMs === delayMs && x.id === rule.id.replace("indicator_or12h", "fixed12h")).net : null, stressNet: r.stats.net - r.stats.turnoverIncludingMarkedExit * spec.extraFixedPathCostBpsPerSide / 10000, open: r.open });
    for (const m of r.monthly) {
      const b = baseline ? monthly.find(x => x.window === w.id && x.delayMs === delayMs && x.id === baseline.id && x.month === m.month) : null;
      monthly.push({ window: w.id, delayMs, id: rule.id, ...m, baselineId: baseline?.id ?? null,
        baselineMarkedNet: b?.markedNet ?? null, markedDelta: b ? m.markedNet - b.markedNet : null });
    }
    if (r.trades.length) fs.appendFileSync(ledgerFile, r.trades.map(t => JSON.stringify({ window: w.id, delayMs, id: rule.id, ...t })).join("\n") + "\n");
    if (rule.family !== "clock" && w.id === "full" && delayMs === 0 && r.trades.length) {
      const trade = r.trades[0], i = rows.findIndex(b => b.barEnd === trade.signalAt);
      assert(i > 0); assert(rocEntrySignal(rule, rows[i - 1], rows[i]));
      traces.push({ rule, previousBarStart: rows[i - 1].candle.timestamp, previousRoc: (rows[i - 1].feature as any).roc,
        currentBarStart: rows[i].candle.timestamp, currentRoc: (rows[i].feature as any).roc, availableAt: rows[i].availableAt,
        denominatorBarStart: rows[i - rule.lookbackBars].candle.timestamp, denominatorClose: rows[i - rule.lookbackBars].candle.close,
        numeratorClose: rows[i].candle.close, previousDenominatorBarStart: rows[i - 1 - rule.lookbackBars].candle.timestamp,
        signalAt: trade.signalAt, entryAt: trade.entryAt, entryPrice: trade.entryPrice, exitAt: trade.exitAt });
    }
    if (results.length % 20 === 0 || rule.family === "clock") console.log(`[case] ${w.id} delay=${delayMs / MINUTE}m ${rule.id} n=${r.stats.trades} net=${r.stats.net.toFixed(2)}`);
  }
  assert.equal(results.length, 2408);
  json(path.join(out, "results.json"), results); json(path.join(out, "monthly.json"), monthly);
  core.writeCsv(path.join(out, "summary.csv"), results.map(({ open, ...r }) => r)); core.writeCsv(path.join(out, "monthly.csv"), monthly);
  json(path.join(out, "causal-traces.json"), traces);
  json(path.join(out, "context-controls.json"), spec.windows.map((w: any) => {
    const a = minutes[(Date.parse(w.start) - seed) / MINUTE], b = minutes[(Date.parse(w.end) - seed) / MINUTE - 1];
    const qty = spec.notionalUsdt / a.open, gross = qty * (b.close - a.open), fee = qty * (a.open + b.close) * spec.feeRatePerSide;
    return { window: w.id, cashNet: 0, entryPrice: a.open, finalMark: b.close, notional: spec.notionalUsdt,
      buyHoldLongPricePnl: gross, buyHoldLongFeesIncludingMarkedExit: fee, buyHoldLongNetBeforeFunding: gross - fee };
  }));
  const rankings = rules.map(rule => {
    const cases = results.filter(x => x.id === rule.id), months = monthly.filter(x => x.id === rule.id), failures: string[] = [];
    if (cases.some(x => x.trades < (x.window === "full" ? 30 : 10))) failures.push("insufficient_trade_count");
    if (cases.some(x => x.net <= 0)) failures.push("not_positive_all_windows_delays");
    if (cases.some(x => x.deltaVsClock <= 0)) failures.push("not_above_clock_all_windows_delays");
    if (months.some(x => x.markedDelta < -1e-8)) failures.push("monthly_regression_vs_clock");
    if (cases.some(x => x.stressNet <= 0)) failures.push("extra_cost_stress_nonpositive");
    if (cases.some(x => x.bankrupt)) failures.push("account_equity_exhausted_in_diagnostic");
    return { ...rule, passesResearchScreen: failures.length === 0, failures,
      minNet: Math.min(...cases.map(x => x.net)), minDelta: Math.min(...cases.map(x => x.deltaVsClock)),
      fullZeroDelayDelta: cases.find(x => x.window === "full" && x.delayMs === 0).deltaVsClock,
      worstMonthlyDelta: Math.min(...months.map(x => x.markedDelta)), deploymentCandidate: false };
  }).sort((a, b) => b.fullZeroDelayDelta - a.fullZeroDelayDelta);
  json(path.join(out, "ranking.json"), rankings);
  // This descriptive shortlist is frozen in the card; it is NOT a relaxed
  // replacement for the strict monthly/clock research screen.
  const eligible = rules.filter(rule => {
    const cs = results.filter(x => x.id === rule.id);
    return cs.every(x => x.trades >= (x.window === "full" ? 30 : 10) && x.net > 0 && x.stressNet > 0 && !x.bankrupt);
  }).sort((a, b) => results.find(x => x.id === b.id && x.window === "full" && x.delayMs === 0).net
    - results.find(x => x.id === a.id && x.window === "full" && x.delayMs === 0).net);
  json(path.join(out, "shortlist.json"), { interpretation: "Descriptive positive/cost/sample subset; retain monthly/clock failures, no live approval.",
    eligibleIds: eligible.map(x => x.id), topFiveIds: (eligible.length ? eligible : rankings).slice(0, 5).map(x => x.id) });
  let enginePrefixChecks = 0;
  const checkEnd = Date.parse("2025-08-01T00:00:00Z");
  for (const rule of rules) {
    const opts = { ...options(spec.windows[0], MINUTE), end: checkEnd };
    const rows = features.get(featureKey(rule.timeframeMs, rule.lookbackBars))!;
    assert.deepEqual(runRocStandalone(minutes, rows, rule, opts), runRocStandalone(
      minutes.slice(0, (checkEnd - seed) / MINUTE), rows.filter(b => b.barEnd <= checkEnd), rule, opts));
    enginePrefixChecks++;
  }
  for (const p of [...sources, ...inputs]) assert.equal(await sha(path.join(root, p.file)), p.sha256, `Source/input changed during run: ${p.file}`);
  json(path.join(out, "validation.json"), { missingMinutes: 0, overlapParityCases: parity.length, exactSavedOverlap: true,
    actualDataFeaturePrefixChecks: prefixChecks, actualDataEnginePrefixChecks: enginePrefixChecks,
    strategyDefinitions: rules.length, newDefinitions: 596, repeatedDefinitions: 4, controls: 2, strategyCases: 2400, controlCases: 8,
    inputAndSourceHashesUnchanged: true, liveChanges: 0, fundingIncluded: false,
    passedResearchScreen: rankings.filter(r => r.passesResearchScreen).map(r => r.id), deploymentCandidates: [] });
  console.log(`[done] ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
