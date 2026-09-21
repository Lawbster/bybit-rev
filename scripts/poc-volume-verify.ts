/** Independent row-to-histogram audit. Reuses only the tested decoder/decimal utilities. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import readline from 'readline';
import zlib from 'zlib';
import { fileHash, inside } from './research-workflow';
import { readArchive, decimal, format, DAY, sha } from './poc-volume-source';

async function main() {
  const root = path.resolve(__dirname, '..'), key = process.argv[2]; assert(/^[a-f0-9]{64}$/.test(key));
  const out = inside(root, `backtests/poc-volume-audit/${key}`), plan = JSON.parse(fs.readFileSync(path.join(out, 'plan.json'), 'utf8'));
  for (const p of [...plan.pins, ...plan.protectedPins]) { assert.equal(await fileHash(inside(root, p.file)), p.sha256); assert.equal(fs.statSync(inside(root, p.file)).size, p.bytes); }
  const summary = JSON.parse(fs.readFileSync(path.join(out, 'samples/summary.json'), 'utf8'));
  const checks = [];
  for (const sample of summary.samples) {
    assert.equal(sample.status, 'parsed', 'Selected sample not validated');
    const file = inside(root, sample.raw.file); assert.equal(await fileHash(file), sample.raw.sha256);
    if (sample.raw.expectedSha256) assert.equal(sample.raw.sha256, sample.raw.expectedSha256);
    const start = Date.parse(sample.date), bins = new Map<string, { qty: bigint; quote: bigint; buy: bigint; n: number; first: number; last: number }>();
    const ids = new Set<string>(); let rows = 0, duplicate = 0, header: string[] = [], totalQty = 0n, totalQuote = 0n;
    const expanded = await readArchive(file, plan.card.maxExpandedBytes, line => {
      // These exchange archive formats are flat scalar CSV; reject unexpected quoting.
      assert(!line.includes('"'), 'Unexpected quoted archive: independent parser needs review');
      const fields = line.split(','); if (!header.length) { header = fields; return; }
      assert.equal(fields.length, header.length); const r = Object.fromEntries(header.map((v, i) => [v, fields[i]])); rows++;
      const bybit = sample.venue === 'bybit', id = bybit ? r.trdMatchID : r.agg_trade_id;
      if (ids.has(id)) { duplicate++; return; } ids.add(id);
      const ts = bybit ? Number(decimal(r.timestamp, 9) / 1000000n) : Number(r.transact_time);
      assert(ts >= start && ts < start + DAY); const minute = Math.floor(ts / 60000) * 60000;
      const p = decimal(r.price), q = decimal(bybit ? r.size : r.quantity), quote = p * q;
      const buy = bybit ? r.side === 'Buy' : r.is_buyer_maker === 'false';
      const k = minute + ':' + p; let b = bins.get(k);
      if (!b) { b = { qty: 0n, quote: 0n, buy: 0n, n: 0, first: ts, last: ts }; bins.set(k, b); }
      b.qty += q; b.quote += quote; if (buy) b.buy += q; b.n++; b.first = Math.min(b.first, ts); b.last = Math.max(b.last, ts);
      totalQty += q; totalQuote += quote;
    });
    assert.equal(expanded, sample.expandedBytes); assert.equal(rows, sample.rows); assert.equal(duplicate, sample.duplicates);
    assert.equal(ids.size, sample.uniqueRows); assert.equal(format(totalQty), sample.baseQty); assert.equal(format(totalQuote, 16), sample.quoteNotional);
    const hist = path.join(out, 'samples', sample.histogram.file); assert.equal(await fileHash(hist), sample.histogram.sha256);
    const input = fs.createReadStream(hist), decoded = zlib.createGunzip(); input.on('error', e => decoded.destroy(e)); input.pipe(decoded);
    const lines = readline.createInterface({ input: decoded, crlfDelay: Infinity }); let checked = 0, prevTime = -1, prevPrice = -1n;
    for await (const line of lines) {
      const r = JSON.parse(line), p = decimal(r.price), k = r.ts + ':' + p, b = bins.get(k); assert(b, `Unexpected/duplicate bin ${k}`);
      assert(r.ts > prevTime || r.ts === prevTime && p > prevPrice); prevTime = r.ts; prevPrice = p;
      assert.equal(decimal(r.baseQty), b.qty); assert.equal(decimal(r.quoteNotional, 16), b.quote); assert.equal(decimal(r.buyQty), b.buy);
      assert.equal(r.records, b.n); assert.equal(r.firstTradeAt, b.first); assert.equal(r.lastTradeAt, b.last); bins.delete(k); checked++;
    }
    assert.equal(bins.size, 0); assert.equal(checked, sample.histogramRows);
    checks.push({ venue: sample.venue, date: sample.date, rawRows: rows, exactPriceMinuteBins: checked, rawHash: sample.raw.sha256, histogramHash: sample.histogram.sha256 });
    console.log(`[PVA01 independent] ${sample.venue} ${sample.date}: ${rows} records / ${checked} bins agree`);
  }
  for (const stage of ['inventory', 'samples']) {
    const seal = JSON.parse(fs.readFileSync(path.join(out, stage + '-complete.json'), 'utf8'));
    for (const item of seal.artifacts) assert.equal(await fileHash(path.join(out, stage, item.file)), item.sha256);
  }
  const result = { checkedAt: Date.now(), key, verifierSha256: sha(fs.readFileSync(__filename)),
    checks, rows: checks.reduce((n, x) => n + x.rawRows, 0), bins: checks.reduce((n, x) => n + x.exactPriceMinuteBins, 0),
    productionFilesUnchanged: true, fullArchiveContentsVerified: false, economicReplay: false };
  fs.writeFileSync(path.join(out, 'independent-verification.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
