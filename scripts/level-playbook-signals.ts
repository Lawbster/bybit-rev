/** Frozen LV01 entry rules. Source reference is fixed before each reaction bar. */
import assert from 'assert/strict';
import { aggregate, type Action } from './poc-indicator-bias-engine';
import type { Candle } from './hype-freerun-canonical-replay';
import type { Profile } from './poc-profile-engine';
import { M, H, D, valueAt, sourceEndAt, referenceKey, type Atlas, type Field } from './level-playbook-map';
export interface Definition { id: string; family: string; mechanism: 'reject' | 'retest' | 'stretch'; fields: Field[];
  poc?: 'latest' | 'naked'; period?: 'day' | 'week' | 'month'; }
export const DEFINITIONS: Definition[] = [];
for (const prefix of ['pd', 'pw', 'pm', 'd']) for (const mechanism of ['reject', 'retest'] as const)
  DEFINITIONS.push({ id: `${prefix}_range_${mechanism}`, family: 'range', mechanism, fields: [(prefix + 'Low') as Field, (prefix + 'High') as Field] });
for (const f of ['pdMid', 'pwMid', 'dOpen', 'wOpen', 'mOpen', 'pdOpen', 'pwOpen', 'pmOpen', 'dbyOpen',
  'vwapD', 'vwapW', 'vwapM', 'vwapPD', 'vwap24', 'vwap2D'] as Field[])
  DEFINITIONS.push({ id: `${f}_retest`, family: f.startsWith('vwap') ? 'vwap' : f.endsWith('Mid') ? 'midpoint' : 'open', mechanism: 'retest', fields: [f] });
for (const f of ['vwapD', 'vwapW', 'vwapM'] as Field[])
  DEFINITIONS.push({ id: `${f}_stretch`, family: 'vwap', mechanism: 'stretch', fields: [f] });
for (const period of ['day', 'week', 'month'] as const) for (const poc of ['latest', 'naked'] as const)
  DEFINITIONS.push({ id: `poc_${period}_${poc}_reject`, family: 'poc', mechanism: 'reject', fields: [], poc, period });
assert.equal(DEFINITIONS.length, 32);
interface Reference { id: string; key: string; price: number; lower: number; upper: number; availableAt: number;
  side?: 1 | -1; profile?: Profile; }
export interface LVSignal extends Action { evidence: Record<string, any>; }
export function buildSignals(cs: readonly Candle[], a: Atlas, c: Record<string, any>) {
  const bars = aggregate(cs, c.confirmationMinutes * M), tf = c.confirmationMinutes * M;
  const buffer = c.breakBufferPct / 100, tolerance = c.retestTolerancePct / 100, stretch = c.vwapDeviationPct / 100;
  const lag = c.publicationLagMs, results: Record<string, LVSignal[]> = {}, diagnostics: Record<string, any> = {};
  for (const def of DEFINITIONS) {
    const signals: LVSignal[] = [], used = new Set<string>();
    const waiting = new Map<string, { r: Reference; side: 1 | -1; end: number; known: number; expiry: number; breakoutClose: number }>();
    let candidates = 0, dailySuppressed = 0, oppositeSkipped = 0, invalidated = 0, expired = 0;
    for (let i = 1; i < bars.length; i++) {
      const b = bars[i], previous = bars[i - 1], start = b.timestamp, end = start + tf;
      if (previous.timestamp + tf !== start || end + lag >= a.end) continue;
      const sourceEnd = sourceEndAt(a, start); if (sourceEnd === null) continue;
      const refs: Reference[] = [];
      for (const f of def.fields) {
        const price = valueAt(a, start, f); if (!Number.isFinite(price)) continue;
        refs.push({ id: f, key: referenceKey(a, start, f), price, lower: price, upper: price, availableAt: sourceEnd + lag,
          side: def.family === 'range' ? f.endsWith('Low') ? 1 : -1 : undefined });
      }
      if (def.poc) {
        const eligible = a.pocs.filter(p => p.period === def.period && p.availableAt <= start);
        const latest = eligible.at(-1);
        const pool = def.poc === 'latest' ? latest && Number.isFinite(valueAt(a, start, def.period === 'day' ? 'pocD' : def.period === 'week' ? 'pocW' : 'pocM')) ? [latest] : []
          : eligible.filter(p => (p.retestKnownAt === null || p.retestKnownAt > start) && (p.uncertainKnownAt === null || p.uncertainKnownAt > start));
        for (const p of pool) refs.push({ id: p.id, key: p.id, price: Number(p.center), lower: Number(p.lower), upper: Number(p.upper), availableAt: p.availableAt, profile: p });
      }
      const hits: LVSignal[] = [];
      const emit = (r: Reference, side: 1 | -1, extra: Record<string, any> = {}) => {
        candidates++;
        const stop = side === 1 ? Math.min(b.low, def.mechanism === 'stretch' ? b.low : r.lower) * (1 - buffer)
          : Math.max(b.high, def.mechanism === 'stretch' ? b.high : r.upper) * (1 + buffer);
        const risk = side * (b.close - stop), riskPct = risk / b.close * 100;
        const target = b.close + side * c.rewardToRisk * risk;
        hits.push({ id: `${def.id}:${end + lag}:${side}:${r.id}`, at: end + lag, side,
          evidence: { definition: def.id, referenceId: r.id, referenceKey: r.key, level: r.price, lower: r.lower, upper: r.upper,
            sourceEnd: r.availableAt - lag, frozenAt: start, referenceAvailableAt: r.availableAt, reactionStart: start, reactionEnd: end,
            priorClose: previous.close, signalClose: b.close, reactionHigh: b.high, reactionLow: b.low,
            stop, target, riskPct, bracketEligible: riskPct >= c.bracketRiskMinPct && riskPct <= c.bracketRiskMaxPct, ...extra } });
      };
      if (def.mechanism === 'retest') {
        for (const [key, w] of waiting) {
          if (end > w.expiry) { waiting.delete(key); expired++; continue; }
          if (start < w.known) continue;
          if (w.side * (b.close / w.r.price - 1) <= -buffer) { waiting.delete(key); invalidated++; continue; }
          const touch = b.low <= w.r.price * (1 + tolerance) && b.high >= w.r.price * (1 - tolerance);
          if (touch && w.side * (b.close / w.r.price - 1) >= buffer) {
            emit(w.r, w.side, { frozenAt: w.end - tf, breakoutEnd: w.end, breakoutAvailableAt: w.known, breakoutClose: w.breakoutClose, expiresAt: w.expiry });
            waiting.delete(key);
          }
        }
        for (const r of refs) for (const side of [1, -1] as const) {
          if (def.family === 'range' && side === r.side) continue; // high breakout long, low breakout short
          const crossed = side * (previous.close / r.price - 1) <= 0 && side * (b.close / r.price - 1) >= buffer;
          const key = r.id + ':' + side;
          if (crossed && !waiting.has(key)) waiting.set(key, { r, side, end, known: end + lag, expiry: end + c.retestWindowBars * tf, breakoutClose: b.close });
        }
      } else for (const r of refs) {
        if (def.mechanism === 'stretch') {
          if (previous.close / r.price < 1 - stretch && b.close / r.price >= 1 - stretch && b.close < r.price) emit(r, 1);
          if (previous.close / r.price > 1 + stretch && b.close / r.price <= 1 + stretch && b.close > r.price) emit(r, -1);
        } else for (const side of [1, -1] as const) {
          if (r.side !== undefined && side !== r.side) continue;
          const boundary = side === 1 ? r.lower : r.upper, approach = side === 1 ? r.upper : r.lower;
          const crossed = side === 1 ? b.low <= boundary * (1 - buffer) : b.high >= boundary * (1 + buffer);
          const overlap = b.low < r.upper && b.high >= r.lower;
          const rejection = side * (previous.close / approach - 1) > 0 && crossed && side * (b.close / approach - 1) >= buffer;
          if (!rejection || (def.poc && !overlap)) continue;
          if (def.poc === 'naked') {
            const p = r.profile!;
            if (p.firstObservedRetestAt === null || p.firstObservedRetestAt < start || p.firstObservedRetestAt >= end
              || p.retestKnownAt === null || p.retestKnownAt > end
              || (p.uncertainKnownAt !== null && p.uncertainKnownAt <= p.retestKnownAt)) continue;
          }
          emit(r, side);
        }
      }
      if (!hits.length) continue;
      if (new Set(hits.map(s => s.side)).size > 1) { oppositeSkipped++; continue; }
      hits.sort((x, y) => Math.abs(x.evidence.level - b.close) - Math.abs(y.evidence.level - b.close) || x.evidence.referenceId.localeCompare(y.evidence.referenceId));
      const chosen = hits[0], key = Math.floor(chosen.at / D) + ':' + chosen.side;
      if (used.has(key)) { dailySuppressed++; continue; }
      used.add(key); signals.push(chosen);
    }
    results[def.id] = signals;
    diagnostics[def.id] = { candidates, signals: signals.length, dailySuppressed, oppositeSkipped, invalidated, expired,
      bracketIneligible: signals.filter(s => !s.evidence.bracketEligible).length };
  }
  return { signals: results, diagnostics };
}
