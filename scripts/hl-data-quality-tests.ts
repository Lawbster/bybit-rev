/** Integration check for the production pulse reader using disposable local files only. */
import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { bookEvidence, observationMetadata } from "../src/hl-data-quality";

async function main() {
  const original = process.cwd(), dir = fs.mkdtempSync(path.join(os.tmpdir(), "hl-quality-test-"));
  const data = path.join(dir, "data"); fs.mkdirSync(data);
  try {
    // DATA_DIR in the reader binds at import. Never point fixtures at production data.
    process.chdir(dir);
    const { computeOnChainFeatures } = await import("../src/bot/shadow-logger");
    const now = Date.UTC(2026, 8, 4, 12), hour = 3600000;
    const write = (name: string, rows: unknown[]) => fs.writeFileSync(path.join(data, name), rows.map(r => JSON.stringify(r)).join("\n") + "\n");
    const book = { timestamp: now - 1000, exchangeTimestamp: now - 120000,
      ...observationMetadata(now - 1000, now - 119000), bestBidAskAreAggregated: true,
      bidBands: { pct_0_25: 1, pct_0_5: 200, pct_2_0: 300 }, askBands: { pct_0_25: 1, pct_0_5: 100, pct_2_0: 400 },
      bidBandsTruncated: { pct_0_25: false, pct_0_5: false, pct_2_0: false },
      askBandsTruncated: { pct_0_25: false, pct_0_5: false, pct_2_0: true },
      bandResolutionTooCoarse: { pct_0_25: true, pct_0_5: false, pct_2_0: false } };
    write("TESTUSDT_ob_bands_hyperliquid.jsonl", [book]);
    write("TESTUSDT_asset_ctx_hyperliquid.jsonl", [4 * hour, hour, 0].map(lag => ({
      timestamp: now - lag - 1000, ...observationMetadata(now - lag - 1000, now - lag - 121000),
      openInterest: 100, markPrice: 100, openInterestValue: 10000, fundingRate: .00001,
    })));
    const pulse = await computeOnChainFeatures("TESTUSDT", now);
    assert.equal(pulse.hlObAgeSec, 120);
    assert.equal(pulse.hlObBid05Usd, 200); assert.equal(pulse.hlObImbalance05, 1 / 3);
    assert.equal(pulse.hlObBid025Usd, null, "coarse band unavailable");
    assert.equal(pulse.hlObImbalance2, null, "one-sided truncated band unavailable");
    assert.equal(pulse.hlAssetAgeSec, 121);
    assert.equal(pulse.hlAsset1hAnchorLagSec, 121);
    assert.equal(pulse.hlAsset4hAnchorLagSec, 121);
    assert.equal(pulse.hlAssetOi1hPct, 0);
    assert.equal(bookEvidence({ ...book, exchangeTimestamp: now + 1 }, now).band("pct_0_5").healthy, false);
    assert.equal(bookEvidence({ ...book, bidBandsTruncated: {} }, now).band("pct_0_5").healthy, false);
    assert.equal(bookEvidence({ ...book, receivedAt: now + 1 }, now).ageSec, null);
    assert.equal(bookEvidence({ ...book, writtenAt: now + 1 }, now).ageSec, null);
  } finally {
    process.chdir(original);
    for (const file of fs.readdirSync(data)) fs.unlinkSync(path.join(data, file));
    fs.rmdirSync(data); fs.rmdirSync(dir);
  }
  console.log("HL data quality tests passed: production pulse source age, anchor age, coarse/truncated/future evidence");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
