import assert from "assert";
import { LiveExecutor } from "../src/bot/executor";

const logger = {
  info: () => undefined,
  warn: () => undefined,
  logError: () => undefined,
  logTrade: () => undefined,
} as any;

function orderRaw(status: string, qty: number, avgPrice: number, orderId = "order-1") {
  return {
    orderId,
    orderStatus: status,
    cumExecQty: String(qty),
    cumExecValue: String(qty * avgPrice),
    avgPrice: String(avgPrice),
  };
}

function executionRaw(execId: string, qty: number, price: number, orderLinkId = "link-1", orderId = "order-1") {
  return {
    execId,
    orderId,
    orderLinkId,
    execQty: String(qty),
    execPrice: String(price),
    execTime: "1700000000000",
    side: "Buy",
    positionIdx: 1,
    closedSize: "0",
  };
}

function baseClient(overrides: Record<string, any> = {}): any {
  return {
    setLeverage: async () => ({ retCode: 0, retMsg: "OK" }),
    getTickers: async () => ({ retCode: 0, retMsg: "OK", result: { list: [{ lastPrice: "10" }] } }),
    getInstrumentsInfo: async () => ({
      retCode: 0,
      retMsg: "OK",
      result: { list: [{ lotSizeFilter: { qtyStep: "0.01", minOrderQty: "0.01" } }] },
    }),
    getPositionInfo: async () => ({
      retCode: 0,
      retMsg: "OK",
      result: { list: [{ symbol: "HYPEUSDT", side: "Buy", size: "10", avgPrice: "9" }] },
    }),
    submitOrder: async () => ({ retCode: 0, retMsg: "OK", result: { orderId: "order-1" } }),
    getActiveOrders: async () => ({ retCode: 0, retMsg: "OK", result: { list: [] } }),
    getHistoricOrders: async () => ({ retCode: 0, retMsg: "OK", result: { list: [] } }),
    getExecutionList: async () => ({ retCode: 0, retMsg: "OK", result: { list: [] } }),
    getClosedPnL: async () => ({ retCode: 0, retMsg: "OK", result: { list: [] } }),
    ...overrides,
  };
}

function executor(client: any): LiveExecutor {
  const result = new LiveExecutor("key", "secret", logger);
  (result as any).client = client;
  (result as any).longOrderPollAttempts = 1;
  (result as any).longOrderPollDelayMs = 0;
  return result;
}

async function testOpenClassification(): Promise<void> {
  const preSubmit = executor(baseClient({ getTickers: async () => { throw new Error("ticker down"); } }));
  assert.equal((await preSubmit.openLongDetailed("HYPEUSDT", 100, 1, "pre")).outcome, "not_submitted");

  const rejected = executor(baseClient({ submitOrder: async () => ({ retCode: 10001, retMsg: "bad qty", result: {} }) }));
  assert.equal((await rejected.openLongDetailed("HYPEUSDT", 100, 1, "reject")).outcome, "rejected");

  const unknown = executor(baseClient({ submitOrder: async () => { throw new Error("ECONNRESET after write"); } }));
  const unknownResult = await unknown.openLongDetailed("HYPEUSDT", 100, 1, "unknown");
  assert.equal(unknownResult.outcome, "unknown");
  assert.equal(unknownResult.orderId, "");

  const unresolved = executor(baseClient());
  assert.equal((await unresolved.openLongDetailed("HYPEUSDT", 100, 1, "unresolved")).outcome, "accepted_unresolved");

  const terminal = executor(baseClient({
    getActiveOrders: async () => ({ retCode: 0, retMsg: "OK", result: { list: [orderRaw("PartiallyFilledCanceled", 4, 11)] } }),
    getExecutionList: async () => ({
      retCode: 0,
      retMsg: "OK",
      result: { list: [executionRaw("e1", 1, 10), executionRaw("e2", 3, 12), executionRaw("e2", 3, 12)] },
    }),
  }));
  const terminalResult = await terminal.openLongDetailed("HYPEUSDT", 100, 1, "link-1");
  assert.equal(terminalResult.outcome, "terminal");
  assert.equal(terminalResult.status, "PartiallyFilledCanceled");
  assert.equal(terminalResult.cumExecQty, 4);
  assert.equal(terminalResult.avgPrice, 11.5);
  assert.deepEqual(terminalResult.executionIds, ["e1", "e2"]);

  const laggingExecutions = executor(baseClient({
    getActiveOrders: async () => ({ retCode: 0, retMsg: "OK", result: { list: [orderRaw("Filled", 10, 11)] } }),
    getExecutionList: async () => ({ retCode: 0, retMsg: "OK", result: { list: [executionRaw("lag-e1", 5, 10)] } }),
  }));
  const laggingResult = await laggingExecutions.openLongDetailed("HYPEUSDT", 100, 1, "link-1");
  assert.equal(laggingResult.cumExecQty, 10);
  assert.equal(laggingResult.avgPrice, 11);
}

async function testCloseClassification(): Promise<void> {
  let positionCall = 0;
  const partial = executor(baseClient({
    getPositionInfo: async () => {
      positionCall++;
      const size = positionCall === 1 ? "10" : "6";
      return { retCode: 0, retMsg: "OK", result: { list: [{ symbol: "HYPEUSDT", side: "Buy", size, avgPrice: "9" }] } };
    },
    getActiveOrders: async () => ({ retCode: 0, retMsg: "OK", result: { list: [orderRaw("PartiallyFilledCanceled", 4, 11)] } }),
    getExecutionList: async () => ({ retCode: 0, retMsg: "OK", result: { list: [executionRaw("c1", 4, 11)] } }),
  }));
  const partialResult = await partial.closeAllLongsDetailed("HYPEUSDT", "link-1");
  assert.equal(partialResult.outcome, "terminal");
  assert.equal(partialResult.cumExecQty, 4);
  assert.equal(partialResult.remainingLongQty, 6);

  positionCall = 0;
  const full = executor(baseClient({
    getPositionInfo: async () => {
      positionCall++;
      return {
        retCode: 0,
        retMsg: "OK",
        result: { list: positionCall === 1 ? [{ symbol: "HYPEUSDT", side: "Buy", size: "10", avgPrice: "9" }] : [] },
      };
    },
    getActiveOrders: async () => ({ retCode: 0, retMsg: "OK", result: { list: [orderRaw("Filled", 10, 11)] } }),
    getExecutionList: async () => ({ retCode: 0, retMsg: "OK", result: { list: [executionRaw("c-full", 10, 11)] } }),
  }));
  const fullResult = await full.closeAllLongsDetailed("HYPEUSDT", "link-1");
  assert.equal(fullResult.outcome, "terminal");
  assert.equal(fullResult.remainingLongQty, 0);
  assert.equal(fullResult.cumExecQty, 10);

  const alreadyFlat = executor(baseClient({
    getPositionInfo: async () => ({ retCode: 0, retMsg: "OK", result: { list: [] } }),
  }));
  assert.equal((await alreadyFlat.closeAllLongsDetailed("HYPEUSDT", "flat")).outcome, "already_flat");
}

async function testEvidenceQueries(): Promise<void> {
  const closeExec = {
    ...executionRaw("close-1", 3, 12, "native", "native-order"),
    side: "Sell",
    closedSize: "3",
  };
  const wrongSide = { ...closeExec, execId: "buy-1", side: "Buy" };
  const exec = executor(baseClient({
    getExecutionList: async (args: any) => ({
      retCode: 0,
      retMsg: "OK",
      result: { list: args.orderLinkId ? [executionRaw("e1", 2, 10), executionRaw("e2", 1, 13)] : [closeExec, closeExec, wrongSide] },
    }),
    getClosedPnL: async () => ({
      retCode: 0,
      retMsg: "OK",
      result: { list: [
        { orderId: "native-order", side: "Sell", updatedTime: "1700000000000", closedSize: "3", avgExitPrice: "12", closedPnl: "6" },
        { orderId: "short-close", side: "Buy", updatedTime: "1700000000000", closedSize: "3", avgExitPrice: "12", closedPnl: "6" },
      ] },
    }),
  }));

  const aggregate = await exec.queryOrderExecutions("HYPEUSDT", "link-1");
  assert.equal(aggregate.cumExecQty, 3);
  assert.equal(aggregate.avgPrice, 11);
  const closes = await exec.queryRecentLongCloseExecutions("HYPEUSDT", 1_699_999_999_000, 1_700_000_001_000);
  assert.equal(closes.length, 1);
  assert.equal(closes[0].closedSize, 3);
  const pnl = await exec.queryRecentClosedPnl("HYPEUSDT", 1_699_999_999_000, 1_700_000_001_000);
  assert.equal(pnl.length, 1);
  assert.equal(pnl[0].closedSize, 3);
}

async function main(): Promise<void> {
  await testOpenClassification();
  await testCloseClassification();
  await testEvidenceQueries();
  console.log("long executor transaction tests passed");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
