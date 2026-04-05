// sim-ladder-sui-deep.ts — Deep dive on EMA20 dip ladder
// Stress test exposure, tighten params, month-by-month, risk analysis
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
const ts1m = bars1m.map(b => b.timestamp);

console.log(`SUI: ${new Date(bars1m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(bars1m[bars1m.length - 1].timestamp).toISOString().slice(0, 10)} | current: $${bars1h[bars1h.length - 1].close.toFixed(4)}\n`);

const closes1h = bars1h.map(b => b.close);
const ema20 = EMA.calculate({ period: 20, values: closes1h });
const ema50 = EMA.calculate({ period: 50, values: closes1h });
const OFF20 = closes1h.length - ema20.length;
const OFF50 = closes1h.length - ema50.length;

const DISC_END = new Date("2026-01-01").getTime();
const FEE_RT = 0.0011;

function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

// ── Ladder sim ──
interface LCfg {
  emaPeriod: number;
  trigDistPct: number;
  rungSpacingPct: number;
  maxRungs: number;
  scaleFactor: number;
  baseNotional: number;
  tpPct: number;
  maxLossPct: number;
  maxHoldH: number;
  cooldownH: number;
}

interface TradeRecord {
  entryTs: number; exitTs: number; rungs: number;
  avgEntry: number; exitPrice: number;
  totalNotional: number; maxNotional: number;
  pnl: number; outcome: string;
  peakUnrealized: number; // worst unrealized % before exit
  holdH: number;
}

function calcMaxNotional(base: number, scale: number, maxRungs: number): number {
  let total = 0, rung = base;
  for (let i = 0; i < maxRungs; i++) { total += rung; rung *= scale; }
  return total;
}

function simLadder(cfg: LCfg) {
  const emaArr = cfg.emaPeriod === 20 ? ema20 : ema50;
  const off = cfg.emaPeriod === 20 ? OFF20 : OFF50;

  interface LadderState {
    rungs: { price: number; notional: number }[];
    avgEntry: number; totalNotional: number; openedAt: number;
    peakUnrealized: number;
  }

  let ladder: LadderState | null = null;
  let lastCloseTs = 0;
  let totalPnl = 0, equity = 0, peakEq = 0, maxDD = 0;
  let wins = 0, losses = 0, flats = 0;
  let discN = 0, discPnl = 0, valN = 0, valPnl = 0;
  const trades: TradeRecord[] = [];
  const monthlyPnl = new Map<string, { pnl: number; n: number; w: number; l: number }>();

  for (let i = Math.max(off, 50) + 1; i < bars1h.length - 1; i++) {
    const bar = bars1h[i];
    if (i < off) continue;
    const ema = emaArr[i - off];
    const dist = ((bar.close - ema) / ema) * 100;

    if (ladder) {
      const unrealizedPct = ((bar.close - ladder.avgEntry) / ladder.avgEntry) * 100;
      if (unrealizedPct < ladder.peakUnrealized) ladder.peakUnrealized = unrealizedPct;

      // TP check
      const tpPrice = ladder.avgEntry * (1 + cfg.tpPct / 100);
      if (bar.high >= tpPrice) {
        const pnl = cfg.tpPct / 100 * ladder.totalNotional - ladder.totalNotional * FEE_RT;
        totalPnl += pnl; equity += pnl;
        if (equity > peakEq) peakEq = equity;
        if (peakEq - equity > maxDD) maxDD = peakEq - equity;
        wins++;
        const mo = new Date(bar.timestamp).toISOString().slice(0, 7);
        const ms = monthlyPnl.get(mo) ?? { pnl: 0, n: 0, w: 0, l: 0 }; ms.pnl += pnl; ms.n++; ms.w++; monthlyPnl.set(mo, ms);
        if (ladder.openedAt < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }
        trades.push({ entryTs: ladder.openedAt, exitTs: bar.timestamp, rungs: ladder.rungs.length, avgEntry: ladder.avgEntry, exitPrice: tpPrice, totalNotional: ladder.totalNotional, maxNotional: ladder.totalNotional, pnl, outcome: "tp", peakUnrealized: ladder.peakUnrealized, holdH: (bar.timestamp - ladder.openedAt) / 3600000 });
        lastCloseTs = bar.timestamp; ladder = null; continue;
      }

      // Hard stop
      if (unrealizedPct < -cfg.maxLossPct) {
        const pnl = unrealizedPct / 100 * ladder.totalNotional - ladder.totalNotional * FEE_RT;
        totalPnl += pnl; equity += pnl;
        if (equity > peakEq) peakEq = equity;
        if (peakEq - equity > maxDD) maxDD = peakEq - equity;
        losses++;
        const mo = new Date(bar.timestamp).toISOString().slice(0, 7);
        const ms = monthlyPnl.get(mo) ?? { pnl: 0, n: 0, w: 0, l: 0 }; ms.pnl += pnl; ms.n++; ms.l++; monthlyPnl.set(mo, ms);
        if (ladder.openedAt < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }
        trades.push({ entryTs: ladder.openedAt, exitTs: bar.timestamp, rungs: ladder.rungs.length, avgEntry: ladder.avgEntry, exitPrice: bar.close, totalNotional: ladder.totalNotional, maxNotional: ladder.totalNotional, pnl, outcome: "stop", peakUnrealized: ladder.peakUnrealized, holdH: (bar.timestamp - ladder.openedAt) / 3600000 });
        lastCloseTs = bar.timestamp; ladder = null; continue;
      }

      // Max hold expiry
      if ((bar.timestamp - ladder.openedAt) / 3600000 > cfg.maxHoldH) {
        const pnl = unrealizedPct / 100 * ladder.totalNotional - ladder.totalNotional * FEE_RT;
        totalPnl += pnl; equity += pnl;
        if (equity > peakEq) peakEq = equity;
        if (peakEq - equity > maxDD) maxDD = peakEq - equity;
        if (pnl > 0) wins++; else losses++;
        const mo = new Date(bar.timestamp).toISOString().slice(0, 7);
        const ms = monthlyPnl.get(mo) ?? { pnl: 0, n: 0, w: 0, l: 0 }; ms.pnl += pnl; ms.n++; if (pnl > 0) ms.w++; else ms.l++; monthlyPnl.set(mo, ms);
        if (ladder.openedAt < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }
        trades.push({ entryTs: ladder.openedAt, exitTs: bar.timestamp, rungs: ladder.rungs.length, avgEntry: ladder.avgEntry, exitPrice: bar.close, totalNotional: ladder.totalNotional, maxNotional: ladder.totalNotional, pnl, outcome: "expiry", peakUnrealized: ladder.peakUnrealized, holdH: (bar.timestamp - ladder.openedAt) / 3600000 });
        lastCloseTs = bar.timestamp; ladder = null; continue;
      }

      // Add rung
      if (ladder.rungs.length < cfg.maxRungs) {
        const lastRung = ladder.rungs[ladder.rungs.length - 1];
        const dropFromLast = ((bar.close - lastRung.price) / lastRung.price) * 100;
        if (dropFromLast < -cfg.rungSpacingPct) {
          const newNotional = lastRung.notional * cfg.scaleFactor;
          ladder.rungs.push({ price: bar.close, notional: newNotional });
          ladder.totalNotional += newNotional;
          let wSum = 0, nSum = 0;
          for (const r of ladder.rungs) { wSum += r.price * r.notional; nSum += r.notional; }
          ladder.avgEntry = wSum / nSum;
        }
      }
    } else {
      if (bar.timestamp - lastCloseTs < cfg.cooldownH * 3600000) continue;
      if (dist > -cfg.trigDistPct) continue;

      ladder = {
        rungs: [{ price: bar.close, notional: cfg.baseNotional }],
        avgEntry: bar.close, totalNotional: cfg.baseNotional,
        openedAt: bar.timestamp, peakUnrealized: 0,
      };
    }
  }

  // Close open
  if (ladder) {
    const lb = bars1h[bars1h.length - 1];
    const pct = ((lb.close - ladder.avgEntry) / ladder.avgEntry) * 100;
    const pnl = pct / 100 * ladder.totalNotional - ladder.totalNotional * FEE_RT;
    totalPnl += pnl; equity += pnl;
    if (equity > peakEq) peakEq = equity;
    if (peakEq - equity > maxDD) maxDD = peakEq - equity;
    flats++;
    if (ladder.openedAt < DISC_END) { discN++; discPnl += pnl; } else { valN++; valPnl += pnl; }
    trades.push({ entryTs: ladder.openedAt, exitTs: lb.timestamp, rungs: ladder.rungs.length, avgEntry: ladder.avgEntry, exitPrice: lb.close, totalNotional: ladder.totalNotional, maxNotional: ladder.totalNotional, pnl, outcome: "open", peakUnrealized: ladder.peakUnrealized, holdH: (lb.timestamp - ladder.openedAt) / 3600000 });
  }

  const n = wins + losses + flats;
  return { wins, losses, flats, totalPnl, maxDD, discN, discPnl, valN, valPnl, trades, monthlyPnl, n, equity };
}

// ══════════════════════════════════════════════════════════════
// 1. PARAM TIGHTENING — find sweet spot
// ══════════════════════════════════════════════════════════════
console.log("▓".repeat(130));
console.log("  PARAM SWEEP — base=$2000, cooldown=12h");
console.log("▓".repeat(130));
console.log(`  ${"EMA".padEnd(5)} ${"Trig%".padEnd(7)} ${"Spc%".padEnd(6)} ${"MaxR".padEnd(5)} ${"Scale".padEnd(6)} ${"TP%".padEnd(5)} ${"SL%".padEnd(5)} ${"MaxH".padEnd(5)} ${"N".padEnd(5)} ${"W".padEnd(4)} ${"L".padEnd(4)} ${"WR%".padEnd(7)} ${"PnL".padEnd(12)} ${"DD".padEnd(10)} ${"MaxNot".padEnd(10)} ${"AvgR".padEnd(6)} ${"dPnL".padEnd(10)} ${"vN".padEnd(4)} ${"vPnL".padEnd(10)} ${"v$/t"}`);
console.log("─".repeat(145));

interface SweepResult { cfg: LCfg; n: number; wr: number; pnl: number; dd: number; valN: number; valPnl: number; maxNot: number; avgRungs: number; }
const results: SweepResult[] = [];

for (const emaPeriod of [20, 50]) {
  for (const trigDist of [4, 5, 6, 7]) {
    for (const spacing of [1.0, 1.5, 2.0, 2.5]) {
      for (const maxRungs of [3, 5, 7]) {
        for (const scale of [1.0, 1.3, 1.5]) {
          for (const tp of [2.0, 2.5, 3.0]) {
            for (const maxLoss of [6, 8, 10]) {
              for (const maxHold of [24, 48, 72]) {
                const cfg: LCfg = { emaPeriod, trigDistPct: trigDist, rungSpacingPct: spacing, maxRungs, scaleFactor: scale, baseNotional: 2000, tpPct: tp, maxLossPct: maxLoss, maxHoldH: maxHold, cooldownH: 12 };
                const r = simLadder(cfg);
                if (r.n < 5) continue;
                const wr = r.wins / r.n * 100;
                const avgR = r.trades.length > 0 ? r.trades.reduce((s, t) => s + t.rungs, 0) / r.trades.length : 0;
                const maxNot = r.trades.length > 0 ? Math.max(...r.trades.map(t => t.totalNotional)) : 0;
                results.push({ cfg, n: r.n, wr, pnl: r.totalPnl, dd: r.maxDD, valN: r.valN, valPnl: r.valPnl, maxNot, avgRungs: avgR });
              }
            }
          }
        }
      }
    }
  }
}

// Top 40 by PnL with max notional cap
console.log(`\n  ${results.length} combos tested. Top 40 by PnL:\n`);
results.sort((a, b) => b.pnl - a.pnl);

for (const r of results.slice(0, 40)) {
  const c = r.cfg;
  const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(0) : "—";
  console.log(
    `  ${String(c.emaPeriod).padEnd(5)} ${c.trigDistPct.toFixed(0).padEnd(7)} ${c.rungSpacingPct.toFixed(1).padEnd(6)} ` +
    `${String(c.maxRungs).padEnd(5)} ${c.scaleFactor.toFixed(1).padEnd(6)} ${c.tpPct.toFixed(1).padEnd(5)} ${c.maxLossPct.toFixed(0).padEnd(5)} ${c.maxHoldH.toFixed(0).padEnd(5)} ` +
    `${String(r.n).padEnd(5)} ${String(Math.round(r.wr * r.n / 100)).padEnd(4)} ${String(r.n - Math.round(r.wr * r.n / 100)).padEnd(4)} ` +
    `${(r.wr.toFixed(1) + "%").padEnd(7)} ${"$" + (r.pnl >= 0 ? "+" : "") + r.pnl.toFixed(0).padEnd(11)} ` +
    `${"$" + r.dd.toFixed(0).padEnd(9)} ${"$" + r.maxNot.toFixed(0).padEnd(9)} ${r.avgRungs.toFixed(1).padEnd(6)} ` +
    `— ${String(r.valN).padEnd(4)} ${"$" + (r.valPnl >= 0 ? "+" : "") + r.valPnl.toFixed(0).padEnd(9)} ${vpt}`
  );
}

// ── Top 10 with max notional <= $20k (capital-efficient) ──
console.log(`\n  TOP 15 with MAX NOTIONAL <= $20,000 (capital-efficient):\n`);
const capped = results.filter(r => r.maxNot <= 20000).sort((a, b) => b.pnl - a.pnl).slice(0, 15);
for (const r of capped) {
  const c = r.cfg;
  const vpt = r.valN > 0 ? (r.valPnl / r.valN).toFixed(0) : "—";
  console.log(
    `  EMA${c.emaPeriod} trig=${c.trigDistPct}% spc=${c.rungSpacingPct}% maxR=${c.maxRungs} sc=${c.scaleFactor} TP=${c.tpPct}% SL=${c.maxLossPct}% hold=${c.maxHoldH}h | ` +
    `${r.n}t WR=${r.wr.toFixed(1)}% PnL=$${r.pnl >= 0 ? "+" : ""}${r.pnl.toFixed(0)} DD=$${r.dd.toFixed(0)} maxNot=$${r.maxNot.toFixed(0)} | val: ${r.valN}t $${r.valPnl >= 0 ? "+" : ""}${r.valPnl.toFixed(0)} ($${vpt}/t)`
  );
}

// ══════════════════════════════════════════════════════════════
// 2. STRESS TEST — detailed analysis of best configs
// ══════════════════════════════════════════════════════════════

function printDetailed(label: string, cfg: LCfg) {
  const r = simLadder(cfg);
  const n = r.n;
  if (n === 0) return;
  const wr = (r.wins / n * 100).toFixed(1);
  const maxTheoNotional = calcMaxNotional(cfg.baseNotional, cfg.scaleFactor, cfg.maxRungs);

  console.log(`\n${"═".repeat(130)}`);
  console.log(`  ${label}`);
  console.log(`  EMA${cfg.emaPeriod} dist>${cfg.trigDistPct}% | spacing=${cfg.rungSpacingPct}% | maxRungs=${cfg.maxRungs} | scale=${cfg.scaleFactor} | TP=${cfg.tpPct}% | SL=${cfg.maxLossPct}% | hold=${cfg.maxHoldH}h | base=$${cfg.baseNotional}`);
  console.log(`  Trades: ${n} | W: ${r.wins} L: ${r.losses} F: ${r.flats} | WR: ${wr}%`);
  console.log(`  PnL: $${r.totalPnl >= 0 ? "+" : ""}${r.totalPnl.toFixed(0)} | MaxDD: $${r.maxDD.toFixed(0)}`);
  console.log(`  Disc: ${r.discN}t $${r.discPnl >= 0 ? "+" : ""}${r.discPnl.toFixed(0)} | Val: ${r.valN}t $${r.valPnl >= 0 ? "+" : ""}${r.valPnl.toFixed(0)}`);
  console.log(`  Max theoretical notional (all ${cfg.maxRungs} rungs): $${maxTheoNotional.toFixed(0)}`);
  console.log(`${"═".repeat(130)}`);

  // Risk stats
  const rungDist = r.trades.reduce((m, t) => { m[t.rungs] = (m[t.rungs] || 0) + 1; return m; }, {} as Record<number, number>);
  console.log(`\n  RUNG DISTRIBUTION:`);
  for (const [rungs, count] of Object.entries(rungDist).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const pct = (count / n * 100).toFixed(1);
    const rungTrades = r.trades.filter(t => t.rungs === Number(rungs));
    const rungWr = (rungTrades.filter(t => t.outcome === "tp").length / rungTrades.length * 100).toFixed(0);
    const rungPnl = rungTrades.reduce((s, t) => s + t.pnl, 0);
    const avgNot = rungTrades.reduce((s, t) => s + t.totalNotional, 0) / rungTrades.length;
    console.log(`    ${rungs} rung(s): ${count} trades (${pct}%) | WR: ${rungWr}% | PnL: $${rungPnl >= 0 ? "+" : ""}${rungPnl.toFixed(0)} | avg notional: $${avgNot.toFixed(0)}`);
  }

  // Worst drawdowns
  console.log(`\n  WORST 5 TRADES (by PnL):`);
  const worst = [...r.trades].sort((a, b) => a.pnl - b.pnl).slice(0, 5);
  for (const t of worst) {
    console.log(`    ${new Date(t.entryTs).toISOString().slice(0, 16)} | ${t.rungs}R $${t.totalNotional.toFixed(0)} | avg=$${t.avgEntry.toFixed(4)} exit=$${t.exitPrice.toFixed(4)} | ${t.outcome} | pnl=$${t.pnl.toFixed(0)} | worstUnr=${t.peakUnrealized.toFixed(1)}% | ${t.holdH.toFixed(0)}h`);
  }

  // Best trades
  console.log(`\n  BEST 5 TRADES (by PnL):`);
  const best = [...r.trades].sort((a, b) => b.pnl - a.pnl).slice(0, 5);
  for (const t of best) {
    console.log(`    ${new Date(t.entryTs).toISOString().slice(0, 16)} | ${t.rungs}R $${t.totalNotional.toFixed(0)} | avg=$${t.avgEntry.toFixed(4)} exit=$${t.exitPrice.toFixed(4)} | ${t.outcome} | pnl=$${t.pnl.toFixed(0)} | ${t.holdH.toFixed(0)}h`);
  }

  // Hold time analysis
  const tpTrades = r.trades.filter(t => t.outcome === "tp");
  if (tpTrades.length > 0) {
    const avgHold = tpTrades.reduce((s, t) => s + t.holdH, 0) / tpTrades.length;
    const medHold = [...tpTrades].sort((a, b) => a.holdH - b.holdH)[Math.floor(tpTrades.length / 2)].holdH;
    const under6h = tpTrades.filter(t => t.holdH <= 6).length;
    const under12h = tpTrades.filter(t => t.holdH <= 12).length;
    console.log(`\n  TP HOLD TIME: avg=${avgHold.toFixed(1)}h | median=${medHold.toFixed(1)}h | <6h: ${under6h}/${tpTrades.length} (${(under6h / tpTrades.length * 100).toFixed(0)}%) | <12h: ${under12h}/${tpTrades.length} (${(under12h / tpTrades.length * 100).toFixed(0)}%)`);
  }

  // Monthly
  console.log(`\n  ${"Month".padEnd(9)} ${"N".padEnd(4)} ${"W".padEnd(4)} ${"L".padEnd(4)} ${"PnL".padEnd(12)} Equity     Split`);
  console.log(`  ${"─".repeat(60)}`);
  let eqCum = 0;
  for (const [mo, ms] of [...r.monthlyPnl.entries()].sort()) {
    eqCum += ms.pnl;
    const split = new Date(mo + "-01").getTime() < DISC_END ? "disc" : "val";
    console.log(`  ${mo}   ${String(ms.n).padEnd(4)} ${String(ms.w).padEnd(4)} ${String(ms.l).padEnd(4)} ${"$" + (ms.pnl >= 0 ? "+" : "") + ms.pnl.toFixed(0).padEnd(11)} eq=$${eqCum >= 0 ? "+" : ""}${eqCum.toFixed(0).padEnd(8)} ${split}`);
  }

  // All trades
  console.log(`\n  ${"Date".padEnd(18)} ${"AvgEntry".padEnd(10)} ${"Exit".padEnd(10)} ${"Out".padEnd(7)} ${"Rungs".padEnd(6)} ${"Notional".padEnd(10)} ${"PnL".padEnd(12)} ${"Hold".padEnd(8)} ${"WrstUnr%".padEnd(10)} Split`);
  console.log(`  ${"─".repeat(115)}`);
  for (const t of r.trades) {
    const split = t.entryTs < DISC_END ? "disc" : "val";
    console.log(`  ${new Date(t.entryTs).toISOString().slice(0, 16).padEnd(18)} $${t.avgEntry.toFixed(4).padEnd(9)} $${t.exitPrice.toFixed(4).padEnd(9)} ${t.outcome.padEnd(7)} ${String(t.rungs).padEnd(6)} ${"$" + t.totalNotional.toFixed(0).padEnd(9)} ${"$" + (t.pnl >= 0 ? "+" : "") + t.pnl.toFixed(0).padEnd(11)} ${t.holdH.toFixed(1) + "h".padEnd(7)} ${t.peakUnrealized.toFixed(1).padEnd(10)} ${split}`);
  }

  return r;
}

// ── Print detailed for the winners ──

// Original winner
printDetailed("ORIGINAL WINNER", { emaPeriod: 20, trigDistPct: 5, rungSpacingPct: 1.5, maxRungs: 7, scaleFactor: 1.5, baseNotional: 2000, tpPct: 3.0, maxLossPct: 8, maxHoldH: 48, cooldownH: 12 });

// Capital-capped variant (max 5 rungs, lower scale)
printDetailed("CAPITAL-CAPPED (5 rungs, 1.3x)", { emaPeriod: 20, trigDistPct: 5, rungSpacingPct: 1.5, maxRungs: 5, scaleFactor: 1.3, baseNotional: 2000, tpPct: 3.0, maxLossPct: 8, maxHoldH: 48, cooldownH: 12 });

// Tighter TP
printDetailed("TIGHTER TP=2%", { emaPeriod: 20, trigDistPct: 5, rungSpacingPct: 1.5, maxRungs: 7, scaleFactor: 1.5, baseNotional: 2000, tpPct: 2.0, maxLossPct: 8, maxHoldH: 48, cooldownH: 12 });

// Wider trigger
printDetailed("WIDER TRIGGER 7%", { emaPeriod: 20, trigDistPct: 7, rungSpacingPct: 1.5, maxRungs: 7, scaleFactor: 1.5, baseNotional: 2000, tpPct: 3.0, maxLossPct: 8, maxHoldH: 48, cooldownH: 12 });

// Equal sizing (no martingale)
printDetailed("EQUAL SIZE (scale=1.0)", { emaPeriod: 20, trigDistPct: 5, rungSpacingPct: 1.5, maxRungs: 7, scaleFactor: 1.0, baseNotional: 2000, tpPct: 3.0, maxLossPct: 8, maxHoldH: 48, cooldownH: 12 });

// EMA50, wider trigger
printDetailed("EMA50, TRIG=7%", { emaPeriod: 50, trigDistPct: 7, rungSpacingPct: 1.5, maxRungs: 7, scaleFactor: 1.5, baseNotional: 2000, tpPct: 3.0, maxLossPct: 8, maxHoldH: 48, cooldownH: 12 });

// Longer hold
printDetailed("LONGER HOLD 72h", { emaPeriod: 20, trigDistPct: 5, rungSpacingPct: 1.5, maxRungs: 7, scaleFactor: 1.5, baseNotional: 2000, tpPct: 3.0, maxLossPct: 8, maxHoldH: 72, cooldownH: 12 });

// Wider spacing
printDetailed("WIDER SPACING 2.5%", { emaPeriod: 20, trigDistPct: 5, rungSpacingPct: 2.5, maxRungs: 7, scaleFactor: 1.5, baseNotional: 2000, tpPct: 3.0, maxLossPct: 8, maxHoldH: 48, cooldownH: 12 });

// 3 rungs max, bigger base
printDetailed("3 RUNGS, BASE=$3000", { emaPeriod: 20, trigDistPct: 5, rungSpacingPct: 2.0, maxRungs: 3, scaleFactor: 1.5, baseNotional: 3000, tpPct: 3.0, maxLossPct: 8, maxHoldH: 48, cooldownH: 12 });

// Best from capped results if different
const bestCapped = results.filter(r => r.maxNot <= 20000).sort((a, b) => b.pnl - a.pnl)[0];
if (bestCapped) {
  printDetailed("BEST CAPPED ≤$20k", bestCapped.cfg);
}

console.log(`\n${"═".repeat(130)}`);
console.log("  SUMMARY: Max theoretical notional by config");
console.log("─".repeat(80));
for (const [label, maxR, scale] of [["3R×1.0", 3, 1.0], ["3R×1.3", 3, 1.3], ["3R×1.5", 3, 1.5], ["5R×1.0", 5, 1.0], ["5R×1.3", 5, 1.3], ["5R×1.5", 5, 1.5], ["7R×1.0", 7, 1.0], ["7R×1.3", 7, 1.3], ["7R×1.5", 7, 1.5]] as const) {
  const maxNot = calcMaxNotional(2000, scale, maxR);
  console.log(`  ${(label as string).padEnd(10)} base=$2000 → max notional: $${maxNot.toFixed(0)}`);
}
console.log(`${"═".repeat(130)}`);
