// analyze-btc-lead-1m.ts — BTC→HYPE lag analysis at 1-minute resolution
//
// Does BTC lead HYPE by 1-3 minutes on surges?
// Scans BTC 1m bars for moves >= threshold, tracks HYPE in next 1/2/3/5/10/15 mins.
//
// Usage: npx ts-node src/analyze-btc-lead-1m.ts
// BTC_THRESH=0.3 npx ts-node src/analyze-btc-lead-1m.ts

import fs from "fs";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

console.log("Loading 1m data...");
const btc1m: Candle[]  = JSON.parse(fs.readFileSync("data/vps/BTCUSDT_1_full.json", "utf-8"));
const hype1m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_1.json", "utf-8"));
console.log(`BTC: ${btc1m.length} bars  HYPE: ${hype1m.length} bars`);

// Build timestamp→index maps
const btcIdx  = new Map<number, number>();
const hypeIdx = new Map<number, number>();
btc1m.forEach((c, i)  => btcIdx.set(c.timestamp, i));
hype1m.forEach((c, i) => hypeIdx.set(c.timestamp, i));

const THRESH = parseFloat(process.env.BTC_THRESH || "0.5"); // % move in one 1m bar
const HOLD_BARS = [1, 2, 3, 5, 10, 15, 30]; // minutes
const HOLD_LABELS = ["1m", "2m", "3m", "5m", "10m", "15m", "30m"];
const COOLDOWN_BARS = parseInt(process.env.BTC_CD || "10"); // 10min cooldown

const SEP = "═".repeat(120);
const DIV = "─".repeat(120);

interface Signal {
  ts: number;
  btcMove: number;
  btcPrice: number;
  hypeAtSignal: number;  // HYPE close on same bar as BTC surge
  hypeSameBarMove: number; // HYPE move in same 1m bar
  hypeEntry: number;     // HYPE open of next bar (realistic entry)
  hypeReturns: (number | null)[];
  hypeMaxUp: number[];
  hypeMaxDown: number[];
}

function scanSurges(direction: "long" | "short"): Signal[] {
  const signals: Signal[] = [];
  let lastIdx = -COOLDOWN_BARS;

  for (let i = 0; i < btc1m.length; i++) {
    const bar = btc1m[i];
    const move = (bar.close - bar.open) / bar.open * 100;

    const triggered = direction === "long" ? move >= THRESH : move <= -THRESH;
    if (!triggered) continue;
    if (i - lastIdx < COOLDOWN_BARS) continue;
    lastIdx = i;

    const hypeI = hypeIdx.get(bar.timestamp);
    if (hypeI === undefined || hypeI + 1 >= hype1m.length) continue;

    const hypeSameBar = hype1m[hypeI];
    const hypeSameMove = (hypeSameBar.close - hypeSameBar.open) / hypeSameBar.open * 100;

    // Realistic entry: open of next 1m HYPE bar
    const entryBar = hype1m[hypeI + 1];
    const hypeEntry = entryBar.open;

    const hypeReturns: (number | null)[] = [];
    const hypeMaxUp: number[] = [];
    const hypeMaxDown: number[] = [];

    for (const holdBars of HOLD_BARS) {
      const exitI = hypeI + 1 + holdBars;
      if (exitI >= hype1m.length) { hypeReturns.push(null); hypeMaxUp.push(0); hypeMaxDown.push(0); continue; }

      const exitPrice = hype1m[exitI].close;
      let maxUp = 0, maxDown = 0;

      for (let j = hypeI + 1; j <= exitI; j++) {
        const h = (hype1m[j].high - hypeEntry) / hypeEntry * 100;
        const l = (hype1m[j].low - hypeEntry) / hypeEntry * 100;
        if (direction === "long") {
          if (h > maxUp) maxUp = h;
          if (l < maxDown) maxDown = l;
        } else {
          if (-l > maxUp) maxUp = -l;
          if (-h < maxDown) maxDown = -h;
        }
      }

      const ret = direction === "long"
        ? (exitPrice - hypeEntry) / hypeEntry * 100
        : (hypeEntry - exitPrice) / hypeEntry * 100;

      hypeReturns.push(ret);
      hypeMaxUp.push(maxUp);
      hypeMaxDown.push(maxDown);
    }

    signals.push({
      ts: bar.timestamp, btcMove: move, btcPrice: bar.close,
      hypeAtSignal: hypeSameBar.close, hypeSameBarMove: hypeSameMove,
      hypeEntry, hypeReturns, hypeMaxUp, hypeMaxDown,
    });
  }
  return signals;
}

function printResults(signals: Signal[], direction: "long" | "short") {
  const label = direction === "long" ? "BTC SURGE → LONG HYPE" : "BTC DUMP → SHORT HYPE";
  const threshLabel = direction === "long" ? `>= +${THRESH}%` : `<= -${THRESH}%`;

  console.log(`\n${SEP}`);
  console.log(`  ${label}  |  BTC 1m bar ${threshLabel}  |  ${signals.length} signals  |  ${COOLDOWN_BARS}min cooldown`);
  console.log(SEP);

  // How much did HYPE already move in the same 1m bar?
  const sameBarMoves = signals.map(s => direction === "long" ? s.hypeSameBarMove : -s.hypeSameBarMove);
  const avgSameBar = sameBarMoves.reduce((s, v) => s + v, 0) / sameBarMoves.length;
  const sameBarAlreadyMoved = sameBarMoves.filter(m => m > THRESH * 0.3).length;
  console.log(`\n  Same-bar check: HYPE avg move in BTC surge bar = ${avgSameBar >= 0 ? "+" : ""}${avgSameBar.toFixed(3)}%`);
  console.log(`  HYPE already moved > ${(THRESH * 0.3).toFixed(2)}% in same bar: ${sameBarAlreadyMoved}/${signals.length} (${(sameBarAlreadyMoved/signals.length*100).toFixed(0)}%)`);

  // Separate: signals where HYPE DIDN'T move yet vs already moved
  const fresh = signals.filter(s => {
    const m = direction === "long" ? s.hypeSameBarMove : -s.hypeSameBarMove;
    return m < THRESH * 0.3;
  });
  const stale = signals.filter(s => {
    const m = direction === "long" ? s.hypeSameBarMove : -s.hypeSameBarMove;
    return m >= THRESH * 0.3;
  });

  for (const { label: grpLabel, grp } of [
    { label: "ALL SIGNALS", grp: signals },
    { label: "FRESH ONLY (HYPE hasn't moved yet)", grp: fresh },
    { label: "STALE (HYPE already moved in same bar)", grp: stale },
  ]) {
    if (grp.length === 0) continue;
    console.log(`\n  ── ${grpLabel}: ${grp.length} trades ──`);
    console.log(`  ${"Hold".padEnd(6)} ${"N".padStart(5)} ${"Win%".padStart(6)} ${"AvgRet".padStart(9)} ${"Median".padStart(9)} ${"AvgBest".padStart(9)} ${"AvgWorst".padStart(9)} ${"PF".padStart(6)} ${"NetBps".padStart(8)}`);

    for (let h = 0; h < HOLD_BARS.length; h++) {
      const returns = grp.map(s => s.hypeReturns[h]).filter(r => r !== null) as number[];
      const maxUps = grp.map(s => s.hypeMaxUp[h]);
      if (returns.length === 0) continue;

      const wins = returns.filter(r => r > 0).length;
      const wr = wins / returns.length * 100;
      const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
      const sorted = [...returns].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const avgBest = maxUps.reduce((s, r) => s + r, 0) / maxUps.length;
      const avgWorst = grp.map(s => s.hypeMaxDown[h]).reduce((s, r) => s + r, 0) / grp.length;
      const grossWin = returns.filter(r => r > 0).reduce((s, r) => s + r, 0);
      const grossLoss = Math.abs(returns.filter(r => r <= 0).reduce((s, r) => s + r, 0));
      const pf = grossLoss > 0 ? grossWin / grossLoss : Infinity;
      // Net after fees (0.055% per side = 0.11% round trip)
      const netBps = (avg - 0.11) * 100;

      const fmt = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(3) + "%";
      console.log(`  ${HOLD_LABELS[h].padEnd(6)} ${String(returns.length).padStart(5)} ${(wr.toFixed(1) + "%").padStart(6)} ${fmt(avg).padStart(9)} ${fmt(median).padStart(9)} ${fmt(avgBest).padStart(9)} ${fmt(avgWorst).padStart(9)} ${pf.toFixed(2).padStart(6)} ${(netBps >= 0 ? "+" : "") + netBps.toFixed(0) + "bp".padStart(0)}`)
    }
  }

  // Distribution for 3m hold
  const hold3idx = 2;
  const rets3 = signals.map(s => s.hypeReturns[hold3idx]).filter(r => r !== null) as number[];
  if (rets3.length > 0) {
    const buckets = [
      { label: "< -1%", min: -Infinity, max: -1 },
      { label: "-1 to -0.5%", min: -1, max: -0.5 },
      { label: "-0.5 to -0.2%", min: -0.5, max: -0.2 },
      { label: "-0.2 to 0%", min: -0.2, max: 0 },
      { label: "0 to +0.2%", min: 0, max: 0.2 },
      { label: "+0.2 to +0.5%", min: 0.2, max: 0.5 },
      { label: "+0.5 to +1%", min: 0.5, max: 1 },
      { label: "> +1%", min: 1, max: Infinity },
    ];
    console.log(`\n  Return distribution (3min hold):`);
    for (const b of buckets) {
      const count = rets3.filter(r => r >= b.min && r < b.max).length;
      const pct = (count / rets3.length * 100).toFixed(1);
      const bar = "█".repeat(Math.round(count / rets3.length * 40));
      console.log(`    ${b.label.padEnd(16)} ${String(count).padStart(4)} (${pct.padStart(5)}%) ${bar}`);
    }
  }

  // Top 20 biggest
  console.log(`\n  Top 20 largest BTC moves — HYPE outcomes:`);
  console.log(`  ${"Date".padEnd(20)} ${"BTC1m".padStart(7)} ${"HYPE same".padStart(10)} ${"HYPE+1m".padStart(8)} ${"HYPE+2m".padStart(8)} ${"HYPE+3m".padStart(8)} ${"HYPE+5m".padStart(8)} ${"HYPE+10m".padStart(9)} ${"HYPE+15m".padStart(9)}`);
  console.log("  " + DIV);

  const sorted = [...signals].sort((a, b) =>
    direction === "long" ? b.btcMove - a.btcMove : a.btcMove - b.btcMove
  );
  for (const s of sorted.slice(0, 25)) {
    const d = new Date(s.ts).toISOString().replace("T", " ").slice(0, 16);
    const fmt = (v: number | null) => v === null ? "?" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
    const sameBar = (s.hypeSameBarMove >= 0 ? "+" : "") + s.hypeSameBarMove.toFixed(2) + "%";
    console.log(`  ${d.padEnd(20)} ${((s.btcMove >= 0 ? "+" : "") + s.btcMove.toFixed(2) + "%").padStart(7)} ${sameBar.padStart(10)} ${fmt(s.hypeReturns[0]).padStart(8)} ${fmt(s.hypeReturns[1]).padStart(8)} ${fmt(s.hypeReturns[2]).padStart(8)} ${fmt(s.hypeReturns[3]).padStart(8)} ${fmt(s.hypeReturns[4]).padStart(9)} ${fmt(s.hypeReturns[5]).padStart(9)}`);
  }
}

// ── Run ──
console.log(SEP);
console.log(`  BTC → HYPE 1-MINUTE LAG ANALYSIS`);
console.log(`  Threshold: ${THRESH}% per 1m bar  |  Cooldown: ${COOLDOWN_BARS}min`);
console.log(SEP);

const longSignals = scanSurges("long");
printResults(longSignals, "long");

const shortSignals = scanSurges("short");
printResults(shortSignals, "short");

// Also test 0.3% for more signals
if (THRESH > 0.35) {
  console.log(`\n  (Run with BTC_THRESH=0.3 for more signals at lower threshold)`);
}
console.log(SEP);
