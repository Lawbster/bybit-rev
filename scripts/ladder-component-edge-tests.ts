/** Additional survival and cooldown fixtures. Research-only, no real state. */
import assert from "assert/strict";
import fs from "fs";
import type { BotConfig } from "../src/bot/bot-config";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
import { runCausalLongReplay } from "./replay-causal-engine";
import { componentConfig, componentPolicies } from "./ladder-component-policy";
import { exposureMetrics } from "./ladder-exposure-metrics";
import { auditComponentAccounting } from "./ladder-component-accounting";
const cfg: BotConfig = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
const bare = componentPolicies().cumulative[0], T = Date.UTC(2026, 8, 1), M = 60000;
function make(prices: number[]): Series {
  const cs: Candle[] = prices.map((p, i) => ({ ts: T + i * M, endTs: T + (i + 1) * M, open: p, high: p, low: p, close: p, volume: 1, turnover: p }));
  const n = cs.length, nil = () => Array(n).fill(null), no = () => Array(n).fill(false), zero = () => Array(n).fill(0);
  return { candles: cs, trendBlocked: no(), riskOffBlocked: no(), regimeFlat: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(),
    rsi1H: Array(n).fill(70), crsi4H: Array(n).fill(50), slope12h: zero(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(), ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
function run(s: Series, p = bare, capital = 32000) {
  const { cfg: c, cooldownMode } = componentConfig(cfg, p), ev: ResearchInventoryEvent[] = [];
  const params: EngineParams = { id: "edge", executionModel: "causal_next_open", tpExecutionModel: "resting_touch", maxPositions: 11,
    hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode, pullbackMode: "none" };
  const r = runCausalLongReplay(params, s, { startIdx: 0, recordSnapshots: true, researchInventoryObserver: e => ev.push(e) }, c, capital);
  return { r, ev, audit: auditComponentAccounting(s.candles, ev, exposureMetrics(r, capital), 0, s.candles.length, capital, c.feeRate) };
}
const crash = make([100, 100, 80, 80, 80, 80, 80]);
const zero = run(crash, { ...bare, enabled: ["emergency"] });
const wait = run(crash, { ...bare, enabled: ["emergency", "forced_cooldown"] });
assert.equal(zero.r.closes[0].reason, "emergency_kill"); assert.equal(wait.r.closes[0].closeTs, zero.r.closes[0].closeTs);
assert.equal(zero.ev.filter(e => e.event.kind === "open").length, 2); assert.equal(wait.ev.filter(e => e.event.kind === "open").length, 1);
assert(wait.r.blocked.cooldown > 0); assert.equal(zero.r.blocked.cooldown, 0);
const pump = make([100, 100, 102, 102, 102, 102, 102]);
const noCd = run(pump), tpCd = run(pump, { ...bare, enabled: ["tp_cooldown"] });
assert.equal(noCd.r.closes.length, 1); assert.equal(tpCd.r.closes.length, 1);
assert.equal(noCd.ev.filter(e => e.event.kind === "open").length, 2); assert.equal(tpCd.ev.filter(e => e.event.kind === "open").length, 1);
assert(tpCd.r.blocked.cooldown > 0, "zero forced cooldown does not erase post-TP cooldown");
const deathPrices = Array(305).fill(100).concat([40, 40, 40, 40]), death = run(make(deathPrices));
assert(death.audit.firstNonpositive); assert.equal(death.audit.survival, "NON_SURVIVABLE_DIAGNOSTIC");
assert.equal(death.r.closes.length, 0); assert(death.r.realized === 0 && death.r.openPnl < -32000);
assert(death.audit.maxHeldHours > 5 && death.r.maxDrawdownPct > 100, "no realized losses is not survival");
const recovery = run(make(deathPrices.concat([102, 102, 102])));
assert(recovery.r.realized > 0, "naive engine can resurrect insolvency");
assert.equal(recovery.audit.survival, "NON_SURVIVABLE_DIAGNOSTIC", "diagnostic must retain pre-recovery insolvency");
assert.equal(recovery.audit.firstNonpositive.at, death.audit.firstNonpositive.at);
console.log("edge fixtures passed: zero-vs-forced cooldown,independent TP cooldown,negative-equity/open-loss detection,no post-insolvency resurrection claim");
