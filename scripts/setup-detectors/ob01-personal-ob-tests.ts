/** OB01 tests: sweep, interior-high MSB, block, 0.705 order inside the block, edge variant, rejections, mirrored short, prefix invariance. */
import assert from 'assert/strict';
import { buildContext, H, M, type Minute } from '../setup-scan-core';
import { detectPersonalOb, ob01PersonalOb } from './ob01-personal-ob';

const t0 = Date.UTC(2026, 4, 4);
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
 * Long: pivot low L = 100 at bar 10 (known after bar 13). Interior pivot high 103 at bar 17 (known after bar 20).
 * Sweep at bar 24 (low 99.8, closes 100.4 = same-bar reclaim). Bar 25 is the last down-close bar before the MSB:
 * [100.4, 100.6, 99.9, 100.2] -> block [99.9, 100.6]. MSB at bar 26: close 103.3 > 103.103, high 103.6.
 * Leg 99.8 -> 103.6; OTE = 103.6 - 0.705 * 3.8 = 100.921, which lies inside... no: block top is 100.6, so make the block taller.
 * Adjusted below: bar 25 = [101.2, 101.4, 99.9, 100.2] -> block [99.9, 101.4]; OTE 100.921 inside. Edge = 101.4.
 */
function tape(opts: { reclaim?: boolean; msb?: boolean; interior?: boolean; oteOutside?: boolean } = {}): Spec[] {
  const { reclaim = true, msb = true, interior = true, oteOutside = false } = opts;
  const s: Spec[] = [];
  for (let i = 0; i < 7; i++) s.push(flat(101.5 - i * 0.15));                                                  // 0-6 drift down (lows > 100)
  s.push(flat(100.5), flat(100.3), flat(100.15));                                                              // 7-9
  s.push([100.2, 100.3, 100.0, 100.1]);                                                                        // 10: L = 100
  s.push(flat(100.4), flat(100.8), flat(101.3));                                                               // 11-13 (L known after 13)
  if (interior) { s.push(flat(101.9), flat(102.4), flat(102.8)); s.push([102.8, 103.0, 102.6, 102.9]); s.push(flat(102.5), flat(102.2), flat(101.8)); } // 14-20: interior high 103 at bar 17
  else { for (let i = 14; i <= 20; i++) s.push(flat(101.3 + (i % 2) * 0.05)); }                                // no strict pivot high
  s.push(flat(101.2), flat(100.8), flat(100.5));                                                               // 21-23
  s.push(reclaim ? [100.5, 100.6, 99.8, 100.4] : [100.5, 100.6, 99.8, 99.7]);                                  // 24: sweep (reclaim same bar, or not)
  if (!reclaim) { for (let i = 0; i < 30; i++) s.push(flat(99.6)); return s; }
  s.push(oteOutside ? [100.4, 100.6, 99.9, 100.2] : [101.2, 101.4, 99.9, 100.2]);                              // 25: block candle (down-close)
  if (!msb) { for (let i = 0; i < 80; i++) s.push(flat(100.3)); return s; }
  s.push([100.2, 103.6, 100.1, 103.3]);                                                                        // 26: MSB, close 103.3 > 103 * 1.001
  s.push(flat(103.0), flat(102.5), flat(101.0), flat(100.9), flat(102.0), flat(104.5), flat(105.0));           // 27-33 (a later pivot high 105? untouched target search)
  return s;
}
const run = (specs: Spec[], params: Record<string, number | string> = {}) => detectPersonalOb(buildContext({ symbol: 'T', minutes: hourly(specs), lagMs: 60_000, window: { start: t0, end: t0 + specs.length * H }, params: { ...ob01PersonalOb.defaults, ...params } }));
const reasons = (specs: Spec[], params?: Record<string, number | string>) => run(specs, params).map(e => `${e.side}:${e.stage}:${e.reason ?? 'confirmed'}`);

// ── confirmed long, ote entry ──
{
  const ev = run(tape()); const c = ev.filter(e => e.stage === 'confirmed' && e.side === 1);
  assert.equal(c.length, 1, `one confirmed long, got ${reasons(tape()).join(',')}`);
  const e = c[0];
  assert.deepEqual(Object.keys(e.stages), ['level', 'sweep', 'reclaim', 'msb', 'block', 'ote']);
  assert.equal(e.stages.level.price, 100); assert.equal(e.stages.sweep.at, t0 + 24 * H); assert.equal(e.stages.reclaim.at, t0 + 24 * H);
  assert.equal(e.stages.msb.at, t0 + 26 * H); assert.equal((e.reference as any).interiorPivot.price, 103);
  assert.deepEqual((e.reference as any).zone, { low: 99.9, high: 101.4, originAt: t0 + 25 * H });
  const leg = (e.reference as any).leg; assert.equal(leg.start, 99.8); assert.equal(leg.end, 103.6);
  assert.ok(Math.abs(leg.ote - (103.6 - 0.705 * 3.8)) < 1e-9); assert.ok(Math.abs(e.proxies.entry! - leg.ote) < 1e-9, 'resting price is the OTE');
  assert.ok(Math.abs(e.proxies.stop! - 99.9 * 0.999) < 1e-9, 'stop beyond the block far edge');
  assert(e.notes.includes('ote_inside_block'));
  assert.equal(e.stages.msb.knownAt, t0 + 27 * H + 60_000); assert.equal(e.knownAt, t0 + 27 * H + 60_000);
  for (const s of Object.values(e.stages)) assert(s.knownAt >= s.at && s.knownAt <= e.knownAt);
}

// ── edge variant, rejections ──
{
  const edge = run(tape(), { entryLevel: 'edge' }).filter(e => e.stage === 'confirmed' && e.side === 1);
  assert.equal(edge.length, 1); assert.equal(edge[0].proxies.entry, 101.4, 'edge variant rests at the block near edge');
  assert(reasons(tape({ oteOutside: true })).includes('1:rejected:ote_outside_block'), `got ${reasons(tape({ oteOutside: true })).join(',')}`);
  const edgeOutside = run(tape({ oteOutside: true }), { entryLevel: 'edge' }).filter(e => e.stage === 'confirmed' && e.side === 1);
  assert.equal(edgeOutside.length, 1, 'edge entry does not need the OTE inside the block'); assert(edgeOutside[0].notes.includes('ote_outside_block'));
  assert(reasons(tape({ reclaim: false })).includes('1:invalidated:sweep_no_reclaim'));
  assert(reasons(tape({ msb: false })).some(r => r === '1:expired:no_msb' || r === '1:pending_at_cutoff:no_msb'));
  assert(reasons(tape({ interior: false })).includes('1:rejected:no_interior_high'));
  assert.throws(() => run(tape(), { entryLevel: 'bogus' })); assert.throws(() => run(tape(), { retracement: 1.5 }));
}

// ── mirrored short ──
{
  const ev = run(mirror(tape())); const c = ev.filter(e => e.stage === 'confirmed' && e.side === -1);
  assert.equal(c.length, 1, `one confirmed short, got ${reasons(mirror(tape())).join(',')}`);
  const e = c[0]; assert.equal(e.stages.level.price, 100); assert.deepEqual((e.reference as any).zone, { low: 98.6, high: 100.1, originAt: t0 + 25 * H });
  assert.ok(Math.abs(e.proxies.stop! - 100.1 * 1.001) < 1e-9); assert.ok(Math.abs(e.proxies.entry! - (96.4 + 0.705 * 3.8)) < 1e-9);
}

// ── prefix invariance ──
{
  const full = run(tape()); const specs = tape();
  for (const cut of [22, 25, 27, 30]) {
    const cutoff = t0 + cut * H;
    for (const p of run(specs.slice(0, cut))) {
      if (p.knownAt > cutoff || p.stage === 'pending_at_cutoff' || p.stage === 'expired') continue;
      const f = full.find(x => x.id === p.id); assert(f, `row ${p.id} vanished`);
      assert.deepEqual({ stage: p.stage, reason: p.reason, formationAt: p.formationAt, knownAt: p.knownAt }, { stage: f!.stage, reason: f!.reason, formationAt: f!.formationAt, knownAt: f!.knownAt }, `row ${p.id} changed after cut ${cut}`);
    }
  }
}

console.log('ob01-personal-ob tests passed');
