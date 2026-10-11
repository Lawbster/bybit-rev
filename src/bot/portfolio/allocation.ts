import { MINUTE, TERMS, epoch, owner, positive, source, type Owner, type SetupSource, type Side, type Source } from './contract';
import { admission, type CapitalRequest } from './capital';

export interface PortfolioSignal {
  id: string; source: SetupSource; side: Side;
  decisionAt: number; eligibleAt: number; knownAt: number; expiresAt: number;
  stop?: number; target?: number;
}
export interface Occupancy { owner: Owner; source: Source; id: string; }
export interface Reservation extends CapitalRequest {
  id: string; source: Source; decisionAt: number; eligibleAt: number; knownAt?: number; target?: number; expiresAt: number;
  mainLevel?: number;
}
export interface Decision {
  id: string; source: SetupSource; at: number;
  reason: 'accepted' | 'source_occupied' | 'slots_occupied' | 'shared_capital' | 'entries_blocked';
  reservation?: Reservation;
}

function validSignal(s: PortfolioSignal, at: number): void {
  source(s.source);
  if (!(s.source in TERMS) || !s.id || typeof s.id !== 'string') throw new Error('invalid setup signal');
  for (const t of [s.decisionAt, s.eligibleAt, s.knownAt, s.expiresAt]) epoch(t);
  const clockValid = s.source === 'R3'
    ? at >= s.eligibleAt - MINUTE && at <= s.eligibleAt
    : at >= s.eligibleAt && at < s.eligibleAt + MINUTE && s.knownAt <= s.eligibleAt;
  if (s.decisionAt !== at || s.knownAt > at || !clockValid || s.expiresAt <= s.eligibleAt || s.eligibleAt % MINUTE)
    throw new Error('invalid signal clock');
  const spec = TERMS[s.source];
  if (s.side !== spec.side || (s.stop !== undefined) !== spec.bracket || (s.target !== undefined) !== spec.bracket)
    throw new Error('source terms mismatch');
  if (s.stop !== undefined) {
    positive(s.stop, 'stop'); positive(s.target!, 'target');
    if (s.side * (s.target! - s.stop) <= 0) throw new Error('inverted bracket');
  }
}
export function validateReservation(r: Reservation): void {
  owner(r.owner); source(r.source); positive(r.requestedNotional, 'reserved notional'); positive(r.decisionPrice, 'reserved price');
  for (const t of [r.decisionAt, r.eligibleAt, r.expiresAt]) epoch(t);
  if (!r.id || r.expiresAt <= r.eligibleAt
    || (r.owner === 'main') !== (r.source === 'main') || (r.owner === 'R3') !== (r.source === 'R3')) throw new Error('invalid reservation');
  if (r.source === 'main') {
    if (r.eligibleAt < r.decisionAt || r.side !== 1 || r.stop !== undefined || r.target !== undefined) throw new Error('invalid main request');
    if (r.mainLevel !== undefined && (!Number.isInteger(r.mainLevel) || r.mainLevel < 0 || r.mainLevel > 10)) throw new Error('invalid main rung');
  } else {
    if (r.mainLevel !== undefined) throw new Error('setup cannot claim main rung');
    validSignal({ ...r, source: r.source, knownAt: r.knownAt! }, r.decisionAt);
    if (Math.abs(r.requestedNotional - TERMS[r.source].notional) > 1e-8) throw new Error('source sizing mismatch');
  }
}

/** Pure decision phase. No open/high/low, fill or future outcome input exists.
 * Caller seals the entire timestamp group once; do not invoke per signal.
 * Occupancy is removed only by the receipt-backed ledger, never a predicted exit.
 */
export function allocateGroup(args: {
  at: number; price: number; priceKnownAt: number; equity: number; heldMargin: number;
  feeRate: number; occupied: readonly Occupancy[]; pending: readonly Reservation[];
  signals: readonly PortfolioSignal[]; entriesBlocked?: boolean;
}): Decision[] {
  epoch(args.at); epoch(args.priceKnownAt); positive(args.price, 'known price');
  if (args.priceKnownAt > args.at) throw new Error('future price observation');
  const ids = new Set<string>();
  for (const s of args.signals) { validSignal(s, args.at); if (ids.has(s.id)) throw new Error('duplicate signal ID'); ids.add(s.id); }
  const busy = new Map<Owner, Occupancy>();
  for (const p of args.occupied) {
    owner(p.owner); source(p.source);
    if (busy.has(p.owner) || (p.owner === 'main') !== (p.source === 'main')
      || (p.owner === 'R3') !== (p.source === 'R3')) throw new Error('invalid owner occupancy');
    busy.set(p.owner, p);
  }
  const claimed = new Set<Owner>(busy.keys()), sources = new Set<Source>([...busy.values()].map(p => p.source));
  const requests: CapitalRequest[] = [...args.pending];
  for (const p of args.pending) {
    validateReservation(p);
    if (p.decisionAt > args.at) throw new Error('future reservation');
    claimed.add(p.owner); sources.add(p.source);
  }
  return [...args.signals].sort((a, b) => a.id.localeCompare(b.id)).map(s => {
    const base = { id: s.id, source: s.source, at: args.at };
    if (args.entriesBlocked) return { ...base, reason: 'entries_blocked' };
    if (sources.has(s.source)) return { ...base, reason: 'source_occupied' };
    const selected: Owner | undefined = s.source === 'R3' ? 'R3'
      : (['setup0', 'setup1', 'setup2'] as const).find(o => !claimed.has(o));
    if (!selected || claimed.has(selected)) return { ...base, reason: 'slots_occupied' };
    const reservation: Reservation = { ...s, owner: selected, requestedNotional: TERMS[s.source].notional, decisionPrice: args.price };
    const check = admission(args.equity, args.heldMargin, [...requests, reservation], args.feeRate);
    if (!check.pass) return { ...base, reason: 'shared_capital' };
    // The entire same-clock group is reserved before any later fill rejection.
    requests.push(reservation); claimed.add(selected); sources.add(s.source);
    return { ...base, reason: 'accepted', reservation };
  });
}
