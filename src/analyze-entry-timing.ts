// analyze-entry-timing.ts — PF0 & LH5 entry timing refinement using 1m data
//
// Tests 5 execution timing methods within surviving 1H signal contexts:
//   1. immediate  — short at 1H signal bar close
//   2. 1m_first_red — first 1m red close after signal
//   3. 1m_break_low — first 1m close below signal bar low
//   4. 1m_first_ll — first 1m lower-low (lower low + lower close)
//   5. 5m_first_red — first 5m red close after signal
//
// Uses same holdout split and regime filter as analyze-short-signals.ts
// Run: npx ts-node src/analyze-entry-timing.ts

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

// ── Config ──────────────────────────────────────────────────────────────────
const DISCOVERY_END_TS = new Date("2026-01-01T00:00:00Z").getTime();
const FEE_RT_PCT = 0.11;
const MAX_HOLD_BARS_1M = 720;        // 12h in 1m bars
const MAX_ENTRY_WAIT_1M = 60;        // wait up to 60m for timing entry
const TP_STOP_GRID = [
  { tpPct: 0.75, stopPct: 1.5 },
  { tpPct: 1.0, stopPct: 1.5 },
  { tpPct: 1.0, stopPct: 2.0 },
  { tpPct: 1.5, stopPct: 2.0 },
  { tpPct: 1.5, stopPct: 3.0 },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function aligned(values: number[], totalLength: number): (number | null)[] {
  const out: (number | null)[] = new Array(totalLength).fill(null);
  const offset = totalLength - values.length;
  for (let i = 0; i < values.length; i++) out[i + offset] = values[i];
  return out;
}

function aggregate1mTo(bars1m: Candle[], periodMin: number): Candle[] {
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

function pctBody(bar: Candle): number {
  return ((bar.close - bar.open) / bar.open) * 100;
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

// ── Signal detection ────────────────────────────────────────────────────────
interface Signal1H {
  idx: number;          // index in 1H bars
  ts: number;           // signal bar close timestamp
  entryPrice: number;   // 1H close price
  barLow: number;       // signal bar low
  bearRegime: boolean;
}

function findPF0Signals(
  bars1h: Candle[],
  ema50: (number | null)[],
  ema200: (number | null)[],
): Signal1H[] {
  const signals: Signal1H[] = [];
  for (let i = 3; i < bars1h.length; i++) {
    const bar = bars1h[i];
    const bodyPct = pctBody(bar);
    if (bodyPct < 2.0) continue; // need >= 2% green pump

    // Check next 1-3 bars fail to make new high > 0.3%
    const pumpHigh = bar.high;
    let failed = true;
    const lookEnd = Math.min(i + 3, bars1h.length - 1);
    for (let j = i + 1; j <= lookEnd; j++) {
      if (bars1h[j].high > pumpHigh * 1.003) { failed = false; break; }
    }
    if (!failed) continue;

    // Need first red confirmation bar in next 1-3
    let confirmIdx = -1;
    for (let j = i + 1; j <= lookEnd; j++) {
      if (bars1h[j].close < bars1h[j].open) { confirmIdx = j; break; }
    }
    if (confirmIdx < 0) continue;

    const bear = ema50[confirmIdx] !== null && ema200[confirmIdx] !== null
      && ema50[confirmIdx]! < ema200[confirmIdx]!;

    signals.push({
      idx: confirmIdx,
      ts: bars1h[confirmIdx].timestamp,
      entryPrice: bars1h[confirmIdx].close,
      barLow: bars1h[confirmIdx].low,
      bearRegime: bear,
    });
  }
  return signals;
}

function findLH5Signals(
  bars1h: Candle[],
  ema20: (number | null)[],
  ema50: (number | null)[],
  ema200: (number | null)[],
  volSma20: (number | null)[],
): Signal1H[] {
  const signals: Signal1H[] = [];
  for (let i = 5; i < bars1h.length; i++) {
    const bar = bars1h[i];
    // LH2 base: lower high + close < EMA20 + red bar
    if (bar.close >= bar.open) continue; // need red
    if (ema20[i] === null) continue;
    if (bar.close >= ema20[i]!) continue; // close must be below EMA20

    // Lower high: bar.high < max high of prior 3 bars
    let priorHigh = 0;
    for (let j = i - 3; j < i; j++) priorHigh = Math.max(priorHigh, bars1h[j].high);
    if (bar.high >= priorHigh) continue;

    // LH5 filter: rejection bar volume <= 1.2x SMA20
    if (volSma20[i] === null) continue;
    if (bar.volume > 1.2 * volSma20[i]!) continue;

    const bear = ema50[i] !== null && ema200[i] !== null
      && ema50[i]! < ema200[i]!;

    signals.push({
      idx: i,
      ts: bar.timestamp,
      entryPrice: bar.close,
      barLow: bar.low,
      bearRegime: bear,
    });
  }
  return signals;
}

// ── Entry timing methods ────────────────────────────────────────────────────
type TimingMethod = "immediate" | "1m_first_red" | "1m_break_low" | "1m_first_ll" | "5m_first_red";

interface TimedEntry {
  entryPrice: number;
  entryTs: number;        // actual entry timestamp
  entryIdx1m: number;     // index in 1m bars
}

function findTimedEntry(
  method: TimingMethod,
  signal: Signal1H,
  bars1m: Candle[],
  ts1m: number[],
  bars5m: Candle[],
  ts5m: number[],
): TimedEntry | null {
  if (method === "immediate") {
    // Enter at signal bar close — find corresponding 1m bar
    const idx = bsearch(ts1m, signal.ts + 60000 * 60); // end of the 1H bar
    if (idx < 0) return null;
    return { entryPrice: signal.entryPrice, entryTs: signal.ts, entryIdx1m: idx };
  }

  // Find start of next hour in 1m data
  const signalEndTs = signal.ts + 60000 * 60; // 1H bar spans [ts, ts+60min)
  const startIdx = bsearch(ts1m, signalEndTs);
  if (startIdx < 0 || startIdx >= bars1m.length - MAX_ENTRY_WAIT_1M) return null;

  if (method === "1m_first_red") {
    for (let j = startIdx; j < startIdx + MAX_ENTRY_WAIT_1M && j < bars1m.length; j++) {
      if (bars1m[j].close < bars1m[j].open) {
        return { entryPrice: bars1m[j].close, entryTs: bars1m[j].timestamp, entryIdx1m: j };
      }
    }
    return null;
  }

  if (method === "1m_break_low") {
    for (let j = startIdx; j < startIdx + MAX_ENTRY_WAIT_1M && j < bars1m.length; j++) {
      if (bars1m[j].close < signal.barLow) {
        return { entryPrice: bars1m[j].close, entryTs: bars1m[j].timestamp, entryIdx1m: j };
      }
    }
    return null;
  }

  if (method === "1m_first_ll") {
    // First lower-low: bar.low < prev.low AND bar.close < prev.close
    for (let j = startIdx + 1; j < startIdx + MAX_ENTRY_WAIT_1M && j < bars1m.length; j++) {
      if (bars1m[j].low < bars1m[j - 1].low && bars1m[j].close < bars1m[j - 1].close) {
        return { entryPrice: bars1m[j].close, entryTs: bars1m[j].timestamp, entryIdx1m: j };
      }
    }
    return null;
  }

  if (method === "5m_first_red") {
    const start5m = bsearch(ts5m, signalEndTs);
    if (start5m < 0) return null;
    for (let j = start5m; j < start5m + 12 && j < bars5m.length; j++) {
      if (bars5m[j].close < bars5m[j].open) {
        // Map back to 1m for path sim
        const idx1m = bsearch(ts1m, bars5m[j].timestamp + 5 * 60000);
        if (idx1m < 0) return null;
        return { entryPrice: bars5m[j].close, entryTs: bars5m[j].timestamp, entryIdx1m: idx1m };
      }
    }
    return null;
  }

  return null;
}

// ── Path simulation (short) ─────────────────────────────────────────────────
interface TradeResult {
  outcome: "tp" | "stop" | "flat";
  pnlPct: number;
}

function simShortPath(
  bars1m: Candle[],
  entryIdx: number,
  entryPrice: number,
  tpPct: number,
  stopPct: number,
): TradeResult {
  const tpPrice = entryPrice * (1 - tpPct / 100);
  const stopPrice = entryPrice * (1 + stopPct / 100);
  const maxIdx = Math.min(entryIdx + MAX_HOLD_BARS_1M, bars1m.length - 1);

  for (let j = entryIdx + 1; j <= maxIdx; j++) {
    const bar = bars1m[j];
    // Stop checked first (conservative for shorts)
    if (bar.high >= stopPrice) {
      return { outcome: "stop", pnlPct: -stopPct - FEE_RT_PCT };
    }
    if (bar.low <= tpPrice) {
      return { outcome: "tp", pnlPct: tpPct - FEE_RT_PCT };
    }
  }
  // Flat — exit at last bar close
  const exitPrice = bars1m[maxIdx].close;
  const pnl = ((entryPrice - exitPrice) / entryPrice) * 100 - FEE_RT_PCT;
  return { outcome: "flat", pnlPct: pnl };
}

// ── Stats ───────────────────────────────────────────────────────────────────
interface TimingStats {
  method: TimingMethod;
  tpPct: number;
  stopPct: number;
  n: number;
  triggered: number;
  wins: number;
  losses: number;
  flats: number;
  wrPct: number;
  expectancyPct: number;
  avgDelayMin: number;
}

function computeStats(
  method: TimingMethod,
  signals: Signal1H[],
  bars1m: Candle[],
  ts1m: number[],
  bars5m: Candle[],
  ts5m: number[],
  tpPct: number,
  stopPct: number,
): TimingStats {
  let triggered = 0, wins = 0, losses = 0, flats = 0;
  let totalPnl = 0;
  let totalDelay = 0;

  for (const sig of signals) {
    const entry = findTimedEntry(method, sig, bars1m, ts1m, bars5m, ts5m);
    if (!entry) continue;

    triggered++;
    totalDelay += (entry.entryTs - sig.ts) / 60000;

    const result = simShortPath(bars1m, entry.entryIdx1m, entry.entryPrice, tpPct, stopPct);
    totalPnl += result.pnlPct;
    if (result.outcome === "tp") wins++;
    else if (result.outcome === "stop") losses++;
    else flats++;
  }

  const n = signals.length;
  return {
    method,
    tpPct,
    stopPct,
    n,
    triggered,
    wins,
    losses,
    flats,
    wrPct: triggered > 0 ? (wins / triggered) * 100 : 0,
    expectancyPct: triggered > 0 ? totalPnl / triggered : 0,
    avgDelayMin: triggered > 0 ? totalDelay / triggered : 0,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  const dataDir = path.resolve(__dirname, "../data/vps");
  const outPath = path.resolve(__dirname, "../research/entry-timing-results.md");

  // Load 1m data
  console.log("Loading HYPE 1m data...");
  const hype1m: Candle[] = JSON.parse(fs.readFileSync(path.join(dataDir, "HYPEUSDT_1_full.json"), "utf-8"));
  hype1m.sort((a, b) => a.timestamp - b.timestamp);
  console.log(`  ${hype1m.length} candles: ${new Date(hype1m[0].timestamp).toISOString().slice(0, 16)} → ${new Date(hype1m[hype1m.length - 1].timestamp).toISOString().slice(0, 16)}`);

  // Aggregate to 5m and 1H
  console.log("Aggregating to 5m and 1H...");
  const hype5m = aggregate1mTo(hype1m, 5);
  const hype1h = aggregate1mTo(hype1m, 60);
  console.log(`  5m: ${hype5m.length} bars | 1H: ${hype1h.length} bars`);

  // Compute indicators on 1H
  const closes1h = hype1h.map(b => b.close);
  const ema20 = aligned(EMA.calculate({ period: 20, values: closes1h }), hype1h.length);
  const ema50 = aligned(EMA.calculate({ period: 50, values: closes1h }), hype1h.length);
  const ema200 = aligned(EMA.calculate({ period: 200, values: closes1h }), hype1h.length);
  const volSma20 = aligned(
    SMA.calculate({ period: 20, values: hype1h.map(b => b.volume) }),
    hype1h.length,
  );

  // Timestamp arrays for bsearch
  const ts1m = hype1m.map(b => b.timestamp);
  const ts5m = hype5m.map(b => b.timestamp);

  // Find signals
  console.log("\nFinding PF0 signals...");
  const pf0All = findPF0Signals(hype1h, ema50, ema200);
  const pf0Disc = pf0All.filter(s => s.ts < DISCOVERY_END_TS);
  const pf0Val = pf0All.filter(s => s.ts >= DISCOVERY_END_TS);
  const pf0ValBear = pf0Val.filter(s => s.bearRegime);
  console.log(`  All: ${pf0All.length} | Discovery: ${pf0Disc.length} | Validation: ${pf0Val.length} | Val Bear: ${pf0ValBear.length}`);

  console.log("Finding LH5 signals...");
  const lh5All = findLH5Signals(hype1h, ema20, ema50, ema200, volSma20);
  const lh5Disc = lh5All.filter(s => s.ts < DISCOVERY_END_TS);
  const lh5Val = lh5All.filter(s => s.ts >= DISCOVERY_END_TS);
  const lh5ValBear = lh5Val.filter(s => s.bearRegime);
  console.log(`  All: ${lh5All.length} | Discovery: ${lh5Disc.length} | Validation: ${lh5Val.length} | Val Bear: ${lh5ValBear.length}`);

  const methods: TimingMethod[] = ["immediate", "1m_first_red", "1m_break_low", "1m_first_ll", "5m_first_red"];

  // Run all combos
  const sections: string[] = [];
  sections.push("# Entry Timing Analysis — PF0 & LH5\n");
  sections.push(`Generated: ${new Date().toISOString().slice(0, 16)} UTC\n`);
  sections.push("Holdout: discovery < 2026-01-01, validation >= 2026-01-01\n");
  sections.push(`TP/Stop grid: ${TP_STOP_GRID.map(g => `${g.tpPct}/${g.stopPct}`).join(", ")}\n`);
  sections.push(`Max hold: ${MAX_HOLD_BARS_1M}m (12h) | Max entry wait: ${MAX_ENTRY_WAIT_1M}m\n`);

  const signalSets: { name: string; label: string; signals: Signal1H[] }[] = [
    { name: "PF0", label: "Validation All", signals: pf0Val },
    { name: "PF0", label: "Validation Bear", signals: pf0ValBear },
    { name: "PF0", label: "Discovery All", signals: pf0Disc },
    { name: "LH5", label: "Validation All", signals: lh5Val },
    { name: "LH5", label: "Validation Bear", signals: lh5ValBear },
    { name: "LH5", label: "Discovery All", signals: lh5Disc },
  ];

  for (const { name, label, signals } of signalSets) {
    console.log(`\n--- ${name} / ${label} (N=${signals.length}) ---`);
    sections.push(`\n## ${name} — ${label} (N=${signals.length})\n`);
    sections.push("| Method | TP/Stop | Triggered | Wins | Losses | Flats | WR% | Exp% | Avg Delay |\n");
    sections.push("|--------|---------|-----------|------|--------|-------|-----|------|-----------|\n");

    for (const grid of TP_STOP_GRID) {
      for (const method of methods) {
        const stats = computeStats(method, signals, hype1m, ts1m, hype5m, ts5m, grid.tpPct, grid.stopPct);
        const row = `| ${method} | ${grid.tpPct}/${grid.stopPct} | ${stats.triggered} | ${stats.wins} | ${stats.losses} | ${stats.flats} | ${stats.wrPct.toFixed(1)} | ${stats.expectancyPct >= 0 ? "+" : ""}${stats.expectancyPct.toFixed(3)} | ${stats.avgDelayMin.toFixed(0)}m |`;
        sections.push(row + "\n");
        if (stats.triggered > 0) {
          process.stdout.write(`  ${method} ${grid.tpPct}/${grid.stopPct}: N=${stats.triggered} WR=${stats.wrPct.toFixed(1)}% Exp=${stats.expectancyPct.toFixed(3)}%\n`);
        }
      }
    }
  }

  // Find best rows summary
  sections.push("\n## Best Timing per Signal\n");
  for (const { name, label, signals } of signalSets) {
    let best: TimingStats | null = null;
    for (const grid of TP_STOP_GRID) {
      for (const method of methods) {
        const stats = computeStats(method, signals, hype1m, ts1m, hype5m, ts5m, grid.tpPct, grid.stopPct);
        if (stats.triggered >= 5 && (!best || stats.expectancyPct > best.expectancyPct)) {
          best = stats;
        }
      }
    }
    if (best) {
      sections.push(`**${name} / ${label}**: ${best.method} @ ${best.tpPct}/${best.stopPct} → WR ${best.wrPct.toFixed(1)}%, Exp ${best.expectancyPct >= 0 ? "+" : ""}${best.expectancyPct.toFixed(3)}%, N=${best.triggered}, Delay=${best.avgDelayMin.toFixed(0)}m\n\n`);
    }
  }

  fs.writeFileSync(outPath, sections.join(""));
  console.log(`\nResults written to ${outPath}`);
}

main();
