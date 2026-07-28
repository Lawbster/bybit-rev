import assert from "assert";
import { buildUnseenBinanceTakerRows } from "../src/binance-taker";

const observedAt = Date.parse("2026-07-28T09:37:45.175Z");
const apiRows = [
  { timestamp: 300, buySellRatio: "1.3", buyVol: "30", sellVol: "23" },
  { timestamp: 100, buySellRatio: "1.1", buyVol: "10", sellVol: "9" },
  { timestamp: 200, buySellRatio: "1.2", buyVol: "20", sellVol: "17" },
  { timestamp: 300, buySellRatio: "1.31", buyVol: "31", sellVol: "23" },
];

const caughtUp = buildUnseenBinanceTakerRows({
  apiRows,
  lastExchangeTs: 100,
  observedAt,
  symbol: "HYPEUSDT",
});
assert.deepEqual(caughtUp.map(row => row.exchangeTimestamp), [200, 300]);
assert.deepEqual(caughtUp.map(row => row.timestamp), [observedAt, observedAt]);
assert.deepEqual(caughtUp.map(row => row.ts), [
  "2026-07-28T09:37:45.175Z",
  "2026-07-28T09:37:45.175Z",
]);
assert.equal(caughtUp[1].buySellRatio, 1.31, "latest duplicate payload wins");
assert.equal(caughtUp[0].source, "rest_poll");

const unchanged = buildUnseenBinanceTakerRows({
  apiRows: [apiRows[0]],
  lastExchangeTs: 300,
  observedAt,
  symbol: "HYPEUSDT",
});
assert.deepEqual(unchanged, [], "an unchanged Binance bucket remains deduplicated");

const invalid = buildUnseenBinanceTakerRows({
  apiRows: [
    { timestamp: "not-a-number", buySellRatio: "1", buyVol: "1", sellVol: "1" },
    { timestamp: 400, buySellRatio: "0.8", buyVol: "8", sellVol: "10" },
  ],
  lastExchangeTs: 300,
  observedAt,
  symbol: "HYPEUSDT",
});
assert.deepEqual(invalid.map(row => row.exchangeTimestamp), [400]);

console.log("binance taker tests passed");
