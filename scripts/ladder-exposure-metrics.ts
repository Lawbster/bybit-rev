import assert from "assert/strict";
import type { EngineResult } from "./hype-freerun-canonical-replay";
import type { ExposureSpec } from "./ladder-exposure-policy";
export function exposureMetrics(r: EngineResult, initialEquity: number) {
  const episodes = r.closes.map(c => ({ entry: c.entryIso, close: c.closeIso, reason: c.reason, pnl: c.pnl + c.trimPnlInEpisode, depth: c.maxDepth }));
  const losses = episodes.filter(e => e.pnl < 0), wins = episodes.filter(e => e.pnl > 0);
  const grossLoss = -losses.reduce((v, e) => v + e.pnl, 0), grossWin = wins.reduce((v, e) => v + e.pnl, 0);
  const tails = episodes.map(e => e.pnl).sort((a, b) => a - b).slice(0, 5);
  const byMonth = new Map<string, { equity: number; realized: number; maxNotional: number; deepMinutes: number }>();
  for (const s of r.snapshots) {
    const month = new Date(s.ts).toISOString().slice(0, 7), old = byMonth.get(month);
    byMonth.set(month, { equity: s.equity, realized: s.realizedPnl,
      maxNotional: Math.max(old?.maxNotional ?? 0, s.longNotional), deepMinutes: (old?.deepMinutes ?? 0) + Number(s.depth >= 9) });
  }
  let equity = initialEquity, realized = 0;
  const monthly = [...byMonth].map(([month, m]) => {
    const row = { month, mtmPnl: m.equity - equity, realizedPnl: m.realized - realized, endEquity: m.equity, maxNotional: m.maxNotional, deepMinutes: m.deepMinutes };
    equity = m.equity; realized = m.realized; return row;
  });
  assert(Math.abs(equity - initialEquity - r.realized - r.openPnl) < 1e-6, "month MTM reconciles to total PnL");
  assert(Math.abs(realized - r.realized) < 1e-6, "month realized reconciles");
  // Partials in the final still-open episode are real cash PnL, but not a completed episode win.
  const unfinishedPartialPnl = r.realized - episodes.reduce((v, e) => v + e.pnl, 0);
  return { totalPnl: r.realized + r.openPnl, realized: r.realized, openPnl: r.openPnl,
    maxDrawdownPct: r.maxDrawdownPct, minEquity: r.minEquity, maxNotional: r.maxOpenNotional, openDepth: r.openDepth,
    fullCloses: r.closes.length, partials: r.trims.length, tpCycles: episodes.filter(e => ["tp", "stale_tp"].includes(e.reason)).length,
    forcedCloses: episodes.filter(e => !["tp", "stale_tp"].includes(e.reason)).length,
    losingEpisodes: losses.length, profitableEpisodes: wins.length, grossLoss, grossWin, profitFactor: grossLoss ? grossWin / grossLoss : null,
    worstEpisode: tails[0] ?? null, worstFiveMean: tails.length ? tails.reduce((a, b) => a + b, 0) / tails.length : null,
    unfinishedPartialPnl, monthly, episodes };
}
export type ExposureMetrics = ReturnType<typeof exposureMetrics>;
export function exposureDelta(v: ExposureMetrics, b: ExposureMetrics) {
  const monthly = v.monthly.map(m => { const base = b.monthly.find(x => x.month === m.month); assert(base); return { ...m, mtmDelta: m.mtmPnl - base.mtmPnl, realizedDelta: m.realizedPnl - base.realizedPnl }; });
  const previous = new Map(b.episodes.map(e => [e.entry, e])), current = new Map(v.episodes.map(e => [e.entry, e]));
  const common = v.episodes.filter(e => previous.has(e.entry));
  const tp = (e: { reason: string }) => ["tp", "stale_tp"].includes(e.reason);
  return { pnlDelta: v.totalPnl - b.totalPnl, pnlRetention: b.totalPnl > 0 ? v.totalPnl / b.totalPnl : null,
    ddReductionPp: b.maxDrawdownPct - v.maxDrawdownPct,
    grossLossReductionPct: b.grossLoss ? (1 - v.grossLoss / b.grossLoss) * 100 : null,
    grossWinDelta: v.grossWin - b.grossWin, grossLossDelta: v.grossLoss - b.grossLoss,
    tpCycleDelta: v.tpCycles - b.tpCycles, forcedCloseDelta: v.forcedCloses - b.forcedCloses,
    worstMonthDelta: Math.min(...monthly.map(m => m.mtmDelta)), monthly,
    matchedEntryEpisodes: common.length, matchedForcedToTp: common.filter(e => tp(e) && !tp(previous.get(e.entry)!)).length,
    matchedTpToForced: common.filter(e => !tp(e) && tp(previous.get(e.entry)!)).length,
    baselineEntriesAbsent: b.episodes.filter(e => !current.has(e.entry)).length,
    variantEntriesAbsent: v.episodes.filter(e => !previous.has(e.entry)).length };
}
export type ExposureDelta = ReturnType<typeof exposureDelta>;
export function qualifyExposure(cases: Array<{ model: string; vetoEpisodes: number; delta: ExposureDelta }>, s: ExposureSpec) {
  assert.equal(cases.length, 4); const hl = cases.filter(c => c.model.startsWith("hl_window")), older = cases.filter(c => !c.model.startsWith("hl_window"));
  assert.equal(hl.length, 2); assert.equal(older.length, 2);
  const p = s.profitUpgrade, r = s.defensiveTradeoff, profitFailures: string[] = [], riskFailures: string[] = [];
  if (hl.some(c => c.vetoEpisodes < 20)) { profitFailures.push("thin_intervention_episodes"); riskFailures.push("thin_intervention_episodes"); }
  if (hl.some(c => c.delta.pnlDelta < p.minimumHlPnlDelta)) profitFailures.push("hl_profit_lift");
  if (hl.some(c => (c.delta.grossLossReductionPct ?? -Infinity) < p.minimumHlGrossLossReductionPct)) profitFailures.push("hl_loss_reduction");
  if (cases.some(c => c.delta.ddReductionPp < -p.maximumDdIncreasePp - 1e-9)) profitFailures.push("drawdown_worse");
  if (older.some(c => c.delta.pnlDelta < p.minimumPublishedPnlDelta)) profitFailures.push("published_profit_lift");
  if (cases.some(c => c.delta.worstMonthDelta < p.minimumMonthlyMtmDelta)) profitFailures.push("monthly_cost");
  if (hl.some(c => (c.delta.grossLossReductionPct ?? -Infinity) < r.minimumHlGrossLossReductionPct)) riskFailures.push("hl_loss_reduction");
  if (hl.some(c => c.delta.ddReductionPp < r.minimumHlDdReductionPp)) riskFailures.push("hl_drawdown_reduction");
  if (cases.some(c => (c.delta.pnlRetention ?? -Infinity) < r.minimumPnlRetention)) riskFailures.push("profit_retention");
  if (older.some(c => c.delta.ddReductionPp < -r.maximumPublishedDdIncreasePp)) riskFailures.push("published_drawdown");
  if (cases.some(c => c.delta.worstMonthDelta < r.minimumMonthlyMtmDelta)) riskFailures.push("monthly_cost");
  return { profitUpgrade: !profitFailures.length, defensiveTradeoff: !riskFailures.length, profitFailures, riskFailures,
    minimumHlPnlDelta: Math.min(...hl.map(c => c.delta.pnlDelta)), minimumHlDdReductionPp: Math.min(...hl.map(c => c.delta.ddReductionPp)),
    minimumHlLossReductionPct: Math.min(...hl.map(c => c.delta.grossLossReductionPct ?? -Infinity)),
    worstMonthlyDelta: Math.min(...cases.map(c => c.delta.worstMonthDelta)), deployable: false };
}
