// fetch-1m.ts — Fetch full 1m candle history for signal timing analysis
//
// Run on VPS: npx ts-node src/fetch-1m.ts
// Resumable: if data file already exists, continues from where it left off.
// Then copy data/HYPEUSDT_1_full.json back to local machine.
//
// Uses slower rate (500ms) + retry on 429 to avoid Bybit rate limits.
// ~690k candles per symbol = ~690 requests = ~6-7 min each.

import { RestClientV5 } from "bybit-api";
import fs from "fs";
import path from "path";

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

const client = new RestClientV5();
const DATA_DIR = path.resolve(__dirname, "../data");

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(
  symbol: string,
  startMs: number,
  endMs: number,
  maxRetries = 5,
): Promise<Candle[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await client.getKline({
        category: "linear",
        symbol,
        interval: "1",
        limit: 1000,
        start: startMs,
        end: endMs,
      });

      if (res.retCode !== 0) {
        if (res.retMsg?.includes("Rate Limit") || res.retMsg?.includes("Too many")) {
          const backoff = Math.min(5000 * (attempt + 1), 30000);
          console.log(`\n  Rate limited, backing off ${backoff / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
          await sleep(backoff);
          continue;
        }
        console.error(`\n  API error: ${res.retMsg}`);
        return [];
      }

      const list = res.result.list;
      if (!list || list.length === 0) return [];

      return (list as string[][]).map(c => ({
        timestamp: Number(c[0]),
        open: Number(c[1]),
        high: Number(c[2]),
        low: Number(c[3]),
        close: Number(c[4]),
        volume: Number(c[5]),
        turnover: Number(c[6]),
      }));
    } catch (err: any) {
      if (attempt < maxRetries - 1) {
        const backoff = 5000 * (attempt + 1);
        console.log(`\n  Network error: ${err.message}, retrying in ${backoff / 1000}s...`);
        await sleep(backoff);
      } else {
        console.error(`\n  Failed after ${maxRetries} attempts: ${err.message}`);
        return [];
      }
    }
  }
  return [];
}

async function fetchSymbol(symbol: string, globalStart: number, globalEnd: number) {
  const filename = `${symbol}_1_full.json`;
  const filepath = path.join(DATA_DIR, filename);

  // Resume: load existing data and continue from last timestamp
  let existing: Candle[] = [];
  if (fs.existsSync(filepath)) {
    existing = JSON.parse(fs.readFileSync(filepath, "utf-8"));
    existing.sort((a, b) => a.timestamp - b.timestamp);
    console.log(`  Existing data: ${existing.length} candles, last: ${new Date(existing[existing.length - 1].timestamp).toISOString()}`);
  }

  // Start from after the last existing candle, or from globalStart
  const startFrom = existing.length > 0
    ? existing[existing.length - 1].timestamp + 60000  // next minute
    : globalStart;

  if (startFrom >= globalEnd) {
    console.log(`  Already up to date.`);
    return;
  }

  console.log(`  Fetching: ${new Date(startFrom).toISOString().slice(0, 16)} → ${new Date(globalEnd).toISOString().slice(0, 16)}`);

  const all: Candle[] = [...existing];
  const seen = new Set(existing.map(c => c.timestamp));
  let cursor = globalEnd;
  let requests = 0;

  while (cursor > startFrom) {
    const batch = await fetchWithRetry(symbol, startFrom, cursor);
    requests++;

    if (batch.length === 0) break;

    let added = 0;
    for (const c of batch) {
      if (!seen.has(c.timestamp)) {
        seen.add(c.timestamp);
        all.push(c);
        added++;
      }
    }

    // Results come newest-first, oldest item is last
    const oldestTs = Math.min(...batch.map(c => c.timestamp));
    if (oldestTs >= cursor) break; // no progress
    cursor = oldestTs - 1;

    const pct = ((globalEnd - cursor) / (globalEnd - startFrom) * 100).toFixed(1);
    process.stdout.write(`\r  ${requests} requests | ${all.length} candles | ${pct}% done   `);

    // Save checkpoint every 50 requests
    if (requests % 50 === 0) {
      all.sort((a, b) => a.timestamp - b.timestamp);
      fs.writeFileSync(filepath, JSON.stringify(all));
      process.stdout.write(` [saved checkpoint]`);
    }

    await sleep(500); // 2 req/s — safe for sustained fetching
  }

  // Final save
  all.sort((a, b) => a.timestamp - b.timestamp);
  fs.writeFileSync(filepath, JSON.stringify(all));
  const sizeMb = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`\n  Saved: ${filepath} (${sizeMb} MB, ${all.length} candles)`);
  console.log(`  First: ${new Date(all[0].timestamp).toISOString()}`);
  console.log(`  Last:  ${new Date(all[all.length - 1].timestamp).toISOString()}`);
}

async function main() {
  const startMs = new Date("2024-12-05").getTime();
  const endMs = Date.now();

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log("\n=== Fetching HYPEUSDT 1m full history ===");
  await fetchSymbol("HYPEUSDT", startMs, endMs);

  // Wait before starting next symbol to reset rate limit window
  console.log("\n  Waiting 10s before next symbol...\n");
  await sleep(10000);

  console.log("=== Fetching BTCUSDT 1m full history ===");
  await fetchSymbol("BTCUSDT", startMs, endMs);

  console.log("\nDone. Copy data/*_1_full.json to local machine for analysis.");
}

main().catch(e => { console.error(e); process.exit(1); });
