/** Independent checkpoint, raw MFI, allocation and cooldown audit. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
import type { ExitObservation, ExitPolicy } from "./mfi-distress-exit-policy";
import { firstDeepObservations } from "./hype-ladder-regroup-audit";
const M = 60000, TF = 30 * M;
export function auditDistress(cs: Candle[], events: ResearchInventoryEvent[], observations: ExitObservation[], policy: ExitPolicy,
  endAt: number, lag: number, delay: number) {
  const first = firstDeepObservations(cs, events, endAt, 9, -3);
  assert.deepEqual(observations.map(o => [o.episode, o.firstAt]), first.map(o => [o.episode, o.at]), "independent first-distress path");
  let checkedMfi = 0;
  for (const o of observations) {
    assert.equal(o.dueAt, o.firstAt + 60 * M);
    if (o.mfi) {
      const end = Math.floor((o.dueAt - lag) / TF) * TF, totals: Array<{ typical: number; volume: number }> = [];
      for (let k = 15; k > 0; k--) {
        const start = end - k * TF, from = (start - cs[0].ts) / M, bars = cs.slice(from, from + 30);
        assert.equal(bars.length, 30); assert.equal(bars[0].ts, start); assert.equal(bars.at(-1)!.endTs, start + TF);
        const high = Math.max(...bars.map(b => b.high)), low = Math.min(...bars.map(b => b.low));
        totals.push({ typical: (high + low + bars[29].close) / 3, volume: bars.reduce((n, b) => n + b.volume, 0) });
      }
      let positive = 0, negative = 0;
      for (let k = 1; k < totals.length; k++) { const t = totals[k], previous = totals[k - 1];
        if (t.typical > previous.typical) positive += t.typical * t.volume;
        else if (t.typical < previous.typical) negative += t.typical * t.volume;
      }
      const v = positive + negative ? 100 * positive / (positive + negative) : null;
      if (v === null) assert.equal(o.mfi.value, null); else assert(Math.abs(o.mfi.value! - v) < 1e-7, `MFI ${o.dueAt}: ${o.mfi.value} vs ${v}`);
      assert.equal(o.mfi.sourceEnd, end); assert.equal(o.mfi.availableAt, end + lag); assert(end + lag <= o.dueAt); checkedMfi++;
    }
    if (o.status === "scheduled") { assert(policy.fraction > 0); assert.equal(o.at, o.dueAt); assert(o.depth! >= 9);
      if (policy.mfiRequired) assert(o.mfi?.value != null && o.mfi.value <= 20); }
  }
  const scheduled = observations.filter(o => o.status === "scheduled"), actual = events.filter(e => e.event.reason.startsWith("research_exit:"));
  const locks = new Set<number>(); let cooldown = 0;
  for (const e of events) {
    const x = e.event;
    if (x.kind === "open") { assert(!locks.has(e.episode), "cannot rebuild after experimental partial, even after S/R"); assert(x.fillAt! >= cooldown, "forced-exit cooldown"); }
    if (x.reason.startsWith("research_exit:")) {
      assert(scheduled.some(o => o.episode === e.episode && o.at === x.decisionAt));
      assert.equal(x.fillAt, x.decisionAt + delay); assert.equal(x.kind, policy.fraction === 1 ? "close" : "partial");
      assert(Math.abs(x.qty - e.before.reduce((n, p) => n + p.qty, 0) * policy.fraction) < 1e-7);
      if (x.kind === "partial") locks.add(e.episode);
    }
    if (x.kind === "close" && !["tp", "stale_tp"].includes(x.reason)) cooldown = (Math.floor(x.fillAt! / (240 * M)) + 2) * 240 * M;
  }
  return { firstDistress: first.length, checkedMfi, scheduled: scheduled.length, executed: actual.length,
    withoutExperimentalFill: scheduled.filter(o => !actual.some(e => e.episode === o.episode && e.event.decisionAt === o.at)).map(o => ({ episode: o.episode, at: o.at })),
    afterJuly15: actual.filter(e => e.event.decisionAt >= Date.UTC(2026, 6, 15)).length,
    statusCounts: observations.reduce((n: Record<string, number>, o) => { n[o.status] = (n[o.status] ?? 0) + 1; return n; }, {}) };
}
