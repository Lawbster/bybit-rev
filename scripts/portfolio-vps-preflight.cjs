#!/usr/bin/env node
'use strict';

// Standalone READ-ONLY evidence collector. Runs from the OLD VPS repo with this
// file in /tmp; no build, owner lock, trading calls, state writes or PM2 commands.
// Not a runtime admission gate and NEVER an arming certificate.
// API contracts checked 2026-10-11:
// https://bybit-exchange.github.io/docs/v5/order/open-order
// https://bybit-exchange.github.io/docs/v5/position
// https://bybit-exchange.github.io/docs/v5/market/risk-limit
// https://bybit-exchange.github.io/docs/v5/account/wallet-balance
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const UID = '555249668', SYMBOL = 'HYPEUSDT', LEVERAGE = 25;
const scopes = [
  { category: 'linear', settleCoin: 'USDT' }, { category: 'linear', settleCoin: 'USDC' },
  { category: 'inverse' }, { category: 'option' },
];
const number = (v, label, signed = false) => {
  if ((typeof v !== 'number' && typeof v !== 'string') || v === '' || !Number.isFinite(Number(v))
    || (!signed && Number(v) < 0)) throw Error(`${label}:invalid_number`);
  return Number(v);
};
const scopeName = q => [q.category, q.settleCoin].filter(Boolean).join('_');
const digest = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const emptyProtection = v => v === '' || ((typeof v === 'string' || typeof v === 'number')
  && String(v).trim() !== '' && Number(v) === 0);
const positiveInteger = v => (typeof v === 'string' || typeof v === 'number')
  && Number.isSafeInteger(Number(v)) && Number(v) > 0;

// Operator-witnessed 2026-10-11: a symbol query yields the real hedge pair,
// then a terminal synthetic idx=0 row (seq=-1, no update time). Do NOT generally
// discard flat idx=0 rows. Only this exact two-page shape, with both established
// hedge rows, is a preparation-only exception. Keep all rows in the evidence.
function terminalPlaceholder(rows, pageEvidence) {
  if (!rows || rows.length !== 3 || pageEvidence.length !== 2) return false;
  const [first, last] = pageEvidence;
  if (first.cursorSupplied || first.terminal || !last.cursorSupplied || !last.terminal
    || first.ids.length !== 2 || ![1, 2].every(idx => first.ids.includes(`${SYMBOL}:${idx}`))
    || last.ids.length !== 1 || last.ids[0] !== `${SYMBOL}:0`) return false;
  const hedges = rows.filter(p => p.symbol === SYMBOL && [1, 2].includes(p.positionIdx));
  if (hedges.length !== 2 || !hedges.every(p => positiveInteger(p.seq) && positiveInteger(p.updatedTime))) return false;
  const p = rows.find(p => p.symbol === SYMBOL && p.positionIdx === 0);
  return !!p && p.size === 0 && p.side === '' && (p.seq === -1 || p.seq === '-1')
    && p.updatedTime === '' && [p.takeProfit, p.stopLoss, p.trailingStop].every(emptyProtection);
}

async function inspect(client, { clock = Date.now, localPauses = null } = {}) {
  const startedAt = clock(), requests = [], errors = [], blockers = [], warnings = [];
  const hypePositionPages = { before: [], after: [] };
  async function read(method, args, label) {
    const sentAt = clock(); let r;
    try { r = await client[method](args); }
    catch { throw Error(`${label}:request_failed`); } // Never serialize SDK error/config/headers.
    const receivedAt = clock();
    if (!r || r.retCode !== 0 || !r.result || typeof r.result !== 'object') {
      const code = Number.isSafeInteger(r?.retCode) ? r.retCode : 'invalid';
      throw Error(`${label}:retCode_${code}`);
    }
    if (r.time !== undefined && (!Number.isSafeInteger(Number(r.time)) || Math.abs(receivedAt - Number(r.time)) > 10_000))
      throw Error(`${label}:server_clock_stale`);
    if (receivedAt < sentAt || receivedAt - sentAt > 10_000) throw Error(`${label}:slow_or_invalid_clock`);
    requests.push({ label, sentAt, receivedAt }); return r.result;
  }
  async function pages(method, args, label, key, pageEvidence) {
    const rows = [], ids = new Set(), cursors = new Set(); let cursor;
    for (let page = 0; page < 20; page++) {
      const r = await read(method, { ...args, ...(cursor ? { cursor } : {}) }, label);
      if (!Array.isArray(r.list)) throw Error(`${label}:missing_list`);
      for (const row of r.list) {
        const id = key(row);
        if (!id || ids.has(id)) throw Error(`${label}:missing_or_duplicate_identity`);
        ids.add(id); rows.push(row);
      }
      pageEvidence?.push({ page: page + 1, cursorSupplied: !!cursor,
        terminal: r.nextPageCursor === '', ids: r.list.map(key) });
      if (r.nextPageCursor === '' || r.nextPageCursor === undefined || r.nextPageCursor === null) return rows;
      if (typeof r.nextPageCursor !== 'string' || cursors.has(r.nextPageCursor)) throw Error(`${label}:cursor_cycle`);
      cursor = r.nextPageCursor; cursors.add(cursor);
    }
    throw Error(`${label}:page_limit`);
  }
  const posKey = p => p?.symbol && [0, 1, 2].includes(Number(p.positionIdx)) ? `${p.symbol}:${p.positionIdx}` : '';
  const summarizePosition = p => ({ symbol: p.symbol, positionIdx: Number(p.positionIdx), side: p.side,
    size: number(p.size, 'position_size'), leverage: p.leverage,
    takeProfit: p.takeProfit, stopLoss: p.stopLoss, trailingStop: p.trailingStop ?? null,
    riskId: p.riskId, seq: p.seq ?? null, updatedTime: p.updatedTime ?? null });
  const identity = await read('getQueryApiKey', undefined, 'identity');
  if (String(identity.userID) !== UID) throw Error('identity:wrong_account');
  // No other private query before verifying the exact operator-approved UID.
  const hypeBefore = (await pages('getPositionInfo', { category: 'linear', symbol: SYMBOL, limit: 200 }, 'hype_before', posKey, hypePositionPages.before)).map(summarizePosition);
  const reports = {};
  const jobs = [
    ['account', () => read('getAccountInfo', undefined, 'account')],
    ['wallet', () => read('getWalletBalance', { accountType: 'UNIFIED' }, 'wallet')],
    ['fees', () => pages('getFeeRate', { category: 'linear', symbol: SYMBOL }, 'fees', r => r.symbol)],
    ['instrument', () => pages('getInstrumentsInfo', { category: 'linear', symbol: SYMBOL }, 'instrument', r => r.symbol)],
    ['tiers', () => pages('getRiskLimit', { category: 'linear', symbol: SYMBOL }, 'tiers', r => Number.isSafeInteger(r.id) ? String(r.id) : '')],
    ...scopes.map(q => [`positions_${scopeName(q)}`, () => pages('getPositionInfo', { ...q, limit: 200 }, `positions_${scopeName(q)}`, posKey)]),
    ...[...scopes, { category: 'spot' }].map(q => [`orders_${scopeName(q)}`, () => pages('getActiveOrders',
      // No orderFilter: API defaults to all active/conditional order kinds.
      { ...q, openOnly: 0, limit: 50 }, `orders_${scopeName(q)}`, r => r.orderId)]),
  ];
  // Bounded read concurrency; no dependency on the account writer or owner lock.
  for (let i = 0; i < jobs.length; i += 3) await Promise.all(jobs.slice(i, i + 3).map(async ([key, fn]) => {
    try { reports[key] = await fn(); } catch (e) { errors.push(e.message); }
  }));
  let hypeAfter = null;
  try { hypeAfter = (await pages('getPositionInfo', { category: 'linear', symbol: SYMBOL, limit: 200 }, 'hype_after', posKey, hypePositionPages.after)).map(summarizePosition); }
  catch (e) { errors.push(e.message); }
  const cleanHype = rows => rows?.map(p => ({ ...p })).sort((a, b) => a.positionIdx - b.positionIdx);
  const stableHype = !!hypeAfter && JSON.stringify(cleanHype(hypeBefore)) === JSON.stringify(cleanHype(hypeAfter));
  if (!stableHype) blockers.push('hype_changed_during_check');
  const positions = hypeAfter ?? hypeBefore;
  const ignoredTerminalPlaceholder = stableHype && terminalPlaceholder(hypeBefore, hypePositionPages.before)
    && terminalPlaceholder(hypeAfter, hypePositionPages.after);
  const modePositions = ignoredTerminalPlaceholder ? positions.filter(p => p.positionIdx !== 0) : positions;
  if (ignoredTerminalPlaceholder) warnings.push('hype_terminal_empty_placeholder_excluded_from_mode_checks');
  if (modePositions.length !== 2 || ![1, 2].every(idx => modePositions.some(p => p.symbol === SYMBOL && p.positionIdx === idx))) blockers.push('hedge_mode_required');
  if (modePositions.some(p => number(p.leverage, 'hype_leverage') !== LEVERAGE)) blockers.push('hype_leverage_not_25');
  if (positions.some(p => p.size !== 0)) blockers.push('hype_not_flat');
  if (positions.some(p => number(p.takeProfit || 0, 'hype_tp') > 0 || number(p.stopLoss || 0, 'hype_sl') > 0
    || number(p.trailingStop || 0, 'hype_trailing_stop') > 0)) blockers.push('hype_native_protection_present');
  if (reports.account?.marginMode !== 'REGULAR_MARGIN') blockers.push('regular_cross_margin_required');
  let wallet = null;
  if (reports.wallet) {
    const rows = reports.wallet.list;
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].accountType !== 'UNIFIED' || !Array.isArray(rows[0].coin)) errors.push('wallet:invalid_shape');
    else {
      const w = rows[0]; wallet = Object.fromEntries(['totalEquity', 'totalAvailableBalance', 'totalMarginBalance',
        'totalInitialMargin', 'totalMaintenanceMargin'].map(k => [k, number(w[k], k, k === 'totalEquity')]));
      wallet.coins = w.coin.map(c => ({ coin: c.coin, usdValue: number(c.usdValue, 'coin_usd_value', true),
        borrowAmount: number(c.borrowAmount, 'borrow_amount'), spotBorrow: c.spotBorrow == null ? null : number(c.spotBorrow, 'spot_borrow'),
        locked: number(c.locked, 'locked'), collateralSwitch: c.collateralSwitch }));
      if (wallet.coins.some(c => c.borrowAmount > 0 || c.spotBorrow > 0)) blockers.push('account_has_borrowing');
      if (wallet.totalInitialMargin > .01 || wallet.totalMaintenanceMargin > .01) blockers.push('account_margin_already_in_use');
      if (wallet.totalEquity <= 0 || wallet.totalAvailableBalance <= 0) blockers.push('no_available_collateral');
    }
  }
  const footprint = {};
  for (const [key, rows] of Object.entries(reports)) {
    if (key.startsWith('positions_')) {
      const open = rows.map(summarizePosition).filter(p => p.size > 0);
      footprint[key] = { count: open.length, rows: open };
      if (open.length) blockers.push(`${key}:occupied`);
    } else if (key.startsWith('orders_')) {
      footprint[key] = { count: rows.length, rows: rows.slice(0, 20).map(o => ({ symbol: o.symbol, positionIdx: o.positionIdx,
        orderId: o.orderId, status: o.orderStatus, type: o.orderType, stopOrderType: o.stopOrderType, qty: o.qty, reduceOnly: o.reduceOnly })),
        truncated: rows.length > 20 };
      if (rows.length) blockers.push(`${key}:occupied`);
    }
  }
  let fees = null, instrument = null;
  if (reports.fees) {
    if (reports.fees.length !== 1 || reports.fees[0].symbol !== SYMBOL) errors.push('fees:missing_hype');
    else fees = { maker: number(reports.fees[0].makerFeeRate, 'maker_fee', true), taker: number(reports.fees[0].takerFeeRate, 'taker_fee') };
    if (fees && fees.taker > .00055) blockers.push('taker_fee_above_research_assumption');
  }
  if (reports.instrument) {
    if (reports.instrument.length !== 1 || reports.instrument[0].symbol !== SYMBOL) errors.push('instrument:missing_hype');
    else {
      const r = reports.instrument[0];
      instrument = { status: r.status, settleCoin: r.settleCoin, lotSizeFilter: r.lotSizeFilter,
        priceFilter: r.priceFilter, leverageFilter: r.leverageFilter };
      if (r.status !== 'Trading' || r.settleCoin !== 'USDT') blockers.push('instrument_not_approved');
      if (number(r.leverageFilter?.maxLeverage, 'max_leverage') < LEVERAGE) blockers.push('leverage_over_instrument_max');
    }
  }
  // Retain raw rate units: the endpoint's documentation/examples are not uniform
  // enough to infer a liquidation model from these rates alone.
  const tiers = reports.tiers?.map(r => ({ id: r.id, symbol: r.symbol,
    riskLimitValue: r.riskLimitValue, maxLeverage: r.maxLeverage,
    maintenanceMargin: r.maintenanceMargin, initialMargin: r.initialMargin, mmDeduction: r.mmDeduction }));
  if (tiers && (!tiers.length || tiers.some(r => r.symbol !== SYMBOL))) errors.push('tiers:missing_or_wrong_symbol');
  const endedAt = clock();
  if (endedAt < startedAt || endedAt - startedAt > 30_000) blockers.push('snapshot_window_over_30s');
  if (localPauses && (!localPauses.main || !localPauses.sfp)) blockers.push('local_entry_pause_missing');
  return { version: 1, readOnly: true, readyToArm: false, uid: UID, startedAt, endedAt,
    preparationChecksPassed: blockers.length === 0 && errors.length === 0,
    marginMode: reports.account?.marginMode ?? null, unifiedMarginStatus: reports.account?.unifiedMarginStatus ?? null,
    positions, hypePositionPages, ignoredTerminalPlaceholder, wallet, fees, instrument, tiers: tiers ?? null, footprint, localPauses,
    blockers, errors, warnings, requestCount: requests.length, requests,
    limits: ['not an atomic exchange snapshot', 'no process-ownership proof', 'no bracket/OCO execution proof',
      'no maintenance-margin/liquidation safety certificate', 'no order or configuration write attempted'] };
}

async function main() {
  if (process.argv.length !== 2) throw Error('usage:no_arguments');
  const load = createRequire(path.join(process.cwd(), 'package.json'));
  load('dotenv').config({ quiet: true });
  if (!process.env.BYBIT_API_KEY || !process.env.BYBIT_API_SECRET) throw Error('credentials:missing');
  const { RestClientV5 } = load('bybit-api');
  const client = new RestClientV5({ key: process.env.BYBIT_API_KEY, secret: process.env.BYBIT_API_SECRET }, { timeout: 8000 });
  const report = await inspect(client, { localPauses: { main: fs.existsSync('bot-pause'), sfp: fs.existsSync('lawbster-sfp-pause') } });
  report.scriptSha256 = createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  report.evidenceSha256 = digest(report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.preparationChecksPassed) process.exitCode = 2;
}
module.exports = { inspect, UID, SYMBOL, LEVERAGE };
if (require.main === module) main().catch(() => {
  // Do not print raw API exceptions: SDK errors can contain authenticated headers.
  console.error('Read-only portfolio check failed. No orders/settings changed. Check account UID, API access and required response fields.');
  process.exitCode = 1;
});
