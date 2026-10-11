import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { MINUTE as M, TERMS, releaseAt, type Owner, type SetupSource } from '../src/bot/portfolio/contract';
import { allocateGroup, type PortfolioSignal, type Reservation } from '../src/bot/portfolio/allocation';
import { decisionReserves, fillReserves } from '../src/bot/portfolio/capital';
import { PortfolioStore, emptyLedger, reserveGroup, prepareOpen, prepareClose, applyExecution, finishOrder,
  ownedTotals, ownerPosition, occupancy, reconcile, cancelUnsubmittedReservation,
  type PortfolioLedger, type Execution } from '../src/bot/portfolio/ledger';

let checks = 0;
function test(name: string, run: () => void) { try { run(); checks++; } catch (e) { throw new Error(name, { cause: e }); } }
const at = Date.UTC(2026, 0, 1);
const signal = (source: SetupSource, id = source as string, t = at): PortfolioSignal => ({
  id, source, side: TERMS[source].side, decisionAt: t, eligibleAt: t, knownAt: t,
  expiresAt: t + 24 * 3600000, ...(TERMS[source].bracket ? { stop: TERMS[source].side === 1 ? 90 : 110,
    target: TERMS[source].side === 1 ? 110 : 90 } : {}),
});
const frame = { at, price: 100, priceKnownAt: at, equity: 19_000, heldMargin: 0, feeRate: .00055, occupied: [], pending: [] };
function reserve(s: PortfolioLedger, src: SetupSource, id: string, t = at): Reservation {
  return reserveGroup(s, { ...frame, at: t, signals: [signal(src, id, t)] })[0].reservation!;
}
function entry(s: PortfolioLedger, src: SetupSource, id: string, t = at, qty = 2): void {
  const r = reserve(s, src, id, t); prepareOpen(s, r, qty, 'open_' + id, t);
  applyExecution(s, { id: 'exec_' + id, link: 'open_' + id, orderId: 'ex_' + id, at: t,
    side: r.side === 1 ? 'Buy' : 'Sell', positionIdx: r.side === 1 ? 1 : 2, qty, price: 100, fee: 1 }, t);
  finishOrder(s, 'open_' + id, 'Filled', qty, t);
}
if (process.argv[2] === '--crash-child') {
  const store = new PortfolioStore(process.argv[3], '123');
  if (process.argv[4] === 'intent') store.transaction(s => { const r = reserve(s, 'L2', 'crash'); prepareOpen(s, r, 2, 'crash_open', at); });
  else store.transaction(s => applyExecution(s, { id: 'crash_exec', link: 'crash_open', orderId: 'ex_crash', at,
    side: 'Buy', positionIdx: 1, qty: 2, price: 100, fee: 1 }, at));
  process.exit(73);
}
test('lowest slots and lexical tie; opposite sides coexist', () => {
  const ds = allocateGroup({ ...frame, signals: [signal('L2', 'b'), signal('R5', 'a'), signal('CRSI', 'c'), signal('SF08', 'd')] });
  assert.deepEqual(ds.map(d => [d.id, d.reason, d.reservation?.owner]),
    [['a', 'accepted', 'setup0'], ['b', 'accepted', 'setup1'], ['c', 'accepted', 'setup2'], ['d', 'slots_occupied', undefined]]);
});
test('one slot per source', () => {
  const ds = allocateGroup({ ...frame, signals: [signal('L2', 'a'), signal('L2', 'b')] });
  assert.equal(ds[1].reason, 'source_occupied');
});
test('MACD independent of three occupied slots', () => {
  const ds = allocateGroup({ ...frame, signals: [signal('L2'), signal('R5'), signal('CRSI'), signal('R3')] });
  assert.equal(ds.filter(d => d.reason === 'accepted').length, 4);
  assert.equal(ds.find(d => d.source === 'R3')!.reservation!.owner, 'R3');
});
test('capital counts earlier reservations', () => {
  const ds = allocateGroup({ ...frame, equity: 4000, signals: [signal('L2'), signal('CRSI')] });
  assert.deepEqual(ds.map(d => d.reason), ['accepted', 'shared_capital']);
});
test('NaN cannot approve; future feature cannot enter', () => {
  assert.throws(() => allocateGroup({ ...frame, equity: NaN, signals: [signal('L2')] }));
  assert.throws(() => allocateGroup({ ...frame, signals: [{ ...signal('L2'), knownAt: at + 1 }] }));
  assert.throws(() => allocateGroup({ ...frame, priceKnownAt: at + 1, signals: [] }));
});
test('bad side, bracket, duplicate and timestamps rejected', () => {
  for (const s of [{ ...signal('L2'), side: -1 }, { ...signal('L2'), stop: 90 },
    { ...signal('SF08'), target: 80 }, { ...signal('R3'), eligibleAt: at - M }])
    assert.throws(() => allocateGroup({ ...frame, signals: [s as PortfolioSignal] }));
  assert.throws(() => allocateGroup({ ...frame, signals: [signal('L2'), signal('L2')] }));
});
test('remaining collateral and stop-risk reserves retained', () => {
  const request = { owner: 'setup0' as Owner, side: 1 as const, requestedNotional: 6000, decisionPrice: 100, stop: 30 };
  assert.deepEqual(decisionReserves(1000, [request]), { required: 3012, reserve: 5500 });
  assert.deepEqual(fillReserves(3000, [{ ...request, qty: 60, price: 100 }]), { fillRequired: 3012, fillReserve: 5500 });
});
test('receipt-based release source semantics', () => {
  assert.equal(releaseAt('SF08', 'timeout', at, at), at + M);
  assert.equal(releaseAt('PA07', 'timeout', at, at), at);
  assert.equal(releaseAt('PA07', 'stop', at + 7, at + 10), at + M);
  assert.equal(releaseAt('L2', 'timeout', at, at + 90000), at + 90000);
  assert.throws(() => releaseAt('R3', 'timeout', at, at - 1));
});
test('decision persistence consumes skipped signals; no same-clock recycle', () => {
  const s = emptyLedger('123'); reserveGroup(s, { ...frame, signals: [signal('L2')], entriesBlocked: true });
  assert.equal(s.decisions[0].reason, 'entries_blocked');
  assert.throws(() => reserveGroup(s, { ...frame, signals: [signal('L2')] }));
  assert.throws(() => reserveGroup(s, { ...frame, at: at + M, signals: [signal('L2', 'L2', at + M)] }));
});
test('delayed MACD request holds owner and money across restart boundary', () => {
  const s = emptyLedger('123');
  reserveGroup(s, { ...frame, signals: [{ ...signal('R3'), eligibleAt: at + M }] });
  assert.equal(occupancy(s, at)[0].owner, 'R3');
  assert.equal(Object.values(s.reservations)[0].requestedNotional, 10000);
  assert.equal(reserveGroup(s, { ...frame, at: at + M, signals: [signal('R3', 'later', at + M)] })[0].reason, 'source_occupied');
});
test('partial entry, duplicate receipt, terminal evidence', () => {
  const s = emptyLedger('123'), r = reserve(s, 'L2', 'one'); prepareOpen(s, r, 2, 'o1', at);
  const f: Execution = { id: 'x1', link: 'o1', orderId: 'b1', at, side: 'Buy', positionIdx: 1, qty: 1, price: 100, fee: .1 };
  applyExecution(s, f, at); applyExecution(s, f, at);
  assert.equal(ownedTotals(s).longQty, 1); assert.equal(s.fees, .1);
  assert.throws(() => finishOrder(s, 'o1', 'Filled', 2, at));
  assert.throws(() => applyExecution(s, { ...f, fee: .2 }, at));
  assert.equal(Object.keys(s.reservations).length, 1);
  finishOrder(s, 'o1', 'Cancelled', 1, at); assert.equal(Object.keys(s.reservations).length, 0);
  assert.equal(occupancy(s, at)[0].source, 'L2');
});
test('unknown fill and wrong position side never attributed', () => {
  const s = emptyLedger('123'), r = reserve(s, 'L2', 'one'); prepareOpen(s, r, 2, 'o1', at);
  const f: Execution = { id: 'x1', link: 'o1', orderId: 'b1', at, side: 'Buy', positionIdx: 2, qty: 1, price: 100, fee: .1 };
  assert.throws(() => applyExecution(s, f, at));
  assert.throws(() => applyExecution(s, { ...f, link: 'unknown' }, at));
  assert.equal(ownedTotals(s).longQty, 0);
});
test('no catch-up entry and no local cancellation of ambiguous submission', () => {
  const s = emptyLedger('123'), r = reserve(s, 'L2', 'one');
  assert.throws(() => prepareOpen(s, r, 2, 'o1', at + M));
  assert.throws(() => cancelUnsubmittedReservation(s, r.id, at, 'expired'));
  prepareOpen(s, r, 2, 'o1', at);
  assert.throws(() => cancelUnsubmittedReservation(s, r.id, at + M, 'expired'));
  const clean = emptyLedger('123'), r2 = reserve(clean, 'L2', 'other');
  cancelUnsubmittedReservation(clean, r2.id, at + M, 'expired');
  assert.equal(occupancy(clean, at + M).length, 0); assert.equal(clean.cancelledReservations.other.reason, 'expired');
});
test('a close cannot consume another strategy inventory', () => {
  const s = emptyLedger('123'); entry(s, 'L2', 'long'); entry(s, 'CRSI', 'second', at + M);
  assert.throws(() => prepareClose(s, { owner: 'setup0', link: 'bad', at: at + M,
    reason: 'timeout', allocations: [{ lotId: 'second', qty: 1 }] }));
  prepareClose(s, { owner: 'setup0', link: 'c1', at: at + M, reason: 'timeout', allocations: [{ lotId: 'long', qty: 2 }] });
  applyExecution(s, { id: 'close', link: 'c1', orderId: 'bc', at: at + M, side: 'Sell', positionIdx: 1, qty: 2, price: 105, fee: 1 }, at + M);
  assert.equal(s.realizedBeforeFunding, 8); assert.equal(s.lots.second.qty, 2);
  assert.equal(ownedTotals(s).longQty, 2);
  assert(occupancy(s, at + M).some(p => p.owner === 'setup0'), 'terminal evidence still required');
  finishOrder(s, 'c1', 'Filled', 2, at + M);
  assert(!occupancy(s, at + M).some(p => p.owner === 'setup0'));
});
test('short accounting, partial closes and negative maker fees', () => {
  const s = emptyLedger('123'); entry(s, 'R3', 'short');
  prepareClose(s, { owner: 'R3', link: 'c1', at: at + M, reason: 'timeout', allocations: [{ lotId: 'short', qty: 1 }] });
  applyExecution(s, { id: 'xc', link: 'c1', orderId: 'bc', at: at + M, side: 'Buy', positionIdx: 2, qty: 1, price: 90, fee: -.1 }, at + M);
  finishOrder(s, 'c1', 'Filled', 1, at + M);
  assert.equal(s.realizedBeforeFunding, 9.6); assert.equal(s.lots.short.qty, 1); assert.equal(s.lots.short.cost, 100);
});
test('strategy cost basis excludes other owners', () => {
  const s = emptyLedger('123'); entry(s, 'L2', 'one');
  const r = reserve(s, 'CRSI', 'two', at + M); prepareOpen(s, r, 1, 'o2', at + M);
  applyExecution(s, { id: 'x2', link: 'o2', orderId: 'b2', at: at + M, side: 'Buy', positionIdx: 1, qty: 1, price: 130, fee: .1 }, at + M);
  assert.equal(ownerPosition(s, 'setup0').averageEntry, 100); assert.equal(ownerPosition(s, 'setup1').averageEntry, 130);
  assert.equal(ownedTotals(s).longQty, 3);
});
test('reconciliation handles both sides and will not clear a prior incident', () => {
  const s = emptyLedger('123'); entry(s, 'L2', 'one');
  assert.equal(reconcile(s, { uid: '123', symbol: 'HYPEUSDT', longQty: 2, shortQty: 3, openLinks: [] }), 'aggregate_inventory_mismatch');
  assert.equal(reconcile(s, { uid: '123', symbol: 'HYPEUSDT', longQty: 2, shortQty: 0, openLinks: [] }), null);
  assert.equal(s.recovery, 'aggregate_inventory_mismatch');
  assert.throws(() => reconcile(s, { uid: '123', symbol: 'HYPEUSDT', longQty: 2, shortQty: 0, openLinks: [] }, NaN));
});
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-foundation-'));
test('durable intent and receipt survive restart and replay once', () => {
  const file = path.join(temp, 'restart.json'), st = new PortfolioStore(file, '123');
  st.transaction(s => { const r = reserve(s, 'L2', 'one'); prepareOpen(s, r, 2, 'o1', at); });
  const restarted = new PortfolioStore(file, '123'); assert.equal(restarted.snapshot.orders.o1.terminal, false);
  const f: Execution = { id: 'x', link: 'o1', orderId: 'bx', at, side: 'Buy', positionIdx: 1, qty: 2, price: 100, fee: 1 };
  restarted.transaction(s => { applyExecution(s, f, at); finishOrder(s, 'o1', 'Filled', 2, at); });
  const again = new PortfolioStore(file, '123'); again.transaction(s => applyExecution(s, f, at));
  assert.equal(again.snapshot.lots.one.qty, 2); assert.equal(again.snapshot.fees, 1);
  assert.throws(() => new PortfolioStore(file, '456'));
  const copy = again.snapshot; copy.lots.one.qty = 99; assert.equal(again.snapshot.lots.one.qty, 2);
});
test('persistence failure poisons store and never publishes memory mutation', () => {
  const st = new PortfolioStore(path.join(temp, 'fail.json'), '123', () => { throw new Error('disk full'); });
  assert.throws(() => st.transaction(s => { s.recovery = 'test'; }), /durable write/);
  assert.equal(st.snapshot.recovery, null);
  assert.throws(() => st.transaction(() => {}), /restart required/);
});
test('malformed state cannot start fresh', () => {
  const file = path.join(temp, 'corrupt.json'); fs.writeFileSync(file, '{');
  assert.throws(() => new PortfolioStore(file, '123'));
  const state = emptyLedger('123'); state.sequence = -1;
  fs.writeFileSync(file, JSON.stringify({ state, sha256: createHash('sha256').update(JSON.stringify(state)).digest('hex') }));
  assert.throws(() => new PortfolioStore(file, '123'));
});
test('callback cannot mutate committed state after the save', () => {
  const st = new PortfolioStore(path.join(temp, 'alias.json'), '123'); let escaped: PortfolioLedger | null = null;
  st.transaction(s => { escaped = s; });
  (escaped as unknown as PortfolioLedger).recovery = 'unsaved'; assert.equal(st.snapshot.recovery, null);
});
test('real child-process death at intent and receipt boundaries', () => {
  const file = path.join(temp, 'crash.json');
  for (const phase of ['intent', 'execution']) {
    const child = spawnSync(process.execPath, ['-r', 'ts-node/register', __filename, '--crash-child', file, phase],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 30000, windowsHide: true });
    assert.equal(child.status, 73, child.stderr);
    const saved = new PortfolioStore(file, '123').snapshot;
    assert.equal(saved.orders.crash_open.terminal, false);
    assert.equal(saved.orders.crash_open.appliedQty, phase === 'intent' ? 0 : 2);
  }
  const restarted = new PortfolioStore(file, '123');
  restarted.transaction(s => {
    applyExecution(s, { id: 'crash_exec', link: 'crash_open', orderId: 'ex_crash', at,
      side: 'Buy', positionIdx: 1, qty: 2, price: 100, fee: 1 }, at);
    finishOrder(s, 'crash_open', 'Filled', 2, at);
  });
  assert.equal(restarted.snapshot.lots.crash.qty, 2); assert.equal(restarted.snapshot.fees, 1);
});
console.log(JSON.stringify({ passed: true, cases: checks, tempEvidence: temp, exchangeCalls: 0 }));
