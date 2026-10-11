/** Persistent isolated, read-only worker. Heavy bootstrap/structural computation
 * cannot occupy the trading owner's event loop or its mutation guard. The caller
 * polls latest() synchronously; it MUST NOT await refresh while managing exits.
 */
import { isMainThread, parentPort, Worker, workerData } from 'worker_threads';
import { loadPortfolioBootstrap, PortfolioFeedReader, type FeedPaths } from './feed-loader';
import { MINUTE as M, epoch } from './contract';
type Snapshot = ReturnType<PortfolioFeedReader['snapshot']>;
type Message = { kind: 'snapshot'; value: Snapshot } | { kind: 'error'; error: string };

if (!isMainThread && workerData?.kind === 'HS01-feed') {
  void (async () => {
    const config: FeedPaths = workerData.paths;
    const feed = await loadPortfolioBootstrap(config.bootstrap, config.sha256, Date.now);
    const reader = new PortfolioFeedReader(feed, config.dataDir);
    let busy = false;
    parentPort!.on('message', (m: unknown) => {
      if (m !== 'refresh' || busy) return;
      busy = true;
      void (async () => {
        try { await reader.refresh(); parentPort!.postMessage({ kind: 'snapshot', value: reader.snapshot() } satisfies Message); }
        catch (e) { parentPort!.postMessage({ kind: 'error', error: e instanceof Error ? e.message : String(e) } satisfies Message); }
        finally { busy = false; }
      })();
    });
    parentPort!.postMessage({ kind: 'snapshot', value: reader.snapshot() } satisfies Message);
  })().catch(e => { parentPort!.postMessage({ kind: 'error', error: e instanceof Error ? e.message : String(e) } satisfies Message); parentPort!.close(); });
}

export class PortfolioFeedWorker {
  private readonly worker: Worker;
  private value: Snapshot | null = null;
  private failed: string | null = null;
  private nextRequestAt = 0;
  constructor(paths: FeedPaths) {
    // __filename works both under the existing ts-node loader and compiled dist.
    this.worker = new Worker(__filename, { workerData: { kind: 'HS01-feed', paths },
      // `ts-node script.ts` does not preload its hook in child workers. Do so
      // explicitly for local diagnostics; compiled VPS workers need no TS loader.
      ...(__filename.endsWith('.ts') ? { execArgv: ['--require', require.resolve('ts-node/register')] } : {}),
      resourceLimits: { maxOldGenerationSizeMb: 768 } });
    this.worker.on('message', (m: Message) => {
      if (m.kind === 'error') this.failed = m.error;
      else if (m.kind === 'snapshot') { this.value = m.value; this.failed = null; }
    });
    this.worker.on('error', e => { this.failed = e instanceof Error ? e.message : String(e); });
    this.worker.on('exit', code => { this.failed ??= 'feed worker exited: ' + code; });
  }
  /** No timers start themselves and there is no network or exchange ownership. */
  request(now: number): void {
    epoch(now); if (now < this.nextRequestAt || this.failed) return;
    this.nextRequestAt = now + 1000; this.worker.postMessage('refresh');
  }
  latest(now: number): { ready: false; reason: string } | { ready: true; value: Snapshot } {
    epoch(now);
    if (this.failed) return { ready: false, reason: this.failed };
    if (!this.value) return { ready: false, reason: 'bootstrapping' };
    const v = structuredClone(this.value);
    if (v.at > now || now - v.at > 5000 || Math.floor(now / M) * M !== v.poll.windowAt)
      return { ready: false, reason: 'snapshot_stale_or_outside_window' };
    // ready means transport freshness, NOT permission to trade: caller must still
    // check source/loader health, price, account state and the capital scheduler.
    // Consumer decision clock, not a claim the worker computed at this instant.
    v.poll.observedAt = now;
    for (const r of v.poll.sources) if (r.signal?.source === 'R3') r.signal.decisionAt = now;
    return { ready: true, value: v };
  }
  async close(): Promise<void> { await this.worker.terminate(); }
}
