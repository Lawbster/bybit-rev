/** Independent cash/inventory/minute ledger; no engine or production policy imports. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./aggressive10-release-maker-engine";
import type { ExposureMetrics } from "./ladder-exposure-metrics";
const near = (a: number, b: number) => assert(Math.abs(a - b) < 2e-6, `${a} != ${b}`);
export function auditMaker(candles: Candle[], events: ResearchInventoryEvent[], metrics: ExposureMetrics,
  start: number, end: number, capital: number, rates: { entry: number; marketExit: number; makerExit: number }, share: number | null, highDelay = 0) {
  let inventory: ResearchInventoryEvent["after"] = [], at = 0, realized = 0, episodeNet = 0;
  let fees = 0, paidEntry = 0, exitFees = 0, turnover = 0, makerNotional = 0, marketNotional = 0;
  let peak = capital, minimum = capital, dd = 0, lastAdd = 0, makerPrefixes = 0, makerCloses = 0;
  let fallbackAfter: number | null = null;
  const byClose = new Map(metrics.episodes.map(e => [Date.parse(e.close), e]));
  const monthly = new Map<string, { equity: number; realized: number }>();
  const counts: Record<string, number> = {};
  function settle(x: ResearchInventoryEvent) {
    assert.deepEqual(inventory, x.before); const e = x.event, c = candles[e.fillIndex!];
    assert(e.fillIndex! > e.decisionIndex); assert.equal(e.decisionAt, candles[e.decisionIndex].endTs);
    assert(e.fillAt === c.ts || e.fillAt === c.endTs);
    if (e.fillAt === c.ts) {
      near(e.price!, c.open); assert.equal(e.fillIndex, e.decisionIndex + 1 + (e.reason.startsWith("research_exit:") ? highDelay / 60000 : 0));
    } else {
      assert(["tp", "stale_tp", "maker_tp_prefix"].includes(e.reason)); assert(e.price! <= c.high); assert(e.decisionAt <= c.ts);
    }
    if (fallbackAfter !== null) { assert.equal(e.kind, "close"); assert.equal(e.fillIndex, fallbackAfter + 1); assert.equal(e.fillAt, c.ts); fallbackAfter = null; }
    turnover += e.qty * e.price!; counts[e.reason] = (counts[e.reason] ?? 0) + 1;
    if (e.kind === "open") {
      assert.equal(x.after.length, inventory.length + 1); assert.deepEqual(x.after.slice(0, -1), inventory);
      near(e.qty * e.price!, 800 * 1.35 ** inventory.length); near(x.after.at(-1)!.qty, e.qty);
      near(x.after.at(-1)!.notional, e.qty * e.price!); lastAdd = e.fillAt!; paidEntry += e.qty * e.price! * rates.entry;
    } else {
      const rate = e.executionMode === "maker" ? rates.makerExit : rates.marketExit;
      near(e.exitFeeRate ?? rates.marketExit, rate);
      if (e.executionMode === "maker") { assert(share !== null && share > 0); makerNotional += e.qty * e.price!; }
      else marketNotional += e.qty * e.price!;
      exitFees += e.qty * e.price! * rate;
      let removedQty = 0;
      for (const p of inventory) {
        const rest = x.after.find(a => a.id === p.id), removed = p.qty - (rest?.qty ?? 0);
        assert(removed >= -1e-10 && removed <= p.qty + 1e-10); removedQty += removed;
        const fee = removed * (p.entryPrice * rates.entry + e.price! * rate);
        const net = removed * (e.price! - p.entryPrice) - fee;
        fees += fee; realized += net; episodeNet += net;
        if (rest) { near(rest.notional, rest.qty * p.entryPrice); assert.equal(rest.entryTime, p.entryTime); }
      }
      near(removedQty, e.qty);
      if (e.kind === "close") {
        assert.equal(x.after.length, 0); const outcome = byClose.get(e.fillAt!); assert(outcome); near(outcome.pnl, episodeNet);
        episodeNet = 0; lastAdd = 0; if (e.executionMode === "maker") makerCloses++;
      } else if (e.reason === "maker_tp_prefix") {
        assert.equal(e.kind, "partial"); assert.equal(x.after.length, inventory.length); assert(share !== null && share > 0 && share < 1);
        x.after.forEach((p, i) => { assert.equal(p.id, inventory[i].id); near(p.qty, inventory[i].qty * (1 - share!)); });
        fallbackAfter = e.fillIndex!; makerPrefixes++;
      } else { assert.equal(e.reason, "sr_partial"); assert.equal(x.after.length, 3); }
    }
    assert.equal(x.lastAddTime, lastAdd); inventory = x.after;
  }
  const open = (price: number) => inventory.reduce((n, p) => n + p.qty * (price - p.entryPrice) - p.qty * (p.entryPrice * rates.entry + price * rates.marketExit), 0);
  function mark(price: number) {
    const equity = capital + realized + open(price); peak = Math.max(peak, equity); minimum = Math.min(minimum, equity);
    dd = Math.max(dd, (peak - equity) / peak * 100); return equity;
  }
  for (let i = start; i < end; i++) {
    const c = candles[i];
    while (events[at]?.event.fillIndex === i && events[at].event.fillAt === c.ts) settle(events[at++]);
    mark(c.low);
    while (events[at]?.event.fillIndex === i) settle(events[at++]);
    monthly.set(new Date(c.endTs).toISOString().slice(0, 7), { equity: mark(c.close), realized });
  }
  assert.equal(at, events.length); if (fallbackAfter !== null) assert.equal(fallbackAfter, end - 1);
  const finalPrice = candles[end - 1].close;
  near(realized, metrics.realized); near(open(finalPrice), metrics.openPnl); near(minimum, metrics.minEquity); near(dd, metrics.maxDrawdownPct);
  near(episodeNet, metrics.unfinishedPartialPnl);
  let prior = capital, priorRealized = 0;
  for (const m of metrics.monthly) { const independent = monthly.get(m.month)!;
    near(m.mtmPnl, independent.equity - prior); near(m.realizedPnl, independent.realized - priorRealized);
    prior = independent.equity; priorRealized = independent.realized;
  }
  const openEntryFees = inventory.reduce((n, p) => n + p.notional * rates.entry, 0);
  const openExitReserve = inventory.reduce((n, p) => n + p.qty * finalPrice * rates.marketExit, 0);
  near(fees + openEntryFees, paidEntry + exitFees);
  return { passed: true, independentMinutes: end - start, fills: events.length, completedFees: fees,
    openEntryFees, openExitReserve, modeledFees: fees + openEntryFees + openExitReserve,
    makerExitNotional: makerNotional, marketExitNotional: marketNotional,
    fixedPathMakerFeeSaving: makerNotional * (rates.marketExit - rates.makerExit),
    makerPrefixes, makerCloses, turnover, reasonCounts: counts,
    minimumEquity: minimum, nonpositiveEquity: minimum <= 0, liquidationCertified: false };
}
