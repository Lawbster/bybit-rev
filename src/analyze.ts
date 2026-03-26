import { loadAllXlsx } from "./parse-xlsx";
import { Trade } from "./types";

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours > 0) return `${hours}h ${remainMins}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

function formatTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

async function main() {
  const trades = loadAllXlsx();
  console.log(`=== Loaded ${trades.length} trades ===\n`);

  // All trades
  console.log("=== Trade Log ===");
  for (const t of trades) {
    const dur = formatDuration(t.holdDurationMs);
    const pnlSign = t.pnl >= 0 ? "+" : "";
    console.log(
      `${formatTime(t.openedAt)} | ${t.symbol.padEnd(14)} ${t.side.padEnd(6)} ${t.leverage}x | ` +
      `qty: ${t.qty.toString().padStart(8)} | ` +
      `$${t.entryPrice.toFixed(5)} → $${t.exitPrice.toFixed(5)} | ` +
      `${pnlSign}$${t.pnl.toFixed(4).padStart(8)} (${pnlSign}${t.pnlPercent.toFixed(2)}%) | ` +
      `fee: $${t.fees.toFixed(4)} | ${dur}`
    );
  }

  // Summary stats
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const totalFees = trades.reduce((s, t) => s + t.fees, 0);
  const avgHold = trades.reduce((s, t) => s + t.holdDurationMs, 0) / trades.length;

  console.log(`\n=== Performance Summary ===`);
  console.log(`Trades: ${trades.length} | Wins: ${wins.length} | Losses: ${losses.length}`);
  console.log(`Win rate: ${((wins.length / trades.length) * 100).toFixed(1)}%`);
  console.log(`Total PnL: $${totalPnl.toFixed(4)}`);
  console.log(`Total fees: $${totalFees.toFixed(4)}`);
  console.log(`Avg hold: ${formatDuration(avgHold)}`);

  if (wins.length > 0) {
    const avgWin = wins.reduce((s, t) => s + t.pnl, 0) / wins.length;
    const bestWin = wins.reduce((best, t) => (t.pnl > best.pnl ? t : best));
    console.log(`Avg win: $${avgWin.toFixed(4)}`);
    console.log(`Best win: $${bestWin.pnl.toFixed(4)} (${bestWin.symbol} ${bestWin.side})`);
  }
  if (losses.length > 0) {
    const avgLoss = losses.reduce((s, t) => s + t.pnl, 0) / losses.length;
    console.log(`Avg loss: $${avgLoss.toFixed(4)}`);
  }

  // Per-symbol breakdown
  console.log(`\n=== Per-Symbol ===`);
  const symbols = [...new Set(trades.map((t) => t.symbol))].sort();
  for (const sym of symbols) {
    const symTrades = trades.filter((t) => t.symbol === sym);
    const symWins = symTrades.filter((t) => t.pnl > 0);
    const symPnl = symTrades.reduce((s, t) => s + t.pnl, 0);
    const longs = symTrades.filter((t) => t.side === "Long");
    const shorts = symTrades.filter((t) => t.side === "Short");
    const avgHoldSym = symTrades.reduce((s, t) => s + t.holdDurationMs, 0) / symTrades.length;
    console.log(
      `  ${sym.padEnd(14)} | ${symTrades.length.toString().padStart(2)} trades (${longs.length}L/${shorts.length}S) | ` +
      `Win: ${symWins.length}/${symTrades.length} | ` +
      `PnL: $${symPnl.toFixed(4).padStart(10)} | ` +
      `Avg hold: ${formatDuration(avgHoldSym)}`
    );
  }

  // Side analysis
  console.log(`\n=== By Side ===`);
  for (const side of ["Long", "Short"] as const) {
    const sideTrades = trades.filter((t) => t.side === side);
    if (sideTrades.length === 0) continue;
    const sidePnl = sideTrades.reduce((s, t) => s + t.pnl, 0);
    const sideWins = sideTrades.filter((t) => t.pnl > 0);
    console.log(
      `  ${side.padEnd(6)} | ${sideTrades.length} trades | ` +
      `Win: ${sideWins.length}/${sideTrades.length} | ` +
      `PnL: $${sidePnl.toFixed(4)}`
    );
  }

  // Time-of-day analysis
  console.log(`\n=== By Hour (UTC) ===`);
  const hourBuckets = new Map<number, Trade[]>();
  for (const t of trades) {
    const h = t.openedAt.getUTCHours();
    const bucket = hourBuckets.get(h) || [];
    bucket.push(t);
    hourBuckets.set(h, bucket);
  }
  for (const [hour, hTrades] of [...hourBuckets].sort((a, b) => a[0] - b[0])) {
    const hPnl = hTrades.reduce((s, t) => s + t.pnl, 0);
    console.log(
      `  ${hour.toString().padStart(2)}:00 | ${hTrades.length.toString().padStart(2)} trades | PnL: $${hPnl.toFixed(4)}`
    );
  }

  // Hold duration distribution
  console.log(`\n=== Hold Duration Distribution ===`);
  const durBuckets = [
    { label: "< 1m", max: 60000 },
    { label: "1-5m", max: 300000 },
    { label: "5-15m", max: 900000 },
    { label: "15-30m", max: 1800000 },
    { label: "30m-1h", max: 3600000 },
    { label: "1h+", max: Infinity },
  ];
  for (const bucket of durBuckets) {
    const prev = durBuckets[durBuckets.indexOf(bucket) - 1]?.max || 0;
    const count = trades.filter(
      (t) => t.holdDurationMs >= prev && t.holdDurationMs < bucket.max
    ).length;
    if (count > 0) {
      const bar = "█".repeat(count);
      console.log(`  ${bucket.label.padEnd(8)} | ${count.toString().padStart(2)} ${bar}`);
    }
  }

  // Price move analysis (unleveraged)
  console.log(`\n=== Price Move (Unleveraged) ===`);
  for (const t of trades) {
    const priceMove =
      t.side === "Long"
        ? ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100
        : ((t.entryPrice - t.exitPrice) / t.entryPrice) * 100;
    const sign = priceMove >= 0 ? "+" : "";
    console.log(
      `  ${t.symbol.padEnd(14)} ${t.side.padEnd(6)} | ` +
      `price move: ${sign}${priceMove.toFixed(3)}% | ` +
      `leveraged (${t.leverage}x): ${sign}${(priceMove * t.leverage).toFixed(2)}%`
    );
  }
}

main().catch(console.error);
