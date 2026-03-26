import { loadAllExports } from "./parse-csv";
import { RawCsvRow } from "./types";

interface PositionCycle {
  symbol: string;
  side: "Long" | "Short";
  fills: RawCsvRow[];
  opens: RawCsvRow[];
  closes: RawCsvRow[];
  maxQty: number;
  totalPnl: number; // sum of Change column across all fills
  totalFees: number;
  totalCashFlow: number;
  entryTime: Date;
  exitTime: Date | null;
  avgEntryPrice: number;
  avgExitPrice: number | null;
  holdDurationMs: number | null;
  isOpen: boolean;
}

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

/**
 * Build position cycles by tracking net position per symbol+side.
 * A cycle starts when position opens and ends when it returns to 0.
 * Uses the CSV's own Change column for accurate P&L.
 */
function buildPositionCycles(rows: RawCsvRow[]): PositionCycle[] {
  const trades = rows
    .filter((r) => r.type === "Trade")
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const cycles: PositionCycle[] = [];

  // Track active cycles per symbol+side
  const active = new Map<string, {
    fills: RawCsvRow[];
    netQty: number;
  }>();

  for (const fill of trades) {
    const side = fill.direction.includes("Long") ? "Long" : "Short";
    const key = `${fill.contract}:${side}`;
    const isOpen = fill.direction.startsWith("Open");

    let state = active.get(key);
    if (!state) {
      state = { fills: [], netQty: 0 };
      active.set(key, state);
    }

    state.fills.push(fill);

    if (isOpen) {
      state.netQty += fill.quantity;
    } else {
      state.netQty -= fill.quantity;
    }

    // Position closed — cycle complete
    if (state.netQty <= 0.0001) {
      const opens = state.fills.filter((f) => f.direction.startsWith("Open"));
      const closes = state.fills.filter((f) => f.direction.startsWith("Close"));

      const totalOpenNotional = opens.reduce((s, f) => s + f.quantity * f.filledPrice, 0);
      const totalOpenQty = opens.reduce((s, f) => s + f.quantity, 0);
      const totalCloseNotional = closes.reduce((s, f) => s + f.quantity * f.filledPrice, 0);
      const totalCloseQty = closes.reduce((s, f) => s + f.quantity, 0);

      const firstOpen = opens[0];
      const lastClose = closes[closes.length - 1];

      cycles.push({
        symbol: fill.contract,
        side,
        fills: [...state.fills],
        opens,
        closes,
        maxQty: Math.max(...state.fills.map((f) => f.position), totalOpenQty),
        totalPnl: state.fills.reduce((s, f) => s + f.change, 0),
        totalFees: state.fills.reduce((s, f) => s + f.feePaid, 0),
        totalCashFlow: state.fills.reduce((s, f) => s + f.cashFlow, 0),
        entryTime: new Date(firstOpen.time),
        exitTime: lastClose ? new Date(lastClose.time) : null,
        avgEntryPrice: totalOpenQty > 0 ? totalOpenNotional / totalOpenQty : 0,
        avgExitPrice: totalCloseQty > 0 ? totalCloseNotional / totalCloseQty : null,
        holdDurationMs: lastClose
          ? new Date(lastClose.time).getTime() - new Date(firstOpen.time).getTime()
          : null,
        isOpen: false,
      });

      // Reset for next cycle
      active.set(key, { fills: [], netQty: 0 });
    }
  }

  // Add any still-open positions
  for (const [key, state] of active) {
    if (state.netQty > 0.0001 && state.fills.length > 0) {
      const [symbol, side] = key.split(":") as [string, "Long" | "Short"];
      const opens = state.fills.filter((f) => f.direction.startsWith("Open"));

      const totalOpenNotional = opens.reduce((s, f) => s + f.quantity * f.filledPrice, 0);
      const totalOpenQty = opens.reduce((s, f) => s + f.quantity, 0);

      cycles.push({
        symbol,
        side,
        fills: [...state.fills],
        opens,
        closes: [],
        maxQty: state.netQty,
        totalPnl: state.fills.reduce((s, f) => s + f.change, 0),
        totalFees: state.fills.reduce((s, f) => s + f.feePaid, 0),
        totalCashFlow: state.fills.reduce((s, f) => s + f.cashFlow, 0),
        entryTime: new Date(opens[0].time),
        exitTime: null,
        avgEntryPrice: totalOpenQty > 0 ? totalOpenNotional / totalOpenQty : 0,
        avgExitPrice: null,
        holdDurationMs: null,
        isOpen: true,
      });
    }
  }

  cycles.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
  return cycles;
}

async function main() {
  const rows = loadAllExports();
  const trades = rows.filter((r) => r.type === "Trade");
  console.log(`Loaded ${rows.length} rows, ${trades.length} trade fills\n`);

  const cycles = buildPositionCycles(rows);
  const closed = cycles.filter((c) => !c.isOpen);
  const open = cycles.filter((c) => c.isOpen);

  console.log("=== Complete Position Cycles (full round-trips) ===\n");

  for (const c of closed) {
    const dur = c.holdDurationMs != null ? formatDuration(c.holdDurationMs) : "?";
    const pnlPct = c.avgEntryPrice > 0 && c.avgExitPrice != null
      ? ((c.side === "Long"
          ? (c.avgExitPrice - c.avgEntryPrice) / c.avgEntryPrice
          : (c.avgEntryPrice - c.avgExitPrice) / c.avgEntryPrice) * 100).toFixed(2)
      : "?";
    const win = c.totalPnl > 0 ? "WIN" : "LOSS";

    console.log(
      `${win.padEnd(5)} | ${formatTime(c.entryTime)} | ${c.symbol.padEnd(12)} ${c.side.padEnd(6)} | ` +
      `${c.opens.length} opens, ${c.closes.length} closes | ` +
      `max qty: ${c.maxQty.toString().padStart(6)} | ` +
      `$${c.avgEntryPrice.toFixed(6)} → $${c.avgExitPrice?.toFixed(6)} (${pnlPct}%) | ` +
      `PnL: $${c.totalPnl.toFixed(4).padStart(10)} | fees: $${c.totalFees.toFixed(4)} | ` +
      `Hold: ${dur}`
    );
  }

  // Summary
  const wins = closed.filter((c) => c.totalPnl > 0);
  const losses = closed.filter((c) => c.totalPnl <= 0);
  const totalPnl = closed.reduce((s, c) => s + c.totalPnl, 0);
  const totalFees = closed.reduce((s, c) => s + c.totalFees, 0);

  console.log(`\n=== Summary ===`);
  console.log(`Closed round-trips: ${closed.length}`);
  console.log(`Win rate: ${wins.length}/${closed.length} (${((wins.length / closed.length) * 100).toFixed(1)}%)`);
  console.log(`Total PnL: $${totalPnl.toFixed(4)}`);
  console.log(`Total fees: $${totalFees.toFixed(4)}`);

  if (closed.some((c) => c.holdDurationMs != null)) {
    const avgHold = closed
      .filter((c) => c.holdDurationMs != null)
      .reduce((s, c) => s + c.holdDurationMs!, 0) / closed.length;
    console.log(`Avg hold: ${formatDuration(avgHold)}`);
  }

  // Per symbol
  console.log(`\n=== Per-Symbol ===`);
  const symbols = [...new Set(closed.map((c) => c.symbol))];
  for (const sym of symbols) {
    const symCycles = closed.filter((c) => c.symbol === sym);
    const symWins = symCycles.filter((c) => c.totalPnl > 0);
    const symPnl = symCycles.reduce((s, c) => s + c.totalPnl, 0);
    const longs = symCycles.filter((c) => c.side === "Long").length;
    const shorts = symCycles.filter((c) => c.side === "Short").length;
    console.log(
      `  ${sym.padEnd(12)} | ${symCycles.length} trades (${longs}L/${shorts}S) | ` +
      `Win: ${symWins.length}/${symCycles.length} (${((symWins.length / symCycles.length) * 100).toFixed(0)}%) | ` +
      `PnL: $${symPnl.toFixed(4)}`
    );
  }

  if (open.length > 0) {
    console.log(`\n=== Still Open ===`);
    for (const c of open) {
      console.log(
        `  ${formatTime(c.entryTime)} | ${c.symbol.padEnd(12)} ${c.side.padEnd(6)} | ` +
        `qty: ${c.maxQty} @ avg $${c.avgEntryPrice.toFixed(6)} | ` +
        `${c.opens.length} fills | fees so far: $${c.totalFees.toFixed(4)}`
      );
    }
  }
}

main().catch(console.error);
