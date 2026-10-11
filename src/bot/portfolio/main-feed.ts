/** Reuses the production candle/context/SR/weak-week readers, but keeps all I/O
 * outside account mutation work. No credentials or trading methods are accepted.
 */
import type { BotConfig } from '../bot-config';
import type { Executor } from '../executor';
import { LiveCandleSource } from '../live-candle-source';
import { LiveContextManager } from '../context-manager';
import { Aggressive10Context } from '../aggressive10-context';
import { ExactMinuteHistory } from '../time-stop-history';
import { SRMemoryZoneEngine, DEFAULT_SR_MEMORY_ZONE_CONFIG } from '../sr-memory-zones';
import { computeOnChainFeatures } from '../shadow-logger';
import { getContext } from '../../technical-engine';
import type { MainFeedPort } from './main-driver';
import type { MainPolicyInputs } from './main-policy';
import type { SetupFeedSnapshot } from './setup-runtime';
import { MINUTE as M, epoch } from './contract';
const H = 60 * M;

export class PortfolioMainFeed implements MainFeedPort {
  private readonly sources: Record<'hype4h' | 'hype1h' | 'btc1h' | 'hype1d', LiveCandleSource>;
  private readonly context: LiveContextManager;
  private readonly high: Aggressive10Context;
  private readonly history: ExactMinuteHistory;
  private readonly zones: SRMemoryZoneEngine;
  private readonly horizonDays: number;
  private pulse: MainPolicyInputs['pulse'] = null;
  private pulsePending = false; private pulseAttempt = 0;
  private contextPending = false; private contextAttempt = 0; private prepared = false;
  private preparing = false;
  private repairAttemptAt: number | null = null; private repairNextAt = 0; private repairFailures = 0;
  private repairError: string | null = null;
  private repairing = false;
  private indicatorKey = ''; private indicatorValue: NonNullable<MainPolicyInputs['indicators']>['value'] | null = null;
  readonly errors: Record<string, string | null> = { context: null, pulse: null, indicators: null, sr: null };
  constructor(publicCandles: Pick<Executor, 'getCandles'>, config: BotConfig,
    private readonly market: { quote: () => MainPolicyInputs['quote']; funding: () => MainPolicyInputs['funding'];
      decisionMark: (now: number) => SetupFeedSnapshot['price'] },
    private readonly options: { clock?: () => number; pulse?: typeof computeOnChainFeatures;
      indicators?: (now: number) => MainPolicyInputs['indicators'] } = {}) {
    const get = publicCandles.getCandles.bind(publicCandles), symbol = config.symbol;
    this.sources = {
      hype4h: new LiveCandleSource(() => get(symbol, '240', 250), 4 * H, Math.max(config.filters.trendEmaLong, config.filters.trendEmaShort) + 1),
      btc1h: new LiveCandleSource(() => get('BTCUSDT', '60', 5), H, 2),
      hype1h: new LiveCandleSource(() => get(symbol, '60', 750), H, 15),
      hype1d: new LiveCandleSource(() => get(symbol, 'D', 30), 24 * H, 2, 2000, 0, H),
    };
    this.context = new LiveContextManager(publicCandles, symbol);
    this.high = new Aggressive10Context(publicCandles, symbol);
    this.history = new ExactMinuteHistory(get, symbol, { now: () => this.now() });
    const sr = { ...DEFAULT_SR_MEMORY_ZONE_CONFIG, ...config.srShadow,
      enabled: !!(config.srShadow?.enabled || config.srPartialExitAction?.enabled) };
    this.zones = new SRMemoryZoneEngine(sr); this.horizonDays = sr.recentDays;
  }
  private now(): number { const at = (this.options.clock ?? Date.now)(); epoch(at); return at; }
  /** Startup can hydrate in the background while service() reconciles/exits.
   * No entries are authorized by completion of this method.
   */
  async prepare(): Promise<void> {
    if (this.preparing || this.prepared) return; this.preparing = true;
    try {
      await this.context.init(); this.prepared = true;
      this.errors.context = this.context.getClosedCoverageStatus(this.now(), this.horizonDays).healthy
        ? null : 'context_history_incomplete';
    }
    catch { this.errors.context = 'context_bootstrap_failed'; }
    finally { this.preparing = false; }
  }
  request(now: number): void {
    epoch(now);
    if (!this.prepared && !this.preparing && now - this.contextAttempt >= 30000) {
      this.contextAttempt = now; void this.prepare();
    }
    for (const source of Object.values(this.sources)) source.prefetch();
    void this.high.refresh(now);
    void this.history.request(Math.floor(now / M) * M - 7 * 24 * H - M);
    if (this.prepared && !this.contextPending && !this.context.getRefreshHealth().pending) {
      if (!this.context.getClosedCoverageStatus(now, 6 / 24).healthy && now - this.contextAttempt >= 10000) {
        this.contextAttempt = now; this.contextPending = true;
        void this.context.refresh().then(() => {
          this.errors.context = this.context.getClosedCoverageStatus(this.now(), this.horizonDays).healthy
            ? null : 'context_history_incomplete';
        }, () => { this.errors.context = 'context_refresh_failed'; }).finally(() => { this.contextPending = false; });
      } else if (this.context.getClosedCoverageStatus(now, 6 / 24).healthy
        && !this.context.getClosedCoverageStatus(now, this.horizonDays).healthy && now >= this.repairNextAt) {
        this.contextPending = true; this.repairing = true; this.repairAttemptAt = now;
        void this.context.repairClosedCoverage(now, this.horizonDays).then(() => {
          this.repairFailures = 0; this.repairError = null; this.repairNextAt = this.now() + 10000;
        }, e => {
          this.repairError = e instanceof Error ? e.message.slice(0, 180) : 'context_repair_failed';
          this.repairFailures++;
          this.repairNextAt = this.now() + Math.min(300000, 30000 * 2 ** Math.min(4, this.repairFailures - 1));
        }).finally(() => { this.contextPending = false; this.repairing = false; });
      }
    }
    if (!this.pulsePending && now - this.pulseAttempt >= 10000) {
      this.pulseAttempt = now; this.pulsePending = true;
      void (this.options.pulse ?? computeOnChainFeatures)('HYPEUSDT', now).then(value => {
        // Metric windows end at request time, not receipt time. Late completion
        // must not make stale input young or admit future source observations.
        this.pulse = { at: now, value }; this.errors.pulse = null;
      }, () => { this.pulse = null; this.errors.pulse = 'pulse_refresh_failed'; }).finally(() => { this.pulsePending = false; });
    }
  }
  latest(now: number): MainPolicyInputs {
    epoch(now);
    const x: MainPolicyInputs = { quote: null, funding: null, hype4h: null, btc1h: null, hype1h: null, hype1d: null,
      fiveMinute: null, indicators: null, pulse: this.pulse, sr: null, high: null, reference7d: null };
    // One failed supplementary reader cannot hide a healthy price exit.
    try { x.quote = this.market.quote(); } catch {}
    try { x.funding = this.market.funding(); } catch {}
    for (const key of ['hype4h', 'btc1h', 'hype1h', 'hype1d'] as const) {
      const view = this.sources[key].snapshot(now);
      x[key] = { at: now, healthy: view.health.healthy, value: view.rows };
    }
    x.high = { at: now, value: this.high.snapshot(now) };
    const referenceAt = Math.floor(now / M) * M - 7 * 24 * H, reference = this.history.get(referenceAt - M);
    if (reference !== null) x.reference7d = { at: now, value: { closeTime: referenceAt, close: reference } };
    if (this.options.indicators) x.indicators = this.options.indicators(now);
    if (!this.prepared) return x;
    let candles, coverage;
    try {
      candles = this.context.getCandles().filter(c => c.timestamp + 5 * M <= now);
      coverage = this.context.getClosedCoverageStatus(now, this.horizonDays);
    } catch { this.errors.context = 'context_read_failed'; return x; }
    this.errors.context = coverage.healthy ? null : 'context_history_incomplete';
    x.fiveMinute = { at: now, healthy: this.context.getClosedCoverageStatus(now, 6 / 24).healthy, value: candles };
    try {
      if (coverage.healthy && !this.options.indicators) {
        // The legacy context includes forming HTF buckets built from the known
        // prefix (also explicit in the archived parent). Do NOT feed it the
        // final OHLC of the current 5m candle. Full main parity remains required;
        // this is not a claim that these legacy features are closed-HTF signals.
        const key = `${candles.at(-1)?.timestamp}:${this.context.getRefreshHealth().lastSuccessAt}`;
        if (key !== this.indicatorKey) {
          const ctx = getContext('HYPEUSDT', candles);
          this.indicatorValue = { crsi4H: ctx.crsi4H ?? null, rsi1H: ctx.indicators['1H'].rsi14 ?? null };
          this.indicatorKey = key;
        }
        x.indicators = { at: now, value: this.indicatorValue! };
        this.errors.indicators = null;
      }
    } catch { this.errors.indicators = 'indicator_context_failed'; }
    try {
      if (coverage.healthy && this.zones.needsRebuild(now)) this.zones.rebuild(candles, now);
      x.sr = { at: now, value: { zoneEngine: this.zones, contextCoverage: coverage, contextCoverageHorizonDays: this.horizonDays } };
      this.errors.sr = null;
    } catch { this.errors.sr = 'sr_context_failed'; }
    return x;
  }
  decisionMark(now: number): SetupFeedSnapshot['price'] { return this.market.decisionMark(now); }
  diagnostics(now: number) {
    return { prepared: this.prepared, preparing: this.preparing, horizonDays: this.horizonDays,
      coverage: this.context.getClosedCoverageStatus(now, this.horizonDays),
      hydration: this.context.getHydrationStatus(), refresh: this.context.getRefreshHealth(),
      repair: { pending: this.repairing, lastAttemptAt: this.repairAttemptAt, nextAttemptAt: this.repairNextAt || null,
        failures: this.repairFailures, lastError: this.repairError } };
  }
}
