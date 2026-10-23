/** Single-owner orchestration of the existing six source policies and scheduler.
 * No timers, REST clients or live enable switch. The entrypoint owns activation.
 * The main gate/exit-priority driver is composed by PortfolioRuntime.
 * Compose through the same serialized owner; never run independent account loops.
 */
import { MINUTE as M, epoch, positive } from './contract';
import { PortfolioExecutionCoordinator, type PortfolioExchangeSnapshot, type ExecutionResult } from './execution-coordinator';
import { cancelUnsubmittedReservation, type PortfolioLedger } from './ledger';
import { dueEntrySources, dueOwnedExits, expireUnsubmittedEntries, scheduleOwnedExits, sealEntryPoll,
  type EntryPoll, type EntryScheduleResult } from './lifecycle';
import type { MacdPublication } from './macd-signals';
import type { Decision } from './allocation';
import type { PortfolioMainRuntime } from './main-runtime';

export interface SetupFeedSnapshot {
  at: number; poll: EntryPoll;
  price: { price: number; priceKnownAt: number; markedThrough: number } | null;
  macdExits: MacdPublication[];
  health: { error: string | null; policyError: string | null; gapAt: number | null };
  loader: { error: string | null };
}
/** PortfolioFeedWorker satisfies this interface; tests can inject receipt clocks. */
export interface SetupFeedPort {
  request(now: number): void;
  latest(now: number): { ready: false; reason: string } | { ready: true; value: SetupFeedSnapshot };
}
export interface SetupTickReport {
  startedAt: number; endedAt: number; feedIssue: string | null; executionIssue: string | null;
  entryStatus: EntryScheduleResult['status'] | 'inputs_unavailable' | 'account_unavailable';
  decisions: Decision[]; submissions: { id: string; result: ExecutionResult }[];
  exitRequests: string[]; cancelledReservations: string[]; indicatorError: string | null;
}

/** Cash is independently observed; price is ONLY the previous completed minute.
 * Current bid/ask or venue marked equity must not leak into group admission.
 * Actual fees/funding already booked in cash are not subtracted a second time.
 */
export function closedMinuteEquity(s: PortfolioLedger, cash: NonNullable<PortfolioExchangeSnapshot['decisionCash']>,
  price: NonNullable<SetupFeedSnapshot['price']>, now: number): number {
  epoch(now); epoch(cash.observedAt); epoch(price.priceKnownAt); epoch(price.markedThrough); positive(price.price, 'decision close');
  if (cash.scope !== 'USDT_ONLY_HYPE_OWNED' || !Number.isFinite(cash.balance)
    || cash.observedAt > now || now - cash.observedAt > 5000 || price.priceKnownAt > now
    || price.markedThrough !== Math.floor(now / M) * M) throw new Error('invalid decision capital clocks/scope');
  return cash.balance + Object.values(s.lots).reduce((n, p) => n + p.side * (p.qty * price.price - p.cost), 0);
}

export class PortfolioSetupRuntime {
  private busy = false;
  private lastTickAt = -1;
  constructor(readonly execution: PortfolioExecutionCoordinator, private readonly feed: SetupFeedPort,
    private readonly options: { entriesAllowed: () => boolean; feeRate: number; clock?: () => number;
      main?: Pick<PortfolioMainRuntime, 'maintain'>; sizingProfile?: import('./sizing').SizingProfile }) {
    if (!Number.isFinite(options.feeRate) || options.feeRate < 0) throw new Error('invalid setup runtime fee');
  }
  private now(): number { const at = (this.options.clock ?? Date.now)(); epoch(at); return at; }
  private async maintain(): Promise<void> {
    // When composed with main, process its receipt consequences and pending S/R
    // actions too. Never reprice its TP ahead of its unimplemented exit priority.
    if (this.options.main) await this.options.main.maintain();
    else await this.execution.maintain();
  }
  private readFeed(report: SetupTickReport): SetupFeedSnapshot | null {
    const now = this.now();
    try {
      this.feed.request(now); // Synchronous enqueue only; never await worker work.
      const r = this.feed.latest(now);
      if (!r.ready) { report.feedIssue = r.reason; return null; }
      const v = structuredClone(r.value), windowAt = Math.floor(now / M) * M;
      if (!Number.isSafeInteger(v.at) || !Number.isSafeInteger(v.poll.observedAt)
        || v.at > now || now - v.at > 5000 || v.poll.windowAt !== windowAt
        || v.poll.observedAt > now || now - v.poll.observedAt > 5000) throw new Error('stale_or_future_feed');
      if (v.loader.error || v.health.error || v.health.policyError || v.health.gapAt !== null) {
        report.feedIssue = v.loader.error || v.health.error || v.health.policyError || 'minute_gap'; return null;
      }
      // Match PortfolioFeedWorker's consumer-time contract without admitting any
      // new signal inputs. MACD is the only pre-entry-minute publication.
      v.poll.observedAt = now;
      for (const row of v.poll.sources) if (row.signal?.source === 'R3') row.signal.decisionAt = now;
      report.feedIssue = null; return v;
    } catch {
      report.feedIssue = 'feed_read_failed'; return null;
    }
  }
  private updateSchedules(report: SetupTickReport): void {
    const now = this.now(), feed = this.readFeed(report), draft = this.execution.store.snapshot;
    const result = scheduleOwnedExits(draft, now, feed?.macdExits ?? []);
    const expired = expireUnsubmittedEntries(draft, now);
    const paused: string[] = [];
    if (!this.options.entriesAllowed()) for (const r of Object.values(draft.reservations)) {
      if (r.owner !== 'main' && !Object.values(draft.orders).some(i => i.kind === 'open' && i.lotId === r.id)) {
        cancelUnsubmittedReservation(draft, r.id, now, 'paused'); paused.push(r.id);
      }
    }
    if (result.changed.length || expired.length || paused.length)
      this.execution.store.transaction(s => { Object.assign(s, draft); });
    report.indicatorError ??= result.indicatorError;
    report.cancelledReservations.push(...expired, ...paused);
  }
  private async recordDueExits(report: SetupTickReport): Promise<void> {
    this.updateSchedules(report);
    for (const plan of dueOwnedExits(this.execution.store.snapshot, this.now())) {
      const old = this.execution.store.snapshot.exitRequests?.[plan.owner];
      if (old && old.completedAt === undefined) continue;
      const result = await this.execution.requestExit(plan.owner, plan.reason);
      if (result.reason === 'owned_exit_recorded') report.exitRequests.push(plan.lotId);
    }
  }
  private async serviceExits(report: SetupTickReport): Promise<void> {
    // A durable exit request is not an exchange write or a slot release. Record
    // known deadlines BEFORE slow reads; maintain still reconciles/quiesces and
    // freshly validates the residual before submitting anything.
    await this.recordDueExits(report);
    await this.maintain();
    await this.recordDueExits(report); // Includes newly received/earlier fills.
    // Bounded submit-then-receipt passes, never a polling/sleep loop. A synchronous
    // fill still needs the independent receipt read and durable exit completion
    // before same-window PA07/timed-source reuse. Ambiguity stays occupied.
    for (let pass = 0; pass < 2; pass++) {
      if (!Object.values(this.execution.store.snapshot.exitRequests ?? {}).some(r => r.completedAt === undefined)) break;
      await this.maintain(); await this.recordDueExits(report);
    }
  }
  /** Priority checkpoints for the composed owner; entries are never admitted here. */
  async serviceDueExits(): Promise<void> {
    if (this.busy) throw new Error('setup runtime tick already in flight');
    const at = this.now(); this.busy = true;
    try { await this.serviceExits({ startedAt: at, endedAt: at, feedIssue: null, executionIssue: null,
      entryStatus: 'outside_window', decisions: [], submissions: [], exitRequests: [], cancelledReservations: [], indicatorError: null }); }
    finally { this.busy = false; }
  }
  private async seal(report: SetupTickReport): Promise<void> {
    let now = this.now(); const due = dueEntrySources(now);
    if (!due.length) { report.entryStatus = 'outside_window'; return; }
    const cursor = this.execution.store.snapshot.lifecycle?.entries, windowAt = Math.floor(now / M) * M;
    if (due.every(source => cursor?.[source]?.windowAt === windowAt)) { report.entryStatus = 'already_sealed'; return; }
    if (!this.readFeed(report)?.price) { report.entryStatus = 'inputs_unavailable'; return; }
    const evidence = await this.execution.admissionEvidence();
    if (!evidence) { report.entryStatus = 'account_unavailable'; return; }
    // The await can cross a minute boundary. Do NOT use the earlier poll/group.
    now = this.now();
    if (Math.floor(now / M) * M !== windowAt) { report.entryStatus = 'outside_window'; return; }
    const value = this.readFeed(report);
    if (!value?.price) { report.entryStatus = 'inputs_unavailable'; return; }
    const draft = this.execution.store.snapshot;
    const equity = closedMinuteEquity(draft, evidence.decisionCash!, value.price, now);
    const result = sealEntryPoll(draft, value.poll, { ...value.price, equity,
      equityKnownAt: evidence.decisionCash!.observedAt, feeRate: this.options.feeRate,
      sizingProfile: this.options.sizingProfile,
      entriesBlocked: !this.options.entriesAllowed() });
    if (result.status === 'sealed') this.execution.store.transaction(s => { Object.assign(s, draft); });
    report.entryStatus = result.status; report.decisions = result.decisions;
  }
  async tick(): Promise<SetupTickReport> {
    if (this.busy) throw new Error('setup runtime tick already in flight');
    const startedAt = this.now();
    if (startedAt < this.lastTickAt) throw new Error('setup runtime clock reversed');
    this.lastTickAt = startedAt; this.busy = true;
    const report: SetupTickReport = { startedAt, endedAt: startedAt, feedIssue: null, executionIssue: null,
      entryStatus: 'outside_window', decisions: [], submissions: [], exitRequests: [], cancelledReservations: [], indicatorError: null };
    try {
      await this.serviceExits(report);
      await this.seal(report); // Whole group durable BEFORE any entry submission.
      const queued = Object.values(this.execution.store.snapshot.reservations)
        .filter(r => r.owner !== 'main').sort((a, b) => a.decisionAt - b.decisionAt || a.id.localeCompare(b.id));
      for (const r of queued) {
        // Never replay an ambiguous command; only receipt recovery can resolve it.
        if (Object.values(this.execution.store.snapshot.orders).some(i => i.kind === 'open' && i.lotId === r.id)) continue;
        if (this.now() < r.eligibleAt) continue;
        await this.serviceExits(report); // A slow preceding request can make exits due.
        if (!this.execution.store.snapshot.reservations[r.id] || !this.options.entriesAllowed()) continue;
        const result = await this.execution.open(r.id);
        report.submissions.push({ id: r.id, result });
        if (result.state === 'pending') break;
      }
      await this.maintain(); this.updateSchedules(report);
      report.executionIssue = this.execution.lastIssue ?? this.execution.store.snapshot.recovery;
      return report;
    } finally { report.endedAt = this.now(); this.busy = false; }
  }
}
