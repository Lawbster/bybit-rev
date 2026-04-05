// fetch-1m-all.ts — Fetch 1m candle history for all symbols
//
// Stores in data/vps/{SYMBOL}_1_full.json
// Resumable: skips symbols that already have complete data.
// Run locally: npx ts-node src/fetch-1m-all.ts
//
// ~690 requests per symbol @ 500ms = ~6 min each.
// 13 symbols ≈ ~80 min total.

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
const DATA_DIR = path.resolve(__dirname, "../data/vps");

const SYMBOLS = [
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "SUIUSDT",
  "SIRENUSDT",
  "LIGHTUSDT",
  "PIPPINUSDT",
  "BLUAIUSDT",
  "CUSDT",
  "DUSKUSDT",
  "RIVERUSDT",
  "STGUSDT",
  "VVVUSDT",
  "TAOUSDT",
];

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
    ? existing[existing.length - 1].timestamp + 60000
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

    const oldestTs = Math.min(...batch.map(c => c.timestamp));
    if (oldestTs >= cursor) break;
    cursor = oldestTs - 1;

    const pct = ((globalEnd - cursor) / (globalEnd - startFrom) * 100).toFixed(1);
    process.stdout.write(`\r  ${requests} requests | ${all.length} candles | ${pct}% done   `);

    // Save checkpoint every 50 requests
    if (requests % 50 === 0) {
      all.sort((a, b) => a.timestamp - b.timestamp);
      fs.writeFileSync(filepath, JSON.stringify(all));
      process.stdout.write(` [saved checkpoint]`);
    }

    await sleep(500);
  }

  // Final save
  all.sort((a, b) => a.timestamp - b.timestamp);
  fs.writeFileSync(filepath, JSON.stringify(all));
  const sizeMb = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`\n  Saved: ${filepath} (${sizeMb} MB, ${all.length} candles)`);
  if (all.length > 0) {
    console.log(`  First: ${new Date(all[0].timestamp).toISOString()}`);
    console.log(`  Last:  ${new Date(all[all.length - 1].timestamp).toISOString()}`);
  }
}

async function main() {
  const startMs = new Date("2024-12-05").getTime();
  const endMs = Date.now();

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  for (let i = 0; i < SYMBOLS.length; i++) {
    const sym = SYMBOLS[i];
    console.log(`\n=== [${i + 1}/${SYMBOLS.length}] Fetching ${sym} 1m full history ===`);
    await fetchSymbol(sym, startMs, endMs);

    // Wait between symbols to reset rate limit window
    if (i < SYMBOLS.length - 1) {
      console.log(`\n  Waiting 10s before next symbol...\n`);
      await sleep(10000);
    }
  }

  console.log("\nDone. All 1m data saved to data/vps/");
}

main().catch(e => { console.error(e); process.exit(1); });
