import assert from 'assert/strict';
import { buildContext, H, M, type Minute } from '../setup-scan-core';
import { buildActions } from '../setup-replay';
import { detectRangeLowSfp, sf01RangeLow } from './sf01-range-low';

const t0 = Date.UTC(2026, 0, 1), tf = 4 * H;
const flat = (p: number) => [p, p + .2, p - .2, p];
const specs = [flat(105), flat(104), flat(102), [102, 103, 100, 101], flat(103), flat(105), flat(108),
  [108, 112, 107, 110], flat(109), flat(107), flat(106), flat(105), [105, 106, 99, 101], flat(103), flat(105), flat(106)];
const ms: Minute[] = specs.flatMap(([o, h, l, c], i) => Array.from({ length: 240 }, (_, m) => {
  const ts = t0 + i * tf + m * M;
  const close = m === 239 ? c : o;
  return { ts, endTs: ts + M, open: o, close, high: m === 60 ? h : Math.max(o, close),
    low: m === 120 ? l : Math.min(o, close), volume: 1, turnover: 0, availableAt: ts + 2 * M };
}));
const ctx = (xs: Minute[], triggerTfMinutes = 15) => buildContext({ symbol: 'TEST', minutes: xs, lagMs: M,
  window: { start: t0, end: xs.at(-1)!.endTs }, params: { ...sf01RangeLow.defaults, triggerTfMinutes } });
const run = (xs: Minute[], triggerTfMinutes = 15) => detectRangeLowSfp(ctx(xs, triggerTfMinutes));
const level = (es: ReturnType<typeof run>) => es.find(e => e.stages.level.price === 100)!;
const early = level(run(ms)), old = level(run(ms, 240));
assert.equal(early.stage, 'confirmed'); assert.equal(early.knownAt, t0 + 12 * tf + 136 * M);
assert(early.knownAt < old.knownAt); assert.deepEqual(early.reference.low, old.reference.low);
assert.deepEqual(early.reference.rangeHigh, old.reference.rangeHigh);
assert.equal(early.proxies.stop, 99 * .999); assert.equal(early.reference.triggerTfMinutes, 15);
assert(!level(run(ms.filter(m => m.endTs <= early.knownAt - M))).stages.reclaim, 'publication lag required');
const poisoned = ms.map(m => m.ts >= early.knownAt && m.ts < t0 + 13 * tf ? { ...m, low: 70, close: 71 } : m);
assert.deepEqual(level(run(poisoned)), early, 'later lows inside the same 4h bar cannot widen early stop');
assert.notEqual(level(run(poisoned, 240)).proxies.stop, early.proxies.stop);
const gap = ms.filter(m => m.ts !== t0 + 10 * tf + M);
assert.equal(level(run(gap)).reason, 'context_gap');
const late = ms.map(m => m.ts === t0 + 10 * tf + 14 * M ? { ...m, availableAt: m.availableAt + H } : m);
assert.equal(level(run(late)).reason, 'late_context');
const unavailable = ctx(ms), pivots = unavailable.pivots;
unavailable.pivots = (tf, width) => pivots(tf, width).map(p => p.kind === 'high' && p.price === 112
  ? { ...p, availableAt: early.stages.sweep.at + M } : p);
assert.equal(level(detectRangeLowSfp(unavailable)).reason, 'no_known_range_high', 'high must be known before sweep starts');
for (const cut of [early.knownAt - M, early.knownAt, early.knownAt + 37 * M, t0 + 15 * tf]) {
  const got = run(ms.filter(m => m.endTs <= cut)).filter(e => e.stage === 'confirmed');
  assert.deepEqual(got, run(ms).filter(e => e.stage === 'confirmed' && e.knownAt <= cut));
}
assert.equal(run(ms).filter(e => e.id === early.id).length, 1, 'one attempt per original low');
const actions = buildActions([early], { side: 1, target: 'r2', holdHours: 24 },
  { riskMinPct: 0, riskMaxPct: 10, stopBufferPct: 0, includeControls: false });
assert.equal(actions.actions[0].at, early.knownAt);
assert.equal(actions.actions[0].target, early.proxies.entry! + 2 * (early.proxies.entry! - early.proxies.stop!));
assert.throws(() => run(ms, 17));
console.log('SF02 tests passed: 4h anchors/15m triggers, lag, same-4h future poisoning, prefix, gaps, late source, frozen stop and first attempt');
