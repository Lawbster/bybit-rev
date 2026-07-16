import assert from "assert";
import {
  advanceHlShortShadowPosition,
  computeHlShortBreakdownFeatures,
  createHlShortShadowPosition,
  evaluateHlShortBreakdownFeaturePolicy,
  HL_SHORT_BREAKDOWN_POLICY,
  HlShortBookSample,
  HlShortMinuteCandle,
  HlShortTakerMinute,
} from "../src/bot/hl-short-breakdown-policy";

const MINUTE = 60_000;
const T = Date.UTC(2026, 4, 21, 1, 45);

function candles(): HlShortMinuteCandle[] {
  const rows: HlShortMinuteCandle[] = [];
  for (let i = 30; i >= 1; i--) {
    const timestamp = T - i * MINUTE;
    const current = timestamp >= T - 15 * MINUTE;
    const progress = current ? (15 - i) / 14 : 0;
    const close = current ? 100 - progress : 100;
    rows.push({
      timestamp,
      open: current && timestamp === T - 15 * MINUTE ? 100.2 : close + 0.05,
      high: close + 0.2,
      low: current ? close - 0.2 : 99.7,
      close,
    });
  }
  return rows;
}

function taker(): HlShortTakerMinute[] {
  return Array.from({ length: 15 }, (_, index) => ({
    timestamp: T - (15 - index) * MINUTE,
    buyNotional: 60,
    sellNotional: 100,
  }));
}

function book(): HlShortBookSample[] {
  const rows: HlShortBookSample[] = [];
  for (let index = 15; index >= 1; index--) {
    const timestamp = T - index * MINUTE + 30_000;
    rows.push({ timestamp, imbalance05: index <= 5 ? -0.20 : 0.05 });
  }
  return rows;
}

const base = computeHlShortBreakdownFeatures({
  decisionTs: T,
  candles: candles(),
  taker: taker(),
  book: book(),
  asset: [{ timestamp: T - 30_000 }],
});
assert.equal(base.ready, true);
assert.equal(base.fired, true);
assert.equal(base.price.continuousMinutes, 30);
assert.ok((base.price.return15mPct ?? 0) <= -0.20);
assert.equal(base.price.red15m, true);
assert.equal(base.price.brokePrevious15mLow, true);
assert.equal(base.pulse.hlTakerMinutes, 15);
assert.equal(base.pulse.hlBookMinutes, 15);
assert.ok((base.pulse.hlBookDelta ?? 0) < -0.15);

// Boundary rows stamped exactly T were not available strictly before the decision.
const withFutureBoundary = computeHlShortBreakdownFeatures({
  decisionTs: T,
  candles: candles(),
  taker: [...taker(), { timestamp: T, buyNotional: 1_000_000, sellNotional: 1 }],
  book: [...book(), { timestamp: T, imbalance05: 1 }],
  asset: [{ timestamp: T - 30_000 }, { timestamp: T }],
});
assert.deepEqual(withFutureBoundary, base, "rows stamped at T must not affect a decision at T");

const incomplete = computeHlShortBreakdownFeatures({
  decisionTs: T,
  candles: candles(),
  taker: taker().slice(0, 11),
  book: book(),
  asset: [{ timestamp: T - 30_000 }],
});
assert.equal(incomplete.ready, false);
assert.equal(incomplete.fired, false);
assert.ok(incomplete.blockers.includes("hl_taker_coverage_incomplete"));

const exactThreshold = evaluateHlShortBreakdownFeaturePolicy({
  priceReady: true,
  red15m: true,
  brokePrevious15mLow: true,
  return15mPct: HL_SHORT_BREAKDOWN_POLICY.minimumReturn15mPct,
  hlTaker15mRatio: HL_SHORT_BREAKDOWN_POLICY.maximumHlTaker15mRatio,
  hlTakerMinutes: 15,
  hlBook5mImbalance: HL_SHORT_BREAKDOWN_POLICY.maximumHlBook5mImbalance,
  hlBookPrior10mImbalance: 0.1,
  hlBookDelta: HL_SHORT_BREAKDOWN_POLICY.maximumHlBookDelta,
  hlBookMinutes: 15,
  assetAgeMs: 1,
});
assert.equal(exactThreshold.fired, false, "taker/book rules are strict inequalities exactly as researched");

{
  const position = createHlShortShadowPosition("decision_open", T, 100);
  const ambiguous = advanceHlShortShadowPosition(position, {
    timestamp: T,
    open: 100,
    high: 104.1,
    low: 97.9,
    close: 100,
  });
  assert.equal(ambiguous.close?.outcome, "stop", "short intrabar ambiguity is stop-first");
  assert.ok(Math.abs((ambiguous.close?.pnlPctAfterFees ?? 0) - (-4.11)) < 1e-9);
}

{
  let position = createHlShortShadowPosition("delay_1m_open", T, 100);
  for (let i = 0; i < 12 * 60; i++) {
    const advanced = advanceHlShortShadowPosition(position, {
      timestamp: T + i * MINUTE,
      open: 100,
      high: 100.1,
      low: 99.9,
      close: 99.5,
    });
    position = advanced.position;
    if (i < 12 * 60 - 1) assert.equal(advanced.close, null);
    else {
      assert.equal(advanced.close?.outcome, "timeout");
      assert.ok(Math.abs((advanced.close?.pnlPctAfterFees ?? 0) - 0.39) < 1e-9);
      assert.ok(Math.abs((advanced.close?.pnlPctStressFees ?? 0) - 0.30) < 1e-9);
    }
  }
}

console.log("HL short breakdown policy tests passed");
