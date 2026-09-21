import fs from "fs";
import assert from "assert/strict";
import { runCausalLongReplay, type ResearchAddDecision } from "./replay-causal-engine";
import { exposureVeto, exposureVariants, type ExposureSpec } from "./ladder-exposure-policy";
import { exposureMetrics, exposureDelta, qualifyExposure } from "./ladder-exposure-metrics";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
import type { BotConfig } from "../src/bot/bot-config";
const spec: ExposureSpec = JSON.parse(fs.readFileSync("research-inputs/sr-pulse-encounters/ladder-exposure-controls-2026-09-05.json", "utf8"));
const variants = exposureVariants(spec); assert.equal(variants.length, 17); assert.equal(new Set(variants.map(v => v.id)).size, 17);
const d: ResearchAddDecision = { at: Date.parse("2026-07-07T17:08Z"), index: 50, episode: 1, nextDepth: 11, price: 71.89, priceDropOk: false,
  aboveEma200: true, ret12h: -2.1, ret15m: -.1, srHealthy: true, resistancePrice: 72.0675, resistanceDistPct: .2469,
  resistanceKnownAt: Date.parse("2026-07-07T03:00Z"), taker15m: .84, taker1h: 1.29, samples15m: 14, samples1h: 59, takerAgeSec: 60 };
const decide = (id: string, patch: Partial<ResearchAddDecision> = {}) => exposureVeto(variants.find(v => v.id === id)!, { ...d, ...patch }, spec);
for (const v of variants) assert.equal(exposureVeto(v, d, spec).veto, true, v.id);
assert(!decide("sr_timer_d11", { nextDepth: 10 }).veto); assert(decide("sr_timer_d9", { nextDepth: 10 }).veto);
assert(!decide("sr_timer_d11", { priceDropOk: true }).veto); assert(decide("sr_all_d11", { priceDropOk: true }).veto);
assert(!decide("sr_weak_timer_d11", { ret12h: 1 }).veto); assert(decide("weak_timer_d11", { aboveEma200: false, ret12h: 1 }).veto);
assert(!decide("sr_sell_timer_d11", { taker15m: 1.1 }).veto);
assert(!decide("sr_confirm_timer_d11", { taker15m: 1.2, taker1h: 1, ret15m: .01 }).veto);
for (const patch of [{ takerAgeSec: 91 }, { takerAgeSec: null }, { takerAgeSec: -1 }, { samples15m: 13 }, { taker15m: null }]) {
  const x = decide("sr_sell_timer_d11", patch); assert(x.unknown && !x.veto);
}
assert(decide("sr_confirm_timer_d11", { samples1h: 54 }).unknown);
assert(!decide("sr_timer_d11", { srHealthy: false }).veto);
assert(decide("sr_timer_d11", { resistanceDistPct: .3 + 1e-12 }).veto);
assert(!decide("sr_timer_d11", { resistanceDistPct: .3001 }).veto);

const cfg: BotConfig = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
cfg.srPartialExitAction!.enabled = false; cfg.srSupportReopenAction!.enabled = false; cfg.deepAddStressGuard!.enabled = false;
cfg.addIntervalMin = 1; cfg.priceTriggerPct = .3; cfg.addThrottle!.enabled = false;
const T = Date.parse("2026-06-30T23:50Z"), M = 60000;
function bar(i: number, price = 100): Candle { return { ts: T + i * M, endTs: T + (i + 1) * M, open: price, close: price, high: price + .01, low: price - .01, volume: 1, turnover: price }; }
function series(candles: Candle[]): Series {
  const n = candles.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  return { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50), crsi4H: Array(n).fill(50), slope12h: zero(),
    riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(), ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
const p: EngineParams = { id: "test", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "close_confirmed" };
const cs = Array.from({ length: 17 }, (_, i) => bar(i, i >= 14 ? 102 : 100)), s = series(cs), opts = { startIdx: 0, recordSnapshots: true };
const base = runCausalLongReplay(p, s, opts, cfg, 32000), decisions: ResearchAddDecision[] = [];
const inert = runCausalLongReplay(p, s, { ...opts, researchAddVeto: x => { assert(Object.isFrozen(x)); decisions.push(x); return false; } }, cfg, 32000);
assert.deepEqual(inert, base, "inert hook preserves the entire engine result");
const cap = runCausalLongReplay(p, s, { ...opts, researchAddVeto: x => exposureVeto(variants[0], x, spec).veto }, cfg, 32000);
const capConfig = runCausalLongReplay({ ...p, maxPositions: 10 }, s, opts, cfg, 32000);
assert.deepEqual(cap.executionAudit, capConfig.executionAudit, "cap-veto is equivalent to a ten-rung control for executions/state");
assert.equal(cap.realized, capConfig.realized); assert.equal(cap.maxDepthSeen, 10); assert.equal(cap.closes.length, 1, "TP remains operational while add veto persists");
const delayed = runCausalLongReplay(p, s, { ...opts, researchAddVeto: x => x.nextDepth === 11 && x.index < 12 }, cfg, 32000);
const late = delayed.executionAudit!.events.filter(e => e.kind === "open").at(-1)!;
assert.equal(late.decisionIndex, 12); assert.equal(late.fillIndex, 13, "released veto fills next open, not at original trigger");
const stopS = series(Array.from({ length: 16 }, (_, i) => bar(i, i >= 13 ? 80 : 100)));
const stopped = runCausalLongReplay(p, stopS, { ...opts, researchAddVeto: x => x.nextDepth >= 9 }, cfg, 32000);
assert.equal(stopped.closes[0].reason, "emergency_kill", "veto must not interfere with emergency exit");
const outer = series(cs); outer.trendBlocked.fill(true);
assert.equal(runCausalLongReplay(p, outer, { ...opts, researchAddVeto: () => { throw Error("outer gate bypassed"); } }, cfg, 32000).openDepth, 0);
const prefix = series(cs.slice(0, 13)), seen: ResearchAddDecision[] = [];
runCausalLongReplay(p, prefix, { ...opts, researchAddVeto: x => { seen.push(x); return false; } }, cfg, 32000);
assert.deepEqual(seen, decisions.filter(x => x.index < 13), "future candles cannot change prior decision inputs");
const bm = exposureMetrics(base, 32000), cm = exposureMetrics(cap, 32000), delta = exposureDelta(cm, bm);
assert(Math.abs(delta.monthly.reduce((n, m) => n + m.mtmDelta, 0) - delta.pnlDelta) < 1e-8);
assert.equal(bm.grossWin - bm.grossLoss + bm.unfinishedPartialPnl, base.realized);
const good = { ...delta, pnlDelta: 1200, pnlRetention: 1.1, ddReductionPp: 4, grossLossReductionPct: 25, worstMonthDelta: 0 };
const four = ["hl_window-a", "hl_window-b", "published-a", "published-b"].map(model => ({ model, vetoEpisodes: 25, delta: good }));
assert(qualifyExposure(four, spec).profitUpgrade && qualifyExposure(four, spec).defensiveTradeoff);
four[0] = { ...four[0], delta: { ...good, worstMonthDelta: -501 } };
assert(!qualifyExposure(four, spec).profitUpgrade && !qualifyExposure(four, spec).defensiveTradeoff);
console.log("exposure tests passed: 17 fixed rules, scope/drop/flow/missingness, no-op identity, cap control, causal release, exits, outer gates, prefixes, monthly accounting and advancement");
