import assert from 'assert/strict';
import { buildContext, H, M, type Minute } from '../setup-scan-core';
import { buildActions } from '../setup-replay';
import { detectRangeLowSfp, sf01RangeLow } from './sf01-range-low';

const t0 = Date.UTC(2026, 0, 1), tf = 4 * H;
type Spec = [number, number, number, number];
const flat = (p: number): Spec => [p, p + 0.2, p - 0.2, p];
function fixture(): Spec[] {
  return [flat(105), flat(104), flat(102), [102, 103, 100, 101], flat(103), flat(105), flat(108),
    [108, 112, 107, 110], flat(109), flat(107), flat(106), flat(105), [105, 106, 99, 101], flat(103), flat(105), flat(106)];
}
function minutes(specs: Spec[]): Minute[] {
  return specs.flatMap(([o, h, l, c], i) => Array.from({ length: 240 }, (_, m) => {
    const ts = t0 + i * tf + m * M;
    const close = m === 239 ? c : o;
    return { ts, endTs: ts + M, open: o, close, high: m === 60 ? h : Math.max(o, close), low: m === 120 ? l : Math.min(o, close), volume: 1, turnover: 0, availableAt: ts + 2 * M };
  }));
}
const run = (ms: Minute[], params: Record<string, number | string> = {}) => detectRangeLowSfp(buildContext({ symbol: 'TEST', minutes: ms, lagMs: M,
  window: { start: t0, end: ms.at(-1)!.endTs }, params: { ...sf01RangeLow.defaults, ...params } }));
const level = (es: ReturnType<typeof run>) => es.find(e => e.stages.level.price === 100)!;
const ms = minutes(fixture()), e = level(run(ms));
assert(e && e.stage === 'confirmed', JSON.stringify(e));
assert.equal(e.stages.level.knownAt, t0 + 6 * tf + M);
assert.equal(e.stages.sweep.at, t0 + 12 * tf);
assert.equal(e.knownAt, t0 + 13 * tf + M);
assert.equal(e.proxies.stop, 99 * 0.999); assert.equal(e.proxies.target, 112);
assert.equal(e.reference.rangeQualified, true);
assert.deepEqual(e, level(run(ms, { requireRange: 0 })), 'qualified A and B event/stop/clock are identical');
const generic = level(run(ms, { rangeMinHeightPct: 50, requireRange: 0 }));
assert.equal(generic.stage, 'confirmed'); assert.equal(generic.reference.rangeQualified, false);
assert.equal(level(run(ms, { rangeMinHeightPct: 50 })).stage, 'rejected');
const x = fixture(); x[12][3] = 99.5; x[13] = [99.5, 102, 98, 101];
const lateReclaim = level(run(minutes(x))); assert.equal(lateReclaim.stages.reclaim.at, t0 + 13 * tf); assert.equal(lateReclaim.proxies.stop, 98 * 0.999);
const fail = fixture(); fail[12][3] = 99.5; fail.splice(13, 3, ...Array.from({ length: 12 }, () => flat(99)));
assert.equal(level(run(minutes(fail))).reason, 'no_reclaim'); assert.equal(level(run(minutes(fail))).stage, 'expired');
const consumed = fixture(); consumed[12][1] = 113;
assert.equal(level(run(minutes(consumed))).reason, 'range_target_consumed');
assert.equal(level(run(minutes(consumed), { requireRange: 0 })).stage, 'confirmed');
const gap = ms.filter(m => m.ts !== t0 + 10 * tf + M);
assert.equal(level(run(gap)).reason, 'context_gap');
const delayed = ms.map(m => m.ts === t0 + 10 * tf + 239 * M ? { ...m, availableAt: m.availableAt + H } : m);
assert.equal(level(run(delayed)).reason, 'late_context');
assert.throws(() => run(ms, { requireRange: 2 }));
// Completed historical events may not change as more data arrives, even if
// it forms huge new highs/lows. Pending statuses are explicitly not signals.
for (let cut = 240; cut <= ms.length; cut += 127) {
  const prefix = ms.slice(0, cut), cutoff = prefix.at(-1)!.endTs;
  for (const a of run(prefix).filter(v => v.stage === 'confirmed' && v.knownAt <= cutoff)) {
    assert.deepEqual(a, run(ms).find(z => z.id === a.id), `prefix ${cut}`);
  }
}
assert(!run(ms.slice(0, 13 * 240)).some(a => a.id === e.id && a.stage === 'confirmed'), 'bar close without publication lag is not actionable');
const poison = minutes([...fixture(), [106, 1000, 1, 800], flat(900), flat(700), flat(1000)]);
assert.deepEqual(level(run(poison)), e, 'future extrema cannot change a frozen range');
const repeated = minutes([...fixture(), [106, 107, 98, 101], flat(103), flat(105)]);
assert.equal(run(repeated).filter(z => z.id === e.id).length, 1);
const actions = buildActions([e], { side: 1, target: 'r2', holdHours: 24 }, { riskMinPct: 0.2, riskMaxPct: 5, stopBufferPct: 0, includeControls: false });
assert.equal(actions.actions[0].at, e.knownAt); assert.equal(actions.actions[0].stop, e.proxies.stop);
assert.equal(actions.actions[0].target, 101 + 2 * (101 - 99 * 0.999));
console.log('SF01 tests passed: causal range, control parity, reclaim/expiry, consumed target, gaps, late inputs, prefix/poison, first sweep and entry clock');
