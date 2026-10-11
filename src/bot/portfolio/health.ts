import fs from 'fs';
import path from 'path';
import { loadPortfolioConfig } from './live-config';
import type { OperationalIncidentObservation } from '../operational-health';

/** Alert-only; explicit takeover retires old owner heartbeats, never collectors. */
export function portfolioHealth(root: string, now: number): { takeover: boolean; observations: OperationalIncidentObservation[] } {
  const file = path.join(root, 'portfolio-live-config.json');
  const rows: OperationalIncidentObservation[] = [];
  const alert = (key: string, summary: string, reason: string, critical = true) => rows.push({ key,
    severity: critical ? 'critical' : 'warning', summary, evidence: { reason } });
  if (!fs.existsSync(file)) return { takeover: false, observations: rows };
  let takeover = false;
  try {
    const c = loadPortfolioConfig(file); takeover = c.enabled;
    if (!takeover) return { takeover, observations: rows };
    const h = JSON.parse(fs.readFileSync(path.resolve(root, c.healthFile), 'utf8'));
    if (!Number.isFinite(h.writtenAt) || now - h.writtenAt > 60000 || h.writtenAt > now + 5000
      || h.uid !== c.expectedAccountUid || h.policy !== c.policy || h.enabled !== true)
      alert('portfolio_owner_unavailable', 'Shared HYPE owner heartbeat or identity is invalid.', 'heartbeat_or_identity');
    if (h.recovery || (h.error || h.status !== 'healthy') && (!Number.isFinite(h.degradedSince) || now - h.degradedSince >= 60000))
      alert('portfolio_degraded', 'Shared HYPE owner needs attention; inspect health and Bybit.', String(h.recovery ?? h.error ?? h.status));
    if (h.mode !== c.mode || h.configuredEntryEnabled !== c.entryEnabled)
      alert('portfolio_config_restart_required', 'Portfolio process has not loaded the current configuration.', 'restart_required');
    if (h.pending?.some((p: { at?: number; resting?: boolean }) => !p.resting && (!Number.isFinite(p.at) || now - p.at! > 60000)))
      alert('portfolio_order_pending', 'Portfolio order still awaits terminal exchange receipts.', 'receipt_pending');
  } catch { alert('portfolio_health_unreadable', 'Cannot read portfolio configuration or expected health.', 'unreadable'); }
  return { takeover, observations: rows };
}
