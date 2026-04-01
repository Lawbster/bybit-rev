import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Stale Exit Defer Gate — Recovery-Aware Stale Decision
//
// At the 8h stale checkpoint, instead of always exiting at 0.3%,
// check if recovery is underway using ONLY backward-looking,
// live-computable indicators. If recovery looks real, defer.
// If not, take the stale exit.
//
// Re-check every hour after deferral. Hard cap on total deferral.
// ─────────────────────────────────────────────

interface DeferGateCfg {
  // Recovery detection (all computed from candles available at decision time)
  bounceLookbackBars: number;     // how far back to find local low (e.g., 72 = 6h of 5min bars)
  minBouncePct: number;           // price must be this % above local low to count as recovering
  minGreenRatio: number;          // fraction of last N bars that must be green (close > open)
  greenRatioBars: number;         // lookback for green ratio
  // Deferral rules
  recheckIntervalBars: number;    // re-evaluate every N bars after initial deferral (12 = 1h)
  maxDeferHours: number;          // hard cap — after this, force stale exit regardless
  // When deferred and recovery fades, use this TP instead of 0.3
  deferredTpPct: number;          // TP to use if deferred but eventually goes stale anyway
}

interface Cfg {
  label: string;
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number; feeRate: number;
  startDate: string; staleHours: number; reducedTpPct: number; hardFlattenHours: number;
  hardFlattenPct: number; emergencyKillPct: number; fundingRate8h: number;
  deferGate?: DeferGateCfg;
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

// ── Live-computable recovery check ──
// Only uses candles[0..currentIdx], never peeks forward
function isRecovering(candles: Candle[], currentIdx: number, g: DeferGateCfg): { recovering: boolean; bouncePct: number; greenRatio: number } {
  const close = candles[currentIdx].close;

  // Find local low in lookback window
  const lookStart = Math.max(0, currentIdx - g.bounceLookbackBars);
  let localLow = Infinity;
  for (let i = lookStart; i <= currentIdx; i++) {
    if (candles[i].low < localLow) localLow = candles[i].low;
  }
  const bouncePct = localLow > 0 ? ((close - localLow) / localLow) * 100 : 0;

  // Green bar ratio in recent window
  const greenStart = Math.max(0, currentIdx - g.greenRatioBars);
  let greenCount = 0, totalBars = 0;
  for (let i = greenStart; i <= currentIdx; i++) {
    totalBars++;
    if (candles[i].close > candles[i].open) greenCount++;
  }
  const greenRatio = totalBars > 0 ? greenCount / totalBars : 0;

  const recovering = bouncePct >= g.minBouncePct && greenRatio >= g.minGreenRatio;
  return { recovering, bouncePct, greenRatio };
}

interface LadderExit {
  month: string;
  openTs: number; closeTs: number;
  holdHours: number;
  exitType: string;
  netPnl: number;
  positions: number;
  tpPctUsed: number;
  deferred: boolean;
  deferHours: number;
  bouncePctAtDecision: number;
  greenRatioAtDecision: number;
  // Opportunity cost (backward-safe: we log this for analysis, computed after sim)
  maxPrice24h?: number;
  wouldHitFullTp: boolean;
}

interface Result {
  capital: number; trades: number; wins: number; totalFees: number; totalFund: number;
  maxDD: number; minEq: number; peakCap: number;
  batchTP: number; staleTP: number; staleDeferTP: number; hardFlat: number; emKill: number; trendBlk: number;
  monthly: Record<string, { pnl: number; trades: number; wins: number }>;
  maxHoldHours: number; avgHoldHours: number;
  ladderExits: LadderExit[];
  deferCount: number; deferSuccessCount: number;
}

function run(candles: Candle[], cfg: Cfg): Result {
  const gate = buildTrendGate(candles);
  let capital = cfg.initialCapital, peakCap = capital, maxDD = 0, minEq = capital;
  const pos: { ep: number; et: number; qty: number; notional: number }[] = [];
  let lastAdd = 0, trades = 0, wins = 0, totalFees = 0, totalFund = 0;
  let batchTP = 0, staleTP = 0, staleDeferTP = 0, hardFlat = 0, emKill = 0, trendBlk = 0;
  let totalHoldMs = 0, maxHoldMs = 0;
  let deferCount = 0, deferSuccessCount = 0;
  const startTs = new Date(cfg.startDate).getTime();
  const monthly: Record<string, { pnl: number; trades: number; wins: number }> = {};
  const ladderExits: LadderExit[] = [];

  // Deferral state for current ladder
  let staleDeferred = false;
  let lastDeferCheck = 0;  // candle index of last defer evaluation

  function getMax24h(fromIdx: number): number {
    let maxP = 0;
    const end = Math.min(fromIdx + 288, candles.length);
    for (let j = fromIdx; j < end; j++) {
      if (candles[j].high > maxP) maxP = candles[j].high;
    }
    return maxP;
  }

  function closeLadder(price: number, ts: number, idx: number, exitType: string, tpUsed: number, wasDeferred: boolean, deferHrs: number, bouncePct: number, greenRatio: number) {
    const m = new Date(ts).toISOString().slice(0, 7);
    if (!monthly[m]) monthly[m] = { pnl: 0, trades: 0, wins: 0 };
    const tQty = pos.reduce((s, p) => s + p.qty, 0);
    const avgE = pos.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
    let netPnl = 0;
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
      netPnl += pnl;
    }
    const max24h = getMax24h(idx);
    const wouldHit = max24h >= avgE * (1 + cfg.tpPct / 100);
    ladderExits.push({
      month: m, openTs: pos[0].et, closeTs: ts,
      holdHours: (ts - pos[0].et) / 3600000,
      exitType, netPnl, positions: pos.length, tpPctUsed: tpUsed,
      deferred: wasDeferred, deferHours: deferHrs,
      bouncePctAtDecision: bouncePct, greenRatioAtDecision: greenRatio,
      maxPrice24h: max24h, wouldHitFullTp: wouldHit,
    });
    pos.length = 0;
    staleDeferred = false;
    lastDeferCheck = 0;
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

      // Check TP — use full TP if deferred (we're giving it patience), else check stale
      let currentTp = cfg.tpPct;
      let exitLabel = "batchTP";
      let isStaleExit = false;

      if (cfg.staleHours > 0 && oldH >= cfg.staleHours && avgPnl < 0) {
        // We're in stale territory
        if (cfg.deferGate) {
          const g = cfg.deferGate;
          const maxDeferBars = g.maxDeferHours * 12; // 5min bars per hour

          if (!staleDeferred) {
            // First time hitting stale — check recovery
            const rec = isRecovering(candles, i, g);
            if (rec.recovering) {
              // Defer! Don't exit yet
              staleDeferred = true;
              lastDeferCheck = i;
              deferCount++;
              // Keep targeting full TP for now
              currentTp = cfg.tpPct;
            } else {
              // No recovery — take stale exit
              currentTp = cfg.reducedTpPct;
              exitLabel = "staleTP";
              isStaleExit = true;
            }
          } else {
            // Already deferred — re-check at intervals
            const barsSinceCheck = i - lastDeferCheck;
            const totalDeferBars = i - (pos[0].et < startTs ? 0 : Math.floor((pos[0].et - candles[0].timestamp) / 300000)) ;
            const hoursSinceStale = oldH - cfg.staleHours;

            if (hoursSinceStale >= g.maxDeferHours) {
              // Hard cap — force stale exit with deferred TP
              currentTp = g.deferredTpPct;
              exitLabel = "staleDeferTP";
              isStaleExit = true;
            } else if (barsSinceCheck >= g.recheckIntervalBars) {
              // Re-check recovery
              const rec = isRecovering(candles, i, g);
              lastDeferCheck = i;
              if (!rec.recovering) {
                // Recovery faded — exit now with deferred TP
                currentTp = g.deferredTpPct;
                exitLabel = "staleDeferTP";
                isStaleExit = true;
              } else {
                // Still recovering — keep deferring, target full TP
                currentTp = cfg.tpPct;
              }
            } else {
              // Between re-checks, keep targeting full TP
              currentTp = cfg.tpPct;
            }
          }
        } else {
          // No defer gate — simple stale exit
          currentTp = cfg.reducedTpPct;
          exitLabel = "staleTP";
          isStaleExit = true;
        }
      }

      const tpPrice = avgE * (1 + currentTp / 100);
      if (high >= tpPrice) {
        if (isStaleExit) {
          if (exitLabel === "staleDeferTP") staleDeferTP++;
          else staleTP++;
        } else {
          batchTP++;
          if (staleDeferred) deferSuccessCount++; // deferred and hit full TP!
        }
        const rec = cfg.deferGate ? isRecovering(candles, i, cfg.deferGate) : { bouncePct: 0, greenRatio: 0 };
        closeLadder(tpPrice, ts, i, staleDeferred && !isStaleExit ? "batchTP(deferred)" : exitLabel,
          currentTp, staleDeferred, staleDeferred ? (oldH - cfg.staleHours) : 0,
          rec.bouncePct, rec.greenRatio);
        continue;
      }
      if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) {
        emKill++;
        closeLadder(close, ts, i, "emKill", 0, staleDeferred, staleDeferred ? (oldH - cfg.staleHours) : 0, 0, 0);
        continue;
      }
      if (cfg.hardFlattenHours > 0 && oldH >= cfg.hardFlattenHours && avgPnl <= cfg.hardFlattenPct && isHostile(gate, ts)) {
        hardFlat++;
        closeLadder(close, ts, i, "hardFlat", 0, staleDeferred, staleDeferred ? (oldH - cfg.staleHours) : 0, 0, 0);
        continue;
      }
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
  if (pos.length > 0) {
    const l = candles[candles.length - 1];
    closeLadder(l.close, l.timestamp, candles.length - 1, "eod", 0, false, 0, 0, 0);
  }

  return {
    capital, trades, wins, totalFees, totalFund, maxDD, minEq, peakCap,
    batchTP, staleTP, staleDeferTP, hardFlat, emKill, trendBlk, monthly, ladderExits,
    maxHoldHours: maxHoldMs / 3600000,
    avgHoldHours: trades > 0 ? (totalHoldMs / trades) / 3600000 : 0,
    deferCount, deferSuccessCount,
  };
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
console.log(`HYPE ${candles.length} candles, ${new Date(candles[0].timestamp).toISOString().slice(0, 10)} to ${new Date(candles[candles.length - 1].timestamp).toISOString().slice(0, 10)}\n`);

const BASE: Omit<Cfg, "label" | "staleHours" | "reducedTpPct" | "deferGate"> = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 5000, feeRate: 0.00055,
  startDate: "2025-01-20",
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
};

// Gate variants — keep them simple and robust
// The key question: how much bounce from recent low + how green are recent bars
const configs: Cfg[] = [
  // A: Baseline — no stale at all (for reference)
  { ...BASE, label: "A: Current (20h/0.9%)", staleHours: 20, reducedTpPct: 0.9 },

  // B: Simple aggressive stale — our current best
  { ...BASE, label: "B: Simple 8h/0.3%", staleHours: 8, reducedTpPct: 0.3 },

  // C: Defer gate — conservative (easy to trigger defer)
  // Bounce 1% from 6h low + 40% green bars in last 2h = "recovering, wait"
  { ...BASE, label: "C: Gate 1%/40%/6h", staleHours: 8, reducedTpPct: 0.3,
    deferGate: {
      bounceLookbackBars: 72,    // 6h of 5min bars
      minBouncePct: 1.0,         // price 1% above local low
      minGreenRatio: 0.40,       // 40% of recent bars green
      greenRatioBars: 24,        // last 2h
      recheckIntervalBars: 12,   // re-check every 1h
      maxDeferHours: 16,         // hard cap: defer max 16h past stale trigger
      deferredTpPct: 0.3,        // if defer expires, use same 0.3%
    }},

  // D: Defer gate — moderate
  // Bounce 2% from 6h low + 45% green bars in last 3h
  { ...BASE, label: "D: Gate 2%/45%/6h", staleHours: 8, reducedTpPct: 0.3,
    deferGate: {
      bounceLookbackBars: 72,
      minBouncePct: 2.0,
      minGreenRatio: 0.45,
      greenRatioBars: 36,        // last 3h
      recheckIntervalBars: 12,
      maxDeferHours: 16,
      deferredTpPct: 0.3,
    }},

  // E: Defer gate — selective (harder to trigger defer)
  // Bounce 3% from 8h low + 50% green bars in last 3h
  { ...BASE, label: "E: Gate 3%/50%/8h", staleHours: 8, reducedTpPct: 0.3,
    deferGate: {
      bounceLookbackBars: 96,    // 8h lookback
      minBouncePct: 3.0,
      minGreenRatio: 0.50,
      greenRatioBars: 36,
      recheckIntervalBars: 12,
      maxDeferHours: 16,
      deferredTpPct: 0.3,
    }},

  // F: Defer gate — with shorter max defer
  // Same as C but max 8h defer (total 16h from entry, 8h past stale)
  { ...BASE, label: "F: Gate 1%/40% cap8h", staleHours: 8, reducedTpPct: 0.3,
    deferGate: {
      bounceLookbackBars: 72,
      minBouncePct: 1.0,
      minGreenRatio: 0.40,
      greenRatioBars: 24,
      recheckIntervalBars: 12,
      maxDeferHours: 8,          // tighter cap
      deferredTpPct: 0.3,
    }},

  // G: Defer gate — bounce only (no green ratio requirement)
  // Pure price recovery signal
  { ...BASE, label: "G: Bounce 2% only", staleHours: 8, reducedTpPct: 0.3,
    deferGate: {
      bounceLookbackBars: 72,
      minBouncePct: 2.0,
      minGreenRatio: 0.0,        // disabled
      greenRatioBars: 1,
      recheckIntervalBars: 12,
      maxDeferHours: 16,
      deferredTpPct: 0.3,
    }},

  // H: Defer gate — green ratio only (no bounce requirement)
  // Pure momentum signal
  { ...BASE, label: "H: Green 50% only", staleHours: 8, reducedTpPct: 0.3,
    deferGate: {
      bounceLookbackBars: 1,
      minBouncePct: 0.0,         // disabled
      minGreenRatio: 0.50,
      greenRatioBars: 36,
      recheckIntervalBars: 12,
      maxDeferHours: 16,
      deferredTpPct: 0.3,
    }},
];

const results = configs.map(cfg => ({ cfg, r: run(candles, cfg) }));

// ── Summary table ──
const W = 20;
console.log("=".repeat(30 + results.length * W));
console.log("  DEFER GATE COMPARISON");
console.log("=".repeat(30 + results.length * W));
console.log("");

console.log("".padEnd(30) + results.map(({ cfg }) => cfg.label.padStart(W)).join(""));
console.log("-".repeat(30 + results.length * W));

const row = (label: string, fn: (r: Result, c: Cfg) => string) => {
  let line = label.padEnd(30);
  for (const { r, cfg } of results) line += fn(r, cfg).padStart(W);
  console.log(line);
};

row("Return", (r, c) => ((r.capital / c.initialCapital - 1) * 100).toFixed(1) + "%");
row("Final Capital", r => "$" + r.capital.toFixed(0));
row("Max Drawdown", r => r.maxDD.toFixed(1) + "%");
row("Min Equity", r => "$" + r.minEq.toFixed(0));
row("", () => "");
row("Total Trades", r => String(r.trades));
row("Win Rate", r => (r.wins / r.trades * 100).toFixed(0) + "%");
row("Batch TPs", r => String(r.batchTP));
row("Stale TPs (immediate)", r => String(r.staleTP));
row("Stale TPs (after defer)", r => String(r.staleDeferTP));
row("Hard Flattens", r => String(r.hardFlat));
row("Emergency Kills", r => String(r.emKill));
row("", () => "");
row("Deferrals triggered", r => String(r.deferCount));
row("Defer → full TP (wins)", r => String(r.deferSuccessCount));
row("Defer success rate", r => r.deferCount > 0 ? (r.deferSuccessCount / r.deferCount * 100).toFixed(0) + "%" : "n/a");
row("", () => "");
row("Avg Hold (hours)", r => r.avgHoldHours.toFixed(1) + "h");
row("Max Hold (hours)", r => r.maxHoldHours.toFixed(1) + "h");
row("Trading Fees", r => "$" + r.totalFees.toFixed(0));
row("Funding Fees", r => "$" + r.totalFund.toFixed(0));

// ── Monthly comparison ──
console.log("\n" + "=".repeat(30 + results.length * W));
console.log("  MONTHLY PnL");
console.log("=".repeat(30 + results.length * W) + "\n");

const allMonths = new Set(results.flatMap(({ r }) => Object.keys(r.monthly)));
console.log("Month".padEnd(12) + results.map(({ cfg }) => cfg.label.padStart(W)).join(""));
console.log("-".repeat(12 + results.length * W));

for (const m of [...allMonths].sort()) {
  let line = m.padEnd(12);
  for (const { r } of results) {
    const pnl = r.monthly[m]?.pnl || 0;
    line += ("$" + pnl.toFixed(0)).padStart(W);
  }
  console.log(line);
}

console.log("-".repeat(12 + results.length * W));
let totLine = "TOTAL".padEnd(12);
for (const { r, cfg } of results) {
  totLine += ("$" + (r.capital - cfg.initialCapital).toFixed(0)).padStart(W);
}
console.log(totLine);

// ── Defer decision log for losing months ──
console.log("\n" + "=".repeat(120));
console.log("  DEFER DECISIONS IN LOSING MONTHS (Oct, Dec, Feb, Mar)");
console.log("=".repeat(120));

const losingMonths = ["2025-10", "2025-12", "2026-02", "2026-03"];

for (const { cfg, r } of results) {
  if (!cfg.deferGate) continue;
  const relevant = r.ladderExits.filter(e =>
    losingMonths.includes(e.month) &&
    (e.exitType.includes("stale") || e.exitType.includes("defer") || e.exitType === "batchTP(deferred)")
  );
  if (relevant.length === 0) continue;

  console.log(`\n[${cfg.label}]`);
  for (const e of relevant) {
    const date = new Date(e.closeTs).toISOString().slice(0, 16);
    const hitStr = e.wouldHitFullTp ? "WOULD HIT 1.4%" : "would NOT hit";
    console.log(`  ${e.month} ${date} | ${e.exitType.padEnd(20)} | held ${e.holdHours.toFixed(1)}h | deferred=${e.deferred} deferH=${e.deferHours.toFixed(1)} | bounce=${e.bouncePctAtDecision.toFixed(2)}% green=${e.greenRatioAtDecision.toFixed(2)} | net=$${e.netPnl.toFixed(0)} | ${hitStr}`);
  }
}

// ── Opportunity cost: deferred stale exits that missed full TP ──
console.log("\n" + "=".repeat(120));
console.log("  DEFER GATE EFFECTIVENESS");
console.log("=".repeat(120) + "\n");

for (const { cfg, r } of results) {
  if (!cfg.deferGate) continue;

  const stales = r.ladderExits.filter(e => e.exitType.includes("stale") || e.exitType.includes("defer"));
  const deferred = r.ladderExits.filter(e => e.deferred);
  const deferToFullTp = r.ladderExits.filter(e => e.exitType === "batchTP(deferred)");
  const deferToStale = r.ladderExits.filter(e => e.exitType === "staleDeferTP");
  const immediateStale = r.ladderExits.filter(e => e.exitType === "staleTP");
  const immediateWouldHit = immediateStale.filter(e => e.wouldHitFullTp);
  const deferToStaleWouldHit = deferToStale.filter(e => e.wouldHitFullTp);

  console.log(`[${cfg.label}]`);
  console.log(`  Immediate stale exits: ${immediateStale.length} (${immediateWouldHit.length} would have hit full TP)`);
  console.log(`  Deferrals triggered: ${deferred.length}`);
  console.log(`    → Hit full TP after defer: ${deferToFullTp.length} (SAVED)`);
  console.log(`    → Fell back to stale after defer: ${deferToStale.length} (${deferToStaleWouldHit.length} would have hit full TP)`);
  if (deferToFullTp.length > 0) {
    const savedPnl = deferToFullTp.reduce((s, e) => s + e.netPnl, 0);
    // Estimate what they'd have made at 0.3%
    const wouldHaveBeenStale = deferToFullTp.length * 43; // ~$43 avg stale exit
    console.log(`    → Extra PnL from deferrals: ~$${(savedPnl - wouldHaveBeenStale).toFixed(0)}`);
  }
  console.log("");
}
