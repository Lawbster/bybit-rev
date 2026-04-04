// fetch-1m.ts — Fetch full 1m candle history for signal timing analysis
//
// Run on VPS: npx ts-node src/fetch-1m.ts
// Then copy data/HYPEUSDT_1_full.json back to local machine
//
// Fetches HYPE 1m from 2024-12-05 to now (~690k candles, ~2-3 min)
// Also fetches BTCUSDT 1m for cross-asset validation

import { fetchCandles, saveCandles } from "./fetch-candles";

async function main() {
  const startMs = new Date("2024-12-05").getTime();
  const endMs = Date.now();

  // HYPE 1m
  console.log("\n=== Fetching HYPEUSDT 1m full history ===\n");
  const hype = await fetchCandles("HYPEUSDT", "1", startMs, endMs);
  if (hype.length > 0) {
    saveCandles("HYPEUSDT", "1_full", hype);
    console.log(`  First: ${new Date(hype[0].timestamp).toISOString()}`);
    console.log(`  Last:  ${new Date(hype[hype.length - 1].timestamp).toISOString()}`);
  }

  // BTC 1m
  console.log("\n=== Fetching BTCUSDT 1m full history ===\n");
  const btc = await fetchCandles("BTCUSDT", "1", startMs, endMs);
  if (btc.length > 0) {
    saveCandles("BTCUSDT", "1_full", btc);
    console.log(`  First: ${new Date(btc[0].timestamp).toISOString()}`);
    console.log(`  Last:  ${new Date(btc[btc.length - 1].timestamp).toISOString()}`);
  }

  console.log("\nDone. Copy data/*_1_full.json to local machine for analysis.");
}

main().catch(e => { console.error(e); process.exit(1); });
