/** F06 refresh: exactly three existing policies, two execution models. No search. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { fileHash, sha, atomicJson, inside, type Plan } from "./research-workflow";
import { SoftStaleController } from "./conditional-soft-stale-policy";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import { auditComponentAccounting } from "./ladder-component-accounting";
import type { EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
type R = Record<string, any>;
export function validateScorecard(d: R): void {
  assert.equal(d.archive, "backtests/hype/hype-conditional-soft-stale-2026-09-10");
  assert.equal(d.start, "2026-05-17T20:43:00Z"); assert(d.cutoff.endsWith("Z") && Number.isSafeInteger(Date.parse(d.cutoff)));
  assert(Date.parse(d.cutoff) > Date.parse("2026-09-08T17:47:00Z") && Date.parse(d.cutoff) <= Date.parse("2026-10-10T00:00:00Z"));
  assert.deepEqual(d.policies, ["baseline", "age8", "minus_soft_stale"]);
  assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055); assert.equal(d.newTradingDefinitions, 0);
}
export async function runFrozenScorecard(root: string, plan: Plan, out: string): Promise<void> {
  const d = plan.card.definition; validateScorecard(d);
  const read = (f: string) => JSON.parse(fs.readFileSync(inside(root, f), "utf8"));
  const archive = d.archive, m = read(`${archive}/manifest.json`), cfg = read("bot-config.json");
  const validation = read(`${archive}/validation.json`); assert(validation.passed && read(`${archive}/verification.json`).passed);
  assert.equal(await fileHash(inside(root, `${archive}/results.json`)), validation.artifacts.find((x: R) => x.file === "results.json").sha256);
  // Append-only data syncs and the copied runtime state need fresh pins, not old hashes.
  // All archived algorithm/config/evidence inputs must otherwise remain identical.
  for (const p of m.pins) {
    const current = plan.pins.find(x => x.file === p.file); assert(current, `Unpinned inherited input ${p.file}`);
    if (!p.file.startsWith("data/") && p.file !== "bot-state.json") assert.equal(current.sha256, p.sha256, `Archived dependency changed: ${p.file}`);
  }
  assert.equal(cfg.feeRate, d.feeRate);
  process.env.SIM_START = d.start; process.env.SIM_END = d.cutoff; process.env.SIM_EQUITY = String(d.initialEquity);
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  console.log("[scorecard] canonical series; no modified research engine or policies");
  const s = await core.buildSeries({ candleRepairFile: m.repairFile });
  assert.equal(missingMinutes(s.candles).length, 0); assert.equal(s.candles.at(-1)!.endTs, Date.parse(d.cutoff));
  s.marketInputs = await loadReplayMarketInputs(path.resolve(root, "data"), cfg.symbol, Date.parse(d.cutoff));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  // Preserve the exact existing B17 BTC gate input. RR01's stricter gap handling
  // is a NEW diagnostic, not permission to change the canonical baseline.
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000
      ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  const accepted: R[] = read(`${archive}/results.json`).filter((x: R) => x.window === "hl_extended"
    && d.policies.includes(x.policy.id) && x.sensitivity.id === "primary"); assert.equal(accepted.length, 6);
  const results: R[] = [], parity: R[] = [];
  const run = (base: R, end: string, phase: string) => {
    const policy = base.policy.id, cfgRun = structuredClone(cfg); if (policy === "minus_soft_stale") cfgRun.exits.softStale = false;
    const params: EngineParams = { id: policy === "baseline" ? base.model : policy === "minus_soft_stale" ? `${base.model}--minus_soft_stale` : base.name,
      executionModel: "causal_next_open", tpExecutionModel: base.tp, maxPositions: cfg.maxPositions,
      hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const controller = policy === "age8" ? new SoftStaleController("age", 8, 0, () => ({ healthy: true, allowed: true, evidence: {} })) : null;
    const events: ResearchInventoryEvent[] = [];
    const startIdx = core.lowerBound(s.candles, Date.parse(base.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(end) + 1, c => c.endTs);
    const r = runCausalLongReplay(params, s, { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional",
      researchTpDeferral: controller?.decide, researchInventoryObserver: e => events.push(e) }, cfgRun, d.initialEquity);
    const digest = sha(JSON.stringify({ ...r, snapshots: [] })), metrics = exposureMetrics(r, d.initialEquity);
    const accounting = auditComponentAccounting(s.candles, events, metrics, startIdx, endIdx, d.initialEquity, d.feeRate);
    if (phase === "archived_control") {
      assert.equal(digest, base.digest, `Archived digest ${base.name}`); assert.deepEqual(metrics, base.metrics); assert.deepEqual(accounting, base.accounting);
      parity.push({ name: base.name, digest, passed: true });
    }
    const row = { phase, policy, model: base.model, tp: base.tp, start: base.start, end, digest, metrics, accounting,
      pendingAtEnd: r.executionAudit!.pendingAtEnd };
    const name = `${phase}-${base.model}-${policy}`;
    fs.writeFileSync(path.join(out, `${name}-inventory.jsonl`), events.map(x => JSON.stringify(x)).join("\n") + "\n");
    atomicJson(path.join(out, `${name}-summary.json`), row); results.push(row);
    console.log(JSON.stringify({ phase, model: base.model, policy, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, open: metrics.openPnl }));
  };
  // No extension outcomes are run if even one archived control fails.
  for (const base of accepted) run(base, base.end, "archived_control"); assert.equal(parity.length, 6);
  atomicJson(path.join(out, "control-parity.json"), { passed: true, cases: parity });
  for (const base of accepted) run(base, d.cutoff, "extended");
  const extended = results.filter(x => x.phase === "extended");
  const comparisons = extended.filter(x => x.policy !== "baseline").map(x => {
    const base = extended.find(y => y.model === x.model && y.policy === "baseline")!, old = results.find(y => y.phase === "archived_control" && y.policy === x.policy && y.model === x.model)!;
    const oldBase = results.find(y => y.phase === "archived_control" && y.policy === "baseline" && y.model === x.model)!;
    return { policy: x.policy, model: x.model, delta: exposureDelta(x.metrics, base.metrics),
      newTailMtm: x.metrics.totalPnl - old.metrics.totalPnl, baselineTailMtm: base.metrics.totalPnl - oldBase.metrics.totalPnl,
      incrementalTailMtm: (x.metrics.totalPnl - old.metrics.totalPnl) - (base.metrics.totalPnl - oldBase.metrics.totalPnl) };
  });
  atomicJson(path.join(out, "results.json"), results); atomicJson(path.join(out, "comparisons.json"), comparisons);
  atomicJson(path.join(out, "validation.json"), { passed: true, exactArchivedControls: 6, extendedCases: 6, newTradingDefinitions: 0,
    liveChanges: 0, qualification: "not_promoted", originalScreenStillApplies: true,
    limitations: "Only the selected existing F06 candidates, not a search or complete cross-period recertification. Same fees/execution assumptions, no funding/margin/maker simulation. Tail follows original inventory, not a new flat start. Historical and tail outcomes already visible; no untouched holdout." });
}
