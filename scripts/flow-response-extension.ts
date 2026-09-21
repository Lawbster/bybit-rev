/** FR01 time extension only. Reuses frozen economic policy, engine and ledger. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { createPlan, executePlan, atomicJson, sha, verifyPins, type Plan } from "./research-workflow";
import { buildSeries } from "./flow-response-study";
import { VARIANTS, PARENT, loadFlowTape, FlowResponseContext, approvedSize, type R } from "./flow-response-policy";
import { POLICIES, config, AgeHighController } from "./age10-gate-policy";
import { SoftStaleController } from "./conditional-soft-stale-policy";
import { highFeature } from "./near-high-policy";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import { auditFlowLedger } from "./flow-response-audit";
import { componentAttribution } from "./ladder-combination-accounting";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
const CARD = "research-inputs/flow-response-extension-2026-09-14.json";
const read = (file: string): any => JSON.parse(fs.readFileSync(file, "utf8"));
function validate(d: R) {
  assert.equal(d.cutoff, "2026-09-14T15:27:00Z"); assert.equal(d.oldCutoff, "2026-09-10T05:08:00Z");
  assert.equal(d.start, "2026-05-17T20:43:00Z"); assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055);
  assert.equal(d.runs, 14); assert.equal(d.newTradingDefinitions, 0);
  assert.deepEqual(d.policies, ["baseline", PARENT, "impact_half"]); assert.deepEqual(d.sourceLags, [0, 60000]);
}
export async function runExtension(plan: Plan, out: string) {
  const d = plan.card.definition; validate(d);
  const accepted: R[] = read(`${d.archive}/output/results.json`).filter((x: R) => x.window === "hl_extended" && !x.lag && d.policies.includes(x.policy));
  assert.equal(accepted.length, 6); assert(read(`${d.archive}/verification.json`).passed);
  assert(read("backtests/hype/flow-response-extension-data-2026-09-14/btc-check.json").hourlyClosesExactlyUnchanged);
  const { core, s, cfg, highs } = await buildSeries(d);
  const { runCausalLongReplay } = await import("./replay-causal-engine");
  const tape = await loadFlowTape("data/HYPEUSDT_taker_hyperliquid.jsonl", Date.parse(d.cutoff));
  const context = new FlowResponseContext(tape, s.candles), rows: R[] = [], parity: R[] = [];
  const json = (file: string, value: unknown) => atomicJson(path.join(out, file), value);
  const jsonl = (file: string, xs: unknown[]) => fs.writeFileSync(path.join(out, file), xs.map(x => JSON.stringify(x)).join("\n") + "\n", { flag: "wx" });
  json("flow-input-audit.json", tape.audit);
  function run(old: R, bridge: boolean, lag: number) {
    const spec = POLICIES.find(p => p.id === (old.policy === "impact_half" ? PARENT : old.policy))!;
    assert.deepEqual(spec, old.spec);
    const v = old.policy === "impact_half" ? VARIANTS.find(v => v.id === "impact_half")! : null;
    assert.deepEqual(v, old.variant); const c = config(cfg, spec);
    const archivedRaw = read(`${d.archive}/output/${old.name}-engine.json`);
    const labels = new Set<string>([...archivedRaw.closes, ...archivedRaw.trims].map((e: R) => e.variant));
    assert.equal(labels.size, 1); const engineId = [...labels][0];
    const age = spec.ageHours ? new SoftStaleController("age", 10, 0, () => { throw Error("age only"); }) : null;
    const high = spec.days ? new AgeHighController(spec, (i, at, price) => highFeature(s.candles, highs, i, 2, at, price, 0)) : null;
    const events: ResearchInventoryEvent[] = [], attempts: R[] = [], targets: R[] = [];
    const startIdx = core.lowerBound(s.candles, Date.parse(old.start), c => c.endTs);
    const end = bridge ? old.end : d.cutoff, endIdx = core.lowerBound(s.candles, Date.parse(end) + 1, c => c.endTs);
    const name = `${bridge ? "bridge" : "hl_extended"}-${old.tp}--${old.policy}--lag${lag}`;
    console.log(`[FR01 extension ${rows.length + 1}/14] ${name}`);
    const r = runCausalLongReplay({ id: engineId, executionModel: "causal_next_open", tpExecutionModel: old.tp,
      maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none" }, s,
      { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional", researchTpDeferral: age?.decide,
        researchTpObserver: t => { const p = targets.at(-1); if (!p || p.armedIndex !== t.armedIndex || p.episode !== t.episode) targets.push(t); },
        researchAddSize: add => {
          const feature = add.nextDepth >= 8 ? context.at(add.at, lag) : null, choice = approvedSize(v, add, feature);
          attempts.push({ ...add, feature, fire: choice.fire, approvedNotional: choice.notional }); return choice.notional;
        }, researchReduction: high?.reduce, researchInventoryObserver: e => { high?.observe(e); events.push(e); }
      }, c, 32000);
    const raw = { ...r, snapshots: [] }, digest = sha(JSON.stringify(raw)), metrics = exposureMetrics(r, 32000);
    const accounting = auditFlowLedger(s.candles, events, attempts, metrics, startIdx, endIdx);
    if (bridge) {
      if (digest !== old.digest) json("failed-bridge-diagnostics.json", { name, actual: raw, expected: archivedRaw, metrics, expectedMetrics: old.metrics });
      assert.equal(digest, old.digest, `Old-cutoff digest ${name}`); assert.deepEqual(metrics, old.metrics);
      parity.push({ name, originalName: old.name, digest });
    } else if (!lag) {
      const archived = read(`${d.archive}/output/${old.name}-engine.json`);
      assert.deepEqual(r.executionAudit!.events.filter(e => e.fillIndex! < old.endIdx), archived.executionAudit.events, "Future data changed old execution prefix");
      const boundary = r.snapshots.find(v => v.ts === Date.parse(d.oldCutoff)); assert(boundary);
      assert(Math.abs(boundary.equity - 32000 - old.metrics.totalPnl) < 1e-6);
    }
    const changed = attempts.filter(a => a.fire), deep = attempts.filter(a => a.feature), reasonCounts: R = {};
    for (const a of deep) for (const reason of a.feature.reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    const added = attempts.filter(a => a.at > Date.parse(d.oldCutoff)), addedDeep = added.filter(a => a.feature);
    const row: R = { name, originalName: old.name, bridge, policy: old.policy, spec, variant: v,
      window: bridge ? "bridge" : "hl_extended", model: `${bridge ? "bridge" : "hl_extended"}-${old.tp}`, tp: old.tp,
      start: old.start, end, startIdx, endIdx, lag, primary: !bridge && !lag, control: v === null, digest, metrics, accounting,
      pendingAtEnd: r.executionAudit!.pendingAtEnd, blocked: r.blocked,
      counts: { attempts: attempts.length, deep: deep.length, ready: deep.filter(a => a.feature.ready).length,
        unknown: deep.filter(a => !a.feature.ready).length, checksChanged: changed.length, episodesChanged: new Set(changed.map(a => a.episode)).size,
        priceDropChecksChanged: changed.filter(a => a.priceDropOk).length, timerChecksChanged: changed.filter(a => !a.priceDropOk).length,
        zeroChecks: attempts.filter(a => !a.approvedNotional).length, reasonCounts },
      extension: { attempts: added.length, deep: addedDeep.length, unknown: addedDeep.filter(a => !a.feature.ready).length,
        changed: added.filter(a => a.fire).length, events: events.filter(e => e.event.fillAt! > Date.parse(d.oldCutoff)),
        cutoffSnapshot: r.snapshots.find(v => v.ts === Date.parse(d.oldCutoff)), finalSnapshot: r.snapshots.at(-1) } };
    json(`${name}-engine.json`, raw); jsonl(`${name}-inventory.jsonl`, events); json(`${name}-attempts.json`, attempts);
    json(`${name}-targets.json`, targets); json(`${name}-tp-observations.json`, age?.observations ?? []); json(`${name}-high-reductions.json`, high?.rows ?? []);
    rows.push(row); json("results.json", rows);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, open: metrics.openPnl, depth: metrics.openDepth, tailChecks: added.length }));
  }
  for (const old of accepted) run(old, true, 0);
  assert.equal(parity.length, 6); json("control-parity.json", { passed: true, cases: parity });
  for (const old of accepted) run(old, false, 0);
  for (const old of accepted.filter(x => x.policy === "impact_half")) run(old, false, 60000);
  assert.equal(rows.length, 14);
  json("comparisons.json", rows.filter(x => !x.bridge).map(x => {
    const baseline = rows.find(b => b.primary && b.model === x.model && b.policy === "baseline")!;
    const parent = rows.find(b => b.primary && b.model === x.model && b.policy === PARENT)!;
    return { name: x.name, baseline: exposureDelta(x.metrics, baseline.metrics), parent: exposureDelta(x.metrics, parent.metrics),
      baselineAttribution: componentAttribution(x.metrics, baseline.metrics), parentAttribution: componentAttribution(x.metrics, parent.metrics) };
  }));
  json("validation.json", { passed: true, cases: 14, controlsExact: 6, independentVerificationRequired: true, newDefinitions: 0, liveChanges: 0 });
}
async function main() {
  const root = process.cwd(), [cmd, key] = process.argv.slice(2);
  if (cmd === "plan") {
    const card = read(CARD); validate(card.definition); const old = read(`${card.definition.archive}/plan.json`);
    // The previous experiment already pinned these Sep14 tails; refuse silent drift.
    await verifyPins(root, [...old.pins, ...old.protectedPins]);
    const inherited = old.pins.map((p: R) => p.file);
    const plan = await createPlan(root, card, [...new Set<string>([...inherited, CARD,
      "scripts/flow-response-extension.ts", "scripts/flow-response-extension-verify.ts", "scripts/flow-response-extension-data.ts",
      "scripts/flow-response-extension-btc-check.ts", "scripts/flow-response-monthly-report.ts"])], old.protectedPins.map((p: R) => p.file));
    console.log(JSON.stringify({ key: plan.key, newDefinitions: 0, runs: 14, cutoff: card.definition.cutoff }));
  } else { assert.equal(cmd, "run"); await executePlan(root, key, runExtension); }
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
