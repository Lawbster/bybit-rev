import assert from 'assert/strict';
import { H, M, type SetupEvent } from './setup-context';
type Row = Record<string, any>;
export interface SetupAction { id: string; at: number; side: 1 | -1; target?: number; stop?: number; expiresAt?: number; failureAt?: number; evidence?: Row; entry?: { price: number; expiresAt: number; model: 'touch' | 'open' }; }
type Action = SetupAction;

export interface ReplayVariant { side: 1 | -1; target: string; holdHours: number }
/** Which scan rows become trades: the confirmed setup (default) or a named non-confirmed row set used as a control, e.g. `rejected:no_sweep_before_fail`. */
export interface RowFilter { stage: SetupEvent['stage']; reason?: string }
export interface ReplayConfig {
  scanKey: string; sides: (1 | -1)[]; targets: string[]; holds: number[]; delaysMs: number[]; notional: number; equity: number;
  fee: number; stressBpsPerSide: number; riskMinPct: number; riskMaxPct: number; stopBufferPct: number; includeControls: boolean; split: number | null;
  rows?: RowFilter;
  /** Stage whose price is the bracket reference (default: retest, else reclaim, else impulse, else the last stage). Rows without that stage are rejected. */
  refStage?: string;
  /** Resting limit entry. source `sweep` (default) prices the order off the sweep stage plus offset; `proxy` uses the detector's own resting price (proxies.entry, e.g. OB01's 0.705 level). */
  entryLimit?: { offsetPct: number; expiryHours: number; model: 'touch' | 'open'; source?: 'sweep' | 'proxy' };
  /** Execution stop only: after original bracket eligibility/target calculation. Does not retarget rN. */
  exitStopPaddingPct?: number;
}
export const cellId = (v: ReplayVariant) => `${v.side === 1 ? 'long' : 'short'}__${v.target}__hold${v.holdHours}h`;
export function parseRowFilter(v: string | undefined): RowFilter {
  if (!v || v === 'confirmed') return { stage: 'confirmed' };
  const [stage, reason] = v.split(':');
  if (!['confirmed', 'rejected', 'expired', 'invalidated', 'pending_at_cutoff'].includes(stage)) throw new Error(`unknown row stage ${stage}`);
  return reason ? { stage: stage as SetupEvent['stage'], reason } : { stage: stage as SetupEvent['stage'] };
}
export const rowMatches = (e: SetupEvent, f: RowFilter = { stage: 'confirmed' }) => e.stage === f.stage && (f.reason === undefined || e.reason === f.reason);

/** Build strictly time-ordered bracket actions for one cell. Rejections and ties are returned for the ledger. */
export function buildActions(events: readonly SetupEvent[], v: ReplayVariant, c: Pick<ReplayConfig, 'riskMinPct' | 'riskMaxPct' | 'stopBufferPct' | 'includeControls' | 'rows' | 'entryLimit' | 'exitStopPaddingPct' | 'refStage'>) {
  const exitPadding = c.exitStopPaddingPct ?? 0;
  assert(Number.isFinite(exitPadding) && exitPadding >= 0 && exitPadding < 100, 'exit stop padding must be in [0,100)');
  const rejected: Row[] = [], discarded: Row[] = [], actions: Action[] = [];
  const rMatch = v.target.match(/^r(\d+(?:\.\d+)?)$/);
  /** tpN[slM]: target N% from the reference, stop M% from the reference (the scan stop when sl is absent); stop buffer does not apply to a percent stop. */
  const pMatch = v.target.match(/^tp(\d+(?:\.\d+)?)(?:sl(\d+(?:\.\d+)?))?$/);
  if (!rMatch && !pMatch && v.target !== 'structural') throw new Error(`unknown target mode ${v.target}`);
  for (const e of events) {
    if (!rowMatches(e, c.rows) || e.side !== v.side) continue;
    if (!c.includeControls && c.rows?.stage !== 'rejected' && e.notes.some(n => n.endsWith('_control') || n === 'pa07_control_row')) continue;
    const stageList = Object.values(e.stages);
    const ref = c.refStage ? (e.stages[c.refStage]?.price ?? null) : (e.stages.retest?.price ?? e.stages.reclaim?.price ?? e.stages.impulse?.price ?? stageList[stageList.length - 1]?.price ?? null);
    const slPct = pMatch?.[2] !== undefined ? Number(pMatch[2]) : null;
    const rawStop = slPct !== null && ref !== null ? ref * (1 - v.side * slPct / 100) : e.proxies.stop;
    if (ref === null || rawStop === null || rawStop === undefined) { rejected.push({ id: e.id, at: e.knownAt, reason: 'no_reference_or_stop' }); continue; }
    const stop = slPct !== null ? rawStop : v.side === 1 ? rawStop * (1 - c.stopBufferPct / 100) : rawStop * (1 + c.stopBufferPct / 100);
    const riskPct = Math.abs(ref - stop) / ref * 100;
    let target: number | null;
    if (rMatch) target = ref + v.side * Number(rMatch[1]) * Math.abs(ref - stop);
    else if (pMatch) target = ref * (1 + v.side * Number(pMatch[1]) / 100);
    else target = e.proxies.target;
    if (target === null) { rejected.push({ id: e.id, at: e.knownAt, reason: 'no_structural_target' }); continue; }
    if (!(v.side * (ref - stop) > 0 && v.side * (target - ref) > 0)) { rejected.push({ id: e.id, at: e.knownAt, reason: 'invalid_bracket', ref, stop, target }); continue; }
    if (riskPct < c.riskMinPct || riskPct > c.riskMaxPct) { rejected.push({ id: e.id, at: e.knownAt, reason: 'risk_out_of_range', riskPct }); continue; }
    if (e.knownAt % M !== 0) { rejected.push({ id: e.id, at: e.knownAt, reason: 'known_at_not_minute_aligned' }); continue; }
    let entry: { price: number; expiresAt: number; model: 'touch' | 'open' } | undefined;
    if (c.entryLimit) {
      const source = c.entryLimit.source ?? 'sweep';
      const basePrice = source === 'proxy' ? e.proxies.entry : (e.stages.sweep?.price ?? null);
      if (basePrice === null || basePrice === undefined) { rejected.push({ id: e.id, at: e.knownAt, reason: source === 'proxy' ? 'no_entry_proxy' : 'no_sweep_stage' }); continue; }
      entry = { price: basePrice * (1 + c.entryLimit.offsetPct / 100), expiresAt: e.knownAt + c.entryLimit.expiryHours * H, model: c.entryLimit.model };
      if (v.side !== 1) { rejected.push({ id: e.id, at: e.knownAt, reason: 'limit_entry_long_only' }); continue; }
      if (!(entry.price > stop && entry.price < ref)) { rejected.push({ id: e.id, at: e.knownAt, reason: 'limit_outside_bracket', limit: entry.price, stop, ref }); continue; }
      assert(entry.expiresAt > e.knownAt, 'invalid limit expiry');
    }
    actions.push({ id: e.id, at: e.knownAt, side: v.side, stop, target, expiresAt: e.knownAt + v.holdHours * H, ...(entry ? { entry } : {}),
      evidence: { setup: e.setup, version: e.version, refPrice: ref, riskPct, targetMode: v.target, stages: Object.fromEntries(Object.entries(e.stages).map(([k, s]) => [k, s.at])), formationAt: e.formationAt } });
  }
  actions.sort((a, b) => a.at - b.at || (a.evidence!.formationAt as number) - (b.evidence!.formationAt as number) || a.id.localeCompare(b.id));
  const kept: Action[] = [];
  for (const a of actions) { const prior = kept[kept.length - 1]; if (prior && prior.at === a.at) discarded.push({ id: a.id, at: a.at, keptId: prior.id, reason: 'same_minute_tie_oldest_formation_then_id' }); else kept.push(a); }
  return { actions: exitPadding ? kept.map(a => ({ ...a, stop: a.stop! * (1 - a.side * exitPadding / 100) })) : kept, rejected, discarded };
}
