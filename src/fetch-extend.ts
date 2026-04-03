// Extend an existing symbol_5.json file backwards in time.
// Usage: npx ts-node src/fetch-extend.ts BTCUSDT 2024-01-01
//
// Fetches from startDate up to the earliest candle we already have,
// prepends them, deduplicates, and saves back to data/${symbol}_5.json.

import { fetchCandles, saveCandles, Candle } from "./fetch-candles";
import fs from "fs";
import path from "path";

async function main() {
  const symbol   = process.argv[2];
  const startDate = process.argv[3] || "2024-01-01";

  if (!symbol) {
    console.error("Usage: npx ts-node src/fetch-extend.ts <SYMBOL> [startDate]");
    process.exit(1);
  }

  const dataDir  = path.resolve(__dirname, "../data");
  const fileFull = path.join(dataDir, `${symbol}_5_full.json`);
  const fileStd  = path.join(dataDir, `${symbol}_5.json`);
  const existing = fs.existsSync(fileFull) ? fileFull : fs.existsSync(fileStd) ? fileStd : null;

  let existingCandles: Candle[] = [];
  let earliestExisting = Date.now();

  if (existing) {
    existingCandles = JSON.parse(fs.readFileSync(existing, "utf-8"));
    existingCandles.sort((a, b) => a.timestamp - b.timestamp);
    earliestExisting = existingCandles[0].timestamp;
    console.log(`Existing: ${existingCandles.length} candles, earliest ${new Date(earliestExisting).toISOString().slice(0, 10)}`);
  } else {
    console.log("No existing file — fetching full range.");
  }

  const startMs = new Date(startDate + "T00:00:00Z").getTime();

  if (startMs >= earliestExisting) {
    console.log("Already have data back to that date. Nothing to fetch.");
    return;
  }

  console.log(`\nFetching ${symbol} 5m from ${startDate} to ${new Date(earliestExisting).toISOString().slice(0, 10)}`);
  const newCandles = await fetchCandles(symbol, "5", startMs, earliestExisting - 1);

  const merged = [...newCandles, ...existingCandles];
  const seen = new Set<number>();
  const deduped = merged.filter(c => {
    if (seen.has(c.timestamp)) return false;
    seen.add(c.timestamp);
    return true;
  });
  deduped.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`\nMerged: ${deduped.length} candles total`);
  console.log(`Range: ${new Date(deduped[0].timestamp).toISOString().slice(0, 10)} → ${new Date(deduped[deduped.length-1].timestamp).toISOString().slice(0, 10)}`);

  // Always save to _5_full.json so the sim can find it
  const outPath = path.join(dataDir, `${symbol}_5_full.json`);
  fs.writeFileSync(outPath, JSON.stringify(deduped));
  const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`Saved: ${outPath} (${sizeMb} MB)`);
}

main().catch(console.error);
