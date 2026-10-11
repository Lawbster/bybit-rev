import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { BybitPortfolioAccount } from '../src/bot/portfolio/bybit-account';

type Row = Record<string, any>;
const T = Date.UTC(2026, 9, 11), SYMBOL = 'HYPEUSDT';
function fixture(change: (method: string, query: Row, response: Row, advance: (ms: number) => void) => void = () => {}) {
  let now = T;
  const methods = ['getQueryApiKey', 'getAccountInfo', 'getWalletBalance', 'getPositionInfo', 'getActiveOrders', 'getInstrumentsInfo', 'getTickers'];
  const client = Object.fromEntries(methods.map(method => [method, async (query: Row = {}) => {
    const response: Row = { retCode: 0, time: now, result: { list: [], nextPageCursor: '' } };
    if (method === 'getQueryApiKey') response.result = { userID: '555249668' };
    if (method === 'getAccountInfo') {
      delete response.time;
      response.result = { marginMode: 'REGULAR_MARGIN', updatedTime: String(T - 100 * 86400000) };
    }
    if (method === 'getPositionInfo' && query.symbol === SYMBOL) response.result.list = [1, 2].map(positionIdx => ({
      symbol: SYMBOL, positionIdx, size: '0', side: '', leverage: '25', seq: 100, updatedTime: String(T - 1000),
      takeProfit: '', stopLoss: '', trailingStop: '',
    }));
    if (method === 'getWalletBalance') response.result.list = [{ accountType: 'UNIFIED', totalEquity: '19047.16', totalAvailableBalance: '19047.16',
      coin: [{ coin: 'USDT', walletBalance: '19047.16', equity: '19047.16', usdValue: '19047.16', borrowAmount: '0', spotBorrow: '0' }] }];
    if (method === 'getTickers') response.result.list = [{ symbol: SYMBOL, bid1Price: '90', ask1Price: '90.01', fundingRate: '.0001' }];
    if (method === 'getInstrumentsInfo') response.result.list = [{ symbol: SYMBOL, status: 'Trading', settleCoin: 'USDT',
      lotSizeFilter: { qtyStep: '.01', minOrderQty: '.01', maxMktOrderQty: '10000', minNotionalValue: '5' }, priceFilter: { tickSize: '.01' } }];
    change(method, query, response, ms => { now += ms; });
    return response;
  }]));
  // Hand-built read-only fixtures; no API client or credentials instantiated.
  return new BybitPortfolioAccount(client as any, () => now);
}
async function main() {
  const snapshot = await fixture().snapshot();
  assert.equal(snapshot.uid, '555249668'); assert.equal(snapshot.equity, 19047.16);
  assert.equal(snapshot.longQty, 0); assert.equal(snapshot.shortQty, 0); assert.deepEqual(snapshot.openLinks, []);
  assert.equal(snapshot.observedAt, T); // Old account settings timestamp is not freshness evidence.
  await fixture((method, _q, r) => { if (method === 'getAccountInfo') r.time = T; }).snapshot();
  for (const bad of [null, '', 'NaN', 1.5]) await assert.rejects(fixture((method, _q, r) => {
    if (method === 'getAccountInfo') r.time = bad;
  }).snapshot(), /getAccountInfo:invalid_server_time/);
  for (const offset of [-5001, 5001]) await assert.rejects(fixture((method, _q, r) => {
    if (method === 'getAccountInfo') r.time = T + offset;
  }).snapshot(), /getAccountInfo:server_clock_out_of_bounds/);
  for (const endpoint of ['getQueryApiKey', 'getWalletBalance', 'getPositionInfo', 'getActiveOrders', 'getInstrumentsInfo', 'getTickers']) {
    await assert.rejects(fixture((method, _q, r) => { if (method === endpoint) delete r.time; }).snapshot(), /invalid_server_time/);
  }
  await assert.rejects(fixture((method, _q, r) => { if (method === 'getAccountInfo') { r.retCode = 10003; r.retMsg = 'SECRET_BODY'; } }).snapshot(),
    { message: 'portfolio account: getAccountInfo:retCode_10003' });
  await assert.rejects(fixture((method, _q, _r) => { if (method === 'getAccountInfo') throw Error('SECRET_HEADERS'); }).snapshot(),
    { message: 'portfolio account: getAccountInfo:request_failed' });
  await assert.rejects(fixture((method, _q, _r, advance) => { if (method === 'getAccountInfo') advance(5001); }).snapshot(), /request_expired/);
  await assert.rejects(fixture((method, q, r, advance) => {
    if (method === 'getQueryApiKey' || method === 'getPositionInfo' && q.symbol === SYMBOL || method === 'getInstrumentsInfo') {
      advance(1500); r.time += 1500;
    }
  }).snapshot(), /snapshot_expired/);
  await assert.rejects(fixture((method, _q, r) => { if (method === 'getAccountInfo') r.result.marginMode = 'PORTFOLIO_MARGIN'; }).snapshot(), /cross_margin_required/);
  // Build first. Invalid arguments fail before config, credentials or API calls.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-startup-check-'));
  const child = spawnSync(process.execPath, [path.resolve('dist/bot/portfolio-live.js'), '--invalid-diagnostic-test'], {
    cwd: dir, encoding: 'utf8', timeout: 15000, windowsHide: true,
  });
  assert.equal(child.status, 1);
  const diagnostic = JSON.parse(child.stderr.trim());
  assert.equal(diagnostic.origin, 'portfolio_preflight_or_startup');
  assert.equal(diagnostic.message, 'unknown portfolio option');
  assert(fs.readdirSync(path.join(dir, 'logs')).some(f => f.startsWith('fatal-hype-portfolio-live-')));
  console.log('Portfolio account response checks passed; missing account-info time accepted, invalid/stale clocks and API errors rejected; no exchange calls.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
