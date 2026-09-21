/**
 * OB01 — Personal orderblock entry: liquidity run, MSB, resting order at the 0.705 retracement inside the block.
 * Source: D1a pp6-9 / D1b pp5-8 (library PA03 with MOD02). The source pairs a prior liquidity run and a market-structure
 * break with a resting order at the 0.705 retracement of the swing, inside the qualified block; stop below demand; target
 * the swing highs. Its bullish prose/chart disagree on stop placement and target; side-valid geometry is enforced here.
 *
 * Operational v1, long (short mirrors every rule):
 *   1. Sweep: a known 1h pivot low L (width 3) is wicked 0.1% below and price closes back above it within reclaimHours.
 *   2. MSB: a later 1h close 0.1% above the last known 1h pivot high formed after L (the interior lower high), within msbExpiryHours.
 *      Attempts with no such interior high are rejected (no_interior_high).
 *   3. Block: the last down-close bar at or after the sweep bar and before the MSB bar, full wick, immutable.
 *   4. Leg: low = the sweep extreme (lowest low from the sweep bar to the MSB bar), high = the MSB bar's high at its close.
 *      OTE = high - 0.705 * (high - low). The order is eligible only if OTE lies inside the block (ote_outside_block otherwise).
 *   5. Confirmed at the MSB known-at with proxies.entry = the resting price (entryLevel=ote) or the block's near edge (entryLevel=edge).
 *      Stop proxy 0.1% beyond the block's far edge. Target proxy: nearest known untouched opposite pivot.
 * The fill itself is modelled by the replay layer (rest from known-at, touch or trade-through, cancel on stop/target, expiry).
 */
import { H as HOUR, M, latestPivot, nextUntouchedPivot, type Bar, type DetectorContext, type SetupDetector, type SetupEvent, type Side, type StageMark } from '../setup-scan-core';

const VERSION = 'ob01-scan-v1';

export const ob01PersonalOb: SetupDetector = {
  id: 'OB01', version: VERSION, title: 'Personal orderblock entry: sweep, MSB, resting 0.705 order inside the block', family: 'origin',
  aliases: ['personal ob', 'personal orderblock', 'ote', '0.705', 'optimal trade entry', 'ob ote', 'ob1'],
  libraryCard: 'research/setup-library/price-action.md#PA03',
  defaults: { triggerTfMinutes: 60, pivotWidth: 3, bufferPct: 0.1, reclaimHours: 24, msbExpiryHours: 72, retracement: 0.705, entryLevel: 'ote' },
  conventions: [
    'Trigger and pivot timeframe 1h; strict pivots three bars each side, published after the third right-hand bar closes plus lag.',
    'Sweep: a wick 0.1% through a known pivot with a close back on the held side within 24h; the sweep extreme is tracked until the MSB.',
    'MSB: a close 0.1% beyond the last known interior pivot (formed after the swept pivot, before the sweep bar) within 72h of the sweep. No interior pivot means no attempt; a minimal local shift is not substituted.',
    'Block: last bar closing against the trade direction at or after the sweep bar and before the MSB bar, full wick.',
    'Leg endpoints are frozen at the MSB close (sweep extreme to the MSB bar extreme); no later pivot is used, so the retracement price cannot leak time. OTE = 0.705 of the leg measured back from its end.',
    'Eligibility: the resting price must lie inside the block; entryLevel=edge rests at the block near edge instead (the MOD02 comparison on the same events).',
    'Stop proxy 0.1% beyond the block far edge (the source places it beyond demand). Target proxy: nearest known opposite pivot not traded through since it became available; may be absent.',
    'The event is confirmed at the MSB known-at with the resting price in proxies.entry; whether and when it fills is decided by the replay layer, not the scan.',
  ],
  warmupMs: 14 * 24 * HOUR,
  detect(ctx) { return detectPersonalOb(ctx); },
};

export function detectPersonalOb(ctx: DetectorContext): SetupEvent[] {
  const num = (k: string) => Number(ctx.params[k]);
  const ttf = num('triggerTfMinutes') * M, width = num('pivotWidth'), b = num('bufferPct') / 100, retr = num('retracement');
  const reclaimExp = num('reclaimHours') * HOUR, msbExp = num('msbExpiryHours') * HOUR;
  const entryLevel = String(ctx.params.entryLevel ?? 'ote');
  if (entryLevel !== 'ote' && entryLevel !== 'edge') throw new Error(`OB01 entryLevel must be ote or edge, got ${entryLevel}`);
  if (!(retr > 0 && retr < 1)) throw new Error('retracement must be between 0 and 1');
  const bars = ctx.bars(ttf), pivots = ctx.pivots(ttf, width), lag = ctx.lagMs;
  const out: SetupEvent[] = [];
  const index = new Map<number, number>(); bars.forEach((x, i) => index.set(x.timestamp, i));
  const end = (x: Bar) => x.timestamp + ttf;
  const pending = (deadline: number) => ctx.cutoff < deadline;

  for (const L of pivots) {
    const side: Side = L.kind === 'low' ? 1 : -1; const p = L.price;
    const ext = (x: Bar) => (side === 1 ? x.low : x.high), opp = (x: Bar) => (side === 1 ? x.high : x.low);
    const inside = (v: number, ref: number) => side * (v - ref) > 0, beyond = (v: number, ref: number) => side * (ref - v) > 0;
    const shift = (v: number, k: number) => v * (1 + side * k);
    const iL = index.get(L.pivotAt); if (iL === undefined) continue;
    const stages: Record<string, StageMark> = { level: { at: L.pivotAt, knownAt: L.availableAt, price: p } };
    const notes: string[] = []; const reference: Record<string, unknown> = { sweptPivot: L };
    const known = (x: Bar) => Math.max(end(x) + lag, x.availableAt, L.availableAt);
    const base = { setup: 'OB01', version: VERSION, side, stages, reference, notes };
    const empty = { entry: null as number | null, stop: null as number | null, target: null as number | null };
    const reject = (stage: SetupEvent['stage'], reason: string, at: number, knownAt: number, proxies = empty) => {
      const allKnown = Math.max(knownAt, L.availableAt, ...Object.values(stages).map(s => s.knownAt));
      out.push({ id: `OB01:${side}:${L.id}`, ...base, stage, reason, formationAt: at, knownAt: allKnown, proxies });
    };

    // 1. Sweep of L after it is known, with a reclaim.
    let sweep: Bar | null = null, reclaim: Bar | null = null, noReclaim = false, extreme = p, extremeAt = L.pivotAt;
    for (let i = iL + 1; i < bars.length; i++) {
      const x = bars[i];
      if (!sweep) {
        if (x.timestamp > L.availableAt + 7 * 24 * HOUR) break;
        if (end(x) + lag < L.availableAt) continue;
        if (beyond(ext(x), shift(p, -b))) { sweep = x; extreme = ext(x); extremeAt = x.timestamp; if (inside(x.close, p)) { reclaim = x; break; } }
        continue;
      }
      if (x.timestamp > sweep.timestamp + reclaimExp) { noReclaim = true; break; }
      if (beyond(ext(x), extreme)) { extreme = ext(x); extremeAt = x.timestamp; }
      if (inside(x.close, p)) { reclaim = x; break; }
    }
    if (!sweep) { reject(pending(L.availableAt + 7 * 24 * HOUR) ? 'pending_at_cutoff' : 'expired', 'no_sweep', L.pivotAt, L.availableAt); continue; }
    stages.sweep = { at: sweep.timestamp, knownAt: known(sweep), price: ext(sweep) };
    if (noReclaim) { reject('invalidated', 'sweep_no_reclaim', sweep.timestamp, known(sweep)); continue; }
    if (!reclaim) { reject(pending(sweep.timestamp + reclaimExp) ? 'pending_at_cutoff' : 'expired', 'no_reclaim', sweep.timestamp, known(sweep)); continue; }
    stages.reclaim = { at: reclaim.timestamp, knownAt: known(reclaim), price: reclaim.close };

    // 2. MSB beyond the last known interior pivot formed after L and before the sweep bar.
    const iR = index.get(reclaim.timestamp)!;
    let msb: Bar | null = null, interior: ReturnType<typeof latestPivot> = null;
    for (let i = iR; i < bars.length; i++) {
      const x = bars[i];
      if (x.timestamp > sweep.timestamp + msbExp) break;
      const cand = latestPivot(pivots, side === 1 ? 'high' : 'low', known(x), sweep.timestamp);
      const ref = cand && cand.pivotAt > L.pivotAt ? cand : null;
      if (!ref) continue;
      if (beyond(ext(x), extreme) && x.timestamp > reclaim.timestamp) { extreme = ext(x); extremeAt = x.timestamp; }
      if (inside(x.close, shift(ref.price, b))) { msb = x; interior = ref; break; }
    }
    if (!msb) {
      const anyInterior = pivots.some(q => q.kind === (side === 1 ? 'high' : 'low') && q.pivotAt > L.pivotAt && q.pivotAt < sweep.timestamp);
      reject(anyInterior ? (pending(sweep.timestamp + msbExp) ? 'pending_at_cutoff' : 'expired') : 'rejected', anyInterior ? 'no_msb' : 'no_interior_high', sweep.timestamp, stages.reclaim.knownAt); continue;
    }
    reference.interiorPivot = interior; reference.sweep = { extreme, extremeAt };
    stages.msb = { at: msb.timestamp, knownAt: Math.max(known(msb), interior!.availableAt), price: msb.close, note: `closed beyond interior ${interior!.price}` };

    // 3. Block and 4. leg / retracement.
    const iS = index.get(sweep.timestamp)!, iM = index.get(msb.timestamp)!;
    let origin: Bar | null = null;
    for (let i = iS; i < iM; i++) if (side * (bars[i].close - bars[i].open) < 0) origin = bars[i];
    if (!origin) { reject('rejected', 'no_block_candle', msb.timestamp, stages.msb.knownAt); continue; }
    const zone = { low: origin.low, high: origin.high, originAt: origin.timestamp };
    const near = side === 1 ? zone.high : zone.low, far = side === 1 ? zone.low : zone.high;
    reference.zone = zone;
    stages.block = { at: origin.timestamp, knownAt: stages.msb.knownAt, price: near, note: `[${zone.low}, ${zone.high}]` };
    const legEnd = opp(msb), legStart = extreme;
    const ote = legEnd - side * retr * Math.abs(legEnd - legStart);
    reference.leg = { start: legStart, end: legEnd, retracement: retr, ote };
    stages.ote = { at: msb.timestamp, knownAt: stages.msb.knownAt, price: ote, note: `leg ${legStart} -> ${legEnd}` };
    const knownAt = Math.max(...Object.values(stages).map(s => s.knownAt));
    const stop = shift(far, -b);
    const target = nextUntouchedPivot(ctx, pivots, side === 1 ? 'high' : 'low', side, msb.close, knownAt);
    reference.target = target; if (!target) notes.push('no_known_untouched_target');
    const oteInside = ote >= zone.low && ote <= zone.high;
    if (entryLevel === 'ote' && !oteInside) { reject('rejected', 'ote_outside_block', msb.timestamp, knownAt, { entry: ote, stop, target: target?.price ?? null }); continue; }
    notes.push(oteInside ? 'ote_inside_block' : 'ote_outside_block');
    const entry = entryLevel === 'ote' ? ote : near;
    out.push({ id: `OB01:${side}:${L.id}`, ...base, stage: 'confirmed', formationAt: msb.timestamp, knownAt, proxies: { entry, stop, target: target?.price ?? null } });
  }
  return out.sort((a, b2) => a.knownAt - b2.knownAt || a.id.localeCompare(b2.id));
}
