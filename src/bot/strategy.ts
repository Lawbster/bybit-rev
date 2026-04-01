import { EMA, ATR } from "technicalindicators";
import { Candle } from "../fetch-candles";
import { BotConfig } from "./bot-config";
import { LadderPosition } from "./state";

// ─────────────────────────────────────────────
// Pure strategy logic — no side effects
// All decisions are deterministic given inputs
// ─────────────────────────────────────────────

export interface StrategyDecision {
  action: "open" | "close_batch" | "hold" | "blocked";
  reason: string;
  // For "open":
  positionSize?: number;   // USDT notional
  level?: number;          // ladder level
  // For "close_batch":
  exitPrice?: number;      // batch TP price
}

export interface MarketSnapshot {
  symbol: string;
  price: number;           // current mark/last price
  high: number;            // current candle high (for TP check)
  low: number;             // current candle low
  timestamp: number;       // ms
}

// ─────────────────────────────────────────────
// Batch TP check
// ─────────────────────────────────────────────
export function checkBatchTp(
  positions: LadderPosition[],
  tpPct: number,
  currentHigh: number,
): { hit: boolean; tpPrice: number; avgEntry: number } {
  if (positions.length === 0) {
    return { hit: false, tpPrice: 0, avgEntry: 0 };
  }

  const totalQty = positions.reduce((s, p) => s + p.qty, 0);
  const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
  const tpPrice = avgEntry * (1 + tpPct / 100);

  return {
    hit: currentHigh >= tpPrice,
    tpPrice,
    avgEntry,
  };
}

// ─────────────────────────────────────────────
// DCA add sizing
// ─────────────────────────────────────────────
export function calcAddSize(
  currentLevel: number,
  basePositionUsdt: number,
  addScaleFactor: number,
): number {
  return basePositionUsdt * Math.pow(addScaleFactor, currentLevel);
}

// ─────────────────────────────────────────────
// Margin check — can we afford to open?
// ─────────────────────────────────────────────
export function canAffordAdd(
  positions: LadderPosition[],
  newNotional: number,
  leverage: number,
  capital: number,
): boolean {
  const usedMargin = positions.reduce((s, p) => s + p.notional / leverage, 0);
  const marginNeeded = newNotional / leverage;
  return (capital - usedMargin) >= marginNeeded && capital > 0;
}

// ─────────────────────────────────────────────
// Trend-break filter (4h EMA200 + EMA50 slope)
// Uses LAST COMPLETED 4h candle only
// ─────────────────────────────────────────────
export interface TrendGateResult {
  blocked: boolean;
  reason: string;
  ema200: number;
  ema50: number;
  ema50Prev: number;
  lastClose: number;
  lastTimestamp: number;
}

/**
 * Drop the newest candle if it is still forming (incomplete).
 * A candle is incomplete if its timestamp + period + grace > now.
 * Grace buffer (10s) handles clock drift and late API publishing.
 */
const CANDLE_GRACE_MS = 10_000;

export function dropIncompleteCandle(candles: Candle[], periodMs: number): Candle[] {
  if (candles.length === 0) return candles;
  const newest = candles[candles.length - 1];
  if (newest.timestamp + periodMs + CANDLE_GRACE_MS > Date.now()) {
    return candles.slice(0, -1);
  }
  return candles;
}

export function checkTrendGate(
  hype4hCandles: Candle[],
  config: BotConfig,
): TrendGateResult {
  const noBlock: TrendGateResult = {
    blocked: false, reason: "trend OK",
    ema200: 0, ema50: 0, ema50Prev: 0, lastClose: 0, lastTimestamp: 0,
  };

  if (!config.filters.trendBreak) return noBlock;

  // Drop the current partial 4h candle — only use completed bars
  const completed = dropIncompleteCandle(hype4hCandles, 4 * 60 * 60 * 1000);

  const closes = completed.map(c => c.close);
  if (closes.length < config.filters.trendEmaLong + 1) {
    return { ...noBlock, reason: "insufficient 4h data for EMA200" };
  }

  const emaLong = EMA.calculate({ period: config.filters.trendEmaLong, values: closes });
  const emaShort = EMA.calculate({ period: config.filters.trendEmaShort, values: closes });

  // Last index is now guaranteed to be a completed candle
  const lastIdx = closes.length - 1;
  const longOffset = config.filters.trendEmaLong - 1;
  const shortOffset = config.filters.trendEmaShort - 1;

  const ema200Val = emaLong[lastIdx - longOffset];
  const ema50Val = emaShort[lastIdx - shortOffset];
  const ema50Prev = lastIdx - shortOffset >= 1 ? emaShort[lastIdx - shortOffset - 1] : ema50Val;
  const lastClose = closes[lastIdx];
  const lastTs = completed[lastIdx].timestamp;

  const belowEma200 = lastClose < ema200Val;
  const ema50SlopeNeg = ema50Val < ema50Prev;

  const blocked = belowEma200 && ema50SlopeNeg;
  const reason = blocked
    ? `trend-break: close $${lastClose.toFixed(2)} < EMA200 $${ema200Val.toFixed(2)}, EMA50 slope negative`
    : `trend OK: close $${lastClose.toFixed(2)} vs EMA200 $${ema200Val.toFixed(2)}`;

  return {
    blocked,
    reason,
    ema200: ema200Val,
    ema50: ema50Val,
    ema50Prev,
    lastClose,
    lastTimestamp: lastTs,
  };
}

// ─────────────────────────────────────────────
// Market risk-off filter (BTC 1h crash)
// ─────────────────────────────────────────────
export function checkMarketRiskOff(
  btc1hCandles: Candle[],
  config: BotConfig,
  currentTime: number,
  currentRiskOffUntil: number,
): { blocked: boolean; riskOffUntil: number; reason: string } {
  if (!config.filters.marketRiskOff) {
    return { blocked: false, riskOffUntil: 0, reason: "market risk-off disabled" };
  }

  // Still in cooldown?
  if (currentTime < currentRiskOffUntil) {
    return {
      blocked: true,
      riskOffUntil: currentRiskOffUntil,
      reason: `market risk-off cooldown until ${new Date(currentRiskOffUntil).toISOString().slice(11, 16)}`,
    };
  }

  // Drop the current partial 1h candle
  const completed = dropIncompleteCandle(btc1hCandles, 60 * 60 * 1000);

  if (completed.length < 2) {
    return { blocked: false, riskOffUntil: 0, reason: "insufficient BTC 1h data" };
  }

  // Last two completed 1h candles for return calculation
  const candle = completed[completed.length - 1];
  const prevCandle = completed[completed.length - 2];

  const ret = ((candle.close - prevCandle.close) / prevCandle.close) * 100;

  if (ret < config.filters.btcDropPct) {
    const cooldownMs = config.filters.riskOffCooldownMin * 60000;
    const until = currentTime + cooldownMs;
    return {
      blocked: true,
      riskOffUntil: until,
      reason: `BTC 1h return ${ret.toFixed(2)}% < ${config.filters.btcDropPct}%, risk-off for ${config.filters.riskOffCooldownMin}m`,
    };
  }

  return { blocked: false, riskOffUntil: 0, reason: "BTC 1h OK" };
}

// ─────────────────────────────────────────────
// Ladder-local kill (emergency brake)
// ─────────────────────────────────────────────
export function checkLadderKill(
  positions: LadderPosition[],
  currentPrice: number,
  currentTime: number,
  config: BotConfig,
): { blocked: boolean; reason: string } {
  if (!config.filters.ladderLocalKill || positions.length === 0) {
    return { blocked: false, reason: "ladder-local disabled or empty" };
  }

  const oldestEntry = Math.min(...positions.map(p => p.entryTime));
  const hoursUnderwater = (currentTime - oldestEntry) / 3600000;

  const totalQty = positions.reduce((s, p) => s + p.qty, 0);
  const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
  const avgPnlPct = ((currentPrice - avgEntry) / avgEntry) * 100;

  const blocked = hoursUnderwater >= config.filters.maxUnderwaterHours &&
                  avgPnlPct <= config.filters.maxUnderwaterPct;

  const reason = blocked
    ? `ladder-kill: ${hoursUnderwater.toFixed(1)}h underwater, avg PnL ${avgPnlPct.toFixed(2)}%`
    : `ladder OK: ${hoursUnderwater.toFixed(1)}h, avg PnL ${avgPnlPct.toFixed(2)}%`;

  return { blocked, reason };
}

// ─────────────────────────────────────────────
// Vol expansion shadow signal (logged, not enforced v1)
// ─────────────────────────────────────────────
export function checkVolExpansion(
  hype1hCandles: Candle[],
  config: BotConfig,
): { triggered: boolean; atrPct: number; medianAtrPct: number; reason: string } {
  const noTrigger = { triggered: false, atrPct: 0, medianAtrPct: 0, reason: "vol OK" };

  // Drop the current partial 1h candle
  const completed = dropIncompleteCandle(hype1hCandles, 60 * 60 * 1000);

  if (completed.length < 15) return { ...noTrigger, reason: "insufficient 1h data" };

  const highs = completed.map(c => c.high);
  const lows = completed.map(c => c.low);
  const closes = completed.map(c => c.close);

  const atr14 = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
  if (atr14.length === 0) return { ...noTrigger, reason: "ATR calc failed" };

  const lastAtr = atr14[atr14.length - 1];
  const lastClose = closes[closes.length - 1];
  const atrPct = (lastAtr / lastClose) * 100;

  // 30-day median (720 1h candles)
  const lookback = Math.min(720, atr14.length);
  const window = atr14.slice(-lookback).map((a, i) => {
    const idx = closes.length - lookback + i;
    return (a / closes[idx]) * 100;
  });
  window.sort((a, b) => a - b);
  const medianAtrPct = window[Math.floor(window.length / 2)];

  const triggered = atrPct > medianAtrPct * config.filters.atrMultiplier;
  const reason = triggered
    ? `VOL EXPANDED: ATR% ${atrPct.toFixed(3)} > ${config.filters.atrMultiplier}× median ${medianAtrPct.toFixed(3)}`
    : `vol normal: ATR% ${atrPct.toFixed(3)} vs ${config.filters.atrMultiplier}× median ${medianAtrPct.toFixed(3)}`;

  return { triggered, atrPct, medianAtrPct, reason };
}

// ─────────────────────────────────────────────
// Exit stack — Codex v1 recommendations
// ─────────────────────────────────────────────

export interface ExitDecision {
  action: "hold" | "flatten" | "reduce_tp";
  reason: string;
  reducedTpPct?: number;   // only for reduce_tp
  avgPnlPct?: number;
  oldestHours?: number;
}

/** Emergency kill: flatten if avg ladder PnL breaches threshold */
export function checkEmergencyKill(
  positions: LadderPosition[],
  currentPrice: number,
  config: BotConfig,
): ExitDecision {
  if (!config.exits.emergencyKill || positions.length === 0) {
    return { action: "hold", reason: "emergency kill disabled or empty" };
  }

  const totalQty = positions.reduce((s, p) => s + p.qty, 0);
  const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
  const avgPnlPct = ((currentPrice - avgEntry) / avgEntry) * 100;

  if (avgPnlPct <= config.exits.emergencyKillPct) {
    return {
      action: "flatten",
      reason: `EMERGENCY KILL: avg PnL ${avgPnlPct.toFixed(2)}% <= ${config.exits.emergencyKillPct}%`,
      avgPnlPct,
    };
  }

  return { action: "hold", reason: `emergency OK: avg PnL ${avgPnlPct.toFixed(2)}%`, avgPnlPct };
}

/** Hard flatten: close if ladder is old + underwater + trend hostile */
export function checkHardFlatten(
  positions: LadderPosition[],
  currentPrice: number,
  currentTime: number,
  trendHostile: boolean,
  config: BotConfig,
): ExitDecision {
  if (!config.exits.hardFlatten || positions.length === 0) {
    return { action: "hold", reason: "hard flatten disabled or empty" };
  }

  const oldestEntry = Math.min(...positions.map(p => p.entryTime));
  const oldestHours = (currentTime - oldestEntry) / 3600000;

  const totalQty = positions.reduce((s, p) => s + p.qty, 0);
  const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
  const avgPnlPct = ((currentPrice - avgEntry) / avgEntry) * 100;

  const shouldFlatten = oldestHours >= config.exits.hardFlattenHours &&
                        avgPnlPct <= config.exits.hardFlattenPct &&
                        trendHostile;

  if (shouldFlatten) {
    return {
      action: "flatten",
      reason: `HARD FLATTEN: ${oldestHours.toFixed(1)}h old, avg PnL ${avgPnlPct.toFixed(2)}% <= ${config.exits.hardFlattenPct}%, trend hostile`,
      avgPnlPct,
      oldestHours,
    };
  }

  return { action: "hold", reason: `hard flatten OK: ${oldestHours.toFixed(1)}h, avg PnL ${avgPnlPct.toFixed(2)}%`, avgPnlPct, oldestHours };
}

/** Soft stale: reduce TP target when ladder is old and underwater */
export function checkSoftStale(
  positions: LadderPosition[],
  currentPrice: number,
  currentTime: number,
  config: BotConfig,
): ExitDecision {
  if (!config.exits.softStale || positions.length === 0) {
    return { action: "hold", reason: "soft stale disabled or empty" };
  }

  const oldestEntry = Math.min(...positions.map(p => p.entryTime));
  const oldestHours = (currentTime - oldestEntry) / 3600000;

  const totalQty = positions.reduce((s, p) => s + p.qty, 0);
  const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
  const avgPnlPct = ((currentPrice - avgEntry) / avgEntry) * 100;

  if (oldestHours >= config.exits.staleHours && avgPnlPct < 0) {
    return {
      action: "reduce_tp",
      reason: `SOFT STALE: ${oldestHours.toFixed(1)}h old, avg PnL ${avgPnlPct.toFixed(2)}%, TP reduced to ${config.exits.reducedTpPct}%`,
      reducedTpPct: config.exits.reducedTpPct,
      avgPnlPct,
      oldestHours,
    };
  }

  return { action: "hold", reason: `stale OK: ${oldestHours.toFixed(1)}h, avg PnL ${avgPnlPct.toFixed(2)}%`, avgPnlPct, oldestHours };
}

// ─────────────────────────────────────────────
// Equity / drawdown check
// ─────────────────────────────────────────────
export function calcEquity(
  positions: LadderPosition[],
  currentPrice: number,
  capital: number,
): { equity: number; unrealizedPnl: number; drawdownPct: number } {
  const unrealizedPnl = positions.reduce(
    (s, p) => s + (currentPrice - p.entryPrice) * p.qty, 0,
  );
  const equity = capital + unrealizedPnl;
  return { equity, unrealizedPnl, drawdownPct: 0 }; // drawdown computed relative to peak in main loop
}
