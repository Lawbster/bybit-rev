/** Receipt-owned lots. No exchange API, price-based fill inference or full-position TP. */
import { createHash } from 'crypto';
import fs from 'fs';
import { atomicSfpJson } from '../sfp-state';
import { PORTFOLIO_POLICY, BUDGET_LEVERAGE, MINUTE, epoch, owner, source, positive, releaseAt, type Owner, type Source, type Side } from './contract';
import { allocateGroup, validateReservation, type Decision, type Occupancy, type Reservation, type PortfolioSignal } from './allocation';
import { validateLifecycle, type LifecycleState } from './lifecycle-state';
import { validateCommand, type PortfolioOrderCommand } from './order-command';
import { allocationDeltaForCumulative } from '../partial-close-transaction';
import { validateOwnedExit, type OwnedExitRequest } from './owned-exit';
import { validateBracketState, type AttachedBracket } from './bracket-state';
import { validateMainControl, recordMainExecution, type MainControlState } from './main-control-state';
import { ownedMainPositions } from './main-inventory';
const EPS = 1e-8;
export interface Lot {
  id: string; owner: Owner; source: Source; side: Side; qty: number; cost: number;
  entryFees: number; openedAt: number;
}
export interface Intent {
  link: string; orderId?: string; owner: Owner; source: Source; side: Side; kind: 'open' | 'close';
  at: number; qty: number; appliedQty: number; terminal: boolean; reason: string;
  lotId: string; reservation?: Reservation; allocations: { lotId: string; qty: number; applied: number }[];
  command?: PortfolioOrderCommand;
  allocationMode?: 'selected_ids' | 'pro_rata';
  restingConfirmedAt?: number;
  cancelRequestedAt?: number;
  mainPartialId?: string;
}
export interface Execution {
  id: string; link: string; orderId: string; at: number; side: 'Buy' | 'Sell';
  positionIdx: 1 | 2; qty: number; price: number; fee: number;
}
export interface PortfolioLedger {
  version: 1; policy: string; uid: string; symbol: 'HYPEUSDT'; sequence: number;
  lots: Record<string, Lot>; orders: Record<string, Intent>; executions: Record<string, Execution>;
  reservations: Record<string, Reservation>; decisions: Decision[];
  cancelledReservations: Record<string, { at: number; reason: string }>;
  availableAfter: Partial<Record<Owner, number>>; sourceAfter: Partial<Record<Source, number>>;
  lastDecisionAt: number; realizedBeforeFunding: number; fees: number;
  recovery: string | null;
  lifecycle?: LifecycleState;
  exitRequests?: Partial<Record<Owner, OwnedExitRequest>>;
  brackets?: Record<string, AttachedBracket>;
  mainControl?: MainControlState;
  /** Current-minute outgoing inventory still consumes decision collateral.
   * Captured by the one loop before issuing exits, retained across restarts. */
  capitalWindow?: { at: number; lots: Record<string, { cost: number; owner: Owner }> };
}
export function emptyLedger(uid: string): PortfolioLedger {
  if (!/^\d+$/.test(uid)) throw new Error('portfolio UID must be pinned');
  return { version: 1, policy: PORTFOLIO_POLICY, uid, symbol: 'HYPEUSDT', sequence: 0,
    lots: {}, orders: {}, executions: {}, reservations: {}, decisions: [], cancelledReservations: {}, availableAfter: {}, sourceAfter: {},
    lastDecisionAt: -1, realizedBeforeFunding: 0, fees: 0, recovery: null };
}
function active(s: PortfolioLedger): Intent[] { return Object.values(s.orders).filter(o => !o.terminal); }
export function ownedTotals(s: PortfolioLedger) {
  let longQty = 0, shortQty = 0, heldMargin = 0;
  for (const p of Object.values(s.lots)) {
    if (p.side === 1) longQty += p.qty; else shortQty += p.qty;
    heldMargin += p.cost / BUDGET_LEVERAGE[p.owner];
  }
  return { longQty, shortQty, heldMargin };
}
export function decisionHeldMargin(s: PortfolioLedger, at: number): number {
  let held = ownedTotals(s).heldMargin;
  if (s.capitalWindow?.at === Math.floor(at / MINUTE) * MINUTE) {
    for (const [id, old] of Object.entries(s.capitalWindow.lots))
      held += Math.max(0, old.cost - (s.lots[id]?.cost ?? 0)) / BUDGET_LEVERAGE[old.owner];
  }
  return held;
}
/** Strategy decisions must use their own cost basis, not Bybit's combined average. */
export function ownerPosition(s: PortfolioLedger, selected: Owner) {
  owner(selected); const lots = Object.values(s.lots).filter(p => p.owner === selected);
  if (lots.some(p => p.side !== lots[0].side)) throw new Error('owner has mixed position sides');
  const qty = lots.reduce((n, p) => n + p.qty, 0), cost = lots.reduce((n, p) => n + p.cost, 0);
  return { owner: selected, side: lots[0]?.side ?? null, qty, cost, averageEntry: qty ? cost / qty : null,
    entryFees: lots.reduce((n, p) => n + p.entryFees, 0), lots: structuredClone(lots) };
}
export function occupancy(s: PortfolioLedger, at: number): Occupancy[] {
  epoch(at); const result = new Map<Owner, Occupancy>();
  for (const p of [...Object.values(s.lots), ...active(s)]) result.set(p.owner, { owner: p.owner, source: p.source, id: 'id' in p ? p.id : p.lotId });
  for (const r of Object.values(s.reservations)) result.set(r.owner, { owner: r.owner, source: r.source, id: r.id });
  for (const r of Object.values(s.exitRequests ?? {})) if (r.completedAt === undefined)
    result.set(r.owner, { owner: r.owner, source: r.source, id: `exit:${r.requestedAt}` });
  for (const b of Object.values(s.brackets ?? {})) if (b.completedAt === undefined) {
    const i = s.orders[b.parentLink];
    result.set(i.owner, { owner: i.owner, source: i.source, id: `bracket:${i.link}` });
  }
  for (const o of Object.values(s.orders)) {
    if ((s.availableAfter[o.owner] ?? 0) > at || (s.sourceAfter[o.source] ?? 0) > at)
      result.set(o.owner, { owner: o.owner, source: o.source, id: o.lotId });
  }
  return [...result.values()];
}
export function unresolvedReservations(s: PortfolioLedger): Reservation[] {
  // Until terminal cumulative evidence arrives, preserve the full requested budget.
  // Partially filled lots are also charged. This is deliberately conservative.
  return Object.values(s.reservations);
}
/** One durable decision group, before ANY submission/open-price observation. */
export function reserveGroup(s: PortfolioLedger, args: {
  at: number; price: number; priceKnownAt: number; equity: number; feeRate: number;
  signals: readonly PortfolioSignal[]; entriesBlocked?: boolean;
  sizingProfile?: import('./sizing').SizingProfile;
}): Decision[] {
  if (args.at <= s.lastDecisionAt) throw new Error('decision group already sealed or out of order');
  const seen = new Set(s.decisions.map(d => d.id));
  if (args.signals.some(x => seen.has(x.id))) throw new Error('signal already consumed');
  const decisions = allocateGroup({ ...args, entriesBlocked: !!s.recovery || args.entriesBlocked,
    heldMargin: decisionHeldMargin(s, args.at), occupied: occupancy(s, args.at), pending: unresolvedReservations(s) });
  for (const d of decisions) if (d.reservation) s.reservations[d.id] = d.reservation;
  s.lastDecisionAt = args.at; s.decisions.push(...decisions);
  return decisions;
}
/** Only a never-submitted reservation can be abandoned locally. An unresolved
 * submission requires exchange terminal evidence through finishOrder instead.
 */
export function cancelUnsubmittedReservation(s: PortfolioLedger, id: string, at: number, reason: 'expired' | 'paused' | 'preflight_failed'): void {
  epoch(at); const r = s.reservations[id];
  if (!r || at < r.decisionAt || Object.values(s.orders).some(i => i.kind === 'open' && i.lotId === id))
    throw new Error('reservation submitted, missing or not yet known');
  if (reason === 'expired' && at < Math.min(r.expiresAt, r.eligibleAt + MINUTE)) throw new Error('entry window still open');
  delete s.reservations[id]; s.cancelledReservations[id] = { at, reason };
}
function validateIntent(i: Intent): void {
  owner(i.owner); source(i.source); epoch(i.at); positive(i.qty, 'intent quantity');
  if (!/^[A-Za-z0-9_-]{1,36}$/.test(i.link) || !i.lotId || !i.reason || ![1, -1].includes(i.side)
    || !['open', 'close'].includes(i.kind) || !Number.isFinite(i.appliedQty) || i.appliedQty < 0 || i.appliedQty > i.qty + EPS
    || (i.owner === 'main') !== (i.source === 'main') || (i.owner === 'R3') !== (i.source === 'R3')) throw new Error('invalid intent');
  if (i.allocationMode !== undefined && !['selected_ids', 'pro_rata'].includes(i.allocationMode)) throw new Error('invalid allocation mode');
  for (const t of [i.restingConfirmedAt, i.cancelRequestedAt]) if (t !== undefined) {
    epoch(t); if (t < i.at) throw new Error('order observation before intent');
  }
  if (i.restingConfirmedAt !== undefined && !i.command?.protection) throw new Error('unprotected resting order');
  if (!Array.isArray(i.allocations)) throw new Error('invalid intent allocation');
  if (i.mainPartialId !== undefined && (i.owner !== 'main' || i.kind !== 'close' || !i.mainPartialId)) throw new Error('invalid main partial identity');
  if (i.reservation) validateReservation(i.reservation);
  if (i.kind === 'close' && (!i.allocations.length || new Set(i.allocations.map(a => a.lotId)).size !== i.allocations.length
    || i.allocations.some(a => !a.lotId || !Number.isFinite(a.qty) || a.qty <= 0 || !Number.isFinite(a.applied) || a.applied < 0 || a.applied > a.qty + EPS)
    || Math.abs(i.allocations.reduce((n, a) => n + a.qty, 0) - i.qty) > EPS
    || Math.abs(i.allocations.reduce((n, a) => n + a.applied, 0) - i.appliedQty) > EPS)) throw new Error('invalid close allocation accounting');
}
export function validateLedger(s: PortfolioLedger, uid: string): void {
  if (s.version !== 1 || s.policy !== PORTFOLIO_POLICY || s.uid !== uid || s.symbol !== 'HYPEUSDT'
    || !Number.isSafeInteger(s.sequence) || s.sequence < 0 || !Number.isSafeInteger(s.lastDecisionAt)
    || !Number.isFinite(s.realizedBeforeFunding) || !Number.isFinite(s.fees)
    || !(s.recovery === null || typeof s.recovery === 'string')) throw new Error('invalid portfolio state');
  for (const value of [s.lots, s.orders, s.executions, s.reservations, s.cancelledReservations, s.availableAfter, s.sourceAfter])
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid portfolio collection');
  if (!Array.isArray(s.decisions)) throw new Error('invalid decisions collection');
  if (s.capitalWindow) {
    epoch(s.capitalWindow.at);
    if (s.capitalWindow.at % MINUTE || !s.capitalWindow.lots || typeof s.capitalWindow.lots !== 'object') throw new Error('invalid capital window');
    for (const [id, lot] of Object.entries(s.capitalWindow.lots)) { owner(lot.owner); positive(lot.cost, 'boundary cost'); if (!id) throw new Error('invalid boundary lot'); }
  }
  if (s.lifecycle !== undefined) validateLifecycle(s.lifecycle);
  if (s.mainControl !== undefined) {
    validateMainControl(s.mainControl);
    if (s.mainControl.closeTerms && !s.exitRequests?.main) throw new Error('main close consequence lacks durable exit');
  }
  if (s.brackets !== undefined) {
    if (!s.brackets || typeof s.brackets !== 'object' || Array.isArray(s.brackets)) throw new Error('invalid bracket collection');
    const childIds = new Set<string>();
    for (const [key, b] of Object.entries(s.brackets)) {
      validateBracketState(b);
      const i = s.orders[key];
      if (key !== b.parentLink || !i?.command?.bracket || i.kind !== 'open' || !['SF08', 'PA07'].includes(i.source)
        || (b.completedAt !== undefined && (!i.terminal || (i.appliedQty > 0 && b.children.length !== 2))))
        throw new Error('bracket parent mismatch');
      for (const c of b.children) {
        if (childIds.has(c.orderId)) throw new Error('child belongs to multiple parents');
        childIds.add(c.orderId);
      }
    }
  }
  if (s.exitRequests !== undefined) {
    if (!s.exitRequests || typeof s.exitRequests !== 'object' || Array.isArray(s.exitRequests)) throw new Error('invalid owned exits');
    for (const [key, r] of Object.entries(s.exitRequests)) {
      validateOwnedExit(r!); if (key !== r!.owner) throw new Error('owned exit key mismatch');
    }
  }
  for (const [id, p] of Object.entries(s.lots)) {
    owner(p.owner); source(p.source); epoch(p.openedAt); positive(p.qty, 'lot quantity'); positive(p.cost, 'lot cost');
    if (p.id !== id || ![1, -1].includes(p.side) || !Number.isFinite(p.entryFees)
      || (p.owner === 'main') !== (p.source === 'main') || (p.owner === 'R3') !== (p.source === 'R3')) throw new Error('invalid lot');
  }
  for (const [link, i] of Object.entries(s.orders)) {
    validateIntent(i); if (i.link !== link) throw new Error('order key mismatch');
    if (i.command) {
      const c = i.command; validateCommand(c);
      if (c.bracket && !s.brackets?.[link]) throw new Error('attached entry missing durable bracket');
      if (c.uid !== s.uid || c.symbol !== s.symbol || c.link !== i.link || c.at !== i.at
        || Math.abs(Number(c.qty) - i.qty) > EPS || c.reduceOnly !== (i.kind === 'close')
        || c.positionIdx !== (i.side === 1 ? 1 : 2)
        || c.side !== ((i.kind === 'open') === (i.side === 1) ? 'Buy' : 'Sell')) throw new Error('command/intent mismatch');
    }
  }
  for (const [id, r] of Object.entries(s.reservations)) {
    validateReservation(r);
    if (r.id !== id) throw new Error('invalid reservation ID');
  }
  for (const at of [...Object.values(s.availableAfter), ...Object.values(s.sourceAfter)]) epoch(at!);
}

export function prepareOpen(s: PortfolioLedger, r: Reservation, qty: number, link: string, at: number): void {
  if (s.recovery) throw new Error('portfolio in recovery');
  if (s.exitRequests?.[r.owner]?.completedAt === undefined && s.exitRequests?.[r.owner]) throw new Error('owner exit is pending');
  validateReservation(r);
  epoch(at); positive(qty, 'open quantity');
  // Execution may arrive during its scheduled minute, never be caught up later.
  if (at < Math.max(r.eligibleAt, r.decisionAt) || at >= Math.min(r.expiresAt, r.eligibleAt + MINUTE) || s.orders[link]) throw new Error('invalid or duplicated entry');
  if (!s.reservations[r.id] || JSON.stringify(s.reservations[r.id]) !== JSON.stringify(r)) throw new Error('entry not durably reserved');
  const occupied = occupancy(s, at).filter(p => p.id !== r.id);
  if (r.owner !== 'main' && occupied.some(p => p.owner === r.owner || p.source === r.source)) throw new Error('owner/source occupied');
  if (r.owner === 'main' && active(s).some(i => i.owner === 'main')) throw new Error('main order unresolved');
  if (s.lots[r.id]) throw new Error('lot already exists');
  const i: Intent = { link, owner: r.owner, source: r.source, side: r.side, kind: 'open', at, qty,
    appliedQty: 0, terminal: false, reason: 'signal', lotId: r.id, reservation: { ...r }, allocations: [] };
  validateIntent(i); s.orders[link] = i;
}
export function prepareClose(s: PortfolioLedger, args: {
  owner: Owner; link: string; at: number; reason: string; allocations: { lotId: string; qty: number }[];
  allocationMode?: 'selected_ids' | 'pro_rata';
  mainPartialId?: string;
}): void {
  epoch(args.at); owner(args.owner);
  if (args.mainPartialId && (s.mainControl?.partial?.id !== args.mainPartialId || s.mainControl.partial.completedAt !== undefined))
    throw new Error('main partial not durably authorized');
  if (s.orders[args.link] || active(s).some(i => i.owner === args.owner)) throw new Error('owner order unresolved or duplicate');
  if (!args.allocations.length || new Set(args.allocations.map(a => a.lotId)).size !== args.allocations.length) throw new Error('invalid close allocation');
  const lots = args.allocations.map(a => {
    positive(a.qty, 'close qty'); const p = s.lots[a.lotId];
    if (!p || p.owner !== args.owner || a.qty > p.qty + EPS) throw new Error('close exceeds owned lot');
    return p;
  });
  if (lots.some(p => p.side !== lots[0].side || p.source !== lots[0].source)) throw new Error('mixed close allocation');
  const i: Intent = { link: args.link, owner: args.owner, source: lots[0].source, side: lots[0].side,
    kind: 'close', at: args.at, qty: args.allocations.reduce((n, a) => n + a.qty, 0), appliedQty: 0,
    terminal: false, reason: args.reason, lotId: lots[0].id,
    allocations: args.allocations.map(a => ({ ...a, applied: 0 })),
    ...(args.allocationMode ? { allocationMode: args.allocationMode } : {}),
    ...(args.mainPartialId ? { mainPartialId: args.mainPartialId } : {}) };
  validateIntent(i); s.orders[i.link] = i;
}
export function applyExecution(s: PortfolioLedger, f: Execution, observedAt: number): void {
  epoch(f.at); epoch(observedAt); positive(f.qty, 'execution qty'); positive(f.price, 'execution price');
  if (!f.id || !f.orderId || !Number.isFinite(f.fee) || f.at > observedAt) throw new Error('invalid execution');
  const old = s.executions[f.id];
  if (old) { if (JSON.stringify(old) !== JSON.stringify(f)) throw new Error('conflicting execution'); return; }
  const i = s.orders[f.link];
  if (!i || i.terminal || f.at < i.at || i.appliedQty + f.qty > i.qty + EPS
    || (i.orderId && i.orderId !== f.orderId) || f.positionIdx !== (i.side === 1 ? 1 : 2)
    || f.side !== ((i.kind === 'open') === (i.side === 1) ? 'Buy' : 'Sell')) throw new Error('unowned or inconsistent execution');
  const mainBefore = s.mainControl && i.owner === 'main' ? ownedMainPositions(s) : [];
  const netBefore = s.realizedBeforeFunding;
  if (i.kind === 'open') {
    let p = s.lots[i.lotId];
    if (!p) p = s.lots[i.lotId] = { id: i.lotId, owner: i.owner, source: i.source, side: i.side,
      qty: 0, cost: 0, entryFees: 0, openedAt: f.at };
    p.openedAt = Math.min(p.openedAt, f.at);
    p.qty += f.qty; p.cost += f.qty * f.price; p.entryFees += f.fee;
  } else {
    const targets = i.allocations.map(a => ({ positionId: a.lotId, preQty: a.qty, preNotional: 0 }));
    const allocation = i.allocationMode === 'pro_rata'
      ? { mode: 'pro_rata' as const, targets, preTotalQty: i.qty }
      : { mode: 'selected_ids' as const, targets };
    const deltas = allocationDeltaForCumulative(allocation, i.appliedQty, i.appliedQty + f.qty);
    let remaining = f.qty;
    for (const slice of deltas) {
      const a = i.allocations.find(x => x.lotId === slice.positionId)!;
      const q = slice.closeQty; if (q <= 0) continue;
      const p = s.lots[a.lotId]; if (!p || q > p.qty + EPS) throw new Error('close allocation lost ownership');
      const fraction = Math.min(1, q / p.qty), cost = p.cost * fraction, entryFee = p.entryFees * fraction;
      s.realizedBeforeFunding += i.side * (q * f.price - cost) - entryFee - f.fee * q / f.qty;
      p.qty -= q; p.cost -= cost; p.entryFees -= entryFee; a.applied += q; remaining -= q;
      if (p.qty <= EPS) delete s.lots[a.lotId];
    }
    if (remaining > EPS) throw new Error('unallocated close quantity');
  }
  i.orderId = f.orderId; i.appliedQty += f.qty; s.fees += f.fee; s.executions[f.id] = { ...f };
  recordMainExecution(s, i, f, s.realizedBeforeFunding - netBefore, mainBefore);
}
/** Not-found is NOT a terminal status. Exact cumulative evidence is mandatory. */
export function finishOrder(s: PortfolioLedger, link: string, status: 'Filled' | 'Cancelled' | 'Rejected', cumulative: number, at: number): void {
  epoch(at); const i = s.orders[link];
  if (!i || !['Filled', 'Cancelled', 'Rejected'].includes(status) || at < i.at || !Number.isFinite(cumulative)
    || Math.abs(cumulative - i.appliedQty) > EPS || (status === 'Filled' && Math.abs(cumulative - i.qty) > EPS)
    || (status === 'Rejected' && cumulative !== 0)) throw new Error('terminal evidence mismatch');
  if (i.terminal) return;
  i.terminal = true;
  if (i.owner === 'main' && i.kind === 'open' && cumulative === 0 && s.mainControl) {
    const policy = s.mainControl.policy ??= { lastLatchAt: 0, lastHighDecisionAt: 0, addRetryAfter: 0 };
    policy.addRetryAfter = Math.max(policy.addRetryAfter, at + 5 * MINUTE);
  }
  if (i.kind === 'open') delete s.reservations[i.lotId];
  if (!Object.values(s.lots).some(p => p.owner === i.owner) && !active(s).some(o => o.owner === i.owner)) {
    const executions = Object.values(s.executions).filter(f => f.link === link);
    const last = executions.reduce((v, f) => Math.max(v, f.at), i.at);
    const available = i.kind === 'close' ? releaseAt(i.source, i.reason, last, at) : at;
    s.availableAfter[i.owner] = Math.max(s.availableAfter[i.owner] ?? 0, available);
    s.sourceAfter[i.source] = Math.max(s.sourceAfter[i.source] ?? 0, available);
  }
}
export function reconcile(s: PortfolioLedger, snapshot: {
  uid: string; symbol: string; longQty: number; shortQty: number; openLinks: string[];
}, tolerance = EPS, observedResting: readonly string[] = []): string | null {
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1e-6) throw new Error('invalid reconciliation tolerance');
  if (observedResting.some(link => !s.orders[link]?.command?.protection || s.orders[link].terminal
    || s.orders[link].cancelRequestedAt !== undefined || s.orders[link].restingConfirmedAt === undefined))
    throw new Error('unverified resting protection exemption');
  const totals = ownedTotals(s);
  const reason = snapshot.uid !== s.uid || snapshot.symbol !== s.symbol ? 'account_identity_mismatch'
    : !Number.isFinite(snapshot.longQty) || !Number.isFinite(snapshot.shortQty)
      || Math.abs(snapshot.longQty - totals.longQty) > tolerance || Math.abs(snapshot.shortQty - totals.shortQty) > tolerance ? 'aggregate_inventory_mismatch'
    : snapshot.openLinks.some(link => !s.orders[link] || s.orders[link].terminal) ? 'unowned_open_order'
    : active(s).some(i => !observedResting.includes(i.link)) ? 'order_evidence_pending' : null;
  // A clean aggregate alone cannot erase an earlier recovery incident.
  if (reason) s.recovery = reason;
  return reason;
}

const checksum = (state: PortfolioLedger) => createHash('sha256').update(JSON.stringify(state)).digest('hex');
export class PortfolioPersistenceError extends Error {}
export class PortfolioStore {
  private state: PortfolioLedger;
  private failed = false;
  constructor(readonly file: string, readonly uid: string,
    private readonly persist: (file: string, value: unknown) => void = atomicSfpJson) {
    if (!fs.existsSync(file)) this.state = emptyLedger(uid);
    else {
      const envelope = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!envelope.state || checksum(envelope.state) !== envelope.sha256) throw new Error('portfolio state checksum mismatch');
      validateLedger(envelope.state, uid); this.state = envelope.state;
    }
  }
  get snapshot(): PortfolioLedger { return structuredClone(this.state); }
  transaction(change: (draft: PortfolioLedger) => void): void {
    if (this.failed) throw new PortfolioPersistenceError('portfolio persistence failed; restart required');
    const draft = this.snapshot; change(draft); draft.sequence++;
    validateLedger(draft, this.uid);
    try { this.persist(this.file, { state: draft, sha256: checksum(draft) }); }
    catch { this.failed = true; throw new PortfolioPersistenceError('portfolio durable write failed; trading prohibited'); }
    // Callbacks may retain their draft or nested references. Do not let them mutate
    // committed in-memory state without another durable transaction.
    this.state = structuredClone(draft);
  }
}
