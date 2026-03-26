import { authClient } from "./client";

async function checkCopyTrades() {
  console.log("=== Checking Copy Trading API Access ===\n");

  // Try execution list filtered to copy trading
  console.log("1. Execution list (linear):");
  try {
    const res = await authClient.getExecutionList({
      category: "linear",
      limit: 20,
    });
    console.log(`   retCode: ${res.retCode} | retMsg: ${res.retMsg}`);
    console.log(`   Trades found: ${res.result.list.length}`);
    if (res.result.list.length > 0) {
      for (const t of res.result.list.slice(0, 5)) {
        const time = new Date(Number(t.execTime)).toISOString();
        console.log(`   ${time} | ${t.symbol} ${t.side} ${t.execQty} @ $${t.execPrice} | fee: ${t.execFee}`);
      }
    }
  } catch (err: any) {
    console.log(`   Error: ${err.message}`);
  }

  // Try closed PnL — this shows completed trades with profit/loss
  console.log("\n2. Closed PnL (shows completed positions):");
  try {
    const res = await authClient.getClosedPnL({
      category: "linear",
      limit: 20,
    });
    console.log(`   retCode: ${res.retCode} | retMsg: ${res.retMsg}`);
    console.log(`   Positions found: ${res.result.list.length}`);
    if (res.result.list.length > 0) {
      for (const p of res.result.list.slice(0, 5)) {
        const time = new Date(Number(p.createdTime)).toISOString();
        console.log(`   ${time} | ${p.symbol} ${p.side} ${p.qty} @ avg $${p.avgEntryPrice} → $${p.avgExitPrice} | PnL: $${p.closedPnl}`);
      }
    }
  } catch (err: any) {
    console.log(`   Error: ${err.message}`);
  }

  // Try position info — shows current open positions
  console.log("\n3. Current open positions:");
  try {
    const res = await authClient.getPositionInfo({
      category: "linear",
      settleCoin: "USDT",
    });
    console.log(`   retCode: ${res.retCode} | retMsg: ${res.retMsg}`);
    const positions = res.result.list.filter((p: any) => Number(p.size) > 0);
    console.log(`   Open positions: ${positions.length}`);
    for (const p of positions) {
      console.log(`   ${p.symbol} ${p.side} size: ${p.size} @ avg $${p.avgPrice} | uPnL: $${p.unrealisedPnl}`);
    }
  } catch (err: any) {
    console.log(`   Error: ${err.message}`);
  }

  // Try order history
  console.log("\n4. Order history:");
  try {
    const res = await authClient.getHistoricOrders({
      category: "linear",
      limit: 20,
    });
    console.log(`   retCode: ${res.retCode} | retMsg: ${res.retMsg}`);
    console.log(`   Orders found: ${res.result.list.length}`);
    if (res.result.list.length > 0) {
      for (const o of res.result.list.slice(0, 5)) {
        const time = new Date(Number(o.createdTime)).toISOString();
        console.log(`   ${time} | ${o.symbol} ${o.side} ${o.orderType} ${o.qty} @ $${o.price} | status: ${o.orderStatus}`);
      }
    }
  } catch (err: any) {
    console.log(`   Error: ${err.message}`);
  }
}

checkCopyTrades().catch(console.error);
