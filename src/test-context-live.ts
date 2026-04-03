// ─────────────────────────────────────────────
// Local test: LiveContextManager with real Bybit data
// No API keys needed — getCandles uses public endpoints.
//
// Run: npx ts-node src/test-context-live.ts [SYMBOL]
// ─────────────────────────────────────────────

import { DryRunExecutor } from "./bot/executor";
import { LiveContextManager } from "./bot/context-manager";
import { BotLogger } from "./bot/monitor";

async function main() {
  const symbol = process.argv[2] || "HYPEUSDT";

  const logger  = new BotLogger("logs");
  const exec    = new DryRunExecutor(logger);
  const ctxMgr  = new LiveContextManager(exec, symbol);

  console.log(`\n[test] Initialising context manager for ${symbol}...`);
  await ctxMgr.init();
  console.log(`[test] Window size after init: ${ctxMgr.windowSize()} candles`);

  const ctx = ctxMgr.getContext();
  console.log(`\n[test] === Context snapshot ===`);
  console.log(`  Symbol:    ${ctx.symbol}`);
  console.log(`  Price:     $${ctx.price}`);
  console.log(`  AsOf:      ${new Date(ctx.asOfTs).toISOString().slice(0, 16)} UTC`);
  console.log(`  AssetClass: ${ctx.assetClass}`);
  console.log(`  Grade:     ${ctx.confluenceGrade}  Score: ${ctx.confluenceScore}/100`);
  console.log(`  Setups:    ${ctx.activeSetups.join(", ") || "none"}`);
  console.log(`  WeekVWAP:  $${ctx.weeklyVwap.toFixed(4)}  (${ctx.weeklyVwapDistPct >= 0 ? "+" : ""}${ctx.weeklyVwapDistPct}%)`);

  for (const tf of ["1D", "4H", "1H"] as const) {
    const z = ctx.zoneStack[tf];
    if (z) {
      const status = z.isFreshTouch ? "FRESH TOUCH" : `last ${z.hoursSinceLastInteraction.toFixed(0)}h ago`;
      console.log(`  Zone ${tf}:  $${z.low.toFixed(4)}–$${z.high.toFixed(4)}  mid=$${z.mid.toFixed(4)}  t=${z.touches}  [${status}]`);
    }
  }

  // Simulate a poll tick
  console.log(`\n[test] Simulating refresh (as in a poll tick)...`);
  await ctxMgr.refresh();
  const ctx2 = ctxMgr.getContext();
  console.log(`[test] After refresh: price=$${ctx2.price}  grade=${ctx2.confluenceGrade}  score=${ctx2.confluenceScore}`);
  console.log(`[test] Window size:   ${ctxMgr.windowSize()} candles`);

  console.log(`\n[test] Done. This is what the bot would see on each poll tick.\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
