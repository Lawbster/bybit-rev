// analyze-april-ladder.ts
//
// Deep-dive on HYPE past 19 days (2026-04-01 → 2026-04-19) to find what an
// optimal ladder would look like. Four phases:
//
//   PHASE 1: Characterize the period — daily moves, volatility, BTC coupling,
//            biggest pullbacks + recoveries.
//   PHASE 2: For each pullback, extract indicator state at the low
//            (CRSI4H, RSI1H, BTC ret, slope12h, ATR%) so we can pattern-match.
//   PHASE 3: Oracle test — simulate aggressive ladders (more rungs, bigger
//            scaling) that buy the dip at each low. Compute the ceiling.
//   PHASE 4: Same aggressive configs on full history (2024-12-05 → present)
//            to see catastrophe vs awesome.
//
// Usage: npx ts-node src/analyze-april-ladder.ts

import fs from "fs";
import path from "path";
import { RSI, EMA, ATR } from "technicalindicators";
import { Candle } from "./fetch-candles";

const DATA = path.resolve(__dirname, "../data");
const hype5m: Candle[] = JSON.parse(fs.readFileSync(path.join(DATA, "HYPEUSDT_5.json"), "utf-8"));
const btc5m: Candle[] = JSON.parse(fs.readFileSync(path.join(DATA, "BTCUSDT_5.json"), "utf-8"));

// ── Period under study ──────────────────────────────────────────
const APR_START = Date.parse("2026-04-01T00:00:00Z");
const APR_END   = Date.parse("2026-04-19T23:59:59Z");
const FULL_START = hype5m[0].timestamp;

// ── Helpers ──────────────────────────────────────────────────────
function aggregateTo(timeframeMs: number, bars: Candle[]): Candle[] {
  const out: Candle[] = [];
  let cur: Candle | null = null;
  for (const b of bars) {
    const ts = Math.floor(b.timestamp / timeframeMs) * timeframeMs;
    if (!cur || cur.timestamp !== ts) {
      if (cur) out.push(cur);
      cur = { timestamp: ts, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume, turnover: b.turnover };
    } else {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume;
      cur.turnover += b.turnover;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function bsearch(arr: number[], val: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= val) lo = mid + 1; else hi = mid;
  }
  return lo;
}

const DAY_MS = 86_400_000;
const hype1h = aggregateTo(3_600_000, hype5m);
const hype4h = aggregateTo(14_400_000, hype5m);
const hype1d = aggregateTo(DAY_MS, hype5m);
const btc1h = aggregateTo(3_600_000, btc5m);
const btc1d = aggregateTo(DAY_MS, btc5m);

// Precompute 1H RSI, 4H CRSI
const rsi1HMap = new Map<number, number>();
{
  const closes = hype1h.map(b => b.close);
  const vals = RSI.calculate({ period: 14, values: closes });
  const offset = closes.length - vals.length;
  for (let i = 0; i < vals.length; i++) rsi1HMap.set(hype1h[i + offset].timestamp, vals[i]);
}
const ts1H = hype1h.map(b => b.timestamp);
function get1Hrsi(ts: number): number | null {
  const i = bsearch(ts1H, ts);
  if (i < 1) return null;
  return rsi1HMap.get(hype1h[i - 1].timestamp) ?? null;
}

const crsi4HMap = new Map<number, number>();
{
  const closes = hype4h.map(b => b.close);
  const pctRank = (arr: number[], val: number) => arr.filter(v => v <= val).length / arr.length * 100;
  for (let i = 103; i < closes.length; i++) {
    const sl = closes.slice(0, i + 1);
    const r3 = RSI.calculate({ period: 3, values: sl });
    const streaks: number[] = [];
    let streak = 0;
    for (let j = 1; j < sl.length; j++) {
      if (sl[j] > sl[j - 1]) streak = streak > 0 ? streak + 1 : 1;
      else if (sl[j] < sl[j - 1]) streak = streak < 0 ? streak - 1 : -1;
      else streak = 0;
      streaks.push(streak);
    }
    const r2 = RSI.calculate({ period: 2, values: streaks.map(s => Math.abs(s)) });
    const roc1 = sl.slice(1).map((v, j) => (v - sl[j]) / sl[j] * 100);
    const pr = pctRank(roc1.slice(-100), roc1[roc1.length - 1]);
    const crsi = r3.length && r2.length ? (r3[r3.length - 1] + r2[r2.length - 1] + pr) / 3 : 50;
    crsi4HMap.set(hype4h[i].timestamp, crsi);
  }
}
const ts4H = hype4h.map(b => b.timestamp);
function getCrsi4H(ts: number): number | null {
  const i = bsearch(ts4H, ts);
  if (i < 1) return null;
  return crsi4HMap.get(hype4h[i - 1].timestamp) ?? null;
}

// BTC 1h return
const btcRetMap = new Map<number, number>();
for (let i = 1; i < btc1h.length; i++) {
  btcRetMap.set(btc1h[i].timestamp, (btc1h[i].close - btc1h[i - 1].close) / btc1h[i - 1].close * 100);
}
const tsBtc1H = btc1h.map(b => b.timestamp);
function getBtcRet(ts: number): number | null {
  const i = bsearch(tsBtc1H, ts);
  if (i < 1) return null;
  return btcRetMap.get(btc1h[i - 1].timestamp) ?? null;
}

// 1H ATR%
const atr1HMap = new Map<number, number>();
{
  const highs = hype1h.map(b => b.high);
  const lows = hype1h.map(b => b.low);
  const closes = hype1h.map(b => b.close);
  const atr = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
  const offset = closes.length - atr.length;
  for (let i = 0; i < atr.length; i++) {
    atr1HMap.set(hype1h[i + offset].timestamp, atr[i] / closes[i + offset] * 100);
  }
}
function getAtr1Hpct(ts: number): number | null {
  const i = bsearch(ts1H, ts);
  if (i < 1) return null;
  return atr1HMap.get(hype1h[i - 1].timestamp) ?? null;
}

// ═════════════════════════════════════════════════════════════════
// PHASE 1 — characterize April 1-19
// ═════════════════════════════════════════════════════════════════
console.log("\n════════════════════════════════════════════════════════════════════════");
console.log("PHASE 1 — April 1 → 19 characterization");
console.log("════════════════════════════════════════════════════════════════════════");

const aprHype = hype5m.filter(c => c.timestamp >= APR_START && c.timestamp <= APR_END);
const aprBtc = btc5m.filter(c => c.timestamp >= APR_START && c.timestamp <= APR_END);
const aprDays = hype1d.filter(c => c.timestamp >= APR_START && c.timestamp <= APR_END);
const aprBtcDays = btc1d.filter(c => c.timestamp >= APR_START && c.timestamp <= APR_END);

const aprOpen = aprHype[0].open;
const aprClose = aprHype[aprHype.length - 1].close;
const aprHigh = Math.max(...aprHype.map(c => c.high));
const aprLow = Math.min(...aprHype.map(c => c.low));
const aprRet = (aprClose - aprOpen) / aprOpen * 100;

const btcAprOpen = aprBtc[0].open;
const btcAprClose = aprBtc[aprBtc.length - 1].close;
const btcAprRet = (btcAprClose - btcAprOpen) / btcAprOpen * 100;

console.log(`HYPE:  open=$${aprOpen.toFixed(2)}  close=$${aprClose.toFixed(2)}  high=$${aprHigh.toFixed(2)}  low=$${aprLow.toFixed(2)}  return=${aprRet.toFixed(2)}%`);
console.log(`BTC:   open=$${btcAprOpen.toFixed(0)}  close=$${btcAprClose.toFixed(0)}  return=${btcAprRet.toFixed(2)}%`);

// Daily breakdown
console.log(`\nDaily returns (HYPE vs BTC):`);
console.log(`  ${"Date".padEnd(12)} ${"HYPE_OCHL".padEnd(30)} ${"H%".padStart(7)} ${"B%".padStart(7)} ${"Color".padEnd(6)}`);
for (let i = 0; i < aprDays.length; i++) {
  const d = aprDays[i];
  const b = aprBtcDays[i];
  const hr = (d.close - d.open) / d.open * 100;
  const br = b ? (b.close - b.open) / b.open * 100 : 0;
  const c = hr >= 0 ? "GREEN" : "RED";
  const date = new Date(d.timestamp).toISOString().slice(0, 10);
  console.log(`  ${date.padEnd(12)} $${d.open.toFixed(2)}/${d.close.toFixed(2)}/H${d.high.toFixed(2)}/L${d.low.toFixed(2)}${" ".repeat(Math.max(0, 30 - (`$${d.open.toFixed(2)}/${d.close.toFixed(2)}/H${d.high.toFixed(2)}/L${d.low.toFixed(2)}`).length))} ${hr.toFixed(2).padStart(6)}% ${br.toFixed(2).padStart(6)}% ${c}`);
}

// Daily correlation HYPE vs BTC (per-day returns)
const dayRets = aprDays.map((d, i) => ({
  hr: (d.close - d.open) / d.open * 100,
  br: aprBtcDays[i] ? (aprBtcDays[i].close - aprBtcDays[i].open) / aprBtcDays[i].open * 100 : 0,
}));
const meanH = dayRets.reduce((s, d) => s + d.hr, 0) / dayRets.length;
const meanB = dayRets.reduce((s, d) => s + d.br, 0) / dayRets.length;
const covHB = dayRets.reduce((s, d) => s + (d.hr - meanH) * (d.br - meanB), 0) / dayRets.length;
const varH = dayRets.reduce((s, d) => s + (d.hr - meanH) ** 2, 0) / dayRets.length;
const varB = dayRets.reduce((s, d) => s + (d.br - meanB) ** 2, 0) / dayRets.length;
const corrHB = covHB / Math.sqrt(varH * varB);
console.log(`\nDaily return correlation HYPE-BTC (Apr 1-19): ${corrHB.toFixed(3)}  (mean HYPE ${meanH.toFixed(2)}%/d vs BTC ${meanB.toFixed(2)}%/d)`);

// ── Detect pullback episodes ─────────────────────────────────────
// An "episode" = a local peak followed by a drawdown of X% or more,
// followed by recovery to within Y% of the prior peak.
// This is what a ladder strategy would actually trade.
type Pullback = {
  peakTs: number; peakPrice: number;
  lowTs: number;  lowPrice: number;
  recTs: number | null; recPrice: number | null;
  dropPct: number;         // from peak to low
  durationDrop: number;    // hours peak→low
  durationRecover: number | null;  // hours low→rec
  // Indicator state at low
  crsi4HAtLow: number | null;
  rsi1HAtLow: number | null;
  btcRet1HAtLow: number | null;
  atr1HPctAtLow: number | null;
  slope6hAtLow: number;    // % change over 6h ending at low
};

function findPullbacks(candles: Candle[], minDropPct = 1.0, minRecoveryPct = 0.8): Pullback[] {
  const out: Pullback[] = [];
  let peakIdx = 0;
  let lowIdx = 0;
  let state: "seeking_low" | "seeking_recovery" = "seeking_low";
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    if (state === "seeking_low") {
      if (c.high > candles[peakIdx].high) {
        peakIdx = i;
        lowIdx = i;
      } else {
        if (c.low < candles[lowIdx].low) lowIdx = i;
        const drop = (candles[peakIdx].high - candles[lowIdx].low) / candles[peakIdx].high * 100;
        if (drop >= minDropPct) state = "seeking_recovery";
      }
    } else {
      if (c.low < candles[lowIdx].low) lowIdx = i;  // extend trough
      const rec = (c.high - candles[lowIdx].low) / candles[lowIdx].low * 100;
      if (rec >= minRecoveryPct) {
        const peak = candles[peakIdx];
        const low = candles[lowIdx];
        const lowTs = low.timestamp;
        out.push({
          peakTs: peak.timestamp, peakPrice: peak.high,
          lowTs, lowPrice: low.low,
          recTs: c.timestamp, recPrice: c.high,
          dropPct: (peak.high - low.low) / peak.high * 100,
          durationDrop: (lowTs - peak.timestamp) / 3_600_000,
          durationRecover: (c.timestamp - lowTs) / 3_600_000,
          crsi4HAtLow: getCrsi4H(lowTs),
          rsi1HAtLow: get1Hrsi(lowTs),
          btcRet1HAtLow: getBtcRet(lowTs),
          atr1HPctAtLow: getAtr1Hpct(lowTs),
          slope6hAtLow: (() => {
            const six = lowTs - 6 * 3_600_000;
            const j = candles.findIndex(k => k.timestamp >= six);
            if (j < 0) return 0;
            return (low.low - candles[j].close) / candles[j].close * 100;
          })(),
        });
        // Reset: current candle becomes new peak
        peakIdx = i;
        lowIdx = i;
        state = "seeking_low";
      }
    }
  }
  return out;
}

// Pullbacks: require ≥1.5% drop before we care (that's where a ladder starts earning)
const pullbacks = findPullbacks(aprHype, 1.5, 1.0);

console.log(`\n────────────────────────────────────────────────────────────────────────`);
console.log(`PULLBACKS (≥1.5% drop) in April 1-19: ${pullbacks.length}`);
console.log(`────────────────────────────────────────────────────────────────────────`);
console.log(`  ${"#".padStart(3)}  ${"PeakTime".padEnd(16)} ${"LowTime".padEnd(16)} ${"Drop%".padStart(6)} ${"DropH".padStart(6)} ${"RecH".padStart(6)} ${"CRSI4H".padStart(6)} ${"RSI1H".padStart(5)} ${"BTCret".padStart(6)} ${"ATR%".padStart(5)} ${"Sl6h%".padStart(6)}`);
pullbacks.forEach((p, i) => {
  const pt = new Date(p.peakTs).toISOString().slice(5, 16).replace("T", " ");
  const lt = new Date(p.lowTs).toISOString().slice(5, 16).replace("T", " ");
  console.log(`  ${String(i + 1).padStart(3)}  ${pt.padEnd(16)} ${lt.padEnd(16)} ${p.dropPct.toFixed(2).padStart(5)}% ${p.durationDrop.toFixed(1).padStart(5)}h ${(p.durationRecover ?? 0).toFixed(1).padStart(5)}h ${(p.crsi4HAtLow?.toFixed(1) ?? "n/a").padStart(6)} ${(p.rsi1HAtLow?.toFixed(1) ?? "n/a").padStart(5)} ${(p.btcRet1HAtLow?.toFixed(2) ?? "n/a").padStart(5)}% ${(p.atr1HPctAtLow?.toFixed(2) ?? "n/a").padStart(4)}% ${p.slope6hAtLow.toFixed(2).padStart(5)}%`);
});

// Summary stats
const drops = pullbacks.map(p => p.dropPct);
const crsis = pullbacks.map(p => p.crsi4HAtLow ?? 50);
const rsis  = pullbacks.map(p => p.rsi1HAtLow ?? 50);
const btcs  = pullbacks.map(p => p.btcRet1HAtLow ?? 0);
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log(`\n  Pullback summary: median drop ${median(drops).toFixed(2)}%, median CRSI4H at low ${median(crsis).toFixed(1)}, median RSI1H ${median(rsis).toFixed(1)}, median BTC 1h-ret ${median(btcs).toFixed(2)}%`);

// ═════════════════════════════════════════════════════════════════
// PHASE 2 — simulate basic ladder strategies on April to find ceiling
// ═════════════════════════════════════════════════════════════════
console.log("\n\n════════════════════════════════════════════════════════════════════════");
console.log("PHASE 2 — Ladder config sweep on April 1-19");
console.log("════════════════════════════════════════════════════════════════════════");

type LadderCfg = {
  label: string;
  base: number;
  scale: number;          // martingale multiplier per rung
  maxRungs: number;
  tpPct: number;
  addIntervalMin: number;
  priceTriggerPct: number;  // 0 = time only
  leverage: number;
  fee: number;
  emergencyPct: number;    // force-close at avg PnL% ≤ this (-10 = kill at -10% avg)
  staleHours: number;      // after this many hours, switch to reducedTpPct
  reducedTpPct: number;    // reduced TP when stale
  boostTriggers?: {        // optional: enter early/larger if CRSI4H and RSI1H sag
    enabled: boolean;
    crsi4HMax: number;
    rsi1HMax: number;
    sizeMult: number;       // first-rung size multiplier when boost fires
    intervalMult: number;   // addIntervalMin multiplier when boost fires
  };
};

type Pos = { ep: number; et: number; qty: number; notional: number };

function runSim(bars: Candle[], cfg: LadderCfg, capital0 = 10_000) {
  let capital = capital0;
  let peakMtm = capital0;  // peak mark-to-market equity (includes unrealized)
  let maxDD = 0;
  let longs: Pos[] = [];
  let lastAdd = 0;
  let lastEntryPrice = 0;
  let tps = 0, stales = 0, kills = 0, flats = 0, opens = 0;
  const depthAtClose: number[] = [];
  const closes: { ts: number; outcome: string; pnl: number; avgPnlPct: number; depth: number }[] = [];

  const mtmEquity = (price: number): number => {
    let unreal = 0;
    for (const p of longs) unreal += (price - p.ep) * p.qty;
    return capital + unreal;
  };

  const closeLadder = (price: number, ts: number, reason: string) => {
    let pnl = 0;
    for (const p of longs) {
      const raw = (price - p.ep) * p.qty;
      const fees = p.notional * cfg.fee + price * p.qty * cfg.fee;
      pnl += raw - fees;
    }
    capital += pnl;
    const tQty = longs.reduce((s, p) => s + p.qty, 0);
    const avgE = tQty > 0 ? longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQty : price;
    const avgPnlPct = avgE > 0 ? (price - avgE) / avgE * 100 : 0;
    closes.push({ ts, outcome: reason, pnl, avgPnlPct, depth: longs.length });
    depthAtClose.push(longs.length);
    if (reason === "tp") tps++; else if (reason === "stale") stales++;
    else if (reason === "kill") kills++; else if (reason === "open") opens++;
    else flats++;
    longs = [];
  };

  for (let i = 0; i < bars.length; i++) {
    const c = bars[i];
    const ts = c.timestamp;
    const price = c.close;

    // Mark-to-market DD (includes unrealized losses on open ladder)
    const eqHigh = mtmEquity(c.high);
    const eqLow  = mtmEquity(c.low);
    peakMtm = Math.max(peakMtm, eqHigh);
    const ddLow = (peakMtm - eqLow) / peakMtm * 100;
    if (ddLow > maxDD) maxDD = ddLow;

    // TP check on current candle high
    if (longs.length > 0) {
      const tQty = longs.reduce((s, p) => s + p.qty, 0);
      const avgE = longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const ageHours = (ts - longs[0].et) / 3_600_000;
      const activeTpPct = ageHours >= cfg.staleHours ? cfg.reducedTpPct : cfg.tpPct;
      const tpPrice = avgE * (1 + activeTpPct / 100);
      if (c.high >= tpPrice) {
        closeLadder(tpPrice, ts, ageHours >= cfg.staleHours ? "stale" : "tp");
        continue;
      }

      // Emergency kill: avg PnL at current price worse than threshold
      const avgPnlPct = (price - avgE) / avgE * 100;
      if (avgPnlPct <= cfg.emergencyPct) {
        closeLadder(price, ts, "kill");
        continue;
      }
    }

    // Decide add
    const noPos = longs.length === 0;
    const timeOk = noPos || (ts - lastAdd) >= cfg.addIntervalMin * 60_000;
    const priceOk = cfg.priceTriggerPct > 0 && !noPos && (price - lastEntryPrice) / lastEntryPrice * 100 <= -cfg.priceTriggerPct;
    const canAdd = noPos ? true : (timeOk || priceOk);
    if (!canAdd) continue;
    if (longs.length >= cfg.maxRungs) continue;

    // Optional boost: check CRSI4H/RSI1H at first rung
    let sizeMult = 1;
    if (noPos && cfg.boostTriggers?.enabled) {
      const c4 = getCrsi4H(ts);
      const r1 = get1Hrsi(ts);
      if (c4 !== null && r1 !== null && c4 <= cfg.boostTriggers.crsi4HMax && r1 <= cfg.boostTriggers.rsi1HMax) {
        sizeMult = cfg.boostTriggers.sizeMult;
      }
    }

    const level = longs.length;
    const notional = cfg.base * Math.pow(cfg.scale, level) * sizeMult;
    const usedMargin = longs.reduce((s, p) => s + p.notional / cfg.leverage, 0);
    const margin = notional / cfg.leverage;
    if (capital - usedMargin < margin || capital <= 0) continue;

    longs.push({ ep: price, et: ts, qty: notional / price, notional });
    lastAdd = ts;
    lastEntryPrice = price;
  }

  // Force-close any remaining at final price
  if (longs.length > 0) {
    closeLadder(bars[bars.length - 1].close, bars[bars.length - 1].timestamp, "open");
  }

  // Max depth reached
  const maxDepth = depthAtClose.length > 0 ? Math.max(...depthAtClose) : 0;

  return { capital, ret: (capital / capital0 - 1) * 100, maxDD, tps, stales, kills, flats, opens, maxDepth, closes };
}

const BASELINE: LadderCfg = {
  label: "Baseline live (11×1.2, 30m/0.5%, TP 1.4)",
  base: 800, scale: 1.20, maxRungs: 11, tpPct: 1.4,
  addIntervalMin: 30, priceTriggerPct: 0.5, leverage: 45, fee: 0.00055,
  emergencyPct: -10, staleHours: 20, reducedTpPct: 0.9,
};

const VARIANTS: LadderCfg[] = [
  BASELINE,
  // Variant A: more rungs, same scale
  { ...BASELINE, label: "A: 15×1.2 (more depth)", maxRungs: 15 },
  // Variant B: bigger scale
  { ...BASELINE, label: "B: 11×1.35 (bigger scale)", scale: 1.35 },
  // Variant C: aggressive scale + rungs
  { ...BASELINE, label: "C: 15×1.35 (depth+scale)", maxRungs: 15, scale: 1.35 },
  // Variant D: faster price trigger (0.3%)
  { ...BASELINE, label: "D: tighter trigger 0.3%", priceTriggerPct: 0.3 },
  // Variant E: faster AND deeper
  { ...BASELINE, label: "E: 0.3% trig + 15 rungs", priceTriggerPct: 0.3, maxRungs: 15 },
  // Variant F: bigger TP
  { ...BASELINE, label: "F: TP 2.0", tpPct: 2.0 },
  // Variant G: shorter TP + aggressive
  { ...BASELINE, label: "G: TP 1.0 + 15×1.35", tpPct: 1.0, maxRungs: 15, scale: 1.35 },
  // Variant H: boost on CRSI4H<40 & RSI1H<50
  { ...BASELINE, label: "H: boost(CRSI<40,RSI<50)×2",
    boostTriggers: { enabled: true, crsi4HMax: 40, rsi1HMax: 50, sizeMult: 2.0, intervalMult: 1.0 } },
  // Variant I: aggressive scaling only at depth
  { ...BASELINE, label: "I: 15×1.40 (all-in bear)", maxRungs: 15, scale: 1.40 },
  // Variant J: tight TP, tight trigger, lots of rungs — maximize turnover
  { ...BASELINE, label: "J: TP0.9 + 0.3%trig + 15x1.25", tpPct: 0.9, priceTriggerPct: 0.3, maxRungs: 15, scale: 1.25 },
  // ── Defensive middle-ground variants ──
  { ...BASELINE, label: "K: 11×1.35 + 0.3% trig", scale: 1.35, priceTriggerPct: 0.3 },
  { ...BASELINE, label: "L: 11×1.35 + stale 15h", scale: 1.35, staleHours: 15 },
  { ...BASELINE, label: "M: 11×1.35 + kill -8%", scale: 1.35, emergencyPct: -8 },
  { ...BASELINE, label: "N: 11×1.35 + 0.3%trig + kill -8%", scale: 1.35, priceTriggerPct: 0.3, emergencyPct: -8 },
  { ...BASELINE, label: "O: 11×1.30 (mild scale bump)", scale: 1.30 },
  { ...BASELINE, label: "P: 13×1.30 (split depth+scale)", maxRungs: 13, scale: 1.30 },
];

console.log(`\n  ${"Config".padEnd(40)} ${"FinalEq".padStart(10)} ${"Return".padStart(8)} ${"MTM-DD".padStart(7)} ${"TPs".padStart(4)} ${"Stale".padStart(5)} ${"Kill".padStart(4)} ${"Flat".padStart(4)} ${"Open".padStart(4)} ${"MaxDpt".padStart(6)}`);
console.log("  " + "─".repeat(110));
for (const v of VARIANTS) {
  const r = runSim(aprHype, v);
  console.log(`  ${v.label.padEnd(40)} $${r.capital.toFixed(0).padStart(9)} ${(r.ret >= 0 ? "+" : "") + r.ret.toFixed(1) + "%"}${" ".repeat(Math.max(0, 8 - ((r.ret >= 0 ? "+" : "") + r.ret.toFixed(1) + "%").length))} ${r.maxDD.toFixed(1).padStart(6)}% ${String(r.tps).padStart(4)} ${String(r.stales).padStart(5)} ${String(r.kills).padStart(4)} ${String(r.flats).padStart(4)} ${String(r.opens).padStart(4)} ${String(r.maxDepth).padStart(6)}`);
}

// ═════════════════════════════════════════════════════════════════
// PHASE 3 — same configs on FULL history (catastrophe check)
// ═════════════════════════════════════════════════════════════════
console.log("\n\n════════════════════════════════════════════════════════════════════════");
console.log(`PHASE 3 — Same configs on FULL HISTORY (${new Date(FULL_START).toISOString().slice(0, 10)} → 2026-04-19)`);
console.log("════════════════════════════════════════════════════════════════════════");
console.log(`\n  ${"Config".padEnd(40)} ${"FinalEq".padStart(10)} ${"Return".padStart(8)} ${"MTM-DD".padStart(7)} ${"TPs".padStart(4)} ${"Stale".padStart(5)} ${"Kill".padStart(4)} ${"Flat".padStart(4)} ${"MaxDpt".padStart(6)}`);
console.log("  " + "─".repeat(110));
for (const v of VARIANTS) {
  const r = runSim(hype5m, v);
  console.log(`  ${v.label.padEnd(40)} $${r.capital.toFixed(0).padStart(9)} ${(r.ret >= 0 ? "+" : "") + r.ret.toFixed(1) + "%"}${" ".repeat(Math.max(0, 8 - ((r.ret >= 0 ? "+" : "") + r.ret.toFixed(1) + "%").length))} ${r.maxDD.toFixed(1).padStart(6)}% ${String(r.tps).padStart(4)} ${String(r.stales).padStart(5)} ${String(r.kills).padStart(4)} ${String(r.flats).padStart(4)} ${String(r.maxDepth).padStart(6)}`);
}

// ── Per-month breakdown for BASELINE + 2 most promising variants ─────
console.log("\n\n  ─── Per-month returns (monthly PnL as % of starting equity that month) ───");
const promising = [
  BASELINE,
  VARIANTS[2],  // B: 11×1.35
  VARIANTS[11], // K: 11×1.35 + 0.3% trig
  VARIANTS[12], // L: 11×1.35 + stale 15h
];
for (const v of promising) {
  const r = runSim(hype5m, v);
  const byMonth = new Map<string, { pnl: number; tps: number; kills: number }>();
  for (const c of r.closes) {
    const mo = new Date(c.ts).toISOString().slice(0, 7);
    if (!byMonth.has(mo)) byMonth.set(mo, { pnl: 0, tps: 0, kills: 0 });
    const m = byMonth.get(mo)!;
    m.pnl += c.pnl;
    if (c.outcome === "tp") m.tps++;
    else if (c.outcome === "kill") m.kills++;
  }
  console.log(`\n  ${v.label}  →  final $${r.capital.toFixed(0)} (+${r.ret.toFixed(0)}%), MTM-DD ${r.maxDD.toFixed(1)}%`);
  const months = [...byMonth.keys()].sort();
  for (const mo of months) {
    const m = byMonth.get(mo)!;
    const sign = m.pnl >= 0 ? "+" : "";
    console.log(`    ${mo}  $${sign}${m.pnl.toFixed(0).padStart(7)}   TPs: ${String(m.tps).padStart(3)}   Kills: ${String(m.kills).padStart(2)}`);
  }
}

// ═════════════════════════════════════════════════════════════════
// PHASE 4 — per-pullback ceiling: what would an "oracle" buy at each bottom earn?
// ═════════════════════════════════════════════════════════════════
console.log("\n\n════════════════════════════════════════════════════════════════════════");
console.log("PHASE 4 — Oracle earnings ceiling per pullback");
console.log("════════════════════════════════════════════════════════════════════════");
console.log("  If we placed an $800 long AT the exact low of each pullback and sold at recovery:");
let oracleTotal = 0;
for (const p of pullbacks) {
  if (p.recPrice === null) continue;
  const pnlPct = (p.recPrice - p.lowPrice) / p.lowPrice * 100;
  const pnlUsd = 800 * pnlPct / 100 - 800 * 0.00055 * 2;
  oracleTotal += pnlUsd;
  const lt = new Date(p.lowTs).toISOString().slice(5, 16).replace("T", " ");
  console.log(`    [${lt}] drop ${p.dropPct.toFixed(2)}% → rec +${pnlPct.toFixed(2)}% = $${pnlUsd.toFixed(0)}  (CRSI ${p.crsi4HAtLow?.toFixed(1) ?? "?"} | RSI ${p.rsi1HAtLow?.toFixed(1) ?? "?"})`);
}
console.log(`  Oracle total on $800 base across ${pullbacks.length} pullbacks: $${oracleTotal.toFixed(0)}`);
console.log(`  (theoretical max — catches every local low at first rung. real ladder can beat this with martingale on deep dips.)`);
