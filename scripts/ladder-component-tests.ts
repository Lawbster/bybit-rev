import assert from "assert/strict";
import fs from "fs";
import type { BotConfig } from "../src/bot/bot-config";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
import { runCausalLongReplay } from "./replay-causal-engine";
import { COMPONENTS, componentConfig, componentPolicies, componentSeries } from "./ladder-component-policy";
const cfg: BotConfig = JSON.parse(fs.readFileSync("bot-config.json", "utf8")), saved = JSON.stringify(cfg);
const ps = componentPolicies(), full = ps.cumulative.at(-1)!, bare = ps.cumulative[0];
assert.deepEqual(componentConfig(cfg, full).cfg, cfg); assert.equal(componentConfig(cfg, full).cooldownMode, "live4h");
assert.equal(componentConfig(cfg, bare).cooldownMode, "0h"); assert.equal(COMPONENTS.length, 17);
const t = Date.UTC(2026, 8, 1), M = 60000;
function fixture(n: number, price: (i: number) => number = () => 100): Series {
  const candles: Candle[] = Array.from({ length: n }, (_, i) => ({ ts: t + i * M, endTs: t + (i + 1) * M,
    open: price(i), close: price(i), high: price(i), low: price(i), volume: 1, turnover: price(i) }));
  const nil = () => Array(n).fill(null), no = () => Array(n).fill(false), zero = () => Array(n).fill(0);
  return { candles, trendBlocked: no(), riskOffBlocked: no(), regimeFlat: no(), aboveEma200: no(), ret6h: zero(),
    bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50), crsi4H: Array(n).fill(50), slope12h: zero(),
    vwap24h: nil(), priorLow12h: nil(), ret12h: nil(), ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
function run(s: Series, p = bare, seed = false) {
  const { cfg: c, cooldownMode } = componentConfig(cfg, p);
  const params: EngineParams = { id: "fixture", executionModel: "causal_next_open", tpExecutionModel: "resting_touch",
    maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, pullbackMode: "none", cooldownMode };
  return runCausalLongReplay(params, componentSeries(s, s.regimeFlat, Array(s.candles.length).fill(false), p),
    { startIdx: 0, recordSnapshots: true, ...(seed ? { seed: { ts: t - 13 * 3600000, price: 100 } } : {}) }, c, 32000);
}
const s = fixture(330), b = run(s); assert.equal(b.openDepth, 11); assert.equal(b.closes.length, 0);
assert.equal(b.trims.length, 0); assert.equal(b.executionAudit!.events.length, 11);
const opens = b.executionAudit!.events;
for (let i = 0; i < opens.length; i++) {
  assert.equal(opens[i].fillIndex, 1 + 30 * i); assert.equal(opens[i].decisionIndex, 30 * i);
  assert(Math.abs(opens[i].qty * opens[i].price! - 800 * 1.35 ** i) < 1e-8);
}
const drop = fixture(12, i => 100 * .996 ** i);
assert.equal(run(drop).openDepth, 1); assert.equal(run(drop, ps.cumulative[1]).openDepth, 6);
const falling = fixture(3, () => 70); assert.equal(run(falling, bare, true).closes.length, 0);
assert.equal(run(falling, ps.cumulative[3], true).closes[0].reason, "emergency_kill");
const rebound = fixture(3, i => i ? 102 : 100); assert.equal(run(rebound).closes.length, 0, "cannot retrofill high in opening bar");
assert.equal(run(fixture(4, i => i > 1 ? 103.5 : 100)).closes[0].reason, "tp");
const x = fixture(3); x.trendBlocked = [true, true, true]; x.riskOffBlocked = [true, false, true];
const daily = [true, false, false], latch = [false, true, false];
assert.deepEqual(componentSeries(x, daily, latch, full).regimeFlat, [true, true, false]);
assert.deepEqual(componentSeries(x, daily, latch, ps.unique.find(p => p.id === "minus_daily_regime")!).regimeFlat, latch);
assert.deepEqual(componentSeries(x, daily, latch, ps.cumulative[16]).regimeFlat, daily);
assert.deepEqual(componentSeries(x, daily, latch, bare).trendBlocked, [false, false, false]);
assert.deepEqual(componentSeries(x, daily, latch, full).trendBlocked, x.trendBlocked);
const hostile = fixture(3, () => 95); hostile.trendBlocked.fill(true);
assert.equal(run(hostile, ps.cumulative[5], true).closes[0].reason, "hard_flatten");
const noTrend = { ...ps.cumulative[5], enabled: ps.cumulative[5].enabled.filter(c => c !== "trend") };
assert.equal(run(hostile, noTrend, true).closes.length, 0, "actual config dependency, not a fabricated independent exit");
const prefix = run(fixture(45)), longer = run(fixture(90));
assert.deepEqual(prefix.executionAudit!.events, longer.executionAudit!.events.filter(e => e.fillIndex! < 45));
assert.equal(JSON.stringify(cfg), saved); assert.equal(cfg.priceTriggerPct, .3);
console.log("component fixtures passed: exact full/bare wiring,34 unique policies,17 toggles,11 sizes/timers,drop,exits,independent regime masks,trend dependency,prefix causality,config immutable");
