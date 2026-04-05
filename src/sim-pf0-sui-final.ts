// sim-pf0-sui-final.ts — PF0 SUI with roc12h>5% block, $10k notional, 2.5/3
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
const ts1h = bars1h.map(b => b.timestamp);
const closes1h = bars1h.map(b => b.close);

function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

console.log(`SUI 1m: ${bars1m.length} candles | ${new Date(bars1m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(bars1m[bars1m.length - 1].timestamp).toISOString().slice(0, 10)}\n`);

// ── Signals ──
interface Sig { ts: number; price: number; barIdx: number; }
const signals: Sig[] = [];
let lastSigTs = 0;
for (let i = 4; i < bars1h.length; i++) {
  const pumpIdx = i - 3;
  const bar = bars1h[pumpIdx];
  const body = ((bar.close - bar.open) / bar.open) * 100;
  if (body < 2.0) continue;
  const pH = bar.high;
  let failed = true;
  for (let j = pumpIdx + 1; j <= i; j++) { if (bars1h[j].high > pH * 1.003) { failed = false; break; } }
  if (!failed) continue;
  let hasRed = false;
  for (let j = pumpIdx + 1; j <= i; j++) { if (bars1h[j].close < bars1h[j].open) { hasRed = true; break; } }
  if (!hasRed) continue;
  if (bars1h[i].timestamp - lastSigTs < 2 * 3600000) continue;
  signals.push({ ts: bars1h[i].timestamp, price: bars1h[i].close, barIdx: i });
  lastSigTs = bars1h[i].timestamp;
}

// ── Config ──
const NOTIONAL = 10000;
const FEE = 0.0011;
const MAX_HOLD = 720;
const TP_PCT = 2.5;
const SL_PCT = 3.0;
const DISC_END = new Date("2026-01-01").getTime();

// ── roc12h block ──
function isBlocked(barIdx: number): boolean {
  if (barIdx < 12) return false;
  const roc = ((closes1h[barIdx] - closes1h[barIdx - 12]) / closes1h[barIdx - 12]) * 100;
  return roc > 5;
}

console.log(`PF0 signals: ${signals.length} total | Notional: $${NOTIONAL} | TP=${TP_PCT}% SL=${SL_PCT}% | Block: roc12h>5%\n`);

interface MoStats { trades: number; wins: number; losses: number; flats: number; pnl: number; blocked: number; blockedLoss: number; }
const monthly = new Map<string, MoStats>();

let wins = 0, losses = 0, flats = 0, totalPnl = 0;
let discPnl = 0, discN = 0, valPnl = 0, valN = 0;
let blocked = 0, blockedLoss = 0;
const trades: BacktestTrade[] = [];

for (const sig of signals) {
  const mo = new Date(sig.ts).toISOString().slice(0, 7);
  if (!monthly.has(mo)) monthly.set(mo, { trades: 0, wins: 0, losses: 0, flats: 0, pnl: 0, blocked: 0, blockedLoss: 0 });
  const m = monthly.get(mo)!;

  // Sim regardless (to count blocked losses)
  const entryIdx = bsearch(ts1m, sig.ts + 3600000);
  if (entryIdx < 0 || entryIdx >= bars1m.length - 10) continue;
  const ep = sig.price;
  const tp = ep * (1 - TP_PCT / 100);
  const sl = ep * (1 + SL_PCT / 100);
  const maxIdx = Math.min(entryIdx + MAX_HOLD, bars1m.length - 1);
  let pnl = 0, outcome = "flat", exitIdx = maxIdx;

  for (let j = entryIdx + 1; j <= maxIdx; j++) {
    if (bars1m[j].high >= sl) { pnl = -SL_PCT / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "stop"; exitIdx = j; break; }
    if (bars1m[j].low <= tp) { pnl = TP_PCT / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "tp"; exitIdx = j; break; }
  }
  if (outcome === "flat") pnl = ((ep - bars1m[maxIdx].close) / ep) * NOTIONAL - NOTIONAL * FEE;

  if (isBlocked(sig.barIdx)) {
    blocked++;
    m.blocked++;
    if (pnl < 0) { blockedLoss++; m.blockedLoss++; }
    continue;
  }

  const exitPrice = outcome === "stop" ? sl : outcome === "tp" ? tp : bars1m[maxIdx].close;
  trades.push({
    strategy: "pf0-short", symbol: "SUIUSDT", side: "short",
    entryTime: sig.ts, exitTime: bars1m[exitIdx].timestamp,
    entryPrice: ep, exitPrice,
    notional: NOTIONAL, pnlUsd: pnl, pnlPct: (pnl / NOTIONAL) * 100,
    outcome, feesUsd: NOTIONAL * FEE,
  });

  totalPnl += pnl;
  m.trades++; m.pnl += pnl;
  if (outcome === "tp") { wins++; m.wins++; }
  else if (outcome === "stop") { losses++; m.losses++; }
  else { flats++; m.flats++; }

  if (sig.ts < DISC_END) { discPnl += pnl; discN++; }
  else { valPnl += pnl; valN++; }
}

const n = wins + losses + flats;
const wr = (wins / n * 100).toFixed(1);

// ── Equity curve ──
let equity = 0, peakEq = 0, maxDD = 0;
const eqByMonth = new Map<string, { minEq: number; maxEq: number; endEq: number; dd: number }>();
for (const t of trades) {
  equity += t.pnlUsd;
  if (equity > peakEq) peakEq = equity;
  const dd = peakEq - equity;
  if (dd > maxDD) maxDD = dd;
  const mo = new Date(t.entryTime).toISOString().slice(0, 7);
  const me = eqByMonth.get(mo) ?? { minEq: Infinity, maxEq: -Infinity, endEq: 0, dd: 0 };
  if (equity < me.minEq) me.minEq = equity;
  if (equity > me.maxEq) me.maxEq = equity;
  me.endEq = equity;
  if (dd > me.dd) me.dd = dd;
  eqByMonth.set(mo, me);
}

console.log(`${"═".repeat(120)}`);
console.log(`  PF0 SUI — $${NOTIONAL} notional | TP=${TP_PCT}% SL=${SL_PCT}% | Block: roc12h>5%`);
console.log(`  Trades: ${n} | Wins: ${wins} | Losses: ${losses} | Flats: ${flats} | WR: ${wr}%`);
console.log(`  Total PnL: $${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)} | MaxDD: $${maxDD.toFixed(0)}`);
console.log(`  Discovery: ${discN} trades, $${discPnl >= 0 ? "+" : ""}${discPnl.toFixed(0)} | Validation: ${valN} trades, $${valPnl >= 0 ? "+" : ""}${valPnl.toFixed(0)} ($${valN > 0 ? (valPnl / valN).toFixed(1) : "0"}/t)`);
console.log(`  Blocked by roc12h>5%: ${blocked} (${blockedLoss} were losses)`);
console.log(`${"═".repeat(120)}\n`);

console.log(`  ${"Month".padEnd(9)} ${"Trades".padEnd(7)} ${"W".padEnd(4)} ${"L".padEnd(4)} ${"F".padEnd(4)} ${"WR%".padEnd(7)} ${"PnL".padEnd(12)} ${"Blk".padEnd(5)} ${"BkL".padEnd(5)} ${"Equity".padEnd(12)} ${"DD".padEnd(10)} Split`);
console.log(`  ${"��".repeat(105)}`);

for (const [mo, m] of [...monthly.entries()].sort()) {
  const moWr = m.trades > 0 ? (m.wins / m.trades * 100).toFixed(0) : "—";
  const pS = `$${m.pnl >= 0 ? "+" : ""}${m.pnl.toFixed(0)}`;
  const eq = eqByMonth.get(mo);
  const eqS = eq ? `$${eq.endEq >= 0 ? "+" : ""}${eq.endEq.toFixed(0)}` : "—";
  const ddS = eq ? `$${eq.dd.toFixed(0)}` : "—";
  const split = new Date(mo + "-01").getTime() < DISC_END ? "disc" : "val";
  console.log(`  ${mo}   ${String(m.trades).padEnd(7)} ${String(m.wins).padEnd(4)} ${String(m.losses).padEnd(4)} ${String(m.flats).padEnd(4)} ${(moWr + "%").padEnd(7)} ${pS.padEnd(12)} ${String(m.blocked).padEnd(5)} ${String(m.blockedLoss).padEnd(5)} ${eqS.padEnd(12)} ${ddS.padEnd(10)} ${split}`);
}

console.log(`  ${"─".repeat(105)}`);
const totBlk = [...monthly.values()].reduce((s, m) => s + m.blocked, 0);
const totBlkL = [...monthly.values()].reduce((s, m) => s + m.blockedLoss, 0);
console.log(`  ${"TOTAL".padEnd(9)} ${String(n).padEnd(7)} ${String(wins).padEnd(4)} ${String(losses).padEnd(4)} ${String(flats).padEnd(4)} ${(wr + "%").padEnd(7)} ${"$" + (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(0)}`.padEnd(70) + `${totBlk}    ${totBlkL}\n`);

writeCsv(trades, { strategy: "pf0-filtered", symbol: "SUIUSDT", params: { tp: TP_PCT, sl: SL_PCT, n: "10k", f: "roc12h5" } });
