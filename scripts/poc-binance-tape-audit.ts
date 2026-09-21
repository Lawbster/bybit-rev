/** Follow-up source audit only. Separate immutable job; never alters PVA01 evidence. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { once } from 'events';
import { fileHash, inside } from './research-workflow';
import { sha, decimal, format, csv, readArchive, SampleAccumulator, DAY, coverage, Archive } from './poc-volume-source';
import { compareCandles } from './poc-volume-audit';
const root = path.resolve(__dirname, '..'), cardFile = 'research-inputs/poc-binance-tape-audit-pva01b-2026-09-17.json';
const write = (f: string, x: unknown) => fs.writeFileSync(f, JSON.stringify(x, null, 2) + '\n', { flag: 'wx' });
async function pin(file: string) { const f = inside(root, file); return { file, bytes: fs.statSync(f).size, sha256: await fileHash(f) }; }
async function textEvidence(out: string, name: string, url: string) {
  const requestedAt = Date.now(), r = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
  const body = await r.text(); assert(body.length < 5000000); write(path.join(out, name + '.json'), { url, requestedAt, receivedAt: Date.now(), status: r.status, body, sha256: sha(body) });
  assert.equal(r.status, 200); return body;
}
async function getArchive(out: string, stem: string, url: string, budget: { left: number }, cap: number) {
  const requestedAt = Date.now(), r = await fetch(url, { signal: AbortSignal.timeout(180000), redirect: 'error' }); assert.equal(r.status, 200); assert(r.body);
  const bytes = Number(r.headers.get('content-length')); assert(bytes > 0 && bytes <= cap && bytes <= budget.left, 'Download cap');
  const file = path.join(out, stem + '.zip'), fd = fs.openSync(file, 'wx'); let seen = 0;
  try { for await (const c of r.body as any) { const b = Buffer.from(c); budget.left -= b.length; seen += b.length; assert(budget.left >= 0 && seen <= cap); fs.writeSync(fd, b); } fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  assert.equal(bytes, seen);
  const checksumBody = await textEvidence(out, stem + '-checksum', url + '.CHECKSUM');
  const checksum = checksumBody.trim().split(/\s+/)[0]; assert(/^[a-f0-9]{64}$/.test(checksum)); assert.equal(await fileHash(file), checksum);
  const meta = { file: path.basename(file), url, bytes, sha256: checksum, requestedAt, receivedAt: Date.now(), historicalReceiptProven: false };
  write(path.join(out, stem + '-source.json'), meta); return meta;
}
async function main() {
  const card = JSON.parse(fs.readFileSync(path.join(root, cardFile), 'utf8'));
  const parent = inside(root, `backtests/poc-volume-audit/${card.parent}`), sourceFiles = [cardFile, 'scripts/poc-binance-tape-audit.ts', 'scripts/poc-volume-source.ts', 'scripts/poc-volume-audit.ts'];
  const parentSummary = JSON.parse(fs.readFileSync(path.join(parent, 'samples/summary.json'), 'utf8'));
  const pins = []; for (const f of [...sourceFiles, `backtests/poc-volume-audit/${card.parent}/samples/summary.json`]) pins.push(await pin(f));
  const key = sha(JSON.stringify({ card, pins, runtime: process.version })), out = inside(root, `backtests/poc-binance-tape-audit/${key}`);
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.mkdirSync(out);
  write(path.join(out, 'plan.json'), { card, pins, key, createdAt: Date.now(), runtime: process.version }); console.log(`[PVA01B] ${key}`);
  const rows: Archive[] = []; let token: string | null = null, page = 0;
  do {
    assert(page < 20); const url = new URL('https://s3-ap-northeast-1.amazonaws.com/data.binance.vision');
    url.searchParams.set('list-type', '2'); url.searchParams.set('prefix', `data/futures/um/daily/trades/${card.symbol}/`); url.searchParams.set('max-keys', '1000'); if (token) url.searchParams.set('continuation-token', token);
    const body = await textEvidence(out, 'listing-' + page++, url.href); assert(body.includes('<ListBucketResult'));
    for (const m of body.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const k = /<Key>(.*?)<\/Key>/.exec(m[1])![1], d = /HYPEUSDT-trades-(\d{4}-\d{2}-\d{2})\.zip$/.exec(k)?.[1]; if (!d) continue;
      const fileUrl = 'https://data.binance.vision/' + k; rows.push({ venue: 'binance', date: d, url: fileUrl, checksumUrl: fileUrl + '.CHECKSUM', bytes: Number(/<Size>(\d+)<\/Size>/.exec(m[1])![1]) });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(body) ? /<NextContinuationToken>(.*?)<\/NextContinuationToken>/.exec(body)![1].replace(/&amp;/g, '&') : null;
  } while (token);
  const cov = coverage(rows, Date.parse(card.sourceStart), Date.parse(card.cutoff)); write(path.join(out, 'archives.json'), rows);
  const budget = { left: card.maxDownloadBytes }, results = [];
  for (const day of card.samples) {
    console.log(`[PVA01B] ${day}: individual trades and 1m candle archive`);
    const row = rows.find(r => r.date === day); assert(row);
    const raw = await getArchive(out, day + '-trades', row.url, budget, card.maxFileBytes);
    const candle = await getArchive(out, day + '-candles', `https://data.binance.vision/data/futures/um/daily/klines/${card.symbol}/1m/${card.symbol}-1m-${day}.zip`, budget, card.maxFileBytes);
    const a = new SampleAccumulator(Date.parse(day)), candles = new Map<number, any>(); let header: string[] = [], candleHeader: string[] = [];
    let previousId: bigint | null = null, idGapTransitions = 0, missingIds = 0n;
    await readArchive(path.join(out, raw.file), card.maxExpandedBytes, line => {
      const fields = csv(line); if (!header.length) { header = fields; console.log(`[PVA01B] trade header ${header.join(',')}`); return; }
      assert.equal(fields.length, header.length); const r = Object.fromEntries(header.map((k, i) => [k, fields[i]]));
      const id = r.id ?? r.trade_id; assert(/^\d+$/.test(id));
      const ts = Number(r.time), price = decimal(r.price), qty = decimal(r.qty); assert(Number.isSafeInteger(ts) && price > 0n && qty > 0n);
      assert(['true', 'false'].includes(r.is_buyer_maker));
      const currentId = BigInt(id);
      if (previousId !== null) { assert(currentId > previousId, 'Duplicate/out-of-order raw trade ID'); if (currentId !== previousId + 1n) { idGapTransitions++; missingIds += currentId - previousId - 1n; } } previousId = currentId;
      a.add({ id, ts, subMs: '0', price, qty, quote: price * qty, side: r.is_buyer_maker === 'true' ? 'Sell' : 'Buy' });
      if (a.rows % 1000000 === 0) console.log(`[PVA01B] ${day}: ${a.rows} raw trades`);
    });
    await readArchive(path.join(out, candle.file), 10000000, line => {
      const fields = csv(line); if (!candleHeader.length) { candleHeader = fields; return; }
      assert.equal(fields.length, candleHeader.length); const r = Object.fromEntries(candleHeader.map((k, i) => [k, fields[i]]));
      const ts = Number(r.open_time); assert(Number.isSafeInteger(ts) && ts >= Date.parse(day) && ts < Date.parse(day) + DAY && ts % 60000 === 0); assert(!candles.has(ts));
      candles.set(ts, { volume: r.volume, turnover: r.quote_volume, source: candle.url });
    });
    assert.equal(candles.size, 1440, 'Candle day completeness');
    const rawComparison = compareCandles(a, candles);
    const aggSample = parentSummary.samples.find((s: any) => s.venue === 'binance' && s.date === day); assert(aggSample);
    const aggFile = inside(root, aggSample.raw.file); assert.equal(await fileHash(aggFile), aggSample.raw.sha256);
    const g = new SampleAccumulator(Date.parse(day)); let ah: string[] = [];
    await readArchive(aggFile, card.maxExpandedBytes, line => {
      const f = csv(line); if (!ah.length) { ah = f; return; } const r = Object.fromEntries(ah.map((k, i) => [k, f[i]]));
      const p = decimal(r.price), q = decimal(r.quantity); g.add({ id: r.agg_trade_id, ts: Number(r.transact_time), subMs: '0', price: p, qty: q, quote: p * q, side: r.is_buyer_maker === 'true' ? 'Sell' : 'Buy' });
    });
    const aggComparison = compareCandles(g, candles), hist = path.join(out, day + '.vap.jsonl.gz'), gz = zlib.createGzip(), dest = fs.createWriteStream(hist, { flags: 'wx' });
    const done = pipeline(gz, dest); done.catch(() => {});
    for (const b of [...a.bins.values()].sort((x, y) => x.ts - y.ts || (x.price < y.price ? -1 : x.price > y.price ? 1 : 0))) {
      if (!gz.write(JSON.stringify({ ts: b.ts, price: format(b.price), baseQty: format(b.qty), buyQty: format(b.buyQty), quoteNotional: format(b.quote, 16), records: b.records, firstTradeAt: b.firstTs, lastTradeAt: b.lastTs }) + '\n')) await once(gz, 'drain');
    }
    gz.end(); await done;
    const result = { day, header, candleHeader, raw, candle, ...a.summary(), idGapTransitions, missingIds: String(missingIds),
      rawComparison: { ...rawComparison, mismatches: rawComparison.mismatches.length }, aggregateComparison: { ...aggComparison, mismatches: aggComparison.mismatches.length },
      histogram: { file: path.basename(hist), sha256: await fileHash(hist), bytes: fs.statSync(hist).size } };
    write(path.join(out, day + '-raw-mismatches.json'), rawComparison.mismatches); write(path.join(out, day + '-aggregate-mismatches.json'), aggComparison.mismatches);
    write(path.join(out, day + '-summary.json'), result); results.push(result);
    console.log(`[PVA01B] ${day}: raw exact ${rawComparison.exactBaseMinutes}/1440; aggregate exact ${aggComparison.exactBaseMinutes}/1440; raw ID gaps ${idGapTransitions}`);
  }
  for (const p of pins) assert.deepEqual(await pin(p.file), p);
  write(path.join(out, 'summary.json'), { key, coverage: cov, results, downloadedBytes: card.maxDownloadBytes - budget.left, liveChanges: 0, strategyExecutions: 0 });
  const artifacts = []; for (const f of fs.readdirSync(out).sort()) artifacts.push({ file: f, bytes: fs.statSync(path.join(out, f)).size, sha256: await fileHash(path.join(out, f)) });
  write(path.join(out, 'complete.json'), { completedAt: Date.now(), artifacts }); console.log(`[PVA01B] complete ${out}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
