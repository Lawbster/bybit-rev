/** Main policy -> existing receipt-owned controller. Call under the ONE shared
 * account loop. Split service/add phases let the portfolio preserve reservations
 * and ordering; this class never creates a competing daemon or account client.
 */
import type { BotConfig } from '../bot-config';
import { PortfolioMainRuntime } from './main-runtime';
import { evaluateMainAdd, evaluateMainExits, mainQuote, validateMainPolicyConfig,
  type MainPolicyInputs, type MainPolicyReport, type MainAddDecision } from './main-policy';
import { closedMinuteEquity, type SetupFeedSnapshot } from './setup-runtime';
import { mainInventoryKey } from './main-bridge';
import type { ExecutionResult } from './execution-coordinator';
import { epoch } from './contract';

export interface MainFeedPort {
  request(now: number): void;
  /** Must return unavailable individual fields on errors, not stale fallbacks. */
  latest(now: number): MainPolicyInputs;
  decisionMark(now: number): SetupFeedSnapshot['price'];
}
export interface MainServiceReport { policy: MainPolicyReport | null; result: ExecutionResult | null; issue: string | null }
export class PortfolioMainDriver {
  private busy = false; private lastAt = 0;
  private readonly config: BotConfig;
  constructor(readonly runtime: PortfolioMainRuntime, config: BotConfig, private readonly feed: MainFeedPort,
    private readonly options: { entriesAllowed: () => boolean; clock?: () => number }) {
    validateMainPolicyConfig(config); this.config = structuredClone(config);
  }
  private now(): number { const at = (this.options.clock ?? Date.now)(); epoch(at); return at; }
  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('main driver already running');
    const at = this.now(); if (at < this.lastAt) throw new Error('main driver clock reversed');
    this.lastAt = at; this.busy = true;
    try { return await fn(); } finally { this.busy = false; }
  }
  private inputs(): MainPolicyInputs | null {
    try { const at = this.now(); this.feed.request(at); return this.feed.latest(at); }
    catch { return null; }
  }
  private async serviceInternal(): Promise<MainServiceReport> {
    await this.runtime.maintain(); // Receipt recovery survives feed failures/pause.
    const x = this.inputs();
    if (!x) return { policy: null, result: null, issue: 'main_feed_unavailable' };
    const store = this.runtime.execution.store, draft = store.snapshot, before = JSON.stringify(draft.mainControl);
    const policy = evaluateMainExits(draft, this.config, x, this.now());
    if (JSON.stringify(draft.mainControl) !== before) store.transaction(s => { s.mainControl = draft.mainControl; });
    const a = policy.action;
    if (a) {
      const result = a.kind === 'flatten'
        ? await this.runtime.requestFullClose(a.reason, a.terms, a.inventory)
        : await this.runtime.requestSrPartial(a.action);
      return { policy, result, issue: null };
    }
    const q = mainQuote(x, this.now());
    const result = q ? await this.runtime.maintainTarget({ bid: q.value.bid, tick: q.value.tick, at: q.at }) : null;
    return { policy, result, issue: q ? null : 'quote_unavailable' };
  }
  async service(): Promise<MainServiceReport> { return this.exclusive(() => this.serviceInternal()); }
  /** Account admission is re-read AFTER exit servicing. A cancelled/partially
   * filled maker invalidates this approval in PortfolioMainRuntime, as before.
   */
  async tryAdd(): Promise<{ decision: MainAddDecision | null; result: ExecutionResult }> {
    return this.exclusive(async () => {
      const blocked = (reason: string, decision: MainAddDecision | null = null) => ({ decision, result: { state: 'blocked' as const, reason } });
      if (!this.options.entriesAllowed()) return blocked('paused');
      const service = await this.serviceInternal();
      if (service.policy?.action || service.issue) return blocked('main_exit_or_feed');
      let x = this.inputs(); if (!x) return blocked('main_feed_unavailable');
      const store = this.runtime.execution.store;
      const decide = () => {
        const draft = store.snapshot, before = JSON.stringify(draft.mainControl);
        const d = evaluateMainAdd(draft, this.config, x!, this.now(), !this.options.entriesAllowed());
        if (JSON.stringify(draft.mainControl) !== before) store.transaction(s => { s.mainControl = draft.mainControl; });
        return d;
      };
      let d = decide(); if (!d.approved) return blocked(d.reasons.join(';'), d);
      const evidence = await this.runtime.execution.admissionEvidence();
      if (!evidence) return blocked('account_unavailable', d);
      // Re-read gates/quote after I/O. Never submit a saved pre-await approval.
      x = this.inputs(); if (!x) return blocked('main_feed_unavailable');
      const freshDraft = store.snapshot, beforeFresh = JSON.stringify(freshDraft.mainControl);
      const freshExit = evaluateMainExits(freshDraft, this.config, x, this.now());
      if (freshExit.action) { await this.serviceInternal(); return blocked('main_exit_preempts_add'); }
      if (JSON.stringify(freshDraft.mainControl) !== beforeFresh) store.transaction(s => { s.mainControl = freshDraft.mainControl; });
      d = decide(); if (!d.approved) return blocked(d.reasons.join(';'), d);
      const at = this.now(), q = mainQuote(x, at), mark = this.feed.decisionMark(at);
      if (!q || !mark) return blocked('capital_mark_unavailable', d);
      let equity: number;
      try { equity = closedMinuteEquity(store.snapshot, evidence.decisionCash!, mark, at); }
      catch { return blocked('capital_mark_unavailable', d); }
      const inventory = mainInventoryKey(store.snapshot);
      const result = await this.runtime.openApproved({ id: `main:${at}:${inventory.slice(0, 12)}`, at,
        price: q.value.bid, priceKnownAt: q.at, equity, equityKnownAt: evidence.decisionCash!.observedAt,
        feeRate: this.config.feeRate, expectedInventory: inventory, level: d.level, notional: d.notional,
        gatesApproved: true, entriesPaused: !this.options.entriesAllowed() });
      return { decision: d, result };
    });
  }
}
