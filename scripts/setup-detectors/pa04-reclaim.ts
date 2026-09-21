/**
 * PA04 — Closed-break reclaim / trapped-breakout hypothesis (library: price-action.md#PA04).
 *
 * v1: a known context pivot is broken on a closing basis by a trigger bar (outside close), and a later
 * trigger bar closes back on the original side within the reclaim window. Breaking a pivot LOW and
 * reclaiming is a long; breaking a pivot HIGH and reclaiming is a short. Breaks that never reclaim
 * are emitted as expired rows so the denominator includes them.
 */
import { H, M, nextUntouchedPivot, type DetectorContext, type SetupDetector, type SetupEvent, type Side, type StageMark, type Bar } from '../setup-scan-core';

const VERSION = 'pa04-scan-v1';

export const pa04Reclaim: SetupDetector = {
  id: 'PA04', version: VERSION, title: 'Closed-break reclaim / trapped-breakout hypothesis', family: 'reclaim',
  aliases: ['reclaim', 'closed break reclaim', 'trapped breakout', 'failed breakout', 'swing failure', 'pa4'],
  libraryCard: 'research/setup-library/price-action.md#PA04',
  defaults: { contextTfMinutes: 240, triggerTfMinutes: 60, pivotWidth: 2, bufferPct: 0.1, breakMaxAgeHours: 168, reclaimExpiryHours: 24 },
  conventions: [
    'Context pivots: strict 4h swings, two bars each side, published after the second right-hand bar closes plus lag.',
    'Outside close: the first 1h close beyond the pivot by 0.1% while the previous close was on the original side; the pivot must be at most 7 days old at that bar.',
    'Reclaim: a later 1h close back on the original side of the pivot price within 24h of the outside close. A wick back inside is not a reclaim.',
    'Stop proxy: 0.1% beyond the extreme reached while outside. Target proxy: nearest known context pivot ahead not traded through since it became available; may be absent.',
    'One attempt per pivot and side; breaks without reclaim are emitted as expired rows.',
  ],
  warmupMs: 14 * 24 * H,
  detect(ctx) { return detectReclaims(ctx); },
};

const num = (ctx: DetectorContext, k: string) => Number(ctx.params[k]);

export function detectReclaims(ctx: DetectorContext): SetupEvent[] {
  const ctf = num(ctx, 'contextTfMinutes') * M, ttf = num(ctx, 'triggerTfMinutes') * M, width = num(ctx, 'pivotWidth');
  const b = num(ctx, 'bufferPct') / 100, maxAge = num(ctx, 'breakMaxAgeHours') * H, reclaimExp = num(ctx, 'reclaimExpiryHours') * H;
  const pivots = ctx.pivots(ctf, width), bars = ctx.bars(ttf), lag = ctx.lagMs;
  const out: SetupEvent[] = [];
  const firstBarAt = (t: number) => { let lo = 0, hi = bars.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (bars[mid].timestamp < t) lo = mid + 1; else hi = mid; } return lo; };
  const end = (x: Bar) => x.timestamp + ttf;
  const known = (x: Bar) => Math.max(end(x) + lag, x.availableAt);
  for (const P of pivots) {
    const side: Side = P.kind === 'low' ? 1 : -1; // break below a low then reclaim = long
    const outsideOf = (x: Bar) => side === 1 ? x.close < P.price * (1 - b) : x.close > P.price * (1 + b);
    const insideOf = (x: Bar) => side === 1 ? x.close > P.price : x.close < P.price;
    let outside: Bar | null = null;
    for (let i = Math.max(1, firstBarAt(P.availableAt)); i < bars.length && bars[i].timestamp < P.availableAt + maxAge; i++) {
      if (insideOf(bars[i - 1]) && outsideOf(bars[i])) { outside = bars[i]; break; }
    }
    if (!outside) continue; // no attempt: the level was never broken while eligible
    const stages: Record<string, StageMark> = { context: { at: P.pivotAt, knownAt: P.availableAt, price: P.price }, outside: { at: outside.timestamp, knownAt: known(outside), price: outside.close } };
    let extreme = side === 1 ? outside.low : outside.high, reclaim: Bar | null = null;
    for (let i = firstBarAt(outside.timestamp) + 1; i < bars.length && end(bars[i]) <= end(outside) + reclaimExp; i++) {
      const x = bars[i]; extreme = side === 1 ? Math.min(extreme, x.low) : Math.max(extreme, x.high);
      if (insideOf(x)) { reclaim = x; break; }
    }
    const reference = { pivot: P, outsideExtreme: extreme };
    if (!reclaim) {
      const pending = ctx.cutoff < end(outside) + reclaimExp;
      out.push({ id: `PA04:${side}:${P.id}`, setup: 'PA04', version: VERSION, side, stage: pending ? 'pending_at_cutoff' : 'expired', reason: 'no_reclaim', formationAt: outside.timestamp, knownAt: stages.outside.knownAt, stages, reference, proxies: { entry: null, stop: null, target: null }, notes: [] });
      continue;
    }
    stages.reclaim = { at: reclaim.timestamp, knownAt: known(reclaim), price: reclaim.close };
    const knownAt = Math.max(...Object.values(stages).map(s => s.knownAt));
    const stop = side === 1 ? extreme * (1 - b) : extreme * (1 + b);
    const target = nextUntouchedPivot(ctx, pivots, side === 1 ? 'high' : 'low', side, reclaim.close, knownAt);
    const notes: string[] = []; if (!target) notes.push('no_known_untouched_target');
    out.push({ id: `PA04:${side}:${P.id}`, setup: 'PA04', version: VERSION, side, stage: 'confirmed', formationAt: reclaim.timestamp, knownAt, stages, reference: { ...reference, target }, proxies: { entry: null, stop, target: target?.price ?? null }, notes });
  }
  return out.sort((a, b) => a.knownAt - b.knownAt || a.id.localeCompare(b.id));
}
