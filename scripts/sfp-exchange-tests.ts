import assert from 'assert/strict';
import { SfpBybitExchange } from '../src/bot/sfp-exchange';
import { loadSfpConfig } from '../src/bot/sfp-config';
import { accountDiagnostic } from '../src/bot/named-bybit-account';
import type { SfpIntent } from '../src/bot/sfp-state';

const ok = (result: any) => ({ retCode: 0, result, time: Date.now() });
function fixture() {
  const state = { orders: [] as any[], executions: [] as any[], qty: '0', available: '5000', equity: '5000',
    ask: '100', bid: '99.99', stale: false, code: 0, submitted: null as any, protected: null as any };
  const client = {
    getQueryApiKey: async () => ok({ userID: 222, readOnly: 0, isMaster: false, apiKey: 'must-not-leak', secret: 'must-not-leak' }),
    getPositionInfo: async () => ok({ list: [
      { positionIdx: 1, side: 'Buy', size: state.qty, leverage: '3', takeProfit: '104', stopLoss: '93.1', liqPrice: '50' },
      { positionIdx: 2, side: '', size: '0', leverage: '3' },
    ] }),
    getActiveOrders: async () => ok({ list: state.orders }),
    getHistoricOrders: async () => ok({ list: state.orders }),
    getExecutionList: async () => ok({ list: state.executions }),
    getWalletBalance: async () => ok({ list: [{ totalEquity: state.equity, totalAvailableBalance: state.available }] }),
    getInstrumentsInfo: async () => ok({ list: [{ status: 'Trading', lotSizeFilter: {
      qtyStep: '0.01', minOrderQty: '0.01', maxMktOrderQty: '10000', minNotionalValue: '5',
    }, priceFilter: { tickSize: '0.01' } }] }),
    getTickers: async () => ({ ...ok({ list: [{ ask1Price: state.ask, bid1Price: state.bid }] }), time: Date.now() - (state.stale ? 20000 : 0) }),
    submitOrder: async (args: any) => { state.submitted = args; return { retCode: state.code, result: { orderId: 'order1' } }; },
    setTradingStop: async (args: any) => { state.protected = args; return { retCode: state.code }; },
    cancelOrder: async () => ({ retCode: state.code }),
  };
  const exchange = new SfpBybitExchange(loadSfpConfig(), client as any);
  const at = Date.now() - 1000;
  const intent: SfpIntent = { kind: 'open', link: 'sf08_open_test', at, qty: 100, stop: 93.1, target: 104, reason: 'signal',
    signal: { id: 'SF01:long:test', at, expiresAt: at + 86400000, entryDeadline: at + 60000,
      reference: 100, originalStop: 98, stop: 93.1, target: 104 } };
  return { state, client, exchange, intent };
}
async function main() {
  let cases = 0;
  const test = async (f: () => Promise<void>) => { await f(); cases++; };
  await test(async () => {
    const f = fixture(); assert.deepEqual(await f.exchange.identity(), { uid: '222', readOnly: false, isMaster: false });
    assert(!JSON.stringify(await f.exchange.identity()).includes('must-not-leak'));
  });
  await test(async () => {
    const f = fixture(); const terms = await f.exchange.entryTerms(10000, 93.109, 104.001);
    assert.deepEqual(terms, { qty: 100, stop: 93.1, target: 104.01 });
    f.state.ask = '100.03'; assert.equal((await f.exchange.entryTerms(10000, 93.1, 104)).qty, 99.97);
  });
  await test(async () => {
    const f = fixture(); await assert.rejects(f.exchange.entryTerms(20000, 93.1, 104), /margin/);
    f.state.available = '3000'; await assert.rejects(f.exchange.entryTerms(10000, 93.1, 104), /margin/);
    f.state.available = '5000'; f.state.equity = '1000'; await assert.rejects(f.exchange.entryTerms(10000, 93.1, 104), /collateral/);
  });
  await test(async () => {
    const f = fixture(); f.state.stale = true; await assert.rejects(f.exchange.entryTerms(10000, 93.1, 104), /stale/);
    f.state.stale = false; f.state.ask = '105'; await assert.rejects(f.exchange.entryTerms(10000, 93.1, 104), /bracket/);
    f.state.ask = '100'; f.state.bid = '93'; await assert.rejects(f.exchange.entryTerms(10000, 93.1, 104), /bracket/);
  });
  await test(async () => {
    const f = fixture(); f.state.orders = [{ orderId: 'foreign' }]; await assert.rejects(f.exchange.entryTerms(10000, 93.1, 104), /existing/);
    f.state.orders = []; f.state.qty = '1'; await assert.rejects(f.exchange.entryTerms(10000, 93.1, 104), /inventory/);
  });
  await test(async () => {
    const f = fixture(); await f.exchange.submit(f.intent);
    assert.equal(f.state.submitted.side, 'Buy'); assert.equal(f.state.submitted.positionIdx, 1);
    assert.equal(f.state.submitted.reduceOnly, false); assert.equal(f.state.submitted.tpslMode, 'Full');
    assert.equal(f.state.submitted.takeProfit, '104'); assert.equal(f.state.submitted.stopLoss, '93.1');
    assert.equal(f.state.submitted.slTriggerBy, 'LastPrice');
    await f.exchange.submit({ ...f.intent, kind: 'close' });
    assert.equal(f.state.submitted.reduceOnly, true); assert.equal(f.state.submitted.side, 'Sell');
    assert.equal(f.state.submitted.takeProfit, undefined);
    f.state.code = 110007; assert.deepEqual(await f.exchange.submit(f.intent), { rejected: true });
    f.state.code = 10006; await assert.rejects(f.exchange.submit(f.intent), /unresolved/);
  });
  await test(async () => {
    const f = fixture(); f.state.orders = [{ orderLinkId: f.intent.link, orderId: 'order1', side: 'Buy', positionIdx: 1,
      orderStatus: 'Filled', cumExecQty: '100' }];
    const execution = { execType: 'Trade', side: 'Buy', orderLinkId: f.intent.link, orderId: 'order1', execId: 'fill1',
      execTime: String(f.intent.at), execQty: '100', execPrice: '100', execFee: '5.5' };
    f.state.executions = [execution, execution]; assert.equal((await f.exchange.observe(f.intent)).fills.length, 1);
    f.state.executions = [{ ...execution, side: 'Sell' }]; await assert.rejects(f.exchange.observe(f.intent), /identity/);
    f.state.executions = [execution]; f.state.orders[0].side = 'Sell'; await assert.rejects(f.exchange.observe(f.intent), /side/);
  });
  await test(async () => {
    const f = fixture(); f.state.executions = [{ execType: 'Trade', side: 'Sell', orderId: 'tp1', execId: 'fill1',
      execTime: String(f.intent.at), execQty: '100', closedSize: '100', execPrice: '104', execFee: '5.72' }];
    assert.equal((await f.exchange.closeFills(f.intent.at))[0].fee, 5.72);
    f.state.executions[0].closedSize = '0'; await assert.rejects(f.exchange.closeFills(f.intent.at), /non-reducing/);
  });
  await test(async () => {
    const f = fixture(); f.state.code = 34040; await f.exchange.protect(93.1, 104);
    assert.equal(f.state.protected.positionIdx, 1); assert.equal(f.state.protected.stopLoss, '93.1');
    f.state.code = 10006; await assert.rejects(f.exchange.protect(93.1, 104));
    await assert.rejects(f.exchange.closeFills(Date.now() - 8 * 86400000), /seven-day/);
  });
  await test(async () => {
    process.env.SF08_TEST_API_SECRET = 'fake-sensitive-value';
    try { assert(!accountDiagnostic(new Error('fake-sensitive-value at https://secret.invalid')).includes('fake-sensitive-value')); }
    finally { delete process.env.SF08_TEST_API_SECRET; }
  });
  console.log(`SF08 exchange adapter tests passed (${cases} cases; mocked APIs only)`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
