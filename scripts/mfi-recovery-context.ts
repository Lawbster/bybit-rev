/** F03: explanatory classification only. No execution or policy mutation. */
import assert from "assert/strict";
import { stats, type Row } from "./tp-hl-event-features";
export const M = 60000;
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
export const andKnown = (...xs: Array<boolean | null>): boolean | null => xs.some(x => x === null) ? null : xs.every(Boolean);
const cmp = (a: unknown, b: unknown, op: "le" | "lt" | "ge" | "gt") => !finite(a) || !finite(b) ? null
  : op === "le" ? a <= b : op === "lt" ? a < b : op === "ge" ? a >= b : a > b;
export function contrasts(now: Row, first: Row, previous: Row, support: Row, delayed = false): Record<string, boolean | null> {
  const v = delayed ? now.delayedValues : now.values, f = delayed ? first.delayedValues : first.values;
  const h = delayed ? now.hlDelayed : now.hl, hp = delayed ? previous.hlDelayed : previous.hl;
  const both = (x: Row) => andKnown(x.quality.flow15Healthy ? cmp(x.features.takerRatio15, .85, "le") : null,
    x.quality.flow60Healthy ? cmp(x.features.takerRatio60, .9, "le") : null);
  const p = delayed ? now.delayedPrice : now.price, p0 = delayed ? first.delayedPrice : first.price;
  return {
    C1: p.trend.blocked,
    C2: andKnown(cmp(v.m240_adx, 25, "ge"), cmp(v.m240_minusDI, v.m240_plusDI, "gt")),
    C3: andKnown(cmp(v.m60_weekVwapDistancePct, 0, "lt"), cmp(v.m60_roc5, 0, "le")),
    C4: andKnown(cmp(p.price, p0.price, "le"), cmp(v.m30_mfi14, f.m30_mfi14, "le")),
    C5: support.healthy ? support.broken : null,
    C6: both(h), C7: andKnown(both(h), both(hp)),
    C8: cmp(h.features.bookImbalance05Change15, -.15, "lt"),
    C9: andKnown(cmp(v.m60_rsi, 30, "le"), cmp(v.m60_crsi, 5, "le")),
    C10: cmp(v.m60_macdHist, f.m60_macdHist, "gt"),
    C11: cmp(v.m30_cmf20, 0, "lt"),
    C12: andKnown(cmp(v.m30_atrShock, -1, "le"), cmp(v.m30_rvol20, 1.5, "ge")),
  };
}
export function attribution(xs: Row[]): Row {
  const selected = xs.filter(x => x.selected), known = selected.filter(x => finite(x.delta));
  const good = known.filter(x => x.delta > 1e-7), bad = known.filter(x => x.delta < -1e-7);
  const saved = good.reduce((n, x) => n + x.delta, 0), cost = -bad.reduce((n, x) => n + x.delta, 0);
  return { observations: xs.length, selected: selected.length, completed: known.length, censored: selected.length - known.length,
    helpful: good.length, harmful: bad.length, unchanged: known.length - good.length - bad.length,
    saved, cost, balance: saved - cost, baselineEpisodeNet: known.reduce((n, x) => n + x.baselineOutcome.pnl, 0),
    halfEpisodeNet: known.reduce((n, x) => n + x.halfOutcome.pnl, 0),
    helpfulFraction: known.length ? good.length / known.length : null,
    largestSavingShare: saved ? Math.max(...good.map(x => x.delta)) / saved : null,
    baselineWins: known.filter(x => x.baselineOutcome.pnl > 0).length,
    baselineLosses: known.filter(x => x.baselineOutcome.pnl < 0).length,
    harmfulDespiteBaselineLoss: bad.filter(x => x.baselineOutcome.pnl < 0).length };
}
export function splitRows(rows: Row[], definitions: Row[]): Row[] {
  const result: Row[] = [];
  for (const model of [...new Set(rows.map(x => x.model))]) {
    const all = rows.filter(x => x.model === model);
    const months = [...new Set(all.map(x => x.iso.slice(0, 7)))].sort();
    for (const month of ["all", ...months]) for (const sensitivity of ["primary", "source60"]) for (const c of definitions) {
      const xs = all.filter(x => month === "all" || x.iso.startsWith(month));
      const group = (value: boolean | null) => xs.filter(x => x.flags[sensitivity][c.id] === value);
      const a = attribution(xs), flagged = attribution(group(true)), unflagged = attribution(group(false)), unknown = attribution(group(null));
      assert.equal(flagged.observations + unflagged.observations + unknown.observations, a.observations);
      assert(Math.abs(flagged.balance + unflagged.balance + unknown.balance - a.balance) < 1e-6);
      result.push({ model, month, sensitivity, id: c.id, name: c.name, all: a, flagged, unflagged, unknown });
    }
  } return result;
}
export function distributions(rows: Row[], contexts: Map<number, Row>, offsets: number[]): Row[] {
  const result: Row[] = [], keys = Object.keys(contexts.values().next().value!.values);
  for (const model of [...new Set(rows.map(x => x.model))]) for (const offset of offsets) {
    const xs = rows.filter(x => x.model === model), at = (x: Row) => contexts.get(x.at + offset * M)!.values;
    for (const key of keys) result.push({ model, offset, feature: key,
      helpful: stats(xs.filter(x => x.selected && finite(x.delta) && x.delta > 1e-7).map(x => at(x)[key])),
      harmful: stats(xs.filter(x => x.selected && finite(x.delta) && x.delta < -1e-7).map(x => at(x)[key])),
      unselected: stats(xs.filter(x => !x.selected).map(x => at(x)[key])) });
  } return result;
}
export function assertAsOf(x: any, at: number): number {
  if (!x || typeof x !== "object") return 0;
  let n = 0;
  for (const [k, v] of Object.entries(x)) {
    if (["sourceEnd", "availableAt", "lastTouchKnownAt", "usableAt"].includes(k) && finite(v)) {
      assert(v <= at, `Future ${k}: ${v} > ${at}`); n++;
    } else if (typeof v === "object") n += assertAsOf(v, at);
  } return n;
}
