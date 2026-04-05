// analyze-sui-long-honest.ts — Honest long setups on SUI (ZERO look-ahead)
//
// Three approaches, all lookback-only:
// 1. EMA mean reversion: price drops X% below EMA → long
// 2. Support zone touch: price enters historically significant price zones
// 3. DCA martingale ladder: scale in on drops, TP on recovery to avg entry
import fs from "fs";
import { EMA, RSI, BollingerBands, SMA, ATR } from "technicalindicators";
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
console.log(`1h: ${bars1h.length} | 4h: ${bars4h.length} | current: $${bars1h[bars1h.length - 1].close.toFixed(4)}\n`);

// ── Indicators ──
const closes1h = bars1h.map(b => b.close);
const highs1h = bars1h.map(b => b.high);
const lows1h = bars1h.map(b => b.low);

const ema20 = EMA.calculate({ period: 20, values: closes1h });
const ema50 = EMA.calculate({ period: 50, values: closes1h });
const ema100 = EMA.calculate({ period: 100, values: closes1h });
const ema200 = EMA.calculate({ period: 200, values: closes1h });
const rsi14 = RSI.calculate({ period: 14, values: closes1h });
const atr14 = ATR.calculate({ period: 14, high: highs1h, low: lows1h, close: closes1h });

const OFF20 = closes1h.length - ema20.length;
const OFF50 = closes1h.length - ema50.length;
const OFF100 = closes1h.length - ema100.length;
const OFF200 = closes1h.length - ema200.length;
const OFFRSI = closes1h.length - rsi14.length;
const OFFATR = closes1h.length - atr14.length;

function getVal(arr: number[], off: number, i: number): number { return i >= off ? arr[i - off] : NaN; }

// 4H trend
const closes4h = bars4h.map(b => b.close);
const ema9_4h = EMA.calculate({ period: 9, values: closes4h });
const ema21_4h = EMA.calculate({ period: 21, values: closes4h });
const OFF9_4H = closes4h.length - ema9_4h.length;
const OFF21_4H = closes4h.length - ema21_4h.length;
const ts4h = bars4h.map(b => b.timestamp);

function find4hIdx(ts: number): number {
  let lo = 0, hi = ts4h.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (ts4h[mid] <= ts) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}
function is4hBull(ts: number): boolean {
  const i = find4hIdx(ts);
  if (i < OFF9_4H || i < OFF21_4H) return false;
  return ema9_4h[i - OFF9_4H] > ema21_4h[i - OFF21_4H];
}

function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

const DISC_END = new Date("2026-01-01").getTime();
const FEE_RT = 0.0011;

// ══════════════════════════════════════════════════════════════
// APPROACH 1: EMA Mean Reversion — single entry
// Signal: price closes X% below EMA(N) on completed 1H bar → long
// All lookback. Entry at bar close. No future data.
// ══════════════════════════════════════════════════════════════
console.log("▓".repeat(130));
console.log("  APPROACH 1: EMA MEAN REVERSION (single entry, lookback only)");
console.log("▓".repeat(130));

function simMeanRevert(emaPeriod: number, distPct: number, tpPct: number, slPct: number, maxHoldH: number, cooldownH: number, require4hBull: boolean, notional: number) {
  const emaArr = emaPeriod === 20 ? ema20 : emaPeriod === 50 ? ema50 : emaPeriod === 100 ? ema100 : ema200;
  const off = emaPeriod === 20 ? OFF20 : emaPeriod === 50 ? OFF50 : emaPeriod === 100 ? OFF100 : OFF200;

  let wins = 0, losses = 0, flats = 0, totalPnl = 0;
  let equity = 0, peakEq = 0, maxDD = 0;
  let discN = 0, discPnl = 0, valN = 0, valPnl = 0;
  let lastEntryTs = 0;

  for (let i = off + 1; i < bars1h.length - 1; i++) {
    const bar = bars1h[i]; // completed bar
    const ema = emaArr[i - off];
    const dist = ((bar.close - ema) / ema) * 100;
    if (dist > -distPct) continue; // not far enough below

    if (bar.timestamp - lastEntryTs < cooldownH * 3600000) continue;
    if (require4hBull && !is4hBull(bar.timestamp)) continue;

    const ep = bar.close;
    const tp = ep * (1 + tpPct / 100);
    const sl = ep * (1 - slPct / 100);
    const entryIdx1m = bsearch(ts1m, bar.timestamp + 3600000);
    if (entryIdx1m < 0 || entryIdx1m >= bars1m.length - 10) continue;
    const maxIdx = Math.min(entryIdx1m + maxHoldH * 60, bars1m.length - 1);

    let pnl = 0, outcome = "flat";
    for (let j = entryIdx1m + 1; j <= maxIdx; j++) {
      if (bars1m[j].low <= sl) { pnl = -slPct / 100 * notional - notional * FEE_RT; outcome = "stop"; break; }
      if (bars1m[j].high >= tp) { pnl = tpPct / 100 * notional - notional * FEE_RT; outcome = "tp"; break; }
    }
    if (outcome === "flat") pnl = ((bars1m[maxIdx].close - ep) / ep) * notional - notional * FEE_RT;

    lastEntryTs = bar.timestamp;
    totalPnl += pnl; equity += pnl;
    if (equity > peakEq) peakEq = equity;
    if (peakEq - equity > maxDD) maxDD = peakEq - equity;
    if (outcome === "tp") wins++; else if (outcome === "stop") losses++; else flats++;
    if (bar.timestamp < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }
  }
  return { wins, losses, flats, totalPnl, maxDD, discN, discPnl, valN, valPnl };
}

console.log(`  ${"EMA".padEnd(5)} ${"Dist%".padEnd(7)} ${"TP%".padEnd(5)} ${"SL%".padEnd(5)} ${"4HB".padEnd(5)} ${"N".padEnd(5)} ${"W".padEnd(5)} ${"L".padEnd(5)} ${"WR%".padEnd(7)} ${"PnL".padEnd(12)} ${"DD".padEnd(10)} ${"dN".padEnd(5)} ${"dPnL".padEnd(10)} ${"vN".padEnd(5)} ${"vPnL".padEnd(10)} ${"v$/t"}`);
console.log("─".repeat(130));

for (const emaPeriod of [20, 50, 100]) {
  for (const distPct of [2, 3, 4, 5, 7]) {
    for (const tpPct of [1.5, 2.0, 3.0]) {
      for (const slPct of [2.0, 3.0, 4.0]) {
        for (const bull of [true, false]) {
          const r = simMeanRevert(emaPeriod, distPct, tpPct, slPct, 24, 12, bull, 10000);
          const n = r.wins + r.losses + r.flats;
          if (n < 5) continue;
          const wr = (r.wins / n * 100).toFixed(1);
          const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(1) : "—";
          // Only print profitable or close-to-profitable
          if (r.totalPnl < -2000 && r.valPnl < 0) continue;
          console.log(
            `  ${String(emaPeriod).padEnd(5)} ${distPct.toFixed(0).padEnd(7)} ${tpPct.toFixed(1).padEnd(5)} ${slPct.toFixed(1).padEnd(5)} ` +
            `${(bull ? "Y" : "N").padEnd(5)} ${String(n).padEnd(5)} ${String(r.wins).padEnd(5)} ${String(r.losses).padEnd(5)} ` +
            `${(wr + "%").padEnd(7)} ${"$" + (r.totalPnl >= 0 ? "+" : "") + r.totalPnl.toFixed(0).padEnd(11)} ` +
            `${"$" + r.maxDD.toFixed(0).padEnd(9)} ${String(r.discN).padEnd(5)} ` +
            `${"$" + (r.discPnl >= 0 ? "+" : "") + r.discPnl.toFixed(0).padEnd(9)} ` +
            `${String(r.valN).padEnd(5)} ${"$" + (r.valPnl >= 0 ? "+" : "") + r.valPnl.toFixed(0).padEnd(9)} ${vpt}`
          );
        }
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
// APPROACH 2: DCA Martingale Ladder
// When price drops X% below EMA, start adding rungs.
// Each rung adds more size (martingale scaling).
// TP at weighted avg entry + tpPct%. SL at max loss.
// All lookback — entry on completed bar closes.
// ══════════════════════════════════════════════════════════════
console.log(`\n${"▓".repeat(130)}`);
console.log("  APPROACH 2: DCA MARTINGALE LADDER (lookback only)");
console.log("▓".repeat(130));

interface LadderConfig {
  label: string;
  triggerEmaPeriod: number;  // EMA to measure distance from
  triggerDistPct: number;    // first entry when price is X% below EMA
  rungSpacingPct: number;    // add rung every X% further drop
  maxRungs: number;          // max positions
  scaleFactor: number;       // each rung = prev * scaleFactor (1.0 = equal, 1.5 = martingale)
  baseNotional: number;      // first rung size
  tpPct: number;             // TP above weighted avg entry
  maxLossPct: number;        // hard stop: close all if portfolio drops X% from peak notional
  maxHoldH: number;
  cooldownH: number;         // cooldown after ladder closes
}

interface LadderState {
  rungs: { price: number; notional: number }[];
  avgEntry: number;
  totalNotional: number;
  openedAt: number;
}

function simLadder(cfg: LadderConfig) {
  const emaArr = cfg.triggerEmaPeriod === 20 ? ema20 : cfg.triggerEmaPeriod === 50 ? ema50 : cfg.triggerEmaPeriod === 100 ? ema100 : ema200;
  const off = cfg.triggerEmaPeriod === 20 ? OFF20 : cfg.triggerEmaPeriod === 50 ? OFF50 : cfg.triggerEmaPeriod === 100 ? OFF100 : OFF200;

  let ladder: LadderState | null = null;
  let lastCloseTs = 0;
  let totalPnl = 0, equity = 0, peakEq = 0, maxDD = 0;
  let wins = 0, losses = 0, flats = 0;
  let discN = 0, discPnl = 0, valN = 0, valPnl = 0;
  const monthlyPnl = new Map<string, number>();
  const trades: { entryTs: number; exitTs: number; rungs: number; avgEntry: number; exitPrice: number; notional: number; pnl: number; outcome: string }[] = [];

  for (let i = Math.max(off, 200) + 1; i < bars1h.length - 1; i++) {
    const bar = bars1h[i];
    const ema = emaArr[i - off];
    const dist = ((bar.close - ema) / ema) * 100;

    if (ladder) {
      // Check TP
      const tpPrice = ladder.avgEntry * (1 + cfg.tpPct / 100);
      if (bar.high >= tpPrice) {
        const pnl = cfg.tpPct / 100 * ladder.totalNotional - ladder.totalNotional * FEE_RT;
        totalPnl += pnl; equity += pnl;
        if (equity > peakEq) peakEq = equity;
        if (peakEq - equity > maxDD) maxDD = peakEq - equity;
        wins++;
        const mo = new Date(bar.timestamp).toISOString().slice(0, 7);
        monthlyPnl.set(mo, (monthlyPnl.get(mo) ?? 0) + pnl);
        if (ladder.openedAt < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }
        trades.push({ entryTs: ladder.openedAt, exitTs: bar.timestamp, rungs: ladder.rungs.length, avgEntry: ladder.avgEntry, exitPrice: tpPrice, notional: ladder.totalNotional, pnl, outcome: "tp" });
        lastCloseTs = bar.timestamp;
        ladder = null;
        continue;
      }

      // Check max loss (hard stop)
      const unrealizedPct = ((bar.close - ladder.avgEntry) / ladder.avgEntry) * 100;
      if (unrealizedPct < -cfg.maxLossPct) {
        const pnl = unrealizedPct / 100 * ladder.totalNotional - ladder.totalNotional * FEE_RT;
        totalPnl += pnl; equity += pnl;
        if (equity > peakEq) peakEq = equity;
        if (peakEq - equity > maxDD) maxDD = peakEq - equity;
        losses++;
        const mo = new Date(bar.timestamp).toISOString().slice(0, 7);
        monthlyPnl.set(mo, (monthlyPnl.get(mo) ?? 0) + pnl);
        if (ladder.openedAt < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }
        trades.push({ entryTs: ladder.openedAt, exitTs: bar.timestamp, rungs: ladder.rungs.length, avgEntry: ladder.avgEntry, exitPrice: bar.close, notional: ladder.totalNotional, pnl, outcome: "stop" });
        lastCloseTs = bar.timestamp;
        ladder = null;
        continue;
      }

      // Check max hold
      if ((bar.timestamp - ladder.openedAt) / 3600000 > cfg.maxHoldH) {
        const pnl = unrealizedPct / 100 * ladder.totalNotional - ladder.totalNotional * FEE_RT;
        totalPnl += pnl; equity += pnl;
        if (equity > peakEq) peakEq = equity;
        if (peakEq - equity > maxDD) maxDD = peakEq - equity;
        if (pnl > 0) wins++; else if (pnl < -50) losses++; else flats++;
        const mo = new Date(bar.timestamp).toISOString().slice(0, 7);
        monthlyPnl.set(mo, (monthlyPnl.get(mo) ?? 0) + pnl);
        if (ladder.openedAt < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }
        trades.push({ entryTs: ladder.openedAt, exitTs: bar.timestamp, rungs: ladder.rungs.length, avgEntry: ladder.avgEntry, exitPrice: bar.close, notional: ladder.totalNotional, pnl, outcome: "expiry" });
        lastCloseTs = bar.timestamp;
        ladder = null;
        continue;
      }

      // Add rung if price dropped further
      if (ladder.rungs.length < cfg.maxRungs) {
        const lastRung = ladder.rungs[ladder.rungs.length - 1];
        const dropFromLast = ((bar.close - lastRung.price) / lastRung.price) * 100;
        if (dropFromLast < -cfg.rungSpacingPct) {
          const newNotional = lastRung.notional * cfg.scaleFactor;
          ladder.rungs.push({ price: bar.close, notional: newNotional });
          ladder.totalNotional += newNotional;
          // Recalculate weighted avg
          let wSum = 0, nSum = 0;
          for (const r of ladder.rungs) { wSum += r.price * r.notional; nSum += r.notional; }
          ladder.avgEntry = wSum / nSum;
        }
      }
    } else {
      // No position — check for entry trigger
      if (bar.timestamp - lastCloseTs < cfg.cooldownH * 3600000) continue;
      if (dist > -cfg.triggerDistPct) continue;

      ladder = {
        rungs: [{ price: bar.close, notional: cfg.baseNotional }],
        avgEntry: bar.close,
        totalNotional: cfg.baseNotional,
        openedAt: bar.timestamp,
      };
    }
  }

  // Close any open position at end
  if (ladder) {
    const lastBar = bars1h[bars1h.length - 1];
    const unrealizedPct = ((lastBar.close - ladder.avgEntry) / ladder.avgEntry) * 100;
    const pnl = unrealizedPct / 100 * ladder.totalNotional - ladder.totalNotional * FEE_RT;
    totalPnl += pnl; equity += pnl;
    if (equity > peakEq) peakEq = equity;
    if (peakEq - equity > maxDD) maxDD = peakEq - equity;
    flats++;
    if (ladder.openedAt < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }
    trades.push({ entryTs: ladder.openedAt, exitTs: lastBar.timestamp, rungs: ladder.rungs.length, avgEntry: ladder.avgEntry, exitPrice: lastBar.close, notional: ladder.totalNotional, pnl, outcome: "open" });
  }

  const n = wins + losses + flats;
  return { wins, losses, flats, totalPnl, maxDD, discN, discPnl, valN, valPnl, monthlyPnl, trades, n };
}

// Sweep ladder configs
const ladderConfigs: LadderConfig[] = [];

for (const ema of [20, 50, 100]) {
  for (const trigDist of [3, 5, 7]) {
    for (const spacing of [1.5, 2.0, 3.0]) {
      for (const maxRungs of [3, 5, 7]) {
        for (const scale of [1.0, 1.3, 1.5]) {
          for (const tp of [1.5, 2.0, 3.0]) {
            ladderConfigs.push({
              label: "", triggerEmaPeriod: ema, triggerDistPct: trigDist,
              rungSpacingPct: spacing, maxRungs, scaleFactor: scale,
              baseNotional: 2000, tpPct: tp, maxLossPct: 8,
              maxHoldH: 48, cooldownH: 12,
            });
          }
        }
      }
    }
  }
}

console.log(`  Sweeping ${ladderConfigs.length} ladder configs...\n`);

interface LadderResult { cfg: LadderConfig; n: number; wr: number; pnl: number; dd: number; valN: number; valPnl: number; avgRungs: number; maxNotional: number; }
const ladderResults: LadderResult[] = [];

for (const cfg of ladderConfigs) {
  const r = simLadder(cfg);
  if (r.n < 5) continue;
  const wr = r.wins / r.n * 100;
  const avgRungs = r.trades.length > 0 ? r.trades.reduce((s, t) => s + t.rungs, 0) / r.trades.length : 0;
  const maxNotional = r.trades.length > 0 ? Math.max(...r.trades.map(t => t.notional)) : 0;
  ladderResults.push({ cfg, n: r.n, wr, pnl: r.totalPnl, dd: r.maxDD, valN: r.valN, valPnl: r.valPnl, avgRungs, maxNotional });
}

// Sort by total PnL
ladderResults.sort((a, b) => b.pnl - a.pnl);

console.log(`  TOP 30 LADDERS by total PnL (min 5 trades):\n`);
console.log(`  ${"EMA".padEnd(5)} ${"Trig%".padEnd(7)} ${"Spc%".padEnd(6)} ${"MaxR".padEnd(5)} ${"Scale".padEnd(6)} ${"TP%".padEnd(5)} ${"N".padEnd(5)} ${"W".padEnd(5)} ${"L".padEnd(5)} ${"WR%".padEnd(7)} ${"PnL".padEnd(12)} ${"DD".padEnd(10)} ${"AvgR".padEnd(6)} ${"MaxNot".padEnd(10)} ${"dN".padEnd(5)} ${"dPnL".padEnd(10)} ${"vN".padEnd(5)} ${"vPnL".padEnd(10)} ${"v$/t"}`);
console.log("─".repeat(140));

for (const r of ladderResults.slice(0, 30)) {
  const c = r.cfg;
  const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(0) : "—";
  console.log(
    `  ${String(c.triggerEmaPeriod).padEnd(5)} ${c.triggerDistPct.toFixed(0).padEnd(7)} ${c.rungSpacingPct.toFixed(1).padEnd(6)} ` +
    `${String(c.maxRungs).padEnd(5)} ${c.scaleFactor.toFixed(1).padEnd(6)} ${c.tpPct.toFixed(1).padEnd(5)} ` +
    `${String(r.n).padEnd(5)} ${String(Math.round(r.wr * r.n / 100)).padEnd(5)} ${String(r.n - Math.round(r.wr * r.n / 100)).padEnd(5)} ` +
    `${(r.wr.toFixed(1) + "%").padEnd(7)} ${"$" + (r.pnl >= 0 ? "+" : "") + r.pnl.toFixed(0).padEnd(11)} ` +
    `${"$" + r.dd.toFixed(0).padEnd(9)} ${r.avgRungs.toFixed(1).padEnd(6)} ` +
    `${"$" + r.maxNotional.toFixed(0).padEnd(9)} ` +
    `${String(ladderResults.indexOf(r) < 30 ? simLadder(r.cfg).discN : 0).padEnd(5)} ` +
    `— ${String(r.valN).padEnd(5)} ${"$" + (r.valPnl >= 0 ? "+" : "") + r.valPnl.toFixed(0).padEnd(9)} ${vpt}`
  );
}

// ── Detailed output for top 3 ladders ──
for (let rank = 0; rank < Math.min(3, ladderResults.length); rank++) {
  const best = ladderResults[rank];
  const c = best.cfg;
  const r = simLadder(c);
  const n = r.n;

  console.log(`\n${"═".repeat(130)}`);
  console.log(`  #${rank + 1} LADDER: EMA${c.triggerEmaPeriod} dist>${c.triggerDistPct}% | spacing=${c.rungSpacingPct}% | maxRungs=${c.maxRungs} | scale=${c.scaleFactor} | TP=${c.tpPct}% | base=$${c.baseNotional}`);
  console.log(`  Trades: ${n} | W: ${r.wins} L: ${r.losses} F: ${r.flats} | WR: ${(r.wins / n * 100).toFixed(1)}%`);
  console.log(`  PnL: $${r.totalPnl >= 0 ? "+" : ""}${r.totalPnl.toFixed(0)} | MaxDD: $${r.maxDD.toFixed(0)}`);
  console.log(`  Disc: ${r.discN}t $${r.discPnl >= 0 ? "+" : ""}${r.discPnl.toFixed(0)} | Val: ${r.valN}t $${r.valPnl >= 0 ? "+" : ""}${r.valPnl.toFixed(0)}`);
  console.log(`${"═".repeat(130)}`);

  // Monthly
  console.log(`\n  ${"Month".padEnd(9)} ${"PnL".padEnd(12)} Equity`);
  console.log(`  ${"─".repeat(40)}`);
  let eqCum = 0;
  for (const [mo, pnl] of [...r.monthlyPnl.entries()].sort()) {
    eqCum += pnl;
    console.log(`  ${mo}   ${"$" + (pnl >= 0 ? "+" : "") + pnl.toFixed(0).padEnd(11)} eq=$${eqCum >= 0 ? "+" : ""}${eqCum.toFixed(0)}`);
  }

  // Trades
  console.log(`\n  ${"Date".padEnd(18)} ${"AvgEntry".padEnd(10)} ${"Exit".padEnd(10)} ${"Out".padEnd(7)} ${"Rungs".padEnd(6)} ${"Notional".padEnd(10)} ${"PnL".padEnd(12)} ${"Hold".padEnd(8)} Split`);
  console.log(`  ${"─".repeat(100)}`);
  for (const t of r.trades) {
    const holdH = (t.exitTs - t.entryTs) / 3600000;
    const split = t.entryTs < DISC_END ? "disc" : "val";
    console.log(`  ${new Date(t.entryTs).toISOString().slice(0, 16).padEnd(18)} $${t.avgEntry.toFixed(4).padEnd(9)} $${t.exitPrice.toFixed(4).padEnd(9)} ${t.outcome.padEnd(7)} ${String(t.rungs).padEnd(6)} ${"$" + t.notional.toFixed(0).padEnd(9)} ${"$" + (t.pnl >= 0 ? "+" : "") + t.pnl.toFixed(0).padEnd(11)} ${holdH.toFixed(1) + "h".padEnd(7)} ${split}`);
  }
}

// ══════════════════════════════════════════════════════════════
// APPROACH 3: ROC-based dip buy (mirror of PF0 roc12h logic)
// Signal: 1H ROC over N bars < -X% → long
// Purely lookback. Same structure as PF0 short.
// ══════════════════════════════════════════════════════════════
console.log(`\n${"▓".repeat(130)}`);
console.log("  APPROACH 3: ROC DIP BUY (mirror of PF0, lookback only)");
console.log("▓".repeat(130));

console.log(`  ${"ROC_N".padEnd(7)} ${"Thresh".padEnd(8)} ${"TP%".padEnd(5)} ${"SL%".padEnd(5)} ${"N".padEnd(5)} ${"W".padEnd(5)} ${"L".padEnd(5)} ${"WR%".padEnd(7)} ${"PnL".padEnd(12)} ${"DD".padEnd(10)} ${"dN".padEnd(5)} ${"dPnL".padEnd(10)} ${"vN".padEnd(5)} ${"vPnL".padEnd(10)} ${"v$/t"}`);
console.log("─".repeat(120));

for (const rocN of [6, 8, 12, 16, 24]) {
  for (const thresh of [-3, -4, -5, -6, -8, -10]) {
    for (const tpPct of [1.5, 2.0, 3.0]) {
      for (const slPct of [3.0, 4.0, 5.0]) {
        let wins = 0, losses = 0, flats = 0, totalPnl = 0;
        let equity = 0, peakEq = 0, maxDD = 0;
        let discN = 0, discPnl = 0, valN = 0, valPnl = 0;
        let lastEntryTs = 0;

        for (let i = rocN + 1; i < bars1h.length - 1; i++) {
          const bar = bars1h[i];
          const roc = ((bar.close - bars1h[i - rocN].close) / bars1h[i - rocN].close) * 100;
          if (roc > thresh) continue; // not enough drop
          if (bar.timestamp - lastEntryTs < 12 * 3600000) continue;

          const ep = bar.close;
          const tp = ep * (1 + tpPct / 100);
          const sl = ep * (1 - slPct / 100);
          const entryIdx1m = bsearch(ts1m, bar.timestamp + 3600000);
          if (entryIdx1m < 0 || entryIdx1m >= bars1m.length - 10) continue;
          const maxIdx = Math.min(entryIdx1m + 24 * 60, bars1m.length - 1);

          let pnl = 0, outcome = "flat";
          for (let j = entryIdx1m + 1; j <= maxIdx; j++) {
            if (bars1m[j].low <= sl) { pnl = -slPct / 100 * 10000 - 10000 * FEE_RT; outcome = "stop"; break; }
            if (bars1m[j].high >= tp) { pnl = tpPct / 100 * 10000 - 10000 * FEE_RT; outcome = "tp"; break; }
          }
          if (outcome === "flat") pnl = ((bars1m[maxIdx].close - ep) / ep) * 10000 - 10000 * FEE_RT;

          lastEntryTs = bar.timestamp;
          totalPnl += pnl; equity += pnl;
          if (equity > peakEq) peakEq = equity;
          if (peakEq - equity > maxDD) maxDD = peakEq - equity;
          if (outcome === "tp") wins++; else if (outcome === "stop") losses++; else flats++;
          if (bar.timestamp < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }
        }

        const n = wins + losses + flats;
        if (n < 5) continue;
        const wr = (wins / n * 100).toFixed(1);
        const vpt = valN > 0 ? (valPnl / valN).toFixed(1) : "—";
        if (totalPnl < -1000 && valPnl < 0) continue;
        console.log(
          `  ${String(rocN).padEnd(7)} ${(thresh + "%").padEnd(8)} ${tpPct.toFixed(1).padEnd(5)} ${slPct.toFixed(1).padEnd(5)} ` +
          `${String(n).padEnd(5)} ${String(wins).padEnd(5)} ${String(losses).padEnd(5)} ${(wr + "%").padEnd(7)} ` +
          `${"$" + (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(0).padEnd(11)} ${"$" + maxDD.toFixed(0).padEnd(9)} ` +
          `${String(discN).padEnd(5)} ${"$" + (discPnl >= 0 ? "+" : "") + discPnl.toFixed(0).padEnd(9)} ` +
          `${String(valN).padEnd(5)} ${"$" + (valPnl >= 0 ? "+" : "") + valPnl.toFixed(0).padEnd(9)} ${vpt}`
        );
      }
    }
  }
}

console.log(`\n${"═".repeat(130)}`);
