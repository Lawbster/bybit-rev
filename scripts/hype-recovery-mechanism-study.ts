/** F05: frozen action isolation and event-driven distress mechanisms, local only. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, fileHash, hash } from "./hype-failed-recovery-study";
import { WeeklyExitController, weeklyTape } from "./mfi-weekly-exit-policy";
import { mfiTape } from "./mfi-distress-exit-policy";
import { auditDistress } from "./mfi-distress-exit-audit";
import { auditWeekly } from "./mfi-weekly-exit-audit";
import { RecoveryController, type Policy } from "./recovery-mechanism-policy";
import { priceFrame, supportSource, loadRecoveryPulse, type R } from "./recovery-mechanism-sources";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import type { EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
async function main() {
  assert.equal(process.cwd(), path.resolve(__dirname, ".."));
  const card = "research-inputs/recovery-mechanisms-2026-09-10.json", spec = read(card), cfg = read("bot-config.json"), archive = spec.archive;
  const out = path.resolve(process.argv[2] ?? `backtests/hype/${spec.id}`), rel = path.relative(path.resolve("backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Fresh backtests output required");
  assert.equal(await fileHash(`${archive}/verification.json`), spec.archiveVerificationHash);
  const old = read(`${archive}/manifest.json`), oldValidation = read(`${archive}/validation.json`); assert(oldValidation.passed);
  const previous: R[] = read(`${archive}/results.json`), bases = previous.filter(x => x.policy.id === "baseline"); assert.equal(bases.length, 4);
  const pins = new Map<string, string>();
  const pin = async (file: string, expected?: string) => { const h = await fileHash(file); if (expected) assert.equal(h, expected, file); pins.set(file, h); };
  for (const file of ["manifest.json", "results.json", "verification.json", "validation.json"]) await pin(`${archive}/${file}`);
  for (const p of old.pins) {
    if (p.file === "scripts/replay-causal-engine.ts") { assert.equal(p.sha256, spec.engineBridge.oldHash); await pin(p.file); }
    else await pin(p.file, p.sha256);
  }
  await pin(spec.engineBridge.sourceCopy, spec.engineBridge.oldHash);
  // Assert the engine bridge is exactly the documented opt-in flag, not a hidden model change.
  const engineBefore = fs.readFileSync(spec.engineBridge.sourceCopy, "utf8");
  const expectedEngine = engineBefore.replace('  /** Reproduce pre-audit archives ONLY;', '  /** F05 action-isolation control only. Default retains the original episode add lock. */\n  researchPartialAddPolicy?: "freeze" | "ordinary";\n  /** Reproduce pre-audit archives ONLY;')
    .replace('if (fraction !== undefined) researchNoAdds = true;', 'if (fraction !== undefined && opts.researchPartialAddPolicy !== "ordinary") researchNoAdds = true;');
  assert.equal(fs.readFileSync("scripts/replay-causal-engine.ts", "utf8"), expectedEngine);
  for (const file of [card, "scripts/hype-recovery-mechanism-study.ts", "scripts/recovery-mechanism-policy.ts", "scripts/recovery-mechanism-sources.ts", "scripts/recovery-mechanism-tests.ts"]) await pin(file);
  const protectedFiles = await Promise.all(["bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts", "src/bot/strategy.ts"].map(async file => ({ file, sha256: await fileHash(file) })));
  assert.equal(cfg.feeRate, spec.feeRate);
  process.env.SIM_START = spec.windows[0].start; process.env.SIM_END = spec.cutoff; process.env.SIM_EQUITY = String(spec.initialEquity);
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch"), { missingMinutes } = await import("./replay-candle-repair");
  console.log("[F05] building unchanged canonical series and current B17 inputs");
  const s = await core.buildSeries({ candleRepairFile: old.repairFile }); assert.equal(missingMinutes(s.candles).length, 0); assert.equal(s.candles.at(-1)!.endTs, Date.parse(spec.cutoff));
  s.marketInputs = await loadReplayMarketInputs(path.resolve("data"), cfg.symbol, Date.parse(spec.cutoff));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => { while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++; while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000 ? (btc[a].close / btc[b].open - 1) * 100 : null; });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  const mfi = mfiTape(s.candles, Date.parse(spec.indicatorSeed)), weekly = weeklyTape(s.candles, Date.parse(spec.indicatorSeed)), pulse = await loadRecoveryPulse(spec);
  fs.mkdirSync(out, { recursive: true }); const json = (f: string, x: unknown) => fs.writeFileSync(path.join(out, f), JSON.stringify(x, null, 2) + "\n");
  const jsonl = (f: string, xs: unknown[]) => fs.writeFileSync(path.join(out, f), xs.map(x => JSON.stringify(x)).join("\n") + "\n");
  json("manifest.json", { at: new Date().toISOString(), spec, repairFile: old.repairFile, pins: [...pins].map(([file, sha256]) => ({ file, sha256 })), protectedFiles, liveChanges: 0, engineBridge: spec.engineBridge });
  const results: R[] = [], parity: R[] = [];
  function run(base: R, policy: R, sensitivity: R, control?: R) {
    const name = `${base.model}--${policy.id}--${sensitivity.id}`, start = Date.now(); console.log(`[F05 run] ${name}`);
    const params: EngineParams = { id: policy.id === "baseline" ? base.model : name, executionModel: "causal_next_open", tpExecutionModel: base.tp,
      maxPositions: cfg.maxPositions, hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const wp = control ? policy : { id: "mfi_weekly_half", fraction: .5, mfiRequired: true, weeklyRequired: true };
    const wc = new WeeklyExitController(wp as any, mfi, weekly, sensitivity.sourceLagMs, sensitivity.fillDelayMs);
    const recovery = control ? null : new RecoveryController(policy as Policy, spec.event, {
      frame: (at, lag) => priceFrame(s.candles, at, lag), support: policy.family === "support" ? supportSource(s.candles, cfg.srShadow) : () => null,
      pulse: (at, lag) => pulse.snapshot(at, lag) }, sensitivity.sourceLagMs, sensitivity.fillDelayMs, policy.family === "weekly" ? wc : undefined);
    const events: ResearchInventoryEvent[] = [];
    const startIdx = core.lowerBound(s.candles, Date.parse(base.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(base.end) + 1, c => c.endTs);
    const r = runCausalLongReplay(params, s, { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional",
      researchReduction: recovery ? recovery.decide : wc.decide, researchAddVeto: recovery?.veto,
      researchPartialAddPolicy: policy.action === "half_ordinary" ? "ordinary" : undefined, researchInventoryObserver: e => events.push(e) }, cfg, spec.initialEquity);
    recovery ? recovery.finish() : wc.finish();
    const digest = hash(JSON.stringify({ ...r, snapshots: [] })), metrics = exposureMetrics(r, spec.initialEquity);
    const accounting = auditComponentAccounting(s.candles, events, metrics, startIdx, endIdx, spec.initialEquity, spec.feeRate, { fraction: .5, fillDelayMs: sensitivity.fillDelayMs });
    let audit: R, contextAudit: R | null = null;
    if (control) {
      audit = auditDistress(s.candles, events, wc.observations, policy as any, Date.parse(base.end), sensitivity.sourceLagMs, sensitivity.fillDelayMs);
      contextAudit = auditWeekly(s.candles, wc.observations, policy as any, sensitivity.sourceLagMs);
      assert.equal(digest, control.digest, `F04 digest ${name}`); assert.deepEqual(metrics, control.metrics); assert.deepEqual(accounting, control.accounting);
      assert.deepEqual(audit, control.audit); assert.deepEqual(contextAudit, control.contextAudit);
      const file = `${name}-observations.json`, oldHash = oldValidation.artifacts.find((x: R) => x.file === file).sha256;
      assert.equal(hash(fs.readFileSync(`${archive}/${file}`)), oldHash); assert.deepEqual(wc.observations, read(`${archive}/${file}`));
      parity.push({ name, digest, passed: true });
    } else audit = { armed: recovery!.observations.filter(x => x.status === "armed").length,
      signals: recovery!.observations.filter(x => x.status === "signal").length, executed: events.filter(x => x.event.reason.startsWith("research_exit:")).length,
      addVetoes: recovery!.vetoes.length, invalidations: recovery!.observations.filter(x => x.status === "invalidated").length,
      afterJuly15: recovery!.observations.filter(x => x.status === "signal" && x.at >= Date.UTC(2026, 6, 15)).length,
      statusCounts: recovery!.observations.reduce((x: R, y) => { const k = y.reason ?? y.status; x[k] = (x[k] ?? 0) + 1; return x; }, {}) };
    const row = { name, control: !!control, model: base.model, window: base.window, tp: base.tp, start: base.start, end: base.end, startIdx, endIdx,
      policy, sensitivity, digest, metrics, accounting, audit, contextAudit, blocked: r.blocked, pendingAtEnd: r.executionAudit!.pendingAtEnd, elapsedMs: Date.now() - start };
    jsonl(`${name}-inventory.jsonl`, events); json(`${name}-observations.json`, recovery?.observations ?? wc.observations);
    if (recovery) { json(`${name}-vetoes.json`, recovery.vetoes); if (policy.family === "weekly") json(`${name}-weekly.json`, wc.observations); }
    core.writeCsv(path.join(out, `${name}-closes.csv`), r.closes); core.writeCsv(path.join(out, `${name}-partials.csv`), r.trims);
    json(`${name}-summary.json`, row); results.push(row); json("results.json", results);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, signals: audit.signals, cuts: audit.executed, seconds: row.elapsedMs / 1000 }));
  }
  for (const old of previous) run(old, old.policy, old.sensitivity, old);
  assert.equal(parity.length, 28); json("control-parity.json", { passed: true, cases: parity });
  for (const sensitivity of spec.sensitivities) for (const policy of spec.policies) for (const base of bases.filter(x => !policy.hl || x.window === "hl_extended")) run(base, policy, sensitivity);
  assert.equal(results.length, spec.runCount);
  const comparisons = results.filter(x => !x.control).map(v => {
    const b = results.find(x => x.model === v.model && x.policy.id === "baseline")!, parent = results.find(x => x.model === v.model && x.policy.id === "mfi_weekly_half" && x.sensitivity.id === v.sensitivity.id)!;
    const bm = new Map<string, R>(b.metrics.episodes.map((e: R) => [e.entry, e]));
    return { name: v.name, delta: exposureDelta(v.metrics, b.metrics), attribution: componentAttribution(v.metrics, b.metrics), versusWeekly: exposureDelta(v.metrics, parent.metrics),
      extra5bpsDelta: v.accounting.fixedPathExtra5bpsNet - b.accounting.fixedPathExtra5bpsNet,
      matched: v.metrics.episodes.filter((e: R) => bm.has(e.entry)).map((e: R) => ({ entry: e.entry, before: bm.get(e.entry), after: e, delta: e.pnl - bm.get(e.entry)!.pnl })) };
  }); json("comparisons.json", comparisons);
  const ranking = spec.policies.map((p: Policy) => {
    const failures: string[] = []; if (p.hl) failures.push("full_history_unavailable_not_qualified");
    for (const x of results.filter(x => !x.control && x.policy.id === p.id && x.sensitivity.id === "primary")) {
      const d = comparisons.find(x2 => x2.name === x.name)!.delta;
      if (d.pnlDelta < (x.window === "hl_extended" ? spec.screen.minimumRecentNetDelta : spec.screen.minimumPublishedNetDelta)) failures.push(`${x.model}:net`);
      if (d.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`);
      if (d.worstMonthDelta < spec.screen.minimumMonthlyDelta) failures.push(`${x.model}:monthly`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:insolvency`);
    }
    return { policy: p.id, passesEconomicScreen: !failures.length, failures, deployable: false };
  }); json("ranking.json", ranking);
  core.writeCsv(path.join(out, "overview.csv"), results.map(x => ({ model: x.model, policy: x.policy.id, sensitivity: x.sensitivity.id, control: x.control,
    net: x.metrics.totalPnl, wins: x.metrics.profitableEpisodes, losses: x.metrics.losingEpisodes, winDollars: x.metrics.grossWin, lossDollars: -x.metrics.grossLoss,
    dd: x.metrics.maxDrawdownPct, minEquity: x.metrics.minEquity, open: x.metrics.openPnl, forced: x.metrics.forcedCloses, tpCycles: x.metrics.tpCycles, ...x.audit })));
  core.writeCsv(path.join(out, "monthly.csv"), results.flatMap(x => x.accounting.monthly.map((m: R) => ({ model: x.model, policy: x.policy.id, sensitivity: x.sensitivity.id, ...m }))));
  for (const [file, h] of pins) assert.equal(await fileHash(file), h, file); for (const p of protectedFiles) assert.equal(await fileHash(p.file), p.sha256, p.file);
  const artifacts = []; for (const file of fs.readdirSync(out)) artifacts.push({ file, sha256: await fileHash(path.join(out, file)) });
  json("validation.json", { passed: true, cases: results.length, controlsExact: parity.length, newTradingDefinitions: 10, liveChanges: 0, artifacts });
  console.log(`[F05 done] ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
