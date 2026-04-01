import fs from "fs";
import path from "path";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// DCA ladder sim with OI + funding regime filters
// Tests whether OI/funding signals improve entry gating
//
// Regime signals from historical analysis:
//   1. Funding 0.01-0.03% → bearish (39% up 24h)
//   2. OI 72h drop >10% → structural unwind (35% up 24h)
//   3. OI↓24h + negative funding → bounce setup (75% up 24h)
//   4. OI↑ + Price↓ + elevated funding → trapped longs (44% up 24h)
// ─────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../data");

interface OiRow { timestamp: number; openInterest: number }
interface FundingRow { timestamp: number; fundingRate: number }

interface Cfg {
  label: string;
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number; feeRate: number;
  startDate: string; staleHours: number; reducedTpPct: number; hardFlattenHours: number;
  hardFlattenPct: number; emergencyKillPct: number; fundingRate8h: number;
}

interface OiCfg {
  label: string;
  // Which regime filters are active
  useFundingGate: boolean;       // block adds when funding elevated
  fundingGateMin: number;        // funding threshold (e.g. 0.0001 = 0.01%)
  fundingGateMax: number;        // upper bound (e.g. 0.0003 = 0.03%)
  useOi72hGate: boolean;         // block adds when OI 72h trend down
  oi72hDropPct: number;          // threshold (e.g. -10)
  useOiPriceDiv: boolean;        // block adds on OI↑ + price↓ + elevated funding
  oiPriceDivOiChg: number;       // min OI 24h change for divergence (e.g. 2%)
  oiPriceDivPriceChg: number;    // max price 4h change (e.g. -1%)
  useBounceBoost: boolean;       // MORE aggressive on OI↓ + negative funding
  bounceOiDrop: number;          // OI 24h drop threshold (e.g. -5%)
  bounceMaxPos: number;          // allow more positions in bounce regime
}

// ── Trend gate (same as sim-majors) ──
function buildTrendGate(candles: Candle[]) {
  const period = 4 * 3600000;
  const bars: { ts: number; close: number }[] = [];
  let curBar = -1, lastClose = 0, lastTs = 0;
  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period);
    if (bar !== curBar) { if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose }); curBar = bar; }
    lastClose = c.close; lastTs = c.timestamp;
  }
  if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });
  const ema = (d: number[], p: number) => { const k = 2 / (p + 1); const r = [d[0]]; for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k)); return r; };
  const closes = bars.map(b => b.close), e200 = ema(closes, 200), e50 = ema(closes, 50);
  const hostile = new Map<number, boolean>();
  for (let i = 1; i < bars.length; i++) {
    hostile.set(Math.floor(bars[i].ts / period) * period, closes[i] < e200[i] && e50[i] < e50[i - 1]);
  }
  return hostile;
}
function isHostile(gate: Map<number, boolean>, ts: number) {
  const p = 4 * 3600000;
  return gate.get(Math.floor(ts / p) * p - p) ?? false;
}

// ── OI/Funding lookup helpers ──
// Build a map of hourly OI for fast lookup
function buildOiMap(oi: OiRow[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of oi) m.set(r.timestamp, r.openInterest);
  return m;
}

function getOiAt(oiMap: Map<number, number>, ts: number): number | null {
  // Round to nearest hour
  const hour = Math.round(ts / 3600000) * 3600000;
  for (const offset of [0, 3600000, -3600000, 7200000, -7200000]) {
    const v = oiMap.get(hour + offset);
    if (v !== undefined) return v;
  }
  return null;
}

function buildFundingMap(funding: FundingRow[]): { ts: number; rate: number }[] {
  return funding.map(f => ({ ts: f.timestamp, rate: f.fundingRate })).sort((a, b) => a.ts - b.ts);
}

function getFundingAt(funding: { ts: number; rate: number }[], ts: number): number | null {
  // Find most recent funding before ts
  let best: number | null = null;
  for (const f of funding) {
    if (f.ts <= ts) best = f.rate;
    else break;
  }
  return best;
}

// Build 4h price change map
function build4hPriceChg(candles: Candle[]): Map<number, number> {
  const period = 4 * 3600000;
  const bars: { ts: number; close: number }[] = [];
  let curBar = -1, lastClose = 0, barTs = 0;
  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period);
    if (bar !== curBar) {
      if (curBar !== -1) bars.push({ ts: barTs, close: lastClose });
      curBar = bar; barTs = bar * period;
    }
    lastClose = c.close;
  }
  if (curBar !== -1) bars.push({ ts: barTs, close: lastClose });

  const m = new Map<number, number>();
  for (let i = 1; i < bars.length; i++) {
    m.set(bars[i].ts, ((bars[i].close - bars[i - 1].close) / bars[i - 1].close) * 100);
  }
  return m;
}

interface Stats {
  finalEq: number; maxDD: number; minEq: number; returnPct: number;
  tps: number; stales: number; kills: number; flats: number; ladders: number;
  avgHoldHrs: number; maxNotional: number;
  priceStart: number; priceEnd: number; priceReturn: number;
  oiBlocks: number; fundBlocks: number; divBlocks: number; boostAdds: number;
}

function run(candles: Candle[], cfg: Cfg, oiCfg: OiCfg, oiMap: Map<number, number>, fundingArr: { ts: number; rate: number }[], priceChgMap: Map<number, number>): Stats {
  const gate = buildTrendGate(candles);
  let capital = cfg.initialCapital, peakEq = capital;
  const pos: { ep: number; et: number; qty: number; notional: number }[] = [];
  let lastAdd = 0;
  const startTs = new Date(cfg.startDate).getTime();
  let minEq = capital, maxDD = 0, maxNotional = 0;
  let tps = 0, stales = 0, kills = 0, flats = 0, ladders = 0;
  let totalHoldMs = 0, totalCloses = 0;
  let priceStart = 0, priceEnd = 0;
  let oiBlocks = 0, fundBlocks = 0, divBlocks = 0, boostAdds = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp < startTs) continue;
    if (priceStart === 0) priceStart = c.close;
    priceEnd = c.close;
    const { close, high, timestamp: ts } = c;

    const ur = pos.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const eq = capital + ur;
    if (eq > peakEq) peakEq = eq;
    if (eq < minEq) minEq = eq;
    const dd = peakEq > 0 ? ((peakEq - eq) / peakEq) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
    const not = pos.reduce((s, p) => s + p.notional, 0);
    if (not > maxNotional) maxNotional = not;

    // ── Exit logic (same as baseline) ──
    if (pos.length > 0) {
      const tQty = pos.reduce((s, p) => s + p.qty, 0);
      const avgE = pos.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPnl = ((close - avgE) / avgE) * 100;
      const oldH = (ts - pos[0].et) / 3600000;
      const isStale = cfg.staleHours > 0 && oldH >= cfg.staleHours && avgPnl < 0;
      const tp = isStale ? cfg.reducedTpPct : cfg.tpPct;
      const tpPrice = avgE * (1 + tp / 100);

      let closed = false;
      if (high >= tpPrice) {
        for (const p of pos) {
          const raw = (tpPrice - p.ep) * p.qty;
          const fees = p.notional * cfg.feeRate + tpPrice * p.qty * cfg.feeRate;
          const fund = p.notional * cfg.fundingRate8h * ((ts - p.et) / (8 * 3600000));
          capital += raw - fees - fund;
        }
        totalHoldMs += ts - pos[0].et; totalCloses++;
        if (isStale) stales++; else tps++;
        pos.length = 0; closed = true;
      } else if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) {
        for (const p of pos) {
          const raw = (close - p.ep) * p.qty;
          const fees = p.notional * cfg.feeRate + close * p.qty * cfg.feeRate;
          const fund = p.notional * cfg.fundingRate8h * ((ts - p.et) / (8 * 3600000));
          capital += raw - fees - fund;
        }
        totalHoldMs += ts - pos[0].et; totalCloses++;
        kills++; pos.length = 0; closed = true;
      } else if (cfg.hardFlattenHours > 0 && oldH >= cfg.hardFlattenHours && avgPnl <= cfg.hardFlattenPct && isHostile(gate, ts)) {
        for (const p of pos) {
          const raw = (close - p.ep) * p.qty;
          const fees = p.notional * cfg.feeRate + close * p.qty * cfg.feeRate;
          const fund = p.notional * cfg.fundingRate8h * ((ts - p.et) / (8 * 3600000));
          capital += raw - fees - fund;
        }
        totalHoldMs += ts - pos[0].et; totalCloses++;
        flats++; pos.length = 0; closed = true;
      }
      if (closed) { ladders++; continue; }
    }

    // ── Entry logic with OI/funding regime filters ──
    const gap = (ts - lastAdd) / 60000;
    let maxPos = cfg.maxPositions;

    // Get OI/funding state
    const oiNow = getOiAt(oiMap, ts);
    const oi24hAgo = getOiAt(oiMap, ts - 24 * 3600000);
    const oi72hAgo = getOiAt(oiMap, ts - 72 * 3600000);
    const fundNow = getFundingAt(fundingArr, ts);

    const oiChg24h = oiNow && oi24hAgo ? ((oiNow - oi24hAgo) / oi24hAgo) * 100 : 0;
    const oiChg72h = oiNow && oi72hAgo ? ((oiNow - oi72hAgo) / oi72hAgo) * 100 : 0;

    // Get 4h price change (from previous closed 4h bar)
    const period4h = 4 * 3600000;
    const barTs = Math.floor(ts / period4h) * period4h - period4h;
    const priceChg4h = priceChgMap.get(barTs) ?? 0;

    // Check regime blocks
    let blocked = false;

    // Filter 1: Funding gate — block when funding elevated (bearish regime)
    if (oiCfg.useFundingGate && fundNow !== null) {
      if (fundNow >= oiCfg.fundingGateMin && fundNow <= oiCfg.fundingGateMax) {
        blocked = true;
        fundBlocks++;
      }
    }

    // Filter 2: OI 72h structural unwind
    if (oiCfg.useOi72hGate && oiChg72h < oiCfg.oi72hDropPct) {
      blocked = true;
      oiBlocks++;
    }

    // Filter 3: OI↑ + Price↓ + elevated funding (trapped longs)
    if (oiCfg.useOiPriceDiv && fundNow !== null) {
      if (oiChg24h > oiCfg.oiPriceDivOiChg && priceChg4h < oiCfg.oiPriceDivPriceChg && fundNow > oiCfg.fundingGateMin) {
        blocked = true;
        divBlocks++;
      }
    }

    // Boost: OI↓ + negative funding = bounce setup → allow more positions
    if (oiCfg.useBounceBoost && fundNow !== null) {
      if (oiChg24h < oiCfg.bounceOiDrop && fundNow < 0) {
        maxPos = oiCfg.bounceMaxPos;
        boostAdds++;
      }
    }

    if (pos.length < maxPos && gap >= cfg.addIntervalMin && !blocked) {
      if (!isHostile(gate, ts)) {
        const lvl = pos.length;
        const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, lvl);
        const margin = notional / cfg.leverage;
        const used = pos.reduce((s, p) => s + p.notional / cfg.leverage, 0);
        if (capital - used >= margin && capital > 0) {
          pos.push({ ep: close, et: ts, qty: notional / close, notional });
          lastAdd = ts;
        }
      }
    }
  }

  // Close remaining
  if (pos.length > 0) {
    const last = candles[candles.length - 1];
    for (const p of pos) {
      const raw = (last.close - p.ep) * p.qty;
      const fees = p.notional * cfg.feeRate + last.close * p.qty * cfg.feeRate;
      capital += raw - fees;
    }
    ladders++;
  }

  return {
    finalEq: capital, maxDD, minEq, returnPct: (capital / cfg.initialCapital - 1) * 100,
    tps, stales, kills, flats, ladders,
    avgHoldHrs: totalCloses > 0 ? (totalHoldMs / totalCloses) / 3600000 : 0,
    maxNotional, priceStart, priceEnd,
    priceReturn: ((priceEnd - priceStart) / priceStart) * 100,
    oiBlocks, fundBlocks, divBlocks, boostAdds,
  };
}

// ── Load data ──
function loadJson<T>(file: string): T[] {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const baseCfg: Omit<Cfg, "label"> = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 15000, feeRate: 0.00055,
  startDate: "2025-04-01",
  staleHours: 8, reducedTpPct: 0.3,
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
};

const noOi: OiCfg = {
  label: "BASELINE (no OI/funding)",
  useFundingGate: false, fundingGateMin: 0, fundingGateMax: 0,
  useOi72hGate: false, oi72hDropPct: 0,
  useOiPriceDiv: false, oiPriceDivOiChg: 0, oiPriceDivPriceChg: 0,
  useBounceBoost: false, bounceOiDrop: 0, bounceMaxPos: 11,
};

// ── Run on HYPE ──
const symbols = ["HYPEUSDT"];

for (const sym of symbols) {
  const candleFile = fs.existsSync(path.join(DATA_DIR, `${sym}_5_full.json`))
    ? `${sym}_5_full.json` : `${sym}_5.json`;
  const candles: Candle[] = loadJson(candleFile);
  const oi: OiRow[] = loadJson(`${sym}_oi.json`);
  const funding: FundingRow[] = loadJson(`${sym}_funding.json`);

  if (candles.length < 1000 || oi.length < 100) {
    console.log(`${sym}: insufficient data`);
    continue;
  }

  const oiMap = buildOiMap(oi);
  const fundingArr = buildFundingMap(funding);
  const priceChgMap = build4hPriceChg(candles);

  console.log("=".repeat(130));
  console.log(`  ${sym} — DCA LADDER WITH OI + FUNDING REGIME FILTERS`);
  console.log(`  ${candles.length} candles | ${oi.length} OI rows | ${funding.length} funding rows`);
  console.log("=".repeat(130));

  // Define test configs
  const oiConfigs: OiCfg[] = [
    noOi,
    {
      label: "Funding gate 0.01-0.03%",
      useFundingGate: true, fundingGateMin: 0.0001, fundingGateMax: 0.0003,
      useOi72hGate: false, oi72hDropPct: 0,
      useOiPriceDiv: false, oiPriceDivOiChg: 0, oiPriceDivPriceChg: 0,
      useBounceBoost: false, bounceOiDrop: 0, bounceMaxPos: 11,
    },
    {
      label: "Funding gate >0.01%",
      useFundingGate: true, fundingGateMin: 0.0001, fundingGateMax: 1,
      useOi72hGate: false, oi72hDropPct: 0,
      useOiPriceDiv: false, oiPriceDivOiChg: 0, oiPriceDivPriceChg: 0,
      useBounceBoost: false, bounceOiDrop: 0, bounceMaxPos: 11,
    },
    {
      label: "OI 72h drop >10% gate",
      useFundingGate: false, fundingGateMin: 0, fundingGateMax: 0,
      useOi72hGate: true, oi72hDropPct: -10,
      useOiPriceDiv: false, oiPriceDivOiChg: 0, oiPriceDivPriceChg: 0,
      useBounceBoost: false, bounceOiDrop: 0, bounceMaxPos: 11,
    },
    {
      label: "OI 72h drop >5% gate",
      useFundingGate: false, fundingGateMin: 0, fundingGateMax: 0,
      useOi72hGate: true, oi72hDropPct: -5,
      useOiPriceDiv: false, oiPriceDivOiChg: 0, oiPriceDivPriceChg: 0,
      useBounceBoost: false, bounceOiDrop: 0, bounceMaxPos: 11,
    },
    {
      label: "OI↑+Price↓+Fund divergence",
      useFundingGate: false, fundingGateMin: 0.0001, fundingGateMax: 1,
      useOi72hGate: false, oi72hDropPct: 0,
      useOiPriceDiv: true, oiPriceDivOiChg: 2, oiPriceDivPriceChg: -1,
      useBounceBoost: false, bounceOiDrop: 0, bounceMaxPos: 11,
    },
    {
      label: "Bounce boost (OI↓5%+neg fund→13 max)",
      useFundingGate: false, fundingGateMin: 0, fundingGateMax: 0,
      useOi72hGate: false, oi72hDropPct: 0,
      useOiPriceDiv: false, oiPriceDivOiChg: 0, oiPriceDivPriceChg: 0,
      useBounceBoost: true, bounceOiDrop: -5, bounceMaxPos: 13,
    },
    {
      label: "Fund gate + OI 72h gate",
      useFundingGate: true, fundingGateMin: 0.0001, fundingGateMax: 0.0003,
      useOi72hGate: true, oi72hDropPct: -10,
      useOiPriceDiv: false, oiPriceDivOiChg: 0, oiPriceDivPriceChg: 0,
      useBounceBoost: false, bounceOiDrop: 0, bounceMaxPos: 11,
    },
    {
      label: "Fund gate + OI 72h + divergence",
      useFundingGate: true, fundingGateMin: 0.0001, fundingGateMax: 0.0003,
      useOi72hGate: true, oi72hDropPct: -10,
      useOiPriceDiv: true, oiPriceDivOiChg: 2, oiPriceDivPriceChg: -1,
      useBounceBoost: false, bounceOiDrop: 0, bounceMaxPos: 11,
    },
    {
      label: "ALL: fund+OI72h+div+bounce",
      useFundingGate: true, fundingGateMin: 0.0001, fundingGateMax: 0.0003,
      useOi72hGate: true, oi72hDropPct: -10,
      useOiPriceDiv: true, oiPriceDivOiChg: 2, oiPriceDivPriceChg: -1,
      useBounceBoost: true, bounceOiDrop: -5, bounceMaxPos: 13,
    },
  ];

  console.log(`\n  ${"Config".padEnd(42)} ${"Return".padStart(8)} ${"MaxDD".padStart(7)} ${"MinEq".padStart(8)} ${"TPs".padStart(5)} ${"Stale".padStart(5)} ${"Kill".padStart(5)} ${"Flat".padStart(5)} ${"Ladders".padStart(7)} ${"AvgH".padStart(6)} ${"OIblk".padStart(6)} ${"Fblk".padStart(6)} ${"Dblk".padStart(6)} ${"Boost".padStart(6)}`);
  console.log(`  ${"-".repeat(128)}`);

  for (const oiCfg of oiConfigs) {
    const cfg: Cfg = { ...baseCfg, label: oiCfg.label };
    const s = run(candles, cfg, oiCfg, oiMap, fundingArr, priceChgMap);
    const ret = (s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(1) + "%";
    console.log(`  ${oiCfg.label.padEnd(42)} ${ret.padStart(8)} ${(s.maxDD.toFixed(1) + "%").padStart(7)} $${s.minEq.toFixed(0).padStart(7)} ${String(s.tps).padStart(5)} ${String(s.stales).padStart(5)} ${String(s.kills).padStart(5)} ${String(s.flats).padStart(5)} ${String(s.ladders).padStart(7)} ${s.avgHoldHrs.toFixed(1).padStart(5)}h ${String(s.oiBlocks).padStart(6)} ${String(s.fundBlocks).padStart(6)} ${String(s.divBlocks).padStart(6)} ${String(s.boostAdds).padStart(6)}`);
  }

  // ── Start date sweep: test from different points ──
  console.log(`\n\n  ── START DATE SWEEP (best config vs baseline) ──\n`);

  // Find best non-baseline config
  let bestCfgIdx = 0, bestReturn = -Infinity;
  for (let i = 1; i < oiConfigs.length; i++) {
    const cfg2: Cfg = { ...baseCfg, label: "" };
    const s = run(candles, cfg2, oiConfigs[i], oiMap, fundingArr, priceChgMap);
    if (s.returnPct > bestReturn) { bestReturn = s.returnPct; bestCfgIdx = i; }
  }
  const bestOiCfg = oiConfigs[bestCfgIdx];
  console.log(`  Best config: ${bestOiCfg.label}\n`);

  console.log(`  ${"Start".padEnd(12)} ${"Base Return".padStart(12)} ${"Base DD".padStart(8)} ${"OI Return".padStart(12)} ${"OI DD".padStart(8)} ${"Δ Return".padStart(10)} ${"Δ DD".padStart(8)}`);
  console.log(`  ${"-".repeat(75)}`);

  for (const start of ["2025-01-01", "2025-04-01", "2025-07-01", "2025-10-01", "2026-01-01"]) {
    const cfgBase: Cfg = { ...baseCfg, label: "base", startDate: start };
    const cfgOi: Cfg = { ...baseCfg, label: "oi", startDate: start };
    const sBase = run(candles, cfgBase, noOi, oiMap, fundingArr, priceChgMap);
    const sOi = run(candles, cfgOi, bestOiCfg, oiMap, fundingArr, priceChgMap);

    if (sBase.priceStart === 0) continue;

    const bRet = (sBase.returnPct >= 0 ? "+" : "") + sBase.returnPct.toFixed(1) + "%";
    const oRet = (sOi.returnPct >= 0 ? "+" : "") + sOi.returnPct.toFixed(1) + "%";
    const dRet = sOi.returnPct - sBase.returnPct;
    const dDD = sOi.maxDD - sBase.maxDD;
    console.log(`  ${start.padEnd(12)} ${bRet.padStart(12)} ${(sBase.maxDD.toFixed(1) + "%").padStart(8)} ${oRet.padStart(12)} ${(sOi.maxDD.toFixed(1) + "%").padStart(8)} ${((dRet >= 0 ? "+" : "") + dRet.toFixed(1) + "%").padStart(10)} ${((dDD >= 0 ? "+" : "") + dDD.toFixed(1) + "%").padStart(8)}`);
  }
}
