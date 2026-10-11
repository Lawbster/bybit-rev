#!/usr/bin/env node
'use strict';
// Operator-run, isolated venue evidence probe. DEFAULT IS READ-ONLY.
// Two ~$10 HYPE entries, one per hedge side, sequentially drained. No strategy
// state, leverage, account mode, production config or full-position TP/SL writes.
// Requires portfolio-vps-preflight.cjs beside this file. Old VPS build supported.
// --execute-short-10-usd completes only the originally approved remaining short,
// after the recorded long's manual cleanup; it writes a SEPARATE report.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { randomBytes, createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { inspect, UID, SYMBOL } = require('./portfolio-vps-preflight.cjs');
const NOTIONAL = 10;
const TERMINAL = new Set(['Filled', 'Cancelled', 'Rejected', 'Deactivated', 'PartiallyFilledCanceled']);
const STEM = 'data/HYPEUSDT_portfolio_bracket_probe.json';
const SHORT_STEM = 'data/HYPEUSDT_portfolio_bracket_short_probe.json';
const fail = text => { throw Error(text); };
const n = (v, name) => typeof v !== 'string' && typeof v !== 'number' || v === '' || !Number.isFinite(Number(v)) ? fail(`invalid_${name}`) : Number(v);
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const orderKeys = ['orderId', 'orderLinkId', 'parentOrderLinkId', 'symbol', 'side', 'positionIdx', 'qty', 'price',
  'orderType', 'orderStatus', 'createType', 'stopOrderType', 'tpslMode', 'reduceOnly', 'closeOnTrigger',
  'triggerBy', 'triggerDirection', 'triggerPrice', 'takeProfit', 'stopLoss', 'tpTriggerBy', 'slTriggerBy',
  'cumExecQty', 'cumExecValue', 'cumExecFee', 'leavesQty', 'createdTime', 'updatedTime', 'cancelType', 'rejectReason'];
const picked = (row, keys) => Object.fromEntries(keys.filter(k => row[k] !== undefined).map(k => [k, row[k]]));
const orderView = row => picked(row, orderKeys);
const plannedSides = r => r.version === 2 && r.scope === 'remaining_short' ? ['Sell'] : ['Buy', 'Sell'];
function payload(side, ticker, instrument, link) {
  const ask = n(ticker.ask1Price, 'ask'), bid = n(ticker.bid1Price, 'bid');
  const step = n(instrument.lotSizeFilter.qtyStep, 'step'), tick = n(instrument.priceFilter.tickSize, 'tick');
  const ref = side === 'Buy' ? ask : bid, qty = Math.floor(NOTIONAL / ref / step) * step;
  if (!(ask >= bid && bid > 0 && step > 0 && tick > 0 && qty > 0 && qty * ref <= NOTIONAL + 1e-8
    && qty >= n(instrument.lotSizeFilter.minOrderQty, 'minQty') && qty * ref >= n(instrument.lotSizeFilter.minNotionalValue, 'minNotional')
    && qty <= n(instrument.lotSizeFilter.maxMktOrderQty, 'maxMarket'))) fail('instrument_or_quote_outside_probe_limits');
  const price = x => (Math.round(x / tick) * tick).toFixed(10).replace(/\.?0+$/, '');
  const q = qty.toFixed(10).replace(/\.?0+$/, '');
  return { category: 'linear', symbol: SYMBOL, side, positionIdx: side === 'Buy' ? 1 : 2,
    orderType: 'Market', qty: q, orderLinkId: link, reduceOnly: false,
    tpslMode: 'Partial', takeProfit: price(ref * (side === 'Buy' ? 1.05 : .95)),
    stopLoss: price(ref * (side === 'Buy' ? .95 : 1.05)), tpTriggerBy: 'LastPrice', slTriggerBy: 'LastPrice',
    tpOrderType: 'Market', slOrderType: 'Market' };
}
function validateReport(r) {
  const short = r.version === 2 && r.scope === 'remaining_short';
  if ((!short && (r.version !== 1 || r.scope !== undefined)) || r.uid !== UID || r.symbol !== SYMBOL
    || r.maxTotalEntryNotional !== (short ? 10 : 20) || !Array.isArray(r.plans)
    || r.plans.length > (short ? 1 : 2) || !Number.isSafeInteger(r.startedAt)) fail('invalid_probe_state');
  if (short && (!/^[a-f0-9]{64}$/.test(r.predecessorSha256) || !(r.predecessorEntryNotional > 0)
    || r.predecessorEntryNotional + 10 > 20 + 1e-8)) fail('invalid_short_continuation');
  const sides = new Set();
  for (const p of r.plans) {
    if (!plannedSides(r).includes(p.entry?.side) || sides.has(p.entry.side) || !p.entry.orderLinkId?.startsWith('pfprobe_')
      || p.entry.symbol !== SYMBOL || p.entry.category !== 'linear' || p.entry.orderType !== 'Market'
      || p.entry.positionIdx !== (p.entry.side === 'Buy' ? 1 : 2) || p.entry.reduceOnly !== false || p.entry.tpslMode !== 'Partial'
      || !(Number(p.entry.qty) > 0) || !(p.reference > 0) || Number(p.entry.qty) * p.reference > NOTIONAL + 1e-8
      || p.entry.stopLoss === p.entry.takeProfit || !Array.isArray(p.children)) fail('invalid_probe_plan');
    sides.add(p.entry.side);
    if (p.close && (p.close.reduceOnly !== true || p.close.positionIdx !== p.entry.positionIdx || p.close.symbol !== SYMBOL
      || p.close.side === p.entry.side || p.close.orderType !== 'Market' || !(Number(p.close.qty) > 0)
      || Number(p.close.qty) > Number(p.entry.qty) + 1e-8 || !p.close.orderLinkId?.startsWith('pfprobe_'))) fail('invalid_probe_close');
  }
}
function createReport(now) { return { version: 1, uid: UID, symbol: SYMBOL, startedAt: now,
  maxTotalEntryNotional: 20, plans: [], complete: false, status: 'prepared', limitations: [
    'not a strategy or portfolio arming certificate', 'does not force native TP/SL triggering',
    'does not certify OCO race behavior, partial-size fills, full-size liquidity or liquidation safety'] }; }

/** Explicit continuation of the ONE remaining side, never a reset/retry of the
 * manually closed long. Old evidence is hashed, read-only and kept separately.
 * Caller must also verify current account flatness and retired child evidence.
 */
function createShortReport(prior, now) {
  validateReport(prior);
  if (prior.version !== 1 || prior.complete || prior.plans.length !== 1
    || !['known_child_missing', 'known_child_missing_after_poll'].includes(prior.error)) fail('ineligible_prior_probe');
  const p = prior.plans[0];
  if (p.entry.side !== 'Buy' || p.closeAttemptedAt || p.parent?.orderStatus !== 'Filled'
    || p.parentLinkedPairObserved !== true || p.contractMatches !== true || p.children.length !== 2
    || !Array.isArray(p.entryExecutions) || !p.entryExecutions.length) fail('prior_long_evidence_incomplete');
  const ids = new Set(); let qty = 0, notional = 0;
  for (const f of p.entryExecutions) {
    if (!f.execId || ids.has(f.execId) || f.orderId !== p.parent.orderId || f.symbol !== SYMBOL
      || f.side !== 'Buy' || !(n(f.execQty, 'prior_qty') > 0) || !(n(f.execPrice, 'prior_price') > 0)) fail('invalid_prior_receipt');
    ids.add(f.execId); qty += Number(f.execQty); notional += Number(f.execQty) * Number(f.execPrice);
  }
  if (Math.abs(qty - n(p.parent.cumExecQty, 'prior_cumulative')) > 1e-8
    || qty > n(p.entry.qty, 'prior_requested') + 1e-8 || notional + 10 > 20 + 1e-8) fail('prior_budget_or_receipts_invalid');
  const report = { ...createReport(now), version: 2, scope: 'remaining_short', maxTotalEntryNotional: 10,
    predecessorSha256: digest(prior), predecessorEntryNotional: notional,
    limitations: [...createReport(now).limitations, 'original long was manually closed, not an automatic cleanup pass'] };
  validateReport(report); return report;
}

function requireRetiredPriorChildren(prior, inspection) {
  if (inspection.readOnly !== true || inspection.uid !== UID || prior.plans.length !== 1) fail('invalid_prior_inspection');
  const p = prior.plans[0];
  if (p.children.length !== 2 || new Set(p.children.map(c => c.orderId)).size !== 2) fail('invalid_prior_children');
  for (const child of p.children) {
    const observations = inspection.observations.filter(o => o.kind === 'child' && o.selector.orderId === child.orderId);
    if (observations.length !== 1) fail('prior_child_not_retired');
    const o = observations[0], rows = [...(o.realtime || []), ...(o.history || [])];
    if (o.realtimeError || o.historyError || !rows.length || rows.some(r => r.orderId !== child.orderId
      || r.parentOrderLinkId !== p.entry.orderLinkId || r.symbol !== SYMBOL || r.positionIdx !== 1 || r.side !== 'Sell'
      || !TERMINAL.has(r.orderStatus) || n(r.cumExecQty, 'prior_child_cumulative') !== 0
      || Math.abs(n(r.qty, 'prior_child_qty') - n(child.qty, 'saved_child_qty')) > 1e-8)) fail('prior_child_not_retired');
  }
}

function reader(client) {
  async function read(method, args) {
    let r; try { r = await client[method](args); } catch { fail(`${method}_request_failed`); }
    if (r?.retCode !== 0 || !r.result) fail(`${method}_retCode_${Number.isSafeInteger(r?.retCode) ? r.retCode : 'invalid'}`);
    return r.result;
  }
  async function pages(method, args) {
    const rows = [], cursors = new Set(), ids = new Set(); let cursor;
    for (let page = 0; page < 20; page++) {
      const r = await read(method, { ...args, limit: 50, ...(cursor ? { cursor } : {}) });
      if (!Array.isArray(r.list)) fail(`${method}_missing_list`);
      for (const row of r.list) {
        const id = row.execId ?? row.orderId;
        if (!id || ids.has(id)) fail(`${method}_duplicate_identity`); ids.add(id); rows.push(row);
      }
      if (!r.nextPageCursor) return rows;
      if (cursors.has(r.nextPageCursor)) fail(`${method}_repeated_cursor`);
      cursor = r.nextPageCursor; cursors.add(cursor);
    }
    fail(`${method}_page_limit`);
  }
  return { read, pages };
}

// Diagnostics only: no lease, writes, report mutation or recovery. Keep the
// endpoint responses separate; an empty history row is not a cancellation.
async function inspectOrders(client, report) {
  validateReport(report);
  const { read, pages } = reader(client), identity = await read('getQueryApiKey');
  if (String(identity.userID) !== UID) fail('wrong_account');
  const observations = [], base = { category: 'linear', symbol: SYMBOL };
  for (const p of report.plans) {
    const queries = [{ kind: 'entry', selector: { orderLinkId: p.entry.orderLinkId } },
      ...p.children.map(c => ({ kind: 'child', selector: { orderId: c.orderId } })),
      ...(p.close ? [{ kind: 'close', selector: { orderLinkId: p.close.orderLinkId } }] : [])];
    for (const q of queries) {
      if (Object.values(q.selector).some(v => typeof v !== 'string' || !v)) fail('invalid_saved_order_identity');
      const observation = { parentLink: p.entry.orderLinkId, ...q };
      for (const [key, method] of [['realtime', 'getActiveOrders'], ['history', 'getHistoricOrders']]) {
        try { observation[key] = (await pages(method, { ...base, ...q.selector })).map(orderView); }
        catch (e) { observation[`${key}Error`] = e.message; }
      }
      observations.push(observation);
    }
  }
  return { readOnly: true, uid: UID, readyToArm: false, savedStatus: report.status,
    savedError: report.error ?? null, observations };
}

/** No uncertain request is resent, including after a restart. Each submission
 * is recorded BEFORE I/O; executions and terminal status—not acknowledgements—
 * determine the residual. Failure keeps the report recoverable, never reopens.
 */
async function exercise(client, report, { save, allowEntry = false, clock = Date.now,
  wait = ms => new Promise(r => setTimeout(r, ms)), assertOwner = () => {}, maxPolls = 16 } = {}) {
  validateReport(report);
  const persist = () => { report.updatedAt = clock(); save(report); };
  const { read, pages } = reader(client);
  async function write(method, args) { assertOwner(); return read(method, args); }
  const base = { category: 'linear', symbol: SYMBOL };
  async function order(link) {
    const [live, history] = await Promise.all([
      pages('getActiveOrders', { ...base, orderLinkId: link, openOnly: 0 }),
      pages('getHistoricOrders', { ...base, orderLinkId: link }),
    ]);
    const matches = [...live, ...history].filter(r => r.orderLinkId === link && r.symbol === SYMBOL);
    if (new Set(matches.map(r => r.orderId)).size > 1) fail('ambiguous_link_identity');
    return matches.sort((a, b) => n(b.updatedTime, 'order_time') - n(a.updatedTime, 'order_time'))[0] ?? null;
  }
  async function executions(row, side, idx) {
    const xs = await pages('getExecutionList', { ...base, orderId: row.orderId });
    const trades = xs.filter(f => f.execType === 'Trade');
    if (trades.some(f => f.orderId !== row.orderId || f.symbol !== SYMBOL || f.side !== side
      || !(n(f.execQty, 'execQty') > 0) || !(n(f.execPrice, 'execPrice') > 0)
      || !Number.isFinite(n(f.execFee, 'execFee')) || n(f.execTime, 'execTime') < report.startedAt)) fail('unowned_execution');
    const qty = trades.reduce((sum, f) => sum + n(f.execQty, 'qty'), 0);
    if (Math.abs(qty - n(row.cumExecQty, 'cumulative')) > 1e-8) fail('execution_history_incomplete');
    return { qty, rows: trades.map(f => picked(f, ['execId', 'orderId', 'orderLinkId', 'symbol', 'side', 'execTime', 'execQty', 'execPrice', 'execFee', 'execType'])) };
  }
  async function terminal(link, cancelOpen) {
    for (let poll = 0; poll < maxPolls; poll++) {
      const r = await order(link);
      if (r && TERMINAL.has(r.orderStatus)) return r;
      if (r && cancelOpen && poll === 0) await write('cancelOrder', { ...base, orderLinkId: link });
      await wait(500);
    }
    fail(`unresolved_order_${link}`);
  }
  async function discover(plan) {
    const [live, history] = await Promise.all([pages('getActiveOrders', { ...base, openOnly: 0 }),
      pages('getHistoricOrders', { ...base, startTime: report.startedAt - 1000 })]);
    const byId = new Map(), missingOrderIds = [];
    function accept(row) {
      if (row.symbol !== SYMBOL || row.positionIdx !== plan.entry.positionIdx
        || row.side !== (plan.entry.side === 'Buy' ? 'Sell' : 'Buy')) fail('child_identity_conflict');
      if (!row.orderId) fail('child_missing_identity');
      const old = byId.get(row.orderId);
      const time = n(row.updatedTime, 'child_time'), previous = old ? n(old.updatedTime, 'child_time') : -Infinity;
      if (old && time === previous && TERMINAL.has(row.orderStatus) && TERMINAL.has(old.orderStatus)
        && (row.orderStatus !== old.orderStatus || n(row.cumExecQty, 'child_qty') !== n(old.cumExecQty, 'child_qty')))
        fail('conflicting_child_terminal');
      if (!old || time > previous || time === previous && TERMINAL.has(row.orderStatus)) byId.set(row.orderId, row);
    }
    for (const row of [...live, ...history]) if (row.parentOrderLinkId === plan.entry.orderLinkId) accept(row);
    // Cancellation is asynchronous. Use exact-ID realtime (which also returns
    // recent closed orders) AND history; history alone can lag. Missing evidence
    // stays pending across the bounded polling loop, never inferred cancelled.
    for (const old of plan.children) {
      const [recent, archived] = await Promise.all([
        pages('getActiveOrders', { ...base, orderId: old.orderId }),
        pages('getHistoricOrders', { ...base, orderId: old.orderId }),
      ]);
      for (const row of [...recent, ...archived]) {
        if (row.orderId !== old.orderId) fail('exact_child_lookup_wrong_id');
        if (row.parentOrderLinkId && row.parentOrderLinkId !== plan.entry.orderLinkId) fail('child_parent_changed');
        // Do not relax lineage merely because history omits it; inspect the
        // actual venue response first. The original witnessed child is retained.
        if (row.parentOrderLinkId === plan.entry.orderLinkId) accept(row);
      }
      if (!byId.has(old.orderId)) { missingOrderIds.push(old.orderId); byId.set(old.orderId, old); }
    }
    const children = [...byId.values()];
    if (children.length > 2) fail('unsupported_multi_pair_layout');
    plan.children = children.map(orderView); plan.childLookup = { at: clock(), missingOrderIds };
    persist(); return { children, complete: missingOrderIds.length === 0 };
  }
  async function positions() {
    const r = await read('getPositionInfo', base);
    const p = r.list.filter(r => r.symbol === SYMBOL && [1, 2].includes(r.positionIdx));
    if (p.length !== 2 || new Set(p.map(r => r.positionIdx)).size !== 2) fail('hedge_pair_missing');
    return p;
  }
  async function drain(plan) {
    if (!plan.entryAttemptedAt) return;
    const parent = await terminal(plan.entry.orderLinkId, true);
    if (parent.side !== plan.entry.side || parent.positionIdx !== plan.entry.positionIdx || parent.reduceOnly === true
      || Math.abs(n(parent.qty, 'parent_qty') - Number(plan.entry.qty)) > 1e-8) fail('parent_identity_conflict');
    const fills = await executions(parent, plan.entry.side, plan.entry.positionIdx);
    if (fills.qty > Number(plan.entry.qty) + 1e-8) fail('entry_fills_exceed_request');
    plan.parent = orderView(parent); plan.entryExecutions = fills.rows; persist();
    let children = [], lookupComplete = false;
    for (let poll = 0; poll < maxPolls; poll++) {
      const lookup = await discover(plan); children = lookup.children; lookupComplete = lookup.complete;
      if (lookupComplete && (children.length === 2 || fills.qty === 0)) break;
      await wait(500);
    }
    if (!lookupComplete) fail('known_child_missing_after_poll');
    plan.parentLinkedPairObserved = children.length === 2;
    plan.contractMatches = children.length === 2 && children.every(c => c.tpslMode === 'Partial' && c.orderType === 'Market'
      && c.reduceOnly === true && c.triggerBy === 'LastPrice' && Math.abs(n(c.qty, 'child_qty') - fills.qty) <= 1e-8)
      && ['tp', 'sl'].every(kind => children.filter(c => Number(c.triggerPrice) === Number(kind === 'tp' ? plan.entry.takeProfit : plan.entry.stopLoss)
        && c.triggerDirection === ((kind === 'tp') === (plan.entry.side === 'Buy') ? 1 : 2)).length === 1);
    // Unknown children are never guessed/cancelled. If discovery is unsupported,
    // stop here and retain venue protection for operator inspection.
    if (fills.qty > 0 && children.length !== 2) fail('parent_linked_pair_not_discoverable');
    for (const c of children) if (!TERMINAL.has(c.orderStatus)) {
      plan.cancelAttempts ??= []; plan.cancelAttempts.push({ orderId: c.orderId, at: clock() }); persist();
      try { await write('cancelOrder', { ...base, orderId: c.orderId }); }
      catch { /* A fill/cancel race is decided by terminal evidence below. */ }
    }
    for (let poll = 0; poll < maxPolls; poll++) {
      const lookup = await discover(plan); children = lookup.children; lookupComplete = lookup.complete;
      if (lookupComplete && children.every(c => TERMINAL.has(c.orderStatus))) break;
      await wait(500);
    }
    if (!lookupComplete) fail('known_child_missing_after_poll');
    if (children.some(c => !TERMINAL.has(c.orderStatus))) fail('child_cancel_not_terminal');
    let childQty = 0; plan.childExecutions = [];
    for (const c of children) {
      const f = await executions(c, plan.entry.side === 'Buy' ? 'Sell' : 'Buy', plan.entry.positionIdx);
      childQty += f.qty; plan.childExecutions.push(...f.rows);
    }
    if (childQty > fills.qty + 1e-8) fail('child_fills_exceed_entry');
    let residual = fills.qty - childQty;
    // An already-submitted close is observed, never resubmitted on recovery.
    if (plan.closeAttemptedAt) {
      const close = await terminal(plan.close.orderLinkId, true);
      const f = await executions(close, plan.close.side, plan.close.positionIdx);
      plan.closeResult = orderView(close); plan.closeExecutions = f.rows; residual -= f.qty;
    }
    const ps = await positions(), mine = ps.find(p => p.positionIdx === plan.entry.positionIdx), other = ps.find(p => p !== mine);
    if (Math.abs(n(mine.size, 'size') - residual) > 1e-8 || n(other.size, 'other_size') !== 0) fail('unexpected_position_quantity');
    if (residual > 1e-8) {
      if (plan.closeAttemptedAt) fail('partial_close_requires_operator_review');
      plan.close = { ...base, orderLinkId: `${plan.entry.orderLinkId}_x`, side: plan.entry.side === 'Buy' ? 'Sell' : 'Buy',
        positionIdx: plan.entry.positionIdx, orderType: 'Market', qty: residual.toFixed(10).replace(/\.?0+$/, ''), reduceOnly: true };
      plan.closeAttemptedAt = clock(); persist();
      try { await write('submitOrder', plan.close); } catch { /* Observe original link below. */ }
      const close = await terminal(plan.close.orderLinkId, true);
      const f = await executions(close, plan.close.side, plan.close.positionIdx);
      plan.closeResult = orderView(close); plan.closeExecutions = f.rows; residual -= f.qty;
      if (Math.abs(residual) > 1e-8) fail('partial_close_requires_operator_review');
    }
    const flat = await positions(), open = await pages('getActiveOrders', { ...base, openOnly: 0 });
    if (flat.some(p => n(p.size, 'size') !== 0) || open.length) fail('cleanup_not_flat_or_orders_remain');
    plan.drainedAt = clock(); plan.status = fills.qty === 0 ? 'unfilled_flat'
      : plan.contractMatches ? 'observed_and_flat' : 'metadata_mismatch_flat'; persist();
  }
  const identity = await read('getQueryApiKey');
  if (String(identity.userID) !== UID || identity.readOnly !== 0) fail('wrong_account_or_read_only');
  for (const p of report.plans) if (!p.drainedAt) await drain(p);
  // A restarted execute invocation is drain-only. CLI passes allowEntry only
  // when it created this NEW durable report after a fresh flat preflight.
  if (allowEntry) for (const side of plannedSides(report)) {
    if (report.plans.some(p => p.entry.side === side)) fail('entry_side_already_attempted');
    const [t, i] = await Promise.all([read('getTickers', base), read('getInstrumentsInfo', base)]);
    if (t.list.length !== 1 || i.list.length !== 1 || t.list[0].symbol !== SYMBOL || i.list[0].symbol !== SYMBOL) fail('wrong_market_data');
    const link = `pfprobe_${report.startedAt}_${side === 'Buy' ? 'l' : 's'}`;
    const entry = payload(side, t.list[0], i.list[0], link);
    const plan = { entry, reference: n(side === 'Buy' ? t.list[0].ask1Price : t.list[0].bid1Price, 'reference'),
      children: [], entryAttemptedAt: clock() };
    report.plans.push(plan); report.status = 'executing'; persist();
    try { await write('submitOrder', entry); } catch { /* Never retry; resolve by durable link. */ }
    await drain(plan);
    if (plan.status !== 'observed_and_flat') break;
  }
  report.complete = report.plans.length === plannedSides(report).length && report.plans.every(p => p.status === 'observed_and_flat');
  report.status = report.complete ? 'metadata_and_cleanup_passed' : 'drained_not_complete'; persist();
  return report;
}

function assertStopped() {
  // jlist includes environment variables; parse privately and never print it.
  const home = process.env.PM2_HOME || path.join(process.env.HOME || '', '.pm2');
  const pid = Number(fs.readFileSync(path.join(home, 'pm2.pid'), 'utf8')); if (!(pid > 0)) fail('pm2_not_running');
  process.kill(pid, 0);
  const rows = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
  const writers = /^(hedgeguy-bot|hype-sfp-live|hype-hl-short-live|pf0-short-bot|hype-sfp-smoke|hype-portfolio.*)$/;
  if (!Array.isArray(rows) || rows.some(r => writers.test(r.name) && !['stopped', 'errored'].includes(r.pm2_env?.status))) fail('old_or_new_writer_not_stopped');
  if (!fs.existsSync('bot-pause') || !fs.existsSync('lawbster-sfp-pause')) fail('pause_file_missing');
}
function lease() {
  const directory = path.resolve('data/account-owners'); fs.mkdirSync(directory, { recursive: true });
  const held = [], token = randomBytes(16).toString('hex');
  const release = () => { for (const r of held) if (fs.readFileSync(r.file, 'utf8') === r.bytes) fs.unlinkSync(r.file); };
  try { for (const side of [1, 2]) {
    const file = path.join(directory, `${UID}-${SYMBOL}-${side}.lock`);
    const bytes = JSON.stringify({ version: 1, pid: process.pid, uid: UID, symbol: SYMBOL, side, token });
    const fd = fs.openSync(file, 'wx', 0o600); try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    held.push({ file, bytes });
  } } catch { release(); fail('account_lease_unavailable_do_not_auto_remove'); }
  return { release, assertHeld() { for (const r of held) if (fs.readFileSync(r.file, 'utf8') !== r.bytes) fail('account_lease_changed'); } };
}
function saveReport(report, target = STEM) {
  const file = path.resolve(target), tmp = file + '.next'; fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify({ report, sha256: digest(report) }, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); } fs.renameSync(tmp, file);
}
async function main() {
  const mode = process.argv[2] || '--preview';
  if (!['--preview', '--inspect-orders', '--execute-20-usd', '--recover-only',
    '--execute-short-10-usd', '--inspect-short-orders', '--recover-short-only'].includes(mode) || process.argv.length > 3) fail('invalid_mode');
  const short = ['--execute-short-10-usd', '--inspect-short-orders', '--recover-short-only'].includes(mode);
  const target = short ? SHORT_STEM : STEM;
  function loadReport(file) {
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (stored.sha256 !== digest(stored.report)) fail('probe_state_checksum_failed');
    validateReport(stored.report); return stored.report;
  }
  const save = report => saveReport(report, target);
  const load = createRequire(path.join(process.cwd(), 'package.json')); load('dotenv').config({ quiet: true });
  if (!process.env.BYBIT_API_KEY || !process.env.BYBIT_API_SECRET) fail('credentials_missing');
  const client = new (load('bybit-api').RestClientV5)({ key: process.env.BYBIT_API_KEY, secret: process.env.BYBIT_API_SECRET }, { timeout: 8000 });
  if (mode === '--inspect-orders' || mode === '--inspect-short-orders') {
    console.log(JSON.stringify(await inspectOrders(client, loadReport(target)), null, 2)); return;
  }
  if (mode === '--preview') {
    const p = await inspect(client, { localPauses: { main: fs.existsSync('bot-pause'), sfp: fs.existsSync('lawbster-sfp-pause') } });
    let stopped = false; try { assertStopped(); stopped = true; } catch {}
    console.log(JSON.stringify({ readOnly: true, readyToArm: false, uid: UID, preparationChecksPassed: p.preparationChecksPassed,
      blockers: p.blockers, errors: p.errors, writersStopped: stopped, existingProbe: fs.existsSync(STEM), existingShortProbe: fs.existsSync(SHORT_STEM),
      plan: 'two sequential HYPE market entries, ~$10 long then ~$10 short; Partial TP/SL 5% away; cancel BOTH known children then reduce-only close',
      changesLeverageOrConfig: false, triggersNativeStops: false }, null, 2)); return;
  }
  assertStopped(); const ownership = lease(); let report;
  try {
    if (mode === '--execute-20-usd' || mode === '--execute-short-10-usd') {
      if (fs.existsSync(target)) fail('probe_already_exists_do_not_repeat_execute');
      if (!short && fs.existsSync(SHORT_STEM)) fail('prior_short_probe_exists');
      let prior, retiredEvidence;
      if (short) {
        prior = loadReport(STEM);
        createShortReport(prior, Date.now()); // Reject ineligible predecessor before any write.
        retiredEvidence = await inspectOrders(client, prior);
        requireRetiredPriorChildren(prior, retiredEvidence);
      }
      const p = await inspect(client, { localPauses: { main: true, sfp: true } });
      if (!p.preparationChecksPassed) fail('account_preflight_not_clear');
      if (prior && digest(loadReport(STEM)) !== digest(prior)) fail('prior_probe_changed');
      report = short ? createShortReport(prior, Date.now()) : createReport(Date.now());
      if (short) report.priorChildRetirementEvidence = retiredEvidence;
      report.preflightDigest = digest(p); save(report);
    } else {
      report = loadReport(target);
      if (report.version !== (short ? 2 : 1)) fail('wrong_probe_recovery_scope');
    }
    await exercise(client, report, { save, allowEntry: mode === '--execute-20-usd' || mode === '--execute-short-10-usd',
      assertOwner: () => { ownership.assertHeld(); assertStopped(); } });
    console.log(JSON.stringify({ status: report.status, complete: report.complete, readyToArm: false, report: target,
      sides: report.plans.map(p => ({ side: p.entry.side, status: p.status, children: p.children.length })) }, null, 2));
  } catch (e) {
    if (report) { report.status = 'needs_review'; report.error = e instanceof Error && /^[a-z0-9_:]+$/.test(e.message)
      ? e.message : 'probe_failed'; save(report); }
    console.error(JSON.stringify({ error: report?.error ?? (e instanceof Error && /^[a-z0-9_:]+$/.test(e.message) ? e.message : 'probe_failed'), report: target }));
    console.error(`Probe did not complete. KEEP BOTH BOTS STOPPED. Inspect the report and Bybit; do not rerun execute. Drain-only mode: ${short ? '--recover-short-only' : '--recover-only'}.`);
    process.exitCode = 2;
  } finally { ownership.release(); }
}
module.exports = { payload, exercise, inspectOrders, createReport, createShortReport, requireRetiredPriorChildren, validateReport, UID, SYMBOL };
if (require.main === module) main().catch(() => {
  console.error('Probe failed. Keep bots stopped/paused; inspect Bybit and the local probe report before any retry. Do not assume an attempted entry was unfilled.'); process.exitCode = 1;
});
