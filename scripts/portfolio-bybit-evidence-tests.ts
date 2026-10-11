import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import type { RestClientV5 } from 'bybit-api';
import { BybitPortfolioEvidenceReader, type BybitEvidenceClient } from '../src/bot/portfolio/bybit-evidence';
import type { PortfolioOrderCommand } from '../src/bot/portfolio/order-command';

// Compile-time compatibility only. No SDK instance, credentials or network.
const sdkCompatible = (client: RestClientV5): BybitEvidenceClient => client;
void sdkCompatible;
type Row = Record<string, unknown>;
type Query = Parameters<BybitEvidenceClient['getActiveOrders']>[0];
const T = Date.UTC(2026, 9, 11), UID = '555249668';
export function command(side: 1 | 2 = 1): PortfolioOrderCommand {
  return { version: 1, uid: UID, symbol: 'HYPEUSDT', link: 'test_parent', at: T,
    orderType: 'Market', side: side === 1 ? 'Buy' : 'Sell', positionIdx: side, qty: '0.11', reduceOnly: false,
    bracket: { mode: 'Partial', stop: side === 1 ? '81.15' : '89.69', target: side === 1 ? '89.69' : '81.15', triggerBy: 'LastPrice' } };
}
function parent(c = command()): Row {
  return { orderId: 'parent_id', orderLinkId: c.link, parentOrderLinkId: '', symbol: c.symbol, side: c.side,
    positionIdx: c.positionIdx, qty: c.qty, price: '89.7', orderType: c.orderType, orderStatus: 'Filled',
    tpslMode: 'Partial', reduceOnly: c.reduceOnly, closeOnTrigger: false, triggerBy: '', triggerDirection: 0,
    triggerPrice: '', stopOrderType: '', takeProfit: c.bracket!.target, stopLoss: c.bracket!.stop,
    tpTriggerBy: 'LastPrice', slTriggerBy: 'LastPrice', cumExecQty: '0.11', createdTime: String(T + 1), updatedTime: String(T + 2) };
}
function child(c: PortfolioOrderCommand, kind: 'tp' | 'sl'): Row {
  return { ...parent(c), orderId: `${kind}_id`, orderLinkId: '', parentOrderLinkId: c.link,
    side: c.side === 'Buy' ? 'Sell' : 'Buy', reduceOnly: true, closeOnTrigger: true, price: '0',
    triggerBy: 'LastPrice', triggerDirection: (kind === 'tp') === (c.positionIdx === 1) ? 1 : 2,
    triggerPrice: kind === 'tp' ? c.bracket!.target : c.bracket!.stop,
    takeProfit: '', stopLoss: '', tpTriggerBy: '', slTriggerBy: '',
    stopOrderType: kind === 'tp' ? 'PartialTakeProfit' : 'PartialStopLoss', orderStatus: 'Untriggered', cumExecQty: '0' };
}
function fill(r: Row, qty = '0.11', execId = 'fill1'): Row {
  return { execId, orderId: r.orderId, orderLinkId: r.orderLinkId, symbol: r.symbol, side: r.side,
    execType: 'Trade', execTime: String(T + 2), execQty: qty, execPrice: '85.42', execFee: '0.00516791' };
}
export class Fake implements BybitEvidenceClient {
  now = T + 3; uid = UID; c = command();
  live = [parent(this.c), child(this.c, 'tp'), child(this.c, 'sl')];
  history = structuredClone(this.live); fills = [fill(this.live[0])];
  calls: { method: string; query?: Query }[] = [];
  hook?: (method: string, q: Query, rows: Row[]) => unknown;
  answer(list: Row[], nextPageCursor = '') { return { retCode: 0, result: { category: 'linear', list, nextPageCursor } }; }
  async getQueryApiKey() { this.calls.push({ method: 'identity' }); return { retCode: 0, result: { userID: this.uid } }; }
  async getActiveOrders(q: Query): Promise<unknown> { return this.orders('live', q, this.live); }
  async getHistoricOrders(q: Query): Promise<unknown> { return this.orders('history', q, this.history); }
  private orders(method: string, q: Query, rows: Row[]): unknown {
    this.calls.push({ method, query: structuredClone(q) });
    const filtered = rows.filter(r => (!q.orderId || q.orderId === r.orderId) && (!q.orderLinkId || q.orderLinkId === r.orderLinkId)
      && (q.startTime === undefined || Number(r.createdTime) >= q.startTime) && (q.endTime === undefined || Number(r.createdTime) <= q.endTime)
      && (method !== 'live' || q.openOnly !== 0 || r.orderStatus === 'Untriggered'));
    return this.hook?.(method, q, filtered) ?? this.answer(filtered);
  }
  async getExecutionList(q: Query): Promise<unknown> {
    this.calls.push({ method: 'fills', query: structuredClone(q) });
    const rows = this.fills.filter(r => r.orderId === q.orderId);
    return this.hook?.('fills', q, rows) ?? this.answer(rows);
  }
  reader() { return new BybitPortfolioEvidenceReader(this, UID, () => this.now); }
}
const cases: string[] = [];
async function test(name: string, run: (f: Fake) => unknown | Promise<unknown>) {
  try { await run(new Fake()); cases.push(name); } catch (e) { throw new Error(name, { cause: e }); }
}
async function main() {
  await test('SDK-compatible reader verifies parent and exact receipts, without writes', async f => {
    const e = await f.reader().observe(f.c); assert(e.found); assert.equal(e.executions[0].fee, .00516791);
    assert.deepEqual(e.bracket, f.c.bracket); assert.equal(e.executions[0].positionIdx, 1);
    assert(f.calls.every(c => ['identity', 'live', 'history', 'fills'].includes(c.method)));
  });
  await test('short child directions and Buy-close attribution are isolated', async f => {
    f.c = command(2); f.live = [parent(f.c), child(f.c, 'tp'), child(f.c, 'sl')]; f.history = structuredClone(f.live);
    f.live[1].orderStatus = 'Filled'; f.live[1].cumExecQty = '0.11'; f.history = structuredClone(f.live);
    f.fills = [fill(f.live[0]), fill(f.live[1], '0.11', 'exit')];
    const e = await f.reader().observeAttached(f.c, []);
    assert(e.complete); assert.equal(e.children.find(c => c.kind === 'tp')!.executions[0].side, 'Buy');
    assert(e.children.every(c => c.positionIdx === 2 && c.parentOrderLinkId === f.c.link));
  });
  await test('history lag uses exact-ID realtime Deactivated without inventing a fill', async f => {
    f.live.slice(1).forEach(r => { r.orderStatus = 'Deactivated'; }); f.history = [];
    const e = await f.reader().observeAttached(f.c, ['tp_id', 'sl_id']);
    assert(e.complete); assert(e.children.every(c => c.status === 'Cancelled' && c.cumulativeQty === 0));
    assert.equal(e.children.flatMap(c => c.executions).length, 0);
    assert(f.calls.some(c => c.method === 'live' && c.query?.orderId === 'tp_id'));
  });
  await test('a missing known child is incomplete, never terminal', async f => {
    f.live = f.live.filter(r => r.orderId !== 'sl_id'); f.history = f.history.filter(r => r.orderId !== 'sl_id');
    const e = await f.reader().observeAttached(f.c, ['tp_id', 'sl_id']); assert(!e.complete); assert.equal(e.children.length, 1);
  });
  await test('not-found parent remains uncertain', async f => {
    f.live = []; f.history = []; assert.equal((await f.reader().observe(f.c)).found, false);
  });
  await test('wrong UID fails before order queries', async f => {
    f.uid = '123'; await assert.rejects(f.reader().observe(f.c), /wrong_account/); assert.equal(f.calls.length, 1);
  });
  await test('wrong command side or UID fails before any network', async f => {
    await assert.rejects(f.reader().observe({ ...f.c, side: 'Sell' }), /command_account_or_side/);
    await assert.rejects(f.reader().observe({ ...f.c, uid: '123' }), /command_account_or_side/); assert.equal(f.calls.length, 0);
  });
  await test('raw SDK/API errors never enter diagnostics', async f => {
    f.hook = () => { throw Error('secret-key-and-sdk-request'); };
    await assert.rejects(f.reader().observe(f.c), e => String(e) === 'Error: portfolio evidence: request_failed');
    f.hook = () => ({ retCode: 10001, retMsg: 'secret-request' });
    await assert.rejects(f.reader().observe(f.c), /api_rejected/);
  });
  await test('parent-link reuse is ambiguous, not newest-wins', async f => {
    f.live.push({ ...f.live[0], orderId: 'another' }); await assert.rejects(f.reader().observe(f.c), /ambiguous_link/);
  });
  await test('changed child lineage in exact history is rejected', async f => {
    f.history[1].parentOrderLinkId = 'other_owner'; await assert.rejects(f.reader().observeAttached(f.c, ['tp_id', 'sl_id']), /identity_conflict/);
  });
  await test('a missing parent link is not recovered by price similarity', async f => {
    f.live[1].parentOrderLinkId = ''; f.history[1].parentOrderLinkId = '';
    await assert.rejects(f.reader().observeAttached(f.c, ['tp_id', 'sl_id']), /child_parent_changed/);
  });
  await test('Full-mode children and wrong directions are rejected', async f => {
    f.live[1].tpslMode = 'Full'; f.history = structuredClone(f.live);
    await assert.rejects(f.reader().observeAttached(f.c, []), /child_terms_mismatch/);
    f.live[1].tpslMode = 'Partial'; f.live[1].triggerDirection = 2; f.history = structuredClone(f.live);
    await assert.rejects(f.reader().observeAttached(f.c, []), /child_terms_mismatch/);
  });
  await test('extra pair or duplicate kind is not allocated by matching quantity', async f => {
    f.live.push({ ...f.live[1], orderId: 'extra' }); f.history = structuredClone(f.live);
    await assert.rejects(f.reader().observeAttached(f.c, []), /unsupported_multiple_pairs/);
    f.live = [f.live[1], f.live[3]]; f.history = structuredClone(f.live);
    await assert.rejects(f.reader().observeAttached(f.c, []), /duplicate_child_kind/);
  });
  await test('equal timestamp terminal beats stale active evidence', async f => {
    f.history[1].orderStatus = 'Deactivated'; const e = await f.reader().observeAttached(f.c, []);
    assert.equal(e.children.find(c => c.kind === 'tp')!.status, 'Cancelled');
  });
  await test('conflicting terminals and resurrection fail closed', async f => {
    f.history[1].orderStatus = 'Rejected'; f.live[1].orderStatus = 'Cancelled';
    await assert.rejects(f.reader().observeAttached(f.c, ['tp_id', 'sl_id']), /terminal_conflict/);
    f.live[1].orderStatus = 'Untriggered'; f.live[1].updatedTime = String(T + 3);
    await assert.rejects(f.reader().observeAttached(f.c, ['tp_id', 'sl_id']), /terminal_regression/);
  });
  await test('cancelled partial parent preserves fills rather than assuming zero', async f => {
    for (const r of [f.live[0], f.history[0]]) { r.orderStatus = 'PartiallyFilledCanceled'; r.cumExecQty = '0.05'; }
    f.fills = [fill(f.live[0], '0.05')]; const e = await f.reader().observe(f.c);
    assert(e.found); assert.equal(e.status, 'Cancelled'); assert.equal(e.cumulativeQty, .05); assert.equal(e.executions[0].qty, .05);
  });
  await test('incomplete parent receipts remain visible for coordinator to defer', async f => {
    f.fills = []; const e = await f.reader().observe(f.c); assert(e.found); assert.equal(e.cumulativeQty, .11); assert.deepEqual(e.executions, []);
  });
  await test('child receipts must reconcile before complete evidence', async f => {
    f.live[1].orderStatus = 'Filled'; f.live[1].cumExecQty = '0.11'; f.history = structuredClone(f.live);
    const e = await f.reader().observeAttached(f.c, []); assert(!e.complete);
  });
  await test('executions paginate and ties use stable IDs; signed rebates survive', async f => {
    const a = fill(f.live[0], '0.05', 'a'), b = { ...fill(f.live[0], '0.06', 'b'), execFee: '-0.001' };
    f.hook = (m, q) => m !== 'fills' ? undefined : q.cursor ? f.answer([a]) : f.answer([b], 'next');
    const e = await f.reader().observe(f.c); assert(e.found); assert.deepEqual(e.executions.map(x => x.id), ['a', 'b']);
    assert.equal(e.executions[1].fee, -.001);
  });
  await test('wrong receipt side/index/order/currency and future execution fail closed', async f => {
    for (const change of [{ side: 'Sell' }, { positionIdx: 2 }, { orderId: 'wrong' }, { feeCurrency: 'BTC' }, { execTime: String(T + 4) }]) {
      f.hook = m => m === 'fills' ? f.answer([{ ...fill(f.live[0]), ...change }]) : undefined;
      await assert.rejects(f.reader().observe(f.c), /execution_identity_mismatch|invalid_execution/);
    }
  });
  await test('duplicate pages, cursor cycles and truncation never claim completeness', async f => {
    f.hook = m => m === 'fills' ? f.answer(f.fills, 'again') : undefined;
    await assert.rejects(f.reader().observe(f.c), /duplicate_page_identity/);
    f.hook = m => m === 'fills' ? f.answer([], 'again') : undefined;
    await assert.rejects(f.reader().observe(f.c), /cursor_cycle/);
    let page = 0; f.hook = m => m === 'fills' ? f.answer([], `page${++page}`) : undefined;
    await assert.rejects(f.reader().observe(f.c), /page_limit/);
  });
  await test('discovery scans old parent lifetime, not only last seven days', async f => {
    f.now = T + 10 * 86400000; await f.reader().observeAttached(f.c, []);
    const windows = f.calls.filter(c => c.method === 'history').map(c => c.query!);
    assert.equal(windows.length, 2); assert.equal(windows[0].startTime, T);
    assert.equal(windows[1].startTime, windows[0].endTime! + 1); assert.equal(windows[1].endTime, f.now);
  });
  await test('bounded read cannot relabel slow stale evidence as fresh', async f => {
    f.hook = m => { if (m === 'fills') f.now += 5001; return undefined; };
    await assert.rejects(f.reader().observe(f.c), /read_expired/);
  });
  await test('parent protection mismatch and unexpected attached target are rejected', async f => {
    f.live[0].takeProfit = '90'; f.history = structuredClone(f.live);
    await assert.rejects(f.reader().observe(f.c), /bracket_mismatch/);
    const c = { ...f.c }; delete c.bracket;
    await assert.rejects(f.reader().observe(c), /unexpected_attached_protection/);
  });
  await test('maker and standalone conditional evidence must match exact command', async f => {
    const c: PortfolioOrderCommand = { ...f.c, side: 'Sell', reduceOnly: true, orderType: 'Limit',
      bracket: undefined, protection: { kind: 'maker_tp', price: '90', timeInForce: 'PostOnly' } };
    f.live = [{ ...parent(), side: 'Sell', reduceOnly: true, orderType: 'Limit', price: '90', timeInForce: 'PostOnly',
      takeProfit: '', stopLoss: '', orderStatus: 'New', cumExecQty: '0' }]; f.fills = []; f.history = structuredClone(f.live);
    const m = await f.reader().observe(c); assert(m.found); assert.deepEqual(m.protection, c.protection);
    c.orderType = 'Market'; c.protection = { kind: 'trigger_tp', price: '90', triggerBy: 'LastPrice', triggerDirection: 1 };
    Object.assign(f.live[0], { orderType: 'Market', closeOnTrigger: true, triggerPrice: '90', triggerBy: 'LastPrice', triggerDirection: 1 });
    f.history = structuredClone(f.live); assert((await f.reader().observe(c)).found);
    f.live[0].triggerDirection = 2; f.history = structuredClone(f.live);
    await assert.rejects(f.reader().observe(c), /trigger_mismatch/);
  });
  const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
  const files = ['scripts/portfolio-bybit-evidence-tests.ts', 'src/bot/portfolio/bybit-evidence.ts',
    'src/bot/portfolio/execution-coordinator.ts', 'src/bot/portfolio/attached-bracket.ts', 'src/bot/portfolio/bracket-state.ts'];
  const code = Object.fromEntries(files.map(f => [f, hash(fs.readFileSync(f))]));
  const out = `backtests/portfolio-bybit-evidence-verification/${hash(JSON.stringify(code)).slice(0, 16)}`;
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ code, cases, checks: cases.length,
    realExchangeCalls: 0, writesAvailable: false, liveTransportEnabled: false, scope: 'read-only venue evidence adapter fixtures' }, null, 2) + '\n');
  console.log(`portfolio Bybit evidence tests passed (${cases.length} cases)\n${out}/verification.json`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
