// analyze-peak-dates.ts — Deep analysis of user-identified pre-drop dates
// Checks: price action, RSI, EMA, ATR, volume, OI, funding, BTC correlation
// Usage: npx ts-node src/analyze-peak-dates.ts

import fs from "fs";
import { RSI, EMA, ATR, SMA } from "technicalindicators";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }
interface OI { timestamp: number; openInterest: number; }
interface Funding { timestamp: number; fundingRate: number; }

// ── Load data ──
const hype5m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
const btc5m: Candle[]  = JSON.parse(fs.readFileSync("data/BTCUSDT_5_full.json", "utf-8"));
const oiData: OI[]     = JSON.parse(fs.readFileSync("data/HYPEUSDT_oi.json", "utf-8"));
const fundData: Funding[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_funding.json", "utf-8"));

// ── Aggregate to 1H and 4H ──
function agg(candles: Candle[], periodMs: number): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of candles) {
    const k = Math.floor(c.timestamp / periodMs) * periodMs;
    const e = map.get(k);
    if (!e) { map.set(k, { ...c, timestamp: k }); }
    else {
      if (c.high > e.high) e.high = c.high;
      if (c.low < e.low) e.low = c.low;
      e.close = c.close;
      e.volume += c.volume;
      e.turnover += c.turnover;
    }
  }
  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}

const hype1H = agg(hype5m, 3600000);
const hype4H = agg(hype5m, 4 * 3600000);
const hype1D = agg(hype5m, 24 * 3600000);
const btc1H  = agg(btc5m, 3600000);
const btc4H  = agg(btc5m, 4 * 3600000);
const btc1D  = agg(btc5m, 24 * 3600000);

// ── Compute indicators ──
function computeRSI(candles: Candle[], period: number): Map<number, number> {
  const closes = candles.map(c => c.close);
  const vals = RSI.calculate({ values: closes, period });
  const m = new Map<number, number>();
  for (let i = 0; i < vals.length; i++) m.set(candles[i + period].timestamp, vals[i]);
  return m;
}

function computeEMA(candles: Candle[], period: number): Map<number, number> {
  const closes = candles.map(c => c.close);
  const vals = EMA.calculate({ values: closes, period });
  const m = new Map<number, number>();
  for (let i = 0; i < vals.length; i++) m.set(candles[i + period - 1].timestamp, vals[i]);
  return m;
}

function computeATR(candles: Candle[], period: number): Map<number, number> {
  const vals = ATR.calculate({ high: candles.map(c => c.high), low: candles.map(c => c.low), close: candles.map(c => c.close), period });
  const m = new Map<number, number>();
  for (let i = 0; i < vals.length; i++) m.set(candles[i + period].timestamp, vals[i]);
  return m;
}

function computeSMA(candles: Candle[], period: number): Map<number, number> {
  const closes = candles.map(c => c.close);
  const vals = SMA.calculate({ values: closes, period });
  const m = new Map<number, number>();
  for (let i = 0; i < vals.length; i++) m.set(candles[i + period - 1].timestamp, vals[i]);
  return m;
}

// Volume SMA for relative volume
function computeVolSMA(candles: Candle[], period: number): Map<number, number> {
  const vols = candles.map(c => c.volume);
  const vals = SMA.calculate({ values: vols, period });
  const m = new Map<number, number>();
  for (let i = 0; i < vals.length; i++) m.set(candles[i + period - 1].timestamp, vals[i]);
  return m;
}

// HYPE indicators
const hypeRSI1H   = computeRSI(hype1H, 14);
const hypeRSI4H   = computeRSI(hype4H, 14);
const hypeEMA21_1H = computeEMA(hype1H, 21);
const hypeEMA50_4H = computeEMA(hype4H, 50);
const hypeEMA200_4H = computeEMA(hype4H, 200);
const hypeATR1H   = computeATR(hype1H, 14);
const hypeATR4H   = computeATR(hype4H, 14);
const hypeVolSMA1H = computeVolSMA(hype1H, 20);

// BTC indicators
const btcRSI1H  = computeRSI(btc1H, 14);
const btcRSI4H  = computeRSI(btc4H, 14);
const btcEMA21_1H = computeEMA(btc1H, 21);

// ── Helper: find nearest value from a map ──
function nearest<T>(map: Map<number, T>, ts: number, maxGap = 4 * 3600000): T | null {
  // Try exact, then scan nearby
  if (map.has(ts)) return map.get(ts)!;
  let bestK = 0, bestD = Infinity;
  for (const k of map.keys()) {
    const d = Math.abs(k - ts);
    if (d < bestD) { bestD = d; bestK = k; }
  }
  return bestD <= maxGap ? map.get(bestK)! : null;
}

// ── Helper: find bar at or before ts ──
function barAt(candles: Candle[], ts: number): Candle | null {
  let lo = 0, hi = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].timestamp <= ts) lo = mid + 1;
    else hi = mid - 1;
  }
  return hi >= 0 ? candles[hi] : null;
}

// ── Helper: OI and funding at ts ──
function oiAt(ts: number): number | null {
  let best: OI | null = null;
  for (const o of oiData) {
    if (o.timestamp <= ts) best = o;
    else break;
  }
  return best?.openInterest ?? null;
}

function fundingAt(ts: number): number | null {
  let best: Funding | null = null;
  for (const f of fundData) {
    if (f.timestamp <= ts) best = f;
    else break;
  }
  return best?.fundingRate ?? null;
}

// ── Helper: price change over N days ──
function priceChange(candles: Candle[], ts: number, hoursBack: number): { pct: number; from: number; to: number } | null {
  const bar = barAt(candles, ts);
  const barPrev = barAt(candles, ts - hoursBack * 3600000);
  if (!bar || !barPrev) return null;
  return { pct: (bar.close - barPrev.close) / barPrev.close * 100, from: barPrev.close, to: bar.close };
}

// ── Helper: rolling high/low over window ──
function rollingHigh(candles: Candle[], ts: number, hoursBack: number): number {
  let hi = 0;
  const start = ts - hoursBack * 3600000;
  for (const c of candles) {
    if (c.timestamp < start) continue;
    if (c.timestamp > ts) break;
    if (c.high > hi) hi = c.high;
  }
  return hi;
}

// ── Helper: OI change ──
function oiChange(ts: number, hoursBack: number): { pct: number; from: number; to: number } | null {
  const now = oiAt(ts);
  const prev = oiAt(ts - hoursBack * 3600000);
  if (!now || !prev || prev === 0) return null;
  return { pct: (now - prev) / prev * 100, from: prev, to: now };
}

// ── Helper: max drop in next N days after a date ──
function maxDropAfter(candles: Candle[], ts: number, hours: number): { pct: number; low: number; peakBefore: number } {
  const peakBar = barAt(candles, ts);
  if (!peakBar) return { pct: 0, low: 0, peakBefore: 0 };
  const peakPrice = peakBar.close;
  let low = peakPrice;
  const end = ts + hours * 3600000;
  for (const c of candles) {
    if (c.timestamp < ts) continue;
    if (c.timestamp > end) break;
    if (c.low < low) low = c.low;
  }
  return { pct: (low - peakPrice) / peakPrice * 100, low, peakBefore: peakPrice };
}

// ── Dates to analyze ──
const peakDates: { date: string; label: string }[] = [
  { date: "2024-12-16", label: "Pre-drop #1" },
  { date: "2024-12-20", label: "Pre-drop #2" },
  { date: "2025-02-15", label: "Feb pullback" },
  { date: "2025-05-25", label: "First pullback after surge" },
  { date: "2025-06-16", label: "Second pullback after recovery" },
  { date: "2025-07-13", label: "Pullback before continuation" },
  { date: "2025-09-10", label: "Peak #1 before bear (ATH zone)" },
  { date: "2025-09-17", label: "Peak #2 before bear" },
  { date: "2025-10-01", label: "Peak before pullback" },
  { date: "2025-10-27", label: "Recovery peak into bear" },
  { date: "2026-01-21", label: "Bottomed out" },
  { date: "2026-02-03", label: "Pump+peak into pullback" },
  { date: "2026-03-17", label: "Peak into pullback" },
];

// ── Analyze each date ──
const SEP = "═".repeat(100);
const DIV = "─".repeat(100);

console.log(SEP);
console.log("  PEAK DATE ANALYSIS — HYPEUSDT pre-drop moments");
console.log(`  Data: ${new Date(hype5m[0].timestamp).toISOString().slice(0,10)} → ${new Date(hype5m[hype5m.length-1].timestamp).toISOString().slice(0,10)}`);
console.log(SEP);

for (const { date, label } of peakDates) {
  const ts = new Date(date + "T12:00:00Z").getTime(); // noon UTC as reference point

  console.log(`\n${DIV}`);
  console.log(`  📅 ${date} — ${label}`);
  console.log(DIV);

  // Price at the date
  const bar1H = barAt(hype1H, ts);
  const bar4H = barAt(hype4H, ts);
  const bar1D = barAt(hype1D, ts);
  if (!bar1H) { console.log("  ⚠ No data for this date"); continue; }

  const price = bar1H.close;
  console.log(`  Price: $${price.toFixed(2)}`);

  // Max drop in next 3d, 7d, 14d
  const drop3d  = maxDropAfter(hype1H, ts, 72);
  const drop7d  = maxDropAfter(hype1H, ts, 168);
  const drop14d = maxDropAfter(hype1H, ts, 336);
  console.log(`  Drop after: 3d=${drop3d.pct.toFixed(1)}% (low $${drop3d.low.toFixed(2)})  7d=${drop7d.pct.toFixed(1)}% (low $${drop7d.low.toFixed(2)})  14d=${drop14d.pct.toFixed(1)}% (low $${drop14d.low.toFixed(2)})`);

  // Rolling high context
  const high7d  = rollingHigh(hype1H, ts, 168);
  const high14d = rollingHigh(hype1H, ts, 336);
  const distFromHigh7d = high7d > 0 ? ((high7d - price) / high7d * 100) : 0;
  console.log(`  7d high: $${high7d.toFixed(2)} (dist: ${distFromHigh7d.toFixed(1)}%)  14d high: $${high14d.toFixed(2)}`);

  // Price changes leading up
  const chg24h = priceChange(hype1H, ts, 24);
  const chg3d  = priceChange(hype1H, ts, 72);
  const chg7d  = priceChange(hype1H, ts, 168);
  console.log(`  Price change into date: 24h=${chg24h?.pct.toFixed(1) ?? "?"}%  3d=${chg3d?.pct.toFixed(1) ?? "?"}%  7d=${chg7d?.pct.toFixed(1) ?? "?"}%`);

  // RSI
  const rsi1h = nearest(hypeRSI1H, ts);
  const rsi4h = nearest(hypeRSI4H, ts);
  console.log(`  HYPE RSI: 1H=${rsi1h?.toFixed(1) ?? "?"} 4H=${rsi4h?.toFixed(1) ?? "?"}`);

  // EMAs
  const ema21_1h = nearest(hypeEMA21_1H, ts);
  const ema50_4h = nearest(hypeEMA50_4H, ts);
  const ema200_4h = nearest(hypeEMA200_4H, ts);
  const aboveEma21 = ema21_1h ? (price > ema21_1h ? "ABOVE" : "BELOW") : "?";
  const aboveEma50 = ema50_4h ? (price > ema50_4h ? "ABOVE" : "BELOW") : "?";
  const aboveEma200 = ema200_4h ? (price > ema200_4h ? "ABOVE" : "BELOW") : "?";
  console.log(`  EMAs: price vs EMA21(1H)=${aboveEma21} ($${ema21_1h?.toFixed(2) ?? "?"})  EMA50(4H)=${aboveEma50} ($${ema50_4h?.toFixed(2) ?? "?"})  EMA200(4H)=${aboveEma200} ($${ema200_4h?.toFixed(2) ?? "?"})`);

  // EMA50 4H slope (last 6 bars = 24h)
  const ema50_prev = nearest(hypeEMA50_4H, ts - 24 * 3600000);
  const ema50Slope = (ema50_4h && ema50_prev) ? ((ema50_4h - ema50_prev) / ema50_prev * 100) : null;
  console.log(`  EMA50(4H) 24h slope: ${ema50Slope !== null ? ema50Slope.toFixed(2) + "%" : "?"}`);

  // ATR
  const atr1h = nearest(hypeATR1H, ts);
  const atr4h = nearest(hypeATR4H, ts);
  console.log(`  ATR: 1H=$${atr1h?.toFixed(3) ?? "?"}  4H=$${atr4h?.toFixed(3) ?? "?"}`);

  // Volume (relative to 20-bar SMA)
  const volSma = nearest(hypeVolSMA1H, ts);
  const relVol = (bar1H && volSma) ? (bar1H.volume / volSma) : null;
  console.log(`  Volume: 1H bar=${bar1H.volume.toFixed(0)}  20-bar avg=${volSma?.toFixed(0) ?? "?"}  relative=${relVol?.toFixed(2) ?? "?"}x`);

  // OI
  const oi = oiAt(ts);
  const oiChg24h = oiChange(ts, 24);
  const oiChg3d  = oiChange(ts, 72);
  const oiChg7d  = oiChange(ts, 168);
  console.log(`  OI: ${oi?.toFixed(0) ?? "?"}  change: 24h=${oiChg24h?.pct.toFixed(1) ?? "?"}%  3d=${oiChg3d?.pct.toFixed(1) ?? "?"}%  7d=${oiChg7d?.pct.toFixed(1) ?? "?"}%`);

  // Funding
  const fund = fundingAt(ts);
  const fund3dAgo = fundingAt(ts - 72 * 3600000);
  console.log(`  Funding: current=${fund !== null ? (fund * 100).toFixed(4) + "%" : "?"}  3d ago=${fund3dAgo !== null ? (fund3dAgo * 100).toFixed(4) + "%" : "?"}`);

  // ── BTC correlation ──
  const btcBar = barAt(btc1H, ts);
  const btcPrice = btcBar?.close ?? 0;
  const btcChg24h = priceChange(btc1H, ts, 24);
  const btcChg3d  = priceChange(btc1H, ts, 72);
  const btcChg7d  = priceChange(btc1H, ts, 168);
  const btcRsi1h  = nearest(btcRSI1H, ts);
  const btcRsi4h  = nearest(btcRSI4H, ts);
  const btcDrop3d = maxDropAfter(btc1H, ts, 72);
  const btcDrop7d = maxDropAfter(btc1H, ts, 168);

  console.log(`  BTC: $${btcPrice.toFixed(0)}  RSI 1H=${btcRsi1h?.toFixed(1) ?? "?"} 4H=${btcRsi4h?.toFixed(1) ?? "?"}`);
  console.log(`  BTC change into date: 24h=${btcChg24h?.pct.toFixed(1) ?? "?"}%  3d=${btcChg3d?.pct.toFixed(1) ?? "?"}%  7d=${btcChg7d?.pct.toFixed(1) ?? "?"}%`);
  console.log(`  BTC drop after: 3d=${btcDrop3d.pct.toFixed(1)}%  7d=${btcDrop7d.pct.toFixed(1)}%`);

  // HYPE vs BTC relative performance
  const hypeVsBtc24h = (chg24h && btcChg24h) ? chg24h.pct - btcChg24h.pct : null;
  const hypeVsBtc3d  = (chg3d && btcChg3d) ? chg3d.pct - btcChg3d.pct : null;
  console.log(`  HYPE vs BTC (outperformance): 24h=${hypeVsBtc24h?.toFixed(1) ?? "?"}%  3d=${hypeVsBtc3d?.toFixed(1) ?? "?"}%`);

  // HYPE drop vs BTC drop (is this HYPE-specific?)
  const hypeSpecific3d = (drop3d.pct !== 0 && btcDrop3d.pct !== 0) ? drop3d.pct / btcDrop3d.pct : null;
  const hypeSpecific7d = (drop7d.pct !== 0 && btcDrop7d.pct !== 0) ? drop7d.pct / btcDrop7d.pct : null;
  console.log(`  Drop ratio (HYPE/BTC): 3d=${hypeSpecific3d?.toFixed(1) ?? "?"}x  7d=${hypeSpecific7d?.toFixed(1) ?? "?"}x  (>1 = HYPE drops harder)`);
}

// ── Summary table ──
console.log(`\n\n${SEP}`);
console.log("  SUMMARY TABLE — Key metrics at each peak");
console.log(SEP);
console.log(`  ${"Date".padEnd(12)} ${"Price".padStart(8)} ${"RSI1H".padStart(6)} ${"RSI4H".padStart(6)} ${"OI Δ24h".padStart(8)} ${"OI Δ3d".padStart(8)} ${"Fund%".padStart(8)} ${"%fm7dHi".padStart(8)} ${"Chg24h".padStart(8)} ${"Chg3d".padStart(8)} ${"Drop3d".padStart(8)} ${"Drop7d".padStart(8)} ${"BTC3d".padStart(8)} ${"HYPEvBTC".padStart(9)} ${"RelVol".padStart(7)}`);
console.log("  " + DIV);

for (const { date, label } of peakDates) {
  const ts = new Date(date + "T12:00:00Z").getTime();
  const bar = barAt(hype1H, ts);
  if (!bar) continue;
  const price = bar.close;
  const rsi1h = nearest(hypeRSI1H, ts);
  const rsi4h = nearest(hypeRSI4H, ts);
  const oiChg24h = oiChange(ts, 24);
  const oiChg3d  = oiChange(ts, 72);
  const fund = fundingAt(ts);
  const high7d = rollingHigh(hype1H, ts, 168);
  const distHigh = high7d > 0 ? ((high7d - price) / high7d * 100) : 0;
  const chg24h = priceChange(hype1H, ts, 24);
  const chg3d  = priceChange(hype1H, ts, 72);
  const drop3d = maxDropAfter(hype1H, ts, 72);
  const drop7d = maxDropAfter(hype1H, ts, 168);
  const btcDrop3d = maxDropAfter(btc1H, ts, 72);
  const volSma = nearest(hypeVolSMA1H, ts);
  const relVol = (bar && volSma) ? bar.volume / volSma : null;
  const dropRatio = (drop3d.pct !== 0 && btcDrop3d.pct !== 0) ? drop3d.pct / btcDrop3d.pct : null;

  console.log(`  ${date.padEnd(12)} ${("$" + price.toFixed(2)).padStart(8)} ${(rsi1h?.toFixed(0) ?? "?").padStart(6)} ${(rsi4h?.toFixed(0) ?? "?").padStart(6)} ${(oiChg24h ? oiChg24h.pct.toFixed(1) + "%" : "?").padStart(8)} ${(oiChg3d ? oiChg3d.pct.toFixed(1) + "%" : "?").padStart(8)} ${(fund !== null ? (fund * 100).toFixed(3) + "%" : "?").padStart(8)} ${(distHigh.toFixed(1) + "%").padStart(8)} ${(chg24h ? chg24h.pct.toFixed(1) + "%" : "?").padStart(8)} ${(chg3d ? chg3d.pct.toFixed(1) + "%" : "?").padStart(8)} ${(drop3d.pct.toFixed(1) + "%").padStart(8)} ${(drop7d.pct.toFixed(1) + "%").padStart(8)} ${(btcDrop3d.pct.toFixed(1) + "%").padStart(8)} ${(dropRatio ? dropRatio.toFixed(1) + "x" : "?").padStart(9)} ${(relVol?.toFixed(1) ?? "?").padStart(7)}`);
}

console.log(`\n${SEP}`);
console.log("  PATTERN ANALYSIS");
console.log(SEP);

// Compute averages
let sumRsi1h = 0, sumRsi4h = 0, sumOi24 = 0, sumOi3d = 0, sumFund = 0, sumDist = 0, cnt = 0;
let sumChg24 = 0, sumChg3d = 0, sumRelVol = 0;
for (const { date } of peakDates) {
  const ts = new Date(date + "T12:00:00Z").getTime();
  const bar = barAt(hype1H, ts);
  if (!bar) continue;
  const rsi1h = nearest(hypeRSI1H, ts);
  const rsi4h = nearest(hypeRSI4H, ts);
  const oiChg24h = oiChange(ts, 24);
  const oiChg3d  = oiChange(ts, 72);
  const fund = fundingAt(ts);
  const high7d = rollingHigh(hype1H, ts, 168);
  const dist = high7d > 0 ? ((high7d - bar.close) / high7d * 100) : 0;
  const chg24h = priceChange(hype1H, ts, 24);
  const chg3d  = priceChange(hype1H, ts, 72);
  const volSma = nearest(hypeVolSMA1H, ts);
  const relVol = (bar && volSma) ? bar.volume / volSma : null;

  if (rsi1h) sumRsi1h += rsi1h;
  if (rsi4h) sumRsi4h += rsi4h;
  if (oiChg24h) sumOi24 += oiChg24h.pct;
  if (oiChg3d) sumOi3d += oiChg3d.pct;
  if (fund !== null) sumFund += fund;
  sumDist += dist;
  if (chg24h) sumChg24 += chg24h.pct;
  if (chg3d) sumChg3d += chg3d.pct;
  if (relVol) sumRelVol += relVol;
  cnt++;
}

console.log(`  Averages across ${cnt} peak dates:`);
console.log(`    RSI 1H:     ${(sumRsi1h / cnt).toFixed(1)}`);
console.log(`    RSI 4H:     ${(sumRsi4h / cnt).toFixed(1)}`);
console.log(`    OI Δ 24h:   ${(sumOi24 / cnt).toFixed(1)}%`);
console.log(`    OI Δ 3d:    ${(sumOi3d / cnt).toFixed(1)}%`);
console.log(`    Funding:    ${(sumFund / cnt * 100).toFixed(4)}%`);
console.log(`    Dist fm 7d high: ${(sumDist / cnt).toFixed(1)}%`);
console.log(`    Price Δ 24h: ${(sumChg24 / cnt).toFixed(1)}%`);
console.log(`    Price Δ 3d:  ${(sumChg3d / cnt).toFixed(1)}%`);
console.log(`    Rel volume:  ${(sumRelVol / cnt).toFixed(2)}x`);
console.log(SEP);
