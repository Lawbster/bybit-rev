/** Receipt evidence for venue-created Partial TP/SL, not simulated client OCO.
 * Child order IDs are discovered via the documented futures parentOrderLinkId.
 * No standalone trading-stop attachment, one-sided amendments or guessed IDs.
 */
import { epoch } from './contract';
import type { Execution } from './ledger';

export interface BracketChild {
  orderId: string; parentOrderLinkId: string; kind: 'tp' | 'sl';
  side: 'Buy' | 'Sell'; positionIdx: 1 | 2;
  mode: 'Partial'; orderType: 'Market'; reduceOnly: true;
  triggerBy: 'LastPrice'; triggerDirection: 1 | 2; price: string;
  qty: number; cumulativeQty: number;
  status: 'Untriggered' | 'Triggered' | 'New' | 'PartiallyFilled' | 'Filled' | 'Cancelled' | 'Rejected';
  /** Complete, paginated history. link MUST be the parent link here. */
  executions: Execution[];
}
export interface BracketEvidence {
  uid: string; symbol: 'HYPEUSDT'; parentLink: string; observedAt: number;
  /** False for failed/truncated discovery OR any missing known child lookup. */
  complete: boolean; children: BracketChild[];
}
export interface AttachedBracket {
  parentLink: string; children: BracketChild[];
  cancelRequestedAt?: number;
  /** Both children terminal with exact receipts, not just flat inventory. */
  completedAt?: number;
}
export const childOpenKey = (orderId: string): string => `venue:${orderId}`;
export const childTerminal = (c: BracketChild): boolean => ['Filled', 'Cancelled', 'Rejected'].includes(c.status);
export function validateBracketState(b: AttachedBracket): void {
  if (!b || !b.parentLink || !Array.isArray(b.children)) throw new Error('invalid attached bracket state');
  if (b.children.length > 2 || new Set(b.children.map(c => c.orderId)).size !== b.children.length
    || new Set(b.children.map(c => c.kind)).size !== b.children.length) throw new Error('ambiguous attached children');
  for (const c of b.children) {
    if (!c.orderId || c.parentOrderLinkId !== b.parentLink || !['tp', 'sl'].includes(c.kind)
      || !['Buy', 'Sell'].includes(c.side) || ![1, 2].includes(c.positionIdx)
      || c.mode !== 'Partial' || c.orderType !== 'Market' || c.reduceOnly !== true
      || c.triggerBy !== 'LastPrice' || ![1, 2].includes(c.triggerDirection)
      || typeof c.price !== 'string' || !/^\d+(?:\.\d+)?$/.test(c.price) || Number(c.price) <= 0
      || !Number.isFinite(c.qty) || c.qty <= 0 || !Number.isFinite(c.cumulativeQty)
      || c.cumulativeQty < 0 || c.cumulativeQty > c.qty + 1e-8
      || !['Untriggered', 'Triggered', 'New', 'PartiallyFilled', 'Filled', 'Cancelled', 'Rejected'].includes(c.status)
      || !Array.isArray(c.executions) || new Set(c.executions.map(f => f.id)).size !== c.executions.length)
      throw new Error('invalid attached child');
  }
  for (const t of [b.cancelRequestedAt, b.completedAt]) if (t !== undefined) epoch(t);
  if (b.completedAt !== undefined && b.children.some(c => !childTerminal(c))) throw new Error('active child in completed bracket');
}
