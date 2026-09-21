/** LV03 research adapter only. Existing execution kernel remains unchanged. */
import assert from 'assert/strict';
import { replay, type Action } from './poc-indicator-bias-engine';
import { runPercent, type Options } from './level-tpsl-engine';
import type { Candle } from './hype-freerun-canonical-replay';
export function runCap(cs: readonly Candle[], signals: readonly Action[], options: Omit<Options, 'hold'>,
  capHours: number | null, tpPct: number | null, slPct: number | null) {
  assert(capHours === null || (Number.isFinite(capHours) && capHours > 0));
  assert((tpPct === null) === (slPct === null));
  assert(capHours !== null || tpPct !== null, 'No exit at all is outside the card');
  const o = { ...options, hold: capHours === null ? Infinity : capHours * 3600000 };
  return tpPct === null ? replay(cs, signals, o) : runPercent(cs, signals, o, tpPct, slPct!);
}
export function holdingStats(run: ReturnType<typeof runCap>, end: number) {
  const hours = run.trades.map(t => (t.exitAt - t.entryAt) / 3600000).sort((a, b) => a - b);
  const q = (p: number) => hours.length ? hours[Math.ceil(p * hours.length) - 1] : null;
  return { meanHoldHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    medianHoldHours: q(.5), p95HoldHours: q(.95), maxHoldHours: hours.at(-1) ?? null,
    openAgeHours: run.open ? (end - run.open.entryAt) / 3600000 : null };
}
