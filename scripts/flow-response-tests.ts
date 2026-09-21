import assert from "assert/strict";
import fs from "fs";
import { FlowResponseTape, approvedSize, VARIANTS, M, validate, type R } from "./flow-response-policy";
import { runCausalLongReplay, type ResearchInventoryEvent } from "./replay-causal-engine";
import { exposureMetrics } from "./ladder-exposure-metrics";
import { auditFlowLedger } from "./flow-response-audit";
import { RawFlowReference, checkFeature } from "./flow-response-verify";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
import type { BotConfig } from "../src/bot/bot-config";
validate(JSON.parse(fs.readFileSync("research-inputs/flow-response-fr01-2026-09-14.json", "utf8")).definition);
const D = Date.parse("2026-07-01T00:00:00Z"), T = D - M;
function row(j: number, patch: R = {}): R { const end = T - j * M; return { symbol: "HYPEUSDT", venue: "hyperliquid", timestamp: end,
  windowEnd: end, windowStart: end - M, intervalMs: M, buyNotional: 20, sellNotional: j < 15 ? 200 : 100,
  buyVol: 1, sellVol: 1, buyCount: 1, sellCount: 1, firstTradeTime: end - M, lastTradeTime: end - 1, ...patch }; }
function tape(patch?: (j: number) => R | null) { const t = new FlowResponseTape(); for (let j = 0; j < 60; j++) { const p = patch?.(j); if (p !== null) t.add(row(j, p), j + 1); } return t; }
const price = (end: number) => end === T ? 99 : 100;
const f = tape().at(D, 0, price); assert(f.ready && f.acceleration && f.impact);
assert.equal(f.recentSell, 3000); assert.equal(f.priorSell, 4500); assert.equal(f.sellRateRatio, 2); assert.equal(f.sellShare, 3000 / 3300);
assert.equal(f.end, T); assert.equal(f.latestAvailable, D); assert.equal(f.validMinutes, 60);
assert.equal(f.response, "selling_with_impact");
const absorption = tape().at(D, 0, () => 100); assert.equal(absorption.response, "absorption_compatible");
const decline = tape().at(D, 0, end => end === T ? 99.9 : 100); assert.equal(decline.response, "small_decline");
assert(!tape(() => ({ sellNotional: 100 })).at(D, 0, price).acceleration);
assert(!tape(j => ({ buyNotional: j < 15 ? 500 : 20 })).at(D, 0, price).acceleration);
for (const p of [{ sellNotional: -1 }, { buyVol: null }, { sellCount: 1.5 }, { partial: true }, { complete: false },
  { firstTradeTime: T + 1 }, { lastTradeTime: T }, { windowStart: T - M + 1 }]) {
  const x = tape(j => j === 0 ? p : {}).at(D, 0, price); assert(!x.ready && x.reasons.includes("invalid_window"));
}
for (const p of [{ receivedAt: D + 1 }, { availableAt: D + M }, null]) {
  const x = tape(j => j === 0 ? p : {}).at(D, 0, price); assert(!x.ready && x.reasons.includes("missing_or_not_yet_available"));
}
const dupe = tape(); dupe.add(row(0), 61); assert(dupe.at(D, 0, price).reasons.includes("duplicate_window"));
const laterDupe = tape(); laterDupe.add(row(0, { availableAt: D + M, sellNotional: 999999 }), 61);
assert.deepEqual(laterDupe.at(D, 0, price), f, "late correction must not rewrite an earlier decision");
const poisoned = tape(); for (let j = -20; j < 0; j++) poisoned.add(row(j, { sellNotional: 1e15 }), 100 - j);
assert.deepEqual(poisoned.at(D, 0, price), f, "future flow cannot alter prefix");
const more = tape(); more.add(row(60), 61); const lag = more.at(D, M, () => 100);
assert(lag.ready); assert.equal(lag.end, T - M); assert(lag.latestAvailable <= D - M); assert.equal(lag.recentSell, 2900);
assert(!tape(() => ({ sellNotional: 0 })).at(D, 0, price).ready);
assert(!tape().at(D, 0, () => null).ready); assert(!tape().at(D, 0, () => Infinity).ready);
assert.throws(() => tape().at(D + 1, 0, price));
const add = { nextDepth: 8, requestedNotional: 800 };
for (const v of VARIANTS) {
  assert.deepEqual(approvedSize(v, add, f), { fire: true, notional: 800 * v.fraction });
  assert(!approvedSize(v, { ...add, nextDepth: 7 }, f).fire); assert(!approvedSize(v, add, { ...f, ready: false }).fire);
  assert.equal(approvedSize(v, add, absorption).fire, !v.requireImpact);
  assert.equal(approvedSize(v, add, decline).fire, !v.requireImpact);
}
assert.deepEqual(approvedSize(null, add, f), { fire: false, notional: 800 });
for (const patches of [() => ({}), (j: number) => j === 0 ? { receivedAt: D + 1 } : {}, (j: number) => j === 10 ? { sellNotional: -1 } : {}]) {
  const reference = new RawFlowReference(); for (let j = 0; j < 60; j++) reference.add(row(j, patches(j)), j + 1);
  checkFeature(tape(patches).at(D, 0, price), reference.at(D, 0, price));
}

const cfg: BotConfig = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
cfg.srPartialExitAction!.enabled = false; cfg.srSupportReopenAction!.enabled = false; cfg.deepAddStressGuard!.enabled = false;
cfg.addIntervalMin = 1; cfg.priceTriggerPct = .3; cfg.addThrottle!.enabled = false;
function bar(i: number, price = 100): Candle { return { ts: D + i * M, endTs: D + (i + 1) * M, open: price, close: price, high: price + .01, low: price - .01, volume: 1, turnover: price }; }
function series(candles: Candle[]): Series { const n = candles.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  return { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50), crsi4H: Array(n).fill(50), slope12h: zero(),
    riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(), ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() }; }
const p: EngineParams = { id: "FR01-fixture", executionModel: "causal_next_open", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "close_confirmed" };
const cs = Array.from({ length: 17 }, (_, i) => bar(i, i >= 14 ? 102 : 100)), s = series(cs), opts = { startIdx: 0, recordSnapshots: true };
function replay(onAdd: (a: R) => number, input = s) {
  const events: ResearchInventoryEvent[] = [], attempts: R[] = [];
  const r = runCausalLongReplay(p, input, { ...opts, researchInventoryObserver: e => events.push(e), researchAddSize: a => {
    assert(Object.isFrozen(a)); const approvedNotional = onAdd(a); attempts.push({ ...a, approvedNotional }); return approvedNotional;
  } }, cfg, 32000);
  auditFlowLedger(input.candles, events, attempts, exposureMetrics(r, 32000), 0, input.candles.length);
  return { r, attempts, events };
}
const base = runCausalLongReplay(p, s, opts, cfg, 32000), inert = replay(a => a.requestedNotional);
assert.deepEqual(inert.r, base);
const half = replay(a => approvedSize(VARIANTS[0], { nextDepth: a.nextDepth, requestedNotional: a.requestedNotional }, f).notional);
assert.equal(half.r.maxDepthSeen, 11); assert.equal(half.r.closes.length, 1);
for (const a of half.attempts) assert.equal(a.approvedNotional, a.requestedNotional * (a.nextDepth >= 8 ? .5 : 1));
const one = replay(a => a.requestedNotional * (a.nextDepth === 8 ? .5 : 1));
assert.equal(one.attempts.find(a => a.nextDepth === 9)!.approvedNotional, 800 * 1.35 ** 8, "half rung does not leave a deferred remainder");
const block = replay(a => a.nextDepth >= 8 && a.index < 10 ? 0 : a.requestedNotional);
const released = block.events.find(e => e.event.kind === "open" && e.after.length === 8)!;
assert.equal(released.event.decisionIndex, 10); assert.equal(released.event.fillIndex, 11); assert.equal(block.r.closes.length, 1);
const emergency = replay(a => a.nextDepth >= 8 ? 0 : a.requestedNotional, series(Array.from({ length: 16 }, (_, i) => bar(i, i >= 13 ? 80 : 100))));
assert.equal(emergency.r.closes[0].reason, "emergency_kill");
const outer = series(cs); outer.trendBlocked.fill(true); replay(() => { throw Error("outer gate bypassed"); }, outer);
const prefix = replay(a => a.requestedNotional, series(cs.slice(0, 13)));
assert.deepEqual(prefix.attempts, inert.attempts.filter(a => a.index < 13));
assert.deepEqual(prefix.events, inert.events.filter(e => e.event.fillIndex! < 13));
console.log("FR01 tests passed: window arithmetic, acceleration/absorption, half/block scope, availability/late corrections, future poison/prefix, missing/duplicate/invalid data, actual engine no-op/size/release/emergency/outer gates, independent fee/DD/month ledger.");
