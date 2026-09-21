import assert from 'assert/strict';
import { replay, type Action } from './poc-indicator-bias-engine';
import { auditStructuralReplay } from './structural-replay-audit';
const M = 60_000, start = Date.UTC(2026, 0, 31, 23, 55);
const candles = (n: number) => Array.from({ length: n }, (_, i) => { const o = 100 + i % 3; return { ts: start + i * M, endTs: start + (i + 1) * M, open: o, high: o + 2, low: o - 2, close: o + .5, volume: 1, turnover: 1 }; });
const o = (end: number, delay = 0, targetFirst = false) => ({ start, end, delay, hold: 99 * M, notional: 1000, equity: 32000, fee: .00055, targetFirst });
const action = (id: string, at: number, side: 1 | -1 = 1, stop = 98, target = 104, expiresAt = at + 24 * 60 * M): Action => ({ id, at, side, stop, target, expiresAt, evidence: { id } });
function check(cs: any[], xs: Action[], opts: any) { const run = replay(cs, xs, opts); auditStructuralReplay(cs, xs, opts, run); return run; }
const cs = candles(60);
// Long/short, gap stop/target, intrabar priority, ownership, month crossing, cutoff, pending and explicit delayed 24h expiry.
let run = check(cs, [action('long-target', start, 1, 95, 101)], o(start + 10 * M)); assert.deepEqual([run.trades[0].reason, run.trades[0].exitAt, run.trades[0].exitPrice], ['target', start, 101]);
run = check(cs, [action('short-target', start, -1, 105, 99)], o(start + 10 * M)); assert.deepEqual([run.trades[0].reason, run.trades[0].exitAt, run.trades[0].exitPrice], ['target', start, 99]);
const gap = candles(20); gap[1] = { ...gap[1], open: 94, high: 105, low: 93, close: 100 }; run = check(gap, [action('gap-stop', start, 1, 95, 110)], o(start + 10 * M)); assert.deepEqual([run.trades[0].reason, run.trades[0].exitAt, run.trades[0].exitPrice], ['stop', start + M, 94]);
const gapTp = candles(20); gapTp[1] = { ...gapTp[1], open: 106, high: 107, low: 105, close: 106 }; run = check(gapTp, [action('gap-target', start, 1, 95, 104)], o(start + 10 * M)); assert.deepEqual([run.trades[0].reason, run.trades[0].exitAt, run.trades[0].exitPrice], ['target', start + M, 106]);
const both = candles(20); both[0] = { ...both[0], open: 100, high: 105, low: 97, close: 100 }; run = check(both, [action('both', start, 1, 98, 104)], o(start + 10 * M, 0, false)); assert.deepEqual([run.trades[0].reason, run.trades[0].exitAt, run.trades[0].exitPrice], ['stop', start, 98]); run = check(both, [action('both-target', start, 1, 98, 104)], o(start + 10 * M, 0, true)); assert.deepEqual([run.trades[0].reason, run.trades[0].exitAt, run.trades[0].exitPrice], ['target', start, 104]);
run = check(candles(30), [action('occupied', start, 1, 95, 103), action('same-minute-exit', start + M, 1, 95, 110)], o(start + 20 * M)); assert.equal(run.stats.skippedOccupied, 1); assert.equal(run.trades[0].exitAt, start + M);
run = check(candles(20), [action('open', start, 1, 90, 110)], o(start + 5 * M)); assert(run.open);
run = check(candles(20), [action('pending', start + 19 * M)], o(start + 20 * M, M)); assert.equal(run.stats.pendingAtEnd, true);
const delayed = candles(1500); const a = action('delayed-24h', start, 1, 1, 999, start + 24 * 60 * M); check(delayed, [a], o(start + 25 * 60 * M, M));
const bad = replay(cs, [action('corrupt', start)], o(start + 10 * M)); bad.trades[0].net += 1; assert.throws(() => auditStructuralReplay(cs, [action('corrupt', start)], o(start + 10 * M), bad));
for (const mutate of [(x: any) => x.open.net += 1, (x: any) => x.monthly[0].markedNet += 1, (x: any) => x.stats.maxAdverseDrawdownPct += 1, (x: any) => x.accepted.pop()]) { const x = replay(candles(20), [action('mutate', start, 1, 90, 110)], o(start + 5 * M)); mutate(x); assert.throws(() => auditStructuralReplay(candles(20), [action('mutate', start, 1, 90, 110)], o(start + 5 * M), x)); }
console.log('structural-replay-audit tests passed');
