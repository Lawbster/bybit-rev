import { createHash } from 'crypto';
import type { OrderParamsV5 } from 'bybit-api';
import { normalizePriceToTick } from '../executor';
import { positive, releaseAt } from './contract';
import { applyExecution, finishOrder, type PortfolioLedger, type Intent, type Execution } from './ledger';
import { validateCommand, type PortfolioOrderCommand } from './order-command';
import { childTerminal, validateBracketState, type BracketEvidence, type AttachedBracket } from './bracket-state';
const EPS = 1e-8;

export function attachedBracketCommand(base: PortfolioOrderCommand, stop: number, target: number,
  tick: number, bid: number, ask: number): PortfolioOrderCommand {
  for (const p of [stop, target, tick, bid, ask]) positive(p, 'bracket price');
  const long = base.positionIdx === 1;
  const sl = normalizePriceToTick(stop, tick, long ? 'down' : 'up');
  const tp = normalizePriceToTick(target, tick, long ? 'up' : 'down');
  // Reject a crossed setup, never move its levels to manufacture an entry.
  if (bid > ask || (long ? sl >= bid || tp <= ask : sl <= ask || tp >= bid)) throw new Error('attached bracket already crossed');
  const c: PortfolioOrderCommand = { ...base, bracket: { mode: 'Partial', stop: String(sl), target: String(tp), triggerBy: 'LastPrice' } };
  validateCommand(c); return c;
}
/** Pure API payload builder. No client/credentials/network or Full-position mode. */
export function attachedEntryPayload(c: PortfolioOrderCommand): OrderParamsV5 {
  validateCommand(c); if (!c.bracket) throw new Error('entry has no attached bracket');
  return { category: 'linear', symbol: c.symbol, orderLinkId: c.link, orderType: 'Market',
    side: c.side, positionIdx: c.positionIdx, qty: c.qty, reduceOnly: false,
    tpslMode: 'Partial', takeProfit: c.bracket.target, stopLoss: c.bracket.stop,
    tpTriggerBy: 'LastPrice', slTriggerBy: 'LastPrice', tpOrderType: 'Market', slOrderType: 'Market' };
}
export function beginAttachedBracket(s: PortfolioLedger, i: Intent): void {
  if (!i.command?.bracket || !['SF08', 'PA07'].includes(i.source) || s.brackets?.[i.link]) throw new Error('invalid attached entry');
  s.brackets ??= {}; s.brackets[i.link] = { parentLink: i.link, children: [] };
}
const receiptLink = (f: Execution) => `pf_b_${createHash('sha256').update(JSON.stringify([f.orderId, f.id])).digest('hex').slice(0, 28)}`;
/** Every exchange execution remains identifiable by its REAL order and exec ID.
 * A terminal receipt-only close intent reuses the standard lot/fee accounting;
 * it is never a second order to submit or an invented fill.
 */
function applyChildReceipt(s: PortfolioLedger, parent: Intent, f: Execution, reason: string, observedAt: number): void {
  const link = receiptLink(f), mapped = { ...f, link };
  if (s.executions[f.id]) {
    if (JSON.stringify(s.executions[f.id]) !== JSON.stringify(mapped)) throw new Error('conflicting attached execution');
    return;
  }
  const lot = s.lots[parent.lotId];
  if (!lot || lot.owner !== parent.owner || f.qty > lot.qty + EPS || s.orders[link]) throw new Error('attached fill exceeds owned inventory');
  s.orders[link] = { link, orderId: f.orderId, owner: parent.owner, source: parent.source, side: parent.side,
    kind: 'close', at: f.at, qty: f.qty, appliedQty: 0, terminal: false, reason,
    lotId: lot.id, allocations: [{ lotId: lot.id, qty: f.qty, applied: 0 }], allocationMode: 'selected_ids' };
  applyExecution(s, mapped, observedAt); finishOrder(s, link, 'Filled', f.qty, observedAt);
}

/** Call inside a store transaction. Missing/incomplete evidence mutates nothing.
 * Multi-pair partial-fill layouts are intentionally unsupported until witnessed.
 */
export function observeAttachedBracket(s: PortfolioLedger, e: BracketEvidence): 'pending' | 'resting' | 'settled' {
  const b = s.brackets?.[e.parentLink], parent = s.orders[e.parentLink], expected = parent?.command?.bracket;
  if (!b || !parent || !expected || e.uid !== s.uid || e.symbol !== s.symbol || e.observedAt < parent.at)
    throw new Error('attached evidence identity mismatch');
  if (!e.complete) return 'pending';
  const next: AttachedBracket = { ...b, children: structuredClone(e.children) };
  validateBracketState(next);
  // Known children never vanish, change identity, lose receipts or resurrect.
  for (const old of b.children) {
    const c = next.children.find(x => x.orderId === old.orderId);
    if (!c) return 'pending';
    if (c.kind !== old.kind || (childTerminal(old) && JSON.stringify(c) !== JSON.stringify(old)))
      throw new Error('attached child identity/terminal state changed');
    if (old.executions.some(f => !c.executions.some(x => x.id === f.id))) return 'pending';
    if (old.executions.some(f => JSON.stringify(f) !== JSON.stringify(c.executions.find(x => x.id === f.id))))
      throw new Error('conflicting attached receipt history');
  }
  const all = next.children.flatMap(c => c.executions);
  if (new Set(all.map(f => f.id)).size !== all.length) throw new Error('duplicate cross-child execution');
  for (const c of next.children) {
    const long = parent.side === 1;
    if (c.side !== (long ? 'Sell' : 'Buy') || c.positionIdx !== (long ? 1 : 2)
      || c.triggerDirection !== ((c.kind === 'tp') === long ? 1 : 2)
      || Number(c.price) !== Number(c.kind === 'tp' ? expected.target : expected.stop)
      || c.qty > parent.qty + EPS)
      throw new Error('attached child disagrees with owned entry');
    // Parent executions may lag child discovery. This is not evidence that the
    // child owns another lot, and it is not permission to apply a guessed fill.
    if (c.qty > parent.appliedQty + EPS) {
      if (!parent.terminal) return 'pending';
      throw new Error('attached child exceeds final entry fill');
    }
    for (const f of c.executions) {
      if (f.link !== parent.link || f.orderId !== c.orderId || f.side !== c.side || f.positionIdx !== c.positionIdx
        || !f.id || !Number.isFinite(f.qty) || f.qty <= 0 || !Number.isFinite(f.price) || f.price <= 0
        || !Number.isFinite(f.fee) || !Number.isSafeInteger(f.at) || f.at < parent.at || f.at > e.observedAt)
        throw new Error('invalid attached execution');
    }
    if (Math.abs(c.executions.reduce((n, f) => n + f.qty, 0) - c.cumulativeQty) > EPS) return 'pending';
    if ((c.status === 'Filled' && Math.abs(c.qty - c.cumulativeQty) > EPS)
      || (c.status === 'Rejected' && c.cumulativeQty !== 0)) throw new Error('invalid attached terminal quantity');
  }
  if (all.reduce((n, f) => n + f.qty, 0) > parent.appliedQty + EPS) throw new Error('paired fills exceed parent quantity');
  // Both siblings share ONE inventory budget. Never charge the other owner's lots.
  for (const f of all.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)))
    applyChildReceipt(s, parent, f, next.children.find(c => c.orderId === f.orderId)!.kind === 'tp' ? 'target' : 'stop', e.observedAt);
  s.brackets![parent.link] = next;
  const terminal = parent.terminal && (parent.appliedQty === 0 && next.children.length === 0
    || next.children.length === 2 && next.children.every(childTerminal));
  if (terminal) {
    next.completedAt ??= e.observedAt;
    // Delay slot/source reuse until ALL exit authority is retired.
    if (!s.lots[parent.lotId]) {
      const last = all.reduce((t, f) => Math.max(t, f.at), parent.at);
      const released = all.length ? releaseAt(parent.source, 'target', last, e.observedAt) : e.observedAt;
      s.availableAfter[parent.owner] = Math.max(s.availableAfter[parent.owner] ?? 0, released);
      s.sourceAfter[parent.source] = Math.max(s.sourceAfter[parent.source] ?? 0, released);
    }
    return 'settled';
  }
  const remaining = s.lots[parent.lotId]?.qty ?? 0;
  return parent.terminal && b.cancelRequestedAt === undefined && next.children.length === 2 && remaining > EPS
    && next.children.every(c => c.status === 'Untriggered' && Math.abs(c.qty - c.cumulativeQty - remaining) < EPS)
    ? 'resting' : 'pending';
}
