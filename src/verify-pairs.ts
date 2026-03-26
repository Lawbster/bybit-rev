import { publicClient, authClient } from "./client";
import { config } from "./config";

async function verifyKlineData() {
  console.log("=== Verifying Kline Data for Tracked Pairs ===\n");

  for (const symbol of config.pairs) {
    try {
      const res = await publicClient.getKline({
        category: "linear",
        symbol,
        interval: "60", // 1h candles
        limit: 5,
      });

      if (res.retCode !== 0) {
        console.log(`❌ ${symbol}: API error — ${res.retMsg}`);
        continue;
      }

      const candles = res.result.list;
      if (!candles || candles.length === 0) {
        console.log(`⚠️  ${symbol}: No candle data returned`);
        continue;
      }

      // candles: [startTime, open, high, low, close, volume, turnover]
      const latest = candles[0];
      console.log(`✅ ${symbol}`);
      console.log(`   Price: $${latest[4]} | Vol(1h): ${latest[5]} | Turnover: $${Number(latest[6]).toFixed(2)}`);
      console.log(`   Candles returned: ${candles.length}`);
    } catch (err: any) {
      console.log(`❌ ${symbol}: ${err.message}`);
    }
  }
}

async function verifyTickers() {
  console.log("\n=== 24h Ticker Data ===\n");

  for (const symbol of config.pairs) {
    try {
      const res = await publicClient.getTickers({
        category: "linear",
        symbol,
      });

      if (res.retCode !== 0) {
        console.log(`❌ ${symbol}: ${res.retMsg}`);
        continue;
      }

      const t = res.result.list[0];
      console.log(`📊 ${symbol}`);
      console.log(`   Last: $${t.lastPrice} | 24h Vol: ${t.volume24h} | 24h Turnover: $${Number(t.turnover24h).toFixed(2)}`);
      console.log(`   24h High: $${t.highPrice24h} | 24h Low: $${t.lowPrice24h}`);
      if ("fundingRate" in t) {
        console.log(`   Funding Rate: ${t.fundingRate}`);
      }
    } catch (err: any) {
      console.log(`❌ ${symbol}: ${err.message}`);
    }
  }
}

async function verifyAuth() {
  console.log("\n=== Verifying API Auth (Trade History) ===\n");

  try {
    const res = await authClient.getExecutionList({
      category: "linear",
      limit: 5,
    });

    if (res.retCode !== 0) {
      console.log(`❌ Auth error: ${res.retMsg}`);
      return;
    }

    const trades = res.result.list;
    console.log(`✅ Auth works — ${trades.length} recent executions found`);
    for (const t of trades) {
      console.log(`   ${t.symbol} ${t.side} ${t.execQty} @ $${t.execPrice} (${t.execTime})`);
    }

    if (trades.length === 0) {
      console.log("   No trades yet — this is expected if copy trading hasn't started");
    }
  } catch (err: any) {
    console.log(`❌ Auth failed: ${err.message}`);
  }
}

async function main() {
  await verifyKlineData();
  await verifyTickers();
  await verifyAuth();
  console.log("\n=== Verification Complete ===");
}

main().catch(console.error);
