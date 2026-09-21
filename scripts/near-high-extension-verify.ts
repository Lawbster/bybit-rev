/** Independent L12 high calculation (block-prefix/suffix), permissions and ledger. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson } from "./research-workflow";
import { prices, lines } from "./hype-failed-recovery-study";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import { loadMinutes } from "./relative-reversion-study";
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
  const btcLoaded = await loadMinutes(root, "BTCUSDT", Date.parse(d.cutoff)), btc = btcLoaded.candles;
  const btcHighs = new Map<number, Float64Array>(), btcByEnd = new Map(btc.map((c, i) => [c.endTs, i]));
  let btcHighChecks = 0, btcChecks = 0;
  for (const days of d.days as number[]) {
    const w = days * 1440, prefix = new Float64Array(btc.length), suffix = new Float64Array(btc.length), result = new Float64Array(btc.length);
    const segment = new Int32Array(btc.length);
    for (let i = 0; i < btc.length; i++) {
      const reset = !i || btc[i].ts !== btc[i - 1].endTs;
      segment[i] = reset ? i : segment[i - 1];
      prefix[i] = reset || i % w === 0 ? btc[i].high : Math.max(prefix[i - 1], btc[i].high);
    }
    for (let i = btc.length - 1; i >= 0; i--) suffix[i] = i === btc.length - 1 || (i + 1) % w === 0 || btc[i].endTs !== btc[i + 1].ts
      ? btc[i].high : Math.max(suffix[i + 1], btc[i].high);
    const bytes = fs.readFileSync(path.join(out, `btc-high-${days}d.i32`)); assert.equal(bytes.length, btc.length * 4);
    for (let i = 0; i < btc.length; i++) {
      const source = bytes.readInt32LE(i * 4);
      if (i - segment[i] < w - 1) { assert.equal(source, -1); continue; }
      result[i] = Math.max(suffix[i - w + 1], prefix[i]); assert(source >= i - w + 1 && source <= i);
      assert.equal(btc[source].high, result[i]); btcHighChecks++;
    }
    btcHighs.set(days, result);
  }
  const strength = (at: number, days: number, lag: number): boolean | null => {
    const end = at - lag, j = btcByEnd.get(end), prev = btcByEnd.get(end - 14400000);
    if (j === undefined || prev === undefined || !btcHighs.get(days)![j]) return null;
    return Math.max(0, 100 * (1 - btc[j].close / btcHighs.get(days)![j])) <= 1 + 1e-10 && btc[j].close >= btc[prev].close;
  };
  const sourceMeta = load("btc-source-meta.json"); assert.equal(sourceMeta.rows, btc.length);
  assert.deepEqual(sourceMeta.gaps, btcLoaded.audit.gaps.map(g => ({ start: g.start, end: g.end, minutes: g.minutes })));
  for (const c of sourceMeta.coverage) {
    let total = 0, ready = 0, strong = 0;
    for (const bar of cs) if (bar.endTs >= Date.parse(c.start) && bar.endTs <= Date.parse(c.end)) {
      const f = strength(bar.endTs, c.days, 0); total++; ready += Number(f !== null); strong += Number(f === true);
    }
    assert.equal(total, c.total); assert.equal(ready, c.ready); assert.equal(strong, c.strong); assert.equal(total - ready, c.unknown);
  }
  const results: R[] = load("results.json"), comps: R[] = load("comparisons.json"), accepted: R[] = read(`${d.acceptedResults}/output/results.json`);
  assert.equal(results.length, 222); let fills = 0, minutes = 0, addChecks = 0, exitChecks = 0, controls = 0;
  for (const x of results) {
    const events: any[] = []; await lines(path.join(out, `${x.name}-inventory.jsonl`), e => events.push(e));
    const accounting = auditComponentAccounting(cs, events, x.metrics, x.startIdx, x.endIdx, d.initialEquity, d.feeRate, { fraction: 1, fillDelayMs: 0 });
    assert.deepEqual(accounting, x.accounting); fills += events.length; minutes += accounting.independentMinutes;
    const policy = x.policy === "baseline" ? null : /^(?:btc_)?([a-z]+)_(\d+)d_(\d+)pct$/.exec(x.policy)!;
    const action = policy?.[1], days = Number(policy?.[2]), pct = Number(policy?.[3]);
    const near = (i: number) => {
      const j = i - x.lag / 60000, high = highs.get(days)?.[j];
      return high ? Math.max(0, 100 * (1 - cs[i].close / high)) <= pct + 1e-10 : null;
    };
    let ptr = 0, inv: R[] = [], episode = 0, eligibleAdds = 0, vetoes = 0, unknown = 0;
    let rawVetoes = 0, localBtcChecks = 0, btcUnknown = 0, btcStrong = 0, relaxedCount = 0; const relaxedEpisodes = new Set<number>();
    const intervened = new Set<number>(), permissions = new Map<number, boolean>();
    const adds: any[] = load(`${x.name}-adds.json`);
    for (const [i, ep, drop, veto, missing, rawVeto, btcReady, btcStrongFlag, relaxed] of adds) {
      while (ptr < events.length && events[ptr].event.fillIndex <= i) { const e = events[ptr++]; inv = e.after; episode = e.episode; }
      assert.equal(ep, inv.length ? episode : episode + 1);
      const eligible = action === "block" && inv.length >= 7, context = eligible ? near(i) : false;
      const raw = eligible && (context === null || context);
      assert.equal(rawVeto, raw); assert.equal(missing, eligible && context === null);
      const evaluate = x.policy.startsWith("btc_") && raw && !missing;
      const btcContext = evaluate ? strength(cs[i].endTs, days, x.lag) : null;
      assert.equal(btcReady, evaluate ? btcContext !== null : null); assert.equal(btcStrongFlag, evaluate ? btcContext === true : null);
      assert.equal(relaxed, evaluate && btcContext === true); assert.equal(veto, raw && !relaxed);
      rawVetoes += Number(raw); localBtcChecks += Number(evaluate); btcUnknown += Number(evaluate && btcContext === null);
      btcStrong += Number(evaluate && btcContext === true); relaxedCount += Number(relaxed);
      if (relaxed) relaxedEpisodes.add(ep); btcChecks += Number(evaluate);
      assert.equal(drop, inv.length > 0 && cfg.priceTriggerPct > 0 && cs[i].close <= inv.at(-1)!.entryPrice * (1 - cfg.priceTriggerPct / 100));
      eligibleAdds += Number(eligible); vetoes += Number(veto); unknown += Number(missing);
      if (veto) intervened.add(ep); permissions.set(i, veto); addChecks++;
    }
    for (const e of events.filter(e => e.event.kind === "open")) assert.equal(permissions.get(e.event.decisionIndex), false);
    assert.equal(adds.length, x.counts.adds); assert.equal(eligibleAdds, x.counts.eligibleAdds); assert.equal(vetoes, x.counts.vetoes);
    assert.equal(rawVetoes, x.counts.rawVetoes); assert.equal(localBtcChecks, x.counts.btcChecks); assert.equal(btcUnknown, x.counts.btcUnknown);
    assert.equal(btcStrong, x.counts.btcStrong); assert.equal(relaxedCount, x.counts.relaxed); assert.equal(relaxedEpisodes.size, x.counts.relaxedEpisodes);
    for (const t of load(`${x.name}-relaxed-traces.json`)) {
      assert(permissions.get(t.decision.index) === false && t.btc.strong);
      assert(t.feature.highAt <= t.feature.sourceEnd && t.feature.availableAt <= t.decision.at);
      assert(t.btc.highAt <= t.btc.sourceEnd && t.btc.availableAt <= t.decision.at);
      assert.equal(t.btc.returnSourceEnd, t.btc.sourceEnd - 14400000);
      assert(strength(t.decision.at, days, x.lag));
    }
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
      if (x.policy.startsWith("btc_")) {
        const match = (y: R) => y.policy === x.policy.slice(4) && y.model === x.model && y.end === x.end && y.phase === x.phase;
        const raw = results.find(match) ?? accepted.find(match), bc = load("btc-comparisons.json").find((y: R) => y.name === x.name);
        assert(raw && bc); assert.equal(bc.rawNet, raw.metrics.totalPnl); assert.equal(bc.rawDd, raw.metrics.maxDrawdownPct);
        assert.deepEqual(bc.delta, exposureDelta(x.metrics, raw.metrics)); assert.deepEqual(bc.attribution, componentAttribution(x.metrics, raw.metrics));
      }
    }
    console.log(`[verified] ${x.name}`);
  }
  const ranking: R[] = load("ranking.json"); assert.equal(ranking.length, 36);
  for (const row of ranking) {
    const cases = results.filter(x => x.policy === row.policy && x.phase === "primary"), failures: string[] = [];
    assert.equal(cases.length, 4);
    for (const x of cases) {
      const b = results.find(y => y.policy === "baseline" && y.model === x.model && y.end === x.end)!, delta = exposureDelta(x.metrics, b.metrics);
      if (delta.pnlDelta < (x.window === "hl_extended" ? 1000 : 0)) failures.push(`${x.model}:net`);
      if (delta.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`);
      if (delta.worstMonthDelta < -250) failures.push(`${x.model}:monthly`);
      if (x.window === "hl_extended" && x.interventions < 20) failures.push(`${x.model}:thin`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:nonpositive_equity`);
    }
    assert.deepEqual(failures, row.failures); assert.equal(row.passesPrimaryScreen, failures.length === 0); assert.equal(row.deployable, false);
  }
  assert.equal(controls, 6); await verifyPins(root, [...plan.protectedPins, ...state.artifacts]);
  const result = { passed: true, economicCases: results.length, controlsExact: controls, highChecks, btcHighChecks, btcChecks, addChecks, exitChecks, fills, minutes,
    newTradingDefinitions: 36, liveChanges: 0, note: "HYPE and gapped BTC highs by independent prefix/suffix, independent BTC close-to-close strength, raw/effective permissions and unavailable-source handling, all vetoes and occupied exit decisions, fills, cooldowns, accounting and attribution. Not a live qualification." };
  atomicJson(path.join(dir, "verification.json"), result); console.log(JSON.stringify(result));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });

