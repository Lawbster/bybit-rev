/** Actual signed venue settlements, separate from trade fees and cash admission.
 * Attribution uses immutable executions at settlement time, not today's lots. */
import type { RestClientV5 } from 'bybit-api';
import type { PortfolioLedger } from './ledger';
import type { Owner } from './contract';
export interface FundingReceipt { id: string; at: number; amount: number; qty: number;
  side: 'Buy' | 'Sell'; owners: Partial<Record<Owner, number>>; issue: string | null }
export async function readPortfolioFunding(client: Pick<RestClientV5, 'getTransactionLog'>, s: PortfolioLedger,
  now: number, since: number): Promise<FundingReceipt[]> {
  const result: FundingReceipt[] = [], cursors = new Set<string>(); let cursor: string | undefined;
  // Overlap catches lagged settlements. Longer offline periods must be explicitly
  // backfilled; never call this a complete lifetime log.
  const startTime = Math.max(s.mainControl!.initializedAt, since, now - 7 * 86400000 + 1);
  for (let page = 0; page < 20; page++) {
    let r;
    try { r = await client.getTransactionLog({ accountType: 'UNIFIED', category: 'linear', currency: 'USDT', type: 'SETTLEMENT',
      startTime, endTime: now, limit: 50, ...(cursor ? { cursor } : {}) }); }
    catch { throw new Error('portfolio funding: request_failed'); }
    if (r.retCode !== 0 || !Array.isArray(r.result.list)) throw new Error('portfolio funding: invalid_response');
    for (const row of r.result.list) {
      if (row.symbol !== 'HYPEUSDT') continue;
      const id = (row as typeof row & { id?: string }).id; // Present in v5 API; older SDK typings omit it.
      const at = Number(row.transactionTime), amount = Number(row.funding), qty = Math.abs(Number(row.qty));
      if (!id || !Number.isSafeInteger(at) || at < startTime || at > now || !Number.isFinite(amount) || !(qty > 0)
        || !['Buy', 'Sell'].includes(row.side)) throw new Error('portfolio funding: invalid_settlement');
      const side = row.side as 'Buy' | 'Sell', idx = side === 'Buy' ? 1 : 2, weights: Partial<Record<Owner, number>> = {};
      let ambiguous = false;
      for (const e of Object.values(s.executions)) {
        if (e.positionIdx !== idx || e.at > at) continue;
        if (e.at === at) { ambiguous = true; continue; }
        const i = s.orders[e.link]; if (!i) throw new Error('portfolio funding: unowned_execution');
        weights[i.owner] = (weights[i.owner] ?? 0) + (i.kind === 'open' ? e.qty : -e.qty);
      }
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      const issue = ambiguous ? 'settlement_execution_tie' : Math.abs(total - qty) > 1e-6 ? 'settlement_quantity_unreconciled' : null;
      const owners = issue ? {} : Object.fromEntries(Object.entries(weights).filter(([, q]) => q! > 1e-8).map(([owner, q]) => [owner, amount * q! / total]));
      result.push({ id, at, amount, qty, side, owners, issue });
    }
    if (!r.result.nextPageCursor) return result;
    cursor = r.result.nextPageCursor; if (cursors.has(cursor)) throw new Error('portfolio funding: cursor_cycle'); cursors.add(cursor);
  }
  throw new Error('portfolio funding: page_limit');
}
