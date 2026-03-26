import { RestClientV5 } from "bybit-api";
import fs from "fs";
import path from "path";

const client = new RestClientV5();

export interface Candle {
  timestamp: number;   // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;      // base coin
  turnover: number;    // quote coin (USDT)
}

type Interval = "1" | "3" | "5" | "15" | "30" | "60" | "120" | "240" | "360" | "720" | "D" | "W" | "M";

const INTERVAL_MS: Record<string, number> = {
  "1": 60000,
  "3": 180000,
  "5": 300000,
  "15": 900000,
  "30": 1800000,
  "60": 3600000,
  "120": 7200000,
  "240": 14400000,
  "360": 21600000,
  "720": 43200000,
  "D": 86400000,
  "W": 604800000,
  "M": 2592000000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch all candles for a symbol+interval between start and end.
 * Paginates automatically, respects rate limits.
 */
export async function fetchCandles(
  symbol: string,
  interval: Interval,
  startMs: number,
  endMs: number = Date.now(),
): Promise<Candle[]> {
  const all: Candle[] = [];
  let cursor = endMs;
  let totalRequests = 0;

  console.log(`Fetching ${symbol} ${interval} candles: ${new Date(startMs).toISOString().slice(0, 10)} → ${new Date(endMs).toISOString().slice(0, 10)}`);

  while (cursor > startMs) {
    const res = await client.getKline({
      category: "linear",
      symbol,
      interval,
      limit: 1000,
      end: cursor,
      start: startMs,
    });

    totalRequests++;

    if (res.retCode !== 0) {
      console.error(`API error: ${res.retMsg}`);
      break;
    }

    const list = res.result.list;
    if (!list || list.length === 0) break;

    for (const c of list) {
      all.push({
        timestamp: Number(c[0]),
        open: Number(c[1]),
        high: Number(c[2]),
        low: Number(c[3]),
        close: Number(c[4]),
        volume: Number(c[5]),
        turnover: Number(c[6]),
      });
    }

    // Results are in reverse order — last item is the oldest
    const oldestTs = Number(list[list.length - 1][0]);
    if (oldestTs >= cursor) break; // no progress
    cursor = oldestTs - 1; // move before oldest

    // Progress
    const pct = ((endMs - cursor) / (endMs - startMs) * 100).toFixed(1);
    process.stdout.write(`\r  ${totalRequests} requests | ${all.length} candles | ${pct}% done`);

    // Rate limit: be nice — 5 req/s is safe
    await sleep(200);
  }

  console.log(`\n  Done: ${all.length} candles in ${totalRequests} requests`);

  // Deduplicate and sort ascending
  const seen = new Set<number>();
  const deduped = all.filter((c) => {
    if (seen.has(c.timestamp)) return false;
    seen.add(c.timestamp);
    return true;
  });
  deduped.sort((a, b) => a.timestamp - b.timestamp);

  return deduped;
}

/**
 * Save candles to a JSON file in data/ directory.
 */
export function saveCandles(symbol: string, interval: string, candles: Candle[]): string {
  const dir = path.resolve(__dirname, "../data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `${symbol}_${interval}.json`;
  const filepath = path.join(dir, filename);

  fs.writeFileSync(filepath, JSON.stringify(candles));
  const sizeMb = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`  Saved: ${filepath} (${sizeMb} MB, ${candles.length} candles)`);
  return filepath;
}

/**
 * Load candles from a JSON file.
 */
export function loadCandles(symbol: string, interval: string): Candle[] {
  const filepath = path.resolve(__dirname, `../data/${symbol}_${interval}.json`);
  if (!fs.existsSync(filepath)) return [];
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

// CLI entrypoint
async function main() {
  const symbol = process.argv[2] || "SIRENUSDT";
  const interval = (process.argv[3] || "5") as Interval;
  // Default: go back to SIREN listing date
  const startDate = process.argv[4] || "2025-03-22";

  const startMs = new Date(startDate).getTime();
  const endMs = Date.now();

  console.log(`\n=== Fetching ${symbol} ${interval}m candles ===`);
  console.log(`From ${startDate} to now\n`);

  const candles = await fetchCandles(symbol, interval, startMs, endMs);

  if (candles.length > 0) {
    saveCandles(symbol, interval, candles);

    // Quick stats
    const first = candles[0];
    const last = candles[candles.length - 1];
    console.log(`\n  Range: ${new Date(first.timestamp).toISOString().slice(0, 10)} → ${new Date(last.timestamp).toISOString().slice(0, 10)}`);
    console.log(`  Price: $${first.open.toFixed(6)} → $${last.close.toFixed(6)}`);

    // Check for gaps
    const expectedInterval = INTERVAL_MS[interval] || 60000;
    let gaps = 0;
    for (let i = 1; i < candles.length; i++) {
      const diff = candles[i].timestamp - candles[i - 1].timestamp;
      if (diff > expectedInterval * 1.5) gaps++;
    }
    console.log(`  Gaps detected: ${gaps} (periods with no trading activity)`);
  }
}

// Only run when called directly
if (require.main === module) {
  main().catch(console.error);
}
