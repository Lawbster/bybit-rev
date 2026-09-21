/** HT01 causal high references, no POC or production decision imports. */
import assert from 'assert/strict';
import type { Candle } from './hype-freerun-canonical-replay';
import type { Action } from './poc-indicator-bias-engine';
export const M = 60000, WINDOW = 2880;
export interface HighEvidence { id: string; kind: string; at: number; observationStart: number; observationEnd: number;
  sourceStart: number; sourceEnd: number; referenceAvailableAt: number; high: number; open: number; low: number; observedHigh: number; close: number; distancePct: number; }
export function highSignals(cs: readonly Candle[], window = WINDOW) {
  assert(window > 0 && Number.isInteger(window));
  const rolling = new Float64Array(cs.length); rolling.fill(NaN);
  const q = new Int32Array(cs.length); let head = 0, tail = 0;
  const groups = ['exact_touch', 'near_high_1pct'].map(id => ({ id, signals: [] as Action[], evidence: [] as HighEvidence[], episodes: 0 }));
  const last = new Map<string, number>();
  for (let i = 0; i < cs.length; i++) {
    const b = cs[i]; assert.equal(b.endTs, b.ts + M); if (i) assert.equal(b.ts, cs[i - 1].endTs);
    assert([b.open, b.high, b.low, b.close].every(v => Number.isFinite(v) && v > 0));
    assert(b.high >= Math.max(b.open, b.close) && b.low <= Math.min(b.open, b.close));
    while (head < tail && q[head] <= i - window) head++;
    while (head < tail && cs[q[tail - 1]].high <= b.high) tail--;
    q[tail++] = i; if (i >= window - 1) rolling[i] = cs[q[head]].high;
    // The exact-touch reference is known at the observation minute's start,
    // including the explicit60s finalized-bar publication allowance.
    if (i < window + 1) continue;
    for (const g of groups) {
      const endIndex = g.id === 'exact_touch' ? i - 2 : i, high = rolling[endIndex];
      const distancePct = Math.max(0, (1 - b.close / high) * 100);
      const fired = g.id === 'exact_touch' ? b.low <= high && high <= b.high : distancePct <= 1 + 1e-10;
      if (!fired) continue;
      const at = b.endTs + M, id = `${g.id}:${at}`;
      if (last.get(g.id) !== b.ts - M) g.episodes++; last.set(g.id, b.ts);
      g.signals.push({ id, at, side: -1 });
      g.evidence.push({ id, kind: g.id, at, observationStart: b.ts, observationEnd: b.endTs,
        sourceStart: cs[endIndex - window + 1].ts, sourceEnd: cs[endIndex].endTs, referenceAvailableAt: cs[endIndex].endTs + M,
        high, open: b.open, low: b.low, observedHigh: b.high, close: b.close, distancePct });
    }
  }
  return { rolling, groups };
}
