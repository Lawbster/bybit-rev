/** The single serial owner loop. Existing policies/controllers stay separate;
 * exits, group reservations and main adds are composed here, not in new bots. */
import type { PortfolioExecutionCoordinator } from './execution-coordinator';
import type { PortfolioMainDriver } from './main-driver';
import type { PortfolioSetupRuntime } from './setup-runtime';
import { MINUTE } from './contract';
import { PortfolioPersistenceError } from './ledger';

export class PortfolioRuntime {
  private busy = false;
  constructor(readonly execution: PortfolioExecutionCoordinator, readonly main: PortfolioMainDriver,
    readonly setups: PortfolioSetupRuntime, private readonly clock = Date.now) {}
  async tick() {
    if (this.busy) throw new Error('portfolio tick already running'); this.busy = true;
    try {
      // Freeze before advancing any exit: outgoing collateral cannot finance
      // another order in this minute. Unobserved receipts remain conservative.
      const windowAt = Math.floor(this.clock() / MINUTE) * MINUTE;
      if (this.execution.store.snapshot.capitalWindow?.at !== windowAt) this.execution.store.transaction(s => {
        s.capitalWindow = { at: windowAt, lots: Object.fromEntries(Object.values(s.lots).map(p => [p.id, { cost: p.cost, owner: p.owner }])) };
      });
      await this.execution.maintain();
      const main = await this.main.service();
      const setups = await this.setups.tick();
      let add: Awaited<ReturnType<PortfolioMainDriver['tryAdd']>>;
      try { add = await this.main.tryAdd(); }
      catch (e) {
        // An add can fail AFTER cancelling its maker TP. Service the remaining
        // inventory now, not after another loop/sleep. Never trade after a
        // persistence failure; preserve the original diagnostic if repair fails.
        if (!(e instanceof PortfolioPersistenceError)) {
          try { await this.main.service(); }
          catch (repair) { if (repair instanceof PortfolioPersistenceError) throw repair; }
        }
        throw e;
      }
      // A filled add must receive its TP on this pass, not wait for another timer.
      const after = await this.main.service();
      return { main, setups, add, after };
    } finally { this.busy = false; }
  }
}
