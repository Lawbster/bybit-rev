import assert from "assert";
import {
  computeHlpVaultObservationContext,
  HLP_VAULT_DRAIN_24H_FROZEN_MEDIAN_PCT,
  HlpVaultSample,
} from "../src/bot/hlp-vault-context";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const T = Date.UTC(2026, 7, 13, 12, 0, 0);

const samples: HlpVaultSample[] = [
  { timestamp: T - 24 * HOUR - 5 * MINUTE, apr: 0.10, maxDistributable: 100_000_000 },
  { timestamp: T - 4 * HOUR - 5 * MINUTE, apr: 0.08, maxDistributable: 98_000_000 },
  { timestamp: T - 5 * MINUTE, apr: 0.05, maxDistributable: 95_000_000 },
  { timestamp: T, apr: 99, maxDistributable: 999_000_000 },
];

const context = computeHlpVaultObservationContext(samples, T);
assert.equal(context.ready, true);
assert.equal(context.currentTs, T - 5 * MINUTE);
assert.equal(context.apr, 0.05);
assert.ok(Math.abs(context.maxDistributableChange4hPct! - (-3.061224489795918)) < 1e-9);
assert.equal(context.maxDistributableChange24hPct, -5);
assert.equal(context.drain24hBelowFrozenMedian, true);
assert.equal(HLP_VAULT_DRAIN_24H_FROZEN_MEDIAN_PCT, -0.41);

const incomplete = computeHlpVaultObservationContext([
  { timestamp: T - 5 * MINUTE, apr: 0.05, maxDistributable: 95_000_000 },
], T);
assert.equal(incomplete.ready, false);
assert.deepEqual(incomplete.blockers, ["anchor_4h_missing_or_stale", "anchor_24h_missing_or_stale"]);
assert.equal(incomplete.drain24hBelowFrozenMedian, null);

const stale = computeHlpVaultObservationContext([
  { timestamp: T - 31 * MINUTE, apr: 0.05, maxDistributable: 95_000_000 },
], T);
assert.equal(stale.ready, false);
assert.ok(stale.blockers.includes("current_missing_or_stale"));

console.log("HLP vault context tests passed");
