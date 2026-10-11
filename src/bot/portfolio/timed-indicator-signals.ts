/** Exact frozen L2/R5/CRSI signal policies. No clients, orders or strategy search.
 * Reuse the research formula implementations; never slide their recursive seed.
 * This is the signal boundary, not a live feed loader or account coordinator.
 */
import { ClosedBarSeries, type FinalCandleObservation } from '../../research/closed-bars';
import { computeAdxDmiValues } from '../../research/adx-dmi-features';
import { computeResearchFeatures } from '../../research/indicator-features';
import { MINUTE, TERMS, epoch, positive } from './contract';
import type { PortfolioSignal } from './allocation';

export const INDICATOR_SEED = Date.UTC(2025, 5, 1);
export const TIMED_SOURCES = ['L2', 'R5', 'CRSI'] as const;
export type TimedSource = typeof TIMED_SOURCES[number];
export const TIMED_SIGNAL_VERSION = 'HS01-timed-indicators-v1';
export const TIMED_RULES = Object.freeze({
  L2: { timeframe: 15 * MINUTE, period: 28, threshold: 25, prefix: 'I08:L2:' },
  R5: { timeframe: 30 * MINUTE, period: 14, threshold: 40, prefix: 'I08:R5:' },
  CRSI: { timeframe: 15 * MINUTE, period: 0, threshold: 5, prefix: 'I02:CRSI:' },
} as const);
const HOLD = 12 * 60 * MINUTE;

export interface TimedFeature {
  sourceStart: number; sourceEnd: number; scheduledAt: number; knownAt: number;
  previous: number | null; current: number | null; spread: number | null;
  close: number; crossing: boolean; warm: boolean;
}
export type PolicyBarSeries = Pick<ClosedBarSeries, 'sourceIntervalMs' | 'targetIntervalMs' | 'bars'> & {
  availability: ClosedBarSeries['availability'] | { mode: 'bootstrap_with_observed_tail'; bootstrapAt: number | null };
};
export type TimedDecision = {
  source: TimedSource; at: number;
  timing: PolicyBarSeries['availability']['mode'];
} & (
  | { status: 'outside_entry_window' | 'missing_bar' | 'late_inputs' }
  | { status: 'warming_up' | 'no_signal'; feature: Readonly<TimedFeature> }
  | { status: 'signal'; feature: Readonly<TimedFeature>; signal: PortfolioSignal }
);

function finite(v: number | null): v is number { return v !== null && Number.isFinite(v); }

/** Kept separate for boundary tests; thresholds are fixed, not operator parameters. */
export function timedCrossing(source: TimedSource, previous: number | null,
  current: number | null, spread: number | null): boolean {
  const rule = TIMED_RULES[source];
  if (!rule) throw new Error('unknown timed source');
  if (!finite(previous) || !finite(current) || previous < 0 || current < 0 || previous > 100 || current > 100) return false;
  return previous <= rule.threshold && current > rule.threshold
    && (source === 'CRSI' || (finite(spread) && TERMS[source].side * spread > 0));
}

/** The tested deadline follows the actual fill, not intent/acknowledgement time.
 * The first 12h is the hold; the extra minute is the archived exit execution delay.
 */
export function timedExitAt(entryAt: number): number {
  epoch(entryAt); const at = entryAt + HOLD + MINUTE; epoch(at); return at;
}

export class TimedIndicatorMap {
  readonly source: TimedSource;
  readonly timing: PolicyBarSeries['availability']['mode'];
  readonly rows: readonly Readonly<TimedFeature>[];
  private readonly byAt = new Map<number, Readonly<TimedFeature>>();

  constructor(source: TimedSource, series: PolicyBarSeries) {
    const rule = TIMED_RULES[source];
    if (!rule) throw new Error('unknown timed source');
    if (series.sourceIntervalMs !== MINUTE || series.targetIntervalMs !== rule.timeframe)
      throw new Error('indicator requires complete minute-derived source bars');
    this.source = source; this.timing = series.availability.mode;
    const bars = series.bars;
    // Empty/gapped/rolling prefixes must not become a freshly reseeded indicator.
    if (!bars.length || bars[0].candle.timestamp !== INDICATOR_SEED) throw new Error('fixed indicator seed unavailable');
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      epoch(b.barEnd); epoch(b.availableAt);
      if (b.candle.timestamp !== INDICATOR_SEED + i * rule.timeframe
        || b.barEnd !== b.candle.timestamp + rule.timeframe || b.availableAt < b.barEnd)
        throw new Error('indicator prefix incomplete or invalid');
    }
    const closed = bars.map(b => b.candle);
    const dm = source === 'CRSI' ? null : computeAdxDmiValues(closed, rule.timeframe, rule.period);
    const crsi = source === 'CRSI' ? computeResearchFeatures(closed, rule.timeframe) : null;
    const values = closed.map((_, i) => dm ? dm[i].dmAdx : crsi![i].crsi);
    let knownAt = 0;
    this.rows = Object.freeze(bars.map((b, i) => {
      // Every recursive dependency must be available, not just the newest bar.
      knownAt = Math.max(knownAt, b.availableAt);
      const previous = i ? values[i - 1] : null, current = values[i], spread = dm ? dm[i].dmSpread : null;
      const row = Object.freeze({ sourceStart: b.candle.timestamp, sourceEnd: b.barEnd,
        scheduledAt: b.barEnd + MINUTE, knownAt, previous, current, spread, close: b.candle.close,
        crossing: timedCrossing(source, previous, current, spread),
        warm: finite(previous) && finite(current) && (source === 'CRSI' || finite(spread)) });
      epoch(row.scheduledAt); this.byAt.set(row.scheduledAt, row); return row;
    }));
  }

  /** Entry only during its originally scheduled minute. No next-bar fallback,
   * catch-up queue, forming candle or retroactive receipt substitution.
   * The account coordinator must still consume each signal ID durably once.
   */
  decision(now: number): TimedDecision {
    epoch(now);
    const at = Math.floor(now / MINUTE) * MINUTE;
    const base = { source: this.source, at, timing: this.timing };
    if (at < MINUTE || (at - MINUTE) % TIMED_RULES[this.source].timeframe !== 0)
      return { ...base, status: 'outside_entry_window' };
    const feature = this.byAt.get(at);
    if (!feature) return { ...base, status: 'missing_bar' };
    // Fail closed even if the late input appears during this entry minute.
    // Retiming decisions would change the archived group/capital ordering.
    if (feature.knownAt > at) return { ...base, status: 'late_inputs' };
    if (!feature.warm) return { ...base, status: 'warming_up', feature };
    if (!feature.crossing) return { ...base, status: 'no_signal', feature };
    positive(feature.close, 'decision close');
    return { ...base, status: 'signal', feature, signal: {
      id: TIMED_RULES[this.source].prefix + feature.sourceEnd, source: this.source,
      side: TERMS[this.source].side, decisionAt: at, eligibleAt: at,
      knownAt: feature.knownAt, expiresAt: timedExitAt(at),
    } };
  }
}

/** Offline/bootstrapping adapter for explicitly witnessed final minute receipts.
 * Caller supplies the fixed seed prefix, not a small rolling tail. Future receipts
 * are excluded BEFORE duplicate/conflict checks and recursive computation.
 * Missing closed bars reject the prefix; they are not bridged or silently reseeded.
 */
export function timedMapsFromReceipts(rows: readonly FinalCandleObservation[], observationAt: number): Readonly<Record<TimedSource, TimedIndicatorMap>> {
  epoch(observationAt);
  const visible = rows.filter(r => {
    epoch(r.receivedAt);
    return r.receivedAt <= observationAt && r.candle.timestamp >= INDICATOR_SEED;
  });
  const options = { sourceIntervalMs: MINUTE, targetIntervalMs: 15 * MINUTE };
  const fifteen = ClosedBarSeries.fromObservations(visible, options);
  const thirty = ClosedBarSeries.fromObservations(visible, { ...options, targetIntervalMs: 30 * MINUTE });
  return Object.freeze({ L2: new TimedIndicatorMap('L2', fifteen), R5: new TimedIndicatorMap('R5', thirty),
    CRSI: new TimedIndicatorMap('CRSI', fifteen) });
}
