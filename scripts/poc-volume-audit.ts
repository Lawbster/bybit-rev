/** PVA01: public archive inventory + bounded sample validation. Not a strategy replay. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import zlib from 'zlib';
import { once } from 'events';
import { pipeline } from 'stream/promises';
import { fileHash, inside } from './research-workflow';
import { Archive, Venue, DAY, sha, csv, decimal, format, normalize, coverage, parseBybitListing, parseBinanceListing, readArchive, SampleAccumulator } from './poc-volume-source';

const ROOT = path.resolve(__dirname, '..');
const CARD = 'research-inputs/poc-volume-audit-pva01-2026-09-17.json';
const SOURCES = ['scripts/poc-volume-source.ts', 'scripts/poc-volume-audit.ts', 'scripts/poc-volume-source-tests.ts'];
const PROTECTED = ['bot-config.json', 'hl-short-live-config.json', 'bot-state.json', 'src/data-collector.ts', 'src/hyperliquid-collector.ts'];
function write(file: string, value: unknown) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
async function pin(file: string) { const f = inside(ROOT, file); return { file, bytes: fs.statSync(f).size, sha256: await fileHash(f) }; }
async function checkPins(plan: any) { for (const p of [...plan.pins, ...plan.protectedPins]) assert.deepEqual(await pin(p.file), p, `Input changed: ${p.file}`); }
function job(key: string) { assert(/^[a-f0-9]{64}$/.test(key)); return inside(ROOT, `backtests/poc-volume-audit/${key}`); }
async function planJob() {
  const card = JSON.parse(fs.readFileSync(path.join(ROOT, CARD), 'utf8'));
  assert.equal(card.id, 'poc-volume-audit-pva01-2026-09-17'); assert(/^[A-Z0-9]+$/.test(card.symbol));
  const pins = []; for (const f of [CARD, ...SOURCES, ...card.localInputs]) pins.push(await pin(f));
  const protectedPins = []; for (const f of PROTECTED) protectedPins.push(await pin(f));
  const identity = { card, pins, runtime: process.version }, key = sha(JSON.stringify(identity));
  const out = job(key); fs.mkdirSync(path.dirname(out), { recursive: true });
  if (!fs.existsSync(out)) { fs.mkdirSync(out); write(path.join(out, 'plan.json'), { key, ...identity, protectedPins, plannedAt: Date.now() }); }
  else { const existing = JSON.parse(fs.readFileSync(path.join(out, 'plan.json'), 'utf8')); assert.equal(existing.key, key); await checkPins(existing); }
  console.log(key);
}
async function requestText(out: string, name: string, url: string, method = 'GET') {
  const requestedAt = Date.now();
  try {
    const r = await fetch(url, { method, signal: AbortSignal.timeout(30000), redirect: 'error' });
    const body = method === 'HEAD' ? '' : await r.text(); assert(Buffer.byteLength(body) < 8000000, 'Oversized listing');
    const e = { url, method, requestedAt, receivedAt: Date.now(), status: r.status,
      contentLength: r.headers.get('content-length'), lastModified: r.headers.get('last-modified'), etag: r.headers.get('etag'), body, bodySha256: sha(body) };
    write(path.join(out, name + '.json'), e); return e;
  } catch (error) { write(path.join(out, name + '.error.json'), { url, method, requestedAt, error: String(error), observedAt: Date.now() }); throw error; }
}
async function inventory(out: string, plan: any) {
  const stage = path.join(out, 'inventory'); fs.mkdirSync(stage); const card = plan.card, symbol = card.symbol;
  const b = await requestText(stage, 'bybit-listing', `https://public.bybit.com/trading/${symbol}/`); assert.equal(b.status, 200);
  const bybit = parseBybitListing(b.body, symbol), binance: Archive[] = [];
  let token: string | null = null, pages = 0;
  do {
    assert(pages < card.maxListingPages, 'Pagination limit');
    const url = new URL('https://s3-ap-northeast-1.amazonaws.com/data.binance.vision');
    url.searchParams.set('list-type', '2'); url.searchParams.set('prefix', `data/futures/um/daily/aggTrades/${symbol}/`); url.searchParams.set('max-keys', '1000');
    if (token) url.searchParams.set('continuation-token', token);
    const r = await requestText(stage, `binance-listing-${pages++}`, url.href); assert.equal(r.status, 200);
    const parsed = parseBinanceListing(r.body, symbol); binance.push(...parsed.rows); token = parsed.truncated ? parsed.next : null;
  } while (token);
  assert.equal(new Set(binance.map(x => x.date)).size, binance.length);
  for (const date of card.samples.bybit) {
    const row = bybit.find(x => x.date === date); if (!row) continue;
    const r = await requestText(stage, 'bybit-head-' + date, row.url, 'HEAD');
    if (r.status === 200 && r.contentLength !== null) row.bytes = Number(r.contentLength);
  }
  // Intentionally unsigned, no AWS credentials or request-payer header.
  const hl = await requestText(stage, 'hl-anonymous-listing', 'https://hl-mainnet-node-data.s3.amazonaws.com/?list-type=2&prefix=node_fills_by_block/&max-keys=1');
  const start = Date.parse(card.sourceStart), end = Date.parse(card.cutoff);
  const rows = [...bybit, ...binance].filter(r => Date.parse(r.date) < end && Date.parse(r.date) + DAY > start).sort((a, b) => a.venue.localeCompare(b.venue) || a.date.localeCompare(b.date));
  const summary = { bybit: coverage(bybit, start, end), binance: coverage(binance, start, end),
    hyperliquid: { httpStatus: hl.status, inventoryVerified: false, authorizedPaidAccess: false,
      reason: hl.status === 403 ? 'Anonymous requester-pays access denied; no authenticated retrieval attempted' : 'Separate paid archive audit required' },
    sourceStart: start, cutoff: end, listingOnly: true };
  write(path.join(stage, 'archives.json'), rows); write(path.join(stage, 'summary.json'), summary);
  console.log(JSON.stringify(summary));
}

async function download(row: Archive, cache: string, budget: { remaining: number }, cap: number) {
  assert(row.url.startsWith('https://public.bybit.com/trading/') || row.url.startsWith('https://data.binance.vision/data/futures/um/'));
  const ext = row.venue === 'bybit' ? '.csv.gz' : '.zip', base = path.join(cache, sha(row.url)), file = base + ext, metaFile = base + '.json';
  if (fs.existsSync(file) || fs.existsSync(metaFile)) {
    assert(fs.existsSync(file) && fs.existsSync(metaFile), 'Incomplete cached download; inspect before retry');
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    assert.equal(meta.url, row.url); assert.equal(meta.sha256, await fileHash(file)); assert.equal(meta.bytes, fs.statSync(file).size);
    if (row.bytes !== null) assert.equal(meta.bytes, row.bytes, 'Archive size changed; do not replace frozen cache');
    return { file, ...meta, cached: true };
  }
  const requestedAt = Date.now(), r = await fetch(row.url, { signal: AbortSignal.timeout(180000), redirect: 'error' });
  assert.equal(r.status, 200, `Archive HTTP ${r.status}`); assert(r.body);
  const length = Number(r.headers.get('content-length')); assert(length > 0 && length <= cap && length <= budget.remaining, 'Sample download budget');
  const part = file + '.part', fd = fs.openSync(part, 'wx'); let bytes = 0;
  try {
    for await (const value of r.body as any) { const b = Buffer.from(value); bytes += b.length; budget.remaining -= b.length;
      assert(bytes <= cap && budget.remaining >= 0, 'Sample download budget'); fs.writeSync(fd, b); }
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  assert.equal(bytes, length); if (row.bytes !== null) assert.equal(bytes, row.bytes);
  const sha256 = await fileHash(part);
  let expectedSha256: string | null = null, checksumBody: string | null = null;
  if (row.checksumUrl) {
    const check = await fetch(row.checksumUrl, { signal: AbortSignal.timeout(30000), redirect: 'error' }); assert.equal(check.status, 200);
    checksumBody = await check.text(); assert(checksumBody.length < 1024); expectedSha256 = checksumBody.trim().split(/\s+/)[0];
    assert(/^[a-f0-9]{64}$/.test(expectedSha256)); assert.equal(sha256, expectedSha256, 'Publisher checksum');
  }
  fs.renameSync(part, file);
  const meta = { url: row.url, requestedAt, receivedAt: Date.now(), bytes, sha256, expectedSha256, checksumBody,
    lastModified: r.headers.get('last-modified'), etag: r.headers.get('etag'), historicalReceiptProven: false };
  write(metaFile, meta); return { file, ...meta, cached: false };
}
function localCandles(plan: any): Map<string, Map<number, any>> {
  const out = new Map<string, Map<number, any>>();
  for (const venue of ['bybit', 'binance']) for (const day of plan.card.samples[venue]) out.set(venue + ':' + day, new Map());
  for (const relative of plan.card.localInputs) {
    const venue = relative.includes('/binance/') ? 'binance' : 'bybit', text = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    const rows = relative.endsWith('.jsonl') ? text.trim().split(/\r?\n/).filter(Boolean).map(s => JSON.parse(s)) : JSON.parse(text);
    for (const r of rows) {
      const ts = Number(r.timestamp ?? r.ts); if (!Number.isSafeInteger(ts)) continue;
      const target = out.get(venue + ':' + new Date(ts).toISOString().slice(0, 10));
      if (target) target.set(ts, { ...r, source: relative });
    }
  }
  return out;
}
export function compareCandles(a: SampleAccumulator, candles: Map<number, any>) {
  const mismatches: any[] = []; let matched = 0, exactBase = 0, quoteWithinTolerance = 0, missingCandles = 0, candlesWithoutTrades = 0;
  let tradeQty = 0n, candleQty = 0n, tradeQuote = 0n, candleQuote = 0n;
  for (let ts = a.start; ts < a.start + DAY; ts += 60000) {
    const c = candles.get(ts), m = a.minutes.get(ts);
    if (!c) { missingCandles++; continue; }
    matched++; const cv = decimal(String(c.volume ?? c.v)), cq = decimal(String(c.turnover ?? c.t), 16), mv = m?.qty ?? 0n, mq = m?.quote ?? 0n;
    tradeQty += mv; candleQty += cv; tradeQuote += mq; candleQuote += cq;
    if (mv === cv) exactBase++;
    // Quote turnover may have exchange rounding: allow one micro quote-unit/minute.
    const quoteDelta = mq - cq, quoteOk = (quoteDelta < 0n ? -quoteDelta : quoteDelta) <= 10000000000n;
    if (quoteOk) quoteWithinTolerance++;
    if (!m && cv > 0n) candlesWithoutTrades++;
    if (mv !== cv || !quoteOk) mismatches.push({ ts, tradeQty: format(mv), candleQty: format(cv), deltaQty: format(mv - cv),
      deltaQuote: format(quoteDelta, 16), candleSource: c.source });
  }
  return { matchedMinutes: matched, missingCandles, exactBaseMinutes: exactBase, quoteWithinToleranceMinutes: quoteWithinTolerance,
    candlesWithoutTrades, comparedTradeQty: format(tradeQty), comparedCandleQty: format(candleQty), baseDelta: format(tradeQty - candleQty),
    quoteDelta: format(tradeQuote - candleQuote, 16), mismatches };
}
async function histogram(file: string, a: SampleAccumulator) {
  const gzip = zlib.createGzip(), target = fs.createWriteStream(file, { flags: 'wx' });
  const done = pipeline(gzip, target);
  // Attach early to prevent an unhandled rejection if a later write fails.
  done.catch(() => {});
  try {
    for (const b of [...a.bins.values()].sort((x, y) => x.ts - y.ts || (x.price < y.price ? -1 : x.price > y.price ? 1 : 0))) {
      const row = { ts: b.ts, price: format(b.price), baseQty: format(b.qty), buyQty: format(b.buyQty), quoteNotional: format(b.quote, 16), records: b.records, firstTradeAt: b.firstTs, lastTradeAt: b.lastTs };
      if (!gzip.write(JSON.stringify(row) + '\n')) await once(gzip, 'drain');
    }
    gzip.end(); await done;
  } catch (e) { gzip.destroy(); await done.catch(() => {}); throw e; }
}
async function samples(out: string, plan: any) {
  const stage = path.join(out, 'samples'); fs.mkdirSync(stage);
  const inventory: Archive[] = JSON.parse(fs.readFileSync(path.join(out, 'inventory/archives.json'), 'utf8'));
  const cache = inside(ROOT, 'backtests/poc-volume-cache'); fs.mkdirSync(cache, { recursive: true });
  const candles = localCandles(plan), budget = { remaining: plan.card.maxDownloadBytes }, results = [];
  for (const venue of ['bybit', 'binance'] as Venue[]) for (const date of plan.card.samples[venue]) {
    const row = inventory.find(x => x.venue === venue && x.date === date);
    if (!row) { results.push({ venue, date, status: 'not_listed' }); continue; }
    console.log(`[PVA01] ${venue} ${date}: downloading/validating cached archive`);
    const raw = await download(row, cache, budget, plan.card.maxFileBytes);
    const a = new SampleAccumulator(Date.parse(date)); let header: string[] | null = null;
    const expandedBytes = await readArchive(raw.file, plan.card.maxExpandedBytes, line => {
      const fields = csv(line); if (!header) { header = fields; return; }
      a.add(normalize(venue, header, fields, plan.card.symbol));
      if (a.rows % 500000 === 0) console.log(`[PVA01] ${venue} ${date}: ${a.rows} trade records`);
    });
    const comparison = compareCandles(a, candles.get(venue + ':' + date)!);
    const stem = venue + '-' + date, binsFile = path.join(stage, stem + '.vap.jsonl.gz');
    await histogram(binsFile, a);
    const result = { venue, date, status: 'parsed', header, raw: { ...raw, file: path.relative(ROOT, raw.file).replace(/\\/g, '/') }, expandedBytes,
      ...a.summary(), comparison: { ...comparison, mismatches: comparison.mismatches.length },
      histogram: { file: path.basename(binsFile), bytes: fs.statSync(binsFile).size, sha256: await fileHash(binsFile),
        priceGrid: 'exact observed decimal prices, NOT selected POC row width', clock: 'minute bins usable after minute close; original receipt unknown' } };
    write(path.join(stage, stem + '.mismatches.json'), comparison.mismatches);
    write(path.join(stage, stem + '.json'), result); results.push(result);
    console.log(`[PVA01] ${venue} ${date}: ${a.rows} rows; ${comparison.exactBaseMinutes}/${comparison.matchedMinutes} exact volume minutes; ${comparison.missingCandles} unavailable candles`);
  }
  write(path.join(stage, 'summary.json'), { samples: results, downloadedBytesThisRun: plan.card.maxDownloadBytes - budget.remaining, strategyExecutions: 0, liveChanges: 0 });
}
async function sealStage(out: string, stage: string) {
  const dir = path.join(out, stage), artifacts = [];
  for (const file of fs.readdirSync(dir).sort()) artifacts.push({ file, bytes: fs.statSync(path.join(dir, file)).size, sha256: await fileHash(path.join(dir, file)) });
  write(path.join(out, stage + '-complete.json'), { completedAt: Date.now(), artifacts });
}
async function main() {
  const [cmd, key] = process.argv.slice(2);
  if (cmd === 'plan') return planJob();
  assert(['inventory', 'samples', 'verify'].includes(cmd), 'Usage: plan | inventory KEY | samples KEY | verify KEY');
  const out = job(key), plan = JSON.parse(fs.readFileSync(path.join(out, 'plan.json'), 'utf8'));
  await checkPins(plan);
  if (cmd === 'verify') {
    for (const stage of ['inventory', 'samples']) {
      const seal = JSON.parse(fs.readFileSync(path.join(out, stage + '-complete.json'), 'utf8'));
      for (const a of seal.artifacts) { assert.equal(a.bytes, fs.statSync(path.join(out, stage, a.file)).size); assert.equal(a.sha256, await fileHash(path.join(out, stage, a.file))); }
    }
    console.log('Pinned inputs and sealed artifacts verified; economic validity is not asserted.'); return;
  }
  try { if (cmd === 'inventory') await inventory(out, plan); else { assert(fs.existsSync(path.join(out, 'inventory-complete.json'))); await samples(out, plan); }
    await checkPins(plan); await sealStage(out, cmd);
  } catch (error) { const file = path.join(out, cmd + '-failed-' + Date.now() + '.json'); write(file, { error: String(error), failedAt: Date.now() }); throw error; }
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
