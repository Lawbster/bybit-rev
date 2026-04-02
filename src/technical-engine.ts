// ─────────────────────────────────────────────
// Technical Engine — multi-timeframe context for any pair
//
// Single entry point:
//   getContext(symbol, candles5m, asOfTs?) → TechnicalContext
//
// Consumed by: bots (gate), sims (filter), CLI (snapshot)
// Works for: spot, futures, leveraged, any market cap
//
// Timeframes built from 5m candles only (no extra fetches):
//   5m → 1H → 4H → 1D (resampled in-memory)
//
// Zones: hierarchical — 4H zone must be near a 1D zone to
//   count as Grade A. 1H zone must be near 4H zone for Grade B.
// ─────────────────────────────────────────────

import {
  RSI, BollingerBands, EMA, SMA, ATR, ADX, ROC,
  WilliamsR, OBV, VolumeProfile,
} from "technicalindicators";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

export type AssetClass = "major" | "mid" | "high-beta" | "micro";
export type ConfluenceGrade = "A" | "B" | "C" | "D" | "none";
export type SetupTag =
  | "zone_fresh_A" | "zone_fresh_B" | "zone_fresh_C"
  | "at_weekly_vwap" | "below_weekly_vwap"
  | "at_swinglow_vwap"
  | "fib_618" | "fib_5" | "fib_382"
  | "rsi_oversold_1d" | "rsi_oversold_4h" | "rsi_oversold_1h"
  | "crsi_oversold"
  | "bb_squeeze" | "bb_lower_touch"
  | "adx_trending" | "adx_ranging"
  | "vol_spike";

export interface ZoneLevel {
  timeframe: "1D" | "4H" | "1H";
  mid: number;
  low: number;
  high: number;
  touches: number;
  firstDate: string;
  isFreshTouch: boolean;       // meets re-arm rule at asOfTs
  hoursSinceLastInteraction: number;
}

export interface FibLevel {
  label: string;   // "0.382" | "0.5" | "0.618" | "0.786" | "1.0"
  price: number;
  distPct: number; // % from current price (negative = below price)
}

export interface TFIndicators {
  rsi14: number | null;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  bbWidth: number | null;     // (upper-lower)/mid %, proxy for squeeze
  bbPosition: number | null;  // 0=at lower, 1=at upper
  atrPct: number | null;      // ATR as % of price
  adx: number | null;
  williamsR: number | null;
  volumeRatio: number | null; // current vol / 20-period avg
}

export interface TechnicalContext {
  symbol: string;
  asOfTs: number;
  price: number;
  assetClass: AssetClass;

  // ── Zones ──
  confluenceGrade: ConfluenceGrade;
  zoneStack: { "1D": ZoneLevel | null; "4H": ZoneLevel | null; "1H": ZoneLevel | null };
  nearestSupportBelow: ZoneLevel | null;  // closest active zone below current price

  // ── VWAP ──
  weeklyVwap: number;
  weeklyVwapDistPct: number;      // negative = price below weekly VWAP
  swingLowVwap: number | null;    // anchored from last confirmed swing low
  swingLowVwapDistPct: number | null;

  // ── Fibonacci ──
  fibSwingHigh: number | null;
  fibSwingLow: number | null;
  fibLevels: FibLevel[];          // retracement levels from last swing

  // ── Per-timeframe indicators ──
  indicators: {
    "1H": TFIndicators;
    "4H": TFIndicators;
    "1D": TFIndicators;
  };

  // ── CRSI (ConnorsRSI) — useful on high-beta / micro ──
  crsi1H: number | null;   // 0-100, <20 = oversold
  crsi4H: number | null;

  // ── Pattern tags active right now ──
  activeSetups: SetupTag[];

  // ── Composite score 0-100 ──
  // Each active setup contributes weighted points.
  // Use for: sizing tier, gate threshold, display.
  confluenceScore: number;
}

// ══════════════════════════════════════════════════════════════
// ASSET CLASS DETECTION
// ══════════════════════════════════════════════════════════════

const MAJORS  = new Set(["BTCUSDT","ETHUSDT"]);
const MIDS    = new Set(["SOLUSDT","XRPUSDT","BNBUSDT","ADAUSDT","AVAXUSDT","DOTUSDT","LINKUSDT","MATICUSDT"]);

function detectAssetClass(symbol: string, candles: Candle[]): AssetClass {
  if (MAJORS.has(symbol)) return "major";
  if (MIDS.has(symbol))   return "mid";
  // Heuristic: if < 60 days of data or avg daily turnover < $5M → micro
  const days = (candles[candles.length-1].timestamp - candles[0].timestamp) / 86400000;
  if (days < 60) return "micro";
  const avgTurnover = candles.slice(-288).reduce((s,c) => s + c.turnover, 0) / 288 * 288; // last day total
  if (avgTurnover < 5_000_000) return "micro";
  return "high-beta";
}

// ══════════════════════════════════════════════════════════════
// ZONE ENGINE
// ══════════════════════════════════════════════════════════════

interface RawZone {
  id: string;
  mid: number; low: number; high: number;
  touches: number;
  firstDate: string;
  formationTs: number;
  broken: boolean;
}

function findPivotLows(bars: Candle[], wing: number): { price: number; date: string; ts: number }[] {
  const pivots: { price: number; date: string; ts: number }[] = [];
  for (let i = wing; i < bars.length - wing; i++) {
    const lo = bars[i].low;
    let isPivot = true;
    for (let j = i - wing; j <= i + wing; j++) {
      if (j !== i && bars[j].low <= lo) { isPivot = false; break; }
    }
    if (isPivot) pivots.push({ price: lo, date: new Date(bars[i].timestamp).toISOString().slice(0,10), ts: bars[i].timestamp });
  }
  return pivots;
}

function clusterZones(
  pivots: { price: number; date: string; ts: number }[],
  clusterPct: number,
  bandPct: number,
  minTouches: number,
): RawZone[] {
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const raw: RawZone[] = [];
  let idc = 0;
  for (const p of sorted) {
    let merged = false;
    for (const z of raw) {
      if (Math.abs(p.price - z.mid) / z.mid * 100 <= clusterPct) {
        z.mid = (z.mid * z.touches + p.price) / (z.touches + 1);
        z.low  = z.mid * (1 - bandPct / 100);
        z.high = z.mid * (1 + bandPct / 100);
        z.touches++;
        if (p.date < z.firstDate) { z.firstDate = p.date; z.formationTs = p.ts; }
        merged = true; break;
      }
    }
    if (!merged) {
      raw.push({ id: `z${++idc}`, mid: p.price, low: p.price*(1-bandPct/100), high: p.price*(1+bandPct/100), touches: 1, firstDate: p.date, formationTs: p.ts, broken: false });
    }
  }
  return raw.filter(z => z.touches >= minTouches);
}

// Band % per timeframe — higher TF = wider zone
const TF_BAND: Record<string, number>  = { "1H": 0.5, "4H": 1.0, "1D": 1.5 };
const TF_WING: Record<string, number>  = { "1H": 3,   "4H": 3,   "1D": 3   };
const TF_CLUSTER: Record<string, number> = { "1H": 1.5, "4H": 2.0, "1D": 2.5 };
const TF_MIN_TOUCHES: Record<string, number> = { "1H": 2, "4H": 2, "1D": 2 };
// Rolling lookback for pivot detection — only consider recent bars
// Keeps zones relevant to current price regime, avoids stale ancient pivots
const TF_LOOKBACK: Record<string, number> = { "1H": 720, "4H": 180, "1D": 90 };  // ~30d / 30d / 90d

// Hierarchical proximity thresholds
const HIER_1D_4H_PCT = 3.0;  // 4H zone must be within 3% of a 1D zone
const HIER_4H_1H_PCT = 2.0;  // 1H zone must be within 2% of a 4H zone

interface ZoneMap {
  zones: RawZone[];
  lastInteraction: Map<string, number>;  // zoneId → last ts price touched it
  maxHighSince: Map<string, number>;
  hadRearmClose: Map<string, boolean>;
}

function buildZoneMap(bars: Candle[], tf: string, asOfTs: number): ZoneMap {
  const barsUntil = bars.filter(b => b.timestamp <= asOfTs);
  // Use a rolling lookback window so zones stay relevant to current price regime
  const lookback = TF_LOOKBACK[tf] ?? barsUntil.length;
  const pivotBars = barsUntil.slice(-lookback);
  const pivots = findPivotLows(pivotBars, TF_WING[tf]);
  const zones  = clusterZones(pivots, TF_CLUSTER[tf], TF_BAND[tf], TF_MIN_TOUCHES[tf]);

  // Mark broken: zone mid was breached by a close
  for (const z of zones) {
    for (const b of barsUntil) {
      if (b.timestamp <= z.formationTs) continue;
      if (b.close < z.mid * 0.98) { z.broken = true; break; }
    }
  }

  return { zones: zones.filter(z => !z.broken), lastInteraction: new Map(), maxHighSince: new Map(), hadRearmClose: new Map() };
}

// ══════════════════════════════════════════════════════════════
// FRESH-TOUCH CHECK (re-arm rule from Codex spec)
// ══════════════════════════════════════════════════════════════

interface FreshTouchResult {
  isFresh: boolean;
  hoursSinceLastInteraction: number;
}

function checkFreshTouch(
  zone: RawZone,
  bars5m: Candle[],   // all 5m candles, ascending
  asOfTs: number,
): FreshTouchResult {
  // Walk backwards from asOfTs to find:
  //   1. last interaction (low <= zone.high)
  //   2. max high since that interaction
  //   3. whether any close was >= zone.high * 1.005 since last interaction

  let lastInteractionTs = zone.formationTs;
  let inTouch = false;

  // Scan forward through 5m candles to track state
  let maxHighSince   = 0;
  let hadRearmClose  = false;
  let lastIntTs      = zone.formationTs;

  for (const c of bars5m) {
    if (c.timestamp > asOfTs) break;
    const touching = c.low <= zone.high;
    if (touching) {
      lastIntTs     = c.timestamp;
      maxHighSince  = 0;
      hadRearmClose = false;
    } else {
      if (c.high > maxHighSince) maxHighSince = c.high;
      if (c.close >= zone.high * 1.005) hadRearmClose = true;
    }
  }

  const hoursSince = (asOfTs - lastIntTs) / 3600000;
  const isFresh = (
    hoursSince >= 24 &&
    maxHighSince >= zone.high * 1.02 &&
    hadRearmClose
  );

  return { isFresh, hoursSinceLastInteraction: hoursSince };
}

// ══════════════════════════════════════════════════════════════
// VWAP
// ══════════════════════════════════════════════════════════════

function weeklyVwapAt(candles5m: Candle[], asOfTs: number): number {
  let cumTurnover = 0, cumVolume = 0, weekAnchor = 0;
  let vwap = candles5m[0]?.close ?? 0;
  for (const c of candles5m) {
    if (c.timestamp > asOfTs) break;
    const d = new Date(c.timestamp);
    const dow = d.getUTCDay();
    const dayStart = new Date(c.timestamp); dayStart.setUTCHours(0,0,0,0);
    const monTs = dayStart.getTime() - (dow === 0 ? 6 : dow - 1) * 86400000;
    if (monTs !== weekAnchor) { weekAnchor = monTs; cumTurnover = 0; cumVolume = 0; }
    cumTurnover += c.turnover;
    cumVolume   += c.volume;
    vwap = cumVolume > 0 ? cumTurnover / cumVolume : c.close;
  }
  return vwap;
}

function swingLowVwapAt(candles5m: Candle[], asOfTs: number, swingLowTs: number): number {
  let cumTurnover = 0, cumVolume = 0;
  let vwap = candles5m[0]?.close ?? 0;
  for (const c of candles5m) {
    if (c.timestamp < swingLowTs) continue;
    if (c.timestamp > asOfTs) break;
    cumTurnover += c.turnover;
    cumVolume   += c.volume;
    vwap = cumVolume > 0 ? cumTurnover / cumVolume : c.close;
  }
  return vwap;
}

// ══════════════════════════════════════════════════════════════
// FIBONACCI
// ══════════════════════════════════════════════════════════════

const FIB_RATIOS = [
  { label: "0.0",  r: 0.0   },
  { label: "0.236",r: 0.236 },
  { label: "0.382",r: 0.382 },
  { label: "0.5",  r: 0.5   },
  { label: "0.618",r: 0.618 },
  { label: "0.786",r: 0.786 },
  { label: "1.0",  r: 1.0   },
];

function computeFibLevels(swingHigh: number, swingLow: number, currentPrice: number): FibLevel[] {
  const range = swingHigh - swingLow;
  return FIB_RATIOS.map(f => {
    const price = swingHigh - f.r * range;  // retracement DOWN from high
    return { label: f.label, price: +price.toFixed(6), distPct: +((price - currentPrice) / currentPrice * 100).toFixed(2) };
  });
}

// Find recent swing high and swing low from 1D bars
function findSwingHighLow(bars1D: Candle[], lookback: number): { high: number; highTs: number; low: number; lowTs: number } | null {
  if (bars1D.length < lookback + 1) return null;
  const slice = bars1D.slice(-lookback);
  let high = -Infinity, highTs = 0, low = Infinity, lowTs = 0;
  for (const b of slice) {
    if (b.high > high) { high = b.high; highTs = b.timestamp; }
    if (b.low  < low)  { low  = b.low;  lowTs  = b.timestamp; }
  }
  return { high, highTs, low, lowTs };
}

// ══════════════════════════════════════════════════════════════
// CONNORS RSI (CRSI)
// crsi = (rsi3 + streakRsi2 + percentRank100) / 3
// ══════════════════════════════════════════════════════════════

function computeCrsi(closes: number[], rsiPeriod = 3, streakPeriod = 2, lookback = 100): number | null {
  if (closes.length < Math.max(rsiPeriod + 1, lookback + 1)) return null;

  // RSI(3) on closes
  const rsi3vals = RSI.calculate({ period: rsiPeriod, values: closes });
  const rsi3 = rsi3vals[rsi3vals.length - 1];

  // Up/down streak
  const streaks: number[] = [];
  let streak = 0;
  for (let i = 1; i < closes.length; i++) {
    if      (closes[i] > closes[i-1]) streak = streak > 0 ? streak + 1 : 1;
    else if (closes[i] < closes[i-1]) streak = streak < 0 ? streak - 1 : -1;
    else streak = 0;
    streaks.push(streak);
  }
  const streakRsi = RSI.calculate({ period: streakPeriod, values: streaks });
  const streakRsiVal = streakRsi[streakRsi.length - 1];

  // Percent rank of today's 1-day return vs last `lookback` days
  const ret1d = (closes[closes.length-1] - closes[closes.length-2]) / closes[closes.length-2] * 100;
  const historical = closes.slice(-lookback - 1);
  const rets = historical.slice(1).map((v, i) => (v - historical[i]) / historical[i] * 100);
  const rank = rets.filter(r => r < ret1d).length / rets.length * 100;

  return +((rsi3 + streakRsiVal + rank) / 3).toFixed(2);
}

// ══════════════════════════════════════════════════════════════
// PER-TIMEFRAME INDICATORS
// ══════════════════════════════════════════════════════════════

function computeTFIndicators(bars: Candle[]): TFIndicators {
  if (bars.length < 30) return { rsi14: null, ema9: null, ema21: null, ema50: null, bbUpper: null, bbLower: null, bbWidth: null, bbPosition: null, atrPct: null, adx: null, williamsR: null, volumeRatio: null };

  const closes  = bars.map(b => b.close);
  const highs   = bars.map(b => b.high);
  const lows    = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume);

  const last = (arr: number[]) => arr[arr.length - 1] ?? null;
  const lastVal = <T>(arr: T[]) => arr[arr.length - 1] ?? null;

  const rsi14v  = RSI.calculate({ period: 14, values: closes });
  const ema9v   = EMA.calculate({ period: 9,  values: closes });
  const ema21v  = EMA.calculate({ period: 21, values: closes });
  const ema50v  = EMA.calculate({ period: 50, values: closes });
  const bbv     = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
  const atrv    = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
  const willrv  = WilliamsR.calculate({ period: 14, high: highs, low: lows, close: closes });
  const volSma  = SMA.calculate({ period: 20, values: volumes });

  const bb    = lastVal(bbv);
  const atr   = last(atrv);
  const price = closes[closes.length - 1];

  return {
    rsi14:       last(rsi14v),
    ema9:        last(ema9v),
    ema21:       last(ema21v),
    ema50:       last(ema50v),
    bbUpper:     bb?.upper ?? null,
    bbLower:     bb?.lower ?? null,
    bbWidth:     bb ? +((bb.upper - bb.lower) / bb.middle * 100).toFixed(2) : null,
    bbPosition:  bb && bb.upper !== bb.lower ? +((price - bb.lower) / (bb.upper - bb.lower)).toFixed(3) : null,
    atrPct:      atr && price > 0 ? +(atr / price * 100).toFixed(3) : null,
    adx:         bars.length >= 28 ? (() => { const v = ADX.calculate({ period: 14, high: highs, low: lows, close: closes }); return v.length > 0 ? +(v[v.length-1].adx).toFixed(2) : null; })() : null,
    williamsR:   last(willrv),
    volumeRatio: volSma.length > 0 && volSma[volSma.length-1] > 0 ? +(volumes[volumes.length-1] / volSma[volSma.length-1]).toFixed(2) : null,
  };
}

// ══════════════════════════════════════════════════════════════
// SETUP DETECTION + SCORING
// ══════════════════════════════════════════════════════════════

const SETUP_WEIGHTS: Record<SetupTag, number> = {
  zone_fresh_A:      35,
  zone_fresh_B:      22,
  zone_fresh_C:      12,
  at_weekly_vwap:    10,
  below_weekly_vwap:  6,
  at_swinglow_vwap:  12,
  fib_618:           10,
  fib_5:              7,
  fib_382:            5,
  rsi_oversold_1d:   15,
  rsi_oversold_4h:   10,
  rsi_oversold_1h:    6,
  crsi_oversold:     12,
  bb_squeeze:         5,
  bb_lower_touch:     8,
  adx_trending:       5,
  adx_ranging:        3,
  vol_spike:          5,
};

function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }

// ══════════════════════════════════════════════════════════════
// MAIN ENGINE
// ══════════════════════════════════════════════════════════════

export function getContext(
  symbol: string,
  candles5m: Candle[],
  asOfTs?: number,
): TechnicalContext {
  const ts = asOfTs ?? candles5m[candles5m.length - 1].timestamp;

  // Slice candles up to asOfTs
  const c5m = candles5m.filter(c => c.timestamp <= ts);
  if (c5m.length < 50) throw new Error(`Not enough candles for ${symbol}`);

  const price = c5m[c5m.length - 1].close;
  const assetClass = detectAssetClass(symbol, c5m);

  // ── Resample ──
  const c1H = aggregate(c5m, 60);
  const c4H = aggregate(c5m, 240);
  const c1D = aggregate(c5m, 1440);

  // ── Zone maps ──
  const zones1D = buildZoneMap(c1D, "1D", ts);
  const zones4H = buildZoneMap(c4H, "4H", ts);
  const zones1H = buildZoneMap(c1H, "1H", ts);

  // ── Hierarchical zone matching at current price ──
  // Grade A: 1D + 4H + 1H all present within proximity
  // Grade B: 4H + 1H (near a 1D zone or strong 4H)
  // Grade C: 1H near 4H, no 1D
  // Grade D: 1H only

  function nearestZoneAt(zones: RawZone[], price: number, within: number): RawZone | null {
    return zones
      .filter(z => !z.broken && Math.abs(z.mid - price) / price * 100 <= within)
      .sort((a, b) => Math.abs(a.mid - price) - Math.abs(b.mid - price))[0] ?? null;
  }

  // Find which zones current price is IN or nearest to below
  const priceIn1D = nearestZoneAt(zones1D.zones, price, TF_BAND["1D"] * 2);
  const priceIn4H = nearestZoneAt(zones4H.zones, price, TF_BAND["4H"] * 2);
  const priceIn1H = nearestZoneAt(zones1H.zones, price, TF_BAND["1H"] * 2);

  // Hierarchical check
  let grade: ConfluenceGrade = "none";
  if (priceIn1D && priceIn4H && Math.abs(priceIn1D.mid - priceIn4H.mid) / priceIn1D.mid * 100 <= HIER_1D_4H_PCT) {
    if (priceIn1H && Math.abs(priceIn4H.mid - priceIn1H.mid) / priceIn4H.mid * 100 <= HIER_4H_1H_PCT) {
      grade = "A";
    } else {
      grade = "B";
    }
  } else if (priceIn4H) {
    if (priceIn1H && Math.abs(priceIn4H.mid - priceIn1H.mid) / priceIn4H.mid * 100 <= HIER_4H_1H_PCT) {
      grade = "B";
    } else {
      grade = "C";
    }
  } else if (priceIn1H) {
    grade = "D";
  }

  // Fresh touch check for each TF zone
  function toZoneLevel(z: RawZone | null, tf: "1D"|"4H"|"1H", bars5m: Candle[]): ZoneLevel | null {
    if (!z) return null;
    const ft = checkFreshTouch(z, bars5m, ts);
    return { timeframe: tf, mid: z.mid, low: z.low, high: z.high, touches: z.touches, firstDate: z.firstDate, isFreshTouch: ft.isFresh, hoursSinceLastInteraction: ft.hoursSinceLastInteraction };
  }

  const zoneStack = {
    "1D": toZoneLevel(priceIn1D, "1D", c5m),
    "4H": toZoneLevel(priceIn4H, "4H", c5m),
    "1H": toZoneLevel(priceIn1H, "1H", c5m),
  };

  // Nearest support below (any TF, not necessarily at current price)
  const allActiveZones = [
    ...zones1D.zones.map(z => ({ ...z, tf: "1D" as const })),
    ...zones4H.zones.map(z => ({ ...z, tf: "4H" as const })),
    ...zones1H.zones.map(z => ({ ...z, tf: "1H" as const })),
  ].filter(z => z.mid < price);

  const nearest = allActiveZones.sort((a, b) => b.mid - a.mid)[0] ?? null;
  const nearestSupportBelow = nearest ? toZoneLevel(nearest, nearest.tf, c5m) : null;

  // ── VWAP ──
  const weeklyVwap = weeklyVwapAt(c5m, ts);
  const weeklyVwapDistPct = +((price - weeklyVwap) / weeklyVwap * 100).toFixed(2);

  // Swing low VWAP: anchor from 1D swing low in last 60 bars
  const swingHL = findSwingHighLow(c1D, Math.min(60, c1D.length - 1));
  const swingLowVwap = swingHL ? swingLowVwapAt(c5m, ts, swingHL.lowTs) : null;
  const swingLowVwapDistPct = swingLowVwap ? +((price - swingLowVwap) / swingLowVwap * 100).toFixed(2) : null;

  // ── Fibonacci ──
  const fibSwingHigh = swingHL?.high ?? null;
  const fibSwingLow  = swingHL?.low  ?? null;
  const fibLevels = fibSwingHigh && fibSwingLow ? computeFibLevels(fibSwingHigh, fibSwingLow, price) : [];

  // ── Per-TF indicators ──
  const ind1H = computeTFIndicators(c1H.slice(-200));
  const ind4H = computeTFIndicators(c4H.slice(-200));
  const ind1D = computeTFIndicators(c1D.slice(-300));

  // ── CRSI — only for high-beta and micro ──
  const crsi1H = (assetClass === "high-beta" || assetClass === "micro")
    ? computeCrsi(c1H.map(b => b.close))
    : null;
  const crsi4H = (assetClass === "high-beta" || assetClass === "micro")
    ? computeCrsi(c4H.map(b => b.close))
    : null;

  // ── Setup detection ──
  const setups: SetupTag[] = [];

  // Zone freshness
  if      (grade === "A" && (zoneStack["1H"]?.isFreshTouch || zoneStack["4H"]?.isFreshTouch)) setups.push("zone_fresh_A");
  else if (grade === "B" && (zoneStack["1H"]?.isFreshTouch || zoneStack["4H"]?.isFreshTouch)) setups.push("zone_fresh_B");
  else if (grade === "C" && zoneStack["1H"]?.isFreshTouch) setups.push("zone_fresh_C");

  // VWAP
  if (Math.abs(weeklyVwapDistPct) <= 0.5) setups.push("at_weekly_vwap");
  else if (weeklyVwapDistPct < 0)          setups.push("below_weekly_vwap");
  if (swingLowVwapDistPct !== null && Math.abs(swingLowVwapDistPct) <= 1.0) setups.push("at_swinglow_vwap");

  // Fibonacci proximity (within 0.5%)
  for (const f of fibLevels) {
    if (Math.abs(f.distPct) <= 0.5) {
      if (f.label === "0.618") setups.push("fib_618");
      if (f.label === "0.5")   setups.push("fib_5");
      if (f.label === "0.382") setups.push("fib_382");
    }
  }

  // RSI oversold
  if (ind1D.rsi14 !== null && ind1D.rsi14 < 35) setups.push("rsi_oversold_1d");
  if (ind4H.rsi14 !== null && ind4H.rsi14 < 35) setups.push("rsi_oversold_4h");
  if (ind1H.rsi14 !== null && ind1H.rsi14 < 35) setups.push("rsi_oversold_1h");

  // CRSI
  if (crsi1H !== null && crsi1H < 20) setups.push("crsi_oversold");

  // BB squeeze (width < 3% = tight bands, breakout imminent)
  if (ind4H.bbWidth !== null && ind4H.bbWidth < 3.0)  setups.push("bb_squeeze");
  // BB lower touch
  if (ind1H.bbPosition !== null && ind1H.bbPosition < 0.1) setups.push("bb_lower_touch");

  // ADX
  if (ind4H.adx !== null) {
    if (ind4H.adx > 25) setups.push("adx_trending");
    else if (ind4H.adx < 20) setups.push("adx_ranging");
  }

  // Volume spike
  if (ind1H.volumeRatio !== null && ind1H.volumeRatio > 2.5) setups.push("vol_spike");

  // ── Confluence score ──
  const rawScore = setups.reduce((s, tag) => s + (SETUP_WEIGHTS[tag] ?? 0), 0);
  const confluenceScore = clamp(rawScore, 0, 100);

  return {
    symbol, asOfTs: ts, price, assetClass,
    confluenceGrade: grade,
    zoneStack,
    nearestSupportBelow,
    weeklyVwap, weeklyVwapDistPct,
    swingLowVwap, swingLowVwapDistPct,
    fibSwingHigh, fibSwingLow, fibLevels,
    indicators: { "1H": ind1H, "4H": ind4H, "1D": ind1D },
    crsi1H, crsi4H,
    activeSetups: setups,
    confluenceScore,
  };
}

// ══════════════════════════════════════════════════════════════
// CLI — run on any symbol, print human-readable snapshot
// npx ts-node src/technical-engine.ts HYPEUSDT
// ══════════════════════════════════════════════════════════════

if (require.main === module) {
  const fs   = require("fs");
  const path = require("path");

  const symbol = process.argv[2] || "HYPEUSDT";
  const dataDir = path.resolve(__dirname, "../data");
  const full = path.join(dataDir, `${symbol}_5_full.json`);
  const std  = path.join(dataDir, `${symbol}_5.json`);
  const file = fs.existsSync(full) ? full : fs.existsSync(std) ? std : null;
  if (!file) { console.error(`No data for ${symbol}`); process.exit(1); }

  const candles: Candle[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  candles.sort((a: Candle, b: Candle) => a.timestamp - b.timestamp);

  const ctx = getContext(symbol, candles);

  const SEP = "═".repeat(70);
  const p = (n: number | null, d = 2) => n != null ? n.toFixed(d) : "n/a";
  const pct = (n: number | null) => n != null ? (n >= 0 ? "+" : "") + n.toFixed(2) + "%" : "n/a";

  console.log("\n" + SEP);
  console.log(`  ${symbol}  |  $${p(ctx.price, 4)}  |  ${ctx.assetClass.toUpperCase()}  |  ${new Date(ctx.asOfTs).toISOString().slice(0,16)} UTC`);
  console.log(SEP);

  console.log(`\n  Confluence: Grade ${ctx.confluenceGrade}  |  Score: ${ctx.confluenceScore}/100`);
  console.log(`  Active setups: ${ctx.activeSetups.length > 0 ? ctx.activeSetups.join(", ") : "none"}`);

  console.log("\n  ── Zones ──");
  for (const tf of ["1D","4H","1H"] as const) {
    const z = ctx.zoneStack[tf];
    if (z) {
      const fresh = z.isFreshTouch ? "FRESH" : `last ${z.hoursSinceLastInteraction.toFixed(0)}h ago`;
      console.log(`  ${tf}  $${p(z.low,4)} – $${p(z.high,4)}  mid=$${p(z.mid,4)}  touches=${z.touches}  [${fresh}]`);
    } else {
      console.log(`  ${tf}  —`);
    }
  }
  if (ctx.nearestSupportBelow) {
    const z = ctx.nearestSupportBelow;
    console.log(`  Nearest support below:  ${z.timeframe}  $${p(z.mid,4)}  (${((ctx.price-z.mid)/ctx.price*100).toFixed(1)}% below)`);
  }

  console.log("\n  ── VWAP ──");
  console.log(`  Weekly VWAP:   $${p(ctx.weeklyVwap,4)}  (${pct(ctx.weeklyVwapDistPct)} from price)`);
  if (ctx.swingLowVwap) console.log(`  SwingLow VWAP: $${p(ctx.swingLowVwap,4)}  (${pct(ctx.swingLowVwapDistPct)} from price)`);

  if (ctx.fibLevels.length > 0) {
    console.log("\n  ── Fibonacci ──");
    console.log(`  Swing: high=$${p(ctx.fibSwingHigh,4)}  low=$${p(ctx.fibSwingLow,4)}`);
    for (const f of ctx.fibLevels) {
      const marker = Math.abs(f.distPct) <= 1.0 ? " ◀ NEAR" : "";
      console.log(`  ${f.label.padEnd(6)}  $${p(f.price,4)}  (${pct(f.distPct)})${marker}`);
    }
  }

  console.log("\n  ── Indicators ──");
  console.log(`  ${"TF".padEnd(5)} ${"RSI14".padStart(7)} ${"EMA9".padStart(9)} ${"EMA21".padStart(9)} ${"BB pos".padStart(8)} ${"BB wid%".padStart(8)} ${"ATR%".padStart(7)} ${"ADX".padStart(6)} ${"WillR".padStart(7)} ${"VolRatio".padStart(10)}`);
  console.log("  " + "─".repeat(78));
  for (const tf of ["1H","4H","1D"] as const) {
    const ind = ctx.indicators[tf];
    console.log(`  ${tf.padEnd(5)} ${p(ind.rsi14,1).padStart(7)} ${p(ind.ema9,4).padStart(9)} ${p(ind.ema21,4).padStart(9)} ${p(ind.bbPosition,2).padStart(8)} ${p(ind.bbWidth,1).padStart(8)} ${p(ind.atrPct,2).padStart(7)} ${p(ind.adx,1).padStart(6)} ${p(ind.williamsR,1).padStart(7)} ${p(ind.volumeRatio,2).padStart(10)}`);
  }
  if (ctx.crsi1H !== null) console.log(`\n  CRSI 1H: ${p(ctx.crsi1H)}  CRSI 4H: ${p(ctx.crsi4H)}`);

  console.log("\n" + SEP + "\n");
}
