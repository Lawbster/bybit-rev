/** PH02: research-only entry vetoes on saved POC opportunities. */
import assert from 'assert/strict';
import { TpHlTape, type Row, MIN } from './tp-hl-event-features';
import { aggregate, amounts } from './poc-indicator-bias-engine';
import { computeVwapVolumeValues } from '../src/research/vwap-volume-features';
import type { Candle } from './hype-freerun-canonical-replay';
import { runSchedule, type RunOptions } from './poc-bounce-engine';
import { attribute } from './poc-hold-study';

export type Rule = 'A' | 'B' | 'C';
export const RULES: Rule[] = ['A', 'B', 'C'];
export function weeklyTable(cs: readonly Candle[]) {
  const bars = aggregate(cs, 15 * MIN), values = computeVwapVolumeValues(bars, 15 * MIN);
  return new Map(bars.map((b, i) => [b.timestamp + 15 * MIN, {
    barEnd: b.timestamp + 15 * MIN, availableAt: b.timestamp + 16 * MIN,
    weekStart: values[i].vvWeekStart, close: b.close, vwap: values[i].vvWeek,
    distancePct: values[i].vvWeekDistance,
  }]));
}
export function opportunity(s: Row, tape: TpHlTape, weekly: ReturnType<typeof weeklyTable>, sourceDelay: number): Row {
  const queryAt = s.signalAt - sourceDelay, snap = tape.snapshot(queryAt);
  const barEnd = Math.floor((queryAt - MIN) / (15 * MIN)) * 15 * MIN;
  const price = weekly.get(barEnd) ?? null, acceleration = snap.features.buyShareAcceleration;
  const known = typeof acceleration === 'number' && Number.isFinite(acceleration)
    && price?.distancePct !== null && price?.distancePct !== undefined && Number.isFinite(price.distancePct);
  const covered = snap.quality.coreHealthy === true && known;
  const reasons: string[] = [];
  if (!snap.quality.coreHealthy) reasons.push('ph01_core_unhealthy');
  if (acceleration === null) reasons.push('acceleration_unknown');
  if (!price || price.distancePct === null) reasons.push('weekly_vwap_unknown');
  if (price) assert(price.availableAt <= queryAt);
  return { id: s.id, signalAt: s.signalAt, sourceDelay, queryAt, covered, reasons,
    acceleration, weekly: price, quality: snap.quality,
    sources: Object.fromEntries(['taker15', 'taker5', 'takerPrior10', 'book', 'asset'].map(k => [k, snap.sources[k]])),
    warningB: covered ? acceleration <= -.05 : null,
    warningC: covered ? acceleration <= -.05 && price!.distancePct! < 0 : null };
}
export function admitted(r: Row, rule: Rule): boolean {
  return r.covered && (rule === 'A' || !(rule === 'B' ? r.warningB : r.warningC));
}
export function execute(cs: readonly Candle[], opportunities: Row[], rule: Rule, options: RunOptions) {
  const schedule = opportunities.filter(r => admitted(r, rule)).map(r => ({ id: r.id, at: r.signalAt }));
  const run = runSchedule(cs, schedule, options), ids = new Set(run.accepted.map(s => s.id));
  let occupiedUntil = options.start;
  const decisions = opportunities.filter(r => r.signalAt >= options.start && r.signalAt < options.end).map(r => {
    const occupiedBefore = r.signalAt < occupiedUntil;
    const status = !r.covered ? 'unavailable' : !admitted(r, rule) ? 'veto' : occupiedBefore ? 'occupied' : 'accepted';
    assert.equal(status === 'accepted', ids.has(r.id));
    if (status === 'accepted') occupiedUntil = r.signalAt + options.hold + 2 * options.delay;
    return { id: r.id, signalAt: r.signalAt, covered: r.covered, warningB: r.warningB, warningC: r.warningC,
      occupiedBefore, status, occupiedUntil, queryAt: r.queryAt };
  });
  return { ...run, decisions };
}
export function comparison(base: ReturnType<typeof execute>, variant: ReturnType<typeof execute>) {
  const attr = attribute(base, variant), va = new Map(variant.decisions.map(r => [r.id, r]));
  const baseIds = new Set(base.trades.map(t => t.id)), varIds = new Set(variant.trades.map(t => t.id));
  const removed = base.trades.filter(t => !varIds.has(t.id));
  const direct = removed.filter(t => va.get(t.id)?.status === 'veto');
  const displaced = removed.filter(t => va.get(t.id)?.status === 'occupied');
  const added = variant.trades.filter(t => !baseIds.has(t.id));
  const positive = attr.rows.filter(r => r.delta > 0).sort((a, b) => b.delta - a.delta);
  const savedLosses = removed.filter(t => t.net < 0).sort((a, b) => a.net - b.net);
  return { ...attr, directVeto: amounts(direct), displacedByReplacement: amounts(displaced), replacement: amounts(added),
    sacrificedWinners: amounts(removed.filter(t => t.net > 0)), avoidedLosses: amounts(removed.filter(t => t.net < 0)),
    avoidedHeavy: amounts(removed.filter(t => t.net <= -300)), replacementHeavy: amounts(added.filter(t => t.net <= -300)),
    deltaWithoutLargestPositive: attr.summary.delta - (positive[0]?.delta ?? 0),
    deltaWithoutTwoLargestPositive: attr.summary.delta - positive.slice(0, 2).reduce((s, r) => s + r.delta, 0),
    deltaWithoutTwoLargestAvoidedLosses: attr.summary.delta + savedLosses.slice(0, 2).reduce((s, t) => s + t.net, 0),
    note: 'Leave-out contribution diagnostics, not new strategy replays. Avoided and replacement trades use actual respective ownership paths.' };
}
