import assert from "assert/strict";
import fs from "fs";
import { RecoveryController, type Policy, type Sources } from "./recovery-mechanism-policy";
import { RecoveryPulseTape, priceFrame, M, B, type Frame } from "./recovery-mechanism-sources";
import { runCausalLongReplay, type ResearchReductionDecision, type ResearchInventoryEvent } from "./replay-causal-engine";
import { ReplayMarketInputs } from "./replay-market-inputs";
import { exposureMetrics } from "./ladder-exposure-metrics";
import { auditComponentAccounting } from "./ladder-component-accounting";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
const spec = JSON.parse(fs.readFileSync("research-inputs/recovery-mechanisms-2026-09-10.json", "utf8"));
const T = Date.UTC(2026, 5, 1), d = (n: number, patch: Partial<ResearchReductionDecision> = {}): ResearchReductionDecision => ({
  at: T + n * B, index: n * 5, episode: 1, depth: 9, price: 98, qty: 100, cost: 10000, grossPct: -2, canReduce: true, existingPendingReason: null, ...patch });
function controller(family: Policy["family"], frames: Partial<Frame>[], action: Policy["action"] = "half_freeze", pulseHealthy = true, delay = 0) {
  const sources: Sources = {
    frame: at => { const n = Math.floor((at - T) / B); return { end: T + n * B, availableAt: T + n * B, open: 98, high: 99, low: 97,
      close: 98, roc15: -1, prior15High: 100, ...frames[n] }; },
    support: () => ({ price: 97, knownAt: T - B, observedAt: T, distancePct: 1 }),
    pulse: at => ({ at, flowHealthy: pulseHealthy, oiHealthy: pulseHealthy, ratio: family === "buy_failure" ? 1.3 : 0.8 - (at - T) / B * .01, nativeOi1hPct: 0 })
  };
  return new RecoveryController({ id: family, family, action, hl: ["buy_failure", "sell_oi"].includes(family) }, spec.event, sources, 0, delay);
}
const supportBars = [{}, { close: 96.8, low: 96.7 }, { high: 97, close: 96.8, low: 96.6 }, { close: 96.4, low: 96.3 }];
for (const action of ["freeze", "half_freeze"] as const) {
  const c = controller("support", supportBars, action); for (let n = 0; n < 3; n++) assert.equal(c.decide(d(n)), null);
  const r = c.decide(d(3)); assert.equal(!!r, action === "half_freeze"); assert.equal(c.observations.filter(x => x.status === "signal").length, 1);
  const v = { at: T + 3 * B, episode: 1 } as any; assert.equal(c.veto(v), action === "freeze");
  assert.equal(c.veto({ ...v, episode: 2 }), false); assert.equal(c.decide(d(4)), null, "one signal per episode");
}
const bounce = controller("rebound", [{ close: 98 }, { close: 97 }, { close: 97.6, low: 97.4 }, { close: 97.2 }]);
for (let i = 0; i < 3; i++) assert.equal(bounce.decide(d(i)), null); assert(bounce.decide(d(3)));
for (const family of ["buy_failure", "sell_oi"] as const) {
  const c = controller(family, [{}, { low: 97.2, high: 98.4 }, { close: 97 }]);
  assert.equal(c.decide(d(0)), null); assert.equal(c.decide(d(1)), null, "pressure itself is not exit"); assert(c.decide(d(2)));
  const missing = controller(family, [{}, {}, { close: 90 }], "half_freeze", false); missing.decide(d(0)); missing.decide(d(1));
  assert.equal(missing.decide(d(2)), null); assert(missing.observations.some(x => x.reason === "pulse_unknown"));
}
for (const patch of [{ depth: 5 }, { depth: 0 }, { grossPct: 0 }, { episode: 2, depth: 0 }]) {
  const c = controller("support", supportBars); c.decide(d(0)); c.decide(d(1, patch)); c.decide(d(2)); assert.equal(c.decide(d(3)), null);
}
const reclaimed = controller("support", [{}, { close: 96.8 }, { close: 97.2 }, { close: 90 }]);
for (let i = 0; i < 4; i++) assert.equal(reclaimed.decide(d(i)), null); assert(reclaimed.observations.some(x => x.reason === "support_reclaimed"));
const emergency = controller("support", supportBars); for (let i = 0; i < 3; i++) emergency.decide(d(i));
assert.equal(emergency.decide(d(3, { canReduce: false, existingPendingReason: "emergency_kill" })), null);
const expired = controller("support", supportBars); expired.decide(d(0)); assert.equal(expired.decide(d(73)), null); assert(expired.observations.some(x => x.reason === "expired"));
const gap = controller("support", supportBars); gap.decide(d(0)); assert.equal(gap.decide(d(2)), null); assert(gap.observations.some(x => x.reason === "frame_gap"));
const freeze = controller("support", supportBars, "freeze", true, M); for (let i = 0; i < 4; i++) freeze.decide(d(i));
assert.equal(freeze.veto({ at: T + 3 * B, episode: 1 } as any), false); assert(freeze.veto({ at: T + 3 * B + M, episode: 1 } as any));
function bar(ts: number, price = 100): Candle { return { ts, endTs: ts + M, open: price, high: price + .1, low: price - .1, close: price, volume: 1, turnover: price }; }
const raw = Array.from({ length: 60 }, (_, i) => bar(T + i * M, 100 + i / 100));
const at = T + 40 * M;
assert.deepEqual(priceFrame(raw, at, 0), priceFrame(raw.filter(c => c.endTs <= at), at, 0));
assert.deepEqual(priceFrame(raw, at, 0), priceFrame(raw.map(c => c.ts >= at ? bar(c.ts, 1e6) : c), at, 0));
assert.equal(priceFrame(raw, at, M)!.end, at - B); assert.equal(priceFrame(raw, at + M, M)!.end, at);
assert.equal(priceFrame(raw.filter(c => c.ts !== at - 2 * M), at, 0), null);
const tape = new RecoveryPulseTape(spec.quality);
for (let n = 1; n < 16; n++) tape.add("hlTaker", { timestamp: T + n * M, windowStart: T + (n - 1) * M, windowEnd: T + n * M,
  buyNotional: 10, sellNotional: 20, buyVol: 1, sellVol: 2, buyCount: 1, sellCount: 1 }, "fixture", n);
tape.seal(); assert.equal(tape.snapshot(T + 15 * M, 0).samples, 14); assert(tape.snapshot(T + 15 * M, 0).flowHealthy);
assert.equal(tape.snapshot(T + 15 * M, M).samples, 13); assert.equal(tape.snapshot(T + 15 * M, M).flowHealthy, false);
// Actual engine integration: research partial -> ordinary S/R trim -> ordinary adds allowed only in the opt-in control.
const candles = Array.from({ length: 1480 }, (_, i) => bar(T + i * M, 100 + Math.sin(i / 60)))
  .concat(Array.from({ length: 20 }, (_, i) => bar(T + (1480 + i) * M, i === 7 ? 100.85 : i >= 8 ? 100.7 : 100)));
const n = candles.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
const s: Series = { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50),
  crsi4H: Array(n).fill(50), slope12h: zero(), riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(), ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
const market = new ReplayMarketInputs(); market.add("bnTaker", { timestamp: T + 1480 * M, buyVol: 1, sellVol: 2 }); market.seal(); s.marketInputs = market;
const cfg = JSON.parse(fs.readFileSync("bot-config.json", "utf8")); cfg.srSupportReopenAction.enabled = false; cfg.srShadow.recentDays = .5;
const params: EngineParams = { id: "test", maxPositions: 6, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "resting_touch", addIntervalMin: 1 };
function run(mode?: "ordinary" | "freeze") {
  const events: ResearchInventoryEvent[] = [];
  const r = runCausalLongReplay(params, s, { startIdx: 1480, recordSnapshots: true, researchPartialAddPolicy: mode,
    researchReduction: d => d.index === 1486 ? { fraction: .5, reason: "research_exit:test" } : null, researchInventoryObserver: e => events.push(e) }, cfg, 32000);
  auditComponentAccounting(candles, events, exposureMetrics(r, 32000), 1480, n, 32000, cfg.feeRate, { fraction: .5, fillDelayMs: 0 }); return { r, events };
}
const locked = run(), ordinary = run("ordinary"); assert.deepEqual(locked, run("freeze"));
assert(!locked.events.some(e => e.event.kind === "open" && e.event.fillIndex! > 1486));
assert(ordinary.events.some(e => e.event.kind === "open" && e.event.fillIndex! > 1486));
assert.equal(locked.r.openDepth, 3); assert.equal(ordinary.r.openDepth, 6);
console.log("F05 tests passed: four sequential mechanisms, distinct bars, one shot, gap/unknown/recovery/expiry/priority, freeze clock, raw prefix/future frames, HL lag, opt-in add-lock isolation and independent fees/inventory");
