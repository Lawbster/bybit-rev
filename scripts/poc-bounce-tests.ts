import assert from 'assert/strict';
import { buildBounceSignals, runSchedule, clockSchedule, validateTape, M, H, D, type Reader } from './poc-bounce-engine';
import { createReader, type Profile } from './poc-profile-engine';
import { runCappedEntry } from './entry-patience-standalone-engine';
import { runStandalone } from './indicator-standalone-engine';
import type { Candle } from './hype-freerun-canonical-replay';
const start = Date.UTC(2026, 0, 2), end = start + 3 * D;
const tape = Array.from({ length: (end - start) / M }, (_, i): Candle => { const p = 102 + Math.sin(i / 67); return { ts: start + i * M, endTs: start + (i + 1) * M, open: p, high: p + 1, low: p - 1, close: p + 0.1, volume: 1, turnover: p }; });
validateTape(tape, start, end);
const profile = (extra: Partial<Profile> = {}): Profile => ({ id: 'p', venue: 'bybit', symbol: 'HYPEUSDT', period: 'day',
  start: start - D, end: start, availableAt: start + M, width: '0.1', lower: '100', upper: '100.1', center: '100.05',
  volume: '1', pocVolume: '1', sharePct: 100, tiedLower: ['100'], eligible: true, reasons: [], expectedMinutes: 1440, verifiedMinutes: 1440,
  distribution: [], firstObservedRetestAt: start + 10 * M + 2000, retestKnownAt: start + 11 * M, uncertainKnownAt: null, ...extra });
let checks = 0;
for (const delay of [0, M]) {
  const schedules = [clockSchedule(start, end, delay), [0, 1, 10, 719, 720, 721, 1440, 2000, 4300].map(i => ({ at: start + i * M, id: String(i) }))];
  for (const signals of schedules) {
    const o = { start, end, delay, hold: 12 * H, equity: 32000, notional: 10000, fee: 0.00055 };
    const result = runSchedule(tape, signals, o), other = runCappedEntry(tape, signals.map(s => ({ at: s.at, cap: 1 })),
      { ...o, delayMs: delay, holdMs: o.hold, feeRate: o.fee, expiryMinutes: null, penetrationBps: 0 });
    for (const key of ['net', 'closedNet', 'openNet', 'feesPaid', 'turnoverIncludingMarkedExit', 'exposureHours', 'maxAdverseDrawdownPct', 'maxCloseDrawdownPct', 'rawSignals', 'skippedOccupied'] as const) assert(Math.abs(result.stats[key] - other.stats[key]) < 1e-6, key);
    result.monthly.forEach((x, i) => assert(Math.abs(x.markedNet - other.monthly[i].markedNet) < 1e-6)); checks++;
  }
  const old = runStandalone(tape.map(c => ({ timestamp: c.ts, ...c })), [], { id: 'clock', family: 'clock', side: 'long', exit: 'fixed12h' },
    { start, end, delayMs: delay, holdMs: 12 * H, equity: 32000, notional: 10000, feeRate: 0.00055 });
  const fresh = runSchedule(tape, clockSchedule(start, end, delay), { start, end, delay, hold: 12 * H, equity: 32000, notional: 10000, fee: 0.00055 });
  assert(Math.abs(old.stats.net - fresh.stats.net) < 1e-6); assert(Math.abs(old.stats.maxAdverseDrawdownPct - fresh.stats.maxAdverseDrawdownPct) < 1e-6); checks++;
}
const cs = tape.slice(0, 180).map(c => ({ ...c, open: 101, high: 101.1, low: 100.5, close: 101 }));
cs[10] = { ...cs[10], low: 100.02, close: 99.9, high: 101.1 };
cs[11] = { ...cs[11], open: 99.9, low: 99.8, close: 100.05, high: 100.1 };
const reader = createReader([profile()], end);
const a = buildBounceSignals(cs, reader);
const signals = a.signals.filter(s => s.universe === 'naked');
assert.equal(a.encounters.filter(e => e.universe === 'naked').length, 1); checks++;
assert.equal(signals.find(s => !s.style)!.signalAt, start + 11 * M); checks++;
assert.equal(signals.find(s => s.style === 1)!.signalAt, start + 13 * M); checks++;
assert.equal(signals.find(s => s.style === 5)!.signalAt, start + 15 * M); checks++;
assert(!signals.some(s => s.style === 60), '00:00 hourly bar started before 00:01 publication');
assert(signals.every(s => !('firstObservedRetestAt' in s))); checks++;
const later = cs.map(c => ({ ...c, open: 101, high: 101.1, low: 100.5, close: 101 }));
later[70] = { ...later[70], low: 100.02 };
const laterReader = createReader([profile({ firstObservedRetestAt: start + 70 * M + 2, retestKnownAt: start + 71 * M })], end);
assert.equal(buildBounceSignals(later, laterReader).signals.find(s => s.universe === 'naked' && s.style === 60)!.signalAt, start + 120 * M); checks++;
const poisoned = cs.map(c => c.ts < start + 30 * M ? c : ({ ...c, high: 1000, low: 1, close: 1000 }));
assert.deepEqual(buildBounceSignals(poisoned, reader).signals.filter(s => s.signalAt <= start + 30 * M), a.signals.filter(s => s.signalAt <= start + 30 * M)); checks++;
assert.deepEqual(buildBounceSignals(cs.slice(0, 30), reader).signals, a.signals.filter(s => s.signalAt <= start + 30 * M)); checks++;
assert.equal(buildBounceSignals(cs, createReader([profile({ availableAt: start + 11 * M })], end)).encounters.length, 0); checks++;
assert.equal(buildBounceSignals(cs, createReader([profile({ uncertainKnownAt: start + 5 * M })], end)).encounters.filter(e => e.universe === 'naked').length, 0); checks++;
const oldP = profile({ start: start - 2 * D, end: start - D, availableAt: start - D + M });
assert.equal(buildBounceSignals(cs, createReader([oldP], end)).encounters.filter(e => e.universe === 'latest').length, 0); checks++;
assert.equal(buildBounceSignals(cs, reader, new Set([start + 10 * M])).encounters.length, 0); checks++;
const noRecover = cs.map((c, i) => i >= 10 ? ({ ...c, open: 99.8, high: 100.09, low: 99.7, close: 99.8 }) : c);
const b = buildBounceSignals(noRecover, reader); assert.equal(b.signals.filter(s => s.universe === 'naked' && s.style).length, 0); assert(b.expiredConfirmations >= 4); checks++;
const pubBar = createReader([profile({ availableAt: start + 10 * M })], end);
assert(!buildBounceSignals(cs, pubBar).signals.some(s => s.style === 60)); checks++;
// Verify readers cannot be queried in the future of the replayed prefix.
let greatestQuery = 0; const traced: Reader = { at(t, f) { greatestQuery = Math.max(t, greatestQuery); return reader.at(t, f); }, nakedAt(t, f) { greatestQuery = Math.max(t, greatestQuery); return reader.nakedAt(t, f); } };
buildBounceSignals(cs.slice(0, 30), traced); assert(greatestQuery <= start + 30 * M); checks++;
console.log(`PB01 tests passed: ${checks} checks (existing execution parity, no lookahead, expiry, quality and publication boundaries)`);
