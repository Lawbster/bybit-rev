import { loadAllExports } from "./parse-csv";
import { aggregateOrders, buildPositions } from "./aggregator";
import { Position } from "./types";

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours > 0) return `${hours}h ${remainMins}m`;
  return `${mins}m`;
}

function formatTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

async function main() {
  // 1. Load and parse
  const rows = loadAllExports();
  const trades = rows.filter((r) => r.type === "Trade");
  const nonTrades = rows.filter((r) => r.type !== "Trade");

  console.log("=== Raw Data Summary ===");
  console.log(`Total rows: ${rows.length}`);
  console.log(`Trade rows: ${trades.length}`);
  console.log(`Non-trade rows: ${nonTrades.length} (${[...new Set(nonTrades.map((r) => r.type))].join(", ")})`);

  // 2. Aggregate partial fills
  const orders = aggregateOrders(rows);
  console.log(`\n=== Aggregated Orders ===`);
  console.log(`Unique orders: ${orders.length}`);

  const opens = orders.filter((o) => o.action === "Open");
  const closes = orders.filter((o) => o.action === "Close");
  console.log(`Opens: ${opens.length} | Closes: ${closes.length}`);

  // Orders per symbol
  const symbolOrders = new Map<string, number>();
  for (const o of orders) {
    symbolOrders.set(o.symbol, (symbolOrders.get(o.symbol) || 0) + 1);
  }
  console.log("\nOrders by symbol:");
  for (const [sym, count] of [...symbolOrders].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sym}: ${count} orders`);
  }

  // 3. Build positions
  const positions = buildPositions(orders);
  const closed = positions.filter((p) => p.exitOrder !== null);
  const open = positions.filter((p) => p.exitOrder === null);

  console.log(`\n=== Positions ===`);
  console.log(`Total: ${positions.length} | Closed: ${closed.length} | Still open: ${open.length}`);

  // 4. Closed position analysis
  if (closed.length > 0) {
    console.log(`\n=== Closed Position Details ===`);
    for (const p of closed) {
      const dur = p.holdDurationMs != null ? formatDuration(p.holdDurationMs) : "?";
      const pnlStr = p.pnl != null ? `$${p.pnl.toFixed(4)}` : "?";
      const pctStr = p.pnlPercent != null ? `${p.pnlPercent.toFixed(2)}%` : "?";
      console.log(
        `  ${formatTime(p.entryTime)} | ${p.symbol.padEnd(12)} ${p.side.padEnd(6)} ` +
        `qty:${p.qty.toString().padStart(6)} | ` +
        `$${p.entryPrice.toFixed(6)} → $${p.exitPrice!.toFixed(6)} | ` +
        `PnL: ${pnlStr.padStart(10)} (${pctStr.padStart(8)}) | ` +
        `Hold: ${dur}`
      );
    }

    // Summary stats
    const wins = closed.filter((p) => p.pnl != null && p.pnl > 0);
    const losses = closed.filter((p) => p.pnl != null && p.pnl <= 0);
    const totalPnl = closed.reduce((s, p) => s + (p.pnl || 0), 0);
    const totalFees = closed.reduce((s, p) => s + p.totalFees, 0);
    const avgHold = closed
      .filter((p) => p.holdDurationMs != null)
      .reduce((s, p) => s + p.holdDurationMs!, 0) / closed.length;

    console.log(`\n=== Performance Summary ===`);
    console.log(`Win rate: ${wins.length}/${closed.length} (${((wins.length / closed.length) * 100).toFixed(1)}%)`);
    console.log(`Total PnL (net fees): $${totalPnl.toFixed(4)}`);
    console.log(`Total fees paid: $${totalFees.toFixed(4)}`);
    console.log(`Avg hold time: ${formatDuration(avgHold)}`);

    if (wins.length > 0) {
      const avgWin = wins.reduce((s, p) => s + (p.pnl || 0), 0) / wins.length;
      console.log(`Avg win: $${avgWin.toFixed(4)}`);
    }
    if (losses.length > 0) {
      const avgLoss = losses.reduce((s, p) => s + (p.pnl || 0), 0) / losses.length;
      console.log(`Avg loss: $${avgLoss.toFixed(4)}`);
    }

    // Per-symbol breakdown
    console.log(`\n=== Per-Symbol Breakdown ===`);
    const symbols = [...new Set(closed.map((p) => p.symbol))];
    for (const sym of symbols) {
      const symPositions = closed.filter((p) => p.symbol === sym);
      const symWins = symPositions.filter((p) => p.pnl != null && p.pnl > 0);
      const symPnl = symPositions.reduce((s, p) => s + (p.pnl || 0), 0);
      const symLongs = symPositions.filter((p) => p.side === "Long");
      const symShorts = symPositions.filter((p) => p.side === "Short");
      console.log(
        `  ${sym.padEnd(12)} | ` +
        `${symPositions.length} trades (${symLongs.length}L/${symShorts.length}S) | ` +
        `Win: ${((symWins.length / symPositions.length) * 100).toFixed(0)}% | ` +
        `PnL: $${symPnl.toFixed(4)}`
      );
    }
  }

  // 5. Open positions
  if (open.length > 0) {
    console.log(`\n=== Currently Open Positions ===`);
    for (const p of open) {
      console.log(
        `  ${formatTime(p.entryTime)} | ${p.symbol.padEnd(12)} ${p.side.padEnd(6)} ` +
        `qty:${p.qty} @ $${p.entryPrice.toFixed(6)}`
      );
    }
  }
}

main().catch(console.error);
