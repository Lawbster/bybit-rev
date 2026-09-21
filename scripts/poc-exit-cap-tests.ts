import assert from 'assert/strict';
import fs from 'fs';
import { runCap, holdingStats } from './poc-exit-cap-engine';
import { auditCap } from './poc-exit-cap-audit';
import { exitStats } from './level-tpsl-engine';
import type { Candle } from './hype-freerun-canonical-replay';
const M = 60000, H = 60 * M, start = Date.UTC(2026, 0, 31, 12);
const cs: Candle[] = Array.from({ length: 60 * 50 }, (_, i) => ({ ts: start + i * M, endTs: start + (i + 1) * M,
  open: 100, high: 100, low: 100, close: 100, volume: 1, turnover: 100 }));
const signals = [{ id: 'a', at: start, side: 1 as const }, { id: 'b', at: start + 13 * H, side: 1 as const },
  { id: 'c', at: start + 25 * H, side: 1 as const }];
const o = { start, end: start + 50 * H, delay: 0, notional: 10000, equity: 32000, fee: .00055, targetFirst: false };
let r = runCap(cs, signals, o, null, 2, 5);
assert.equal(r.trades.length, 0); assert.equal(r.open!.id, 'a'); assert.equal(r.stats.skippedOccupied, 2);
assert.equal(r.stats.net, -11); assert.equal(holdingStats(r, o.end).openAgeHours, 50);
assert.equal(r.monthly.reduce((s, m) => s + m.markedNet, 0), -11);
assert.equal(runCap(cs, signals, o, 24, 2, 5).trades[0].exitAt, start + 24 * H);
assert.equal(runCap(cs, signals, { ...o, delay: M }, 24, 2, 5).trades[0].exitAt, start + 24 * H + 2 * M);
cs[30 * 60].high = 102;
r = runCap(cs, signals, o, null, 2, 5); assert.equal(r.trades.length, 1);
assert.equal(r.trades[0].exitAt, start + 30 * H); assert.equal(r.trades[0].reason, 'target'); assert.equal(r.trades[0].net, 188.89);
assert.equal(holdingStats(r, o.end).maxHoldHours, 30);
const prefix = runCap(cs.slice(0, 29 * 60), signals, { ...o, end: start + 29 * H }, null, 2, 5);
assert(prefix.open); assert.equal(prefix.trades.length, 0); assert.deepEqual(prefix.accepted, r.accepted);
cs[30 * 60].low = 94;
assert.equal(runCap(cs, signals, o, null, 2, 5).trades[0].reason, 'stop');
assert.equal(runCap(cs, signals, { ...o, targetFirst: true }, null, 2, 5).trades[0].reason, 'target');
cs[30 * 60].open = 93; cs[30 * 60].low = 93;
assert.equal(runCap(cs, signals, { ...o, targetFirst: true }, null, 2, 5).trades[0].exitPrice, 93);
cs[24 * 60].high = 110;
assert.equal(runCap(cs, signals, o, 24, 2, 5).trades[0].reason, 'timeout', 'At timeout minute scheduled open precedes later high');
assert.equal(runCap(cs, signals, o, 24, null, null).trades[0].reason, 'timeout');
assert.throws(() => runCap(cs, signals, o, null, null, null));
const c = JSON.parse(fs.readFileSync('research-inputs/poc-exit-cap-lv03-2026-09-17.json', 'utf8'));
assert.equal(c.tpPct.length * c.slPct.length * 2 + 1, c.newDefinitions);
for (const capHours of [12, 24, null]) for (const targetFirst of [false, true]) {
  const opts = { ...o, targetFirst }, run = runCap(cs, signals, opts, capHours, 2, 5);
  const row = { capHours, targetFirst, tpPct: 2, slPct: 5, delay: 0, ...run.stats, ...exitStats(run), ...holdingStats(run, o.end),
    stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * 5 / 10000 };
  auditCap(cs, signals, row, { options: { ...opts, capHours }, ...run }, c);
  if (run.trades.length) {
    const bad = structuredClone(run); bad.trades[0].exitAt -= M;
    assert.throws(() => auditCap(cs, signals, row, { options: { ...opts, capHours }, ...bad }, c));
  }
}
const quiet = cs.map(b => ({ ...b, open: 100, high: 100, low: 100, close: 100 }));
for (const [capHours, tpPct, slPct] of [[null, 2, 5], [24, null, null]] as const) {
  const run = runCap(quiet, signals, o, capHours, tpPct, slPct);
  const row = { capHours, tpPct, slPct, delay: 0, targetFirst: false, ...run.stats, ...exitStats(run), ...holdingStats(run, o.end),
    stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * 5 / 10000 };
  auditCap(quiet, signals, row, { options: { ...o, capHours }, ...run }, c);
}
console.log('LV03 tests passed:12/24h/no cap, >24h barrier, never-hit/open marks, ownership, exact timeout, delay, gaps/both-hit, monthly and causal prefix.');
