/** Read-only local bootstrap/journal loader. No REST clients and no file writes. */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { createGunzip } from 'zlib';
import { createInterface } from 'readline';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { PortfolioCandleFeed, collectorMinute, FEED_VERSION, FEED_LIMITS } from './candle-feed';
import { PortfolioSourceCache } from './source-cache';
import { STRUCTURAL_SEED } from './structural-signals';
import { MINUTE as M, epoch } from './contract';

export interface FeedPaths { bootstrap: string; sha256: string; dataDir: string; }
const JOURNAL_CHUNK = 256 * 1024, JOURNAL_PASS = 8 * 1024 * 1024, MAX_JOURNAL_LINE = 8192;
interface JournalCursor {
  dev: number; ino: number; size: number; mtimeMs: number; offset: number; retryAt?: number;
}
export async function loadPortfolioBootstrap(file: string, sha256: string, now: () => number): Promise<PortfolioCandleFeed> {
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('bootstrap SHA256 must be pinned');
  const stat = await fs.promises.stat(file);
  if (stat.size > 256 * 1024 * 1024) throw new Error('bootstrap compressed size exceeded');
  const feed = new PortfolioCandleFeed(), hash = createHash('sha256');
  const bytes = fs.createReadStream(file), digest = new Transform({ transform(chunk, _encoding, done) { hash.update(chunk); done(null, chunk); } });
  const decoded = createGunzip(), lines = createInterface({ input: decoded, crlfDelay: Infinity });
  // Attach the rejection handler before consuming readline so stream failures do
  // not become unhandled rejections and truncation cannot masquerade as EOF.
  let streamError: unknown;
  const pumping = pipeline(bytes, digest, decoded).catch(e => { streamError = e; lines.close(); });
  let header: any = null, rows = 0;
  try {
    for await (const line of lines) {
      if (line.length > 8192 || !line.trim()) throw new Error('invalid bootstrap record');
      const row = JSON.parse(line);
      if (!header) {
        header = row;
        if (header.version !== FEED_VERSION || header.symbol !== 'HYPEUSDT' || header.venue !== 'bybit'
          || header.seed !== STRUCTURAL_SEED || header.provenance !== 'historical_warmup_only'
          || !Number.isSafeInteger(header.minutes) || header.minutes < 1 || header.minutes > FEED_LIMITS.minutes
          || header.through !== STRUCTURAL_SEED + header.minutes * M) throw new Error('invalid bootstrap header');
      } else { feed.seed(row); rows++; if (rows > header.minutes) throw new Error('bootstrap row count exceeded'); }
    }
    await pumping;
    if (streamError) throw streamError;
    if (!header || rows !== header.minutes || hash.digest('hex') !== sha256) throw new Error('bootstrap hash/count mismatch');
    feed.ready(now()); return feed;
  } finally { lines.close(); bytes.destroy(); digest.destroy(); decoded.destroy(); await pumping; }
}

export class PortfolioFeedReader {
  private readonly journals = new Map<string, JournalCursor>();
  private readonly since: number;
  private pending: Promise<void> | null = null;
  private nextReadAt = 0;
  private error: string | null = null;
  private skippedRows = 0;
  private reads = 0;
  private bytesRead = 0;
  readonly cache: PortfolioSourceCache;
  constructor(readonly feed: PortfolioCandleFeed, private readonly dataDir: string, private readonly clock = Date.now) {
    this.cache = new PortfolioSourceCache(feed);
    // Fixed bootstrap overlap, not a rolling tail that can forget the bridge.
    this.since = Math.max(STRUCTURAL_SEED, feed.nextTs - 60 * M);
  }
  private async readJournal(file: string): Promise<void> {
    let stat: fs.Stats;
    try { stat = await fs.promises.stat(file); }
    catch (e: any) { if (e.code === 'ENOENT') { this.journals.delete(file); return; } throw e; }
    const previous = this.journals.get(file);
    const unchanged = previous && previous.dev === stat.dev && previous.ino === stat.ino
      && previous.size === stat.size && previous.mtimeMs === stat.mtimeMs;
    if (unchanged && (previous.offset === stat.size || (previous.retryAt !== undefined && this.clock() < previous.retryAt))) return;
    const handle = await fs.promises.open(file, 'r');
    try {
      stat = await handle.stat(); // Pin identity/size to the opened descriptor, not a rotating path.
      const append = previous && previous.dev === stat.dev && previous.ino === stat.ino
        && stat.size >= previous.size && (stat.size > previous.size || stat.mtimeMs === previous.mtimeMs);
      const cursor: JournalCursor = { dev: stat.dev, ino: stat.ino, size: stat.size, mtimeMs: stat.mtimeMs,
        offset: append ? previous.offset : 0 };
      this.journals.set(file, cursor);
      if (cursor.offset === stat.size) return;
      this.reads++;
      // Scan history once in bounded passes. Subsequent refreshes start at the
      // last completed record. No full-file buffers or venue backfill requests.
      const end = Math.min(stat.size, cursor.offset + JOURNAL_PASS), buffer = Buffer.alloc(JOURNAL_CHUNK);
      let position = cursor.offset, remainder: Buffer = Buffer.alloc(0);
      while (position < end) {
        const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, end - position), position);
        if (!bytesRead) throw new Error('candle journal truncated during read');
        this.bytesRead += bytesRead;
        const base = position - remainder.length;
        const input = Buffer.concat([remainder, buffer.subarray(0, bytesRead)]);
        position += bytesRead;
        let start = 0, newline: number;
        while ((newline = input.indexOf(10, start)) !== -1) {
          if (newline - start > MAX_JOURNAL_LINE) throw new Error('candle journal record too large');
          const line = input.subarray(start, newline).toString('utf8').trim();
          let row: any;
          if (line) {
            try { row = JSON.parse(line); } catch { this.skippedRows++; }
            const ts = row?.ts ?? row?.timestamp;
            if (row && Number.isSafeInteger(ts) && ts >= this.since) {
              const observedAt = this.clock();
              // A valid future-dated publication is not evidence yet. Leave its
              // cursor unconsumed so it can be retried even without another append.
              if (Number.isSafeInteger(row.availableAt) && row.availableAt > observedAt
                && collectorMinute(row, row.availableAt)) { cursor.retryAt = row.availableAt; return; }
              const value = collectorMinute(row, observedAt);
              if (!value) this.skippedRows++;
              else this.feed.ingest(value.candle, value.receiptAt, observedAt);
            }
          }
          start = newline + 1;
          cursor.offset = base + start;
        }
        remainder = input.subarray(start);
        if (remainder.length > MAX_JOURNAL_LINE) throw new Error('candle journal record too large');
      }
      // Unterminated bytes never advance the cursor. Retry only when the file
      // changes; a pass budget boundary, unlike EOF, must continue next refresh.
      if (position === stat.size && remainder.length) cursor.retryAt = Infinity;
    } finally { await handle.close(); }
  }
  /** Single-flight incremental reads. Unchanged files are only stat'ed. A repair
   * published later retains its later availability; a missing older prefix is
   * surfaced as a gap, not fixed through a hidden historical REST request. */
  refresh(): Promise<void> {
    if (this.pending) return this.pending;
    const now = this.clock(); epoch(now);
    if (now < this.nextReadAt) return Promise.resolve();
    const work = async () => {
      try {
        for (const file of [path.join(this.dataDir, 'HYPEUSDT_1m.jsonl'), path.join(this.dataDir, 'candle-repairs', 'HYPEUSDT_1m.jsonl')]) {
          await this.readJournal(file);
        }
        this.error = null;
      } catch (e) { this.error = e instanceof Error ? e.message : String(e); this.nextReadAt = this.clock() + 5000; }
    };
    this.pending = work().finally(() => { this.pending = null; }); return this.pending;
  }
  snapshot() {
    const now = this.clock(), value = this.cache.read(now);
    if (this.error) {
      value.poll.sources = value.poll.sources.map(p => ({ source: p.source, status: 'inputs_unavailable' })); value.price = null;
    }
    return { ...value, loader: { error: this.error, reads: this.reads, bytesRead: this.bytesRead,
      unreadBytes: [...this.journals.values()].reduce((n, c) => n + c.size - c.offset, 0),
      skippedRows: this.skippedRows, pending: !!this.pending } };
  }
}
