// Deep dive on "fresh" signals — BTC surges where HYPE hasn't moved yet
// What makes these moments special? Time of day, volume, prior movement, etc.

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
const SEP = "═".repeat(130);
const DIV = "─".repeat(130);

// Scan for fresh signals at multiple thresholds
for (const THRESH of [0.3, 0.5, 0.7]) {
  const freshThresh = THRESH * 0.3; // HYPE hasn't moved this much yet

  interface FreshSignal {
    ts: number;
    btcMove: number;
    btcVol: number;
    hypeSameBar: number;
    hypeEntry: number;
    hypeRet1m: number;
    hypeRet3m: number;
    hypeRet5m: number;
    hypeMaxUp3m: number;
    // Context
    btcPrior5m: number;  // BTC movement in prior 5 bars
    hypePrior5m: number; // HYPE movement in prior 5 bars
    btcVol5mAvg: number; // BTC volume average prior 5 bars
    btcVolRatio: number; // current bar vol / avg
    hourUTC: number;
    dow: number;
  }

  const signals: FreshSignal[] = [];
  let lastIdx = -COOLDOWN;

  for (let i = 5; i < btc1m.length; i++) {
    const bar = btc1m[i];
    const move = (bar.close - bar.open) / bar.open * 100;
    if (move < THRESH) continue;
    if (i - lastIdx < COOLDOWN) continue;
    lastIdx = i;

    const hypeI = hypeIdx.get(bar.timestamp);
    if (hypeI === undefined || hypeI + 6 >= hype1m.length) continue;

    const hypeSameBar = hype1m[hypeI];
    const hypeSameMove = (hypeSameBar.close - hypeSameBar.open) / hypeSameBar.open * 100;

    // Only fresh signals
    if (hypeSameMove >= freshThresh) continue;

    const entryBar = hype1m[hypeI + 1];
    const entry = entryBar.open;

    // Returns
    const ret1m = (hype1m[hypeI + 2].close - entry) / entry * 100;
    const ret3m = (hype1m[hypeI + 4].close - entry) / entry * 100;
    const ret5m = hypeI + 6 < hype1m.length ? (hype1m[hypeI + 6].close - entry) / entry * 100 : 0;

    let maxUp3m = 0;
    for (let j = hypeI + 1; j <= hypeI + 4 && j < hype1m.length; j++) {
      const h = (hype1m[j].high - entry) / entry * 100;
      if (h > maxUp3m) maxUp3m = h;
    }

    // BTC prior 5m movement
    const btcPrior = (btc1m[i].open - btc1m[i - 5].open) / btc1m[i - 5].open * 100;
    const hypePrior = hypeI >= 5 ? (hype1m[hypeI].open - hype1m[hypeI - 5].open) / hype1m[hypeI - 5].open * 100 : 0;

    // Volume context
    let btcVolSum = 0;
    for (let j = i - 5; j < i; j++) btcVolSum += btc1m[j].turnover;
    const btcVolAvg = btcVolSum / 5;
    const volRatio = btcVolAvg > 0 ? bar.turnover / btcVolAvg : 0;

    const d = new Date(bar.timestamp);

    signals.push({
      ts: bar.timestamp, btcMove: move, btcVol: bar.turnover,
      hypeSameBar: hypeSameMove, hypeEntry: entry,
      hypeRet1m: ret1m, hypeRet3m: ret3m, hypeRet5m: ret5m,
      hypeMaxUp3m: maxUp3m,
      btcPrior5m: btcPrior, hypePrior5m: hypePrior,
      btcVol5mAvg: btcVolAvg, btcVolRatio: volRatio,
      hourUTC: d.getUTCHours(), dow: d.getUTCDay(),
    });
  }

  console.log(`\n${SEP}`);
  console.log(`  FRESH SIGNALS DEEP DIVE — BTC >= +${THRESH}%, HYPE hasn't moved (< ${freshThresh.toFixed(2)}%)`);
  console.log(`  ${signals.length} signals`);
  console.log(SEP);

  if (signals.length === 0) continue;

  // Stats
  const wins1m = signals.filter(s => s.hypeRet1m > 0).length;
  const wins3m = signals.filter(s => s.hypeRet3m > 0).length;
  const avg1m = signals.reduce((s, v) => s + v.hypeRet1m, 0) / signals.length;
  const avg3m = signals.reduce((s, v) => s + v.hypeRet3m, 0) / signals.length;
  const avg5m = signals.reduce((s, v) => s + v.hypeRet5m, 0) / signals.length;
  const avgMaxUp = signals.reduce((s, v) => s + v.hypeMaxUp3m, 0) / signals.length;

  console.log(`  WR 1m: ${(wins1m/signals.length*100).toFixed(0)}%  avg: ${avg1m >= 0 ? "+" : ""}${avg1m.toFixed(3)}%`);
  console.log(`  WR 3m: ${(wins3m/signals.length*100).toFixed(0)}%  avg: ${avg3m >= 0 ? "+" : ""}${avg3m.toFixed(3)}%`);
  console.log(`  Avg 5m ret: ${avg5m >= 0 ? "+" : ""}${avg5m.toFixed(3)}%`);
  console.log(`  Avg max upside in 3m window: +${avgMaxUp.toFixed(3)}%`);

  // BTC context averages
  const avgBtcMove = signals.reduce((s, v) => s + v.btcMove, 0) / signals.length;
  const avgBtcPrior = signals.reduce((s, v) => s + v.btcPrior5m, 0) / signals.length;
  const avgHypePrior = signals.reduce((s, v) => s + v.hypePrior5m, 0) / signals.length;
  const avgVolRatio = signals.reduce((s, v) => s + v.btcVolRatio, 0) / signals.length;

  console.log(`\n  Context averages:`);
  console.log(`    BTC surge size: +${avgBtcMove.toFixed(3)}%`);
  console.log(`    BTC prior 5min move: ${avgBtcPrior >= 0 ? "+" : ""}${avgBtcPrior.toFixed(3)}%`);
  console.log(`    HYPE prior 5min move: ${avgHypePrior >= 0 ? "+" : ""}${avgHypePrior.toFixed(3)}%`);
  console.log(`    BTC volume ratio (bar/5min avg): ${avgVolRatio.toFixed(2)}x`);

  // By hour
  console.log(`\n  By UTC hour:`);
  const hours: Record<number, { n: number; sum: number }> = {};
  for (const s of signals) {
    if (!hours[s.hourUTC]) hours[s.hourUTC] = { n: 0, sum: 0 };
    hours[s.hourUTC].n++;
    hours[s.hourUTC].sum += s.hypeRet3m;
  }
  for (const h of Object.keys(hours).map(Number).sort((a, b) => a - b)) {
    const b = hours[h];
    console.log(`    ${String(h).padStart(2)}:00  n=${String(b.n).padStart(3)}  avg3m=${(b.sum/b.n >= 0 ? "+" : "") + (b.sum/b.n).toFixed(3)}%`);
  }

  // By day of week
  console.log(`\n  By day of week:`);
  const days: Record<number, { n: number; sum: number }> = {};
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const s of signals) {
    if (!days[s.dow]) days[s.dow] = { n: 0, sum: 0 };
    days[s.dow].n++;
    days[s.dow].sum += s.hypeRet3m;
  }
  for (const d of Object.keys(days).map(Number).sort((a, b) => a - b)) {
    const b = days[d];
    console.log(`    ${dayNames[d]}  n=${String(b.n).padStart(3)}  avg3m=${(b.sum/b.n >= 0 ? "+" : "") + (b.sum/b.n).toFixed(3)}%`);
  }

  // Split: did BTC have prior momentum (>0.1% in prior 5 bars) vs cold start
  const withMom = signals.filter(s => s.btcPrior5m > 0.1);
  const coldStart = signals.filter(s => s.btcPrior5m <= 0.1);
  console.log(`\n  BTC prior 5m momentum:`);
  console.log(`    With momentum (prior 5m > +0.1%): n=${withMom.length}  avg3m=${withMom.length > 0 ? (withMom.reduce((s,v) => s+v.hypeRet3m, 0)/withMom.length).toFixed(3) : "?"}%`);
  console.log(`    Cold start (prior 5m <= +0.1%):    n=${coldStart.length}  avg3m=${coldStart.length > 0 ? (coldStart.reduce((s,v) => s+v.hypeRet3m, 0)/coldStart.length).toFixed(3) : "?"}%`);

  // Split: high vs low BTC volume ratio
  const highVol = signals.filter(s => s.btcVolRatio > 2);
  const lowVol = signals.filter(s => s.btcVolRatio <= 2);
  console.log(`\n  BTC volume ratio:`);
  console.log(`    High vol (>2x avg): n=${highVol.length}  avg3m=${highVol.length > 0 ? (highVol.reduce((s,v) => s+v.hypeRet3m, 0)/highVol.length).toFixed(3) : "?"}%`);
  console.log(`    Low vol (<=2x avg): n=${lowVol.length}  avg3m=${lowVol.length > 0 ? (lowVol.reduce((s,v) => s+v.hypeRet3m, 0)/lowVol.length).toFixed(3) : "?"}%`);

  // All individual signals
  console.log(`\n  All signals:`);
  console.log(`  ${"Date".padEnd(20)} ${"BTC1m".padStart(7)} ${"HYPEsame".padStart(9)} ${"BTCprior".padStart(9)} ${"HYPEprior".padStart(10)} ${"VolRat".padStart(7)} ${"HYPE+1m".padStart(8)} ${"HYPE+3m".padStart(8)} ${"HYPE+5m".padStart(8)} ${"MaxUp3m".padStart(8)}`);
  console.log("  " + DIV);

  const sorted = [...signals].sort((a, b) => a.ts - b.ts);
  for (const s of sorted) {
    const d = new Date(s.ts).toISOString().replace("T", " ").slice(0, 16);
    const fmt = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
    console.log(`  ${d.padEnd(20)} ${fmt(s.btcMove).padStart(7)} ${fmt(s.hypeSameBar).padStart(9)} ${fmt(s.btcPrior5m).padStart(9)} ${fmt(s.hypePrior5m).padStart(10)} ${s.btcVolRatio.toFixed(1).padStart(6)}x ${fmt(s.hypeRet1m).padStart(8)} ${fmt(s.hypeRet3m).padStart(8)} ${fmt(s.hypeRet5m).padStart(8)} ${fmt(s.hypeMaxUp3m).padStart(8)}`);
  }
}

console.log(`\n${SEP}`);
