// sim-exact.ts — Direct mirror of live bot, reads bot-config.json
//
// NO hardcoded params. NO sweep. NO variants.
// Reads bot-config.json and runs exactly one sim.
// Prints monthly breakdown + full summary.
//
// Usage: npx ts-node src/sim-exact.ts
// SIM_START=2025-10-01 npx ts-node src/sim-exact.ts
// ─────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { RSI, EMA, ATR } from "technicalindicators";
import { loadBotConfig } from "./bot/bot-config";
import { Candle } from "./fetch-candles";
import { BacktestTrade, writeCsv } from "./backtest-writer";

const cfg = loadBotConfig(path.resolve(process.cwd(), "bot-config.json"));
// Sim always uses $10k / $800 base — live equity is irrelevant, only params/scaling matter
cfg.initialCapital   = 10000;
cfg.basePositionUsdt = process.env.SIM_BASE ? parseInt(process.env.SIM_BASE) : 800;
// Allow disabling priceTrigger for comparison: SIM_NO_PRICE_TRIG=1
if (process.env.SIM_NO_PRICE_TRIG) cfg.priceTriggerPct = 0;
// Allow overriding addIntervalMin: SIM_ADD_INTERVAL=60
if (process.env.SIM_ADD_INTERVAL) cfg.addIntervalMin = parseInt(process.env.SIM_ADD_INTERVAL);
// Allow overriding priceTriggerPct: SIM_PRICE_TRIG=0.7
if (process.env.SIM_PRICE_TRIG) cfg.priceTriggerPct = parseFloat(process.env.SIM_PRICE_TRIG);
const START = process.env.SIM_START ?? "2025-10-01";

// ── Wed-short config (from wed-short-config.json) ────────────────
const wedCfg = {
  nearHighPct: 1.25,       // within 1.25% of rolling daily high
  entryAfterHourUTC: 18,   // Wed after 18:00 UTC
  tpPct: 1.0,              // TP: -1% below entry
  stopPct: 2.0,            // Stop: +2% above entry
  expiryHourUTC: 12,       // force-close Thu 12:00 UTC
  notionalUsdt: 1000,      // $1k notional per trade
  leverage: 10,
  feeRate: 0.00055,
};
try {
  const raw = JSON.parse(fs.readFileSync("wed-short-config.json", "utf-8"));
  Object.assign(wedCfg, raw);
} catch { /* use defaults */ }

// ── PF0-short config (from pf0-short-config.json) ────────────────
const pf0Cfg = {
  pumpBodyPct: 2.0,
  failHighPct: 0.3,
  lookbackBars: 3,
  tpPct: 1.0,
  stopPct: 2.0,
  maxHoldHours: 12,
  notionalUsdt: 3000,
  leverage: 50,
  cooldownMin: 60,
  feeRate: 0.00055,
};
try {
  const raw = JSON.parse(fs.readFileSync("pf0-short-config.json", "utf-8"));
  Object.assign(pf0Cfg, raw);
} catch { /* use defaults */ }
const startTs = new Date(START).getTime();
const FUNDING_RATE_8H = 0.0001; // avg funding cost per 8h period

// ── Data ─────────────────────────────────────────────────────────
const raw5m: Candle[]   = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
const btc5m: Candle[]   = JSON.parse(fs.readFileSync("data/BTCUSDT_5_full.json",  "utf-8"));
raw5m.sort((a, b) => a.timestamp - b.timestamp);
btc5m.sort((a, b) => a.timestamp - b.timestamp);

// ── Bar aggregation ───────────────────────────────────────────────
function aggregate(candles: Candle[], minutes: number): Candle[] {
  const ms = minutes * 60000;
  const map = new Map<number, Candle>();
  for (const c of candles) {
    const k = Math.floor(c.timestamp / ms) * ms;
    const bar = map.get(k);
    if (!bar) {
      map.set(k, { timestamp: k, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover ?? 0 });
    } else {
      bar.high   = Math.max(bar.high, c.high);
      bar.low    = Math.min(bar.low,  c.low);
      bar.close  = c.close;
      bar.volume += c.volume;
    }
  }
  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}

const c4H  = aggregate(raw5m, 240);
const c1H  = aggregate(raw5m, 60);
const btc1H = aggregate(btc5m, 60);

// ── EMA helper ────────────────────────────────────────────────────
function emaCalc(vals: number[], p: number): number[] {
  const k = 2 / (p + 1);
  const r = [vals[0]];
  for (let i = 1; i < vals.length; i++) r.push(vals[i] * k + r[i-1] * (1 - k));
  return r;
}

// ── Binary search: last bar with timestamp <= ts ──────────────────
function bsearch(ts: number[], target: number): number {
  let lo = 0, hi = ts.length - 1, res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= target) { res = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return res;
}

// ── Precompute: 4H trend gate ─────────────────────────────────────
// hostile = close < EMA200 AND EMA50 slope negative (last completed bar)
const trendHostileMap = new Map<number, boolean>();
{
  const closes = c4H.map(b => b.close);
  const e200 = emaCalc(closes, cfg.filters.trendEmaLong);
  const e50  = emaCalc(closes, cfg.filters.trendEmaShort);
  for (let i = 1; i < c4H.length; i++) {
    trendHostileMap.set(c4H[i].timestamp, closes[i] < e200[i] && e50[i] < e50[i-1]);
  }
}
const ts4H = c4H.map(b => b.timestamp);

function isTrendHostile(ts: number): boolean {
  if (!cfg.filters.trendBreak) return false;
  const i = bsearch(ts4H, ts);
  if (i < 1) return false;
  return trendHostileMap.get(c4H[i-1].timestamp) ?? false;
}

// ── Precompute: BTC 1H return ─────────────────────────────────────
const btcRetMap = new Map<number, number>();
{
  for (let i = 1; i < btc1H.length; i++) {
    btcRetMap.set(btc1H[i].timestamp, (btc1H[i].close - btc1H[i-1].close) / btc1H[i-1].close * 100);
  }
}
const tsBtc1H = btc1H.map(b => b.timestamp);

function getBtcRet(ts: number): number | null {
  const i = bsearch(tsBtc1H, ts);
  if (i < 1) return null;
  return btcRetMap.get(btc1H[i-1].timestamp) ?? null;
}

// ── Precompute: 1H RSI14 ──────────────────────────────────────────
const rsi1HMap = new Map<number, number>();
{
  const closes = c1H.map(b => b.close);
  const vals   = RSI.calculate({ period: 14, values: closes });
  const offset = closes.length - vals.length;
  for (let i = 0; i < vals.length; i++) rsi1HMap.set(c1H[i + offset].timestamp, vals[i]);
}

// ── Precompute: 1H ROC5 ───────────────────────────────────────────
const roc5Map = new Map<number, number>();
{
  const closes = c1H.map(b => b.close);
  for (let i = 5; i < closes.length; i++) {
    roc5Map.set(c1H[i].timestamp, (closes[i] - closes[i-5]) / closes[i-5] * 100);
  }
}
const ts1H = c1H.map(b => b.timestamp);

function get1H(ts: number): { rsi: number | null; roc5: number | null } {
  const i = bsearch(ts1H, ts);
  if (i < 1) return { rsi: null, roc5: null };
  const barTs = c1H[i-1].timestamp;
  return { rsi: rsi1HMap.get(barTs) ?? null, roc5: roc5Map.get(barTs) ?? null };
}

// ── Precompute: ATR vol gate for hedge ────────────────────────────
const hedgeVolBlockMap = new Map<number, boolean>();
{
  const highs  = c1H.map(b => b.high);
  const lows   = c1H.map(b => b.low);
  const closes = c1H.map(b => b.close);
  const atr14  = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
  const offset = closes.length - atr14.length;
  for (let i = 0; i < atr14.length; i++) {
    const barIdx = i + offset;
    const atrPct = (atr14[i] / closes[barIdx]) * 100;
    const lookback = Math.min(100, i + 1);
    const window: number[] = [];
    for (let k = Math.max(0, i - lookback + 1); k <= i; k++) {
      window.push((atr14[k] / closes[k + offset]) * 100);
    }
    window.sort((a, b) => a - b);
    const med = window[Math.floor(window.length / 2)];
    hedgeVolBlockMap.set(c1H[barIdx].timestamp, med > 0 && atrPct > med * cfg.hedge.atrVolMultiplier);
  }
}

function isHedgeVolBlocked(ts: number): boolean {
  if (!cfg.hedge.blockHighVol) return false;
  const i = bsearch(ts1H, ts);
  if (i < 1) return false;
  return hedgeVolBlockMap.get(c1H[i-1].timestamp) ?? false;
}

// ── Precompute: CRSI 4H ───────────────────────────────────────────
// ConnorsRSI(3,2,100)
const crsi4HMap = new Map<number, number>();
{
  const closes = c4H.map(b => b.close);
  for (let i = 103; i < closes.length; i++) {
    const sl   = closes.slice(0, i + 1);
    const r3   = RSI.calculate({ period: 3, values: sl });
    const streaks: number[] = [];
    let streak = 0;
    for (let j = 1; j < sl.length; j++) {
      if (sl[j] > sl[j-1])      streak = streak > 0 ? streak + 1 : 1;
      else if (sl[j] < sl[j-1]) streak = streak < 0 ? streak - 1 : -1;
      else                       streak = 0;
      streaks.push(streak);
    }
    const r2 = RSI.calculate({ period: 2, values: streaks.map(s => Math.abs(s)) });
    const pctRank = (arr: number[], val: number) => arr.filter(v => v <= val).length / arr.length * 100;
    const roc1 = sl.slice(1).map((v, j) => (v - sl[j]) / sl[j] * 100);
    const pr   = pctRank(roc1.slice(-100), roc1[roc1.length - 1]);
    const crsi = r3.length > 0 && r2.length > 0
      ? (r3[r3.length - 1] + r2[r2.length - 1] + pr) / 3
      : 50;
    crsi4HMap.set(c4H[i].timestamp, crsi);
  }
}

function getCrsi4H(ts: number): number | null {
  const i = bsearch(ts4H, ts);
  if (i < 1) return null;
  return crsi4HMap.get(c4H[i-1].timestamp) ?? null;
}

// ── Precompute: PF0 signal bars ──────────────────────────────────
// For each 1H bar, check if a PF0 signal just completed at this bar
// (i.e., this bar is the end of the lookback window after a pump).
// Returns the set of 1H timestamps where a short should be entered.
const pf0SignalSet = new Set<number>();
{
  for (let i = pf0Cfg.lookbackBars + 1; i < c1H.length; i++) {
    const pumpIdx = i - pf0Cfg.lookbackBars;
    const bar = c1H[pumpIdx];
    const bodyPct = ((bar.close - bar.open) / bar.open) * 100;
    if (bodyPct < pf0Cfg.pumpBodyPct) continue;

    const pumpHigh = bar.high;
    let failed = true;
    for (let j = pumpIdx + 1; j <= i; j++) {
      if (c1H[j].high > pumpHigh * (1 + pf0Cfg.failHighPct / 100)) { failed = false; break; }
    }
    if (!failed) continue;

    let hasRed = false;
    for (let j = pumpIdx + 1; j <= i; j++) {
      if (c1H[j].close < c1H[j].open) { hasRed = true; break; }
    }
    if (!hasRed) continue;

    // Signal confirmed at bar i (end of window)
    pf0SignalSet.add(c1H[i].timestamp);
  }
}

function isPF0Signal(ts: number): boolean {
  // Map 5m bar timestamp to the 1H bar it belongs to
  const hourTs = Math.floor(ts / 3600000) * 3600000;
  // Signal fires at end of completed 1H bar, so check the PREVIOUS hour
  // (the current 5m bar is in a new hour; the signal was set at the close of last hour)
  const prevHourTs = hourTs - 3600000;
  return pf0SignalSet.has(prevHourTs);
}

// ── Sim types ─────────────────────────────────────────────────────
interface Pos { ep: number; et: number; qty: number; notional: number; }
interface MonthStats {
  ladderPnl: number; hedgePnl: number; wedPnl: number; pf0Pnl: number;
  n: number; wins: number; hedgeFires: number;
  kills: number; flats: number; stales: number;
  wedTrades: number; wedWins: number;
  pf0Trades: number; pf0Wins: number;
  peakDD: number; minEq: number; maxEq: number;
}
interface WedPos { ep: number; qty: number; notional: number; tpPrice: number; stopPrice: number; openedAt: number; wedDate: string; }
interface PF0Pos { ep: number; qty: number; notional: number; tpPrice: number; stopPrice: number; openedAt: number; signalTs: number; }

// Build intraday rolling high from 5m bars (shared across runs)
const intradayHighAtBar = new Map<number, number>();
{
  let curDay = "";
  let runHigh = 0;
  for (const c of raw5m) {
    const day = new Date(c.timestamp).toISOString().slice(0, 10);
    if (day !== curDay) { curDay = day; runHigh = 0; }
    if (c.high > runHigh) runHigh = c.high;
    intradayHighAtBar.set(c.timestamp, runHigh);
  }
}

// ── Run configurations ────────────────────────────────────────────
type RunMode = "full" | "no-hedge" | "ladder-only";

function runSim(mode: RunMode): {
  capital: number; maxDD: number; totalLadderPnl: number; totalHedgePnl: number; totalWedPnl: number; totalPF0Pnl: number;
  totalTPs: number; totalStales: number; totalKills: number; totalFlats: number;
  totalHedgeFires: number; totalWedTrades: number; totalWedWins: number;
  totalPF0Trades: number; totalPF0Wins: number;
  monthly: Record<string, MonthStats>;
  trades: BacktestTrade[];
} {

let capital    = cfg.initialCapital;
let peakEq     = capital;
let maxDD      = 0;
let riskOffUntil = 0;

const longs: Pos[]    = [];
let hedge: Pos | null = null;
let lastAdd           = 0;
let lastEntryPrice    = 0;
let hedgeLastClose    = 0;
let hedgeArmed        = true;

let episodeOpenTs = 0;
let totalLadderPnl = 0;
let totalHedgePnl  = 0;
let totalWedPnl    = 0;
let totalPF0Pnl    = 0;
let totalTPs = 0, totalStales = 0, totalKills = 0, totalFlats = 0, totalHedgeFires = 0;
let totalWedTrades = 0, totalWedWins = 0;
let totalPF0Trades = 0, totalPF0Wins = 0;

let wedShort: WedPos | null = null;
let lastWedCloseDate = "";

let pf0Short: PF0Pos | null = null;
let pf0LastClose = 0;
let pf0LastSignalTs = 0;

const trades: BacktestTrade[] = [];
const monthly: Record<string, MonthStats> = {};
function getMo(ts: number): MonthStats {
  const k = new Date(ts).toISOString().slice(0, 7);
  if (!monthly[k]) monthly[k] = { ladderPnl: 0, hedgePnl: 0, wedPnl: 0, pf0Pnl: 0, n: 0, wins: 0, hedgeFires: 0, kills: 0, flats: 0, stales: 0, wedTrades: 0, wedWins: 0, pf0Trades: 0, pf0Wins: 0, peakDD: 0, minEq: Infinity, maxEq: 0 };
  return monthly[k];
}

function closeLadder(price: number, ts: number, reason: string) {
  const tQtyAll = longs.reduce((s, p) => s + p.qty, 0);
  const avgEntry = tQtyAll > 0 ? longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQtyAll : price;
  const totalNot = longs.reduce((s, p) => s + p.notional, 0);
  const ladderOpenTs = longs.length > 0 ? longs[0].et : ts;

  let lPnl = 0;
  let totalFees = 0;
  for (const p of longs) {
    const raw  = (price - p.ep) * p.qty;
    const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
    const fund = p.notional * FUNDING_RATE_8H * ((ts - p.et) / (8 * 3600000));
    totalFees += fees;
    lPnl += raw - fees - fund;
  }
  capital += lPnl;
  totalLadderPnl += lPnl;

  const outcome = reason === "TP" ? "tp" : reason === "KILL" ? "kill" : reason === "FLAT" ? "flat" : "stale";
  trades.push({
    strategy: "ladder", symbol: cfg.symbol, side: "long",
    entryTime: ladderOpenTs, exitTime: ts,
    entryPrice: avgEntry, exitPrice: price,
    notional: totalNot, pnlUsd: lPnl, pnlPct: totalNot > 0 ? (lPnl / totalNot) * 100 : 0,
    outcome, feesUsd: totalFees,
  });

  let hPnl = 0;
  if (hedge) {
    const raw  = (hedge.ep - price) * hedge.qty;
    const fees = hedge.notional * cfg.feeRate + price * hedge.qty * cfg.feeRate;
    hPnl = raw - fees;
    capital += hPnl;
    totalHedgePnl += hPnl;
    trades.push({
      strategy: "hedge", symbol: cfg.symbol, side: "short",
      entryTime: hedge.et, exitTime: ts,
      entryPrice: hedge.ep, exitPrice: price,
      notional: hedge.notional, pnlUsd: hPnl, pnlPct: (hPnl / hedge.notional) * 100,
      outcome: "flat", feesUsd: fees,
    });
    hedge = null;
  }

  const mo = getMo(ts);
  mo.ladderPnl += lPnl;
  mo.hedgePnl  += hPnl;
  mo.n++;
  if (lPnl > 0) mo.wins++;
  if (reason === "KILL")  { mo.kills++;  totalKills++;  }
  if (reason === "FLAT")  { mo.flats++;  totalFlats++;  }
  if (reason === "STALE") { mo.stales++; totalStales++; }
  if (reason === "TP")    totalTPs++;

  longs.length   = 0;
  lastEntryPrice = 0;
  episodeOpenTs  = 0;
  hedgeArmed     = true;
  hedgeLastClose = ts;
}

for (const c of raw5m) {
  if (c.timestamp < startTs) continue;
  const { close, high, timestamp: ts } = c;

  // ── Wed-short: check exits first ────────────────────────────────
  if (mode !== "ladder-only" && wedShort) {
    const expiryDay = new Date(wedShort.wedDate + "T00:00:00Z");
    expiryDay.setUTCDate(expiryDay.getUTCDate() + 1); // Thursday
    const expiryTs = expiryDay.getTime() + wedCfg.expiryHourUTC * 3600000;

    let wedClosed = false;
    let wedPnl = 0;
    // TP hit (price dropped to tpPrice — short profits)
    if (c.low <= wedShort.tpPrice) {
      wedPnl = (wedShort.ep - wedShort.tpPrice) * wedShort.qty
             - wedShort.notional * wedCfg.feeRate * 2;
      wedClosed = true;
    }
    // Stop hit (price rose to stopPrice — short loses)
    else if (high >= wedShort.stopPrice) {
      wedPnl = (wedShort.ep - wedShort.stopPrice) * wedShort.qty
             - wedShort.notional * wedCfg.feeRate * 2;
      wedClosed = true;
    }
    // Expiry
    else if (ts >= expiryTs) {
      wedPnl = (wedShort.ep - close) * wedShort.qty
             - wedShort.notional * wedCfg.feeRate * 2;
      wedClosed = true;
    }

    if (wedClosed) {
      const wedOutcome = c.low <= wedShort.tpPrice ? "tp" : high >= wedShort.stopPrice ? "stop" : "expiry";
      const wedExitPrice = wedOutcome === "tp" ? wedShort.tpPrice : wedOutcome === "stop" ? wedShort.stopPrice : close;
      trades.push({
        strategy: "wed-short", symbol: cfg.symbol, side: "short",
        entryTime: wedShort.openedAt, exitTime: ts,
        entryPrice: wedShort.ep, exitPrice: wedExitPrice,
        notional: wedShort.notional, pnlUsd: wedPnl, pnlPct: (wedPnl / wedShort.notional) * 100,
        outcome: wedOutcome, feesUsd: wedShort.notional * wedCfg.feeRate * 2,
      });
      capital += wedPnl;
      totalWedPnl += wedPnl;
      totalWedTrades++;
      if (wedPnl > 0) totalWedWins++;
      const mo = getMo(ts);
      mo.wedPnl += wedPnl;
      mo.wedTrades++;
      if (wedPnl > 0) mo.wedWins++;
      lastWedCloseDate = wedShort.wedDate;
      wedShort = null;
    }
  }

  // ── Wed-short: check entry ─────────────────────────────────────
  if (mode !== "ladder-only" && !wedShort) {
    const d = new Date(ts);
    const dow  = d.getUTCDay();  // 3 = Wednesday
    const hour = d.getUTCHours();
    const todayStr = d.toISOString().slice(0, 10);

    if (dow === 3 && hour >= wedCfg.entryAfterHourUTC && lastWedCloseDate !== todayStr) {
      const rollingHigh = intradayHighAtBar.get(ts) ?? 0;
      if (rollingHigh > 0) {
        const distFromHigh = (rollingHigh - close) / rollingHigh * 100;
        if (distFromHigh <= wedCfg.nearHighPct) {
          const qty = wedCfg.notionalUsdt / close;
          wedShort = {
            ep: close,
            qty,
            notional: wedCfg.notionalUsdt,
            tpPrice: close * (1 - wedCfg.tpPct / 100),
            stopPrice: close * (1 + wedCfg.stopPct / 100),
            openedAt: ts,
            wedDate: todayStr,
          };
        }
      }
    }
  }

  // ── PF0-short: check exits ──────────────────────────────────────
  if (mode !== "ladder-only" && pf0Short) {
    let pf0Closed = false;
    let pf0Pnl = 0;
    const holdH = (ts - pf0Short.openedAt) / 3600000;

    // Stop hit first (conservative for shorts)
    if (high >= pf0Short.stopPrice) {
      pf0Pnl = (pf0Short.ep - pf0Short.stopPrice) * pf0Short.qty
             - pf0Short.notional * pf0Cfg.feeRate * 2;
      pf0Closed = true;
    }
    // TP hit
    else if (c.low <= pf0Short.tpPrice) {
      pf0Pnl = (pf0Short.ep - pf0Short.tpPrice) * pf0Short.qty
             - pf0Short.notional * pf0Cfg.feeRate * 2;
      pf0Closed = true;
    }
    // Max hold expiry
    else if (holdH >= pf0Cfg.maxHoldHours) {
      pf0Pnl = (pf0Short.ep - close) * pf0Short.qty
             - pf0Short.notional * pf0Cfg.feeRate * 2;
      pf0Closed = true;
    }

    if (pf0Closed) {
      const pf0Outcome = high >= pf0Short.stopPrice ? "stop" : c.low <= pf0Short.tpPrice ? "tp" : "expiry";
      const pf0ExitPrice = pf0Outcome === "stop" ? pf0Short.stopPrice : pf0Outcome === "tp" ? pf0Short.tpPrice : close;
      trades.push({
        strategy: "pf0-short", symbol: cfg.symbol, side: "short",
        entryTime: pf0Short.openedAt, exitTime: ts,
        entryPrice: pf0Short.ep, exitPrice: pf0ExitPrice,
        notional: pf0Short.notional, pnlUsd: pf0Pnl, pnlPct: (pf0Pnl / pf0Short.notional) * 100,
        outcome: pf0Outcome, feesUsd: pf0Short.notional * pf0Cfg.feeRate * 2,
      });
      capital += pf0Pnl;
      totalPF0Pnl += pf0Pnl;
      totalPF0Trades++;
      if (pf0Pnl > 0) totalPF0Wins++;
      const mo = getMo(ts);
      mo.pf0Pnl += pf0Pnl;
      mo.pf0Trades++;
      if (pf0Pnl > 0) mo.pf0Wins++;
      pf0LastClose = ts;
      pf0Short = null;
    }
  }

  // ── PF0-short: check entry ────────────────────────────────────
  if (mode !== "ladder-only" && !pf0Short) {
    const pf0CooldownOk = (ts - pf0LastClose) >= pf0Cfg.cooldownMin * 60000;
    if (pf0CooldownOk && isPF0Signal(ts)) {
      // De-cluster: check this signal is new
      const hourTs = Math.floor(ts / 3600000) * 3600000;
      const sigTs = hourTs - 3600000;
      if (sigTs > pf0LastSignalTs) {
        const qty = pf0Cfg.notionalUsdt / close;
        pf0Short = {
          ep: close,
          qty,
          notional: pf0Cfg.notionalUsdt,
          tpPrice: close * (1 - pf0Cfg.tpPct / 100),
          stopPrice: close * (1 + pf0Cfg.stopPct / 100),
          openedAt: ts,
          signalTs: sigTs,
        };
        pf0LastSignalTs = sigTs;
      }
    }
  }

  // Equity + DD tracking
  const longUr  = longs.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
  const hedgeUr = hedge ? (hedge.ep - close) * hedge.qty : 0;
  const wedUr   = wedShort ? (wedShort.ep - close) * wedShort.qty : 0;
  const pf0Ur   = pf0Short ? (pf0Short.ep - close) * pf0Short.qty : 0;
  const eq = capital + longUr + hedgeUr + wedUr + pf0Ur;
  if (eq > peakEq) peakEq = eq;
  const dd = peakEq > 0 ? (peakEq - eq) / peakEq * 100 : 0;
  if (dd > maxDD) maxDD = dd;
  const mo = getMo(ts);
  if (dd > mo.peakDD) mo.peakDD = dd;
  if (eq < mo.minEq) mo.minEq = eq;
  if (eq > mo.maxEq) mo.maxEq = eq;

  // ── Exits ─────────────────────────────────────────────────────
  if (longs.length > 0) {
    const tQty    = longs.reduce((s, p) => s + p.qty, 0);
    const avgE    = longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
    const avgPnlP = (close - avgE) / avgE * 100;
    const ageH    = (ts - longs[0].et) / 3600000;
    const hostile = isTrendHostile(ts);
    const stale   = cfg.exits.softStale && ageH >= cfg.exits.staleHours && avgPnlP < 0;
    const tpPct   = stale ? cfg.exits.reducedTpPct : cfg.tpPct;
    const tpPrice = avgE * (1 + tpPct / 100);

    if (high >= tpPrice) {
      closeLadder(tpPrice, ts, stale ? "STALE" : "TP");
      continue;
    }
    if (cfg.exits.emergencyKill && avgPnlP <= cfg.exits.emergencyKillPct) {
      closeLadder(close, ts, "KILL");
      continue;
    }
    if (cfg.exits.hardFlatten && ageH >= cfg.exits.hardFlattenHours &&
        avgPnlP <= cfg.exits.hardFlattenPct && hostile) {
      closeLadder(close, ts, "FLAT");
      continue;
    }
  }

  // ── CRSI hedge ────────────────────────────────────────────────
  if (mode === "full" && cfg.hedge.enabled && longs.length > 0 && !hedge && hedgeArmed) {
    const cooldownOk = (ts - hedgeLastClose) >= cfg.hedge.cooldownMin * 60000;
    if (cooldownOk) {
      const crsi = getCrsi4H(ts);
      if (crsi !== null && crsi < cfg.hedge.crsiThreshold && !isHedgeVolBlocked(ts)) {
        const totalNotional = longs.reduce((s, p) => s + p.notional, 0);
        const hNotional     = totalNotional * cfg.hedge.crsiNotionalPct;
        hedge = { ep: close, et: ts, qty: hNotional / close, notional: hNotional };
        hedgeArmed = false; // one hedge per episode
        totalHedgeFires++;
        getMo(ts).hedgeFires++;
      }
    }
  }

  // ── Entry logic ───────────────────────────────────────────────
  if (longs.length >= cfg.maxPositions) continue;

  const timeGap  = (ts - lastAdd) / 60000;
  const timeOk   = timeGap >= cfg.addIntervalMin;
  const priceOk  = cfg.priceTriggerPct > 0 && longs.length > 0 &&
                   close <= lastEntryPrice * (1 - cfg.priceTriggerPct / 100);
  if (!timeOk && !priceOk) continue;

  // Trend gate
  if (isTrendHostile(ts)) continue;

  // BTC risk-off gate
  if (cfg.filters.marketRiskOff) {
    if (ts < riskOffUntil) continue;
    const btcRet = getBtcRet(ts);
    if (btcRet !== null && btcRet < cfg.filters.btcDropPct) {
      riskOffUntil = ts + cfg.filters.riskOffCooldownMin * 60000;
      continue;
    }
  }

  // Ladder-local kill (blocks adds, not a close)
  if (cfg.filters.ladderLocalKill && longs.length > 0) {
    const tQty  = longs.reduce((s, p) => s + p.qty, 0);
    const avgE  = longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
    const avgPP = (close - avgE) / avgE * 100;
    const ageH  = (ts - longs[0].et) / 3600000;
    if (ageH >= cfg.filters.maxUnderwaterHours && avgPP <= cfg.filters.maxUnderwaterPct) continue;
  }

  // Margin check
  const level     = longs.length;
  const notional  = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, level);
  const usedMargin = longs.reduce((s, p) => s + p.notional / cfg.leverage, 0) +
                     (hedge ? hedge.notional / cfg.leverage : 0);
  const margin    = notional / cfg.leverage;
  if (capital - usedMargin < margin || capital <= 0) continue;

  // Open rung
  if (longs.length === 0) episodeOpenTs = ts;
  longs.push({ ep: close, et: ts, qty: notional / close, notional });
  lastAdd         = ts;
  lastEntryPrice  = close;
}

return { capital, maxDD, totalLadderPnl, totalHedgePnl, totalWedPnl, totalPF0Pnl,
         totalTPs, totalStales, totalKills, totalFlats,
         totalHedgeFires, totalWedTrades, totalWedWins,
         totalPF0Trades, totalPF0Wins, monthly, trades };
}

// ── Run all 3 configurations ──────────────────────────────────────
const modes: { mode: RunMode; label: string }[] = [
  { mode: "ladder-only", label: "Ladder Only" },
  { mode: "no-hedge",    label: "Ladder + Wed + PF0" },
  { mode: "full",        label: "Full (Ladder+Hedge+Wed+PF0)" },
];

const results = modes.map(({ mode, label }) => ({ label, ...runSim(mode) }));

// ── Print ─────────────────────────────────────────────────────────
const sep = "═".repeat(90);
const div = "─".repeat(90);

console.log("\n" + sep);
console.log(`  SIM-EXACT — CONFIGURATION COMPARISON`);
console.log(`  Symbol: ${cfg.symbol}  |  Period: ${START} → present  |  Capital: $${cfg.initialCapital}  Base: $${cfg.basePositionUsdt}`);
console.log(sep);

console.log(`\n  Shared Params:`);
console.log(`    Scale: ×${cfg.addScaleFactor}  MaxPos: ${cfg.maxPositions}  TP: ${cfg.tpPct}%  Leverage: ${cfg.leverage}x  AddInterval: ${cfg.addIntervalMin}min`);
console.log(`    PriceTrig: ${cfg.priceTriggerPct}%  Filters: trend=${cfg.filters.trendBreak} btcRiskOff=${cfg.filters.marketRiskOff} ladderKill=${cfg.filters.ladderLocalKill}`);
console.log(`    Wed-short: $${wedCfg.notionalUsdt} notional ${wedCfg.leverage}x  near=${wedCfg.nearHighPct}%  TP=${wedCfg.tpPct}%  stop=${wedCfg.stopPct}%`);
console.log(`    PF0-short: $${pf0Cfg.notionalUsdt} notional ${pf0Cfg.leverage}x  pump>=${pf0Cfg.pumpBodyPct}%  TP=${pf0Cfg.tpPct}%  stop=${pf0Cfg.stopPct}%  maxHold=${pf0Cfg.maxHoldHours}h`);
console.log(`    CRSI hedge: threshold=${cfg.hedge.crsiThreshold}  size=${cfg.hedge.crsiNotionalPct*100}%  volBlock=${cfg.hedge.blockHighVol}`);

// ── Summary comparison table ──────────────────────────────────────
console.log(`\n  ${div}`);
console.log(`  ${"Config".padEnd(38)} ${"Equity".padEnd(12)} ${"Return".padEnd(10)} ${"MaxDD".padEnd(8)} ${"TPs".padEnd(5)} ${"Stales".padEnd(7)} ${"Kills".padEnd(6)} ${"Flats".padEnd(6)} ${"Hedge".padEnd(8)} ${"Wed".padEnd(8)} ${"PF0".padEnd(10)}`);
console.log("  " + div);

for (const r of results) {
  const ret = ((r.capital / cfg.initialCapital - 1) * 100);
  const wedWR = r.totalWedTrades > 0 ? `${r.totalWedWins}/${r.totalWedTrades}` : "—";
  const pf0WR = r.totalPF0Trades > 0 ? `${r.totalPF0Wins}/${r.totalPF0Trades}` : "—";
  const pf0S = r.totalPF0Pnl !== 0 ? `$${r.totalPF0Pnl >= 0 ? "+" : ""}${r.totalPF0Pnl.toFixed(0)}(${pf0WR})` : "—";
  console.log(`  ${r.label.padEnd(38)} $${r.capital.toFixed(0).padStart(10)}  ${(ret >= 0 ? "+" : "") + ret.toFixed(1) + "%"}${" ".repeat(Math.max(0, 8 - ((ret >= 0 ? "+" : "") + ret.toFixed(1) + "%").length))} ${(r.maxDD.toFixed(1) + "%").padStart(6)}  ${String(r.totalTPs).padStart(3)}   ${String(r.totalStales).padStart(4)}    ${String(r.totalKills).padStart(3)}    ${String(r.totalFlats).padStart(3)}   $${r.totalHedgePnl >= 0 ? "+" : ""}${r.totalHedgePnl.toFixed(0).padStart(5)}  ${wedWR.padStart(5)}  ${pf0S}`);
}

// ── Month-by-month for each config ────────────────────────────────
for (const r of results) {
  const ret = ((r.capital / cfg.initialCapital - 1) * 100);
  console.log(`\n  ${sep}`);
  console.log(`  ${r.label}  —  $${r.capital.toFixed(0)} (${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%)  MaxDD: ${r.maxDD.toFixed(1)}%`);
  console.log(`  ${div}`);
  console.log(`  ${"Month".padEnd(9)} ${"N".padEnd(4)} ${"WR".padEnd(6)} ${"Ladder".padEnd(11)} ${"Hedge".padEnd(10)} ${"Wed".padEnd(12)} ${"PF0".padEnd(14)} ${"Net".padEnd(10)} ${"DD".padEnd(8)} ${"Equity Range".padEnd(18)} Exits`);
  console.log("  " + div);

  for (const mo of Object.keys(r.monthly).sort()) {
    const m = r.monthly[mo];
    const wr  = m.n > 0 ? (m.wins / m.n * 100).toFixed(0) : "0";
    const net = m.ladderPnl + m.hedgePnl + m.wedPnl + m.pf0Pnl;
    const lS  = (m.ladderPnl >= 0 ? "$+" : "$") + m.ladderPnl.toFixed(0);
    const hS  = (m.hedgePnl  >= 0 ? "$+" : "$") + m.hedgePnl.toFixed(0);
    const wS  = (m.wedPnl    >= 0 ? "$+" : "$") + m.wedPnl.toFixed(0);
    const pS  = (m.pf0Pnl    >= 0 ? "$+" : "$") + m.pf0Pnl.toFixed(0);
    const nS  = (net >= 0 ? "$+" : "$") + net.toFixed(0);
    const ddS = m.peakDD.toFixed(1) + "%";
    const eqRange = `$${m.minEq === Infinity ? "?" : m.minEq.toFixed(0)}–$${m.maxEq.toFixed(0)}`;
    const exits = [
      m.kills  > 0 ? `${m.kills}K` : null,
      m.flats  > 0 ? `${m.flats}F` : null,
      m.stales > 0 ? `${m.stales}S` : null,
    ].filter(Boolean).join(" ") || "—";
    const wedStr = m.wedTrades > 0 ? `${m.wedTrades}t/${m.wedWins}w` : "";
    const pf0Str = m.pf0Trades > 0 ? `${m.pf0Trades}t/${m.pf0Wins}w` : "";
    console.log(`  ${mo}  N=${String(m.n).padEnd(3)} WR=${wr.padStart(3)}%  Ladder=${lS.padStart(8)}  Hedge=${hS.padStart(7)}  Wed=${wS.padStart(7)}(${wedStr.padEnd(5)})  PF0=${pS.padStart(7)}(${pf0Str.padEnd(5)})  Net=${nS.padStart(8)}  DD=${ddS.padStart(6)}  ${eqRange.padEnd(18)} ${exits}`);
  }
}
console.log("  " + sep + "\n");

// ── Write CSV output ─────────────────────────────────────────────
const modeFileNames: Record<RunMode, string> = {
  "ladder-only": "exact-ladder-only",
  "no-hedge": "exact-no-hedge",
  "full": "exact-full",
};
for (const { mode, label } of modes) {
  const r = results.find(r => r.label === label)!;
  writeCsv(r.trades, { strategy: modeFileNames[mode], symbol: cfg.symbol, params: {} });
}
