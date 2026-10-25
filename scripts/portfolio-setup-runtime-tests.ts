import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { fixture as pairedFixture } from './portfolio-bracket-tests';
import { T, UID } from './portfolio-execution-tests';
import { PortfolioSetupRuntime, closedMinuteEquity, type SetupFeedPort, type SetupFeedSnapshot } from '../src/bot/portfolio/setup-runtime';
import { PortfolioMainRuntime } from '../src/bot/portfolio/main-runtime';
import { installMainControl } from '../src/bot/portfolio/main-control-state';
import { mainInventoryKey } from '../src/bot/portfolio/main-bridge';
import { PortfolioFeedWorker } from '../src/bot/portfolio/feed-worker';
import { dueEntrySources } from '../src/bot/portfolio/lifecycle';
import { MINUTE as M, TERMS, type SetupSource } from '../src/bot/portfolio/contract';
import { emptyLedger, ownedTotals } from '../src/bot/portfolio/ledger';
import { StateManager } from '../src/bot/state';
import { loadBotConfig } from '../src/bot/bot-config';
import type { PortfolioSignal } from '../src/bot/portfolio/allocation';
import type { MacdPublication } from '../src/bot/portfolio/macd-signals';
import { PortfolioRuntime } from '../src/bot/portfolio/runtime';
import { PortfolioMainDriver } from '../src/bot/portfolio/main-driver';
import { decisionHeldMargin, ownerPosition } from '../src/bot/portfolio/ledger';
import { PA07_SIZING, BASE_SIZING, ADX_SIZING, type SizingProfile } from '../src/bot/portfolio/sizing';
import { policyInputs } from './portfolio-main-policy-tests';

const cases: string[] = [], FEE = .00055;
// Compile-time proof the actual persistent worker is accepted without an adapter.
function workerPort(worker: PortfolioFeedWorker): SetupFeedPort { return worker; }
void workerPort;
function fixture(directory?: string, disk = false, sizingProfile: SizingProfile = BASE_SIZING) {
  const f = pairedFixture(directory, disk), clock = f.args.options.clock;
  let allowed = true, cashBase = 19047.56662381, price = 100, unavailable = false;
  let cashMissing = false, staleCash = false;
  f.args.options.exchangeLeverage = 25; f.args.options.entriesAllowed = () => allowed;
  const snapshot = f.ex.snapshot.bind(f.ex);
  f.ex.snapshot = async () => {
    const s = await snapshot();
    const receipts = [...f.ex.orders.values()].flatMap(o => o.executions).concat(f.ex.children.flatMap(c => c.executions));
    // Fixture entries fill at 100; cash records actual exit/fee receipts. This is
    // deliberately not a venue margin/liquidation model or an economic backtest.
    const realized = [...f.ex.orders.values()].filter(o => o.reduceOnly).flatMap(o => o.executions)
      .concat(f.ex.children.flatMap(c => c.executions)).reduce((n, e) => n + (e.positionIdx === 1 ? 1 : -1) * e.qty * (e.price - 100), 0);
    return { ...s, leverageLong: 25, leverageShort: 25,
      decisionCash: cashMissing ? undefined : { balance: cashBase + realized - receipts.reduce((n, e) => n + e.fee, 0),
        observedAt: clock() - (staleCash ? 6000 : 0), scope: 'USDT_ONLY_HYPE_OWNED' as const } };
  };
  const signals = new Map<number, PortfolioSignal[]>(); let publications: MacdPublication[] = [];
  let mutate: ((v: SetupFeedSnapshot) => void) | undefined;
  const feed: SetupFeedPort = {
    request() {},
    latest(now) {
      if (unavailable) return { ready: false, reason: 'worker_unavailable' };
      const at = Math.floor(now / M) * M;
      const value: SetupFeedSnapshot = { at: now,
        poll: { windowAt: at, observedAt: now, sources: dueEntrySources(now).map(source => {
          const signal = signals.get(at)?.find(s => s.source === source);
          return { source, status: signal ? 'signal' : 'no_signal', ...(signal ? { signal: structuredClone(signal) } : {}) };
        }) }, price: { price, priceKnownAt: at, markedThrough: at }, macdExits: publications,
        health: { error: null, policyError: null, gapAt: null }, loader: { error: null } };
      mutate?.(value); return { ready: true, value };
    }
  };
  let mainRuntime: PortfolioMainRuntime | undefined;
  const makeRuntime = () => new PortfolioSetupRuntime(f.c, feed, { clock, feeRate: FEE, entriesAllowed: () => allowed,
    sizingProfile,
    ...(mainRuntime ? { main: mainRuntime } : {}) });
  let rt = makeRuntime();
  f.ex.autoCancel = true;
  f.ex.onSubmit = c => { f.ex.fill(c.link); if (c.bracket) f.ex.createPair(c.link); };
  return {
    ...f, get c() { return f.c; }, get rt() { return rt; }, clock, feed,
    allow(v: boolean) { allowed = v; }, cash(v: number) { cashBase = v; }, price(v: number) { price = v; },
    missing(v = true) { unavailable = v; }, missingCash(v = true) { cashMissing = v; }, staleCash(v = true) { staleCash = v; },
    modify(fn: (v: SetupFeedSnapshot) => void) { mutate = fn; }, publications(p: MacdPublication[]) { publications = p; },
    signal(source: SetupSource, at: number, id = `${source}:${at}`) {
      const eligibleAt = at + (source === 'R3' ? M : 0), side = TERMS[source].side;
      const signal: PortfolioSignal = { id, source, side, decisionAt: at, knownAt: at,
        eligibleAt, expiresAt: eligibleAt + (TERMS[source].bracket ? 1440 : 721) * M,
        ...(TERMS[source].bracket ? { stop: side === 1 ? 90 : 110, target: side === 1 ? 110 : 90 } : {}) };
      signals.set(at, [...(signals.get(at) ?? []), signal]); return signal;
    },
    withMain() {
      f.c.store.transaction(s => installMainControl(s, new StateManager(path.join(f.dir, 'legacy-unused.json')).get(), clock()));
      mainRuntime = new PortfolioMainRuntime(f.c, loadBotConfig('bot-config.json'), clock); rt = makeRuntime(); return mainRuntime;
    },
    restart() { f.restart(); if (mainRuntime) mainRuntime = new PortfolioMainRuntime(f.c, loadBotConfig('bot-config.json'), clock); rt = makeRuntime(); },
  };
}
async function test(name: string, fn: () => Promise<void> | void) { await fn(); cases.push(name); }
async function main() {
  if (process.argv[2] === '--crash-child') {
    const f = fixture(process.argv[3], true); f.time(T + M); f.signal('CRSI', T + M);
    f.ex.onSubmit = c => { f.ex.fill(c.link); process.exit(73); };
    await f.rt.tick(); throw new Error('crash hook not reached');
  }
  await test('selected sizing flows through actual source poll, sealed group and venue commands', async () => {
    const f = fixture(undefined, false, PA07_SIZING);
    try {
      const at = T + M; f.time(at); f.signal('PA07', at); f.signal('CRSI', at);
      await f.rt.tick();
      const opens = Object.values(f.c.store.snapshot.orders).filter(o => o.kind === 'open');
      assert.equal(opens.length, 2);
      assert.equal(opens.find(o => o.source === 'PA07')!.qty, 200);
      assert.equal(opens.find(o => o.source === 'CRSI')!.qty, 86.66);
      assert(opens.every(o => o.reservation!.sizingProfile === PA07_SIZING));
      f.restart(); await f.rt.tick(); assert.equal(f.ex.commands.length, 2);
    } finally { f.cleanup(); }
  });
  await test('AA01 admits both directional tickets at production quantity and preserves them on restart', async () => {
    const f = fixture(undefined, false, ADX_SIZING);
    try {
      const at = T + M; f.time(at); f.signal('L2', at); f.signal('R5', at); f.signal('CRSI', at);
      await f.rt.tick();
      const opens = Object.values(f.c.store.snapshot.orders).filter(o => o.kind === 'open');
      assert.equal(opens.length, 3);
      for (const source of ['L2', 'R5']) assert.equal(opens.find(o => o.source === source)!.qty, 133.33);
      assert.equal(opens.find(o => o.source === 'CRSI')!.qty, 86.66);
      assert(opens.every(o => o.reservation!.sizingProfile === ADX_SIZING));
      f.restart(); await f.rt.tick(); assert.equal(f.ex.commands.length, 3);
    } finally { f.cleanup(); }
  });
  await test('assembled service shares two bracket checks and records deadlines before slow reads', async () => {
    const f = fixture(); try {
      const main = f.withMain();
      const driver = new PortfolioMainDriver(main, loadBotConfig('bot-config.json'), {
        request() {}, latest: now => policyInputs(now),
        decisionMark: now => ({ price: 100, priceKnownAt: now, markedThrough: now }),
      }, { clock: f.clock, entriesAllowed: () => false });
      const loop = new PortfolioRuntime(f.c, driver, f.rt, f.clock);
      f.time(T + M); const pa = f.signal('PA07', T + M), sf = f.signal('SF08', T + M);
      await f.rt.tick(); f.allow(false); f.time(T + 3 * M);
      let reads = 0, brackets = 0; const snapshot = f.ex.snapshot.bind(f.ex), observe = f.ex.attached.observe;
      f.ex.snapshot = async () => { reads++; return snapshot(); };
      f.ex.attached.observe = async (...args) => { brackets++; return observe(...args); };
      await loop.tick();
      assert.equal(reads, 1); assert.equal(brackets, 2);
      assert(f.c.serviceTiming.reusedMaintenance >= 5);
      assert.equal(Object.keys(f.c.store.snapshot.lots).length, 2);
      const due = f.c.store.snapshot.lifecycle!.exits[pa.id].dueAt;
      f.time(due);
      let checked = false;
      f.ex.snapshot = async () => {
        if (!checked) {
          checked = true;
          const requests = Object.values(f.c.store.snapshot.exitRequests ?? {});
          assert(requests.some(r => r.lotIds.includes(pa.id)));
          assert(requests.some(r => r.lotIds.includes(sf.id)));
          f.time(f.clock() + 2000); // Read latency cannot postpone recording a known exit.
        }
        return snapshot();
      };
      await loop.tick();
      assert(checked); assert.equal(Object.keys(f.c.store.snapshot.lots).length, 0);
      assert.equal(f.ex.longQty, 0); assert.equal(f.ex.shortQty, 0);
    } finally { f.cleanup(); }
  });
  await test('assembled loop: both sides, main TP, paused exit and outgoing collateral across restart', async () => {
    const f = fixture(); try {
      const main = f.withMain(); let entries = true;
      f.ex.onSubmit = c => { if (!c.protection) { f.ex.fill(c.link); if (c.bracket) f.ex.createPair(c.link); } };
      const driver = (runtime: PortfolioMainRuntime) => new PortfolioMainDriver(runtime, loadBotConfig('bot-config.json'), {
        request() {}, latest: now => policyInputs(now),
        decisionMark: now => ({ price: 100, priceKnownAt: Math.floor(now / M) * M, markedThrough: Math.floor(now / M) * M }),
      }, { clock: f.clock, entriesAllowed: () => entries });
      let loop = new PortfolioRuntime(f.c, driver(main), f.rt, f.clock);
      f.time(T + M); for (const source of ['CRSI', 'L2', 'R5'] as const) f.signal(source, T + M);
      const first = await loop.tick();
      assert.equal(first.add.decision?.approved, true); assert.equal(first.setups.decisions.length, 3);
      assert.equal(Object.keys(f.c.store.snapshot.lots).length, 4);
      assert.equal(ownerPosition(f.c.store.snapshot, 'main').qty, 8);
      assert.equal(f.ex.commands.at(-1)!.protection?.kind, 'maker_tp');
      assert.equal(Number(f.ex.commands.at(-1)!.qty), 8);
      const held = ownedTotals(f.c.store.snapshot).heldMargin;
      entries = false; f.allow(false); f.time(T + 2 * M);
      const short = Object.values(f.c.store.snapshot.lots).find(p => p.source === 'R5')!;
      await f.c.requestExit(short.owner, 'timeout');
      await loop.tick();
      assert.equal(f.ex.shortQty, 0); assert.equal(ownerPosition(f.c.store.snapshot, 'main').qty, 8);
      assert.equal(f.c.store.snapshot.recovery, null);
      assert(Math.abs(decisionHeldMargin(f.c.store.snapshot, f.clock()) - held) < 1e-8);
      const sent = f.ex.commands.length;
      f.restart();
      loop = new PortfolioRuntime(f.c, driver(new PortfolioMainRuntime(f.c, loadBotConfig('bot-config.json'), f.clock)), f.rt, f.clock);
      await loop.tick();
      assert.equal(f.ex.commands.length, sent);
      assert(Math.abs(decisionHeldMargin(f.c.store.snapshot, f.clock()) - held) < 1e-8);
      f.time(T + 3 * M); await loop.tick();
      assert(Math.abs(decisionHeldMargin(f.c.store.snapshot, f.clock()) - (held - short.cost / 3)) < 1e-8);
    } finally { f.cleanup(); }
  });
  await test('whole lexical group reserved before first submit, both sides coexist at 25x', async () => {
    const f = fixture(); try {
      f.time(T + M); for (const source of ['R5', 'L2', 'CRSI'] as const) f.signal(source, T + M);
      const hook = f.ex.onSubmit!; let checked = false;
      f.ex.onSubmit = c => { if (!checked) { checked = true; assert.equal(Object.keys(f.c.store.snapshot.reservations).length, 3); } hook(c); };
      const report = await f.rt.tick();
      assert.deepEqual(report.decisions.map(d => [d.source, d.reservation?.owner]), [['CRSI', 'setup0'], ['L2', 'setup1'], ['R5', 'setup2']]);
      assert.equal(report.submissions.length, 3); assert.equal(Object.keys(f.c.store.snapshot.lots).length, 3);
      assert(f.ex.longQty > 0 && f.ex.shortQty > 0);
      const sequence = f.c.store.snapshot.sequence; await f.rt.tick();
      assert.equal(f.ex.commands.length, 3); assert.equal(f.c.store.snapshot.sequence, sequence);
    } finally { f.cleanup(); }
  });
  await test('all six sources flow through one scheduler without a main-owner position', async () => {
    for (const source of ['SF08', 'PA07', 'L2', 'R5', 'CRSI', 'R3'] as const) {
      const f = fixture(); try {
        const at = source === 'R3' ? T : T + M; f.time(at); f.signal(source, at);
        await f.rt.tick(); if (source === 'R3') { assert.equal(f.ex.commands.length, 0); f.time(T + M); await f.rt.tick(); }
        const lots = Object.values(f.c.store.snapshot.lots); assert.equal(lots.length, 1); assert.equal(lots[0].source, source);
        if (TERMS[source].bracket) assert.equal(f.ex.children.length, 2);
      } finally { f.cleanup(); }
    }
  });
  await test('filled or rejected first order never changes its already-sealed siblings', async () => {
    const f = fixture(); try {
      f.time(T + M); for (const source of ['CRSI', 'L2', 'R5', 'PA07'] as const) f.signal(source, T + M);
      const hook = f.ex.onSubmit!; let first = true;
      f.ex.onSubmit = c => { if (first) { first = false; f.ex.terminal(c.link, 'Rejected'); } else hook(c); };
      const r = await f.rt.tick();
      assert.equal(r.decisions.find(d => d.source === 'R5')!.reason, 'slots_occupied');
      assert.equal(r.submissions.length, 3); assert.equal(Object.keys(f.c.store.snapshot.lots).length, 2);
    } finally { f.cleanup(); }
  });
  await test('missing current cash never falls back to venue equity', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('CRSI', T + M); f.missingCash(); const r = await f.rt.tick();
      assert.equal(r.entryStatus, 'account_unavailable'); assert.equal(f.ex.commands.length, 0); assert.equal(f.c.store.snapshot.lastDecisionAt, -1);
    } finally { f.cleanup(); }
  });
  await test('entry budget uses closed-minute mark and cash, not current quote or venue equity', () => {
    const s = emptyLedger('123'); s.lots.long = { id: 'long', owner: 'setup0', source: 'CRSI', side: 1, qty: 10, cost: 1000, entryFees: 1, openedAt: T };
    s.lots.short = { id: 'short', owner: 'R3', source: 'R3', side: -1, qty: 3, cost: 300, entryFees: 1, openedAt: T };
    const cash = { balance: 19000, observedAt: T + M + 500, scope: 'USDT_ONLY_HYPE_OWNED' as const };
    const mark = { price: 90, priceKnownAt: T + M + 100, markedThrough: T + M };
    assert.equal(closedMinuteEquity(s, cash, mark, T + M + 500), 18930);
    assert.throws(() => closedMinuteEquity(s, { ...cash, observedAt: T }, mark, T + M + 500), /clocks/);
    assert.throws(() => closedMinuteEquity(s, cash, { ...mark, markedThrough: T }, T + M + 500), /clocks/);
    assert.throws(() => closedMinuteEquity(s, cash, { ...mark, priceKnownAt: T + 2 * M }, T + M + 500), /clocks/);
  });
  await test('low closed-mark capital refuses the group despite large displayed venue equity', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('CRSI', T + M); f.cash(100);
      const r = await f.rt.tick(); assert.equal(r.decisions[0].reason, 'shared_capital'); assert.equal(f.ex.commands.length, 0);
    } finally { f.cleanup(); }
  });
  await test('cash already includes actual entry fees; decision does not subtract them twice', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('CRSI', T + M); await f.rt.tick();
      const e = await f.c.admissionEvidence(); const s = f.c.store.snapshot;
      assert.equal(closedMinuteEquity(s, e!.decisionCash!, { price: 100, priceKnownAt: T + M, markedThrough: T + M }, T + M),
        19047.56662381 - s.fees);
    } finally { f.cleanup(); }
  });
  await test('MACD reserves during publication minute and survives restart until next-minute entry', async () => {
    const f = fixture(); try {
      f.signal('R3', T); f.time(T + 1200); const r = await f.rt.tick();
      assert.equal(r.decisions[0].at, T + 1200); assert.equal(f.ex.commands.length, 0);
      f.restart(); f.time(T + M + 700); f.missing(); await f.rt.tick();
      assert.equal(f.ex.commands.length, 1); assert.equal(Object.values(f.c.store.snapshot.lots)[0].openedAt, T + M + 700);
      assert.equal(Object.values(f.c.store.snapshot.lifecycle!.exits)[0].dueAt, T + M + 700 + 721 * M);
    } finally { f.cleanup(); }
  });
  await test('missed entry window expires after restart without catch-up', async () => {
    const f = fixture(); try {
      f.signal('R3', T); await f.rt.tick(); f.restart(); f.time(T + 2 * M); await f.rt.tick();
      assert.equal(f.ex.commands.length, 0); assert.equal(Object.keys(f.c.store.snapshot.reservations).length, 0);
      assert.equal(f.c.store.snapshot.cancelledReservations[`R3:${T}`].reason, 'expired');
    } finally { f.cleanup(); }
  });
  await test('pause cancels only unsubmitted requests, with no rearm replay', async () => {
    const f = fixture(); try {
      f.signal('R3', T); await f.rt.tick(); f.allow(false); await f.rt.tick(); f.allow(true); f.time(T + M); await f.rt.tick();
      assert.equal(f.ex.commands.length, 0); assert.equal(f.c.store.snapshot.cancelledReservations[`R3:${T}`].reason, 'paused');
    } finally { f.cleanup(); }
  });
  await test('unknown submission retains its reservation and is not resent after restart', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('CRSI', T + M); f.ex.onSubmit = undefined; f.ex.failSubmit = true; f.ex.hide = true;
      await f.rt.tick(); f.restart(); f.allow(false); f.time(T + 5 * M); await f.rt.tick();
      assert.equal(f.ex.commands.length, 1); assert.equal(Object.keys(f.c.store.snapshot.reservations).length, 1);
    } finally { f.cleanup(); }
  });
  await test('timeouts close while paused with missing feed and missing decision cash', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('CRSI', T + M); await f.rt.tick(); f.allow(false); f.missing(); f.missingCash();
      f.time(T + 722 * M); const r = await f.rt.tick();
      assert.equal(r.exitRequests.length, 1); assert.equal(Object.keys(f.c.store.snapshot.lots).length, 0);
      assert.equal(f.ex.commands.length, 2); assert(f.ex.commands[1].reduceOnly);
    } finally { f.cleanup(); }
  });
  await test('feed exception does not prevent receipt-owned timeout', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('R5', T + M); await f.rt.tick(); f.feed.request = () => { throw Error('worker disconnected'); };
      f.time(T + 722 * M); const r = await f.rt.tick(); assert.equal(r.feedIssue, 'feed_read_failed');
      assert.equal(Object.keys(f.c.store.snapshot.lots).length, 0);
    } finally { f.cleanup(); }
  });
  await test('MACD histogram exit publication closes only MACD, not another short', async () => {
    const f = fixture(); try {
      f.signal('R3', T); await f.rt.tick(); f.time(T + M); f.signal('R5', T + M); await f.rt.tick();
      f.publications([{ sourceEnd: T + 240 * M, knownAt: T + 240 * M, previous: -1, current: 1, close: 100, crossing: false, exit: true }]);
      f.time(T + 240 * M); await f.rt.tick(); assert.equal(Object.keys(f.c.store.snapshot.lots).length, 2);
      f.time(T + 241 * M); await f.rt.tick(); assert.equal(Object.values(f.c.store.snapshot.lots)[0].source, 'R5');
      assert.equal(Object.keys(f.c.store.snapshot.lots).length, 1);
    } finally { f.cleanup(); }
  });
  await test('structural timeout cancels both siblings before market residual and deferred SF08 release', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('SF08', T + M); await f.rt.tick(); f.time(T + 1441 * M);
      f.signal('SF08', T + 1441 * M); const r = await f.rt.tick();
      assert.equal(f.ex.cancelled.length, 2); assert.equal(Object.keys(f.c.store.snapshot.lots).length, 0);
      assert.equal(r.decisions.find(d => d.source === 'SF08')!.reason, 'source_occupied');
      assert.equal(f.c.store.snapshot.sourceAfter.SF08, T + 1442 * M);
    } finally { f.cleanup(); }
  });
  await test('PA07 scheduled timeout permits same-window reuse only after actual receipts', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('PA07', T + M); await f.rt.tick(); f.time(T + 1441 * M); f.signal('PA07', T + 1441 * M);
      const r = await f.rt.tick(); assert.equal(r.decisions.find(d => d.source === 'PA07')!.reason, 'accepted');
      assert.equal(f.ex.commands.length, 3); assert.equal(f.ex.commands[1].reduceOnly, true);
      assert.equal(Object.values(f.c.store.snapshot.lots)[0].id, `PA07:${T + 1441 * M}`);
    } finally { f.cleanup(); }
  });
  await test('snapshot crossing a minute boundary cannot seal or trade the stale signal', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('CRSI', T + M); let queries = 0;
      f.ex.waitSnapshot = async () => { if (++queries === 2) f.time(T + 2 * M); };
      const r = await f.rt.tick(); assert.equal(r.entryStatus, 'outside_window'); assert.equal(f.ex.commands.length, 0);
    } finally { f.cleanup(); }
  });
  await test('execution snapshot crossing entry deadline expires without submission', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('CRSI', T + M);
      f.ex.waitSnapshot = async () => {
        if (Object.keys(f.c.store.snapshot.reservations).length) f.time(T + 2 * M);
      };
      await f.rt.tick(); assert.equal(f.ex.commands.length, 0);
      assert.equal(Object.keys(f.c.store.snapshot.reservations).length, 0);
      assert.equal(f.c.store.snapshot.cancelledReservations[`CRSI:${T + M}`].reason, 'expired');
    } finally { f.cleanup(); }
  });
  await test('pause during exchange await prevents every remaining entry', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('CRSI', T + M); f.signal('L2', T + M);
      f.ex.waitSnapshot = async () => { if (Object.keys(f.c.store.snapshot.reservations).length) f.allow(false); };
      await f.rt.tick(); assert.equal(f.ex.commands.length, 0); assert.equal(Object.keys(f.c.store.snapshot.reservations).length, 0);
    } finally { f.cleanup(); }
  });
  await test('partial timed entry keeps first-fill timeout and cancels remainder before scoped close', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('CRSI', T + M);
      f.ex.onSubmit = c => { if (!c.reduceOnly) f.ex.fill(c.link, 10); else f.ex.fill(c.link); };
      await f.rt.tick(); const original = Object.values(f.c.store.snapshot.lifecycle!.exits)[0];
      assert.equal(original.dueAt, T + 722 * M);
      f.time(T + 2 * M); f.ex.fill(f.ex.commands[0].link, 5); await f.rt.tick();
      assert.equal(Object.values(f.c.store.snapshot.lifecycle!.exits)[0].dueAt, original.dueAt);
      f.ex.onCancel = c => { f.ex.terminal(c.link, 'Cancelled'); };
      f.time(original.dueAt); f.allow(false); await f.rt.tick();
      assert.equal(f.ex.commands.length, 2); assert.equal(Number(f.ex.commands[1].qty), 15);
      assert.equal(Object.keys(f.c.store.snapshot.lots).length, 0); assert.equal(Object.keys(f.c.store.snapshot.reservations).length, 0);
    } finally { f.cleanup(); }
  });
  await test('partial entry cancel ack without terminal proof cannot authorize residual close', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('CRSI', T + M); f.ex.onSubmit = c => f.ex.fill(c.link, 10);
      await f.rt.tick(); f.time(T + 722 * M); await f.rt.tick();
      assert.equal(f.ex.commands.length, 1); assert.equal(Object.keys(f.c.store.snapshot.reservations).length, 1);
      assert.equal(Object.values(f.c.store.snapshot.lots)[0].qty, 10);
      assert(Object.values(f.c.store.snapshot.orders)[0].cancelRequestedAt);
    } finally { f.cleanup(); }
  });
  await test('future or stale worker publication never authorizes an entry', async () => {
    for (const delta of [-6000, 1]) {
      const f = fixture(); try {
        f.time(T + M); f.signal('CRSI', T + M); f.modify(v => { v.at += delta; });
        const r = await f.rt.tick(); assert.equal(r.entryStatus, 'inputs_unavailable'); assert.equal(f.ex.commands.length, 0);
      } finally { f.cleanup(); }
    }
  });
  await test('indicator arriving after slot-source cutoff is rejected, never silently retimestamped', async () => {
    const f = fixture(); try {
      f.time(T + M + 500); f.signal('CRSI', T + M).knownAt = T + M + 1;
      await assert.rejects(f.rt.tick(), /clock/); assert.equal(f.ex.commands.length, 0);
    } finally { f.cleanup(); }
  });
  await test('incomplete same-clock group cannot partially allocate', async () => {
    const f = fixture(); try {
      f.time(T + M); f.signal('CRSI', T + M); f.modify(v => { v.poll.sources.pop(); });
      await assert.rejects(f.rt.tick(), /incomplete/); assert.equal(f.c.store.snapshot.lastDecisionAt, -1);
    } finally { f.cleanup(); }
  });
  await test('parallel ticks fail fast rather than queue stale signals', async () => {
    const f = fixture(); try {
      let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
      f.ex.waitSnapshot = () => gate; const first = f.rt.tick();
      await assert.rejects(f.rt.tick(), /already in flight/); release(); await first;
    } finally { f.cleanup(); }
  });
  await test('backward time rejected; stable no-op polls do not rewrite book', async () => {
    const f = fixture(); try {
      f.time(T + 2 * M); await f.rt.tick(); const sequence = f.c.store.snapshot.sequence; await f.rt.tick();
      assert.equal(f.c.store.snapshot.sequence, sequence); f.time(T); await assert.rejects(f.rt.tick(), /clock reversed/);
    } finally { f.cleanup(); }
  });
  await test('setup loop preserves main rungs and durable main-control accounting', async () => {
    const f = fixture(); try {
      const main = f.withMain();
      await main.openApproved({ id: 'main0', at: T, price: 100, priceKnownAt: T, equity: 19047, equityKnownAt: T, feeRate: FEE,
        expectedInventory: mainInventoryKey(f.c.store.snapshot), level: 0, notional: 800, gatesApproved: true, entriesPaused: false });
      await main.maintain(); const before = structuredClone(f.c.store.snapshot.mainControl);
      f.time(T + M); f.signal('CRSI', T + M); await f.rt.tick(); f.time(T + 722 * M); await f.rt.tick();
      assert.equal(Object.values(f.c.store.snapshot.lots)[0].source, 'main'); assert.equal(f.ex.longQty, 8);
      assert.deepEqual(f.c.store.snapshot.mainControl, before);
    } finally { f.cleanup(); }
  });
  await test('actual child crash after entry fill recovers once without duplicate submission', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-execution-'));
    const child = spawnSync(process.execPath, ['-r', require.resolve('ts-node/register'), __filename, '--crash-child', dir],
      { encoding: 'utf8', timeout: 30000, windowsHide: true });
    assert.equal(child.status, 73, child.stderr);
    assert.throws(() => fixture(dir, true), /lock/);
    // Simulated operator cleanup only after this test's child has really exited.
    // Production locking still NEVER steals or automatically removes a lock.
    for (const side of [1, 2]) {
      const file = path.join(dir, 'locks', `${UID}-HYPEUSDT-${side}.lock`);
      assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, child.pid); fs.unlinkSync(file);
    }
    const f = fixture(dir, true); try {
      f.time(T + M + 1000); await f.rt.tick(); await f.rt.tick();
      assert.equal(f.ex.commands.length, 1); assert.equal(Object.keys(f.c.store.snapshot.lots).length, 1);
      assert.equal(Object.values(f.c.store.snapshot.lifecycle!.exits)[0].dueAt, T + 722 * M);
      assert.equal(ownedTotals(f.c.store.snapshot).longQty, Number(f.ex.commands[0].qty));
    } finally { f.cleanup(); }
  });
  const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
  const files = ['scripts/portfolio-setup-runtime-tests.ts', 'scripts/portfolio-execution-tests.ts', 'scripts/portfolio-bracket-tests.ts',
    'scripts/portfolio-main-policy-tests.ts', 'src/bot/portfolio/runtime.ts', 'src/bot/portfolio/main-driver.ts', 'src/bot/portfolio/main-policy.ts',
    'src/bot/portfolio/setup-runtime.ts', 'src/bot/portfolio/execution-coordinator.ts', 'src/bot/portfolio/main-runtime.ts',
    'src/bot/portfolio/lifecycle.ts', 'src/bot/portfolio/ledger.ts', 'src/bot/portfolio/feed-worker.ts', 'src/bot/portfolio/source-cache.ts',
    'src/bot/portfolio/contract.ts', 'src/bot/portfolio/capital.ts', 'src/bot/portfolio/allocation.ts', 'src/bot/portfolio/order-command.ts',
    'src/bot/portfolio/attached-bracket.ts', 'src/bot/portfolio/bracket-state.ts', 'src/bot/portfolio/owned-exit.ts',
    'src/bot/portfolio/main-control-state.ts', 'src/bot/portfolio/main-inventory.ts', 'src/bot/portfolio/main-bridge.ts', 'bot-config.json'];
  const code = Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(file))]));
  const out = `backtests/portfolio-setup-runtime-verification/${hash(JSON.stringify(code)).slice(0, 16)}`;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ code, checks: cases.length, cases, actualChildExits: 1,
    realExchangeCalls: 0, economicReplays: 0, scope: 'source-poll to simulated account execution; not full-main/live venue certification' }, null, 2) + '\n');
  console.log(`Portfolio setup runtime: ${cases.length} tests passed; 1 actual child exit\n${out}/verification.json`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
