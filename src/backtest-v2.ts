/**
 * Candle-mode backtester — runs parameterized strategy templates against historical 5m candle data.
 *
 * Usage:
 *   npm run backtest                    # all symbols
 *   npm run backtest -- SIRENUSDT       # single symbol
 *   npm run backtest -- --walkforward   # with walk-forward validation
 */
import fs from "fs";
import { loadCandles } from "./fetch-candles";
import { computeIndicators } from "./indicators";
import {
  BarSnapshot, StrategyTemplate, StrategyDef, ExitConfig,
  generateCombos, candlesToBars, runEngine, runEngineFast, precomputeConditions,
  walkForward, printRankedResults, printDetailedResult, getSegment, SEGMENT_DEFAULTS,
  EngineResult,
} from "./backtest-engine";

// ── Strategy templates ──────────────────────────────────────────────────

const EXIT_CONFIGS: ExitConfig[] = [
  { slAtr: 1.5, tpAtr: 0.75 },                                         // tight 0.5:1 R:R (copy trader style)
  { slAtr: 1.5, tpAtr: 1.5 },                                          // 1:1 R:R
  { slAtr: 1.5, tpAtr: 3.0 },                                          // 2:1 R:R
  { slAtr: 1.5, tpAtr: 2.0, trailingActivateAtr: 1.0, trailingDistAtr: 0.8 }, // trailing
  { slAtr: 2.0, tpAtr: 3.0, maxHoldBars: 60 },                         // wider + time cap (5h)
];

const TEMPLATES: StrategyTemplate[] = [
  // 1. Volume dry-up reversal (the copy trader pattern)
  {
    name: "vol-dryup-reversal",
    longRanges: [
      { field: "volRatio", op: "<", values: [0.3, 0.5] },
      { field: "rsi", op: "<", values: [30, 35, 40] },
      { field: "bbPos", op: "<", values: [0.1, 0.2] },
      { field: "atrPct", op: ">", values: [2, 3, 4] },
    ],
    shortRanges: [
      { field: "volRatio", op: "<", values: [0.3, 0.5] },
      { field: "rsi", op: ">", values: [60, 65, 70] },
      { field: "bbPos", op: ">", values: [0.8, 0.9] },
      { field: "atrPct", op: ">", values: [2, 3, 4] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 2. Mean reversion — oversold/overbought bounce
  {
    name: "mean-reversion",
    longRanges: [
      { field: "rsi", op: "<", values: [25, 30, 35] },
      { field: "stochK", op: "<", values: [15, 20, 25] },
      { field: "bbPos", op: "<", values: [0.0, 0.1, 0.2] },
      { field: "roc5", op: "<", values: [-3, -5, -8] },
    ],
    shortRanges: [
      { field: "rsi", op: ">", values: [65, 70, 75] },
      { field: "stochK", op: ">", values: [75, 80, 85] },
      { field: "bbPos", op: ">", values: [0.8, 0.9, 1.0] },
      { field: "roc5", op: ">", values: [3, 5, 8] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 3. Trend following — EMA alignment + momentum
  {
    name: "trend-follow",
    longRanges: [
      { field: "emaTrend", op: "==", values: ["bull"] },
      { field: "macdHist", op: ">", values: [0] },
      { field: "roc20", op: ">", values: [1, 3, 5] },
      { field: "priceVsEma50", op: ">", values: [0, 1, 2] },
    ],
    shortRanges: [
      { field: "emaTrend", op: "==", values: ["bear"] },
      { field: "macdHist", op: "<", values: [0] },
      { field: "roc20", op: "<", values: [-1, -3, -5] },
      { field: "priceVsEma50", op: "<", values: [0, -1, -2] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 4. Stoch crossover + RSI filter
  {
    name: "stoch-cross",
    longRanges: [
      { field: "stochK", op: "<", values: [20, 30] },
      { field: "stochD", op: "<", values: [25, 35] },
      { field: "rsi", op: "<", values: [40, 45, 50] },
      { field: "volRatio", op: ">", values: [0.5, 0.8] },
    ],
    shortRanges: [
      { field: "stochK", op: ">", values: [70, 80] },
      { field: "stochD", op: ">", values: [65, 75] },
      { field: "rsi", op: ">", values: [55, 60, 65] },
      { field: "volRatio", op: ">", values: [0.5, 0.8] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 5. Bollinger squeeze breakout
  {
    name: "bb-squeeze",
    longRanges: [
      { field: "bbWidth", op: "<", values: [2, 3, 4] },
      { field: "roc5", op: ">", values: [1, 2] },
      { field: "macdHist", op: ">", values: [0] },
      { field: "volRatio", op: ">", values: [1.0, 1.5, 2.0] },
    ],
    shortRanges: [
      { field: "bbWidth", op: "<", values: [2, 3, 4] },
      { field: "roc5", op: "<", values: [-1, -2] },
      { field: "macdHist", op: "<", values: [0] },
      { field: "volRatio", op: ">", values: [1.0, 1.5, 2.0] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 6. Multi-timeframe trend alignment
  {
    name: "mtf-trend",
    longRanges: [
      { field: "emaTrend", op: "==", values: ["bull"] },
      { field: "htfTrend15m", op: "==", values: ["bull"] },
      { field: "htfTrend1h", op: "==", values: ["bull"] },
      { field: "rsi", op: "<", values: [55, 60] },
    ],
    shortRanges: [
      { field: "emaTrend", op: "==", values: ["bear"] },
      { field: "htfTrend15m", op: "==", values: ["bear"] },
      { field: "htfTrend1h", op: "==", values: ["bear"] },
      { field: "rsi", op: ">", values: [45, 40] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 7. Extreme dump catch (manipulation pattern)
  {
    name: "dump-catch",
    longRanges: [
      { field: "roc5", op: "<", values: [-8, -10, -15] },
      { field: "rsi", op: "<", values: [20, 25, 30] },
      { field: "bbPos", op: "<", values: [-0.1, 0.0, 0.05] },
      { field: "atrPct", op: ">", values: [4, 5, 7] },
    ],
    shortRanges: [
      { field: "roc5", op: ">", values: [8, 10, 15] },
      { field: "rsi", op: ">", values: [70, 75, 80] },
      { field: "bbPos", op: ">", values: [0.95, 1.0, 1.1] },
      { field: "atrPct", op: ">", values: [4, 5, 7] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 8. Fade momentum — counter-trend on exhaustion
  {
    name: "fade-momentum",
    longRanges: [
      { field: "roc5", op: "<", values: [-5, -8] },
      { field: "macdHist", op: "<", values: [0] },
      { field: "stochK", op: "<", values: [15, 20] },
      { field: "emaTrend", op: "==", values: ["bear"] },
    ],
    shortRanges: [
      { field: "roc5", op: ">", values: [5, 8] },
      { field: "macdHist", op: ">", values: [0] },
      { field: "stochK", op: ">", values: [80, 85] },
      { field: "emaTrend", op: "==", values: ["bull"] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },
];

// ── High-cap templates (relaxed thresholds for lower volatility) ─────────

const HC_EXIT_CONFIGS: ExitConfig[] = [
  { slAtr: 1.5, tpAtr: 0.75 },
  { slAtr: 1.5, tpAtr: 1.5 },
  { slAtr: 1.5, tpAtr: 2.0, trailingActivateAtr: 0.8, trailingDistAtr: 0.6 },
  { slAtr: 2.0, tpAtr: 3.0 },
  { slAtr: 2.0, tpAtr: 3.0, maxHoldBars: 120 },  // 10h hold for slower moves
];

const HC_TEMPLATES: StrategyTemplate[] = [
  // 1. Mean reversion — relaxed for high caps
  {
    name: "hc-mean-revert",
    longRanges: [
      { field: "rsi", op: "<", values: [35, 40, 45] },
      { field: "stochK", op: "<", values: [20, 30, 40] },
      { field: "bbPos", op: "<", values: [0.15, 0.25, 0.35] },
      { field: "roc5", op: "<", values: [-0.5, -1, -1.5] },
    ],
    shortRanges: [
      { field: "rsi", op: ">", values: [55, 60, 65] },
      { field: "stochK", op: ">", values: [60, 70, 80] },
      { field: "bbPos", op: ">", values: [0.65, 0.75, 0.85] },
      { field: "roc5", op: ">", values: [0.5, 1, 1.5] },
    ],
    minScoreRange: [2, 3, 4],
    exitRange: HC_EXIT_CONFIGS,
  },

  // 2. Trend following — EMA alignment + momentum
  {
    name: "hc-trend-follow",
    longRanges: [
      { field: "emaTrend", op: "==", values: ["bull"] },
      { field: "macdHist", op: ">", values: [0] },
      { field: "rsi", op: ">", values: [50, 55] },
      { field: "priceVsEma50", op: ">", values: [0, 0.3, 0.5] },
    ],
    shortRanges: [
      { field: "emaTrend", op: "==", values: ["bear"] },
      { field: "macdHist", op: "<", values: [0] },
      { field: "rsi", op: "<", values: [45, 50] },
      { field: "priceVsEma50", op: "<", values: [0, -0.3, -0.5] },
    ],
    minScoreRange: [2, 3, 4],
    exitRange: HC_EXIT_CONFIGS,
  },

  // 3. Stoch bounce with volume confirmation
  {
    name: "hc-stoch-bounce",
    longRanges: [
      { field: "stochK", op: "<", values: [15, 20, 25, 30] },
      { field: "stochD", op: "<", values: [20, 30, 40] },
      { field: "volRatio", op: ">", values: [0.8, 1.0, 1.5] },
      { field: "rsi", op: "<", values: [40, 45, 50] },
    ],
    shortRanges: [
      { field: "stochK", op: ">", values: [70, 75, 80, 85] },
      { field: "stochD", op: ">", values: [60, 70, 80] },
      { field: "volRatio", op: ">", values: [0.8, 1.0, 1.5] },
      { field: "rsi", op: ">", values: [55, 60, 65] },
    ],
    minScoreRange: [2, 3, 4],
    exitRange: HC_EXIT_CONFIGS,
  },

  // 4. BB squeeze breakout (adapted for tighter ranges)
  {
    name: "hc-bb-squeeze",
    longRanges: [
      { field: "bbWidth", op: "<", values: [1, 1.5, 2] },
      { field: "roc5", op: ">", values: [0.3, 0.5, 0.8] },
      { field: "macdHist", op: ">", values: [0] },
      { field: "volRatio", op: ">", values: [1.0, 1.5, 2.0] },
    ],
    shortRanges: [
      { field: "bbWidth", op: "<", values: [1, 1.5, 2] },
      { field: "roc5", op: "<", values: [-0.3, -0.5, -0.8] },
      { field: "macdHist", op: "<", values: [0] },
      { field: "volRatio", op: ">", values: [1.0, 1.5, 2.0] },
    ],
    minScoreRange: [2, 3, 4],
    exitRange: HC_EXIT_CONFIGS,
  },

  // 5. Multi-timeframe alignment
  {
    name: "hc-mtf-align",
    longRanges: [
      { field: "emaTrend", op: "==", values: ["bull"] },
      { field: "htfTrend15m", op: "==", values: ["bull"] },
      { field: "htfTrend1h", op: "==", values: ["bull"] },
      { field: "rsi", op: "<", values: [50, 55, 60] },
    ],
    shortRanges: [
      { field: "emaTrend", op: "==", values: ["bear"] },
      { field: "htfTrend15m", op: "==", values: ["bear"] },
      { field: "htfTrend1h", op: "==", values: ["bear"] },
      { field: "rsi", op: ">", values: [40, 45, 50] },
    ],
    minScoreRange: [2, 3, 4],
    exitRange: HC_EXIT_CONFIGS,
  },

  // 6. RSI divergence — oversold in downtrend, overbought in uptrend
  {
    name: "hc-rsi-diverge",
    longRanges: [
      { field: "rsi", op: "<", values: [35, 40, 45] },
      { field: "emaTrend", op: "==", values: ["bear"] },
      { field: "roc5", op: "<", values: [-0.5, -1] },
      { field: "bbPos", op: "<", values: [0.2, 0.3] },
    ],
    shortRanges: [
      { field: "rsi", op: ">", values: [55, 60, 65] },
      { field: "emaTrend", op: "==", values: ["bull"] },
      { field: "roc5", op: ">", values: [0.5, 1] },
      { field: "bbPos", op: ">", values: [0.7, 0.8] },
    ],
    minScoreRange: [2, 3, 4],
    exitRange: HC_EXIT_CONFIGS,
  },

  // 7. Volume dry-up (relaxed ATR for high caps)
  {
    name: "hc-vol-dryup",
    longRanges: [
      { field: "volRatio", op: "<", values: [0.3, 0.5, 0.7] },
      { field: "rsi", op: "<", values: [35, 40, 45] },
      { field: "bbPos", op: "<", values: [0.15, 0.25, 0.35] },
      { field: "atrPct", op: ">", values: [0.5, 0.8, 1.0] },
    ],
    shortRanges: [
      { field: "volRatio", op: "<", values: [0.3, 0.5, 0.7] },
      { field: "rsi", op: ">", values: [55, 60, 65] },
      { field: "bbPos", op: ">", values: [0.65, 0.75, 0.85] },
      { field: "atrPct", op: ">", values: [0.5, 0.8, 1.0] },
    ],
    minScoreRange: [2, 3, 4],
    exitRange: HC_EXIT_CONFIGS,
  },

  // 8. MACD momentum + RSI filter
  {
    name: "hc-macd-momentum",
    longRanges: [
      { field: "macdHist", op: ">", values: [0] },
      { field: "rsi", op: ">", values: [45, 50, 55] },
      { field: "roc20", op: ">", values: [0, 0.5, 1] },
      { field: "volRatio", op: ">", values: [0.8, 1.0] },
    ],
    shortRanges: [
      { field: "macdHist", op: "<", values: [0] },
      { field: "rsi", op: "<", values: [45, 50, 55] },
      { field: "roc20", op: "<", values: [0, -0.5, -1] },
      { field: "volRatio", op: ">", values: [0.8, 1.0] },
    ],
    minScoreRange: [2, 3, 4],
    exitRange: HC_EXIT_CONFIGS,
  },
];

// ── Symbols ─────────────────────────────────────────────────────────────

const LOW_CAP = ["SIRENUSDT", "PIPPINUSDT", "LIGHTUSDT", "CUSDT", "RIVERUSDT", "VVVUSDT", "DUSKUSDT", "BLUAIUSDT", "STGUSDT"];
const HIGH_CAP = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "SUIUSDT"];
const ALL_SYMBOLS = [...LOW_CAP, ...HIGH_CAP];

// ── Helpers ──────────────────────────────────────────────────────────────

const TOP_N = 50; // keep top N results per symbol to avoid OOM

interface LightResult {
  strategyName: string;
  params: string;
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
  strategyIdx: number; // index into template's combos for WF lookup
  templateName: string;
}

function toLightResult(r: EngineResult, stratIdx: number, tmplName: string): LightResult {
  return {
    strategyName: r.strategyName,
    params: r.params,
    totalTrades: r.totalTrades,
    wins: r.wins,
    losses: r.losses,
    winRate: r.winRate,
    totalPnl: r.totalPnl,
    avgPnl: r.avgPnl,
    avgWin: r.avgWin,
    avgLoss: r.avgLoss,
    profitFactor: r.profitFactor,
    maxDD: r.maxDD,
    maxDDPct: r.maxDDPct,
    sharpe: r.sharpe,
    sortino: r.sortino,
    calmar: r.calmar,
    var95: r.var95,
    consistency: r.consistency,
    composite: r.composite,
    avgHoldBars: r.avgHoldBars,
    strategyIdx: stratIdx,
    templateName: tmplName,
  };
}

function insertSorted(arr: LightResult[], item: LightResult, maxLen: number) {
  if (item.totalTrades < 5) return;
  if (arr.length >= maxLen && item.composite <= arr[arr.length - 1].composite) return;
  arr.push(item);
  arr.sort((a, b) => b.composite - a.composite);
  if (arr.length > maxLen) arr.length = maxLen;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const doWF = args.includes("--walkforward") || args.includes("--wf");
  const symbolArgs = args.filter((a) => !a.startsWith("--"));
  const symbols = symbolArgs.length > 0 ? symbolArgs : ALL_SYMBOLS;

  console.log("\n=== CANDLE-MODE BACKTESTER ===");
  console.log(`Symbols: ${symbols.join(", ")}`);
  console.log(`Walk-forward: ${doWF ? "ON" : "OFF (use --walkforward to enable)"}\n`);

  // Pre-generate combos per template set
  function buildCombos(templates: StrategyTemplate[]): { name: string; combos: StrategyDef[] }[] {
    const result: { name: string; combos: StrategyDef[] }[] = [];
    for (const tmpl of templates) {
      const combos = generateCombos(tmpl);
      result.push({ name: tmpl.name, combos });
    }
    return result;
  }

  const lcCombos = buildCombos(TEMPLATES);
  const hcCombos = buildCombos(HC_TEMPLATES);

  console.log("Low-cap templates:");
  let lcTotal = 0;
  for (const { name, combos } of lcCombos) { console.log(`  ${name}: ${combos.length}`); lcTotal += combos.length; }
  console.log(`  TOTAL: ${lcTotal}\n`);

  console.log("High-cap templates:");
  let hcTotal = 0;
  for (const { name, combos } of hcCombos) { console.log(`  ${name}: ${combos.length}`); hcTotal += combos.length; }
  console.log(`  TOTAL: ${hcTotal}\n`);

  const topResults: LightResult[] = [];

  for (const symbol of symbols) {
    const segment = getSegment(symbol);
    const segOpts = SEGMENT_DEFAULTS[segment] || {};
    const templateCombos = segment === "high-cap" ? hcCombos : lcCombos;

    console.log(`\n── ${symbol} (${segment}) ──`);

    const candles = loadCandles(symbol, "5");
    if (candles.length < 210) {
      console.log(`  Skipping: only ${candles.length} candles (need 210+)`);
      continue;
    }
    console.log(`  Candles: ${candles.length} (${new Date(candles[0].timestamp).toISOString().slice(0, 10)} → ${new Date(candles[candles.length - 1].timestamp).toISOString().slice(0, 10)})`);

    const indicators = computeIndicators(candles);
    const bars = candlesToBars(candles, indicators);
    console.log(`  Bars with indicators: ${bars.length}`);

    // Collect all strategies for this symbol and pre-compute conditions once
    const allCombos: StrategyDef[] = [];
    for (const { combos } of templateCombos) allCombos.push(...combos);
    const t0 = Date.now();
    const cache = precomputeConditions(bars, allCombos);
    console.log(`  Pre-computed ${cache.results.size} unique conditions in ${Date.now() - t0}ms`);

    let tested = 0;
    let skipped = 0;
    let bestComposite = 0;
    let bestName = "";
    const t1 = Date.now();

    // Process one template at a time to limit memory
    for (const { name: tmplName, combos } of templateCombos) {
      for (let si = 0; si < combos.length; si++) {
        const strategy = combos[si];
        const result = runEngineFast(bars, strategy, cache, segOpts);
        result.strategyName = `${tmplName}[${symbol}]`;
        tested++;
        if (result.totalTrades === 0) skipped++;

        if (result.totalTrades >= 5 && result.composite > bestComposite) {
          bestComposite = result.composite;
          bestName = `${tmplName}[${symbol}] — ${result.totalTrades} trades, PnL $${result.totalPnl.toFixed(2)}, Sharpe ${result.sharpe.toFixed(2)}, Score ${result.composite.toFixed(3)}`;
        }

        insertSorted(topResults, toLightResult(result, si, tmplName), TOP_N * symbols.length);
      }
    }

    console.log(`  Tested: ${tested} strategies (${skipped} skipped/no-signal) in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    if (bestName) {
      console.log(`  Best: ${bestName}`);
    } else {
      console.log(`  No strategies with 5+ trades`);
    }
  }

  // Print global ranking
  console.log("\n\n════════════════════════════════════════════════════════════════");
  console.log("                    GLOBAL RANKING (ALL SYMBOLS)");
  console.log("════════════════════════════════════════════════════════════════");

  // Convert light results back to EngineResult shape for printRankedResults
  const asEngineResults: EngineResult[] = topResults.map((r) => ({
    ...r,
    trades: [],
    equity: [],
  }));
  printRankedResults(asEngineResults, 30);

  // Per-segment ranking
  for (const segLabel of ["low-cap", "high-cap"]) {
    const segResults = asEngineResults.filter((r) => {
      const sym = r.strategyName.match(/\[(\w+)\]/)?.[1] || "";
      return getSegment(sym) === segLabel;
    });
    if (segResults.length > 0) {
      console.log(`\n── ${segLabel.toUpperCase()} RANKING ──`);
      printRankedResults(segResults, 15);
    }
  }

  // Helper to find strategy def from a light result
  function findStratDef(r: LightResult): StrategyDef | null {
    const sym = r.strategyName.match(/\[(\w+)\]/)?.[1];
    if (!sym) return null;
    const combos = getSegment(sym) === "high-cap" ? hcCombos : lcCombos;
    const tmplEntry = combos.find((t: { name: string }) => t.name === r.templateName);
    return tmplEntry ? tmplEntry.combos[r.strategyIdx] : null;
  }

  // Detailed top 5
  if (topResults.length > 0) {
    console.log("\n\n══ TOP 5 DETAILED ══");
    for (const r of topResults.slice(0, 5)) {
      const sym = r.strategyName.match(/\[(\w+)\]/)?.[1];
      const def = findStratDef(r);
      if (!sym || !def) continue;
      const candles = loadCandles(sym, "5");
      const indicators = computeIndicators(candles);
      const bars = candlesToBars(candles, indicators);
      const fullResult = runEngine(bars, def, SEGMENT_DEFAULTS[getSegment(sym)] || {});
      fullResult.strategyName = r.strategyName;
      printDetailedResult(fullResult);
    }
  }

  // Walk-forward on top 10
  if (doWF) {
    console.log("\n\n══ WALK-FORWARD VALIDATION (Top 10) ══");
    for (const r of topResults.slice(0, 10)) {
      const sym = r.strategyName.match(/\[(\w+)\]/)?.[1];
      const def = findStratDef(r);
      if (!sym || !def) continue;
      const candles = loadCandles(sym, "5");
      if (candles.length < 500) { console.log(`  ${r.strategyName}: too few candles for WF`); continue; }
      const indicators = computeIndicators(candles);
      const bars = candlesToBars(candles, indicators);
      const wf = walkForward(bars, def, SEGMENT_DEFAULTS[getSegment(sym)] || {});
      console.log(`  ${r.strategyName}: IS=${wf.inSample.sharpe.toFixed(2)} → OOS=${wf.outOfSample.sharpe.toFixed(2)} | Deg=${(wf.degradation * 100).toFixed(0)}% ${wf.isOverfit ? "OVERFIT" : "OK"}`);
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
