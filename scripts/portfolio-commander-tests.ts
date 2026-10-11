/** File-only controls and display tests: no Discord/Bybit requests, no trading. */
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { handlePortfolioCommand, portfolioStatusFromDisk } from '../src/bot/portfolio/commander';
import { buildPortfolioMonitor, formatPortfolioStatus, PortfolioStatusLogger, discordStatusChunks,
  type StatusHealth } from '../src/bot/portfolio/status';
import { emptyLedger, type Intent } from '../src/bot/portfolio/ledger';
import { PORTFOLIO_POLICY } from '../src/bot/portfolio/contract';
import type { PortfolioExchangeSnapshot } from '../src/bot/portfolio/execution-coordinator';
import type { BracketChild } from '../src/bot/portfolio/bracket-state';

const now = 1791720000000, root = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-commander-'));
let checks = 0;
function test(name: string, fn: () => void) { fn(); checks++; }
const file = (f: string) => path.join(root, f);
const write = (f: string, value: unknown) => fs.writeFileSync(file(f), JSON.stringify(value));
const has = (f: string) => fs.existsSync(file(f));
const cmd = (s: string, at = now) => handlePortfolioCommand(s, at, root, now);
const config = { ...JSON.parse(fs.readFileSync('portfolio-live-config.json', 'utf8')), enabled: true, mode: 'live', entryEnabled: true };
const ledger = emptyLedger('555249668');
const account: PortfolioExchangeSnapshot = { uid: '555249668', symbol: 'HYPEUSDT', observedAt: now,
  hedgeMode: true, leverageLong: 25, leverageShort: 25, longQty: 0, shortQty: 0, openLinks: [], nativeProtection: false,
  equity: 19000, availableBalance: 18000, bid: 101, ask: 102, rules: { step: .01, minQty: .01, maxMarketQty: 10000, minNotional: 5 } };
const controls = { pauseRequested: true, flattenRequested: false };
const healthy = (): StatusHealth => ({ writtenAt: now, uid: '555249668', policy: PORTFOLIO_POLICY,
  enabled: true, mode: 'live', configuredEntryEnabled: true, entryEnabled: false, status: 'healthy', error: null, recovery: null,
  reconciliation: { at: now, equity: 19000, availableBalance: 18000, longQty: 0, shortQty: 0 },
  pending: [], monitor: buildPortfolioMonitor(ledger, account, null, now, controls, null), realizedBeforeFunding: 12,
  funding: { amount: -1, unallocated: 0 }, feed: { health: { through: now, gapAt: null } }, tickMs: 12000 });
function reset() {
  write('portfolio-live-config.json', config); write(config.healthFile, healthy());
  fs.writeFileSync(file('portfolio-pause'), 'paused');
  if (has('portfolio-flatten')) fs.unlinkSync(file('portfolio-flatten'));
}
try {
  fs.mkdirSync(file('data'));
  for (const f of ['bot-pause', 'lawbster-sfp-pause', 'override.json']) fs.writeFileSync(file(f), 'preserve');
  reset();
  test('all status aliases target portfolio', () => {
    for (const c of ['-status', '-status hype', '-status portfolio']) assert.match(cmd(c)!, /HYPE PORTFOLIO/);
    assert.equal(cmd('-status sui'), null);
    assert.match(cmd('-help')!, /ALL/);
  });
  test('pause and flatten work even without valid config/health', () => {
    fs.writeFileSync(file('portfolio-live-config.json'), '{'); fs.unlinkSync(file(config.healthFile));
    for (const c of ['-pause', '-pause hype', '-pause portfolio']) assert.match(cmd(c)!, /PAUSE saved/);
    for (const c of ['-flatten', '-close', '-close hype', '-close portfolio', '-flatten hype', '-flatten portfolio', '-closeladder']) {
      assert.match(cmd(c)!, /ALL owners/); assert(has('portfolio-pause')); assert(has('portfolio-flatten'));
    }
    assert.match(cmd('-resume')!, /refused/); assert(has('portfolio-pause'));
    assert.match(cmd('-status')!, /UNKNOWN/);
  });
  test('resume removes ONLY the portfolio pause', () => {
    for (const c of ['-resume', '-resume hype', '-resume portfolio']) {
      reset(); assert.match(cmd(c)!, /pause removed/); assert(!has('portfolio-pause'));
      for (const f of ['bot-pause', 'lawbster-sfp-pause', 'override.json']) assert.equal(fs.readFileSync(file(f), 'utf8'), 'preserve');
      assert.deepEqual(JSON.parse(fs.readFileSync(file('portfolio-live-config.json'), 'utf8')), config);
    }
    for (const f of ['bot-resume', 'bot-flatten', 'bot-regime-arm']) assert(!has(f));
  });
  test('unsafe resume is refused', () => {
    const cases: ((h: StatusHealth) => void)[] = [
      h => { h.writtenAt = now - 31000; }, h => { h.writtenAt = now + 1; },
      h => { h.reconciliation!.at = now - 61000; }, h => { h.reconciliation = null; },
      h => { h.uid = '3674537'; }, h => { h.policy = 'other'; }, h => { h.status = 'degraded'; },
      h => { h.error = 'bad'; }, h => { h.recovery = 'unknown_receipt'; }, h => { h.mode = 'observe'; },
      h => { h.enabled = false; }, h => { h.configuredEntryEnabled = false; },
      h => { h.monitor = undefined; }, h => { h.pending = undefined; }, h => { h.pending = [{ resting: false }]; },
      h => { h.monitor!.reservations = 1; }, h => { h.monitor!.activeExits = 1; }, h => { h.monitor!.flattenRequested = true; },
      h => { h.pending = [{ resting: true }]; h.monitor!.pendingMutations = 1; },
    ];
    for (const mutate of cases) {
      reset(); const h = healthy(); mutate(h); write(config.healthFile, h);
      assert.match(cmd('-resume')!, /refused/); assert(has('portfolio-pause'));
    }
    for (const patch of [{ enabled: false }, { mode: 'observe' }, { entryEnabled: false }]) {
      reset(); write('portfolio-live-config.json', { ...config, ...patch }); assert.match(cmd('-resume')!, /refused/);
      assert(has('portfolio-pause'));
    }
    reset(); fs.writeFileSync(file('portfolio-flatten'), 'drain'); assert.match(cmd('-resume')!, /refused/); assert(has('portfolio-flatten'));
  });
  test('resting protection does not prevent safe resume', () => {
    reset(); const h = healthy(); h.pending = [{ resting: true }]; write(config.healthFile, h);
    assert.match(cmd('-resume')!, /pause removed/);
  });
  test('stale or future Discord actions never mutate files', () => {
    reset();
    for (const at of [now - 90001, now + 1, NaN]) for (const c of ['-pause', '-resume', '-flatten']) {
      assert.match(cmd(c, at)!, /expired/); assert(!has('portfolio-flatten'));
      assert.equal(fs.readFileSync(file('portfolio-pause'), 'utf8'), 'paused');
    }
  });
  test('legacy HYPE overrides cannot reach old bot', () => {
    for (const c of ['-override hype 15', '-override hype reset', '-regime-arm hype', '-regime-arm portfolio'])
      assert.match(cmd(c)!, /NOT changed/);
    assert.equal(cmd('-pause sui'), null); assert.equal(cmd('-resume fart'), null);
  });
  test('stale/missing status never becomes legacy PnL', () => {
    reset(); const h = healthy(); h.writtenAt = now - 31000; write(config.healthFile, h);
    write('bot-state.json', { realizedPnl: 6913.94 }); assert.match(portfolioStatusFromDisk(root, now), /STALE/);
    assert(!portfolioStatusFromDisk(root, now).includes('6913.94'));
  });
  test('flat dashboard preserves accounting and low-noise cadence', () => {
    const h = healthy(), text = formatPortfolioStatus(h, now);
    assert.match(text, /Ladder 0\/11: flat/); assert.match(text, /Slot 3: flat/); assert.match(text, /MACD R3: flat/);
    assert.match(text, /realized since activation \$12.00/); assert.match(text, /funding \$-1.00/);
    const incomplete = formatPortfolioStatus({ ...h, mainContext: { horizonDays: 14,
      coverage: { healthy: false, actualContinuousBars: 3999, expectedBars: 4032, firstMissingTs: now - 4000 * 300000 },
      overextended: { missing: ['fiveMinute14d'] }, repair: { pending: false, lastError: 'timeout', nextAttemptAt: now + 30000 } } }, now);
    assert.match(incomplete, /3999\/4032 closed 5m/); assert.match(incomplete, /fiveMinute14d/);
    assert.match(incomplete, /repair retry/); assert.match(incomplete, /last repair error timeout/);
    const logger = new PortfolioStatusLogger(), lines: string[] = [];
    logger.emit(h, now, v => lines.push(v)); logger.emit(h, now + 1000, v => lines.push(v)); assert.equal(lines.length, 1);
    h.reconciliation!.equity = 19001; logger.emit(h, now + 2000, v => lines.push(v)); assert.equal(lines.length, 1);
    logger.emit(h, now + 60000, v => lines.push(v)); assert.equal(lines.length, 2);
    h.entryEnabled = true; logger.emit(h, now + 61000, v => lines.push(v)); assert.equal(lines.length, 3);
  });
  test('owner-specific PnL, protection and timers from receipts', () => {
    const s = emptyLedger('555249668');
    s.lots.a = { id: 'a', owner: 'main', source: 'main', qty: 10, cost: 1000, side: 1, openedAt: now - 3600000, entryFees: .55 };
    s.lots.b = { id: 'b', owner: 'setup0', source: 'SF08', qty: 2, cost: 200, side: 1, openedAt: now - 60000, entryFees: .11 };
    s.lots.c = { id: 'c', owner: 'R3', source: 'R3', qty: 3, cost: 315, side: -1, openedAt: now - 60000, entryFees: .17 };
    const intent = (link: string, lotId: string): Intent => ({ link, lotId, owner: s.lots[lotId].owner, source: s.lots[lotId].source,
      side: s.lots[lotId].side, kind: 'open', at: s.lots[lotId].openedAt, qty: s.lots[lotId].qty, appliedQty: s.lots[lotId].qty,
      terminal: true, reason: 'fixture', allocations: [] });
    s.orders.a = { ...intent('a', 'a'), reservation: { mainLevel: 0 } as Intent['reservation'] };
    s.orders.b = intent('b', 'b'); s.orders.c = intent('c', 'c');
    s.orders.tp = { ...intent('tp', 'a'), kind: 'close', terminal: false, appliedQty: 0, restingConfirmedAt: now,
      command: { version: 1, uid: s.uid, symbol: s.symbol, link: 'tp', at: now, orderType: 'Limit', side: 'Sell',
        positionIdx: 1, qty: '10', reduceOnly: true, protection: { kind: 'maker_tp', price: '103.2' } } };
    const child = (kind: 'tp' | 'sl'): BracketChild => ({ orderId: kind, parentOrderLinkId: 'b', kind, side: 'Sell', positionIdx: 1,
      mode: 'Partial', orderType: 'Market', reduceOnly: true, triggerBy: 'LastPrice', triggerDirection: kind === 'tp' ? 1 : 2,
      price: kind === 'tp' ? '104' : '95', qty: 2, cumulativeQty: 0, status: 'Untriggered', executions: [] });
    s.brackets = { b: { parentLink: 'b', children: [child('tp'), child('sl')] } };
    s.lifecycle = { version: 1, entries: {}, exits: { c: { lotId: 'c', owner: 'R3', source: 'R3', entryAt: now - 60000,
      causeAt: now + 43140000, dueAt: now + 43200000, recordedAt: now, reason: 'timeout' } } };
    const a = { ...account, openLinks: ['tp', 'venue:tp', 'venue:sl'] }, before = JSON.stringify(s);
    const m = buildPortfolioMonitor(s, a, null, now, controls, null);
    assert.equal(m.owners[0].rungs, 1); assert.equal(m.owners[0].unrealized, 10);
    assert.equal(m.owners[4].unrealized, 9); assert.equal(m.owners[4].exitAt, now + 43200000);
    assert.match(m.owners[0].protection, /103.2 \(last verified\)/);
    assert.equal(m.confirmedResting, 1); assert.equal(m.pendingMutations, 0);
    assert.match(m.owners[1].protection, /TP 104 \/ SL 95 \(last verified\)/);
    assert.match(m.owners[4].protection, /by design/); assert.equal(JSON.stringify(s), before);
    assert.match(buildPortfolioMonitor(s, { ...a, openLinks: [] }, null, now, controls, null).owners[0].protection, /NOT confirmed/);
    assert.equal(buildPortfolioMonitor(s, { ...a, openLinks: [] }, null, now, controls, null).pendingMutations, 1);
    assert.match(buildPortfolioMonitor(s, a, null, now, controls, 'mismatch').owners[1].protection, /NOT confirmed/);
    const stale = buildPortfolioMonitor(s, a, null, now + 60001, controls, null);
    assert.equal(stale.owners[0].unrealized, null); assert.match(stale.owners[1].protection, /NOT confirmed/);
    const text = formatPortfolioStatus({ ...healthy(), monitor: m }, now);
    assert.match(text, /long \$1200.00 \| short \$315.00 \| net \$885.00/);
    for (const c of discordStatusChunks(text)) assert(c.length <= 1850);
    assert(discordStatusChunks('x'.repeat(6000)).every(c => c.length <= 1850));
  });
  console.log(`portfolio commander/status: ${checks} groups passed (file-only; no venue/Discord writes)`);
} finally {
  // Only the literal mkdtemp path owned by this test, never repository data.
  assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'portfolio-commander-'));
  fs.rmSync(root, { recursive: true, force: true });
}
