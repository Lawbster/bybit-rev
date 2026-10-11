'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { inspect, UID, SYMBOL } = require('./portfolio-vps-preflight.cjs');
const T = Date.UTC(2026, 9, 11), cases = [];
function fixture(change = () => {}) {
  const calls = []; let now = T;
  const pos = [1, 2].map(positionIdx => ({ symbol: SYMBOL, positionIdx, side: '', size: '0', leverage: '25', takeProfit: '', stopLoss: '', riskId: 1 }));
  const client = new Proxy({}, { get: (_, method) => async args => {
    assert(['getQueryApiKey', 'getPositionInfo', 'getActiveOrders', 'getAccountInfo', 'getWalletBalance', 'getFeeRate', 'getInstrumentsInfo', 'getRiskLimit'].includes(method), 'write/unknown method');
    calls.push({ method, args });
    const r = { retCode: 0, time: now, result: { list: [], nextPageCursor: '' } };
    if (method === 'getQueryApiKey') r.result = { userID: UID, apiKey: 'DO_NOT_PRINT', secret: 'DO_NOT_PRINT' };
    if (method === 'getAccountInfo') r.result = { marginMode: 'REGULAR_MARGIN', unifiedMarginStatus: 5 };
    if (method === 'getPositionInfo' && args.symbol === SYMBOL) r.result.list = structuredClone(pos);
    if (method === 'getFeeRate') r.result.list = [{ symbol: SYMBOL, makerFeeRate: '.0002', takerFeeRate: '.00055' }];
    if (method === 'getInstrumentsInfo') r.result.list = [{ symbol: SYMBOL, status: 'Trading', settleCoin: 'USDT',
      lotSizeFilter: { qtyStep: '.01' }, priceFilter: { tickSize: '.01' }, leverageFilter: { maxLeverage: '25' } }];
    if (method === 'getRiskLimit') r.result.list = [{ id: 1, symbol: SYMBOL, riskLimitValue: '200000', maxLeverage: '25', maintenanceMargin: '.01', initialMargin: '.04', mmDeduction: '0' }];
    if (method === 'getWalletBalance') r.result.list = [{ accountType: 'UNIFIED', totalEquity: '19047.43317261', totalAvailableBalance: '19047.43317261',
      totalMarginBalance: '19047.43317261', totalInitialMargin: '0', totalMaintenanceMargin: '0',
      coin: [{ coin: 'USDT', usdValue: '19047.43317261', locked: '0', borrowAmount: '0', spotBorrow: '0', collateralSwitch: true }] }];
    await change({ method, args, r, calls, advance: ms => { now += ms; } }); return r;
  } });
  return { calls, run: (opts = {}) => inspect(client, { clock: () => now, localPauses: { main: true, sfp: true }, ...opts }) };
}
async function test(name, fn) { await fn(); cases.push(name); }
function observedHedgePage({ method, args, r }) {
  if (method !== 'getPositionInfo' || args.symbol !== SYMBOL) return;
  if (!args.cursor) {
    r.result.list.forEach((p, i) => Object.assign(p, {
      updatedTime: '1791507633127', seq: [179276727885, 168485735463][i], trailingStop: '0'
    }));
    r.result.nextPageCursor = 'HYPEUSDT%2C1791507633127%2C2';
  } else r.result.list = [{ symbol: SYMBOL, positionIdx: 0, side: '', size: '0', leverage: '10',
    takeProfit: '', stopLoss: '', trailingStop: '0', riskId: 1, updatedTime: '', seq: -1 }];
}
async function main() {
  await test('approved flat account is preparation-only; no credentials escape', async () => {
    const f = fixture(), r = await f.run(); assert(r.preparationChecksPassed); assert.equal(r.readyToArm, false);
    assert.equal(r.wallet.totalEquity, 19047.43317261); assert.equal(Object.keys(r.footprint).length, 9);
    assert(!JSON.stringify(r).includes('DO_NOT_PRINT')); assert(!f.calls.some(c => /submit|set|cancel|switch/i.test(c.method)));
  });
  await test('wrong UID stops before other private queries', async () => {
    const f = fixture(({ r, method }) => { if (method === 'getQueryApiKey') r.result.userID = '3674537'; });
    await assert.rejects(f.run(), /wrong_account/); assert.equal(f.calls.length, 1);
  });
  await test('conditional order on second page is not hidden by zero positions', async () => {
    const f = fixture(({ r, method, args }) => {
      if (method !== 'getActiveOrders' || args.settleCoin !== 'USDT') return;
      assert.equal(args.orderFilter, undefined); assert.equal(args.openOnly, 0);
      if (!args.cursor) r.result.nextPageCursor = 'p2';
      else r.result.list = [{ orderId: 'stale-child', symbol: SYMBOL, orderStatus: 'Untriggered', qty: '1', reduceOnly: true }];
    });
    const r = await f.run(); assert(!r.preparationChecksPassed); assert(r.blockers.includes('orders_linear_USDT:occupied'));
    assert.equal(r.footprint.orders_linear_USDT.count, 1);
  });
  await test('all risk tiers paginated, rate units left untouched', async () => {
    const f = fixture(({ r, method, args }) => { if (method === 'getRiskLimit') {
      if (!args.cursor) r.result.nextPageCursor = 'next'; else { r.result.list[0].id = 2; r.result.list[0].maintenanceMargin = '2.5'; }
    } });
    const r = await f.run(); assert.equal(r.tiers.length, 2); assert.equal(r.tiers[1].maintenanceMargin, '2.5');
  });
  await test('cursor cycles fail closed without an infinite request loop', async () => {
    const f = fixture(({ r, method, args }) => { if (method === 'getActiveOrders' && args.category === 'spot') r.result.nextPageCursor = 'same'; });
    const r = await f.run(); assert(!r.preparationChecksPassed); assert(r.errors.includes('orders_spot:cursor_cycle'));
  });
  await test('duplicate identities invalidate a paginated snapshot', async () => {
    const f = fixture(({ r, method }) => { if (method === 'getActiveOrders') r.result.list = [{ orderId: 'x' }, { orderId: 'x' }]; });
    const r = await f.run(); assert(!r.preparationChecksPassed); assert(r.errors.every(e => e.endsWith('missing_or_duplicate_identity')));
  });
  await test('unavailable category stays unknown, never assumed empty', async () => {
    const f = fixture(({ r, method, args }) => { if (method === 'getActiveOrders' && args.category === 'inverse') r.retCode = 10028; });
    const r = await f.run(); assert(!r.preparationChecksPassed); assert.equal(r.footprint.orders_inverse, undefined);
    assert(r.errors.includes('orders_inverse:retCode_10028'));
  });
  await test('API error text and authenticated request details never appear', async () => {
    const f = fixture(({ method }) => { if (method === 'getFeeRate') throw Error('DO_NOT_PRINT_KEY=abc'); });
    const r = await f.run(); assert(r.errors.includes('fees:request_failed')); assert(!JSON.stringify(r).includes('DO_NOT_PRINT'));
  });
  await test('changing HYPE inventory invalidates before/after check', async () => {
    let n = 0; const f = fixture(({ r, method, args }) => {
      if (method === 'getPositionInfo' && args.symbol === SYMBOL && ++n === 2) r.result.list[0].size = '1';
    });
    const r = await f.run(); assert(r.blockers.includes('hype_changed_during_check')); assert(r.blockers.includes('hype_not_flat'));
  });
  await test('other-market inventory and borrowing block preparation', async () => {
    const f = fixture(({ r, method, args }) => {
      if (method === 'getPositionInfo' && args.category === 'inverse') r.result.list = [{ symbol: 'BTCUSD', positionIdx: 0, side: 'Buy', size: '20' }];
      if (method === 'getWalletBalance') r.result.list[0].coin[0].borrowAmount = '1';
    });
    const r = await f.run(); assert(r.blockers.includes('positions_inverse:occupied')); assert(r.blockers.includes('account_has_borrowing'));
  });
  await test('missing or non-numeric margin is not zero', async () => {
    for (const bad of ['', undefined, 'NaN']) {
      const f = fixture(({ r, method }) => { if (method === 'getWalletBalance') r.result.list[0].totalMaintenanceMargin = bad; });
      await assert.rejects(f.run(), /totalMaintenanceMargin:invalid_number/);
    }
  });
  await test('wrong leverage/mode/native TP do not get normalized away', async () => {
    const f = fixture(({ r, method, args }) => {
      if (method === 'getAccountInfo') r.result.marginMode = 'ISOLATED_MARGIN';
      if (method === 'getPositionInfo' && args.symbol === SYMBOL) { r.result.list[0].leverage = '3'; r.result.list[0].takeProfit = '101'; }
    });
    const r = await f.run(); assert(r.blockers.includes('regular_cross_margin_required'));
    assert(r.blockers.includes('hype_leverage_not_25')); assert(r.blockers.includes('hype_native_protection_present'));
  });
  await test('higher fee requires review and pause markers are checked', async () => {
    const f = fixture(({ r, method }) => { if (method === 'getFeeRate') r.result.list[0].takerFeeRate = '.0006'; });
    const r = await f.run({ localPauses: { main: true, sfp: false } });
    assert(r.blockers.includes('taker_fee_above_research_assumption')); assert(r.blockers.includes('local_entry_pause_missing'));
  });
  await test('stale public data cannot certify preparation', async () => {
    const f = fixture(({ r, method }) => { if (method === 'getRiskLimit') r.time = T - 20_000; });
    const r = await f.run(); assert(!r.preparationChecksPassed); assert(r.errors.includes('tiers:server_clock_stale'));
  });
  await test('long collection interval is not a fresh snapshot', async () => {
    const f = fixture(({ method, advance }) => { if (method === 'getRiskLimit') advance(31_000); });
    const r = await f.run(); assert(r.blockers.includes('snapshot_window_over_30s')); assert(!r.preparationChecksPassed);
  });
  await test('pagination hard limit fails rather than reporting partial totals', async () => {
    const f = fixture(({ r, method, args, calls }) => { if (method === 'getActiveOrders' && args.category === 'spot') r.result.nextPageCursor = String(calls.length); });
    const r = await f.run(); assert(r.errors.includes('orders_spot:page_limit')); assert(!r.preparationChecksPassed);
  });
  await test('witnessed terminal placeholder preserves raw evidence but does not override real hedge leverage', async () => {
    const r = await fixture(observedHedgePage).run();
    assert(r.preparationChecksPassed); assert.equal(r.readyToArm, false); assert(r.ignoredTerminalPlaceholder);
    assert.equal(r.positions.length, 3); assert.equal(r.positions[2].leverage, '10'); assert.equal(r.positions[2].seq, -1);
    assert.equal(r.hypePositionPages.before.length, 2); assert.deepEqual(r.hypePositionPages.before, r.hypePositionPages.after);
    assert.deepEqual(r.warnings, ['hype_terminal_empty_placeholder_excluded_from_mode_checks']);
  });
  await test('empty one-way account or missing hedge side is never normalized into hedge mode', async () => {
    for (const oneWayOnly of [false, true]) {
      const r = await fixture(ctx => {
        observedHedgePage(ctx);
        if (ctx.method !== 'getPositionInfo' || ctx.args.symbol !== SYMBOL) return;
        if (!ctx.args.cursor) ctx.r.result.list = oneWayOnly ? [] : ctx.r.result.list.slice(0, 1);
      }).run();
      assert(!r.preparationChecksPassed); assert(!r.ignoredTerminalPlaceholder); assert(r.blockers.includes('hedge_mode_required'));
    }
  });
  await test('same-page extra one-way row is ambiguous even with never-traded metadata', async () => {
    const r = await fixture(ctx => {
      observedHedgePage(ctx);
      if (ctx.method !== 'getPositionInfo' || ctx.args.symbol !== SYMBOL) return;
      ctx.r.result.nextPageCursor = '';
      ctx.r.result.list.push({ symbol: SYMBOL, positionIdx: 0, size: '0', side: '', leverage: '10',
        seq: -1, updatedTime: '', takeProfit: '', stopLoss: '', trailingStop: '0' });
    }).run();
    assert(!r.ignoredTerminalPlaceholder); assert(r.blockers.includes('hedge_mode_required'));
  });
  await test('used or incomplete one-way metadata never qualifies as placeholder', async () => {
    for (const patch of [{ seq: 0 }, { seq: 1 }, { seq: undefined }, { seq: null },
      { updatedTime: '1791507633127' }, { updatedTime: undefined }, { updatedTime: null }]) {
      const r = await fixture(ctx => {
        observedHedgePage(ctx);
        if (ctx.method === 'getPositionInfo' && ctx.args.symbol === SYMBOL && ctx.args.cursor) Object.assign(ctx.r.result.list[0], patch);
      }).run();
      assert(!r.preparationChecksPassed); assert(!r.ignoredTerminalPlaceholder);
    }
  });
  await test('placeholder requires explicit absent TP SL and trailing protection', async () => {
    for (const field of ['takeProfit', 'stopLoss', 'trailingStop']) {
      for (const value of ['101', undefined, null]) {
        const r = await fixture(ctx => {
          observedHedgePage(ctx);
          if (ctx.method === 'getPositionInfo' && ctx.args.symbol === SYMBOL && ctx.args.cursor) ctx.r.result.list[0][field] = value;
        }).run();
        assert(!r.ignoredTerminalPlaceholder); assert(!r.preparationChecksPassed);
        if (value === '101') assert(r.blockers.includes('hype_native_protection_present'));
      }
    }
  });
  await test('one-way inventory or nonempty side cannot masquerade as placeholder', async () => {
    for (const patch of [{ size: '1' }, { side: 'Buy' }, { side: 'Sell' }]) {
      const r = await fixture(ctx => {
        observedHedgePage(ctx);
        if (ctx.method === 'getPositionInfo' && ctx.args.symbol === SYMBOL && ctx.args.cursor) Object.assign(ctx.r.result.list[0], patch);
      }).run();
      assert(!r.ignoredTerminalPlaceholder); assert(!r.preparationChecksPassed);
      if (patch.size) assert(r.blockers.includes('hype_not_flat'));
    }
  });
  await test('real hedge leverage inventory protection and identity remain checked', async () => {
    for (const patch of [{ leverage: '3' }, { size: '1' }, { takeProfit: '101' }, { symbol: 'BTCUSDT' },
      { seq: -1 }, { updatedTime: '' }]) {
      const r = await fixture(ctx => {
        observedHedgePage(ctx);
        if (ctx.method === 'getPositionInfo' && ctx.args.symbol === SYMBOL && !ctx.args.cursor) Object.assign(ctx.r.result.list[0], patch);
      }).run();
      assert(!r.preparationChecksPassed);
      if (patch.leverage) assert(r.blockers.includes('hype_leverage_not_25'));
      if (patch.size) assert(r.blockers.includes('hype_not_flat'));
      if (patch.takeProfit) assert(r.blockers.includes('hype_native_protection_present'));
    }
  });
  await test('missing terminal cursor evidence keeps extra row blocking', async () => {
    for (const cursor of [undefined, null]) {
      const r = await fixture(ctx => {
        observedHedgePage(ctx);
        if (ctx.method === 'getPositionInfo' && ctx.args.symbol === SYMBOL && ctx.args.cursor) ctx.r.result.nextPageCursor = cursor;
      }).run();
      assert(!r.ignoredTerminalPlaceholder); assert(!r.preparationChecksPassed);
    }
  });
  await test('before-after sequence changes prevent placeholder normalization', async () => {
    let firstPages = 0;
    const r = await fixture(ctx => {
      observedHedgePage(ctx);
      if (ctx.method === 'getPositionInfo' && ctx.args.symbol === SYMBOL && !ctx.args.cursor && ++firstPages === 2)
        ctx.r.result.list[0].seq++;
    }).run();
    assert(r.blockers.includes('hype_changed_during_check')); assert(!r.ignoredTerminalPlaceholder);
  });
  await test('placeholder exception does not hide open orders or failed category queries', async () => {
    const r = await fixture(ctx => {
      observedHedgePage(ctx);
      if (ctx.method === 'getActiveOrders' && ctx.args.settleCoin === 'USDT')
        ctx.r.result.list = [{ orderId: 'foreign', symbol: SYMBOL, orderStatus: 'New' }];
      if (ctx.method === 'getPositionInfo' && ctx.args.category === 'option') ctx.r.retCode = 10028;
    }).run();
    assert(r.ignoredTerminalPlaceholder); assert(!r.preparationChecksPassed);
    assert(r.blockers.includes('orders_linear_USDT:occupied')); assert(r.errors.includes('positions_option:retCode_10028'));
  });
  const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const code = Object.fromEntries(['scripts/portfolio-vps-preflight.cjs', 'scripts/portfolio-vps-preflight-tests.cjs'].map(f => [f, hash(f)]));
  const key = crypto.createHash('sha256').update(JSON.stringify(code)).digest('hex').slice(0, 16);
  const out = `backtests/portfolio-account-verification/${key}`; fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ code, cases, checks: cases.length, realExchangeCalls: 0, orderWrites: 0 }, null, 2) + '\n');
  console.log(`Read-only portfolio preflight: ${cases.length} tests passed; no exchange calls\n${out}/verification.json`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
