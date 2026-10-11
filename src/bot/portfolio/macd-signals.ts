/** Frozen MACD R3. Recursive math is shared with the accepted research source. */
import { ClosedBarSeries } from '../../research/closed-bars';
import { computeMacdValues } from '../../research/macd-features';
import { INDICATOR_SEED, timedExitAt } from './timed-indicator-signals';
import { MINUTE as M, epoch } from './contract';
import type { PortfolioSignal } from './allocation';
const TF = 240 * M, HOLD = 720 * M;
export interface MacdPublication {
  sourceEnd: number; knownAt: number; previous: number | null; current: number | null;
  close: number; crossing: boolean; exit: boolean;
}
export type MacdEntryDecision =
  | { status: 'outside_decision_window' | 'missing_bar' | 'inputs_unavailable' | 'warming_up' | 'no_signal' }
  | { status: 'signal'; signal: PortfolioSignal; feature: Readonly<MacdPublication>; arrivalDelayMs: number };
export interface MacdExitDecision {
  reason: 'timeout' | 'indicator'; causeAt: number; observedAt: number; executeAt: number; overdueMs: number;
}

/** Independent of fresh indicators: an absent/gapped feed cannot cancel timeout.
 * Persist the first returned decision. Do not keep recomputing an exit to postpone it.
 * Overdue exits remain immediately due, not eligible for a new 60-second grace.
 */
export function macdExitDecision(entryAt: number, now: number, publications: readonly MacdPublication[]): MacdExitDecision | null {
  epoch(entryAt); epoch(now); if (now < entryAt) throw new Error('exit observation precedes fill');
  const timeoutAt = entryAt + HOLD; epoch(timeoutAt);
  let causeAt = timeoutAt, reason: 'timeout' | 'indicator' = 'timeout';
  for (const p of publications) {
    epoch(p.sourceEnd); epoch(p.knownAt);
    if (p.sourceEnd % TF || p.knownAt < p.sourceEnd) throw new Error('invalid MACD publication');
    if (p.sourceEnd <= entryAt || p.knownAt > now || !p.exit) continue;
    if (p.current === null || !Number.isFinite(p.current) || p.current < 0) throw new Error('invalid MACD exit value');
    // Availability is real. Never use a publication before its final dependencies arrived.
    if (p.knownAt < causeAt) { causeAt = p.knownAt; reason = 'indicator'; }
  }
  if (causeAt > now) return null;
  const due = causeAt + M; epoch(due);
  return { reason, causeAt, observedAt: now, executeAt: Math.max(due, now), overdueMs: Math.max(0, now - due) };
}

export class MacdSignalMap {
  readonly rows: readonly Readonly<MacdPublication>[];
  private readonly byEnd = new Map<number, Readonly<MacdPublication>>();
  constructor(series: Pick<ClosedBarSeries, 'sourceIntervalMs' | 'targetIntervalMs' | 'bars'>) {
    if (series.sourceIntervalMs !== M || series.targetIntervalMs !== TF
      || series.bars[0]?.candle.timestamp !== INDICATOR_SEED) throw new Error('MACD fixed-seed minute prefix required');
    let knownAt = 0;
    for (const [i, b] of series.bars.entries()) {
      epoch(b.availableAt);
      if (b.candle.timestamp !== INDICATOR_SEED + i * TF || b.barEnd !== b.candle.timestamp + TF || b.availableAt < b.barEnd)
        throw new Error('MACD prefix incomplete or invalid');
    }
    const values = computeMacdValues(series.bars.map(b => b.candle), TF, 12, 26, 9);
    this.rows = Object.freeze(series.bars.map((b, i) => {
      knownAt = Math.max(knownAt, b.availableAt);
      const previous = i ? values[i - 1].macdHist : null, current = values[i].macdHist;
      const row = Object.freeze({ sourceEnd: b.barEnd, knownAt, previous, current, close: b.candle.close,
        crossing: previous !== null && current !== null && previous >= 0 && current < 0,
        exit: current !== null && current >= 0 });
      this.byEnd.set(row.sourceEnd, row); return row;
    }));
  }
  /** Historical decision is at bar end; real final receipt normally arrives a few
   * milliseconds later. Record actual decision time, preserving the +60s execution
   * boundary and signal ID. A missed decision minute is NOT a catch-up entry.
   * This arrival delta must be measured by the eventual integration replay/shadow.
   */
  entry(now: number): MacdEntryDecision {
    epoch(now);
    const end = Math.floor(now / M) * M;
    if (end % TF) return { status: 'outside_decision_window' };
    const f = this.byEnd.get(end);
    if (!f) return { status: 'missing_bar' };
    if (f.knownAt > now) return { status: 'inputs_unavailable' };
    if (f.previous === null || f.current === null) return { status: 'warming_up' };
    if (!f.crossing) return { status: 'no_signal' };
    return { status: 'signal', feature: f, arrivalDelayMs: now - end, signal: {
      id: 'I06:R3:' + end, source: 'R3', side: -1, decisionAt: now, knownAt: f.knownAt,
      eligibleAt: end + M, expiresAt: timedExitAt(end + M),
    } };
  }
  exit(entryAt: number, now: number): MacdExitDecision | null { return macdExitDecision(entryAt, now, this.rows); }
}
