/** Append-only, bounded-memory source cache. No exchange client or orders.
 * Historical bootstrap is explicitly modelled warmup, NEVER historical live
 * availability. Source decisions before bootstrap readiness cannot be used.
 * Subsequent receipts/repaired bars are never backdated to their close.
 */
import type { Candle } from '../../fetch-candles';
import type { Minute } from '../../strategies/setup-context';
import type { TimedClosedBar } from '../../research/closed-bars';
import { availableCandleRepairs } from '../../collector-candle-repair';
import { MINUTE as M, epoch, positive } from './contract';
import { STRUCTURAL_SEED, type StructuralMinute } from './structural-signals';
import { INDICATOR_SEED } from './timed-indicator-signals';
import { RSI } from 'technicalindicators';
import { computeCrsi } from '../../technical-engine';

export const FEED_VERSION = 'HS01-minute-cache-v1';
export const FEED_LIMITS = Object.freeze({ minutes: 2_000_000, pending: 2880, chunk: 8192 });
const TF = [15 * M, 30 * M, 60 * M, 240 * M] as const;
const KEYS = ['open', 'high', 'low', 'close', 'volume', 'turnover'] as const;
const STRIDE = 9; // OHLCVT, worker observation, cumulative observation, source publication.
function checked(c: Candle): void {
  epoch(c.timestamp);
  if (c.timestamp % M) throw new Error('unaligned minute');
  for (const k of ['open', 'high', 'low', 'close'] as const) positive(c[k], k);
  if (c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close)
    || ![c.volume, c.turnover].every(x => Number.isFinite(x) && x >= 0)) throw new Error('invalid OHLCV');
}
interface Pending { candle: Candle; availableAt: number; publishedAt: number; }
interface Bucket { start: number; count: number; candle: Candle; availableAt: number; }

/** A bootstrap file contains prices only, not invented receipt evidence. It is
 * hash-pinned by its loader; each source carries a bootstrap-ready boundary.
 * Full constituent minutes are kept in compact numerical chunks (~72 MB/million),
 * not duplicated object/JSON tails. Aggregate only the newly appended minute.
 */
export class PortfolioCandleFeed {
  private readonly chunks: Float64Array[] = [];
  private readonly pending = new Map<number, Pending>();
  private readonly completed = new Map<number, TimedClosedBar[]>();
  private readonly forming = new Map<number, Bucket>();
  private count = 0;
  private prefixKnownAt = 0;
  private bootstrapEnd: number | null = null;
  private bootAt: number | null = null;
  private observedAt = 0;
  private fault: string | null = null;
  constructor() { for (const tf of TF) this.completed.set(tf, []); }
  get nextTs(): number { return STRUCTURAL_SEED + this.count * M; }
  get bootstrapAt(): number | null { return this.bootAt; }
  get lastObservedAt(): number { return this.observedAt; }
  get error(): string | null { return this.fault; }
  get length(): number { return this.count; }

  /** Stream the sealed seed once. Missing, duplicate, reordered or future minutes
   * reject the bootstrap; no automatic reseeding or rolling-window substitute. */
  seed(c: Candle): void {
    if (this.bootAt !== null || this.fault) throw new Error('bootstrap closed or faulted');
    try { checked(c); if (c.timestamp !== this.nextTs) throw new Error('non-contiguous fixed seed'); this.append(c, c.timestamp + M); }
    catch (e) { this.fail(e); throw e; }
  }
  ready(now: number): void {
    epoch(now);
    if (this.bootAt !== null || this.fault || !this.count || this.nextTs > now) throw new Error('invalid bootstrap readiness');
    this.bootAt = now; this.bootstrapEnd = this.nextTs; this.observedAt = now;
  }
  private fail(e: unknown): void { this.fault = e instanceof Error ? e.message : String(e); }

  /** `observedAt` is this consumer's receipt, not the collector's earlier write.
   * Replay/bootstrap provenance is separate. Duplicate delivery is idempotent;
   * conflicting finalized OHLCV poisons the cache instead of revising history. */
  ingest(c: Candle, receiptAt: number, observedAt: number): void {
    if (this.bootAt === null || this.fault) throw new Error('feed not ready');
    try {
      epoch(receiptAt); epoch(observedAt);
      if (observedAt < this.observedAt) throw new Error('consumer clock reversed');
      // Future input is not currently evidence, including a poisoned future payload.
      if (receiptAt > observedAt) return;
      checked(c);
      if (receiptAt < c.timestamp + M || c.timestamp < STRUCTURAL_SEED) throw new Error('invalid final receipt');
      this.observedAt = observedAt;
      if (c.timestamp < this.nextTs) {
        const old = this.minute((c.timestamp - STRUCTURAL_SEED) / M);
        if (KEYS.some(k => old[k] !== c[k])) throw new Error('conflicting finalized candle');
        return;
      }
      const old = this.pending.get(c.timestamp);
      if (old && KEYS.some(k => old.candle[k] !== c[k])) throw new Error('conflicting pending candle');
      if (!old) {
        if (this.pending.size >= FEED_LIMITS.pending) throw new Error('gap buffer capacity exceeded; rehydrate required');
        this.pending.set(c.timestamp, { candle: { ...c }, availableAt: observedAt, publishedAt: receiptAt });
      }
      while (this.pending.has(this.nextTs)) {
        const p = this.pending.get(this.nextTs)!; this.pending.delete(this.nextTs); this.append(p.candle, p.availableAt, p.publishedAt);
      }
    } catch (e) { this.fail(e); throw e; }
  }
  private append(c: Candle, availableAt: number, publishedAt = availableAt): void {
    if (this.count >= FEED_LIMITS.minutes) throw new Error('fixed-prefix capacity exceeded; no rolling reseed');
    const index = this.count, chunk = Math.floor(index / FEED_LIMITS.chunk), pos = (index % FEED_LIMITS.chunk) * STRIDE;
    this.chunks[chunk] ??= new Float64Array(FEED_LIMITS.chunk * STRIDE);
    this.prefixKnownAt = Math.max(this.prefixKnownAt, availableAt);
    this.chunks[chunk].set([...KEYS.map(k => c[k]), availableAt, this.prefixKnownAt, publishedAt], pos);
    this.count++;
    for (const tf of TF) {
      const start = Math.floor(c.timestamp / tf) * tf;
      let b = this.forming.get(tf);
      if (!b || b.start !== start) {
        b = { start, count: 0, candle: { ...c, timestamp: start }, availableAt: 0 }; this.forming.set(tf, b);
      } else {
        b.candle.high = Math.max(b.candle.high, c.high); b.candle.low = Math.min(b.candle.low, c.low);
        b.candle.close = c.close; b.candle.volume += c.volume; b.candle.turnover += c.turnover;
      }
      b.count++; b.availableAt = Math.max(b.availableAt, availableAt);
      if (c.timestamp + M === start + tf) {
        if (b.count === tf / M) this.completed.get(tf)!.push(Object.freeze({
          candle: Object.freeze({ ...b.candle }), barEnd: start + tf, availableAt: b.availableAt }));
        this.forming.delete(tf);
      }
    }
  }
  minute(index: number): Minute {
    if (!Number.isInteger(index) || index < 0 || index >= this.count) throw new Error('minute index unavailable');
    const x = this.chunks[Math.floor(index / FEED_LIMITS.chunk)], j = (index % FEED_LIMITS.chunk) * STRIDE;
    const ts = STRUCTURAL_SEED + index * M;
    return { ts, endTs: ts + M, open: x[j], high: x[j + 1], low: x[j + 2], close: x[j + 3],
      volume: x[j + 4], turnover: x[j + 5], availableAt: x[j + 6] };
  }
  /** Structural formation uses original publication; execution still waits for
   * worker observation and bootstrap readiness. Seed publication is modelled
   * warmup, not historical live evidence. Other feed consumers are unchanged. */
  structuralMinutes(): StructuralMinute[] {
    return Array.from({ length: this.count }, (_, i) => {
      const c = this.minute(i), x = this.chunks[Math.floor(i / FEED_LIMITS.chunk)];
      return { ...c, availableAt: Math.max(this.bootAt ?? c.availableAt, c.availableAt),
        publishedAt: x[(i % FEED_LIMITS.chunk) * STRIDE + 8] };
    });
  }
  series(tf: number) {
    const bars = this.completed.get(tf); if (!bars) throw new Error('unsupported portfolio timeframe');
    const start = Math.ceil(STRUCTURAL_SEED / tf) * tf;
    const index = (INDICATOR_SEED - start) / tf;
    if (!Number.isInteger(index) || index < 0) throw new Error('indicator seed unaligned');
    return { sourceIntervalMs: M, targetIntervalMs: tf,
      availability: { mode: 'bootstrap_with_observed_tail' as const, bootstrapAt: this.bootAt }, bars: bars.slice(index) };
  }
  generation(tf: number): number { return this.completed.get(tf)?.length ?? 0; }
  /** Canonical MAIN convention: current HTF bucket from completed, received
   * minutes only. This is separate from auxiliary CLOSED-HTF signals. */
  mainContext(at: number): { at: number; value: { rsi1H: number | null; crsi4H: number | null } } | null {
    const mark = this.decisionPrice(at);
    if (!mark || mark.markedThrough !== this.nextTs) return null;
    const closes = (tf: number, count: number) => {
      const active = this.forming.get(tf);
      const done = this.completed.get(tf)!;
      return done.slice(-(count - (active ? 1 : 0))).map(b => b.candle.close).concat(active ? [active.candle.close] : []);
    };
    const h1 = closes(60 * M, 200), h4 = closes(240 * M, 400);
    const values = h1.length >= 16 ? RSI.calculate({ period: 14, values: h1 }) : [];
    return { at: mark.priceKnownAt, value: { rsi1H: values.at(-1) ?? null, crsi4H: h4.length >= 102 ? computeCrsi(h4) : null } };
  }
  health(now: number) {
    epoch(now); const expectedEnd = Math.floor(now / M) * M;
    return { version: FEED_VERSION, bootstrapAt: this.bootAt, bootstrapEnd: this.bootstrapEnd,
      bootstrapProvenance: 'modelled historical warmup; no historical live decisions',
      observedAt: this.observedAt, minutes: this.count, through: this.nextTs,
      gapAt: this.nextTs < expectedEnd ? this.nextTs : null, pending: this.pending.size,
      error: this.fault, compactBytes: this.chunks.length * FEED_LIMITS.chunk * STRIDE * 8,
      structuralClock: 'source_publication_with_worker_observation_gate',
      aggregateBars: [...this.completed.values()].reduce((n, a) => n + a.length, 0) };
  }
  /** Caller still needs a separately timestamped account-equity/funding snapshot. */
  decisionPrice(at: number): { price: number; priceKnownAt: number; markedThrough: number } | null {
    epoch(at); const end = Math.floor(at / M) * M;
    if (this.bootAt === null || at < this.bootAt || this.fault || end > this.nextTs || end <= STRUCTURAL_SEED) return null;
    const i = (end - M - STRUCTURAL_SEED) / M, c = this.minute(i);
    const x = this.chunks[Math.floor(i / FEED_LIMITS.chunk)], prefix = x[(i % FEED_LIMITS.chunk) * STRIDE + 7];
    const known = Math.max(this.bootAt, prefix);
    return known <= at ? { price: c.close, priceKnownAt: known, markedThrough: end } : null;
  }
}

export type CollectorMinute = { candle: Candle; receiptAt: number };
/** Only the dedicated HYPEUSDT Bybit 1m journal and its validated repair journal
 * are accepted. Paths/venue are pinned by the loader, never inferred from price. */
export function collectorMinute(row: any, now: number): CollectorMinute | null {
  epoch(now);
  if (!row || typeof row !== 'object') return null;
  if (row.source === 'rest_gap_repair') {
    const accepted = availableCandleRepairs([row], 'HYPEUSDT', '1', now);
    return accepted.length ? { candle: accepted[0], receiptAt: accepted[0].availableAt } : null;
  }
  if (row.source !== 'websocket_confirmed' || row.confirmed === false || row.final === false
    || (row.symbol !== undefined && row.symbol !== 'HYPEUSDT') || (row.venue !== undefined && row.venue !== 'bybit')
    || (row.interval !== undefined && row.interval !== '1')) return null;
  const clocks = [row.receivedAt, row.writtenAt, row.availableAt];
  if (!clocks.every(Number.isSafeInteger) || clocks[0] > clocks[1] || clocks[1] > clocks[2] || clocks[2] > now) return null;
  const candle = { timestamp: row.ts, open: row.o, high: row.h, low: row.l, close: row.c, volume: row.v, turnover: row.t };
  try { checked(candle); } catch { return null; }
  if (row.endAt !== candle.timestamp + M || clocks[0] < row.endAt) return null;
  return { candle, receiptAt: clocks[2] };
}
