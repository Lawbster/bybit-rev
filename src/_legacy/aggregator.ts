import {
  RawCsvRow,
  AggregatedOrder,
  Position,
  TradeDirection,
  Side,
} from "./types";

function parseSide(direction: string): Side {
  return direction.includes("Long") ? "Long" : "Short";
}

function parseAction(direction: string): "Open" | "Close" {
  return direction.startsWith("Open") ? "Open" : "Close";
}

/**
 * Aggregate partial fills into single orders by Order ID.
 */
export function aggregateOrders(rows: RawCsvRow[]): AggregatedOrder[] {
  const trades = rows.filter((r) => r.type === "Trade");

  // Group by orderId
  const groups = new Map<string, RawCsvRow[]>();
  for (const row of trades) {
    const existing = groups.get(row.orderId) || [];
    existing.push(row);
    groups.set(row.orderId, existing);
  }

  const orders: AggregatedOrder[] = [];

  for (const [orderId, fills] of groups) {
    if (fills.length === 0) continue;

    const first = fills[0];
    const direction = first.direction as TradeDirection;

    // Volume-weighted average price
    let totalNotional = 0;
    let totalQty = 0;
    let totalFee = 0;
    let totalCashFlow = 0;
    let totalChange = 0;
    const tradeIds: string[] = [];
    let earliest = new Date(first.time);
    let latest = new Date(first.time);

    for (const fill of fills) {
      const qty = fill.quantity;
      totalNotional += qty * fill.filledPrice;
      totalQty += qty;
      totalFee += fill.feePaid;
      totalCashFlow += fill.cashFlow;
      totalChange += fill.change;
      tradeIds.push(fill.tradeId);

      const t = new Date(fill.time);
      if (t < earliest) earliest = t;
      if (t > latest) latest = t;
    }

    orders.push({
      orderId,
      symbol: first.contract,
      direction,
      side: parseSide(direction),
      action: parseAction(direction),
      totalQty,
      avgPrice: totalQty > 0 ? totalNotional / totalQty : 0,
      totalFee,
      totalCashFlow,
      totalChange,
      fillCount: fills.length,
      firstFillTime: earliest,
      lastFillTime: latest,
      tradeIds,
    });
  }

  // Sort by time
  orders.sort(
    (a, b) => a.firstFillTime.getTime() - b.firstFillTime.getTime()
  );

  return orders;
}

/**
 * Match open orders to close orders to build complete positions.
 * Uses FIFO matching per symbol+side.
 */
export function buildPositions(orders: AggregatedOrder[]): Position[] {
  const positions: Position[] = [];

  // Track open inventory per symbol+side
  // Each entry: { order, remainingQty }
  const openStack = new Map<
    string,
    { order: AggregatedOrder; remainingQty: number }[]
  >();

  for (const order of orders) {
    const key = `${order.symbol}:${order.side}`;

    if (order.action === "Open") {
      const stack = openStack.get(key) || [];
      stack.push({ order, remainingQty: order.totalQty });
      openStack.set(key, stack);
    } else {
      // Close — match against open orders FIFO
      const stack = openStack.get(key) || [];
      let closeQtyRemaining = order.totalQty;

      while (closeQtyRemaining > 0 && stack.length > 0) {
        const oldest = stack[0];
        const matchQty = Math.min(closeQtyRemaining, oldest.remainingQty);

        const entryNotional = matchQty * oldest.order.avgPrice;
        const exitNotional = matchQty * order.avgPrice;
        const pnl =
          order.side === "Long"
            ? exitNotional - entryNotional
            : entryNotional - exitNotional;
        const totalFees =
          (oldest.order.totalFee * matchQty) / oldest.order.totalQty +
          (order.totalFee * matchQty) / order.totalQty;
        const netPnl = pnl - totalFees;

        positions.push({
          symbol: order.symbol,
          side: order.side,
          qty: matchQty,
          entryOrder: oldest.order,
          exitOrder: order,
          entryPrice: oldest.order.avgPrice,
          exitPrice: order.avgPrice,
          entryTime: oldest.order.firstFillTime,
          exitTime: order.firstFillTime,
          pnl: netPnl,
          pnlPercent: (pnl / entryNotional) * 100,
          totalFees,
          holdDurationMs:
            order.firstFillTime.getTime() -
            oldest.order.firstFillTime.getTime(),
        });

        oldest.remainingQty -= matchQty;
        closeQtyRemaining -= matchQty;

        if (oldest.remainingQty <= 0.0001) {
          stack.shift();
        }
      }

      openStack.set(key, stack);
    }
  }

  // Add any remaining open positions
  for (const [key, stack] of openStack) {
    for (const entry of stack) {
      if (entry.remainingQty > 0.0001) {
        const [symbol, side] = key.split(":") as [string, Side];
        positions.push({
          symbol,
          side,
          qty: entry.remainingQty,
          entryOrder: entry.order,
          exitOrder: null,
          entryPrice: entry.order.avgPrice,
          exitPrice: null,
          entryTime: entry.order.firstFillTime,
          exitTime: null,
          pnl: null,
          pnlPercent: null,
          totalFees: entry.order.totalFee,
          holdDurationMs: null,
        });
      }
    }
  }

  // Sort by entry time
  positions.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

  return positions;
}
