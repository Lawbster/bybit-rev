import { EMA } from "technicalindicators";
import type { Candle } from "../fetch-candles";

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const CLOSE_GRACE_MS = 10_000;

export interface DamagedRegimeLatchConfig {
  enabled: boolean;
  triggerEma200DistPct: number;
  taker15mMax: number;
  taker1hMax: number;
  releaseEma200DistPct: number;
  releaseBars: number;
  minTaker15mSamples: number;
  minTaker1hSamples: number;
  maxTakerAgeSec: number;
}

export interface DamagedRegimeLatchState {
  initialized: boolean;
  active: boolean;
  triggeredAt: number | null;
  trigger4hTimestamp: number | null;
  triggerDistPct: number | null;
  triggerTaker15m: number | null;
  triggerTaker1h: number | null;
  recoveryBars: number;
  last4hTimestamp: number | null;
  lastDistPct: number | null;
  triggerReason: string | null;
}

export const EMPTY_DAMAGED_REGIME_LATCH_STATE: DamagedRegimeLatchState = {
  initialized: false,
  active: false,
  triggeredAt: null,
  trigger4hTimestamp: null,
  triggerDistPct: null,
  triggerTaker15m: null,
  triggerTaker1h: null,
  recoveryBars: 0,
  last4hTimestamp: null,
  lastDistPct: null,
  triggerReason: null,
};

export interface DamagedRegimeStructure {
  lastTimestamp: number;
  lastClose: number;
  ema200: number;
  distPct: number;
  recentDistPct: number[];
}

export interface DamagedRegimePulse {
  taker15m: number | null;
  taker1h: number | null;
  taker15mSamples: number;
  taker1hSamples: number;
  takerAgeSec: number | null;
}

export interface DamagedRegimeLatchDecision {
  blocked: boolean;
  state: DamagedRegimeLatchState;
  stateChanged: boolean;
  transition: "none" | "initialized" | "triggered" | "released";
  reason: string;
  structure: DamagedRegimeStructure | null;
  pulseStatus: "not_needed" | "healthy" | "incomplete";
}

export function buildDamagedRegimeStructure(
  candles: Candle[],
  emaPeriod: number,
  releaseBars: number,
  nowMs: number = Date.now(),
): DamagedRegimeStructure | null {
  const completed = candles
    .filter(candle => candle.timestamp + FOUR_HOURS + CLOSE_GRACE_MS <= nowMs)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (completed.length < emaPeriod + Math.max(1, releaseBars) - 1) return null;

  const closes = completed.map(candle => candle.close);
  const ema = EMA.calculate({ period: emaPeriod, values: closes });
  const offset = emaPeriod - 1;
  const recentDistPct: number[] = [];
  const count = Math.max(1, releaseBars);
  for (let sourceIndex = completed.length - count; sourceIndex < completed.length; sourceIndex++) {
    const emaIndex = sourceIndex - offset;
    if (emaIndex < 0 || emaIndex >= ema.length) return null;
    recentDistPct.push(((closes[sourceIndex] - ema[emaIndex]) / ema[emaIndex]) * 100);
  }
  const last = completed[completed.length - 1];
  const ema200 = ema[ema.length - 1];
  return {
    lastTimestamp: last.timestamp,
    lastClose: last.close,
    ema200,
    distPct: ((last.close - ema200) / ema200) * 100,
    recentDistPct,
  };
}

function sameState(a: DamagedRegimeLatchState, b: DamagedRegimeLatchState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function evaluateDamagedRegimeLatch(args: {
  previous: DamagedRegimeLatchState;
  config: DamagedRegimeLatchConfig;
  structure: DamagedRegimeStructure | null;
  pulse: DamagedRegimePulse | null;
  nowMs: number;
}): DamagedRegimeLatchDecision {
  const { previous, config, structure, pulse, nowMs } = args;
  if (!config.enabled) {
    return {
      blocked: false,
      state: previous,
      stateChanged: false,
      transition: "none",
      reason: "damaged-regime latch disabled",
      structure,
      pulseStatus: "not_needed",
    };
  }

  if (previous.active) {
    if (!structure) {
      return {
        blocked: true,
        state: previous,
        stateChanged: false,
        transition: "none",
        reason: "DAMAGED REGIME LATCH: active; completed 4h structure unavailable, holding fail-closed",
        structure,
        pulseStatus: "not_needed",
      };
    }
    let recoveryBars = 0;
    for (let i = structure.recentDistPct.length - 1; i >= 0 && recoveryBars < config.releaseBars; i--) {
      if (structure.recentDistPct[i] <= config.releaseEma200DistPct) break;
      recoveryBars++;
    }
    if (recoveryBars >= config.releaseBars) {
      const next: DamagedRegimeLatchState = {
        ...EMPTY_DAMAGED_REGIME_LATCH_STATE,
        initialized: true,
        last4hTimestamp: structure.lastTimestamp,
        lastDistPct: structure.distPct,
      };
      return {
        blocked: false,
        state: next,
        stateChanged: !sameState(previous, next),
        transition: "released",
        reason: `damaged-regime latch released after ${config.releaseBars} completed 4h closes above ${config.releaseEma200DistPct.toFixed(2)}% EMA200 distance`,
        structure,
        pulseStatus: "not_needed",
      };
    }
    const next = {
      ...previous,
      recoveryBars,
      last4hTimestamp: structure.lastTimestamp,
      lastDistPct: structure.distPct,
    };
    return {
      blocked: true,
      state: next,
      stateChanged: !sameState(previous, next),
      transition: "none",
      reason: `DAMAGED REGIME LATCH: active; 4h close ${structure.distPct.toFixed(2)}% vs EMA200, recovery ${recoveryBars}/${config.releaseBars}`,
      structure,
      pulseStatus: "not_needed",
    };
  }

  if (!structure) {
    return {
      blocked: false,
      state: previous,
      stateChanged: false,
      transition: "none",
      reason: "damaged-regime latch waiting for completed 4h EMA structure",
      structure,
      pulseStatus: "not_needed",
    };
  }

  // Migration/fresh-state rule: if this code first starts after the market is
  // already beyond the proven damage threshold, arm fail-closed. Otherwise a
  // deploy/restart could forget a trigger that occurred before the schema
  // existed. All subsequent triggers require healthy causal HL evidence.
  if (!previous.initialized) {
    if (structure.distPct <= config.triggerEma200DistPct) {
      const next: DamagedRegimeLatchState = {
        initialized: true,
        active: true,
        triggeredAt: nowMs,
        trigger4hTimestamp: structure.lastTimestamp,
        triggerDistPct: structure.distPct,
        triggerTaker15m: pulse?.taker15m ?? null,
        triggerTaker1h: pulse?.taker1h ?? null,
        recoveryBars: 0,
        last4hTimestamp: structure.lastTimestamp,
        lastDistPct: structure.distPct,
        triggerReason: "bootstrap_deep_structure",
      };
      return {
        blocked: true,
        state: next,
        stateChanged: true,
        transition: "triggered",
        reason: `DAMAGED REGIME LATCH: bootstrap armed at ${structure.distPct.toFixed(2)}% vs EMA200`,
        structure,
        pulseStatus: "not_needed",
      };
    }
    const next = {
      ...previous,
      initialized: true,
      last4hTimestamp: structure.lastTimestamp,
      lastDistPct: structure.distPct,
    };
    return {
      blocked: false,
      state: next,
      stateChanged: !sameState(previous, next),
      transition: "initialized",
      reason: "damaged-regime latch initialized outside trigger region",
      structure,
      pulseStatus: "not_needed",
    };
  }

  if (structure.distPct > config.triggerEma200DistPct) {
    return {
      blocked: false,
      state: previous,
      stateChanged: false,
      transition: "none",
      reason: `damaged-regime structure OK: ${structure.distPct.toFixed(2)}% vs EMA200`,
      structure,
      pulseStatus: "not_needed",
    };
  }

  const ageHealthy = pulse?.takerAgeSec !== null && pulse?.takerAgeSec !== undefined
    && pulse.takerAgeSec >= 0 && pulse.takerAgeSec <= config.maxTakerAgeSec;
  const healthy15 = !!pulse && ageHealthy && pulse.taker15m !== null
    && pulse.taker15mSamples >= config.minTaker15mSamples;
  const healthy1h = !!pulse && ageHealthy && pulse.taker1h !== null
    && pulse.taker1hSamples >= config.minTaker1hSamples;
  if (!healthy15 && !healthy1h) {
    return {
      blocked: false,
      state: previous,
      stateChanged: false,
      transition: "none",
      reason: "damaged-regime structure breached but HL taker evidence is incomplete; existing outer gates remain authoritative",
      structure,
      pulseStatus: "incomplete",
    };
  }

  const stress15 = healthy15 && (pulse!.taker15m as number) <= config.taker15mMax;
  const stress1h = healthy1h && (pulse!.taker1h as number) <= config.taker1hMax;
  if (!stress15 && !stress1h) {
    return {
      blocked: false,
      state: previous,
      stateChanged: false,
      transition: "none",
      reason: "damaged-regime structure breached but healthy HL taker flow has not triggered the latch",
      structure,
      pulseStatus: "healthy",
    };
  }

  const next: DamagedRegimeLatchState = {
    initialized: true,
    active: true,
    triggeredAt: nowMs,
    trigger4hTimestamp: structure.lastTimestamp,
    triggerDistPct: structure.distPct,
    triggerTaker15m: pulse!.taker15m,
    triggerTaker1h: pulse!.taker1h,
    recoveryBars: 0,
    last4hTimestamp: structure.lastTimestamp,
    lastDistPct: structure.distPct,
    triggerReason: stress15 && stress1h ? "hl_taker_15m_and_1h" : stress15 ? "hl_taker_15m" : "hl_taker_1h",
  };
  return {
    blocked: true,
    state: next,
    stateChanged: true,
    transition: "triggered",
    reason: `DAMAGED REGIME LATCH: ${structure.distPct.toFixed(2)}% vs EMA200 with HL taker15=${pulse!.taker15m?.toFixed(3) ?? "NA"} taker1h=${pulse!.taker1h?.toFixed(3) ?? "NA"}`,
    structure,
    pulseStatus: "healthy",
  };
}
