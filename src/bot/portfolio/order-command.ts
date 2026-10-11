/** Persist the exact command before submission. No full-position TP/SL API here. */
import { formatQtyForStep, normalizeQtyDown } from '../executor';
import { epoch, positive } from './contract';

export interface PortfolioOrderCommand {
  version: 1; uid: string; symbol: 'HYPEUSDT'; link: string; at: number;
  orderType: 'Market' | 'Limit'; side: 'Buy' | 'Sell'; positionIdx: 1 | 2;
  qty: string; reduceOnly: boolean;
  protection?: { kind: 'maker_tp' | 'trigger_tp' | 'trigger_sl'; price: string; triggerBy?: 'LastPrice'; triggerDirection?: 1 | 2; timeInForce?: 'PostOnly' };
  /** Attached atomically to the ENTRY. Never two independent reduce-only orders. */
  bracket?: { mode: 'Partial'; stop: string; target: string; triggerBy: 'LastPrice' };
}
export interface PortfolioLotRules { step: number; minQty: number; maxMarketQty: number; minNotional: number; tick?: number; }
export function checkLotRules(r: PortfolioLotRules): void {
  for (const n of [r.step, r.minQty, r.maxMarketQty, r.minNotional]) positive(n, 'instrument lot rule');
  if (r.minQty > r.maxMarketQty) throw new Error('inverted instrument lot limits');
}
export function orderQuantity(qty: number, price: number, r: PortfolioLotRules, reduceOnly: boolean): string {
  checkLotRules(r); positive(qty, 'order quantity'); positive(price, 'order reference price');
  const q = normalizeQtyDown(qty, r.step);
  if (q > qty + 1e-8 || q < r.minQty || q > r.maxMarketQty || (!reduceOnly && q * price < r.minNotional))
    throw new Error('quantity outside instrument limits');
  // A close is an explicit lot allocation: do not round it to a different claim.
  if (reduceOnly && Math.abs(q - qty) > 1e-8) throw new Error('close allocation is not on the lot grid');
  return formatQtyForStep(q, r.step);
}
export function validateCommand(c: PortfolioOrderCommand): void {
  epoch(c.at);
  if (c.version !== 1 || !/^\d+$/.test(c.uid) || c.symbol !== 'HYPEUSDT'
    || !/^[A-Za-z0-9_-]{1,36}$/.test(c.link) || !['Market', 'Limit'].includes(c.orderType)
    || !['Buy', 'Sell'].includes(c.side) || ![1, 2].includes(c.positionIdx)
    || typeof c.reduceOnly !== 'boolean' || !/^\d+(?:\.\d+)?$/.test(c.qty)) throw new Error('invalid portfolio command');
  positive(Number(c.qty), 'command quantity');
  // Refuse full-side TP, leverage or undocumented fields.
  const keys = ['version', 'uid', 'symbol', 'link', 'at', 'orderType', 'side', 'positionIdx', 'qty', 'reduceOnly', 'protection', 'bracket'];
  if (Object.keys(c).some(k => !keys.includes(k))) throw new Error('unexpected portfolio command field');
  if (c.bracket) {
    const b = c.bracket;
    if (c.reduceOnly || c.protection || c.orderType !== 'Market' || b.mode !== 'Partial' || b.triggerBy !== 'LastPrice'
      || Object.keys(b).some(k => !['mode', 'stop', 'target', 'triggerBy'].includes(k))
      || ![b.stop, b.target].every(p => typeof p === 'string' && /^\d+(?:\.\d+)?$/.test(p) && Number(p) > 0)
      || (c.positionIdx === 1 ? Number(b.stop) >= Number(b.target) : Number(b.stop) <= Number(b.target)))
      throw new Error('invalid attached bracket');
  }
  if (!c.protection) {
    if (c.orderType !== 'Market') throw new Error('unscoped limit command');
    return;
  }
  const p = c.protection;
  if (!c.reduceOnly || !['maker_tp', 'trigger_tp', 'trigger_sl'].includes(p.kind)
    || typeof p.price !== 'string' || !/^\d+(?:\.\d+)?$/.test(p.price)) throw new Error('invalid protection');
  positive(Number(p.price), 'protection price');
  const allowed = p.kind === 'maker_tp' ? ['kind', 'price', 'timeInForce'] : ['kind', 'price', 'triggerBy', 'triggerDirection'];
  if (Object.keys(p).some(k => !allowed.includes(k))) throw new Error('unexpected protection field');
  if (p.kind === 'maker_tp') {
    if (c.orderType !== 'Limit' || p.timeInForce !== 'PostOnly') throw new Error('maker protection must be post-only');
  } else {
    const rising = (p.kind === 'trigger_tp') === (c.positionIdx === 1);
    if (c.orderType !== 'Market' || p.triggerBy !== 'LastPrice' || p.triggerDirection !== (rising ? 1 : 2))
      throw new Error('invalid conditional direction');
  }
}
