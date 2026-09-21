import assert from 'assert/strict';
import { highSignals } from './high-touch-short-signals';
import { runCap, holdingStats } from './poc-exit-cap-engine';
import { exitStats } from './level-tpsl-engine';
import { auditShort } from './high-touch-short-audit';
import type { Candle } from './hype-freerun-canonical-replay';
const M = 60000, start = Date.UTC(2026, 0, 31, 23, 50);
const cs: Candle[] = Array.from({ length: 40 }, (_, i) => ({ ts: start + i * M, endTs: start + (i + 1) * M,
  open: 100, high: 100, low: 100, close: 100, volume: 1, turnover: 100 }));
cs[5] = { ...cs[5], open: 102, high: 102, low: 101, close: 101.5 };
let made = highSignals(cs, 4);
assert(!made.groups[0].evidence.some(e => e.observationStart === cs[5].ts), 'Gap wholly above frozen high is not a touch');
const e = made.groups[0].evidence.find(e => e.observationStart === cs[6].ts)!;
assert.equal(e.high, 100, 'Latest forming/unreceived high excluded');
assert.equal(e.referenceAvailableAt, e.observationStart); assert.equal(e.at, e.observationEnd + M);
assert(!made.groups[1].evidence.some(e => e.observationStart === cs[6].ts), 'Near zone includes just-closed new high in own window');
const prefix = highSignals(cs.slice(0, 20), 4);
for (let g = 0; g < 2; g++) assert.deepEqual(prefix.groups[g].signals, made.groups[g].signals.filter(s => s.at <= cs[19].endTs + M));
const poison = cs.map((b, i) => i < 20 ? b : { ...b, high: 100000 });
for (let g = 0; g < 2; g++) assert.deepEqual(highSignals(poison, 4).groups[g].signals.filter(s => s.at <= cs[19].endTs + M), prefix.groups[g].signals);
assert.throws(() => highSignals(cs.filter((_, i) => i !== 3), 4));
const sigs = [{ id: 'a', at: cs[1].ts, side: -1 as const }, { id: 'b', at: cs[12].ts, side: -1 as const }];
const o = { start, end: cs.at(-1)!.endTs, delay: 0, notional: 10000, equity: 32000, fee: .00055, targetFirst: false };
function check(bars: Candle[], tp: number | null, sl: number | null, targetFirst = false, delay = 0) {
  const opts = { ...o, targetFirst, delay }, run = runCap(bars, sigs, opts, 12, tp, sl);
  const row = { capHours: 12, tpPct: tp, slPct: sl, delay, targetFirst, ...run.stats, ...exitStats(run), ...holdingStats(run, o.end),
    stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * 5 / 10000 };
  auditShort(bars, sigs, row, { options: { ...opts, capHours: 12 }, ...run }, { ...o, extraCostBpsPerSide: 5 }); return run;
}
let quiet = cs.map(b => ({ ...b, open: 100, high: 100, low: 100, close: 100 }));
assert(check(quiet, 2, 5).open); check(quiet, null, null);
quiet[3].low = 98; assert.equal(check(quiet, 2, 5).trades[0].net, 189.11);
quiet[3].high = 105; assert.equal(check(quiet, 2, 5).trades[0].net, -511.275);
assert.equal(check(quiet, 2, 5, true).trades[0].reason, 'target');
quiet[3].open = 106; quiet[3].high = 106; assert.equal(check(quiet, 2, 5, true).trades[0].exitPrice, 106);
quiet[2] = { ...quiet[2], open: 110, high: 110, low: 110, close: 110 };
assert.equal(check(quiet, 2, 5, false, M).trades[0].entryPrice, 110);
console.log('HT01 tests passed: causal lagged touch vs closed near-high, gap/no touch, future prefix/poison, missing minute, short fee/stop/target/ambiguity/gaps/lag/open audit.');
