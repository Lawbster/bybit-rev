import type { Candle } from "../fetch-candles";
import type { LadderPosition } from "./state";

export const AGGRESSIVE10_ID = "age10__minus_deep_stress__minus_tp_cooldown";
export const AGGRESSIVE10_HIGH_REASON = "AGGRESSIVE10_TWO_DAY_HIGH";
export const MINUTE_MS = 60_000;
export const HIGH_WINDOW_MINUTES = 2_880;

export interface Aggressive10LadderState {
  policyId: typeof AGGRESSIVE10_ID;
  tpPhase: "unseen" | "extending" | "released";
}

/** Same one-way deferral as the frozen age-only replay controller. */
export function aggressive10TpDecision(
  phase: Aggressive10LadderState["tpPhase"],
  oldestEntryTime: number,
  at: number,
  basePct: number,
  normalPct: number,
): { phase: Aggressive10LadderState["tpPhase"]; pct: number } {
  if (phase === "released" || (phase === "unseen" && basePct >= normalPct)) return { phase, pct: basePct };
  if (at - oldestEntryTime >= 10 * 3_600_000) return { phase: "released", pct: basePct };
  return { phase: "extending", pct: normalPct };
}

export interface Aggressive10HighSnapshot {
  healthy: boolean;
  decisionReady: boolean;
  reason: string;
  decisionAt: number | null;
  sourceStart: number | null;
  bars: number;
  high: number | null;
  close: number | null;
  distancePct: number | null;
}

/** No partial bars, approximated daily highs, or gap-filled synthetic prices. */
export function aggressive10HighSnapshot(candles: readonly Candle[], now: number): Aggressive10HighSnapshot {
  const decisionAt = Math.floor(now / MINUTE_MS) * MINUTE_MS;
  const sourceStart = decisionAt - HIGH_WINDOW_MINUTES * MINUTE_MS;
  const rows = candles.filter(c => c.timestamp >= sourceStart && c.timestamp + MINUTE_MS <= decisionAt);
  const unavailable = (reason: string): Aggressive10HighSnapshot => ({
    healthy: false, decisionReady: false, reason, decisionAt, sourceStart, bars: rows.length, high: null, close: null, distancePct: null,
  });
  if (rows.length !== HIGH_WINDOW_MINUTES) return unavailable("minute_coverage_incomplete");
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i];
    if (c.timestamp !== sourceStart + i * MINUTE_MS) return unavailable("minute_coverage_discontinuous");
    if (![c.open, c.high, c.low, c.close].every(x => Number.isFinite(x) && x > 0)
      || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close)) return unavailable("invalid_ohlc");
  }
  const high = Math.max(...rows.map(c => c.high)), close = rows[rows.length - 1].close;
  const decisionReady = now - decisionAt <= 30_000;
  return { healthy: true, decisionReady, reason: decisionReady ? "healthy" : "decision_window_expired", decisionAt, sourceStart, bars: rows.length,
    high, close, distancePct: Math.max(0, (1 - close / high) * 100) };
}

export function aggressive10HighExit(snapshot: Aggressive10HighSnapshot, positions: readonly LadderPosition[]): boolean {
  if (!snapshot.healthy || !snapshot.decisionReady || snapshot.decisionAt === null || snapshot.distancePct === null || !positions.length) return false;
  // Do not retroactively act on a candle that predates any surviving entry.
  if (positions.some(p => p.entryTime > snapshot.decisionAt!)) return false;
  const age = snapshot.decisionAt - Math.min(...positions.map(p => p.entryTime));
  return age >= 4 * 3_600_000 && snapshot.distancePct <= 1 + 1e-10;
}
