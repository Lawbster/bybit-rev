// ─────────────────────────────────────────────
// SFP (Swing Failure Pattern) sim — HYPEUSDT
//
// Section 1: Wed near-high short with SFP gate
//   Entry only when a 5m candle on Wed swept above
//   Tuesday's daily high then closed back below it.
//   Tests as standalone signal and as filter on the
//   baseline near-1.25% | 18h | TP1% | stop2% setup.
//
// Section 2: General long SFP across all days
//   Any 5m candle that sweeps below prior day's low
//   and closes back above it → long entry.
//   Tests various TP/SL/expiry combos.
// ─────────────────────────────────────────────

import fs from "fs";
import { Candle } from "./fetch-candles";

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

interface DayData { date: string; candles: Candle[]; }

const dayMap = new Map<string, Candle[]>();
for (const c of candles) {
  const date = new Date(c.timestamp).toISOString().slice(0, 10);
  if (!dayMap.has(date)) dayMap.set(date, []);
  dayMap.get(date)!.push(c);
}
const days: DayData[] = [];
for (const [date, cs] of dayMap) {
  if (cs.length < 48) continue;
  cs.sort((a, b) => a.timestamp - b.timestamp);
  days.push({ date, candles: cs });
}
days.sort((a, b) => a.date.localeCompare(b.date));

const postLaunch = days.filter(d => d.date >= "2025-01-01");
const db = new Map(days.map(d => [d.date, d]));
const SEP = "=".repeat(100);

// ── Helpers ──

function prevDayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextDayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function dayHigh(day: DayData): number { return Math.max(...day.candles.map(c => c.high)); }
function dayLow(day: DayData):  number { return Math.min(...day.candles.map(c => c.low));  }

function printMonthly(monthly: Map<string, { pnl: number; trades: number; wins: number }>, total: number, totalTrades: number, totalWins: number, skipped: number) {
  console.log(`  ${"Month".padEnd(8)} ${"Trades".padStart(7)} ${"Wins".padStart(5)} ${"WR".padStart(5)} ${"PnL($)".padStart(9)}`);
  console.log("  " + "-".repeat(38));
  for (const [mo, ms] of monthly) {
    const wr = ms.trades > 0 ? (ms.wins / ms.trades * 100).toFixed(0) + "%" : "n/a";
    console.log(`  ${mo.padEnd(8)} ${String(ms.trades).padStart(7)} ${String(ms.wins).padStart(5)} ${wr.padStart(5)} ${((ms.pnl >= 0 ? "+" : "") + "$" + ms.pnl.toFixed(0)).padStart(9)}`);
  }
  const wr = totalTrades > 0 ? (totalWins / totalTrades * 100).toFixed(0) + "%" : "n/a";
  console.log(`  ${"TOTAL".padEnd(8)} ${String(totalTrades).padStart(7)} ${String(totalWins).padStart(5)} ${wr.padStart(5)} ${("$" + total.toFixed(0)).padStart(9)}  (${skipped} skipped/no-signal)`);
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1 — Wed near-high short with SFP gate
// ═══════════════════════════════════════════════════════════════

interface ShortCfg {
  label: string;
  nearHighPct: number;
  entryAfterH: number;
  tpPct: number;
  stopPct: number;
  expiryH: number;
  // SFP gate
  requireSfp: boolean;        // require SFP vs Tue high before entry
  sfpWindowH: number;         // only look for SFP in last N hours before entry candle (0 = all day)
  sfpOnEntryCandle: boolean;  // true = only the entry candle itself must be the SFP
  capitalPerTrade: number;
  fee: number;
}

interface ShortResult {
  trades: number; wins: number; stops: number; expiries: number; skipped: number;
  totalPnlUsdt: number; winRate: number; maxConsecLoss: number;
  monthly: Map<string, { pnl: number; trades: number; wins: number }>;
  tradeLog: { date: string; reason: "TP"|"STOP"|"EXPIRY"; pnlUsdt: number; sfpFound: boolean }[];
}

function runShortSim(cfg: ShortCfg, allDays: DayData[]): ShortResult {
  const wedDays = allDays.filter(d => new Date(d.date + "T12:00:00Z").getUTCDay() === 3);
  let trades = 0, wins = 0, stops = 0, expiries = 0, skipped = 0, total = 0;
  let maxCL = 0, curCL = 0;
  const monthly = new Map<string, { pnl: number; trades: number; wins: number }>();
  const tradeLog: ShortResult["tradeLog"] = [];

  for (const wed of wedDays) {
    // Get Tuesday's high
    const tueDate = prevDayDate(wed.date);
    const tue = db.get(tueDate);
    const tueHigh = tue ? dayHigh(tue) : 0;

    // Get Thursday for expiry scan
    const thuDate = nextDayDate(wed.date);
    const thu = db.get(thuDate);
    if (!thu) continue;

    const entryStart = new Date(wed.date + "T00:00:00Z").getTime() + cfg.entryAfterH * 3600000;
    const expiryTs   = new Date(thu.date  + "T00:00:00Z").getTime() + cfg.expiryH   * 3600000;

    let rollingHigh = 0;
    let sfpDetected = false;
    let entered = false;

    for (let i = 0; i < wed.candles.length; i++) {
      const c = wed.candles[i];
      if (c.high > rollingHigh) rollingHigh = c.high;

      // Track SFP: any candle whose high exceeded Tue's daily high but closed back below it
      if (tueHigh > 0 && c.high > tueHigh && c.close < tueHigh) {
        sfpDetected = true;
      }

      if (c.timestamp < entryStart) continue;

      // Check near-high condition
      if ((rollingHigh - c.close) / rollingHigh * 100 > cfg.nearHighPct) continue;

      // SFP gate
      if (cfg.requireSfp) {
        if (cfg.sfpOnEntryCandle) {
          // The entry candle itself must be the SFP
          if (!(tueHigh > 0 && c.high > tueHigh && c.close < tueHigh)) {
            continue; // this candle is not an SFP — keep scanning
          }
        } else {
          // Any prior candle (since entryAfterH or all day) must have been an SFP
          if (!sfpDetected) {
            // Also check entry candle itself
            if (!(tueHigh > 0 && c.high > tueHigh && c.close < tueHigh)) {
              continue;
            }
          }
        }
      }

      // Entry
      const ep = c.close;
      const tp = ep * (1 - cfg.tpPct  / 100);
      const sl = ep * (1 + cfg.stopPct / 100);
      const scan = [
        ...wed.candles.filter(x => x.timestamp > c.timestamp),
        ...thu.candles.filter(x => x.timestamp <= expiryTs),
      ];

      let exit = 0;
      let reason: "TP"|"STOP"|"EXPIRY" = "EXPIRY";
      for (const sc of scan) {
        if (sc.low  <= tp) { exit = tp; reason = "TP";    break; }
        if (sc.high >= sl) { exit = sl; reason = "STOP";  break; }
        if (sc.timestamp >= expiryTs) { exit = sc.open; reason = "EXPIRY"; break; }
      }
      if (!exit) { const l = scan[scan.length - 1]; exit = l ? l.close : ep; }

      const pnl = cfg.capitalPerTrade * ((ep - exit) / ep) - cfg.capitalPerTrade * cfg.fee * 2;
      trades++; total += pnl;
      if (reason === "TP") wins++; else if (reason === "STOP") stops++; else expiries++;
      if (pnl <= 0) { curCL++; maxCL = Math.max(maxCL, curCL); } else curCL = 0;

      const mo = wed.date.slice(0, 7);
      if (!monthly.has(mo)) monthly.set(mo, { pnl: 0, trades: 0, wins: 0 });
      const m = monthly.get(mo)!; m.pnl += pnl; m.trades++; if (pnl > 0) m.wins++;
      tradeLog.push({ date: wed.date, reason, pnlUsdt: pnl, sfpFound: sfpDetected });
      entered = true;
      break;
    }

    if (!entered) skipped++;
  }

  return {
    trades, wins, stops, expiries, skipped,
    totalPnlUsdt: total,
    winRate: trades > 0 ? wins / trades * 100 : 0,
    maxConsecLoss: maxCL,
    monthly, tradeLog,
  };
}

function shortRow(cfg: ShortCfg, r: ShortResult): string {
  return `  ${cfg.label.padEnd(52)} ${String(r.trades).padStart(4)} ${String(r.skipped).padStart(5)} ${(r.winRate.toFixed(0) + "%").padStart(6)} ${("$" + r.totalPnlUsdt.toFixed(0)).padStart(9)} ${r.maxConsecLoss.toString().padStart(5)}`;
}

const baseShort: ShortCfg = {
  label: "baseline (no SFP gate)",
  nearHighPct: 1.25, entryAfterH: 18,
  tpPct: 1.0, stopPct: 2.0, expiryH: 12,
  requireSfp: false, sfpWindowH: 0, sfpOnEntryCandle: false,
  capitalPerTrade: 1000, fee: 0.00055,
};

console.log("\n" + SEP);
console.log("  SECTION 1 — Wed near-high short: SFP gate (swept above Tue high, closed back below)");
console.log("  Base config: near 1.25% | after 18h | TP 1% | stop 2% | Thu 12h expiry");
console.log(SEP);

const baseShortR = runShortSim(baseShort, postLaunch);

// How many weeks had a SFP on Wed vs Tue high at all?
let sfpWeeks = 0, sfpWeeksWithTrade = 0;
{
  const wedDays = postLaunch.filter(d => new Date(d.date + "T12:00:00Z").getUTCDay() === 3);
  for (const wed of wedDays) {
    const tueDate = prevDayDate(wed.date);
    const tue = db.get(tueDate);
    if (!tue) continue;
    const tueHigh = dayHigh(tue);
    const hadSfp = wed.candles.some(c => c.high > tueHigh && c.close < tueHigh);
    if (hadSfp) sfpWeeks++;
  }
}
console.log(`\n  Of ${postLaunch.filter(d => new Date(d.date + "T12:00:00Z").getUTCDay() === 3).length} Wednesdays, SFP vs Tue high occurred on: ${sfpWeeks}`);
console.log(`  (SFP = any 5m candle whose HIGH > Tue daily high AND CLOSE < Tue daily high)\n`);

console.log(`  ${"Config".padEnd(52)} ${"N".padStart(4)} ${"Skip".padStart(5)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"MaxCL".padStart(5)}`);
console.log("  " + "-".repeat(80));
console.log(shortRow(baseShort, baseShortR));

// A) Require SFP anywhere on Wed before/at entry (not just entry candle)
{
  const cfg: ShortCfg = { ...baseShort, label: "require SFP anytime on Wed vs Tue high", requireSfp: true, sfpOnEntryCandle: false };
  console.log(shortRow(cfg, runShortSim(cfg, postLaunch)));
}

// B) Require SFP specifically on the entry candle
{
  const cfg: ShortCfg = { ...baseShort, label: "require SFP on entry candle itself", requireSfp: true, sfpOnEntryCandle: true };
  console.log(shortRow(cfg, runShortSim(cfg, postLaunch)));
}

// C) SFP gate with relaxed near-high (take whatever SFP gives us, wider window)
for (const nearHighPct of [2.0, 3.0]) {
  const cfg: ShortCfg = { ...baseShort, label: `SFP anytime | near-high loosened to ${nearHighPct}%`, requireSfp: true, sfpOnEntryCandle: false, nearHighPct };
  console.log(shortRow(cfg, runShortSim(cfg, postLaunch)));
}

// D) SFP gate with different TP/SL
for (const [tp, sl] of [[1.5, 2.0], [1.0, 3.0], [2.0, 3.0]] as [number, number][]) {
  const cfg: ShortCfg = { ...baseShort, label: `SFP anytime | TP ${tp}% | SL ${sl}%`, requireSfp: true, sfpOnEntryCandle: false, tpPct: tp, stopPct: sl };
  console.log(shortRow(cfg, runShortSim(cfg, postLaunch)));
}

// Show trade log for SFP-gated version
console.log("\n  -- SFP gate (anytime on Wed) — full trade log --");
{
  const cfg: ShortCfg = { ...baseShort, label: "SFP anytime", requireSfp: true, sfpOnEntryCandle: false };
  const r = runShortSim(cfg, postLaunch);
  console.log(`  ${r.trades} trades | WR ${r.winRate.toFixed(0)}% | $${r.totalPnlUsdt.toFixed(0)}`);
  for (const t of r.tradeLog) {
    const tag = t.reason === "TP" ? "TP  " : t.reason === "STOP" ? "STOP" : "EXP ";
    const pnlStr = (t.pnlUsdt >= 0 ? "+" : "") + "$" + t.pnlUsdt.toFixed(0);
    console.log(`    ${t.date}  ${tag}  pnl=${pnlStr.padStart(6)}`);
  }
  console.log("\n  Monthly:");
  printMonthly(r.monthly, r.totalPnlUsdt, r.trades, r.wins, r.skipped);
}

// Show which baseline trades were filtered by SFP gate (did we lose any winners?)
console.log("\n  -- Trades filtered OUT by SFP gate (vs baseline) --");
{
  const sfpCfg: ShortCfg = { ...baseShort, label: "SFP", requireSfp: true, sfpOnEntryCandle: false };
  const sfpR   = runShortSim(sfpCfg, postLaunch);
  const sfpDates = new Set(sfpR.tradeLog.map(t => t.date));
  const removed  = baseShortR.tradeLog.filter(t => !sfpDates.has(t.date));
  console.log(`  ${removed.length} weeks removed:`);
  for (const t of removed) {
    const tag = t.reason === "TP" ? "TP  " : t.reason === "STOP" ? "STOP" : "EXP ";
    console.log(`    ${t.date}  ${tag}  pnl=${((t.pnlUsdt >= 0 ? "+" : "") + "$" + t.pnlUsdt.toFixed(0)).padStart(6)}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — Long SFP: any day, any candle sweeps below prior day's low → long
// ═══════════════════════════════════════════════════════════════

interface LongSfpCfg {
  label: string;
  // Timing filters
  entryAfterH: number;     // only enter after this UTC hour (0 = any time)
  entryBeforeH: number;    // only enter before this UTC hour (24 = any time)
  daysOfWeek: number[];    // 0=Sun..6=Sat, empty = any
  // TP/SL/expiry
  tpPct: number;
  stopPct: number;         // SL = below entry or below SFP candle low?
  slAtCandleLow: boolean;  // true = SL at SFP candle low, false = fixed pct above entry
  expiryCandles: number;   // close after N candles if not hit (0 = end of day)
  capitalPerTrade: number;
  fee: number;
}

interface LongSfpResult {
  trades: number; wins: number; stops: number; expiries: number;
  totalPnlUsdt: number; winRate: number; maxConsecLoss: number;
  avgWin: number; avgLoss: number; expectancy: number;
  monthly: Map<string, { pnl: number; trades: number; wins: number }>;
  tradeLog: { date: string; dow: string; entryH: number; reason: "TP"|"STOP"|"EXPIRY"; pnlUsdt: number; tpPct: number; slPct: number }[];
}

const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function runLongSfpSim(cfg: LongSfpCfg, allDays: DayData[]): LongSfpResult {
  let trades = 0, wins = 0, stops = 0, expiries = 0, total = 0;
  let maxCL = 0, curCL = 0;
  let sumWin = 0, sumLoss = 0, nWin = 0, nLoss = 0;
  const monthly = new Map<string, { pnl: number; trades: number; wins: number }>();
  const tradeLog: LongSfpResult["tradeLog"] = [];

  for (const day of allDays) {
    const dow = new Date(day.date + "T12:00:00Z").getUTCDay();
    if (cfg.daysOfWeek.length > 0 && !cfg.daysOfWeek.includes(dow)) continue;

    const prevDate = prevDayDate(day.date);
    const prev = db.get(prevDate);
    if (!prev) continue;
    const prevLow = dayLow(prev);

    // Scan all 5m candles on this day for SFP at low
    for (let i = 0; i < day.candles.length; i++) {
      const c = day.candles[i];
      const hour = new Date(c.timestamp).getUTCHours();

      // Timing filters
      if (hour < cfg.entryAfterH) continue;
      if (hour >= cfg.entryBeforeH) break;

      // SFP condition: candle low broke below prev day's low AND close recovered above it
      if (!(c.low < prevLow && c.close > prevLow)) continue;

      // Entry at close of SFP candle
      const ep = c.close;
      const tp = ep * (1 + cfg.tpPct / 100);

      // Stop: either at candle low (natural invalidation) or fixed pct below entry
      const slPrice = cfg.slAtCandleLow ? c.low : ep * (1 - cfg.stopPct / 100);
      const slPct = (ep - slPrice) / ep * 100;
      const tpPct = (tp - ep) / ep * 100;

      // Scan remaining candles for outcome
      const endOfDayTs = new Date(day.date + "T00:00:00Z").getTime() + 24 * 3600000 - 1;
      const scanEnd = cfg.expiryCandles > 0
        ? (day.candles[Math.min(i + cfg.expiryCandles, day.candles.length - 1)]?.timestamp ?? endOfDayTs)
        : endOfDayTs;

      const scan = day.candles.slice(i + 1).filter(x => x.timestamp <= scanEnd);

      let exit = 0;
      let reason: "TP"|"STOP"|"EXPIRY" = "EXPIRY";
      for (const sc of scan) {
        if (sc.high >= tp)      { exit = tp;      reason = "TP";    break; }
        if (sc.low  <= slPrice) { exit = slPrice;  reason = "STOP";  break; }
        if (sc.timestamp >= scanEnd) { exit = sc.open; reason = "EXPIRY"; break; }
      }
      if (!exit) { const l = scan[scan.length - 1]; exit = l ? l.close : ep; }

      const pnl = cfg.capitalPerTrade * ((exit - ep) / ep) - cfg.capitalPerTrade * cfg.fee * 2;
      trades++; total += pnl;
      if (reason === "TP") { wins++; sumWin += pnl; nWin++; }
      else if (reason === "STOP") { stops++; sumLoss += pnl; nLoss++; }
      else { expiries++; if (pnl > 0) { sumWin += pnl; nWin++; } else { sumLoss += pnl; nLoss++; } }

      if (pnl <= 0) { curCL++; maxCL = Math.max(maxCL, curCL); } else curCL = 0;

      const mo = day.date.slice(0, 7);
      if (!monthly.has(mo)) monthly.set(mo, { pnl: 0, trades: 0, wins: 0 });
      const m = monthly.get(mo)!; m.pnl += pnl; m.trades++; if (pnl > 0) m.wins++;
      tradeLog.push({ date: day.date, dow: DOW_NAMES[dow], entryH: hour, reason, pnlUsdt: pnl, tpPct, slPct });

      break; // one trade per day max
    }
  }

  const avgWin  = nWin  > 0 ? sumWin  / nWin  : 0;
  const avgLoss = nLoss > 0 ? sumLoss / nLoss : 0;
  const wr = trades > 0 ? wins / trades : 0;
  const expectancy = wr * avgWin + (1 - wr) * avgLoss;

  return {
    trades, wins, stops, expiries, totalPnlUsdt: total,
    winRate: wr * 100, maxConsecLoss: maxCL,
    avgWin, avgLoss, expectancy,
    monthly, tradeLog,
  };
}

function longRow(cfg: LongSfpCfg, r: LongSfpResult): string {
  const rr = r.avgLoss !== 0 ? Math.abs(r.avgWin / r.avgLoss).toFixed(2) : "∞";
  return `  ${cfg.label.padEnd(52)} ${String(r.trades).padStart(4)} ${(r.winRate.toFixed(0) + "%").padStart(6)} ${("$" + r.totalPnlUsdt.toFixed(0)).padStart(9)} ${r.maxConsecLoss.toString().padStart(5)}  RR:${rr}`;
}

console.log("\n\n" + SEP);
console.log("  SECTION 2 — Long SFP: 5m candle sweeps below prior day's low, closes back above → long");
console.log("  HYPEUSDT post-launch (Jan 2025+)");
console.log(SEP);

// How often does long SFP occur?
{
  let sfpCount = 0;
  for (const day of postLaunch) {
    const prev = db.get(prevDayDate(day.date));
    if (!prev) continue;
    const prevLow = dayLow(prev);
    const hadSfp = day.candles.some(c => c.low < prevLow && c.close > prevLow);
    if (hadSfp) sfpCount++;
  }
  console.log(`\n  Long SFP occurs on ${sfpCount} of ${postLaunch.length} trading days (${(sfpCount / postLaunch.length * 100).toFixed(0)}% of days)`);
}

// ── A) All days, all hours — frequency and baseline outcome ──
console.log("\n  -- A) Sweep (any time, any day) — TP/SL matrix --");
console.log(`  ${"Config".padEnd(52)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"MaxCL".padStart(5)}  RR`);
console.log("  " + "-".repeat(85));

for (const [tp, sl] of [[1.0, 0.5], [1.5, 1.0], [2.0, 1.0], [2.0, 1.5], [3.0, 1.5], [3.0, 2.0], [5.0, 2.0]] as [number, number][]) {
  const cfg: LongSfpCfg = {
    label: `TP ${tp}% | SL ${sl}% fixed | any day any time`,
    entryAfterH: 0, entryBeforeH: 24, daysOfWeek: [],
    tpPct: tp, stopPct: sl, slAtCandleLow: false, expiryCandles: 0,
    capitalPerTrade: 1000, fee: 0.00055,
  };
  console.log(longRow(cfg, runLongSfpSim(cfg, postLaunch)));
}

// ── B) SL at candle low (natural invalidation) ──
console.log("\n  -- B) SL at SFP candle low (natural invalidation — tightest stop) --");
console.log(`  ${"Config".padEnd(52)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"MaxCL".padStart(5)}  RR`);
console.log("  " + "-".repeat(85));
for (const tp of [1.0, 1.5, 2.0, 3.0]) {
  const cfg: LongSfpCfg = {
    label: `TP ${tp}% | SL at candle low | any day any time`,
    entryAfterH: 0, entryBeforeH: 24, daysOfWeek: [],
    tpPct: tp, stopPct: 0, slAtCandleLow: true, expiryCandles: 0,
    capitalPerTrade: 1000, fee: 0.00055,
  };
  console.log(longRow(cfg, runLongSfpSim(cfg, postLaunch)));
}

// ── C) Day-of-week filter — which days produce the best long SFPs? ──
console.log("\n  -- C) Long SFP by day of week (TP 2% | SL 1% fixed) --");
console.log(`  ${"Config".padEnd(52)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"MaxCL".padStart(5)}  RR`);
console.log("  " + "-".repeat(85));
for (const [dow, name] of [[1,"Mon"],[2,"Tue"],[3,"Wed"],[4,"Thu"],[5,"Fri"]] as [number, string][]) {
  const cfg: LongSfpCfg = {
    label: `${name} only | TP 2% | SL 1%`,
    entryAfterH: 0, entryBeforeH: 24, daysOfWeek: [dow],
    tpPct: 2.0, stopPct: 1.0, slAtCandleLow: false, expiryCandles: 0,
    capitalPerTrade: 1000, fee: 0.00055,
  };
  console.log(longRow(cfg, runLongSfpSim(cfg, postLaunch)));
}

// ── D) Time-of-day filter — US session vs Asian session ──
console.log("\n  -- D) Long SFP by session (TP 2% | SL 1% fixed) --");
console.log(`  ${"Config".padEnd(52)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"MaxCL".padStart(5)}  RR`);
console.log("  " + "-".repeat(85));
for (const [afterH, beforeH, label] of [
  [0,  8,  "Asian  (00-08h UTC)"],
  [8,  16, "London (08-16h UTC)"],
  [13, 21, "US     (13-21h UTC)"],
  [16, 24, "Late   (16-24h UTC)"],
] as [number, number, string][]) {
  const cfg: LongSfpCfg = {
    label: `${label} | TP 2% | SL 1%`,
    entryAfterH: afterH, entryBeforeH: beforeH, daysOfWeek: [],
    tpPct: 2.0, stopPct: 1.0, slAtCandleLow: false, expiryCandles: 0,
    capitalPerTrade: 1000, fee: 0.00055,
  };
  console.log(longRow(cfg, runLongSfpSim(cfg, postLaunch)));
}

// ── E) Best combo — show monthly breakdown and full trade log ──
console.log("\n  -- E) Best config deep-dive: show which day/session combo works, then full log --");
// Run all-day TP2/SL1 as the reference
const bestLong: LongSfpCfg = {
  label: "Long SFP | TP 2% | SL 1% | any day any time",
  entryAfterH: 0, entryBeforeH: 24, daysOfWeek: [],
  tpPct: 2.0, stopPct: 1.0, slAtCandleLow: false, expiryCandles: 0,
  capitalPerTrade: 1000, fee: 0.00055,
};
const bestLongR = runLongSfpSim(bestLong, postLaunch);
console.log(`\n  All-day TP2/SL1 reference: ${bestLongR.trades} trades | WR ${bestLongR.winRate.toFixed(0)}% | $${bestLongR.totalPnlUsdt.toFixed(0)} | maxCL ${bestLongR.maxConsecLoss}`);
console.log(`  Avg win: $${bestLongR.avgWin.toFixed(0)} | Avg loss: $${bestLongR.avgLoss.toFixed(0)} | Expectancy/trade: $${bestLongR.expectancy.toFixed(0)}`);

console.log("\n  Monthly breakdown:");
printMonthly(bestLongR.monthly, bestLongR.totalPnlUsdt, bestLongR.trades, bestLongR.wins, 0);

console.log("\n  Full trade log (date | day | hour | outcome | pnl | TP% | SL%):");
for (const t of bestLongR.tradeLog) {
  const tag = t.reason === "TP" ? "TP  " : t.reason === "STOP" ? "STOP" : "EXP ";
  const pnlStr = (t.pnlUsdt >= 0 ? "+" : "") + "$" + t.pnlUsdt.toFixed(0);
  console.log(`    ${t.date}  ${t.dow}  ${String(t.entryH).padStart(2)}h UTC  ${tag}  pnl=${pnlStr.padStart(6)}  TP=${t.tpPct.toFixed(2)}%  SL=${t.slPct.toFixed(2)}%`);
}
