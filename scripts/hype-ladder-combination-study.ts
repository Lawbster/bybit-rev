/** L13: full occupancy replay of eight frozen pairs; no engine or live changes. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { createPlan, executePlan, atomicJson, inside, sha, verifyPins, type Plan } from "./research-workflow";
import { SINGLES, COMBINATIONS, POLICIES, legs, runConfig, requestedSize, WEEKLY_POLICY, HIGH_POLICY, validateCombinationCard, type R } from "./ladder-combination-policy";
import { SoftStaleController } from "./conditional-soft-stale-policy";
import { WeeklyExitController, weeklyTape } from "./mfi-weekly-exit-policy";
import { mfiTape } from "./mfi-distress-exit-policy";
import { HighController, trailingHighIndices, highFeature } from "./near-high-policy";
import { auditCombinationAccounting, componentAttribution } from "./ladder-combination-accounting";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import type { EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";

export function acceptedSingles(d: R, read: (f: string) => any): R[] {
  const f06: R[] = read(`${d.archive}/results.json`), l09: R[] = read(`${d.components}/results.json`),
    f04: R[] = read(`${d.weekly}/results.json`), l08: R[] = read(`${d.half}/results.json`), l12: R[] = read(`${d.acceptedResults}/output/results.json`);
  const select = (rows: R[], p: string, predicate: (x: R) => boolean) => rows.filter(predicate).map(x => {
    const window = x.window ?? x.model.split("-")[0], tp = x.tp ?? (x.model.endsWith("resting_touch") ? "resting_touch" : "close_confirmed");
    const id = p === "baseline" ? x.model : p === "age8" || p === "mfi_weekly_half" || p === "exit_2d_1pct" ? x.name : `${x.model}--${p}`;
    return { ...x, policy: p, window, tp, engineId: id };
  }).filter(x => ["published_window", "hl_extended"].includes(x.window));
  const rows = [
    ...select(f06, "baseline", x => x.policy.id === "baseline"),
    ...select(f06, "age8", x => x.policy.id === "age8" && x.sensitivity.id === "primary"),
    ...select(f06, "minus_soft_stale", x => x.policy.id === "minus_soft_stale"),
    ...select(l08, "last11_50", x => x.variant === "last11_50" && x.lagSeconds === 0),
    ...select(l09, "minus_deep_stress", x => x.policy === "minus_deep_stress"),
    ...select(f04, "mfi_weekly_half", x => x.policy.id === "mfi_weekly_half" && x.sensitivity.id === "primary"),
    ...select(l12, "exit_2d_1pct", x => x.policy === "exit_2d_1pct" && x.phase === "primary")
  ];
  assert.equal(rows.length, 28); for (const p of SINGLES) assert.equal(rows.filter(x => x.policy === p).length, 4);
  return rows;
}
export async function runCombinationStudy(root: string, plan: Plan, out: string) {
  const d = plan.card.definition; validateCombinationCard(d);
  const read = (f: string) => JSON.parse(fs.readFileSync(inside(root, f), "utf8"));
  const json = (f: string, v: unknown) => atomicJson(path.join(out, f), v);
  const jsonl = (f: string, rows: unknown[]) => fs.writeFileSync(path.join(out, f), rows.map(x => JSON.stringify(x)).join("\n") + "\n");
  const cfg = read("bot-config.json"), manifest = read(`${d.archive}/manifest.json`);
  for (const a of [d.archive, d.components, d.weekly, d.half]) assert(read(`${a}/validation.json`).passed && read(`${a}/verification.json`).passed);
  for (const a of [d.acceptedResults, d.refresh]) {
    const state = read(`${a}/state.json`); assert.equal(state.status, "complete");
    assert(read(a === d.refresh ? `${a}/output/validation.json` : `${a}/verification.json`).passed);
    await verifyPins(root, state.artifacts.filter((x: R) => plan.card.inputs.includes(x.file)));
  }
  for (const p of manifest.pins.filter((p: R) => !p.file.startsWith("data/") && p.file !== "bot-state.json"))
    assert.equal(plan.pins.find(x => x.file === p.file)?.sha256, p.sha256, `Canonical dependency ${p.file}`);
  for (const p of read(`${d.acceptedResults}/plan.json`).pins.filter((x: R) => x.file.startsWith("data/") || x.file.includes("/repair.json")))
    assert.equal(plan.pins.find(x => x.file === p.file)?.sha256, p.sha256, `Frozen data ${p.file}`);
  const accepted = acceptedSingles(d, read); json("accepted-singles.json", accepted.map(x => ({ policy: x.policy, model: x.model, end: x.end, digest: x.digest })));
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = d.cutoff; process.env.SIM_EQUITY = "32000";
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  console.log("[L13] unchanged canonical series, B17 pulse/BTC/latch; eight fixed pairs");
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
  const high = trailingHighIndices(s.candles, 2880), mfi = mfiTape(s.candles, Date.parse(d.indicatorSeed)), weekly = weeklyTape(s.candles, Date.parse(d.indicatorSeed));
  fs.writeFileSync(path.join(out, "high-2d.i32"), Buffer.from(high.buffer));
  const results: R[] = [], parity: R[] = [], refreshed: R[] = read(`${d.refresh}/output/results.json`).filter((x: R) => x.phase === "extended");
  const run = (base: R, policy: string, phase: string, lag = 0, control?: R) => {
    const name = `${phase}--${base.model}--${policy}--lag${lag}`, began = Date.now(), l = legs(policy), c = runConfig(cfg, policy);
    console.log(`[L13 ${results.length + 1}/${d.runs}] ${name}`);
    // Retain archived IDs for exact digest controls. Reason IDs stay frozen even in pairs.
    const id = base.engineId && SINGLES.includes(policy) ? base.engineId : name;
    const params: EngineParams = { id, executionModel: "causal_next_open", tpExecutionModel: base.tp, maxPositions: cfg.maxPositions,
      hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const age = l.includes("age8") ? new SoftStaleController("age", 8, 0, () => ({ healthy: true, allowed: true, evidence: {} })) : null;
    const cut = l.includes("mfi_weekly_half") ? new WeeklyExitController(WEEKLY_POLICY, mfi, weekly, lag, 0) : null;
    const hi = l.includes("exit_2d_1pct") ? new HighController(HIGH_POLICY, (i, at, price) => highFeature(s.candles, high, i, 2, at, price, lag)) : null;
    assert(!(cut && hi));
    const events: ResearchInventoryEvent[] = [], targets: R[] = [], sizes: R[] = [], tpEpisodes = new Set<number>(), sizeEpisodes = new Set<number>();
    const startIdx = core.lowerBound(s.candles, Date.parse(base.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(base.end) + 1, c => c.endTs);
    const r = runCausalLongReplay(params, s, { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional",
      researchTpDeferral: age?.decide, researchTpObserver: t => {
        const prev = targets.at(-1); if (!prev || prev.pct !== t.pct || prev.targetPrice !== t.targetPrice || prev.episode !== t.episode) targets.push(t);
        if (l.includes("minus_soft_stale") && t.at - t.oldestEntryTime >= 14400000 && (t.price / t.avgEntry - 1) * 100 < .5) tpEpisodes.add(t.episode);
      }, researchAddSize: d => { const n = requestedSize(policy, d); sizes.push({ ...d, approvedNotional: n }); if (n !== d.requestedNotional) sizeEpisodes.add(d.episode); return n; },
      researchReduction: cut?.decide ?? hi?.reduce,
      researchInventoryObserver: e => { hi?.observe(e); events.push(e); }
    }, c, d.initialEquity); cut?.finish();
    age?.observations.filter(x => x.status === "extended").forEach(x => tpEpisodes.add(x.episode));
    const digest = sha(JSON.stringify({ ...r, snapshots: [] })), metrics = exposureMetrics(r, d.initialEquity);
    const accounting = auditCombinationAccounting(s.candles, events, metrics, startIdx, endIdx, d.initialEquity, d.feeRate,
      { fraction: cut ? .5 : 1, fillDelayMs: 0 }, l.includes("last11_50"));
    if (control) {
      assert.equal(digest, control.digest, `Archived digest ${name}`); assert.deepEqual(metrics, control.metrics);
      if (control.accounting) assert.deepEqual(accounting, control.accounting);
      parity.push({ name, policy, model: base.model, digest });
    }
    if (phase === "primary" && SINGLES.includes(policy)) {
      const exact = refreshed.find(x => x.policy === policy && x.model === base.model)
        ?? (policy === "exit_2d_1pct" ? accepted.find(x => x.policy === policy && x.model === base.model) : null);
      if (exact) { assert.equal(digest, exact.digest, `Refreshed single ${name}`); assert.deepEqual(metrics, exact.metrics); }
    }
    const cuts = events.filter(x => x.event.reason.startsWith("research_exit:")), reductionEpisodes = new Set(cuts.map(x => x.episode));
    const interventions = new Set([...tpEpisodes, ...sizeEpisodes, ...reductionEpisodes]);
    const row = { name, phase, primary: phase === "primary" || phase === "archived_control" && base.window === "published_window", policy, legs: l,
      model: base.model, window: base.window, tp: base.tp, start: base.start, end: base.end, startIdx, endIdx, lag, engineId: id, digest, metrics, accounting,
      interventions: interventions.size, counts: { targetEpisodes: tpEpisodes.size, sizeEpisodes: sizeEpisodes.size, reductionEpisodes: reductionEpisodes.size,
        overlapTargetOther: [...tpEpisodes].filter(x => sizeEpisodes.has(x) || reductionEpisodes.has(x)).length,
        guardRemovalInterventions: l.includes("minus_deep_stress") ? null : 0 },
      audit: age?.counts ?? null, blocked: r.blocked, pendingAtEnd: r.executionAudit!.pendingAtEnd, elapsedMs: Date.now() - began };
    jsonl(`${name}-inventory.jsonl`, events); json(`${name}-targets.json`, targets); json(`${name}-sizes.json`, sizes);
    json(`${name}-tp-observations.json`, age?.observations ?? []); json(`${name}-cut-observations.json`, cut?.observations ?? []);
    json(`${name}-high-reductions.json`, hi?.reductions ?? []); json(`${name}-high-traces.json`, hi?.traces ?? []);
    results.push(row); json("results.json", results);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, counts: row.counts, seconds: row.elapsedMs / 1000 }));
  };
  for (const base of accepted) run(base, base.policy, "archived_control", 0, base);
  assert.equal(parity.length, 28); json("control-parity.json", { passed: true, cases: parity });
  for (const base of accepted.filter(x => x.window === "hl_extended")) run({ ...base, end: d.cutoff }, base.policy, "primary");
  const bases: R[] = accepted.filter(x => x.policy === "baseline").map(x => ({ ...x, end: x.window === "hl_extended" ? d.cutoff : x.end, engineId: null }));
  for (const policy of COMBINATIONS) for (const base of bases) run(base, policy, "primary");
  for (const policy of POLICIES.filter(p => legs(p).some(l => ["mfi_weekly_half", "exit_2d_1pct"].includes(l))))
    for (const base of bases.filter(x => x.window === "hl_extended")) run(base, policy, "source60", 60000);
  assert.equal(results.length, d.runs);
  const primary = results.filter(x => x.primary); assert.equal(primary.length, 60);
  const comparisons = results.filter(x => x.policy !== "baseline").map(x => {
    const base = results.find(b => b.policy === "baseline" && b.model === x.model && Date.parse(b.end) === Date.parse(x.end)); assert(base);
    const vsParts = x.legs.length === 2 ? x.legs.map((p: string) => {
      const peer = primary.find(b => b.policy === p && b.model === x.model); assert(peer);
      return { policy: p, delta: exposureDelta(x.metrics, peer.metrics), attribution: componentAttribution(x.metrics, peer.metrics) };
    }) : [];
    return { name: x.name, delta: exposureDelta(x.metrics, base.metrics), attribution: componentAttribution(x.metrics, base.metrics), versusParts: vsParts,
      interactionNet: vsParts.length ? x.metrics.totalPnl - base.metrics.totalPnl - x.legs.reduce((n: number, p: string) => n + primary.find(b => b.policy === p && b.model === x.model)!.metrics.totalPnl - base.metrics.totalPnl, 0) : null };
  });
  const ranking = POLICIES.filter(p => p !== "baseline").map(p => {
    const rows = primary.filter(x => x.policy === p), failures: string[] = []; assert.equal(rows.length, 4);
    for (const x of rows) {
      const delta = comparisons.find(c => c.name === x.name)!.delta, recent = x.window === "hl_extended";
      if (delta.pnlDelta < (recent ? d.screen.minimumRecentNetDelta : d.screen.minimumPublishedNetDelta)) failures.push(`${x.model}:net`);
      if (delta.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`);
      if (delta.worstMonthDelta < d.screen.minimumMonthlyDelta) failures.push(`${x.model}:monthly`);
      if (recent && x.interventions < d.screen.minimumInterventionEpisodes) failures.push(`${x.model}:${p === "minus_deep_stress" ? "intervention_n_unmeasured" : "thin"}`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:nonpositive_equity`);
    }
    const beatsParts = legs(p).length === 2 && rows.every(x => comparisons.find(c => c.name === x.name)!.versusParts.every((v: R) => v.delta.pnlDelta > 0 && v.delta.ddReductionPp >= -1e-9));
    return { policy: p, passesPrimaryScreen: failures.length === 0, failures, beatsBothPartsAllFour: beatsParts, deployable: false };
  });
  json("comparisons.json", comparisons); json("ranking.json", ranking);
  core.writeCsv(path.join(out, "overview.csv"), results.map(x => ({ name: x.name, primary: x.primary, window: x.window, tp: x.tp, policy: x.policy,
    net: x.metrics.totalPnl, wins: x.metrics.profitableEpisodes, losses: x.metrics.losingEpisodes, winDollars: x.metrics.grossWin,
    lossDollars: -x.metrics.grossLoss, open: x.metrics.openPnl, unfinishedPartial: x.metrics.unfinishedPartialPnl, dd: x.metrics.maxDrawdownPct,
    tpCycles: x.metrics.tpCycles, forced: x.metrics.forcedCloses, fees: x.accounting.modeledFees, interventions: x.interventions })));
  core.writeCsv(path.join(out, "monthly.csv"), results.flatMap(x => x.accounting.monthly.map((m: R) => ({ name: x.name, primary: x.primary, policy: x.policy, ...m }))));
  json("validation.json", { passed: true, economicCases: results.length, primaryCases: primary.length, controlsExact: parity.length, newTradingDefinitions: 8, liveChanges: 0, economicQualification: "independent_check_required" });
}
async function main() {
  const root = path.resolve(__dirname, ".."), [cmd, arg] = process.argv.slice(2); assert.equal(process.cwd(), root);
  if (cmd === "plan") {
    assert(arg?.startsWith("research-inputs/")); const read = (p: string) => JSON.parse(fs.readFileSync(inside(root, p), "utf8")), card = read(arg); validateCombinationCard(card.definition);
    const inherited = read(`${card.definition.acceptedResults}/plan.json`).pins.map((x: R) => x.file);
    const weekly = read(`${card.definition.weekly}/manifest.json`).pins.map((x: R) => x.file);
    const sources = [...inherited, ...weekly, arg, "scripts/hype-ladder-combination-study.ts", "scripts/ladder-combination-policy.ts",
      "scripts/ladder-combination-accounting.ts", "scripts/ladder-combination-tests.ts", "scripts/ladder-combination-verify.ts", "scripts/conditional-soft-stale-path-audit.ts",
      "scripts/mfi-distress-exit-audit.ts", "scripts/mfi-weekly-exit-audit.ts"];
    const p = await createPlan(root, card, sources, ["bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts", "src/bot/strategy.ts"]);
    console.log(JSON.stringify({ key: p.key, definitionId: p.definitionId, next: `npx ts-node scripts/hype-ladder-combination-study.ts run ${p.key}` }, null, 2));
  } else { assert.equal(cmd, "run"); await executePlan(root, arg, (p, out) => runCombinationStudy(root, p, out)); }
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
