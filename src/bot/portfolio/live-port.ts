import fs from 'fs';
import { execFileSync } from 'child_process';
import type { RestClientV5 } from 'bybit-api';
import { BybitPortfolioAccount } from './bybit-account';
import { BybitPortfolioOrders, type PortfolioWriteRequest } from './bybit-orders';
import type { PortfolioExecutionPort } from './execution-coordinator';

/** Cooperative locks alone cannot fence an unchanged legacy process. Check PM2
 * before every write, without logging its environment-bearing JSON. */
export function assertLegacyWritersStopped(): void {
  let processes: { name: string; pm2_env?: { status?: string } }[];
  try { processes = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', timeout: 5000, maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })); }
  catch { throw new Error('portfolio: cannot verify stopped legacy owners'); }
  if (!Array.isArray(processes) || processes.some(p => ['hedgeguy-bot', 'hype-sfp-live', 'hype-hl-short-live', 'wed-short', 'pf0-short-bot'].includes(p.name)
    && p.pm2_env?.status !== 'stopped' && p.pm2_env?.status !== 'errored')) throw new Error('portfolio: legacy writer is not stopped');
  if (!fs.existsSync('bot-pause') || !fs.existsSync('lawbster-sfp-pause')) throw new Error('portfolio: legacy pause files required');
}

/** One real transport for the one coordinator. No timers, separate strategy
 * clients or account-level TP changes. Activation is owned by portfolio-live. */
export class BybitPortfolioPort implements PortfolioExecutionPort {
  readonly transport = 'bybit' as const;
  readonly account: BybitPortfolioAccount;
  private readonly orders: BybitPortfolioOrders;
  constructor(client: RestClientV5, authorize: (r: PortfolioWriteRequest) => true,
    private readonly writesEnabled: () => boolean, clock = Date.now) {
    this.account = new BybitPortfolioAccount(client, clock);
    this.orders = new BybitPortfolioOrders(client, '555249668', r => {
      if (!this.writesEnabled()) throw new Error('portfolio: exchange writes disabled');
      assertLegacyWritersStopped(); return authorize(r);
    }, clock);
  }
  snapshot = () => this.account.snapshot();
  observe: PortfolioExecutionPort['observe'] = c => this.orders.evidence.observe(c);
  submit: PortfolioExecutionPort['submit'] = c => this.orders.submit(c);
  cancel: PortfolioExecutionPort['cancel'] = c => this.orders.cancel(c);
  attached: NonNullable<PortfolioExecutionPort['attached']> = {
    observe: (c, known) => this.orders.evidence.observeAttached(c, known),
    cancel: (c, id) => this.orders.cancelAttached(c, id),
  };
}
