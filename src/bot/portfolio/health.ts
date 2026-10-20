import fs from 'fs';
import path from 'path';
import { loadPortfolioConfig } from './live-config';
import type { OperationalIncidentObservation } from '../operational-health';

/** Alert-only; explicit takeover retires old owner heartbeats, never collectors. */
export function portfolioHealth(root: string, now: number): {
  takeover: boolean; observations: OperationalIncidentObservation[]; clearBlockedKeys: Set<string>;
} {
  const file = path.join(root, 'portfolio-live-config.json');
  const rows: OperationalIncidentObservation[] = [];
  const clearBlockedKeys = new Set<string>();
  const alert = (key: string, summary: string, reason: string, critical = true,
    evidence: Record<string, string | number | boolean | null> = {}) => rows.push({ key,
    severity: critical ? 'critical' : 'warning', summary, evidence: { reason, ...evidence } });
  if (!fs.existsSync(file)) return { takeover: false, observations: rows, clearBlockedKeys };
  let takeover = false;
  try {
    const c = loadPortfolioConfig(file); takeover = c.enabled;
    if (!takeover) return { takeover, observations: rows, clearBlockedKeys };
    const h = JSON.parse(fs.readFileSync(path.resolve(root, c.healthFile), 'utf8'));
    if (!Number.isFinite(h.writtenAt) || now - h.writtenAt > 60000 || h.writtenAt > now + 5000
      || h.uid !== c.expectedAccountUid || h.policy !== c.policy || h.enabled !== true)
      alert('portfolio_owner_unavailable', 'Shared HYPE owner heartbeat or identity is invalid.', 'heartbeat_or_identity');
    const d = h.feed?.diagnostics;
    const highRollover = h.error === 'high_minute_rollover' && h.mainContext?.high?.transport === 'minute_rollover'
      && h.mainContext.high.lastError === null && d?.transport === 'ready';
    const timingOnly = h.degradation?.kind === 'feed_delay' && d?.fault === null && !h.recovery
      && (highRollover || ['bootstrapping', 'refresh_delayed', 'window_rollover'].includes(d?.transport)
        && h.error === d.transport);
    const evidence = { tickMs: h.tickMs ?? null, snapshotAgeMs: d?.snapshotAgeMs ?? null,
      snapshotAt: d?.snapshotAt ?? null, windowAt: d?.windowAt ?? null, requiredWindowAt: d?.requiredWindowAt ?? null,
      candleThrough: d?.through ?? null };
    if (timingOnly && Number.isFinite(h.degradation.feedDelaySince) && h.degradation.feedDelaySince <= now) {
      const duration = now - h.degradation.feedDelaySince;
      if (duration >= 60000) alert('portfolio_feed_delayed',
        'Portfolio feed refresh is delayed; dependent decisions are blocked. Inspect worker timing. Independent exits remain serviced.',
        h.error, duration >= 300000, { ...evidence, delayMs: duration });
    } else {
      // Old/unknown health schemas keep the conservative existing critical path.
      // Never downgrade a real data/account/recovery fault to a timing warning.
      const since = h.degradation?.kind === 'fault' ? h.degradation.faultSince : h.degradedSince;
      const failedWorker = ['worker_stopped', 'worker_error', 'clock_invalid'].includes(d?.transport);
      if (h.recovery || failedWorker || (h.error || h.status !== 'healthy') && (!Number.isFinite(since) || now - since >= 60000))
        alert('portfolio_degraded', 'Shared HYPE owner needs attention; inspect health and Bybit.',
          String(h.recovery ?? h.error ?? h.status), true, evidence);
    }
    if (h.mode !== c.mode || h.configuredEntryEnabled !== c.entryEnabled)
      alert('portfolio_config_restart_required', 'Portfolio process has not loaded the current configuration.', 'restart_required');
    if (h.pending?.some((p: { at?: number; resting?: boolean }) => !p.resting && (!Number.isFinite(p.at) || now - p.at! > 60000)))
      alert('portfolio_order_pending', 'Portfolio order still awaits terminal exchange receipts.', 'receipt_pending');
    const perf = h.performance;
    // One stable lifecycle, using the owner's sustained-delay/clear hysteresis.
    // Existing critical ownership/data/receipt incidents take priority; never
    // dilute those into a latency warning or add a second alert for the same fault.
    if (rows.length) clearBlockedKeys.add('portfolio_execution_delayed');
    if (!rows.length && perf && Number.isFinite(perf.activeSince) && perf.activeSince <= now
      && ['warning', 'critical'].includes(perf.severity)
      && ['slow_service_loop', 'exit_overdue'].includes(perf.reason))
      alert('portfolio_execution_delayed', 'Portfolio execution is delayed; inspect service timings and overdue exits.',
        perf.reason, perf.severity === 'critical', { tickMs: h.tickMs ?? null,
          maxExitLatenessMs: perf.maxExitLatenessMs ?? null, refreshes: perf.service?.refreshes ?? null,
          accountMs: perf.service?.accountMs ?? null, protectionMs: perf.service?.protectionMs ?? null });
  } catch {
    alert('portfolio_health_unreadable', 'Cannot read portfolio configuration or expected health.', 'unreadable');
    clearBlockedKeys.add('portfolio_execution_delayed');
  }
  return { takeover, observations: rows, clearBlockedKeys };
}
