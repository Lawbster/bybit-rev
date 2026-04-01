import fs from "fs";
import path from "path";
import { parseXlsxFile } from "./parse-xlsx";

// ─────────────────────────────────────────────
// Cross-reference Caleon's entries with market data snapshots
// ─────────────────────────────────────────────

interface MarketSnap {
  ts: string;
  tsMs: number;
  price: number;
  fundingRate: number;
  openInterest: number;
  price24hPcnt: number;
  ob: {
    bidDepth: number;
    askDepth: number;
    imbalance: number;
    spread: number;
    bidWall: number;
    askWall: number;
    thinSide: string;
  };
  flow: {
    buyVol: number;
    sellVol: number;
    buyCount: number;
    sellCount: number;
  };
  ind?: {
    rsi: number;
    stochK: number;
    stochD: number;
    bbPos: number;
    bbWidth: number;
    atrPct: number;
    volRatio: number;
    emaTrend: string;
    roc5: number;
    roc20: number;
    macdHist: number;
    priceVsEma50: number;
  };
}

function loadMarketData(symbol: string): MarketSnap[] {
  const file = path.resolve(__dirname, `../data/${symbol}_market.jsonl`);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
  return lines.map(l => {
    const j = JSON.parse(l);
    return { ...j, tsMs: new Date(j.ts).getTime() };
  });
}

function findNearest(snaps: MarketSnap[], targetMs: number, maxGapMs = 5 * 60000): MarketSnap | null {
  if (snaps.length === 0) return null;
  let best = snaps[0], bestDist = Math.abs(snaps[0].tsMs - targetMs);
  // binary search would be faster but data is small enough
  for (const s of snaps) {
    const dist = Math.abs(s.tsMs - targetMs);
    if (dist < bestDist) { best = s; bestDist = dist; }
  }
  return bestDist <= maxGapMs ? best : null;
}

// Load Caleon trades
const trades = parseXlsxFile(path.resolve(__dirname, "../bybit-exports/gui-pull-caleon.xlsx"));
console.log(`Loaded ${trades.length} Caleon trades\n`);

// Get unique symbols
const symbols = [...new Set(trades.map(t => t.symbol))];
console.log(`Symbols traded: ${symbols.join(", ")}\n`);

// Track which symbols we have market data for
const tracked = [
  "BLUAIUSDT", "ETHUSDT", "RIVERUSDT", "SUIUSDT",
  "BTCUSDT", "HYPEUSDT", "SIRENUSDT", "TAOUSDT",
  "CUSDT", "LIGHTUSDT", "SOLUSDT", "VVVUSDT",
  "DUSKUSDT", "PIPPINUSDT", "STGUSDT", "XRPUSDT",
];

// Load market data for tracked symbols
const marketData = new Map<string, MarketSnap[]>();
for (const sym of tracked) {
  const snaps = loadMarketData(sym);
  if (snaps.length > 0) {
    marketData.set(sym, snaps);
  }
}

console.log("Market data available:");
for (const [sym, snaps] of marketData) {
  const first = new Date(snaps[0].ts).toISOString().slice(0, 16);
  const last = new Date(snaps[snaps.length - 1].ts).toISOString().slice(0, 16);
  console.log(`  ${sym.padEnd(14)} ${snaps.length} snaps  ${first} → ${last}`);
}

// Filter Caleon trades to tracked symbols within market data window
const marketStart = Math.min(...[...marketData.values()].map(s => s[0].tsMs));
const marketEnd = Math.max(...[...marketData.values()].map(s => s[s.length - 1].tsMs));

console.log(`\nMarket data window: ${new Date(marketStart).toISOString().slice(0, 16)} → ${new Date(marketEnd).toISOString().slice(0, 16)}`);

// Only look at entries (openedAt) that fall within market data window
const matchable = trades.filter(t =>
  marketData.has(t.symbol) &&
  t.openedAt.getTime() >= marketStart &&
  t.openedAt.getTime() <= marketEnd
);

console.log(`\nCaleon trades within market data window: ${matchable.length} / ${trades.length}`);

if (matchable.length === 0) {
  // Show trade date range vs market data range
  const tradeFirst = trades[0]?.openedAt;
  const tradeLast = trades[trades.length - 1]?.openedAt;
  console.log(`\nCaleon trade range: ${tradeFirst?.toISOString().slice(0, 16)} → ${tradeLast?.toISOString().slice(0, 16)}`);
  console.log("No overlap — Caleon's trades are outside the market data collection window.");

  // Still useful: show summary of Caleon's entries by symbol
  console.log("\n" + "=".repeat(100));
  console.log("  CALEON ENTRY SUMMARY (all trades, no market overlay)");
  console.log("=".repeat(100));

  const bySymbol = new Map<string, typeof trades>();
  for (const t of trades) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, []);
    bySymbol.get(t.symbol)!.push(t);
  }

  console.log(`\n  ${"Symbol".padEnd(14)} ${"Trades".padStart(6)}  ${"Longs".padStart(5)} ${"Shorts".padStart(6)}  ${"Avg Lev".padStart(7)}  ${"Win%".padStart(5)}  ${"Avg PnL%".padStart(8)}  ${"Avg Hold".padStart(10)}  ${"Date Range".padEnd(30)}`);
  console.log("  " + "-".repeat(105));

  for (const [sym, st] of [...bySymbol.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const longs = st.filter(t => t.side === "Long").length;
    const shorts = st.filter(t => t.side === "Short").length;
    const avgLev = st.reduce((s, t) => s + t.leverage, 0) / st.length;
    const wins = st.filter(t => t.pnl > 0).length;
    const avgPnl = st.reduce((s, t) => s + t.pnlPercent, 0) / st.length;
    const avgHold = st.reduce((s, t) => s + t.holdDurationMs, 0) / st.length / 3600000;
    const first = st[0].openedAt.toISOString().slice(0, 10);
    const last = st[st.length - 1].openedAt.toISOString().slice(0, 10);
    const isTracked = tracked.includes(sym) ? " *" : "";
    console.log(`  ${(sym + isTracked).padEnd(14)} ${String(st.length).padStart(6)}  ${String(longs).padStart(5)} ${String(shorts).padStart(6)}  ${avgLev.toFixed(1).padStart(7)}x ${(wins / st.length * 100).toFixed(0).padStart(5)}%  ${(avgPnl >= 0 ? "+" : "") + avgPnl.toFixed(2).padStart(7)}%  ${avgHold.toFixed(1).padStart(8)}h  ${first} → ${last}`);
  }

  console.log("\n  * = we have market data for this symbol");

  process.exit(0);
}

// Cross-reference entries with market data
console.log("\n" + "=".repeat(120));
console.log("  CALEON ENTRIES × MARKET CONDITIONS");
console.log("=".repeat(120));

console.log(`\n  ${"Time".padEnd(17)} ${"Symbol".padEnd(12)} ${"Side".padEnd(5)} ${"Entry$".padStart(10)}  ${"PnL%".padStart(7)}  ${"Fund%".padStart(7)}  ${"OI Δ24h".padStart(8)}  ${"Imbal".padStart(6)}  ${"Spread".padStart(7)}  ${"BuyVol".padStart(8)}  ${"SellVol".padStart(8)}  ${"Thin".padEnd(8)}`);
console.log("  " + "-".repeat(115));

for (const t of matchable) {
  const snaps = marketData.get(t.symbol)!;
  const snap = findNearest(snaps, t.openedAt.getTime(), 10 * 60000); // 10min tolerance
  if (!snap) continue;

  const fundPct = (snap.fundingRate * 100).toFixed(4);
  const imbal = snap.ob.imbalance.toFixed(2);
  const spread = (snap.ob.spread * 100).toFixed(2);
  const buyVol = snap.flow.buyVol.toFixed(0);
  const sellVol = snap.flow.sellVol.toFixed(0);
  const pnlStr = (t.pnlPercent >= 0 ? "+" : "") + t.pnlPercent.toFixed(2) + "%";

  console.log(`  ${t.openedAt.toISOString().slice(0, 16)} ${t.symbol.padEnd(12)} ${t.side.padEnd(5)} $${t.entryPrice.toFixed(t.entryPrice > 100 ? 2 : 6).padStart(9)}  ${pnlStr.padStart(7)}  ${fundPct.padStart(7)}  ${" ".repeat(8)}  ${imbal.padStart(6)}  ${spread.padStart(6)}%  ${buyVol.padStart(8)}  ${sellVol.padStart(8)}  ${snap.ob.thinSide.padEnd(8)}`);
}

// Aggregate stats for entries with market data
console.log("\n" + "=".repeat(100));
console.log("  AGGREGATE: Market conditions at Caleon entries vs random");
console.log("=".repeat(100));

const entrySnaps: MarketSnap[] = [];
for (const t of matchable) {
  const snaps = marketData.get(t.symbol)!;
  const snap = findNearest(snaps, t.openedAt.getTime(), 10 * 60000);
  if (snap) entrySnaps.push(snap);
}

if (entrySnaps.length > 0) {
  const avgFunding = entrySnaps.reduce((s, e) => s + e.fundingRate, 0) / entrySnaps.length;
  const avgImbal = entrySnaps.reduce((s, e) => s + e.ob.imbalance, 0) / entrySnaps.length;
  const avgSpread = entrySnaps.reduce((s, e) => s + e.ob.spread, 0) / entrySnaps.length;
  const avgBuyRatio = entrySnaps.reduce((s, e) => s + e.flow.buyVol / Math.max(1, e.flow.buyVol + e.flow.sellVol), 0) / entrySnaps.length;

  console.log(`\n  At Caleon entries (n=${entrySnaps.length}):`);
  console.log(`    Avg funding:    ${(avgFunding * 100).toFixed(4)}%`);
  console.log(`    Avg OB imbal:   ${avgImbal.toFixed(3)} (>0 = bid heavy, <0 = ask heavy)`);
  console.log(`    Avg spread:     ${(avgSpread * 100).toFixed(3)}%`);
  console.log(`    Avg buy ratio:  ${(avgBuyRatio * 100).toFixed(1)}% of volume`);

  // Compare to all market data
  const allSnaps: MarketSnap[] = [];
  for (const [, snaps] of marketData) allSnaps.push(...snaps);

  const bgFunding = allSnaps.reduce((s, e) => s + e.fundingRate, 0) / allSnaps.length;
  const bgImbal = allSnaps.reduce((s, e) => s + e.ob.imbalance, 0) / allSnaps.length;
  const bgSpread = allSnaps.reduce((s, e) => s + e.ob.spread, 0) / allSnaps.length;
  const bgBuyRatio = allSnaps.reduce((s, e) => s + e.flow.buyVol / Math.max(1, e.flow.buyVol + e.flow.sellVol), 0) / allSnaps.length;

  console.log(`\n  Background average (all ${allSnaps.length} snapshots):`);
  console.log(`    Avg funding:    ${(bgFunding * 100).toFixed(4)}%`);
  console.log(`    Avg OB imbal:   ${bgImbal.toFixed(3)}`);
  console.log(`    Avg spread:     ${(bgSpread * 100).toFixed(3)}%`);
  console.log(`    Avg buy ratio:  ${(bgBuyRatio * 100).toFixed(1)}%`);
}
