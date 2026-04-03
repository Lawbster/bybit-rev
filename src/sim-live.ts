// ─────────────────────────────────────────────
// sim-live.ts — canonical live-config backtest
//
// Reads bot-config.json directly.
// Replicates every feature of the live bot:
//   • DCA ladder with price-trigger adds
//   • 4H trend gate (EMA200 + EMA50 slope)
//   • BTC 1H crash / risk-off gate (120m cooldown)
//   • Ladder-local kill (blocks adds: ≥12h underwater & avgPnl ≤ -3%)
//   • Emergency kill (avgPnl ≤ -10%)
//   • Hard flatten (≥40h + avgPnl ≤ -6% + trend hostile)
//   • Soft stale (≥8h + avgPnl < 0 → reduce TP to 0.3%)
//   • Stress hedge path 1 (≥9 rungs + avgPnl ≤-2.5% + RSI1H ≤40 + ROC5 ≤-3.5%)
//   • Stress hedge path 2 (fully loaded + avgPnl ≤-4% + age ≥6h + RSI1H ≤50)
//   • Hedge blockHighVol gate (ATR14% > 1.5× 100-bar median)
//   • Hedge TP at -2% / kill at +3% / 60m cooldown
//
// npx ts-node src/sim-live.ts
// ─────────────────────────────────────────────

import fs from "fs";
import { RSI, EMA, ATR } from "technicalindicators";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";
import { loadBotConfig } from "./bot/bot-config";

// ── Config ────────────────────────────────────────────────────────
const cfg = loadBotConfig();
const START_DATE = process.env.SIM_START ?? "2025-01-01";
const startTs    = new Date(START_DATE).getTime();
const FUNDING_RATE_8H = 0.0001; // estimated funding cost

// ── Data ─────────────────────────────────────────────────────────
const c5m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
c5m.sort((a, b) => a.timestamp - b.timestamp);

const btc5m: Candle[] = JSON.parse(fs.readFileSync("data/BTCUSDT_5_full.json", "utf-8"));
btc5m.sort((a, b) => a.timestamp - b.timestamp);

// ── Aggregation ───────────────────────────────────────────────────
const c4H  = aggregate(c5m,   240);
const c1H  = aggregate(c5m,    60);
const btc1H = aggregate(btc5m,  60);

// ── EMA helper ───────────────────────────────────────────────────
function ema(vals: number[], p: number): number[] {
  const k = 2 / (p + 1); const r = [vals[0]];
  for (let i = 1; i < vals.length; i++) r.push(vals[i] * k + r[i-1] * (1 - k));
  return r;
}

// ── Binary search: most recent bar timestamp <= ts ────────────────
function bsearch(ts: number[], target: number): number {
  let lo = 0, hi = ts.length - 1, res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= target) { res = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return res;
}

// ── Precompute: 4H trend hostile map ─────────────────────────────
// hostile = close < EMA200 AND EMA50 slope negative (last completed 4H bar)
console.log("Precomputing 4H trend gate...");
const trendHostileMap = new Map<number, boolean>();
{
  const closes = c4H.map(b => b.close);
  const e200 = ema(closes, 200);
  const e50  = ema(closes, 50);
  for (let i = 1; i < c4H.length; i++) {
    trendHostileMap.set(c4H[i].timestamp, closes[i] < e200[i] && e50[i] < e50[i-1]);
  }
}
const ts4H = c4H.map(b => b.timestamp);

function isTrendHostile(ts: number): boolean {
  const i = bsearch(ts4H, ts);
  if (i < 1) return false;
  // Use the bar BEFORE current (last completed 4H bar)
  return trendHostileMap.get(c4H[i-1].timestamp) ?? false;
}

// ── Precompute: BTC 1H close-to-close returns ─────────────────────
// For each 1H bar: return% = (close - prevClose) / prevClose * 100
console.log("Precomputing BTC 1H returns...");
const btcRetMap = new Map<number, number>();
{
  for (let i = 1; i < btc1H.length; i++) {
    const ret = (btc1H[i].close - btc1H[i-1].close) / btc1H[i-1].close * 100;
    btcRetMap.set(btc1H[i].timestamp, +ret.toFixed(4));
  }
}
const tsBtc1H = btc1H.map(b => b.timestamp);

function getBtcRet(ts: number): number | null {
  const i = bsearch(tsBtc1H, ts);
  if (i < 1) return null;
  // Use last completed 1H bar
  return btcRetMap.get(btc1H[i-1].timestamp) ?? null;
}

// ── Precompute: 1H HYPE RSI14 ────────────────────────────────────
console.log("Precomputing 1H RSI14...");
const rsi1HMap = new Map<number, number>();
{
  const closes = c1H.map(b => b.close);
  const vals   = RSI.calculate({ period: 14, values: closes });
  const offset = closes.length - vals.length;
  for (let i = 0; i < vals.length; i++) rsi1HMap.set(c1H[i + offset].timestamp, vals[i]);
}
const ts1H = c1H.map(b => b.timestamp);

function getRsi1H(ts: number): number | null {
  // Use last completed 1H bar (i-1)
  const i = bsearch(ts1H, ts);
  if (i < 1) return null;
  return rsi1HMap.get(c1H[i-1].timestamp) ?? null;
}

// ── Precompute: 1H HYPE ROC5 ─────────────────────────────────────
const roc5Map = new Map<number, number>();
{
  const closes = c1H.map(b => b.close);
  for (let i = 5; i < closes.length; i++) {
    const roc = (closes[i] - closes[i-5]) / closes[i-5] * 100;
    roc5Map.set(c1H[i].timestamp, +roc.toFixed(4));
  }
}

function getRoc5(ts: number): number | null {
  const i = bsearch(ts1H, ts);
  if (i < 1) return null;
  return roc5Map.get(c1H[i-1].timestamp) ?? null;
}

// ── Precompute: 1H HYPE ATR14% + 100-bar rolling median ──────────
// Used for hedge blockHighVol gate
console.log("Precomputing 1H ATR for hedge vol gate...");
const hedgeVolBlockMap = new Map<number, boolean>(); // ts → blocked?
{
  const highs  = c1H.map(b => b.high);
  const lows   = c1H.map(b => b.low);
  const closes = c1H.map(b => b.close);
  const atr14  = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
  const offset = closes.length - atr14.length;

  for (let i = 0; i < atr14.length; i++) {
    const barIdx  = i + offset;
    const atrPct  = (atr14[i] / closes[barIdx]) * 100;
    const lookback = Math.min(100, i + 1);
    const window: number[] = [];
    for (let k = Math.max(0, i - lookback + 1); k <= i; k++) {
      const bIdx = k + offset;
      window.push((atr14[k] / closes[bIdx]) * 100);
    }
    window.sort((a, b) => a - b);
    const med = window[Math.floor(window.length / 2)];
    hedgeVolBlockMap.set(c1H[barIdx].timestamp, med > 0 && atrPct > med * cfg.hedge.atrVolMultiplier);
  }
}

function isHedgeVolBlocked(ts: number): boolean {
  const i = bsearch(ts1H, ts);
  if (i < 1) return false;
  return hedgeVolBlockMap.get(c1H[i-1].timestamp) ?? false;
}

// ── Precompute: CRSI 4H ───────────────────────────────────────────
// ConnorsRSI(3,2,100) on 4H bars
console.log("Precomputing CRSI 4H...");
const crsi4HMap = new Map<number, number>();
{
  const closes = c4H.map(b => b.close);
  const minLen = 103;
  for (let i = minLen; i < closes.length; i++) {
    const sl = closes.slice(0, i + 1);
    const r3  = RSI.calculate({ period: 3, values: sl });
    const streaks: number[] = [];
    let streak = 0;
    for (let j = 1; j < sl.length; j++) {
      if      (sl[j] > sl[j-1]) streak = streak > 0 ? streak + 1 :  1;
      else if (sl[j] < sl[j-1]) streak = streak < 0 ? streak - 1 : -1;
      else streak = 0;
      streaks.push(streak);
    }
    const sr   = RSI.calculate({ period: 2, values: streaks });
    const ret  = (sl[sl.length-1] - sl[sl.length-2]) / sl[sl.length-2] * 100;
    const hist = sl.slice(-101);
    const rets = hist.slice(1).map((v, k) => (v - hist[k]) / hist[k] * 100);
    const rank = rets.filter(r => r < ret).length / rets.length * 100;
    crsi4HMap.set(c4H[i].timestamp, +((r3[r3.length-1] + sr[sr.length-1] + rank) / 3).toFixed(2));
  }
}

function getCrsi4H(ts: number): number | null {
  // Use last completed 4H bar
  const i = bsearch(ts4H, ts);
  if (i < 1) return null;
  return crsi4HMap.get(c4H[i-1].timestamp) ?? null;
}

// ── Sim state ─────────────────────────────────────────────────────
interface Pos {
  ep: number;   // entry price
  et: number;   // entry time
  qty: number;  // base asset qty
  notional: number;
}

interface HedgePos {
  ep: number;   // entry price (short)
  qty: number;
  notional: number;
  et: number;
}

interface Episode {
  openTs: number;
  openDate: string;
  closeTs: number;
  closeReason: string;
  rungs: number;
  episodePnl: number;
  durationH: number;
}

interface HedgeClose {
  ts: number;
  pnl: number;
  reason: "TP" | "KILL" | "WITH_LADDER";
}

// ── Result accumulators ───────────────────────────────────────────
interface SimResult {
  finalEq: number;
  maxDD: number;
  episodes: Episode[];
  hedgesFired: number;
  hedgePnl: number;
  hedgeCloses: HedgeClose[];
  ladderLocalKillCount: number;
  btcGateCount: number;
  trendGateCount: number;
  exitBreakdown: Record<string, number>;
}

// ── Hedge config ─────────────────────────────────────────────────
interface HedgeCfg {
  mode:       "none" | "crsi";
  threshold:  number;   // CRSI < this to fire
  rearm:      number;   // CRSI >= this to allow close (recovery exit)
  notionalPct: number;  // fraction of long notional to short
  exitMode:   "crsi-recovery" | "with-ladder"; // when to close hedge
  trendGate:  boolean;  // only fire when 4H trend hostile
}

// ── Main sim ──────────────────────────────────────────────────────
function runSim(hc: HedgeCfg): SimResult {
  let capital  = cfg.initialCapital;
  let peakEq   = capital, maxDD = 0;

  let longs:   Pos[]     = [];
  let hedge:   HedgePos | null = null;
  let lastAdd  = 0;
  let lastEntryPrice = 0;  // for price-trigger adds

  // BTC risk-off state
  let riskOffUntil = 0;

  // Hedge cooldown state (unused for CRSI hedge but kept for compat)
  let hedgeLastCloseTs   = 0;
  let hedgeLastCloseKill = false;
  let hedgeArmed = true; // reset per episode

  const episodes: Episode[] = [];
  let currentOpenTs    = 0;
  let currentOpenDate  = "";
  let hedgesFired      = 0;
  let hedgePnl         = 0;
  const hedgeCloses: HedgeClose[] = [];
  let ladderLocalKillCount = 0;
  let btcGateCount     = 0;
  let trendGateCount   = 0;
  const exitBreakdown: Record<string, number> = {};

  function recordExit(reason: string, pnl: number, ts: number, rungs: number) {
    episodes.push({
      openTs: currentOpenTs,
      openDate: currentOpenDate,
      closeTs: ts,
      closeReason: reason,
      rungs,
      episodePnl: pnl,
      durationH: currentOpenTs ? (ts - currentOpenTs) / 3600000 : 0,
    });
    exitBreakdown[reason] = (exitBreakdown[reason] ?? 0) + 1;
  }

  function closeLongs(price: number, ts: number, reason: string): number {
    let pnl = 0;
    for (const p of longs) {
      const raw  = (price - p.ep) * p.qty;
      const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
      const fund = p.notional * FUNDING_RATE_8H * ((ts - p.et) / (8 * 3600000));
      pnl += raw - fees - fund;
    }
    capital += pnl;
    // Close hedge too if open
    if (hedge) {
      const hRaw  = (hedge.ep - price) * hedge.qty;
      const hFees = hedge.notional * cfg.feeRate + price * hedge.qty * cfg.feeRate;
      const hPnl  = hRaw - hFees;
      hedgePnl += hPnl;
      capital  += hPnl;
      hedgeCloses.push({ ts, pnl: hPnl, reason: "WITH_LADDER" });
      hedgeLastCloseTs   = ts;
      hedgeLastCloseKill = false;
      hedge = null;
    }
    recordExit(reason, pnl, ts, longs.length);
    longs = [];
    lastEntryPrice = 0;
    currentOpenTs   = 0;
    currentOpenDate = "";
    hedgeArmed      = true;
    return pnl;
  }

  for (const c of c5m) {
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;

    // ── Equity / DD tracking ──────────────────────────────────────
    const longUr  = longs.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const hedgeUr = hedge ? (hedge.ep - close) * hedge.qty : 0;
    const eq = capital + longUr + hedgeUr;
    if (eq > peakEq) peakEq = eq;
    const dd = peakEq > 0 ? (peakEq - eq) / peakEq * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    // ── Position exits ────────────────────────────────────────────
    if (longs.length > 0) {
      const tQty    = longs.reduce((s, p) => s + p.qty, 0);
      const avgE    = longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPnlP = (close - avgE) / avgE * 100;
      const ageH    = (ts - longs[0].et) / 3600000;
      const hostile = isTrendHostile(ts);

      // Soft stale: reduce TP when old and underwater
      const stale  = cfg.exits.softStale && ageH >= cfg.exits.staleHours && avgPnlP < 0;
      const tpPct  = stale ? cfg.exits.reducedTpPct : cfg.tpPct;
      const tpPrice = avgE * (1 + tpPct / 100);

      // 1. Batch TP
      if (high >= tpPrice) {
        closeLongs(tpPrice, ts, stale ? "STALE_TP" : "TP");
        continue;
      }

      // 2. Emergency kill (avg PnL ≤ -10%)
      if (cfg.exits.emergencyKill && avgPnlP <= cfg.exits.emergencyKillPct) {
        closeLongs(close, ts, "EMERGENCY_KILL");
        continue;
      }

      // 3. Hard flatten (old + underwater + hostile)
      if (cfg.exits.hardFlatten && ageH >= cfg.exits.hardFlattenHours &&
          avgPnlP <= cfg.exits.hardFlattenPct && hostile) {
        closeLongs(close, ts, "HARD_FLATTEN");
        continue;
      }
    }

    // ── CRSI hedge management ────────────────────────────────────
    if (hc.mode === "crsi" && longs.length > 0) {
      const crsi = getCrsi4H(ts);

      // Open hedge: CRSI < threshold, hedge not open, episode armed
      if (!hedge && hedgeArmed && crsi !== null && crsi < hc.threshold) {
        const regimeOk = !hc.trendGate || isTrendHostile(ts);
        if (regimeOk) {
          const totalNotional = longs.reduce((s, p) => s + p.notional, 0);
          const hNotional = totalNotional * hc.notionalPct;
          hedge = { ep: close, qty: hNotional / close, notional: hNotional, et: ts };
          hedgesFired++;
        }
      }

      // Close hedge on CRSI recovery (crsi-recovery mode only)
      if (hedge && hc.exitMode === "crsi-recovery" && crsi !== null && crsi >= hc.rearm) {
        const hRaw  = (hedge.ep - close) * hedge.qty;
        const hFees = hedge.notional * cfg.feeRate + close * hedge.qty * cfg.feeRate;
        const hPnl  = hRaw - hFees;
        hedgePnl += hPnl;
        capital  += hPnl;
        hedgeCloses.push({ ts, pnl: hPnl, reason: "TP" });
        hedge      = null;
        hedgeArmed = false; // don't re-fire within same episode
      }
    }

    // ── Entry logic ───────────────────────────────────────────────
    const timeGap   = (ts - lastAdd) / 60000;
    const timeOk    = timeGap >= cfg.addIntervalMin;
    const priceOk   = cfg.priceTriggerPct > 0 && longs.length > 0 &&
                      close <= lastEntryPrice * (1 - cfg.priceTriggerPct / 100);
    const canAdd    = (timeOk || priceOk) && longs.length < cfg.maxPositions;

    if (!canAdd) continue;

    // ── Filters ───────────────────────────────────────────────────

    // Trend gate (blocks new episode starts AND new rungs within an episode)
    if (isTrendHostile(ts)) {
      trendGateCount++;
      continue;
    }

    // BTC risk-off gate
    if (ts < riskOffUntil) {
      btcGateCount++;
      continue;
    }
    // Check BTC 1H return
    const btcRet = getBtcRet(ts);
    if (btcRet !== null && btcRet < cfg.filters.btcDropPct) {
      riskOffUntil = ts + cfg.filters.riskOffCooldownMin * 60000;
      btcGateCount++;
      continue;
    }

    // Ladder-local kill: blocks new adds (not a close) when
    // oldest position has been underwater ≥12h and avgPnl ≤ -3%
    if (cfg.filters.ladderLocalKill && longs.length > 0) {
      const tQty  = longs.reduce((s, p) => s + p.qty, 0);
      const avgE  = longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPP = (close - avgE) / avgE * 100;
      const ageH  = (ts - longs[0].et) / 3600000;
      if (ageH >= cfg.filters.maxUnderwaterHours && avgPP <= cfg.filters.maxUnderwaterPct) {
        ladderLocalKillCount++;
        continue;
      }
    }

    // ── Size + margin check ───────────────────────────────────────
    const lvl      = longs.length;
    const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, lvl);
    const usedMargin = longs.reduce((s, p) => s + p.notional / cfg.leverage, 0) +
                       (hedge ? hedge.notional / cfg.leverage : 0);
    const margin = notional / cfg.leverage;
    if (capital - usedMargin < margin || capital <= 0) continue;

    // ── Open rung ─────────────────────────────────────────────────
    longs.push({ ep: close, et: ts, qty: notional / close, notional });
    lastAdd = ts;
    lastEntryPrice = close;
    if (longs.length === 1) {
      currentOpenTs   = ts;
      currentOpenDate = new Date(ts).toISOString().slice(0, 16);
    }
  }

  return {
    finalEq: capital,
    maxDD,
    episodes,
    hedgesFired,
    hedgePnl,
    hedgeCloses,
    ladderLocalKillCount,
    btcGateCount,
    trendGateCount,
    exitBreakdown,
  };
}

// ── Run ───────────────────────────────────────────────────────────
console.log("\nRunning sweep...\n");

// ── Output helpers ────────────────────────────────────────────────
const SEP = "═".repeat(110);
const sum = (a: number[]) => a.reduce((s,v) => s+v, 0);
const avg = (a: number[]) => a.length ? sum(a)/a.length : 0;
const $   = (v: number)   => (v >= 0 ? "$+" : "$") + v.toFixed(0);

function printResult(label: string, r: SimResult, showMonthly = false) {
  const eps  = r.episodes;
  const wins = eps.filter(e => e.episodePnl > 0);
  const wr   = eps.length ? wins.length / eps.length * 100 : 0;
  const kills = eps.filter(e => e.closeReason === "EMERGENCY_KILL").length;
  const flats = eps.filter(e => e.closeReason === "HARD_FLATTEN").length;
  console.log(
    `  ${label.padEnd(30)}` +
    `  Eq=$${r.finalEq.toFixed(0).padStart(7)}` +
    `  DD=${r.maxDD.toFixed(1).padStart(5)}%` +
    `  WR=${wr.toFixed(0).padStart(3)}%` +
    `  Kills=${String(kills).padStart(3)}  Flats=${String(flats).padStart(2)}` +
    `  HedgeFires=${String(r.hedgesFired).padStart(4)}  HedgePnL=${$(r.hedgePnl).padStart(7)}`
  );

  if (showMonthly) {
    const byMonth: Record<string, number[]> = {};
    for (const e of eps) {
      const m = new Date(e.closeTs).toISOString().slice(0, 7);
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(e.episodePnl);
    }
    const hedgeByMonth: Record<string, number[]> = {};
    for (const h of r.hedgeCloses) {
      const m = new Date(h.ts).toISOString().slice(0, 7);
      if (!hedgeByMonth[m]) hedgeByMonth[m] = [];
      hedgeByMonth[m].push(h.pnl);
    }
    console.log(`\n  ${"Month".padEnd(8)} ${"N".padEnd(5)} ${"WR".padEnd(5)} ${"Ladder".padEnd(11)} ${"Hedge".padEnd(10)} ${"Net".padEnd(10)} HedgeFires`);
    console.log("  " + "─".repeat(68));
    const allMonths = new Set([...Object.keys(byMonth), ...Object.keys(hedgeByMonth)]);
    for (const m of [...allMonths].sort()) {
      const pnls  = byMonth[m] ?? [];
      const hPnls = hedgeByMonth[m] ?? [];
      const lPnl  = sum(pnls);
      const hPnl  = sum(hPnls);
      const mWr   = pnls.length ? pnls.filter(p => p > 0).length / pnls.length * 100 : 0;
      console.log(
        `  ${m}  N=${String(pnls.length).padEnd(4)} WR=${mWr.toFixed(0).padStart(3)}%` +
        `  Ladder=${$(lPnl).padStart(8)}` +
        `  Hedge=${$(hPnl).padStart(7)}` +
        `  Net=${$(lPnl+hPnl).padStart(7)}` +
        `  (${hPnls.length})`
      );
    }
    console.log();
  }
}

// ── Baseline (no hedge) ───────────────────────────────────────────
const baseline = runSim({ mode: "none", threshold: 0, rearm: 0, notionalPct: 0, exitMode: "with-ladder", trendGate: false });

console.log(`\n${SEP}`);
console.log(`  LIVE CONFIG BACKTEST — ${START_DATE} → present`);
console.log(`  Config: base=$${cfg.basePositionUsdt}  scale=${cfg.addScaleFactor}  maxPos=${cfg.maxPositions}  TP=${cfg.tpPct}%  capital=$${cfg.initialCapital}  priceTrig=${cfg.priceTriggerPct}%`);
console.log(SEP);
console.log(`\n  ${"Config".padEnd(30)} ${"Equity".padEnd(11)} ${"DD".padEnd(8)} ${"WR".padEnd(6)} ${"Kills".padEnd(8)} ${"Flats".padEnd(7)} ${"Fires".padEnd(13)} HedgePnL`);
console.log("  " + "─".repeat(100));
printResult("No hedge (baseline)", baseline);

// ── CRSI sweep ───────────────────────────────────────────────────
const thresholds  = [15, 20, 25];
const notionals   = [0.30, 0.50, 0.75];
const exitModes   = ["crsi-recovery", "with-ladder"] as const;
const trendGates  = [false, true];

let bestEq = baseline.finalEq;
let bestLabel = "No hedge";
let bestCfg: HedgeCfg | null = null;

for (const exitMode of exitModes) {
  console.log(`\n  ── exitMode: ${exitMode} ──`);
  for (const trendGate of trendGates) {
    for (const threshold of thresholds) {
      for (const notionalPct of notionals) {
        const hc: HedgeCfg = { mode: "crsi", threshold, rearm: 35, notionalPct, exitMode, trendGate };
        const r = runSim(hc);
        const label = `CRSI<${threshold} n=${(notionalPct*100).toFixed(0)}% ${trendGate?"trendGate":"noGate  "}`;
        printResult(label, r);
        if (r.finalEq > bestEq) { bestEq = r.finalEq; bestLabel = label; bestCfg = hc; }
      }
    }
  }
}

// ── Best config monthly breakdown ────────────────────────────────
if (bestCfg) {
  console.log(`\n${SEP}`);
  console.log(`  BEST CONFIG: ${bestLabel}`);
  console.log(SEP);
  const best = runSim(bestCfg);
  printResult(bestLabel, best, true);
}

console.log(`\n  Baseline monthly for reference:`);
printResult("No hedge", baseline, true);
