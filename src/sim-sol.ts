import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// SOL martingale ladder sim
// Same backtester as sim-stress-hedge, adapted for SOLUSDT
// Sections:
//   1. Param sweep — TP%, addMin, scale (full history)
//   2. Best config + stress hedge (multi-period)
//   3. Regime gate validation on best config
// ─────────────────────────────────────────────

const DATA_FILE = "data/SOLUSDT_5.json";
if (!fs.existsSync(DATA_FILE)) { console.error("Missing", DATA_FILE, "— run: npx ts-node src/fetch-candles.ts SOLUSDT 5 2024-12-01"); process.exit(1); }
const candles: Candle[] = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

// ── Bar builders ──
function buildBars(cs: Candle[], ms: number) {
  const bars: { ts: number; open: number; high: number; low: number; close: number }[] = [];
  let cur: typeof bars[0] | null = null;
  for (const c of cs) {
    const bt = Math.floor(c.timestamp / ms) * ms;
    if (!cur || cur.ts !== bt) { if (cur) bars.push(cur); cur = { ts: bt, open: c.open, high: c.high, low: c.low, close: c.close }; }
    else { if (c.high > cur.high) cur.high = c.high; if (c.low < cur.low) cur.low = c.low; cur.close = c.close; }
  }
  if (cur) bars.push(cur);
  return bars;
}

// ── RSI(14) ──
function calcRSI(closes: number[]): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < 15) return rsi;
  let ag = 0, al = 0;
  for (let i = 1; i <= 14; i++) { const d = closes[i] - closes[i-1]; if (d > 0) ag += d; else al -= d; }
  ag /= 14; al /= 14;
  rsi[14] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = 15; i < closes.length; i++) {
    const d = closes[i] - closes[i-1]; const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    ag = (ag * 13 + g) / 14; al = (al * 13 + l) / 14;
    rsi[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return rsi;
}

// ── ROC5 ──
function calcROC5(closes: number[]): number[] {
  return closes.map((c, i) => i < 5 ? NaN : (c - closes[i-5]) / closes[i-5] * 100);
}

// ── EMA ──
const ema = (d: number[], p: number) => { const k = 2/(p+1); const r = [d[0]]; for (let i=1;i<d.length;i++) r.push(d[i]*k+r[i-1]*(1-k)); return r; };

// Precompute 1h bars + indicators
const bars1h = buildBars(candles, 3600000);
const closes1h = bars1h.map(b => b.close);
const rsi1h = calcRSI(closes1h);
const roc1h = calcROC5(closes1h);
const ema50_1h = ema(closes1h, 50);
const idx1hMap = new Map<number, number>();
bars1h.forEach((b, i) => idx1hMap.set(b.ts, i));

// ATR14 on 1h + rolling 100-bar median
const tr1h = closes1h.map((c, i) => {
  if (i === 0) return bars1h[i].high - bars1h[i].low;
  return Math.max(bars1h[i].high - bars1h[i].low, Math.abs(bars1h[i].high - closes1h[i-1]), Math.abs(bars1h[i].low - closes1h[i-1]));
});
const atr14_1h: number[] = new Array(closes1h.length).fill(NaN);
for (let i = 14; i < tr1h.length; i++) atr14_1h[i] = i === 14 ? tr1h.slice(1, 15).reduce((a,b) => a+b, 0) / 14 : (atr14_1h[i-1] * 13 + tr1h[i]) / 14;
const atrPct1h = atr14_1h.map((a, i) => isNaN(a) ? NaN : (a / closes1h[i]) * 100);
const medAtrPct1h: number[] = new Array(closes1h.length).fill(NaN);
for (let i = 100; i < closes1h.length; i++) {
  const w = atrPct1h.slice(i-100, i).filter(v => !isNaN(v)).sort((a,b) => a-b);
  if (w.length > 0) medAtrPct1h[i] = w[Math.floor(w.length / 2)];
}

function get1hInd(ts: number) {
  const prevTs = Math.floor(ts / 3600000) * 3600000 - 3600000;
  const idx = idx1hMap.get(prevTs);
  if (idx === undefined) return null;
  if (isNaN(rsi1h[idx]) || isNaN(roc1h[idx])) return null;
  return { rsi: rsi1h[idx], roc5: roc1h[idx], ema50: ema50_1h[idx], atrPct: isNaN(atrPct1h[idx]) ? 0 : atrPct1h[idx], medAtrPct: isNaN(medAtrPct1h[idx]) ? 0 : medAtrPct1h[idx] };
}

// 4h trend gate
const PERIOD4H = 4 * 3600000;
const bars4h = buildBars(candles, PERIOD4H);
const c4h = bars4h.map(b => b.close), e200_4h = ema(c4h, 200), e50_4h = ema(c4h, 50);
const hostile4h = new Map<number, boolean>();
for (let i = 1; i < bars4h.length; i++) hostile4h.set(Math.floor(bars4h[i].ts / PERIOD4H) * PERIOD4H, c4h[i] < e200_4h[i] && e50_4h[i] < e50_4h[i-1]);
const isHostile = (ts: number) => hostile4h.get(Math.floor(ts / PERIOD4H) * PERIOD4H - PERIOD4H) ?? false;

interface Cfg {
  label: string; startDate: string;
  base: number; scale: number; maxPos: number; capital: number;
  tp: number; addMin: number; staleH: number; reducedTp: number;
  flatH: number; flatPct: number; killPct: number; fee: number; fund8h: number;
  stressEnabled: boolean;
  stressRungs: number; stressPnlPct: number; rsiMax: number; roc5Max: number;
  blockHighVol: boolean; atrVolMultiplier: number;
  hedgeSizePct: number; hedgeTp: number; hedgeKill: number; hedgeCooldownMin: number;
}

interface Result {
  finalEq: number; ret: number; maxDD: number; minEq: number;
  tps: number; stales: number; kills: number; flats: number;
  stressFires: number; hedgeTPs: number; hedgeKills: number; hedgePnl: number;
  priceStart: number; priceEnd: number;
}

function runSim(cfg: Cfg): Result {
  const startTs = new Date(cfg.startDate).getTime();
  let cap = cfg.capital, peak = cap, minEq = cap, maxDD = 0;
  type Pos = { ep: number; et: number; qty: number; not: number };
  const longs: Pos[] = [];
  let short: Pos | null = null;
  let lastAdd = 0, lastHedge = 0;
  let tps = 0, stales = 0, kills = 0, flats = 0, stressFires = 0;
  let hedgeTPs = 0, hedgeKills = 0, hedgePnl = 0;
  let priceStart = 0, priceEnd = 0;

  for (const c of candles) {
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;
    if (priceStart === 0) priceStart = close;
    priceEnd = close;

    // Equity
    const longUr = longs.reduce((a, p) => a + (close - p.ep) * p.qty, 0);
    const shortUr = short ? (short.ep - close) * short.qty : 0;
    const eq = cap + longUr + shortUr;
    if (eq > peak) peak = eq; if (eq < minEq) minEq = eq;
    const dd = peak > 0 ? (peak - eq) / peak * 100 : 0; if (dd > maxDD) maxDD = dd;

    // Short exit
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

    // Long exits
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
        if (isStale) stales++; else tps++;
        if (short) { const pnl = (short.ep - close) * short.qty - (short.not * cfg.fee + close * short.qty * cfg.fee); cap += pnl; hedgePnl += pnl; short = null; }
        continue;
      }
      if (cfg.killPct !== 0 && avgPnl <= cfg.killPct) {
        for (const p of longs) {
          const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000));
          cap += (close - p.ep) * p.qty - (p.not * cfg.fee + close * p.qty * cfg.fee) - fund;
        }
        longs.length = 0; lastAdd = 0; kills++;
        if (short) { const pnl = (short.ep - close) * short.qty - (short.not * cfg.fee + close * short.qty * cfg.fee); cap += pnl; hedgePnl += pnl; short = null; }
        continue;
      }
      if (cfg.flatH > 0 && oldH >= cfg.flatH && avgPnl <= cfg.flatPct && isHostile(ts)) {
        for (const p of longs) {
          const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000));
          cap += (close - p.ep) * p.qty - (p.not * cfg.fee + close * p.qty * cfg.fee) - fund;
        }
        longs.length = 0; lastAdd = 0; flats++;
        if (short) { const pnl = (short.ep - close) * short.qty - (short.not * cfg.fee + close * short.qty * cfg.fee); cap += pnl; hedgePnl += pnl; short = null; }
        continue;
      }
    }

    // Long entries
    if (longs.length < cfg.maxPos && (ts - lastAdd) / 60000 >= cfg.addMin && !isHostile(ts)) {
      const not = cfg.base * Math.pow(cfg.scale, longs.length);
      longs.push({ ep: close, et: ts, qty: not / close, not }); lastAdd = ts;
    }

    // Stress hedge entry
    if (cfg.stressEnabled && short === null && longs.length > 0 && (ts - lastHedge) / 60000 >= cfg.hedgeCooldownMin) {
      const tQty = longs.reduce((a, p) => a + p.qty, 0);
      const avgE = longs.reduce((a, p) => a + p.ep * p.qty, 0) / tQty;
      const avgPnlPct = (close - avgE) / avgE * 100;
      if (longs.length >= cfg.stressRungs && avgPnlPct <= cfg.stressPnlPct) {
        const ind = get1hInd(ts);
        if (ind && ind.rsi <= cfg.rsiMax && ind.roc5 <= cfg.roc5Max) {
          const highVolBlocked = cfg.blockHighVol && ind.medAtrPct > 0 && ind.atrPct > ind.medAtrPct * cfg.atrVolMultiplier;
          if (!highVolBlocked) {
            const totalNot = longs.reduce((a, p) => a + p.not, 0);
            const hedgeNot = totalNot * cfg.hedgeSizePct / 100;
            short = { ep: close, et: ts, qty: hedgeNot / close, not: hedgeNot };
            stressFires++; lastHedge = ts;
          }
        }
      }
    }
  }

  // Close open at end
  const last = candles[candles.length - 1];
  for (const p of longs) cap += (last.close - p.ep) * p.qty - (p.not * cfg.fee + last.close * p.qty * cfg.fee);
  if (short) { const pnl = (short.ep - last.close) * short.qty - (short.not * cfg.fee + last.close * short.qty * cfg.fee); cap += pnl; hedgePnl += pnl; }

  return { finalEq: cap, ret: (cap / cfg.capital - 1) * 100, maxDD, minEq, tps, stales, kills, flats, stressFires, hedgeTPs, hedgeKills, hedgePnl, priceStart, priceEnd };
}

// ── Output helpers ──
function pct(n: number, dec = 1) { return (n >= 0 ? "+" : "") + n.toFixed(dec) + "%"; }
function rowBase(label: string, r: Result) {
  const priceChg = r.priceStart > 0 ? pct((r.priceEnd - r.priceStart) / r.priceStart * 100) : "n/a";
  return `  ${label.padEnd(38)} ${("$"+r.finalEq.toFixed(0)).padStart(9)} ${pct(r.ret).padStart(8)} ${(r.maxDD.toFixed(1)+"%").padStart(7)} ${("$"+r.minEq.toFixed(0)).padStart(9)} ${String(r.tps).padStart(5)} ${String(r.stales).padStart(7)} ${String(r.kills).padStart(6)} ${String(r.flats).padStart(6)} ${priceChg.padStart(8)}`;
}
function rowHedge(label: string, r: Result) {
  const tpRate = r.stressFires > 0 ? (r.hedgeTPs / r.stressFires * 100).toFixed(0) + "%" : "n/a";
  return `  ${label.padEnd(38)} ${("$"+r.finalEq.toFixed(0)).padStart(9)} ${pct(r.ret).padStart(8)} ${(r.maxDD.toFixed(1)+"%").padStart(7)} ${("$"+r.minEq.toFixed(0)).padStart(9)} ${String(r.stressFires).padStart(7)} ${"$"+(r.hedgePnl>=0?"+":"")+r.hedgePnl.toFixed(0).padStart(7)} ${String(r.hedgeTPs).padStart(4)} ${String(r.hedgeKills).padStart(6)} ${tpRate.padStart(7)}`;
}

const hdrBase = `  ${"Config".padEnd(38)} ${"FinalEq".padStart(9)} ${"Return".padStart(8)} ${"MaxDD".padStart(7)} ${"MinEq".padStart(9)} ${"TPs".padStart(5)} ${"Stales".padStart(7)} ${"Kills".padStart(6)} ${"Flats".padStart(6)} ${"PriceChg".padStart(8)}`;
const hdrHedge = `  ${"Config".padEnd(38)} ${"FinalEq".padStart(9)} ${"Return".padStart(8)} ${"MaxDD".padStart(7)} ${"MinEq".padStart(9)} ${"Fires".padStart(7)} ${"HedgePnL".padStart(9)} ${"TPs".padStart(4)} ${"Kills".padStart(6)} ${"TPrate".padStart(7)}`;
const div = "  " + "-".repeat(102);
const SEP = "=".repeat(106);

// Data range info
const first = candles[0], last = candles[candles.length - 1];
console.log(`\nSOL data: ${new Date(first.timestamp).toISOString().slice(0,10)} → ${new Date(last.timestamp).toISOString().slice(0,10)} | ${candles.length} 5m candles`);
console.log(`Price: $${first.open.toFixed(2)} → $${last.close.toFixed(2)} (${pct((last.close - first.open) / first.open * 100)})\n`);

// ── Base config ──
const base: Omit<Cfg, "label"> = {
  startDate: "2024-12-01",
  base: 800, scale: 1.2, maxPos: 11, capital: 10000,
  tp: 1.4, addMin: 30, staleH: 8, reducedTp: 0.3,
  flatH: 40, flatPct: -6, killPct: -10, fee: 0.00055, fund8h: 0.0001,
  stressEnabled: false,
  stressRungs: 9, stressPnlPct: -2.5, rsiMax: 40, roc5Max: -3.5,
  blockHighVol: true, atrVolMultiplier: 1.5,
  hedgeSizePct: 20, hedgeTp: 2.0, hedgeKill: 3.0, hedgeCooldownMin: 60,
};
const base254: Omit<Cfg, "label"> = { ...base, startDate: "2025-04-01" };
const base257: Omit<Cfg, "label"> = { ...base, startDate: "2025-07-01" };
const base2510: Omit<Cfg, "label"> = { ...base, startDate: "2025-10-01" };
const base26: Omit<Cfg, "label"> = { ...base, startDate: "2026-01-01" };

// ═══════════════════════════════════════════════════════════
//   SECTION 1 — Param sweep on full history (no hedge)
// ═══════════════════════════════════════════════════════════
console.log(SEP);
console.log("  SOL PARAM SWEEP — Full history (Dec 2024 → now), no hedge");
console.log("  Sweeping: TP%, addIntervalMin, scale");
console.log(SEP);
console.log(hdrBase); console.log(div);

for (const tp of [1.0, 1.4, 2.0]) {
  for (const addMin of [20, 30, 45]) {
    for (const scale of [1.1, 1.2, 1.3]) {
      const label = `TP=${tp}% add=${addMin}m scale=${scale}`;
      const r = runSim({ ...base, label, tp, addMin, scale });
      console.log(rowBase(label, r));
    }
  }
}

// ═══════════════════════════════════════════════════════════
//   SECTION 2 — Stress hedge on best config (multi-period)
// ═══════════════════════════════════════════════════════════
console.log("\n" + SEP);
console.log("  SOL STRESS HEDGE — Multi-period validation");
console.log("  Config: best TP/addMin from sweep + stress hedge variants");
console.log("  Hedge: rungs>=9, avgPnL<=-2.5%, RSI1h<=40, ROC5<=-3.5%, 20% notional, TP=2%/kill=3%");
console.log(SEP);
console.log(hdrHedge); console.log(div);

for (const [periodLabel, cfg] of [
  ["Apr 2025 → now", base254],
  ["Jul 2025 → now", base257],
  ["Oct 2025 → now", base2510],
  ["Jan 2026 → now", base26],
  ["Dec 2024 → now (full)", base],
] as [string, typeof base][]) {
  const bsl = runSim({ ...cfg, label: "" });
  const noGate = runSim({ ...cfg, label: "", stressEnabled: true, blockHighVol: false });
  const blockVol = runSim({ ...cfg, label: "", stressEnabled: true, blockHighVol: true });
  console.log(rowHedge(`${periodLabel} — baseline`, bsl));
  console.log(rowHedge(`${periodLabel} — stress (no vol gate)`, noGate));
  console.log(rowHedge(`${periodLabel} — stress + blockHighVol`, blockVol));
  console.log(div);
}

// ═══════════════════════════════════════════════════════════
//   SECTION 3 — addMin sensitivity (SOL moves faster)
// ═══════════════════════════════════════════════════════════
console.log("\n" + SEP);
console.log("  SOL addIntervalMin SENSITIVITY — Jan 2026 → now (most recent regime)");
console.log(SEP);
console.log(hdrBase); console.log(div);

for (const addMin of [15, 20, 25, 30, 40, 60]) {
  for (const tp of [1.0, 1.4, 2.0]) {
    const label = `add=${addMin}m tp=${tp}%`;
    const r = runSim({ ...base26, label, addMin, tp });
    console.log(rowBase(label, r));
  }
}

// ═══════════════════════════════════════════════════════════
//   SECTION 4 — Past month sideways regime (Mar 2026 → now)
//   SOL -6.5% — expected: ladder should print cleanly here
// ═══════════════════════════════════════════════════════════
const baseMar: Omit<Cfg, "label"> = { ...base, startDate: "2026-03-01", capital: 1000, base: 200 };
console.log("\n" + SEP);
console.log("  SOL SIDEWAYS — Past month only (Mar 2026 → Apr 2, price -6.5%)");
console.log("  Live sizing: $1k capital, $200 base, scale=1.1, maxPos=11");
console.log(SEP);
console.log(hdrBase); console.log(div);

for (const maxPos of [6, 9, 11]) {
  for (const addMin of [20, 30, 40, 60]) {
    for (const tp of [1.0, 1.4, 2.0, 3.0]) {
      for (const scale of [1.1, 1.2]) {
        const label = `mx=${maxPos} add=${addMin}m tp=${tp}% sc=${scale}`;
        const r = runSim({ ...baseMar, label, addMin, tp, scale, maxPos });
        console.log(rowBase(label, r));
      }
    }
  }
  console.log(div);
}
