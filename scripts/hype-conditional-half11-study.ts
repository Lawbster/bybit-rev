/** L08: exactly three conditional sizing rules, two archived controls. Local research only. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import type { BotConfig } from "../src/bot/bot-config";
import type { ResearchAddDecision, ResearchInventoryEvent, ResearchSizeDecision } from "./replay-causal-engine";
import { HALF11_VARIANTS, conditionalHalf11, type Half11Variant, type Half11Input } from "./conditional-half11-policy";
import { LadderIndicatorTape } from "./ladder-indicator-policy";
import { exposureMetrics, exposureDelta, qualifyExposure } from "./ladder-exposure-metrics";
import { auditInventory } from "./ladder-sizing-audit";
const hash = (x: string | Buffer) => crypto.createHash("sha256").update(x).digest("hex");
async function fileHash(file: string, bytes?: number) {
  const h = crypto.createHash("sha256");
  for await (const b of fs.createReadStream(file, bytes ? { end: bytes - 1 } : {})) h.update(b);
  return h.digest("hex");
}
type Decision = { decision: Readonly<ResearchSizeDecision>; context: Readonly<ResearchAddDecision>; input: Half11Input;
  result: ReturnType<typeof conditionalHalf11> };

async function main() {
  const root = path.resolve(__dirname, ".."), definition = "research-inputs/sr-pulse-encounters/conditional-half11-2026-09-08.json";
  assert.equal(process.cwd(), root, "Run from repo root; canonical input directory must not change");
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
  const spec = read(definition), baseSpec = read(spec.baseSpec), cfg: BotConfig = read("bot-config.json");
  assert.deepEqual(spec.variants, HALF11_VARIANTS); assert.equal(cfg.symbol, "HYPEUSDT"); assert.equal(cfg.maxPositions, 11);
  assert.equal(cfg.feeRate, .00055); assert.equal(spec.newDefinitions, 3);
  const args = process.argv.slice(2); assert(args.length === 0 || args.length === 2 && args[0] === "--out");
  const out = path.resolve(root, args[1] ?? `backtests/hype/${spec.id}`), relative = path.relative(path.join(root, "backtests"), out);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative) && !fs.existsSync(out), "New output directory inside backtests only");
  const prior = read(`${spec.baselineDir}/manifest.json`), archivedBases = read(`${spec.baselineDir}/baseline.json`);
  const archivedResults = read(`${spec.baselineDir}/results.json`);
  const oldModels = read(`${baseSpec.baselineDir}/summary.json`).sort((a: any, b: any) => Number(!a.id.startsWith("hl_window")) - Number(!b.id.startsWith("hl_window")));
  const prefixEvidence = [], inputs: any[] = [];
  console.log("[preflight] exact old raw prefixes, all original sources, current raw hashes; no sync during this run");
  for (const x of prior.inputs) {
    if (x.file.startsWith("data/")) {
      assert.equal(await fileHash(x.file, x.bytes), x.sha256, `Captured raw prefix changed: ${x.file}`);
      prefixEvidence.push({ ...x, matches: true });
    } else assert.equal(await fileHash(x.file), x.sha256, `Archived evidence changed: ${x.file}`);
    inputs.push({ file: x.file, bytes: fs.statSync(x.file).size, sha256: await fileHash(x.file) });
  }
  for (const x of prior.sources) assert.equal(await fileHash(x.file), x.sha256, `Original source drift: ${x.file}`);
  for (const file of [`${spec.baselineDir}/manifest.json`, `${spec.baselineDir}/baseline.json`, `${spec.baselineDir}/results.json`]) {
    inputs.push({ file, bytes: fs.statSync(file).size, sha256: await fileHash(file) });
  }
  const sources = [...new Set<string>([...prior.sources.map((x: any) => x.file), definition, spec.baseSpec,
    "scripts/hype-conditional-half11-study.ts", "scripts/conditional-half11-policy.ts", "scripts/conditional-half11-tests.ts",
    "scripts/ladder-indicator-policy.ts", "src/research/closed-bars.ts", "src/research/indicator-features.ts"])]
    .map(file => ({ file, sha256: hash(fs.readFileSync(file)) }));
  const protectedFiles = ["bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts"]
    .map(file => ({ file, sha256: hash(fs.readFileSync(file)) }));
  fs.mkdirSync(out, { recursive: true });
  const json = (file: string, data: unknown) => fs.writeFileSync(path.join(out, file), JSON.stringify(data, null, 2) + "\n");
  const jsonl = (file: string, rows: unknown[]) => fs.writeFileSync(path.join(out, file), rows.map(x => JSON.stringify(x)).join("\n") + "\n");
  json("manifest.json", { at: new Date().toISOString(), node: process.version, spec, baseSpec, inputs, prefixEvidence, sources, protectedFiles, liveChanges: 0 });
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = spec.latestEnd; process.env.SIM_EQUITY = String(baseSpec.initialEquity);
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs, ReplayMarketInputs } = await import("./replay-market-inputs");
  const { observationAvailability } = await import("./replay-causality");
  const { rebuildDamagedLatch } = await import("./replay-damaged-latch"), { missingMinutes } = await import("./replay-candle-repair");
  console.log("[series] latest repaired closed-minute prices and causal baseline pulse");
  const s = await core.buildSeries({ candleRepairFile: path.join(root, baseSpec.repairFile) }); assert.equal(missingMinutes(s.candles).length, 0);
  assert.equal(s.candles.at(-1)!.endTs, Date.parse(spec.latestEnd));
  s.marketInputs = await loadReplayMarketInputs(path.join(root, "data"), cfg.symbol, Date.parse(spec.latestEnd));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000
      ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch!, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  const minutes = s.candles.filter(c => c.ts >= Date.parse(spec.indicatorSeed)).map(c => ({ timestamp: c.ts,
    open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover }));
  assert.equal(minutes[0].timestamp, Date.parse(spec.indicatorSeed));
  const tape = new LadderIndicatorTape(minutes);
  const lagTapes = new Map<number, InstanceType<typeof ReplayMarketInputs>>([[15, new ReplayMarketInputs()], [60, new ReplayMarketInputs()]]);
  await core.streamJsonl(path.join(root, "data/HYPEUSDT_taker_hyperliquid.jsonl"), row => {
    const at = observationAvailability(row, "hl_taker");
    for (const [seconds, delayed] of lagTapes) delayed.add("hlTaker", { ...row, receivedAt: at + seconds * 1000 });
  });
  lagTapes.forEach(t => t.seal());
  const results: any[] = [], baselines = new Map<string, any>(), oldPrefixes = new Map<string, any>();
  let parityControls = 0;
  function run(model: any, variant: Half11Variant, lag = 0) {
    const label = `${model.id}--${variant}${lag ? `--lag${lag}s` : ""}`;
    const endIdx = core.lowerBound(s.candles, Date.parse(model.end) + 1, c => c.endTs);
    const inventory: ResearchInventoryEvent[] = [], decisions: Decision[] = [], affected = new Set<number>();
    let context: Readonly<ResearchAddDecision> | null = null;
    const params: import("./hype-freerun-canonical-replay").EngineParams = { id: variant === "baseline" ? model.id : label,
      executionModel: "causal_next_open", tpExecutionModel: model.id.endsWith("resting_touch") ? "resting_touch" : "close_confirmed",
      maxPositions: cfg.maxPositions, hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct,
      cooldownMode: "live4h", pullbackMode: "none" };
    console.log(`[run ${results.length + 1}/34] ${label}`);
    const r = runCausalLongReplay(params, s, {
      startIdx: core.lowerBound(s.candles, Date.parse(model.start), c => c.endTs), endIdx, recordSnapshots: true,
      partialClockModel: "transactional", researchInventoryObserver: e => inventory.push(e),
      researchAddVeto: d => { context = d; return false; },
      researchAddSize: d => {
        assert(context && context.index === d.index && context.nextDepth === d.nextDepth && context.episode === d.episode, "Exact same baseline decision context");
        const delayed = lag ? lagTapes.get(lag)!.latchPulse(d.at) : null;
        const input: Half11Input = { at: d.at, nextDepth: d.nextDepth, requestedNotional: d.requestedNotional,
          // Every requested window has >201 completed4h candles of seed. False is therefore not warmup missingness.
          aboveEma200: context.aboveEma200, ret12h: context.ret12h, hour: d.nextDepth === 11 ? tape.at(d.at) : null,
          taker15m: delayed ? delayed.taker15m : context.taker15m, taker1h: delayed ? delayed.taker1h : context.taker1h,
          samples15m: delayed ? delayed.taker15mSamples : context.samples15m, samples1h: delayed ? delayed.taker1hSamples : context.samples1h,
          takerAgeSec: delayed ? delayed.takerAgeSec : context.takerAgeSec };
        const result = conditionalHalf11(variant, input);
        decisions.push({ decision: d, context, input, result });
        if (result.weak) affected.add(d.episode);
        return result.notional;
      },
    }, cfg, baseSpec.initialEquity);
    const digest = hash(JSON.stringify({ ...r, snapshots: [] }));
    if (!model.id.startsWith("hl_extended") && ["baseline", "last11_50"].includes(variant)) {
      const archive = variant === "baseline" ? archivedBases.find((x: any) => x.model === model.id)
        : archivedResults.find((x: any) => x.model === model.id && x.variant === variant);
      assert(archive); assert.equal(digest, archive.digest, `Exact corrected archive parity: ${label}`); parityControls++;
    }
    const metrics = exposureMetrics(r, baseSpec.initialEquity), audit = auditInventory(inventory, cfg, metrics);
    const permits = new Map(decisions.map(d => [d.decision.index, d]));
    for (const e of inventory.filter(e => e.event.kind === "open")) {
      const d = permits.get(e.event.decisionIndex); assert(d);
      assert.equal(e.event.fillIndex, e.event.decisionIndex + 1);
      assert(Math.abs(e.event.qty * e.event.price! - d.result.notional) < 1e-6, "Actual filled size equals approved size");
      if (d.decision.nextDepth !== 11) assert.equal(d.result.notional, d.decision.requestedNotional);
    }
    const last = r.snapshots.at(-1)!, cut = r.snapshots.find(x => x.ts === Date.parse(baseSpec.historyEnd));
    const oldEndIdx = core.lowerBound(s.candles, Date.parse(baseSpec.historyEnd) + 1, c => c.endTs);
    const prefix = { inventoryHash: hash(JSON.stringify(inventory.filter(e => e.event.fillIndex! < oldEndIdx))),
      equity: cut?.equity ?? null, realized: cut?.realizedPnl ?? null, open: cut?.longOpenPnl ?? null };
    if (model.id.startsWith("hl_window")) oldPrefixes.set(`${model.id}--${variant}`, prefix);
    if (model.id.startsWith("hl_extended") && !lag) {
      assert.deepEqual(prefix, oldPrefixes.get(`${model.id.replace("hl_extended", "hl_window_latest")}--${variant}`), "Appended history preserves original path, inventory and marked equity");
    }
    const turnover = inventory.reduce((v, e) => v + e.event.qty * e.event.price!, 0) + last.longQty * last.price;
    const deep = decisions.filter(d => d.decision.nextDepth === 11), deepFilled = deep.filter(d => inventory.some(e => e.event.kind === "open" && e.event.decisionIndex === d.decision.index));
    const monthly = metrics.monthly.map(m => { const es = metrics.episodes.filter(e => e.close.slice(0, 7) === m.month);
      return { ...m, wins: es.filter(e => e.pnl > 0).length, losses: es.filter(e => e.pnl < 0).length,
        winDollars: es.reduce((v, e) => v + Math.max(0, e.pnl), 0), lossDollars: es.reduce((v, e) => v + Math.min(0, e.pnl), 0) }; });
    const affectedEntries = new Set(audit.episodes.filter(e => affected.has(e.episode)).map(e => e.entry));
    const affectedOutcomes = metrics.episodes.filter(e => affectedEntries.has(e.entry));
    const data: any = { model: model.id, variant, lagSeconds: lag, start: model.start, end: model.end, digest, prefix,
      vetoEpisodes: affected.size, changedDecisions: deep.filter(d => d.result.weak).length,
      affectedFills: deepFilled.filter(d => d.result.weak).length, deepDecisions: deep.length, deepFills: deepFilled.length,
      unknownDecisions: deep.filter(d => d.result.unknown).length,
      changedDropDecisions: deep.filter(d => d.result.weak && d.decision.priceDropOk).length,
      changedTimerDecisions: deep.filter(d => d.result.weak && !d.decision.priceDropOk).length,
      metrics, monthly, audit, endMark: { at: last.ts, price: last.price, qty: last.longQty },
      affectedOutcomes: { closed: affectedOutcomes.length, wins: affectedOutcomes.filter(e => e.pnl > 0).length,
        losses: affectedOutcomes.filter(e => e.pnl < 0).length, winDollars: affectedOutcomes.reduce((v, e) => v + Math.max(0, e.pnl), 0),
        lossDollars: affectedOutcomes.reduce((v, e) => v + Math.min(0, e.pnl), 0) },
      stress: { extraBpsPerSide: 5, turnover, fixedPathNet: metrics.totalPnl - turnover * .0005 },
      extension: model.id.startsWith("hl_extended") ? { since: baseSpec.historyEnd, carryInEquity: cut!.equity,
        carryInOpenPnl: cut!.longOpenPnl, carryInRealized: cut!.realizedPnl,
        mtmPnl: last.equity - cut!.equity, realizedPnl: last.realizedPnl - cut!.realizedPnl, openPnlChange: last.longOpenPnl - cut!.longOpenPnl } : null };
    if (variant === "baseline") baselines.set(model.id, data);
    else {
      const base = baselines.get(model.id); assert(base);
      data.delta = exposureDelta(metrics, base.metrics); data.fixedPathStressDelta = data.stress.fixedPathNet - base.stress.fixedPathNet;
      const half = results.find(x => x.model === model.id && x.variant === "last11_50");
      if (half) data.vsUnconditional = exposureDelta(metrics, half.metrics);
    }
    // Keep event-ledger and decision evidence; no giant minute-snapshot files required.
    jsonl(`${label}-inventory.jsonl`, inventory); jsonl(`${label}-decisions.jsonl`, decisions);
    core.writeCsv(path.join(out, `${label}-closes.csv`), r.closes); core.writeCsv(path.join(out, `${label}-partials.csv`), r.trims);
    json(`${label}-summary.json`, data); results.push(data); json("results.json", results);
    console.log(JSON.stringify({ label, net: metrics.totalPnl, wins: metrics.profitableEpisodes, losses: metrics.losingEpisodes,
      dd: metrics.maxDrawdownPct, affected: affected.size, unknown: data.unknownDecisions, parityControls }));
  }
  for (const m of oldModels) for (const v of ["baseline", "last11_50"] as const) run(m, v);
  assert.equal(parityControls, 8); json("control-parity.json", { exactDigestMatches: 8, rawPrefixes: prefixEvidence.length, passed: true });
  for (const m of oldModels) for (const v of HALF11_VARIANTS.slice(2)) run(m, v);
  const extended = oldModels.filter((m: any) => m.id.startsWith("hl_window")).map((m: any) => ({ ...m, id: m.id.replace("hl_window_latest", "hl_extended"), end: spec.latestEnd }));
  for (const m of extended) for (const v of HALF11_VARIANTS) run(m, v);
  for (const m of extended) for (const lag of [15, 60]) run(m, "hl_two_window_half11", lag);
  const ranking = HALF11_VARIANTS.slice(1).map(variant => ({ variant, ...qualifyExposure(results.filter(r => r.variant === variant && !r.model.startsWith("hl_extended")), baseSpec) }));
  json("ranking.json", ranking);
  core.writeCsv(path.join(out, "monthly.csv"), results.flatMap(r => r.monthly.map((m: any) => ({ model: r.model, variant: r.variant, lagSeconds: r.lagSeconds, ...m }))));
  for (const x of [...sources, ...inputs, ...protectedFiles]) assert.equal(await fileHash(x.file), x.sha256, `Concurrent mutation: ${x.file}`);
  assert.equal(results.length, spec.expectedCases);
  json("validation.json", { passed: true, cases: results.length, newDefinitions: 3, controlsExact: 8, extendedPrefixesExact: 10,
    allocationAndClockAudits: true, unchangedInputAndSourceHashes: true, liveChanges: 0, exactLiveParityCertified: false });
  console.log(`[done] ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
