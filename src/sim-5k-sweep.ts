import { loadCandles, Candle } from "./fetch-candles";

interface SimConfig {
  tpPct: number;
  leverage: number;
  maxPositions: number;
  addIntervalMin: number;
  basePositionUsdt: number;
  addScaleFactor: number;
  initialCapital: number;
  feeRate: number;
  stopLossPct: number;
  maxDrawdownPct: number;
  staleHours: number;
  reducedTpPct: number;
  startDate: string;
  batchTp: boolean;
}

interface Position {
  entryPrice: number;
  entryTime: number;
  qty: number;
  tpPrice: number;
  notional: number;
}

function runSim(candles: Candle[], config: SimConfig) {
  const { tpPct, leverage, maxPositions, addIntervalMin, basePositionUsdt, addScaleFactor, initialCapital, feeRate, stopLossPct, maxDrawdownPct } = config;
  let capital = initialCapital;
  const positions: Position[] = [];
  let closedCount = 0, winCount = 0, totalPnl = 0;
  let lastAddTime = 0;
  let peakCapital = capital;
  let maxDrawdown = 0;
  let maxConcurrent = 0;
  let totalFees = 0;
  let killed = false;
  let minEquity = capital;

  const startTs = config.startDate ? new Date(config.startDate).getTime() : 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp < startTs) continue;
    const { high, low, close, timestamp: ts } = c;
    if (killed) break;

    // Batch TP
    if (config.batchTp && positions.length > 0) {
      const totalQty = positions.reduce((s, p) => s + p.qty, 0);
      const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
      const batchTpPrice = avgEntry * (1 + tpPct / 100);
      if (high >= batchTpPrice) {
        for (const pos of positions) {
          const pnlRaw = (batchTpPrice - pos.entryPrice) * pos.qty;
          const fees = pos.notional * feeRate + (batchTpPrice * pos.qty) * feeRate;
          const pnl = pnlRaw - fees;
          totalFees += fees;
          capital += pnl;
          totalPnl += pnl;
          closedCount++;
          if (pnl > 0) winCount++;
        }
        positions.length = 0;
      }
    }

    // Stale timeout
    if (config.staleHours > 0 && positions.length > 0) {
      const staleIdx: number[] = [];
      for (let j = 0; j < positions.length; j++) {
        if ((ts - positions[j].entryTime) / 3600000 >= config.staleHours) staleIdx.push(j);
      }
      staleIdx.sort((a, b) => b - a);
      for (const idx of staleIdx) {
        const pos = positions[idx];
        const reducedTp = pos.entryPrice * (1 + config.reducedTpPct / 100);
        const exitPrice = high >= reducedTp ? reducedTp : close;
        const pnlRaw = (exitPrice - pos.entryPrice) * pos.qty;
        const fees = pos.notional * feeRate + Math.abs(exitPrice * pos.qty) * feeRate;
        const pnl = pnlRaw - fees;
        capital += pnl;
        totalPnl += pnl;
        totalFees += fees;
        closedCount++;
        if (pnl > 0) winCount++;
        positions.splice(idx, 1);
      }
    }

    // SL
    if (stopLossPct > 0) {
      const slIdx: number[] = [];
      for (let j = 0; j < positions.length; j++) {
        if (low <= positions[j].entryPrice * (1 - stopLossPct / 100)) slIdx.push(j);
      }
      slIdx.sort((a, b) => b - a);
      for (const idx of slIdx) {
        const pos = positions[idx];
        const exitPrice = pos.entryPrice * (1 - stopLossPct / 100);
        const pnlRaw = (exitPrice - pos.entryPrice) * pos.qty;
        const fees = pos.notional * feeRate + Math.abs(exitPrice * pos.qty) * feeRate;
        const pnl = pnlRaw - fees;
        capital += pnl;
        totalPnl += pnl;
        totalFees += fees;
        closedCount++;
        if (pnl > 0) winCount++;
        positions.splice(idx, 1);
      }
    }

    // DD check
    const unrealizedPnl = positions.reduce((s, p) => s + (close - p.entryPrice) * p.qty, 0);
    const equity = capital + unrealizedPnl;
    if (equity < minEquity) minEquity = equity;
    if (equity > peakCapital) peakCapital = equity;
    const dd = ((peakCapital - equity) / peakCapital) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (maxDrawdownPct > 0 && dd >= maxDrawdownPct) {
      for (const pos of positions) {
        const pnlRaw = (close - pos.entryPrice) * pos.qty;
        const fees = pos.notional * feeRate + Math.abs(close * pos.qty) * feeRate;
        capital += pnlRaw - fees;
        totalPnl += pnlRaw - fees;
        closedCount++;
      }
      positions.length = 0;
      killed = true;
      break;
    }

    // Open new
    const timeSinceLastAdd = (ts - lastAddTime) / 60000;
    if (positions.length < maxPositions && timeSinceLastAdd >= addIntervalMin) {
      const level = positions.length;
      const posSize = basePositionUsdt * Math.pow(addScaleFactor, level);
      const marginNeeded = posSize / leverage;
      const usedMargin = positions.reduce((s, p) => s + p.notional / leverage, 0);
      const availableMargin = capital - usedMargin;
      if (availableMargin >= marginNeeded && capital > 0) {
        positions.push({
          entryPrice: close,
          entryTime: ts,
          qty: posSize / close,
          tpPrice: close * (1 + tpPct / 100),
          notional: posSize,
        });
        lastAddTime = ts;
        if (positions.length > maxConcurrent) maxConcurrent = positions.length;
      }
    }
  }

  // Force close remaining
  if (positions.length > 0 && !killed) {
    const last = candles[candles.length - 1];
    for (const pos of positions) {
      const pnlRaw = (last.close - pos.entryPrice) * pos.qty;
      const fees = pos.notional * feeRate + Math.abs(last.close * pos.qty) * feeRate;
      capital += pnlRaw - fees;
      totalPnl += pnlRaw - fees;
      closedCount++;
      if (pnlRaw - fees > 0) winCount++;
    }
    positions.length = 0;
  }

  return { closedCount, winCount, totalPnl, capital, totalFees, maxDrawdown, maxConcurrent, killed, minEquity };
}

// ── Main ──
const candles = loadCandles("HYPEUSDT", "5");
const CAP = 5000;

const base: SimConfig = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 400, addScaleFactor: 1.32, initialCapital: CAP,
  feeRate: 0.00055, stopLossPct: 0, maxDrawdownPct: 0,
  staleHours: 0, reducedTpPct: 0.9, startDate: "2026-01-20", batchTp: true,
};

console.log(`\n=== $5,000 EQUITY OPTIMIZATION ===`);
console.log(`${candles.length} candles loaded\n`);

// Sweep 1: Base size × Scale factor
console.log("─".repeat(100));
console.log("BASE SIZE × SCALE FACTOR (TP 1.4%, max 11, 30min interval)");
console.log("─".repeat(100));
console.log(`${"Config".padEnd(24)} Trades   WR     PnL       Return   MaxDD   MinEq    Liq?`);

for (const baseSize of [100, 200, 400, 600, 800, 1000, 1500]) {
  for (const scale of [1.0, 1.1, 1.2, 1.32]) {
    const c = { ...base, basePositionUsdt: baseSize, addScaleFactor: scale };
    const r = runSim(candles, c);
    const wr = r.closedCount > 0 ? ((r.winCount / r.closedCount) * 100).toFixed(0) : "0";
    const ret = ((r.capital / CAP - 1) * 100).toFixed(0);
    const liq = r.minEquity <= 0 ? "YES" : "no";
    const maxNotional = baseSize * (Math.pow(scale, 10) - 1) / (scale - 1 || 10);
    console.log(`  $${baseSize} ×${scale.toFixed(2)}`.padEnd(24) +
      `${String(r.closedCount).padStart(5)}  ${wr.padStart(3)}%  $${r.totalPnl.toFixed(0).padStart(8)}  ${ret.padStart(6)}%  ${r.maxDrawdown.toFixed(0).padStart(5)}%  $${r.minEquity.toFixed(0).padStart(6)}  ${liq}`);
  }
}

// Sweep 2: Best combos with DD protection
console.log(`\n${"─".repeat(100)}`);
console.log("BEST COMBOS WITH DRAWDOWN PROTECTION ($5k equity)");
console.log("─".repeat(100));
console.log(`${"Config".padEnd(52)} Trades   WR     PnL       Return   MaxDD   MinEq    Liq?`);

const combos: [string, Partial<SimConfig>][] = [
  // Aggressive — target 200%+
  ["Aggro: $600 ×1.32 max11", { basePositionUsdt: 600, addScaleFactor: 1.32 }],
  ["Aggro: $800 ×1.2 max11", { basePositionUsdt: 800, addScaleFactor: 1.2 }],
  ["Aggro: $1000 ×1.1 max11", { basePositionUsdt: 1000, addScaleFactor: 1.1 }],
  ["Aggro: $400 ×1.32 max11 stale48", { basePositionUsdt: 400, addScaleFactor: 1.32, staleHours: 48 }],

  // Moderate — target 100-200%, min equity > $1000
  ["Mod: $400 ×1.2 max11", { basePositionUsdt: 400, addScaleFactor: 1.2 }],
  ["Mod: $600 ×1.1 max11", { basePositionUsdt: 600, addScaleFactor: 1.1 }],
  ["Mod: $400 ×1.2 max9", { basePositionUsdt: 400, addScaleFactor: 1.2, maxPositions: 9 }],
  ["Mod: $300 ×1.32 max11", { basePositionUsdt: 300, addScaleFactor: 1.32 }],
  ["Mod: $500 ×1.2 stale48", { basePositionUsdt: 500, addScaleFactor: 1.2, staleHours: 48 }],

  // Conservative — target 50-100%, min equity > $3000
  ["Safe: $200 ×1.2 max11", { basePositionUsdt: 200, addScaleFactor: 1.2 }],
  ["Safe: $300 ×1.1 max11", { basePositionUsdt: 300, addScaleFactor: 1.1 }],
  ["Safe: $200 ×1.32 max9", { basePositionUsdt: 200, addScaleFactor: 1.32, maxPositions: 9 }],
  ["Safe: $400 ×1.0 max11", { basePositionUsdt: 400, addScaleFactor: 1.0 }],
  ["Safe: $300 ×1.2 max9 stale48", { basePositionUsdt: 300, addScaleFactor: 1.2, maxPositions: 9, staleHours: 48 }],

  // Ultra safe — min equity > $4000
  ["Ultra: $100 ×1.2 max11", { basePositionUsdt: 100, addScaleFactor: 1.2 }],
  ["Ultra: $200 ×1.0 max11", { basePositionUsdt: 200, addScaleFactor: 1.0 }],
  ["Ultra: $150 ×1.1 max9", { basePositionUsdt: 150, addScaleFactor: 1.1, maxPositions: 9 }],

  // With TP variations
  ["TP1.0 $400 ×1.2 max11", { tpPct: 1.0, basePositionUsdt: 400, addScaleFactor: 1.2 }],
  ["TP1.6 $400 ×1.2 max11", { tpPct: 1.6, basePositionUsdt: 400, addScaleFactor: 1.2 }],
  ["TP1.0 $600 ×1.1 stale48", { tpPct: 1.0, basePositionUsdt: 600, addScaleFactor: 1.1, staleHours: 48 }],

  // With leverage variation
  ["Lev20 $1000 ×1.2 max11", { leverage: 20, basePositionUsdt: 1000, addScaleFactor: 1.2 }],
  ["Lev30 $800 ×1.2 max11", { leverage: 30, basePositionUsdt: 800, addScaleFactor: 1.2 }],

  // Max positions sweep at good base
  ["$400 ×1.2 max7", { basePositionUsdt: 400, addScaleFactor: 1.2, maxPositions: 7 }],
  ["$400 ×1.2 max9", { basePositionUsdt: 400, addScaleFactor: 1.2, maxPositions: 9 }],
  ["$400 ×1.2 max11", { basePositionUsdt: 400, addScaleFactor: 1.2, maxPositions: 11 }],
  ["$400 ×1.2 max15", { basePositionUsdt: 400, addScaleFactor: 1.2, maxPositions: 15 }],
];

const results: { label: string; ret: number; minEq: number; maxDD: number; pnl: number; trades: number; wr: number }[] = [];

for (const [label, overrides] of combos) {
  const c = { ...base, ...overrides };
  const r = runSim(candles, c);
  const wr = r.closedCount > 0 ? (r.winCount / r.closedCount) * 100 : 0;
  const ret = ((r.capital / CAP - 1) * 100);
  const liq = r.minEquity <= 0 ? "⚠ LIQ" : r.minEquity < 1000 ? "⚡ LOW" : "✓";
  console.log(`  ${label.padEnd(52)}${String(r.closedCount).padStart(5)}  ${wr.toFixed(0).padStart(3)}%  $${r.totalPnl.toFixed(0).padStart(8)}  ${ret.toFixed(0).padStart(6)}%  ${r.maxDrawdown.toFixed(0).padStart(5)}%  $${r.minEquity.toFixed(0).padStart(6)}  ${liq}`);
  results.push({ label, ret, minEq: r.minEquity, maxDD: r.maxDrawdown, pnl: r.totalPnl, trades: r.closedCount, wr });
}

// Rank by return with min equity > $0
console.log(`\n${"─".repeat(100)}`);
console.log("TOP 10 BY RETURN (equity never goes negative)");
console.log("─".repeat(100));
const viable = results.filter(r => r.minEq > 0).sort((a, b) => b.ret - a.ret);
for (const r of viable.slice(0, 10)) {
  console.log(`  ${r.label.padEnd(52)} ${r.ret.toFixed(0).padStart(5)}% ret | $${r.pnl.toFixed(0).padStart(7)} PnL | ${r.maxDD.toFixed(0)}% DD | $${r.minEq.toFixed(0)} min eq`);
}

console.log(`\n${"─".repeat(100)}`);
console.log("TOP 10 BY RETURN (min equity > $1000 = safe from liq)");
console.log("─".repeat(100));
const safe = results.filter(r => r.minEq > 1000).sort((a, b) => b.ret - a.ret);
for (const r of safe.slice(0, 10)) {
  console.log(`  ${r.label.padEnd(52)} ${r.ret.toFixed(0).padStart(5)}% ret | $${r.pnl.toFixed(0).padStart(7)} PnL | ${r.maxDD.toFixed(0)}% DD | $${r.minEq.toFixed(0)} min eq`);
}
