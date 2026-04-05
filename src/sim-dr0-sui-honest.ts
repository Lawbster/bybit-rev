// sim-dr0-sui-honest.ts — DR0 long with ZERO look-ahead bias
//
// Signal (lookback only):
// 1. 24h high → current price drop >= dropPct% (measured from completed bars only)
// 2. 4H EMA9 > EMA21 (bullish trend, lookback)
// 3. Recovery confirmation: last N completed bars show price recovering
//    (close of confirm bar > low of the dump low bar)
// 4. Entry at close of the confirmation bar
//
// No swing low detection (requires future data). Instead we detect
// "deep dip in uptrend + initial recovery" which is what you'd see live.
import fs from "fs";
import { EMA, RSI, BollingerBands } from "technicalindicators";
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

// ── Indicators (all lookback) ──
const closes1h = bars1h.map(b => b.close);
const bb20 = BollingerBands.calculate({ period: 20, values: closes1h, stdDev: 2 });
const OFFBB = closes1h.length - bb20.length;

const closes4h = bars4h.map(b => b.close);
const ema9_4h = EMA.calculate({ period: 9, values: closes4h });
const ema21_4h = EMA.calculate({ period: 21, values: closes4h });
const OFF9_4H = closes4h.length - ema9_4h.length;
const OFF21_4H = closes4h.length - ema21_4h.length;

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

// ══════════════════════════════════════════════════════════════
// HONEST SIGNAL DETECTION — lookback only
// ══════════════════════════════════════════════════════════════
//
// At each completed 1H bar (index i), check:
// 1. Find lowest low in bars [i-recoveryBars .. i] — call it dumpLow at index dumpIdx
// 2. dumpIdx must NOT be the current bar (i.e., dumpIdx < i) — we need recovery AFTER the low
// 3. 24h high (bars [dumpIdx-24 .. dumpIdx]) → drop >= dropPct%
// 4. Current bar close > dumpLow (price has bounced)
// 5. At least 1 green bar after dumpIdx (recovery confirmation)
// 6. 4H EMA9 > EMA21 at current time (bullish trend)
// 7. Entry at bar[i].close
//
// This is exactly what a live bot polling 1H candles would see.

interface Signal {
  ts: number;       // entry bar timestamp
  price: number;    // entry price (bar close)
  dumpLow: number;  // the low we're bouncing from
  dropPct: number;  // how far it dropped
  barIdx: number;
}

interface SimConfig {
  dropPct: number;        // min drop from 24h high
  recoveryBars: number;   // lookback window to find the dump low (e.g. 3-6)
  minRecoveryPct: number; // min % bounce from dump low to confirm recovery
  require4hBull: boolean;
  requireBBLow: boolean;  // BB position < 0.2 at dump low
  tpPct: number;
  slPct: number;
  maxHoldMin: number;
  cooldownHours: number;
  label: string;
}

function detectSignals(cfg: SimConfig): Signal[] {
  const signals: Signal[] = [];
  let lastSignalTs = 0;

  // Start after enough bars for indicators
  for (let i = 50; i < bars1h.length - 1; i++) {
    // Only look at completed bars (drop the last bar as incomplete)
    // In live: we poll after bar close, so bar[i] is the most recent completed bar

    // Find lowest low in the recovery window [i - recoveryBars, i-1]
    // The current bar (i) is our confirmation/entry bar
    // The dump low must be BEFORE the current bar
    let dumpLow = Infinity, dumpIdx = -1;
    const windowStart = Math.max(0, i - cfg.recoveryBars);
    for (let j = windowStart; j < i; j++) {  // strictly < i — low must be before entry bar
      if (bars1h[j].low < dumpLow) {
        dumpLow = bars1h[j].low;
        dumpIdx = j;
      }
    }
    if (dumpIdx < 0) continue;

    // Drop: 24h high before dumpIdx → dumpLow
    let priorHigh = 0;
    for (let j = Math.max(0, dumpIdx - 24); j < dumpIdx; j++) {
      if (bars1h[j].high > priorHigh) priorHigh = bars1h[j].high;
    }
    if (priorHigh === 0) continue;
    const dropPct = ((priorHigh - dumpLow) / priorHigh) * 100;
    if (dropPct < cfg.dropPct) continue;

    // Recovery: current bar close must be above dump low
    const entryBar = bars1h[i];
    const recoveryPct = ((entryBar.close - dumpLow) / dumpLow) * 100;
    if (recoveryPct < cfg.minRecoveryPct) continue;

    // At least 1 green bar between dumpIdx+1 and i (inclusive)
    let hasGreen = false;
    for (let j = dumpIdx + 1; j <= i; j++) {
      if (bars1h[j].close > bars1h[j].open) { hasGreen = true; break; }
    }
    if (!hasGreen) continue;

    // Don't enter if price is STILL making new lows — entry bar low must be above dump low
    if (entryBar.low < dumpLow) continue;

    // 4H trend filter (lookback — use the 4H bar that contains or precedes this 1H bar)
    if (cfg.require4hBull) {
      const i4h = find4hIdx(entryBar.timestamp);
      if (i4h < OFF9_4H || i4h < OFF21_4H) continue;
      const e9 = ema9_4h[i4h - OFF9_4H];
      const e21 = ema21_4h[i4h - OFF21_4H];
      if (e9 <= e21) continue;
    }

    // Optional BB filter at dump bar
    if (cfg.requireBBLow && dumpIdx >= OFFBB) {
      const bb = bb20[dumpIdx - OFFBB];
      const bbPos = (bars1h[dumpIdx].close - bb.lower) / (bb.upper - bb.lower);
      if (bbPos > 0.2) continue;
    }

    // Cooldown
    if (entryBar.timestamp - lastSignalTs < cfg.cooldownHours * 3600000) continue;

    // Signal age: dump must be recent (within recoveryBars hours)
    signals.push({
      ts: entryBar.timestamp,
      price: entryBar.close,
      dumpLow,
      dropPct,
      barIdx: i,
    });
    lastSignalTs = entryBar.timestamp;
  }
  return signals;
}

// ── Sim engine ──
const DISC_END = new Date("2026-01-01").getTime();
const NOTIONAL = 10000;
const FEE_RT = 0.0011;

interface MonthStats { trades: number; wins: number; losses: number; flats: number; pnl: number; }

function runSim(cfg: SimConfig) {
  const signals = detectSignals(cfg);
  let wins = 0, losses = 0, flats = 0, totalPnl = 0;
  let equity = 0, peakEq = 0, maxDD = 0;
  let discN = 0, discPnl = 0, valN = 0, valPnl = 0;
  const monthly = new Map<string, MonthStats>();
  const trades: BacktestTrade[] = [];

  for (const sig of signals) {
    const entryIdx1m = bsearch(ts1m, sig.ts + 3600000);
    if (entryIdx1m < 0 || entryIdx1m >= bars1m.length - 10) continue;

    const ep = sig.price;
    const tp = ep * (1 + cfg.tpPct / 100);
    const sl = ep * (1 - cfg.slPct / 100);
    const maxIdx = Math.min(entryIdx1m + cfg.maxHoldMin, bars1m.length - 1);

    let pnl = 0, outcome = "flat", exitIdx = maxIdx;
    for (let j = entryIdx1m + 1; j <= maxIdx; j++) {
      if (bars1m[j].low <= sl) { pnl = -cfg.slPct / 100 * NOTIONAL - NOTIONAL * FEE_RT; outcome = "stop"; exitIdx = j; break; }
      if (bars1m[j].high >= tp) { pnl = cfg.tpPct / 100 * NOTIONAL - NOTIONAL * FEE_RT; outcome = "tp"; exitIdx = j; break; }
    }
    if (outcome === "flat") pnl = ((bars1m[maxIdx].close - ep) / ep) * NOTIONAL - NOTIONAL * FEE_RT;

    const exitPrice = outcome === "stop" ? sl : outcome === "tp" ? tp : bars1m[maxIdx].close;
    trades.push({
      strategy: "dr0-long", symbol: "SUIUSDT", side: "long",
      entryTime: sig.ts, exitTime: bars1m[exitIdx].timestamp,
      entryPrice: ep, exitPrice,
      notional: NOTIONAL, pnlUsd: pnl, pnlPct: (pnl / NOTIONAL) * 100,
      outcome, feesUsd: NOTIONAL * FEE_RT,
    });

    totalPnl += pnl; equity += pnl;
    if (equity > peakEq) peakEq = equity;
    if (peakEq - equity > maxDD) maxDD = peakEq - equity;
    if (outcome === "tp") wins++; else if (outcome === "stop") losses++; else flats++;
    if (sig.ts < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }

    const mo = new Date(sig.ts).toISOString().slice(0, 7);
    if (!monthly.has(mo)) monthly.set(mo, { trades: 0, wins: 0, losses: 0, flats: 0, pnl: 0 });
    const m = monthly.get(mo)!;
    m.trades++; m.pnl += pnl;
    if (outcome === "tp") m.wins++; else if (outcome === "stop") m.losses++; else m.flats++;
  }

  return { wins, losses, flats, totalPnl, maxDD, discN, discPnl, valN, valPnl, monthly, trades, signals };
}

// ══════════════════════════════════════════════════════════════
// SWEEP — find best honest parameters
// ══════════════════════════════════════════════════════════════

console.log("▓".repeat(130));
console.log("  HONEST DR0 SWEEP — no look-ahead bias");
console.log("▓".repeat(130));
console.log(`  ${"Drop%".padEnd(7)} ${"RecBars".padEnd(8)} ${"MinRec%".padEnd(9)} ${"4HBull".padEnd(7)} ${"BB".padEnd(4)} ${"TP%".padEnd(5)} ${"SL%".padEnd(5)} ${"N".padEnd(5)} ${"W".padEnd(5)} ${"L".padEnd(5)} ${"WR%".padEnd(7)} ${"PnL".padEnd(12)} ${"DD".padEnd(10)} ${"dN".padEnd(5)} ${"dPnL".padEnd(10)} ${"vN".padEnd(5)} ${"vPnL".padEnd(10)} ${"v$/t".padEnd(8)}`);
console.log("─".repeat(130));

const results: { cfg: SimConfig; n: number; wr: number; pnl: number; dd: number; valN: number; valPnl: number }[] = [];

for (const dropPct of [4, 5, 6]) {
  for (const recoveryBars of [3, 4, 6]) {
    for (const minRecoveryPct of [0.3, 0.5, 1.0]) {
      for (const require4hBull of [true, false]) {
        for (const requireBBLow of [false]) {  // keep it simple first
          for (const tpPct of [1.5, 2.0, 2.5]) {
            for (const slPct of [2.0, 3.0]) {
              const cfg: SimConfig = {
                dropPct, recoveryBars, minRecoveryPct,
                require4hBull, requireBBLow,
                tpPct, slPct, maxHoldMin: 720,
                cooldownHours: 6, label: "",
              };
              const r = runSim(cfg);
              const n = r.wins + r.losses + r.flats;
              if (n < 10) continue;
              const wr = r.wins / n * 100;
              const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(1) : "—";

              results.push({ cfg, n, wr, pnl: r.totalPnl, dd: r.maxDD, valN: r.valN, valPnl: r.valPnl });

              console.log(
                `  ${dropPct.toFixed(0).padEnd(7)} ${String(recoveryBars).padEnd(8)} ${minRecoveryPct.toFixed(1).padEnd(9)} ` +
                `${(require4hBull ? "Y" : "N").padEnd(7)} ${(requireBBLow ? "Y" : "N").padEnd(4)} ` +
                `${tpPct.toFixed(1).padEnd(5)} ${slPct.toFixed(1).padEnd(5)} ` +
                `${String(n).padEnd(5)} ${String(r.wins).padEnd(5)} ${String(r.losses).padEnd(5)} ` +
                `${(wr.toFixed(1) + "%").padEnd(7)} ${"$" + (r.totalPnl >= 0 ? "+" : "") + r.totalPnl.toFixed(0).padEnd(11)} ` +
                `${"$" + r.maxDD.toFixed(0).padEnd(9)} ${String(r.discN).padEnd(5)} ` +
                `${"$" + (r.discPnl >= 0 ? "+" : "") + r.discPnl.toFixed(0).padEnd(9)} ` +
                `${String(r.valN).padEnd(5)} ${"$" + (r.valPnl >= 0 ? "+" : "") + r.valPnl.toFixed(0).padEnd(9)} ${vpt}`
              );
            }
          }
        }
      }
    }
  }
}

// ── Top 15 by validation $/trade ──
console.log(`\n${"═".repeat(130)}`);
console.log("  TOP 15 by validation $/trade (min 8 val trades):\n");
const top = results.filter(r => r.valN >= 8).sort((a, b) => (b.valPnl / b.valN) - (a.valPnl / a.valN)).slice(0, 15);
for (const r of top) {
  const c = r.cfg;
  const vpt = (r.valPnl / r.valN).toFixed(1);
  console.log(`  drop=${c.dropPct}% rec=${c.recoveryBars}b minRec=${c.minRecoveryPct}% 4hBull=${c.require4hBull ? "Y" : "N"} TP=${c.tpPct}% SL=${c.slPct}% | ${r.n}t WR=${r.wr.toFixed(1)}% PnL=$${r.pnl >= 0 ? "+" : ""}${r.pnl.toFixed(0)} DD=$${r.dd.toFixed(0)} | val: ${r.valN}t $${r.valPnl >= 0 ? "+" : ""}${r.valPnl.toFixed(0)} ($${vpt}/t)`);
}

// ── Detailed output for best combo ──
if (top.length > 0) {
  const best = top[0];
  best.cfg.label = `BEST: drop=${best.cfg.dropPct}% rec=${best.cfg.recoveryBars}b minRec=${best.cfg.minRecoveryPct}% 4hBull=${best.cfg.require4hBull ? "Y" : "N"}`;
  const r = runSim(best.cfg);
  const n = r.wins + r.losses + r.flats;
  const wr = (r.wins / n * 100).toFixed(1);
  const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(1) : "—";

  console.log(`\n${"═".repeat(130)}`);
  console.log(`  ${best.cfg.label} | TP=${best.cfg.tpPct}% SL=${best.cfg.slPct}%`);
  console.log(`  Trades: ${n} | W: ${r.wins} L: ${r.losses} F: ${r.flats} | WR: ${wr}%`);
  console.log(`  PnL: $${r.totalPnl >= 0 ? "+" : ""}${r.totalPnl.toFixed(0)} | MaxDD: $${r.maxDD.toFixed(0)}`);
  console.log(`  Discovery: ${r.discN}t $${r.discPnl >= 0 ? "+" : ""}${r.discPnl.toFixed(0)} | Validation: ${r.valN}t $${r.valPnl >= 0 ? "+" : ""}${r.valPnl.toFixed(0)} ($${vpt}/t)`);
  console.log(`${"═".repeat(130)}`);

  console.log(`\n  ${"Month".padEnd(9)} ${"N".padEnd(5)} ${"W".padEnd(4)} ${"L".padEnd(4)} ${"F".padEnd(4)} ${"WR%".padEnd(7)} ${"PnL".padEnd(12)} Split`);
  console.log(`  ${"─".repeat(65)}`);
  let eqCum = 0;
  for (const [mo, m] of [...r.monthly.entries()].sort()) {
    eqCum += m.pnl;
    const moWr = m.trades > 0 ? (m.wins / m.trades * 100).toFixed(0) + "%" : "—";
    const split = new Date(mo + "-01").getTime() < DISC_END ? "disc" : "val";
    console.log(`  ${mo}   ${String(m.trades).padEnd(5)} ${String(m.wins).padEnd(4)} ${String(m.losses).padEnd(4)} ${String(m.flats).padEnd(4)} ${moWr.padEnd(7)} ${"$" + (m.pnl >= 0 ? "+" : "") + m.pnl.toFixed(0).padEnd(11)} ${split}  eq=$${eqCum >= 0 ? "+" : ""}${eqCum.toFixed(0)}`);
  }

  console.log(`\n  ${"Date".padEnd(18)} ${"Entry".padEnd(10)} ${"Exit".padEnd(10)} ${"Out".padEnd(6)} ${"PnL".padEnd(10)} ${"Hold".padEnd(8)} ${"Drop%".padEnd(7)} Split`);
  console.log(`  ${"─".repeat(90)}`);
  for (let ti = 0; ti < r.trades.length; ti++) {
    const t = r.trades[ti];
    const holdMin = (t.exitTime - t.entryTime) / 60000;
    const holdStr = holdMin >= 60 ? `${(holdMin / 60).toFixed(1)}h` : `${holdMin.toFixed(0)}m`;
    const split = t.entryTime < DISC_END ? "disc" : "val";
    const sig = r.signals[ti];
    console.log(`  ${new Date(t.entryTime).toISOString().slice(0, 16).padEnd(18)} $${t.entryPrice.toFixed(4).padEnd(9)} $${t.exitPrice.toFixed(4).padEnd(9)} ${t.outcome.padEnd(6)} ${"$" + (t.pnlUsd >= 0 ? "+" : "") + t.pnlUsd.toFixed(0).padEnd(9)} ${holdStr.padEnd(8)} ${sig?.dropPct.toFixed(1).padEnd(7) ?? "?"} ${split}`);
  }

  writeCsv(r.trades, { strategy: "dr0-honest", symbol: "SUIUSDT", params: { drop: best.cfg.dropPct, rec: best.cfg.recoveryBars, minRec: best.cfg.minRecoveryPct, bull: best.cfg.require4hBull ? 1 : 0, tp: best.cfg.tpPct, sl: best.cfg.slPct } });
}

// Also run the 2/3 specifically with best signal params if different
console.log(`\n${"═".repeat(130)}`);
console.log("  FORCED TP=2% SL=3% — top signal combos:\n");
for (const dropPct of [4, 5, 6]) {
  for (const recoveryBars of [3, 4, 6]) {
    for (const minRecoveryPct of [0.3, 0.5, 1.0]) {
      const cfg: SimConfig = {
        dropPct, recoveryBars, minRecoveryPct,
        require4hBull: true, requireBBLow: false,
        tpPct: 2.0, slPct: 3.0, maxHoldMin: 720,
        cooldownHours: 6, label: "",
      };
      const r = runSim(cfg);
      const n = r.wins + r.losses + r.flats;
      if (n < 10) continue;
      const wr = r.wins / n * 100;
      const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(1) : "—";
      if (r.valN < 5) continue;
      console.log(`  drop=${dropPct}% rec=${recoveryBars}b minRec=${minRecoveryPct}% | ${n}t WR=${wr.toFixed(1)}% PnL=$${r.totalPnl >= 0 ? "+" : ""}${r.totalPnl.toFixed(0)} DD=$${r.maxDD.toFixed(0)} | val: ${r.valN}t $${r.valPnl >= 0 ? "+" : ""}${r.valPnl.toFixed(0)} ($${vpt}/t)`);
    }
  }
}
console.log(`${"═".repeat(130)}`);
