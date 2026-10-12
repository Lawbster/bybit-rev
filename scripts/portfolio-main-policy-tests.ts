import assert from 'assert/strict';
import fs from 'fs';
import { createHash } from 'crypto';
import { loadBotConfig } from '../src/bot/bot-config';
import { checkTrendGate, checkMarketRiskOff, checkHardFlatten, checkLadderKill } from '../src/bot/strategy';
import { evaluateMainExits, evaluateMainAdd, mainCandles, overextendedContextStatus, validateMainPolicyConfig, type MainPolicyInputs, type MainCandleInput } from '../src/bot/portfolio/main-policy';
import { PortfolioMainDriver } from '../src/bot/portfolio/main-driver';
import { PortfolioMainFeed } from '../src/bot/portfolio/main-feed';
import { PortfolioRuntime } from '../src/bot/portfolio/runtime';
import { PortfolioSetupRuntime } from '../src/bot/portfolio/setup-runtime';
import { PortfolioPersistenceError } from '../src/bot/portfolio/ledger';
import { SRMemoryZoneEngine, DEFAULT_SR_MEMORY_ZONE_CONFIG } from '../src/bot/sr-memory-zones';
import { fixture } from './portfolio-main-runtime-tests';
import { T } from './portfolio-execution-tests';
import type { PortfolioLedger } from '../src/bot/portfolio/ledger';
const config = loadBotConfig('bot-config.json'), M = 60000, H = 60 * M, D = 24 * H;
const cases: string[] = [];
function rows(now: number, tf: number, n: number, value = (i: number) => 100, grace = 10000): MainCandleInput {
  const end = (Math.floor((now - grace) / tf) - 1) * tf;
  return { at: now, healthy: true, value: Array.from({ length: n }, (_, i) => {
    const close = value(i); return { timestamp: end - (n - 1 - i) * tf, open: close, high: close + .1, low: close - .1, close, volume: 10, turnover: 10 * close };
  }) };
}
export function policyInputs(now: number, bid = 100): MainPolicyInputs {
  const at = Math.floor(now / M) * M;
  return { quote: { at: now, value: { bid, tick: .01, qtyStep: .01 } }, funding: { at: now, value: 0 },
    hype4h: rows(now, 4 * H, 220), btc1h: rows(now, H, 24), hype1h: rows(now, H, 30), hype1d: rows(now, D, 30),
    fiveMinute: rows(now, 5 * M, 4032, undefined, 0), indicators: { at: now, value: { crsi4H: 50, rsi1H: 50 } }, pulse: null, sr: null,
    high: { at: now, value: { healthy: true, decisionReady: now - at <= 30000, reason: 'healthy', decisionAt: at,
      sourceStart: at - 2880 * M, bars: 2880, high: 110, close: 100, distancePct: (1 - 100 / 110) * 100 } },
    reference7d: { at: now, value: { close: 100, closeTime: at - 7 * D } } };
}
function setHigh(x: MainPolicyInputs, high: number, close: number) {
  Object.assign(x.high!.value, { high, close, distancePct: (1 - close / high) * 100 });
}
async function test(name: string, n: number, run: (s: PortfolioLedger, x: MainPolicyInputs, now: number, f: ReturnType<typeof fixture>) => void | Promise<void>) {
  const f = fixture();
  try {
    for (let i = 0; i < n; i++) { f.time(T + i * 1000); await f.add(`r${i}`); }
    const now = T + 2 * H + 20000; f.time(now);
    await run(f.c.store.snapshot, policyInputs(now), now, f); cases.push(name);
  } catch (e) { throw new Error(name, { cause: e }); }
  finally { f.cleanup(); }
}
async function main() {
  validateMainPolicyConfig(config);
  await test('frozen config rejects additional active legacy strategies', 0, () => {
    assert.throws(() => validateMainPolicyConfig({ ...config, maxPositions: 12 }));
    assert.throws(() => validateMainPolicyConfig({ ...config, hedge: { ...config.hedge, enabled: true } }));
    assert.throws(() => validateMainPolicyConfig({ ...config, maxDrawdownPct: 20 }));
  });
  await test('closed feed rejects stale/future/misaligned/gapped/poisoned bars; exact grace', 0, (_s, x, now) => {
    assert(mainCandles(x.hype4h, 4 * H, 201, now));
    for (const change of [(v: MainCandleInput) => { v.at = now + 1; }, (v: MainCandleInput) => { v.value.pop(); },
      (v: MainCandleInput) => { v.value[5].timestamp++; }, (v: MainCandleInput) => { v.value[5].high = NaN; }]) {
      const v = structuredClone(x.hype4h!); change(v); assert.equal(mainCandles(v, 4 * H, 201, now), null);
    }
    const edge = T + 4 * H + 9999, v = rows(edge, 4 * H, 220);
    assert(mainCandles(v, 4 * H, 201, edge)); assert.equal(mainCandles(v, 4 * H, 201, edge + 1), null);
    assert(mainCandles(rows(edge + 1, 4 * H, 220), 4 * H, 201, edge + 1));
  });
  await test('empty book allows exactly original first-rung sizing', 0, (s, x, now) => {
    evaluateMainExits(s, config, x, now); const d = evaluateMainAdd(s, config, x, now, false);
    assert.equal(d.approved, true); assert.equal(d.level, 0); assert.equal(d.notional, 800);
  });
  await test('pause/cooldown/recovery/max-rung affect adds only', 11, (s, x, now) => {
    assert(evaluateMainAdd(s, config, x, now, false).reasons.includes('max_rungs'));
    s.mainControl!.memory.forcedExitCooldownUntil = now + H; s.recovery = 'test incident'; x.quote!.value.bid = 85;
    assert(evaluateMainAdd(s, config, x, now, true).reasons.includes('paused'));
    assert.match(evaluateMainExits(s, config, x, now).action!.kind, /flatten/);
  });
  await test('emergency before funding/hard/high; missing candle sources do not block it', 8, (s, x, now) => {
    x.quote!.value.bid = 85; x.funding!.value = .001; x.hype4h = null; x.high = null;
    const r = evaluateMainExits(s, config, x, now); assert.equal(r.action!.kind, 'flatten');
    if (r.action?.kind === 'flatten') { assert.match(r.action.reason, /EMERGENCY/); assert.equal(r.action.terms.kind, 'forced'); }
  });
  await test('funding guard depth and fresh inputs; stale/NaN rate cannot trigger', 8, (s, x, now) => {
    x.funding!.value = .00012;
    const r = evaluateMainExits(s, config, x, now); assert(r.action?.kind === 'flatten' && r.action.reason.startsWith('FUNDING'));
    x.funding!.at = now - 5001; assert.equal(evaluateMainExits(s, config, x, now).action, null);
    x.funding!.at = now; x.funding!.value = NaN; assert.equal(evaluateMainExits(s, config, x, now).action, null);
  });
  await test('21h flatten still requires hostile trend and -2%; no 12h override', 1, (s, _x, _now) => {
    for (const [age, price, hostile, fires] of [[20, 97, true, false], [21, 99, true, false], [21, 97, false, false], [21, 97, true, true]] as const) {
      const now = T + age * H + 20000, x = policyInputs(now, price);
      if (hostile) x.hype4h = rows(now, 4 * H, 220, i => 120 - i * .1);
      const r = evaluateMainExits(structuredClone(s), config, x, now);
      assert.equal(r.action?.kind === 'flatten', fires);
      if (fires && r.action?.kind === 'flatten') assert.match(r.action.reason, /HARD FLATTEN/);
    }
  });
  await test('high exit survives pre-request crash; durable exit prevents repeats, inclusive 1%', 1, (s, _x) => {
    const now = T + 4 * H + 20000, x = policyInputs(now); setHigh(x, 100, 99);
    assert.equal(evaluateMainExits(s, config, x, now).action?.kind, 'flatten');
    assert.equal(evaluateMainExits(structuredClone(s), config, x, now).action?.kind, 'flatten');
    s.mainControl!.closeTerms = { kind: 'forced', requestedAt: now };
    assert.equal(evaluateMainExits(s, config, x, now).action, null);
    x.high!.value.decisionReady = false; assert.equal(evaluateMainExits(s, config, x, now).action, null);
  });
  await test('high refuses future/expired windows and decisions predating surviving adds', 1, (s, _x) => {
    const now = T + 4 * H + 20000, x = policyInputs(now); setHigh(x, 100, 99);
    x.high!.value.decisionAt! += M; assert.equal(evaluateMainExits(s, config, x, now).action, null);
    x.high!.value.decisionAt! -= M; x.high!.at = now + 1; assert.equal(evaluateMainExits(s, config, x, now).action, null);
    x.high!.at = now + 20000; assert.equal(evaluateMainExits(s, config, x, now + 20000).action, null);
  });
  await test('weak-week requires exact reference; high wins ties; reference failure retains TP path', 1, (s, _x) => {
    const now = T + 40 * H + 20000, x = policyInputs(now, 99); setHigh(x, 110, 99);
    const r = evaluateMainExits(structuredClone(s), config, x, now);
    assert(r.action?.kind === 'flatten' && r.action.terms.policy?.kind === 'weak_week_time_stop');
    x.reference7d!.value.closeTime -= M; assert.equal(evaluateMainExits(structuredClone(s), config, x, now).action, null);
    x.reference7d!.value.closeTime += M; setHigh(x, 100, 99);
    const both = evaluateMainExits(structuredClone(s), config, x, now);
    assert(both.action?.kind === 'flatten' && both.action.terms.policy?.kind === 'aggressive10_high');
  });
  await test('damaged latch bootstraps and stays closed without trend; releases by original two-bar rule', 0, (s, x, now) => {
    x.hype4h = rows(now, 4 * H, 220, i => i >= 218 ? 90 : 100);
    evaluateMainExits(s, config, x, now); assert.equal(s.mainControl!.memory.damagedRegimeLatch.active, true);
    const later = policyInputs(now + M); later.hype4h = null;
    evaluateMainExits(s, config, later, now + M); assert.equal(s.mainControl!.memory.damagedRegimeLatch.active, true);
    const recovered = policyInputs(now + 2 * M);
    evaluateMainExits(s, config, recovered, now + 2 * M); assert.equal(s.mainControl!.memory.damagedRegimeLatch.active, false);
  });
  await test('original timer and price-drop paths; price-drop survives slow deep timer', 5, (s, x, now) => {
    s.mainControl!.memory.lastAddTime = now - 40 * M;
    x.fiveMinute = rows(now, 5 * M, 4032, i => 150 - i * .01, 0);
    let r = evaluateMainAdd(s, config, x, now, false); assert.equal(r.approved, false); assert.equal(r.timeGateOk, false);
    x.quote!.value.bid = 99.69; r = evaluateMainAdd(s, config, x, now, false);
    assert.equal(r.approved, true); assert.equal(r.priceDropOk, true); assert.equal(r.timeGateOk, false);
    assert.equal(r.notional, 800 * 1.35 ** 5);
  });
  await test('missing throttle and fresh-entry context fail closed, but unrelated sources do not gate adds', 5, (s, x, now) => {
    x.fiveMinute = null; assert(evaluateMainAdd(s, config, x, now, false).reasons.includes('throttle_context_unavailable'));
    x.fiveMinute = rows(now, 5 * M, 72, undefined, 0); x.hype1h = null; x.indicators = null; x.pulse = null;
    assert.equal(evaluateMainAdd(s, config, x, now, false).approved, true);
    x.fiveMinute.value.unshift({ ...x.fiveMinute.value[0], timestamp: x.fiveMinute.value[0].timestamp - 10 * M });
    assert.equal(evaluateMainAdd(s, config, x, now, false).approved, true, 'an old gap outside the 72-bar throttle window is irrelevant');
  });
  await test('BTC cooldown exactly matches old gate and persists', 0, (s, x, now) => {
    x.btc1h = rows(now, H, 24, i => i === 23 ? 96 : 100);
    const old = checkMarketRiskOff(x.btc1h.value, config, now, s.mainControl!.memory.riskOffUntil);
    assert.equal(evaluateMainAdd(s, config, x, now, false).approved, false);
    assert.equal(s.mainControl!.memory.riskOffUntil, old.riskOffUntil);
  });
  await test('fresh-entry overextension uses original three-way AND, not on existing ladder', 0, (s, x, now) => {
    x.hype1h = rows(now, H, 30, i => 90 + i); x.indicators!.value = { crsi4H: 50, rsi1H: 65 };
    assert(evaluateMainAdd(s, config, x, now, false).reasons.some(r => r.startsWith('OVEREXTENDED')));
    x.indicators!.value.rsi1H = 50; assert.equal(evaluateMainAdd(s, config, x, now, false).approved, true);
    x.indicators!.value.crsi4H = null;
    assert(evaluateMainAdd(s, config, x, now, false).reasons.includes('overextended_context_unavailable'));
  });
  await test('regime red/green memory uses original daily gate; no reset on restart', 0, (s, x, now) => {
    x.hype1d = rows(now, D, 10, i => 110 - i);
    s.mainControl!.memory.regime.lastDayProcessed = Math.floor(x.hype1d.value[0].timestamp / D);
    assert(evaluateMainAdd(s, config, x, now, false).reasons.some(r => r.includes('REGIME')));
    assert.equal(s.mainControl!.memory.regime.flatActive, true);
    assert.equal(evaluateMainAdd(structuredClone(s), config, x, now, false).approved, false);
  });
  await test('SR plan comes from shared evaluator on main IDs; pulse remains required', 6, (s, x, now) => {
    x.quote!.value.bid = 100.5;
    const zone = new SRMemoryZoneEngine({ ...DEFAULT_SR_MEMORY_ZONE_CONFIG, enabled: true });
    const lv = { price: 100.6, confirmTs: now - H, touches: 2, highTouches: 2, lowTouches: 0, touchData: [] };
    zone.needsRebuild = () => false; zone.nearestResistance = () => ({ lv, dist: (100.6 / 100.5 - 1) });
    zone.nearestSupport = () => null; zone.getZones = () => [lv];
    x.sr = { at: now, value: { zoneEngine: zone, contextCoverageHorizonDays: 14,
      contextCoverage: { healthy: true, horizonStart: now - 14 * D, latestClosedTs: now - 5 * M,
        earliestContinuousTs: now - 14 * D, expectedBars: 4032, actualContinuousBars: 4032 } } };
    const pulse = new Proxy({ taker4h: .9 } as NonNullable<MainPolicyInputs['pulse']>['value'], {
      get: (t, key: string) => key in t ? t[key as keyof typeof t] : null });
    x.pulse = { at: now, value: pulse };
    const r = evaluateMainExits(s, config, x, now); assert.equal(r.action?.kind, 'partial');
    if (r.action?.kind === 'partial') assert.equal(r.action.action.positionIds.length, 3);
    pulse.taker4h = 1.2; assert.equal(evaluateMainExits(s, config, x, now).action, null);
    pulse.taker4h = .9; s.mainControl!.memory.srPartialExitActionUntil = now + M;
    assert.equal(evaluateMainExits(s, config, x, now).action, null);
  });
  await test('parent pure gates match across deterministic varied closed histories', 1, (s, _x, now) => {
    for (let k = 0; k < 40; k++) {
      const x = policyInputs(now); x.hype4h = rows(now, 4 * H, 220, i => 100 + (k % 2 ? -1 : 1) * i * .04 + Math.sin(i + k));
      const old = checkTrendGate(x.hype4h.value, config, now), out = evaluateMainExits(structuredClone(s), config, x, now);
      assert.deepEqual(out.trend, old);
      const a = evaluateMainAdd(structuredClone(s), config, x, now, false);
      assert.equal(a.reasons.some(r => r.startsWith('trend-break')), old.blocked);
      assert.equal(a.reasons.some(r => r.startsWith('ladder-kill')), checkLadderKill(s.mainControl!.memory.positions, 100, now, config).blocked);
    }
  });
  await test('driver opens owned main only, uses closed mark/cash, arms TP after receipts', 0, async (_s, _x, now, f) => {
    let at = now;
    f.ex.extra.decisionCash = { balance: 19047, observedAt: now, scope: 'USDT_ONLY_HYPE_OWNED' };
    const feed = { request() {}, latest: () => policyInputs(at), decisionMark: () => ({ price: 100, priceKnownAt: at, markedThrough: Math.floor(at / M) * M }) };
    const d = new PortfolioMainDriver(f.runtime, config, feed, { entriesAllowed: () => true, clock: () => at });
    const r = await d.tryAdd(); assert.equal(r.result.state, 'submitted'); f.ex.fill(r.result.link!);
    await d.service(); assert.equal(f.c.store.snapshot.mainControl!.memory.positions.length, 1);
    assert(f.ex.commands.some(c => c.protection?.kind === 'maker_tp'));
  });
  await test('pause leaves emergency close reachable and never opens another rung', 1, async (_s, _x, now, f) => {
    const feed = { request() {}, latest: () => policyInputs(now, 85), decisionMark: () => null };
    const d = new PortfolioMainDriver(f.runtime, config, feed, { entriesAllowed: () => false, clock: () => now });
    assert.equal((await d.tryAdd()).result.reason, 'paused'); await d.service(); await d.service();
    assert.equal(f.ex.commands.filter(c => !c.reduceOnly).length, 1);
    assert(f.c.store.snapshot.exitRequests?.main?.reason.startsWith('EMERGENCY'));
  });
  await test('slow account read triggers fresh gate decision before submission', 0, async (_s, _x, now, f) => {
    let at = now;
    f.ex.waitSnapshot = async () => { at += 1000; f.time(at); f.ex.extra.decisionCash = { balance: 19047, observedAt: at, scope: 'USDT_ONLY_HYPE_OWNED' }; };
    const feed = { request() {}, latest: () => { const x = policyInputs(at); if (at > now + 2000) x.btc1h = null; return x; },
      decisionMark: () => ({ price: 100, priceKnownAt: at, markedThrough: Math.floor(at / M) * M }) };
    const d = new PortfolioMainDriver(f.runtime, config, feed, { entriesAllowed: () => true, clock: () => at });
    await d.tryAdd(); assert.equal(f.ex.commands.length, 0);
  });
  for (const mode of ['success', 'pause', 'gate', 'price_drop_withdrawn', 'exit', 'fill_race', 'missing_cash', 'read_error', 'unknown_cancel', 'final_read_expiry'] as const) {
    await test(`realistic add latency and TP restoration: ${mode}`, 1, async (_s, _x, now, f) => {
      let at = Math.floor(now / M) * M + 1000, quoteAt = at, cancelled = false, allowed = true, readFailed = false;
      let postCancelReads = 0, cancelledAt = 0;
      const advance = (ms: number) => { at += ms; f.time(at); };
      f.time(at);
      const tp = await f.runtime.maintainTarget({ bid: 100, at, tick: .01 });
      if (mode === 'price_drop_withdrawn') f.c.store.transaction(s => { s.mainControl!.memory.lastAddTime = at; });
      const observe = f.ex.observe.bind(f.ex);
      f.ex.observe = async c => { advance(300); return observe(c); };
      f.ex.waitSnapshot = async () => {
        if (cancelled && mode === 'read_error' && !readFailed) { readFailed = true; throw Error('simulated post-cancel read failure'); }
        if (cancelled) postCancelReads++;
        quoteAt = at; advance(mode === 'final_read_expiry' && postCancelReads === 2 ? 4000 : 1600);
        f.ex.extra.decisionCash = cancelled && mode === 'missing_cash' ? undefined
          : { balance: 19047.16, observedAt: quoteAt, scope: 'USDT_ONLY_HYPE_OWNED' };
      };
      f.ex.onCancel = c => {
        advance(3600); cancelled = true; cancelledAt = at;
        if (mode === 'pause') { allowed = false; f.pause(); }
        if (mode === 'fill_race') f.ex.fill(c.link, undefined, at, 101.4);
        else if (mode !== 'unknown_cancel') f.ex.terminal(c.link, 'Cancelled');
      };
      f.ex.onSubmit = c => { if (!c.reduceOnly) f.ex.fill(c.link, undefined, at); };
      const feed = { request() {}, latest: () => {
        const x = policyInputs(at, cancelled && mode === 'exit' ? 85
          : mode === 'price_drop_withdrawn' && !cancelled ? 99.6 : 100);
        x.quote!.at = quoteAt;
        if (cancelled && mode === 'gate') x.btc1h = null;
        return x;
      }, decisionMark: () => ({ price: 100, priceKnownAt: at, markedThrough: Math.floor(at / M) * M }) };
      const driver = new PortfolioMainDriver(f.runtime, config, feed, { entriesAllowed: () => allowed, clock: () => at });
      const setups = new PortfolioSetupRuntime(f.c, { request() {}, latest() { throw Error('no setup feed in main regression'); } },
        { entriesAllowed: () => false, feeRate: .00055, clock: () => at });
      const runtime = new PortfolioRuntime(f.c, driver, setups, () => at);
      if (mode === 'read_error') await assert.rejects(runtime.tick(), /simulated post-cancel read failure/);
      else {
        const r = await runtime.tick();
        if (mode === 'success') assert.equal(r.add.result.state, 'submitted');
        else assert.notEqual(r.add.result.state, 'submitted');
        if (mode === 'final_read_expiry') assert.equal(r.add.result.reason, 'main_capital_or_price_expired');
      }
      assert(cancelled, 'must exercise the cancel-for-add path, not just an earlier gate');
      const opens = f.ex.commands.filter(c => !c.reduceOnly);
      assert.equal(opens.length, mode === 'success' ? 2 : 1);
      const s = f.c.store.snapshot;
      assert.equal(Object.keys(s.reservations).length, 0);
      if (mode === 'success') {
        assert.equal(s.mainControl!.memory.positions.length, 2);
        const decisionAt = s.orders[opens[1].link].reservation!.decisionAt;
        assert(decisionAt >= cancelledAt, 'new approval follows terminal TP cancellation');
        assert(opens[1].at >= decisionAt && opens[1].at - decisionAt <= 5000);
        assert.equal(opens[1].qty, '10.80');
      }
      if (mode === 'fill_race') assert.equal(Object.keys(s.lots).length, 0);
      else if (mode === 'exit') assert(s.exitRequests?.main, 'fresh exit takes priority');
      else {
        const active = Object.values(s.orders).filter(o => !o.terminal && o.command?.protection);
        assert.equal(active.length, 1, 'remaining main inventory gets one TP in this tick');
        if (mode === 'unknown_cancel') assert.equal(active[0].link, tp.link, 'unknown cancellation cannot create duplicate protection');
        else assert.notEqual(active[0].link, tp.link);
        assert.equal(active[0].qty, mode === 'success' ? 18.8 : 8);
      }
    });
  }
  await test('persistence failure during add does not attempt further exchange work', 0, async (_s, _x, now, f) => {
    let services = 0;
    const failure = new PortfolioPersistenceError('fixture persistence failure');
    const driver = { service: async () => { services++; return {}; }, tryAdd: async () => { throw failure; } };
    const runtime = new PortfolioRuntime(f.c, driver as unknown as PortfolioMainDriver,
      { tick: async () => ({}) } as unknown as PortfolioSetupRuntime, () => now);
    await assert.rejects(runtime.tick(), e => e === failure);
    assert.equal(services, 1);
  });
  await test('feed outage cannot crash receipt recovery; clock reversal rejected', 1, async (_s, _x, now, f) => {
    let at = now;
    const d = new PortfolioMainDriver(f.runtime, config, { request() { throw Error('down'); }, latest: () => policyInputs(at), decisionMark: () => null },
      { entriesAllowed: () => true, clock: () => at });
    assert.equal((await d.service()).issue, 'main_feed_unavailable'); at--;
    await assert.rejects(d.service(), /clock reversed/);
  });
  await test('actual main feed is non-blocking and price remains available during bootstrap', 0, async (_s, x, now) => {
    let calls = 0;
    const pulse = {} as NonNullable<MainPolicyInputs['pulse']>['value'];
    const feed = new PortfolioMainFeed({ getCandles: async () => { calls++; return []; } }, config,
      { quote: () => x.quote, funding: () => x.funding, decisionMark: () => null }, { clock: () => now, pulse: async () => pulse });
    Object.defineProperty(feed, 'context', { value: { init: async () => { calls++; throw new Error('bootstrap pending'); } } });
    const before = feed.latest(now); assert.deepEqual(before.quote, x.quote); assert.equal(calls, 0);
    feed.request(now); feed.request(now);
    await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
    const n = calls, after = feed.latest(now); feed.latest(now);
    assert.equal(calls, n); assert(n > 0 && n <= 7, `duplicate request storm: ${n}`); // six readers + one bootstrap, not one per request
    assert.deepEqual(after.quote, x.quote); assert.equal(after.indicators, null); assert.equal(after.fiveMinute, null);
  });
  await test('supplementary context exception never hides price or funding', 0, (_s, x, now) => {
    const feed = new PortfolioMainFeed({ getCandles: async () => [] }, config,
      { quote: () => x.quote, funding: () => x.funding, decisionMark: () => null });
    // Test-only broken reader, no filesystem bootstrap or network.
    Object.defineProperty(feed, 'prepared', { value: true });
    Object.defineProperty(feed, 'context', { value: { getCandles() { throw Error('broken'); } } });
    const v = feed.latest(now); assert.deepEqual(v.quote, x.quote); assert.deepEqual(v.funding, x.funding);
    assert.equal(v.indicators, null); assert.equal(feed.errors.context, 'context_read_failed');
  });
  await test('main context excludes forming/future five-minute OHLC; legacy HTF prefix is explicitly separate', 0, (_s, x, now) => {
    const feed = new PortfolioMainFeed({ getCandles: async () => [] }, config,
      { quote: () => x.quote, funding: () => x.funding, decisionMark: () => null });
    const candles = rows(now, 5 * M, 10000, i => 100 + Math.sin(i / 7), 0).value;
    let generation = 1;
    Object.defineProperty(feed, 'prepared', { value: true });
    Object.defineProperty(feed, 'context', { value: { getCandles: () => candles,
      getRefreshHealth: () => ({ lastSuccessAt: generation }), getClosedCoverageStatus: () => ({ healthy: true,
        horizonStart: now - 14 * D, latestClosedTs: candles.at(-1)!.timestamp, earliestContinuousTs: candles[0].timestamp,
        expectedBars: 4032, actualContinuousBars: 10000 }) } });
    const a = feed.latest(now);
    candles.push({ ...candles.at(-1)!, timestamp: Math.floor(now / (5 * M)) * 5 * M, close: 900, high: 901 }); generation++;
    const b = feed.latest(now);
    assert.deepEqual(b.indicators, a.indicators); assert.deepEqual(b.fiveMinute!.value, a.fiveMinute!.value);
  });
  await test('entry context diagnostics use the actual strict gate predicate', 0, (s, x, now) => {
    assert(overextendedContextStatus(config, x, now).healthy);
    x.fiveMinute!.value = x.fiveMinute!.value.slice(-4000);
    const expected = overextendedContextStatus(config, x, now);
    assert.deepEqual(expected.missing, ['fiveMinute14d']);
    const d = evaluateMainAdd(s, config, x, now, false);
    assert.deepEqual(d.entryContext, expected); assert(d.reasons.includes('overextended_context_unavailable'));
    x.indicators!.value.crsi4H = null; x.hype1h = null;
    assert.deepEqual(overextendedContextStatus(config, x, now).missing, ['hype1h', 'fiveMinute14d', 'indicators']);
  });
  await test('incomplete startup history stays visible and retries non-blocking with backoff', 0, async (_s, x, now) => {
    let at = now, calls = 0, complete = false;
    let reject!: (e: Error) => void, resolve!: (v: any) => void;
    const flush = () => new Promise<void>(r => setImmediate(r));
    const coverage = (days: number) => ({ healthy: days <= .25 || complete, expectedBars: Math.ceil(days * 288),
      actualContinuousBars: complete ? 4032 : 4000, firstMissingTs: complete ? undefined : now - 4001 * 5 * M });
    const feed = new PortfolioMainFeed({ getCandles: async () => [] }, config,
      { quote: () => x.quote, funding: () => x.funding, decisionMark: () => null },
      { clock: () => at, indicators: () => x.indicators, pulse: async () => ({} as any) });
    Object.defineProperty(feed, 'context', { value: {
      init: async () => {},
      getCandles: () => complete ? x.fiveMinute!.value : x.fiveMinute!.value.slice(-4000),
      getClosedCoverageStatus: (_at: number, days: number) => coverage(days),
      getRefreshHealth: () => ({ pending: false }), getHydrationStatus: () => ({ pagesFetched: 4, stoppedReason: 'api_error', error: 'timeout' }),
      repairClosedCoverage: () => { calls++; return new Promise((yes, no) => { resolve = yes; reject = no; }); },
    } });
    await feed.prepare(); assert.equal(feed.errors.context, 'context_history_incomplete');
    feed.request(at); feed.request(at); assert.equal(calls, 1);
    assert.deepEqual(feed.latest(at).quote, x.quote); // reads/exits never await the repair
    assert.equal(feed.diagnostics(at).coverage.healthy, false); assert(feed.diagnostics(at).repair.pending);
    reject(Error('fixture timeout')); await flush();
    let repair = feed.diagnostics(at).repair; assert.equal(repair.nextAttemptAt, at + 30000); assert.equal(repair.failures, 1);
    at += 29999; feed.request(at); assert.equal(calls, 1);
    at++; feed.request(at); assert.equal(calls, 2); reject(Error('fixture timeout')); await flush();
    repair = feed.diagnostics(at).repair; assert.equal(repair.nextAttemptAt, at + 60000);
    at += 60000; feed.request(at); assert.equal(calls, 3); complete = true; resolve(coverage(14)); await flush();
    feed.latest(at); assert.equal(feed.errors.context, null); assert(feed.diagnostics(at).coverage.healthy);
    assert.equal(feed.diagnostics(at).repair.failures, 0); assert.equal(feed.diagnostics(at).repair.lastError, null);
    feed.request(at + 10000); assert.equal(calls, 3); // no needless page fetch after healing
  });
  const hash = (v: Buffer | string) => createHash('sha256').update(v).digest('hex');
  const files = ['scripts/portfolio-main-policy-tests.ts', 'scripts/portfolio-main-runtime-tests.ts', 'scripts/portfolio-execution-tests.ts',
    'src/bot/strategy.ts', 'src/bot/sr-shadow.ts', 'src/bot/damaged-regime-latch.ts', 'src/bot/time-stop.ts', 'bot-config.json',
    ...fs.readdirSync('src/bot/portfolio').filter(n => n.endsWith('.ts')).map(n => `src/bot/portfolio/${n}`)];
  const code = Object.fromEntries(files.map(f => [f, hash(fs.readFileSync(f))]));
  const out = `backtests/portfolio-main-policy-verification/${hash(JSON.stringify(code)).slice(0, 16)}`;
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ code, cases, checks: cases.length,
    realExchangeCalls: 0, economicReplays: 0, scope: 'main policy/driver tests; no live transport or full economic replay' }, null, 2) + '\n');
  console.log(`portfolio main policy tests passed (${cases.length} cases)\n${out}/verification.json`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
