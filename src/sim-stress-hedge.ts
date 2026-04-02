import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Stress hedge + Deep hold hedge sim
//
// Path 1 — Stress (crash/acceleration):
//   rungs >= stressRungs + avgPnL <= stressPnlPct + RSI <= rsiMax + ROC5 <= roc5Max
//
// Path 2 — Deep hold (slow grind):
//   rungs == maxPos (fully loaded) + avgPnL <= deepHoldPnlPct
//   + firstPositionAge >= deepHoldMinAgeH + RSI <= deepHoldRsiMax
//   (no ROC5 requirement)
//
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

// ── RSI(14) ──
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

// ── ROC5 ──
function calcROC5(closes: number[]): number[] {
  return closes.map((c, i) => i < 5 ? NaN : (c - closes[i - 5]) / closes[i - 5] * 100);
}

// Precompute 1h bars + indicators
const bars1h = buildBars(candles, 3600000);
const closes1h = bars1h.map(b => b.close);
const rsi1h = calcRSI(closes1h);
const roc1h = calcROC5(closes1h);
const idx1hMap = new Map<number, number>();
bars1h.forEach((b, i) => idx1hMap.set(b.ts, i));

// ── EMA50 on 1h closes ──
const ema1h = (d: number[], p: number) => { const k = 2/(p+1); const r = [d[0]]; for (let i=1;i<d.length;i++) r.push(d[i]*k+r[i-1]*(1-k)); return r; };
const ema50_1h = ema1h(closes1h, 50);

// ── ATR14 percentile on 1h (using high/low from 5m candles aggregated to 1h) ──
const highs1h: number[] = [], lows1h: number[] = [];
{
  let curTs = -1, curH = -Infinity, curL = Infinity;
  for (const c of candles) {
    const bt = Math.floor(c.timestamp / 3600000) * 3600000;
    if (bt !== curTs) {
      if (curTs !== -1) { highs1h.push(curH); lows1h.push(curL); }
      curTs = bt; curH = c.high; curL = c.low;
    } else { if (c.high > curH) curH = c.high; if (c.low < curL) curL = c.low; }
  }
  if (curTs !== -1) { highs1h.push(curH); lows1h.push(curL); }
}
// True range array
const tr1h = closes1h.map((c, i) => {
  if (i === 0) return highs1h[i] - lows1h[i];
  const hl = highs1h[i] - lows1h[i];
  const hc = Math.abs(highs1h[i] - closes1h[i-1]);
  const lc = Math.abs(lows1h[i] - closes1h[i-1]);
  return Math.max(hl, hc, lc);
});
// Rolling ATR14
const atr14_1h: number[] = new Array(closes1h.length).fill(NaN);
for (let i = 14; i < tr1h.length; i++) {
  atr14_1h[i] = i === 14
    ? tr1h.slice(1, 15).reduce((a, b) => a + b, 0) / 14
    : (atr14_1h[i-1] * 13 + tr1h[i]) / 14;
}
// ATR as % of close
const atrPct1h = atr14_1h.map((a, i) => isNaN(a) ? NaN : (a / closes1h[i]) * 100);
// Rolling 100-bar median ATR%
const medAtrPct1h: number[] = new Array(closes1h.length).fill(NaN);
for (let i = 100; i < closes1h.length; i++) {
  const window = atrPct1h.slice(i - 100, i).filter(v => !isNaN(v)).sort((a, b) => a - b);
  if (window.length > 0) medAtrPct1h[i] = window[Math.floor(window.length / 2)];
}

function get1hInd(ts: number): { rsi: number; roc5: number; ema50: number; atrPct: number; medAtrPct: number } | null {
  const prevBarTs = Math.floor(ts / 3600000) * 3600000 - 3600000;
  const idx = idx1hMap.get(prevBarTs);
  if (idx === undefined) return null;
  if (isNaN(rsi1h[idx]) || isNaN(roc1h[idx])) return null;
  return {
    rsi: rsi1h[idx],
    roc5: roc1h[idx],
    ema50: ema50_1h[idx],
    atrPct: isNaN(atrPct1h[idx]) ? 0 : atrPct1h[idx],
    medAtrPct: isNaN(medAtrPct1h[idx]) ? 0 : medAtrPct1h[idx],
  };
}

// ── 4h trend gate ──
const PERIOD4H = 4 * 3600000;
const bars4h: { ts: number; close: number }[] = [];
let curBar = -1, lastClose4 = 0, lastTs4 = 0;
for (const c of candles) {
  const bar = Math.floor(c.timestamp / PERIOD4H);
  if (bar !== curBar) { if (curBar !== -1) bars4h.push({ ts: lastTs4, close: lastClose4 }); curBar = bar; }
  lastClose4 = c.close; lastTs4 = c.timestamp;
}
bars4h.push({ ts: lastTs4, close: lastClose4 });
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
  // Path 1: stress (crash/acceleration)
  stressEnabled: boolean;
  stressRungs: number;
  stressPnlPct: number;
  rsiMax: number;
  roc5Max: number;
  // Path 2: deep hold (slow grind)
  deepHoldEnabled: boolean;
  deepHoldPnlPct: number;
  deepHoldRsiMax: number;
  deepHoldMinAgeH: number;
  // Regime gates (applied to stress path)
  requireHostile4h: boolean;     // require 4h trend hostile (EMA200 + EMA50 slope)
  requireBearish1h: boolean;     // require price < EMA50 on 1h
  blockHighVol: boolean;         // block hedge when ATR > median * atrVolMultiplier
  atrVolMultiplier: number;      // e.g. 1.5 = block if current ATR > 1.5× median
  // Shared
  hedgeSizePct: number;
  hedgeTp: number;
  hedgeKill: number;
  hedgeCooldownMin: number;
}

interface Result {
  finalEq: number; ret: number; maxDD: number; minEq: number;
  longTPs: number; longStales: number; longKills: number; longFlats: number;
  stressFires: number; deepHoldFires: number;
  hedgeTPs: number; hedgeKills: number; hedgePnl: number;
}

function runSim(cfg: HedgeCfg): Result {
  const startTs = new Date(cfg.startDate).getTime();
  let cap = cfg.capital, peak = cap, minEq = cap, maxDD = 0;
  type Pos = { ep: number; et: number; qty: number; not: number };
  const longs: Pos[] = [];
  let short: Pos | null = null;
  let lastAdd = 0, lastHedge = 0;
  let longTPs = 0, longStales = 0, longKills = 0, longFlats = 0;
  let stressFires = 0, deepHoldFires = 0;
  let hedgeTPs = 0, hedgeKills = 0, hedgePnl = 0;

  for (const c of candles) {
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;

    // Equity
    const longUr = longs.reduce((a, p) => a + (close - p.ep) * p.qty, 0);
    const shortUr = short ? (short.ep - close) * short.qty : 0;
    const eq = cap + longUr + shortUr;
    if (eq > peak) peak = eq; if (eq < minEq) minEq = eq;
    const dd = peak > 0 ? (peak - eq) / peak * 100 : 0; if (dd > maxDD) maxDD = dd;

    // ── Short exit ──
    if (short) {
      const tpP = short.ep * (1 - cfg.hedgeTp / 100);
      const killP = short.ep * (1 + cfg.hedgeKill / 100);
      if (low <= tpP) {
        const pnl = (short.ep - tpP) * short.qty - (short.not * cfg.fee + tpP * short.qty * cfg.fee);
        cap += pnl; hedgePnl += pnl; hedgeTPs++; short = null;
      } else if (high >= killP) {
        const pnl = (short.ep - killP) * short.qty - (short.not * cfg.fee + killP * short.qty * cfg.fee);
        cap += pnl; hedgePnl += pnl; hedgeKills++; short = null;
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
        for (const p of longs) {
          const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000));
          cap += (tpPrice - p.ep) * p.qty - (p.not * cfg.fee + tpPrice * p.qty * cfg.fee) - fund;
        }
        longs.length = 0; lastAdd = 0;
        if (isStale) longStales++; else longTPs++;
        // Close hedge on long TP — trend reversed
        if (short) {
          const pnl = (short.ep - close) * short.qty - (short.not * cfg.fee + close * short.qty * cfg.fee);
          cap += pnl; hedgePnl += pnl; short = null;
        }
        continue;
      }
      if (cfg.killPct !== 0 && avgPnl <= cfg.killPct) {
        for (const p of longs) {
          const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000));
          cap += (close - p.ep) * p.qty - (p.not * cfg.fee + close * p.qty * cfg.fee) - fund;
        }
        longs.length = 0; lastAdd = 0; longKills++;
        if (short) {
          const pnl = (short.ep - close) * short.qty - (short.not * cfg.fee + close * short.qty * cfg.fee);
          cap += pnl; hedgePnl += pnl; short = null;
        }
        continue;
      }
      if (cfg.flatH > 0 && oldH >= cfg.flatH && avgPnl <= cfg.flatPct && isHostile(ts)) {
        for (const p of longs) {
          const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000));
          cap += (close - p.ep) * p.qty - (p.not * cfg.fee + close * p.qty * cfg.fee) - fund;
        }
        longs.length = 0; lastAdd = 0; longFlats++;
        if (short) {
          const pnl = (short.ep - close) * short.qty - (short.not * cfg.fee + close * short.qty * cfg.fee);
          cap += pnl; hedgePnl += pnl; short = null;
        }
        continue;
      }
    }

    // ── Long entries ──
    if (longs.length < cfg.maxPos && (ts - lastAdd) / 60000 >= cfg.addMin && !isHostile(ts)) {
      const not = cfg.base * Math.pow(cfg.scale, longs.length);
      longs.push({ ep: close, et: ts, qty: not / close, not }); lastAdd = ts;
    }

    // ── Hedge entries ──
    if (short === null && longs.length > 0 && (ts - lastHedge) / 60000 >= cfg.hedgeCooldownMin) {
      const tQty = longs.reduce((a, p) => a + p.qty, 0);
      const avgE = longs.reduce((a, p) => a + p.ep * p.qty, 0) / tQty;
      const avgPnlPct = (close - avgE) / avgE * 100;
      const totalNot = longs.reduce((a, p) => a + p.not, 0);
      const hedgeNot = totalNot * cfg.hedgeSizePct / 100;
      let fired = false;

      // Path 1: stress
      if (cfg.stressEnabled && longs.length >= cfg.stressRungs && avgPnlPct <= cfg.stressPnlPct) {
        // Regime gates
        const hostile4hOk = !cfg.requireHostile4h || isHostile(ts);
        if (hostile4hOk) {
          const ind = get1hInd(ts);
          if (ind && ind.rsi <= cfg.rsiMax && ind.roc5 <= cfg.roc5Max) {
            const bearish1hOk = !cfg.requireBearish1h || close < ind.ema50;
            const highVolBlocked = cfg.blockHighVol && ind.medAtrPct > 0 && ind.atrPct > ind.medAtrPct * cfg.atrVolMultiplier;
            if (bearish1hOk && !highVolBlocked) {
              short = { ep: close, et: ts, qty: hedgeNot / close, not: hedgeNot };
              stressFires++; fired = true; lastHedge = ts;
            }
          }
        }
      }

      // Path 2: deep hold (only if stress didn't fire)
      if (!fired && cfg.deepHoldEnabled && longs.length >= cfg.maxPos && avgPnlPct <= cfg.deepHoldPnlPct) {
        const firstAge = (ts - longs[0].et) / 3600000;
        if (firstAge >= cfg.deepHoldMinAgeH) {
          const ind = get1hInd(ts);
          if (ind && ind.rsi <= cfg.deepHoldRsiMax) {
            short = { ep: close, et: ts, qty: hedgeNot / close, not: hedgeNot };
            deepHoldFires++; lastHedge = ts;
          }
        }
      }
    }
  }

  // Close open at end
  const last = candles[candles.length - 1];
  for (const p of longs) cap += (last.close - p.ep) * p.qty - (p.not * cfg.fee + last.close * p.qty * cfg.fee);
  if (short) { const pnl = (short.ep - last.close) * short.qty - (short.not * cfg.fee + last.close * short.qty * cfg.fee); cap += pnl; hedgePnl += pnl; }

  return { finalEq: cap, ret: (cap / cfg.capital - 1) * 100, maxDD, minEq, longTPs, longStales, longKills, longFlats, stressFires, deepHoldFires, hedgeTPs, hedgeKills, hedgePnl };
}

// ── Output formatting ──
function row(label: string, r: Result) {
  const totalFires = r.stressFires + r.deepHoldFires;
  const tpRate = totalFires > 0 ? (r.hedgeTPs / totalFires * 100).toFixed(0) + "%" : "n/a";
  return `  ${label.padEnd(42)} ${("$"+r.finalEq.toFixed(0)).padStart(9)} ${((r.ret>=0?"+":"")+r.ret.toFixed(1)+"%").padStart(9)} ${(r.maxDD.toFixed(1)+"%").padStart(7)} ${("$"+r.minEq.toFixed(0)).padStart(9)} ${String(r.stressFires).padStart(7)} ${String(r.deepHoldFires).padStart(8)} ${"$"+(r.hedgePnl>=0?"+":"")+r.hedgePnl.toFixed(0).padStart(7)} ${String(r.hedgeTPs).padStart(4)} ${String(r.hedgeKills).padStart(6)} ${tpRate.padStart(7)}`;
}
const hdr = `  ${"Config".padEnd(42)} ${"FinalEq".padStart(9)} ${"Return".padStart(9)} ${"MaxDD".padStart(7)} ${"MinEq".padStart(9)} ${"Stress".padStart(7)} ${"DeepHold".padStart(8)} ${"HedgePnL".padStart(9)} ${"TPs".padStart(4)} ${"Kills".padStart(6)} ${"TPrate".padStart(7)}`;
const div = "  " + "-".repeat(118);
const SEP = "=".repeat(122);

const base: Omit<HedgeCfg, "label"> = {
  startDate: "2024-12-06",
  base: 800, scale: 1.2, maxPos: 11, capital: 10000,
  tp: 1.4, addMin: 30, staleH: 8, reducedTp: 0.3,
  flatH: 40, flatPct: -6, killPct: -10, fee: 0.00055, fund8h: 0.0001,
  stressEnabled: false,
  stressRungs: 9, stressPnlPct: -2.5, rsiMax: 40, roc5Max: -3.5,
  deepHoldEnabled: false,
  deepHoldPnlPct: -4.0, deepHoldRsiMax: 50, deepHoldMinAgeH: 6,
  requireHostile4h: false, requireBearish1h: false,
  blockHighVol: false, atrVolMultiplier: 1.5,
  hedgeSizePct: 20, hedgeTp: 2.0, hedgeKill: 3.0, hedgeCooldownMin: 60,
};

const base26: Omit<HedgeCfg, "label"> = { ...base, startDate: "2026-01-01" };
const base2510: Omit<HedgeCfg, "label"> = { ...base, startDate: "2025-10-01" };
const base257: Omit<HedgeCfg, "label"> = { ...base, startDate: "2025-07-01" };
const base254: Omit<HedgeCfg, "label"> = { ...base, startDate: "2025-04-01" };

const bslFull = runSim({ ...base, label: "baseline" });
const bsl26   = runSim({ ...base26, label: "baseline" });

// ─── Section 1: Regime gate isolation (Jan 2026) ───
console.log(SEP);
console.log("  REGIME-GATED STRESS HEDGE — Jan 2026 → Apr 2026");
console.log("  Base trigger: rungs>=9 + avgPnL<=-2.5% + RSI1h<=40 + ROC5<=-3.5%");
console.log("  Gates: hostile4h = 4h EMA200+EMA50 hostile | bearish1h = price < EMA50_1h");
console.log("         blockHighVol = block when ATR > N× median");
console.log(SEP);
console.log(hdr); console.log(div);
console.log(row("baseline (no hedge)", bsl26));
console.log(row("stress — no regime gate (current)", runSim({ ...base26, label: "", stressEnabled: true })));
console.log(row("stress + hostile4h gate", runSim({ ...base26, label: "", stressEnabled: true, requireHostile4h: true })));
console.log(row("stress + bearish1h gate", runSim({ ...base26, label: "", stressEnabled: true, requireBearish1h: true })));
console.log(row("stress + hostile4h + bearish1h", runSim({ ...base26, label: "", stressEnabled: true, requireHostile4h: true, requireBearish1h: true })));
console.log(row("stress + blockHighVol (>1.5×med)", runSim({ ...base26, label: "", stressEnabled: true, blockHighVol: true, atrVolMultiplier: 1.5 })));
console.log(row("stress + blockHighVol (>2.0×med)", runSim({ ...base26, label: "", stressEnabled: true, blockHighVol: true, atrVolMultiplier: 2.0 })));
console.log(row("stress + bearish1h + blockHighVol(1.5×)", runSim({ ...base26, label: "", stressEnabled: true, requireBearish1h: true, blockHighVol: true, atrVolMultiplier: 1.5 })));
console.log(row("stress + all gates (4h+1h+vol1.5×)", runSim({ ...base26, label: "", stressEnabled: true, requireHostile4h: true, requireBearish1h: true, blockHighVol: true, atrVolMultiplier: 1.5 })));

// ─── Section 2: Full history regime gate isolation ───
console.log("\n--- Regime gates — full history (Dec 2024 → Apr 2026) ---");
console.log(hdr); console.log(div);
console.log(row("baseline (no hedge)", bslFull));
console.log(row("stress — no regime gate (current)", runSim({ ...base, label: "", stressEnabled: true })));
console.log(row("stress + hostile4h gate", runSim({ ...base, label: "", stressEnabled: true, requireHostile4h: true })));
console.log(row("stress + bearish1h gate", runSim({ ...base, label: "", stressEnabled: true, requireBearish1h: true })));
console.log(row("stress + hostile4h + bearish1h", runSim({ ...base, label: "", stressEnabled: true, requireHostile4h: true, requireBearish1h: true })));
console.log(row("stress + blockHighVol (>1.5×med)", runSim({ ...base, label: "", stressEnabled: true, blockHighVol: true, atrVolMultiplier: 1.5 })));
console.log(row("stress + bearish1h + blockHighVol(1.5×)", runSim({ ...base, label: "", stressEnabled: true, requireBearish1h: true, blockHighVol: true, atrVolMultiplier: 1.5 })));
console.log(row("stress + all gates (4h+1h+vol1.5×)", runSim({ ...base, label: "", stressEnabled: true, requireHostile4h: true, requireBearish1h: true, blockHighVol: true, atrVolMultiplier: 1.5 })));

// ─── Section 3: Multi-period regime gate validation ───
console.log("\n" + SEP);
console.log("  MULTI-PERIOD REGIME VALIDATION — TP=2% kill=3%, 20% notional");
console.log(SEP);
console.log(hdr); console.log(div);
for (const [label, cfg] of [
  ["Apr 2025 → Apr 2026", base254],
  ["Jul 2025 → Apr 2026", base257],
  ["Oct 2025 → Apr 2026", base2510],
  ["Jan 2026 → Apr 2026", base26],
  ["Dec 2024 → Apr 2026 (full)", base],
] as [string, typeof base][]) {
  const bsl = runSim({ ...cfg, label: "" });
  const noGate = runSim({ ...cfg, label: "", stressEnabled: true });
  const gate4h = runSim({ ...cfg, label: "", stressEnabled: true, requireHostile4h: true });
  const gate1h = runSim({ ...cfg, label: "", stressEnabled: true, requireBearish1h: true });
  const gateBoth = runSim({ ...cfg, label: "", stressEnabled: true, requireHostile4h: true, requireBearish1h: true });
  const gateVol = runSim({ ...cfg, label: "", stressEnabled: true, requireBearish1h: true, blockHighVol: true, atrVolMultiplier: 1.5 });
  console.log(row(`${label} — baseline`, bsl));
  console.log(row(`${label} — no gate`, noGate));
  console.log(row(`${label} — +hostile4h`, gate4h));
  console.log(row(`${label} — +bearish1h`, gate1h));
  console.log(row(`${label} — +4h+1h`, gateBoth));
  console.log(row(`${label} — +1h+vol(1.5×)`, gateVol));
  console.log(div);
}
