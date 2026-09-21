import assert from 'assert/strict';
import { runSchedule, validateTape, H, M, type Schedule } from './poc-bounce-engine';
import { runCappedEntry } from './entry-patience-standalone-engine';
import { assertEconomics } from './poc-bounce-study';
import { attribute } from './poc-hold-study';
import type { Candle } from './hype-freerun-canonical-replay';
const start = Date.UTC(2026, 0, 31, 12), end = start + 48 * H;
const minutes = Array.from({ length: (end - start) / M }, (_, i): Candle => {
  const p = 100 + Math.sin(i / 37) * 4 + Math.cos(i / 251);
  return { ts: start + i * M, endTs: start + (i + 1) * M, open: p, high: p + 0.9, low: p - 0.9, close: p + 0.1, volume: 1, turnover: p };
});
validateTape(minutes, start, end);
const schedule: Schedule[] = [0, 1, 59, 60, 61, 62, 120, 179, 180, 239, 240, 300, 360, 480, 600, 720, 721, 722, 1200, 1800, 2700, 2879].map(i => ({ at: start + i * M, id: String(i) }));
let checks = 0;
for (const delay of [0, M]) {
  const options = { start, end, delay, hold: 12 * H, equity: 32000, notional: 10000, fee: 0.00055 }, base = runSchedule(minutes, schedule, options);
  for (const hours of [1, 2, 3, 4, 5, 6, 8, 10, 12]) {
    const o = { ...options, hold: hours * H }, result = runSchedule(minutes, schedule, o);
    const ref = runCappedEntry(minutes, schedule.map(s => ({ at: s.at, cap: 1 })), { start, end, delayMs: delay, holdMs: o.hold,
      notional: o.notional, equity: o.equity, feeRate: o.fee, expiryMinutes: null, penetrationBps: 0 });
    assertEconomics(result, ref); assert.equal(result.stats.skippedOccupied, ref.stats.skippedOccupied); checks++;
    for (const t of result.trades) { assert.equal(t.entryAt, t.signalAt + delay); assert.equal(t.exitAt, t.entryAt + hours * H + delay); }
    const a = attribute(base, result);
    assert(Math.abs(a.summary.commonExitDelta + a.summary.variantOnlyNet - a.summary.baselineOnlyNet - a.summary.delta) < 1e-7); checks++;
    const until = start + 30 * H, prefixOptions = { ...o, end: until }, prefix = minutes.filter(c => c.endTs <= until);
    const poisoned = minutes.map(c => c.ts < until ? c : ({ ...c, open: 900, high: 999, low: 800, close: 888 }));
    assert.deepEqual(runSchedule(poisoned, schedule, prefixOptions), runSchedule(prefix, schedule.filter(s => s.at < until), prefixOptions)); checks++;
  }
}
// Same-minute close/next entry is legal at zero delay; pending exits block it under delay.
const exact = [{ at: start, id: 'a' }, { at: start + H, id: 'b' }];
assert.equal(runSchedule(minutes, exact, { start, end, delay: 0, hold: H, equity: 32000, notional: 10000, fee: 0.00055 }).trades.length, 2);
assert.equal(runSchedule(minutes, exact, { start, end, delay: M, hold: H, equity: 32000, notional: 10000, fee: 0.00055 }).trades.length, 1); checks++;
console.log(`PB02 tests passed: ${checks} checks; all nine holds, both delays, month boundary, cutoff inventory and future poisoning`);
