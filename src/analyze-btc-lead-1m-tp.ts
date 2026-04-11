// TP hit rate analysis for BTC→HYPE fresh lag signals
// For each signal, tracks max favorable move in 1m windows up to 30m
// Then computes: at TP=X%, what % of trades hit it within Nm?

import fs from "fs";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

console.log("Loading 1m data...");
const btc1m: Candle[]  = JSON.parse(fs.readFileSync("data/vps/BTCUSDT_1_full.json", "utf-8"));
const hype1m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_1.json", "utf-8"));

const btcIdx  = new Map<number, number>();
const hypeIdx = new Map<number, number>();
btc1m.forEach((c, i)  => btcIdx.set(c.timestamp, i));
hype1m.forEach((c, i) => hypeIdx.set(c.timestamp, i));

const COOLDOWN = 10;
const SEP = "═".repeat(120);
const DIV = "─".repeat(120);

interface Signal {
  ts: number;
  btcMove: number;
  hypeEntry: number;
  // Max upside reached within N minutes (using highs, not closes)
  maxUp: number[];   // index = minutes (0=same bar, 1=+1m, ..., 29=+30m)
  maxDown: number[];
  // Time to reach various TP levels (minutes, or null if never)
  timeToTp: Map<number, number | null>; // tp% → minutes
}

for (const THRESH of [0.3, 0.5, 0.7]) {
  const freshThresh = THRESH * 0.3;
  const signals: Signal[] = [];
  let lastIdx = -COOLDOWN;

  for (let i = 5; i < btc1m.length; i++) {
    const bar = btc1m[i];
    const move = (bar.close - bar.open) / bar.open * 100;
    if (move < THRESH) continue;
    if (i - lastIdx < COOLDOWN) continue;
    lastIdx = i;

    const hypeI = hypeIdx.get(bar.timestamp);
    if (hypeI === undefined || hypeI + 31 >= hype1m.length) continue;

    const hypeSameMove = (hype1m[hypeI].close - hype1m[hypeI].open) / hype1m[hypeI].open * 100;
    if (hypeSameMove >= freshThresh) continue; // only fresh

    const entry = hype1m[hypeI + 1].open;
    const maxUp: number[] = [];
    const maxDown: number[] = [];
    let runningMax = 0;
    let runningMin = 0;

    for (let m = 0; m < 30; m++) {
      const j = hypeI + 1 + m;
      if (j >= hype1m.length) { maxUp.push(runningMax); maxDown.push(runningMin); continue; }
      const hi = (hype1m[j].high - entry) / entry * 100;
      const lo = (hype1m[j].low - entry) / entry * 100;
      if (hi > runningMax) runningMax = hi;
      if (lo < runningMin) runningMin = lo;
      maxUp.push(runningMax);
      maxDown.push(runningMin);
    }

    // Time to reach TP levels
    const tpLevels = [0.2, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0];
    const timeToTp = new Map<number, number | null>();
    for (const tp of tpLevels) {
      let found: number | null = null;
      for (let m = 0; m < 30; m++) {
        const j = hypeI + 1 + m;
        if (j >= hype1m.length) break;
        const hi = (hype1m[j].high - entry) / entry * 100;
        if (hi >= tp) { found = m + 1; break; } // minutes after entry
      }
      timeToTp.set(tp, found);
    }

    signals.push({ ts: bar.timestamp, btcMove: move, hypeEntry: entry, maxUp, maxDown, timeToTp });
  }

  console.log(`\n${SEP}`);
  console.log(`  TP HIT RATE — BTC >= +${THRESH}%, HYPE fresh | ${signals.length} signals`);
  console.log(SEP);

  if (signals.length === 0) continue;

  // TP hit rate table: for each TP level, what % hit it within 1m, 2m, 3m, 5m, 10m, 15m, 30m?
  const tpLevels = [0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0];
  const windows = [1, 2, 3, 5, 10, 15, 30];

  console.log(`\n  TP hit rate (% of signals reaching TP within window):`);
  console.log(`  ${"TP %".padEnd(8)} ${windows.map(w => (w + "m").padStart(6)).join(" ")}`);
  console.log("  " + DIV);

  for (const tp of tpLevels) {
    const rates: string[] = [];
    for (const w of windows) {
      const hits = signals.filter(s => s.maxUp[w - 1] >= tp).length;
      rates.push((hits / signals.length * 100).toFixed(0) + "%");
    }
    console.log(`  ${(tp.toFixed(1) + "%").padEnd(8)} ${rates.map(r => r.padStart(6)).join(" ")}`);
  }

  // Max drawdown before TP: for signals that hit 0.5% TP, what was worst drawdown?
  console.log(`\n  Risk analysis — max drawdown before hitting TP:`);
  for (const tp of [0.3, 0.5, 1.0, 2.0]) {
    const hitters = signals.filter(s => {
      for (let m = 0; m < 30; m++) { if (s.maxUp[m] >= tp) return true; }
      return false;
    });
    if (hitters.length === 0) continue;

    // For each signal that hit TP, what was the max drawdown BEFORE TP was hit?
    const ddsBefore: number[] = [];
    for (const s of hitters) {
      let worstBefore = 0;
      const hypeI = hypeIdx.get(s.ts)!;
      const entry = s.hypeEntry;
      for (let m = 0; m < 30; m++) {
        const j = hypeI + 1 + m;
        if (j >= hype1m.length) break;
        const hi = (hype1m[j].high - entry) / entry * 100;
        const lo = (hype1m[j].low - entry) / entry * 100;
        if (hi >= tp) break; // TP hit, stop
        if (lo < worstBefore) worstBefore = lo;
      }
      ddsBefore.push(worstBefore);
    }
    const avgDD = ddsBefore.reduce((s, v) => s + v, 0) / ddsBefore.length;
    const maxDD = Math.min(...ddsBefore);
    const median = [...ddsBefore].sort((a, b) => a - b)[Math.floor(ddsBefore.length / 2)];
    console.log(`    TP=${tp}%: ${hitters.length}/${signals.length} hit (${(hitters.length/signals.length*100).toFixed(0)}%)  avg DD before TP: ${avgDD.toFixed(3)}%  worst: ${maxDD.toFixed(3)}%  median: ${median.toFixed(3)}%`);
  }

  // Optimal TP/SL combos — simulate fixed TP + fixed SL, first to hit wins
  console.log(`\n  TP/SL simulation (first to hit within 30m, otherwise close at 30m):`);
  console.log(`  ${"TP".padEnd(6)} ${"SL".padEnd(6)} ${"WR".padStart(6)} ${"Avg".padStart(8)} ${"PF".padStart(6)} ${"Wins".padStart(5)} ${"Stops".padStart(6)} ${"Expiry".padStart(7)} ${"NetPnl$".padStart(9)} (@$3k)`);
  console.log("  " + DIV);

  for (const tp of [0.2, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0]) {
    for (const sl of [0.2, 0.3, 0.5, 0.75, 1.0, 1.5]) {
      if (sl > tp * 2) continue; // skip silly wide stops

      let wins = 0, stops = 0, expiries = 0, totalPnl = 0;
      for (const s of signals) {
        const hypeI = hypeIdx.get(s.ts)!;
        const entry = s.hypeEntry;
        let outcome = "expiry";
        let pnl = 0;

        for (let m = 0; m < 30; m++) {
          const j = hypeI + 1 + m;
          if (j >= hype1m.length) break;
          const hi = (hype1m[j].high - entry) / entry * 100;
          const lo = (hype1m[j].low - entry) / entry * 100;

          // Check stop first (conservative — assumes worst case intra-bar)
          if (lo <= -sl) { outcome = "stop"; pnl = -sl; break; }
          if (hi >= tp) { outcome = "tp"; pnl = tp; break; }
        }

        if (outcome === "expiry") {
          const exitI = Math.min(hypeI + 31, hype1m.length - 1);
          pnl = (hype1m[exitI].close - entry) / entry * 100;
        }

        if (outcome === "tp") wins++;
        else if (outcome === "stop") stops++;
        else expiries++;

        totalPnl += pnl;
      }

      const wr = wins / signals.length * 100;
      const avg = totalPnl / signals.length;
      const grossWin = wins * tp;
      const grossLoss = stops * sl;
      const pf = grossLoss > 0 ? grossWin / grossLoss : Infinity;
      // $ PnL at $3000 notional (pre-fees)
      const dollarPnl = totalPnl / 100 * 3000;
      const feesCost = signals.length * 3000 * 0.0011; // 0.055% each side
      const netDollar = dollarPnl - feesCost;

      if (wr < 30 || pf < 0.5) continue; // skip garbage
      console.log(`  ${(tp + "%").padEnd(6)} ${(sl + "%").padEnd(6)} ${(wr.toFixed(0) + "%").padStart(6)} ${(avg >= 0 ? "+" : "") + avg.toFixed(3) + "%".padStart(0)}${" ".repeat(Math.max(0, 7 - ((avg >= 0 ? "+" : "") + avg.toFixed(3) + "%").length))} ${pf.toFixed(2).padStart(6)} ${String(wins).padStart(5)} ${String(stops).padStart(6)} ${String(expiries).padStart(7)} ${(netDollar >= 0 ? "+$" : "-$") + Math.abs(netDollar).toFixed(0).padStart(0)}`);
    }
  }

  // Average time to TP
  console.log(`\n  Average time to TP (minutes, for signals that hit it within 30m):`);
  for (const tp of [0.2, 0.3, 0.5, 1.0, 2.0]) {
    const times: number[] = [];
    for (const s of signals) {
      const t = s.timeToTp.get(tp);
      if (t !== null && t !== undefined) times.push(t);
    }
    if (times.length === 0) continue;
    const avg = times.reduce((s, v) => s + v, 0) / times.length;
    const median = [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)];
    console.log(`    TP=${tp}%: avg=${avg.toFixed(1)}m  median=${median}m  (${times.length}/${signals.length} hit)`);
  }
}

console.log(`\n${SEP}`);
