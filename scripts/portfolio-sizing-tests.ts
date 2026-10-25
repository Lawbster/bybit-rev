/** Local simulated venue only; never imports live credentials or creates clients. */
import assert from 'assert/strict';
import { allocateGroup, validateReservation, type PortfolioSignal } from '../src/bot/portfolio/allocation';
import { BASE_SIZING, PA07_SIZING, ADX_SIZING, sizingProfile, ticketNotional } from '../src/bot/portfolio/sizing';
import { reserveGroup, ownerPosition } from '../src/bot/portfolio/ledger';
import { admission } from '../src/bot/portfolio/capital';
import { MINUTE as M, SOURCES, TERMS, type SetupSource } from '../src/bot/portfolio/contract';
import { calcAddSize } from '../src/bot/strategy';
import { fixture as executionFixture, T } from './portfolio-execution-tests';
import { fixture as bracketFixture } from './portfolio-bracket-tests';

const signal = (source: SetupSource, at = T, id = source as string): PortfolioSignal => ({
  id, source, side: TERMS[source].side, decisionAt: at, eligibleAt: at, knownAt: at, expiresAt: at + 1440 * M,
  ...(TERMS[source].bracket ? { stop: source === 'SF08' ? 90 : 110, target: source === 'SF08' ? 110 : 90 } : {}),
});
const frame = { at: T, price: 100, priceKnownAt: T, equity: 18667.09068898, feeRate: .00055,
  heldMargin: 0, occupied: [], pending: [] };
const cases: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) { await fn(); cases.push(name); }
async function main() {
  await test('explicit identity; baseline decisions byte-identical; all six selected tickets', () => {
    assert.equal(sizingProfile(undefined), BASE_SIZING);
    for (const value of [null, '', 'PA07_3', 3, {}, NaN]) assert.equal(sizingProfile(value), null);
    assert.equal(sizingProfile(ADX_SIZING), ADX_SIZING);
    for (const source of SOURCES) {
      const args = { ...frame, signals: [signal(source)] };
      const old = allocateGroup(args);
      assert.deepEqual(allocateGroup({ ...args, sizingProfile: BASE_SIZING }), old);
      assert.equal(old[0].reservation!.sizingProfile, undefined);
      const r = allocateGroup({ ...args, sizingProfile: PA07_SIZING })[0].reservation!;
      assert.equal(r.requestedNotional, source === 'PA07' ? 20000 : source === 'R3' ? 13000 : (20000 / 3) * 1.3);
      validateReservation(r); validateReservation(old[0].reservation!);
      assert.throws(() => validateReservation({ ...r, sizingProfile: undefined }));
      assert.throws(() => validateReservation({ ...r, sizingProfile: 'unknown' as any }));
      assert.throws(() => validateReservation({ ...r, requestedNotional: r.requestedNotional + 1 }));
      const adx = allocateGroup({ ...args, sizingProfile: ADX_SIZING })[0].reservation!;
      assert.equal(adx.requestedNotional, source === 'L2' || source === 'R5' ? (20000 / 3) * 2 : r.requestedNotional);
      validateReservation(adx);
      if (source === 'L2' || source === 'R5') assert.throws(() => validateReservation({ ...adx, sizingProfile: PA07_SIZING }));
    }
  });
  await test('full ladder + four auxiliaries: real admission refuses unsafe overlap, never scales', () => {
    const mainNotional = Array.from({ length: 11 }, (_, i) => calcAddSize(i, 800, 1.35)).reduce((a, b) => a + b, 0);
    for (const profile of [PA07_SIZING, ADX_SIZING] as const) for (const equity of [19047.16, frame.equity, 15000, 10000]) {
      const args: Parameters<typeof allocateGroup>[0] = { ...frame, equity, heldMargin: mainNotional / 25, sizingProfile: profile,
        signals: ['PA07', 'R3', 'R5', 'L2', 'CRSI'].map(s => signal(s as SetupSource)) };
      const ds = allocateGroup(args), accepted = ds.flatMap(d => d.reservation ? [d.reservation] : []);
      assert(admission(equity, args.heldMargin, accepted, frame.feeRate).pass);
      for (const r of accepted) assert.equal(r.requestedNotional, ticketNotional(r.source as SetupSource, profile));
      for (const d of ds.filter(d => d.reason === 'shared_capital')) {
        const expected = allocateGroup({ ...args, equity: 1e9, signals: [signal(d.source)] })[0].reservation!;
        assert(!admission(equity, args.heldMargin, [...accepted, expected], frame.feeRate).pass);
      }
    }
  });
  await test('2x L2/R5 ambiguous partial receipts retain original quantities through restart and rollback', async () => {
    for (const source of ['L2', 'R5'] as const) {
      const f = executionFixture();
      try {
        f.c.store.transaction(s => reserveGroup(s, { ...frame, signals: [signal(source)], sizingProfile: ADX_SIZING }));
        f.ex.failSubmit = true; await f.c.open(source);
        const command = structuredClone(f.ex.commands[0]);
        assert.equal(Number(command.qty), 133.33);
        f.ex.fill(command.link, 50); f.ex.hide = true; f.restart(); await f.c.maintain();
        assert.equal(f.ex.commands.length, 1);
        f.ex.failSubmit = false; f.ex.hide = false; await f.c.maintain();
        assert.equal(ownerPosition(f.c.store.snapshot, 'setup0').qty, 50);
        f.setTime(T + M);
        f.c.store.transaction(s => reserveGroup(s, { ...frame, at: T + M,
          signals: [signal('CRSI', T + M)], sizingProfile: PA07_SIZING }));
        f.ex.fill(command.link); await f.c.maintain(); f.restart(); await f.c.maintain();
        assert.deepEqual(f.ex.commands, [command]);
        assert.equal(ownerPosition(f.c.store.snapshot, 'setup0').qty, 133.33);
        assert.equal(f.c.store.snapshot.orders[command.link].reservation!.sizingProfile, ADX_SIZING);
        assert.equal(f.c.store.snapshot.reservations.CRSI.requestedNotional, ticketNotional('CRSI', PA07_SIZING));
      } finally { f.cleanup(); }
    }
  });
  await test('old partial/unknown submission survives new-profile allocation, restart and late receipt', async () => {
    const f = executionFixture();
    try {
      f.c.store.transaction(s => reserveGroup(s, { ...frame, signals: [signal('L2', T, 'old')] }));
      f.ex.failSubmit = true;
      await f.c.open('old');
      const link = f.ex.commands[0].link;
      f.ex.fill(link, 10); f.ex.failSubmit = false; f.ex.hide = true; f.restart();
      await f.c.maintain(); assert.equal(f.ex.commands.length, 1);
      assert.equal(f.c.store.snapshot.reservations.old.requestedNotional, TERMS.L2.notional);
      f.ex.hide = false; await f.c.maintain();
      f.setTime(T + M);
      f.c.store.transaction(s => reserveGroup(s, { ...frame, at: T + M, signals: [signal('CRSI', T + M)], sizingProfile: PA07_SIZING }));
      const oldCommand = structuredClone(f.ex.commands[0]);
      f.ex.fill(link); await f.c.maintain(); f.restart(); await f.c.maintain();
      assert.deepEqual(f.ex.commands[0], oldCommand); assert.equal(f.ex.commands.length, 1);
      assert.equal(ownerPosition(f.c.store.snapshot, 'setup0').qty, 66.66);
      assert.equal(f.c.store.snapshot.reservations.CRSI.requestedNotional, ticketNotional('CRSI', PA07_SIZING));
    } finally { f.cleanup(); }
  });
  await test('selected pending survives crash-before-send; low-capital refresh blocks risk', async () => {
    const f = executionFixture();
    try {
      f.c.store.transaction(s => reserveGroup(s, { ...frame, signals: [signal('CRSI')], sizingProfile: PA07_SIZING }));
      f.restart();
      f.ex.extra = { equity: 100, availableBalance: 100 };
      const result = await f.c.open('CRSI'); assert.notEqual(result.state, 'submitted');
      assert.equal(f.ex.commands.length, 0);
    } finally { f.cleanup(); }
  });
  await test('3x PA07 partial TP and close isolate other shorts; restart and baseline rollback preserve quantities', async () => {
    const f = bracketFixture();
    try {
      const r5 = await f.entry('R5'); f.time(T + M);
      f.c.store.transaction(s => reserveGroup(s, { ...frame, at: T + M,
        signals: [signal('PA07', T + M)], sizingProfile: PA07_SIZING }));
      const r = await f.c.open('PA07'); assert.equal(r.state, 'submitted');
      assert.equal(Number(f.ex.commands.find(c => c.link === r.link)!.qty), 200);
      f.ex.fill(r.link!); f.ex.createPair(r.link!); await f.c.maintain(); f.restart(); await f.c.maintain();
      assert.equal(f.ex.child(r.link!, 'sl').qty, 200);
      f.ex.childFill(r.link!, 'tp', 80); await f.c.maintain();
      assert.equal(ownerPosition(f.c.store.snapshot, 'setup1').qty, 120);
      assert.equal(ownerPosition(f.c.store.snapshot, 'setup0').qty, 66.66);
      f.ex.autoCancel = true; await f.c.requestExit('setup1', 'manual');
      for (let i = 0; i < 4; i++) await f.c.maintain();
      const close = f.ex.commands.find(c => c.reduceOnly)!; assert.equal(Number(close.qty), 120);
      f.ex.fill(close.link); await f.c.maintain(); f.restart(); await f.c.maintain();
      assert.equal(ownerPosition(f.c.store.snapshot, 'setup1').qty, 0);
      assert.equal(ownerPosition(f.c.store.snapshot, 'setup0').qty, 66.66);
      assert.equal(f.ex.orders.get(r5)!.cumulativeQty, 66.66);
      f.time(T + 2 * M);
      f.c.store.transaction(s => reserveGroup(s, { ...frame, at: T + 2 * M,
        signals: [signal('L2', T + 2 * M)], sizingProfile: BASE_SIZING }));
      assert.equal(f.c.store.snapshot.reservations.L2.requestedNotional, TERMS.L2.notional);
      assert.equal(f.c.store.snapshot.orders[r.link!].reservation!.sizingProfile, PA07_SIZING);
    } finally { f.cleanup(); }
  });
  console.log(JSON.stringify({ passed: cases.length, cases }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
