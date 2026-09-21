/** Additional interaction fixture; uses synthetic closed candles, no live state. */
import assert from "assert/strict";
import fs from "fs";
import { runCausalLongReplay, type ResearchInventoryEvent } from "./replay-causal-engine";
import { ReplayMarketInputs } from "./replay-market-inputs";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
const M = 60000, T = Date.UTC(2026, 7, 20, 12);
const bar = (i: number, price = 100): Candle => ({ ts: T + i * M, endTs: T + (i + 1) * M, open: price,
  close: price, high: price + .1, low: price - .1, volume: 1, turnover: price });
const candles = Array.from({ length: 1480 }, (_, i) => bar(i, 100 + Math.sin(i / 60)))
  .concat(Array.from({ length: 20 }, (_, i) => bar(1480 + i, i === 7 ? 100.85 : i >= 8 ? 100.7 : 100)));
const n = candles.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
const s: Series = { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50),
  crsi4H: Array(n).fill(50), slope12h: zero(), riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(),
  ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
const tape = new ReplayMarketInputs(); tape.add("bnTaker", { timestamp: T + 1480 * M, buyVol: 1, sellVol: 2 }); tape.seal(); s.marketInputs = tape;
const cfg = JSON.parse(fs.readFileSync("bot-config.json", "utf8")); cfg.srSupportReopenAction.enabled = false;
cfg.srShadow.recentDays = .5;
const params: EngineParams = { id: "sr-after-half", maxPositions: 6, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h",
  pullbackMode: "none", tpExecutionModel: "resting_touch", addIntervalMin: 1 };
const events: ResearchInventoryEvent[] = [];
const r = runCausalLongReplay(params, s, { startIdx: 1480, recordSnapshots: true, researchInventoryObserver: e => events.push(e),
  researchReduction: d => d.index === 1486 ? { fraction: .5, reason: "research_exit:fixture" } : null }, cfg, 32000);
assert.equal(r.trims.length, 2); assert.equal(r.openDepth, 3);
assert.deepEqual(events.filter(e => e.event.kind === "partial").map(e => e.event.reason), ["research_exit:fixture", "sr_partial"]);
assert.equal(r.executionAudit!.lastAddTime, T + 1486 * M);
assert(!events.some(e => e.event.kind === "open" && e.event.fillIndex! > 1486), "S/R trim cannot clear episode no-add lock");
assert.equal(r.executionAudit!.srCooldownUntil, T + 1488 * M + 60 * M);
assert(r.blocked.researchExitLock > 0);
console.log("F02 integration passed: pro-rata trim -> ordinary profitable S/R trim -> preserved add clock and no rebuilding");
