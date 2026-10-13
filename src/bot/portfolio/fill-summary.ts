/** Read-only receipt accounting for notifications and live/replay audits. */
import { applyExecution, emptyLedger, type PortfolioLedger } from './ledger';

export interface PortfolioFillSummary {
  orderId: string; links: string[]; owner: string; source: string;
  kind: 'open' | 'close'; reason: string; side: 1 | -1;
  qty: number; value: number; fees: number; net: number;
  firstAt: number; lastAt: number; terminal: boolean;
}

/** Reuse the authoritative lot allocator, without main policy memory or writes.
 * Entry fees are charged to realized PnL when the corresponding quantity closes.
 * Child execution intents sharing one exchange order form one notification.
 */
export function portfolioFillSummaries(state: PortfolioLedger): PortfolioFillSummary[] {
  const replay = emptyLedger(state.uid);
  for (const i of Object.values(state.orders)) replay.orders[i.link] = {
    ...i, terminal: false, appliedQty: 0,
    allocations: i.allocations.map(a => ({ ...a, applied: 0 })),
  };
  const groups = new Map<string, PortfolioFillSummary>();
  for (const e of Object.values(state.executions).sort((a, b) => a.at - b.at)) {
    const i = state.orders[e.link];
    if (!i) throw new Error('fill summary missing intent');
    const before = replay.realizedBeforeFunding;
    applyExecution(replay, e, e.at);
    const key = [e.orderId, i.owner, i.kind].join(':');
    let g = groups.get(key);
    if (!g) {
      g = { orderId: e.orderId, links: [], owner: i.owner, source: i.source,
        kind: i.kind, reason: i.reason, side: i.side, qty: 0, value: 0, fees: 0,
        net: 0, firstAt: e.at, lastAt: e.at, terminal: true };
      groups.set(key, g);
    }
    if (!g.links.includes(i.link)) g.links.push(i.link);
    g.terminal &&= i.terminal;
    g.qty += e.qty; g.value += e.qty * e.price; g.fees += e.fee;
    g.net += replay.realizedBeforeFunding - before;
    g.lastAt = Math.max(g.lastAt, e.at);
  }
  if (Math.abs(replay.realizedBeforeFunding - state.realizedBeforeFunding) > 1e-6
    || Math.abs(replay.fees - state.fees) > 1e-6)
    throw new Error('fill summary receipt accounting mismatch');
  return [...groups.values()];
}

export function portfolioFillFields(fill: PortfolioFillSummary) {
  const money = (v: number) => `${v < 0 ? '-' : '+'}$${Math.abs(v).toFixed(2)}`;
  return [
    { name: 'Owner', value: `${fill.owner} / ${fill.side === 1 ? 'LONG' : 'SHORT'}` },
    { name: 'Filled HYPE', value: fill.qty.toFixed(4).replace(/\.?0+$/, '') },
    { name: 'Average fill', value: `$${(fill.value / fill.qty).toFixed(4)}` },
    ...(fill.kind === 'close'
      ? [{ name: 'Realized PnL', value: `${money(fill.net)} (net entry/exit fees; before funding)` }]
      : [{ name: 'Realized PnL', value: 'Not realized — entry fill' }]),
    { name: fill.kind === 'open' ? 'Entry fees' : 'Exit fees (included above)', value: `$${fill.fees.toFixed(2)}` },
    { name: 'Order', value: fill.orderId },
  ];
}
