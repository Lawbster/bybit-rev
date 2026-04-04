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

const cfg = loadBotConfig(path.resolve(process.cwd(), "bot-config.json"));
// Sim always uses $10k / $800 base — live equity is irrelevant, only params/scaling matter
cfg.initialCapital   = 10000;
cfg.basePositionUsdt = 800;
// Allow disabling priceTrigger for comparison: SIM_NO_PRICE_TRIG=1
if (process.env.SIM_NO_PRICE_TRIG) cfg.priceTriggerPct = 0;
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

// ── Sim types ─────────────────────────────────────────────────────
interface Pos { ep: number; et: number; qty: number; notional: number; }
interface MonthStats {
  ladderPnl: number; hedgePnl: number; wedPnl: number;
  n: number; wins: number; hedgeFires: number;
  kills: number; flats: number; stales: number;
  wedTrades: number; wedWins: number;
  peakDD: number; minEq: number; maxEq: number;
}
interface WedPos { ep: number; qty: number; notional: number; tpPrice: number; stopPrice: number; openedAt: number; wedDate: string; }

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
  capital: number; maxDD: number; totalLadderPnl: number; totalHedgePnl: number; totalWedPnl: number;
  totalTPs: number; totalStales: number; totalKills: number; totalFlats: number;
  totalHedgeFires: number; totalWedTrades: number; totalWedWins: number;
  monthly: Record<string, MonthStats>;
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
let totalTPs = 0, totalStales = 0, totalKills = 0, totalFlats = 0, totalHedgeFires = 0;
let totalWedTrades = 0, totalWedWins = 0;

let wedShort: WedPos | null = null;
let lastWedCloseDate = "";

const monthly: Record<string, MonthStats> = {};
function getMo(ts: number): MonthStats {
  const k = new Date(ts).toISOString().slice(0, 7);
  if (!monthly[k]) monthly[k] = { ladderPnl: 0, hedgePnl: 0, wedPnl: 0, n: 0, wins: 0, hedgeFires: 0, kills: 0, flats: 0, stales: 0, wedTrades: 0, wedWins: 0, peakDD: 0, minEq: Infinity, maxEq: 0 };
  return monthly[k];
}

function closeLadder(price: number, ts: number, reason: string) {
  let lPnl = 0;
  for (const p of longs) {
    const raw  = (price - p.ep) * p.qty;
    const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
    const fund = p.notional * FUNDING_RATE_8H * ((ts - p.et) / (8 * 3600000));
    lPnl += raw - fees - fund;
  }
  capital += lPnl;
  totalLadderPnl += lPnl;

  let hPnl = 0;
  if (hedge) {
    const raw  = (hedge.ep - price) * hedge.qty;
    const fees = hedge.notional * cfg.feeRate + price * hedge.qty * cfg.feeRate;
    hPnl = raw - fees;
    capital += hPnl;
    totalHedgePnl += hPnl;
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

  // Equity + DD tracking
  const longUr  = longs.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
  const hedgeUr = hedge ? (hedge.ep - close) * hedge.qty : 0;
  const wedUr   = wedShort ? (wedShort.ep - close) * wedShort.qty : 0;
  const eq = capital + longUr + hedgeUr + wedUr;
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

return { capital, maxDD, totalLadderPnl, totalHedgePnl, totalWedPnl,
         totalTPs, totalStales, totalKills, totalFlats,
         totalHedgeFires, totalWedTrades, totalWedWins, monthly };
}

// ── Run all 3 configurations ──────────────────────────────────────
const modes: { mode: RunMode; label: string }[] = [
  { mode: "ladder-only", label: "Ladder Only" },
  { mode: "no-hedge",    label: "Ladder + Wed-Short" },
  { mode: "full",        label: "Full Config (Ladder+Hedge+Wed)" },
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
console.log(`    CRSI hedge: threshold=${cfg.hedge.crsiThreshold}  size=${cfg.hedge.crsiNotionalPct*100}%  volBlock=${cfg.hedge.blockHighVol}`);

// ── Summary comparison table ──────────────────────────────────────
console.log(`\n  ${div}`);
console.log(`  ${"Config".padEnd(38)} ${"Equity".padEnd(12)} ${"Return".padEnd(10)} ${"MaxDD".padEnd(8)} ${"TPs".padEnd(5)} ${"Stales".padEnd(7)} ${"Kills".padEnd(6)} ${"Flats".padEnd(6)} ${"Hedge".padEnd(8)} ${"Wed".padEnd(8)}`);
console.log("  " + div);

for (const r of results) {
  const ret = ((r.capital / cfg.initialCapital - 1) * 100);
  const wedWR = r.totalWedTrades > 0 ? `${r.totalWedWins}/${r.totalWedTrades}` : "—";
  console.log(`  ${r.label.padEnd(38)} $${r.capital.toFixed(0).padStart(10)}  ${(ret >= 0 ? "+" : "") + ret.toFixed(1) + "%"}${" ".repeat(Math.max(0, 8 - ((ret >= 0 ? "+" : "") + ret.toFixed(1) + "%").length))} ${(r.maxDD.toFixed(1) + "%").padStart(6)}  ${String(r.totalTPs).padStart(3)}   ${String(r.totalStales).padStart(4)}    ${String(r.totalKills).padStart(3)}    ${String(r.totalFlats).padStart(3)}   $${r.totalHedgePnl >= 0 ? "+" : ""}${r.totalHedgePnl.toFixed(0).padStart(5)}  ${wedWR.padStart(5)}`);
}

// ── Month-by-month for each config ────────────────────────────────
for (const r of results) {
  const ret = ((r.capital / cfg.initialCapital - 1) * 100);
  console.log(`\n  ${sep}`);
  console.log(`  ${r.label}  —  $${r.capital.toFixed(0)} (${ret >= 0 ? "+" : ""}${ret.toFixed(1)}%)  MaxDD: ${r.maxDD.toFixed(1)}%`);
  console.log(`  ${div}`);
  console.log(`  ${"Month".padEnd(9)} ${"N".padEnd(4)} ${"WR".padEnd(6)} ${"Ladder".padEnd(11)} ${"Hedge".padEnd(10)} ${"Wed".padEnd(12)} ${"Net".padEnd(10)} ${"DD".padEnd(8)} ${"Equity Range".padEnd(18)} Exits`);
  console.log("  " + div);

  for (const mo of Object.keys(r.monthly).sort()) {
    const m = r.monthly[mo];
    const wr  = m.n > 0 ? (m.wins / m.n * 100).toFixed(0) : "0";
    const net = m.ladderPnl + m.hedgePnl + m.wedPnl;
    const lS  = (m.ladderPnl >= 0 ? "$+" : "$") + m.ladderPnl.toFixed(0);
    const hS  = (m.hedgePnl  >= 0 ? "$+" : "$") + m.hedgePnl.toFixed(0);
    const wS  = (m.wedPnl    >= 0 ? "$+" : "$") + m.wedPnl.toFixed(0);
    const nS  = (net >= 0 ? "$+" : "$") + net.toFixed(0);
    const ddS = m.peakDD.toFixed(1) + "%";
    const eqRange = `$${m.minEq === Infinity ? "?" : m.minEq.toFixed(0)}–$${m.maxEq.toFixed(0)}`;
    const exits = [
      m.kills  > 0 ? `${m.kills}K` : null,
      m.flats  > 0 ? `${m.flats}F` : null,
      m.stales > 0 ? `${m.stales}S` : null,
    ].filter(Boolean).join(" ") || "—";
    const wedStr = m.wedTrades > 0 ? `${m.wedTrades}t/${m.wedWins}w` : "";
    console.log(`  ${mo}  N=${String(m.n).padEnd(3)} WR=${wr.padStart(3)}%  Ladder=${lS.padStart(8)}  Hedge=${hS.padStart(7)}  Wed=${wS.padStart(7)}(${wedStr.padEnd(5)})  Net=${nS.padStart(8)}  DD=${ddS.padStart(6)}  ${eqRange.padEnd(18)} ${exits}`);
  }
}
console.log("  " + sep + "\n");
