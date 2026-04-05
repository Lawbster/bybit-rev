// sim-dr0-sui-deep.ts — Deep dive: swing low long signals on SUI
// Focus: Drop>5% + 4H bull, BB<0.1 + 4H bull, combos, month-by-month
import fs from "fs";
import { EMA, RSI, ATR, BollingerBands, SMA } from "technicalindicators";
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
const bars4h = agg(bars1m, 240);
const ts1m = bars1m.map(b => b.timestamp);

console.log(`SUI data: ${new Date(bars1m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(bars1m[bars1m.length - 1].timestamp).toISOString().slice(0, 10)}`);
console.log(`1h: ${bars1h.length} | 4h: ${bars4h.length}\n`);

// ── 1H indicators ──
const closes1h = bars1h.map(b => b.close);
const highs1h = bars1h.map(b => b.high);
const lows1h = bars1h.map(b => b.low);

const ema9 = EMA.calculate({ period: 9, values: closes1h });
const ema21 = EMA.calculate({ period: 21, values: closes1h });
const ema50 = EMA.calculate({ period: 50, values: closes1h });
const rsi14 = RSI.calculate({ period: 14, values: closes1h });
const atr14 = ATR.calculate({ period: 14, high: highs1h, low: lows1h, close: closes1h });
const bb20 = BollingerBands.calculate({ period: 20, values: closes1h, stdDev: 2 });
const sma20vol = SMA.calculate({ period: 20, values: bars1h.map(b => b.volume) });

const OFF9 = closes1h.length - ema9.length;
const OFF21 = closes1h.length - ema21.length;
const OFF50 = closes1h.length - ema50.length;
const OFFRSI = closes1h.length - rsi14.length;
const OFFATR = closes1h.length - atr14.length;
const OFFBB = closes1h.length - bb20.length;
const OFFVOL = closes1h.length - sma20vol.length;

function getVal(arr: number[], off: number, i: number): number { return i >= off ? arr[i - off] : NaN; }

// ── 4H indicators ──
const closes4h = bars4h.map(b => b.close);
const ema9_4h = EMA.calculate({ period: 9, values: closes4h });
const ema21_4h = EMA.calculate({ period: 21, values: closes4h });
const rsi14_4h = RSI.calculate({ period: 14, values: closes4h });
const OFF9_4H = closes4h.length - ema9_4h.length;
const OFF21_4H = closes4h.length - ema21_4h.length;
const OFFRSI_4H = closes4h.length - rsi14_4h.length;

const ts4h = bars4h.map(b => b.timestamp);
function find4hIdx(ts: number): number {
  const k = Math.floor(ts / (240 * 60000)) * (240 * 60000);
  let lo = 0, hi = ts4h.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (ts4h[mid] <= k) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

// ── Find swing lows ──
const SWING_WINDOW = 6;

interface SwingLow {
  idx: number; ts: number; low: number; close: number;
  dropPct: number; rsi: number; rsi4h: number;
  ema9dist: number; ema21dist: number; ema50dist: number;
  bbPos: number; volRatio: number; atrPct: number;
  ema4hBull: boolean; utcHour: number;
}

const swingLows: SwingLow[] = [];

for (let i = SWING_WINDOW + 50; i < bars1h.length - 12; i++) {
  const bar = bars1h[i];
  let isSwingLow = true;
  for (let j = i - SWING_WINDOW; j <= i + SWING_WINDOW; j++) {
    if (j === i) continue;
    if (bars1h[j].low < bar.low) { isSwingLow = false; break; }
  }
  if (!isSwingLow) continue;

  let priorHigh = 0;
  for (let j = Math.max(0, i - 24); j < i; j++) {
    if (bars1h[j].high > priorHigh) priorHigh = bars1h[j].high;
  }
  const dropPct = ((priorHigh - bar.low) / priorHigh) * 100;
  if (dropPct < 2) continue;

  const rsi = getVal(rsi14, OFFRSI, i);
  const e9 = getVal(ema9, OFF9, i);
  const e21 = getVal(ema21, OFF21, i);
  const e50 = getVal(ema50, OFF50, i);
  let bbPos = NaN;
  if (i >= OFFBB) { const bb = bb20[i - OFFBB]; bbPos = (bar.close - bb.lower) / (bb.upper - bb.lower); }
  let volRatio = NaN;
  if (i >= OFFVOL) volRatio = bar.volume / sma20vol[i - OFFVOL];
  const atrPct = i >= OFFATR ? (atr14[i - OFFATR] / bar.close) * 100 : NaN;

  const i4h = find4hIdx(bar.timestamp);
  const rsi4h = i4h >= OFFRSI_4H ? rsi14_4h[i4h - OFFRSI_4H] : NaN;
  const e9_4h = i4h >= OFF9_4H ? ema9_4h[i4h - OFF9_4H] : NaN;
  const e21_4h = i4h >= OFF21_4H ? ema21_4h[i4h - OFF21_4H] : NaN;
  const ema4hBull = !isNaN(e9_4h) && !isNaN(e21_4h) && e9_4h > e21_4h;

  swingLows.push({
    idx: i, ts: bar.timestamp, low: bar.low, close: bar.close, dropPct,
    rsi, rsi4h, ema9dist: ((bar.close - e9) / e9) * 100,
    ema21dist: ((bar.close - e21) / e21) * 100,
    ema50dist: ((bar.close - e50) / e50) * 100,
    bbPos, volRatio, atrPct, ema4hBull,
    utcHour: new Date(bar.timestamp).getUTCHours(),
  });
}

// ── Sim engine ──
const DISC_END = new Date("2026-01-01").getTime();
const NOTIONAL = 10000;
const FEE_RT = 0.0011;

interface SimConfig {
  label: string;
  filter: (s: SwingLow) => boolean;
  tpPct: number;
  slPct: number;
  maxHold: number; // minutes
  delayBars: number; // 1h bars to wait after swing low before entry
}

interface MonthStats {
  trades: number; wins: number; losses: number; flats: number; pnl: number;
}

function runSim(cfg: SimConfig) {
  const sigs = swingLows.filter(cfg.filter);
  let wins = 0, losses = 0, flats = 0, totalPnl = 0;
  let equity = 0, peakEq = 0, maxDD = 0;
  let discN = 0, discPnl = 0, valN = 0, valPnl = 0;
  const monthly = new Map<string, MonthStats>();
  const trades: BacktestTrade[] = [];
  let lastEntryTs = 0;

  for (const sig of sigs) {
    // Cooldown: at least 6h between entries
    if (sig.ts - lastEntryTs < 6 * 3600000) continue;

    const entryBarIdx = sig.idx + 1 + cfg.delayBars;
    if (entryBarIdx >= bars1h.length) continue;
    const entryBar = bars1h[entryBarIdx];
    const ep = entryBar.close;

    const entryTs = entryBar.timestamp;
    const entryIdx1m = bsearch(ts1m, entryTs + 3600000); // start of next 1m bar after entry bar close
    if (entryIdx1m < 0 || entryIdx1m >= bars1m.length - 10) continue;

    const tp = ep * (1 + cfg.tpPct / 100);
    const sl = ep * (1 - cfg.slPct / 100);
    const maxIdx = Math.min(entryIdx1m + cfg.maxHold, bars1m.length - 1);

    let pnl = 0, outcome = "flat", exitIdx = maxIdx;
    for (let j = entryIdx1m + 1; j <= maxIdx; j++) {
      if (bars1m[j].low <= sl) { pnl = -cfg.slPct / 100 * NOTIONAL - NOTIONAL * FEE_RT; outcome = "stop"; exitIdx = j; break; }
      if (bars1m[j].high >= tp) { pnl = cfg.tpPct / 100 * NOTIONAL - NOTIONAL * FEE_RT; outcome = "tp"; exitIdx = j; break; }
    }
    if (outcome === "flat") pnl = ((bars1m[maxIdx].close - ep) / ep) * NOTIONAL - NOTIONAL * FEE_RT;

    const exitPrice = outcome === "stop" ? sl : outcome === "tp" ? tp : bars1m[maxIdx].close;

    trades.push({
      strategy: "dr0-long", symbol: "SUIUSDT", side: "long",
      entryTime: entryTs, exitTime: bars1m[exitIdx].timestamp,
      entryPrice: ep, exitPrice,
      notional: NOTIONAL, pnlUsd: pnl, pnlPct: (pnl / NOTIONAL) * 100,
      outcome, feesUsd: NOTIONAL * FEE_RT,
    });

    lastEntryTs = entryTs;
    totalPnl += pnl; equity += pnl;
    if (equity > peakEq) peakEq = equity;
    if (peakEq - equity > maxDD) maxDD = peakEq - equity;
    if (outcome === "tp") wins++; else if (outcome === "stop") losses++; else flats++;
    if (sig.ts < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }

    const mo = new Date(entryTs).toISOString().slice(0, 7);
    if (!monthly.has(mo)) monthly.set(mo, { trades: 0, wins: 0, losses: 0, flats: 0, pnl: 0 });
    const m = monthly.get(mo)!;
    m.trades++; m.pnl += pnl;
    if (outcome === "tp") m.wins++; else if (outcome === "stop") m.losses++; else m.flats++;
  }

  return { wins, losses, flats, totalPnl, maxDD, discN, discPnl, valN, valPnl, monthly, trades };
}

function printResult(cfg: SimConfig) {
  const r = runSim(cfg);
  const n = r.wins + r.losses + r.flats;
  if (n === 0) { console.log(`  ${cfg.label}: 0 trades`); return r; }
  const wr = (r.wins / n * 100).toFixed(1);
  const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(1) : "—";

  console.log(`\n${"═".repeat(130)}`);
  console.log(`  ${cfg.label} | TP=${cfg.tpPct}% SL=${cfg.slPct}% | Hold=${cfg.maxHold / 60}h | Delay=${cfg.delayBars}h`);
  console.log(`  Trades: ${n} | W: ${r.wins} L: ${r.losses} F: ${r.flats} | WR: ${wr}%`);
  console.log(`  PnL: $${r.totalPnl >= 0 ? "+" : ""}${r.totalPnl.toFixed(0)} | MaxDD: $${r.maxDD.toFixed(0)}`);
  console.log(`  Discovery: ${r.discN}t $${r.discPnl >= 0 ? "+" : ""}${r.discPnl.toFixed(0)} | Validation: ${r.valN}t $${r.valPnl >= 0 ? "+" : ""}${r.valPnl.toFixed(0)} ($${vpt}/t)`);
  console.log(`${"═".repeat(130)}`);

  // Monthly breakdown
  console.log(`  ${"Month".padEnd(9)} ${"N".padEnd(5)} ${"W".padEnd(4)} ${"L".padEnd(4)} ${"F".padEnd(4)} ${"WR%".padEnd(7)} ${"PnL".padEnd(12)} Split`);
  console.log(`  ${"─".repeat(60)}`);
  let eqCum = 0;
  for (const [mo, m] of [...r.monthly.entries()].sort()) {
    eqCum += m.pnl;
    const moWr = m.trades > 0 ? (m.wins / m.trades * 100).toFixed(0) + "%" : "—";
    const split = new Date(mo + "-01").getTime() < DISC_END ? "disc" : "val";
    console.log(`  ${mo}   ${String(m.trades).padEnd(5)} ${String(m.wins).padEnd(4)} ${String(m.losses).padEnd(4)} ${String(m.flats).padEnd(4)} ${moWr.padEnd(7)} ${"$" + (m.pnl >= 0 ? "+" : "") + m.pnl.toFixed(0).padEnd(11)} ${split}  eq=$${eqCum >= 0 ? "+" : ""}${eqCum.toFixed(0)}`);
  }

  // Per-trade detail
  console.log(`\n  ${"Date".padEnd(18)} ${"Entry".padEnd(10)} ${"Exit".padEnd(10)} ${"Out".padEnd(6)} ${"PnL".padEnd(10)} ${"Hold".padEnd(8)} Split`);
  console.log(`  ${"─".repeat(80)}`);
  for (const t of r.trades) {
    const holdMin = (t.exitTime - t.entryTime) / 60000;
    const holdStr = holdMin >= 60 ? `${(holdMin / 60).toFixed(1)}h` : `${holdMin.toFixed(0)}m`;
    const split = t.entryTime < DISC_END ? "disc" : "val";
    console.log(`  ${new Date(t.entryTime).toISOString().slice(0, 16).padEnd(18)} $${t.entryPrice.toFixed(4).padEnd(9)} $${t.exitPrice.toFixed(4).padEnd(9)} ${t.outcome.padEnd(6)} ${"$" + (t.pnlUsd >= 0 ? "+" : "") + t.pnlUsd.toFixed(0).padEnd(9)} ${holdStr.padEnd(8)} ${split}`);
  }

  return r;
}

// ══════════════════════════════════════════════════════════════
// CORE STRATEGIES
// ══════════════════════════════════════════════════════════════

// A: Drop>5% + 4H bull — the high trade-count winner
const filterDropBull = (s: SwingLow) => s.dropPct > 5 && s.ema4hBull;
// B: BB<0.1 + 4H bull — the high $/trade winner
const filterBBBull = (s: SwingLow) => !isNaN(s.bbPos) && s.bbPos < 0.1 && s.ema4hBull;
// C: Combined: Drop>5% + BB<0.1 + 4H bull
const filterCombined = (s: SwingLow) => s.dropPct > 5 && !isNaN(s.bbPos) && s.bbPos < 0.1 && s.ema4hBull;
// D: Drop>5% + 4H bull + vol>1.5x (capitulation bounce)
const filterDropBullVol = (s: SwingLow) => s.dropPct > 5 && s.ema4hBull && !isNaN(s.volRatio) && s.volRatio > 1.5;
// E: Drop>5% + 4H bull + Europe
const filterDropBullEU = (s: SwingLow) => s.dropPct > 5 && s.ema4hBull && s.utcHour >= 8 && s.utcHour < 14;
// F: Drop>5% + 4H bull + NOT Asia late (skip 04-08)
const filterDropBullNoAsia = (s: SwingLow) => s.dropPct > 5 && s.ema4hBull && !(s.utcHour >= 4 && s.utcHour < 8);
// G: BB<0.1 + 4H bull + RSI<45
const filterBBBullRSI = (s: SwingLow) => !isNaN(s.bbPos) && s.bbPos < 0.1 && s.ema4hBull && s.rsi < 45;
// H: Drop>5% + 4H bull + 4HRSI<50 (dip in uptrend, momentum not exhausted)
const filterDropBull4HRSI = (s: SwingLow) => s.dropPct > 5 && s.ema4hBull && s.rsi4h < 50;
// I: Drop>3% + 4H bull (relaxed drop threshold)
const filterDrop3Bull = (s: SwingLow) => s.dropPct > 3 && s.ema4hBull;
// J: Drop>5% + 4H bull + skip Sat
const filterDropBullNoSat = (s: SwingLow) => s.dropPct > 5 && s.ema4hBull && new Date(s.ts).getUTCDay() !== 6;

// ── TP/SL sweep on the two core filters ──
console.log("\n" + "▓".repeat(130));
console.log("  TP/SL SWEEP — Drop>5% + 4H bull");
console.log("▓".repeat(130));

for (const tp of [1.0, 1.5, 2.0, 2.5]) {
  for (const sl of [2.0, 3.0, 4.0]) {
    for (const delay of [0, 1]) {
      const r = runSim({ label: "", filter: filterDropBull, tpPct: tp, slPct: sl, maxHold: 720, delayBars: delay });
      const n = r.wins + r.losses + r.flats;
      if (n === 0) continue;
      const wr = (r.wins / n * 100).toFixed(1);
      const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(1) : "—";
      console.log(`  TP=${tp}% SL=${sl}% delay=${delay}h | ${n}t W=${r.wins} L=${r.losses} WR=${wr}% | PnL=$${r.totalPnl >= 0 ? "+" : ""}${r.totalPnl.toFixed(0)} DD=$${r.maxDD.toFixed(0)} | disc: ${r.discN}t $${r.discPnl >= 0 ? "+" : ""}${r.discPnl.toFixed(0)} | val: ${r.valN}t $${r.valPnl >= 0 ? "+" : ""}${r.valPnl.toFixed(0)} ($${vpt}/t)`);
    }
  }
}

console.log("\n" + "▓".repeat(130));
console.log("  TP/SL SWEEP — BB<0.1 + 4H bull");
console.log("▓".repeat(130));

for (const tp of [1.0, 1.5, 2.0, 2.5]) {
  for (const sl of [2.0, 3.0, 4.0]) {
    for (const delay of [0, 1]) {
      const r = runSim({ label: "", filter: filterBBBull, tpPct: tp, slPct: sl, maxHold: 720, delayBars: delay });
      const n = r.wins + r.losses + r.flats;
      if (n === 0) continue;
      const wr = (r.wins / n * 100).toFixed(1);
      const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(1) : "—";
      console.log(`  TP=${tp}% SL=${sl}% delay=${delay}h | ${n}t W=${r.wins} L=${r.losses} WR=${wr}% | PnL=$${r.totalPnl >= 0 ? "+" : ""}${r.totalPnl.toFixed(0)} DD=$${r.maxDD.toFixed(0)} | disc: ${r.discN}t $${r.discPnl >= 0 ? "+" : ""}${r.discPnl.toFixed(0)} | val: ${r.valN}t $${r.valPnl >= 0 ? "+" : ""}${r.valPnl.toFixed(0)} ($${vpt}/t)`);
    }
  }
}

// ── Additional filter sweeps on best TP/SL combos ──
console.log("\n" + "▓".repeat(130));
console.log("  FILTER VARIANTS — TP=2% SL=3%");
console.log("▓".repeat(130));

const filterVariants: { label: string; filter: (s: SwingLow) => boolean }[] = [
  { label: "Drop>5% + 4H bull", filter: filterDropBull },
  { label: "BB<0.1 + 4H bull", filter: filterBBBull },
  { label: "Drop>5% + BB<0.1 + 4H bull", filter: filterCombined },
  { label: "Drop>5% + 4H bull + vol>1.5x", filter: filterDropBullVol },
  { label: "Drop>5% + 4H bull + Europe", filter: filterDropBullEU },
  { label: "Drop>5% + 4H bull + skip 04-08", filter: filterDropBullNoAsia },
  { label: "BB<0.1 + 4H bull + RSI<45", filter: filterBBBullRSI },
  { label: "Drop>5% + 4H bull + 4HRSI<50", filter: filterDropBull4HRSI },
  { label: "Drop>3% + 4H bull", filter: filterDrop3Bull },
  { label: "Drop>5% + 4H bull + skip Sat", filter: filterDropBullNoSat },
];

for (const fv of filterVariants) {
  for (const tp of [1.5, 2.0]) {
    for (const sl of [2.0, 3.0]) {
      const r = runSim({ label: "", filter: fv.filter, tpPct: tp, slPct: sl, maxHold: 720, delayBars: 0 });
      const n = r.wins + r.losses + r.flats;
      if (n === 0) continue;
      const wr = (r.wins / n * 100).toFixed(1);
      const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(1) : "—";
      console.log(`  ${fv.label.padEnd(40)} TP=${tp}% SL=${sl}% | ${String(n).padEnd(4)}t WR=${wr.padEnd(5)}% PnL=$${(r.totalPnl >= 0 ? "+" : "") + r.totalPnl.toFixed(0).padEnd(7)} DD=$${r.maxDD.toFixed(0).padEnd(5)} | d:${r.discN}t $${(r.discPnl >= 0 ? "+" : "") + r.discPnl.toFixed(0).padEnd(7)} v:${r.valN}t $${(r.valPnl >= 0 ? "+" : "") + r.valPnl.toFixed(0).padEnd(7)} ($${vpt}/t)`);
    }
  }
}

// ── Hold time sweep ──
console.log("\n" + "▓".repeat(130));
console.log("  HOLD TIME SWEEP — Drop>5% + 4H bull, TP=2% SL=3%");
console.log("▓".repeat(130));

for (const hold of [360, 480, 720, 960, 1440]) {
  const r = runSim({ label: "", filter: filterDropBull, tpPct: 2.0, slPct: 3.0, maxHold: hold, delayBars: 0 });
  const n = r.wins + r.losses + r.flats;
  if (n === 0) continue;
  const wr = (r.wins / n * 100).toFixed(1);
  const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(1) : "—";
  console.log(`  Hold=${(hold / 60).toFixed(0).padEnd(3)}h | ${n}t WR=${wr}% PnL=$${r.totalPnl >= 0 ? "+" : ""}${r.totalPnl.toFixed(0)} DD=$${r.maxDD.toFixed(0)} | val: ${r.valN}t $${r.valPnl >= 0 ? "+" : ""}${r.valPnl.toFixed(0)} ($${vpt}/t)`);
}

// ══════════════════════════════════════════════════════════════
// DETAILED OUTPUT — best combos
// ══════════════════════════════════════════════════════════════

// Print top 3 with full month-by-month + per-trade detail
const best1 = printResult({ label: "Drop>5% + 4H bull", filter: filterDropBull, tpPct: 2.0, slPct: 3.0, maxHold: 720, delayBars: 0 });
const best2 = printResult({ label: "BB<0.1 + 4H bull", filter: filterBBBull, tpPct: 2.0, slPct: 3.0, maxHold: 720, delayBars: 0 });
const best3 = printResult({ label: "Drop>5% + 4H bull + skip Sat", filter: filterDropBullNoSat, tpPct: 2.0, slPct: 3.0, maxHold: 720, delayBars: 0 });
const best4 = printResult({ label: "Drop>5% + 4H bull", filter: filterDropBull, tpPct: 1.5, slPct: 3.0, maxHold: 720, delayBars: 0 });

// Write CSVs for best
writeCsv(best1.trades, { strategy: "dr0-long", symbol: "SUIUSDT", params: { f: "drop5-4hbull", tp: 2.0, sl: 3.0 } });
writeCsv(best2.trades, { strategy: "dr0-long", symbol: "SUIUSDT", params: { f: "bb01-4hbull", tp: 2.0, sl: 3.0 } });
writeCsv(best4.trades, { strategy: "dr0-long", symbol: "SUIUSDT", params: { f: "drop5-4hbull", tp: 1.5, sl: 3.0 } });
