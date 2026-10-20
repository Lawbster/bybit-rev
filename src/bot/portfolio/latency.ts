import type { PortfolioLedger } from './ledger';

/** Pending deadlines plus newly received timed closes; a completed late exit
 * must not disappear from the measurement before health is written. */
export function exitLatenessMs(s: PortfolioLedger, now: number, since: number): number {
  let worst = 0;
  for (const lot of Object.values(s.lots)) {
    const plan = s.lifecycle?.exits[lot.id];
    if (plan) worst = Math.max(worst, now - plan.dueAt);
  }
  for (const e of Object.values(s.executions)) {
    if (e.at < since || e.at > now) continue;
    const order = s.orders[e.link], plan = s.lifecycle?.exits[order?.lotId];
    if (plan && order.kind === 'close' && ['timeout', 'indicator'].includes(order.reason))
      worst = Math.max(worst, e.at - plan.dueAt);
  }
  return Math.max(0, worst);
}

/** Alert telemetry only. No strategy gate or wider execution grace.
 * One stable incident: sustained >10s loops for 60s, or an exit >=30s late.
 * Clear only after 60s of healthy measurements: the 30s watchdog can observe
 * even a completed late exit twice, without active/clear chatter. */
export class PortfolioLatencyTracker {
  private slowSince: number | null = null;
  private healthySince: number | null = null;
  private activeSince: number | null = null;
  private severity: 'warning' | 'critical' = 'warning';
  private reason: 'slow_service_loop' | 'exit_overdue' = 'slow_service_loop';
  update(tickMs: number, overdueMs: number, now: number) {
    const slow = tickMs > 10000, overdue = overdueMs >= 30000;
    this.slowSince = slow ? this.slowSince ?? now - tickMs : null;
    const sustained = this.slowSince !== null && now - this.slowSince >= 60000;
    if (sustained || overdue) {
      this.activeSince ??= now; this.healthySince = null;
      this.reason = overdue ? 'exit_overdue' : 'slow_service_loop';
      if (overdueMs >= 60000 || slow && this.slowSince !== null && now - this.slowSince >= 300000 && tickMs > 30000)
        this.severity = 'critical';
    } else if (!slow && !overdue) {
      this.healthySince ??= now;
      if (now - this.healthySince >= 60000) { this.activeSince = null; this.severity = 'warning'; }
    } else this.healthySince = null;
    return { tickMs, maxExitLatenessMs: overdueMs, activeSince: this.activeSince,
      reason: this.activeSince === null ? null : this.reason,
      severity: this.activeSince === null ? null : this.severity };
  }
}

/** Single-flight notification delivery cannot block the trading loop or retry
 * a failed webhook every tick. Durable delivery markers remain with the caller. */
export class PortfolioNoticePump {
  private pending: Promise<void> | null = null;
  private nextAt = 0;
  constructor(private readonly clock = Date.now) {}
  request(send: () => Promise<boolean>): void {
    if (this.pending || this.clock() < this.nextAt) return;
    this.pending = Promise.resolve().then(send).then(ok => {
      this.nextAt = this.clock() + (ok ? 5000 : 60000);
    }).catch(() => { this.nextAt = this.clock() + 60000; })
      .finally(() => { this.pending = null; });
  }
  async drain(): Promise<void> { await this.pending; }
}
