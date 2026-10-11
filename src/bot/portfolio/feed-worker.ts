/** Persistent isolated, read-only worker. Heavy bootstrap/structural computation
 * cannot occupy the trading owner's event loop or its mutation guard. The caller
 * polls latest() synchronously; it MUST NOT await refresh while managing exits.
 */
import { isMainThread, parentPort, Worker, workerData } from 'worker_threads';
import { loadPortfolioBootstrap, PortfolioFeedReader, type FeedPaths } from './feed-loader';
import { epoch } from './contract';
import { describeFeed, type FeedDiagnostics } from './feed-health';
import { PortfolioFeedPump } from './feed-pump';
type Snapshot = ReturnType<PortfolioFeedReader['snapshot']>;
type Message = { kind: 'snapshot'; value: Snapshot } | { kind: 'error'; error: string };

if (!isMainThread && workerData?.kind === 'HS01-feed') {
  void (async () => {
    const config: FeedPaths = workerData.paths;
    const feed = await loadPortfolioBootstrap(config.bootstrap, config.sha256, Date.now);
    const reader = new PortfolioFeedReader(feed, config.dataDir);
    const pump = new PortfolioFeedPump(async () => {
      await reader.refresh();
      parentPort!.postMessage({ kind: 'snapshot', value: reader.snapshot() } satisfies Message);
    }, e => parentPort!.postMessage({ kind: 'error', error: e instanceof Error ? e.message : String(e) } satisfies Message));
    parentPort!.on('message', (m: unknown) => {
      if (m === 'refresh') pump.request();
    });
    parentPort!.on('close', () => pump.stop());
    pump.request(); // Autonomous thereafter; slow REST work in the owner cannot starve refresh.
  })().catch(e => { parentPort!.postMessage({ kind: 'error', error: e instanceof Error ? e.message : String(e) } satisfies Message); parentPort!.close(); });
}

export class PortfolioFeedWorker {
  private readonly worker: Worker;
  private value: Snapshot | null = null;
  private failed: string | null = null;
  private stopped = false;
  private receivedAt: number | null = null;
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
      else if (m.kind === 'snapshot') { this.value = m.value; this.failed = null; this.receivedAt = Date.now(); }
    });
    this.worker.on('error', e => { this.failed = e instanceof Error ? e.message : String(e); });
    this.worker.on('exit', code => { this.stopped = true; this.failed ??= 'feed worker exited: ' + code; });
  }
  /** Optional wake-up only. The worker also refreshes itself; it never calls Bybit. */
  request(now: number): void {
    epoch(now); if (now < this.nextRequestAt || this.stopped) return;
    this.nextRequestAt = now + 1000; this.worker.postMessage('refresh');
  }
  latest(now: number): { ready: false; reason: string } | { ready: true; value: Snapshot } {
    const diagnostic = this.diagnostics(now);
    if (diagnostic.transport !== 'ready') return { ready: false, reason: diagnostic.transport };
    const v = structuredClone(this.value!);
    // ready means transport freshness, NOT permission to trade: caller must still
    // check source/loader health, price, account state and the capital scheduler.
    // Consumer decision clock, not a claim the worker computed at this instant.
    v.poll.observedAt = now;
    for (const r of v.poll.sources) if (r.signal?.source === 'R3') r.signal.decisionAt = now;
    return { ready: true, value: v };
  }
  /** Diagnostic-only view, including last known data errors when latest() refuses stale inputs. */
  diagnostics(now: number): FeedDiagnostics { return describeFeed(this.value, this.failed, this.stopped, this.receivedAt, now); }
  async close(): Promise<void> { this.stopped = true; await this.worker.terminate(); }
}
