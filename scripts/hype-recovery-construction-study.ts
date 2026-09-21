/** RR03 then L10. Frozen, local, observation/veto hooks; no trading-engine changes. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { atomicJson, inside, sha, fileHash, verifyPins, type Plan } from "./research-workflow";
import { commonMaps, SYMBOLS } from "./market-proxy-comparison";
import { trajectory, groupRows, type R } from "./recovery-trajectory";
import { summarize } from "./failed-recovery-analysis";
import { closedFrames, latest } from "./conditional-soft-stale-sources";
import { computeResearchFeatures } from "../src/research/indicator-features";
import { ConstructionController, type ConstructionPolicy } from "./ladder-construction-policy";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import type { EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
const H = 3600000;
export function validateConstructionCard(d: R) {
  assert.equal(d.archive, "backtests/hype/hype-conditional-soft-stale-2026-09-10");
  assert.equal(d.start, "2026-05-17T20:43:00Z"); assert.equal(d.cutoff, "2026-09-10T05:08:00Z");
  assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055); assert.equal(d.newTradingDefinitions, 6);
  assert.equal(d.trainingHours, 168); assert.equal(d.minimumPairs, 160); assert.equal(d.sequenceHours, 4); assert.deepEqual(d.lagsMs, [0, 60000]);
  assert.deepEqual(d.policies, [
    { id: "spacing_atr_half", family: "spacing", multiple: .5 }, { id: "spacing_atr_one", family: "spacing", multiple: 1 },
    { id: "underwater_cap8", family: "budget", capDepth: 8 }, { id: "underwater_cap9", family: "budget", capDepth: 9 },
    { id: "post_trim_wait60", family: "recycle", mode: "wait60" }, { id: "post_trim_pullback", family: "recycle", mode: "pullback" }]);
}
function futureSummary(xs: R[]) {
  const done = xs.filter(x => x.outcome.ready), avg = (key: string) => done.length ? done.reduce((s, x) => s + x.outcome[key], 0) / done.length : null;
  return { observations: xs.length, completed: done.length, meanReturn12h: avg("returnPct"), meanAdverse12h: avg("adversePct"),
    drops2pct: done.filter(x => x.outcome.adversePct <= -2).length };
}
export async function runConstructionStudy(root: string, plan: Plan, out: string) {
  const d = plan.card.definition; validateConstructionCard(d);
  const read = (f: string) => JSON.parse(fs.readFileSync(inside(root, f), "utf8"));
  const json = (f: string, v: unknown) => atomicJson(path.join(out, f), v);
  const jsonl = (f: string, rows: unknown[]) => fs.writeFileSync(path.join(out, f), rows.map(x => JSON.stringify(x)).join("\n") + "\n");
  const cfg = read("bot-config.json"), manifest = read(`${d.archive}/manifest.json`), parentV = read(`${d.archive}/validation.json`);
  assert(parentV.passed && read(`${d.archive}/verification.json`).passed);
  assert.equal(await fileHash(inside(root, `${d.archive}/results.json`)), parentV.artifacts.find((x: R) => x.file === "results.json").sha256);
  for (const p of manifest.pins) {
    const pin = plan.pins.find(x => x.file === p.file); assert(pin, `Unpinned ${p.file}`);
    if (!p.file.startsWith("data/") && p.file !== "bot-state.json") assert.equal(pin.sha256, p.sha256, `Changed baseline dependency ${p.file}`);
  }
  for (const parent of [d.proxyArchive, d.scoreArchive]) {
    const state = read(`${parent}/state.json`); assert.equal(state.status, "complete");
    const wanted = state.artifacts.filter((p: R) => plan.card.inputs.includes(p.file)); assert(wanted.length > 0);
    await verifyPins(root, wanted);
    if (parent === d.proxyArchive) {
      assert(read(`${parent}/verification.json`).passed);
      const appendAudit: R[] = [];
      for (const p of read(`${parent}/plan.json`).pins.filter((x: R) => x.file.startsWith("data/") || x.file.includes("/repair.json"))) {
        const current = plan.pins.find(x => x.file === p.file); assert(current);
        if (current.sha256 !== p.sha256) {
          // Accept ONLY exact old byte prefix plus strictly post-cutoff rows.
          // Historical revisions, shrinkage and in-window late rows still fail.
          assert(p.file.endsWith("_1m.jsonl"), `Proxy data changed ${p.file}`);
          const bytes = fs.readFileSync(inside(root, p.file)); assert(bytes.length > p.bytes);
          assert.equal(sha(bytes.subarray(0, p.bytes)), p.sha256, `Changed historical prefix ${p.file}`);
          const added = bytes.subarray(p.bytes).toString("utf8").trim().split("\n").filter(Boolean).map(x => JSON.parse(x));
          for (const row of added) assert(Number(row.ts ?? row.timestamp) + 60000 > Date.parse(d.cutoff), `New in-window row ${p.file}`);
          appendAudit.push({ file: p.file, unchangedPrefixBytes: p.bytes, appendedRows: added.length, allAfterCutoff: true });
        }
      }
      json("post-cutoff-append-audit.json", appendAudit);
    }
  }
  const raw = read(`${d.proxyArchive}/output/hourly-inputs.json`), maps = commonMaps(raw);
  const oldPressure: R[] = read(`${d.proxyArchive}/output/landmarks.json`);
  const oldGrid: R[] = fs.readFileSync(inside(root, `${d.proxyArchive}/output/grid-labels.jsonl`), "utf8").trim().split("\n").map(x => JSON.parse(x));
  console.log("[RR03] fixed recovery paths; no result-conditioned parameter selection");
  const memo = new Map<string, R>();
  const featuresAt = (at: number, lag: number) => {
    const key = `${at}/${lag}`; if (!memo.has(key)) memo.set(key, trajectory(maps, at, lag)); return memo.get(key)!;
  };
  const pressure = oldPressure.map(({ features: _, ...x }) => ({ ...x, trajectory: featuresAt(x.at, x.lag) }));
  const grid = oldGrid.map(x => ({ ...x, trajectory: featuresAt(x.at, x.lag) }));
  const stateOf = (x: R, s: string) => x.trajectory.ready ? x.trajectory.paths[s].state : "unknown";
  const cuts = (xs: R[], summary: (xs: R[]) => R) => ({ baseline: summary(xs),
    states: Object.fromEntries(SYMBOLS.map(s => [s, groupRows(xs, x => stateOf(x, s), summary)])),
    rawConditioned: Object.fromEntries(SYMBOLS.slice(1).map(s => [s, groupRows(xs, x => `raw=${stateOf(x, "HYPEUSDT")}/market=${stateOf(x, s)}`, summary)])) });
  const diagnostic: R = { pressure: groupRows(pressure, x => `${x.model}/lag${x.lag}`, xs => ({ ...cuts(xs, summarize),
    monthly: groupRows(xs, x => x.iso.slice(0, 7), ys => cuts(ys, summarize)),
    ownVwapRoc: groupRows(xs, x => String(x.existingWeakVwapRoc), ys => cuts(ys, summarize)) })),
    grid: groupRows(grid, x => String(x.lag), xs => ({ ...cuts(xs, futureSummary), monthly: groupRows(xs, x => x.iso.slice(0, 7), ys => cuts(ys, futureSummary)) })) };
  json("trajectory-summary.json", diagnostic); json("trajectory-pressure-labels.json", pressure.map(({ trajectory: _, ...x }) => x));
  json("trajectory-grid-labels.json", grid.map(({ trajectory: _, ...x }) => x));
  json("trajectory-hourly-inputs.json", raw);
  jsonl("trajectory-features.jsonl", [...memo.values()]);
  console.log(`[RR03] ${grid.length} grid / ${pressure.length} pressure observations; outcomes remain diagnostic, not exit profit`);

  // All trading variants were frozen before the diagnostic. No dynamic selection
  // of SOL/BTC gates or loosening data readiness based on these outcomes.
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = d.cutoff; process.env.SIM_EQUITY = "32000";
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  console.log("[L10] build unchanged canonical series, pulse, BTC risk gate and latch");
  const s = await core.buildSeries({ candleRepairFile: manifest.repairFile });
  assert.equal(missingMinutes(s.candles).length, 0); assert.equal(s.candles.at(-1)!.endTs, Date.parse(d.cutoff));
  s.marketInputs = await loadReplayMarketInputs(path.resolve(root, "data"), cfg.symbol, Date.parse(d.cutoff));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000
      ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  const hourBars = closedFrames(s.candles, H);
  const indicators = computeResearchFeatures(hourBars.map(x => ({ ...x, timestamp: x.ts })), H);
  const source = hourBars.map((x, i) => ({ ...x, ...indicators[i], healthy: i >= 14 && hourBars.slice(i - 14, i + 1).every((c, k, all) => !k || c.ts === all[k - 1].endTs) }));
  const sourceAt = (at: number, lag: number) => {
    const end = Math.floor((at - lag) / H) * H, f = latest(source, end);
    return f?.endTs === end ? { ...f, availableAt: f.endTs + lag } : null;
  };
  json("construction-hourly-sources.json", source);
  // Join matched HYPE-only VWAP/ROC controls to the fixed grid, not just selected losses.
  diagnostic.gridVwapRoc = groupRows(grid, x => String(x.lag), xs => groupRows(xs, x => {
    const f = sourceAt(x.at, x.lag); return f?.vwapUtcDay != null && f?.roc5 != null ? String(f.close < f.vwapUtcDay && f.roc5 <= 0) : "unknown";
  }, ys => cuts(ys, futureSummary)));
  json("trajectory-summary.json", diagnostic);
  const archived: R[] = read(`${d.archive}/results.json`).filter((x: R) => x.policy.id === "baseline"); assert.equal(archived.length, 4);
  const refreshed: R[] = read(`${d.scoreArchive}/output/results.json`).filter((x: R) => x.phase === "extended" && x.policy === "baseline"); assert.equal(refreshed.length, 2);
  const results: R[] = [], parity: R[] = [], opportunities: R[] = [];
  const run = (base: R, policy: ConstructionPolicy | null, lag: number, phase: string, control?: R) => {
    const name = `${phase}--${base.model}--${policy?.id ?? "baseline"}--lag${lag}`, began = Date.now(); console.log(`[L10] ${name}`);
    const params: EngineParams = { id: policy ? name : base.model, executionModel: "causal_next_open", tpExecutionModel: base.tp, maxPositions: cfg.maxPositions,
      hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const controller = new ConstructionController(policy, cfg, at => sourceAt(at, lag));
    const events: ResearchInventoryEvent[] = [];
    const startIdx = core.lowerBound(s.candles, Date.parse(base.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(base.end) + 1, c => c.endTs);
    const r = runCausalLongReplay(params, s, { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional",
      researchAddVeto: controller.decide, researchInventoryObserver: e => { controller.observe(e); events.push(e); } }, cfg, d.initialEquity);
    const digest = sha(JSON.stringify({ ...r, snapshots: [] })), metrics = exposureMetrics(r, d.initialEquity);
    const accounting = auditComponentAccounting(s.candles, events, metrics, startIdx, endIdx, d.initialEquity, d.feeRate);
    if (control) { assert.equal(digest, control.digest, name); assert.deepEqual(metrics, control.metrics); assert.deepEqual(accounting, control.accounting); parity.push({ name, digest }); }
    const row = { name, phase, model: base.model, window: base.window ?? "hl_extended", tp: base.tp, start: base.start, end: base.end, startIdx, endIdx,
      policy: policy?.id ?? "baseline", lag, digest, metrics, accounting, interventions: controller.intervened.size,
      counts: controller.counts, blocked: r.blocked, pendingAtEnd: r.executionAudit!.pendingAtEnd, elapsedMs: Date.now() - began };
    if (!policy && Date.parse(base.end) === Date.parse(d.cutoff)) for (const x of controller.observations.filter(x => x.decision.nextDepth >= 8)) {
      const at = x.decision.at;
      if (at >= Date.parse(d.start)) opportunities.push({ model: base.model, decision: x.decision,
        inventory: x.inventory, trajectory: featuresAt(at, 0) });
    }
    jsonl(`${name}-inventory.jsonl`, events); json(`${name}-observations.json`, controller.observations); json(`${name}-decisions.json`, controller.decisions);
    json(`${name}-summary.json`, row); results.push(row); json("results.json", results);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, intervened: row.interventions, seconds: row.elapsedMs / 1000 }));
  };
  for (const base of archived) run(base, null, 0, "archived_control", base);
  for (const base of refreshed) run(base, null, 0, "primary", base);
  assert.equal(parity.length, 6); json("control-parity.json", { passed: true, cases: parity });
  const bases = [...archived.filter(x => x.window === "published_window"), ...refreshed]; assert.equal(bases.length, 4);
  for (const p of d.policies) for (const base of bases) run(base, p, 0, "primary");
  for (const p of d.policies.filter((x: R) => x.family === "spacing")) for (const base of bases) run(base, p, 60000, "source60");
  assert.equal(results.length, 38);
  const controlFor = (x: R) => results.find(b => b.policy === "baseline" && b.model === x.model && b.end === x.end)!;
  const comparisons = results.filter(x => x.policy !== "baseline").map(x => {
    const b = controlFor(x); assert(b);
    return { name: x.name, delta: exposureDelta(x.metrics, b.metrics), attribution: componentAttribution(x.metrics, b.metrics),
      fixedPathExtra5bpsDelta: x.accounting.fixedPathExtra5bpsNet - b.accounting.fixedPathExtra5bpsNet };
  });
  const ranking = d.policies.map((p: R) => {
    const cases = results.filter(x => x.policy === p.id && x.phase === "primary"), failures: string[] = [];
    assert.equal(cases.length, 4);
    for (const x of cases) {
      const delta = comparisons.find(y => y.name === x.name)!.delta;
      const recent = x.window === "hl_extended";
      if (delta.pnlDelta < (recent ? d.screen.minimumRecentNetDelta : d.screen.minimumPublishedNetDelta)) failures.push(`${x.model}:net`);
      if (delta.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`);
      if (delta.worstMonthDelta < d.screen.minimumMonthlyDelta) failures.push(`${x.model}:monthly`);
      if (recent && x.interventions < d.screen.minimumInterventionEpisodes) failures.push(`${x.model}:thin`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:nonpositive_equity`);
    }
    return { policy: p.id, passesPrimaryScreen: failures.length === 0, failures, deployable: false };
  });
  json("comparisons.json", comparisons); json("ranking.json", ranking); json("baseline-deep-opportunities.json", opportunities);
  core.writeCsv(path.join(out, "overview.csv"), results.map(x => ({ name: x.name, model: x.model, policy: x.policy, phase: x.phase,
    net: x.metrics.totalPnl, wins: x.metrics.profitableEpisodes, losses: x.metrics.losingEpisodes, winningDollars: x.metrics.grossWin,
    losingDollars: -x.metrics.grossLoss, open: x.metrics.openPnl, dd: x.metrics.maxDrawdownPct, minEquity: x.metrics.minEquity,
    forced: x.metrics.forcedCloses, tpCycles: x.metrics.tpCycles, fees: x.accounting.modeledFees, interventions: x.interventions })));
  core.writeCsv(path.join(out, "monthly.csv"), results.flatMap(x => x.accounting.monthly.map((m: R) => ({ name: x.name, model: x.model, policy: x.policy, ...m }))));
  json("validation.json", { passed: true, economicCases: results.length, controlsExact: parity.length, newTradingDefinitions: 6,
    rawGrid: grid.length, pressureRows: pressure.length, liveChanges: 0, economicQualification: "independent_check_required" });
}
