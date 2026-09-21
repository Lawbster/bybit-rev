/** R1: frozen L15 policies on earlier history. Offline; never rewrites archived results. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { execFileSync } from "child_process";
import { digest, pins, read, write, type R } from "./aggressive10-release-shared";
import { POLICIES, config, AgeHighController, type Policy } from "./age10-gate-policy";
import { SoftStaleController } from "./conditional-soft-stale-policy";
import { trailingHighIndices, highFeature } from "./near-high-policy";
import { auditCombinationAccounting, componentAttribution } from "./ladder-combination-accounting";
import { auditAgeHighTargets, auditAgeHighExits, rawHighs } from "./age-high-refinement-audit";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import { aggressive10TpDecision, aggressive10HighExit, aggressive10HighSnapshot, type Aggressive10LadderState } from "../src/bot/aggressive10-policy";
import type { Series } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";

export const CARD = "research-inputs/aggressive10-early-window-r1-2026-09-13.json";
export const OUT = "backtests/hype/aggressive10-early-window-r1-2026-09-13";
const M = 60000;
const selected = (d: R): Policy[] => d.policies.map((id: string) => { const p = POLICIES.find(p => p.id === id); assert(p); return p; });
export function validate(d: R) {
  assert.deepEqual(d.policies, ["baseline", "tp_age10", "age10__minus_deep_stress__minus_tp_cooldown"]);
  assert.deepEqual(d.tpModels, ["resting_touch", "close_confirmed"]);
  assert.equal(d.start, "2025-01-20T00:00:00Z"); assert.equal(d.cutoff, "2025-06-30T23:59:00Z");
  assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055);
  assert.equal(d.primaryRuns, 6); assert.equal(d.archiveControlRuns, 1); assert.equal(d.newTradingDefinitions, 0);
  assert.equal(d.optionalSourceDelayRuns, 0); assert.equal(d.control.model, "published_window-resting_touch");
  assert.equal(d.control.policy, "baseline"); assert.equal(d.control.buildCutoff, "2026-09-10T05:08:00Z");
  assert.deepEqual(d.screen, { minimumNetDelta: 0, minimumMonthlyDelta: -250, maximumDrawdownIncreasePp: 0, minimumInterventionEpisodes: 20 });
  assert.equal(selected(d)[1].ageHours, 10); assert.equal(selected(d)[1].days, 2);
}
export function researchConfig(current: R, p: Policy) {
  const c = structuredClone(current); delete c.aggressive10; // Runtime profile selection is not a replay policy switch.
  return config(c as any, p);
}
async function unchanged(m: R) { assert.deepEqual(await pins(m.pins.map((p: R) => p.file)), m.pins, "Inputs/source/protected state changed"); }
async function plan(d: R) {
  assert(!fs.existsSync(OUT), `Refuse overwrite: ${OUT}`);
  const prior = read(`${d.archive}/plan.json`), archived: R[] = read(`${d.archive}/output/results.json`);
  assert(read(`${d.archive}/verification.json`).passed);
  for (const p of selected(d)) assert.deepEqual(archived.find(x => x.primary && x.policy === p.id)!.spec, p);
  const sources = prior.pins.map((p: R) => p.file).filter((f: string) => /^(data|src|scripts)\//.test(f));
  const files = [...sources, CARD, "scripts/aggressive10-early-window-study.ts", "scripts/aggressive10-early-window-tests.ts",
    "scripts/aggressive10-release-shared.ts", "src/bot/aggressive10-policy.ts", "src/bot/close-cooldown.ts", d.repairFile,
    "bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts",
    `${d.archive}/output/results.json`, `${d.archive}/verification.json`, `${d.archive}/plan.json`];
  const pinned = await pins(files);
  for (const f of ["scripts/hype-freerun-canonical-replay.ts", "scripts/replay-causal-engine.ts", "scripts/replay-market-inputs.ts", "scripts/replay-sr-context.ts",
    "scripts/age-high-refinement-policy.ts", "scripts/age10-gate-policy.ts", "scripts/conditional-soft-stale-policy.ts", "src/indicators.ts"]) {
    assert.equal(pinned.find(p => p.file === f)?.sha256, prior.pins.find((p: R) => p.file === f)?.sha256, `Inherited source identity ${f}`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  write(`${OUT}/manifest.json`, { createdAt: new Date().toISOString(), commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    card: d, policies: selected(d), pins: pinned, config: researchConfig(read("bot-config.json"), selected(d)[0]), status: "frozen_before_economics" });
  console.log("[R1] Frozen six early runs + one archived control; no live changes");
}
async function build(d: R, control: boolean) {
  process.env.SIM_START = control ? "2025-07-01T00:00:00Z" : d.start;
  process.env.SIM_END = control ? d.control.buildCutoff : d.cutoff; process.env.SIM_EQUITY = "32000";
  const core = await import("./hype-freerun-canonical-replay");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  const cfg = read(`${OUT}/manifest.json`).config;
  const s = await core.buildSeries(control ? { candleRepairFile: d.repairFile } : {});
  assert.equal(s.candles.at(-1)!.endTs, Date.parse(process.env.SIM_END!)); assert.equal(missingMinutes(s.candles).length, 0);
  s.marketInputs = await loadReplayMarketInputs(path.resolve("data"), "HYPEUSDT", Date.parse(process.env.SIM_END!));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000
      ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch, new Map(), at => s.marketInputs!.latchPulse(at));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  if (!control) {
    assert.equal(s.marketInputs.audit.accepted, 0, "Do not silently introduce pulse into early window");
    const i = core.lowerBound(s.candles, Date.parse(d.start), c => c.endTs), first = s.candles[i];
    const { ReplaySrContext } = await import("./replay-sr-context");
    const sr = new ReplaySrContext(s.candles, cfg.srShadow).at(first.endTs);
    assert(sr.coverage.healthy); assert(s.candles[i - 249 * 240].ts >= s.candles[0].ts);
    assert(s.rsi1H[i] !== null && s.crsi4H[i] !== null && s.slope12h[i] !== null && s.bybitFunding[i] !== null);
    assert.equal(missingMinutes(btc.filter(c => c.ts >= first.ts - 249 * 240 * M)).length, 0);
    const traded = s.candles.slice(i), monthly = [...new Set(traded.map(c => new Date(c.endTs).toISOString().slice(0, 7)))].map(month => {
      const cs = traded.filter(c => new Date(c.endTs).toISOString().startsWith(month));
      const turns = cs.map(c => c.turnover).sort((a, b) => a - b);
      return { month, minutes: cs.length, zeroVolume: cs.filter(c => c.volume === 0).length,
        firstClose: cs[0].close, lastClose: cs.at(-1)!.close, medianTurnover: turns[Math.floor(turns.length / 2)] };
    });
    write(`${OUT}/early/input-coverage.json`, { firstSource: new Date(s.candles[0].ts).toISOString(), firstDecision: new Date(first.endTs).toISOString(),
      lastDecision: d.cutoff, missingHypeMinutes: 0, missingBtcMinutes: 0, srCoverage: sr.coverage,
      indicatorsAtStart: { rsi: s.rsi1H[i], crsi: s.crsi4H[i], slope: s.slope12h[i], bybitFunding: s.bybitFunding[i] },
      pulse: s.marketInputs.audit, latchTransitions: latch.transitions, monthly });
  }
  return { core, s, cfg, highs: trailingHighIndices(s.candles, 2880) };
}
function verifyCase(s: Series, cfg: R, row: R, events: ResearchInventoryEvent[], targets: R[], obs: R[], reductions: any[], highs: Float64Array) {
  const accounting = auditCombinationAccounting(s.candles, events, row.metrics, row.startIdx, row.endIdx, 32000, .00055, { fraction: 1, fillDelayMs: 0 });
  const targetAudit = auditAgeHighTargets(s.candles, events, targets, obs, { ...row, control: !row.spec.ageHours,
    policy: { id: row.policy, family: "age" }, sensitivity: { sourceLagMs: 0, releaseDelayMs: 0 } }, {}, cfg, {});
  const highChecks = row.spec.days ? auditAgeHighExits(s.candles, events, row, reductions, highs) : 0;
  for (const e of events.filter(e => e.event.kind === "close" && ["tp", "stale_tp"].includes(e.event.reason))) {
    const v = e.event, t = targets.filter(t => t.episode === e.episode && t.armedIndex <= v.decisionIndex).at(-1); assert(t);
    if (v.fillAt === s.candles[v.fillIndex!].endTs) { assert.equal(v.decisionIndex, t.armedIndex); assert(t.armedIndex < v.fillIndex!); assert(Math.abs(v.price! - t.targetPrice) < 1e-8); }
    else { assert(t.armedIndex < v.decisionIndex); assert(s.candles[v.decisionIndex].close >= t.targetPrice); }
  }
  return { accounting, targetAudit, highChecks };
}
async function run(d: R, control: boolean) {
  const dir = `${OUT}/${control ? "control" : "early"}`; assert(!fs.existsSync(dir), `Refuse overwrite: ${dir}`);
  if (!control) assert(read(`${OUT}/control/verification.json`).passed, "Archived control must pass first");
  fs.mkdirSync(dir); const { core, s, cfg, highs } = await build(d, control), raw = rawHighs(s.candles, 2);
  for (let i = 0; i < highs.length; i++) assert.equal(highs[i] >= 0 ? s.candles[highs[i]].high : 0, raw[i]);
  const { runCausalLongReplay } = await import("./replay-causal-engine");
  const old: R[] = read(`${d.archive}/output/results.json`), rows: R[] = [];
  const jobs = control ? [{ p: selected(d)[0], tp: "resting_touch" }] : selected(d).flatMap(p => d.tpModels.map((tp: string) => ({ p, tp })));
  for (const { p, tp } of jobs) {
    const name = `${p.id}--${tp}`, startTime = Date.now(); console.log(`[R1 ${control ? "control" : "early"} ${rows.length + 1}/${jobs.length}] ${name}`);
    const archive = control ? old.find(x => x.primary && x.model === d.control.model && x.policy === "baseline") : null; if (control) assert(archive);
    const c = researchConfig(cfg, p), events: ResearchInventoryEvent[] = [], targets: R[] = [];
    const age = p.ageHours ? new SoftStaleController("age", 10, 0, () => { throw Error("Age-only policy"); }) : null;
    const high = p.days ? new AgeHighController(p, (i, at, price) => highFeature(s.candles, highs, i, 2, at, price, 0)) : null;
    let phase: Aggressive10LadderState["tpPhase"] = "unseen", phaseEpisode = -1, productionTpChecks = 0, productionHighChecks = 0;
    const start = archive?.start ?? d.start, end = archive?.end ?? d.cutoff;
    const startIdx = core.lowerBound(s.candles, Date.parse(start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(end) + 1, c => c.endTs);
    const r = runCausalLongReplay({ id: archive?.engineId ?? name, executionModel: "causal_next_open", tpExecutionModel: tp as any,
      maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none" }, s,
      { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional",
        researchTpDeferral: age ? decision => {
          if (phaseEpisode !== decision.episode) { phaseEpisode = decision.episode; phase = "unseen"; }
          const live = aggressive10TpDecision(phase, decision.oldestEntryTime, decision.at, decision.basePct, decision.normalPct); phase = live.phase;
          const result = age.decide(decision); assert.equal(live.pct, result ? decision.normalPct : decision.basePct); productionTpChecks++; return result;
        } : undefined,
        researchTpObserver: t => { const prev = targets.at(-1); if (!prev || prev.armedIndex !== t.armedIndex || prev.episode !== t.episode) targets.push(t); },
        researchReduction: decision => {
          if (!high) return null; const result = high.reduce(decision);
          if (result) {
            const cs = s.candles.slice(decision.index - 2879, decision.index + 1).map(c => ({ ...c, timestamp: c.ts }));
            const snapshot = aggressive10HighSnapshot(cs, decision.at);
            assert(aggressive10HighExit(snapshot, high.inventory as any)); productionHighChecks++;
          }
          return result;
        }, researchInventoryObserver: e => { high?.observe(e); events.push(e); }
      }, c, 32000);
    const row: R = { name, policy: p.id, spec: p, model: control ? d.control.model : `early-${tp}`, tp, start, end, startIdx, endIdx, lag: 0,
      digest: digest({ ...r, snapshots: [] }), metrics: exposureMetrics(r, 32000), audit: age?.counts ?? null,
      pendingAtEnd: r.executionAudit!.pendingAtEnd, blocked: r.blocked, productionTpChecks, productionHighChecks,
      counts: { targetEpisodes: new Set(age?.observations.filter(o => o.status === "extended").map(o => o.episode) ?? []).size,
        highEpisodes: new Set(events.filter(e => e.event.reason.startsWith("research_exit:")).map(e => e.episode)).size,
        interventionEpisodes: new Set([...(age?.observations.filter(o => o.status === "extended").map(o => o.episode) ?? []),
          ...events.filter(e => e.event.reason.startsWith("research_exit:")).map(e => e.episode)]).size } };
    const check = verifyCase(s, cfg, row, events, targets, age?.observations ?? [], high?.rows ?? [], raw); Object.assign(row, check);
    if (archive) { assert.equal(row.digest, archive.digest, "Exact archived L15 B17 digest"); assert.deepEqual(row.metrics, archive.metrics); assert.deepEqual(row.accounting, archive.accounting); }
    fs.writeFileSync(`${dir}/${name}-inventory.jsonl`, events.map(e => JSON.stringify(e)).join("\n") + "\n");
    write(`${dir}/${name}-targets.json`, targets); write(`${dir}/${name}-tp-observations.json`, age?.observations ?? []);
    write(`${dir}/${name}-high-reductions.json`, high?.rows ?? []); write(`${dir}/${name}-high-traces.json`, high?.traces ?? []);
    row.seconds = (Date.now() - startTime) / 1000; rows.push(row); write(`${dir}/results.json`, rows);
    console.log(JSON.stringify({ name, net: row.metrics.totalPnl, dd: row.metrics.maxDrawdownPct, wins: row.metrics.profitableEpisodes, losses: row.metrics.losingEpisodes, seconds: row.seconds }));
  }
  if (!control) write(`${dir}/comparisons.json`, rows.map(x => {
    const baseline = rows.find(b => b.tp === x.tp && b.policy === "baseline")!, guarded = rows.find(b => b.tp === x.tp && b.policy === "tp_age10")!;
    const delta = exposureDelta(x.metrics, baseline.metrics);
    return { name: x.name, baseline: delta, guarded: exposureDelta(x.metrics, guarded.metrics),
      baselineAttribution: componentAttribution(x.metrics, baseline.metrics), guardedAttribution: componentAttribution(x.metrics, guarded.metrics),
      incrementalScreen: { net: delta.pnlDelta >= 0, drawdown: delta.ddReductionPp >= -1e-9, months: delta.worstMonthDelta >= -250,
        survival: !x.accounting.firstNonpositive,
        sufficientInterventionEpisodes: x.policy === "baseline" ? null : x.counts.interventionEpisodes >= d.screen.minimumInterventionEpisodes }, deployable: false };
  }));
  await unchanged(read(`${OUT}/manifest.json`));
  write(`${dir}/verification.json`, { passed: true, cases: rows.length, archiveDigestsExact: control ? 1 : 0, fills: rows.reduce((n, r) => n + r.accounting.fills, 0),
    minuteMarks: rows.reduce((n, r) => n + r.accounting.independentMinutes, 0), productionTpChecks: rows.reduce((n, r) => n + r.productionTpChecks, 0),
    productionHighChecks: rows.reduce((n, r) => n + r.productionHighChecks, 0), independentHighChecks: rows.reduce((n, r) => n + r.highChecks, 0),
    pinsUnchanged: true, newTradingDefinitions: 0, liveChanges: 0, liquidationCertified: false });
}
async function main() {
  assert.equal(process.cwd(), path.resolve(__dirname, "..")); const command = process.argv[2], d = read(CARD); validate(d);
  if (command === "plan") return plan(d);
  assert(["control", "early"].includes(command)); const m = read(`${OUT}/manifest.json`); assert.deepEqual(m.card, d); await unchanged(m);
  await run(d, command === "control");
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
