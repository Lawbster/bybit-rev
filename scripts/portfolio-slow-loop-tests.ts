import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fixture } from './portfolio-bracket-tests';
import { T, seed } from './portfolio-execution-tests';
import { PortfolioReadTiming, parallelReads } from '../src/bot/portfolio/read-timing';
import { PublicReadBackoff } from '../src/bot/portfolio/public-read-backoff';

// Deterministic virtual network: simultaneous requests advance to the same end,
// sequential requests add their latency. Reuses the actual receipt coordinator.
async function runSlow(requestMs: number) {
  const f = fixture();
  try {
    await f.entry('SF08'); f.time(T + 60000); await f.entry('PA07');
    let now = T + 120000, reads = 0, bracketReads = 0;
    f.time(now);
    const delay = async (ms: number) => { const end = now + ms; await Promise.resolve(); now = Math.max(now, end); f.time(now); };
    const observe = f.ex.attached.observe, snapshot = f.ex.snapshot.bind(f.ex);
    f.ex.attached.observe = async (...args) => {
      const at = now; bracketReads++; await delay(3 * requestMs);
      return { ...await observe(...args), observedAt: at };
    };
    f.ex.snapshot = async () => {
      const at = now; reads++; await delay(5 * requestMs);
      return { ...await snapshot(), observedAt: at };
    };
    const start = now;
    await f.c.withServiceCycle(async () => {
      for (let i = 0; i < 10; i++) assert.equal((await f.c.maintain()).issue, null);
    });
    const elapsed = now - start;
    assert.equal(reads, 1); assert.equal(bracketReads, 2);
    assert.equal(f.c.serviceTiming.refreshes, 1); assert.equal(f.c.serviceTiming.reusedMaintenance, 9);
    assert.equal(elapsed, 8 * requestMs);
    assert.equal(f.c.serviceTiming.accountEvidenceRemainingMs, 5000 - 5 * requestMs);
    // Maintenance completion never changes the snapshot clock used for orders.
    now = Math.ceil(now / 60000) * 60000; f.time(now);
    f.ex.snapshot = async () => ({ ...await snapshot(), observedAt: now - 5001 });
    seed(f.c.store, 'L2', now, 'stale-admission');
    const sent = f.ex.commands.length;
    await assert.rejects(f.c.open('stale-admission'), /stale or future exchange evidence/);
    assert.equal(f.ex.commands.length, sent);
    return { requestMs, simulatedLoopMs: elapsed, refreshes: reads, reuse: 9,
      oldSerialRefreshMs: 11 * requestMs, note: 'old start-clock cache exceeds 5s; old ten-refresh duration is a model, not a live measurement' };
  } finally { f.cleanup(); }
}
async function main() {
  const a = await runSlow(460), b = await runSlow(920);
  assert.equal(b.simulatedLoopMs, 2 * a.simulatedLoopMs);
  // A failed parallel bracket must drain its sibling before releasing the owner.
  const f = fixture();
  try {
    await f.entry('SF08'); f.time(T + 60000); await f.entry('PA07');
    let release!: () => void, started = 0, done = false;
    const hold = new Promise<void>(r => { release = r; }), observe = f.ex.attached.observe;
    f.ex.attached.observe = async (...args) => {
      if (++started === 1) throw Error('first failed');
      await hold; return observe(...args);
    };
    const work = f.c.maintain().then(() => { done = true; }, e => { done = true; assert.match(e.message, /first failed/); });
    for (let i = 0; i < 20; i++) await Promise.resolve();
    assert.equal(started, 2); assert.equal(done, false);
    release(); await work;
  } finally { f.cleanup(); }
  let now = T;
  const timing = new PortfolioReadTiming(() => now);
  await parallelReads(['one', 'two'].map(key => timing.run(key, () => timing.phase('lookup', async () => {
    for (let page = 1; page <= 2; page++) await timing.request('positions', page, async () => {
      await Promise.resolve(); return { retCode: 0, secret: 'DO_NOT_COPY',
        rateLimitApi: { remainingRequests: 6, maxRequests: 10, resetAtTimestamp: T } };
    });
  }))));
  for (const r of timing.reports) {
    assert.equal(r.requestCount, 2); assert.equal(r.sequentialDepth, 2);
    assert.equal(r.requests[0].remaining, 6);
    assert(!JSON.stringify(r).includes('DO_NOT_COPY'));
  }
  for (let i = 0; i < 10; i++) await timing.run(String(i), async () => {});
  assert.equal(timing.reports.length, 8);
  await timing.run('bounded', async () => {
    for (let i = 0; i < 130; i++) await timing.request('positions', i + 1, async () => ({ retCode: 0 }));
  });
  assert.equal(timing.reports.at(-1)!.requests.length, 128);
  assert.equal(timing.reports.at(-1)!.requestCount, 130);
  assert.equal(timing.reports.at(-1)!.truncated, true);
  const backoff = new PublicReadBackoff(() => now);
  let calls = 0;
  const rejected = async () => { calls++; return { retCode: 10006 }; };
  await parallelReads([backoff.read('HYPEUSDT:60', rejected), backoff.read('BTCUSDT:60', rejected)]);
  await assert.rejects(backoff.read('BTCUSDT:60', rejected), /backoff/);
  assert.equal(calls, 2); assert.equal(backoff.diagnostics.remainingMs, 20000);
  now += 20000; await backoff.read('BTCUSDT:60', rejected);
  assert.equal(backoff.diagnostics.remainingMs, 40000);
  now += 40000; await backoff.read('HYPEUSDT:60', async () => ({ retCode: 10016 }));
  assert.equal(backoff.diagnostics.remainingMs, 60000);
  now += 60000; await backoff.read('HYPEUSDT:60', async () => ({ retCode: 0 }));
  assert.equal(backoff.diagnostics.failures, 0);
  const report = { passed: true, simulation: [a, b], checks: [
    'two brackets, ten maintenance calls', 'linear doubled latency', 'stale write refused',
    'failed bracket drains sibling', 'isolated bounded redacted timing', 'public cooldown; no in-loop retry'
  ], exchangeCalls: 0 };
  const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
  const sources = Object.fromEntries(['src/bot/portfolio/execution-coordinator.ts', 'src/bot/portfolio/bybit-account.ts',
    'src/bot/portfolio/bybit-evidence.ts', 'src/bot/portfolio/read-timing.ts', 'src/bot/portfolio/public-read-backoff.ts',
    'src/bot/portfolio-live.ts', 'src/bot/portfolio/status.ts', 'scripts/portfolio-slow-loop-tests.ts']
    .map(file => [file, hash(fs.readFileSync(file))]));
  const out = `backtests/portfolio-slow-loop-verification/${hash(JSON.stringify(sources)).slice(0, 16)}`;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ ...report, sources }, null, 2) + '\n');
  console.log(JSON.stringify(report)); console.log(`${out}/verification.json`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
