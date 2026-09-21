import fs from 'fs';
import path from 'path';
import type { OperationalIncidentObservation } from './operational-health';

/** Read-only watchdog path. Expected process presence follows the checked-in config. */
export function sfpHealthObservations(root: string, now: number): OperationalIncidentObservation[] {
  const configFile = path.join(root, 'sfp-live-config.json');
  if (!fs.existsSync(configFile)) return [];
  const incident = (key: string, summary: string, evidence: Record<string, string | number | boolean | null>, critical = true): OperationalIncidentObservation =>
    ({ key, summary, evidence, severity: critical ? 'critical' : 'warning' });
  try {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (config.enabled !== true) return [];
    if (typeof config.healthFile !== 'string') throw new Error('missing health path');
    const health = JSON.parse(fs.readFileSync(path.resolve(root, config.healthFile), 'utf8'));
    const evidence = { account: String(config.accountAlias), status: String(health.status), reason: String(health.recovery ?? health.error ?? '') };
    const out: OperationalIncidentObservation[] = [];
    if (!Number.isFinite(health.writtenAt) || now - health.writtenAt > 60_000 || health.writtenAt > now + 5000
      || health.accountUid !== config.expectedAccountUid || health.policy !== config.policy || health.enabled !== true) {
      out.push(incident('sfp_owner_unavailable', 'SF08 account owner heartbeat or identity is invalid.', evidence));
    }
    if (health.recovery || health.status === 'degraded') out.push(incident('sfp_recovery', 'SF08 owner is degraded or in recovery; inspect its account and order evidence.', evidence));
    if (health.position && (!health.protectionConfirmed || health.position.expiresAt <= now)) {
      out.push(incident('sfp_protection_or_timeout', 'SF08 position protection is unconfirmed or its timeout is overdue.', evidence));
    }
    if (health.pending && now - health.pending.at > 60_000) out.push(incident('sfp_pending', 'SF08 transaction awaits terminal exchange evidence.', evidence));
    if (health.entryEnabled && health.decision && !health.decision.healthy) out.push(incident('sfp_candles_unavailable', 'SF08 closed-bar context unavailable; new entries fail closed.', evidence, false));
    if (health.approachAlert?.error) out.push(incident('sfp_approach_alert_unavailable',
      'SF08 approach notification observer is unavailable; trading rules are unchanged.',
      { account: String(config.accountAlias), reason: String(health.approachAlert.error) }, false));
    return out;
  } catch { return [incident('sfp_health_unreadable', 'Cannot read SF08 config or expected owner health.', {})]; }
}
