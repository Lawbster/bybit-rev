import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { CausalMinuteLatest, observationAvailability, firstDecisionAt, addAtAvailability, utcMs } from "./replay-causality";
import { buildContextIndicators, assertContextCoverage, buildHlScoreSeries, loadCandles1m, streamJsonl, runEngine, type Series, type Candle } from "./hype-freerun-canonical-replay";
import { attachDormantSeries, minuteLast } from "./hype-dormant-edge-replay";
import { rebuildDamagedLatch, addReplayTaker, type ReplayTaker } from "./replay-damaged-latch";

const M = 60_000;
const T = Date.UTC(2026, 8, 4, 7, 40);
const point = (timestamp: number, value: number) => ({ timestamp, value });
function bareSeries(candles: Candle[]): Series {
  const n = candles.length, zeros = () => Array(n).fill(0), no = () => Array(n).fill(false), nulls = () => Array(n).fill(null);
  return { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zeros(), bybitFunding: nulls(), fundingStress: no(),
    rsi1H: Array(n).fill(50), crsi4H: Array(n).fill(50), slope12h: zeros(), riskOffBlocked: no(), regimeFlat: no(),
    vwap24h: nulls(), priorLow12h: nulls(), ret12h: nulls(), ret1h: nulls(), ret2h: nulls(), pbHasEnough: no(), hlScore: nulls(), hlSellPressure: no(), high14d: nulls() };
}

async function main() {
  const latest = new CausalMinuteLatest<number>();
  latest.observe(T - 14_000, 1);
  latest.observe(T + 46_000, 9);
  assert.equal(latest.get(T), 1, "a later sample must not overwrite the current decision");
  assert.equal(latest.get(T + M), 9);
  assert.equal(latest.availableAt.get(T), T - 14_000);
  latest.observe(T - 30_000, 0);
  assert.equal(latest.get(T), 1, "out-of-order older samples must not win");
  latest.observe(T, 2); assert.equal(latest.get(T), 2, "exact-boundary receipts are eligible");
  assert.throws(() => latest.observe(T, 3), /Conflicting/);
  assert.equal(firstDecisionAt(T - 1), T);
  assert.equal(utcMs(new Date(T).toISOString()), T);
  assert.throws(() => utcMs("2026-09-04 07:40:00"), /Invalid UTC/);
  assert.equal(observationAvailability({ timestamp: T, nextFundingTime: T + M }), T);
  assert.equal(observationAvailability({ timestamp: T, receivedAt: T + 7000 }), T + 7000);
  assert.equal(observationAvailability({ timestamp: T, windowEnd: T }, "hl_taker"), T + M);
  assert.equal(observationAvailability({ timestamp: T, windowEnd: T, receivedAt: T + 2000 }, "hl_taker"), T + 2000);
  assert.equal(observationAvailability({ timestamp: T, source: "backfill" }, "binance_taker"), T + 5 * M);
  const sums = new Map<number, number>(); addAtAvailability(sums, T + 1, 3); assert.equal(sums.get(T), undefined); assert.equal(sums.get(T + M), 3);
  const fragments: ReplayTaker = new Map();
  addReplayTaker(fragments, { timestamp: T, windowEnd: T, buyNotional: 2, sellNotional: 4 });
  addReplayTaker(fragments, { timestamp: T, windowEnd: T, buyNotional: 3, sellNotional: 6 });
  assert.equal(fragments.get(T), undefined);
  assert.deepEqual(fragments.get(T + M), { buy: 5, sell: 10, windowEnd: T });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "replay-causality-tests-"));
  const put = (file: string, rows: unknown[]) => fs.writeFileSync(path.join(dir, file), rows.map(r => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
  try {
    put("points.jsonl", [point(T - 14000, 1), point(T + 46000, 9)]);
    assert.equal((await minuteLast("points.jsonl", r => r.value, dir)).get(T), 1);
    await assert.rejects(streamJsonl(path.join(dir, "points.jsonl"), () => { throw new Error("callback sentinel"); }), /callback sentinel/);
    fs.writeFileSync(path.join(dir, "bad.jsonl"), '{"timestamp":');
    await assert.rejects(streamJsonl(path.join(dir, "bad.jsonl"), () => {}), /Malformed replay JSON/);
    await assert.rejects(streamJsonl(path.join(dir, "missing.jsonl"), () => {}), /Missing replay input/);
    await streamJsonl(path.join(dir, "missing.jsonl"), () => {}, { optional: true });

    const candles = Array.from({ length: 1200 }, (_, i) => {
      const p = 100 + Math.sin(i / 40); const ts = T - (1200 - i) * M;
      return { ts, endTs: ts + M, open: p, close: p, high: p + .1, low: p - .1, volume: 1, turnover: p };
    });
    put("BTCUSDT_1m.jsonl", candles.map(c => ({ timestamp: c.ts, ...c })));
    put("HYPEUSDT_1m.jsonl", [{ timestamp: T - M, o: 1, h: 1, l: 1, c: 1 }, { timestamp: T, o: 999, h: 999, l: 999, c: 999 }]);
    assert.equal((await loadCandles1m("HYPEUSDT", dir, T)).length, 1, "forming minute excluded");
    const streams = ["taker_binance", "taker_hyperliquid", "oi_live", "oi_live_binance", "oi_live_hyperliquid", "asset_ctx_hyperliquid", "ob_bands_hyperliquid", "liquidations", "funding_live", "funding_live_binance", "funding_live_hyperliquid"];
    for (const f of streams) put(`HYPEUSDT_${f}.jsonl`, []);
    const asset = (timestamp: number, v: number) => ({ timestamp, openInterestValue: v, fundingRate: 0 });
    const book = (timestamp: number, imb: number) => ({ timestamp, imbalance_0_5: imb, bidBands: { pct_0_5: 100 }, askBands: { pct_0_5: 100 } });
    put("HYPEUSDT_asset_ctx_hyperliquid.jsonl", [asset(T - 4 * 60 * M - 1000, 100), asset(T - 1000, 100)]);
    put("HYPEUSDT_ob_bands_hyperliquid.jsonl", [book(T - 1000, 0)]);
    const before = bareSeries(candles);
    await attachDormantSeries(before, 0, dir);
    const scoreBefore = await buildHlScoreSeries(candles, 0, dir);
    fs.appendFileSync(path.join(dir, "HYPEUSDT_asset_ctx_hyperliquid.jsonl"), JSON.stringify(asset(T + 46000, 1)) + "\n");
    fs.appendFileSync(path.join(dir, "HYPEUSDT_ob_bands_hyperliquid.jsonl"), JSON.stringify(book(T + 49000, -1)) + "\n");
    put("HYPEUSDT_liquidations.jsonl", [{ timestamp: T + 1000, notionalUsd: 1e9, liquidatedSide: "long" }]);
    put("HYPEUSDT_taker_binance.jsonl", [{ timestamp: T + 1000, buyVol: 0, sellVol: 1e9 }]);
    put("HYPEUSDT_taker_hyperliquid.jsonl", [{ timestamp: T, windowEnd: T, buyNotional: 0, sellNotional: 1e9 }]);
    const after = bareSeries(candles);
    await attachDormantSeries(after, 0, dir);
    assert.deepEqual(after, before, "all dormant features invariant when future data is appended");
    assert.deepEqual(await buildHlScoreSeries(candles, 0, dir), scoreBefore, "HL score future-data invariance");
    // This earlier test isolates input invariance in the archived engine. Execution
    // causality is independently covered by replay-current-stack-tests.ts.
    const params = { id: "causal-fixture", executionModel: "legacy_ohlc" as const, maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h" as const, pullbackMode: "none" as const };
    assert.deepEqual(runEngine(params, before, { startIdx: 0 }), runEngine(params, after, { startIdx: 0 }));
    const later = [...candles, { ...candles.at(-1)!, ts: T, endTs: T + M }];
    const scoreLater = await buildHlScoreSeries(later, 0, dir);
    assert.ok(scoreLater.score.at(-1)! > scoreBefore.score.at(-1)!, "future evidence eventually becomes eligible");

    // Enough hourly/4h history, but well before the module's default May-2026 start.
    const history = Array.from({ length: 430 * 60 }, (_, i) => {
      const ts = Date.UTC(2025, 0, 1) + i * M, p = 100 + Math.sin(i / 177) + i / 1e5;
      return { ts, endTs: ts + M, open: p, close: p, high: p, low: p, volume: 1, turnover: p };
    });
    const prefix = history.slice(0, history.length - 3);
    const ctx = buildContextIndicators(history);
    const earlier = buildContextIndicators(prefix);
    for (const key of ["rsi1H", "crsi4H", "slope12h"] as const) assert.deepEqual(ctx[key].slice(0, prefix.length), earlier[key]);
    assertContextCoverage({ candles: history, ...ctx }, history.length - 100, history.length);
    ctx.rsi1H[history.length - 1] = null;
    assert.throws(() => assertContextCoverage({ candles: history, ...ctx }, history.length - 1, history.length), /context unavailable/);
    const latchConfig = { enabled: true, triggerEma200DistPct: -4, taker15mMax: .85, taker1hMax: .9, releaseEma200DistPct: -1, releaseBars: 2, minTaker15mSamples: 14, minTaker1hSamples: 55, maxTakerAgeSec: 90 };
    const latchBars = Array.from({ length: 206 }, (_, i) => {
      const ts = Date.UTC(2025, 0, 1) + i * 240 * M, p = i >= 202 ? 90 : 100;
      return { ts, endTs: ts + 240 * M, open: p, high: p, low: p, close: p, volume: 1, turnover: p };
    });
    const takers = new CausalMinuteLatest<{ buy: number; sell: number; windowEnd: number }>();
    const decision = latchBars.at(-1)!.endTs;
    for (let i = 0; i < 60; i++) takers.observe(decision - i * M, { buy: 1, sell: 10, windowEnd: decision - (i + 1) * M });
    const latchBefore = rebuildDamagedLatch(latchBars, latchConfig, takers);
    assert.equal(latchBefore.blocked.at(-1), true, "known completed structure and healthy sell flow arm latch");
    takers.observe(decision + 1000, { buy: 1e9, sell: 1, windowEnd: decision });
    assert.deepEqual(rebuildDamagedLatch(latchBars, latchConfig, takers), latchBefore, "future taker cannot rewrite a latch transition");
    console.log("replay causality tests passed: as-of boundaries, aggregate publication, future append, engine equality, prefix indicators, coverage and strict input errors");
  } finally {
    // Flat, test-owned temporary directory only; no recursive deletion or repo state.
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    for (const file of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, file));
    fs.rmdirSync(dir);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
