/** Offline fault/latency classification; no venue clients or production file writes. */
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { describeFeed, classifyPortfolioIssue, PortfolioIssueTracker } from '../src/bot/portfolio/feed-health';
import { PortfolioFeedPump } from '../src/bot/portfolio/feed-pump';
import { portfolioHealth } from '../src/bot/portfolio/health';
import { PortfolioFeedWorker } from '../src/bot/portfolio/feed-worker';
import { Aggressive10Context } from '../src/bot/aggressive10-context';

const now = Date.UTC(2026, 9, 11, 12, 34, 20), windowAt = Math.floor(now / 60000) * 60000;
let cases = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); cases++; } catch (e) { throw new Error(name, { cause: e }); }
}
function snapshot(at = now) {
  return { at, poll: { windowAt: Math.floor(at / 60000) * 60000, observedAt: at, sources: [] },
    health: { through: Math.floor(at / 60000) * 60000, gapAt: null, error: null, policyError: null }, loader: { error: null } } as unknown as NonNullable<Parameters<typeof describeFeed>[0]>;
}
const base = () => ({ feed: describeFeed(snapshot(), null, false, now, now), missingMain: [] as string[],
  error: null as string | null, recovery: null as string | null, executionIssue: null as string | null, indicatorError: null as string | null });
function highFixture() {
  const rows = Array.from({ length: 2880 }, (_, i) => ({ timestamp: windowAt - (2881 - i) * 60000,
    open: 80, high: 82, low: 79, close: 81, volume: 1 }));
  const high = new Aggressive10Context({ getCandles: async () => { throw Error('no fixture I/O'); } }, 'HYPEUSDT');
  Object.assign(high, { candles: rows });
  return { high, rows };
}
async function main() {
  await test('high rollover is bounded diagnostics, never permission or a gap/error exemption', () => {
    const { high, rows } = highFixture(), at = windowAt + 3000;
    const d = high.diagnostics(at);
    assert.equal(d.transport, 'minute_rollover'); assert.equal(d.bars, 2879);
    assert.equal(d.healthy, false); assert.equal(d.decisionReady, false);
    assert.equal(d.through, windowAt - 60000);
    const x = { ...base(), high: d, missingMain: ['high'] };
    assert.deepEqual(classifyPortfolioIssue(x), { kind: 'feed_delay', reason: 'high_minute_rollover' });
    assert.equal(high.diagnostics(windowAt + 9999).transport, 'minute_rollover');
    assert.equal(high.diagnostics(windowAt + 10000).transport, 'unavailable');
    assert.equal(high.diagnostics(windowAt + 60000).transport, 'unavailable');
    assert.equal(classifyPortfolioIssue({ ...x, high: high.diagnostics(windowAt + 10000) }).kind, 'fault');
    assert.equal(classifyPortfolioIssue({ ...x, missingMain: ['high', 'btc1h'] }).kind, 'fault');
    for (const k of ['error', 'recovery', 'executionIssue', 'indicatorError'] as const)
      assert.equal(classifyPortfolioIssue({ ...x, [k]: 'real_fault' }).kind, 'fault');
    assert.equal(classifyPortfolioIssue({ ...x, feed: { ...x.feed, fault: 'minute_feed_gap' } }).kind, 'fault');
    high.lastError = 'public_candles_rejected'; assert.equal(high.diagnostics(at).transport, 'unavailable');
    high.lastError = null;
    rows[100].high = 70; assert.equal(high.diagnostics(at).transport, 'unavailable'); rows[100].high = 82;
    rows[100].timestamp += 60000; assert.equal(high.diagnostics(at).transport, 'unavailable'); rows[100].timestamp -= 60000;
    Object.assign(high, { candles: rows.slice(1) }); assert.equal(high.diagnostics(at).transport, 'unavailable');
    Object.assign(high, { candles: [...rows.slice(1), { ...rows.at(-1)!, timestamp: windowAt - 60000 }] });
    assert.equal(high.diagnostics(at).transport, 'ready'); assert(high.snapshot(at).decisionReady);
    assert(high.snapshot(windowAt + 31000).healthy); assert(!high.snapshot(windowAt + 31000).decisionReady);
  });
  await test('same strict 5s and minute window, with distinct diagnoses', () => {
    assert.equal(describeFeed(snapshot(), null, false, now, now + 5000).transport, 'ready');
    assert.equal(describeFeed(snapshot(), null, false, now, now + 5001).transport, 'refresh_delayed');
    assert.equal(describeFeed(snapshot(windowAt + 59999), null, false, now, windowAt + 60000).transport, 'window_rollover');
    assert.equal(describeFeed(snapshot(now + 1), null, false, now, now).transport, 'clock_invalid');
    assert.equal(describeFeed(null, null, false, null, now).transport, 'bootstrapping');
    assert.equal(describeFeed(snapshot(), 'bad', false, now, now).transport, 'worker_error');
    assert.equal(describeFeed(snapshot(), null, true, now, now).fault, 'feed_worker_stopped');
  });
  await test('latest never turns diagnostic snapshots into permission or rewrites source time', () => {
    const w = Object.create(PortfolioFeedWorker.prototype);
    Object.assign(w, { value: snapshot(), failed: null, stopped: false, receivedAt: now });
    const r = w.latest(now + 4000); assert(r.ready); assert.equal(r.value.at, now);
    assert.equal(w.latest(now + 5001).ready, false);
    Object.assign(w, { value: snapshot(windowAt + 59999) });
    assert.equal(w.latest(windowAt + 60000).reason, 'window_rollover');
    Object.assign(w, { value: snapshot(now + 1) }); assert.equal(w.latest(now).ready, false);
  });
  await test('timing does not mask retained candle/loader/policy faults', () => {
    for (const fault of ['candle', 'loader', 'policy', 'gap']) {
      const v = snapshot(now - 10000);
      if (fault === 'candle') v.health.error = 'conflicting_final_candle';
      if (fault === 'loader') v.loader.error = 'read_failed';
      if (fault === 'policy') v.health.policyError = 'policy_failed';
      if (fault === 'gap') v.health.gapAt = windowAt - 60000;
      const x = { ...base(), feed: describeFeed(v, null, false, now, now) };
      assert.equal(x.feed.transport, 'refresh_delayed'); assert.equal(classifyPortfolioIssue(x).kind, 'fault');
    }
  });
  await test('independent fault takes priority over delayed worker-derived indicators', () => {
    const x = { ...base(), feed: describeFeed(snapshot(now - 6000), null, false, now, now), missingMain: ['indicators'] };
    assert.equal(classifyPortfolioIssue(x).kind, 'feed_delay');
    for (const k of ['error', 'recovery', 'executionIssue', 'indicatorError'] as const)
      assert.deepEqual(classifyPortfolioIssue({ ...x, [k]: 'actual_fault' }), { kind: 'fault', reason: 'actual_fault' });
    assert.equal(classifyPortfolioIssue({ ...x, missingMain: ['hype4h', 'indicators'] }).kind, 'fault');
    assert.equal(classifyPortfolioIssue({ ...base(), missingMain: ['indicators'] }).kind, 'fault');
  });
  await test('fault and delay clocks are distinct and healthy resets them', () => {
    const t = new PortfolioIssueTracker();
    assert.equal(t.update({ kind: 'feed_delay', reason: 'refresh_delayed' }, now).feedDelaySince, now);
    const fault = t.update({ kind: 'fault', reason: 'read_failed' }, now + 100000);
    assert.equal(fault.faultSince, now + 100000); assert.equal(fault.feedDelaySince, null); assert.equal(fault.degradedSince, now);
    assert.equal(t.update({ kind: 'fault', reason: 'other_fault' }, now + 100001).faultSince, now + 100000);
    assert.equal(t.update({ kind: null, reason: null }, now + 100002).degradedSince, null);
  });
  await test('pump is single-flight, retries errors and stops cleanly', async () => {
    let calls = 0, errors = 0, release: () => void = () => {};
    const pump = new PortfolioFeedPump(async () => { calls++; await new Promise<void>(r => { release = r; }); throw new Error('fixture'); }, () => { errors++; });
    try {
      pump.request(); pump.request(); pump.request(); assert.equal(calls, 1);
      release(); await new Promise(r => setTimeout(r, 1150)); assert.equal(errors, 1); assert.equal(calls, 2);
      pump.stop(); release(); await new Promise(r => setTimeout(r, 20)); pump.request(); assert.equal(calls, 2);
    } finally { pump.stop(); release(); }
  });
  await test('watchdog delay warning/escalation never downgrades real faults or old health', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-feed-health-'));
    try {
      const c = { ...JSON.parse(fs.readFileSync('portfolio-live-config.json', 'utf8')), enabled: true, mode: 'live', entryEnabled: true };
      fs.mkdirSync(path.join(dir, 'data'));
      fs.writeFileSync(path.join(dir, 'portfolio-live-config.json'), JSON.stringify(c));
      const d = describeFeed(snapshot(now - 10000), null, false, now - 10000, now);
      const h: any = { writtenAt: now, uid: c.expectedAccountUid, policy: c.policy, enabled: true, mode: c.mode,
        configuredEntryEnabled: true, pending: [], recovery: null, status: 'degraded', error: d.transport,
        degradedSince: now - 61000, tickMs: 11700, feed: { diagnostics: d },
        degradation: { kind: 'feed_delay', feedDelaySince: now - 61000, faultSince: null } };
      const read = () => { fs.writeFileSync(path.join(dir, c.healthFile), JSON.stringify(h)); return portfolioHealth(dir, now).observations; };
      let r = read(); assert.equal(r.length, 1); assert.equal(r[0].key, 'portfolio_feed_delayed'); assert.equal(r[0].severity, 'warning');
      assert.equal(r[0].evidence.snapshotAgeMs, 10000);
      h.degradation.feedDelaySince = now - 300000; assert.equal(read()[0].severity, 'critical');
      h.degradation.feedDelaySince = now - 59000; assert.equal(read().length, 0);
      h.feed.diagnostics = describeFeed(snapshot(), null, false, now, now);
      h.mainContext = { high: highFixture().high.diagnostics(windowAt + 3000) };
      h.error = 'high_minute_rollover'; assert.equal(read().length, 0);
      h.degradation.feedDelaySince = now - 61000;
      assert.equal(read()[0].key, 'portfolio_feed_delayed'); // stale timing report still escalates
      h.mainContext.high.transport = 'unavailable'; h.error = 'main_inputs_unavailable:high';
      h.degradation = { kind: 'fault', faultSince: now - 61000, feedDelaySince: null };
      assert.equal(read()[0].key, 'portfolio_degraded');
      h.feed.diagnostics = d; h.error = d.transport;
      h.degradation = { kind: 'feed_delay', feedDelaySince: now - 59000, faultSince: null };
      h.recovery = 'ownership_unknown'; assert.equal(read()[0].key, 'portfolio_degraded'); assert.equal(read()[0].severity, 'critical');
      h.recovery = null; h.feed.diagnostics.fault = 'conflicting_final_candle'; h.error = 'conflicting_final_candle';
      assert.equal(read()[0].key, 'portfolio_degraded');
      h.feed.diagnostics.transport = 'worker_stopped'; h.degradedSince = now; assert.equal(read()[0].severity, 'critical');
      h.feed = {}; delete h.degradation; h.error = 'snapshot_stale_or_outside_window'; h.degradedSince = now - 61000;
      assert.equal(read()[0].key, 'portfolio_degraded'); assert.equal(read()[0].severity, 'critical');
      h.writtenAt = now - 61000; assert(read().some(r => r.key === 'portfolio_owner_unavailable'));
      h.writtenAt = now; h.uid = 'wrong'; assert(read().some(r => r.key === 'portfolio_owner_unavailable'));
    } finally {
      assert(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep + 'portfolio-feed-health-'));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  console.log(`Portfolio feed health: ${cases} groups passed; no exchange calls`);
}
void main().catch(e => { console.error(e); process.exitCode = 1; });
