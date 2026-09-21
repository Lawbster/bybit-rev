// L14 independent extension: configured age cap; reset arms on every inventory mutation.
// Original L13 economic/audit sources are preserved unchanged.
/** Independent reconstruction of every target-policy opportunity from the event ledger.
 * Future recorded fills identify which already-recorded ordinary action had priority;
 * this is verification, never a strategy input. Does not import the F06 controller.
 */
import assert from "assert/strict";
import { ReplaySrContext } from "./replay-sr-context";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
type R = Record<string, any>;
function last(xs: R[], at: number) { let l = 0, h = xs.length; while (l < h) { const m = (l + h) >>> 1; if (xs[m].endTs <= at) l = m + 1; else h = m; } return xs[l - 1] ?? null; }
export function auditAgeHighTargets(cs: Candle[], events: ResearchInventoryEvent[], targets: R[], observations: R[], x: R, spec: R, cfg: R, tape: R, onArm?: (t: R) => void) {
  const scheduledClose = new Set(events.filter(e => e.event.kind === "close" && !e.event.reason.startsWith("research_exit:") && e.event.fillAt === cs[e.event.fillIndex!].ts).map(e => e.event.decisionIndex));
  if (x.pendingAtEnd?.kind === "close" && !x.pendingAtEnd.reason.startsWith("research_exit:")) scheduledClose.add(x.pendingAtEnd.decisionIndex);
  const afterArmQuiesce = new Set(events.filter(e => e.event.kind === "partial" || e.event.kind === "close" && e.event.reason.startsWith("research_exit:")).map(e => e.event.decisionIndex));
  if (x.pendingAtEnd?.kind === "partial" || x.pendingAtEnd?.kind === "close" && x.pendingAtEnd.reason.startsWith("research_exit:")) afterArmQuiesce.add(x.pendingAtEnd.decisionIndex);
  let activeArm: R | null = null;
  const sr = x.policy.family === "resistance" ? new ReplaySrContext(cs, cfg.srShadow) : null;
  let boundary = -Infinity, eventAt = 0, targetAt = 0, inv: ResearchInventoryEvent["after"] = [], ep = -1, stateEp = -1;
  let phase: "unseen" | "extending" | "releasing" | "released" = "unseen", releaseAt = Infinity;
  const transitions: R[] = [], counts = { checks: 0, eligibleChecks: 0, deferredChecks: 0, unknownChecks: 0 };
  function context(at: number, price: number, normalTarget: number) {
    if (x.policy.family === "age") return { healthy: true, allowed: true };
    const sourceAt = at - x.sensitivity.sourceLagMs;
    if (x.policy.family === "structure") {
      const f = last(tape.structure, sourceAt), healthy = !!f?.healthy && sourceAt - f.endTs < 14400000;
      return { healthy, allowed: healthy && f.close >= f.ema200 && f.ema50 >= f.ema50Prev };
    }
    if (x.policy.family === "vwap") {
      const f = last(tape.vwap, sourceAt), healthy = !!f?.healthy && sourceAt - f.endTs < 3600000;
      return { healthy, allowed: healthy && f.close > f.vwap && f.roc5 > 0 };
    }
    const grid = Math.floor(sourceAt / 1800000) * 1800000;
    if (grid > boundary) { sr!.at(grid); boundary = grid; }
    const c = sr!.at(sourceAt), levels = c.engine.getZones(sourceAt).filter(l => l.price > price);
    let nearest = Infinity; for (const l of levels) nearest = Math.min(nearest, l.price);
    const healthy = c.coverage.healthy && Number.isFinite(nearest);
    return { healthy, allowed: healthy && nearest >= normalTarget * 1.001 };
  }
  for (let i = x.startIdx; i < x.endIdx; i++) {
    const c = cs[i], at = c.endTs;
    while (eventAt < events.length && events[eventAt].event.fillIndex! <= i) { inv = events[eventAt].after; ep = events[eventAt].episode; activeArm = null; eventAt++; }
    if (!inv.length || scheduledClose.has(i)) { activeArm = null; continue; }
    while (targetAt + 1 < targets.length && targets[targetAt + 1].index <= i) targetAt++;
    const actual = targets[targetAt]; assert(actual && actual.index <= i && actual.episode === ep, `missing active target at ${at}`);
    const qty = inv.reduce((n, p) => n + p.qty, 0), avg = inv.reduce((n, p) => n + p.entryPrice * p.qty, 0) / qty;
    const age = (at - Math.min(...inv.map(p => p.entryTime))) / 3600000;
    const eligible = x.policy.id !== "minus_soft_stale" && age >= 4 && (c.close - avg) / avg * 100 < .5;
    const base = eligible ? .5 : 1.4;
    let defer = false;
    if (!x.control) {
      counts.checks++; if (eligible) counts.eligibleChecks++;
      if (stateEp !== ep) { stateEp = ep; phase = "unseen"; releaseAt = Infinity; }
      const log = (status: string, release?: number) => transitions.push({ status, at, episode: ep, ...(release === undefined ? {} : { releaseAt: release }) });
      if (phase === "releasing") {
        if (at < releaseAt) defer = true;
        else { phase = "released"; log("released", releaseAt); }
      } else if (phase !== "released" && (phase === "extending" || eligible)) {
        const q = age >= x.spec.ageHours ? { healthy: true, allowed: false } : context(at, c.close, avg * 1.014);
        if (!q.healthy) counts.unknownChecks++;
        if (q.healthy && q.allowed) {
          if (phase === "unseen") { log("extended"); phase = "extending"; }
          defer = true;
        } else if (phase === "unseen") { log("refused"); phase = "released"; }
        else {
          releaseAt = at + x.sensitivity.releaseDelayMs; log("release_requested", releaseAt);
          phase = at < releaseAt ? "releasing" : "released"; defer = at < releaseAt;
        }
      }
      if (defer) counts.deferredChecks++;
    }
    const expectedPct = defer ? 1.4 : base;
    assert.equal(actual.pct, expectedPct, `target policy at ${at}/${x.name}`);
    assert(Math.abs(actual.targetPrice - avg * (1 + expectedPct / 100)) < 1e-8, `inventory target at ${at}`);
    const price = avg * (1 + expectedPct / 100);
    if (!activeArm || activeArm.episode !== ep || activeArm.pct !== expectedPct || activeArm.targetPrice !== price) {
      activeArm = { episode: ep, pct: expectedPct, targetPrice: price, armedAt: at, armedIndex: i };
      onArm?.(activeArm);
    }
    if (afterArmQuiesce.has(i)) activeArm = null;
  }
  const projected = observations.map(o => ({ status: o.status, at: o.at, episode: o.episode, ...(["released", "release_requested"].includes(o.status) ? { releaseAt: o.releaseAt } : {}) }));
  assert.deepEqual(transitions, projected, "first eligibility and first release must match the complete minute path");
  if (!x.control) for (const k of Object.keys(counts)) assert.equal(counts[k as keyof typeof counts], x.audit[k], k);
  return counts;
}


/** Independent block-prefix/suffix maxima; different algorithm from worker deque. */
export function rawHighs(cs: Candle[], days: number): Float64Array {
  const w = days * 1440, prefix = new Float64Array(cs.length), suffix = new Float64Array(cs.length), out = new Float64Array(cs.length);
  for (let i = 0; i < cs.length; i++) {
    assert(cs[i].endTs === cs[i].ts + 60000 && (!i || cs[i].ts === cs[i - 1].endTs));
    prefix[i] = i % w ? Math.max(prefix[i - 1], cs[i].high) : cs[i].high;
  }
  for (let i = cs.length - 1; i >= 0; i--) suffix[i] = i === cs.length - 1 || (i + 1) % w === 0 ? cs[i].high : Math.max(suffix[i + 1], cs[i].high);
  for (let i = w - 1; i < cs.length; i++) out[i] = Math.max(suffix[i - w + 1], prefix[i]);
  return out;
}
export function auditAgeHighExits(cs: Candle[], events: R[], x: R, rows: any[], highs: Float64Array) {
  const byIndex = new Map<number, any[]>(rows.map(r => [r[0], r])); assert.equal(byIndex.size, rows.length);
  const pending = new Set<number>();
  for (const e of events) if (e.event.fillAt === cs[e.event.fillIndex].ts) {
    const before = e.event.kind !== "open" && !e.event.reason.startsWith("research_exit:");
    for (let i = e.event.decisionIndex + (before ? 0 : 1); i < e.event.fillIndex; i++) pending.add(i);
  }
  if (x.pendingAtEnd) {
    const e = x.pendingAtEnd, before = e.kind !== "open" && !e.reason.startsWith("research_exit:");
    for (let i = e.decisionIndex + (before ? 0 : 1); i < x.endIdx; i++) pending.add(i);
  }
  let ptr = 0, inv: R[] = [], ep = 0, checks = 0; const fires = new Set<number>();
  for (let i = x.startIdx; i < x.endIdx; i++) {
    while (ptr < events.length && events[ptr].event.fillIndex <= i) { const e = events[ptr++]; inv = e.after; ep = e.episode; }
    if (!inv.length) { assert(!byIndex.has(i)); continue; }
    const r = byIndex.get(i); assert(r); assert.equal(r[1], ep); assert.equal(r[2], inv.length); assert.equal(r[3], !pending.has(i));
    const high = highs[i - x.lag / 60000];
    const fire = !pending.has(i) && cs[i].endTs - Math.min(...inv.map(p => p.entryTime)) >= x.spec.exitAgeHours * 3600000
      && high > 0 && Math.max(0, 100 * (1 - cs[i].close / high)) <= x.spec.proximityPct + 1e-10;
    assert.equal(r[4], fire, `high permission ${x.name}/${i}`); if (fire) fires.add(i); checks++;
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

