/** Frozen I03 risk/exit follow-up. Local artifacts only; no live mutation. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import { ClosedBarSeries, CLOSED_BAR_TIMING_VERSION } from "../src/research/closed-bars";
import { computeResearchFeatures, RESEARCH_FEATURE_FORMULA_VERSION } from "../src/research/indicator-features";
import { HOUR, MINUTE, type FeatureBar, type StandaloneOptions } from "./indicator-standalone-engine";
import { runCrsiStandalone, crsiEntrySignal, type CrsiRule } from "./crsi-extremes-engine";
import { runCrsiRiskExit, EXIT_POLICIES, type RiskExitRule, type RiskExitResult } from "./crsi-risk-exit-engine";

const root = path.resolve(__dirname, "..");
const definition = "research-inputs/indicators/crsi-risk-exit-2026-09-06.json";
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const json = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
async function sha(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
const key = (w: string, d: number, id: string) => `${w}|${d}|${id}`;
const oldId = (r: RiskExitRule) => `crsi_15m_95_${r.entryMode}_long`;
const baseId = (r: RiskExitRule) => `${oldId(r)}__baseline12h`;
const entryRule = (r: RiskExitRule): CrsiRule => ({ id: oldId(r), family: "crsi_extreme", side: "long",
  exit: "fixed12h", timeframeMs: 15 * MINUTE, upper: 95, mode: r.entryMode });

async function main() {
  const spec = read(path.join(root, definition));
  assert.equal(spec.timeframeMs, 15 * MINUTE); assert.equal(spec.upper, 95); assert.equal(spec.side, "long");
  assert.deepEqual(spec.entryModes, ["into", "back_out"]); assert.deepEqual(spec.exitPolicies, [...EXIT_POLICIES]);
  assert.deepEqual(spec.executionDelaysMs, [0, MINUTE]); assert.equal(spec.holdMs, 12 * HOUR);
  assert.equal(spec.strategyDefinitionCount, 14); assert.equal(spec.newDefinitionCount, 12); assert.equal(spec.symbol, "HYPEUSDT");
  const args = process.argv.slice(2);
  assert(args.length === 0 || (args.length === 2 && args[0] === "--out"), "Only --out NEW_DIRECTORY is supported");
  const out = path.resolve(root, args[1] ?? `backtests/hype/${spec.id}`), rel = path.relative(path.join(root, "backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Use NEW output directory inside backtests");
  const priorDir = path.join(root, spec.priorArtifactDirectory), prior = read(path.join(priorDir, "manifest.json"));
  const verified = read(path.join(priorDir, "verification.json")); assert.equal(verified.passed, true);
  for (const f of ["historyEnd", "indicatorSeedBarStart", "repairFile", "notionalUsdt", "initialEquity", "feeRatePerSide", "holdMs", "windows", "executionDelaysMs", "extraFixedPathCostBpsPerSide"])
    assert.deepEqual(spec[f], prior.spec[f], `Preserve I02 ${f}`);
  for (const p of [...prior.sources, ...prior.inputs]) assert.equal(await sha(path.join(root, p.file)), p.sha256, `I02 source/input drift: ${p.file}`);
  for (const p of verified.artifacts) assert.equal(await sha(path.join(priorDir, p.file)), p.sha256, `I02 evidence drift: ${p.file}`);
  const inputFiles: string[] = [...new Set<string>([...prior.inputs.map((p: any) => p.file),
    ...["manifest.json", "verification.json", "validation.json", "results.json", "monthly.json", "trades.jsonl", "context-controls.json"].map(f => `${spec.priorArtifactDirectory}/${f}`)])];
  const inputs = await Promise.all(inputFiles.map(async file => ({ file, sha256: await sha(path.join(root, file)), bytes: fs.statSync(path.join(root, file)).size })));
  const sourceFiles = [definition, "scripts/crsi-risk-exit-engine.ts", "scripts/hype-crsi-risk-exit-study.ts",
    "scripts/crsi-risk-exit-tests.ts", "scripts/crsi-risk-exit-results-check.ts", ...prior.sources.map((p: any) => p.file)] as string[];
  const sources = await Promise.all([...new Set(sourceFiles)].filter(f => !inputFiles.includes(f)).map(async file => ({ file, sha256: await sha(path.join(root, file)) })));
  process.env.SIM_START = spec.indicatorSeedBarStart; process.env.SIM_END = spec.historyEnd;
  const core = await import("./hype-freerun-canonical-replay");
  const seed = Date.parse(spec.indicatorSeedBarStart), end = Date.parse(spec.historyEnd);
  console.log("[input] same fingerprinted I02 minute snapshot and explicit repair; no ladder replay");
  const minutes: Candle[] = (await core.loadCandles1m(spec.symbol, path.join(root, "data"), end, path.join(root, spec.repairFile)))
    .filter(c => c.ts >= seed).map(c => ({ timestamp: c.ts, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover }));
  assert.equal(minutes.length, prior.minuteRows); assert.equal(minutes.at(-1)!.timestamp + MINUTE, end);
  minutes.forEach((c, i) => assert.equal(c.timestamp, seed + i * MINUTE, "Minute continuity"));
  const bars = ClosedBarSeries.fromHistorical(minutes, { sourceIntervalMs: MINUTE, targetIntervalMs: spec.timeframeMs, publicationLagMs: 0 });
  const values = computeResearchFeatures(bars.bars.map(b => b.candle), spec.timeframeMs);
  const rows: FeatureBar[] = bars.bars.map((b, i) => ({ ...b, feature: values[i] }));
  let prefixChecks = 0;
  for (const i of [800, Math.floor(rows.length / 2), rows.length - 3]) {
    const at = rows[i].barEnd;
    const prefix = ClosedBarSeries.fromHistorical(minutes.slice(0, (at - seed) / MINUTE), { sourceIntervalMs: MINUTE, targetIntervalMs: spec.timeframeMs, publicationLagMs: 0 });
    assert.deepEqual(computeResearchFeatures(prefix.bars.map(b => b.candle), spec.timeframeMs).at(-1), rows[i].feature);
    const lookup = bars.windowAt(at, i + 1); assert(lookup.ready); assert.equal(lookup.availableAt, at); prefixChecks++;
  }
  console.log(`[features] 15m ${rows.length} closed bars; three actual-data prefix checks passed`);
  const rules: RiskExitRule[] = spec.entryModes.flatMap((entryMode: RiskExitRule["entryMode"]) =>
    spec.exitPolicies.map((exitPolicy: RiskExitRule["exitPolicy"]) => ({ id: `crsi_15m_95_${entryMode}_long__${exitPolicy}`, entryMode, exitPolicy })));
  assert.equal(rules.length, 14); assert.equal(new Set(rules.map(r => r.id)).size, 14);
  const options = (w: any, delayMs: number): StandaloneOptions => ({ start: Date.parse(w.start), end: Date.parse(w.end), delayMs,
    notional: spec.notionalUsdt, equity: spec.initialEquity, feeRate: spec.feeRatePerSide, holdMs: spec.holdMs });
  const priorResults = read(path.join(priorDir, "results.json")), priorMonthly = read(path.join(priorDir, "monthly.json"));
  const priorTrades = fs.readFileSync(path.join(priorDir, "trades.jsonl"), "utf8").trim().split(/\r?\n/).map(s => JSON.parse(s));
  const cache = new Map<string, RiskExitResult>(), parity: any[] = [];
  // Assert every unchanged baseline before any variant result is evaluated.
  for (const w of spec.windows) for (const delayMs of spec.executionDelaysMs) for (const r of rules.filter(r => r.exitPolicy === "baseline12h")) {
    const old = runCrsiStandalone(minutes, rows, entryRule(r), options(w, delayMs));
    const fresh = runCrsiRiskExit(minutes, rows, r, options(w, delayMs));
    assert.deepEqual(fresh.stats, old.stats); assert.deepEqual(fresh.trades, old.trades);
    assert.deepEqual(fresh.monthly, old.monthly); assert.deepEqual(fresh.open, old.open);
    const saved = priorResults.find((x: any) => x.window === w.id && x.delayMs === delayMs && x.id === oldId(r)); assert(saved);
    for (const [f, value] of Object.entries(old.stats)) assert.deepEqual(saved[f], value, `Saved I02 stat mismatch ${oldId(r)}/${f}`);
    assert.deepEqual(saved.open, old.open);
    assert.deepEqual(JSON.parse(JSON.stringify(old.trades)), priorTrades.filter(x => x.window === w.id && x.delayMs === delayMs && x.id === oldId(r))
      .map(({ window, delayMs, id, ...t }: any) => t));
    for (const m of old.monthly) {
      const p = priorMonthly.find((x: any) => x.window === w.id && x.delayMs === delayMs && x.id === oldId(r) && x.month === m.month); assert(p);
      for (const [f, value] of Object.entries(m)) assert.deepEqual(p[f], value);
    }
    cache.set(key(w.id, delayMs, r.id), fresh);
    parity.push({ window: w.id, delayMs, id: r.id, priorId: oldId(r), trades: fresh.stats.trades, net: fresh.stats.net, exactLedgerStatsMonths: true });
  }
  assert.equal(parity.length, 8); console.log("[parity] all 8 unchanged baselines exactly match I02 saved ledgers, stats and months");
  fs.mkdirSync(out, { recursive: true });
  json(path.join(out, "manifest.json"), { spec, node: process.version, sources, inputs, minuteRows: minutes.length, seed,
    formulaVersion: RESEARCH_FEATURE_FORMULA_VERSION, timingVersion: CLOSED_BAR_TIMING_VERSION,
    closedBars: [{ timeframeMs: spec.timeframeMs, count: rows.length }], availability: { mode: "modeled_bar_end", publicationLagMs: 0 }, missingMinutes: 0 });
  json(path.join(out, "overlap-parity.json"), parity);
  const clock = priorResults.filter((r: any) => r.id === "clock_long"); assert.equal(clock.length, 4);
  json(path.join(out, "context-controls.json"), { clock, buyHold: read(path.join(priorDir, "context-controls.json")) });
  const results: any[] = [], monthly: any[] = [], trades: any[] = [], traces: any[] = [];
  for (const w of spec.windows) for (const delayMs of spec.executionDelaysMs) for (const rule of rules) {
    const r = cache.get(key(w.id, delayMs, rule.id)) ?? runCrsiRiskExit(minutes, rows, rule, options(w, delayMs));
    const baseline = rule.exitPolicy === "baseline12h" ? null : results.find(x => x.window === w.id && x.delayMs === delayMs && x.id === baseId(rule));
    if (rule.exitPolicy !== "baseline12h") assert(baseline);
    const clockNet = clock.find((x: any) => x.window === w.id && x.delayMs === delayMs).net;
    results.push({ window: w.id, start: w.start, end: w.end, delayMs, ...rule, side: "long", family: "crsi_risk_exit", ...r.stats,
      ownBaselineId: baseline?.id ?? null, deltaVsOwnBaseline: baseline ? r.stats.net - baseline.net : null,
      clockBaselineNet: clockNet, deltaVsClock: r.stats.net - clockNet,
      stressNet: r.stats.net - r.stats.turnoverIncludingMarkedExit * spec.extraFixedPathCostBpsPerSide / 10000, open: r.open });
    for (const m of r.monthly) {
      const b = baseline ? monthly.find(x => x.window === w.id && x.delayMs === delayMs && x.id === baseline.id && x.month === m.month) : null;
      monthly.push({ window: w.id, delayMs, id: rule.id, ...m, ownBaselineId: baseline?.id ?? null,
        baselineMarkedNet: b?.markedNet ?? null, markedDelta: b ? m.markedNet - b.markedNet : null });
    }
    trades.push(...r.trades.map(t => ({ window: w.id, delayMs, id: rule.id, ...t })));
    if (w.id === "full" && delayMs === 0 && r.trades.length) {
      const trade = r.trades[0], i = rows.findIndex(b => b.barEnd === trade.signalAt);
      assert(i > 0); assert(crsiEntrySignal(entryRule(rule), rows[i - 1], rows[i]));
      traces.push({ rule, previousBarStart: rows[i - 1].candle.timestamp, previousCrsi: rows[i - 1].feature.crsi,
        currentBarStart: rows[i].candle.timestamp, currentCrsi: rows[i].feature.crsi, availableAt: rows[i].availableAt,
        signalAt: trade.signalAt, entryAt: trade.entryAt, entryPrice: trade.entryPrice,
        exitDecisionAt: trade.exitDecisionAt, exitAt: trade.exitAt, exitPrice: trade.exitPrice, reason: trade.reason });
    }
    console.log(`[case] ${w.id} delay=${delayMs / MINUTE}m ${rule.id} n=${r.stats.trades} net=${r.stats.net.toFixed(2)}`);
  }
  assert.equal(results.length, 56);
  json(path.join(out, "results.json"), results); json(path.join(out, "monthly.json"), monthly);
  core.writeCsv(path.join(out, "summary.csv"), results.map(({ open, ...r }) => r)); core.writeCsv(path.join(out, "monthly.csv"), monthly);
  fs.writeFileSync(path.join(out, "trades.jsonl"), trades.map(t => JSON.stringify(t)).join("\n") + "\n", { flag: "wx" });
  json(path.join(out, "causal-traces.json"), traces);
  const rankings = rules.filter(r => r.exitPolicy !== "baseline12h").map(rule => {
    const cases = results.filter(x => x.id === rule.id), months = monthly.filter(x => x.id === rule.id), common: string[] = [];
    if (cases.some(x => x.trades < (x.window === "full" ? 30 : 10))) common.push("insufficient_trade_count");
    if (cases.some(x => x.net <= 0)) common.push("not_positive_all_windows_delays");
    if (cases.some(x => x.stressNet <= 0)) common.push("extra_cost_stress_nonpositive");
    if (cases.some(x => x.bankrupt)) common.push("account_equity_exhausted_in_diagnostic");
    const profitFailures = [...common], defensiveFailures = [...common];
    if (cases.some(x => x.deltaVsOwnBaseline <= 0)) profitFailures.push("not_above_own_baseline_all_cases");
    if (months.some(x => x.markedDelta < -1e-8)) profitFailures.push("monthly_regression_vs_own_baseline");
    if (months.some(x => x.markedDelta < -500 - 1e-8)) defensiveFailures.push("monthly_regression_exceeds_500");
    for (const c of cases) {
      const b = results.find(x => x.window === c.window && x.delayMs === c.delayMs && x.id === baseId(rule)); assert(b && b.net > 0);
      if (c.net < b.net * 0.9 - 1e-8) defensiveFailures.push(`net_retention_below_90pct:${c.window}:${c.delayMs}`);
      if (c.maxAdverseDrawdownPct > b.maxAdverseDrawdownPct + 1e-8) defensiveFailures.push(`adverse_dd_worse:${c.window}:${c.delayMs}`);
      if (c.window === "full" && c.maxAdverseDrawdownPct > b.maxAdverseDrawdownPct * 0.8 + 1e-8)
        defensiveFailures.push(`full_dd_reduction_below_20pct:${c.delayMs}`);
    }
    return { ...rule, passesProfitScreen: !profitFailures.length, passesDefensiveScreen: !defensiveFailures.length,
      profitFailures, defensiveFailures, minNet: Math.min(...cases.map(x => x.net)), minDelta: Math.min(...cases.map(x => x.deltaVsOwnBaseline)),
      fullZeroDelayDelta: cases.find(x => x.window === "full" && x.delayMs === 0).deltaVsOwnBaseline,
      worstMonthlyDelta: Math.min(...months.map(x => x.markedDelta)), deploymentCandidate: false };
  }).sort((a, b) => b.fullZeroDelayDelta - a.fullZeroDelayDelta);
  json(path.join(out, "ranking.json"), rankings);
  let enginePrefixChecks = 0;
  const checkEnd = Date.parse("2025-08-01T00:00:00Z");
  for (const rule of rules) {
    const opts = { ...options(spec.windows[0], MINUTE), end: checkEnd };
    assert.deepEqual(runCrsiRiskExit(minutes, rows, rule, opts), runCrsiRiskExit(
      minutes.slice(0, (checkEnd - seed) / MINUTE), rows.filter(b => b.barEnd <= checkEnd), rule, opts));
    enginePrefixChecks++;
  }
  for (const p of [...sources, ...inputs]) assert.equal(await sha(path.join(root, p.file)), p.sha256, `Source/input changed during run: ${p.file}`);
  json(path.join(out, "validation.json"), { missingMinutes: 0, overlapParityCases: parity.length, exactSavedOverlap: true,
    actualDataFeaturePrefixChecks: prefixChecks, actualDataEnginePrefixChecks: enginePrefixChecks,
    strategyDefinitions: rules.length, newDefinitions: 12, baselineDefinitions: 2, variantCases: 48, baselineCases: 8,
    inputAndSourceHashesUnchanged: true, liveChanges: 0, fundingIncluded: false,
    passedProfitScreen: rankings.filter(r => r.passesProfitScreen).map(r => r.id),
    passedDefensiveScreen: rankings.filter(r => r.passesDefensiveScreen).map(r => r.id), deploymentCandidates: [] });
  console.log(`[done] ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
