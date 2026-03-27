/**
 * WebSocket JSONL replay backtester — runs OB/flow-aware strategies against collected market data.
 *
 * Usage:
 *   npm run backtest:ws                     # all symbols with JSONL data
 *   npm run backtest:ws -- SIRENUSDT        # single symbol
 *   npm run backtest:ws -- --walkforward    # with walk-forward validation
 */
import fs from "fs";
import path from "path";
import {
  BarSnapshot, StrategyTemplate, StrategyDef, ExitConfig,
  generateCombos, jsonlToBars, runEngine, runEngineFast, precomputeConditions,
  walkForward, printRankedResults, printDetailedResult, getSegment, SEGMENT_DEFAULTS,
  EngineResult,
} from "./backtest-engine";

const DATA_DIR = path.resolve(__dirname, "../data");

// ── Exit configs ────────────────────────────────────────────────────────

const EXIT_CONFIGS: ExitConfig[] = [
  { slAtr: 1.5, tpAtr: 0.75 },
  { slAtr: 1.5, tpAtr: 1.5 },
  { slAtr: 1.5, tpAtr: 3.0 },
  { slAtr: 1.5, tpAtr: 2.0, trailingActivateAtr: 1.0, trailingDistAtr: 0.8 },
  { slAtr: 2.0, tpAtr: 3.0, maxHoldBars: 60 },
];

// ── WS-aware strategy templates (use orderbook + flow fields) ───────────

const WS_TEMPLATES: StrategyTemplate[] = [
  // 1. Orderbook manipulation short (copy trader pattern)
  //    Thin ask side + bid wall = about to dump
  {
    name: "ob-manip-short",
    longRanges: [
      { field: "obAskDepth", op: "<", values: [500, 1000, 2000] },
      { field: "obBidWall", op: ">", values: [2, 3, 5] },
      { field: "rsi", op: ">", values: [50, 55, 60] },
      { field: "flowBuyRatio", op: ">", values: [0.6, 0.7] },
    ],
    shortRanges: [
      { field: "obAskDepth", op: "<", values: [500, 1000, 2000] },
      { field: "obBidWall", op: ">", values: [2, 3, 5] },
      { field: "rsi", op: ">", values: [50, 55, 60] },
      { field: "flowBuyRatio", op: ">", values: [0.6, 0.7] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 2. Thin bid catch long — empty bid side after dump, reversal incoming
  {
    name: "thin-bid-long",
    longRanges: [
      { field: "obBidDepth", op: "<", values: [500, 1000, 2000] },
      { field: "rsi", op: "<", values: [30, 35, 40] },
      { field: "roc5", op: "<", values: [-3, -5, -8] },
      { field: "flowBuyRatio", op: "<", values: [0.3, 0.4] },
    ],
    shortRanges: [
      { field: "obAskDepth", op: "<", values: [500, 1000, 2000] },
      { field: "rsi", op: ">", values: [60, 65, 70] },
      { field: "roc5", op: ">", values: [3, 5, 8] },
      { field: "flowBuyRatio", op: ">", values: [0.6, 0.7] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 3. Imbalance flip — orderbook shifts from one side to other
  {
    name: "ob-imbalance",
    longRanges: [
      { field: "obImbalance", op: "<", values: [-0.3, -0.4, -0.5] },
      { field: "rsi", op: "<", values: [35, 40, 45] },
      { field: "bbPos", op: "<", values: [0.2, 0.3] },
      { field: "volRatio", op: "<", values: [0.5, 0.8] },
    ],
    shortRanges: [
      { field: "obImbalance", op: ">", values: [0.3, 0.4, 0.5] },
      { field: "rsi", op: ">", values: [55, 60, 65] },
      { field: "bbPos", op: ">", values: [0.7, 0.8] },
      { field: "volRatio", op: "<", values: [0.5, 0.8] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 4. Flow divergence — price up but sell flow dominant (or vice versa)
  {
    name: "flow-divergence",
    longRanges: [
      { field: "roc5", op: "<", values: [-2, -3, -5] },
      { field: "flowBuyRatio", op: ">", values: [0.55, 0.6, 0.65] },
      { field: "rsi", op: "<", values: [40, 45] },
      { field: "obImbalance", op: "<", values: [-0.1, -0.2] },
    ],
    shortRanges: [
      { field: "roc5", op: ">", values: [2, 3, 5] },
      { field: "flowBuyRatio", op: "<", values: [0.35, 0.4, 0.45] },
      { field: "rsi", op: ">", values: [55, 60] },
      { field: "obImbalance", op: ">", values: [0.1, 0.2] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 5. Spread + volatility spike — wide spread with low volume = illiquid move
  {
    name: "spread-vol-spike",
    longRanges: [
      { field: "obSpread", op: ">", values: [0.3, 0.5, 0.8] },
      { field: "atrPct", op: ">", values: [3, 4, 5] },
      { field: "rsi", op: "<", values: [30, 35] },
      { field: "volRatio", op: "<", values: [0.3, 0.5] },
    ],
    shortRanges: [
      { field: "obSpread", op: ">", values: [0.3, 0.5, 0.8] },
      { field: "atrPct", op: ">", values: [3, 4, 5] },
      { field: "rsi", op: ">", values: [65, 70] },
      { field: "volRatio", op: "<", values: [0.3, 0.5] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 6. Wall spoof detection — large wall with no follow-through volume
  {
    name: "wall-spoof",
    longRanges: [
      { field: "obAskWall", op: ">", values: [3, 5, 8] },
      { field: "flowSellVol", op: "<", values: [5000, 10000, 20000] },
      { field: "rsi", op: "<", values: [40, 45, 50] },
      { field: "roc5", op: "<", values: [-1, -2] },
    ],
    shortRanges: [
      { field: "obBidWall", op: ">", values: [3, 5, 8] },
      { field: "flowBuyVol", op: "<", values: [5000, 10000, 20000] },
      { field: "rsi", op: ">", values: [50, 55, 60] },
      { field: "roc5", op: ">", values: [1, 2] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 7. Combined: OB + indicator mean reversion
  {
    name: "ob-mean-revert",
    longRanges: [
      { field: "rsi", op: "<", values: [25, 30, 35] },
      { field: "bbPos", op: "<", values: [0.05, 0.1, 0.2] },
      { field: "obImbalance", op: "<", values: [-0.2, -0.3] },
      { field: "atrPct", op: ">", values: [2, 3, 4] },
    ],
    shortRanges: [
      { field: "rsi", op: ">", values: [65, 70, 75] },
      { field: "bbPos", op: ">", values: [0.8, 0.9, 0.95] },
      { field: "obImbalance", op: ">", values: [0.2, 0.3] },
      { field: "atrPct", op: ">", values: [2, 3, 4] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },

  // 8. Funding rate + OI divergence (if available)
  {
    name: "funding-oi",
    longRanges: [
      { field: "fundingRate", op: "<", values: [-0.0005, -0.001] },
      { field: "rsi", op: "<", values: [35, 40] },
      { field: "obImbalance", op: "<", values: [-0.2, -0.3] },
      { field: "roc5", op: "<", values: [-2, -3] },
    ],
    shortRanges: [
      { field: "fundingRate", op: ">", values: [0.0005, 0.001] },
      { field: "rsi", op: ">", values: [60, 65] },
      { field: "obImbalance", op: ">", values: [0.2, 0.3] },
      { field: "roc5", op: ">", values: [2, 3] },
    ],
    minScoreRange: [3, 4],
    exitRange: EXIT_CONFIGS,
  },
];

// ── Symbols ─────────────────────────────────────────────────────────────

const LOW_CAP = ["SIRENUSDT", "PIPPINUSDT", "LIGHTUSDT", "CUSDT", "RIVERUSDT", "VVVUSDT", "DUSKUSDT", "BLUAIUSDT", "STGUSDT"];
const HIGH_CAP = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "SUIUSDT"];
const ALL_SYMBOLS = [...LOW_CAP, ...HIGH_CAP];

function loadJsonlBars(symbol: string): BarSnapshot[] {
  const filepath = path.join(DATA_DIR, `${symbol}_market.jsonl`);
  if (!fs.existsSync(filepath)) return [];
  const lines = fs.readFileSync(filepath, "utf-8").trim().split("\n").filter(Boolean);
  return jsonlToBars(lines);
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const doWF = args.includes("--walkforward") || args.includes("--wf");
  const symbolArgs = args.filter((a) => !a.startsWith("--"));
  const symbols = symbolArgs.length > 0 ? symbolArgs : ALL_SYMBOLS;

  console.log("\n=== WEBSOCKET REPLAY BACKTESTER ===");
  console.log(`Symbols: ${symbols.join(", ")}`);
  console.log(`Templates: ${WS_TEMPLATES.length} | Exit configs: ${EXIT_CONFIGS.length}`);
  console.log(`Walk-forward: ${doWF ? "ON" : "OFF (use --walkforward to enable)"}\n`);

  // Generate combos
  let totalCombos = 0;
  const allStrategies: StrategyDef[] = [];
  for (const tmpl of WS_TEMPLATES) {
    const combos = generateCombos(tmpl);
    allStrategies.push(...combos);
    console.log(`  ${tmpl.name}: ${combos.length} combinations`);
    totalCombos += combos.length;
  }
  console.log(`  TOTAL: ${totalCombos} strategy variants\n`);

  const allResults: EngineResult[] = [];

  for (const symbol of symbols) {
    const segment = getSegment(symbol);
    const segOpts = SEGMENT_DEFAULTS[segment] || {};

    console.log(`\n── ${symbol} (${segment}) ──`);

    const bars = loadJsonlBars(symbol);
    if (bars.length < 30) {
      console.log(`  Skipping: only ${bars.length} bars (need 30+). Collect more WS data.`);
      continue;
    }

    const firstTs = new Date(bars[0].ts).toISOString().slice(0, 19);
    const lastTs = new Date(bars[bars.length - 1].ts).toISOString().slice(0, 19);
    console.log(`  Bars: ${bars.length} (${firstTs} → ${lastTs})`);

    // Check OB data availability
    const withOB = bars.filter((b) => b.obImbalance !== undefined).length;
    const withFlow = bars.filter((b) => b.flowBuyVol !== undefined && b.flowBuyVol > 0).length;
    const withFunding = bars.filter((b) => b.fundingRate !== undefined).length;
    console.log(`  OB data: ${withOB}/${bars.length} | Flow: ${withFlow}/${bars.length} | Funding: ${withFunding}/${bars.length}`);

    // Pre-compute conditions for fast batch runs
    const cache = precomputeConditions(bars, allStrategies);

    // Run all strategies
    let bestResult: EngineResult | null = null;
    let tested = 0;

    for (const strategy of allStrategies) {
      const result = runEngineFast(bars, strategy, cache, segOpts);
      result.strategyName = `${strategy.name}[${symbol}]`;
      allResults.push(result);

      if (result.totalTrades >= 3 && (!bestResult || result.composite > bestResult.composite)) {
        bestResult = result;
      }
      tested++;
    }

    console.log(`  Tested: ${tested} strategies`);

    if (bestResult) {
      console.log(`  Best: ${bestResult.strategyName} — ${bestResult.totalTrades} trades, PnL $${bestResult.totalPnl.toFixed(2)}, Sharpe ${bestResult.sharpe.toFixed(2)}, Score ${bestResult.composite.toFixed(3)}`);
    } else {
      console.log(`  No strategies with 3+ trades (need more data)`);
    }
  }

  // Global ranking (lower min trades for WS since less data)
  console.log("\n\n════════════════════════════════════════════════════════════════");
  console.log("                  GLOBAL RANKING (WS REPLAY)");
  console.log("════════════════════════════════════════════════════════════════");

  const wsQualified = allResults.filter((r) => r.totalTrades >= 3);
  if (wsQualified.length > 0) {
    wsQualified.sort((a, b) => b.composite - a.composite);
    printRankedResults(allResults, 30);
  } else {
    console.log("\n  No strategies qualified (need 3+ trades). Collect more WS data.\n");
  }

  // Per-segment
  for (const segLabel of ["low-cap", "high-cap"]) {
    const segResults = allResults.filter((r) => {
      const sym = r.strategyName.match(/\[(\w+)\]/)?.[1] || "";
      return getSegment(sym) === segLabel;
    });
    const segQualified = segResults.filter((r) => r.totalTrades >= 3);
    if (segQualified.length > 0) {
      console.log(`\n── ${segLabel.toUpperCase()} RANKING ──`);
      printRankedResults(segResults, 15);
    }
  }

  // Detailed top 5
  if (wsQualified.length > 0) {
    console.log("\n\n══ TOP 5 DETAILED ══");
    for (const r of wsQualified.slice(0, 5)) {
      printDetailedResult(r);
    }
  }

  // Walk-forward if enough data
  if (doWF && wsQualified.length > 0) {
    console.log("\n\n══ WALK-FORWARD VALIDATION (Top 5) ══");
    for (const r of wsQualified.slice(0, 5)) {
      const sym = r.strategyName.match(/\[(\w+)\]/)?.[1];
      if (!sym) continue;
      const bars = loadJsonlBars(sym);
      if (bars.length < 200) { console.log(`  ${r.strategyName}: too few bars for WF`); continue; }

      const stratName = r.strategyName.replace(/\[.*\]/, "");
      const matchingDefs = allStrategies.filter((s) => s.name === stratName);
      for (const def of matchingDefs) {
        const check = runEngine(bars, def, SEGMENT_DEFAULTS[getSegment(sym)] || {});
        if (check.totalTrades === r.totalTrades && Math.abs(check.totalPnl - r.totalPnl) < 0.01) {
          const wf = walkForward(bars, def, SEGMENT_DEFAULTS[getSegment(sym)] || {});
          console.log(`  ${r.strategyName}: IS=${wf.inSample.sharpe.toFixed(2)} → OOS=${wf.outOfSample.sharpe.toFixed(2)} | Deg=${(wf.degradation * 100).toFixed(0)}% ${wf.isOverfit ? "OVERFIT" : "OK"}`);
          break;
        }
      }
    }
  }

  console.log("\nDone. Collect more WS data for better results (aim for 2+ weeks).");
}

main().catch(console.error);
