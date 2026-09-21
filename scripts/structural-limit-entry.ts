/** Research execution policy only; no strategy detection or PnL accounting. */
import assert from 'assert/strict';
import type { Candle } from './hype-freerun-canonical-replay';
export interface LimitEntry { price: number; expiresAt: number; model: 'touch' | 'open' }
export interface LimitIntent { id: string; signalAt: number; activeAt: number; expiresAt: number; limit: number;
  phase: 'filled' | 'expired' | 'invalidated' | 'cutoff'; endedAt: number; entryAt: number | null; intrabar: boolean; ignoredTouches: number }
const M = 60000;
export function resolveLimitEntry(cs: readonly Candle[], s: { id: string; at: number; side: 1 | -1; stop?: number; target?: number; entry?: LimitEntry }, delay: number, end: number): LimitIntent {
  assert(s.entry && s.side === 1, 'limit research supports long brackets only');
  const l = s.entry, active = s.at + delay;
  assert(Number.isFinite(l.price) && l.price > s.stop! && l.price < s.target!);
  assert(l.expiresAt > s.at && l.expiresAt % M === 0 && ['touch', 'open'].includes(l.model));
  const row: LimitIntent = { id: s.id, signalAt: s.at, activeAt: active, expiresAt: l.expiresAt, limit: l.price,
    phase: 'cutoff', endedAt: end, entryAt: null, intrabar: false, ignoredTouches: 0 };
  for (let t = active; t < Math.min(l.expiresAt, end); t += M) {
    const b = cs[(t - cs[0].ts) / M]; assert(b && b.ts === t);
    // Before placement the bracket may already be invalid. After placement a
    // downside gap is a fill/loss, never a cost-free retroactive cancellation.
    if ((t === active && b.open <= s.stop!) || b.open >= s.target!) {
      row.phase = 'invalidated'; row.endedAt = t; return row;
    }
    if (b.open <= l.price || (l.model === 'touch' && b.low <= l.price)) {
      row.phase = 'filled'; row.endedAt = t; row.entryAt = t; row.intrabar = b.open > l.price; return row;
    }
    if (b.low <= l.price) row.ignoredTouches++;
  }
  if (l.expiresAt <= end) { row.phase = 'expired'; row.endedAt = l.expiresAt; }
  return row;
}
