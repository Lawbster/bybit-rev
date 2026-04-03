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

// ── Core sim with Tue-gate ──
interface Cfg {
  label: string;
  nearHighPct: number; entryAfterH: number;
  tpPct: number; stopPct: number; expiryH: number;
  // Gate options
  tueMoveThreshPct: number;     // skip if |Tue chg%| >= this (0 = off)
  tueDirBoth: boolean;          // true = gate both directions, false = only big-down Tue
  wedRunThreshPct: number;      // skip if Wed already ran this % from open to entry (0 = off)
  capitalPerTrade: number; fee: number;
}

interface Result {
  trades: number; wins: number; stops: number; expiries: number; skipped: number;
  totalPnlUsdt: number; winRate: number; maxConsecLoss: number;
  monthly: Map<string, { pnl: number; trades: number; wins: number }>;
  tradeLog: { date: string; reason: "TP"|"STOP"|"EXPIRY"; pnlUsdt: number; tueChgPct: number; wedRunPct: number }[];
}

function runSim(cfg: Cfg, allDays: DayData[]): Result {
  const wedDays = allDays.filter(d => new Date(d.date + "T12:00:00Z").getUTCDay() === 3);

  let trades = 0, wins = 0, stops = 0, expiries = 0, skipped = 0, total = 0;
  let maxCL = 0, curCL = 0;
  const monthly = new Map<string, { pnl: number; trades: number; wins: number }>();
  const tradeLog: Result["tradeLog"] = [];
  const allR: number[] = [];

  for (const wed of wedDays) {
    const wedTs = new Date(wed.date + "T12:00:00Z");

    // Find Tuesday (day before Wed)
    const tueDate = new Date(wedTs); tueDate.setUTCDate(wedTs.getUTCDate() - 1);
    const tue = db.get(tueDate.toISOString().slice(0, 10));
    const tueChgPct = tue
      ? (tue.candles[tue.candles.length - 1].close - tue.candles[0].open) / tue.candles[0].open * 100
      : 0;

    // Apply Tue gate
    if (cfg.tueMoveThreshPct > 0 && tue) {
      const absTue = Math.abs(tueChgPct);
      const bigDown = tueChgPct <= -cfg.tueMoveThreshPct;
      const bigUp   = tueChgPct >=  cfg.tueMoveThreshPct;
      if (cfg.tueDirBoth ? (bigDown || bigUp) : bigDown) {
        skipped++; continue;
      }
    }

    // Find Thursday
    const thuDate = new Date(wedTs); thuDate.setUTCDate(wedTs.getUTCDate() + 1);
    const thu = db.get(thuDate.toISOString().slice(0, 10));
    if (!thu) continue;

    const entryStart = new Date(wed.date + "T00:00:00Z").getTime() + cfg.entryAfterH * 3600000;
    const expiryTs   = new Date(thu.date  + "T00:00:00Z").getTime() + cfg.expiryH   * 3600000;
    const wedOpen    = wed.candles[0].open;

    let rollingHigh = 0;
    for (const c of wed.candles) {
      if (c.high > rollingHigh) rollingHigh = c.high;
      if (c.timestamp < entryStart) continue;
      if ((rollingHigh - c.close) / rollingHigh * 100 > cfg.nearHighPct) continue;

      const ep = c.close;
      const wedRunPct = (ep - wedOpen) / wedOpen * 100;

      // Apply Wed-run gate
      if (cfg.wedRunThreshPct > 0 && wedRunPct >= cfg.wedRunThreshPct) {
        skipped++; break; // skip this week
      }

      const tp = ep * (1 - cfg.tpPct / 100);
      const sl = ep * (1 + cfg.stopPct / 100);
      const scan = [...wed.candles.filter(x => x.timestamp > c.timestamp), ...thu.candles.filter(x => x.timestamp <= expiryTs)];
      let exit = 0; let reason: "TP"|"STOP"|"EXPIRY" = "EXPIRY";
      for (const sc of scan) {
        if (sc.low <= tp) { exit = tp; reason = "TP"; break; }
        if (sc.high >= sl) { exit = sl; reason = "STOP"; break; }
        if (sc.timestamp >= expiryTs) { exit = sc.open; reason = "EXPIRY"; break; }
      }
      if (!exit) { const l = scan[scan.length - 1]; exit = l ? l.close : ep; }

      const pnl = cfg.capitalPerTrade * ((ep - exit) / ep) - cfg.capitalPerTrade * cfg.fee * 2;
      trades++; total += pnl; allR.push(pnl);
      if (reason === "TP") wins++; else if (reason === "STOP") stops++; else expiries++;
      if (pnl <= 0) { curCL++; maxCL = Math.max(maxCL, curCL); } else curCL = 0;

      const mo = wed.date.slice(0, 7);
      if (!monthly.has(mo)) monthly.set(mo, { pnl: 0, trades: 0, wins: 0 });
      const m = monthly.get(mo)!; m.pnl += pnl; m.trades++; if (pnl > 0) m.wins++;
      tradeLog.push({ date: wed.date, reason, pnlUsdt: pnl, tueChgPct, wedRunPct });
      break;
    }
  }

  return {
    trades, wins, stops, expiries, skipped, totalPnlUsdt: total,
    winRate: trades > 0 ? wins / trades * 100 : 0,
    maxConsecLoss: maxCL, monthly, tradeLog,
  };
}

function row(cfg: Cfg, r: Result) {
  return `  ${cfg.label.padEnd(58)} ${String(r.trades).padStart(4)} ${String(r.skipped).padStart(5)} ${(r.winRate.toFixed(0)+"%").padStart(6)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(10)} ${r.maxConsecLoss.toString().padStart(6)}`;
}

function printMonthly(r: Result) {
  console.log(`  ${"Month".padEnd(8)} ${"Trades".padStart(7)} ${"Wins".padStart(5)} ${"WR".padStart(5)} ${"PnL($)".padStart(9)}`);
  console.log("  " + "-".repeat(38));
  for (const [mo, ms] of r.monthly) {
    const wr = ms.trades > 0 ? (ms.wins/ms.trades*100).toFixed(0)+"%" : "n/a";
    console.log(`  ${mo.padEnd(8)} ${String(ms.trades).padStart(7)} ${String(ms.wins).padStart(5)} ${wr.padStart(5)} ${((ms.pnl>=0?"+":"")+"$"+ms.pnl.toFixed(0)).padStart(9)}`);
  }
  console.log(`  ${"TOTAL".padEnd(8)} ${String(r.trades).padStart(7)} ${String(r.wins).padStart(5)} ${(r.winRate.toFixed(0)+"%").padStart(5)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(9)}  (${r.skipped} skipped)`);
}

const base: Cfg = { label:"baseline (no gate)", nearHighPct:1.25, entryAfterH:18, tpPct:1.0, stopPct:2.0, expiryH:12, tueMoveThreshPct:0, tueDirBoth:false, wedRunThreshPct:0, capitalPerTrade:1000, fee:0.00055 };
const baseR = runSim(base, postLaunch);

console.log("\n" + SEP);
console.log("  Gate sweep on Wed near-high short (near 1.25% | after 18h | TP 1% | stop 2%)");
console.log("  Goal: identify the 4-5 stop losers without killing winning trades");
console.log(SEP);

// ── A) Tue absolute move gate (both directions) ──
console.log("\n  -- A) Skip if |Tue chg%| >= threshold (both directions) --");
console.log(`  ${"Config".padEnd(58)} ${"N".padStart(4)} ${"Skip".padStart(5)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(10)} ${"MaxCL".padStart(6)}`);
console.log("  " + "-".repeat(90));
console.log(row(base, baseR));
for (const t of [3.0, 4.0, 5.0, 6.0, 7.0, 8.0]) {
  const cfg: Cfg = { ...base, label: `|Tue chg| >= ${t}% (both dir)`, tueMoveThreshPct: t, tueDirBoth: true };
  console.log(row(cfg, runSim(cfg, postLaunch)));
}

// ── B) Tue big-down only gate ──
console.log("\n  -- B) Skip only if Tue dropped >= threshold (relief bounce gate) --");
console.log(`  ${"Config".padEnd(58)} ${"N".padStart(4)} ${"Skip".padStart(5)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(10)} ${"MaxCL".padStart(6)}`);
console.log("  " + "-".repeat(90));
console.log(row(base, baseR));
for (const t of [3.0, 4.0, 5.0, 6.0, 7.0, 8.0]) {
  const cfg: Cfg = { ...base, label: `Tue dropped >= ${t}% (down only)`, tueMoveThreshPct: t, tueDirBoth: false };
  console.log(row(cfg, runSim(cfg, postLaunch)));
}

// ── C) Wed-run gate (price already ran X% from open before entry) ──
console.log("\n  -- C) Skip if Wed already ran >= threshold from open before entry --");
console.log(`  ${"Config".padEnd(58)} ${"N".padStart(4)} ${"Skip".padStart(5)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(10)} ${"MaxCL".padStart(6)}`);
console.log("  " + "-".repeat(90));
console.log(row(base, baseR));
for (const t of [4.0, 5.0, 6.0, 7.0, 8.0, 9.0]) {
  const cfg: Cfg = { ...base, label: `Wed run >= ${t}% from open`, tueMoveThreshPct: 0, tueDirBoth: false, wedRunThreshPct: t };
  console.log(row(cfg, runSim(cfg, postLaunch)));
}

// ── D) Combined: |Tue| >= 4% AND Wed run >= 6% ──
console.log("\n  -- D) Combined gates --");
console.log(`  ${"Config".padEnd(58)} ${"N".padStart(4)} ${"Skip".padStart(5)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(10)} ${"MaxCL".padStart(6)}`);
console.log("  " + "-".repeat(90));
console.log(row(base, baseR));
for (const [tueT, wedT, both] of [
  [4.0, 0, true], [5.0, 0, true], [4.0, 0, false], [5.0, 0, false],
  [0, 6.0, false], [0, 7.0, false],
  [4.0, 6.0, true], [5.0, 6.0, true], [4.0, 6.0, false], [5.0, 7.0, false],
] as [number, number, boolean][]) {
  let label = "";
  const parts = [];
  if (tueT > 0) parts.push(`${both?"abs":"down"} Tue>=${tueT}%`);
  if (wedT > 0) parts.push(`wedRun>=${wedT}%`);
  label = parts.join(" + ");
  const cfg: Cfg = { ...base, label, tueMoveThreshPct: tueT, tueDirBoth: both, wedRunThreshPct: wedT };
  console.log(row(cfg, runSim(cfg, postLaunch)));
}

// ── E) Detailed trade log for best candidates ──
const candidates: Cfg[] = [
  { ...base, label: "|Tue chg| >= 4% (both)",        tueMoveThreshPct: 4.0, tueDirBoth: true  },
  { ...base, label: "|Tue chg| >= 5% (both)",        tueMoveThreshPct: 5.0, tueDirBoth: true  },
  { ...base, label: "Tue dropped >= 5% (down only)", tueMoveThreshPct: 5.0, tueDirBoth: false },
  { ...base, label: "Wed run >= 6%",                 wedRunThreshPct: 6.0                     },
  { ...base, label: "abs Tue>=4% + wedRun>=6%",      tueMoveThreshPct: 4.0, tueDirBoth: true, wedRunThreshPct: 6.0 },
];

console.log("\n" + SEP);
console.log("  Monthly breakdown — best gate candidates");
console.log(SEP);
for (const cfg of candidates) {
  const r = runSim(cfg, postLaunch);
  console.log(`\n  -- ${cfg.label} | ${r.trades} trades | WR ${r.winRate.toFixed(0)}% | $${r.totalPnlUsdt.toFixed(0)} | ${r.skipped} skipped --`);
  printMonthly(r);
}

// ── F) Show what each gate filters OUT ──
console.log("\n" + SEP);
console.log("  Trades filtered by each gate — verify no winning trades lost");
console.log(SEP);
for (const cfg of candidates) {
  const r = runSim(cfg, postLaunch);
  // Trades in baseline that are NOT in filtered = skipped profitable ones
  const baseLog = baseR.tradeLog;
  const filtLog  = r.tradeLog;
  const filtDates = new Set(filtLog.map(t => t.date));
  const removed = baseLog.filter(t => !filtDates.has(t.date));
  console.log(`\n  Gate: ${cfg.label}`);
  console.log(`  Removed ${removed.length} weeks:`);
  for (const t of removed) {
    const tag = t.reason === "TP" ? "TP  " : t.reason === "STOP" ? "STOP" : "EXP ";
    console.log(`    ${t.date}  ${tag}  pnl=${t.pnlUsdt>=0?"+":""}$${t.pnlUsdt.toFixed(0).padStart(5)}  tueChg=${t.tueChgPct>=0?"+":""}${t.tueChgPct.toFixed(1)}%  wedRun=${t.wedRunPct>=0?"+":""}${t.wedRunPct.toFixed(1)}%`);
  }
}
