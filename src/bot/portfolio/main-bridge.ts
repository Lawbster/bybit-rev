/** Owned-inventory boundary for the existing ladder, not a replacement strategy.
 * No main gates are inferred here; callers must run the existing gate stack.
 * Does not write bot-state.json or alter profile/cooldown/latch semantics.
 */
import { createHash } from 'crypto';
import type { BotState } from '../state';
import { calcAddSize } from '../strategy';
import { allocatedForCumulative, buildProRataAllocation, buildSelectedIdsAllocation } from '../partial-close-transaction';
import { normalizeQtyDown } from '../executor';
import { admission } from './capital';
import { epoch, MINUTE, positive } from './contract';
import { decisionHeldMargin, type PortfolioLedger } from './ledger';
import { validateReservation, type Reservation } from './allocation';
import { ownedMainPositions } from './main-inventory';
export { ownedMainPositions } from './main-inventory';

export function mainInventoryKey(s: PortfolioLedger): string {
  return createHash('sha256').update(JSON.stringify(ownedMainPositions(s))).digest('hex');
}
/** Preserve all legacy non-inventory state. Caller cannot accidentally feed the
 * exchange aggregate average or auxiliary rung count into ladder decisions.
 */
export function mainDecisionState(legacy: BotState, s: PortfolioLedger): BotState {
  return { ...structuredClone(legacy), positions: ownedMainPositions(s) };
}
export interface ApprovedMainAdd {
  id: string; at: number; price: number; priceKnownAt: number;
  equity: number; equityKnownAt: number; feeRate: number;
  expectedInventory: string; level: number; notional: number;
  /** Output of the existing full gate stack, not a new decision in this bridge. */
  gatesApproved: boolean; entriesPaused: boolean;
}
/** Check durable main restrictions before touching a resting exit. */
export function mainControlBlocksAdd(s: PortfolioLedger, at: number): boolean {
  const m = s.mainControl;
  return !!(m && (m.closeTerms || (m.partial && m.partial.completedAt === undefined)
    || m.memory.forcedExitCooldownUntil > at || m.memory.damagedRegimeLatch.active || m.memory.regime.flatActive));
}
/** After the original strategy approves an add, reserve its unchanged sizing.
 * This function does not choose main-vs-setup phase priority or bypass any gate.
 */
export function reserveApprovedMainAdd(s: PortfolioLedger, a: ApprovedMainAdd): Reservation | null {
  for (const at of [a.at, a.priceKnownAt, a.equityKnownAt]) epoch(at);
  positive(a.price, 'main known price'); positive(a.notional, 'main notional');
  if (a.priceKnownAt > a.at || a.equityKnownAt > a.at || a.at - a.priceKnownAt > 5000 || a.at - a.equityKnownAt > 5000)
    throw new Error('main capital/price evidence unavailable');
  if (!a.id || s.reservations[a.id] || s.lots[a.id] || s.cancelledReservations[a.id]
    || Object.values(s.orders).some(i => i.lotId === a.id) || s.decisions.some(d => d.id === a.id))
    throw new Error('main add ID already consumed or invalid');
  const positions = ownedMainPositions(s);
  if (a.expectedInventory !== mainInventoryKey(s)) throw new Error('main inventory changed since gate decision');
  if (a.level !== positions.length || a.level < 0 || a.level >= 11
    || Math.abs(a.notional - calcAddSize(a.level, 800, 1.35)) > 1e-8) throw new Error('main rung/sizing differs from frozen contract');
  if (!a.gatesApproved || a.entriesPaused || s.recovery
    || mainControlBlocksAdd(s, a.at)
    || (s.exitRequests?.main && s.exitRequests.main.completedAt === undefined)
    || Object.values(s.reservations).some(r => r.owner === 'main')
    || Object.values(s.orders).some(i => i.owner === 'main' && !i.terminal)
    || (s.availableAfter.main ?? 0) > a.at) return null;
  const r: Reservation = { id: a.id, owner: 'main', source: 'main', side: 1, mainLevel: a.level,
    requestedNotional: a.notional, decisionPrice: a.price, decisionAt: a.at, eligibleAt: a.at, expiresAt: a.at + MINUTE };
  validateReservation(r);
  if (!admission(a.equity, decisionHeldMargin(s, a.at), [...Object.values(s.reservations), r], a.feeRate).pass) return null;
  s.reservations[r.id] = r; return structuredClone(r);
}
export function mainCloseAllocation(s: PortfolioLedger, selectedIds?: readonly string[], qtyStep?: number) {
  const positions = ownedMainPositions(s);
  const allocation = selectedIds ? buildSelectedIdsAllocation(positions, [...selectedIds]) : buildProRataAllocation(positions);
  if (!allocation.targets.length) throw new Error('main inventory is empty');
  if (new Set(allocation.targets.map(t => t.positionId)).size !== allocation.targets.length) throw new Error('duplicated main close lot');
  const total = allocation.targets.reduce((n, t) => n + t.preQty, 0);
  if (qtyStep !== undefined) positive(qtyStep, 'main close quantity step');
  const qty = qtyStep === undefined ? total : normalizeQtyDown(total, qtyStep);
  if (qty <= 0 || qty > total + 1e-8) throw new Error('main selected close below lot step');
  // Normalize the single exchange order, not each virtual rung. A selected
  // partial may leave sub-step virtual residue, just as the existing allocator.
  return { owner: 'main' as const, allocationMode: allocation.mode,
    allocations: allocatedForCumulative(allocation, qty).map(t => ({ lotId: t.positionId, qty: t.closeQty })) };
}
