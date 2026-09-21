/** AG10-C1: only post-two-day-high-exit cooldown changes. */
import assert from "assert/strict";
import { POLICIES as L15, type Policy } from "./age10-gate-policy";
export { config, AgeHighController } from "./age10-gate-policy";
export type R = Record<string, any>;
export const LEAD = "age10__minus_deep_stress__minus_tp_cooldown";
export const HIGH_REASON = "research_exit:exit_2d_1pct";
export type CooldownPolicy = Policy & { highExitCooldownHours?: 1 | 2 };
export const CONTROLS: CooldownPolicy[] = ["baseline", "tp_age10", LEAD].map(id => structuredClone(L15.find(p => p.id === id)!));
export const VARIANTS: CooldownPolicy[] = ([1, 2] as const).map(highExitCooldownHours => ({
  ...structuredClone(CONTROLS[2]), id: `aggressive10_high_cooldown_${highExitCooldownHours}h`, highExitCooldownHours
}));
export const POLICIES = [...CONTROLS, ...VARIANTS];
export const SCREEN = { minimumRecentNetDelta: 1000, minimumPublishedNetDelta: 0, minimumMonthlyDelta: -250,
  maximumDrawdownIncreasePp: 0, minimumInterventionEpisodes: 20 };
export function validate(d: R) {
  assert.deepEqual(d.controls, CONTROLS); assert.deepEqual(d.variants, VARIANTS);
  assert.equal(d.runs, 26); assert.equal(d.newTradingDefinitions, 2);
  assert.equal(d.start, "2026-05-17T20:43:00Z"); assert.equal(d.cutoff, "2026-09-10T05:08:00Z");
  assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055);
  assert.deepEqual(d.sourceLags, [0, 60000]); assert.deepEqual(d.screen, SCREEN);
}
/** Descriptive own-path early reopens; not causal per-reopen PnL. */
export function reopenAttribution(events: R[], cooldowns: R[], metrics: R, end: number) {
  const closes = new Map(cooldowns.map(c => [c.episode, c])), outcomes = new Map(metrics.episodes.map((e: R) => [Date.parse(e.entry), e]));
  let last: R | null = null; const reopens: R[] = [];
  for (const e of events) {
    if (e.event.kind === "close") last = closes.get(e.episode)!;
    if (e.event.kind !== "open" || e.before.length || !last || last.reason !== HIGH_REASON) continue;
    const outcome: any = outcomes.get(e.event.fillAt);
    reopens.push({ highExitEpisode: last.episode, highExitAt: last.at, inheritedUntil: last.inheritedUntil, until: last.until,
      decisionAt: e.event.decisionAt, entryAt: e.event.fillAt, entryPrice: e.event.price, episode: e.episode,
      early: e.event.decisionAt < last.inheritedUntil, waitMinutes: (e.event.decisionAt - last.at) / 60000,
      closed: !!outcome, outcome: outcome ?? null });
  }
  const high = cooldowns.filter(c => c.reason === HIGH_REASON), early = reopens.filter(r => r.early);
  return { highExits: high.length, shortenedHighExits: high.filter(c => c.until < c.inheritedUntil).length,
    earlyReopens: early.length, completedEarlyReopens: early.filter(r => r.closed).length,
    earlyWins: early.filter(r => r.outcome?.pnl > 0).length, earlyLosses: early.filter(r => r.outcome?.pnl < 0).length,
    earlyWinDollars: early.reduce((n, r) => n + Math.max(0, r.outcome?.pnl ?? 0), 0),
    earlyLossDollars: early.reduce((n, r) => n + Math.min(0, r.outcome?.pnl ?? 0), 0),
    censoredHighExits: high.filter(c => c.inheritedUntil > end).length, reopens };
}
export function qualification(rows: R[], comparisons: R[], d: R) {
  return VARIANTS.map(p => {
    const xs = rows.filter(x => x.primary && x.policy === p.id), failures: string[] = [], incremental: string[] = [];
    for (const x of xs) {
      const c = comparisons.find(c => c.name === x.name)!, recent = x.window === "hl_extended";
      if (c.baseline.pnlDelta < (recent ? d.screen.minimumRecentNetDelta : 0)) failures.push(`${x.model}:net`);
      if (c.baseline.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`);
      if (c.baseline.worstMonthDelta < d.screen.minimumMonthlyDelta) failures.push(`${x.model}:monthly`);
      if (recent && x.counts.earlyReopens < 20) failures.push(`${x.model}:thin_new_intervention`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:nonpositive_equity`);
      if (recent ? c.parent.pnlDelta <= 0 : c.parent.pnlDelta < 0) incremental.push(`${x.model}:parent_net`);
      if (c.parent.ddReductionPp < -1e-9) incremental.push(`${x.model}:parent_drawdown`);
      if (c.parent.worstMonthDelta < d.screen.minimumMonthlyDelta) incremental.push(`${x.model}:parent_monthly`);
      if (recent && x.counts.earlyReopens < 20) incremental.push(`${x.model}:thin_new_intervention`);
      if (x.accounting.firstNonpositive) incremental.push(`${x.model}:nonpositive_equity`);
    }
    return { policy: p.id, minimumRecentParentDelta: Math.min(...xs.filter(x => x.window === "hl_extended").map(x => comparisons.find(c => c.name === x.name)!.parent.pnlDelta)),
      aggregateBaselineAllFour: xs.every(x => { const c = comparisons.find(c => c.name === x.name)!.baseline; return c.pnlDelta > 0 && c.ddReductionPp >= -1e-9; }),
      passesBaselineScreen: !failures.length, failures, passesIncrementalScreen: !incremental.length, incrementalFailures: incremental, deployable: false };
  }).sort((a, b) => b.minimumRecentParentDelta - a.minimumRecentParentDelta);
}
