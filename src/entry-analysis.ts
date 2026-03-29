import fs from "fs";
import path from "path";
import { loadAllXlsx } from "./parse-xlsx";

const DATA_DIR = path.resolve(__dirname, "../data");

interface AnalysisTrade {
  symbol: string;
  side: "Long" | "Short";
  openTime: Date;
  closeTime: Date;
  entryPrice: number;
  closePrice: number;
  pnl: number;
  isWin: boolean;
}

interface Snapshot {
  ts: string;
  event: string;
  symbol: string;
  price: number;
  fundingRate?: number;
  openInterest?: number;
  price24hPcnt?: number;
  ob?: {
    bidDepth: number;
    askDepth: number;
    imbalance: number;
    spread: number;
    bidWall: number;
    askWall: number;
    thinSide: string;
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
  flow?: {
    buyVol: number;
    sellVol: number;
    buyCount: number;
    sellCount: number;
    start: number;
  };
}

function parseTrades(): AnalysisTrade[] {
  const raw = loadAllXlsx();
  return raw.map((t) => ({
    symbol: t.symbol,
    side: t.side,
    openTime: t.openedAt,
    closeTime: t.closedAt,
    entryPrice: t.entryPrice,
    closePrice: t.exitPrice,
    pnl: t.pnl,
    isWin: t.pnl > 0,
  }));
}

function loadSnapshots(symbol: string): Snapshot[] {
  const file = path.join(DATA_DIR, `${symbol}_market.jsonl`);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
}

function findClosest(snapshots: Snapshot[], targetTime: Date, maxDiffMs = 120000): Snapshot | null {
  const target = targetTime.getTime();
  let best: Snapshot | null = null;
  let bestDiff = Infinity;
  for (const s of snapshots) {
    const diff = Math.abs(new Date(s.ts).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return bestDiff <= maxDiffMs ? best : null;
}

function fmt(n: number | undefined, d = 4): string {
  if (n === undefined || n === null) return "---";
  return n.toFixed(d);
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stats(arr: number[]): { avg: number; med: number; min: number; max: number; std: number } {
  if (!arr.length) return { avg: 0, med: 0, min: 0, max: 0, std: 0 };
  const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
  const med = median(arr);
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const variance = arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length;
  return { avg, med, min, max, std: Math.sqrt(variance) };
}

async function main() {
  const trades = parseTrades();
  console.log(`\n=== COPY TRADER ENTRY/EXIT ANALYSIS ===`);
  console.log(`Total trades: ${trades.length} | Winners: ${trades.filter((t) => t.isWin).length} | Losers: ${trades.filter((t) => !t.isWin).length}`);

  // Load all JSONL data by symbol
  const symbolSnaps = new Map<string, Snapshot[]>();
  const symbols = [...new Set(trades.map((t) => t.symbol))];
  for (const sym of symbols) {
    const snaps = loadSnapshots(sym);
    if (snaps.length > 0) symbolSnaps.set(sym, snaps);
  }
  console.log(`\nJSONL data available for: ${[...symbolSnaps.keys()].join(", ")}`);
  for (const [sym, snaps] of symbolSnaps) {
    console.log(`  ${sym}: ${snaps.length} snapshots (${snaps[0].ts} → ${snaps[snaps.length - 1].ts})`);
  }

  // Match winning trades to JSONL snapshots
  const winTrades = trades.filter((t) => t.isWin);

  interface MatchedTrade {
    trade: AnalysisTrade;
    entrySnap: Snapshot;
    exitSnap: Snapshot | null;
  }

  const matched: MatchedTrade[] = [];
  for (const t of winTrades) {
    const snaps = symbolSnaps.get(t.symbol);
    if (!snaps) continue;
    const entrySnap = findClosest(snaps, t.openTime);
    if (!entrySnap) continue;
    const exitSnap = findClosest(snaps, t.closeTime);
    matched.push({ trade: t, entrySnap, exitSnap });
  }

  console.log(`\nMatched ${matched.length} winning trades to JSONL snapshots (out of ${winTrades.length} winners)`);

  if (matched.length === 0) {
    console.log("No matches — JSONL data doesn't overlap with winning trades.");
    return;
  }

  // ============== INDIVIDUAL TRADE ANALYSIS ==============
  console.log(`\n${"=".repeat(120)}`);
  console.log("INDIVIDUAL TRADE SNAPSHOTS — ENTRY vs EXIT");
  console.log(`${"=".repeat(120)}`);

  for (const m of matched) {
    const { trade, entrySnap, exitSnap } = m;
    const timeDiff = Math.abs(new Date(entrySnap.ts).getTime() - trade.openTime.getTime());
    console.log(`\n--- ${trade.symbol} ${trade.side} | Entry: ${trade.openTime.toISOString()} | PnL: $${trade.pnl.toFixed(2)} | Snap offset: ${(timeDiff / 1000).toFixed(0)}s ---`);

    const printField = (label: string, entryVal: any, exitVal: any) => {
      const eStr = typeof entryVal === "number" ? fmt(entryVal) : String(entryVal ?? "---");
      const xStr = exitVal !== undefined ? (typeof exitVal === "number" ? fmt(exitVal) : String(exitVal ?? "---")) : "---";
      console.log(`  ${label.padEnd(20)} ENTRY: ${eStr.padStart(14)}  |  EXIT: ${xStr.padStart(14)}`);
    };

    printField("price", entrySnap.price, exitSnap?.price);
    printField("price24hPcnt", entrySnap.price24hPcnt, exitSnap?.price24hPcnt);
    printField("fundingRate", entrySnap.fundingRate, exitSnap?.fundingRate);
    printField("openInterest", entrySnap.openInterest, exitSnap?.openInterest);

    if (entrySnap.ob) {
      console.log("  [Orderbook]");
      printField("  bidDepth", entrySnap.ob.bidDepth, exitSnap?.ob?.bidDepth);
      printField("  askDepth", entrySnap.ob.askDepth, exitSnap?.ob?.askDepth);
      printField("  imbalance", entrySnap.ob.imbalance, exitSnap?.ob?.imbalance);
      printField("  spread%", entrySnap.ob.spread, exitSnap?.ob?.spread);
      printField("  bidWall", entrySnap.ob.bidWall, exitSnap?.ob?.bidWall);
      printField("  askWall", entrySnap.ob.askWall, exitSnap?.ob?.askWall);
      printField("  thinSide", entrySnap.ob.thinSide, exitSnap?.ob?.thinSide);
    }

    if (entrySnap.ind) {
      console.log("  [Indicators]");
      printField("  rsi", entrySnap.ind.rsi, exitSnap?.ind?.rsi);
      printField("  stochK", entrySnap.ind.stochK, exitSnap?.ind?.stochK);
      printField("  stochD", entrySnap.ind.stochD, exitSnap?.ind?.stochD);
      printField("  bbPos", entrySnap.ind.bbPos, exitSnap?.ind?.bbPos);
      printField("  bbWidth", entrySnap.ind.bbWidth, exitSnap?.ind?.bbWidth);
      printField("  atrPct", entrySnap.ind.atrPct, exitSnap?.ind?.atrPct);
      printField("  volRatio", entrySnap.ind.volRatio, exitSnap?.ind?.volRatio);
      printField("  emaTrend", entrySnap.ind.emaTrend, exitSnap?.ind?.emaTrend);
      printField("  roc5", entrySnap.ind.roc5, exitSnap?.ind?.roc5);
      printField("  roc20", entrySnap.ind.roc20, exitSnap?.ind?.roc20);
      printField("  macdHist", entrySnap.ind.macdHist, exitSnap?.ind?.macdHist);
      printField("  priceVsEma50", entrySnap.ind.priceVsEma50, exitSnap?.ind?.priceVsEma50);
    }

    if (entrySnap.flow) {
      console.log("  [Trade Flow - 60s window]");
      printField("  buyVol", entrySnap.flow.buyVol, exitSnap?.flow?.buyVol);
      printField("  sellVol", entrySnap.flow.sellVol, exitSnap?.flow?.sellVol);
      printField("  buyCount", entrySnap.flow.buyCount, exitSnap?.flow?.buyCount);
      printField("  sellCount", entrySnap.flow.sellCount, exitSnap?.flow?.sellCount);
      const entryBuyRatio = entrySnap.flow.buyVol / (entrySnap.flow.buyVol + entrySnap.flow.sellVol);
      const exitBuyRatio = exitSnap?.flow ? exitSnap.flow.buyVol / (exitSnap.flow.buyVol + exitSnap.flow.sellVol) : undefined;
      printField("  buyRatio", entryBuyRatio, exitBuyRatio);
    }
  }

  // ============== AGGREGATE STATISTICS ==============
  console.log(`\n\n${"=".repeat(120)}`);
  console.log("AGGREGATE ENTRY STATISTICS — ALL WINNING TRADES");
  console.log(`${"=".repeat(120)}`);
  console.log(`(Based on ${matched.length} matched winning trades)\n`);

  // Collect all entry values
  const entryData: Record<string, number[]> = {};
  const categoricalData: Record<string, Record<string, number>> = {};

  const push = (key: string, val: number | undefined) => {
    if (val === undefined || val === null || isNaN(val)) return;
    if (!entryData[key]) entryData[key] = [];
    entryData[key].push(val);
  };

  const pushCat = (key: string, val: string | undefined) => {
    if (!val) return;
    if (!categoricalData[key]) categoricalData[key] = {};
    categoricalData[key][val] = (categoricalData[key][val] || 0) + 1;
  };

  // Also collect by side
  const longEntries: Record<string, number[]> = {};
  const shortEntries: Record<string, number[]> = {};

  for (const m of matched) {
    const s = m.entrySnap;
    const side = m.trade.side;
    const sideData = side === "Long" ? longEntries : shortEntries;
    const pushSide = (key: string, val: number | undefined) => {
      if (val === undefined || val === null || isNaN(val)) return;
      if (!sideData[key]) sideData[key] = [];
      sideData[key].push(val);
    };

    push("price24hPcnt", s.price24hPcnt);
    push("fundingRate", s.fundingRate);
    push("openInterest", s.openInterest);

    pushSide("price24hPcnt", s.price24hPcnt);
    pushSide("fundingRate", s.fundingRate);

    if (s.ob) {
      push("ob.bidDepth", s.ob.bidDepth);
      push("ob.askDepth", s.ob.askDepth);
      push("ob.imbalance", s.ob.imbalance);
      push("ob.spread", s.ob.spread);
      push("ob.bidWall", s.ob.bidWall);
      push("ob.askWall", s.ob.askWall);
      pushCat("ob.thinSide", s.ob.thinSide);

      pushSide("ob.imbalance", s.ob.imbalance);
      pushSide("ob.spread", s.ob.spread);
    }

    if (s.ind) {
      push("ind.rsi", s.ind.rsi);
      push("ind.stochK", s.ind.stochK);
      push("ind.stochD", s.ind.stochD);
      push("ind.bbPos", s.ind.bbPos);
      push("ind.bbWidth", s.ind.bbWidth);
      push("ind.atrPct", s.ind.atrPct);
      push("ind.volRatio", s.ind.volRatio);
      pushCat("ind.emaTrend", s.ind.emaTrend);
      push("ind.roc5", s.ind.roc5);
      push("ind.roc20", s.ind.roc20);
      push("ind.macdHist", s.ind.macdHist);
      push("ind.priceVsEma50", s.ind.priceVsEma50);

      pushSide("ind.rsi", s.ind.rsi);
      pushSide("ind.stochK", s.ind.stochK);
      pushSide("ind.bbPos", s.ind.bbPos);
      pushSide("ind.atrPct", s.ind.atrPct);
      pushSide("ind.roc5", s.ind.roc5);
    }

    if (s.flow) {
      push("flow.buyVol", s.flow.buyVol);
      push("flow.sellVol", s.flow.sellVol);
      push("flow.buyCount", s.flow.buyCount);
      push("flow.sellCount", s.flow.sellCount);
      const buyRatio = s.flow.buyVol / (s.flow.buyVol + s.flow.sellVol);
      push("flow.buyRatio", buyRatio);

      pushSide("flow.buyRatio", buyRatio);
    }
  }

  // Print aggregate stats
  const printStats = (label: string, key: string) => {
    const arr = entryData[key];
    if (!arr || !arr.length) {
      console.log(`  ${label.padEnd(22)} no data`);
      return;
    }
    const s = stats(arr);
    console.log(
      `  ${label.padEnd(22)} avg: ${fmt(s.avg, 4).padStart(12)}  med: ${fmt(s.med, 4).padStart(12)}  min: ${fmt(s.min, 4).padStart(12)}  max: ${fmt(s.max, 4).padStart(12)}  std: ${fmt(s.std, 4).padStart(12)}  n=${arr.length}`
    );
  };

  console.log("[Market Context]");
  printStats("price24hPcnt", "price24hPcnt");
  printStats("fundingRate", "fundingRate");
  printStats("openInterest", "openInterest");

  console.log("\n[Orderbook]");
  printStats("bidDepth", "ob.bidDepth");
  printStats("askDepth", "ob.askDepth");
  printStats("imbalance", "ob.imbalance");
  printStats("spread%", "ob.spread");
  printStats("bidWall", "ob.bidWall");
  printStats("askWall", "ob.askWall");

  if (categoricalData["ob.thinSide"]) {
    const d = categoricalData["ob.thinSide"];
    const total = Object.values(d).reduce((s, v) => s + v, 0);
    const dist = Object.entries(d)
      .map(([k, v]) => `${k}: ${v} (${((v / total) * 100).toFixed(0)}%)`)
      .join(", ");
    console.log(`  ${"thinSide".padEnd(22)} ${dist}`);
  }

  console.log("\n[Indicators]");
  printStats("rsi", "ind.rsi");
  printStats("stochK", "ind.stochK");
  printStats("stochD", "ind.stochD");
  printStats("bbPos", "ind.bbPos");
  printStats("bbWidth", "ind.bbWidth");
  printStats("atrPct", "ind.atrPct");
  printStats("volRatio", "ind.volRatio");
  printStats("roc5", "ind.roc5");
  printStats("roc20", "ind.roc20");
  printStats("macdHist", "ind.macdHist");
  printStats("priceVsEma50", "ind.priceVsEma50");

  if (categoricalData["ind.emaTrend"]) {
    const d = categoricalData["ind.emaTrend"];
    const total = Object.values(d).reduce((s, v) => s + v, 0);
    const dist = Object.entries(d)
      .map(([k, v]) => `${k}: ${v} (${((v / total) * 100).toFixed(0)}%)`)
      .join(", ");
    console.log(`  ${"emaTrend".padEnd(22)} ${dist}`);
  }

  console.log("\n[Trade Flow - 60s window]");
  printStats("buyVol", "flow.buyVol");
  printStats("sellVol", "flow.sellVol");
  printStats("buyCount", "flow.buyCount");
  printStats("sellCount", "flow.sellCount");
  printStats("buyRatio", "flow.buyRatio");

  // ============== SIDE BREAKDOWN ==============
  const longCount = matched.filter((m) => m.trade.side === "Long").length;
  const shortCount = matched.filter((m) => m.trade.side === "Short").length;

  console.log(`\n\n${"=".repeat(120)}`);
  console.log(`SIDE BREAKDOWN — Longs: ${longCount} | Shorts: ${shortCount}`);
  console.log(`${"=".repeat(120)}`);

  if (longCount > 0) {
    console.log(`\n  [LONG entries — ${longCount} trades]`);
    for (const [key, arr] of Object.entries(longEntries)) {
      const s = stats(arr);
      console.log(`    ${key.padEnd(22)} avg: ${fmt(s.avg, 4).padStart(12)}  med: ${fmt(s.med, 4).padStart(12)}  n=${arr.length}`);
    }
  }

  if (shortCount > 0) {
    console.log(`\n  [SHORT entries — ${shortCount} trades]`);
    for (const [key, arr] of Object.entries(shortEntries)) {
      const s = stats(arr);
      console.log(`    ${key.padEnd(22)} avg: ${fmt(s.avg, 4).padStart(12)}  med: ${fmt(s.med, 4).padStart(12)}  n=${arr.length}`);
    }
  }

  // ============== SYMBOL BREAKDOWN ==============
  console.log(`\n\n${"=".repeat(120)}`);
  console.log("SYMBOL BREAKDOWN");
  console.log(`${"=".repeat(120)}`);

  const bySymbol = new Map<string, MatchedTrade[]>();
  for (const m of matched) {
    const sym = m.trade.symbol;
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym)!.push(m);
  }

  for (const [sym, trades] of bySymbol) {
    console.log(`\n  [${sym} — ${trades.length} winning trades]`);
    for (const m of trades) {
      const s = m.entrySnap;
      const buyRatio = s.flow ? (s.flow.buyVol / (s.flow.buyVol + s.flow.sellVol)).toFixed(3) : "---";
      console.log(
        `    ${m.trade.side.padEnd(6)} PnL:$${m.trade.pnl.toFixed(2).padStart(6)} | RSI:${fmt(s.ind?.rsi, 1).padStart(5)} stK:${fmt(s.ind?.stochK, 1).padStart(5)} bbPos:${fmt(s.ind?.bbPos, 2).padStart(6)} atr:${fmt(s.ind?.atrPct, 2).padStart(5)}% ob-imb:${fmt(s.ob?.imbalance, 3).padStart(6)} thin:${(s.ob?.thinSide || "---").padEnd(4)} buyR:${buyRatio} trend:${s.ind?.emaTrend || "---"}`
      );
    }
  }

  // ============== KEY PATTERNS ==============
  console.log(`\n\n${"=".repeat(120)}`);
  console.log("KEY PATTERNS & OBSERVATIONS");
  console.log(`${"=".repeat(120)}`);

  // Check: does he short when thin side is ask?
  const shortMatched = matched.filter((m) => m.trade.side === "Short");
  const shortThinAsk = shortMatched.filter((m) => m.entrySnap.ob?.thinSide === "ask").length;
  console.log(`\n  Shorts entered when thinSide=ask: ${shortThinAsk}/${shortMatched.length} (${((shortThinAsk / shortMatched.length) * 100).toFixed(0)}%)`);

  const longMatched = matched.filter((m) => m.trade.side === "Long");
  const longThinBid = longMatched.filter((m) => m.entrySnap.ob?.thinSide === "bid").length;
  if (longMatched.length > 0) {
    console.log(`  Longs entered when thinSide=bid: ${longThinBid}/${longMatched.length} (${((longThinBid / longMatched.length) * 100).toFixed(0)}%)`);
  }

  // RSI range at entry
  const entryRsi = matched.map((m) => m.entrySnap.ind?.rsi).filter((v): v is number => v !== undefined);
  const rsiBelow40 = entryRsi.filter((v) => v < 40).length;
  const rsiAbove60 = entryRsi.filter((v) => v > 60).length;
  console.log(`  RSI < 40 at entry: ${rsiBelow40}/${entryRsi.length} (${((rsiBelow40 / entryRsi.length) * 100).toFixed(0)}%)`);
  console.log(`  RSI > 60 at entry: ${rsiAbove60}/${entryRsi.length} (${((rsiAbove60 / entryRsi.length) * 100).toFixed(0)}%)`);

  // Negative funding on shorts
  const shortNegFunding = shortMatched.filter((m) => (m.entrySnap.fundingRate ?? 0) < 0).length;
  console.log(`  Shorts with negative funding: ${shortNegFunding}/${shortMatched.length} (${shortMatched.length > 0 ? ((shortNegFunding / shortMatched.length) * 100).toFixed(0) : 0}%)`);

  // High OB imbalance
  const highImbalance = matched.filter((m) => Math.abs(m.entrySnap.ob?.imbalance ?? 0) > 0.3).length;
  console.log(`  Entries with |imbalance| > 0.3: ${highImbalance}/${matched.length} (${((highImbalance / matched.length) * 100).toFixed(0)}%)`);

  // bbPos extreme
  const bbLow = matched.filter((m) => (m.entrySnap.ind?.bbPos ?? 0.5) < 0.2).length;
  const bbHigh = matched.filter((m) => (m.entrySnap.ind?.bbPos ?? 0.5) > 0.8).length;
  console.log(`  bbPos < 0.2 (lower band): ${bbLow}/${matched.length} (${((bbLow / matched.length) * 100).toFixed(0)}%)`);
  console.log(`  bbPos > 0.8 (upper band): ${bbHigh}/${matched.length} (${((bbHigh / matched.length) * 100).toFixed(0)}%)`);

  // Sell pressure dominant (buyRatio < 0.4) on short entries
  const shortSellDominant = shortMatched.filter((m) => {
    if (!m.entrySnap.flow) return false;
    const br = m.entrySnap.flow.buyVol / (m.entrySnap.flow.buyVol + m.entrySnap.flow.sellVol);
    return br < 0.4;
  }).length;
  console.log(`  Shorts with buyRatio < 0.4 (sell pressure): ${shortSellDominant}/${shortMatched.length} (${shortMatched.length > 0 ? ((shortSellDominant / shortMatched.length) * 100).toFixed(0) : 0}%)`);

  // High ATR
  const highAtr = matched.filter((m) => (m.entrySnap.ind?.atrPct ?? 0) > 2).length;
  console.log(`  atrPct > 2% (high volatility): ${highAtr}/${matched.length} (${((highAtr / matched.length) * 100).toFixed(0)}%)`);

  // Below EMA50
  const belowEma = matched.filter((m) => (m.entrySnap.ind?.priceVsEma50 ?? 0) < 0).length;
  console.log(`  Price below EMA50: ${belowEma}/${matched.length} (${((belowEma / matched.length) * 100).toFixed(0)}%)`);
}

main().catch(console.error);
