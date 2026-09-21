import assert from "assert/strict";
import fs from "fs";
import { runCausalLongReplay } from "./replay-causal-engine";
import { runEngine, type Candle, type Series, type EngineParams } from "./hype-freerun-canonical-replay";
import { ReplayMarketInputs, emptyReplayPulse } from "./replay-market-inputs";
import { ReplaySrContext } from "./replay-sr-context";
import { assetObservationAt, bookEvidence, finiteData, fundingPerHour, observationMetadata } from "../src/hl-data-quality";
import { evaluateSRSupportReopen } from "../src/bot/sr-support-reopen";
import { SRMemoryZoneEngine } from "../src/bot/sr-memory-zones";
import type { BotConfig } from "../src/bot/bot-config";
import { StateManager } from "../src/bot/state";
import os from "os";
import path from "path";

const M = 60000, T = Date.UTC(2026, 7, 20, 12);
const cfg: BotConfig = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
cfg.srPartialExitAction!.enabled = false; cfg.srSupportReopenAction!.enabled = false;
const params: EngineParams = { id: "causal-test", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "resting_touch" };
function bar(i: number, patch: Partial<Candle> = {}): Candle { return { ts: T + i * M, endTs: T + (i + 1) * M, open: 100, high: 100.1, low: 99.9, close: 100, volume: 1, turnover: 100, ...patch }; }
function series(candles: Candle[]): Series {
  const n = candles.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  return { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50), crsi4H: Array(n).fill(50), slope12h: zero(),
    riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(), ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
const run = (cs: Candle[], seedAt = T - 10 * M, p = params) => runCausalLongReplay(p, series(cs), { startIdx: 0, seed: { ts: seedAt, price: 100, notional: 800 }, recordSnapshots: true }, cfg, 32000);

// No retroactive entry at the earlier low after a recovered close.
assert.equal(run([bar(0, { low: 99.6 })]).openDepth, 1);
const delayed = run([bar(0), bar(1, { open: 101, low: 100.9, high: 101.1, close: 101 })], T - 31 * M);
const fill = delayed.executionAudit!.events.find(x => x.kind === "open")!;
assert.equal(fill.price, 101); assert.equal(fill.decisionIndex, 0); assert.equal(fill.fillIndex, 1);
assert.ok(fill.fillAt! >= fill.decisionAt);
// A new stale target cannot fill from an earlier high in its decision candle.
const stale = run([bar(0, { high: 100.6, close: 100.2 }), bar(1, { high: 100.4, close: 100.3 })], T - 4 * 3600000 + 30000, { ...params, maxPositions: 1 });
assert.equal(stale.closes.length, 0);
const touched = run([bar(0, { high: 100.6, close: 100.2 }), bar(1, { high: 100.7, close: 100.6 })], T - 4 * 3600000 + 30000, { ...params, maxPositions: 1 });
assert.equal(touched.closes.length, 1); assert.ok(Math.abs(touched.closes[0].exitPrice - 100.5) < 1e-10);
assert.equal(touched.executionAudit!.lastAddTime, 0, "full close resets current live lastAddTime");
const marketTp = run([bar(0, { high: 101.5, close: 101.45 }), bar(1, { open: 101.2, high: 101.3, low: 101.1, close: 101.2 })], T - 10 * M, { ...params, tpExecutionModel: "close_confirmed" });
assert.equal(marketTp.closes[0].exitPrice, 101.2);
const hot = series([bar(0), bar(1), bar(2, { high: 101.5 }), bar(3)]);
hot.rsi1H = [50, 70, 30, 30];
const hotClose = runCausalLongReplay({ ...params, maxPositions: 1 }, hot, { startIdx: 0, seed: { ts: T - M, price: 100 } }, cfg, 32000);
assert.equal(hotClose.closes.length, 1);
assert.equal(hotClose.blocked.cooldown, 1, "resting TP cooldown uses pre-fill context, not cold arm-time or future closing RSI");
assert.equal(run([bar(0)], T - 31 * M).executionAudit!.events.length, 0, "end of data cannot fill a pending decision");
assert.equal(run([bar(0)], T - 31 * M).executionAudit!.pendingAtEnd != null, true);
assert.equal(run([bar(0), bar(3)], T - 31 * M).blocked.staleEntryCancelled, 1);
assert.throws(() => run([bar(0)], T - 10 * M, { ...params, shortFlip: {} as any }), /legacy variant/);
assert.throws(() => runEngine(params, series([bar(0)]), { startIdx: 0 }), /quality-aware marketInputs/);
const prefix = [bar(0), bar(1)], longer = [...prefix, bar(2, { high: 200, close: 150 })];
assert.deepEqual(run(prefix, T - 31 * M).executionAudit!.events, run(longer, T - 31 * M).executionAudit!.events.filter(x => x.fillIndex! < 2));
assert.deepEqual(run(prefix, T - 31 * M), run(prefix, T - 31 * M));

// No null-to-zero coercion, wrong interval, synthetic freshness, or truncated walls.
assert.equal(finiteData(null), null); assert.equal(fundingPerHour(.00008, 8), .00001); assert.equal(fundingPerHour(.1, null), null);
assert.deepEqual(observationMetadata(T, T - 5000), { observationVersion: 1, writtenAt: T, receivedAt: T - 5000 });
assert.equal(assetObservationAt({ timestamp: T, receivedAt: T - 120000 }), T - 120000);
const book = { timestamp: T, exchangeTimestamp: T - 120000, bidBands: { pct_0_5: 200 }, askBands: { pct_0_5: 100 },
  bidBandsTruncated: { pct_0_5: false }, askBandsTruncated: { pct_0_5: false }, bandResolutionTooCoarse: { pct_0_5: false }, bestBidAskAreAggregated: true };
assert.equal(bookEvidence(book, T).ageSec, 120); assert.equal(bookEvidence(book, T).band("pct_0_5").imbalance, 1 / 3);
assert.equal(bookEvidence({ ...book, bidBandsTruncated: {} }, T).band("pct_0_5").healthy, false);
assert.equal(bookEvidence({ ...book, exchangeTimestamp: T + 1 }, T).band("pct_0_5").healthy, false);
const tape = new ReplayMarketInputs();
for (let j = 1; j <= 60; j++) tape.add("hlTaker", { timestamp: T - j * M, windowEnd: T - j * M, buyNotional: 2, sellNotional: 1 });
tape.add("book", book);
for (const ts of [T - 14400000 - 1000, T - 3600000 - 1000, T - 1000]) tape.add("asset", { timestamp: ts, openInterest: 100, openInterestValue: ts === T - 1000 ? 11000 : 10000, markPrice: ts === T - 1000 ? 110 : 100 });
tape.seal(); const before = tape.snapshot(T);
assert.equal(before.research.nativeOi1hPct, 0); assert.ok(before.research.markedOi1hPct! > 9.9);
assert.equal(before.pulse.hlTaker15mSamples, 14, "event-window samples are not shifted forward by publication lag");
assert.equal(before.pulse.hlTaker1hSamples, 59);
tape.add("book", { ...book, timestamp: T + 1000, exchangeTimestamp: T + 1000, bidBands: { pct_0_5: 1e9 } });
tape.add("hlTaker", { timestamp: T, windowEnd: T, buyNotional: 1e9, sellNotional: 1 }); tape.seal();
assert.deepEqual(tape.snapshot(T), before);
const support = { lv: { price: 99.5, confirmTs: T - 100000, touches: 2, highTouches: 1, lowTouches: 1, touchData: [] }, dist: .005 };
const args = { contextHealthy: true, liveGuardBlocked: true, liveGuardReasons: ["funding"], fundingStressOnly: true, priceDropOk: false, nextDepth: 6, support,
  pulse: before.pulse, config: { ...JSON.parse(fs.readFileSync("bot-config.json", "utf8")).srSupportReopenAction } };
assert.ok(evaluateSRSupportReopen(args).blockers.includes("hl_orderbook_unhealthy"));
const freshPulse = { ...before.pulse, hlObAgeSec: 1 };
assert.equal(evaluateSRSupportReopen({ ...args, pulse: freshPulse }).eligible, true);
assert.equal(evaluateSRSupportReopen({ ...args, pulse: { ...freshPulse, hlTaker15mSamples: 1, hlTaker1hSamples: 1 } }).eligible, false);
assert.equal(evaluateSRSupportReopen({ ...args, pulse: freshPulse, contextHealthy: false }).eligible, false);
assert.equal(emptyReplayPulse().hlTaker15m, null);

// Zone engine is the live implementation; future candles and gaps cannot repair past coverage.
const cs = Array.from({ length: 1500 }, (_, i) => { const price = 100 + Math.sin(i / 60); return bar(i, { open: price, close: price, high: price + .1, low: price - .1 }); });
const zcfg = { enabled: true, tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: .0045, minTouches: 2, bufferPct: 1, recentDays: .5 };
const t = T + 1200 * M, ctx = new ReplaySrContext(cs, zcfg), got = ctx.at(t);
const prefixCtx = new ReplaySrContext(cs.filter(c => c.endTs <= t), zcfg).at(t);
assert.deepEqual(got.engine.getZones(t), prefixCtx.engine.getZones(t)); assert.equal(got.coverage.healthy, true);
assert.ok(got.engine.getZones(t).length > 0, "prefix test must compare real confirmed zones, not empty outputs");
const gapped = new ReplaySrContext(cs.filter((_, i) => i !== 1195), zcfg).at(t);
assert.equal(gapped.coverage.healthy, false);
assert.ok(got.engine instanceof SRMemoryZoneEngine);
ctx.at(t + M);
assert.throws(() => ctx.at(t + M - 1), /must move forward/, "even same-timeframe historical queries need a new prefix build");

// End-to-end current S/R decision -> next-open selected-rung fill -> remaining state.
const partialCfg = structuredClone(cfg);
partialCfg.srShadow = { ...partialCfg.srShadow!, recentDays: .5 };
partialCfg.srPartialExitAction!.enabled = true;
const partialWarmup = Array.from({ length: 1480 }, (_, i) => {
  const price = 100 + Math.sin(i / 60); return bar(i, { open: price, close: price, high: price + .1, low: price - .1 });
});
const partialBars = [...partialWarmup, ...Array.from({ length: 9 }, (_, j) => bar(1480 + j,
  j === 7 ? { close: 100.85, high: 100.9 } : j === 8 ? { open: 100.7, close: 100.7, low: 100.6, high: 100.8 } : {}))];
const partialSeries = series(partialBars), partialTape = new ReplayMarketInputs();
partialTape.add("bnTaker", { timestamp: T + 1480 * M, buyVol: 1, sellVol: 2 }); partialTape.seal(); partialSeries.marketInputs = partialTape;
const partialRun = runCausalLongReplay({ ...params, maxPositions: 6, addIntervalMin: 1 }, partialSeries, { startIdx: 1480, recordSnapshots: true }, partialCfg, 32000);
assert.equal(partialRun.trims.length, 1, "otherwise valid current S/R policy really executes a partial");
assert.equal(partialRun.openDepth, 3);
assert.equal(partialRun.executionAudit!.lastAddTime, T + 1486 * M, "transactional partial retains last actual add time");
const legacyPartial = runCausalLongReplay({ ...params, maxPositions: 6, addIntervalMin: 1 }, partialSeries,
  { startIdx: 1480, recordSnapshots: true, partialClockModel: "legacy_reanchor" }, partialCfg, 32000);
assert.equal(legacyPartial.executionAudit!.lastAddTime, T + 1483 * M, "explicit old archive clock only");
assert.equal(partialRun.executionAudit!.srCooldownUntil, T + 1488 * M + 60 * M);
const partialFill = partialRun.executionAudit!.events.find(x => x.kind === "partial")!;
assert.equal(partialFill.price, 100.7); assert.equal(partialFill.fillIndex, 1488); assert.equal(partialFill.decisionIndex, 1487);
assert.equal(partialFill.qty, [3, 4, 5].reduce((qty, level) => qty + 800 * 1.35 ** level / 100, 0));
const expectedNet = partialFill.qty * (100.7 - 100) - partialCfg.feeRate * partialFill.qty * (100.7 + 100);
assert.ok(Math.abs(partialRun.trims[0].pnl - expectedNet) < 1e-9);
assert.ok(Math.abs(partialRun.snapshots.at(-1)!.longNotional - 3338) < 1e-9);
const invalidCoverage = { ...partialSeries, candles: partialBars.filter((_, i) => i !== 1400) };
assert.equal(runCausalLongReplay({ ...params, maxPositions: 6, addIntervalMin: 1 }, invalidCoverage, { startIdx: 1479 }, partialCfg, 32000).trims.length, 0,
  "same partial candidate is blocked solely by missing S/R source coverage");

// Legacy helper reanchors; it is NOT the transactional live path (covered in ladder-sizing-tests).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "replay-state-parity-"));
try {
  const sm = new StateManager(path.join(dir, "state.json"));
  for (let i = 0; i < 6; i++) sm.addPosition({ entryPrice: 100, entryTime: T + i * M, qty: 1, notional: 100, level: i });
  sm.closePositionsByIndices([3, 4, 5], 101, T + 10 * M, .00055);
  assert.equal(sm.get().lastAddTime, T + 2 * M); assert.equal(sm.get().positions.length, 3);
} finally { for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f)); fs.rmdirSync(dir); }
console.log("current-stack replay tests passed: pending fills, target timing, close state, source quality, live support policy, S/R prefixes and gap coverage");
