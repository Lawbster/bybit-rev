/** L15: 3 frozen follow-ups, exact controls, full occupancy and source-delay checks. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { createPlan, executePlan, atomicJson, inside, sha, verifyPins, fileHash, type Plan } from "./research-workflow";
import { CONTROLS, VARIANTS, PARENT, SENSITIVITY, validate, config, size, AgeHighController, type Policy, type R } from "./age10-gate-policy";
import { GateObserver } from "./age10-gate-observer";
import { attribution } from "./age10-gate-attribution";
import { SoftStaleController } from "./conditional-soft-stale-policy";
import { trailingHighIndices, highFeature } from "./near-high-policy";
import { auditCombinationAccounting, componentAttribution } from "./ladder-combination-accounting";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import type { EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";

export async function runStudy(root: string, plan: Plan, out: string) {
  const d = plan.card.definition; validate(d);
  const read = (f: string) => JSON.parse(fs.readFileSync(inside(root, f), "utf8"));
  const json = (f: string, v: unknown) => atomicJson(path.join(out, f), v);
  const jsonl = (f: string, rows: unknown[]) => fs.writeFileSync(path.join(out, f), rows.map(x => JSON.stringify(x)).join("\n") + "\n");
  const cfg = read("bot-config.json"), manifest = read(`${d.archive}/manifest.json`);
  const previous = read(`${d.acceptedResults}/plan.json`), state = read(`${d.acceptedResults}/state.json`), verified = read(`${d.acceptedResults}/verification.json`);
  assert.equal(state.status, "complete"); assert(verified.passed);
  await verifyPins(root, state.artifacts.filter((x: R) => plan.card.inputs.includes(x.file)));
  for (const p of (verified.auditSources ?? [])) assert.equal(await fileHash(inside(root, p.file)), p.sha256);
  for (const p of previous.pins) assert.equal(plan.pins.find(x => x.file === p.file)?.sha256, p.sha256, `Unchanged inherited source/data ${p.file}`);
  const accepted: R[] = read(`${d.acceptedResults}/output/results.json`).filter((x: R) => x.primary);
  const components: R[] = read(`${d.components}/results.json`); assert(read(`${d.components}/verification.json`).passed);
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = d.cutoff; process.env.SIM_EQUITY = "32000";
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  console.log("[L15] Building unchanged canonical B17 series; 3 frozen policies, no live changes");
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
  const highs = new Map<number, Int32Array>();
  for (const days of [2]) { const h = trailingHighIndices(s.candles, days * 1440); highs.set(days, h); fs.writeFileSync(path.join(out, `high-${days}d.i32`), Buffer.from(h.buffer)); }
  const results: R[] = [], parity: R[] = [], bases = accepted.filter(x => x.policy === "baseline"); assert.equal(bases.length, 4);
  const run = (base: R, p: Policy, phase: string, lag = 0, control?: R) => {
    const name = `${phase}--${base.model}--${p.id}--lag${lag}`, began = Date.now(), c = config(cfg, p);
    const id = control?.engineId ?? (control ? `${base.model}--${p.id}` : name);
    console.log(`[L15 ${results.length + 1}/${d.runs}] ${name}`);
    const params: EngineParams = { id, executionModel: "causal_next_open", tpExecutionModel: base.tp, maxPositions: cfg.maxPositions,
      hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const age = p.ageHours ? new SoftStaleController("age", p.ageHours, 0, () => { throw Error("Age control has no indicator input"); }) : null;
    const hi = p.days ? new AgeHighController(p, (i, at, price) => highFeature(s.candles, highs.get(p.days!)!, i, p.days!, at, price, lag)) : null;
    const observer = new GateObserver(s, cfg), entryContexts: R[] = [];
    const events: ResearchInventoryEvent[] = [], targets: R[] = [], sizes: R[] = [], sizeEpisodes = new Set<number>();
    const startIdx = core.lowerBound(s.candles, Date.parse(base.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(base.end) + 1, c => c.endTs);
    const r = runCausalLongReplay(params, s, { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional",
      researchTpDeferral: age?.decide, researchTpObserver: t => {
        const prev = targets.at(-1); if (!prev || prev.armedIndex !== t.armedIndex || prev.episode !== t.episode) targets.push(t);
      }, researchAddSize: d => { entryContexts.push(observer.entry(d, c)); const n = size(p, d); sizes.push({ ...d, approvedNotional: n }); if (n !== d.requestedNotional) sizeEpisodes.add(d.episode); return n; },
      researchReduction: d => { observer.clock(d.index); return hi?.reduce(d) ?? null; }, researchInventoryObserver: e => { hi?.observe(e); observer.observe(e); events.push(e); }
    }, c, d.initialEquity);
    const digest = sha(JSON.stringify({ ...r, snapshots: [] })), metrics = exposureMetrics(r, d.initialEquity);
    const accounting = auditCombinationAccounting(s.candles, events, metrics, startIdx, endIdx, d.initialEquity, d.feeRate, { fraction: 1, fillDelayMs: 0 }, p.legs.includes("last11_50"));
    if (control) { assert.equal(digest, control.digest, `Exact archive ${name}`); assert.deepEqual(metrics, control.metrics); parity.push({ name, digest, originalName: control.name ?? control.policy }); }
    const tpEpisodes = new Set<number>(age?.observations.filter(o => o.status === "extended").map(o => o.episode) ?? []);
    const cuts = events.filter(e => e.event.reason.startsWith("research_exit:")), highEpisodes = new Set(cuts.map(e => e.episode));
    const row = { name, phase, primary: phase !== "source60", policy: p.id, spec: p, model: base.model, window: base.window, tp: base.tp,
      start: base.start, end: base.end, startIdx, endIdx, lag, engineId: id, digest, metrics, accounting,
      interventions: new Set([...tpEpisodes, ...sizeEpisodes, ...highEpisodes]).size,
      counts: { targetEpisodes: tpEpisodes.size, sizeEpisodes: sizeEpisodes.size, highEpisodes: highEpisodes.size, highIntents: hi?.traces.length ?? 0 },
      audit: age?.counts ?? null, blocked: r.blocked, pendingAtEnd: r.executionAudit!.pendingAtEnd, elapsedMs: Date.now() - began };
    json(`${name}-entry-contexts.json`, entryContexts);
    jsonl(`${name}-inventory.jsonl`, events); json(`${name}-targets.json`, targets); json(`${name}-sizes.json`, sizes);
    json(`${name}-tp-observations.json`, age?.observations ?? []); json(`${name}-high-reductions.json`, hi?.rows ?? []); json(`${name}-high-traces.json`, hi?.traces ?? []);
    results.push(row); json("results.json", results);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, counts: row.counts, seconds: row.elapsedMs / 1000 }));
  };
  for (const p of CONTROLS) for (const base of bases) {
    const old = accepted.find(x => x.policy === p.id && x.model === base.model); assert(old); assert.deepEqual(p, old.spec);
    run(base, p, "exact_control", 0, old);
  }
  assert.equal(parity.length, 24); json("control-parity.json", { passed: true, cases: parity });
  for (const p of VARIANTS) for (const base of bases) run(base, p, "primary");
  for (const p of [...CONTROLS, ...VARIANTS].filter(p => SENSITIVITY.includes(p.id))) for (const base of bases.filter(x => x.window === "hl_extended")) run(base, p, "source60", 60000);
  assert.equal(results.length, d.runs); const primary = results.filter(x => x.primary); assert.equal(primary.length, 36);
  const comparisons = results.map(x => {
    const base = primary.find(b => b.policy === "baseline" && b.model === x.model)!, parent = primary.find(b => b.policy === PARENT && b.model === x.model)!;
    const peerSpecs = x.spec.legs.map((l: string) => primary.find(b => b.policy === l && b.model === x.model) ?? accepted.find(b => b.policy === l && b.model === x.model));
    return { name: x.name, baseline: exposureDelta(x.metrics, base.metrics), parent: exposureDelta(x.metrics, parent.metrics),
      attributionBaseline: componentAttribution(x.metrics, base.metrics), attributionParent: componentAttribution(x.metrics, parent.metrics),
      peers: peerSpecs.filter(Boolean).map((p: R) => ({ policy: p.policy, delta: exposureDelta(x.metrics, p.metrics) })) };
  });
  const ranking = VARIANTS.map(p => {
    const rows = primary.filter(x => x.policy === p.id), failures: string[] = [];
    for (const x of rows) {
      const c = comparisons.find(c => c.name === x.name)!, recent = x.window === "hl_extended";
      if (c.baseline.pnlDelta < (recent ? d.screen.minimumRecentNetDelta : d.screen.minimumPublishedNetDelta)) failures.push(`${x.model}:net`);
      if (c.baseline.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`);
      if (c.baseline.worstMonthDelta < d.screen.minimumMonthlyDelta) failures.push(`${x.model}:monthly`);
      if (recent && x.interventions < d.screen.minimumInterventionEpisodes) failures.push(`${x.model}:thin`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:nonpositive_equity`);
    }
    const recent = rows.filter(x => x.window === "hl_extended");
    return { policy: p.id, minRecentNetDelta: Math.min(...recent.map(x => comparisons.find(c => c.name === x.name)!.baseline.pnlDelta)),
      aggregateBaselineAllFour: rows.every(x => { const c = comparisons.find(c => c.name === x.name)!.baseline; return c.pnlDelta > 0 && c.ddReductionPp >= -1e-9; }),
      improvesParentAllFour: rows.every(x => { const c = comparisons.find(c => c.name === x.name)!.parent; return c.pnlDelta > 0 && c.ddReductionPp >= -1e-9; }),
      passesScreen: !failures.length, failures, deployable: false };
  }).sort((a, b) => b.minRecentNetDelta - a.minRecentNetDelta);
  json("comparisons.json", comparisons); json("ranking.json", ranking);
  const diagnostics = attribution(results,
    name => fs.readFileSync(path.join(out, `${name}-inventory.jsonl`), "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l)),
    name => JSON.parse(fs.readFileSync(path.join(out, `${name}-entry-contexts.json`), "utf8")));
  json("entry-attribution.json", diagnostics);
  core.writeCsv(path.join(out, "overview.csv"), results.map(x => ({ name: x.name, policy: x.policy, primary: x.primary, window: x.window, tp: x.tp,
    net: x.metrics.totalPnl, wins: x.metrics.profitableEpisodes, losses: x.metrics.losingEpisodes, winDollars: x.metrics.grossWin, lossDollars: -x.metrics.grossLoss,
    open: x.metrics.openPnl, unfinishedPartial: x.metrics.unfinishedPartialPnl, dd: x.metrics.maxDrawdownPct, tpCycles: x.metrics.tpCycles,
    forced: x.metrics.forcedCloses, fees: x.accounting.modeledFees, ...x.counts })));
  core.writeCsv(path.join(out, "monthly.csv"), results.flatMap(x => x.accounting.monthly.map((m: R) => ({ name: x.name, primary: x.primary, policy: x.policy, ...m }))));
  json("validation.json", { passed: true, economicCases: results.length, primaryCases: primary.length, controlsExact: parity.length, newTradingDefinitions: 3, liveChanges: 0, economicQualification: "independent_check_required" });
}
async function main() {
  const root = path.resolve(__dirname, ".."), [cmd, arg] = process.argv.slice(2); assert.equal(process.cwd(), root);
  if (cmd === "plan") {
    assert(arg?.startsWith("research-inputs/")); const read = (p: string) => JSON.parse(fs.readFileSync(inside(root, p), "utf8")), card = read(arg); validate(card.definition);
    const inherited = read(`${card.definition.acceptedResults}/plan.json`).pins.map((x: R) => x.file);
    const sources = [...inherited, arg, "scripts/hype-age10-gate-study.ts", "scripts/age10-gate-policy.ts", "scripts/age10-gate-observer.ts", "scripts/age10-gate-tests.ts", "scripts/age10-gate-verify.ts", "scripts/age10-gate-attribution.ts",
      "scripts/ladder-combination-review.ts", "scripts/ladder-combination-target-audit.ts", "scripts/ladder-combination-target-audit-tests.ts"];
    const p = await createPlan(root, card, sources, ["bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts", "src/bot/strategy.ts"]);
    console.log(JSON.stringify({ key: p.key, definitionId: p.definitionId, next: `npx ts-node scripts/hype-age10-gate-study.ts run ${p.key}` }, null, 2));
  } else { assert.equal(cmd, "run"); await executePlan(root, arg, (p, out) => runStudy(root, p, out)); }
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
