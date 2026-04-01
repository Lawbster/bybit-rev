import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Side-by-side: Current Live vs Proposed vs Staged Stale
// With losing-month drill-down
// ─────────────────────────────────────────────

interface StaleTier { hoursMin: number; hoursMax: number; tp: number; }

interface Cfg {
  label: string;
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number; feeRate: number;
  startDate: string; hardFlattenHours: number;
  hardFlattenPct: number; emergencyKillPct: number; fundingRate8h: number;
  // Simple stale (single tier) — kept for backward compat
  staleHours: number; reducedTpPct: number;
  // Staged stale (multi-tier) — takes precedence when set
  staleTiers?: StaleTier[];
}

function buildTrendGate(candles: Candle[]) {
  const period = 4 * 3600000;
  const bars: { ts: number; close: number }[] = [];
  let curBar = -1, lastClose = 0, lastTs = 0;
  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period);
    if (bar !== curBar) { if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose }); curBar = bar; }
    lastClose = c.close; lastTs = c.timestamp;
  }
  if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });
  const ema = (d: number[], p: number) => { const k = 2 / (p + 1); const r = [d[0]]; for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k)); return r; };
  const closes = bars.map(b => b.close), e200 = ema(closes, 200), e50 = ema(closes, 50);
  const hostile = new Map<number, boolean>();
  for (let i = 1; i < bars.length; i++) {
    hostile.set(Math.floor(bars[i].ts / period) * period, closes[i] < e200[i] && e50[i] < e50[i - 1]);
  }
  return hostile;
}

function isHostile(gate: Map<number, boolean>, ts: number) {
  const p = 4 * 3600000;
  return gate.get(Math.floor(ts / p) * p - p) ?? false;
}

interface LadderExit {
  month: string;
  openTs: number; closeTs: number;
  avgEntry: number; exitPrice: number;
  positions: number; totalNotional: number;
  holdHours: number;
  exitType: "batchTP" | "staleTP" | "hardFlat" | "emKill" | "eod";
  staleTier?: string;
  grossPnl: number; fees: number; funding: number; netPnl: number;
  tpPctUsed: number;
  // for opportunity cost: max price in next 24h after exit
  maxPrice24h?: number;
  missedPnlPct?: number;
}

interface Result {
  capital: number; trades: number; wins: number; totalFees: number; totalFund: number;
  maxDD: number; minEq: number; peakCap: number;
  batchTP: number; staleTP: number; hardFlat: number; emKill: number; trendBlk: number;
  monthly: Record<string, { pnl: number; trades: number; wins: number }>;
  maxHoldHours: number; avgHoldHours: number;
  ladderExits: LadderExit[];
}

function getStaleTP(cfg: Cfg, ageHours: number, avgPnl: number): { isStale: boolean; tp: number; tierLabel: string } {
  // Staged stale takes precedence
  if (cfg.staleTiers && cfg.staleTiers.length > 0) {
    // Find the most aggressive tier that applies (latest matching tier)
    let bestTier: StaleTier | null = null;
    for (const t of cfg.staleTiers) {
      if (ageHours >= t.hoursMin && (t.hoursMax === Infinity || ageHours < t.hoursMax) && avgPnl < 0) {
        bestTier = t;
      }
    }
    if (bestTier) {
      return { isStale: true, tp: bestTier.tp, tierLabel: `${bestTier.hoursMin}h→${bestTier.tp}%` };
    }
    return { isStale: false, tp: cfg.tpPct, tierLabel: "" };
  }
  // Simple single-tier fallback
  if (cfg.staleHours > 0 && ageHours >= cfg.staleHours && avgPnl < 0) {
    return { isStale: true, tp: cfg.reducedTpPct, tierLabel: `${cfg.staleHours}h→${cfg.reducedTpPct}%` };
  }
  return { isStale: false, tp: cfg.tpPct, tierLabel: "" };
}

function run(candles: Candle[], cfg: Cfg): Result {
  const gate = buildTrendGate(candles);
  let capital = cfg.initialCapital, peakCap = capital, maxDD = 0, minEq = capital;
  const pos: { ep: number; et: number; qty: number; notional: number }[] = [];
  let lastAdd = 0, trades = 0, wins = 0, totalFees = 0, totalFund = 0;
  let batchTP = 0, staleTP = 0, hardFlat = 0, emKill = 0, trendBlk = 0;
  let totalHoldMs = 0, maxHoldMs = 0;
  const startTs = new Date(cfg.startDate).getTime();
  const monthly: Record<string, { pnl: number; trades: number; wins: number }> = {};
  const ladderExits: LadderExit[] = [];

  // Build candle index for opportunity cost lookups
  const candleByIdx = new Map<number, number>(); // timestamp -> index
  for (let i = 0; i < candles.length; i++) candleByIdx.set(candles[i].timestamp, i);

  function getMax24h(fromIdx: number): number {
    let maxP = 0;
    const end = Math.min(fromIdx + 288, candles.length); // 288 x 5min = 24h
    for (let j = fromIdx; j < end; j++) {
      if (candles[j].high > maxP) maxP = candles[j].high;
    }
    return maxP;
  }

  function closeLadder(price: number, ts: number, exitType: LadderExit["exitType"], tpUsed: number, tierLabel: string) {
    const m = new Date(ts).toISOString().slice(0, 7);
    if (!monthly[m]) monthly[m] = { pnl: 0, trades: 0, wins: 0 };
    const tQty = pos.reduce((s, p) => s + p.qty, 0);
    const avgE = pos.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
    const totalNot = pos.reduce((s, p) => s + p.notional, 0);
    let ladderGross = 0, ladderFees = 0, ladderFund = 0;
    for (const p of pos) {
      const raw = (price - p.ep) * p.qty;
      const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
      const holdMs = ts - p.et;
      const fund = p.notional * cfg.fundingRate8h * (holdMs / (8 * 3600000));
      const pnl = raw - fees - fund;
      capital += pnl; totalFees += fees; totalFund += fund; trades++;
      totalHoldMs += holdMs;
      if (holdMs > maxHoldMs) maxHoldMs = holdMs;
      if (pnl > 0) { wins++; monthly[m].wins++; }
      monthly[m].trades++; monthly[m].pnl += pnl;
      ladderGross += raw; ladderFees += fees; ladderFund += fund;
    }
    // Opportunity cost: find max price in next 24h
    const curIdx = candleByIdx.get(ts);
    const max24h = curIdx !== undefined ? getMax24h(curIdx) : undefined;
    const missedPct = max24h && avgE > 0 ? ((max24h - avgE) / avgE) * 100 : undefined;
    ladderExits.push({
      month: m, openTs: pos[0].et, closeTs: ts,
      avgEntry: avgE, exitPrice: price,
      positions: pos.length, totalNotional: totalNot,
      holdHours: (ts - pos[0].et) / 3600000,
      exitType, staleTier: tierLabel,
      grossPnl: ladderGross, fees: ladderFees, funding: ladderFund,
      netPnl: ladderGross - ladderFees - ladderFund,
      tpPctUsed: tpUsed,
      maxPrice24h: max24h,
      missedPnlPct: missedPct,
    });
    pos.length = 0;
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp < startTs) continue;
    const { close, high, timestamp: ts } = c;

    if (pos.length > 0) {
      const tQty = pos.reduce((s, p) => s + p.qty, 0);
      const avgE = pos.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPnl = ((close - avgE) / avgE) * 100;
      const oldH = (ts - pos[0].et) / 3600000;
      const stale = getStaleTP(cfg, oldH, avgPnl);
      const tpPrice = avgE * (1 + stale.tp / 100);
      if (high >= tpPrice) {
        if (stale.isStale) staleTP++; else batchTP++;
        closeLadder(tpPrice, ts, stale.isStale ? "staleTP" : "batchTP", stale.tp, stale.tierLabel);
        continue;
      }
      if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) { emKill++; closeLadder(close, ts, "emKill", 0, ""); continue; }
      if (cfg.hardFlattenHours > 0 && oldH >= cfg.hardFlattenHours && avgPnl <= cfg.hardFlattenPct && isHostile(gate, ts)) { hardFlat++; closeLadder(close, ts, "hardFlat", 0, ""); continue; }
    }

    const ur = pos.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const eq = capital + ur;
    if (eq < minEq) minEq = eq;
    if (eq > peakCap) peakCap = eq;
    const dd = peakCap > 0 ? ((peakCap - eq) / peakCap) * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    const gap = (ts - lastAdd) / 60000;
    if (pos.length < cfg.maxPositions && gap >= cfg.addIntervalMin) {
      if (isHostile(gate, ts)) { trendBlk++; }
      else {
        const lvl = pos.length;
        const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, lvl);
        const margin = notional / cfg.leverage;
        const used = pos.reduce((s, p) => s + p.notional / cfg.leverage, 0);
        if (capital - used >= margin && capital > 0) {
          pos.push({ ep: close, et: ts, qty: notional / close, notional });
          lastAdd = ts;
        }
      }
    }
  }
  if (pos.length > 0) { const l = candles[candles.length - 1]; closeLadder(l.close, l.timestamp, "eod", 0, ""); }

  return {
    capital, trades, wins, totalFees, totalFund, maxDD, minEq, peakCap,
    batchTP, staleTP, hardFlat, emKill, trendBlk, monthly, ladderExits,
    maxHoldHours: maxHoldMs / 3600000,
    avgHoldHours: trades > 0 ? (totalHoldMs / trades) / 3600000 : 0,
  };
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
console.log(`HYPE ${candles.length} candles, ${new Date(candles[0].timestamp).toISOString().slice(0, 10)} to ${new Date(candles[candles.length - 1].timestamp).toISOString().slice(0, 10)}\n`);

const BASE: Omit<Cfg, "label" | "staleHours" | "reducedTpPct"> = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 5000, feeRate: 0.00055,
  startDate: "2025-01-20",
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
};

const configs: Cfg[] = [
  { ...BASE, label: "A: Current Live (20h/0.9%)", staleHours: 20, reducedTpPct: 0.9 },
  { ...BASE, label: "B: Simple 8h/0.3%",          staleHours: 8,  reducedTpPct: 0.3 },
  { ...BASE, label: "C: Staged 8h+16h",           staleHours: 0,  reducedTpPct: 0,
    staleTiers: [
      { hoursMin: 8,  hoursMax: 16,       tp: 0.5 },
      { hoursMin: 16, hoursMax: Infinity,  tp: 0.3 },
    ]},
  { ...BASE, label: "D: Staged 8h+12h+20h",       staleHours: 0,  reducedTpPct: 0,
    staleTiers: [
      { hoursMin: 8,  hoursMax: 12,       tp: 0.7 },
      { hoursMin: 12, hoursMax: 20,       tp: 0.5 },
      { hoursMin: 20, hoursMax: Infinity,  tp: 0.3 },
    ]},
  { ...BASE, label: "E: Staged 6h+12h",           staleHours: 0,  reducedTpPct: 0,
    staleTiers: [
      { hoursMin: 6,  hoursMax: 12,       tp: 0.5 },
      { hoursMin: 12, hoursMax: Infinity,  tp: 0.3 },
    ]},
];

const results = configs.map(cfg => ({ cfg, r: run(candles, cfg) }));

// ── Summary table ──
console.log("=".repeat(120));
console.log("  SIDE-BY-SIDE COMPARISON — SIMPLE vs STAGED STALE");
console.log("=".repeat(120));
console.log("");

console.log("What changed: only stale trigger time and reduced TP%");
console.log("Everything else identical: 1.4% TP, 50x, 11 max, 30min adds, $800 base, 1.2x scale");
console.log("Trend gate ON, hard flatten 40h/-6%, emergency kill -10%\n");

const W = 22;
console.log("".padEnd(25) + results.map(({ cfg }) => cfg.label.padStart(W)).join(""));
console.log("-".repeat(25 + results.length * W));

const row = (label: string, fn: (r: Result, c: Cfg) => string) => {
  let line = label.padEnd(25);
  for (const { r, cfg } of results) line += fn(r, cfg).padStart(W);
  console.log(line);
};

row("Stale config", (_, c) => {
  if (c.staleTiers) return c.staleTiers.map(t => `${t.hoursMin}h→${t.tp}%`).join(" / ");
  return `${c.staleHours}h→${c.reducedTpPct}%`;
});
row("", () => "");
row("Return", (r, c) => ((r.capital / c.initialCapital - 1) * 100).toFixed(1) + "%");
row("Final Capital", (r) => "$" + r.capital.toFixed(0));
row("Max Drawdown", r => r.maxDD.toFixed(1) + "%");
row("Min Equity", r => "$" + r.minEq.toFixed(0));
row("", () => "");
row("Total Trades", r => String(r.trades));
row("Win Rate", r => (r.wins / r.trades * 100).toFixed(0) + "%");
row("Batch TPs", r => String(r.batchTP));
row("Stale TPs", r => String(r.staleTP));
row("Hard Flattens", r => String(r.hardFlat));
row("Emergency Kills", r => String(r.emKill));
row("", () => "");
row("Avg Hold (hours)", r => r.avgHoldHours.toFixed(1) + "h");
row("Max Hold (hours)", r => r.maxHoldHours.toFixed(1) + "h");
row("Trading Fees", r => "$" + r.totalFees.toFixed(0));
row("Funding Fees", r => "$" + r.totalFund.toFixed(0));

// ── Monthly comparison ──
console.log("\n" + "=".repeat(120));
console.log("  MONTHLY PnL");
console.log("=".repeat(120) + "\n");

const allMonths = new Set(results.flatMap(({ r }) => Object.keys(r.monthly)));
console.log("Month".padEnd(12) + results.map(({ cfg }) => cfg.label.padStart(W)).join("") + "  B-A".padStart(10) + "  C-A".padStart(10));
console.log("-".repeat(12 + results.length * W + 20));

for (const m of [...allMonths].sort()) {
  let line = m.padEnd(12);
  const vals: number[] = [];
  for (const { r } of results) {
    const pnl = r.monthly[m]?.pnl || 0;
    vals.push(pnl);
    line += ("$" + pnl.toFixed(0)).padStart(W);
  }
  const deltaB = vals[1] - vals[0];
  const deltaC = vals[2] - vals[0];
  const markerB = deltaB > 500 ? " +" : deltaB < -500 ? " -" : "  ";
  const markerC = deltaC > 500 ? " +" : deltaC < -500 ? " -" : "  ";
  line += (markerB + "$" + deltaB.toFixed(0)).padStart(10);
  line += (markerC + "$" + deltaC.toFixed(0)).padStart(10);
  console.log(line);
}

console.log("-".repeat(12 + results.length * W + 20));
let totLine = "TOTAL".padEnd(12);
for (const { r, cfg } of results) {
  totLine += ("$" + (r.capital - cfg.initialCapital).toFixed(0)).padStart(W);
}
const dB = (results[1].r.capital - results[1].cfg.initialCapital) - (results[0].r.capital - results[0].cfg.initialCapital);
const dC = (results[2].r.capital - results[2].cfg.initialCapital) - (results[0].r.capital - results[0].cfg.initialCapital);
totLine += ("$" + dB.toFixed(0)).padStart(10) + ("$" + dC.toFixed(0)).padStart(10);
console.log(totLine);

// ── Losing month drill-down ──
console.log("\n" + "=".repeat(120));
console.log("  LOSING MONTH DRILL-DOWN (months where B or C underperform A)");
console.log("=".repeat(120));

// Find months where proposed configs lose vs baseline
const losingMonths: string[] = [];
for (const m of [...allMonths].sort()) {
  const pnlA = results[0].r.monthly[m]?.pnl || 0;
  const pnlB = results[1].r.monthly[m]?.pnl || 0;
  const pnlC = results[2].r.monthly[m]?.pnl || 0;
  if (pnlB < pnlA - 200 || pnlC < pnlA - 200) losingMonths.push(m);
}

for (const m of losingMonths) {
  console.log(`\n${"─".repeat(100)}`);
  console.log(`  ${m}`);
  console.log(`${"─".repeat(100)}`);

  const pnlA = results[0].r.monthly[m]?.pnl || 0;
  const pnlB = results[1].r.monthly[m]?.pnl || 0;
  const pnlC = results[2].r.monthly[m]?.pnl || 0;
  console.log(`  A(current)=$${pnlA.toFixed(0)}  B(simple)=$${pnlB.toFixed(0)} (${pnlB-pnlA>=0?"+":""}${(pnlB-pnlA).toFixed(0)})  C(staged)=$${pnlC.toFixed(0)} (${pnlC-pnlA>=0?"+":""}${(pnlC-pnlA).toFixed(0)})`);

  // Show stale exits in this month for each config with opportunity cost
  for (const { cfg, r } of results) {
    const staleExits = r.ladderExits.filter(e => e.month === m && e.exitType === "staleTP");
    const hardFlats = r.ladderExits.filter(e => e.month === m && e.exitType === "hardFlat");
    const emKills = r.ladderExits.filter(e => e.month === m && e.exitType === "emKill");

    if (staleExits.length > 0 || hardFlats.length > 0 || emKills.length > 0) {
      console.log(`\n  [${cfg.label}]`);

      for (const e of staleExits) {
        const date = new Date(e.closeTs).toISOString().slice(0, 16);
        const wouldHit = e.missedPnlPct !== undefined && e.missedPnlPct >= 1.4;
        const missedStr = e.missedPnlPct !== undefined
          ? `max24h=${e.missedPnlPct.toFixed(2)}% ${wouldHit ? "*** WOULD HAVE HIT 1.4% TP ***" : ""}`
          : "";
        console.log(`    STALE EXIT ${date} | ${e.positions}pos $${e.totalNotional.toFixed(0)} | held ${e.holdHours.toFixed(1)}h | tp=${e.tpPctUsed}% ${e.staleTier} | net=$${e.netPnl.toFixed(0)} (fees=$${e.fees.toFixed(0)} fund=$${e.funding.toFixed(0)}) | ${missedStr}`);
      }
      for (const e of hardFlats) {
        const date = new Date(e.closeTs).toISOString().slice(0, 16);
        console.log(`    HARD FLAT  ${date} | ${e.positions}pos $${e.totalNotional.toFixed(0)} | held ${e.holdHours.toFixed(1)}h | net=$${e.netPnl.toFixed(0)}`);
      }
      for (const e of emKills) {
        const date = new Date(e.closeTs).toISOString().slice(0, 16);
        console.log(`    EM KILL    ${date} | ${e.positions}pos $${e.totalNotional.toFixed(0)} | held ${e.holdHours.toFixed(1)}h | net=$${e.netPnl.toFixed(0)}`);
      }
    }
  }

  // Show ALL ladder exits in this month for config A vs B to understand the full picture
  console.log(`\n  All ladder exits this month:`);
  for (const { cfg, r } of [results[0], results[1], results[2]]) {
    const exits = r.ladderExits.filter(e => e.month === m);
    const totalNet = exits.reduce((s, e) => s + e.netPnl, 0);
    const byType: Record<string, number> = {};
    for (const e of exits) {
      byType[e.exitType] = (byType[e.exitType] || 0) + 1;
    }
    const typeStr = Object.entries(byType).map(([k, v]) => `${k}:${v}`).join(" ");
    console.log(`    ${cfg.label}: ${exits.length} ladders, net=$${totalNet.toFixed(0)} | ${typeStr}`);
  }
}

// ── Stale exit opportunity cost summary ──
console.log("\n" + "=".repeat(120));
console.log("  STALE EXIT OPPORTUNITY COST ANALYSIS");
console.log("=".repeat(120) + "\n");

for (const { cfg, r } of results) {
  const stales = r.ladderExits.filter(e => e.exitType === "staleTP");
  if (stales.length === 0) continue;

  const wouldHitFull = stales.filter(e => e.missedPnlPct !== undefined && e.missedPnlPct >= 1.4);
  const avgMissed = stales.reduce((s, e) => s + (e.missedPnlPct || 0), 0) / stales.length;
  const totalStaleNet = stales.reduce((s, e) => s + e.netPnl, 0);
  const avgStaleNet = totalStaleNet / stales.length;
  const avgHold = stales.reduce((s, e) => s + e.holdHours, 0) / stales.length;
  const avgFees = stales.reduce((s, e) => s + e.fees, 0) / stales.length;
  const avgFund = stales.reduce((s, e) => s + e.funding, 0) / stales.length;
  const negativeNet = stales.filter(e => e.netPnl < 0);

  console.log(`[${cfg.label}]`);
  console.log(`  Total stale exits: ${stales.length}`);
  console.log(`  Would have hit full 1.4% TP within 24h: ${wouldHitFull.length} (${(wouldHitFull.length/stales.length*100).toFixed(0)}%)`);
  console.log(`  Avg max reachable in 24h after exit: ${avgMissed.toFixed(2)}%`);
  console.log(`  Avg stale net PnL: $${avgStaleNet.toFixed(2)} (total: $${totalStaleNet.toFixed(0)})`);
  console.log(`  Avg hold hours at stale exit: ${avgHold.toFixed(1)}h`);
  console.log(`  Avg fees per stale: $${avgFees.toFixed(2)} | Avg funding: $${avgFund.toFixed(2)}`);
  console.log(`  Net-negative stale exits: ${negativeNet.length} (${(negativeNet.length/stales.length*100).toFixed(0)}%)`);
  if (negativeNet.length > 0) {
    const totalLoss = negativeNet.reduce((s, e) => s + e.netPnl, 0);
    console.log(`    Total loss from net-negative stales: $${totalLoss.toFixed(0)}`);
  }
  console.log("");
}
