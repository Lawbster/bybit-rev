import { BUDGET_LEVERAGE, owner, positive, type Owner, type Side } from './contract';

export interface CapitalRequest {
  owner: Owner; requestedNotional: number; decisionPrice: number; side: Side; stop?: number;
}
export interface ExecutedRequest extends CapitalRequest { qty: number; price: number; }
function held(value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error('invalid held margin');
}
function request(r: CapitalRequest): void {
  owner(r.owner); positive(r.requestedNotional, 'requested notional'); positive(r.decisionPrice, 'decision price');
  if (r.side !== 1 && r.side !== -1) throw new Error('invalid side');
  if (r.stop !== undefined) positive(r.stop, 'stop');
}

/** Same equations as the sealed research reserve helper, with runtime validation.
 * Existing lots are charged at surviving entry cost, not marked notional.
 * Caller must retain outgoing collateral and all unresolved entry reservations.
 */
export function decisionReserves(heldMargin: number, requests: readonly CapitalRequest[]) {
  held(heldMargin);
  let required = heldMargin, reserve = heldMargin;
  for (const r of requests) {
    request(r);
    const unit = r.requestedNotional / BUDGET_LEVERAGE[r.owner]
      + (r.owner === 'main' ? 0 : r.requestedNotional * 0.002);
    const stopRisk = r.owner !== 'main' && r.stop !== undefined
      ? Math.max(0, r.side * (r.decisionPrice - r.stop)) * r.requestedNotional / r.decisionPrice
        + r.requestedNotional * 0.05 : 0;
    required += unit; reserve += Math.max(unit, stopRisk);
  }
  return { required, reserve };
}

/** postMargin already includes the actual current-open fills. */
export function fillReserves(postMargin: number, opens: readonly ExecutedRequest[]) {
  held(postMargin);
  let fillRequired = postMargin, fillReserve = postMargin;
  for (const r of opens) {
    request(r); positive(r.qty, 'fill qty'); positive(r.price, 'fill price');
    if (r.owner === 'main') continue;
    const actual = r.qty * r.price, ownMargin = actual / BUDGET_LEVERAGE[r.owner];
    const unit = ownMargin + actual * 0.002;
    const stopRisk = r.stop !== undefined ? Math.max(0, r.side * (r.price - r.stop)) * r.qty + actual * 0.05 : 0;
    fillRequired += actual * 0.002; fillReserve += Math.max(unit, stopRisk) - ownMargin;
  }
  return { fillRequired, fillReserve };
}

export function admission(equity: number, heldMargin: number, requests: readonly CapitalRequest[], feeRate: number) {
  if (!Number.isFinite(equity) || !Number.isFinite(feeRate) || feeRate < 0) throw new Error('invalid capital observation');
  const terms = decisionReserves(heldMargin, requests);
  const feeAllowance = requests.reduce((n, r) => n + 2 * feeRate * r.requestedNotional, 0);
  const afterFees = equity - feeAllowance;
  return { ...terms, feeAllowance, equity: afterFees,
    pass: afterFees > 0 && afterFees >= Math.max(terms.required, terms.reserve) };
}
