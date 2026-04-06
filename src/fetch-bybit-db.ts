/**
 * fetch-bybit-db.ts — Build a reference database of all Bybit USDT perps
 * Cross-references CoinGecko for mcap, supply, and token metadata.
 * Output: data/bybit-perps.json (sorted by mcap desc)
 *
 * Run: npx ts-node src/fetch-bybit-db.ts
 */

import { RestClientV5 } from "bybit-api";
import fs from "fs";
import path from "path";

const client = new RestClientV5();

interface TokenInfo {
  symbol: string;         // e.g. "HYPEUSDT"
  baseCoin: string;       // e.g. "HYPE"
  name: string;           // e.g. "Hyperliquid"
  price: number;
  mcap: number;
  mcapRank: number;
  circSupply: number;
  totalSupply: number | null;
  maxSupply: number | null;
  fdv: number | null;
  volume24h: number;      // USDT turnover on Bybit
  oi: number;             // open interest in USDT
  fundingRate: number;
  ath: number;
  athDate: string;
  atl: number;
  atlDate: string;
  priceVsAth: number;     // % from ATH
  supplyInflation: string; // "deflationary" | "inflationary" | "capped" | "unknown"
  launchDate: string | null;
  fetchedAt: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchCoinGeckoPages(): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  // CoinGecko free tier: 10-30 req/min. Fetch top 1500 coins (6 pages)
  for (let page = 1; page <= 6; page++) {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`CoinGecko page ${page} failed: ${res.status}`);
      break;
    }
    const data: any[] = await res.json();
    if (data.length === 0) break;
    for (const coin of data) {
      // Map by symbol (uppercase) for cross-ref
      const sym = coin.symbol.toUpperCase();
      // Some symbols collide — prefer higher mcap
      if (!map.has(sym) || (coin.market_cap || 0) > (map.get(sym).market_cap || 0)) {
        map.set(sym, coin);
      }
    }
    console.log(`  CoinGecko page ${page}: ${data.length} coins (${map.size} unique symbols)`);
    await sleep(1500); // rate limit
  }
  return map;
}

function classifyInflation(total: number | null, max: number | null, circ: number): string {
  if (max !== null && max > 0) {
    if (circ >= max * 0.99) return "fully-diluted";
    return "capped";
  }
  if (total !== null && total > 0) {
    if (circ >= total * 0.95) return "near-full";
    const ratio = circ / total;
    if (ratio < 0.5) return "high-inflation";
    if (ratio < 0.8) return "inflationary";
    return "low-inflation";
  }
  return "unknown";
}

async function main() {
  console.log("=== Bybit Perps Database Builder ===\n");

  // 1. Get all Bybit USDT linear perps
  console.log("Fetching Bybit instruments...");
  const instrRes = await client.getInstrumentsInfo({ category: "linear" });
  if (instrRes.retCode !== 0) throw new Error(`Instruments failed: ${instrRes.retMsg}`);
  const instruments = instrRes.result.list.filter(
    (i: any) => i.quoteCoin === "USDT" && i.status === "Trading"
  );
  console.log(`  ${instruments.length} active USDT perps\n`);

  // 2. Get tickers for volume/OI/funding
  console.log("Fetching Bybit tickers...");
  const tickerRes = await client.getTickers({ category: "linear" });
  if (tickerRes.retCode !== 0) throw new Error(`Tickers failed: ${tickerRes.retMsg}`);
  const tickerMap = new Map<string, any>();
  for (const t of tickerRes.result.list) {
    tickerMap.set(t.symbol, t);
  }
  console.log(`  ${tickerMap.size} tickers\n`);

  // 3. Fetch CoinGecko data
  console.log("Fetching CoinGecko market data...");
  const geckoMap = await fetchCoinGeckoPages();
  console.log(`  ${geckoMap.size} coins from CoinGecko\n`);

  // 4. Cross-reference and build database
  console.log("Building database...");
  const tokens: TokenInfo[] = [];
  let matched = 0, unmatched = 0;

  for (const instr of instruments) {
    const symbol = instr.symbol as string;
    const baseCoin = instr.baseCoin as string;
    const ticker = tickerMap.get(symbol);
    const gecko = geckoMap.get(baseCoin);

    if (!ticker) continue;

    const price = parseFloat(ticker.lastPrice);
    const volume24h = parseFloat(ticker.turnover24h || "0");
    const oi = parseFloat(ticker.openInterestValue || "0");
    const fundingRate = parseFloat(ticker.fundingRate || "0");

    if (gecko) {
      matched++;
      const circ = gecko.circulating_supply || 0;
      const total = gecko.total_supply;
      const max = gecko.max_supply;
      const mcap = gecko.market_cap || 0;

      tokens.push({
        symbol,
        baseCoin,
        name: gecko.name,
        price,
        mcap,
        mcapRank: gecko.market_cap_rank || 9999,
        circSupply: circ,
        totalSupply: total,
        maxSupply: max,
        fdv: gecko.fully_diluted_valuation,
        volume24h,
        oi,
        fundingRate,
        ath: gecko.ath || 0,
        athDate: gecko.ath_date ? gecko.ath_date.slice(0, 10) : "",
        atl: gecko.atl || 0,
        atlDate: gecko.atl_date ? gecko.atl_date.slice(0, 10) : "",
        priceVsAth: gecko.ath ? ((price - gecko.ath) / gecko.ath) * 100 : 0,
        supplyInflation: classifyInflation(total, max, circ),
        launchDate: gecko.atl_date ? gecko.atl_date.slice(0, 10) : null,
        fetchedAt: new Date().toISOString().slice(0, 19) + "Z",
      });
    } else {
      unmatched++;
      // Still include with minimal data
      tokens.push({
        symbol,
        baseCoin,
        name: baseCoin,
        price,
        mcap: 0,
        mcapRank: 9999,
        circSupply: 0,
        totalSupply: null,
        maxSupply: null,
        fdv: null,
        volume24h,
        oi,
        fundingRate,
        ath: 0,
        athDate: "",
        atl: 0,
        atlDate: "",
        priceVsAth: 0,
        supplyInflation: "unknown",
        launchDate: null,
        fetchedAt: new Date().toISOString().slice(0, 19) + "Z",
      });
    }
  }

  // Sort by mcap desc
  tokens.sort((a, b) => b.mcap - a.mcap);

  // 5. Save
  const outDir = path.resolve(__dirname, "../data");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "bybit-perps.json");
  fs.writeFileSync(jsonPath, JSON.stringify(tokens, null, 2));
  console.log(`\nSaved: ${jsonPath}`);
  console.log(`  ${matched} matched with CoinGecko, ${unmatched} unmatched`);
  console.log(`  ${tokens.length} total tokens\n`);

  // 6. Print summary
  const brackets = [
    { label: ">$10B", min: 10e9, max: Infinity },
    { label: "$1B-$10B", min: 1e9, max: 10e9 },
    { label: "$500M-$1B", min: 500e6, max: 1e9 },
    { label: "$100M-$500M", min: 100e6, max: 500e6 },
    { label: "$50M-$100M", min: 50e6, max: 100e6 },
    { label: "$10M-$50M", min: 10e6, max: 50e6 },
    { label: "<$10M", min: 0, max: 10e6 },
    { label: "Unknown", min: -1, max: 0 },
  ];

  console.log("Mcap Distribution:");
  for (const b of brackets) {
    const count = tokens.filter(t => t.mcap > b.min && t.mcap <= b.max).length;
    console.log(`  ${b.label.padEnd(15)} ${count} tokens`);
  }
}

main().catch(console.error);
