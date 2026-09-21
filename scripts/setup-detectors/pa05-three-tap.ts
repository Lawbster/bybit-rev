/**
 * PA05 — Three distinct visits / three-tap (library: research/setup-library/price-action.md#PA05; S29 pp16-21).
 *
 * Source: "1. Swing point forms 2. Swing point swept/deviate 3. Retest", tailored around trapping breakout traders and
 * forming a base to retest later. MSB is not a source prerequisite. The three visits must be distinct, separated by
 * departures; consecutive overlapping candles are not three taps.
 *
 * Operational v1, long (short mirrors every rule):
 *   1. Visit 1: a confirmed 1h pivot low L at price p.
 *   2. Departure: a later bar trades at least departPct above p.
 *   3. Visit 2 (sweep): the first return wicks below p by the buffer; price must close back above p within reclaimHours.
 *      The sweep extreme is the lowest low from the sweep bar to the reclaim bar. A close below that extreme afterwards
 *      invalidates the attempt.
 *   4. Second departure of at least departPct above p after the reclaim.
 *   5. Visit 3: the first later bar trading back within tolerancePct above p. Touch mode confirms when that bar closes above p;
 *      reaction mode confirms on the first later bar (within reactionHours) closing above the visit-3 bar's high.
 *   Stop proxy: buffer below the sweep extreme. Target proxy: nearest known untouched opposite pivot (may be absent).
 * Control: after the first departure, a return that touches the band and closes above p WITHOUT wicking below p is
 * emitted as a rejected `two_tap_no_sweep` row with proxies (stop buffer below p), tagged `two_tap_control`.
 */
import { H as HOUR, M, nextUntouchedPivot, type Bar, type DetectorContext, type SetupDetector, type SetupEvent, type Side, type StageMark } from '../setup-scan-core';

const VERSION = 'pa05-scan-v1';

export const pa05ThreeTap: SetupDetector = {
  id: 'PA05', version: VERSION, title: 'Three distinct visits / three-tap', family: 'range',
  aliases: ['three tap', 'three-tap', '3 tap', 'three taps', 'triple tap', 'three drive', 'pa5'],
  libraryCard: 'research/setup-library/price-action.md#PA05',
  defaults: { triggerTfMinutes: 60, pivotWidth: 3, bufferPct: 0.1, departPct: 1.5, tolerancePct: 0.3, reclaimHours: 24, visit2ExpiryHours: 168, visit3ExpiryHours: 168, reactionHours: 12, entryMode: 'touch' },
  conventions: [
    'Trigger and pivot timeframe 1h; strict pivots three bars each side, published after the third right-hand bar closes plus lag.',
    'Departure: a bar trading at least 1.5% away from the level on the held side, required both before the sweep and before the third visit, so the three visits are distinct.',
    'Visit 2 (sweep): the first return after the departure that wicks 0.1% through the level; a close back on the held side within 24h is required (a wick only), otherwise the attempt is invalidated as sweep_no_reclaim. The sweep extreme is tracked to the reclaim bar; a later close beyond it invalidates.',
    'Visit 3: the first bar after the second departure trading within 0.3% of the level on the held side; a wick 0.1% through the sweep extreme on that bar invalidates. Touch mode confirms on that bar closing on the held side (a close through the level is rejected); reaction mode confirms on the first later bar within 12h closing beyond the visit-3 bar extreme.',
    'Expiry clocks: sweep within 7 days of the pivot, third visit within 7 days of the reclaim. Declared limits, not source rules.',
    'Stop proxy: 0.1% beyond the sweep extreme. Target proxy: nearest known opposite pivot ahead that has not been traded through since it became available; may be absent.',
    'Two-tap control: after the first departure, a return that reaches the band and holds without wicking through the level ends the attempt as a rejected two_tap_no_sweep row with proxies (stop 0.1% beyond the level).',
    'Known-at of each stage is the maximum of the bar availability and the pivot publication; nothing is backdated. No MSB requirement is invented.',
  ],
  warmupMs: 14 * 24 * HOUR,
  detect(ctx) { return detectThreeTaps(ctx); },
};

export function detectThreeTaps(ctx: DetectorContext): SetupEvent[] {
  const num = (k: string) => Number(ctx.params[k]);
  const ttf = num('triggerTfMinutes') * M, width = num('pivotWidth'), b = num('bufferPct') / 100, dep = num('departPct') / 100, tol = num('tolerancePct') / 100;
  const reclaimExp = num('reclaimHours') * HOUR, v2Exp = num('visit2ExpiryHours') * HOUR, v3Exp = num('visit3ExpiryHours') * HOUR, reactExp = num('reactionHours') * HOUR;
  const entryMode = String(ctx.params.entryMode ?? 'touch');
  if (entryMode !== 'touch' && entryMode !== 'reaction') throw new Error(`PA05 entryMode must be touch or reaction, got ${entryMode}`);
  const bars = ctx.bars(ttf), pivots = ctx.pivots(ttf, width), lag = ctx.lagMs;
  const out: SetupEvent[] = [];
  const index = new Map<number, number>(); bars.forEach((x, i) => index.set(x.timestamp, i));
  const end = (x: Bar) => x.timestamp + ttf;
  const pending = (deadline: number) => ctx.cutoff < deadline;

  for (const L of pivots) {
    const side: Side = L.kind === 'low' ? 1 : -1; const p = L.price;
    const ext = (x: Bar) => (side === 1 ? x.low : x.high);
    const opp = (x: Bar) => (side === 1 ? x.high : x.low);
    const inside = (v: number, ref: number) => side * (v - ref) > 0;   // v on the held side of ref
    const beyond = (v: number, ref: number) => side * (ref - v) > 0;   // v through ref on the sweep side
    const shift = (v: number, k: number) => v * (1 + side * k);
    const touches = (x: Bar) => (side === 1 ? x.low <= p * (1 + tol) : x.high >= p * (1 - tol));
    const iL = index.get(L.pivotAt); if (iL === undefined) continue;
    const stages: Record<string, StageMark> = { level: { at: L.pivotAt, knownAt: L.availableAt, price: p } };
    const notes: string[] = []; const reference: Record<string, unknown> = { pivot: L };
    const known = (x: Bar) => Math.max(end(x) + lag, x.availableAt, L.availableAt);
    const base = { setup: 'PA05', version: VERSION, side, stages, reference, notes };
    const empty = { entry: null as number | null, stop: null as number | null, target: null as number | null };
    const reject = (stage: SetupEvent['stage'], reason: string, at: number, knownAt: number, proxies = empty) => {
      const allKnown = Math.max(knownAt, L.availableAt, ...Object.values(stages).map(s => s.knownAt));
      out.push({ id: `PA05:${side}:${L.id}`, ...base, stage, reason, formationAt: at, knownAt: allKnown, proxies });
    };
    const targetFor = (ref: number, knownAt: number) => nextUntouchedPivot(ctx, pivots, side === 1 ? 'high' : 'low', side, ref, knownAt);

    let depart1: Bar | null = null, sweep: Bar | null = null, reclaim: Bar | null = null, depart2: Bar | null = null, third: Bar | null = null;
    let twoTap: Bar | null = null, broke: Bar | null = null, noReclaim = false, extreme = p, extremeAt = L.pivotAt;
    for (let i = iL + 1; i < bars.length; i++) {
      const x = bars[i];
      if (!sweep) {
        if (x.timestamp > L.pivotAt + v2Exp) break;
        if (!depart1) { if (inside(opp(x), shift(p, dep))) depart1 = x; continue; }
        if (beyond(ext(x), shift(p, -b))) { sweep = x; extreme = ext(x); extremeAt = x.timestamp; if (inside(x.close, p)) { reclaim = x; if (inside(opp(x), shift(p, dep))) depart2 = x; } continue; }
        if (touches(x)) { twoTap = x; break; }
        continue;
      }
      if (!reclaim) {
        if (x.timestamp > sweep.timestamp + reclaimExp) { noReclaim = true; break; }
        if (beyond(ext(x), extreme)) { extreme = ext(x); extremeAt = x.timestamp; }
        if (inside(x.close, p)) { reclaim = x; if (inside(opp(x), shift(p, dep))) depart2 = x; }
        continue;
      }
      if (x.timestamp > reclaim.timestamp + v3Exp) break;
      if (beyond(x.close, extreme)) { broke = x; break; }
      if (!depart2) { if (inside(opp(x), shift(p, dep))) depart2 = x; continue; }
      if (!touches(x)) continue;
      if (beyond(ext(x), shift(extreme, -b))) { broke = x; break; }
      third = x; break;
    }
    if (depart1) stages.depart = { at: depart1.timestamp, knownAt: known(depart1), price: opp(depart1) };
    if (twoTap) {
      stages.return = { at: twoTap.timestamp, knownAt: known(twoTap), price: ext(twoTap), note: 'touched the band without a sweep' };
      const held = inside(twoTap.close, p);
      if (!held) { reject('rejected', 'return_closed_through_level', twoTap.timestamp, known(twoTap)); continue; }
      notes.push('two_tap_control');
      const knownAt = known(twoTap); const target = targetFor(twoTap.close, knownAt); reference.target = target; if (!target) notes.push('no_known_untouched_target');
      reject('rejected', 'two_tap_no_sweep', twoTap.timestamp, knownAt, { entry: null, stop: shift(p, -b), target: target?.price ?? null }); continue;
    }
    if (!depart1) { reject(pending(L.pivotAt + v2Exp) ? 'pending_at_cutoff' : 'expired', 'no_departure', L.pivotAt, L.availableAt); continue; }
    if (!sweep) { reject(pending(L.pivotAt + v2Exp) ? 'pending_at_cutoff' : 'expired', 'no_return', depart1.timestamp, known(depart1)); continue; }
    stages.sweep = { at: sweep.timestamp, knownAt: known(sweep), price: ext(sweep) };
    if (noReclaim || !reclaim) { if (noReclaim) reject('invalidated', 'sweep_no_reclaim', sweep.timestamp, known(sweep)); else reject(pending(sweep.timestamp + reclaimExp) ? 'pending_at_cutoff' : 'expired', 'no_reclaim', sweep.timestamp, known(sweep)); continue; }
    stages.reclaim = { at: reclaim.timestamp, knownAt: known(reclaim), price: reclaim.close, note: `extreme ${extreme}` };
    reference.sweep = { extreme, extremeAt };
    if (broke) { stages.broke = { at: broke.timestamp, knownAt: known(broke), price: ext(broke) }; reject('invalidated', 'broke_sweep_extreme', broke.timestamp, known(broke)); continue; }
    if (!depart2) { reject(pending(reclaim.timestamp + v3Exp) ? 'pending_at_cutoff' : 'expired', 'no_second_departure', reclaim.timestamp, known(reclaim)); continue; }
    stages.depart2 = { at: depart2.timestamp, knownAt: known(depart2), price: opp(depart2) };
    if (!third) { reject(pending(reclaim.timestamp + v3Exp) ? 'pending_at_cutoff' : 'expired', 'no_third_visit', depart2.timestamp, known(depart2)); continue; }
    stages.third = { at: third.timestamp, knownAt: known(third), price: ext(third), note: inside(third.close, p) ? 'closed on the held side' : 'closed through the level' };
    const stop = shift(extreme, -b);
    const finish = (stage: SetupEvent['stage'], reason: string | undefined, bar: Bar, ref: number) => {
      const knownAt = Math.max(...Object.values(stages).map(s => s.knownAt));
      const target = targetFor(ref, knownAt); reference.target = target; if (!target) notes.push('no_known_untouched_target');
      out.push({ id: `PA05:${side}:${L.id}`, ...base, stage, reason, formationAt: bar.timestamp, knownAt, proxies: { entry: null, stop, target: target?.price ?? null } });
    };
    if (!inside(third.close, p)) { finish('rejected', 'third_visit_closed_through_level', third, third.close); continue; }
    if (entryMode === 'touch') { finish('confirmed', undefined, third, third.close); continue; }
    // Reaction mode: first later bar closing beyond the visit-3 bar's extreme on the held side.
    const i3 = index.get(third.timestamp)!; let reaction: Bar | null = null, failed: Bar | null = null;
    for (let i = i3 + 1; i < bars.length; i++) {
      const x = bars[i];
      if (x.timestamp > third.timestamp + reactExp) break;
      if (beyond(x.close, extreme)) { failed = x; break; }
      if (inside(x.close, opp(third))) { reaction = x; break; }
    }
    if (failed) { stages.broke = { at: failed.timestamp, knownAt: known(failed), price: failed.close }; reject('invalidated', 'broke_sweep_extreme', failed.timestamp, known(failed), { entry: null, stop, target: null }); continue; }
    if (!reaction) { reject(pending(third.timestamp + reactExp) ? 'pending_at_cutoff' : 'expired', 'no_reaction', third.timestamp, known(third), { entry: null, stop, target: null }); continue; }
    stages.reaction = { at: reaction.timestamp, knownAt: known(reaction), price: reaction.close };
    finish('confirmed', undefined, reaction, reaction.close);
  }
  return out.sort((a, b2) => a.knownAt - b2.knownAt || a.id.localeCompare(b2.id));
}
