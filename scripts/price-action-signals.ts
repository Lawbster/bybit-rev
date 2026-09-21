/** PA07 causal event tape. Research-only; it deliberately has no executor imports. */
import assert from 'assert/strict';
import type { Candle } from './hype-freerun-canonical-replay';
import type { Candle as Bar } from '../src/fetch-candles';
import { aggregate, M, H, D } from './poc-indicator-bias-engine';
import type { Action, Row } from './poc-indicator-bias-engine';

export { aggregate, M, H, D } from './poc-indicator-bias-engine';
export type { Action, Row } from './poc-indicator-bias-engine';
type Side = 1 | -1;
type Pivot = Row & { id: string; kind: 'high' | 'low'; price: number; pivotAt: number; confirmationEnd: number; availableAt: number };

/** Strict pivots: equality is not an extreme, and publication is explicitly lagged. */
export function causalPivots(bars: readonly Bar[], tf: number, width: number, lag: number): Pivot[] {
  assert(tf >= M && tf % M === 0 && Number.isInteger(width) && width >= 1 && lag >= 0);
  assert(bars.every((b, i) => Number.isFinite(b.timestamp) && b.timestamp % tf === 0 && Number.isFinite(b.high) && Number.isFinite(b.low) && b.high >= b.low &&
    (i === 0 || b.timestamp === bars[i - 1].timestamp + tf)), 'contiguous aligned finite timeframe bars required');
  const out: Pivot[] = [];
  for (let i = width; i + width < bars.length; i++) {
    const b = bars[i], near = bars.slice(i - width, i + width + 1).filter((_, n) => n !== width);
    const confirmationEnd = bars[i + width].timestamp + tf, availableAt = confirmationEnd + lag;
    for (const [kind, price, pass] of [
      ['high', b.high, near.every(x => b.high > x.high)], ['low', b.low, near.every(x => b.low < x.low)],
    ] as const) if (pass) out.push(Object.freeze({ id: `pivot:${tf}:${kind}:${b.timestamp}:${price}`, kind, price,
      pivotAt: b.timestamp, confirmationEnd, availableAt, timeframe: tf, width }));
  }
  return out.sort((a, b) => a.availableAt - b.availableAt || a.id.localeCompare(b.id));
}

const barEnd = (b: Bar, tf: number) => b.timestamp + tf;
const overlap = (b: Bar, lo: number, hi: number) => b.high >= lo && b.low <= hi;
const trueRange = (b: Bar, previousClose: number) => Math.max(b.high - b.low, Math.abs(b.high - previousClose), Math.abs(b.low - previousClose));

function latest(ps: Pivot[], kind: Pivot['kind'], at: number, age: number) {
  return ps.filter(p => p.kind === kind && p.availableAt <= at && p.pivotAt >= at - age).at(-1) ?? null;
}
const frozenCopy = (v: any): any => {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) return Object.freeze(v.map(frozenCopy));
  return Object.freeze(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, frozenCopy(x)])));
};
function emit(actions: Action[], mechanism: string, side: Side, confirmationEnd: number, lag: number, holdHours: number, evidence: Row) {
  const signalClose = evidence.signalClose as number, stop = evidence.stop as number, target = evidence.target as number;
  const at = confirmationEnd + lag;
  const actionEvidence = { ...evidence }; delete actionEvidence.cutoffAt; delete actionEvidence.terminalAt;
  actions.push(Object.freeze({ id: `${mechanism}:${side}:${evidence.reference.id}:${evidence.formationAt}:${confirmationEnd}`, at, side, stop, target, expiresAt: at + holdHours * H,
    evidence: frozenCopy({ ...actionEvidence, mechanism, side, confirmationEnd, availableAt: at, knownAt: at, formationKnownAt: evidence.formationKnownAt ?? evidence.knownAt, signalClose,
      riskPct: Math.abs(signalClose - stop) / signalClose * 100, reference2rTarget: signalClose + side * 2 * Math.abs(signalClose - stop) }) }));
}

/**
 * Produces every observed lifecycle row, including rejected/expired attempts.  It does
 * not enforce risk or target direction: that belongs to the execution runner.
 */
export function buildPriceActionSignals(cs: readonly Candle[], card: Row, lag: number) {
  assert(cs.length && cs.every((c, i) => i === 0 || c.ts === cs[i - 1].endTs), 'sealed contiguous minute tape required');
  assert((card.triggerMinutes ?? 60) === 60 && (card.contextMinutes ?? 240) === 240, 'PA07 v1 requires 60m trigger and 240m context');
  const bars1h = aggregate(cs, H), bars4h = aggregate(cs, 4 * H);
  const pivots = causalPivots(bars4h, 4 * H, card.pivotWidth, lag);
  const pivots1h = causalPivots(bars1h, H, card.pivotWidth, lag);
  const signals: Record<'sweep_control' | 'sweep_impulse' | 'break_control' | 'origin_retest', Action[]> = {
    sweep_control: [], sweep_impulse: [], break_control: [], origin_retest: [],
  };
  const events: Row[] = [];
  const age = (card.levelMaxAgeHours ?? 168) * H, breakPct = (card.breakBufferPct ?? .1) / 100;
  const stopPct = (card.stopBufferPct ?? .1) / 100, discount = card.discountMax ?? .4, premium = card.premiumMin ?? .6;
  const sweepUsed = new Set<string>(), breakUsed = new Set<string>();

  const bracket = (at: number) => {
    const high = latest(pivots, 'high', at, age), low = latest(pivots, 'low', at, age);
    return high && low && high.price > low.price ? { high, low } : null;
  };
  // All candles are sealed/contiguous.  This bounded direct index is deliberately
  // used instead of repeated full-tape scans (the PA07 cache is ~1m rows).
  const base = cs[0].ts;
  const hit = (price: number, side: Side, from: number, until: number) => {
    const first = Math.max(0, Math.ceil((from - base) / M)), last = Math.min(cs.length, Math.ceil((until - base) / M));
    for (let i = first; i < last; i++) if (side === 1 ? cs[i].high >= price : cs[i].low <= price) return true;
    return false;
  };
  const targetClean = (p: Pivot, side: Side, until: number) => !hit(p.price, side, p.availableAt, until);

  // Sweep and delayed impulse lifecycle.
  for (let i = 1; i < bars1h.length; i++) {
    const b = bars1h[i], prior = bars1h[i - 1], range = bracket(b.timestamp); if (!range) continue;
    for (const side of [1, -1] as Side[]) {
      const reference = side === 1 ? range.low : range.high, target = side === 1 ? range.high : range.low;
      const breached = side === 1 ? b.low <= reference.price * (1 - breakPct) : b.high >= reference.price * (1 + breakPct);
      if (!breached || sweepUsed.has(reference.id)) continue;
      sweepUsed.add(reference.id); // first breach consumes even a failed reclaim
      const location = (b.close - range.low.price) / (range.high.price - range.low.price);
      const reclaimed = side === 1 ? prior.close > reference.price && b.close > reference.price : prior.close < reference.price && b.close < reference.price;
      const contextual = side === 1 ? location <= discount : location >= premium;
      // PA07's frozen source adaptation treats a published reference wick as a
      // consumed first breach, even when it occurs before an eligible 1h setup.
      const referenceClean = !hit(reference.price, side === 1 ? -1 : 1, reference.availableAt, b.timestamp);
      const clean = referenceClean && targetClean(target, side, b.timestamp) && !(side === 1 ? b.high >= target.price : b.low <= target.price);
      const stop = side === 1 ? b.low * (1 - stopPct) : b.high * (1 + stopPct);
      const e: Row = { id: `sweep:${side}:${reference.id}:${b.timestamp}`, family: 'sweep', side, reference, targetPivot: target,
        formationAt: b.timestamp, sweepBar: b, priorBar: prior, rangeHighPivot: range.high, rangeLowPivot: range.low, confirmationEnd: barEnd(b, H), stage: 'breach', breached, reclaimed, contextual, referenceClean, targetClean: clean,
        signalClose: b.close, stop, target: target.price, rangeLocation: location };
      if (!reclaimed || !contextual || !clean) { e.stage = 'rejected'; e.reason = !reclaimed ? 'no_reclaim' : !contextual ? 'outside_context' : 'target_consumed'; events.push(e); continue; }
      e.formationKnownAt = barEnd(b, H) + lag; e.stage = 'confirmed'; events.push(e); emit(signals.sweep_control, 'sweep_control', side, barEnd(b, H), lag, card.holdHours ?? 24, e);

      let impulse: Bar | null = null, reason = 'expiry', terminalAt: number | null = null; const expiry = barEnd(b, H) + (card.impulseExpiryHours ?? 6) * H;
      let impulseAtr: number | null = null, impulsePriorBars: Bar[] = [];
      for (let j = i + 1; j < bars1h.length && bars1h[j].timestamp < expiry; j++) {
        const x = bars1h[j];
        // The whole candidate hour is part of the wait.  A stop/target wick in an
        // otherwise qualifying impulse is ambiguous and therefore cancels it.
        if (hit(stop, side === 1 ? -1 : 1, barEnd(b, H), barEnd(x, H)) || !targetClean(target, side, barEnd(x, H))) { reason = 'invalidated'; terminalAt = barEnd(x, H); break; }
        if (x.timestamp < barEnd(b, H) + lag) continue;
        const count = card.impulseAtrBars ?? 14, prior14 = j >= count + 1 ? bars1h.slice(j - count, j) : [];
        const atr = prior14.length === count ? prior14.reduce((v, z, k) => v + trueRange(z, k ? prior14[k - 1].close : bars1h[j - count - 1].close), 0) / prior14.length : null;
        const body = Math.abs(x.close - x.open), direction = side * (x.close - x.open) > 0;
        if (atr !== null && direction && x.high > x.low && body / (x.high - x.low) >= (card.impulseBodyFraction ?? .6) && x.high - x.low >= atr * (card.impulseAtrMultiple ?? 1)) { impulse = x; terminalAt = barEnd(x, H); impulseAtr = atr; impulsePriorBars = prior14; break; }
      }
      const cutoff = cs.at(-1)!.endTs;
      terminalAt ??= reason === 'expiry' ? (cutoff < expiry ? cutoff : expiry) : cutoff;
      const ie: Row = { ...e, id: `impulse:${side}:${reference.id}:${b.timestamp}`, mechanism: 'sweep_impulse', stage: impulse ? 'confirmed' : reason === 'expiry' && cutoff < expiry ? 'pending_at_cutoff' : reason, impulseBar: impulse, impulseAtr, impulseAtrBars: impulsePriorBars, waitAvailableAt: barEnd(b, H) + lag, formationKnownAt: barEnd(b, H) + lag, knownAt: terminalAt + lag, expiryAt: expiry, terminalAt, cutoffAt: cutoff, signalClose: impulse?.close ?? e.signalClose };
      events.push(ie);
      if (impulse) emit(signals.sweep_impulse, 'sweep_impulse', side, barEnd(impulse, H), lag, card.holdHours ?? 24, ie);
    }
  }

  // 1h structural break and the one-shot origin return.
  for (let i = 1; i < bars1h.length; i++) {
    const b = bars1h[i], prior = bars1h[i - 1], ps = pivots1h;
    for (const side of [1, -1] as Side[]) {
      const reference = latest(ps, side === 1 ? 'high' : 'low', b.timestamp, Infinity); if (!reference || breakUsed.has(`${side}:${reference.id}`)) continue;
      const crossed = side === 1 ? prior.close <= reference.price && b.close >= reference.price * (1 + breakPct) : prior.close >= reference.price && b.close <= reference.price * (1 - breakPct);
      if (!crossed) continue; breakUsed.add(`${side}:${reference.id}`);
      const context = bracket(b.timestamp), target = context && (side === 1 ? context.high : context.low);
      const origin = [...bars1h.slice(Math.max(0, i - (card.originLookbackBars ?? 12)), i)].reverse().find(x => x.timestamp >= reference.pivotAt && (side === 1 ? x.close < x.open : x.close > x.open));
      const e: Row = { id: `break:${side}:${reference.id}:${b.timestamp}`, family: 'origin', side, reference, targetPivot: target, formationAt: b.timestamp,
        breakBar: b, priorBar: prior, confirmationEnd: barEnd(b, H), stage: 'break', signalClose: b.close };
      if (!target || !targetClean(target, side, barEnd(b, H)) || !origin) { e.stage = 'rejected'; e.reason = !origin ? 'no_origin' : 'target_consumed'; events.push(e); continue; }
      const low = origin.low, high = origin.high, near = side === 1 ? high : low, far = side === 1 ? low : high;
      const outside = side === 1 ? b.close > high : b.close < low;
      e.originZone = { low, high, source: origin }; e.stop = side === 1 ? far * (1 - stopPct) : far * (1 + stopPct); e.target = target.price;
      if (!outside) { e.stage = 'rejected'; e.reason = 'break_inside_origin'; events.push(e); continue; }
      e.formationKnownAt = barEnd(b, H) + lag; e.stage = 'confirmed'; events.push(e); emit(signals.break_control, 'break_control', side, barEnd(b, H), lag, card.holdHours ?? 24, e);
      const published = barEnd(b, H) + lag, expiry = barEnd(b, H) + (card.retestExpiryHours ?? 12) * H; let retest: Bar | null = null, failure: string | null = null, terminalAt: number | null = null;
      for (let j = i + 1; j < bars1h.length && barEnd(bars1h[j], H) <= expiry; j++) { const x = bars1h[j];
        if (x.timestamp < published && barEnd(x, H) > published) {
          if (side === 1 ? x.low <= e.stop : x.high >= e.stop) failure = 'stop_publication_overlap';
          else if (!targetClean(target, side, barEnd(x, H))) failure = 'target_consumed_publication_overlap';
          else if (overlap(x, low, high)) failure = 'publication_overlap';
          if (failure) terminalAt = barEnd(x, H);
          if (failure) break;
        }
        if (x.timestamp < published) continue;
        if (side === 1 ? x.low <= e.stop : x.high >= e.stop) { failure = 'stop_before_retest'; terminalAt = barEnd(x, H); break; }
        if (!targetClean(target, side, barEnd(x, H))) { failure = 'target_consumed'; terminalAt = barEnd(x, H); break; }
        if (overlap(x, low, high)) { terminalAt = barEnd(x, H); if (side === 1 ? x.close > near : x.close < near) retest = x; else failure = 'failed_first_return'; break; }
      }
      const cutoff = cs.at(-1)!.endTs;
      terminalAt ??= cutoff < expiry ? cutoff : expiry;
      const re: Row = { ...e, id: `retest:${side}:${reference.id}:${b.timestamp}`, mechanism: 'origin_retest', stage: retest ? 'confirmed' : failure ?? (cutoff < expiry ? 'pending_at_cutoff' : 'expired'), retestBar: retest, availableAt: published, formationKnownAt: published, knownAt: terminalAt + lag, expiryAt: expiry, terminalAt, cutoffAt: cutoff, failure };
      events.push(re); if (retest) { re.signalClose = retest.close; emit(signals.origin_retest, 'origin_retest', side, barEnd(retest, H), lag, card.holdHours ?? 24, re); }
    }
  }
  for (const k of Object.keys(signals) as (keyof typeof signals)[]) {
    const kept: Action[] = [];
    for (const a of signals[k].sort((a, b) => a.at - b.at || a.evidence!.formationAt - b.evidence!.formationAt || a.id.localeCompare(b.id))) {
      const prior = kept.find(x => x.side === a.side && x.at === a.at);
      if (!prior) kept.push(a);
      else events.push({ id: `discarded:${a.id}`, family: k, stage: 'discarded_tie', discardedAction: a, keptAction: prior,
        formationAt: a.evidence!.formationAt, tieAt: a.at, reason: 'same_side_mechanism_oldest_then_lexical' });
    }
    signals[k] = kept.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  }
  return { signals, events, pivots: [...pivots, ...pivots1h].sort((a, b) => a.availableAt - b.availableAt || a.id.localeCompare(b.id)), bars1h, bars4h };
}
