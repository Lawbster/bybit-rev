import path from "path";
import assert from "assert/strict";
import { OUT, CARD_FILE, read, write, manifest, finish, series, candidateConfig, LiveCandidateAdapter, digest, type R } from "./aggressive10-release-shared";
import { verifyMakerSource } from "./aggressive10-release-maker-source";
import { auditMaker } from "./aggressive10-release-maker-audit";
import { exposureMetrics } from "./ladder-exposure-metrics";
import type { ResearchInventoryEvent } from "./aggressive10-release-maker-engine";

async function main() {
  const dir = path.join(OUT, "scenarios"), card = read(CARD_FILE);
  assert(read(path.join(OUT, "parity/verification.json")).passed, "Exact production-policy archives must pass first");
  const sourceDelta = verifyMakerSource();
  const archives: R[] = read(`${card.archive}/output/results.json`).filter((r: R) => r.primary && card.policies.includes(r.policy));
  assert.equal(archives.length, 8);
  const old = read(`${card.archive}/plan.json`);
  const basePins = read(path.join(OUT, "parity/manifest.json")).pins.map((p: R) => p.file);
  const jobs: R[] = [];
  // The mechanical derivative must preserve all eight full archived paths when disabled.
  for (const equity of card.initialEquities) for (const a of archives) jobs.push({ archive: a.name, scenario: "standard_taker", equity, tp: a.tp, sensitivity: "none" });
  for (const equity of card.initialEquities) for (const a of archives.filter(a => a.tp === "resting_touch"))
    for (const sc of card.makerScenarios) jobs.push({ archive: a.name, scenario: sc.id, equity, tp: "resting_touch", share: sc.makerShareOnTouch, sensitivity: "none" });
  // Frozen, separately labeled stresses; controls use the same starting equity/path model.
  for (const a of archives.filter(a => a.tp === "resting_touch" && a.model.startsWith("hl_extended")))
    for (const sensitivity of card.sensitivities) jobs.push({ archive: a.name, scenario: "half_maker_then_market", share: .5,
      equity: card.initialEquities[1], tp: "resting_touch", sensitivity });
  assert.equal(jobs.length, 44);
  const m = await manifest(dir, [...basePins, ...old.pins.map((p: R) => p.file).filter((f: string) => f.startsWith("data/")),
    "scripts/aggressive10-release-scenarios.ts", "scripts/aggressive10-release-maker-source.ts", "scripts/aggressive10-release-maker-engine.ts",
    "scripts/aggressive10-release-maker-audit.ts", "scripts/aggressive10-release-maker-tests.ts", "scripts/ladder-exposure-metrics.ts",
    `${OUT}/parity/verification.json`, "scripts/replay-damaged-latch.ts", "scripts/near-high-policy.ts", "scripts/replay-candle-repair.ts"]);
  write(path.join(dir, "jobs.json"), { jobs, sourceDelta, scope: "Source/policy parity + conditional fee/execution scenarios; not exchange or funding certification" });
  const { s, cfg, core, highs } = await series();
  assert.equal(cfg.feeRate, card.fees.entry); assert.equal(cfg.feeRate, card.fees.marketExit);
  assert.equal(cfg.makerTp!.makerFeeRate, card.fees.makerExit);
  const { runCausalLongReplay } = await import("./aggressive10-release-maker-engine");
  const results: R[] = [];
  for (const j of jobs) {
    const a = archives.find(a => a.name === j.archive)!, c = candidateConfig(cfg, a.policy);
    const unchanged = j.scenario === "standard_taker", highDelay = j.sensitivity === "recent_high_market_fill_plus_one_minute" ? 60000 : 0;
    const gaps = j.sensitivity === "recent_one_closed_minute_gap_each_4h_boundary";
    const live = new LiveCandidateAdapter(s, highs, a.policy !== "baseline", unchanged, highDelay, gaps);
    const startIdx = core.lowerBound(s.candles, Date.parse(a.start), c => c.endTs), endIdx = core.lowerBound(s.candles, Date.parse(a.end) + 1, c => c.endTs);
    const events: ResearchInventoryEvent[] = [];
    const id = unchanged && j.equity === 32000 ? a.engineId : `release-${results.length + 1}`;
    const r = runCausalLongReplay({ id, executionModel: "causal_next_open", tpExecutionModel: j.tp, maxPositions: c.maxPositions,
      hardFlattenHours: c.exits.hardFlattenHours, hardFlattenPct: c.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" }, s,
      { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional",
        makerExecution: unchanged ? undefined : { share: j.share, makerFee: card.fees.makerExit, marketFee: card.fees.marketExit, tick: card.priceTickAssumption },
        researchTpDeferral: live.enabled ? live.defer : undefined, researchTpObserver: live.target, researchReduction: live.reduce,
        researchAddVeto: live.enabled && gaps ? d => live.gapAt(d.at) : undefined,
        researchInventoryObserver: e => { live.observe(e); events.push(e); } }, c, j.equity);
    const hash = digest({ ...r, snapshots: [] });
    if (unchanged && j.equity === 32000) assert.equal(hash, a.digest, `Derived engine disabled must match ${a.name}`);
    const metrics = exposureMetrics(r, j.equity);
    const audit = auditMaker(s.candles, events, metrics, startIdx, endIdx, j.equity, card.fees, unchanged ? null : j.share, highDelay);
    const name = `${a.model}--${a.policy}--${j.equity}--${j.scenario}--${j.sensitivity}`;
    results.push({ name, policy: a.policy, model: a.model, start: a.start, end: a.end, ...j, digest: hash, metrics, audit,
      highFires: live.highFires, targetChecks: live.targetChecks, highChecks: live.highChecks, fullWindowChecks: live.fullWindowChecks,
      blocked: r.blocked, pendingAtEnd: r.executionAudit!.pendingAtEnd });
    write(path.join(dir, `${String(results.length).padStart(2, "0")}-inventory.json`), events);
    write(path.join(dir, "results.json"), results);
    console.log(JSON.stringify({ case: `${results.length}/${jobs.length}`, policy: a.policy, model: a.model, equity: j.equity,
      scenario: j.scenario, sensitivity: j.sensitivity, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, fees: audit.modeledFees }));
  }
  await finish(dir, m, { passed: true, cases: results.length, exactDisabledArchiveControls: 8, independentAccounting: true,
    productionPolicy: true, syntheticContextDelay: "Four-hour boundary minute unavailable; historical minute recovers at the next evaluation. No synthetic prices.",
    liquidityOrQueueCertified: false, fundingIncluded: false, currentInventoryImported: false, deployableByThisStudy: false });
}
main().catch(e => { console.error(e); process.exitCode = 1; });
