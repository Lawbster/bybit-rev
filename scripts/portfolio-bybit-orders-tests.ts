import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import type { RestClientV5, OrderParamsV5 } from 'bybit-api';
import { BybitPortfolioOrders, portfolioOrderPayload, type PortfolioWriteRequest } from '../src/bot/portfolio/bybit-orders';
import { Fake, command } from './portfolio-bybit-evidence-tests';
import type { PortfolioOrderCommand } from '../src/bot/portfolio/order-command';

// SDK responses are intentionally hand-built fixtures, never real API calls.
class WriterFake extends Fake {
  writes: { method: string; payload: unknown }[] = [];
  writeError = false; invalidAck = false;
  submitOrder: RestClientV5['submitOrder'] = async p => {
    this.writes.push({ method: 'submit', payload: structuredClone(p) });
    if (this.writeError) throw Error('SDK secret');
    return { retCode: 0, retMsg: 'OK', retExtInfo: {}, time: this.now,
      result: { orderId: this.invalidAck ? '' : 'new_order', orderLinkId: p.orderLinkId! } };
  };
  cancelOrder: RestClientV5['cancelOrder'] = async p => {
    this.writes.push({ method: 'cancel', payload: structuredClone(p) });
    if (this.writeError) throw Error('SDK secret');
    return { retCode: 0, retMsg: 'OK', retExtInfo: {}, time: this.now,
      result: { orderId: p.orderId!, orderLinkId: '' } };
  };
}
const UID = '555249668';
const cases: string[] = [];
async function test(name: string, run: (f: WriterFake) => unknown | Promise<unknown>) {
  try { await run(new WriterFake()); cases.push(name); } catch (e) { throw new Error(name, { cause: e }); }
}
async function main() {
  await test('attached long and short reuse Partial builder, never Full', async f => {
    const permits: PortfolioWriteRequest[] = [];
    const w = new BybitPortfolioOrders(f, UID, r => { permits.push(r); return true; }, () => f.now);
    for (const side of [1, 2] as const) {
      const c = command(side); await w.submit(c);
      const p = f.writes.at(-1)!.payload as OrderParamsV5;
      assert.equal(p.tpslMode, 'Partial'); assert.equal(p.positionIdx, side); assert.equal(p.reduceOnly, false);
      assert.equal(p.tpOrderType, 'Market'); assert.equal(p.slOrderType, 'Market');
      assert.equal(p.takeProfit, c.bracket!.target); assert.equal(p.stopLoss, c.bracket!.stop);
    }
    assert.equal(permits.length, 2);
  });
  await test('plain entry/close has no whole-position TP or implicit sibling', f => {
    const c = command(); delete c.bracket;
    const entry = portfolioOrderPayload(c); assert.equal(entry.side, 'Buy'); assert.equal(entry.qty, c.qty);
    const close = portfolioOrderPayload({ ...c, reduceOnly: true, side: 'Sell' });
    assert.deepEqual(Object.keys(close).sort(), ['category', 'symbol', 'orderLinkId', 'orderType', 'side', 'positionIdx', 'qty', 'reduceOnly'].sort());
    assert.equal(close.reduceOnly, true); assert.equal(f.writes.length, 0);
  });
  await test('maker payload is post-only; conditional is quantity-owned reduce-only', () => {
    const c: PortfolioOrderCommand = { ...command(), bracket: undefined, reduceOnly: true, side: 'Sell', orderType: 'Limit',
      protection: { kind: 'maker_tp', price: '90', timeInForce: 'PostOnly' } };
    const m = portfolioOrderPayload(c); assert.equal(m.timeInForce, 'PostOnly'); assert.equal(m.price, '90'); assert.equal(m.triggerPrice, undefined);
    c.orderType = 'Market'; c.protection = { kind: 'trigger_tp', price: '90', triggerBy: 'LastPrice', triggerDirection: 1 };
    const p = portfolioOrderPayload(c); assert.equal(p.triggerPrice, '90'); assert.equal(p.closeOnTrigger, true);
    assert.equal(p.reduceOnly, true); assert.equal(p.takeProfit, undefined); assert.equal(p.tpslMode, undefined);
  });
  await test('denied/missing/async permit cannot issue writes', async f => {
    for (const permit of [undefined, () => false, () => undefined, () => Promise.resolve(true)]) {
      await assert.rejects(async () => new BybitPortfolioOrders(f, UID, permit as () => true, () => f.now).submit(f.c), /authorization/);
    }
    assert.equal(f.writes.length, 0);
  });
  await test('changed side/account or unsupported field cannot issue writes', async f => {
    const w = new BybitPortfolioOrders(f, UID, () => true, () => f.now);
    await assert.rejects(w.submit({ ...f.c, side: 'Sell' }), /account_or_side/);
    await assert.rejects(w.submit({ ...f.c, uid: '123' }), /account_or_side/);
    await assert.rejects(w.submit({ ...f.c, leverage: 3 } as PortfolioOrderCommand), /unexpected/);
    assert.equal(f.writes.length, 0);
  });
  await test('lost submit response is one attempt with sanitized uncertainty', async f => {
    f.writeError = true; const w = new BybitPortfolioOrders(f, UID, () => true, () => f.now);
    await assert.rejects(w.submit(f.c), e => String(e) === 'Error: portfolio orders: submission_unknown');
    assert.equal(f.writes.length, 1);
  });
  await test('invalid ack is not a fill or automatic retry', async f => {
    f.invalidAck = true; const w = new BybitPortfolioOrders(f, UID, () => true, () => f.now);
    await assert.rejects(w.submit(f.c), /acknowledgment_identity/); assert.equal(f.writes.length, 1);
  });
  await test('terminal parent requires no cancel, absent parent remains unresolved', async f => {
    const w = new BybitPortfolioOrders(f, UID, () => true, () => f.now); await w.cancel(f.c);
    f.live = []; f.history = []; await assert.rejects(w.cancel(f.c), /cancellation_target_unknown/); assert.equal(f.writes.length, 0);
  });
  await test('cancel identifies exact parent and acknowledgement does not settle it', async f => {
    f.live[0].orderStatus = 'New'; f.live[0].cumExecQty = '0'; f.history = structuredClone(f.live); f.fills = [];
    const permits: PortfolioWriteRequest[] = [], w = new BybitPortfolioOrders(f, UID, r => { permits.push(r); return true; }, () => f.now);
    await w.cancel(f.c); assert.equal(f.writes.length, 1);
    assert.deepEqual(f.writes[0].payload, { category: 'linear', symbol: 'HYPEUSDT', orderId: 'parent_id' });
    assert.equal(permits[0].kind, 'cancel'); const e = await w.evidence.observe(f.c); assert(e.found); assert.equal(e.status, 'New');
  });
  await test('child cancel resolves parent ownership and checks permit after observation', async f => {
    let readFinished = false;
    f.hook = m => { if (m === 'fills') readFinished = true; return undefined; };
    const w = new BybitPortfolioOrders(f, UID, r => { assert(readFinished); assert.equal(r.kind, 'cancel_child'); return true; }, () => f.now);
    await w.cancelAttached(f.c, 'tp_id'); assert.deepEqual(f.writes[0].payload, { category: 'linear', symbol: 'HYPEUSDT', orderId: 'tp_id' });
  });
  await test('foreign or missing child cannot be cancelled', async f => {
    const w = new BybitPortfolioOrders(f, UID, () => true, () => f.now);
    await assert.rejects(w.cancelAttached(f.c, 'foreign'), /target_unknown/);
    f.live[1].parentOrderLinkId = 'other'; f.history = structuredClone(f.live);
    await assert.rejects(w.cancelAttached(f.c, 'tp_id'), /child_parent_changed/); assert.equal(f.writes.length, 0);
  });
  await test('already Deactivated child is done without another write', async f => {
    f.live[1].orderStatus = 'Deactivated'; f.history = [];
    const w = new BybitPortfolioOrders(f, UID, () => true, () => f.now);
    await w.cancelAttached(f.c, 'tp_id'); assert.equal(f.writes.length, 0);
  });
  await test('cancel transport failure remains unknown without retry', async f => {
    f.writeError = true; const w = new BybitPortfolioOrders(f, UID, () => true, () => f.now);
    await assert.rejects(w.cancelAttached(f.c, 'tp_id'), e => String(e) === 'Error: portfolio orders: child_cancellation_unknown');
    assert.equal(f.writes.length, 1);
  });
  await test('account change detected before cancellation', async f => {
    f.uid = '123'; const w = new BybitPortfolioOrders(f, UID, () => true, () => f.now);
    await assert.rejects(w.cancelAttached(f.c, 'tp_id'), /wrong_account/); assert.equal(f.writes.length, 0);
  });
  const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
  const files = ['scripts/portfolio-bybit-orders-tests.ts', 'scripts/portfolio-bybit-evidence-tests.ts',
    'src/bot/portfolio/bybit-orders.ts', 'src/bot/portfolio/bybit-evidence.ts', 'src/bot/portfolio/attached-bracket.ts'];
  const code = Object.fromEntries(files.map(f => [f, hash(fs.readFileSync(f))]));
  const out = `backtests/portfolio-bybit-orders-verification/${hash(JSON.stringify(code)).slice(0, 16)}`;
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ code, cases, checks: cases.length,
    realExchangeCalls: 0, liveTransportEnabled: false, scope: 'staged write boundary; simulated SDK only; no daemon/cutover' }, null, 2) + '\n');
  console.log(`portfolio Bybit orders tests passed (${cases.length} cases)\n${out}/verification.json`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
