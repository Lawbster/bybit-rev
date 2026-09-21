/**
 * RS01 — Range reversal after exhaustion.
 *
 * Source: Rektproof "Price action Concepts / Reversal Setup" infographic, published 2026-09-15 with the ETHUSDT
 * 30m gameplan (X status 2100054415172620757; copy in research/filedump/ethreversalsetup.png). Its six rules:
 *   1. Price exhausts on a downtrend and forms a range.        2. As long as the range low is untapped we look for reversal.
 *   3. FVG on the way to the untapped low confirms upside.      4. Fib 1.618 is usually well respected as the downside target.
 *   5. MSB back into the range for confirmation forms demand.   6. New highs (target new highs as long as the price took the low).
 * Library family: PA01 (range sweep, structure break, origin retest). This is the first source text that anchors the
 * range explicitly: 0 at the swing high that forms after the exhaustion low, 1 at the untapped low.
 *
 * Operational v1 (long as drawn; short is a declared mirror):
 *   L  = confirmed trigger-tf pivot low that is the lowest low of the preceding lookback ("exhaustion").
 *   H  = first later confirmed pivot high at least minRangePct above L, within maxRangeHours, with L untapped meanwhile.
 *   FVG = a bearish three-bar gap (bar[i-2].low > bar[i].high) on the way down from H, up to and including the sweep bar.
 *   Sweep = first bar after H's bar trading below L by the buffer. The extreme is tracked until the MSB.
 *   MSB = first later bar closing back above L (buffer) AND above the highest high printed since the sweep bar.
 *   Demand = last down-close bar before the MSB bar, full wick, published with the MSB.
 *   Entry = first later bar trading into the demand box that closes back above it (entryMode=retest), or the MSB close (entryMode=msb).
 *   Stop proxy = buffer below the sweep extreme. Target proxy = buffer above H ("new highs").
 * The 1.618 extension (L - 0.618 * (H - L)) is recorded as reached or not; it is not a requirement.
 * Sequences completed without the FVG are emitted as rejected `no_fvg` rows with proxies (the FVG control).
 */
import { H as HOUR, M, type Bar, type DetectorContext, type Pivot, type SetupDetector, type SetupEvent, type Side, type StageMark } from '../setup-scan-core';

const VERSION = 'rs01-scan-v1';

export const rs01Reversal: SetupDetector = {
  id: 'RS01', version: VERSION, title: 'Range reversal after exhaustion (Rektproof reversal setup, 2026-09-15)', family: 'range',
  aliases: ['reversal setup', 'reversal', 'range reversal', 'rektproof reversal', 'exhaustion reversal', 'sweep msb demand', 'rs1'],
  libraryCard: 'research/setup-library/price-action.md#PA01',
  defaults: { triggerTfMinutes: 60, pivotWidth: 3, bufferPct: 0.1, exhaustionLookbackHours: 48, minRangePct: 2, maxRangeHours: 168, requireFvg: 1, sweepExpiryHours: 168, msbExpiryHours: 72, retestExpiryHours: 72, entryMode: 'retest' },
  conventions: [
    'Trigger and pivot timeframe 1h; strict pivots three bars each side, published after the third right-hand bar closes plus lag. The source charts are 30m/1h; 30m is a parameter, not tested.',
    'Exhaustion low L: the pivot low must be the lowest low of the preceding 48h of bars (a downtrend-exhaustion proxy, not a trend classifier). Attempts without 48h of history are rejected.',
    'Range high H: the first later confirmed pivot high at least 2% above L within 7 days, with no bar trading 0.1% below L in between. Range = [L, H]; the range is known when both pivots are published. A close 0.1% above H before any sweep ends the attempt (range_resolved_up).',
    'FVG: conventional three-bar gap on the trigger timeframe (bar[i-2].low > bar[i].high for a long), any bar from H\'s bar to the sweep bar inclusive. Required by default; completed sequences without one are emitted as rejected no_fvg rows carrying proxies (the control).',
    'Sweep: a wick 0.1% below L after H\'s bar, within 7 days of H. The sweep extreme is the lowest low from the sweep bar to the MSB bar. Fib 1.618 = L - 0.618 * (H - L); reached or not is recorded as a note, never required.',
    'MSB: the first bar after the sweep bar that closes 0.1% above L and above the highest high printed since the sweep bar (a minimal local structure shift back into the range), within 72h of the sweep bar.',
    'Demand: the last down-close bar at or after the sweep bar and before the MSB bar, full wick, immutable, published with the MSB.',
    'Entry (retest mode): first later bar that trades into the demand box and closes back above its near edge within 72h of the MSB; a close inside is rejected, a wick 0.1% through the far edge invalidates, a close above H before the retest is rejected as new_high_before_entry. Entry (msb mode): the MSB close.',
    'Stop proxy: 0.1% below the sweep extreme. Target proxy: 0.1% above H (new highs). Known-at of every stage is the maximum of the bar availability and the range publication; nothing is backdated.',
    'Short side mirrors every rule (exhaustion high, range low, bullish gap, sweep above, MSB back below, supply, target below the range low) as a proposed symmetry the source does not draw.',
  ],
  warmupMs: 14 * 24 * HOUR,
  detect(ctx) { return detectReversals(ctx); },
};

export function detectReversals(ctx: DetectorContext): SetupEvent[] {
  const num = (k: string) => Number(ctx.params[k]);
  const ttf = num('triggerTfMinutes') * M, width = num('pivotWidth'), b = num('bufferPct') / 100;
  const lookback = num('exhaustionLookbackHours') * HOUR, minRange = num('minRangePct') / 100, maxRange = num('maxRangeHours') * HOUR;
  const requireFvg = num('requireFvg') !== 0;
  const sweepExp = num('sweepExpiryHours') * HOUR, msbExp = num('msbExpiryHours') * HOUR, retestExp = num('retestExpiryHours') * HOUR;
  const entryMode = String(ctx.params.entryMode ?? 'retest');
  if (entryMode !== 'retest' && entryMode !== 'msb') throw new Error(`RS01 entryMode must be retest or msb, got ${entryMode}`);
  const bars = ctx.bars(ttf), pivots = ctx.pivots(ttf, width), lag = ctx.lagMs;
  const out: SetupEvent[] = [];
  const index = new Map<number, number>(); bars.forEach((x, i) => index.set(x.timestamp, i));
  const end = (x: Bar) => x.timestamp + ttf;
  const pending = (deadline: number) => ctx.cutoff < deadline;

  for (const L of pivots) {
    const side: Side = L.kind === 'low' ? 1 : -1;
    const ext = (x: Bar) => (side === 1 ? x.low : x.high);          // the side that gets swept
    const opp = (x: Bar) => (side === 1 ? x.high : x.low);          // the range side
    const inside = (p: number, ref: number) => side * (p - ref) > 0; // p is on the range side of ref (above ref for a long)
    const beyond = (p: number, ref: number) => side * (ref - p) > 0; // p is beyond ref on the sweep side (below ref for a long)
    const shift = (p: number, k: number) => p * (1 + side * k);      // move a price k toward the range side (up for a long)
    const iL = index.get(L.pivotAt); if (iL === undefined) continue;
    const stages: Record<string, StageMark> = { low: { at: L.pivotAt, knownAt: L.availableAt, price: L.price } };
    const notes: string[] = [];
    const reference: Record<string, unknown> = { exhaustionPivot: L };
    let rangeKnownAt = L.availableAt;
    const known = (x: Bar) => Math.max(end(x) + lag, x.availableAt, rangeKnownAt);
    const base = { setup: 'RS01', version: VERSION, side, stages, reference, notes };
    const empty = { entry: null as number | null, stop: null as number | null, target: null as number | null };
    const reject = (stage: SetupEvent['stage'], reason: string, at: number, knownAt: number, proxies = empty) => {
      const allKnown = Math.max(knownAt, rangeKnownAt, ...Object.values(stages).map(s => s.knownAt));
      out.push({ id: `RS01:${side}:${L.id}`, ...base, stage, reason, formationAt: at, knownAt: allKnown, proxies });
    };

    // 1. Exhaustion: L is the extreme of the preceding lookback, and that lookback exists on the tape.
    let j = iL - 1, seen = 0, deeper = false;
    for (; j >= 0 && bars[j].timestamp >= L.pivotAt - lookback; j--) { seen++; if (beyond(ext(bars[j]), L.price) || ext(bars[j]) === L.price) deeper = true; }
    if (seen < Math.floor(lookback / ttf) * 0.9) { reject('rejected', 'insufficient_history', L.pivotAt, L.availableAt); continue; }
    if (deeper) { reject('rejected', 'not_exhaustion_extreme', L.pivotAt, L.availableAt); continue; }

    // 2. Range high: first later confirmed opposite pivot with the minimum height, L untapped meanwhile.
    let Hp: Pivot | null = null, tapped: Bar | null = null;
    for (const p of pivots) {
      if (p.kind === L.kind || p.pivotAt <= L.pivotAt) continue;
      if (p.pivotAt > L.pivotAt + maxRange) break;
      if (Math.abs(p.price - L.price) / L.price < minRange) continue;
      const iH = index.get(p.pivotAt)!;
      for (let i = iL + 1; i < iH; i++) if (beyond(ext(bars[i]), shift(L.price, -b))) { tapped = bars[i]; break; }
      Hp = p; break;
    }
    if (tapped) { stages.tap = { at: tapped.timestamp, knownAt: known(tapped), price: ext(tapped) }; reject('rejected', 'low_tapped_before_range_high', tapped.timestamp, known(tapped)); continue; }
    if (!Hp) { reject(pending(L.pivotAt + maxRange) ? 'pending_at_cutoff' : 'expired', 'no_range_high', L.pivotAt, L.availableAt); continue; }
    rangeKnownAt = Math.max(L.availableAt, Hp.availableAt);
    const height = Math.abs(Hp.price - L.price);
    const fib1618 = L.price - side * 0.618 * height;
    stages.high = { at: Hp.pivotAt, knownAt: Hp.availableAt, price: Hp.price, note: `range ${(height / L.price * 100).toFixed(2)}%` };
    reference.rangePivot = Hp; reference.range = { low: Math.min(L.price, Hp.price), high: Math.max(L.price, Hp.price), fib1618 };
    const iH = index.get(Hp.pivotAt)!;

    // 3-5. Walk forward from the bar after H: FVG, sweep, extreme, MSB.
    let fvg: { bar: Bar; size: number } | null = null, sweep: Bar | null = null, msb: Bar | null = null, resolved: Bar | null = null;
    let extreme = L.price, extremeAt = L.pivotAt, localOpp = 0;
    for (let i = iH + 1; i < bars.length; i++) {
      const x = bars[i];
      if (!sweep) {
        if (x.timestamp > Hp.pivotAt + sweepExp) break;
        if (!fvg && i - 2 >= iH) { const a = bars[i - 2]; const gap = side === 1 ? a.low - x.high : x.low - a.high; if (gap > 0) fvg = { bar: x, size: gap / L.price }; }
        if (inside(x.close, shift(Hp.price, b))) { resolved = x; break; }
        if (beyond(ext(x), shift(L.price, -b))) { sweep = x; extreme = ext(x); extremeAt = x.timestamp; localOpp = opp(x); }
        continue;
      }
      if (x.timestamp > sweep.timestamp + msbExp) break;
      if (inside(x.close, shift(L.price, b)) && inside(x.close, localOpp)) { msb = x; break; }
      if (beyond(ext(x), extreme)) { extreme = ext(x); extremeAt = x.timestamp; }
      localOpp = side === 1 ? Math.max(localOpp, x.high) : Math.min(localOpp, x.low);
    }
    if (fvg) stages.fvg = { at: fvg.bar.timestamp, knownAt: known(fvg.bar), price: side === 1 ? fvg.bar.high : fvg.bar.low, note: `gap ${(fvg.size * 100).toFixed(2)}%` };
    if (resolved) { stages.resolved = { at: resolved.timestamp, knownAt: known(resolved), price: resolved.close }; reject('rejected', 'range_resolved_up', resolved.timestamp, known(resolved)); continue; }
    if (!sweep) { reject(pending(Hp.pivotAt + sweepExp) ? 'pending_at_cutoff' : 'expired', 'no_sweep', Hp.pivotAt, rangeKnownAt); continue; }
    stages.sweep = { at: sweep.timestamp, knownAt: known(sweep), price: ext(sweep) };
    if (!msb) { reject(pending(sweep.timestamp + msbExp) ? 'pending_at_cutoff' : 'expired', 'no_msb', sweep.timestamp, stages.sweep.knownAt); continue; }
    const fibReached = side === 1 ? extreme <= fib1618 : extreme >= fib1618;
    notes.push(fibReached ? 'fib_1618_reached' : 'fib_1618_not_reached');
    reference.sweep = { extreme, extremeAt, depthFrac: Math.abs(L.price - extreme) / height, fibReached };
    stages.msb = { at: msb.timestamp, knownAt: known(msb), price: msb.close, note: `closed back ${side === 1 ? 'above' : 'below'} ${L.price}` };
    const iS = index.get(sweep.timestamp)!, iM = index.get(msb.timestamp)!;
    let origin: Bar | null = null;
    for (let i = iS; i < iM; i++) if (side * (bars[i].close - bars[i].open) < 0) origin = bars[i];
    if (!origin) { reject('rejected', 'no_demand_candle', msb.timestamp, stages.msb.knownAt); continue; }
    const zone = { low: origin.low, high: origin.high, originAt: origin.timestamp };
    const near = side === 1 ? zone.high : zone.low, far = side === 1 ? zone.low : zone.high;
    reference.zone = zone;
    stages.demand = { at: origin.timestamp, knownAt: known(msb), price: near, note: `[${zone.low}, ${zone.high}]` };
    const stop = shift(extreme, -b), target = shift(Hp.price, b);
    const fvgOk = !!fvg || !requireFvg;
    if (!fvg) notes.push(requireFvg ? 'no_fvg_control' : 'no_fvg');
    const finish = (stage: SetupEvent['stage'], reason: string | undefined, at: number) => {
      const knownAt = Math.max(...Object.values(stages).map(s => s.knownAt));
      out.push({ id: `RS01:${side}:${L.id}`, ...base, stage, reason, formationAt: at, knownAt, proxies: { entry: null, stop, target } });
    };
    if (entryMode === 'msb') { finish(fvgOk ? 'confirmed' : 'rejected', fvgOk ? undefined : 'no_fvg', msb.timestamp); continue; }

    // 6. Retest of the demand box.
    let retest: Bar | null = null, through: Bar | null = null, newHigh: Bar | null = null;
    for (let i = iM + 1; i < bars.length; i++) {
      const x = bars[i];
      if (x.timestamp > msb.timestamp + retestExp) break;
      if (inside(x.close, shift(Hp.price, b))) { newHigh = x; break; }
      const touched = side === 1 ? x.low <= near : x.high >= near;
      if (!touched) continue;
      if (side === 1 ? x.low < far * (1 - b) : x.high > far * (1 + b)) { through = x; break; }
      retest = x; break;
    }
    if (newHigh) { stages.newHigh = { at: newHigh.timestamp, knownAt: known(newHigh), price: newHigh.close }; reject('rejected', 'new_high_before_entry', newHigh.timestamp, known(newHigh), { entry: null, stop, target }); continue; }
    if (through) { stages.retest = { at: through.timestamp, knownAt: known(through), price: ext(through), note: 'traded through far edge' }; reject('invalidated', 'retest_through_zone', through.timestamp, known(through), { entry: null, stop, target }); continue; }
    if (!retest) { reject(pending(msb.timestamp + retestExp) ? 'pending_at_cutoff' : 'expired', 'no_retest', msb.timestamp, stages.msb.knownAt, { entry: null, stop, target }); continue; }
    const held = side === 1 ? retest.close > near : retest.close < near;
    stages.retest = { at: retest.timestamp, knownAt: known(retest), price: retest.close, note: held ? 'closed back out of the zone' : 'closed inside zone' };
    if (!held) { finish('rejected', 'retest_closed_inside_zone', retest.timestamp); continue; }
    finish(fvgOk ? 'confirmed' : 'rejected', fvgOk ? undefined : 'no_fvg', retest.timestamp);
  }
  return out.sort((a, b2) => a.knownAt - b2.knownAt || a.id.localeCompare(b2.id));
}
