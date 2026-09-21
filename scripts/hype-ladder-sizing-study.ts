/** Local-only sizing experiment, preceded by partial inventory/clock parity audit. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import type { BotConfig } from "../src/bot/bot-config";
import type { ResearchInventoryEvent, ResearchSizeDecision } from "./replay-causal-engine";
import type { SizingVariant } from "./ladder-sizing-policy";
const hash = (b: string | Buffer) => crypto.createHash("sha256").update(b).digest("hex");
async function fileHash(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
async function main() {
  const root = path.resolve(__dirname, ".."), definition = "research-inputs/sr-pulse-encounters/ladder-sizing-2026-09-05.json";
  const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(root, f), "utf8"));
  const spec = read(definition), baseSpec = read(spec.baseSpec), cfg: BotConfig = read("bot-config.json");
  assert.equal(process.argv.length, 2); assert.equal(cfg.symbol, "HYPEUSDT");
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = baseSpec.historyEnd; process.env.SIM_EQUITY = String(baseSpec.initialEquity);
  const previous = read(`${spec.priorStudyDir}/manifest.json`), expected = read(`${baseSpec.baselineDir}/summary.json`);
  const evidence = read(spec.engineEvidence); assert.equal(hash(evidence.source), spec.preSizingEngineSha256);
  const changed = ["scripts/replay-causal-engine.ts", "scripts/replay-current-stack-tests.ts"];
  for (const s of previous.sources) if (!changed.includes(s.file)) assert.equal(await fileHash(s.file), s.sha256, `Unrelated source changed: ${s.file}`);
  assert.equal(previous.sources.find((s: any) => s.file === evidence.file).sha256, spec.preSizingEngineSha256);
  const inputs: any[] = [];
  console.log("[hash] pinned raw inputs and archived baselines; no sync during research");
  for (const input of read(baseSpec.inputManifest).inputs) {
    const sha256 = await fileHash(input.file); assert.equal(sha256, input.sha256, `Input changed: ${input.file}`);
    inputs.push({ file: input.file, bytes: fs.statSync(input.file).size, sha256 });
  }
  for (const file of [spec.engineEvidence, `${baseSpec.baselineDir}/summary.json`, `${spec.priorStudyDir}/manifest.json`,
    `${spec.priorExposureDir}/results.json`, `${spec.priorExposureDir}/baseline.json`]) inputs.push({ file, sha256: await fileHash(file) });
  const sourceFiles = [...new Set<string>([...previous.sources.map((x: any) => x.file), definition, spec.baseSpec,
    "scripts/hype-ladder-sizing-study.ts", "scripts/ladder-sizing-policy.ts", "scripts/ladder-sizing-audit.ts",
    "scripts/ladder-sizing-tests.ts", "src/bot/index.ts", "src/bot/state.ts", "src/bot/partial-close-transaction.ts",
    "src/bot/partial-close-coordinator.ts", "scripts/replay-current-stack-tests.ts", "scripts/ladder-sizing-results-check.ts"])];
  const sources = sourceFiles.map(file => ({ file, sha256: hash(fs.readFileSync(file)) }));
  const out = path.resolve(root, process.env.SIZING_OUT ?? `backtests/hype/${spec.id}`), rel = path.relative(path.join(root, "backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Use a NEW output directory inside backtests");
  fs.mkdirSync(out, { recursive: true });
  const json = (f: string, x: unknown) => fs.writeFileSync(path.join(out, f), JSON.stringify(x, null, 2) + "\n");
  const jsonl = (f: string, x: unknown[]) => fs.writeFileSync(path.join(out, f), x.map(v => JSON.stringify(v)).join("\n") + "\n");
  json("manifest.json", { at: new Date().toISOString(), node: process.version, spec, baseSpec, inputs, sources,
    engineChange: "Optional size reduction and immutable inventory observer; default partial clock repaired to transactional preserve. Explicit legacy_reanchor reproduces old archives.",
    previousEngineSha256: spec.preSizingEngineSha256, productionChanges: 0 });
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { sizedAdd, freshLadderCost } = await import("./ladder-sizing-policy"), { auditInventory } = await import("./ladder-sizing-audit");
  const { exposureMetrics, exposureDelta, qualifyExposure } = await import("./ladder-exposure-metrics");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  const s = await core.buildSeries({ candleRepairFile: path.join(root, baseSpec.repairFile) }); assert.equal(missingMinutes(s.candles).length, 0);
  s.marketInputs = await loadReplayMarketInputs(path.join(root, "data"), "HYPEUSDT", Date.parse(baseSpec.historyEnd));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000 ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch!, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  const variants: SizingVariant[] = spec.variants; assert.equal(variants.length, spec.variantCount);
  const models: any[] = [...expected].sort((a: any, b: any) => Number(!a.id.startsWith("hl_window")) - Number(!b.id.startsWith("hl_window")));
  const corrected: any[] = [], legacy: any[] = [], results: any[] = [], flat: any[] = [], months: any[] = [];
  function run(prior: any, variant: SizingVariant | null, old = false) {
    const label = `${prior.id}--${old ? "legacy-baseline" : variant?.id ?? "baseline"}`;
    const inventory: ResearchInventoryEvent[] = [], decisions: { decision: ResearchSizeDecision; notional: number }[] = [];
    const affected = new Set<number>();
    const params: import("./hype-freerun-canonical-replay").EngineParams = { id: variant ? label : prior.id, executionModel: "causal_next_open",
      tpExecutionModel: prior.id.endsWith("resting_touch") ? "resting_touch" : "close_confirmed", maxPositions: cfg.maxPositions,
      hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const r = runCausalLongReplay(params, s, {
      startIdx: core.lowerBound(s.candles, Date.parse(prior.start), c => c.endTs),
      endIdx: core.lowerBound(s.candles, Date.parse(prior.end) + 1, c => c.endTs), recordSnapshots: true,
      partialClockModel: old ? "legacy_reanchor" : "transactional",
      researchInventoryObserver: x => inventory.push(x),
      researchAddSize: d => {
        const notional = sizedAdd(variant, d, cfg.basePositionUsdt, cfg.addScaleFactor, spec.minimumClippedAddBaseFraction);
        decisions.push({ decision: d, notional });
        if (notional < d.requestedNotional - 1e-8) affected.add(d.episode);
        return notional;
      },
    }, cfg, baseSpec.initialEquity);
    const digest = hash(JSON.stringify({ ...r, snapshots: [] }));
    if (old) assert.equal(digest, prior.digest, `Archived baseline mismatch: ${prior.id}`);
    const metrics = exposureMetrics(r, baseSpec.initialEquity), audit = auditInventory(inventory, cfg, metrics, old);
    const permissions = new Map(decisions.map(x => [x.decision.index, x]));
    for (const x of inventory) {
      if (x.event.kind !== "open") continue;
      const permit = permissions.get(x.event.decisionIndex); assert(permit && permit.notional > 0);
      assert.equal(x.event.fillIndex, x.event.decisionIndex + 1);
      assert(Math.abs(x.event.qty * x.event.price! - permit.notional) < 1e-6);
    }
    if (variant?.family === "cost_cap") assert(metrics.maxNotional <= freshLadderCost(10, cfg.basePositionUsdt, cfg.addScaleFactor) + cfg.basePositionUsdt * cfg.addScaleFactor ** 10 * variant.capLastFraction! + 1e-6);
    const last = r.snapshots.at(-1)!;
    const turnover = inventory.reduce((v, x) => v + x.event.qty * x.event.price!, 0) + last.longQty * last.price;
    let high = baseSpec.initialEquity, underwaterAt: number | null = null, maxUnderwaterHours = 0;
    for (const row of r.snapshots) {
      if (row.equity >= high) { high = row.equity; underwaterAt = null; }
      else { underwaterAt ??= row.ts; maxUnderwaterHours = Math.max(maxUnderwaterHours, (row.ts - underwaterAt) / 3600000); }
    }
    const data = { model: prior.id, variant: variant?.id ?? "baseline", clock: old ? "legacy_reanchor" : "transactional", digest,
      vetoEpisodes: affected.size, changedDecisions: decisions.filter(x => x.notional < x.decision.requestedNotional - 1e-8).length,
      skippedDecisions: decisions.filter(x => x.notional === 0).length, metrics, audit,
      endMark: { at: last.ts, price: last.price, qty: last.longQty },
      stress: { executedPlusMarkedExitTurnover: turnover, extraCostBpsPerSide: 5, fixedPathNet: metrics.totalPnl - turnover * .0005 },
      maxCloseMarkedUnderwaterHours: maxUnderwaterHours };
    jsonl(`${label}-inventory.jsonl`, inventory); jsonl(`${label}-decisions.jsonl`, decisions);
    core.writeCsv(path.join(out, `${label}-closes.csv`), r.closes); core.writeCsv(path.join(out, `${label}-partials.csv`), r.trims);
    core.writeCsv(path.join(out, `${label}-partial-audit.csv`), audit.partialRows);
    json(`${label}-summary.json`, data);
    console.log(JSON.stringify({ label, total: metrics.totalPnl, dd: metrics.maxDrawdownPct, partials: audit.partials,
      affectedClocks: audit.affectedClocks, inflated: audit.inflated.episodes, maxCost: audit.all.maxCost }));
    return data;
  }
  // All audit/control gates precede the first strategy variant.
  for (const model of models) {
    console.log(`[audit] ${model.id}: exact old digest then corrected transactional baseline`);
    const old = run(model, null, true), current = run(model, null);
    legacy.push(old); corrected.push(current);
    json("legacy-baseline.json", legacy); json("baseline.json", corrected);
    json("clock-repair-deltas.json", corrected.map((x, i) => ({ model: x.model, delta: exposureDelta(x.metrics, legacy[i].metrics) })));
  }
  assert.equal(corrected.length, 4);
  for (const model of models) {
    const base = corrected.find(x => x.model === model.id)!;
    for (const [i, v] of variants.entries()) {
      console.log(`[variant ${i + 1}/${variants.length}] ${model.id}: ${v.id}`);
      const r = run(model, v), delta = exposureDelta(r.metrics, base.metrics);
      results.push({ ...r, delta, fixedPathStressDelta: r.stress.fixedPathNet - base.stress.fixedPathNet });
      const { episodes, monthly, ...m } = r.metrics, { monthly: dm, ...changes } = delta;
      flat.push({ model: r.model, variant: r.variant, ...m, ...changes, affectedEpisodes: r.vetoEpisodes,
        fixedPathStressDelta: r.stress.fixedPathNet - base.stress.fixedPathNet, maxCloseMarkedUnderwaterHours: r.maxCloseMarkedUnderwaterHours });
      months.push(...dm.map(x => ({ model: r.model, variant: r.variant, ...x })));
      json("results.json", results); core.writeCsv(path.join(out, "summary.csv"), flat); core.writeCsv(path.join(out, "monthly.csv"), months);
      console.log(JSON.stringify({ model: r.model, variant: r.variant, ...changes }));
    }
  }
  const ranking = variants.map(v => ({ ...v, ...qualifyExposure(results.filter(r => r.variant === v.id), baseSpec) }));
  json("ranking.json", ranking);
  for (const x of sources) assert.equal(await fileHash(x.file), x.sha256, `Source mutated: ${x.file}`);
  for (const x of inputs) assert.equal(await fileHash(x.file), x.sha256, `Input mutated: ${x.file}`);
  json("validation.json", { oldBaselineDigestsMatched: 4, correctedBaselines: 4, variantCases: results.length,
    inventoryAllocationParity: true, transactionalClockParity: true, inputsAndSourcesUnchanged: true, causalSizeAndFills: true,
    profitUpgrades: ranking.filter(r => r.profitUpgrade).map(r => r.id), defensiveTradeoffs: ranking.filter(r => r.defensiveTradeoff).map(r => r.id),
    liveChanges: 0, exactLiveParityCertified: false });
  console.log(`[done] ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
