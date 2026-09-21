/** F06: frozen conditional target deferral, unchanged construction/half-exits. Local only. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, fileHash, hash } from "./hype-failed-recovery-study";
import { SoftStaleController, type R } from "./conditional-soft-stale-policy";
import { buildSoftStaleSources, softStaleContext } from "./conditional-soft-stale-sources";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import type { EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent, ResearchTpTarget } from "./replay-causal-engine";
async function main() {
  assert.equal(process.cwd(), path.resolve(__dirname, ".."));
  const card = "research-inputs/conditional-soft-stale-2026-09-10.json", spec = read(card), cfg = read("bot-config.json"), archive = spec.archive;
  const out = path.resolve(process.argv[2] ?? `backtests/hype/${spec.id}`), rel = path.relative(path.resolve("backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Fresh backtests output required");
  assert.equal(await fileHash(`${archive}/verification.json`), spec.archiveVerificationHash);
  assert.equal(await fileHash(`${spec.componentArchive}/verification.json`), spec.componentVerificationHash);
  const old = read(`${archive}/manifest.json`); assert(read(`${archive}/validation.json`).passed);
  const bases: R[] = read(`${archive}/results.json`).filter((x: R) => x.policy.id === "baseline"); assert.equal(bases.length, 4);
  const noStale: R[] = read(`${spec.componentArchive}/results.json`).filter((x: R) => x.policy === "minus_soft_stale"); assert.equal(noStale.length, 4);
  const pins = new Map<string, string>();
  const pin = async (file: string, expected?: string) => { const h = await fileHash(file); if (expected) assert.equal(h, expected, file); pins.set(file, h); };
  for (const dir of [archive, spec.componentArchive]) for (const f of ["manifest.json", "results.json", "verification.json", "validation.json"]) await pin(`${dir}/${f}`);
  for (const p of old.pins) {
    if (p.file === "scripts/replay-causal-engine.ts") { assert.equal(p.sha256, spec.engineBridge.oldHash); await pin(p.file); }
    else await pin(p.file, p.sha256);
  }
  await pin(spec.engineBridge.sourceCopy, spec.engineBridge.oldHash);
  for (const file of [card, "scripts/hype-conditional-soft-stale-study.ts", "scripts/conditional-soft-stale-policy.ts", "scripts/conditional-soft-stale-sources.ts", "scripts/conditional-soft-stale-tests.ts", "src/research/closed-bars.ts"]) await pin(file);
  const protectedFiles = await Promise.all(["bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts", "src/bot/strategy.ts"].map(async file => ({ file, sha256: await fileHash(file) })));
  assert.equal(cfg.feeRate, spec.feeRate); assert(cfg.exits.softStale && cfg.exits.staleHours === 4 && cfg.exits.reducedTpPct === .5 && cfg.tpPct === 1.4);
  process.env.SIM_START = spec.windows[0].start; process.env.SIM_END = spec.cutoff; process.env.SIM_EQUITY = String(spec.initialEquity);
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch"), { missingMinutes } = await import("./replay-candle-repair");
  console.log("[F06] building unchanged canonical series and current B17 inputs");
  const s = await core.buildSeries({ candleRepairFile: old.repairFile }); assert.equal(missingMinutes(s.candles).length, 0); assert.equal(s.candles.at(-1)!.endTs, Date.parse(spec.cutoff));
  s.marketInputs = await loadReplayMarketInputs(path.resolve("data"), cfg.symbol, Date.parse(spec.cutoff));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => { while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++; while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000 ? (btc[a].close / btc[b].open - 1) * 100 : null; });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  console.log("[F06] completed-bar source tape and canonical trend parity");
  const tape = buildSoftStaleSources(s.candles, s);
  fs.mkdirSync(out, { recursive: true }); const json = (f: string, x: unknown) => fs.writeFileSync(path.join(out, f), JSON.stringify(x, null, 2) + "\n");
  const jsonl = (f: string, xs: unknown[]) => fs.writeFileSync(path.join(out, f), xs.map(x => JSON.stringify(x)).join("\n") + "\n");
  json("manifest.json", { at: new Date().toISOString(), spec, repairFile: old.repairFile, pins: [...pins].map(([file, sha256]) => ({ file, sha256 })), protectedFiles, liveChanges: 0 });
  json("sources.json", tape);
  const results: R[] = [], parity: R[] = [];
  function run(base: R, policy: R, sensitivity: R, control?: R) {
    const name = `${base.model}--${policy.id}--${sensitivity.id}`, start = Date.now(); console.log(`[F06 run] ${name}`);
    const runCfg = structuredClone(cfg); if (policy.id === "minus_soft_stale") runCfg.exits.softStale = false;
    const params: EngineParams = { id: policy.id === "baseline" ? base.model : policy.id === "minus_soft_stale" ? `${base.model}--minus_soft_stale` : name,
      executionModel: "causal_next_open", tpExecutionModel: base.tp, maxPositions: cfg.maxPositions, hardFlattenHours: cfg.exits.hardFlattenHours,
      hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const controller = control ? null : new SoftStaleController(policy.family, spec.maxAgeHours, sensitivity.releaseDelayMs,
      softStaleContext(policy.family, tape, s.candles, cfg, sensitivity.sourceLagMs, spec.resistanceRoomPct));
    const events: ResearchInventoryEvent[] = [], targets: ResearchTpTarget[] = [];
    const startIdx = core.lowerBound(s.candles, Date.parse(base.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(base.end) + 1, c => c.endTs);
    const r = runCausalLongReplay(params, s, { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional",
      researchTpDeferral: controller?.decide, researchInventoryObserver: e => events.push(e), researchTpObserver: t => {
        const prev = targets.at(-1); if (!prev || prev.episode !== t.episode || prev.armedAt !== t.armedAt || prev.armedIndex !== t.armedIndex) targets.push(t);
      } }, runCfg, spec.initialEquity);
    const digest = hash(JSON.stringify({ ...r, snapshots: [] })), metrics = exposureMetrics(r, spec.initialEquity);
    const accounting = auditComponentAccounting(s.candles, events, metrics, startIdx, endIdx, spec.initialEquity, spec.feeRate);
    if (control) { assert.equal(digest, control.digest, `Archived digest ${name}`); assert.deepEqual(metrics, control.metrics); assert.deepEqual(accounting, control.accounting); parity.push({ name, digest, passed: true }); }
    const statuses = controller?.observations.reduce((x: R, y) => { x[y.status] = (x[y.status] ?? 0) + 1; return x; }, {}) ?? {};
    const row = { name, control: !!control, model: base.model, window: base.window, tp: base.tp, start: base.start, end: base.end, startIdx, endIdx,
      policy, sensitivity, digest, metrics, accounting, audit: { statuses, ...controller?.counts, targetChanges: targets.length }, blocked: r.blocked,
      pendingAtEnd: r.executionAudit!.pendingAtEnd, elapsedMs: Date.now() - start };
    jsonl(`${name}-inventory.jsonl`, events); json(`${name}-observations.json`, controller?.observations ?? []); json(`${name}-targets.json`, targets);
    core.writeCsv(path.join(out, `${name}-closes.csv`), r.closes); core.writeCsv(path.join(out, `${name}-partials.csv`), r.trims);
    json(`${name}-summary.json`, row); results.push(row); json("results.json", results);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, statuses, seconds: row.elapsedMs / 1000 }));
  }
  for (const base of bases) run(base, { id: "baseline" }, spec.sensitivities[0], base);
  for (const base of bases) run(base, { id: "minus_soft_stale" }, spec.sensitivities[0], noStale.find(x => x.model === base.model));
  assert.equal(parity.length, 8); json("control-parity.json", { passed: true, cases: parity });
  for (const sensitivity of spec.sensitivities) for (const policy of spec.policies) for (const base of bases) run(base, policy, sensitivity);
  assert.equal(results.length, spec.runCount);
  const comparisons = results.filter(x => x.policy.id !== "baseline").map(v => {
    const b = results.find(x => x.model === v.model && x.policy.id === "baseline")!;
    return { name: v.name, delta: exposureDelta(v.metrics, b.metrics), attribution: componentAttribution(v.metrics, b.metrics), extra5bpsDelta: v.accounting.fixedPathExtra5bpsNet - b.accounting.fixedPathExtra5bpsNet };
  }); json("comparisons.json", comparisons);
  const ranking = [{ id: "minus_soft_stale" }, ...spec.policies].map((p: R) => {
    const failures: string[] = [];
    for (const x of results.filter(x => x.policy.id === p.id && x.sensitivity.id === "primary")) {
      const d = comparisons.find(y => y.name === x.name)!.delta;
      if (d.pnlDelta < (x.window === "hl_extended" ? spec.screen.minimumRecentNetDelta : spec.screen.minimumPublishedNetDelta)) failures.push(`${x.model}:net`);
      if (d.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`);
      if (d.worstMonthDelta < spec.screen.minimumMonthlyDelta) failures.push(`${x.model}:monthly`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:insolvency`);
    } return { policy: p.id, passesEconomicScreen: !failures.length, failures, deployable: false };
  }); json("ranking.json", ranking);
  core.writeCsv(path.join(out, "overview.csv"), results.map(x => ({ model: x.model, policy: x.policy.id, sensitivity: x.sensitivity.id, control: x.control,
    net: x.metrics.totalPnl, wins: x.metrics.profitableEpisodes, losses: x.metrics.losingEpisodes, winDollars: x.metrics.grossWin, lossDollars: -x.metrics.grossLoss,
    dd: x.metrics.maxDrawdownPct, minEquity: x.metrics.minEquity, open: x.metrics.openPnl, forced: x.metrics.forcedCloses, tpCycles: x.metrics.tpCycles, ...x.audit.statuses })));
  core.writeCsv(path.join(out, "monthly.csv"), results.flatMap(x => x.accounting.monthly.map((m: R) => ({ model: x.model, policy: x.policy.id, sensitivity: x.sensitivity.id, ...m }))));
  for (const [file, h] of pins) assert.equal(await fileHash(file), h, file); for (const p of protectedFiles) assert.equal(await fileHash(p.file), p.sha256, p.file);
  const artifacts = []; for (const file of fs.readdirSync(out)) artifacts.push({ file, sha256: await fileHash(path.join(out, file)) });
  json("validation.json", { passed: true, cases: results.length, controlsExact: parity.length, newTradingDefinitions: 4, liveChanges: 0, artifacts });
  console.log(`[F06 done] ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
