/** Independent verification/accounting of the frozen FR01 cutoff extension. */
import fs from "fs";
import path from "path";
import readline from "readline";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson, sha, fileHash } from "./research-workflow";
import { auditFlowLedger } from "./flow-response-audit";
import { RawFlowReference, checkFeature } from "./flow-response-verify";
import { auditAgeHighTargets, auditAgeHighExits, rawHighs } from "./age-high-refinement-audit";
import { exposureDelta } from "./ladder-exposure-metrics";
import { componentAttribution } from "./ladder-combination-accounting";
import type { Candle } from "./hype-freerun-canonical-replay";
type R = Record<string, any>;
const M = 60000, PARENT = "age10__minus_deep_stress__minus_tp_cooldown";
const near = (a: number, b: number) => assert(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6, `${a} != ${b}`);

function tailMetrics(cs: Candle[], events: R[], row: R, cutoff: number) {
  let inv: R[] = [], ptr = 0, realized = 0, peak = 32000, globalDd = 0;
  let atBoundary: R | null = null, final: R | null = null, tailPeak = 0, tailDd = 0, tailMin = Infinity, worstOpen = 0;
  const mark = (price: number) => inv.reduce((n, p) => n + p.qty * (price - p.entryPrice) - .00055 * p.qty * (price + p.entryPrice), 0);
  function fill(x: R) {
    assert.deepEqual(inv, x.before);
    if (x.event.kind !== "open") for (const p of inv) {
      const q = p.qty - (x.after.find((v: R) => v.id === p.id)?.qty ?? 0), price = x.event.price;
      realized += q * (price - p.entryPrice) - .00055 * q * (price + p.entryPrice);
    }
    inv = x.after;
  }
  function observe(price: number, at: number) {
    const open = mark(price), equity = 32000 + realized + open;
    peak = Math.max(peak, equity); globalDd = Math.max(globalDd, (peak - equity) / peak * 100);
    if (at > cutoff) {
      assert(atBoundary); tailPeak = Math.max(tailPeak, equity); tailDd = Math.max(tailDd, (tailPeak - equity) / tailPeak * 100);
      tailMin = Math.min(tailMin, equity); worstOpen = Math.min(worstOpen, open);
    }
    return { at, equity, realized, open, price, depth: inv.length, qty: inv.reduce((n, p) => n + p.qty, 0),
      avgEntry: inv.length ? inv.reduce((n, p) => n + p.notional, 0) / inv.reduce((n, p) => n + p.qty, 0) : null,
      currentDrawdownFromRunPeakPct: (peak - equity) / peak * 100 };
  }
  for (let i = row.startIdx; i < row.endIdx; i++) {
    const c = cs[i];
    while (events[ptr]?.event.fillIndex === i && events[ptr].event.fillAt === c.ts) fill(events[ptr++]);
    observe(c.low, c.endTs);
    while (events[ptr]?.event.fillIndex === i) fill(events[ptr++]);
    final = observe(c.close, c.endTs);
    if (c.endTs === cutoff) { atBoundary = final; tailPeak = final.equity; }
  }
  assert(atBoundary && final); assert.equal(ptr, events.length);
  near(final.equity - 32000, row.metrics.totalPnl); near(globalDd, row.metrics.maxDrawdownPct);
  near(final.realized, row.metrics.realized); near(final.open, row.metrics.openPnl);
  near(atBoundary.equity, row.extension.cutoffSnapshot.equity); near(final.equity, row.extension.finalSnapshot.equity);
  const es = row.metrics.episodes.filter((e: R) => Date.parse(e.close) > cutoff);
  return { name: row.name, policy: row.policy, tp: row.tp, lag: row.lag, start: atBoundary, end: final,
    addedPeriodEquityChange: final.equity - atBoundary.equity, addedPeriodMaxDrawdownPct: tailDd,
    addedPeriodMinEquity: tailMin, addedPeriodWorstOpenPnl: worstOpen,
    completed: es, wins: es.filter((e: R) => e.pnl > 0).length, losses: es.filter((e: R) => e.pnl < 0).length,
    winDollars: es.reduce((n: number, e: R) => n + Math.max(0, e.pnl), 0), lossDollars: es.reduce((n: number, e: R) => n + Math.min(0, e.pnl), 0) };
}


// The worker saved every TP transition/arm, but omitted its redundant age-count
// summary. Derive that summary from the recorded transitions without changing
// any every-minute target or execution check. Bridge summaries must ALSO equal
// the independently verified original FR01 counters.
function recordedTargetCounters(cs: Candle[], events: R[], observations: R[], x: R) {
  const scheduled = new Set(events.filter(e => e.event.kind === "close" &&
    !e.event.reason.startsWith("research_exit:") && e.event.fillAt === cs[e.event.fillIndex].ts).map(e => e.event.decisionIndex));
  if (x.pendingAtEnd?.kind === "close" && !x.pendingAtEnd.reason.startsWith("research_exit:")) scheduled.add(x.pendingAtEnd.decisionIndex);
  const ranges = observations.filter(o => o.status === "extended").map(o => ({
    episode: o.episode, start: o.at,
    end: observations.find(v => v.episode === o.episode && v.at >= o.at && v.status === "release_requested")?.at ?? Infinity,
  }));
  let ptr = 0, inv: R[] = [], episode = -1;
  const counts = { checks: 0, eligibleChecks: 0, deferredChecks: 0, unknownChecks: 0 };
  for (let i = x.startIdx; i < x.endIdx; i++) {
    while (ptr < events.length && events[ptr].event.fillIndex <= i) { const e = events[ptr++]; inv = e.after; episode = e.episode; }
    if (!inv.length || scheduled.has(i)) continue;
    counts.checks++;
    const qty = inv.reduce((n, p) => n + p.qty, 0), avg = inv.reduce((n, p) => n + p.entryPrice * p.qty, 0) / qty;
    const at = cs[i].endTs, age = (at - Math.min(...inv.map(p => p.entryTime))) / 3600000;
    if (age >= 4 && (cs[i].close - avg) / avg * 100 < .5) counts.eligibleChecks++;
    if (ranges.some(r => r.episode === episode && at >= r.start && at < r.end)) counts.deferredChecks++;
  }
  return counts;
}

async function main() {
  const checkerHash = await fileHash(__filename);
  const root = process.cwd(), dir = jobDirectory(root, process.argv[2]), out = path.join(dir, "output");
  const read = (f: string): any => JSON.parse(fs.readFileSync(f, "utf8")), load = (f: string) => read(path.join(out, f));
  const plan = read(path.join(dir, "plan.json")), state = read(path.join(dir, "state.json")), d = plan.card.definition;
  assert.equal(state.status, "complete"); assert(!fs.existsSync(path.join(dir, "verification.json")));
  assert(!fs.existsSync(path.join(dir, "extension-attribution.json")));
  const pins = [...plan.pins, ...plan.protectedPins, ...state.artifacts]; await verifyPins(root, pins);
  const { loadCandles1m } = await import("./hype-freerun-canonical-replay");
  const cs = await loadCandles1m("HYPEUSDT", path.resolve("data"), Date.parse(d.cutoff), d.repairFile);
  for (let i = 1; i < cs.length; i++) assert.equal(cs[i].ts, cs[i - 1].endTs);
  const cfg = read("bot-config.json"); delete cfg.aggressive10;
  const source = new RawFlowReference(); let line = 0;
  for await (const text of readline.createInterface({ input: fs.createReadStream("data/HYPEUSDT_taker_hyperliquid.jsonl"), crlfDelay: Infinity })) {
    line++; if (!text.trim()) continue; const r = JSON.parse(text); if (Number(r.windowEnd ?? r.timestamp) <= Date.parse(d.cutoff)) source.add(r, line);
  }
  const closeAt = (end: number) => { const i = (end - cs[0].endTs) / M; return cs[i]?.endTs === end ? cs[i].close : null; };
  const highs = rawHighs(cs, 2), rows: R[] = load("results.json"), comps: R[] = load("comparisons.json"), old: R[] = read(`${d.archive}/output/results.json`);
  assert.equal(rows.length, 14); assert.equal(rows.filter(r => r.bridge).length, 6);
  let controls = 0, fills = 0, minutes = 0, checks = 0, featureChecks = 0, targetChecks = 0, highChecks = 0;
  const tails: R[] = [];
  for (const x of rows) {
    console.log(`[FR01 extension verify] ${x.name}`);
    const raw = load(`${x.name}-engine.json`); assert.equal(sha(JSON.stringify(raw)), x.digest);
    const events: R[] = fs.readFileSync(path.join(out, `${x.name}-inventory.jsonl`), "utf8").trim().split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
    assert.deepEqual(events.map(e => e.event), raw.executionAudit.events); assert.deepEqual(x.pendingAtEnd, raw.executionAudit.pendingAtEnd);
    const attempts: R[] = load(`${x.name}-attempts.json`);
    assert.deepEqual(auditFlowLedger(cs, events as any, attempts, x.metrics, x.startIdx, x.endIdx), x.accounting);
    fills += events.length; minutes += x.endIdx - x.startIdx;
    const targets: R[] = load(`${x.name}-targets.json`), arms: R[] = [];
    const derivedAudit = x.spec.ageHours ? recordedTargetCounters(cs, events, load(`${x.name}-tp-observations.json`), x) : null;
    if (x.bridge && x.spec.ageHours) { const prior = old.find(o => o.name === x.originalName); assert(prior); assert.deepEqual(derivedAudit, prior.audit, "Original age counters"); }
    targetChecks += auditAgeHighTargets(cs, events as any, targets, load(`${x.name}-tp-observations.json`),
      { ...x, audit: derivedAudit, control: !x.spec.ageHours, policy: { id: "baseline", family: "age" }, sensitivity: { sourceLagMs: 0, releaseDelayMs: 0 } }, {}, cfg, {}, t => arms.push(t)).checks;
    assert.equal(arms.length, targets.length);
    arms.forEach((t, i) => { const a = targets[i]; for (const k of ["episode", "armedIndex", "armedAt", "pct"]) assert.equal(a[k], t[k]); near(a.targetPrice, t.targetPrice); });
    if (x.spec.days) highChecks += auditAgeHighExits(cs, events as any, { ...x, lag: 0 }, load(`${x.name}-high-reductions.json`), highs);
    for (const e of events.filter(e => e.event.kind === "close" && ["tp", "stale_tp"].includes(e.event.reason))) {
      const v = e.event, arm = arms.filter(t => t.episode === e.episode && t.armedIndex <= v.decisionIndex).at(-1); assert(arm);
      assert.equal(v.reason, arm.pct < 1.4 ? "stale_tp" : "tp");
      if (v.fillAt === cs[v.fillIndex].endTs) { assert.equal(v.decisionIndex, arm.armedIndex); near(v.price, arm.targetPrice); assert(arm.armedIndex < v.fillIndex); }
      else { assert(arm.armedIndex < v.decisionIndex); assert(cs[v.decisionIndex].close >= arm.targetPrice); }
    }
    let ptr = 0, inv: R[] = [], episode = 0;
    for (const a of attempts) {
      while (ptr < events.length && events[ptr].event.fillIndex <= a.index) { const e = events[ptr++]; inv = e.after; episode = e.episode; }
      assert.equal(a.at, cs[a.index].endTs); assert.equal(a.price, cs[a.index].close); assert.equal(a.nextDepth, inv.length + 1);
      assert.equal(a.episode, inv.length ? episode : episode + 1); near(a.requestedNotional, 800 * 1.35 ** inv.length);
      near(a.qty, inv.reduce((n, p) => n + p.qty, 0)); near(a.entryCostNotional, inv.reduce((n, p) => n + p.notional, 0));
      assert.equal(a.priceDropOk, !!inv.length && cfg.priceTriggerPct > 0 && a.price <= inv.at(-1)!.entryPrice * (1 - cfg.priceTriggerPct / 100));
      let f: R | null = null;
      if (a.nextDepth >= 8) {
        f = source.at(a.at, x.lag, closeAt); checkFeature(a.feature, f); featureChecks++;
        assert(f.end <= a.at - x.lag - M); if (f.latestAvailable != null) assert(f.latestAvailable <= a.at - x.lag);
      } else assert.equal(a.feature, null);
      assert(x.policy !== "impact_half" || x.variant.requireImpact === true && x.variant.fraction === .5);
      const fire = x.policy === "impact_half" && a.nextDepth >= 8 && f?.ready === true && f.acceleration === true && f.impact === true;
      assert.equal(a.fire, fire); near(a.approvedNotional, a.requestedNotional * (fire ? .5 : 1)); checks++;
    }
    const previous = old.find(o => o.name === x.originalName); assert(previous);
    if (x.bridge) { assert.equal(x.digest, previous.digest); assert.deepEqual(x.metrics, previous.metrics); controls++; }
    else {
      if (!x.lag) {
        const prior = read(`${d.archive}/output/${x.originalName}-engine.json`);
        assert.deepEqual(raw.executionAudit.events.filter((e: R) => e.fillIndex < previous.endIdx), prior.executionAudit.events);
      }
      const comp = comps.find(c => c.name === x.name); assert(comp);
      for (const peer of ["baseline", "parent"]) {
        const b = rows.find(b => b.primary && b.model === x.model && b.policy === (peer === "baseline" ? "baseline" : PARENT)); assert(b);
        assert.deepEqual(comp[peer], exposureDelta(x.metrics, b.metrics)); assert.deepEqual(comp[`${peer}Attribution`], componentAttribution(x.metrics, b.metrics));
      }
      tails.push(tailMetrics(cs, events, x, Date.parse(d.oldCutoff)));
    }
  }
  assert.equal(controls, 6); await verifyPins(root, pins); assert.equal(await fileHash(__filename), checkerHash);
  atomicJson(path.join(dir, "extension-attribution.json"), { cutoff: d.cutoff, previousCutoff: d.oldCutoff, tails,
    notes: "Extension DD uses intrabar lows and close equity; peak seeded with carried equity at old cutoff. Full-run drawdown tracked separately. No reset of inventory/cooldown or capital at September10." });
  const receipt = { passed: true, cases: 14, controlsExact: controls, fills, minutes, addChecks: checks, featureChecks, targetChecks, highChecks,
    uniqueFeatureWindows: source.cache.size, ageCounterProvenance: "Derived from saved transitions; old bridge counters match; all every-minute target checks retained. Original worker summary field absent.", newDefinitions: 0, liveChanges: 0, checkerSha256: await fileHash(__filename) };
  atomicJson(path.join(dir, "verification.json"), receipt); console.log(JSON.stringify(receipt));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
