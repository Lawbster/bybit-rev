/** RS01 tests: synthetic hourly tapes for the confirmed long, the mirrored short, one rejection per stage, and prefix invariance. */
import assert from 'assert/strict';
import { buildContext, H, M, type Minute } from '../setup-scan-core';
import { detectReversals, rs01Reversal } from './rs01-reversal';

const t0 = Date.UTC(2026, 2, 2);
type Spec = [number, number, number, number]; // o h l c per hour

/** Sixty minutes per hour bar: open -> high -> low -> close, so the aggregated bar has exactly the given OHLC. */
function hourly(specs: Spec[], start = t0): Minute[] {
  const out: Minute[] = [];
  specs.forEach(([o, h, l, c], k) => {
    const legs: [number, number][] = [[o, h], [h, l], [l, c]];
    for (let m = 0; m < 60; m++) {
      const leg = legs[Math.min(2, Math.floor(m / 20))]; const f0 = (m % 20) / 20, f1 = ((m % 20) + 1) / 20;
      const a = leg[0] + (leg[1] - leg[0]) * f0, z = leg[0] + (leg[1] - leg[0]) * f1;
      const ts = start + k * H + m * M;
      out.push({ ts, endTs: ts + M, open: a, high: Math.max(a, z), low: Math.min(a, z), close: z, volume: 1, turnover: 0, availableAt: ts + M + 60_000 });
    }
  });
  return out;
}
const flat = (p: number): Spec => [p, p + 0.05, p - 0.05, p];
const mirror = (s: Spec[], c = 200): Spec[] => s.map(([o, h, l, x]) => [c - o, c - l, c - h, c - x]);

/**
 * Reference long: 60 bars down to L = 100 (bar 60), bounce to H = 104 (bar 66, confirmed after bar 69), overlapping
 * drift down, a three-bar gap at bars 70/72 (bar 71 overlaps bar 69 so the first gap publishes at bar 72) (omitted in the no-gap variant, where every triple after H overlaps),
 * sweep to 97 at bar 76 (fib 1.618 = 97.53 reached), MSB at bar 77 (close 100.8), demand = bar 76 [97, 100.5],
 * retest at bar 79 (low 99.2, close 100.6), then new highs.
 */
function longTape(opts: { gap?: boolean; sweep?: boolean; msb?: boolean; retest?: 'ok' | 'inside' | 'through' | 'none' | 'newhigh'; resolveUp?: boolean } = {}): Spec[] {
  const { gap = true, sweep = true, msb = true, retest = 'ok', resolveUp = false } = opts;
  const s: Spec[] = [];
  for (let i = 0; i < 60; i++) { const p = 120 - i * (20 / 60); s.push([p + 0.2, p + 0.4, p - 0.1, p]); }   // 0-59: down to ~100.3
  s.push([100.3, 100.4, 100, 100.2]);                                                                   // 60: L = 100, lowest low
  s.push(flat(100.8), flat(101.6), flat(102.4), flat(103.2), flat(103.7));                             // 61-65: bounce
  s.push([103.7, 104, 103.5, 103.8]);                                                                   // 66: H = 104
  s.push([103.8, 103.9, 103.3, 103.4], [103.4, 103.55, 102.9, 103.0], [103.0, 103.35, 102.8, 102.9]);   // 67-69: overlapping (H confirmed after 69)
  if (resolveUp) { s.push([103, 104.5, 102.9, 104.4]); for (let i = 0; i < 8; i++) s.push(flat(104.4)); return s; }
  s.push([102.9, 103.0, 102.5, 102.6]);                                                                 // 70
  if (gap) { s.push([102.4, 102.85, 101.9, 102.0], [101.7, 101.8, 101.0, 101.2]); }                     // 71-72: bar 72 high 101.8 < bar 70 low 102.5 => gap
  else { s.push([102.6, 102.9, 102.2, 102.3], [102.3, 102.6, 101.0, 101.2]); }                           // 71-72: overlapping
  if (gap) s.push(flat(100.9), flat(100.6), flat(100.4));                                               // 73-75
  else s.push([101.2, 102.3, 100.8, 100.9], [100.9, 101.1, 100.5, 100.6], [100.6, 100.85, 100.3, 100.4]); // 73-75: overlapping
  if (!sweep) { for (let i = 0; i < 8; i++) s.push(flat(100.5)); return s; }
  s.push([100.4, 100.5, 97, 98.5]);                                                                     // 76: sweep, low 97; last down-close bar => demand [97, 100.5]
  if (!msb) { for (let i = 0; i < 80; i++) s.push(flat(98.6)); return s; }
  s.push([98.5, 100.9, 98.4, 100.8]);                                                                   // 77: MSB (close > 100.1 and > 100.5)
  s.push(flat(100.7));                                                                                  // 78: does not touch the box
  if (retest === 'none') { for (let i = 0; i < 80; i++) s.push(flat(100.7)); return s; }
  if (retest === 'newhigh') { s.push([100.7, 104.6, 100.6, 104.5]); s.push(flat(104.5)); return s; }
  if (retest === 'through') { s.push([100.7, 100.8, 96.5, 96.8]); s.push(flat(96.8)); return s; }
  if (retest === 'inside') { s.push([100.7, 100.8, 99.2, 99.3]); s.push(flat(99.3)); return s; }
  s.push([100.7, 100.9, 99.2, 100.6]);                                                                  // 79: into the box, closes back above 100.5
  s.push(flat(100.4), flat(101.5), flat(103), flat(105), flat(106));
  return s;
}

const run = (specs: Spec[], params: Record<string, number | string> = {}) => {
  const minutes = hourly(specs);
  const ctx = buildContext({ symbol: 'T', minutes, lagMs: 60_000, window: { start: t0, end: t0 + specs.length * H }, params: { ...rs01Reversal.defaults, ...params } });
  return detectReversals(ctx);
};
const reasons = (specs: Spec[], params?: Record<string, number | string>) => run(specs, params).map(e => `${e.stage}:${e.reason ?? 'confirmed'}`);

// ── confirmed long ──
{
  const ev = run(longTape());
  const c = ev.filter(e => e.stage === 'confirmed');
  assert.equal(c.length, 1, `one confirmed long, got ${reasons(longTape()).join(',')}`);
  const e = c[0];
  assert.equal(e.side, 1);
  assert.deepEqual(Object.keys(e.stages), ['low', 'high', 'fvg', 'sweep', 'msb', 'demand', 'retest']);
  assert.equal(e.stages.low.price, 100); assert.equal(e.stages.high.price, 104);
  assert.equal(e.stages.fvg.at, t0 + 72 * H, 'the gap is published at the third bar');
  assert.equal(e.stages.sweep.price, 97); assert.equal(e.stages.msb.price, 100.8);
  assert.deepEqual((e.reference as any).zone, { low: 97, high: 100.5, originAt: t0 + 76 * H });
  assert.equal(e.stages.retest.at, t0 + 79 * H);
  assert(e.notes.includes('fib_1618_reached'));
  assert.ok(Math.abs(e.proxies.stop! - 97 * 0.999) < 1e-9); assert.ok(Math.abs(e.proxies.target! - 104 * 1.001) < 1e-9);
  // Causality: the range is known only after H's third right-hand bar closes; every stage's known-at respects it.
  assert.equal(e.stages.high.knownAt, t0 + 70 * H + 60_000);
  for (const s of Object.values(e.stages)) assert(s.knownAt >= s.at && s.knownAt <= e.knownAt);
  assert.equal(e.knownAt, t0 + 80 * H + 60_000, 'known at the retest bar close plus lag');
}

// ── rejections and expiries, one per stage ──
{
  assert(reasons(longTape({ gap: false })).includes('rejected:no_fvg'), `no gap -> rejected no_fvg control row, got ${reasons(longTape({ gap: false })).join(',')}`);
  const noFvg = run(longTape({ gap: false })).find(e => e.reason === 'no_fvg')!;
  assert(noFvg.notes.includes('no_fvg_control') && noFvg.proxies.stop !== null && !('fvg' in noFvg.stages), 'control row carries proxies and no fvg stage');
  assert(run(longTape({ gap: false }), { requireFvg: 0 }).some(e => e.stage === 'confirmed' && e.notes.includes('no_fvg')), 'requireFvg=0 confirms without the gap');
  assert(reasons(longTape({ resolveUp: true })).includes('rejected:range_resolved_up'));
  assert(reasons(longTape({ sweep: false })).some(r => r === 'pending_at_cutoff:no_sweep' || r === 'expired:no_sweep'));
  assert(reasons(longTape({ msb: false })).includes('expired:no_msb'));
  assert(reasons(longTape({ retest: 'none' })).includes('expired:no_retest'));
  assert(reasons(longTape({ retest: 'newhigh' })).includes('rejected:new_high_before_entry'));
  assert(reasons(longTape({ retest: 'through' })).includes('invalidated:retest_through_zone'));
  assert(reasons(longTape({ retest: 'inside' })).includes('rejected:retest_closed_inside_zone'));
  // msb entry mode confirms at the MSB even when the retest never comes.
  const msbMode = run(longTape({ retest: 'none' }), { entryMode: 'msb' }).filter(e => e.stage === 'confirmed');
  assert.equal(msbMode.length, 1); assert.equal(msbMode[0].formationAt, t0 + 77 * H); assert(!('retest' in msbMode[0].stages));
  // Range height below the minimum: no range high.
  assert(reasons(longTape(), { minRangePct: 5 }).some(r => r.endsWith(':no_range_high')));
  assert.throws(() => run(longTape(), { entryMode: 'bogus' }));
}

// ── mirrored short ──
{
  const ev = run(mirror(longTape()));
  const c = ev.filter(e => e.stage === 'confirmed');
  assert.equal(c.length, 1, `one confirmed short, got ${reasons(mirror(longTape())).join(',')}`);
  const e = c[0];
  assert.equal(e.side, -1);
  assert.equal(e.stages.low.price, 100); assert.equal(e.stages.high.price, 96); assert.equal(e.stages.sweep.price, 103);
  assert.deepEqual((e.reference as any).zone, { low: 99.5, high: 103, originAt: t0 + 76 * H });
  assert.ok(Math.abs(e.proxies.stop! - 103 * 1.001) < 1e-9); assert.ok(Math.abs(e.proxies.target! - 96 * 0.999) < 1e-9);
  assert(e.notes.includes('fib_1618_reached'));
}

// ── prefix invariance: truncating the tape never changes rows already known ──
{
  const full = run(longTape());
  const specs = longTape();
  for (const cut of [72, 78, 81, 84]) {
    const part = run(specs.slice(0, cut));
    const cutoff = t0 + cut * H;
    for (const p of part) {
      if (p.knownAt > cutoff || p.stage === 'pending_at_cutoff' || p.stage === 'expired') continue;
      const f = full.find(x => x.id === p.id && x.side === p.side);
      assert(f, `row ${p.id} vanished on the full tape`);
      assert.deepEqual({ stage: p.stage, reason: p.reason, formationAt: p.formationAt, knownAt: p.knownAt }, { stage: f!.stage, reason: f!.reason, formationAt: f!.formationAt, knownAt: f!.knownAt }, `row ${p.id} changed after cut ${cut}`);
    }
  }
}

console.log('rs01-reversal tests passed');
