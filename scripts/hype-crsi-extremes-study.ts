/** Frozen CRSI-only standalone research. New local artifacts; no live/config writes. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import { ClosedBarSeries, CLOSED_BAR_TIMING_VERSION } from "../src/research/closed-bars";
import { computeResearchFeatures, RESEARCH_FEATURE_FORMULA_VERSION } from "../src/research/indicator-features";
import { HOUR, MINUTE, runStandalone, type FeatureBar, type StandaloneOptions, type StandaloneRule } from "./indicator-standalone-engine";
import { runCrsiStandalone, crsiEntrySignal, type CrsiRule, type CrsiResult } from "./crsi-extremes-engine";

const root = path.resolve(__dirname, "..");
const definition = "research-inputs/indicators/crsi-extremes-2026-09-05.json";
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const json = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
async function sha(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
const key = (w: string, d: number, id: string) => `${w}|${d}|${id}`;

async function main() {
  const spec = read(path.join(root, definition));
  assert.deepEqual(spec.timeframesMs, [15 * MINUTE, 30 * MINUTE, HOUR]);
  assert.deepEqual(spec.upperLevels, [80, 90, 95]); assert.deepEqual(spec.entryModes, ["into", "back_out"]);
  assert.deepEqual(spec.sides, ["long", "short"]); assert.deepEqual(spec.executionDelaysMs, [0, MINUTE]);
  assert.equal(spec.holdMs, 12 * HOUR); assert.equal(spec.strategyDefinitionCount, 36); assert.equal(spec.symbol, "HYPEUSDT");
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
  const sourceFiles = [definition, "scripts/crsi-extremes-engine.ts", "scripts/hype-crsi-extremes-study.ts",
    "scripts/crsi-extremes-tests.ts", "scripts/crsi-extremes-results-check.ts",
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
  const features = new Map<number, FeatureBar[]>(); let prefixChecks = 0;
  for (const tf of spec.timeframesMs as number[]) {
    const bars = ClosedBarSeries.fromHistorical(minutes, { sourceIntervalMs: MINUTE, targetIntervalMs: tf, publicationLagMs: 0 });
    const values = computeResearchFeatures(bars.bars.map(b => b.candle), tf);
    const rows = bars.bars.map((b, i) => ({ ...b, feature: values[i] })); features.set(tf, rows);
    for (const i of [800, Math.floor(rows.length / 2), rows.length - 3]) {
      const at = rows[i].barEnd;
      const prefix = ClosedBarSeries.fromHistorical(minutes.slice(0, (at - seed) / MINUTE), { sourceIntervalMs: MINUTE, targetIntervalMs: tf, publicationLagMs: 0 });
      assert.deepEqual(computeResearchFeatures(prefix.bars.map(b => b.candle), tf).at(-1), rows[i].feature);
      const lookup = bars.windowAt(at, i + 1); assert(lookup.ready); assert.equal(lookup.availableAt, at); prefixChecks++;
    }
    console.log(`[features] ${tf / MINUTE}m ${rows.length} closed bars; three actual-data prefix checks passed`);
  }
  const rules: CrsiRule[] = spec.timeframesMs.flatMap((timeframeMs: number) => spec.upperLevels.flatMap((upper: number) =>
    spec.entryModes.flatMap((mode: "into" | "back_out") => spec.sides.map((side: "long" | "short") => ({
      id: `crsi_${timeframeMs / MINUTE}m_${upper}_${mode}_${side}`, family: "crsi_extreme", side, exit: "fixed12h", timeframeMs, upper, mode })))));
  const controls: CrsiRule[] = spec.sides.map((side: "long" | "short") => ({ id: `clock_${side}`, family: "clock", side,
    exit: "fixed12h", timeframeMs: HOUR, upper: 80, mode: "back_out" }));
  assert.equal(rules.length, 36); assert.equal(new Set(rules.map(r => r.id)).size, 36);
  const options = (w: any, delayMs: number): StandaloneOptions => ({ start: Date.parse(w.start), end: Date.parse(w.end), delayMs,
    notional: spec.notionalUsdt, equity: spec.initialEquity, feeRate: spec.feeRatePerSide, holdMs: spec.holdMs });
  const priorResults = read(path.join(priorDir, "results.json")), priorMonthly = read(path.join(priorDir, "monthly.json"));
  const priorTrades = fs.readFileSync(path.join(priorDir, "trades.jsonl"), "utf8").trim().split(/\r?\n/).map(s => JSON.parse(s));
  const cache = new Map<string, CrsiResult>(), parity: any[] = [];
  for (const w of spec.windows) for (const delayMs of spec.executionDelaysMs) {
    for (const r of [...controls, ...rules.filter(r => r.timeframeMs === HOUR && r.upper === 80 && r.mode === "back_out")]) {
      const oldRule: StandaloneRule = { id: r.family === "clock" ? r.id : `crsi_recovery_${r.side}_fixed12h`,
        family: r.family === "clock" ? "clock" : "crsi_recovery", side: r.side, exit: "fixed12h" };
      const old = runStandalone(minutes, features.get(HOUR)!, oldRule, options(w, delayMs));
      const fresh = runCrsiStandalone(minutes, features.get(HOUR)!, r, options(w, delayMs));
      assert.deepEqual(fresh.stats, old.stats); assert.deepEqual(fresh.trades, old.trades);
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
  assert.equal(parity.length, 16); console.log("[parity] all 16 overlapping old/new cases match saved I01 ledgers, stats and months exactly");
  fs.mkdirSync(out, { recursive: true });
  json(path.join(out, "manifest.json"), { spec, node: process.version, sources, inputs, minuteRows: minutes.length, seed,
    formulaVersion: RESEARCH_FEATURE_FORMULA_VERSION, timingVersion: CLOSED_BAR_TIMING_VERSION,
    closedBars: [...features].map(([timeframeMs, rows]) => ({ timeframeMs, count: rows.length })),
    availability: { mode: "modeled_bar_end", publicationLagMs: 0 }, missingMinutes: 0 });
  json(path.join(out, "overlap-parity.json"), parity);
  const results: any[] = [], monthly: any[] = [], trades: any[] = [], traces: any[] = [];
  for (const w of spec.windows) for (const delayMs of spec.executionDelaysMs) for (const rule of [...controls, ...rules]) {
    const rows = features.get(rule.timeframeMs)!;
    const r = cache.get(key(w.id, delayMs, rule.id)) ?? runCrsiStandalone(minutes, rows, rule, options(w, delayMs));
    const baseline = rule.family === "clock" ? null : results.find(x => x.window === w.id && x.delayMs === delayMs && x.id === `clock_${rule.side}`);
    results.push({ window: w.id, start: w.start, end: w.end, delayMs, ...rule, ...r.stats,
      baselineId: baseline?.id ?? null, deltaVsClock: baseline ? r.stats.net - baseline.net : null,
      deltaVsOwnFixed12h: null, stressNet: r.stats.net - r.stats.turnoverIncludingMarkedExit * spec.extraFixedPathCostBpsPerSide / 10000, open: r.open });
    for (const m of r.monthly) {
      const b = baseline ? monthly.find(x => x.window === w.id && x.delayMs === delayMs && x.id === baseline.id && x.month === m.month) : null;
      monthly.push({ window: w.id, delayMs, id: rule.id, ...m, baselineId: baseline?.id ?? null,
        baselineMarkedNet: b?.markedNet ?? null, markedDelta: b ? m.markedNet - b.markedNet : null });
    }
    trades.push(...r.trades.map(t => ({ window: w.id, delayMs, id: rule.id, ...t })));
    if (rule.family !== "clock" && w.id === "full" && delayMs === 0 && r.trades.length) {
      const trade = r.trades[0], i = rows.findIndex(b => b.barEnd === trade.signalAt);
      assert(i > 0); assert(crsiEntrySignal(rule, rows[i - 1], rows[i]));
      traces.push({ rule, previousBarStart: rows[i - 1].candle.timestamp, previousCrsi: rows[i - 1].feature.crsi,
        currentBarStart: rows[i].candle.timestamp, currentCrsi: rows[i].feature.crsi, availableAt: rows[i].availableAt,
        signalAt: trade.signalAt, entryAt: trade.entryAt, entryPrice: trade.entryPrice, exitAt: trade.exitAt });
    }
    console.log(`[case] ${w.id} delay=${delayMs / MINUTE}m ${rule.id} n=${r.stats.trades} net=${r.stats.net.toFixed(2)}`);
  }
  assert.equal(results.length, 152);
  json(path.join(out, "results.json"), results); json(path.join(out, "monthly.json"), monthly);
  core.writeCsv(path.join(out, "summary.csv"), results.map(({ open, ...r }) => r)); core.writeCsv(path.join(out, "monthly.csv"), monthly);
  fs.writeFileSync(path.join(out, "trades.jsonl"), trades.map(t => JSON.stringify(t)).join("\n") + "\n", { flag: "wx" });
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
  let enginePrefixChecks = 0;
  const checkEnd = Date.parse("2025-08-01T00:00:00Z");
  for (const rule of rules) {
    const opts = { ...options(spec.windows[0], MINUTE), end: checkEnd };
    const rows = features.get(rule.timeframeMs)!;
    assert.deepEqual(runCrsiStandalone(minutes, rows, rule, opts), runCrsiStandalone(
      minutes.slice(0, (checkEnd - seed) / MINUTE), rows.filter(b => b.barEnd <= checkEnd), rule, opts));
    enginePrefixChecks++;
  }
  for (const p of [...sources, ...inputs]) assert.equal(await sha(path.join(root, p.file)), p.sha256, `Source/input changed during run: ${p.file}`);
  json(path.join(out, "validation.json"), { missingMinutes: 0, overlapParityCases: parity.length, exactSavedOverlap: true,
    actualDataFeaturePrefixChecks: prefixChecks, actualDataEnginePrefixChecks: enginePrefixChecks,
    strategyDefinitions: rules.length, newDefinitions: 34, controls: 2, strategyCases: 144, controlCases: 8,
    inputAndSourceHashesUnchanged: true, liveChanges: 0, fundingIncluded: false,
    passedResearchScreen: rankings.filter(r => r.passesResearchScreen).map(r => r.id), deploymentCandidates: [] });
  console.log(`[done] ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
