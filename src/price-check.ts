// Quick price action analysis — run anytime for a snapshot
// Usage: npx ts-node src/price-check.ts [HYPEUSDT] [avgEntry]
// Examples:
//   npx ts-node src/price-check.ts
//   npx ts-node src/price-check.ts HYPEUSDT 42
//   npx ts-node src/price-check.ts BTCUSDT 75000

import fs from "fs";
import https from "https";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

const SEP = "═".repeat(80);
const DIV = "─".repeat(80);

const symbol = process.argv[2] || "HYPEUSDT";
const avgEntry = process.argv[3] ? parseFloat(process.argv[3]) : null;

// ── Helpers ──

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out = [data[0]];
  for (let i = 1; i < data.length; i++) out.push(data[i] * k + out[i - 1] * (1 - k));
  return out;
}

function rsi(closes: number[], period: number): number {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period && i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function fmt(v: number, decimals = 2): string {
  return (v >= 0 ? "+" : "") + v.toFixed(decimals) + "%";
}

function price(v: number): string {
  return "$" + (v >= 1000 ? v.toFixed(0) : v.toFixed(2));
}

// ── Load data ──

const dataFiles = [
  `data/${symbol}_5.json`,
  `data/${symbol}_5_full.json`,
];
let filepath = "";
for (const f of dataFiles) {
  if (fs.existsSync(f)) { filepath = f; break; }
}
if (!filepath) {
  console.error(`No 5m data found for ${symbol}. Run: npx ts-node src/fetch-candles.ts ${symbol} 5 2024-12-05`);
  process.exit(1);
}

const candles: Candle[] = JSON.parse(fs.readFileSync(filepath, "utf-8"));
const now = candles[candles.length - 1].timestamp;
const current = candles[candles.length - 1].close;

// ── Build daily bars ──

const dayMap = new Map<string, { open: number; high: number; low: number; close: number; vol: number; ts: number }>();
for (const c of candles) {
  const day = new Date(c.timestamp).toISOString().slice(0, 10);
  if (!dayMap.has(day)) dayMap.set(day, { open: c.open, high: c.high, low: c.low, close: c.close, vol: 0, ts: c.timestamp });
  const d = dayMap.get(day)!;
  if (c.high > d.high) d.high = c.high;
  if (c.low < d.low) d.low = c.low;
  d.close = c.close;
  d.vol += c.turnover;
}
const days = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const dailyCloses = days.map(d => d[1].close);

// ── Header ──

console.log(SEP);
console.log(`  ${symbol} PRICE CHECK — ${new Date(now).toISOString().slice(0, 16)} UTC`);
console.log(`  Current: ${price(current)}` + (avgEntry ? `  |  Avg Entry: ${price(avgEntry)}  |  PnL: ${fmt((current - avgEntry) / avgEntry * 100)}` : ""));
console.log(SEP);

// ── Timeframe returns ──

const periods = [
  { label: "1H", bars: 12 },
  { label: "4H", bars: 48 },
  { label: "1D", bars: 288 },
  { label: "3D", bars: 864 },
  { label: "7D", bars: 2016 },
  { label: "14D", bars: 4032 },
  { label: "30D", bars: 8640 },
];

console.log("\n  RETURNS & RANGE");
console.log("  " + DIV);
console.log(`  ${"Period".padEnd(8)} ${"Return".padStart(8)} ${"High".padStart(10)} ${"Low".padStart(10)} ${"DD from Hi".padStart(11)} ${"Avg Vol/5m".padStart(12)}`);

for (const p of periods) {
  const slice = candles.slice(Math.max(0, candles.length - p.bars));
  if (slice.length < 2) continue;
  const ret = (current - slice[0].open) / slice[0].open * 100;
  const hi = Math.max(...slice.map(c => c.high));
  const lo = Math.min(...slice.map(c => c.low));
  const dd = (current - hi) / hi * 100;
  const avgVol = slice.reduce((s, c) => s + c.turnover, 0) / slice.length;
  console.log(`  ${p.label.padEnd(8)} ${fmt(ret).padStart(8)} ${price(hi).padStart(10)} ${price(lo).padStart(10)} ${fmt(dd).padStart(11)} ${("$" + (avgVol / 1000).toFixed(0) + "k").padStart(12)}`);
}

// ── Support / Resistance ──

console.log("\n  SUPPORT / RESISTANCE");
console.log("  " + DIV);

// Swing highs/lows from daily bars (last 30 days)
const recent30 = days.slice(-30);
const swingHighs: { date: string; price: number }[] = [];
const swingLows: { date: string; price: number }[] = [];

for (let i = 1; i < recent30.length - 1; i++) {
  const prev = recent30[i - 1][1];
  const curr = recent30[i][1];
  const next = recent30[i + 1][1];
  if (curr.high > prev.high && curr.high > next.high) swingHighs.push({ date: recent30[i][0], price: curr.high });
  if (curr.low < prev.low && curr.low < next.low) swingLows.push({ date: recent30[i][0], price: curr.low });
}

// Sort by distance from current price
const allLevels = [
  ...swingHighs.map(s => ({ ...s, type: "R" as const })),
  ...swingLows.map(s => ({ ...s, type: "S" as const })),
].sort((a, b) => Math.abs(a.price - current) - Math.abs(b.price - current));

// Show nearest levels above and below
const above = allLevels.filter(l => l.price > current).slice(0, 4);
const below = allLevels.filter(l => l.price <= current).slice(0, 4);

for (const l of above.reverse()) {
  const dist = (l.price - current) / current * 100;
  console.log(`  ${l.type === "R" ? "RESISTANCE" : "SUPPORT   "}  ${price(l.price).padStart(10)}  ${fmt(dist).padStart(8)} away  (${l.date})`);
}
console.log(`  ${">>> PRICE".padEnd(12)}  ${price(current).padStart(10)}  ◄ HERE`);
for (const l of below) {
  const dist = (l.price - current) / current * 100;
  console.log(`  ${l.type === "S" ? "SUPPORT   " : "RESISTANCE"}  ${price(l.price).padStart(10)}  ${fmt(dist).padStart(8)} away  (${l.date})`);
}

// 30d extremes
const d30High = Math.max(...recent30.map(d => d[1].high));
const d30Low = Math.min(...recent30.map(d => d[1].low));
const rangePos = (current - d30Low) / (d30High - d30Low) * 100;
console.log(`\n  30d range: ${price(d30Low)} — ${price(d30High)}  |  Position: ${rangePos.toFixed(0)}%`);

// ── EMAs ──

console.log("\n  MOVING AVERAGES (daily)");
console.log("  " + DIV);
for (const period of [9, 21, 50, 100, 200]) {
  if (dailyCloses.length < period) continue;
  const vals = ema(dailyCloses, period);
  const val = vals[vals.length - 1];
  const dist = (current - val) / val * 100;
  const label = current > val ? "ABOVE" : "BELOW";
  console.log(`  EMA${String(period).padEnd(4)} ${price(val).padStart(10)}  ${label.padEnd(5)}  (${fmt(dist)})`);
}

// ── RSI ──

console.log("\n  RSI");
console.log("  " + DIV);

// Daily RSI
if (dailyCloses.length >= 15) {
  const r = rsi(dailyCloses, 14);
  const zone = r > 70 ? "OVERBOUGHT" : r < 30 ? "OVERSOLD" : r > 60 ? "BULLISH" : r < 40 ? "BEARISH" : "NEUTRAL";
  console.log(`  Daily RSI(14):  ${r.toFixed(1).padStart(5)}  ${zone}`);
}

// 4H RSI (using 5m candles aggregated to 4h)
const last4hCloses: number[] = [];
for (let i = candles.length - 1; i >= 0 && last4hCloses.length < 100; i -= 48) {
  last4hCloses.unshift(candles[i].close);
}
if (last4hCloses.length >= 15) {
  const r = rsi(last4hCloses, 14);
  const zone = r > 70 ? "OVERBOUGHT" : r < 30 ? "OVERSOLD" : r > 60 ? "BULLISH" : r < 40 ? "BEARISH" : "NEUTRAL";
  console.log(`  4H RSI(14):     ${r.toFixed(1).padStart(5)}  ${zone}`);
}

// 1H RSI
const last1hCloses: number[] = [];
for (let i = candles.length - 1; i >= 0 && last1hCloses.length < 100; i -= 12) {
  last1hCloses.unshift(candles[i].close);
}
if (last1hCloses.length >= 15) {
  const r = rsi(last1hCloses, 14);
  const zone = r > 70 ? "OVERBOUGHT" : r < 30 ? "OVERSOLD" : r > 60 ? "BULLISH" : r < 40 ? "BEARISH" : "NEUTRAL";
  console.log(`  1H RSI(14):     ${r.toFixed(1).padStart(5)}  ${zone}`);
}

// ── Momentum ──

console.log("\n  MOMENTUM");
console.log("  " + DIV);

const last3d = days.slice(-3);
const prior3d = days.slice(-6, -3);
if (last3d.length === 3 && prior3d.length === 3) {
  const last3Ret = (last3d[2][1].close - last3d[0][1].open) / last3d[0][1].open * 100;
  const prior3Ret = (prior3d[2][1].close - prior3d[0][1].open) / prior3d[0][1].open * 100;
  const last3Vol = last3d.reduce((s, d) => s + d[1].vol, 0);
  const prior3Vol = prior3d.reduce((s, d) => s + d[1].vol, 0);
  const accel = last3Ret - prior3Ret;

  console.log(`  Last 3d:   ${fmt(last3Ret)}  vol $${(last3Vol / 1e6).toFixed(0)}M`);
  console.log(`  Prior 3d:  ${fmt(prior3Ret)}  vol $${(prior3Vol / 1e6).toFixed(0)}M`);
  console.log(`  Accel:     ${fmt(accel)} ${accel > 0 ? "(accelerating)" : "(decelerating)"}`);
  console.log(`  Vol shift: ${fmt((last3Vol / prior3Vol - 1) * 100)} ${last3Vol > prior3Vol ? "(increasing)" : "(drying up)"}`);
}

// ── Daily candles (last 10 days) ──

console.log("\n  LAST 10 DAYS");
console.log("  " + DIV);
console.log(`  ${"Date".padEnd(12)} ${"Open".padStart(9)} ${"High".padStart(9)} ${"Low".padStart(9)} ${"Close".padStart(9)} ${"Change".padStart(8)} ${"Volume".padStart(10)}`);

for (const [date, d] of days.slice(-10)) {
  const chg = (d.close - d.open) / d.open * 100;
  console.log(`  ${date.padEnd(12)} ${price(d.open).padStart(9)} ${price(d.high).padStart(9)} ${price(d.low).padStart(9)} ${price(d.close).padStart(9)} ${fmt(chg).padStart(8)} ${("$" + (d.vol / 1e6).toFixed(0) + "M").padStart(10)}`);
}

// ── BTC correlation (if BTC data available) ──

const btcFiles = ["data/BTCUSDT_5.json", "data/BTCUSDT_5_full.json", "data/vps/BTCUSDT_5.json"];
let btcPath = "";
for (const f of btcFiles) { if (fs.existsSync(f)) { btcPath = f; break; } }

if (btcPath && symbol !== "BTCUSDT") {
  const btc: Candle[] = JSON.parse(fs.readFileSync(btcPath, "utf-8"));
  const btcLast = btc[btc.length - 1];

  // BTC returns for same periods
  console.log("\n  BTC CORRELATION");
  console.log("  " + DIV);
  console.log(`  BTC: ${price(btcLast.close)}  (${new Date(btcLast.timestamp).toISOString().slice(0, 16)} UTC)`);

  for (const p of [{ label: "1D", bars: 288 }, { label: "3D", bars: 864 }, { label: "7D", bars: 2016 }]) {
    const symSlice = candles.slice(Math.max(0, candles.length - p.bars));
    const btcSlice = btc.slice(Math.max(0, btc.length - p.bars));
    if (symSlice.length < 2 || btcSlice.length < 2) continue;
    const symRet = (current - symSlice[0].open) / symSlice[0].open * 100;
    const btcRet = (btcLast.close - btcSlice[0].open) / btcSlice[0].open * 100;
    const outperf = symRet - btcRet;
    console.log(`  ${p.label.padEnd(4)} ${symbol.replace("USDT","")}: ${fmt(symRet).padStart(8)}  BTC: ${fmt(btcRet).padStart(8)}  Outperf: ${fmt(outperf).padStart(8)}`);
  }
}

// ── Verdict ──

const dailyRsi = dailyCloses.length >= 15 ? rsi(dailyCloses, 14) : 50;
const ema21 = dailyCloses.length >= 21 ? ema(dailyCloses, 21).pop()! : current;
const aboveEma = current > ema21;
const momentum = days.length >= 6 ? (days[days.length - 1][1].close - days[days.length - 3][1].open) / days[days.length - 3][1].open * 100 : 0;

console.log("\n  VERDICT");
console.log("  " + DIV);

const signals: string[] = [];
if (aboveEma) signals.push("Above EMA21");
else signals.push("Below EMA21 — caution");
if (dailyRsi > 70) signals.push("RSI overbought — pullback risk");
else if (dailyRsi > 55) signals.push("RSI bullish");
else if (dailyRsi < 30) signals.push("RSI oversold — bounce likely");
else if (dailyRsi < 45) signals.push("RSI weak");
else signals.push("RSI neutral");
if (momentum > 3) signals.push("Strong momentum (3d " + fmt(momentum) + ")");
else if (momentum > 0) signals.push("Mild uptrend (3d " + fmt(momentum) + ")");
else if (momentum < -3) signals.push("Strong sell pressure (3d " + fmt(momentum) + ")");
else signals.push("Mild downtrend (3d " + fmt(momentum) + ")");
if (rangePos > 85) signals.push("Near 30d high — resistance zone");
else if (rangePos < 15) signals.push("Near 30d low — support zone");

if (avgEntry) {
  const tpDist = ((avgEntry * 1.014) - current) / current * 100;
  if (tpDist <= 0) signals.push("TP target already reached!");
  else if (tpDist < 1) signals.push(`TP target ${price(avgEntry * 1.014)} is ${fmt(tpDist)} away — close`);
  else signals.push(`TP target ${price(avgEntry * 1.014)} is ${fmt(tpDist)} away`);
}

for (const s of signals) console.log(`  • ${s}`);

console.log("\n" + SEP);
