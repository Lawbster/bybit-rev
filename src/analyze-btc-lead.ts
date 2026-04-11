// analyze-btc-lead.ts — Does BTC lead HYPE? Can you long HYPE on BTC surges?
//
// Scans every BTC 5m bar for surges >= threshold.
// For each surge, measures HYPE return over next N minutes.
// Also checks: does HYPE move BEFORE BTC (reverse lead)?
//
// Usage: npx ts-node src/analyze-btc-lead.ts
// BTC_THRESH=0.5 npx ts-node src/analyze-btc-lead.ts   (lower threshold)

import fs from "fs";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

const btc5m: Candle[]  = JSON.parse(fs.readFileSync("data/BTCUSDT_5_full.json", "utf-8"));
const hype5m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

// Build timestamp→index maps for fast lookup
const btcIdx  = new Map<number, number>();
const hypeIdx = new Map<number, number>();
btc5m.forEach((c, i)  => btcIdx.set(c.timestamp, i));
hype5m.forEach((c, i) => hypeIdx.set(c.timestamp, i));

const THRESH = parseFloat(process.env.BTC_THRESH || "1.0"); // % move in one 5m bar
const HOLD_BARS = [1, 2, 3, 6, 12, 24]; // 5m, 10m, 15m, 30m, 60m, 120m
const HOLD_LABELS = ["5m", "10m", "15m", "30m", "60m", "120m"];
const COOLDOWN_BARS = 6; // 30min cooldown between signals to avoid clustering

const SEP = "═".repeat(110);
const DIV = "─".repeat(110);

// ── Scan BTC surges (long) ──
interface Signal {
  ts: number;
  btcMove: number;  // % move in the BTC bar
  btcPrice: number;
  hypeEntry: number;
  hypeReturns: (number | null)[]; // return % for each hold period
  hypeMaxUp: number[];   // max upside during hold
  hypeMaxDown: number[]; // max drawdown during hold
}

function scanSurges(direction: "long" | "short"): Signal[] {
  const signals: Signal[] = [];
  let lastSignalIdx = -COOLDOWN_BARS;

  for (let i = 1; i < btc5m.length; i++) {
    const bar = btc5m[i];
    const move = (bar.close - bar.open) / bar.open * 100;

    const triggered = direction === "long" ? move >= THRESH : move <= -THRESH;
    if (!triggered) continue;
    if (i - lastSignalIdx < COOLDOWN_BARS) continue; // cooldown

    lastSignalIdx = i;

    // Find HYPE bar at same timestamp (entry = next bar's open, i.e. this bar's close)
    const hypeI = hypeIdx.get(bar.timestamp);
    if (hypeI === undefined || hypeI + 1 >= hype5m.length) continue;

    // Entry: open of the NEXT HYPE 5m bar (realistic — you see BTC bar close, then enter HYPE)
    const entryBar = hype5m[hypeI + 1];
    const hypeEntry = entryBar.open;

    const hypeReturns: (number | null)[] = [];
    const hypeMaxUp: number[] = [];
    const hypeMaxDown: number[] = [];

    for (const holdBars of HOLD_BARS) {
      const exitI = hypeI + 1 + holdBars;
      if (exitI >= hype5m.length) {
        hypeReturns.push(null);
        hypeMaxUp.push(0);
        hypeMaxDown.push(0);
        continue;
      }

      const exitPrice = hype5m[exitI].close;
      let maxUp = 0, maxDown = 0;

      // Track max up/down during hold
      for (let j = hypeI + 1; j <= exitI; j++) {
        const h = (hype5m[j].high - hypeEntry) / hypeEntry * 100;
        const l = (hype5m[j].low - hypeEntry) / hypeEntry * 100;
        if (direction === "long") {
          if (h > maxUp) maxUp = h;
          if (l < maxDown) maxDown = l;
        } else {
          // For short: flip — maxUp = best downside move, maxDown = worst upside
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
      ts: bar.timestamp,
      btcMove: move,
      btcPrice: bar.close,
      hypeEntry,
      hypeReturns,
      hypeMaxUp,
      hypeMaxDown,
    });
  }

  return signals;
}

function printResults(signals: Signal[], direction: "long" | "short") {
  const label = direction === "long" ? "BTC SURGE → LONG HYPE" : "BTC DUMP → SHORT HYPE";
  const threshLabel = direction === "long" ? `>= +${THRESH}%` : `<= -${THRESH}%`;

  console.log(`\n${SEP}`);
  console.log(`  ${label}  |  BTC 5m move ${threshLabel}  |  ${signals.length} signals  |  30min cooldown`);
  console.log(SEP);

  // Per-hold-period stats
  console.log(`\n  ${"Hold".padEnd(8)} ${"Trades".padStart(7)} ${"Win%".padStart(6)} ${"AvgRet".padStart(8)} ${"Median".padStart(8)} ${"AvgBest".padStart(8)} ${"AvgWorst".padStart(9)} ${"MaxWin".padStart(8)} ${"MaxLoss".padStart(8)} ${"PF".padStart(6)} ${"Expectancy".padStart(11)}`);
  console.log("  " + DIV);

  for (let h = 0; h < HOLD_BARS.length; h++) {
    const returns = signals.map(s => s.hypeReturns[h]).filter(r => r !== null) as number[];
    const maxUps  = signals.map(s => s.hypeMaxUp[h]);
    const maxDowns = signals.map(s => s.hypeMaxDown[h]);

    if (returns.length === 0) continue;

    const wins = returns.filter(r => r > 0).length;
    const losses = returns.filter(r => r <= 0).length;
    const wr = wins / returns.length * 100;
    const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
    const sorted = [...returns].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const maxWin = Math.max(...returns);
    const maxLoss = Math.min(...returns);
    const avgBest = maxUps.reduce((s, r) => s + r, 0) / maxUps.length;
    const avgWorst = maxDowns.reduce((s, r) => s + r, 0) / maxDowns.length;
    const grossWin = returns.filter(r => r > 0).reduce((s, r) => s + r, 0);
    const grossLoss = Math.abs(returns.filter(r => r <= 0).reduce((s, r) => s + r, 0));
    const pf = grossLoss > 0 ? grossWin / grossLoss : Infinity;
    const expectancy = avg; // per-trade expectancy in %

    console.log(`  ${HOLD_LABELS[h].padEnd(8)} ${String(returns.length).padStart(7)} ${(wr.toFixed(1) + "%").padStart(6)} ${(avg >= 0 ? "+" : "") + avg.toFixed(3) + "%".padStart(0)}${" ".repeat(Math.max(0, 7 - ((avg >= 0 ? "+" : "") + avg.toFixed(3) + "%").length))} ${(median >= 0 ? "+" : "") + median.toFixed(3) + "%".padStart(0)}${" ".repeat(Math.max(0, 7 - ((median >= 0 ? "+" : "") + median.toFixed(3) + "%").length))} ${("+" + avgBest.toFixed(2) + "%").padStart(8)} ${(avgWorst.toFixed(2) + "%").padStart(9)} ${(maxWin >= 0 ? "+" : "") + maxWin.toFixed(2) + "%".padStart(0)}${" ".repeat(Math.max(0, 7 - ((maxWin >= 0 ? "+" : "") + maxWin.toFixed(2) + "%").length))} ${maxLoss.toFixed(2) + "%".padStart(0)}${" ".repeat(Math.max(0, 7 - (maxLoss.toFixed(2) + "%").length))} ${pf.toFixed(2).padStart(6)} ${(expectancy >= 0 ? "+" : "") + (expectancy * 100).toFixed(1) + "bps".padStart(0)}`);
  }

  // Distribution buckets for 15m hold
  const hold15idx = 2; // 15m = index 2
  const rets15 = signals.map(s => s.hypeReturns[hold15idx]).filter(r => r !== null) as number[];
  if (rets15.length > 0) {
    const buckets = [
      { label: "< -2%", min: -Infinity, max: -2 },
      { label: "-2 to -1%", min: -2, max: -1 },
      { label: "-1 to -0.5%", min: -1, max: -0.5 },
      { label: "-0.5 to 0%", min: -0.5, max: 0 },
      { label: "0 to +0.5%", min: 0, max: 0.5 },
      { label: "+0.5 to +1%", min: 0.5, max: 1 },
      { label: "+1 to +2%", min: 1, max: 2 },
      { label: "> +2%", min: 2, max: Infinity },
    ];
    console.log(`\n  Return distribution (15min hold, ${rets15.length} trades):`);
    for (const b of buckets) {
      const count = rets15.filter(r => r >= b.min && r < b.max).length;
      const pct = (count / rets15.length * 100).toFixed(1);
      const bar = "█".repeat(Math.round(count / rets15.length * 50));
      console.log(`    ${b.label.padEnd(15)} ${String(count).padStart(4)} (${pct.padStart(5)}%) ${bar}`);
    }
  }

  // Show 20 biggest signals with outcomes
  console.log(`\n  Top 20 largest BTC surges and HYPE outcomes (15m hold):`);
  console.log(`  ${"Date".padEnd(20)} ${"BTC 5m".padStart(8)} ${"BTC$".padStart(8)} ${"HYPE$".padStart(8)} ${"HYPE 5m".padStart(8)} ${"HYPE 15m".padStart(9)} ${"HYPE 30m".padStart(9)} ${"HYPE 60m".padStart(9)} ${"MaxUp15m".padStart(9)}`);
  console.log("  " + DIV);

  const sorted = [...signals].sort((a, b) =>
    direction === "long" ? b.btcMove - a.btcMove : a.btcMove - b.btcMove
  );

  for (const s of sorted.slice(0, 20)) {
    const d = new Date(s.ts).toISOString().replace("T", " ").slice(0, 16);
    const r5  = s.hypeReturns[0] !== null ? (s.hypeReturns[0] >= 0 ? "+" : "") + s.hypeReturns[0].toFixed(2) + "%" : "?";
    const r15 = s.hypeReturns[2] !== null ? (s.hypeReturns[2] >= 0 ? "+" : "") + s.hypeReturns[2].toFixed(2) + "%" : "?";
    const r30 = s.hypeReturns[3] !== null ? (s.hypeReturns[3] >= 0 ? "+" : "") + s.hypeReturns[3].toFixed(2) + "%" : "?";
    const r60 = s.hypeReturns[4] !== null ? (s.hypeReturns[4] >= 0 ? "+" : "") + s.hypeReturns[4].toFixed(2) + "%" : "?";
    const mu  = "+" + s.hypeMaxUp[2].toFixed(2) + "%";
    console.log(`  ${d.padEnd(20)} ${((s.btcMove >= 0 ? "+" : "") + s.btcMove.toFixed(2) + "%").padStart(8)} ${("$" + s.btcPrice.toFixed(0)).padStart(8)} ${("$" + s.hypeEntry.toFixed(2)).padStart(8)} ${r5.padStart(8)} ${r15.padStart(9)} ${r30.padStart(9)} ${r60.padStart(9)} ${mu.padStart(9)}`);
  }

  // ── By time of day ──
  console.log(`\n  Win rate by UTC hour (15m hold):`);
  const hourBuckets: { n: number; wins: number; sum: number }[] = Array.from({ length: 24 }, () => ({ n: 0, wins: 0, sum: 0 }));
  for (const s of signals) {
    const h = new Date(s.ts).getUTCHours();
    const ret = s.hypeReturns[2];
    if (ret === null) continue;
    hourBuckets[h].n++;
    if (ret > 0) hourBuckets[h].wins++;
    hourBuckets[h].sum += ret;
  }
  for (let h = 0; h < 24; h++) {
    const b = hourBuckets[h];
    if (b.n === 0) continue;
    const wr = (b.wins / b.n * 100).toFixed(0);
    const avg = (b.sum / b.n).toFixed(3);
    console.log(`    ${String(h).padStart(2)}:00 UTC  n=${String(b.n).padStart(3)}  WR=${wr.padStart(3)}%  avg=${avg}%`);
  }
}

// ── Also check: does HYPE surge FIRST? (reverse lead) ──
function scanHypeSurges(): Signal[] {
  const signals: Signal[] = [];
  let lastSignalIdx = -COOLDOWN_BARS;

  for (let i = 1; i < hype5m.length; i++) {
    const bar = hype5m[i];
    const move = (bar.close - bar.open) / bar.open * 100;
    if (move < THRESH) continue;
    if (i - lastSignalIdx < COOLDOWN_BARS) continue;
    lastSignalIdx = i;

    // What did BTC do in the SAME bar? And what does BTC do AFTER?
    const btcI = btcIdx.get(bar.timestamp);
    if (btcI === undefined || btcI + 1 >= btc5m.length) continue;

    const btcSameBar = btc5m[btcI];
    const btcMove = (btcSameBar.close - btcSameBar.open) / btcSameBar.open * 100;

    // Did HYPE move but BTC didn't? (HYPE leads)
    signals.push({
      ts: bar.timestamp,
      btcMove,
      btcPrice: btcSameBar.close,
      hypeEntry: bar.close,
      hypeReturns: [], // not used
      hypeMaxUp: [],
      hypeMaxDown: [],
    });
  }
  return signals;
}

// ── Run ──
console.log(SEP);
console.log(`  BTC → HYPE LAG ANALYSIS`);
console.log(`  BTC data: ${new Date(btc5m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(btc5m[btc5m.length - 1].timestamp).toISOString().slice(0, 10)}`);
console.log(`  HYPE data: ${new Date(hype5m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(hype5m[hype5m.length - 1].timestamp).toISOString().slice(0, 10)}`);
console.log(`  Threshold: ${THRESH}% per 5m bar  |  Cooldown: 30min`);
console.log(SEP);

// BTC surge → long HYPE
const longSignals = scanSurges("long");
printResults(longSignals, "long");

// BTC dump → short HYPE
const shortSignals = scanSurges("short");
printResults(shortSignals, "short");

// Cross-lead check
const hypeSurges = scanHypeSurges();
const hypeLeads = hypeSurges.filter(s => Math.abs(s.btcMove) < 0.3); // HYPE surged but BTC didn't
console.log(`\n${SEP}`);
console.log(`  LEAD-LAG CHECK`);
console.log(SEP);
console.log(`  HYPE surges >= ${THRESH}% in 5m: ${hypeSurges.length} events`);
console.log(`  Of those, BTC moved < 0.3% in same bar: ${hypeLeads.length} (${(hypeLeads.length / hypeSurges.length * 100).toFixed(0)}%) — HYPE moved independently`);
console.log(`  BTC surges >= ${THRESH}% in 5m: ${longSignals.length} events`);

// For BTC surges, check if HYPE already moved in the SAME bar or BEFORE
let hypeAlreadyMoved = 0;
for (const s of longSignals) {
  const hypeI = hypeIdx.get(s.ts);
  if (hypeI === undefined) continue;
  const hypeBar = hype5m[hypeI];
  const hypeMove = (hypeBar.close - hypeBar.open) / hypeBar.open * 100;
  if (hypeMove >= THRESH * 0.5) hypeAlreadyMoved++; // HYPE moved >= half of threshold in same bar
}
console.log(`  BTC surges where HYPE already moved >= ${(THRESH * 0.5).toFixed(1)}% in same bar: ${hypeAlreadyMoved} (${(hypeAlreadyMoved / longSignals.length * 100).toFixed(0)}%)`);
console.log(`  → If high %, assets move together (no lag). If low %, BTC genuinely leads.`);
console.log(SEP);

// ── Also run at 0.5% threshold for comparison ──
if (THRESH >= 1.0) {
  console.log(`\n  (Run with BTC_THRESH=0.5 for more signals at lower threshold)`);
}
