/** FR01 explicit local runner. Controls must reproduce before any new policy runs. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { createPlan, executePlan, atomicJson, sha, fileHash, type Plan } from "./research-workflow";
import { VARIANTS, PARENT, validate, loadFlowTape, FlowResponseContext, approvedSize, type Variant, type R } from "./flow-response-policy";
import { POLICIES, config, AgeHighController } from "./age10-gate-policy";
import { SoftStaleController } from "./conditional-soft-stale-policy";
import { highFeature, trailingHighIndices } from "./near-high-policy";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import { auditFlowLedger } from "./flow-response-audit";
import { componentAttribution } from "./ladder-combination-accounting";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
export const CARD = "research-inputs/flow-response-fr01-2026-09-14.json";
const read = (f: string): any => JSON.parse(fs.readFileSync(f, "utf8"));
export async function buildSeries(d: R) {
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = d.cutoff; process.env.SIM_EQUITY = "32000";
  const core = await import("./hype-freerun-canonical-replay"), { loadReplayMarketInputs } = await import("./replay-market-inputs");
  const { rebuildDamagedLatch } = await import("./replay-damaged-latch"), { missingMinutes } = await import("./replay-candle-repair");
  const cfg = read("bot-config.json"); delete cfg.aggressive10;
  const s = await core.buildSeries({ candleRepairFile: d.repairFile });
  assert.equal(missingMinutes(s.candles).length, 0); assert.equal(s.candles.at(-1)!.endTs, Date.parse(d.cutoff));
  s.marketInputs = await loadReplayMarketInputs(path.resolve("data"), cfg.symbol, Date.parse(d.cutoff));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000
      ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch, new Map(), at => s.marketInputs!.latchPulse(at));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  return { core, s, cfg, highs: trailingHighIndices(s.candles, 2880) };
}
export async function runStudy(plan: Plan, out: string) {
  const d = plan.card.definition; validate(d);
  const json = (f: string, x: unknown) => atomicJson(path.join(out, f), x);
  const jsonl = (f: string, xs: unknown[]) => fs.writeFileSync(path.join(out, f), xs.map(x => JSON.stringify(x)).join("\n") + "\n");
  const archive: R[] = read(`${d.archive}/output/results.json`).filter((x: R) => x.primary && d.controls.includes(x.policy));
  assert.equal(archive.length, 8); assert(read(`${d.archive}/verification.json`).passed);
  const { s, core, cfg, highs } = await buildSeries(d);
  const oldPins: R[] = read(`${d.archive}/plan.json`).pins;
  json("source-changes.json", oldPins.filter(p => plan.pins.find(q => q.file === p.file)?.sha256 !== p.sha256)
    .map(p => ({ file: p.file, old: p.sha256, current: plan.pins.find(q => q.file === p.file)?.sha256 })));
  const { runCausalLongReplay } = await import("./replay-causal-engine");
  const tape = await loadFlowTape("data/HYPEUSDT_taker_hyperliquid.jsonl", Date.parse(d.cutoff)), context = new FlowResponseContext(tape, s.candles);
  json("flow-input-audit.json", tape.audit);
  const results: R[] = [], parity: R[] = [];
  const bases = archive.filter(x => x.policy === "baseline"); assert.equal(bases.length, 4);
  function run(base: R, v: Variant | null, lag: number, control?: R) {
    const policy = v?.id ?? control!.policy, parentSpec = POLICIES.find(p => p.id === (control?.policy ?? PARENT))!;
    assert(parentSpec); if (control) assert.deepEqual(parentSpec, control.spec);
    const c = config(cfg, parentSpec), name = `${base.model}--${policy}--lag${lag}`, start = Date.now();
    console.log(`[FR01 ${results.length + 1}/${d.runs}] ${name}`);
    const age = parentSpec.ageHours ? new SoftStaleController("age", 10, 0, () => { throw Error("age only"); }) : null;
    const high = parentSpec.days ? new AgeHighController(parentSpec, (i, at, price) => highFeature(s.candles, highs, i, 2, at, price, 0)) : null;
    const events: ResearchInventoryEvent[] = [], attempts: R[] = [], targets: R[] = [];
    const startIdx = core.lowerBound(s.candles, Date.parse(base.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(base.end) + 1, c => c.endTs);
    const r = runCausalLongReplay({ id: control?.engineId ?? name, executionModel: "causal_next_open", tpExecutionModel: base.tp,
      maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none" }, s,
      { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional", researchTpDeferral: age?.decide,
        researchTpObserver: t => { const p = targets.at(-1); if (!p || p.armedIndex !== t.armedIndex || p.episode !== t.episode) targets.push(t); },
        researchAddSize: add => {
          const feature = add.nextDepth >= 8 ? context.at(add.at, lag) : null, choice = approvedSize(v, add, feature);
          attempts.push({ ...add, feature, fire: choice.fire, approvedNotional: choice.notional }); return choice.notional;
        }, researchReduction: high?.reduce,
        researchInventoryObserver: e => { high?.observe(e); events.push(e); }
      }, c, 32000);
    const digest = sha(JSON.stringify({ ...r, snapshots: [] })), metrics = exposureMetrics(r, 32000);
    const accounting = auditFlowLedger(s.candles, events, attempts, metrics, startIdx, endIdx);
    if (control) { assert.equal(digest, control.digest, `Exact archived digest ${name}`); assert.deepEqual(metrics, control.metrics); parity.push({ name, digest, original: control.name }); }
    const changed = attempts.filter(a => a.fire), deep = attempts.filter(a => a.feature), reasonCounts: R = {};
    for (const a of deep) for (const reason of a.feature.reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    const row: R = { name, policy, spec: parentSpec, variant: v, model: base.model, window: base.window, tp: base.tp,
      start: base.start, end: base.end, startIdx, endIdx, lag, primary: !lag, control: !!control, digest, metrics, accounting,
      pendingAtEnd: r.executionAudit!.pendingAtEnd, blocked: r.blocked, audit: age?.counts ?? null,
      counts: { attempts: attempts.length, deep: deep.length, ready: deep.filter(a => a.feature.ready).length,
        unknown: deep.filter(a => !a.feature.ready).length, checksChanged: changed.length,
        episodesChanged: new Set(changed.map(a => a.episode)).size, priceDropChecksChanged: changed.filter(a => a.priceDropOk).length,
        timerChecksChanged: changed.filter(a => !a.priceDropOk).length, zeroChecks: attempts.filter(a => !a.approvedNotional).length, reasonCounts },
      seconds: (Date.now() - start) / 1000 };
    json(`${name}-engine.json`, { ...r, snapshots: [] });
    jsonl(`${name}-inventory.jsonl`, events); json(`${name}-attempts.json`, attempts); json(`${name}-targets.json`, targets);
    json(`${name}-tp-observations.json`, age?.observations ?? []); json(`${name}-high-reductions.json`, high?.rows ?? []);
    results.push(row); json("results.json", results);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, ...row.counts, seconds: row.seconds }));
  }
  for (const control of archive) run(control, null, 0, control);
  assert.equal(parity.length, 8); json("control-parity.json", { passed: true, cases: parity });
  for (const v of VARIANTS) for (const base of bases) run(base, v, 0);
  for (const v of VARIANTS) for (const base of bases.filter(b => b.window === "hl_extended")) run(base, v, 60000);
  assert.equal(results.length, 32);
  const comparisons = results.map(x => {
    const baseline = results.find(b => b.control && b.policy === "baseline" && b.model === x.model)!, parent = results.find(b => b.control && b.policy === PARENT && b.model === x.model)!;
    return { name: x.name, baseline: exposureDelta(x.metrics, baseline.metrics), parent: exposureDelta(x.metrics, parent.metrics),
      baselineAttribution: componentAttribution(x.metrics, baseline.metrics), parentAttribution: componentAttribution(x.metrics, parent.metrics) };
  });
  json("comparisons.json", comparisons);
  const ranking = VARIANTS.map(v => {
    const rows = results.filter(x => x.policy === v.id), failures: R = { baseline: [], parent: [] };
    for (const x of rows) for (const peer of ["baseline", "parent"]) {
      const delta = comparisons.find(c => c.name === x.name)![peer as "baseline" | "parent"], recent = x.window === "hl_extended";
      if (x.lag ? delta.pnlDelta <= 0 : delta.pnlDelta < (recent ? d.screen.minimumRecentNetDelta : 0)) failures[peer].push(`${x.name}:net`);
      if (delta.ddReductionPp < -1e-9) failures[peer].push(`${x.name}:drawdown`);
      if (delta.worstMonthDelta < -250) failures[peer].push(`${x.name}:monthly`);
      if (recent && x.counts.episodesChanged < 20) failures[peer].push(`${x.name}:thin_interventions`);
      if (x.accounting.firstNonpositive) failures[peer].push(`${x.name}:nonpositive_equity`);
    }
    return { policy: v.id, failures, baselinePass: !failures.baseline.length, parentPass: !failures.parent.length, deployable: false,
      minimumRecentParentDelta: Math.min(...rows.filter(x => x.window === "hl_extended" && !x.lag).map(x => comparisons.find(c => c.name === x.name)!.parent.pnlDelta)) };
  }).sort((a, b) => b.minimumRecentParentDelta - a.minimumRecentParentDelta);
  json("ranking.json", ranking);
  core.writeCsv(path.join(out, "overview.csv"), results.map(x => ({ name: x.name, window: x.window, tp: x.tp, policy: x.policy, lag: x.lag,
    net: x.metrics.totalPnl, realized: x.metrics.realized, open: x.metrics.openPnl, wins: x.metrics.profitableEpisodes, losses: x.metrics.losingEpisodes,
    winDollars: x.metrics.grossWin, lossDollars: -x.metrics.grossLoss, averageLoss: x.metrics.losingEpisodes ? -x.metrics.grossLoss / x.metrics.losingEpisodes : 0,
    dd: x.metrics.maxDrawdownPct, fees: x.accounting.modeledFees, changedEpisodes: x.counts.episodesChanged, ready: x.counts.ready, unknown: x.counts.unknown })));
  core.writeCsv(path.join(out, "monthly.csv"), results.flatMap(x => x.accounting.monthly.map((m: R) => ({ name: x.name, policy: x.policy, ...m }))));
  json("validation.json", { passed: true, controlsExact: 8, runs: 32, newDefinitions: 4, independentCheckRequired: true, liveChanges: 0 });
}
async function main() {
  const [cmd, key] = process.argv.slice(2), root = path.resolve(__dirname, ".."); assert.equal(process.cwd(), root);
  if (cmd === "plan") {
    const card = read(CARD); validate(card.definition); const old = read(`${card.definition.archive}/plan.json`);
    const inherited: string[] = old.pins.map((p: R) => p.file);
    for (const f of ["scripts/hype-freerun-canonical-replay.ts", "scripts/replay-causal-engine.ts", "scripts/replay-market-inputs.ts", "scripts/replay-sr-context.ts",
      "scripts/age10-gate-policy.ts", "scripts/conditional-soft-stale-policy.ts", "src/research/indicator-features.ts"]) {
      assert.equal(await fileHash(f), old.pins.find((p: R) => p.file === f)?.sha256, `Canonical source changed: ${f}`);
    }
    const files = [CARD, ...inherited, "src/indicators.ts", card.definition.repairFile, ...["policy", "study", "audit", "verify", "tests"].map(n => `scripts/flow-response-${n}.ts`)];
    const plan = await createPlan(root, card, files, ["bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts", "src/hyperliquid-collector.ts"]);
    const changes = old.pins.filter((p: R) => plan.pins.find(q => q.file === p.file)?.sha256 !== p.sha256).map((p: R) => ({ file: p.file, old: p.sha256, current: plan.pins.find(q => q.file === p.file)?.sha256 }));
    console.log(JSON.stringify({ key: plan.key, definitionId: plan.definitionId, changes, next: `npx ts-node scripts/flow-response-study.ts run ${plan.key}` }, null, 2));
  } else { assert.equal(cmd, "run"); await executePlan(root, key, runStudy); }
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
