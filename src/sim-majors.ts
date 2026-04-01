import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Run the 11-long DCA ladder (8h/0.3% stale) on BTC, ETH, SOL, XRP, SUI
// Same strategy, same params — just different assets
// ─────────────────────────────────────────────

interface Cfg {
  label: string;
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number; feeRate: number;
  startDate: string; staleHours: number; reducedTpPct: number; hardFlattenHours: number;
  hardFlattenPct: number; emergencyKillPct: number; fundingRate8h: number;
}

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

interface Stats {
  finalEq: number; maxDD: number; minEq: number; returnPct: number;
  tps: number; stales: number; kills: number; flats: number; ladders: number;
  avgHoldHrs: number; maxNotional: number;
  priceStart: number; priceEnd: number; priceReturn: number;
}

function run(candles: Candle[], cfg: Cfg): Stats {
  const gate = buildTrendGate(candles);
  let capital = cfg.initialCapital, peakEq = capital;
  const pos: { ep: number; et: number; qty: number; notional: number }[] = [];
  let lastAdd = 0;
  const startTs = new Date(cfg.startDate).getTime();
  let minEq = capital, maxDD = 0, maxNotional = 0;
  let tps = 0, stales = 0, kills = 0, flats = 0, ladders = 0;
  let totalHoldMs = 0, totalCloses = 0;
  let priceStart = 0, priceEnd = 0;

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

    const gap = (ts - lastAdd) / 60000;
    if (pos.length < cfg.maxPositions && gap >= cfg.addIntervalMin) {
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
  };
}

const symbols = ["HYPEUSDT", "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "SUIUSDT", "SIRENUSDT", "LIGHTUSDT", "DUSKUSDT", "RIVERUSDT"];

const baseCfg: Omit<Cfg, "label"> = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 15000, feeRate: 0.00055,
  startDate: "2025-04-01", // common start for all (BTC/ETH/SOL/XRP have data from Mar 22)
  staleHours: 8, reducedTpPct: 0.3,
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
};

console.log("=".repeat(120));
console.log("  DCA LADDER ON MAJORS — same config across all pairs");
console.log("  11 max, $800 base, 1.2x scale, 50x, TP 1.4%, stale 8h→0.3%, kill -10%");
console.log("  $15K initial, April 2025 start (common window)");
console.log("=".repeat(120));

console.log(`\n  Symbol       Price Move    Final Eq   Return   MaxDD%  MinEq    TPs  Stales  Kills  Flats  Ladders  AvgHold  MaxNot`);
console.log("  " + "-".repeat(115));

for (const sym of symbols) {
  const file = `data/${sym}_5.json`;
  const fullFile = `data/${sym}_5_full.json`;
  let data: string;
  try {
    data = fs.existsSync(fullFile) ? fs.readFileSync(fullFile, "utf-8") : fs.readFileSync(file, "utf-8");
  } catch {
    console.log(`  ${sym.padEnd(12)}  NO DATA`);
    continue;
  }
  const candles: Candle[] = JSON.parse(data);
  if (candles.length < 1000) { console.log(`  ${sym.padEnd(12)}  INSUFFICIENT DATA (${candles.length} candles)`); continue; }

  const cfg: Cfg = { ...baseCfg, label: sym };
  const s = run(candles, cfg);

  if (s.priceStart === 0) { console.log(`  ${sym.padEnd(12)}  NO DATA IN RANGE`); continue; }

  const priceMove = `$${s.priceStart.toFixed(s.priceStart > 100 ? 0 : 2)}→$${s.priceEnd.toFixed(s.priceEnd > 100 ? 0 : 2)} (${s.priceReturn >= 0 ? "+" : ""}${s.priceReturn.toFixed(0)}%)`;
  console.log(`  ${sym.padEnd(12)} ${priceMove.padEnd(28)} $${s.finalEq.toFixed(0).padStart(7)} ${(s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(1) + "%"}${" ".repeat(Math.max(1, 7 - s.returnPct.toFixed(1).length))} ${s.maxDD.toFixed(1).padStart(5)}%  $${s.minEq.toFixed(0).padStart(7)}  ${String(s.tps).padStart(5)} ${String(s.stales).padStart(6)} ${String(s.kills).padStart(6)} ${String(s.flats).padStart(6)} ${String(s.ladders).padStart(8)}  ${s.avgHoldHrs.toFixed(1).padStart(6)}h  $${s.maxNotional.toFixed(0).padStart(6)}`);
}

// Now sweep leverage for BTC/ETH since they might want different settings
console.log("\n\n" + "=".repeat(120));
console.log("  LEVERAGE SWEEP — BTC & ETH (these are calmer than HYPE)");
console.log("=".repeat(120));
console.log(`\n  Symbol    Lev   Final Eq   Return   MaxDD%  MinEq    TPs  Kills  Flats  AvgHold`);
console.log("  " + "-".repeat(90));

for (const sym of ["BTCUSDT", "ETHUSDT"]) {
  const file = `data/${sym}_5.json`;
  const candles: Candle[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  for (const lev of [20, 30, 50, 75, 100]) {
    const cfg: Cfg = { ...baseCfg, label: `${sym} ${lev}x`, leverage: lev };
    const s = run(candles, cfg);
    console.log(`  ${sym.padEnd(10)} ${String(lev).padStart(3)}x  $${s.finalEq.toFixed(0).padStart(7)} ${(s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(1) + "%"}${" ".repeat(Math.max(1, 7 - s.returnPct.toFixed(1).length))} ${s.maxDD.toFixed(1).padStart(5)}%  $${s.minEq.toFixed(0).padStart(7)}  ${String(s.tps).padStart(5)} ${String(s.kills).padStart(6)} ${String(s.flats).padStart(6)}  ${s.avgHoldHrs.toFixed(1).padStart(6)}h`);
  }
}

// TP sweep for BTC/ETH
console.log("\n\n" + "=".repeat(120));
console.log("  TP% SWEEP — BTC & ETH");
console.log("=".repeat(120));
console.log(`\n  Symbol    TP%    Final Eq   Return   MaxDD%  MinEq    TPs  Stales  Kills`);
console.log("  " + "-".repeat(85));

for (const sym of ["BTCUSDT", "ETHUSDT", "SOLUSDT", "SIRENUSDT"]) {
  const file = `data/${sym}_5.json`;
  const candles: Candle[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  for (const tp of [0.3, 0.5, 0.7, 1.0, 1.4, 2.0]) {
    const cfg: Cfg = { ...baseCfg, label: `${sym} TP${tp}`, tpPct: tp };
    const s = run(candles, cfg);
    console.log(`  ${sym.padEnd(10)} ${tp.toFixed(1).padStart(4)}%  $${s.finalEq.toFixed(0).padStart(7)} ${(s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(1) + "%"}${" ".repeat(Math.max(1, 7 - s.returnPct.toFixed(1).length))} ${s.maxDD.toFixed(1).padStart(5)}%  $${s.minEq.toFixed(0).padStart(7)}  ${String(s.tps).padStart(5)} ${String(s.stales).padStart(6)} ${String(s.kills).padStart(6)}`);
  }
}
