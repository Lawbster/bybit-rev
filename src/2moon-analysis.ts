import { loadAllXlsx } from "./parse-xlsx";
import { loadCandles, Candle } from "./fetch-candles";
import { computeIndicators, getSnapshotAt } from "./indicators";

const trades = loadAllXlsx().filter((t) => t.trader === "2moon");
console.log(`\n=== 2MOON ANALYSIS — ${trades.length} trades ===`);
console.log(`Symbols: ${[...new Set(trades.map((t) => t.symbol))].join(", ")}`);
console.log(`Sides: ${trades.filter((t) => t.side === "Long").length}L / ${trades.filter((t) => t.side === "Short").length}S`);
console.log(`Range: ${trades[0].openedAt.toISOString().slice(0, 10)} → ${trades[trades.length - 1].openedAt.toISOString().slice(0, 10)}`);
console.log(`Leverage: ${[...new Set(trades.map((t) => t.leverage + "x"))].join(", ")}`);
console.log(`WR: ${((trades.filter((t) => t.pnl > 0).length / trades.length) * 100).toFixed(1)}%`);
console.log(`Total PnL: $${trades.reduce((s, t) => s + t.pnl, 0).toFixed(2)}`);

// Hold time distribution
const holdHours = trades.map((t) => t.holdDurationMs / 3600000);
holdHours.sort((a, b) => a - b);
const medHold = holdHours[Math.floor(holdHours.length / 2)];
const avgHold = holdHours.reduce((s, v) => s + v, 0) / holdHours.length;
console.log(`Hold time: med ${medHold.toFixed(2)}h | avg ${avgHold.toFixed(2)}h | max ${holdHours[holdHours.length - 1].toFixed(1)}h`);

// ROI distribution
const rois = trades.map((t) => t.pnlPercent);
rois.sort((a, b) => a - b);
console.log(`ROI%: med ${rois[Math.floor(rois.length / 2)].toFixed(1)} | avg ${(rois.reduce((s, v) => s + v, 0) / rois.length).toFixed(1)} | min ${rois[0].toFixed(1)} | max ${rois[rois.length - 1].toFixed(1)}`);

// Unlevered move at TP
const moves = trades.map((t) => ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100);
moves.sort((a, b) => a - b);
const medMove = moves[Math.floor(moves.length / 2)];
console.log(`\nUnlevered TP move%: med ${medMove.toFixed(3)} | avg ${(moves.reduce((s, v) => s + v, 0) / moves.length).toFixed(3)}`);

// Cluster TP moves
const buckets: Record<string, number> = {};
for (const m of moves) {
  const b = (Math.round(m * 10) / 10).toFixed(1);
  buckets[b] = (buckets[b] || 0) + 1;
}
console.log("\nTP move% distribution (top 10):");
Object.entries(buckets)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([k, v]) => console.log(`  ${k}%: ${v} trades (${((v / trades.length) * 100).toFixed(1)}%)`));

// Entry price clustering
const entryPrices = trades.map((t) => t.entryPrice);
const priceFreq: Record<string, number> = {};
for (const p of entryPrices) {
  priceFreq[p.toString()] = (priceFreq[p.toString()] || 0) + 1;
}
const topPrices = Object.entries(priceFreq).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log("\nMost repeated entry prices:");
topPrices.forEach(([p, n]) => console.log(`  $${p}: ${n} trades`));

// Batch close detection — trades closing at exact same timestamp
const closeTimes: Record<string, number> = {};
for (const t of trades) {
  const key = t.closedAt.getTime().toString();
  closeTimes[key] = (closeTimes[key] || 0) + 1;
}
const batchCloses = Object.entries(closeTimes).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
console.log(`\nBatch closes (same timestamp): ${batchCloses.length} batches`);
batchCloses.slice(0, 10).forEach(([ts, n]) => {
  const d = new Date(Number(ts)).toISOString().slice(0, 16);
  console.log(`  ${d}: ${n} trades closed together`);
});

// Entry spacing — time between consecutive entries
const sorted = [...trades].sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
const gaps: number[] = [];
for (let i = 1; i < sorted.length; i++) {
  gaps.push((sorted[i].openedAt.getTime() - sorted[i - 1].openedAt.getTime()) / 60000);
}
gaps.sort((a, b) => a - b);
console.log(`\nEntry spacing (minutes): med ${gaps[Math.floor(gaps.length / 2)].toFixed(0)} | avg ${(gaps.reduce((s, v) => s + v, 0) / gaps.length).toFixed(0)} | min ${gaps[0].toFixed(1)} | max ${gaps[gaps.length - 1].toFixed(0)}`);

// Max concurrent positions
let maxConcurrent = 0;
const events: { time: number; delta: number }[] = [];
for (const t of trades) {
  events.push({ time: t.openedAt.getTime(), delta: 1 });
  events.push({ time: t.closedAt.getTime(), delta: -1 });
}
events.sort((a, b) => a.time - b.time || a.delta - b.delta);
let concurrent = 0;
for (const e of events) {
  concurrent += e.delta;
  if (concurrent > maxConcurrent) maxConcurrent = concurrent;
}
console.log(`Max concurrent positions: ${maxConcurrent}`);

// Average concurrent at entry
const concurrentAtEntry: number[] = [];
for (const t of trades) {
  const openTime = t.openedAt.getTime();
  let count = 0;
  for (const other of trades) {
    if (other.openedAt.getTime() <= openTime && other.closedAt.getTime() > openTime) count++;
  }
  concurrentAtEntry.push(count);
}
concurrentAtEntry.sort((a, b) => a - b);
console.log(`Concurrent at entry: med ${concurrentAtEntry[Math.floor(concurrentAtEntry.length / 2)]} | avg ${(concurrentAtEntry.reduce((s, v) => s + v, 0) / concurrentAtEntry.length).toFixed(1)} | max ${concurrentAtEntry[concurrentAtEntry.length - 1]}`);

// Match to historical candle indicators
console.log(`\n${"=".repeat(90)}`);
console.log("INDICATOR STATE AT ENTRY");
console.log("=".repeat(90));

const candles = loadCandles("HYPEUSDT", "5");
if (candles.length >= 210) {
  const indicators = computeIndicators(candles);
  console.log(`HYPEUSDT: ${candles.length} candles loaded`);

  let matched = 0;
  const rsi: number[] = [], stK: number[] = [], bbPos: number[] = [], atr: number[] = [];
  const roc5: number[] = [], roc20: number[] = [], vsEma: number[] = [], volR: number[] = [];
  const trends: Record<string, number> = {};

  for (const t of trades) {
    // Binary search for closest candle
    const target = t.openedAt.getTime();
    let lo = 0, hi = candles.length - 1, best = 0, bestDiff = Infinity;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const diff = Math.abs(candles[mid].timestamp - target);
      if (diff < bestDiff) { bestDiff = diff; best = mid; }
      if (candles[mid].timestamp < target) lo = mid + 1;
      else hi = mid - 1;
    }
    const snap = getSnapshotAt(indicators, candles[best].timestamp);
    if (!snap) continue;
    matched++;
    rsi.push(snap.rsi14);
    stK.push(snap.stochK);
    bbPos.push(snap.bbPosition);
    atr.push(snap.atrPercent);
    roc5.push(snap.roc5);
    roc20.push(snap.roc20);
    vsEma.push(snap.priceVsEma50);
    volR.push(snap.volumeRatio);
    trends[snap.emaTrend] = (trends[snap.emaTrend] || 0) + 1;
  }

  console.log(`Matched: ${matched}/${trades.length}\n`);

  const med = (arr: number[]) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const pct = (arr: number[], fn: (v: number) => boolean) => `${arr.filter(fn).length}/${arr.length} (${((arr.filter(fn).length / arr.length) * 100).toFixed(0)}%)`;

  console.log(`  RSI:         med ${med(rsi).toFixed(1)}  avg ${avg(rsi).toFixed(1)}  | <40: ${pct(rsi, v => v < 40)} | <50: ${pct(rsi, v => v < 50)} | >60: ${pct(rsi, v => v > 60)}`);
  console.log(`  StochK:      med ${med(stK).toFixed(1)}  avg ${avg(stK).toFixed(1)}  | <20: ${pct(stK, v => v < 20)} | <50: ${pct(stK, v => v < 50)}`);
  console.log(`  bbPos:       med ${med(bbPos).toFixed(2)}  avg ${avg(bbPos).toFixed(2)}  | <0.3: ${pct(bbPos, v => v < 0.3)} | <0.5: ${pct(bbPos, v => v < 0.5)}`);
  console.log(`  ATR%:        med ${med(atr).toFixed(2)}  avg ${avg(atr).toFixed(2)}  | >2: ${pct(atr, v => v > 2)} | >1.5: ${pct(atr, v => v > 1.5)}`);
  console.log(`  ROC5:        med ${med(roc5).toFixed(2)}  avg ${avg(roc5).toFixed(2)}  | <0: ${pct(roc5, v => v < 0)}`);
  console.log(`  ROC20:       med ${med(roc20).toFixed(2)}  avg ${avg(roc20).toFixed(2)}  | <0: ${pct(roc20, v => v < 0)}`);
  console.log(`  vsEMA50:     med ${med(vsEma).toFixed(2)}  avg ${avg(vsEma).toFixed(2)}  | <0: ${pct(vsEma, v => v < 0)}`);
  console.log(`  volRatio:    med ${med(volR).toFixed(2)}  avg ${avg(volR).toFixed(2)}`);
  console.log(`  emaTrend:    ${Object.entries(trends).map(([k, v]) => `${k}: ${v} (${((v / matched) * 100).toFixed(0)}%)`).join(", ")}`);
} else {
  console.log("Not enough HYPE candle data for indicator matching");
}

// Chronological sample — show entry laddering
console.log(`\n${"=".repeat(90)}`);
console.log("SAMPLE: 30 consecutive trades from middle of dataset");
console.log("=".repeat(90));
const mid = Math.floor(sorted.length / 2) - 15;
for (let i = mid; i < mid + 30 && i < sorted.length; i++) {
  const t = sorted[i];
  const hold = (t.holdDurationMs / 3600000).toFixed(1);
  const move = (((t.exitPrice - t.entryPrice) / t.entryPrice) * 100).toFixed(2);
  console.log(`  ${t.openedAt.toISOString().slice(0, 16)} → ${t.closedAt.toISOString().slice(0, 16)}  @${String(t.entryPrice).padEnd(8)} → @${String(t.exitPrice).padEnd(8)} +${move}% hold:${hold.padStart(5)}h  ROI:+${t.pnlPercent.toFixed(0)}%`);
}
