import fs from "fs";
import path from "path";
import { loadCandles, Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Xwave Strategy Simulator
//
// Anchored Limit Martingale — reverse-engineered from xwave's 552 trades:
//   1. Open a position at current price (anchor)
//   2. Add positions at the SAME anchor price when revisited, at timed intervals
//   3. Scale each add by ~1.62x notional
//   4. Batch TP when price crosses anchor + TP%
//   5. After TP, set new anchor at current price
//
// Key difference from 2Moon: entries don't DCA into lower prices.
// All positions in a batch share the same entry price.
// ─────────────────────────────────────────────

interface SimConfig {
  symbol: string;
  tpPct: number;            // unleveraged TP% (xwave uses ~0.697)
  leverage: number;         // 35 for HYPE, 25 for RIVER
  maxPositions: number;     // 6-8 for HYPE, 6-10 for RIVER
  addIntervalMin: number;   // median ~40min HYPE, ~3min RIVER
  basePositionUsdt: number;
  addScaleFactor: number;   // ~1.62
  initialCapital: number;
  feeRate: number;
  startDate: string;

  // Anchor tolerance: how close must price be to anchor to allow a refill?
  // As a % of anchor price. 0 = must be exact (or below for longs).
  anchorTolerancePct: number;

  // Exit stack (can layer on top)
  emergencyKillPct: number;   // 0 = disabled
  portfolioKillPct: number;   // 0 = disabled

  // Funding
  fundingRate8h: number;

  // Trend gate
  useTrendGate: boolean;
}

const DEFAULT_CONFIG: SimConfig = {
  symbol: "HYPEUSDT",
  tpPct: 0.697,
  leverage: 35,
  maxPositions: 6,
  addIntervalMin: 40,
  basePositionUsdt: 44,
  addScaleFactor: 1.62,
  initialCapital: 5000,
  feeRate: 0.00055,
  startDate: "2025-01-20",

  anchorTolerancePct: 0.05,  // allow refill within 0.05% of anchor

  emergencyKillPct: -10,
  portfolioKillPct: 0,

  fundingRate8h: 0.0001,
  useTrendGate: true,
};

// Preset configs for quick testing
const PRESETS: Record<string, Partial<SimConfig>> = {
  "hype-xwave": {
    symbol: "HYPEUSDT",
    tpPct: 0.697,
    leverage: 35,
    maxPositions: 6,
    addIntervalMin: 40,
    basePositionUsdt: 44,
    addScaleFactor: 1.62,
  },
  "hype-xwave-8": {
    symbol: "HYPEUSDT",
    tpPct: 0.697,
    leverage: 35,
    maxPositions: 8,
    addIntervalMin: 40,
    basePositionUsdt: 44,
    addScaleFactor: 1.62,
  },
  "river-xwave": {
    symbol: "RIVERUSDT",
    tpPct: 0.697,
    leverage: 25,
    maxPositions: 6,
    addIntervalMin: 3,
    basePositionUsdt: 20,
    addScaleFactor: 1.62,
  },
  "river-xwave-10": {
    symbol: "RIVERUSDT",
    tpPct: 0.697,
    leverage: 25,
    maxPositions: 10,
    addIntervalMin: 3,
    basePositionUsdt: 20,
    addScaleFactor: 1.62,
  },
  // Hybrid: 2Moon DCA entries + xwave TP
  "hype-hybrid-07": {
    symbol: "HYPEUSDT",
    tpPct: 0.7,
    leverage: 50,
    maxPositions: 11,
    addIntervalMin: 30,
    basePositionUsdt: 800,
    addScaleFactor: 1.2,
  },
};

interface Position {
  entryPrice: number;
  entryTime: number;
  qty: number;
  notional: number;
}

// ─────────────────────────────────────────────
// Trend gate (same as sim-exits.ts)
// ─────────────────────────────────────────────
function buildTrendGate(candles: Candle[]): Map<number, boolean> {
  const period = 4 * 3600000;
  const bars: { ts: number; close: number }[] = [];
  let curBar = -1, lastClose = 0, lastTs = 0;

  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period);
    if (bar !== curBar) {
      if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });
      curBar = bar;
    }
    lastClose = c.close;
    lastTs = c.timestamp;
  }
  if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });

  const ema = (data: number[], p: number): number[] => {
    const k = 2 / (p + 1);
    const r = [data[0]];
    for (let i = 1; i < data.length; i++) r.push(data[i] * k + r[i - 1] * (1 - k));
    return r;
  };

  const closes = bars.map(b => b.close);
  const ema200 = ema(closes, 200);
  const ema50 = ema(closes, 50);

  const hostile = new Map<number, boolean>();
  for (let i = 1; i < bars.length; i++) {
    const isHostile = closes[i] < ema200[i] && ema50[i] < ema50[i - 1];
    const barStart = Math.floor(bars[i].ts / period) * period;
    hostile.set(barStart, isHostile);
  }

  return hostile;
}

function isTrendHostile(trendGate: Map<number, boolean>, timestamp: number): boolean {
  const period = 4 * 3600000;
  const currentBarStart = Math.floor(timestamp / period) * period;
  const prevBarStart = currentBarStart - period;
  return trendGate.get(prevBarStart) ?? false;
}

// ─────────────────────────────────────────────
// Xwave Simulator
//
// Two modes controlled by `mode` parameter:
//   "anchor" — xwave's actual strategy: all entries at same anchor price
//   "dca"    — 2Moon-style: entries at current market price (for comparison)
// ─────────────────────────────────────────────
type EntryMode = "anchor" | "dca";

function runSim(candles: Candle[], config: SimConfig, mode: EntryMode = "anchor") {
  const {
    tpPct, leverage, maxPositions, addIntervalMin, basePositionUsdt, addScaleFactor,
    initialCapital, feeRate, fundingRate8h, emergencyKillPct, portfolioKillPct,
    anchorTolerancePct, useTrendGate,
  } = config;

  const trendGate = useTrendGate ? buildTrendGate(candles) : new Map<number, boolean>();

  let capital = initialCapital;
  const positions: Position[] = [];
  let lastAddTime = 0;
  let anchorPrice = 0;   // current batch anchor (xwave mode)
  let peakCapital = capital;
  let maxDrawdown = 0;
  let maxConcurrent = 0;
  let totalFees = 0;
  let totalFunding = 0;
  let totalTrades = 0;
  let wins = 0;
  let minEquity = capital;
  let killed = false;
  let killReason = "";

  // Counters
  let batchTpCloses = 0;
  let emergencyKillCloses = 0;
  let portfolioKillCloses = 0;
  let trendBlockedAdds = 0;
  let anchorMissedAdds = 0;   // times price was too far from anchor to refill
  let totalBatches = 0;

  const monthPnl: Record<string, { trades: number; pnl: number; wins: number }> = {};

  const startTs = config.startDate ? new Date(config.startDate).getTime() : 0;

  function closeLadder(exitPrice: number, ts: number, isWin: boolean) {
    const m = new Date(ts).toISOString().slice(0, 7);
    if (!monthPnl[m]) monthPnl[m] = { trades: 0, pnl: 0, wins: 0 };

    for (const p of positions) {
      const pnlRaw = (exitPrice - p.entryPrice) * p.qty;
      const fees = p.notional * feeRate + exitPrice * p.qty * feeRate;
      const holdMs = ts - p.entryTime;
      const fundingIntervals = holdMs / (8 * 3600000);
      const funding = p.notional * fundingRate8h * fundingIntervals;
      const pnl = pnlRaw - fees - funding;
      capital += pnl;
      totalFees += fees;
      totalFunding += funding;
      totalTrades++;
      if (pnl > 0) { wins++; monthPnl[m].wins++; }
      monthPnl[m].trades++;
      monthPnl[m].pnl += pnl;
    }
    positions.length = 0;
    anchorPrice = 0;
    totalBatches++;
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp < startTs) continue;
    if (killed) break;

    const close = c.close;
    const high = c.high;
    const low = c.low;
    const ts = c.timestamp;

    // ── Exit checks ──

    if (positions.length > 0) {
      const totalQty = positions.reduce((s, p) => s + p.qty, 0);
      const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
      const avgPnlPct = ((close - avgEntry) / avgEntry) * 100;

      // Batch TP: check if high reaches TP price
      // In anchor mode, all entries are at anchor, so TP = anchor * (1 + tpPct/100)
      const tpPrice = avgEntry * (1 + tpPct / 100);
      if (high >= tpPrice) {
        batchTpCloses++;
        closeLadder(tpPrice, ts, true);
        continue;
      }

      // Emergency kill
      if (emergencyKillPct !== 0 && avgPnlPct <= emergencyKillPct) {
        emergencyKillCloses++;
        closeLadder(close, ts, false);
        continue;
      }
    }

    // Portfolio kill
    const ur = positions.reduce((s, p) => s + (close - p.entryPrice) * p.qty, 0);
    const equity = capital + ur;
    if (equity < minEquity) minEquity = equity;
    if (equity > peakCapital) peakCapital = equity;
    const dd = peakCapital > 0 ? ((peakCapital - equity) / peakCapital) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (portfolioKillPct > 0 && dd >= portfolioKillPct && positions.length > 0) {
      portfolioKillCloses++;
      closeLadder(close, ts, false);
      killed = true;
      killReason = `Portfolio DD ${dd.toFixed(1)}% >= ${portfolioKillPct}%`;
      break;
    }

    // ── Open / Add position ──
    const timeSinceAdd = (ts - lastAddTime) / 60000;
    if (positions.length < maxPositions && timeSinceAdd >= addIntervalMin && !killed) {
      // Trend gate
      if (useTrendGate && isTrendHostile(trendGate, ts)) {
        trendBlockedAdds++;
        continue;
      }

      const level = positions.length;
      const notional = basePositionUsdt * Math.pow(addScaleFactor, level);
      const margin = notional / leverage;
      const usedMargin = positions.reduce((s, p) => s + p.notional / leverage, 0);

      if (capital - usedMargin >= margin && capital > 0) {
        if (mode === "anchor") {
          // Xwave anchor logic:
          // If no anchor set (new batch), set anchor at current close and enter
          if (anchorPrice === 0) {
            anchorPrice = close;
            positions.push({ entryPrice: anchorPrice, entryTime: ts, qty: notional / anchorPrice, notional });
            lastAddTime = ts;
          } else {
            // Refill only if price is at or below anchor (within tolerance)
            const distPct = ((close - anchorPrice) / anchorPrice) * 100;
            if (distPct <= anchorTolerancePct) {
              // Enter at anchor price (limit order fill)
              positions.push({ entryPrice: anchorPrice, entryTime: ts, qty: notional / anchorPrice, notional });
              lastAddTime = ts;
            } else {
              anchorMissedAdds++;
            }
          }
        } else {
          // DCA mode: enter at market price (2Moon-style, for comparison)
          positions.push({ entryPrice: close, entryTime: ts, qty: notional / close, notional });
          lastAddTime = ts;
        }

        if (positions.length > maxConcurrent) maxConcurrent = positions.length;
      }
    }
  }

  // Force close remaining
  if (positions.length > 0 && !killed) {
    const last = candles[candles.length - 1];
    closeLadder(last.close, last.timestamp, false);
  }

  return {
    capital, totalTrades, wins, totalFees, totalFunding, maxDrawdown, maxConcurrent, minEquity,
    peakCapital, killed, killReason, monthPnl, totalBatches,
    counters: { batchTpCloses, emergencyKillCloses, portfolioKillCloses, trendBlockedAdds, anchorMissedAdds },
  };
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
function main() {
  const config = { ...DEFAULT_CONFIG };
  let preset = "";
  let runSweep = true;

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("preset=")) {
      preset = arg.split("=")[1];
    } else if (arg === "nosweep") {
      runSweep = false;
    } else {
      const [k, v] = arg.split("=");
      if (k && v && k in config) {
        (config as any)[k] = v === "true" ? true : v === "false" ? false : isNaN(Number(v)) ? v : Number(v);
      }
    }
  }

  if (preset && PRESETS[preset]) {
    Object.assign(config, PRESETS[preset]);
  }

  // Load candles
  let candles: Candle[];
  const fullPath = path.resolve(process.cwd(), `data/${config.symbol}_5_full.json`);
  if (fs.existsSync(fullPath)) {
    candles = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    console.log(`Using full history: ${candles.length} candles`);
  } else {
    candles = loadCandles(config.symbol, "5");
    console.log(`Using standard data: ${candles.length} candles`);
  }

  const from = new Date(candles[0].timestamp).toISOString().slice(0, 10);
  const to = new Date(candles[candles.length - 1].timestamp).toISOString().slice(0, 10);
  console.log(`Period: ${from} → ${to}\n`);

  // ── Header ──
  console.log(`${"═".repeat(90)}`);
  console.log(`  XWAVE STRATEGY SIM — ${config.symbol}`);
  console.log(`${"═".repeat(90)}\n`);

  console.log(`Config: $${config.basePositionUsdt} base, ${config.addScaleFactor}x scale, ${config.leverage}x lev, ${config.maxPositions} max pos`);
  console.log(`TP: ${config.tpPct}%, add interval: ${config.addIntervalMin}min, anchor tol: ${config.anchorTolerancePct}%`);
  console.log(`Capital: $${config.initialCapital}, fees: ${config.feeRate}, funding: ${config.fundingRate8h}/8h`);
  console.log(`Trend gate: ${config.useTrendGate ? "ON" : "OFF"}\n`);

  // ── Run anchor mode (xwave exact) ──
  const anchor = runSim(candles, config, "anchor");

  // ── Run DCA mode (same params, but DCA entries for comparison) ──
  const dca = runSim(candles, config, "dca");

  // ── Run anchor without trend gate ──
  const anchorNoTrend = runSim(candles, { ...config, useTrendGate: false }, "anchor");

  const fmt = (r: typeof anchor, label: string) => {
    const ret = ((r.capital / config.initialCapital - 1) * 100);
    const wr = r.totalTrades > 0 ? (r.wins / r.totalTrades * 100) : 0;
    const surv = r.minEquity > 0 ? "YES" : "NO ";
    console.log(`  ${label.padEnd(35)} | Ret: ${(ret.toFixed(1) + "%").padStart(9)} | DD: ${r.maxDrawdown.toFixed(1).padStart(5)}% | MinEq: $${r.minEquity.toFixed(0).padStart(7)} | ${surv} | ${r.totalTrades} trades (${wr.toFixed(0)}% WR) | ${r.totalBatches} batches`);
    if (r.killed) console.log(`  ${"".padEnd(35)} | KILLED: ${r.killReason}`);
    console.log(`  ${"".padEnd(35)} | Fees: $${r.totalFees.toFixed(0)} + $${r.totalFunding.toFixed(0)} fund | TP:${r.counters.batchTpCloses} emKill:${r.counters.emergencyKillCloses} portKill:${r.counters.portfolioKillCloses} trendBlk:${r.counters.trendBlockedAdds} anchorMiss:${r.counters.anchorMissedAdds}`);
  };

  fmt(anchor, "Xwave anchor (exact)");
  console.log("");
  fmt(dca, "DCA entries (same params)");
  console.log("");
  fmt(anchorNoTrend, "Xwave anchor (no trend gate)");

  // ── Monthly detail for anchor mode ──
  console.log(`\n${"═".repeat(90)}`);
  console.log("  MONTHLY — Xwave Anchor");
  console.log(`${"═".repeat(90)}\n`);

  console.log("Month     | Trades | Batches |    PnL   |  WR");
  console.log("─".repeat(55));

  // Calculate batches per month from trades (approximate: batches ≈ trades / avgBatchSize)
  for (const [m, v] of Object.entries(anchor.monthPnl).sort()) {
    const wr = v.trades > 0 ? (v.wins / v.trades * 100).toFixed(0) : "0";
    console.log(
      `${m.padEnd(10)}| ${String(v.trades).padStart(6)} | ${String("~").padStart(7)} | $${v.pnl.toFixed(0).padStart(7)} | ${wr.padStart(3)}%`
    );
  }

  if (!runSweep) return;

  // ── Parameter sweep ──
  console.log(`\n${"═".repeat(90)}`);
  console.log("  PARAMETER SWEEP");
  console.log(`${"═".repeat(90)}\n`);

  console.log("Config".padEnd(50) + "Return".padStart(9) + "MaxDD".padStart(8) + "MinEq".padStart(10) + "  Surv" + "  Trades" + "  Batches");
  console.log("─".repeat(100));

  const sweepConfigs: [string, Partial<SimConfig>, EntryMode][] = [
    // Exact xwave params
    ["Xwave exact (6 pos, 35x, 0.7%TP)", { maxPositions: 6 }, "anchor"],
    ["Xwave exact (8 pos)", { maxPositions: 8 }, "anchor"],

    // TP variations on anchor mode
    ["Anchor + 0.5% TP", { tpPct: 0.5 }, "anchor"],
    ["Anchor + 1.0% TP", { tpPct: 1.0 }, "anchor"],
    ["Anchor + 1.4% TP", { tpPct: 1.4 }, "anchor"],

    // Scale factor variations
    ["Anchor + 1.3x scale", { addScaleFactor: 1.3 }, "anchor"],
    ["Anchor + 1.4x scale", { addScaleFactor: 1.4 }, "anchor"],
    ["Anchor + 1.62x scale (xwave)", { addScaleFactor: 1.62 }, "anchor"],
    ["Anchor + 2.0x scale", { addScaleFactor: 2.0 }, "anchor"],

    // Max positions
    ["Anchor + max 4 pos", { maxPositions: 4 }, "anchor"],
    ["Anchor + max 5 pos", { maxPositions: 5 }, "anchor"],
    ["Anchor + max 8 pos", { maxPositions: 8 }, "anchor"],
    ["Anchor + max 10 pos", { maxPositions: 10 }, "anchor"],

    // Leverage variations
    ["Anchor + 25x lev", { leverage: 25 }, "anchor"],
    ["Anchor + 50x lev", { leverage: 50 }, "anchor"],

    // Add interval
    ["Anchor + 20min adds", { addIntervalMin: 20 }, "anchor"],
    ["Anchor + 60min adds", { addIntervalMin: 60 }, "anchor"],

    // Anchor tolerance
    ["Anchor + 0% tol (exact)", { anchorTolerancePct: 0 }, "anchor"],
    ["Anchor + 0.1% tol", { anchorTolerancePct: 0.1 }, "anchor"],
    ["Anchor + 0.5% tol", { anchorTolerancePct: 0.5 }, "anchor"],
    ["Anchor + 1.0% tol (loose)", { anchorTolerancePct: 1.0 }, "anchor"],

    // DCA comparison with same params
    ["DCA + 0.7% TP, 1.62x, 6 pos", {}, "dca"],
    ["DCA + 0.7% TP, 1.2x, 11 pos", { addScaleFactor: 1.2, maxPositions: 11 }, "dca"],
    ["DCA + 1.4% TP, 1.2x, 11 pos (2Moon)", { tpPct: 1.4, addScaleFactor: 1.2, maxPositions: 11, leverage: 50, basePositionUsdt: 800 }, "dca"],

    // Hybrid: 2Moon base + xwave TP
    ["Hybrid: 2Moon params + 0.7% TP", { tpPct: 0.7, addScaleFactor: 1.2, maxPositions: 11, leverage: 50, basePositionUsdt: 800, addIntervalMin: 30 }, "dca"],
    ["Hybrid: 2Moon + 0.7% TP + 1.4x scale", { tpPct: 0.7, addScaleFactor: 1.4, maxPositions: 8, leverage: 50, basePositionUsdt: 800, addIntervalMin: 30 }, "dca"],

    // No trend gate variants
    ["Anchor no trend gate", { useTrendGate: false }, "anchor"],
    ["DCA no trend gate + 0.7% TP", { useTrendGate: false }, "dca"],
  ];

  for (const [label, overrides, entryMode] of sweepConfigs) {
    const cfg = { ...config, ...overrides };
    const r = runSim(candles, cfg, entryMode);
    const ret = ((r.capital / cfg.initialCapital - 1) * 100);
    const wr = r.totalTrades > 0 ? (r.wins / r.totalTrades * 100) : 0;
    const surv = r.minEquity > 0 ? "YES" : "NO ";
    console.log(
      `${label.padEnd(50)} ${(ret.toFixed(1) + "%").padStart(9)} ${r.maxDrawdown.toFixed(1).padStart(7)}% $${r.minEquity.toFixed(0).padStart(8)}  ${surv}  ${String(r.totalTrades).padStart(6)}  ${String(r.totalBatches).padStart(7)}`
    );
  }
}

main();
