import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { StateManager } from '../src/bot/state';
import { loadBotConfig } from '../src/bot/bot-config';
import { calcAddSize } from '../src/bot/strategy';
import { highExitCooldown, type HighExitCooldownPolicy } from '../src/bot/close-cooldown';
import { PortfolioExecutionCoordinator as Coordinator } from '../src/bot/portfolio/execution-coordinator';
import { PortfolioMainRuntime } from '../src/bot/portfolio/main-runtime';
import { installMainControl } from '../src/bot/portfolio/main-control-state';
import { mainInventoryKey, ownedMainPositions } from '../src/bot/portfolio/main-bridge';
import { FakeExchange, fixture as executionFixture, clean, T, UID } from './portfolio-execution-tests';
import { MINUTE as M } from '../src/bot/portfolio/contract';

const config = loadBotConfig('bot-config.json'), H = 60 * M;
export function fixture() {
  const f = executionFixture(); let now = T;
  const legacy = new StateManager(path.join(f.dir, 'legacy-unused.json')).get();
  legacy.realizedPnl = 123; legacy.totalFees = 45; legacy.totalFunding = 67;
  legacy.riskOffUntil = T - M; legacy.peakEquity = 35000;
  f.c.store.transaction(s => installMainControl(s, legacy, T));
  let runtime = new PortfolioMainRuntime(f.c, config, () => now);
  return { ...f, get c() { return f.c; }, get runtime() { return runtime; },
    time(t: number) { now = t; f.setTime(t); },
    restart() { f.restart(); runtime = new PortfolioMainRuntime(f.c, config, () => now); },
    approval(id: string) {
      const s = f.c.store.snapshot, level = ownedMainPositions(s).length;
      return { id, at: now, price: 100, priceKnownAt: now, equity: 19047.16, equityKnownAt: now, feeRate: .00055,
        expectedInventory: mainInventoryKey(s), level, notional: calcAddSize(level, 800, 1.35), gatesApproved: true, entriesPaused: false };
    },
    async add(id: string) {
      const s = f.c.store.snapshot, level = ownedMainPositions(s).length;
      const r = await runtime.openApproved({ id, at: now, price: 100, priceKnownAt: now, equity: 19047.16, equityKnownAt: now,
        feeRate: .00055, expectedInventory: mainInventoryKey(s), level, notional: calcAddSize(level, 800, 1.35), gatesApproved: true, entriesPaused: false });
      assert.equal(r.state, 'submitted'); f.ex.fill(r.link!); await runtime.maintain(); return r.link!;
    },
    policy(kind: 'high' | 'week', at = now): HighExitCooldownPolicy {
      return kind === 'high' ? { kind: 'aggressive10_high', requestedAt: at, decisionAt: Math.floor(at / M) * M, referenceHigh: 110, decisionPrice: 109 }
        : { kind: 'weak_week_time_stop', requestedAt: at, decisionAt: Math.floor(at / M) * M, decisionPrice: 99,
          referenceAt: Math.floor(at / M) * M - 7 * 24 * H, referencePrice: 100 };
    },
  };
}
const cases: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); cases.push(name); } catch (e) { throw new Error(name, { cause: e }); }
}
async function crashChild() {
  const dir = process.argv[3]; let now = T;
  const ex = new FakeExchange(() => now, path.join(dir, 'exchange.json'));
  const c = Coordinator.acquire({ file: path.join(dir, 'state.json'), lockDirectory: path.join(dir, 'locks'), uid: UID, port: ex,
    options: { clock: () => now, entriesAllowed: () => true, exchangeLeverage: 3, feeRate: .00055 } });
  c.store.transaction(s => installMainControl(s, new StateManager(path.join(dir, 'legacy-unused.json')).get(), T));
  const rt = new PortfolioMainRuntime(c, config, () => now);
  const r = await rt.openApproved({ id: 'r0', at: T, price: 100, priceKnownAt: T, equity: 19047.16, equityKnownAt: T, feeRate: .00055,
    expectedInventory: mainInventoryKey(c.store.snapshot), level: 0, notional: 800, gatesApproved: true, entriesPaused: false });
  ex.fill(r.link!); await rt.maintain(); now = T + 40 * H;
  const policy: HighExitCooldownPolicy = { kind: 'weak_week_time_stop', requestedAt: now, decisionAt: now,
    decisionPrice: 99, referenceAt: now - 7 * 24 * H, referencePrice: 100 };
  await rt.requestFullClose('TIME STOP', { kind: 'high', requestedAt: now, policy }, mainInventoryKey(c.store.snapshot));
  ex.onSubmit = cmd => { if (cmd.reduceOnly) { ex.fill(cmd.link); process.exit(73); } };
  await rt.maintain(); throw new Error('crash hook not reached');
}
async function main() {
  if (process.argv[2] === '--crash-child') return crashChild();
  await test('flat cutover preserves damage/regime/cooldowns/funding and rejects unresolved legacy', () => {
    const f = executionFixture(); try {
      const legacy = new StateManager(path.join(f.dir, 'legacy-unused.json')).get();
      legacy.damagedRegimeLatch.active = true; legacy.regime.flatActive = true; legacy.forcedExitCooldownUntil = T + H;
      legacy.totalFunding = 77; legacy.peakEquity = 35000;
      assert.throws(() => f.c.store.transaction(s => installMainControl(s, { ...legacy, recoveryMode: true }, T)));
      f.c.store.transaction(s => installMainControl(s, legacy, T));
      const m = f.c.store.snapshot.mainControl!.memory;
      assert.deepEqual(m.damagedRegimeLatch, legacy.damagedRegimeLatch); assert.deepEqual(m.regime, legacy.regime);
      assert.equal(m.forcedExitCooldownUntil, T + H); assert.equal(m.totalFunding, 77); assert.equal(m.peakEquity, 35000);
      assert.throws(() => f.c.store.transaction(s => installMainControl(s, legacy, T)));
    } finally { f.cleanup(); }
  });
  await test('fills update main memory and actual accounting atomically; auxiliary fills do not', async () => {
    const f = fixture(); try {
      await f.add('r0'); const before = f.c.store.snapshot.mainControl!;
      assert.equal(before.memory.lastAddTime, T); assert.equal(before.memory.aggressive10Ladder!.tpPhase, 'unseen');
      assert.equal(before.actualFees, .44); assert.equal(before.memory.totalFees, 45.44);
      f.time(T + M); await f.entry('CRSI'); assert.deepEqual(f.c.store.snapshot.mainControl, before);
      f.restart(); assert.deepEqual(f.c.store.snapshot.mainControl, before);
    } finally { f.cleanup(); }
  });
  await test('ordinary maker TP closes once, resets phase, leaves latch and zero TP cooldown', async () => {
    const f = fixture(); try {
      await f.add('r0'); const tp = await f.runtime.maintainTarget({ bid: 100, at: T, tick: .01 });
      f.c.store.transaction(s => { s.mainControl!.memory.damagedRegimeLatch.active = true; });
      f.ex.fill(tp.link!, undefined, T, 102); await f.runtime.maintain(); const m = f.c.store.snapshot.mainControl!;
      assert.equal(m.memory.aggressive10Ladder, null); assert.equal(m.memory.totalBatchCloses, 1);
      assert.equal(m.memory.forcedExitCooldownUntil, 0); assert(m.memory.damagedRegimeLatch.active);
      assert.equal(Object.keys(m.closed).length, 1); assert.equal(Object.values(m.closed)[0].reason, 'TP');
      const expected = 8 * 2 - .44 - 8 * 102 * .00055;
      assert(Math.abs(m.actualNet - expected) < 1e-8); f.restart(); await f.runtime.maintain();
      assert.deepEqual(f.c.store.snapshot.mainControl, m);
    } finally { f.cleanup(); }
  });
  await test('forced close cooldown is durable before submission and only finalizes when flat', async () => {
    const f = fixture(); try {
      await f.add('r0'); f.time(T + H); const inventory = mainInventoryKey(f.c.store.snapshot);
      await f.runtime.requestFullClose('HARD FLATTEN', { kind: 'forced', requestedAt: T + H }, inventory);
      const saved = JSON.parse(fs.readFileSync(f.args.file, 'utf8')).state;
      assert(saved.mainControl.closeTerms && saved.exitRequests.main); assert.equal(f.ex.commands.length, 1);
      f.restart(); await f.runtime.maintain(); const close = f.ex.commands.at(-1)!;
      f.ex.fill(close.link, 4); await f.runtime.maintain(); assert.equal(f.c.store.snapshot.mainControl!.memory.forcedExitCooldownUntil, 0);
      f.ex.fill(close.link); await f.runtime.maintain();
      assert.equal(f.c.store.snapshot.mainControl!.memory.forcedExitCooldownUntil, T + 8 * H);
      assert.equal((await f.runtime.openApproved(f.approval('r1'))).reason, 'main_admission_blocked');
    } finally { f.cleanup(); }
  });
  await test('high and weak-week cooldowns reuse exact execution-anchored helper across a boundary', async () => {
    for (const kind of ['high', 'week'] as const) {
      const f = fixture(); try {
        await f.add('r0'); f.time(T + 4 * H - 40_000); const policy = f.policy(kind);
        await f.runtime.requestFullClose(kind, { kind: 'high', requestedAt: T + 4 * H - 40_000, policy }, mainInventoryKey(f.c.store.snapshot));
        await f.runtime.maintain(); f.time(T + 4 * H + 1000); f.ex.fill(f.ex.commands.at(-1)!.link); await f.runtime.maintain();
        assert.equal(f.c.store.snapshot.mainControl!.memory.forcedExitCooldownUntil,
          highExitCooldown(policy, T + 4 * H + 1000, T + 4 * H + 1000)!.until);
      } finally { f.cleanup(); }
    }
  });
  await test('TP racing before high request gets no high-exit cooldown', async () => {
    const f = fixture(); try {
      await f.add('r0'); const tp = await f.runtime.maintainTarget({ bid: 100, at: T, tick: .01 });
      f.ex.fill(tp.link!); f.time(T + M); const policy = f.policy('high');
      await f.runtime.requestFullClose('HIGH', { kind: 'high', requestedAt: T + M, policy }, mainInventoryKey(f.c.store.snapshot));
      await f.runtime.maintain(); const m = f.c.store.snapshot.mainControl!;
      assert.equal(m.memory.forcedExitCooldownUntil, 0); assert.equal(Object.values(m.closed)[0].reason, 'TP');
      assert.equal(f.ex.commands.length, 2);
    } finally { f.cleanup(); }
  });
  await test('S/R partial keeps rung timer, survivor levels and cooldown without consuming aux', async () => {
    const f = fixture(); try {
      await f.add('r0'); f.time(T + M); await f.add('r1'); f.time(T + 2 * M); await f.add('r2'); f.time(T + 3 * M); await f.entry('CRSI');
      const aux = f.c.store.snapshot.lots.CRSI;
      const r = await f.runtime.requestSrPartial({ id: 'sr1', at: T + 3 * M, inventory: mainInventoryKey(f.c.store.snapshot),
        positionIds: ['r2'], reason: 'SR partial', cooldownUntil: T + 63 * M, qtyStep: .01 });
      assert.equal(r.state, 'submitted'); f.ex.fill(r.link!); await f.runtime.maintain();
      const m = f.c.store.snapshot.mainControl!; assert.equal(m.memory.lastAddTime, T + 2 * M);
      assert.equal(m.memory.srPartialExitActionUntil, T + 63 * M); assert.equal(m.partial!.outcome, 'filled');
      assert.deepEqual(m.memory.positions.map(p => p.level), [0, 1]); assert.deepEqual(f.c.store.snapshot.lots.CRSI, aux);
      assert.equal(f.approval('rebuilt').level, 2); f.time(T + 4 * M); await f.add('rebuilt');
      assert.equal(f.c.store.snapshot.orders[f.ex.commands.at(-1)!.link].reservation!.mainLevel, 2);
    } finally { f.cleanup(); }
  });
  await test('partial terminal fill commits cooldown once, unknown partial is never resubmitted', async () => {
    const f = fixture(); try {
      await f.add('r0'); f.time(T + M); await f.add('r1');
      f.ex.failSubmit = true;
      const r = await f.runtime.requestSrPartial({ id: 'sr', at: T + M, inventory: mainInventoryKey(f.c.store.snapshot),
        positionIds: ['r1'], reason: 'SR', cooldownUntil: T + 61 * M, qtyStep: .01 });
      assert.equal(r.state, 'pending'); f.restart(); await f.runtime.maintain(); assert.equal(f.ex.commands.length, 3);
      f.ex.fill(r.link!, 2); f.ex.terminal(r.link!, 'Cancelled'); await f.runtime.maintain();
      assert.equal(f.c.store.snapshot.mainControl!.memory.srPartialExitActionUntil, T + 61 * M);
      const m = f.c.store.snapshot.mainControl!; await f.runtime.maintain(); assert.deepEqual(f.c.store.snapshot.mainControl, m);
    } finally { f.cleanup(); }
  });
  await test('zero-fill partial rejection does not start cooldown', async () => {
    const f = fixture(); try {
      await f.add('r0'); f.time(T + M); await f.add('r1');
      const r = await f.runtime.requestSrPartial({ id: 'sr', at: T + M, inventory: mainInventoryKey(f.c.store.snapshot),
        positionIds: ['r1'], reason: 'SR', cooldownUntil: T + 61 * M, qtyStep: .01 });
      f.ex.terminal(r.link!, 'Rejected'); await f.runtime.maintain();
      assert.equal(f.c.store.snapshot.mainControl!.memory.srPartialExitActionUntil, 0);
      assert.equal(f.c.store.snapshot.mainControl!.partial!.outcome, 'rejected');
    } finally { f.cleanup(); }
  });
  await test('maker fill during partial cancellation invalidates the old selected plan', async () => {
    const f = fixture(); try {
      await f.add('r0'); f.time(T + M); await f.add('r1'); const tp = await f.runtime.maintainTarget({ bid: 100, at: T + M, tick: .01 });
      f.ex.onCancel = c => { f.ex.fill(c.link); };
      const r = await f.runtime.requestSrPartial({ id: 'sr', at: T + M, inventory: mainInventoryKey(f.c.store.snapshot),
        positionIds: ['r1'], reason: 'SR', cooldownUntil: T + 61 * M, qtyStep: .01 });
      assert.equal(r.reason, 'main_inventory_changed'); await f.runtime.maintain();
      assert.equal(f.c.store.snapshot.mainControl!.memory.srPartialExitActionUntil, 0);
      assert.equal(f.ex.commands.length, 3); assert.equal(f.c.store.snapshot.orders[tp.link!].terminal, true);
    } finally { f.cleanup(); }
  });
  await test('maker fill during add cancellation cannot turn stale approval into fresh first rung', async () => {
    const f = fixture(); try {
      await f.add('r0'); await f.runtime.maintainTarget({ bid: 100, at: T, tick: .01 }); f.time(T + M);
      f.ex.onCancel = c => f.ex.fill(c.link);
      const r = await f.runtime.openApproved(f.approval('r1')); assert.equal(r.reason, 'main_inventory_changed');
      assert.equal(f.ex.commands.length, 2); assert.equal(f.c.store.snapshot.mainControl!.memory.totalBatchCloses, 1);
    } finally { f.cleanup(); }
  });
  await test('expired add and failed gates never place a new order', async () => {
    const f = fixture(); try {
      const a = f.approval('r0'); f.time(T + 6000);
      assert.equal((await f.runtime.openApproved(a)).reason, 'main_approval_expired');
      assert.equal((await f.runtime.openApproved({ ...f.approval('r1'), gatesApproved: false })).reason, 'main_gates_or_pause');
      assert.equal(f.ex.commands.length, 0);
    } finally { f.cleanup(); }
  });
  await test('damaged/regime latches reject even a wrongly approved add; no latch reset on TP', async () => {
    for (const kind of ['damage', 'regime'] as const) {
      const f = fixture(); try {
        f.c.store.transaction(s => { if (kind === 'damage') s.mainControl!.memory.damagedRegimeLatch.active = true;
          else s.mainControl!.memory.regime.flatActive = true; });
        assert.equal((await f.runtime.openApproved(f.approval('r0'))).reason, 'main_admission_blocked');
        assert.equal(f.ex.commands.length, 0);
      } finally { f.cleanup(); }
    }
  });
  await test('shared Agg10 target policy stays normal at 4h and changes at 10h with phase surviving restart', async () => {
    const f = fixture(); try {
      await f.add('r0'); f.time(T + 4 * H); const first = await f.runtime.maintainTarget({ bid: 100, at: T + 4 * H, tick: .01 });
      assert.equal(f.c.store.snapshot.mainControl!.memory.aggressive10Ladder!.tpPhase, 'extending');
      assert.equal(Number(f.ex.commands.at(-1)!.protection!.price), 101.4);
      f.restart(); f.ex.onCancel = c => f.ex.terminal(c.link, 'Cancelled'); f.time(T + 10 * H);
      const next = await f.runtime.maintainTarget({ bid: 100, at: T + 10 * H, tick: .01 });
      assert.notEqual(next.link, first.link); assert.equal(Number(f.ex.commands.at(-1)!.protection!.price), 100.5);
      assert.equal(f.c.store.snapshot.mainControl!.memory.aggressive10Ladder!.tpPhase, 'released');
      assert.equal(f.c.store.snapshot.orders[first.link!].terminal, true);
    } finally { f.cleanup(); }
  });
  await test('expired approval and durable latch leave existing maker protection untouched', async () => {
    const f = fixture(); try {
      await f.add('r0'); await f.runtime.maintainTarget({ bid: 100, at: T, tick: .01 });
      let cancels = 0; f.ex.onCancel = () => { cancels++; };
      const a = f.approval('r1'); f.time(T + 6000);
      assert.equal((await f.runtime.openApproved(a)).reason, 'main_approval_expired');
      f.c.store.transaction(s => { s.mainControl!.memory.damagedRegimeLatch.active = true; });
      assert.equal((await f.runtime.openApproved(f.approval('r2'))).reason, 'main_admission_blocked');
      assert.equal(cancels, 0); assert.equal(f.ex.commands.length, 2);
    } finally { f.cleanup(); }
  });
  await test('old underlying capital evidence cannot cancel an existing TP', async () => {
    const f = fixture(); try {
      await f.add('r0'); await f.runtime.maintainTarget({ bid: 100, at: T, tick: .01 });
      let cancels = 0; f.ex.onCancel = () => { cancels++; };
      const a = f.approval('r1'); a.equityKnownAt -= 6000;
      assert.equal((await f.runtime.openApproved(a)).reason, 'main_capital_or_price_expired');
      assert.equal(cancels, 0);
    } finally { f.cleanup(); }
  });
  await test('failed execution admission releases only unsubmitted main reservation', async () => {
    const f = fixture(); try {
      f.ex.extra.availableBalance = 0;
      const r = await f.runtime.openApproved(f.approval('r0'));
      assert.equal(r.reason, 'execution_capital'); assert.equal(f.ex.commands.length, 0);
      assert.equal(Object.keys(f.c.store.snapshot.reservations).length, 0);
      assert.equal(f.c.store.snapshot.cancelledReservations.r0.reason, 'preflight_failed');
      f.time(T + M); f.ex.extra.availableBalance = 19047.16; f.ex.failSubmit = true;
      const unknown = await f.runtime.openApproved(f.approval('r1'));
      assert.equal(unknown.state, 'pending');
      assert(f.c.store.snapshot.orders[unknown.link!] && !f.c.store.snapshot.orders[unknown.link!].terminal);
      assert.equal(f.c.store.snapshot.cancelledReservations.r1, undefined);
    } finally { f.cleanup(); }
  });
  await test('quote expiring during reconciliation cannot trigger TP or replace its order', async () => {
    const f = fixture(); try {
      await f.add('r0'); await f.runtime.maintainTarget({ bid: 100, at: T, tick: .01 });
      f.ex.waitSnapshot = async () => { f.time(T + 6000); };
      let cancels = 0; f.ex.onCancel = () => { cancels++; };
      const r = await f.runtime.maintainTarget({ bid: 102, at: T, tick: .01 });
      assert.equal(r.reason, 'main_tp_quote_expired'); assert.equal(cancels, 0);
      assert.equal(f.ex.commands.length, 2); assert.equal(f.c.store.snapshot.exitRequests?.main, undefined);
    } finally { f.cleanup(); }
  });
  await test('controller rejects unsupported maker-disabled profile', () => {
    const f = fixture(); try {
      const c = structuredClone(config); c.makerTp!.enabled = false;
      assert.throws(() => new PortfolioMainRuntime(f.c, c), /maker profile/);
    } finally { f.cleanup(); }
  });
  await test('maker target touch retains configured grace across restart, then closes only residual', async () => {
    const f = fixture(); try {
      await f.add('r0'); const tp = await f.runtime.maintainTarget({ bid: 100, at: T, tick: .01 });
      f.ex.extra.bid = 102; f.ex.extra.ask = 102;
      await f.runtime.maintainTarget({ bid: 102, at: T, tick: .01 });
      assert.equal(f.c.store.snapshot.exitRequests!.main!.notBefore, T + config.makerTp!.touchGraceMs);
      f.restart(); await f.runtime.maintain(); assert.equal(f.ex.commands.length, 2);
      f.time(T + config.makerTp!.touchGraceMs); f.ex.onCancel = c => { f.ex.fill(c.link, 2, T + config.makerTp!.touchGraceMs, 102); f.ex.terminal(c.link, 'Cancelled'); };
      await f.runtime.maintain(); assert.equal(f.ex.commands.at(-1)!.qty, '6.00');
      f.ex.fill(f.ex.commands.at(-1)!.link, undefined, T + config.makerTp!.touchGraceMs, 102); await f.runtime.maintain();
      assert.equal(f.c.store.snapshot.mainControl!.memory.totalBatchCloses, 1); assert.equal(f.c.store.snapshot.orders[tp.link!].terminal, true);
    } finally { f.cleanup(); }
  });
  await test('old forced-close reason cannot contaminate a later ordinary TP', async () => {
    const f = fixture(); try {
      await f.add('r0'); await f.runtime.requestFullClose('FORCED', { kind: 'forced', requestedAt: T }, mainInventoryKey(f.c.store.snapshot));
      await f.runtime.maintain(); f.ex.fill(f.ex.commands.at(-1)!.link); await f.runtime.maintain();
      f.time(T + 9 * H); await f.add('new0'); const tp = await f.runtime.maintainTarget({ bid: 100, at: T + 9 * H, tick: .01 });
      f.ex.fill(tp.link!); await f.runtime.maintain();
      assert.deepEqual(Object.values(f.c.store.snapshot.mainControl!.closed).map(r => r.reason), ['FORCED', 'TP']);
    } finally { f.cleanup(); }
  });
  await test('actual process exit after forced market fill recovers cooldown and never duplicates close', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-execution-')); let c: Coordinator | undefined;
    try {
      const child = spawnSync(process.execPath, ['-r', require.resolve('ts-node/register'), __filename, '--crash-child', dir], { encoding: 'utf8', timeout: 60000 });
      assert.equal(child.status, 73, child.stderr);
      const now = T + 40 * H + 1000, ex = new FakeExchange(() => now, path.join(dir, 'exchange.json'));
      for (const side of [1, 2]) {
        const file = path.join(dir, 'locks', `${UID}-HYPEUSDT-${side}.lock`);
        assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, child.pid); fs.unlinkSync(file);
      }
      c = Coordinator.acquire({ file: path.join(dir, 'state.json'), lockDirectory: path.join(dir, 'locks'), uid: UID, port: ex,
        options: { clock: () => now, entriesAllowed: () => false, exchangeLeverage: 3, feeRate: .00055 } });
      const rt = new PortfolioMainRuntime(c, config, () => now); await rt.maintain();
      assert.equal(ex.commands.length, 2); assert.equal(c.store.snapshot.mainControl!.memory.forcedExitCooldownUntil, T + 48 * H);
      assert.equal(c.store.snapshot.mainControl!.memory.totalBatchCloses, 1); await rt.maintain();
      assert.equal(ex.commands.length, 2); assert.equal(Object.keys(c.store.snapshot.mainControl!.closed).length, 1);
    } finally { c?.shutdown(); clean(dir); }
  });
  const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
  await test('rejected maker falls back to one quantity-owned conditional TP', async () => {
    const f = fixture();
    try {
      await f.add('fallback-r0');
      const maker = await f.runtime.maintainTarget({ bid: 100, at: T, tick: .01 });
      f.ex.terminal(maker.link!, 'Rejected');
      const replacement = await f.runtime.maintainTarget({ bid: 100, at: T, tick: .01 });
      assert.equal(f.ex.commands.at(-1)!.protection?.kind, 'trigger_tp');
      assert.equal(f.ex.commands.at(-1)!.qty, '8.00');
      const count = f.ex.commands.length;
      await f.runtime.maintainTarget({ bid: 100, at: T, tick: .01 });
      assert.equal(f.ex.commands.length, count); assert(replacement.link);
    } finally { f.cleanup(); }
  });
  await test('rejected main add backs off without sleeping or blocking exits', async () => {
    const f = fixture();
    try {
      const result = await f.runtime.openApproved(f.approval('reject-r0'));
      f.ex.terminal(result.link!, 'Rejected'); await f.runtime.maintain();
      assert.equal(f.c.store.snapshot.mainControl!.policy!.addRetryAfter, T + 5 * M);
      await f.runtime.maintain();
      assert.equal(f.c.store.snapshot.mainControl!.policy!.addRetryAfter, T + 5 * M);
    } finally { f.cleanup(); }
  });
  const files = ['scripts/portfolio-main-runtime-tests.ts', 'scripts/portfolio-execution-tests.ts', 'bot-config.json',
    ...fs.readdirSync('src/bot/portfolio').filter(n => n.endsWith('.ts')).map(n => `src/bot/portfolio/${n}`),
    'src/bot/aggressive10-policy.ts', 'src/bot/close-cooldown.ts', 'src/bot/strategy.ts', 'src/bot/executor.ts',
    'src/bot/bot-config.ts', 'src/bot/partial-close-transaction.ts', 'src/bot/state.ts'];
  const code = Object.fromEntries(files.map(f => [f, hash(fs.readFileSync(f))]));
  const out = `backtests/portfolio-main-runtime-verification/${hash(JSON.stringify(code)).slice(0, 16)}`;
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ code, cases, checks: cases.length,
    actualChildExits: 1, realExchangeCalls: 0, economicReplays: 0,
    scope: 'main execution/controller and durable close consequences only; full gate/feed loop, real exchange and economic parity remain unverified' }, null, 2) + '\n');
  console.log(`portfolio main runtime tests passed (${cases.length} cases; 1 actual child exit)\n${out}/verification.json`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
