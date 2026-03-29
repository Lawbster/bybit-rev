import { loadAllXlsx } from "./parse-xlsx";
import { loadCandles, Candle } from "./fetch-candles";

const trades = loadAllXlsx().filter((t) => t.trader === "2moon");
const candles = loadCandles("HYPEUSDT", "5");

console.log(`\n=== 2MOON ORDERBOOK FOOTPRINT ANALYSIS ===`);
console.log(`Trades: ${trades.length} | Candles: ${candles.length}`);
console.log(`Candle range: ${new Date(candles[0].timestamp).toISOString().slice(0, 10)} → ${new Date(candles[candles.length - 1].timestamp).toISOString().slice(0, 10)}`);

// AUM context
const AUM = 223253; // from profile
const FOLLOWERS = 239;
console.log(`\nAUM: $${AUM.toLocaleString()} | Followers: ${FOLLOWERS}`);
console.log(`If avg copy ratio ~1x on his notional, each $80 trade triggers ~$223k in copy orders`);

// Build candle lookup by timestamp
const candleMap = new Map<number, Candle>();
for (const c of candles) candleMap.set(c.timestamp, c);

// For each candle, compute baseline volume stats
const volumes = candles.map(c => c.volume);
volumes.sort((a, b) => a - b);
const medVol = volumes[Math.floor(volumes.length / 2)];
const avgVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;
console.log(`\n5m candle volume: med ${medVol.toFixed(0)} | avg ${avgVol.toFixed(0)}`);

// Find the candle that contains each trade's entry/exit
function findCandle(ts: number): Candle | null {
  // 5m candles, find the one containing this timestamp
  // Candle timestamp is the open time, so ts should be >= candle.timestamp and < candle.timestamp + 300000
  let lo = 0, hi = candles.length - 1, best = -1, bestDiff = Infinity;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const diff = Math.abs(candles[mid].timestamp - ts);
    if (diff < bestDiff) { bestDiff = diff; best = mid; }
    if (candles[mid].timestamp < ts) lo = mid + 1;
    else hi = mid - 1;
  }
  return bestDiff < 300000 ? candles[best] : null;
}

// Analyze volume on entry candles vs surrounding candles
const entryVolRatios: number[] = [];
const exitVolRatios: number[] = [];
const entryPriceImpacts: number[] = [];
const exitPriceImpacts: number[] = [];

// Track entry candle volumes
const entryCandles: { trade: typeof trades[0]; candle: Candle; prevCandle: Candle | null; nextCandle: Candle | null }[] = [];

for (const t of trades) {
  const entryCandle = findCandle(t.openedAt.getTime());
  if (!entryCandle) continue;

  // Find the candle index
  const idx = candles.indexOf(entryCandle);
  if (idx < 5 || idx > candles.length - 5) continue;

  // Surrounding volume (5 candles before and after, excluding entry candle)
  const surroundingVols: number[] = [];
  for (let j = idx - 5; j < idx; j++) surroundingVols.push(candles[j].volume);
  for (let j = idx + 1; j <= idx + 5; j++) surroundingVols.push(candles[j].volume);
  const avgSurrounding = surroundingVols.reduce((s, v) => s + v, 0) / surroundingVols.length;

  if (avgSurrounding > 0) {
    entryVolRatios.push(entryCandle.volume / avgSurrounding);
  }

  // Price impact: how much did the candle move in the direction of the trade?
  // For longs: (close - open) / open as % — positive means price went up (in our favor as buyer impact)
  const priceMove = ((entryCandle.close - entryCandle.open) / entryCandle.open) * 100;
  entryPriceImpacts.push(priceMove);

  entryCandles.push({
    trade: t,
    candle: entryCandle,
    prevCandle: candles[idx - 1] || null,
    nextCandle: candles[idx + 1] || null,
  });
}

// Same for exits — batch closes should have even bigger footprint
const exitTimestamps = new Map<number, number>(); // ts → count
for (const t of trades) {
  const roundedTs = Math.round(t.closedAt.getTime() / 300000) * 300000; // round to 5m
  exitTimestamps.set(roundedTs, (exitTimestamps.get(roundedTs) || 0) + 1);
}

const batchExits: { ts: number; count: number; candle: Candle | null }[] = [];
for (const [ts, count] of exitTimestamps) {
  if (count >= 2) {
    batchExits.push({ ts, count, candle: findCandle(ts) });
  }
}
batchExits.sort((a, b) => b.count - a.count);

for (const b of batchExits) {
  if (!b.candle) continue;
  const idx = candles.indexOf(b.candle);
  if (idx < 5 || idx > candles.length - 5) continue;
  const surroundingVols: number[] = [];
  for (let j = idx - 5; j < idx; j++) surroundingVols.push(candles[j].volume);
  for (let j = idx + 1; j <= idx + 5; j++) surroundingVols.push(candles[j].volume);
  const avgSurrounding = surroundingVols.reduce((s, v) => s + v, 0) / surroundingVols.length;
  if (avgSurrounding > 0) {
    exitVolRatios.push(b.candle.volume / avgSurrounding);
  }
  const priceMove = ((b.candle.close - b.candle.open) / b.candle.open) * 100;
  exitPriceImpacts.push(priceMove);
}

// Results
console.log(`\n${"=".repeat(70)}`);
console.log("ENTRY FOOTPRINT (volume on entry candle vs surrounding 10 candles)");
console.log("=".repeat(70));
entryVolRatios.sort((a, b) => a - b);
const medEntryRatio = entryVolRatios[Math.floor(entryVolRatios.length / 2)];
const avgEntryRatio = entryVolRatios.reduce((s, v) => s + v, 0) / entryVolRatios.length;
console.log(`Matched entries: ${entryVolRatios.length}`);
console.log(`Volume ratio (entry candle / surrounding avg):`);
console.log(`  Median: ${medEntryRatio.toFixed(2)}x`);
console.log(`  Average: ${avgEntryRatio.toFixed(2)}x`);
console.log(`  >1.5x: ${entryVolRatios.filter(v => v > 1.5).length} (${((entryVolRatios.filter(v => v > 1.5).length / entryVolRatios.length) * 100).toFixed(0)}%)`);
console.log(`  >2.0x: ${entryVolRatios.filter(v => v > 2.0).length} (${((entryVolRatios.filter(v => v > 2.0).length / entryVolRatios.length) * 100).toFixed(0)}%)`);
console.log(`  >3.0x: ${entryVolRatios.filter(v => v > 3.0).length} (${((entryVolRatios.filter(v => v > 3.0).length / entryVolRatios.length) * 100).toFixed(0)}%)`);

entryPriceImpacts.sort((a, b) => a - b);
const medPriceImpact = entryPriceImpacts[Math.floor(entryPriceImpacts.length / 2)];
console.log(`\nPrice impact on entry candle (long = positive means up):`);
console.log(`  Median: ${medPriceImpact.toFixed(4)}%`);
console.log(`  Avg: ${(entryPriceImpacts.reduce((s, v) => s + v, 0) / entryPriceImpacts.length).toFixed(4)}%`);
console.log(`  Positive (up): ${entryPriceImpacts.filter(v => v > 0).length} (${((entryPriceImpacts.filter(v => v > 0).length / entryPriceImpacts.length) * 100).toFixed(0)}%)`);

console.log(`\n${"=".repeat(70)}`);
console.log("BATCH EXIT FOOTPRINT");
console.log("=".repeat(70));
exitVolRatios.sort((a, b) => a - b);
if (exitVolRatios.length > 0) {
  const medExitRatio = exitVolRatios[Math.floor(exitVolRatios.length / 2)];
  const avgExitRatio = exitVolRatios.reduce((s, v) => s + v, 0) / exitVolRatios.length;
  console.log(`Matched batch exits: ${exitVolRatios.length} (out of ${batchExits.length} batches)`);
  console.log(`Volume ratio (exit candle / surrounding avg):`);
  console.log(`  Median: ${medExitRatio.toFixed(2)}x`);
  console.log(`  Average: ${avgExitRatio.toFixed(2)}x`);
  console.log(`  >1.5x: ${exitVolRatios.filter(v => v > 1.5).length} (${((exitVolRatios.filter(v => v > 1.5).length / exitVolRatios.length) * 100).toFixed(0)}%)`);
  console.log(`  >2.0x: ${exitVolRatios.filter(v => v > 2.0).length} (${((exitVolRatios.filter(v => v > 2.0).length / exitVolRatios.length) * 100).toFixed(0)}%)`);

  exitPriceImpacts.sort((a, b) => a - b);
  console.log(`\nPrice impact on exit candle (sells = expect negative):`);
  console.log(`  Median: ${exitPriceImpacts[Math.floor(exitPriceImpacts.length / 2)].toFixed(4)}%`);
  console.log(`  Avg: ${(exitPriceImpacts.reduce((s, v) => s + v, 0) / exitPriceImpacts.length).toFixed(4)}%`);
  console.log(`  Negative (down): ${exitPriceImpacts.filter(v => v < 0).length} (${((exitPriceImpacts.filter(v => v < 0).length / exitPriceImpacts.length) * 100).toFixed(0)}%)`);
}

// Show top 15 batch exits with volume context
console.log(`\n${"=".repeat(70)}`);
console.log("TOP BATCH EXITS (by size) — volume and price context");
console.log("=".repeat(70));
for (const b of batchExits.slice(0, 15)) {
  if (!b.candle) continue;
  const idx = candles.indexOf(b.candle);
  if (idx < 3) continue;
  const prevVol = candles[idx - 1].volume;
  const priceMove = ((b.candle.close - b.candle.open) / b.candle.open) * 100;
  const volRatio = prevVol > 0 ? (b.candle.volume / prevVol).toFixed(1) : "?";
  console.log(`  ${new Date(b.ts).toISOString().slice(0, 16)} | ${b.count} trades closed | vol: ${b.candle.volume.toFixed(0)} (${volRatio}x prev) | move: ${priceMove > 0 ? "+" : ""}${priceMove.toFixed(3)}%`);
}

// Show sample entries with next-candle behavior (does price continue up after entry?)
console.log(`\n${"=".repeat(70)}`);
console.log("ENTRY → NEXT CANDLE (does copy-wave push price further?)");
console.log("=".repeat(70));
let nextCandleUp = 0;
let nextCandleDown = 0;
const nextMoves: number[] = [];
for (const ec of entryCandles) {
  if (!ec.nextCandle) continue;
  const nextMove = ((ec.nextCandle.close - ec.candle.close) / ec.candle.close) * 100;
  nextMoves.push(nextMove);
  if (nextMove > 0) nextCandleUp++;
  else nextCandleDown++;
}
nextMoves.sort((a, b) => a - b);
console.log(`After entry candle, next candle moves:`);
console.log(`  Up: ${nextCandleUp} (${((nextCandleUp / nextMoves.length) * 100).toFixed(0)}%) | Down: ${nextCandleDown} (${((nextCandleDown / nextMoves.length) * 100).toFixed(0)}%)`);
console.log(`  Median move: ${nextMoves[Math.floor(nextMoves.length / 2)]?.toFixed(4)}%`);
console.log(`  Avg move: ${(nextMoves.reduce((s, v) => s + v, 0) / nextMoves.length).toFixed(4)}%`);

// After batch exit, next candle (expect bounce or continuation down?)
console.log(`\nAfter batch exit, next candle moves:`);
let postExitUp = 0, postExitDown = 0;
const postExitMoves: number[] = [];
for (const b of batchExits) {
  if (!b.candle) continue;
  const idx = candles.indexOf(b.candle);
  if (idx < 0 || idx >= candles.length - 1) continue;
  const next = candles[idx + 1];
  const move = ((next.close - b.candle.close) / b.candle.close) * 100;
  postExitMoves.push(move);
  if (move > 0) postExitUp++;
  else postExitDown++;
}
postExitMoves.sort((a, b) => a - b);
if (postExitMoves.length > 0) {
  console.log(`  Up: ${postExitUp} (${((postExitUp / postExitMoves.length) * 100).toFixed(0)}%) | Down: ${postExitDown} (${((postExitDown / postExitMoves.length) * 100).toFixed(0)}%)`);
  console.log(`  Median move: ${postExitMoves[Math.floor(postExitMoves.length / 2)]?.toFixed(4)}%`);
  console.log(`  Avg move: ${(postExitMoves.reduce((s, v) => s + v, 0) / postExitMoves.length).toFixed(4)}%`);
}
