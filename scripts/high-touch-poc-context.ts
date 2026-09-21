/** HT02: immutable as-of map context, never cutoff naked status or future fill. */
import assert from 'assert/strict';
import { createReader, periodStart, type Profile, type Period, type AsOfProfile } from './poc-profile-engine';
export type Row = Record<string, any>;
export const PERIODS: Period[] = ['day', 'week', 'month'];
export const FAMILIES = ['poc_day', 'poc_week', 'poc_month', 'poc_all', 'npoc_day', 'npoc_week', 'npoc_month', 'npoc_all'];
export function filters(c: Row) {
  assert.deepEqual(c.families, FAMILIES); assert.deepEqual(c.relations, ['either', 'below']);
  return c.families.flatMap((family: string) => c.relations.flatMap((relation: string) => c.thresholdsPct.map((threshold: number) =>
    ({ id: `${family}_${relation}_${threshold}`, family, relation, threshold }))));
}
export function nearest(rows: readonly AsOfProfile[], price: number, below: boolean): Row | null {
  assert(Number.isFinite(price) && price > 0);
  let best: Row | null = null;
  for (const p of rows) {
    const lower = Number(p.lower), upper = Number(p.upper); assert(upper > lower && lower > 0);
    if (below && lower > price) continue;
    const distancePct = Math.max(lower - price, price - upper, 0) / price * 100;
    if (!best || distancePct < best.distancePct || (distancePct === best.distancePct && p.id < best.id)) best = {
      id: p.id, period: p.period, start: p.start, end: p.end, availableAt: p.availableAt,
      lower, upper, center: Number(p.center), status: p.status, distancePct,
    };
  }
  return best;
}
export function snapshot(profiles: Profile[], cutoff: number, lag: number) {
  const reader = createReader(profiles, cutoff);
  return (e: Row): Row => {
    const snapshotAt = e.at - lag; assert(e.observationEnd <= e.at && snapshotAt <= e.at);
    const known = reader.at(snapshotAt, { venue: 'bybit', width: '0.1' });
    const lanes: Record<string, AsOfProfile[]> = {}, coverage: Row = {};
    for (const p of PERIODS) {
      const historical = known.filter(x => x.period === p), expectedEnd = periodStart(snapshotAt - 60000, p);
      const prior = historical.filter(x => x.end === expectedEnd); assert(prior.length <= 1);
      const naked = historical.filter(x => x.status === 'untested');
      lanes[`poc_${p}`] = prior; lanes[`npoc_${p}`] = naked;
      coverage[p] = { expectedEnd, previousAvailable: prior.length > 0, published: historical.length,
        naked: naked.length, uncertain: historical.filter(x => x.status === 'uncertain').length,
        tested: historical.filter(x => x.status === 'tested').length };
    }
    lanes.poc_all = PERIODS.flatMap(p => lanes[`poc_${p}`]); lanes.npoc_all = PERIODS.flatMap(p => lanes[`npoc_${p}`]);
    const levels: Row = {};
    for (const family of FAMILIES) levels[family] = { count: lanes[family].length,
      either: nearest(lanes[family], e.close, false), below: nearest(lanes[family], e.close, true) };
    return { id: e.id, at: e.at, price: e.close, priceSourceEnd: e.observationEnd, snapshotAt, coverage, levels };
  };
}
export function blocks(ctx: Row, filter: Row): boolean {
  const level = ctx.levels[filter.family][filter.relation];
  return level !== null && level.distancePct <= filter.threshold + 1e-10;
}
export function attribution(base: Row, run: Row, blocked: Set<string>) {
  const b = new Map<string, Row>(base.trades.map((t: Row) => [t.id, t])), v = new Map<string, Row>(run.trades.map((t: Row) => [t.id, t]));
  const removed = base.trades.filter((t: Row) => !v.has(t.id)), added = run.trades.filter((t: Row) => !b.has(t.id));
  const shared = run.trades.filter((t: Row) => b.has(t.id)); for (const t of shared) assert.deepEqual(t, b.get(t.id));
  const sum = (ts: Row[]) => ({ trades: ts.length, wins: ts.filter(t => t.net > 1e-8).length, losses: ts.filter(t => t.net < -1e-8).length,
    winningDollars: ts.reduce((s, t) => s + Math.max(0, t.net), 0), losingDollars: ts.reduce((s, t) => s + Math.min(0, t.net), 0), net: ts.reduce((s, t) => s + t.net, 0) });
  const direct = removed.filter((t: Row) => blocked.has(t.id)), displaced = removed.filter((t: Row) => !blocked.has(t.id));
  const openDelta = (run.open?.net ?? 0) - (base.open?.net ?? 0), delta = sum(added).net - sum(removed).net + openDelta;
  assert(Math.abs(delta - (run.stats.net - base.stats.net)) < 1e-6);
  return { removed: sum(removed), added: sum(added), direct: sum(direct), displaced: sum(displaced), shared: shared.length,
    removedIds: removed.map((t: Row) => t.id), addedIds: added.map((t: Row) => t.id), openDelta, delta,
    deltaWithoutTwoLargestAvoidedLosses: delta + [...removed].filter(t => t.net < 0).sort((a, b) => a.net - b.net).slice(0, 2).reduce((s, t) => s + t.net, 0) };
}
