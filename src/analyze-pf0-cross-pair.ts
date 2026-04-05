// analyze-pf0-cross-pair.ts — Test PF0 signal across all available pairs
//
// Uses immediate entry (best timing from HYPE analysis).
// Tests top TP/stop combos: 1.0/2.0, 1.5/2.0, 1.5/3.0
// Reports discovery vs validation, all vs bear regime.
//
// Run: npx ts-node src/analyze-pf0-cross-pair.ts

import fs from "fs";
import path from "path";
import { EMA, SMA } from "technicalindicators";

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

const DATA_DIR = path.resolve(__dirname, "../data/vps");
const OUT_PATH = path.resolve(__dirname, "../research/pf0-cross-pair-results.md");
const DISCOVERY_END_TS = new Date("2026-01-01T00:00:00Z").getTime();
const FEE_RT_PCT = 0.11;
const MAX_HOLD_1M = 720; // 12h

const TP_STOP_GRID = [
  { tpPct: 1.0, stopPct: 2.0 },
  { tpPct: 1.5, stopPct: 2.0 },
  { tpPct: 1.5, stopPct: 3.0 },
];

// ── Helpers ──────────────────────────────────────────────────────────────
function aligned(values: number[], len: number): (number | null)[] {
  const out: (number | null)[] = new Array(len).fill(null);
  const off = len - values.length;
  for (let i = 0; i < values.length; i++) out[i + off] = values[i];
  return out;
}

function aggregate(bars1m: Candle[], periodMin: number): Candle[] {
  const periodMs = periodMin * 60000;
  const buckets = new Map<number, Candle>();
  for (const c of bars1m) {
    const ts = Math.floor(c.timestamp / periodMs) * periodMs;
    const ex = buckets.get(ts);
    if (!ex) {
      buckets.set(ts, { ...c, timestamp: ts });
    } else {
      ex.high = Math.max(ex.high, c.high);
      ex.low = Math.min(ex.low, c.low);
      ex.close = c.close;
      ex.volume += c.volume;
      ex.turnover += c.turnover;
    }
  }
  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function bsearch(arr: number[], target: number): number {
  let lo = 0, hi = arr.length - 1, res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= target) { res = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return res;
}

// ── Signal detection ─────────────────────────────────────────────────────
interface PF0Signal {
  ts: number;
  entryPrice: number;
  bearRegime: boolean;
}

function findPF0(
  bars1h: Candle[],
  ema50: (number | null)[],
  ema200: (number | null)[],
): PF0Signal[] {
  const signals: PF0Signal[] = [];
  let lastSignalTs = 0; // de-clustering: min 2h between signals

  for (let i = 3; i < bars1h.length - 4; i++) {
    const bar = bars1h[i];
    const bodyPct = ((bar.close - bar.open) / bar.open) * 100;
    if (bodyPct < 2.0) continue;

    const pumpHigh = bar.high;
    let failed = true;
    const lookEnd = Math.min(i + 3, bars1h.length - 1);
    for (let j = i + 1; j <= lookEnd; j++) {
      if (bars1h[j].high > pumpHigh * 1.003) { failed = false; break; }
    }
    if (!failed) continue;

    // Need at least one red bar in the window (confirmation that pump stalled)
    let hasRedConfirm = false;
    for (let j = i + 1; j <= lookEnd; j++) {
      if (bars1h[j].close < bars1h[j].open) { hasRedConfirm = true; break; }
    }
    if (!hasRedConfirm) continue;

    // BIAS FIX: Enter at close of LAST bar in lookback window (bar i+3),
    // not at confirmation bar. This is what the live bot actually sees —
    // it can only confirm the full failure after the entire window completes.
    const entryIdx = lookEnd;
    const entryBar = bars1h[entryIdx];

    // De-clustering: skip if within 2h of last signal
    if (entryBar.timestamp - lastSignalTs < 2 * 3600000) continue;

    const bear = ema50[entryIdx] !== null && ema200[entryIdx] !== null
      && ema50[entryIdx]! < ema200[entryIdx]!;

    signals.push({
      ts: entryBar.timestamp,
      entryPrice: entryBar.close,
      bearRegime: bear,
    });
    lastSignalTs = entryBar.timestamp;
  }
  return signals;
}

// ── Path sim (short, immediate entry) ────────────────────────────────────
interface TradeResult {
  outcome: "tp" | "stop" | "flat";
  pnlPct: number;
}

function simShort(
  bars1m: Candle[],
  ts1m: number[],
  signalTs: number,
  entryPrice: number,
  tpPct: number,
  stopPct: number,
): TradeResult | null {
  // Find entry point in 1m data (end of 1H bar)
  const entryIdx = bsearch(ts1m, signalTs + 3600000);
  if (entryIdx < 0 || entryIdx >= bars1m.length - 10) return null;

  const tpPrice = entryPrice * (1 - tpPct / 100);
  const stopPrice = entryPrice * (1 + stopPct / 100);
  const maxIdx = Math.min(entryIdx + MAX_HOLD_1M, bars1m.length - 1);

  for (let j = entryIdx + 1; j <= maxIdx; j++) {
    if (bars1m[j].high >= stopPrice) return { outcome: "stop", pnlPct: -stopPct - FEE_RT_PCT };
    if (bars1m[j].low <= tpPrice) return { outcome: "tp", pnlPct: tpPct - FEE_RT_PCT };
  }

  const exitPrice = bars1m[maxIdx].close;
  const pnl = ((entryPrice - exitPrice) / entryPrice) * 100 - FEE_RT_PCT;
  return { outcome: "flat", pnlPct: pnl };
}

// ── Slice stats ──────────────────────────────────────────────────────────
interface SliceResult {
  n: number;
  triggered: number;
  wins: number;
  losses: number;
  flats: number;
  wrPct: number;
  expPct: number;
  totalPnlPct: number;
}

function computeSlice(
  signals: PF0Signal[],
  bars1m: Candle[],
  ts1m: number[],
  tpPct: number,
  stopPct: number,
): SliceResult {
  let triggered = 0, wins = 0, losses = 0, flats = 0, totalPnl = 0;
  for (const sig of signals) {
    const r = simShort(bars1m, ts1m, sig.ts, sig.entryPrice, tpPct, stopPct);
    if (!r) continue;
    triggered++;
    totalPnl += r.pnlPct;
    if (r.outcome === "tp") wins++;
    else if (r.outcome === "stop") losses++;
    else flats++;
  }
  return {
    n: signals.length,
    triggered,
    wins, losses, flats,
    wrPct: triggered > 0 ? (wins / triggered) * 100 : 0,
    expPct: triggered > 0 ? totalPnl / triggered : 0,
    totalPnlPct: totalPnl,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────
function main() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith("_1_full.json"));
  const symbols = files.map(f => f.replace("_1_full.json", "")).sort();

  console.log(`Found ${symbols.length} symbols with 1m data\n`);

  const sections: string[] = [];
  sections.push("# PF0 Cross-Pair Analysis\n\n");
  sections.push(`Generated: ${new Date().toISOString().slice(0, 16)} UTC\n\n`);
  sections.push("Signal: 1H pump body >= 2%, failed continuation (high not exceeded by > 0.3% in 3 bars), at least one red bar.\n");
  sections.push("Entry: at close of bar i+3 (end of lookback window) — NO look-ahead. De-clustered (2h min gap).\n");
  sections.push("Max hold: 12h. Fee: 0.11% RT.\n\n");

  // Summary table
  sections.push("## Summary — Best combo per symbol\n\n");
  sections.push("| Symbol | 1m Candles | Range | PF0 Signals | Best TP/Stop | Val All N | Val WR | Val Exp% | Disc N | Disc Exp% |\n");
  sections.push("|--------|-----------|-------|-------------|-------------|----------|--------|----------|--------|----------|\n");

  const allResults: {
    symbol: string;
    candles: number;
    range: string;
    totalSignals: number;
    bestCombo: string;
    valAll: SliceResult;
    valBear: SliceResult;
    discAll: SliceResult;
    discBear: SliceResult;
  }[] = [];

  for (const symbol of symbols) {
    const filepath = path.join(DATA_DIR, `${symbol}_1_full.json`);
    process.stdout.write(`${symbol}: loading...`);

    const bars1m: Candle[] = JSON.parse(fs.readFileSync(filepath, "utf-8"));
    bars1m.sort((a, b) => a.timestamp - b.timestamp);

    if (bars1m.length < 10000) {
      console.log(` only ${bars1m.length} candles, skipping`);
      continue;
    }

    const range = `${new Date(bars1m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(bars1m[bars1m.length - 1].timestamp).toISOString().slice(0, 10)}`;
    process.stdout.write(` ${bars1m.length} candles | `);

    // Aggregate to 1H
    const bars1h = aggregate(bars1m, 60);
    const closes1h = bars1h.map(b => b.close);

    if (bars1h.length < 210) {
      console.log(`only ${bars1h.length} 1H bars (need 210 for EMA200), skipping`);
      continue;
    }

    const ema50 = aligned(EMA.calculate({ period: 50, values: closes1h }), bars1h.length);
    const ema200 = aligned(EMA.calculate({ period: 200, values: closes1h }), bars1h.length);

    const ts1m = bars1m.map(b => b.timestamp);

    // Find signals
    const allSigs = findPF0(bars1h, ema50, ema200);
    const discSigs = allSigs.filter(s => s.ts < DISCOVERY_END_TS);
    const valSigs = allSigs.filter(s => s.ts >= DISCOVERY_END_TS);
    const valBearSigs = valSigs.filter(s => s.bearRegime);
    const discBearSigs = discSigs.filter(s => s.bearRegime);

    process.stdout.write(`${allSigs.length} signals | `);

    // Find best combo on validation all
    let bestValAll: SliceResult | null = null;
    let bestComboStr = "";
    for (const grid of TP_STOP_GRID) {
      const r = computeSlice(valSigs, bars1m, ts1m, grid.tpPct, grid.stopPct);
      if (r.triggered >= 3 && (!bestValAll || r.expPct > bestValAll.expPct)) {
        bestValAll = r;
        bestComboStr = `${grid.tpPct}/${grid.stopPct}`;
      }
    }

    // Compute all slices at best combo (or default 1.0/2.0)
    const bestTp = bestValAll ? parseFloat(bestComboStr.split("/")[0]) : 1.0;
    const bestStop = bestValAll ? parseFloat(bestComboStr.split("/")[1]) : 2.0;
    if (!bestComboStr) bestComboStr = "1.0/2.0";

    const valAll = computeSlice(valSigs, bars1m, ts1m, bestTp, bestStop);
    const valBear = computeSlice(valBearSigs, bars1m, ts1m, bestTp, bestStop);
    const discAll = computeSlice(discSigs, bars1m, ts1m, bestTp, bestStop);
    const discBear = computeSlice(discBearSigs, bars1m, ts1m, bestTp, bestStop);

    allResults.push({
      symbol, candles: bars1m.length, range, totalSignals: allSigs.length,
      bestCombo: bestComboStr, valAll, valBear, discAll, discBear,
    });

    const expStr = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(3)}%`;
    console.log(`val=${valAll.triggered}/${valSigs.length} WR=${valAll.wrPct.toFixed(0)}% exp=${expStr(valAll.expPct)} | disc=${discAll.triggered}/${discSigs.length} exp=${expStr(discAll.expPct)}`);

    sections.push(`| ${symbol} | ${bars1m.length.toLocaleString()} | ${range} | ${allSigs.length} | ${bestComboStr} | ${valAll.triggered} | ${valAll.wrPct.toFixed(1)}% | ${expStr(valAll.expPct)} | ${discAll.triggered} | ${expStr(discAll.expPct)} |\n`);
  }

  // Detailed per-symbol tables
  sections.push("\n## Detailed Results\n\n");
  for (const r of allResults) {
    sections.push(`### ${r.symbol}\n\n`);
    sections.push(`Data: ${r.candles.toLocaleString()} 1m candles (${r.range})\n\n`);
    sections.push("| Slice | TP/Stop | N | Triggered | Wins | Losses | Flats | WR% | Exp% | Total PnL% |\n");
    sections.push("|-------|---------|---|-----------|------|--------|-------|-----|------|------------|\n");

    const symbol = r.symbol;
    const filepath = path.join(DATA_DIR, `${symbol}_1_full.json`);
    const bars1m: Candle[] = JSON.parse(fs.readFileSync(filepath, "utf-8"));
    bars1m.sort((a, b) => a.timestamp - b.timestamp);
    const bars1h = aggregate(bars1m, 60);
    const closes1h = bars1h.map(b => b.close);
    const ema50 = aligned(EMA.calculate({ period: 50, values: closes1h }), bars1h.length);
    const ema200 = aligned(EMA.calculate({ period: 200, values: closes1h }), bars1h.length);
    const ts1m = bars1m.map(b => b.timestamp);

    const allSigs = findPF0(bars1h, ema50, ema200);
    const slices: { label: string; sigs: PF0Signal[] }[] = [
      { label: "Val All", sigs: allSigs.filter(s => s.ts >= DISCOVERY_END_TS) },
      { label: "Val Bear", sigs: allSigs.filter(s => s.ts >= DISCOVERY_END_TS && s.bearRegime) },
      { label: "Disc All", sigs: allSigs.filter(s => s.ts < DISCOVERY_END_TS) },
      { label: "Disc Bear", sigs: allSigs.filter(s => s.ts < DISCOVERY_END_TS && s.bearRegime) },
    ];

    for (const grid of TP_STOP_GRID) {
      for (const { label, sigs } of slices) {
        const s = computeSlice(sigs, bars1m, ts1m, grid.tpPct, grid.stopPct);
        if (s.triggered === 0) continue;
        const exp = `${s.expPct >= 0 ? "+" : ""}${s.expPct.toFixed(3)}%`;
        const tot = `${s.totalPnlPct >= 0 ? "+" : ""}${s.totalPnlPct.toFixed(2)}%`;
        sections.push(`| ${label} | ${grid.tpPct}/${grid.stopPct} | ${s.n} | ${s.triggered} | ${s.wins} | ${s.losses} | ${s.flats} | ${s.wrPct.toFixed(1)}% | ${exp} | ${tot} |\n`);
      }
    }
    sections.push("\n");
  }

  // Verdict section
  sections.push("## Verdict\n\n");
  sections.push("Symbols sorted by validation-all expectancy (best combo):\n\n");
  const sorted = [...allResults].sort((a, b) => b.valAll.expPct - a.valAll.expPct);
  sections.push("| Rank | Symbol | Val Exp% | Val WR% | Val N | Disc Exp% | Disc N | Verdict |\n");
  sections.push("|------|--------|----------|---------|-------|-----------|--------|---------|\n");
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const valPos = r.valAll.expPct > 0;
    const discPos = r.discAll.expPct > 0;
    const valN = r.valAll.triggered >= 5;
    let verdict = "SKIP";
    if (valPos && discPos && valN) verdict = "STRONG";
    else if (valPos && valN) verdict = "VAL ONLY";
    else if (valPos && !valN) verdict = "LOW N";
    else if (discPos) verdict = "DISC ONLY";
    const exp = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(3)}%`;
    sections.push(`| ${i + 1} | ${r.symbol} | ${exp(r.valAll.expPct)} | ${r.valAll.wrPct.toFixed(1)}% | ${r.valAll.triggered} | ${exp(r.discAll.expPct)} | ${r.discAll.triggered} | ${verdict} |\n`);
  }

  fs.writeFileSync(OUT_PATH, sections.join(""));
  console.log(`\nResults written to ${OUT_PATH}`);
}

main();
