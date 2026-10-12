/** Execution-facing ladder controller. Uses original target policy and owned
 * receipts, never exchange aggregate entry/size. Full gate/feed orchestration
 * remains a caller responsibility; no daemon or production entrypoint here.
 */
import type { BotConfig } from '../bot-config';
import { validateAggressive10Basis } from '../bot-config';
import { aggressive10TpDecision } from '../aggressive10-policy';
import { checkBatchTp, checkSoftStale } from '../strategy';
import { normalizePriceToTick } from '../executor';
import { mainCloseAllocation, mainControlBlocksAdd, mainInventoryKey, reserveApprovedMainAdd, type ApprovedMainAdd } from './main-bridge';
import { ownedMainPositions } from './main-inventory';
import { finalizeMainFlat, validateMainCloseTerms, type MainCloseTerms, type MainPartialAction } from './main-control-state';
import { PortfolioExecutionCoordinator, type ExecutionResult } from './execution-coordinator';
import { epoch, positive } from './contract';
import { cancelUnsubmittedReservation, PortfolioPersistenceError } from './ledger';

export class PortfolioMainRuntime {
  private busy = false;
  private readonly config: BotConfig;
  constructor(readonly execution: PortfolioExecutionCoordinator, config: BotConfig, private readonly clock = Date.now) {
    validateAggressive10Basis(config);
    if (!config.aggressive10?.enabled || config.hedge.enabled || config.timeStop?.mode !== 'live' || !config.makerTp?.enabled)
      throw new Error('main runtime requires the approved Agg10/weak-week/maker profile with retired hedge');
    if (!execution.store.snapshot.mainControl) throw new Error('flat main-control cutover not installed');
    this.config = structuredClone(config);
  }
  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('main runtime action already in flight');
    this.busy = true; try { return await fn(); } finally { this.busy = false; }
  }
  private finalize(): void {
    const draft = this.execution.store.snapshot;
    if (finalizeMainFlat(draft, this.clock())) this.execution.store.transaction(s => { Object.assign(s, draft); });
  }
  /** Can be called while paused: receipts, exits and cooldowns must keep moving. */
  async maintain() {
    return this.exclusive(async () => {
      const result = await this.execution.maintain(); this.finalize();
      await this.advancePartial(); this.finalize(); return result;
    });
  }
  async openApproved(a: ApprovedMainAdd,
    reapprove?: () => Promise<ApprovedMainAdd | ExecutionResult>): Promise<ExecutionResult> {
    return this.exclusive(async () => {
      const inventory = a.expectedInventory;
      const evidenceIssue = (approval: ApprovedMainAdd): string | null => {
        const now = this.clock();
        if (now < approval.at || now - approval.at > 5000) return 'main_approval_expired';
        if ([approval.priceKnownAt, approval.equityKnownAt].some(at => !Number.isSafeInteger(at)
          || at > approval.at || now - at > 5000)) return 'main_capital_or_price_expired';
        return null;
      };
      if (!a.gatesApproved || a.entriesPaused) return { state: 'blocked', reason: 'main_gates_or_pause' };
      if (mainInventoryKey(this.execution.store.snapshot) !== inventory) return { state: 'blocked', reason: 'main_inventory_changed' };
      await this.execution.maintain(); this.finalize();
      if (mainControlBlocksAdd(this.execution.store.snapshot, this.clock())) return { state: 'blocked', reason: 'main_admission_blocked' };
      if (mainInventoryKey(this.execution.store.snapshot) !== inventory) return { state: 'blocked', reason: 'main_inventory_changed' };
      const beforeCancel = evidenceIssue(a);
      if (beforeCancel) return { state: 'blocked', reason: beforeCancel };
      const quiet = await this.execution.quiesce('main'); if (quiet.state !== 'settled') return quiet;
      this.finalize();
      // Cancellation may consume the whole approval window. The live driver
      // must fetch NEW capital/price evidence and re-run exits and every add gate.
      // A racing maker fill must never become a new ladder or resized approval.
      if (mainInventoryKey(this.execution.store.snapshot) !== inventory) return { state: 'blocked', reason: 'main_inventory_changed' };
      if (reapprove) {
        const refreshed = await reapprove();
        if ('state' in refreshed) return refreshed;
        a = refreshed;
      }
      if (a.expectedInventory !== inventory || mainInventoryKey(this.execution.store.snapshot) !== inventory)
        return { state: 'blocked', reason: 'main_inventory_changed' };
      if (!a.gatesApproved || a.entriesPaused) return { state: 'blocked', reason: 'main_gates_or_pause' };
      const afterCancel = evidenceIssue(a);
      if (afterCancel) return { state: 'blocked', reason: afterCancel };
      const now = this.clock();
      let accepted = false;
      this.execution.store.transaction(s => { accepted = !!reserveApprovedMainAdd(s, { ...a, at: now }); });
      if (!accepted) return { state: 'blocked', reason: 'main_admission_blocked' };
      let persistenceFailed = false;
      try {
        return await this.execution.open(a.id, () => mainInventoryKey(this.execution.store.snapshot) !== inventory
          ? 'main_inventory_changed' : evidenceIssue(a));
      }
      catch (e) { persistenceFailed = e instanceof PortfolioPersistenceError; throw e; }
      finally {
        // Release ONLY an unsubmitted reservation, never an unknown/partial fill.
        // Failed admission must not leave capital reserved after TP restoration.
        const s = this.execution.store.snapshot;
        if (!persistenceFailed && s.reservations[a.id] && !Object.values(s.orders).some(i => i.lotId === a.id))
          this.execution.store.transaction(d => cancelUnsubmittedReservation(d, a.id, this.clock(), 'preflight_failed'));
      }
    });
  }
  /** Caller uses the unchanged live exit predicates and passes their consequence.
   * The effect is saved BEFORE cancellation/submission, not after await/receipt.
   */
  async requestFullClose(reason: string, terms: MainCloseTerms, inventory: string, touchGraceMs = 0): Promise<ExecutionResult> {
    return this.exclusive(async () => {
      validateMainCloseTerms(terms); epoch(this.clock());
      const s = this.execution.store.snapshot, m = s.mainControl!;
      if (!reason || terms.requestedAt > this.clock() || this.clock() - terms.requestedAt > 5000)
        throw new Error('stale main close request');
      if (inventory !== mainInventoryKey(s)) return { state: 'blocked', reason: 'main_inventory_changed' };
      if (!ownedMainPositions(s).length) return { state: 'blocked', reason: 'no_main_inventory' };
      if (m.closeTerms || (m.partial && m.partial.completedAt === undefined)) return { state: 'blocked', reason: 'main_action_pending' };
      return this.execution.requestExit('main', reason, touchGraceMs, terms);
    });
  }
  /** Approvals must come from the existing S/R action, using this exact inventory.
   * No arbitrary quantities/percentage sizes and no pulse/map rule replacement.
   */
  async requestSrPartial(a: Omit<MainPartialAction, 'completedAt' | 'outcome'>): Promise<ExecutionResult> {
    return this.exclusive(async () => {
      const s = this.execution.store.snapshot, now = this.clock(), m = s.mainControl!;
      if (a.at > now || now - a.at > 5000) throw new Error('stale S/R partial approval');
      if (a.inventory !== mainInventoryKey(s)) return { state: 'blocked', reason: 'main_inventory_changed' };
      if (m.closeTerms || (m.partial && m.partial.completedAt === undefined)) return { state: 'blocked', reason: 'main_action_pending' };
      if (m.memory.srPartialExitActionUntil > now) return { state: 'blocked', reason: 'sr_partial_cooldown' };
      if (Object.values(s.orders).some(i => i.mainPartialId === a.id) || m.partial?.id === a.id) throw new Error('partial action already consumed');
      const positions = ownedMainPositions(s);
      if (!a.positionIds.length || a.positionIds.length >= positions.length || a.positionIds.some(id => !positions.some(p => p.id === id)))
        throw new Error('S/R partial must select a strict subset of main rungs');
      this.execution.store.transaction(d => { d.mainControl!.partial = structuredClone(a); });
      return this.advancePartial();
    });
  }
  private async advancePartial(): Promise<ExecutionResult> {
    let s = this.execution.store.snapshot, action = s.mainControl!.partial;
    if (!action || action.completedAt !== undefined) return { state: 'blocked', reason: 'no_pending_main_partial' };
    const orders = Object.values(s.orders).filter(i => i.mainPartialId === action!.id);
    if (orders.length > 1) throw new Error('multiple orders for one main partial');
    if (orders.length) {
      const i = orders[0];
      if (!i.terminal) return { state: 'pending', link: i.link, reason: 'main_partial_receipts_pending' };
      this.execution.store.transaction(d => {
        const p = d.mainControl!.partial!; p.completedAt = this.clock(); p.outcome = i.appliedQty > 0 ? 'filled' : 'rejected';
        if (i.appliedQty > 0) d.mainControl!.memory.srPartialExitActionUntil = Math.max(d.mainControl!.memory.srPartialExitActionUntil, p.cooldownUntil);
      });
      return { state: 'settled', link: i.link };
    }
    const quiet = await this.execution.quiesce('main'); if (quiet.state !== 'settled') return quiet;
    s = this.execution.store.snapshot;
    if (mainInventoryKey(s) !== action.inventory) {
      this.execution.store.transaction(d => { d.mainControl!.partial!.completedAt = this.clock(); d.mainControl!.partial!.outcome = 'inventory_changed'; });
      return { state: 'blocked', reason: 'main_inventory_changed' };
    }
    return this.execution.close({ ...mainCloseAllocation(s, action.positionIds, action.qtyStep), reason: action.reason, mainPartialId: action.id });
  }
  /** Original checkSoftStale + aggressive10TpDecision, including its exact phase
   * behavior. This is not a rewritten "always 0.5% after ten hours" policy.
   */
  async maintainTarget(quote: { bid: number; at: number; tick: number }): Promise<ExecutionResult> {
    return this.exclusive(async () => {
      positive(quote.bid, 'main bid'); positive(quote.tick, 'main tick'); epoch(quote.at);
      if (quote.at > this.clock() || this.clock() - quote.at > 5000) throw new Error('stale main TP quote');
      await this.execution.maintain(); this.finalize();
      if (quote.at > this.clock() || this.clock() - quote.at > 5000) return { state: 'blocked', reason: 'main_tp_quote_expired' };
      const s = this.execution.store.snapshot, m = s.mainControl!, positions = ownedMainPositions(s);
      if (!positions.length) return { state: 'blocked', reason: 'no_main_inventory' };
      if (m.closeTerms || (m.partial && m.partial.completedAt === undefined)) return { state: 'blocked', reason: 'main_action_pending' };
      const profile = m.memory.aggressive10Ladder;
      if (!profile) throw new Error('main inventory lacks Agg10 profile');
      const stale = checkSoftStale(positions, quote.bid, this.clock(), this.config);
      const target = aggressive10TpDecision(profile.tpPhase, Math.min(...positions.map(p => p.entryTime)), this.clock(),
        stale.action === 'reduce_tp' ? stale.reducedTpPct! : this.config.tpPct, this.config.tpPct);
      if (target.phase !== profile.tpPhase) this.execution.store.transaction(d => { d.mainControl!.memory.aggressive10Ladder!.tpPhase = target.phase; });
      const tp = checkBatchTp(positions, target.pct, quote.bid);
      if (tp.hit) {
        const maker = Object.values(s.orders).find(i => i.owner === 'main' && !i.terminal && i.command?.protection?.kind === 'maker_tp');
        const grace = maker && quote.bid >= Number(maker.command!.protection!.price) ? this.config.makerTp?.touchGraceMs ?? 0 : 0;
        return this.execution.requestExit('main', target.pct === this.config.tpPct ? 'TP' : 'STALE TP', grace, { kind: 'tp', requestedAt: this.clock() });
      }
      const current = Object.values(s.orders).find(i => i.owner === 'main' && !i.terminal);
      const qty = positions.reduce((n, p) => n + p.qty, 0);
      const makerFailed = Object.values(s.orders).some(i => i.owner === 'main' && i.terminal && i.appliedQty === 0
        && i.cancelRequestedAt === undefined && i.command?.protection?.kind === 'maker_tp'
        && Math.abs(i.qty - qty) < 1e-8 && Number(i.command.protection.price) === normalizePriceToTick(tp.tpPrice, quote.tick, 'up')
        && i.at >= Math.max(...positions.map(p => p.entryTime)));
      // A definitively rejected/cancelled PostOnly attempt gets quantity-owned
      // conditional TP. Never leave simultaneous independent TP authorities on
      // this shared side: one could otherwise consume another owner's inventory.
      const kind = makerFailed ? 'trigger_tp' : 'maker_tp';
      const price = normalizePriceToTick(tp.tpPrice, quote.tick, kind === 'maker_tp' ? 'up' : 'down');
      if (current?.command?.protection?.kind === kind
        && Number(current.command.protection.price) === price && Math.abs(current.qty - current.appliedQty - qty) < 1e-8
        && current.cancelRequestedAt === undefined) return { state: 'settled', link: current.link };
      if (current) {
        const quiet = await this.execution.quiesce('main'); if (quiet.state !== 'settled') return quiet;
        this.finalize();
        // Re-evaluate on a new quote after any changing fill; never reuse the
        // old cost basis for a residual. Do not price-fill from the old quote.
        if (mainInventoryKey(s) !== mainInventoryKey(this.execution.store.snapshot)) return { state: 'blocked', reason: 'main_inventory_changed' };
      }
      if (this.clock() - quote.at > 5000) return { state: 'blocked', reason: 'main_tp_quote_expired' };
      return this.execution.protect({ owner: 'main', kind, price: tp.tpPrice, reason: target.pct === this.config.tpPct ? 'TP' : 'STALE TP' });
    });
  }
}
