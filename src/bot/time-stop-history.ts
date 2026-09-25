/**
 * Exact-minute close lookup for the weak-week time stop's seven-day reference.
 *
 * Non-blocking: callers request a minute and read the cache later. The fetch runs in the background with a single
 * request in flight and exponential backoff after failures (reset only by a success). One fetch caches the requested
 * minute and the following closed minutes (up to `prefetchMinutes`), so a reference that advances one minute per
 * decision costs about one request per hour. Only exact 1m candles (by start time) that have closed are accepted:
 * no interpolation, no substitute interval. Used only when the optional runtime rule is enabled.
 */
import type { Candle } from "../fetch-candles";

export const MINUTE_MS = 60_000;

export type CandleFetcher = (symbol: string, interval: string, limit: number, endMs?: number) => Promise<Candle[]>;

export interface ExactMinuteHistoryOptions {
  now?: () => number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  prefetchMinutes?: number;
  cacheSize?: number;
}

export interface ExactMinuteHistoryStatus {
  inFlight: boolean;
  wanted: number | null;
  failures: number;
  nextAttemptAt: number;
  lastError: string | null;
  lastSuccessAt: number | null;
  /** Earliest request time still unanswered since the last success (for eligible-but-unavailable alerts). */
  unansweredSince: number | null;
  cached: number;
}

export class ExactMinuteHistory {
  private readonly cache = new Map<number, number>();
  private wanted: number | null = null;
  private unansweredSince: number | null = null;
  private inFlight = false;
  private failures = 0;
  private nextAttemptAt = 0;
  private lastError: string | null = null;
  private lastSuccessAt: number | null = null;
  private readonly now: () => number;
  private readonly retryBaseMs: number;
  private readonly retryMaxMs: number;
  private readonly prefetchMinutes: number;
  private readonly cacheSize: number;

  constructor(private readonly fetcher: CandleFetcher, private readonly symbol: string, opts: ExactMinuteHistoryOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.retryBaseMs = opts.retryBaseMs ?? 5_000;
    this.retryMaxMs = opts.retryMaxMs ?? 120_000;
    this.prefetchMinutes = opts.prefetchMinutes ?? 60;
    this.cacheSize = opts.cacheSize ?? 240;
    if (!(this.prefetchMinutes >= 1 && this.prefetchMinutes <= 1000) || this.cacheSize < this.prefetchMinutes) throw new Error("invalid ExactMinuteHistory options");
  }

  /** Cached close of the 1m candle starting at `minuteStart`, or null. Never fetches. */
  get(minuteStart: number): number | null {
    return this.cache.get(minuteStart) ?? null;
  }

  /**
   * Ask for the candle starting at `minuteStart`. Returns immediately without throwing on I/O. A background fetch
   * starts only when the minute is not cached, it has closed, nothing is in flight, and any backoff has elapsed.
   * The returned promise settles with that fetch; the trading loop must not await it.
   */
  request(minuteStart: number): Promise<void> {
    if (!Number.isSafeInteger(minuteStart) || minuteStart % MINUTE_MS !== 0) throw new Error("minuteStart must be a whole minute");
    // The latest request is answered: nothing is outstanding any more.
    if (this.cache.has(minuteStart)) { this.wanted = null; this.unansweredSince = null; return Promise.resolve(); }
    const now = this.now();
    this.wanted = minuteStart;
    if (this.unansweredSince === null) this.unansweredSince = now;
    const lastClosedStart = Math.floor(now / MINUTE_MS) * MINUTE_MS - MINUTE_MS;
    if (this.inFlight || now < this.nextAttemptAt || minuteStart > lastClosedStart) return Promise.resolve();
    const lastStart = Math.min(minuteStart + (this.prefetchMinutes - 1) * MINUTE_MS, lastClosedStart);
    const limit = (lastStart - minuteStart) / MINUTE_MS + 1;
    this.inFlight = true;
    return Promise.resolve().then(() => this.fetcher(this.symbol, "1", limit, lastStart + MINUTE_MS - 1)).then(rows => {
      for (const c of rows) {
        if (c.timestamp % MINUTE_MS !== 0 || c.timestamp < minuteStart || c.timestamp > lastStart || !(c.close > 0) || !Number.isFinite(c.close)) continue;
        this.cache.delete(c.timestamp); this.cache.set(c.timestamp, c.close);
      }
      while (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value!);
      if (!this.cache.has(minuteStart)) throw new Error(`exact minute ${new Date(minuteStart).toISOString()} not returned`);
      this.failures = 0; this.nextAttemptAt = 0; this.lastError = null; this.lastSuccessAt = this.now();
      if (this.wanted !== null && this.cache.has(this.wanted)) { this.wanted = null; this.unansweredSince = null; }
    }).catch(err => {
      this.failures++;
      this.lastError = err instanceof Error ? err.message : String(err);
      this.nextAttemptAt = this.now() + Math.min(this.retryMaxMs, this.retryBaseMs * 2 ** (this.failures - 1));
    }).finally(() => { this.inFlight = false; });
  }

  status(): ExactMinuteHistoryStatus {
    return { inFlight: this.inFlight, wanted: this.wanted, failures: this.failures, nextAttemptAt: this.nextAttemptAt,
      lastError: this.lastError, lastSuccessAt: this.lastSuccessAt, unansweredSince: this.unansweredSince, cached: this.cache.size };
  }
}

/** Start time of the reference candle for a decision minute that closed at `decisionCloseTime`. */
export function referenceMinuteStart(decisionCloseTime: number, lookbackMs: number): number {
  return decisionCloseTime - lookbackMs - MINUTE_MS;
}
