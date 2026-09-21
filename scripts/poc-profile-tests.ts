import assert from 'assert/strict';
import { buildProfiles, periodStart, periodEnd, asOf, createReader, ProfileDay, Settings } from './poc-profile-engine';
import { DAY } from './poc-volume-source';
const start = Date.UTC(2026, 0, 5), price = (p: number, q: string, at: number) => ({ p: p * 1e8, q, buy: q, n: 1, first: at, last: at });
function day(t: number, prices: ProfileDay['prices'] = [price(10.01, '2', t + 1000)]): ProfileDay {
  return { venue: 'test', date: new Date(t).toISOString().slice(0, 10), start: t, prices,
    minutes: Array.from({ length: 1440 }, (_, i) => ({ ts: t + i * 60000, quality: 'verified' })) };
}
const s: Settings = { symbol: 'TESTUSDT', start, end: start + 3 * DAY, widths: ['0.10'], publicationDelayMs: 60000 };
let count = 0; function test(name: string, f: () => void) { f(); count++; console.log('PASS ' + name); }
test('UTC Monday/week and leap-month boundaries', () => {
  assert.equal(periodStart(Date.UTC(2026, 0, 11, 23), 'week'), start);
  assert.equal(periodEnd(Date.UTC(2024, 1, 1), 'month'), Date.UTC(2024, 2, 1));
  assert.equal(periodEnd(Date.UTC(2026, 11, 1), 'month'), Date.UTC(2027, 0, 1));
});
test('fixed row origin, exact boundary, deterministic ties', () => {
  const p = buildProfiles([day(start, [price(10, '2', start), price(10.1, '2', start + 1)])], s).find(p => p.period === 'day')!;
  assert.equal(p.lower, '10'); assert.equal(p.upper, '10.1'); assert.deepEqual(p.tiedLower, ['10', '10.1']); assert.equal(p.volume, '4');
});
test('weekly and monthly sum distributions, not daily POCs', () => {
  const st = Date.UTC(2026, 5, 1), days = Array.from({ length: 30 }, (_, i) => day(st + i * DAY,
    [price(10.01, i === 0 ? '1000' : '1', st + i * DAY), price(11.01, '2', st + i * DAY + 1)]));
  const ps = buildProfiles(days, { ...s, start: st, end: st + 30 * DAY });
  assert.equal(ps.find(p => p.period === 'week' && p.start === st)!.lower, '10');
  assert.equal(ps.find(p => p.period === 'month')!.lower, '10');
  assert.equal(ps.find(p => p.period === 'month')!.volume, '1089');
});
test('publication delay, no developing profiles, intra-period trades not retests', () => {
  const ps = buildProfiles([day(start), day(start + DAY, [price(12, '1', start + DAY)])], s);
  assert.equal(asOf(ps, start + DAY, s.end).length, 0);
  const r = asOf(ps, start + DAY + 60000, s.end)[0]; assert.equal(r.status, 'untested'); assert.equal(r.observedRetestAt, null);
});
test('touch before publication is already tested at publication', () => {
  const ps = buildProfiles([day(start), day(start + DAY)], s);
  const r = asOf(ps, start + DAY + 60000, s.end)[0]; assert.equal(r.status, 'tested'); assert.equal(r.observedRetestAt, start + DAY + 1000);
});
test('wick trade counts, upper bound excluded, minute-end evidence clock', () => {
  const ps = buildProfiles([day(start), day(start + DAY, [price(10.1, '1', start + DAY + 2000), price(10.09, '1', start + DAY + 61000)])], s);
  assert.equal(asOf(ps, start + DAY + 119999, s.end)[0].status, 'untested');
  assert.equal(asOf(ps, start + DAY + 120000, s.end)[0].observedRetestAt, start + DAY + 61000);
});
test('quality gaps make untested uncertain until later observed touch', () => {
  const d = day(start + DAY, [price(10.02, '1', start + DAY + 180001)]); d.minutes[1].quality = 'missing_candle';
  const ps = buildProfiles([day(start), d], s);
  assert.equal(asOf(ps, start + DAY + 60000, s.end)[0].status, 'untested');
  assert.equal(asOf(ps, start + DAY + 120000, s.end)[0].status, 'uncertain');
  const r = asOf(ps, start + DAY + 240000, s.end)[0]; assert.equal(r.status, 'tested'); assert.equal(r.firstRetestExact, false);
});
test('a later gap cannot revoke known touch', () => {
  const d = day(start + DAY); d.minutes[5].quality = 'base_mismatch';
  const r = asOf(buildProfiles([day(start), d], s), s.end, s.end)[0]; assert.equal(r.firstRetestExact, true);
});
test('partial boundary periods and unverified source excluded', () => {
  const d = day(start); d.minutes[2].quality = 'base_mismatch';
  const ps = buildProfiles([d], s); assert(!ps.some(p => p.eligible)); assert.equal(asOf(ps, s.end, s.end).length, 0);
  assert(!buildProfiles([day(start)], { ...s, start: start + 60000 }).some(p => p.eligible));
});
test('post-cutoff touch is not knowable; queries after cutoff rejected', () => {
  const ps = buildProfiles([day(start), day(start + DAY, [price(10.01, '1', start + DAY + 120100)])], { ...s, end: start + DAY + 120000 });
  assert.equal(ps[0].retestKnownAt, null); assert.throws(() => asOf(ps, s.end + 1, s.end));
});
test('future poisoning and prefix invariance', () => {
  const d = day(start + DAY, [price(12, '1', start + DAY + 1000)]);
  const prefix = buildProfiles([day(start), d], { ...s, end: start + 2 * DAY });
  const full = buildProfiles([day(start), d, day(start + 2 * DAY)], s);
  const at = start + DAY + 60000; assert.deepEqual(asOf(prefix, at, s.end), asOf(full, at, s.end));
  const publicRow = asOf(full, at, s.end)[0] as any;
  for (const key of ['firstObservedRetestAt', 'retestKnownAt', 'uncertainKnownAt', 'distribution']) assert(!(key in publicRow));
});
test('reader filters and venue isolation', () => {
  const ps = buildProfiles([day(start), day(start + DAY)], s), r = createReader(ps, s.end);
  assert.equal(r.at(s.end, { venue: 'other' }).length, 0); assert.equal(r.at(s.end, { period: 'day', width: '0.100' }).length, 2);
  assert.deepEqual(r.nakedAt(s.end), r.at(s.end).filter(p => p.status === 'untested'));
  assert.throws(() => buildProfiles([day(start), { ...day(start + DAY), venue: 'other' }], s));
});
test('caller mutation cannot change later published tie metadata', () => {
  const ps = buildProfiles([day(start), day(start + DAY)], s), r = createReader(ps, s.end);
  r.at(s.end)[0].tiedLower.push('999'); r.at(s.end)[0].reasons.push('injected');
  assert(!r.at(s.end)[0].tiedLower.includes('999')); assert.equal(r.at(s.end)[0].reasons.length, 0);
});
test('duplicate minutes cannot masquerade as full coverage', () => {
  const d = day(start); d.minutes[1] = d.minutes[0]; assert.throws(() => buildProfiles([d], s));
  const p = day(start); p.prices.push(p.prices[0]); assert.throws(() => buildProfiles([p], s));
});
console.log(`POC profile/causality tests passed (${count})`);
