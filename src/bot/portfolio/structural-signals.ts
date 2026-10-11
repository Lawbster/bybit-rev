/** Frozen SF08 and PA07 sources. Reuses the existing detectors/action eligibility.
 * No trading clients or standalone replay imports. Input is an explicit receipt
 * prefix; a loader/process coordinator and exchange normalization are separate.
 */
import { buildContext, type Minute, M, H } from '../../strategies/setup-context';
import { sf01RangeLow } from '../../strategies/sfp-detector';
import { sfpActions } from '../../strategies/sfp-policy';
import { buildPriceActionSignals, economicActions } from '../../strategies/price-action-signals';
import { epoch, positive } from './contract';
import type { PortfolioSignal } from './allocation';

export const STRUCTURAL_SEED = Date.UTC(2024, 11, 5, 12, 55);
export const PA07_RULE = Object.freeze({ triggerMinutes: 60, contextMinutes: 240,
  pivotWidth: 2, levelMaxAgeHours: 168, breakBufferPct: .1, stopBufferPct: .1,
  originLookbackBars: 12, retestExpiryHours: 12, impulseExpiryHours: 6,
  impulseBodyFraction: .6, impulseAtrBars: 14, impulseAtrMultiple: 1,
  discountMax: .4, premiumMin: .6, riskMinPct: .2, riskMaxPct: 5,
  holdHours: 24, rewardR: 2 });
export type StructuralSource = 'SF08' | 'PA07';
export interface StructuralPublication {
  source: StructuralSource; id: string; at: number; knownAt: number;
  side: 1 | -1; stop: number; target: number; expiresAt: number; reference: number;
}
export type StructuralDecision =
  | { status: 'outside_entry_window' | 'inputs_unavailable' | 'missing_bar' | 'no_signal' }
  | { status: 'signal'; signal: PortfolioSignal; reference: number };

export class StructuralSignalMap {
  readonly rows: readonly Readonly<StructuralPublication>[];
  private readonly lastEnd: number;
  private readonly asOf: number;
  private readonly byKey = new Map<string, Readonly<StructuralPublication>>();

  constructor(input: readonly Minute[], observationAt: number) {
    epoch(observationAt); this.asOf = observationAt;
    // Filter future receipts before validating a visible prefix. A malformed clock
    // cannot establish visibility. Do not admit future final-bar revisions.
    const visible = input.filter(c => { epoch(c.availableAt); return c.availableAt <= observationAt && c.ts >= STRUCTURAL_SEED; });
    if (!visible.length || visible[0].ts !== STRUCTURAL_SEED) throw new Error('structural seed unavailable');
    let prefixKnownAt = 0;
    const minutes: Minute[] = visible.map((c, i) => {
      epoch(c.ts); epoch(c.endTs);
      if (c.ts !== STRUCTURAL_SEED + i * M || c.endTs !== c.ts + M || c.availableAt < c.endTs
        || ![c.volume, c.turnover].every(x => Number.isFinite(x) && x >= 0))
        throw new Error('invalid or incomplete structural minute prefix');
      for (const k of ['open', 'high', 'low', 'close'] as const) positive(c[k], k);
      if (c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close)) throw new Error('invalid structural OHLC');
      prefixKnownAt = Math.max(prefixKnownAt, c.availableAt);
      // Conservative cumulative receipts also protect all pivot neighbours in the
      // existing SFP helper, which publishes from the final confirmation bar.
      return { ts: c.ts, endTs: c.endTs, open: c.open, high: c.high, low: c.low,
        close: c.close, volume: c.volume, turnover: c.turnover, availableAt: prefixKnownAt };
    });
    this.lastEnd = minutes.at(-1)!.endTs;
    const context = buildContext({ symbol: 'HYPEUSDT', minutes, lagMs: M,
      window: { start: STRUCTURAL_SEED, end: observationAt }, params: { requireRange: 1 } });
    context.cutoff = observationAt;
    const sf = sfpActions(sf01RangeLow.detect(context));
    const pa = economicActions(buildPriceActionSignals(minutes, PA07_RULE, M).signals.break_control,
      -1, 'reference_2r', PA07_RULE).actions;
    const candidates: StructuralPublication[] = [
      ...sf.map(a => ({ source: 'SF08' as const, id: a.id, at: a.at, side: 1 as const,
        stop: a.stop, target: a.target, expiresAt: a.expiresAt, reference: a.reference, knownAt: a.at })),
      ...pa.map(a => ({ source: 'PA07' as const, id: a.id, at: a.at, side: -1 as const,
        stop: a.stop!, target: a.target!, expiresAt: a.expiresAt!, reference: Number(a.evidence!.signalClose), knownAt: a.at })),
    ];
    this.rows = Object.freeze(candidates.filter(a => a.at <= observationAt).map(a => {
      // PA07 models source publication. Validate *all* receipt dependencies before
      // allowing its nominal action; late confirmation never creates a queued entry.
      const index = (a.at - 2 * M - STRUCTURAL_SEED) / M;
      if (!Number.isInteger(index) || !minutes[index]) throw new Error('missing structural confirmation minute');
      a.knownAt = Math.max(a.at, minutes[index].availableAt);
      const r = Object.freeze(a), key = a.source + ':' + a.at;
      if (this.byKey.has(key)) throw new Error('unresolved structural source tie');
      this.byKey.set(key, r); return r;
    }).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)));
  }

  decision(source: StructuralSource, now: number): StructuralDecision {
    if (source !== 'SF08' && source !== 'PA07') throw new Error('unknown structural source');
    epoch(now); const at = Math.floor(now / M) * M;
    const tf = source === 'SF08' ? 4 * H : H;
    if (at < M || (at - M) % tf) return { status: 'outside_entry_window' };
    if (now > this.asOf) return { status: 'inputs_unavailable' };
    if (at - M > this.lastEnd) return { status: 'missing_bar' };
    const r = this.byKey.get(source + ':' + at);
    if (!r) return { status: 'no_signal' };
    if (r.knownAt > at) return { status: 'inputs_unavailable' };
    return { status: 'signal', reference: r.reference, signal: { id: r.id, source, side: r.side,
      decisionAt: at, eligibleAt: at, knownAt: r.knownAt, expiresAt: r.expiresAt, stop: r.stop, target: r.target } };
  }
}
