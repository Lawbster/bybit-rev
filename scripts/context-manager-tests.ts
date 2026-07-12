import assert from "assert";
import { Candle } from "../src/fetch-candles";
import { LiveContextManager } from "../src/bot/context-manager";

const WINDOW_SIZE = 40_320;
const FIVE_MIN_MS = 5 * 60 * 1000;
const NOW = FIVE_MIN_MS * 50_000 + 12_345;

function candle(timestamp: number, close: number): Candle {
  return {
    timestamp,
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: close * 10,
    turnover: close * close * 10,
  };
}

function managerWith(candles: Candle[]): LiveContextManager {
  const manager = new LiveContextManager({} as any, "TESTUSDT");
  (manager as any).candles = candles.map(row => ({ ...row }));
  return manager;
}

function managerWithExecutor(candles: Candle[], executor: any): LiveContextManager {
  const manager = new LiveContextManager(executor, "TESTUSDT");
  (manager as any).candles = candles.map(row => ({ ...row }));
  return manager;
}

function recentUniverse(count: number, includeForming = true): Candle[] {
  const formingTs = Math.floor(NOW / FIVE_MIN_MS) * FIVE_MIN_MS;
  const firstTs = formingTs - (count - (includeForming ? 1 : 0)) * FIVE_MIN_MS;
  return Array.from({ length: count }, (_, index) => candle(firstTs + index * FIVE_MIN_MS, index + 1));
}

function pagedExecutor(universe: Candle[], calls: number[]): any {
  return {
    getCandles: async (_symbol: string, _interval: string, limit: number, endMs?: number) => {
      calls.push(endMs ?? Number.MAX_SAFE_INTEGER);
      return universe
        .filter(row => row.timestamp <= (endMs ?? Number.MAX_SAFE_INTEGER))
        .slice(-limit)
        .map(row => ({ ...row }));
    },
  };
}

function merge(manager: LiveContextManager, fresh: Candle[]): Candle[] {
  (manager as any)._merge(fresh);
  return manager.getCandles();
}

function testFormingCandleIsReplacedByFinalCandle(): void {
  const forming = candle(1_000, 10);
  const final = { ...candle(1_000, 11), high: 12, low: 9, volume: 500 };
  const rows = merge(managerWith([forming]), [final]);

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], final);
}

function testNewCandlesRemainSorted(): void {
  const rows = merge(managerWith([candle(1_000, 10)]), [
    candle(3_000, 30),
    candle(2_000, 20),
  ]);

  assert.deepEqual(rows.map(row => row.timestamp), [1_000, 2_000, 3_000]);
}

function testLastFreshDuplicateWinsWithoutDuplicateTimestamp(): void {
  const rows = merge(managerWith([]), [
    candle(2_000, 20),
    candle(2_000, 21),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].timestamp, 2_000);
  assert.equal(rows[0].close, 21);
}

function testWindowKeepsMostRecentCandles(): void {
  const existing = Array.from({ length: WINDOW_SIZE }, (_, index) => candle(index, index + 1));
  const rows = merge(managerWith(existing), [candle(WINDOW_SIZE, WINDOW_SIZE + 1)]);

  assert.equal(rows.length, WINDOW_SIZE);
  assert.equal(rows[0].timestamp, 1);
  assert.equal(rows[rows.length - 1].timestamp, WINDOW_SIZE);
}

async function testRefreshUpsertsAndInvalidatesCachedContext(): Promise<void> {
  const forming = candle(5_000, 50);
  const final = { ...candle(5_000, 55), high: 57, low: 48 };
  const executor = { getCandles: async () => [final] };
  const manager = new LiveContextManager(executor as any, "TESTUSDT");
  (manager as any).candles = [forming];
  (manager as any).lastContext = { cached: true };

  await manager.refresh();

  assert.deepEqual(manager.getCandles(), [final]);
  assert.equal((manager as any).lastContext, null);
}

async function testCurrentContinuousSeedNeedsOneBackfillPage(): Promise<void> {
  const universe = recentUniverse(WINDOW_SIZE);
  const calls: number[] = [];
  const manager = managerWithExecutor(universe, pagedExecutor(universe, calls));
  const status = await (manager as any)._hydrateContinuousWindow(NOW, 0);

  assert.equal(status.stoppedReason, "window_complete");
  assert.equal(status.pagesFetched, 1);
  assert.equal(calls.length, 1);
  assert.equal(manager.getClosedCoverageStatus(NOW, 14).healthy, true);
}

async function testOldSeedIsPagedIntoContinuousWindow(): Promise<void> {
  const universe = recentUniverse(WINDOW_SIZE);
  const staleSeed = universe.slice(0, 9_000);
  const calls: number[] = [];
  const manager = managerWithExecutor(staleSeed, pagedExecutor(universe, calls));
  const status = await (manager as any)._hydrateContinuousWindow(NOW, 0);
  const rows = manager.getCandles();

  assert.equal(status.stoppedReason, "window_complete");
  assert.ok(status.pagesFetched > 1);
  assert.equal(manager.getClosedCoverageStatus(NOW, 14).healthy, true);
  assert.equal(rows.length, WINDOW_SIZE);
  assert.deepEqual(rows.map(row => row.timestamp), [...rows].map(row => row.timestamp).sort((a, b) => a - b));
  assert.equal(new Set(rows.map(row => row.timestamp)).size, rows.length);
}

function testCoverageRejectsMissingMiddleBar(): void {
  const rows = recentUniverse(4_100).filter((_, index) => index !== 2_000);
  const manager = managerWith(rows);
  const status = manager.getClosedCoverageStatus(NOW, 14);

  assert.equal(status.healthy, false);
  assert.equal(status.actualContinuousBars, 2_098);
  assert.ok(status.reason?.includes("missing 5m candle"));
}

async function testBackfillStopsOnNoProgress(): Promise<void> {
  const latestOnly = recentUniverse(1_000);
  const manager = managerWithExecutor([], {
    getCandles: async () => latestOnly.map(row => ({ ...row })),
  });
  const status = await (manager as any)._hydrateContinuousWindow(NOW, 0);

  assert.equal(status.stoppedReason, "no_progress");
  assert.equal(status.pagesFetched, 2);
  assert.equal(manager.getClosedCoverageStatus(NOW, 14).healthy, false);
}

async function testBackfillApiErrorLeavesCoverageUnhealthy(): Promise<void> {
  const latestOnly = recentUniverse(1_000);
  let calls = 0;
  const manager = managerWithExecutor([], {
    getCandles: async () => {
      calls++;
      if (calls === 1) return latestOnly.map(row => ({ ...row }));
      throw new Error("synthetic rate limit");
    },
  });
  const status = await (manager as any)._hydrateContinuousWindow(NOW, 0);

  assert.equal(status.stoppedReason, "api_error");
  assert.equal(status.pagesFetched, 1);
  assert.equal(status.error, "synthetic rate limit");
  assert.equal(manager.getClosedCoverageStatus(NOW, 14).healthy, false);
}

function testFormingBarIsExcludedFromClosedCoverage(): void {
  const rows = recentUniverse(2);
  rows[rows.length - 1].close = 999;
  const manager = managerWith(rows);
  const oneBarDays = FIVE_MIN_MS / 86400000;
  const status = manager.getClosedCoverageStatus(NOW, oneBarDays);

  assert.equal(status.healthy, true);
  assert.equal(status.actualContinuousBars, 1);
  assert.notEqual(manager.getCandles().at(-1)?.timestamp, status.latestClosedTs);
}

async function main(): Promise<void> {
  testFormingCandleIsReplacedByFinalCandle();
  testNewCandlesRemainSorted();
  testLastFreshDuplicateWinsWithoutDuplicateTimestamp();
  testWindowKeepsMostRecentCandles();
  await testRefreshUpsertsAndInvalidatesCachedContext();
  await testCurrentContinuousSeedNeedsOneBackfillPage();
  await testOldSeedIsPagedIntoContinuousWindow();
  testCoverageRejectsMissingMiddleBar();
  await testBackfillStopsOnNoProgress();
  await testBackfillApiErrorLeavesCoverageUnhealthy();
  testFormingBarIsExcludedFromClosedCoverage();
  console.log("context manager tests passed");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
