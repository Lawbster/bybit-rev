import type { Candle } from "../fetch-candles";
import type { Executor } from "./executor";
import { aggressive10HighSnapshot, HIGH_WINDOW_MINUTES, MINUTE_MS } from "./aggressive10-policy";

/** Bounded background public-candle hydration; never blocks the trading loop. */
export class Aggressive10Context {
  private candles: Candle[] = [];
  private inFlight = false;
  private lastAttemptAt = 0;
  lastError: string | null = null;
  lastHealthyAt: number | null = null;
  constructor(private readonly executor: Pick<Executor, "getCandles">, private readonly symbol: string) {}

  /** Read-only borrowed window for the optional observer; no extra fetch or context reconstruction. */
  closedMinutes(): readonly Candle[] { return this.candles; }

  snapshot(now: number) {
    const snapshot = aggressive10HighSnapshot(this.candles, now);
    if (snapshot.healthy) this.lastHealthyAt = now;
    return snapshot;
  }

  async refresh(now: number): Promise<void> {
    if (this.inFlight || now - this.lastAttemptAt < 10_000 || now % MINUTE_MS < 2_000) return;
    const boundary = Math.floor(now / MINUTE_MS) * MINUTE_MS;
    if (this.candles.at(-1)?.timestamp === boundary - MINUTE_MS && this.snapshot(now).bars === HIGH_WINDOW_MINUTES) return;
    this.inFlight = true;
    this.lastAttemptAt = now;
    try {
      const byTime = new Map(this.candles.map(c => [c.timestamp, c]));
      let end = boundary - 1;
      for (let page = 0; page < 3; page++) {
        // No unbounded backfill. The default-off feature makes zero requests.
        const limit = page === 0 && this.candles.length >= HIGH_WINDOW_MINUTES ? 5 : 1000;
        const fresh = await this.executor.getCandles(this.symbol, "1", limit, end);
        for (const c of fresh) if (c.timestamp % MINUTE_MS === 0 && c.timestamp + MINUTE_MS <= boundary) byTime.set(c.timestamp, c);
        const rows = [...byTime.values()].filter(c => c.timestamp >= boundary - HIGH_WINDOW_MINUTES * MINUTE_MS)
          .sort((a, b) => a.timestamp - b.timestamp);
        this.candles = rows;
        let missing = boundary - MINUTE_MS;
        while (missing >= boundary - HIGH_WINDOW_MINUTES * MINUTE_MS && byTime.has(missing)) missing -= MINUTE_MS;
        if (missing < boundary - HIGH_WINDOW_MINUTES * MINUTE_MS) break;
        const nextEnd = missing + MINUTE_MS - 1;
        if (!fresh.length || nextEnd >= end) break;
        end = nextEnd;
      }
      this.lastError = null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    } finally { this.inFlight = false; }
  }
}
