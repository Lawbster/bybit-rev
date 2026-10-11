import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { fixture, FakeExchange, clean, T, UID, seed } from './portfolio-execution-tests';
import { PortfolioExecutionCoordinator as Coordinator } from '../src/bot/portfolio/execution-coordinator';
import { mainInventoryKey, ownedMainPositions, mainDecisionState, mainCloseAllocation, reserveApprovedMainAdd } from '../src/bot/portfolio/main-bridge';
import { ownerPosition, type PortfolioStore } from '../src/bot/portfolio/ledger';
import { MINUTE as M } from '../src/bot/portfolio/contract';
import { checkBatchTp, calcAddSize } from '../src/bot/strategy';
import { StateManager } from '../src/bot/state';
import { protectiveCommand } from '../src/bot/portfolio/protection';
import { validateCommand, type PortfolioOrderCommand } from '../src/bot/portfolio/order-command';

type Fixture = ReturnType<typeof fixture>;
function reserveMain(store: PortfolioStore, id: string, at: number) {
  const s = store.snapshot, level = ownedMainPositions(s).length;
  let accepted = false;
  store.transaction(d => { accepted = !!reserveApprovedMainAdd(d, { id, at, price: 100, priceKnownAt: at,
    equity: 19047.16, equityKnownAt: at, feeRate: .00055, expectedInventory: mainInventoryKey(s),
    level, notional: calcAddSize(level, 800, 1.35), gatesApproved: true, entriesPaused: false }); });
  return accepted;
}
async function mainEntry(f: Fixture, id: string, at: number, receiptDelay = 0) {
  f.setTime(at); assert(reserveMain(f.c.store, id, at));
  const r = await f.c.open(id); assert.equal(r.state, 'submitted');
  f.setTime(at + receiptDelay); f.ex.fill(r.link!); await f.c.maintain(); return r.link!;
}
const cases: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); cases.push(name); } catch (e) { throw new Error(name, { cause: e }); }
}
async function crashChild() {
  const dir = process.argv[3]; let now = T;
  const clock = () => now, ex = new FakeExchange(clock, path.join(dir, 'exchange.json'));
  const c = Coordinator.acquire({ file: path.join(dir, 'state.json'), lockDirectory: path.join(dir, 'locks'), uid: UID, port: ex,
    options: { clock, entriesAllowed: () => true, exchangeLeverage: 3, feeRate: .00055 } });
  assert(reserveMain(c.store, 'main0', T)); const open = await c.open('main0'); ex.fill(open.link!); await c.maintain();
  now += M; seed(c.store, 'CRSI', now); const aux = await c.open('CRSI'); ex.fill(aux.link!); await c.maintain();
  const tp = await c.protect({ owner: 'main', kind: 'maker_tp', price: 102 }); await c.maintain();
  await c.requestExit('main', 'hard_flatten');
  ex.onCancel = cmd => { ex.fill(cmd.link, 2); ex.terminal(cmd.link, 'Cancelled'); process.exit(73); };
  await c.maintain(); throw new Error('crash hook not reached');
}
async function main() {
  if (process.argv[2] === '--crash-child') return crashChild();
  await test('main projection excludes setup lots and preserves legacy pending-created age', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T, 2500); await mainEntry(f, 'main1', T + M);
      f.setTime(T + 2 * M); await f.entry('L2', 'L2', 120);
      const positions = ownedMainPositions(f.c.store.snapshot);
      assert.equal(positions.length, 2); assert.equal(positions[0].entryTime, T);
      assert.equal(f.c.store.snapshot.lots.main0.openedAt, T + 2500);
      assert.equal(positions[0].level, 0); assert.equal(positions[1].level, 1);
      assert(Math.abs(checkBatchTp(positions, 1.4, 100).tpPrice - 101.4) < 1e-8);
      const legacy = new StateManager(path.join(f.dir, 'unused-legacy.json')).get();
      legacy.riskOffUntil = T + 5000; legacy.forcedExitCooldownUntil = T + 8000;
      const before = structuredClone(legacy), projected = mainDecisionState(legacy, f.c.store.snapshot);
      assert.deepEqual({ ...projected, positions: [] }, { ...before, positions: [] }); assert.deepEqual(legacy, before);
      projected.positions[0].qty = 0; assert.equal(f.c.store.snapshot.lots.main0.qty, 8);
    } finally { f.cleanup(); }
  });
  await test('main adapter rejects stale approval, wrong depth, changed sizing and disabled gates', async () => {
    const f = fixture();
    try {
      const base = { id: 'main0', at: T, price: 100, priceKnownAt: T, equity: 19047.16, equityKnownAt: T,
        feeRate: .00055, expectedInventory: mainInventoryKey(f.c.store.snapshot), level: 0, notional: 800,
        gatesApproved: true, entriesPaused: false };
      for (const change of [{ level: 1 }, { notional: 900 }, { expectedInventory: 'bad' },
        { priceKnownAt: T + 1 }, { equityKnownAt: T - 5001 }])
        assert.throws(() => f.c.store.transaction(s => reserveApprovedMainAdd(s, { ...base, ...change })));
      for (const change of [{ gatesApproved: false }, { entriesPaused: true }, { equity: 1 }])
        f.c.store.transaction(s => assert.equal(reserveApprovedMainAdd(s, { ...base, ...change }), null));
      assert.equal(Object.keys(f.c.store.snapshot.reservations).length, 0);
      assert(reserveMain(f.c.store, 'main0', T)); assert.throws(() => reserveMain(f.c.store, 'main0', T));
    } finally { f.cleanup(); }
  });
  await test('live-like maker order covers only main lots; other source can trade alongside', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); await mainEntry(f, 'main1', T + M);
      const tp = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 101.401 });
      const cmd = f.ex.commands.at(-1)!;
      assert.equal(cmd.qty, '18.80'); assert.equal(cmd.protection!.price, '101.41'); assert.equal(cmd.orderType, 'Limit');
      const health = await f.c.maintain(); assert.equal(health.resting, 1); assert.equal(health.pending, 0); assert.equal(health.issue, null);
      const sequence = f.c.store.snapshot.sequence;
      for (let n = 0; n < 5; n++) await f.c.maintain();
      assert.equal(f.c.store.snapshot.sequence, sequence, 'unchanged resting observations must not rewrite the ledger');
      f.setTime(T + 2 * M); await f.entry('CRSI', 'CRSI', 110);
      assert.equal(f.ex.orders.get(tp.link!)!.qty, 18.8);
      assert.equal((await f.c.close({ ...mainCloseAllocation(f.c.store.snapshot), reason: 'forced' })).reason, 'owner_protection_requires_quiescence');
      assert.equal(reserveMain(f.c.store, 'main2', T + 2 * M), false);
      assert.equal((await f.c.protect({ owner: 'main', kind: 'trigger_sl', price: 95 })).state, 'blocked');
    } finally { f.cleanup(); }
  });
  await test('partial maker receipts allocate proportionally, retaining original rung ages and setup cost', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); await mainEntry(f, 'main1', T + M);
      f.setTime(T + 2 * M); await f.entry('CRSI', 'CRSI', 120);
      const aux = f.c.store.snapshot.lots.CRSI;
      const tp = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102 });
      f.ex.fill(tp.link!, 4.7, T + 2 * M, 102); await f.c.maintain();
      let p = ownedMainPositions(f.c.store.snapshot);
      assert(Math.abs(p[0].qty - 6) < 1e-8); assert(Math.abs(p[1].qty - 8.1) < 1e-8);
      assert.equal(p[0].entryTime, T); assert.equal(p[1].entryTime, T + M);
      assert.deepEqual(f.c.store.snapshot.lots.CRSI, aux);
      f.ex.fill(tp.link!, 4.7, T + 2 * M, 102); await f.c.maintain();
      p = ownedMainPositions(f.c.store.snapshot); assert(Math.abs(p[0].qty - 4) < 1e-8); assert(Math.abs(p[1].qty - 5.4) < 1e-8);
      await f.c.maintain(); assert.equal(Object.keys(f.c.store.snapshot.executions).length, 5);
      assert(Math.abs(f.c.store.snapshot.realizedBeforeFunding - (18.8 - .517 - .52734)) < 1e-8);
    } finally { f.cleanup(); }
  });
  await test('confirmed cancellation imports the last fill before residual flatten and leaves other owner intact', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); f.setTime(T + M); await f.entry('L2');
      const aux = f.c.store.snapshot.lots.L2;
      const tp = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102 });
      f.ex.onCancel = c => { f.ex.fill(c.link, 2); f.ex.terminal(c.link, 'Cancelled'); };
      await f.c.requestExit('main', 'hard_flatten'); await f.c.maintain();
      const last = f.ex.commands.at(-1)!; assert.equal(last.orderType, 'Market'); assert.equal(last.qty, '6.00');
      assert.equal(f.c.store.snapshot.orders[tp.link!].terminal, true);
      f.ex.fill(last.link); await f.c.maintain(); assert(f.c.store.snapshot.exitRequests!.main!.completedAt);
      assert.deepEqual(f.c.store.snapshot.lots.L2, aux); assert.equal(ownedMainPositions(f.c.store.snapshot).length, 0);
    } finally { f.cleanup(); }
  });
  await test('cancellation acknowledgement cannot authorize a fallback, including after restart', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); const tp = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102 });
      await f.c.requestExit('main', 'hard_flatten'); await f.c.maintain(); assert.equal(f.ex.commands.length, 2);
      assert.equal(f.c.store.snapshot.orders[tp.link!].cancelRequestedAt, T);
      f.restart(); await f.c.maintain(); assert.equal(f.ex.commands.length, 2);
      f.ex.terminal(tp.link!, 'Cancelled'); await f.c.maintain();
      assert.equal(f.ex.commands.length, 3); assert.equal(f.ex.commands[2].qty, '8.00');
    } finally { f.cleanup(); }
  });
  await test('maker touch grace persists without extension, then cancels and closes only residual', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); const tp = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102 });
      await assert.rejects(() => f.c.requestExit('main', 'target', 2000), /not touched/);
      f.ex.extra.bid = 102; f.ex.extra.ask = 102.01;
      await f.c.requestExit('main', 'target', 2000); f.setTime(T + 1500);
      await f.c.requestExit('main', 'target', 2000); assert.equal(f.c.store.snapshot.exitRequests!.main!.notBefore, T + 2000);
      f.restart(); await f.c.maintain(); assert.equal(f.ex.commands.length, 2);
      f.ex.fill(tp.link!, 3, T + 1500, 102); f.ex.onCancel = c => f.ex.terminal(c.link, 'Cancelled');
      f.setTime(T + 2000); await f.c.maintain(); assert.equal(f.ex.commands.at(-1)!.qty, '5.00');
      f.ex.fill(f.ex.commands.at(-1)!.link, undefined, T + 2000, 102); await f.c.maintain();
      assert.equal(f.c.store.snapshot.exitRequests!.main!.completedAt, T + 2000);
    } finally { f.cleanup(); }
  });
  await test('maker fills completely while cancelling: no market close and no unrelated inventory reduced', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); f.setTime(T + M); await f.entry('CRSI');
      const tp = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102 });
      f.ex.onCancel = c => f.ex.fill(c.link);
      await f.c.requestExit('main', 'forced'); await f.c.maintain();
      assert.equal(f.ex.commands.length, 3); assert(f.c.store.snapshot.orders[tp.link!].terminal);
      assert(f.c.store.snapshot.exitRequests!.main!.completedAt); assert(f.c.store.snapshot.lots.CRSI);
    } finally { f.cleanup(); }
  });
  await test('full passive fill inside grace completes immediately without delaying release', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); const tp = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102, reason: 'TP' });
      f.ex.extra.bid = 102; f.ex.extra.ask = 102.01; await f.c.requestExit('main', 'TP', 2000);
      f.setTime(T + 100); f.ex.fill(tp.link!, undefined, T + 100, 102); await f.c.maintain();
      assert.equal(f.c.store.snapshot.exitRequests!.main!.completedAt, T + 100); assert.equal(f.ex.commands.length, 2);
      assert.equal(f.c.store.snapshot.orders[tp.link!].reason, 'TP');
    } finally { f.cleanup(); }
  });
  await test('missing protection evidence, including lost submit acknowledgement, is not a cancel', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); f.ex.failSubmit = true;
      const tp = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102 }); assert.equal(tp.state, 'pending');
      f.ex.hide = true; await f.c.requestExit('main', 'forced'); await f.c.maintain(); assert.equal(f.ex.commands.length, 2);
      f.restart(); await f.c.maintain(); assert.equal(f.ex.commands.length, 2);
      f.ex.hide = false; f.ex.failSubmit = false; f.ex.terminal(tp.link!, 'Cancelled'); await f.c.maintain();
      assert.equal(f.ex.commands.length, 3);
    } finally { f.cleanup(); }
  });
  await test('price/trigger identity mismatch cannot certify protection', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102 });
      f.ex.changeEvidence = e => { if (e.protection) e.protection.price = '103'; };
      await assert.rejects(() => f.c.maintain(), /command/); assert.equal(f.ex.commands.length, 2);
    } finally { f.cleanup(); }
  });
  await test('fill between order query and position snapshot defers mutations until receipts arrive', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); const tp = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102 });
      let fired = false;
      f.ex.waitSnapshot = async () => { if (!fired) { fired = true; f.ex.fill(tp.link!, 2); } };
      assert.equal((await f.c.maintain()).issue, 'protection_changed_during_observation');
      assert.equal(ownerPosition(f.c.store.snapshot, 'main').qty, 8);
      assert.equal(f.c.store.snapshot.recovery, null);
      assert.equal((await f.c.maintain()).issue, null); assert.equal(ownerPosition(f.c.store.snapshot, 'main').qty, 6);
    } finally { f.cleanup(); }
  });
  await test('native TP replacement and short SL directions are explicitly quantity scoped', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); const maker = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102.019 });
      assert.equal((await f.c.protect({ owner: 'main', kind: 'trigger_tp', price: 101.409 })).state, 'blocked');
      f.ex.onCancel = c => f.ex.terminal(c.link, 'Cancelled'); assert.equal((await f.c.quiesce('main')).state, 'settled');
      const native = await f.c.protect({ owner: 'main', kind: 'trigger_tp', price: 101.409 });
      assert(f.c.store.snapshot.orders[maker.link!].terminal);
      assert.equal(f.ex.commands.at(-1)!.protection!.price, '101.4'); assert.equal(f.ex.commands.at(-1)!.protection!.triggerDirection, 1);
      assert.equal((await f.c.maintain()).resting, 1);
      f.setTime(T + M); await f.entry('R3');
      const sl = await f.c.protect({ owner: 'R3', kind: 'trigger_sl', price: 105.001 });
      const cmd = f.ex.commands.at(-1)!; assert.equal(cmd.positionIdx, 2); assert.equal(cmd.side, 'Buy');
      assert.equal(cmd.protection!.triggerDirection, 1); assert.equal(cmd.protection!.price, '105.01');
      assert.equal((await f.c.maintain()).resting, 2);
      f.ex.fill(sl.link!); await f.c.maintain(); assert.equal(ownerPosition(f.c.store.snapshot, 'R3').qty, 0);
      assert(!f.c.store.snapshot.orders[native.link!].terminal);
    } finally { f.cleanup(); }
  });
  await test('crossed targets and malformed protection commands are not repriced or submitted', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T);
      await assert.rejects(() => f.c.protect({ owner: 'main', kind: 'maker_tp', price: 99 }), /crossed/);
      assert.equal(f.ex.commands.length, 1);
      const base: PortfolioOrderCommand = { ...f.ex.commands[0], reduceOnly: true, side: 'Sell' };
      const c = protectiveCommand(base, 'main', 'trigger_sl', 95.009, .01, 100, 100);
      assert.equal(c.protection!.price, '95'); assert.equal(c.protection!.triggerDirection, 2);
      assert.throws(() => validateCommand({ ...c, protection: { ...c.protection!, triggerDirection: 1 } }));
      assert.throws(() => validateCommand({ ...c, takeProfit: '103' } as any));
    } finally { f.cleanup(); }
  });
  await test('selected partials leave other rungs; virtual sub-step slices still close as one valid quantity', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); await mainEntry(f, 'main1', T + M);
      const tp = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102 });
      f.ex.fill(tp.link!, .01); await f.c.maintain();
      const p = ownedMainPositions(f.c.store.snapshot); assert(Math.abs(p[0].qty * 100 - Math.round(p[0].qty * 100)) > 1e-5);
      f.ex.onCancel = c => f.ex.terminal(c.link, 'Cancelled'); await f.c.quiesce('main');
      const close = await f.c.close({ ...mainCloseAllocation(f.c.store.snapshot), reason: 'forced' });
      assert.equal(f.ex.commands.at(-1)!.qty, '18.79'); f.ex.fill(close.link!); await f.c.maintain();
      assert.equal(ownedMainPositions(f.c.store.snapshot).length, 0);
      f.setTime(T + 2 * M); await mainEntry(f, 'new0', T + 2 * M); await mainEntry(f, 'new1', T + 3 * M);
      const a = mainCloseAllocation(f.c.store.snapshot, ['new0']); assert.equal(a.allocationMode, 'selected_ids');
      const r = await f.c.close({ ...a, reason: 'sr_partial' }); f.ex.fill(r.link!); await f.c.maintain();
      assert.equal(ownedMainPositions(f.c.store.snapshot).length, 1); assert.equal(ownedMainPositions(f.c.store.snapshot)[0].id, 'new1');
      assert(reserveMain(f.c.store, 'rebuilt1', T + 3 * M)); assert.equal(f.c.store.snapshot.reservations.rebuilt1.mainLevel, 1);
      assert.throws(() => mainCloseAllocation(f.c.store.snapshot, ['setup_lot']));
    } finally { f.cleanup(); }
  });
  await test('terminal partial fallback is retried only for the receipt-proven remaining quantity', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); await f.c.requestExit('main', 'hard_flatten'); await f.c.maintain();
      const close = f.ex.commands.at(-1)!; f.ex.fill(close.link, 2); f.ex.terminal(close.link, 'Cancelled');
      await f.c.maintain(); assert.equal(f.ex.commands.at(-1)!.qty, '6.00'); assert.equal(f.ex.commands.length, 3);
      await f.c.maintain(); assert.equal(f.ex.commands.length, 3); assert.equal(f.c.store.snapshot.exitRequests!.main!.marketLinks.length, 2);
    } finally { f.cleanup(); }
  });
  await test('selected rung after fractional maker fill normalizes aggregate without rounding other rungs', async () => {
    const f = fixture();
    try {
      await mainEntry(f, 'main0', T); await mainEntry(f, 'main1', T + M);
      const tp = await f.c.protect({ owner: 'main', kind: 'maker_tp', price: 102 }); f.ex.fill(tp.link!, .01); await f.c.maintain();
      f.ex.onCancel = c => f.ex.terminal(c.link, 'Cancelled'); await f.c.quiesce('main');
      const before = f.c.store.snapshot.lots.main1;
      const r = await f.c.close({ ...mainCloseAllocation(f.c.store.snapshot, ['main0'], .01), reason: 'sr_partial' });
      assert.equal(f.ex.commands.at(-1)!.qty, '7.99'); f.ex.fill(r.link!); await f.c.maintain();
      assert.deepEqual(f.c.store.snapshot.lots.main1, before);
      assert(f.c.store.snapshot.lots.main0.qty > 0 && f.c.store.snapshot.lots.main0.qty < .01);
    } finally { f.cleanup(); }
  });
  await test('actual crash during cancel/fill race resumes the same durable exit and preserves setup inventory', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-execution-'));
    let c: Coordinator | undefined;
    try {
      const child = spawnSync(process.execPath, ['-r', require.resolve('ts-node/register'), __filename, '--crash-child', dir],
        { encoding: 'utf8', timeout: 60000 }); assert.equal(child.status, 73, child.stderr);
      const ex = new FakeExchange(() => T + M, path.join(dir, 'exchange.json'));
      const args = { file: path.join(dir, 'state.json'), lockDirectory: path.join(dir, 'locks'), uid: UID, port: ex,
        options: { clock: () => T + M, entriesAllowed: () => false, exchangeLeverage: 3, feeRate: .00055 } };
      assert.throws(() => Coordinator.acquire(args), /lock/);
      for (const side of [1, 2]) {
        const file = path.join(args.lockDirectory, `${UID}-HYPEUSDT-${side}.lock`);
        assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, child.pid); fs.unlinkSync(file);
      }
      c = Coordinator.acquire(args); const aux = c.store.snapshot.lots.CRSI; await c.maintain();
      assert.equal(ex.commands.length, 4); assert.equal(ex.commands.at(-1)!.qty, '6.00');
      ex.fill(ex.commands.at(-1)!.link); await c.maintain();
      assert.deepEqual(c.store.snapshot.lots.CRSI, aux); assert(c.store.snapshot.exitRequests!.main!.completedAt);
      await c.maintain(); assert.equal(ex.commands.length, 4);
    } finally { c?.shutdown(); clean(dir); }
  });
  const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
  const files = ['scripts/portfolio-protection-tests.ts', 'scripts/portfolio-execution-tests.ts',
    'src/bot/portfolio/attached-bracket.ts', 'src/bot/portfolio/bracket-state.ts',
    'src/bot/portfolio/execution-coordinator.ts', 'src/bot/portfolio/protection.ts', 'src/bot/portfolio/owned-exit.ts',
    'src/bot/portfolio/main-bridge.ts', 'src/bot/portfolio/ledger.ts', 'src/bot/portfolio/order-command.ts',
    'src/bot/portfolio/contract.ts', 'src/bot/portfolio/capital.ts', 'src/bot/portfolio/owner-lock.ts',
    'src/bot/sfp-state.ts', 'src/bot/executor.ts',
    'src/bot/portfolio/allocation.ts', 'src/bot/partial-close-transaction.ts', 'src/bot/strategy.ts'];
  files.push('src/bot/portfolio/main-control-state.ts', 'src/bot/portfolio/main-inventory.ts',
    'src/bot/aggressive10-policy.ts', 'src/bot/close-cooldown.ts');
  const code = Object.fromEntries(files.map(f => [f, hash(fs.readFileSync(f))]));
  const out = `backtests/portfolio-protection-verification/${hash(JSON.stringify(code)).slice(0, 16)}`;
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ code, cases,
    checks: cases.length, actualChildExits: 1, realExchangeCalls: 0, economicReplays: 0,
    scope: 'single protective orders, owned main projection and durable exits; no paired bracket, main runtime or live adapter certification' }, null, 2) + '\n');
  console.log(`portfolio protection/main bridge tests passed (${cases.length} cases; 1 actual child exit)\n${out}/verification.json`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
