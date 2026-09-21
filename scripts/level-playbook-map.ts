/** LV01 reusable causal minute atlas. Offline; no network or trading imports. */
import assert from 'assert/strict';
import type { Candle } from './hype-freerun-canonical-replay';
import { periodStart, periodEnd, type Period, type Profile } from './poc-profile-engine';
export const M = 60000, H = 60 * M, D = 24 * H;
export const FIELDS = [
  'dOpen', 'wOpen', 'mOpen', 'pdOpen', 'pwOpen', 'pmOpen', 'dbyOpen',
  'pdHigh', 'pdLow', 'pdMid', 'pwHigh', 'pwLow', 'pwMid', 'pmHigh', 'pmLow',
  'dHigh', 'dLow', 'vwapD', 'vwapW', 'vwapM', 'vwapPD', 'vwap24', 'vwap2D',
  'actualD', 'actualW', 'actualM', 'actualPD', 'actual24', 'actual2D',
  'pocD', 'pocW', 'pocM',
] as const;
export type Field = typeof FIELDS[number];
export const COLUMN = Object.fromEntries(FIELDS.map((f, i) => [f, i])) as Record<Field, number>;
export interface PeriodRow {
  period: Period; start: number; end: number; availableAt: number; complete: boolean;
  count: number; open: number; high: number; low: number; close: number; volume: number;
  turnover: number; typical: number; hl2: number;
}
function fresh(period: Period, start: number): PeriodRow {
  return { period, start, end: periodEnd(start, period), availableAt: periodEnd(start, period) + M,
    complete: true, count: 0, open: NaN, high: -Infinity, low: Infinity, close: NaN, volume: 0, turnover: 0, typical: 0, hl2: 0 };
}
const ratio = (a: number, v: number) => v > 0 ? a / v : NaN;
export interface Atlas { start: number; end: number; rows: number; fields: readonly string[]; values: Float64Array;
  periods: PeriodRow[]; pocs: Profile[]; }
export function buildAtlas(cs: readonly Candle[], profiles: Profile[]): Atlas {
  assert(cs.length > 0); const start = cs[0].ts, end = cs.at(-1)!.endTs;
  const values = new Float64Array(cs.length * FIELDS.length); values.fill(NaN);
  const periods: PeriodRow[] = [], kinds: Period[] = ['day', 'week', 'month'];
  const current = kinds.map(k => fresh(k, periodStart(start, k))), history: PeriodRow[][] = kinds.map(() => []);
  current.forEach(p => { p.complete = p.start === start; });
  const pocs = profiles.filter(p => p.eligible && p.venue === 'bybit' && Number(p.width) === .1)
    .sort((a, b) => a.availableAt - b.availableAt || a.id.localeCompare(b.id));
  const lastPoc = new Map<Period, Profile>(); let pi = 0;
  let rollingVolume = 0, rollingTypical = 0, rollingTurnover = 0;
  for (let i = 0; i < cs.length; i++) {
    const b = cs[i]; assert.equal(b.endTs, b.ts + M); if (i) assert.equal(b.ts, cs[i - 1].endTs);
    for (let k = 0; k < kinds.length; k++) {
      const p = current[k]; assert(b.ts >= p.start && b.ts < p.end);
      if (!p.count) p.open = b.open;
      p.high = Math.max(p.high, b.high); p.low = Math.min(p.low, b.low); p.close = b.close;
      p.volume += b.volume; p.turnover += b.turnover;
      p.typical += (b.high + b.low + b.close) / 3 * b.volume;
      p.hl2 += (b.high + b.low) / 2 * b.volume; p.count++;
      if (b.endTs === p.end) {
        p.complete &&= p.count === (p.end - p.start) / M;
        periods.push({ ...p }); history[k].unshift(p); history[k].length = Math.min(history[k].length, 2);
        current[k] = fresh(kinds[k], p.end);
      }
    }
    const at = b.endTs + M, offset = i * FIELDS.length;
    const put = (f: Field, n: number) => { values[offset + COLUMN[f]] = n; };
    const [day, week, month] = current;
    const prev = history.map(h => h[0]?.complete ? h[0] : null), [pd, pw, pm] = prev;
    for (const [f, p] of [['dOpen', day], ['wOpen', week], ['mOpen', month]] as [Field, PeriodRow][])
      if (p.complete && p.count) put(f, p.open);
    for (const [f, p] of [['pdOpen', pd], ['pwOpen', pw], ['pmOpen', pm]] as [Field, PeriodRow | null][])
      if (p) put(f, p.open);
    if (history[0][1]?.complete) put('dbyOpen', history[0][1].open);
    for (const [prefix, p] of [['pd', pd], ['pw', pw], ['pm', pm]] as const) if (p) {
      put((prefix + 'High') as Field, p.high); put((prefix + 'Low') as Field, p.low);
      if (prefix !== 'pm') put((prefix + 'Mid') as Field, (p.high + p.low) / 2);
    }
    if (day.complete && day.count) { put('dHigh', day.high); put('dLow', day.low); }
    for (const [suffix, p] of [['D', day], ['W', week], ['M', month]] as const) if (p.complete && p.count) {
      put(('vwap' + suffix) as Field, ratio(suffix === 'M' ? p.hl2 : p.typical, p.volume));
      put(('actual' + suffix) as Field, ratio(p.turnover, p.volume));
    }
    if (pd) {
      put('vwapPD', ratio(pd.typical, pd.volume)); put('actualPD', ratio(pd.turnover, pd.volume));
      if (day.complete) {
        put('vwap2D', ratio(pd.typical + day.typical, pd.volume + day.volume));
        put('actual2D', ratio(pd.turnover + day.turnover, pd.volume + day.volume));
      }
    }
    rollingVolume += b.volume; rollingTypical += (b.high + b.low + b.close) / 3 * b.volume; rollingTurnover += b.turnover;
    if (i >= 1440) {
      const old = cs[i - 1440]; rollingVolume -= old.volume;
      rollingTypical -= (old.high + old.low + old.close) / 3 * old.volume; rollingTurnover -= old.turnover;
    }
    if (i >= 1439) { put('vwap24', ratio(rollingTypical, rollingVolume)); put('actual24', ratio(rollingTurnover, rollingVolume)); }
    while (pi < pocs.length && pocs[pi].availableAt <= at) { lastPoc.set(pocs[pi].period, pocs[pi]); pi++; }
    for (const [period, f] of [['day', 'pocD'], ['week', 'pocW'], ['month', 'pocM']] as [Period, Field][]) {
      const p = lastPoc.get(period);
      // Never substitute an older eligible period when the immediately preceding profile is incomplete.
      if (p && p.end === periodStart(b.endTs, period)) put(f, Number(p.center));
    }
  }
  return { start, end, rows: cs.length, fields: FIELDS, values, periods, pocs };
}
export function rowIndex(a: Atlas, at: number): number {
  const i = Math.floor((at - M - a.start) / M) - 1;
  return i >= 0 && i < a.rows ? i : -1;
}
export function valueAt(a: Atlas, at: number, field: Field): number {
  const i = rowIndex(a, at); return i < 0 ? NaN : a.values[i * FIELDS.length + COLUMN[field]];
}
export function sourceEndAt(a: Atlas, at: number): number | null {
  const i = rowIndex(a, at); return i < 0 ? null : a.start + (i + 1) * M;
}
export function referenceKey(a: Atlas, at: number, f: Field): string {
  const end = sourceEndAt(a, at); if (end === null) return 'unavailable';
  if (f === 'vwap24' || f === 'actual24') return 'rolling24';
  // Explicit mapping avoids 'vwap' itself incorrectly implying a weekly anchor.
  const period = ['wOpen', 'pwOpen', 'pwHigh', 'pwLow', 'pwMid', 'vwapW', 'actualW', 'pocW'].includes(f) ? 'week'
    : ['mOpen', 'pmOpen', 'pmHigh', 'pmLow', 'vwapM', 'actualM', 'pocM'].includes(f) ? 'month' : 'day';
  return `${f}:${periodStart(end, period)}`;
}
