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
// Sim defaults: $10k / $800 base. Override with SIM_CAPITAL=20000 SIM_BASE=1200
cfg.initialCapital   = process.env.SIM_CAPITAL ? parseInt(process.env.SIM_CAPITAL) : 10000;
cfg.basePositionUsdt = process.env.SIM_BASE ? parseInt(process.env.SIM_BASE) : 800;
// Allow disabling priceTrigger for comparison: SIM_NO_PRICE_TRIG=1
if (process.env.SIM_NO_PRICE_TRIG) cfg.priceTriggerPct = 0;
// Allow overriding addIntervalMin: SIM_ADD_INTERVAL=60
if (process.env.SIM_ADD_INTERVAL) cfg.addIntervalMin = parseInt(process.env.SIM_ADD_INTERVAL);
// Allow overriding priceTriggerPct: SIM_PRICE_TRIG=0.7
if (process.env.SIM_PRICE_TRIG) cfg.priceTriggerPct = parseFloat(process.env.SIM_PRICE_TRIG);
// Stale overrides: SIM_STALE_OFF=1, SIM_STALE_TP=0.6, SIM_STALE_HOURS=10
if (process.env.SIM_STALE_OFF) cfg.exits.softStale = false;
if (process.env.SIM_STALE_TP) cfg.exits.reducedTpPct = parseFloat(process.env.SIM_STALE_TP);
if (process.env.SIM_STALE_HOURS) cfg.exits.staleHours = parseInt(process.env.SIM_STALE_HOURS);
// Ablation toggles: SIM_NO_TREND=1 SIM_NO_RISKOFF=1 SIM_NO_LADDER_KILL=1
//   SIM_NO_HARD_FLAT=1 SIM_NO_EMERGENCY=1 SIM_NO_FORCED_CD=1
if (process.env.SIM_NO_TREND) cfg.filters.trendBreak = false;
if (process.env.SIM_NO_RISKOFF) cfg.filters.marketRiskOff = false;
if (process.env.SIM_NO_LADDER_KILL) cfg.filters.ladderLocalKill = false;
if (process.env.SIM_NO_HARD_FLAT) cfg.exits.hardFlatten = false;
if (process.env.SIM_NO_EMERGENCY) cfg.exits.emergencyKill = false;
if (process.env.SIM_EMERGENCY_PCT) cfg.exits.emergencyKillPct = parseFloat(process.env.SIM_EMERGENCY_PCT);
const SKIP_FORCED_CD = !!process.env.SIM_NO_FORCED_CD;
// Funding-spike top guard:
//   SIM_FUND_GUARD=close  → force-close ladder when depth+funding both trip
//   SIM_FUND_GUARD=block  → block further adds only (don't close existing)
//   SIM_FUND_DEPTH=8      → rung depth threshold (default 8)
//   SIM_FUND_RATE=0.0005  → funding rate threshold in decimal (default 0.05%/8h)
const FUND_GUARD = process.env.SIM_FUND_GUARD || "off";
const FUND_DEPTH = parseInt(process.env.SIM_FUND_DEPTH || "8");
const FUND_RATE  = parseFloat(process.env.SIM_FUND_RATE || "0.0005");
// Pause ladder ENTRIES while wed-short is active (existing rungs still exit normally)
const PAUSE_DURING_WED = process.env.SIM_PAUSE_LADDER_DURING_WED === "1";
// Post-stale cooldown / gate:
//   SIM_STALE_CD_MIN=60       → time cooldown after STALE close (minutes, 0=off)
//   SIM_STALE_SLOPE_GATE=0    → after stale, block re-entry until 6h slope > this %
const STALE_CD_MS      = parseInt(process.env.SIM_STALE_CD_MIN || "0") * 60000;
const STALE_SLOPE_GATE = parseFloat(process.env.SIM_STALE_SLOPE_GATE || "-999");
// Cooldown after TP before re-entering (minutes): SIM_TP_COOLDOWN=5
const TP_COOLDOWN_MS = parseInt(process.env.SIM_TP_COOLDOWN || "0") * 60000;
// Conditional cooldown: only apply cooldown when micro-top detected at TP
// SIM_COND_CD_RSI=70    → cooldown only if 1H RSI > this at close (0=off)
// SIM_COND_CD_CRSI=70   → cooldown only if 4H CRSI > this at close (0=off)
// SIM_COND_CD_HIGH=1.0  → cooldown only if price within X% of intraday high at close (0=off)
// SIM_COND_CD_MIN=15    → cooldown duration in minutes when condition triggers
const COND_CD_RSI   = parseFloat(process.env.SIM_COND_CD_RSI  || "0");
const COND_CD_CRSI  = parseFloat(process.env.SIM_COND_CD_CRSI || "0");
const COND_CD_HIGH  = parseFloat(process.env.SIM_COND_CD_HIGH || "0");
const COND_CD_MIN   = parseInt(process.env.SIM_COND_CD_MIN    || "15") * 60000;
// Adaptive cooldown: re-check RSI when cooldown expires, extend if still hot
// SIM_COND_CD_RECHECK=1        → enable re-check at cooldown expiry
// SIM_COND_CD_RECHECK_RSI=55   → RSI threshold for extension (can differ from initial trigger)
const COND_CD_RECHECK     = process.env.SIM_COND_CD_RECHECK === "1";
const COND_CD_RECHECK_RSI = parseFloat(process.env.SIM_COND_CD_RECHECK_RSI || process.env.SIM_COND_CD_RSI || "0");
// TP-streak short: open short after N consecutive clean TPs (market running hot → reversion)
// SIM_TP_STREAK_SHORT=1    → enable TP-streak short strategy
// SIM_TS_N=3               → consecutive clean TPs to trigger (2/3/4)
// SIM_TS_NOTIONAL=3000     → short notional per trade
// SIM_TS_TP=5              → TP % below entry
// SIM_TS_STOP=5            → stop % above entry
// SIM_TS_MAX_HOLD=48       → max hold hours
// SIM_TS_COOLDOWN=60       → cooldown minutes after short close
const TP_STREAK_SHORT    = process.env.SIM_TP_STREAK_SHORT === "1";
const TS_N               = parseInt(process.env.SIM_TS_N           || "3");
const TS_NOTIONAL        = parseFloat(process.env.SIM_TS_NOTIONAL  || "3000");
const TS_TP_PCT          = parseFloat(process.env.SIM_TS_TP        || "5");
const TS_STOP_PCT        = parseFloat(process.env.SIM_TS_STOP      || "5");
const TS_MAX_HOLD_H      = parseFloat(process.env.SIM_TS_MAX_HOLD  || "48");
const TS_COOLDOWN_MS     = parseInt(process.env.SIM_TS_COOLDOWN    || "60") * 60000;

// Dynamic ladder expansion (rung 11 → 13 on stalled-drawdown gate)
//   SIM_EXPAND=1              → enable
//   SIM_EXPAND_RANGE6=3.2     → range 6h % ceiling (default 3.2)
//   SIM_EXPAND_SLOPE6=0       → slope 6h % floor (default 0)
//   SIM_EXPAND_MAX=13         → max rungs when gate fires
const EXPAND_GATE      = process.env.SIM_EXPAND === "1";
const EXPAND_RANGE6    = parseFloat(process.env.SIM_EXPAND_RANGE6 || "3.2");
const EXPAND_SLOPE6    = parseFloat(process.env.SIM_EXPAND_SLOPE6 || "0");
const EXPAND_MAX_RUNGS = parseInt(process.env.SIM_EXPAND_MAX || "13");

// Dynamic add-throttle: slow down adds when ladder is deep and price is falling
//   SIM_THROTTLE=1            → enable
//   SIM_THROTTLE_DEPTH=7      → throttle kicks in at rung N (default 7)
//   SIM_THROTTLE_MULT=2       → multiply addIntervalMin by this (default 2 = 30→60min)
//   SIM_THROTTLE_SLOPE6=-0.5  → only throttle when 6h slope ≤ this % (default -0.5)
const ADD_THROTTLE       = process.env.SIM_THROTTLE === "1";
const THROTTLE_DEPTH     = parseInt(process.env.SIM_THROTTLE_DEPTH || "7");
const THROTTLE_MULT      = parseFloat(process.env.SIM_THROTTLE_MULT || "2");
const THROTTLE_SLOPE6    = parseFloat(process.env.SIM_THROTTLE_SLOPE6 || "-0.5");
// S/R-aware ladder sizing:
//   SIM_SR_MODE=off          → no gate (baseline)
//   SIM_SR_MODE=skip         → hard skip rungs near resistance
//   SIM_SR_MODE=scale        → reduce notional near resistance (linear, floor at SCALE_MIN)
//   SIM_SR_MODE=boost        → increase notional near support (linear, cap at BOOST_MAX)
//   SIM_SR_MODE=both         → scale down near R AND boost up near S
//   SIM_SR_MODE=skip-flatten → skip on add + close MOST rungs at R touch (keep deepest underwater)
//   SIM_SR_BUFFER=0.5        → distance window in % (used both sides for skip/scale/boost)
//   SIM_SR_SCALE_MIN=0.3     → floor multiplier at touch of R
//   SIM_SR_BOOST_MAX=2.0     → cap multiplier at touch of S
//   SIM_SR_MIN_TOUCHES=2     → only consider levels with ≥ N clustered swing pivots
//   SIM_SR_KEEP_RUNGS=2      → rungs to keep alive on partial flatten (deepest underwater)
//   SIM_SR_FLATTEN_BUFFER=0.3→ tighter buffer (in %) for partial flatten trigger
//   SIM_SR_COMPARE=1         → run all modes side-by-side
type SrMode = "off" | "skip" | "scale" | "boost" | "both" | "skip-flatten";
let SR_MODE: SrMode  = (process.env.SIM_SR_MODE as SrMode) || "off";
if (process.env.SIM_SR_GATE === "1" && SR_MODE === "off") SR_MODE = "skip";  // back-compat
let SR_BUFFER_PCT    = parseFloat(process.env.SIM_SR_BUFFER      || "0.5");
let SR_SCALE_MIN     = parseFloat(process.env.SIM_SR_SCALE_MIN   || "0.3");
let SR_BOOST_MAX     = parseFloat(process.env.SIM_SR_BOOST_MAX   || "2.0");
const SR_MIN_TOUCHES = parseInt(process.env.SIM_SR_MIN_TOUCHES   || "2");
const SR_KEEP_RUNGS  = parseInt(process.env.SIM_SR_KEEP_RUNGS    || "2");
const SR_FLATTEN_BUFFER_PCT = parseFloat(process.env.SIM_SR_FLATTEN_BUFFER || "0.3");
const SR_COMPARE     = process.env.SIM_SR_COMPARE === "1";
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
const END     = process.env.SIM_END;
const endTs   = END ? new Date(END).getTime() : Infinity;
const FUNDING_RATE_8H = 0.0001; // avg funding cost per 8h period

// ── Data ─────────────────────────────────────────────────────────
const raw5m: Candle[]   = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
const btc5m: Candle[]   = JSON.parse(fs.readFileSync("data/BTCUSDT_5_full.json",  "utf-8"));
raw5m.sort((a, b) => a.timestamp - b.timestamp);
btc5m.sort((a, b) => a.timestamp - b.timestamp);

// Funding history (timestamp every 8h, fundingRate decimal)
type FundingRow = { timestamp: number; fundingRate: number };
const fundingHist: FundingRow[] = (() => {
  try {
    const arr: FundingRow[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_funding.json", "utf-8"));
    arr.sort((a, b) => a.timestamp - b.timestamp);
    return arr;
  } catch { return []; }
})();
function makeFundingGetter() {
  let fundIdx = 0;
  return (ts: number): number => {
    while (fundIdx + 1 < fundingHist.length && fundingHist[fundIdx + 1].timestamp <= ts) fundIdx++;
    if (fundIdx >= fundingHist.length || fundingHist[fundIdx].timestamp > ts) return 0;
    return fundingHist[fundIdx].fundingRate;
  };
}

// Funding-confirmed top-guard params (env-tunable)
const FUND_NEG_THRESHOLD = Number(process.env.FUND_GATE_THRESHOLD ?? -0.0002);
const FUND_NEG_COUNT = Number(process.env.FUND_GATE_COUNT ?? 2);
const FUND_NEG_LOOKBACK_MS = 24 * 3600 * 1000;
const FUND_ARM_EXPIRY_MS = 24 * 3600 * 1000;
const FUND_DROP_REQUIRED = Number(process.env.FUND_GATE_DROP ?? 0.05);

function isFundingGateArmed(ts: number, currentPrice: number): boolean {
  const since = ts - FUND_NEG_LOOKBACK_MS;
  const negs: { ts: number }[] = [];
  for (let i = fundingHist.length - 1; i >= 0; i--) {
    const f = fundingHist[i];
    if (f.timestamp > ts) continue;
    if (f.timestamp < since) break;
    if (f.fundingRate <= FUND_NEG_THRESHOLD) negs.push({ ts: f.timestamp });
    if (negs.length >= FUND_NEG_COUNT) break;
  }
  if (negs.length < FUND_NEG_COUNT) return false;
  const triggerTs = negs[0].ts;
  if (ts - triggerTs > FUND_ARM_EXPIRY_MS) return false;
  let lo = 0, hi = raw5m.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (raw5m[mid].timestamp >= triggerTs) { found = mid; hi = mid - 1; }
    else lo = mid + 1;
  }
  const refPrice = found >= 0 ? raw5m[found].close : currentPrice;
  return currentPrice > refPrice * (1 - FUND_DROP_REQUIRED);
}

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

// ── S/R level detection (configurable pivot timeframe, no look-ahead) ───
// Pivot at bar i = high is the max within [i-LEFT, i+RIGHT]. Levels become
// "active" only after the right-side window completes (confirmTs).
// Pivots within CLUSTER_PCT of an existing level merge into it (count touches).
//   SIM_SR_TF=60     → pivot timeframe in minutes (default 240 = 4H; 60 = 1H)
//   SIM_SR_LEFT=6    → bars to the left for pivot test
//   SIM_SR_RIGHT=6   → bars to the right (= confirmation lag)
const SR_PIVOT_TF    = parseInt(process.env.SIM_SR_TF    || "240");
const SR_PIVOT_LEFT  = parseInt(process.env.SIM_SR_LEFT  || "6");
const SR_PIVOT_RIGHT = parseInt(process.env.SIM_SR_RIGHT || "6");
const SR_CLUSTER_PCT = 0.012;
const cSR = aggregate(raw5m, SR_PIVOT_TF);

interface SRLevel { price: number; confirmTs: number; touches: number; brokenAt: number; }

function buildSRLevels(): { resistance: SRLevel[]; support: SRLevel[] } {
  const rPiv: { ts: number; price: number }[] = [];
  const sPiv: { ts: number; price: number }[] = [];
  for (let i = SR_PIVOT_LEFT; i < cSR.length - SR_PIVOT_RIGHT; i++) {
    const bar = cSR[i];
    let isHigh = true, isLow = true;
    for (let j = i - SR_PIVOT_LEFT; j <= i + SR_PIVOT_RIGHT; j++) {
      if (j === i) continue;
      if (cSR[j].high >= bar.high) isHigh = false;
      if (cSR[j].low  <= bar.low ) isLow  = false;
    }
    const confirmTs = cSR[i + SR_PIVOT_RIGHT].timestamp + SR_PIVOT_TF * 60000;
    if (isHigh) rPiv.push({ ts: confirmTs, price: bar.high });
    if (isLow ) sPiv.push({ ts: confirmTs, price: bar.low  });
  }
  function cluster(piv: { ts: number; price: number }[], type: "R" | "S"): SRLevel[] {
    const levels: SRLevel[] = [];
    for (const p of piv.sort((a, b) => a.ts - b.ts)) {
      let merged = false;
      for (const lv of levels) {
        if (Math.abs(lv.price - p.price) / lv.price <= SR_CLUSTER_PCT) {
          if (type === "R" && p.price > lv.price) lv.price = p.price;
          if (type === "S" && p.price < lv.price) lv.price = p.price;
          lv.touches++;
          merged = true;
          break;
        }
      }
      if (!merged) levels.push({ price: p.price, confirmTs: p.ts, touches: 1, brokenAt: 0 });
    }
    return levels.filter(l => l.touches >= SR_MIN_TOUCHES);
  }
  return { resistance: cluster(rPiv, "R"), support: cluster(sPiv, "S") };
}

const srLevels = buildSRLevels();

// ── Break detection ──
// A resistance is "broken" only when SR-timeframe closes confirm a sustained move:
//   - close ≥ level × (1 + BREAK_BUF) for BREAK_CONFIRM_BARS consecutive bars
// Single-bar wicks/stop-hunts don't count. Tunable via env.
const BREAK_BUF          = parseFloat(process.env.SIM_SR_BREAK_BUF || "0.01");  // 1% default
const BREAK_CONFIRM_BARS = parseInt(process.env.SIM_SR_BREAK_BARS || "2");      // 2 consecutive closes
{
  // brokenAt = END of the breaking bar (start + tf), since the break is only
  // knowable once that bar's close is published. Using start would be look-ahead.
  const tfMs = SR_PIVOT_TF * 60000;
  for (const lv of srLevels.resistance) {
    const trigger = lv.price * (1 + BREAK_BUF);
    let streak = 0;
    for (let i = 0; i < cSR.length; i++) {
      const bar = cSR[i];
      if (bar.timestamp < lv.confirmTs) continue;
      if (bar.close >= trigger) {
        streak++;
        if (streak >= BREAK_CONFIRM_BARS) { lv.brokenAt = bar.timestamp + tfMs; break; }
      } else streak = 0;
    }
  }
  for (const lv of srLevels.support) {
    const trigger = lv.price * (1 - BREAK_BUF);
    let streak = 0;
    for (let i = 0; i < cSR.length; i++) {
      const bar = cSR[i];
      if (bar.timestamp < lv.confirmTs) continue;
      if (bar.close <= trigger) {
        streak++;
        if (streak >= BREAK_CONFIRM_BARS) { lv.brokenAt = bar.timestamp + tfMs; break; }
      } else streak = 0;
    }
  }
}
const stillActiveR = srLevels.resistance.filter(l => l.brokenAt === 0).length;
const stillActiveS = srLevels.support.filter(l => l.brokenAt === 0).length;

// Nearest active R above `price`. Returns the level + distance fraction (0..buf).
function nearestActiveResistance(ts: number, price: number): { lv: SRLevel; dist: number } | null {
  if (SR_MODE === "off") return null;
  const buf = SR_BUFFER_PCT / 100;
  let nearest: SRLevel | null = null;
  let nearestDist = Infinity;
  for (const lv of srLevels.resistance) {
    if (lv.confirmTs > ts) continue;
    if (lv.brokenAt > 0 && ts >= lv.brokenAt) continue;
    if (lv.price <= price) continue;
    const dist = (lv.price - price) / price;
    if (dist <= buf && dist < nearestDist) { nearest = lv; nearestDist = dist; }
  }
  return nearest ? { lv: nearest, dist: nearestDist } : null;
}

// Nearest active S below `price`. Returns the level + distance fraction (0..buf).
function nearestActiveSupport(ts: number, price: number): { lv: SRLevel; dist: number } | null {
  if (SR_MODE === "off") return null;
  const buf = SR_BUFFER_PCT / 100;
  let nearest: SRLevel | null = null;
  let nearestDist = Infinity;
  for (const lv of srLevels.support) {
    if (lv.confirmTs > ts) continue;
    if (lv.brokenAt > 0 && ts >= lv.brokenAt) continue;
    if (lv.price >= price) continue;        // support must be BELOW current price
    const dist = (price - lv.price) / price;
    if (dist <= buf && dist < nearestDist) { nearest = lv; nearestDist = dist; }
  }
  return nearest ? { lv: nearest, dist: nearestDist } : null;
}

// Returns the multiplier to apply to the next rung's notional.
//   mode=off:    1
//   mode=skip:   0 if near R, else 1
//   mode=scale:  linear from SR_SCALE_MIN (at touch) to 1 (at edge of buffer); else 1
//   mode=boost:  linear from 1 (at edge of buffer) to SR_BOOST_MAX (at touch); else 1
//   mode=both:   product of scale_R and boost_S
function srMultiplier(ts: number, price: number): number {
  if (SR_MODE === "off") return 1;
  const buf = SR_BUFFER_PCT / 100;

  let multR = 1;
  if (SR_MODE === "skip" || SR_MODE === "skip-flatten" || SR_MODE === "scale" || SR_MODE === "both") {
    const r = nearestActiveResistance(ts, price);
    if (r) {
      if (SR_MODE === "skip" || SR_MODE === "skip-flatten") return 0;
      // scale: dist=0 → SCALE_MIN, dist=buf → 1
      multR = SR_SCALE_MIN + (1 - SR_SCALE_MIN) * (r.dist / buf);
    }
  }

  let multS = 1;
  if (SR_MODE === "boost" || SR_MODE === "both") {
    const s = nearestActiveSupport(ts, price);
    if (s) {
      // boost: dist=0 → BOOST_MAX, dist=buf → 1
      multS = 1 + (SR_BOOST_MAX - 1) * (1 - s.dist / buf);
    }
  }

  return multR * multS;
}

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
const ema200DistMap  = new Map<number, number>();  // (close - ema200) / ema200 * 100
{
  const closes = c4H.map(b => b.close);
  const e200 = emaCalc(closes, cfg.filters.trendEmaLong);
  const e50  = emaCalc(closes, cfg.filters.trendEmaShort);
  for (let i = 1; i < c4H.length; i++) {
    trendHostileMap.set(c4H[i].timestamp, closes[i] < e200[i] && e50[i] < e50[i-1]);
    if (e200[i] > 0) ema200DistMap.set(c4H[i].timestamp, (closes[i] - e200[i]) / e200[i] * 100);
  }
}
const ts4H = c4H.map(b => b.timestamp);

function getEma200Dist4H(ts: number): number | null {
  const i = bsearch(ts4H, ts);
  if (i < 1) return null;
  return ema200DistMap.get(c4H[i-1].timestamp) ?? null;
}

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

// ── Precompute: rolling 7-day high from 4H bars ──────────────────
const rolling7dHighMap = new Map<number, number>();
{
  const windowBars = 42; // 7 days × 6 bars per day (4H)
  for (let i = 0; i < c4H.length; i++) {
    let hi = 0;
    for (let j = Math.max(0, i - windowBars); j <= i; j++) {
      if (c4H[j].high > hi) hi = c4H[j].high;
    }
    rolling7dHighMap.set(c4H[i].timestamp, hi);
  }
}

function getRolling7dHigh(ts: number): number {
  const i = bsearch(ts4H, ts);
  if (i < 0) return 0;
  return rolling7dHighMap.get(c4H[i].timestamp) ?? 0;
}

// ── Precompute: 1H EMA21 for pullback detection ─────────────────
const ema21_1HMap = new Map<number, number>();
{
  const closes = c1H.map(b => b.close);
  const e21 = emaCalc(closes, 21);
  for (let i = 0; i < c1H.length; i++) {
    ema21_1HMap.set(c1H[i].timestamp, e21[i]);
  }
}

function getEma21_1H(ts: number): number | null {
  const i = bsearch(ts1H, ts);
  if (i < 1) return null;
  return ema21_1HMap.get(c1H[i - 1].timestamp) ?? null;
}

// ── Sim types ─────────────────────────────────────────────────────
interface Pos { ep: number; et: number; qty: number; notional: number; }
interface MonthStats {
  ladderPnl: number; hedgePnl: number; wedPnl: number; pf0Pnl: number; rsPnl: number;
  n: number; wins: number; hedgeFires: number;
  kills: number; flats: number; stales: number;
  wedTrades: number; wedWins: number;
  pf0Trades: number; pf0Wins: number;
  rsTrades: number; rsWins: number;
  peakDD: number; minEq: number; maxEq: number;
}
interface WedPos { ep: number; qty: number; notional: number; tpPrice: number; stopPrice: number; openedAt: number; wedDate: string; }
interface PF0Pos { ep: number; qty: number; notional: number; tpPrice: number; stopPrice: number; openedAt: number; signalTs: number; }
interface RegimeShortPos { ep: number; qty: number; notional: number; tpPrice: number; stopPrice: number; openedAt: number; }

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

type MaxRungSnap = {
  ts: number;
  price: number;
  crsi4H: number | null;
  rsi1H: number | null;
  distEma200_4H: number | null;
  btcRet1H: number | null;
  // Price + hold-time features for "stalled drawdown" gate
  distFromAvgPct: number;     // current price vs weighted-avg entry (negative = below)
  holdHours: number;          // hours since rung 1 of this episode
  range6hPct: number;         // (max-min) / close over last 6h, %
  range12hPct: number;        // same, last 12h
  drawdown6hPct: number;      // close vs max(close) last 6h, %  (≤0)
  bounceFromLow6hPct: number; // close vs min(low) last 6h, %    (≥0)
  slope6hPct: number;         // (close - close 6h ago) / close, %
};

// Indicator snapshot at FIRST RUNG entry — used to find filters that prevent long-hold bad outcomes
type FirstRungSnap = {
  ts: number;
  price: number;
  crsi4H: number | null;
  rsi1H: number | null;
  distEma200_4H: number | null;
  btcRet1H: number | null;
  range6hPct: number;
  range12hPct: number;
  drawdown6hPct: number;
  bounceFromLow6hPct: number;
  slope6hPct: number;
  slope12hPct: number;
  fundingArmed: boolean;
};

// Mid-ladder 4h-checkpoint snapshot — for early-exit-on-relief-bounce study
type CheckpointSnap = {
  ts: number;
  price: number;
  pnlPctAt4h: number;       // unrealized PnL % at the checkpoint
  ladderDepth: number;
  crsi4H: number | null;
  rsi1H: number | null;
  btcRet1H: number | null;
  slope6hPct: number;
  slope12hPct: number;
  // Tracking after checkpoint (filled in over remaining ladder lifetime)
  minPriceAfter: number;    // lowest price seen after checkpoint
  maxPriceAfterMin: number; // highest price seen AFTER the minPrice (= relief bounce)
  minPriceAfterTs: number;  // when min was reached
  maxBounceTs: number;      // when max-after-min was reached
};

function runSim(mode: RunMode): {
  capital: number; maxDD: number; totalLadderPnl: number; totalHedgePnl: number; totalWedPnl: number; totalPF0Pnl: number; totalRsPnl: number;
  totalTPs: number; totalStales: number; totalKills: number; totalFlats: number;
  totalHedgeFires: number; totalWedTrades: number; totalWedWins: number;
  totalPF0Trades: number; totalPF0Wins: number;
  totalRsTrades: number; totalRsWins: number;
  totalSrBlocks: number; totalSrScaled: number; totalSrBoosted: number; totalSrFlattens: number;
  totalOverextBlocks: number;
  depthHist: Record<number, Record<string, number>>;
  maxDepthHolds: { hours: number; outcome: string }[];
  maxDepthSnaps: { snap: MaxRungSnap; outcome: string; holdHours: number }[];
  firstRungSnaps: { snap: FirstRungSnap; outcome: string; holdHours: number; pnlUsd: number }[];
  checkpointSnaps: { snap: CheckpointSnap; outcome: string; finalPnlPct: number; finalPrice: number }[];
  expFires: number; expTPs: number; expKFs: number; expStales: number; expExtraPnl: number;
  expMonthly: Record<string, { fires: number; tp: number; kf: number; stale: number; pnl: number }>;
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
let lastCloseTs   = 0;
let condCdUntil   = 0;  // conditional cooldown: blocked until this ts
let forcedExitCdUntil = 0;  // post-KILL/FLAT cooldown: end of next completed 4H bar
let staleCdUntil  = 0;  // post-STALE cooldown: blocked until this ts
let lastStaleClose = false; // flag: last close was STALE (for slope gate)
let totalLadderPnl = 0;
let totalHedgePnl  = 0;
let totalWedPnl    = 0;
let totalPF0Pnl    = 0;
let totalTPs = 0, totalStales = 0, totalKills = 0, totalFlats = 0, totalHedgeFires = 0;
// depthHist[rungs][outcome] — distribution of close depths grouped by exit reason
const depthHist: Record<number, Record<string, number>> = {};
// holdHoursAtMaxDepth — list of {hours, outcome} for episodes that closed at max rungs
const maxDepthHolds: { hours: number; outcome: string }[] = [];
let pendingMaxRungSnap: MaxRungSnap | null = null;
const maxDepthSnaps: { snap: MaxRungSnap; outcome: string; holdHours: number }[] = [];
// First-rung snapshot — captures conditions at episode entry for predictive analysis
let pendingFirstRungSnap: FirstRungSnap | null = null;
const firstRungSnaps: { snap: FirstRungSnap; outcome: string; holdHours: number; pnlUsd: number }[] = [];
// 4h-checkpoint snapshot — for early-exit-on-relief-bounce study
let pendingCheckpointSnap: CheckpointSnap | null = null;
const checkpointSnaps: { snap: CheckpointSnap; outcome: string; finalPnlPct: number; finalPrice: number }[] = [];
// Dynamic-expansion state (per episode)
let maxRungsThisEp = cfg.maxPositions;
// Per-month + total stats for expanded episodes
let expFires = 0, expTPs = 0, expKFs = 0, expStales = 0;
let expExtraPnl = 0;  // total ladder PnL from episodes that triggered expansion
const expMonthly: Record<string, { fires: number; tp: number; kf: number; stale: number; pnl: number }> = {};
function getExpMo(ts: number) {
  const k = new Date(ts).toISOString().slice(0, 7);
  if (!expMonthly[k]) expMonthly[k] = { fires: 0, tp: 0, kf: 0, stale: 0, pnl: 0 };
  return expMonthly[k];
}
let totalWedTrades = 0, totalWedWins = 0;
let totalPF0Trades = 0, totalPF0Wins = 0;

let wedShort: WedPos | null = null;
let lastWedCloseDate = "";

let pf0Short: PF0Pos | null = null;
let pf0LastClose = 0;
let pf0LastSignalTs = 0;

let tpStreakShort: RegimeShortPos | null = null;
let tsLastClose = 0;
let totalRsPnl = 0;
let totalRsTrades = 0, totalRsWins = 0;
let cleanTpStreak = 0;

const getFunding = makeFundingGetter();
let totalFundGuards = 0;


let totalSrBlocks = 0;
let totalSrScaled = 0;
let totalSrBoosted = 0;
let totalSrFlattens = 0;
let totalOverextBlocks = 0;

const trades: BacktestTrade[] = [];
const monthly: Record<string, MonthStats> = {};
function getMo(ts: number): MonthStats {
  const k = new Date(ts).toISOString().slice(0, 7);
  if (!monthly[k]) monthly[k] = { ladderPnl: 0, hedgePnl: 0, wedPnl: 0, pf0Pnl: 0, rsPnl: 0, n: 0, wins: 0, hedgeFires: 0, kills: 0, flats: 0, stales: 0, wedTrades: 0, wedWins: 0, pf0Trades: 0, pf0Wins: 0, rsTrades: 0, rsWins: 0, peakDD: 0, minEq: Infinity, maxEq: 0 };
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

  // Track close depth by outcome
  const depth = longs.length;
  if (!depthHist[depth]) depthHist[depth] = { tp: 0, stale: 0, kill: 0, flat: 0 };
  depthHist[depth][outcome]++;

  // Hold time for max-depth (rung 11) episodes — used to size dynamic expansion
  if (depth >= cfg.maxPositions) {
    const hours = (ts - ladderOpenTs) / 3600000;
    maxDepthHolds.push({ hours, outcome });
    if (pendingMaxRungSnap !== null) {
      maxDepthSnaps.push({ snap: pendingMaxRungSnap, outcome, holdHours: hours });
    }
  }
  // Capture first-rung snapshot for ALL closed episodes (used to find entry filters)
  if (pendingFirstRungSnap !== null) {
    const hours = (ts - ladderOpenTs) / 3600000;
    firstRungSnaps.push({ snap: pendingFirstRungSnap, outcome, holdHours: hours, pnlUsd: lPnl });
    pendingFirstRungSnap = null;
  }
  // Capture mid-ladder 4h-checkpoint snap (used for early-exit-on-relief-bounce study)
  if (pendingCheckpointSnap !== null) {
    const finalPnlPct = totalNot > 0 ? (lPnl / totalNot) * 100 : 0;
    checkpointSnaps.push({ snap: pendingCheckpointSnap, outcome, finalPnlPct, finalPrice: price });
    pendingCheckpointSnap = null;
  }
  // Reset snapshot on every close (whether at max depth or not)
  pendingMaxRungSnap = null;

  // Dynamic-expansion stats: did this episode actually use the extra capacity?
  if (maxRungsThisEp > cfg.maxPositions) {
    const mo = getExpMo(ts);
    mo.pnl += lPnl;
    expExtraPnl += lPnl;
    if (outcome === "tp") { expTPs++; mo.tp++; }
    else if (outcome === "kill" || outcome === "flat") { expKFs++; mo.kf++; }
    else { expStales++; mo.stale++; }
  }
  // Reset cap for next episode
  maxRungsThisEp = cfg.maxPositions;

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

  // TP-streak tracking: clean TP increments streak, anything else resets
  if (reason === "TP") { cleanTpStreak++; }
  else { cleanTpStreak = 0; }

  longs.length   = 0;
  lastEntryPrice = 0;
  episodeOpenTs  = 0;
  lastCloseTs    = ts;
  hedgeArmed     = true;
  hedgeLastClose = ts;

  // Forced-exit cooldown: KILL/FLAT wait until end of next completed 4H bar (mirrors live bot)
  if (!SKIP_FORCED_CD && (reason === "KILL" || reason === "FLAT")) {
    const fourH = 4 * 3600000;
    forcedExitCdUntil = (Math.floor(ts / fourH) + 2) * fourH;
  }

  // Post-stale cooldown + slope gate
  lastStaleClose = reason === "STALE";
  if (reason === "STALE" && STALE_CD_MS > 0) {
    staleCdUntil = ts + STALE_CD_MS;
  }

  // Conditional cooldown: check micro-top at TP/STALE moment
  if ((COND_CD_RSI > 0 || COND_CD_CRSI > 0 || COND_CD_HIGH > 0) && (reason === "TP" || reason === "STALE")) {
    let microTop = false;
    if (COND_CD_RSI > 0) {
      const { rsi } = get1H(ts);
      if (rsi !== null && rsi > COND_CD_RSI) microTop = true;
    }
    if (COND_CD_CRSI > 0) {
      const crsi = getCrsi4H(ts);
      if (crsi !== null && crsi > COND_CD_CRSI) microTop = true;
    }
    if (COND_CD_HIGH > 0) {
      const dayHigh = intradayHighAtBar.get(ts) ?? 0;
      if (dayHigh > 0 && ((dayHigh - price) / dayHigh * 100) <= COND_CD_HIGH) microTop = true;
    }
    if (microTop) condCdUntil = ts + COND_CD_MIN;
  }
}

// Partial flatten near R: close the most-profitable rungs, keep the deepest
// underwater rungs alive ("taking damage still") for residual exposure.
// Returns true if a flatten fired this tick.
function partialFlattenAtR(price: number, ts: number): boolean {
  if (SR_MODE !== "skip-flatten") return false;
  if (longs.length < SR_KEEP_RUNGS + 1) return false;
  const r = nearestActiveResistance(ts, price);
  if (!r) return false;
  if (r.dist > SR_FLATTEN_BUFFER_PCT / 100) return false;

  // Sort by individual unrealized PnL descending; close top N (most profitable),
  // keep the bottom (worst) SR_KEEP_RUNGS as the residual exposure.
  const indexed = longs.map((p) => ({ p, upnl: (price - p.ep) * p.qty }));
  indexed.sort((a, b) => b.upnl - a.upnl);
  const closeN  = longs.length - SR_KEEP_RUNGS;
  const toClose = indexed.slice(0, closeN).map(x => x.p);
  const toKeep  = indexed.slice(closeN).map(x => x.p);

  let realizedPnl = 0;
  let totalNot = 0;
  let totalQty = 0;
  let avgEntryNum = 0;
  let totalFees = 0;
  for (const p of toClose) {
    const raw  = (price - p.ep) * p.qty;
    const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
    const fund = p.notional * FUNDING_RATE_8H * ((ts - p.et) / (8 * 3600000));
    realizedPnl += raw - fees - fund;
    totalFees   += fees;
    totalNot    += p.notional;
    totalQty    += p.qty;
    avgEntryNum += p.ep * p.qty;
  }
  const avgEntry = totalQty > 0 ? avgEntryNum / totalQty : price;

  capital += realizedPnl;
  totalLadderPnl += realizedPnl;
  totalSrFlattens++;

  trades.push({
    strategy: "ladder-partial", symbol: cfg.symbol, side: "long",
    entryTime: longs[0].et, exitTime: ts,
    entryPrice: avgEntry, exitPrice: price,
    notional: totalNot, pnlUsd: realizedPnl,
    pnlPct: totalNot > 0 ? (realizedPnl / totalNot) * 100 : 0,
    outcome: "flat", feesUsd: totalFees,
  });

  const mo = getMo(ts);
  mo.ladderPnl += realizedPnl;

  // Replace longs with the kept rungs in original entry order.
  toKeep.sort((a, b) => a.et - b.et);
  longs.length = 0;
  longs.push(...toKeep);

  // Reanchor add gates to the latest kept rung so priceTrigger / time gap
  // continue to work coherently.
  const latest = longs[longs.length - 1];
  lastEntryPrice = latest.ep;
  lastAdd        = latest.et;

  return true;
}

let i5m = -1;
for (const c of raw5m) {
  i5m++;
  if (c.timestamp < startTs) continue;
  if (c.timestamp > endTs) break;
  const { close, high, timestamp: ts } = c;

  // ── Mid-ladder 4h-checkpoint capture + max-bounce tracking ──
  // Captures a snapshot 4h after rung 1, then tracks min price and the max bounce after that min.
  if (longs.length > 0 && pendingCheckpointSnap === null) {
    const elapsedH = (ts - longs[0].et) / 3600000;
    if (elapsedH >= 4) {
      const tQty = longs.reduce((s, p) => s + p.qty, 0);
      const tNot = longs.reduce((s, p) => s + p.notional, 0);
      const avgEntry = tQty > 0 ? tNot / tQty : close;
      const pnlPct = (close - avgEntry) / avgEntry * 100;
      const close6hAgo  = i5m >= 72  ? raw5m[i5m - 72].close  : close;
      const close12hAgo = i5m >= 144 ? raw5m[i5m - 144].close : close;
      pendingCheckpointSnap = {
        ts, price: close, pnlPctAt4h: pnlPct, ladderDepth: longs.length,
        crsi4H: getCrsi4H(ts),
        rsi1H: get1H(ts).rsi,
        btcRet1H: getBtcRet(ts),
        slope6hPct: (close - close6hAgo) / close6hAgo * 100,
        slope12hPct: (close - close12hAgo) / close12hAgo * 100,
        minPriceAfter: close,
        maxPriceAfterMin: close,
        minPriceAfterTs: ts,
        maxBounceTs: ts,
      };
    }
  }
  if (pendingCheckpointSnap !== null) {
    const { low: barLow, high: barHigh } = c;
    if (barLow < pendingCheckpointSnap.minPriceAfter) {
      pendingCheckpointSnap.minPriceAfter = barLow;
      pendingCheckpointSnap.minPriceAfterTs = ts;
      pendingCheckpointSnap.maxPriceAfterMin = barLow;
      pendingCheckpointSnap.maxBounceTs = ts;
    }
    if (barHigh > pendingCheckpointSnap.maxPriceAfterMin) {
      pendingCheckpointSnap.maxPriceAfterMin = barHigh;
      pendingCheckpointSnap.maxBounceTs = ts;
    }
  }

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

  // ── TP-streak short: short after consecutive clean TPs ──
  if (TP_STREAK_SHORT && mode !== "ladder-only" && tpStreakShort) {
    let rsClosed = false;
    let rsPnl = 0;

    // Stop hit (price rallied above stop)
    if (high >= tpStreakShort.stopPrice) {
      rsPnl = (tpStreakShort.ep - tpStreakShort.stopPrice) * tpStreakShort.qty
            - tpStreakShort.notional * cfg.feeRate * 2;
      rsClosed = true;
    }
    // TP hit (price dropped to TP)
    else if (c.low <= tpStreakShort.tpPrice) {
      rsPnl = (tpStreakShort.ep - tpStreakShort.tpPrice) * tpStreakShort.qty
            - tpStreakShort.notional * cfg.feeRate * 2;
      rsClosed = true;
    }
    // Max hold expiry
    else if ((ts - tpStreakShort.openedAt) / 3600000 >= TS_MAX_HOLD_H) {
      rsPnl = (tpStreakShort.ep - close) * tpStreakShort.qty
            - tpStreakShort.notional * cfg.feeRate * 2;
      rsClosed = true;
    }

    if (rsClosed) {
      const rsOutcome = high >= tpStreakShort.stopPrice ? "stop"
        : c.low <= tpStreakShort.tpPrice ? "tp" : "expiry";
      const rsExitPrice = rsOutcome === "stop" ? tpStreakShort.stopPrice
        : rsOutcome === "tp" ? tpStreakShort.tpPrice : close;
      trades.push({
        strategy: "tp-streak-short", symbol: cfg.symbol, side: "short",
        entryTime: tpStreakShort.openedAt, exitTime: ts,
        entryPrice: tpStreakShort.ep, exitPrice: rsExitPrice,
        notional: tpStreakShort.notional, pnlUsd: rsPnl, pnlPct: (rsPnl / tpStreakShort.notional) * 100,
        outcome: rsOutcome, feesUsd: tpStreakShort.notional * cfg.feeRate * 2,
      });
      capital += rsPnl;
      totalRsPnl += rsPnl;
      totalRsTrades++;
      if (rsPnl > 0) totalRsWins++;
      const mo = getMo(ts);
      mo.rsPnl += rsPnl;
      mo.rsTrades++;
      if (rsPnl > 0) mo.rsWins++;
      tsLastClose = ts;
      tpStreakShort = null;
    }
  }

  // TP-streak short: open short after N consecutive clean TPs (market overheated)
  if (TP_STREAK_SHORT && mode !== "ladder-only" && !tpStreakShort) {
    const cooldownOk = (ts - tsLastClose) >= TS_COOLDOWN_MS;
    if (cooldownOk && cleanTpStreak >= TS_N && longs.length === 0) {
      const qty = TS_NOTIONAL / close;
      tpStreakShort = {
        ep: close, qty, notional: TS_NOTIONAL,
        tpPrice: close * (1 - TS_TP_PCT / 100),
        stopPrice: close * (1 + TS_STOP_PCT / 100),
        openedAt: ts,
      };
      cleanTpStreak = 0; // reset streak after firing
    }
  }

  // Equity + DD tracking
  const longUr  = longs.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
  const hedgeUr = hedge ? (hedge.ep - close) * hedge.qty : 0;
  const wedUr   = wedShort ? (wedShort.ep - close) * wedShort.qty : 0;
  const pf0Ur   = pf0Short ? (pf0Short.ep - close) * pf0Short.qty : 0;
  const rsUr    = tpStreakShort ? (tpStreakShort.ep - close) * tpStreakShort.qty : 0;
  const eq = capital + longUr + hedgeUr + wedUr + pf0Ur + rsUr;
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
    const stale   = cfg.exits.softStale && ageH >= cfg.exits.staleHours && avgPnlP < cfg.exits.reducedTpPct;
    const tpPct   = stale ? cfg.exits.reducedTpPct : cfg.tpPct;
    const tpPrice = avgE * (1 + tpPct / 100);

    if (high >= tpPrice) {
      closeLadder(tpPrice, ts, stale ? "STALE" : "TP");
      continue;
    }
    // Partial flatten near R: bank profitable rungs, keep underwater ones alive.
    // Position composition has materially changed; let the next tick re-evaluate.
    if (partialFlattenAtR(close, ts)) continue;
    if (cfg.exits.emergencyKill && avgPnlP <= cfg.exits.emergencyKillPct) {
      closeLadder(close, ts, "KILL");
      continue;
    }
    if (cfg.exits.hardFlatten && ageH >= cfg.exits.hardFlattenHours &&
        avgPnlP <= cfg.exits.hardFlattenPct && hostile) {
      closeLadder(close, ts, "FLAT");
      continue;
    }
    // Funding-spike top guard (close mode): deep ladder + crowded longs = bank or scratch
    if (FUND_GUARD === "close" && longs.length >= FUND_DEPTH) {
      const fr = getFunding(ts);
      if (fr >= FUND_RATE) {
        closeLadder(close, ts, "FLAT"); // count as FLAT for stat tracking
        totalFundGuards++;
        continue;
      }
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
  if (longs.length >= maxRungsThisEp) continue;

  // Forced-exit cooldown: after KILL/FLAT, wait until end of next 4H bar (mirrors live bot)
  if (forcedExitCdUntil > 0 && ts < forcedExitCdUntil) continue;

  // TP cooldown: wait N minutes after any close before re-entering rung 1
  if (TP_COOLDOWN_MS > 0 && longs.length === 0 && lastCloseTs > 0 && (ts - lastCloseTs) < TP_COOLDOWN_MS) continue;

  // Conditional cooldown: only blocks rung 1 re-entry when micro-top was detected at TP
  if (condCdUntil > 0 && longs.length === 0 && ts < condCdUntil) continue;

  // Adaptive re-check: cooldown just expired, but RSI still hot → extend
  if (COND_CD_RECHECK && condCdUntil > 0 && longs.length === 0 && ts >= condCdUntil) {
    const { rsi } = get1H(ts);
    if (rsi !== null && rsi > COND_CD_RECHECK_RSI) {
      condCdUntil = ts + COND_CD_MIN;
      continue;
    }
    condCdUntil = 0; // RSI cooled, clear gate
  }

  // Post-stale cooldown: time-based wait after stale close
  if (staleCdUntil > 0 && longs.length === 0 && ts < staleCdUntil) continue;

  // Post-stale slope gate: after stale close, block rung 1 until 6h slope recovers
  if (STALE_SLOPE_GATE > -999 && lastStaleClose && longs.length === 0 && i5m >= 72) {
    const slope6 = (close - raw5m[i5m - 72].close) / raw5m[i5m - 72].close * 100;
    if (slope6 <= STALE_SLOPE_GATE) continue;
    lastStaleClose = false; // slope recovered, clear gate
  }

  // Pause ladder entries while wed-short is active
  if (PAUSE_DURING_WED && wedShort) continue;

  // Funding-spike top guard (block mode): block adds when deep + crowded longs
  if (FUND_GUARD === "block" && longs.length >= FUND_DEPTH) {
    const fr = getFunding(ts);
    if (fr >= FUND_RATE) { totalFundGuards++; continue; }
  }

  const timeGap  = (ts - lastAdd) / 60000;
  // Dynamic add-throttle: when deep and price falling, slow down the add interval
  let effectiveInterval = cfg.addIntervalMin;
  if (ADD_THROTTLE && longs.length >= THROTTLE_DEPTH && i5m >= 72) {
    const slope6 = (close - raw5m[i5m - 72].close) / raw5m[i5m - 72].close * 100;
    if (slope6 <= THROTTLE_SLOPE6) {
      effectiveInterval = cfg.addIntervalMin * THROTTLE_MULT;
    }
  }
  const timeOk   = timeGap >= effectiveInterval;
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

  // Overextended-entry filter (rung 1 only) — block "chasing the pump" entries
  const overextCfg = cfg.filters.overextendedEntry;
  if (overextCfg && overextCfg.enabled && longs.length === 0 && i5m >= 144) {
    const close12hAgo = raw5m[i5m - 144].close;
    const slope12h    = (close - close12hAgo) / close12hAgo * 100;
    const c4 = getCrsi4H(ts);
    const r1 = get1H(ts).rsi;
    if (c4 !== null && r1 !== null &&
        slope12h >= overextCfg.slope12hMin &&
        c4 <= overextCfg.crsi4HMax &&
        r1 >= overextCfg.rsi1HMin) {
      totalOverextBlocks++;
      continue;
    }
  }

  // S/R-aware sizing: skip / scale down near R, boost up near S, or both.
  const srMult = srMultiplier(ts, close);
  if (srMult <= 0) { totalSrBlocks++; continue; }       // skip mode hit R
  if (srMult < 0.999) totalSrScaled++;
  if (srMult > 1.001) totalSrBoosted++;

  // Margin check (apply SR multiplier to notional)
  const level     = longs.length;
  const baseNotional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, level);
  const notional  = baseNotional * srMult;
  const usedMargin = longs.reduce((s, p) => s + p.notional / cfg.leverage, 0) +
                     (hedge ? hedge.notional / cfg.leverage : 0);
  const margin    = notional / cfg.leverage;
  if (capital - usedMargin < margin || capital <= 0) continue;

  // Open rung
  if (longs.length === 0) episodeOpenTs = ts;
  longs.push({ ep: close, et: ts, qty: notional / close, notional });
  lastAdd         = ts;
  lastEntryPrice  = close;

  // Snapshot indicators at FIRST RUNG (entry) — for predictive analysis of long-hold bad outcomes
  if (longs.length === 1 && pendingFirstRungSnap === null) {
    const lookback6  = Math.min(72,  i5m + 1);
    const lookback12 = Math.min(144, i5m + 1);
    let max6 = -Infinity, min6 = Infinity, max12 = -Infinity, min12 = Infinity;
    let closeMax6 = -Infinity;
    for (let k = i5m - lookback6 + 1; k <= i5m; k++) {
      const bar = raw5m[k];
      if (bar.high  > max6) max6 = bar.high;
      if (bar.low   < min6) min6 = bar.low;
      if (bar.close > closeMax6) closeMax6 = bar.close;
    }
    for (let k = i5m - lookback12 + 1; k <= i5m; k++) {
      const bar = raw5m[k];
      if (bar.high > max12) max12 = bar.high;
      if (bar.low  < min12) min12 = bar.low;
    }
    const range6hPct  = (max6  - min6)  / close * 100;
    const range12hPct = (max12 - min12) / close * 100;
    const drawdown6hPct      = (close - closeMax6) / closeMax6 * 100;
    const bounceFromLow6hPct = (close - min6) / min6 * 100;
    const close6hAgo  = raw5m[Math.max(0, i5m - 72)].close;
    const close12hAgo = raw5m[Math.max(0, i5m - 144)].close;
    const slope6hPct  = (close - close6hAgo)  / close6hAgo  * 100;
    const slope12hPct = (close - close12hAgo) / close12hAgo * 100;
    pendingFirstRungSnap = {
      ts, price: close,
      crsi4H: getCrsi4H(ts),
      rsi1H: get1H(ts).rsi,
      distEma200_4H: getEma200Dist4H(ts),
      btcRet1H: getBtcRet(ts),
      range6hPct, range12hPct, drawdown6hPct, bounceFromLow6hPct,
      slope6hPct, slope12hPct,
      fundingArmed: isFundingGateArmed(ts, close),
    };
  }

  // Snapshot indicators the moment we hit max rungs (for dynamic-expansion analysis)
  if (longs.length === cfg.maxPositions && pendingMaxRungSnap === null) {
    // Weighted avg entry across all rungs
    const totalNotional = longs.reduce((s, p) => s + p.notional, 0);
    const totalQty      = longs.reduce((s, p) => s + p.qty, 0);
    const avgEntry      = totalNotional / totalQty;
    const distFromAvgPct = (close - avgEntry) / avgEntry * 100;

    // Hold time since first rung
    const holdHours = (ts - longs[0].et) / 3600000;

    // Look back 6h (72 bars) and 12h (144 bars) of 5m candles
    const lookback6  = Math.min(72,  i5m + 1);
    const lookback12 = Math.min(144, i5m + 1);
    let max6 = -Infinity, min6 = Infinity, max12 = -Infinity, min12 = Infinity;
    let closeMax6 = -Infinity;
    for (let k = i5m - lookback6 + 1; k <= i5m; k++) {
      const bar = raw5m[k];
      if (bar.high  > max6) max6 = bar.high;
      if (bar.low   < min6) min6 = bar.low;
      if (bar.close > closeMax6) closeMax6 = bar.close;
    }
    for (let k = i5m - lookback12 + 1; k <= i5m; k++) {
      const bar = raw5m[k];
      if (bar.high > max12) max12 = bar.high;
      if (bar.low  < min12) min12 = bar.low;
    }
    const range6hPct  = (max6  - min6)  / close * 100;
    const range12hPct = (max12 - min12) / close * 100;
    const drawdown6hPct      = (close - closeMax6) / closeMax6 * 100;     // ≤ 0
    const bounceFromLow6hPct = (close - min6) / min6 * 100;               // ≥ 0
    const close6hAgo = raw5m[Math.max(0, i5m - 72)].close;
    const slope6hPct = (close - close6hAgo) / close6hAgo * 100;

    pendingMaxRungSnap = {
      ts,
      price: close,
      crsi4H: getCrsi4H(ts),
      rsi1H: get1H(ts).rsi,
      distEma200_4H: getEma200Dist4H(ts),
      btcRet1H: getBtcRet(ts),
      distFromAvgPct,
      holdHours,
      range6hPct,
      range12hPct,
      drawdown6hPct,
      bounceFromLow6hPct,
      slope6hPct,
    };

    // Dynamic expansion gate: stalled drawdown + non-falling slope
    if (EXPAND_GATE && range6hPct <= EXPAND_RANGE6 && slope6hPct >= EXPAND_SLOPE6) {
      maxRungsThisEp = EXPAND_MAX_RUNGS;
      expFires++;
      getExpMo(ts).fires++;
    }
  }
}

return { capital, maxDD, totalLadderPnl, totalHedgePnl, totalWedPnl, totalPF0Pnl, totalRsPnl,
         totalTPs, totalStales, totalKills, totalFlats,
         totalHedgeFires, totalWedTrades, totalWedWins,
         totalPF0Trades, totalPF0Wins, totalRsTrades, totalRsWins,
         totalSrBlocks, totalSrScaled, totalSrBoosted, totalSrFlattens, totalOverextBlocks,
         depthHist, maxDepthHolds, maxDepthSnaps, firstRungSnaps, checkpointSnaps,
         expFires, expTPs, expKFs, expStales, expExtraPnl, expMonthly,
         monthly, trades };
}

// ── Compare mode: run all 6 SR modes side-by-side (ladder-only) ──
if (SR_COMPARE) {
  const runs: { mode: SrMode; label: string; result: ReturnType<typeof runSim> }[] = [];
  for (const m of ["off", "skip", "scale", "boost", "both", "skip-flatten"] as SrMode[]) {
    SR_MODE = m;
    runs.push({ mode: m, label: m, result: runSim("ladder-only") });
  }
  const baseline = runs[0].result;

  const sep = "═".repeat(140);
  const div = "─".repeat(140);
  console.log("\n" + sep);
  console.log(`  SR-MODE COMPARE — Ladder-Only — ${cfg.symbol}  |  ${START} → present`);
  console.log(`  Capital: $${cfg.initialCapital}  Base: $${cfg.basePositionUsdt}  Buffer: ${SR_BUFFER_PCT}%  ScaleMin: ${SR_SCALE_MIN}  BoostMax: ${SR_BOOST_MAX}  MinTouches: ${SR_MIN_TOUCHES}  KeepRungs: ${SR_KEEP_RUNGS}  FlattenBuf: ${SR_FLATTEN_BUFFER_PCT}%`);
  console.log(`  Levels: ${srLevels.resistance.length}R (${stillActiveR} active EOP) / ${srLevels.support.length}S (${stillActiveS} active EOP)`);
  console.log(sep);

  // ── 6-mode totals table ──
  console.log(`\n  TOTALS:`);
  console.log(`  ${"Mode".padEnd(13)} ${"Equity".padStart(10)}  ${"Return".padStart(8)}  ${"MaxDD".padStart(7)}  ${"TPs".padStart(4)}  ${"Kills".padStart(5)}  ${"Flats".padStart(5)}  ${"Skip".padStart(5)}  ${"Scale".padStart(6)}  ${"Boost".padStart(6)}  ${"PFlat".padStart(5)}  ${"ΔEq".padStart(8)}  ${"ΔDD".padStart(7)}`);
  console.log("  " + "─".repeat(125));
  for (const { mode, result: r } of runs) {
    const ret    = (r.capital / cfg.initialCapital - 1) * 100;
    const eqDiff = r.capital - baseline.capital;
    const ddDiff = r.maxDD   - baseline.maxDD;
    console.log(`  ${mode.padEnd(13)} $${r.capital.toFixed(0).padStart(8)}  ${((ret >= 0 ? "+" : "") + ret.toFixed(1) + "%").padStart(8)}  ${(r.maxDD.toFixed(1) + "%").padStart(7)}  ${String(r.totalTPs).padStart(4)}  ${String(r.totalKills).padStart(5)}  ${String(r.totalFlats).padStart(5)}  ${String(r.totalSrBlocks).padStart(5)}  ${String(r.totalSrScaled).padStart(6)}  ${String(r.totalSrBoosted).padStart(6)}  ${String(r.totalSrFlattens).padStart(5)}  ${(mode === "off" ? "—" : (eqDiff >= 0 ? "+" : "") + "$" + eqDiff.toFixed(0)).padStart(8)}  ${(mode === "off" ? "—" : (ddDiff >= 0 ? "+" : "") + ddDiff.toFixed(1) + "p").padStart(7)}`);
  }

  // ── Pick the best non-baseline mode by equity ──
  const sorted = runs.slice(1).sort((a, b) => b.result.capital - a.result.capital);
  const best = sorted[0];
  console.log(`\n  BEST NON-BASELINE: "${best.mode}"  →  $${best.result.capital.toFixed(0)} vs baseline $${baseline.capital.toFixed(0)}  (${best.result.capital - baseline.capital >= 0 ? "+" : ""}$${(best.result.capital - baseline.capital).toFixed(0)})`);

  // ── Monthly side-by-side: baseline vs best mode ──
  const months = Array.from(new Set([...Object.keys(baseline.monthly), ...Object.keys(best.result.monthly)])).sort();
  const allPnls = months.flatMap(m => [
    baseline.monthly[m]?.ladderPnl ?? 0,
    best.result.monthly[m]?.ladderPnl ?? 0,
  ]);
  const maxAbsPnl = Math.max(1, ...allPnls.map(Math.abs));

  console.log(`\n  MONTHLY: baseline ░  vs  ${best.mode} ▓   (P/L bar scale=$${maxAbsPnl.toFixed(0)})`);
  console.log("  " + div);
  console.log(`  ${"Month".padEnd(8)} | ${"BASE $".padStart(8)} ${best.mode.toUpperCase().padStart(8)} ${"Δ $".padStart(8)} | ${"BASE DD".padStart(8)} ${best.mode.toUpperCase().padStart(8)} ${"Δ DD".padStart(7)} | ${"BASE Eq".padStart(10)} ${(best.mode + " Eq").padStart(10)} | P/L Bar`);
  console.log("  " + div);

  const w = 14;
  function halfBar(v: number, ch: string) {
    const len = Math.round(Math.abs(v) / maxAbsPnl * w);
    const s = ch.repeat(Math.min(len, w));
    return v >= 0
      ? { left: " ".repeat(w), right: s.padEnd(w) }
      : { left: " ".repeat(w - s.length) + s, right: " ".repeat(w) };
  }
  function mergeBar(a: string, b: string) {
    let out = "";
    for (let i = 0; i < a.length; i++) {
      const ca = a[i], cb = b[i];
      out += cb !== " " ? cb : (ca !== " " ? ca : " ");
    }
    return out;
  }

  let cumBase = cfg.initialCapital;
  let cumBest = cfg.initialCapital;
  for (const m of months) {
    const b = baseline.monthly[m]    || { ladderPnl: 0, peakDD: 0 } as any;
    const g = best.result.monthly[m] || { ladderPnl: 0, peakDD: 0 } as any;
    cumBase += b.ladderPnl;
    cumBest += g.ladderPnl;
    const dPnl = g.ladderPnl - b.ladderPnl;
    const dDD  = g.peakDD - b.peakDD;
    const bB = halfBar(b.ladderPnl, "░");
    const bG = halfBar(g.ladderPnl, "▓");
    const visual = mergeBar(bB.left, bG.left) + "│" + mergeBar(bB.right, bG.right);
    const fmt    = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`;
    const fmtDD  = (v: number) => `${v.toFixed(1)}%`;
    console.log(`  ${m.padEnd(8)} | ${("$" + fmt(b.ladderPnl)).padStart(8)} ${("$" + fmt(g.ladderPnl)).padStart(8)} ${("$" + fmt(dPnl)).padStart(8)} | ${fmtDD(b.peakDD).padStart(8)} ${fmtDD(g.peakDD).padStart(8)} ${((dDD >= 0 ? "+" : "") + dDD.toFixed(1) + "p").padStart(7)} | $${cumBase.toFixed(0).padStart(8)} $${cumBest.toFixed(0).padStart(8)} | ${visual}`);
  }
  console.log("  " + div);
  const eqDiffBest = best.result.capital - baseline.capital;
  const ddDiffBest = best.result.maxDD - baseline.maxDD;
  console.log(`  ${"TOTAL".padEnd(8)} | ${("$+" + (baseline.capital - cfg.initialCapital).toFixed(0)).padStart(8)} ${("$+" + (best.result.capital - cfg.initialCapital).toFixed(0)).padStart(8)} ${("$" + (eqDiffBest >= 0 ? "+" : "") + eqDiffBest.toFixed(0)).padStart(8)} | ${(baseline.maxDD.toFixed(1) + "%").padStart(8)} ${(best.result.maxDD.toFixed(1) + "%").padStart(8)} ${((ddDiffBest >= 0 ? "+" : "") + ddDiffBest.toFixed(1) + "p").padStart(7)}`);
  console.log("  " + sep + "\n");
  process.exit(0);
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
if (TP_STREAK_SHORT) console.log(`    TP-streak short: N=${TS_N} clean TPs  $${TS_NOTIONAL} notional  TP=${TS_TP_PCT}%  stop=${TS_STOP_PCT}%  maxHold=${TS_MAX_HOLD_H}h  cd=${TS_COOLDOWN_MS/60000}min`);
console.log(`    SR mode: ${SR_MODE === "off" ? "off" : `${SR_MODE}  buf=${SR_BUFFER_PCT}%  scaleMin=${SR_SCALE_MIN}  boostMax=${SR_BOOST_MAX}  minTouches=${SR_MIN_TOUCHES}  levels=${srLevels.resistance.length}R/${srLevels.support.length}S`}`);

// ── Summary comparison table ──────────────────────────────────────
console.log(`\n  ${div}`);
console.log(`  ${"Config".padEnd(38)} ${"Equity".padEnd(12)} ${"Return".padEnd(10)} ${"MaxDD".padEnd(8)} ${"TPs".padEnd(5)} ${"Stales".padEnd(7)} ${"Kills".padEnd(6)} ${"Flats".padEnd(6)} ${"Hedge".padEnd(8)} ${"Wed".padEnd(8)} ${"PF0".padEnd(10)}`);
console.log("  " + div);

for (const r of results) {
  const ret = ((r.capital / cfg.initialCapital - 1) * 100);
  const wedWR = r.totalWedTrades > 0 ? `${r.totalWedWins}/${r.totalWedTrades}` : "—";
  const pf0WR = r.totalPF0Trades > 0 ? `${r.totalPF0Wins}/${r.totalPF0Trades}` : "—";
  const pf0S = r.totalPF0Pnl !== 0 ? `$${r.totalPF0Pnl >= 0 ? "+" : ""}${r.totalPF0Pnl.toFixed(0)}(${pf0WR})` : "—";
  const rsWR = r.totalRsTrades > 0 ? `${r.totalRsWins}/${r.totalRsTrades}` : "—";
  const rsS = r.totalRsPnl !== 0 ? `$${r.totalRsPnl >= 0 ? "+" : ""}${r.totalRsPnl.toFixed(0)}(${rsWR})` : "—";
  console.log(`  ${r.label.padEnd(38)} $${r.capital.toFixed(0).padStart(10)}  ${(ret >= 0 ? "+" : "") + ret.toFixed(1) + "%"}${" ".repeat(Math.max(0, 8 - ((ret >= 0 ? "+" : "") + ret.toFixed(1) + "%").length))} ${(r.maxDD.toFixed(1) + "%").padStart(6)}  ${String(r.totalTPs).padStart(3)}   ${String(r.totalStales).padStart(4)}    ${String(r.totalKills).padStart(3)}    ${String(r.totalFlats).padStart(3)}   $${r.totalHedgePnl >= 0 ? "+" : ""}${r.totalHedgePnl.toFixed(0).padStart(5)}  ${wedWR.padStart(5)}  ${pf0S}  ${rsS}${SR_MODE !== "off" ? `  SR(${SR_MODE}):skip=${r.totalSrBlocks} scale=${r.totalSrScaled} boost=${r.totalSrBoosted}` : ""}`);
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
    const net = m.ladderPnl + m.hedgePnl + m.wedPnl + m.pf0Pnl + m.rsPnl;
    const lS  = (m.ladderPnl >= 0 ? "$+" : "$") + m.ladderPnl.toFixed(0);
    const hS  = (m.hedgePnl  >= 0 ? "$+" : "$") + m.hedgePnl.toFixed(0);
    const wS  = (m.wedPnl    >= 0 ? "$+" : "$") + m.wedPnl.toFixed(0);
    const pS  = (m.pf0Pnl    >= 0 ? "$+" : "$") + m.pf0Pnl.toFixed(0);
    const rS  = (m.rsPnl     >= 0 ? "$+" : "$") + m.rsPnl.toFixed(0);
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
    const rsStr  = m.rsTrades  > 0 ? `${m.rsTrades}t/${m.rsWins}w` : "";
    console.log(`  ${mo}  N=${String(m.n).padEnd(3)} WR=${wr.padStart(3)}%  Ladder=${lS.padStart(8)}  Hedge=${hS.padStart(7)}  Wed=${wS.padStart(7)}(${wedStr.padEnd(5)})  PF0=${pS.padStart(7)}(${pf0Str.padEnd(5)})  RS=${rS.padStart(7)}(${rsStr.padEnd(5)})  Net=${nS.padStart(8)}  DD=${ddS.padStart(6)}  ${eqRange.padEnd(18)} ${exits}`);
  }

  // ── Close-depth histogram: ladder lifecycle exits grouped by rung count ──
  const depths = Object.keys(r.depthHist).map(Number).sort((a, b) => b - a);
  if (depths.length > 0) {
    const totalEpisodes = depths.reduce((s, d) => s + (r.depthHist[d].tp + r.depthHist[d].stale + r.depthHist[d].kill + r.depthHist[d].flat), 0);
    console.log(`\n  CLOSE-DEPTH HISTOGRAM (ladder episodes by rung count at close):`);
    console.log(`  ${"Rungs".padEnd(6)} ${"Total".padStart(6)} ${"%".padStart(6)} | ${"TP".padStart(5)} ${"Stale".padStart(6)} ${"Kill".padStart(5)} ${"Flat".padStart(5)} | ${"TP%".padStart(6)}`);
    console.log("  " + "─".repeat(70));
    let cumTp = 0, cumTotal = 0;
    for (const d of depths) {
      const row = r.depthHist[d];
      const sub = row.tp + row.stale + row.kill + row.flat;
      const pct = (sub / totalEpisodes) * 100;
      const tpRate = sub > 0 ? (row.tp / sub) * 100 : 0;
      cumTp += row.tp;
      cumTotal += sub;
      console.log(`  ${String(d).padEnd(6)} ${String(sub).padStart(6)} ${(pct.toFixed(1) + "%").padStart(6)} | ${String(row.tp).padStart(5)} ${String(row.stale).padStart(6)} ${String(row.kill).padStart(5)} ${String(row.flat).padStart(5)} | ${(tpRate.toFixed(0) + "%").padStart(6)}`);
    }
    console.log("  " + "─".repeat(70));
    console.log(`  ${"TOTAL".padEnd(6)} ${String(cumTotal).padStart(6)} ${"100%".padStart(6)} | TP=${cumTp} (${((cumTp/cumTotal)*100).toFixed(0)}% of all episodes)`);
  }

  // ── Hold-time buckets for max-depth (rung 11) episodes ──
  if (r.maxDepthHolds && r.maxDepthHolds.length > 0) {
    const holds = r.maxDepthHolds;
    const buckets: { label: string; min: number; max: number }[] = [
      { label: "< 24h",       min: 0,        max: 24 },
      { label: "24-48h",      min: 24,       max: 48 },
      { label: "48-72h",      min: 48,       max: 72 },
      { label: "3-7 days",    min: 72,       max: 7 * 24 },
      { label: "7-14 days",   min: 7 * 24,   max: 14 * 24 },
      { label: "14-30 days",  min: 14 * 24,  max: 30 * 24 },
      { label: "30+ days",    min: 30 * 24,  max: Infinity },
    ];
    console.log(`\n  MAX-DEPTH (${cfg.maxPositions}-rung) HOLD-TIME DISTRIBUTION:`);
    console.log(`  ${"Bucket".padEnd(12)} ${"N".padStart(5)} ${"%".padStart(6)} | ${"TP".padStart(4)} ${"Stale".padStart(6)} ${"Kill".padStart(5)} ${"Flat".padStart(5)}`);
    console.log("  " + "─".repeat(60));
    for (const b of buckets) {
      const inBucket = holds.filter(h => h.hours >= b.min && h.hours < b.max);
      if (inBucket.length === 0) continue;
      const tp = inBucket.filter(h => h.outcome === "tp").length;
      const stale = inBucket.filter(h => h.outcome === "stale").length;
      const kill = inBucket.filter(h => h.outcome === "kill").length;
      const flat = inBucket.filter(h => h.outcome === "flat").length;
      const pct = (inBucket.length / holds.length) * 100;
      console.log(`  ${b.label.padEnd(12)} ${String(inBucket.length).padStart(5)} ${(pct.toFixed(1) + "%").padStart(6)} | ${String(tp).padStart(4)} ${String(stale).padStart(6)} ${String(kill).padStart(5)} ${String(flat).padStart(5)}`);
    }
    console.log("  " + "─".repeat(60));
    const stuck7d = holds.filter(h => h.hours >= 7 * 24);
    const stuck14d = holds.filter(h => h.hours >= 14 * 24);
    const sortedHrs = holds.map(h => h.hours).sort((a, b) => a - b);
    const median = sortedHrs[Math.floor(sortedHrs.length / 2)];
    const p75 = sortedHrs[Math.floor(sortedHrs.length * 0.75)];
    const p95 = sortedHrs[Math.floor(sortedHrs.length * 0.95)];
    console.log(`  Median hold: ${(median / 24).toFixed(1)}d | p75: ${(p75 / 24).toFixed(1)}d | p95: ${(p95 / 24).toFixed(1)}d`);
    console.log(`  Stuck >= 7 days: ${stuck7d.length} (${((stuck7d.length / holds.length) * 100).toFixed(1)}% of max-depth) | >= 14 days: ${stuck14d.length} (${((stuck14d.length / holds.length) * 100).toFixed(1)}%)`);
  }

  // ── Indicator separation: clean-TP vs kill/flat at moment rung 11 was added ──
  if (r.maxDepthSnaps && r.maxDepthSnaps.length > 0) {
    const snaps = r.maxDepthSnaps;
    const cleanTP = snaps.filter(s => s.outcome === "tp");
    const badEnd  = snaps.filter(s => s.outcome === "kill" || s.outcome === "flat");
    const stale   = snaps.filter(s => s.outcome === "stale");

    function stats(arr: number[]): { n: number; mean: number; med: number; p25: number; p75: number; min: number; max: number } {
      if (arr.length === 0) return { n: 0, mean: 0, med: 0, p25: 0, p75: 0, min: 0, max: 0 };
      const sorted = [...arr].sort((a, b) => a - b);
      const sum = sorted.reduce((s, v) => s + v, 0);
      return {
        n: sorted.length,
        mean: sum / sorted.length,
        med:  sorted[Math.floor(sorted.length / 2)],
        p25:  sorted[Math.floor(sorted.length * 0.25)],
        p75:  sorted[Math.floor(sorted.length * 0.75)],
        min:  sorted[0],
        max:  sorted[sorted.length - 1],
      };
    }

    function pull(group: typeof snaps, key: keyof MaxRungSnap): number[] {
      return group.map(g => g.snap[key] as number | null).filter((v): v is number => v !== null && !isNaN(v));
    }

    const indicators: { name: keyof MaxRungSnap; label: string }[] = [
      { name: "crsi4H",             label: "CRSI 4H" },
      { name: "rsi1H",              label: "RSI 1H" },
      { name: "distEma200_4H",      label: "Dist EMA200 4H (%)" },
      { name: "btcRet1H",           label: "BTC 1H ret (%)" },
      { name: "distFromAvgPct",     label: "Dist from avg (%)" },
      { name: "holdHours",          label: "Hold hours @ rung11" },
      { name: "range6hPct",         label: "Range 6h (%)" },
      { name: "range12hPct",        label: "Range 12h (%)" },
      { name: "drawdown6hPct",      label: "DD vs 6h max (%)" },
      { name: "bounceFromLow6hPct", label: "Bounce 6h low (%)" },
      { name: "slope6hPct",         label: "Slope 6h (%)" },
    ];

    console.log(`\n  INDICATOR SNAPSHOT AT RUNG ${cfg.maxPositions} ADD — clean-TP vs kill/flat (${snaps.length} episodes)`);
    console.log(`  ${"Indicator".padEnd(22)} ${"Group".padEnd(10)} ${"N".padStart(4)} ${"mean".padStart(8)} ${"med".padStart(8)} ${"p25".padStart(8)} ${"p75".padStart(8)} ${"min".padStart(8)} ${"max".padStart(8)}`);
    console.log("  " + "─".repeat(95));
    for (const ind of indicators) {
      for (const [glabel, group] of [["TP", cleanTP] as const, ["KILL/FLT", badEnd] as const, ["STALE", stale] as const]) {
        const s = stats(pull(group, ind.name));
        if (s.n === 0) continue;
        console.log(`  ${ind.label.padEnd(22)} ${glabel.padEnd(10)} ${String(s.n).padStart(4)} ${s.mean.toFixed(1).padStart(8)} ${s.med.toFixed(1).padStart(8)} ${s.p25.toFixed(1).padStart(8)} ${s.p75.toFixed(1).padStart(8)} ${s.min.toFixed(1).padStart(8)} ${s.max.toFixed(1).padStart(8)}`);
      }
      console.log("  " + "·".repeat(95));
    }

    // ── Threshold-gate test: for each indicator, find the threshold that
    // best separates "TP" from "KILL/FLAT" by precision (TP rate when gate fires)
    console.log(`\n  THRESHOLD GATE TEST — "expand if INDICATOR <= X" (or >= X)`);
    console.log(`  Goal: maximize TP-rate within the fired group, with N >= 10 fires`);
    console.log(`  ${"Indicator".padEnd(22)} ${"Direction".padEnd(10)} ${"Best X".padStart(8)} ${"Fires".padStart(6)} ${"TP".padStart(4)} ${"K/F".padStart(4)} ${"S".padStart(4)} ${"TP%".padStart(6)} ${"vs base".padStart(8)}`);
    console.log("  " + "─".repeat(95));

    const baseTpRate = cleanTP.length / snaps.length;

    for (const ind of indicators) {
      const allVals = snaps.map(s => ({ v: s.snap[ind.name] as number | null, outcome: s.outcome }))
                            .filter(x => x.v !== null && !isNaN(x.v as number)) as { v: number; outcome: string }[];
      if (allVals.length < 20) continue;

      for (const dir of ["<=", ">="] as const) {
        let bestX = 0, bestTpRate = 0, bestN = 0, bestTp = 0, bestKf = 0, bestS = 0;
        // Try every percentile from 5..95
        const sortedVals = [...allVals].map(x => x.v).sort((a, b) => a - b);
        const candidateThresholds = new Set<number>();
        for (let p = 5; p <= 95; p += 5) {
          candidateThresholds.add(sortedVals[Math.floor(sortedVals.length * p / 100)]);
        }
        for (const x of candidateThresholds) {
          const fired = allVals.filter(a => dir === "<=" ? a.v <= x : a.v >= x);
          if (fired.length < 10) continue;
          const tps = fired.filter(a => a.outcome === "tp").length;
          const kfs = fired.filter(a => a.outcome === "kill" || a.outcome === "flat").length;
          const ss  = fired.filter(a => a.outcome === "stale").length;
          const rate = tps / fired.length;
          if (rate > bestTpRate) {
            bestTpRate = rate; bestX = x; bestN = fired.length; bestTp = tps; bestKf = kfs; bestS = ss;
          }
        }
        if (bestN > 0) {
          const lift = (bestTpRate - baseTpRate) * 100;
          console.log(`  ${ind.label.padEnd(22)} ${dir.padEnd(10)} ${bestX.toFixed(1).padStart(8)} ${String(bestN).padStart(6)} ${String(bestTp).padStart(4)} ${String(bestKf).padStart(4)} ${String(bestS).padStart(4)} ${(bestTpRate * 100).toFixed(0) + "%"} ${(lift >= 0 ? "+" : "") + lift.toFixed(1) + "p"}`);
        }
      }
      console.log("  " + "·".repeat(95));
    }
    console.log(`  Baseline TP-rate at max-depth: ${(baseTpRate * 100).toFixed(0)}% (${cleanTP.length}/${snaps.length})`);
  }

  // ── FIRST-RUNG ENTRY FILTER ANALYSIS ──
  // Find indicator thresholds AT FIRST RUNG ENTRY that would block bad-outcome ladders
  // (kill, flat, stale-with-loss, long-hold non-TP) while preserving fast TPs.
  if (r.firstRungSnaps && r.firstRungSnaps.length > 0) {
    const fr = r.firstRungSnaps;
    // Classify each ladder
    type Cls = "GOOD_FAST" | "GOOD_SLOW" | "BAD";
    const classify = (e: { outcome: string; holdHours: number; pnlUsd: number }): Cls => {
      if (e.outcome === "kill" || e.outcome === "flat") return "BAD";
      if (e.outcome === "stale" && e.pnlUsd <= 0)       return "BAD";
      if (e.holdHours > 24 && e.pnlUsd <= 0)            return "BAD";
      if (e.outcome === "tp" && e.holdHours <= 8)       return "GOOD_FAST";
      return "GOOD_SLOW";
    };
    const classed = fr.map(e => ({ ...e, cls: classify(e) }));
    const nGoodFast = classed.filter(c => c.cls === "GOOD_FAST").length;
    const nGoodSlow = classed.filter(c => c.cls === "GOOD_SLOW").length;
    const nBad      = classed.filter(c => c.cls === "BAD").length;
    const totalPnl  = classed.reduce((s, c) => s + c.pnlUsd, 0);
    const badPnl    = classed.filter(c => c.cls === "BAD").reduce((s, c) => s + c.pnlUsd, 0);
    const goodFastPnl = classed.filter(c => c.cls === "GOOD_FAST").reduce((s, c) => s + c.pnlUsd, 0);

    console.log(`\n  ════════ FIRST-RUNG ENTRY FILTER ANALYSIS (${fr.length} ladder episodes) ════════`);
    console.log(`  Classification:`);
    console.log(`    GOOD_FAST (TP within 8h):     ${String(nGoodFast).padStart(4)}  pnl $${goodFastPnl.toFixed(0)}`);
    console.log(`    GOOD_SLOW (TP after 8h):      ${String(nGoodSlow).padStart(4)}  pnl $${classed.filter(c => c.cls === "GOOD_SLOW").reduce((s, c) => s + c.pnlUsd, 0).toFixed(0)}`);
    console.log(`    BAD (kill/flat/stale-loss/long-hold-loss): ${String(nBad).padStart(4)}  pnl $${badPnl.toFixed(0)}`);
    console.log(`    Total ladder pnl: $${totalPnl.toFixed(0)}`);

    const indicators: { name: keyof FirstRungSnap; label: string }[] = [
      { name: "crsi4H",             label: "CRSI 4H" },
      { name: "rsi1H",              label: "RSI 1H" },
      { name: "distEma200_4H",      label: "Dist EMA200 4H (%)" },
      { name: "btcRet1H",           label: "BTC 1H ret (%)" },
      { name: "range6hPct",         label: "Range 6h (%)" },
      { name: "range12hPct",        label: "Range 12h (%)" },
      { name: "drawdown6hPct",      label: "DD vs 6h max (%)" },
      { name: "bounceFromLow6hPct", label: "Bounce 6h low (%)" },
      { name: "slope6hPct",         label: "Slope 6h (%)" },
      { name: "slope12hPct",        label: "Slope 12h (%)" },
    ];

    // For each indicator + direction + threshold: simulate "block all ladders where snap satisfies gate"
    // Goal: maximize PnL saved (=  blocked bad pnl - blocked good pnl)
    console.log(`\n  ENTRY-BLOCK SCAN — "BLOCK entry if INDICATOR <op> X"`);
    console.log(`  For each gate: shows what would happen if these ladders never entered.`);
    console.log(`  ${"Indicator".padEnd(22)} ${"Op".padEnd(3)} ${"X".padStart(7)} ${"Block".padStart(6)} ${"Bad".padStart(4)} ${"Gfast".padStart(5)} ${"Gslow".padStart(5)} ${"PnL saved".padStart(11)} ${"Net Δ$".padStart(9)}`);
    console.log("  " + "─".repeat(95));

    type Result = { indicator: string; op: string; x: number; block: number; bad: number; gfast: number; gslow: number; pnlSaved: number; netDelta: number };
    const allResults: Result[] = [];

    for (const ind of indicators) {
      const vals = classed.map(c => ({ v: c.snap[ind.name] as number | null, c }))
                          .filter(x => x.v !== null && !isNaN(x.v as number)) as { v: number; c: typeof classed[0] }[];
      if (vals.length < 50) continue;

      const sortedV = [...vals].map(x => x.v).sort((a, b) => a - b);
      const candidates = new Set<number>();
      for (let p = 5; p <= 95; p += 5) {
        candidates.add(sortedV[Math.floor(sortedV.length * p / 100)]);
      }

      let bestPerInd: Result | null = null;
      for (const op of ["<=", ">="] as const) {
        for (const x of candidates) {
          const fired = vals.filter(v => op === "<=" ? v.v <= x : v.v >= x);
          if (fired.length < 5 || fired.length > vals.length * 0.7) continue;
          const bad   = fired.filter(f => f.c.cls === "BAD");
          const gfast = fired.filter(f => f.c.cls === "GOOD_FAST");
          const gslow = fired.filter(f => f.c.cls === "GOOD_SLOW");
          const blockedPnl = bad.reduce((s, f) => s + f.c.pnlUsd, 0)
                           + gfast.reduce((s, f) => s + f.c.pnlUsd, 0)
                           + gslow.reduce((s, f) => s + f.c.pnlUsd, 0);
          // Net delta = how much PnL we gain by blocking these (positive = good)
          const netDelta = -blockedPnl;
          const pnlSaved = -bad.reduce((s, f) => s + f.c.pnlUsd, 0);  // money saved on bad outcomes
          const r: Result = {
            indicator: ind.label, op, x,
            block: fired.length, bad: bad.length, gfast: gfast.length, gslow: gslow.length,
            pnlSaved, netDelta,
          };
          if (!bestPerInd || r.netDelta > bestPerInd.netDelta) bestPerInd = r;
        }
      }
      if (bestPerInd) {
        allResults.push(bestPerInd);
        console.log(`  ${bestPerInd.indicator.padEnd(22)} ${bestPerInd.op.padEnd(3)} ${bestPerInd.x.toFixed(2).padStart(7)} ${String(bestPerInd.block).padStart(6)} ${String(bestPerInd.bad).padStart(4)} ${String(bestPerInd.gfast).padStart(5)} ${String(bestPerInd.gslow).padStart(5)} $${bestPerInd.pnlSaved.toFixed(0).padStart(9)} ${(bestPerInd.netDelta >= 0 ? "+" : "") + "$" + bestPerInd.netDelta.toFixed(0).padStart(7)}`);
      }
    }

    console.log("  " + "─".repeat(95));
    console.log(`  Block = total entries that would be skipped`);
    console.log(`  Bad/Gfast/Gslow = of those blocked, count by class`);
    console.log(`  PnL saved = $ avoided on BAD ladders | Net Δ$ = total PnL impact (positive = improve total)`);

    // Top 5 by net PnL improvement
    allResults.sort((a, b) => b.netDelta - a.netDelta);
    console.log(`\n  TOP 5 FILTERS BY NET PNL IMPROVEMENT:`);
    for (const r of allResults.slice(0, 5)) {
      const blockRate = r.block / fr.length * 100;
      const badCaptureRate = r.bad / nBad * 100;
      console.log(`    ${r.indicator} ${r.op} ${r.x.toFixed(2)} → block ${r.block} (${blockRate.toFixed(0)}% of all), catches ${r.bad}/${nBad} (${badCaptureRate.toFixed(0)}%) BAD. Net +$${r.netDelta.toFixed(0)}`);
    }

    // ── FUNDING-GATE ANALYSIS ──
    // 2× funding ≤ -0.02% within 24h → arm. Block rung-1 entries until price drops 5% from arm-trigger,
    // or 24h elapses. Tests whether this user-proposed gate beats indicator-based gates.
    const fundFired = classed.filter(c => c.snap.fundingArmed);
    if (fundFired.length > 0) {
      const fBad   = fundFired.filter(f => f.cls === "BAD");
      const fGfast = fundFired.filter(f => f.cls === "GOOD_FAST");
      const fGslow = fundFired.filter(f => f.cls === "GOOD_SLOW");
      const fBadPnl   = fBad.reduce((s, f) => s + f.pnlUsd, 0);
      const fGfastPnl = fGfast.reduce((s, f) => s + f.pnlUsd, 0);
      const fGslowPnl = fGslow.reduce((s, f) => s + f.pnlUsd, 0);
      const blockedPnl = fBadPnl + fGfastPnl + fGslowPnl;
      const netDelta   = -blockedPnl;
      console.log(`\n  ════════ FUNDING-GATE TEST: ${FUND_NEG_COUNT}× neg funding (≤ ${(FUND_NEG_THRESHOLD*100).toFixed(3)}%) within 24h, block until -${(FUND_DROP_REQUIRED*100).toFixed(0)}% drop or 24h expiry ════════`);
      console.log(`  Entries that would be blocked: ${fundFired.length}  (${(fundFired.length / fr.length * 100).toFixed(0)}% of all rung-1 entries)`);
      console.log(`    BAD  blocked: ${fBad.length}/${nBad} (${(fBad.length/Math.max(nBad,1)*100).toFixed(0)}% of bads caught)  pnl saved $${(-fBadPnl).toFixed(0)}`);
      console.log(`    Gfast blocked: ${fGfast.length}/${nGoodFast} (${(fGfast.length/Math.max(nGoodFast,1)*100).toFixed(0)}% of fast goods)  pnl lost $${fGfastPnl.toFixed(0)}`);
      console.log(`    Gslow blocked: ${fGslow.length}/${nGoodSlow} (${(fGslow.length/Math.max(nGoodSlow,1)*100).toFixed(0)}% of slow goods)  pnl lost $${fGslowPnl.toFixed(0)}`);
      console.log(`    Net Δ$: ${netDelta >= 0 ? "+" : ""}$${netDelta.toFixed(0)}`);
      const precision = fundFired.length > 0 ? (fBad.length / fundFired.length * 100) : 0;
      console.log(`    Precision (BAD / total blocked): ${precision.toFixed(1)}%   (single-indicator best was ~9.3%)`);
    } else {
      console.log(`\n  ════════ FUNDING-GATE TEST ════════`);
      console.log(`  No rung-1 entries fired the funding gate over the sim window.`);
    }

    // ── AND-COMBO ENTRY GATES ──
    // Test layered filters: only block when MULTIPLE bad signals coincide.
    // Combos drawn from top single-indicator results.
    type GateFn = (s: FirstRungSnap) => boolean;
    const combos: { name: string; fn: GateFn }[] = [
      { name: "slope12h>=2.55 AND CRSI4H<=56.9",
        fn: s => (s.slope12hPct >= 2.55) && (s.crsi4H !== null && s.crsi4H <= 56.9) },
      { name: "slope12h>=2.55 AND BTCret>=0.13",
        fn: s => (s.slope12hPct >= 2.55) && (s.btcRet1H !== null && s.btcRet1H >= 0.13) },
      { name: "slope12h>=2.55 AND RSI1H>=59.4",
        fn: s => (s.slope12hPct >= 2.55) && (s.rsi1H !== null && s.rsi1H >= 59.4) },
      { name: "CRSI4H<=56.9 AND BTCret>=0.13",
        fn: s => (s.crsi4H !== null && s.crsi4H <= 56.9) && (s.btcRet1H !== null && s.btcRet1H >= 0.13) },
      { name: "CRSI4H<=56.9 AND RSI1H>=59.4",
        fn: s => (s.crsi4H !== null && s.crsi4H <= 56.9) && (s.rsi1H !== null && s.rsi1H >= 59.4) },
      { name: "Range6h<=4.86 AND slope12h>=2.55",
        fn: s => (s.range6hPct <= 4.86) && (s.slope12hPct >= 2.55) },
      { name: "3-of-3: slope12h>=2.55 AND CRSI4H<=56.9 AND BTCret>=0.13",
        fn: s => (s.slope12hPct >= 2.55) && (s.crsi4H !== null && s.crsi4H <= 56.9) && (s.btcRet1H !== null && s.btcRet1H >= 0.13) },
      { name: "3-of-3: slope12h>=2.55 AND CRSI4H<=56.9 AND RSI1H>=59.4",
        fn: s => (s.slope12hPct >= 2.55) && (s.crsi4H !== null && s.crsi4H <= 56.9) && (s.rsi1H !== null && s.rsi1H >= 59.4) },
      { name: "Range12h<=7.39 AND slope12h>=2.55",
        fn: s => (s.range12hPct <= 7.39) && (s.slope12hPct >= 2.55) },
    ];
    console.log(`\n  ════════ AND-COMBO ENTRY GATE TEST (block rung-1 when ALL conditions true) ════════`);
    console.log(`  ${"Combo".padEnd(60)} ${"Block".padStart(5)} ${"Bad".padStart(4)} ${"Gfast".padStart(5)} ${"Gslow".padStart(5)} ${"Net Δ$".padStart(9)} ${"Prec%".padStart(6)}`);
    console.log("  " + "─".repeat(105));
    for (const combo of combos) {
      const fired = classed.filter(c => combo.fn(c.snap));
      const cBad   = fired.filter(f => f.cls === "BAD");
      const cGfast = fired.filter(f => f.cls === "GOOD_FAST");
      const cGslow = fired.filter(f => f.cls === "GOOD_SLOW");
      const cBadPnl   = cBad.reduce((s, f) => s + f.pnlUsd, 0);
      const cGfastPnl = cGfast.reduce((s, f) => s + f.pnlUsd, 0);
      const cGslowPnl = cGslow.reduce((s, f) => s + f.pnlUsd, 0);
      const netDelta  = -(cBadPnl + cGfastPnl + cGslowPnl);
      const precision = fired.length > 0 ? (cBad.length / fired.length * 100) : 0;
      console.log(`  ${combo.name.padEnd(60)} ${String(fired.length).padStart(5)} ${String(cBad.length).padStart(4)} ${String(cGfast.length).padStart(5)} ${String(cGslow.length).padStart(5)} ${(netDelta >= 0 ? "+" : "") + "$" + netDelta.toFixed(0).padStart(7)} ${precision.toFixed(1).padStart(5)}%`);
    }

    // ── WALK-FORWARD VALIDATION ──
    // Split sample by midpoint timestamp; combos were tuned on the FULL set
    // (in-sample), so test how each combo holds up on each half independently.
    // If results collapse on H2 → in-sample overfit.
    const sortedByTs = [...classed].sort((a, b) => a.snap.ts - b.snap.ts);
    const midIdx = Math.floor(sortedByTs.length / 2);
    const firstHalf = sortedByTs.slice(0, midIdx);
    const secondHalf = sortedByTs.slice(midIdx);
    const splitTs = sortedByTs[midIdx]?.snap.ts ?? 0;
    const splitDate = splitTs > 0 ? new Date(splitTs).toISOString().slice(0, 10) : "n/a";
    console.log(`\n  ════════ WALK-FORWARD: split @ ${splitDate} (n=${firstHalf.length} vs n=${secondHalf.length}) ════════`);
    console.log(`  ${"Combo".padEnd(60)} ${"H1 Net".padStart(9)} ${"H1 Pr%".padStart(7)} ${"H2 Net".padStart(9)} ${"H2 Pr%".padStart(7)}`);
    console.log("  " + "─".repeat(105));
    const evalHalf = (half: typeof classed, fn: GateFn) => {
      const fired = half.filter(c => fn(c.snap));
      const bad   = fired.filter(f => f.cls === "BAD");
      const blockedPnl = fired.reduce((s, f) => s + f.pnlUsd, 0);
      const netDelta = -blockedPnl;
      const precision = fired.length > 0 ? (bad.length / fired.length * 100) : 0;
      return { netDelta, precision };
    };
    for (const combo of combos) {
      const h1 = evalHalf(firstHalf, combo.fn);
      const h2 = evalHalf(secondHalf, combo.fn);
      const h1str = `${(h1.netDelta >= 0 ? "+" : "") + "$" + h1.netDelta.toFixed(0)}`.padStart(9);
      const h2str = `${(h2.netDelta >= 0 ? "+" : "") + "$" + h2.netDelta.toFixed(0)}`.padStart(9);
      console.log(`  ${combo.name.padEnd(60)} ${h1str} ${h1.precision.toFixed(1).padStart(6)}% ${h2str} ${h2.precision.toFixed(1).padStart(6)}%`);
    }
    console.log(`  Reading: combo earns its keep only if BOTH halves stay positive.`);

    // ── THRESHOLD-ROBUSTNESS TEST ──
    // Re-run with rounded "loose" thresholds. If tight values (2.55, 56.9) work
    // but rounded (2.0, 60) collapse → curve-fit.
    const robustCombos: { name: string; fn: GateFn }[] = [
      { name: "LOOSE: slope12h>=2.0 AND CRSI4H<=60",
        fn: s => (s.slope12hPct >= 2.0) && (s.crsi4H !== null && s.crsi4H <= 60) },
      { name: "LOOSE: slope12h>=2.0 AND BTCret>=0.10",
        fn: s => (s.slope12hPct >= 2.0) && (s.btcRet1H !== null && s.btcRet1H >= 0.10) },
      { name: "LOOSE: slope12h>=3.0 AND CRSI4H<=55",
        fn: s => (s.slope12hPct >= 3.0) && (s.crsi4H !== null && s.crsi4H <= 55) },
      { name: "LOOSE: slope12h>=2.0 AND CRSI4H<=60 AND RSI1H>=55",
        fn: s => (s.slope12hPct >= 2.0) && (s.crsi4H !== null && s.crsi4H <= 60) && (s.rsi1H !== null && s.rsi1H >= 55) },
    ];
    console.log(`\n  ════════ THRESHOLD ROBUSTNESS (round numbers, looser bands) ════════`);
    console.log(`  ${"Combo".padEnd(60)} ${"Block".padStart(5)} ${"Bad".padStart(4)} ${"Gfast".padStart(5)} ${"Gslow".padStart(5)} ${"Net Δ$".padStart(9)} ${"Prec%".padStart(6)}`);
    console.log("  " + "─".repeat(105));
    for (const combo of robustCombos) {
      const fired = classed.filter(c => combo.fn(c.snap));
      const cBad   = fired.filter(f => f.cls === "BAD");
      const cGfast = fired.filter(f => f.cls === "GOOD_FAST");
      const cGslow = fired.filter(f => f.cls === "GOOD_SLOW");
      const blockedPnl = fired.reduce((s, f) => s + f.pnlUsd, 0);
      const netDelta  = -blockedPnl;
      const precision = fired.length > 0 ? (cBad.length / fired.length * 100) : 0;
      console.log(`  ${combo.name.padEnd(60)} ${String(fired.length).padStart(5)} ${String(cBad.length).padStart(4)} ${String(cGfast.length).padStart(5)} ${String(cGslow.length).padStart(5)} ${(netDelta >= 0 ? "+" : "") + "$" + netDelta.toFixed(0).padStart(7)} ${precision.toFixed(1).padStart(5)}%`);
    }
  }

  // ── EARLY-EXIT-ON-RELIEF-BOUNCE STUDY ──
  // At 4h after rung-1, capture indicators. If "armed-to-exit" markers fire,
  // post-hoc compute what would happen if we'd market-closed at the max-bounce
  // after the local low between checkpoint and actual close.
  if (r.checkpointSnaps && r.checkpointSnaps.length > 0) {
    const cps = r.checkpointSnaps;
    type Marker = { name: string; armed: (s: CheckpointSnap) => boolean };
    const markers: Marker[] = [
      { name: "pnl4h<=-1%",                       armed: s => s.pnlPctAt4h <= -1 },
      { name: "pnl4h<=-2%",                       armed: s => s.pnlPctAt4h <= -2 },
      { name: "slope6h<=-2%",                     armed: s => s.slope6hPct <= -2 },
      { name: "slope6h<=-3% AND BTC<=0",          armed: s => s.slope6hPct <= -3 && (s.btcRet1H ?? 0) <= 0 },
      { name: "pnl4h<=-1% AND slope6h<=-2%",      armed: s => s.pnlPctAt4h <= -1 && s.slope6hPct <= -2 },
      { name: "pnl4h<=-1% AND BTC<=-0.3%",        armed: s => s.pnlPctAt4h <= -1 && (s.btcRet1H ?? 0) <= -0.3 },
      { name: "pnl4h<=-1.5% AND CRSI4H<=40",      armed: s => s.pnlPctAt4h <= -1.5 && (s.crsi4H ?? 100) <= 40 },
      { name: "pnl4h<=-2% AND slope6h<=-3%",      armed: s => s.pnlPctAt4h <= -2 && s.slope6hPct <= -3 },
      { name: "pnl4h<=-1% AND slope6h<=0 AND BTC<=0", armed: s => s.pnlPctAt4h <= -1 && s.slope6hPct <= 0 && (s.btcRet1H ?? 0) <= 0 },
    ];
    const bouncePcts = [1.0, 1.5, 2.0, 3.0];

    console.log(`\n  ════════ EARLY-EXIT-ON-RELIEF-BOUNCE (mid-ladder cut-loss study, ${cps.length} ladders ≥4h life) ════════`);
    console.log(`  At 4h after rung-1, test marker. If armed → exit at +Xpct bounce off local low after checkpoint.`);
    console.log(`  Compares actual close PnL vs early-exit PnL on armed ladders only ($800 base notional proxy).`);
    console.log(`  ${"Marker".padEnd(48)} ${"Armed".padStart(5)} ${"BadHit".padStart(6)} ${"Bnc%".padStart(5)} ${"ActualPnL".padStart(11)} ${"EarlyPnL".padStart(11)} ${"Δ$".padStart(9)}`);
    console.log("  " + "─".repeat(105));

    const isBad = (ep: typeof cps[0]) =>
      ep.outcome === "kill" || ep.outcome === "flat" || ep.finalPnlPct < 0;

    for (const m of markers) {
      const armed = cps.filter(ep => m.armed(ep.snap));
      if (armed.length === 0) {
        console.log(`  ${m.name.padEnd(48)}     0      0    -          -          -          -`);
        continue;
      }
      const badHit = armed.filter(isBad).length;
      for (const bouncePct of bouncePcts) {
        let actualSum = 0;
        let earlySum  = 0;
        for (const ep of armed) {
          const s = ep.snap;
          const avgEntry = s.price / (1 + s.pnlPctAt4h / 100);
          const baseNot = 800;
          const actualPnl = baseNot * (ep.finalPnlPct / 100);
          actualSum += actualPnl;
          const target = s.minPriceAfter * (1 + bouncePct / 100);
          const reached = s.maxPriceAfterMin >= target && s.maxBounceTs > s.minPriceAfterTs;
          const exitPrice = reached ? target : ep.finalPrice;
          const earlyPnlPct = (exitPrice - avgEntry) / avgEntry * 100;
          earlySum += baseNot * (earlyPnlPct / 100);
        }
        const delta = earlySum - actualSum;
        const bouncStr = `${bouncePct.toFixed(1)}%`.padStart(5);
        console.log(`  ${m.name.padEnd(48)} ${String(armed.length).padStart(5)} ${String(badHit).padStart(6)} ${bouncStr} ${("$" + actualSum.toFixed(0)).padStart(11)} ${("$" + earlySum.toFixed(0)).padStart(11)} ${(delta >= 0 ? "+" : "") + "$" + delta.toFixed(0).padStart(7)}`);
      }
    }
    console.log(`  Reading: positive Δ$ = early exit beats letting it ride. Need positive across multiple bounce%s to be robust.`);
  }

  // ── Dynamic-expansion gate stats (only when SIM_EXPAND=1) ──
  if (r.expFires > 0) {
    console.log(`\n  DYNAMIC EXPANSION (rung ${cfg.maxPositions} → ${EXPAND_MAX_RUNGS})`);
    console.log(`  Gate: range6h <= ${EXPAND_RANGE6}% AND slope6h >= ${EXPAND_SLOPE6}%`);
    const total = r.expTPs + r.expKFs + r.expStales;
    const tpRate = total > 0 ? (r.expTPs / total) * 100 : 0;
    console.log(`  Fires: ${r.expFires}  | TP: ${r.expTPs}  K/F: ${r.expKFs}  Stale: ${r.expStales}  | TP%: ${tpRate.toFixed(0)}%  | Ladder PnL of expanded eps: $${r.expExtraPnl.toFixed(0)}`);
    console.log(`\n  Month     Fires    TP   K/F   Stale     PnL`);
    console.log("  " + "─".repeat(55));
    const months = Object.keys(r.expMonthly).sort();
    for (const mo of months) {
      const m = r.expMonthly[mo];
      console.log(`  ${mo}    ${String(m.fires).padStart(3)}  ${String(m.tp).padStart(4)}  ${String(m.kf).padStart(4)}  ${String(m.stale).padStart(5)}   ${(m.pnl >= 0 ? "+" : "") + "$" + m.pnl.toFixed(0)}`);
    }
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
