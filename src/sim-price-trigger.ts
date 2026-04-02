import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Price-triggered add experiment
//
// Baseline: time-only add (current behavior)
// New:      add when price drops X% from last entry (OR time gate)
//           time gate resets on any add (price or time triggered)
//
// Tests on HYPE + SOL with monthly P&L breakdown
// ─────────────────────────────────────────────

function loadCandles(file: string): Candle[] {
  if (!fs.existsSync(file)) { console.error("Missing", file); process.exit(1); }
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

// ── EMA ──
const ema = (d: number[], p: number) => {
  const k = 2/(p+1); const r = [d[0]];
  for (let i=1;i<d.length;i++) r.push(d[i]*k+r[i-1]*(1-k));
  return r;
};

// ── 4h hostile gate (shared logic) ──
function buildHostileGate(candles: Candle[]) {
  const P = 4 * 3600000;
  const bars: { ts: number; close: number }[] = [];
  let cur: typeof bars[0] | null = null;
  for (const c of candles) {
    const bt = Math.floor(c.timestamp / P) * P;
    if (!cur || cur.ts !== bt) { if (cur) bars.push(cur); cur = { ts: bt, close: c.close }; }
    else cur.close = c.close;
  }
  if (cur) bars.push(cur);
  const closes = bars.map(b => b.close);
  const e200 = ema(closes, 200), e50 = ema(closes, 50);
  const gate = new Map<number, boolean>();
  for (let i = 1; i < bars.length; i++) gate.set(Math.floor(bars[i].ts / P) * P, closes[i] < e200[i] && e50[i] < e50[i-1]);
  return (ts: number) => gate.get(Math.floor(ts / P) * P - P) ?? false;
}

interface Cfg {
  label: string;
  startDate: string;
  base: number; scale: number; maxPos: number; capital: number;
  tp: number; addMin: number; staleH: number; reducedTp: number;
  flatH: number; flatPct: number; killPct: number; fee: number; fund8h: number;
  // Add trigger
  priceTriggerPct: number;   // 0 = time-only; >0 = also add when price drops this % from last entry
}

interface MonthStats {
  label: string;       // e.g. "2026-03"
  startEq: number;
  endEq: number;
  peakEq: number;
  troughEq: number;
  tps: number;
  stales: number;
  adds: number;
  priceAdds: number;   // price-triggered adds
}

interface Result {
  finalEq: number; ret: number; maxDD: number; minEq: number;
  tps: number; stales: number; kills: number; flats: number;
  totalAdds: number; priceAdds: number;
  months: MonthStats[];
}

function runSim(candles: Candle[], cfg: Cfg, isHostile: (ts: number) => boolean): Result {
  const startTs = new Date(cfg.startDate).getTime();
  let cap = cfg.capital, peak = cap, minEq = cap, maxDD = 0;
  type Pos = { ep: number; et: number; qty: number; not: number };
  const longs: Pos[] = [];
  let lastAdd = 0;
  let tps = 0, stales = 0, kills = 0, flats = 0, totalAdds = 0, priceAdds = 0;

  // Monthly tracking
  const months: MonthStats[] = [];
  let curMonth = "";
  let mStat: MonthStats | null = null;

  function getMonthKey(ts: number) { return new Date(ts).toISOString().slice(0, 7); }

  function flushMonth() { if (mStat) months.push(mStat); }

  for (const c of candles) {
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;

    // Monthly bucket
    const mk = getMonthKey(ts);
    if (mk !== curMonth) {
      flushMonth();
      const longUr = longs.reduce((a, p) => a + (close - p.ep) * p.qty, 0);
      const eqNow = cap + longUr;
      mStat = { label: mk, startEq: eqNow, endEq: eqNow, peakEq: eqNow, troughEq: eqNow, tps: 0, stales: 0, adds: 0, priceAdds: 0 };
      curMonth = mk;
    }

    // Equity
    const longUr = longs.reduce((a, p) => a + (close - p.ep) * p.qty, 0);
    const eq = cap + longUr;
    if (eq > peak) peak = eq; if (eq < minEq) minEq = eq;
    const dd = peak > 0 ? (peak - eq) / peak * 100 : 0; if (dd > maxDD) maxDD = dd;
    if (mStat) {
      if (eq > mStat.peakEq) mStat.peakEq = eq;
      if (eq < mStat.troughEq) mStat.troughEq = eq;
      mStat.endEq = eq;
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
        if (isStale) { stales++; if (mStat) mStat.stales++; } else { tps++; if (mStat) mStat.tps++; }
        continue;
      }
      if (cfg.killPct !== 0 && avgPnl <= cfg.killPct) {
        for (const p of longs) {
          const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000));
          cap += (close - p.ep) * p.qty - (p.not * cfg.fee + close * p.qty * cfg.fee) - fund;
        }
        longs.length = 0; lastAdd = 0; kills++;
        continue;
      }
      if (cfg.flatH > 0 && oldH >= cfg.flatH && avgPnl <= cfg.flatPct && isHostile(ts)) {
        for (const p of longs) {
          const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000));
          cap += (close - p.ep) * p.qty - (p.not * cfg.fee + close * p.qty * cfg.fee) - fund;
        }
        longs.length = 0; lastAdd = 0; flats++;
        continue;
      }
    }

    // Long entries — hybrid time + price trigger
    if (longs.length < cfg.maxPos && !isHostile(ts)) {
      const timeOk = (ts - lastAdd) / 60000 >= cfg.addMin;
      const lastEntryPrice = longs.length > 0 ? longs[longs.length - 1].ep : 0;
      const priceOk = cfg.priceTriggerPct > 0 && longs.length > 0 && close <= lastEntryPrice * (1 - cfg.priceTriggerPct / 100);
      const firstEntry = longs.length === 0 && timeOk;

      if (firstEntry || timeOk || priceOk) {
        const not = cfg.base * Math.pow(cfg.scale, longs.length);
        longs.push({ ep: close, et: ts, qty: not / close, not });
        lastAdd = ts; // always reset time gate on any add
        totalAdds++;
        if (mStat) mStat.adds++;
        if (priceOk && !timeOk) { priceAdds++; if (mStat) mStat.priceAdds++; }
      }
    }
  }

  flushMonth();

  // Close open positions at end
  const last = candles[candles.length - 1];
  for (const p of longs) cap += (last.close - p.ep) * p.qty - (p.not * cfg.fee + last.close * p.qty * cfg.fee);

  return { finalEq: cap, ret: (cap / cfg.capital - 1) * 100, maxDD, minEq, tps, stales, kills, flats, totalAdds, priceAdds, months };
}

// ── Formatting ──
function pct(n: number, dec = 1) { return (n >= 0 ? "+" : "") + n.toFixed(dec) + "%"; }

function printMonthly(months: MonthStats[]) {
  console.log(`    ${"Month".padEnd(8)} ${"Return".padStart(8)} ${"MaxDD".padStart(7)} ${"MinEq".padStart(9)} ${"TPs".padStart(4)} ${"Stales".padStart(7)} ${"Adds".padStart(5)} ${"PriceAdds".padStart(10)}`);
  console.log("    " + "-".repeat(62));
  for (const m of months) {
    const ret = m.startEq > 0 ? (m.endEq - m.startEq) / m.startEq * 100 : 0;
    const mdd = m.peakEq > 0 ? (m.peakEq - m.troughEq) / m.peakEq * 100 : 0;
    console.log(`    ${m.label.padEnd(8)} ${pct(ret).padStart(8)} ${(mdd.toFixed(1)+"%").padStart(7)} ${("$"+m.troughEq.toFixed(0)).padStart(9)} ${String(m.tps).padStart(4)} ${String(m.stales).padStart(7)} ${String(m.adds).padStart(5)} ${String(m.priceAdds).padStart(10)}`);
  }
}

function printSummary(label: string, r: Result) {
  const pctAdds = r.totalAdds > 0 ? (r.priceAdds / r.totalAdds * 100).toFixed(0) : "0";
  console.log(`  ${label.padEnd(40)} ${("$"+r.finalEq.toFixed(0)).padStart(9)} ${pct(r.ret).padStart(8)} ${(r.maxDD.toFixed(1)+"%").padStart(7)} ${String(r.tps).padStart(5)} ${String(r.stales).padStart(7)} ${String(r.totalAdds).padStart(6)} ${(pctAdds+"%").padStart(9)}`);
}

const sumHdr = `  ${"Config".padEnd(40)} ${"FinalEq".padStart(9)} ${"Return".padStart(8)} ${"MaxDD".padStart(7)} ${"TPs".padStart(5)} ${"Stales".padStart(7)} ${"Adds".padStart(6)} ${"PriceAdd%".padStart(9)}`;
const div = "  " + "-".repeat(98);
const SEP = "=".repeat(102);

// ── Base configs ──
const baseHype: Omit<Cfg, "label"> = {
  startDate: "2025-01-01", base: 200, scale: 1.1, maxPos: 9, capital: 1000,
  tp: 2.0, addMin: 30, staleH: 8, reducedTp: 0.3,
  flatH: 40, flatPct: -6, killPct: -10, fee: 0.00055, fund8h: 0.0001,
  priceTriggerPct: 0,
};
const baseSol: Omit<Cfg, "label"> = { ...baseHype, startDate: "2024-12-01" };

for (const [assetLabel, dataFile, baseCfg] of [
  ["HYPE (from Jan 2025 — post-launch)", "data/HYPEUSDT_5_full.json", baseHype],
] as [string, string, typeof baseHype][]) {

  const candles = loadCandles(dataFile);
  const isHostile = buildHostileGate(candles);
  const lastC = candles[candles.length - 1];

  console.log("\n" + SEP);
  console.log(`  ${assetLabel} — PRICE-TRIGGERED ADD EXPERIMENT`);
  console.log(`  Data: ${new Date(candles[0].timestamp).toISOString().slice(0,10)} → ${new Date(lastC.timestamp).toISOString().slice(0,10)} | $${candles[0].open.toFixed(2)} → $${lastC.close.toFixed(2)}`);
  console.log(`  Config: base=$200, scale=1.1, maxPos=9, tp=2%, addMin=30m`);
  console.log(`  Add trigger: time(30m) | price-drop% from last entry`);
  console.log(SEP);

  const triggers = [
    { pct: 0,   label: "time-only (baseline)" },
    { pct: 0.5, label: "time OR price-drop 0.5%" },
    { pct: 1.0, label: "time OR price-drop 1.0%" },
    { pct: 1.5, label: "time OR price-drop 1.5%" },
    { pct: 2.0, label: "time OR price-drop 2.0%" },
  ];

  console.log("\n" + sumHdr); console.log(div);
  const results: { label: string; r: Result }[] = [];
  for (const t of triggers) {
    const r = runSim(candles, { ...baseCfg, label: t.label, priceTriggerPct: t.pct }, isHostile);
    printSummary(t.label, r);
    results.push({ label: t.label, r });
  }

  // Monthly breakdown for each trigger
  for (const { label, r } of results) {
    console.log(`\n  ── Monthly breakdown: ${label} ──`);
    printMonthly(r.months);
  }
}
