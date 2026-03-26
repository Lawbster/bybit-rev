import { loadAllExports } from "./parse-csv";
import { RawCsvRow } from "./types";

interface PositionCycle {
  symbol: string;
  side: "Long" | "Short";
  fills: RawCsvRow[];
  opens: RawCsvRow[];
  closes: RawCsvRow[];
  totalOpenQty: number;
  totalCloseQty: number;
  avgEntryPrice: number;
  avgExitPrice: number;
  totalPnl: number;
  totalFees: number;
  entryTime: Date;
  exitTime: Date;
  holdDurationMs: number;
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours > 0) return `${hours}h ${remainMins}m`;
  if (mins > 0) return `${mins}m`;
  return `${secs}s`;
}

function formatTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

async function main() {
  const rows = loadAllExports();
  const trades = rows
    .filter((r) => r.type === "Trade")
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  console.log(`Loaded ${rows.length} rows, ${trades.length} trade fills\n`);

  // Group by Order ID to see how the trader structures orders
  const orderGroups = new Map<string, RawCsvRow[]>();
  for (const t of trades) {
    const group = orderGroups.get(t.orderId) || [];
    group.push(t);
    orderGroups.set(t.orderId, group);
  }

  console.log(`=== Order-Level View ===`);
  console.log(`Unique Order IDs: ${orderGroups.size}\n`);

  // Build order summaries
  interface OrderSummary {
    orderId: string;
    symbol: string;
    direction: string;
    totalQty: number;
    avgPrice: number;
    totalFee: number;
    totalChange: number;
    fillCount: number;
    time: Date;
    // Position value from the LAST fill (closest to final state)
    finalPosition: number;
  }

  const orderSummaries: OrderSummary[] = [];
  for (const [orderId, fills] of orderGroups) {
    const sortedFills = fills.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
    const totalQty = fills.reduce((s, f) => s + f.quantity, 0);
    const totalNotional = fills.reduce((s, f) => s + f.quantity * f.filledPrice, 0);

    orderSummaries.push({
      orderId,
      symbol: fills[0].contract,
      direction: fills[0].direction,
      totalQty,
      avgPrice: totalQty > 0 ? totalNotional / totalQty : 0,
      totalFee: fills.reduce((s, f) => s + f.feePaid, 0),
      totalChange: fills.reduce((s, f) => s + f.change, 0),
      fillCount: fills.length,
      time: new Date(sortedFills[0].time),
      finalPosition: sortedFills[sortedFills.length - 1].position,
    });
  }

  orderSummaries.sort((a, b) => a.time.getTime() - b.time.getTime());

  // Print each order
  for (const o of orderSummaries) {
    const posMarker = o.finalPosition === 0 ? " << POS=0" : "";
    console.log(
      `${formatTime(o.time)} | ${o.symbol.padEnd(12)} ${o.direction.padEnd(12)} | ` +
      `qty: ${o.totalQty.toString().padStart(6)} @ $${o.avgPrice.toFixed(6)} | ` +
      `${o.fillCount} fills | change: $${o.totalChange.toFixed(4).padStart(10)} | ` +
      `pos after: ${o.finalPosition}${posMarker}`
    );
  }

  // Now build cycles using the Position column
  // A cycle = all orders between position going from 0 to non-zero back to 0
  // We detect this by looking at orders where finalPosition = 0 on a Close
  console.log(`\n=== Position Cycles (using Position=0 to detect cycle end) ===\n`);

  // Group orders by symbol, then walk chronologically
  const symbolOrders = new Map<string, OrderSummary[]>();
  for (const o of orderSummaries) {
    const list = symbolOrders.get(o.symbol) || [];
    list.push(o);
    symbolOrders.set(o.symbol, list);
  }

  const allCycles: PositionCycle[] = [];

  for (const [symbol, orders] of symbolOrders) {
    let currentCycleOrders: OrderSummary[] = [];

    for (const o of orders) {
      currentCycleOrders.push(o);

      // Cycle ends when a Close order results in Position = 0
      const isClose = o.direction.startsWith("Close");
      if (isClose && o.finalPosition === 0) {
        const opens = currentCycleOrders.filter((x) => x.direction.startsWith("Open"));
        const closes = currentCycleOrders.filter((x) => x.direction.startsWith("Close"));

        if (opens.length > 0 && closes.length > 0) {
          const side = opens[0].direction.includes("Long") ? "Long" as const : "Short" as const;

          const totalOpenQty = opens.reduce((s, x) => s + x.totalQty, 0);
          const totalOpenNotional = opens.reduce((s, x) => s + x.totalQty * x.avgPrice, 0);
          const totalCloseQty = closes.reduce((s, x) => s + x.totalQty, 0);
          const totalCloseNotional = closes.reduce((s, x) => s + x.totalQty * x.avgPrice, 0);

          const totalChange = currentCycleOrders.reduce((s, x) => s + x.totalChange, 0);
          const totalFees = currentCycleOrders.reduce((s, x) => s + x.totalFee, 0);

          // Gather raw fills for this cycle
          const allFills: RawCsvRow[] = [];
          for (const co of currentCycleOrders) {
            const fills = orderGroups.get(co.orderId) || [];
            allFills.push(...fills);
          }

          allCycles.push({
            symbol,
            side,
            fills: allFills,
            opens: allFills.filter((f) => f.direction.startsWith("Open")),
            closes: allFills.filter((f) => f.direction.startsWith("Close")),
            totalOpenQty,
            totalCloseQty,
            avgEntryPrice: totalOpenQty > 0 ? totalOpenNotional / totalOpenQty : 0,
            avgExitPrice: totalCloseQty > 0 ? totalCloseNotional / totalCloseQty : 0,
            totalPnl: totalChange,
            totalFees,
            entryTime: opens[0].time,
            exitTime: closes[closes.length - 1].time,
            holdDurationMs: closes[closes.length - 1].time.getTime() - opens[0].time.getTime(),
          });
        }

        currentCycleOrders = [];
      }
    }

    // If there are remaining orders, position is still open
    if (currentCycleOrders.length > 0) {
      const opens = currentCycleOrders.filter((x) => x.direction.startsWith("Open"));
      if (opens.length > 0) {
        const side = opens[0].direction.includes("Long") ? "Long" as const : "Short" as const;
        const totalOpenQty = opens.reduce((s, x) => s + x.totalQty, 0);
        console.log(
          `OPEN  | ${formatTime(opens[0].time)} | ${symbol.padEnd(12)} ${side.padEnd(6)} | ` +
          `qty: ${totalOpenQty} | ${currentCycleOrders.length} orders | still open`
        );
      }
    }
  }

  // Sort and display closed cycles
  allCycles.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

  for (const c of allCycles) {
    const pricePct =
      c.side === "Long"
        ? ((c.avgExitPrice - c.avgEntryPrice) / c.avgEntryPrice * 100)
        : ((c.avgEntryPrice - c.avgExitPrice) / c.avgEntryPrice * 100);

    const win = c.totalPnl > 0 ? "WIN " : "LOSS";
    console.log(
      `${win}  | ${formatTime(c.entryTime)} | ${c.symbol.padEnd(12)} ${c.side.padEnd(6)} | ` +
      `qty: ${c.totalOpenQty.toString().padStart(6)} | ` +
      `$${c.avgEntryPrice.toFixed(6)} → $${c.avgExitPrice.toFixed(6)} (${pricePct.toFixed(2)}%) | ` +
      `PnL: $${c.totalPnl.toFixed(4).padStart(10)} | fees: $${c.totalFees.toFixed(4)} | ` +
      `Hold: ${formatDuration(c.holdDurationMs)} | ${c.opens.length} open fills, ${c.closes.length} close fills`
    );
  }

  // Summary
  const wins = allCycles.filter((c) => c.totalPnl > 0);
  const losses = allCycles.filter((c) => c.totalPnl <= 0);
  const totalPnl = allCycles.reduce((s, c) => s + c.totalPnl, 0);
  const totalFees = allCycles.reduce((s, c) => s + c.totalFees, 0);

  console.log(`\n=== Summary ===`);
  console.log(`Closed trades: ${allCycles.length}`);
  console.log(`Wins: ${wins.length} | Losses: ${losses.length}`);
  console.log(`Win rate: ${((wins.length / allCycles.length) * 100).toFixed(1)}%`);
  console.log(`Total PnL: $${totalPnl.toFixed(4)}`);
  console.log(`Total fees: $${totalFees.toFixed(4)}`);
  console.log(`Net (PnL already includes fees from Change col): $${totalPnl.toFixed(4)}`);

  if (allCycles.length > 0) {
    const avgHold = allCycles.reduce((s, c) => s + c.holdDurationMs, 0) / allCycles.length;
    console.log(`Avg hold: ${formatDuration(avgHold)}`);
  }

  // Per symbol
  console.log(`\n=== Per-Symbol ===`);
  const symbols = [...new Set(allCycles.map((c) => c.symbol))];
  for (const sym of symbols) {
    const symCycles = allCycles.filter((c) => c.symbol === sym);
    const symWins = symCycles.filter((c) => c.totalPnl > 0);
    const symPnl = symCycles.reduce((s, c) => s + c.totalPnl, 0);
    const longs = symCycles.filter((c) => c.side === "Long").length;
    const shorts = symCycles.filter((c) => c.side === "Short").length;
    console.log(
      `  ${sym.padEnd(12)} | ${symCycles.length} trades (${longs}L/${shorts}S) | ` +
      `Win: ${symWins.length}/${symCycles.length} | PnL: $${symPnl.toFixed(4)}`
    );
  }
}

main().catch(console.error);
