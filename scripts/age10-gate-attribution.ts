/** Ex-post bookkeeping, not a trading filter. Never feeds decisions or selects more variants. */
import assert from "assert/strict";
import { componentAttribution } from "./ladder-combination-accounting";
import { exposureDelta } from "./ladder-exposure-metrics";
import { PARENT, AGGRESSIVE, VARIANTS, type R } from "./age10-gate-policy";
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6);
const sum = (xs: R[], k: string) => xs.reduce((n, x) => n + x[k], 0);
function summarize(xs: R[]) {
  const completed = xs.filter(x => x.pnl !== null);
  return { episodes: xs.length, completed: completed.length, wins: completed.filter(x => x.pnl > 0).length,
    losses: completed.filter(x => x.pnl < 0).length, winDollars: completed.reduce((n, x) => n + Math.max(0, x.pnl), 0),
    lossDollars: completed.reduce((n, x) => n + Math.min(0, x.pnl), 0), net: sum(completed, "pnl"),
    extraOpens: sum(xs, "extraOpens"), directDeepAdds: sum(xs, "directDeepAdds"), directHotAdds: sum(xs, "directHotAdds") };
}
export function attribution(rows: R[], events: (name: string) => R[], contexts: (name: string) => R[]) {
  const primary = rows.filter(x => x.primary), analyses: R[] = [];
  function episodes(x: R) {
    const map = new Map<number, R>(), entries = new Map(contexts(x.name).map(c => [c.index, c]));
    for (const e of events(x.name)) {
      let ep = map.get(e.episode);
      if (!ep) { assert.equal(e.event.kind, "open"); ep = { entry: new Date(e.event.fillAt).toISOString(), opens: [] }; map.set(e.episode, ep); }
      if (e.event.kind === "open") {
        const c = entries.get(e.event.decisionIndex); assert(c);
        ep.opens.push({ key: `${e.event.fillAt}|${e.after.length}|${(e.event.qty * e.event.price).toFixed(6)}`, ...c,
          fillAt: e.event.fillAt, fillPrice: e.event.price, notional: e.event.qty * e.event.price });
      }
    }
    const closed = new Map(x.metrics.episodes.map((e: R) => [e.entry, e]));
    return new Map([...map.values()].map(ep => [ep.entry, { ...ep, ...(closed.get(ep.entry) as R ?? { pnl: null, close: null, reason: "unfinished" }) }]));
  }
  for (const x of primary.filter(x => x.policy === AGGRESSIVE || VARIANTS.some(v => v.id === x.policy))) {
    const refs = [...new Set(["baseline", PARENT, x.spec.ageHours === 8 ? "age8__exit_2d_1pct" : PARENT, AGGRESSIVE])].filter(id => id !== x.policy);
    const vm = episodes(x);
    for (const id of refs) {
      const b = primary.find(b => b.policy === id && b.model === x.model)!; assert(b);
      const bm = episodes(b), detail: R[] = [];
      for (const [entry, v] of vm) {
        const p = bm.get(entry), priorKeys = new Set(p?.opens.map((o: R) => o.key) ?? []), extra = v.opens.filter((o: R) => !priorKeys.has(o.key));
        const direct = extra.filter((o: R) => o.deepWouldBlock || o.hotWouldBlock);
        detail.push({ entry, close: v.close, reason: v.reason, depth: v.depth ?? null, pnl: v.pnl, peerPnl: p?.pnl ?? null,
          sameEntry: !!p, delta: v.pnl !== null && p?.pnl != null ? v.pnl - p.pnl : null,
          extraOpens: extra.length, directDeepAdds: direct.filter((o: R) => o.deepWouldBlock).length,
          directHotAdds: direct.filter((o: R) => o.hotWouldBlock).length, extras: extra });
      }
      const common = detail.filter(x => x.pnl !== null && x.peerPnl !== null), replacement = detail.filter(x => x.pnl !== null && x.peerPnl === null);
      // Match the published completed-episode identity, even if a peer episode remains unfinished.
      const a = componentAttribution(x.metrics, b.metrics), removed = b.metrics.episodes.filter((e: R) => !x.metrics.episodes.some((v: R) => v.entry === e.entry));
      near(sum(common, "delta"), a.matchedDelta); near(sum(replacement, "pnl"), a.replacementNet); near(sum(removed, "pnl"), a.removedNet);
      analyses.push({ name: x.name, policy: x.policy, model: x.model, peer: id, accounting: a, delta: exposureDelta(x.metrics, b.metrics),
        common: summarize(common), replacement: summarize(replacement), removed: { episodes: removed.length, net: a.removedNet,
          wins: removed.filter((e: R) => e.pnl > 0).length, losses: removed.filter((e: R) => e.pnl < 0).length },
        directGateAssociated: summarize(detail.filter(x => x.directDeepAdds || x.directHotAdds)),
        monthlyDirectGateAssociated: [...new Set(detail.filter(x => x.close).map(x => x.close.slice(0, 7)))].sort().map(month => ({ month,
          ...summarize(detail.filter(x => x.close?.startsWith(month) && (x.directDeepAdds || x.directHotAdds))) })),
        detail, removedEpisodes: removed,
        warning: "Same-path guard counterfactuals and episode association, NOT marginal causal PnL per add; downstream occupancy and partials differ." });
    }
  }
  const factorial = [...new Set(primary.map(x => x.model))].map(model => {
    const net = (age: number, deep: boolean, hot: boolean) => {
      const x = primary.find(x => x.model === model && x.spec.days === 2 && x.spec.ageHours === age &&
        x.spec.legs.includes("minus_deep_stress") === deep && x.spec.legs.includes("minus_tp_cooldown") === hot); assert(x); return x.metrics.totalPnl;
    };
    const at = (age: number) => ({ age, safeguarded: net(age, false, false), deepOnly: net(age, true, false), hotOnly: net(age, false, true), both: net(age, true, true),
      interaction: net(age, true, true) - net(age, true, false) - net(age, false, true) + net(age, false, false) });
    const a = at(8), b = at(10);
    return { model, age8: a, age10: b, threeWayInteraction: b.interaction - a.interaction,
      ageBenefit: { guarded: b.safeguarded - a.safeguarded, deepOnly: b.deepOnly - a.deepOnly, hotOnly: b.hotOnly - a.hotOnly, both: b.both - a.both } };
  });
  return { analyses, factorial };
}
