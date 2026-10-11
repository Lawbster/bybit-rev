import assert from "assert";
import { Candle } from "../src/fetch-candles";
import { LiveContextManager } from "../src/bot/context-manager";
import { BoundedRefresh } from "../src/bot/bounded-refresh";

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

async function testInterruptedRequiredHistoryResumesWithoutReload(): Promise<void> {
  let at = NOW, loads = 0;
  const realNow = Date.now; Date.now = () => at;
  try {
    const universe = recentUniverse(45000), calls: number[] = [];
    const get = pagedExecutor(universe, calls).getCandles;
    let count = 0;
    const manager = managerWithExecutor([], { getCandles: (...args: any[]) => {
      if (++count === 5) throw Error('fixture API unavailable');
      return get(...args);
    } });
    (manager as any)._loadSeed = () => { loads++; return universe.slice(0, 40320); };
    await manager.init();
    assert.equal(manager.getHydrationStatus().stoppedReason, 'api_error');
    assert.equal(manager.getHydrationStatus().pagesFetched, 4);
    assert(manager.getClosedCoverageStatus(at, 6 / 24).healthy);
    const before = manager.getClosedCoverageStatus(at, 14);
    assert.equal(before.actualContinuousBars, 3999); assert.equal(before.healthy, false);
    const keep = manager.getCandles().at(-2)!;
    at += 30000; // respect failed-request backoff
    const after = await manager.repairClosedCoverage(at, 14);
    assert(after.healthy); assert.equal(loads, 1); assert.equal(count, 6);
    assert.equal(calls.at(-1), before.firstMissingTs! + FIVE_MIN_MS - 1);
    assert.deepEqual(manager.getCandles().find(c => c.timestamp === keep.timestamp), keep);
    await manager.repairClosedCoverage(at, 14); assert.equal(count, 6); // already covered: no REST
  } finally { Date.now = realNow; }
}

async function testRepairTargetsInteriorGapAndRejectsNoProgress(): Promise<void> {
  const universe = recentUniverse(5000), calls: number[] = [], gap = universe[2600].timestamp;
  const manager = managerWithExecutor(universe.filter(c => c.timestamp !== gap), pagedExecutor(universe, calls));
  await manager.repairClosedCoverage(NOW, 14);
  assert.equal(calls[0], gap + FIVE_MIN_MS - 1); assert(manager.getClosedCoverageStatus(NOW, 14).healthy);
  const broken = managerWithExecutor(universe.slice(-1000), { getCandles: async () => [] });
  await assert.rejects(broken.repairClosedCoverage(NOW, 14), /no progress/);
  assert.equal(broken.getClosedCoverageStatus(NOW, 14).healthy, false);
  assert.throws(() => broken.repairClosedCoverage(NOW, 200), /horizon/);
}

async function testRepairTimeoutRetainsSingleFlightAndCloseEvidence(): Promise<void> {
  const realNow = Date.now; let at = NOW, count = 0;
  Date.now = () => at;
  try {
    const universe = recentUniverse(5000), latest = universe.at(-2)!, forming = universe.at(-1)!;
    let release!: (rows: Candle[]) => void;
    const manager = managerWithExecutor(universe.filter(c => c.timestamp !== latest.timestamp && c.timestamp !== forming.timestamp), {
      getCandles: () => { count++; return new Promise<Candle[]>(resolve => { release = resolve; }); },
    });
    (manager as any).requests = new BoundedRefresh<void>(15, 0);
    const a = manager.repairClosedCoverage(at, 14), b = manager.repairClosedCoverage(at, 14);
    assert.strictEqual(a, b);
    await assert.rejects(a, /timeout/); assert(manager.getRefreshHealth().pending);
    await assert.rejects(manager.repairClosedCoverage(at, 14), /still pending/); assert.equal(count, 1);
    at += FIVE_MIN_MS;
    release([latest, forming]); // fetched while the latter was forming: not final evidence now
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(manager.getRefreshHealth().pending, false);
    assert.equal(manager.getClosedCoverageStatus(at, 14).firstMissingTs, forming.timestamp);
    assert.equal(manager.getClosedCoverageStatus(at, 14).healthy, false);
  } finally { Date.now = realNow; }
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
  await testInterruptedRequiredHistoryResumesWithoutReload();
  await testRepairTargetsInteriorGapAndRejectsNoProgress();
  await testRepairTimeoutRetainsSingleFlightAndCloseEvidence();
  console.log("context manager tests passed");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
