import path from "path";
import fs from "fs";
import { EMA, RSI } from "technicalindicators";

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

interface SimConfig {
  tpPct: number;
  leverage: number;
  maxPositions: number;
  addIntervalMin: number;
  basePositionUsdt: number;
  addScaleFactor: number;
  initialCapital: number;
  feeRate: number;
  fundingRate8h: number;
  staleHours: number;
  reducedTpPct: number;
  hardFlattenHours: number;
  hardFlattenPct: number;
  emergencyKillPct: number;
  useTrendGate: boolean;
  rsiPeriod: number;        // RSI lookback (14)
  rsiMaxEntry: number;      // 0 = disabled. Only enter if RSI <= this value
}

interface Position {
  entryPrice: number;
  entryTime: number;
  qty: number;
  notional: number;
}

// ─────────────────────────────────────────────
// Trend gate
// ─────────────────────────────────────────────
function buildTrendGate(candles: Candle[]): Map<number, boolean> {
  const period = 4 * 3600000;
  const barMap = new Map<number, { closes: number[] }>();

  for (const c of candles) {
    const barStart = Math.floor(c.timestamp / period) * period;
    if (!barMap.has(barStart)) barMap.set(barStart, { closes: [] });
    barMap.get(barStart)!.closes.push(c.close);
  }

  const bars = [...barMap.entries()].sort((a, b) => a[0] - b[0]);
  const closes4h = bars.map(([, v]) => v.closes[v.closes.length - 1]);

  const ema200 = EMA.calculate({ period: 200, values: closes4h });
  const ema50 = EMA.calculate({ period: 50, values: closes4h });

  const gate = new Map<number, boolean>();
  for (let i = 0; i < bars.length; i++) {
    const e200Idx = i - 199;
    const e50Idx = i - 49;
    if (e200Idx < 0 || e50Idx < 1) { gate.set(bars[i][0], false); continue; }
    const belowEma200 = closes4h[i] < ema200[e200Idx];
    const ema50Neg = ema50[e50Idx] < ema50[e50Idx - 1];
    gate.set(bars[i][0], belowEma200 && ema50Neg);
  }
  return gate;
}

function isTrendHostile(trendGate: Map<number, boolean>, timestamp: number): boolean {
  const period = 4 * 3600000;
  const currentBarStart = Math.floor(timestamp / period) * period;
  const prevBarStart = currentBarStart - period;
  return trendGate.get(prevBarStart) ?? false;
}

// ─────────────────────────────────────────────
// Simulator
// ─────────────────────────────────────────────
function runSim(candles: Candle[], config: SimConfig) {
  const {
    tpPct, leverage, maxPositions, addIntervalMin, basePositionUsdt, addScaleFactor,
    initialCapital, feeRate, fundingRate8h, staleHours, reducedTpPct, hardFlattenHours,
    hardFlattenPct, emergencyKillPct, useTrendGate, rsiPeriod, rsiMaxEntry,
  } = config;

  const trendGate = useTrendGate ? buildTrendGate(candles) : new Map<number, boolean>();

  // Precompute RSI on 5m closes
  const rsiValues: number[] = [];
  if (rsiMaxEntry > 0) {
    const closes5m = candles.map(c => c.close);
    const rsiCalc = RSI.calculate({ period: rsiPeriod, values: closes5m });
    // Pad front with 50 (neutral) so index aligns with candles
    const pad = candles.length - rsiCalc.length;
    for (let i = 0; i < pad; i++) rsiValues.push(50);
    rsiValues.push(...rsiCalc);
  }

  let capital = initialCapital;
  const positions: Position[] = [];
  let lastAddTime = 0;
  let peakCapital = capital;
  let maxDrawdown = 0;
  let maxConcurrent = 0;
  let totalFees = 0;
  let totalFunding = 0;
  let totalTrades = 0;
  let wins = 0;
  let minEquity = capital;

  let batchTpCloses = 0;
  let staleTpCloses = 0;
  let hardFlattenCloses = 0;
  let emergencyKillCloses = 0;
  let trendBlockedAdds = 0;
  let rsiBlockedAdds = 0;

  function closeLadder(exitPrice: number, ts: number, exitType: string) {
    for (const p of positions) {
      const pnlRaw = (exitPrice - p.entryPrice) * p.qty;
      const fees = p.notional * feeRate + exitPrice * p.qty * feeRate;
      const holdMs = ts - p.entryTime;
      const funding = p.notional * fundingRate8h * (holdMs / (8 * 3600000));
      const pnl = pnlRaw - fees - funding;
      capital += pnl;
      totalFees += fees;
      totalFunding += funding;
      totalTrades++;
      if (pnl > 0) wins++;
    }
    positions.length = 0;
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const close = c.close;
    const high = c.high;
    const ts = c.timestamp;

    if (positions.length > 0) {
      const totalQty = positions.reduce((s, p) => s + p.qty, 0);
      const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
      const avgPnlPct = ((close - avgEntry) / avgEntry) * 100;
      const oldestAge = (ts - positions[0].entryTime) / 3600000;

      // Batch TP
      const isStale = staleHours > 0 && oldestAge >= staleHours && avgPnlPct < 0;
      const activeTpPct = isStale ? reducedTpPct : tpPct;
      const tpPrice = avgEntry * (1 + activeTpPct / 100);

      if (high >= tpPrice) {
        if (isStale) staleTpCloses++; else batchTpCloses++;
        closeLadder(tpPrice, ts, isStale ? "stale_tp" : "batch_tp");
        continue;
      }

      // Emergency kill
      if (emergencyKillPct !== 0 && avgPnlPct <= emergencyKillPct) {
        emergencyKillCloses++;
        closeLadder(close, ts, "emergency_kill");
        continue;
      }

      // Hard flatten
      if (hardFlattenHours > 0 && oldestAge >= hardFlattenHours && avgPnlPct <= hardFlattenPct) {
        const hostile = useTrendGate ? isTrendHostile(trendGate, ts) : true;
        if (hostile) {
          hardFlattenCloses++;
          closeLadder(close, ts, "hard_flatten");
          continue;
        }
      }
    }

    // Equity tracking
    const ur = positions.reduce((s, p) => s + (close - p.entryPrice) * p.qty, 0);
    const equity = capital + ur;
    if (equity < minEquity) minEquity = equity;
    if (equity > peakCapital) peakCapital = equity;
    const dd = peakCapital > 0 ? ((peakCapital - equity) / peakCapital) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;

    // Open new position
    const timeSinceAdd = (ts - lastAddTime) / 60000;
    if (positions.length < maxPositions && timeSinceAdd >= addIntervalMin) {
      if (useTrendGate && isTrendHostile(trendGate, ts)) {
        trendBlockedAdds++;
      } else if (rsiMaxEntry > 0 && rsiValues[i] > rsiMaxEntry) {
        rsiBlockedAdds++;
      } else {
        const level = positions.length;
        const notional = basePositionUsdt * Math.pow(addScaleFactor, level);
        const margin = notional / leverage;
        const usedMargin = positions.reduce((s, p) => s + p.notional / leverage, 0);
        if (capital - usedMargin >= margin && capital > 0) {
          positions.push({ entryPrice: close, entryTime: ts, qty: notional / close, notional });
          lastAddTime = ts;
          if (positions.length > maxConcurrent) maxConcurrent = positions.length;
        }
      }
    }
  }

  // Force close remaining
  if (positions.length > 0) {
    const last = candles[candles.length - 1];
    closeLadder(last.close, last.timestamp, "sim_end");
  }

  const returnPct = ((capital / initialCapital) - 1) * 100;
  const wr = totalTrades > 0 ? (wins / totalTrades * 100) : 0;
  const survived = minEquity > 0;

  return {
    returnPct, maxDrawdown, minEquity, totalTrades, wr, totalFees, totalFunding,
    survived, maxConcurrent,
    exits: { batchTpCloses, staleTpCloses, hardFlattenCloses, emergencyKillCloses, trendBlockedAdds, rsiBlockedAdds },
  };
}

// ─────────────────────────────────────────────
// Main — SIREN parameter sweep
// ─────────────────────────────────────────────
function main() {
  const dataPath = path.resolve(process.cwd(), "data/SIRENUSDT_5.json");
  if (!fs.existsSync(dataPath)) {
    // Try full
    const fullPath = path.resolve(process.cwd(), "data/SIRENUSDT_5_full.json");
    if (!fs.existsSync(fullPath)) {
      console.error("No SIREN data found");
      process.exit(1);
    }
  }

  const candles: Candle[] = JSON.parse(fs.readFileSync(
    fs.existsSync(path.resolve(process.cwd(), "data/SIRENUSDT_5_full.json"))
      ? path.resolve(process.cwd(), "data/SIRENUSDT_5_full.json")
      : path.resolve(process.cwd(), "data/SIRENUSDT_5.json"),
    "utf-8",
  ));

  const from = new Date(candles[0].timestamp).toISOString().slice(0, 10);
  const to = new Date(candles[candles.length - 1].timestamp).toISOString().slice(0, 10);
  console.log(`SIREN PARAMETER SWEEP — ${candles.length} candles, ${from} → ${to}\n`);

  const BASE: SimConfig = {
    tpPct: 1.4,
    leverage: 50,
    maxPositions: 11,
    addIntervalMin: 30,
    basePositionUsdt: 800,
    addScaleFactor: 1.2,
    initialCapital: 5000,
    feeRate: 0.00055,
    fundingRate8h: 0.0001,
    staleHours: 20,
    reducedTpPct: 0.9,
    hardFlattenHours: 40,
    hardFlattenPct: -6,
    emergencyKillPct: -10,
    useTrendGate: true,
    rsiPeriod: 14,
    rsiMaxEntry: 0,           // disabled by default
  };

  const sweeps: [string, Partial<SimConfig>][] = [
    // ── Baselines (from previous sweep winners) ──
    ["Max5 baseline (50x, 1.4%TP)", { maxPositions: 5 }],
    ["TunedC: 25x, 3.0%TP, 60m, max5", { leverage: 25, tpPct: 3.0, addIntervalMin: 60, maxPositions: 5 }],

    // ── RSI filter on Max5 baseline ──
    ["Max5 + RSI≤55", { maxPositions: 5, rsiMaxEntry: 55 }],
    ["Max5 + RSI≤50", { maxPositions: 5, rsiMaxEntry: 50 }],
    ["Max5 + RSI≤45", { maxPositions: 5, rsiMaxEntry: 45 }],
    ["Max5 + RSI≤40", { maxPositions: 5, rsiMaxEntry: 40 }],
    ["Max5 + RSI≤35", { maxPositions: 5, rsiMaxEntry: 35 }],
    ["Max5 + RSI≤30", { maxPositions: 5, rsiMaxEntry: 30 }],

    // ── RSI filter on Max5 with higher TP ──
    ["Max5 + 2.0%TP + RSI≤45", { maxPositions: 5, tpPct: 2.0, rsiMaxEntry: 45 }],
    ["Max5 + 2.5%TP + RSI≤45", { maxPositions: 5, tpPct: 2.5, rsiMaxEntry: 45 }],
    ["Max5 + 3.0%TP + RSI≤45", { maxPositions: 5, tpPct: 3.0, rsiMaxEntry: 45 }],
    ["Max5 + 2.0%TP + RSI≤40", { maxPositions: 5, tpPct: 2.0, rsiMaxEntry: 40 }],
    ["Max5 + 2.5%TP + RSI≤40", { maxPositions: 5, tpPct: 2.5, rsiMaxEntry: 40 }],
    ["Max5 + 3.0%TP + RSI≤40", { maxPositions: 5, tpPct: 3.0, rsiMaxEntry: 40 }],

    // ── RSI + wider add intervals ──
    ["Max5 + 45m + RSI≤45", { maxPositions: 5, addIntervalMin: 45, rsiMaxEntry: 45 }],
    ["Max5 + 60m + RSI≤45", { maxPositions: 5, addIntervalMin: 60, rsiMaxEntry: 45 }],
    ["Max5 + 45m + RSI≤40", { maxPositions: 5, addIntervalMin: 45, rsiMaxEntry: 40 }],
    ["Max5 + 60m + RSI≤40", { maxPositions: 5, addIntervalMin: 60, rsiMaxEntry: 40 }],

    // ── RSI + max positions variations ──
    ["Max4 + RSI≤45", { maxPositions: 4, rsiMaxEntry: 45 }],
    ["Max6 + RSI≤45", { maxPositions: 6, rsiMaxEntry: 45 }],
    ["Max7 + RSI≤45", { maxPositions: 7, rsiMaxEntry: 45 }],
    ["Max4 + RSI≤40", { maxPositions: 4, rsiMaxEntry: 40 }],
    ["Max6 + RSI≤40", { maxPositions: 6, rsiMaxEntry: 40 }],
    ["Max7 + RSI≤40", { maxPositions: 7, rsiMaxEntry: 40 }],

    // ── Combined best candidates ──
    ["Max5 + 2.0%TP + 45m + RSI≤45", { maxPositions: 5, tpPct: 2.0, addIntervalMin: 45, rsiMaxEntry: 45 }],
    ["Max5 + 2.5%TP + 45m + RSI≤45", { maxPositions: 5, tpPct: 2.5, addIntervalMin: 45, rsiMaxEntry: 45 }],
    ["Max5 + 2.0%TP + 45m + RSI≤40", { maxPositions: 5, tpPct: 2.0, addIntervalMin: 45, rsiMaxEntry: 40 }],
    ["Max5 + 2.5%TP + 60m + RSI≤40", { maxPositions: 5, tpPct: 2.5, addIntervalMin: 60, rsiMaxEntry: 40 }],
    ["Max6 + 2.0%TP + 45m + RSI≤45", { maxPositions: 6, tpPct: 2.0, addIntervalMin: 45, rsiMaxEntry: 45 }],
    ["Max6 + 2.5%TP + 45m + RSI≤40", { maxPositions: 6, tpPct: 2.5, addIntervalMin: 45, rsiMaxEntry: 40 }],

    // ── RSI + no trend gate (test if RSI replaces trend gate) ──
    ["Max5 + RSI≤45 no trend", { maxPositions: 5, rsiMaxEntry: 45, useTrendGate: false }],
    ["Max5 + RSI≤40 no trend", { maxPositions: 5, rsiMaxEntry: 40, useTrendGate: false }],
    ["Max5 + RSI≤35 no trend", { maxPositions: 5, rsiMaxEntry: 35, useTrendGate: false }],
  ];

  console.log("Config".padEnd(42) + "Return".padStart(9) + " MaxDD".padStart(8) + "  MinEq".padStart(10) + "  Surv" + " Trades".padStart(7) + "   WR" + "  Fees+Fund".padStart(12));
  console.log("─".repeat(105));

  for (const [label, overrides] of sweeps) {
    const cfg = { ...BASE, ...overrides };
    const r = runSim(candles, cfg);
    const surv = r.survived ? " YES" : "  NO";
    console.log(
      `${label.padEnd(42)}${(r.returnPct.toFixed(1) + "%").padStart(9)}${(r.maxDrawdown.toFixed(1) + "%").padStart(8)}  $${r.minEquity.toFixed(0).padStart(7)}${surv}${String(r.totalTrades).padStart(7)}  ${r.wr.toFixed(0).padStart(3)}%  $${(r.totalFees + r.totalFunding).toFixed(0).padStart(7)}`
    );
  }
}

main();
