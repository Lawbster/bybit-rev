/** Local-only full-path exposure experiment. Never loads credentials or writes live files. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import type { BotConfig } from "../src/bot/bot-config";
import type { PersistentSpec, PersistentVariant } from "./ladder-persistent-pulse-policy";
import type { ResearchAddDecision } from "./replay-causal-engine";
const hash = (b: string | Buffer) => crypto.createHash("sha256").update(b).digest("hex");
async function fileHash(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
async function main() {
  const root = path.resolve(__dirname, ".."), definition = "research-inputs/sr-pulse-encounters/ladder-persistent-pulse-2026-09-05.json";
  const read = (file: string) => JSON.parse(fs.readFileSync(path.resolve(root, file), "utf8"));
  const spec: PersistentSpec = read(definition), cfg: BotConfig = read("bot-config.json");
  assert.equal(cfg.symbol, "HYPEUSDT"); assert.equal(process.argv.length, 2);
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = spec.historyEnd; process.env.SIM_EQUITY = String(spec.initialEquity);
  const archived = read(`${spec.baselineDir}/manifest.json`), expected = read(`${spec.baselineDir}/summary.json`);
  const priorInputs = read(spec.inputManifest); assert.equal(expected.length, 4);
  const engineFile = "scripts/replay-causal-engine.ts";
  for (const source of archived.sources) {
    if (source.file === engineFile) assert.equal(source.sha256, spec.originalEngineSha256, "Only the documented additive engine hook may differ");
    else assert.equal(await fileHash(path.join(root, source.file)), source.sha256, `Changed baseline source: ${source.file}`);
  }
  const previousStudy = read(`${spec.priorDropDir}/manifest.json`);
  for (const source of previousStudy.sources)
    assert.equal(await fileHash(path.join(root, source.file)), source.sha256, `Changed prior-study source: ${source.file}`);
  console.log("[manifest] prior drop-study engine/sources unchanged; hash preserved inputs, controls and frozen persistent rules");
  const inputs: any[] = [];
  for (const input of priorInputs.inputs) {
    const digest = await fileHash(path.join(root, input.file)); assert.equal(digest, input.sha256, `Changed input: ${input.file}`);
    inputs.push({ file: input.file, bytes: fs.statSync(path.join(root, input.file)).size, sha256: digest });
  }
  const controls: any[] = read(`${spec.priorDropDir}/results.json`);
  assert.equal(controls.length, 48);
  for (const name of ["manifest.json", "results.json", "baseline.json", "validation.json"]) {
    const file = `${spec.priorDropDir}/${name}`;
    inputs.push({ file, bytes: fs.statSync(path.join(root, file)).size, sha256: await fileHash(path.join(root, file)) });
  }
  const sourceFiles = [...new Set<string>([...previousStudy.sources.map((s: any) => s.file), definition, "scripts/hype-ladder-persistent-pulse-study.ts",
    "scripts/ladder-persistent-pulse-policy.ts", "scripts/ladder-exposure-metrics.ts", "scripts/ladder-persistent-pulse-tests.ts", "package-lock.json", "tsconfig.json"])];
  const sources = sourceFiles.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) }));
  const out = path.resolve(root, process.env.PERSISTENT_PULSE_OUT ?? `backtests/hype/${spec.id}`), rel = path.relative(path.join(root, "backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Use a NEW output directory inside backtests/");
  fs.mkdirSync(out, { recursive: true });
  const json = (name: string, value: unknown) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + "\n");
  const jsonl = (name: string, value: unknown[]) => fs.writeFileSync(path.join(out, name), value.map(x => JSON.stringify(x)).join("\n") + "\n");
  json("manifest.json", { at: new Date().toISOString(), node: process.version, spec, inputs, sources,
    baselineSummarySha256: hash(fs.readFileSync(path.join(root, spec.baselineDir, "summary.json"))), originalEngineSha256: spec.originalEngineSha256,
    engineChange: "NONE this pass: prior exposure engine and optional veto seam pinned unchanged",
    previousStudyManifestSha256: hash(fs.readFileSync(path.join(root, spec.priorDropDir, "manifest.json"))),
    caveats: ["Previously mined development data", "No exact live/maker/funding/rounding model", "Missing inputs cannot arm; an armed hold does not release on missing pulse", "Four overlapping baseline cases, not independent samples", "No live modifications"] });
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { persistentVariants, createPersistentGate } = await import("./ladder-persistent-pulse-policy");
  const { exposureMetrics, exposureDelta, qualifyExposure } = await import("./ladder-exposure-metrics");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  const variants = persistentVariants(spec); assert.equal(variants.length, spec.variantCount);
  const s = await core.buildSeries({ candleRepairFile: path.join(root, spec.repairFile) }); assert.equal(missingMinutes(s.candles).length, 0);
  s.marketInputs = await loadReplayMarketInputs(path.join(root, "data"), "HYPEUSDT", Date.parse(spec.historyEnd));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000 ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch!, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  const results: any[] = [], baselines: any[] = [], flatRows: any[] = [], monthRows: any[] = [];
  // Primary HL results first; every frozen rule still runs in every archived case.
  for (const prior of [...expected].sort((a: any, b: any) => Number(!a.id.startsWith("hl_window")) - Number(!b.id.startsWith("hl_window")))) {
    const opts = { startIdx: core.lowerBound(s.candles, Date.parse(prior.start), c => c.endTs), endIdx: core.lowerBound(s.candles, Date.parse(prior.end) + 1, c => c.endTs), recordSnapshots: true };
    const params: import("./hype-freerun-canonical-replay").EngineParams = { id: prior.id, executionModel: "causal_next_open",
      tpExecutionModel: prior.id.endsWith("resting_touch") ? "resting_touch" : "close_confirmed", maxPositions: cfg.maxPositions,
      hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const run = (variant: PersistentVariant | null) => {
      const label = `${prior.id}--${variant?.id ?? "baseline"}`, traces: any[] = [], observed = new Set<string>(), episodes = new Set<number>();
      let opportunities = 0, vetoMinutes = 0, unknown = 0, maxKnownAt = 0, timerOpportunities = 0;
      const unknownReasons: Record<string, number> = {}, transitions: Record<string, number> = {}, prevented: Record<string, number> = {};
      const gate = variant ? createPersistentGate(variant, spec) : null, decisions: any[] = [];
      const permits = new Map<number, { decision: Readonly<ResearchAddDecision>; reason: string }>();
      const r = runCausalLongReplay({ ...params, id: variant ? label : prior.id }, s, { ...opts, researchAddVeto: d => {
        // Baseline explicitly traverses the same inert hook used by the experiment.
        if (!variant) return false;
        if (d.nextDepth >= variant.depth) { if (d.priceDropOk) opportunities++; else timerOpportunities++; }
        const answer = gate!.evaluate(d);
        decisions.push({ decision: d, answer });
        transitions[answer.event] = (transitions[answer.event] ?? 0) + 1;
        if (answer.reset) transitions.resets = (transitions.resets ?? 0) + 1;
        if (answer.preventedRelease) prevented[answer.preventedRelease] = (prevented[answer.preventedRelease] ?? 0) + 1;
        if (answer.event === "armed") assert(d.priceDropOk && d.nextDepth >= variant.depth, "Arming must be a genuine deep drop");
        if (answer.unknown) { unknown++; unknownReasons[answer.reason] = (unknownReasons[answer.reason] ?? 0) + 1; }
        if (!answer.veto) permits.set(d.index, { decision: d, reason: answer.reason });
        if (d.resistanceKnownAt !== null) { assert(d.resistanceKnownAt <= d.at, "future resistance"); maxKnownAt = Math.max(maxKnownAt, d.resistanceKnownAt); }
        if (answer.veto) {
          assert(d.nextDepth >= variant.depth, "Deep-slot scope violated");
          vetoMinutes++; episodes.add(d.episode);
          const key = `${d.episode}:${d.nextDepth}`;
          if (!observed.has(key)) { observed.add(key); traces.push({ ...d, reason: answer.reason }); }
        }
        return answer.veto;
      } }, cfg, spec.initialEquity);
      const digest = hash(JSON.stringify({ ...r, snapshots: [] }));
      if (!variant) assert.equal(digest, prior.digest, `BASELINE DIVERGENCE ${prior.id}`);
      for (const e of r.executionAudit!.events) assert(e.fillAt !== null && e.fillAt >= e.decisionAt && e.fillIndex! > e.decisionIndex, "noncausal execution");
      const metrics = exposureMetrics(r, spec.initialEquity);
      core.writeCsv(path.join(out, `${label}-closes.csv`), r.closes); core.writeCsv(path.join(out, `${label}-partials.csv`), r.trims);
      jsonl(`${label}-executions.jsonl`, r.executionAudit!.events); jsonl(`${label}-first-vetoes.jsonl`, traces);
      jsonl(`${label}-gate-decisions.jsonl`, decisions);
      // Outcome-only: first execution after each deduplicated veto, not inputs to the policy.
      const releases = traces.map(t => {
        const next = r.executionAudit!.events.find(e => e.fillIndex! > t.index);
        const permit = next?.kind === "open" ? permits.get(next.decisionIndex) : undefined;
        const same = permit !== undefined && permit.decision.episode === t.episode && permit.decision.nextDepth === t.nextDepth;
        return { veto: t, outcome: !next ? "no_execution_by_end" : same ? "add_filled" : "inventory_changed_first",
          release: same ? permit : null, nextExecution: next ?? null,
          waitMinutes: same ? (next!.fillAt! - t.at) / 60000 : null };
      });
      jsonl(`${label}-first-veto-releases.jsonl`, releases);
      const releaseCounts: Record<string, number> = {};
      for (const x of releases) {
        const key = x.outcome === "add_filled" ? x.release!.reason : x.outcome;
        releaseCounts[key] = (releaseCounts[key] ?? 0) + 1;
      }
      const data = { model: prior.id, variant: variant?.id ?? "baseline", family: variant?.family ?? "baseline", depth: variant?.depth ?? null,
        digest, opportunities, timerOpportunities, vetoMinutes, vetoEpisodes: episodes.size, unknown, unknownReasons, releaseCounts, transitions, prevented, lastObservedHold: gate?.state() ?? null, maxKnownAt, metrics };
      json(`${label}-summary.json`, data);
      return data;
    };
    console.log(`[baseline] ${prior.id}: reproduce archived digest`);
    const base = run(null); baselines.push(base); json("baseline.json", baselines);
    for (const [n, variant] of variants.entries()) {
      console.log(`[variant ${n + 1}/${variants.length}] ${prior.id} ${variant.id}`);
      const result = run(variant), delta = exposureDelta(result.metrics, base.metrics);
      const control = controls.find(x => x.model === prior.id && x.variant === variant.controlId); assert(control, "Missing exact stateless control");
      const versusNonpersistent = exposureDelta(result.metrics, control.metrics);
      results.push({ ...result, delta, controlId: variant.controlId, versusNonpersistent });
      const { episodes, monthly, ...metrics } = result.metrics;
      const { monthly: deltaMonths, ...changes } = delta;
      flatRows.push({ model: prior.id, variant: variant.id, ...metrics, ...changes, pairedPnlDelta: versusNonpersistent.pnlDelta, pairedDdReductionPp: versusNonpersistent.ddReductionPp, vetoMinutes: result.vetoMinutes, vetoEpisodes: result.vetoEpisodes, unknown: result.unknown });
      monthRows.push(...deltaMonths.map(m => ({ model: prior.id, variant: variant.id, ...m, pairedMtmDelta: versusNonpersistent.monthly.find(x => x.month === m.month)!.mtmDelta })));
      core.writeCsv(path.join(out, "summary.csv"), flatRows); core.writeCsv(path.join(out, "monthly.csv"), monthRows);
      json("results.json", results);
      console.log(JSON.stringify({ model: prior.id, variant: variant.id, pnlDelta: delta.pnlDelta, ddReductionPp: delta.ddReductionPp,
        grossLossReductionPct: delta.grossLossReductionPct, worstMonthDelta: delta.worstMonthDelta, vetoEpisodes: result.vetoEpisodes, pairedPnlDelta: versusNonpersistent.pnlDelta }));
    }
  }
  assert.equal(results.length, 4 * spec.variantCount);
  const ranking = variants.map(v => ({ ...v, ...qualifyExposure(results.filter(r => r.variant === v.id), { ...spec, families: [] }) }))
    .sort((a, b) => b.minimumHlDdReductionPp - a.minimumHlDdReductionPp || b.minimumHlPnlDelta - a.minimumHlPnlDelta);
  json("ranking.json", ranking); core.writeCsv(path.join(out, "ranking.csv"), ranking);
  for (const source of sources) assert.equal(await fileHash(path.join(root, source.file)), source.sha256, `Source mutated: ${source.file}`);
  for (const input of inputs) assert.equal(await fileHash(path.join(root, input.file)), input.sha256, `Input mutated: ${input.file}`);
  json("validation.json", { allFourBaselineDigestsMatched: true, causalFillsAndKnownResistance: true, genuineDropArmingOnly: true, fullGateDecisionJournal: true, pairedControlsHashed: true, sourceAndInputHashesUnchanged: true,
    monthlyMtmAndRealizedReconciled: true, variants: variants.length, variantCases: results.length, shortsTested: 0, liveChanges: 0,
    profitUpgrades: ranking.filter(r => r.profitUpgrade).map(r => r.id), defensiveTradeoffs: ranking.filter(r => r.defensiveTradeoff).map(r => r.id), exactLiveParityCertified: false });
  console.log(`[done] ${out}`); console.log(JSON.stringify(ranking));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
