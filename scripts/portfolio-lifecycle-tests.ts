import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MINUTE as M, TERMS, type SetupSource } from '../src/bot/portfolio/contract';
import { emptyLedger, PortfolioStore, reserveGroup, prepareOpen, applyExecution, finishOrder, prepareClose,
  validateLedger, type PortfolioLedger } from '../src/bot/portfolio/ledger';
import { dueEntrySources, readEntryPoll, sealEntryPoll, expireUnsubmittedEntries, scheduleOwnedExits, dueOwnedExits,
  type EntryPoll, type DecisionMark } from '../src/bot/portfolio/lifecycle';
import { timedExitAt } from '../src/bot/portfolio/timed-indicator-signals';
import type { PortfolioSignal } from '../src/bot/portfolio/allocation';
import type { MacdPublication } from '../src/bot/portfolio/macd-signals';

let cases = 0;
function test(name: string, fn: () => void) { try { fn(); cases++; } catch (e) { throw new Error(name, { cause: e }); } }
const close = Date.UTC(2026, 0, 1, 4), at = close + M;
const mark = (t = at): DecisionMark => ({ price: 100, priceKnownAt: t, equity: 19000, equityKnownAt: t,
  markedThrough: Math.floor(t / M) * M, feeRate: .00055 });
const signal = (source: SetupSource, t = at, id: string = source): PortfolioSignal => ({
  id, source, side: TERMS[source].side, decisionAt: t, eligibleAt: t, knownAt: t,
  expiresAt: t + 24 * 60 * M, ...(TERMS[source].bracket ? { stop: TERMS[source].side === 1 ? 90 : 110,
    target: TERMS[source].side === 1 ? 110 : 90 } : {}),
});
function poll(now = at, signals: PortfolioSignal[] = []): EntryPoll {
  return { windowAt: Math.floor(now / M) * M, observedAt: now, sources: dueEntrySources(now).map(source => {
    const found = signals.find(s => s.source === source);
    return found ? { source, status: 'signal', signal: found } : { source, status: 'no_signal' };
  }) };
}
function open(s: PortfolioLedger, src: SetupSource, id = src as string, fillAt = at + 2000, terminal = true) {
  const r = reserveGroup(s, { ...mark(), at, signals: [signal(src, at, id)] })[0].reservation!;
  prepareOpen(s, r, 2, 'o_' + id, at);
  applyExecution(s, { id: 'x_' + id, link: 'o_' + id, orderId: 'ex_' + id, at: fillAt,
    side: r.side === 1 ? 'Buy' : 'Sell', positionIdx: r.side === 1 ? 1 : 2, qty: terminal ? 2 : 1, price: 100, fee: .1 }, fillAt);
  if (terminal) finishOrder(s, 'o_' + id, 'Filled', 2, fillAt);
  return r;
}
const publication = (end: number, knownAt = end): MacdPublication => ({ sourceEnd: end, knownAt,
  previous: -1, current: 0, close: 100, crossing: false, exit: true });

test('only original minute windows; all five sources present at four-hour+one', () => {
  assert.deepEqual(dueEntrySources(close), ['R3']);
  assert.deepEqual(dueEntrySources(at + 45000), ['SF08', 'PA07', 'L2', 'R5', 'CRSI']);
  assert.deepEqual(dueEntrySources(at + M), []);
  assert.deepEqual(dueEntrySources(close + 16 * M), ['L2', 'CRSI']);
  assert.deepEqual(dueEntrySources(close + 31 * M), ['L2', 'R5', 'CRSI']);
});
test('missing policies expose unavailable, not fabricated signals', () => {
  const p = readEntryPoll(at, {}); assert.equal(p.sources.length, 5);
  assert(p.sources.every(r => r.status === 'inputs_unavailable' && !r.signal));
  const s = emptyLedger('123'); assert.equal(sealEntryPoll(s, p, mark()).status, 'sealed');
  assert.equal(Object.keys(s.reservations).length, 0);
});
test('lexical allocation seals the entire group and does not retry rejected sources', () => {
  const s = emptyLedger('123'); const ss = [signal('SF08', at, 'd'), signal('L2', at, 'c'),
    signal('R5', at, 'a'), signal('CRSI', at, 'b')];
  const result = sealEntryPoll(s, poll(at, ss), mark());
  assert.deepEqual(result.decisions.map(d => [d.id, d.reason, d.reservation?.owner]),
    [['a', 'accepted', 'setup0'], ['b', 'accepted', 'setup1'], ['c', 'accepted', 'setup2'], ['d', 'slots_occupied', undefined]]);
  assert.equal(sealEntryPoll(s, poll(at + 1, ss), mark()).status, 'already_sealed');
  assert.equal(s.decisions.length, 4);
});
test('incomplete or duplicate source groups and future poll windows are refused', () => {
  const p = poll();
  assert.throws(() => sealEntryPoll(emptyLedger('123'), { ...p, sources: p.sources.slice(1) }, mark()), /incomplete/);
  assert.throws(() => sealEntryPoll(emptyLedger('123'), { ...p, sources: [...p.sources.slice(1), p.sources[1]] }, mark()), /incomplete/);
  assert.throws(() => sealEntryPoll(emptyLedger('123'), { ...p, observedAt: at - 1 }, mark()), /window/);
});
test('pause/recovery consumes signals once rather than queues them', () => {
  const s = emptyLedger('123'); s.recovery = 'unknown_order';
  assert.equal(sealEntryPoll(s, poll(at, [signal('L2')]), mark()).decisions[0].reason, 'entries_blocked');
  s.recovery = null;
  assert.equal(sealEntryPoll(s, poll(at + 10, [signal('L2')]), mark()).status, 'already_sealed');
  assert.equal(Object.keys(s.reservations).length, 0);
});
test('decision equity/price must be known and marked through the correct completed minute', () => {
  for (const m of [{ ...mark(), equityKnownAt: at + 1 }, { ...mark(), priceKnownAt: at + 1 },
    { ...mark(), markedThrough: at - M }]) assert.throws(() => sealEntryPoll(emptyLedger('123'), poll(), m));
});
test('R3 waits for its real receipt, reserves on that clock and cannot be backdated', () => {
  const s = emptyLedger('123'); const waiting = readEntryPoll(close + 100, {});
  assert.equal(sealEntryPoll(s, waiting, mark(close)).status, 'awaiting_receipt');
  assert.equal(s.lifecycle, undefined);
  const sig = { ...signal('R3', close + 300), eligibleAt: at };
  assert.equal(sealEntryPoll(s, poll(close + 300, [sig]), mark(close + 300)).decisions[0].at, close + 300);
  assert.equal(s.reservations.R3.eligibleAt, at);
  assert.throws(() => sealEntryPoll(s, poll(close + 200), mark(close + 200)), /reversed/);
  assert.equal(sealEntryPoll(s, poll(close + 400, [sig]), mark(close + 400)).status, 'already_sealed');
});
test('expired reservations release only never-submitted requests', () => {
  const s = emptyLedger('123'); const ds = sealEntryPoll(s, poll(at, [signal('L2'), signal('R5')]), mark()).decisions;
  const r = ds.find(d => d.source === 'L2')!.reservation!; prepareOpen(s, r, 2, 'unknown', at);
  assert.deepEqual(expireUnsubmittedEntries(s, at + M - 1), []);
  assert.deepEqual(expireUnsubmittedEntries(s, at + M), ['R5']);
  assert(s.reservations.L2); assert.equal(s.orders.unknown.terminal, false);
});
test('structural exits keep the signal deadline while timed exits start from actual fill', () => {
  for (const src of ['SF08', 'PA07', 'L2', 'R5', 'CRSI', 'R3'] as const) {
    const s = emptyLedger('123'); const r = open(s, src);
    assert.deepEqual(scheduleOwnedExits(s, at + 5000).changed, [src]);
    const deadline = TERMS[src].bracket ? r.expiresAt : timedExitAt(at + 2000);
    assert.equal(s.lifecycle!.exits[src].dueAt, deadline);
    assert.equal(dueOwnedExits(s, deadline - 1).length, 0);
    assert.equal(dueOwnedExits(s, deadline)[0].qty, 2);
    assert.equal(dueOwnedExits(s, deadline + M)[0].overdueMs, M);
  }
});
test('out-of-order partial executions tighten the first-fill timeout, never extend it', () => {
  const s = emptyLedger('123'); open(s, 'L2', 'partial', at + 4000, false);
  scheduleOwnedExits(s, at + 5000); const old = s.lifecycle!.exits.partial.dueAt;
  assert.equal(dueOwnedExits(s, old)[0].unresolvedOrder, true);
  applyExecution(s, { id: 'earlier', link: 'o_partial', orderId: 'ex_partial', at: at + 1000,
    side: 'Buy', positionIdx: 1, qty: 1, price: 100, fee: .1 }, at + 6000);
  assert.equal(s.lots.partial.openedAt, at + 1000);
  scheduleOwnedExits(s, at + 6000); assert.equal(s.lifecycle!.exits.partial.dueAt, old - 3000);
  finishOrder(s, 'o_partial', 'Filled', 2, at + 6000);
  assert.equal(dueOwnedExits(s, old)[0].unresolvedOrder, false);
  assert.deepEqual(scheduleOwnedExits(s, old + M).changed, []);
});
test('late structural execution is immediately overdue, not given a new holding period', () => {
  const s = emptyLedger('123'); const late = at + 25 * 60 * M;
  const r = open(s, 'SF08', 'late_fill', late);
  scheduleOwnedExits(s, late); validateLedger(s, '123');
  assert.equal(dueOwnedExits(s, late)[0].dueAt, r.expiresAt);
  assert.equal(dueOwnedExits(s, late)[0].overdueMs, 60 * M);
});
test('MACD publications tighten once; a missing or revised feed never postpones exit', () => {
  const s = emptyLedger('123'); open(s, 'R3'); scheduleOwnedExits(s, at + 5000);
  const bar = close + 240 * M, p = publication(bar, bar + 300);
  assert.deepEqual(scheduleOwnedExits(s, bar + 299, [p]).changed, []);
  assert.deepEqual(scheduleOwnedExits(s, bar + 400, [p]).changed, ['R3']);
  assert.equal(s.lifecycle!.exits.R3.dueAt, bar + 300 + M);
  assert.deepEqual(scheduleOwnedExits(s, bar + 500, []).changed, []);
  assert.deepEqual(scheduleOwnedExits(s, bar + 600, [publication(bar, bar + 200)]).changed, []);
  assert.equal(s.lifecycle!.exits.R3.recordedAt, bar + 400);
});
test('bad indicator telemetry reports error but still schedules MACD timeout', () => {
  const s = emptyLedger('123'); open(s, 'R3'); s.recovery = 'entry_feed_unavailable';
  const result = scheduleOwnedExits(s, at + 5000, [publication(close + 1)]);
  assert.match(result.indicatorError!, /publication/);
  assert.equal(s.lifecycle!.exits.R3.reason, 'timeout');
  assert.equal(dueOwnedExits(s, timedExitAt(at + 2000)).length, 1);
});
test('close pending remains owned; partial close updates due quantity; completed close disappears', () => {
  const s = emptyLedger('123'); open(s, 'L2'); scheduleOwnedExits(s, at + 5000);
  const due = s.lifecycle!.exits.L2.dueAt;
  prepareClose(s, { owner: 'setup0', link: 'close', at: due, reason: 'timeout', allocations: [{ lotId: 'L2', qty: 2 }] });
  assert.equal(dueOwnedExits(s, due)[0].unresolvedOrder, true);
  const f = { id: 'c1', link: 'close', orderId: 'ex_close', at: due, side: 'Sell' as const, positionIdx: 1 as const, qty: 1, price: 101, fee: .1 };
  applyExecution(s, f, due); assert.equal(dueOwnedExits(s, due)[0].qty, 1);
  applyExecution(s, { ...f, id: 'c2' }, due); finishOrder(s, 'close', 'Filled', 2, due);
  assert.deepEqual(dueOwnedExits(s, due), []); assert(s.lifecycle!.exits.L2);
});
test('new owner cannot inherit old lot exit and main exits are left untouched', () => {
  const s = emptyLedger('123');
  s.lots.main = { id: 'main', owner: 'main', source: 'main', side: 1, qty: 1, cost: 100, entryFees: 0, openedAt: at };
  assert.deepEqual(scheduleOwnedExits(s, at).changed, []);
  open(s, 'L2'); scheduleOwnedExits(s, at + 5000);
  s.lifecycle!.exits.L2.owner = 'setup1'; assert.throws(() => scheduleOwnedExits(s, at + 6000), /mismatch/);
});
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-lifecycle-'));
test('atomic restart retains rejected signals, reservations and actual-fill deadlines', () => {
  const file = path.join(temp, 'state.json'); const store = new PortfolioStore(file, '123');
  store.transaction(s => { open(s, 'R3'); scheduleOwnedExits(s, at + 5000); });
  const deadline = store.snapshot.lifecycle!.exits.R3.dueAt;
  const restarted = new PortfolioStore(file, '123');
  restarted.transaction(s => scheduleOwnedExits(s, deadline + 3 * M));
  assert.equal(restarted.snapshot.lifecycle!.exits.R3.dueAt, deadline);
  assert.equal(dueOwnedExits(restarted.snapshot, deadline + 3 * M)[0].overdueMs, 3 * M);
  const other = new PortfolioStore(path.join(temp, 'entries.json'), '123');
  other.transaction(s => sealEntryPoll(s, poll(at, [signal('L2')]), { ...mark(), entriesBlocked: true }));
  const again = new PortfolioStore(other.file, '123');
  again.transaction(s => sealEntryPoll(s, poll(at + 5000, [signal('L2')]), mark()));
  assert.equal(again.snapshot.decisions.length, 1);
});
test('failed scheduling write cannot publish memory state or permit retry before restart', () => {
  const store = new PortfolioStore(path.join(temp, 'fail.json'), '123', () => { throw new Error('disk full'); });
  assert.throws(() => store.transaction(s => sealEntryPoll(s, poll(at, [signal('L2')]), mark())), /durable write/);
  assert.equal(store.snapshot.lifecycle, undefined);
  assert.throws(() => store.transaction(() => {}), /restart required/);
});
test('malformed optional scheduling state is rejected on validation', () => {
  const s = emptyLedger('123'); open(s, 'L2'); scheduleOwnedExits(s, at + 5000); validateLedger(s, '123');
  s.lifecycle!.exits.L2.owner = 'main'; assert.throws(() => validateLedger(s, '123'), /schedule/);
});
console.log(JSON.stringify({ passed: true, cases, tempEvidence: temp, exchangeCalls: 0 }));
