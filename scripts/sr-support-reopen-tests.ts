import assert from "assert";
import fs from "fs";
import path from "path";
import type { OnChainFeatures } from "../src/bot/shadow-logger";
import type { SRMemoryZoneHit } from "../src/bot/sr-memory-zones";
import { loadBotConfig } from "../src/bot/bot-config";
import { checkDeepAddStressGuard } from "../src/bot/strategy";
import {
  evaluateHLSupportConfirmation,
  evaluateSRSupportReopen,
  SRSupportReopenActionConfig,
} from "../src/bot/sr-support-reopen";

const ROOT = path.resolve(__dirname, "..");

const config: SRSupportReopenActionConfig = {
  enabled: true,
  minNextDepth: 5,
  supportBufferPct: 1,
  maxOrderBookAgeSec: 30,
  maxTakerAgeSec: 90,
  minTaker15mSamples: 14,
  minTaker1hSamples: 55,
  maxAssetAgeSec: 60,
  maxAssetAnchorLagSec: 120,
};

const support: SRMemoryZoneHit = {
  dist: 0.005,
  lv: {
    price: 67,
    confirmTs: 1_000,
    touches: 3,
    highTouches: 1,
    lowTouches: 2,
    touchData: [],
  },
};

function pulse(overrides: Partial<OnChainFeatures> = {}): OnChainFeatures {
  return {
    hlTaker15m: 1.25,
    hlTaker1h: 1.05,
    hlTaker15mSamples: 15,
    hlTaker1hSamples: 60,
    hlTakerAgeSec: 10,
    hlObImbalance05: 0.25,
    hlObAskBid05Ratio: 0.8,
    hlObAgeSec: 5,
    hlAssetOi1hPct: 0.30,
    hlAssetOi4hPct: 0.40,
    hlAssetAgeSec: 5,
    hlAsset1hAnchorLagSec: 30,
    hlAsset4hAnchorLagSec: 30,
    ...overrides,
  } as OnChainFeatures;
}

function decide(overrides: Partial<Parameters<typeof evaluateSRSupportReopen>[0]> = {}) {
  return evaluateSRSupportReopen({
    contextHealthy: true,
    liveGuardBlocked: true,
    liveGuardReasons: ["bybit funding -0.0100%"],
    fundingStressOnly: true,
    priceDropOk: false,
    nextDepth: 6,
    support,
    pulse: pulse(),
    config,
    ...overrides,
  });
}

{
  const result = decide();
  assert.equal(result.eligible, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.confirmation.buyPressure15m, true);
  assert.equal(result.confirmation.bidWall, true);
  assert.equal(result.confirmation.oiExpansion1h, true);
}

{
  const botConfig = loadBotConfig();
  const positions = new Array(5).fill({}) as any;
  const funding = checkDeepAddStressGuard(positions, false, {
    oiBn4hPct: 1,
    oiHl4hPct: 1,
    fdByNow: -0.00001,
    fdBnNow: 0.00001,
    fdHlNow: 0.00001,
  }, botConfig);
  assert.deepEqual(funding.stressKinds, ["funding"]);

  const oiConfig = {
    ...botConfig,
    deepAddStressGuard: {
      ...botConfig.deepAddStressGuard!,
      anyFundingNegative: false,
      binanceOi4hPctMax: 0,
    },
  };
  const oi = checkDeepAddStressGuard(positions, false, {
    oiBn4hPct: -1,
    oiHl4hPct: 1,
    fdByNow: 0.00001,
    fdBnNow: 0.00001,
    fdHlNow: 0.00001,
  }, oiConfig);
  assert.deepEqual(oi.stressKinds, ["binance_oi"]);
}

{
  const result = evaluateHLSupportConfirmation({
    hlTaker15m: 1.1,
    hlTaker1h: 1.2,
    hlObImbalance05: 0,
    hlObAskBid05Ratio: 0.75,
    hlAssetOi1hPct: 0,
    hlAssetOi4hPct: 0.75,
  });
  assert.equal(result.buyPressure1h, true, "threshold is inclusive and matches replay");
  assert.equal(result.bidWall, true);
  assert.equal(result.oiExpansion4h, true);
}

for (const [name, overrides, blocker] of [
  ["disabled", { config: { ...config, enabled: false } }, "action_disabled"],
  ["context", { contextHealthy: false }, "sr_context_unhealthy"],
  ["guard", { liveGuardBlocked: false }, "deep_stress_guard_not_blocking"],
  ["non-funding stress", { liveGuardReasons: ["HL OI 4h -2.00% <= -1%"], fundingStressOnly: false }, "deep_stress_not_funding_only"],
  ["price drop", { priceDropOk: true }, "not_time_only_add"],
  ["depth", { nextDepth: 4 }, "depth_below_minimum"],
  ["support", { support: null }, "no_confirmed_support"],
  ["distance", { support: { ...support, dist: 0.011 } }, "support_too_far"],
] as Array<[string, Partial<Parameters<typeof evaluateSRSupportReopen>[0]>, string]>) {
  const result = decide(overrides);
  assert.equal(result.eligible, false, `${name} must fail closed`);
  assert.ok(result.blockers.includes(blocker), `${name} blocker missing`);
}

{
  const result = decide({ pulse: pulse({ hlObAgeSec: 31 }) });
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.includes("hl_orderbook_unhealthy"));
}

{
  const result = decide({
    pulse: pulse({
      hlTaker15mSamples: 11,
      hlTaker1hSamples: 54,
      hlTakerAgeSec: 91,
    }),
  });
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.includes("hl_taker_unhealthy"));
}

{
  const result = decide({
    pulse: pulse({
      hlAssetAgeSec: 61,
      hlAsset1hAnchorLagSec: 121,
      hlAsset4hAnchorLagSec: 121,
    }),
  });
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.includes("hl_asset_context_unhealthy"));
}

{
  const result = decide({
    pulse: pulse({ hlTaker15m: 1.19, hlTaker1h: 1.19 }),
  });
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.includes("hl_buy_pressure_absent"));
}

{
  const result = decide({
    pulse: pulse({ hlObImbalance05: 0.19, hlObAskBid05Ratio: 0.76 }),
  });
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.includes("hl_bid_wall_absent"));
}

{
  const result = decide({
    pulse: pulse({ hlAssetOi1hPct: 0.24, hlAssetOi4hPct: 0.74 }),
  });
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.includes("hl_oi_expansion_absent"));
}

{
  const source = fs.readFileSync(path.join(ROOT, "src", "bot", "index.ts"), "utf8");
  const decisionAt = source.indexOf("let srSupportReopenDecision");
  const outerTrendAt = source.indexOf("// Trend-break gate (primary)", decisionAt);
  const revalidationAt = source.indexOf("S/R support reopen revalidation failed", outerTrendAt);
  const actualOpenAt = source.indexOf("const level = s.positions.length;", revalidationAt);
  const openAt = source.indexOf("// ── Open new position", outerTrendAt);
  assert.ok(decisionAt >= 0 && outerTrendAt > decisionAt && revalidationAt > outerTrendAt && actualOpenAt > revalidationAt,
    "support reopen must run before, not bypass, the ordinary outer gates");
  assert.ok(source.includes("deepStress.blocked && !srSupportReopenDecision?.eligible"),
    "only an eligible exact decision may bypass the deep stress block");
}

{
  const liveConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "bot-config.json"), "utf8"));
  assert.equal(liveConfig.srSupportReopenAction.enabled, true);
  assert.equal(liveConfig.srSupportReopenAction.minNextDepth, 5);
  assert.equal(liveConfig.srSupportReopenAction.supportBufferPct, 1);
}

console.log("S/R support reopen tests passed");
