/** AG10-H1: only fractional rolling-high lookbacks. No production mutations. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { createPlan, executePlan, atomicJson, sha, verifyPins, type Plan } from "./research-workflow";
import { buildSeries } from "./flow-response-study";
import { POLICIES, config, AgeHighController, type Policy } from "./age10-gate-policy";
import { SoftStaleController } from "./conditional-soft-stale-policy";
import { highFeature, trailingHighIndices } from "./near-high-policy";
import { exposureMetrics, exposureDelta } from "./ladder-exposure-metrics";
import { auditFlowLedger } from "./flow-response-audit";
import { componentAttribution } from "./ladder-combination-accounting";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
export const PARENT = "age10__minus_deep_stress__minus_tp_cooldown";
export const CARD = "research-inputs/aggressive10-high-window-2026-09-14.json";
type R = Record<string, any>;
const read = (file: string): any => JSON.parse(fs.readFileSync(file, "utf8"));
export function policy(hours: number): Policy {
  assert([36, 48, 60].includes(hours));
  const p = structuredClone(POLICIES.find(p => p.id === PARENT)!);
  if (hours !== 48) { p.id = `aggressive10_high${hours}h`; p.days = hours / 24; }
  return p;
}
function validate(d: R) {
  assert.equal(d.parent, PARENT); assert.deepEqual(d.highHours, [36, 48, 60]);
  assert.equal(d.runs, 16); assert.equal(d.newTradingDefinitions, 2);
  assert.equal(d.cutoff, "2026-09-14T15:27:00Z"); assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055);
  assert.deepEqual(d.tpModels, ["resting_touch", "close_confirmed"]);
}
export function controls(d: R): R[] {
  return d.windows.flatMap((w: R) => {
    const archive = w.id === "hl_extended" ? d.recentArchive : d.olderArchive;
    assert(read(`${archive}/verification.json`).passed);
    const rows = read(`${archive}/output/results.json`).filter((x: R) =>
      x.window === w.id && !x.lag && ["baseline", PARENT].includes(x.policy));
    assert.equal(rows.length, 4);
    return rows.map((x: R) => {
      assert.equal(Date.parse(x.start), Date.parse(w.start)); assert.equal(Date.parse(x.end), Date.parse(w.end));
      return { ...x, archive };
    });
  });
}
async function runStudy(plan: Plan, out: string) {
  const d = plan.card.definition; validate(d); const accepted = controls(d);
  const { core, s, cfg } = await buildSeries(d);
  const { runCausalLongReplay } = await import("./replay-causal-engine");
  const highs = new Map(d.highHours.map((h: number) => [h, trailingHighIndices(s.candles, h * 60)]));
  const rows: R[] = [], parity: R[] = [];
  const json = (file: string, v: unknown) => atomicJson(path.join(out, file), v);
  function run(old: R, spec: Policy, control: boolean) {
    const c = config(cfg, spec), highHours = spec.days ? spec.days * 24 : null;
    const name = `${old.window}-${old.tp}--${spec.id}`;
    let engineId = name;
    if (control) {
      assert.deepEqual(spec, old.spec);
      const raw = read(`${old.archive}/output/${old.name}-engine.json`);
      const labels = new Set<string>([...raw.closes, ...raw.trims].map((e: R) => e.variant));
      assert.equal(labels.size, 1); engineId = [...labels][0];
    }
    const age = spec.ageHours ? new SoftStaleController("age", spec.ageHours, 0, () => { throw Error("age only"); }) : null;
    const high = spec.days ? new AgeHighController(spec,
      (i, at, price) => highFeature(s.candles, highs.get(highHours!) as Int32Array, i, spec.days!, at, price, 0)) : null;
    const events: ResearchInventoryEvent[] = [], attempts: R[] = [], targets: R[] = [];
    const startIdx = core.lowerBound(s.candles, Date.parse(old.start), c => c.endTs);
    const endIdx = core.lowerBound(s.candles, Date.parse(old.end) + 1, c => c.endTs);
    console.log(`[AG10-H1 ${rows.length + 1}/16] ${name}`);
    const r = runCausalLongReplay({ id: engineId, executionModel: "causal_next_open", tpExecutionModel: old.tp,
      maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none" }, s,
      { startIdx, endIdx, recordSnapshots: true, partialClockModel: "transactional", researchTpDeferral: age?.decide,
        researchTpObserver: t => { const p = targets.at(-1); if (!p || p.armedIndex !== t.armedIndex || p.episode !== t.episode) targets.push(t); },
        researchAddSize: a => { attempts.push({ ...a, approvedNotional: a.requestedNotional }); return a.requestedNotional; },
        researchReduction: high?.reduce, researchInventoryObserver: e => { high?.observe(e); events.push(e); }
      }, c, 32000);
    const raw = { ...r, snapshots: [] }, digest = sha(JSON.stringify(raw)), metrics = exposureMetrics(r, 32000);
    const accounting = auditFlowLedger(s.candles, events, attempts, metrics, startIdx, endIdx);
    if (control) {
      assert.equal(digest, old.digest, `Archived engine digest ${name}`); assert.deepEqual(metrics, old.metrics);
      parity.push({ name, originalName: old.name, archive: old.archive, digest });
    }
    const reasons: R = {}; for (const e of metrics.episodes) reasons[e.reason] = (reasons[e.reason] ?? 0) + 1;
    const row = { name, engineId, policy: spec.id, spec, highHours, control, window: old.window, tp: old.tp,
      start: old.start, end: old.end, startIdx, endIdx, lag: 0, digest, metrics, accounting, audit: age?.counts ?? null,
      pendingAtEnd: r.executionAudit!.pendingAtEnd, reasons, highExits: high?.traces.length ?? 0,
      originalName: control ? old.name : null, archive: control ? old.archive : null };
    json(`${name}-engine.json`, raw); fs.writeFileSync(path.join(out, `${name}-inventory.jsonl`), events.map(e => JSON.stringify(e)).join("\n") + "\n", { flag: "wx" });
    json(`${name}-attempts.json`, attempts); json(`${name}-targets.json`, targets);
    json(`${name}-tp-observations.json`, age?.observations ?? []); json(`${name}-high-reductions.json`, high?.rows ?? []);
    json(`${name}-high-traces.json`, high?.traces ?? []);
    rows.push(row); json("results.json", rows);
    console.log(JSON.stringify({ name, net: metrics.totalPnl, dd: metrics.maxDrawdownPct, wins: metrics.profitableEpisodes, losses: metrics.losingEpisodes, highExits: row.highExits }));
  }
  for (const old of accepted) run(old, POLICIES.find(p => p.id === old.policy)!, true);
  assert.equal(parity.length, 8); json("control-parity.json", { passed: true, cases: parity });
  for (const old of accepted.filter(x => x.policy === PARENT)) for (const h of [36, 60]) run(old, policy(h), false);
  assert.equal(rows.length, 16);
  json("comparisons.json", rows.map(x => {
    const baseline = rows.find(b => b.window === x.window && b.tp === x.tp && b.policy === "baseline")!;
    const parent = rows.find(b => b.window === x.window && b.tp === x.tp && b.policy === PARENT)!;
    return { name: x.name, baseline: exposureDelta(x.metrics, baseline.metrics), parent: exposureDelta(x.metrics, parent.metrics),
      baselineAttribution: componentAttribution(x.metrics, baseline.metrics), parentAttribution: componentAttribution(x.metrics, parent.metrics) };
  }));
  json("validation.json", { passed: true, independentVerificationRequired: true, cases: 16, controlsExact: 8, newDefinitions: 2, liveChanges: 0 });
}
async function main() {
  const root = process.cwd(), [cmd, key] = process.argv.slice(2);
  if (cmd === "plan") {
    const card = read(CARD); validate(card.definition);
    const old = read(`${card.definition.recentArchive}/plan.json`);
    await verifyPins(root, [...old.pins, ...old.protectedPins]);
    const accepted = controls(card.definition);
    for (const archive of new Set(accepted.map(x => x.archive))) {
      const state = read(`${archive}/state.json`); assert.equal(state.status, "complete");
      const names = new Set(accepted.filter(x => x.archive === archive).map(x => `${archive}/output/${x.name}-engine.json`));
      await verifyPins(root, state.artifacts.filter((p: R) => names.has(p.file) || p.file === `${archive}/output/results.json`));
    }
    const sources = [...new Set<string>([...old.pins.map((p: R) => p.file), CARD,
      ...accepted.map(x => `${x.archive}/output/${x.name}-engine.json`),
      "scripts/aggressive10-high-window-study.ts", "scripts/aggressive10-high-window-tests.ts",
      "scripts/aggressive10-high-window-verify.ts", "docs/research/aggressive10-fractional-high-window.md"])];
    const p = await createPlan(root, card, sources, old.protectedPins.map((p: R) => p.file));
    console.log(JSON.stringify({ key: p.key, runs: 16, definitions: 2 }));
  } else { assert.equal(cmd, "run"); await executePlan(root, key, runStudy); }
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
