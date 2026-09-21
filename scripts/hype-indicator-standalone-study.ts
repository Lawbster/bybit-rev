/** Frozen stages1-2 research. Generates NEW local artifacts, never trading/state/config writes. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import { ClosedBarSeries, CLOSED_BAR_TIMING_VERSION } from "../src/research/closed-bars";
import { computeResearchFeatures, RESEARCH_FEATURE_FORMULA_VERSION, RESEARCH_FEATURE_METADATA } from "../src/research/indicator-features";
import { entrySignal, runStandalone, HOUR, MINUTE, type Family, type StandaloneRule, type FeatureBar } from "./indicator-standalone-engine";

const hash = (x: string | Buffer) => crypto.createHash("sha256").update(x).digest("hex");
async function fileHash(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
const json = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const median = (xs: number[]) => { if (!xs.length) return null; const a = [...xs].sort((a, b) => a - b); return (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2; };

async function main() {
  const root = path.resolve(__dirname, ".."), definition = "research-inputs/indicators/standalone-2026-09-05.json";
  const spec = JSON.parse(fs.readFileSync(path.join(root, definition), "utf8"));
  const end = Date.parse(spec.historyEnd), seed = Date.parse(spec.indicatorSeedBarStart);
  assert.equal(spec.timeframeMs, HOUR); assert.equal(spec.strategyDefinitionCount, 16);
  assert.deepEqual(spec.families, ["rsi_recovery", "crsi_recovery", "roc_cross", "vwap_cross"]);
  assert.deepEqual(spec.exits, ["fixed12h", "indicator_or12h"]);
  assert.deepEqual(spec.sides, ["long", "short"]); assert.deepEqual(spec.executionDelaysMs, [0, MINUTE]);
  assert.equal(spec.holdMs, 12 * HOUR); assert.equal(spec.symbol, "HYPEUSDT");
  const args = process.argv.slice(2);
  assert(args.length === 0 || (args.length === 2 && args[0] === "--out"), "Only optional --out NEW_DIRECTORY is supported");
  const out = path.resolve(root, args[1] ?? `backtests/hype/${spec.id}`);
  const rel = path.relative(path.join(root, "backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Use a NEW output directory inside backtests");
  const repair = JSON.parse(fs.readFileSync(path.join(root, spec.repairFile), "utf8"));
  const inputFiles = repair.originalInputs.map((x: any) => x.file).concat(spec.repairFile);
  const sources = [definition, "src/research/indicator-features.ts", "src/research/closed-bars.ts",
    "scripts/indicator-feature-tests.ts", "scripts/indicator-standalone-engine.ts", "scripts/indicator-standalone-tests.ts",
    "scripts/hype-indicator-standalone-study.ts", "scripts/hype-freerun-canonical-replay.ts",
    "scripts/replay-candle-repair.ts", "scripts/replay-causality.ts", "package-lock.json"]
    .map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) }));
  const inputs = [];
  for (const file of inputFiles) {
    const sha256 = await fileHash(path.join(root, file)), expected = repair.originalInputs.find((x: any) => x.file === file);
    if (expected) assert.equal(sha256, expected.sha256, `Pinned historical snapshot changed: ${file}`);
    inputs.push({ file, bytes: fs.statSync(path.join(root, file)).size, sha256 });
  }
  // Canonical candle loader only: no ladder/variant sweep is called.
  process.env.SIM_START = spec.indicatorSeedBarStart; process.env.SIM_END = spec.historyEnd;
  const core = await import("./hype-freerun-canonical-replay");
  console.log("[input] validating raw volume/turnover provenance, canonical loader and explicit repair");
  const badVolume = new Set<number>(); let auditedRawRows = 0;
  const auditRaw = (r: Record<string, any>) => {
    const ts = Number(r.timestamp ?? r.ts);
    // Mirror the canonical loader's row acceptance before applying its duplicate
    // precedence; a malformed later row cannot validate an earlier imputed one.
    if (![ts, Number(r.open ?? r.o), Number(r.high ?? r.h), Number(r.low ?? r.l), Number(r.close ?? r.c)].every(Number.isFinite)) return;
    if (ts < seed || ts + MINUTE > end) return;
    const volume = r.volume ?? r.v, turnover = r.turnover ?? r.t;
    if (volume == null || turnover == null || !Number.isFinite(Number(volume)) || !Number.isFinite(Number(turnover))
      || Number(volume) < 0 || Number(turnover) < 0 || (Number(volume) > 0 && Number(turnover) === 0)) badVolume.add(ts);
    else badVolume.delete(ts); // canonical overlap precedence: later JSONL wins
    auditedRawRows++;
  };
  JSON.parse(fs.readFileSync(path.join(root, `data/${spec.symbol}_1_full.json`), "utf8")).forEach(auditRaw);
  await core.streamJsonl(path.join(root, `data/${spec.symbol}_1m.jsonl`), auditRaw);
  assert.equal(badVolume.size, 0, "VWAP study requires actual turnover, not loader-imputed close*volume");
  const canonical = await core.loadCandles1m(spec.symbol, path.join(root, "data"), end, path.join(root, spec.repairFile));
  const minutes: Candle[] = canonical.filter(c => c.ts >= seed).map(c => ({ timestamp: c.ts,
    open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover }));
  assert.equal(minutes[0].timestamp, seed); assert.equal(minutes.at(-1)!.timestamp + MINUTE, end);
  minutes.forEach((c, i) => assert.equal(c.timestamp, seed + i * MINUTE, "Missing source minute after verified repair"));
  const bars = ClosedBarSeries.fromHistorical(minutes, { sourceIntervalMs: MINUTE, targetIntervalMs: HOUR, publicationLagMs: 0 });
  assert.equal(bars.bars[0].candle.timestamp, seed);
  const values = computeResearchFeatures(bars.bars.map(b => b.candle), HOUR);
  const features: FeatureBar[] = bars.bars.map((b, i) => ({ ...b, feature: values[i] }));
  const byTs = new Map(minutes.map((c, i) => [c.timestamp, i]));
  // Actual-data prefix tests before inspecting a single strategy result.
  for (const index of [800, Math.floor(features.length / 2), features.length - 3]) {
    const at = features[index].barEnd;
    const prefixSource = minutes.filter(c => c.timestamp + MINUTE <= at);
    const prefixBars = ClosedBarSeries.fromHistorical(prefixSource, { sourceIntervalMs: MINUTE, targetIntervalMs: HOUR, publicationLagMs: 0 });
    const prefixValues = computeResearchFeatures(prefixBars.bars.map(b => b.candle), HOUR);
    assert.deepEqual(prefixValues.at(-1), features[index].feature);
    const window = bars.windowAt(at, index + 1); assert(window.ready); assert.equal(window.availableAt, at);
  }
  fs.mkdirSync(out, { recursive: true });
  json(path.join(out, "manifest.json"), { spec, node: process.version, sources, inputs,
    formulaVersion: RESEARCH_FEATURE_FORMULA_VERSION, formulas: RESEARCH_FEATURE_METADATA,
    timingVersion: CLOSED_BAR_TIMING_VERSION, availability: bars.availability, seed, minuteRows: minutes.length,
    hourlyBars: features.length, auditedRawRows, missingMinutes: 0, imputedTurnoverRows: 0,
    caveats: [spec.funding, spec.selectionLimit, spec.baselineBoundary] });
  const rules: StandaloneRule[] = spec.families.flatMap((family: Family) => spec.sides.flatMap((side: "long" | "short") =>
    spec.exits.map((exit: "fixed12h" | "indicator_or12h") => ({ id: `${family}_${side}_${exit}`, family, side, exit }))));
  const controls: StandaloneRule[] = spec.sides.map((side: "long" | "short") => ({ id: `clock_${side}`, family: "clock", side, exit: "fixed12h" }));
  const results: any[] = [], monthly: any[] = [], trades: any[] = [];
  for (const window of spec.windows) for (const delayMs of spec.executionDelaysMs) {
    for (const rule of [...controls, ...rules]) {
      const o = { start: Date.parse(window.start), end: Date.parse(window.end), delayMs,
        notional: spec.notionalUsdt, equity: spec.initialEquity, feeRate: spec.feeRatePerSide, holdMs: spec.holdMs };
      const r = runStandalone(minutes, features, rule, o);
      const isControl = rule.family === "clock";
      const baseline = isControl ? null : results.find(x => x.window === window.id && x.delayMs === delayMs && x.id === `clock_${rule.side}`);
      const fixed = rule.exit === "indicator_or12h" ? results.find(x => x.window === window.id && x.delayMs === delayMs && x.id === `${rule.family}_${rule.side}_fixed12h`) : null;
      const summary = { window: window.id, start: window.start, end: window.end, delayMs, ...rule, ...r.stats,
        baselineId: baseline?.id ?? null, deltaVsClock: baseline ? r.stats.net - baseline.net : null,
        deltaVsOwnFixed12h: fixed ? r.stats.net - fixed.net : null,
        stressNet: r.stats.net - r.stats.turnoverIncludingMarkedExit * spec.extraFixedPathCostBpsPerSide / 10000,
        open: r.open };
      results.push(summary);
      for (const m of r.monthly) {
        const b = baseline ? monthly.find(x => x.window === window.id && x.delayMs === delayMs && x.id === baseline.id && x.month === m.month) : null;
        monthly.push({ window: window.id, delayMs, id: rule.id, ...m, baselineId: baseline?.id ?? null,
          baselineMarkedNet: b?.markedNet ?? null, markedDelta: b ? m.markedNet - b.markedNet : null });
      }
      trades.push(...r.trades.map(t => ({ window: window.id, delayMs, id: rule.id, ...t })));
      console.log(`[case] ${window.id} delay=${delayMs / MINUTE}m ${rule.id} n=${r.stats.trades} net=${r.stats.net.toFixed(2)} dd=${r.stats.maxAdverseDrawdownPct.toFixed(2)}%`);
    }
  }
  assert.equal(results.length, spec.strategyWindowDelayCases + spec.controlWindowDelayCases);
  json(path.join(out, "results.json"), results); core.writeCsv(path.join(out, "summary.csv"), results.map(({ open, ...x }) => x));
  core.writeCsv(path.join(out, "monthly.csv"), monthly);
  json(path.join(out, "monthly.json"), monthly);
  fs.writeFileSync(path.join(out, "trades.jsonl"), trades.map(t => JSON.stringify(t)).join("\n") + "\n");
  const contexts = spec.windows.map((w: any) => {
    const a = minutes[byTs.get(Date.parse(w.start))!], b = minutes[byTs.get(Date.parse(w.end) - MINUTE)!];
    const qty = spec.notionalUsdt / a.open, pricePnl = qty * (b.close - a.open), fees = spec.feeRatePerSide * (spec.notionalUsdt + qty * b.close);
    return { window: w.id, cashNet: 0, buyHoldLongPricePnl: pricePnl, buyHoldLongFeesIncludingMarkedExit: fees,
      buyHoldLongNetBeforeFunding: pricePnl - fees, entryPrice: a.open, finalMark: b.close, notional: spec.notionalUsdt };
  });
  json(path.join(out, "context-controls.json"), contexts);
  const responseRows: any[] = [];
  console.log("[response] fixed12h outcomes and fixed descriptive strata, not additional trade policies");
  for (const window of spec.windows) {
    const start = Date.parse(window.start), stop = Date.parse(window.end);
    for (let k = 1; k < features.length; k++) {
      const c = features[k], at = c.barEnd;
      if (at < start || at + spec.holdMs + MINUTE > stop) continue;
      const i = byTs.get(at); if (i === undefined) continue;
      const exitIndex = i + spec.holdMs / MINUTE;
      const price = minutes[i].open, exitPrice = minutes[exitIndex].open;
      let high = price, low = price;
      for (let j = i; j < exitIndex; j++) { high = Math.max(high, minutes[j].high); low = Math.min(low, minutes[j].low); }
      high = Math.max(high, exitPrice); low = Math.min(low, exitPrice); // include the exit open, not its later H/L
      for (const side of spec.sides as Array<"long" | "short">) {
        const direction = side === "long" ? 1 : -1;
        const base = { window: window.id, at, iso: new Date(at).toISOString(), side, price, exitPrice,
          grossReturnPct: direction * (exitPrice / price - 1) * 100,
          feeAdjustedReturnPct: (direction * (exitPrice / price - 1) - spec.feeRatePerSide * (1 + exitPrice / price)) * 100,
          mfePct: side === "long" ? (high / price - 1) * 100 : (1 - low / price) * 100,
          maePct: side === "long" ? (low / price - 1) * 100 : (1 - high / price) * 100,
          matchKey: `${new Date(at).toISOString().slice(0, 7)}:${(c.feature.roc5 ?? 0) >= 0 ? "up" : "down"}`,
          adx: c.feature.adx14, atrPct: c.feature.atrPct, rvol: c.feature.rvol20 };
        responseRows.push({ ...base, family: "all_hours" });
        for (const family of spec.families as Family[]) {
          if (entrySignal({ id: family, family, side, exit: "fixed12h" }, features[k - 1], c)) responseRows.push({ ...base, family });
        }
      }
    }
  }
  const responseSummary: any[] = [], strata: any[] = [];
  for (const w of spec.windows) for (const side of spec.sides) {
    const all = responseRows.filter(r => r.window === w.id && r.side === side && r.family === "all_hours");
    const matched = new Map<string, number>();
    for (const key of new Set<string>(all.map(r => r.matchKey))) matched.set(key, mean(all.filter(r => r.matchKey === key).map(r => r.feeAdjustedReturnPct))!);
    for (const family of ["all_hours", ...spec.families]) {
      const rows = responseRows.filter(r => r.window === w.id && r.side === side && r.family === family);
      const summarize = (rr: any[]) => ({ n: rr.length, meanGrossPct: mean(rr.map(r => r.grossReturnPct)),
        meanAfterFeePct: mean(rr.map(r => r.feeAdjustedReturnPct)), medianAfterFeePct: median(rr.map(r => r.feeAdjustedReturnPct)),
        winPct: mean(rr.map(r => Number(r.feeAdjustedReturnPct > 0) * 100)), meanMfePct: mean(rr.map(r => r.mfePct)),
        meanMaePct: mean(rr.map(r => r.maePct)), matchedControlMeanPct: mean(rr.map(r => matched.get(r.matchKey)!)),
        matchedMeanDeltaPct: mean(rr.map(r => r.feeAdjustedReturnPct - matched.get(r.matchKey)!)) });
      responseSummary.push({ window: w.id, side, family, ...summarize(rows) });
      for (const [field, cuts] of [["adx", [20, 25]], ["atrPct", [1, 2]], ["rvol", [1, 2]]] as const) {
        for (const bucket of [0, 1, 2]) {
          const rr = rows.filter(r => r[field] !== null && (r[field] < cuts[0] ? 0 : r[field] < cuts[1] ? 1 : 2) === bucket);
          strata.push({ window: w.id, side, family, field, bucket: bucket === 0 ? `<${cuts[0]}` : bucket === 1 ? `${cuts[0]}..<${cuts[1]}` : `>=${cuts[1]}`, ...summarize(rr) });
        }
      }
    }
  }
  core.writeCsv(path.join(out, "responses.csv"), responseSummary); core.writeCsv(path.join(out, "strata.csv"), strata);
  fs.writeFileSync(path.join(out, "response-events.jsonl"), responseRows.map(r => JSON.stringify(r)).join("\n") + "\n");
  const rankings = rules.map(rule => {
    const cases = results.filter(x => x.id === rule.id), months = monthly.filter(x => x.id === rule.id);
    const failures: string[] = [];
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
  // Recompute one selected-prefix engine path: no later-hour feature/candle may
  // change the same end-marked study run. This is not a new strategy definition.
  const checkEnd = Date.parse("2025-08-01T00:00:00Z"), checkRule = rules[0];
  const checkOptions = { start: Date.parse(spec.windows[0].start), end: checkEnd, delayMs: MINUTE,
    notional: spec.notionalUsdt, equity: spec.initialEquity, feeRate: spec.feeRatePerSide, holdMs: spec.holdMs };
  assert.deepEqual(runStandalone(minutes, features, checkRule, checkOptions),
    runStandalone(minutes.filter(c => c.timestamp + MINUTE <= checkEnd), features.filter(f => f.barEnd <= checkEnd), checkRule, checkOptions));
  for (const x of [...sources, ...inputs]) assert.equal(await fileHash(path.join(root, x.file)), x.sha256, `Study input/source changed during run: ${x.file}`);
  json(path.join(out, "validation.json"), { formulaVersion: RESEARCH_FEATURE_FORMULA_VERSION,
    canonicalLoaderWithPinnedRepairedCandles: true, missingMinutes: 0, actualTurnoverChecked: true,
    actualDataFeaturePrefixChecks: 3, actualDataEnginePrefixCheck: true, strategyDefinitions: 16, controls: 2,
    strategyCases: results.filter(r => r.family !== "clock").length, controlCases: results.filter(r => r.family === "clock").length,
    inputAndSourceHashesUnchanged: true, liveChanges: 0, passedResearchScreen: rankings.filter(r => r.passesResearchScreen).map(r => r.id),
    fundingIncluded: false, deploymentCandidates: [] });
  console.log(`[done] ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
