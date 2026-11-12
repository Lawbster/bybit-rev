import { AsyncLocalStorage } from 'node:async_hooks';

/** GETs only. Drain failed siblings before allowing the owner to start more work. */
export async function parallelReads<T extends readonly unknown[]>(work: { [K in keyof T]: Promise<T[K]> }): Promise<T> {
  const rows = await Promise.allSettled(work);
  const failed = rows.find(r => r.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  return rows.map(r => (r as PromiseFulfilledResult<unknown>).value) as unknown as T;
}
export function rateLimitNumbers(response: any) {
  const r = response?.rateLimitApi;
  const n = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
  return { remaining: n(r?.remainingRequests), limit: n(r?.maxRequests), resetAt: n(r?.resetAtTimestamp) };
}
export interface ReadTimingReport {
  key: string; startedAt: number; completedAt: number; durationMs: number; marginMs: number; ok: boolean;
  requestCount: number; sequentialDepth: number; phases: Record<string, number>;
  pages: Record<string, number>; truncated: boolean;
  requests: { endpoint: string; phase: string; page: number; startedAt: number; durationMs: number;
    retCode: number | null; remaining: number | null; limit: number | null; resetAt: number | null }[];
}
/** Bounded diagnostic metadata only: no credentials, cursors, bodies or headers.
 * Contexts isolate concurrent bracket reads. Timings never authorize a write. */
export class PortfolioReadTiming {
  private readonly context = new AsyncLocalStorage<{ report: ReadTimingReport; phase: string }>();
  private readonly completed = new Map<string, ReadTimingReport>();
  constructor(private readonly clock = Date.now) {}
  get reports(): ReadTimingReport[] { return structuredClone([...this.completed.values()]); }
  async run<T>(key: string, read: () => Promise<T>): Promise<T> {
    const report: ReadTimingReport = { key, startedAt: this.clock(), completedAt: 0, durationMs: 0, marginMs: 0,
      ok: false, requestCount: 0, sequentialDepth: 0, phases: {}, pages: {}, truncated: false, requests: [] };
    return this.context.run({ report, phase: 'read' }, async () => {
      try { const value = await read(); report.ok = true; return value; }
      finally {
        report.completedAt = this.clock(); report.durationMs = report.completedAt - report.startedAt;
        report.marginMs = 5000 - report.durationMs;
        report.sequentialDepth = Object.values(report.phases).reduce((a, b) => a + b, 0);
        this.completed.delete(key); this.completed.set(key, report);
        if (this.completed.size > 8) this.completed.delete(this.completed.keys().next().value!);
      }
    });
  }
  phase<T>(phase: string, read: () => Promise<T>): Promise<T> {
    const parent = this.context.getStore();
    return parent ? this.context.run({ report: parent.report, phase }, read) : read();
  }
  async request<T>(endpoint: string, page: number, read: () => Promise<T>): Promise<T> {
    const context = this.context.getStore(); if (!context) return read();
    const { report, phase } = context, startedAt = this.clock();
    report.requestCount++; report.pages[phase + ':' + endpoint] = (report.pages[phase + ':' + endpoint] ?? 0) + 1;
    report.phases[phase] = Math.max(report.phases[phase] ?? 0, page);
    let response: any;
    try { response = await read(); return response; }
    finally {
      if (report.requests.length < 128) report.requests.push({ endpoint, phase, page, startedAt,
        durationMs: this.clock() - startedAt, retCode: Number.isSafeInteger(response?.retCode) ? response.retCode : null,
        ...rateLimitNumbers(response) });
      else report.truncated = true;
    }
  }
}
