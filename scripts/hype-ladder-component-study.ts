/** L09: fixed build-up and leave-one-out audit. Local research only. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import type { BotConfig } from "../src/bot/bot-config";
import type { EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
import { COMPONENTS, componentConfig, componentPolicies, componentSeries, type ComponentPolicy } from "./ladder-component-policy";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import { auditInventory } from "./ladder-sizing-audit";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
const hash = (x: string | Buffer) => crypto.createHash("sha256").update(x).digest("hex");
async function fileHash(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
async function main() {
  const root = path.resolve(__dirname, ".."), card = "research-inputs/ladder-components-2026-09-08.json";
  assert.equal(process.cwd(), root); const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
  const spec = read(card), cfg: BotConfig = read("bot-config.json"), prior = read(`${spec.archiveDir}/manifest.json`), old = read(`${spec.archiveDir}/results.json`);
  assert.deepEqual(spec.orderedComponents, COMPONENTS.map(c => c[0]));
  const args = process.argv.slice(2); assert(!args.length || args.length === 2 && args[0] === "--out");
  const out = path.resolve(args[1] ?? `backtests/hype/${spec.id}`), rel = path.relative(path.join(root, "backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Fresh directory under backtests required");
  console.log("[preflight] L08 input/source hashes; only admitted source change is a0h cooldown TYPE alternative");
  const inputs: any[] = [], sourceExceptions: any[] = [];
  for (const x of prior.inputs) { assert.equal(await fileHash(x.file), x.sha256, x.file); inputs.push(x); }
  for (const x of prior.sources) {
    const bytes = fs.readFileSync(x.file), actual = hash(bytes);
    if (x.file === "scripts/hype-freerun-canonical-replay.ts") {
      assert.equal(hash(bytes.toString().replace('"live4h" | "0h" | "8h" | "12h" | "16h"', '"live4h" | "8h" | "12h" | "16h"')), x.sha256, "Type-only difference must reproduce original source bytes");
      sourceExceptions.push({ file: x.file, old: x.sha256, current: actual, reason: "type-only0h alternative; runtime already supports it" });
    } else assert.equal(actual, x.sha256, x.file);
  }
  const sources = [...new Set<string>([...prior.sources.map((x: any) => x.file), card, "scripts/hype-ladder-component-study.ts",
    "scripts/ladder-component-policy.ts", "scripts/ladder-component-tests.ts", "scripts/ladder-component-accounting.ts"])].map(file => ({ file, sha256: hash(fs.readFileSync(file)) }));
  const protectedFiles = ["bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts"].map(file => ({ file, sha256: hash(fs.readFileSync(file)) }));
  inputs.push({ file: `${spec.archiveDir}/results.json`, sha256: await fileHash(`${spec.archiveDir}/results.json`) });
  inputs.push({ file: `${spec.archiveDir}/manifest.json`, sha256: await fileHash(`${spec.archiveDir}/manifest.json`) });
  fs.mkdirSync(out, { recursive: true });
  const json = (f: string, x: unknown) => fs.writeFileSync(path.join(out, f), JSON.stringify(x, null, 2) + "\n");
  const jsonl = (f: string, xs: unknown[]) => fs.writeFileSync(path.join(out, f), xs.map(x => JSON.stringify(x)).join("\n") + "\n");
  const policies = componentPolicies(), full = policies.cumulative.at(-1)!;
  json("manifest.json", { at: new Date().toISOString(), node: process.version, spec, policies, inputs, sources, sourceExceptions, protectedFiles, liveChanges: 0 });
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = spec.latestEnd; process.env.SIM_EQUITY = String(spec.initialEquity);
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  console.log("[build] repaired prices,full-context indicators,causal pulse,daily and latch separately");
  const s = await core.buildSeries({ candleRepairFile: spec.repairFile }); assert.equal(missingMinutes(s.candles).length, 0);
  assert.equal(s.candles.at(-1)!.endTs, Date.parse(spec.latestEnd));
  s.marketInputs = await loadReplayMarketInputs(path.join(root, "data"), cfg.symbol, Date.parse(spec.latestEnd));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000
      ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const daily = s.regimeFlat, latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch!, new Map(), now => s.marketInputs!.latchPulse(now));
  json("latch-transitions.json", latch.transitions);
  const results: any[] = [], parity: any[] = [];
  function run(model: any, policy: ComponentPolicy, controlId?: string) {
    const name = `${model.id}--${policy.id}`, start = Date.now(), { cfg: c, cooldownMode } = componentConfig(cfg, policy);
    const params: EngineParams = { id: controlId ?? name, executionModel: "causal_next_open", tpExecutionModel: model.tp,
      maxPositions: c.maxPositions, hardFlattenHours: c.exits.hardFlattenHours, hardFlattenPct: c.exits.hardFlattenPct, cooldownMode, pullbackMode: "none" };
    const series = componentSeries(s, daily, latch.blocked, policy);
    const startIdx = core.lowerBound(s.candles, Date.parse(model.start), x => x.endTs), endIdx = core.lowerBound(s.candles, Date.parse(model.end) + 1, x => x.endTs);
    const events: ResearchInventoryEvent[] = [];
    console.log(`[run] ${name}`);
    const r = runCausalLongReplay(params, series, { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional", researchInventoryObserver: e => events.push(e) }, c, spec.initialEquity);
    const digest = hash(JSON.stringify({ ...r, snapshots: [] }));
    if (controlId) { const expected = old.find((x: any) => x.model === controlId && x.variant === "baseline"); assert(expected); assert.equal(digest, expected.digest, `Exact control ${controlId}`); parity.push({ id: controlId, digest, passed: true }); }
    const metrics = exposureMetrics(r, spec.initialEquity), allocation = auditInventory(events, c, metrics);
    const accounting = auditComponentAccounting(s.candles, events, metrics, startIdx, endIdx, spec.initialEquity, c.feeRate);
    const data = { model: model.id, window: model.window, tp: model.tp, start: model.start, end: model.end, policy: policy.id,
      enabled: policy.enabled, config: c, configHash: hash(JSON.stringify(c)), cooldownMode, digest,
      metrics, accounting, blocked: r.blocked, pendingAtEnd: r.executionAudit!.pendingAtEnd,
      allocation: { partials: allocation.partials, clockParity: allocation.clockParity, allocationParity: allocation.allocationParity,
        postPartialAdds: allocation.postPartialAdds, inflated: allocation.inflated, exceedsFresh11: allocation.exceedsFresh11 },
      elapsedMs: Date.now() - start };
    jsonl(`${name}-inventory.jsonl`, events); core.writeCsv(path.join(out, `${name}-closes.csv`), r.closes); core.writeCsv(path.join(out, `${name}-partials.csv`), r.trims);
    json(`${name}-summary.json`, data); results.push(data); json("results.json", results);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, wins: metrics.profitableEpisodes, losses: metrics.losingEpisodes,
      dd: metrics.maxDrawdownPct, minEquity: metrics.minEquity, survival: accounting.survival, seconds: data.elapsedMs / 1000 }));
  }
  const models = spec.windows.flatMap((w: any) => spec.tpModels.map((tp: any) => ({ ...w, id: `${w.id}-${tp}`, window: w.id, tp })));
  // All six current controls precede all new policy outcomes.
  for (const x of old.filter((x: any) => x.variant === "baseline")) run({ id: x.model, window: x.model.split("-")[0], tp: x.model.endsWith("resting_touch") ? "resting_touch" : "close_confirmed", start: x.start, end: x.end }, full, x.model);
  assert.equal(parity.length, 6); json("control-parity.json", { passed: true, exactDigests: parity });
  for (const model of models) for (const policy of policies.unique) if (policy.id !== "B17") run(model, policy);
  const coreResults = results.filter(r => r.window !== "hl_window_latest"); assert.equal(coreResults.length, 136);
  const comparisons: any[] = [];
  for (const model of models) {
    const find = (id: string) => coreResults.find(r => r.model === model.id && r.policy === id)!;
    for (const policy of policies.unique) {
      const v = find(policy.id); assert(v);
      for (const parent of new Set(["B00", "B17", ...(policy.id.startsWith("B") && policy.id !== "B00" ? [`B${String(Number(policy.id.slice(1)) - 1).padStart(2, "0")}`] : [])])) {
        if (parent === policy.id) continue; const base = find(parent); assert(base);
        comparisons.push({ model: model.id, policy: policy.id, parent, delta: exposureDelta(v.metrics, base.metrics), attribution: componentAttribution(v.metrics, base.metrics) });
      }
    }
  }
  json("comparisons.json", comparisons);
  const ranking = policies.removals.map(removal => {
    const rows = coreResults.filter(r => r.policy === removal.policy), failures: string[] = [];
    for (const r of rows) {
      const d = comparisons.find(c => c.model === r.model && c.policy === r.policy && c.parent === "B17").delta;
      if (r.accounting.firstNonpositive) failures.push(`${r.model}:insolvent`);
      if (d.pnlDelta < (r.window === "hl_extended" ? 1000 : 0)) failures.push(`${r.model}:net`);
      if (d.ddReductionPp < -1e-9) failures.push(`${r.model}:drawdown`);
      if (d.worstMonthDelta < -250) failures.push(`${r.model}:monthly`);
    }
    assert.equal(rows.length, 4); return { ...removal, passesResearchScreen: !failures.length, failures, deployable: false };
  });
  json("ranking.json", ranking);
  core.writeCsv(path.join(out, "overview.csv"), coreResults.map(r => ({ model: r.model, policy: r.policy, label: policies.unique.find(p => p.id === r.policy)!.label,
    net: r.metrics.totalPnl, realized: r.metrics.realized, open: r.metrics.openPnl, wins: r.metrics.profitableEpisodes, losses: r.metrics.losingEpisodes,
    winDollars: r.metrics.grossWin, lossDollars: -r.metrics.grossLoss, dd: r.metrics.maxDrawdownPct, minEquity: r.metrics.minEquity,
    maxHoldHours: r.accounting.maxHeldHours, firstNonpositive: r.accounting.firstNonpositive?.iso ?? "", tpCycles: r.metrics.tpCycles, forced: r.metrics.forcedCloses, partials: r.metrics.partials })));
  core.writeCsv(path.join(out, "monthly.csv"), coreResults.flatMap(r => r.accounting.monthly.map((m: any) => ({ model: r.model, policy: r.policy, ...m }))));
  for (const x of [...inputs, ...sources, ...protectedFiles]) assert.equal(await fileHash(x.file), x.sha256, `Concurrent mutation: ${x.file}`);
  json("validation.json", { passed: true, at: new Date().toISOString(), cases: results.length, coreCases: coreResults.length, uniquePolicies: 34,
    controlsExact: 6, independentMinuteEquityChecks: results.reduce((n, r) => n + r.accounting.independentMinutes, 0), hashesUnchanged: true, liveChanges: 0, exactLiveParityCertified: false });
  console.log(`[done] ${out}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
