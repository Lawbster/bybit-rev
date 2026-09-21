/** Independent L11 high calculation (block-prefix/suffix), permissions and ledger. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson } from "./research-workflow";
import { prices, lines } from "./hype-failed-recovery-study";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import { exposureDelta } from "./ladder-exposure-metrics";
type R = Record<string, any>;
async function main() {
  const root = path.resolve(__dirname, ".."), dir = jobDirectory(root, process.argv[2]), out = path.join(dir, "output");
  const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8")), load = (f: string) => read(path.join(out, f));
  const plan = read(path.join(dir, "plan.json")), state = read(path.join(dir, "state.json"));
  assert.equal(state.status, "complete"); await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const d = plan.card.definition, cfg = read("bot-config.json"), manifest = read(`${d.archive}/manifest.json`);
  const cs = await prices(Date.parse(d.cutoff), manifest.repairFile), highs = new Map<number, Float64Array>(); let highChecks = 0;
  for (const days of d.days as number[]) {
    const w = days * 1440, prefix = new Float64Array(cs.length), suffix = new Float64Array(cs.length), result = new Float64Array(cs.length);
    for (let i = 0; i < cs.length; i++) prefix[i] = i % w ? Math.max(prefix[i - 1], cs[i].high) : cs[i].high;
    for (let i = cs.length - 1; i >= 0; i--) suffix[i] = i === cs.length - 1 || (i + 1) % w === 0 ? cs[i].high : Math.max(suffix[i + 1], cs[i].high);
    const bytes = fs.readFileSync(path.join(out, `high-${days}d.i32`)); assert.equal(bytes.length, cs.length * 4);
    for (let i = 0; i < cs.length; i++) {
      const source = bytes.readInt32LE(i * 4);
      if (i < w - 1) { assert.equal(source, -1); continue; }
      result[i] = Math.max(suffix[i - w + 1], prefix[i]);
      assert(source >= i - w + 1 && source <= i); assert.equal(cs[source].high, result[i]); highChecks++;
    }
    highs.set(days, result);
  }
  const results: R[] = load("results.json"), comps: R[] = load("comparisons.json"), accepted: R[] = read(`${d.acceptedResults}/output/results.json`);
  assert.equal(results.length, 78); let fills = 0, minutes = 0, addChecks = 0, exitChecks = 0, controls = 0;
  for (const x of results) {
    const events: any[] = []; await lines(path.join(out, `${x.name}-inventory.jsonl`), e => events.push(e));
    const accounting = auditComponentAccounting(cs, events, x.metrics, x.startIdx, x.endIdx, d.initialEquity, d.feeRate, { fraction: 1, fillDelayMs: 0 });
    assert.deepEqual(accounting, x.accounting); fills += events.length; minutes += accounting.independentMinutes;
    const policy = x.policy === "baseline" ? null : /^([a-z]+)_(\d+)d_(\d+)pct$/.exec(x.policy)!;
    const action = policy?.[1], days = Number(policy?.[2]), pct = Number(policy?.[3]);
    const near = (i: number) => {
      const j = i - x.lag / 60000, high = highs.get(days)?.[j];
      return high ? Math.max(0, 100 * (1 - cs[i].close / high)) <= pct + 1e-10 : null;
    };
    let ptr = 0, inv: R[] = [], episode = 0, eligibleAdds = 0, vetoes = 0, unknown = 0;
    const intervened = new Set<number>(), permissions = new Map<number, boolean>();
    const adds: any[] = load(`${x.name}-adds.json`);
    for (const [i, ep, drop, veto, missing] of adds) {
      while (ptr < events.length && events[ptr].event.fillIndex <= i) { const e = events[ptr++]; inv = e.after; episode = e.episode; }
      assert.equal(ep, inv.length ? episode : episode + 1);
      const eligible = action === "block" && inv.length >= 7, context = eligible ? near(i) : false;
      assert.equal(veto, eligible && (context === null || context)); assert.equal(missing, eligible && context === null);
      assert.equal(drop, inv.length > 0 && cfg.priceTriggerPct > 0 && cs[i].close <= inv.at(-1)!.entryPrice * (1 - cfg.priceTriggerPct / 100));
      eligibleAdds += Number(eligible); vetoes += Number(veto); unknown += Number(missing);
      if (veto) intervened.add(ep); permissions.set(i, veto); addChecks++;
    }
    for (const e of events.filter(e => e.event.kind === "open")) assert.equal(permissions.get(e.event.decisionIndex), false);
    assert.equal(adds.length, x.counts.adds); assert.equal(eligibleAdds, x.counts.eligibleAdds); assert.equal(vetoes, x.counts.vetoes);
    const reductions: any[] = load(`${x.name}-reductions.json`), rows = new Map<number, any[]>(reductions.map(r => [r[0], r]));
    const pending = new Set<number>();
    // Resting TP target arms are not market-close pending intentions. New adds
    // and research exits at the current decision are scheduled AFTER this hook.
    for (const e of events) if (e.event.fillAt === cs[e.event.fillIndex].ts) {
      const beforeHook = e.event.kind !== "open" && !e.event.reason.startsWith("research_exit:");
      for (let i = e.event.decisionIndex + (beforeHook ? 0 : 1); i < e.event.fillIndex; i++) pending.add(i);
    }
    if (x.pendingAtEnd) {
      const e = x.pendingAtEnd, beforeHook = e.kind !== "open" && !e.reason.startsWith("research_exit:");
      for (let i = e.decisionIndex + (beforeHook ? 0 : 1); i < x.endIdx; i++) pending.add(i);
    }
    ptr = 0; inv = []; let eligibleExits = 0, exitIntents = 0, expectedRows = 0;
    const fires = new Set<number>();
    if (action === "exit") for (let i = x.startIdx; i < x.endIdx; i++) {
      while (ptr < events.length && events[ptr].event.fillIndex <= i) { const e = events[ptr++]; inv = e.after; episode = e.episode; }
      if (!inv.length) { assert(!rows.has(i)); continue; }
      const r = rows.get(i); assert(r, `${x.name} missing occupied decision ${i}`); expectedRows++;
      const [, ep, depth, canReduce, fire] = r; assert.equal(ep, episode); assert.equal(depth, inv.length); assert.equal(canReduce, !pending.has(i));
      const eligible = canReduce && cs[i].endTs - Math.min(...inv.map(p => p.entryTime)) >= 4 * 3600000;
      const context = eligible ? near(i) : false, expected = eligible && context === true;
      assert.equal(fire, expected); eligibleExits += Number(eligible); unknown += Number(eligible && context === null);
      if (fire) { exitIntents++; intervened.add(ep); fires.add(i); } exitChecks++;
    }
    assert.equal(reductions.length, expectedRows); assert.equal(reductions.length, x.counts.exitChecks);
    assert.equal(eligibleExits, x.counts.eligibleExits); assert.equal(exitIntents, x.counts.exitIntents); assert.equal(unknown, x.counts.unknown);
    assert.equal(intervened.size, x.interventions);
    let cooldown = 0;
    for (const e of events) {
      if (e.event.reason.startsWith("research_exit:")) {
        assert.equal(e.event.kind, "close"); assert(fires.has(e.event.decisionIndex)); fires.delete(e.event.decisionIndex);
        cooldown = (Math.floor(e.event.fillAt / 14400000) + 2) * 14400000;
      } else if (e.event.kind === "open" && !e.before.length) assert(e.event.decisionAt >= cooldown);
    }
    if (x.pendingAtEnd?.reason.startsWith("research_exit:")) fires.delete(x.pendingAtEnd.decisionIndex);
    assert.equal(fires.size, 0, "Every research intent must fill or remain pending at cutoff");
    if (x.policy === "baseline") {
      const b = accepted.find(y => y.policy === "baseline" && y.model === x.model && y.end === x.end)!;
      assert(b); assert.equal(x.digest, b.digest); assert.deepEqual(x.metrics, b.metrics); assert.deepEqual(x.accounting, b.accounting); controls++;
    } else {
      const b = results.find(y => y.policy === "baseline" && y.model === x.model && y.end === x.end)!, c = comps.find(y => y.name === x.name)!;
      assert.deepEqual(c.delta, exposureDelta(x.metrics, b.metrics)); assert.deepEqual(c.attribution, componentAttribution(x.metrics, b.metrics));
    }
    console.log(`[verified] ${x.name}`);
  }
  assert.equal(controls, 6); await verifyPins(root, [...plan.protectedPins, ...state.artifacts]);
  const result = { passed: true, economicCases: results.length, controlsExact: controls, highChecks, addChecks, exitChecks, fills, minutes,
    newTradingDefinitions: 12, liveChanges: 0, note: "All highs by independent prefix/suffix, all vetoes and occupied exit decisions, fills, cooldowns, accounting and attribution. Not a live qualification." };
  atomicJson(path.join(dir, "verification.json"), result); console.log(JSON.stringify(result));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
