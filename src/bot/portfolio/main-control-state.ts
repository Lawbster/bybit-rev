/** Main strategy memory lives in the same durable envelope as owned receipts.
 * Installing it requires a flat legacy snapshot; this is NOT a hot migration.
 */
import type { BotState, LadderPosition } from '../state';
import { AGGRESSIVE10_ID } from '../aggressive10-policy';
import { highExitCooldown, validateHighExitCooldownPolicy, type HighExitCooldownPolicy } from '../close-cooldown';
import { epoch } from './contract';
import { ownedMainPositions } from './main-inventory';
import type { Execution, Intent, PortfolioLedger } from './ledger';

export interface MainCloseTerms {
  kind: 'tp' | 'forced' | 'high'; requestedAt: number;
  policy?: HighExitCooldownPolicy;
}
export interface MainPartialAction {
  id: string; at: number; inventory: string; positionIds: string[]; reason: string;
  cooldownUntil: number; qtyStep: number; completedAt?: number;
  outcome?: 'filled' | 'rejected' | 'inventory_changed';
}
export interface MainCloseRecord {
  id: string; at: number; reason: string; lastExecutionAt: number;
  netBeforeFunding: number; fees: number; forcedCooldownUntil: number;
}
export interface MainControlState {
  version: 1; initializedAt: number;
  /** Legacy declarative memory retained; inventory is always re-projected. */
  memory: BotState;
  actualNet: number; actualFees: number;
  episodeNetStart: number; episodeFeeStart: number; hadInventory: boolean;
  /** Audit baseline only; never an alternative inventory source. */
  preClosePositions: LadderPosition[];
  closeTerms?: MainCloseTerms;
  partial?: MainPartialAction;
  closed: Record<string, MainCloseRecord>;
  /** Policy clocks survive restart; never infer a new warning from an old bar. */
  policy?: { lastLatchAt: number; lastHighDecisionAt: number; addRetryAfter: number };
}
export function validateMainCloseTerms(t: MainCloseTerms): void {
  epoch(t.requestedAt);
  if (!['tp', 'forced', 'high'].includes(t.kind) || (t.kind === 'high') !== !!t.policy) throw new Error('invalid main close terms');
  validateHighExitCooldownPolicy(t.policy);
  if (t.policy && t.requestedAt !== t.policy.requestedAt) throw new Error('main close request clock mismatch');
}
export function validateMainControl(m: MainControlState): void {
  if (m.version !== 1 || !m.memory || !m.closed || typeof m.closed !== 'object' || Array.isArray(m.closed)
    || !Array.isArray(m.preClosePositions) || typeof m.hadInventory !== 'boolean') throw new Error('invalid main control state');
  epoch(m.initializedAt);
  if (m.policy) for (const t of Object.values(m.policy)) epoch(t);
  for (const v of [m.actualNet, m.actualFees, m.episodeNetStart, m.episodeFeeStart, m.memory.realizedPnl, m.memory.totalFees])
    if (!Number.isFinite(v)) throw new Error('invalid main accounting');
  for (const v of [m.memory.lastAddTime, m.memory.forcedExitCooldownUntil, m.memory.srPartialExitActionUntil]) epoch(v);
  const profile = m.memory.aggressive10Ladder;
  if (profile && (profile.policyId !== AGGRESSIVE10_ID || !['unseen', 'extending', 'released'].includes(profile.tpPhase)))
    throw new Error('invalid main profile');
  if (m.memory.pendingOrder || m.memory.makerTpOrder || m.memory.recoveryTpOrderId || m.memory.hedgePosition)
    throw new Error('legacy exchange ownership in shared main memory');
  if (m.closeTerms) validateMainCloseTerms(m.closeTerms);
  if (m.partial) {
    const p = m.partial; epoch(p.at); epoch(p.cooldownUntil);
    if (!p.id || !p.inventory || !p.reason || !p.positionIds.length || new Set(p.positionIds).size !== p.positionIds.length
      || !(Number.isFinite(p.qtyStep) && p.qtyStep > 0) || p.cooldownUntil < p.at
      || (p.completedAt === undefined) !== (p.outcome === undefined)
      || (p.outcome !== undefined && !['filled', 'rejected', 'inventory_changed'].includes(p.outcome))) throw new Error('invalid main partial');
    if (p.completedAt !== undefined) { epoch(p.completedAt); if (p.completedAt < p.at) throw new Error('invalid partial completion'); }
  }
  for (const [id, r] of Object.entries(m.closed)) {
    if (r.id !== id || !r.reason || !Number.isFinite(r.netBeforeFunding) || !Number.isFinite(r.fees)) throw new Error('invalid main close record');
    epoch(r.at); epoch(r.lastExecutionAt); epoch(r.forcedCooldownUntil);
  }
}
export function installMainControl(s: PortfolioLedger, legacy: BotState, at: number): void {
  epoch(at);
  if (s.mainControl || legacy.positions.length || legacy.pendingOrder || legacy.makerTpOrder || legacy.recoveryTpOrderId
    || legacy.recoveryMode || legacy.hedgePosition || Object.values(s.orders).some(i => i.owner === 'main')
    || Object.values(s.reservations).some(r => r.owner === 'main') || s.exitRequests?.main)
    throw new Error('main control requires a fresh, flat, resolved cutover');
  const memory = structuredClone(legacy);
  // No legacy full-side order identity/TP intent is authoritative in this book.
  memory.desiredLongTp = null; memory.positions = [];
  s.mainControl = { version: 1, initializedAt: at, memory, actualNet: 0, actualFees: 0,
    episodeNetStart: 0, episodeFeeStart: 0, hadInventory: false, preClosePositions: [], closed: {} };
  validateMainControl(s.mainControl);
}
/** Called inside applyExecution's SAME atomic transaction; aux receipts do nothing.
 * Selective partials preserve lastAddTime, like applyObservedPartialFill. Full or
 * maker reductions re-anchor it to the surviving youngest rung, like legacy code.
 */
export function recordMainExecution(s: PortfolioLedger, i: Intent, f: Execution, netDelta: number,
  before: LadderPosition[]): void {
  const m = s.mainControl; if (!m || i.owner !== 'main') return;
  if (i.kind === 'open' && !m.hadInventory) {
    m.hadInventory = true; m.episodeNetStart = m.actualNet; m.episodeFeeStart = m.actualFees;
    m.memory.aggressive10Ladder = { policyId: AGGRESSIVE10_ID, tpPhase: 'unseen' };
  }
  m.actualNet += netDelta; m.actualFees += f.fee;
  m.memory.realizedPnl += netDelta; m.memory.totalFees += f.fee;
  m.memory.positions = ownedMainPositions(s);
  if (i.kind === 'open') m.memory.lastAddTime = i.at;
  else {
    m.preClosePositions = before;
    if (!i.mainPartialId || !m.memory.positions.length)
      m.memory.lastAddTime = m.memory.positions.reduce((n, p) => Math.max(n, p.entryTime), 0);
  }
}
/** No inferred fills. Flatness + terminal owner authority finalizes once. */
export function finalizeMainFlat(s: PortfolioLedger, at: number): MainCloseRecord | null {
  epoch(at); const m = s.mainControl;
  if (!m?.hadInventory || ownedMainPositions(s).length || Object.values(s.orders).some(i => i.owner === 'main' && !i.terminal)
    || (s.exitRequests?.main && s.exitRequests.main.completedAt === undefined)) return null;
  const fills = Object.values(s.executions).filter(f => { const i = s.orders[f.link]; return i.owner === 'main' && i.kind === 'close'; });
  const last = fills.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)).at(-1);
  if (!last) throw new Error('main became flat without owned execution evidence');
  const id = `flat:${last.id}`; if (m.closed[id]) throw new Error('main episode repeated a completed close');
  const terms = m.closeTerms, order = s.orders[last.link];
  let until = m.memory.forcedExitCooldownUntil;
  if (terms?.kind === 'forced') until = Math.max(until, (Math.floor(terms.requestedAt / 14_400_000) + 2) * 14_400_000);
  if (terms?.kind === 'high') until = Math.max(until, highExitCooldown(terms.policy, last.at, at)?.until ?? 0);
  const requestedReason = terms && last.at >= terms.requestedAt ? s.exitRequests?.main?.reason : undefined;
  const r: MainCloseRecord = { id, at, lastExecutionAt: last.at, reason: requestedReason ?? order.reason,
    netBeforeFunding: m.actualNet - m.episodeNetStart, fees: m.actualFees - m.episodeFeeStart, forcedCooldownUntil: until };
  m.closed[id] = r; m.hadInventory = false; delete m.closeTerms;
  m.memory.positions = []; m.memory.lastAddTime = 0; m.memory.aggressive10Ladder = null;
  m.memory.scorePartialFlatten = null; m.memory.totalBatchCloses++; m.memory.forcedExitCooldownUntil = until;
  // Do not clear the damaged latch, market-risk/regime state, SR cooldown or a
  // recovery incident. Agg10 deliberately has no ordinary-TP entry cooldown.
  m.memory.lastUpdated = at; return r;
}
