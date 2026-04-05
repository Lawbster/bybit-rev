// analyze-pf0-sui-structure.ts — Deep dive: what structural context separates
// PF0 wins from losses on SUI? Looking for a tell in S/R, range position, volume.
//
// For each signal, compute:
//   1. Distance from 24h high / 24h low (where in range)
//   2. Distance from 7d high / 7d low
//   3. Whether pump bar broke above prior 24h high (breakout vs range pump)
//   4. Volume spike: pump bar vol vs 20-bar avg vol
//   5. Pump bar body size (how aggressive)
//   6. Post-pump retracement depth (how much did it give back before entry)
//   7. Number of prior pumps in last 48h (clustering = exhaustion?)
//   8. Distance from EMA20 on 1H (mean reversion potential)
//   9. Recent 12h momentum (ROC) — was this a trend continuation or reversal pump?
//  10. ATR-normalized pump size (is it an outlier move?)

import fs from "fs";

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
const ts1m = bars1m.map(b => b.timestamp);

function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

// EMA helper
function emaCalc(vals: number[], p: number): number[] {
  const k = 2 / (p + 1);
  const r = [vals[0]];
  for (let i = 1; i < vals.length; i++) r.push(vals[i] * k + r[i - 1] * (1 - k));
  return r;
}

// ATR on 1H
function atrCalc(bars: Candle[], period: number): number[] {
  const tr: number[] = [bars[0].high - bars[0].low];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high, l = bars[i].low, pc = bars[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  // SMA then EMA
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < tr.length; i++) {
    if (i < period) { sum += tr[i]; if (i === period - 1) out.push(sum / period); }
    else { out.push((out[out.length - 1] * (period - 1) + tr[i]) / period); }
  }
  return out;
}

const closes1h = bars1h.map(b => b.close);
const ema20 = emaCalc(closes1h, 20);
const atr14 = atrCalc(bars1h, 14);
const atrOffset = bars1h.length - atr14.length;

console.log(`SUI 1m: ${bars1m.length} candles | 1h: ${bars1h.length} bars\n`);

// ── Signals ──
interface SigCtx {
  ts: number;
  entryPrice: number;
  pumpIdx: number;       // index of pump bar in bars1h
  entryIdx: number;      // index of entry bar (lookEnd) in bars1h
}

const signals: SigCtx[] = [];
let lastSigTs = 0;
for (let i = 4; i < bars1h.length; i++) {
  const pumpIdx = i - 3;
  const bar = bars1h[pumpIdx];
  const body = ((bar.close - bar.open) / bar.open) * 100;
  if (body < 2.0) continue;
  const pH = bar.high;
  let failed = true;
  for (let j = pumpIdx + 1; j <= i; j++) { if (bars1h[j].high > pH * 1.003) { failed = false; break; } }
  if (!failed) continue;
  let hasRed = false;
  for (let j = pumpIdx + 1; j <= i; j++) { if (bars1h[j].close < bars1h[j].open) { hasRed = true; break; } }
  if (!hasRed) continue;
  if (bars1h[i].timestamp - lastSigTs < 2 * 3600000) continue;
  signals.push({ ts: bars1h[i].timestamp, entryPrice: bars1h[i].close, pumpIdx, entryIdx: i });
  lastSigTs = bars1h[i].timestamp;
}

// ── Sim each signal at 2.5/3 ──
const NOTIONAL = 5000;
const FEE = 0.0011;
const MAX_HOLD = 720;
const TP_PCT = 2.5;
const SL_PCT = 3.0;

interface AnalyzedTrade {
  ts: number;
  entryPrice: number;
  outcome: string;
  pnl: number;
  // structural features
  pumpBodyPct: number;        // pump bar body size %
  pumpVolRatio: number;       // pump vol / 20-bar avg
  distFrom24hHighPct: number; // entry price vs 24h high (negative = below)
  distFrom24hLowPct: number;  // entry price vs 24h low (positive = above)
  rangePosition: number;      // 0-1: where in 24h range (1 = at high)
  distFrom7dHighPct: number;
  rangePosition7d: number;
  brokeAbove24hHigh: boolean; // did pump break prior 24h high?
  retraceFromPumpPct: number; // how much price pulled back from pump high to entry
  priorPumps48h: number;      // how many pump signals in last 48h
  distFromEma20Pct: number;   // entry price vs EMA20 (positive = above)
  roc12h: number;             // 12h momentum %
  pumpVsAtrRatio: number;     // pump bar range / ATR14
  holdMinutes: number;
}

const analyzed: AnalyzedTrade[] = [];

for (const sig of signals) {
  const { pumpIdx, entryIdx, entryPrice, ts } = sig;
  const pumpBar = bars1h[pumpIdx];

  // ── Sim ──
  const entryIdx1m = bsearch(ts1m, ts + 3600000);
  if (entryIdx1m < 0 || entryIdx1m >= bars1m.length - 10) continue;
  const tp = entryPrice * (1 - TP_PCT / 100);
  const sl = entryPrice * (1 + SL_PCT / 100);
  const maxIdx1m = Math.min(entryIdx1m + MAX_HOLD, bars1m.length - 1);
  let pnl = 0, outcome = "flat", exitIdx1m = maxIdx1m;

  for (let j = entryIdx1m + 1; j <= maxIdx1m; j++) {
    if (bars1m[j].high >= sl) { pnl = -SL_PCT / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "stop"; exitIdx1m = j; break; }
    if (bars1m[j].low <= tp) { pnl = TP_PCT / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "tp"; exitIdx1m = j; break; }
  }
  if (outcome === "flat") pnl = ((entryPrice - bars1m[maxIdx1m].close) / entryPrice) * NOTIONAL - NOTIONAL * FEE;

  // ── Compute features ──

  // 1. Pump body size
  const pumpBodyPct = ((pumpBar.close - pumpBar.open) / pumpBar.open) * 100;

  // 2. Volume spike
  const volStart = Math.max(0, pumpIdx - 20);
  let volSum = 0, volCount = 0;
  for (let j = volStart; j < pumpIdx; j++) { volSum += bars1h[j].volume; volCount++; }
  const avgVol = volCount > 0 ? volSum / volCount : 1;
  const pumpVolRatio = pumpBar.volume / avgVol;

  // 3. 24h high/low (24 bars before pump)
  const lookback24h = Math.max(0, pumpIdx - 24);
  let high24h = 0, low24h = Infinity;
  for (let j = lookback24h; j < pumpIdx; j++) {
    if (bars1h[j].high > high24h) high24h = bars1h[j].high;
    if (bars1h[j].low < low24h) low24h = bars1h[j].low;
  }
  const distFrom24hHighPct = ((entryPrice - high24h) / high24h) * 100;
  const distFrom24hLowPct = ((entryPrice - low24h) / low24h) * 100;
  const range24h = high24h - low24h;
  const rangePosition = range24h > 0 ? (entryPrice - low24h) / range24h : 0.5;

  // 4. 7d high/low (168 bars)
  const lookback7d = Math.max(0, pumpIdx - 168);
  let high7d = 0, low7d = Infinity;
  for (let j = lookback7d; j < pumpIdx; j++) {
    if (bars1h[j].high > high7d) high7d = bars1h[j].high;
    if (bars1h[j].low < low7d) low7d = bars1h[j].low;
  }
  const distFrom7dHighPct = ((entryPrice - high7d) / high7d) * 100;
  const range7d = high7d - low7d;
  const rangePosition7d = range7d > 0 ? (entryPrice - low7d) / range7d : 0.5;

  // 5. Did pump break above prior 24h high?
  const brokeAbove24hHigh = pumpBar.high > high24h;

  // 6. Retrace from pump high to entry
  const retraceFromPumpPct = ((pumpBar.high - entryPrice) / pumpBar.high) * 100;

  // 7. Prior pumps in 48h
  let priorPumps48h = 0;
  for (const prev of signals) {
    if (prev.ts >= ts) break;
    if (ts - prev.ts < 48 * 3600000) priorPumps48h++;
  }

  // 8. Distance from EMA20
  const ema20Val = ema20[entryIdx];
  const distFromEma20Pct = ((entryPrice - ema20Val) / ema20Val) * 100;

  // 9. 12h momentum
  const roc12hIdx = Math.max(0, entryIdx - 12);
  const roc12h = ((entryPrice - bars1h[roc12hIdx].close) / bars1h[roc12hIdx].close) * 100;

  // 10. Pump vs ATR
  const atrIdx = entryIdx - atrOffset;
  const atrVal = atrIdx >= 0 && atrIdx < atr14.length ? atr14[atrIdx] : 1;
  const pumpRange = pumpBar.high - pumpBar.low;
  const pumpVsAtrRatio = pumpRange / atrVal;

  const holdMinutes = Math.round((bars1m[exitIdx1m].timestamp - ts) / 60000);

  analyzed.push({
    ts, entryPrice, outcome, pnl,
    pumpBodyPct, pumpVolRatio,
    distFrom24hHighPct, distFrom24hLowPct, rangePosition,
    distFrom7dHighPct, rangePosition7d,
    brokeAbove24hHigh, retraceFromPumpPct,
    priorPumps48h, distFromEma20Pct,
    roc12h, pumpVsAtrRatio, holdMinutes,
  });
}

// ── Analysis: compare wins vs losses on each feature ──
const wins = analyzed.filter(t => t.outcome === "tp");
const losses = analyzed.filter(t => t.outcome === "stop");
const flats = analyzed.filter(t => t.outcome === "flat");

function avg(arr: number[]): number { return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
function med(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function pct(arr: number[], threshold: number, above: boolean): string {
  const count = arr.filter(v => above ? v > threshold : v <= threshold).length;
  return `${(count / arr.length * 100).toFixed(0)}%`;
}

console.log(`\nAnalyzed ${analyzed.length} trades: ${wins.length} wins, ${losses.length} losses, ${flats.length} flats\n`);
console.log(`${"Feature".padEnd(30)} ${"Win avg".padEnd(10)} ${"Win med".padEnd(10)} ${"Loss avg".padEnd(10)} ${"Loss med".padEnd(10)} ${"Delta".padEnd(10)} Signal?`);
console.log("─".repeat(100));

interface FeatureDef {
  name: string;
  extract: (t: AnalyzedTrade) => number;
  higherIsBetter?: boolean; // for the short: higher value = more likely to be a win?
}

const features: FeatureDef[] = [
  { name: "pumpBodyPct", extract: t => t.pumpBodyPct },
  { name: "pumpVolRatio", extract: t => t.pumpVolRatio },
  { name: "distFrom24hHigh%", extract: t => t.distFrom24hHighPct },
  { name: "distFrom24hLow%", extract: t => t.distFrom24hLowPct },
  { name: "rangePos24h (0=low,1=hi)", extract: t => t.rangePosition },
  { name: "distFrom7dHigh%", extract: t => t.distFrom7dHighPct },
  { name: "rangePos7d", extract: t => t.rangePosition7d },
  { name: "brokeAbove24hHigh", extract: t => t.brokeAbove24hHigh ? 1 : 0 },
  { name: "retraceFromPump%", extract: t => t.retraceFromPumpPct },
  { name: "priorPumps48h", extract: t => t.priorPumps48h },
  { name: "distFromEma20%", extract: t => t.distFromEma20Pct },
  { name: "roc12h%", extract: t => t.roc12h },
  { name: "pumpVsATR ratio", extract: t => t.pumpVsAtrRatio },
  { name: "holdMinutes", extract: t => t.holdMinutes },
];

for (const f of features) {
  const wVals = wins.map(f.extract);
  const lVals = losses.map(f.extract);
  const wAvg = avg(wVals);
  const lAvg = avg(lVals);
  const wMed = med(wVals);
  const lMed = med(lVals);
  const delta = Math.abs(wAvg - lAvg);
  const relDelta = Math.max(Math.abs(wAvg), Math.abs(lAvg)) > 0
    ? delta / Math.max(Math.abs(wAvg), Math.abs(lAvg)) * 100 : 0;
  const signal = relDelta > 25 ? "<<<" : relDelta > 15 ? "<<" : relDelta > 8 ? "<" : "";
  console.log(
    `${f.name.padEnd(30)} ${wAvg.toFixed(3).padStart(9)} ${wMed.toFixed(3).padStart(9)} ${lAvg.toFixed(3).padStart(9)} ${lMed.toFixed(3).padStart(9)} ${delta.toFixed(3).padStart(9)} ${signal}`
  );
}

// ── Breakout analysis: broke24h high vs not ──
console.log(`\n${"═".repeat(100)}`);
console.log("BREAKOUT ANALYSIS: Did pump break above prior 24h high?");
console.log("─".repeat(60));
const broke = analyzed.filter(t => t.brokeAbove24hHigh);
const noBroke = analyzed.filter(t => !t.brokeAbove24hHigh);
const brokeWins = broke.filter(t => t.outcome === "tp").length;
const noBrokeWins = noBroke.filter(t => t.outcome === "tp").length;
const brokeLoss = broke.filter(t => t.outcome === "stop").length;
const noBrokeLoss = noBroke.filter(t => t.outcome === "stop").length;
const brokePnl = broke.reduce((s, t) => s + t.pnl, 0);
const noBrokePnl = noBroke.reduce((s, t) => s + t.pnl, 0);
console.log(`  Broke 24h high:  N=${broke.length}  W=${brokeWins}  L=${brokeLoss}  WR=${(brokeWins / broke.length * 100).toFixed(1)}%  PnL=$${brokePnl >= 0 ? "+" : ""}${brokePnl.toFixed(0)}  $/t=$${(brokePnl / broke.length).toFixed(1)}`);
console.log(`  No breakout:     N=${noBroke.length}  W=${noBrokeWins}  L=${noBrokeLoss}  WR=${(noBrokeWins / noBroke.length * 100).toFixed(1)}%  PnL=$${noBrokePnl >= 0 ? "+" : ""}${noBrokePnl.toFixed(0)}  $/t=$${(noBrokePnl / noBroke.length).toFixed(1)}`);

// ── Range position buckets ──
console.log(`\n${"═".repeat(100)}`);
console.log("RANGE POSITION — 24h: where was entry in the prior 24h range?");
console.log("─".repeat(80));
const buckets24h = [
  { label: "Bottom 25% (0.00-0.25)", min: 0, max: 0.25 },
  { label: "Low-mid   (0.25-0.50)", min: 0.25, max: 0.50 },
  { label: "High-mid  (0.50-0.75)", min: 0.50, max: 0.75 },
  { label: "Top 25%   (0.75-1.00)", min: 0.75, max: 1.00 },
  { label: "Above range (>1.00)", min: 1.00, max: 99 },
];
for (const b of buckets24h) {
  const bucket = analyzed.filter(t => t.rangePosition >= b.min && t.rangePosition < b.max);
  if (bucket.length === 0) continue;
  const bw = bucket.filter(t => t.outcome === "tp").length;
  const bl = bucket.filter(t => t.outcome === "stop").length;
  const bp = bucket.reduce((s, t) => s + t.pnl, 0);
  console.log(`  ${b.label.padEnd(28)} N=${String(bucket.length).padEnd(4)} W=${String(bw).padEnd(4)} L=${String(bl).padEnd(4)} WR=${(bw / bucket.length * 100).toFixed(0).padStart(3)}%  PnL=$${bp >= 0 ? "+" : ""}${bp.toFixed(0).padStart(6)}  $/t=$${(bp / bucket.length).toFixed(1)}`);
}

// ── Range position 7d ──
console.log(`\n${"═".repeat(100)}`);
console.log("RANGE POSITION — 7d: where was entry in the prior 7-day range?");
console.log("─".repeat(80));
const buckets7d = [
  { label: "Bottom 25%  (0.00-0.25)", min: 0, max: 0.25 },
  { label: "Low-mid     (0.25-0.50)", min: 0.25, max: 0.50 },
  { label: "High-mid    (0.50-0.75)", min: 0.50, max: 0.75 },
  { label: "Top 25%     (0.75-1.00)", min: 0.75, max: 1.00 },
  { label: "Above range (>1.00)", min: 1.00, max: 99 },
];
for (const b of buckets7d) {
  const bucket = analyzed.filter(t => t.rangePosition7d >= b.min && t.rangePosition7d < b.max);
  if (bucket.length === 0) continue;
  const bw = bucket.filter(t => t.outcome === "tp").length;
  const bl = bucket.filter(t => t.outcome === "stop").length;
  const bp = bucket.reduce((s, t) => s + t.pnl, 0);
  console.log(`  ${b.label.padEnd(28)} N=${String(bucket.length).padEnd(4)} W=${String(bw).padEnd(4)} L=${String(bl).padEnd(4)} WR=${(bw / bucket.length * 100).toFixed(0).padStart(3)}%  PnL=$${bp >= 0 ? "+" : ""}${bp.toFixed(0).padStart(6)}  $/t=$${(bp / bucket.length).toFixed(1)}`);
}

// ── Volume spike buckets ──
console.log(`\n${"═".repeat(100)}`);
console.log("VOLUME SPIKE — pump bar volume vs 20-bar average");
console.log("─".repeat(80));
const volBuckets = [
  { label: "Low vol   (<1.0x)", min: 0, max: 1.0 },
  { label: "Normal    (1.0-2.0x)", min: 1.0, max: 2.0 },
  { label: "Elevated  (2.0-3.0x)", min: 2.0, max: 3.0 },
  { label: "High      (3.0-5.0x)", min: 3.0, max: 5.0 },
  { label: "Extreme   (>5.0x)", min: 5.0, max: 999 },
];
for (const b of volBuckets) {
  const bucket = analyzed.filter(t => t.pumpVolRatio >= b.min && t.pumpVolRatio < b.max);
  if (bucket.length === 0) continue;
  const bw = bucket.filter(t => t.outcome === "tp").length;
  const bl = bucket.filter(t => t.outcome === "stop").length;
  const bp = bucket.reduce((s, t) => s + t.pnl, 0);
  console.log(`  ${b.label.padEnd(28)} N=${String(bucket.length).padEnd(4)} W=${String(bw).padEnd(4)} L=${String(bl).padEnd(4)} WR=${(bw / bucket.length * 100).toFixed(0).padStart(3)}%  PnL=$${bp >= 0 ? "+" : ""}${bp.toFixed(0).padStart(6)}  $/t=$${(bp / bucket.length).toFixed(1)}`);
}

// ── Pump vs ATR ──
console.log(`\n${"═".repeat(100)}`);
console.log("PUMP vs ATR — how big was the pump relative to normal volatility?");
console.log("─".repeat(80));
const atrBuckets = [
  { label: "Small  (<1.5x ATR)", min: 0, max: 1.5 },
  { label: "Normal (1.5-2.5x)", min: 1.5, max: 2.5 },
  { label: "Large  (2.5-4.0x)", min: 2.5, max: 4.0 },
  { label: "Huge   (>4.0x)", min: 4.0, max: 999 },
];
for (const b of atrBuckets) {
  const bucket = analyzed.filter(t => t.pumpVsAtrRatio >= b.min && t.pumpVsAtrRatio < b.max);
  if (bucket.length === 0) continue;
  const bw = bucket.filter(t => t.outcome === "tp").length;
  const bl = bucket.filter(t => t.outcome === "stop").length;
  const bp = bucket.reduce((s, t) => s + t.pnl, 0);
  console.log(`  ${b.label.padEnd(28)} N=${String(bucket.length).padEnd(4)} W=${String(bw).padEnd(4)} L=${String(bl).padEnd(4)} WR=${(bw / bucket.length * 100).toFixed(0).padStart(3)}%  PnL=$${bp >= 0 ? "+" : ""}${bp.toFixed(0).padStart(6)}  $/t=$${(bp / bucket.length).toFixed(1)}`);
}

// ── Retrace from pump high ──
console.log(`\n${"═".repeat(100)}`);
console.log("RETRACE — how much did price pull back from pump high before entry?");
console.log("─".repeat(80));
const retBuckets = [
  { label: "Tiny   (<0.5%)", min: -99, max: 0.5 },
  { label: "Small  (0.5-1.5%)", min: 0.5, max: 1.5 },
  { label: "Medium (1.5-3.0%)", min: 1.5, max: 3.0 },
  { label: "Deep   (>3.0%)", min: 3.0, max: 99 },
];
for (const b of retBuckets) {
  const bucket = analyzed.filter(t => t.retraceFromPumpPct >= b.min && t.retraceFromPumpPct < b.max);
  if (bucket.length === 0) continue;
  const bw = bucket.filter(t => t.outcome === "tp").length;
  const bl = bucket.filter(t => t.outcome === "stop").length;
  const bp = bucket.reduce((s, t) => s + t.pnl, 0);
  console.log(`  ${b.label.padEnd(28)} N=${String(bucket.length).padEnd(4)} W=${String(bw).padEnd(4)} L=${String(bl).padEnd(4)} WR=${(bw / bucket.length * 100).toFixed(0).padStart(3)}%  PnL=$${bp >= 0 ? "+" : ""}${bp.toFixed(0).padStart(6)}  $/t=$${(bp / bucket.length).toFixed(1)}`);
}

// ── 12h momentum ──
console.log(`\n${"═".repeat(100)}`);
console.log("12H MOMENTUM — was this pump part of a larger move?");
console.log("─".repeat(80));
const rocBuckets = [
  { label: "Strong down (<-5%)", min: -99, max: -5 },
  { label: "Mild down  (-5 to -2%)", min: -5, max: -2 },
  { label: "Flat       (-2 to +2%)", min: -2, max: 2 },
  { label: "Mild up    (+2 to +5%)", min: 2, max: 5 },
  { label: "Strong up  (>+5%)", min: 5, max: 99 },
];
for (const b of rocBuckets) {
  const bucket = analyzed.filter(t => t.roc12h >= b.min && t.roc12h < b.max);
  if (bucket.length === 0) continue;
  const bw = bucket.filter(t => t.outcome === "tp").length;
  const bl = bucket.filter(t => t.outcome === "stop").length;
  const bp = bucket.reduce((s, t) => s + t.pnl, 0);
  console.log(`  ${b.label.padEnd(28)} N=${String(bucket.length).padEnd(4)} W=${String(bw).padEnd(4)} L=${String(bl).padEnd(4)} WR=${(bw / bucket.length * 100).toFixed(0).padStart(3)}%  PnL=$${bp >= 0 ? "+" : ""}${bp.toFixed(0).padStart(6)}  $/t=$${(bp / bucket.length).toFixed(1)}`);
}

// ── Distance from EMA20 ──
console.log(`\n${"═".repeat(100)}`);
console.log("DIST FROM EMA20 — how extended was price from short-term mean?");
console.log("─".repeat(80));
const emaBuckets = [
  { label: "Below EMA20 (<0%)", min: -99, max: 0 },
  { label: "Slightly above (0-2%)", min: 0, max: 2 },
  { label: "Extended (2-5%)", min: 2, max: 5 },
  { label: "Very extended (>5%)", min: 5, max: 99 },
];
for (const b of emaBuckets) {
  const bucket = analyzed.filter(t => t.distFromEma20Pct >= b.min && t.distFromEma20Pct < b.max);
  if (bucket.length === 0) continue;
  const bw = bucket.filter(t => t.outcome === "tp").length;
  const bl = bucket.filter(t => t.outcome === "stop").length;
  const bp = bucket.reduce((s, t) => s + t.pnl, 0);
  console.log(`  ${b.label.padEnd(28)} N=${String(bucket.length).padEnd(4)} W=${String(bw).padEnd(4)} L=${String(bl).padEnd(4)} WR=${(bw / bucket.length * 100).toFixed(0).padStart(3)}%  PnL=$${bp >= 0 ? "+" : ""}${bp.toFixed(0).padStart(6)}  $/t=$${(bp / bucket.length).toFixed(1)}`);
}

// ── Clustering ──
console.log(`\n${"═".repeat(100)}`);
console.log("CLUSTERING — prior PF0 signals in last 48h");
console.log("─".repeat(80));
for (let c = 0; c <= 3; c++) {
  const bucket = analyzed.filter(t => c < 3 ? t.priorPumps48h === c : t.priorPumps48h >= c);
  if (bucket.length === 0) continue;
  const bw = bucket.filter(t => t.outcome === "tp").length;
  const bl = bucket.filter(t => t.outcome === "stop").length;
  const bp = bucket.reduce((s, t) => s + t.pnl, 0);
  const label = c < 3 ? `${c} prior signals` : `${c}+ prior signals`;
  console.log(`  ${label.padEnd(28)} N=${String(bucket.length).padEnd(4)} W=${String(bw).padEnd(4)} L=${String(bl).padEnd(4)} WR=${(bw / bucket.length * 100).toFixed(0).padStart(3)}%  PnL=$${bp >= 0 ? "+" : ""}${bp.toFixed(0).padStart(6)}  $/t=$${(bp / bucket.length).toFixed(1)}`);
}

// ── Pump body size ──
console.log(`\n${"═".repeat(100)}`);
console.log("PUMP BODY SIZE — how aggressive was the pump candle?");
console.log("─".repeat(80));
const bodyBuckets = [
  { label: "Min pump  (2.0-3.0%)", min: 2.0, max: 3.0 },
  { label: "Medium    (3.0-5.0%)", min: 3.0, max: 5.0 },
  { label: "Large     (5.0-8.0%)", min: 5.0, max: 8.0 },
  { label: "Monster   (>8.0%)", min: 8.0, max: 99 },
];
for (const b of bodyBuckets) {
  const bucket = analyzed.filter(t => t.pumpBodyPct >= b.min && t.pumpBodyPct < b.max);
  if (bucket.length === 0) continue;
  const bw = bucket.filter(t => t.outcome === "tp").length;
  const bl = bucket.filter(t => t.outcome === "stop").length;
  const bp = bucket.reduce((s, t) => s + t.pnl, 0);
  console.log(`  ${b.label.padEnd(28)} N=${String(bucket.length).padEnd(4)} W=${String(bw).padEnd(4)} L=${String(bl).padEnd(4)} WR=${(bw / bucket.length * 100).toFixed(0).padStart(3)}%  PnL=$${bp >= 0 ? "+" : ""}${bp.toFixed(0).padStart(6)}  $/t=$${(bp / bucket.length).toFixed(1)}`);
}

// ── Combined best filter candidates ──
console.log(`\n${"═".repeat(100)}`);
console.log("COMBINED FILTER CANDIDATES");
console.log("─".repeat(80));

const filterCandidates: { name: string; test: (t: AnalyzedTrade) => boolean }[] = [
  { name: "baseline (all)", test: () => true },
  { name: "broke24h + retrace>1.5%", test: t => t.brokeAbove24hHigh && t.retraceFromPumpPct >= 1.5 },
  { name: "rangePos24h > 0.75", test: t => t.rangePosition > 0.75 },
  { name: "rangePos7d > 0.50", test: t => t.rangePosition7d > 0.50 },
  { name: "pumpVol > 2x + retrace>1%", test: t => t.pumpVolRatio > 2 && t.retraceFromPumpPct >= 1.0 },
  { name: "distEma20 > 2% (extended)", test: t => t.distFromEma20Pct > 2 },
  { name: "roc12h > 2% (momentum)", test: t => t.roc12h > 2 },
  { name: "pumpATR > 2.5x", test: t => t.pumpVsAtrRatio > 2.5 },
  { name: "body>3% + retrace>1.5%", test: t => t.pumpBodyPct > 3 && t.retraceFromPumpPct >= 1.5 },
  { name: "extended+broke (ema20>2% & broke24h)", test: t => t.distFromEma20Pct > 2 && t.brokeAbove24hHigh },
  { name: "NO broke24h (range pump)", test: t => !t.brokeAbove24hHigh },
  { name: "retrace > 2%", test: t => t.retraceFromPumpPct > 2 },
  { name: "retrace > 1% + roc12h > 0", test: t => t.retraceFromPumpPct > 1 && t.roc12h > 0 },
];

const DISC_END = new Date("2026-01-01").getTime();
console.log(`${"Filter".padEnd(38)} ${"N".padEnd(5)} ${"W".padEnd(5)} ${"L".padEnd(5)} ${"WR%".padEnd(7)} ${"Total$".padEnd(10)} ${"$/t".padEnd(9)} ${"ValN".padEnd(6)} ${"Val$".padEnd(9)} ${"V$/t".padEnd(9)}`);
console.log("─".repeat(100));

for (const fc of filterCandidates) {
  const passing = analyzed.filter(fc.test);
  const w = passing.filter(t => t.outcome === "tp").length;
  const l = passing.filter(t => t.outcome === "stop").length;
  const n = passing.length;
  const p = passing.reduce((s, t) => s + t.pnl, 0);
  const val = passing.filter(t => t.ts >= DISC_END);
  const vp = val.reduce((s, t) => s + t.pnl, 0);
  const vw = val.filter(t => t.outcome === "tp").length;
  console.log(
    `${fc.name.padEnd(38)} ${String(n).padEnd(5)} ${String(w).padEnd(5)} ${String(l).padEnd(5)} ` +
    `${(n > 0 ? (w / n * 100).toFixed(1) : "0.0").padEnd(7)} ` +
    `$${(p >= 0 ? "+" : "") + p.toFixed(0)}`.padEnd(10) + ` ` +
    `$${(n > 0 ? (p / n).toFixed(1) : "0.0")}`.padEnd(9) + ` ` +
    `${String(val.length).padEnd(6)} ` +
    `$${(vp >= 0 ? "+" : "") + vp.toFixed(0)}`.padEnd(9) + ` ` +
    `$${(val.length > 0 ? (vp / val.length).toFixed(1) : "0.0")}`
  );
}
