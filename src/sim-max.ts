import { loadCandles, Candle } from "./fetch-candles";

interface Cfg {
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number;
  feeRate: number; staleHours: number; reducedTpPct: number; startDate: string; batchTp: boolean;
}

interface Pos { entryPrice: number; entryTime: number; qty: number; notional: number; }

function run(candles: Candle[], cfg: Cfg) {
  let capital = cfg.initialCapital;
  const pos: Pos[] = [];
  let closed = 0, wins = 0, pnlTotal = 0, lastAdd = 0;
  let peak = capital, maxDD = 0, maxConc = 0, fees = 0, minEq = capital;
  const startTs = new Date(cfg.startDate).getTime();

  for (const c of candles) {
    if (c.timestamp < startTs) continue;
    const { high, close, timestamp: ts } = c;

    // Batch TP
    if (cfg.batchTp && pos.length > 0) {
      const tQ = pos.reduce((s, p) => s + p.qty, 0);
      const avgE = pos.reduce((s, p) => s + p.entryPrice * p.qty, 0) / tQ;
      const tp = avgE * (1 + cfg.tpPct / 100);
      if (high >= tp) {
        for (const p of pos) {
          const pnl = (tp - p.entryPrice) * p.qty - p.notional * cfg.feeRate - tp * p.qty * cfg.feeRate;
          capital += pnl; pnlTotal += pnl; closed++; if (pnl > 0) wins++;
          fees += p.notional * cfg.feeRate + tp * p.qty * cfg.feeRate;
        }
        pos.length = 0;
      }
    }

    // Stale
    if (cfg.staleHours > 0) {
      for (let j = pos.length - 1; j >= 0; j--) {
        if ((ts - pos[j].entryTime) / 3600000 >= cfg.staleHours) {
          const p = pos[j];
          const rtp = p.entryPrice * (1 + cfg.reducedTpPct / 100);
          const ep = high >= rtp ? rtp : close;
          const pnl = (ep - p.entryPrice) * p.qty - p.notional * cfg.feeRate - Math.abs(ep * p.qty) * cfg.feeRate;
          capital += pnl; pnlTotal += pnl; closed++; if (pnl > 0) wins++;
          pos.splice(j, 1);
        }
      }
    }

    const ur = pos.reduce((s, p) => s + (close - p.entryPrice) * p.qty, 0);
    const eq = capital + ur;
    if (eq < minEq) minEq = eq;
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    if (pos.length < cfg.maxPositions && (ts - lastAdd) / 60000 >= cfg.addIntervalMin) {
      const sz = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, pos.length);
      const margin = sz / cfg.leverage;
      const used = pos.reduce((s, p) => s + p.notional / cfg.leverage, 0);
      if (capital - used >= margin && capital > 0) {
        pos.push({ entryPrice: close, entryTime: ts, qty: sz / close, notional: sz });
        lastAdd = ts;
        if (pos.length > maxConc) maxConc = pos.length;
      }
    }
  }

  // Force close remaining
  if (pos.length > 0) {
    const last = candles[candles.length - 1];
    for (const p of pos) {
      const pnl = (last.close - p.entryPrice) * p.qty - p.notional * cfg.feeRate - Math.abs(last.close * p.qty) * cfg.feeRate;
      capital += pnl; pnlTotal += pnl; closed++; if (pnl > 0) wins++;
    }
  }

  return { closed, wins, pnlTotal, capital, maxDD, minEq, maxConc, fees };
}

const candles = loadCandles("HYPEUSDT", "5");
const CAP = 5000;
const base: Cfg = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 400, addScaleFactor: 1.32, initialCapital: CAP,
  feeRate: 0.00055, staleHours: 0, reducedTpPct: 0.9,
  startDate: "2026-01-20", batchTp: true,
};

console.log(`\n=== ABSOLUTE MAX RETURN — $5k equity, full risk tolerance ===\n`);
console.log(`${"Config".padEnd(50)} Trades   WR    PnL        Ret     DD   MinEq   Wallet needed`);

const tests: [string, Partial<Cfg>][] = [
  // Pure max return
  ["$1000 ×1.32 max11", { basePositionUsdt: 1000 }],
  ["$1500 ×1.20 max11", { basePositionUsdt: 1500, addScaleFactor: 1.20 }],
  ["$800 ×1.32 max11", { basePositionUsdt: 800 }],
  ["$1000 ×1.20 max15", { basePositionUsdt: 1000, addScaleFactor: 1.20, maxPositions: 15 }],
  ["$800 ×1.32 max15", { basePositionUsdt: 800, maxPositions: 15 }],
  ["$600 ×1.32 max15", { basePositionUsdt: 600, maxPositions: 15 }],
  ["$1000 ×1.32 max15", { basePositionUsdt: 1000, maxPositions: 15 }],

  // With stale recycling
  ["$800 ×1.32 stale48", { basePositionUsdt: 800, staleHours: 48 }],
  ["$1000 ×1.32 stale48", { basePositionUsdt: 1000, staleHours: 48 }],
  ["$600 ×1.32 max11 stale48", { basePositionUsdt: 600, staleHours: 48 }],
  ["$800 ×1.32 max15 stale48", { basePositionUsdt: 800, maxPositions: 15, staleHours: 48 }],
  ["$600 ×1.32 max15 stale48", { basePositionUsdt: 600, maxPositions: 15, staleHours: 48 }],
  ["$1000 ×1.20 max15 stale48", { basePositionUsdt: 1000, addScaleFactor: 1.20, maxPositions: 15, staleHours: 48 }],

  // TP variations on best configs
  ["TP1.0 $800 ×1.32 stale48", { tpPct: 1.0, basePositionUsdt: 800, staleHours: 48 }],
  ["TP1.6 $800 ×1.32 stale48", { tpPct: 1.6, basePositionUsdt: 800, staleHours: 48 }],
  ["TP1.0 $1000 ×1.20 max15 stale48", { tpPct: 1.0, basePositionUsdt: 1000, addScaleFactor: 1.20, maxPositions: 15, staleHours: 48 }],

  // 20min interval (faster adds)
  ["$800 ×1.32 max11 20m stale48", { basePositionUsdt: 800, addIntervalMin: 20, staleHours: 48 }],
  ["$600 ×1.32 max15 20m stale48", { basePositionUsdt: 600, maxPositions: 15, addIntervalMin: 20, staleHours: 48 }],

  // Lower leverage = more margin available = bigger positions possible
  ["Lev25 $2000 ×1.20 max11", { leverage: 25, basePositionUsdt: 2000, addScaleFactor: 1.20 }],
  ["Lev25 $1500 ×1.32 max11", { leverage: 25, basePositionUsdt: 1500 }],
];

for (const [label, ov] of tests) {
  const c = { ...base, ...ov };
  const r = run(candles, c);
  const wr = r.closed > 0 ? ((r.wins / r.closed) * 100).toFixed(0) : "0";
  const ret = ((r.capital / CAP - 1) * 100).toFixed(0);
  // If minEq goes negative, you need wallet = $5000 + abs(minEq) to survive
  const walletNeeded = r.minEq < 0 ? CAP + Math.abs(r.minEq) : CAP;
  const flag = r.minEq > 1000 ? "✓ safe" : r.minEq > 0 ? "⚡ tight" : `⚠ need $${walletNeeded.toFixed(0)}`;
  console.log(
    `  ${label.padEnd(50)}${String(r.closed).padStart(5)}  ${wr.padStart(3)}%  $${r.pnlTotal.toFixed(0).padStart(8)}  ${ret.padStart(6)}%  ${r.maxDD.toFixed(0).padStart(4)}%  $${r.minEq.toFixed(0).padStart(7)}  ${flag}`
  );
}
