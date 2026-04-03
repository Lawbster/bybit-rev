// ─────────────────────────────────────────────
// sim-river.ts — xwave RIVER native concurrent mini-ladder sim
//
// Architecture (derived from trade reconstruction):
//   • RIVERUSDT perpetual, Long only, Cross margin 20x
//   • 1-minute poll loop (96% of first entries fire at :00-:09s)
//   • Each poll: if price has NOT hit batch TP → open new rung in active batch
//     OR: if there is no active batch → open first rung of new batch
//   • Multiple concurrent batches CAN exist (max observed: 3, typical: 1)
//   • Each batch has its own anchor entry price and TP target (entry × 1.007)
//   • Scale: ~1.6x notional per additional rung in same batch
//   • Base: ~$12-15 notional first rung
//   • TP: 0.7% unlevered (0.6% used for stale batches — confirmed NOT correlated with age/depth)
//   • No stop loss — hold until TP regardless of time
//
// Key unknowns (see CODEX_RIVER_REPLICATION.md):
//   • First rung trigger: unconditional vs down-close gated
//   • Add trigger within batch: any minute below TP vs minimum drop required
//
// This sim tests two hypotheses for add trigger:
//   A. "unconditional": open new rung every poll minute while batch below TP (capped by maxRungs)
//   B. "price-drop": only add when price < last entry × (1 - minDropPct)
//
// npx ts-node src/sim-river.ts
// ─────────────────────────────────────────────

import fs from "fs";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";

// ── Data ─────────────────────────────────────────────────────────
const c5m: Candle[] = JSON.parse(fs.readFileSync("data/RIVERUSDT_5.json", "utf-8"));
c5m.sort((a, b) => a.timestamp - b.timestamp);

// Aggregate to 1m-equivalent using 5m candles
// (open new rung every 5m poll instead of every 1m — approximation)
// 5m ≈ 5 poll opportunities. We run on 5m candles and treat each bar as one poll.
const POLL_MS = 5 * 60 * 1000; // 5m candles as proxy for 1-min poll cadence

const START_DATE = process.env.SIM_START ?? "2026-02-16"; // xwave export start
const startTs    = new Date(START_DATE).getTime();
const END_DATE   = process.env.SIM_END ?? "2026-03-26";
const endTs      = new Date(END_DATE).getTime();

const FUNDING_RATE_8H = 0.0001;

// ── Config ─────────────────────────────────────────────────────────
interface SimCfg {
  label:            string;
  baseNotional:     number;   // first rung notional ($12-15)
  scaleFactor:      number;   // 1.6x
  tpPct:            number;   // 0.7
  leverage:         number;   // 20
  feeRate:          number;
  initialCapital:   number;
  maxRungs:         number;   // max rungs per batch (observed max: 13, p90: 6)
  maxConcurrent:    number;   // max concurrent batches (observed: typically 1-2, max 3)
  maxMarginPct:     number;   // stop adding when margin > X% of capital (0 = unlimited)
  // Add trigger
  addMode:          "unconditional" | "price-drop";
  minDropPct:       number;   // for price-drop mode: only add when price < lastEntry × (1 - X%)
  // First rung trigger
  firstRungMode:    "unconditional" | "down-close"; // unconditional = open every poll; down-close = only if close < prev close
}

const BASE_CFG: SimCfg = {
  label:          "xwave-river-base",
  baseNotional:   12,
  scaleFactor:    1.6,
  tpPct:          0.7,
  leverage:       20,
  feeRate:        0.00055,
  initialCapital: 2000,
  maxRungs:       25,         // effectively uncapped — adjust if needed
  maxConcurrent:  3,
  maxMarginPct:   15,         // stop adding when margin exceeds 15% of capital (~$300 on $2k)
  addMode:        "unconditional",
  minDropPct:     0,
  firstRungMode:  "unconditional",
};

// ── Types ─────────────────────────────────────────────────────────
interface Rung {
  ep:       number;   // entry price
  et:       number;   // entry time (ms)
  qty:      number;
  notional: number;
}

interface Batch {
  id:       number;
  rungs:    Rung[];
  anchorEp: number;  // price of first rung
  tpPrice:  number;  // anchorEp × (1 + tpPct/100)
  openTs:   number;
}

interface SimResult {
  finalEq:        number;
  maxDD:          number;
  totalBatches:   number;
  totalWins:       number;
  maxConcurrent:  number;
  maxRungs:        number;
  maxNotional:    number;
  ladderPnl:      number;
  totalFunding:   number;
  monthlyPnl:     Record<string, number>;
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
  const monthlyPnl: Record<string, number> = {};

  const activeBatches: Batch[] = [];
  let prevClose = c5m[0].close;

  function usedMargin(): number {
    return activeBatches.reduce((s, b) => s + b.rungs.reduce((s2, r) => s2 + r.notional / cfg.leverage, 0), 0);
  }

  function openRung(batch: Batch, price: number, ts: number) {
    const level    = batch.rungs.length;
    const notional = cfg.baseNotional * Math.pow(cfg.scaleFactor, level);
    const margin   = notional / cfg.leverage;
    const used     = usedMargin();
    // Capital check
    if (capital - used < margin) return false;
    // Margin cap check
    if (cfg.maxMarginPct > 0 && (used + margin) / capital * 100 > cfg.maxMarginPct) return false;
    const qty = notional / price;
    batch.rungs.push({ ep: price, et: ts, qty, notional });
    return true;
  }

  function closeBatch(batch: Batch, price: number, ts: number) {
    let pnl = 0;
    for (const r of batch.rungs) {
      const raw  = (price - r.ep) * r.qty;
      const fees = r.notional * cfg.feeRate + price * r.qty * cfg.feeRate;
      const fund = r.notional * FUNDING_RATE_8H * ((ts - r.et) / (8 * 3600000));
      pnl += raw - fees - fund;
      totalFunding += fund;
    }
    capital += pnl;
    ladderPnl += pnl;
    const m = new Date(ts).toISOString().slice(0, 7);
    monthlyPnl[m] = (monthlyPnl[m] ?? 0) + pnl;
    totalBatches++;
    if (pnl > 0) totalWins++;
    return pnl;
  }

  for (const bar of c5m) {
    const { close, high, low, timestamp: ts } = bar;
    if (ts < startTs || ts > endTs) { prevClose = close; continue; }

    // ── TP check: close any batch where high >= tpPrice ───────────
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

    // ── Add rungs to existing batches ─────────────────────────────
    for (const batch of activeBatches) {
      if (batch.rungs.length >= cfg.maxRungs) continue;
      const lastRung = batch.rungs[batch.rungs.length - 1];
      let shouldAdd = false;

      if (cfg.addMode === "unconditional") {
        // Add every poll if batch is still open (price hasn't hit TP)
        shouldAdd = true;
      } else {
        // price-drop mode: only add when price < lastEntry × (1 - minDropPct%)
        shouldAdd = close <= lastRung.ep * (1 - cfg.minDropPct / 100);
      }

      if (shouldAdd) openRung(batch, close, ts);
    }

    // ── Open new batch (first rung) ───────────────────────────────
    if (activeBatches.length < cfg.maxConcurrent) {
      let shouldOpen = false;

      if (cfg.firstRungMode === "unconditional") {
        shouldOpen = true;
      } else {
        // down-close: only if price dropped from previous bar close
        shouldOpen = close < prevClose;
      }

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

  return { finalEq: capital, maxDD, totalBatches, totalWins, maxConcurrent: maxConcSeen, maxRungs: maxRungsSeen, maxNotional, ladderPnl, totalFunding, monthlyPnl };
}

// ── Output helpers ────────────────────────────────────────────────
const SEP  = "═".repeat(120);
const $n   = (v: number) => (v >= 0 ? "$+" : "$") + v.toFixed(0);

function printResult(cfg: SimCfg, r: SimResult) {
  const wr = r.totalBatches ? (r.totalWins / r.totalBatches * 100).toFixed(1) : "—";
  console.log(
    `  ${cfg.label.padEnd(40)}` +
    `  Eq=${("$"+r.finalEq.toFixed(0)).padStart(8)}` +
    `  DD=${r.maxDD.toFixed(1).padStart(5)}%` +
    `  WR=${wr.padStart(5)}%` +
    `  Batches=${String(r.totalBatches).padStart(5)}` +
    `  MaxConc=${String(r.maxConcurrent).padStart(2)}` +
    `  MaxRungs=${String(r.maxRungs).padStart(3)}` +
    `  MaxN=$${r.maxNotional.toFixed(0).padStart(6)}` +
    `  Funding=${$n(-r.totalFunding).padStart(6)}`
  );
}

function printMonthly(r: SimResult) {
  const months = Object.keys(r.monthlyPnl).sort();
  for (const m of months) {
    console.log(`    ${m}  ${$n(r.monthlyPnl[m]).padStart(8)}`);
  }
}

// ── Run sweeps ────────────────────────────────────────────────────
console.log(`\n${SEP}`);
console.log(`  SIM-RIVER — xwave RIVER native concurrent mini-ladder — ${START_DATE} → ${END_DATE}`);
console.log(`  5m candles as poll proxy | Base=$${BASE_CFG.baseNotional} Scale=${BASE_CFG.scaleFactor}x TP=${BASE_CFG.tpPct}% Lev=${BASE_CFG.leverage}x Cap=$${BASE_CFG.initialCapital}`);
console.log(SEP);
console.log(`\n  ${"Config".padEnd(40)} ${"Equity".padEnd(10)} ${"DD".padEnd(8)} ${"WR".padEnd(8)} ${"Batches".padEnd(10)} ${"MaxConc".padEnd(9)} ${"MaxRungs".padEnd(10)} ${"MaxN".padEnd(10)} Funding`);
console.log("  " + "─".repeat(110));

const sweeps: Array<Partial<SimCfg> & { label: string }> = [
  // ── Hypothesis A: unconditional add, margin-capped ────────────
  { label: "A1: uncond+uncond margin=10%",   addMode: "unconditional", firstRungMode: "unconditional", maxMarginPct: 10, maxRungs: 25 },
  { label: "A2: uncond+uncond margin=15%",   addMode: "unconditional", firstRungMode: "unconditional", maxMarginPct: 15, maxRungs: 25 },
  { label: "A3: uncond+uncond margin=20%",   addMode: "unconditional", firstRungMode: "unconditional", maxMarginPct: 20, maxRungs: 25 },
  { label: "A4: uncond+uncond cap=6rungs",   addMode: "unconditional", firstRungMode: "unconditional", maxMarginPct: 0,  maxRungs: 6  },
  { label: "A5: uncond+uncond cap=10rungs",  addMode: "unconditional", firstRungMode: "unconditional", maxMarginPct: 0,  maxRungs: 10 },

  // ── Hypothesis B: price-drop add trigger ─────────────────────
  { label: "B1: uncond + drop>0.3% marg=15%", addMode: "price-drop", minDropPct: 0.3, firstRungMode: "unconditional", maxMarginPct: 15 },
  { label: "B2: uncond + drop>0.7% marg=15%", addMode: "price-drop", minDropPct: 0.7, firstRungMode: "unconditional", maxMarginPct: 15 },
  { label: "B3: uncond + drop>1.0% marg=15%", addMode: "price-drop", minDropPct: 1.0, firstRungMode: "unconditional", maxMarginPct: 15 },
  { label: "B4: uncond + drop>0.7% marg=25%", addMode: "price-drop", minDropPct: 0.7, firstRungMode: "unconditional", maxMarginPct: 25 },
  { label: "B5: uncond + drop>0.7% cap=13",   addMode: "price-drop", minDropPct: 0.7, firstRungMode: "unconditional", maxMarginPct: 0, maxRungs: 13 },

  // ── Hypothesis C: down-close first rung ───────────────────────
  { label: "C1: dn-close + uncond marg=15%",  addMode: "unconditional", firstRungMode: "down-close", maxMarginPct: 15 },
  { label: "C2: dn-close + drop>0.7% m=15%",  addMode: "price-drop", minDropPct: 0.7, firstRungMode: "down-close", maxMarginPct: 15 },
  { label: "C3: dn-close + drop>1.0% m=15%",  addMode: "price-drop", minDropPct: 1.0, firstRungMode: "down-close", maxMarginPct: 15 },

  // ── Capital sensitivity (best add config) ─────────────────────
  { label: "Cap=$500  drop>0.7% m=15%",   initialCapital: 500,  addMode: "price-drop", minDropPct: 0.7, firstRungMode: "unconditional", maxMarginPct: 15 },
  { label: "Cap=$1000 drop>0.7% m=15%",   initialCapital: 1000, addMode: "price-drop", minDropPct: 0.7, firstRungMode: "unconditional", maxMarginPct: 15 },
  { label: "Cap=$5000 drop>0.7% m=15%",   initialCapital: 5000, addMode: "price-drop", minDropPct: 0.7, firstRungMode: "unconditional", maxMarginPct: 15 },
];

let bestLabel = "";
let bestEq = -Infinity;

for (const overrides of sweeps) {
  const cfg: SimCfg = { ...BASE_CFG, ...overrides };
  const r = runSim(cfg);
  printResult(cfg, r);
  if (r.finalEq > bestEq) { bestEq = r.finalEq; bestLabel = cfg.label; }
}

// ── Best config with monthly breakdown ────────────────────────────
console.log(`\n${SEP}`);
console.log(`  Best: ${bestLabel}  →  $${bestEq.toFixed(0)}`);
console.log(SEP);

// Print monthly for the base uncond config
const baseCfg: SimCfg = { ...BASE_CFG, label: "base (monthly)" };
const baseResult = runSim(baseCfg);
console.log(`\n  Monthly PnL — ${baseCfg.label}:`);
printMonthly(baseResult);
console.log(`\n  NOTE: 5m candles used as 1-min poll proxy (5x undercount of actual trade opportunities)`);
console.log(`  Real bot at 1-min cadence would generate ~5x more batches at similar WR.`);
