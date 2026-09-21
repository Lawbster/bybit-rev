/** MR01 tests: a synthetic week with a Monday range, the long raid of the low, the mirrored short, rejections per stage, the weekday control, prefix invariance. */
import assert from 'assert/strict';
import { buildContext, H, M, type Minute } from '../setup-scan-core';
import { detectMondayRange, mr01MondayRange } from './mr01-monday-range';

const t0 = Date.UTC(2026, 3, 6); // Monday 2026-04-06 00:00 UTC
assert.equal(new Date(t0).getUTCDay(), 1);
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
const mirror = (s: Spec[], c = 204): Spec[] => s.map(([o, h, l, x]) => [c - o, c - l, c - h, c - x]);

/**
 * Monday (bars 0-23): high 104 at bar 8, low 100 at bar 16, otherwise 101-103. Tuesday 06:00 (bar 30): raid of the low
 * to 99.8 with a same-bar close back above 100. Bar 31: MSB (close above the raid bar's high). Zone = bar 30 (down-close)
 * [99.8, 100.6]. Bar 33: retest (low 100.5, close 100.9). Target 104 untouched since Tuesday 00:00.
 */
function week(opts: { raid?: boolean; reclaim?: boolean; msb?: boolean; retest?: 'ok' | 'inside' | 'through' | 'none'; consumeTarget?: boolean; smallRange?: boolean; dropMondayBar?: boolean } = {}): Spec[] {
  const { raid = true, reclaim = true, msb = true, retest = 'ok', consumeTarget = false, smallRange = false, dropMondayBar = false } = opts;
  const s: Spec[] = [];
  if (smallRange) for (let i = 0; i < 24; i++) s.push(i === 16 ? [100.3, 100.35, 100, 100.2] : flat(100.4));   // Monday range 0.5%
  else for (let i = 0; i < 24; i++) s.push(i === 8 ? [102.5, 104, 102.4, 103] : i === 16 ? [101.2, 101.3, 100, 100.4] : flat(101.5 + (i % 4) * 0.3));
  if (dropMondayBar) s[12] = [NaN, NaN, NaN, NaN];
  for (let i = 24; i < 30; i++) s.push(flat(101 - (i - 24) * 0.1));                                   // Tue 00:00-05:00, drifting down to 100.5
  if (!raid) { for (let i = 0; i < 150; i++) s.push(flat(101)); return s; }
  if (!reclaim) { s.push([100.5, 100.6, 99.8, 99.7]); for (let i = 0; i < 30; i++) s.push(flat(99.6)); return s; }
  s.push([100.5, 100.6, 99.8, 100.3]);                                                                // 30: raid, same-bar reclaim, down-close => zone [99.8, 100.6]
  if (!msb) { for (let i = 0; i < 80; i++) s.push(flat(100.3)); return s; }
  s.push([100.3, 101.0, 100.2, 100.9]);                                                                // 31: MSB (close 100.9 > 100.6)
  s.push(flat(101.2));                                                                                 // 32
  if (consumeTarget) s.push([101.2, 104.2, 101.1, 103.5]);                                             // touches the Monday high before the retest
  if (retest === 'none') { for (let i = 0; i < 80; i++) s.push(flat(101.2)); return s; }
  if (retest === 'inside') { s.push([101.2, 101.3, 100.5, 100.4]); s.push(flat(100.4)); return s; }
  if (retest === 'through') { s.push([101.2, 101.3, 99.5, 99.6]); s.push(flat(99.6)); return s; }
  s.push([101.2, 101.3, 100.5, 100.9]);                                                                // 33 (or 34): retest closes back above 100.6
  s.push(flat(101.5), flat(102), flat(102.5));
  return s;
}
const run = (specs: Spec[], params: Record<string, number | string> = {}) => {
  const clean = specs.filter(x => !Number.isNaN(x[0]));
  // A dropped Monday bar is simulated by removing that hour's minutes from the tape.
  const minutes = hourly(specs.map(x => Number.isNaN(x[0]) ? flat(0) : x)).filter(m => !(specs[Math.floor((m.ts - t0) / H)] && Number.isNaN(specs[Math.floor((m.ts - t0) / H)][0])));
  void clean;
  return detectMondayRange(buildContext({ symbol: 'T', minutes, lagMs: 60_000, window: { start: t0, end: t0 + specs.length * H }, params: { ...mr01MondayRange.defaults, ...params } }));
};
const reasons = (specs: Spec[], params?: Record<string, number | string>) => run(specs, params).map(e => `${e.side}:${e.stage}:${e.reason ?? 'confirmed'}`);

// ── confirmed long ──
{
  const ev = run(week()); const c = ev.filter(e => e.stage === 'confirmed');
  assert.equal(c.length, 1, `one confirmed long, got ${reasons(week()).join(',')}`);
  const e = c[0];
  assert.equal(e.side, 1); assert.deepEqual(Object.keys(e.stages), ['range', 'raid', 'reclaim', 'msb', 'zone', 'retest']);
  assert.deepEqual((e.reference as any).range, { high: 104, low: 100 });
  assert.equal(e.stages.range.knownAt, t0 + 24 * H + 60_000, 'range known when the last Monday bar is available');
  assert.equal(e.stages.raid.at, t0 + 30 * H); assert.equal(e.stages.raid.price, 99.8); assert.equal(e.stages.msb.at, t0 + 31 * H);
  assert.deepEqual((e.reference as any).zone, { low: 99.8, high: 100.6, originAt: t0 + 30 * H });
  assert.equal(e.stages.retest.at, t0 + 33 * H);
  assert.ok(Math.abs(e.proxies.stop! - 99.8 * 0.999) < 1e-9); assert.ok(Math.abs(e.proxies.target! - 104 * 1.001) < 1e-9);
  for (const s of Object.values(e.stages)) assert(s.knownAt >= s.at && s.knownAt <= e.knownAt);
  // The short side of the same week never raided the high: expired no_raid at the week end (or pending at cutoff).
  assert(reasons(week()).some(r => r.startsWith('-1:') && r.endsWith(':no_raid')));
}

// ── msb entry, rejections, control weekday ──
{
  const m = run(week({ retest: 'none' }), { entryMode: 'msb' }).filter(e => e.stage === 'confirmed');
  assert.equal(m.length, 1); assert.equal(m[0].formationAt, t0 + 31 * H);
  assert(reasons(week({ raid: false })).some(r => r.endsWith(':no_raid')));
  assert(reasons(week({ reclaim: false })).includes('1:invalidated:raid_no_reclaim'));
  assert(reasons(week({ msb: false })).some(r => r.endsWith(':no_msb')));
  assert(reasons(week({ retest: 'none' })).some(r => r.endsWith(':no_retest')));
  assert(reasons(week({ retest: 'inside' })).includes('1:rejected:retest_closed_inside_zone'));
  assert(reasons(week({ retest: 'through' })).includes('1:invalidated:retest_through_zone'));
  assert(reasons(week({ consumeTarget: true })).includes('1:rejected:target_consumed'), 'Monday high touched before entry consumes the target');
  assert(reasons(week({ smallRange: true })).includes('1:rejected:range_too_small'));
  assert(reasons(week({ dropMondayBar: true })).includes('1:rejected:incomplete_range_day'));
  assert.throws(() => run(week(), { entryMode: 'bogus' })); assert.throws(() => run(week(), { rangeDay: 9 }));
  // Control: the same tape with rangeDay = Wednesday has no Wednesday range before the tape ends, so no MR01 rows at all.
  assert.equal(run(week(), { rangeDay: 3 }).length, 0);
}

// ── mirrored short (raid of the Monday high) ──
{
  const ev = run(mirror(week())); const c = ev.filter(e => e.stage === 'confirmed');
  assert.equal(c.length, 1, `one confirmed short, got ${reasons(mirror(week())).join(',')}`);
  const e = c[0]; assert.equal(e.side, -1);
  assert.deepEqual((e.reference as any).range, { high: 104, low: 100 }); assert.equal(e.stages.raid.price, 104.2);
  assert.ok(Math.abs(e.proxies.stop! - 104.2 * 1.001) < 1e-9); assert.ok(Math.abs(e.proxies.target! - 100 * 0.999) < 1e-9);
}

// ── prefix invariance ──
{
  const full = run(week()); const specs = week();
  for (const cut of [26, 31, 33, 35]) {
    const cutoff = t0 + cut * H;
    for (const p of run(specs.slice(0, cut))) {
      if (p.knownAt > cutoff || p.stage === 'pending_at_cutoff' || p.stage === 'expired') continue;
      const f = full.find(x => x.id === p.id && x.side === p.side); assert(f, `row ${p.id} vanished`);
      assert.deepEqual({ stage: p.stage, reason: p.reason, formationAt: p.formationAt, knownAt: p.knownAt }, { stage: f!.stage, reason: f!.reason, formationAt: f!.formationAt, knownAt: f!.knownAt }, `row ${p.id} changed after cut ${cut}`);
    }
  }
}

console.log('mr01-monday-range tests passed');
