import fs from "fs";
import { Candle } from "./fetch-candles";

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

interface DayData { date: string; open: number; openTs: number; candles: Candle[]; }

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
  days.push({ date, open: cs[0].open, openTs: cs[0].timestamp, candles: cs });
}
days.sort((a, b) => a.date.localeCompare(b.date));

// Post-launch only (Jan 2025+)
const postLaunch = days.filter(d => d.date >= "2025-01-01");
const dayByDate = new Map(days.map(d => [d.date, d]));

const SEP = "=".repeat(100);
const pct = (v: number, d = 2) => (v >= 0 ? "+" : "") + v.toFixed(d) + "%";

// ── Shared Wed short runner (returns per-trade array too) ──
interface WedShortCfg {
  label: string; entryAfterH: number; nearHighPct: number;
  tpPct: number; stopPct: number; expiryH: number;
  capitalPerTrade: number; fee: number;
  monMomThreshPct?: number;   // filter: skip if Mon > priFri by this %
  requireTueUp?: boolean;     // filter: also require Tue UP
}

interface WedShortResult {
  trades: number; wins: number; losses: number; expiries: number; skipped: number;
  totalPnlUsdt: number; winRate: number; avgWinPct: number; avgLossPct: number;
  maxConsecLoss: number;
  monthly: Map<string, { pnl: number; trades: number; wins: number }>;
}

function runWedShort(cfg: WedShortCfg, allDays: DayData[]): WedShortResult {
  const wedDays = allDays.filter(d => new Date(d.date + "T12:00:00Z").getUTCDay() === 3);
  const db = new Map(allDays.map(d => [d.date, d]));
  let trades = 0, wins = 0, losses = 0, expiries = 0, skipped = 0, totalPnlUsdt = 0;
  let maxConsecLoss = 0, curConsec = 0;
  const monthly = new Map<string, { pnl: number; trades: number; wins: number }>();
  const allR: number[] = [];

  for (const wed of wedDays) {
    // Week-momentum filter
    if (cfg.monMomThreshPct && cfg.monMomThreshPct > 0) {
      const wedTs = new Date(wed.date + "T12:00:00Z");
      const monDate = new Date(wedTs); monDate.setUTCDate(wedTs.getUTCDate() - 2);
      const tueDate = new Date(wedTs); tueDate.setUTCDate(wedTs.getUTCDate() - 1);
      const friDate = new Date(wedTs); friDate.setUTCDate(wedTs.getUTCDate() - 5);
      const mon = db.get(monDate.toISOString().slice(0, 10));
      const tue = db.get(tueDate.toISOString().slice(0, 10));
      const fri = db.get(friDate.toISOString().slice(0, 10));
      if (mon && fri) {
        const monClose = mon.candles[mon.candles.length - 1].close;
        const friClose = fri.candles[fri.candles.length - 1].close;
        const monMom = (monClose - friClose) / friClose * 100;
        const tueUp = tue ? tue.candles[tue.candles.length - 1].close > tue.candles[0].open : false;
        if (monMom >= cfg.monMomThreshPct && (!cfg.requireTueUp || tueUp)) {
          skipped++; continue;
        }
      }
    }

    const thuDate = new Date(wed.date + "T12:00:00Z");
    thuDate.setUTCDate(thuDate.getUTCDate() + 1);
    const thu = db.get(thuDate.toISOString().slice(0, 10));
    if (!thu) continue;

    const entryStart = new Date(wed.date + "T00:00:00Z").getTime() + cfg.entryAfterH * 3600000;
    const expiryTs  = new Date(thu.date + "T00:00:00Z").getTime() + cfg.expiryH  * 3600000;

    let rollingHigh = 0;
    for (const c of wed.candles) {
      if (c.high > rollingHigh) rollingHigh = c.high;
      if (c.timestamp < entryStart) continue;
      if ((rollingHigh - c.close) / rollingHigh * 100 > cfg.nearHighPct) continue;

      const ep = c.close;
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
      trades++; totalPnlUsdt += pnl; allR.push(pnl);
      if (reason === "TP") wins++; else if (reason === "STOP") losses++; else expiries++;
      if (pnl <= 0) { curConsec++; maxConsecLoss = Math.max(maxConsecLoss, curConsec); } else curConsec = 0;
      const mo = wed.date.slice(0, 7);
      if (!monthly.has(mo)) monthly.set(mo, { pnl: 0, trades: 0, wins: 0 });
      const m = monthly.get(mo)!; m.pnl += pnl; m.trades++; if (pnl > 0) m.wins++;
      break;
    }
  }
  const wT = allR.filter(p => p > 0), lT = allR.filter(p => p <= 0);
  return {
    trades, wins, losses, expiries, skipped, totalPnlUsdt,
    winRate: trades > 0 ? wins / trades * 100 : 0,
    avgWinPct: wT.length > 0 ? wT.reduce((a,b)=>a+b,0)/wT.length/cfg.capitalPerTrade*100 : 0,
    avgLossPct: lT.length > 0 ? lT.reduce((a,b)=>a+b,0)/lT.length/cfg.capitalPerTrade*100 : 0,
    maxConsecLoss, monthly,
  };
}

function wedRow(cfg: WedShortCfg, r: WedShortResult, showSkip = false) {
  const skip = showSkip ? String(r.skipped).padStart(5) : "";
  return `  ${cfg.label.padEnd(50)} ${String(r.trades).padStart(4)}${skip} ${(r.winRate.toFixed(0)+"%").padStart(6)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(10)} ${r.maxConsecLoss.toString().padStart(6)}`;
}

function printMonthly(r: { monthly: Map<string, {pnl:number;trades:number;wins:number}>; trades:number; wins:number; winRate:number; totalPnlUsdt:number; skipped?:number }) {
  console.log(`  ${"Month".padEnd(8)} ${"Trades".padStart(7)} ${"Wins".padStart(5)} ${"WR".padStart(5)} ${"PnL($)".padStart(9)}`);
  console.log("  " + "-".repeat(38));
  for (const [mo, ms] of r.monthly) {
    const wr = ms.trades > 0 ? (ms.wins/ms.trades*100).toFixed(0)+"%" : "n/a";
    console.log(`  ${mo.padEnd(8)} ${String(ms.trades).padStart(7)} ${String(ms.wins).padStart(5)} ${wr.padStart(5)} ${((ms.pnl>=0?"+":"")+"$"+ms.pnl.toFixed(0)).padStart(9)}`);
  }
  const skip = r.skipped !== undefined ? `  (${r.skipped} weeks skipped by filter)` : "";
  console.log(`  ${"TOTAL".padEnd(8)} ${String(r.trades).padStart(7)} ${String(r.wins).padStart(5)} ${(r.winRate.toFixed(0)+"%").padStart(5)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(9)}${skip}`);
}

// ══════════════════════════════════════════════
//   SECTION 13 — Week-momentum filter on Wed short
// ══════════════════════════════════════════════
console.log("\n" + SEP);
console.log("  SECTION 13 — Week-momentum filter on Wed near-high short");
console.log("  SKIP week if: Mon closed >= X% above prior-Fri close [+ Tue UP]");
console.log("  Logic: strong Mon bounce = week still trending up = dangerous to short Wed");
console.log("  Base config: near 1.25% | after 18h | TP 1% | stop 2%");
console.log(SEP);
console.log(`  ${"Config".padEnd(50)} ${"N".padStart(4)} ${"Skip".padStart(5)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(10)} ${"MaxCL".padStart(6)}`);
console.log("  " + "-".repeat(85));

const baseCfg: WedShortCfg = { label: "no filter (baseline)", entryAfterH: 18, nearHighPct: 1.25, tpPct: 1.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 };
console.log(wedRow(baseCfg, runWedShort(baseCfg, postLaunch), true));

for (const thresh of [1.0, 2.0, 3.0, 4.0]) {
  for (const requireTueUp of [false, true]) {
    const label = `skip Mon>priFri+${thresh}%${requireTueUp ? " & TueUP" : "       "}`;
    const cfg: WedShortCfg = { label, entryAfterH: 18, nearHighPct: 1.25, tpPct: 1.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055, monMomThreshPct: thresh, requireTueUp };
    console.log(wedRow(cfg, runWedShort(cfg, postLaunch), true));
  }
}

// Monthly for each filter threshold (no-TueUp and with-TueUp) at 2% and 3%
for (const [thresh, tueUp] of [[2.0, false], [2.0, true], [3.0, true]] as [number, boolean][]) {
  const label = `skip Mon>priFri+${thresh}%${tueUp ? " & TueUP" : ""}`;
  const cfg: WedShortCfg = { label, entryAfterH: 18, nearHighPct: 1.25, tpPct: 1.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055, monMomThreshPct: thresh, requireTueUp: tueUp };
  const r = runWedShort(cfg, postLaunch);
  console.log(`\n  -- Monthly: ${label} | ${r.trades} trades | WR ${r.winRate.toFixed(0)}% | $${r.totalPnlUsdt.toFixed(0)} --`);
  printMonthly(r);
}

// ══════════════════════════════════════════════
//   SECTION 14 — Thu near-low LONG -> Fri 12h exit
//   Thesis: Wed UP -> Thu DOWN 63% of time.
//   Thu has 5-17% range. Buy the Thu low after it's
//   been established (after 12/15/18h UTC), exit Fri 12h.
//   Filter: only enter if Wed was UP (close > open)
// ══════════════════════════════════════════════

interface ThuLongCfg {
  label: string; requireWedUp: boolean;
  entryAfterH: number; nearLowPct: number;
  tpPct: number; stopPct: number; expiryH: number;
  capitalPerTrade: number; fee: number;
}
interface ThuLongResult {
  trades: number; wins: number; losses: number; expiries: number;
  totalPnlUsdt: number; winRate: number; avgWinPct: number; avgLossPct: number;
  maxConsecLoss: number;
  monthly: Map<string, { pnl: number; trades: number; wins: number }>;
}

function runThuLong(cfg: ThuLongCfg, allDays: DayData[]): ThuLongResult {
  const thuDays = allDays.filter(d => new Date(d.date + "T12:00:00Z").getUTCDay() === 4);
  const db = new Map(allDays.map(d => [d.date, d]));
  let trades = 0, wins = 0, losses = 0, expiries = 0, totalPnlUsdt = 0;
  let maxConsecLoss = 0, curConsec = 0;
  const monthly = new Map<string, { pnl: number; trades: number; wins: number }>();
  const allR: number[] = [];

  for (const thu of thuDays) {
    // Wed UP filter
    if (cfg.requireWedUp) {
      const wedDate = new Date(thu.date + "T12:00:00Z");
      wedDate.setUTCDate(wedDate.getUTCDate() - 1);
      const wed = db.get(wedDate.toISOString().slice(0, 10));
      if (!wed) continue;
      if (wed.candles[wed.candles.length - 1].close <= wed.candles[0].open) continue;
    }

    const friDate = new Date(thu.date + "T12:00:00Z");
    friDate.setUTCDate(friDate.getUTCDate() + 1);
    const fri = db.get(friDate.toISOString().slice(0, 10));
    if (!fri) continue;

    const entryStart = new Date(thu.date + "T00:00:00Z").getTime() + cfg.entryAfterH * 3600000;
    const expiryTs  = new Date(fri.date  + "T00:00:00Z").getTime() + cfg.expiryH  * 3600000;

    let rollingLow = Infinity;
    for (const c of thu.candles) {
      if (c.low < rollingLow) rollingLow = c.low;
      if (c.timestamp < entryStart) continue;
      if ((c.close - rollingLow) / rollingLow * 100 > cfg.nearLowPct) continue;

      const ep = c.close;
      const tp = ep * (1 + cfg.tpPct / 100);
      const sl = ep * (1 - cfg.stopPct / 100);
      const scan = [...thu.candles.filter(x => x.timestamp > c.timestamp), ...fri.candles.filter(x => x.timestamp <= expiryTs)];
      let exit = 0; let reason: "TP"|"STOP"|"EXPIRY" = "EXPIRY";
      for (const sc of scan) {
        if (sc.high >= tp) { exit = tp; reason = "TP"; break; }
        if (sc.low  <= sl) { exit = sl; reason = "STOP"; break; }
        if (sc.timestamp >= expiryTs) { exit = sc.open; reason = "EXPIRY"; break; }
      }
      if (!exit) { const l = scan[scan.length - 1]; exit = l ? l.close : ep; }

      const pnl = cfg.capitalPerTrade * ((exit - ep) / ep) - cfg.capitalPerTrade * cfg.fee * 2;
      trades++; totalPnlUsdt += pnl; allR.push(pnl);
      if (reason === "TP") wins++; else if (reason === "STOP") losses++; else expiries++;
      if (pnl <= 0) { curConsec++; maxConsecLoss = Math.max(maxConsecLoss, curConsec); } else curConsec = 0;
      const mo = thu.date.slice(0, 7);
      if (!monthly.has(mo)) monthly.set(mo, { pnl: 0, trades: 0, wins: 0 });
      const m = monthly.get(mo)!; m.pnl += pnl; m.trades++; if (pnl > 0) m.wins++;
      break;
    }
  }
  const wT = allR.filter(p => p > 0), lT = allR.filter(p => p <= 0);
  return {
    trades, wins, losses, expiries, totalPnlUsdt,
    winRate: trades > 0 ? wins / trades * 100 : 0,
    avgWinPct: wT.length > 0 ? wT.reduce((a,b)=>a+b,0)/wT.length/cfg.capitalPerTrade*100 : 0,
    avgLossPct: lT.length > 0 ? lT.reduce((a,b)=>a+b,0)/lT.length/cfg.capitalPerTrade*100 : 0,
    maxConsecLoss, monthly,
  };
}

const thuHdr = `  ${"Config".padEnd(58)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(10)} ${"AvgWin".padStart(8)} ${"AvgLoss".padStart(8)} ${"MaxCL".padStart(6)} ${"Exp".padStart(5)}`;

console.log("\n" + SEP);
console.log("  SECTION 14 — Thu near-low LONG -> Fri 12h exit");
console.log("  Entry: Thu after X UTC, within Y% of rolling daily low");
console.log("  Filter A: Wed was UP (close > open)");
console.log("  Filter B: All Thursdays (no filter)");
console.log(SEP);
console.log(thuHdr);
console.log("  " + "-".repeat(105));

for (const nearLow of [0.5, 1.0, 1.5, 2.0]) {
  console.log(`\n  -- nearLow ${nearLow}% | WedUP filter --`);
  for (const entryAfterH of [12, 15, 18]) {
    for (const tp of [1.0, 2.0, 3.0]) {
      for (const stop of [1.0, 2.0]) {
        const cfg: ThuLongCfg = {
          label: `nearLow ${nearLow}% | after ${entryAfterH}h | TP ${tp}% | stop ${stop}% | WedUP`,
          requireWedUp: true, entryAfterH, nearLowPct: nearLow,
          tpPct: tp, stopPct: stop, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055,
        };
        const r = runThuLong(cfg, postLaunch);
        if (r.trades === 0) continue;
        console.log(`  ${cfg.label.padEnd(58)} ${String(r.trades).padStart(4)} ${(r.winRate.toFixed(0)+"%").padStart(6)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(10)} ${pct(r.avgWinPct,2).padStart(8)} ${pct(r.avgLossPct,2).padStart(8)} ${r.maxConsecLoss.toString().padStart(6)} ${r.expiries.toString().padStart(5)}`);
      }
    }
  }
}

console.log("\n  -- All Thursdays (no Wed-UP filter, nearLow 1%, after 15h) --");
for (const tp of [1.0, 2.0, 3.0]) {
  for (const stop of [1.0, 2.0]) {
    const cfg: ThuLongCfg = {
      label: `ALL THU | nearLow 1% | after 15h | TP ${tp}% | stop ${stop}%`,
      requireWedUp: false, entryAfterH: 15, nearLowPct: 1.0,
      tpPct: tp, stopPct: stop, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055,
    };
    const r = runThuLong(cfg, postLaunch);
    if (r.trades === 0) continue;
    console.log(`  ${cfg.label.padEnd(58)} ${String(r.trades).padStart(4)} ${(r.winRate.toFixed(0)+"%").padStart(6)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(10)} ${pct(r.avgWinPct,2).padStart(8)} ${pct(r.avgLossPct,2).padStart(8)} ${r.maxConsecLoss.toString().padStart(6)} ${r.expiries.toString().padStart(5)}`);
  }
}

console.log("\n" + SEP);
console.log("  SECTION 14 — Monthly breakdown: Thu long candidates");
console.log(SEP);

const thuMonthCfgs: ThuLongCfg[] = [
  { label: "nearLow 1% | after 15h | TP 2% | stop 1% | WedUP", requireWedUp: true,  entryAfterH: 15, nearLowPct: 1.0, tpPct: 2.0, stopPct: 1.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "nearLow 1% | after 15h | TP 2% | stop 2% | WedUP", requireWedUp: true,  entryAfterH: 15, nearLowPct: 1.0, tpPct: 2.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "nearLow 1% | after 18h | TP 2% | stop 1% | WedUP", requireWedUp: true,  entryAfterH: 18, nearLowPct: 1.0, tpPct: 2.0, stopPct: 1.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "nearLow 1.5% | after 15h | TP 2% | stop 1% | WedUP",requireWedUp: true, entryAfterH: 15, nearLowPct: 1.5, tpPct: 2.0, stopPct: 1.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "nearLow 1% | after 15h | TP 2% | stop 1% | ALL",   requireWedUp: false, entryAfterH: 15, nearLowPct: 1.0, tpPct: 2.0, stopPct: 1.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
];

for (const cfg of thuMonthCfgs) {
  const r = runThuLong(cfg, postLaunch);
  console.log(`\n  -- ${cfg.label} | ${r.trades} trades | WR ${r.winRate.toFixed(0)}% | $${r.totalPnlUsdt.toFixed(0)} --`);
  printMonthly(r);
}
