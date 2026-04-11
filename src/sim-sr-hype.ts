// sim-sr-hype.ts — HYPE Support/Resistance trading sim
//
// Detects medium/high-quality S/R levels on 4H pivots, trades each
// re-touch with $30k notional (short at resistance, long at support).
// Sweeps TP/SL combos. Goal: identify gates around resistance for ladder.
//
// No look-ahead: a pivot at bar N only becomes "active" at bar N+PIVOT_RIGHT.
// A level is only traded if formed before the touch.
//
// Run: npx ts-node src/sim-sr-hype.ts

import fs from "fs";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

const bars1m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_1.json", "utf-8"));
bars1m.sort((a, b) => a.timestamp - b.timestamp);
const ts1m = bars1m.map(b => b.timestamp);
console.log(`HYPE 1m: ${bars1m.length} candles | ${d(bars1m[0].timestamp)} → ${d(bars1m[bars1m.length - 1].timestamp)}\n`);

function d(ts: number) { return new Date(ts).toISOString().slice(0, 16); }

// ── Aggregate to 4H ──
function agg(bars: Candle[], min: number): Candle[] {
  const ms = min * 60000, m = new Map<number, Candle>();
  for (const c of bars) {
    const k = Math.floor(c.timestamp / ms) * ms, e = m.get(k);
    if (!e) m.set(k, { ...c, timestamp: k });
    else { e.high = Math.max(e.high, c.high); e.low = Math.min(e.low, c.low); e.close = c.close; e.volume += c.volume; e.turnover += c.turnover; }
  }
  return [...m.values()].sort((a, b) => a.timestamp - b.timestamp);
}

const bars4h = agg(bars1m, 240);
console.log(`HYPE 4H: ${bars4h.length} bars\n`);

// ── S/R Detection ──
// Pivot: bar where high is the max (or low is the min) within a window of
// PIVOT_LEFT bars before and PIVOT_RIGHT bars after.

const PIVOT_LEFT = 6;        // 6 * 4h = 24h
const PIVOT_RIGHT = 6;       // 24h confirmation
const CLUSTER_PCT = 0.012;   // merge pivots within 1.2%
const MIN_PROMINENCE = 0.025;// level must be at least 2.5% from nearest dissimilar level
const MIN_TOUCHES = 2;       // need >=2 swing points clustered to be "medium+"
const TOUCH_BUFFER = 0.003;  // 0.3% — counts as a touch when high/low is within this

interface Pivot { ts: number; price: number; type: "R" | "S"; }

const rawPivots: Pivot[] = [];
for (let i = PIVOT_LEFT; i < bars4h.length - PIVOT_RIGHT; i++) {
  const bar = bars4h[i];
  let isHigh = true, isLow = true;
  for (let j = i - PIVOT_LEFT; j <= i + PIVOT_RIGHT; j++) {
    if (j === i) continue;
    if (bars4h[j].high >= bar.high) isHigh = false;
    if (bars4h[j].low <= bar.low) isLow = false;
  }
  // Confirmation = ts of the rightmost bar in the lookahead window
  const confirmTs = bars4h[i + PIVOT_RIGHT].timestamp + 240 * 60000;
  if (isHigh) rawPivots.push({ ts: confirmTs, price: bar.high, type: "R" });
  if (isLow) rawPivots.push({ ts: confirmTs, price: bar.low, type: "S" });
}

console.log(`Raw pivots: ${rawPivots.filter(p => p.type === "R").length} R, ${rawPivots.filter(p => p.type === "S").length} S`);

// ── Cluster pivots into levels ──
// Two pivots within CLUSTER_PCT of each other merge into one level. The
// level inherits the EARLIEST confirmation time and counts touches.

interface Level {
  type: "R" | "S";
  price: number;
  confirmTs: number;   // when the level becomes active (earliest)
  touches: number;     // # of swing pivots that contributed
  pivotTimes: number[];
}

function buildLevels(type: "R" | "S"): Level[] {
  const piv = rawPivots.filter(p => p.type === type).sort((a, b) => a.ts - b.ts);
  const levels: Level[] = [];
  for (const p of piv) {
    // Match against existing level
    let merged = false;
    for (const lv of levels) {
      if (Math.abs(lv.price - p.price) / lv.price <= CLUSTER_PCT) {
        // Update level: keep the more extreme price (higher for R, lower for S)
        if (type === "R" && p.price > lv.price) lv.price = p.price;
        if (type === "S" && p.price < lv.price) lv.price = p.price;
        lv.touches++;
        lv.pivotTimes.push(p.ts);
        merged = true;
        break;
      }
    }
    if (!merged) levels.push({ type, price: p.price, confirmTs: p.ts, touches: 1, pivotTimes: [p.ts] });
  }
  return levels;
}

const allR = buildLevels("R");
const allS = buildLevels("S");

// ── Filter: require >= MIN_TOUCHES OR strong prominence ──
function filterLevels(levels: Level[], allLevels: Level[]): Level[] {
  return levels.filter(lv => {
    if (lv.touches >= MIN_TOUCHES) return true;
    // Single-touch survives only if it's prominent (far from other levels)
    let nearestDist = Infinity;
    for (const other of allLevels) {
      if (other === lv) continue;
      const dist = Math.abs(other.price - lv.price) / lv.price;
      if (dist < nearestDist) nearestDist = dist;
    }
    return nearestDist >= MIN_PROMINENCE;
  });
}

const allLevels = [...allR, ...allS];
const resistanceLevels = filterLevels(allR, allLevels).sort((a, b) => a.confirmTs - b.confirmTs);
const supportLevels = filterLevels(allS, allLevels).sort((a, b) => a.confirmTs - b.confirmTs);

console.log(`Filtered levels: ${resistanceLevels.length} R, ${supportLevels.length} S\n`);

// Show top 15 strongest (most touches) of each
function showTop(levels: Level[], label: string, n: number) {
  const sorted = [...levels].sort((a, b) => b.touches - a.touches);
  console.log(`Top ${n} ${label}:`);
  for (let i = 0; i < Math.min(n, sorted.length); i++) {
    const lv = sorted[i];
    console.log(`  $${lv.price.toFixed(3).padEnd(8)} touches=${lv.touches} confirmed=${d(lv.confirmTs)}`);
  }
  console.log();
}
showTop(resistanceLevels, "RESISTANCE (by touches)", 15);
showTop(supportLevels, "SUPPORT (by touches)", 15);

// ── Trade Execution ──
// Walk 1m bars forward. For each active level, find the FIRST touch after
// confirmTs. Once traded, that level is exhausted.

interface SimTrade {
  type: "R" | "S";
  side: "short" | "long";
  level: number;
  touches: number;
  entryTs: number;
  entryPrice: number;
  exitTs: number;
  exitPrice: number;
  outcome: "tp" | "stop" | "flat";
  pnl: number;
}

const NOTIONAL = 30000;
const FEE = 0.0011;
const MAX_HOLD_HOURS = 24;
const MAX_HOLD_MIN = MAX_HOLD_HOURS * 60;

function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] >= t) { r = mid; hi = mid - 1; } else lo = mid + 1; }
  return r;
}

function simulate(tpPct: number, slPct: number): SimTrade[] {
  const trades: SimTrade[] = [];

  // Resistance: short on touch
  for (const lv of resistanceLevels) {
    const startIdx = bsearch(ts1m, lv.confirmTs);
    if (startIdx < 0) continue;
    let touchIdx = -1;
    for (let i = startIdx; i < bars1m.length; i++) {
      if (bars1m[i].high >= lv.price * (1 - TOUCH_BUFFER)) { touchIdx = i; break; }
    }
    if (touchIdx < 0) continue;
    // Use level price as entry (touch confirms approach)
    const entry = lv.price;
    const tp = entry * (1 - tpPct / 100);
    const sl = entry * (1 + slPct / 100);
    const maxIdx = Math.min(touchIdx + MAX_HOLD_MIN, bars1m.length - 1);
    let outcome: "tp" | "stop" | "flat" = "flat", exitIdx = maxIdx;
    for (let j = touchIdx + 1; j <= maxIdx; j++) {
      if (bars1m[j].high >= sl) { outcome = "stop"; exitIdx = j; break; }
      if (bars1m[j].low <= tp) { outcome = "tp"; exitIdx = j; break; }
    }
    const exitPrice = outcome === "stop" ? sl : outcome === "tp" ? tp : bars1m[maxIdx].close;
    let pnl: number;
    if (outcome === "stop") pnl = -slPct / 100 * NOTIONAL - NOTIONAL * FEE;
    else if (outcome === "tp") pnl = tpPct / 100 * NOTIONAL - NOTIONAL * FEE;
    else pnl = ((entry - exitPrice) / entry) * NOTIONAL - NOTIONAL * FEE;
    trades.push({
      type: "R", side: "short", level: lv.price, touches: lv.touches,
      entryTs: bars1m[touchIdx].timestamp, entryPrice: entry,
      exitTs: bars1m[exitIdx].timestamp, exitPrice, outcome, pnl,
    });
  }

  // Support: long on touch
  for (const lv of supportLevels) {
    const startIdx = bsearch(ts1m, lv.confirmTs);
    if (startIdx < 0) continue;
    let touchIdx = -1;
    for (let i = startIdx; i < bars1m.length; i++) {
      if (bars1m[i].low <= lv.price * (1 + TOUCH_BUFFER)) { touchIdx = i; break; }
    }
    if (touchIdx < 0) continue;
    const entry = lv.price;
    const tp = entry * (1 + tpPct / 100);
    const sl = entry * (1 - slPct / 100);
    const maxIdx = Math.min(touchIdx + MAX_HOLD_MIN, bars1m.length - 1);
    let outcome: "tp" | "stop" | "flat" = "flat", exitIdx = maxIdx;
    for (let j = touchIdx + 1; j <= maxIdx; j++) {
      if (bars1m[j].low <= sl) { outcome = "stop"; exitIdx = j; break; }
      if (bars1m[j].high >= tp) { outcome = "tp"; exitIdx = j; break; }
    }
    const exitPrice = outcome === "stop" ? sl : outcome === "tp" ? tp : bars1m[maxIdx].close;
    let pnl: number;
    if (outcome === "stop") pnl = -slPct / 100 * NOTIONAL - NOTIONAL * FEE;
    else if (outcome === "tp") pnl = tpPct / 100 * NOTIONAL - NOTIONAL * FEE;
    else pnl = ((exitPrice - entry) / entry) * NOTIONAL - NOTIONAL * FEE;
    trades.push({
      type: "S", side: "long", level: lv.price, touches: lv.touches,
      entryTs: bars1m[touchIdx].timestamp, entryPrice: entry,
      exitTs: bars1m[exitIdx].timestamp, exitPrice, outcome, pnl,
    });
  }

  return trades;
}

// ── TP/SL sweep ──
const combos = [
  { tp: 1.0, sl: 1.5 },
  { tp: 1.5, sl: 2.0 },
  { tp: 1.5, sl: 3.0 },
  { tp: 2.0, sl: 2.0 },
  { tp: 2.0, sl: 3.0 },
  { tp: 2.0, sl: 4.0 },
  { tp: 2.5, sl: 3.0 },
  { tp: 3.0, sl: 3.0 },
  { tp: 3.0, sl: 4.0 },
  { tp: 4.0, sl: 4.0 },
];

console.log("═══════════════════════════════════════════════════════════════════════");
console.log(`  S/R SWEEP — $${NOTIONAL} notional, 24h max hold, ${(FEE * 100).toFixed(2)}% RT fees`);
console.log("═══════════════════════════════════════════════════════════════════════\n");

console.log("RESISTANCE (shorts):");
console.log(`${"TP/SL".padEnd(10)} ${"N".padEnd(5)} ${"Wins".padEnd(6)} ${"Loss".padEnd(6)} ${"Flat".padEnd(6)} ${"WR%".padEnd(7)} ${"Total$".padEnd(11)} ${"Avg$".padEnd(9)}`);
console.log("─".repeat(70));

const resultsR: { combo: typeof combos[0]; trades: SimTrade[]; pnl: number }[] = [];
const resultsS: { combo: typeof combos[0]; trades: SimTrade[]; pnl: number }[] = [];

for (const combo of combos) {
  const trades = simulate(combo.tp, combo.sl);
  const rTrades = trades.filter(t => t.type === "R");
  const wins = rTrades.filter(t => t.outcome === "tp").length;
  const losses = rTrades.filter(t => t.outcome === "stop").length;
  const flats = rTrades.filter(t => t.outcome === "flat").length;
  const totalPnl = rTrades.reduce((s, t) => s + t.pnl, 0);
  const wr = rTrades.length > 0 ? (wins / rTrades.length * 100).toFixed(1) : "0.0";
  const avgPnl = rTrades.length > 0 ? totalPnl / rTrades.length : 0;
  console.log(`${combo.tp}/${combo.sl}`.padEnd(10) +
    `${rTrades.length}`.padEnd(5) + `${wins}`.padEnd(6) + `${losses}`.padEnd(6) + `${flats}`.padEnd(6) +
    `${wr}%`.padEnd(7) +
    `$${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)}`.padEnd(11) +
    `$${avgPnl >= 0 ? "+" : ""}${avgPnl.toFixed(0)}`.padEnd(9));
  resultsR.push({ combo, trades: rTrades, pnl: totalPnl });
}

console.log("\nSUPPORT (longs):");
console.log(`${"TP/SL".padEnd(10)} ${"N".padEnd(5)} ${"Wins".padEnd(6)} ${"Loss".padEnd(6)} ${"Flat".padEnd(6)} ${"WR%".padEnd(7)} ${"Total$".padEnd(11)} ${"Avg$".padEnd(9)}`);
console.log("─".repeat(70));

for (const combo of combos) {
  const trades = simulate(combo.tp, combo.sl);
  const sTrades = trades.filter(t => t.type === "S");
  const wins = sTrades.filter(t => t.outcome === "tp").length;
  const losses = sTrades.filter(t => t.outcome === "stop").length;
  const flats = sTrades.filter(t => t.outcome === "flat").length;
  const totalPnl = sTrades.reduce((s, t) => s + t.pnl, 0);
  const wr = sTrades.length > 0 ? (wins / sTrades.length * 100).toFixed(1) : "0.0";
  const avgPnl = sTrades.length > 0 ? totalPnl / sTrades.length : 0;
  console.log(`${combo.tp}/${combo.sl}`.padEnd(10) +
    `${sTrades.length}`.padEnd(5) + `${wins}`.padEnd(6) + `${losses}`.padEnd(6) + `${flats}`.padEnd(6) +
    `${wr}%`.padEnd(7) +
    `$${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)}`.padEnd(11) +
    `$${avgPnl >= 0 ? "+" : ""}${avgPnl.toFixed(0)}`.padEnd(9));
  resultsS.push({ combo, trades: sTrades, pnl: totalPnl });
}

// ── Per-touch-count breakdown for the BEST resistance combo ──
resultsR.sort((a, b) => b.pnl - a.pnl);
const bestR = resultsR[0];
console.log(`\n═══ BEST RESISTANCE COMBO: TP=${bestR.combo.tp}% SL=${bestR.combo.sl}% — by touch count ═══`);
console.log(`${"Touches".padEnd(10)} ${"N".padEnd(5)} ${"Wins".padEnd(6)} ${"WR%".padEnd(7)} ${"Total$".padEnd(11)} ${"Avg$".padEnd(9)}`);
console.log("─".repeat(55));
const byTouchR = new Map<number, SimTrade[]>();
for (const t of bestR.trades) {
  if (!byTouchR.has(t.touches)) byTouchR.set(t.touches, []);
  byTouchR.get(t.touches)!.push(t);
}
for (const [tc, ts] of [...byTouchR.entries()].sort((a, b) => a[0] - b[0])) {
  const wins = ts.filter(t => t.outcome === "tp").length;
  const totalPnl = ts.reduce((s, t) => s + t.pnl, 0);
  const wr = (wins / ts.length * 100).toFixed(1);
  console.log(`${tc}+`.padEnd(10) +
    `${ts.length}`.padEnd(5) + `${wins}`.padEnd(6) + `${wr}%`.padEnd(7) +
    `$${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)}`.padEnd(11) +
    `$${(totalPnl / ts.length).toFixed(0)}`.padEnd(9));
}

resultsS.sort((a, b) => b.pnl - a.pnl);
const bestS = resultsS[0];
console.log(`\n═══ BEST SUPPORT COMBO: TP=${bestS.combo.tp}% SL=${bestS.combo.sl}% — by touch count ═══`);
console.log(`${"Touches".padEnd(10)} ${"N".padEnd(5)} ${"Wins".padEnd(6)} ${"WR%".padEnd(7)} ${"Total$".padEnd(11)} ${"Avg$".padEnd(9)}`);
console.log("─".repeat(55));
const byTouchS = new Map<number, SimTrade[]>();
for (const t of bestS.trades) {
  if (!byTouchS.has(t.touches)) byTouchS.set(t.touches, []);
  byTouchS.get(t.touches)!.push(t);
}
for (const [tc, ts] of [...byTouchS.entries()].sort((a, b) => a[0] - b[0])) {
  const wins = ts.filter(t => t.outcome === "tp").length;
  const totalPnl = ts.reduce((s, t) => s + t.pnl, 0);
  const wr = (wins / ts.length * 100).toFixed(1);
  console.log(`${tc}+`.padEnd(10) +
    `${ts.length}`.padEnd(5) + `${wins}`.padEnd(6) + `${wr}%`.padEnd(7) +
    `$${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)}`.padEnd(11) +
    `$${(totalPnl / ts.length).toFixed(0)}`.padEnd(9));
}

// ── Resistance trade detail (for ladder gating analysis) ──
console.log(`\n═══ RESISTANCE TRADES (best combo) — for ladder gate analysis ═══`);
console.log(`${"Confirmed".padEnd(18)} ${"Touched".padEnd(18)} ${"Level".padEnd(9)} ${"Tch".padEnd(4)} ${"Outcome".padEnd(8)} ${"PnL".padEnd(9)}`);
console.log("─".repeat(75));
const sortedR = [...bestR.trades].sort((a, b) => a.entryTs - b.entryTs);
for (const t of sortedR) {
  const lvl = resistanceLevels.find(l => Math.abs(l.price - t.level) < 0.0001);
  console.log(`${d(lvl!.confirmTs).padEnd(18)} ${d(t.entryTs).padEnd(18)} $${t.level.toFixed(3).padEnd(7)} ${t.touches}`.padEnd(60) +
    `${t.outcome.padEnd(8)} $${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(0)}`);
}
