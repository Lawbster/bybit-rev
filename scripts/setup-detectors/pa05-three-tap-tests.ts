/** PA05 tests: synthetic hourly tapes for the confirmed long (touch and reaction), the mirrored short, the two-tap control, one rejection per stage, prefix invariance. */
import assert from 'assert/strict';
import { buildContext, H, M, type Minute } from '../setup-scan-core';
import { detectThreeTaps, pa05ThreeTap } from './pa05-three-tap';

const t0 = Date.UTC(2026, 3, 6);
type Spec = [number, number, number, number];
function hourly(specs: Spec[], start = t0): Minute[] {
  const out: Minute[] = [];
  specs.forEach(([o, h, l, c], k) => {
    const legs: [number, number][] = [[o, h], [h, l], [l, c]];
    for (let m = 0; m < 60; m++) {
      const leg = legs[Math.min(2, Math.floor(m / 20))]; const f0 = (m % 20) / 20, f1 = ((m % 20) + 1) / 20;
      const a = leg[0] + (leg[1] - leg[0]) * f0, z = leg[0] + (leg[1] - leg[0]) * f1; const ts = start + k * H + m * M;
      out.push({ ts, endTs: ts + M, open: a, high: Math.max(a, z), low: Math.min(a, z), close: z, volume: 1, turnover: 0, availableAt: ts + M + 60_000 });
    }
  });
  return out;
}
const flat = (p: number): Spec => [p, p + 0.05, p - 0.05, p];
const mirror = (s: Spec[], c = 200): Spec[] => s.map(([o, h, l, x]) => [c - o, c - l, c - h, c - x]);

/**
 * Reference long: level L = 100 at bar 30 (visit 1), departure to 101.7 at bar 35, sweep to 99.8 with a same-bar reclaim at
 * bar 37 (visit 2), second departure at bar 38, third visit at bar 39 (low 100.25, close 100.9), reaction close at bar 40.
 * The bar-35 high 101.7 is a confirmed pivot high (published after bar 38) and serves as the untouched structural target.
 */
function tape(opts: { v2?: 'sweep' | 'twotap' | 'noreclaim' | 'none'; third?: 'ok' | 'below' | 'broke' | 'none'; depart?: boolean; reaction?: boolean } = {}): Spec[] {
  const { v2 = 'sweep', third = 'ok', depart = true, reaction = true } = opts;
  const s: Spec[] = [];
  for (let i = 0; i < 27; i++) s.push(flat(101.0 + (i % 3) * 0.1));                          // 0-26: noise without strict pivots near 100
  s.push(flat(100.6), flat(100.4), flat(100.2));                                                // 27-29
  s.push([100.2, 100.3, 100.0, 100.1]);                                                         // 30: L = 100
  s.push(flat(100.3), flat(100.6), flat(101.0), flat(101.2));                                   // 31-34
  if (!depart) { for (let i = 0; i < 200; i++) s.push(flat(100.5)); return s; }
  s.push([101.2, 101.7, 101.1, 101.6]);                                                         // 35: departure (high 101.7 > 101.5), later a pivot high
  s.push(flat(101.4));                                                                          // 36
  if (v2 === 'none') { for (let i = 0; i < 200; i++) s.push(flat(101.4)); return s; }
  if (v2 === 'twotap') { s.push([101.4, 101.5, 100.2, 100.8]); s.push(flat(101.0)); return s; }  // 37: touches the band, no wick through
  if (v2 === 'noreclaim') { s.push([101.4, 101.5, 99.8, 99.7]); for (let i = 0; i < 30; i++) s.push(flat(99.6)); return s; }
  s.push([101.4, 101.45, 99.8, 100.4]);                                                         // 37: sweep to 99.8, closes back above 100; high stays under the 1.5% departure line
  s.push(flat(101.6));                                                                          // 38: second departure (high 101.65)
  if (third === 'none') { for (let i = 0; i < 200; i++) s.push(flat(101.6)); return s; }
  if (third === 'below') { s.push([101.6, 101.65, 100.25, 99.95]); s.push(flat(99.9)); return s; }
  if (third === 'broke') { s.push([101.6, 101.65, 99.5, 99.6]); s.push(flat(99.6)); return s; }
  s.push([101.6, 101.65, 100.25, 100.9]);                                                       // 39: third visit, holds
  if (!reaction) { for (let i = 0; i < 8; i++) s.push(flat(100.9)); return s; }                 // 40+: never closes above the visit-3 high
  s.push([100.9, 102.0, 100.8, 101.9]);                                                         // 40: reaction close above 101.65
  s.push(flat(102.5), flat(103), flat(103.5));
  return s;
}
const run = (specs: Spec[], params: Record<string, number | string> = {}) => detectThreeTaps(buildContext({ symbol: 'T', minutes: hourly(specs), lagMs: 60_000, window: { start: t0, end: t0 + specs.length * H }, params: { ...pa05ThreeTap.defaults, ...params } }));
const reasons = (specs: Spec[], params?: Record<string, number | string>) => run(specs, params).map(e => `${e.stage}:${e.reason ?? 'confirmed'}`);

// ── confirmed long, touch mode ──
{
  const ev = run(tape()); const c = ev.filter(e => e.stage === 'confirmed');
  assert.equal(c.length, 1, `one confirmed long, got ${reasons(tape()).join(',')}`);
  const e = c[0];
  assert.equal(e.side, 1); assert.deepEqual(Object.keys(e.stages), ['level', 'depart', 'sweep', 'reclaim', 'depart2', 'third']);
  assert.equal(e.stages.level.price, 100); assert.equal(e.stages.depart.at, t0 + 35 * H); assert.equal(e.stages.sweep.price, 99.8);
  assert.equal(e.stages.reclaim.at, t0 + 37 * H, 'same-bar reclaim'); assert.equal(e.stages.depart2.at, t0 + 38 * H); assert.equal(e.stages.third.at, t0 + 39 * H);
  assert.deepEqual((e.reference as any).sweep, { extreme: 99.8, extremeAt: t0 + 37 * H });
  assert.ok(Math.abs(e.proxies.stop! - 99.8 * 0.999) < 1e-9); assert.equal(e.proxies.target, 101.7, 'the bar-35 pivot high is the untouched structural target');
  assert.equal(e.stages.level.knownAt, t0 + 34 * H + 60_000, 'level known after the third right-hand bar');
  for (const s of Object.values(e.stages)) assert(s.knownAt >= s.at && s.knownAt <= e.knownAt);
  assert.equal(e.knownAt, t0 + 40 * H + 60_000);
}

// ── reaction mode ──
{
  const c = run(tape(), { entryMode: 'reaction' }).filter(e => e.stage === 'confirmed');
  assert.equal(c.length, 1); assert.equal(c[0].stages.reaction.at, t0 + 40 * H); assert.equal(c[0].formationAt, t0 + 40 * H);
  assert(reasons(tape({ reaction: false }), { entryMode: 'reaction', reactionHours: 2 }).includes('expired:no_reaction'));
  assert.throws(() => run(tape(), { entryMode: 'bogus' }));
}

// ── control and rejections ──
{
  const ctl = run(tape({ v2: 'twotap' })).find(e => e.reason === 'two_tap_no_sweep')!;
  assert(ctl && ctl.stage === 'rejected' && ctl.notes.includes('two_tap_control'), `two-tap control row, got ${reasons(tape({ v2: 'twotap' })).join(',')}`);
  assert.ok(Math.abs(ctl.proxies.stop! - 100 * 0.999) < 1e-9, 'control stop sits under the level, not under a sweep');
  assert(reasons(tape({ v2: 'noreclaim' })).includes('invalidated:sweep_no_reclaim'));
  assert(reasons(tape({ v2: 'none' })).some(r => r.endsWith(':no_return')));
  assert(reasons(tape({ depart: false })).some(r => r.endsWith(':no_departure')));
  assert(reasons(tape({ third: 'below' })).includes('rejected:third_visit_closed_through_level'));
  assert(reasons(tape({ third: 'broke' })).includes('invalidated:broke_sweep_extreme'));
  assert(reasons(tape({ third: 'none' })).some(r => r.endsWith(':no_third_visit')));
  assert(!run(tape(), { departPct: 5 }).some(e => e.stage === 'confirmed'), 'a 5% departure never happens on this tape');
}

// ── mirrored short ──
{
  const ev = run(mirror(tape())); const c = ev.filter(e => e.stage === 'confirmed');
  assert.equal(c.length, 1, `one confirmed short, got ${reasons(mirror(tape())).join(',')}`);
  const e = c[0]; assert.equal(e.side, -1); assert.equal(e.stages.level.price, 100); assert.equal(e.stages.sweep.price, 100.2);
  assert.ok(Math.abs(e.proxies.stop! - 100.2 * 1.001) < 1e-9); assert.equal(e.proxies.target, 98.3);
}

// ── prefix invariance ──
{
  const full = run(tape()); const specs = tape();
  for (const cut of [36, 38, 40, 42]) {
    const cutoff = t0 + cut * H;
    for (const p of run(specs.slice(0, cut))) {
      if (p.knownAt > cutoff || p.stage === 'pending_at_cutoff' || p.stage === 'expired') continue;
      const f = full.find(x => x.id === p.id); assert(f, `row ${p.id} vanished`);
      assert.deepEqual({ stage: p.stage, reason: p.reason, formationAt: p.formationAt, knownAt: p.knownAt }, { stage: f!.stage, reason: f!.reason, formationAt: f!.formationAt, knownAt: f!.knownAt }, `row ${p.id} changed after cut ${cut}`);
    }
  }
}

console.log('pa05-three-tap tests passed');
