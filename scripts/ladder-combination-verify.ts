/** Independent raw-bar, target, inventory and non-additive comparison audit for L13. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson } from "./research-workflow";
import { prices, lines } from "./hype-failed-recovery-study";
import { auditCombinationAccounting, componentAttribution } from "./ladder-combination-accounting";
import { exposureDelta } from "./ladder-exposure-metrics";
import { auditSoftStalePath } from "./conditional-soft-stale-path-audit";
import { auditDistress } from "./mfi-distress-exit-audit";
import { auditWeekly } from "./mfi-weekly-exit-audit";
import { acceptedSingles } from "./hype-ladder-combination-study";
import type { Candle } from "./hype-freerun-canonical-replay";
type R = Record<string, any>;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
export function highAudit(cs: Candle[], events: R[], x: R, rows: any[], highs: Float64Array) {
  const byIndex = new Map<number, any[]>(rows.map(r => [r[0], r])), pending = new Set<number>();
  for (const e of events) if (e.event.fillAt === cs[e.event.fillIndex].ts) {
    const before = e.event.kind !== "open" && !e.event.reason.startsWith("research_exit:");
    for (let i = e.event.decisionIndex + (before ? 0 : 1); i < e.event.fillIndex; i++) pending.add(i);
  }
  if (x.pendingAtEnd) { const e = x.pendingAtEnd, before = e.kind !== "open" && !e.reason.startsWith("research_exit:");
    for (let i = e.decisionIndex + (before ? 0 : 1); i < x.endIdx; i++) pending.add(i); }
  let ptr = 0, inv: R[] = [], ep = 0, checks = 0; const fires = new Set<number>();
  for (let i = x.startIdx; i < x.endIdx; i++) {
    while (ptr < events.length && events[ptr].event.fillIndex <= i) { const e = events[ptr++]; inv = e.after; ep = e.episode; }
    if (!inv.length) { assert(!byIndex.has(i)); continue; }
    const r = byIndex.get(i); assert(r); assert.equal(r[1], ep); assert.equal(r[2], inv.length); assert.equal(r[3], !pending.has(i));
    const j = i - x.lag / 60000, high = highs[j];
    const fire = !pending.has(i) && cs[i].endTs - Math.min(...inv.map(p => p.entryTime)) >= 14400000
      && high > 0 && Math.max(0, 100 * (1 - cs[i].close / high)) <= 1 + 1e-10;
    assert.equal(r[4], fire); if (fire) fires.add(i); checks++;
  }
  assert.equal(checks, rows.length); let cooldown = 0;
  for (const e of events) {
    const v = e.event;
    if (v.kind === "open") assert(v.decisionAt >= cooldown);
    if (v.reason.startsWith("research_exit:")) { assert.equal(v.kind, "close"); assert(fires.has(v.decisionIndex)); fires.delete(v.decisionIndex); }
    if (v.kind === "close" && !["tp", "stale_tp"].includes(v.reason)) cooldown = (Math.floor(v.fillAt / 14400000) + 2) * 14400000;
  }
  if (x.pendingAtEnd?.reason.startsWith("research_exit:")) fires.delete(x.pendingAtEnd.decisionIndex);
  assert.equal(fires.size, 0); return checks;
}
async function main() {
  const root = path.resolve(__dirname, ".."), dir = jobDirectory(root, process.argv[2]), out = path.join(dir, "output");
  const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8")), load = (f: string) => read(path.join(out, f));
  const plan = read(path.join(dir, "plan.json")), state = read(path.join(dir, "state.json")); assert.equal(state.status, "complete");
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const d = plan.card.definition, cfg = read("bot-config.json"), cs = await prices(Date.parse(d.cutoff), read(`${d.archive}/manifest.json`).repairFile);
  const highs = new Float64Array(cs.length), prefix = new Float64Array(cs.length), suffix = new Float64Array(cs.length), w = 2880;
  for (let i = 0; i < cs.length; i++) prefix[i] = i % w ? Math.max(prefix[i - 1], cs[i].high) : cs[i].high;
  for (let i = cs.length - 1; i >= 0; i--) suffix[i] = i === cs.length - 1 || (i + 1) % w === 0 ? cs[i].high : Math.max(suffix[i + 1], cs[i].high);
  const bytes = fs.readFileSync(path.join(out, "high-2d.i32")); assert.equal(bytes.length, cs.length * 4);
  for (let i = 0; i < cs.length; i++) { const j = bytes.readInt32LE(4 * i); if (i < w - 1) { assert.equal(j, -1); continue; }
    highs[i] = Math.max(suffix[i - w + 1], prefix[i]); assert(j >= i - w + 1 && j <= i); assert.equal(cs[j].high, highs[i]); }
  const accepted = acceptedSingles(d, read), rows: R[] = load("results.json"), comps: R[] = load("comparisons.json"); assert.equal(rows.length, 86);
  let fills = 0, minutes = 0, controls = 0, sizeChecks = 0, targetChecks = 0, highChecks = 0, mfiChecks = 0;
  for (const x of rows) {
    const events: any[] = []; await lines(path.join(out, `${x.name}-inventory.jsonl`), e => events.push(e));
    const half = x.legs.includes("last11_50"), mfi = x.legs.includes("mfi_weekly_half"), high = x.legs.includes("exit_2d_1pct"), age = x.legs.includes("age8"), noStale = x.legs.includes("minus_soft_stale");
    const accounting = auditCombinationAccounting(cs, events, x.metrics, x.startIdx, x.endIdx, d.initialEquity, d.feeRate, { fraction: mfi ? .5 : 1, fillDelayMs: 0 }, half);
    assert.deepEqual(accounting, x.accounting); fills += events.length; minutes += accounting.independentMinutes;
    const targets: R[] = load(`${x.name}-targets.json`), obs: R[] = load(`${x.name}-tp-observations.json`);
    const audit = auditSoftStalePath(cs, events, targets, obs, { ...x, control: !age, policy: { id: noStale ? "minus_soft_stale" : age ? "age8" : "baseline", family: "age" }, sensitivity: { sourceLagMs: 0, releaseDelayMs: 0 } }, {}, cfg, {});
    targetChecks += audit.checks;
    let ptr = 0, inv: R[] = [], ep = 0;
    const sizes: R[] = load(`${x.name}-sizes.json`), permits = new Map<number, R>();
    for (const s of sizes) {
      while (ptr < events.length && events[ptr].event.fillIndex <= s.index) { const e = events[ptr++]; inv = e.after; ep = e.episode; }
      assert.equal(s.at, cs[s.index].endTs); assert.equal(s.price, cs[s.index].close); assert.equal(s.nextDepth, inv.length + 1); assert.equal(s.episode, inv.length ? ep : ep + 1);
      near(s.requestedNotional, 800 * 1.35 ** inv.length); near(s.approvedNotional, s.requestedNotional * (half && inv.length === 10 ? .5 : 1));
      near(s.entryCostNotional, inv.reduce((n, p) => n + p.notional, 0)); near(s.qty, inv.reduce((n, p) => n + p.qty, 0));
      permits.set(s.index, s); sizeChecks++;
    }
    for (const e of events.filter(e => e.event.kind === "open")) { const s = permits.get(e.event.decisionIndex); assert(s); near(e.event.qty * e.event.price, s.approvedNotional); }
    for (const e of events.filter(e => e.event.kind === "close" && ["tp", "stale_tp"].includes(e.event.reason))) {
      const v = e.event, t = targets.filter(t => t.episode === e.episode && t.armedIndex <= v.decisionIndex).at(-1); assert(t);
      assert.equal(v.reason, t.pct < 1.4 ? "stale_tp" : "tp");
      if (v.fillAt === cs[v.fillIndex].endTs) { assert.equal(v.decisionIndex, t.armedIndex); near(v.price, t.targetPrice); assert(t.armedIndex < v.fillIndex); }
      else { assert(t.armedIndex < v.decisionIndex); assert(cs[v.decisionIndex].close >= t.targetPrice); }
    }
    if (mfi) {
      const o = load(`${x.name}-cut-observations.json`), policy = { id: "mfi_weekly_half", fraction: .5, mfiRequired: true, weeklyRequired: true };
      mfiChecks += auditDistress(cs, events, o, policy, Date.parse(x.end), x.lag, 0).checkedMfi;
      auditWeekly(cs, o, policy, x.lag);
    }
    if (high) highChecks += highAudit(cs, events, x, load(`${x.name}-high-reductions.json`), highs);
    if (x.phase === "archived_control") {
      const a = accepted.find(a => a.policy === x.policy && a.model === x.model)!; assert.equal(x.digest, a.digest); assert.deepEqual(x.metrics, a.metrics); controls++;
    }
    if (x.policy !== "baseline") {
      const b = rows.find(b => b.policy === "baseline" && b.model === x.model && Date.parse(b.end) === Date.parse(x.end))!, c = comps.find(c => c.name === x.name)!;
      assert.deepEqual(c.delta, exposureDelta(x.metrics, b.metrics)); assert.deepEqual(c.attribution, componentAttribution(x.metrics, b.metrics));
      if (x.legs.length === 2) { let additive = 0;
        for (const p of x.legs) { const peer = rows.find(y => y.primary && y.policy === p && y.model === x.model)!, v = c.versusParts.find((v: R) => v.policy === p);
          assert.deepEqual(v.delta, exposureDelta(x.metrics, peer.metrics)); assert.deepEqual(v.attribution, componentAttribution(x.metrics, peer.metrics)); additive += peer.metrics.totalPnl - b.metrics.totalPnl; }
        near(c.interactionNet, x.metrics.totalPnl - b.metrics.totalPnl - additive);
      }
    }
  }
  assert.equal(controls, 28); assert.equal(rows.filter(x => x.primary).length, 60);
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const verification = { passed: true, economicCases: rows.length, controlsExact: controls, fills, minutes, sizeChecks, targetChecks, highChecks, mfiChecks, newTradingDefinitions: 8, liveChanges: 0 };
  atomicJson(path.join(dir, "verification.json"), verification); console.log(JSON.stringify(verification));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
