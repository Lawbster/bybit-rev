/** Independent event-ledger/price accounting; no engine, policy, or production function imports. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
import type { ExposureMetrics } from "./ladder-exposure-metrics";
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
export function auditCombinationAccounting(candles: Candle[], events: ResearchInventoryEvent[], metrics: ExposureMetrics,
  startIdx: number, endIdx: number, capital: number, fee: number,
  research?: { fraction: number; fillDelayMs: number }, half11 = false) {
  let inventory: any[] = [], pointer = 0, realized = 0, episodePnl = 0, peak = capital, min = capital, dd = 0, fees = 0, turnover = 0;
  let lastAdd = 0, epStart = 0, maxHeldHours = 0, longestHeld: any = null, underwaterMinutes = 0, consecutiveUnderwater = 0, longestUnderwaterMinutes = 0;
  let firstNonpositive: any = null, deepestPricePnl = 0, marginBelowInitialRequirement: any = null, highMarkNotional = 0;
  const closeByTime = new Map(metrics.episodes.map(e => [Date.parse(e.close), e]));
  const months = new Map<string, { equity: number; realized: number; worstMarkedEquity: number }>();
  const reasonCounts: Record<string, number> = {}, opensByDepth: Record<string, number> = {};
  function settle(x: ResearchInventoryEvent) {
    assert.deepEqual(x.before, inventory); const e = x.event;
    assert(e.fillIndex! > e.decisionIndex); assert.equal(e.decisionAt, candles[e.decisionIndex].endTs);
    const c = candles[e.fillIndex!]; assert(e.fillAt === c.ts || e.fillAt === c.endTs);
    if (e.fillAt === c.ts) { near(e.price!, c.open);
      const delay = e.reason.startsWith("research_exit:") ? research!.fillDelayMs / 60000 : 0;
      assert.equal(e.fillIndex, e.decisionIndex + 1 + delay); }
    else { assert.equal(e.kind, "close"); assert(["tp", "stale_tp"].includes(e.reason)); assert(e.price! <= c.high); }
    reasonCounts[e.reason] = (reasonCounts[e.reason] ?? 0) + 1;
    turnover += e.qty * e.price!;
    if (e.kind === "open") {
      assert.equal(x.after.length, inventory.length + 1); assert.deepEqual(x.after.slice(0, -1), inventory);
      near(e.qty * e.price!, 800 * 1.35 ** inventory.length * (half11 && inventory.length === 10 ? .5 : 1)); near(x.after.at(-1)!.qty, e.qty);
      near(x.after.at(-1)!.entryPrice, e.price!); near(x.after.at(-1)!.notional, e.qty * e.price!);
      lastAdd = e.fillAt!; if (!inventory.length) epStart = e.fillAt!;
      opensByDepth[String(x.after.length)] = (opensByDepth[String(x.after.length)] ?? 0) + 1;
    } else {
      let qty = 0;
      for (const p of inventory) {
        const removed = p.qty - (x.after.find(a => a.id === p.id)?.qty ?? 0); qty += removed;
        const f = removed * (p.entryPrice + e.price!) * fee, net = removed * (e.price! - p.entryPrice) - f;
        fees += f; realized += net; episodePnl += net;
      }
      near(qty, e.qty);
      if (e.kind === "close") {
        assert.equal(x.after.length, 0); const outcome = closeByTime.get(e.fillAt!); assert(outcome); near(outcome.pnl, episodePnl);
        episodePnl = 0; lastAdd = 0;
        const held = (e.fillAt! - epStart) / 3600000;
        if (held > maxHeldHours) { maxHeldHours = held; longestHeld = { entry: epStart, end: e.fillAt, closed: true }; }
        epStart = 0;
      } else {
        assert.equal(e.kind, "partial");
        if (e.reason.startsWith("research_exit:")) {
          assert(research && research.fraction > 0 && research.fraction < 1);
          assert.equal(x.after.length, inventory.length);
          x.after.forEach((p, i) => { const b = inventory[i];
            assert.equal(p.id, b.id); assert.equal(p.level, b.level); assert.equal(p.entryTime, b.entryTime);
            near(p.entryPrice, b.entryPrice); near(p.qty, b.qty * (1 - research.fraction)); near(p.notional, b.notional * (1 - research.fraction)); });
        } else assert.equal(x.after.length, 3);
      }
    }
    assert.equal(x.lastAddTime, lastAdd); inventory = [...x.after];
  }
  const mark = (price: number) => inventory.reduce((n, p) => n + (price - p.entryPrice) * p.qty - (price + p.entryPrice) * p.qty * fee, 0);
  function update(price: number, at: number, phase: string) {
    const eq = capital + realized + mark(price); peak = Math.max(peak, eq); min = Math.min(min, eq); dd = Math.max(dd, (peak - eq) / peak * 100);
    const qty = inventory.reduce((n, p) => n + p.qty, 0), cost = inventory.reduce((n, p) => n + p.notional, 0);
    highMarkNotional = Math.max(highMarkNotional, qty * price);
    if (qty) deepestPricePnl = Math.min(deepestPricePnl, (price * qty / cost - 1) * 100);
    if (eq <= 0 && !firstNonpositive) firstNonpositive = { at, iso: new Date(at).toISOString(), phase, price, equity: eq, realized, depth: inventory.length };
    // This is a stress diagnostic, NOT a Bybit maintenance-margin/liquidation calculation.
    if (inventory.length && eq <= cost / 25 && !marginBelowInitialRequirement) marginBelowInitialRequirement = { at, iso: new Date(at).toISOString(), phase, equity: eq, entryCostOver25: cost / 25 };
    return eq;
  }
  for (let i = startIdx; i < endIdx; i++) {
    const c = candles[i];
    while (events[pointer]?.event.fillIndex === i && events[pointer].event.fillAt === c.ts) settle(events[pointer++]);
    const lowEquity = update(c.low, c.endTs, "bar_low_before_unknown_tp_ordering");
    while (events[pointer]?.event.fillIndex === i) settle(events[pointer++]);
    const equity = update(c.close, c.endTs, "close"), month = new Date(c.endTs).toISOString().slice(0, 7);
    months.set(month, { equity, realized, worstMarkedEquity: Math.min(months.get(month)?.worstMarkedEquity ?? capital, lowEquity, equity) });
    const red = inventory.length > 0 && mark(c.close) < 0;
    if (red) { underwaterMinutes++; consecutiveUnderwater++; } else consecutiveUnderwater = 0;
    longestUnderwaterMinutes = Math.max(longestUnderwaterMinutes, consecutiveUnderwater);
    if (epStart && (c.endTs - epStart) / 3600000 > maxHeldHours) {
      maxHeldHours = (c.endTs - epStart) / 3600000; longestHeld = { entry: epStart, end: c.endTs, closed: false };
    }
  }
  assert.equal(pointer, events.length); const endPrice = candles[endIdx - 1].close;
  near(realized, metrics.realized); near(mark(endPrice), metrics.openPnl); near(min, metrics.minEquity); near(dd, metrics.maxDrawdownPct);
  near(metrics.grossWin - metrics.grossLoss + metrics.unfinishedPartialPnl + metrics.openPnl, metrics.totalPnl);
  let prevEquity = capital, prevRealized = 0;
  const monthly = metrics.monthly.map(m => {
    const actual = months.get(m.month)!; near(m.mtmPnl, actual.equity - prevEquity); near(m.realizedPnl, actual.realized - prevRealized);
    prevEquity = actual.equity; prevRealized = actual.realized;
    const es = metrics.episodes.filter(e => e.close.slice(0, 7) === m.month);
    return { ...m, worstMarkedEquity: actual.worstMarkedEquity, wins: es.filter(e => e.pnl > 0).length, losses: es.filter(e => e.pnl < 0).length,
      winDollars: es.reduce((n, e) => n + Math.max(0, e.pnl), 0), lossDollars: es.reduce((n, e) => n + Math.min(0, e.pnl), 0) };
  });
  const openFees = inventory.reduce((n, p) => n + p.qty * (p.entryPrice + endPrice) * fee, 0);
  const exitNotional = inventory.reduce((n, p) => n + p.qty * endPrice, 0);
  near((turnover + exitNotional) * fee, fees + openFees);
  return { monthly, independentMinutes: endIdx - startIdx, fills: events.length, firstNonpositive,
    survival: firstNonpositive ? "NON_SURVIVABLE_DIAGNOSTIC" : "no_modeled_zero_equity_not_liquidation_certified",
    marginBelowInitialRequirement, maxHeldHours, longestHeld, underwaterMinutes, longestUnderwaterMinutes, deepestPricePnl, highMarkNotional,
    completedFees: fees, openFees, modeledFees: fees + openFees, turnoverWithFinalExit: turnover + exitNotional,
    fixedPathExtra5bpsNet: metrics.totalPnl - (turnover + exitNotional) * .0005, reasonCounts, opensByDepth };
}
export function componentAttribution(v: ExposureMetrics, b: ExposureMetrics) {
  const bm = new Map(b.episodes.map(e => [e.entry, e])), vm = new Map(v.episodes.map(e => [e.entry, e]));
  const common = v.episodes.filter(e => bm.has(e.entry)), removed = b.episodes.filter(e => !vm.has(e.entry)), replacement = v.episodes.filter(e => !bm.has(e.entry));
  const matchedDelta = common.reduce((n, e) => n + e.pnl - bm.get(e.entry)!.pnl, 0), removedNet = removed.reduce((n, e) => n + e.pnl, 0), replacementNet = replacement.reduce((n, e) => n + e.pnl, 0);
  const openAndUnfinishedDelta = v.openPnl + v.unfinishedPartialPnl - b.openPnl - b.unfinishedPartialPnl;
  near(matchedDelta - removedNet + replacementNet + openAndUnfinishedDelta, v.totalPnl - b.totalPnl);
  return { matched: common.length, matchedDelta, removed: removed.length, removedNet, replacement: replacement.length, replacementNet, openAndUnfinishedDelta };
}
