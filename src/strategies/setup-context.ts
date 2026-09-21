import assert from 'assert/strict';

export const M = 60_000, H = 60 * M, D = 24 * H;
export type Side = 1 | -1;
export type Row = Record<string, unknown>;

export interface Minute {
  ts: number; endTs: number; open: number; high: number; low: number; close: number; volume: number; turnover: number;
  /** Observed final receipt when the source recorded one; otherwise modeled as endTs + lag by the tape loader. */
  availableAt: number;
}
export interface Bar {
  timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number;
  /** Latest availability of any constituent minute. */
  availableAt: number;
}
export interface Pivot {
  id: string; kind: 'high' | 'low'; price: number; pivotAt: number; confirmationEnd: number; availableAt: number; timeframe: number; width: number;
}
export type Stage = 'confirmed' | 'rejected' | 'expired' | 'invalidated' | 'pending_at_cutoff';
export interface StageMark { at: number; knownAt: number; price?: number; note?: string }
export interface SetupEvent {
  id: string; setup: string; version: string; side: Side; stage: Stage; reason?: string;
  /** Start of the bar that completed (or terminated) the sequence. */
  formationAt: number;
  /** When the final stage became knowable: max of every referenced availability. */
  knownAt: number;
  stages: Record<string, StageMark>;
  reference: Row;
  proxies: { entry: number | null; stop: number | null; target: number | null };
  notes: string[];
}
export interface ForwardLabel {
  eventId: string; entryProxyAt: number | null; entryProxyPrice: number | null;
  ret1hPct: number | null; ret4hPct: number | null; ret12hPct: number | null; ret24hPct: number | null;
  mfe24hPct: number | null; mae24hPct: number | null;
  firstBarrier: 'target' | 'stop' | 'both_same_minute' | 'none' | null; firstBarrierAt: number | null;
  censored: boolean; horizonEnd: number | null;
}
export interface DetectorContext {
  symbol: string;
  minutes: readonly Minute[];
  lagMs: number;
  window: { start: number; end: number };
  cutoff: number;
  params: Record<string, number | string>;
  bars(tfMs: number): readonly Bar[];
  pivots(tfMs: number, width: number): readonly Pivot[];
  /** True when any minute in [from, until) traded through `price` on `side` (1 = high >= price, -1 = low <= price). */
  hit(price: number, side: Side, from: number, until: number): boolean;
}
export interface SetupDetector {
  id: string; version: string; title: string; family: string; aliases: string[]; libraryCard: string;
  defaults: Record<string, number | string>;
  /** Every operational choice that the source PDFs do not specify. Printed in each summary. */
  conventions: string[];
  /** PA07 wrappers assert a contiguous tape; gap-tolerant detectors do not. */
  requiresContiguous?: boolean;
  warmupMs: number;
  detect(ctx: DetectorContext): SetupEvent[];
}

// ── Aggregation and pivots (gap tolerant; identical to the strict PA07 helpers on contiguous tapes) ──

export function aggregateBars(minutes: readonly Minute[], tf: number): Bar[] {
  assert(tf >= M && tf % M === 0 && D % tf === 0, 'timeframe must be a whole number of minutes dividing a UTC day');
  const out: Bar[] = [];
  const per = tf / M;
  for (let i = 0; i < minutes.length;) {
    const start = Math.floor(minutes[i].ts / tf) * tf;
    const begin = i;
    let contiguous = minutes[i].ts === start;
    let high = -Infinity, low = Infinity, volume = 0, turnover = 0, availableAt = 0;
    while (i < minutes.length && minutes[i].ts < start + tf) {
      if (i > begin && minutes[i].ts !== minutes[i - 1].endTs) contiguous = false;
      const m = minutes[i];
      high = Math.max(high, m.high); low = Math.min(low, m.low); volume += m.volume; turnover += m.turnover;
      availableAt = Math.max(availableAt, m.availableAt);
      i++;
    }
    if (!contiguous || i - begin !== per) continue;
    out.push({ timestamp: start, open: minutes[begin].open, close: minutes[i - 1].close, high, low, volume, turnover, availableAt });
  }
  return out;
}

/** Strict pivots: ties are not extremes. A pivot needs a contiguous 2*width+1 neighbourhood. */
export function causalPivotsTolerant(bars: readonly Bar[], tf: number, width: number, lag: number): Pivot[] {
  assert(Number.isInteger(width) && width >= 1 && lag >= 0);
  const out: Pivot[] = [];
  for (let i = width; i + width < bars.length; i++) {
    let contiguous = true;
    for (let k = i - width + 1; k <= i + width; k++) if (bars[k].timestamp !== bars[k - 1].timestamp + tf) { contiguous = false; break; }
    if (!contiguous) continue;
    const b = bars[i];
    let isHigh = true, isLow = true;
    for (let k = i - width; k <= i + width; k++) {
      if (k === i) continue;
      if (bars[k].high >= b.high) isHigh = false;
      if (bars[k].low <= b.low) isLow = false;
    }
    const confirmationEnd = bars[i + width].timestamp + tf;
    // Bar availability already includes the modeled lag (or an observed receipt); do not add it twice.
    const availableAt = Math.max(confirmationEnd + lag, bars[i + width].availableAt);
    if (isHigh) out.push(Object.freeze({ id: `pivot:${tf}:high:${b.timestamp}:${b.high}`, kind: 'high', price: b.high, pivotAt: b.timestamp, confirmationEnd, availableAt, timeframe: tf, width }));
    if (isLow) out.push(Object.freeze({ id: `pivot:${tf}:low:${b.timestamp}:${b.low}`, kind: 'low', price: b.low, pivotAt: b.timestamp, confirmationEnd, availableAt, timeframe: tf, width }));
  }
  return out.sort((a, b) => a.availableAt - b.availableAt || a.id.localeCompare(b.id));
}

export function buildContext(args: {
  symbol: string; minutes: readonly Minute[]; lagMs: number; window: { start: number; end: number };
  params: Record<string, number | string>;
}): DetectorContext {
  const { minutes } = args;
  assert(minutes.length > 0, 'empty tape');
  for (let i = 1; i < minutes.length; i++) assert(minutes[i].ts > minutes[i - 1].ts, 'tape must be sorted and deduplicated');
  const barCache = new Map<number, Bar[]>(), pivotCache = new Map<string, Pivot[]>();
  const bars = (tf: number) => { let b = barCache.get(tf); if (!b) { b = aggregateBars(minutes, tf); barCache.set(tf, b); } return b; };
  const firstIndexAt = (t: number) => { let lo = 0, hi = minutes.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (minutes[mid].ts < t) lo = mid + 1; else hi = mid; } return lo; };
  return {
    symbol: args.symbol, minutes, lagMs: args.lagMs, window: args.window, cutoff: minutes[minutes.length - 1].endTs, params: args.params,
    bars,
    pivots(tf, width) { const k = `${tf}:${width}`; let p = pivotCache.get(k); if (!p) { p = causalPivotsTolerant(bars(tf), tf, width, args.lagMs); pivotCache.set(k, p); } return p; },
    hit(price, side, from, until) {
      for (let i = firstIndexAt(from); i < minutes.length && minutes[i].ts < until; i++) {
        if (side === 1 ? minutes[i].high >= price : minutes[i].low <= price) return true;
      }
      return false;
    },
  };
}

export const latestPivot = (ps: readonly Pivot[], kind: Pivot['kind'], knownBy: number, occurredBefore = Infinity): Pivot | null => {
  let best: Pivot | null = null;
  for (const p of ps) if (p.kind === kind && p.availableAt <= knownBy && p.pivotAt < occurredBefore && (!best || p.pivotAt > best.pivotAt)) best = p;
  return best;
};

/** First pivot of `kind` known by `knownBy` whose price lies on `side` of `fromPrice` and has not been traded through since it became available. */
export function nextUntouchedPivot(ctx: DetectorContext, ps: readonly Pivot[], kind: Pivot['kind'], side: Side, fromPrice: number, knownBy: number): Pivot | null {
  const candidates = ps.filter(p => p.kind === kind && p.availableAt <= knownBy && side * (p.price - fromPrice) > 0 && !ctx.hit(p.price, side, p.availableAt, knownBy));
  candidates.sort((a, b) => side * (a.price - b.price));
  return candidates[0] ?? null;
}

// ── Tape loading ──
