/** Independent individual-trade -> histogram + official-candle reconciliation. */
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import zlib from 'zlib';
import { fileHash, inside } from './research-workflow';
import { decimal, format, readArchive, sha, DAY } from './poc-volume-source';
async function main() {
  const root = path.resolve(__dirname, '..'), key = process.argv[2]; assert(/^[a-f0-9]{64}$/.test(key));
  const out = inside(root, `backtests/poc-binance-tape-audit/${key}`), plan = JSON.parse(fs.readFileSync(path.join(out, 'plan.json'), 'utf8'));
  for (const p of plan.pins) assert.equal(await fileHash(inside(root, p.file)), p.sha256);
  const seal = JSON.parse(fs.readFileSync(path.join(out, 'complete.json'), 'utf8'));
  for (const a of seal.artifacts) assert.equal(await fileHash(path.join(out, a.file)), a.sha256);
  const summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8')), checks = [];
  for (const s of summary.results) {
    const start = Date.parse(s.day), bins = new Map<string, { q: bigint; buy: bigint; quote: bigint; n: number; first: number; last: number }>(), mins = new Map<number, { q: bigint; quote: bigint }>();
    let header: string[] = [], count = 0, qty = 0n, quote = 0n;
    await readArchive(path.join(out, s.raw.file), plan.card.maxExpandedBytes, line => {
      assert(!line.includes('"')); const f = line.split(','); if (!header.length) { header = f; return; }
      assert.equal(f.length, header.length); const r = Object.fromEntries(header.map((k, i) => [k, f[i]]));
      const ts = Number(r.time); assert(Number.isSafeInteger(ts) && ts >= start && ts < start + DAY);
      const minute = Math.floor(ts / 60000) * 60000, p = decimal(r.price), q = decimal(r.qty), n = p * q, k = minute + ':' + p;
      let b = bins.get(k); if (!b) { b = { q: 0n, buy: 0n, quote: 0n, n: 0, first: ts, last: ts }; bins.set(k, b); }
      b.q += q; b.quote += n; if (r.is_buyer_maker === 'false') b.buy += q; b.n++; b.first = Math.min(b.first, ts); b.last = Math.max(b.last, ts);
      const m = mins.get(minute) ?? { q: 0n, quote: 0n }; m.q += q; m.quote += n; mins.set(minute, m);
      qty += q; quote += n; count++;
    });
    assert.equal(count, s.rows); assert.equal(format(qty), s.baseQty); assert.equal(format(quote, 16), s.quoteNotional);
    let ch: string[] = [], minuteCount = 0, exactQty = 0, exactQuote = 0;
    await readArchive(path.join(out, s.candle.file), 10000000, line => {
      const f = line.split(','); if (!ch.length) { ch = f; return; } const r = Object.fromEntries(ch.map((k, i) => [k, f[i]]));
      const m = mins.get(Number(r.open_time)) ?? { q: 0n, quote: 0n };
      if (m.q === decimal(r.volume)) exactQty++;
      if (m.quote === decimal(r.quote_volume, 16)) exactQuote++;
      minuteCount++;
    });
    assert.equal(minuteCount, 1440); assert.equal(exactQty, s.rawComparison.exactBaseMinutes);
    assert.equal(s.rawComparison.missingCandles, 0);
    const input = fs.createReadStream(path.join(out, s.histogram.file)), unzip = zlib.createGunzip(); input.on('error', e => unzip.destroy(e)); input.pipe(unzip);
    const lines = readline.createInterface({ input: unzip, crlfDelay: Infinity }); let checked = 0;
    for await (const line of lines) {
      const r = JSON.parse(line), k = r.ts + ':' + decimal(r.price), b = bins.get(k); assert(b);
      assert.equal(decimal(r.baseQty), b.q); assert.equal(decimal(r.buyQty), b.buy); assert.equal(decimal(r.quoteNotional, 16), b.quote);
      assert.equal(r.records, b.n); assert.equal(r.firstTradeAt, b.first); assert.equal(r.lastTradeAt, b.last); bins.delete(k); checked++;
    }
    assert.equal(bins.size, 0); assert.equal(checked, s.histogramRows);
    checks.push({ date: s.day, rows: count, exactBins: checked, exactBaseMinutes: exactQty, exactQuoteMinutes: exactQuote });
    console.log(`[PVA01B independent] ${s.day}: ${count} trades, ${checked} bins, exact base/quote minutes ${exactQty}/${exactQuote}`);
  }
  const result = { key, checkedAt: Date.now(), verifierSha256: sha(fs.readFileSync(__filename)), checks, fullHistoricalCoverageVerified: false };
  fs.writeFileSync(path.join(out, 'independent-verification.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
}
main().catch(e => { console.error(e); process.exitCode = 1; });
