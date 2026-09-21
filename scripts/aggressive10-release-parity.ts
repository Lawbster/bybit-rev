import path from "path";
import assert from "assert/strict";
import { OUT, CARD_FILE, read, write, manifest, finish, series, candidateConfig, LiveCandidateAdapter, digest, type R } from "./aggressive10-release-shared";
import { exposureMetrics } from "./ladder-exposure-metrics";
import { auditCombinationAccounting } from "./ladder-combination-accounting";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
async function main() {
  const dir = path.join(OUT, "parity"), card = read(CARD_FILE);
  const arch = read(`${card.archive}/output/results.json`).filter((r: R) => r.primary && card.policies.includes(r.policy));
  assert.equal(arch.length, 8); assert(read(`${card.archive}/verification.json`).passed);
  const old = read(`${card.archive}/plan.json`);
  const sourceFiles = old.pins.map((p: R) => p.file).filter((f: string) => f.startsWith("data/"));
  const m = await manifest(dir, [...sourceFiles, card.repairFile, "scripts/aggressive10-release-parity.ts", `${card.archive}/output/results.json`, `${card.archive}/verification.json`,
    "src/bot/aggressive10-policy.ts", "src/bot/close-cooldown.ts", "src/bot/strategy.ts", "scripts/hype-freerun-canonical-replay.ts", "scripts/replay-market-inputs.ts", "scripts/replay-sr-context.ts", "src/indicators.ts"]);
  const { s, cfg, core, highs } = await series(); const { runCausalLongReplay } = await import("./replay-causal-engine");
  const result = [];
  for (const a of arch) {
    const c = candidateConfig(cfg, a.policy), live = new LiveCandidateAdapter(s, highs, a.policy !== "baseline"), events: ResearchInventoryEvent[] = [];
    const startIdx = core.lowerBound(s.candles, Date.parse(a.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(a.end) + 1, c => c.endTs);
    const r = runCausalLongReplay({ id: a.engineId, executionModel: "causal_next_open", tpExecutionModel: a.tp, maxPositions: c.maxPositions,
      hardFlattenHours: c.exits.hardFlattenHours, hardFlattenPct: c.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" }, s,
      { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional", researchTpDeferral: live.enabled ? live.defer : undefined,
        researchTpObserver: live.target, researchReduction: live.reduce, researchInventoryObserver: e => { live.observe(e); events.push(e); } }, c, 32000);
    const metrics = exposureMetrics(r, 32000);
    assert.equal(digest({ ...r, snapshots: [] }), a.digest, `Exact archived digest: ${a.name}`);
    assert.deepEqual(metrics, a.metrics);
    const accounting = auditCombinationAccounting(s.candles, events, metrics, startIdx, endIdx, 32000, cfg.feeRate, { fraction: 1, fillDelayMs: 0 });
    assert.deepEqual(accounting, a.accounting);
    result.push({ name: a.name, policy: a.policy, model: a.model, start: a.start, end: a.end, digest: a.digest, metrics,
      fills: events.length, targetChecks: live.targetChecks, highChecks: live.highChecks, fullWindowChecks: live.fullWindowChecks, highFires: live.highFires });
    write(path.join(dir, "results.json"), result);
    console.log(JSON.stringify({ parity: `${result.length}/8`, policy: a.policy, model: a.model, net: metrics.totalPnl, dd: metrics.maxDrawdownPct }));
  }
  await finish(dir, m, { passed: true, exactArchives: result.length, productionPolicyCompared: true,
    fillQueueCertified: false, note: "Closed-minute source/policy parity, not exact sub-minute execution parity" });
}
main().catch(e => { console.error(e); process.exitCode = 1; });
