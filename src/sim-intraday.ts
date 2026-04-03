import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Intraday range fade sim
//
// Concept (from analysis):
//   - 59% of HYPE days are reverting (price moves away from open then comes back)
//   - Price drifts up from open 00:00–11:00 UTC (Asian/EU hours, low volume)
//   - Mean reversion is front-loaded: 55% of days cross back through open within 1h
//   - US session (13:00–16:00 UTC) is high-volume and directional — avoid holding through it
//
// Strategy:
//   Entry:  price drops X% from daily open during entry window (Asian hours)
//   Target: return to daily open (or partial: Y% recovery)
//   Stop:   price drops Z% more from entry
//   Expiry: force-close at latest by expiry hour (before US open)
//
// Sweep:
//   - Entry drop: 0.5%, 1.0%, 1.5%, 2.0%, 3.0%
//   - TP target: return to open (0%), or +0.3%, +0.5% above open
//   - Stop: 1%, 2%, 3% below entry
//   - Entry window: 00:00–06:00 UTC, 00:00–08:00 UTC
//   - Expiry: 11:00, 12:00, 13:00 UTC (before US open)
//   - Max 1 trade per day
// ─────────────────────────────────────────────

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

// ── Build daily structure ──
interface DayData {
  date: string;
  open: number;                  // first candle open
  openTs: number;
  candles: Candle[];
}

const dayMap = new Map<string, Candle[]>();
for (const c of candles) {
  const date = new Date(c.timestamp).toISOString().slice(0, 10);
  if (!dayMap.has(date)) dayMap.set(date, []);
  dayMap.get(date)!.push(c);
}

const days: DayData[] = [];
for (const [date, cs] of dayMap) {
  if (cs.length < 48) continue; // need at least 4h of candles
  cs.sort((a, b) => a.timestamp - b.timestamp);
  days.push({ date, open: cs[0].open, openTs: cs[0].timestamp, candles: cs });
}
days.sort((a, b) => a.date.localeCompare(b.date));

// ── Config ──
interface Cfg {
  label: string;
  entryDropPct: number;      // enter when price drops this % below daily open
  tpAboveOpenPct: number;    // TP when price recovers to open + this % (0 = exactly at open)
  stopPct: number;           // stop loss % below entry price
  entryWindowEndH: number;   // latest UTC hour to enter (e.g. 8 = no entries after 08:00)
  expiryH: number;           // force close at this UTC hour if still open
  capitalPerTrade: number;   // USDT per trade (fixed sizing)
  fee: number;               // taker fee per side
  // Day-of-week filter
  // blockDow: UTC days to skip entirely (0=Sun,1=Mon,...,6=Sat)
  // blockAfterHourOnPrevDay: if set, also block entries after this hour on the day before a blocked day
  //   e.g. blockDow=[4] (Thu) + blockAfterHourOnPrevDay=21 = no trades Wed after 21:00 UTC
  blockDow?: number[];
  blockAfterHourOnPrevDay?: number;
}

interface TradeResult {
  date: string;
  entryPrice: number;
  exitPrice: number;
  exitReason: "TP" | "STOP" | "EXPIRY";
  pnlPct: number;            // % of entry
  pnlUsdt: number;
  entryHour: number;
  exitHour: number;
  holdBars: number;
}

interface SimResult {
  trades: TradeResult[];
  wins: number; losses: number; expiries: number;
  totalPnlUsdt: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  avgHoldBars: number;
  maxConsecLoss: number;
  // monthly
  monthly: Map<string, { pnl: number; trades: number; wins: number }>;
}

function runSim(cfg: Cfg, daySubset: DayData[]): SimResult {
  const trades: TradeResult[] = [];
  const monthly = new Map<string, { pnl: number; trades: number; wins: number }>();

  for (const day of daySubset) {
    // Day-of-week filter
    const dayUtc = new Date(day.date + "T12:00:00Z");
    const dow = dayUtc.getUTCDay(); // 0=Sun, 4=Thu
    if (cfg.blockDow && cfg.blockDow.includes(dow)) continue;

    const dayOpen = day.open;
    const entryThreshold = dayOpen * (1 - cfg.entryDropPct / 100);
    const tpPrice = dayOpen * (1 + cfg.tpAboveOpenPct / 100);
    const entryWindowEndTs = new Date(day.date + "T00:00:00Z").getTime() + cfg.entryWindowEndH * 3600000;
    const expiryTs = new Date(day.date + "T00:00:00Z").getTime() + cfg.expiryH * 3600000;

    let inTrade = false;
    let entryPrice = 0;
    let stopPrice = 0;
    let entryTs = 0;
    let entryBar = 0;
    let traded = false;

    for (let i = 0; i < day.candles.length; i++) {
      const c = day.candles[i];

      if (!inTrade) {
        if (traded) continue; // one trade per day
        if (c.timestamp >= entryWindowEndTs) continue; // past entry window
        // Pre-day hour cutoff: block entries after X:00 UTC on the day before a blocked day
        if (cfg.blockDow && cfg.blockAfterHourOnPrevDay !== undefined) {
          const nextDow = (dow + 1) % 7;
          if (cfg.blockDow.includes(nextDow)) {
            const cutoffTs = new Date(day.date + "T00:00:00Z").getTime() + cfg.blockAfterHourOnPrevDay * 3600000;
            if (c.timestamp >= cutoffTs) continue;
          }
        }
        // Entry: low touches or crosses below threshold
        if (c.low <= entryThreshold) {
          entryPrice = entryThreshold; // assume fill at threshold
          stopPrice = entryPrice * (1 - cfg.stopPct / 100);
          inTrade = true;
          entryTs = c.timestamp;
          entryBar = i;
          traded = true;
        }
      } else {
        // Check exit conditions (use high/low for TP/stop, close for expiry)
        const month = day.date.slice(0, 7);
        if (!monthly.has(month)) monthly.set(month, { pnl: 0, trades: 0, wins: 0 });
        const m = monthly.get(month)!;

        let exitPrice = 0;
        let exitReason: TradeResult["exitReason"] | null = null;

        // TP: high touches or exceeds tpPrice
        if (c.high >= tpPrice) {
          exitPrice = tpPrice;
          exitReason = "TP";
        }
        // Stop: low touches or goes below stopPrice
        else if (c.low <= stopPrice) {
          exitPrice = stopPrice;
          exitReason = "STOP";
        }
        // Expiry: force close at expiry hour
        else if (c.timestamp >= expiryTs) {
          exitPrice = c.open; // assume close at open of expiry candle
          exitReason = "EXPIRY";
        }

        if (exitReason) {
          const pnlPct = (exitPrice - entryPrice) / entryPrice * 100;
          const pnlUsdt = cfg.capitalPerTrade * (pnlPct / 100) - cfg.capitalPerTrade * cfg.fee * 2;
          const entryHour = new Date(entryTs).getUTCHours();
          const exitHour = new Date(c.timestamp).getUTCHours();
          trades.push({
            date: day.date,
            entryPrice,
            exitPrice,
            exitReason,
            pnlPct,
            pnlUsdt,
            entryHour,
            exitHour,
            holdBars: i - entryBar,
          });
          m.pnl += pnlUsdt;
          m.trades++;
          if (pnlUsdt > 0) m.wins++;
          inTrade = false;
        }
      }
    }

    // Still in trade at end of day — force close at last candle
    if (inTrade) {
      const lastC = day.candles[day.candles.length - 1];
      const pnlPct = (lastC.close - entryPrice) / entryPrice * 100;
      const pnlUsdt = cfg.capitalPerTrade * (pnlPct / 100) - cfg.capitalPerTrade * cfg.fee * 2;
      const month = day.date.slice(0, 7);
      if (!monthly.has(month)) monthly.set(month, { pnl: 0, trades: 0, wins: 0 });
      const m = monthly.get(month)!;
      trades.push({
        date: day.date, entryPrice, exitPrice: lastC.close, exitReason: "EXPIRY",
        pnlPct, pnlUsdt, entryHour: new Date(entryTs).getUTCHours(),
        exitHour: new Date(lastC.timestamp).getUTCHours(), holdBars: day.candles.length - entryBar,
      });
      m.pnl += pnlUsdt; m.trades++; if (pnlUsdt > 0) m.wins++;
    }
  }

  const wins = trades.filter(t => t.pnlUsdt > 0).length;
  const losses = trades.filter(t => t.pnlUsdt <= 0 && t.exitReason === "STOP").length;
  const expiries = trades.filter(t => t.exitReason === "EXPIRY").length;
  const totalPnlUsdt = trades.reduce((a, t) => a + t.pnlUsdt, 0);
  const winTrades = trades.filter(t => t.pnlUsdt > 0);
  const lossTrades = trades.filter(t => t.pnlUsdt < 0);

  // Max consecutive losses
  let maxConsec = 0, curConsec = 0;
  for (const t of trades) {
    if (t.pnlUsdt <= 0) { curConsec++; maxConsec = Math.max(maxConsec, curConsec); } else curConsec = 0;
  }

  return {
    trades, wins, losses, expiries, totalPnlUsdt,
    winRate: trades.length > 0 ? wins / trades.length * 100 : 0,
    avgWinPct: winTrades.length > 0 ? winTrades.reduce((a, t) => a + t.pnlPct, 0) / winTrades.length : 0,
    avgLossPct: lossTrades.length > 0 ? lossTrades.reduce((a, t) => a + t.pnlPct, 0) / lossTrades.length : 0,
    avgHoldBars: trades.length > 0 ? trades.reduce((a, t) => a + t.holdBars, 0) / trades.length : 0,
    maxConsecLoss: maxConsec,
    monthly,
  };
}

// ── Output helpers ──
function pct(n: number, d = 1) { return (n >= 0 ? "+" : "") + n.toFixed(d) + "%"; }
function summaryRow(cfg: Cfg, r: SimResult) {
  const n = r.trades.length;
  return `  ${cfg.label.padEnd(44)} ${String(n).padStart(4)} ${(r.winRate.toFixed(0)+"%").padStart(6)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(9)} ${pct(r.avgWinPct,2).padStart(8)} ${pct(r.avgLossPct,2).padStart(8)} ${r.maxConsecLoss.toString().padStart(6)} ${r.expiries.toString().padStart(7)}`;
}
const sumHdr = `  ${"Config".padEnd(44)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"AvgWin".padStart(8)} ${"AvgLoss".padStart(8)} ${"MaxCL".padStart(6)} ${"Expiry".padStart(7)}`;
const div = "  " + "-".repeat(100);
const SEP = "=".repeat(104);

// ── Post-launch period only (Jan 2025 onward) ──
const postLaunch = days.filter(d => d.date >= "2025-01-01");
console.log(`\nPost-launch days: ${postLaunch.length} (${postLaunch[0]?.date} → ${postLaunch[postLaunch.length-1]?.date})`);

// ══════════════════════════════════════════════
//   SECTION 1 — Entry drop sweep
//   Fixed: stop=2%, tp=at open, window=08h, expiry=12h
// ══════════════════════════════════════════════
console.log("\n" + SEP);
console.log("  INTRADAY RANGE FADE — Entry drop sweep");
console.log("  Fixed: stop=2%, TP=at daily open, entry window 00:00–08:00 UTC, expiry 12:00 UTC");
console.log("  Sizing: $1000/trade, 0.055% fee/side");
console.log(SEP);
console.log(sumHdr); console.log(div);

for (const drop of [0.5, 1.0, 1.5, 2.0, 3.0]) {
  const cfg: Cfg = {
    label: `entry drop ${drop}% | stop 2% | tp @open | exp 12h`,
    entryDropPct: drop, tpAboveOpenPct: 0, stopPct: 2.0,
    entryWindowEndH: 8, expiryH: 12,
    capitalPerTrade: 1000, fee: 0.00055,
  };
  console.log(summaryRow(cfg, runSim(cfg, postLaunch)));
}

// ══════════════════════════════════════════════
//   SECTION 2 — TP level sweep
//   Fixed: drop=1.0%, stop=2%, window=08h
// ══════════════════════════════════════════════
console.log("\n" + SEP);
console.log("  INTRADAY RANGE FADE — TP level sweep");
console.log("  Fixed: entry drop=1.0%, stop=2%, entry window 00:00–08:00 UTC");
console.log(SEP);
console.log(sumHdr); console.log(div);

for (const expH of [11, 12, 13]) {
  for (const tpAbove of [0, 0.3, 0.5, 1.0]) {
    const cfg: Cfg = {
      label: `tp open+${tpAbove}% | exp ${expH}h`,
      entryDropPct: 1.0, tpAboveOpenPct: tpAbove, stopPct: 2.0,
      entryWindowEndH: 8, expiryH: expH,
      capitalPerTrade: 1000, fee: 0.00055,
    };
    console.log(summaryRow(cfg, runSim(cfg, postLaunch)));
  }
}

// ══════════════════════════════════════════════
//   SECTION 3 — Stop width sweep
//   Fixed: drop=1.0%, tp=at open, window=08h, exp=12h
// ══════════════════════════════════════════════
console.log("\n" + SEP);
console.log("  INTRADAY RANGE FADE — Stop width sweep");
console.log("  Fixed: entry drop=1.0%, TP=at open, entry window 00:00–08:00 UTC, expiry 12h");
console.log(SEP);
console.log(sumHdr); console.log(div);

for (const stop of [0.5, 1.0, 1.5, 2.0, 3.0, 5.0]) {
  const cfg: Cfg = {
    label: `stop ${stop}%`,
    entryDropPct: 1.0, tpAboveOpenPct: 0, stopPct: stop,
    entryWindowEndH: 8, expiryH: 12,
    capitalPerTrade: 1000, fee: 0.00055,
  };
  console.log(summaryRow(cfg, runSim(cfg, postLaunch)));
}

// ══════════════════════════════════════════════
//   SECTION 4 — Entry window sweep
// ══════════════════════════════════════════════
console.log("\n" + SEP);
console.log("  INTRADAY RANGE FADE — Entry window sweep");
console.log("  Fixed: entry drop=1.0%, stop=2%, TP=at open, expiry=12h");
console.log(SEP);
console.log(sumHdr); console.log(div);

for (const windowH of [2, 4, 6, 8, 10]) {
  const cfg: Cfg = {
    label: `entry window 00:00–${String(windowH).padStart(2,"0")}:00 UTC`,
    entryDropPct: 1.0, tpAboveOpenPct: 0, stopPct: 2.0,
    entryWindowEndH: windowH, expiryH: 12,
    capitalPerTrade: 1000, fee: 0.00055,
  };
  console.log(summaryRow(cfg, runSim(cfg, postLaunch)));
}

// ══════════════════════════════════════════════
//   SECTION 5 — Best config monthly breakdown
// ══════════════════════════════════════════════
// Run a few candidate configs and show monthly P&L
const candidates: Cfg[] = [
  { label: "drop1% stop2% tp@open exp12h win08h", entryDropPct: 1.0, tpAboveOpenPct: 0.0, stopPct: 2.0, entryWindowEndH: 8, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "drop1% stop2% tp+0.5% exp12h win08h", entryDropPct: 1.0, tpAboveOpenPct: 0.5, stopPct: 2.0, entryWindowEndH: 8, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "drop1.5% stop2% tp@open exp12h win08h", entryDropPct: 1.5, tpAboveOpenPct: 0.0, stopPct: 2.0, entryWindowEndH: 8, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "drop1% stop1% tp@open exp12h win08h", entryDropPct: 1.0, tpAboveOpenPct: 0.0, stopPct: 1.0, entryWindowEndH: 8, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
];

console.log("\n" + SEP);
console.log("  MONTHLY BREAKDOWN — candidate configs (post-launch Jan 2025 → now)");
console.log(SEP);

for (const cfg of candidates) {
  const r = runSim(cfg, postLaunch);
  console.log(`\n  ── ${cfg.label} | ${r.trades.length} trades | WR ${r.winRate.toFixed(0)}% | Total $${r.totalPnlUsdt.toFixed(0)} ──`);
  console.log(`  ${"Month".padEnd(8)} ${"Trades".padStart(7)} ${"Wins".padStart(5)} ${"WR".padStart(5)} ${"PnL($)".padStart(9)}`);
  console.log("  " + "-".repeat(38));
  for (const [month, ms] of r.monthly) {
    const wr = ms.trades > 0 ? (ms.wins / ms.trades * 100).toFixed(0) + "%" : "n/a";
    const pnlStr = (ms.pnl >= 0 ? "+" : "") + "$" + ms.pnl.toFixed(0);
    console.log(`  ${month.padEnd(8)} ${String(ms.trades).padStart(7)} ${String(ms.wins).padStart(5)} ${wr.padStart(5)} ${pnlStr.padStart(9)}`);
  }
  console.log(`  ${"TOTAL".padEnd(8)} ${String(r.trades.length).padStart(7)} ${String(r.wins).padStart(5)} ${(r.winRate.toFixed(0)+"%").padStart(5)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(9)}`);
}

// ══════════════════════════════════════════════
//   SECTION 6 — Day-of-week filter sweep
//   Best base: drop1%, stop2%, tp+0.5%, exp12h, win08h
//   Thu is worst day (39% up, -1.1% avg) — test skipping it
//   Also test blocking Wed post-21:00 UTC (eve of Thu)
// ══════════════════════════════════════════════
console.log("\n" + SEP);
console.log("  DAY-OF-WEEK FILTER — skip bad days (drop1% stop2% tp+0.5% exp12h win08h)");
console.log("  Sun=0 Mon=1 Tue=2 Wed=3 Thu=4 Fri=5 Sat=6");
console.log(SEP);
console.log(sumHdr); console.log(div);

const baseDow: Omit<Cfg, "label"> = {
  entryDropPct: 1.0, tpAboveOpenPct: 0.5, stopPct: 2.0,
  entryWindowEndH: 8, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055,
};

const dowCfgs: Cfg[] = [
  { ...baseDow, label: "no filter (baseline)" },
  { ...baseDow, label: "skip Thu", blockDow: [4] },
  { ...baseDow, label: "skip Thu + no Wed after 21:00 UTC", blockDow: [4], blockAfterHourOnPrevDay: 21 },
  { ...baseDow, label: "skip Thu + no Wed after 18:00 UTC", blockDow: [4], blockAfterHourOnPrevDay: 18 },
  { ...baseDow, label: "skip Thu + Tue", blockDow: [4, 2] },
  { ...baseDow, label: "skip Thu + Sun", blockDow: [4, 0] },
  { ...baseDow, label: "Mon+Wed+Fri+Sat only", blockDow: [0, 2, 4] },
  { ...baseDow, label: "Wed+Thu+Fri only", blockDow: [0, 1, 2, 6] },
];

for (const cfg of dowCfgs) {
  console.log(summaryRow(cfg, runSim(cfg, postLaunch)));
}

// ══════════════════════════════════════════════
//   SECTION 7 — Wednesday evening short
//   Concept: Thu is worst day (-1.1% avg, 39% up)
//   Fade the Wed high after 18:00 UTC into Thu
//   Entry: price within X% of rolling daily high after 18:00 UTC on Wednesday
//   TP: Y% below entry
//   Stop: Z% above entry
//   Expiry: force close at Thu 12:00 UTC
// ══════════════════════════════════════════════

interface WedShortCfg {
  label: string;
  entryAfterH: number;          // UTC hour — only look for entry after this (18)
  nearHighPct: number;          // within X% of daily high to qualify
  tpPct: number;                // TP % below entry
  stopPct: number;              // stop % above entry
  expiryH: number;              // Thu UTC hour to force-close (e.g. 12)
  capitalPerTrade: number;
  fee: number;
}

interface WedShortResult {
  trades: number; wins: number; losses: number; expiries: number;
  totalPnlUsdt: number; winRate: number;
  avgWinPct: number; avgLossPct: number;
  maxConsecLoss: number;
  monthly: Map<string, { pnl: number; trades: number; wins: number }>;
}

function runWedShortSim(cfg: WedShortCfg, allDays: DayData[]): WedShortResult {
  // Build Wed→Thu day pairs
  const wedDays = allDays.filter(d => {
    const dow = new Date(d.date + "T12:00:00Z").getUTCDay();
    return dow === 3; // Wednesday
  });

  const dayByDate = new Map(allDays.map(d => [d.date, d]));

  let trades = 0, wins = 0, losses = 0, expiries = 0, totalPnlUsdt = 0;
  let maxConsecLoss = 0, curConsec = 0;
  const monthly = new Map<string, { pnl: number; trades: number; wins: number }>();
  const allResults: number[] = [];

  for (const wed of wedDays) {
    // Get Thursday
    const thuDate = new Date(wed.date + "T12:00:00Z");
    thuDate.setUTCDate(thuDate.getUTCDate() + 1);
    const thuDateStr = thuDate.toISOString().slice(0, 10);
    const thu = dayByDate.get(thuDateStr);
    if (!thu) continue;

    // Entry window: Wed candles after entryAfterH UTC
    const entryWindowStart = new Date(wed.date + "T00:00:00Z").getTime() + cfg.entryAfterH * 3600000;
    const wedWindowCandles = wed.candles.filter(c => c.timestamp >= entryWindowStart);
    if (wedWindowCandles.length === 0) continue;

    // Rolling daily high up to each candle
    let rollingHigh = 0;
    for (const c of wed.candles) {
      if (c.high > rollingHigh) rollingHigh = c.high;
      if (c.timestamp < entryWindowStart) continue;

      // Entry condition: close is within nearHighPct% of rolling daily high
      const distFromHigh = (rollingHigh - c.close) / rollingHigh * 100;
      if (distFromHigh <= cfg.nearHighPct) {
        // Enter short at close of this candle
        const entryPrice = c.close;
        const tpPrice = entryPrice * (1 - cfg.tpPct / 100);
        const stopPrice = entryPrice * (1 + cfg.stopPct / 100);
        const expiryTs = new Date(thu.date + "T00:00:00Z").getTime() + cfg.expiryH * 3600000;

        // Scan remaining Wed candles + Thu candles for exit
        const remainingWed = wed.candles.filter(x => x.timestamp > c.timestamp);
        const thuCandles = thu.candles.filter(x => x.timestamp <= expiryTs);
        const scanCandles = [...remainingWed, ...thuCandles];

        let exitPrice = 0;
        let exitReason: "TP" | "STOP" | "EXPIRY" = "EXPIRY";

        for (const sc of scanCandles) {
          if (sc.low <= tpPrice) { exitPrice = tpPrice; exitReason = "TP"; break; }
          if (sc.high >= stopPrice) { exitPrice = stopPrice; exitReason = "STOP"; break; }
          if (sc.timestamp >= expiryTs) { exitPrice = sc.open; exitReason = "EXPIRY"; break; }
        }
        if (exitPrice === 0) {
          // Expiry at end of scan
          const last = scanCandles[scanCandles.length - 1];
          exitPrice = last ? last.close : entryPrice;
          exitReason = "EXPIRY";
        }

        const pnlPct = (entryPrice - exitPrice) / entryPrice * 100; // short: profit when price falls
        const pnlUsdt = cfg.capitalPerTrade * (pnlPct / 100) - cfg.capitalPerTrade * cfg.fee * 2;

        trades++;
        totalPnlUsdt += pnlUsdt;
        allResults.push(pnlUsdt);
        if (exitReason === "TP") wins++;
        else if (exitReason === "STOP") losses++;
        else expiries++;

        if (pnlUsdt <= 0) { curConsec++; maxConsecLoss = Math.max(maxConsecLoss, curConsec); } else curConsec = 0;

        const month = wed.date.slice(0, 7);
        if (!monthly.has(month)) monthly.set(month, { pnl: 0, trades: 0, wins: 0 });
        const m = monthly.get(month)!;
        m.pnl += pnlUsdt; m.trades++; if (pnlUsdt > 0) m.wins++;

        break; // one trade per Wednesday
      }
    }
  }

  const winTrades = allResults.filter(p => p > 0);
  const lossTrades = allResults.filter(p => p <= 0);

  return {
    trades, wins, losses, expiries, totalPnlUsdt,
    winRate: trades > 0 ? wins / trades * 100 : 0,
    avgWinPct: winTrades.length > 0 ? winTrades.reduce((a,b) => a+b, 0) / winTrades.length / cfg.capitalPerTrade * 100 : 0,
    avgLossPct: lossTrades.length > 0 ? lossTrades.reduce((a,b) => a+b, 0) / lossTrades.length / cfg.capitalPerTrade * 100 : 0,
    maxConsecLoss, monthly,
  };
}

function wedRow(cfg: WedShortCfg, r: WedShortResult) {
  return `  ${cfg.label.padEnd(48)} ${String(r.trades).padStart(4)} ${(r.winRate.toFixed(0)+"%").padStart(6)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(9)} ${pct(r.avgWinPct,2).padStart(8)} ${pct(r.avgLossPct,2).padStart(8)} ${r.maxConsecLoss.toString().padStart(6)} ${r.expiries.toString().padStart(7)}`;
}
const wedHdr = `  ${"Config".padEnd(48)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"AvgWin".padStart(8)} ${"AvgLoss".padStart(8)} ${"MaxCL".padStart(6)} ${"Expiry".padStart(7)}`;

console.log("\n" + SEP);
console.log("  WEDNESDAY EVENING SHORT → THURSDAY");
console.log("  Entry: Wed after 18:00 UTC, price within X% of daily high");
console.log("  Exit: TP/stop hit OR Thu 12:00 UTC expiry");
console.log("  Sizing: $1000/trade, 0.055% fee/side");
console.log(SEP);
console.log(wedHdr); console.log(div);

// Sweep: nearHigh%, TP%, stop%
for (const nearHigh of [0.5, 1.0, 1.5]) {
  for (const tp of [1.0, 2.0, 3.0]) {
    for (const stop of [1.0, 2.0]) {
      const cfg: WedShortCfg = {
        label: `near high ${nearHigh}% | TP ${tp}% | stop ${stop}%`,
        entryAfterH: 18, nearHighPct: nearHigh,
        tpPct: tp, stopPct: stop,
        expiryH: 12, capitalPerTrade: 1000, fee: 0.00055,
      };
      console.log(wedRow(cfg, runWedShortSim(cfg, postLaunch)));
    }
  }
  console.log(div);
}

// Monthly breakdown for best-looking candidate
console.log("\n  ── Wed short monthly breakdown: near high 1% | TP 2% | stop 2% | exp Thu 12h ──");
const wedBest = runWedShortSim({ label: "", entryAfterH: 18, nearHighPct: 1.0, tpPct: 2.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 }, postLaunch);
console.log(`  ${"Month".padEnd(8)} ${"Trades".padStart(7)} ${"Wins".padStart(5)} ${"WR".padStart(5)} ${"PnL($)".padStart(9)}`);
console.log("  " + "-".repeat(38));
for (const [month, ms] of wedBest.monthly) {
  const wr = ms.trades > 0 ? (ms.wins / ms.trades * 100).toFixed(0) + "%" : "n/a";
  const pnlStr = (ms.pnl >= 0 ? "+" : "") + "$" + ms.pnl.toFixed(0);
  console.log(`  ${month.padEnd(8)} ${String(ms.trades).padStart(7)} ${String(ms.wins).padStart(5)} ${wr.padStart(5)} ${pnlStr.padStart(9)}`);
}
console.log(`  ${"TOTAL".padEnd(8)} ${String(wedBest.trades).padStart(7)} ${String(wedBest.wins).padStart(5)} ${(wedBest.winRate.toFixed(0)+"%").padStart(5)} ${("$"+wedBest.totalPnlUsdt.toFixed(0)).padStart(9)}`);

// ══════════════════════════════════════════════
//   SECTION 8 — Wed short: first print above Tuesday high
//   Concept: enter short the moment Wednesday breaks above Tue high
//   No time gate — fires any time Wednesday, one trade only
//   Exit: TP 1% or 2% below entry, stop 2%, expiry Thu 12:00 UTC
// ══════════════════════════════════════════════

interface TueBreakCfg {
  label: string;
  tpPct: number;
  stopPct: number;
  expiryH: number;   // Thu UTC hour to force-close
  capitalPerTrade: number;
  fee: number;
}

interface TueBreakResult {
  trades: number; wins: number; losses: number; expiries: number;
  totalPnlUsdt: number; winRate: number;
  avgWinPct: number; avgLossPct: number;
  maxConsecLoss: number;
  monthly: Map<string, { pnl: number; trades: number; wins: number }>;
  noFireDays: number; // Wednesdays where price never broke Tue high
}

function runTueBreakSim(cfg: TueBreakCfg, allDays: DayData[]): TueBreakResult {
  const dayByDate = new Map(allDays.map(d => [d.date, d]));

  // Get all Tuesday→Wednesday pairs
  const tueDays = allDays.filter(d => new Date(d.date + "T12:00:00Z").getUTCDay() === 2);

  let trades = 0, wins = 0, losses = 0, expiries = 0, totalPnlUsdt = 0;
  let maxConsecLoss = 0, curConsec = 0, noFireDays = 0;
  const monthly = new Map<string, { pnl: number; trades: number; wins: number }>();
  const allPnls: number[] = [];

  for (const tue of tueDays) {
    // Tuesday high
    const tueHigh = Math.max(...tue.candles.map(c => c.high));

    // Get Wednesday
    const wedDate = new Date(tue.date + "T12:00:00Z");
    wedDate.setUTCDate(wedDate.getUTCDate() + 1);
    const wedDateStr = wedDate.toISOString().slice(0, 10);
    const wed = dayByDate.get(wedDateStr);
    if (!wed) continue;

    // Get Thursday for expiry
    const thuDate = new Date(wedDate);
    thuDate.setUTCDate(thuDate.getUTCDate() + 1);
    const thu = dayByDate.get(thuDate.toISOString().slice(0, 10));

    const expiryTs = thu
      ? new Date(thu.date + "T00:00:00Z").getTime() + cfg.expiryH * 3600000
      : new Date(wed.date + "T00:00:00Z").getTime() + 23 * 3600000;

    // Scan Wednesday candles for first print above Tue high
    let fired = false;
    for (const c of wed.candles) {
      if (c.high > tueHigh) {
        // Enter short at tueHigh (the breakout level — assume fill at that price)
        const entryPrice = tueHigh;
        const tpPrice = entryPrice * (1 - cfg.tpPct / 100);
        const stopPrice = entryPrice * (1 + cfg.stopPct / 100);

        // Scan remaining Wed + Thu for exit
        const remaining = wed.candles.filter(x => x.timestamp >= c.timestamp);
        const thuCandles = thu ? thu.candles.filter(x => x.timestamp <= expiryTs) : [];
        const scanCandles = [...remaining, ...thuCandles];

        let exitPrice = 0, exitReason: "TP" | "STOP" | "EXPIRY" = "EXPIRY";
        for (const sc of scanCandles) {
          if (sc.low <= tpPrice) { exitPrice = tpPrice; exitReason = "TP"; break; }
          if (sc.high >= stopPrice) { exitPrice = stopPrice; exitReason = "STOP"; break; }
          if (sc.timestamp >= expiryTs) { exitPrice = sc.open; exitReason = "EXPIRY"; break; }
        }
        if (exitPrice === 0) {
          const last = scanCandles[scanCandles.length - 1];
          exitPrice = last ? last.close : entryPrice;
        }

        const pnlPct = (entryPrice - exitPrice) / entryPrice * 100;
        const pnlUsdt = cfg.capitalPerTrade * (pnlPct / 100) - cfg.capitalPerTrade * cfg.fee * 2;

        trades++;
        totalPnlUsdt += pnlUsdt;
        allPnls.push(pnlUsdt);
        if (exitReason === "TP") wins++;
        else if (exitReason === "STOP") losses++;
        else expiries++;

        if (pnlUsdt <= 0) { curConsec++; maxConsecLoss = Math.max(maxConsecLoss, curConsec); } else curConsec = 0;

        const month = wed.date.slice(0, 7);
        if (!monthly.has(month)) monthly.set(month, { pnl: 0, trades: 0, wins: 0 });
        const m = monthly.get(month)!;
        m.pnl += pnlUsdt; m.trades++; if (pnlUsdt > 0) m.wins++;

        fired = true;
        break;
      }
    }
    if (!fired) noFireDays++;
  }

  const winPnls = allPnls.filter(p => p > 0);
  const lossPnls = allPnls.filter(p => p <= 0);

  return {
    trades, wins, losses, expiries, totalPnlUsdt,
    winRate: trades > 0 ? wins / trades * 100 : 0,
    avgWinPct: winPnls.length > 0 ? winPnls.reduce((a,b)=>a+b,0)/winPnls.length/cfg.capitalPerTrade*100 : 0,
    avgLossPct: lossPnls.length > 0 ? lossPnls.reduce((a,b)=>a+b,0)/lossPnls.length/cfg.capitalPerTrade*100 : 0,
    maxConsecLoss, monthly, noFireDays,
  };
}

function tueRow(cfg: TueBreakCfg, r: TueBreakResult) {
  const noFire = `(${r.noFireDays} no-fire)`;
  return `  ${cfg.label.padEnd(36)} ${String(r.trades).padStart(4)} ${(r.winRate.toFixed(0)+"%").padStart(6)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(9)} ${pct(r.avgWinPct,2).padStart(8)} ${pct(r.avgLossPct,2).padStart(8)} ${r.maxConsecLoss.toString().padStart(6)} ${r.expiries.toString().padStart(7)}  ${noFire}`;
}
const tueHdr = `  ${"Config".padEnd(36)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(9)} ${"AvgWin".padStart(8)} ${"AvgLoss".padStart(8)} ${"MaxCL".padStart(6)} ${"Expiry".padStart(7)}`;

console.log("\n" + SEP);
console.log("  WED SHORT — first print above Tuesday high (no time gate)");
console.log("  Entry: short at Tue high the moment Wed price breaks above it");
console.log("  Exit: TP% below entry | stop 2% above | Thu 12:00 UTC expiry");
console.log(SEP);
console.log(tueHdr); console.log(div);

for (const tp of [1.0, 2.0, 3.0]) {
  for (const stop of [1.0, 2.0, 3.0]) {
    const cfg: TueBreakCfg = {
      label: `TP ${tp}% | stop ${stop}% | exp Thu 12h`,
      tpPct: tp, stopPct: stop, expiryH: 12,
      capitalPerTrade: 1000, fee: 0.00055,
    };
    console.log(tueRow(cfg, runTueBreakSim(cfg, postLaunch)));
  }
}

// Monthly breakdown for two candidates
for (const [tp, stop] of [[1.0, 2.0], [2.0, 2.0]]) {
  const r = runTueBreakSim({ label: "", tpPct: tp, stopPct: stop, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 }, postLaunch);
  console.log(`\n  ── Tue-break short monthly: TP ${tp}% stop ${stop}% | ${r.trades} trades | WR ${r.winRate.toFixed(0)}% | $${r.totalPnlUsdt.toFixed(0)} ──`);
  console.log(`  ${"Month".padEnd(8)} ${"Trades".padStart(7)} ${"Wins".padStart(5)} ${"WR".padStart(5)} ${"PnL($)".padStart(9)}`);
  console.log("  " + "-".repeat(38));
  for (const [month, ms] of r.monthly) {
    const wr = ms.trades > 0 ? (ms.wins/ms.trades*100).toFixed(0)+"%" : "n/a";
    console.log(`  ${month.padEnd(8)} ${String(ms.trades).padStart(7)} ${String(ms.wins).padStart(5)} ${wr.padStart(5)} ${((ms.pnl>=0?"+":"")+"$"+ms.pnl.toFixed(0)).padStart(9)}`);
  }
  console.log(`  ${"TOTAL".padEnd(8)} ${String(r.trades).padStart(7)} ${String(r.wins).padStart(5)} ${(r.winRate.toFixed(0)+"%").padStart(5)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(9)}`);
}

// ══════════════════════════════════════════════
//   SECTION 9 — Combined monthly P&L
//   Daytime fade (best config) + Wed short (best config) + Tue-break short
//   All running simultaneously on $1000/trade
// ══════════════════════════════════════════════
console.log("\n" + SEP);
console.log("  COMBINED MONTHLY P&L — all three strategies, $1000/trade each");
console.log("  Fade: drop1% stop2% tp+0.5% exp12h skip Thu+Sun");
console.log("  Wed short (near-high): near1% TP1% stop2%");
console.log("  Wed short (Tue-break): TP1% stop2% exp Thu12h");
console.log(SEP);

const fadeCfg: Cfg = { label: "", entryDropPct: 1.0, tpAboveOpenPct: 0.5, stopPct: 2.0, entryWindowEndH: 8, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055, blockDow: [0, 4] };
const nearHighCfg: WedShortCfg = { label: "", entryAfterH: 18, nearHighPct: 1.0, tpPct: 1.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 };
const tueBreakCfg: TueBreakCfg = { label: "", tpPct: 1.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 };

const fadeRes = runSim(fadeCfg, postLaunch);
const nearHighRes = runWedShortSim(nearHighCfg, postLaunch);
const tueBreakRes = runTueBreakSim(tueBreakCfg, postLaunch);

// Merge monthly maps
const allMonths = new Set([...fadeRes.monthly.keys(), ...nearHighRes.monthly.keys(), ...tueBreakRes.monthly.keys()]);
const sortedMonths = [...allMonths].sort();

console.log(`\n  ${"Month".padEnd(8)} ${"Fade".padStart(9)} ${"NearHigh".padStart(10)} ${"TueBreak".padStart(10)} ${"Combined".padStart(10)} ${"Cumulative".padStart(12)}`);
console.log("  " + "-".repeat(62));
let cumulative = 0;
for (const month of sortedMonths) {
  const f = fadeRes.monthly.get(month)?.pnl ?? 0;
  const n = nearHighRes.monthly.get(month)?.pnl ?? 0;
  const t = tueBreakRes.monthly.get(month)?.pnl ?? 0;
  const combined = f + n + t;
  cumulative += combined;
  const fmt = (v: number) => (v >= 0 ? "+" : "") + "$" + v.toFixed(0);
  console.log(`  ${month.padEnd(8)} ${fmt(f).padStart(9)} ${fmt(n).padStart(10)} ${fmt(t).padStart(10)} ${fmt(combined).padStart(10)} ${fmt(cumulative).padStart(12)}`);
}
const totalFade = [...fadeRes.monthly.values()].reduce((a,m)=>a+m.pnl,0);
const totalNear = [...nearHighRes.monthly.values()].reduce((a,m)=>a+m.pnl,0);
const totalTue = [...tueBreakRes.monthly.values()].reduce((a,m)=>a+m.pnl,0);
console.log("  " + "-".repeat(62));
console.log(`  ${"TOTAL".padEnd(8)} ${("$"+totalFade.toFixed(0)).padStart(9)} ${("$"+totalNear.toFixed(0)).padStart(10)} ${("$"+totalTue.toFixed(0)).padStart(10)} ${("$"+(totalFade+totalNear+totalTue).toFixed(0)).padStart(10)}`);

// ══════════════════════════════════════════════
//   SECTION 10 — Near-high Wed short deep dive
//   Finer granularity: 0.25–1.5% in 0.25 steps
//   Vary: entry hour (16–22 UTC), TP (1%/2%), stop (1%/2%/3%)
//   Monthly breakdown for top configs
// ══════════════════════════════════════════════
console.log("\n" + SEP);
console.log("  NEAR-HIGH WED SHORT — deep sweep");
console.log("  nearHigh 0.25–1.5% × entryHour 16–22 UTC × TP 1%/2% × stop 1%/2%/3%");
console.log(SEP);
console.log(wedHdr); console.log(div);

const nearHighDeep: { nearHigh: number; entryH: number; tp: number; stop: number }[] = [];
for (const nearHigh of [0.25, 0.5, 0.75, 1.0, 1.25, 1.5]) {
  for (const entryH of [16, 18, 20, 22]) {
    for (const tp of [1.0, 2.0]) {
      for (const stop of [1.0, 2.0, 3.0, 5.0]) {
        nearHighDeep.push({ nearHigh, entryH, tp, stop });
      }
    }
  }
}

// Print with grouping by nearHigh
let lastNearHigh = -1;
for (const p of nearHighDeep) {
  if (p.nearHigh !== lastNearHigh) { console.log(div); lastNearHigh = p.nearHigh; }
  const cfg: WedShortCfg = {
    label: `near ${p.nearHigh}% after ${p.entryH}h | TP ${p.tp}% | stop ${p.stop}%`,
    entryAfterH: p.entryH, nearHighPct: p.nearHigh,
    tpPct: p.tp, stopPct: p.stop,
    expiryH: 12, capitalPerTrade: 1000, fee: 0.00055,
  };
  console.log(wedRow(cfg, runWedShortSim(cfg, postLaunch)));
}

// Monthly breakdown for top candidates to compare
const topNearHighCfgs: WedShortCfg[] = [
  { label: "near 0.5% after 18h | TP 1% | stop 2%", entryAfterH: 18, nearHighPct: 0.5, tpPct: 1.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "near 0.75% after 18h | TP 1% | stop 2%", entryAfterH: 18, nearHighPct: 0.75, tpPct: 1.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "near 1.0% after 18h | TP 1% | stop 2%", entryAfterH: 18, nearHighPct: 1.0, tpPct: 1.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "near 1.0% after 16h | TP 1% | stop 2%", entryAfterH: 16, nearHighPct: 1.0, tpPct: 1.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "near 1.0% after 20h | TP 1% | stop 2%", entryAfterH: 20, nearHighPct: 1.0, tpPct: 1.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "near 1.25% after 18h | TP 1% | stop 2%", entryAfterH: 18, nearHighPct: 1.25, tpPct: 1.0, stopPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
];

console.log("\n" + SEP);
console.log("  NEAR-HIGH WED SHORT — monthly breakdown (top candidates)");
console.log(SEP);

for (const cfg of topNearHighCfgs) {
  const r = runWedShortSim(cfg, postLaunch);
  console.log(`\n  ── ${cfg.label} | ${r.trades} trades | WR ${r.winRate.toFixed(0)}% | $${r.totalPnlUsdt.toFixed(0)} ──`);
  console.log(`  ${"Month".padEnd(8)} ${"Trades".padStart(7)} ${"Wins".padStart(5)} ${"WR".padStart(5)} ${"PnL($)".padStart(9)}`);
  console.log("  " + "-".repeat(38));
  for (const [month, ms] of r.monthly) {
    const wr = ms.trades > 0 ? (ms.wins/ms.trades*100).toFixed(0)+"%" : "n/a";
    console.log(`  ${month.padEnd(8)} ${String(ms.trades).padStart(7)} ${String(ms.wins).padStart(5)} ${wr.padStart(5)} ${((ms.pnl>=0?"+":"")+"$"+ms.pnl.toFixed(0)).padStart(9)}`);
  }
  console.log(`  ${"TOTAL".padEnd(8)} ${String(r.trades).padStart(7)} ${String(r.wins).padStart(5)} ${(r.winRate.toFixed(0)+"%").padStart(5)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(9)}`);
}

// ══════════════════════════════════════════════
//   SECTION 11 — Per-trade deep analysis
//   Best config: near 1.25% | 18h | TP 1% | stop 2%
//   For every trade, capture:
//     - entry date/hour, exit reason, hours to exit
//     - pnl%, distFromHigh at entry
//     - for STOP trades: price at expiry vs entry (did it reverse?)
//     - for ALL trades: low / high seen in remaining window after exit
//   Goal: identify re-entry long opportunity on stop-outs,
//         and find if there's a post-exit drift pattern
// ══════════════════════════════════════════════

interface WedTrade {
  date: string;           // Wed date
  entryHourUTC: number;
  entryPrice: number;
  exitPrice: number;
  exitReason: "TP" | "STOP" | "EXPIRY";
  hoursToExit: number;
  pnlPct: number;
  distFromHighPct: number;  // how far entry was from rolling daily high
  // after exit: what happens to price through Thu 12h?
  postExitLow: number;      // lowest seen after exit (as % below entry)
  postExitHigh: number;     // highest seen after exit (as % above entry)
  postExitFinal: number;    // Thu 12h close vs entry (negative = down from entry)
  hoursRemaining: number;   // hours left in window after exit
}

function runWedShortTradeLog(cfg: WedShortCfg, allDays: DayData[]): WedTrade[] {
  const wedDays = allDays.filter(d => new Date(d.date + "T12:00:00Z").getUTCDay() === 3);
  const dayByDate = new Map(allDays.map(d => [d.date, d]));
  const trades: WedTrade[] = [];

  for (const wed of wedDays) {
    const thuDate = new Date(wed.date + "T12:00:00Z");
    thuDate.setUTCDate(thuDate.getUTCDate() + 1);
    const thu = dayByDate.get(thuDate.toISOString().slice(0, 10));
    if (!thu) continue;

    const expiryTs = new Date(thu.date + "T00:00:00Z").getTime() + cfg.expiryH * 3600000;
    const entryWindowStart = new Date(wed.date + "T00:00:00Z").getTime() + cfg.entryAfterH * 3600000;
    const wedWindowCandles = wed.candles.filter(c => c.timestamp >= entryWindowStart);
    if (wedWindowCandles.length === 0) continue;

    let rollingHigh = 0;
    for (const c of wed.candles) {
      if (c.high > rollingHigh) rollingHigh = c.high;
      if (c.timestamp < entryWindowStart) continue;

      const distFromHigh = (rollingHigh - c.close) / rollingHigh * 100;
      if (distFromHigh > cfg.nearHighPct) continue;

      const entryPrice = c.close;
      const tpPrice = entryPrice * (1 - cfg.tpPct / 100);
      const stopPrice = entryPrice * (1 + cfg.stopPct / 100);
      const entryTs = c.timestamp;
      const entryHourUTC = new Date(entryTs).getUTCHours();

      const remainingWed = wed.candles.filter(x => x.timestamp > entryTs);
      const thuCandles = thu.candles.filter(x => x.timestamp <= expiryTs);
      const scanCandles = [...remainingWed, ...thuCandles];

      let exitPrice = 0, exitTs = expiryTs;
      let exitReason: "TP" | "STOP" | "EXPIRY" = "EXPIRY";

      for (const sc of scanCandles) {
        if (sc.low <= tpPrice) { exitPrice = tpPrice; exitTs = sc.timestamp; exitReason = "TP"; break; }
        if (sc.high >= stopPrice) { exitPrice = stopPrice; exitTs = sc.timestamp; exitReason = "STOP"; break; }
        if (sc.timestamp >= expiryTs) { exitPrice = sc.open; exitTs = sc.timestamp; exitReason = "EXPIRY"; break; }
      }
      if (exitPrice === 0) {
        const last = scanCandles[scanCandles.length - 1];
        exitPrice = last ? last.close : entryPrice;
        exitTs = last ? last.timestamp : expiryTs;
      }

      const pnlPct = (entryPrice - exitPrice) / entryPrice * 100;
      const hoursToExit = (exitTs - entryTs) / 3600000;
      const hoursRemaining = Math.max(0, (expiryTs - exitTs) / 3600000);

      // Scan post-exit candles for low/high/final
      const postExit = [...remainingWed, ...thuCandles].filter(x => x.timestamp > exitTs && x.timestamp <= expiryTs);
      let postLow = Infinity, postHigh = -Infinity, postFinal = exitPrice;
      for (const pc of postExit) {
        if (pc.low < postLow) postLow = pc.low;
        if (pc.high > postHigh) postHigh = pc.high;
        postFinal = pc.close;
      }
      if (postExit.length === 0) { postLow = exitPrice; postHigh = exitPrice; }

      trades.push({
        date: wed.date,
        entryHourUTC,
        entryPrice,
        exitPrice,
        exitReason,
        hoursToExit,
        pnlPct,
        distFromHighPct: distFromHigh,
        postExitLow: (postLow - entryPrice) / entryPrice * 100,
        postExitHigh: (postHigh - entryPrice) / entryPrice * 100,
        postExitFinal: (postFinal - entryPrice) / entryPrice * 100,
        hoursRemaining,
      });
      break;
    }
  }
  return trades;
}

const analysisBase: WedShortCfg = {
  label: "near 1.25% after 18h | TP 1% | stop 2%",
  entryAfterH: 18, nearHighPct: 1.25, tpPct: 1.0, stopPct: 2.0,
  expiryH: 12, capitalPerTrade: 1000, fee: 0.00055,
};

const tradeLog = runWedShortTradeLog(analysisBase, postLaunch);

console.log("\n" + SEP);
console.log("  SECTION 11 — Per-trade deep analysis");
console.log("  Config: near 1.25% | after 18h UTC | TP 1% | stop 2%");
console.log(SEP);

// ── 11a: Full trade list ──
console.log("\n  11a — Every trade");
console.log(`  ${"Date".padEnd(10)} ${"EntH".padStart(4)} ${"DistHi%".padStart(8)} ${"Entry".padStart(8)} ${"Exit".padStart(8)} ${"Reason".padStart(7)} ${"Hrs".padStart(5)} ${"PnL%".padStart(6)} ${"PostLo%".padStart(8)} ${"PostHi%".padStart(8)} ${"Final%".padStart(7)} ${"HrsLeft".padStart(7)}`);
console.log("  " + "-".repeat(98));
for (const t of tradeLog) {
  const tag = t.exitReason === "TP" ? "TP   " : t.exitReason === "STOP" ? "STOP " : "EXP  ";
  const sign = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  console.log(
    `  ${t.date.padEnd(10)} ${String(t.entryHourUTC).padStart(4)} ${(t.distFromHighPct.toFixed(2)+"%").padStart(8)}` +
    ` ${t.entryPrice.toFixed(3).padStart(8)} ${t.exitPrice.toFixed(3).padStart(8)} ${tag.padStart(7)}` +
    ` ${t.hoursToExit.toFixed(1).padStart(5)} ${sign(t.pnlPct).padStart(6)}` +
    ` ${sign(t.postExitLow).padStart(8)} ${sign(t.postExitHigh).padStart(8)} ${sign(t.postExitFinal).padStart(7)} ${t.hoursRemaining.toFixed(1).padStart(7)}`
  );
}

// ── 11b: Stop-outs — did price reverse after stop? ──
const stops = tradeLog.filter(t => t.exitReason === "STOP");
console.log(`\n  11b — Stop-out analysis (${stops.length} trades)`);
console.log(`  After stop hit: does price fall back below entry (i.e. short was right, just early)?`);
console.log(`  ${"Date".padEnd(10)} ${"HrsLeft".padStart(7)} ${"PostLo%".padStart(8)} ${"PostHi%".padStart(8)} ${"Final%".padStart(7)} ${"Reversed?".padStart(10)}`);
console.log("  " + "-".repeat(55));
let reversals = 0;
for (const t of stops) {
  // Reversed = final price ended BELOW entry (short direction vindicated)
  const reversed = t.postExitFinal < 0;
  if (reversed) reversals++;
  const sign = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  console.log(
    `  ${t.date.padEnd(10)} ${t.hoursRemaining.toFixed(1).padStart(7)} ${sign(t.postExitLow).padStart(8)}` +
    ` ${sign(t.postExitHigh).padStart(8)} ${sign(t.postExitFinal).padStart(7)} ${(reversed ? "YES (below entry)" : "no").padStart(10)}`
  );
}
console.log(`  Reversals after stop: ${reversals}/${stops.length} (${stops.length > 0 ? (reversals/stops.length*100).toFixed(0) : 0}%) — price ended below entry at Thu 12h`);

// ── 11c: Stop-out long re-entry — if you flip long on stop, what's the outcome? ──
console.log(`\n  11c — Long re-entry on stop-out (flip long at stop price, exit at Thu 12h)`);
console.log(`  ${"Date".padEnd(10)} ${"LongEntry".padStart(10)} ${"PostLo%".padStart(8)} ${"PostHi%".padStart(8)} ${"ExitPnL%".padStart(9)} ${"HrsHeld".padStart(8)}`);
console.log("  " + "-".repeat(58));
let longWins = 0;
const longPnls: number[] = [];
for (const t of stops) {
  // Long entry = stop price; exit = Thu 12h final (postExitFinal is vs entry, need vs stop)
  // postExitFinal = (thuFinal - entry)/entry*100
  // stop = entry * 1.02 → stop is 2% above entry
  // pnl from long at stop = (thuFinal - stop)/stop*100
  //   thuFinal/entry = 1 + postExitFinal/100
  //   thuFinal/stop = (thuFinal/entry) / (stop/entry) = (1+postExitFinal/100)/1.02
  const thuFinalVsStop = ((1 + t.postExitFinal / 100) / (1 + analysisBase.stopPct / 100) - 1) * 100;
  const win = thuFinalVsStop > 0;
  if (win) longWins++;
  longPnls.push(thuFinalVsStop);
  const sign = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  console.log(
    `  ${t.date.padEnd(10)} ${("stop+0%").padStart(10)} ${sign(t.postExitLow - analysisBase.stopPct).padStart(8)}` +
    ` ${sign(t.postExitHigh - analysisBase.stopPct).padStart(8)} ${sign(thuFinalVsStop).padStart(9)} ${t.hoursRemaining.toFixed(1).padStart(8)}`
  );
}
const avgLongPnl = longPnls.length > 0 ? longPnls.reduce((a,b) => a+b,0)/longPnls.length : 0;
console.log(`  Long flip WR: ${longWins}/${stops.length} (${stops.length>0?(longWins/stops.length*100).toFixed(0):0}%)  AvgPnL: ${avgLongPnl >= 0 ? "+" : ""}${avgLongPnl.toFixed(2)}%`);

// ── 11d: TP trades — how much further did it go after TP? ──
const tpTrades = tradeLog.filter(t => t.exitReason === "TP");
console.log(`\n  11d — TP hit analysis (${tpTrades.length} trades) — left-on-table after TP`);
console.log(`  PostLo% = how far below entry price moved after TP (short direction — left on table)`);
console.log(`  ${"Date".padEnd(10)} ${"HrsToTP".padStart(7)} ${"HrsLeft".padStart(7)} ${"PostLo%".padStart(8)} ${"PostHi%".padStart(8)} ${"Final%".padStart(7)}`);
console.log("  " + "-".repeat(55));
let furtherDown = 0;
for (const t of tpTrades) {
  // postExitLow < -tpPct means it went further than TP
  if (t.postExitLow < -(analysisBase.tpPct)) furtherDown++;
  const sign = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  console.log(
    `  ${t.date.padEnd(10)} ${t.hoursToExit.toFixed(1).padStart(7)} ${t.hoursRemaining.toFixed(1).padStart(7)}` +
    ` ${sign(t.postExitLow).padStart(8)} ${sign(t.postExitHigh).padStart(8)} ${sign(t.postExitFinal).padStart(7)}`
  );
}
console.log(`  Went further past TP: ${furtherDown}/${tpTrades.length} (${tpTrades.length>0?(furtherDown/tpTrades.length*100).toFixed(0):0}%)`);

// ── 11e: Entry hour distribution ──
const hourBuckets: Record<number, { n: number; wins: number; pnl: number }> = {};
for (const t of tradeLog) {
  const h = t.entryHourUTC;
  if (!hourBuckets[h]) hourBuckets[h] = { n: 0, wins: 0, pnl: 0 };
  hourBuckets[h].n++;
  if (t.pnlPct > 0) hourBuckets[h].wins++;
  hourBuckets[h].pnl += t.pnlPct;
}
console.log(`\n  11e — Entry hour distribution (UTC)`);
console.log(`  ${"Hour".padEnd(6)} ${"N".padStart(4)} ${"WR".padStart(6)} ${"AvgPnL%".padStart(9)}`);
console.log("  " + "-".repeat(28));
for (const h of Object.keys(hourBuckets).map(Number).sort((a,b)=>a-b)) {
  const b = hourBuckets[h];
  const avgPnl = b.pnl / b.n;
  console.log(`  ${String(h).padEnd(6)} ${String(b.n).padStart(4)} ${((b.wins/b.n*100).toFixed(0)+"%").padStart(6)} ${((avgPnl >= 0 ? "+" : "") + avgPnl.toFixed(2) + "%").padStart(9)}`);
}

// ── 11f: Expiry trades analysis ──
const expiries = tradeLog.filter(t => t.exitReason === "EXPIRY");
if (expiries.length > 0) {
  console.log(`\n  11f — Expiry trades (${expiries.length} trades — held through Thu 12h)`);
  const avgExp = expiries.reduce((a,t)=>a+t.pnlPct,0)/expiries.length;
  console.log(`  Avg PnL at expiry: ${avgExp>=0?"+":""}${avgExp.toFixed(2)}%`);
  for (const t of expiries) {
    const sign = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
    console.log(`  ${t.date}  entH=${t.entryHourUTC}  pnl=${sign(t.pnlPct)}  distHi=${t.distFromHighPct.toFixed(2)}%`);
  }
}

// ══════════════════════════════════════════════
//   SECTION 12 — Trailing stop on Wed near-high short
//   Same entry: near 1.25% | after 18h UTC
//   Hard stop: 2% above entry (unchanged)
//   Trailing: track lowest price seen; exit when price
//             rises X% from that low (trail callback)
//   Variants:
//     A) Pure trail (no fixed TP)
//     B) Trail activates after 1% drop (lock in some move first)
//     C) Trail activates after 2% drop
//     D) Fixed TP baseline comparison
//   Feasibility: Bybit setTradingStop supports trailingStop
//   field (distance in price). Bot can call this after entry.
// ══════════════════════════════════════════════

interface TrailCfg {
  label: string;
  entryAfterH: number;
  nearHighPct: number;
  hardStopPct: number;
  trailCallbackPct: number;
  activateAfterPct: number;     // start trailing only once price drops this far (0 = immediate)
  expiryH: number;
  capitalPerTrade: number;
  fee: number;
}

interface TrailResult {
  trades: number; wins: number; totalPnlUsdt: number; winRate: number;
  avgPnlPct: number; maxConsecLoss: number; expiries: number; stops: number;
  monthly: Map<string, { pnl: number; trades: number; wins: number }>;
}

function runTrailSim(cfg: TrailCfg, allDays: DayData[]): TrailResult {
  const wedDays = allDays.filter(d => new Date(d.date + "T12:00:00Z").getUTCDay() === 3);
  const dayByDate = new Map(allDays.map(d => [d.date, d]));

  let trades = 0, wins = 0, totalPnlUsdt = 0, expiries = 0, stops = 0;
  let maxConsecLoss = 0, curConsec = 0;
  const monthly = new Map<string, { pnl: number; trades: number; wins: number }>();
  const allPnls: number[] = [];

  for (const wed of wedDays) {
    const thuDate = new Date(wed.date + "T12:00:00Z");
    thuDate.setUTCDate(thuDate.getUTCDate() + 1);
    const thu = dayByDate.get(thuDate.toISOString().slice(0, 10));
    if (!thu) continue;

    const expiryTs = new Date(thu.date + "T00:00:00Z").getTime() + cfg.expiryH * 3600000;
    const entryWindowStart = new Date(wed.date + "T00:00:00Z").getTime() + cfg.entryAfterH * 3600000;

    let rollingHigh = 0;
    for (const c of wed.candles) {
      if (c.high > rollingHigh) rollingHigh = c.high;
      if (c.timestamp < entryWindowStart) continue;

      const distFromHigh = (rollingHigh - c.close) / rollingHigh * 100;
      if (distFromHigh > cfg.nearHighPct) continue;

      const entryPrice = c.close;
      const hardStopPrice = entryPrice * (1 + cfg.hardStopPct / 100);
      const activatePrice = entryPrice * (1 - cfg.activateAfterPct / 100);

      const remainingWed = wed.candles.filter(x => x.timestamp > c.timestamp);
      const thuCandles = thu.candles.filter(x => x.timestamp <= expiryTs);
      const scanCandles = [...remainingWed, ...thuCandles];

      let lowestSeen = entryPrice;
      let trailActive = cfg.activateAfterPct === 0;
      let exitPrice = 0;
      let exitReason: "TRAIL" | "HARDSTOP" | "EXPIRY" = "EXPIRY";

      for (const sc of scanCandles) {
        if (sc.high >= hardStopPrice) { exitPrice = hardStopPrice; exitReason = "HARDSTOP"; break; }
        if (sc.low < lowestSeen) lowestSeen = sc.low;
        if (!trailActive && lowestSeen <= activatePrice) trailActive = true;
        if (trailActive) {
          const trailStopPrice = lowestSeen * (1 + cfg.trailCallbackPct / 100);
          if (sc.high >= trailStopPrice) { exitPrice = trailStopPrice; exitReason = "TRAIL"; break; }
        }
        if (sc.timestamp >= expiryTs) { exitPrice = sc.open; exitReason = "EXPIRY"; break; }
      }
      if (exitPrice === 0) {
        const last = scanCandles[scanCandles.length - 1];
        exitPrice = last ? last.close : entryPrice;
        exitReason = "EXPIRY";
      }

      const pnlPct = (entryPrice - exitPrice) / entryPrice * 100;
      const pnlUsdt = cfg.capitalPerTrade * (pnlPct / 100) - cfg.capitalPerTrade * cfg.fee * 2;

      trades++;
      totalPnlUsdt += pnlUsdt;
      allPnls.push(pnlPct);
      if (pnlUsdt > 0) wins++;
      if (exitReason === "EXPIRY") expiries++;
      if (exitReason === "HARDSTOP") stops++;
      if (pnlUsdt <= 0) { curConsec++; maxConsecLoss = Math.max(maxConsecLoss, curConsec); } else curConsec = 0;

      const month = wed.date.slice(0, 7);
      if (!monthly.has(month)) monthly.set(month, { pnl: 0, trades: 0, wins: 0 });
      const m = monthly.get(month)!;
      m.pnl += pnlUsdt; m.trades++; if (pnlUsdt > 0) m.wins++;
      break;
    }
  }

  return {
    trades, wins, totalPnlUsdt,
    winRate: trades > 0 ? wins / trades * 100 : 0,
    avgPnlPct: trades > 0 ? allPnls.reduce((a,b)=>a+b,0)/trades : 0,
    maxConsecLoss, expiries, stops,
    monthly,
  };
}

const trailHdr = `  ${"Config".padEnd(55)} ${"N".padStart(4)} ${"Win%".padStart(6)} ${"TotalPnL".padStart(10)} ${"AvgPnL%".padStart(8)} ${"MaxCL".padStart(6)} ${"Stops".padStart(6)} ${"Exp".padStart(5)}`;

console.log("\n" + SEP);
console.log("  SECTION 12 — Trailing stop: near 1.25% | after 18h | hard stop 2%");
console.log("  Trail callback sweep x activate-after threshold");
console.log(SEP);
console.log(trailHdr);
console.log("  " + "-".repeat(100));

console.log("  -- A) Pure trail (immediate activation) --");
for (const trail of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]) {
  const cfg: TrailCfg = {
    label: `trail ${trail}% callback | activate 0%`,
    entryAfterH: 18, nearHighPct: 1.25, hardStopPct: 2.0,
    trailCallbackPct: trail, activateAfterPct: 0,
    expiryH: 12, capitalPerTrade: 1000, fee: 0.00055,
  };
  const r = runTrailSim(cfg, postLaunch);
  console.log(
    `  ${cfg.label.padEnd(55)} ${String(r.trades).padStart(4)} ${(r.winRate.toFixed(0)+"%").padStart(6)}` +
    ` ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(10)} ${((r.avgPnlPct>=0?"+":"")+r.avgPnlPct.toFixed(2)+"%").padStart(8)}` +
    ` ${r.maxConsecLoss.toString().padStart(6)} ${r.stops.toString().padStart(6)} ${r.expiries.toString().padStart(5)}`
  );
}

console.log("\n  -- B) Trail activates after 1% drop --");
for (const trail of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]) {
  const cfg: TrailCfg = {
    label: `trail ${trail}% callback | activate after 1% drop`,
    entryAfterH: 18, nearHighPct: 1.25, hardStopPct: 2.0,
    trailCallbackPct: trail, activateAfterPct: 1.0,
    expiryH: 12, capitalPerTrade: 1000, fee: 0.00055,
  };
  const r = runTrailSim(cfg, postLaunch);
  console.log(
    `  ${cfg.label.padEnd(55)} ${String(r.trades).padStart(4)} ${(r.winRate.toFixed(0)+"%").padStart(6)}` +
    ` ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(10)} ${((r.avgPnlPct>=0?"+":"")+r.avgPnlPct.toFixed(2)+"%").padStart(8)}` +
    ` ${r.maxConsecLoss.toString().padStart(6)} ${r.stops.toString().padStart(6)} ${r.expiries.toString().padStart(5)}`
  );
}

console.log("\n  -- C) Trail activates after 2% drop --");
for (const trail of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]) {
  const cfg: TrailCfg = {
    label: `trail ${trail}% callback | activate after 2% drop`,
    entryAfterH: 18, nearHighPct: 1.25, hardStopPct: 2.0,
    trailCallbackPct: trail, activateAfterPct: 2.0,
    expiryH: 12, capitalPerTrade: 1000, fee: 0.00055,
  };
  const r = runTrailSim(cfg, postLaunch);
  console.log(
    `  ${cfg.label.padEnd(55)} ${String(r.trades).padStart(4)} ${(r.winRate.toFixed(0)+"%").padStart(6)}` +
    ` ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(10)} ${((r.avgPnlPct>=0?"+":"")+r.avgPnlPct.toFixed(2)+"%").padStart(8)}` +
    ` ${r.maxConsecLoss.toString().padStart(6)} ${r.stops.toString().padStart(6)} ${r.expiries.toString().padStart(5)}`
  );
}

console.log("\n  -- D) Fixed TP baseline (same entry, hard stop 2%) --");
for (const tp of [1.0, 2.0, 3.0, 4.0]) {
  const cfg: WedShortCfg = {
    label: `fixed TP ${tp}% | hard stop 2%`,
    entryAfterH: 18, nearHighPct: 1.25,
    tpPct: tp, stopPct: 2.0,
    expiryH: 12, capitalPerTrade: 1000, fee: 0.00055,
  };
  const r = runWedShortSim(cfg, postLaunch);
  const avgPnl = r.trades > 0 ? r.totalPnlUsdt / r.trades / 1000 * 100 : 0;
  console.log(
    `  ${cfg.label.padEnd(55)} ${String(r.trades).padStart(4)} ${(r.winRate.toFixed(0)+"%").padStart(6)}` +
    ` ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(10)} ${((avgPnl>=0?"+":"")+avgPnl.toFixed(2)+"%").padStart(8)}` +
    ` ${r.maxConsecLoss.toString().padStart(6)} ${r.losses.toString().padStart(6)} ${r.expiries.toString().padStart(5)}`
  );
}

// Monthly breakdown for top trail candidates
const trailMonthCfgs: TrailCfg[] = [
  { label: "trail 1.0% | activate 1%", entryAfterH: 18, nearHighPct: 1.25, hardStopPct: 2.0, trailCallbackPct: 1.0, activateAfterPct: 1.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "trail 1.5% | activate 1%", entryAfterH: 18, nearHighPct: 1.25, hardStopPct: 2.0, trailCallbackPct: 1.5, activateAfterPct: 1.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "trail 2.0% | activate 1%", entryAfterH: 18, nearHighPct: 1.25, hardStopPct: 2.0, trailCallbackPct: 2.0, activateAfterPct: 1.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
  { label: "trail 1.5% | activate 2%", entryAfterH: 18, nearHighPct: 1.25, hardStopPct: 2.0, trailCallbackPct: 1.5, activateAfterPct: 2.0, expiryH: 12, capitalPerTrade: 1000, fee: 0.00055 },
];

console.log("\n" + SEP);
console.log("  SECTION 12 — Monthly breakdown: trail candidates");
console.log(SEP);
for (const cfg of trailMonthCfgs) {
  const r = runTrailSim(cfg, postLaunch);
  console.log(`\n  -- ${cfg.label} | ${r.trades} trades | WR ${r.winRate.toFixed(0)}% | $${r.totalPnlUsdt.toFixed(0)} --`);
  console.log(`  ${"Month".padEnd(8)} ${"Trades".padStart(7)} ${"Wins".padStart(5)} ${"WR".padStart(5)} ${"PnL($)".padStart(9)}`);
  console.log("  " + "-".repeat(38));
  for (const [month, ms] of r.monthly) {
    const wr = ms.trades > 0 ? (ms.wins/ms.trades*100).toFixed(0)+"%" : "n/a";
    console.log(`  ${month.padEnd(8)} ${String(ms.trades).padStart(7)} ${String(ms.wins).padStart(5)} ${wr.padStart(5)} ${((ms.pnl>=0?"+":"")+"$"+ms.pnl.toFixed(0)).padStart(9)}`);
  }
  console.log(`  ${"TOTAL".padEnd(8)} ${String(r.trades).padStart(7)} ${String(r.wins).padStart(5)} ${(r.winRate.toFixed(0)+"%").padStart(5)} ${("$"+r.totalPnlUsdt.toFixed(0)).padStart(9)}`);
}
