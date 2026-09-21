import { RestClientV5 } from 'bybit-api';
import { normalizePriceToTick, normalizeQtyDown, formatQtyForStep, isTerminalOrderStatus } from './executor';
import { namedBybitCredentials, requireDistinctAccount } from './named-bybit-account';
import type { SfpConfig } from './sfp-config';
import type { SfpFill, SfpIntent } from './sfp-state';

export interface SfpSnapshot { qty: number; shortQty: number; tp: number; sl: number; liquidationPrice: number; }
export interface SfpOrderObservation { found: boolean; terminal: boolean; status: string; orderId: string; cumulativeQty: number; fills: SfpFill[]; }
export interface SfpEntryTerms { qty: number; stop: number; target: number; }
export interface SfpExchange {
  snapshot(): Promise<SfpSnapshot>;
  entryTerms(notional: number, stop: number, target: number): Promise<SfpEntryTerms>;
  submit(intent: SfpIntent): Promise<{ orderId?: string; rejected?: boolean }>;
  observe(intent: SfpIntent): Promise<SfpOrderObservation>;
  closeFills(since: number): Promise<SfpFill[]>;
  protect(stop: number, target: number): Promise<void>;
  cancel(intent: SfpIntent): Promise<void>;
}
const number = (v: unknown, field: string) => {
  if (v === '' || v === null || v === undefined || !Number.isFinite(Number(v))) throw new Error(`invalid exchange ${field}`);
  return Number(v);
};
export class SfpBybitExchange implements SfpExchange {
  private client: RestClientV5;
  private lot: { step: number; min: number; max: number; minNotional: number; tick: number } | null = null;
  constructor(readonly config: SfpConfig, client?: RestClientV5) {
    const credentials = client ? null : namedBybitCredentials(config.accountAlias);
    this.client = client ?? new RestClientV5({ key: credentials!.key, secret: credentials!.secret }, { timeout: 8000 });
  }
  private result(r: any, label: string): any {
    if (r.retCode !== 0 || !r.result) throw new Error(`Bybit ${label} failed (${r.retCode ?? 'invalid response'})`);
    return r.result;
  }
  async identity(): Promise<{ uid: string; readOnly: boolean; isMaster: boolean }> {
    const r = this.result(await this.client.getQueryApiKey(), 'identity');
    return { uid: String(r.userID ?? ''), readOnly: r.readOnly !== 0, isMaster: r.isMaster === true };
  }
  async preflight(): Promise<Record<string, unknown>> {
    const identity = await this.identity();
    if (!process.env.BYBIT_API_KEY || !process.env.BYBIT_API_SECRET) throw new Error('ladder credentials required for read-only UID isolation check');
    const main = new RestClientV5({ key: process.env.BYBIT_API_KEY, secret: process.env.BYBIT_API_SECRET }, { timeout: 8000 });
    const ladder = this.result(await main.getQueryApiKey(), 'ladder identity');
    const ladderUid = String(ladder.userID ?? '');
    if (!identity.uid || identity.uid === ladderUid || !ladderUid) throw new Error('LAWBSTER account is not isolated from ladder');
    const pos = await this.positions();
    const account = this.result(await this.client.getAccountInfo(), 'account');
    const wallet = await this.wallet();
    const orders = await this.orders();
    const lot = await this.instrument();
    const hedgeMode = pos.some((p: any) => Number(p.positionIdx) === 1) && pos.some((p: any) => Number(p.positionIdx) === 2);
    const leverageMatches = pos.filter((p: any) => [1, 2].includes(Number(p.positionIdx)))
      .every((p: any) => Number(p.leverage) === this.config.leverage);
    const errors: string[] = [];
    if (!this.config.expectedAccountUid || this.config.expectedAccountUid !== identity.uid) errors.push('expectedAccountUid_not_pinned');
    if (identity.readOnly) errors.push('account_key_read_only');
    if (!hedgeMode) errors.push('hedge_mode_required');
    if (!leverageMatches) errors.push('leverage_mismatch');
    if (account.marginMode !== 'REGULAR_MARGIN') errors.push('dedicated_cross_margin_account_required');
    return { readOnly: true, accountAlias: this.config.accountAlias, uid: identity.uid,
      ladderUid, accountIsMaster: identity.isMaster, marginMode: account.marginMode, leverage: this.config.leverage,
      equity: wallet.equity, availableBalance: wallet.available, instrument: lot,
      longQty: pos.filter((p: any) => p.side === 'Buy').reduce((s: number, p: any) => s + Number(p.size), 0),
      shortQty: pos.filter((p: any) => p.side === 'Sell').reduce((s: number, p: any) => s + Number(p.size), 0),
      openOrders: orders.length, identityAndModeReady: errors.length === 0, errors };
  }
  async verifyIdentityAndMode(): Promise<void> {
    const r = await this.preflight();
    requireDistinctAccount(String(r.uid), this.config.expectedAccountUid, String(r.ladderUid));
    if (!r.identityAndModeReady) throw new Error(`SF08 preflight: ${(r.errors as string[]).join(',')}`);
  }
  private async positions(): Promise<any[]> {
    return this.result(await this.client.getPositionInfo({ category: 'linear', symbol: this.config.symbol }), 'positions').list;
  }
  private async orders(): Promise<any[]> {
    const out: any[] = []; let cursor: string | undefined;
    for (let i = 0; i < 20; i++) {
      const r = this.result(await this.client.getActiveOrders({ category: 'linear', symbol: this.config.symbol, openOnly: 0, limit: 50, cursor }), 'orders');
      out.push(...r.list); if (!r.nextPageCursor) return out; cursor = r.nextPageCursor;
    }
    throw new Error('SF08 order pagination exceeded');
  }
  private async wallet(): Promise<{ equity: number; available: number }> {
    const r = this.result(await this.client.getWalletBalance({ accountType: 'UNIFIED' }), 'wallet').list[0];
    return { equity: number(r.totalEquity, 'equity'), available: number(r.totalAvailableBalance, 'available balance') };
  }
  private async instrument() {
    if (!this.lot) {
      const r = this.result(await this.client.getInstrumentsInfo({ category: 'linear', symbol: this.config.symbol }), 'instrument').list[0];
      if (!r || r.status !== 'Trading') throw new Error('HYPE instrument not trading');
      this.lot = { step: number(r.lotSizeFilter.qtyStep, 'qty step'), min: number(r.lotSizeFilter.minOrderQty, 'min qty'),
        max: number(r.lotSizeFilter.maxMktOrderQty, 'max qty'), minNotional: number(r.lotSizeFilter.minNotionalValue, 'min notional'),
        tick: number(r.priceFilter.tickSize, 'tick') };
      if (this.lot.step <= 0 || this.lot.tick <= 0) throw new Error('invalid instrument precision');
    }
    return this.lot;
  }
  async snapshot(): Promise<SfpSnapshot> {
    const ps = await this.positions();
    const long = ps.find(p => Number(p.positionIdx) === 1);
    if (!long || ps.some(p => Number(p.positionIdx) === 0 && Number(p.size) > 0)) throw new Error('SF08 position mode changed');
    return { qty: number(long.size, 'long size'), shortQty: ps.filter(p => p.side === 'Sell').reduce((s, p) => s + number(p.size, 'short size'), 0),
      tp: Number(long.takeProfit || 0), sl: Number(long.stopLoss || 0), liquidationPrice: Number(long.liqPrice || 0) };
  }
  async entryTerms(notional: number, stop: number, target: number): Promise<SfpEntryTerms> {
    if ((await this.orders()).length) throw new Error('SF08 account has existing HYPE orders');
    const ps = await this.positions();
    if (ps.some(p => Number(p.size) > 0) || !ps.every(p => Number(p.leverage) === this.config.leverage)) throw new Error('SF08 account inventory/leverage changed');
    const lot = await this.instrument(), wallet = await this.wallet();
    const res = await this.client.getTickers({ category: 'linear', symbol: this.config.symbol });
    const row = this.result(res, 'quote').list[0];
    if (!Number.isFinite(Number(res.time)) || Math.abs(Date.now() - Number(res.time)) > 10_000) throw new Error('stale quote response');
    const ask = number(row.ask1Price, 'ask'), bid = number(row.bid1Price, 'bid');
    const roundedStop = normalizePriceToTick(stop, lot.tick, 'down');
    const roundedTarget = normalizePriceToTick(target, lot.tick, 'up');
    if (ask <= 0 || bid <= 0 || bid > ask || ask >= roundedTarget || bid <= roundedStop) throw new Error('entry quote outside SF08 bracket');
    const qty = normalizeQtyDown(notional / ask, lot.step);
    if (qty < lot.min || qty > lot.max || qty * ask < lot.minNotional) throw new Error('SF08 quantity outside instrument limits');
    if (wallet.available < notional / this.config.leverage + notional * 0.002) throw new Error('insufficient SF08 available margin');
    // Dedicated collateral must cover stop-distance loss plus a conservative reserve.
    if (wallet.equity < qty * (ask - roundedStop) + notional * 0.05) throw new Error('insufficient collateral beyond SF08 stop');
    return { qty, stop: roundedStop, target: roundedTarget };
  }
  async submit(i: SfpIntent): Promise<{ orderId?: string; rejected?: boolean }> {
    const lot = await this.instrument();
    const args: any = { category: 'linear', symbol: this.config.symbol, positionIdx: 1,
      side: i.kind === 'open' ? 'Buy' : 'Sell', orderType: 'Market',
      qty: formatQtyForStep(i.qty, lot.step), orderLinkId: i.link, reduceOnly: i.kind === 'close' };
    if (i.kind === 'open') Object.assign(args, { takeProfit: String(i.target), stopLoss: String(i.stop),
      tpslMode: 'Full', tpTriggerBy: 'LastPrice', slTriggerBy: 'LastPrice' });
    const r = await this.client.submitOrder(args);
    if (r.retCode !== 0) {
      // Only explicit parameter/balance/price rejection is terminal here. Timeouts,
      // duplicate IDs and server errors retain the durable intent for observation.
      if ([10001, 110003, 110004, 110007, 110012].includes(r.retCode)) return { rejected: true };
      throw new Error(`Bybit submit unresolved (${r.retCode})`);
    }
    return { orderId: String(r.result.orderId) };
  }
  private async executions(since: number, link?: string): Promise<any[]> {
    const out: any[] = []; let cursor: string | undefined;
    // Exchange query range is capped at seven days; a recovery older than that
    // fails closed instead of silently treating a truncated history as complete.
    if (Date.now() - since > 7 * 86400_000) throw new Error('SF08 execution evidence exceeds seven-day API window');
    for (let i = 0; i < 20; i++) {
      const r = this.result(await this.client.getExecutionList({ category: 'linear', symbol: this.config.symbol,
        startTime: since, endTime: Date.now(), orderLinkId: link, limit: 100, cursor }), 'executions');
      out.push(...r.list); if (!r.nextPageCursor) return out; cursor = r.nextPageCursor;
    }
    throw new Error('SF08 execution pagination exceeded');
  }
  private fill(e: any): SfpFill {
    const f = { id: String(e.execId), orderId: String(e.orderId), at: number(e.execTime, 'execution time'),
      qty: number(e.execQty, 'execution qty'), price: number(e.execPrice, 'execution price'), fee: number(e.execFee, 'execution fee') };
    if (!e.execId || !e.orderId || f.qty <= 0 || f.price <= 0 || !Number.isSafeInteger(f.at)) throw new Error('invalid SF08 execution');
    return f;
  }
  async observe(i: SfpIntent): Promise<SfpOrderObservation> {
    let r = this.result(await this.client.getActiveOrders({ category: 'linear', symbol: this.config.symbol, orderLinkId: i.link }), 'observe realtime');
    let orders = r.list.filter((o: any) => o.orderLinkId === i.link);
    if (!orders.length) {
      r = this.result(await this.client.getHistoricOrders({ category: 'linear', symbol: this.config.symbol, orderLinkId: i.link }), 'observe history');
      orders = r.list.filter((o: any) => o.orderLinkId === i.link);
    }
    if (orders.length > 1) throw new Error('ambiguous SF08 order identity');
    const o = orders[0];
    if (o && i.orderId && o.orderId !== i.orderId) throw new Error('SF08 acknowledged order ID mismatch');
    const fills = (await this.executions(i.at, i.link)).filter(e => e.execType === 'Trade');
    if (fills.some(e => e.orderLinkId !== i.link || e.side !== (i.kind === 'open' ? 'Buy' : 'Sell')
      || (o && e.orderId !== o.orderId))) throw new Error('SF08 execution identity mismatch');
    if (o && (o.side !== (i.kind === 'open' ? 'Buy' : 'Sell') || Number(o.positionIdx) !== 1
      || (i.kind === 'close' && o.reduceOnly !== true))) throw new Error('SF08 order side mismatch');
    const mapped = [...new Map(fills.map(e => { const f = this.fill(e); return [f.id, f] as const; })).values()];
    return { found: !!o, terminal: !!o && isTerminalOrderStatus(o.orderStatus), status: o?.orderStatus ?? 'unknown',
      orderId: String(o?.orderId ?? mapped[0]?.orderId ?? ''), cumulativeQty: o ? number(o.cumExecQty, 'order filled qty') : 0, fills: mapped };
  }
  async closeFills(since: number): Promise<SfpFill[]> {
    const rows = (await this.executions(since)).filter(e => e.execType === 'Trade' && e.side === 'Sell');
    if (rows.some(e => number(e.closedSize, 'closed size') !== number(e.execQty, 'exec qty'))) throw new Error('non-reducing SF08 Sell execution');
    return [...new Map(rows.map(e => { const f = this.fill(e); return [f.id, f] as const; })).values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  }
  async protect(stop: number, target: number): Promise<void> {
    const r = await this.client.setTradingStop({ category: 'linear', symbol: this.config.symbol, positionIdx: 1,
      stopLoss: String(stop), takeProfit: String(target), tpslMode: 'Full', tpTriggerBy: 'LastPrice', slTriggerBy: 'LastPrice' });
    if (r.retCode !== 0 && r.retCode !== 34040) throw new Error(`SF08 protection failed (${r.retCode})`);
  }
  async cancel(i: SfpIntent): Promise<void> {
    const r = await this.client.cancelOrder({ category: 'linear', symbol: this.config.symbol, orderLinkId: i.link });
    if (r.retCode !== 0 && r.retCode !== 110001) throw new Error(`SF08 cancellation unresolved (${r.retCode})`);
  }
}
