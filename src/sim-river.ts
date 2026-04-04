// ─────────────────────────────────────────────
// sim-river.ts — xwave RIVER native concurrent mini-ladder sim
//
// Architecture (derived from trade reconstruction):
//   • RIVERUSDT perpetual, Long only, Cross margin 20x
//   • 1-min poll loop — real 1m candles (RIVERUSDT_1.json, Feb 16–Apr 3)
//   • Each poll: open first rung of new batch OR add rung to existing batch
//   • Batch TP = anchor × (1 + tpPct/100) — all rungs close together
//   • Scale ~1.6x notional per add, base ~$12
//   • No stop loss — hold until TP
//
// Regime filter (crash escape):
//   • trendGate:   block new batch opens when 4H close < EMA200 AND EMA50 slope < 0
//   • atrGate:     block new batch opens when 4H ATR% > atrThreshold
//   • addGate:     also block adds to existing batches when both gates fire (optional)
//   • Existing batches ALWAYS ride to TP — gate only blocks new entries
//
// npx ts-node src/sim-river.ts
// SIM_START=2026-02-16 SIM_END=2026-04-03 npx ts-node src/sim-river.ts
// ─────────────────────────────────────────────

import fs from "fs";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";

// ── Data ──────────────────────────────────────────────────────────
// Symbol can be overridden via SYMBOL env var (default RIVERUSDT).
// Loads 1m if available, merges with 5m for earlier history.
const SYMBOL = process.env.SYMBOL ?? "RIVERUSDT";
const path1m = `data/${SYMBOL}_1.json`;
const path5m = `data/${SYMBOL}_5.json`;
const pathFull = `data/${SYMBOL}_5_full.json`;

function loadFile(p: string): Candle[] {
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const raw1m = loadFile(path1m);
const raw5m = loadFile(fs.existsSync(pathFull) ? pathFull : path5m);

// If we have 1m data, merge: 5m for pre-1m history, 1m from its start onward
const allBars: Candle[] = (() => {
  if (raw1m.length === 0) return raw5m.sort((a, b) => a.timestamp - b.timestamp);
  const merge1mStart = Math.min(...raw1m.map(b => b.timestamp));
  return [
    ...raw5m.filter(b => b.timestamp < merge1mStart),
    ...raw1m,
  ].sort((a, b) => a.timestamp - b.timestamp);
})();

if (allBars.length === 0) { console.error(`No data found for ${SYMBOL}`); process.exit(1); }

const c4H = aggregate(allBars, 240);

const START_DATE = process.env.SIM_START ?? (allBars[0] ? new Date(allBars[0].timestamp).toISOString().slice(0,10) : "2025-10-22");
const END_DATE   = process.env.SIM_END   ?? new Date(allBars[allBars.length-1].timestamp).toISOString().slice(0,10);
const startTs    = new Date(START_DATE).getTime();
const endTs      = new Date(END_DATE + "T23:59:59Z").getTime();

const FUNDING_RATE_8H = 0.0001;

// ── Precompute 4H indicators ──────────────────────────────────────
function emaArr(vals: number[], p: number): number[] {
  const k = 2 / (p + 1); const r = [vals[0]];
  for (let i = 1; i < vals.length; i++) r.push(vals[i] * k + r[i-1] * (1 - k));
  return r;
}

function atrArr(bars: Candle[], p: number): number[] {
  const tr = [bars[0].high - bars[0].low];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high, l = bars[i].low, pc = bars[i-1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const k = 2 / (p + 1); let a = tr[0]; const out = [a];
  for (let i = 1; i < tr.length; i++) { a = tr[i] * k + a * (1 - k); out.push(a); }
  return out;
}

const closes4H = c4H.map(b => b.close);
const e200_4H  = emaArr(closes4H, 200);
const e50_4H   = emaArr(closes4H, 50);
const atr14_4H = atrArr(c4H, 14);
const ts4H     = c4H.map(b => b.timestamp);

// Binary search — last 4H bar at or before ts
function bsearch(arr: number[], target: number): number {
  let lo = 0, hi = arr.length - 1, res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= target) { res = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return res;
}

// Returns { hostile, atrPct } at given timestamp (uses last completed 4H bar).
// warmupBars: number of 4H bars required before trendGate is trusted (EMA200 needs ~200).
function getRegime(ts: number, warmupBars = 200): { hostile: boolean; atrPct: number } {
  const i = bsearch(ts4H, ts);
  if (i < 1) return { hostile: false, atrPct: 0 };
  const idx = i - 1; // last completed bar
  // Not enough history for EMAs to be meaningful — treat as benign
  if (idx < warmupBars) return { hostile: false, atrPct: 0 };
  const cl  = closes4H[idx];
  const hostile = cl < e200_4H[idx] && e50_4H[idx] < e50_4H[idx - 1 < 0 ? 0 : idx - 1];
  const atrPct  = (atr14_4H[idx] / cl) * 100;
  return { hostile, atrPct };
}

// ── Config ─────────────────────────────────────────────────────────
interface SimCfg {
  label:           string;
  baseNotional:    number;
  scaleFactor:     number;
  tpPct:           number;
  leverage:        number;
  feeRate:         number;
  initialCapital:  number;
  maxRungs:        number;
  maxConcurrent:   number;
  maxMarginPct:    number;   // 0 = unlimited
  // Add trigger: CONFIRMED from trade data — all rungs open at anchor price, time-triggered.
  // addMode / minDropPct removed — adds are unconditional per poll tick.
  // First rung trigger
  firstRungMode:   "unconditional" | "down-close";
  // Regime gates
  trendGate:       boolean;  // block new opens when 4H hostile
  atrGate:         boolean;  // block new opens when 4H ATR% > atrThreshold
  atrThreshold:    number;   // default 10% (RIVER normal ~7%, crash = 12%+)
  gateAdds:        boolean;  // also block adds to existing batches when BOTH gates fire
  gateWarmupBars:  number;   // 4H bars before trendGate is trusted (EMA200 needs ~200 = 33 days)
}

const BASE_CFG: SimCfg = {
  label:          "base",
  baseNotional:   12,
  scaleFactor:    1.6,
  tpPct:          0.7,
  leverage:       20,
  feeRate:        0.00055,
  initialCapital: 2000,
  maxRungs:       25,
  maxConcurrent:  3,
  maxMarginPct:   15,
  firstRungMode:  "unconditional",
  trendGate:      false,
  atrGate:        false,
  atrThreshold:   10,
  gateAdds:       false,
  gateWarmupBars: 200,   // ~33 days of 4H bars for EMA200 to stabilize
};

// ── Types ─────────────────────────────────────────────────────────
interface Rung  { ep: number; et: number; qty: number; notional: number; }
interface Batch { id: number; rungs: Rung[]; anchorEp: number; tpPrice: number; openTs: number; }

interface SimResult {
  finalEq:       number;
  maxDD:         number;
  totalBatches:  number;
  totalWins:     number;
  maxConcurrent: number;
  maxRungs:      number;
  maxNotional:   number;
  ladderPnl:     number;
  totalFunding:  number;
  gatedBars:     number;   // bars where new opens were blocked by regime
  monthlyPnl:    Record<string, number>;
  monthlyGated:  Record<string, number>;
}

// ── Core sim ──────────────────────────────────────────────────────
function runSim(cfg: SimCfg): SimResult {
  let capital      = cfg.initialCapital;
  let peakEq       = capital;
  let maxDD        = 0;
  let batchSeq     = 0;
  let maxConcSeen  = 0;
  let maxRungsSeen = 0;
  let maxNotional  = 0;
  let totalBatches = 0;
  let totalWins    = 0;
  let ladderPnl    = 0;
  let totalFunding = 0;
  let gatedBars    = 0;
  const monthlyPnl: Record<string, number>    = {};
  const monthlyGated: Record<string, number>  = {};

  const activeBatches: Batch[] = [];
  let prevClose = allBars[0].close;

  function usedMargin(): number {
    return activeBatches.reduce((s, b) => s + b.rungs.reduce((s2, r) => s2 + r.notional / cfg.leverage, 0), 0);
  }

  function openRung(batch: Batch, price: number, ts: number): boolean {
    const level    = batch.rungs.length;
    const notional = cfg.baseNotional * Math.pow(cfg.scaleFactor, level);
    const margin   = notional / cfg.leverage;
    const used     = usedMargin();
    if (capital - used < margin) return false;
    if (cfg.maxMarginPct > 0 && (used + margin) / capital * 100 > cfg.maxMarginPct) return false;
    batch.rungs.push({ ep: price, et: ts, qty: notional / price, notional });
    return true;
  }

  function closeBatch(batch: Batch, price: number, ts: number): number {
    let pnl = 0;
    for (const r of batch.rungs) {
      const raw  = (price - r.ep) * r.qty;
      const fees = r.notional * cfg.feeRate + price * r.qty * cfg.feeRate;
      const fund = r.notional * FUNDING_RATE_8H * ((ts - r.et) / (8 * 3600000));
      pnl += raw - fees - fund;
      totalFunding += fund;
    }
    capital  += pnl;
    ladderPnl += pnl;
    const m = new Date(ts).toISOString().slice(0, 7);
    monthlyPnl[m] = (monthlyPnl[m] ?? 0) + pnl;
    totalBatches++;
    if (pnl > 0) totalWins++;
    return pnl;
  }

  for (const bar of allBars) {
    const { close, high, timestamp: ts } = bar;
    if (ts < startTs || ts > endTs) { prevClose = close; continue; }

    // ── TP check — always runs, regime doesn't block exits ────────
    for (let i = activeBatches.length - 1; i >= 0; i--) {
      const batch = activeBatches[i];
      if (high >= batch.tpPrice) {
        const n = batch.rungs.reduce((s, r) => s + r.notional, 0);
        if (n > maxNotional) maxNotional = n;
        if (batch.rungs.length > maxRungsSeen) maxRungsSeen = batch.rungs.length;
        closeBatch(batch, batch.tpPrice, ts);
        activeBatches.splice(i, 1);
      }
    }

    // ── DD tracking ───────────────────────────────────────────────
    const ur = activeBatches.reduce((s, b) => s + b.rungs.reduce((s2, r) => s2 + (close - r.ep) * r.qty, 0), 0);
    const eq = capital + ur;
    if (eq > peakEq) peakEq = eq;
    const dd = peakEq > 0 ? (peakEq - eq) / peakEq * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    // ── Regime check ──────────────────────────────────────────────
    const { hostile, atrPct } = getRegime(ts, cfg.gateWarmupBars);
    const trendBlocked = cfg.trendGate && hostile;
    const atrBlocked   = cfg.atrGate   && atrPct > cfg.atrThreshold;
    const gated        = trendBlocked || atrBlocked;
    const bothGated    = trendBlocked && atrBlocked; // both must fire to gate adds

    if (gated) {
      gatedBars++;
      const m = new Date(ts).toISOString().slice(0, 7);
      monthlyGated[m] = (monthlyGated[m] ?? 0) + 1;
    }

    // ── Add rungs to existing batches ─────────────────────────────
    // KEY FINDING from trade reconstruction: ALL rungs in a batch open at the
    // ANCHOR price (rung 1 entry). This is time-triggered, NOT price-drop triggered.
    // Price hasn't moved between rungs — bot scales into the same level every N minutes
    // until TP fires.
    const addGated = cfg.gateAdds && bothGated;

    for (const batch of activeBatches) {
      if (addGated) continue;
      if (batch.rungs.length >= cfg.maxRungs) continue;
      // Open next rung at the ANCHOR price (same as rung 1), time-triggered
      openRung(batch, batch.anchorEp, ts);
    }

    // ── Open new batch — blocked entirely when gated ──────────────
    if (!gated && activeBatches.length < cfg.maxConcurrent) {
      const shouldOpen = cfg.firstRungMode === "unconditional"
        ? true
        : close < prevClose;

      if (shouldOpen && capital > cfg.baseNotional / cfg.leverage) {
        const anchorEp = close;
        const tpPrice  = anchorEp * (1 + cfg.tpPct / 100);
        const batch: Batch = { id: batchSeq++, rungs: [], anchorEp, tpPrice, openTs: ts };
        if (openRung(batch, close, ts)) {
          activeBatches.push(batch);
          if (activeBatches.length > maxConcSeen) maxConcSeen = activeBatches.length;
        }
      }
    }

    prevClose = close;
  }

  return { finalEq: capital, maxDD, totalBatches, totalWins, maxConcurrent: maxConcSeen,
    maxRungs: maxRungsSeen, maxNotional, ladderPnl, totalFunding, gatedBars, monthlyPnl, monthlyGated };
}

// ── Output ────────────────────────────────────────────────────────
const SEP = "═".repeat(130);
const $n  = (v: number) => (v >= 0 ? "$+" : "$") + v.toFixed(0);

function printResult(cfg: SimCfg, r: SimResult) {
  const wr = r.totalBatches ? (r.totalWins / r.totalBatches * 100).toFixed(0) : "—";
  console.log(
    `  ${cfg.label.padEnd(44)}` +
    `  Eq=${("$"+r.finalEq.toFixed(0)).padStart(8)}` +
    `  DD=${r.maxDD.toFixed(1).padStart(5)}%` +
    `  WR=${String(wr).padStart(3)}%` +
    `  Bat=${String(r.totalBatches).padStart(4)}` +
    `  MaxR=${String(r.maxRungs).padStart(3)}` +
    `  MaxN=$${r.maxNotional.toFixed(0).padStart(6)}` +
    `  Gated=${String(r.gatedBars).padStart(5)}` +
    `  Fund=${$n(-r.totalFunding).padStart(5)}`
  );
}

function printMonthly(label: string, r: SimResult) {
  console.log(`\n  ── Monthly: ${label} ──`);
  console.log(`  ${"Month".padEnd(8)} ${"PnL".padEnd(10)} ${"GatedBars".padEnd(12)} Note`);
  console.log("  " + "─".repeat(50));
  const months = new Set([...Object.keys(r.monthlyPnl), ...Object.keys(r.monthlyGated)]);
  for (const m of [...months].sort()) {
    const pnl    = r.monthlyPnl[m]    ?? 0;
    const gated  = r.monthlyGated[m]  ?? 0;
    const note   = gated > 500 ? " ← regime blocked" : gated > 100 ? " ← partial block" : "";
    console.log(`  ${m}  ${$n(pnl).padStart(8)}  gated=${String(gated).padStart(5)}${note}`);
  }
}

// ── Sweeps ────────────────────────────────────────────────────────
console.log(`\n${SEP}`);
console.log(`  SIM-RIVER — ${SYMBOL} concurrent mini-ladder + regime filter — ${START_DATE} → ${END_DATE}`);
console.log(`  Base=$${BASE_CFG.baseNotional} Scale=${BASE_CFG.scaleFactor}x TP=${BASE_CFG.tpPct}% Lev=${BASE_CFG.leverage}x Cap=$${BASE_CFG.initialCapital} | real 1m candles`);
console.log(SEP);
console.log(`\n  ${"Config".padEnd(44)} ${"Equity".padEnd(10)} ${"DD".padEnd(8)} ${"WR".padEnd(5)} ${"Bat".padEnd(7)} ${"MaxR".padEnd(7)} ${"MaxN".padEnd(10)} ${"Gated".padEnd(8)} Fund`);
console.log("  " + "─".repeat(120));

// NOTE: Adds are now correctly modeled as anchor-price / time-triggered (confirmed from trade data).
// All rungs in a batch open at the anchor (rung 1) price. No price-drop add trigger.
// $5k capital, varying base notional + scale factor to reduce notional pressure.
// Rung stack at 8 rungs (realistic worst case):
//   base=$5  scale=1.4x: $5, $7, $10, $14, $19, $27, $38, $53  → total $173  margin=$8.65 at 20x
//   base=$5  scale=1.6x: $5, $8, $13, $20, $33, $52, $84, $134 → total $349  margin=$17.45 at 20x
//   base=$10 scale=1.4x: $10,$14,$20,$27,$38,$53,$74,$104       → total $340  margin=$17 at 20x
//   base=$10 scale=1.6x: $10,$16,$26,$41,$66,$105,$168,$269     → total $701  margin=$35 at 20x
const CAP = 5000;
const sweeps: Array<Partial<SimCfg> & { label: string }> = [
  // ── xwave original sizing on $5k (reference) ──────────────────
  { label: "xwave sizing: base=$12 scale=1.6x m=15%",    initialCapital: CAP, baseNotional: 12, scaleFactor: 1.6, maxMarginPct: 15 },

  // ── Reduced base, same scale ───────────────────────────────────
  { label: "base=$5  scale=1.6x m=10%",                  initialCapital: CAP, baseNotional: 5,  scaleFactor: 1.6, maxMarginPct: 10 },
  { label: "base=$5  scale=1.6x m=5%",                   initialCapital: CAP, baseNotional: 5,  scaleFactor: 1.6, maxMarginPct: 5  },
  { label: "base=$8  scale=1.6x m=10%",                  initialCapital: CAP, baseNotional: 8,  scaleFactor: 1.6, maxMarginPct: 10 },

  // ── Reduced scale (less aggressive pyramid) ───────────────────
  { label: "base=$5  scale=1.4x m=10%",                  initialCapital: CAP, baseNotional: 5,  scaleFactor: 1.4, maxMarginPct: 10 },
  { label: "base=$10 scale=1.4x m=10%",                  initialCapital: CAP, baseNotional: 10, scaleFactor: 1.4, maxMarginPct: 10 },
  { label: "base=$10 scale=1.4x m=5%",                   initialCapital: CAP, baseNotional: 10, scaleFactor: 1.4, maxMarginPct: 5  },

  // ── Lower leverage ────────────────────────────────────────────
  { label: "base=$10 scale=1.4x lev=10x m=10%",          initialCapital: CAP, baseNotional: 10, scaleFactor: 1.4, leverage: 10, maxMarginPct: 10 },
  { label: "base=$10 scale=1.4x lev=10x m=5%",           initialCapital: CAP, baseNotional: 10, scaleFactor: 1.4, leverage: 10, maxMarginPct: 5  },

  // ── With trendGate on best candidates ─────────────────────────
  { label: "base=$10 scale=1.4x m=5% gate",              initialCapital: CAP, baseNotional: 10, scaleFactor: 1.4, maxMarginPct: 5,  trendGate: true },
  { label: "base=$5  scale=1.4x m=5% gate",              initialCapital: CAP, baseNotional: 5,  scaleFactor: 1.4, maxMarginPct: 5,  trendGate: true },
];

let bestLabel = ""; let bestEq = -Infinity;

for (const overrides of sweeps) {
  const cfg: SimCfg = { ...BASE_CFG, ...overrides };
  const r = runSim(cfg);
  printResult(cfg, r);
  if (r.finalEq > bestEq) { bestEq = r.finalEq; bestLabel = cfg.label; }
}

console.log(`\n${SEP}`);
console.log(`  Best: ${bestLabel}  →  $${bestEq.toFixed(0)}`);
console.log(SEP);

// ── Monthly detail: baseline vs trendGate ─────────────────────
const baseResult  = runSim({ ...BASE_CFG, label: "baseline", initialCapital: CAP, baseNotional: 10, scaleFactor: 1.4, maxMarginPct: 5 });
const gatedResult = runSim({ ...BASE_CFG, label: "gated",    initialCapital: CAP, baseNotional: 10, scaleFactor: 1.4, maxMarginPct: 5, trendGate: true });

printMonthly("baseline (no gate)", baseResult);
printMonthly("trendGate only", gatedResult);

console.log(`\n  NOTE: Adds are anchor-price / time-triggered (confirmed from real xwave trade reconstruction).`);
console.log(`  All rungs in a batch open at rung-1 entry price. No price-drop trigger between rungs.`);
console.log(`  Gated bars = bars where trendGate blocked new batch opens.`);
