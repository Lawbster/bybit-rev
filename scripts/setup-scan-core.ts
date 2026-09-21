/**
 * Setup scanner core. Research-only: no bot, executor, exchange or live-state imports.
 *
 * A scan answers "where did this library setup occur on this tape?" It is a causal
 * event ledger with known-at timestamps, not a backtest, not a replay and not evidence
 * of profitability. Forward labels are computed separately and are descriptive.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import assert from 'assert/strict';
import { atomicJson, fileHash, sha } from './research-workflow';

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

export interface TapeIdentity {
  source: 'sealed_cache' | 'live_jsonl' | 'research_tape'; file: string; sha256: string; start: number; end: number; rows: number;
  gaps: { start: number; end: number; minutes: number }[]; duplicates: number; conflicts: number; note: string;
}
export const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SEALED_CACHE = 'backtests/level-atlas/9b0da93e74fd42af858d38c1f859bfd8ae21e9963eda0b1a0d05135e8fe6cc8a';

export function sealedCovers(root: string, sealed: string, from: number, to: number): boolean {
  const schema = JSON.parse(fs.readFileSync(path.join(root, sealed, 'schema.json'), 'utf8'));
  return schema.start <= from && schema.end >= to;
}

export function sealedCacheDir(root: string): string | null {
  const latest = path.join(root, 'backtests/level-playbook/latest.json');
  try { const j = JSON.parse(fs.readFileSync(latest, 'utf8')); if (typeof j.cache === 'string' && fs.existsSync(path.join(root, j.cache, 'candles.f64'))) return j.cache; } catch { /* fall through */ }
  return fs.existsSync(path.join(root, DEFAULT_SEALED_CACHE, 'candles.f64')) ? DEFAULT_SEALED_CACHE : null;
}

/** Mirrors level-playbook-study.cachedCandles without importing the LV01 study graph. Parity is asserted in setup-scan-tests. */
export function readSealedMinutes(root: string, dir: string, lag: number): { minutes: Minute[]; schema: Row } {
  assert.equal(os.endianness(), 'LE');
  const schema = JSON.parse(fs.readFileSync(path.join(root, dir, 'schema.json'), 'utf8'));
  const bytes = fs.readFileSync(path.join(root, dir, 'candles.f64'));
  const xs = new Float64Array(bytes.length / 8); Buffer.from(xs.buffer).set(bytes);
  assert.equal(xs.length, schema.rows * 6, 'sealed cache row count mismatch');
  const minutes: Minute[] = Array.from({ length: schema.rows }, (_, i) => {
    const ts = schema.start + i * M;
    return { ts, endTs: ts + M, open: xs[i * 6], high: xs[i * 6 + 1], low: xs[i * 6 + 2], close: xs[i * 6 + 3], volume: xs[i * 6 + 4], turnover: xs[i * 6 + 5], availableAt: ts + M + lag };
  });
  return { minutes, schema };
}

export async function readLiveMinutes(file: string, from: number, to: number, lag: number): Promise<{ minutes: Minute[]; duplicates: number; conflicts: number }> {
  const byTs = new Map<number, Minute>();
  let duplicates = 0, conflicts = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let r: Row; try { r = JSON.parse(line); } catch { continue; }
    const ts = Number(r.ts ?? r.timestamp); if (!Number.isFinite(ts) || ts % M !== 0 || ts < from || ts >= to) continue;
    const open = Number(r.o ?? r.open), high = Number(r.h ?? r.high), low = Number(r.l ?? r.low), close = Number(r.c ?? r.close);
    const volume = Number(r.v ?? r.volume ?? 0), turnover = Number(r.t ?? r.turnover ?? 0);
    if (![open, high, low, close].every(x => Number.isFinite(x) && x > 0) || low > Math.min(open, close) || high < Math.max(open, close)) continue;
    const observed = Number(r.availableAt ?? r.receivedAt);
    const m: Minute = { ts, endTs: ts + M, open, high, low, close, volume, turnover, availableAt: Number.isFinite(observed) && observed >= ts + M ? Math.max(observed, ts + M + lag) : ts + M + lag };
    const prior = byTs.get(ts);
    if (prior) { duplicates++; if (prior.open !== open || prior.high !== high || prior.low !== low || prior.close !== close) conflicts++; }
    byTs.set(ts, m); // last row wins; conflicts are counted and reported
  }
  return { minutes: [...byTs.values()].sort((a, b) => a.ts - b.ts), duplicates, conflicts };
}

export function gapsOf(minutes: readonly Minute[]): TapeIdentity['gaps'] {
  const gaps: TapeIdentity['gaps'] = [];
  for (let i = 1; i < minutes.length; i++) if (minutes[i].ts !== minutes[i - 1].endTs) gaps.push({ start: minutes[i - 1].endTs, end: minutes[i].ts, minutes: (minutes[i].ts - minutes[i - 1].endTs) / M });
  return gaps;
}

/** The sealed LV01 minute cache holds one symbol and its schema does not say which; it must never be served for another. */
export const SEALED_CACHE_SYMBOL = 'HYPEUSDT';
export type TapePreference = 'auto' | 'sealed' | 'live' | 'research';

/**
 * Tape resolution order for `auto`: sealed cache (HYPEUSDT only, when it covers the window), then a research tape
 * built by scripts/build-research-tape.ts under backtests/tapes/, then the collector stream under data/.
 */
export async function loadTape(root: string, symbol: string, from: number, to: number, lag: number, prefer: TapePreference): Promise<{ minutes: Minute[]; identity: TapeIdentity }> {
  const sealed = symbol === SEALED_CACHE_SYMBOL ? sealedCacheDir(root) : null;
  if (prefer === 'sealed') assert(sealed, `no sealed cache for ${symbol}; the LV01 cache is ${SEALED_CACHE_SYMBOL} only`);
  const research = path.join(root, 'backtests/tapes', `${symbol}_1m.jsonl`);
  if ((prefer === 'research' || prefer === 'auto') && fs.existsSync(research)) {
    if (prefer === 'research' || !sealed || !sealedCovers(root, sealed, from, to)) {
      const { minutes, duplicates, conflicts } = await readLiveMinutes(research, from, to, lag);
      assert(minutes.length > 0, 'research tape has no rows in the requested window');
      const manifestFile = research.replace(/\.jsonl$/, '.manifest.json');
      const manifest = fs.existsSync(manifestFile) ? (JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as Row) : {};
      return { minutes, identity: { source: 'research_tape', file: `backtests/tapes/${symbol}_1m.jsonl`, sha256: String(manifest.sha256 ?? await fileHash(research)), start: minutes[0].ts, end: minutes[minutes.length - 1].endTs, rows: minutes.length, gaps: gapsOf(minutes), duplicates, conflicts, note: `Research tape: local Bybit linear 1m sources merged with public kline backfill (see manifest); modeled availability = bar end + lag. Remaining gaps in the manifest are excluded from bars, never bridged.` } };
    }
  }
  if (prefer === 'research') throw new Error(`no research tape: ${research}; build it with scripts/build-research-tape.ts`);
  if (prefer !== 'live' && sealed) {
    const schema = JSON.parse(fs.readFileSync(path.join(root, sealed, 'schema.json'), 'utf8'));
    const covers = schema.start <= from && schema.end >= to;
    if (covers || prefer === 'sealed') {
      const { minutes } = readSealedMinutes(root, sealed, lag);
      const slice = minutes.filter(m => m.ts >= from && m.ts < to);
      assert(slice.length > 0, 'sealed cache does not cover the requested window');
      const seal = JSON.parse(fs.readFileSync(path.join(root, sealed, 'complete.json'), 'utf8'));
      const item = (seal.artifacts as Row[]).find(a => a.file === 'candles.f64');
      return { minutes: slice, identity: { source: 'sealed_cache', file: `${sealed}/candles.f64`, sha256: String(item?.sha256 ?? await fileHash(path.join(root, sealed, 'candles.f64'))), start: slice[0].ts, end: slice[slice.length - 1].endTs, rows: slice.length, gaps: gapsOf(slice), duplicates: 0, conflicts: 0, note: 'Corrected contiguous research history (LV01 cache); modeled availability = bar end + lag, not original collector arrival.' } };
    }
  }
  const file = path.join(root, 'data', `${symbol}_1m.jsonl`);
  assert(fs.existsSync(file), `no live tape: ${file}`);
  const { minutes, duplicates, conflicts } = await readLiveMinutes(file, from, to, lag);
  assert(minutes.length > 0, 'live tape has no rows in the requested window');
  return { minutes, identity: { source: 'live_jsonl', file: `data/${symbol}_1m.jsonl`, sha256: await fileHash(file), start: minutes[0].ts, end: minutes[minutes.length - 1].endTs, rows: minutes.length, gaps: gapsOf(minutes), duplicates, conflicts, note: 'Collector stream as written; gaps are excluded from bars, never bridged. Rows with recorded availableAt use max(observed receipt, bar end + lag).' } };
}

// ── Forward labels (descriptive, computed after detection) ──

export function forwardLabels(ctx: DetectorContext, events: readonly SetupEvent[]): ForwardLabel[] {
  const ms = ctx.minutes;
  const firstIndexAt = (t: number) => { let lo = 0, hi = ms.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (ms[mid].ts < t) lo = mid + 1; else hi = mid; } return lo; };
  const out: ForwardLabel[] = [];
  for (const e of events) {
    if (e.stage !== 'confirmed') continue;
    const i0 = firstIndexAt(e.knownAt);
    if (i0 >= ms.length) { out.push({ eventId: e.id, entryProxyAt: null, entryProxyPrice: null, ret1hPct: null, ret4hPct: null, ret12hPct: null, ret24hPct: null, mfe24hPct: null, mae24hPct: null, firstBarrier: null, firstBarrierAt: null, censored: true, horizonEnd: null }); continue; }
    const entryAt = ms[i0].ts, entry = ms[i0].open, side = e.side, horizonEnd = entryAt + 24 * H;
    const retAt = (hours: number): number | null => { const j = firstIndexAt(entryAt + hours * H); if (j >= ms.length || ms[j].ts !== entryAt + hours * H) return null; return side * (ms[j].open / entry - 1) * 100; };
    let mfe = 0, mae = 0, firstBarrier: ForwardLabel['firstBarrier'] = 'none', firstBarrierAt: number | null = null, censored = false, lastTs = entryAt;
    const { stop, target } = e.proxies;
    for (let j = i0; j < ms.length && ms[j].ts < horizonEnd; j++) {
      const m = ms[j]; lastTs = m.endTs;
      mfe = Math.max(mfe, side * ((side === 1 ? m.high : m.low) / entry - 1) * 100);
      mae = Math.min(mae, side * ((side === 1 ? m.low : m.high) / entry - 1) * 100);
      if (firstBarrier === 'none' && (stop !== null || target !== null)) {
        const hitTarget = target !== null && (side === 1 ? m.high >= target : m.low <= target);
        const hitStop = stop !== null && (side === 1 ? m.low <= stop : m.high >= stop);
        if (hitTarget && hitStop) { firstBarrier = 'both_same_minute'; firstBarrierAt = m.ts; }
        else if (hitTarget) { firstBarrier = 'target'; firstBarrierAt = m.ts; }
        else if (hitStop) { firstBarrier = 'stop'; firstBarrierAt = m.ts; }
      }
    }
    if (lastTs < horizonEnd) censored = true;
    if (stop === null && target === null) firstBarrier = null;
    out.push({ eventId: e.id, entryProxyAt: entryAt, entryProxyPrice: entry, ret1hPct: retAt(1), ret4hPct: retAt(4), ret12hPct: retAt(12), ret24hPct: retAt(24), mfe24hPct: mfe, mae24hPct: mae, firstBarrier, firstBarrierAt, censored, horizonEnd });
  }
  return out;
}

// ── Output ──

export interface ScanRequest {
  setup: string; symbol: string; from: number; to: number; lagMs: number; tape: TapePreference;
  params: Record<string, number | string>; charts: boolean; maxChartEvents: number;
}
export interface ScanResult { key: string; dir: string; reused: boolean; summary: string; confirmed: number; events: number }

const iso = (t: number | null | undefined) => typeof t === 'number' && Number.isFinite(t) ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '-';
const pct = (x: number | null) => x === null ? '-' : `${x >= 0 ? '+' : ''}${x.toFixed(2)}%`;
const px = (x: number | null) => x === null ? '-' : x.toFixed(4);

export function renderSummary(args: { detector: SetupDetector; req: ScanRequest; identity: TapeIdentity; events: SetupEvent[]; labels: ForwardLabel[]; key: string; chartsDir: string | null }): string {
  const { detector: d, req, identity, events, labels, key } = args;
  const byStage = new Map<string, number>(), byReason = new Map<string, number>(), byMonth = new Map<string, { long: number; short: number }>();
  for (const e of events) {
    byStage.set(e.stage, (byStage.get(e.stage) ?? 0) + 1);
    if (e.stage !== 'confirmed') byReason.set(e.reason ?? e.stage, (byReason.get(e.reason ?? e.stage) ?? 0) + 1);
    else { const m = new Date(e.knownAt).toISOString().slice(0, 7); const c = byMonth.get(m) ?? { long: 0, short: 0 }; if (e.side === 1) c.long++; else c.short++; byMonth.set(m, c); }
  }
  const confirmed = events.filter(e => e.stage === 'confirmed').sort((a, b) => a.knownAt - b.knownAt);
  const labelOf = new Map(labels.map(l => [l.eventId, l]));
  const lines: string[] = [];
  lines.push(`# Setup scan: ${d.id} ${d.title} on ${req.symbol}`, '',
    `Scan key \`${key}\`. Detector version \`${d.version}\`. Window ${iso(req.from)} to ${iso(req.to)} UTC (events counted by final-stage known-at). Source lag ${req.lagMs / 1000}s.`,
    `Tape: ${identity.source} \`${identity.file}\` (${identity.rows.toLocaleString()} minutes, ${identity.gaps.length} gaps${identity.gaps.length ? `, largest ${Math.max(...identity.gaps.map(g => g.minutes))} min` : ''}). ${identity.note}`, '',
    '**This is a descriptive occurrence ledger, not a backtest.** Every row is a causal attempt with a known-at time; rejected and expired attempts are retained. Forward returns and barrier hits below are outcome labels attached after detection for orientation only. No fees, fills, occupancy, sizing or portfolio effects are modeled. Nothing here qualifies a setup; that requires a frozen card and a replay.', '',
    `## Counts`, '', `| Stage | Rows |`, `|---|---:|`, ...[...byStage.entries()].sort().map(([s, n]) => `| ${s} | ${n} |`), '',
    `Confirmed by month (long / short):`, '', `| Month | Long | Short |`, `|---|---:|---:|`, ...[...byMonth.entries()].sort().map(([m, c]) => `| ${m} | ${c.long} | ${c.short} |`), '');
  if (byReason.size) lines.push(`Non-confirmed reasons:`, '', `| Reason | Rows |`, `|---|---:|`, ...[...byReason.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `| ${r} | ${n} |`), '');
  const tagCounts = new Map<string, number>();
  for (const e of confirmed) for (const n of e.notes) tagCounts.set(n, (tagCounts.get(n) ?? 0) + 1);
  if (tagCounts.size) lines.push(`Confirmed rows carrying notes (control rows are the simpler comparison mechanism, not the named setup):`, '', `| Note | Rows |`, `|---|---:|`, ...[...tagCounts.entries()].sort().map(([t, n]) => `| ${t} | ${n} |`), '');
  lines.push(`## Confirmed events (${confirmed.length})`, '');
  if (confirmed.length) {
    lines.push(`| Known at (UTC) | Side | Stages | Entry proxy | Stop | Target | Risk % | 4h | 24h | MFE/MAE 24h | First barrier |`, `|---|---|---|---:|---:|---:|---:|---:|---:|---|---|`);
    for (const e of confirmed) {
      const l = labelOf.get(e.id);
      const stages = Object.entries(e.stages).map(([k, v]) => `${k}@${iso(v.at).slice(5)}`).join(' → ');
      const risk = l?.entryProxyPrice && e.proxies.stop !== null ? Math.abs(l.entryProxyPrice - e.proxies.stop) / l.entryProxyPrice * 100 : null;
      lines.push(`| ${iso(e.knownAt)} | ${e.side === 1 ? 'long' : 'short'} | ${stages} | ${px(l?.entryProxyPrice ?? null)} | ${px(e.proxies.stop)} | ${px(e.proxies.target)} | ${risk === null ? '-' : risk.toFixed(2)} | ${pct(l?.ret4hPct ?? null)} | ${pct(l?.ret24hPct ?? null)}${l?.censored ? ' (censored)' : ''} | ${pct(l?.mfe24hPct ?? null)} / ${pct(l?.mae24hPct ?? null)} | ${l?.firstBarrier ?? '-'} |`);
    }
    const complete = labels.filter(l => !l.censored && l.ret24hPct !== null);
    if (complete.length) {
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      const t = complete.filter(l => l.firstBarrier === 'target').length, s = complete.filter(l => l.firstBarrier === 'stop').length, both = complete.filter(l => l.firstBarrier === 'both_same_minute').length;
      lines.push('', `Descriptive aggregates over ${complete.length} uncensored confirmed events: mean 4h ${pct(mean(complete.map(l => l.ret4hPct ?? 0)))}, mean 24h ${pct(mean(complete.map(l => l.ret24hPct!)))}; first barrier within 24h: target ${t}, stop ${s}, same-minute both ${both}, neither ${complete.length - t - s - both}. Overlapping events are correlated, not independent samples.`);
    }
  } else lines.push('None in this window.');
  lines.push('', `## Conventions (operational choices, not source rules)`, '', ...d.conventions.map(c => `- ${c}`), '', `Parameters: \`${JSON.stringify(req.params)}\``, '', `## Files`, '', `- \`events.jsonl\`: every attempt with stage timestamps, known-at and frozen references.`, `- \`labels.jsonl\`: forward labels for confirmed events (descriptive).`, `- \`atlas-manifest.json\` + \`candles-1m.jsonl\`: render charts with \`npm run event-atlas -- --manifest <dir>/atlas-manifest.json\`.`);
  if (args.chartsDir) lines.push(`- Charts rendered to \`${args.chartsDir}/index.html\`.`);
  lines.push('', `Library card: \`${d.libraryCard}\`. Read it before interpreting a hit; the scan implements one declared operationalisation of the concept.`);
  return lines.join('\n') + '\n';
}

export async function runScan(root: string, detector: SetupDetector, req: ScanRequest, sourceFiles: string[]): Promise<ScanResult> {
  const from = req.from - detector.warmupMs;
  const { minutes, identity } = await loadTape(root, req.symbol, from, req.to, req.lagMs, req.tape);
  const pins: Row[] = [];
  for (const f of sourceFiles) pins.push({ file: f, sha256: await fileHash(path.join(root, f)) });
  const key = sha(JSON.stringify({ setup: detector.id, version: detector.version, params: req.params, symbol: req.symbol, from: req.from, to: req.to, lagMs: req.lagMs, tape: identity.source, tapeSha: identity.sha256, tapeStart: identity.start, tapeEnd: identity.end, pins }));
  const dir = path.join(root, 'backtests/setup-scans', key);
  if (fs.existsSync(path.join(dir, 'complete.json'))) {
    const summary = fs.readFileSync(path.join(dir, 'summary.md'), 'utf8');
    const s = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
    return { key, dir, reused: true, summary, confirmed: s.confirmed, events: s.events };
  }
  if (detector.requiresContiguous && identity.gaps.length) {
    // Use the longest contiguous segment that still ends at the window end; report the trim.
    let bestStart = 0, cur = 0;
    for (let i = 1; i < minutes.length; i++) { if (minutes[i].ts !== minutes[i - 1].endTs) cur = i; }
    bestStart = cur;
    identity.note += ` Detector requires a contiguous tape: scanned only the final contiguous segment starting ${new Date(minutes[bestStart].ts).toISOString()}.`;
    minutes.splice(0, bestStart);
  }
  const ctx = buildContext({ symbol: req.symbol, minutes, lagMs: req.lagMs, window: { start: req.from, end: req.to }, params: { ...detector.defaults, ...req.params } });
  const events = detector.detect(ctx).filter(e => e.knownAt >= req.from && e.knownAt < req.to).sort((a, b) => a.knownAt - b.knownAt || a.id.localeCompare(b.id));
  for (const e of events) {
    assert(e.knownAt >= e.formationAt, `known-at precedes formation: ${e.id}`);
    for (const [k, s] of Object.entries(e.stages)) assert(s.knownAt <= e.knownAt && s.knownAt >= s.at, `stage ${k} availability invalid: ${e.id}`);
  }
  const labels = forwardLabels(ctx, events);
  fs.mkdirSync(dir, { recursive: true });
  const write = (f: string, x: unknown) => atomicJson(path.join(dir, f), x);
  write('plan.json', { key, detector: { id: detector.id, version: detector.version, title: detector.title, family: detector.family, libraryCard: detector.libraryCard, conventions: detector.conventions }, request: req, tape: identity, pins, node: process.version, createdAt: Date.now(), kind: 'descriptive_setup_scan', economics: 'none' });
  fs.writeFileSync(path.join(dir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''));
  fs.writeFileSync(path.join(dir, 'labels.jsonl'), labels.map(l => JSON.stringify(l)).join('\n') + (labels.length ? '\n' : ''));
  // Chart inputs: a window slice of 1m candles (plus chart margins) and an event-atlas manifest for the confirmed events.
  const chartBefore = 96 * H, chartAfter = 24 * H;
  const confirmed = events.filter(e => e.stage === 'confirmed');
  const chartEvents = confirmed.slice(-req.maxChartEvents);
  const cMin = chartEvents.length ? Math.min(...chartEvents.map(e => e.knownAt)) - chartBefore : req.from, cMax = chartEvents.length ? Math.max(...chartEvents.map(e => e.knownAt)) + chartAfter : req.to;
  const slice = minutes.filter(m => m.ts >= cMin && m.ts <= cMax);
  fs.writeFileSync(path.join(dir, 'candles-1m.jsonl'), slice.map(m => JSON.stringify({ ts: m.ts, o: m.open, h: m.high, l: m.low, c: m.close, v: m.volume })).join('\n') + '\n');
  const manifest = {
    version: 1, id: `setup-scan-${detector.id.toLowerCase()}-${key.slice(0, 12)}`, symbol: req.symbol, title: `${detector.id} ${detector.title} — ${req.symbol} scan ${key.slice(0, 12)}`,
    candleSource: { path: `backtests/setup-scans/${key}/candles-1m.jsonl`, format: 'jsonl', intervalMinutes: 1, fields: { timestamp: 'ts', open: 'o', high: 'h', low: 'l', close: 'c', volume: 'v' } },
    events: chartEvents.map(e => ({ id: `${e.side === 1 ? 'long' : 'short'}-${new Date(e.knownAt).toISOString().slice(0, 16).replace(/[-:T]/g, '')}`, at: new Date(e.knownAt).toISOString(), label: `${detector.id} ${e.side === 1 ? 'long' : 'short'} · known ${iso(e.knownAt)} UTC`, tags: [detector.id, e.side === 1 ? 'long' : 'short'], note: `stop ${px(e.proxies.stop)} target ${px(e.proxies.target)}; ${Object.entries(e.stages).map(([k, v]) => `${k} ${iso(v.at)}${v.price !== undefined ? ` @${v.price.toFixed(4)}` : ''}`).join('; ')}` })),
    chart: { beforeHours: 96, afterHours: 24, primaryIntervalMinutes: 60, secondaryIntervalMinutes: 240 },
    similarity: { enabled: false, candidateIntervalMinutes: 240, lookbackHours: 72, neighboursPerEvent: 0, exclusionHours: 48 },
    srMemory: { enabled: false },
    outputDir: `backtests/setup-scans/${key}/charts`,
  };
  write('atlas-manifest.json', manifest);
  let chartsDir: string | null = null;
  if (req.charts && chartEvents.length) {
    const { generateEventAtlas } = await import('../src/research/event-atlas');
    const generated = await generateEventAtlas(path.join(dir, 'atlas-manifest.json'), root);
    chartsDir = path.relative(root, generated.outputDir).replace(/\\/g, '/');
  }
  const summary = renderSummary({ detector, req, identity, events, labels, key, chartsDir });
  fs.writeFileSync(path.join(dir, 'summary.md'), summary);
  write('summary.json', { key, setup: detector.id, version: detector.version, symbol: req.symbol, from: req.from, to: req.to, events: events.length, confirmed: confirmed.length, long: confirmed.filter(e => e.side === 1).length, short: confirmed.filter(e => e.side === -1).length, tape: identity.source, charts: chartsDir });
  const artifacts: Row[] = [];
  for (const f of fs.readdirSync(dir).sort()) { const p = path.join(dir, f); if (fs.statSync(p).isFile()) artifacts.push({ file: f, sha256: await fileHash(p) }); }
  write('complete.json', { key, artifacts, kind: 'descriptive_setup_scan' });
  const latestFile = path.join(root, 'backtests/setup-scans/latest.json');
  const latest = fs.existsSync(latestFile) ? JSON.parse(fs.readFileSync(latestFile, 'utf8')) : {};
  latest[detector.id] = { key, dir: `backtests/setup-scans/${key}`, symbol: req.symbol, from: req.from, to: req.to, at: Date.now() };
  atomicJson(latestFile, latest);
  return { key, dir, reused: false, summary, confirmed: confirmed.length, events: events.length };
}
