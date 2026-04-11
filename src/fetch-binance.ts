// Fetch 1m candles from Binance for cross-exchange volume comparison
// Usage: npx ts-node src/fetch-binance.ts BTCUSDT 1m 2024-12-05
//        npx ts-node src/fetch-binance.ts HYPEUSDT 1m 2024-12-05

import fs from "fs";
import path from "path";
import https from "https";

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function fetchBinanceCandles(
  symbol: string,
  interval: string,
  startMs: number,
  endMs: number = Date.now(),
): Promise<Candle[]> {
  const all: Candle[] = [];
  let cursor = startMs;
  let totalRequests = 0;

  // Binance symbol mapping — HYPE trades as HYPEUSDT on Binance futures
  const binanceSymbol = symbol;

  console.log(`Fetching Binance ${binanceSymbol} ${interval} candles: ${new Date(startMs).toISOString().slice(0, 10)} → ${new Date(endMs).toISOString().slice(0, 10)}`);

  while (cursor < endMs) {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${binanceSymbol}&interval=${interval}&startTime=${cursor}&limit=1500`;

    const raw = await httpGet(url);
    totalRequests++;

    let data: any[];
    try {
      data = JSON.parse(raw);
    } catch {
      console.error(`\nParse error at request ${totalRequests}:`, raw.slice(0, 200));
      break;
    }

    if (!Array.isArray(data)) {
      console.error(`\nAPI error:`, raw.slice(0, 300));
      break;
    }

    if (data.length === 0) break;

    for (const c of data) {
      // Binance kline format: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, ...]
      all.push({
        timestamp: Number(c[0]),
        open: Number(c[1]),
        high: Number(c[2]),
        low: Number(c[3]),
        close: Number(c[4]),
        volume: Number(c[5]),      // base asset volume
        turnover: Number(c[7]),    // quote asset volume (USDT)
      });
    }

    const lastTs = Number(data[data.length - 1][0]);
    cursor = lastTs + 60000; // next minute after last candle

    const pct = ((cursor - startMs) / (endMs - startMs) * 100).toFixed(1);
    process.stdout.write(`\r  ${totalRequests} requests | ${all.length} candles | ${pct}% done`);

    // Binance rate limit: 2400 weight/min, klines = 5 weight. Be conservative.
    await sleep(150);
  }

  console.log(`\n  Done: ${all.length} candles in ${totalRequests} requests`);

  // Deduplicate and sort
  const seen = new Set<number>();
  const deduped = all.filter((c) => {
    if (seen.has(c.timestamp)) return false;
    seen.add(c.timestamp);
    return true;
  });
  deduped.sort((a, b) => a.timestamp - b.timestamp);

  return deduped;
}

function saveCandles(symbol: string, candles: Candle[]): string {
  const dir = path.resolve(__dirname, "../data/binance");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `${symbol}_1.json`;
  const filepath = path.join(dir, filename);

  fs.writeFileSync(filepath, JSON.stringify(candles));
  const sizeMb = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`  Saved: ${filepath} (${sizeMb} MB, ${candles.length} candles)`);
  return filepath;
}

async function main() {
  const symbol = process.argv[2] || "HYPEUSDT";
  const interval = process.argv[3] || "1m";
  const startDate = process.argv[4] || "2024-12-05";

  const startMs = new Date(startDate + "T00:00:00Z").getTime();
  const endMs = Date.now();

  console.log(`\n=== Fetching Binance ${symbol} ${interval} candles ===`);
  console.log(`From ${startDate} to now\n`);

  const candles = await fetchBinanceCandles(symbol, interval, startMs, endMs);

  if (candles.length > 0) {
    saveCandles(symbol, candles);

    const first = candles[0];
    const last = candles[candles.length - 1];
    console.log(`\n  Range: ${new Date(first.timestamp).toISOString().slice(0, 10)} → ${new Date(last.timestamp).toISOString().slice(0, 10)}`);
    console.log(`  Price: $${first.open.toFixed(4)} → $${last.close.toFixed(4)}`);

    // Gap check
    let gaps = 0;
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].timestamp - candles[i - 1].timestamp > 90000) gaps++;
    }
    console.log(`  Gaps: ${gaps}`);
  }
}

main().catch(console.error);
