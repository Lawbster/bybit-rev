/** L11 frozen trailing-high blocks versus stale exits, using unchanged canonical replay. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { atomicJson, inside, sha, verifyPins, type Plan } from "./research-workflow";
import { HIGH_POLICIES, HighController, trailingHighIndices, highFeature, type HighPolicy, type R } from "./near-high-policy";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import type { EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
export function validateHighCard(d: R) {
  assert.equal(d.archive, "backtests/hype/hype-conditional-soft-stale-2026-09-10");
  assert.equal(d.start, "2026-05-17T20:43:00Z"); assert.equal(d.cutoff, "2026-09-10T05:08:00Z");
  assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055);
  assert.deepEqual(d.days, [1, 7, 30]); assert.deepEqual(d.proximityPct, [1, 2]); assert.deepEqual(d.actions, ["block", "exit"]);
  assert.equal(d.minimumAddDepth, 8); assert.equal(d.staleHours, 4); assert.equal(d.newTradingDefinitions, 12);
}
export async function runHighStudy(root: string, plan: Plan, out: string) {
  const d = plan.card.definition; validateHighCard(d);
  const read = (f: string) => JSON.parse(fs.readFileSync(inside(root, f), "utf8"));
  const json = (f: string, v: unknown) => atomicJson(path.join(out, f), v);
  const jsonl = (f: string, rows: unknown[]) => fs.writeFileSync(path.join(out, f), rows.map(x => JSON.stringify(x)).join("\n") + "\n");
  const cfg = read("bot-config.json"), manifest = read(`${d.archive}/manifest.json`);
  assert(read(`${d.archive}/validation.json`).passed && read(`${d.archive}/verification.json`).passed);
  const parent = read(`${d.acceptedResults}/state.json`); assert.equal(parent.status, "complete"); assert(read(`${d.acceptedResults}/verification.json`).passed);
  await verifyPins(root, parent.artifacts.filter((x: R) => plan.card.inputs.includes(x.file)));
  for (const p of manifest.pins.filter((p: R) => !p.file.startsWith("data/") && p.file !== "bot-state.json")) {
    assert.equal(plan.pins.find(x => x.file === p.file)?.sha256, p.sha256, `Baseline dependency ${p.file}`);
  }
  // Reject all in-window revisions/appends; dataset comes from the just-verified
  // L10 snapshot. A future refresh is a separate pinned study, never silent.
  for (const p of read(`${d.acceptedResults}/plan.json`).pins.filter((x: R) => x.file.startsWith("data/") || x.file.includes("/repair.json")))
    assert.equal(plan.pins.find(x => x.file === p.file)?.sha256, p.sha256, `Data changed ${p.file}`);
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = d.cutoff; process.env.SIM_EQUITY = "32000";
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  console.log("[L11] build unchanged canonical series, pulse, BTC risk gate and latch");
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
  const highIndices = new Map<number, Int32Array>(d.days.map((days: number) => [days, trailingHighIndices(s.candles, days * 1440)]));
  for (const [days, indices] of highIndices) fs.writeFileSync(path.join(out, `high-${days}d.i32`), Buffer.from(indices.buffer));
  json("high-source-meta.json", { firstTs: s.candles[0].ts, cutoff: s.candles.at(-1)!.endTs, rows: s.candles.length, days: d.days, bytesPerIndex: 4 });
  json("cutoff-location.json", { at: d.cutoff, price: s.candles.at(-1)!.close, references: d.days.map((days: number) => ({ days,
    ...highFeature(s.candles, highIndices.get(days)!, s.candles.length - 1, days, Date.parse(d.cutoff), s.candles.at(-1)!.close, 0) })) });
  const accepted: R[] = read(`${d.acceptedResults}/output/results.json`).filter((x: R) => x.policy === "baseline"); assert.equal(accepted.length, 6);
  const results: R[] = [], parity: R[] = [];
  const run = (base: R, policy: HighPolicy | null, lag: number, phase: string, control?: R) => {
    const name = `${phase}--${base.model}--${policy?.id ?? "baseline"}--lag${lag}`, began = Date.now(); console.log(`[L11] ${name}`);
    const params: EngineParams = { id: policy ? name : base.model, executionModel: "causal_next_open", tpExecutionModel: base.tp, maxPositions: cfg.maxPositions,
      hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const ctl = new HighController(policy, (i, at, price) => highFeature(s.candles, highIndices.get(policy!.days)!, i, policy!.days, at, price, lag));
    const events: ResearchInventoryEvent[] = [];
    const startIdx = core.lowerBound(s.candles, Date.parse(base.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(base.end) + 1, c => c.endTs);
    const r = runCausalLongReplay(params, s, { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional",
      researchAddVeto: ctl.add, researchReduction: ctl.reduce, researchInventoryObserver: e => { ctl.observe(e); events.push(e); } }, cfg, d.initialEquity);
    const digest = sha(JSON.stringify({ ...r, snapshots: [] })), metrics = exposureMetrics(r, d.initialEquity);
    const accounting = auditComponentAccounting(s.candles, events, metrics, startIdx, endIdx, d.initialEquity, d.feeRate, { fraction: 1, fillDelayMs: 0 });
    if (control) { assert.equal(digest, control.digest, name); assert.deepEqual(metrics, control.metrics); assert.deepEqual(accounting, control.accounting); parity.push({ name, digest }); }
    const row = { name, phase, model: base.model, window: base.window, tp: base.tp, start: base.start, end: base.end, startIdx, endIdx,
      policy: policy?.id ?? "baseline", lag, digest, metrics, accounting, interventions: ctl.intervened.size, counts: ctl.counts,
      blocked: r.blocked, pendingAtEnd: r.executionAudit!.pendingAtEnd, elapsedMs: Date.now() - began };
    jsonl(`${name}-inventory.jsonl`, events); json(`${name}-traces.json`, ctl.traces); json(`${name}-adds.json`, ctl.adds); json(`${name}-reductions.json`, ctl.reductions);
    results.push(row); json("results.json", results);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, interventions: row.interventions, seconds: row.elapsedMs / 1000 }));
  };
  for (const base of accepted) run(base, null, 0, base.phase, base);
  assert.equal(parity.length, 6); json("control-parity.json", { passed: true, cases: parity });
  const bases = accepted.filter(x => x.window === "published_window" || x.phase === "primary"); assert.equal(bases.length, 4);
  for (const p of HIGH_POLICIES) for (const base of bases) run(base, p, 0, "primary");
  for (const p of HIGH_POLICIES) for (const base of bases.filter(x => x.window === "hl_extended")) run(base, p, 60000, "source60");
  assert.equal(results.length, 78);
  const comparisons = results.filter(x => x.policy !== "baseline").map(x => {
    const b = results.find(b => b.policy === "baseline" && b.model === x.model && b.end === x.end)!; assert(b);
    return { name: x.name, delta: exposureDelta(x.metrics, b.metrics), attribution: componentAttribution(x.metrics, b.metrics),
      fixedPathExtra5bpsDelta: x.accounting.fixedPathExtra5bpsNet - b.accounting.fixedPathExtra5bpsNet };
  });
  const ranking = HIGH_POLICIES.map(p => {
    const cases = results.filter(x => x.policy === p.id && x.phase === "primary"), failures: string[] = [];
    assert.equal(cases.length, 4);
    for (const x of cases) {
      const delta = comparisons.find(y => y.name === x.name)!.delta, recent = x.window === "hl_extended";
      if (delta.pnlDelta < (recent ? d.screen.minimumRecentNetDelta : d.screen.minimumPublishedNetDelta)) failures.push(`${x.model}:net`);
      if (delta.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`);
      if (delta.worstMonthDelta < d.screen.minimumMonthlyDelta) failures.push(`${x.model}:monthly`);
      if (recent && x.interventions < d.screen.minimumInterventionEpisodes) failures.push(`${x.model}:thin`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:nonpositive_equity`);
    }
    return { policy: p.id, passesPrimaryScreen: failures.length === 0, failures, deployable: false };
  });
  json("comparisons.json", comparisons); json("ranking.json", ranking);
  core.writeCsv(path.join(out, "overview.csv"), results.map(x => ({ name: x.name, model: x.model, policy: x.policy, phase: x.phase,
    net: x.metrics.totalPnl, wins: x.metrics.profitableEpisodes, losses: x.metrics.losingEpisodes, winningDollars: x.metrics.grossWin,
    losingDollars: -x.metrics.grossLoss, open: x.metrics.openPnl, dd: x.metrics.maxDrawdownPct, minEquity: x.metrics.minEquity,
    forced: x.metrics.forcedCloses, tpCycles: x.metrics.tpCycles, fees: x.accounting.modeledFees, interventions: x.interventions })));
  core.writeCsv(path.join(out, "monthly.csv"), results.flatMap(x => x.accounting.monthly.map((m: R) => ({ name: x.name, model: x.model, policy: x.policy, ...m }))));
  json("validation.json", { passed: true, economicCases: results.length, controlsExact: parity.length, newTradingDefinitions: 12, liveChanges: 0,
    economicQualification: "independent_check_required" });
}
