import fs from "fs";
import assert from "assert/strict";
import { runCausalLongReplay as original } from "./replay-causal-engine";
import { runCausalLongReplay as study, type CausalRunOptions } from "./aggressive10-cooldown-engine";
import { verifyStudyDerivatives } from "./aggressive10-cooldown-source";
import { CONTROLS, VARIANTS, config, HIGH_REASON, validate, reopenAttribution } from "./aggressive10-cooldown-policy";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
const M = 60000, H = 60 * M, T = Date.parse("2026-06-01T00:00Z");
verifyStudyDerivatives();
const cfg = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
for (const p of VARIANTS) assert.deepEqual(config(cfg, p), config(cfg, CONTROLS[2]), "Only research close clock differs from parent config");
const c = config(cfg, CONTROLS[2]);
c.srPartialExitAction!.enabled = false; c.srSupportReopenAction!.enabled = false;
c.addThrottle!.enabled = false; c.filters.overextendedEntry!.enabled = false;
function series(n = 700, price = 100): Series {
  const candles: Candle[] = Array.from({ length: n }, (_, i) => ({ ts: T + i * M, endTs: T + (i + 1) * M,
    open: price, close: price, high: price, low: price, volume: 1, turnover: price }));
  const no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  return { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50),
    crsi4H: Array(n).fill(50), slope12h: zero(), riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(),
    ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
const params: EngineParams = { id: "c1-synthetic", maxPositions: 1, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "resting_touch" };
function run(hours?: 1 | 2, s = series(), reason = HIGH_REASON, fraction = 1, ref = false) {
  const events: any[] = [], cooldowns: any[] = [];
  const opts: CausalRunOptions = { startIdx: 0, recordSnapshots: true, seed: { ts: T - 13 * H, price: 100 },
    researchHighExitCooldownHours: hours, researchCooldownObserver: row => cooldowns.push(row),
    researchInventoryObserver: e => events.push(e), researchReduction: d => d.index === 2 && d.canReduce ? { fraction, reason } : null };
  return { result: (ref ? original : study)(params, s, opts, c, 32000), events, cooldowns };
}
assert.deepEqual(run().result, run(undefined, series(), HIGH_REASON, 1, true).result, "Absent option exactly matches original");
for (const hours of [1, 2] as const) {
  const r = run(hours), close = r.cooldowns[0], entry = r.events.find(e => e.event.kind === "open");
  assert.equal(close.at, T + 3 * M); assert.equal(close.until, close.at + hours * H);
  assert.equal(close.inheritedUntil, T + 8 * H); assert.equal(entry.event.decisionAt, close.until);
  assert(entry.event.fillIndex > entry.event.decisionIndex); assert(entry.event.fillIndex > close.index);
  const late = series(); late.trendBlocked.fill(true, 0, 200);
  assert.equal(run(hours, late).events.find(e => e.event.kind === "open").event.decisionAt, T + 201 * M, "Trend remains authoritative");
  for (const gate of ["riskOffBlocked", "regimeFlat"] as const) { const s = series(); s[gate].fill(true, 0, 210);
    assert.equal(run(hours, s).events.find(e => e.event.kind === "open").event.decisionAt, T + 211 * M); }
  const other = run(hours, series(), "research_exit:other");
  assert.equal(other.cooldowns[0].until, other.cooldowns[0].inheritedUntil, "Other research exits unaffected");
  const partial = run(hours, series(), HIGH_REASON, .5); assert.equal(partial.cooldowns.length, 0, "Partial never starts or resets full-close clock");
  assert(partial.events.some(e => e.event.kind === "partial"));
  for (const price of [90, 85]) { const s = series(700, price); s.trendBlocked.fill(true);
    const r = run(hours, s); assert(["hard_flatten", "emergency_kill"].includes(r.cooldowns[0].reason));
    assert.equal(r.cooldowns[0].until, r.cooldowns[0].inheritedUntil); }
  const tp = run(hours, series(700, 102)); assert.equal(tp.cooldowns[0].reason, "tp"); assert.equal(tp.cooldowns[0].until, 0);
  const prefix = run(hours, series(250)); assert.deepEqual(prefix.events, r.events.filter(e => e.event.fillIndex < 250));
}
assert.throws(() => run(0 as any)); assert.throws(() => run(4 as any));
validate(JSON.parse(fs.readFileSync("research-inputs/aggressive10-cooldown-2026-09-11.json", "utf8")).definition);
assert.equal(reopenAttribution([], [], { episodes: [] }, T).earlyReopens, 0);
console.log("AG10-C1 passed: exact source deltas/default parity, fill-time1h/2h and boundary, no same-bar reopen, trend/risk/latch, TP/other/partial/emergency/hard preservation, completed-prefix and invalid options");
