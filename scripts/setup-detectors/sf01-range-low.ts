/** SF01: first sweep/reclaim of a known low, with a frozen range-context ablation. */
import assert from 'assert/strict';
import { H, M, type Bar, type DetectorContext, type Pivot, type SetupDetector, type SetupEvent, type StageMark } from '../setup-scan-core';

export const sf01RangeLow: SetupDetector = {
  id: 'SF01', version: 'sf01-v1', title: 'Range-low SFP (first sweep and closed reclaim)',
  family: 'range', aliases: ['range low sfp', 'range-low sfp', 'sf01'],
  libraryCard: 'research/setup-library/price-action.md#PA01', warmupMs: 32 * 24 * H,
  defaults: { tfMinutes: 240, pivotWidth: 2, sweepBufferPct: 0.1, stopBufferPct: 0.1,
    levelMaxAgeHours: 720, reclaimHours: 24, rangeMinAgeHours: 24, rangeMinHeightPct: 2, requireRange: 1 },
  conventions: [
    'Long only. Completed 4h bars, strict two-right-bar pivot publication plus source lag; no entry on the sweep wick.',
    'First 0.1% sweep after the low is known, at most 30 days later; same-bar or <=24h closed reclaim above the low.',
    'Range: low >=24h old; highest later confirmed high >=2% above it, known before sweep, not exceeded since its candle. Freeze before sweep.',
    'Range target must remain untouched through reclaim and above its close; range-free control retains identical entry and stop.',
    'Stop 0.1% below sweep-to-reclaim extreme. Target proxy is range high; 2R is the primary comparison. No POC/FVG/MSB requirement.',
    'No gap bridging or use of late bars. One attempt per pivot; requireRange=0 is the all-swing control, not a second signal family.',
  ],
  detect: detectRangeLowSfp,
};

export function detectRangeLowSfp(ctx: DetectorContext): SetupEvent[] {
  const p = { ...sf01RangeLow.defaults, ...ctx.params };
  const n = (k: string) => { const v = Number(p[k]); assert(Number.isFinite(v) && v >= 0, `invalid ${k}`); return v; };
  const tf = n('tfMinutes') * M, width = n('pivotWidth'), b = n('sweepBufferPct') / 100, sb = n('stopBufferPct') / 100;
  // Optional SF02 research clock: anchors always retain the original timeframe.
  // Omitting it preserves SF01's exact event stream and serialized shape.
  const triggerTf = p.triggerTfMinutes === undefined ? tf : n('triggerTfMinutes') * M;
  assert(triggerTf >= M && triggerTf <= tf && tf % triggerTf === 0, 'trigger timeframe must divide anchor timeframe');
  const maxAge = n('levelMaxAgeHours') * H, expiry = n('reclaimHours') * H, minAge = n('rangeMinAgeHours') * H, minHeight = n('rangeMinHeightPct') / 100;
  const requireRange = n('requireRange'); assert(requireRange === 0 || requireRange === 1); assert(tf > 0 && maxAge > 0 && expiry > 0 && width >= 1 && Number.isInteger(width));
  const bars = ctx.bars(triggerTf), pivots = ctx.pivots(tf, width), out: SetupEvent[] = [];
  const known = (x: Bar) => Math.max(x.timestamp + triggerTf + ctx.lagMs, x.availableAt);
  const index = (t: number) => { let l = 0, r = bars.length; while (l < r) { const m = (l + r) >>> 1; if (bars[m].timestamp < t) l = m + 1; else r = m; } return l; };
  for (const low of pivots.filter(x => x.kind === 'low' && x.availableAt <= ctx.cutoff)) {
    const stages: Record<string, StageMark> = { level: { at: low.pivotAt, knownAt: low.availableAt, price: low.price } };
    let hi: Pivot | null = null, qualifies = false, rangeReason = 'no_known_range_high';
    let extreme = Infinity, swept = false, last: Bar | null = null, emitted = false;
    const reference = () => ({ low, rangeHigh: hi, rangeQualified: qualifies, rangeReason,
      ...(triggerTf !== tf ? { anchorTfMinutes: tf / M, triggerTfMinutes: triggerTf / M } : {}),
      ...(hi ? { zone: { low: low.price, high: hi.price, originAt: low.pivotAt, availableAt: Math.max(low.availableAt, hi.availableAt, stages.sweep.knownAt) } } : {}) });
    const emit = (stage: SetupEvent['stage'], reason: string | undefined, at: number, availableAt: number, close?: number) => {
      const hasReclaim = !!stages.reclaim;
      out.push({ id: `SF01:long:${low.id}`, setup: 'SF01', version: sf01RangeLow.version, side: 1, stage, reason,
        formationAt: at, knownAt: Math.max(availableAt, ...Object.values(stages).map(s => s.knownAt)), stages: { ...stages }, reference: reference(),
        proxies: { entry: close ?? null, stop: hasReclaim ? extreme * (1 - sb) : null, target: hi?.price ?? null }, notes: [] }); emitted = true;
    };
    const first = index(low.availableAt), origin = triggerTf === tf ? index(low.pivotAt) : index(low.pivotAt + tf) - 1, deadline = low.availableAt + maxAge;
    // The first complete trigger bar must start after publication. An earlier
    // breach during this waiting interval cannot later become a fresh sweep.
    let invalidHistory = false;
    for (let j = origin + 1; j < first; j++) {
      if (bars[j].timestamp !== bars[j - 1].timestamp + triggerTf || known(bars[j]) > bars[j].timestamp + triggerTf + ctx.lagMs) { invalidHistory = true; break; }
      if (bars[j].low <= low.price * (1 - b)) { invalidHistory = true; break; }
    }
    if (invalidHistory) {
      const at = bars[first]?.timestamp ?? ctx.cutoff;
      if (at <= ctx.cutoff) emit('rejected', 'preeligible_breach_or_unavailable_history', at, at);
      continue;
    }
    let sweepDeadline = deadline;
    for (let i = first; i < bars.length; i++) {
      const x = bars[i], k = known(x);
      if (x.timestamp + triggerTf > sweepDeadline) break;
      if (k > ctx.cutoff) break;
      if (i > origin && bars[i - 1] && x.timestamp !== bars[i - 1].timestamp + triggerTf) { emit('rejected', 'context_gap', x.timestamp, k); break; }
      if (x.availableAt > x.timestamp + triggerTf + ctx.lagMs) { emit('rejected', 'late_context', x.timestamp, k); break; }
      last = x;
      if (!swept && x.low <= low.price * (1 - b)) {
        swept = true; sweepDeadline = x.timestamp + triggerTf + expiry;
        stages.sweep = { at: x.timestamp, knownAt: k, price: x.low };
        const hs = pivots.filter(h => h.kind === 'high' && h.pivotAt > low.pivotAt && h.availableAt <= x.timestamp && h.price >= low.price * (1 + minHeight));
        hs.sort((a, z) => z.price - a.price || a.pivotAt - z.pivotAt); hi = hs[0] ?? null;
        qualifies = !!hi && x.timestamp - low.pivotAt >= minAge;
        rangeReason = !hi ? 'no_known_range_high' : x.timestamp - low.pivotAt < minAge ? 'range_too_young' : 'qualified';
        if (hi) {
          stages.range = { at: hi.pivotAt, knownAt: Math.max(hi.availableAt, low.availableAt), price: hi.price };
          for (let j = index(hi.pivotAt + tf); j < i; j++) {
            if (known(bars[j]) > k || bars[j].high > hi.price) { qualifies = false; rangeReason = 'range_high_already_exceeded_or_unavailable'; break; }
          }
        }
      }
      if (!swept) continue;
      extreme = Math.min(extreme, x.low);
      if (hi && x.high >= hi.price) { qualifies = false; rangeReason = 'range_target_consumed'; }
      if (x.close > low.price) {
        stages.reclaim = { at: x.timestamp, knownAt: k, price: x.close };
        if (hi && x.close >= hi.price) { qualifies = false; rangeReason = 'reclaim_above_range'; }
        emit(requireRange && !qualifies ? 'rejected' : 'confirmed', requireRange && !qualifies ? rangeReason : undefined, x.timestamp, k, x.close);
        break;
      }
    }
    if (!emitted) {
      const expired = ctx.cutoff >= sweepDeadline + ctx.lagMs;
      const at = expired ? sweepDeadline : (last?.timestamp ?? low.pivotAt);
      emit(expired ? 'expired' : 'pending_at_cutoff', swept ? 'no_reclaim' : 'no_sweep', at,
        expired ? sweepDeadline + ctx.lagMs : Math.max(low.availableAt, last ? known(last) : low.availableAt));
    }
  }
  return out.sort((a, b) => a.knownAt - b.knownAt || a.id.localeCompare(b.id));
}
