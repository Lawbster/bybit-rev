// 15m RSI < 25 long — TP 0.3% SL 0.5%
// npx ts-node src/sim-rsi15m.ts

import fs from "fs";
import { RSI } from "technicalindicators";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";

const c5m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
c5m.sort((a, b) => a.timestamp - b.timestamp);

const c15m = aggregate(c5m, 15).filter(c => new Date(c.timestamp).toISOString() >= "2025-01-01");
const closes = c15m.map(c => c.close);

const RSI_PERIOD  = 14;
const RSI_ENTRY   = 25;
const RSI_REARM   = 35;
const TP_PCT      = 0.003;
const SL_PCT      = 0.005;
const FEE         = 0.00055; // taker both sides
const CAPITAL     = 1000;
const NOTIONAL    = 1000;
const MAX_BARS    = 96;      // max hold: 96 × 15m = 24h expiry

const rsiVals = RSI.calculate({ period: RSI_PERIOD, values: closes });
const rsiOffset = closes.length - rsiVals.length;

interface Trade {
  date: string; session: string; day: string;
  entry: number; exit: number; exitReason: "TP"|"SL"|"EXPIRY";
  pnlPct: number; pnlUsdt: number; barsHeld: number;
  rsiAtEntry: number;
}

function sess(ts: number) {
  const h = new Date(ts).getUTCHours();
  return h < 8 ? "Asia" : h < 13 ? "London" : "US";
}
function dow(ts: number) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(ts).getUTCDay()];
}

const trades: Trade[] = [];
let armed = true;

for (let i = 1; i < rsiVals.length; i++) {
  const barIdx = i + rsiOffset;
  const rsiPrev = rsiVals[i - 1];
  const rsiCurr = rsiVals[i];

  if (!armed && rsiCurr >= RSI_REARM) armed = true;

  // Signal: cross below RSI_ENTRY
  if (armed && rsiPrev >= RSI_ENTRY && rsiCurr < RSI_ENTRY) {
    armed = false;
    const entryBar = c15m[barIdx];
    const entry = entryBar.close;
    const tp    = entry * (1 + TP_PCT);
    const sl    = entry * (1 - SL_PCT);

    let exitReason: "TP"|"SL"|"EXPIRY" = "EXPIRY";
    let exitPrice = 0;
    let barsHeld = 0;

    for (let j = barIdx + 1; j < c15m.length && barsHeld < MAX_BARS; j++) {
      barsHeld++;
      const b = c15m[j];
      // Check SL first (worst case within bar)
      if (b.low <= sl) { exitReason = "SL"; exitPrice = sl; break; }
      if (b.high >= tp) { exitReason = "TP"; exitPrice = tp; break; }
      if (barsHeld === MAX_BARS) exitPrice = b.close;
    }
    if (exitPrice === 0) continue;

    const gross = (exitReason === "TP" ? TP_PCT : exitReason === "SL" ? -SL_PCT : (exitPrice - entry) / entry);
    const fees  = FEE * 2;
    const net   = gross - fees;
    const pnlUsdt = net * NOTIONAL;

    trades.push({
      date: new Date(entryBar.timestamp).toISOString().slice(0, 16),
      session: sess(entryBar.timestamp),
      day: dow(entryBar.timestamp),
      entry, exit: exitPrice, exitReason,
      pnlPct: +(net * 100).toFixed(3),
      pnlUsdt: +pnlUsdt.toFixed(2),
      barsHeld,
      rsiAtEntry: +rsiCurr.toFixed(1),
    });
  }
}

// ── Analysis ─────────────────────────────────────────────────────
const avg  = (a: number[]) => a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0;
const sum  = (a: number[]) => a.reduce((s,v)=>s+v,0);
const pct  = (v: number) => (v>=0?"+":"")+v.toFixed(2)+"%";
const $    = (v: number) => (v>=0?"$+":"$")+v.toFixed(2);

function printSlice(label: string, t: Trade[]) {
  if (!t.length) return;
  const wins = t.filter(x => x.exitReason === "TP");
  const loss = t.filter(x => x.exitReason === "SL");
  const exp  = t.filter(x => x.exitReason === "EXPIRY");
  const wr   = wins.length / t.length * 100;
  const totalPnl = sum(t.map(x=>x.pnlUsdt));
  const avgBars = avg(t.map(x=>x.barsHeld));
  console.log(
    `  ${label.padEnd(20)} N=${String(t.length).padEnd(4)} WR=${wr.toFixed(0).padStart(3)}%` +
    `  TP=${wins.length} SL=${loss.length} EXP=${exp.length}` +
    `  PnL=${$(totalPnl).padStart(8)}` +
    `  avg_bars=${avgBars.toFixed(0).padStart(3)}`
  );
}

const SEP = "═".repeat(90);
console.log(`\n${SEP}`);
console.log(`  15m RSI<${RSI_ENTRY} Long — TP ${TP_PCT*100}% | SL ${SL_PCT*100}% | $${NOTIONAL} notional | fee ${FEE*100}% each side`);
console.log(`  Break-even WR: ${((SL_PCT+FEE*2)/(TP_PCT+SL_PCT)*100).toFixed(1)}%   (net win=${pct((TP_PCT-FEE*2)*100)} net loss=${pct(-(SL_PCT+FEE*2)*100)})`);
console.log(`  Signals: ${trades.length}  |  ${trades[0]?.date} → ${trades[trades.length-1]?.date}`);
console.log(SEP);

console.log(`\n  ${"Slice".padEnd(20)} ${"N".padEnd(6)} ${"WR".padEnd(6)} ${"TP/SL/EXP".padEnd(16)} ${"PnL".padEnd(10)} avg_bars`);
console.log("  " + "─".repeat(80));
printSlice("ALL", trades);

console.log("\n  ── By session ──");
for (const s of ["Asia","London","US"]) printSlice(s, trades.filter(t=>t.session===s));

console.log("\n  ── By day ──");
for (const d of ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]) {
  const sub = trades.filter(t=>t.day===d);
  if (sub.length) printSlice(d, sub);
}

console.log("\n  ── US by day ──");
for (const d of ["Mon","Tue","Wed","Thu","Fri"]) {
  const sub = trades.filter(t=>t.session==="US"&&t.day===d);
  if (sub.length) printSlice(`US-${d}`, sub);
}

console.log("\n  ── By RSI depth ──");
printSlice("RSI 20-25", trades.filter(t=>t.rsiAtEntry>=20));
printSlice("RSI 15-20", trades.filter(t=>t.rsiAtEntry>=15&&t.rsiAtEntry<20));
printSlice("RSI < 15",  trades.filter(t=>t.rsiAtEntry<15));

// Running PnL
console.log("\n  ── Equity curve (all trades) ──");
let equity = CAPITAL, peak = CAPITAL, maxDD = 0;
for (const t of trades) {
  equity += t.pnlUsdt;
  if (equity > peak) peak = equity;
  const dd = (peak - equity) / peak * 100;
  if (dd > maxDD) maxDD = dd;
}
console.log(`  Final equity: $${equity.toFixed(2)}  |  Max DD: ${maxDD.toFixed(1)}%  |  Total PnL: ${$(equity-CAPITAL)}`);
console.log();
