import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { installFatalDiagnostics } from '../runtime-fatal';
import { loadSfpConfig } from './sfp-config';
import { SfpBybitExchange } from './sfp-exchange';
import { SfpStore, SfpPersistenceError, atomicSfpJson, lockAccountLong } from './sfp-state';
import { SfpCoordinator } from './sfp-coordinator';
import { readSfpDecision, type SfpDecision, type SfpContextCache } from './sfp-candles';
import { SfpApproachAlerts } from './sfp-approach-alert';
import { LadderAlerter } from './ladder-alerter';
import { SFP_POLICY } from '../strategies/sfp-policy';
import { accountDiagnostic } from './named-bybit-account';

export async function runSfp(args = process.argv.slice(2)): Promise<void> {
  const fileArg = args.find(a => a.startsWith('--config='));
  if (args.some(a => !['--once', '--dry-run', '--preflight'].includes(a) && !a.startsWith('--config='))) throw new Error('unknown SF08 option');
  const config = loadSfpConfig(fileArg?.slice('--config='.length));
  const dryRun = args.includes('--dry-run'), once = args.includes('--once');
  if (args.includes('--preflight')) {
    console.log(JSON.stringify(await new SfpBybitExchange(config).preflight(), null, 2)); return;
  }
  const startedAt = Date.now();
  const fatal = installFatalDiagnostics('sfp-live', config.logDir);
  let release: (() => void) | null = null, stopping = false;
  const stop = () => { stopping = true; };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  let store: SfpStore | null = null, owner: SfpCoordinator | null = null;
  let decision: SfpDecision | null = null, error: string | null = null;
  let scan: Promise<void> | null = null, lastScanSlot = -1, retryAfter = 0;
  let notifications: Promise<void> | null = null;
  let notificationRetryAt = 0;
  const logged = new Set<string>();
  const alerter = new LadderAlerter(config.symbol);
  const approachCache: SfpContextCache = { value: null };
  let approach: SfpApproachAlerts | null = null;
  const deliveredFile = `${config.stateFile}.notifications.json`;
  let delivered: string[] = [];
  if (!dryRun && fs.existsSync(deliveredFile)) {
    const read = JSON.parse(fs.readFileSync(deliveredFile, 'utf8'));
    if (!Array.isArray(read) || read.some(x => typeof x !== 'string')) throw new Error('invalid SF08 notification cursor');
    delivered = read;
  }
  const emitReceipts = () => {
    if (notifications || !store || dryRun || Date.now() < notificationRetryAt) return;
    const rows = store.value.receipts.filter(r => !delivered.includes(r.id));
    if (!rows.length) return;
    notificationRetryAt = Date.now() + 60_000;
    notifications = (async () => {
      for (const r of rows.slice(0, 8)) {
        if (stopping) break;
        fs.mkdirSync(path.dirname(config.journalFile), { recursive: true });
        // Receipt IDs allow deduplication if a crash falls between append/send/ack.
        if (!logged.has(r.id)) {
          fs.appendFileSync(config.journalFile, JSON.stringify({ ...r, policy: SFP_POLICY, account: config.accountAlias }) + '\n');
          console.log(`[SF08 ${config.accountAlias}] ${r.kind} qty=${r.qty} price=${r.price ?? '-'} net=${r.net.toFixed(2)}`);
          logged.add(r.id);
          if (logged.size > 1024) logged.delete(logged.values().next().value!);
        }
        const sent = await alerter.notifySetupEvent(config.accountAlias, 'SF08', r.kind, [
          { name: 'Quantity', value: String(r.qty) }, { name: 'Fill', value: String(r.price ?? 'n/a') },
          { name: 'Net before funding', value: `$${r.net.toFixed(2)}` }, { name: 'Receipt', value: r.id },
        ]);
        if (!sent) break;
        delivered.push(r.id); delivered = delivered.slice(-1024); atomicSfpJson(deliveredFile, delivered);
      }
    })().catch(e => { if (e instanceof SfpPersistenceError) fatal.exit(e); console.error('SF08 notification delivery failed'); })
      .finally(() => { notifications = null; });
  };
  try {
    if (config.enabled && !dryRun) {
      const exchange = new SfpBybitExchange(config);
      await exchange.verifyIdentityAndMode();
      release = lockAccountLong(path.resolve('data/account-owners'), config.expectedAccountUid, config.symbol);
      store = new SfpStore(config.stateFile, config.accountAlias, config.expectedAccountUid, startedAt);
      owner = new SfpCoordinator(store, exchange);
      // Reconcile before any bootstrap or signal; persist the no-backlog watermark.
      store.value.lastDecisionAt = Math.max(store.value.lastDecisionAt, startedAt);
      store.save(startedAt);
      approach = new SfpApproachAlerts({ file: `${config.stateFile}.approach-notifications.json`,
        candleFile: config.candleFile, accountUid: config.expectedAccountUid, bootstrapAt: startedAt, cache: approachCache,
        eligible: () => !!store && !!owner && !stopping && alerter.enabled && config.entryEnabled
          && !fs.existsSync(config.pauseFile) && !store.value.position && !store.value.pending && !store.value.recovery
          && store.value.nextEntryAt <= Date.now() && decision?.healthy === true
          && owner.observed?.qty === 0 && owner.observed?.shortQty === 0
          && owner.checkedAt !== null && Date.now() - owner.checkedAt < 30_000,
        send: a => alerter.notifySfpApproaching(config.accountAlias, [
          { name: 'Setup', value: 'Known range + first sweep + provisional reclaim; final 4h close pending' },
          { name: 'Range low / high', value: `$${a.rangeLow.toFixed(4)} / $${a.rangeHigh.toFixed(4)}` },
          { name: 'Last known price / sweep extreme', value: `$${a.reference.toFixed(4)} / $${a.sweepLow.toFixed(4)}` },
          { name: '4h closes (UTC)', value: new Date(a.closeAt).toISOString() },
          { name: 'Provisional TP / SL', value: `$${a.target.toFixed(4)} / $${a.stop.toFixed(4)} — may change before confirmation` },
          { name: 'Source minute closed (UTC)', value: new Date(a.sourceThrough).toISOString() },
          { name: 'Setup ID', value: a.id },
        ]),
      });
    } else if (fs.existsSync(config.stateFile)) {
      const saved = JSON.parse(fs.readFileSync(config.stateFile, 'utf8'));
      if (!dryRun && (saved.position || saved.pending || saved.recovery)) throw new Error('cannot disable SF08 owner with unresolved state; use entryEnabled=false');
    }
    do {
      if (owner) await owner.maintain();
      const now = Date.now(), slot = Math.floor((now - 60_000) / 14_400_000) * 14_400_000 + 60_000;
      if (!scan && now >= retryAfter && (slot !== lastScanSlot || (decision as SfpDecision | null)?.healthy === false && now < slot + 60_000)) {
        lastScanSlot = slot; retryAfter = now + 15_000;
        scan = readSfpDecision(config.candleFile, now, startedAt, approachCache)
          .then(d => { decision = d; error = null; })
          .catch(() => { decision = { at: slot, healthy: false, reason: 'candle_read_failed', minutes: 0, signals: [] }; error = 'candle_read_failed'; })
          .finally(() => { scan = null; });
      }
      // Once/dry-run can wait for a read; the ongoing owner never waits for context
      // hydration before its next protection/timeout poll.
      if (once || dryRun) await scan;
      const current = decision as SfpDecision | null;
      const entriesAllowed = config.entryEnabled && !fs.existsSync(config.pauseFile);
      if (owner && current?.healthy && !stopping) for (const signal of current.signals) await owner.consider(signal, config.notionalUsdt, entriesAllowed);
      // Observational sidecar: no awaiting HTTP or a context read in the owner loop.
      if (!once && !dryRun) approach?.tick();
      const s = store?.value, p = s?.position;
      const protectedNow = !!p && !!owner?.observed && Math.abs(owner.observed.qty - p.qty) < 1e-7 && owner.observed.tp === p.target && owner.observed.sl === p.stop;
      const health = { version: 1, symbol: config.symbol, policy: SFP_POLICY, accountAlias: config.accountAlias,
        accountUid: config.expectedAccountUid, processStartedAt: startedAt, writtenAt: Date.now(),
        enabled: config.enabled, entryEnabled: entriesAllowed, dryRun,
        status: dryRun || !config.enabled ? 'disabled' : s?.recovery ? 'degraded' : 'healthy',
        error, recovery: s?.recovery ?? null, decision: current && { ...current, signals: current.signals.length },
        position: p ? { qty: p.qty, entryPrice: p.entryPrice, takeProfit: p.target, stopLoss: p.stop, expiresAt: p.signal.expiresAt } : null,
        pending: s?.pending ? { kind: s.pending.kind, at: s.pending.at, orderLinkId: s.pending.link } : null,
        protectionConfirmed: protectedNow, reconciliation: { lastAt: owner?.checkedAt ?? null, observed: owner?.observed ?? null },
        realizedPnlBeforeFunding: s?.realizedPnl ?? 0, fees: s?.fees ?? 0,
        memory: process.memoryUsage(), notificationsPending: s?.receipts.filter(r => !delivered.includes(r.id)).length ?? 0,
        approachAlert: approach?.health ?? null };
      if (dryRun) console.log(JSON.stringify(health, null, 2)); else atomicSfpJson(config.healthFile, health);
      emitReceipts();
      if (once || dryRun || stopping) break;
      await new Promise(r => setTimeout(r, config.pollIntervalMs));
    } while (!stopping);
  } finally {
    if (scan) await scan;
    if (notifications) await notifications;
    if (approach) await approach.drain();
    release?.(); fatal.uninstall(); process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
  }
}
if (require.main === module) runSfp().catch(e => installFatalDiagnostics('sfp-live').exit(new Error(accountDiagnostic(e))));
