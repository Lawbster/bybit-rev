/** Live account reads for the single shared HYPE owner. Does not change mode,
 * leverage, collateral or orders. The receipt coordinator reconciles openLinks
 * and position quantities; this reader never assigns inventory by average price.
 */
import type { RestClientV5 } from 'bybit-api';
import type { PortfolioExchangeSnapshot } from './execution-coordinator';
import { childOpenKey } from './bracket-state';

type Row = Record<string, any>;
type ReadClient = Pick<RestClientV5, 'getQueryApiKey' | 'getAccountInfo' | 'getWalletBalance' |
  'getPositionInfo' | 'getActiveOrders' | 'getInstrumentsInfo' | 'getTickers'>;
const SYMBOL = 'HYPEUSDT', UID = '555249668';
function fail(reason: string): never { throw new Error(`portfolio account: ${reason}`); }
function num(v: unknown): number {
  if ((typeof v !== 'number' && typeof v !== 'string') || v === '' || !Number.isFinite(Number(v))) fail('invalid_number');
  return Number(v);
}
const zero = (v: unknown) => v === '' || v === undefined || num(v) === 0;
export class BybitPortfolioAccount {
  latest: PortfolioExchangeSnapshot | null = null;
  funding: { at: number; value: number } | null = null;
  private instrument: Row | null = null;
  private instrumentAt = 0;
  constructor(private readonly client: ReadClient, private readonly clock = Date.now) {}
  private async read(method: keyof ReadClient, query?: Row): Promise<Row> {
    const label = [method, query?.category, query?.settleCoin].filter(Boolean).join(':');
    const sentAt = this.clock();
    let r: any;
    // Never include the SDK error, request headers or response body in diagnostics.
    try { r = await (this.client[method] as Function)(query); } catch { return fail(`${label}:request_failed`); }
    const now = this.clock();
    if (r?.retCode !== 0) fail(`${label}:retCode_${Number.isSafeInteger(r?.retCode) ? r.retCode : 'invalid'}`);
    if (!r.result || typeof r.result !== 'object' || Array.isArray(r.result)) fail(`${label}:invalid_result`);
    if (now < sentAt || now - sentAt > 5000) fail(`${label}:request_expired`);
    // /v5/account/info returns APIResponseV3 (no guaranteed top-level time).
    // Its updatedTime dates an account-setting change, NOT this response.
    // Only that endpoint may omit time; if supplied, it must still be fresh.
    // All other responses and the complete snapshot retain their clock checks.
    if (!(method === 'getAccountInfo' && r.time === undefined)) {
      if (!((typeof r.time === 'number' || typeof r.time === 'string' && /^\d+$/.test(r.time))
        && Number.isSafeInteger(Number(r.time)) && Number(r.time) > 0)) fail(`${label}:invalid_server_time`);
      if (Math.abs(now - Number(r.time)) > 5000) fail(`${label}:server_clock_out_of_bounds`);
    }
    return r.result;
  }
  private async pages(method: 'getPositionInfo' | 'getActiveOrders', query: Row): Promise<{ rows: Row[]; pageIds: string[][] }> {
    const rows: Row[] = [], pageIds: string[][] = [], cursors = new Set<string>(), seen = new Set<string>(); let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const r = await this.read(method, { ...query, limit: method === 'getPositionInfo' ? 200 : 50, ...(cursor ? { cursor } : {}) });
      if (!Array.isArray(r.list)) fail('missing_list'); const ids: string[] = [];
      for (const row of r.list) {
        const id = method === 'getPositionInfo' ? `${row.symbol}:${row.positionIdx}` : row.orderId;
        if (typeof id !== 'string' || !id || seen.has(id)) fail('duplicate_identity');
        seen.add(id); rows.push(row); ids.push(id);
      }
      pageIds.push(ids);
      if (!r.nextPageCursor) return { rows, pageIds };
      if (typeof r.nextPageCursor !== 'string' || cursors.has(r.nextPageCursor)) fail('cursor_cycle');
      cursor = r.nextPageCursor; cursors.add(cursor!);
    }
    return fail('page_limit');
  }
  private hedgeRows(p: { rows: Row[]; pageIds: string[][] }): Row[] {
    const hedges = p.rows.filter(r => r.symbol === SYMBOL && (r.positionIdx === 1 || r.positionIdx === 2));
    const other = p.rows.filter(r => !hedges.includes(r));
    if (hedges.length !== 2 || new Set(hedges.map(r => r.positionIdx)).size !== 2) fail('hedge_mode_required');
    if (other.length) {
      const r = other[0];
      // Exact witnessed terminal page, not a general ignore-flat-idx0 rule.
      if (other.length !== 1 || p.pageIds.length !== 2 || p.pageIds[0].length !== 2
        || ![1, 2].every(idx => p.pageIds[0].includes(`${SYMBOL}:${idx}`))
        || p.pageIds[1].length !== 1 || p.pageIds[1][0] !== `${SYMBOL}:0`
        || !hedges.every(h => num(h.seq) > 0 && num(h.updatedTime) > 0)
        || r.symbol !== SYMBOL || r.positionIdx !== 0 || num(r.size) !== 0 || r.side !== ''
        || num(r.seq) !== -1 || r.updatedTime !== '' || ![r.takeProfit, r.stopLoss, r.trailingStop].every(zero)) fail('unexpected_position_row');
    }
    for (const r of hedges) if (num(r.leverage) !== 25 || num(r.size) < 0
      || num(r.size) > 0 && r.side !== (r.positionIdx === 1 ? 'Buy' : 'Sell')) fail('position_mode_or_leverage');
    return hedges;
  }
  async snapshot(): Promise<PortfolioExchangeSnapshot> {
    const start = this.clock(), identity = await this.read('getQueryApiKey');
    if (String(identity.userID) !== UID) fail('wrong_account');
    const before = this.hedgeRows(await this.pages('getPositionInfo', { category: 'linear', symbol: SYMBOL }));
    const scopes = [{ category: 'linear', settleCoin: 'USDT' }, { category: 'linear', settleCoin: 'USDC' },
      { category: 'inverse' }, { category: 'option' }];
    const [info, wallet, ticker, positions, orderSets] = await Promise.all([
      this.read('getAccountInfo'), this.read('getWalletBalance', { accountType: 'UNIFIED' }),
      this.read('getTickers', { category: 'linear', symbol: SYMBOL }),
      Promise.all(scopes.map(s => this.pages('getPositionInfo', s))),
      Promise.all([...scopes, { category: 'spot' }].map(s => this.pages('getActiveOrders', { ...s, openOnly: 0 }))),
    ]);
    if (info.marginMode !== 'REGULAR_MARGIN') fail('cross_margin_required');
    if (!this.instrument || start - this.instrumentAt > 3600000) {
      const instruments = await this.read('getInstrumentsInfo', { category: 'linear', symbol: SYMBOL });
      if (instruments.list?.length !== 1 || instruments.list[0].symbol !== SYMBOL
        || instruments.list[0].status !== 'Trading' || instruments.list[0].settleCoin !== 'USDT') fail('instrument_unavailable');
      this.instrument = instruments.list[0]; this.instrumentAt = this.clock();
    }
    for (const [idx, set] of positions.entries()) for (const p of set.rows) {
      if (num(p.size) !== 0 && (idx !== 0 || p.symbol !== SYMBOL || ![1, 2].includes(p.positionIdx))) fail('unowned_position');
    }
    const orders: Row[] = orderSets.flatMap((set, idx) => set.rows.map(r => ({ ...r, scope: idx })));
    if (orders.some(o => o.scope !== 0 || o.symbol !== SYMBOL || ![1, 2].includes(o.positionIdx))) fail('unowned_order');
    const openLinks = orders.map(o => o.parentOrderLinkId ? childOpenKey(o.orderId)
      : typeof o.orderLinkId === 'string' && o.orderLinkId ? o.orderLinkId : `unowned:${o.orderId}`);
    if (new Set(openLinks).size !== openLinks.length) fail('duplicate_open_link');
    if (wallet.list?.length !== 1 || wallet.list[0].accountType !== 'UNIFIED' || !Array.isArray(wallet.list[0].coin)) fail('wallet_scope');
    const w = wallet.list[0], coins: Row[] = w.coin;
    if (coins.some(c => !zero(c.borrowAmount) || !zero(c.spotBorrow)
      || c.coin !== 'USDT' && [c.walletBalance, c.equity, c.usdValue].some(v => !zero(v) && num(v) !== 0))) fail('other_collateral_or_borrow');
    const usdt = coins.filter(c => c.coin === 'USDT'); if (usdt.length !== 1) fail('usdt_cash_unavailable');
    const cash = num(usdt[0].walletBalance), equity = num(w.totalEquity), available = num(w.totalAvailableBalance);
    if (equity < 0 || available < 0) fail('negative_account_balance');
    const after = this.hedgeRows(await this.pages('getPositionInfo', { category: 'linear', symbol: SYMBOL }));
    // Do not combine wallet/order reads across an observed position mutation.
    const signature = (rs: Row[]) => JSON.stringify(rs.map(r => [r.positionIdx, r.size, r.seq, r.updatedTime, r.takeProfit, r.stopLoss, r.trailingStop]).sort());
    if (signature(before) !== signature(after)) fail('position_changed_during_read');
    const at = this.clock(); if (at < start || at - start > 5000) fail('snapshot_expired');
    if (ticker.list?.length !== 1 || ticker.list[0].symbol !== SYMBOL) fail('quote_unavailable');
    const t = ticker.list[0], bid = num(t.bid1Price), ask = num(t.ask1Price), instrument = this.instrument!;
    if (!(bid > 0 && ask >= bid)) fail('invalid_quote');
    this.funding = { at: start, value: num(t.fundingRate) };
    this.latest = { uid: UID, symbol: SYMBOL, observedAt: start, hedgeMode: true, leverageLong: 25, leverageShort: 25,
      longQty: num(after.find(r => r.positionIdx === 1)!.size), shortQty: num(after.find(r => r.positionIdx === 2)!.size),
      nativeProtection: after.some(r => [r.takeProfit, r.stopLoss, r.trailingStop].some(v => !zero(v))), openLinks,
      equity, availableBalance: available, bid, ask, decisionCash: { balance: cash, observedAt: start, scope: 'USDT_ONLY_HYPE_OWNED' },
      rules: { step: num(instrument.lotSizeFilter.qtyStep), minQty: num(instrument.lotSizeFilter.minOrderQty),
        maxMarketQty: num(instrument.lotSizeFilter.maxMktOrderQty), minNotional: num(instrument.lotSizeFilter.minNotionalValue), tick: num(instrument.priceFilter.tickSize) } };
    return structuredClone(this.latest);
  }
}
