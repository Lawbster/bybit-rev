// analyze-sui-support.ts — Support zone discovery + recovery indicator analysis
// Find where SUI bounces, what indicators read at the bounce, how long until longs win
import fs from "fs";
import { EMA, RSI, ATR, BollingerBands, SMA } from "technicalindicators";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

const bars1m: Candle[] = JSON.parse(fs.readFileSync("data/vps/SUIUSDT_1_full.json", "utf-8"));
bars1m.sort((a, b) => a.timestamp - b.timestamp);

function agg(bars: Candle[], min: number): Candle[] {
  const ms = min * 60000, m = new Map<number, Candle>();
  for (const c of bars) {
    const k = Math.floor(c.timestamp / ms) * ms, e = m.get(k);
    if (!e) m.set(k, { ...c, timestamp: k });
    else { e.high = Math.max(e.high, c.high); e.low = Math.min(e.low, c.low); e.close = c.close; e.volume += c.volume; e.turnover += c.turnover; }
  }
  return [...m.values()].sort((a, b) => a.timestamp - b.timestamp);
}

const bars1h = agg(bars1m, 60);
const bars4h = agg(bars1m, 240);
const bars1d = agg(bars1m, 1440);

console.log(`SUI data: ${new Date(bars1m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(bars1m[bars1m.length - 1].timestamp).toISOString().slice(0, 10)}`);
console.log(`1h: ${bars1h.length} | 4h: ${bars4h.length} | 1d: ${bars1d.length}\n`);

// ── Compute indicators on 1H ──
const closes1h = bars1h.map(b => b.close);
const highs1h = bars1h.map(b => b.high);
const lows1h = bars1h.map(b => b.low);

const ema9 = EMA.calculate({ period: 9, values: closes1h });
const ema21 = EMA.calculate({ period: 21, values: closes1h });
const ema50 = EMA.calculate({ period: 50, values: closes1h });
const ema200 = EMA.calculate({ period: 200, values: closes1h });
const rsi14 = RSI.calculate({ period: 14, values: closes1h });
const atr14 = ATR.calculate({ period: 14, high: highs1h, low: lows1h, close: closes1h });
const bb20 = BollingerBands.calculate({ period: 20, values: closes1h, stdDev: 2 });
const sma20vol = SMA.calculate({ period: 20, values: bars1h.map(b => b.volume) });

// Align to bar index (indicators start at offset)
const OFF9 = closes1h.length - ema9.length;
const OFF21 = closes1h.length - ema21.length;
const OFF50 = closes1h.length - ema50.length;
const OFF200 = closes1h.length - ema200.length;
const OFFRSI = closes1h.length - rsi14.length;
const OFFATR = closes1h.length - atr14.length;
const OFFBB = closes1h.length - bb20.length;
const OFFVOL = closes1h.length - sma20vol.length;

function getEma(arr: number[], off: number, i: number): number { return i >= off ? arr[i - off] : NaN; }

// ── 4H indicators ──
const closes4h = bars4h.map(b => b.close);
const ema9_4h = EMA.calculate({ period: 9, values: closes4h });
const ema21_4h = EMA.calculate({ period: 21, values: closes4h });
const rsi14_4h = RSI.calculate({ period: 14, values: closes4h });
const OFF9_4H = closes4h.length - ema9_4h.length;
const OFF21_4H = closes4h.length - ema21_4h.length;
const OFFRSI_4H = closes4h.length - rsi14_4h.length;

// Map 1h timestamp → 4h bar index
const ts4h = bars4h.map(b => b.timestamp);
function find4hIdx(ts: number): number {
  const k = Math.floor(ts / (240 * 60000)) * (240 * 60000);
  let lo = 0, hi = ts4h.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (ts4h[mid] <= k) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

// ══════════════════════════════════════════════════════════════
// PART 1: Find swing lows (support bounces)
// A swing low: bar where low is lowest in ±N bars window
// ══════════════════════════════════════════════════════════════
const SWING_WINDOW = 6; // ±6 hours
const MIN_DROP_PCT = 2.0; // must have dropped >= 2% from recent high to qualify

interface SwingLow {
  idx: number;
  ts: number;
  low: number;
  priorHigh: number;
  dropPct: number;
  // Indicators at swing low
  rsi: number;
  ema9dist: number;   // % below ema9
  ema21dist: number;
  ema50dist: number;
  bbPos: number;       // position in BB (0=lower, 1=upper)
  volRatio: number;    // volume vs 20-period avg
  atrPct: number;
  // 4H context
  rsi4h: number;
  ema4hTrend: string;  // bull/bear/neutral
  // Recovery metrics
  recoveryBars1pct: number; // bars to recover 1% from swing low
  recoveryBars2pct: number;
  recoveryBars3pct: number;
  maxBounce12h: number;     // max % gain in 12h after swing low
  // Time
  utcHour: number;
  dayOfWeek: number;
}

const swingLows: SwingLow[] = [];

for (let i = SWING_WINDOW + 50; i < bars1h.length - 12; i++) {
  const bar = bars1h[i];
  let isSwingLow = true;
  for (let j = i - SWING_WINDOW; j <= i + SWING_WINDOW; j++) {
    if (j === i) continue;
    if (bars1h[j].low < bar.low) { isSwingLow = false; break; }
  }
  if (!isSwingLow) continue;

  // Check drop from recent high (lookback 24h)
  let priorHigh = 0;
  for (let j = Math.max(0, i - 24); j < i; j++) {
    if (bars1h[j].high > priorHigh) priorHigh = bars1h[j].high;
  }
  const dropPct = ((priorHigh - bar.low) / priorHigh) * 100;
  if (dropPct < MIN_DROP_PCT) continue;

  // Indicators
  const rsi = i >= OFFRSI ? rsi14[i - OFFRSI] : NaN;
  const e9 = getEma(ema9, OFF9, i);
  const e21 = getEma(ema21, OFF21, i);
  const e50 = getEma(ema50, OFF50, i);
  const ema9dist = ((bar.close - e9) / e9) * 100;
  const ema21dist = ((bar.close - e21) / e21) * 100;
  const ema50dist = ((bar.close - e50) / e50) * 100;

  let bbPos = NaN;
  if (i >= OFFBB) {
    const bb = bb20[i - OFFBB];
    bbPos = (bar.close - bb.lower) / (bb.upper - bb.lower);
  }

  let volRatio = NaN;
  if (i >= OFFVOL) {
    volRatio = bar.volume / sma20vol[i - OFFVOL];
  }

  const atrPct = i >= OFFATR ? (atr14[i - OFFATR] / bar.close) * 100 : NaN;

  // 4H context
  const i4h = find4hIdx(bar.timestamp);
  const rsi4h = i4h >= OFFRSI_4H ? rsi14_4h[i4h - OFFRSI_4H] : NaN;
  const e9_4h = i4h >= OFF9_4H ? ema9_4h[i4h - OFF9_4H] : NaN;
  const e21_4h = i4h >= OFF21_4H ? ema21_4h[i4h - OFF21_4H] : NaN;
  const ema4hTrend = isNaN(e9_4h) || isNaN(e21_4h) ? "?" : e9_4h > e21_4h ? "bull" : e9_4h < e21_4h * 0.999 ? "bear" : "neutral";

  // Recovery: how many 1h bars until price recovers X% from swing low
  let rec1 = -1, rec2 = -1, rec3 = -1, maxBounce = 0;
  for (let j = i + 1; j <= Math.min(i + 12, bars1h.length - 1); j++) {
    const gain = ((bars1h[j].high - bar.low) / bar.low) * 100;
    if (gain > maxBounce) maxBounce = gain;
    if (rec1 < 0 && gain >= 1.0) rec1 = j - i;
    if (rec2 < 0 && gain >= 2.0) rec2 = j - i;
    if (rec3 < 0 && gain >= 3.0) rec3 = j - i;
  }

  const d = new Date(bar.timestamp);
  swingLows.push({
    idx: i, ts: bar.timestamp, low: bar.low, priorHigh, dropPct,
    rsi, ema9dist, ema21dist, ema50dist, bbPos, volRatio, atrPct,
    rsi4h, ema4hTrend,
    recoveryBars1pct: rec1, recoveryBars2pct: rec2, recoveryBars3pct: rec3, maxBounce12h: maxBounce,
    utcHour: d.getUTCHours(), dayOfWeek: d.getUTCDay(),
  });
}

console.log(`\n${"═".repeat(140)}`);
console.log(`  SWING LOWS: ${swingLows.length} bounces (drop >= ${MIN_DROP_PCT}%, swing window ±${SWING_WINDOW}h)`);
console.log(`${"═".repeat(140)}\n`);

// ══════════════════════════════════════════════════════════════
// PART 2: Recovery speed analysis by indicator buckets
// ══════════════════════════════════════════════════════════════

function bucket(label: string, items: SwingLow[]) {
  if (items.length < 3) return;
  const rec1 = items.filter(s => s.recoveryBars1pct > 0);
  const rec2 = items.filter(s => s.recoveryBars2pct > 0);
  const rec3 = items.filter(s => s.recoveryBars3pct > 0);
  const avgBounce = items.reduce((s, i) => s + i.maxBounce12h, 0) / items.length;
  const avgRec1 = rec1.length > 0 ? rec1.reduce((s, i) => s + i.recoveryBars1pct, 0) / rec1.length : -1;
  const avgRec2 = rec2.length > 0 ? rec2.reduce((s, i) => s + i.recoveryBars2pct, 0) / rec2.length : -1;

  console.log(`  ${label.padEnd(35)} n=${String(items.length).padEnd(4)} ` +
    `1%: ${rec1.length}/${items.length} (${(rec1.length / items.length * 100).toFixed(0)}%) avg ${avgRec1 > 0 ? avgRec1.toFixed(1) + "h" : "—  "}  ` +
    `2%: ${rec2.length}/${items.length} (${(rec2.length / items.length * 100).toFixed(0)}%) avg ${avgRec2 > 0 ? avgRec2.toFixed(1) + "h" : "—  "}  ` +
    `3%: ${rec3.length}/${items.length} (${(rec3.length / items.length * 100).toFixed(0)}%)  ` +
    `avgBounce12h: ${avgBounce.toFixed(2)}%`);
}

// ── By RSI buckets ──
console.log("  ── Recovery by 1H RSI at swing low ──");
bucket("RSI < 20 (extreme oversold)", swingLows.filter(s => s.rsi < 20));
bucket("RSI 20-30 (oversold)", swingLows.filter(s => s.rsi >= 20 && s.rsi < 30));
bucket("RSI 30-40", swingLows.filter(s => s.rsi >= 30 && s.rsi < 40));
bucket("RSI 40-50", swingLows.filter(s => s.rsi >= 40 && s.rsi < 50));
bucket("RSI 50-60", swingLows.filter(s => s.rsi >= 50 && s.rsi < 60));
bucket("RSI > 60", swingLows.filter(s => s.rsi >= 60));

// ── By EMA distance ──
console.log("\n  ── Recovery by distance below EMA9 ──");
bucket("< -4% below EMA9", swingLows.filter(s => s.ema9dist < -4));
bucket("-4% to -2% below EMA9", swingLows.filter(s => s.ema9dist >= -4 && s.ema9dist < -2));
bucket("-2% to -1% below EMA9", swingLows.filter(s => s.ema9dist >= -2 && s.ema9dist < -1));
bucket("-1% to 0% (near EMA9)", swingLows.filter(s => s.ema9dist >= -1 && s.ema9dist < 0));
bucket("> 0% (above EMA9)", swingLows.filter(s => s.ema9dist >= 0));

console.log("\n  ── Recovery by distance below EMA21 ──");
bucket("< -5% below EMA21", swingLows.filter(s => s.ema21dist < -5));
bucket("-5% to -3% below EMA21", swingLows.filter(s => s.ema21dist >= -5 && s.ema21dist < -3));
bucket("-3% to -1% below EMA21", swingLows.filter(s => s.ema21dist >= -3 && s.ema21dist < -1));
bucket("-1% to 0% (near EMA21)", swingLows.filter(s => s.ema21dist >= -1 && s.ema21dist < 0));
bucket("> 0% (above EMA21)", swingLows.filter(s => s.ema21dist >= 0));

console.log("\n  ── Recovery by distance from EMA50 ──");
bucket("< -8% below EMA50", swingLows.filter(s => s.ema50dist < -8));
bucket("-8% to -4% below EMA50", swingLows.filter(s => s.ema50dist >= -8 && s.ema50dist < -4));
bucket("-4% to -1% below EMA50", swingLows.filter(s => s.ema50dist >= -4 && s.ema50dist < -1));
bucket("-1% to +2% (at EMA50)", swingLows.filter(s => s.ema50dist >= -1 && s.ema50dist < 2));
bucket("> +2% above EMA50", swingLows.filter(s => s.ema50dist >= 2));

// ── By Bollinger Band position ──
console.log("\n  ── Recovery by BB position ──");
bucket("BB < 0 (below lower band)", swingLows.filter(s => !isNaN(s.bbPos) && s.bbPos < 0));
bucket("BB 0-0.1 (at lower band)", swingLows.filter(s => !isNaN(s.bbPos) && s.bbPos >= 0 && s.bbPos < 0.1));
bucket("BB 0.1-0.2", swingLows.filter(s => !isNaN(s.bbPos) && s.bbPos >= 0.1 && s.bbPos < 0.2));
bucket("BB 0.2-0.3", swingLows.filter(s => !isNaN(s.bbPos) && s.bbPos >= 0.2 && s.bbPos < 0.3));
bucket("BB 0.3-0.5", swingLows.filter(s => !isNaN(s.bbPos) && s.bbPos >= 0.3 && s.bbPos < 0.5));
bucket("BB > 0.5", swingLows.filter(s => !isNaN(s.bbPos) && s.bbPos >= 0.5));

// ── By 4H trend ──
console.log("\n  ── Recovery by 4H EMA trend ──");
bucket("4H bullish (ema9 > ema21)", swingLows.filter(s => s.ema4hTrend === "bull"));
bucket("4H bearish (ema9 < ema21)", swingLows.filter(s => s.ema4hTrend === "bear"));

// ── By 4H RSI ──
console.log("\n  ── Recovery by 4H RSI ──");
bucket("4H RSI < 30", swingLows.filter(s => s.rsi4h < 30));
bucket("4H RSI 30-40", swingLows.filter(s => s.rsi4h >= 30 && s.rsi4h < 40));
bucket("4H RSI 40-50", swingLows.filter(s => s.rsi4h >= 40 && s.rsi4h < 50));
bucket("4H RSI 50-60", swingLows.filter(s => s.rsi4h >= 50 && s.rsi4h < 60));
bucket("4H RSI > 60", swingLows.filter(s => s.rsi4h >= 60));

// ── By volume ──
console.log("\n  ── Recovery by volume ratio (vs 20-bar avg) ──");
bucket("Volume < 0.5x avg (quiet)", swingLows.filter(s => !isNaN(s.volRatio) && s.volRatio < 0.5));
bucket("Volume 0.5-1.0x avg", swingLows.filter(s => !isNaN(s.volRatio) && s.volRatio >= 0.5 && s.volRatio < 1.0));
bucket("Volume 1.0-2.0x avg", swingLows.filter(s => !isNaN(s.volRatio) && s.volRatio >= 1.0 && s.volRatio < 2.0));
bucket("Volume 2.0-3.0x (high)", swingLows.filter(s => !isNaN(s.volRatio) && s.volRatio >= 2.0 && s.volRatio < 3.0));
bucket("Volume > 3.0x (spike)", swingLows.filter(s => !isNaN(s.volRatio) && s.volRatio >= 3.0));

// ── By drop severity ──
console.log("\n  ── Recovery by drop severity (from 24h high) ──");
bucket("Drop 2-3%", swingLows.filter(s => s.dropPct >= 2 && s.dropPct < 3));
bucket("Drop 3-5%", swingLows.filter(s => s.dropPct >= 3 && s.dropPct < 5));
bucket("Drop 5-8%", swingLows.filter(s => s.dropPct >= 5 && s.dropPct < 8));
bucket("Drop 8-12%", swingLows.filter(s => s.dropPct >= 8 && s.dropPct < 12));
bucket("Drop > 12%", swingLows.filter(s => s.dropPct >= 12));

// ══════════════════════════════════════════════════════════════
// PART 3: UTC hour analysis
// ══════════════════════════════════════════════════════════════
console.log("\n  ── Recovery by UTC hour of swing low ──");
for (let h = 0; h < 24; h++) {
  const items = swingLows.filter(s => s.utcHour === h);
  if (items.length >= 3) {
    bucket(`UTC ${String(h).padStart(2, "0")}:00`, items);
  }
}

// Session buckets
console.log("\n  ── Recovery by session ──");
bucket("Asia (00-08 UTC)", swingLows.filter(s => s.utcHour >= 0 && s.utcHour < 8));
bucket("Europe (08-14 UTC)", swingLows.filter(s => s.utcHour >= 8 && s.utcHour < 14));
bucket("US open (14-18 UTC)", swingLows.filter(s => s.utcHour >= 14 && s.utcHour < 18));
bucket("US close (18-00 UTC)", swingLows.filter(s => s.utcHour >= 18 || s.utcHour < 0));

// Day of week
console.log("\n  ── Recovery by day of week ──");
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
for (let d = 0; d < 7; d++) {
  bucket(days[d], swingLows.filter(s => s.dayOfWeek === d));
}

// ══════════════════════════════════════════════════════════════
// PART 4: Combined best-case filters
// ══════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(140)}`);
console.log("  COMBINED FILTER ANALYSIS — best indicator combos for fast recovery\n");

function combo(label: string, items: SwingLow[]) {
  if (items.length < 3) { console.log(`  ${label.padEnd(55)} n=${items.length} (too few)`); return; }
  const rec1 = items.filter(s => s.recoveryBars1pct > 0);
  const rec2 = items.filter(s => s.recoveryBars2pct > 0);
  const avgBounce = items.reduce((s, i) => s + i.maxBounce12h, 0) / items.length;
  const avgRec1 = rec1.length > 0 ? rec1.reduce((s, i) => s + i.recoveryBars1pct, 0) / rec1.length : -1;
  const medBounce = [...items].sort((a, b) => a.maxBounce12h - b.maxBounce12h)[Math.floor(items.length / 2)].maxBounce12h;

  console.log(`  ${label.padEnd(55)} n=${String(items.length).padEnd(4)} ` +
    `1%hit: ${(rec1.length / items.length * 100).toFixed(0)}% (${avgRec1 > 0 ? avgRec1.toFixed(1) + "h" : "—"})  ` +
    `2%hit: ${(rec2.length / items.length * 100).toFixed(0)}%  ` +
    `avgBounce: ${avgBounce.toFixed(2)}%  medBounce: ${medBounce.toFixed(2)}%`);
}

// RSI oversold + 4H bull
combo("RSI<30 + 4H bull", swingLows.filter(s => s.rsi < 30 && s.ema4hTrend === "bull"));
combo("RSI<30 + 4H bear", swingLows.filter(s => s.rsi < 30 && s.ema4hTrend === "bear"));
combo("RSI<40 + 4H bull", swingLows.filter(s => s.rsi < 40 && s.ema4hTrend === "bull"));
combo("RSI<40 + 4H bear", swingLows.filter(s => s.rsi < 40 && s.ema4hTrend === "bear"));

// EMA distance + RSI
combo("EMA9 < -2% + RSI<35", swingLows.filter(s => s.ema9dist < -2 && s.rsi < 35));
combo("EMA9 < -2% + RSI<35 + 4H bull", swingLows.filter(s => s.ema9dist < -2 && s.rsi < 35 && s.ema4hTrend === "bull"));
combo("EMA21 < -3% + RSI<35", swingLows.filter(s => s.ema21dist < -3 && s.rsi < 35));
combo("EMA50 < -4% + RSI<40", swingLows.filter(s => s.ema50dist < -4 && s.rsi < 40));

// BB + volume
combo("BB<0.1 + vol>1.5x", swingLows.filter(s => !isNaN(s.bbPos) && s.bbPos < 0.1 && s.volRatio > 1.5));
combo("BB<0 + vol>2x (capitulation?)", swingLows.filter(s => !isNaN(s.bbPos) && s.bbPos < 0 && s.volRatio > 2));
combo("BB<0.1 + RSI<30", swingLows.filter(s => !isNaN(s.bbPos) && s.bbPos < 0.1 && s.rsi < 30));
combo("BB<0.1 + RSI<30 + 4H bull", swingLows.filter(s => !isNaN(s.bbPos) && s.bbPos < 0.1 && s.rsi < 30 && s.ema4hTrend === "bull"));

// Drop severity combos
combo("Drop>5% + RSI<30", swingLows.filter(s => s.dropPct > 5 && s.rsi < 30));
combo("Drop>5% + RSI<30 + 4H bull", swingLows.filter(s => s.dropPct > 5 && s.rsi < 30 && s.ema4hTrend === "bull"));
combo("Drop>5% + BB<0.1", swingLows.filter(s => s.dropPct > 5 && !isNaN(s.bbPos) && s.bbPos < 0.1));
combo("Drop>8% + RSI<35", swingLows.filter(s => s.dropPct > 8 && s.rsi < 35));

// Session combos
combo("RSI<35 + Europe (08-14)", swingLows.filter(s => s.rsi < 35 && s.utcHour >= 8 && s.utcHour < 14));
combo("RSI<35 + Asia (00-08)", swingLows.filter(s => s.rsi < 35 && s.utcHour >= 0 && s.utcHour < 8));
combo("RSI<35 + US (14-00)", swingLows.filter(s => s.rsi < 35 && s.utcHour >= 14));
combo("BB<0.1 + Europe (08-14)", swingLows.filter(s => !isNaN(s.bbPos) && s.bbPos < 0.1 && s.utcHour >= 8 && s.utcHour < 14));

// ══════════════════════════════════════════════════════════════
// PART 5: Sample trades — show individual swing lows with all data
// ══════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(140)}`);
console.log("  TOP 20 FASTEST RECOVERIES (by hours to 2% bounce)\n");

const fastRec = swingLows.filter(s => s.recoveryBars2pct > 0).sort((a, b) => a.recoveryBars2pct - b.recoveryBars2pct).slice(0, 20);
console.log(`  ${"Date".padEnd(18)} ${"Low".padEnd(10)} ${"Drop%".padEnd(7)} ${"RSI".padEnd(6)} ${"E9%".padEnd(7)} ${"E21%".padEnd(7)} ${"BB".padEnd(6)} ${"Vol".padEnd(6)} ${"4HTrend".padEnd(8)} ${"4HRSI".padEnd(7)} ${"→1%".padEnd(5)} ${"→2%".padEnd(5)} ${"→3%".padEnd(5)} ${"Max12h".padEnd(8)} UTC`);
for (const s of fastRec) {
  console.log(`  ${new Date(s.ts).toISOString().slice(0, 16).padEnd(18)} $${s.low.toFixed(4).padEnd(9)} ${s.dropPct.toFixed(1).padEnd(7)} ${s.rsi.toFixed(0).padEnd(6)} ${(s.ema9dist >= 0 ? "+" : "") + s.ema9dist.toFixed(1).padEnd(6)} ${(s.ema21dist >= 0 ? "+" : "") + s.ema21dist.toFixed(1).padEnd(6)} ${s.bbPos.toFixed(2).padEnd(6)} ${s.volRatio.toFixed(1).padEnd(6)} ${s.ema4hTrend.padEnd(8)} ${s.rsi4h.toFixed(0).padEnd(7)} ${(s.recoveryBars1pct > 0 ? s.recoveryBars1pct + "h" : "—").padEnd(5)} ${(s.recoveryBars2pct > 0 ? s.recoveryBars2pct + "h" : "—").padEnd(5)} ${(s.recoveryBars3pct > 0 ? s.recoveryBars3pct + "h" : "—").padEnd(5)} ${s.maxBounce12h.toFixed(2).padEnd(8)} ${s.utcHour}h`);
}

console.log(`\n  WORST 20 RECOVERIES (smallest 12h bounce)\n`);
const slowRec = [...swingLows].sort((a, b) => a.maxBounce12h - b.maxBounce12h).slice(0, 20);
console.log(`  ${"Date".padEnd(18)} ${"Low".padEnd(10)} ${"Drop%".padEnd(7)} ${"RSI".padEnd(6)} ${"E9%".padEnd(7)} ${"E21%".padEnd(7)} ${"BB".padEnd(6)} ${"Vol".padEnd(6)} ${"4HTrend".padEnd(8)} ${"4HRSI".padEnd(7)} ${"→1%".padEnd(5)} ${"→2%".padEnd(5)} ${"→3%".padEnd(5)} ${"Max12h".padEnd(8)} UTC`);
for (const s of slowRec) {
  console.log(`  ${new Date(s.ts).toISOString().slice(0, 16).padEnd(18)} $${s.low.toFixed(4).padEnd(9)} ${s.dropPct.toFixed(1).padEnd(7)} ${s.rsi.toFixed(0).padEnd(6)} ${(s.ema9dist >= 0 ? "+" : "") + s.ema9dist.toFixed(1).padEnd(6)} ${(s.ema21dist >= 0 ? "+" : "") + s.ema21dist.toFixed(1).padEnd(6)} ${s.bbPos.toFixed(2).padEnd(6)} ${s.volRatio.toFixed(1).padEnd(6)} ${s.ema4hTrend.padEnd(8)} ${s.rsi4h.toFixed(0).padEnd(7)} ${(s.recoveryBars1pct > 0 ? s.recoveryBars1pct + "h" : "—").padEnd(5)} ${(s.recoveryBars2pct > 0 ? s.recoveryBars2pct + "h" : "—").padEnd(5)} ${(s.recoveryBars3pct > 0 ? s.recoveryBars3pct + "h" : "—").padEnd(5)} ${s.maxBounce12h.toFixed(2).padEnd(8)} ${s.utcHour}h`);
}

// ══════════════════════════════════════════════════════════════
// PART 6: Simulated long entries at swing lows
// ══════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(140)}`);
console.log("  SIMULATED LONG ENTRIES AT SWING LOWS\n");

const DISC_END = new Date("2026-01-01").getTime();
const ts1m = bars1m.map(b => b.timestamp);
function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

interface SimResult { label: string; filter: (s: SwingLow) => boolean; }

const filters: SimResult[] = [
  { label: "ALL swing lows", filter: () => true },
  { label: "RSI<30", filter: s => s.rsi < 30 },
  { label: "RSI<35", filter: s => s.rsi < 35 },
  { label: "RSI<40", filter: s => s.rsi < 40 },
  { label: "RSI<35 + 4H bull", filter: s => s.rsi < 35 && s.ema4hTrend === "bull" },
  { label: "RSI<40 + 4H bull", filter: s => s.rsi < 40 && s.ema4hTrend === "bull" },
  { label: "BB<0.1", filter: s => !isNaN(s.bbPos) && s.bbPos < 0.1 },
  { label: "BB<0.1 + RSI<35", filter: s => !isNaN(s.bbPos) && s.bbPos < 0.1 && s.rsi < 35 },
  { label: "BB<0.1 + 4H bull", filter: s => !isNaN(s.bbPos) && s.bbPos < 0.1 && s.ema4hTrend === "bull" },
  { label: "EMA9<-2% + RSI<35", filter: s => s.ema9dist < -2 && s.rsi < 35 },
  { label: "EMA9<-2% + RSI<35 + 4H bull", filter: s => s.ema9dist < -2 && s.rsi < 35 && s.ema4hTrend === "bull" },
  { label: "Drop>5% + RSI<35", filter: s => s.dropPct > 5 && s.rsi < 35 },
  { label: "Drop>5% + 4H bull", filter: s => s.dropPct > 5 && s.ema4hTrend === "bull" },
  { label: "Europe (08-14) + RSI<40", filter: s => s.utcHour >= 8 && s.utcHour < 14 && s.rsi < 40 },
  { label: "Asia (00-08) + RSI<40", filter: s => s.utcHour >= 0 && s.utcHour < 8 && s.rsi < 40 },
  { label: "Not US open (skip 14-18) + RSI<35", filter: s => !(s.utcHour >= 14 && s.utcHour < 18) && s.rsi < 35 },
];

const NOTIONAL = 10000;
const FEE_RT = 0.0011;

for (const tpPct of [1.0, 1.5, 2.0]) {
  for (const slPct of [2.0, 3.0]) {
    console.log(`  ── TP=${tpPct}% SL=${slPct}% ──`);
    console.log(`  ${"Filter".padEnd(42)} ${"N".padEnd(5)} ${"W".padEnd(5)} ${"L".padEnd(5)} ${"WR%".padEnd(7)} ${"PnL".padEnd(12)} ${"DD".padEnd(10)} ${"dN".padEnd(5)} ${"dPnL".padEnd(10)} ${"vN".padEnd(5)} ${"vPnL".padEnd(10)} ${"v$/t".padEnd(8)}`);

    for (const f of filters) {
      const sigs = swingLows.filter(f.filter);
      let wins = 0, losses = 0, flats = 0, totalPnl = 0;
      let equity = 0, peakEq = 0, maxDD = 0;
      let discN = 0, discPnl = 0, valN = 0, valPnl = 0;

      for (const sig of sigs) {
        // Entry: next 1h bar close after swing low (can't enter mid-bar)
        const entryTs = sig.ts + 3600000;
        const entryIdx = bsearch(ts1m, entryTs);
        if (entryIdx < 0 || entryIdx >= bars1m.length - 10) continue;

        const ep = bars1h[sig.idx + 1]?.close ?? sig.low; // enter at next bar close
        const tp = ep * (1 + tpPct / 100);
        const sl = ep * (1 - slPct / 100);
        const maxIdx = Math.min(entryIdx + 720, bars1m.length - 1); // 12h hold

        let pnl = 0, outcome = "flat";
        for (let j = entryIdx + 1; j <= maxIdx; j++) {
          if (bars1m[j].low <= sl) { pnl = -slPct / 100 * NOTIONAL - NOTIONAL * FEE_RT; outcome = "stop"; break; }
          if (bars1m[j].high >= tp) { pnl = tpPct / 100 * NOTIONAL - NOTIONAL * FEE_RT; outcome = "tp"; break; }
        }
        if (outcome === "flat") pnl = ((bars1m[maxIdx].close - ep) / ep) * NOTIONAL - NOTIONAL * FEE_RT;

        totalPnl += pnl; equity += pnl;
        if (equity > peakEq) peakEq = equity;
        if (peakEq - equity > maxDD) maxDD = peakEq - equity;
        if (outcome === "tp") wins++; else if (outcome === "stop") losses++; else flats++;
        if (sig.ts < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }
      }

      const n = wins + losses + flats;
      if (n === 0) continue;
      const wr = (wins / n * 100).toFixed(1);
      const vpt = valN > 0 ? (valPnl / valN).toFixed(1) : "—";
      console.log(`  ${f.label.padEnd(42)} ${String(n).padEnd(5)} ${String(wins).padEnd(5)} ${String(losses).padEnd(5)} ${(wr + "%").padEnd(7)} ${"$" + (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(0).padEnd(11)} ${"$" + maxDD.toFixed(0).padEnd(9)} ${String(discN).padEnd(5)} ${"$" + (discPnl >= 0 ? "+" : "") + discPnl.toFixed(0).padEnd(9)} ${String(valN).padEnd(5)} ${"$" + (valPnl >= 0 ? "+" : "") + valPnl.toFixed(0).padEnd(9)} ${vpt}`);
    }
    console.log();
  }
}

console.log(`${"═".repeat(140)}`);
