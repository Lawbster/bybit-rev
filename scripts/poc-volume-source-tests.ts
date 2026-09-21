import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { decimal, format, csv, normalize, parseBinanceListing, parseBybitListing, coverage, SampleAccumulator, readArchive, DAY } from './poc-volume-source';
import { compareCandles } from './poc-volume-audit';

async function main() {
  let checks = 0; const test = (fn: () => void) => { fn(); checks++; };
  test(() => { assert.equal(decimal('12.300000000'), 1230000000n); assert.equal(format(decimal('12.3')), '12.3'); assert.equal(format(-123n), '-0.00000123'); });
  test(() => { for (const bad of ['-1', 'NaN', '1e3', '1.000000001', '']) assert.throws(() => decimal(bad)); });
  test(() => { assert.deepEqual(csv('1,"ab,c","a""b",'), ['1', 'ab,c', 'a"b', '']); assert.throws(() => csv('"bad')); });
  const bh = ['timestamp', 'symbol', 'side', 'size', 'price', 'trdMatchID', 'homeNotional'];
  const start = Date.UTC(2026, 0, 1);
  const bt = normalize('bybit', bh, [String(start / 1000) + '.123456', 'HYPEUSDT', 'Buy', '2.5', '70.001', 'x', '2.5'], 'HYPEUSDT');
  test(() => { assert.equal(bt.ts, start + 123); assert.equal(bt.subMs, '456000'); assert.equal(format(bt.quote, 16), '175.0025'); });
  const nh = ['agg_trade_id', 'price', 'quantity', 'first_trade_id', 'last_trade_id', 'transact_time', 'is_buyer_maker'];
  const nt = normalize('binance', nh, ['1', '70.001', '2.5', '3', '5', String(start), 'true'], 'HYPEUSDT');
  test(() => { assert.equal(nt.side, 'Sell'); assert.equal(nt.qty, bt.qty); assert.equal(nt.quote, bt.quote); });
  test(() => { assert.throws(() => normalize('binance', nh, ['1', '70', '1', '3', '5', String(start * 1000), 'true'], 'HYPEUSDT')); });
  test(() => { assert.throws(() => normalize('bybit', bh, ['1', 'BTCUSDT', 'Buy', '2', '70', 'x', '2'], 'HYPEUSDT')); });
  test(() => {
    const a = new SampleAccumulator(start); a.add(bt); a.add(bt); assert.equal(a.summary().duplicates, 1); assert.equal(a.summary().baseQty, '2.5');
    assert.throws(() => a.add({ ...bt, qty: bt.qty + 1n })); assert.throws(() => a.add({ ...bt, id: 'end', ts: start + DAY }));
  });
  test(() => {
    const a = new SampleAccumulator(start); a.add(nt); a.add({ ...nt, id: '3', firstId: 7n, lastId: 8n, ts: start + 60000 });
    assert.equal(a.summary().aggregateIdGapTransitions, 1); assert.equal(a.summary().underlyingIdGapTransitions, 1); assert.equal(a.bins.size, 2);
  });
  test(() => {
    const a = new SampleAccumulator(start); a.add(bt);
    const c = new Map([[start, { volume: '2.5', turnover: '175.0025', source: 'fixture' }], [start + 60000, { volume: '1', turnover: '70', source: 'fixture' }]]);
    const r = compareCandles(a, c); assert.equal(r.exactBaseMinutes, 1); assert.equal(r.missingCandles, 1438); assert.equal(r.candlesWithoutTrades, 1); assert.equal(r.mismatches.length, 1);
  });
  test(() => {
    const a = new SampleAccumulator(start); a.add(bt);
    const long = compareCandles(a, new Map([[start, { volume: '2.5', turnover: '175.0025', source: 'same' }]]));
    const short = compareCandles(a, new Map([[start, { v: '2.5', t: '175.0025', source: 'same' }]]));
    assert.deepEqual(short, long);
    assert.throws(() => compareCandles(a, new Map([[start, { v: '2.5' }]])));
  });
  test(() => {
    const rows = parseBybitListing('Directory listing <a href="HYPEUSDT2026-01-01.csv.gz">file</a><a href="../bad">bad</a>', 'HYPEUSDT');
    assert.equal(rows.length, 1); const c = coverage(rows, start, start + DAY * 3); assert.equal(c.expectedDays, 3); assert.equal(c.absentDates.length, 2); assert.equal(c.listedBytes, null);
  });
  test(() => {
    const body = '<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>a&amp;b</NextContinuationToken><Contents><Key>data/futures/um/daily/aggTrades/HYPEUSDT/HYPEUSDT-aggTrades-2026-01-01.zip</Key><Size>123</Size></Contents></ListBucketResult>';
    const r = parseBinanceListing(body, 'HYPEUSDT'); assert.equal(r.next, 'a&b'); assert.equal(r.rows[0].bytes, 123);
    assert.throws(() => parseBinanceListing('<ListBucketResult><IsTruncated>true</IsTruncated></ListBucketResult>', 'HYPEUSDT'));
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pva01-tests-'));
  const data = Buffer.from('x,y\n1,2\n'), gz = path.join(dir, 'sample.csv.gz'); fs.writeFileSync(gz, zlib.gzipSync(data));
  const lines: string[] = []; assert.equal(await readArchive(gz, 100, l => lines.push(l)), data.length); assert.deepEqual(lines, ['x,y', '1,2']); checks++;
  await assert.rejects(readArchive(gz, 3, () => {})); checks++;
  const payload = zlib.deflateRawSync(data), name = Buffer.from('sample.csv'), crc = zlib.crc32(data);
  const local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(payload.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + payload.length, 16);
  const zip = path.join(dir, 'sample.zip'); fs.writeFileSync(zip, Buffer.concat([local, name, payload, central, name, end]));
  const zl: string[] = []; assert.equal(await readArchive(zip, 100, l => zl.push(l)), data.length); assert.deepEqual(zl, lines); checks++;
  central.writeUInt32LE(0, 16); const bad = path.join(dir, 'bad.zip'); fs.writeFileSync(bad, Buffer.concat([local, name, payload, central, name, end]));
  await assert.rejects(readArchive(bad, 100, () => {}), /CRC/); checks++;
  // Test evidence remains in a uniquely allocated temp directory; no recursive deletion.
  console.log(`PVA01 source tests passed (${checks} checks; fixtures ${dir})`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
