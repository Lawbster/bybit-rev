import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { FakeExchange, seed, clean, T, UID } from './portfolio-execution-tests';
import { PortfolioExecutionCoordinator as Coordinator } from '../src/bot/portfolio/execution-coordinator';
import { attachedBracketCommand, attachedEntryPayload } from '../src/bot/portfolio/attached-bracket';
import { childOpenKey, childTerminal, type BracketChild, type BracketEvidence } from '../src/bot/portfolio/bracket-state';
import { validateCommand, type PortfolioOrderCommand } from '../src/bot/portfolio/order-command';
import { occupancy, ownerPosition } from '../src/bot/portfolio/ledger';
import { MINUTE as M, type SetupSource } from '../src/bot/portfolio/contract';

/** Models receipt races, NOT proof of the venue's OCO/binding behaviour. */
class PairedExchange extends FakeExchange {
  children: BracketChild[] = [];
  complete = true;
  cancelled: string[] = [];
  autoCancel = false;
  changeChildren?: (e: BracketEvidence) => void;
  onChildCancel?: (id: string) => void;
  constructor(clock: () => number, disk?: string) {
    super(clock, disk);
    if (disk && fs.existsSync(disk + '.children')) this.children = JSON.parse(fs.readFileSync(disk + '.children', 'utf8'));
  }
  protected save() {
    super.save();
    if (this.disk && this.children) fs.writeFileSync(this.disk + '.children', JSON.stringify(this.children));
  }
  async observe(c: PortfolioOrderCommand) {
    const e = await super.observe(c);
    if (e.found && c.bracket) e.bracket = structuredClone(c.bracket);
    return e;
  }
  async snapshot() {
    const e = await super.snapshot();
    e.openLinks.push(...this.children.filter(c => !childTerminal(c)).map(c => childOpenKey(c.orderId)));
    return e;
  }
  createPair(parent: string) {
    const c = this.commands.find(c => c.link === parent)!, qty = this.orders.get(parent)!.cumulativeQty;
    assert(c.bracket && qty > 0);
    for (const kind of ['tp', 'sl'] as const) this.children.push({
      orderId: `${parent}_${kind}`, parentOrderLinkId: parent, kind, side: c.side === 'Buy' ? 'Sell' : 'Buy',
      positionIdx: c.positionIdx, mode: 'Partial', orderType: 'Market', reduceOnly: true,
      triggerBy: 'LastPrice', triggerDirection: (kind === 'tp') === (c.positionIdx === 1) ? 1 : 2,
      price: kind === 'tp' ? c.bracket!.target : c.bracket!.stop, qty, cumulativeQty: 0, status: 'Untriggered', executions: [],
    });
    this.save();
  }
  child(parent: string, kind: 'tp' | 'sl') { return this.children.find(c => c.parentOrderLinkId === parent && c.kind === kind)!; }
  childFill(parent: string, kind: 'tp' | 'sl', qty?: number) {
    const c = this.child(parent, kind); qty ??= c.qty - c.cumulativeQty;
    assert(qty > 0 && qty <= c.qty - c.cumulativeQty + 1e-8);
    c.executions.push({ id: `${c.orderId}_${c.executions.length}`, link: parent, orderId: c.orderId,
      at: this.clock(), side: c.side, positionIdx: c.positionIdx, qty, price: Number(c.price), fee: qty * Number(c.price) * .00055 });
    c.cumulativeQty += qty; c.status = c.qty - c.cumulativeQty < 1e-8 ? 'Filled' : 'PartiallyFilled';
    if (c.positionIdx === 1) this.longQty -= qty; else this.shortQty -= qty;
    this.save();
  }
  attached = {
    observe: async (parent: Readonly<PortfolioOrderCommand>, knownIds: readonly string[]): Promise<BracketEvidence> => {
      const e: BracketEvidence = { uid: UID, symbol: 'HYPEUSDT', parentLink: parent.link, observedAt: this.clock(), complete: this.complete,
        children: structuredClone(this.children.filter(c => c.parentOrderLinkId === parent.link || knownIds.includes(c.orderId))) };
      this.changeChildren?.(e); return e;
    },
    cancel: async (_parent: Readonly<PortfolioOrderCommand>, id: string) => {
      this.cancelled.push(id); this.onChildCancel?.(id);
      const c = this.children.find(c => c.orderId === id)!;
      if (this.autoCancel && !childTerminal(c)) c.status = 'Cancelled';
      this.save();
    },
  };
}
export function fixture(directory?: string, disk = false) {
  const dir = directory ?? fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-execution-'));
  let now = T, allowed = true;
  const ex = new PairedExchange(() => now, disk ? path.join(dir, 'exchange.json') : undefined);
  const args = { file: path.join(dir, 'state.json'), lockDirectory: path.join(dir, 'locks'), uid: UID, port: ex,
    options: { clock: () => now, entriesAllowed: () => allowed, exchangeLeverage: 3, feeRate: .00055 } };
  let c = Coordinator.acquire(args);
  return { dir, ex, args, get c() { return c; }, time(t: number) { now = t; }, pause() { allowed = false; },
    restart() { c.shutdown(); c = Coordinator.acquire(args); },
    async entry(source: SetupSource, id = source as string) {
      seed(c.store, source, now, id); const r = await c.open(id); assert.equal(r.state, 'submitted');
      ex.fill(r.link!); if (source === 'SF08' || source === 'PA07') ex.createPair(r.link!);
      assert.equal((await c.maintain()).issue, null); return r.link!;
    }, cleanup() { c.shutdown(); clean(dir); } };
}
const cases: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); cases.push(name); } catch (e) { throw new Error(name, { cause: e }); }
}
async function crashChild() {
  const dir = process.argv[3], mode = process.argv[4], f = fixture(dir, true);
  if (mode === 'entry') {
    f.ex.onSubmit = c => { f.ex.fill(c.link); f.ex.createPair(c.link); process.exit(73); };
    seed(f.c.store, 'SF08', T); await f.c.open('SF08');
  } else {
    const link = await f.entry('SF08'); f.time(T + M); await f.entry('CRSI');
    await f.c.requestExit('setup0', 'timeout');
    f.ex.onChildCancel = id => { if (id.endsWith('_tp')) { f.ex.childFill(link, 'tp', 10); process.exit(73); } };
    await f.c.maintain();
  }
  throw new Error('crash hook did not run');
}
async function main() {
  if (process.argv[2] === '--crash-child') return crashChild();
  await test('payload is attached Partial on entry; outward ticks; no Full or standalone siblings', () => {
    const base: PortfolioOrderCommand = { version: 1, uid: UID, symbol: 'HYPEUSDT', at: T, link: 'parent',
      orderType: 'Market', side: 'Buy', positionIdx: 1, qty: '10.00', reduceOnly: false };
    const c = attachedBracketCommand(base, 90.005, 110.005, .01, 100, 100.01);
    assert.equal(c.bracket!.stop, '90'); assert.equal(c.bracket!.target, '110.01');
    const payload = attachedEntryPayload(c);
    assert.equal(payload.tpslMode, 'Partial'); assert.equal(payload.orderLinkId, 'parent'); assert.equal(payload.qty, '10.00');
    assert(!('tpSize' in payload) && !('leverage' in payload) && !('triggerPrice' in payload));
    assert.throws(() => validateCommand({ ...c, bracket: { ...c.bracket!, mode: 'Full' as any } }));
    assert.throws(() => validateCommand({ ...c, reduceOnly: true }));
    assert.throws(() => attachedBracketCommand(base, 101, 110, .01, 100, 100.01));
    assert.throws(() => attachedBracketCommand(base, 90, 99, .01, 100, 100.01));
    const short = attachedBracketCommand({ ...base, side: 'Sell', positionIdx: 2 }, 110.005, 90.005, .01, 100, 100.01);
    assert.equal(short.bracket!.stop, '110.01'); assert.equal(short.bracket!.target, '90');
  });
  await test('parent plus bracket journal saved before send; unchanged heartbeats do not rewrite', async () => {
    const f = fixture(); try {
      f.ex.onSubmit = c => {
        const saved = JSON.parse(fs.readFileSync(f.args.file, 'utf8')).state;
        assert.deepEqual(saved.orders[c.link].command, c); assert(saved.brackets[c.link]);
      };
      await f.entry('SF08'); const seq = f.c.store.snapshot.sequence;
      await f.c.maintain(); await f.c.maintain(); assert.equal(f.c.store.snapshot.sequence, seq);
      assert.throws(() => f.c.store.transaction(s => { s.brackets = {}; }));
    } finally { f.cleanup(); }
  });
  await test('two attached owners coexist; SF08 TP cannot consume CRSI long or PA07 short', async () => {
    const f = fixture(); try {
      const sf = await f.entry('SF08'); f.time(T + M); await f.entry('CRSI'); f.time(T + 2 * M); await f.entry('PA07');
      const before = f.c.store.snapshot;
      f.ex.childFill(sf, 'tp'); f.ex.child(sf, 'sl').status = 'Cancelled';
      await f.c.maintain(); const after = f.c.store.snapshot;
      assert(!after.lots.SF08); assert.deepEqual(after.lots.CRSI, before.lots.CRSI); assert.deepEqual(after.lots.PA07, before.lots.PA07);
      assert(after.realizedBeforeFunding > 600); assert.equal(after.brackets![sf].completedAt, T + 2 * M);
      assert.equal(after.sourceAfter.SF08, T + 3 * M);
      const seq = after.sequence; await f.c.maintain(); assert.equal(f.c.store.snapshot.sequence, seq);
    } finally { f.cleanup(); }
  });
  await test('PA07 SL owns short quantity, not independent R3 inventory', async () => {
    const f = fixture(); try {
      const pa = await f.entry('PA07'); f.time(T + M); await f.entry('R3'); const r3 = f.c.store.snapshot.lots.R3;
      f.ex.childFill(pa, 'sl'); f.ex.child(pa, 'tp').status = 'Cancelled'; await f.c.maintain();
      assert.deepEqual(f.c.store.snapshot.lots.R3, r3); assert(!f.c.store.snapshot.lots.PA07);
      assert(f.c.store.snapshot.realizedBeforeFunding < -600);
    } finally { f.cleanup(); }
  });
  await test('partial entry gets actual filled bracket size and retains other reservations', async () => {
    const f = fixture(); try {
      seed(f.c.store, 'SF08', T); const r = await f.c.open('SF08');
      f.ex.fill(r.link!, 12); f.ex.terminal(r.link!, 'Cancelled'); f.ex.createPair(r.link!);
      assert.equal((await f.c.maintain()).resting, 2); assert.equal(f.c.store.snapshot.lots.SF08.qty, 12);
      assert(!f.c.store.snapshot.reservations.SF08);
    } finally { f.cleanup(); }
  });
  await test('missing child, missing receipt and truncated discovery never certify protection', async () => {
    for (const mode of ['missing_child', 'missing_receipt', 'incomplete']) {
      const f = fixture(); try {
        const link = await f.entry('SF08'), before = f.c.store.snapshot;
        if (mode === 'missing_receipt') f.ex.childFill(link, 'tp', 1);
        f.ex.changeChildren = e => {
          if (mode === 'missing_child') e.children.pop();
          if (mode === 'missing_receipt') e.children[0].executions = [];
          if (mode === 'incomplete') e.complete = false;
        };
        const r = await f.c.maintain(); assert.equal(r.resting, 0); assert(r.issue);
        assert.deepEqual(f.c.store.snapshot.lots, before.lots); assert.equal(f.c.store.snapshot.recovery, null);
      } finally { f.cleanup(); }
    }
  });
  await test('wrong parent, side, prices, mode, duplicated legs or overlarge child fail closed', async () => {
    const changes: ((e: BracketEvidence) => void)[] = [e => { e.parentLink = 'wrong'; },
      e => { e.children[0].parentOrderLinkId = 'wrong'; }, e => { e.children[0].positionIdx = 2; },
      e => { e.children[0].price = '111'; }, e => { e.children[0].mode = 'Full' as any; },
      e => { e.children[1].kind = 'tp'; }, e => { e.children[0].qty = 999; },
      e => { e.children.push(structuredClone(e.children[0])); }];
    for (const change of changes) {
      const f = fixture(); try {
        await f.entry('SF08'); const before = f.c.store.snapshot.lots; f.ex.changeChildren = change;
        await assert.rejects(() => f.c.maintain()); assert.deepEqual(f.c.store.snapshot.lots, before);
        assert.equal(f.c.store.snapshot.recovery, 'attached_protection_evidence_invalid');
      } finally { f.cleanup(); }
    }
  });
  await test('cancel acknowledgement is not sibling proof; timeout cannot double-close', async () => {
    const f = fixture(); try {
      const link = await f.entry('SF08'); f.pause(); await f.c.requestExit('setup0', 'timeout');
      await f.c.maintain(); assert.equal(f.ex.cancelled.length, 2); assert.equal(f.ex.commands.length, 1);
      f.ex.child(link, 'tp').status = 'Cancelled'; await f.c.maintain(); assert.equal(f.ex.commands.length, 1);
      f.ex.childFill(link, 'sl'); await f.c.maintain();
      assert.equal(f.ex.commands.length, 1); assert(!f.c.store.snapshot.lots.SF08);
      assert(f.c.store.snapshot.exitRequests!.setup0!.completedAt);
    } finally { f.cleanup(); }
  });
  await test('partial racing target closes ONLY remaining owned quantity after both cancellations', async () => {
    const f = fixture(); try {
      const link = await f.entry('SF08'); f.time(T + M); await f.entry('CRSI'); const aux = f.c.store.snapshot.lots.CRSI;
      await f.c.requestExit('setup0', 'timeout'); f.ex.autoCancel = true;
      f.ex.onChildCancel = id => { if (id === f.ex.child(link, 'tp').orderId) { f.ex.childFill(link, 'tp', 10); f.ex.onChildCancel = undefined; } };
      await f.c.maintain(); assert.equal(f.ex.commands.at(-1)!.qty, '56.66');
      f.ex.fill(f.ex.commands.at(-1)!.link); await f.c.maintain();
      assert.deepEqual(f.c.store.snapshot.lots.CRSI, aux); assert(!f.c.store.snapshot.lots.SF08);
      assert.equal(f.ex.commands.length, 3);
    } finally { f.cleanup(); }
  });
  await test('partial TP automatically retires sibling before residual; restart keeps request', async () => {
    const f = fixture(); try {
      const link = await f.entry('SF08'); f.ex.childFill(link, 'tp', 10);
      await f.c.maintain(); assert.equal(f.c.store.snapshot.exitRequests!.setup0!.reason, 'target');
      assert.equal(f.ex.commands.length, 1); f.restart(); f.ex.autoCancel = true;
      await f.c.maintain(); assert.equal(f.ex.commands.at(-1)!.qty, '56.66');
      f.ex.fill(f.ex.commands.at(-1)!.link); await f.c.maintain(); assert(!f.c.store.snapshot.lots.SF08);
    } finally { f.cleanup(); }
  });
  await test('flat inventory with active sibling still owns its slot and blocks new entries', async () => {
    const f = fixture(); try {
      const link = await f.entry('SF08'); f.ex.childFill(link, 'tp'); await f.c.maintain();
      f.time(T + 2 * M); assert(occupancy(f.c.store.snapshot, T + 2 * M).some(o => o.owner === 'setup0'));
      seed(f.c.store, 'CRSI', T + 2 * M); assert.equal((await f.c.open('CRSI')).state, 'blocked');
      assert.equal(f.ex.commands.length, 1); f.ex.autoCancel = true; await f.c.maintain();
      assert.equal((await f.c.open('CRSI')).state, 'submitted');
    } finally { f.cleanup(); }
  });
  await test('both legs filling cannot be charged to another owner', async () => {
    const f = fixture(); try {
      const link = await f.entry('SF08'); f.time(T + M); await f.entry('CRSI'); const before = f.c.store.snapshot;
      f.ex.childFill(link, 'tp'); f.ex.childFill(link, 'sl');
      await assert.rejects(() => f.c.maintain(), /paired fills/);
      assert.deepEqual(f.c.store.snapshot.lots, before.lots); assert(f.c.store.snapshot.recovery);
    } finally { f.cleanup(); }
  });
  await test('changed historical receipt and missing terminal child never silently release', async () => {
    const f = fixture(); try {
      const link = await f.entry('SF08'); f.ex.childFill(link, 'tp', 10); await f.c.maintain();
      const before = f.c.store.snapshot;
      f.ex.changeChildren = e => { e.children[0].executions[0].fee += 1; };
      await assert.rejects(() => f.c.maintain(), /conflicting/); assert.deepEqual(f.c.store.snapshot.lots, before.lots);
    } finally { f.cleanup(); }
  });
  await test('entry rejection with zero fill retires empty bracket; no fake protection', async () => {
    const f = fixture(); try {
      seed(f.c.store, 'SF08', T); const r = await f.c.open('SF08'); f.ex.terminal(r.link!, 'Rejected');
      await f.c.maintain(); assert.equal(f.c.store.snapshot.brackets![r.link!].completedAt, T);
      assert.equal(Object.keys(f.c.store.snapshot.lots).length, 0);
    } finally { f.cleanup(); }
  });
  await test('parent receipt lag blocks child attribution without latching a false overfill', async () => {
    const f = fixture(); try {
      seed(f.c.store, 'SF08', T); const r = await f.c.open('SF08'); f.ex.fill(r.link!); f.ex.createPair(r.link!);
      f.ex.incomplete = true; await f.c.maintain(); assert.equal(Object.keys(f.c.store.snapshot.lots).length, 0);
      assert.equal(f.c.store.snapshot.recovery, null); f.ex.incomplete = false;
      assert.equal((await f.c.maintain()).resting, 2);
    } finally { f.cleanup(); }
  });
  await test('stale evidence and unknown extra exchange children block account mutation', async () => {
    const f = fixture(); try {
      const link = await f.entry('SF08'); f.time(T + M);
      f.ex.changeChildren = e => { e.observedAt = T; }; await assert.rejects(() => f.c.maintain(), /stale/);
      f.ex.changeChildren = undefined;
      const extra = structuredClone(f.ex.child(link, 'tp')); extra.orderId = 'unowned'; extra.parentOrderLinkId = 'manual'; f.ex.children.push(extra);
      assert.equal((await f.c.maintain()).issue, 'unowned_open_order');
    } finally { f.cleanup(); }
  });
  await test('child fill between order and aggregate queries is deferred, never fabricated', async () => {
    const f = fixture(); try {
      const link = await f.entry('SF08'); f.ex.waitSnapshot = async () => { f.ex.waitSnapshot = undefined; f.ex.childFill(link, 'tp'); f.ex.child(link, 'sl').status = 'Cancelled'; };
      assert.equal((await f.c.maintain()).issue, 'protection_changed_during_observation');
      assert(f.c.store.snapshot.lots.SF08); await f.c.maintain(); assert(!f.c.store.snapshot.lots.SF08);
      assert.equal(f.c.store.snapshot.recovery, null);
    } finally { f.cleanup(); }
  });
  await test('unexpected missing protection closes residual instead of certifying an unprotected book', async () => {
    for (const both of [false, true]) {
      const f = fixture(); try {
        const link = await f.entry('SF08'); f.time(T + M); await f.entry('CRSI'); const aux = f.c.store.snapshot.lots.CRSI;
        f.ex.child(link, 'sl').status = 'Cancelled';
        if (both) f.ex.child(link, 'tp').status = 'Cancelled';
        f.ex.autoCancel = true; await f.c.maintain();
        assert.equal(f.c.store.snapshot.exitRequests!.setup0!.reason, 'protection_failure');
        assert.equal(f.ex.commands.length, 3); assert.equal(f.ex.commands.at(-1)!.qty, '66.66');
        f.ex.fill(f.ex.commands.at(-1)!.link); await f.c.maintain(); assert.deepEqual(f.c.store.snapshot.lots.CRSI, aux);
      } finally { f.cleanup(); }
    }
  });
  await test('out-of-bracket actual fill gets an owned safety exit, no level reprice', async () => {
    const f = fixture(); try {
      seed(f.c.store, 'SF08', T); const r = await f.c.open('SF08');
      f.ex.fill(r.link!, undefined, T, 111); f.ex.createPair(r.link!); f.ex.autoCancel = true;
      await f.c.maintain(); assert.equal(f.c.store.snapshot.exitRequests!.setup0!.reason, 'invalid_entry_fill');
      assert.equal(f.ex.commands[0].bracket!.target, '110'); assert.equal(f.ex.commands.length, 2);
    } finally { f.cleanup(); }
  });
  await test('same slot can hold a new setup after retirement; old completed exit does not suppress new TP', async () => {
    const f = fixture(); try {
      const first = await f.entry('SF08'); f.ex.autoCancel = true; f.ex.childFill(first, 'tp', 10); await f.c.maintain();
      f.ex.fill(f.ex.commands.at(-1)!.link); await f.c.maintain();
      f.time(T + 2 * M); const second = await f.entry('SF08', 'SF08_2'); f.ex.childFill(second, 'sl', 5);
      await f.c.maintain(); assert.deepEqual(f.c.store.snapshot.exitRequests!.setup0!.lotIds, ['SF08_2']);
      assert.equal(f.c.store.snapshot.exitRequests!.setup0!.reason, 'stop');
      assert.equal(f.ex.commands.at(-1)!.qty, '61.66');
    } finally { f.cleanup(); }
  });
  await test('direct close and independent protect cannot bypass an attached bracket', async () => {
    const f = fixture(); try {
      await f.entry('SF08'); const qty = f.c.store.snapshot.lots.SF08.qty;
      assert.equal((await f.c.close({ owner: 'setup0', reason: 'timeout', allocations: [{ lotId: 'SF08', qty }] })).state, 'blocked');
      assert.equal((await f.c.protect({ owner: 'setup0', kind: 'trigger_sl', price: 80 })).state, 'blocked');
      assert.equal(f.ex.commands.length, 1);
    } finally { f.cleanup(); }
  });
  await test('cross-child fills within the shared budget retain exact costs and fees', async () => {
    const f = fixture(); try {
      const link = await f.entry('SF08'); const qty = f.c.store.snapshot.lots.SF08.qty;
      f.ex.childFill(link, 'tp', 10); f.ex.childFill(link, 'sl', qty - 10);
      f.ex.child(link, 'tp').status = 'Cancelled'; f.ex.child(link, 'sl').status = 'Cancelled';
      await f.c.maintain();
      const expected = 10 * 10 - (qty - 10) * 10 - qty * 100 * .00055 - (10 * 110 + (qty - 10) * 90) * .00055;
      assert(Math.abs(f.c.store.snapshot.realizedBeforeFunding - expected) < 1e-8);
      assert.equal(f.ex.commands.length, 1); assert.equal(Object.keys(f.c.store.snapshot.executions).length, 3);
    } finally { f.cleanup(); }
  });
  await test('timeout cannot treat a missing cancelled sibling as terminal', async () => {
    const f = fixture(); try {
      const link = await f.entry('PA07'); await f.c.requestExit('setup0', 'timeout'); f.ex.autoCancel = true;
      f.ex.changeChildren = e => { if (e.children.every(childTerminal)) e.children.pop(); };
      assert((await f.c.maintain()).pending > 0); assert.equal(f.ex.commands.length, 1);
      assert.equal(f.c.store.snapshot.brackets![link].completedAt, undefined);
      f.ex.changeChildren = undefined; await f.c.maintain(); assert.equal(f.ex.commands.length, 2);
      f.ex.fill(f.ex.commands.at(-1)!.link); await f.c.maintain();
      // PA07 timeout releases immediately on receipt, unlike bracket TP/SL.
      assert.equal(f.c.store.snapshot.sourceAfter.PA07, T);
    } finally { f.cleanup(); }
  });
  await test('unresolved protection safety exit blocks additional exposure on other owners', async () => {
    const f = fixture(); try {
      const link = await f.entry('SF08'); f.time(T + M); seed(f.c.store, 'CRSI', T + M);
      f.ex.child(link, 'sl').status = 'Cancelled'; f.ex.child(link, 'tp').status = 'Cancelled';
      const r = await f.c.open('CRSI'); assert.equal(r.reason, 'protection_safety_exit_pending');
      assert.equal(f.ex.commands.length, 1); await f.c.maintain(); assert.equal(f.ex.commands.length, 2);
    } finally { f.cleanup(); }
  });
  for (const mode of ['entry', 'cancel']) await test(`actual child-process crash after ${mode} venue mutation resumes without resubmitting`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-execution-')); let c: Coordinator | undefined;
    try {
      const child = spawnSync(process.execPath, ['-r', require.resolve('ts-node/register'), __filename, '--crash-child', dir, mode], { encoding: 'utf8', timeout: 60000 });
      assert.equal(child.status, 73, child.stderr);
      const ex = new PairedExchange(() => T + M, path.join(dir, 'exchange.json'));
      const args = { file: path.join(dir, 'state.json'), lockDirectory: path.join(dir, 'locks'), uid: UID, port: ex,
        options: { clock: () => T + M, entriesAllowed: () => false, exchangeLeverage: 3, feeRate: .00055 } };
      assert.throws(() => Coordinator.acquire(args), /lock/);
      for (const side of [1, 2]) {
        const file = path.join(args.lockDirectory, `${UID}-HYPEUSDT-${side}.lock`);
        assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, child.pid); fs.unlinkSync(file);
      }
      c = Coordinator.acquire(args); const count = ex.commands.length;
      if (mode === 'entry') { assert.equal((await c.maintain()).resting, 2); assert.equal(ex.commands.length, count); }
      else {
        const aux = c.store.snapshot.lots.CRSI; ex.autoCancel = true; await c.maintain();
        assert.equal(ex.commands.length, count + 1); assert.equal(ex.commands.at(-1)!.qty, '56.66');
        ex.fill(ex.commands.at(-1)!.link); await c.maintain(); assert.deepEqual(c.store.snapshot.lots.CRSI, aux);
        assert.equal(ownerPosition(c.store.snapshot, 'setup0').qty, 0);
      }
    } finally { c?.shutdown(); clean(dir); }
  });
  const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
  const files = ['scripts/portfolio-bracket-tests.ts', 'scripts/portfolio-execution-tests.ts',
    'src/bot/portfolio/attached-bracket.ts', 'src/bot/portfolio/bracket-state.ts', 'src/bot/portfolio/ledger.ts',
    'src/bot/portfolio/execution-coordinator.ts', 'src/bot/portfolio/order-command.ts',
    'src/bot/portfolio/contract.ts', 'src/bot/partial-close-transaction.ts'];
  files.push('src/bot/portfolio/capital.ts', 'src/bot/portfolio/allocation.ts', 'src/bot/portfolio/owner-lock.ts',
    'src/bot/portfolio/protection.ts', 'src/bot/portfolio/owned-exit.ts', 'src/bot/portfolio/lifecycle-state.ts',
    'src/bot/executor.ts', 'src/bot/sfp-state.ts');
  files.push('src/bot/portfolio/main-control-state.ts', 'src/bot/portfolio/main-inventory.ts',
    'src/bot/aggressive10-policy.ts', 'src/bot/close-cooldown.ts');
  const code = Object.fromEntries(files.map(f => [f, hash(fs.readFileSync(f))]));
  const out = `backtests/portfolio-bracket-verification/${hash(JSON.stringify(code)).slice(0, 16)}`;
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ code, cases,
    checks: cases.length, actualChildExits: 2, realExchangeCalls: 0, economicReplays: 0,
    scope: 'attached Partial bracket evidence/accounting/cancellation in simulation; NOT venue pairing certification or deployment approval' }, null, 2) + '\n');
  console.log(`portfolio attached bracket tests passed (${cases.length} cases; 2 actual child exits)\n${out}/verification.json`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
