// One-shot: fetch missing recent candles and merge into {SYMBOL}_5_full.json
import fs from "fs";
import { fetchCandles, Candle } from "./fetch-candles";

async function mergeFor(symbol: string) {
  const file = `data/${symbol}_5_full.json`;
  const existing: Candle[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  existing.sort((a, b) => a.timestamp - b.timestamp);
  const lastTs = existing[existing.length - 1].timestamp;
  console.log(`${symbol}: last ${new Date(lastTs).toISOString()} (${existing.length} candles)`);

  // Fetch from one candle before lastTs to be safe
  const fresh = await fetchCandles(symbol, "5", lastTs - 5 * 60_000, Date.now());
  if (!fresh.length) { console.log("  no new candles"); return; }

  // Merge by timestamp
  const map = new Map<number, Candle>();
  for (const c of existing) map.set(c.timestamp, c);
  for (const c of fresh) map.set(c.timestamp, c);
  const merged = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);

  fs.writeFileSync(file, JSON.stringify(merged));
  const newLast = merged[merged.length - 1].timestamp;
  console.log(`  merged → ${merged.length} candles, last ${new Date(newLast).toISOString()} (+${merged.length - existing.length})`);
}

(async () => {
  await mergeFor("HYPEUSDT");
  await mergeFor("BTCUSDT");
})().catch(console.error);
