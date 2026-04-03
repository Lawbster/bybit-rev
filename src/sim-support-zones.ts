// ─────────────────────────────────────────────
// Support Zone Detection + Intraday Entry Sim
//
// Framework:
//   - Resample 5m → daily bars (in-memory, no extra files)
//   - Detect swing lows on daily data (low < N days each side)
//   - Cluster nearby pivots (within clusterPct%) into zones
//   - Track zone strength (touch count) and broken state
//   - Entry: 5m close enters an active zone from above
//   - Exit: fixed TP% / SL below zone low / EOD expiry
//
// Multi-pair: pass symbol as CLI arg or defaults to HYPEUSDT
//   npx ts-node src/sim-support-zones.ts HYPEUSDT
//   npx ts-node src/sim-support-zones.ts BTCUSDT
// ─────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { Candle } from "./fetch-candles";

// ── CLI ──
const SYMBOL = process.argv[2] || "HYPEUSDT";
const START_DATE = process.argv[3] || "2024-01-01";

// ── Load candles ──
function loadCandles(symbol: string): Candle[] {
  const dataDir = path.resolve(__dirname, "../data");
  const full = path.join(dataDir, `${symbol}_5_full.json`);
  const std  = path.join(dataDir, `${symbol}_5.json`);
  const file = fs.existsSync(full) ? full : fs.existsSync(std) ? std : null;
  if (!file) throw new Error(`No 5m data for ${symbol}. Run fetch-extend.ts first.`);
  const candles: Candle[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  candles.sort((a, b) => a.timestamp - b.timestamp);
  return candles;
}

// ── Resample 5m → daily bars ──
interface DailyBar {
  date: string;   // "2025-01-15"
  ts: number;     // midnight UTC ms
  open: number; high: number; low: number; close: number;
  volume: number; turnover: number;
}

function toDailyBars(candles: Candle[]): DailyBar[] {
  const map = new Map<string, DailyBar>();
  for (const c of candles) {
    const date = new Date(c.timestamp).toISOString().slice(0, 10);
    if (!map.has(date)) {
      map.set(date, {
        date, ts: new Date(date + "T00:00:00Z").getTime(),
        open: c.open, high: c.high, low: c.low, close: c.close,
        volume: c.volume, turnover: c.turnover,
      });
    } else {
      const d = map.get(date)!;
      if (c.high > d.high) d.high = c.high;
      if (c.low  < d.low)  d.low  = c.low;
      d.close   = c.close;
      d.volume  += c.volume;
      d.turnover += c.turnover;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
}

// ── Swing low detection ──
// A daily bar is a swing low if its low is the lowest within [i-wing, i+wing]
function findSwingLows(bars: DailyBar[], wing: number): { idx: number; price: number; date: string }[] {
  const pivots: { idx: number; price: number; date: string }[] = [];
  for (let i = wing; i < bars.length - wing; i++) {
    const lo = bars[i].low;
    let isPivot = true;
    for (let j = i - wing; j <= i + wing; j++) {
      if (j !== i && bars[j].low <= lo) { isPivot = false; break; }
    }
    if (isPivot) pivots.push({ idx: i, price: lo, date: bars[i].date });
  }
  return pivots;
}

// ── Zone clustering ──
interface Zone {
  midpoint: number;
  low: number;      // zone bottom (pivot low × (1 - halfBand))
  high: number;     // zone top    (pivot low × (1 + halfBand))
  touches: number;
  firstDate: string;
  lastTouchDate: string;
  broken: boolean;
  brokenDate: string | null;
}

function buildZones(
  pivots: { idx: number; price: number; date: string }[],
  bars: DailyBar[],
  clusterPct: number,   // group pivots within this % of each other
  bandHalfPct: number,  // zone is pivot ± this %
  minTouches: number,   // minimum touches to consider active
): Zone[] {
  // Sort pivots by price ascending for clustering
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const rawZones: Zone[] = [];

  for (const p of sorted) {
    // Try to merge into an existing zone
    let merged = false;
    for (const z of rawZones) {
      const diff = Math.abs(p.price - z.midpoint) / z.midpoint * 100;
      if (diff <= clusterPct) {
        z.midpoint = (z.midpoint * z.touches + p.price) / (z.touches + 1);
        z.touches++;
        z.low  = z.midpoint * (1 - bandHalfPct / 100);
        z.high = z.midpoint * (1 + bandHalfPct / 100);
        if (p.date > z.lastTouchDate) z.lastTouchDate = p.date;
        if (p.date < z.firstDate)     z.firstDate = p.date;
        merged = true;
        break;
      }
    }
    if (!merged) {
      rawZones.push({
        midpoint: p.price,
        low:  p.price * (1 - bandHalfPct / 100),
        high: p.price * (1 + bandHalfPct / 100),
        touches: 1,
        firstDate: p.date,
        lastTouchDate: p.date,
        broken: false,
        brokenDate: null,
      });
    }
  }

  return rawZones.filter(z => z.touches >= minTouches);
}

// ── Anchored VWAP ──
// Computes a per-candle VWAP value anchored to the most recent Monday 00:00 UTC.
// Resets every week. Uses turnover (USDT volume) / volume for precision.
// Returns a Map<timestamp, vwap> for O(1) lookup during sim.
function computeWeeklyAnchoredVwap(candles: Candle[]): Map<number, number> {
  const result = new Map<number, number>();
  let cumTurnover = 0;
  let cumVolume   = 0;
  let weekAnchor  = 0; // timestamp of current week's Monday 00:00 UTC

  for (const c of candles) {
    const d = new Date(c.timestamp);
    const dow = d.getUTCDay(); // 0=Sun, 1=Mon
    const dayStart = new Date(c.timestamp);
    dayStart.setUTCHours(0, 0, 0, 0);
    const mondayTs = dayStart.getTime() - (dow === 0 ? 6 : dow - 1) * 86400000;

    if (mondayTs !== weekAnchor) {
      // New week — reset
      weekAnchor  = mondayTs;
      cumTurnover = 0;
      cumVolume   = 0;
    }

    cumTurnover += c.turnover;
    cumVolume   += c.volume;
    result.set(c.timestamp, cumVolume > 0 ? cumTurnover / cumVolume : c.close);
  }

  return result;
}

// Swing-low anchored VWAP: resets each time price makes a new N-day low.
// Useful for catching bounces — VWAP from the last major low is overhead resistance
// or, when price returns to it from below, dynamic support.
function computeSwingLowAnchoredVwap(candles: Candle[], lookbackDays: number): Map<number, number> {
  const result     = new Map<number, number>();
  const lookbackMs = lookbackDays * 86400000;
  let anchorTs     = candles[0].timestamp;
  let lowestClose  = candles[0].close;
  let cumTurnover  = 0;
  let cumVolume    = 0;

  for (const c of candles) {
    // Check if this candle's close is a new low vs lookback window
    const windowStart = c.timestamp - lookbackMs;
    // Simplified: track running minimum and re-anchor when new low hit
    if (c.close < lowestClose) {
      lowestClose = c.close;
      anchorTs    = c.timestamp;
      cumTurnover = 0;
      cumVolume   = 0;
    }

    cumTurnover += c.turnover;
    cumVolume   += c.volume;
    result.set(c.timestamp, cumVolume > 0 ? cumTurnover / cumVolume : c.close);
  }

  return result;
}

// ── Zone state at a given point in time ──
// Returns zones that are:
//   a) formed before `asOfDate` (no lookahead)
//   b) not broken as of `asOfDate`
//   c) have >= minTouches
// Zones are rebuilt from pivots up to `asOfDate` only.
// For sim efficiency: precompute all daily pivots first,
// then for each trade date, filter pivots to only those before it.

interface SimCfg {
  label: string;
  swingWing: number;       // pivot detection: days each side
  clusterPct: number;      // merge pivots within this %
  bandHalfPct: number;     // zone width ± this % around midpoint
  minTouches: number;      // minimum historic touches
  breakThreshPct: number;  // zone broken if daily close > midpoint × (1 - this%)
  tpPct: number;           // TP above entry
  slBelowZonePct: number;  // SL: zone.low × (1 - this%) — gives a bit of room
  expiryHours: number;     // close position after N hours (0 = end of day)
  entryAfterH: number;     // UTC hour to start looking for entries
  entryBeforeH: number;    // UTC hour to stop
  // Anchored VWAP filter
  vwapType: "none" | "weekly" | "swingLow";  // which anchor to use
  vwapBandPct: number;     // entry only if price within this % of VWAP (0 = disabled)
  vwapBelow: boolean;      // true = price must be AT or BELOW VWAP (oversold relative to week)
  capitalPerTrade: number;
  fee: number;
}

interface TradeResult {
  date: string; entryH: number;
  entryPrice: number; exitPrice: number;
  zoneMid: number; zoneTouches: number;
  vwap: number; distFromVwapPct: number;
  reason: "TP" | "STOP" | "EXPIRY";
  pnlUsdt: number;
}

interface SimResult {
  trades: number; wins: number; stops: number; expiries: number;
  totalPnlUsdt: number; winRate: number; maxConsecLoss: number;
  avgWin: number; avgLoss: number; expectancy: number;
  monthly: Map<string, { pnl: number; trades: number; wins: number }>;
  tradeLog: TradeResult[];
}

function runSim(candles5m: Candle[], dailyBars: DailyBar[], cfg: SimCfg, startDate: string): SimResult {
  const startMs = new Date(startDate + "T00:00:00Z").getTime();

  // Precompute VWAP map
  const vwapMap: Map<number, number> =
    cfg.vwapType === "weekly"   ? computeWeeklyAnchoredVwap(candles5m) :
    cfg.vwapType === "swingLow" ? computeSwingLowAnchoredVwap(candles5m, 20) :
    new Map();

  // Precompute all swing lows on the full daily dataset (will filter by date in loop)
  const allPivots = findSwingLows(dailyBars, cfg.swingWing);

  // Group 5m candles by date
  const candlesByDate = new Map<string, Candle[]>();
  for (const c of candles5m) {
    if (c.timestamp < startMs) continue;
    const date = new Date(c.timestamp).toISOString().slice(0, 10);
    if (!candlesByDate.has(date)) candlesByDate.set(date, []);
    candlesByDate.get(date)!.push(c);
  }

  const tradingDates = Array.from(candlesByDate.keys()).sort();

  let trades = 0, wins = 0, stops = 0, expiries = 0, total = 0;
  let maxCL = 0, curCL = 0, sumWin = 0, sumLoss = 0, nWin = 0, nLoss = 0;
  const monthly = new Map<string, { pnl: number; trades: number; wins: number }>();
  const tradeLog: TradeResult[] = [];

  for (const date of tradingDates) {
    const dayCandlesAll = candlesByDate.get(date)!;

    // Zones known as of previous day's close (no lookahead)
    const prevDayIdx = dailyBars.findIndex(b => b.date >= date) - 1;
    if (prevDayIdx < cfg.swingWing * 2) continue; // not enough history

    const availBars    = dailyBars.slice(0, prevDayIdx + 1);
    const availPivots  = allPivots.filter(p => p.date < date);
    if (availPivots.length === 0) continue;

    // Build zones from available pivots
    const zones = buildZones(availPivots, availBars, cfg.clusterPct, cfg.bandHalfPct, cfg.minTouches);

    // Mark broken zones: any zone whose midpoint was breached on a prior daily bar
    for (const z of zones) {
      for (const b of availBars) {
        if (b.date <= z.firstDate) continue; // can't break before formation
        if (b.close < z.midpoint * (1 - cfg.breakThreshPct / 100)) {
          if (!z.broken || b.date < (z.brokenDate ?? "9999")) {
            z.broken = true;
            z.brokenDate = b.date;
          }
        }
      }
    }

    const activeZones = zones.filter(z => !z.broken);
    if (activeZones.length === 0) continue;

    // Scan 5m candles for entry
    const entryStartMs = new Date(date + "T00:00:00Z").getTime() + cfg.entryAfterH * 3600000;
    const entryEndMs   = new Date(date + "T00:00:00Z").getTime() + cfg.entryBeforeH * 3600000;

    let entered = false;
    for (let i = 0; i < dayCandlesAll.length && !entered; i++) {
      const c = dayCandlesAll[i];
      if (c.timestamp < entryStartMs) continue;
      if (c.timestamp >= entryEndMs) break;

      // VWAP filter for this candle
      const vwapVal = vwapMap.get(c.timestamp) ?? 0;
      if (cfg.vwapType !== "none" && cfg.vwapBandPct > 0 && vwapVal > 0) {
        const distPct = (c.close - vwapVal) / vwapVal * 100;
        if (cfg.vwapBelow) {
          // Must be at or below VWAP (price cheaper than week's average cost)
          if (distPct > cfg.vwapBandPct) continue;
        } else {
          // Must be within ±band of VWAP
          if (Math.abs(distPct) > cfg.vwapBandPct) continue;
        }
      }

      // Find if this candle's close is inside any active zone (entering from above = was above zone.high recently)
      for (const z of activeZones) {
        if (c.close >= z.low && c.close <= z.high) {
          // Confirm approach from above: check prior candle was above zone
          if (i > 0 && dayCandlesAll[i-1].close <= z.high) continue; // wasn't above zone

          const ep = c.close;
          const vwap = vwapVal > 0 ? vwapVal : ep;
          const distFromVwapPct = (ep - vwap) / vwap * 100;
          const tp = ep * (1 + cfg.tpPct / 100);
          const sl = z.low * (1 - cfg.slBelowZonePct / 100);

          const expMs = cfg.expiryHours > 0
            ? c.timestamp + cfg.expiryHours * 3600000
            : new Date(date + "T00:00:00Z").getTime() + 24 * 3600000 - 1;

          const scan = dayCandlesAll.slice(i + 1).filter(x => x.timestamp <= expMs);

          let exit = 0, reason: "TP"|"STOP"|"EXPIRY" = "EXPIRY";
          for (const sc of scan) {
            if (sc.high >= tp)     { exit = tp;  reason = "TP";   break; }
            if (sc.low  <= sl)     { exit = sl;  reason = "STOP"; break; }
            if (sc.timestamp >= expMs) { exit = sc.open; reason = "EXPIRY"; break; }
          }
          if (!exit) { const l = scan[scan.length-1]; exit = l ? l.close : ep; }

          const pnl = cfg.capitalPerTrade * ((exit - ep) / ep) - cfg.capitalPerTrade * cfg.fee * 2;
          trades++; total += pnl;
          const h = new Date(c.timestamp).getUTCHours();
          if (reason === "TP") { wins++; sumWin += pnl; nWin++; }
          else if (reason === "STOP") { stops++; sumLoss += pnl; nLoss++; }
          else { expiries++; if (pnl > 0) { sumWin += pnl; nWin++; } else { sumLoss += pnl; nLoss++; } }

          if (pnl <= 0) { curCL++; maxCL = Math.max(maxCL, curCL); } else curCL = 0;

          const mo = date.slice(0, 7);
          if (!monthly.has(mo)) monthly.set(mo, { pnl: 0, trades: 0, wins: 0 });
          const m = monthly.get(mo)!; m.pnl += pnl; m.trades++; if (pnl > 0) m.wins++;

          tradeLog.push({ date, entryH: h, entryPrice: ep, exitPrice: exit, zoneMid: z.midpoint, zoneTouches: z.touches, vwap, distFromVwapPct, reason, pnlUsdt: pnl });
          entered = true;
          break;
        }
      }
    }
  }

  const wr = trades > 0 ? wins / trades : 0;
  const avgWin  = nWin  > 0 ? sumWin  / nWin  : 0;
  const avgLoss = nLoss > 0 ? sumLoss / nLoss : 0;
  return {
    trades, wins, stops, expiries, totalPnlUsdt: total,
    winRate: wr * 100, maxConsecLoss: maxCL,
    avgWin, avgLoss, expectancy: wr * avgWin + (1 - wr) * avgLoss,
    monthly, tradeLog,
  };
}

function row(cfg: SimCfg, r: SimResult): string {
  const rr = r.avgLoss !== 0 ? Math.abs(r.avgWin / r.avgLoss).toFixed(2) : "∞";
  return `  ${cfg.label.padEnd(55)} ${String(r.trades).padStart(4)} ${(r.winRate.toFixed(0)+"%").padStart(6)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(9)} ${r.maxConsecLoss.toString().padStart(5)}  RR:${rr}  exp:$${r.expectancy.toFixed(1)}`;
}

function printMonthly(r: SimResult) {
  console.log(`  ${"Month".padEnd(8)} ${"N".padStart(4)} ${"Wins".padStart(5)} ${"WR".padStart(5)} ${"PnL".padStart(8)}`);
  console.log("  " + "-".repeat(35));
  for (const [mo, ms] of r.monthly) {
    const wr = ms.trades > 0 ? (ms.wins/ms.trades*100).toFixed(0)+"%" : "n/a";
    console.log(`  ${mo.padEnd(8)} ${String(ms.trades).padStart(4)} ${String(ms.wins).padStart(5)} ${wr.padStart(5)} ${((ms.pnl>=0?"+":"")+"$"+ms.pnl.toFixed(0)).padStart(8)}`);
  }
  const wr = r.trades > 0 ? r.winRate.toFixed(0)+"%" : "n/a";
  console.log(`  ${"TOTAL".padEnd(8)} ${String(r.trades).padStart(4)} ${String(r.wins).padStart(5)} ${wr.padStart(5)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(8)}`);
}

// ── Main ──
const SEP = "=".repeat(110);

console.log("\n" + SEP);
console.log(`  Support Zone Sim — ${SYMBOL}  (start: ${START_DATE})`);
console.log(SEP);

const candles5m  = loadCandles(SYMBOL);
const dailyBars  = toDailyBars(candles5m);
const firstDate  = dailyBars[0].date;
const lastDate   = dailyBars[dailyBars.length-1].date;
console.log(`\n  Data: ${candles5m.length} 5m candles | ${dailyBars.length} daily bars | ${firstDate} → ${lastDate}`);

// How many swing lows detected with default params?
const samplePivots = findSwingLows(dailyBars, 3);
const sampleZones  = buildZones(samplePivots, dailyBars, 2.0, 1.0, 2);
console.log(`  Swing lows (wing=3): ${samplePivots.length} | Zones (cluster 2%, band ±1%, min 2 touches): ${sampleZones.length}`);
console.log(`\n  Zone list (as of full dataset end):`);
for (const z of sampleZones.sort((a, b) => b.midpoint - a.midpoint)) {
  const status = z.broken ? `BROKEN ${z.brokenDate}` : `ACTIVE  (${z.touches} touches)`;
  console.log(`    $${z.low.toFixed(4).padStart(10)} – $${z.high.toFixed(4).padStart(10)}  mid=$${z.midpoint.toFixed(4).padStart(10)}  ${status}`);
}

const base: SimCfg = {
  label: "baseline: wing3 | cluster2% | band±1% | min2 | TP2% | SL@zone-0.5%",
  swingWing: 3, clusterPct: 2.0, bandHalfPct: 1.0, minTouches: 2,
  breakThreshPct: 2.0, tpPct: 2.0, slBelowZonePct: 0.5,
  expiryHours: 8, entryAfterH: 0, entryBeforeH: 22,
  vwapType: "none", vwapBandPct: 0, vwapBelow: false,
  capitalPerTrade: 1000, fee: 0.00055,
};

console.log("\n" + SEP);
console.log("  Parameter sweep");
console.log(SEP);
console.log(`\n  ${"Config".padEnd(55)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"MaxCL".padStart(5)}  RR  Exp/trade`);
console.log("  " + "-".repeat(100));

// A) TP sweep
console.log("\n  -- A) TP% sweep (base params) --");
for (const tp of [1.0, 1.5, 2.0, 3.0, 4.0]) {
  const cfg: SimCfg = { ...base, label: `TP ${tp}%`, tpPct: tp };
  console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
}

// B) Min touches
console.log("\n  -- B) Min zone touches required --");
for (const mt of [2, 3, 4]) {
  const cfg: SimCfg = { ...base, label: `min ${mt} touches | TP 2%`, minTouches: mt };
  console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
}

// C) Zone band width
console.log("\n  -- C) Zone band width ±% --");
for (const band of [0.5, 1.0, 1.5, 2.0]) {
  const cfg: SimCfg = { ...base, label: `band ±${band}% | TP 2%`, bandHalfPct: band };
  console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
}

// D) Swing wing (pivot sensitivity)
console.log("\n  -- D) Swing wing (days each side for pivot detection) --");
for (const wing of [2, 3, 4, 5]) {
  const cfg: SimCfg = { ...base, label: `wing=${wing} | TP 2%`, swingWing: wing };
  console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
}

// E) Session filter
console.log("\n  -- E) Session filter (TP 2%) --");
for (const [afterH, beforeH, label] of [
  [0,  24, "all hours"],
  [0,  8,  "Asian  00-08h"],
  [8,  16, "London 08-16h"],
  [13, 22, "US     13-22h"],
] as [number, number, string][]) {
  const cfg: SimCfg = { ...base, label: `${label} | TP 2%`, entryAfterH: afterH, entryBeforeH: beforeH };
  console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
}

// F) Expiry window
console.log("\n  -- F) Expiry (hours to hold) --");
for (const exp of [4, 8, 12, 24]) {
  const cfg: SimCfg = { ...base, label: `expiry ${exp}h | TP 2%`, expiryHours: exp };
  console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
}

// ── G) Anchored VWAP confluence ──
console.log("\n  -- G) Weekly anchored VWAP filter (zone entry only when near/below weekly VWAP) --");
console.log(`  ${"Config".padEnd(55)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"MaxCL".padStart(5)}  RR  Exp/trade`);
console.log("  " + "-".repeat(100));
console.log(row(base, runSim(candles5m, dailyBars, base, START_DATE)));

// Price at or below VWAP (oversold relative to week average) — various bands
for (const band of [1.0, 2.0, 3.0, 5.0]) {
  const cfg: SimCfg = { ...base, label: `weekly VWAP: price ≤ VWAP+${band}% | TP2%`, vwapType: "weekly", vwapBandPct: band, vwapBelow: true };
  console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
}
// Price within tight band of VWAP (at VWAP, either side)
for (const band of [0.5, 1.0, 2.0]) {
  const cfg: SimCfg = { ...base, label: `weekly VWAP: price within ±${band}% of VWAP | TP2%`, vwapType: "weekly", vwapBandPct: band, vwapBelow: false };
  console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
}

console.log("\n  -- H) Weekly VWAP + best session combo --");
console.log(`  ${"Config".padEnd(55)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"MaxCL".padStart(5)}  RR  Exp/trade`);
console.log("  " + "-".repeat(100));
for (const [afterH, beforeH, sess] of [[0,24,"all"],[8,16,"London"],[13,22,"US"]] as [number,number,string][]) {
  for (const band of [2.0, 3.0]) {
    const cfg: SimCfg = { ...base, label: `VWAP≤+${band}% | ${sess} | TP2%`, vwapType: "weekly", vwapBandPct: band, vwapBelow: true, entryAfterH: afterH, entryBeforeH: beforeH };
    console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
  }
}

// ── Best config deep-dive ──
console.log("\n" + SEP);
console.log("  Best config — monthly breakdown + trade log");
console.log(SEP);

// Collect all configs tested and pick best by expectancy
const allCandidates: SimCfg[] = [
  { ...base, label: "no VWAP | TP2% | 8h" },
  { ...base, label: "no VWAP | TP2% | wing4", swingWing: 4 },
  { ...base, label: "no VWAP | TP2% | London", entryAfterH: 8, entryBeforeH: 16 },
  { ...base, label: "no VWAP | TP2% | US",     entryAfterH: 13, entryBeforeH: 22 },
  { ...base, label: "VWAP≤+2% | TP2% | all",   vwapType: "weekly", vwapBandPct: 2.0, vwapBelow: true },
  { ...base, label: "VWAP≤+3% | TP2% | all",   vwapType: "weekly", vwapBandPct: 3.0, vwapBelow: true },
  { ...base, label: "VWAP≤+2% | TP2% | London", vwapType: "weekly", vwapBandPct: 2.0, vwapBelow: true, entryAfterH: 8,  entryBeforeH: 16 },
  { ...base, label: "VWAP≤+2% | TP2% | US",     vwapType: "weekly", vwapBandPct: 2.0, vwapBelow: true, entryAfterH: 13, entryBeforeH: 22 },
  { ...base, label: "VWAP≤+3% | TP2% | London", vwapType: "weekly", vwapBandPct: 3.0, vwapBelow: true, entryAfterH: 8,  entryBeforeH: 16 },
  { ...base, label: "VWAP≤+3% | TP2% | US",     vwapType: "weekly", vwapBandPct: 3.0, vwapBelow: true, entryAfterH: 13, entryBeforeH: 22 },
  { ...base, label: "VWAP±1% | TP2% | all",     vwapType: "weekly", vwapBandPct: 1.0, vwapBelow: false },
  { ...base, label: "VWAP±1% | TP2% | US",      vwapType: "weekly", vwapBandPct: 1.0, vwapBelow: false, entryAfterH: 13, entryBeforeH: 22 },
];

let bestR: SimResult | null = null;
let bestCfg: SimCfg = allCandidates[0];
for (const cfg of allCandidates) {
  const r = runSim(candles5m, dailyBars, cfg, START_DATE);
  if (r.trades >= 5 && (!bestR || r.expectancy > bestR.expectancy)) { bestR = r; bestCfg = cfg; }
}

if (bestR) {
  console.log(`\n  Best (min 5 trades): ${bestCfg.label}`);
  console.log(`  ${bestR.trades} trades | WR ${bestR.winRate.toFixed(0)}% | $${bestR.totalPnlUsdt.toFixed(0)} | maxCL ${bestR.maxConsecLoss} | exp/trade $${bestR.expectancy.toFixed(1)}`);
  console.log(`  Avg win: $${bestR.avgWin.toFixed(0)} | Avg loss: $${bestR.avgLoss.toFixed(0)}`);
  console.log("\n  Monthly:");
  printMonthly(bestR);
  console.log("\n  Trade log (entry, zone, VWAP dist, outcome):");
  console.log(`  ${"Date".padEnd(12)} ${"H".padStart(3)} ${"Zone".padStart(10)} ${"Tch".padStart(4)} ${"Entry".padStart(10)} ${"VWAP".padStart(10)} ${"VWAPdist".padStart(9)} ${"Reason".padStart(7)} ${"PnL".padStart(7)}`);
  console.log("  " + "-".repeat(85));
  for (const t of bestR.tradeLog) {
    const pnlStr  = (t.pnlUsdt >= 0 ? "+" : "") + "$" + t.pnlUsdt.toFixed(0);
    const distStr = (t.distFromVwapPct >= 0 ? "+" : "") + t.distFromVwapPct.toFixed(1) + "%";
    console.log(`  ${t.date.padEnd(12)} ${String(t.entryH).padStart(3)}h ${"$"+t.zoneMid.toFixed(2).padStart(9)} ${String(t.zoneTouches).padStart(4)} ${"$"+t.entryPrice.toFixed(2).padStart(9)} ${"$"+t.vwap.toFixed(2).padStart(9)} ${distStr.padStart(9)} ${t.reason.padStart(7)} ${pnlStr.padStart(7)}`);
  }
}
