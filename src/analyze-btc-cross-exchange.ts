// Cross-exchange BTC surge validation
// Compares Bybit vs Binance 1m candles on surge signals
// Does requiring both exchanges to confirm the surge filter out noise?

import fs from "fs";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

console.log("Loading 1m data...");
const btcBybit: Candle[]   = JSON.parse(fs.readFileSync("data/vps/BTCUSDT_1_full.json", "utf-8"));
const btcBinance: Candle[] = JSON.parse(fs.readFileSync("data/binance/BTCUSDT_1.json", "utf-8"));
const hypeBybit: Candle[]  = JSON.parse(fs.readFileSync("data/HYPEUSDT_1.json", "utf-8"));

console.log(`Bybit BTC:   ${btcBybit.length} bars  ${new Date(btcBybit[0].timestamp).toISOString().slice(0,10)} → ${new Date(btcBybit[btcBybit.length-1].timestamp).toISOString().slice(0,10)}`);
console.log(`Binance BTC: ${btcBinance.length} bars  ${new Date(btcBinance[0].timestamp).toISOString().slice(0,10)} → ${new Date(btcBinance[btcBinance.length-1].timestamp).toISOString().slice(0,10)}`);
console.log(`Bybit HYPE:  ${hypeBybit.length} bars`);

// Build indexes
const binanceIdx = new Map<number, number>();
btcBinance.forEach((c, i) => binanceIdx.set(c.timestamp, i));
const hypeIdx = new Map<number, number>();
hypeBybit.forEach((c, i) => hypeIdx.set(c.timestamp, i));

const COOLDOWN = 10;
const SEP = "═".repeat(130);
const DIV = "─".repeat(130);

// For each Bybit BTC surge, check what Binance BTC did in the same 1m bar
for (const THRESH of [0.3, 0.5]) {
  const freshThresh = THRESH * 0.3;

  interface Signal {
    ts: number;
    bybitMove: number;
    binanceMove: number | null;
    bybitVol: number;
    binanceVol: number | null;
    combinedVol: number;
    hypeEntry: number;
    hypeRet3m: number;
    hypeRet5m: number;
    hypeMaxUp5m: number;
    fresh: boolean;
    bothConfirm: boolean;    // both exchanges >= THRESH
    bothPositive: boolean;   // both exchanges > 0
    binanceStronger: boolean;
  }

  const signals: Signal[] = [];
  let lastIdx = -COOLDOWN;

  for (let i = 5; i < btcBybit.length; i++) {
    const bar = btcBybit[i];
    const move = (bar.close - bar.open) / bar.open * 100;
    if (move < THRESH) continue;
    if (i - lastIdx < COOLDOWN) continue;
    lastIdx = i;

    const hypeI = hypeIdx.get(bar.timestamp);
    if (hypeI === undefined || hypeI + 6 >= hypeBybit.length) continue;

    const hypeSameMove = (hypeBybit[hypeI].close - hypeBybit[hypeI].open) / hypeBybit[hypeI].open * 100;
    const fresh = hypeSameMove < freshThresh;

    const entry = hypeBybit[hypeI + 1].open;
    const ret3m = (hypeBybit[hypeI + 4].close - entry) / entry * 100;
    const ret5m = hypeI + 6 < hypeBybit.length ? (hypeBybit[hypeI + 6].close - entry) / entry * 100 : 0;

    let maxUp5m = 0;
    for (let j = hypeI + 1; j <= hypeI + 6 && j < hypeBybit.length; j++) {
      const h = (hypeBybit[j].high - entry) / entry * 100;
      if (h > maxUp5m) maxUp5m = h;
    }

    // Binance same timestamp
    const bI = binanceIdx.get(bar.timestamp);
    let binanceMove: number | null = null;
    let binanceVol: number | null = null;
    if (bI !== undefined) {
      const bBar = btcBinance[bI];
      binanceMove = (bBar.close - bBar.open) / bBar.open * 100;
      binanceVol = bBar.turnover;
    }

    signals.push({
      ts: bar.timestamp,
      bybitMove: move,
      binanceMove,
      bybitVol: bar.turnover,
      binanceVol,
      combinedVol: bar.turnover + (binanceVol || 0),
      hypeEntry: entry,
      hypeRet3m: ret3m,
      hypeRet5m: ret5m,
      hypeMaxUp5m: maxUp5m,
      fresh,
      bothConfirm: binanceMove !== null && binanceMove >= THRESH,
      bothPositive: binanceMove !== null && binanceMove > 0,
      binanceStronger: binanceMove !== null && binanceMove >= move,
    });
  }

  const withBinance = signals.filter(s => s.binanceMove !== null);

  console.log(`\n${SEP}`);
  console.log(`  CROSS-EXCHANGE BTC SURGE VALIDATION — Bybit >= +${THRESH}% | ${signals.length} signals (${withBinance.length} with Binance overlap)`);
  console.log(SEP);

  // Correlation stats
  const matched = withBinance;
  const bothConfirm = matched.filter(s => s.bothConfirm);
  const bothPositive = matched.filter(s => s.bothPositive);
  const binanceNeg = matched.filter(s => s.binanceMove! <= 0);

  console.log(`\n  Binance agreement with Bybit surges:`);
  console.log(`    Binance also >= +${THRESH}%:  ${bothConfirm.length}/${matched.length} (${(bothConfirm.length/matched.length*100).toFixed(0)}%)`);
  console.log(`    Binance positive (> 0%):    ${bothPositive.length}/${matched.length} (${(bothPositive.length/matched.length*100).toFixed(0)}%)`);
  console.log(`    Binance negative or flat:    ${binanceNeg.length}/${matched.length} (${(binanceNeg.length/matched.length*100).toFixed(0)}%) ← Bybit-only noise`);

  // Average Binance move when Bybit surges
  const avgBinance = matched.reduce((s, v) => s + v.binanceMove!, 0) / matched.length;
  const avgBybit = matched.reduce((s, v) => s + v.bybitMove, 0) / matched.length;
  console.log(`\n    Avg Bybit move:   +${avgBybit.toFixed(3)}%`);
  console.log(`    Avg Binance move: ${avgBinance >= 0 ? "+" : ""}${avgBinance.toFixed(3)}%`);

  // Volume comparison
  const avgBybitVol = matched.reduce((s, v) => s + v.bybitVol, 0) / matched.length;
  const avgBinanceVol = matched.reduce((s, v) => s + (v.binanceVol || 0), 0) / matched.length;
  console.log(`\n    Avg Bybit turnover:   $${(avgBybitVol/1e6).toFixed(2)}M`);
  console.log(`    Avg Binance turnover: $${(avgBinanceVol/1e6).toFixed(2)}M`);
  console.log(`    Binance/Bybit ratio:  ${(avgBinanceVol/avgBybitVol).toFixed(2)}x`);

  // Now the key question: does cross-exchange confirmation improve HYPE outcomes?
  type Group = { label: string; sigs: Signal[] };
  const groups: Group[] = [
    { label: "ALL (Bybit only)", sigs: matched },
    { label: "BOTH >= THRESH", sigs: bothConfirm },
    { label: "BOTH positive", sigs: bothPositive },
    { label: "Bybit-only (Binance neg/flat)", sigs: binanceNeg },
    { label: "FRESH + BOTH >= THRESH", sigs: bothConfirm.filter(s => s.fresh) },
    { label: "FRESH + Bybit-only", sigs: binanceNeg.filter(s => s.fresh) },
  ];

  console.log(`\n  HYPE outcomes by cross-exchange filter:`);
  console.log(`  ${"Filter".padEnd(40)} ${"N".padStart(5)} ${"WR3m".padStart(6)} ${"Avg3m".padStart(8)} ${"Avg5m".padStart(8)} ${"AvgMaxUp".padStart(9)} ${"PF3m".padStart(6)}`);
  console.log("  " + DIV);

  for (const g of groups) {
    if (g.sigs.length < 3) continue;
    const n = g.sigs.length;
    const wins3 = g.sigs.filter(s => s.hypeRet3m > 0).length;
    const avg3 = g.sigs.reduce((s, v) => s + v.hypeRet3m, 0) / n;
    const avg5 = g.sigs.reduce((s, v) => s + v.hypeRet5m, 0) / n;
    const avgMax = g.sigs.reduce((s, v) => s + v.hypeMaxUp5m, 0) / n;
    const grossWin = g.sigs.filter(s => s.hypeRet3m > 0).reduce((s, v) => s + v.hypeRet3m, 0);
    const grossLoss = Math.abs(g.sigs.filter(s => s.hypeRet3m <= 0).reduce((s, v) => s + v.hypeRet3m, 0));
    const pf = grossLoss > 0 ? grossWin / grossLoss : Infinity;
    const fmt = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(3) + "%";

    console.log(`  ${g.label.padEnd(40)} ${String(n).padStart(5)} ${((wins3/n*100).toFixed(0) + "%").padStart(6)} ${fmt(avg3).padStart(8)} ${fmt(avg5).padStart(8)} ${fmt(avgMax).padStart(9)} ${pf.toFixed(2).padStart(6)}`);
  }

  // TP/SL simulation for confirmed vs unconfirmed
  console.log(`\n  TP/SL sim — BOTH CONFIRMED vs BYBIT-ONLY:`);
  console.log(`  ${"Group".padEnd(30)} ${"TP/SL".padEnd(10)} ${"WR".padStart(5)} ${"PF".padStart(6)} ${"$Net@3k".padStart(9)} ${"$Net@10k".padStart(10)}`);
  console.log("  " + DIV);

  for (const { label, sigs } of [
    { label: "Both confirmed", sigs: bothConfirm },
    { label: "Bybit-only noise", sigs: binanceNeg },
    { label: "Fresh + both confirmed", sigs: bothConfirm.filter(s => s.fresh) },
  ]) {
    if (sigs.length < 5) continue;

    for (const [tp, sl] of [[0.5, 0.3], [0.75, 0.5], [1.0, 0.75], [1.0, 1.0]]) {
      let wins = 0, stops = 0, expiries = 0, totalPnl = 0;

      for (const s of sigs) {
        const hypeI = hypeIdx.get(s.ts)!;
        const entry = s.hypeEntry;
        let outcome = "expiry";
        let pnl = 0;

        for (let m = 0; m < 30; m++) {
          const j = hypeI + 1 + m;
          if (j >= hypeBybit.length) break;
          const hi = (hypeBybit[j].high - entry) / entry * 100;
          const lo = (hypeBybit[j].low - entry) / entry * 100;
          if (lo <= -sl) { outcome = "stop"; pnl = -sl; break; }
          if (hi >= tp) { outcome = "tp"; pnl = tp; break; }
        }

        if (outcome === "expiry") {
          const exitI = Math.min(hypeI + 31, hypeBybit.length - 1);
          pnl = (hypeBybit[exitI].close - entry) / entry * 100;
        }

        if (outcome === "tp") wins++;
        else if (outcome === "stop") stops++;
        else expiries++;
        totalPnl += pnl;
      }

      const wr = wins / sigs.length * 100;
      const grossWin = wins * tp;
      const grossLoss = stops * sl;
      const pf = grossLoss > 0 ? grossWin / grossLoss : Infinity;
      const dollarPnl = totalPnl / 100 * 3000;
      const feesCost = sigs.length * 3000 * 0.0011;
      const net3k = dollarPnl - feesCost;
      const net10k = (totalPnl / 100 * 10000) - (sigs.length * 10000 * 0.0011);

      console.log(`  ${label.padEnd(30)} ${(tp + "/" + sl + "%").padEnd(10)} ${(wr.toFixed(0) + "%").padStart(5)} ${pf.toFixed(2).padStart(6)} ${(net3k >= 0 ? "+$" : "-$") + Math.abs(net3k).toFixed(0).padStart(1)}${" ".repeat(Math.max(0, 8 - ((net3k >= 0 ? "+$" : "-$") + Math.abs(net3k).toFixed(0)).length))} ${(net10k >= 0 ? "+$" : "-$") + Math.abs(net10k).toFixed(0)}`);
    }
    console.log("  " + DIV);
  }

  // Distribution of Binance moves when Bybit surges
  console.log(`\n  Binance move distribution when Bybit >= +${THRESH}%:`);
  const buckets = [
    { label: "< -0.2%", min: -Infinity, max: -0.2 },
    { label: "-0.2 to 0%", min: -0.2, max: 0 },
    { label: "0 to +0.2%", min: 0, max: 0.2 },
    { label: "+0.2 to +0.3%", min: 0.2, max: 0.3 },
    { label: "+0.3 to +0.5%", min: 0.3, max: 0.5 },
    { label: ">= +0.5%", min: 0.5, max: Infinity },
  ];
  for (const b of buckets) {
    const count = matched.filter(s => s.binanceMove! >= b.min && s.binanceMove! < b.max).length;
    const pct = (count / matched.length * 100).toFixed(1);
    const bar = "█".repeat(Math.round(count / matched.length * 40));
    console.log(`    ${b.label.padEnd(16)} ${String(count).padStart(4)} (${pct.padStart(5)}%) ${bar}`);
  }
}

console.log(`\n${SEP}`);
