import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { TapeDay, fixed, ROOT } from './poc-history-ingest';
import { readArchive, format } from './poc-volume-source';
async function main() {
  assert.equal(fixed('1.00000001'), 100000001); assert.throws(() => fixed('0.000000001')); assert.throws(() => fixed('90071993'));
  const p = path.join(ROOT, 'backtests/poc-volume-audit/877f6836f8ab3ad6e2bd8c3268479da131890afbeb7c12750a24358d506f5781/samples');
  const b = path.join(ROOT, 'backtests/poc-binance-tape-audit/a2c29361f307d598ede16d8a4548e0074d27749dd5787279a01abe0c9713a540');
  for (const [venue, dates] of Object.entries({ bybit: ['2024-12-06', '2025-05-31', '2026-06-15', '2026-09-14'], binance: ['2025-05-31', '2026-06-15', '2026-09-14'] })) {
    for (const date of dates) {
      const s = JSON.parse(fs.readFileSync(venue === 'bybit' ? path.join(p, `${venue}-${date}.json`) : path.join(b, date + '-summary.json'), 'utf8'));
      const t = new TapeDay(venue as any, Date.parse(date), 'HYPEUSDT');
      await readArchive(venue === 'bybit' ? path.join(ROOT, s.raw.file) : path.join(b, s.raw.file), 3221225472, l => t.line(l));
      assert.equal(t.rows, s.rows); let seen = 0;
      await readArchive(path.join(venue === 'bybit' ? p : b, s.histogram.file), 3221225472, l => {
        const row = JSON.parse(l); const price = fixed(row.price); const actual = t.bins.get(row.ts)?.get(price); assert(actual);
        assert.deepEqual({ ts: actual.ts, price: format(BigInt(actual.p)), baseQty: format(BigInt(actual.q)), buyQty: format(BigInt(actual.buy)),
          quoteNotional: format(BigInt(actual.p) * BigInt(actual.q), 16), records: actual.n, firstTradeAt: actual.first, lastTradeAt: actual.last }, row); seen++;
      });
      assert.equal(t.ordered().length, seen); console.log(`PASS exact audited histogram ${venue} ${date}: ${t.rows} trades / ${seen} bins`);
    }
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
