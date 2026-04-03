// ─────────────────────────────────────────────
// 2Moon ladder sim + CRSI 4H cross-reference
//
// Runs the same DCA ladder logic as the live bot.
// At every rung add, records CRSI 4H at that moment.
// Groups into episodes (first open → all closed).
// Answers: if we had gated entries on CRSI < X,
// would it have avoided bad episodes?
//
// npx ts-node src/sim-crsi-gate.ts
// ─────────────────────────────────────────────

import fs from "fs";
import { RSI } from "technicalindicators";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";

// ── Data ─────────────────────────────────────────────────────────
const c5m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
c5m.sort((a, b) => a.timestamp - b.timestamp);
const c4H = aggregate(c5m, 240);

// ── CRSI 4H series ───────────────────────────────────────────────
function buildCrsiMap(bars: Candle[]): Map<number, number> {
  const closes = bars.map(b => b.close);
  const map = new Map<number, number>();
  const minLen = 103; // rsiP+1 + lookback

  for (let i = minLen; i < closes.length; i++) {
    const sl = closes.slice(0, i + 1);
    const r3 = RSI.calculate({ period: 3, values: sl });
    const streaks: number[] = [];
    let streak = 0;
    for (let j = 1; j < sl.length; j++) {
      if      (sl[j] > sl[j-1]) streak = streak > 0 ? streak + 1 : 1;
      else if (sl[j] < sl[j-1]) streak = streak < 0 ? streak - 1 : -1;
      else streak = 0;
      streaks.push(streak);
    }
    const sr = RSI.calculate({ period: 2, values: streaks });
    const ret = (sl[sl.length-1] - sl[sl.length-2]) / sl[sl.length-2] * 100;
    const hist = sl.slice(-101);
    const rets = hist.slice(1).map((v, k) => (v - hist[k]) / hist[k] * 100);
    const rank = rets.filter(r => r < ret).length / rets.length * 100;
    map.set(bars[i].timestamp, +((r3[r3.length-1] + sr[sr.length-1] + rank) / 3).toFixed(2));
  }
  return map;
}

console.log("Computing 4H CRSI series...");
const crsiMap = buildCrsiMap(c4H);

// ── CRSI lookup: find most recent 4H bar <= ts ───────────────────
const crsiTs = [...crsiMap.keys()].sort((a, b) => a - b);
function getCrsi(ts: number): number | null {
  let lo = 0, hi = crsiTs.length - 1, res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (crsiTs[mid] <= ts) { res = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return res >= 0 ? crsiMap.get(crsiTs[res]) ?? null : null;
}

// ── Trend gate (EMA50/200 on 4H) ────────────────────────────────
function buildTrendGate(bars: Candle[]): Map<number, boolean> {
  const period = 4 * 3600000;
  const closes = bars.map(b => b.close);
  const ema = (d: number[], p: number) => { const k = 2/(p+1); const r=[d[0]]; for(let i=1;i<d.length;i++) r.push(d[i]*k+r[i-1]*(1-k)); return r; };
  const e200 = ema(closes, 200), e50 = ema(closes, 50);
  const gate = new Map<number, boolean>();
  for (let i = 1; i < bars.length; i++) {
    gate.set(Math.floor(bars[i].timestamp/period)*period, closes[i] < e200[i] && e50[i] < e50[i-1]);
  }
  return gate;
}
function isHostile(gate: Map<number,boolean>, ts: number): boolean {
  const p = 4*3600000;
  return gate.get(Math.floor(ts/p)*p - p) ?? false;
}
const trendGate = buildTrendGate(c4H);

// ── Config (matches live bot) ─────────────────────────────────────
const CFG = {
  startDate:       "2025-01-01",
  tpPct:           1.4,
  basePos:         200,
  scaleFactor:     1.2,
  maxPositions:    11,
  addIntervalMin:  30,
  feeRate:         0.00055,
  initialCapital:  1000,
  staleHours:      8,
  reducedTpPct:    0.3,
  hardFlattenHours: 40,
  hardFlattenPct:  -6,
  emergencyKillPct: -10,
  fundingRate8h:   0.0001,
};

// ── Episode structure ─────────────────────────────────────────────
interface Rung {
  ts: number; date: string; price: number;
  rungIdx: number; crsi4H: number | null; notional: number;
}

interface Episode {
  rungs: Rung[];
  closeTs: number; closePrice: number;
  closeReason: "TP"|"STALE"|"KILL"|"FLAT";
  episodePnl: number;
  maxRungs: number;
  crsiAtOpen: number | null;   // CRSI when first rung opened
  crsiMin: number | null;      // lowest CRSI seen across all rungs
  crsiMax: number | null;      // highest CRSI seen across all rungs
  durationH: number;
}

// ── Sim ──────────────────────────────────────────────────────────
function runSim(crsiGate: number | null): { episodes: Episode[]; finalEq: number; maxDD: number } {
  const startTs = new Date(CFG.startDate).getTime();
  let capital = CFG.initialCapital;
  let peakEq = capital, maxDD = 0;
  const episodes: Episode[] = [];

  interface Pos { ep: number; et: number; qty: number; notional: number; }
  let longs: Pos[] = [];
  let lastAdd = 0;
  let currentRungs: Rung[] = [];

  function closeLongs(price: number, ts: number, reason: "TP"|"STALE"|"KILL"|"FLAT") {
    let pnl = 0;
    for (const p of longs) {
      const raw  = (price - p.ep) * p.qty;
      const fees = p.notional * CFG.feeRate + price * p.qty * CFG.feeRate;
      const fund = p.notional * CFG.fundingRate8h * ((ts - p.et) / (8*3600000));
      pnl += raw - fees - fund;
      capital += raw - fees - fund;
    }
    const crsiVals = currentRungs.map(r => r.crsi4H).filter(v => v !== null) as number[];
    episodes.push({
      rungs: [...currentRungs],
      closeTs: ts, closePrice: price, closeReason: reason,
      episodePnl: pnl,
      maxRungs: currentRungs.length,
      crsiAtOpen: currentRungs[0]?.crsi4H ?? null,
      crsiMin: crsiVals.length ? Math.min(...crsiVals) : null,
      crsiMax: crsiVals.length ? Math.max(...crsiVals) : null,
      durationH: currentRungs[0] ? (ts - currentRungs[0].ts) / 3600000 : 0,
    });
    longs = [];
    currentRungs = [];
    return pnl;
  }

  for (const c of c5m) {
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;

    const longUr = longs.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const eq = capital + longUr;
    if (eq > peakEq) peakEq = eq;
    const dd = peakEq > 0 ? (peakEq - eq) / peakEq * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    // Exits
    if (longs.length > 0) {
      const tQty = longs.reduce((s,p) => s+p.qty, 0);
      const avgE = longs.reduce((s,p) => s+p.ep*p.qty, 0) / tQty;
      const avgPnlPct = (close - avgE) / avgE * 100;
      const ageH = (ts - longs[0].et) / 3600000;
      const stale = CFG.staleHours > 0 && ageH >= CFG.staleHours && avgPnlPct < 0;
      const tpPct = stale ? CFG.reducedTpPct : CFG.tpPct;
      const tpPrice = avgE * (1 + tpPct / 100);

      if (high >= tpPrice)                                              { closeLongs(tpPrice, ts, stale ? "STALE" : "TP"); continue; }
      if (avgPnlPct <= CFG.emergencyKillPct)                           { closeLongs(close, ts, "KILL"); continue; }
      if (ageH >= CFG.hardFlattenHours && avgPnlPct <= CFG.hardFlattenPct && isHostile(trendGate, ts)) { closeLongs(close, ts, "FLAT"); continue; }
    }

    // Entries
    const gap = (ts - lastAdd) / 60000;
    if (longs.length < CFG.maxPositions && gap >= CFG.addIntervalMin && !isHostile(trendGate, ts)) {
      const crsi = getCrsi(ts);

      // CRSI gate: if gate set, only add when CRSI <= threshold
      // But allow adds to existing ladder regardless (gate only blocks episode starts)
      const isNewEpisode = longs.length === 0;
      if (isNewEpisode && crsiGate !== null && crsi !== null && crsi > crsiGate) continue;

      const lvl = longs.length;
      const notional = CFG.basePos * Math.pow(CFG.scaleFactor, lvl);
      const usedMargin = longs.reduce((s,p) => s + p.notional/50, 0);
      const margin = notional / 50;
      if (capital - usedMargin < margin || capital <= 0) continue;

      longs.push({ ep: close, et: ts, qty: notional/close, notional });
      currentRungs.push({
        ts, date: new Date(ts).toISOString().slice(0,16),
        price: close, rungIdx: lvl, crsi4H: crsi, notional,
      });
      lastAdd = ts;
    }
  }

  return { episodes, finalEq: capital, maxDD };
}

// ── Run baseline (no gate) ────────────────────────────────────────
console.log("Running baseline sim...");
const base = runSim(null);

// ── Analysis helpers ──────────────────────────────────────────────
const avg = (a: number[]) => a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0;
const sum = (a: number[]) => a.reduce((s,v)=>s+v,0);
const $ = (v: number) => (v>=0?"$+":"$")+v.toFixed(0);
const SEP = "═".repeat(100);

// ── CRSI distribution at episode open ────────────────────────────
console.log(`\n${SEP}`);
console.log(`  BASELINE: ${base.episodes.length} episodes  |  Final eq $${base.finalEq.toFixed(0)}  |  Max DD ${base.maxDD.toFixed(1)}%`);
console.log(SEP);

const eps = base.episodes;
const wins = eps.filter(e => e.episodePnl > 0);
const loss = eps.filter(e => e.episodePnl <= 0);

console.log(`\n  Wins: ${wins.length}  avg PnL: ${$(avg(wins.map(e=>e.episodePnl)))}  avg rungs: ${avg(wins.map(e=>e.maxRungs)).toFixed(1)}  avg CRSI@open: ${avg(wins.map(e=>e.crsiAtOpen??0)).toFixed(1)}`);
console.log(`  Loss: ${loss.length}  avg PnL: ${$(avg(loss.map(e=>e.episodePnl)))}  avg rungs: ${avg(loss.map(e=>e.maxRungs)).toFixed(1)}  avg CRSI@open: ${avg(loss.map(e=>e.crsiAtOpen??0)).toFixed(1)}`);

// ── CRSI bucket at episode open ───────────────────────────────────
console.log(`\n  ── Episode outcome by CRSI at first rung ──`);
console.log(`  ${"CRSI bucket".padEnd(15)} ${"N".padEnd(5)} ${"Win%".padEnd(7)} ${"Avg PnL".padEnd(10)} ${"Avg rungs".padEnd(11)} ${"Avg DD%"}`);
console.log("  " + "─".repeat(70));

const buckets = [
  { label: "< 20",     fn: (v:number) => v < 20 },
  { label: "20–30",    fn: (v:number) => v >= 20 && v < 30 },
  { label: "30–40",    fn: (v:number) => v >= 30 && v < 40 },
  { label: "40–50",    fn: (v:number) => v >= 40 && v < 50 },
  { label: "50–60",    fn: (v:number) => v >= 50 && v < 60 },
  { label: "60–70",    fn: (v:number) => v >= 60 && v < 70 },
  { label: "> 70",     fn: (v:number) => v >= 70 },
];

for (const b of buckets) {
  const sub = eps.filter(e => e.crsiAtOpen !== null && b.fn(e.crsiAtOpen));
  if (!sub.length) continue;
  const wr = sub.filter(e=>e.episodePnl>0).length / sub.length * 100;
  const avgPnl = avg(sub.map(e=>e.episodePnl));
  const avgRungs = avg(sub.map(e=>e.maxRungs));
  // approx episode DD as (maxRungs * basePos * scaleFactor^... - capital * %) -- use rung count as proxy
  const avgRungProxy = avg(sub.map(e => e.maxRungs));
  console.log(`  ${b.label.padEnd(15)} N=${String(sub.length).padEnd(4)} WR=${wr.toFixed(0).padStart(3)}%  PnL=${$(avgPnl).padStart(7)}  rungs=${avgRungProxy.toFixed(1).padStart(5)}  total=${$(sum(sub.map(e=>e.episodePnl))).padStart(7)}`);
}

// ── All episodes sorted by CRSI ───────────────────────────────────
console.log(`\n  ── All episodes (sorted by CRSI at open) ──`);
console.log(`  ${"Date".padEnd(18)} ${"CRSI@1st".padEnd(10)} ${"CRSI min".padEnd(10)} ${"Rungs".padEnd(7)} ${"DurH".padEnd(7)} ${"Reason".padEnd(8)} ${"PnL"}`);
console.log("  " + "─".repeat(80));
const sorted = [...eps].sort((a,b) => (a.crsiAtOpen??999) - (b.crsiAtOpen??999));
for (const e of sorted) {
  const marker = e.episodePnl < 0 ? " ◀ LOSS" : "";
  console.log(
    `  ${e.rungs[0]?.date.padEnd(18) ?? "?".padEnd(18)}` +
    `  ${(e.crsiAtOpen?.toFixed(1) ?? "n/a").padStart(8)}` +
    `  ${(e.crsiMin?.toFixed(1)    ?? "n/a").padStart(8)}` +
    `  ${String(e.maxRungs).padStart(5)}` +
    `  ${e.durationH.toFixed(0).padStart(5)}h` +
    `  ${e.closeReason.padEnd(8)}` +
    `  ${$(e.episodePnl).padStart(7)}${marker}`
  );
}

// ── CRSI in-flight hedge sim ──────────────────────────────────────
// Same ladder sim, but adds a short hedge when CRSI 4H drops below
// threshold while the ladder is open. Hedge covers hedgePct of notional,
// closes when CRSI recovers above rearmLevel or ladder closes.

function runSimWithCrsiHedge(crsiHedgeThreshold: number | null, hedgePct = 0.20): {
  episodes: Episode[]; finalEq: number; maxDD: number;
  hedgesFired: number; hedgeGrossPnl: number;
} {
  const startTs = new Date(CFG.startDate).getTime();
  let capital = CFG.initialCapital;
  let peakEq = capital, maxDD = 0;
  const episodes: Episode[] = [];
  let hedgesFired = 0, hedgeGrossPnl = 0;

  interface Pos { ep: number; et: number; qty: number; notional: number; }
  let longs: Pos[] = [];
  let hedge: { ep: number; qty: number; notional: number; et: number } | null = null;
  let lastAdd = 0;
  let currentRungs: Rung[] = [];
  let hedgeArmed = true;

  function closeLongs(price: number, ts: number, reason: "TP"|"STALE"|"KILL"|"FLAT") {
    let pnl = 0;
    for (const p of longs) {
      const raw  = (price - p.ep) * p.qty;
      const fees = p.notional * CFG.feeRate + price * p.qty * CFG.feeRate;
      const fund = p.notional * CFG.fundingRate8h * ((ts - p.et) / (8*3600000));
      pnl += raw - fees - fund;
      capital += raw - fees - fund;
    }
    // Close hedge too if open
    if (hedge) {
      const hRaw  = (hedge.ep - price) * hedge.qty;
      const hFees = hedge.notional * CFG.feeRate + price * hedge.qty * CFG.feeRate;
      const hPnl  = hRaw - hFees;
      hedgeGrossPnl += hPnl;
      capital += hPnl;
      hedge = null;
    }
    const crsiVals = currentRungs.map(r => r.crsi4H).filter(v => v !== null) as number[];
    episodes.push({
      rungs: [...currentRungs],
      closeTs: ts, closePrice: price, closeReason: reason,
      episodePnl: pnl,
      maxRungs: currentRungs.length,
      crsiAtOpen: currentRungs[0]?.crsi4H ?? null,
      crsiMin: crsiVals.length ? Math.min(...crsiVals) : null,
      crsiMax: crsiVals.length ? Math.max(...crsiVals) : null,
      durationH: currentRungs[0] ? (ts - currentRungs[0].ts) / 3600000 : 0,
    });
    longs = [];
    currentRungs = [];
    hedgeArmed = true;
    return pnl;
  }

  for (const c of c5m) {
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;

    const longUr  = longs.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const hedgeUr = hedge ? (hedge.ep - close) * hedge.qty : 0;
    const eq = capital + longUr + hedgeUr;
    if (eq > peakEq) peakEq = eq;
    const dd = peakEq > 0 ? (peakEq - eq) / peakEq * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    // ── CRSI in-flight hedge ──
    if (crsiHedgeThreshold !== null && longs.length > 0 && !hedge) {
      const crsi = getCrsi(ts);
      if (crsi !== null && crsi < crsiHedgeThreshold && hedgeArmed) {
        // Open short hedge
        const totalNotional = longs.reduce((s,p) => s+p.notional, 0);
        const hNotional = totalNotional * hedgePct;
        hedge = { ep: close, qty: hNotional / close, notional: hNotional, et: ts };
        hedgesFired++;
        hedgeArmed = false;
      }
    }
    // Close hedge when CRSI recovers above 35
    if (hedge && longs.length > 0) {
      const crsi = getCrsi(ts);
      if (crsi !== null && crsi >= 35) {
        const hRaw  = (hedge.ep - close) * hedge.qty;
        const hFees = hedge.notional * CFG.feeRate + close * hedge.qty * CFG.feeRate;
        const hPnl  = hRaw - hFees;
        hedgeGrossPnl += hPnl;
        capital += hPnl;
        hedge = null;
        hedgeArmed = false; // don't re-fire until next episode
      }
    }

    // Exits
    if (longs.length > 0) {
      const tQty = longs.reduce((s,p) => s+p.qty, 0);
      const avgE = longs.reduce((s,p) => s+p.ep*p.qty, 0) / tQty;
      const avgPnlPct = (close - avgE) / avgE * 100;
      const ageH = (ts - longs[0].et) / 3600000;
      const stale = CFG.staleHours > 0 && ageH >= CFG.staleHours && avgPnlPct < 0;
      const tpPct = stale ? CFG.reducedTpPct : CFG.tpPct;
      const tpPrice = avgE * (1 + tpPct / 100);

      if (high >= tpPrice)                                                                            { closeLongs(tpPrice, ts, stale ? "STALE" : "TP"); continue; }
      if (avgPnlPct <= CFG.emergencyKillPct)                                                         { closeLongs(close, ts, "KILL"); continue; }
      if (ageH >= CFG.hardFlattenHours && avgPnlPct <= CFG.hardFlattenPct && isHostile(trendGate,ts)){ closeLongs(close, ts, "FLAT"); continue; }
    }

    // Entries
    const gap = (ts - lastAdd) / 60000;
    if (longs.length < CFG.maxPositions && gap >= CFG.addIntervalMin && !isHostile(trendGate, ts)) {
      const crsi = getCrsi(ts);
      const lvl = longs.length;
      const notional = CFG.basePos * Math.pow(CFG.scaleFactor, lvl);
      const usedMargin = longs.reduce((s,p) => s+p.notional/50, 0) + (hedge ? hedge.notional/50 : 0);
      const margin = notional / 50;
      if (capital - usedMargin < margin || capital <= 0) continue;

      longs.push({ ep: close, et: ts, qty: notional/close, notional });
      currentRungs.push({
        ts, date: new Date(ts).toISOString().slice(0,16),
        price: close, rungIdx: lvl, crsi4H: crsi, notional,
      });
      lastAdd = ts;
    }
  }

  return { episodes, finalEq: capital, maxDD, hedgesFired, hedgeGrossPnl };
}

// ── Hedge threshold sweep ─────────────────────────────────────────
console.log(`\n${SEP}`);
console.log(`  CRSI IN-FLIGHT HEDGE SWEEP — short 20% notional when CRSI 4H < threshold`);
console.log(`  Close hedge when CRSI recovers >= 35`);
console.log(SEP);
console.log(`  ${"Config".padEnd(18)} ${"Episodes".padEnd(10)} ${"Win%".padEnd(7)} ${"Total PnL".padEnd(12)} ${"Final Eq".padEnd(12)} ${"MaxDD".padEnd(9)} ${"Hedges".padEnd(8)} ${"Hedge PnL"}`);
console.log("  " + "─".repeat(90));

// Baseline (no hedge)
{
  const wr = eps.filter(e=>e.episodePnl>0).length/eps.length*100;
  console.log(`  ${"No hedge".padEnd(18)} ${String(eps.length).padEnd(10)} ${wr.toFixed(0).padStart(3)}%  PnL=${$(sum(eps.map(e=>e.episodePnl))).padStart(8)}  Eq=$${base.finalEq.toFixed(0).padStart(7)}  DD=${base.maxDD.toFixed(1).padStart(6)}%  ${"—".padEnd(8)} —`);
}

for (const threshold of [35, 30, 25, 20, 15]) {
  const r = runSimWithCrsiHedge(threshold, 0.20);
  const wr = r.episodes.length ? r.episodes.filter(e=>e.episodePnl>0).length/r.episodes.length*100 : 0;
  const totalPnl = sum(r.episodes.map(e=>e.episodePnl));
  const label = `CRSI<${threshold} h=20%`;
  console.log(`  ${label.padEnd(18)} ${String(r.episodes.length).padEnd(10)} ${wr.toFixed(0).padStart(3)}%  PnL=${$(totalPnl).padStart(8)}  Eq=$${r.finalEq.toFixed(0).padStart(7)}  DD=${r.maxDD.toFixed(1).padStart(6)}%  ${String(r.hedgesFired).padEnd(8)} ${$(r.hedgeGrossPnl)}`);
}
// Also test 50% hedge size at best threshold
for (const threshold of [25, 20]) {
  const r = runSimWithCrsiHedge(threshold, 0.50);
  const wr = r.episodes.length ? r.episodes.filter(e=>e.episodePnl>0).length/r.episodes.length*100 : 0;
  const totalPnl = sum(r.episodes.map(e=>e.episodePnl));
  const label = `CRSI<${threshold} h=50%`;
  console.log(`  ${label.padEnd(18)} ${String(r.episodes.length).padEnd(10)} ${wr.toFixed(0).padStart(3)}%  PnL=${$(totalPnl).padStart(8)}  Eq=$${r.finalEq.toFixed(0).padStart(7)}  DD=${r.maxDD.toFixed(1).padStart(6)}%  ${String(r.hedgesFired).padEnd(8)} ${$(r.hedgeGrossPnl)}`);
}

// ── Lead time: how early does CRSI signal vs the kill ─────────────
console.log(`\n  ── Lead time on kill episodes: when did CRSI first cross < 25? ──`);
console.log(`  ${"Episode".padEnd(20)} ${"Kill time".padEnd(18)} ${"CRSI<25 first".padEnd(20)} ${"Lead hours".padEnd(12)} ${"Hedge would have saved?"}`);
console.log("  " + "─".repeat(85));
const killEps = eps.filter(e => e.closeReason === "KILL");
for (const ep of killEps) {
  const openTs  = ep.rungs[0]?.ts ?? 0;
  const closeTs = ep.closeTs;
  // Find first 5m candle in this episode where CRSI < 25
  let firstCrsiHitTs: number | null = null;
  for (const c of c5m) {
    if (c.timestamp < openTs || c.timestamp > closeTs) continue;
    const crsi = getCrsi(c.timestamp);
    if (crsi !== null && crsi < 25) { firstCrsiHitTs = c.timestamp; break; }
  }
  const leadH = firstCrsiHitTs !== null ? (closeTs - firstCrsiHitTs) / 3600000 : 0;
  const saved  = firstCrsiHitTs !== null && firstCrsiHitTs < closeTs;
  console.log(
    `  ${(ep.rungs[0]?.date ?? "?").padEnd(20)}` +
    `  ${new Date(closeTs).toISOString().slice(0,16).padEnd(18)}` +
    `  ${firstCrsiHitTs ? new Date(firstCrsiHitTs).toISOString().slice(0,16) : "never".padEnd(16)}` +
    `  ${saved ? leadH.toFixed(1)+"h lead" : "no signal"}` +
    `  ${$(ep.episodePnl)}`
  );
}

// ── Stress hedge overlap analysis ─────────────────────────────────
// Builds 1H RSI14 and ROC5 series to simulate when the live stress
// hedge (≥9 rungs + avgPnl ≤-2.5% + RSI1H ≤40 + ROC5 ≤-3.5%) would
// have fired vs when CRSI4H < 25 would have fired.
// Also checks deepHold path: avgPnl ≤-4.0% + RSI1H ≤50 + ageH ≥6.

console.log(`\n${SEP}`);
console.log(`  STRESS HEDGE vs CRSI OVERLAP — Kill episodes`);
console.log(`  Stress path1: rungs≥9, avgPnl≤-2.5%, RSI1H≤40, ROC5≤-3.5%`);
console.log(`  Stress path2: avgPnl≤-4.0%, RSI1H≤50, age≥6h`);
console.log(`  CRSI signal:  CRSI4H < 25`);
console.log(SEP);

// Build 1H series
const c1H = aggregate(c5m, 60).filter(c => new Date(c.timestamp).toISOString() >= CFG.startDate);
const closes1H = c1H.map(b => b.close);

// RSI14 map
const rsi1HMap = new Map<number, number>();
{
  const rsiVals = RSI.calculate({ period: 14, values: closes1H });
  const offset  = closes1H.length - rsiVals.length;
  for (let i = 0; i < rsiVals.length; i++) rsi1HMap.set(c1H[i + offset].timestamp, rsiVals[i]);
}

// ROC5 map (5-bar rate of change on 1H)
const roc5Map = new Map<number, number>();
for (let i = 5; i < closes1H.length; i++) {
  const roc = (closes1H[i] - closes1H[i - 5]) / closes1H[i - 5] * 100;
  roc5Map.set(c1H[i].timestamp, +roc.toFixed(4));
}

// Binary search helpers for 1H maps
const ts1H = c1H.map(b => b.timestamp);
function lookup1H(map: Map<number, number>, ts: number): number | null {
  let lo = 0, hi = ts1H.length - 1, res = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (ts1H[mid] <= ts) { res = mid; lo = mid + 1; } else hi = mid - 1; }
  if (res < 0) return null;
  return map.get(ts1H[res]) ?? null;
}

// Stress hedge thresholds (from live config)
const MIN_RUNGS      = 9;
const PNL_TRIGGER    = -2.5;
const RSI1H_MAX      = 40;
const ROC5_MAX       = -3.5;
const DH_PNL_TRIGGER = -4.0;
const DH_RSI1H_MAX   = 50;
const DH_MIN_AGE_H   = 6;
const CRSI_THRESH    = 25;

console.log(`\n  ${"Episode open".padEnd(18)} ${"Kill at".padEnd(18)} ${"Stress P1".padEnd(18)} ${"Stress P2".padEnd(18)} ${"CRSI<25".padEnd(18)} ${"Winner (earlier)"}`);
console.log("  " + "─".repeat(110));

for (const ep of killEps) {
  const openTs  = ep.rungs[0]?.ts ?? 0;
  const closeTs = ep.closeTs;
  const openDate = ep.rungs[0]?.date ?? "?";

  let stressP1Ts: number | null = null;
  let stressP2Ts: number | null = null;
  let crsiHitTs:  number | null = null;

  for (const c of c5m) {
    if (c.timestamp < openTs || c.timestamp > closeTs) continue;
    const ts    = c.timestamp;
    const price = c.close;

    // Active rungs at this bar
    const activeRungs = ep.rungs.filter(r => r.ts <= ts);
    const rungCount   = activeRungs.length;
    if (rungCount === 0) continue;

    const totalQty = activeRungs.reduce((s, r) => s + r.notional / r.price, 0);
    const avgEntry = activeRungs.reduce((s, r) => s + r.price * (r.notional / r.price), 0) / totalQty;
    const avgPnlPct = (price - avgEntry) / avgEntry * 100;
    const ageH = (ts - openTs) / 3600000;

    const rsi1h = lookup1H(rsi1HMap, ts);
    const roc5  = lookup1H(roc5Map,  ts);
    const crsi  = getCrsi(ts);

    // CRSI signal
    if (crsiHitTs === null && crsi !== null && crsi < CRSI_THRESH) {
      crsiHitTs = ts;
    }

    // Path 1: ≥9 rungs + avgPnl ≤ -2.5% + RSI1H ≤ 40 + ROC5 ≤ -3.5%
    if (stressP1Ts === null && rsi1h !== null && roc5 !== null &&
        rungCount >= MIN_RUNGS && avgPnlPct <= PNL_TRIGGER &&
        rsi1h <= RSI1H_MAX && roc5 <= ROC5_MAX) {
      stressP1Ts = ts;
    }

    // Path 2: avgPnl ≤ -4.0% + RSI1H ≤ 50 + ageH ≥ 6h
    if (stressP2Ts === null && rsi1h !== null &&
        avgPnlPct <= DH_PNL_TRIGGER && rsi1h <= DH_RSI1H_MAX && ageH >= DH_MIN_AGE_H) {
      stressP2Ts = ts;
    }

    if (stressP1Ts !== null && stressP2Ts !== null && crsiHitTs !== null) break;
  }

  const fmt  = (ts: number | null) => ts ? new Date(ts).toISOString().slice(0, 16) : "never           ";
  const leadH = (t: number | null) => t ? ((closeTs - t) / 3600000).toFixed(1) + "h" : "—";

  // Determine winner
  const times = [
    { name: "StressP1", ts: stressP1Ts },
    { name: "StressP2", ts: stressP2Ts },
    { name: "CRSI<25",  ts: crsiHitTs  },
  ].filter(x => x.ts !== null).sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  const winner = times[0]?.name ?? "none fired";

  console.log(`  ${openDate.padEnd(18)} ${new Date(closeTs).toISOString().slice(0,16).padEnd(18)} ${fmt(stressP1Ts).padEnd(18)} ${fmt(stressP2Ts).padEnd(18)} ${fmt(crsiHitTs).padEnd(18)} ${winner}`);
  console.log(`  ${"".padEnd(18)} ${"lead from kill:".padEnd(18)} ${leadH(stressP1Ts).padEnd(18)} ${leadH(stressP2Ts).padEnd(18)} ${leadH(crsiHitTs).padEnd(18)}`);
  console.log();
}
console.log();
