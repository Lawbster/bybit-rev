/**
 * PA02 — Confirmed failed-zone breaker (library: research/setup-library/price-action.md#PA02).
 *
 * Bullish breaker (long), operational v1:
 *   1. Context pivot high P (4h, strict, width 2) with the prior known pivot low Q below it.
 *   2. Origin zone = the last up-close trigger bar inside P's context bar (supply that produced the drop).
 *   3. Sweep: a later trigger bar trades below Q by the buffer (liquidity below the range taken).
 *   4. Fail: a later trigger bar closes above the zone's far edge (the supply zone fails).
 *   5. HH: a trigger bar closes above P (structural higher high, closing-basis convention).
 *   6. Retest: the first later trigger bar that trades back into the flipped zone and closes on the held side.
 * Short mirror: pivot low P, prior high Q, last down-close bar in P's bar, sweep above Q, fail below the
 * zone, LL below P, retest into the zone from below.
 *
 * One attempt per context pivot and side. Every attempt is emitted with the stage it reached.
 * A completed fail/HH/retest sequence WITHOUT the prior sweep is emitted as rejected with reason
 * `no_sweep_before_fail`; those rows are the generic failed-zone control the library asks to keep separate.
 */
import { H, M, latestPivot, nextUntouchedPivot, type DetectorContext, type SetupDetector, type SetupEvent, type Side, type StageMark, type Bar } from '../setup-scan-core';

const VERSION = 'pa02-scan-v1';

export const pa02Breaker: SetupDetector = {
  id: 'PA02', version: VERSION, title: 'Confirmed failed-zone breaker', family: 'breaker',
  aliases: ['breaker', 'rf breaker', 'rektproof breaker', 'failed zone breaker', 'failed orderblock', 'failed ob', 'breaker block', 'pa2'],
  libraryCard: 'research/setup-library/price-action.md#PA02',
  defaults: { contextTfMinutes: 240, triggerTfMinutes: 60, pivotWidth: 2, bufferPct: 0.1, sweepExpiryHours: 168, failExpiryHours: 168, retestExpiryHours: 72 },
  conventions: [
    'Context pivots: strict 4h swings, two bars each side, published after the second right-hand bar closes plus lag; ties are not extremes.',
    'Origin zone: full wick of the last opposite-colour 1h candle inside the context pivot bar; immutable once published; not a body-only or multi-candle base.',
    'Sweep: a 1h wick beyond the prior opposite context pivot by 0.1%, after the zone is known; a close is not required (wick sweep).',
    'Zone failure: a 1h close beyond the zone far edge by 0.1%. Structural HH/LL: a 1h close beyond the context pivot by 0.1% (closing-basis is our conservative convention; the source says a new high must print).',
    'Retest: first later 1h bar that trades into the flipped zone; confirmed only when that bar closes back out of the zone through the edge it entered; a close inside the zone is rejected (retest_closed_inside_zone); a wick through the opposite edge by 0.1% invalidates.',
    'Expiry clocks: sweep within 7 days of the context bar close, fail and HH within 7 days of the sweep, retest within 72h of the HH bar. These are declared operational limits, not source rules.',
    'Stop proxy: 0.1% beyond the far edge of the flipped zone. Target proxy: nearest known context pivot ahead that has not been traded through since it became available; may be absent.',
    'Known-at of each stage is the maximum of every referenced availability (bar end + lag, pivot publication). Nothing is backdated.',
  ],
  warmupMs: 21 * 24 * H,
  detect(ctx) { return detectBreakers(ctx); },
};

const num = (ctx: DetectorContext, k: string) => Number(ctx.params[k]);

export function detectBreakers(ctx: DetectorContext): SetupEvent[] {
  const ctf = num(ctx, 'contextTfMinutes') * M, ttf = num(ctx, 'triggerTfMinutes') * M, width = num(ctx, 'pivotWidth');
  const b = num(ctx, 'bufferPct') / 100, sweepExp = num(ctx, 'sweepExpiryHours') * H, failExp = num(ctx, 'failExpiryHours') * H, retestExp = num(ctx, 'retestExpiryHours') * H;
  const pivots = ctx.pivots(ctf, width), bars = ctx.bars(ttf), lag = ctx.lagMs;
  const out: SetupEvent[] = [];
  const firstBarAt = (t: number) => { let lo = 0, hi = bars.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (bars[mid].timestamp < t) lo = mid + 1; else hi = mid; } return lo; };
  const end = (x: Bar) => x.timestamp + ttf;
  let contextKnownAt = 0;
  // A stage of a breaker is knowable only once the bar is available AND the context pivot that defines the zone is published.
  const known = (x: Bar) => Math.max(end(x) + lag, x.availableAt, contextKnownAt);

  for (const P of pivots) {
    contextKnownAt = P.availableAt;
    const side: Side = P.kind === 'high' ? 1 : -1;
    const Q = latestPivot(pivots, side === 1 ? 'low' : 'high', P.availableAt, P.pivotAt);
    const stages: Record<string, StageMark> = { context: { at: P.pivotAt, knownAt: P.availableAt, price: P.price } };
    const notes: string[] = [];
    const reference: Record<string, unknown> = { contextPivot: P, priorPivot: Q };
    const base = { setup: 'PA02', version: VERSION, side, stages, reference, notes };
    const reject = (stage: SetupEvent['stage'], reason: string, at: number, knownAt: number, proxies = { entry: null as number | null, stop: null as number | null, target: null as number | null }) => {
      // A terminated attempt is known only once every recorded stage is known (stages can occur out of the ideal order).
      const allKnown = Math.max(knownAt, P.availableAt, ...Object.values(stages).map(s => s.knownAt));
      out.push({ id: `PA02:${side}:${P.id}`, ...base, stage, reason, formationAt: at, knownAt: allKnown, proxies });
    };
    if (!Q || side * (P.price - Q.price) <= 0) { reject('rejected', 'no_prior_opposite_swing', P.pivotAt, P.availableAt); continue; }
    // Origin zone: last opposite-colour trigger bar inside the context pivot bar.
    const i0 = firstBarAt(P.pivotAt);
    let origin: Bar | null = null;
    for (let i = i0; i < bars.length && bars[i].timestamp < P.pivotAt + ctf; i++) if (side * (bars[i].close - bars[i].open) > 0) origin = bars[i];
    if (!origin) { reject('rejected', 'no_origin_candle', P.pivotAt, P.availableAt); continue; }
    const zone = { low: origin.low, high: origin.high, originAt: origin.timestamp };
    const far = side === 1 ? zone.high : zone.low, near = side === 1 ? zone.low : zone.high;
    reference.zone = zone;
    stages.zone = { at: origin.timestamp, knownAt: P.availableAt, price: far, note: `[${zone.low}, ${zone.high}]` };
    // Sweep search starts after the context bar closes (nothing inside the context bar is a later event).
    const scanFrom = firstBarAt(P.pivotAt + ctf);
    let sweep: Bar | null = null, fail: Bar | null = null, hh: Bar | null = null, retest: Bar | null = null, through: Bar | null = null;
    const sweepDeadline = P.pivotAt + ctf + sweepExp;
    for (let i = scanFrom; i < bars.length; i++) {
      const x = bars[i];
      if (!sweep && x.timestamp < sweepDeadline && (side === 1 ? x.low <= Q.price * (1 - b) : x.high >= Q.price * (1 + b))) sweep = x;
      if (!fail && (side === 1 ? x.close > far * (1 + b) : x.close < far * (1 - b))) fail = x;
      if (fail && !hh && (side === 1 ? x.close > P.price * (1 + b) : x.close < P.price * (1 - b))) hh = x;
      if (sweep && fail && end(x) > end(sweep) + failExp && !hh) break;
      if (!sweep && !fail && x.timestamp >= sweepDeadline) break;
      if (hh) {
        if (x.timestamp <= hh.timestamp) continue;
        if (end(x) > end(hh) + retestExp) break;
        const touched = side === 1 ? x.low <= far : x.high >= far;
        if (!touched) continue;
        const wentThrough = side === 1 ? x.low < near * (1 - b) : x.high > near * (1 + b);
        if (wentThrough) { through = x; break; }
        retest = x; break;
      }
    }
    if (sweep) stages.sweep = { at: sweep.timestamp, knownAt: Math.max(known(sweep), Q.availableAt), price: side === 1 ? sweep.low : sweep.high };
    if (fail) stages.fail = { at: fail.timestamp, knownAt: known(fail), price: fail.close };
    if (hh) stages.structure = { at: hh.timestamp, knownAt: known(hh), price: hh.close };
    const cutoffPending = (lastAt: number) => ctx.cutoff < lastAt;
    if (!fail) {
      if (!sweep) { reject(cutoffPending(sweepDeadline) ? 'pending_at_cutoff' : 'expired', 'no_sweep', P.pivotAt + ctf, P.availableAt); continue; }
      reject(cutoffPending(end(sweep) + failExp) ? 'pending_at_cutoff' : 'expired', 'no_fail', sweep.timestamp, stages.sweep.knownAt); continue;
    }
    if (!hh) { reject(cutoffPending(end(sweep ?? fail) + failExp) ? 'pending_at_cutoff' : 'expired', 'no_structure_break', fail.timestamp, stages.fail.knownAt); continue; }
    if (through) {
      stages.retest = { at: through.timestamp, knownAt: known(through), price: side === 1 ? through.low : through.high, note: 'traded through far edge' };
      reject('invalidated', 'retest_through_zone', through.timestamp, stages.retest.knownAt); continue;
    }
    if (!retest) { reject(cutoffPending(end(hh) + retestExp) ? 'pending_at_cutoff' : 'expired', 'no_retest', hh.timestamp, stages.structure.knownAt); continue; }
    // Confirmed only when the retest bar closes back out of the zone through the edge it entered (PA07's near-edge rule);
    // a close inside the zone is an unresolved touch and is rejected, not confirmed.
    const held = side === 1 ? retest.close > far : retest.close < far;
    stages.retest = { at: retest.timestamp, knownAt: known(retest), price: retest.close, note: held ? 'closed back out of the zone' : 'closed inside zone' };
    const knownAt = Math.max(...Object.values(stages).map(s => s.knownAt));
    const stop = side === 1 ? near * (1 - b) : near * (1 + b);
    const target = nextUntouchedPivot(ctx, pivots, side === 1 ? 'high' : 'low', side, retest.close, knownAt);
    if (!target) notes.push('no_known_untouched_target');
    reference.target = target;
    const sweepBeforeFail = !!sweep && sweep.timestamp < fail.timestamp;
    if (!sweepBeforeFail) notes.push('generic_failed_zone_control');
    out.push({ id: `PA02:${side}:${P.id}`, ...base, stage: sweepBeforeFail && held ? 'confirmed' : 'rejected', reason: !sweepBeforeFail ? 'no_sweep_before_fail' : !held ? 'retest_closed_inside_zone' : undefined,
      formationAt: retest.timestamp, knownAt, proxies: { entry: null, stop, target: target?.price ?? null } });
  }
  return out.sort((a, b) => a.knownAt - b.knownAt || a.id.localeCompare(b.id));
}
