import type { Candle } from "../fetch-candles";
import { BoundedRefresh } from "./bounded-refresh";
import { CANDLE_CLOSE_GRACE_MS } from "./candle-cache-policy";
import { runtimePerformance } from "./runtime-performance";

export interface CandleSourceHealth {
  healthy: boolean;
  reason: string | null;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  pending: boolean;
  latestClosedTs: number | null;
  requiredClosedTs: number;
  unavailableSince: number | null;
}

/** Keeps only rows which were already closed when the request STARTED. */
export class LiveCandleSource {
  private rows: Candle[] = [];
  private unavailableSince: number | null = null;
  readonly refresh: BoundedRefresh<void>;
  constructor(
    private readonly load: () => Promise<Candle[]>,
    readonly periodMs: number,
    private readonly minimumBars: number,
    timeoutMs = 2_000,
    private readonly graceMs = CANDLE_CLOSE_GRACE_MS,
    private readonly ttlMs = periodMs,
  ) { this.refresh = new BoundedRefresh(timeoutMs); }

  health(now = Date.now()): CandleSourceHealth {
    const required = Math.floor((now - this.graceMs) / this.periodMs) * this.periodMs - this.periodMs;
    let reason: string | null = null;
    if (this.rows.at(-1)?.timestamp !== required) reason = "latest finalized candle unavailable";
    else if (this.rows.length < this.minimumBars) reason = "insufficient finalized history";
    else for (let i = 1; i < this.rows.length; i++) {
      if (this.rows[i].timestamp - this.rows[i - 1].timestamp !== this.periodMs) { reason = "candle history gap"; break; }
    }
    if (reason) this.unavailableSince ??= now; else this.unavailableSince = null;
    return { healthy: reason === null, reason, lastAttemptAt: this.refresh.lastAttemptAt,
      lastSuccessAt: this.refresh.lastSuccessAt, pending: this.refresh.pending,
      latestClosedTs: this.rows.at(-1)?.timestamp ?? null, requiredClosedTs: required,
      unavailableSince: this.unavailableSince };
  }

  private refreshDue(now: number): boolean {
    return !this.health(now).healthy || now - (this.refresh.lastSuccessAt ?? 0) >= this.ttlMs;
  }

  private retryReady(now: number): boolean {
    return this.refresh.lastAttemptAt === null || now - this.refresh.lastAttemptAt >= 10_000;
  }

  /** Maintain readiness even when cooldown/pause skips the decision's get(). */
  prefetch(): void {
    const now = Date.now();
    // Do not accumulate background waiters on a slow/timed-out owned request.
    if (this.refresh.pending || !this.retryReady(now) || !this.refreshDue(now)) return;
    // Same validation/ownership as foreground reads; failures remain in health.
    // Never await this maintenance from the trading loop or its mutation guard.
    void this.get().catch(() => {});
  }

  async get(): Promise<Candle[]> {
    const now = Date.now();
    if (this.refreshDue(now) && (this.refresh.pending || this.retryReady(now))) {
      try {
        await this.refresh.run(async () => {
          const requestedAt = Date.now();
          const fresh = await runtimePerformance.measure(`candles:${this.periodMs}`, this.load);
          const byTime = new Map<number, Candle>();
          for (const c of fresh) {
            if (c.timestamp % this.periodMs !== 0 || c.timestamp + this.periodMs + this.graceMs > requestedAt) continue;
            if (![c.timestamp, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite)
              || Math.min(c.open, c.high, c.low, c.close) <= 0 || c.volume < 0 || c.low > Math.min(c.open, c.close)
              || c.high < Math.max(c.open, c.close)) throw new Error("invalid candle OHLC");
            byTime.set(c.timestamp, c);
          }
          const next = [...byTime.values()].sort((a, b) => a.timestamp - b.timestamp);
          if (!next.length) throw new Error("no finalized candles in response");
          this.rows = next;
        });
      } catch { /* Readiness below decides whether the last confirmed window is usable. */ }
    }
    const status = this.health();
    if (!status.healthy) throw new Error(`${status.reason}${this.refresh.lastError ? `: ${this.refresh.lastError}` : ""}`);
    return this.rows;
  }
}
