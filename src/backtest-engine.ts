import { EMA } from "technicalindicators";
import * as ss from "simple-statistics";
import { Candle } from "./fetch-candles";
import { computeIndicators, getSnapshotAt, IndicatorSnapshot } from "./indicators";

// --- Unified bar snapshot (candle-mode + WS-mode) ---

export interface BarSnapshot {
  ts: number;
  price: number;
  high: number;
  low: number;
  // Indicators
  rsi: number;
  stochK: number;
  stochD: number;
  bbPos: number;
  bbWidth: number;
  atrPct: number;
  atr: number;
  volRatio: number;
  emaTrend: "bull" | "bear" | "neutral";
  roc5: number;
  roc20: number;
  macdHist: number;
  priceVsEma50: number;
  // WS-only (undefined in candle mode)
  obImbalance?: number;
  obBidDepth?: number;
  obAskDepth?: number;
  obSpread?: number;
  obBidWall?: number;
  obAskWall?: number;
  obThinSide?: string;
  flowBuyVol?: number;
  flowSellVol?: number;
  flowBuyCount?: number;
  flowSellCount?: number;
  flowBuyRatio?: number;
  fundingRate?: number;
  openInterest?: number;
  // Higher timeframe trends
  htfTrend15m?: "bull" | "bear" | "neutral";
  htfTrend1h?: "bull" | "bear" | "neutral";
  htfTrend4h?: "bull" | "bear" | "neutral";
}

// --- Condition-based strategy builder ---

export type Comparator = "<" | ">" | "<=" | ">=" | "==" | "!=";

export interface Condition {
  field: keyof BarSnapshot;
  op: Comparator;
  value: number | string;
}

export interface ExitConfig {
  slAtr: number;
  tpAtr: number;
  trailingActivateAtr?: number;
  trailingDistAtr?: number;
  maxHoldBars?: number;
}

export interface StrategyDef {
  name: string;
  longConditions: Condition[];
  shortConditions: Condition[];
  minLongScore: number;
  minShortScore: number;
  exit: ExitConfig;
}

function evaluateCondition(bar: BarSnapshot, cond: Condition): boolean {
  const val = bar[cond.field];
  if (val === undefined || val === null) return false;
  switch (cond.op) {
    case "<": return val < cond.value;
    case ">": return val > cond.value;
    case "<=": return val <= cond.value;
    case ">=": return val >= cond.value;
    case "==": return val === cond.value;
    case "!=": return val !== cond.value;
    default: return false;
  }
}

export function evaluateSignal(
  bar: BarSnapshot,
  conditions: Condition[],
  minScore: number,
): boolean {
  let score = 0;
  for (const c of conditions) {
    if (evaluateCondition(bar, c)) score++;
  }
  return score >= minScore;
}

// --- Strategy template for parameter sweeps ---

export interface ParamRange {
  field: keyof BarSnapshot;
  op: Comparator;
  values: (number | string)[];
}

export interface StrategyTemplate {
  name: string;
  longRanges: ParamRange[];
  shortRanges: ParamRange[];
  minScoreRange: number[];
  exitRange: ExitConfig[];
}

export function generateCombos(template: StrategyTemplate): StrategyDef[] {
  const results: StrategyDef[] = [];

  // Generate condition combinations for one side
  function condCombos(ranges: ParamRange[]): Condition[][] {
    if (ranges.length === 0) return [[]];
    const combos: Condition[][] = [[]];
    // Each range produces one condition with varying values
    // We want all value combinations across ranges
    let current: Condition[][] = [[]];
    for (const range of ranges) {
      const next: Condition[][] = [];
      for (const existing of current) {
        for (const val of range.values) {
          next.push([...existing, { field: range.field, op: range.op, value: val }]);
        }
      }
      current = next;
    }
    return current;
  }

  const longCombos = condCombos(template.longRanges);
  const shortCombos = condCombos(template.shortRanges);

  let count = 0;
  for (const lc of longCombos) {
    for (const sc of shortCombos) {
      for (const minScore of template.minScoreRange) {
        for (const exit of template.exitRange) {
          if (count >= 2000) return results; // cap
          results.push({
            name: `${template.name}`,
            longConditions: lc,
            shortConditions: sc,
            minLongScore: minScore,
            minShortScore: minScore,
            exit,
          });
          count++;
        }
      }
    }
  }
  return results;
}

// --- Multi-timeframe aggregation ---

export function aggregateCandles(candles5m: Candle[], targetMinutes: number): Candle[] {
  const targetMs = targetMinutes * 60000;
  const groups = new Map<number, Candle[]>();

  for (const c of candles5m) {
    const bucket = Math.floor(c.timestamp / targetMs) * targetMs;
    const arr = groups.get(bucket) || [];
    arr.push(c);
    groups.set(bucket, arr);
  }

  const result: Candle[] = [];
  for (const [bucket, cds] of groups) {
    result.push({
      timestamp: bucket,
      open: cds[0].open,
      high: Math.max(...cds.map((c) => c.high)),
      low: Math.min(...cds.map((c) => c.low)),
      close: cds[cds.length - 1].close,
      volume: cds.reduce((s, c) => s + c.volume, 0),
      turnover: cds.reduce((s, c) => s + c.turnover, 0),
    });
  }
  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

function computeHTFTrends(candles: Candle[]): Map<number, "bull" | "bear" | "neutral"> {
  const closes = candles.map((c) => c.close);
  if (closes.length < 21) return new Map();

  const ema9 = EMA.calculate({ period: 9, values: closes });
  const ema21 = EMA.calculate({ period: 21, values: closes });
  const offset = closes.length - ema21.length;
  const e9Offset = closes.length - ema9.length;

  const map = new Map<number, "bull" | "bear" | "neutral">();
  for (let i = 0; i < ema21.length; i++) {
    const e9Idx = i - (offset - e9Offset);
    if (e9Idx < 0 || e9Idx >= ema9.length) continue;
    const trend = ema9[e9Idx] > ema21[i] ? "bull" : ema9[e9Idx] < ema21[i] ? "bear" : "neutral";
    map.set(candles[i + offset].timestamp, trend);
  }
  return map;
}

// Stamp HTF trends onto 5m bars by looking up the containing bucket
function lookupHTF(ts: number, htfMap: Map<number, "bull" | "bear" | "neutral">, bucketMs: number): "bull" | "bear" | "neutral" | undefined {
  const bucket = Math.floor(ts / bucketMs) * bucketMs;
  return htfMap.get(bucket);
}

// --- Data converters ---

export function candlesToBars(candles: Candle[], indicators: Map<number, IndicatorSnapshot>): BarSnapshot[] {
  // Compute HTF trends
  const candles15m = aggregateCandles(candles, 15);
  const candles1h = aggregateCandles(candles, 60);
  const candles4h = aggregateCandles(candles, 240);
  const htf15m = computeHTFTrends(candles15m);
  const htf1h = computeHTFTrends(candles1h);
  const htf4h = computeHTFTrends(candles4h);

  const bars: BarSnapshot[] = [];
  for (const c of candles) {
    const snap = indicators.get(c.timestamp);
    if (!snap) continue;
    bars.push({
      ts: c.timestamp,
      price: c.close,
      high: c.high,
      low: c.low,
      rsi: snap.rsi14,
      stochK: snap.stochK,
      stochD: snap.stochD,
      bbPos: snap.bbPosition,
      bbWidth: snap.bbWidth,
      atrPct: snap.atrPercent,
      atr: snap.atr14,
      volRatio: snap.volumeRatio,
      emaTrend: snap.emaTrend,
      roc5: snap.roc5,
      roc20: snap.roc20,
      macdHist: snap.macdHist,
      priceVsEma50: snap.priceVsEma50,
      htfTrend15m: lookupHTF(c.timestamp, htf15m, 15 * 60000),
      htfTrend1h: lookupHTF(c.timestamp, htf1h, 60 * 60000),
      htfTrend4h: lookupHTF(c.timestamp, htf4h, 240 * 60000),
    });
  }
  return bars;
}

export function jsonlToBars(lines: string[]): BarSnapshot[] {
  const bars: BarSnapshot[] = [];
  for (const line of lines) {
    const d = JSON.parse(line);
    if (d.event !== "periodic" || !d.price || !d.ind) continue;
    const i = d.ind;
    const ob = d.ob || {};
    const fl = d.flow || {};
    const totalFlow = (fl.buyVol || 0) + (fl.sellVol || 0);

    bars.push({
      ts: new Date(d.ts).getTime(),
      price: d.price,
      high: d.price,  // no candle high/low in WS mode
      low: d.price,
      rsi: i.rsi,
      stochK: i.stochK,
      stochD: i.stochD,
      bbPos: i.bbPos,
      bbWidth: i.bbWidth,
      atrPct: i.atrPct,
      atr: d.price * (i.atrPct / 100), // derive from pct
      volRatio: i.volRatio,
      emaTrend: i.emaTrend,
      roc5: i.roc5,
      roc20: i.roc20,
      macdHist: i.macdHist,
      priceVsEma50: i.priceVsEma50,
      obImbalance: ob.imbalance,
      obBidDepth: ob.bidDepth,
      obAskDepth: ob.askDepth,
      obSpread: ob.spread,
      obBidWall: ob.bidWall,
      obAskWall: ob.askWall,
      obThinSide: ob.thinSide,
      flowBuyVol: fl.buyVol,
      flowSellVol: fl.sellVol,
      flowBuyCount: fl.buyCount,
      flowSellCount: fl.sellCount,
      flowBuyRatio: totalFlow > 0 ? (fl.buyVol || 0) / totalFlow : undefined,
      fundingRate: d.fundingRate,
      openInterest: d.openInterest,
    });
  }
  return bars;
}

// --- Pre-computed condition cache for batch runs ---

export interface PrecomputedConditions {
  /** condResults[condKey] = Uint8Array where 1 = condition true at bar index */
  results: Map<string, Uint8Array>;
  barCount: number;
}

function condKey(c: Condition): string {
  return `${String(c.field)}|${c.op}|${c.value}`;
}

export function precomputeConditions(bars: BarSnapshot[], strategies: StrategyDef[]): PrecomputedConditions {
  // Collect all unique conditions
  const unique = new Map<string, Condition>();
  for (const s of strategies) {
    for (const c of [...s.longConditions, ...s.shortConditions]) {
      const key = condKey(c);
      if (!unique.has(key)) unique.set(key, c);
    }
  }

  // Pre-compute each condition across all bars
  const results = new Map<string, Uint8Array>();
  for (const [key, cond] of unique) {
    const arr = new Uint8Array(bars.length);
    for (let i = 0; i < bars.length; i++) {
      arr[i] = evaluateCondition(bars[i], cond) ? 1 : 0;
    }
    results.set(key, arr);
  }

  return { results, barCount: bars.length };
}

/** Resolve condition keys to direct array refs (avoids Map.get per bar) */
function resolveArrays(keys: string[], cache: PrecomputedConditions): Uint8Array[] {
  return keys.map((k) => cache.results.get(k)!);
}

function evalSignalDirect(barIdx: number, arrays: Uint8Array[], minScore: number): boolean {
  let score = 0;
  for (let j = 0; j < arrays.length; j++) {
    if (arrays[j][barIdx]) score++;
  }
  return score >= minScore;
}

/** Quick check using direct array refs */
function hasAnySignalDirect(
  longArrs: Uint8Array[], shortArrs: Uint8Array[],
  barCount: number, minLong: number, minShort: number,
): boolean {
  for (let i = 0; i < barCount; i++) {
    let ls = 0;
    for (let j = 0; j < longArrs.length; j++) { if (longArrs[j][i]) ls++; }
    if (ls >= minLong) return true;
    let ss = 0;
    for (let j = 0; j < shortArrs.length; j++) { if (shortArrs[j][i]) ss++; }
    if (ss >= minShort) return true;
  }
  return false;
}

const EMPTY_RESULT: EngineResult = {
  strategyName: "", params: "", trades: [], totalTrades: 0, wins: 0, losses: 0,
  winRate: 0, totalPnl: 0, avgPnl: 0, avgWin: 0, avgLoss: 0, profitFactor: 0,
  maxDD: 0, maxDDPct: 0, sharpe: 0, sortino: 0, calmar: 0, var95: 0,
  consistency: 0, composite: 0, avgHoldBars: 0, equity: [],
};

/** Run engine using pre-computed condition results — much faster for batch runs */
export function runEngineFast(
  bars: BarSnapshot[],
  strategy: StrategyDef,
  cache: PrecomputedConditions,
  opts: Partial<EngineOpts> = {},
): EngineResult {
  const o = { ...DEFAULT_ENGINE_OPTS, ...opts };
  const ex = strategy.exit;

  // Resolve condition keys to direct array refs (no Map.get per bar)
  const longArrs = resolveArrays(strategy.longConditions.map(condKey), cache);
  const shortArrs = resolveArrays(strategy.shortConditions.map(condKey), cache);

  // Early exit: if no bar triggers any signal, skip entire engine run
  if (!hasAnySignalDirect(longArrs, shortArrs, cache.barCount, strategy.minLongScore, strategy.minShortScore)) {
    return { ...EMPTY_RESULT, strategyName: strategy.name };
  }

  let balance = o.startBalance;
  let peak = balance;
  let maxDD = 0;
  let maxDDPct = 0;
  const closed: ClosedTrade[] = [];

  const paramsStr = `L:${strategy.minLongScore}/${strategy.longConditions.length} S:${strategy.minShortScore}/${strategy.shortConditions.length} SL:${ex.slAtr} TP:${ex.tpAtr}${ex.trailingActivateAtr ? ` TR:${ex.trailingActivateAtr}` : ""}${ex.maxHoldBars ? ` MH:${ex.maxHoldBars}` : ""}`;

  // Position state as flat vars (avoid object allocation per bar)
  let posActive = false;
  let posSideLong = true;
  let posEntryPrice = 0;
  let posEntryIdx = 0;
  let posQty = 0;
  let posSL = 0;
  let posTP = 0;
  let posTrailingStop = 0;
  let posTrailingActive = false;
  let posHasTrailing = false;

  const hasTrailingConfig = !!(ex.trailingActivateAtr && ex.trailingDistAtr);
  const hasMaxHold = !!ex.maxHoldBars;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];

    if (posActive) {
      let exitPrice = 0;
      let exitReason: ClosedTrade["exitReason"] = "sl";

      // Time-based exit
      if (hasMaxHold && (i - posEntryIdx) >= ex.maxHoldBars!) {
        exitPrice = bar.price;
        exitReason = "time";
      }

      // SL/TP
      if (!exitPrice) {
        if (posSideLong) {
          if (bar.low <= posSL) { exitPrice = posSL; exitReason = "sl"; }
          else if (bar.high >= posTP) { exitPrice = posTP; exitReason = "tp"; }
        } else {
          if (bar.high >= posSL) { exitPrice = posSL; exitReason = "sl"; }
          else if (bar.low <= posTP) { exitPrice = posTP; exitReason = "tp"; }
        }
      }

      // Trailing stop
      if (!exitPrice && hasTrailingConfig) {
        const activationDist = bar.atr * ex.trailingActivateAtr!;
        const trailDist = bar.atr * ex.trailingDistAtr!;
        if (posSideLong) {
          if (bar.high >= posEntryPrice + activationDist) posTrailingActive = true;
          if (posTrailingActive) {
            const newTrail = bar.high - trailDist;
            if (!posHasTrailing || newTrail > posTrailingStop) { posTrailingStop = newTrail; posHasTrailing = true; }
            if (bar.low <= posTrailingStop) { exitPrice = posTrailingStop; exitReason = "trailing"; }
          }
        } else {
          if (bar.low <= posEntryPrice - activationDist) posTrailingActive = true;
          if (posTrailingActive) {
            const newTrail = bar.low + trailDist;
            if (!posHasTrailing || newTrail < posTrailingStop) { posTrailingStop = newTrail; posHasTrailing = true; }
            if (bar.high >= posTrailingStop) { exitPrice = posTrailingStop; exitReason = "trailing"; }
          }
        }
      }

      // Signal-based exit
      if (!exitPrice) {
        if (posSideLong && evalSignalDirect(i, shortArrs, strategy.minShortScore)) {
          exitPrice = bar.price; exitReason = "signal";
        } else if (!posSideLong && evalSignalDirect(i, longArrs, strategy.minLongScore)) {
          exitPrice = bar.price; exitReason = "signal";
        }
      }

      if (exitPrice) {
        const gross = posSideLong
          ? (exitPrice - posEntryPrice) * posQty
          : (posEntryPrice - exitPrice) * posQty;
        const fee = posQty * exitPrice * o.feeRate;
        const netPnl = gross - fee;
        balance += netPnl;
        closed.push({
          side: posSideLong ? "Long" : "Short",
          entryPrice: posEntryPrice,
          exitPrice,
          entryTs: bars[posEntryIdx].ts,
          exitTs: bar.ts,
          pnl: netPnl,
          pnlPct: (gross / (posQty * posEntryPrice)) * 100 * o.leverage,
          holdBars: i - posEntryIdx,
          exitReason,
        });
        posActive = false;
      }
    }

    // Entry
    if (!posActive) {
      let sideLong: boolean | null = null;
      if (evalSignalDirect(i, longArrs, strategy.minLongScore)) sideLong = true;
      else if (evalSignalDirect(i, shortArrs, strategy.minShortScore)) sideLong = false;

      if (sideLong !== null && bar.atr > 0) {
        const slDist = bar.atr * ex.slAtr;
        const tpDist = bar.atr * ex.tpAtr;
        const riskAmt = balance * o.riskPerTrade;
        posQty = riskAmt / slDist;
        balance -= posQty * bar.price * o.feeRate;
        posActive = true;
        posSideLong = sideLong;
        posEntryPrice = bar.price;
        posEntryIdx = i;
        posSL = sideLong ? bar.price - slDist : bar.price + slDist;
        posTP = sideLong ? bar.price + tpDist : bar.price - tpDist;
        posTrailingStop = 0;
        posTrailingActive = false;
        posHasTrailing = false;
      }
    }

    // Equity tracking (lightweight — skip full array, just track DD)
    let unrealized = 0;
    if (posActive) {
      unrealized = posSideLong
        ? (bar.price - posEntryPrice) * posQty
        : (posEntryPrice - bar.price) * posQty;
    }
    const eq = balance + unrealized;
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
  }

  // Force close
  if (posActive) {
    const lastBar = bars[bars.length - 1];
    const gross = posSideLong
      ? (lastBar.price - posEntryPrice) * posQty
      : (posEntryPrice - lastBar.price) * posQty;
    const fee = posQty * lastBar.price * o.feeRate;
    const netPnl = gross - fee;
    balance += netPnl;
    closed.push({
      side: posSideLong ? "Long" : "Short",
      entryPrice: posEntryPrice,
      exitPrice: lastBar.price,
      entryTs: bars[posEntryIdx].ts,
      exitTs: lastBar.ts,
      pnl: netPnl,
      pnlPct: (gross / (posQty * posEntryPrice)) * 100 * o.leverage,
      holdBars: bars.length - 1 - posEntryIdx,
      exitReason: "eod",
    });
  }

  // Build minimal equity for metrics (just from trades, not per-bar)
  const equity: number[] = [o.startBalance];
  let runBal = o.startBalance;
  for (const t of closed) {
    runBal += t.pnl;
    equity.push(runBal);
  }

  const metrics = computeMetrics(closed, equity, o.startBalance);

  return {
    strategyName: strategy.name,
    params: paramsStr,
    trades: closed,
    ...metrics,
    equity,
  };
}

// --- Engine ---

export interface EngineOpts {
  startBalance: number;
  leverage: number;
  riskPerTrade: number;
  feeRate: number;
}

const DEFAULT_ENGINE_OPTS: EngineOpts = {
  startBalance: 5000,
  leverage: 5,
  riskPerTrade: 0.02,
  feeRate: 0.0011,
};

interface Position {
  side: "Long" | "Short";
  entryPrice: number;
  entryIdx: number;
  qty: number;
  stopLoss: number;
  takeProfit: number;
  trailingStop: number | null;
  trailingActivated: boolean;
}

export interface ClosedTrade {
  side: "Long" | "Short";
  entryPrice: number;
  exitPrice: number;
  entryTs: number;
  exitTs: number;
  pnl: number;
  pnlPct: number;
  holdBars: number;
  exitReason: "tp" | "sl" | "trailing" | "signal" | "time" | "eod";
}

export interface EngineResult {
  strategyName: string;
  params: string;
  trades: ClosedTrade[];
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDD: number;
  maxDDPct: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  var95: number;
  consistency: number;
  composite: number;
  avgHoldBars: number;
  equity: number[];
}

function closePosition(
  pos: Position,
  exitPrice: number,
  exitTs: number,
  barIdx: number,
  reason: ClosedTrade["exitReason"],
  feeRate: number,
  leverage: number,
): { trade: ClosedTrade; netPnl: number } {
  const gross = pos.side === "Long"
    ? (exitPrice - pos.entryPrice) * pos.qty
    : (pos.entryPrice - exitPrice) * pos.qty;
  const fee = pos.qty * exitPrice * feeRate;
  const netPnl = gross - fee;
  const pnlPct = (gross / (pos.qty * pos.entryPrice)) * 100 * leverage;

  return {
    trade: {
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice,
      entryTs: 0, // filled by caller
      exitTs,
      pnl: netPnl,
      pnlPct,
      holdBars: barIdx - pos.entryIdx,
      exitReason: reason,
    },
    netPnl,
  };
}

export function runEngine(
  bars: BarSnapshot[],
  strategy: StrategyDef,
  opts: Partial<EngineOpts> = {},
): EngineResult {
  const o = { ...DEFAULT_ENGINE_OPTS, ...opts };
  const ex = strategy.exit;
  let balance = o.startBalance;
  let peak = balance;
  let maxDD = 0;
  let maxDDPct = 0;
  const equity: number[] = [balance];
  const closed: ClosedTrade[] = [];
  let pos: Position | null = null;

  const paramsStr = `L:${strategy.minLongScore}/${strategy.longConditions.length} S:${strategy.minShortScore}/${strategy.shortConditions.length} SL:${ex.slAtr} TP:${ex.tpAtr}${ex.trailingActivateAtr ? ` TR:${ex.trailingActivateAtr}` : ""}${ex.maxHoldBars ? ` MH:${ex.maxHoldBars}` : ""}`;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];

    if (pos) {
      let exitPrice: number | null = null;
      let exitReason: ClosedTrade["exitReason"] = "sl";

      // Time-based exit
      if (ex.maxHoldBars && (i - pos.entryIdx) >= ex.maxHoldBars) {
        exitPrice = bar.price;
        exitReason = "time";
      }

      // SL/TP on high/low
      if (!exitPrice) {
        if (pos.side === "Long") {
          if (bar.low <= pos.stopLoss) { exitPrice = pos.stopLoss; exitReason = "sl"; }
          else if (bar.high >= pos.takeProfit) { exitPrice = pos.takeProfit; exitReason = "tp"; }
        } else {
          if (bar.high >= pos.stopLoss) { exitPrice = pos.stopLoss; exitReason = "sl"; }
          else if (bar.low <= pos.takeProfit) { exitPrice = pos.takeProfit; exitReason = "tp"; }
        }
      }

      // Trailing stop update
      if (!exitPrice && ex.trailingActivateAtr && ex.trailingDistAtr) {
        const activationDist = bar.atr * ex.trailingActivateAtr;
        const trailDist = bar.atr * ex.trailingDistAtr;

        if (pos.side === "Long") {
          if (bar.high >= pos.entryPrice + activationDist) pos.trailingActivated = true;
          if (pos.trailingActivated) {
            const newTrail = bar.high - trailDist;
            if (pos.trailingStop === null || newTrail > pos.trailingStop) pos.trailingStop = newTrail;
            if (bar.low <= pos.trailingStop) { exitPrice = pos.trailingStop; exitReason = "trailing"; }
          }
        } else {
          if (bar.low <= pos.entryPrice - activationDist) pos.trailingActivated = true;
          if (pos.trailingActivated) {
            const newTrail = bar.low + trailDist;
            if (pos.trailingStop === null || newTrail < pos.trailingStop) pos.trailingStop = newTrail;
            if (bar.high >= pos.trailingStop) { exitPrice = pos.trailingStop; exitReason = "trailing"; }
          }
        }
      }

      // Signal-based exit (opposing signal)
      if (!exitPrice) {
        if (pos.side === "Long" && evaluateSignal(bar, strategy.shortConditions, strategy.minShortScore)) {
          exitPrice = bar.price;
          exitReason = "signal";
        } else if (pos.side === "Short" && evaluateSignal(bar, strategy.longConditions, strategy.minLongScore)) {
          exitPrice = bar.price;
          exitReason = "signal";
        }
      }

      if (exitPrice) {
        const result = closePosition(pos, exitPrice, bar.ts, i, exitReason, o.feeRate, o.leverage);
        result.trade.entryTs = bars[pos.entryIdx].ts;
        balance += result.netPnl;
        closed.push(result.trade);
        pos = null;
      }
    }

    // Entry
    if (!pos) {
      let side: "Long" | "Short" | null = null;
      if (evaluateSignal(bar, strategy.longConditions, strategy.minLongScore)) side = "Long";
      else if (evaluateSignal(bar, strategy.shortConditions, strategy.minShortScore)) side = "Short";

      if (side && bar.atr > 0) {
        const slDist = bar.atr * ex.slAtr;
        const tpDist = bar.atr * ex.tpAtr;
        const riskAmt = balance * o.riskPerTrade;
        const qty = riskAmt / slDist;
        const fee = qty * bar.price * o.feeRate;
        balance -= fee;

        pos = {
          side,
          entryPrice: bar.price,
          entryIdx: i,
          qty,
          stopLoss: side === "Long" ? bar.price - slDist : bar.price + slDist,
          takeProfit: side === "Long" ? bar.price + tpDist : bar.price - tpDist,
          trailingStop: null,
          trailingActivated: false,
        };
      }
    }

    // Equity tracking
    let unrealized = 0;
    if (pos) {
      unrealized = pos.side === "Long"
        ? (bar.price - pos.entryPrice) * pos.qty
        : (pos.entryPrice - bar.price) * pos.qty;
    }
    const eq = balance + unrealized;
    equity.push(eq);
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
  }

  // Force close at end
  if (pos) {
    const lastBar = bars[bars.length - 1];
    const result = closePosition(pos, lastBar.price, lastBar.ts, bars.length - 1, "eod", o.feeRate, o.leverage);
    result.trade.entryTs = bars[pos.entryIdx].ts;
    balance += result.netPnl;
    closed.push(result.trade);
  }

  // Compute metrics
  const metrics = computeMetrics(closed, equity, o.startBalance);

  return {
    strategyName: strategy.name,
    params: paramsStr,
    trades: closed,
    ...metrics,
    equity,
  };
}

// --- Risk metrics ---

export interface RiskMetrics {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDD: number;
  maxDDPct: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  var95: number;
  consistency: number;
  composite: number;
  avgHoldBars: number;
}

export function computeMetrics(trades: ClosedTrade[], equity: number[], startBalance: number): RiskMetrics {
  if (trades.length === 0) {
    return {
      totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0,
      avgPnl: 0, avgWin: 0, avgLoss: 0, profitFactor: 0,
      maxDD: 0, maxDDPct: 0, sharpe: 0, sortino: 0, calmar: 0,
      var95: 0, consistency: 0, composite: 0, avgHoldBars: 0,
    };
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const returns = trades.map((t) => t.pnl);
  const avgRet = ss.mean(returns);
  const stdRet = returns.length > 1 ? ss.standardDeviation(returns) : 0;

  // Sortino (downside deviation)
  const negReturns = returns.filter((r) => r < 0);
  const downsideDev = negReturns.length > 1
    ? Math.sqrt(negReturns.reduce((s, r) => s + r * r, 0) / negReturns.length)
    : 0;

  // Sharpe & Sortino (annualized with sqrt(252))
  const sharpe = stdRet > 0 ? (avgRet / stdRet) * Math.sqrt(252) : 0;
  const sortino = downsideDev > 0 ? (avgRet / downsideDev) * Math.sqrt(252) : 0;

  // Max drawdown
  let peak = startBalance;
  let maxDD = 0;
  let maxDDPct = 0;
  for (const eq of equity) {
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
  }

  // Calmar (annualized return / max DD)
  const totalPnl = returns.reduce((a, b) => a + b, 0);
  const calmar = maxDD > 0 ? totalPnl / maxDD : 0;

  // VaR 95 (5th percentile)
  const sorted = [...returns].sort((a, b) => a - b);
  const var95 = sorted[Math.max(0, Math.floor(sorted.length * 0.05))];

  // Consistency: fraction of rolling 10-trade windows that are profitable
  let profitableWindows = 0;
  let totalWindows = 0;
  const windowSize = Math.min(10, Math.floor(trades.length / 2));
  if (windowSize >= 3) {
    for (let i = 0; i <= trades.length - windowSize; i++) {
      const windowPnl = trades.slice(i, i + windowSize).reduce((s, t) => s + t.pnl, 0);
      if (windowPnl > 0) profitableWindows++;
      totalWindows++;
    }
  }
  const consistency = totalWindows > 0 ? profitableWindows / totalWindows : 0;

  // Composite score (0-1)
  const normSharpe = Math.max(0, Math.min(sharpe, 3)) / 3;
  const normSortino = Math.max(0, Math.min(sortino, 3)) / 3;
  const normPF = Math.max(0, Math.min(grossLoss > 0 ? grossProfit / grossLoss : 0, 3)) / 3;
  const normWR = wins.length / trades.length;
  const normCalmar = Math.max(0, Math.min(calmar, 3)) / 3;
  const normDD = 1 - Math.min(maxDDPct, 50) / 50; // lower DD = higher score

  const composite =
    normSharpe * 0.25 +
    normSortino * 0.15 +
    normPF * 0.15 +
    normWR * 0.10 +
    consistency * 0.10 +
    normCalmar * 0.10 +
    normDD * 0.15;

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: (wins.length / trades.length) * 100,
    totalPnl,
    avgPnl: avgRet,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    maxDD,
    maxDDPct,
    sharpe,
    sortino,
    calmar,
    var95,
    consistency,
    composite,
    avgHoldBars: trades.reduce((s, t) => s + t.holdBars, 0) / trades.length,
  };
}

// --- Walk-forward validation ---

export interface WalkForwardResult {
  inSample: RiskMetrics;
  outOfSample: RiskMetrics;
  degradation: number; // OOS sharpe / IS sharpe — below 0.5 = overfit
  isOverfit: boolean;
}

export function walkForward(
  bars: BarSnapshot[],
  strategy: StrategyDef,
  opts: Partial<EngineOpts> = {},
  trainPct = 0.7,
  windows = 3,
): WalkForwardResult {
  const o = { ...DEFAULT_ENGINE_OPTS, ...opts };
  const windowSize = Math.floor(bars.length / windows);

  const isResults: RiskMetrics[] = [];
  const oosResults: RiskMetrics[] = [];

  for (let w = 0; w < windows; w++) {
    const start = w * Math.floor((bars.length - windowSize) / Math.max(1, windows - 1));
    const end = Math.min(start + windowSize, bars.length);
    const windowBars = bars.slice(start, end);

    const splitIdx = Math.floor(windowBars.length * trainPct);
    const trainBars = windowBars.slice(0, splitIdx);
    const testBars = windowBars.slice(splitIdx);

    if (trainBars.length < 100 || testBars.length < 50) continue;

    const trainResult = runEngine(trainBars, strategy, opts);
    const testResult = runEngine(testBars, strategy, opts);

    isResults.push(trainResult);
    oosResults.push(testResult);
  }

  // Aggregate
  const avgIS = averageMetrics(isResults);
  const avgOOS = averageMetrics(oosResults);
  const degradation = avgIS.sharpe > 0 ? avgOOS.sharpe / avgIS.sharpe : 0;

  return {
    inSample: avgIS,
    outOfSample: avgOOS,
    degradation,
    isOverfit: degradation < 0.5,
  };
}

function averageMetrics(results: RiskMetrics[]): RiskMetrics {
  if (results.length === 0) {
    return computeMetrics([], [], 5000);
  }
  const avg = (fn: (r: RiskMetrics) => number) => ss.mean(results.map(fn));
  return {
    totalTrades: Math.round(avg((r) => r.totalTrades)),
    wins: Math.round(avg((r) => r.wins)),
    losses: Math.round(avg((r) => r.losses)),
    winRate: avg((r) => r.winRate),
    totalPnl: avg((r) => r.totalPnl),
    avgPnl: avg((r) => r.avgPnl),
    avgWin: avg((r) => r.avgWin),
    avgLoss: avg((r) => r.avgLoss),
    profitFactor: avg((r) => r.profitFactor === Infinity ? 10 : r.profitFactor),
    maxDD: avg((r) => r.maxDD),
    maxDDPct: avg((r) => r.maxDDPct),
    sharpe: avg((r) => r.sharpe),
    sortino: avg((r) => r.sortino),
    calmar: avg((r) => r.calmar),
    var95: avg((r) => r.var95),
    consistency: avg((r) => r.consistency),
    composite: avg((r) => r.composite),
    avgHoldBars: avg((r) => r.avgHoldBars),
  };
}

// --- Pair segmentation ---

const LOW_CAP = ["SIRENUSDT", "PIPPINUSDT", "LIGHTUSDT", "CUSDT", "RIVERUSDT", "VVVUSDT", "DUSKUSDT", "BLUAIUSDT", "STGUSDT"];
const HIGH_CAP = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "SUIUSDT"];

export function getSegment(symbol: string): "low-cap" | "high-cap" {
  return LOW_CAP.includes(symbol) ? "low-cap" : "high-cap";
}

export const SEGMENT_DEFAULTS: Record<string, Partial<EngineOpts>> = {
  "low-cap": { leverage: 5, riskPerTrade: 0.02, feeRate: 0.0011 },
  "high-cap": { leverage: 3, riskPerTrade: 0.015, feeRate: 0.0006 },
};

// --- Display ---

function fmt(n: number, d = 2): string { return n.toFixed(d); }

export function printRankedResults(results: EngineResult[], topN = 20) {
  const qualified = results.filter((r) => r.totalTrades >= 5);
  qualified.sort((a, b) => b.composite - a.composite);

  console.log(
    "\n" + "Rank".padStart(4) + "  " +
    "Strategy".padEnd(24) +
    "Trades".padStart(7) +
    "Win%".padStart(7) +
    "PnL".padStart(10) +
    "PF".padStart(6) +
    "Sharpe".padStart(8) +
    "Sortino".padStart(8) +
    "DD%".padStart(7) +
    "Calmar".padStart(8) +
    "VaR95".padStart(8) +
    "Consist".padStart(8) +
    "Score".padStart(7) +
    "Hold".padStart(6)
  );
  console.log("-".repeat(130));

  const top = qualified.slice(0, topN);
  for (let i = 0; i < top.length; i++) {
    const r = top[i];
    const pSign = r.totalPnl >= 0 ? "+" : "";
    console.log(
      `${(i + 1).toString().padStart(4)}  ` +
      `${r.strategyName.padEnd(24)}` +
      `${r.totalTrades.toString().padStart(7)}` +
      `${fmt(r.winRate).padStart(7)}` +
      `${(pSign + "$" + fmt(r.totalPnl)).padStart(10)}` +
      `${fmt(r.profitFactor === Infinity ? 99 : r.profitFactor).padStart(6)}` +
      `${fmt(r.sharpe).padStart(8)}` +
      `${fmt(r.sortino).padStart(8)}` +
      `${fmt(r.maxDDPct).padStart(7)}` +
      `${fmt(r.calmar).padStart(8)}` +
      `${fmt(r.var95).padStart(8)}` +
      `${fmt(r.consistency).padStart(8)}` +
      `${fmt(r.composite).padStart(7)}` +
      `${fmt(r.avgHoldBars, 0).padStart(6)}`
    );
  }
  console.log();
}

export function printDetailedResult(r: EngineResult) {
  console.log(`\n--- ${r.strategyName} ---`);
  console.log(`Config: ${r.params}`);
  console.log(`Trades: ${r.totalTrades} (${r.wins}W / ${r.losses}L) | Win: ${fmt(r.winRate)}%`);
  console.log(`PnL: $${fmt(r.totalPnl)} | Avg: $${fmt(r.avgPnl)} | AvgWin: $${fmt(r.avgWin)} | AvgLoss: $${fmt(r.avgLoss)}`);
  console.log(`PF: ${fmt(r.profitFactor)} | Sharpe: ${fmt(r.sharpe)} | Sortino: ${fmt(r.sortino)} | Calmar: ${fmt(r.calmar)}`);
  console.log(`MaxDD: ${fmt(r.maxDDPct)}% | VaR95: $${fmt(r.var95)} | Consistency: ${fmt(r.consistency * 100)}%`);
  console.log(`Composite: ${fmt(r.composite)} | Avg hold: ${fmt(r.avgHoldBars, 0)} bars`);

  const reasons: Record<string, number> = {};
  for (const t of r.trades) reasons[t.exitReason] = (reasons[t.exitReason] || 0) + 1;
  console.log(`Exits: ${Object.entries(reasons).map(([k, v]) => `${k}=${v}`).join(" ")}`);
}
