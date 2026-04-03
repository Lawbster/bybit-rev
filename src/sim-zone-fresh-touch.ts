// ─────────────────────────────────────────────
// Zone Fresh-Touch Entry Sim
//
// Builds on event study findings:
//   - Fresh-touch re-arm rule (Codex spec)
//   - Gate: US session (13-22h UTC) + exclude Monday
//   - No speed/touch-type filter yet (sample too small)
//   - Sweeps TP% × SL anchor × expiry
//
// Usage:
//   npx ts-node src/sim-zone-fresh-touch.ts HYPEUSDT 2025-01-01
//   npx ts-node src/sim-zone-fresh-touch.ts BTCUSDT  2024-06-01
// ─────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { Candle } from "./fetch-candles";

const SYMBOL     = process.argv[2] || "HYPEUSDT";
const START_DATE = process.argv[3] || "2025-01-01";
const SEP = "=".repeat(110);

// ── Load ──
function loadCandles(symbol: string): Candle[] {
  const dataDir = path.resolve(__dirname, "../data");
  const full = path.join(dataDir, `${symbol}_5_full.json`);
  const std  = path.join(dataDir, `${symbol}_5.json`);
  const file = fs.existsSync(full) ? full : fs.existsSync(std) ? std : null;
  if (!file) throw new Error(`No 5m data for ${symbol}`);
  const c: Candle[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  c.sort((a, b) => a.timestamp - b.timestamp);
  return c;
}

// ── Resample ──
interface DailyBar {
  date: string; ts: number;
  open: number; high: number; low: number; close: number;
}
function toDailyBars(candles: Candle[]): DailyBar[] {
  const map = new Map<string, DailyBar>();
  for (const c of candles) {
    const date = new Date(c.timestamp).toISOString().slice(0, 10);
    if (!map.has(date)) {
      map.set(date, { date, ts: new Date(date + "T00:00:00Z").getTime(), open: c.open, high: c.high, low: c.low, close: c.close });
    } else {
      const d = map.get(date)!;
      if (c.high > d.high) d.high = c.high;
      if (c.low  < d.low)  d.low  = c.low;
      d.close = c.close;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
}

// ── Zone detection (same params as event study) ──
function findSwingLows(bars: DailyBar[], wing: number) {
  const pivots: { idx: number; price: number; date: string }[] = [];
  for (let i = wing; i < bars.length - wing; i++) {
    const lo = bars[i].low;
    let isPivot = true;
    for (let j = i - wing; j <= i + wing; j++) {
      if (j !== i && bars[j].low <= lo) { isPivot = false; break; }
    }
    if (isPivot) pivots.push({ idx: i, price: lo, date: bars[i].date });
  }
  return pivots;
}

interface Zone {
  id: string;
  midpoint: number; low: number; high: number;
  touches: number; firstDate: string; formationTs: number;
  broken: boolean;
}
function buildZones(pivots: { idx: number; price: number; date: string }[], clusterPct: number, bandHalfPct: number, minTouches: number): Zone[] {
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const raw: Zone[] = [];
  let idc = 0;
  for (const p of sorted) {
    let merged = false;
    for (const z of raw) {
      if (Math.abs(p.price - z.midpoint) / z.midpoint * 100 <= clusterPct) {
        z.midpoint = (z.midpoint * z.touches + p.price) / (z.touches + 1);
        z.touches++;
        z.low  = z.midpoint * (1 - bandHalfPct / 100);
        z.high = z.midpoint * (1 + bandHalfPct / 100);
        if (p.date < z.firstDate) { z.firstDate = p.date; z.formationTs = new Date(p.date + "T00:00:00Z").getTime(); }
        merged = true; break;
      }
    }
    if (!merged) {
      raw.push({ id: `z${++idc}`, midpoint: p.price, low: p.price * (1 - bandHalfPct/100), high: p.price * (1 + bandHalfPct/100), touches: 1, firstDate: p.date, formationTs: new Date(p.date + "T00:00:00Z").getTime(), broken: false });
    }
  }
  return raw.filter(z => z.touches >= minTouches);
}

// ── Session / DOW helpers ──
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function isUSSession(ts: number): boolean { const h = new Date(ts).getUTCHours(); return h >= 13 && h < 22; }
function isMonday(ts: number): boolean    { return new Date(ts).getUTCDay() === 1; }

// ── Sim config ──
interface SimCfg {
  label: string;
  tpPct: number;
  slMode: "zone_low" | "zone_low_0.5" | "zone_low_1";  // SL anchor
  expiryH: number;
  // Session/day gates
  usOnly: boolean;
  exMon: boolean;
  // Touch type gate
  allowWickOnly: boolean;
  capitalPerTrade: number;
  fee: number;
}

interface TradeLine {
  date: string; dow: string; hour: number;
  zoneMid: number; zoneTouches: number;
  entryPrice: number; slPrice: number; tpPrice: number;
  reason: "TP" | "STOP" | "EXPIRY";
  pnlPct: number; pnlUsdt: number;
  mfe8hPct: number; mae8hPct: number;
}

interface SimResult {
  trades: number; wins: number; stops: number; expiries: number;
  totalPnlUsdt: number; winRate: number; maxConsecLoss: number;
  avgWin: number; avgLoss: number; expectancy: number;
  monthly: Map<string, { pnl: number; trades: number; wins: number }>;
  tradeLog: TradeLine[];
}

// ── Core engine ──
function runSim(
  candles5m: Candle[],
  dailyBars: DailyBar[],
  cfg: SimCfg,
  startDate: string,
): SimResult {
  const startMs  = new Date(startDate + "T00:00:00Z").getTime();
  const allPivots = findSwingLows(dailyBars, 3);

  interface ZoneState {
    lastInteractionTs: number;
    maxHighSinceLast: number;
    hadCloseAboveBuffer: boolean;
    inZone: boolean;
  }

  let currentZones: Zone[] = [];
  let currentDayKey = "";
  const zoneState = new Map<string, ZoneState>();

  let trades = 0, wins = 0, stops = 0, expiries = 0, total = 0;
  let maxCL = 0, curCL = 0, sumWin = 0, sumLoss = 0, nWin = 0, nLoss = 0;
  const monthly = new Map<string, { pnl: number; trades: number; wins: number }>();
  const tradeLog: TradeLine[] = [];

  for (let i = 0; i < candles5m.length; i++) {
    const c = candles5m[i];
    if (c.timestamp < startMs) continue;

    const date   = new Date(c.timestamp).toISOString().slice(0, 10);
    const dayIdx = dailyBars.findIndex(b => b.date >= date) - 1;
    if (dayIdx < 6) continue;

    // Rebuild zones once per day
    if (date !== currentDayKey) {
      currentDayKey = date;
      const availPivots = allPivots.filter(p => p.date < date);
      if (availPivots.length === 0) continue;
      const newZones = buildZones(availPivots, 2.0, 1.0, 2);
      // Mark broken
      for (const z of newZones) {
        for (const b of dailyBars.slice(0, dayIdx + 1)) {
          if (b.date <= z.firstDate) continue;
          if (b.close < z.midpoint * 0.98) { z.broken = true; break; }
        }
      }
      for (const z of newZones.filter(z => !z.broken)) {
        if (!zoneState.has(z.id)) {
          zoneState.set(z.id, { lastInteractionTs: z.formationTs, maxHighSinceLast: 0, hadCloseAboveBuffer: false, inZone: false });
        }
      }
      currentZones = newZones.filter(z => !z.broken);
    }

    if (currentZones.length === 0) continue;

    for (const z of currentZones) {
      const st = zoneState.get(z.id);
      if (!st) continue;

      const touching = c.low <= z.high;

      if (!touching) {
        if (c.high > st.maxHighSinceLast) st.maxHighSinceLast = c.high;
        if (c.close >= z.high * 1.005)    st.hadCloseAboveBuffer = true;
        st.inZone = false;
        continue;
      }

      // ── Touching zone ──
      const prevC = i > 0 ? candles5m[i - 1] : null;
      const prevNotTouching  = prevC ? prevC.low > z.high : true;
      const hoursSinceLast   = (c.timestamp - st.lastInteractionTs) / 3600000;
      const isFresh = (
        prevNotTouching &&
        hoursSinceLast >= 24 &&
        st.maxHighSinceLast >= z.high * 1.02 &&
        st.hadCloseAboveBuffer
      );

      if (isFresh) {
        // ── Apply gates ──
        let qualify = true;
        if (cfg.usOnly && !isUSSession(c.timestamp)) qualify = false;
        if (cfg.exMon  && isMonday(c.timestamp))     qualify = false;

        // Touch type gate
        const isWickOnly = c.close > z.high;
        if (!cfg.allowWickOnly && isWickOnly) qualify = false;

        if (qualify) {
          const ep = c.close;
          const tp = ep * (1 + cfg.tpPct / 100);
          const sl = cfg.slMode === "zone_low"     ? z.low :
                     cfg.slMode === "zone_low_0.5" ? z.low * 0.995 :
                                                     z.low * 0.990;
          const slPct = (ep - sl) / ep * 100;

          const expTs = c.timestamp + cfg.expiryH * 3600000;
          let exit = 0, reason: "TP"|"STOP"|"EXPIRY" = "EXPIRY";
          let mfe = 0, mae = 0;
          const mfeMaeEnd = c.timestamp + 8 * 3600000;

          for (let j = i + 1; j < candles5m.length; j++) {
            const sc = candles5m[j];
            const upMove   = (sc.high - ep) / ep * 100;
            const downMove = (sc.low  - ep) / ep * 100;
            if (sc.timestamp <= mfeMaeEnd) {
              if (upMove   > mfe) mfe = upMove;
              if (downMove < mae) mae = downMove;
            }
            if (exit === 0) {
              if (sc.high >= tp)    { exit = tp; reason = "TP";    }
              else if (sc.low <= sl){ exit = sl; reason = "STOP";  }
              else if (sc.timestamp >= expTs) { exit = sc.open; reason = "EXPIRY"; }
            }
            if (exit !== 0 && sc.timestamp > mfeMaeEnd) break;
          }
          if (exit === 0) { const l = candles5m[Math.min(i + 1, candles5m.length - 1)]; exit = l.close; }

          const pnlPct  = (exit - ep) / ep * 100;
          const pnlUsdt = cfg.capitalPerTrade * (pnlPct / 100) - cfg.capitalPerTrade * cfg.fee * 2;

          trades++; total += pnlUsdt;
          if (reason === "TP")   { wins++;    sumWin  += pnlUsdt; nWin++; }
          else if (reason === "STOP") { stops++; sumLoss += pnlUsdt; nLoss++; }
          else { expiries++; if (pnlUsdt > 0) { sumWin += pnlUsdt; nWin++; } else { sumLoss += pnlUsdt; nLoss++; } }

          if (pnlUsdt <= 0) { curCL++; maxCL = Math.max(maxCL, curCL); } else curCL = 0;

          const mo = date.slice(0, 7);
          if (!monthly.has(mo)) monthly.set(mo, { pnl: 0, trades: 0, wins: 0 });
          const m = monthly.get(mo)!; m.pnl += pnlUsdt; m.trades++; if (pnlUsdt > 0) m.wins++;

          const h = new Date(c.timestamp).getUTCHours();
          tradeLog.push({ date, dow: DOW[new Date(c.timestamp).getUTCDay()], hour: h, zoneMid: z.midpoint, zoneTouches: z.touches, entryPrice: ep, slPrice: sl, tpPrice: tp, reason, pnlPct, pnlUsdt, mfe8hPct: mfe, mae8hPct: mae });
        }
      }

      // Update state
      if (!st.inZone) {
        st.lastInteractionTs   = c.timestamp;
        st.maxHighSinceLast    = 0;
        st.hadCloseAboveBuffer = false;
        st.inZone = true;
      } else {
        st.lastInteractionTs = c.timestamp;
      }
    }
  }

  const wr = trades > 0 ? wins / trades : 0;
  const avgWin  = nWin  > 0 ? sumWin  / nWin  : 0;
  const avgLoss = nLoss > 0 ? sumLoss / nLoss : 0;
  return { trades, wins, stops, expiries, totalPnlUsdt: total, winRate: wr * 100, maxConsecLoss: maxCL, avgWin, avgLoss, expectancy: wr * avgWin + (1 - wr) * avgLoss, monthly, tradeLog };
}

// ── Formatters ──
function row(cfg: SimCfg, r: SimResult): string {
  const rr  = r.avgLoss !== 0 ? Math.abs(r.avgWin / r.avgLoss).toFixed(2) : "∞";
  const exp = r.expectancy >= 0 ? "+" : "";
  return `  ${cfg.label.padEnd(58)} ${String(r.trades).padStart(4)} ${(r.winRate.toFixed(0)+"%").padStart(6)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(9)} ${r.maxConsecLoss.toString().padStart(5)}  RR:${rr}  exp:${exp}$${r.expectancy.toFixed(1)}`;
}

function printMonthly(r: SimResult) {
  console.log(`  ${"Month".padEnd(8)} ${"N".padStart(4)} ${"W".padStart(3)} ${"WR".padStart(5)} ${"PnL".padStart(8)}`);
  console.log("  " + "─".repeat(32));
  for (const [mo, ms] of r.monthly) {
    const wr = ms.trades > 0 ? (ms.wins/ms.trades*100).toFixed(0)+"%" : "─";
    console.log(`  ${mo.padEnd(8)} ${String(ms.trades).padStart(4)} ${String(ms.wins).padStart(3)} ${wr.padStart(5)} ${((ms.pnl>=0?"+":"")+"$"+ms.pnl.toFixed(0)).padStart(8)}`);
  }
  const wr = r.trades > 0 ? r.winRate.toFixed(0)+"%" : "─";
  console.log(`  ${"TOTAL".padEnd(8)} ${String(r.trades).padStart(4)} ${String(r.wins).padStart(3)} ${wr.padStart(5)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(8)}`);
}

// ── Run ──
console.log("\n" + SEP);
console.log(`  Zone Fresh-Touch Entry Sim — ${SYMBOL}  (start: ${START_DATE})`);
console.log(SEP);

const candles5m = loadCandles(SYMBOL);
const dailyBars = toDailyBars(candles5m);
console.log(`\n  Data: ${candles5m.length} 5m candles | ${dailyBars.length} daily bars\n`);

const base: SimCfg = {
  label: "US + ex-Mon | SL@zone.low | TP2% | 8h | no wick filter",
  tpPct: 2.0, slMode: "zone_low", expiryH: 8,
  usOnly: true, exMon: true, allowWickOnly: true,
  capitalPerTrade: 1000, fee: 0.00055,
};

// Baseline: all fresh touches, no gate
const noGate: SimCfg = { ...base, label: "ALL sessions + Mon (no gate)", usOnly: false, exMon: false };

console.log(`  ${"Config".padEnd(58)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"MaxCL".padStart(5)}  RR  Exp/trade`);
console.log("  " + "─".repeat(100));

// ── A) Gate progression (show value of each gate) ──
console.log("\n  -- A) Gate progression --");
console.log(row(noGate, runSim(candles5m, dailyBars, noGate, START_DATE)));
console.log(row({ ...base, label: "US session only (incl Mon)", exMon: false }, runSim(candles5m, dailyBars, { ...base, exMon: false }, START_DATE)));
console.log(row({ ...base, label: "US + ex-Mon" }, runSim(candles5m, dailyBars, base, START_DATE)));
console.log(row({ ...base, label: "US + ex-Mon + no wick-only touches", allowWickOnly: false }, runSim(candles5m, dailyBars, { ...base, allowWickOnly: false }, START_DATE)));

// ── B) TP sweep (US + ex-Mon) ──
console.log("\n  -- B) TP% sweep (US + ex-Mon | SL@zone.low | 8h expiry) --");
for (const tp of [1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0]) {
  const cfg: SimCfg = { ...base, label: `TP ${tp}%`, tpPct: tp };
  console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
}

// ── C) SL anchor (US + ex-Mon | TP 4%) ──
console.log("\n  -- C) SL anchor (US + ex-Mon | TP 4%) --");
for (const [slMode, label] of [["zone_low","SL at zone.low"],["zone_low_0.5","SL at zone.low - 0.5%"],["zone_low_1","SL at zone.low - 1%"]] as [SimCfg["slMode"],string][]) {
  const cfg: SimCfg = { ...base, label, tpPct: 4.0, slMode };
  console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
}

// ── D) Expiry (US + ex-Mon | TP 4% | SL@zone.low) ──
console.log("\n  -- D) Expiry window (US + ex-Mon | TP 4%) --");
for (const h of [4, 6, 8, 12, 24]) {
  const cfg: SimCfg = { ...base, label: `expiry ${h}h | TP 4%`, tpPct: 4.0, expiryH: h };
  console.log(row(cfg, runSim(candles5m, dailyBars, cfg, START_DATE)));
}

// ── E) Best config deep-dive ──
console.log("\n" + SEP);
console.log("  Best config — full breakdown");
console.log(SEP);

const candidates: SimCfg[] = [
  { ...base, label: "US+exMon | TP2% | SL@low | 8h",  tpPct: 2.0 },
  { ...base, label: "US+exMon | TP3% | SL@low | 8h",  tpPct: 3.0 },
  { ...base, label: "US+exMon | TP4% | SL@low | 8h",  tpPct: 4.0 },
  { ...base, label: "US+exMon | TP4% | SL@low | 12h", tpPct: 4.0, expiryH: 12 },
  { ...base, label: "US+exMon | TP6% | SL@low | 8h",  tpPct: 6.0 },
  { ...base, label: "US+exMon | TP4% | SL@low-0.5% | 8h", tpPct: 4.0, slMode: "zone_low_0.5" },
  { ...base, label: "US+exMon | TP4% | no wick | 8h", tpPct: 4.0, allowWickOnly: false },
];

let bestR: SimResult | null = null;
let bestCfg = candidates[0];
for (const cfg of candidates) {
  const r = runSim(candles5m, dailyBars, cfg, START_DATE);
  if (r.trades >= 3 && (!bestR || r.expectancy > bestR.expectancy)) { bestR = r; bestCfg = cfg; }
}

if (bestR && bestR.trades > 0) {
  console.log(`\n  Best: ${bestCfg.label}`);
  console.log(`  ${bestR.trades} trades | WR ${bestR.winRate.toFixed(0)}% | $${bestR.totalPnlUsdt.toFixed(0)} | maxCL ${bestR.maxConsecLoss} | exp/trade $${bestR.expectancy.toFixed(1)}`);
  console.log(`  Avg win: $${bestR.avgWin.toFixed(0)} | Avg loss: $${bestR.avgLoss.toFixed(0)} | RR: ${bestR.avgLoss !== 0 ? Math.abs(bestR.avgWin/bestR.avgLoss).toFixed(2) : "∞"}`);

  console.log("\n  Monthly:");
  printMonthly(bestR);

  console.log("\n  Trade log:");
  console.log(`  ${"Date".padEnd(12)} ${"DOW".padEnd(4)} ${"H".padStart(3)} ${"Zone".padStart(10)} ${"Tch".padStart(4)} ${"Entry".padStart(10)} ${"TP".padStart(10)} ${"SL".padStart(10)} ${"Reason".padStart(7)} ${"PnL%".padStart(7)} ${"PnL$".padStart(7)} ${"mfe8h".padStart(7)} ${"mae8h".padStart(7)}`);
  console.log("  " + "─".repeat(110));
  for (const t of bestR.tradeLog) {
    const pnlp = (t.pnlPct >= 0 ? "+" : "") + t.pnlPct.toFixed(1) + "%";
    const pnlu = (t.pnlUsdt >= 0 ? "+" : "") + "$" + t.pnlUsdt.toFixed(0);
    const mfe  = "+" + t.mfe8hPct.toFixed(1) + "%";
    const mae  = t.mae8hPct.toFixed(1) + "%";
    console.log(`  ${t.date.padEnd(12)} ${t.dow.padEnd(4)} ${String(t.hour).padStart(3)}h ${"$"+t.zoneMid.toFixed(2).padStart(9)} ${String(t.zoneTouches).padStart(4)} ${"$"+t.entryPrice.toFixed(2).padStart(9)} ${"$"+t.tpPrice.toFixed(2).padStart(9)} ${"$"+t.slPrice.toFixed(2).padStart(9)} ${t.reason.padStart(7)} ${pnlp.padStart(7)} ${pnlu.padStart(7)} ${mfe.padStart(7)} ${mae.padStart(7)}`);
  }

  // Ex Oct-10 reality check
  const exOct10 = bestR.tradeLog.filter(t => t.date !== "2025-10-10");
  if (exOct10.length > 0 && exOct10.length < bestR.tradeLog.length) {
    const exTotal = exOct10.reduce((s, t) => s + t.pnlUsdt, 0);
    const exWins  = exOct10.filter(t => t.pnlUsdt > 0).length;
    const exWR    = (exWins / exOct10.length * 100).toFixed(0);
    console.log(`\n  Reality check (ex Oct-10 cluster): ${exOct10.length} trades | WR ${exWR}% | $${exTotal.toFixed(0)}`);
  }
}
