/** Persistent research archive ingestion. No trading imports or credentials. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import zlib from 'zlib';
import { fork } from 'child_process';
import { pipeline } from 'stream/promises';
import { once } from 'events';
import { csv, decimal, format, readArchive, sha, DAY, Archive, Venue } from './poc-volume-source';
import { fileHash, atomicJson } from './research-workflow';

export const ROOT = path.resolve(__dirname, '..');
export const CARD = 'research-inputs/poc-history-map-pvm01-2026-09-17.json';
const PARENT = 'backtests/poc-volume-audit/877f6836f8ab3ad6e2bd8c3268479da131890afbeb7c12750a24358d506f5781';
const RAW_BINANCE = 'backtests/poc-binance-tape-audit/a2c29361f307d598ede16d8a4548e0074d27749dd5787279a01abe0c9713a540';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const relative = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');
export type Bin = { ts: number; p: number; q: number; buy: number; n: number; first: number; last: number };
export type Candle = { volume: string; turnover: string };
export function fixed(s: string): number {
  assert(/^\d+(\.\d+)?$/.test(s), 'Bad decimal ' + s);
  const [whole, frac = ''] = s.split('.'); assert(!/[1-9]/.test(frac.slice(8)), 'Decimal precision');
  const n = Number(whole) * 1e8 + Number(frac.slice(0, 8).padEnd(8, '0'));
  assert(Number.isSafeInteger(n), 'Unsafe decimal'); return n;
}
function safeAdd(a: number, b: number) { const n = a + b; assert(Number.isSafeInteger(n), 'Quantity overflow'); return n; }
export class TapeDay {
  bins = new Map<number, Map<number, Bin>>(); header: string[] = []; indices: Record<string, number> = {};
  ids = new Set<string>(); previousId = -1; previousTime = -1; rows = 0; idGaps = 0; outOfOrder = 0;
  prices = new Map<string, number>();
  constructor(readonly venue: Venue, readonly start: number, readonly symbol: string) {}
  line(line: string) {
    const f = line.includes('"') ? csv(line) : line.split(',');
    if (!this.header.length) {
      this.header = f; this.indices = Object.fromEntries(f.map((s, i) => [s, i]));
      for (const k of this.venue === 'bybit' ? ['timestamp', 'symbol', 'side', 'size', 'price', 'trdMatchID'] : ['id', 'price', 'qty', 'time', 'is_buyer_maker']) assert(k in this.indices, 'Missing ' + k);
      return;
    }
    assert.equal(f.length, this.header.length, 'CSV width'); const get = (k: string) => f[this.indices[k]];
    let ts: number, q: number, buy: boolean;
    if (this.venue === 'bybit') {
      assert.equal(get('symbol'), this.symbol); const t = get('timestamp');
      assert(/^\d+(\.\d+)?$/.test(t)); const [sec, frac = ''] = t.split('.'); ts = Number(sec) * 1000 + Number(frac.slice(0, 3).padEnd(3, '0'));
      const id = get('trdMatchID'); assert(id && !this.ids.has(id), 'Duplicate Bybit trade ID'); this.ids.add(id);
      q = fixed(get('size')); if ('homeNotional' in this.indices) assert.equal(q, fixed(get('homeNotional')));
      assert(['Buy', 'Sell'].includes(get('side'))); buy = get('side') === 'Buy';
    } else {
      ts = Number(get('time')); const id = Number(get('id')); assert(Number.isSafeInteger(id) && id > this.previousId, 'Duplicate/unordered Binance ID');
      if (this.previousId >= 0 && id !== this.previousId + 1) this.idGaps++; this.previousId = id;
      q = fixed(get('qty')); assert(['true', 'false'].includes(get('is_buyer_maker'))); buy = get('is_buyer_maker') === 'false';
    }
    assert(Number.isSafeInteger(ts) && ts >= this.start && ts < this.start + DAY, 'Trade timestamp/day');
    if (ts < this.previousTime) this.outOfOrder++; this.previousTime = ts;
    const ps = get('price'); let p = this.prices.get(ps); if (p === undefined) { p = fixed(ps); this.prices.set(ps, p); }
    assert(p > 0 && q > 0); const m = Math.floor(ts / 60000) * 60000;
    let prices = this.bins.get(m); if (!prices) { prices = new Map(); this.bins.set(m, prices); }
    let b = prices.get(p); if (!b) { b = { ts: m, p, q: 0, buy: 0, n: 0, first: ts, last: ts }; prices.set(p, b); }
    b.q = safeAdd(b.q, q); if (buy) b.buy = safeAdd(b.buy, q); b.n++; b.first = Math.min(b.first, ts); b.last = Math.max(b.last, ts); this.rows++;
  }
  ordered() { return [...this.bins.values()].flatMap(m => [...m.values()]).sort((a, b) => a.ts - b.ts || a.p - b.p); }
}
export function summarize(t: TapeDay, candles: Map<number, Candle>) {
  const prices = new Map<number, { p: number; q: bigint; buy: bigint; n: number; first: number; last: number }>();
  const minutes: any[] = []; let qty = 0n, quote = 0n, buy = 0n;
  for (let at = t.start; at < t.start + DAY; at += 60000) {
    let q = 0n, v = 0n; const bins = [...(t.bins.get(at)?.values() ?? [])];
    for (const b of bins) {
      const bq = BigInt(b.q); q += bq; v += BigInt(b.p) * bq; buy += BigInt(b.buy);
      let p = prices.get(b.p); if (!p) { p = { p: b.p, q: 0n, buy: 0n, n: 0, first: b.first, last: b.last }; prices.set(b.p, p); }
      p.q += bq; p.buy += BigInt(b.buy); p.n += b.n; p.first = Math.min(p.first, b.first); p.last = Math.max(p.last, b.last);
    }
    const c = candles.get(at); let quality = 'verified';
    if (!c) quality = 'missing_candle';
    else if (decimal(c.volume) !== q) quality = 'base_mismatch';
    else { const d = decimal(c.turnover, 16) - v; if (d > 10000000000n || d < -10000000000n) quality = 'quote_mismatch'; }
    const first = bins.reduce<Bin | null>((a, b) => !a || b.first < a.first ? b : a, null);
    const last = bins.reduce<Bin | null>((a, b) => !a || b.last > a.last ? b : a, null);
    minutes.push({ ts: at, quality, qty: format(q), quote: format(v, 16), o: first?.p ?? null, c: last?.p ?? null,
      h: bins.length ? Math.max(...bins.map(b => b.p)) : null, l: bins.length ? Math.min(...bins.map(b => b.p)) : null });
    qty += q; quote += v;
  }
  return { start: t.start, rows: t.rows, header: t.header, idGapTransitions: t.idGaps, outOfOrderMs: t.outOfOrder,
    qty: format(qty), quote: format(quote, 16), buyQty: format(buy), minutes,
    prices: [...prices.values()].sort((a, b) => a.p - b.p).map(p => ({ ...p, q: format(p.q), buy: format(p.buy) })),
    verifiedMinutes: minutes.filter(m => m.quality === 'verified').length, histogramRows: t.ordered().length };
}

async function download(url: string, out: string, config: any, checksum = true): Promise<any> {
  const ext = url.endsWith('.gz') ? '.csv.gz' : '.zip'; const file = path.join(out, sha(url) + ext), meta = file + '.json';
  if (fs.existsSync(meta)) { const r = read(meta); assert.equal(await fileHash(file), r.sha256, 'Cache integrity'); return r; }
  // Retain an interrupted archive as an orphan, never silently accept it.
  if (fs.existsSync(file)) fs.renameSync(file, file + '.orphan.' + Date.now());
  let error: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const tmp = file + '.part.' + process.pid + '.' + Date.now();
    try {
      const disk = fs.statfsSync(out); assert(Number(disk.bavail) * Number(disk.bsize) > config.reserveBytes + config.maxFileBytes * config.workers, 'Disk reserve reached');
      const requestedAt = Date.now(); const r = await fetch(url, { signal: AbortSignal.timeout(180000), redirect: 'error' });
      assert.equal(r.status, 200, url + ' HTTP ' + r.status); assert(r.body);
      const expected = Number(r.headers.get('content-length')); assert(expected > 0 && expected <= config.maxFileBytes, 'Archive byte cap');
      const fd = fs.openSync(tmp, 'wx'); let seen = 0;
      try { for await (const chunk of r.body as any) { const b = Buffer.from(chunk); seen += b.length; assert(seen <= config.maxFileBytes); fs.writeSync(fd, b); } fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      assert.equal(seen, expected); const hash = await fileHash(tmp); let checksumBody: string | null = null;
      if (checksum) {
        const c = await fetch(url + '.CHECKSUM', { signal: AbortSignal.timeout(30000) }); assert.equal(c.status, 200); checksumBody = await c.text(); assert(checksumBody.length < 4096);
        assert.equal(hash, checksumBody.trim().split(/\s+/)[0], 'Publisher checksum');
      }
      fs.renameSync(tmp, file); const record = { file: relative(file), url, bytes: seen, sha256: hash, requestedAt, receivedAt: Date.now(), checksumBody, historicalReceiptProven: false };
      atomicJson(meta, record); return record;
    } catch (e) { error = e; console.error(`[download retry ${attempt + 1}] ${url}: ${String(e)}`); }
  }
  throw error;
}
async function localBybitCandles(): Promise<Map<number, Candle>> {
  const all = new Map<number, Candle>();
  for (const f of ['data/HYPEUSDT_1_full.json', 'data/HYPEUSDT_1m.jsonl']) {
    const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const r of f.endsWith('jsonl') ? raw.trim().split('\n').map(l => JSON.parse(l)) : JSON.parse(raw)) {
      const ts = r.timestamp ?? r.ts; if (r.volume !== undefined || r.v !== undefined) all.set(ts, { volume: String(r.volume ?? r.v), turnover: String(r.turnover ?? r.t) });
    }
  }
  return all;
}
async function worker(job: string, index: number) {
  const plan = read(path.join(job, 'plan.json')), config = plan.card.resources;
  for (const p of plan.pins) assert.equal(await fileHash(path.join(ROOT, p.file)), p.sha256, 'Pinned input changed');
  const tasks: Archive[] = plan.archives.filter((_: any, i: number) => i % config.workers === index);
  const cache = path.join(job, 'raw'); fs.mkdirSync(cache, { recursive: true });
  const candles = await localBybitCandles(); const sampleRoot = path.join(ROOT, PARENT, 'samples');
  for (let i = 0; i < tasks.length; i++) {
    const a = tasks[i], day = a.venue + '-' + a.date, file = path.join(job, 'days', day + '.json');
    if (fs.existsSync(file)) {
      const done = read(file); assert.equal(await fileHash(path.join(ROOT, done.histogram.file)), done.histogram.sha256); continue;
    }
    let raw: any;
    const sample = path.join(sampleRoot, day + '.json');
    if (a.venue === 'bybit' && fs.existsSync(sample)) { raw = read(sample).raw; assert.equal(await fileHash(path.join(ROOT, raw.file)), raw.sha256); }
    else if (a.venue === 'binance' && fs.existsSync(path.join(ROOT, RAW_BINANCE, a.date + '-summary.json'))) {
      raw = { ...read(path.join(ROOT, RAW_BINANCE, a.date + '-summary.json')).raw }; raw.file = RAW_BINANCE + '/' + raw.file; assert.equal(await fileHash(path.join(ROOT, raw.file)), raw.sha256);
    } else raw = await download(a.url, cache, config, a.venue === 'binance');
    const tape = new TapeDay(a.venue, Date.parse(a.date), plan.card.symbol);
    await readArchive(path.join(ROOT, raw.file), config.maxExpandedBytes, l => tape.line(l));
    let comparison = candles; let candleSource: any = { kind: 'pinned_local_bybit', files: plan.pins.filter((p: any) => p.file.startsWith('data/')) };
    if (a.venue === 'binance') {
      const c = await download(`https://data.binance.vision/data/futures/um/daily/klines/${plan.card.symbol}/1m/${plan.card.symbol}-1m-${a.date}.zip`, cache, config);
      candleSource = c; comparison = new Map(); let header: string[] = [];
      await readArchive(path.join(ROOT, c.file), 10000000, l => { const f = csv(l); if (!header.length) { header = f; return; }
        const r = Object.fromEntries(header.map((k, n) => [k, f[n]])); const ts = Number(r.open_time);
        assert(ts >= tape.start && ts < tape.start + DAY && ts % 60000 === 0 && !comparison.has(ts)); comparison.set(ts, { volume: r.volume, turnover: r.quote_volume });
      });
    }
    const summary = summarize(tape, comparison), histogram = path.join(job, 'days', day + '.vap.jsonl.gz');
    const tmp = histogram + '.part.' + process.pid; const gz = zlib.createGzip({ level: 1 }); const done = pipeline(gz, fs.createWriteStream(tmp)); done.catch(() => {});
    for (const b of tape.ordered()) {
      const row = { ts: b.ts, price: format(BigInt(b.p)), baseQty: format(BigInt(b.q)), buyQty: format(BigInt(b.buy)), quoteNotional: format(BigInt(b.p) * BigInt(b.q), 16), records: b.n, firstTradeAt: b.first, lastTradeAt: b.last };
      if (!gz.write(JSON.stringify(row) + '\n')) await once(gz, 'drain');
    }
    gz.end(); await done; fs.renameSync(tmp, histogram);
    atomicJson(file, { version: 1, venue: a.venue, date: a.date, symbol: plan.card.symbol, ...summary, raw, candleSource,
      histogram: { file: relative(histogram), bytes: fs.statSync(histogram).size, sha256: await fileHash(histogram) } });
    console.log(`[worker ${index}] ${i + 1}/${tasks.length} ${day}: ${tape.rows} trades, verified ${summary.verifiedMinutes}/1440`);
    // Bound total retained *new* downloads; leave room for other workers' in-flight files.
    const retained = fs.readdirSync(cache).filter(f => /\.(gz|zip)$/.test(f)).reduce((s, f) => s + fs.statSync(path.join(cache, f)).size, 0);
    assert(retained < config.maxNewDownloadBytes - config.workers * config.maxFileBytes, 'New download budget reached');
  }
}
async function main() {
  if (process.argv[2] === '--worker') { await worker(path.resolve(process.argv[3]), Number(process.argv[4])); return; }
  const card = read(CARD); const files = [CARD, 'scripts/poc-history-ingest.ts', 'scripts/poc-volume-source.ts', 'scripts/research-workflow.ts',
    PARENT + '/inventory/archives.json', RAW_BINANCE + '/archives.json', 'data/HYPEUSDT_1_full.json', 'data/HYPEUSDT_1m.jsonl'];
  const pins = []; for (const file of files) pins.push({ file, sha256: await fileHash(path.join(ROOT, file)) });
  const key = sha(JSON.stringify({ card, pins, runtime: process.version })); const job = path.join(ROOT, 'backtests/poc-history-data', key);
  fs.mkdirSync(path.join(job, 'days'), { recursive: true });
  const archives: Archive[] = [...read(PARENT + '/inventory/archives.json').filter((r: Archive) => r.venue === 'bybit'), ...read(RAW_BINANCE + '/archives.json')]
    .filter((r: Archive) => Date.parse(r.date) < Date.parse(card.end) && Date.parse(r.date) + DAY > Date.parse(card.start)).sort((a, b) => a.date.localeCompare(b.date) || a.venue.localeCompare(b.venue));
  if (!fs.existsSync(path.join(job, 'plan.json'))) atomicJson(path.join(job, 'plan.json'), { key, card, pins, archives, runtime: process.version, createdAt: Date.now() });
  console.log(`[PVM01 data] ${job}; ${archives.length} archives; ${card.resources.workers} workers`);
  const workerOptions = { execArgv: ['-r', 'ts-node/register/transpile-only'], windowsHide: true, stdio: 'inherit' as const };
  const workers = Array.from({ length: card.resources.workers }, (_, i) => fork(__filename, ['--worker', job, String(i)], workerOptions));
  const codes = await Promise.all(workers.map(w => new Promise<number | null>((resolve, reject) => { w.on('error', reject); w.on('exit', resolve); })));
  assert(codes.every(c => c === 0), 'Worker failure; completed partitions are reusable, rerun same command');
  const manifest = [];
  for (const a of archives) { const f = path.join(job, 'days', `${a.venue}-${a.date}.json`); manifest.push({ venue: a.venue, date: a.date, file: relative(f), sha256: await fileHash(f) }); }
  atomicJson(path.join(job, 'complete.json'), { key, completedAt: Date.now(), partitions: manifest }); console.log(`[PVM01 data] COMPLETE ${job}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
