import 'dotenv/config';
import fs from 'fs';
import { createHash } from 'crypto';
import { RestClientV5 } from 'bybit-api';
import { installFatalDiagnostics } from '../runtime-fatal';
import { loadBotConfig } from './bot-config';
import { StateManager } from './state';
import { atomicSfpJson } from './sfp-state';
import { LadderAlerter } from './ladder-alerter';
import { PortfolioExecutionCoordinator } from './portfolio/execution-coordinator';
import { BybitPortfolioPort, assertLegacyWritersStopped } from './portfolio/live-port';
import { loadPortfolioConfig, portfolioMainConfigHash } from './portfolio/live-config';
import { installMainControl } from './portfolio/main-control-state';
import { PortfolioMainRuntime } from './portfolio/main-runtime';
import { PortfolioMainDriver } from './portfolio/main-driver';
import { PortfolioMainFeed } from './portfolio/main-feed';
import { PortfolioFeedWorker } from './portfolio/feed-worker';
import { PortfolioSetupRuntime } from './portfolio/setup-runtime';
import { PortfolioRuntime } from './portfolio/runtime';
import { ownerPosition, cancelUnsubmittedReservation, PortfolioPersistenceError } from './portfolio/ledger';
import { MINUTE, OWNERS, PORTFOLIO_POLICY } from './portfolio/contract';
import { readPortfolioFunding, type FundingReceipt } from './portfolio/funding';
import { buildPortfolioMonitor, PortfolioStatusLogger } from './portfolio/status';
import { classifyPortfolioIssue, PortfolioIssueTracker } from './portfolio/feed-health';
import { overextendedContextStatus } from './portfolio/main-policy';
import { portfolioFillSummaries, portfolioFillFields } from './portfolio/fill-summary';
import { exitLatenessMs, PortfolioLatencyTracker, PortfolioNoticePump } from './portfolio/latency';
import { BASE_SIZING, sizingProfile, sizingTickets } from './portfolio/sizing';

const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export async function runPortfolio(args = process.argv.slice(2)): Promise<void> {
  if (args.some(a => !['--once', '--preflight', '--initialize-flat'].includes(a) && !a.startsWith('--config='))) throw new Error('unknown portfolio option');
  const config = loadPortfolioConfig(args.find(a => a.startsWith('--config='))?.slice(9));
  const profile = sizingProfile(config.sizingProfile);
  if (portfolioMainConfigHash(config.mainConfig) !== config.mainConfigSha256) throw new Error('main config changed; reconcile frozen portfolio basis');
  if (!process.env.BYBIT_API_KEY || !process.env.BYBIT_API_SECRET) throw new Error('main account credentials missing');
  const client = new RestClientV5({ key: process.env.BYBIT_API_KEY, secret: process.env.BYBIT_API_SECRET }, { timeout: 8000 });
  let execution: PortfolioExecutionCoordinator | undefined;
  const port = new BybitPortfolioPort(client, r => {
    if (!execution) throw new Error('portfolio owner not acquired'); return execution.authorizeWrite(r);
  }, () => config.enabled && config.mode === 'live');
  const snapshot = await port.snapshot();
  if (args.includes('--preflight')) {
    console.log(JSON.stringify({ readOnly: true, uid: snapshot.uid, equity: snapshot.equity, availableBalance: snapshot.availableBalance,
      longQty: snapshot.longQty, shortQty: snapshot.shortQty, openOrders: snapshot.openLinks.length,
      nativeProtection: snapshot.nativeProtection, enabled: config.enabled, mode: config.mode, entryEnabled: config.entryEnabled,
      sizingProfile: profile, sizingValid: profile !== null, tickets: profile ? sizingTickets(profile) : null,
      bootstrapPresent: fs.existsSync(config.bootstrap), bootstrapHashMatches: fs.existsSync(config.bootstrap) && hash(config.bootstrap) === config.bootstrapSha256,
      readyToArm: false }, null, 2)); return;
  }
  if (!config.enabled) throw new Error('portfolio disabled; takeover requires explicit operator enable');
  assertLegacyWritersStopped();
  if (config.mode === 'observe' && (snapshot.longQty || snapshot.shortQty || snapshot.openLinks.length || snapshot.nativeProtection))
    throw new Error('observe mode requires flat account; use live mode to manage existing portfolio inventory');
  const entriesAllowed = () => profile !== null && config.mode === 'live' && config.entryEnabled && !fs.existsSync('portfolio-pause');
  const fatal = installFatalDiagnostics('hype-portfolio-live', config.logDir), processStartedAt = Date.now();
  const alerts = new LadderAlerter('HYPEUSDT');
  const noticePump = new PortfolioNoticePump();
  let worker: PortfolioFeedWorker | undefined, stopping = false;
  let stopMainFeed: (() => void) | undefined;
  const stop = () => { stopping = true; };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  let failure: unknown;
  try {
    execution = PortfolioExecutionCoordinator.acquire({ file: config.stateFile, lockDirectory: config.lockDirectory,
      uid: config.expectedAccountUid, port, options: { exchangeLeverage: 25, feeRate: .00055, entriesAllowed } });
    if (!execution.store.snapshot.mainControl) {
      if (!args.includes('--initialize-flat') || config.mode !== 'observe' || config.entryEnabled
        || snapshot.longQty || snapshot.shortQty || snapshot.openLinks.length || snapshot.nativeProtection)
        throw new Error('first start requires --initialize-flat in observe mode with entries disabled and flat account');
      const legacy = new StateManager(config.legacyState, { requireExisting: true }).get();
      execution.store.transaction(s => installMainControl(s, legacy, Date.now()));
    }
    if (hash(config.bootstrap) !== config.bootstrapSha256) throw new Error('bootstrap hash mismatch');
    const mainConfig = loadBotConfig(config.mainConfig);
    worker = new PortfolioFeedWorker({ bootstrap: config.bootstrap, sha256: config.bootstrapSha256, dataDir: config.dataDir });
    const feed = worker;
    const latest = (at: number) => { const v = feed.latest(at); return v.ready ? v.value : null; };
    // Public candle calls only: reuse the production REST OHLC convention.
    const candles = { getCandles: async (symbol: string, interval: string, limit: number, endMs?: number) => {
      let r; try { r = await client.getKline({ category: 'linear', symbol, interval: interval as any, limit,
        ...(endMs === undefined ? {} : { end: endMs }) }); } catch { throw new Error('portfolio public candles unavailable'); }
      if (r.retCode !== 0) throw new Error('portfolio public candles rejected');
      return r.result.list.map(c => ({ timestamp: Number(c[0]), open: Number(c[1]), high: Number(c[2]), low: Number(c[3]),
        close: Number(c[4]), volume: Number(c[5]), turnover: Number(c[6]) })).sort((a, b) => a.timestamp - b.timestamp);
    } };
    const mainFeed = new PortfolioMainFeed(candles, mainConfig, {
      quote: () => { const s = port.account.latest; return s ? { at: s.observedAt, value: { bid: s.bid, tick: s.rules.tick!, qtyStep: s.rules.step } } : null; },
      funding: () => port.account.funding, decisionMark: at => latest(at)?.price ?? null,
    }, { indicators: at => {
      const v = latest(at);
      // Freshness is the verified current decision window; metrics use only its
      // completed-minute prefix, never a final future HTF close.
      return v?.price?.markedThrough === Math.floor(at / MINUTE) * MINUTE && v.mainContext && !v.health.error && v.health.gapAt === null
        ? { at, value: v.mainContext.value } : null;
    } });
    stopMainFeed = () => mainFeed.stop(); mainFeed.start();
    void mainFeed.prepare();
    const main = new PortfolioMainRuntime(execution, mainConfig);
    const driver = new PortfolioMainDriver(main, mainConfig, mainFeed, { entriesAllowed });
    const setups = new PortfolioSetupRuntime(execution, feed, { entriesAllowed, feeRate: .00055, main,
      sizingProfile: profile ?? BASE_SIZING });
    const runtime = new PortfolioRuntime(execution, driver, setups);
    const noticeFile = config.stateFile + '.notified.json', fundingFile = config.stateFile + '.funding.json';
    const notified: Record<string, true> = fs.existsSync(noticeFile) ? JSON.parse(fs.readFileSync(noticeFile, 'utf8')) : {};
    const funding: Record<string, FundingReceipt> = fs.existsSync(fundingFile) ? JSON.parse(fs.readFileSync(fundingFile, 'utf8')) : {};
    let lastFundingPoll = 0, announced = false;
    const statusLogger = new PortfolioStatusLogger();
    const issueTracker = new PortfolioIssueTracker();
    const latencyTracker = new PortfolioLatencyTracker();
    do {
      const started = Date.now(); let error: string | null = null, report: Awaited<ReturnType<PortfolioRuntime['tick']>> | null = null;
      feed.request(started); mainFeed.request(started);
      try {
        if (config.mode === 'live') {
          if (fs.existsSync('portfolio-flatten')) {
            if (!fs.existsSync('portfolio-pause')) fs.writeFileSync('portfolio-pause', 'manual portfolio flatten\n');
            execution.store.transaction(s => {
              for (const id of Object.keys(s.reservations)) if (!Object.values(s.orders).some(o => o.lotId === id))
                cancelUnsubmittedReservation(s, id, Date.now(), 'paused');
            });
            for (const owner of OWNERS) {
              const s = execution.store.snapshot, old = s.exitRequests?.[owner];
              if (old && old.completedAt === undefined) continue;
              if (ownerPosition(s, owner).qty > 0)
                await execution.requestExit(owner, 'MANUAL FLATTEN', 0, owner === 'main' ? { kind: 'forced', requestedAt: Date.now() } : undefined);
              else if (Object.values(s.orders).some(o => o.owner === owner && !o.terminal)) await execution.quiesce(owner);
            }
            // Keep the signal through unknown/late entry receipts. A later fill
            // must also be drained, not survive a one-shot flatness inspection.
          }
          if (fs.existsSync('portfolio-regime-arm')) {
            execution.store.transaction(s => { s.mainControl!.memory.regime = { redStreak: 0, greenStreak: 0, flatActive: false,
              lastDayProcessed: Math.floor(Date.now() / 86400000) - 1 }; });
            fs.unlinkSync('portfolio-regime-arm');
          }
          report = await runtime.tick();
          const flat = execution.store.snapshot;
          if (fs.existsSync('portfolio-flatten') && !Object.keys(flat.lots).length && !Object.keys(flat.reservations).length
            && !Object.values(flat.orders).some(o => !o.terminal) && !Object.values(flat.brackets ?? {}).some(b => b.completedAt === undefined)
            && !flat.recovery && !execution.lastIssue) fs.unlinkSync('portfolio-flatten');
        } else await execution.withServiceCycle(() => execution!.maintain()); // Observe is write-denied at transport.
      } catch (e) {
        if (e instanceof PortfolioPersistenceError) throw e;
        error = e instanceof Error && /^(portfolio|main|account|order|attached|stale|invalid)/i.test(e.message)
          ? e.message.slice(0, 220) : 'portfolio_tick_failed';
      }
      const fundingAt = Date.now(), s = execution.store.snapshot;
      if (fundingAt - lastFundingPoll > 60000 && config.mode === 'live') {
        lastFundingPoll = fundingAt;
        try {
          const rows = await readPortfolioFunding(client, s, fundingAt, s.mainControl!.initializedAt);
          for (const row of rows) funding[row.id] = row;
          atomicSfpJson(fundingFile, funding);
        } catch { error ??= 'funding_read_unavailable'; }
      }
      // Sample diagnostics after awaited funding work, with one current clock.
      // Never compare a newly delivered worker snapshot with a pre-await clock.
      const at = Date.now(), source = feed.latest(at), diagnostic = feed.diagnostics(at), observed = port.account.latest;
      const mainInputs = mainFeed.latest(at);
      const mainContext = mainFeed.diagnostics(at);
      const entryContext = overextendedContextStatus(mainConfig, mainInputs, at);
      const missingMain: string[] = (['hype4h', 'hype1h', 'btc1h', 'hype1d', 'fiveMinute'] as const)
        .filter(k => !mainInputs[k]?.healthy);
      if (!mainInputs.high?.value.healthy) missingMain.push('high');
      if (!mainInputs.indicators) missingMain.push('indicators');
      if (!mainContext.coverage.healthy) missingMain.push('fiveMinute14d');
      if (mainConfig.filters.overextendedEntry?.enabled && !ownerPosition(s, 'main').qty)
        for (const key of entryContext.missing) if (!missingMain.includes(key)) missingMain.push(key);
      const degradation = issueTracker.update(classifyPortfolioIssue({ feed: diagnostic, missingMain,
        high: mainContext.high,
        error: error ?? (profile === null ? 'sizing_profile_invalid' : null), recovery: s.recovery, executionIssue: execution.lastIssue ?? report?.setups.executionIssue ?? null,
        indicatorError: report?.setups.indicatorError ?? null }), at);
      const issue = degradation.reason;
      // Pure projection; a display failure must not interrupt order servicing.
      let monitor: ReturnType<typeof buildPortfolioMonitor> | undefined;
      try { monitor = buildPortfolioMonitor(s, observed, report, Date.now(), {
        pauseRequested: fs.existsSync('portfolio-pause'), flattenRequested: fs.existsSync('portfolio-flatten'),
      }, execution.lastIssue); }
      catch { console.error('[portfolio-status] display unavailable; inspect health/receipts'); }
      const measuredAt = Date.now(), tickMs = measuredAt - started;
      const performance = { ...latencyTracker.update(tickMs, exitLatenessMs(s, measuredAt, started), measuredAt),
        service: execution.serviceTiming, fundingMs: at - fundingAt };
      const health = { version: 1, policy: PORTFOLIO_POLICY, uid: s.uid, processStartedAt, writtenAt: Date.now(),
        enabled: config.enabled, mode: config.mode, configuredEntryEnabled: config.entryEnabled,
        sizingProfile: profile, tickets: profile ? sizingTickets(profile) : null,
        entryEnabled: entriesAllowed(), status: issue ? 'degraded' : 'healthy', error: issue,
        degradedSince: degradation.degradedSince, degradation,
        reconciliation: observed ? { at: observed.observedAt, longQty: observed.longQty, shortQty: observed.shortQty,
          equity: observed.equity, availableBalance: observed.availableBalance } : null,
        owners: Object.fromEntries(OWNERS.map(o => [o, ownerPosition(s, o)])),
        pending: Object.values(s.orders).filter(o => !o.terminal).map(o => ({ link: o.link, owner: o.owner, reason: o.reason,
          at: o.at, resting: !!o.command?.protection })),
        recovery: s.recovery, feed: { ...(source.ready
          ? { health: source.value.health, loader: source.value.loader, price: source.value.price } : source), diagnostics: diagnostic },
        mainInputs: mainFeed.errors, mainMissingInputs: missingMain,
        mainContext: { ...mainContext, overextended: entryContext },
        realizedBeforeFunding: s.realizedBeforeFunding, fees: s.fees,
        funding: { amount: Object.values(funding).reduce((n, f) => n + f.amount, 0), unallocated: Object.values(funding).filter(f => f.issue).length },
        tickMs, performance, report, monitor };
      atomicSfpJson(config.healthFile, health);
      try { statusLogger.emit(health, Date.now()); }
      catch { console.error('[portfolio-status] summary unavailable'); }
      noticePump.request(async () => {
        if (!announced) {
          announced = await alerts.notifySetupEvent('hypehedgeguy', 'portfolio', 'started', [
            { name: 'Mode', value: config.mode }, { name: 'Entries', value: entriesAllowed() ? 'armed' : 'disabled/paused' }], 'Shared HYPE portfolio account');
          return announced;
        }
        if (config.mode === 'live') {
          if (Object.values(s.orders).some(i => i.terminal && i.appliedQty > 0 && !notified[i.link])) {
            // A display/accounting failure must not interrupt exchange servicing.
            let fills: ReturnType<typeof portfolioFillSummaries> = [];
            try { fills = portfolioFillSummaries(s); }
            catch { console.error('[portfolio-notice] receipt summary unavailable; inspect saved receipts'); return false; }
            for (const fill of fills.filter(f => f.terminal && f.links.some(link => !notified[link]))) {
              const sent = await alerts.notifySetupEvent('hypehedgeguy', fill.source, `${fill.kind}: ${fill.reason}`,
                portfolioFillFields(fill), 'Shared HYPE portfolio account');
              if (sent) { for (const link of fill.links) notified[link] = true; atomicSfpJson(noticeFile, notified); }
              return sent; // One lifecycle notification per delivery, no restart burst.
            }
          }
          // Operational incidents (including a dead process) are sent by the
          // existing watchdog, not duplicated by this owner.
        }
        return true;
      });
      if (args.includes('--once')) { console.log(JSON.stringify({ status: health.status, mode: config.mode,
        entryEnabled: health.entryEnabled, error: health.error, healthFile: config.healthFile }, null, 2)); break; }
      if (!stopping) await new Promise(resolve => setTimeout(resolve, config.pollIntervalMs));
    } while (!stopping);
  } catch (e) { failure = e; }
  finally { stopMainFeed?.(); await worker?.close(); await noticePump.drain(); execution?.shutdown(); process.off('SIGTERM', stop); process.off('SIGINT', stop); }
  if (failure) fatal.exit(failure, 'portfolio_startup_or_persistence');
  fatal.uninstall();
}
if (require.main === module) runPortfolio().catch(error => {
  // Config/account preflight can fail before the runtime diagnostic handler is
  // installed. Preserve the sanitized reason here too; no trading cleanup.
  installFatalDiagnostics('hype-portfolio-live').exit(error, 'portfolio_preflight_or_startup');
});
