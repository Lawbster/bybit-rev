import assert from "assert/strict";
import fs from "fs";
import { DistressExitController, mfiTape, M, TF, type MfiEvidence } from "./mfi-distress-exit-policy";
import { runCausalLongReplay, type ResearchInventoryEvent, type ResearchReductionDecision } from "./replay-causal-engine";
import { exposureMetrics } from "./ladder-exposure-metrics";
import { auditComponentAccounting } from "./ladder-component-accounting";
import type { Series, Candle, EngineParams } from "./hype-freerun-canonical-replay";
const T = Date.UTC(2026, 5, 1), low = (): MfiEvidence => ({ value: 20, sourceEnd: T, availableAt: T });
const policy = { id: "mfi_half", fraction: .5, mfiRequired: true };
const d = (at: number, patch: Partial<ResearchReductionDecision> = {}): ResearchReductionDecision => ({ at, index: 0, episode: 1,
  depth: 11, price: 96, qty: 100, cost: 10000, grossPct: -4, canReduce: true, existingPendingReason: null, ...patch });
function trigger(p = policy, source = low) { const x = new DistressExitController(p, source); assert.equal(x.decide(d(T)), null); return x; }
const cp = trigger(); assert.equal(cp.decide(d(T + 59 * M)), null);
assert.equal(cp.decide(d(T + 60 * M, { grossPct: -1 }))!.fraction, .5, "no second loss threshold at landmark");
assert.equal(cp.decide(d(T + 61 * M)), null); assert.equal(cp.observations.length, 1);
for (const patch of [{ depth: 8 }, { depth: 0 }, { episode: 2 }, { canReduce: false, existingPendingReason: "hard_flatten" }]) {
  const c = trigger(); assert.equal(c.decide(d(T + 60 * M, patch)), null); assert.equal(c.decide(d(T + 61 * M)), null);
}
const missing = trigger(policy, () => ({ value: null, sourceEnd: null, availableAt: null })); assert.equal(missing.decide(d(T + 60 * M)), null);
assert.equal(trigger(policy, () => ({ ...low(), value: 20.00001 })).decide(d(T + 60 * M)), null);
assert.equal(trigger({ id: "blind", fraction: 1, mfiRequired: false }, () => ({ ...low(), value: null })).decide(d(T + 60 * M))!.fraction, 1);
const censor = trigger(); censor.finish(); assert.equal(censor.observations[0].status, "cutoff_before_checkpoint");
const gap = trigger(); assert.equal(gap.decide(d(T + 61 * M)), null); assert.equal(gap.observations[0].status, "checkpoint_missing");
const b = (i: number, price = 100): Candle => ({ ts: T + i * M, endTs: T + (i + 1) * M, open: price, high: price + .01, low: price - .01,
  close: price, volume: 1 + i % 7, turnover: price * (1 + i % 7) });
const cs = Array.from({ length: 540 }, (_, i) => b(i, 100 + Math.sin(Math.floor(i / 30))));
const tape = mfiTape(cs, T), at = T + 16 * TF;
assert.equal(tape(at, 0).sourceEnd, at); assert.equal(tape(at, M).sourceEnd, at - TF);
assert.equal(tape(at + M, M).sourceEnd, at);
assert.deepEqual(tape(at, 0), mfiTape(cs.filter(c => c.endTs <= at), T)(at, 0));
assert.deepEqual(tape(at, 0), mfiTape(cs.map(c => c.ts >= at ? { ...c, volume: 1e10, turnover: 1e12 } : c), T)(at, 0));
assert.throws(() => mfiTape(cs.filter((_, i) => i !== 470), T), /gapped/, "unrepaired feature history must fail closed");
function series(candles: Candle[]): Series { const n = candles.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  return { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50),
    crsi4H: Array(n).fill(50), slope12h: zero(), riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(), ret1h: nil(),
    ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() }; }
const cfg = JSON.parse(fs.readFileSync("bot-config.json", "utf8")); cfg.srPartialExitAction.enabled = false; cfg.srSupportReopenAction.enabled = false;
cfg.srShadow = undefined;
const params: EngineParams = { id: "fixture", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h",
  pullbackMode: "none", tpExecutionModel: "resting_touch", addIntervalMin: 1 };
function run(fraction: number, delay = 0, bars = Array.from({ length: 150 }, (_, i) => b(i, i < 15 ? 100 : i < 80 ? 96 : 96.1))) {
  const c = new DistressExitController({ ...policy, fraction }, low, 0, delay), events: ResearchInventoryEvent[] = [];
  const r = runCausalLongReplay(params, series(bars), { startIdx: 0, recordSnapshots: true, researchReduction: c.decide,
    researchInventoryObserver: e => events.push(e) }, cfg, 32000);
  auditComponentAccounting(bars, events, exposureMetrics(r, 32000), 0, bars.length, 32000, cfg.feeRate, { fraction, fillDelayMs: delay });
  return { r, events, c };
}
const half = run(.5), partial = half.events.find(x => x.event.kind === "partial")!;
assert(partial); assert.equal(partial.after.length, 11); assert.equal(partial.event.fillIndex, partial.event.decisionIndex + 1);
assert.equal(half.r.trims.length, 1); assert.equal(half.r.openDepth, 11);
assert.equal(half.r.executionAudit!.lastAddTime, partial.lastAddTime);
assert(!half.events.some(e => e.event.kind === "open" && e.event.fillAt! > partial.event.fillAt!));
assert.equal(half.r.executionAudit!.srCooldownUntil, 0, "experimental trim does not rewrite S/R clock");
const delayed = run(.5, M).events.find(e => e.event.kind === "partial")!;
assert.equal(delayed.event.fillIndex, delayed.event.decisionIndex + 2);
const full = run(1); assert.equal(full.r.closes.length, 1); assert.equal(full.r.openDepth, 0); assert(full.r.blocked.cooldown > 0);
const longBars = Array.from({ length: 600 }, (_, i) => b(i, i < 15 ? 100 : 96));
const reopened = run(1, 0, longBars), close = reopened.events.find(e => e.event.kind === "close")!, reopen = reopened.events.find(e => e.episode === 2)!;
assert(reopen); assert(reopen.event.fillAt! >= (Math.floor(close.event.fillAt! / (240 * M)) + 2) * 240 * M);
const bas = run(0); assert.equal(bas.r.trims.length, 0);
const plain = runCausalLongReplay(params, series(Array.from({ length: 150 }, (_, i) => b(i, i < 15 ? 100 : i < 80 ? 96 : 96.1))), { startIdx: 0, recordSnapshots: true }, cfg, 32000);
assert.deepEqual(bas.r, plain, "observation-only hook preserves every output byte");
const prefix = Array.from({ length: 77 }, (_, i) => b(i, i < 15 ? 100 : 96));
assert.deepEqual(run(.5, 0, prefix).r.executionAudit!.events, run(.5, 0, [...prefix, b(77, 150)]).r.executionAudit!.events.filter(e => e.fillIndex! < prefix.length));
// An existing emergency supersedes the experimental delayed partial, never vice versa.
const emergency = Array.from({ length: 80 }, (_, i) => b(i, i < 15 ? 100 : i < 76 ? 96 : 80));
const emergencyRun = run(.5, M, emergency);
assert(!emergencyRun.r.trims.length); assert.equal(emergencyRun.r.closes[0].reason, "emergency_kill");
console.log("F02 passed: checkpoint identity/attrition, MFI timing/prefix/gaps, pro-rata fees/clock, no rebuild, cooldown, next-open/delayed fills, exit priority and baseline identity");
