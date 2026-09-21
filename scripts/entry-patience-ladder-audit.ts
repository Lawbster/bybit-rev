/** FR01 independent variable-size ledger. No signal, engine or runtime imports. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
import type { ExposureMetrics } from "./ladder-exposure-metrics";
type R = Record<string, any>;
const near = (a: number, b: number) => assert(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6, `${a} != ${b}`);
export function auditFlowLedger(cs: Candle[], events: ResearchInventoryEvent[], attempts: R[], metrics: ExposureMetrics, start: number, end: number, fillPrices=new Map<number,number|null>()) {
  let inv: R[] = [], pointer = 0, realized = 0, episodePnl = 0, peak = 32000, min = 32000, dd = 0, turnover = 0, fees = 0, lastAdd = 0;
  let firstNonpositive: R | null = null;
  const permits = new Map(attempts.map(a => [a.index, a])); assert.equal(permits.size, attempts.length);
  const outcomes = new Map(metrics.episodes.map(e => [Date.parse(e.close), e]));
  const monthly = new Map<string, { equity: number; realized: number }>();
  const opens = new Set<number>();
  const mark = (price: number) => inv.reduce((n, p) => n + p.qty * (price - p.entryPrice) - .00055 * p.qty * (price + p.entryPrice), 0);
  function fill(x: ResearchInventoryEvent) {
    assert.deepEqual(x.before, inv); const e = x.event, c = cs[e.fillIndex!];
    assert(e.fillIndex! > e.decisionIndex); assert.equal(e.decisionAt, cs[e.decisionIndex].endTs);
    assert(e.fillAt === c.ts || e.fillAt === c.endTs);
    if (e.fillAt === c.ts) { assert.equal(e.fillIndex, e.decisionIndex + 1); near(e.price!, e.kind === "open" && fillPrices.has(e.decisionIndex) ? fillPrices.get(e.decisionIndex)! : c.open); }
    else { assert.equal(e.kind, "close"); assert(["tp", "stale_tp"].includes(e.reason)); assert(e.price! > 0 && e.price! <= c.high); }
    turnover += e.qty * e.price!;
    if (e.kind === "open") {
      const a = permits.get(e.decisionIndex); assert(a && a.approvedNotional > 0);
      near(e.qty * e.price!, a.approvedNotional); opens.add(e.decisionIndex);
      assert.equal(x.after.length, inv.length + 1); assert.deepEqual(x.after.slice(0, -1), inv);
      near(x.after.at(-1)!.entryPrice, e.price!); near(x.after.at(-1)!.qty, e.qty); near(x.after.at(-1)!.notional, e.qty * e.price!);
      lastAdd = e.fillAt!;
    } else {
      let removed = 0;
      for (const p of inv) {
        const left = x.after.find(q => q.id === p.id); const q = p.qty - (left?.qty ?? 0); assert(q >= -1e-10); removed += q;
        const f = .00055 * q * (p.entryPrice + e.price!), net = q * (e.price! - p.entryPrice) - f;
        fees += f; realized += net; episodePnl += net;
        if (left) { assert.equal(left.entryTime, p.entryTime); near(left.entryPrice, p.entryPrice); near(left.notional, left.qty * left.entryPrice); }
      }
      near(removed, e.qty);
      if (e.kind === "close") { assert.equal(x.after.length, 0); const o = outcomes.get(e.fillAt!); assert(o); near(o.pnl, episodePnl); episodePnl = 0; lastAdd = 0; }
      else { assert.equal(e.kind, "partial"); assert.equal(x.after.length, 3); assert(!e.reason.startsWith("research_exit:")); }
    }
    assert.equal(x.lastAddTime, lastAdd); inv = [...x.after];
  }
  const equity = (price: number, at: number) => {
    const e = 32000 + realized + mark(price); peak = Math.max(peak, e); min = Math.min(min, e); dd = Math.max(dd, (peak - e) / peak * 100);
    if (e <= 0 && !firstNonpositive) firstNonpositive = { at, equity: e }; return e;
  };
  for (let i = start; i < end; i++) {
    const c = cs[i];
    while (events[pointer]?.event.fillIndex === i && events[pointer].event.fillAt === c.ts) fill(events[pointer++]);
    equity(c.low, c.endTs);
    while (events[pointer]?.event.fillIndex === i) fill(events[pointer++]);
    monthly.set(new Date(c.endTs).toISOString().slice(0, 7), { equity: equity(c.close, c.endTs), realized });
  }
  assert.equal(pointer, events.length); near(realized, metrics.realized); near(mark(cs[end - 1].close), metrics.openPnl);
  near(min, metrics.minEquity); near(dd, metrics.maxDrawdownPct);
  near(metrics.grossWin - metrics.grossLoss + metrics.unfinishedPartialPnl + metrics.openPnl, metrics.totalPnl);
  near(metrics.grossWin, metrics.episodes.reduce((n, e) => n + Math.max(0, e.pnl), 0));
  near(metrics.grossLoss, metrics.episodes.reduce((n, e) => n - Math.min(0, e.pnl), 0));
  assert.equal(metrics.profitableEpisodes, metrics.episodes.filter(e => e.pnl > 0).length);
  assert.equal(metrics.losingEpisodes, metrics.episodes.filter(e => e.pnl < 0).length);
  for (const a of attempts) {
    if (a.approvedNotional === 0 || fillPrices.has(a.index) && fillPrices.get(a.index) === null) assert(!opens.has(a.index));
    else if (a.index + 1 < end) assert(opens.has(a.index), `Approved fill missing: ${a.index}`);
  }
  let previousEquity = 32000, previousRealized = 0;
  const months = metrics.monthly.map(m => {
    const x = monthly.get(m.month); assert(x); near(m.mtmPnl, x.equity - previousEquity); near(m.realizedPnl, x.realized - previousRealized);
    previousEquity = x.equity; previousRealized = x.realized;
    const es = metrics.episodes.filter(e => e.close.startsWith(m.month));
    return { ...m, wins: es.filter(e => e.pnl > 0).length, losses: es.filter(e => e.pnl < 0).length,
      winDollars: es.reduce((n, e) => n + Math.max(0, e.pnl), 0), lossDollars: es.reduce((n, e) => n + Math.min(0, e.pnl), 0) };
  });
  const openFees = inv.reduce((n, p) => n + p.qty * (p.entryPrice + cs[end - 1].close) * .00055, 0);
  const finalExit = inv.reduce((n, p) => n + p.qty * cs[end - 1].close, 0);
  near((turnover + finalExit) * .00055, fees + openFees);
  return { monthly: months, fills: events.length, independentMinutes: end - start, completedFees: fees, openFees,
    modeledFees: fees + openFees, turnoverWithFinalExit: turnover + finalExit, firstNonpositive,
    fixedPathExtra5bpsNet: metrics.totalPnl - (turnover + finalExit) * .0005 };
}
