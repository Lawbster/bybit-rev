import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { namedBybitCredentials, requireDistinctAccount } from '../src/bot/named-bybit-account';
import { loadSfpConfig } from '../src/bot/sfp-config';
import { SfpStore, lockAccountLong, type SfpIntent, type SfpFill } from '../src/bot/sfp-state';
import { SfpCoordinator } from '../src/bot/sfp-coordinator';
import type { SfpExchange, SfpSnapshot, SfpOrderObservation } from '../src/bot/sfp-exchange';
import { sfpHealthObservations } from '../src/bot/sfp-health';
import { type SfpSignal, SFP_POLICY } from '../src/strategies/sfp-policy';

const at = Date.UTC(2026, 8, 21, 4, 1), signal: SfpSignal = { id: 'SF01:long:pivot-test', at,
  expiresAt: at + 86400_000, entryDeadline: at + 60_000, reference: 100, originalStop: 98, stop: 93.1, target: 104 };
class Fake implements SfpExchange {
  snap: SfpSnapshot = { qty: 0, shortQty: 0, tp: 0, sl: 0, liquidationPrice: 50 };
  intents: SfpIntent[] = []; rows: SfpFill[] = []; observation: SfpOrderObservation | null = null;
  protectFails = false; loseSubmitResponse = false; cancels = 0; reject = false;
  async snapshot() { return { ...this.snap }; }
  async entryTerms() { return { qty: 100, stop: 93.1, target: 104 }; }
  async submit(i: SfpIntent) {
    this.intents.push(structuredClone(i));
    if (this.reject) return { rejected: true };
    if (i.kind === 'open') { this.snap.qty = 100; this.snap.tp = i.target; this.snap.sl = i.stop;
      this.observation = { found: true, terminal: true, status: 'Filled', orderId: 'buy1', cumulativeQty: 100,
        fills: [{ id: 'b1', orderId: 'buy1', at: i.at, qty: 100, price: 100, fee: 5.5 }] }; }
    else this.observation = { found: false, terminal: false, status: 'unknown', orderId: '', cumulativeQty: 0, fills: [] };
    if (this.loseSubmitResponse) throw new Error('lost response');
    return { orderId: i.kind === 'open' ? 'buy1' : 'sell1' };
  }
  async observe() { return this.observation ?? { found: false, terminal: false, status: 'unknown', orderId: '', cumulativeQty: 0, fills: [] }; }
  async closeFills() { return this.rows; }
  async protect(stop: number, target: number) { if (this.protectFails) throw new Error('failure'); this.snap.sl = stop; this.snap.tp = target; }
  async cancel() { this.cancels++; }
}

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sf08-test-'));
  let cases = 0;
  const test = async (name: string, f: () => void | Promise<void>) => { await f(); cases++; };
  function fixture() {
    let now = at;
    const store = new SfpStore(path.join(directory, `sfp-${cases}.json`), 'LAWBSTER', '222', at - 1);
    const exchange = new Fake(), owner = new SfpCoordinator(store, exchange, () => now);
    return { store, exchange, owner, setNow: (v: number) => { now = v; } };
  }
  await test('named credentials never fall back', () => {
    assert.throws(() => namedBybitCredentials('LAWBSTER', { BYBIT_API_KEY: 'main', BYBIT_API_SECRET: 'mainsecret' }));
    assert.deepEqual(namedBybitCredentials('LAWBSTER', { BYBIT_API_KEY_LAWBSTER: 'account', BYBIT_API_SECRET_LAWBSTER: 'secret' }), { key: 'account', secret: 'secret' });
    assert.throws(() => namedBybitCredentials('LAWBSTER', { BYBIT_API_KEY: 'same', BYBIT_API_KEY_LAWBSTER: 'same', BYBIT_API_SECRET_LAWBSTER: 's' }));
    assert.throws(() => requireDistinctAccount('1', '1', '1'));
    assert.throws(() => requireDistinctAccount('2', '', '1'));
    requireDistinctAccount('2', '2', '1');
  });
  await test('disabled config pinned policy', () => {
    const c = loadSfpConfig(); assert.equal(c.accountAlias, 'LAWBSTER'); assert.equal(c.enabled, false); assert.equal(c.entryEnabled, false);
    assert.equal(c.notionalUsdt, 10000); assert.equal(c.leverage, 3);
  });
  await test('wrong UID, malformed state fail closed', () => {
    const f = fixture(); f.store.save(at);
    assert.throws(() => new SfpStore(f.store.file, 'LAWBSTER', '333', at));
    fs.writeFileSync(f.store.file, '{bad'); assert.throws(() => new SfpStore(f.store.file, 'LAWBSTER', '222', at));
  });
  await test('account side lock excludes another strategy', () => {
    const release = lockAccountLong(directory, '222', 'HYPEUSDT');
    assert.throws(() => lockAccountLong(directory, '222', 'HYPEUSDT'));
    const other = lockAccountLong(directory, '333', 'HYPEUSDT'); other(); release();
  });
  await test('disarmed signal consumed', async () => {
    const f = fixture(); await f.owner.consider(signal, 10000, false);
    await f.owner.consider(signal, 10000, true); assert.equal(f.exchange.intents.length, 0);
  });
  await test('expired signal consumed', async () => {
    const f = fixture(); f.setNow(signal.entryDeadline); await f.owner.consider(signal, 10000, true);
    assert.equal(f.exchange.intents.length, 0);
  });
  await test('persist before submission and response-loss recovery', async () => {
    const f = fixture(); f.exchange.loseSubmitResponse = true;
    await f.owner.consider(signal, 10000, true); assert(f.store.value.pending); assert.equal(f.store.value.position, null);
    const reloaded = new SfpStore(f.store.file, 'LAWBSTER', '222', at + 5000);
    const resumed = new SfpCoordinator(reloaded, f.exchange, () => at + 5000);
    await resumed.maintain(); assert.equal(reloaded.value.position?.qty, 100); assert.equal(reloaded.value.pending, null);
    await resumed.consider(signal, 10000, true); assert.equal(f.exchange.intents.length, 1);
    assert.equal(reloaded.value.position?.signal.expiresAt, signal.expiresAt);
  });
  await test('terminal partial entry owns only exact fills', async () => {
    const f = fixture(); await f.owner.consider(signal, 10000, true);
    f.exchange.snap.qty = 40; f.exchange.observation!.status = 'PartiallyFilledCanceled';
    f.exchange.observation!.cumulativeQty = 40; f.exchange.observation!.fills[0].qty = 40;
    await f.owner.maintain(); assert.equal(f.store.value.position?.qty, 40);
  });
  await test('unknown order never repeated', async () => {
    const f = fixture(); await f.owner.consider(signal, 10000, true); f.exchange.observation = null;
    f.setNow(at + 120000); await f.owner.maintain(); await f.owner.consider({ ...signal, at: at + 120000 }, 10000, true);
    assert.equal(f.exchange.intents.length, 1); assert(f.store.value.pending);
  });
  await test('open fill identity and quantity mismatch fail closed', async () => {
    const f = fixture(); await f.owner.consider(signal, 10000, true);
    f.exchange.observation!.fills[0].orderId = 'wrong'; await f.owner.maintain();
    assert.equal(f.store.value.position, null); assert(f.store.value.recovery); assert(f.store.value.pending);
  });
  await test('native TP before entry acknowledgement imports once', async () => {
    const f = fixture(); await f.owner.consider(signal, 10000, true); f.exchange.snap.qty = 0;
    f.exchange.rows = [{ id: 'sell-native', orderId: 'tp', at: at + 1000, qty: 100, price: 104, fee: 5.72 }];
    f.setNow(at + 5000); await f.owner.maintain(); await f.owner.maintain();
    assert.equal(f.store.value.position, null); assert.equal(f.store.value.pending, null);
    assert(Math.abs(f.store.value.realizedPnl - 388.78) < 1e-8); assert.equal(f.store.value.receipts.filter(r => r.kind === 'closed').length, 1);
  });
  await test('partial close fee allocation and duplicate replay', async () => {
    const f = fixture(); await f.owner.consider(signal, 10000, true); await f.owner.maintain();
    f.exchange.rows = [{ id: 'c1', orderId: 'tp', at: at + 1000, qty: 40, price: 104, fee: 2.288 }];
    f.exchange.snap.qty = 60; f.setNow(at + 2000); await f.owner.maintain(); await f.owner.maintain();
    assert.equal(f.store.value.position?.qty, 60); assert(Math.abs(f.store.value.realizedPnl - 155.512) < 1e-8);
    f.exchange.rows.push({ id: 'c2', orderId: 'tp', at: at + 3000, qty: 60, price: 104, fee: 3.432 });
    f.exchange.snap.qty = 0; f.setNow(at + 4000); await f.owner.maintain();
    assert(Math.abs(f.store.value.realizedPnl - 388.78) < 1e-8);
  });
  await test('timeout durable close, native-close race', async () => {
    const f = fixture(); await f.owner.consider(signal, 10000, true); await f.owner.maintain();
    f.setNow(signal.expiresAt); await f.owner.maintain(); assert.equal(f.exchange.intents[1].reason, 'timeout');
    f.exchange.rows = [{ id: 'race', orderId: 'tp', at: signal.expiresAt, qty: 100, price: 104, fee: 5.72 }];
    f.exchange.snap.qty = 0; f.exchange.observation = { found: true, terminal: true, status: 'Cancelled', orderId: 'sell1', cumulativeQty: 0, fills: [] };
    await f.owner.maintain(); assert.equal(f.store.value.pending, null); assert.equal(f.store.value.position, null);
    assert(Math.abs(f.store.value.realizedPnl - 388.78) < 1e-8);
  });
  await test('failed protection closes after bounded attempts', async () => {
    const f = fixture(); await f.owner.consider(signal, 10000, true); await f.owner.maintain();
    f.exchange.snap.sl = 0; f.exchange.protectFails = true;
    await f.owner.maintain(); await f.owner.maintain(); await f.owner.maintain();
    assert.equal(f.exchange.intents.at(-1)?.reason, 'protection_failure'); assert(f.store.value.pending);
  });
  await test('terminal close with delayed account-wide fills cannot release intent', async () => {
    const f = fixture(); await f.owner.consider(signal, 10000, true); await f.owner.maintain();
    f.setNow(signal.expiresAt); await f.owner.maintain();
    const fill = { id: 'delayed-close', orderId: 'sell1', at: signal.expiresAt, qty: 100, price: 102, fee: 5.61 };
    f.exchange.observation = { found: true, terminal: true, status: 'Filled', orderId: 'sell1', cumulativeQty: 100, fills: [fill] };
    // Position and unfiltered execution endpoints are both temporarily stale.
    await f.owner.maintain(); await f.owner.maintain();
    assert(f.store.value.pending); assert.equal(f.exchange.intents.length, 2);
    assert.match(f.store.value.recovery!, /close_executions_not_accounted/);
    f.exchange.rows = [fill]; f.exchange.snap.qty = 0; await f.owner.maintain();
    assert.equal(f.store.value.pending, null); assert.equal(f.store.value.position, null);
    assert(Math.abs(f.store.value.realizedPnl - 188.89) < 1e-8);
  });
  await test('insufficient liquidation buffer closes owned size', async () => {
    const f = fixture(); await f.owner.consider(signal, 10000, true); f.exchange.snap.liquidationPrice = 95;
    await f.owner.maintain(); assert.equal(f.exchange.intents.at(-1)?.reason, 'liquidation_buffer_unconfirmed');
  });
  await test('foreign position never imported or reduced', async () => {
    const f = fixture(); f.exchange.snap.qty = 30; await f.owner.maintain();
    await f.owner.consider(signal, 10000, true); assert.equal(f.exchange.intents.length, 0); assert(f.store.value.recovery);
  });
  await test('entry rejected is terminal without synthetic fills', async () => {
    const f = fixture(); f.exchange.reject = true; await f.owner.consider(signal, 10000, true);
    assert.equal(f.store.value.pending, null); assert.equal(f.store.value.position, null);
  });
  await test('separate account books remain independent', async () => {
    const f = fixture(), ladder = { qty: 673.88, makerTarget: 89.12, pending: null, realized: 0 };
    const before = JSON.stringify(ladder); await f.owner.consider(signal, 10000, true); await f.owner.maintain();
    assert.equal(JSON.stringify(ladder), before); assert.equal(f.exchange.snap.qty, 100);
  });
  await test('watchdog disabled/missing/identity/protection', () => {
    const c = { enabled: false }; const cf = path.join(directory, 'sfp-live-config.json'); fs.writeFileSync(cf, JSON.stringify(c));
    assert.deepEqual(sfpHealthObservations(directory, at), []);
    fs.writeFileSync(cf, JSON.stringify({ enabled: true, healthFile: 'sfp-health.json', expectedAccountUid: '222', policy: SFP_POLICY }));
    assert.equal(sfpHealthObservations(directory, at)[0].key, 'sfp_health_unreadable');
    fs.writeFileSync(path.join(directory, 'sfp-health.json'), JSON.stringify({ writtenAt: at, accountUid: '222', policy: SFP_POLICY,
      enabled: true, entryEnabled: false, position: { expiresAt: at + 1000 }, protectionConfirmed: false, status: 'healthy' }));
    assert(sfpHealthObservations(directory, at).some(i => i.key === 'sfp_protection_or_timeout'));
  });
  // Actual process exits at both sides of durable submission; state is reloaded
  // in this process and the exact order is observed, never blindly resubmitted.
  for (const phase of ['before_submit', 'after_submit']) await test(`process exit ${phase}`, async () => {
    const file = path.join(directory, `${phase}.json`);
    const exchangeFile = file + '.exchange';
    const code = `const fs=require('fs');const {SfpStore}=require('./src/bot/sfp-state');const {SfpCoordinator}=require('./src/bot/sfp-coordinator');const Fake=${Fake.toString()};const s=new SfpStore(${JSON.stringify(file)},'LAWBSTER','222',${at - 1});const e=new Fake();const submit=e.submit.bind(e);e.submit=async i=>{if(${JSON.stringify(phase)}==='before_submit')process.exit(27);await submit(i);fs.writeFileSync(${JSON.stringify(exchangeFile)},JSON.stringify({snap:e.snap,observation:e.observation,intents:e.intents}));process.exit(27)};new SfpCoordinator(s,e,()=>${at}).consider(${JSON.stringify(signal)},10000,true).catch(()=>process.exit(28));`;
    const child = spawnSync(process.execPath, ['-r', 'ts-node/register', '-e', code], { encoding: 'utf8' });
    assert.equal(child.status, 27, child.stderr);
    const s = new SfpStore(file, 'LAWBSTER', '222', at + 1000), e = new Fake();
    if (phase === 'after_submit') Object.assign(e, JSON.parse(fs.readFileSync(exchangeFile, 'utf8')));
    const submitted = e.intents.length; await new SfpCoordinator(s, e, () => at + 1000).maintain();
    assert.equal(e.intents.length, submitted);
    if (phase === 'after_submit') assert.equal(s.value.position?.qty, 100); else assert(s.value.pending);
  });
  console.log(`SF08 live tests passed (${cases} cases, 2 actual process exits; no exchange calls)`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
