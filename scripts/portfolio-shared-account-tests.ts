/** Actual operator-approved account SETTINGS in a simulated transport. No keys,
 * venue requests, liquidation estimate, strategy tuning or economic rerun. */
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { FakeExchange, clean, T, UID } from './portfolio-execution-tests';
import { PortfolioExecutionCoordinator as Coordinator } from '../src/bot/portfolio/execution-coordinator';
import { PortfolioMainRuntime } from '../src/bot/portfolio/main-runtime';
import { installMainControl } from '../src/bot/portfolio/main-control-state';
import { mainInventoryKey, ownedMainPositions } from '../src/bot/portfolio/main-bridge';
import { ownedTotals, ownerPosition, reserveGroup } from '../src/bot/portfolio/ledger';
import { admission, decisionReserves } from '../src/bot/portfolio/capital';
import { MINUTE as M, TERMS, type SetupSource } from '../src/bot/portfolio/contract';
import { dueOwnedExits, scheduleOwnedExits } from '../src/bot/portfolio/lifecycle';
import { loadBotConfig } from '../src/bot/bot-config';
import { calcAddSize } from '../src/bot/strategy';
import { StateManager } from '../src/bot/state';

const EQUITY = 19047.43317261, LEVERAGE = 25, PRICE = 100, FEE = .00055;
const config = loadBotConfig('bot-config.json'), cases: string[] = [];
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-execution-'));
  let now = T, seed = EQUITY, paused = false;
  const ex = new FakeExchange(() => now), originalSnapshot = ex.snapshot.bind(ex);
  ex.snapshot = async () => {
    const s = await originalSnapshot();
    const fees = [...ex.orders.values()].flatMap(o => o.executions).reduce((n, e) => n + e.fee, 0);
    const pnl = [...ex.orders.values()].filter(o => o.reduceOnly).flatMap(o => o.executions)
      .reduce((n, e) => n + (e.positionIdx === 1 ? 1 : -1) * e.qty * (e.price - PRICE), 0);
    // Every simulated ENTRY is at $100. Gross/25 is deliberately not claimed to
    // be Bybit's exact hedge-margin formula. Tests distinguish it from budgets.
    const gross = (ex.longQty + ex.shortQty) * PRICE;
    return { ...s, leverageLong: LEVERAGE, leverageShort: LEVERAGE,
      equity: seed + pnl - fees, availableBalance: seed + pnl - fees - gross / LEVERAGE - gross * FEE, ...ex.extra };
  };
  const args = { file: path.join(dir, 'state.json'), lockDirectory: path.join(dir, 'locks'), uid: UID, port: ex,
    options: { clock: () => now, entriesAllowed: () => !paused, exchangeLeverage: LEVERAGE, feeRate: FEE } };
  let c = Coordinator.acquire(args);
  c.store.transaction(s => installMainControl(s, new StateManager(path.join(dir, 'legacy-unused.json')).get(), now));
  let rt = new PortfolioMainRuntime(c, config, () => now);
  const f = {
    dir, ex, args, get now() { return now; }, get c() { return c; }, get rt() { return rt; },
    time(t: number) { now = t; }, equity(v: number) { seed = v; }, pause() { paused = true; },
    restart() { c.shutdown(); c = Coordinator.acquire(args); rt = new PortfolioMainRuntime(c, config, () => now); },
    async add() {
      const snapshot = c.store.snapshot, p = await ex.snapshot(), level = ownedMainPositions(snapshot).length;
      const r = await rt.openApproved({ id: 'main_' + Object.keys(snapshot.orders).length, at: now, price: PRICE,
        priceKnownAt: now, equity: p.equity, equityKnownAt: now, feeRate: FEE,
        expectedInventory: mainInventoryKey(snapshot), level, notional: calcAddSize(level, 800, 1.35), gatesApproved: true, entriesPaused: false });
      assert.equal(r.state, 'submitted'); ex.fill(r.link!); await rt.maintain(); return r.link!;
    },
    async group(sources: SetupSource[]) {
      const p = await ex.snapshot();
      c.store.transaction(s => reserveGroup(s, { at: now, price: PRICE, priceKnownAt: now, equity: p.equity, feeRate: FEE,
        signals: sources.map(source => ({ id: source + '_' + now, source, side: TERMS[source].side, decisionAt: now,
          knownAt: now, eligibleAt: now, expiresAt: now + 1440 * M,
          ...(TERMS[source].bracket ? { stop: source === 'SF08' ? 90 : 110, target: source === 'SF08' ? 110 : 90 } : {}) })) }));
      return c.store.snapshot.decisions.filter(d => d.at === now);
    },
    async fillGroup(sources: SetupSource[]) {
      const decisions = await f.group(sources);
      for (const d of decisions) {
        assert.equal(d.reason, 'accepted'); const r = await c.open(d.id); assert.equal(r.state, 'submitted');
        ex.fill(r.link!); await rt.maintain();
      }
    },
    cleanup() { c.shutdown(); clean(dir); },
  };
  return f;
}
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); cases.push(name); } catch (e) { throw new Error(name, { cause: e }); }
}
async function full() {
  const f = fixture();
  try {
    for (let n = 0; n < 11; n++) { f.time(T + n * M); await f.add(); }
    f.time(T + 11 * M); await f.fillGroup(['CRSI', 'L2', 'R5', 'R3']); return f;
  } catch (e) { f.cleanup(); throw e; }
}
const sizing = Array.from({ length: 11 }, (_, n) => calcAddSize(n, 800, 1.35));
const plannedGross = sizing.reduce((a, b) => a + b, 0) + 30_000;
async function main() {
  await test('full 11-rung main plus three slots and MACD coexist at common 25x', async () => {
    const f = await full(); try {
      const s = f.c.store.snapshot, totals = ownedTotals(s);
      assert.equal(ownedMainPositions(s).length, 11); assert.equal(Object.keys(s.lots).length, 15);
      assert.equal(new Set(Object.values(s.lots).map(p => p.owner)).size, 5); assert.equal(s.recovery, null);
      assert(Math.abs(totals.longQty - f.ex.longQty) < 1e-8); assert(Math.abs(totals.shortQty - f.ex.shortQty) < 1e-8);
      const mainCost = ownerPosition(s, 'main').cost;
      const auxiliaryCost = Object.values(s.lots).filter(p => p.owner !== 'main').reduce((n, p) => n + p.cost, 0);
      assert(Math.abs(totals.heldMargin - mainCost / 25 - auxiliaryCost / 3) < 1e-8);
      assert(totals.heldMargin > (mainCost + auxiliaryCost) / 25 + 8000);
      assert.equal(f.ex.commands.length, 15);
    } finally { f.cleanup(); }
  });
  await test('same-clock capital reserves all four auxiliary requests before any send', async () => {
    const f = fixture(); try {
      const decisions = await f.group(['R5', 'R3', 'L2', 'CRSI']);
      assert.equal(f.ex.commands.length, 0); assert.equal(decisions.length, 4);
      const requests = Object.values(f.c.store.snapshot.reservations), reserve = decisionReserves(0, requests);
      assert(Math.abs(reserve.required - 10060) < 1e-8);
      assert.deepEqual(decisions.map(d => [d.source, d.reservation!.owner]), [['CRSI', 'setup0'], ['L2', 'setup1'], ['R3', 'R3'], ['R5', 'setup2']]);
    } finally { f.cleanup(); }
  });
  await test('large exchange free balance cannot bypass internal 3x admission', async () => {
    const f = fixture(); try {
      f.equity(8000); const ds = await f.group(['CRSI', 'L2', 'R5', 'R3']);
      assert.equal(ds.find(d => d.source === 'R5')!.reason, 'shared_capital');
      assert(admission(8000, 0, Object.values(f.c.store.snapshot.reservations), FEE).pass);
      assert.equal(f.ex.commands.length, 0);
    } finally { f.cleanup(); }
  });
  await test('open rechecks actual available margin even when virtual equity budget passes', async () => {
    const f = fixture(); try {
      const [d] = await f.group(['L2']); f.ex.extra.availableBalance = 1;
      const r = await f.c.open(d.id); assert.equal(r.reason, 'execution_capital'); assert.equal(f.ex.commands.length, 0);
      assert(f.c.store.snapshot.reservations[d.id]);
    } finally { f.cleanup(); }
  });
  await test('structural stop-risk reserve survives 25x venue setting', () => {
    const request = { owner: 'setup0' as const, requestedNotional: 20000 / 3, decisionPrice: 100, side: 1 as const, stop: 50 };
    const check = admission(3000, 0, [request], FEE);
    assert(check.required < 3000); assert(check.reserve > 3600); assert(!check.pass);
  });
  await test('restart preserves all owned costs, reservations and strategy accounting', async () => {
    const f = await full(); try {
      const before = f.c.store.snapshot; f.restart(); await f.rt.maintain();
      const after = f.c.store.snapshot;
      assert.deepEqual(after.lots, before.lots); assert.equal(after.realizedBeforeFunding, before.realizedBeforeFunding);
      assert.deepEqual(after.mainControl, before.mainControl); assert.equal(after.recovery, null);
      assert.equal(f.ex.commands.length, 15);
    } finally { f.cleanup(); }
  });
  await test('main maker fill cannot close auxiliary longs or either short owner', async () => {
    const f = await full(); try {
      const before = f.c.store.snapshot, aux = Object.fromEntries(Object.entries(before.lots).filter(([, p]) => p.owner !== 'main'));
      const target = await f.rt.maintainTarget({ bid: PRICE, at: f.now, tick: .01 });
      assert.equal(Number(f.ex.commands.at(-1)!.qty), ownerPosition(before, 'main').qty);
      f.ex.fill(target.link!, undefined, f.now, Number(f.ex.commands.at(-1)!.protection!.price));
      await f.rt.maintain(); const after = f.c.store.snapshot;
      assert.deepEqual(after.lots, aux); assert.equal(after.mainControl!.memory.totalBatchCloses, 1);
      assert.equal(after.recovery, null);
    } finally { f.cleanup(); }
  });
  await test('MACD close only reduces its 100-unit share of the common short position', async () => {
    const f = await full(); try {
      const before = f.c.store.snapshot, rest = Object.fromEntries(Object.entries(before.lots).filter(([, p]) => p.owner !== 'R3'));
      const r5 = Object.values(before.lots).find(p => p.source === 'R5')!;
      await f.c.requestExit('R3', 'timeout'); await f.rt.maintain(); const order = f.ex.commands.at(-1)!;
      assert.equal(order.positionIdx, 2); assert.equal(order.side, 'Buy'); assert.equal(Number(order.qty), 100);
      f.ex.fill(order.link); await f.rt.maintain(); assert.deepEqual(f.c.store.snapshot.lots, rest);
      assert(Math.abs(f.ex.shortQty - r5.qty) < 1e-8); assert.deepEqual(f.c.store.snapshot.mainControl, before.mainControl);
    } finally { f.cleanup(); }
  });
  await test('paused/stale-source scheduling still closes timed slots without closing main', async () => {
    const f = await full(); try {
      const main = ownerPosition(f.c.store.snapshot, 'main'); f.pause();
      f.time(T + 11 * M + 12 * 60 * M + M);
      // No indicator publications or feed snapshot supplied. Actual fill time
      // alone must keep the timeout actionable on all four auxiliary owners.
      f.c.store.transaction(s => scheduleOwnedExits(s, f.now, []));
      const due = dueOwnedExits(f.c.store.snapshot, f.now); assert.equal(due.length, 4);
      for (const d of due) {
        await f.c.requestExit(d.owner, d.reason); await f.rt.maintain(); const order = f.ex.commands.at(-1)!;
        assert(order.reduceOnly); f.ex.fill(order.link); await f.rt.maintain();
      }
      assert.deepEqual(ownerPosition(f.c.store.snapshot, 'main'), main);
      assert.equal(Object.keys(f.c.store.snapshot.lots).length, 11); assert.equal(f.ex.shortQty, 0);
    } finally { f.cleanup(); }
  });
  await test('unknown same-clock entry retains full reservation and survives restart', async () => {
    const f = fixture(); try {
      const ds = await f.group(['L2', 'CRSI']); f.ex.failSubmit = true;
      const r = await f.c.open(ds[0].id); assert.equal(r.state, 'pending'); f.restart();
      const block = await f.c.open(ds[1].id); assert.equal(block.state, 'blocked');
      assert.equal(Object.keys(f.c.store.snapshot.reservations).length, 2); assert.equal(f.ex.commands.length, 1);
      assert.equal(decisionReserves(0, Object.values(f.c.store.snapshot.reservations)).required, 2 * (20000 / 9 + 20000 / 3 * .002));
    } finally { f.cleanup(); }
  });
  await test('leverage drift or a foreign conditional order prevents submissions', async () => {
    for (const mode of ['leverage', 'order']) {
      const f = fixture(); try {
        const [d] = await f.group(['L2']);
        if (mode === 'leverage') { f.ex.extra.leverageLong = 3; await assert.rejects(f.c.open(d.id), /mode\/leverage/); }
        else { f.ex.extra.openLinks = ['unknown-conditional']; assert.equal((await f.c.open(d.id)).state, 'blocked'); }
        assert.equal(f.ex.commands.length, 0);
      } finally { f.cleanup(); }
    }
  });
  await test('equity falling through owned virtual reserves blocks any additional exposure', async () => {
    const f = await full(); try {
      f.equity(10000); const before = f.ex.commands.length; await f.rt.maintain();
      assert.equal(f.c.store.snapshot.recovery, 'filled_capital_limit'); assert.equal(f.ex.commands.length, before);
      f.time(f.now + M); const ds = await f.group(['L2']); assert.equal(ds[0].reason, 'entries_blocked');
    } finally { f.cleanup(); }
  });
  const hash = (x: Buffer | string) => createHash('sha256').update(x).digest('hex');
  const files = ['scripts/portfolio-shared-account-tests.ts', 'scripts/portfolio-execution-tests.ts', 'bot-config.json',
    ...fs.readdirSync('src/bot/portfolio').filter(f => f.endsWith('.ts')).map(f => `src/bot/portfolio/${f}`),
    'src/bot/strategy.ts', 'src/bot/state.ts', 'src/bot/executor.ts', 'src/bot/partial-close-transaction.ts', 'src/bot/close-cooldown.ts', 'src/bot/aggressive10-policy.ts', 'src/bot/bot-config.ts'];
  const code = Object.fromEntries(files.map(f => [f, hash(fs.readFileSync(f))]));
  const out = `backtests/portfolio-shared-account-verification/${hash(JSON.stringify(code)).slice(0, 16)}`;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ checks: cases.length, cases, code, uid: UID,
    equity: EQUITY, exchangeLeverage: LEVERAGE, virtualLeverage: { main: 25, auxiliary: 3 },
    plannedMainNotional: plannedGross - 30000, plannedGrossNotional: plannedGross,
    allFilledCostBudgetBeforeFeesAndStops: (plannedGross - 30000) / 25 + 30000 / 3,
    realExchangeCalls: 0, economicReplays: 0, scope: 'shared 25x simulation and internal reservations only; NOT a liquidation or real bracket certificate' }, null, 2) + '\n');
  console.log(`Shared 25x account tests passed (${cases.length} cases; no exchange calls)\n${out}/verification.json`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
