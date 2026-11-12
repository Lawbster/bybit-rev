import { rateLimitNumbers } from './read-timing';

/** Portfolio public candles only. No sleeping/retries inside a trading pass;
 * missing current candles still fail closed. Never wraps exchange mutations. */
export class PublicReadBackoff {
  private until = 0;
  private failures = 0;
  private skipped = 0;
  private active = 0;
  private recent: { key: string; at: number; durationMs: number; concurrent: number;
    retCode: number | null; remaining: number | null; limit: number | null; resetAt: number | null }[] = [];
  constructor(private readonly clock = Date.now) {}
  get diagnostics() {
    return { retryAt: this.until || null, remainingMs: Math.max(0, this.until - this.clock()),
      failures: this.failures, skipped: this.skipped, active: this.active, recent: structuredClone(this.recent) };
  }
  async read<T extends { retCode: number }>(key: string, request: () => Promise<T>): Promise<T> {
    const at = this.clock();
    if (at < this.until) { this.skipped++; throw new Error('portfolio public candles backoff'); }
    const concurrent = ++this.active;
    let response: T | undefined;
    try {
      response = await request();
      if (response.retCode === 10006 || response.retCode === 10016) {
        // Shared endpoint cooldown prevents hourly readers retrying independently.
        // A rejection backs off 20/40/60s; no stale candle becomes acceptable.
        // Sibling rejections in the same burst do not multiply the backoff.
        if (this.clock() >= this.until) {
          this.failures = Math.min(3, this.failures + 1);
          this.until = this.clock() + Math.min(60000, 10000 * 2 ** this.failures);
        }
      } else if (response.retCode === 0 && this.clock() >= this.until) this.failures = 0;
      return response;
    } finally {
      this.active--;
      this.recent.push({ key, at, durationMs: this.clock() - at, concurrent,
        retCode: response?.retCode ?? null, ...rateLimitNumbers(response) });
      if (this.recent.length > 16) this.recent.shift();
    }
  }
}
