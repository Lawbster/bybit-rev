/** F04: frozen three-case full-path replay; engine and F02 implementation unchanged. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, fileHash, hash } from "./hype-failed-recovery-study";
import { WeeklyExitController, weeklyTape, type WeeklyPolicy } from "./mfi-weekly-exit-policy";
import { mfiTape } from "./mfi-distress-exit-policy";
import { auditDistress } from "./mfi-distress-exit-audit";
import { auditWeekly } from "./mfi-weekly-exit-audit";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import type { EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
type Row = Record<string, any>;
async function main() {
  assert.equal(process.cwd(), path.resolve(__dirname, ".."));
  const card = "research-inputs/mfi-weekly-exit-2026-09-09.json", spec = read(card), cfg = read("bot-config.json");
  const out = path.resolve(process.argv[2] ?? `backtests/hype/${spec.id}`), rel = path.relative(path.resolve("backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Fresh backtests output required");
  const pins = new Map<string, string>();
  const pin = async (file: string, expected?: string) => { const h = await fileHash(file); if (expected) assert.equal(h, expected, file); pins.set(file, h); };
  for (const [file, h] of Object.entries(spec.archivePins)) await pin(`${spec.archive}/${file}`, h as string);
  for (const [file, h] of Object.entries(spec.diagnosticPins)) await pin(`${spec.diagnostic}/${file}`, h as string);
  const old = read(`${spec.archive}/manifest.json`), oldVerification = read(`${spec.archive}/verification.json`);
  assert(oldVerification.passed); assert(read(`${spec.diagnostic}/verification.json`).passed);
  console.log("[F04] pinning accepted F02 inputs, source and config; no engine extensions");
  for (const p of old.pins) await pin(p.file, p.sha256);
  for (const file of [card, "scripts/hype-mfi-weekly-exit-study.ts", "scripts/mfi-weekly-exit-policy.ts", "scripts/mfi-weekly-exit-audit.ts",
    "scripts/mfi-weekly-exit-tests.ts", "src/research/vwap-volume-features.ts"]) await pin(file);
  const protectedFiles = await Promise.all(["bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts", "src/bot/strategy.ts"]
    .map(async file => ({ file, sha256: await fileHash(file) })));
  assert.equal(cfg.feeRate, spec.feeRate);
  const previous: Row[] = read(`${spec.archive}/results.json`), diagnostic: Row[] = read(`${spec.diagnostic}/rows.json`);
  const prior = read(`${old.spec.archive}/manifest.json`), bases: Row[] = read(`${old.spec.archive}/results.json`).filter((x: Row) => x.policy === "B17" && x.window !== "hl_window_latest");
  assert.equal(bases.length, 4);
  process.env.SIM_START = spec.windows[0].start; process.env.SIM_END = spec.cutoff; process.env.SIM_EQUITY = String(spec.initialEquity);
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch"), { missingMinutes } = await import("./replay-candle-repair");
  const s = await core.buildSeries({ candleRepairFile: prior.spec.repairFile }); assert.equal(missingMinutes(s.candles).length, 0);
  assert.equal(s.candles.at(-1)!.endTs, Date.parse(spec.cutoff));
  s.marketInputs = await loadReplayMarketInputs(path.resolve("data"), cfg.symbol, Date.parse(spec.cutoff));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000
      ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  const mfi = mfiTape(s.candles, Date.parse(spec.indicatorSeed)), weekly = weeklyTape(s.candles, Date.parse(spec.indicatorSeed));
  // Verify new feature implementation against previously frozen F03 values before any new economic result.
  let contextParity = 0;
  for (const x of diagnostic) for (const lag of [0, 60000]) {
    const e = weekly(x.at, lag); assert(e.ready); assert.equal(e.passes, x.flags[lag ? "source60" : "primary"].C3);
    if (!lag) { const v = x.trajectory.at(-1); assert(Math.abs(e.distancePct! - v.m60_weekVwapDistancePct) < 1e-8); assert(Math.abs(e.roc5! - v.m60_roc5) < 1e-8); }
    contextParity++;
  }
  fs.mkdirSync(out, { recursive: true });
  const json = (f: string, x: unknown) => fs.writeFileSync(path.join(out, f), JSON.stringify(x, null, 2) + "\n");
  const jsonl = (f: string, xs: unknown[]) => fs.writeFileSync(path.join(out, f), xs.map(x => JSON.stringify(x)).join("\n") + "\n");
  json("manifest.json", { at: new Date().toISOString(), spec, repairFile: prior.spec.repairFile, pins: [...pins].map(([file, sha256]) => ({ file, sha256 })), protectedFiles,
    contextParity, newTradingDefinitions: 1, engineChanges: 0, liveChanges: 0 });
  const results: Row[] = [], parity: Row[] = [];
  function run(base: Row, policy: WeeklyPolicy, sensitivity: Row) {
    const name = `${base.model}--${policy.id}--${sensitivity.id}`, start = Date.now(); console.log(`[F04 run] ${name}`);
    assert.equal(hash(JSON.stringify(cfg)), base.configHash);
    const params: EngineParams = { id: policy.id === "baseline" ? base.model : name, executionModel: "causal_next_open", tpExecutionModel: base.tp,
      maxPositions: cfg.maxPositions, hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const startIdx = core.lowerBound(s.candles, Date.parse(base.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(base.end) + 1, c => c.endTs);
    const controller = new WeeklyExitController(policy, mfi, weekly, sensitivity.sourceLagMs, sensitivity.fillDelayMs), events: ResearchInventoryEvent[] = [];
    const r = runCausalLongReplay(params, s, { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional", researchReduction: controller.decide,
      researchInventoryObserver: e => events.push(e) }, cfg, spec.initialEquity); controller.finish();
    const digest = hash(JSON.stringify({ ...r, snapshots: [] })), metrics = exposureMetrics(r, spec.initialEquity);
    const accounting = auditComponentAccounting(s.candles, events, metrics, startIdx, endIdx, spec.initialEquity, spec.feeRate, { fraction: policy.fraction, fillDelayMs: sensitivity.fillDelayMs });
    const audit = auditDistress(s.candles, events, controller.observations, policy, Date.parse(base.end), sensitivity.sourceLagMs, sensitivity.fillDelayMs);
    const contextAudit = auditWeekly(s.candles, controller.observations, policy, sensitivity.sourceLagMs);
    if (!policy.weeklyRequired) {
      const expected = previous.find(x => x.name === name); assert(expected); assert.equal(digest, expected.digest, `F02 control digest ${name}`);
      assert.deepEqual(metrics, expected.metrics); assert.deepEqual(accounting, expected.accounting); assert.deepEqual(audit, expected.audit);
      assert.deepEqual(controller.observations, read(`${spec.archive}/${name}-observations.json`));
      if (policy.id === "baseline") assert.equal(digest, base.digest);
      parity.push({ name, digest, passed: true });
    }
    const row = { name, model: base.model, window: base.window, tp: base.tp, start: base.start, end: base.end, startIdx, endIdx, policy, sensitivity,
      digest, metrics, accounting, audit, contextAudit, blocked: r.blocked, pendingAtEnd: r.executionAudit!.pendingAtEnd, elapsedMs: Date.now() - start };
    jsonl(`${name}-inventory.jsonl`, events); json(`${name}-observations.json`, controller.observations);
    core.writeCsv(path.join(out, `${name}-closes.csv`), r.closes); core.writeCsv(path.join(out, `${name}-partials.csv`), r.trims);
    json(`${name}-summary.json`, row); results.push(row); json("results.json", results);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, wins: metrics.profitableEpisodes, losses: metrics.losingEpisodes, dd: metrics.maxDrawdownPct, cuts: audit.executed, vetoes: contextAudit.vetoes, seconds: row.elapsedMs / 1000 }));
  }
  for (const base of bases) run(base, spec.policies[0], spec.sensitivities[0]);
  for (const sensitivity of spec.sensitivities) for (const base of bases) run(base, spec.policies[1], sensitivity);
  assert.equal(parity.length, 16); json("control-parity.json", { passed: true, contextParity, cases: parity });
  for (const sensitivity of spec.sensitivities) for (const base of bases) run(base, spec.policies[2], sensitivity);
  assert.equal(results.length, spec.runCount);
  const comparisons = results.filter(x => x.policy.id !== "baseline").map(v => {
    const b = results.find(x => x.model === v.model && x.policy.id === "baseline")!;
    const original = results.find(x => x.model === v.model && x.policy.id === "mfi_half" && x.sensitivity.id === v.sensitivity.id)!;
    const bm = new Map<string, Row>(b.metrics.episodes.map((e: Row) => [e.entry, e]));
    const matched = v.metrics.episodes.filter((e: Row) => bm.has(e.entry)).map((e: Row) => ({ entry: e.entry, before: bm.get(e.entry), after: e, delta: e.pnl - bm.get(e.entry)!.pnl }));
    return { name: v.name, delta: exposureDelta(v.metrics, b.metrics), attribution: componentAttribution(v.metrics, b.metrics),
      versusOriginal: exposureDelta(v.metrics, original.metrics), versusOriginalAttribution: componentAttribution(v.metrics, original.metrics),
      extra5bpsDelta: v.accounting.fixedPathExtra5bpsNet - b.accounting.fixedPathExtra5bpsNet, matched,
      removed: b.metrics.episodes.filter((e: Row) => !v.metrics.episodes.some((p: Row) => p.entry === e.entry)),
      replacement: v.metrics.episodes.filter((e: Row) => !bm.has(e.entry)) };
  }); json("comparisons.json", comparisons);
  const predictionChecks = results.filter(x => x.policy.weeklyRequired && x.sensitivity.id === "primary").map(v => {
    const xs = diagnostic.filter(x => x.model === v.model && x.selected && x.flags.primary.C3);
    const predictedContribution = xs.reduce((n, x) => n + x.delta, 0), actualDelta = comparisons.find(x => x.name === v.name)!.delta.pnlDelta;
    return { model: v.model, selectedF03: xs.length, actualCuts: v.audit.executed, predictedContribution, actualDelta, difference: actualDelta - predictedContribution };
  }); json("diagnostic-versus-replay.json", predictionChecks);
  const ranking = spec.policies.slice(1).map((p: WeeklyPolicy) => {
    const failures: string[] = [];
    for (const x of results.filter(r => r.policy.id === p.id && r.sensitivity.id === "primary")) {
      const d = comparisons.find(c => c.name === x.name)!.delta;
      if (d.pnlDelta < (x.window === "hl_extended" ? spec.screen.minimumRecentNetDelta : spec.screen.minimumPublishedNetDelta)) failures.push(`${x.model}:net`);
      if (d.ddReductionPp < -spec.screen.maximumDrawdownIncreasePp - 1e-9) failures.push(`${x.model}:drawdown`);
      if (d.worstMonthDelta < spec.screen.minimumMonthlyDelta) failures.push(`${x.model}:monthly`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:insolvency`);
    } return { policy: p.id, passesEconomicScreen: !failures.length, failures, deployable: false };
  }); json("ranking.json", ranking);
  core.writeCsv(path.join(out, "overview.csv"), results.map(r => ({ model: r.model, policy: r.policy.id, sensitivity: r.sensitivity.id,
    net: r.metrics.totalPnl, wins: r.metrics.profitableEpisodes, losses: r.metrics.losingEpisodes, winDollars: r.metrics.grossWin, lossDollars: -r.metrics.grossLoss,
    dd: r.metrics.maxDrawdownPct, minEquity: r.metrics.minEquity, open: r.metrics.openPnl, tpCycles: r.metrics.tpCycles, forced: r.metrics.forcedCloses,
    cuts: r.audit.executed, vetoes: r.contextAudit.vetoes, afterJuly15: r.audit.afterJuly15 })));
  core.writeCsv(path.join(out, "monthly.csv"), results.flatMap(r => r.accounting.monthly.map((m: Row) => ({ model: r.model, policy: r.policy.id, sensitivity: r.sensitivity.id, ...m }))));
  for (const [file, h] of pins) assert.equal(await fileHash(file), h, `Input changed ${file}`);
  for (const p of protectedFiles) assert.equal(await fileHash(p.file), p.sha256, `Protected file changed ${p.file}`);
  const artifacts = []; for (const file of fs.readdirSync(out)) artifacts.push({ file, sha256: await fileHash(path.join(out, file)) });
  json("validation.json", { passed: true, cases: results.length, controlsExact: parity.length, contextParity, artifacts,
    newTradingDefinitions: 1, hashesUnchanged: true, engineChanges: 0, liveChanges: 0 });
  console.log(`[F04 done] ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
