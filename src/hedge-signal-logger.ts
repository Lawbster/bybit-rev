import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────
// Shadow hedge signal logger
// Reads market.jsonl snapshots, computes rolling microstructure signals,
// logs when hedge conditions fire. Does NOT touch the bot.
//
// Usage:
//   npx tsx src/hedge-signal-logger.ts                 # replay all symbols
//   npx tsx src/hedge-signal-logger.ts HYPEUSDT        # replay one symbol
//   npx tsx src/hedge-signal-logger.ts --tail           # tail mode (live on VPS)
// ─────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../data");

const SYMBOLS = [
  "HYPEUSDT", "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "SUIUSDT",
  "SIRENUSDT", "LIGHTUSDT", "DUSKUSDT", "RIVERUSDT", "CUSDT",
  "PIPPINUSDT", "BLUAIUSDT", "STGUSDT", "VVVUSDT", "TAOUSDT",
];

// ── Config ──
const CFG = {
  flowWindow: 5,        // minutes for flow rolling window
  obWindow: 3,          // minutes for OB rolling window
  oiWindowShort: 5,     // minutes for short OI delta
  oiWindowLong: 15,     // minutes for long OI delta

  // Signal thresholds
  flowSellRatio: 1.5,       // sellVol > X * buyVol
  obImbalanceThresh: -0.10, // imbalance below this = ask-heavy
  askWallRatio: 1.5,        // askWall > X * bidWall
  oiDeltaFlushPct: -0.5,    // OI drop > X% in window = washout (veto)

  // Indicator thresholds
  rsiMax: 42,
  roc5Max: 0,
  priceVsEma50Max: 0,
};

interface Snap {
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

interface RollingMetrics {
  // Flow
  flowBuyVol: number;
  flowSellVol: number;
  flowBuyCount: number;
  flowSellCount: number;
  flowSellRatio: number;    // sellVol / buyVol

  // OB
  avgImbalance: number;
  avgThinSide: string;      // most common thinSide in window
  avgAskWall: number;
  avgBidWall: number;
  wallRatio: number;        // askWall / bidWall

  // OI
  oiDelta5m: number;        // absolute change
  oiDelta5mPct: number;     // % change
  oiDelta15m: number;
  oiDelta15mPct: number;

  // Indicators (from latest snap)
  rsi: number | null;
  roc5: number | null;
  priceVsEma50: number | null;
  emaTrend: string | null;
}

interface Signal {
  ts: string;
  symbol: string;
  price: number;
  fundingRate: number;
  openInterest: number;

  // Which conditions fired
  flowDominance: boolean;       // sell flow > threshold
  bookPressure: boolean;        // OB leaning against bounce
  oiNotWashing: boolean;        // OI not flushing
  momentumDown: boolean;        // indicators bearish
  vetoWashout: boolean;         // VETO: OI flushing + flow flipping

  // All conditions met (excluding ladder state which we don't have)
  hedgeSignal: boolean;

  // Raw metrics for later analysis
  metrics: RollingMetrics;
}

function parseSnap(line: string): Snap | null {
  try {
    const j = JSON.parse(line);
    return { ...j, tsMs: new Date(j.ts).getTime() };
  } catch { return null; }
}

function computeRolling(window: Snap[], current: Snap): RollingMetrics {
  // Flow over flowWindow
  const flowSlice = window.slice(-CFG.flowWindow);
  const flowBuyVol = flowSlice.reduce((s, r) => s + r.flow.buyVol, 0);
  const flowSellVol = flowSlice.reduce((s, r) => s + r.flow.sellVol, 0);
  const flowBuyCount = flowSlice.reduce((s, r) => s + r.flow.buyCount, 0);
  const flowSellCount = flowSlice.reduce((s, r) => s + r.flow.sellCount, 0);
  const flowSellRatio = flowBuyVol > 0 ? flowSellVol / flowBuyVol : 999;

  // OB over obWindow
  const obSlice = window.slice(-CFG.obWindow);
  const avgImbalance = obSlice.reduce((s, r) => s + r.ob.imbalance, 0) / Math.max(1, obSlice.length);
  const avgAskWall = obSlice.reduce((s, r) => s + r.ob.askWall, 0) / Math.max(1, obSlice.length);
  const avgBidWall = obSlice.reduce((s, r) => s + r.ob.bidWall, 0) / Math.max(1, obSlice.length);
  const wallRatio = avgBidWall > 0 ? avgAskWall / avgBidWall : 999;

  // Most common thinSide
  const thinCounts: Record<string, number> = {};
  for (const r of obSlice) {
    thinCounts[r.ob.thinSide] = (thinCounts[r.ob.thinSide] || 0) + 1;
  }
  const avgThinSide = Object.entries(thinCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "balanced";

  // OI deltas
  const oiNow = current.openInterest;
  const snap5 = window.length >= CFG.oiWindowShort ? window[window.length - CFG.oiWindowShort] : window[0];
  const snap15 = window.length >= CFG.oiWindowLong ? window[window.length - CFG.oiWindowLong] : window[0];
  const oiDelta5m = oiNow - snap5.openInterest;
  const oiDelta5mPct = snap5.openInterest > 0 ? (oiDelta5m / snap5.openInterest) * 100 : 0;
  const oiDelta15m = oiNow - snap15.openInterest;
  const oiDelta15mPct = snap15.openInterest > 0 ? (oiDelta15m / snap15.openInterest) * 100 : 0;

  // Indicators from current snap
  const ind = current.ind;

  return {
    flowBuyVol, flowSellVol, flowBuyCount, flowSellCount, flowSellRatio,
    avgImbalance, avgThinSide, avgAskWall, avgBidWall, wallRatio,
    oiDelta5m, oiDelta5mPct, oiDelta15m, oiDelta15mPct,
    rsi: ind?.rsi ?? null,
    roc5: ind?.roc5 ?? null,
    priceVsEma50: ind?.priceVsEma50 ?? null,
    emaTrend: ind?.emaTrend ?? null,
  };
}

function evaluateSignal(symbol: string, current: Snap, metrics: RollingMetrics): Signal {
  // Condition 1: Sell flow dominance
  const flowDominance = metrics.flowSellRatio >= CFG.flowSellRatio
    && metrics.flowSellCount >= metrics.flowBuyCount;

  // Condition 2: Book leaning against bounce (any of)
  const bookPressure =
    metrics.avgImbalance < CFG.obImbalanceThresh
    || metrics.avgThinSide === "bid"
    || metrics.wallRatio >= CFG.askWallRatio;

  // Condition 3: OI not washing out
  const oiNotWashing = metrics.oiDelta5mPct >= CFG.oiDeltaFlushPct;

  // Condition 4: Momentum still down (need indicators)
  const hasInd = metrics.rsi !== null;
  const momentumDown = hasInd
    ? (metrics.rsi! <= CFG.rsiMax && metrics.roc5! < CFG.roc5Max && metrics.priceVsEma50! < CFG.priceVsEma50Max)
    : false;

  // Veto: washout = OI flushing hard + flow flipping to buy
  const vetoWashout = metrics.oiDelta15mPct < -0.5
    && metrics.flowSellRatio < 1.0;

  // All conditions met (no veto)
  const hedgeSignal = flowDominance && bookPressure && oiNotWashing && momentumDown && !vetoWashout;

  return {
    ts: current.ts,
    symbol,
    price: current.price,
    fundingRate: current.fundingRate,
    openInterest: current.openInterest,
    flowDominance,
    bookPressure,
    oiNotWashing,
    momentumDown,
    vetoWashout,
    hedgeSignal,
    metrics,
  };
}

function replaySymbol(symbol: string): Signal[] {
  const file = path.join(DATA_DIR, `${symbol}_market.jsonl`);
  if (!fs.existsSync(file)) return [];

  const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
  const snaps: Snap[] = [];
  const signals: Signal[] = [];
  const hedgeSignals: Signal[] = [];

  let condCounts = { flow: 0, book: 0, oi: 0, momentum: 0, veto: 0, all: 0 };

  for (const line of lines) {
    const snap = parseSnap(line);
    if (!snap) continue;
    snaps.push(snap);

    // Need at least oiWindowLong snapshots for rolling
    if (snaps.length < CFG.oiWindowLong) continue;

    const metrics = computeRolling(snaps, snap);
    const signal = evaluateSignal(symbol, snap, metrics);
    signals.push(signal);

    if (signal.flowDominance) condCounts.flow++;
    if (signal.bookPressure) condCounts.book++;
    if (signal.oiNotWashing) condCounts.oi++;
    if (signal.momentumDown) condCounts.momentum++;
    if (signal.vetoWashout) condCounts.veto++;
    if (signal.hedgeSignal) {
      condCounts.all++;
      hedgeSignals.push(signal);
    }
  }

  // Summary
  const total = signals.length;
  console.log(`\n── ${symbol} ──`);
  console.log(`  Snapshots: ${lines.length} | Evaluated: ${total}`);
  console.log(`  Window: ${snaps.length > 0 ? snaps[0].ts.slice(0, 16) : "N/A"} → ${snaps.length > 0 ? snaps[snaps.length - 1].ts.slice(0, 16) : "N/A"}`);
  console.log(`  Condition hits:`);
  console.log(`    Flow dominance:    ${condCounts.flow}/${total} (${(condCounts.flow / total * 100).toFixed(1)}%)`);
  console.log(`    Book pressure:     ${condCounts.book}/${total} (${(condCounts.book / total * 100).toFixed(1)}%)`);
  console.log(`    OI not washing:    ${condCounts.oi}/${total} (${(condCounts.oi / total * 100).toFixed(1)}%)`);
  console.log(`    Momentum down:     ${condCounts.momentum}/${total} (${(condCounts.momentum / total * 100).toFixed(1)}%)`);
  console.log(`    Veto (washout):    ${condCounts.veto}/${total} (${(condCounts.veto / total * 100).toFixed(1)}%)`);
  console.log(`    ALL → hedge signal: ${condCounts.all}/${total} (${(condCounts.all / total * 100).toFixed(1)}%)`);

  if (hedgeSignals.length > 0) {
    console.log(`\n  Hedge signals fired:`);
    console.log(`    ${"Time".padEnd(17)} ${"Price".padStart(10)} ${"RSI".padStart(5)} ${"ROC5".padStart(7)} ${"FlowR".padStart(6)} ${"Imbal".padStart(6)} ${"OI∆5m%".padStart(7)} ${"OI∆15m%".padStart(8)} ${"Fund%".padStart(7)}`);
    console.log(`    ${"-".repeat(85)}`);
    for (const s of hedgeSignals) {
      const m = s.metrics;
      console.log(`    ${s.ts.slice(0, 16)} ${("$" + s.price.toFixed(s.price > 100 ? 2 : 4)).padStart(10)} ${(m.rsi?.toFixed(1) ?? "N/A").padStart(5)} ${(m.roc5?.toFixed(2) ?? "N/A").padStart(7)} ${m.flowSellRatio.toFixed(2).padStart(6)} ${m.avgImbalance.toFixed(2).padStart(6)} ${m.oiDelta5mPct.toFixed(3).padStart(7)} ${m.oiDelta15mPct.toFixed(3).padStart(8)} ${(s.fundingRate * 100).toFixed(4).padStart(7)}`);
    }

    // What happened after each signal? Check price 5m, 15m, 30m, 60m later
    console.log(`\n  Post-signal price action:`);
    console.log(`    ${"Time".padEnd(17)} ${"Entry$".padStart(10)} ${"5m".padStart(7)} ${"15m".padStart(7)} ${"30m".padStart(7)} ${"60m".padStart(7)}`);
    console.log(`    ${"-".repeat(60)}`);
    for (const s of hedgeSignals) {
      const entryTs = new Date(s.ts).getTime();
      const entryPrice = s.price;
      const get = (mins: number) => {
        const target = entryTs + mins * 60000;
        const snap = snaps.find(x => x.tsMs >= target);
        if (!snap) return "  N/A";
        const pct = ((snap.price - entryPrice) / entryPrice) * 100;
        return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
      };
      console.log(`    ${s.ts.slice(0, 16)} ${("$" + entryPrice.toFixed(entryPrice > 100 ? 2 : 4)).padStart(10)} ${get(5).padStart(7)} ${get(15).padStart(7)} ${get(30).padStart(7)} ${get(60).padStart(7)}`);
    }
  }

  // Save signals to file
  const outFile = path.join(DATA_DIR, `${symbol}_hedge_signals.jsonl`);
  const out = hedgeSignals.map(s => JSON.stringify(s)).join("\n");
  if (hedgeSignals.length > 0) {
    fs.writeFileSync(outFile, out + "\n");
    console.log(`\n  Saved ${hedgeSignals.length} signals to ${path.basename(outFile)}`);
  }

  // Also save condition-level detail for analysis
  // Every minute where at least 2 conditions fire
  const partialFile = path.join(DATA_DIR, `${symbol}_hedge_partial.jsonl`);
  const partials = signals.filter(s => {
    const count = [s.flowDominance, s.bookPressure, s.oiNotWashing, s.momentumDown].filter(Boolean).length;
    return count >= 2 && !s.vetoWashout;
  });
  if (partials.length > 0) {
    fs.writeFileSync(partialFile, partials.map(s => JSON.stringify(s)).join("\n") + "\n");
    console.log(`  Saved ${partials.length} partial signals (>=2 conditions) to ${path.basename(partialFile)}`);
  }

  return hedgeSignals;
}

// ── Main ──
const args = process.argv.slice(2);
const tailMode = args.includes("--tail");
const singleSymbol = args.find(a => !a.startsWith("--"));

console.log("=".repeat(90));
console.log("  HEDGE SIGNAL SHADOW LOGGER");
console.log(`  Flow window: ${CFG.flowWindow}m | OB window: ${CFG.obWindow}m | OI windows: ${CFG.oiWindowShort}m/${CFG.oiWindowLong}m`);
console.log(`  Thresholds: flowSellR>=${CFG.flowSellRatio} | imbal<${CFG.obImbalanceThresh} | wallR>=${CFG.askWallRatio} | RSI<=${CFG.rsiMax}`);
console.log("=".repeat(90));

if (tailMode) {
  console.log("\nTail mode not yet implemented — run replay first to validate signals.");
  process.exit(0);
}

const syms = singleSymbol ? [singleSymbol] : SYMBOLS;
let totalSignals = 0;

for (const sym of syms) {
  const file = path.join(DATA_DIR, `${sym}_market.jsonl`);
  if (!fs.existsSync(file)) continue;
  const signals = replaySymbol(sym);
  totalSignals += signals.length;
}

console.log(`\n${"=".repeat(90)}`);
console.log(`  Total hedge signals across all symbols: ${totalSignals}`);
console.log(`${"=".repeat(90)}`);
