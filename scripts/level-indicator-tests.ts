import assert from 'assert/strict';
import { passes, room } from './level-indicator-study';
import { createReader, type Profile } from './poc-profile-engine';
import { indicatorTape } from './poc-indicator-bias-engine';
import type { Candle } from './hype-freerun-canonical-replay';
const x = { side: 1, features: { crsi_15: 10, roc5_60: -2, cmf_60: .05 }, obstacle: null };
for (const f of ['baseline', 'ready', 'crsi_extreme', 'roc_stretch', 'cmf_aligned', 'npoc_room', 'cmf_npoc_room']) assert(passes(x, f));
for (const k of Object.keys(x.features)) for (const missing of [null, NaN, Infinity]) {
  const y = { ...x, features: { ...x.features, [k]: missing } };
  assert(passes(y, 'baseline')); assert(!passes(y, 'ready')); assert(!passes(y, 'cmf_npoc_room'));
}
assert(!passes({ ...x, obstacle: { distancePct: 2 } }, 'npoc_room'));
assert(passes({ ...x, obstacle: { distancePct: 2.000001 } }, 'npoc_room'));
const short = { ...x, side: -1, features: { crsi_15: 90, roc5_60: 2, cmf_60: -.05 } };
for (const f of ['crsi_extreme', 'roc_stretch', 'cmf_aligned']) { assert(passes(short, f)); assert(!passes({ ...short, side: 1 }, f)); }
const profile = (id: string, lower: number, upper: number, availableAt = 60000): Profile => ({ id, venue: 'bybit', symbol: 'HYPEUSDT',
  period: 'day', start: 0, end: 0, availableAt, width: '0.1', lower: String(lower), upper: String(upper), center: String((lower + upper) / 2),
  eligible: true, reasons: [], tiedLower: [], distribution: [], expectedMinutes: 1440, verifiedMinutes: 1440,
  volume: '1', pocVolume: '1', sharePct: 100, firstObservedRetestAt: null, retestKnownAt: null, uncertainKnownAt: null });
const ps = [profile('origin', 100, 100.1), profile('above', 101, 101.1), profile('below', 98.9, 99), profile('future', 100, 100.1, 300000)];
const rows = createReader(ps, 600000).at(120000);
assert.equal(room(rows, 100, 1, 'origin')!.id, 'above'); assert.equal(room(rows, 100, -1, 'origin')!.id, 'below');
assert.equal(room(rows, 100, 1, null)!.distancePct, 0);
assert.equal(room(rows.filter(p => p.id === 'below'), 100, 1, null), null);
assert.equal(room(rows.filter(p => p.id === 'above'), 100, -1, null), null);
// Future lifecycle evidence and unpublished profiles cannot change an earlier projection.
const poison = ps.map(p => ({ ...p, retestKnownAt: 480000, firstObservedRetestAt: 450000, uncertainKnownAt: 420000 }));
assert.deepEqual(createReader(poison, 600000).at(120000), rows);
const cs: Candle[] = Array.from({ length: 5000 }, (_, i) => { const p = 100 + Math.sin(i / 20); return {
  ts: i * 60000, endTs: (i + 1) * 60000, open: p, high: p + 1, low: p - 1, close: p + .2, volume: 100 + i % 19, turnover: p * (100 + i % 19) } as Candle; });
const at = 4000 * 60000, full = indicatorTape(cs), prefix = indicatorTape(cs.filter(c => c.endTs <= at));
const poisoned = indicatorTape(cs.map(c => c.ts < at ? c : { ...c, close: 99999, high: 100000, volume: 999999, turnover: 99999 * 999999 }));
for (const lag of [60000, 120000]) {
  assert.deepEqual(full.at(at, lag), prefix.at(at, lag)); assert.deepEqual(full.at(at, lag), poisoned.at(at, lag));
  for (const s of full.at(at, lag).sources) assert(s.barEnd + lag <= at);
}
console.log('LC01 fixtures passed: nulls, equality, direction, origin, map future poison, indicator prefix/future poison.');
