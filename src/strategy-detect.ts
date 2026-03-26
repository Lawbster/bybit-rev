import { loadCandles } from "./fetch-candles";
import { computeIndicators, getSnapshotAt, IndicatorSnapshot } from "./indicators";
import { loadAllXlsx } from "./parse-xlsx";
import { Trade } from "./types";
import * as ss from "simple-statistics";

function fmt(n: number, d = 2): string {
  return n.toFixed(d);
}

function formatTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

async function main() {
  const SYMBOL = process.argv[2] || "SIRENUSDT";

  // Load data
  const candles = loadCandles(SYMBOL, "5");
  if (candles.length === 0) {
    console.log(`No candle data found. Run: npx ts-node src/fetch-candles.ts ${SYMBOL} 5`);
    return;
  }
  console.log(`Loaded ${candles.length} candles for ${SYMBOL}\n`);

  // Compute indicators
  console.log("Computing indicators...");
  const indicators = computeIndicators(candles);
  console.log(`Indicator snapshots: ${indicators.size}\n`);

  // Load trades, filter to symbol
  const allTrades = loadAllXlsx();
  const symbolTrades = allTrades.filter((t) => t.symbol === SYMBOL);
  console.log(`${SYMBOL} trades: ${symbolTrades.length}\n`);

  const longs = symbolTrades.filter((t) => t.side === "Long");
  const shorts = symbolTrades.filter((t) => t.side === "Short");

  // Get indicator state at each entry
  console.log(`=== Indicator State at Each ${SYMBOL} Entry ===\n`);

  const longSnapshots: IndicatorSnapshot[] = [];
  const shortSnapshots: IndicatorSnapshot[] = [];

  for (const t of symbolTrades) {
    const snap = getSnapshotAt(indicators, t.openedAt.getTime());
    if (!snap) {
      console.log(`  ${formatTime(t.openedAt)} | ${t.side} | NO INDICATOR DATA`);
      continue;
    }

    if (t.side === "Long") longSnapshots.push(snap);
    else shortSnapshots.push(snap);

    console.log(
      `${formatTime(t.openedAt)} | ${t.side.padEnd(6)} | ` +
      `RSI: ${fmt(snap.rsi14)} | ` +
      `MACD: ${fmt(snap.macdHist, 6)} | ` +
      `StochK: ${fmt(snap.stochK)} | ` +
      `BB pos: ${fmt(snap.bbPosition)} | ` +
      `EMA trend: ${snap.emaTrend} | ` +
      `Vol ratio: ${fmt(snap.volumeRatio)} | ` +
      `ROC5: ${fmt(snap.roc5)}% | ` +
      `ATR%: ${fmt(snap.atrPercent)} | ` +
      `PnL: $${fmt(t.pnl, 4)}`
    );
  }

  // Statistical analysis
  function analyzeGroup(name: string, snapshots: IndicatorSnapshot[]) {
    if (snapshots.length < 2) {
      console.log(`\n${name}: Not enough data (${snapshots.length} entries)`);
      return;
    }

    console.log(`\n=== ${name} — ${snapshots.length} entries ===`);

    const fields: { key: keyof IndicatorSnapshot; label: string }[] = [
      { key: "rsi14", label: "RSI(14)" },
      { key: "macdHist", label: "MACD Hist" },
      { key: "stochK", label: "Stoch %K" },
      { key: "stochD", label: "Stoch %D" },
      { key: "williamsR", label: "Williams %R" },
      { key: "bbPosition", label: "BB Position (0=low,1=high)" },
      { key: "bbWidth", label: "BB Width %" },
      { key: "atrPercent", label: "ATR %" },
      { key: "volumeRatio", label: "Volume Ratio (vs 20avg)" },
      { key: "roc5", label: "ROC(5) %" },
      { key: "roc20", label: "ROC(20) %" },
      { key: "priceVsEma50", label: "Price vs EMA50 %" },
      { key: "priceChange5", label: "5-candle change %" },
      { key: "priceChange20", label: "20-candle change %" },
      { key: "candleBody", label: "Candle body %" },
    ];

    console.log(
      "Indicator".padEnd(30) +
      "Mean".padStart(10) +
      "Median".padStart(10) +
      "StdDev".padStart(10) +
      "Min".padStart(10) +
      "Max".padStart(10)
    );
    console.log("-".repeat(80));

    for (const f of fields) {
      const values = snapshots.map((s) => s[f.key] as number).filter((v) => !isNaN(v));
      if (values.length === 0) continue;

      console.log(
        f.label.padEnd(30) +
        fmt(ss.mean(values)).padStart(10) +
        fmt(ss.median(values)).padStart(10) +
        fmt(ss.standardDeviation(values)).padStart(10) +
        fmt(ss.min(values)).padStart(10) +
        fmt(ss.max(values)).padStart(10)
      );
    }

    // EMA trend distribution
    const trendCounts = { bull: 0, bear: 0, neutral: 0 };
    for (const s of snapshots) {
      trendCounts[s.emaTrend]++;
    }
    console.log(
      `\nEMA Trend: bull=${trendCounts.bull} bear=${trendCounts.bear} neutral=${trendCounts.neutral}`
    );
  }

  analyzeGroup("LONG Entries", longSnapshots);
  analyzeGroup("SHORT Entries", shortSnapshots);

  // Compare to random samples for significance
  console.log("\n=== Comparison: Entry Points vs Random Candles ===\n");

  const allSnapshots = [...indicators.values()];
  // Sample random snapshots for baseline
  const sampleSize = 1000;
  const randomSnapshots: IndicatorSnapshot[] = [];
  for (let i = 0; i < sampleSize; i++) {
    const idx = Math.floor(Math.random() * allSnapshots.length);
    randomSnapshots.push(allSnapshots[idx]);
  }

  const fields: { key: keyof IndicatorSnapshot; label: string }[] = [
    { key: "rsi14", label: "RSI(14)" },
    { key: "macdHist", label: "MACD Hist" },
    { key: "stochK", label: "Stoch %K" },
    { key: "bbPosition", label: "BB Position" },
    { key: "volumeRatio", label: "Volume Ratio" },
    { key: "roc5", label: "ROC(5) %" },
    { key: "atrPercent", label: "ATR %" },
    { key: "priceChange5", label: "5-candle chg %" },
  ];

  console.log(
    "Indicator".padEnd(20) +
    "Random Mean".padStart(12) +
    "Long Mean".padStart(12) +
    "Short Mean".padStart(12) +
    "Long Diff".padStart(12) +
    "Short Diff".padStart(12)
  );
  console.log("-".repeat(80));

  for (const f of fields) {
    const randVals = randomSnapshots.map((s) => s[f.key] as number).filter((v) => !isNaN(v));
    const longVals = longSnapshots.map((s) => s[f.key] as number).filter((v) => !isNaN(v));
    const shortVals = shortSnapshots.map((s) => s[f.key] as number).filter((v) => !isNaN(v));

    const randMean = ss.mean(randVals);
    const longMean = longVals.length > 0 ? ss.mean(longVals) : NaN;
    const shortMean = shortVals.length > 0 ? ss.mean(shortVals) : NaN;

    console.log(
      f.label.padEnd(20) +
      fmt(randMean).padStart(12) +
      (isNaN(longMean) ? "N/A" : fmt(longMean)).padStart(12) +
      (isNaN(shortMean) ? "N/A" : fmt(shortMean)).padStart(12) +
      (isNaN(longMean) ? "N/A" : fmt(longMean - randMean)).padStart(12) +
      (isNaN(shortMean) ? "N/A" : fmt(shortMean - randMean)).padStart(12)
    );
  }

  console.log("\nPositive diff = higher than random, negative = lower than random");
  console.log("Look for large deviations — those are the trader's edge signals");
}

main().catch(console.error);
