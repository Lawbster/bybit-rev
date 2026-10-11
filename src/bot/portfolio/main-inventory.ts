/** Shared projection only: auxiliary lots never become ladder rungs. */
import type { LadderPosition } from '../state';
import type { PortfolioLedger } from './ledger';
export function ownedMainPositions(s: PortfolioLedger): LadderPosition[] {
  return Object.values(s.lots).filter(p => p.owner === 'main').map(p => {
    const matches = Object.values(s.orders).filter(i => i.kind === 'open' && i.lotId === p.id);
    const i = matches[0];
    if (matches.length !== 1 || i.owner !== 'main' || i.reservation?.mainLevel === undefined || p.side !== 1)
      throw new Error('main lot lacks unique rung provenance; migration required');
    return { id: p.id, entryPrice: p.cost / p.qty, entryTime: i.at, qty: p.qty, notional: p.cost,
      level: i.reservation.mainLevel, orderId: i.orderId, orderLinkId: i.link };
  }).sort((a, b) => a.entryTime - b.entryTime || a.id.localeCompare(b.id));
}
