import { readCandleTail } from '../collector-candle-repair';
import { buildContext, type Minute, type Bar, type Pivot, M, H, D } from '../strategies/setup-context';
import { sf01RangeLow } from '../strategies/sfp-detector';
import { sfpActions, type SfpSignal } from '../strategies/sfp-policy';

export interface SfpDecision { at: number; healthy: boolean; reason: string; minutes: number; signals: SfpSignal[]; }
export interface SfpBarSnapshot { at: number; bars: readonly Bar[]; pivots: readonly Pivot[]; }
export interface SfpContextCache { value: SfpBarSnapshot | null; }

/** Shared receipt/closed-minute normalization; optional observers cannot admit
 * candles that the execution reader would not have known at the same instant. */
export function availableSfpMinutes(rows: readonly any[], since: number, now: number, bootstrapAt: number): { minutes: Minute[]; error?: string } {
  const byTime = new Map<number, Minute>();
  for (const r of rows) {
    const ts = Number(r.ts ?? r.timestamp), end = ts + M;
    if (!Number.isSafeInteger(ts) || ts % M !== 0 || ts < since || end > now) continue;
    const receipt = r.availableAt ?? r.writtenAt ?? r.receivedAt;
    if (receipt === undefined && end >= bootstrapAt) continue;
    const availableAt = Math.max(end + M, Number(receipt ?? end + M));
    if (!Number.isFinite(availableAt) || availableAt > now) continue;
    const m: Minute = { ts, endTs: end, availableAt, open: Number(r.o ?? r.open), high: Number(r.h ?? r.high),
      low: Number(r.l ?? r.low), close: Number(r.c ?? r.close), volume: Number(r.v ?? r.volume), turnover: Number(r.t ?? r.turnover) };
    if (![m.open, m.high, m.low, m.close, m.volume, m.turnover].every(Number.isFinite)
      || Math.min(m.open, m.low, m.close) <= 0 || m.low > Math.min(m.open, m.close)
      || m.high < Math.max(m.open, m.close) || m.volume < 0 || m.turnover < 0) continue;
    const old = byTime.get(ts);
    if (old && ['open', 'high', 'low', 'close', 'volume', 'turnover'].some(k => old[k as keyof Minute] !== m[k as keyof Minute])) {
      return { minutes: [...byTime.values()], error: 'conflicting_candles' };
    }
    if (!old || m.availableAt < old.availableAt) byTime.set(ts, m);
  }
  return { minutes: [...byTime.values()].sort((a, b) => a.ts - b.ts) };
}
export function sfpDecision(rows: readonly any[], now: number, bootstrapAt: number, cache?: SfpContextCache): SfpDecision {
  if (cache) cache.value = null;
  const at = Math.floor((now - M) / (4 * H)) * (4 * H) + M;
  const since = Math.floor((at - 32 * D) / (4 * H)) * (4 * H);
  const { minutes, error } = availableSfpMinutes(rows, since, now, bootstrapAt);
  if (error) return { at, healthy: false, reason: error, minutes: minutes.length, signals: [] };
  if (!minutes.length || minutes[0].ts > since) return { at, healthy: false, reason: 'warmup_incomplete', minutes: minutes.length, signals: [] };
  const ctx = buildContext({ symbol: 'HYPEUSDT', minutes, lagMs: M, window: { start: since, end: now }, params: {} });
  ctx.cutoff = Math.floor(now / M) * M;
  const lastBar = ctx.bars(4 * H).find(b => b.timestamp === at - M - 4 * H);
  if (!lastBar || lastBar.availableAt > at) return { at, healthy: false, reason: 'latest_4h_missing_or_late', minutes: minutes.length, signals: [] };
  const events = sf01RangeLow.detect(ctx);
  if (cache) cache.value = { at, bars: ctx.bars(4 * H), pivots: ctx.pivots(4 * H, 2) };
  return { at, healthy: true, reason: now >= at + M ? 'entry_window_closed' : 'ready', minutes: minutes.length,
    signals: sfpActions(events).filter(s => s.at === at) };
}
export async function readSfpDecision(file: string, now: number, bootstrapAt: number, cache?: SfpContextCache): Promise<SfpDecision> {
  const since = Math.floor((now - 33 * D) / (4 * H)) * (4 * H);
  const rows = await readCandleTail(file, since, M, 32 * 1024 * 1024);
  return sfpDecision(rows, now, bootstrapAt, cache);
}
