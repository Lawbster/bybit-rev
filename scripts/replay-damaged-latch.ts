/** Pure historical latch reconstruction. No cached variant intervals or trading imports. */
import { buildDamagedRegimeStructure, evaluateDamagedRegimeLatch, EMPTY_DAMAGED_REGIME_LATCH_STATE, type DamagedRegimeLatchConfig } from "../src/bot/damaged-regime-latch";
import type { Candle as NativeCandle } from "../src/fetch-candles";
import type { Candle } from "./hype-freerun-canonical-replay";
import { firstDecisionAt, observationAvailability, utcMs, MINUTE_MS, type ReplayRow } from "./replay-causality";

type Taker = { buy: number; sell: number; windowEnd: number };
export type ReplayTaker = Map<number, Taker>;
export function addReplayTaker(taker: ReplayTaker, row: ReplayRow): void {
  const key = firstDecisionAt(observationAvailability(row, "hl_taker"));
  const previous = taker.get(key);
  // Collector restarts can flush disjoint trade fragments within the same window.
  // These are flows to sum, not conflicting point-in-time OI snapshots to replace.
  taker.set(key, { buy: (previous?.buy || 0) + (Number(row.buyNotional) || 0), sell: (previous?.sell || 0) + (Number(row.sellNotional) || 0), windowEnd: Math.max(previous?.windowEnd || 0, utcMs(row.windowEnd ?? row.timestamp ?? row.ts)) });
}
export function rebuildDamagedLatch(candles: Candle[], config: DamagedRegimeLatchConfig, taker: ReplayTaker,
  pulseAt?: (now: number) => { taker15m: number | null; taker1h: number | null; taker15mSamples: number; taker1hSamples: number; takerAgeSec: number | null }) {
  const FOUR_H = 240 * MINUTE_MS;
  const grouped = new Map<number, NativeCandle>();
  for (const c of candles) {
    const timestamp = Math.floor(c.ts / FOUR_H) * FOUR_H;
    const b = grouped.get(timestamp);
    if (!b) grouped.set(timestamp, { timestamp, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover });
    else { b.high = Math.max(b.high, c.high); b.low = Math.min(b.low, c.low); b.close = c.close; b.volume += c.volume; b.turnover += c.turnover; }
  }
  const bars = [...grouped.values()].sort((a, b) => a.timestamp - b.timestamp);
  let barAt = -1, cachedAt = -1;
  let structure: ReturnType<typeof buildDamagedRegimeStructure> = null;
  // Backtest starts with an established inactive policy, not a simulated code deployment.
  // Actual Aug-14 bootstrap is a separate deployment-time scenario, never inferred here.
  let state = { ...EMPTY_DAMAGED_REGIME_LATCH_STATE, initialized: true };
  const blocked: boolean[] = [];
  const transitions: { at: number; transition: string; reason: string }[] = [];
  for (const c of candles) {
    const now = c.endTs;
    while (barAt + 1 < bars.length && bars[barAt + 1].timestamp + FOUR_H + 10_000 <= now) barAt++;
    if (barAt !== cachedAt) {
      cachedAt = barAt;
      structure = buildDamagedRegimeStructure(bars.slice(Math.max(0, barAt - 248), barAt + 1), 200, config.releaseBars, now);
    }
    let buy15 = 0, sell15 = 0, buy60 = 0, sell60 = 0, n15 = 0, n60 = 0, lastEnd = 0;
    for (let k = now - 59 * MINUTE_MS; !pulseAt && k <= now; k += MINUTE_MS) {
      const row = taker.get(k);
      if (!row) continue;
      buy60 += row.buy; sell60 += row.sell; n60++; lastEnd = Math.max(lastEnd, row.windowEnd);
      if (k > now - 15 * MINUTE_MS) { buy15 += row.buy; sell15 += row.sell; n15++; }
    }
    const d = evaluateDamagedRegimeLatch({ previous: state, config, structure, nowMs: now, pulse: pulseAt ? pulseAt(now) : {
      taker15m: sell15 > 0 ? buy15 / sell15 : null, taker1h: sell60 > 0 ? buy60 / sell60 : null,
      taker15mSamples: n15, taker1hSamples: n60, takerAgeSec: lastEnd ? (now - lastEnd) / 1000 : null,
    } });
    state = d.state; blocked.push(d.blocked);
    if (d.transition !== "none") transitions.push({ at: now, transition: d.transition, reason: d.reason });
  }
  return { blocked, transitions, initialState: "initialized_inactive_not_deployment_bootstrap" };
}
