/** L14 independent raw-price, target, inventory, monthly and comparison audit. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson } from "./research-workflow";
import { prices, lines } from "./hype-failed-recovery-study";
import { auditCombinationAccounting, componentAttribution } from "./ladder-combination-accounting";
import { exposureDelta } from "./ladder-exposure-metrics";
import { auditAgeHighTargets, auditAgeHighExits, rawHighs } from "./age-high-refinement-audit";
import { PARENT, validate, POLICIES } from "./age-high-refinement-policy";
type R = Record<string, any>;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
async function main() {
  const root = path.resolve(__dirname, ".."), dir = jobDirectory(root, process.argv[2]), out = path.join(dir, "output");
  const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8")), load = (f: string) => read(path.join(out, f));
  const plan = read(path.join(dir, "plan.json")), state = read(path.join(dir, "state.json")); assert.equal(state.status, "complete");
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const d = plan.card.definition; validate(d); const cfg = read("bot-config.json"), cs = await prices(Date.parse(d.cutoff), read(`${d.archive}/manifest.json`).repairFile);
  const highs = new Map<number, Float64Array>();
  for (const days of [1, 2, 3, 5, 6]) {
    const h = rawHighs(cs, days), bytes = fs.readFileSync(path.join(out, `high-${days}d.i32`)); assert.equal(bytes.length, cs.length * 4);
    for (let i = 0; i < cs.length; i++) { const j = bytes.readInt32LE(4 * i); if (!h[i]) assert.equal(j, -1);
      else { assert(j >= i - days * 1440 + 1 && j <= i); assert.equal(cs[j].high, h[i]); } }
    highs.set(days, h);
  }
  const accepted: R[] = read(`${d.acceptedResults}/output/results.json`).filter((x: R) => x.primary), components: R[] = read(`${d.components}/results.json`);
  const rows: R[] = load("results.json"), comps: R[] = load("comparisons.json"), primary = rows.filter(x => x.primary);
  assert.equal(rows.length, 170); assert.equal(primary.length, 120); assert.equal(rows.filter(x => x.phase === "source60").length, 50);
  let fills = 0, minutes = 0, controls = 0, targetChecks = 0, highChecks = 0, sizeChecks = 0;
  for (const x of rows) {
    const frozen = POLICIES.find(p => p.id === x.policy); assert(frozen); assert.deepEqual(x.spec, frozen);
    const events: any[] = []; await lines(path.join(out, `${x.name}-inventory.jsonl`), e => events.push(e));
    const half = x.spec.legs.includes("last11_50");
    const accounting = auditCombinationAccounting(cs, events, x.metrics, x.startIdx, x.endIdx, d.initialEquity, d.feeRate, { fraction: 1, fillDelayMs: 0 }, half);
    assert.deepEqual(accounting, x.accounting); fills += events.length; minutes += accounting.independentMinutes;
    if (x.spec.legs.includes("minus_sr_partial")) assert.equal(accounting.reasonCounts.sr_partial ?? 0, 0);
    const targets: R[] = load(`${x.name}-targets.json`), obs: R[] = load(`${x.name}-tp-observations.json`), arms: R[] = [];
    const audit = auditAgeHighTargets(cs, events, targets, obs, { ...x, control: !x.spec.ageHours, policy: { id: "baseline", family: "age" }, sensitivity: { sourceLagMs: 0, releaseDelayMs: 0 } }, {}, cfg, {}, t => arms.push(t));
    targetChecks += audit.checks;
    assert.equal(arms.length, targets.length, `full arm ledger ${x.name}`);
    arms.forEach((t, i) => { const a = targets[i]; assert.equal(a.episode, t.episode); assert.equal(a.armedAt, t.armedAt); assert.equal(a.armedIndex, t.armedIndex); near(a.targetPrice, t.targetPrice); assert.equal(a.pct, t.pct); });
    let ptr = 0, inv: R[] = [], ep = 0;
    const sizes: R[] = load(`${x.name}-sizes.json`), permits = new Map<number, R>();
    for (const s of sizes) {
      while (ptr < events.length && events[ptr].event.fillIndex <= s.index) { const e = events[ptr++]; inv = e.after; ep = e.episode; }
      assert.equal(s.at, cs[s.index].endTs); assert.equal(s.price, cs[s.index].close); assert.equal(s.nextDepth, inv.length + 1); assert.equal(s.episode, inv.length ? ep : ep + 1);
      near(s.requestedNotional, 800 * 1.35 ** inv.length); near(s.approvedNotional, s.requestedNotional * (half && inv.length === 10 ? .5 : 1));
      near(s.entryCostNotional, inv.reduce((n, p) => n + p.notional, 0)); near(s.qty, inv.reduce((n, p) => n + p.qty, 0)); permits.set(s.index, s); sizeChecks++;
    }
    for (const e of events.filter(e => e.event.kind === "open")) { const s = permits.get(e.event.decisionIndex); assert(s); near(e.event.qty * e.event.price, s.approvedNotional); }
    const te = new Set<number>(obs.filter(o => o.status === "extended").map(o => o.episode)), se = new Set<number>(sizes.filter(s => s.requestedNotional !== s.approvedNotional).map(s => s.episode));
    const he = new Set<number>(events.filter(e => e.event.reason.startsWith("research_exit:")).map(e => e.episode));
    assert.equal(te.size, x.counts.targetEpisodes); assert.equal(se.size, x.counts.sizeEpisodes); assert.equal(he.size, x.counts.highEpisodes);
    assert.equal(new Set([...te, ...se, ...he]).size, x.interventions);
    for (const e of events.filter(e => e.event.kind === "close" && ["tp", "stale_tp"].includes(e.event.reason))) {
      const v = e.event, t = arms.filter(t => t.episode === e.episode && t.armedIndex <= v.decisionIndex).at(-1); assert(t);
      assert.equal(v.reason, t.pct < 1.4 ? "stale_tp" : "tp");
      if (v.fillAt === cs[v.fillIndex].endTs) { assert.equal(v.decisionIndex, t.armedIndex); near(v.price, t.targetPrice); assert(t.armedIndex < v.fillIndex); }
      else { assert(t.armedIndex < v.decisionIndex); assert(cs[v.decisionIndex].close >= t.targetPrice); }
    }
    if (x.spec.days) {
      const h = highs.get(x.spec.days)!, decisions: any[] = load(`${x.name}-high-reductions.json`), traces: R[] = load(`${x.name}-high-traces.json`);
      highChecks += auditAgeHighExits(cs, events, x, decisions, h);
      const firing = decisions.filter(r => r[4]); assert.equal(firing.length, traces.length); assert.equal(traces.length, x.counts.highIntents);
      traces.forEach((t, i) => { const v = t.decision, j = v.index - x.lag / 60000; assert.equal(v.index, firing[i][0]); assert.equal(v.episode, firing[i][1]);
        assert.equal(t.feature.high, h[j]); assert.equal(t.feature.sourceEnd, cs[j].endTs); assert.equal(t.feature.availableAt, v.at); assert.equal(v.at, cs[v.index].endTs);
        near(t.feature.distancePct, Math.max(0, 100 * (1 - cs[v.index].close / h[j])));
        assert(t.feature.highIndex <= j && t.feature.highIndex > j - x.spec.days * 1440);
      });
    }
    if (x.phase === "exact_control") {
      const a = accepted.find(a => a.policy === x.policy && a.model === x.model) ?? components.find(a => a.policy === x.policy && a.model === x.model);
      assert(a); assert.equal(x.digest, a.digest); assert.deepEqual(x.metrics, a.metrics); controls++;
    }
    const b = primary.find(b => b.policy === "baseline" && b.model === x.model)!, p = primary.find(b => b.policy === PARENT && b.model === x.model)!, c = comps.find(c => c.name === x.name)!;
    assert.deepEqual(c.baseline, exposureDelta(x.metrics, b.metrics)); assert.deepEqual(c.parent, exposureDelta(x.metrics, p.metrics));
    assert.deepEqual(c.attributionBaseline, componentAttribution(x.metrics, b.metrics)); assert.deepEqual(c.attributionParent, componentAttribution(x.metrics, p.metrics));
    for (const peer of c.peers) { const p = primary.find(b => b.policy === peer.policy && b.model === x.model) ?? accepted.find(b => b.policy === peer.policy && b.model === x.model); assert(p); assert.deepEqual(peer.delta, exposureDelta(x.metrics, p.metrics)); }
  }
  assert.equal(controls, 20); assert.equal(load("control-parity.json").cases.length, controls);
  for (const r of load("ranking.json") as R[]) {
    const xs = primary.filter(x => x.policy === r.policy), failures: string[] = []; assert.equal(xs.length, 4);
    for (const x of xs) {
      const delta = comps.find(c => c.name === x.name)!.baseline, recent = x.window === "hl_extended";
      if (delta.pnlDelta < (recent ? d.screen.minimumRecentNetDelta : d.screen.minimumPublishedNetDelta)) failures.push(`${x.model}:net`);
      if (delta.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`);
      if (delta.worstMonthDelta < d.screen.minimumMonthlyDelta) failures.push(`${x.model}:monthly`);
      if (recent && x.interventions < d.screen.minimumInterventionEpisodes) failures.push(`${x.model}:thin`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:nonpositive_equity`);
    }
    assert.deepEqual(failures, r.failures); assert.equal(r.passesScreen, failures.length === 0);
    assert.equal(r.aggregateBaselineAllFour, xs.every(x => { const c = comps.find(c => c.name === x.name)!.baseline; return c.pnlDelta > 0 && c.ddReductionPp >= -1e-9; }));
    assert.equal(r.improvesParentAllFour, xs.every(x => { const c = comps.find(c => c.name === x.name)!.parent; return c.pnlDelta > 0 && c.ddReductionPp >= -1e-9; }));
    near(r.minRecentNetDelta, Math.min(...xs.filter(x => x.window === "hl_extended").map(x => comps.find(c => c.name === x.name)!.baseline.pnlDelta)));
  }
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const receipt = { passed: true, economicCases: rows.length, controlsExact: controls, fills, minutes, targetChecks, highChecks, sizeChecks, newTradingDefinitions: 24, liveChanges: 0 };
  atomicJson(path.join(dir, "verification.json"), receipt); console.log(JSON.stringify(receipt));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
