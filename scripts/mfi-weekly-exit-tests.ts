import assert from "assert/strict";
import fs from "fs";
import { weeklyTape, WeeklyExitController, H, type WeeklyEvidence, type WeeklyPolicy } from "./mfi-weekly-exit-policy";
import { DistressExitController, M } from "./mfi-distress-exit-policy";
import { runCausalLongReplay, type ResearchInventoryEvent, type ResearchReductionDecision } from "./replay-causal-engine";
import { exposureMetrics } from "./ladder-exposure-metrics";
import { auditComponentAccounting } from "./ladder-component-accounting";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
const T = Date.UTC(2026, 5, 1), policy: WeeklyPolicy = { id: "mfi_weekly_half", fraction: .5, mfiRequired: true, weeklyRequired: true };
const c = (ts: number, price = 100, volume = 1): Candle => ({ ts, endTs: ts + M, open: price, high: price + .1,
  low: price - .1, close: price, volume, turnover: price * volume });
const cs = Array.from({ length: 8 * 1440 }, (_, i) => c(T + i * M, i < 7 * 1440 ? 100 + (i % 360) / 1000 : 90));
const tape = weeklyTape(cs, T), at = T + 6 * H;
assert.equal(tape(at - 1, 0).sourceEnd, at - H); assert.equal(tape(at, 0).sourceEnd, at);
assert.equal(tape(at, M).sourceEnd, at - H); assert.equal(tape(at + M, M).sourceEnd, at);
assert.equal(tape(T + M, 0).ready, false, "No developing first hour");
const monday = T + 7 * 1440 * M;
assert.equal(tape(monday, 0).weekStart, T, "Midnight query uses completed Sunday hour, not new Monday");
assert.equal(tape(monday + H, 0).weekStart, monday); assert.equal(tape(monday + H, 0).vwap, 90);
assert.equal(tape(monday + H, 0).passes, false, "Equality with weekly VWAP does not pass");
assert.equal(tape(monday + H, M).weekStart, T, "Unpublished Monday hour retains last Sunday context");
assert.deepEqual(tape(at, 0), weeklyTape(cs.filter(x => x.endTs <= at), T)(at, 0));
assert.deepEqual(tape(at, 0), weeklyTape(cs.map(x => x.ts >= at ? c(x.ts, 1e6, 1e9) : x), T)(at, 0));
assert.equal(weeklyTape(cs.filter(x => x.ts >= T + H), T + H)(T + 8 * H, 0).ready, false, "Incomplete first UTC week is unknown");
assert.equal(weeklyTape(cs.map(x => ({ ...x, volume: 0, turnover: 0 })), T)(at, 0).ready, false);
assert.throws(() => weeklyTape(cs.filter((_, i) => i !== 133), T), /gapped/);
const constant = Array.from({ length: 420 }, (_, i) => c(T + i * M));
// Hour6 closes99, equal to hour1's99 but below cumulative week's higher average: ROC zero passes.
const zeroRoc = constant.map((x, i) => c(x.ts, i < 60 || i >= 300 && i < 360 ? 99 : 101));
assert.equal(weeklyTape(zeroRoc, T)(T + 6 * H, 0).roc5, 0); assert.equal(weeklyTape(zeroRoc, T)(T + 6 * H, 0).passes, true);
assert.throws(() => tape(at, -M));
const good: WeeklyEvidence = { sourceStart: T, sourceEnd: T + H, availableAt: T + H, weekStart: T, close: 95,
  vwap: 100, distancePct: -5, roc5: -1, rocAnchorEnd: T - 4 * H, ready: true, passes: true };
const mfi = () => ({ value: 20, sourceEnd: T, availableAt: T });
const d = (at: number, patch: Partial<ResearchReductionDecision> = {}): ResearchReductionDecision => ({ at, index: 0, episode: 1, depth: 11,
  price: 96, qty: 100, cost: 10000, grossPct: -4, canReduce: true, existingPendingReason: null, ...patch });
for (const ev of [good, { ...good, passes: false }, { ...good, ready: false, passes: null }]) {
  const x = new WeeklyExitController(policy, mfi, () => ev); assert.equal(x.decide(d(T)), null);
  const act = x.decide(d(T + H, { grossPct: -1 })); assert.equal(!!act, ev.ready && ev.passes === true);
  assert.equal(x.decide(d(T + H + M)), null, "No later search after veto");
  assert.equal(x.observations.length, 1);
}
const never = () => { throw new Error("Context should not be queried"); };
for (const patch of [{ depth: 8 }, { depth: 0 }, { episode: 2 }, { canReduce: false, existingPendingReason: "emergency_kill" }]) {
  const x = new WeeklyExitController(policy, mfi, never); x.decide(d(T)); assert.equal(x.decide(d(T + H, patch)), null);
}
const highMfi = new WeeklyExitController(policy, () => ({ ...mfi(), value: 21 }), never); highMfi.decide(d(T)); assert.equal(highMfi.decide(d(T + H)), null);
for (const fraction of [0, .5]) {
  const p = { ...policy, id: fraction ? "mfi_half" : "baseline", fraction, weeklyRequired: false };
  const a = new WeeklyExitController(p, mfi, never), b = new DistressExitController(p, mfi);
  for (const t of [T, T + H, T + H + M]) assert.deepEqual(a.decide(d(t)), b.decide(d(t)));
  assert.deepEqual(a.observations, b.observations, "Controls preserve original observations exactly");
}
function series(candles: Candle[]): Series { const n = candles.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  return { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50),
    crsi4H: Array(n).fill(50), slope12h: zero(), riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(), ret1h: nil(),
    ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() }; }
const cfg = JSON.parse(fs.readFileSync("bot-config.json", "utf8")); cfg.srPartialExitAction.enabled = false; cfg.srSupportReopenAction.enabled = false; cfg.srShadow = undefined;
const params: EngineParams = { id: "fixture", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h",
  pullbackMode: "none", tpExecutionModel: "resting_touch", addIntervalMin: 1 };
const bars = Array.from({ length: 150 }, (_, i) => c(T + i * M, i < 15 ? 100 : i < 80 ? 96 : 96.1));
function run(pass: boolean, delay = 0, candles = bars) {
  const x = new WeeklyExitController(policy, mfi, () => ({ ...good, passes: pass }), 0, delay), events: ResearchInventoryEvent[] = [];
  const r = runCausalLongReplay(params, series(candles), { startIdx: 0, recordSnapshots: true, researchReduction: x.decide,
    researchInventoryObserver: e => events.push(e) }, cfg, 32000);
  auditComponentAccounting(candles, events, exposureMetrics(r, 32000), 0, candles.length, 32000, cfg.feeRate, { fraction: .5, fillDelayMs: delay });
  return { r, events };
}
const accepted = run(true), partial = accepted.events.find(e => e.event.kind === "partial")!; assert(partial);
assert.equal(partial.event.fillIndex, partial.event.decisionIndex + 1); assert.equal(partial.after.length, 11);
assert(!accepted.events.some(e => e.event.kind === "open" && e.episode === partial.episode && e.event.fillAt! > partial.event.fillAt!));
const delayed = run(true, M).events.find(e => e.event.kind === "partial")!; assert.equal(delayed.event.fillIndex, delayed.event.decisionIndex + 2);
const rejected = run(false), plain = runCausalLongReplay(params, series(bars), { startIdx: 0, recordSnapshots: true }, cfg, 32000);
assert.deepEqual(rejected.r, plain, "Veto has zero effect on TP/add clocks, quantity, fees or no-add latch");
const emergencyBars = Array.from({ length: 80 }, (_, i) => c(T + i * M, i < 15 ? 100 : i < 76 ? 96 : 80));
const emergency = run(true, M, emergencyBars); assert.equal(emergency.r.trims.length, 0); assert.equal(emergency.r.closes[0].reason, "emergency_kill");
console.log("F04 tests passed: closed clocks, Monday rollover/delay, raw volume convention, equality, missing/zero/gapped/future inputs, controls, one-shot veto, next-open partial and emergency priority");
