import { loadAllXlsx } from "./parse-xlsx";
import { loadCandles, Candle } from "./fetch-candles";
import { computeIndicators, getSnapshotAt, IndicatorSnapshot } from "./indicators";

const trades = loadAllXlsx().filter((t) => t.trader === "aristo");
console.log(`\n=== ARISTO ENTRY ANALYSIS — ${trades.length} trades against historical indicators ===\n`);

// Load candles and compute indicators for each symbol he trades
const symbolData = new Map<string, { candles: Candle[]; indicators: ReturnType<typeof computeIndicators> }>();

const symbols = [...new Set(trades.map((t) => t.symbol))];
for (const sym of symbols) {
  const candles = loadCandles(sym, "5");
  if (candles.length < 210) {
    console.log(`  ${sym}: only ${candles.length} candles, skipping (need 210+)`);
    continue;
  }
  const indicators = computeIndicators(candles);
  symbolData.set(sym, { candles, indicators });
  console.log(`  ${sym}: ${candles.length} candles, indicators computed`);
}

// Find closest candle to a timestamp
function findClosestCandle(candles: Candle[], targetMs: number): number {
  let best = 0;
  let bestDiff = Math.abs(candles[0].timestamp - targetMs);
  for (let i = 1; i < candles.length; i++) {
    const diff = Math.abs(candles[i].timestamp - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
    if (candles[i].timestamp > targetMs + 600000) break; // early exit
  }
  return best;
}

function fmt(n: number | undefined, d = 2): string {
  if (n === undefined || n === null) return "---";
  return n.toFixed(d);
}

interface EntryProfile {
  symbol: string;
  side: string;
  pnl: number;
  roiPct: number;
  leverage: number;
  holdHours: number;
  snap: IndicatorSnapshot;
  candleIdx: number;
  priceAtEntry: number;
  // candle context
  bar5mReturn: number; // return of the 5m candle at entry
  bar5mVolRatio: number;
}

const matched: EntryProfile[] = [];
let unmatched = 0;

for (const t of trades) {
  const data = symbolData.get(t.symbol);
  if (!data) { unmatched++; continue; }

  const idx = findClosestCandle(data.candles, t.openedAt.getTime());
  const candleTs = data.candles[idx].timestamp;
  const snap = getSnapshotAt(data.indicators, candleTs);
  if (!snap) { unmatched++; continue; }

  const candle = data.candles[idx];
  const bar5mReturn = ((candle.close - candle.open) / candle.open) * 100;

  // Volume ratio relative to 20-period average
  let avgVol = 0;
  const start = Math.max(0, idx - 20);
  for (let i = start; i < idx; i++) avgVol += data.candles[i].volume;
  avgVol /= Math.max(1, idx - start);
  const bar5mVolRatio = avgVol > 0 ? candle.volume / avgVol : 1;

  matched.push({
    symbol: t.symbol,
    side: t.side,
    pnl: t.pnl,
    roiPct: t.pnlPercent,
    leverage: t.leverage,
    holdHours: t.holdDurationMs / 3600000,
    snap,
    candleIdx: idx,
    priceAtEntry: t.entryPrice,
    bar5mReturn,
    bar5mVolRatio,
  });
}

console.log(`\nMatched: ${matched.length} / ${trades.length} (${unmatched} unmatched)\n`);

// ============== AGGREGATE STATS ==============
function stats(arr: number[]) {
  if (!arr.length) return { avg: 0, med: 0, min: 0, max: 0, std: 0, n: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
  const med = sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const variance = arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length;
  return { avg, med, min: sorted[0], max: sorted[sorted.length - 1], std: Math.sqrt(variance), n: arr.length };
}

function printStats(label: string, arr: number[], decimals = 2) {
  const s = stats(arr);
  if (!s.n) { console.log(`  ${label.padEnd(20)} no data`); return; }
  console.log(`  ${label.padEnd(20)} avg:${fmt(s.avg, decimals).padStart(10)}  med:${fmt(s.med, decimals).padStart(10)}  min:${fmt(s.min, decimals).padStart(10)}  max:${fmt(s.max, decimals).padStart(10)}  std:${fmt(s.std, decimals).padStart(10)}  n=${s.n}`);
}

// Split by side
const longs = matched.filter((m) => m.side === "Long");
const shorts = matched.filter((m) => m.side === "Short");

console.log("=" .repeat(110));
console.log(`ALL ENTRIES — ${matched.length} trades (${longs.length}L / ${shorts.length}S)`);
console.log("=".repeat(110));

console.log("\n[Indicators at Entry]");
printStats("rsi14", matched.map((m) => m.snap.rsi14));
printStats("stochK", matched.map((m) => m.snap.stochK));
printStats("stochD", matched.map((m) => m.snap.stochD));
printStats("bbPosition", matched.map((m) => m.snap.bbPosition));
printStats("bbWidth", matched.map((m) => m.snap.bbWidth));
printStats("atrPercent", matched.map((m) => m.snap.atrPercent));
printStats("volumeRatio", matched.map((m) => m.snap.volumeRatio));
printStats("roc5", matched.map((m) => m.snap.roc5));
printStats("roc20", matched.map((m) => m.snap.roc20));
printStats("macdHist", matched.map((m) => m.snap.macdHist), 4);
printStats("priceVsEma50", matched.map((m) => m.snap.priceVsEma50));

const trendCounts: Record<string, number> = {};
matched.forEach((m) => { trendCounts[m.snap.emaTrend] = (trendCounts[m.snap.emaTrend] || 0) + 1; });
const trendTotal = matched.length;
console.log(`  ${"emaTrend".padEnd(20)} ${Object.entries(trendCounts).map(([k, v]) => `${k}: ${v} (${((v / trendTotal) * 100).toFixed(0)}%)`).join(", ")}`);

console.log("\n[Candle Context at Entry]");
printStats("5m bar return%", matched.map((m) => m.bar5mReturn));
printStats("5m vol ratio", matched.map((m) => m.bar5mVolRatio));

console.log("\n[Trade Metrics]");
printStats("holdHours", matched.map((m) => m.holdHours), 1);
printStats("PnL ($)", matched.map((m) => m.pnl), 0);
printStats("ROI%", matched.map((m) => m.roiPct), 1);

// ============== LONG ENTRIES ==============
if (longs.length > 0) {
  console.log(`\n${"=".repeat(110)}`);
  console.log(`LONG ENTRIES — ${longs.length} trades`);
  console.log("=".repeat(110));

  console.log("\n[Indicators]");
  printStats("rsi14", longs.map((m) => m.snap.rsi14));
  printStats("stochK", longs.map((m) => m.snap.stochK));
  printStats("stochD", longs.map((m) => m.snap.stochD));
  printStats("bbPosition", longs.map((m) => m.snap.bbPosition));
  printStats("bbWidth", longs.map((m) => m.snap.bbWidth));
  printStats("atrPercent", longs.map((m) => m.snap.atrPercent));
  printStats("volumeRatio", longs.map((m) => m.snap.volumeRatio));
  printStats("roc5", longs.map((m) => m.snap.roc5));
  printStats("roc20", longs.map((m) => m.snap.roc20));
  printStats("macdHist", longs.map((m) => m.snap.macdHist), 4);
  printStats("priceVsEma50", longs.map((m) => m.snap.priceVsEma50));

  const lt: Record<string, number> = {};
  longs.forEach((m) => { lt[m.snap.emaTrend] = (lt[m.snap.emaTrend] || 0) + 1; });
  console.log(`  ${"emaTrend".padEnd(20)} ${Object.entries(lt).map(([k, v]) => `${k}: ${v} (${((v / longs.length) * 100).toFixed(0)}%)`).join(", ")}`);

  console.log("\n[Context]");
  printStats("5m bar return%", longs.map((m) => m.bar5mReturn));
  printStats("5m vol ratio", longs.map((m) => m.bar5mVolRatio));
  printStats("holdHours", longs.map((m) => m.holdHours), 1);
  printStats("ROI%", longs.map((m) => m.roiPct), 1);

  // Pattern checks
  console.log("\n[Long Entry Patterns]");
  const lRsiBelow40 = longs.filter((m) => m.snap.rsi14 < 40).length;
  const lRsiBelow50 = longs.filter((m) => m.snap.rsi14 < 50).length;
  const lStochBelow20 = longs.filter((m) => m.snap.stochK < 20).length;
  const lBbBelow03 = longs.filter((m) => m.snap.bbPosition < 0.3).length;
  const lBearTrend = longs.filter((m) => m.snap.emaTrend === "bear").length;
  const lBullTrend = longs.filter((m) => m.snap.emaTrend === "bull").length;
  const lNegRoc5 = longs.filter((m) => m.snap.roc5 < 0).length;
  const lBelowEma50 = longs.filter((m) => m.snap.priceVsEma50 < 0).length;
  const lHighAtr = longs.filter((m) => m.snap.atrPercent > 1.5).length;
  const lNegMacd = longs.filter((m) => m.snap.macdHist < 0).length;
  const pct = (n: number, d: number) => `${n}/${d} (${((n / d) * 100).toFixed(0)}%)`;
  console.log(`  RSI < 40:          ${pct(lRsiBelow40, longs.length)}`);
  console.log(`  RSI < 50:          ${pct(lRsiBelow50, longs.length)}`);
  console.log(`  StochK < 20:       ${pct(lStochBelow20, longs.length)}`);
  console.log(`  bbPos < 0.3:       ${pct(lBbBelow03, longs.length)}`);
  console.log(`  Bear trend:        ${pct(lBearTrend, longs.length)}`);
  console.log(`  Bull trend:        ${pct(lBullTrend, longs.length)}`);
  console.log(`  Negative roc5:     ${pct(lNegRoc5, longs.length)}`);
  console.log(`  Below EMA50:       ${pct(lBelowEma50, longs.length)}`);
  console.log(`  ATR% > 1.5:        ${pct(lHighAtr, longs.length)}`);
  console.log(`  MACD hist < 0:     ${pct(lNegMacd, longs.length)}`);
}

// ============== SHORT ENTRIES ==============
if (shorts.length > 0) {
  console.log(`\n${"=".repeat(110)}`);
  console.log(`SHORT ENTRIES — ${shorts.length} trades`);
  console.log("=".repeat(110));

  console.log("\n[Indicators]");
  printStats("rsi14", shorts.map((m) => m.snap.rsi14));
  printStats("stochK", shorts.map((m) => m.snap.stochK));
  printStats("stochD", shorts.map((m) => m.snap.stochD));
  printStats("bbPosition", shorts.map((m) => m.snap.bbPosition));
  printStats("bbWidth", shorts.map((m) => m.snap.bbWidth));
  printStats("atrPercent", shorts.map((m) => m.snap.atrPercent));
  printStats("volumeRatio", shorts.map((m) => m.snap.volumeRatio));
  printStats("roc5", shorts.map((m) => m.snap.roc5));
  printStats("roc20", shorts.map((m) => m.snap.roc20));
  printStats("macdHist", shorts.map((m) => m.snap.macdHist), 4);
  printStats("priceVsEma50", shorts.map((m) => m.snap.priceVsEma50));

  const st: Record<string, number> = {};
  shorts.forEach((m) => { st[m.snap.emaTrend] = (st[m.snap.emaTrend] || 0) + 1; });
  console.log(`  ${"emaTrend".padEnd(20)} ${Object.entries(st).map(([k, v]) => `${k}: ${v} (${((v / shorts.length) * 100).toFixed(0)}%)`).join(", ")}`);

  console.log("\n[Context]");
  printStats("5m bar return%", shorts.map((m) => m.bar5mReturn));
  printStats("5m vol ratio", shorts.map((m) => m.bar5mVolRatio));
  printStats("holdHours", shorts.map((m) => m.holdHours), 1);
  printStats("ROI%", shorts.map((m) => m.roiPct), 1);

  console.log("\n[Short Entry Patterns]");
  const sRsiAbove60 = shorts.filter((m) => m.snap.rsi14 > 60).length;
  const sRsiAbove50 = shorts.filter((m) => m.snap.rsi14 > 50).length;
  const sStochAbove80 = shorts.filter((m) => m.snap.stochK > 80).length;
  const sBbAbove07 = shorts.filter((m) => m.snap.bbPosition > 0.7).length;
  const sBearTrend = shorts.filter((m) => m.snap.emaTrend === "bear").length;
  const sBullTrend = shorts.filter((m) => m.snap.emaTrend === "bull").length;
  const sPosRoc5 = shorts.filter((m) => m.snap.roc5 > 0).length;
  const sAboveEma50 = shorts.filter((m) => m.snap.priceVsEma50 > 0).length;
  const sHighAtr = shorts.filter((m) => m.snap.atrPercent > 1.5).length;
  const sPosMacd = shorts.filter((m) => m.snap.macdHist > 0).length;
  const pct = (n: number, d: number) => `${n}/${d} (${((n / d) * 100).toFixed(0)}%)`;
  console.log(`  RSI > 60:          ${pct(sRsiAbove60, shorts.length)}`);
  console.log(`  RSI > 50:          ${pct(sRsiAbove50, shorts.length)}`);
  console.log(`  StochK > 80:       ${pct(sStochAbove80, shorts.length)}`);
  console.log(`  bbPos > 0.7:       ${pct(sBbAbove07, shorts.length)}`);
  console.log(`  Bear trend:        ${pct(sBearTrend, shorts.length)}`);
  console.log(`  Bull trend:        ${pct(sBullTrend, shorts.length)}`);
  console.log(`  Positive roc5:     ${pct(sPosRoc5, shorts.length)}`);
  console.log(`  Above EMA50:       ${pct(sAboveEma50, shorts.length)}`);
  console.log(`  ATR% > 1.5:        ${pct(sHighAtr, shorts.length)}`);
  console.log(`  MACD hist > 0:     ${pct(sPosMacd, shorts.length)}`);
}

// ============== PER-SYMBOL ==============
console.log(`\n${"=".repeat(110)}`);
console.log("PER-SYMBOL ENTRY PROFILES");
console.log("=".repeat(110));

for (const sym of ["ETHUSDT", "SOLUSDT"]) {
  const symTrades = matched.filter((m) => m.symbol === sym);
  if (!symTrades.length) continue;
  const symLongs = symTrades.filter((m) => m.side === "Long");
  const symShorts = symTrades.filter((m) => m.side === "Short");

  console.log(`\n  ${sym} — ${symTrades.length} trades (${symLongs.length}L / ${symShorts.length}S)`);

  if (symLongs.length > 0) {
    const s = stats(symLongs.map((m) => m.snap.rsi14));
    const sk = stats(symLongs.map((m) => m.snap.stochK));
    const bb = stats(symLongs.map((m) => m.snap.bbPosition));
    const atr = stats(symLongs.map((m) => m.snap.atrPercent));
    const ema = stats(symLongs.map((m) => m.snap.priceVsEma50));
    const roc = stats(symLongs.map((m) => m.snap.roc5));
    console.log(`    LONGS (${symLongs.length}): RSI avg:${fmt(s.avg)} med:${fmt(s.med)} | stK avg:${fmt(sk.avg)} | bbPos avg:${fmt(bb.avg)} | atr:${fmt(atr.avg)}% | vsEma50:${fmt(ema.avg)}% | roc5:${fmt(roc.avg)}%`);
  }
  if (symShorts.length > 0) {
    const s = stats(symShorts.map((m) => m.snap.rsi14));
    const sk = stats(symShorts.map((m) => m.snap.stochK));
    const bb = stats(symShorts.map((m) => m.snap.bbPosition));
    const atr = stats(symShorts.map((m) => m.snap.atrPercent));
    const ema = stats(symShorts.map((m) => m.snap.priceVsEma50));
    const roc = stats(symShorts.map((m) => m.snap.roc5));
    console.log(`    SHORTS (${symShorts.length}): RSI avg:${fmt(s.avg)} med:${fmt(s.med)} | stK avg:${fmt(sk.avg)} | bbPos avg:${fmt(bb.avg)} | atr:${fmt(atr.avg)}% | vsEma50:${fmt(ema.avg)}% | roc5:${fmt(roc.avg)}%`);
  }
}
