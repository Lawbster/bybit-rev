/**
 * Weak-week time stop: shared pure predicate for research replay and (later) the live bot.
 *
 * Fires when ALL hold at a completed-minute decision:
 *   - the oldest surviving rung is at least minAgeHours old at the decision minute's close time;
 *   - gross = decisionClose / avgEntry - 1 is at or below maxGrossPct (avgEntry = sum notional / sum qty);
 *   - the 7-day return decisionClose / referenceClose - 1 is at or below ret7dMaxPct, where the reference is the
 *     1m candle whose close time is EXACTLY seven days before the decision close time.
 *
 * Missing or misaligned inputs never fire (fail closed). Research: research/opus-5.5-ladder-exit-lab-2026-09-25.md.
 * Used by the opt-in runtime controller; default mode is off.
 */

export const TIME_STOP_LOOKBACK_MS = 7 * 24 * 60 * 60_000;
const HOUR_MS = 3_600_000;

export interface TimeStopParams {
  minAgeHours: number;
  maxGrossPct: number;
  ret7dMaxPct: number;
}

/** The researched parameters (exit-lab HF21_TS40_r0). */
export const TIME_STOP_RESEARCH_PARAMS: Readonly<TimeStopParams> = Object.freeze({ minAgeHours: 40, maxGrossPct: 0, ret7dMaxPct: 0 });

export interface TimeStopPosition { entryTime: number; notional: number; qty: number }

export interface TimeStopInput {
  positions: readonly TimeStopPosition[];
  /** Close of the completed decision minute and its close time (candle start + 60s). */
  decisionClose: number;
  decisionCloseTime: number;
  /** Close of the reference minute and its close time; null when unavailable. */
  referenceClose: number | null;
  referenceCloseTime: number | null;
}

export type TimeStopBlock = "no_inventory" | "age" | "gross" | "reference_missing" | "reference_misaligned" | "ret7d" | "invalid_input";

export interface TimeStopDecision {
  fire: boolean;
  /** First condition that blocked the stop, or null when it fires. */
  blockedBy: TimeStopBlock | null;
  /** The ladder is old enough; the remaining conditions decide. Use for eligible-but-unavailable telemetry. */
  ageEligible: boolean;
  ageHours: number | null;
  grossPct: number | null;
  ret7dPct: number | null;
  reason: string;
}

export function validateTimeStopParams(p: TimeStopParams): void {
  if (!Number.isFinite(p.minAgeHours) || p.minAgeHours <= 0) throw new Error("timeStop.minAgeHours must be a positive number");
  if (!Number.isFinite(p.maxGrossPct)) throw new Error("timeStop.maxGrossPct must be finite");
  if (!Number.isFinite(p.ret7dMaxPct)) throw new Error("timeStop.ret7dMaxPct must be finite");
}

export function evaluateTimeStop(input: TimeStopInput, params: TimeStopParams): TimeStopDecision {
  const out = (blockedBy: TimeStopBlock | null, ageEligible: boolean, ageHours: number | null, grossPct: number | null, ret7dPct: number | null): TimeStopDecision => ({
    fire: blockedBy === null, blockedBy, ageEligible, ageHours, grossPct, ret7dPct,
    reason: blockedBy === null
      ? `TIME STOP: oldest ${ageHours!.toFixed(1)}h, gross ${grossPct!.toFixed(2)}%, ret7d ${ret7dPct!.toFixed(2)}%`
      : `time stop hold: ${blockedBy}`,
  });
  const { positions, decisionClose, decisionCloseTime } = input;
  if (!positions.length) return out("no_inventory", false, null, null, null);
  if (!Number.isFinite(decisionClose) || !(decisionClose > 0) || !Number.isSafeInteger(decisionCloseTime) || decisionCloseTime % 60_000 !== 0
    || positions.some(p => !Number.isFinite(p.entryTime) || p.entryTime > decisionCloseTime
      || !Number.isFinite(p.notional) || !Number.isFinite(p.qty) || !(p.notional > 0) || !(p.qty > 0))) return out("invalid_input", false, null, null, null);

  // Same arithmetic and order as the replay engine (sum notional / sum qty; percent of the ratio minus one).
  const oldest = Math.min(...positions.map(p => p.entryTime));
  const ageMs = decisionCloseTime - oldest, ageHours = ageMs / HOUR_MS;
  const avg = positions.reduce((v, p) => v + p.notional, 0) / positions.reduce((v, p) => v + p.qty, 0);
  const grossPct = (decisionClose / avg - 1) * 100;
  if (ageMs < params.minAgeHours * HOUR_MS) return out("age", false, ageHours, grossPct, null);
  if (grossPct > params.maxGrossPct) return out("gross", true, ageHours, grossPct, null);

  const { referenceClose, referenceCloseTime } = input;
  if (referenceClose === null || referenceCloseTime === null || !Number.isFinite(referenceClose) || !(referenceClose > 0)) return out("reference_missing", true, ageHours, grossPct, null);
  if (decisionCloseTime - referenceCloseTime !== TIME_STOP_LOOKBACK_MS) return out("reference_misaligned", true, ageHours, grossPct, null);
  const ret7dPct = (decisionClose / referenceClose - 1) * 100;
  if (ret7dPct > params.ret7dMaxPct) return out("ret7d", true, ageHours, grossPct, ret7dPct);
  return out(null, true, ageHours, grossPct, ret7dPct);
}
