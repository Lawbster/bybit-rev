import assert from "assert";
import {
  BoundaryAwareCandleCache,
  candleBoundaryRefreshAt,
  canReuseCandleCache,
  CANDLE_CLOSE_GRACE_MS,
} from "../src/bot/candle-cache-policy";

type Row = { timestamp: number; close: number };

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const BAR_START = Date.parse("2026-07-21T04:00:00Z");
const BAR_CLOSE = BAR_START + FOUR_HOURS;

function cache(candles: Row[], fetchedAt: number): BoundaryAwareCandleCache<Row> {
  return {
    candles,
    fetchedAt,
    refreshAt: candleBoundaryRefreshAt(candles, fetchedAt, FOUR_HOURS),
  };
}

function testEmptyCacheIsNeverReusable(): void {
  assert.equal(canReuseCandleCache(cache([], BAR_START), BAR_START, FOUR_HOURS), false);
}

function testOrdinaryTtlStillApplies(): void {
  const completed = cache([{ timestamp: BAR_START - FOUR_HOURS, close: 62 }], BAR_START + 60_000);
  assert.equal(completed.refreshAt, null);
  assert.equal(canReuseCandleCache(completed, completed.fetchedAt + FOUR_HOURS - 1, FOUR_HOURS), true);
  assert.equal(canReuseCandleCache(completed, completed.fetchedAt + FOUR_HOURS, FOUR_HOURS), false);
}

function testActiveCandleForcesBoundaryRefresh(): void {
  const fetchedAt = BAR_CLOSE - 60_000;
  const partial = cache([{ timestamp: BAR_START, close: 62.75 }], fetchedAt);

  assert.equal(partial.refreshAt, BAR_CLOSE + CANDLE_CLOSE_GRACE_MS);
  assert.equal(canReuseCandleCache(partial, BAR_CLOSE + CANDLE_CLOSE_GRACE_MS - 1, FOUR_HOURS), true);
  assert.equal(canReuseCandleCache(partial, BAR_CLOSE + CANDLE_CLOSE_GRACE_MS, FOUR_HOURS), false);
}

function testJuly21PartialCannotBecomeCompletedEvidence(): void {
  let calls = 0;
  let state: BoundaryAwareCandleCache<Row> = { candles: [], fetchedAt: 0, refreshAt: null };
  const fetch = (now: number): Row[] => {
    if (!canReuseCandleCache(state, now, FOUR_HOURS)) {
      calls++;
      const candles = [{ timestamp: BAR_START, close: calls === 1 ? 62.75 : 62.939 }];
      state = cache(candles, now);
    }
    return state.candles;
  };

  assert.equal(fetch(BAR_CLOSE - 60_000)[0].close, 62.75);
  assert.equal(fetch(BAR_CLOSE + CANDLE_CLOSE_GRACE_MS - 1)[0].close, 62.75);
  assert.equal(fetch(BAR_CLOSE + CANDLE_CLOSE_GRACE_MS)[0].close, 62.939);
  assert.equal(calls, 2);
}

function testNewestTimestampWinsEvenIfRowsAreUnsorted(): void {
  const fetchedAt = BAR_CLOSE - 60_000;
  const rows: Row[] = [
    { timestamp: BAR_START, close: 62.75 },
    { timestamp: BAR_START - FOUR_HOURS, close: 62.5 },
  ];
  const refreshAt = candleBoundaryRefreshAt(rows, fetchedAt, FOUR_HOURS);
  assert.equal(refreshAt, BAR_CLOSE + CANDLE_CLOSE_GRACE_MS);
}

testEmptyCacheIsNeverReusable();
testOrdinaryTtlStillApplies();
testActiveCandleForcesBoundaryRefresh();
testJuly21PartialCannotBecomeCompletedEvidence();
testNewestTimestampWinsEvenIfRowsAreUnsorted();

console.log("candle cache policy tests passed");
