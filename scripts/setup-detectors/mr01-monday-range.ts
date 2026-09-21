/**
 * MR01 — Monday-range raid (library: research/setup-library/context.md#CTX02; source D9 pp1-5).
 *
 * Source: wait for Monday's close; use this week's Monday high and low (and the previous week's untapped Monday
 * extremes, not older); the author avoids trading on Monday itself. The H1 breaker bonus, labelled hindsight by the
 * author: Monday-high raid -> new-low MSB -> breaker retest -> Monday-low target. The lesson calls this context, not
 * a trading method, and gives no session timezone.
 *
 * Operational v1 (long = raid of the range low; short mirrors the range high):
 *   Range: the calendar day `rangeDay` (1 = Monday) in UTC, [00:00, 24:00); its high/low are known once its last 1h bar is
 *          available; usable from the next 00:00 until the same weekday next week. Incomplete days are rejected.
 *   Raid: a 1h wick 0.1% through the range extreme after the range is usable; a close back inside within reclaimHours.
 *   MSB: the first later bar closing back inside the range AND beyond every opposite extreme printed since the raid bar.
 *   Zone: the last bar closing against the trade direction at or after the raid bar and before the MSB bar, full wick.
 *   Entry: retest mode = first later bar into the zone that closes back out of it; msb mode = the MSB close.
 *   Stop proxy: 0.1% beyond the raid extreme. Target proxy: the opposite range extreme, which must not have traded since
 *   the range became usable; a touch before entry rejects the attempt (target_consumed).
 * Control: run the same detector with a different rangeDay (e.g. 3 = Wednesday). One attempt per range week and side.
 * The previous week's untapped extremes are not used in v1; that precedence question is left open as the card says.
 */
import { H as HOUR, M, type Bar, type DetectorContext, type SetupDetector, type SetupEvent, type Side, type StageMark } from '../setup-scan-core';

const VERSION = 'mr01-scan-v1';
const DAY = 24 * HOUR;

export const mr01MondayRange: SetupDetector = {
  id: 'MR01', version: VERSION, title: 'Monday-range raid with structure shift and zone retest', family: 'range',
  aliases: ['monday range', 'monday raid', 'monday range raid', 'monday high low', 'weekly monday', 'mr1'],
  libraryCard: 'research/setup-library/context.md#CTX02',
  defaults: { triggerTfMinutes: 60, bufferPct: 0.1, minRangePct: 1, rangeDay: 1, reclaimHours: 24, msbExpiryHours: 72, retestExpiryHours: 72, entryMode: 'retest' },
  conventions: [
    'Range day in UTC: [00:00, 24:00) of the weekday given by rangeDay (1 = Monday, the source; other days are the control). The source gives no timezone; UTC is a proposal.',
    'Range known when its last 1h bar is available; usable from the next 00:00 UTC until the same weekday next week. A day with missing 1h bars is rejected (incomplete_range_day). Range height below 1% is rejected (range_too_small).',
    'Raid: a 1h wick 0.1% through the range extreme; a close back inside within 24h is required, otherwise raid_no_reclaim. The raid extreme is tracked until the MSB.',
    'MSB: first later bar closing inside the range and beyond every opposite extreme printed since the raid bar (minimal local shift), within 72h of the raid.',
    'Zone: last bar closing against the trade direction at or after the raid bar and before the MSB bar, full wick, immutable.',
    'Retest (default entry): first later bar into the zone that closes back out through the edge it entered, within 72h of the MSB; close inside rejected, wick 0.1% through the far edge invalidates. msb mode enters at the MSB close.',
    'Target: the opposite range extreme; it must not have traded since the range became usable, checked at entry (target_consumed otherwise). Stop proxy 0.1% beyond the raid extreme.',
    'One attempt per range week and side: the first raid of each extreme. The previous week\'s untapped Monday extremes are not used in v1.',
  ],
  warmupMs: 8 * DAY,
  detect(ctx) { return detectMondayRange(ctx); },
};

export function detectMondayRange(ctx: DetectorContext): SetupEvent[] {
  const num = (k: string) => Number(ctx.params[k]);
  const ttf = num('triggerTfMinutes') * M, b = num('bufferPct') / 100, minRange = num('minRangePct') / 100, rangeDay = num('rangeDay');
  const reclaimExp = num('reclaimHours') * HOUR, msbExp = num('msbExpiryHours') * HOUR, retestExp = num('retestExpiryHours') * HOUR;
  const entryMode = String(ctx.params.entryMode ?? 'retest');
  if (entryMode !== 'retest' && entryMode !== 'msb') throw new Error(`MR01 entryMode must be retest or msb, got ${entryMode}`);
  if (!(rangeDay >= 0 && rangeDay <= 6)) throw new Error('rangeDay must be 0 (Sunday) to 6 (Saturday)');
  const bars = ctx.bars(ttf), lag = ctx.lagMs;
  const out: SetupEvent[] = [];
  if (!bars.length) return out;
  const index = new Map<number, number>(); bars.forEach((x, i) => index.set(x.timestamp, i));
  const end = (x: Bar) => x.timestamp + ttf;
  const pending = (deadline: number) => ctx.cutoff < deadline;
  const perDay = DAY / ttf;
  const firstBarAt = (t: number) => { let lo = 0, hi = bars.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (bars[mid].timestamp < t) lo = mid + 1; else hi = mid; } return lo; };

  // Every range day on the tape, from the first one after the tape starts.
  let day = Math.floor(bars[0].timestamp / DAY) * DAY;
  while (new Date(day).getUTCDay() !== rangeDay) day += DAY;
  for (; day + DAY <= ctx.cutoff; day += 7 * DAY) {
    const usableFrom = day + DAY, usableUntil = day + 7 * DAY;
    const i0 = firstBarAt(day); const dayBars: Bar[] = [];
    for (let i = i0; i < bars.length && bars[i].timestamp < usableFrom; i++) dayBars.push(bars[i]);
    const rangeId = `${VERSION.slice(0, 4)}:${new Date(day).toISOString().slice(0, 10)}`;
    for (const side of [1, -1] as Side[]) {
      const stages: Record<string, StageMark> = {}; const notes: string[] = []; const reference: Record<string, unknown> = { rangeDay: new Date(day).toISOString().slice(0, 10), usableFrom, usableUntil };
      const base = { setup: 'MR01', version: VERSION, side, stages, reference, notes };
      const empty = { entry: null as number | null, stop: null as number | null, target: null as number | null };
      const id = `MR01:${side}:${rangeId}`;
      const reject = (stage: SetupEvent['stage'], reason: string, at: number, knownAt: number, proxies = empty) => {
        const allKnown = Math.max(knownAt, ...Object.values(stages).map(s => s.knownAt));
        out.push({ id, ...base, stage, reason, formationAt: at, knownAt: allKnown, proxies });
      };
      if (dayBars.length < perDay) { if (dayBars.length) reject('rejected', 'incomplete_range_day', day, Math.max(...dayBars.map(x => Math.max(end(x) + lag, x.availableAt)))); continue; }
      const high = Math.max(...dayBars.map(x => x.high)), low = Math.min(...dayBars.map(x => x.low));
      const rangeKnownAt = Math.max(...dayBars.map(x => Math.max(end(x) + lag, x.availableAt)));
      const known = (x: Bar) => Math.max(end(x) + lag, x.availableAt, rangeKnownAt);
      const level = side === 1 ? low : high, target = side === 1 ? high : low;
      reference.range = { high, low };
      stages.range = { at: day, knownAt: rangeKnownAt, price: level, note: `range [${low}, ${high}]` };
      if ((high - low) / low < minRange) { reject('rejected', 'range_too_small', day, rangeKnownAt); continue; }
      const ext = (x: Bar) => (side === 1 ? x.low : x.high), opp = (x: Bar) => (side === 1 ? x.high : x.low);
      const inside = (v: number, ref: number) => side * (v - ref) > 0, beyond = (v: number, ref: number) => side * (ref - v) > 0;
      const shift = (v: number, k: number) => v * (1 + side * k);

      let raid: Bar | null = null, reclaim: Bar | null = null, msb: Bar | null = null, noReclaim = false;
      let extreme = level, extremeAt = day, localOpp = 0;
      for (let i = firstBarAt(usableFrom); i < bars.length && bars[i].timestamp < usableUntil; i++) {
        const x = bars[i];
        if (!raid) { if (beyond(ext(x), shift(level, -b))) { raid = x; extreme = ext(x); extremeAt = x.timestamp; localOpp = opp(x); if (inside(x.close, level)) reclaim = x; } continue; }
        if (!reclaim) {
          if (x.timestamp > raid.timestamp + reclaimExp) { noReclaim = true; break; }
          if (beyond(ext(x), extreme)) { extreme = ext(x); extremeAt = x.timestamp; }
          localOpp = side === 1 ? Math.max(localOpp, x.high) : Math.min(localOpp, x.low);
          if (inside(x.close, level)) reclaim = x;
          continue;
        }
        if (x.timestamp > raid.timestamp + msbExp) break;
        if (inside(x.close, level) && inside(x.close, localOpp)) { msb = x; break; }
        if (beyond(ext(x), extreme)) { extreme = ext(x); extremeAt = x.timestamp; }
        localOpp = side === 1 ? Math.max(localOpp, x.high) : Math.min(localOpp, x.low);
      }
      if (!raid) { reject(pending(usableUntil) ? 'pending_at_cutoff' : 'expired', 'no_raid', usableFrom, rangeKnownAt); continue; }
      stages.raid = { at: raid.timestamp, knownAt: known(raid), price: ext(raid) };
      if (noReclaim) { reject('invalidated', 'raid_no_reclaim', raid.timestamp, known(raid)); continue; }
      if (!reclaim) { reject(pending(raid.timestamp + reclaimExp) ? 'pending_at_cutoff' : 'expired', 'no_reclaim', raid.timestamp, known(raid)); continue; }
      stages.reclaim = { at: reclaim.timestamp, knownAt: known(reclaim), price: reclaim.close };
      if (!msb) { reject(pending(Math.min(raid.timestamp + msbExp, usableUntil)) ? 'pending_at_cutoff' : 'expired', 'no_msb', reclaim.timestamp, known(reclaim)); continue; }
      reference.raid = { extreme, extremeAt };
      stages.msb = { at: msb.timestamp, knownAt: known(msb), price: msb.close, note: `closed back ${side === 1 ? 'above' : 'below'} ${level}` };
      const iR = index.get(raid.timestamp)!, iM = index.get(msb.timestamp)!;
      let origin: Bar | null = null;
      for (let i = iR; i < iM; i++) if (side * (bars[i].close - bars[i].open) < 0) origin = bars[i];
      if (!origin) { reject('rejected', 'no_zone_candle', msb.timestamp, known(msb)); continue; }
      const zone = { low: origin.low, high: origin.high, originAt: origin.timestamp };
      const near = side === 1 ? zone.high : zone.low, far = side === 1 ? zone.low : zone.high;
      reference.zone = zone;
      stages.zone = { at: origin.timestamp, knownAt: known(msb), price: near, note: `[${zone.low}, ${zone.high}]` };
      const stop = shift(extreme, -b), targetPx = shift(target, b);
      const finish = (stage: SetupEvent['stage'], reason: string | undefined, bar: Bar) => {
        const knownAt = Math.max(...Object.values(stages).map(s => s.knownAt));
        const consumed = ctx.hit(target, side, usableFrom, knownAt);
        if (consumed && stage === 'confirmed') { stage = 'rejected'; reason = 'target_consumed'; notes.push('opposite_extreme_traded_before_entry'); }
        out.push({ id, ...base, stage, reason, formationAt: bar.timestamp, knownAt, proxies: { entry: null, stop, target: targetPx } });
      };
      if (entryMode === 'msb') { finish('confirmed', undefined, msb); continue; }
      let retest: Bar | null = null, through: Bar | null = null;
      for (let i = iM + 1; i < bars.length && bars[i].timestamp < usableUntil; i++) {
        const x = bars[i];
        if (x.timestamp > msb.timestamp + retestExp) break;
        const touched = side === 1 ? x.low <= near : x.high >= near;
        if (!touched) continue;
        if (side === 1 ? x.low < far * (1 - b) : x.high > far * (1 + b)) { through = x; break; }
        retest = x; break;
      }
      if (through) { stages.retest = { at: through.timestamp, knownAt: known(through), price: ext(through), note: 'traded through far edge' }; reject('invalidated', 'retest_through_zone', through.timestamp, known(through), { entry: null, stop, target: targetPx }); continue; }
      if (!retest) { reject(pending(Math.min(msb.timestamp + retestExp, usableUntil)) ? 'pending_at_cutoff' : 'expired', 'no_retest', msb.timestamp, known(msb), { entry: null, stop, target: targetPx }); continue; }
      const held = side === 1 ? retest.close > near : retest.close < near;
      stages.retest = { at: retest.timestamp, knownAt: known(retest), price: retest.close, note: held ? 'closed back out of the zone' : 'closed inside zone' };
      if (!held) { finish('rejected', 'retest_closed_inside_zone', retest); continue; }
      finish('confirmed', undefined, retest);
    }
  }
  return out.sort((a, b2) => a.knownAt - b2.knownAt || a.id.localeCompare(b2.id));
}
