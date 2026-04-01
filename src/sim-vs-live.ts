import fs from "fs";
import path from "path";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Compare sim output vs actual live trades for Mar 30-31
// Live config: $100 base, 1.2x, 11 max, 50x, 1.4% TP, stale 8h→0.3%, kill -10%
// ─────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../data");

// Load live trades
const liveLines = fs.readFileSync(path.resolve(__dirname, "../logs/trades_2026-03-30.jsonl"), "utf-8").trim().split("\n");
const liveTrades = liveLines.map(l => JSON.parse(l));

console.log("=".repeat(100));
console.log("  LIVE TRADES (Mar 30-31)");
console.log("=".repeat(100));

// Parse live trade log
interface LiveEntry { ts: string; action: string; price: number; qty: number; notional: number; orderId?: string }
interface LiveClose { ts: string; positionsClosed: number; totalPnl: number; totalFees: number; avgEntry: number; exitPrice: number }

const opens: LiveEntry[] = [];
const closes: LiveClose[] = [];

for (const t of liveTrades) {
  if (t.action === "OPEN_LONG") {
    opens.push({ ts: t.ts, action: t.action, price: t.price, qty: t.qty, notional: t.notional });
  } else if (t.action === "BATCH_CLOSE") {
    closes.push({ ts: t.ts, positionsClosed: t.positionsClosed, totalPnl: t.totalPnl, totalFees: t.totalFees, avgEntry: t.avgEntry, exitPrice: t.exitPrice });
  }
}

// Group opens into ladders (separated by closes)
let ladderNum = 1;
let ladderOpens: LiveEntry[] = [];
console.log();

for (const t of liveTrades) {
  if (t.action === "OPEN_LONG") {
    ladderOpens.push({ ts: t.ts, action: t.action, price: t.price, qty: t.qty, notional: t.notional });
  } else if (t.action === "BATCH_CLOSE") {
    console.log(`  Ladder ${ladderNum}: ${ladderOpens.length} positions`);
    let totalNot = 0;
    for (let i = 0; i < ladderOpens.length; i++) {
      const o = ladderOpens[i];
      totalNot += o.notional;
      console.log(`    ${i + 1}. ${o.ts.slice(11, 19)} $${o.price.toFixed(3).padStart(8)} qty=${o.qty.toString().padStart(5)} not=$${o.notional.toFixed(2)}`);
    }
    const holdMs = new Date(t.ts).getTime() - new Date(ladderOpens[0].ts).getTime();
    const holdH = (holdMs / 3600000).toFixed(1);
    console.log(`    → CLOSE at ${t.ts.slice(11, 19)} $${t.exitPrice.toFixed(3)} | avgEntry=$${t.avgEntry.toFixed(3)} | PnL=$${t.totalPnl.toFixed(2)} fees=$${t.totalFees.toFixed(2)} | hold=${holdH}h | totalNot=$${totalNot.toFixed(2)}`);
    console.log();
    ladderNum++;
    ladderOpens = [];
  }
}

if (ladderOpens.length > 0) {
  console.log(`  Ladder ${ladderNum} (STILL OPEN): ${ladderOpens.length} positions`);
  let totalNot = 0;
  for (let i = 0; i < ladderOpens.length; i++) {
    const o = ladderOpens[i];
    totalNot += o.notional;
    console.log(`    ${i + 1}. ${o.ts.slice(11, 19)} $${o.price.toFixed(3).padStart(8)} qty=${o.qty.toString().padStart(5)} not=$${o.notional.toFixed(2)}`);
  }
  console.log(`    → OPEN | totalNot=$${totalNot.toFixed(2)}`);
}

// ── Now run sim on same window ──
console.log("\n" + "=".repeat(100));
console.log("  SIM BACKTEST (same window, same config)");
console.log("=".repeat(100));

const candleFile = fs.existsSync(path.join(DATA_DIR, "HYPEUSDT_5_full.json"))
  ? "HYPEUSDT_5_full.json" : "HYPEUSDT_5.json";
const allCandles: Candle[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, candleFile), "utf-8"));

// Filter to Mar 30 window — but start trend gate warmup from beginning
const startTs = new Date("2026-03-30T16:00:00Z").getTime();
const endTs = new Date("2026-04-01T00:00:00Z").getTime();

// Build trend gate on full data
function buildTrendGate(candles: Candle[]) {
  const period = 4 * 3600000;
  const bars: { ts: number; close: number }[] = [];
  let curBar = -1, lastClose = 0, lastTs = 0;
  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period);
    if (bar !== curBar) { if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose }); curBar = bar; }
    lastClose = c.close; lastTs = c.timestamp;
  }
  if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });
  const ema = (d: number[], p: number) => { const k = 2 / (p + 1); const r = [d[0]]; for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k)); return r; };
  const closes = bars.map(b => b.close), e200 = ema(closes, 200), e50 = ema(closes, 50);
  const hostile = new Map<number, boolean>();
  for (let i = 1; i < bars.length; i++) {
    hostile.set(Math.floor(bars[i].ts / period) * period, closes[i] < e200[i] && e50[i] < e50[i - 1]);
  }
  return hostile;
}

function isHostile(gate: Map<number, boolean>, ts: number) {
  const p = 4 * 3600000;
  return gate.get(Math.floor(ts / p) * p - p) ?? false;
}

const gate = buildTrendGate(allCandles);

// Sim with live config
const cfg = {
  basePositionUsdt: 100,
  addScaleFactor: 1.2,
  maxPositions: 11,
  tpPct: 1.4,
  leverage: 50,
  addIntervalMin: 30,
  feeRate: 0.00055,
  staleHours: 8,
  reducedTpPct: 0.3,
  hardFlattenHours: 40,
  hardFlattenPct: -6,
  emergencyKillPct: -10,
  fundingRate8h: 0.0001,
};

let capital = 300; // approximate live starting capital
const pos: { ep: number; et: number; qty: number; notional: number; idx: number }[] = [];
let lastAdd = 0;
let simLadder = 1;
let simTotalPnl = 0;

console.log();

for (let i = 0; i < allCandles.length; i++) {
  const c = allCandles[i];
  if (c.timestamp < startTs || c.timestamp > endTs) continue;
  const { close, high, timestamp: ts } = c;

  // Exit logic
  if (pos.length > 0) {
    const tQty = pos.reduce((s, p) => s + p.qty, 0);
    const avgE = pos.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
    const avgPnl = ((close - avgE) / avgE) * 100;
    const oldH = (ts - pos[0].et) / 3600000;
    const isStale = cfg.staleHours > 0 && oldH >= cfg.staleHours && avgPnl < 0;
    const tp = isStale ? cfg.reducedTpPct : cfg.tpPct;
    const tpPrice = avgE * (1 + tp / 100);

    if (high >= tpPrice) {
      let pnl = 0, fees = 0;
      for (const p of pos) {
        const raw = (tpPrice - p.ep) * p.qty;
        const fee = p.notional * cfg.feeRate + tpPrice * p.qty * cfg.feeRate;
        const fund = p.notional * cfg.fundingRate8h * ((ts - p.et) / (8 * 3600000));
        pnl += raw - fee - fund;
        fees += fee;
      }
      const holdH = ((ts - pos[0].et) / 3600000).toFixed(1);
      const totalNot = pos.reduce((s, p) => s + p.notional, 0);
      console.log(`  Sim Ladder ${simLadder}: ${pos.length} positions`);
      for (let j = 0; j < pos.length; j++) {
        const p = pos[j];
        console.log(`    ${j + 1}. ${new Date(p.et).toISOString().slice(11, 19)} $${p.ep.toFixed(3).padStart(8)} qty=${p.qty.toFixed(1).padStart(5)} not=$${p.notional.toFixed(2)}`);
      }
      console.log(`    → CLOSE at ${new Date(ts).toISOString().slice(11, 19)} $${tpPrice.toFixed(3)} | avgEntry=$${avgE.toFixed(3)} | PnL=$${pnl.toFixed(2)} fees=$${fees.toFixed(2)} | hold=${holdH}h | ${isStale ? "STALE" : "TP"} | totalNot=$${totalNot.toFixed(2)}`);
      console.log();
      capital += pnl;
      simTotalPnl += pnl;
      simLadder++;
      pos.length = 0;
      continue;
    }

    if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) {
      let pnl = 0;
      for (const p of pos) {
        const raw = (close - p.ep) * p.qty;
        const fee = p.notional * cfg.feeRate + close * p.qty * cfg.feeRate;
        pnl += raw - fee;
      }
      console.log(`  Sim Ladder ${simLadder}: ${pos.length} positions → KILL at $${close.toFixed(3)} PnL=$${pnl.toFixed(2)}`);
      capital += pnl;
      simTotalPnl += pnl;
      simLadder++;
      pos.length = 0;
      continue;
    }
  }

  // Entry logic
  const gap = (ts - lastAdd) / 60000;
  if (pos.length < cfg.maxPositions && gap >= cfg.addIntervalMin) {
    if (!isHostile(gate, ts)) {
      const lvl = pos.length;
      const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, lvl);
      const margin = notional / cfg.leverage;
      const used = pos.reduce((s, p) => s + p.notional / cfg.leverage, 0);
      if (capital - used >= margin && capital > 0) {
        pos.push({ ep: close, et: ts, qty: notional / close, notional, idx: lvl });
        lastAdd = ts;
      }
    }
  }
}

// Still open positions
if (pos.length > 0) {
  const lastCandle = allCandles.filter(c => c.timestamp <= endTs).pop()!;
  let ur = 0;
  console.log(`  Sim Ladder ${simLadder} (STILL OPEN): ${pos.length} positions`);
  for (let j = 0; j < pos.length; j++) {
    const p = pos[j];
    const pnl = (lastCandle.close - p.ep) * p.qty;
    ur += pnl;
    console.log(`    ${j + 1}. ${new Date(p.et).toISOString().slice(11, 19)} $${p.ep.toFixed(3).padStart(8)} qty=${p.qty.toFixed(1).padStart(5)} not=$${p.notional.toFixed(2)} ur=$${pnl.toFixed(2)}`);
  }
  console.log(`    → mark=$${lastCandle.close.toFixed(3)} unrealized=$${ur.toFixed(2)}`);
}

console.log("\n" + "=".repeat(100));
console.log("  COMPARISON");
console.log("=".repeat(100));

const livePnl = closes.reduce((s, c) => s + c.totalPnl - c.totalFees, 0);
console.log(`\n  Live: ${closes.length} completed ladder(s), net PnL = $${livePnl.toFixed(2)}`);
console.log(`  Sim:  ${simLadder - 1} completed ladder(s), net PnL = $${simTotalPnl.toFixed(2)}`);
console.log(`  Δ PnL: $${(simTotalPnl - livePnl).toFixed(2)}`);
