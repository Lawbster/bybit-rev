import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { PortfolioExecutionCoordinator as Coordinator, type PortfolioExecutionPort,
  type PortfolioExchangeSnapshot, type PortfolioOrderEvidence } from '../src/bot/portfolio/execution-coordinator';
import { PortfolioOwnerLease } from '../src/bot/portfolio/owner-lock';
import { lockAccountLong } from '../src/bot/sfp-state';
import { orderQuantity, validateCommand, type PortfolioOrderCommand } from '../src/bot/portfolio/order-command';
import { reserveGroup, ownerPosition, ownedTotals, type PortfolioStore } from '../src/bot/portfolio/ledger';
import { MINUTE as M, TERMS, type SetupSource } from '../src/bot/portfolio/contract';

export const T = Date.UTC(2026, 0, 1), UID = '555249668';
export const rules = { step: .01, minQty: .01, maxMarketQty: 15000, minNotional: 5, tick: .01 };
type Found = Extract<PortfolioOrderEvidence, { found: true }>;
export class FakeExchange implements PortfolioExecutionPort {
  readonly transport = 'simulation' as const;
  commands: PortfolioOrderCommand[] = [];
  orders = new Map<string, Found>();
  longQty = 0; shortQty = 0;
  failSubmit = false; failCancel = false; hide = false; incomplete = false;
  extra: Partial<PortfolioExchangeSnapshot> = {};
  changeEvidence?: (e: Found) => void;
  waitSnapshot?: () => Promise<void>;
  onSubmit?: (c: PortfolioOrderCommand) => void;
  onCancel?: (c: PortfolioOrderCommand) => void;
  constructor(readonly clock: () => number, readonly disk?: string) {
    if (disk && fs.existsSync(disk)) {
      const s = JSON.parse(fs.readFileSync(disk, 'utf8'));
      this.commands = s.commands; this.orders = new Map(s.orders); this.longQty = s.longQty; this.shortQty = s.shortQty;
    }
  }
  protected save() {
    if (this.disk) fs.writeFileSync(this.disk, JSON.stringify({ commands: this.commands, orders: [...this.orders],
      longQty: this.longQty, shortQty: this.shortQty }));
  }
  async snapshot(): Promise<PortfolioExchangeSnapshot> {
    await this.waitSnapshot?.();
    return { uid: UID, symbol: 'HYPEUSDT', observedAt: this.clock(), hedgeMode: true,
      leverageLong: 3, leverageShort: 3, longQty: this.longQty, shortQty: this.shortQty,
      openLinks: [...this.orders].filter(([, o]) => !['Filled', 'Cancelled', 'Rejected'].includes(o.status)).map(([id]) => id),
      nativeProtection: false, equity: 19047.16, availableBalance: 19047.16,
      bid: 100, ask: 100, rules, ...this.extra };
  }
  async submit(c: PortfolioOrderCommand) {
    validateCommand(c); assert(!this.orders.has(c.link), 'fake exchange received a duplicate submission');
    this.commands.push(structuredClone(c));
    const orderId = 'venue_' + this.commands.length;
    this.orders.set(c.link, { found: true, uid: UID, symbol: 'HYPEUSDT', link: c.link, observedAt: this.clock(),
      orderId, qty: Number(c.qty), reduceOnly: c.reduceOnly, side: c.side, positionIdx: c.positionIdx,
      status: c.protection && c.protection.kind !== 'maker_tp' ? 'Untriggered' : 'New', cumulativeQty: 0, executions: [],
      ...(c.protection ? { protection: structuredClone(c.protection) } : {}) });
    this.save(); this.onSubmit?.(c);
    if (this.failSubmit) throw new Error('simulated lost HTTP response');
    return { orderId };
  }
  async observe(c: PortfolioOrderCommand): Promise<PortfolioOrderEvidence> {
    const o = this.orders.get(c.link);
    if (this.hide || !o) return { found: false, uid: UID, symbol: 'HYPEUSDT', link: c.link, observedAt: this.clock() };
    const e = structuredClone(o); e.observedAt = this.clock();
    if (this.incomplete) e.executions = [];
    this.changeEvidence?.(e);
    return e;
  }
  async cancel(c: PortfolioOrderCommand) {
    if (this.failCancel) throw new Error('simulated cancel transport failure'); this.onCancel?.(c);
  }
  fill(link: string, qty?: number, at = this.clock(), price = 100): void {
    const o = this.orders.get(link)!; qty ??= o.qty - o.cumulativeQty;
    assert(qty > 0 && qty + o.cumulativeQty <= o.qty + 1e-8);
    if (o.reduceOnly) assert(qty <= (o.positionIdx === 1 ? this.longQty : this.shortQty) + 1e-8);
    const exec = { id: `${link}_fill_${o.executions.length}`, link, orderId: o.orderId,
      at, side: o.side, positionIdx: o.positionIdx, qty, price, fee: qty * price * .00055 };
    o.executions.push(exec); o.cumulativeQty += qty;
    o.status = Math.abs(o.cumulativeQty - o.qty) < 1e-8 ? 'Filled' : 'PartiallyFilled';
    if (o.positionIdx === 1) this.longQty += o.reduceOnly ? -qty : qty;
    else this.shortQty += o.reduceOnly ? -qty : qty;
    this.save();
  }
  terminal(link: string, status: 'Cancelled' | 'Rejected') { this.orders.get(link)!.status = status; this.save(); }
}
export function seed(store: PortfolioStore, source: SetupSource, at: number, id = source as string) {
  store.transaction(s => reserveGroup(s, { at, price: 100, priceKnownAt: at, equity: 19047.16, feeRate: .00055,
    signals: [{ id, source, side: TERMS[source].side, decisionAt: at, knownAt: at, eligibleAt: at,
      expiresAt: at + 1440 * M, ...(TERMS[source].bracket ? { stop: source === 'SF08' ? 90 : 110,
        target: source === 'SF08' ? 110 : 90 } : {}) }] }));
}
export function fixture(directory?: string) {
  const dir = directory ?? fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-execution-'));
  let now = T, allowed = true;
  const clock = () => now, ex = new FakeExchange(clock);
  const options = { clock, entriesAllowed: () => allowed, exchangeLeverage: 3, feeRate: .00055 };
  const args = { file: path.join(dir, 'state.json'), lockDirectory: path.join(dir, 'locks'), uid: UID, port: ex, options };
  let c = Coordinator.acquire(args);
  return { dir, ex, args, get c() { return c; }, setTime(t: number) { now = t; }, pause() { allowed = false; },
    restart() { c.shutdown(); c = Coordinator.acquire(args); },
    async entry(source: SetupSource, id = source as string, price = 100) {
      seed(c.store, source, now, id); const r = await c.open(id); assert.equal(r.state, 'submitted');
      ex.fill(r.link!, undefined, now, price); await c.maintain(); return r.link!;
    }, cleanup() { c.shutdown(); clean(dir); } };
}
export function clean(dir: string): void {
  // Recursive deletion is limited to this test's explicit unique temp subtree.
  const p = path.resolve(dir), root = path.resolve(os.tmpdir()) + path.sep;
  assert(p.startsWith(root) && path.basename(p).startsWith('portfolio-execution-'));
  fs.rmSync(p, { recursive: true, force: true });
}

async function crashChild() {
  const [dir, mode] = process.argv.slice(3), clock = () => T;
  const ex = new FakeExchange(clock, path.join(dir, 'exchange.json'));
  if (mode === 'after_send') ex.onSubmit = c => { ex.fill(c.link); process.exit(73); };
  const c = Coordinator.acquire({ file: path.join(dir, 'state.json'), lockDirectory: path.join(dir, 'locks'), uid: UID,
    port: ex, options: { clock, entriesAllowed: () => true, exchangeLeverage: 3, feeRate: .00055 } });
  seed(c.store, 'L2', T);
  if (mode === 'before_send') ex.submit = async () => { process.exit(73); };
  await c.open('L2'); throw new Error('crash hook did not execute');
}
let checks = 0;
const cases: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); checks++; cases.push(name); } catch (e) { throw new Error(name, { cause: e }); }
}
async function main() {
  if (process.argv[2] === '--crash-child') return crashChild();
  await test('service proof is same-cycle, bounded and invalidated by book changes', async () => {
    const f = fixture(); try {
      let reads = 0; const snapshot = f.ex.snapshot.bind(f.ex);
      f.ex.snapshot = async () => { reads++; return snapshot(); };
      await f.c.withServiceCycle(async () => {
        await f.c.maintain(); await f.c.maintain(); assert.equal(reads, 1);
        seed(f.c.store, 'L2', T, 'changed-book');
        await f.c.maintain(); assert.equal(reads, 2);
        f.setTime(T + 4999); await f.c.maintain(); assert.equal(reads, 2);
        f.setTime(T + 5000); await f.c.maintain(); assert.equal(reads, 3);
      });
      await f.c.withServiceCycle(async () => { await f.c.maintain(); assert.equal(reads, 4); });
      await f.c.maintain(); await f.c.maintain(); assert.equal(reads, 6, 'standalone servicing never cached');
      await assert.rejects(f.c.withServiceCycle(async () => { await f.c.maintain(); throw Error('test'); }));
      await f.c.withServiceCycle(async () => { await f.c.maintain(); });
      assert.equal(reads, 8, 'exception discards proof');
    } finally { f.cleanup(); }
  });
  await test('cached service never authorizes a write after an external position change', async () => {
    const f = fixture(); try {
      seed(f.c.store, 'L2', T);
      await f.c.withServiceCycle(async () => {
        await f.c.maintain(); await f.c.maintain();
        f.ex.longQty = 1; // Venue changes without a local mutation.
        const result = await f.c.open('L2');
        assert.equal(result.state, 'blocked'); assert.equal(f.ex.commands.length, 0);
        assert(f.c.store.snapshot.recovery);
      });
    } finally { f.cleanup(); }
  });
  await test('reuse age includes read time, and unresolved submissions are never cached', async () => {
    const f = fixture(); try {
      let reads = 0;
      f.ex.waitSnapshot = async () => { reads++; f.setTime(T + reads * 5000); };
      await f.c.withServiceCycle(async () => { await f.c.maintain(); await f.c.maintain(); });
      assert.equal(reads, 2, 'a five-second read cannot buy another five-second reuse window');
      f.ex.waitSnapshot = undefined; f.setTime(T + M);
      seed(f.c.store, 'L2', T + M);
      const order = await f.c.open('L2');
      assert.equal(order.state, 'submitted');
      await f.c.withServiceCycle(async () => {
        assert((await f.c.maintain()).pending > 0);
        assert((await f.c.maintain()).pending > 0);
        assert.equal(f.c.serviceTiming.reusedMaintenance, 0);
      });
    } finally { f.cleanup(); }
  });
  await test('legacy long owner conflicts, both sides acquired, rollback leaves other owner untouched', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-execution-'));
    try {
      const stop = lockAccountLong(dir, UID, 'HYPEUSDT');
      assert.throws(() => new PortfolioOwnerLease(dir, UID)); stop();
      const shortFile = path.join(dir, `${UID}-HYPEUSDT-2.lock`); fs.writeFileSync(shortFile, 'legacy-short');
      assert.throws(() => new PortfolioOwnerLease(dir, UID));
      assert(!fs.existsSync(path.join(dir, `${UID}-HYPEUSDT-1.lock`)));
      assert.equal(fs.readFileSync(shortFile, 'utf8'), 'legacy-short'); fs.unlinkSync(shortFile);
      const lease = new PortfolioOwnerLease(dir, UID);
      assert.throws(() => new PortfolioOwnerLease(dir, UID)); assert.throws(() => lockAccountLong(dir, UID, 'HYPEUSDT'));
      lease.assertHeld(UID); assert.throws(() => lease.assertHeld('123'));
      fs.writeFileSync(shortFile, 'replacement-owner'); assert.throws(() => lease.assertHeld(UID));
      lease.release(); lease.release(); assert.equal(fs.readFileSync(shortFile, 'utf8'), 'replacement-owner');
    } finally { clean(dir); }
  });
  await test('normalization never enlarges order or silently overcloses', () => {
    assert.equal(orderQuantity(66.666, 100, rules, false), '66.66');
    assert.throws(() => orderQuantity(.009, 100, rules, true));
    assert.throws(() => orderQuantity(66.666, 100, rules, true));
    assert.throws(() => orderQuantity(16000, 100, rules, false));
    assert.throws(() => orderQuantity(.01, 100, rules, false));
  });
  await test('write-ahead intent and immutable command precede network call', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T);
      f.ex.onSubmit = cmd => {
        const saved = JSON.parse(fs.readFileSync(f.args.file, 'utf8')).state;
        assert.deepEqual(saved.orders[cmd.link].command, cmd);
        assert.equal(saved.orders[cmd.link].terminal, false);
      };
      const r = await f.c.open('L2'); assert.equal(r.state, 'submitted');
      const cmd = f.ex.commands[0]; assert.equal(cmd.qty, '66.66'); assert.equal(cmd.positionIdx, 1); assert(!cmd.reduceOnly);
      assert.throws(() => validateCommand({ ...cmd, takeProfit: '150' } as any));
      assert.throws(() => f.c.store.transaction(s => { s.orders[cmd.link].command!.reduceOnly = true; }));
    } finally { f.cleanup(); }
  });
  await test('one-owner partial close cannot consume the other long or short', async () => {
    const f = fixture();
    try {
      await f.entry('L2'); f.setTime(T + M); await f.entry('CRSI', 'CRSI', 110); f.setTime(T + 2 * M); await f.entry('R3');
      const before = f.c.store.snapshot; assert.equal(Object.keys(before.lots).length, 3);
      const l = before.lots.L2, other = before.lots.CRSI, short = before.lots.R3;
      await assert.rejects(() => f.c.close({ owner: l.owner, reason: 'timeout', allocations: [{ lotId: other.id, qty: 1 }] }));
      await assert.rejects(() => f.c.close({ owner: l.owner, reason: 'timeout', allocations: [{ lotId: l.id, qty: l.qty + .01 }] }));
      const r = await f.c.close({ owner: l.owner, reason: 'timeout', allocations: [{ lotId: l.id, qty: 10 }] });
      const cmd = f.ex.commands.at(-1)!; assert.equal(cmd.qty, '10.00'); assert.equal(cmd.side, 'Sell'); assert(cmd.reduceOnly);
      f.ex.fill(r.link!, 10, T + 2 * M, 105); await f.c.maintain();
      assert.deepEqual(f.c.store.snapshot.lots.CRSI, other); assert.deepEqual(f.c.store.snapshot.lots.R3, short);
      assert(Math.abs(f.c.store.snapshot.realizedBeforeFunding - (50 - .55 - .5775)) < 1e-8);
      assert(Math.abs(ownerPosition(f.c.store.snapshot, l.owner).qty - 56.66) < 1e-8);
      const closeShort = await f.c.close({ owner: 'R3', reason: 'timeout', allocations: [{ lotId: short.id, qty: short.qty }] });
      assert.equal(f.ex.commands.at(-1)!.side, 'Buy'); assert.equal(f.ex.commands.at(-1)!.positionIdx, 2);
      f.ex.fill(closeShort.link!); await f.c.maintain(); assert.equal(f.ex.shortQty, 0);
      assert.equal(f.c.store.snapshot.sourceAfter.R3, T + 2 * M);
    } finally { f.cleanup(); }
  });
  await test('lost acknowledgement + restart resolves without any resubmission', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T); f.ex.failSubmit = true;
      const r = await f.c.open('L2'); assert.equal(r.state, 'pending'); f.restart();
      f.ex.hide = true; await f.c.maintain(); assert(f.c.store.snapshot.reservations.L2);
      assert.equal((await f.c.open('L2')).state, 'blocked'); assert.equal(f.ex.commands.length, 1);
      f.ex.hide = false; f.ex.fill(r.link!); await f.c.maintain(); await f.c.maintain();
      assert.equal(Object.keys(f.c.store.snapshot.executions).length, 1); assert(!f.c.store.snapshot.reservations.L2);
      assert.equal(f.ex.commands.length, 1); assert.equal((await f.c.open('L2')).state, 'blocked');
    } finally { f.cleanup(); }
  });
  await test('partial fill and cancel acknowledgement do not free a slot; racing receipt is retained', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T); const r = await f.c.open('L2');
      f.ex.fill(r.link!, 10); await f.c.maintain(); assert(f.c.store.snapshot.reservations.L2);
      await f.c.cancel(r.link!); assert(!f.c.store.snapshot.orders[r.link!].terminal);
      f.ex.fill(r.link!, 5, T + 1); f.setTime(T + 1); f.ex.terminal(r.link!, 'Cancelled');
      await f.c.maintain(); assert.equal(f.c.store.snapshot.lots.L2.qty, 15);
      assert(!f.c.store.snapshot.reservations.L2); assert(!f.c.store.snapshot.availableAfter.setup0);
      assert.equal(f.c.store.snapshot.orders[r.link!].terminal, true);
    } finally { f.cleanup(); }
  });
  await test('missing terminal fills retain full pending budget until the complete execution set arrives', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T); const r = await f.c.open('L2'); f.ex.fill(r.link!); f.ex.incomplete = true;
      const result = await f.c.maintain(); assert.equal(result.issue, 'execution_history_incomplete');
      assert.equal(Object.keys(f.c.store.snapshot.lots).length, 0); assert(f.c.store.snapshot.reservations.L2);
      f.ex.incomplete = false; await f.c.maintain(); assert(f.c.store.snapshot.lots.L2);
    } finally { f.cleanup(); }
  });
  await test('malformed evidence cannot be applied or make a terminal order', async () => {
    for (const change of [
      (e: Found) => { e.uid = '123'; }, (e: Found) => { e.positionIdx = 2; },
      (e: Found) => { e.side = 'Sell'; }, (e: Found) => { e.reduceOnly = true; },
      (e: Found) => { e.qty += 1; }, (e: Found) => { e.executions.push(e.executions[0]); },
      (e: Found) => { e.executions[0].at = T + 1; }, (e: Found) => { e.status = 'Rejected'; },
    ]) {
      const f = fixture();
      try {
        seed(f.c.store, 'L2', T); const r = await f.c.open('L2'); f.ex.fill(r.link!); f.ex.changeEvidence = change;
        await assert.rejects(() => f.c.maintain()); assert(f.c.store.snapshot.reservations.L2);
        assert.equal(Object.keys(f.c.store.snapshot.lots).length, 0);
      } finally { f.cleanup(); }
    }
  });
  await test('old executions cannot disappear from a newer cumulative history', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T); const r = await f.c.open('L2'); f.ex.fill(r.link!, 10); await f.c.maintain();
      f.ex.changeEvidence = e => { e.executions = []; e.cumulativeQty = 0; e.status = 'Cancelled'; };
      assert.equal((await f.c.maintain()).issue, 'execution_history_incomplete');
      assert.equal(f.c.store.snapshot.lots.L2.qty, 10); assert(f.c.store.snapshot.reservations.L2);
    } finally { f.cleanup(); }
  });
  await test('a clean aggregate cannot erase a latched mismatch; owned exit remains possible', async () => {
    const f = fixture();
    try {
      await f.entry('L2'); const qty = f.ex.longQty; f.ex.longQty++;
      await f.c.maintain(); assert.equal(f.c.store.snapshot.recovery, 'aggregate_inventory_mismatch');
      f.ex.longQty = qty; await f.c.maintain(); assert(f.c.store.snapshot.recovery);
      f.pause(); const p = f.c.store.snapshot.lots.L2;
      const r = await f.c.close({ owner: p.owner, reason: 'timeout', allocations: [{ lotId: p.id, qty: p.qty }] });
      assert.equal(r.state, 'submitted'); f.ex.fill(r.link!); await f.c.maintain();
      assert.equal(ownedTotals(f.c.store.snapshot).longQty, 0);
    } finally { f.cleanup(); }
  });
  await test('entry pause and missing structural protection fail closed', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'SF08', T); assert.equal((await f.c.open('SF08')).reason, 'owned_protection_bridge_not_implemented');
      f.setTime(T + M); seed(f.c.store, 'L2', T + M); f.pause();
      assert.equal((await f.c.open('L2')).reason, 'entries_paused'); assert.equal(f.ex.commands.length, 0);
    } finally { f.cleanup(); }
  });
  await test('stale, future, wrong-account, mode, leverage, or native full-side protection cannot submit', async () => {
    for (const extra of [{ observedAt: T - 5001 }, { observedAt: T + 1 }, { uid: '123' }, { hedgeMode: false },
      { leverageShort: 25 }, { nativeProtection: true }, { bid: NaN }, { ask: 90 }]) {
      const f = fixture();
      try { seed(f.c.store, 'L2', T); f.ex.extra = extra; await assert.rejects(() => f.c.open('L2')); assert(!f.ex.commands.length); }
      finally { f.cleanup(); }
    }
  });
  await test('unowned open order, equity and available margin independently block', async () => {
    for (const extra of [{ openLinks: ['outside'] }, { equity: 1 }, { availableBalance: 1 }]) {
      const f = fixture();
      try { seed(f.c.store, 'L2', T); f.ex.extra = extra; assert.equal((await f.c.open('L2')).state, 'blocked'); assert(!f.ex.commands.length); }
      finally { f.cleanup(); }
    }
  });
  await test('slippage is accounted as an actual fill; capital breach latches and permits owned reduction', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T); const r = await f.c.open('L2'); f.ex.fill(r.link!, undefined, T, 110);
      f.ex.extra.equity = 2000; await f.c.maintain(); assert.equal(f.c.store.snapshot.recovery, 'filled_capital_limit');
      assert.equal(ownerPosition(f.c.store.snapshot, 'setup0').averageEntry, 110);
      const p = f.c.store.snapshot.lots.L2;
      assert.equal((await f.c.close({ owner: p.owner, reason: 'risk', allocations: [{ lotId: p.id, qty: p.qty }] })).state, 'submitted');
    } finally { f.cleanup(); }
  });
  await test('account calls are single-flight and a pause during the preflight blocks entry', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T); let release!: () => void;
      f.ex.waitSnapshot = () => new Promise<void>(r => { release = r; });
      const opening = f.c.open('L2'); await Promise.resolve();
      await assert.rejects(() => f.c.open('L2'), /in flight/); assert.throws(() => f.c.shutdown(), /pending/);
      f.pause(); release(); assert.equal((await opening).reason, 'entries_paused'); assert(!f.ex.commands.length);
    } finally { f.cleanup(); }
  });
  await test('entry window cannot be caught up after slow preflight', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T); f.ex.waitSnapshot = async () => { f.setTime(T + M); };
      assert.equal((await f.c.open('L2')).reason, 'entry_window_expired'); assert(!f.ex.commands.length);
    } finally { f.cleanup(); }
  });
  await test('lock replacement during preflight prevents submission and is not deleted on shutdown', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T);
      const file = path.join(f.args.lockDirectory, `${UID}-HYPEUSDT-1.lock`);
      f.ex.waitSnapshot = async () => { fs.writeFileSync(file, 'other-owner'); };
      await assert.rejects(() => f.c.open('L2')); assert(!f.ex.commands.length);
      f.c.shutdown(); assert.equal(fs.readFileSync(file, 'utf8'), 'other-owner');
    } finally { f.cleanup(); }
  });
  await test('rejected order only releases its reservation after terminal evidence', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T); const r = await f.c.open('L2'); f.ex.terminal(r.link!, 'Rejected');
      assert(f.c.store.snapshot.reservations.L2); await f.c.maintain(); assert(!f.c.store.snapshot.reservations.L2);
      assert.equal(Object.keys(f.c.store.snapshot.lots).length, 0);
    } finally { f.cleanup(); }
  });
  await test('durability failure before send prevents submission and poisons later writes', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T);
      // Inject only the existing store's persistence boundary, not trading logic.
      (f.c.store as any).persist = () => { throw new Error('simulated disk full'); };
      await assert.rejects(() => f.c.open('L2'), /durable write/); assert(!f.ex.commands.length);
      await assert.rejects(() => f.c.open('L2'), /restart required/); assert(!f.ex.commands.length);
    } finally { f.cleanup(); }
  });
  await test('post-ack disk failure recovers from the prior intent without a duplicate order', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T);
      f.ex.onSubmit = () => { (f.c.store as any).persist = () => { throw new Error('disk full after submit'); }; };
      await assert.rejects(() => f.c.open('L2'), /durable write/); assert.equal(f.ex.commands.length, 1);
      f.restart(); f.ex.fill(f.ex.commands[0].link); await f.c.maintain();
      assert.equal(f.c.store.snapshot.lots.L2.qty, 66.66); assert.equal(f.ex.commands.length, 1);
    } finally { f.cleanup(); }
  });
  await test('cancel transport error keeps the exact order and its reservation unresolved', async () => {
    const f = fixture();
    try {
      seed(f.c.store, 'L2', T); const r = await f.c.open('L2'); f.ex.failCancel = true;
      await assert.rejects(() => f.c.cancel(r.link!)); assert(!f.c.store.snapshot.orders[r.link!].terminal);
      assert(f.c.store.snapshot.reservations.L2); f.ex.fill(r.link!); await f.c.maintain();
      assert.equal(f.c.store.snapshot.lots.L2.qty, 66.66);
    } finally { f.cleanup(); }
  });
  for (const mode of ['before_send', 'after_send']) await test(`actual child crash ${mode}: no stale-lock steal or blind retry`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-execution-'));
    let c: Coordinator | undefined;
    try {
      const child = spawnSync(process.execPath, ['-r', require.resolve('ts-node/register'), __filename, '--crash-child', dir, mode],
        { encoding: 'utf8', timeout: 60000 });
      assert.equal(child.status, 73, child.stderr);
      const ex = new FakeExchange(() => T, path.join(dir, 'exchange.json'));
      const args = { file: path.join(dir, 'state.json'), lockDirectory: path.join(dir, 'locks'), uid: UID, port: ex,
        options: { clock: () => T, entriesAllowed: () => true, exchangeLeverage: 3, feeRate: .00055 } };
      assert.throws(() => Coordinator.acquire(args), /lock/);
      // Test-only manual cleanup after join proves this exact child exited.
      for (const side of [1, 2]) {
        const file = path.join(args.lockDirectory, `${UID}-HYPEUSDT-${side}.lock`);
        assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, child.pid); fs.unlinkSync(file);
      }
      c = Coordinator.acquire(args); await c.maintain();
      assert.equal(ex.commands.length, mode === 'before_send' ? 0 : 1);
      if (mode === 'before_send') {
        assert(c.store.snapshot.reservations.L2); assert.equal((await c.open('L2')).state, 'blocked');
      } else {
        assert.equal(c.store.snapshot.lots.L2.qty, 66.66); assert(!c.store.snapshot.reservations.L2);
        await c.maintain(); assert.equal(Object.keys(c.store.snapshot.executions).length, 1);
      }
      assert.equal(ex.commands.length, mode === 'before_send' ? 0 : 1);
    } finally { c?.shutdown(); clean(dir); }
  });
  const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
  const files = ['scripts/portfolio-execution-tests.ts', 'src/bot/portfolio/execution-coordinator.ts',
    'src/bot/portfolio/attached-bracket.ts', 'src/bot/portfolio/bracket-state.ts',
    'src/bot/portfolio/protection.ts', 'src/bot/portfolio/owned-exit.ts', 'src/bot/partial-close-transaction.ts',
    'src/bot/portfolio/owner-lock.ts', 'src/bot/portfolio/order-command.ts', 'src/bot/portfolio/ledger.ts',
    'src/bot/portfolio/contract.ts', 'src/bot/portfolio/capital.ts', 'src/bot/portfolio/allocation.ts',
    'src/bot/sfp-state.ts', 'src/bot/executor.ts'];
  files.push('src/bot/portfolio/main-control-state.ts', 'src/bot/portfolio/main-inventory.ts',
    'src/bot/aggressive10-policy.ts', 'src/bot/close-cooldown.ts');
  const code = Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(file))]));
  const report = { code, cases, checks, actualChildExits: 2, realExchangeCalls: 0, economicReplays: 0,
    scope: 'simulated execution and persistence; no live adapter, main bridge or protective-order certification' };
  const out = `backtests/portfolio-execution-verification/${hash(JSON.stringify(code)).slice(0, 16)}`;
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(`${out}/verification.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(`portfolio execution tests passed (${checks} cases; 2 actual child exits; simulated exchange only)\n${out}/verification.json`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
