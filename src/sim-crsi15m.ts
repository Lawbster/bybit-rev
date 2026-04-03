// CRSI < threshold Long on 15m — TP/SL sweep
// npx ts-node src/sim-crsi15m.ts

import fs from "fs";
import { RSI } from "technicalindicators";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";

const c5m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
c5m.sort((a, b) => a.timestamp - b.timestamp);

const c15m = aggregate(c5m, 15).filter(c => new Date(c.timestamp).toISOString() >= "2025-01-01");
const closes = c15m.map(c => c.close);

// ── CRSI series ──────────────────────────────────────────────────
function crsiSeries(cls: number[], rsiP = 3, streakP = 2, lb = 100): (number | null)[] {
  const out: (number | null)[] = new Array(cls.length).fill(null);
  const minLen = Math.max(rsiP + 1, streakP + 1, lb + 1);
  for (let i = minLen; i < cls.length; i++) {
    const sl = cls.slice(0, i + 1);
    const r3 = RSI.calculate({ period: rsiP, values: sl });
    const streaks: number[] = [];
    let streak = 0;
    for (let j = 1; j < sl.length; j++) {
      if      (sl[j] > sl[j-1]) streak = streak > 0 ? streak + 1 : 1;
      else if (sl[j] < sl[j-1]) streak = streak < 0 ? streak - 1 : -1;
      else streak = 0;
      streaks.push(streak);
    }
    const sr = RSI.calculate({ period: streakP, values: streaks });
    const ret = (sl[sl.length-1] - sl[sl.length-2]) / sl[sl.length-2] * 100;
    const hist = sl.slice(-lb - 1);
    const rets = hist.slice(1).map((v, k) => (v - hist[k]) / hist[k] * 100);
    const rank = rets.filter(r => r < ret).length / rets.length * 100;
    out[i] = +((r3[r3.length-1] + sr[sr.length-1] + rank) / 3).toFixed(2);
  }
  return out;
}

console.log("Computing 15m CRSI series...");
const crsi = crsiSeries(closes);
console.log("Done.\n");

// ── Sim ──────────────────────────────────────────────────────────
const FEE      = 0.00055;
const NOTIONAL = 1000;
const CAPITAL  = 1000;

function sess(ts: number) {
  const h = new Date(ts).getUTCHours();
  return h < 8 ? "Asia" : h < 13 ? "London" : "US";
}
function dow(ts: number) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(ts).getUTCDay()];
}

interface Trade {
  date: string; session: string; day: string;
  exitReason: "TP"|"SL"|"EXPIRY";
  pnlUsdt: number; crsiVal: number;
}

function runSim(cfg: {
  label: string; threshold: number; rearm: number;
  tpPct: number; slPct: number; maxBars: number;
  sessionFilter?: string; dayFilter?: string[];
}): { trades: Trade[]; pnl: number; wr: number; maxDD: number } {
  const trades: Trade[] = [];
  let armed = true;

  for (let i = 1; i < crsi.length; i++) {
    const prev = crsi[i - 1];
    const curr = crsi[i];
    if (prev === null || curr === null) continue;

    if (!armed && curr >= cfg.rearm) armed = true;

    if (armed && prev >= cfg.threshold && curr < cfg.threshold) {
      armed = false;
      const bar = c15m[i];
      const s = sess(bar.timestamp);
      const d = dow(bar.timestamp);

      if (cfg.sessionFilter && s !== cfg.sessionFilter) continue;
      if (cfg.dayFilter && !cfg.dayFilter.includes(d)) continue;

      const entry = bar.close;
      const tp = entry * (1 + cfg.tpPct / 100);
      const sl = entry * (1 - cfg.slPct / 100);

      let exitReason: "TP"|"SL"|"EXPIRY" = "EXPIRY";
      let exitPrice = 0;
      let barsHeld = 0;

      for (let j = i + 1; j < c15m.length && barsHeld < cfg.maxBars; j++) {
        barsHeld++;
        const b = c15m[j];
        if (b.low <= sl)  { exitReason = "SL"; exitPrice = sl; break; }
        if (b.high >= tp) { exitReason = "TP"; exitPrice = tp; break; }
        if (barsHeld === cfg.maxBars) exitPrice = b.close;
      }
      if (exitPrice === 0) continue;

      const gross = exitReason === "TP" ? cfg.tpPct / 100
                  : exitReason === "SL" ? -cfg.slPct / 100
                  : (exitPrice - entry) / entry;
      const net = gross - FEE * 2;

      trades.push({
        date: new Date(bar.timestamp).toISOString().slice(0, 16),
        session: s, day: d,
        exitReason,
        pnlUsdt: +(net * NOTIONAL).toFixed(2),
        crsiVal: curr,
      });
    }
  }

  let equity = CAPITAL, peak = CAPITAL, maxDD = 0, totalPnl = 0;
  for (const t of trades) {
    equity += t.pnlUsdt;
    totalPnl += t.pnlUsdt;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  }

  const wins = trades.filter(t => t.exitReason === "TP").length;
  return { trades, pnl: totalPnl, wr: trades.length ? wins / trades.length * 100 : 0, maxDD };
}

// ── Sweeps ───────────────────────────────────────────────────────
const $ = (v: number) => (v >= 0 ? "$+" : "$") + v.toFixed(0);
const SEP = "═".repeat(100);

function header(title: string) {
  console.log(`\n${SEP}\n  ${title}\n${SEP}`);
  console.log(`  ${"Config".padEnd(36)} ${"N".padEnd(5)} ${"WR".padEnd(7)} ${"PnL".padEnd(10)} ${"MaxDD".padEnd(8)} BEven%`);
  console.log("  " + "─".repeat(80));
}

function row(label: string, cfg: Parameters<typeof runSim>[0]) {
  const r = runSim(cfg);
  const beWr = (cfg.slPct + FEE * 200) / (cfg.tpPct + cfg.slPct) * 100;
  console.log(
    `  ${label.padEnd(36)} N=${String(r.trades.length).padEnd(4)} WR=${r.wr.toFixed(0).padStart(3)}%` +
    `  PnL=${$(r.pnl).padStart(7)}  DD=${r.maxDD.toFixed(1).padStart(5)}%  BE=${beWr.toFixed(0)}%`
  );
}

// Section 1: CRSI threshold + TP/SL sweep (all sessions)
header("SECTION 1 — CRSI threshold + TP/SL sweep (all sessions, CRSI rearm=35)");
for (const threshold of [20, 25, 30]) {
  for (const [tp, sl] of [[0.3,0.5],[0.5,0.5],[1.0,0.5],[1.5,1.0],[2.0,1.0],[3.0,1.5]]) {
    row(`CRSI<${threshold} TP${tp}% SL${sl}%`, { label:"", threshold, rearm:35, tpPct:tp, slPct:sl, maxBars:96 });
  }
}

// Section 2: US session only
header("SECTION 2 — US session only");
for (const threshold of [20, 25]) {
  for (const [tp, sl] of [[0.5,0.5],[1.0,0.5],[1.5,1.0],[2.0,1.0],[3.0,1.5]]) {
    row(`CRSI<${threshold} US TP${tp}% SL${sl}%`, { label:"", threshold, rearm:35, tpPct:tp, slPct:sl, maxBars:96, sessionFilter:"US" });
  }
}

// Section 3: US Tue+Thu+Fri (best days from CRSI study)
header("SECTION 3 — US session, Tue/Thu/Fri only");
for (const threshold of [20, 25]) {
  for (const [tp, sl] of [[0.5,0.5],[1.0,0.5],[1.5,1.0],[2.0,1.0],[3.0,1.5]]) {
    row(`CRSI<${threshold} US T/T/F TP${tp}% SL${sl}%`, { label:"", threshold, rearm:35, tpPct:tp, slPct:sl, maxBars:96, sessionFilter:"US", dayFilter:["Tue","Thu","Fri"] });
  }
}

// Section 4: Best config per-session breakdown
header("SECTION 4 — Session breakdown at best config (CRSI<25 TP1% SL0.5%)");
for (const s of ["Asia","London","US"]) {
  row(`${s}`, { label:"", threshold:25, rearm:35, tpPct:1.0, slPct:0.5, maxBars:96, sessionFilter:s });
}
// Day breakdown
header("SECTION 5 — Day breakdown (CRSI<25 TP1% SL0.5%, all sessions)");
for (const d of ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]) {
  row(d, { label:"", threshold:25, rearm:35, tpPct:1.0, slPct:0.5, maxBars:96, dayFilter:[d] });
}
console.log();
