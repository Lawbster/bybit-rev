/** Research-only trade archive primitives; no trading, environment or collector imports. */
import assert from 'assert/strict';
import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';
import readline from 'readline';
import { Transform } from 'stream';

export const DAY = 86400000, SCALE = 100000000n;
export const sha = (v: string | Buffer) => crypto.createHash('sha256').update(v).digest('hex');
export type Venue = 'bybit' | 'binance';
export interface Archive { venue: Venue; date: string; url: string; bytes: number | null; checksumUrl: string | null }
export interface Trade { id: string; ts: number; subMs: string; price: bigint; qty: bigint; quote: bigint; side: 'Buy' | 'Sell'; firstId?: bigint; lastId?: bigint }

export function decimal(v: string, places = 8): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(v.trim());
  assert(m, `Invalid nonnegative decimal: ${v}`);
  const frac = m[2] ?? ''; assert(frac.slice(places).split('').every(c => c === '0'), `Precision exceeds ${places}: ${v}`);
  return BigInt(m[1]) * 10n ** BigInt(places) + BigInt((frac.slice(0, places)).padEnd(places, '0') || '0');
}
export function format(v: bigint, places = 8): string {
  const sign = v < 0n ? '-' : ''; if (v < 0n) v = -v;
  const base = 10n ** BigInt(places), frac = (v % base).toString().padStart(places, '0').replace(/0+$/, '');
  return sign + (v / base).toString() + (frac ? '.' + frac : '');
}
export function csv(line: string): string[] {
  const out: string[] = []; let s = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (quoted && line[i + 1] === '"') { s += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { out.push(s); s = ''; } else s += c;
  }
  assert(!quoted, 'Unterminated CSV field'); out.push(s); return out;
}
export function normalize(venue: Venue, header: string[], row: string[], symbol: string): Trade {
  assert.equal(row.length, header.length, 'CSV width');
  const r = Object.fromEntries(header.map((k, i) => [k, row[i]]));
  let id: string, ts: number, subMs = '0', p: string, q: string, side: Trade['side'], firstId: bigint | undefined, lastId: bigint | undefined;
  if (venue === 'bybit') {
    assert.equal(r.symbol, symbol); id = r.trdMatchID; assert(id, 'Missing match ID');
    const ticks = decimal(r.timestamp, 9); ts = Number(ticks / 1000000n); subMs = (ticks % 1000000n).toString();
    p = r.price; q = r.size; assert(r.side === 'Buy' || r.side === 'Sell'); side = r.side;
    if (r.homeNotional !== undefined) assert.equal(decimal(r.homeNotional), decimal(q), 'Bybit base-unit mismatch');
  } else {
    id = r.agg_trade_id; assert(/^\d+$/.test(id ?? ''), 'Missing aggregate ID');
    assert(/^\d+$/.test(r.transact_time)); ts = Number(r.transact_time);
    p = r.price; q = r.quantity;
    assert(['true', 'false'].includes(r.is_buyer_maker)); side = r.is_buyer_maker === 'true' ? 'Sell' : 'Buy';
    firstId = BigInt(r.first_trade_id); lastId = BigInt(r.last_trade_id); assert(firstId >= 0n && lastId >= firstId);
  }
  assert(Number.isSafeInteger(ts) && ts >= Date.UTC(2020, 0, 1) && ts < Date.UTC(2100, 0, 1), 'Timestamp unit/range');
  const price = decimal(p), qty = decimal(q); assert(price > 0n && qty > 0n, 'Nonpositive trade');
  return { id, ts, subMs, price, qty, quote: price * qty, side, firstId, lastId };
}
const xmlText = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
export function parseBinanceListing(body: string, symbol: string): { rows: Archive[]; truncated: boolean; next: string | null } {
  assert(body.includes('<ListBucketResult'), 'Not an S3 listing');
  const rows: Archive[] = [];
  for (const m of body.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const key = xmlText(/<Key>(.*?)<\/Key>/.exec(m[1])![1]);
    const date = new RegExp(`/${symbol}-aggTrades-(\\d{4}-\\d{2}-\\d{2})\\.zip$`).exec(key)?.[1];
    if (!date) continue;
    const bytes = Number(/<Size>(\d+)<\/Size>/.exec(m[1])![1]); assert(bytes > 0);
    const url = 'https://data.binance.vision/' + key;
    rows.push({ venue: 'binance', date, url, bytes, checksumUrl: url + '.CHECKSUM' });
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(body);
  const next = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(body)?.[1];
  assert(!truncated || next, 'Missing pagination token');
  return { rows, truncated, next: next ? xmlText(next) : null };
}
export function parseBybitListing(body: string, symbol: string): Archive[] {
  assert(body.includes('Directory listing'), 'Not a Bybit directory listing');
  const rows: Archive[] = [];
  for (const m of body.matchAll(/href="([^"]+)"/g)) {
    const date = new RegExp(`^${symbol}(\\d{4}-\\d{2}-\\d{2})\\.csv\\.gz$`).exec(m[1])?.[1];
    if (date) rows.push({ venue: 'bybit', date, url: `https://public.bybit.com/trading/${symbol}/${m[1]}`, bytes: null, checksumUrl: null });
  }
  assert.equal(new Set(rows.map(r => r.date)).size, rows.length, 'Duplicate archive day'); return rows;
}
export function coverage(rows: Archive[], start: number, end: number) {
  const dates = new Set(rows.map(r => r.date)), expected: string[] = [];
  for (let t = Math.floor(start / DAY) * DAY; t < end; t += DAY) expected.push(new Date(t).toISOString().slice(0, 10));
  const present = expected.filter(d => dates.has(d)), absent = expected.filter(d => !dates.has(d));
  const sizes = rows.filter(r => present.includes(r.date)).map(r => r.bytes);
  return { expectedDays: expected.length, listedDays: present.length, firstListed: present[0] ?? null, lastListed: present.at(-1) ?? null,
    absentDates: absent, listedBytes: sizes.every(x => x !== null) ? sizes.reduce<number>((s, n) => s + n!, 0) : null,
    contentCompletenessVerified: false };
}

export interface Minute { ts: number; qty: bigint; quote: bigint; high: bigint; low: bigint; records: number }
export class SampleAccumulator {
  readonly minutes = new Map<number, Minute>();
  readonly bins = new Map<string, { ts: number; price: bigint; qty: bigint; buyQty: bigint; quote: bigint; records: number; firstTs: number; lastTs: number }>();
  private ids = new Map<string, string>();
  rows = 0; duplicates = 0; outOfOrder = 0; aggregateIdGaps = 0; underlyingIdGaps = 0;
  private prevId: bigint | undefined; private prevLast: bigint | undefined; private previousTime = -1n;
  firstTs = Infinity; lastTs = -Infinity; qty = 0n; quote = 0n; buyQty = 0n;
  constructor(readonly start: number) {}
  add(t: Trade) {
    this.rows++;
    assert(t.ts >= this.start && t.ts < this.start + DAY, 'Trade outside archive day');
    const signature = [t.ts, t.subMs, t.price, t.qty, t.side, t.firstId, t.lastId].join('|');
    const existing = this.ids.get(t.id);
    if (existing !== undefined) { assert.equal(existing, signature, 'Conflicting duplicate trade ID'); this.duplicates++; return; }
    this.ids.set(t.id, signature);
    const preciseTs = BigInt(t.ts) * 1000000n + BigInt(t.subMs);
    if (preciseTs < this.previousTime) this.outOfOrder++; this.previousTime = preciseTs;
    if (t.firstId !== undefined) {
      const id = BigInt(t.id); if (this.prevId !== undefined && id !== this.prevId + 1n) this.aggregateIdGaps++;
      if (this.prevLast !== undefined && t.firstId !== this.prevLast + 1n) this.underlyingIdGaps++;
      this.prevId = id; this.prevLast = t.lastId;
    }
    this.firstTs = Math.min(this.firstTs, t.ts); this.lastTs = Math.max(this.lastTs, t.ts);
    this.qty += t.qty; this.quote += t.quote; if (t.side === 'Buy') this.buyQty += t.qty;
    const ts = Math.floor(t.ts / 60000) * 60000;
    let m = this.minutes.get(ts);
    if (!m) { m = { ts, qty: 0n, quote: 0n, high: t.price, low: t.price, records: 0 }; this.minutes.set(ts, m); }
    m.qty += t.qty; m.quote += t.quote; m.records++; m.high = t.price > m.high ? t.price : m.high; m.low = t.price < m.low ? t.price : m.low;
    const key = ts + ':' + t.price;
    let b = this.bins.get(key);
    if (!b) { b = { ts, price: t.price, qty: 0n, buyQty: 0n, quote: 0n, records: 0, firstTs: t.ts, lastTs: t.ts }; this.bins.set(key, b); }
    b.qty += t.qty; b.quote += t.quote; b.records++; if (t.side === 'Buy') b.buyQty += t.qty;
    b.firstTs = Math.min(b.firstTs, t.ts); b.lastTs = Math.max(b.lastTs, t.ts);
  }
  summary() {
    assert(this.rows > 0); assert.equal([...this.bins.values()].reduce((a, b) => a + b.qty, 0n), this.qty);
    assert.equal([...this.bins.values()].reduce((a, b) => a + b.quote, 0n), this.quote);
    return { rows: this.rows, uniqueRows: this.ids.size, duplicates: this.duplicates, conflictingDuplicates: 0,
      outOfOrder: this.outOfOrder, aggregateIdGapTransitions: this.aggregateIdGaps, underlyingIdGapTransitions: this.underlyingIdGaps,
      firstTradeAt: this.firstTs, lastTradeAt: this.lastTs, minutesWithTrades: this.minutes.size,
      baseQty: format(this.qty), quoteNotional: format(this.quote, 16), buyQty: format(this.buyQty), sellQty: format(this.qty - this.buyQty),
      histogramRows: this.bins.size, exactHistogramConservation: true };
  }
}

/** Read only a single CSV entry; no extraction paths, ZIP64, encryption or multi-file archives. */
export function zipEntry(file: string) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size, tail = Buffer.alloc(Math.min(size, 65557));
    fs.readSync(fd, tail, 0, tail.length, size - tail.length);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === tail.length) { eocd = i; break; }
    assert(eocd >= 0, 'ZIP EOCD missing'); assert.equal(tail.readUInt16LE(eocd + 4), 0); assert.equal(tail.readUInt16LE(eocd + 6), 0);
    assert.equal(tail.readUInt16LE(eocd + 8), 1); assert.equal(tail.readUInt16LE(eocd + 10), 1, 'Single-entry archive required');
    const cdAt = tail.readUInt32LE(eocd + 16), c = Buffer.alloc(46); fs.readSync(fd, c, 0, c.length, cdAt);
    assert.equal(c.readUInt32LE(0), 0x02014b50); assert.equal(c.readUInt16LE(8) & 1, 0, 'Encrypted ZIP');
    const method = c.readUInt16LE(10), compressed = c.readUInt32LE(20), expanded = c.readUInt32LE(24), localAt = c.readUInt32LE(42);
    assert([0, 8].includes(method)); assert(compressed < 0xffffffff && expanded < 0xffffffff);
    const name = Buffer.alloc(c.readUInt16LE(28)); fs.readSync(fd, name, 0, name.length, cdAt + 46);
    assert(/^[A-Za-z0-9_.-]+\.csv$/.test(name.toString()), 'Unexpected ZIP filename');
    const l = Buffer.alloc(30); fs.readSync(fd, l, 0, l.length, localAt); assert.equal(l.readUInt32LE(0), 0x04034b50);
    assert.equal(l.readUInt16LE(8), method); assert.equal(l.readUInt16LE(6) & 1, 0);
    const start = localAt + 30 + l.readUInt16LE(26) + l.readUInt16LE(28);
    assert(compressed > 0 && start + compressed <= cdAt && cdAt < size);
    return { start, end: start + compressed - 1, expanded, method, crc: c.readUInt32LE(16), name: name.toString() };
  } finally { fs.closeSync(fd); }
}
export async function readArchive(file: string, maxExpandedBytes: number, onLine: (line: string) => void): Promise<number> {
  const entry = file.endsWith('.zip') ? zipEntry(file) : null;
  if (entry) assert(entry.expanded <= maxExpandedBytes, 'Expanded size limit');
  const raw = fs.createReadStream(file, entry ? { start: entry.start, end: entry.end } : {});
  const decode = file.endsWith('.gz') ? zlib.createGunzip() : entry?.method === 8 ? zlib.createInflateRaw() : new Transform({ transform(c, _e, cb) { cb(null, c); } });
  let bytes = 0, crc = 0;
  const measured = new Transform({ transform(c: Buffer, _e, cb) {
    bytes += c.length; if (bytes > maxExpandedBytes) { cb(new Error('Expanded size limit')); return; }
    if (entry) crc = zlib.crc32(c, crc); cb(null, c);
  }});
  raw.on('error', e => decode.destroy(e)); decode.on('error', e => measured.destroy(e));
  raw.pipe(decode).pipe(measured);
  const lines = readline.createInterface({ input: measured, crlfDelay: Infinity });
  try { for await (const line of lines) { assert(line.length < 16384, 'Oversized CSV line'); if (line) onLine(line); } }
  finally { lines.close(); raw.destroy(); decode.destroy(); measured.destroy(); }
  if (entry) { assert.equal(bytes, entry.expanded, 'ZIP expanded length'); assert.equal(crc, entry.crc, 'ZIP CRC mismatch'); }
  return bytes;
}
