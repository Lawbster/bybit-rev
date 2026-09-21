/** Read-only inventory replay audit; outcome annotations never feed decisions. */
import assert from "assert/strict";
import { allocatedForCumulative, buildSelectedIdsAllocation } from "../src/bot/partial-close-transaction";
import { calcAddSize } from "../src/bot/strategy";
import type { BotConfig } from "../src/bot/bot-config";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
import type { ExposureMetrics } from "./ladder-exposure-metrics";
import { freshLadderCost } from "./ladder-sizing-policy";
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
export function auditInventory(events: readonly ResearchInventoryEvent[], cfg: BotConfig, metrics: ExposureMetrics, legacy = false) {
  const episodes = new Map<number, { episode: number; entry: string; partials: number; postPartialAdds: number; peakCost: number;
    inflatedAfterPartial: boolean; maxCountInflation: number; exceededFresh11: boolean; last: ResearchInventoryEvent }>();
  let previous: ResearchInventoryEvent | undefined, clock = 0, partials = 0, affectedClocks = 0;
  const partialRows: any[] = [];
  for (const x of events) {
    if (previous) assert.deepEqual(x.before, previous.after, "inventory continuity");
    assert(x.event.fillIndex! > x.event.decisionIndex && x.event.fillAt! >= x.event.decisionAt);
    const before = x.before.map(p => ({ ...p })), after = x.after.map(p => ({ ...p }));
    if (x.event.kind === "open") {
      assert.equal(after.length, before.length + 1);
      assert.deepEqual(after.slice(0, -1), before);
      near(after.at(-1)!.qty, x.event.qty); near(after.at(-1)!.entryPrice, x.event.price!);
      near(after.at(-1)!.notional, x.event.qty * x.event.price!);
      clock = x.event.fillAt!;
    } else if (x.event.kind === "partial") {
      partials++;
      const keep = cfg.srPartialExitAction!.keepRungs;
      assert.equal(after.length, keep);
      const selected = before.map((p, i) => ({ p, i, pnl: (x.decisionPrice - p.entryPrice) * p.qty }))
        .sort((a, b) => b.pnl - a.pnl).slice(0, before.length - keep).map(x => x.p.id);
      const allocation = buildSelectedIdsAllocation(before, selected);
      const total = allocation.targets.reduce((v, p) => v + p.preQty, 0);
      near(total, x.event.qty);
      const slices = allocatedForCumulative(allocation, total);
      const reductions = new Map(slices.map(x => [x.positionId, x.closeQty]));
      const liveRemaining = before.map(p => {
        const q = reductions.get(p.id) ?? 0;
        return { ...p, qty: p.qty - q, notional: p.notional - p.notional * q / p.qty };
      }).filter(p => p.qty > 1e-7 && p.notional > .01);
      assert.deepEqual(liveRemaining.map(p => p.id), after.map(p => p.id), "production selected-ID allocator");
      for (const [i, p] of liveRemaining.entries()) { near(p.qty, after[i].qty); near(p.notional, after[i].notional); }
      const reanchored = Math.max(...after.map(p => p.entryTime));
      if (reanchored !== clock) affectedClocks++;
      partialRows.push({ episode: x.episode, at: x.event.fillAt, iso: new Date(x.event.fillAt!).toISOString(),
        preDepth: before.length, remainingDepth: after.length, remainingLevels: after.map(p => p.level),
        remainingCost: after.reduce((v, p) => v + p.notional, 0), freshSameDepthCost: freshLadderCost(after.length, cfg.basePositionUsdt, cfg.addScaleFactor),
        transactionalLastAdd: clock, legacyLastAdd: reanchored, legacyAdvanceMin: (clock - reanchored) / 60000,
        nextRequestedSize: calcAddSize(after.length, cfg.basePositionUsdt, cfg.addScaleFactor) });
      if (legacy) clock = reanchored;
    } else {
      assert.equal(x.event.kind, "close"); assert.equal(after.length, 0);
      near(before.reduce((v, p) => v + p.qty, 0), x.event.qty); clock = 0;
    }
    assert.equal(x.lastAddTime, clock, "actual transactional add clock");
    let ep = episodes.get(x.episode);
    if (!ep) {
      assert.equal(x.event.kind, "open");
      ep = { episode: x.episode, entry: new Date(x.event.fillAt!).toISOString(), partials: 0, postPartialAdds: 0, peakCost: 0,
        inflatedAfterPartial: false, maxCountInflation: 0, exceededFresh11: false, last: x }; episodes.set(x.episode, ep);
    }
    if (x.event.kind === "partial") ep.partials++;
    if (x.event.kind === "open" && ep.partials > 0) ep.postPartialAdds++;
    const cost = after.reduce((v, p) => v + p.notional, 0), fresh = freshLadderCost(after.length, cfg.basePositionUsdt, cfg.addScaleFactor);
    ep.peakCost = Math.max(ep.peakCost, cost);
    ep.maxCountInflation = Math.max(ep.maxCountInflation, cost - fresh);
    if (ep.partials && cost > fresh + .01) ep.inflatedAfterPartial = true;
    if (cost > freshLadderCost(11, cfg.basePositionUsdt, cfg.addScaleFactor) + .01) ep.exceededFresh11 = true;
    ep.last = x; previous = x;
  }
  const outcomes = new Map(metrics.episodes.map(e => [e.entry, e]));
  const rows = [...episodes.values()].map(({ last, ...e }) => ({ ...e, outcome: outcomes.get(e.entry) ?? null,
    durationHours: outcomes.has(e.entry) ? (Date.parse(outcomes.get(e.entry)!.close) - Date.parse(e.entry)) / 3600000 : null }));
  near(rows.reduce((v, e) => Math.max(v, e.peakCost), 0), metrics.maxNotional);
  const cohort = (xs: typeof rows) => ({ episodes: xs.length, completed: xs.filter(e => e.outcome).length,
    wins: xs.filter(e => e.outcome && e.outcome.pnl > 0).length, losses: xs.filter(e => e.outcome && e.outcome.pnl < 0).length,
    forced: xs.filter(e => e.outcome && !["tp", "stale_tp"].includes(e.outcome.reason)).length,
    grossWin: xs.reduce((v, e) => v + Math.max(0, e.outcome?.pnl ?? 0), 0),
    grossLoss: -xs.reduce((v, e) => v + Math.min(0, e.outcome?.pnl ?? 0), 0),
    maxCost: xs.reduce((v, e) => Math.max(v, e.peakCost), 0) });
  return { partials, affectedClocks, allocationParity: true, clockParity: true,
    all: cohort(rows), withPartial: cohort(rows.filter(e => e.partials)), withoutPartial: cohort(rows.filter(e => !e.partials)),
    inflated: cohort(rows.filter(e => e.inflatedAfterPartial)), exceedsFresh11: cohort(rows.filter(e => e.exceededFresh11)),
    postPartialAdds: rows.reduce((v, e) => v + e.postPartialAdds, 0), partialRows, episodes: rows };
}
