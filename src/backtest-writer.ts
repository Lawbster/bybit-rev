// backtest-writer.ts — CSV output for sim/backtest results
// Usage: collect BacktestTrade[] during sim, call writeCsv() at end

import fs from "fs";
import path from "path";

export interface BacktestTrade {
  strategy: string;        // "pf0-short", "wed-short", "ladder", "hedge"
  symbol: string;          // "HYPEUSDT"
  side: "long" | "short";
  entryTime: number;       // ms epoch UTC
  exitTime: number;        // ms epoch UTC
  entryPrice: number;
  exitPrice: number;
  notional: number;        // USD
  pnlUsd: number;          // after fees
  pnlPct: number;          // pnl as % of notional
  outcome: string;         // "tp" | "stop" | "flat" | "kill" | "stale" | "expiry"
  feesUsd: number;
}

export interface BacktestMeta {
  strategy: string;        // short name for filename: "pf0", "exact-full", "river"
  symbol: string;          // "HYPEUSDT"
  params: Record<string, string | number>;  // { tp: 1.0, sl: 2.0, hold: "12h" }
}

const DISC_CUTOFF = new Date("2026-01-01T00:00:00Z").getTime();
const BACKTESTS_DIR = path.resolve(process.cwd(), "backtests");

function symbolDir(symbol: string): string {
  return symbol.replace(/USDT$/i, "").toLowerCase();
}

function buildFilename(meta: BacktestMeta): string {
  const parts = [meta.strategy];
  for (const [k, v] of Object.entries(meta.params)) {
    parts.push(`${k}${v}`);
  }
  return parts.join("-");
}

function isoUtc(ms: number): string {
  return new Date(ms).toISOString().replace(".000Z", "Z");
}

function getSplit(entryTimeMs: number): "disc" | "val" {
  return entryTimeMs < DISC_CUTOFF ? "disc" : "val";
}

// ── Core: write trade CSV + summary CSV ──

export function writeCsv(trades: BacktestTrade[], meta: BacktestMeta): string {
  const dir = path.join(BACKTESTS_DIR, symbolDir(meta.symbol));
  fs.mkdirSync(dir, { recursive: true });

  const baseName = buildFilename(meta);
  const csvPath = path.join(dir, baseName + ".csv");
  const summaryPath = path.join(dir, baseName + "_summary.csv");

  // ── Trade CSV ──
  const header = "trade_id,strategy,symbol,side,entry_time,exit_time,entry_price,exit_price,notional,pnl_usd,pnl_pct,outcome,hold_minutes,split,fees_usd";
  const rows = trades.map((t, i) => {
    const hold = Math.round((t.exitTime - t.entryTime) / 60000);
    return [
      i + 1, t.strategy, t.symbol, t.side,
      isoUtc(t.entryTime), isoUtc(t.exitTime),
      t.entryPrice.toFixed(6), t.exitPrice.toFixed(6),
      t.notional.toFixed(2), t.pnlUsd.toFixed(2), t.pnlPct.toFixed(4),
      t.outcome, hold, getSplit(t.entryTime), t.feesUsd.toFixed(2),
    ].join(",");
  });
  fs.writeFileSync(csvPath, [header, ...rows].join("\n") + "\n");

  // ── Summary CSV ──
  const disc = trades.filter(t => t.entryTime < DISC_CUTOFF);
  const val = trades.filter(t => t.entryTime >= DISC_CUTOFF);

  function stats(arr: BacktestTrade[]) {
    if (arr.length === 0) return { n: 0, wins: 0, losses: 0, flats: 0, wr: 0, totalPnl: 0, avgPnl: 0, maxDD: 0, best: 0, worst: 0 };
    const wins = arr.filter(t => t.pnlUsd > 0).length;
    const losses = arr.filter(t => t.pnlUsd < 0).length;
    const flats = arr.length - wins - losses;
    const totalPnl = arr.reduce((s, t) => s + t.pnlUsd, 0);
    let peak = 0, dd = 0, cum = 0;
    for (const t of arr) { cum += t.pnlUsd; if (cum > peak) peak = cum; const d = peak - cum; if (d > dd) dd = d; }
    return {
      n: arr.length, wins, losses, flats,
      wr: (wins / arr.length) * 100,
      totalPnl, avgPnl: totalPnl / arr.length,
      maxDD: dd,
      best: Math.max(...arr.map(t => t.pnlUsd)),
      worst: Math.min(...arr.map(t => t.pnlUsd)),
    };
  }

  const sa = stats(trades), sd = stats(disc), sv = stats(val);
  const sHeader = "metric,all,disc,val";
  const sRows = [
    `total_trades,${sa.n},${sd.n},${sv.n}`,
    `wins,${sa.wins},${sd.wins},${sv.wins}`,
    `losses,${sa.losses},${sd.losses},${sv.losses}`,
    `flats,${sa.flats},${sd.flats},${sv.flats}`,
    `win_rate_pct,${sa.wr.toFixed(1)},${sd.wr.toFixed(1)},${sv.wr.toFixed(1)}`,
    `total_pnl_usd,${sa.totalPnl.toFixed(2)},${sd.totalPnl.toFixed(2)},${sv.totalPnl.toFixed(2)}`,
    `avg_pnl_per_trade,${sa.avgPnl.toFixed(2)},${sd.avgPnl.toFixed(2)},${sv.avgPnl.toFixed(2)}`,
    `max_drawdown_usd,${sa.maxDD.toFixed(2)},${sd.maxDD.toFixed(2)},${sv.maxDD.toFixed(2)}`,
    `best_trade_usd,${sa.best.toFixed(2)},${sd.best.toFixed(2)},${sv.best.toFixed(2)}`,
    `worst_trade_usd,${sa.worst.toFixed(2)},${sd.worst.toFixed(2)},${sv.worst.toFixed(2)}`,
    `run_timestamp,${new Date().toISOString()},,`,
  ];
  fs.writeFileSync(summaryPath, [sHeader, ...sRows].join("\n") + "\n");

  console.log(`\n  CSV → ${csvPath}`);
  console.log(`  Summary → ${summaryPath}`);
  return csvPath;
}
