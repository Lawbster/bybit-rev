import assert from 'assert/strict';
import { causalPivots, buildPriceActionSignals, H, M } from './price-action-signals';
import type { Candle } from './hype-freerun-canonical-replay';
import type { Candle as Bar } from '../src/fetch-candles';

const t0 = Date.UTC(2026, 0, 1);
const bar = (n: number, o: number, h: number, l: number, c: number): Bar => ({ timestamp: t0 + n * H, open: o, high: h, low: l, close: c, volume: 1, turnover: 1 });
function minutes(hours: Bar[]): Candle[] {
  return hours.flatMap(b => Array.from({ length: 60 }, (_, i) => ({ ts: b.timestamp + i * M, endTs: b.timestamp + (i + 1) * M,
    open: i ? b.open : b.open, close: i === 59 ? b.close : b.open, high: i === 10 ? b.high : Math.max(b.open, b.close), low: i === 20 ? b.low : Math.min(b.open, b.close), volume: 1, turnover: 1 })));
}
const card = { pivotWidth: 1, levelMaxAgeHours: 168, breakBufferPct: .1, stopBufferPct: .1, originLookbackBars: 12,
  retestExpiryHours: 12, impulseExpiryHours: 6, impulseAtrBars: 2, impulseBodyFraction: .6, impulseAtrMultiple: 1, discountMax: .4, premiumMin: .6, holdHours: 24 };

// Known-time strict pivot (and an equal high that must not become a pivot).
const p = causalPivots([bar(0, 10, 11, 9, 10), bar(1, 10, 14, 9, 10), bar(2, 10, 12, 8, 9), bar(3, 9, 14, 7, 8), bar(4, 8, 14, 7, 9)], H, 1, M);
const high = p.find(x => x.kind === 'high' && x.pivotAt === t0 + H)!;
assert(high); assert.equal(high.confirmationEnd, t0 + 3 * H); assert.equal(high.availableAt, t0 + 3 * H + M); assert(Object.isFrozen(high));
assert(!p.some(x => x.kind === 'high' && x.pivotAt === t0 + 3 * H), 'tied high excluded');
assert.equal(causalPivots([bar(0, 10, 11, 9, 10), bar(1, 10, 12, 8, 10), bar(2, 10, 13, 7, 10), bar(3, 10, 14, 6, 10), bar(4, 10, 20, 5, 10), bar(5, 10, 14, 6, 10), bar(6, 10, 13, 7, 10), bar(7, 10, 12, 8, 10), bar(8, 10, 11, 9, 10)], H, 2, M).filter(x => x.kind === 'high').length, 1, 'width=2 is strict and timeframe explicit');

// A deliberately broad tape supplies both directions, strict source lag, and no same-bar return.
const hs = [
  bar(0, 100, 101, 99, 100), bar(1, 100, 102, 98, 100), bar(2, 100, 103, 97, 101), bar(3, 101, 104, 96, 102),
  bar(4, 102, 105, 95, 103), bar(5, 103, 106, 94, 104), bar(6, 104, 107, 93, 105), bar(7, 105, 108, 92, 106),
  bar(8, 106, 109, 91, 107), bar(9, 107, 110, 90, 108), bar(10, 108, 111, 89, 109), bar(11, 109, 112, 88, 110),
  bar(12, 110, 113, 87, 111), bar(13, 111, 114, 86, 112), bar(14, 112, 115, 85, 113), bar(15, 113, 116, 84, 114),
  bar(16, 114, 115, 80, 100), bar(17, 100, 103, 79, 101), bar(18, 101, 120, 100, 119), bar(19, 119, 120, 110, 111),
  bar(20, 111, 112, 90, 91), bar(21, 91, 93, 89, 90), bar(22, 90, 92, 70, 71), bar(23, 71, 75, 69, 74),
];
const cs = minutes(hs), out = buildPriceActionSignals(cs, card, M);
for (const xs of Object.values(out.signals)) for (const a of xs) {
  assert(a.evidence && a.stop !== undefined); const e = a.evidence!;
  assert.equal(a.at, e.confirmationEnd + M, 'action publication is source-lagged');
  assert(e.reference.availableAt <= e.formationAt, 'reference known before event');
  assert.equal(e.riskPct, Math.abs(e.signalClose - a.stop!) / e.signalClose * 100);
}
assert(out.events.every(e => e.stage), 'all attempted rows retain a terminal/current stage');

function sweepTape(mode: 'good' | 'target' | 'stop' | 'expiry') {
  const xs = Array.from({ length: 34 }, (_, n) => bar(n, 110, 111, 109, 110));
  const group = (g: number, hi: number, lo: number, close = 110) => { xs[g * 4] = bar(g * 4, 110, hi, lo, close); };
  group(0, 120, 100); group(1, 110, 90, 100); group(2, 130, 105); group(3, 150, 120); group(4, 140, 110); group(5, 130, 100);
  xs[24] = bar(24, 100, 101, 89, 95); // first low breach/reclaim after both 4h pivots published
  if (mode === 'target') xs[21] = bar(21, 110, 151, 109, 110); // consumes published high before the sweep
  if (mode === 'stop') xs[26] = bar(26, 95, 100, 88, 96); // invalidates after the latency hour
  else if (mode === 'good') xs[26] = bar(26, 95, 121, 94, 120); // positive wide-body / ATR impulse
  return minutes(xs);
}
const good = buildPriceActionSignals(sweepTape('good'), card, M);
assert.equal(good.signals.sweep_control.filter(x => x.side === 1).length, 1, 'first breach yields one long sweep control');
assert.equal(good.signals.sweep_impulse.filter(x => x.side === 1).length, 1, 'causal ATR impulse yields one long candidate');
assert(good.signals.sweep_control[0].evidence!.sweepBar.timestamp < good.signals.sweep_impulse[0].evidence!.impulseBar.timestamp);
const inverse = sweepTape('good').map(c => ({ ...c, open: 240 - c.open, high: 240 - c.low, low: 240 - c.high, close: 240 - c.close }));
const shortGood = buildPriceActionSignals(inverse, card, M);
assert.equal(shortGood.signals.sweep_control.filter(x => x.side === -1).length, 1, 'mirrored first breach yields one short control');
assert.equal(shortGood.signals.sweep_impulse.filter(x => x.side === -1).length, 1, 'mirrored causal ATR impulse yields one short candidate');
const consumed = buildPriceActionSignals(sweepTape('target'), card, M);
assert.equal(consumed.signals.sweep_control.filter(x => x.side === 1).length, 0, 'published target consumption blocks a structural setup');
assert(consumed.events.some(x => x.reason === 'target_consumed'));
const stopped = buildPriceActionSignals(sweepTape('stop'), card, M);
assert(stopped.events.some(x => x.mechanism === 'sweep_impulse' && x.stage === 'invalidated'), 'latency stop invalidation retained');
const expired = buildPriceActionSignals(sweepTape('expiry'), card, M);
assert(expired.events.some(x => x.mechanism === 'sweep_impulse' && x.stage === 'expiry'), 'impulse expiry retained');

function originTape(mode: 'good' | 'publication' | 'failed' | 'stop' | 'target' | 'expiry') {
  const xs = Array.from({ length: 44 }, (_, n) => bar(n, 110, 111, 109, 110));
  const group = (g: number, hi: number, lo: number, close = 110) => { xs[g * 4] = bar(g * 4, 110, hi, lo, close); };
  // Confirmed 4h bracket: low=90 and still-unconsumed high target=150.
  group(0, 120, 100); group(1, 110, 90, 100); group(2, 130, 105); group(3, 150, 120); group(4, 140, 110); group(5, 130, 100);
  xs[23] = bar(23, 110, 115, 109, 110); xs[24] = bar(24, 110, 120, 108, 119); // strict 1h high
  xs[25] = bar(25, 115, 116, 114, 115); xs[26] = bar(26, 117, 119, 116, 118); xs[27] = bar(27, 118, 119, 116, 117); // bearish origin
  xs[28] = bar(28, 118, 125, 117, 124); xs[29] = bar(29, 124, 126, mode === 'publication' ? 118 : 122, 124); // break then departure
  xs[30] = mode === 'failed' ? bar(30, 122, 124, 118, 118) : mode === 'stop' ? bar(30, 122, 124, 115, 121) : mode === 'target' ? bar(30, 122, 151, 118, 121) :
    mode === 'expiry' ? bar(30, 122, 126, 121, 124) : bar(30, 122, 124, 118, 121);
  if (mode === 'expiry') for (let i = 31; i < xs.length; i++) xs[i] = bar(i, 124, 128, 121, 125);
  return minutes(xs);
}
const origin = buildPriceActionSignals(originTape('good'), card, M);
const originAction = origin.signals.origin_retest.find(x => x.side === 1)!;
assert(originAction, 'long origin retest succeeds');
assert.equal(originAction.evidence!.originZone.source.timestamp, t0 + 27 * H);
assert.equal(originAction.evidence!.retestBar.timestamp, t0 + 30 * H);
const originShort = buildPriceActionSignals(originTape('good').map(c => ({ ...c, open: 240 - c.open, high: 240 - c.low, low: 240 - c.high, close: 240 - c.close })), card, M);
assert(originShort.signals.origin_retest.some(x => x.side === -1), 'mirrored short origin retest succeeds');
for (const [mode, expected] of [['publication', 'publication_overlap'], ['failed', 'failed_first_return'], ['stop', 'stop_before_retest'], ['target', 'target_consumed'], ['expiry', 'expired']] as const) {
  const mutated = buildPriceActionSignals(originTape(mode), card, M);
  assert.equal(mutated.signals.origin_retest.filter(x => x.side === 1).length, 0, `${mode} does not retry an origin return`);
  assert(mutated.events.some(x => x.mechanism === 'origin_retest' && (x.failure === expected || x.stage === expected)), `${mode} lifecycle is retained`);
}

// Prefix result cannot change when poisonous future extremes are appended.
const goodPrefixTape = sweepTape('good').slice(0, 30 * 60);
const poison = Array.from({ length: 8 * 60 }, (_, i) => ({ ts: t0 + (34 * 60 + i) * M, endTs: t0 + (34 * 60 + i + 1) * M, open: 110, close: 110, high: 10000, low: 1, volume: 1, turnover: 1 }));
const prefix = buildPriceActionSignals(goodPrefixTape, card, M), poisoned = buildPriceActionSignals([...sweepTape('good'), ...poison], card, M);
const actionsBefore = (x: ReturnType<typeof buildPriceActionSignals>) => Object.values(x.signals).flat().filter(a => a.at < t0 + 30 * H).map(a => ({ id: a.id, at: a.at, evidence: a.evidence }));
assert(actionsBefore(prefix).length > 0, 'prefix fixture contains real causal actions');
assert.deepEqual(actionsBefore(prefix), actionsBefore(poisoned), 'future bars cannot create or mutate prefix actions/evidence');

// Expiry is preserved rather than silently dropped; target consumption and latency overlap are visible failures when reached.
assert(out.events.every(e => !e.retestBar || e.retestBar.timestamp >= e.confirmationEnd + M), 'no same/publication-bar retest');
console.log(`PA07 focused tests passed: knownPivots=${p.length}, genericEvents=${out.events.length}, causalLongActions=${Object.values(good.signals).flat().length}`);
