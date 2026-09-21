import assert from "assert/strict";
import fs from "fs";
import { POLICIES, COMBINATIONS, legs, requestedSize, runConfig, WEEKLY_POLICY, HIGH_POLICY, validateCombinationCard } from "./ladder-combination-policy";
import { acceptedSingles } from "./hype-ladder-combination-study";
import { SoftStaleController } from "./conditional-soft-stale-policy";
import { WeeklyExitController } from "./mfi-weekly-exit-policy";
import { HighController } from "./near-high-policy";
import { runCausalLongReplay } from "./replay-causal-engine";
import { auditCombinationAccounting } from "./ladder-combination-accounting";
import { auditComponentAccounting } from "./ladder-component-accounting";
import { exposureMetrics } from "./ladder-exposure-metrics";
import type { Series, Candle } from "./hype-freerun-canonical-replay";
const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8")), card = read("research-inputs/winning-ladder-combinations-2026-09-11.json"), cfg = read("bot-config.json");
validateCombinationCard(card.definition); assert.equal(acceptedSingles(card.definition, read).length, 28);
assert.equal(POLICIES.length, 15); assert.equal(COMBINATIONS.length, 8); assert.throws(() => legs("age8__minus_soft_stale"));
const original = JSON.stringify(cfg), T = Date.UTC(2026, 5, 1), M = 60000;
for (const p of POLICIES) {
  const c = runConfig(cfg, p); assert.equal(JSON.stringify(cfg), original);
  assert.equal(c.exits.softStale, !legs(p).includes("minus_soft_stale"));
  assert.equal(c.deepAddStressGuard!.enabled, !legs(p).includes("minus_deep_stress"));
  c.exits.softStale = cfg.exits.softStale; c.deepAddStressGuard!.enabled = cfg.deepAddStressGuard.enabled; assert.deepEqual(c, cfg);
  for (const nextDepth of [1, 8, 10, 11]) for (const priceDropOk of [true, false]) {
    const n = 800 * 1.35 ** (nextDepth - 1), d: any = { nextDepth, requestedNotional: n, priceDropOk };
    assert.equal(requestedSize(p, d), n * (legs(p).includes("last11_50") && nextDepth === 11 ? .5 : 1));
  }
}
const bars: Candle[] = Array.from({ length: 560 }, (_, i) => ({ ts: T + i * M, endTs: T + (i + 1) * M,
  open: i > 510 ? 102 : 100, close: i > 510 ? 102 : 100, high: i > 510 ? 102.1 : 100.1, low: i > 510 ? 101.9 : 99.9, volume: 1, turnover: 100 }));
function s(cs: Candle[]): Series {
  const n = cs.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  return { candles: cs, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50),
    crsi4H: Array(n).fill(50), slope12h: zero(), riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(),
    ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
function run(p: string, cs: Candle[]) {
  const c = runConfig(cfg, p); c.srPartialExitAction!.enabled = false; c.srSupportReopenAction!.enabled = false; c.addThrottle!.enabled = false; c.addIntervalMin = 1;
  const l = legs(p), age = l.includes("age8") ? new SoftStaleController("age", 8, 0, () => { throw Error("age never reads indicator"); }) : null;
  const hi = l.includes("exit_2d_1pct") ? new HighController(HIGH_POLICY, (i, at, price) => ({ high: price, distancePct: 0, availableAt: at })) : null;
  const cut = l.includes("mfi_weekly_half") ? new WeeklyExitController(WEEKLY_POLICY, () => ({ value: null, sourceEnd: null, availableAt: null }), () => { throw Error("unknownMFI must reject before weekly"); }) : null;
  const events: any[] = [];
  const r = runCausalLongReplay({ id: p, maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "resting_touch" }, s(cs), {
    startIdx: 0, recordSnapshots: true, partialClockModel: "transactional", researchTpDeferral: age?.decide, researchAddSize: d => requestedSize(p, d),
    researchReduction: cut?.decide ?? hi?.reduce, researchInventoryObserver: e => { hi?.observe(e); events.push(e); }
  }, c, 32000);
  const m = exposureMetrics(r, 32000), a = auditCombinationAccounting(cs, events, m, 0, cs.length, 32000, .00055, { fraction: cut ? .5 : 1, fillDelayMs: 0 }, l.includes("last11_50"));
  if (!l.includes("last11_50")) assert.deepEqual(a, auditComponentAccounting(cs, events, m, 0, cs.length, 32000, .00055, { fraction: cut ? .5 : 1, fillDelayMs: 0 }));
  return { r, events };
}
for (const p of POLICIES) {
  const short = run(p, bars.slice(0, 300)), full = run(p, bars);
  assert.deepEqual(short.events, full.events.filter(e => e.event.fillIndex < 300), `future candles changed ${p}`);
  for (const e of full.events.filter(e => e.event.kind === "open")) assert.equal(e.event.fillIndex, e.event.decisionIndex + 1);
  if (legs(p).includes("last11_50")) {
    const deep = full.events.find(e => e.after.length === 11 && e.event.kind === "open"); assert(deep);
    assert(Math.abs(deep.event.qty * deep.event.price - 800 * 1.35 ** 10 / 2) < 1e-7);
  }
  if (legs(p).includes("exit_2d_1pct")) {
    const close = full.events.find(e => e.event.reason === "research_exit:exit_2d_1pct"); assert(close);
    assert.equal(close.event.decisionAt - close.before[0].entryTime, 4 * 3600000);
  }
}
console.log("L13 frozen definitions, config isolation, composition, size/fee accounting, priority and causal-prefix tests passed");
