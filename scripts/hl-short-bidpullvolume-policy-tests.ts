import assert from "assert";
import {
  advanceHlShortBidPullVolumeShadowPosition,
  computeHlShortBidPullVolumeFeatures,
  createHlShortBidPullVolumeShadowPosition,
  HL_SHORT_BIDPULLVOLUME_CANDIDATE,
  HL_SHORT_BIDPULLVOLUME_POLICY,
  HL_SHORT_BIDPULLVOLUME_POLICY_SIGNATURE,
  HL_SHORT_BIDPULLVOLUME_POLICY_VERSION,
} from "../src/bot/hl-short-bidpullvolume-policy";
import {
  HlShortBookSample,
  HlShortMinuteCandle,
  HlShortTakerMinute,
} from "../src/bot/hl-short-breakdown-policy";

const MINUTE = 60_000;
const T = Date.UTC(2026, 4, 21, 1, 45);
const BASELINE_MINUTES = HL_SHORT_BIDPULLVOLUME_POLICY.volumeBaselineBars * 15;

assert.equal(HL_SHORT_BIDPULLVOLUME_POLICY_VERSION, 1);
assert.equal(HL_SHORT_BIDPULLVOLUME_CANDIDATE, "hl_bid_pull_volume");
assert.equal(HL_SHORT_BIDPULLVOLUME_POLICY.takeProfitPct, 1.5);
assert.equal(HL_SHORT_BIDPULLVOLUME_POLICY.stopLossPct, 4);
assert.equal(HL_SHORT_BIDPULLVOLUME_POLICY.maximumHoldMs, 4 * 60 * 60_000);
assert.ok(HL_SHORT_BIDPULLVOLUME_POLICY_SIGNATURE.includes("|v1|"));
assert.ok(HL_SHORT_BIDPULLVOLUME_POLICY_SIGNATURE.includes("|vol15>1.25|"));
assert.ok(HL_SHORT_BIDPULLVOLUME_POLICY_SIGNATURE.includes("|tp1.5|"));

// 24h of baseline candles at volume 100/min, then a red current 15m bar at
// volume 200/min -> volumeRatio15 = (200*15)/(100*15) = 2.
function candles(overrides: { currentVolume?: number; greenCurrent?: boolean } = {}): HlShortMinuteCandle[] {
  const rows: HlShortMinuteCandle[] = [];
  const currentVolume = overrides.currentVolume ?? 200;
  for (let i = BASELINE_MINUTES + 15; i >= 16; i--) {
    const timestamp = T - i * MINUTE;
    rows.push({ timestamp, open: 100.05, high: 100.2, low: 99.7, close: 100, volume: 100 });
  }
  for (let i = 15; i >= 1; i--) {
    const timestamp = T - i * MINUTE;
    const progress = (15 - i) / 14;
    const close = overrides.greenCurrent ? 100 + progress : 100 - progress;
    rows.push({
      timestamp,
      open: i === 15 ? (overrides.greenCurrent ? 99.8 : 100.2) : close + (overrides.greenCurrent ? -0.05 : 0.05),
      high: close + 0.2,
      low: close - 0.2,
      close,
      volume: currentVolume,
    });
  }
  return rows;
}

function taker(ratioBuy = 60): HlShortTakerMinute[] {
  return Array.from({ length: 15 }, (_, index) => ({
    timestamp: T - (15 - index) * MINUTE,
    buyNotional: ratioBuy,
    sellNotional: 100,
  }));
}

function book(last5 = -0.20, prior10 = 0.05): HlShortBookSample[] {
  const rows: HlShortBookSample[] = [];
  for (let index = 15; index >= 1; index--) {
    const timestamp = T - index * MINUTE + 30_000;
    rows.push({ timestamp, imbalance05: index <= 5 ? last5 : prior10 });
  }
  return rows;
}

const asset = [{ timestamp: T - 30_000 }];

const base = computeHlShortBidPullVolumeFeatures({ decisionTs: T, candles: candles(), taker: taker(), book: book(), asset });
assert.equal(base.candidate, "hl_bid_pull_volume");
assert.equal(base.ready, true, `ready blockers: ${base.blockers.join(",")}`);
assert.equal(base.fired, true, `fire blockers: ${base.blockers.join(",")}`);
assert.equal(base.price.currentBarMinutes, 15);
assert.equal(base.price.baselineMinutes, BASELINE_MINUTES);
assert.ok(Math.abs((base.price.volumeRatio15 ?? 0) - 2) < 1e-9);
assert.ok(Math.abs((base.price.baselineMeanVolume15m ?? 0) - 1500) < 1e-9);
assert.equal(base.price.red15m, true);
assert.ok((base.pulse.hlBookDelta ?? 0) < -0.15);
assert.ok((base.pulse.hlTaker15mRatio ?? 1) < 0.9);

// Green current bar must not fire.
const green = computeHlShortBidPullVolumeFeatures({ decisionTs: T, candles: candles({ greenCurrent: true }), taker: taker(), book: book(), asset });
assert.equal(green.ready, true);
assert.equal(green.fired, false);
assert.ok(green.blockers.includes("not_red_15m"));

// Volume at exactly the baseline mean (ratio 1) must not fire; the threshold is strict.
const flatVolume = computeHlShortBidPullVolumeFeatures({ decisionTs: T, candles: candles({ currentVolume: 100 }), taker: taker(), book: book(), asset });
assert.equal(flatVolume.fired, false);
assert.ok(flatVolume.blockers.includes("volume_not_expanding"));

// Ratio exactly at 1.25 must not fire (strict >).
const edgeVolume = computeHlShortBidPullVolumeFeatures({ decisionTs: T, candles: candles({ currentVolume: 125 }), taker: taker(), book: book(), asset });
assert.equal(edgeVolume.fired, false);
assert.ok(edgeVolume.blockers.includes("volume_not_expanding"));

// Buy-dominant taker flow must not fire.
const buyFlow = computeHlShortBidPullVolumeFeatures({ decisionTs: T, candles: candles(), taker: taker(95), book: book(), asset });
assert.equal(buyFlow.fired, false);
assert.ok(buyFlow.blockers.includes("hl_taker_not_sell_dominant"));

// Non-deteriorating book must not fire.
const stableBook = computeHlShortBidPullVolumeFeatures({ decisionTs: T, candles: candles(), taker: taker(), book: book(0.0, 0.05), asset });
assert.equal(stableBook.fired, false);
assert.ok(stableBook.blockers.includes("hl_book_not_deteriorating"));

// A one-minute hole anywhere inside the 24h baseline fails closed.
const holed = candles().filter(candle => candle.timestamp !== T - 500 * MINUTE);
const holedFeatures = computeHlShortBidPullVolumeFeatures({ decisionTs: T, candles: holed, taker: taker(), book: book(), asset });
assert.equal(holedFeatures.ready, false);
assert.ok(holedFeatures.blockers.includes("volume_baseline_incomplete"));
assert.equal(holedFeatures.fired, false);

// A candle without volume inside the baseline also fails closed.
const noVolume = candles().map(candle => candle.timestamp === T - 500 * MINUTE ? { ...candle, volume: undefined } : candle);
const noVolumeFeatures = computeHlShortBidPullVolumeFeatures({ decisionTs: T, candles: noVolume, taker: taker(), book: book(), asset });
assert.equal(noVolumeFeatures.ready, false);
assert.ok(noVolumeFeatures.blockers.includes("volume_baseline_incomplete"));

// Boundary rows stamped exactly T were not available strictly before the decision.
const withFutureBoundary = computeHlShortBidPullVolumeFeatures({
  decisionTs: T,
  candles: candles(),
  taker: [...taker(), { timestamp: T, buyNotional: 1_000_000, sellNotional: 1 }],
  book: [...book(), { timestamp: T, imbalance05: 1 }],
  asset,
});
assert.equal(withFutureBoundary.fired, true, "rows stamped at decisionTs must be excluded");
assert.ok(Math.abs((withFutureBoundary.pulse.hlTaker15mRatio ?? 0) - 0.6) < 1e-9);

// Stale asset context blocks readiness.
const staleAsset = computeHlShortBidPullVolumeFeatures({ decisionTs: T, candles: candles(), taker: taker(), book: book(), asset: [{ timestamp: T - 10 * MINUTE }] });
assert.equal(staleAsset.ready, false);
assert.ok(staleAsset.blockers.includes("hl_asset_context_stale"));

// Shadow position mechanics: TP 1.5 below entry, stop 4 above, 4h expiry.
const position = createHlShortBidPullVolumeShadowPosition("decision_open", T, 100);
assert.ok(Math.abs(position.tpPrice - 98.5) < 1e-9);
assert.ok(Math.abs(position.stopPrice - 104) < 1e-9);
assert.equal(position.expiresAt, T + 4 * 60 * 60_000);

// Stop is checked before TP inside one minute.
const both = advanceHlShortBidPullVolumeShadowPosition(position, { timestamp: T, open: 100, high: 104.5, low: 98, close: 99 });
assert.equal(both.close?.outcome, "stop");
assert.ok(Math.abs((both.close?.grossPnlPct ?? 0) - (-4)) < 1e-9);

// TP fill.
const tpRun = createHlShortBidPullVolumeShadowPosition("decision_open", T, 100);
const tpHit = advanceHlShortBidPullVolumeShadowPosition(tpRun, { timestamp: T, open: 100, high: 100.5, low: 98.2, close: 98.6 });
assert.equal(tpHit.close?.outcome, "tp");
assert.ok(Math.abs((tpHit.close?.grossPnlPct ?? 0) - 1.5) < 1e-9);
assert.ok(Math.abs((tpHit.close?.pnlPctAfterFees ?? 0) - (1.5 - 0.11)) < 1e-9);
assert.ok(Math.abs((tpHit.close?.pnlPctStressFees ?? 0) - (1.5 - 0.20)) < 1e-9);

// Timeout at the 4h boundary closes at candle close.
let timeoutPosition = createHlShortBidPullVolumeShadowPosition("decision_open", T, 100);
const lastCandleTs = T + 4 * 60 * 60_000 - MINUTE;
const beforeTimeout = advanceHlShortBidPullVolumeShadowPosition(timeoutPosition, { timestamp: lastCandleTs - MINUTE, open: 100, high: 100.1, low: 99.9, close: 100 });
assert.equal(beforeTimeout.close, null);
timeoutPosition = beforeTimeout.position;
const atTimeout = advanceHlShortBidPullVolumeShadowPosition(timeoutPosition, { timestamp: lastCandleTs, open: 100, high: 100.1, low: 99.9, close: 100.05 });
assert.equal(atTimeout.close?.outcome, "timeout");
assert.ok(Math.abs((atTimeout.close?.exitPrice ?? 0) - 100.05) < 1e-9);
assert.equal(atTimeout.close?.holdMinutes, 240);

console.log("hl-short-bidpullvolume-policy-tests passed");
