import { FEED_REFRESH_MS } from './feed-health';

/** Schedules read-only refreshes independently of the trading mutation loop.
 * One refresh at a time; re-arm after completion, including transient failure. */
export class PortfolioFeedPump {
  private busy = false;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly refresh: () => Promise<void>, private readonly failed: (e: unknown) => void) {}
  request(): void {
    if (this.stopped || this.busy) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null; this.busy = true;
    void this.refresh().catch(this.failed).finally(() => {
      this.busy = false;
      if (!this.stopped) this.timer = setTimeout(() => this.request(), FEED_REFRESH_MS);
    });
  }
  stop(): void { this.stopped = true; if (this.timer) clearTimeout(this.timer); this.timer = null; }
}
