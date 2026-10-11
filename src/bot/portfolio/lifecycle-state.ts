/** Persisted scheduling facts, kept inside the same atomic envelope as owned lots. */
import { MINUTE as M, epoch, owner, source, type Owner, type SetupSource } from './contract';

export interface EntryCursor {
  windowAt: number; observedAt: number; status: string; signalId?: string;
}
export interface ExitSchedule {
  lotId: string; owner: Owner; source: SetupSource; entryAt: number;
  reason: 'timeout' | 'indicator'; causeAt: number; dueAt: number; recordedAt: number;
}
export interface LifecycleState {
  version: 1;
  entries: Partial<Record<SetupSource, EntryCursor>>;
  exits: Record<string, ExitSchedule>;
}
export const emptyLifecycle = (): LifecycleState => ({ version: 1, entries: {}, exits: {} });
export function validateLifecycle(s: LifecycleState): void {
  if (!s || s.version !== 1) throw new Error('invalid portfolio lifecycle');
  for (const v of [s.entries, s.exits])
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('invalid lifecycle collection');
  for (const [key, c] of Object.entries(s.entries)) {
    source(key); epoch(c.windowAt); epoch(c.observedAt);
    if (key === 'main' || c.windowAt % M || c.observedAt < c.windowAt || c.observedAt >= c.windowAt + M
      || !['signal', 'no_signal', 'missing_bar', 'inputs_unavailable', 'late_inputs', 'warming_up'].includes(c.status)
      || (c.status === 'signal') !== !!c.signalId
      || (c.signalId !== undefined && (typeof c.signalId !== 'string' || !c.signalId)))
      throw new Error('invalid entry cursor');
  }
  for (const [id, e] of Object.entries(s.exits)) {
    owner(e.owner); source(e.source);
    for (const at of [e.entryAt, e.causeAt, e.dueAt, e.recordedAt]) epoch(at);
    const structural = e.source === 'SF08' || e.source === 'PA07';
    if (e.lotId !== id || !id || e.owner === 'main' || String(e.source) === 'main'
      || (e.owner === 'R3') !== (e.source === 'R3') || (!structural && e.causeAt < e.entryAt)
      || e.dueAt < e.causeAt || e.recordedAt < e.entryAt
      || !['timeout', 'indicator'].includes(e.reason) || (e.reason === 'indicator' && e.source !== 'R3'))
      throw new Error('invalid exit schedule');
    // A structural fill arriving after its fixed signal deadline is already overdue,
    // not entitled to a new hold. Timed sources retain first-fill + 12h + 60s.
    if (structural ? e.dueAt !== e.causeAt
      : e.dueAt !== e.causeAt + M || (e.reason === 'timeout' && e.causeAt !== e.entryAt + 720 * M))
      throw new Error('exit schedule clock mismatch');
  }
}
