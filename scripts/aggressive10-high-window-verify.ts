/** Independent AG10-H1 accounting, all-minute exit audit and monthly reporting. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson, fileHash, sha } from "./research-workflow";
import { auditFlowLedger } from "./flow-response-audit";
import { auditAgeHighTargets, auditAgeHighExits, rawHighs } from "./age-high-refinement-audit";
import { exposureDelta } from "./ladder-exposure-metrics";
import { componentAttribution } from "./ladder-combination-accounting";
import type { Candle } from "./hype-freerun-canonical-replay";
type R = Record<string, any>;
const PARENT = "age10__minus_deep_stress__minus_tp_cooldown";
const near = (a: number, b: number) => assert(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6, `${a} != ${b}`);

// Reconstruct monthly peaks from carried equity; never reset inventory or capital.
function monthlyReport(cs: Candle[], events: R[], x: R) {
  let inv: R[] = [], ptr = 0, realized = 0, lastEquity = 32000, peak = 32000, dd = 0, min = 32000;
  const months = new Map<string, R>();
  const mark = (price: number) => inv.reduce((n, p) => n + p.qty * (price - p.entryPrice) - .00055 * p.qty * (price + p.entryPrice), 0);
  function fill(e: R) {
    assert.deepEqual(inv, e.before);
    if (e.event.kind !== "open") for (const p of inv) {
      const q = p.qty - (e.after.find((v: R) => v.id === p.id)?.qty ?? 0); assert(q >= -1e-10);
      realized += q * (e.event.price - p.entryPrice) - .00055 * q * (e.event.price + p.entryPrice);
    }
    inv = e.after;
  }
  for (let i = x.startIdx; i < x.endIdx; i++) {
    const c = cs[i], month = new Date(c.endTs).toISOString().slice(0, 7);
    if (!months.has(month)) months.set(month, { month, startEquity: lastEquity, startRealized: realized, peak: lastEquity, dd: 0, fromRunPeak: 0 });
    const m = months.get(month)!;
    function observe(price: number) {
      const eq = 32000 + realized + mark(price); peak = Math.max(peak, eq); min = Math.min(min, eq);
      const dp = (peak - eq) / peak * 100; dd = Math.max(dd, dp); m.fromRunPeak = Math.max(m.fromRunPeak, dp);
      m.peak = Math.max(m.peak, eq); m.dd = Math.max(m.dd, (m.peak - eq) / m.peak * 100); return eq;
    }
    while (events[ptr]?.event.fillIndex === i && events[ptr].event.fillAt === c.ts) fill(events[ptr++]);
    observe(c.low);
    while (events[ptr]?.event.fillIndex === i) fill(events[ptr++]);
    lastEquity = observe(c.close); m.endEquity = lastEquity; m.endRealized = realized;
  }
  assert.equal(ptr, events.length); near(lastEquity - 32000, x.metrics.totalPnl);
  near(realized, x.metrics.realized); near(mark(cs[x.endIdx - 1].close), x.metrics.openPnl);
  near(dd, x.metrics.maxDrawdownPct); near(min, x.metrics.minEquity);
  assert.equal(months.size, x.accounting.monthly.length);
  return x.accounting.monthly.map((a: R) => {
    const m = months.get(a.month)!;
    near(m.endEquity - m.startEquity, a.mtmPnl); near(m.endRealized - m.startRealized, a.realizedPnl);
    return { ...a, startEquity: m.startEquity, monthlyDrawdownPct: m.dd, maxDrawdownFromRunPeakPct: m.fromRunPeak,
      averageLoss: a.losses ? a.lossDollars / a.losses : null };
  });
}
async function main() {
  const root = process.cwd(), dir = jobDirectory(root, process.argv[2]), out = path.join(dir, "output");
  const read = (f: string): any => JSON.parse(fs.readFileSync(f, "utf8")), load = (f: string) => read(path.join(out, f));
  const plan = read(path.join(dir, "plan.json")), state = read(path.join(dir, "state.json")), d = plan.card.definition;
  assert.equal(state.status, "complete"); assert(!fs.existsSync(path.join(dir, "verification.json")));
  const checkerSha256 = await fileHash(__filename), pins = [...plan.pins, ...plan.protectedPins, ...state.artifacts];
  await verifyPins(root, pins);
  const { loadCandles1m } = await import("./hype-freerun-canonical-replay");
  const cs = await loadCandles1m("HYPEUSDT", path.resolve("data"), Date.parse(d.cutoff), d.repairFile);
  for (let i = 1; i < cs.length; i++) assert.equal(cs[i].ts, cs[i - 1].endTs);
  const highs = new Map([36, 48, 60].map(h => [h, rawHighs(cs, h / 24)]));
  const rows: R[] = load("results.json"), comps: R[] = load("comparisons.json");
  assert.equal(rows.length, 16); assert.equal(rows.filter(x => x.control).length, 8);
  let fills = 0, minutes = 0, addChecks = 0, targetChecks = 0, highChecks = 0, controls = 0;
  const report: R[] = [], examples: R[] = [];
  const cfg = read("bot-config.json"); delete cfg.aggressive10;
  for (const x of rows) {
    console.log(`[AG10-H1 verify] ${x.name}`);
    const raw = load(`${x.name}-engine.json`); assert.equal(sha(JSON.stringify(raw)), x.digest);
    const events: R[] = fs.readFileSync(path.join(out, `${x.name}-inventory.jsonl`), "utf8").trim().split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
    assert.deepEqual(events.map(e => e.event), raw.executionAudit.events); assert.deepEqual(x.pendingAtEnd, raw.executionAudit.pendingAtEnd);
    const attempts: R[] = load(`${x.name}-attempts.json`);
    assert.deepEqual(auditFlowLedger(cs, events as any, attempts, x.metrics, x.startIdx, x.endIdx), x.accounting);
    fills += events.length; minutes += x.endIdx - x.startIdx;
    const arms: R[] = [], targets: R[] = load(`${x.name}-targets.json`);
    targetChecks += auditAgeHighTargets(cs, events as any, targets, load(`${x.name}-tp-observations.json`),
      { ...x, control: !x.spec.ageHours, policy: { id: "baseline", family: "age" }, sensitivity: { sourceLagMs: 0, releaseDelayMs: 0 } },
      {}, cfg, {}, t => arms.push(t)).checks;
    assert.equal(arms.length, targets.length);
    arms.forEach((a, i) => { const t = targets[i]; for (const k of ["episode", "armedAt", "armedIndex", "pct"]) assert.equal(a[k], t[k]); near(a.targetPrice, t.targetPrice); });
    if (x.highHours) {
      const hs = highs.get(x.highHours)!;
      highChecks += auditAgeHighExits(cs, events as any, x, load(`${x.name}-high-reductions.json`), hs);
      const traces: R[] = load(`${x.name}-high-traces.json`); assert.equal(traces.length, x.highExits);
      for (const t of traces) {
        const f = t.feature, a = t.decision;
        assert.equal(a.at, cs[a.index].endTs); assert.equal(a.price, cs[a.index].close);
        assert.equal(f.sourceEnd, a.at); assert.equal(f.sourceStart, a.at - x.highHours * 3600000);
        assert.equal(f.availableAt, a.at); assert(f.highAt <= a.at && f.highAt > f.sourceStart);
        assert.equal(f.high, cs[f.highIndex].high); assert.equal(f.highAt, cs[f.highIndex].endTs); near(f.high, hs[a.index]);
      }
    }
    for (const e of events.filter(e => e.event.kind === "close" && ["tp", "stale_tp"].includes(e.event.reason))) {
      const v = e.event, arm = arms.filter(a => a.episode === e.episode && a.armedIndex <= v.decisionIndex).at(-1); assert(arm);
      assert.equal(v.reason, arm.pct < 1.4 ? "stale_tp" : "tp");
      if (v.fillAt === cs[v.fillIndex].endTs) { assert.equal(v.decisionIndex, arm.armedIndex); assert(arm.armedIndex < v.fillIndex); near(v.price, arm.targetPrice); }
      else { assert(arm.armedIndex < v.decisionIndex); assert(cs[v.decisionIndex].close >= arm.targetPrice); }
    }
    let ptr = 0, inv: R[] = [], episode = 0;
    for (const a of attempts) {
      while (ptr < events.length && events[ptr].event.fillIndex <= a.index) { const e = events[ptr++]; inv = e.after; episode = e.episode; }
      assert.equal(a.at, cs[a.index].endTs); assert.equal(a.price, cs[a.index].close); assert.equal(a.nextDepth, inv.length + 1);
      assert.equal(a.episode, inv.length ? episode : episode + 1); near(a.requestedNotional, 800 * 1.35 ** inv.length);
      near(a.approvedNotional, a.requestedNotional); near(a.qty, inv.reduce((n, p) => n + p.qty, 0));
      assert.equal(a.priceDropOk, !!inv.length && cfg.priceTriggerPct > 0 && a.price <= inv.at(-1)!.entryPrice * (1 - cfg.priceTriggerPct / 100)); addChecks++;
    }
    if (x.control) {
      const previous: R = read(`${x.archive}/output/results.json`).find((v: R) => v.name === x.originalName); assert(previous);
      assert.equal(x.digest, previous.digest); assert.deepEqual(x.metrics, previous.metrics); controls++;
    } else {
      const parent = rows.find(b => b.window === x.window && b.tp === x.tp && b.policy === PARENT)!;
      assert.deepEqual({ ...x.spec, days: 2, id: PARENT }, parent.spec);
      // Save ALL matched-entry changes, not just the nicest examples. Occupancy
      // replacement effects are separately reconciled by componentAttribution.
      const matched = x.metrics.episodes.flatMap((e: R) => {
        const b = parent.metrics.episodes.find((b: R) => b.entry === e.entry);
        if (!b || Math.abs(e.pnl - b.pnl) < 1e-6 && e.close === b.close) return [];
        const ev = events.find(v => v.event.kind === "close" && new Date(v.event.fillAt).toISOString() === e.close);
        return [{ delta: e.pnl - b.pnl, variant: e, parent: b, closeEvidence: ev ?? null }];
      }).sort((a: R, b: R) => b.delta - a.delta);
      examples.push({ name: x.name, matched });
    }
    const comp = comps.find(c => c.name === x.name); assert(comp);
    for (const peer of ["baseline", "parent"]) {
      const b = rows.find(b => b.window === x.window && b.tp === x.tp && b.policy === (peer === "baseline" ? "baseline" : PARENT)); assert(b);
      assert.deepEqual(comp[peer], exposureDelta(x.metrics, b.metrics)); assert.deepEqual(comp[`${peer}Attribution`], componentAttribution(x.metrics, b.metrics));
    }
    report.push({ name: x.name, window: x.window, tp: x.tp, policy: x.policy, highHours: x.highHours, control: x.control,
      start: x.start, end: x.end, totals: { wins: x.metrics.profitableEpisodes, losses: x.metrics.losingEpisodes,
        winDollars: x.metrics.grossWin, lossDollars: -x.metrics.grossLoss, averageLoss: x.metrics.losingEpisodes ? -x.metrics.grossLoss / x.metrics.losingEpisodes : null,
        realized: x.metrics.realized, openPnl: x.metrics.openPnl, openDepth: x.metrics.openDepth, unfinishedPartialPnl: x.metrics.unfinishedPartialPnl,
        net: x.metrics.totalPnl, dd: x.metrics.maxDrawdownPct, tpCycles: x.metrics.tpCycles, forcedCloses: x.metrics.forcedCloses, highExits: x.highExits,
        worstLoss: x.metrics.worstEpisode, worstFiveMean: x.metrics.worstFiveMean }, monthly: monthlyReport(cs, events, x), comparisons: comp });
  }
  assert.equal(controls, 8);
  const screens = [36, 60].map(h => {
    const cases = report.filter(x => x.highHours === h); assert.equal(cases.length, 4);
    const versus = (peer: string) => {
      const failures: R[] = [];
      for (const c of cases) {
        const delta = c.comparisons[peer], threshold = c.window === "hl_extended" ? d.screen.minimumRecentNetDelta : d.screen.minimumPublishedNetDelta;
        if (delta.pnlDelta < threshold) failures.push({ case: c.name, reason: "net_hurdle", delta: delta.pnlDelta, threshold });
        if (delta.ddReductionPp < -1e-9) failures.push({ case: c.name, reason: "drawdown_worse", reductionPp: delta.ddReductionPp });
        for (const m of delta.monthly) if (m.mtmDelta < d.screen.minimumMonthlyDelta) failures.push({ case: c.name, reason: "monthly_cost", month: m.month, delta: m.mtmDelta });
      }
      return { passed: failures.length === 0, failures };
    };
    return { highHours: h, versus48h: versus("parent"), versusB17: versus("baseline"), deploymentAuthorized: false };
  });
  await verifyPins(root, pins); assert.equal(await fileHash(__filename), checkerSha256);
  for (const f of ["monthly-loss-dd.json", "matched-examples.json", "screen.json"]) assert(!fs.existsSync(path.join(dir, f)));
  atomicJson(path.join(dir, "monthly-loss-dd.json"), { rows: report, notes: "Completed ladders assigned to final-close month including all partials. Monthly MTM includes carried open PnL; monthly DD peak resets to previous month-end equity, not initial capital. Full-run peak DD separate. Same 0.055%/side fees; no funding settlement or exact maker fills." });
  atomicJson(path.join(dir, "matched-examples.json"), examples); atomicJson(path.join(dir, "screen.json"), screens);
  const receipt = { passed: true, cases: 16, controlsExact: controls, fills, minutes, addChecks, targetChecks, highChecks, checkerSha256, newDefinitions: 2, liveChanges: 0 };
  atomicJson(path.join(dir, "verification.json"), receipt); console.log(JSON.stringify(receipt));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
