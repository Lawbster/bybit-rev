/** F02: frozen five-case, actual changed-path early-exit experiment. Local only. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import type { EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
import { DistressExitController, mfiTape, type ExitPolicy } from "./mfi-distress-exit-policy";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import { auditDistress } from "./mfi-distress-exit-audit";
const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
const hash = (x: string | Buffer) => crypto.createHash("sha256").update(x).digest("hex");
async function fileHash(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
async function main() {
  assert.equal(process.cwd(), path.resolve(__dirname, ".."));
  const card = "research-inputs/mfi-distress-exit-2026-09-09.json", spec = read(card), cfg = read("bot-config.json");
  const out = path.resolve(process.argv[2] ?? `backtests/hype/${spec.id}`), rel = path.relative(path.resolve("backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Fresh output directory required");
  const pins = new Map<string, string>();
  const pin = async (file: string, expected?: string) => { const sha256 = await fileHash(file); if (expected) assert.equal(sha256, expected, file); pins.set(file, sha256); };
  for (const [f, h] of Object.entries(spec.archivePins)) await pin(`${spec.archive}/${f}`, h as string);
  const prior = read(`${spec.archive}/manifest.json`); assert(read(`${spec.archive}/verification.json`).passed);
  const bases = read(`${spec.archive}/results.json`).filter((x: any) => x.policy === "B17" && x.window !== "hl_window_latest"); assert.equal(bases.length, 4);
  console.log("[F02 preflight] pin all accepted inputs and sources; two narrow research-only extensions");
  for (const p of prior.inputs) await pin(p.file, p.sha256);
  const exceptions: any[] = [];
  for (const p of prior.sources) {
    if (spec.approvedSourceExtensions[p.file]) {
      assert.equal(p.sha256, spec.approvedSourceExtensions[p.file]); await pin(p.file);
      exceptions.push({ file: p.file, old: p.sha256, current: pins.get(p.file), scope: spec.sourceExtensionScope });
    } else await pin(p.file, p.sha256);
  }
  for (const f of [card, "scripts/hype-mfi-distress-exit-study.ts", "scripts/mfi-distress-exit-policy.ts", "scripts/mfi-distress-exit-tests.ts",
    "scripts/mfi-distress-exit-audit.ts", "src/research/volume-flow-features.ts", "scripts/hype-ladder-regroup-audit.ts",
    "backtests/hype/hype-pressure-point-atlas-2026-09-09-v2/selected-pressure-details.json",
    "backtests/hype/hype-pressure-point-atlas-2026-09-09-v2/pressure.json"]) await pin(f);
  const protectedFiles = [];
  for (const file of ["bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts", "src/bot/strategy.ts"]) {
    await pin(file); protectedFiles.push({ file, sha256: pins.get(file) });
  }
  assert.equal(cfg.feeRate, spec.feeRate);
  fs.mkdirSync(out, { recursive: true });
  const json = (f: string, x: unknown) => fs.writeFileSync(path.join(out, f), JSON.stringify(x, null, 2) + "\n");
  const jsonl = (f: string, x: unknown[]) => fs.writeFileSync(path.join(out, f), x.map(r => JSON.stringify(r)).join("\n") + "\n");
  json("manifest.json", { at: new Date().toISOString(), node: process.version, spec, pins: [...pins].map(([file, sha256]) => ({ file, sha256 })), exceptions, protectedFiles, liveChanges: 0 });
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = spec.cutoff; process.env.SIM_EQUITY = String(spec.initialEquity);
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
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
  const mfi = mfiTape(s.candles, Date.parse(spec.indicatorSeed)), results: any[] = [], parity: any[] = [];
  const details = read("backtests/hype/hype-pressure-point-atlas-2026-09-09-v2/selected-pressure-details.json");
  const pressure = read("backtests/hype/hype-pressure-point-atlas-2026-09-09-v2/pressure.json");
  function run(base: any, policy: ExitPolicy, sensitivity: any) {
    const { sourceLagMs, fillDelayMs } = sensitivity, name = `${base.model}--${policy.id}--${sensitivity.id}`, start = Date.now();
    console.log(`[F02 run] ${name}`);
    const control = policy.id === "baseline", params: EngineParams = { id: control ? base.model : name, executionModel: "causal_next_open", tpExecutionModel: base.tp,
      maxPositions: cfg.maxPositions, hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    assert.equal(hash(JSON.stringify(cfg)), base.configHash);
    const startIdx = core.lowerBound(s.candles, Date.parse(base.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(base.end) + 1, c => c.endTs);
    const c = new DistressExitController(policy, mfi, sourceLagMs, fillDelayMs), events: ResearchInventoryEvent[] = [];
    const r = runCausalLongReplay(params, s, { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional", researchReduction: c.decide,
      researchInventoryObserver: e => events.push(e) }, cfg, spec.initialEquity); c.finish();
    const digest = hash(JSON.stringify({ ...r, snapshots: [] }));
    if (control) {
      assert.equal(digest, base.digest, `Full baseline digest ${base.model}`);
      if (base.window === "hl_extended") {
        const expected = pressure.filter((x: any) => x.model === base.model && x.landmarkMinutes === 60);
        const got = c.observations.filter(o => o.mfi);
        assert.deepEqual(got.map(o => [o.episode, o.at]), expected.map((o: any) => [o.episode, o.at]), "P01 landmark parity");
        for (const x of details.filter((x: any) => x.model === base.model && x.bin === "m30_mfi14_le_20" && x.lagMs === 0)) {
          assert(Math.abs(got.find(o => o.at === x.at)!.mfi!.value! - x.value) < 1e-9, "P01 MFI feature parity");
        }
      }
      parity.push({ model: base.model, digest, passed: true });
    }
    const metrics = exposureMetrics(r, spec.initialEquity);
    const accounting = auditComponentAccounting(s.candles, events, metrics, startIdx, endIdx, spec.initialEquity, cfg.feeRate, { fraction: policy.fraction, fillDelayMs });
    if (control) assert.deepEqual(accounting, base.accounting, "Independent baseline accounting parity");
    const audit = auditDistress(s.candles, events, c.observations, policy, Date.parse(base.end), sourceLagMs, fillDelayMs);
    const row = { name, model: base.model, window: base.window, tp: base.tp, start: base.start, end: base.end, startIdx, endIdx, policy, sensitivity,
      digest, metrics, accounting, audit, blocked: r.blocked, pendingAtEnd: r.executionAudit!.pendingAtEnd, elapsedMs: Date.now() - start };
    jsonl(`${name}-inventory.jsonl`, events); json(`${name}-observations.json`, c.observations);
    core.writeCsv(path.join(out, `${name}-closes.csv`), r.closes); core.writeCsv(path.join(out, `${name}-partials.csv`), r.trims);
    json(`${name}-summary.json`, row); results.push(row); json("results.json", results);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, wins: metrics.profitableEpisodes, losses: metrics.losingEpisodes, dd: metrics.maxDrawdownPct, exits: audit.executed, seconds: row.elapsedMs / 1000 }));
  }
  // Run all controls first; no variant profit is inspected until exact parity is certified.
  for (const base of bases) run(base, spec.policies[0], spec.sensitivities[0]);
  assert.equal(parity.length, 4); json("baseline-parity.json", { passed: true, cases: parity });
  for (const sensitivity of spec.sensitivities) for (const base of bases) for (const policy of spec.policies.slice(1)) {
    if (sensitivity.id === "source60" && !policy.mfiRequired) continue;
    run(base, policy, sensitivity);
  }
  assert.equal(results.length, 44);
  const comparisons = results.filter(r => r.policy.id !== "baseline").map(v => {
    const b = results.find(r => r.model === v.model && r.policy.id === "baseline")!;
    const blind = v.policy.mfiRequired ? results.find(r => r.model === v.model && r.policy.id === (v.policy.fraction === .5 ? "blind_half" : "blind_full") && r.sensitivity.id === (v.sensitivity.id === "source60" ? "primary" : v.sensitivity.id)) : null;
    const bm = new Map(b.metrics.episodes.map((e: any) => [e.entry, e]));
    const matched = v.metrics.episodes.filter((e: any) => bm.has(e.entry)).map((e: any) => ({ entry: e.entry, before: bm.get(e.entry), after: e, delta: e.pnl - (bm.get(e.entry) as any).pnl }));
    const removed = b.metrics.episodes.filter((e: any) => !v.metrics.episodes.some((p: any) => p.entry === e.entry));
    const replacement = v.metrics.episodes.filter((e: any) => !bm.has(e.entry));
    return { name: v.name, delta: exposureDelta(v.metrics, b.metrics), attribution: componentAttribution(v.metrics, b.metrics),
      extra5bpsDelta: v.accounting.fixedPathExtra5bpsNet - b.accounting.fixedPathExtra5bpsNet,
      versusBlindNetDelta: blind ? v.metrics.totalPnl - blind.metrics.totalPnl : null, matched, removed, replacement };
  });
  json("comparisons.json", comparisons);
  const ranking = spec.policies.slice(1).map((p: ExitPolicy) => {
    const rows = results.filter(r => r.policy.id === p.id && r.sensitivity.id === "primary"), failures: string[] = [];
    for (const r of rows) { const d = comparisons.find(c => c.name === r.name)!.delta;
      if (d.pnlDelta < (r.window === "hl_extended" ? spec.screen.minimumRecentNetDelta : spec.screen.minimumPublishedNetDelta)) failures.push(`${r.model}:net`);
      if (d.ddReductionPp < -spec.screen.maximumDrawdownIncreasePp - 1e-9) failures.push(`${r.model}:drawdown`);
      if (d.worstMonthDelta < spec.screen.minimumMonthlyDelta) failures.push(`${r.model}:monthly`);
      if (r.accounting.firstNonpositive) failures.push(`${r.model}:insolvency`);
    }
    return { policy: p.id, passesEconomicScreen: !failures.length, failures, deployable: false };
  });
  json("ranking.json", ranking);
  core.writeCsv(path.join(out, "overview.csv"), results.map(r => ({ model: r.model, policy: r.policy.id, sensitivity: r.sensitivity.id,
    net: r.metrics.totalPnl, realized: r.metrics.realized, open: r.metrics.openPnl, wins: r.metrics.profitableEpisodes, losses: r.metrics.losingEpisodes,
    winDollars: r.metrics.grossWin, lossDollars: -r.metrics.grossLoss, dd: r.metrics.maxDrawdownPct, minEquity: r.metrics.minEquity,
    tpCycles: r.metrics.tpCycles, forced: r.metrics.forcedCloses, partials: r.metrics.partials, experimentalExits: r.audit.executed, afterJuly15: r.audit.afterJuly15 })));
  core.writeCsv(path.join(out, "monthly.csv"), results.flatMap(r => r.accounting.monthly.map((m: any) => ({ model: r.model, policy: r.policy.id, sensitivity: r.sensitivity.id, ...m }))));
  for (const [f, h] of pins) assert.equal(await fileHash(f), h, `Concurrent mutation ${f}`);
  json("validation.json", { passed: true, cases: results.length, controlsExact: parity.length, independentMinuteMarks: results.reduce((n, r) => n + r.accounting.independentMinutes, 0),
    hashesUnchanged: true, liveChanges: 0, exactLiveParityCertified: false });
  console.log(`[F02 done] ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
