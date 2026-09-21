import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import https from 'https';
import { EventEmitter } from 'events';
import { buildContext, M, H, type Minute } from '../src/strategies/setup-context';
import { sfpActions } from '../src/strategies/sfp-policy';
import { previewRangeLowSfp } from '../src/strategies/sfp-detector';
import { evaluateSfpApproach, SfpApproachAlerts, type ApproachDelivery } from '../src/bot/sfp-approach-alert';
import { sfpDecision, type SfpBarSnapshot } from '../src/bot/sfp-candles';
import { sfpHealthObservations } from '../src/bot/sfp-health';
import { LadderAlerter } from '../src/bot/ladder-alerter';

const t0 = Date.UTC(2026, 0, 1), tf = 4 * H, start = t0 + 12 * tf, closeAt = start + tf;
type Spec = [number, number, number, number];
const flat = (p: number): Spec => [p, p + 0.2, p - 0.2, p];
const specs: Spec[] = [flat(105), flat(104), flat(102), [102, 103, 100, 101], flat(103), flat(105), flat(108),
  [108, 112, 107, 110], flat(109), flat(107), flat(106), flat(105), [105, 106, 99, 101]];
const minutes: Minute[] = specs.flatMap(([o, h, l, c], i) => Array.from({ length: 240 }, (_, j) => {
  const ts = t0 + i * tf + j * M, close = j === 239 || i === 12 && j >= 220 ? c : o;
  return { ts, endTs: ts + M, open: o, close, high: j === 60 ? h : Math.max(o, close),
    low: j === 120 ? l : Math.min(o, close), volume: 1, turnover: 0, availableAt: ts + 2 * M };
}));
const historical = minutes.filter(m => m.ts < start), current = minutes.filter(m => m.ts >= start);
const ctx = buildContext({ symbol: 'HYPEUSDT', minutes: historical, lagMs: M, window: { start: t0, end: start }, params: {} });
const snapshot: SfpBarSnapshot = { at: start + M, bars: ctx.bars(tf), pivots: ctx.pivots(tf, 2) };
const now = closeAt - 5 * M;
const evaluate = (rows: any[] = current, at = now, cache: SfpBarSnapshot | null = snapshot) => evaluateSfpApproach(cache, rows, at, t0 - 1);
const candidate = evaluate().candidate!;
assert(candidate); assert.equal(candidate.rangeLow, 100); assert.equal(candidate.rangeHigh, 112);
assert.equal(candidate.closeAt, closeAt); assert.equal(candidate.sourceThrough, now - M);
assert.equal(candidate.stop, 99 * 0.999 * 0.95);
assert.equal(candidate.target, 101 + 2 * (101 - 99 * 0.999));
assert.equal(evaluate(current, closeAt - 10 * M - 1).candidate, null);
assert(evaluate(current, closeAt - 10 * M).candidate);
assert.equal(evaluate(current, closeAt).candidate, null);
assert.equal(evaluate(current, now, null).candidate, null);
assert.equal(evaluate(current, now, { ...snapshot, at: start - tf + M }).candidate, null);
assert.equal(evaluate(current.slice(1)).candidate, null, 'gap in forming candle');
assert.equal(evaluate(current.filter(m => m.ts !== now - 2 * M)).candidate, null, 'stale latest minute');
assert.equal(evaluate(current.map(m => m.ts === now - 2 * M ? { ...m, availableAt: now + 1 } : m)).candidate, null);
assert.equal(evaluate([...current, { ...current[0], low: 97 }]).candidate, null, 'conflicting evidence');
assert.equal(evaluate(current.map(m => ({ ...m, low: Math.max(100.1, m.low) }))).candidate, null, 'no sweep');
assert.equal(evaluate(current.map(m => ({ ...m, close: 99.5, low: Math.min(99.5, m.low) }))).candidate, null, 'no reclaim');
assert.equal(evaluate(current.map((m, i) => i === 60 ? { ...m, high: 112 } : m)).candidate, null, 'range high consumed');
assert.equal(evaluate(current.map(m => ({ ...m, close: 107, high: Math.max(m.high, 107) }))).candidate, null, 'original risk above 5%');
assert.equal(evaluate(current.map(m => ({ ...m, availableAt: undefined }))).candidate, null, 'no current receipt evidence');
const poisoned = current.map(m => m.ts > now - 2 * M ? { ...m, low: 1, high: 1000, close: 900 } : m);
assert.deepEqual(evaluate(poisoned).candidate, candidate, 'future extrema cannot influence preview');
assert.deepEqual(evaluate([...current, { ...current[0], low: 1, availableAt: now + M }]).candidate, candidate, 'not-yet-arrived correction ignored');
const prefix = current.filter(m => m.availableAt <= now);
const preview = previewRangeLowSfp({ ...ctx, cutoff: now }, { timestamp: start, open: 105, close: 101, high: 106, low: 99,
  volume: prefix.length, turnover: 0, availableAt: now });
assert(preview.length > 0 && preview.every(e => e.stage === 'pending_at_cutoff' && e.knownAt <= now));
assert.equal(sfpActions(preview).length, 0, 'preview cannot become an executable signal');
const cache = { value: null as SfpBarSnapshot | null };
assert.deepEqual(sfpDecision(minutes, now, t0 - 1, cache), sfpDecision(minutes, now, t0 - 1), 'observer cache cannot change decisions');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sfp-approach-'));
  let at = now, eligible = true, sends = 0, rows: any[] = current;
  let response: ApproachDelivery = { sent: true };
  const options = (name: string) => ({ file: path.join(root, name + '.json'), candleFile: 'unused',
    accountUid: '3674537', bootstrapAt: t0 - 1, cache: { value: snapshot }, clock: () => at,
    eligible: () => eligible, read: async () => rows,
    send: async () => { sends++; return response; } });
  const tick = async (a: SfpApproachAlerts) => { a.tick(); await a.drain(); };
  try {
    const a = new SfpApproachAlerts(options('success'));
    eligible = false; await tick(a); assert.equal(sends, 0);
    eligible = true; await tick(a); assert.equal(sends, 1);
    a.tick(); await a.drain(); assert.equal(sends, 1);
    at += M; await tick(a); assert.equal(sends, 1);
    await tick(new SfpApproachAlerts(options('success'))); assert.equal(sends, 1, 'restart must not repeat');
    const saved = JSON.parse(fs.readFileSync(options('success').file, 'utf8'));
    saved.attempts[0].status = 'attempting';
    fs.writeFileSync(options('ambiguous').file, JSON.stringify(saved));
    await tick(new SfpApproachAlerts(options('ambiguous'))); assert.equal(sends, 1, 'crash after claim must not repeat');
    saved.attempts[0].id += ':other';
    fs.writeFileSync(options('other').file, JSON.stringify(saved));
    await tick(new SfpApproachAlerts(options('other'))); assert.equal(sends, 1, 'one warning per 4h close');

    at = now; sends = 0; response = { sent: false, retryAfterMs: 90_000 };
    const rate = new SfpApproachAlerts(options('rate'));
    await tick(rate); assert.equal(sends, 1);
    at += M; await tick(rate); assert.equal(sends, 1, 'honour retry-after');
    at += M; response = { sent: true }; await tick(new SfpApproachAlerts(options('rate')));
    assert.equal(sends, 2, 'definite 429 may retry after restart');

    at = now; sends = 0; response = { sent: false, retryAfterMs: 1000 };
    const cancelled = new SfpApproachAlerts(options('invalidated'));
    await tick(cancelled); at += M;
    rows = current.map(m => ({ ...m, close: 99.5, low: Math.min(99.5, m.low) }));
    await tick(cancelled); assert.equal(sends, 1, 'revalidate setup before a 429 retry');
    rows = current; at = closeAt; await tick(cancelled); assert.equal(sends, 1, 'expired warning never retries');
    at = now; sends = 0;
    const capped = new SfpApproachAlerts(options('capped'));
    for (let i = 0; i < 5; i++) { at = now + i * M; await tick(capped); }
    assert.equal(sends, 3, 'bounded rejected attempts');
    at = now; sends = 0; response = { sent: false };
    const failed = new SfpApproachAlerts(options('failed'));
    await tick(failed); at += M; await tick(failed); assert.equal(sends, 1, 'ambiguous failure never retried');

    fs.writeFileSync(options('broken').file, '{broken'); sends = 0;
    const broken = new SfpApproachAlerts(options('broken')); await tick(broken);
    assert.equal(broken.health.error, 'approach_ledger_unreadable'); assert.equal(sends, 0);
    const badWrite = new SfpApproachAlerts({ ...options('write'), file: path.join(options('broken').file, 'child.json') });
    await tick(badWrite); assert.equal(badWrite.health.error, 'approach_ledger_write_failed'); assert.equal(sends, 0);

    let finish!: (v: any[]) => void;
    const pending = new SfpApproachAlerts({ ...options('async'), read: () => new Promise(resolve => { finish = resolve; }) });
    pending.tick(); assert.equal(sends, 0, 'tick does not wait for candle I/O');
    eligible = false; finish(current); await pending.drain(); assert.equal(sends, 0, 'pause while read in flight');
    eligible = true;
    let delivered!: (v: ApproachDelivery) => void;
    const asyncSend = new SfpApproachAlerts({ ...options('async-send'), send: () => new Promise(resolve => { delivered = resolve; }) });
    asyncSend.tick(); await new Promise(resolve => setImmediate(resolve));
    assert(delivered, 'HTTP started without awaiting it in owner tick'); delivered({ sent: true }); await asyncSend.drain();

    fs.writeFileSync(path.join(root, 'sfp-live-config.json'), JSON.stringify({ enabled: true, healthFile: 'health.json' }));
    fs.writeFileSync(path.join(root, 'health.json'), JSON.stringify({ writtenAt: at, enabled: true, status: 'healthy', approachAlert: broken.health }));
    assert(sfpHealthObservations(root, at).some(i => i.key === 'sfp_approach_alert_unavailable' && i.severity === 'warning'));
    await transportTests();
    console.log('SFP approach tests passed: causal preview, gates, immutable entry semantics, restart/crash dedup, async isolation, 429 retry/expiry, corrupt evidence and health coverage');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

async function transportTests() {
  const original = https.request, previous = process.env.DISCORD_WEBHOOK_SFPTEST, oldError = console.error;
  process.env.DISCORD_WEBHOOK_SFPTEST = 'https://example.invalid/test';
  console.error = () => {};
  const test = async (status: number, headers: any, body: string) => {
    (https as any).request = (_options: any, callback: any) => {
      const request: any = new EventEmitter();
      request.write = () => {}; request.setTimeout = () => request;
      request.end = () => queueMicrotask(() => {
        const response: any = new EventEmitter(); response.statusCode = status; response.headers = headers; response.resume = () => {};
        callback(response); response.emit('data', Buffer.from(body)); response.emit('end');
      });
      return request;
    };
    return new LadderAlerter('SFPTEST').notifySfpApproaching('LAWBSTER', []);
  };
  try {
    assert.deepEqual(await test(204, {}, ''), { sent: true });
    assert.deepEqual(await test(429, { 'retry-after': '2.4' }, '{}'), { sent: false, retryAfterMs: 2400 });
    assert.deepEqual(await test(429, {}, '{"retry_after":1.25}'), { sent: false, retryAfterMs: 1250 });
    assert.deepEqual(await test(429, {}, '{broken'), { sent: false, retryAfterMs: 60000 });
    assert.deepEqual(await test(500, {}, ''), { sent: false });
  } finally {
    (https as any).request = original; console.error = oldError;
    if (previous === undefined) delete process.env.DISCORD_WEBHOOK_SFPTEST; else process.env.DISCORD_WEBHOOK_SFPTEST = previous;
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
