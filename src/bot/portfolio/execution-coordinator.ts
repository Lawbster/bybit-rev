/** Single account writer; virtual inventory is always receipt-owned.
 * Live transport is restricted to the approved account and frozen leverage.
 */
import { randomBytes } from 'crypto';
import { admission, fillReserves } from './capital';
import { MINUTE, epoch, positive, type Owner } from './contract';
import { PortfolioOwnerLease } from './owner-lock';
import { checkLotRules, orderQuantity, type PortfolioOrderCommand, type PortfolioLotRules } from './order-command';
import { protectiveCommand, isRestingProtectionStatus, type ProtectionKind } from './protection';
import { attachedBracketCommand, beginAttachedBracket, observeAttachedBracket } from './attached-bracket';
import { childOpenKey, childTerminal, type BracketEvidence } from './bracket-state';
import type { PortfolioWriteRequest } from './bybit-orders';
import { validateMainCloseTerms, type MainCloseTerms } from './main-control-state';
import { PortfolioStore, applyExecution, finishOrder, ownedTotals, prepareClose, prepareOpen, reconcile,
  type Execution, type Intent, type PortfolioLedger } from './ledger';

export interface PortfolioExchangeSnapshot {
  uid: string; symbol: 'HYPEUSDT'; observedAt: number;
  hedgeMode: boolean; leverageLong: number; leverageShort: number;
  longQty: number; shortQty: number; openLinks: string[];
  /** Full-side native protection is forbidden on this shared book. */
  nativeProtection: boolean;
  equity: number; availableBalance: number; bid: number; ask: number;
  /** Optional until a venue adapter proves this scope. Cash includes booked fees,
   * realized PnL and funding, but excludes unrealized PnL. It must describe this
   * reconciled book, with no other collateral/positions. Never substitute equity.
   */
  decisionCash?: { balance: number; observedAt: number; scope: 'USDT_ONLY_HYPE_OWNED' };
  rules: PortfolioLotRules;
}
export type PortfolioOrderEvidence = {
  uid: string; symbol: 'HYPEUSDT'; link: string; observedAt: number;
} & ({ found: false } | {
  found: true; orderId: string; side: 'Buy' | 'Sell'; positionIdx: 1 | 2;
  qty: number; reduceOnly: boolean;
  status: 'New' | 'PartiallyFilled' | 'Filled' | 'Cancelled' | 'Rejected' | 'Untriggered' | 'Triggered';
  protection?: PortfolioOrderCommand['protection'];
  bracket?: PortfolioOrderCommand['bracket'];
  cumulativeQty: number;
  /** Complete executions for this order, not an unpaginated recent tail. */
  executions: Execution[];
});
export interface PortfolioExecutionPort {
  readonly transport: 'simulation' | 'bybit';
  snapshot(): Promise<PortfolioExchangeSnapshot>;
  submit(command: Readonly<PortfolioOrderCommand>): Promise<{ orderId?: string }>;
  observe(command: Readonly<PortfolioOrderCommand>): Promise<PortfolioOrderEvidence>;
  cancel(command: Readonly<PortfolioOrderCommand>): Promise<void>;
  /** Optional paired-protection capability, implemented by the Bybit adapter.
   * Discovery must include terminal history and all pages, plus known-ID lookups.
   * Snapshot openLinks uses childOpenKey(orderId) for venue-created children.
   */
  attached?: {
    observe(parent: Readonly<PortfolioOrderCommand>, knownIds: readonly string[]): Promise<BracketEvidence>;
    cancel(parent: Readonly<PortfolioOrderCommand>, childOrderId: string): Promise<void>;
  };
}
export interface PortfolioExecutionOptions {
  /** Single exchange leverage is distinct from 25x/3x internal reserve budgets. */
  exchangeLeverage: number; feeRate: number;
  entriesAllowed: () => boolean;
  clock?: () => number;
}
export type ExecutionResult = { state: 'submitted' | 'pending' | 'blocked' | 'settled'; reason?: string; link?: string };
const EPS = 1e-8, MAX_EVIDENCE_AGE = 5000;
const pending = (s: PortfolioLedger) =>
  Object.values(s.orders).filter(i => !i.terminal);

export interface PortfolioServiceTiming {
  refreshes: number; reusedMaintenance: number; refreshMs: number; accountMs: number; protectionMs: number;
}
const emptyTiming = (): PortfolioServiceTiming => ({ refreshes: 0, reusedMaintenance: 0, refreshMs: 0, accountMs: 0, protectionMs: 0 });

export class PortfolioExecutionCoordinator {
  private busy = false;
  private closed = false;
  private observedResting = new Set<string>();
  private observedBrackets = new Set<string>();
  private readonly clock: () => number;
  private serviceCycle = false;
  private maintenanceCache: { at: number; book: string; result: { pending: number; resting: number; issue: string | null } } | null = null;
  private timing = emptyTiming();
  get serviceTiming(): PortfolioServiceTiming { return { ...this.timing }; }
  /** Only the assembled serial owner may reuse unchanged servicing. Never a
   * cross-loop cache, and never submission/admission/cancellation permission. */
  async withServiceCycle<T>(run: () => Promise<T>): Promise<T> {
    this.held();
    if (this.serviceCycle || this.busy) throw new Error('portfolio service cycle already running');
    this.serviceCycle = true; this.maintenanceCache = null; this.timing = emptyTiming();
    try { return await run(); }
    finally { this.serviceCycle = false; this.maintenanceCache = null; }
  }
  private serviceBook(s: PortfolioLedger): string {
    // Policy/gate bookkeeping need not reread the exchange. Anything affecting
    // receipts, inventory, reservations or exits invalidates the service proof.
    return JSON.stringify([s.orders, s.executions, s.lots, s.brackets, s.reservations, s.exitRequests, s.recovery]);
  }
  lastIssue: string | null = null;
  private constructor(readonly store: PortfolioStore, private readonly lease: PortfolioOwnerLease,
    private readonly port: PortfolioExecutionPort, private readonly options: PortfolioExecutionOptions) {
    if (port.transport !== 'simulation' && (port.transport !== 'bybit' || store.uid !== '555249668' || options.exchangeLeverage !== 25))
      throw new Error('live portfolio transport requires approved UID and 25x');
    positive(options.exchangeLeverage, 'exchange leverage');
    if (!Number.isFinite(options.feeRate) || options.feeRate < 0) throw new Error('invalid portfolio fee');
    this.clock = options.clock ?? Date.now;
  }
  static acquire(args: { file: string; lockDirectory: string; uid: string; port: PortfolioExecutionPort;
    options: PortfolioExecutionOptions }): PortfolioExecutionCoordinator {
    const lease = new PortfolioOwnerLease(args.lockDirectory, args.uid);
    try {
      // Load state only AFTER both side leases: never trade from a pre-lock copy.
      return new PortfolioExecutionCoordinator(new PortfolioStore(args.file, args.uid), lease, args.port, args.options);
    } catch (e) { lease.release(); throw e; }
  }
  shutdown(): void {
    if (this.busy) throw new Error('cannot release owner while an account operation is pending');
    this.closed = true; this.lease.release();
  }
  private held(): void {
    if (this.closed) throw new Error('portfolio coordinator closed');
    this.lease.assertHeld(this.store.uid);
  }
  /** The transport checks this directly before mutation, after any ownership
   * discovery awaits. A read-only caller cannot obtain a write permit. */
  authorizeWrite(r: PortfolioWriteRequest): true {
    this.held();
    const i = this.store.snapshot.orders[r.command.link];
    if (!this.busy || !i?.command || JSON.stringify(i.command) !== JSON.stringify(r.command))
      throw new Error('portfolio write lacks held durable intent');
    if (r.kind === 'submit' && (i.terminal || i.orderId || i.appliedQty > 0)) throw new Error('portfolio submission already observed');
    if (r.kind === 'cancel' && (i.cancelRequestedAt === undefined || i.orderId && i.orderId !== r.orderId))
      throw new Error('portfolio cancel intent missing');
    if (r.kind === 'cancel_child') {
      const b = this.store.snapshot.brackets?.[i.link];
      if (!b || b.cancelRequestedAt === undefined || !b.children.some(c => c.orderId === r.orderId))
        throw new Error('portfolio child cancel intent missing');
    }
    return true;
  }
  private async exclusive<T>(run: () => Promise<T>, maintenance = false): Promise<T> {
    this.held();
    // Fail fast, do not queue stale entries behind an exchange request.
    if (this.busy) throw new Error('portfolio account operation already in flight');
    if (!maintenance) this.maintenanceCache = null;
    this.busy = true;
    try { return await run(); } finally { this.busy = false; }
  }
  private fresh(at: number): void {
    epoch(at); const now = this.clock(); epoch(now);
    if (at > now || now - at > MAX_EVIDENCE_AGE) throw new Error('stale or future exchange evidence');
  }
  private incident(reason: string): void {
    this.held(); this.lastIssue = reason;
    if (this.store.snapshot.recovery !== reason) this.store.transaction(s => { s.recovery = reason; });
  }
  private async snapshot(): Promise<PortfolioExchangeSnapshot> {
    const started = this.clock();
    let p: PortfolioExchangeSnapshot;
    try { p = await this.port.snapshot(); }
    finally { this.timing.accountMs += this.clock() - started; }
    this.held(); this.fresh(p.observedAt);
    if (p.uid !== this.store.uid || p.symbol !== 'HYPEUSDT') {
      this.incident('account_identity_mismatch'); throw new Error('account identity mismatch');
    }
    if (p.hedgeMode !== true || p.leverageLong !== this.options.exchangeLeverage || p.leverageShort !== this.options.exchangeLeverage
      || p.nativeProtection !== false) throw new Error('account mode/leverage/full-side protection incompatible');
    for (const n of [p.equity, p.availableBalance, p.longQty, p.shortQty])
      if (!Number.isFinite(n) || n < 0) throw new Error('invalid account evidence');
    positive(p.bid, 'bid'); positive(p.ask, 'ask'); checkLotRules(p.rules);
    if (p.bid > p.ask || !Array.isArray(p.openLinks) || new Set(p.openLinks).size !== p.openLinks.length)
      throw new Error('invalid exchange snapshot');
    return p;
  }
  private async settle(i: Intent): Promise<boolean> {
    if (!i.command) throw new Error('unresolved order lacks a durable command; manual migration required');
    const e = await this.port.observe(structuredClone(i.command)); this.held(); this.fresh(e.observedAt);
    if (e.uid !== this.store.uid || e.symbol !== 'HYPEUSDT' || e.link !== i.link || e.observedAt < i.at)
      throw new Error('order evidence identity/clock mismatch');
    if (!e.found) { this.lastIssue = 'order_not_found_is_not_terminal'; return false; }
    if (!e.orderId || (i.orderId && i.orderId !== e.orderId) || e.side !== i.command.side
      || e.positionIdx !== i.command.positionIdx || e.reduceOnly !== i.command.reduceOnly
      || Math.abs(e.qty - i.qty) > EPS || !Number.isFinite(e.qty) || !Number.isFinite(e.cumulativeQty)
      || e.cumulativeQty < 0 || e.cumulativeQty > i.qty + EPS
      || JSON.stringify(e.protection) !== JSON.stringify(i.command.protection)
      || JSON.stringify(e.bracket) !== JSON.stringify(i.command.bracket)
      || !['New', 'PartiallyFilled', 'Filled', 'Cancelled', 'Rejected', 'Untriggered', 'Triggered'].includes(e.status))
      throw new Error('order evidence disagrees with durable command');
    if (!Array.isArray(e.executions) || new Set(e.executions.map(f => f.id)).size !== e.executions.length
      || e.executions.some(f => f.link !== i.link || f.orderId !== e.orderId)) throw new Error('invalid execution evidence set');
    const total = e.executions.reduce((n, f) => n + f.qty, 0);
    // Eventual consistency is not a fill. Retain the intent and its full budget.
    const old = Object.values(this.store.snapshot.executions).filter(f => f.link === i.link);
    if (!Number.isFinite(total) || Math.abs(total - e.cumulativeQty) > EPS
      || old.some(f => !e.executions.some(x => x.id === f.id))) {
      this.lastIssue = 'execution_history_incomplete'; return false;
    }
    if (old.some(f => JSON.stringify(f) !== JSON.stringify(e.executions.find(x => x.id === f.id))))
      throw new Error('conflicting previously applied execution');
    const terminal = ['Filled', 'Cancelled', 'Rejected'].includes(e.status);
    const resting = isRestingProtectionStatus(this.store.snapshot.orders[i.link], e.status) && e.cumulativeQty < i.qty - EPS;
    // Fresh evidence is checked every time, but an unchanged resting heartbeat
    // need not rewrite the complete durable book on every poll.
    const changed = i.orderId !== e.orderId || e.executions.length !== old.length
      || (terminal && !i.terminal) || (resting && i.restingConfirmedAt === undefined);
    this.held();
    if (changed) this.store.transaction(s => {
      s.orders[i.link].orderId = e.orderId;
      for (const f of [...e.executions].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))) applyExecution(s, f, e.observedAt);
      if (terminal)
        finishOrder(s, i.link, e.status as 'Filled' | 'Cancelled' | 'Rejected', e.cumulativeQty, e.observedAt);
      else if (isRestingProtectionStatus(s.orders[i.link], e.status) && e.cumulativeQty < i.qty - EPS)
        s.orders[i.link].restingConfirmedAt ??= e.observedAt;
    });
    if (resting) this.observedResting.add(i.link);
    return this.store.snapshot.orders[i.link].terminal;
  }
  private async refresh(): Promise<PortfolioExchangeSnapshot | null> {
    this.maintenanceCache = null;
    const started = this.clock(); this.timing.refreshes++;
    try { return await this.refreshUncached(); }
    finally { this.timing.refreshMs += this.clock() - started; }
  }
  private async refreshUncached(): Promise<PortfolioExchangeSnapshot | null> {
    this.lastIssue = null;
    this.observedResting.clear();
    this.observedBrackets.clear();
    for (const i of pending(this.store.snapshot)) await this.settle(i);
    // Query children even when the entry is only partially filled or its ack was lost.
    for (const b of Object.values(this.store.snapshot.brackets ?? {}))
      if (b.completedAt === undefined) await this.settleBracket(b.parentLink);
    if (pending(this.store.snapshot).some(i => !this.observedResting.has(i.link))) { this.lastIssue ??= 'order_evidence_pending'; return null; }
    if (Object.values(this.store.snapshot.brackets ?? {}).some(b => b.completedAt === undefined && !this.observedBrackets.has(b.parentLink))) {
      this.lastIssue ??= 'attached_protection_evidence_pending'; return null;
    }
    const snap = await this.snapshot();
    const s = this.store.snapshot, totals = ownedTotals(s);
    const childKeys = [...this.observedBrackets].flatMap(link => s.brackets![link].children.filter(c => !childTerminal(c)).map(c => childOpenKey(c.orderId)));
    // A resting order can fill between its observation and the position query.
    // Defer mutations until receipts catch up, never guess a fill from size alone.
    if ((this.observedResting.size || childKeys.length) && (Math.abs(snap.longQty - totals.longQty) > EPS || Math.abs(snap.shortQty - totals.shortQty) > EPS
      || [...this.observedResting, ...childKeys].some(link => !snap.openLinks.includes(link)))) {
      this.lastIssue = 'protection_changed_during_observation'; return null;
    }
    const issue = reconcile(s, { ...snap, openLinks: snap.openLinks.filter(k => !childKeys.includes(k)) }, EPS, [...this.observedResting]);
    if (issue) { this.incident(issue); return null; }
    return snap;
  }
  private async settleBracket(link: string): Promise<'pending' | 'resting' | 'settled'> {
    const s = this.store.snapshot, b = s.brackets?.[link], parent = s.orders[link];
    if (!b || !parent?.command || !this.port.attached) throw new Error('attached protection transport unavailable');
    const started = this.clock(); let e: BracketEvidence;
    try { e = await this.port.attached.observe(structuredClone(parent.command), b.children.map(c => c.orderId)); }
    finally { this.timing.protectionMs += this.clock() - started; }
    this.held(); this.fresh(e.observedAt);
    if (e.parentLink !== link) { this.incident('attached_protection_evidence_invalid'); throw new Error('wrong attached parent response'); }
    let result: 'pending' | 'resting' | 'settled';
    // Validate the whole evidence set atomically; bad second-leg evidence must
    // never leave the first leg's accounting half committed.
    const draft = this.store.snapshot;
    try {
      result = observeAttachedBracket(draft, e);
      const current = draft.brackets![link], p = draft.orders[link], oldExit = draft.exitRequests?.[p.owner];
      const fired = current.children.find(c => c.cumulativeQty > 0 || ['Triggered', 'New', 'PartiallyFilled'].includes(c.status));
      const lostProtection = current.children.some(c => ['Cancelled', 'Rejected'].includes(c.status));
      const bounds = p.command!.bracket!;
      const outside = Object.values(draft.executions).some(f => f.link === link
        && (p.side === 1 ? f.price <= Number(bounds.stop) || f.price >= Number(bounds.target)
          : f.price >= Number(bounds.stop) || f.price <= Number(bounds.target)));
      // Unexpected loss of a verified leg must not silently leave inventory
      // unprotected while the rest of the book continues entering. Complete its
      // owned exit through the same cancel/receipt/residual path as a timeout.
      if ((fired || lostProtection || outside) && (!oldExit || oldExit.completedAt !== undefined)
        && (draft.lots[p.lotId] || current.completedAt === undefined)) {
        draft.exitRequests ??= {}; draft.exitRequests[p.owner] = { owner: p.owner, source: p.source,
          reason: fired ? (fired.kind === 'tp' ? 'target' : 'stop') : outside ? 'invalid_entry_fill' : 'protection_failure',
          requestedAt: e.observedAt, notBefore: e.observedAt, lotIds: [p.lotId], marketLinks: [] };
      }
    }
    catch (error) { this.incident('attached_protection_evidence_invalid'); throw error; }
    if (JSON.stringify(draft) !== JSON.stringify(this.store.snapshot))
      this.store.transaction(d => { Object.assign(d, draft); });
    if (result === 'resting') this.observedBrackets.add(link);
    else this.observedBrackets.delete(link);
    return result;
  }
  private activeBracket(owner: Owner): boolean {
    const s = this.store.snapshot;
    return Object.values(s.brackets ?? {}).some(b => b.completedAt === undefined && s.orders[b.parentLink].owner === owner);
  }
  async maintain(): Promise<{ pending: number; resting: number; issue: string | null }> {
    return this.exclusive(async () => {
      const at = this.clock(), before = this.store.snapshot, cache = this.maintenanceCache;
      if (this.serviceCycle && cache && at >= cache.at && at - cache.at < MAX_EVIDENCE_AGE
        && !this.lastIssue && !before.recovery && cache.book === this.serviceBook(before)
        && !Object.values(before.exitRequests ?? {}).some(r => r.completedAt === undefined)) {
        this.timing.reusedMaintenance++;
        return { ...cache.result };
      }
      const snap = await this.refresh();
      if (snap) this.checkFilledCapital(snap);
      for (const r of Object.values(this.store.snapshot.exitRequests ?? {}))
        if (r.completedAt === undefined) await this.advanceExit(r.owner);
      const result = { pending: pending(this.store.snapshot).filter(i => !this.observedResting.has(i.link)).length
          + Object.values(this.store.snapshot.brackets ?? {}).filter(b => b.completedAt === undefined && !this.observedBrackets.has(b.parentLink)).length,
        resting: this.observedResting.size + 2 * this.observedBrackets.size, issue: this.lastIssue ?? this.store.snapshot.recovery };
      const after = this.store.snapshot;
      if (this.serviceCycle && snap && !result.pending && !result.issue
        && !Object.values(after.exitRequests ?? {}).some(r => r.completedAt === undefined))
        this.maintenanceCache = { at: Math.min(at, snap.observedAt), book: this.serviceBook(after), result };
      return result;
    }, true);
  }
  /** Reconciled evidence for causal decision-time capital, not submission
   * permission. Submission independently refreshes actual equity/available funds.
   * Missing cash evidence blocks entries, never independently owned exits.
   */
  async admissionEvidence(): Promise<PortfolioExchangeSnapshot | null> {
    return this.exclusive(async () => {
      const snap = await this.refresh();
      if (!snap) return null;
      this.checkFilledCapital(snap);
      if (this.store.snapshot.recovery) return null;
      const cash = snap.decisionCash;
      if (!cash || cash.scope !== 'USDT_ONLY_HYPE_OWNED' || !Number.isFinite(cash.balance)) {
        this.lastIssue = 'decision_cash_unavailable'; return null;
      }
      this.fresh(cash.observedAt);
      if (cash.observedAt > snap.observedAt) throw new Error('future decision cash');
      return structuredClone(snap);
    });
  }
  private checkFilledCapital(snap: PortfolioExchangeSnapshot): void {
    const s = this.store.snapshot;
    const opens = Object.values(s.lots).map(p => {
      const i = Object.values(s.orders).find(o => o.kind === 'open' && o.lotId === p.id);
      if (!i?.reservation) throw new Error('owned fill has no reservation evidence');
      return { ...i.reservation, ...(i.command?.bracket ? { stop: Number(i.command.bracket.stop) } : {}), qty: p.qty, price: p.cost / p.qty };
    });
    const limits = fillReserves(ownedTotals(s).heldMargin, opens);
    if (snap.equity <= 0 || snap.equity < Math.max(limits.fillRequired, limits.fillReserve)) this.incident('filled_capital_limit');
  }
  private command(i: Intent, qty: string): PortfolioOrderCommand {
    return { version: 1, uid: this.store.uid, symbol: 'HYPEUSDT', link: i.link, at: i.at,
      orderType: 'Market', qty, reduceOnly: i.kind === 'close', positionIdx: i.side === 1 ? 1 : 2,
      side: (i.kind === 'open') === (i.side === 1) ? 'Buy' : 'Sell' };
  }
  private async send(link: string): Promise<ExecutionResult> {
    this.held(); const i = this.store.snapshot.orders[link];
    if (!i?.command) throw new Error('submission not durably prepared');
    let ack: { orderId?: string };
    try { ack = await this.port.submit(structuredClone(i.command)); }
    catch {
      // It may have reached the venue. Never resend, infer rejection, or release.
      this.held(); this.lastIssue = 'submission_outcome_unknown';
      return { state: 'pending', link, reason: this.lastIssue };
    }
    this.held();
    if (ack.orderId !== undefined) {
      if (typeof ack.orderId !== 'string' || !ack.orderId) throw new Error('invalid submission acknowledgement');
      this.store.transaction(s => { s.orders[link].orderId = ack.orderId; });
    }
    return { state: 'submitted', link };
  }
  async open(reservationId: string, checkApproval?: () => string | null): Promise<ExecutionResult> {
    return this.exclusive(async () => {
      if (!this.options.entriesAllowed()) return { state: 'blocked', reason: 'entries_paused' };
      const snap = await this.refresh();
      if (!snap) return { state: 'blocked', reason: this.lastIssue! };
      this.checkFilledCapital(snap);
      const s = this.store.snapshot, r = s.reservations[reservationId];
      if (s.recovery || !r) return { state: 'blocked', reason: s.recovery ?? 'no_reservation' };
      if (Object.values(s.exitRequests ?? {}).some(x => x.completedAt === undefined
        && ['protection_failure', 'invalid_entry_fill'].includes(x.reason)))
        return { state: 'blocked', reason: 'protection_safety_exit_pending' };
      if (s.exitRequests?.[r.owner] && s.exitRequests[r.owner]!.completedAt === undefined)
        return { state: 'blocked', reason: 'owner_exit_pending' };
      const structural = r.source === 'SF08' || r.source === 'PA07';
      if ((r.source === 'main' && r.mainLevel === undefined) || (structural && !this.port.attached))
        return { state: 'blocked', reason: 'owned_protection_bridge_not_implemented' };
      if (pending(s).some(i => i.owner === r.owner) || this.activeBracket(r.owner)) return { state: 'blocked', reason: 'owner_protection_requires_quiescence' };
      if (!this.options.entriesAllowed()) return { state: 'blocked', reason: 'entries_paused' };
      const price = r.side === 1 ? snap.ask : snap.bid;
      const qty = orderQuantity(r.requestedNotional / price, price, snap.rules, false);
      const checks = admission(snap.equity, ownedTotals(s).heldMargin, Object.values(s.reservations), this.options.feeRate);
      // Simulated exchange feasibility only. Not a Bybit maintenance-margin proof.
      if (!checks.pass || snap.availableBalance < Number(qty) * price / this.options.exchangeLeverage
        + 2 * this.options.feeRate * Number(qty) * price) return { state: 'blocked', reason: 'execution_capital' };
      const now = this.clock(), link = `pf_o_${now}_${randomBytes(4).toString('hex')}`;
      this.held(); this.fresh(snap.observedAt);
      if (now < Math.max(r.eligibleAt, r.decisionAt)) return { state: 'blocked', reason: 'entry_not_due' };
      if (now >= Math.min(r.expiresAt, r.eligibleAt + MINUTE)) return { state: 'blocked', reason: 'entry_window_expired' };
      // Main's gate/quote/cash approval has a shorter lifetime than a reservation.
      // Recheck synchronously AFTER the final account read, before durable send.
      const approvalIssue = checkApproval?.();
      if (approvalIssue) return { state: 'blocked', reason: approvalIssue };
      this.store.transaction(d => {
        prepareOpen(d, r, Number(qty), link, now); const i = d.orders[link];
        i.command = structural ? attachedBracketCommand(this.command(i, qty), r.stop!, r.target!, snap.rules.tick!, snap.bid, snap.ask)
          : this.command(i, qty);
        if (structural) beginAttachedBracket(d, i);
      });
      return this.send(link);
    });
  }
  async close(args: { owner: Owner; reason: string; allocations: { lotId: string; qty: number }[];
    allocationMode?: 'selected_ids' | 'pro_rata'; mainPartialId?: string }): Promise<ExecutionResult> {
    return this.exclusive(async () => {
      const snap = await this.refresh();
      if (!snap) return { state: 'blocked', reason: this.lastIssue! };
      if (pending(this.store.snapshot).some(i => i.owner === args.owner) || this.activeBracket(args.owner))
        return { state: 'blocked', reason: 'owner_protection_requires_quiescence' };
      // Pause/recovery blocks entries, not independently provable owned closes.
      const qty = orderQuantity(args.allocations.reduce((n, a) => n + a.qty, 0), snap.bid, snap.rules, true);
      // Virtual rung slices need not individually sit on the exchange lot grid.
      // The submitted aggregate must; preserving fractions keeps pro-rata parity.
      const now = this.clock(), link = `pf_c_${now}_${randomBytes(4).toString('hex')}`;
      this.held(); this.fresh(snap.observedAt);
      this.store.transaction(d => { prepareClose(d, { ...args, link, at: now }); d.orders[link].command = this.command(d.orders[link], qty); });
      return this.send(link);
    });
  }
  async cancel(link: string): Promise<ExecutionResult> {
    return this.exclusive(async () => {
      const i = this.store.snapshot.orders[link];
      if (!i || i.terminal || !i.command) return { state: 'blocked', reason: 'no_pending_owned_command' };
      if (await this.settle(i)) return { state: 'blocked', reason: 'already_terminal' };
      this.held(); this.store.transaction(s => { s.orders[link].cancelRequestedAt ??= this.clock(); });
      await this.port.cancel(structuredClone(i.command)); this.held();
      // Cancellation acknowledgement is not proof that a racing fill lost.
      return { state: 'pending', link, reason: 'awaiting_terminal_cancellation_evidence' };
    });
  }
  /** One resting order per owner; cannot create two independent TP/SL siblings. */
  async protect(args: { owner: Owner; kind: ProtectionKind; price: number; reason?: string }): Promise<ExecutionResult> {
    return this.exclusive(async () => {
      const snap = await this.refresh();
      if (!snap) return { state: 'blocked', reason: this.lastIssue! };
      const s = this.store.snapshot, lots = Object.values(s.lots).filter(p => p.owner === args.owner);
      if (!lots.length) return { state: 'blocked', reason: 'no_owned_inventory' };
      if (s.exitRequests?.[args.owner] && s.exitRequests[args.owner]!.completedAt === undefined)
        return { state: 'blocked', reason: 'owner_exit_pending' };
      if (pending(s).some(i => i.owner === args.owner) || this.activeBracket(args.owner)) return { state: 'blocked', reason: 'owner_already_protected_or_pending' };
      const qty = orderQuantity(lots.reduce((n, p) => n + p.qty, 0), snap.bid, snap.rules, true);
      const at = this.clock(), link = `pf_p_${at}_${randomBytes(4).toString('hex')}`;
      this.held(); this.fresh(snap.observedAt);
      this.store.transaction(d => {
        prepareClose(d, { owner: args.owner, link, at, reason: args.reason ?? (args.kind === 'trigger_sl' ? 'stop' : 'target'),
          allocations: lots.map(p => ({ lotId: p.id, qty: p.qty })), allocationMode: 'pro_rata' });
        d.orders[link].command = protectiveCommand(this.command(d.orders[link], qty), args.owner, args.kind,
          args.price, snap.rules.tick!, snap.bid, snap.ask);
      });
      return this.send(link);
    });
  }
  /** Cancellation has durable ownership; a failed/unknown request is never a release.
   * Caller retries this same quiescence operation after restart, not a new close.
   */
  async quiesce(owner: Owner): Promise<ExecutionResult> {
    return this.exclusive(() => this.quiesceOwner(owner));
  }
  private async quiesceOwner(owner: Owner): Promise<ExecutionResult> {
      for (const b of Object.values(this.store.snapshot.brackets ?? {}).filter(b => b.completedAt === undefined
        && this.store.snapshot.orders[b.parentLink].owner === owner)) {
        if (!this.port.attached) throw new Error('attached protection transport unavailable');
        const parent = this.store.snapshot.orders[b.parentLink];
        if (!parent.terminal) {
          if (!(await this.settle(parent))) {
            this.store.transaction(s => { s.orders[parent.link].cancelRequestedAt ??= this.clock(); });
            await this.port.cancel(structuredClone(parent.command!)); this.held();
            if (!(await this.settle(this.store.snapshot.orders[parent.link]))) return { state: 'pending', reason: 'attached_entry_unresolved' };
          }
        }
        if (await this.settleBracket(parent.link) === 'settled') continue;
        this.store.transaction(s => { s.brackets![parent.link].cancelRequestedAt ??= this.clock(); });
        // Cancel each known live child by its real venue ID. An ack for one leg
        // never proves the sibling cancelled; reread BOTH with full executions.
        for (const child of this.store.snapshot.brackets![parent.link].children) {
          if (!childTerminal(child)) { await this.port.attached.cancel(structuredClone(parent.command!), child.orderId); this.held(); }
        }
        if (await this.settleBracket(parent.link) !== 'settled') return { state: 'pending', reason: 'attached_cancellation_unconfirmed' };
      }
      for (const i of pending(this.store.snapshot).filter(i => i.owner === owner)) {
        // A timed-source market entry can have a confirmed partial fill while its
        // remainder is still working/ambiguous. Quiesce the ENTRY remainder using
        // the same cancel + complete receipts rule, never free it on cancel ack.
        // An already submitted CLOSE remains owned; do not cancel/re-submit it.
        if (!i.command?.protection && i.kind !== 'open') return { state: 'pending', reason: 'owner_order_unresolved', link: i.link };
        if (!i.command) throw new Error('pending entry lacks durable command');
        if (await this.settle(i)) continue;
        this.held(); this.store.transaction(s => { s.orders[i.link].cancelRequestedAt ??= this.clock(); });
        await this.port.cancel(structuredClone(i.command)); this.held();
        if (!(await this.settle(this.store.snapshot.orders[i.link])))
          return { state: 'pending', reason: 'protection_cancellation_unconfirmed', link: i.link };
      }
      return { state: 'settled' };
  }
  /** Durable owner-wide exit; a restart cannot forget a touched TP/forced close.
   * A positive grace is only valid at an observed maker touch; it cannot be reset.
   */
  async requestExit(owner: Owner, reason: string, graceMs = 0, mainTerms?: MainCloseTerms): Promise<ExecutionResult> {
    return this.exclusive(async () => {
      if (!reason || !Number.isSafeInteger(graceMs) || graceMs < 0 || graceMs > 5000) throw new Error('invalid owned exit request');
      const s = this.store.snapshot, old = s.exitRequests?.[owner];
      if (mainTerms) {
        validateMainCloseTerms(mainTerms);
        if (owner !== 'main' || !s.mainControl || s.mainControl.closeTerms
          || mainTerms.requestedAt > this.clock() || this.clock() - mainTerms.requestedAt > 5000)
          throw new Error('invalid main consequence owner/clock');
      }
      if (old && old.completedAt === undefined) return { state: 'pending', reason: 'owner_exit_already_requested' };
      const lots = Object.values(s.lots).filter(p => p.owner === owner);
      if (!lots.length) return { state: 'blocked', reason: 'no_owned_inventory' };
      if (lots.some(p => p.source !== lots[0].source)) throw new Error('mixed owner sources');
      if (graceMs) {
        const snap = await this.snapshot();
        const maker = pending(s).find(i => i.owner === owner && i.command?.protection?.kind === 'maker_tp');
        const price = Number(maker?.command?.protection?.price);
        if (!maker || (maker.side === 1 ? snap.bid < price : snap.ask > price)) throw new Error('maker target not touched');
      }
      this.held();
      const now = this.clock();
      this.store.transaction(d => {
        if (mainTerms) d.mainControl!.closeTerms = structuredClone(mainTerms);
        d.exitRequests ??= {}; d.exitRequests[owner] = {
        owner, source: lots[0].source, reason, requestedAt: now, notBefore: now + graceMs,
        lotIds: lots.map(p => p.id), marketLinks: [] }; });
      return { state: 'pending', reason: 'owned_exit_recorded' };
    });
  }
  private async advanceExit(owner: Owner): Promise<ExecutionResult> {
    const request = this.store.snapshot.exitRequests?.[owner];
    if (!request || request.completedAt !== undefined) return { state: 'blocked', reason: 'exit_not_due' };
    // A confirmed full passive fill finishes immediately, even inside grace.
    // Grace delays cancellation/fallback, not recognition of actual execution.
    const current = this.store.snapshot;
    if (!Object.values(current.lots).some(p => p.owner === owner) && !pending(current).some(i => i.owner === owner) && !this.activeBracket(owner)) {
      const flat = await this.refresh(); if (!flat) return { state: 'pending', reason: this.lastIssue! };
      this.held(); this.store.transaction(s => { s.exitRequests![owner]!.completedAt = this.clock(); });
      return { state: 'settled' };
    }
    if (this.clock() < request.notBefore) return { state: 'blocked', reason: 'exit_not_due' };
    const quiet = await this.quiesceOwner(owner); if (quiet.state !== 'settled') return quiet;
    const snap = await this.refresh(); if (!snap) return { state: 'pending', reason: this.lastIssue! };
    const lots = Object.values(this.store.snapshot.lots).filter(p => p.owner === owner);
    if (!lots.length) {
      this.held(); this.store.transaction(s => { s.exitRequests![owner]!.completedAt = this.clock(); });
      return { state: 'settled' };
    }
    if (lots.some(p => !request.lotIds.includes(p.id))) {
      this.incident('inventory_added_during_owned_exit'); return { state: 'blocked', reason: this.lastIssue! };
    }
    const qty = orderQuantity(lots.reduce((n, p) => n + p.qty, 0), snap.bid, snap.rules, true);
    const at = this.clock(), link = `pf_c_${at}_${randomBytes(4).toString('hex')}`;
    this.held(); this.fresh(snap.observedAt);
    this.store.transaction(s => {
      prepareClose(s, { owner, link, at, reason: request.reason, allocationMode: 'pro_rata',
        allocations: lots.map(p => ({ lotId: p.id, qty: p.qty })) });
      s.orders[link].command = this.command(s.orders[link], qty); s.exitRequests![owner]!.marketLinks.push(link);
    });
    return this.send(link);
  }
}
