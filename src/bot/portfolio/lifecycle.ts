/** Pure scheduling over the durable ledger. Caller commits with PortfolioStore
 * BEFORE any side effect. No clients, orders, full-prefix scans or forming bars.
 * Entries and exits are separate: a failed entry feed must not freeze timeouts.
 */
import { MINUTE as M, epoch, type SetupSource } from './contract';
import { reserveGroup, cancelUnsubmittedReservation, type PortfolioLedger } from './ledger';
import { emptyLifecycle, type ExitSchedule } from './lifecycle-state';
import { timedExitAt, TIMED_RULES, type TimedSource, type TimedIndicatorMap } from './timed-indicator-signals';
import { macdExitDecision, type MacdPublication, type MacdSignalMap } from './macd-signals';
import type { StructuralSignalMap } from './structural-signals';
import type { PortfolioSignal, Decision } from './allocation';

export interface SourceObservation { source: SetupSource; status: string; signal?: PortfolioSignal; }
export interface EntryPoll { windowAt: number; observedAt: number; sources: SourceObservation[]; }
export interface SourcePolicies {
  timed?: Partial<Record<TimedSource, Pick<TimedIndicatorMap, 'decision'>>>;
  structural?: Pick<StructuralSignalMap, 'decision'>;
  macd?: Pick<MacdSignalMap, 'entry'>;
}
const periods: Record<SetupSource, number> = { SF08: 240 * M, PA07: 60 * M,
  L2: TIMED_RULES.L2.timeframe, R5: TIMED_RULES.R5.timeframe, CRSI: TIMED_RULES.CRSI.timeframe, R3: 240 * M };
const isTimed = (s: SetupSource): s is TimedSource => s === 'L2' || s === 'R5' || s === 'CRSI';
export function dueEntrySources(now: number): SetupSource[] {
  epoch(now); const t = Math.floor(now / M) * M;
  return (Object.keys(periods) as SetupSource[]).filter(s => s === 'R3' ? t % periods[s] === 0
    : t >= M && (t - M) % periods[s] === 0);
}

/** Evaluate ALL sources scheduled for this minute before allocation. The five
 * slot sources never retry late data. R3 may await the final receipt only within
 * its pre-entry minute; its reservation uses the actual observation clock.
 */
export function readEntryPoll(now: number, policies: SourcePolicies): EntryPoll {
  epoch(now);
  const sources = dueEntrySources(now).map(source => {
    const d = source === 'R3' ? policies.macd?.entry(now)
      : isTimed(source) ? policies.timed?.[source]?.decision(now) : policies.structural?.decision(source, now);
    return { source, status: d?.status ?? 'inputs_unavailable',
      ...(d?.status === 'signal' ? { signal: d.signal } : {}) };
  });
  return { windowAt: Math.floor(now / M) * M, observedAt: now, sources };
}

export interface DecisionMark {
  price: number; priceKnownAt: number; equity: number; equityKnownAt: number;
  /** End of the last fully completed minute used to mark every owned lot. */
  markedThrough: number; feeRate: number; entriesBlocked?: boolean;
}
export interface EntryScheduleResult {
  status: 'outside_window' | 'already_sealed' | 'awaiting_receipt' | 'sealed'; decisions: Decision[];
}
export function sealEntryPoll(s: PortfolioLedger, poll: EntryPoll, mark: DecisionMark): EntryScheduleResult {
  epoch(poll.windowAt); epoch(poll.observedAt);
  if (Math.floor(poll.observedAt / M) * M !== poll.windowAt) throw new Error('entry poll window mismatch');
  const due = dueEntrySources(poll.observedAt);
  if (new Set(poll.sources.map(x => x.source)).size !== due.length || poll.sources.length !== due.length
    || poll.sources.some(x => !due.includes(x.source))) throw new Error('incomplete same-clock source group');
  if (!due.length) return { status: 'outside_window', decisions: [] };
  const life = s.lifecycle;
  const cursors = due.map(src => life?.entries[src]);
  if (cursors.some(c => c && (c.windowAt > poll.windowAt || c.observedAt > poll.observedAt)))
    throw new Error('entry observation clock reversed');
  const sealed = cursors.filter(c => c?.windowAt === poll.windowAt).length;
  if (sealed === due.length) return { status: 'already_sealed', decisions: [] };
  if (sealed) throw new Error('partially sealed source group');
  const statuses = new Set(['signal', 'no_signal', 'missing_bar', 'inputs_unavailable', 'late_inputs', 'warming_up']);
  for (const r of poll.sources) {
    if (!statuses.has(r.status) || (r.status === 'signal') !== !!r.signal || (r.signal && r.signal.source !== r.source))
      throw new Error('invalid source observation');
    if (r.signal && (r.signal.decisionAt > poll.observedAt
      || r.signal.eligibleAt !== poll.windowAt + (r.source === 'R3' ? M : 0)))
      throw new Error('signal not in its original window');
  }
  if (due[0] === 'R3' && ['missing_bar', 'inputs_unavailable'].includes(poll.sources[0].status))
    return { status: 'awaiting_receipt', decisions: [] };
  // A finalized mark normally arrives after the nominal boundary. Record the
  // actual observation without admitting later SIGNAL inputs or extending entry.
  const at = poll.observedAt;
  epoch(mark.markedThrough); epoch(mark.equityKnownAt);
  if (mark.markedThrough !== poll.windowAt || mark.equityKnownAt > at)
    throw new Error('stale or future decision equity');
  const decisions = reserveGroup(s, { ...mark, at, signals: poll.sources.flatMap(r => r.signal
    ? [{ ...r.signal, decisionAt: at }] : []) });
  s.lifecycle ??= emptyLifecycle();
  for (const r of poll.sources) s.lifecycle.entries[r.source] = { windowAt: poll.windowAt,
    observedAt: poll.observedAt, status: r.status, ...(r.signal ? { signalId: r.signal.id } : {}) };
  return { status: 'sealed', decisions };
}

/** Reservation expiry never cancels an ambiguous exchange submission. Such an
 * intent stays owned until the normal receipt/terminal-evidence path resolves it.
 */
export function expireUnsubmittedEntries(s: PortfolioLedger, now: number): string[] {
  epoch(now); const expired: string[] = [];
  for (const r of Object.values(s.reservations)) {
    if (Object.values(s.orders).some(o => o.kind === 'open' && o.lotId === r.id)) continue;
    if (now < Math.min(r.expiresAt, r.eligibleAt + M)) continue;
    cancelUnsubmittedReservation(s, r.id, now, 'expired'); expired.push(r.id);
  }
  return expired;
}

/** Record timeout on the first fill, not the final partial fill, ack or restart.
 * A later-delivered EARLIER execution can tighten the deadline, never extend it.
 * Structural targets keep their original signal deadline. MACD can bring the
 * timeout forward; its first observed exit is immutable against later revisions.
 */
export function scheduleOwnedExits(s: PortfolioLedger, now: number,
  publications: readonly MacdPublication[] = []): { changed: string[]; indicatorError: string | null } {
  epoch(now); const changed: string[] = []; let indicatorError: string | null = null;
  for (const lot of Object.values(s.lots)) {
    if (lot.source === 'main') continue;
    if (lot.openedAt > now) throw new Error('future owned fill');
    const opens = Object.values(s.orders).filter(o => o.kind === 'open' && o.lotId === lot.id);
    if (opens.length !== 1 || !opens[0].reservation || opens[0].owner !== lot.owner || opens[0].source !== lot.source)
      throw new Error('exit has no unique owned entry intent');
    const structural = lot.source === 'SF08' || lot.source === 'PA07';
    const dueAt = structural ? opens[0].reservation!.expiresAt : timedExitAt(lot.openedAt);
    let plan: ExitSchedule = { lotId: lot.id, owner: lot.owner, source: lot.source,
      entryAt: lot.openedAt, reason: 'timeout', causeAt: structural ? dueAt : dueAt - M, dueAt, recordedAt: now };
    const old = s.lifecycle?.exits[lot.id];
    if (old && (old.owner !== lot.owner || old.source !== lot.source)) throw new Error('exit owner mismatch');
    if (lot.source === 'R3' && old?.reason !== 'indicator') {
      try {
        const d = macdExitDecision(lot.openedAt, now, publications);
        if (d?.reason === 'indicator') plan = { ...plan, reason: 'indicator', causeAt: d.causeAt, dueAt: d.causeAt + M };
      } catch (e) {
        // Fail closed for the indicator, NOT for the independently known timeout.
        indicatorError = e instanceof Error ? e.message : String(e);
      }
    }
    if (!old || plan.dueAt < old.dueAt) {
      s.lifecycle ??= emptyLifecycle(); s.lifecycle.exits[lot.id] = plan; changed.push(lot.id);
    }
  }
  return { changed, indicatorError };
}

/** Candidates only, not submission permission: the account coordinator must still
 * quiesce quantity-owned brackets and verify current exchange execution evidence.
 * Outstanding entry/close intents retain ownership, even if the timeout is overdue.
 */
export function dueOwnedExits(s: PortfolioLedger, now: number) {
  epoch(now);
  return Object.values(s.lifecycle?.exits ?? {}).filter(p => p.dueAt <= now && s.lots[p.lotId]).map(p => {
    const lot = s.lots[p.lotId];
    if (lot.owner !== p.owner || lot.source !== p.source) throw new Error('due exit ownership mismatch');
    return { ...p, qty: lot.qty, overdueMs: now - p.dueAt,
      unresolvedOrder: Object.values(s.orders).some(o => o.owner === p.owner && !o.terminal) };
  }).sort((a, b) => a.dueAt - b.dueAt || a.lotId.localeCompare(b.lotId));
}
