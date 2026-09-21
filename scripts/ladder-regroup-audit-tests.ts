import assert from "assert/strict";
import { firstDeepObservations, cohort, episodeMarkAt } from "./hype-ladder-regroup-audit";
const cs = [100, 96, 94, 95].map((close, i) => ({ ts: i * 60000, endTs: (i + 1) * 60000,
  open: close, close, high: close + 1, low: close - 1, volume: 1, turnover: close }));
const p = [{ qty: 1, notional: 100, entryTime: 0 }];
const open = { episode: 1, event: { fillIndex: 0, fillAt: 0 }, before: [], after: p };
const close = { episode: 1, event: { fillIndex: 2, fillAt: 180000 }, before: p, after: [] };
assert.equal(firstDeepObservations(cs, [open], 240000, 1, -3).length, 1, "not repeated minutes");
assert.equal(firstDeepObservations(cs, [open], 240000, 1, -5)[0].at, 180000);
assert.equal(firstDeepObservations(cs, [open], 240000, 2, -3).length, 0, "depth filter");
assert.equal(firstDeepObservations(cs, [open, close], 240000, 1, -5).length, 0, "same-minute resting close already flat");
const reopened = { episode: 2, event: { fillIndex: 3, fillAt: 180000 }, before: [], after: p };
assert.equal(firstDeepObservations(cs, [open, close, reopened], 240000, 1, -3).length, 2, "next-open at same wall boundary belongs to next bar");
assert.throws(() => firstDeepObservations(cs, [open, { ...close, before: [] }], 240000, 1, -3), /inventory continuity/);
assert.deepEqual(cohort([{ outcome: { pnl: 10 } }, { outcome: { pnl: -4 } }, { outcome: null }]),
  { observations: 3, completed: 2, wins: 1, losses: 1, flat: 0, unresolved: 1, winningDollars: 10,
    losingDollars: -4, netCompleted: 6, positiveEpisodeFraction: .5 });
assert.equal(episodeMarkAt({ episode: 1, index: 1, grossPnl: -5, cost: 100, qty: 1, price: 95 }, [], .001), -5.195);
const partial = { episode: 1, event: { kind: "partial", fillIndex: 0, qty: 1, price: 102 },
  before: [{ notional: 200 }], after: [{ notional: 100 }] };
assert(Math.abs(episodeMarkAt({ episode: 1, index: 1, grossPnl: -5, cost: 100, qty: 1, price: 95 }, [partial], .001) - (1.798 - 5.195)) < 1e-12);
assert.equal(episodeMarkAt({ episode: 1, index: 1, grossPnl: -5, cost: 100, qty: 1, price: 95 }, [{ ...partial, event: { ...partial.event, fillIndex: 2 } }], .001), -5.195);
console.log("ladder regroup: 10 fixture checks passed");
