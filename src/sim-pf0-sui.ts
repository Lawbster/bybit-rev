// sim-pf0-sui.ts — PF0 sim on SUI, sweep TP/stop combos
import fs from "fs";
import { BacktestTrade, writeCsv } from "./backtest-writer";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

const bars1m: Candle[] = JSON.parse(fs.readFileSync("data/vps/SUIUSDT_1_full.json", "utf-8"));
bars1m.sort((a, b) => a.timestamp - b.timestamp);
console.log(`SUI 1m: ${bars1m.length} candles | ${new Date(bars1m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(bars1m[bars1m.length - 1].timestamp).toISOString().slice(0, 10)}\n`);

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

function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

interface Sig { ts: number; price: number; }
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
  signals.push({ ts: bars1h[i].timestamp, price: bars1h[i].close });
  lastSigTs = bars1h[i].timestamp;
}

console.log(`PF0 signals: ${signals.length}\n`);

const NOTIONAL = 5000;
const FEE = 0.0011;
const MAX_HOLD = 720;
const DISC_END = new Date("2026-01-01").getTime();

interface MoStats { trades: number; wins: number; losses: number; flats: number; pnl: number; }

const combos = [
  { tp: 1.5, sl: 3.0 },
  { tp: 2.0, sl: 3.0 },
  { tp: 2.0, sl: 4.0 },
  { tp: 2.0, sl: 5.0 },
  { tp: 2.5, sl: 3.0 },
  { tp: 2.5, sl: 4.0 },
  { tp: 2.5, sl: 5.0 },
  { tp: 3.0, sl: 5.0 },
];

console.log(`Notional: $${NOTIONAL} | Max hold: ${MAX_HOLD}m (12h) | Fee: ${FEE * 100}% RT\n`);
console.log(`${"TP/Stop".padEnd(10)} ${"N".padEnd(5)} ${"Wins".padEnd(5)} ${"Loss".padEnd(5)} ${"Flat".padEnd(5)} ${"WR%".padEnd(7)} ${"Total$".padEnd(10)} ${"DiscN".padEnd(6)} ${"Disc$".padEnd(10)} ${"Disc$/t".padEnd(9)} ${"ValN".padEnd(6)} ${"Val$".padEnd(10)} ${"Val$/t".padEnd(9)}`);
console.log("─".repeat(100));

const bestResults: { combo: typeof combos[0]; monthly: Map<string, MoStats>; valPnl: number; valN: number; }[] = [];

for (const combo of combos) {
  const monthly = new Map<string, MoStats>();
  let wins = 0, losses = 0, flats = 0, totalPnl = 0;
  let discPnl = 0, discN = 0, discW = 0;
  let valPnl = 0, valN = 0, valW = 0;

  const trades: BacktestTrade[] = [];

  for (const sig of signals) {
    const entryIdx = bsearch(ts1m, sig.ts + 3600000);
    if (entryIdx < 0 || entryIdx >= bars1m.length - 10) continue;
    const ep = sig.price;
    const tp = ep * (1 - combo.tp / 100);
    const sl = ep * (1 + combo.sl / 100);
    const maxIdx = Math.min(entryIdx + MAX_HOLD, bars1m.length - 1);
    let pnl = 0, outcome = "flat";
    let exitIdx = maxIdx;

    for (let j = entryIdx + 1; j <= maxIdx; j++) {
      if (bars1m[j].high >= sl) { pnl = -combo.sl / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "stop"; exitIdx = j; break; }
      if (bars1m[j].low <= tp) { pnl = combo.tp / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "tp"; exitIdx = j; break; }
    }
    if (outcome === "flat") pnl = ((ep - bars1m[maxIdx].close) / ep) * NOTIONAL - NOTIONAL * FEE;

    const exitPrice = outcome === "stop" ? sl : outcome === "tp" ? tp : bars1m[maxIdx].close;
    trades.push({
      strategy: "pf0-short", symbol: "SUIUSDT", side: "short",
      entryTime: sig.ts, exitTime: bars1m[exitIdx].timestamp,
      entryPrice: ep, exitPrice,
      notional: NOTIONAL, pnlUsd: pnl, pnlPct: (pnl / NOTIONAL) * 100,
      outcome, feesUsd: NOTIONAL * FEE,
    });

    totalPnl += pnl;
    if (outcome === "tp") wins++; else if (outcome === "stop") losses++; else flats++;
    if (sig.ts < DISC_END) { discPnl += pnl; discN++; if (pnl > 0) discW++; }
    else { valPnl += pnl; valN++; if (pnl > 0) valW++; }

    const mo = new Date(sig.ts).toISOString().slice(0, 7);
    if (!monthly.has(mo)) monthly.set(mo, { trades: 0, wins: 0, losses: 0, flats: 0, pnl: 0 });
    const m = monthly.get(mo)!;
    m.trades++; m.pnl += pnl;
    if (outcome === "tp") m.wins++; else if (outcome === "stop") m.losses++; else m.flats++;
  }

  const n = wins + losses + flats;
  const wr = (wins / n * 100).toFixed(1);
  const fmt = (v: number) => `$${v >= 0 ? "+" : ""}${v.toFixed(0)}`;
  const fmtPt = (v: number) => `$${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
  console.log(`${combo.tp}/${combo.sl}`.padEnd(10) +
    `${n}`.padEnd(5) + `${wins}`.padEnd(5) + `${losses}`.padEnd(5) + `${flats}`.padEnd(5) +
    `${wr}%`.padEnd(7) + fmt(totalPnl).padEnd(10) +
    `${discN}`.padEnd(6) + fmt(discPnl).padEnd(10) + fmtPt(discN > 0 ? discPnl / discN : 0).padEnd(9) +
    `${valN}`.padEnd(6) + fmt(valPnl).padEnd(10) + fmtPt(valN > 0 ? valPnl / valN : 0).padEnd(9));

  writeCsv(trades, { strategy: "pf0", symbol: "SUIUSDT", params: { tp: combo.tp, sl: combo.sl, hold: "12h" } });
  bestResults.push({ combo, monthly, valPnl, valN });
}

// Print monthly for top 3 by validation PnL
bestResults.sort((a, b) => b.valPnl - a.valPnl);
for (let k = 0; k < Math.min(3, bestResults.length); k++) {
  const { combo, monthly } = bestResults[k];
  console.log(`\n═══ Best #${k + 1}: TP=${combo.tp}% / Stop=${combo.sl}% — Monthly ═══`);
  console.log(`  ${"Month".padEnd(9)} Trades  Wins  Losses  Flats    PnL`);
  for (const [mo, m] of [...monthly.entries()].sort()) {
    console.log(`  ${mo}     ${String(m.trades).padStart(3)}     ${String(m.wins).padStart(3)}     ${String(m.losses).padStart(3)}     ${String(m.flats).padStart(3)}   $${m.pnl >= 0 ? "+" : ""}${m.pnl.toFixed(0)}`);
  }
}
