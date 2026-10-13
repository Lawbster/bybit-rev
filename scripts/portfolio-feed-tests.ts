import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { gzipSync } from 'zlib';
import { createHash } from 'crypto';
import { PortfolioCandleFeed, collectorMinute, FEED_VERSION } from '../src/bot/portfolio/candle-feed';
import { loadPortfolioBootstrap, PortfolioFeedReader } from '../src/bot/portfolio/feed-loader';
import { PortfolioFeedWorker } from '../src/bot/portfolio/feed-worker';
import { STRUCTURAL_SEED as START } from '../src/bot/portfolio/structural-signals';
import { MINUTE as M } from '../src/bot/portfolio/contract';
import { emptyLedger, prepareOpen } from '../src/bot/portfolio/ledger';
import { sealEntryPoll, dueEntrySources } from '../src/bot/portfolio/lifecycle';
import { validateReservation } from '../src/bot/portfolio/allocation';
import { readCandleTail } from '../src/collector-candle-repair';

let cases = 0;
async function test(name: string, fn: () => void | Promise<void>) { try { await fn(); cases++; } catch (e) { throw new Error(name, { cause: e }); } }
const c = (i: number) => ({ timestamp: START + i * M, open: 100, high: 101, low: 99, close: 100, volume: 1, turnover: 100 });
const boot = (n = 5) => { const f = new PortfolioCandleFeed(); for (let i = 0; i < n; i++) f.seed(c(i)); f.ready(START + n * M); return f; };
const row = (i: number, receiptAt = START + (i + 1) * M + 10) => ({ ts: c(i).timestamp,
  o: 100, h: 101, l: 99, c: 100, v: 1, t: 100, source: 'websocket_confirmed', endAt: START + (i + 1) * M,
  receivedAt: receiptAt, writtenAt: receiptAt, availableAt: receiptAt });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-feed-'));
const header = (n: number) => ({ version: FEED_VERSION, symbol: 'HYPEUSDT', venue: 'bybit', seed: START,
  through: START + n * M, minutes: n, provenance: 'historical_warmup_only' });
function packet(name = 'seed.gz', n = 5) {
  const bytes = gzipSync([header(n), ...Array.from({ length: n }, (_, i) => c(i))].map(x => JSON.stringify(x) + '\n').join(''));
  const file = path.join(temp, name); fs.writeFileSync(file, bytes);
  return { file, hash: createHash('sha256').update(bytes).digest('hex') };
}
async function main() {
  await test('fixed seed cannot be reordered, skipped, duplicated or restarted mid-history', () => {
    for (const i of [1, -1]) assert.throws(() => new PortfolioCandleFeed().seed(c(i)));
    const f = new PortfolioCandleFeed(); f.seed(c(0)); assert.throws(() => f.seed(c(0))); assert(f.error);
    assert.throws(() => f.seed(c(1)), /faulted/);
  });
  await test('future bootstrap cannot become ready; ready history cannot be extended through seed', () => {
    const f = new PortfolioCandleFeed(); f.seed(c(0)); assert.throws(() => f.ready(START));
    f.ready(START + M); assert.throws(() => f.seed(c(1))); assert.throws(() => f.ready(START + 2 * M));
  });
  await test('receipt clock uses consumer observation, not earlier collector publication', () => {
    const f = boot(), end = START + 6 * M;
    f.ingest(c(5), end + 10, end + 3000);
    assert.equal(f.minute(5).availableAt, end + 3000);
    assert.equal(f.structuralMinutes()[5].publishedAt, end + 10);
    assert.equal(f.structuralMinutes()[5].availableAt, end + 3000);
    assert.equal(f.decisionPrice(end), null);
    assert.equal(f.decisionPrice(end + 3000)!.priceKnownAt, end + 3000);
  });
  await test('missing minute blocks the prefix; repair restores continuity at its actual observation', () => {
    const f = boot(), later = START + 7 * M + 10;
    f.ingest(c(6), later, later); assert.equal(f.length, 5); assert.equal(f.health(later).pending, 1);
    assert.equal(f.decisionPrice(later), null);
    f.ingest(c(5), later + 100, later + 200); assert.equal(f.length, 7);
    assert.equal(f.decisionPrice(later + 200)!.priceKnownAt, later + 200);
    assert.equal(f.health(later + 200).pending, 0);
  });
  await test('duplicate receipts are idempotent and cannot backdate prior availability', () => {
    const f = boot(), end = START + 6 * M;
    f.ingest(c(5), end + 10, end + 300);
    f.ingest(c(5), end, end + 400); assert.equal(f.minute(5).availableAt, end + 300);
    assert.equal(f.structuralMinutes()[5].publishedAt, end + 10);
    assert.equal(f.length, 6);
  });
  await test('conflicting final rows poison the cache; callers cannot revise stored arrays', () => {
    const f = boot(), copy = f.minute(1); copy.close = 100.5; assert.equal(f.minute(1).close, 100);
    assert.throws(() => f.ingest({ ...c(1), close: 100.5 }, START + 2 * M, START + 6 * M), /conflicting/);
    assert.equal(f.decisionPrice(START + 6 * M), null); assert(f.error);
  });
  await test('conflicting pending rows fail and future poisoning is ignored until observed', () => {
    const f = boot(), t = START + 8 * M;
    f.ingest({ ...c(6), close: NaN }, t + M, t); assert.equal(f.error, null);
    f.ingest(c(6), t, t);
    assert.throws(() => f.ingest({ ...c(6), close: 100.5 }, t, t), /conflicting pending/);
  });
  await test('forming, unknown-source, wrong-symbol and backdated rows never become evidence', () => {
    const t = START + 10 * M;
    assert(collectorMinute(row(5), t));
    for (const r of [{ ...row(5), source: 'unknown' }, { ...row(5), final: false }, { ...row(5), symbol: 'BTCUSDT' },
      { ...row(5), availableAt: t + 1 }, { ...row(5), receivedAt: START }, { ...row(5), endAt: null },
      { ...row(5), v: null }, { ...row(5), interval: '5' }]) assert.equal(collectorMinute(r, t), null);
  });
  await test('repair identity and request-receipt-write chronology are enforced', () => {
    const t = START + 10 * M;
    const r = { ...c(5), version: 1, venue: 'bybit', symbol: 'HYPEUSDT', interval: '1', source: 'rest_gap_repair',
      requestedAt: t - 20, receivedAt: t - 10, writtenAt: t, availableAt: t };
    assert(collectorMinute(r, t)); assert.equal(collectorMinute({ ...r, symbol: 'BTCUSDT' }, t), null);
    assert.equal(collectorMinute({ ...r, writtenAt: t - 30 }, t), null);
  });
  await test('bootstrap loader verifies the compressed hash and exact header/row count', async () => {
    const p = packet(); const f = await loadPortfolioBootstrap(p.file, p.hash, () => START + 5 * M);
    assert.equal(f.length, 5); assert.equal(f.health(START + 6 * M).bootstrapProvenance.includes('warmup'), true);
    await assert.rejects(loadPortfolioBootstrap(p.file, '0'.repeat(64), () => START + 5 * M), /hash/);
    await assert.rejects(loadPortfolioBootstrap(p.file, p.hash, () => START), /readiness/);
  });
  await test('truncated gzip is an error, not a valid partial bootstrap', async () => {
    const p = packet('truncated.gz'); const bytes = fs.readFileSync(p.file).subarray(0, -12); fs.writeFileSync(p.file, bytes);
    await assert.rejects(loadPortfolioBootstrap(p.file, createHash('sha256').update(bytes).digest('hex'), () => START + 5 * M));
  });
  await test('unchanged files are not reparsed; incomplete lines wait for completion; rotation is read', async () => {
    let now = START + 6 * M + 100; const dir = path.join(temp, 'data'); fs.mkdirSync(dir);
    const file = path.join(dir, 'HYPEUSDT_1m.jsonl'), f = boot(); const reader = new PortfolioFeedReader(f, dir, () => now);
    const text = JSON.stringify(row(5)); fs.writeFileSync(file, text);
    await reader.refresh(); assert.equal(f.length, 5);
    fs.appendFileSync(file, '\n'); await reader.refresh(); assert.equal(f.length, 6);
    const reads = reader.snapshot().loader.reads;
    await Promise.all([reader.refresh(), reader.refresh(), reader.refresh()]); assert.equal(reader.snapshot().loader.reads, reads);
    now += M; fs.renameSync(file, file + '.1'); fs.writeFileSync(file, JSON.stringify(row(6)) + '\n');
    await reader.refresh(); assert.equal(f.length, 7);
  });
  await test('restart reads a bridge outside the old 1MB tail; later appends are incremental', async () => {
    const dir = path.join(temp, 'long-journal'); fs.mkdirSync(dir);
    const file = path.join(dir, 'HYPEUSDT_1m.jsonl'), n = 6500;
    let now = START + (n + 1) * M;
    fs.writeFileSync(file, Array.from({ length: n - 5 }, (_, i) => JSON.stringify(row(i + 5)) + '\n').join(''));
    assert(fs.statSync(file).size > 1024 * 1024);
    const oldTail = await readCandleTail(file, START + 5 * M, M, 1024 * 1024);
    assert(!oldTail.some(r => r.ts === c(5).timestamp));
    const f = boot(), reader = new PortfolioFeedReader(f, dir, () => now);
    await reader.refresh(); assert.equal(f.length, n); assert.equal(reader.snapshot().loader.error, null);
    assert.equal(f.minute(5).availableAt, now); assert.equal(f.decisionPrice(now - M), null);
    assert.equal(f.structuralMinutes()[5].publishedAt, row(5).availableAt);
    const bytes = reader.snapshot().loader.bytesRead, reads = reader.snapshot().loader.reads;
    await reader.refresh(); assert.equal(reader.snapshot().loader.reads, reads);
    const addition = JSON.stringify(row(n)) + '\n'; fs.appendFileSync(file, addition);
    now += 1000; await reader.refresh(); assert.equal(f.length, n + 1);
    assert.equal(reader.snapshot().loader.bytesRead - bytes, Buffer.byteLength(addition));
    assert.equal(reader.snapshot().loader.unreadBytes, 0);
  });
  await test('bounded startup passes continue through unchanged files rather than skipping the prefix', async () => {
    const dir = path.join(temp, 'bounded-journal'); fs.mkdirSync(dir);
    const file = path.join(dir, 'HYPEUSDT_1m.jsonl'), now = START + 7 * M + 100;
    const old = JSON.stringify(row(0)) + '\n';
    fs.writeFileSync(file, old.repeat(Math.ceil(9 * 1024 * 1024 / Buffer.byteLength(old))) + JSON.stringify(row(5)) + '\n' + JSON.stringify(row(6)) + '\n');
    const f = boot(), reader = new PortfolioFeedReader(f, dir, () => now);
    await reader.refresh(); const first = reader.snapshot().loader;
    assert.equal(first.error, null); assert.equal(first.bytesRead, 8 * 1024 * 1024); assert(first.unreadBytes > 0);
    assert.equal(f.length, 5);
    await reader.refresh(); assert.equal(reader.snapshot().loader.unreadBytes, 0); assert.equal(f.length, 7);
    assert.equal(f.health(now).gapAt, null);
  });
  await test('truncation reopens from the start; same-size rewrites still detect conflicts', async () => {
    const dir = path.join(temp, 'truncate-journal'); fs.mkdirSync(dir);
    const file = path.join(dir, 'HYPEUSDT_1m.jsonl'), now = START + 9 * M;
    fs.writeFileSync(file, [row(5), row(6)].map(r => JSON.stringify(r) + '\n').join(''));
    const f = boot(), reader = new PortfolioFeedReader(f, dir, () => now);
    await reader.refresh(); assert.equal(f.length, 7);
    fs.writeFileSync(file, JSON.stringify(row(7)) + '\n');
    await reader.refresh(); assert.equal(f.length, 8);
    const before = fs.statSync(file);
    fs.writeFileSync(file, JSON.stringify({ ...row(7), v: 2 }) + '\n');
    assert.equal(fs.statSync(file).size, before.size);
    fs.utimesSync(file, before.atime, new Date(before.mtimeMs + 2000));
    await reader.refresh(); assert.match(reader.snapshot().loader.error!, /conflicting finalized/);
    assert.equal(f.decisionPrice(now), null);
  });
  await test('real gaps remain blocked and late repair appends release them only at observation', async () => {
    const dir = path.join(temp, 'repair-journal'); fs.mkdirSync(dir);
    let now = START + 8 * M + 100;
    fs.writeFileSync(path.join(dir, 'HYPEUSDT_1m.jsonl'), [row(5), row(7)].map(r => JSON.stringify(r) + '\n').join(''));
    const f = boot(), reader = new PortfolioFeedReader(f, dir, () => now);
    await reader.refresh(); assert.equal(f.length, 6); assert.equal(f.health(now).gapAt, START + 6 * M);
    assert.equal(reader.snapshot().price, null); assert.equal(reader.snapshot().loader.unreadBytes, 0);
    now += 1000; fs.mkdirSync(path.join(dir, 'candle-repairs'));
    const repair = { ...c(6), version: 1, venue: 'bybit', symbol: 'HYPEUSDT', interval: '1', source: 'rest_gap_repair',
      requestedAt: now - 20, receivedAt: now - 10, writtenAt: now, availableAt: now };
    fs.writeFileSync(path.join(dir, 'candle-repairs', 'HYPEUSDT_1m.jsonl'), JSON.stringify(repair) + '\n');
    await reader.refresh(); assert.equal(f.length, 8); assert.equal(f.health(now).gapAt, null);
    assert.equal(f.decisionPrice(now)!.priceKnownAt, now);
    assert.equal(f.decisionPrice(now - 1), null);
    assert.equal(f.structuralMinutes()[6].publishedAt, now, 'repair publication is not backdated');
  });
  await test('future publications are retried without a file change, never used early', async () => {
    const dir = path.join(temp, 'future-journal'); fs.mkdirSync(dir);
    let now = START + 7 * M + 100;
    fs.writeFileSync(path.join(dir, 'HYPEUSDT_1m.jsonl'), [row(5, now + 200), row(6, now + 200)].map(r => JSON.stringify(r) + '\n').join(''));
    const f = boot(), reader = new PortfolioFeedReader(f, dir, () => now);
    await reader.refresh(); assert.equal(f.length, 5); const reads = reader.snapshot().loader.reads;
    now += 100; await reader.refresh(); assert.equal(f.length, 5); assert.equal(reader.snapshot().loader.reads, reads);
    now += 100; await reader.refresh(); assert.equal(f.length, 7);
    assert.equal(f.minute(5).availableAt, now); assert.equal(reader.snapshot().loader.unreadBytes, 0);
  });
  await test('source decision time can follow the receipt; entry window and signal cutoff cannot move', () => {
    const at = Date.UTC(2026, 0, 1, 4, 1), now = at + 500;
    const s = emptyLedger('123'); const signal = { id: 'live_l2', source: 'L2' as const, side: 1 as const,
      decisionAt: at, eligibleAt: at, knownAt: at - M + 100, expiresAt: at + 721 * M };
    const p = { windowAt: at, observedAt: now, sources: dueEntrySources(now).map(source =>
      source === 'L2' ? { source, status: 'signal', signal } : { source, status: 'no_signal' }) };
    const r = sealEntryPoll(s, p, { price: 100, priceKnownAt: at + 300, equity: 19000,
      equityKnownAt: at + 400, markedThrough: at, feeRate: .00055 }).decisions[0].reservation!;
    assert.equal(r.decisionAt, now); assert.equal(r.eligibleAt, at);
    assert.equal(r.knownAt, signal.knownAt);
    assert.throws(() => validateReservation({ ...r, knownAt: at + 1 }), /clock/);
    assert.throws(() => validateReservation({ ...r, knownAt: undefined }), /epoch/);
    assert.throws(() => prepareOpen(s, r, 1, 'before_decision', at + 200), /entry/);
    assert.throws(() => prepareOpen(s, r, 1, 'next_minute', at + M), /entry/);
    prepareOpen(s, r, 1, 'valid', now);
    const late = { ...p, sources: p.sources.map(o => o.signal ? { ...o, signal: { ...o.signal, knownAt: at + 1 } } : o) };
    assert.throws(() => sealEntryPoll(emptyLedger('123'), late, { price: 100, priceKnownAt: now, equity: 19000,
      equityKnownAt: now, markedThrough: at, feeRate: .00055 }), /clock/);
  });
  await test('worker runs read-only and returns without occupying the owner thread', async () => {
    const p = packet('worker.gz'); const worker = new PortfolioFeedWorker({ bootstrap: p.file, sha256: p.hash, dataDir: path.join(temp, 'absent') });
    try {
      const start = Date.now(); let result = worker.latest(Date.now());
      while (!result.ready && Date.now() - start < 10000) {
        worker.request(Date.now()); await new Promise(resolve => setTimeout(resolve, 25)); result = worker.latest(Date.now());
      }
      assert(result.ready, JSON.stringify(result));
      assert.equal(result.value.health.minutes, 5); assert.equal(result.value.price, null);
      assert.equal(result.value.poll.sources.some(x => x.signal), false);
      const firstSnapshot = result.value.at;
      // Simulate an owner busy with REST for longer than the freshness budget.
      // NO request() calls: the isolated worker must keep itself refreshed.
      await new Promise(resolve => setTimeout(resolve, 6500));
      const autonomous = worker.latest(Date.now());
      assert(autonomous.ready, JSON.stringify(autonomous));
      assert(autonomous.value.at > firstSnapshot + 5000);
      assert.equal(worker.diagnostics(Date.now()).transport, 'ready');
      assert.equal(worker.latest(Date.now() + 6000).ready, false);
    } finally { await worker.close(); }
  });
  console.log(JSON.stringify({ passed: true, cases, tempEvidence: temp, exchangeCalls: 0 }));
}
void main().catch(e => { console.error(e); process.exitCode = 1; });
