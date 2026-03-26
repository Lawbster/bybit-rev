import { loadCandles, Candle } from "./fetch-candles";
import { computeIndicators, getSnapshotAt, IndicatorSnapshot } from "./indicators";

// --- Types ---

export type Signal = "long" | "short" | "close-long" | "close-short" | null;

export interface StrategyConfig {
  name: string;
  params: Record<string, number>;
  /** Given a snapshot, return a trade signal */
  signal: (snap: IndicatorSnapshot, params: Record<string, number>) => Signal;
}

interface Position {
  side: "Long" | "Short";
  entryPrice: number;
  entryTime: number;
  qty: number;
  stopLoss: number;
  takeProfit: number;
}

interface ClosedTrade {
  side: "Long" | "Short";
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  pnl: number;
  pnlPercent: number;
  holdBars: number;
  exitReason: "tp" | "sl" | "signal" | "eod";
}

export interface BacktestResult {
  strategy: string;
  symbol: string;
  params: Record<string, number>;
  trades: ClosedTrade[];
  // Stats
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpe: number;
  avgHoldBars: number;
  // Equity curve
  equity: number[];
}

// --- Backtest engine ---

export interface BacktestOptions {
  symbol: string;
  interval: string;
  startBalance: number;
  leverage: number;
  riskPerTrade: number;  // fraction of balance
  feeRate: number;
  slMultiplier: number;  // x ATR
  tpMultiplier: number;  // x ATR
  maxOpenPositions: number;
}

const DEFAULT_OPTS: BacktestOptions = {
  symbol: "SIRENUSDT",
  interval: "5",
  startBalance: 5000,
  leverage: 5,
  riskPerTrade: 0.02,
  feeRate: 0.0011,
  slMultiplier: 1.5,
  tpMultiplier: 0.75,
  maxOpenPositions: 1,
};

export function runBacktest(
  strategy: StrategyConfig,
  candles: Candle[],
  indicators: Map<number, IndicatorSnapshot>,
  opts: Partial<BacktestOptions> = {},
): BacktestResult {
  const o = { ...DEFAULT_OPTS, ...opts };
  let balance = o.startBalance;
  let peak = balance;
  let maxDD = 0;
  let maxDDPct = 0;
  const equity: number[] = [balance];
  const closed: ClosedTrade[] = [];
  let position: Position | null = null;

  // Skip warmup period (first 210 candles used for indicators)
  const startIdx = 210;

  for (let i = startIdx; i < candles.length; i++) {
    const candle = candles[i];
    const snap = indicators.get(candle.timestamp);
    if (!snap) continue;

    // Check SL/TP on current candle's high/low
    if (position) {
      let exitPrice: number | null = null;
      let exitReason: ClosedTrade["exitReason"] = "sl";

      if (position.side === "Long") {
        if (candle.low <= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = "sl";
        } else if (candle.high >= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = "tp";
        }
      } else {
        if (candle.high >= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = "sl";
        } else if (candle.low <= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = "tp";
        }
      }

      // Check for signal-based exit
      if (!exitPrice) {
        const sig = strategy.signal(snap, strategy.params);
        if (position.side === "Long" && sig === "close-long") {
          exitPrice = candle.close;
          exitReason = "signal";
        } else if (position.side === "Short" && sig === "close-short") {
          exitPrice = candle.close;
          exitReason = "signal";
        }
        // Flip: close on opposing signal
        if (position.side === "Long" && sig === "short") {
          exitPrice = candle.close;
          exitReason = "signal";
        } else if (position.side === "Short" && sig === "long") {
          exitPrice = candle.close;
          exitReason = "signal";
        }
      }

      if (exitPrice) {
        const pnl = position.side === "Long"
          ? (exitPrice - position.entryPrice) * position.qty
          : (position.entryPrice - exitPrice) * position.qty;
        const fee = position.qty * exitPrice * o.feeRate;
        const netPnl = pnl - fee;
        const pnlPct = (pnl / (position.qty * position.entryPrice)) * 100 * o.leverage;

        balance += netPnl;

        closed.push({
          side: position.side,
          entryPrice: position.entryPrice,
          exitPrice,
          entryTime: position.entryTime,
          exitTime: candle.timestamp,
          pnl: netPnl,
          pnlPercent: pnlPct,
          holdBars: i - candles.findIndex((c) => c.timestamp === position!.entryTime),
          exitReason,
        });

        position = null;
      }
    }

    // Check for entry signal
    if (!position) {
      const sig = strategy.signal(snap, strategy.params);

      if (sig === "long" || sig === "short") {
        const side = sig === "long" ? "Long" : "Short";
        const atr = snap.atr14;
        if (atr <= 0) continue;

        const slDist = atr * o.slMultiplier;
        const tpDist = atr * o.tpMultiplier;
        const riskAmt = balance * o.riskPerTrade;
        const qty = riskAmt / slDist;
        const fee = qty * candle.close * o.feeRate;
        balance -= fee;

        const sl = side === "Long" ? candle.close - slDist : candle.close + slDist;
        const tp = side === "Long" ? candle.close + tpDist : candle.close - tpDist;

        position = {
          side,
          entryPrice: candle.close,
          entryTime: candle.timestamp,
          qty,
          stopLoss: sl,
          takeProfit: tp,
        };
      }
    }

    // Track equity
    let unrealized = 0;
    if (position) {
      unrealized = position.side === "Long"
        ? (candle.close - position.entryPrice) * position.qty
        : (position.entryPrice - candle.close) * position.qty;
    }
    const eqNow = balance + unrealized;
    equity.push(eqNow);

    if (eqNow > peak) peak = eqNow;
    const dd = peak - eqNow;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
  }

  // Force close any open position at end
  if (position) {
    const lastCandle = candles[candles.length - 1];
    const pnl = position.side === "Long"
      ? (lastCandle.close - position.entryPrice) * position.qty
      : (position.entryPrice - lastCandle.close) * position.qty;
    const fee = position.qty * lastCandle.close * o.feeRate;
    balance += pnl - fee;
    closed.push({
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice: lastCandle.close,
      entryTime: position.entryTime,
      exitTime: lastCandle.timestamp,
      pnl: pnl - fee,
      pnlPercent: (pnl / (position.qty * position.entryPrice)) * 100 * o.leverage,
      holdBars: candles.length - candles.findIndex((c) => c.timestamp === position!.entryTime),
      exitReason: "eod",
    });
  }

  // Compute stats
  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl <= 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const returns = closed.map((t) => t.pnl);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length - 1))
    : 0;

  return {
    strategy: strategy.name,
    symbol: o.symbol,
    params: strategy.params,
    trades: closed,
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
    totalPnl: closed.reduce((s, t) => s + t.pnl, 0),
    avgPnl: avgReturn,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    maxDrawdown: maxDD,
    maxDrawdownPct: maxDDPct,
    sharpe: stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0,
    avgHoldBars: closed.length > 0 ? closed.reduce((s, t) => s + t.holdBars, 0) / closed.length : 0,
    equity,
  };
}

// --- Built-in strategies ---

export const STRATEGIES: StrategyConfig[] = [
  // 1. Copy trader replica: mean reversion on oversold + bear trend
  {
    name: "mean-revert-long",
    params: { rsi: 35, stochK: 35, bbPos: 0.35, volRatio: 0.5, atrPct: 3, minScore: 4 },
    signal: (s, p) => {
      const conds = [
        s.rsi14 < p.rsi,
        s.stochK < p.stochK,
        s.bbPosition < p.bbPos,
        s.volumeRatio < p.volRatio,
        s.atrPercent > p.atrPct,
        s.emaTrend === "bear",
      ];
      const score = conds.filter(Boolean).length;
      if (score >= p.minScore) return "long";
      return null;
    },
  },

  // 2. Fade the bounce: short rallies in bear trend
  {
    name: "fade-bounce-short",
    params: { rsiLow: 45, rsiHigh: 65, stochMin: 40, atrPct: 2, minScore: 4 },
    signal: (s, p) => {
      const conds = [
        s.rsi14 > p.rsiLow && s.rsi14 < p.rsiHigh,
        s.stochK > p.stochMin,
        s.emaTrend === "bear",
        s.atrPercent > p.atrPct,
        s.macdHist < 0,
        s.roc5 > 0,  // bouncing up = entry for short
      ];
      const score = conds.filter(Boolean).length;
      if (score >= p.minScore) return "short";
      return null;
    },
  },

  // 3. RSI mean reversion (classic)
  {
    name: "rsi-meanrev",
    params: { oversold: 30, overbought: 70 },
    signal: (s, p) => {
      if (s.rsi14 < p.oversold) return "long";
      if (s.rsi14 > p.overbought) return "short";
      return null;
    },
  },

  // 4. Bollinger Band bounce
  {
    name: "bb-bounce",
    params: { entryLow: 0.1, entryHigh: 0.9, bbWidthMin: 3 },
    signal: (s, p) => {
      if (s.bbWidth < p.bbWidthMin) return null; // skip tight BBs
      if (s.bbPosition < p.entryLow) return "long";
      if (s.bbPosition > p.entryHigh) return "short";
      return null;
    },
  },

  // 5. Stochastic crossover
  {
    name: "stoch-cross",
    params: { oversold: 20, overbought: 80 },
    signal: (s, p) => {
      if (s.stochK < p.oversold && s.stochK > s.stochD) return "long";   // K crosses above D in oversold
      if (s.stochK > p.overbought && s.stochK < s.stochD) return "short"; // K crosses below D in overbought
      return null;
    },
  },

  // 6. Trend following: EMA + RSI confirmation
  {
    name: "trend-follow",
    params: { rsiMin: 50, rsiMax: 70 },
    signal: (s, p) => {
      if (s.emaTrend === "bull" && s.rsi14 > p.rsiMin && s.rsi14 < p.rsiMax && s.roc5 > 0) return "long";
      if (s.emaTrend === "bear" && s.rsi14 < (100 - p.rsiMin) && s.rsi14 > (100 - p.rsiMax) && s.roc5 < 0) return "short";
      return null;
    },
  },

  // 7. Volatility breakout: tight BB squeeze then expansion
  {
    name: "vol-breakout",
    params: { bbWidthMax: 3, rsiConfirm: 55 },
    signal: (s, p) => {
      if (s.bbWidth > p.bbWidthMax) return null; // only enter during squeeze
      if (s.rsi14 > p.rsiConfirm && s.roc5 > 0) return "long";
      if (s.rsi14 < (100 - p.rsiConfirm) && s.roc5 < 0) return "short";
      return null;
    },
  },

  // 8. Combined: oversold + volume dry-up (copy trader inspired, relaxed)
  {
    name: "vol-dryup-reversal",
    params: { rsi: 40, volRatio: 0.3, atrPct: 2, stochK: 30 },
    signal: (s, p) => {
      if (s.rsi14 < p.rsi && s.volumeRatio < p.volRatio && s.atrPercent > p.atrPct && s.stochK < p.stochK) return "long";
      if (s.rsi14 > (100 - p.rsi) && s.volumeRatio < p.volRatio && s.atrPercent > p.atrPct && s.stochK > (100 - p.stochK)) return "short";
      return null;
    },
  },
];

// --- Parameter sweep ---

interface SweepRange {
  param: string;
  values: number[];
}

export function parameterSweep(
  baseStrategy: StrategyConfig,
  sweeps: SweepRange[],
  candles: Candle[],
  indicators: Map<number, IndicatorSnapshot>,
  opts: Partial<BacktestOptions> = {},
): BacktestResult[] {
  const results: BacktestResult[] = [];

  // Generate all combinations
  function combinations(ranges: SweepRange[], current: Record<string, number> = {}): Record<string, number>[] {
    if (ranges.length === 0) return [{ ...current }];
    const [first, ...rest] = ranges;
    const combos: Record<string, number>[] = [];
    for (const val of first.values) {
      combos.push(...combinations(rest, { ...current, [first.param]: val }));
    }
    return combos;
  }

  const allParams = combinations(sweeps);
  console.log(`  Sweeping ${allParams.length} combinations for ${baseStrategy.name}...`);

  for (const params of allParams) {
    const strat: StrategyConfig = {
      ...baseStrategy,
      params: { ...baseStrategy.params, ...params },
    };
    const result = runBacktest(strat, candles, indicators, opts);
    if (result.totalTrades > 0) results.push(result);
  }

  return results;
}

// --- Display ---

function fmt(n: number, d = 2): string { return n.toFixed(d); }

function printResult(r: BacktestResult) {
  const pSign = r.totalPnl >= 0 ? "+" : "";
  console.log(
    `  ${r.strategy.padEnd(22)} | ` +
    `${r.totalTrades.toString().padStart(4)} trades | ` +
    `${fmt(r.winRate)}% win | ` +
    `PnL: ${pSign}$${fmt(r.totalPnl)} | ` +
    `PF: ${fmt(r.profitFactor)} | ` +
    `DD: ${fmt(r.maxDrawdownPct)}% | ` +
    `Sharpe: ${fmt(r.sharpe)} | ` +
    `Avg hold: ${fmt(r.avgHoldBars, 0)} bars`
  );
}

function printDetailedResult(r: BacktestResult) {
  console.log(`\n--- ${r.strategy} [${r.symbol}] ---`);
  console.log(`Params: ${JSON.stringify(r.params)}`);
  console.log(`Trades: ${r.totalTrades} (${r.wins}W / ${r.losses}L) | Win rate: ${fmt(r.winRate)}%`);
  console.log(`PnL: $${fmt(r.totalPnl)} | Avg: $${fmt(r.avgPnl)} | Avg win: $${fmt(r.avgWin)} | Avg loss: $${fmt(r.avgLoss)}`);
  console.log(`Profit factor: ${fmt(r.profitFactor)} | Sharpe: ${fmt(r.sharpe)}`);
  console.log(`Max drawdown: $${fmt(r.maxDrawdown)} (${fmt(r.maxDrawdownPct)}%)`);
  console.log(`Avg hold: ${fmt(r.avgHoldBars, 0)} bars`);

  // Exit reasons
  const reasons = { tp: 0, sl: 0, signal: 0, eod: 0 };
  for (const t of r.trades) reasons[t.exitReason]++;
  console.log(`Exits: TP=${reasons.tp} SL=${reasons.sl} Signal=${reasons.signal} EOD=${reasons.eod}`);
}

// --- CLI ---

async function main() {
  const symbols = process.argv.slice(2);
  if (symbols.length === 0) {
    symbols.push("SIRENUSDT", "PIPPINUSDT");
  }

  // SL/TP options to sweep
  const slTpConfigs = [
    { slMultiplier: 1.5, tpMultiplier: 0.75, label: "SL:1.5 TP:0.75 (0.5:1)" },
    { slMultiplier: 1.5, tpMultiplier: 1.5, label: "SL:1.5 TP:1.5 (1:1)" },
    { slMultiplier: 2.0, tpMultiplier: 1.0, label: "SL:2.0 TP:1.0 (0.5:1)" },
    { slMultiplier: 1.0, tpMultiplier: 1.0, label: "SL:1.0 TP:1.0 (1:1)" },
  ];

  for (const symbol of symbols) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  BACKTEST: ${symbol}`);
    console.log(`${"=".repeat(60)}`);

    const candles = loadCandles(symbol, "5");
    if (candles.length === 0) {
      console.log(`  No candle data. Run: npx ts-node src/fetch-candles.ts ${symbol} 5 2025-03-22`);
      continue;
    }
    console.log(`  ${candles.length} candles loaded`);

    console.log("  Computing indicators...");
    const indicators = computeIndicators(candles);
    console.log(`  ${indicators.size} snapshots\n`);

    // Run each strategy with each SL/TP config
    const allResults: BacktestResult[] = [];

    for (const sltp of slTpConfigs) {
      console.log(`\n  --- ${sltp.label} ---`);
      for (const strat of STRATEGIES) {
        const result = runBacktest(strat, candles, indicators, {
          symbol,
          slMultiplier: sltp.slMultiplier,
          tpMultiplier: sltp.tpMultiplier,
        });
        if (result.totalTrades > 0) {
          printResult(result);
          allResults.push(result);
        }
      }
    }

    // Top 5 by profit factor (min 10 trades)
    const qualified = allResults.filter((r) => r.totalTrades >= 10);
    qualified.sort((a, b) => b.profitFactor - a.profitFactor);

    console.log(`\n  === TOP 5 STRATEGIES (min 10 trades) ===`);
    for (const r of qualified.slice(0, 5)) {
      printDetailedResult(r);
    }

    // Also show top by total PnL
    qualified.sort((a, b) => b.totalPnl - a.totalPnl);
    console.log(`\n  === TOP 5 BY PNL ===`);
    for (const r of qualified.slice(0, 5)) {
      printResult(r);
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}
