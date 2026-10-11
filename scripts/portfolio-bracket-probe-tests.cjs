'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { payload, exercise, inspectOrders, createReport, createShortReport, requireRetiredPriorChildren, validateReport, UID, SYMBOL } = require('./portfolio-bracket-probe.cjs');
const T = Date.UTC(2026, 9, 11), tick = { symbol: SYMBOL, bid1Price: '100', ask1Price: '100' };
const instrument = { symbol: SYMBOL, lotSizeFilter: { qtyStep: '.01', minOrderQty: '.01', minNotionalValue: '5', maxMktOrderQty: '14700' }, priceFilter: { tickSize: '.01' } };
const terminal = r => ['Filled', 'Cancelled', 'Rejected', 'Deactivated', 'PartiallyFilledCanceled'].includes(r.orderStatus);
class Fake {
  constructor() { this.orders = []; this.fills = []; this.writes = []; this.quantity = { 1: 0, 2: 0 }; this.uid = UID;
    this.failAfterEntry = false; this.hideChildren = false; this.hiddenParent = false; this.mismatch = false;
    this.partial = false; this.cancelStuck = false; this.raceFill = false; this.entryCount = 0; }
  result(list) { return { retCode: 0, result: { list, nextPageCursor: '' } }; }
  async getQueryApiKey() { return { retCode: 0, result: { userID: this.uid, readOnly: 0 } }; }
  async getTickers() { return this.result([tick]); }
  async getInstrumentsInfo() { return this.result([instrument]); }
  async getPositionInfo() { return this.result([1, 2].map(positionIdx => ({ symbol: SYMBOL, positionIdx, size: String(this.quantity[positionIdx]) }))); }
  rows(q) { return this.orders.filter(r => (!q.orderId || r.orderId === q.orderId) && (!q.orderLinkId || r.orderLinkId === q.orderLinkId)
    && (!this.hideChildren || !r.parentOrderLinkId) && (!this.hiddenParent || !!r.parentOrderLinkId || r.reduceOnly)); }
  async getActiveOrders(q) { return this.result(this.rows(q).filter(r => q.orderId || q.orderLinkId || !terminal(r))); }
  async getHistoricOrders(q) { return this.result(this.rows(q)); }
  async getExecutionList(q) { return this.result(this.fills.filter(f => f.orderId === q.orderId)); }
  fill(row, qty) {
    this.fills.push({ execId: `f${this.fills.length}`, orderId: row.orderId, orderLinkId: row.orderLinkId,
      symbol: SYMBOL, side: row.side, execType: 'Trade', execQty: String(qty), execPrice: '100', execFee: String(qty * 100 * .00055), execTime: String(T + 1) });
    row.cumExecQty = String(Number(row.cumExecQty) + qty); row.orderStatus = 'Filled';
    this.quantity[row.positionIdx] += row.reduceOnly ? -qty : qty;
  }
  async submitOrder(p) {
    this.writes.push(structuredClone(p));
    const o = { ...p, orderId: `o${this.orders.length}`, orderStatus: 'New', cumExecQty: '0', updatedTime: String(T + 1) };
    this.orders.push(o);
    const qty = Number(p.qty) * (this.partial && !p.reduceOnly ? .5 : 1); this.fill(o, qty);
    if (this.partial && !p.reduceOnly) o.orderStatus = 'PartiallyFilledCanceled';
    if (!p.reduceOnly) {
      this.entryCount++;
      for (const kind of ['tp', 'sl']) this.orders.push({ symbol: SYMBOL, orderId: `${o.orderId}_${kind}`, orderLinkId: '', parentOrderLinkId: p.orderLinkId,
        side: p.side === 'Buy' ? 'Sell' : 'Buy', positionIdx: p.positionIdx, qty: String(qty),
        orderType: 'Market', tpslMode: this.mismatch ? 'Full' : 'Partial', reduceOnly: true, triggerBy: 'LastPrice',
        triggerDirection: (kind === 'tp') === (p.side === 'Buy') ? 1 : 2, triggerPrice: kind === 'tp' ? p.takeProfit : p.stopLoss,
        cumExecQty: '0', orderStatus: 'Untriggered', updatedTime: String(T + 1) });
      if (this.failAfterEntry) throw Error('secret SDK response not for logs');
    }
    return { retCode: 0, result: { orderId: o.orderId } };
  }
  async cancelOrder(q) {
    this.writes.push({ cancel: q }); const r = this.orders.find(r => q.orderId ? r.orderId === q.orderId : r.orderLinkId === q.orderLinkId);
    if (this.cancelStuck) return { retCode: 0, result: {} };
    if (this.raceFill && r.orderId.endsWith('_tp') && !terminal(r)) {
      this.fill(r, Number(r.qty)); return { retCode: 0, result: {} };
    }
    if (!terminal(r)) r.orderStatus = 'Cancelled'; return { retCode: 0, result: {} };
  }
}
const cases = [];
async function test(name, fn) { try { await fn(); cases.push(name); } catch (e) { throw Error(name, { cause: e }); } }
function args(report, options = {}) { return { save: r => { validateReport(r); }, clock: () => T + 1, wait: async () => {}, maxPolls: 2, ...options }; }
async function manuallyClosedPrior() {
  const c = new Fake(), r = createReport(T); c.cancelStuck = true;
  await assert.rejects(exercise(c, r, args(r, { allowEntry: true })), /child_cancel_not_terminal/);
  r.error = 'known_child_missing'; r.status = 'needs_review';
  c.cancelStuck = false; c.quantity[1] = 0;
  for (const o of c.orders.filter(o => o.parentOrderLinkId)) {
    o.orderStatus = 'Deactivated'; o.cancelType = 'CancelByUser'; o.leavesQty = '0';
  }
  return { c, r };
}
async function main() {
  await test('payload bounded at $10 per side; correct hedge and Partial, no full-side write', () => {
    for (const side of ['Buy', 'Sell']) {
      const p = payload(side, tick, instrument, 'pfprobe_test'); assert.equal(Number(p.qty) * 100, 10);
      assert.equal(p.positionIdx, side === 'Buy' ? 1 : 2); assert.equal(p.tpslMode, 'Partial');
      assert.equal(p.reduceOnly, false); assert.equal(p.tpOrderType, 'Market');
    }
    assert.throws(() => payload('Buy', { ...tick, ask1Price: 'NaN' }, instrument, 'pfprobe_test'));
    assert.throws(() => payload('Buy', tick, { ...instrument, lotSizeFilter: { ...instrument.lotSizeFilter, minNotionalValue: '11' } }, 'pfprobe_test'));
  });
  await test('default exercise never submits entries', async () => {
    const c = new Fake(), r = createReport(T); await exercise(c, r, args(r)); assert.equal(c.writes.length, 0); assert(!r.complete);
  });
  await test('wrong UID stops before any write', async () => {
    const c = new Fake(), r = createReport(T); c.uid = 'other'; await assert.rejects(exercise(c, r, args(r, { allowEntry: true }))); assert.equal(c.writes.length, 0);
  });
  await test('both sides witnessed, children cancelled individually, receipts closed, flat', async () => {
    const c = new Fake(), r = createReport(T);
    await exercise(c, r, args(r, { allowEntry: true })); assert.equal(r.complete, true);
    assert.equal(c.entryCount, 2); assert.equal(c.writes.filter(w => w.reduceOnly).length, 2); assert.equal(c.writes.filter(w => w.cancel).length, 4);
    assert.equal(c.quantity[1] + c.quantity[2], 0); assert(r.plans.every(p => p.children.length === 2 && p.contractMatches));
    assert(c.writes.filter(w => w.reduceOnly).every(w => Number(w.qty) <= .1));
  });
  await test('lost submit responses are observed; never retried', async () => {
    const c = new Fake(), r = createReport(T); c.failAfterEntry = true;
    await exercise(c, r, args(r, { allowEntry: true })); assert(r.complete); assert.equal(c.entryCount, 2);
  });
  await test('actual child fill racing cancellation reduces residual; never double-close', async () => {
    const c = new Fake(), r = createReport(T); c.raceFill = true;
    await exercise(c, r, args(r, { allowEntry: true })); assert(r.complete); assert.equal(c.writes.filter(w => w.reduceOnly).length, 0);
    assert(r.plans.every(p => p.childExecutions.length === 1));
  });
  await test('partial entry closes only actual fill', async () => {
    const c = new Fake(), r = createReport(T); c.partial = true;
    await exercise(c, r, args(r, { allowEntry: true })); assert(r.complete);
    assert(c.writes.filter(w => w.reduceOnly).every(w => Number(w.qty) === .05));
  });
  await test('missing parent linkage retains protection, no guessed cancellation/close; restart drains without opening second side', async () => {
    const c = new Fake(), r = createReport(T); c.hideChildren = true;
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true })), /parent_linked_pair/);
    assert.equal(c.writes.length, 1); assert.equal(c.quantity[1], .1);
    c.hideChildren = false; await exercise(c, r, args(r)); assert.equal(c.entryCount, 1); assert.equal(c.quantity[1], 0); assert(!r.complete);
  });
  await test('cancel acknowledgement cannot release native child authority', async () => {
    const c = new Fake(), r = createReport(T); c.cancelStuck = true;
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true })), /child_cancel_not_terminal/);
    assert.equal(c.writes.filter(w => w.reduceOnly).length, 0); assert.equal(c.entryCount, 1);
    c.cancelStuck = false; await exercise(c, r, args(r)); assert.equal(c.quantity[1], 0);
  });
  await test('metadata mismatch drains owned pair but does not certify or open next side', async () => {
    const c = new Fake(), r = createReport(T); c.mismatch = true;
    await exercise(c, r, args(r, { allowEntry: true })); assert(!r.complete); assert.equal(r.plans[0].status, 'metadata_mismatch_flat');
    assert.equal(c.entryCount, 1); assert.equal(c.quantity[1], 0);
  });
  await test('undersized attached protection is not certified; clean up without next entry', async () => {
    const c = new Fake(), r = createReport(T), submit = c.submitOrder.bind(c);
    c.submitOrder = async p => {
      const result = await submit(p);
      if (!p.reduceOnly) for (const child of c.orders.filter(o => o.parentOrderLinkId === p.orderLinkId)) child.qty = String(Number(p.qty) / 2);
      return result;
    };
    await exercise(c, r, args(r, { allowEntry: true }));
    assert(!r.complete); assert.equal(r.plans[0].status, 'metadata_mismatch_flat');
    assert.equal(c.entryCount, 1); assert.equal(c.quantity[1], 0);
  });
  await test('unknown parent outcome stays unresolved across recovery; never inferred flat', async () => {
    const c = new Fake(), r = createReport(T); c.hiddenParent = true;
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true })), /unresolved_order/);
    await assert.rejects(exercise(c, r, args(r)), /unresolved_order/); assert.equal(c.entryCount, 1);
    c.hiddenParent = false; await exercise(c, r, args(r)); assert.equal(c.quantity[1], 0);
  });
  await test('missing execution receipt blocks reducing unproven quantity', async () => {
    const c = new Fake(), r = createReport(T); c.getExecutionList = async () => c.result([]);
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true })), /execution_history_incomplete/);
    assert.equal(c.writes.length, 1);
  });
  await test('durable intent precedes first submission and close submission', async () => {
    const c = new Fake(), r = createReport(T); let disk;
    const orig = c.submitOrder.bind(c); c.submitOrder = async p => {
      const plan = disk.plans.find(v => v.entry.orderLinkId === p.orderLinkId || v.close?.orderLinkId === p.orderLinkId);
      assert(plan); assert(p.reduceOnly ? plan.closeAttemptedAt : plan.entryAttemptedAt); return orig(p);
    };
    await exercise(c, r, args(r, { allowEntry: true, save: v => { disk = structuredClone(v); } })); assert(r.complete);
  });
  await test('persist failure before submit prevents network write', async () => {
    const c = new Fake(), r = createReport(T);
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true, save: () => { throw Error('disk'); } })), /disk/);
    assert.equal(c.writes.length, 0);
  });
  await test('changed owner proof prevents submission; no retries', async () => {
    const c = new Fake(), r = createReport(T);
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true, assertOwner: () => { throw Error('owner lost'); } })));
    assert.equal(c.writes.length, 0);
  });
  await test('malformed saved size/identity cannot authorize recovery writes', async () => {
    const c = new Fake(), r = createReport(T);
    r.plans.push({ entry: payload('Buy', tick, instrument, 'pfprobe_test'), reference: 1, children: [], entryAttemptedAt: T });
    r.plans[0].entry.symbol = 'BTCUSDT'; await assert.rejects(exercise(c, r, args(r))); assert.equal(c.writes.length, 0);
  });
  await test('cancelled children visible by exact realtime ID before history catches up', async () => {
    const c = new Fake(), r = createReport(T), recent = c.getActiveOrders.bind(c); let exactCalls = 0;
    c.getHistoricOrders = async q => c.result(c.rows(q).filter(o => !(o.parentOrderLinkId && terminal(o))));
    c.getActiveOrders = async q => { if (q.orderId) exactCalls++; return recent(q); };
    await exercise(c, r, args(r, { allowEntry: true }));
    assert(r.complete); assert(exactCalls >= 4); assert.equal(c.quantity[1] + c.quantity[2], 0);
  });
  await test('both endpoints temporarily miss cancelled children; retain identities and poll before closing', async () => {
    const c = new Fake(), r = createReport(T), recent = c.getActiveOrders.bind(c), misses = new Set(); let waits = 0, pending = 0;
    c.getHistoricOrders = async q => c.result(c.rows(q).filter(o => !(o.parentOrderLinkId && terminal(o))));
    c.getActiveOrders = async q => {
      const result = await recent(q);
      if (q.orderId && result.result.list.some(o => o.parentOrderLinkId && terminal(o)) && !misses.has(q.orderId)) {
        misses.add(q.orderId); return c.result([]);
      }
      return result;
    };
    await exercise(c, r, args(r, { allowEntry: true, wait: async () => { waits++; }, save: v => {
      validateReport(v);
      for (const p of v.plans) if (p.childLookup?.missingOrderIds.length) {
        pending++; assert.equal(p.children.length, 2); assert(!p.closeAttemptedAt);
      }
    } }));
    assert(r.complete); assert(waits >= 2 && pending >= 2); assert.equal(c.entryCount, 2);
  });
  await test('permanently missing terminal evidence stays unresolved and never double-opens on recovery', async () => {
    const c = new Fake(), r = createReport(T), recent = c.getActiveOrders.bind(c), history = c.getHistoricOrders.bind(c);
    let hide = true;
    for (const [name, original] of [['getActiveOrders', recent], ['getHistoricOrders', history]]) c[name] = async q => {
      const result = await original(q);
      if (hide) result.result.list = result.result.list.filter(o => !(o.parentOrderLinkId && terminal(o)));
      return result;
    };
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true })), /known_child_missing_after_poll/);
    assert.equal(r.plans[0].children.length, 2); assert.equal(r.plans[0].childLookup.missingOrderIds.length, 2);
    await assert.rejects(exercise(c, r, args(r)), /known_child_missing_after_poll/);
    assert.equal(c.entryCount, 1); assert.equal(c.writes.filter(w => w.reduceOnly).length, 0);
    hide = false; await exercise(c, r, args(r)); assert.equal(c.quantity[1], 0); assert.equal(c.entryCount, 1);
  });
  await test('exact child ID cannot change its linked parent', async () => {
    const c = new Fake(), r = createReport(T), recent = c.getActiveOrders.bind(c);
    c.getActiveOrders = async q => {
      const result = await recent(q);
      if (q.orderId) result.result.list = result.result.list.map(o => ({ ...o, parentOrderLinkId: 'different_parent' }));
      return result;
    };
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true })), /child_parent_changed/);
    assert.equal(c.writes.filter(w => w.reduceOnly).length, 0);
  });
  await test('exact ID lookup returning another order is rejected', async () => {
    const c = new Fake(), r = createReport(T), recent = c.getActiveOrders.bind(c);
    c.getActiveOrders = async q => {
      const result = await recent(q);
      if (q.orderId) result.result.list = result.result.list.map(o => ({ ...o, orderId: 'other_id' }));
      return result;
    };
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true })), /exact_child_lookup_wrong_id/);
    assert.equal(c.writes.filter(w => w.reduceOnly).length, 0);
  });
  await test('stale open history cannot overwrite equal-time terminal realtime evidence', async () => {
    const c = new Fake(), r = createReport(T), history = c.getHistoricOrders.bind(c);
    c.getHistoricOrders = async q => {
      const result = await history(q);
      result.result.list = result.result.list.map(o => o.parentOrderLinkId && terminal(o) ? { ...o, orderStatus: 'Untriggered' } : o);
      return result;
    };
    await exercise(c, r, args(r, { allowEntry: true })); assert(r.complete);
  });
  await test('contradictory terminal snapshots cannot authorize closing residual', async () => {
    const c = new Fake(), r = createReport(T), history = c.getHistoricOrders.bind(c);
    c.getHistoricOrders = async q => {
      const result = await history(q);
      result.result.list = result.result.list.map(o => o.parentOrderLinkId && terminal(o)
        ? { ...o, orderStatus: 'Filled', cumExecQty: o.qty } : o);
      return result;
    };
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true })), /conflicting_child_terminal/);
    assert.equal(c.writes.filter(w => w.reduceOnly).length, 0);
  });
  await test('inspection is read-only and preserves the exact saved report', async () => {
    const c = new Fake(), r = createReport(T); await exercise(c, r, args(r, { allowEntry: true }));
    const saved = JSON.stringify(r), writes = c.writes.length;
    const result = await inspectOrders(c, r);
    assert.equal(result.readOnly, true); assert.equal(result.readyToArm, false); assert.equal(result.observations.length, 8);
    assert.equal(c.writes.length, writes); assert.equal(JSON.stringify(r), saved);
  });
  await test('inspection checks account identity before any order lookup', async () => {
    const c = new Fake(), r = createReport(T); c.uid = 'wrong'; let queried = false;
    c.getActiveOrders = async () => { queried = true; throw Error('should not query'); };
    await assert.rejects(inspectOrders(c, r), /wrong_account/); assert(!queried); assert.equal(c.writes.length, 0);
  });
  await test('manually closed position is never closed again or silently marked probe-cleaned', async () => {
    const c = new Fake(), r = createReport(T); c.cancelStuck = true;
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true })), /child_cancel_not_terminal/);
    for (const o of c.orders.filter(o => o.parentOrderLinkId)) o.orderStatus = 'Cancelled';
    c.quantity[1] = 0; c.cancelStuck = false;
    await assert.rejects(exercise(c, r, args(r)), /unexpected_position_quantity/);
    assert.equal(c.writes.filter(w => w.reduceOnly).length, 0); assert.equal(c.entryCount, 1); assert(!r.complete);
  });
  await test('witnessed Deactivated shape and paired cancellation work despite redundant sibling cancel rejection', async () => {
    const c = new Fake(), r = createReport(T), recent = c.getActiveOrders.bind(c); let paired = 0;
    c.cancelOrder = async q => {
      c.writes.push({ cancel: q });
      const row = c.orders.find(o => o.orderId === q.orderId);
      if (terminal(row)) return { retCode: 110001, result: {} };
      paired++;
      for (const child of c.orders.filter(o => o.parentOrderLinkId === row.parentOrderLinkId)) {
        child.orderStatus = 'Deactivated'; child.leavesQty = '0'; child.cancelType = 'CancelByUser';
      }
      return { retCode: 0, result: {} };
    };
    // Model delayed history with the witnessed terminal shape in realtime.
    c.getHistoricOrders = async q => c.result(c.rows(q).filter(o => !(o.parentOrderLinkId && terminal(o))));
    c.getActiveOrders = recent;
    await exercise(c, r, args(r, { allowEntry: true }));
    assert(r.complete); assert.equal(paired, 2); assert.equal(c.quantity[1] + c.quantity[2], 0);
    assert(r.plans.every(p => p.children.every(o => o.orderStatus === 'Deactivated' && o.parentOrderLinkId === p.entry.orderLinkId)));
  });
  await test('remaining-short report runs only Sell and preserves original manual-cleanup evidence', async () => {
    const { c, r: prior } = await manuallyClosedPrior(), before = JSON.stringify(prior);
    requireRetiredPriorChildren(prior, await inspectOrders(c, prior));
    const r = createShortReport(prior, T); assert.equal(r.maxTotalEntryNotional, 10);
    await exercise(c, r, args(r, { allowEntry: true }));
    assert(r.complete); assert.equal(r.plans.length, 1); assert.equal(r.plans[0].entry.side, 'Sell');
    assert.equal(c.entryCount, 2); assert.equal(c.quantity[1] + c.quantity[2], 0);
    assert.equal(JSON.stringify(prior), before); assert.equal(prior.complete, false);
  });
  await test('short continuation cannot admit a second Buy or multiple entries', async () => {
    const { r: prior } = await manuallyClosedPrior(), r = createShortReport(prior, T);
    r.plans.push({ entry: payload('Buy', tick, instrument, 'pfprobe_wrong'), reference: 100, children: [] });
    assert.throws(() => validateReport(r), /invalid_probe_plan/);
    r.plans[0].entry = payload('Sell', tick, instrument, 'pfprobe_short'); r.plans.push(structuredClone(r.plans[0]));
    assert.throws(() => validateReport(r), /invalid_probe_state/);
  });
  await test('short continuation rejects previously attempted short, completed runs and wrong failure scope', async () => {
    const { r: prior } = await manuallyClosedPrior();
    for (const change of [r => { r.plans[0].entry = payload('Sell', tick, instrument, 'pfprobe_wrong'); },
      r => { r.complete = true; }, r => { r.error = 'execution_history_incomplete'; }]) {
      const r = structuredClone(prior); change(r); assert.throws(() => createShortReport(r, T));
    }
  });
  await test('short continuation rejects missing/duplicate receipts and combined entry budget over $20', async () => {
    const { r: prior } = await manuallyClosedPrior();
    for (const change of [r => { r.plans[0].entryExecutions = []; },
      r => { r.plans[0].entryExecutions.push(structuredClone(r.plans[0].entryExecutions[0])); },
      r => { r.plans[0].entryExecutions[0].execPrice = '101'; }]) {
      const r = structuredClone(prior); change(r); assert.throws(() => createShortReport(r, T));
    }
  });
  await test('old children must have exact identity, terminal zero-fill evidence before continuation', async () => {
    const { c, r: prior } = await manuallyClosedPrior(), good = await inspectOrders(c, prior);
    requireRetiredPriorChildren(prior, good);
    for (const change of [o => { o.observations = o.observations.filter(x => x.kind !== 'child'); },
      o => { o.observations[1].realtime = []; o.observations[1].history = []; },
      o => { o.observations[1].realtime[0].orderStatus = 'Untriggered'; },
      o => { o.observations[1].realtime[0].cumExecQty = '.01'; },
      o => { o.observations[1].realtime[0].parentOrderLinkId = 'wrong'; },
      o => { o.observations[1].historyError = 'missing'; }]) {
      const o = structuredClone(good); change(o); assert.throws(() => requireRetiredPriorChildren(prior, o), /prior_child_not_retired/);
    }
  });
  await test('short-only recovery never sends another entry', async () => {
    const { r: prior } = await manuallyClosedPrior(), c = new Fake(), r = createShortReport(prior, T);
    c.cancelStuck = true;
    await assert.rejects(exercise(c, r, args(r, { allowEntry: true })), /child_cancel_not_terminal/);
    assert.equal(c.quantity[2], .1); c.cancelStuck = false;
    await exercise(c, r, args(r)); assert(r.complete); assert.equal(c.quantity[2], 0); assert.equal(c.entryCount, 1);
    await exercise(c, r, args(r)); assert.equal(c.entryCount, 1);
  });
  const hash = x => createHash('sha256').update(x).digest('hex');
  const code = Object.fromEntries(['scripts/portfolio-bracket-probe.cjs', 'scripts/portfolio-bracket-probe-tests.cjs', 'scripts/portfolio-vps-preflight.cjs']
    .map(f => [f, hash(fs.readFileSync(f))]));
  const dir = `backtests/portfolio-bracket-probe-verification/${hash(JSON.stringify(code)).slice(0, 16)}`; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/verification.json`, JSON.stringify({ code, checks: cases.length, cases, realExchangeCalls: 0 }, null, 2) + '\n');
  console.log(`portfolio bracket probe tests passed (${cases.length} cases)\n${dir}/verification.json`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
