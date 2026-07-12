import assert from "assert";
import { Candle } from "../src/fetch-candles";
import { LiveContextManager } from "../src/bot/context-manager";

const WINDOW_SIZE = 40_320;

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

async function main(): Promise<void> {
  testFormingCandleIsReplacedByFinalCandle();
  testNewCandlesRemainSorted();
  testLastFreshDuplicateWinsWithoutDuplicateTimestamp();
  testWindowKeepsMostRecentCandles();
  await testRefreshUpsertsAndInvalidatesCachedContext();
  console.log("context manager tests passed");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
