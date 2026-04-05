// sim-pf0-sui-trend.ts — PF0 SUI with trend filter analysis
// Tests: no filter vs EMA50 block vs EMA200 block vs both
import fs from "fs";
import { BacktestTrade, writeCsv } from "./backtest-writer";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

const bars1m: Candle[] = JSON.parse(fs.readFileSync("data/vps/SUIUSDT_1_full.json", "utf-8"));
bars1m.sort((a, b) => a.timestamp - b.timestamp);
console.log(`SUI 1m: ${bars1m.length} candles | ${new Date(bars1m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(bars1m[bars1m.length - 1].timestamp).toISOString().slice(0, 10)}\n`);

function agg(bars: Candle[], min: number): Candle[] {
  const ms = min * 60000, m = new Map<number, Candle>();
  for (const c of bars) {
    const k = Math.floor(c.timestamp / ms) * ms, e = m.get(k);
    if (!e) m.set(k, { ...c, timestamp: k });
    else { e.high = Math.max(e.high, c.high); e.low = Math.min(e.low, c.low); e.close = c.close; e.volume += c.volume; e.turnover += c.turnover; }
  }
  return [...m.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function emaCalc(vals: number[], p: number): number[] {
  const k = 2 / (p + 1);
  const r = [vals[0]];
  for (let i = 1; i < vals.length; i++) r.push(vals[i] * k + r[i - 1] * (1 - k));
  return r;
}

const bars1h = agg(bars1m, 60);
const bars4h = agg(bars1m, 240);
const ts1m = bars1m.map(b => b.timestamp);

// Precompute EMAs on 1H
const closes1h = bars1h.map(b => b.close);
const ema50_1h = emaCalc(closes1h, 50);
const ema200_1h = emaCalc(closes1h, 200);

// Precompute EMAs on 4H
const closes4h = bars4h.map(b => b.close);
const ema50_4h = emaCalc(closes4h, 50);
const ema200_4h = emaCalc(closes4h, 200);

// Precompute EMA slope (positive = uptrend)
function slope(arr: number[], i: number, lookback: number): number {
  if (i < lookback) return 0;
  return arr[i] - arr[i - lookback];
}

// Map timestamps to indices for lookups
const tsMap1h = new Map<number, number>();
bars1h.forEach((b, i) => tsMap1h.set(b.timestamp, i));
const tsMap4h = new Map<number, number>();
bars4h.forEach((b, i) => tsMap4h.set(b.timestamp, i));

function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

// Find 1H index for a given timestamp
const ts1hArr = bars1h.map(b => b.timestamp);
const ts4hArr = bars4h.map(b => b.timestamp);

function get1hIdx(ts: number): number { return bsearch(ts1hArr, ts); }
function get4hIdx(ts: number): number { return bsearch(ts4hArr, ts); }

// ── Signals ──
interface Sig { ts: number; price: number; }
const signals: Sig[] = [];
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
  signals.push({ ts: bars1h[i].timestamp, price: bars1h[i].close });
  lastSigTs = bars1h[i].timestamp;
}

console.log(`PF0 signals: ${signals.length}\n`);

const NOTIONAL = 5000;
const FEE = 0.0011;
const MAX_HOLD = 720;
const DISC_END = new Date("2026-01-01").getTime();

// ── Filter definitions ──
interface Filter {
  name: string;
  block: (sig: Sig) => boolean; // returns true if trade should be BLOCKED
}

const filters: Filter[] = [
  { name: "none", block: () => false },
  {
    name: "1h_above_ema50",
    block: (sig) => {
      const i = get1hIdx(sig.ts);
      return i > 0 && closes1h[i] > ema50_1h[i]; // price above EMA50 = uptrend = block short
    },
  },
  {
    name: "1h_above_ema200",
    block: (sig) => {
      const i = get1hIdx(sig.ts);
      return i > 0 && closes1h[i] > ema200_1h[i];
    },
  },
  {
    name: "1h_ema50_above_ema200",
    block: (sig) => {
      const i = get1hIdx(sig.ts);
      return i > 0 && ema50_1h[i] > ema200_1h[i]; // golden cross = block short
    },
  },
  {
    name: "4h_above_ema50",
    block: (sig) => {
      const i = get4hIdx(sig.ts);
      return i > 0 && closes4h[i] > ema50_4h[i];
    },
  },
  {
    name: "4h_ema50_rising",
    block: (sig) => {
      const i = get4hIdx(sig.ts);
      return i > 3 && slope(ema50_4h, i, 3) > 0; // EMA50 rising = uptrend
    },
  },
  {
    name: "1h_ema50_rising",
    block: (sig) => {
      const i = get1hIdx(sig.ts);
      return i > 5 && slope(ema50_1h, i, 5) > 0;
    },
  },
  {
    name: "4h_above_ema50+slope",
    block: (sig) => {
      const i = get4hIdx(sig.ts);
      return i > 3 && closes4h[i] > ema50_4h[i] && slope(ema50_4h, i, 3) > 0;
    },
  },
];

// ── Sweep TP/stop combos × filters ──
const combos = [
  { tp: 2.0, sl: 3.0 },
  { tp: 2.5, sl: 3.0 },
  { tp: 2.5, sl: 4.0 },
  { tp: 3.0, sl: 5.0 },
];

const fmt = (v: number) => `$${v >= 0 ? "+" : ""}${v.toFixed(0)}`;
const fmtPt = (v: number) => `$${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

for (const combo of combos) {
  console.log(`\n${"═".repeat(110)}`);
  console.log(`TP=${combo.tp}% / SL=${combo.sl}% — Notional: $${NOTIONAL}`);
  console.log(`${"─".repeat(110)}`);
  console.log(`${"Filter".padEnd(25)} ${"N".padEnd(5)} ${"W".padEnd(5)} ${"L".padEnd(5)} ${"F".padEnd(5)} ${"WR%".padEnd(7)} ${"Total$".padEnd(10)} ${"Blocked".padEnd(8)} ${"BlkLoss".padEnd(8)} ${"DiscN".padEnd(6)} ${"Disc$".padEnd(10)} ${"ValN".padEnd(6)} ${"Val$".padEnd(10)} ${"Val$/t".padEnd(9)}`);
  console.log(`${"─".repeat(110)}`);

  for (const filter of filters) {
    let wins = 0, losses = 0, flats = 0, totalPnl = 0;
    let discPnl = 0, discN = 0, valPnl = 0, valN = 0;
    let blocked = 0, blockedLosses = 0;
    const trades: BacktestTrade[] = [];

    for (const sig of signals) {
      const wouldBlock = filter.block(sig);

      // Sim the trade regardless to count blocked losses
      const entryIdx = bsearch(ts1m, sig.ts + 3600000);
      if (entryIdx < 0 || entryIdx >= bars1m.length - 10) continue;
      const ep = sig.price;
      const tp = ep * (1 - combo.tp / 100);
      const sl = ep * (1 + combo.sl / 100);
      const maxIdx = Math.min(entryIdx + MAX_HOLD, bars1m.length - 1);
      let pnl = 0, outcome = "flat";
      let exitIdx = maxIdx;

      for (let j = entryIdx + 1; j <= maxIdx; j++) {
        if (bars1m[j].high >= sl) { pnl = -combo.sl / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "stop"; exitIdx = j; break; }
        if (bars1m[j].low <= tp) { pnl = combo.tp / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "tp"; exitIdx = j; break; }
      }
      if (outcome === "flat") pnl = ((ep - bars1m[maxIdx].close) / ep) * NOTIONAL - NOTIONAL * FEE;

      if (wouldBlock) {
        blocked++;
        if (pnl < 0) blockedLosses++;
        continue; // skip this trade
      }

      const exitPrice = outcome === "stop" ? sl : outcome === "tp" ? tp : bars1m[maxIdx].close;
      trades.push({
        strategy: "pf0-short", symbol: "SUIUSDT", side: "short",
        entryTime: sig.ts, exitTime: bars1m[exitIdx].timestamp,
        entryPrice: ep, exitPrice,
        notional: NOTIONAL, pnlUsd: pnl, pnlPct: (pnl / NOTIONAL) * 100,
        outcome, feesUsd: NOTIONAL * FEE,
      });

      totalPnl += pnl;
      if (outcome === "tp") wins++; else if (outcome === "stop") losses++; else flats++;
      if (sig.ts < DISC_END) { discPnl += pnl; discN++; }
      else { valPnl += pnl; valN++; }
    }

    const n = wins + losses + flats;
    const wr = n > 0 ? (wins / n * 100).toFixed(1) : "0.0";

    console.log(
      `${filter.name.padEnd(25)} ${String(n).padEnd(5)} ${String(wins).padEnd(5)} ${String(losses).padEnd(5)} ${String(flats).padEnd(5)} ` +
      `${(wr + "%").padEnd(7)} ${fmt(totalPnl).padEnd(10)} ${String(blocked).padEnd(8)} ${String(blockedLosses).padEnd(8)} ` +
      `${String(discN).padEnd(6)} ${fmt(discPnl).padEnd(10)} ${String(valN).padEnd(6)} ${fmt(valPnl).padEnd(10)} ${fmtPt(valN > 0 ? valPnl / valN : 0).padEnd(9)}`
    );

    // Write CSV for the best combos with filters
    if (filter.name !== "none") {
      writeCsv(trades, { strategy: "pf0-trend", symbol: "SUIUSDT", params: { tp: combo.tp, sl: combo.sl, f: filter.name } });
    }
  }
}
