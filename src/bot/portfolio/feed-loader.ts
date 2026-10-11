/** Read-only local bootstrap/journal loader. No REST clients and no file writes. */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { createGunzip } from 'zlib';
import { createInterface } from 'readline';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { readCandleTail } from '../../collector-candle-repair';
import { PortfolioCandleFeed, collectorMinute, FEED_VERSION, FEED_LIMITS } from './candle-feed';
import { PortfolioSourceCache } from './source-cache';
import { STRUCTURAL_SEED } from './structural-signals';
import { MINUTE as M, epoch } from './contract';

export interface FeedPaths { bootstrap: string; sha256: string; dataDir: string; }
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
  private readonly signatures = new Map<string, string>();
  private pending: Promise<void> | null = null;
  private nextReadAt = 0;
  private error: string | null = null;
  private skippedRows = 0;
  private reads = 0;
  readonly cache: PortfolioSourceCache;
  constructor(readonly feed: PortfolioCandleFeed, private readonly dataDir: string, private readonly clock = Date.now) {
    this.cache = new PortfolioSourceCache(feed);
  }
  /** Single-flight and bounded tails. Unchanged files are only stat'ed. A repair
   * published later retains its later availability; a missing older prefix is
   * surfaced as a gap, not fixed through a hidden historical REST request. */
  refresh(): Promise<void> {
    if (this.pending) return this.pending;
    const now = this.clock(); epoch(now);
    if (now < this.nextReadAt) return Promise.resolve();
    const work = async () => {
      try {
        for (const file of [path.join(this.dataDir, 'HYPEUSDT_1m.jsonl'), path.join(this.dataDir, 'candle-repairs', 'HYPEUSDT_1m.jsonl')]) {
          let stat: fs.Stats;
          try { stat = await fs.promises.stat(file); } catch (e: any) { if (e.code === 'ENOENT') continue; throw e; }
          const sig = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}`;
          if (this.signatures.get(file) === sig) continue;
          const rows = await readCandleTail(file, Math.max(STRUCTURAL_SEED, this.feed.nextTs - 60 * M), M, 1024 * 1024);
          const observedAt = this.clock(); this.reads++;
          for (const row of rows) {
            const value = collectorMinute(row, observedAt);
            if (!value) { this.skippedRows++; continue; }
            this.feed.ingest(value.candle, value.receiptAt, observedAt);
          }
          this.signatures.set(file, sig);
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
    return { ...value, loader: { error: this.error, reads: this.reads, skippedRows: this.skippedRows, pending: !!this.pending } };
  }
}
