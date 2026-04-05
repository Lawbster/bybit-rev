// sim-dr0-sui.ts — DR0 (Dump Recovery) SUI long signal sweep
// Mirror of PF0: 1H red body >= X%, next 1-3 bars fail to break dump low,
// green confirmation bar → long entry at end of lookback window.
import fs from "fs";
import { BacktestTrade, writeCsv } from "./backtest-writer";

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
const closes1h = bars1h.map(b => b.close);

function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

console.log(`SUI 1m: ${bars1m.length} candles | ${new Date(bars1m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(bars1m[bars1m.length - 1].timestamp).toISOString().slice(0, 10)}\n`);

// ── Config grid ──
const DUMP_BODY_PCTS = [1.5, 2.0, 2.5, 3.0];
const FAIL_LOW_PCT = 0.3;
const LOOKBACK = 3;
const TP_PCTS = [1.0, 1.5, 2.0];
const SL_PCTS = [2.0, 3.0, 4.0];
const NOTIONAL = 10000;
const FEE = 0.0011;
const MAX_HOLD = 720; // 12h in 1m bars
const COOLDOWN_BARS = 2; // 2h min between signals
const DISC_END = new Date("2026-01-01").getTime();

// ── ROC 12h block (same as PF0 but inverted: block if dumped too hard) ──
const ROC12H_BLOCK_PCTS = [0, -5, -8]; // 0 = disabled, -5 = block if dropped >5%

function detectDR0(dumpBodyPct: number, roc12hBlock: number): { ts: number; price: number; barIdx: number }[] {
  const signals: { ts: number; price: number; barIdx: number }[] = [];
  let lastSigTs = 0;

  for (let i = LOOKBACK + 1; i < bars1h.length; i++) {
    const dumpIdx = i - LOOKBACK;
    const bar = bars1h[dumpIdx];
    // Red body: open > close, body % measured as drop
    const bodyPct = ((bar.open - bar.close) / bar.open) * 100;
    if (bodyPct < dumpBodyPct) continue;

    const dumpLow = bar.low;
    let failed = true; // "failed to break lower" = recovery
    for (let j = dumpIdx + 1; j <= i; j++) {
      if (bars1h[j].low < dumpLow * (1 - FAIL_LOW_PCT / 100)) {
        failed = false;
        break;
      }
    }
    if (!failed) continue;

    // Green confirmation bar
    let hasGreen = false;
    for (let j = dumpIdx + 1; j <= i; j++) {
      if (bars1h[j].close > bars1h[j].open) { hasGreen = true; break; }
    }
    if (!hasGreen) continue;

    // Cooldown
    if (bars1h[i].timestamp - lastSigTs < COOLDOWN_BARS * 3600000) continue;

    // ROC 12h block: if price crashed too hard, skip (capitulation, not recovery)
    if (roc12hBlock < 0 && i >= 12) {
      const roc = ((closes1h[i] - closes1h[i - 12]) / closes1h[i - 12]) * 100;
      if (roc < roc12hBlock) continue; // e.g. roc < -5% means dropped more than 5%
    }

    signals.push({ ts: bars1h[i].timestamp, price: bars1h[i].close, barIdx: i });
    lastSigTs = bars1h[i].timestamp;
  }
  return signals;
}

// ── Sweep ──
interface Result {
  dumpPct: number; tpPct: number; slPct: number; roc12h: number;
  trades: number; wins: number; losses: number; flats: number;
  wr: number; totalPnl: number; maxDD: number;
  discN: number; discPnl: number; valN: number; valPnl: number;
}

const results: Result[] = [];

console.log(`${"Dump%".padEnd(7)} ${"TP%".padEnd(6)} ${"SL%".padEnd(6)} ${"Roc12h".padEnd(8)} ${"Trades".padEnd(8)} ${"Wins".padEnd(6)} ${"Loss".padEnd(6)} ${"WR%".padEnd(7)} ${"PnL".padEnd(12)} ${"MaxDD".padEnd(10)} ${"D:N".padEnd(6)} ${"D:PnL".padEnd(10)} ${"V:N".padEnd(6)} ${"V:PnL".padEnd(10)} ${"V:$/t".padEnd(8)}`);
console.log("─".repeat(130));

for (const dumpPct of DUMP_BODY_PCTS) {
  for (const roc12h of ROC12H_BLOCK_PCTS) {
    const signals = detectDR0(dumpPct, roc12h);

    for (const tpPct of TP_PCTS) {
      for (const slPct of SL_PCTS) {
        let wins = 0, losses = 0, flats = 0, totalPnl = 0;
        let discPnl = 0, discN = 0, valPnl = 0, valN = 0;
        let equity = 0, peakEq = 0, maxDD = 0;
        const trades: BacktestTrade[] = [];

        for (const sig of signals) {
          const entryIdx = bsearch(ts1m, sig.ts + 3600000);
          if (entryIdx < 0 || entryIdx >= bars1m.length - 10) continue;

          const ep = sig.price;
          const tp = ep * (1 + tpPct / 100);
          const sl = ep * (1 - slPct / 100);
          const maxIdx = Math.min(entryIdx + MAX_HOLD, bars1m.length - 1);
          let pnl = 0, outcome = "flat", exitIdx = maxIdx;

          for (let j = entryIdx + 1; j <= maxIdx; j++) {
            // Stop first (conservative)
            if (bars1m[j].low <= sl) { pnl = -slPct / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "stop"; exitIdx = j; break; }
            if (bars1m[j].high >= tp) { pnl = tpPct / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "tp"; exitIdx = j; break; }
          }
          if (outcome === "flat") pnl = ((bars1m[maxIdx].close - ep) / ep) * NOTIONAL - NOTIONAL * FEE;

          const exitPrice = outcome === "stop" ? sl : outcome === "tp" ? tp : bars1m[maxIdx].close;
          trades.push({
            strategy: "dr0-long", symbol: "SUIUSDT", side: "long",
            entryTime: sig.ts, exitTime: bars1m[exitIdx].timestamp,
            entryPrice: ep, exitPrice,
            notional: NOTIONAL, pnlUsd: pnl, pnlPct: (pnl / NOTIONAL) * 100,
            outcome, feesUsd: NOTIONAL * FEE,
          });

          totalPnl += pnl;
          equity += pnl;
          if (equity > peakEq) peakEq = equity;
          const dd = peakEq - equity;
          if (dd > maxDD) maxDD = dd;

          if (outcome === "tp") wins++;
          else if (outcome === "stop") losses++;
          else flats++;

          if (sig.ts < DISC_END) { discPnl += pnl; discN++; }
          else { valPnl += pnl; valN++; }
        }

        const n = wins + losses + flats;
        if (n === 0) continue;
        const wr = wins / n * 100;

        results.push({ dumpPct, tpPct, slPct, roc12h, trades: n, wins, losses, flats, wr, totalPnl, maxDD, discN, discPnl, valN, valPnl });

        const vpt = valN > 0 ? (valPnl / valN).toFixed(1) : "—";
        const pnlS = `$${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)}`;
        console.log(
          `${dumpPct.toFixed(1).padEnd(7)} ${tpPct.toFixed(1).padEnd(6)} ${slPct.toFixed(1).padEnd(6)} ${(roc12h === 0 ? "off" : roc12h + "%").padEnd(8)} ` +
          `${String(n).padEnd(8)} ${String(wins).padEnd(6)} ${String(losses).padEnd(6)} ${(wr.toFixed(1) + "%").padEnd(7)} ${pnlS.padEnd(12)} ` +
          `$${maxDD.toFixed(0).padEnd(9)} ${String(discN).padEnd(6)} $${(discPnl >= 0 ? "+" : "") + discPnl.toFixed(0).padEnd(9)} ` +
          `${String(valN).padEnd(6)} $${(valPnl >= 0 ? "+" : "") + valPnl.toFixed(0).padEnd(9)} ${vpt}`
        );

        // Write CSV for best combos only (positive validation PnL)
        if (valPnl > 0 && valN >= 5) {
          const rTag = roc12h === 0 ? "" : `-roc${Math.abs(roc12h)}`;
          writeCsv(trades, { strategy: "dr0-long", symbol: "SUIUSDT", params: { dump: dumpPct, tp: tpPct, sl: slPct, ...(roc12h !== 0 ? { roc: roc12h } : {}) } });
        }
      }
    }
  }
}

// ── Top 10 by validation PnL ──
console.log(`\n${"═".repeat(130)}`);
console.log("  TOP 10 by validation $/trade (min 5 val trades):\n");
const top = results.filter(r => r.valN >= 5).sort((a, b) => (b.valPnl / b.valN) - (a.valPnl / a.valN)).slice(0, 10);
for (const r of top) {
  const vpt = (r.valPnl / r.valN).toFixed(1);
  console.log(`  dump=${r.dumpPct}% tp=${r.tpPct}% sl=${r.slPct}% roc12h=${r.roc12h || "off"} | ${r.trades}t WR=${r.wr.toFixed(1)}% PnL=$${r.totalPnl >= 0 ? "+" : ""}${r.totalPnl.toFixed(0)} DD=$${r.maxDD.toFixed(0)} | val: ${r.valN}t $${r.valPnl >= 0 ? "+" : ""}${r.valPnl.toFixed(0)} ($${vpt}/t)`);
}
console.log(`${"═".repeat(130)}`);
