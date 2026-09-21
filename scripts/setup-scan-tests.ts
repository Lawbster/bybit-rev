/** Setup scanner tests: synthetic tapes, causality, gap tolerance, PA07 parity and resolution. */
import assert from 'assert/strict';
import { aggregateBars, buildContext, causalPivotsTolerant, forwardLabels, renderSummary, H, M, type Minute, type Bar, type SetupEvent } from './setup-scan-core';
import { detectBreakers } from './setup-detectors/pa02-breaker';
import { detectReclaims } from './setup-detectors/pa04-reclaim';
import { pa02Breaker } from './setup-detectors/pa02-breaker';
import { DETECTORS, resolveSetup } from './setup-detectors';
import { aggregate, M as PM } from './poc-indicator-bias-engine';
import { causalPivots } from './price-action-signals';

const t0 = Date.UTC(2026, 0, 5); // Monday 00:00 UTC
const LAG = M;
type Ohlc = { o: number; h: number; l: number; c: number };
const bar = (o: number, h: number, l: number, c: number): Ohlc => ({ o, h, l, c });

/** Expand OHLC bars of `tfMin` minutes into minutes: open first, high at minute 3, low at minute 7, close last. */
function minutesOf(bars: Ohlc[], tfMin: number, start = t0): Minute[] {
  const out: Minute[] = [];
  bars.forEach((b, n) => {
    for (let i = 0; i < tfMin; i++) {
      const ts = start + n * tfMin * M + i * M;
      const body = i === 0 ? b.o : i === tfMin - 1 ? b.c : (b.o + b.c) / 2;
      out.push({ ts, endTs: ts + M, open: i === 0 ? b.o : body, close: i === tfMin - 1 ? b.c : body, high: i === 3 ? b.h : Math.max(body, i === 0 ? b.o : body, i === tfMin - 1 ? b.c : body), low: i === 7 ? b.l : Math.min(body, i === 0 ? b.o : body, i === tfMin - 1 ? b.c : body), volume: 1, turnover: 1, availableAt: ts + M + LAG });
    }
  });
  return out;
}
const mirror = (ms: Minute[], k = 240): Minute[] => ms.map(m => ({ ...m, open: k - m.open, close: k - m.close, high: k - m.low, low: k - m.high }));

// ── 1. Aggregation and pivot parity with the strict PA07 helpers on a contiguous tape ──
{
  const ms = minutesOf(Array.from({ length: 48 }, (_, n) => bar(100 + Math.sin(n) * 5, 106 + Math.sin(n) * 5, 94 + Math.sin(n) * 5, 100 + Math.cos(n) * 5)), 60);
  const mine = aggregateBars(ms, 4 * H), theirs = aggregate(ms.map(m => ({ ts: m.ts, endTs: m.endTs, open: m.open, high: m.high, low: m.low, close: m.close, volume: m.volume, turnover: m.turnover })), 4 * H);
  assert.equal(mine.length, theirs.length);
  mine.forEach((b, i) => { const o = theirs[i]; assert.deepEqual([b.timestamp, b.open, b.high, b.low, b.close, b.volume, b.turnover], [o.timestamp, o.open, o.high, o.low, o.close, o.volume, o.turnover]); assert.equal(b.availableAt, b.timestamp + 4 * H + LAG); });
  const p1 = causalPivotsTolerant(mine, 4 * H, 2, LAG).map(p => [p.kind, p.price, p.pivotAt, p.confirmationEnd, p.availableAt]);
  const p2 = causalPivots(theirs, 4 * H, 2, LAG).map(p => [p.kind, p.price, p.pivotAt, p.confirmationEnd, p.availableAt]);
  assert.deepEqual(p1, p2, 'pivot parity with PA07 on a contiguous tape');
  assert.equal(PM, M);
}

// ── 2. Gap tolerance: a missing minute drops exactly its bar; pivots need contiguous neighbourhoods ──
{
  const ms = minutesOf(Array.from({ length: 24 }, (_, n) => bar(100, 101 + (n === 10 ? 5 : 0), 99, 100)), 60);
  const gapped = ms.filter(m => m.ts !== t0 + 5 * H + 30 * M);
  const bars = aggregateBars(gapped, H);
  assert.equal(bars.length, 23); assert(!bars.some(b => b.timestamp === t0 + 5 * H), 'bar with a missing minute is excluded');
  const ctx = buildContext({ symbol: 'T', minutes: gapped, lagMs: LAG, window: { start: t0, end: t0 + 24 * H }, params: {} });
  const ps = ctx.pivots(H, 1);
  assert(ps.some(p => p.kind === 'high' && p.pivotAt === t0 + 10 * H), 'pivot away from the gap still found');
  assert(!ps.some(p => p.pivotAt === t0 + 4 * H || p.pivotAt === t0 + 6 * H), 'pivots adjacent to the gap are not declared');
  assert(ctx.hit(105.5, 1, t0 + 10 * H, t0 + 11 * H) && !ctx.hit(105.5, 1, t0 + 11 * H, t0 + 12 * H));
}

// ── 3. PA02 breaker on a synthetic sequence (context 1h pivots width 1, trigger 15m) ──
const P = { contextTfMinutes: 60, triggerTfMinutes: 15, pivotWidth: 1, bufferPct: 0.1, sweepExpiryHours: 168, failExpiryHours: 168, retestExpiryHours: 72 };
function breakerTape(variant: 'good' | 'no_sweep' | 'no_hh' | 'through' | 'inside') {
  const q: Ohlc[] = [];
  const hour = (bs: Ohlc[]) => { assert.equal(bs.length, 4); q.push(...bs); };
  hour([bar(102, 105, 101, 103), bar(103, 104, 102, 103), bar(103, 104, 100, 101), bar(101, 102, 100, 101)]);          // H0: high 105 low 100
  hour([bar(101, 102, 96, 97), bar(97, 99, 95, 96), bar(96, 98, 95, 97), bar(97, 100, 96, 99)]);                        // H1: pivot LOW Q = 95
  hour([bar(99, 104, 98, 103), bar(103, 108, 102, 107), bar(107, 110, 106, 109), bar(109, 110, 105, 106)]);             // H2: high 110 low 98
  hour([bar(106, 110, 105, 110), bar(110, 118, 109, 118), bar(118, 119, 116, 119), bar(119, 120, 108, 108)]);            // H3: pivot HIGH P = 120; origin = last up bar [116,119]
  hour([bar(108, 112, 104, 104), bar(104, 105, 101, 101), bar(101, 102, 100, 100), bar(100, 103, 100, 102)]);           // H4: low 100 (no sweep of 95)
  const sweepLow = variant === 'no_sweep' ? 96 : 94;
  hour([bar(102, 103, 96, 97), bar(97, 98, sweepLow, 96), bar(96, 105, 95, 104), bar(104, 112, 103, 111)]);            // H5: sweep of Q at 15m bar 21
  if (variant === 'no_hh') {
    // Zone fails (close 119.5 > 119 * 1.001) but no close ever exceeds the context pivot 120 * 1.001.
    hour([bar(111, 121, 110, 119.5), bar(119.5, 120, 119, 119.8), bar(119.8, 120, 117, 119), bar(119, 120, 118, 119.5)]);
    for (let i = 0; i < 12; i++) hour([bar(119, 120, 118, 119), bar(119, 120, 118, 119.5), bar(119.5, 120, 118.5, 119), bar(119, 120, 118, 119.2)]);
    return minutesOf(q, 15);
  }
  const retest = variant === 'through' ? bar(122, 123, 115, 118) : variant === 'inside' ? bar(122, 123, 117, 117.5) : bar(122, 123, 117, 119.5);
  hour([bar(111, 121, 110, 120.5), bar(120.5, 124, 119.5, 122), retest, bar(retest.c, 126, retest.c - 1, 125)]); // H6: fail + HH at bar 24, retest at bar 26
  for (let i = 0; i < 12; i++) hour([bar(125, 128, 124, 126), bar(126, 129, 125, 127), bar(127, 130, 126, 128), bar(128, 131, 127, 129)]); // flat-up follow-through for labels
  return minutesOf(q, 15);
}
function scan(ms: Minute[]): SetupEvent[] {
  const ctx = buildContext({ symbol: 'T', minutes: ms, lagMs: LAG, window: { start: t0, end: ms[ms.length - 1].endTs }, params: P });
  return detectBreakers(ctx);
}
{
  const good = scan(breakerTape('good'));
  const longs = good.filter(e => e.side === 1 && e.stage === 'confirmed');
  assert.equal(longs.length, 1, `exactly one confirmed long breaker, got ${JSON.stringify(good.map(e => [e.side, e.stage, e.reason]))}`);
  const e = longs[0];
  assert.deepEqual(e.reference.zone, { low: 116, high: 119, originAt: t0 + 3 * H + 30 * M });
  assert.equal(e.stages.sweep.at, t0 + 5 * H + 15 * M); assert.equal(e.stages.fail.at, t0 + 6 * H); assert.equal(e.stages.structure.at, t0 + 6 * H); assert.equal(e.stages.retest.at, t0 + 6 * H + 30 * M);
  assert.equal(e.knownAt, t0 + 6 * H + 45 * M + LAG, 'known at retest bar end + lag');
  assert(e.stages.context.knownAt === t0 + 5 * H + LAG, 'context pivot published after its second right-hand bar');
  assert(Object.values(e.stages).every(s => s.knownAt <= e.knownAt && s.knownAt >= s.at));
  assert.equal(e.proxies.stop, 116 * 0.999); assert.equal(e.proxies.target, null); assert(e.notes.includes('no_known_untouched_target'));
  const shorts = scan(mirror(breakerTape('good'))).filter(e => e.side === -1 && e.stage === 'confirmed');
  assert.equal(shorts.length, 1, 'mirrored tape yields exactly one confirmed short breaker');
  assert.deepEqual(shorts[0].reference.zone, { low: 240 - 119, high: 240 - 116, originAt: t0 + 3 * H + 30 * M });
  const noSweep = scan(breakerTape('no_sweep')).find(e => e.side === 1 && e.stages.fail);
  assert(noSweep && noSweep.stage === 'rejected' && noSweep.reason === 'no_sweep_before_fail' && noSweep.notes.includes('generic_failed_zone_control'), 'generic failed zone is kept as a rejected control row');
  const noHh = scan(breakerTape('no_hh')).find(e => e.side === 1 && e.stages.fail);
  assert(noHh && noHh.stage !== 'confirmed' && noHh.reason === 'no_structure_break', `fail without HH: ${noHh?.stage}/${noHh?.reason}`);
  const through = scan(breakerTape('through')).find(e => e.side === 1 && e.stages.fail);
  assert(through && through.stage === 'invalidated' && through.reason === 'retest_through_zone');
  const inside = scan(breakerTape('inside')).find(e => e.side === 1 && e.stages.retest);
  assert(inside && inside.stage === 'rejected' && inside.reason === 'retest_closed_inside_zone');
}

// ── 4. Prefix invariance: truncating the future never changes events already known ──
{
  const full = breakerTape('good'), all = scan(full);
  const stamp = (e: SetupEvent) => JSON.stringify({ ...e, stage: e.stage === 'pending_at_cutoff' ? 'pending' : e.stage });
  for (const cut of [t0 + 5 * H + 30 * M, t0 + 6 * H + 45 * M + LAG - 1, t0 + 6 * H + 45 * M + LAG, t0 + 9 * H]) {
    const part = scan(full.filter(m => m.endTs <= cut));
    for (const e of part) assert(e.knownAt <= cut + LAG || e.stage === 'pending_at_cutoff', `event known after cutoff: ${e.id} ${e.knownAt} > ${cut}`);
    for (const e of all.filter(x => x.knownAt <= cut && x.stage !== 'pending_at_cutoff')) {
      const twin = part.find(p => p.id === e.id); assert(twin, `known event missing after truncation at ${cut}: ${e.id}`);
      assert.equal(stamp(twin), stamp(e), `event changed by future data: ${e.id}`);
    }
  }
}

// ── 5. PA04 reclaim: outside close below a known pivot low then a close back above ──
{
  const q: Ohlc[] = [];
  const hour = (bs: Ohlc[]) => q.push(...bs);
  hour([bar(102, 105, 101, 103), bar(103, 104, 102, 103), bar(103, 104, 100, 101), bar(101, 102, 100, 101)]);
  hour([bar(101, 102, 96, 97), bar(97, 99, 95, 96), bar(96, 98, 95, 97), bar(97, 100, 96, 99)]);   // pivot low 95 (H1)
  hour([bar(99, 104, 98, 103), bar(103, 108, 102, 107), bar(107, 110, 106, 109), bar(109, 110, 105, 106)]); // H2 confirms it; known at H2 end + lag
  hour([bar(106, 107, 96, 97), bar(97, 98, 93, 94.5), bar(94.5, 95.5, 92, 93), bar(93, 97, 92.5, 96)]);  // H3: outside close 94.5 (bar 13) then reclaim 96 (bar 15)
  for (let i = 0; i < 8; i++) hour([bar(96, 99, 95, 98), bar(98, 100, 97, 99), bar(99, 101, 98, 100), bar(100, 102, 99, 101)]);
  const ms = minutesOf(q, 15);
  const ctx = buildContext({ symbol: 'T', minutes: ms, lagMs: LAG, window: { start: t0, end: ms[ms.length - 1].endTs }, params: { contextTfMinutes: 60, triggerTfMinutes: 15, pivotWidth: 1, bufferPct: 0.1, breakMaxAgeHours: 168, reclaimExpiryHours: 24 } });
  const ev = detectReclaims(ctx).filter(e => e.side === 1);
  assert.equal(ev.length, 1); const e = ev[0];
  assert.equal(e.stage, 'confirmed'); assert.equal(e.stages.outside.at, t0 + 3 * H + 15 * M); assert.equal(e.stages.reclaim.at, t0 + 3 * H + 45 * M);
  assert.equal(e.proxies.stop, 92 * 0.999); assert.equal(e.knownAt, t0 + 4 * H + LAG);
  // Stay below the pivot for 30h after the outside close so the 24h reclaim window expires before the tape ends.
  const noReclaim = minutesOf([...q.slice(0, 14), ...Array.from({ length: 4 * 30 }, () => bar(93, 94, 92, 93))], 15);
  const ctx2 = buildContext({ symbol: 'T', minutes: noReclaim, lagMs: LAG, window: { start: t0, end: noReclaim[noReclaim.length - 1].endTs }, params: ctx.params });
  const ex = detectReclaims(ctx2).filter(e => e.side === 1);
  assert.equal(ex.length, 1); assert.equal(ex[0].stage, 'expired'); assert.equal(ex[0].reason, 'no_reclaim');
}

// ── 6. Forward labels: entry proxy is the next minute open after known-at; censoring; barriers ──
{
  const ms = breakerTape('good');
  const ctx = buildContext({ symbol: 'T', minutes: ms, lagMs: LAG, window: { start: t0, end: ms[ms.length - 1].endTs }, params: P });
  const ev = detectBreakers(ctx).filter(e => e.stage === 'confirmed');
  const [l] = forwardLabels(ctx, ev);
  assert.equal(l.entryProxyAt, ev[0].knownAt, 'entry proxy at first minute at/after known-at');
  assert(l.ret4hPct !== null && l.ret4hPct > 0 && l.mfe24hPct! >= l.ret4hPct && l.mae24hPct! <= 0);
  assert.equal(l.firstBarrier, 'none', 'no target proxy and stop never hit');
  const short = buildContext({ symbol: 'T', minutes: ms.filter(m => m.ts < ev[0].knownAt + 3 * H), lagMs: LAG, window: { start: t0, end: t0 + 24 * H }, params: P });
  const [c] = forwardLabels(short, detectBreakers(short).filter(e => e.stage === 'confirmed'));
  assert(c.censored && c.ret24hPct === null && c.ret1hPct !== null, 'labels beyond the tape are censored');
  const summary = renderSummary({ detector: pa02Breaker, req: { setup: 'PA02', symbol: 'T', from: t0, to: t0 + 24 * H, lagMs: LAG, tape: 'live', params: P, charts: false, maxChartEvents: 10 }, identity: { source: 'live_jsonl', file: 'x', sha256: 'y', start: t0, end: t0 + 24 * H, rows: ms.length, gaps: [], duplicates: 0, conflicts: 0, note: 'test' }, events: ev, labels: [l], key: 'k', chartsDir: null });
  assert(summary.includes('descriptive occurrence ledger') && summary.includes('| long |') && summary.includes('| no_known_untouched_target | 1 |'), 'summary lists confirmed-row notes');
}

// ── 7. Resolution ──
{
  assert.equal(resolveSetup('RF breaker').status, 'detector'); assert.equal((resolveSetup('are there any rf breaker setups on hype') as any).detector.id, 'PA02');
  assert.equal((resolveSetup('pa04') as any).detector.id, 'PA04'); assert.equal((resolveSetup('sweep and impulse') as any).detector.id, 'PA06');
  assert.equal((resolveSetup('three tap') as any).detector?.id, 'PA05', 'three-tap has a detector since 2026-09-20');
  const lib = { records: [{ id: 'PA01', title: 'Range sweep, structure break, origin-zone retest', tags: ['range', 'msb', 'retest'] }] };
  assert.deepEqual(resolveSetup('PA01', lib), { status: 'library_only', id: 'PA01', title: 'Range sweep, structure break, origin-zone retest' });
  assert.equal(resolveSetup('something else').status, 'unknown');
  assert.equal(new Set(DETECTORS.map(d => d.id)).size, DETECTORS.length);
  // A detector points at its own library card, or at its parent family card when the library has no record of its own yet (RS01 -> PA01).
  for (const d of DETECTORS) {
    assert(d.conventions.length && d.aliases.length);
    assert(d.libraryCard.startsWith('research/setup-library/') && /\.md#(PA|CTX|MOD|TGT|EXIT)\d{2}$/.test(d.libraryCard), `${d.id} must point at a library card`);
    assert(d.libraryCard.includes(d.id) || ['RS01', 'MR01', 'SF01', 'OB01'].includes(d.id), `${d.id} card mismatch`); // RS01/SF01 -> PA01 family; SF01 tests only sweep/reclaim, not full MSB/retest.
  }
}

console.log('setup-scan tests passed');
