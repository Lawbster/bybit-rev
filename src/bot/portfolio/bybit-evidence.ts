/** Read-only venue boundary. No keys, write methods, process entrypoint or live
 * transport enablement. Missing orders are never proof of cancellation.
 * Exact-ID realtime + history is intentional: history lag was witnessed in the
 * operator's isolated October 11 probe. Receipts, not flatness, settle ownership.
 */
import { epoch } from './contract';
import { validateCommand, type PortfolioOrderCommand } from './order-command';
import type { PortfolioOrderEvidence } from './execution-coordinator';
import type { BracketChild, BracketEvidence } from './bracket-state';
import type { Execution } from './ledger';

interface Query {
  category: 'linear'; symbol: 'HYPEUSDT'; limit: 50; cursor?: string;
  orderId?: string; orderLinkId?: string; openOnly?: 0;
  startTime?: number; endTime?: number;
}
/** Structural subset of RestClientV5, deliberately incapable of submitting. */
export interface BybitEvidenceClient {
  getQueryApiKey(): Promise<unknown>;
  getActiveOrders(q: Query): Promise<unknown>;
  getHistoricOrders(q: Query): Promise<unknown>;
  getExecutionList(q: Query): Promise<unknown>;
}
type Row = Record<string, unknown>;
type Method = 'getActiveOrders' | 'getHistoricOrders' | 'getExecutionList';
type Status = BracketChild['status'];
const EPS = 1e-8, WEEK = 7 * 86400000, MAX_PAGES = 20, MAX_READ_MS = 5000;
const base = { category: 'linear', symbol: 'HYPEUSDT', limit: 50 } as const;
function fail(code: string): never { throw new Error(`portfolio evidence: ${code}`); }
function object(v: unknown): Row {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('invalid_object');
  return v as Row;
}
function number(v: unknown): number {
  if (!(typeof v === 'number' || typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v))) fail('invalid_number');
  const n = Number(v); if (!Number.isFinite(n)) fail('invalid_number'); return n;
}
function id(v: unknown): string {
  if (typeof v !== 'string' || !v || v.length > 128) fail('invalid_identity');
  return v as string;
}
function time(v: unknown): number { const n = number(v); epoch(n); return n; }
function status(v: unknown): Status {
  if (v === 'Deactivated' || v === 'PartiallyFilledCanceled') return 'Cancelled';
  if (!['New', 'PartiallyFilled', 'Filled', 'Cancelled', 'Rejected', 'Untriggered', 'Triggered'].includes(String(v)))
    fail('unsupported_status');
  return v as Status;
}
const terminal = (v: unknown) => ['Filled', 'Cancelled', 'Rejected'].includes(status(v));
const empty = (v: unknown) => v === undefined || v === '' || v === '0' || v === 0;
function sameNumber(a: unknown, b: unknown): boolean { return Math.abs(number(a) - number(b)) <= EPS; }

/** Endpoints can disagree transiently. Accept monotone state/receipt progress,
 * never changed identity or contradictory terminal receipts. */
function merge(old: Row | undefined, row: Row): Row {
  id(row.orderId); time(row.updatedTime); status(row.orderStatus);
  if (!old) return row;
  for (const k of ['orderId', 'symbol', 'orderLinkId', 'parentOrderLinkId', 'side', 'positionIdx', 'orderType',
    'reduceOnly', 'closeOnTrigger', 'tpslMode', 'stopOrderType', 'triggerBy', 'triggerDirection', 'tpTriggerBy', 'slTriggerBy',
    'timeInForce', 'tpOrderType', 'slOrderType']) {
    if (old[k] !== row[k]) fail('order_identity_conflict');
  }
  for (const k of ['qty', 'triggerPrice', 'takeProfit', 'stopLoss']) {
    if (!(empty(old[k]) && empty(row[k])) && !sameNumber(old[k], row[k])) fail('order_terms_changed');
  }
  if (row.orderType === 'Limit' && !sameNumber(old.price, row.price)) fail('limit_price_changed');
  const a = time(old.updatedTime), b = time(row.updatedTime);
  const at = terminal(old.orderStatus), bt = terminal(row.orderStatus);
  if (at && bt && (status(old.orderStatus) !== status(row.orderStatus) || !sameNumber(old.cumExecQty, row.cumExecQty)))
    fail('terminal_conflict');
  if (at !== bt) {
    const ended = at ? old : row, active = at ? row : old;
    if (time(active.updatedTime) > time(ended.updatedTime) || number(active.cumExecQty) > number(ended.cumExecQty) + EPS)
      fail('terminal_regression');
    return ended;
  }
  const newest = b >= a ? row : old, older = b >= a ? old : row;
  if (number(newest.cumExecQty) + EPS < number(older.cumExecQty)) fail('receipt_regression');
  if (a === b && (status(old.orderStatus) !== status(row.orderStatus) || !sameNumber(old.cumExecQty, row.cumExecQty)))
    fail('same_time_conflict');
  return newest;
}

export class BybitPortfolioEvidenceReader {
  constructor(private readonly client: BybitEvidenceClient, readonly uid: string, private readonly clock = Date.now) {
    if (!/^\d+$/.test(uid)) fail('invalid_uid');
  }
  private async read(method: Method | 'getQueryApiKey', q?: Query): Promise<Row> {
    let result: unknown;
    try { result = method === 'getQueryApiKey' ? await this.client.getQueryApiKey() : await this.client[method](q!); }
    catch { return fail('request_failed'); } // Never expose SDK request headers or response bodies.
    const response = object(result);
    if (response.retCode !== 0) fail('api_rejected');
    return object(response.result);
  }
  private async start(command: PortfolioOrderCommand): Promise<number> {
    validateCommand(command);
    if (command.uid !== this.uid || (command.side === 'Buy') !== ((command.positionIdx === 1) !== command.reduceOnly))
      fail('command_account_or_side');
    const now = this.clock(); epoch(now);
    if (command.at > now) fail('future_command');
    const key = await this.read('getQueryApiKey');
    if (String(key.userID) !== this.uid) fail('wrong_account');
    return now;
  }
  private end(start: number): number {
    const now = this.clock(); epoch(now);
    if (now < start || now - start > MAX_READ_MS) fail('read_expired');
    return now;
  }
  private async pages(method: Method, query: Omit<Query, 'limit' | 'category' | 'symbol'>): Promise<Row[]> {
    const rows: Row[] = [], cursors = new Set<string>(), ids = new Set<string>(); let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const r = await this.read(method, { ...base, ...query, ...(cursor ? { cursor } : {}) });
      if (r.category !== 'linear' || !Array.isArray(r.list)) fail('invalid_page');
      for (const value of r.list) {
        const row = object(value), key = id(row[method === 'getExecutionList' ? 'execId' : 'orderId']);
        // A changing pagination snapshot must be retried, not guessed complete.
        if (ids.has(key)) fail('duplicate_page_identity'); ids.add(key); rows.push(row);
      }
      if (r.nextPageCursor === '' || r.nextPageCursor === undefined) return rows;
      cursor = id(r.nextPageCursor);
      if (cursors.has(cursor)) fail('cursor_cycle'); cursors.add(cursor);
    }
    return fail('page_limit');
  }
  private async exact(selector: { orderId?: string; orderLinkId?: string }): Promise<Row | undefined> {
    const [live, history] = await Promise.all([
      this.pages('getActiveOrders', selector), this.pages('getHistoricOrders', selector),
    ]);
    let chosen: Row | undefined;
    for (const r of [...live, ...history]) {
      if (r.symbol !== 'HYPEUSDT' || selector.orderId && r.orderId !== selector.orderId
        || selector.orderLinkId && r.orderLinkId !== selector.orderLinkId) fail('exact_lookup_mismatch');
      if (chosen && chosen.orderId !== r.orderId) fail('ambiguous_link');
      chosen = merge(chosen, r);
    }
    return chosen;
  }
  private basic(r: Row, at: number): void {
    const q = number(r.qty), filled = number(r.cumExecQty), s = status(r.orderStatus);
    if (r.symbol !== 'HYPEUSDT' || ![1, 2].includes(Number(r.positionIdx)) || !['Buy', 'Sell'].includes(String(r.side))
      || typeof r.reduceOnly !== 'boolean' || q <= 0 || filled < 0 || filled > q + EPS
      || time(r.createdTime) < at || time(r.updatedTime) < time(r.createdTime) || time(r.updatedTime) > this.clock()
      || s === 'Filled' && Math.abs(filled - q) > EPS || s === 'Rejected' && filled !== 0) fail('invalid_order');
  }
  private async executions(r: Row, link: string, since: number): Promise<Execution[]> {
    // Exact order ID has priority over time filters at Bybit. Do NOT pretend a
    // default recent tail is complete: cumulative quantity + persisted receipts
    // must reconcile downstream on every read, including old orders.
    const rows = await this.pages('getExecutionList', { orderId: id(r.orderId) }), fills: Execution[] = [];
    for (const f of rows) {
      if (f.orderId !== r.orderId || f.symbol !== 'HYPEUSDT' || f.side !== r.side
        || f.positionIdx !== undefined && f.positionIdx !== r.positionIdx
        || !empty(f.orderLinkId) && f.orderLinkId !== r.orderLinkId
        || !empty(f.feeCurrency) && f.feeCurrency !== 'USDT') fail('execution_identity_mismatch');
      // Funding/settlement is separately attributed, never converted to a fill.
      if (f.execType !== 'Trade') fail('unsupported_execution_type');
      const qty = number(f.execQty), price = number(f.execPrice), at = time(f.execTime), fee = number(f.execFee);
      if (qty <= 0 || price <= 0 || at < since || at > this.clock()) fail('invalid_execution');
      fills.push({ id: id(f.execId), link, orderId: id(r.orderId), at, side: r.side as 'Buy' | 'Sell',
        positionIdx: r.positionIdx as 1 | 2, qty, price, fee });
    }
    return fills.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  }
  async observe(command: Readonly<PortfolioOrderCommand>): Promise<PortfolioOrderEvidence> {
    const c = structuredClone(command), started = await this.start(c);
    const r = await this.exact({ orderLinkId: c.link });
    if (!r) return { uid: this.uid, symbol: c.symbol, link: c.link, observedAt: this.end(started), found: false };
    this.basic(r, c.at);
    if (!empty(r.parentOrderLinkId) || r.side !== c.side || r.positionIdx !== c.positionIdx || r.orderType !== c.orderType
      || r.reduceOnly !== c.reduceOnly || !sameNumber(r.qty, c.qty)) fail('command_mismatch');
    if (c.bracket) {
      if (r.tpslMode !== 'Partial' || !sameNumber(r.takeProfit, c.bracket.target) || !sameNumber(r.stopLoss, c.bracket.stop)
        || r.tpTriggerBy !== 'LastPrice' || r.slTriggerBy !== 'LastPrice'
        || r.tpOrderType !== undefined && r.tpOrderType !== 'Market'
        || r.slOrderType !== undefined && r.slOrderType !== 'Market') fail('bracket_mismatch');
    } else if (!empty(r.takeProfit) || !empty(r.stopLoss)) fail('unexpected_attached_protection');
    if (c.protection?.kind === 'maker_tp') {
      if (r.timeInForce !== 'PostOnly' || !sameNumber(r.price, c.protection.price) || !empty(r.triggerPrice)) fail('maker_mismatch');
    } else if (c.protection) {
      if (!sameNumber(r.triggerPrice, c.protection.price) || r.triggerBy !== 'LastPrice'
        || r.triggerDirection !== c.protection.triggerDirection || r.closeOnTrigger !== true) fail('trigger_mismatch');
    } else if (!empty(r.triggerPrice) || !empty(r.stopOrderType)) fail('unexpected_trigger');
    const executions = await this.executions(r, c.link, c.at);
    return { uid: this.uid, symbol: c.symbol, link: c.link, observedAt: this.end(started), found: true,
      orderId: id(r.orderId), side: c.side, positionIdx: c.positionIdx, qty: number(r.qty), reduceOnly: c.reduceOnly,
      status: status(r.orderStatus), cumulativeQty: number(r.cumExecQty), executions,
      ...(c.bracket ? { bracket: { ...c.bracket } } : {}), ...(c.protection ? { protection: { ...c.protection } } : {}) };
  }
  async observeAttached(parent: Readonly<PortfolioOrderCommand>, knownIds: readonly string[]): Promise<BracketEvidence> {
    const c = structuredClone(parent), known = [...knownIds], started = await this.start(c);
    if (!c.bracket || known.length > 2 || new Set(known).size !== known.length || known.some(v => !v)) fail('invalid_bracket_request');
    const bracket = c.bracket;
    const byId = new Map<string, Row>();
    const accept = (r: Row) => {
      if (r.parentOrderLinkId !== c.link) fail('child_parent_changed');
      byId.set(id(r.orderId), merge(byId.get(id(r.orderId)), r));
    };
    // Parent linkage, never price/quantity similarity, discovers a new child.
    // Independent GETs only. Validate/merge the entire set before publishing any
    // evidence; venue writes and receipt application remain serial.
    const [active, exact] = await Promise.all([
      this.pages('getActiveOrders', { openOnly: 0 }),
      Promise.all(known.map(orderId => this.exact({ orderId }))),
    ]);
    for (const r of active) if (r.parentOrderLinkId === c.link) accept(r);
    // Before both identities have been durably saved, scan the parent's complete
    // lifetime in bounded <=7-day history windows (not the default recent tail).
    if (known.length < 2) {
      if (started - c.at > MAX_PAGES * WEEK) fail('undiscovered_bracket_too_old');
      for (let startTime = c.at; startTime <= started; startTime += WEEK) {
        const endTime = Math.min(started, startTime + WEEK - 1);
        for (const r of await this.pages('getHistoricOrders', { startTime, endTime })) if (r.parentOrderLinkId === c.link) accept(r);
      }
    }
    let complete = true;
    for (const [i, r] of exact.entries()) {
      if (r) accept(r); else if (!byId.has(known[i])) complete = false;
    }
    if (byId.size > 2) fail('unsupported_multiple_pairs');
    const children: BracketChild[] = await Promise.all([...byId.values()].map(async (r): Promise<BracketChild> => {
      this.basic(r, c.at);
      const kind = r.stopOrderType === 'PartialTakeProfit' ? 'tp' : r.stopOrderType === 'PartialStopLoss' ? 'sl' : null;
      if (!kind || r.side !== (c.side === 'Buy' ? 'Sell' : 'Buy') || r.positionIdx !== c.positionIdx
        || r.tpslMode !== 'Partial' || r.orderType !== 'Market' || r.reduceOnly !== true || r.closeOnTrigger !== true
        || r.triggerBy !== 'LastPrice' || r.triggerDirection !== ((kind === 'tp') === (c.positionIdx === 1) ? 1 : 2)
        || !sameNumber(r.triggerPrice, kind === 'tp' ? bracket.target : bracket.stop)
        || number(r.qty) > number(c.qty) + EPS) fail('child_terms_mismatch');
      const executions = await this.executions(r, c.link, c.at);
      if (Math.abs(executions.reduce((n, f) => n + f.qty, 0) - number(r.cumExecQty)) > EPS) complete = false;
      return { orderId: id(r.orderId), parentOrderLinkId: c.link, kind,
        side: r.side as 'Buy' | 'Sell', positionIdx: c.positionIdx, mode: 'Partial', orderType: 'Market', reduceOnly: true,
        triggerBy: 'LastPrice', triggerDirection: r.triggerDirection as 1 | 2, price: String(number(r.triggerPrice)),
        qty: number(r.qty), cumulativeQty: number(r.cumExecQty), status: status(r.orderStatus), executions };
    }));
    if (new Set(children.map(c => c.kind)).size !== children.length) fail('duplicate_child_kind');
    return { uid: this.uid, symbol: c.symbol, parentLink: c.link, observedAt: this.end(started), complete,
      children: children.sort((a, b) => a.kind.localeCompare(b.kind)) };
  }
}
