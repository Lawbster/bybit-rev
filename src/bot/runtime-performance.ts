import { monitorEventLoopDelay, performance } from "perf_hooks";

type Timing = { calls: number; errors: number; lastMs: number; maxMs: number; totalMs: number };
export class RuntimePerformance {
  private cycleStart: number | null = null;
  private timings = new Map<string, Timing>();
  private counters = new Map<string, number>();
  private histogram: ReturnType<typeof monitorEventLoopDelay> | null = null;
  private windowStart = Date.now();
  private lastDelay: { startAt: number; endAt: number; p95Ms: number; maxMs: number } | null = null;
  start(): void {
    if (this.histogram) return;
    try { this.histogram = monitorEventLoopDelay({ resolution: 20 }); this.histogram.enable(); } catch { /* telemetry only */ }
  }
  stop(): void { this.histogram?.disable(); this.histogram = null; }
  beginCycle(): void { this.cycleStart = performance.now(); }
  finishCycle(): void {
    if (this.cycleStart === null) return;
    this.record("cycleWork", performance.now() - this.cycleStart, false); this.cycleStart = null;
  }
  record(name: string, elapsedMs: number, error: boolean): void {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return;
    if (!this.timings.has(name) && this.timings.size >= 32) return;
    const t = this.timings.get(name) ?? { calls: 0, errors: 0, lastMs: 0, maxMs: 0, totalMs: 0 };
    t.calls++; t.errors += Number(error); t.lastMs = elapsedMs;
    t.maxMs = Math.max(t.maxMs, elapsedMs); t.totalMs += elapsedMs; this.timings.set(name, t);
  }
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now(); let error = false;
    try { return await fn(); } catch (err) { error = true; throw err; }
    finally { this.record(name, performance.now() - start, error); }
  }
  count(name: string, amount: number): void {
    if (!Number.isFinite(amount) || (!this.counters.has(name) && this.counters.size >= 32)) return;
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }
  snapshot() {
    try {
      const now = Date.now();
      if (this.histogram && now - this.windowStart >= 60_000) {
        this.lastDelay = { startAt: this.windowStart, endAt: now,
          p95Ms: this.histogram.percentile(95) / 1e6, maxMs: this.histogram.max / 1e6 };
        this.histogram.reset(); this.windowStart = now;
      }
      const { rss, heapUsed, heapTotal, external, arrayBuffers } = process.memoryUsage();
      return { memory: { rss, heapUsed, heapTotal, external, arrayBuffers },
        counters: Object.fromEntries(this.counters),
        timings: Object.fromEntries([...this.timings].map(([k, t]) => [k, { ...t, meanMs: t.totalMs / t.calls }])),
        cycleInProgressMs: this.cycleStart === null ? null : performance.now() - this.cycleStart,
        eventLoopDelay: this.lastDelay };
    } catch { return undefined; }
  }
}

// No timers/monitoring until the main owner explicitly enables it.
export const runtimePerformance = new RuntimePerformance();
