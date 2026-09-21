/** AG10-C1: exactly two high-exit cooldown variants and three unchanged controls. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { createPlan, executePlan, atomicJson, sha, type Plan } from "./research-workflow";
import { CONTROLS, VARIANTS, LEAD, validate, config, AgeHighController, reopenAttribution, qualification, type CooldownPolicy, type R } from "./aggressive10-cooldown-policy";
import { verifyStudyDerivatives } from "./aggressive10-cooldown-source";
import { acceptedSourceProof } from "./aggressive10-selective-sources";
import { GateObserver } from "./age10-gate-observer";
import { SoftStaleController } from "./conditional-soft-stale-policy";
import { trailingHighIndices, highFeature } from "./near-high-policy";
import { auditCombinationAccounting, componentAttribution } from "./ladder-combination-accounting";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import type { EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
export async function runStudy(plan: Plan, out: string) {
  const d = plan.card.definition; validate(d);
  // The canonical loader captures its horizon at module import. Set it before
  // importing any context/pulse helper that transitively loads that module.
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = d.cutoff; process.env.SIM_EQUITY = "32000";
  const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
  const json = (f: string, v: unknown) => atomicJson(path.join(out, f), v);
  const jsonl = (f: string, rows: unknown[]) => fs.writeFileSync(path.join(out, f), rows.map(x => JSON.stringify(x)).join("\n") + "\n");
  json("derivative-proof.json", verifyStudyDerivatives());
  json("source-proof.json", await acceptedSourceProof(plan));
  const cfg = read("bot-config.json"), manifest = read(`${d.archive}/manifest.json`);
  const accepted: R[] = read(`${d.acceptedResults}/output/results.json`).filter((x: R) => x.primary);
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./aggressive10-cooldown-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  console.log("[AG10-C1] Building unchanged closed-bar series; 12 exact controls before variants");
  const s = await core.buildSeries({ candleRepairFile: manifest.repairFile });
  assert.equal(missingMinutes(s.candles).length, 0); assert.equal(s.candles.at(-1)!.endTs, Date.parse(d.cutoff));
  s.marketInputs = await loadReplayMarketInputs(path.resolve("data"), cfg.symbol, Date.parse(d.cutoff));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000
      ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  const high = trailingHighIndices(s.candles, 2880);
  fs.writeFileSync(path.join(out, "high-2d.i32"), Buffer.from(high.buffer));
  const results: R[] = [], parity: R[] = [], bases = accepted.filter(x => x.policy === "baseline"); assert.equal(bases.length, 4);
  const run = (base: R, p: CooldownPolicy, phase: string, lag = 0, control?: R) => {
    const name = `${phase}--${base.model}--${p.id}--lag${lag}`, began = Date.now(), c = config(cfg, p);
    const id = control?.engineId ?? (control ? `${base.model}--${p.id}` : name);
    console.log(`[AG10-C1 ${results.length + 1}/${d.runs}] ${name}`);
    const params: EngineParams = { id, executionModel: "causal_next_open", tpExecutionModel: base.tp, maxPositions: cfg.maxPositions,
      hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const age = p.ageHours ? new SoftStaleController("age", p.ageHours, 0, () => { throw Error("Age-only TP control"); }) : null;
    const hi = p.days ? new AgeHighController(p, (i, at, price) => highFeature(s.candles, high, i, 2, at, price, lag)) : null;
    const observer = new GateObserver(s, cfg), contexts: R[] = [], attempts: R[] = [];
    const events: ResearchInventoryEvent[] = [], targets: R[] = [], cooldowns: R[] = [];
    const startIdx = core.lowerBound(s.candles, Date.parse(base.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(base.end) + 1, c => c.endTs);
    const r = runCausalLongReplay(params, s, { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional",
      researchHighExitCooldownHours: p.highExitCooldownHours, researchCooldownObserver: row => cooldowns.push(row),
      researchTpDeferral: age?.decide, researchTpObserver: t => {
        const prev = targets.at(-1); if (!prev || prev.armedIndex !== t.armedIndex || prev.episode !== t.episode) targets.push(t);
      }, researchAddSize: add => {
        const gate = observer.entry(add, c);
        contexts.push(gate); attempts.push({ ...add, approvedNotional: add.requestedNotional });
        return add.requestedNotional;
      }, researchReduction: x => { observer.clock(x.index); return hi?.reduce(x) ?? null; },
      researchInventoryObserver: e => { hi?.observe(e); observer.observe(e); events.push(e); }
    }, c, d.initialEquity);
    const digest = sha(JSON.stringify({ ...r, snapshots: [] })), metrics = exposureMetrics(r, d.initialEquity);
    const accounting = auditCombinationAccounting(s.candles, events, metrics, startIdx, endIdx, d.initialEquity, d.feeRate, { fraction: 1, fillDelayMs: 0 });
    if (control) { assert.equal(digest, control.digest, `Exact archive ${name}`); assert.deepEqual(metrics, control.metrics); parity.push({ name, digest, originalName: control.name }); }
    const reopen = reopenAttribution(events, cooldowns, metrics, Date.parse(base.end));
    const { reopens, ...counts } = reopen;
    const row = { name, phase, primary: phase !== "source60", policy: p.id, spec: p, model: base.model, window: base.window, tp: base.tp,
      start: base.start, end: base.end, startIdx, endIdx, lag, engineId: id, digest, metrics, accounting,
      counts: { attempts: attempts.length, ...counts },
      audit: age?.counts ?? null, blocked: r.blocked, pendingAtEnd: r.executionAudit!.pendingAtEnd, elapsedMs: Date.now() - began };
    json(`${name}-cooldowns.json`, cooldowns); json(`${name}-reopens.json`, reopens);
    json(`${name}-entry-contexts.json`, contexts); json(`${name}-attempts.json`, attempts);
    jsonl(`${name}-inventory.jsonl`, events); json(`${name}-targets.json`, targets);
    json(`${name}-tp-observations.json`, age?.observations ?? []); json(`${name}-high-reductions.json`, hi?.rows ?? []); json(`${name}-high-traces.json`, hi?.traces ?? []);
    results.push(row); json("results.json", results);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, counts: row.counts, seconds: row.elapsedMs / 1000 }));
  };
  for (const p of CONTROLS) for (const base of bases) {
    const old = accepted.find(x => x.policy === p.id && x.model === base.model); assert(old); assert.deepEqual(p, old.spec);
    run(base, p, "exact_control", 0, old);
  }
  assert.equal(parity.length, 12); json("control-parity.json", { passed: true, cases: parity });
  for (const p of VARIANTS) for (const base of bases) run(base, p, "primary");
  for (const p of [CONTROLS[2], ...VARIANTS]) for (const base of bases.filter(x => x.window === "hl_extended")) run(base, p, "source60", 60000);
  assert.equal(results.length, 26); const primary = results.filter(x => x.primary); assert.equal(primary.length, 20);
  const comparisons = results.map(x => {
    const refs = ["baseline", "tp_age10", LEAD].map(id => primary.find(b => b.policy === id && b.model === x.model)!);
    return { name: x.name, baseline: exposureDelta(x.metrics, refs[0].metrics), guarded: exposureDelta(x.metrics, refs[1].metrics), parent: exposureDelta(x.metrics, refs[2].metrics),
      attribution: refs.map(b => ({ peer: b.policy, ...componentAttribution(x.metrics, b.metrics) })) };
  });
  json("comparisons.json", comparisons); json("ranking.json", qualification(results, comparisons, d));
  core.writeCsv(path.join(out, "overview.csv"), results.map(x => ({ name: x.name, policy: x.policy, primary: x.primary, window: x.window, tp: x.tp,
    net: x.metrics.totalPnl, wins: x.metrics.profitableEpisodes, losses: x.metrics.losingEpisodes, winDollars: x.metrics.grossWin, lossDollars: -x.metrics.grossLoss,
    open: x.metrics.openPnl, unfinishedPartial: x.metrics.unfinishedPartialPnl, dd: x.metrics.maxDrawdownPct, tpCycles: x.metrics.tpCycles,
    forced: x.metrics.forcedCloses, fees: x.accounting.modeledFees, ...x.counts })));
  core.writeCsv(path.join(out, "monthly.csv"), results.flatMap(x => x.accounting.monthly.map((m: R) => ({ name: x.name, primary: x.primary, policy: x.policy, ...m }))));
  json("validation.json", { passed: true, economicCases: 26, primaryCases: 20, controlsExact: 12, newTradingDefinitions: 2, liveChanges: 0, economicQualification: "independent_check_required" });
}
async function main() {
  const root = path.resolve(__dirname, ".."), [cmd, arg] = process.argv.slice(2); assert.equal(process.cwd(), root);
  if (cmd === "plan") {
    assert(arg?.startsWith("research-inputs/")); const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8")), card = read(arg); validate(card.definition);
    const inherited = read(`${card.definition.acceptedResults}/plan.json`).pins.map((x: R) => x.file);
    const sources = [...inherited, arg, "scripts/hype-aggressive10-cooldown-study.ts", "scripts/aggressive10-cooldown-policy.ts", "scripts/aggressive10-selective-sources.ts",
      "scripts/aggressive10-cooldown-tests.ts", "scripts/aggressive10-cooldown-verify.ts", "scripts/aggressive10-cooldown-source.ts", "scripts/aggressive10-cooldown-engine.ts", "scripts/aggressive10-cooldown-audit.ts", "scripts/aggressive10-discriminator-context.ts", "scripts/aggressive10-discriminator-study.ts"];
    const plan = await createPlan(root, card, sources, ["bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts", "src/bot/strategy.ts"]);
    console.log(JSON.stringify({ key: plan.key, definitionId: plan.definitionId, next: `npx ts-node scripts/hype-aggressive10-cooldown-study.ts run ${plan.key}` }));
  } else { assert.equal(cmd, "run"); await executePlan(root, arg, runStudy); }
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
