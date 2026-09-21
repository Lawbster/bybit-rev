import assert from 'assert/strict';
import { snapshot, blocks, FAMILIES, filters } from './high-touch-poc-context';
import type { Profile } from './poc-profile-engine';
const M = 60000, at = Date.UTC(2026, 5, 3, 12), end = Date.UTC(2026, 5, 3);
const profile = (id: string, extra: Partial<Profile> = {}): Profile => ({ id, venue: 'bybit', symbol: 'HYPEUSDT', period: 'day', start: end - 86400000,
  end, availableAt: end + M, width: '0.1', lower: '100', upper: '100.1', center: '100.05', volume: '1', pocVolume: '1', sharePct: 100,
  tiedLower: ['100'], eligible: true, reasons: [], expectedMinutes: 1440, verifiedMinutes: 1440, distribution: [],
  firstObservedRetestAt: null, retestKnownAt: null, uncertainKnownAt: null, ...extra });
const event = (t = at, close = 100.2) => ({ id: 's:' + t, at: t, close, observationEnd: t - M });
let ps = [profile('d'), profile('future', { start: end, end: end + 86400000, availableAt: end + 86400000 + M, lower: '100.19' })];
const c = snapshot(ps, at + 86400000, M)(event());
assert.equal(c.levels.poc_day.either.id, 'd'); assert.equal(c.levels.npoc_day.either.id, 'd');
assert(blocks(c, { family: 'poc_day', relation: 'either', threshold: .25 }));
assert(!blocks(c, { family: 'poc_day', relation: 'either', threshold: .01 }));
assert.deepEqual(snapshot(ps.slice(0, 1), at, M)(event()), c, 'Unpublished future profiles cannot influence snapshot');
const poisoned = [profile('d', { retestKnownAt: at + M, firstObservedRetestAt: at }), ...ps.slice(1)];
assert.deepEqual(snapshot(poisoned, at + 86400000, M)(event()), c, 'Future lifecycle cannot influence snapshot');
assert.equal(snapshot([profile('d', { retestKnownAt: at - M, firstObservedRetestAt: at - 2 * M })], at, M)(event()).levels.npoc_day.either, null);
assert.equal(snapshot([profile('d', { uncertainKnownAt: at - M })], at, M)(event()).levels.npoc_day.either, null);
assert.equal(snapshot(ps.slice(0, 1), at, M)(event(end + M)).levels.poc_day.either, null, 'Profile not received by lagged snapshot');
assert.equal(snapshot(ps.slice(0, 1), at, M)(event(end + 2 * M)).levels.poc_day.either.id, 'd');
assert.equal(snapshot([profile('older', { end: end - 86400000, start: end - 2 * 86400000, availableAt: end - 86400000 + M })], at, M)(event()).levels.poc_day.either, null, 'No older fallback');
assert.equal(snapshot([profile('d', { eligible: false })], at, M)(event()).levels.poc_all.either, null);
const above = snapshot(ps.slice(0, 1), at, M)(event(at, 99.9)); assert(above.levels.poc_day.either); assert.equal(above.levels.poc_day.below, null);
const inside = snapshot(ps.slice(0, 1), at, M)(event(at, 100.02)); assert.equal(inside.levels.poc_day.below.distancePct, 0);
const grid = filters({ families: FAMILIES, relations: ['either', 'below'], thresholdsPct: [.25, .5, 1, 2] }); assert.equal(grid.length, 64);
assert.equal(new Set(grid.map((f: any) => f.id)).size, 64);
console.log('HT02 tests passed: as-of/future poisoning, publication/retest/uncertainty, no older fallback, row distance/direction, frozen64 filters.');
