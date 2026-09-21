import assert from "assert/strict";
import fs from "fs";
import { CONTROLS, VARIANTS, POLICIES, PARENT, AgeHighController, config, size } from "./age-high-refinement-policy";
import { SoftStaleController } from "./conditional-soft-stale-policy";
import { highFeature, trailingHighIndices } from "./near-high-policy";
import { auditAgeHighTargets, auditAgeHighExits, rawHighs } from "./age-high-refinement-audit";
import { runCausalLongReplay } from "./replay-causal-engine";
import { exposureMetrics } from "./ladder-exposure-metrics";
import { auditCombinationAccounting } from "./ladder-combination-accounting";
import type { Candle, Series } from "./hype-freerun-canonical-replay";
const cfg = JSON.parse(fs.readFileSync("bot-config.json", "utf8")), original = JSON.stringify(cfg), M = 60000, T = Date.UTC(2026, 5, 1);
assert.equal(VARIANTS.length, 24); assert.equal(CONTROLS.length, 6); assert.equal(new Set(POLICIES.map(p => p.id)).size, 30);
for (const p of POLICIES) {
  const c = config(cfg, p); assert.equal(JSON.stringify(cfg), original);
  for (const [leg, field] of [["minus_deep_stress", "deepAddStressGuard"], ["minus_sr_partial", "srPartialExitAction"], ["minus_tp_cooldown", "tpCooldown"]]) {
    assert.equal((c as any)[field].enabled, !p.legs.includes(leg)); (c as any)[field].enabled = true;
  }
  assert.deepEqual(c, cfg);
  for (let n = 1; n <= 11; n++) assert.equal(size(p, { requestedNotional: 800 * 1.35 ** (n - 1), nextDepth: n } as any), 800 * 1.35 ** (n - 1) * (p.legs.includes("last11_50") && n === 11 ? .5 : 1));
}
const cs: Candle[] = Array.from({ length: 10000 }, (_, i) => ({ ts: T + i * M, endTs: T + (i + 1) * M, open: 100, close: 100,
  high: 101 + (i * 37 % 137) / 100, low: 99, volume: 1, turnover: 100 }));
for (const days of [1, 2, 3, 5, 6]) {
  const fast = trailingHighIndices(cs, days * 1440), independent = rawHighs(cs, days), prefix = trailingHighIndices(cs.slice(0, 9200), days * 1440);
  assert.deepEqual(fast.slice(0, 9200), prefix);
  for (let i = 0; i < cs.length; i++) assert.equal(fast[i] < 0 ? 0 : cs[fast[i]].high, independent[i]);
  const i = 9500, primary = highFeature(cs, fast, i, days, cs[i].endTs, 100, 0)!, delayed = highFeature(cs, fast, i, days, cs[i].endTs, 100, M)!;
  assert.equal(delayed.sourceEnd, primary.sourceEnd - M); assert.equal(delayed.availableAt, cs[i].endTs);
}
const parent = CONTROLS.find(p => p.id === PARENT)!;
for (const p of VARIANTS.filter(p => p.days)) {
  let value: any = null;
  const h = new AgeHighController(p, () => value);
  h.observe({ before: [], after: [{ entryTime: T }] } as any);
  const d: any = { at: T + p.exitAgeHours * 3600000, index: 123, episode: 1, depth: 1, canReduce: true, price: 100 };
  assert.equal(h.reduce(d), null, "unknown cannot cause close"); value = { distancePct: p.proximityPct };
  assert.equal(h.reduce({ ...d, at: d.at - M }), null); assert.equal(h.reduce({ ...d, canReduce: false }), null);
  assert.equal(h.reduce(d)?.fraction, 1); value.distancePct += .00001; assert.equal(h.reduce(d), null);
}
function series(candles: Candle[]): Series {
  const n = candles.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  return { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50),
    crsi4H: Array(n).fill(50), slope12h: zero(), riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(),
    ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
const synthetic = cs.slice(0, 850).map((c, i) => ({ ...c, high: 100.01, low: 99.99 }));
function run(p: typeof parent, bars: Candle[]) {
  const c = config(cfg, p); c.srPartialExitAction!.enabled = false; c.srSupportReopenAction!.enabled = false; c.addThrottle!.enabled = false; c.addIntervalMin = 1;
  const age = p.ageHours ? new SoftStaleController("age", p.ageHours, 0, () => { throw Error("age source"); }) : null;
  const h = p.days ? new AgeHighController(p, () => ({ high: 100, distancePct: 0 })) : null;
  const events: any[] = [], targets: any[] = [];
  const r = runCausalLongReplay({ id: p.id, maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "resting_touch" }, series(bars), {
    startIdx: 0, recordSnapshots: true, partialClockModel: "transactional", researchTpDeferral: age?.decide,
    researchTpObserver: t => { if (targets.at(-1)?.armedIndex !== t.armedIndex) targets.push(t); }, researchAddSize: d => size(p, d),
    researchReduction: h?.reduce, researchInventoryObserver: e => { h?.observe(e); events.push(e); }
  }, c, 32000);
  const metrics = exposureMetrics(r, 32000);
  auditCombinationAccounting(bars, events, metrics, 0, bars.length, 32000, .00055, { fraction: 1, fillDelayMs: 0 }, p.legs.includes("last11_50"));
  const x = { name: p.id, startIdx: 0, endIdx: bars.length, spec: p, lag: 0, control: !age, policy: { id: "baseline", family: "age" }, sensitivity: { sourceLagMs: 0, releaseDelayMs: 0 }, pendingAtEnd: r.executionAudit!.pendingAtEnd, audit: age?.counts };
  const arms: any[] = []; auditAgeHighTargets(bars, events, targets, age?.observations ?? [], x, {}, c, {}, t => arms.push(t));
  assert.deepEqual(arms.map(t => [t.episode, t.armedIndex]), targets.map(t => [t.episode, t.armedIndex]));
  if (h) {
    auditAgeHighExits(bars, events, x, h.rows, new Float64Array(bars.length).fill(100));
    const first = events.find(e => e.event.reason.startsWith("research_exit:")); assert(first);
    assert.equal(first.event.decisionAt - first.before[0].entryTime, p.exitAgeHours * 3600000);
  }
  return events;
}
for (const p of POLICIES) {
  const full = run(p, synthetic), prefix = run(p, synthetic.slice(0, 800));
  assert.deepEqual(prefix, full.filter(e => e.event.fillIndex < 800), `future-prefix ${p.id}`);
}
console.log("L14 tests passed: 24 definitions, config isolation, thresholds, lag, maxima, future-prefix, same-price add rearming, all target caps, fees and forced cooldown");
