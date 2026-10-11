/** Real adapter logic around the existing simulated book/receipt coordinator.
 * No SDK instance or live account. Tests the wire-format -> ownership boundary.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fixture } from './portfolio-bracket-tests';
import { seed, T, UID } from './portfolio-execution-tests';
import { Fake } from './portfolio-bybit-evidence-tests';
import { BybitPortfolioOrders, portfolioOrderPayload, type BybitOrderClient } from '../src/bot/portfolio/bybit-orders';
import { MINUTE as M } from '../src/bot/portfolio/contract';

function integrated() {
  const f = fixture(), raw = new Fake(), permits: string[] = [];
  let historyLag = false, hideChild = '';
  const submit = f.ex.submit.bind(f.ex), cancelChild = f.ex.attached.cancel.bind(f.ex.attached);
  const now = f.args.options.clock;
  function refresh() {
    raw.now = now();
    raw.live = [...f.ex.orders.values()].map(o => {
      const c = f.ex.commands.find(c => c.link === o.link)!;
      return { symbol: 'HYPEUSDT', orderId: o.orderId, orderLinkId: c.link, parentOrderLinkId: '',
        side: o.side, positionIdx: o.positionIdx, qty: String(o.qty), orderType: c.orderType,
        orderStatus: o.status, reduceOnly: o.reduceOnly, closeOnTrigger: !!c.protection && c.protection.kind !== 'maker_tp',
        price: c.protection?.kind === 'maker_tp' ? c.protection.price : '0',
        triggerPrice: c.protection && c.protection.kind !== 'maker_tp' ? c.protection.price : '',
        triggerBy: c.protection?.triggerBy ?? '', triggerDirection: c.protection?.triggerDirection ?? 0,
        timeInForce: c.protection?.timeInForce ?? 'IOC', stopOrderType: '',
        tpslMode: c.bracket ? 'Partial' : '', takeProfit: c.bracket?.target ?? '', stopLoss: c.bracket?.stop ?? '',
        tpTriggerBy: c.bracket?.triggerBy ?? '', slTriggerBy: c.bracket?.triggerBy ?? '',
        cumExecQty: String(o.cumulativeQty), createdTime: String(c.at), updatedTime: String(now()) };
    });
    for (const c of f.ex.children) raw.live.push({ symbol: 'HYPEUSDT', orderId: c.orderId, orderLinkId: '',
      parentOrderLinkId: c.parentOrderLinkId, side: c.side, positionIdx: c.positionIdx, qty: String(c.qty), orderType: 'Market',
      orderStatus: c.status === 'Cancelled' ? 'Deactivated' : c.status, reduceOnly: true, closeOnTrigger: true,
      price: '0', triggerPrice: c.price, triggerBy: c.triggerBy, triggerDirection: c.triggerDirection,
      stopOrderType: c.kind === 'tp' ? 'PartialTakeProfit' : 'PartialStopLoss', tpslMode: 'Partial',
      cumExecQty: String(c.cumulativeQty), createdTime: String(f.c.store.snapshot.orders[c.parentOrderLinkId].at), updatedTime: String(now()) });
    raw.live = raw.live.filter(r => r.orderId !== hideChild);
    raw.history = historyLag ? [] : structuredClone(raw.live);
    raw.fills = [...f.ex.orders.values()].flatMap(o => o.executions).concat(f.ex.children.flatMap(c => c.executions)).map(e => ({
      execId: e.id, orderId: e.orderId, orderLinkId: raw.live.find(r => r.orderId === e.orderId)?.orderLinkId ?? '',
      symbol: 'HYPEUSDT', side: e.side, execType: 'Trade', execTime: String(e.at), execQty: String(e.qty),
      execPrice: String(e.price), execFee: String(e.fee) }));
  }
  const api: BybitOrderClient = {
    getQueryApiKey: () => raw.getQueryApiKey(),
    getActiveOrders: q => { refresh(); return raw.getActiveOrders(q); },
    getHistoricOrders: q => { refresh(); return raw.getHistoricOrders(q); },
    getExecutionList: q => { refresh(); return raw.getExecutionList(q); },
    submitOrder: async p => {
      const c = f.c.store.snapshot.orders[p.orderLinkId!].command!;
      assert.deepEqual(p, portfolioOrderPayload(c)); const ack = await submit(c);
      return { retCode: 0, retMsg: 'OK', retExtInfo: {}, time: now(), result: { orderId: ack.orderId, orderLinkId: c.link } };
    },
    cancelOrder: async p => {
      const child = f.ex.children.find(c => c.orderId === p.orderId);
      if (child) await cancelChild(f.c.store.snapshot.orders[child.parentOrderLinkId].command!, p.orderId!);
      else {
        const o = [...f.ex.orders.values()].find(o => o.orderId === p.orderId)!; assert(o);
        f.ex.terminal(o.link, 'Cancelled');
      }
      return { retCode: 0, retMsg: 'OK', retExtInfo: {}, time: now(), result: { orderId: p.orderId!, orderLinkId: '' } };
    },
  };
  const gateway = new BybitPortfolioOrders(api, UID, r => {
    const saved = f.c.store.snapshot.orders[r.command.link]; assert(saved); assert.deepEqual(saved.command, r.command);
    if (r.kind === 'submit') assert(!saved.terminal && !saved.orderId);
    if (r.kind === 'cancel') assert(saved.cancelRequestedAt !== undefined);
    if (r.kind === 'cancel_child') assert(f.c.store.snapshot.brackets![r.command.link].cancelRequestedAt !== undefined);
    permits.push(r.kind); return true;
  }, now);
  // Still simulation transport and simulated balances/fills. Production reader
  // and payload gateway are exercised without making the coordinator deployable.
  f.ex.submit = c => gateway.submit(c);
  f.ex.observe = c => gateway.evidence.observe(c);
  f.ex.cancel = c => gateway.cancel(c);
  f.ex.attached.observe = (c, known) => gateway.evidence.observeAttached(c, known);
  f.ex.attached.cancel = (c, id) => gateway.cancelAttached(c, id);
  return { ...f, get c() { return f.c; }, permits, setHistoryLag(v: boolean) { historyLag = v; }, hide(id: string) { hideChild = id; } };
}
const cases: string[] = [];
async function test(name: string, run: (f: ReturnType<typeof integrated>) => Promise<void>) {
  const f = integrated(); try { await run(f); cases.push(name); }
  catch (e) { throw new Error(name, { cause: e }); } finally { f.cleanup(); }
}
async function main() {
  await test('wire child TP closes only SF08, retains CRSI and PA07', async f => {
    const sf = await f.entry('SF08'); f.time(T + M); await f.entry('CRSI'); f.time(T + 2 * M); await f.entry('PA07');
    const before = f.c.store.snapshot; f.ex.childFill(sf, 'tp'); f.ex.child(sf, 'sl').status = 'Cancelled';
    assert.equal((await f.c.maintain()).issue, null);
    const after = f.c.store.snapshot; assert(!after.lots.SF08);
    assert.deepEqual(after.lots.CRSI, before.lots.CRSI); assert.deepEqual(after.lots.PA07, before.lots.PA07);
    assert.equal(after.brackets![sf].completedAt, T + 2 * M); assert(after.realizedBeforeFunding > 600);
  });
  await test('wire child SL closes PA07 without consuming independent R3', async f => {
    const pa = await f.entry('PA07'); f.time(T + M); await f.entry('R3');
    const r3 = f.c.store.snapshot.lots.R3;
    f.ex.childFill(pa, 'sl'); f.ex.child(pa, 'tp').status = 'Cancelled'; await f.c.maintain();
    assert(!f.c.store.snapshot.lots.PA07); assert.deepEqual(f.c.store.snapshot.lots.R3, r3);
  });
  await test('timeout with history lag cancels exact children then closes receipt-owned residual', async f => {
    const sf = await f.entry('SF08'); f.time(T + M); await f.entry('CRSI');
    const crsi = f.c.store.snapshot.lots.CRSI; f.pause(); f.setHistoryLag(true); f.ex.autoCancel = true;
    await f.c.requestExit('setup0', 'timeout');
    for (let i = 0; i < 4; i++) await f.c.maintain();
    const close = f.ex.commands.find(c => c.reduceOnly); assert(close);
    assert.equal(Number(close.qty), f.ex.orders.get(sf)!.cumulativeQty); assert.equal(close.side, 'Sell');
    f.ex.fill(close.link); await f.c.maintain();
    assert(!f.c.store.snapshot.lots.SF08); assert.deepEqual(f.c.store.snapshot.lots.CRSI, crsi);
    assert.equal(f.permits.filter(k => k === 'cancel_child').length, 2);
    assert.equal(f.ex.commands.filter(c => c.reduceOnly).length, 1);
  });
  await test('missing child blocks market close, restores cleanly without lost identity', async f => {
    const sf = await f.entry('SF08'); f.pause(); await f.c.requestExit('setup0', 'timeout');
    f.hide(f.ex.child(sf, 'sl').orderId); const before = f.c.store.snapshot.lots;
    await assert.rejects(f.c.maintain(), /child_cancellation_target_unknown/);
    assert.deepEqual(f.c.store.snapshot.lots, before); assert.equal(f.ex.commands.length, 1);
    f.hide(''); f.ex.autoCancel = true; for (let i = 0; i < 4; i++) await f.c.maintain();
    assert.equal(f.ex.commands.filter(c => c.reduceOnly).length, 1);
  });
  await test('restart applies receipts once and never resubmits original entry', async f => {
    seed(f.c.store, 'SF08', T); const opened = await f.c.open('SF08'); assert.equal(opened.state, 'submitted');
    f.ex.fill(opened.link!); f.ex.createPair(opened.link!); f.restart();
    await f.c.maintain(); const after = f.c.store.snapshot;
    assert(after.lots.SF08); await f.c.maintain(); assert.deepEqual(f.c.store.snapshot.lots, after.lots);
    assert.equal(f.ex.commands.length, 1); assert.equal(f.permits.filter(k => k === 'submit').length, 1);
  });
  const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
  const files = ['scripts/portfolio-bybit-integration-tests.ts', 'scripts/portfolio-bybit-evidence-tests.ts',
    'scripts/portfolio-bracket-tests.ts', 'scripts/portfolio-execution-tests.ts',
    ...fs.readdirSync('src/bot/portfolio').filter(n => n.endsWith('.ts')).map(n => `src/bot/portfolio/${n}`)];
  const code = Object.fromEntries(files.map(f => [f, hash(fs.readFileSync(f))]));
  const out = `backtests/portfolio-bybit-integration-verification/${hash(JSON.stringify(code)).slice(0, 16)}`;
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ code, cases, checks: cases.length,
    realExchangeCalls: 0, liveTransportEnabled: false, scope: 'real reader/payload adapter -> existing simulated shared ledger' }, null, 2) + '\n');
  console.log(`portfolio Bybit integration tests passed (${cases.length} cases)\n${out}/verification.json`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
