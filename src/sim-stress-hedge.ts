import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Verify Codex's downside-acceleration micro short hedge
// Trigger: ladder >= 9 rungs AND avg long PnL <= -2.5%
//          AND 1h RSI <= 40 AND 1h ROC5 <= -3.5%
// Hedge: 2-leg micro short at 15% or 20% of active long notional
//        TP 1.0%, kill 1.5%
// Baseline: $10k, base=800, sc=1.2, mx=11, same exits as live config
// ─────────────────────────────────────────────

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

// ── Generic bar builder ──
function buildBars(candles: Candle[], intervalMs: number) {
  const bars: { ts: number; close: number }[] = [];
  let cur: { ts: number; close: number } | null = null;
  for (const c of candles) {
    const barTs = Math.floor(c.timestamp / intervalMs) * intervalMs;
    if (!cur || cur.ts !== barTs) { if (cur) bars.push(cur); cur = { ts: barTs, close: c.close }; }
    else cur.close = c.close;
  }
  if (cur) bars.push(cur);
  return bars;
}

// Precompute bars for all timeframes
const TF: Record<string, { bars: {ts:number,close:number}[], rsi: number[], roc: number[] }> = {};
for (const [name, ms] of [["5m", 5*60000], ["15m", 15*60000], ["1h", 3600000], ["4h", 4*3600000]] as [string,number][]) {
  const bars = buildBars(candles, ms);
  const closes = bars.map(b => b.close);
  TF[name] = { bars, rsi: calcRSI(closes), roc: calcROC5(closes) };
}

// ── RSI(14) on close array ──
function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgG = gains / period, avgL = losses / period;
  rsi[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    rsi[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return rsi;
}

// ── ROC5 (5-period rate of change %) ──
function calcROC5(closes: number[]): number[] {
  return closes.map((c, i) => i < 5 ? NaN : (c - closes[i - 5]) / closes[i - 5] * 100);
}


// Get completed bar indicators for a given timeframe, lagged 1 bar (no lookahead)
const TF_MS: Record<string, number> = { "5m": 5*60000, "15m": 15*60000, "1h": 3600000, "4h": 4*3600000 };
// Precompute ts→index maps for fast lookup
const TF_IDX: Record<string, Map<number, number>> = {};
for (const [name, tf] of Object.entries(TF)) {
  const map = new Map<number, number>();
  tf.bars.forEach((b, i) => map.set(b.ts, i));
  TF_IDX[name] = map;
}
function getIndicators(ts: number, tfName: string): { rsi: number; roc5: number } | null {
  const ms = TF_MS[tfName];
  const prevBarTs = Math.floor(ts / ms) * ms - ms;
  const idx = TF_IDX[tfName].get(prevBarTs);
  if (idx === undefined) return null;
  const { rsi, roc } = TF[tfName];
  if (isNaN(rsi[idx]) || isNaN(roc[idx])) return null;
  return { rsi: rsi[idx], roc5: roc[idx] };
}

// ── Trend gate (4h EMA200/50) — same as sim-hedge ──
const PERIOD4H = 4 * 3600000;
const bars4h: { ts: number; close: number }[] = [];
let curBar = -1, lastClose = 0, lastTs4 = 0;
for (const c of candles) {
  const bar = Math.floor(c.timestamp / PERIOD4H);
  if (bar !== curBar) { if (curBar !== -1) bars4h.push({ ts: lastTs4, close: lastClose }); curBar = bar; }
  lastClose = c.close; lastTs4 = c.timestamp;
}
bars4h.push({ ts: lastTs4, close: lastClose });
const ema = (d: number[], p: number) => { const k = 2 / (p + 1); const r = [d[0]]; for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k)); return r; };
const c4h = bars4h.map(b => b.close), e200 = ema(c4h, 200), e50 = ema(c4h, 50);
const hostile4h = new Map<number, boolean>();
for (let i = 1; i < bars4h.length; i++) hostile4h.set(Math.floor(bars4h[i].ts / PERIOD4H) * PERIOD4H, c4h[i] < e200[i] && e50[i] < e50[i - 1]);
const isHostile = (ts: number) => hostile4h.get(Math.floor(ts / PERIOD4H) * PERIOD4H - PERIOD4H) ?? false;

interface HedgeCfg {
  label: string;
  startDate: string;
  // Long ladder
  base: number; scale: number; maxPos: number; capital: number;
  tp: number; addMin: number; staleH: number; reducedTp: number;
  flatH: number; flatPct: number; killPct: number; fee: number; fund8h: number;
  // Stress hedge
  hedgeEnabled: boolean;
  stressRungs: number;      // min rungs open
  stressPnlPct: number;     // avg long PnL <= this (negative)
  rsiMax: number;           // 1h RSI threshold
  roc5Max: number;          // 1h ROC5 threshold (negative)
  hedgeSizePct: number;     // % of active long notional per leg
  hedgeLegs: number;        // number of short legs
  hedgeTp: number;          // short TP %
  hedgeKill: number;        // short kill %
  hedgeCooldownMin: number; // cooldown between hedge entries
  rsiTf: string;            // RSI/ROC5 timeframe: "5m"|"15m"|"1h"|"4h"|"none"
}

interface Result {
  finalEq: number; ret: number; maxDD: number; minEq: number;
  longTPs: number; longStales: number; longKills: number; longFlats: number;
  hedgeFires: number; hedgeTPs: number; hedgeKills: number; hedgePnl: number;
}

function runSim(cfg: HedgeCfg): Result {
  const startTs = new Date(cfg.startDate).getTime();
  let cap = cfg.capital, peak = cap, minEq = cap, maxDD = 0;
  type Pos = { ep: number; et: number; qty: number; not: number };
  const longs: Pos[] = [];
  const shorts: Pos[] = [];
  let lastAdd = 0, lastHedge = 0;
  let longTPs = 0, longStales = 0, longKills = 0, longFlats = 0;
  let hedgeFires = 0, hedgeTPs = 0, hedgeKills = 0, hedgePnl = 0;

  for (const c of candles) {
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;

    // Equity
    const longUr = longs.reduce((a, p) => a + (close - p.ep) * p.qty, 0);
    const shortUr = shorts.reduce((a, p) => a + (p.ep - close) * p.qty, 0);
    const eq = cap + longUr + shortUr;
    if (eq > peak) peak = eq; if (eq < minEq) minEq = eq;
    const dd = peak > 0 ? (peak - eq) / peak * 100 : 0; if (dd > maxDD) maxDD = dd;

    // ── Short exits ──
    for (let i = shorts.length - 1; i >= 0; i--) {
      const s = shorts[i];
      const tpP = s.ep * (1 - cfg.hedgeTp / 100);
      const killP = s.ep * (1 + cfg.hedgeKill / 100);
      if (low <= tpP) {
        const pnl = (s.ep - tpP) * s.qty - (s.not * cfg.fee + tpP * s.qty * cfg.fee);
        cap += pnl; hedgePnl += pnl; hedgeTPs++;
        shorts.splice(i, 1);
      } else if (high >= killP) {
        const pnl = (s.ep - killP) * s.qty - (s.not * cfg.fee + killP * s.qty * cfg.fee);
        cap += pnl; hedgePnl += pnl; hedgeKills++;
        shorts.splice(i, 1);
      }
    }

    // ── Long exits ──
    if (longs.length > 0) {
      const tQty = longs.reduce((a, p) => a + p.qty, 0);
      const avgE = longs.reduce((a, p) => a + p.ep * p.qty, 0) / tQty;
      const oldH = (ts - longs[0].et) / 3600000;
      const isStale = cfg.staleH > 0 && oldH >= cfg.staleH && close < avgE;
      const tpPrice = avgE * (1 + (isStale ? cfg.reducedTp : cfg.tp) / 100);
      const avgPnl = (close - avgE) / avgE * 100;

      if (high >= tpPrice) {
        let pnl = 0;
        for (const p of longs) { const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000)); pnl += (tpPrice - p.ep) * p.qty - (p.not * cfg.fee + tpPrice * p.qty * cfg.fee) - fund; cap += (tpPrice - p.ep) * p.qty - (p.not * cfg.fee + tpPrice * p.qty * cfg.fee) - fund; }
        longs.length = 0; lastAdd = 0;
        if (isStale) longStales++; else longTPs++;
        // Close shorts on long TP (trend reversed)
        for (const s of shorts) { const pnl2 = (s.ep - close) * s.qty - (s.not * cfg.fee + close * s.qty * cfg.fee); cap += pnl2; hedgePnl += pnl2; } shorts.length = 0;
        continue;
      }
      if (cfg.killPct !== 0 && avgPnl <= cfg.killPct) {
        for (const p of longs) { const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000)); cap += (close - p.ep) * p.qty - (p.not * cfg.fee + close * p.qty * cfg.fee) - fund; }
        longs.length = 0; lastAdd = 0; longKills++;
        for (const s of shorts) { cap += (s.ep - close) * s.qty - (s.not * cfg.fee + close * s.qty * cfg.fee); hedgePnl += (s.ep - close) * s.qty - (s.not * cfg.fee + close * s.qty * cfg.fee); } shorts.length = 0;
        continue;
      }
      if (cfg.flatH > 0 && oldH >= cfg.flatH && avgPnl <= cfg.flatPct && isHostile(ts)) {
        for (const p of longs) { const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000)); cap += (close - p.ep) * p.qty - (p.not * cfg.fee + close * p.qty * cfg.fee) - fund; }
        longs.length = 0; lastAdd = 0; longFlats++;
        continue;
      }
    }

    // ── Long entries ──
    if (longs.length < cfg.maxPos && (ts - lastAdd) / 60000 >= cfg.addMin && !isHostile(ts)) {
      const not = cfg.base * Math.pow(cfg.scale, longs.length);
      longs.push({ ep: close, et: ts, qty: not / close, not }); lastAdd = ts;
    }

    // ── Stress hedge entries ──
    if (cfg.hedgeEnabled && longs.length >= cfg.stressRungs) {
      const tQty = longs.reduce((a, p) => a + p.qty, 0);
      const avgE = longs.reduce((a, p) => a + p.ep * p.qty, 0) / tQty;
      const avgPnlPct = (close - avgE) / avgE * 100;

      if (avgPnlPct <= cfg.stressPnlPct && shorts.length === 0 && (ts - lastHedge) / 60000 >= cfg.hedgeCooldownMin) {
        const ind = cfg.rsiTf === "none" ? { rsi: 0, roc5: -999 } : getIndicators(ts, cfg.rsiTf);
        if (ind && ind.rsi <= cfg.rsiMax && ind.roc5 <= cfg.roc5Max) {
          const totalLongNot = longs.reduce((a, p) => a + p.not, 0);
          const legNot = totalLongNot * cfg.hedgeSizePct / 100;
          for (let leg = 0; leg < cfg.hedgeLegs; leg++) {
            shorts.push({ ep: close, et: ts, qty: legNot / close, not: legNot });
          }
          hedgeFires++;
          lastHedge = ts;
        }
      }
    }
  }

  // Close open positions at end
  const last = candles[candles.length - 1];
  for (const p of longs) cap += (last.close - p.ep) * p.qty - (p.not * cfg.fee + last.close * p.qty * cfg.fee);
  for (const s of shorts) { const pnl = (s.ep - last.close) * s.qty - (s.not * cfg.fee + last.close * s.qty * cfg.fee); cap += pnl; hedgePnl += pnl; }

  return { finalEq: cap, ret: (cap / cfg.capital - 1) * 100, maxDD, minEq, longTPs, longStales, longKills, longFlats, hedgeFires, hedgeTPs, hedgeKills, hedgePnl };
}

const base: Omit<HedgeCfg, "label"> = {
  startDate: "2024-12-06",
  base: 800, scale: 1.2, maxPos: 11, capital: 10000,
  tp: 1.4, addMin: 30, staleH: 8, reducedTp: 0.3,
  flatH: 40, flatPct: -6, killPct: -10, fee: 0.00055, fund8h: 0.0001,
  hedgeEnabled: false,
  stressRungs: 9, stressPnlPct: -2.5, rsiMax: 40, roc5Max: -3.5,
  hedgeSizePct: 20, hedgeLegs: 2, hedgeTp: 2.0, hedgeKill: 3.0, hedgeCooldownMin: 60, rsiTf: "1h",
};

const base26: Omit<HedgeCfg, "label"> = { ...base, startDate: "2026-01-01" };

function row(label: string, r: Result) {
  const tpR = r.hedgeFires > 0 ? (r.hedgeTPs / r.hedgeFires * 100).toFixed(0) + "%" : "n/a";
  return `  ${label.padEnd(36)} ${("$"+r.finalEq.toFixed(0)).padStart(9)} ${((r.ret>=0?"+":"")+r.ret.toFixed(1)+"%").padStart(9)} ${(r.maxDD.toFixed(1)+"%").padStart(7)} ${("$"+r.minEq.toFixed(0)).padStart(9)} ${String(r.hedgeFires).padStart(6)} ${"$"+(r.hedgePnl>=0?"+":"")+r.hedgePnl.toFixed(0).padStart(7)} ${String(r.hedgeTPs).padStart(5)} ${String(r.hedgeKills).padStart(6)} ${tpR.padStart(7)}`;
}
const hdr = `  ${"Config".padEnd(36)} ${"FinalEq".padStart(9)} ${"Return".padStart(9)} ${"MaxDD".padStart(7)} ${"MinEq".padStart(9)} ${"Fires".padStart(6)} ${"HedgePnL".padStart(9)} ${"TPs".padStart(5)} ${"Kills".padStart(6)} ${"TPrate".padStart(7)}`;
const div = "  " + "-".repeat(108);

const SEP = "=".repeat(112);
console.log(SEP);
console.log("  STRESS HEDGE — TP=2% kill=3%, 20% notional, 2 legs | RSI TIMEFRAME SWEEP");
console.log("  Trigger: rungs>=9 + avgPnL<=-2.5% + RSI<=40 + ROC5<=-3.5% (on chosen TF)");
console.log("  Jan 2026 → Apr 2026 + Full history");
console.log(SEP);

const bsl26 = runSim({ ...base26, label: "baseline", hedgeEnabled: false });
const bslFull = runSim({ ...base, label: "baseline", hedgeEnabled: false });

// ── RSI timeframe sweep — Jan 2026 ──
console.log("\n--- JAN 2026: RSI timeframe sweep (TP=2%, kill=3%, 20% notional) ---");
console.log(hdr); console.log(div);
console.log(row("baseline (no hedge)", bsl26));
for (const tf of ["none", "5m", "15m", "1h", "4h"]) {
  const label = tf === "none" ? "stress only (no RSI filter)" : `RSI/ROC5 on ${tf}`;
  const s = runSim({ ...base26, label, hedgeEnabled: true, rsiTf: tf });
  console.log(row(label, s));
}

// ── RSI timeframe sweep — full history ──
console.log("\n--- FULL HISTORY: RSI timeframe sweep (TP=2%, kill=3%, 20% notional) ---");
console.log(hdr); console.log(div);
console.log(row("baseline (no hedge)", bslFull));
for (const tf of ["none", "5m", "15m", "1h", "4h"]) {
  const label = tf === "none" ? "stress only (no RSI filter)" : `RSI/ROC5 on ${tf}`;
  const s = runSim({ ...base, label, hedgeEnabled: true, rsiTf: tf });
  console.log(row(label, s));
}

// ── RSI threshold sweep per best timeframe (Jan 2026) ──
console.log("\n--- JAN 2026: RSI threshold sweep per timeframe (TP=2%, kill=3%) ---");
console.log(hdr); console.log(div);
console.log(row("baseline (no hedge)", bsl26));
for (const tf of ["5m", "15m", "1h", "4h"]) {
  for (const rsi of [35, 40, 45]) {
    const s = runSim({ ...base26, label: `${tf} RSI<=${rsi}`, hedgeEnabled: true, rsiTf: tf, rsiMax: rsi });
    console.log(row(`${tf} RSI<=${rsi} ROC5<=-3.5%`, s));
  }
}
