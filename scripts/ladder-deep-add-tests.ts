import fs from "fs";
import assert from "assert/strict";
import { attributeAdds, summarizeAdds, DecisionSrClock, type DeepAddSpec } from "./ladder-deep-add-attribution";
import { runCausalLongReplay } from "./replay-causal-engine";
import { ReplayMarketInputs } from "./replay-market-inputs";
import { ReplaySrContext } from "./replay-sr-context";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
import type { BotConfig } from "../src/bot/bot-config";

const spec: DeepAddSpec = JSON.parse(fs.readFileSync("research-inputs/sr-pulse-encounters/ladder-deep-adds-2026-09-05.json", "utf8"));
const cfg: BotConfig = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
cfg.srPartialExitAction!.enabled = false; cfg.srSupportReopenAction!.enabled = false;
cfg.deepAddStressGuard!.enabled = false; cfg.addIntervalMin = 1; cfg.priceTriggerPct = 0;
cfg.srShadow!.recentDays = .5;
const T = Date.parse("2026-06-10T00:00:00Z"), M = 60000;
function bar(i: number, price = 100): Candle { return { ts: T + i * M, endTs: T + (i + 1) * M, open: price, high: price + .05, low: price - .05, close: price, volume: 1, turnover: price }; }
function series(candles: Candle[]): Series {
  const n = candles.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  const marketInputs = new ReplayMarketInputs(); marketInputs.seal();
  return { candles, marketInputs, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50), crsi4H: Array(n).fill(50), slope12h: zero(),
    riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(), ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
const params: EngineParams = { id: "test", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "close_confirmed" };
const cs = Array.from({ length: 14 }, (_, i) => bar(i, i >= 11 ? 102 : 100)), s = series(cs);
const r = runCausalLongReplay(params, s, { startIdx: 0, recordSnapshots: true }, cfg, 32000);
const before = JSON.stringify(r);
const a = attributeAdds(r, s, cfg, spec, 0, cs.length, "test");
assert.equal(a.rows.length, 11); assert.equal(a.rows[10].feature.nextDepth, 11);
assert.equal(a.rows[0].feature.priorQty, 0); assert.equal(a.rows[0].feature.tpPrice, null);
assert.equal(a.rows[1].feature.priorQty, 8); assert.equal(a.rows[1].feature.pulseClass, "unknown");
assert(a.rows.every(x => x.outcome.closed));
assert(Math.abs(a.validation.attributedRealized - r.realized) < 1e-8);
assert.equal(JSON.stringify(r), before, "attribution cannot alter the baseline result");
assert(a.rows.every(x => x.outcome.waits[0].episodeClosedBeforeWait), "early baseline TPs cannot disappear from wait diagnostics");
assert(a.rows.every(x => !x.outcome.waits[0].available), "truncated waiting horizon is unknown");

// Adding later prices cannot change any existing predictor row (or actual decision).
const shortCs = cs.slice(0, 10), shortS = series(shortCs);
const shortR = runCausalLongReplay(params, shortS, { startIdx: 0, recordSnapshots: true }, cfg, 32000);
const shortA = attributeAdds(shortR, shortS, cfg, spec, 0, shortCs.length, "test");
assert.deepEqual(shortA.rows.map(x => x.feature), a.rows.slice(0, shortA.rows.length).map(x => x.feature));
assert(shortA.rows.every(x => !x.outcome.closed), "still-open contributions remain marked, not realized");
const bad = structuredClone(r); bad.executionAudit!.events[0].qty *= 2;
assert.throws(() => attributeAdds(bad, s, cfg, spec, 0, cs.length, "test"), /add notional/);
const summary = summarizeAdds(a.rows, spec);
assert(summary.hypotheses.every(h => !h.meritsSeparateTimingExperiment));
assert.equal(new Set(summary.cohorts.map(c => c.id)).size, summary.cohorts.length, "cohort IDs are unique");
assert.equal(new Set(summary.monthly.map(c => `${c.id}|${c.month}`)).size, summary.monthly.length, "monthly rows are unique");

// A sparse S/R query may rebuild with extra bars versus the engine. The clock
// must advance every intervening minute and match the continuously queried engine.
const warm = Array.from({ length: 1480 }, (_, i) => bar(i, 100 + Math.sin(i / 60)));
const direct = new ReplaySrContext(warm, cfg.srShadow!), clock = new DecisionSrClock({ candles: warm }, new ReplaySrContext(warm, cfg.srShadow!), 1400);
for (let i = 1400; i < 1479; i++) {
  const expected = direct.at(warm[i].endTs);
  if ([1417, 1451, 1478].includes(i)) assert.deepEqual(clock.at(i).engine.getZones(warm[i].endTs), expected.engine.getZones(warm[i].endTs));
}
assert.throws(() => clock.at(1417), /backward/);

// Partial closes select gross-profitable rungs at DECISION price, then settle
// those exact IDs at the following fill price. Allocation must reconcile.
const partialCfg = structuredClone(cfg); partialCfg.srPartialExitAction!.enabled = true;
const partialCs = [...warm, ...Array.from({ length: 9 }, (_, j) => bar(1480 + j,
  j === 7 ? 100.85 : j === 8 ? 100.7 : 100))];
const partialS = series(partialCs);
partialS.marketInputs!.add("bnTaker", { timestamp: T + 1480 * M, buyVol: 1, sellVol: 2 }); partialS.marketInputs!.seal();
const partialR = runCausalLongReplay({ ...params, maxPositions: 6 }, partialS, { startIdx: 1480, recordSnapshots: true }, partialCfg, 32000);
assert.equal(partialR.trims.length, 1);
const pa = attributeAdds(partialR, partialS, partialCfg, spec, 1480, partialCs.length, "partial");
assert.equal(pa.validation.exactPartialAllocationChecks, 1);
assert.equal(pa.rows.filter(x => x.outcome.exitReason === "sr_partial").length, 3);
assert.equal(pa.rows.filter(x => !x.outcome.closed).length, 3);
assert(Math.abs(pa.rows.reduce((v, x) => v + x.outcome.pnl, 0) - partialR.realized - partialR.openPnl) < 1e-8);
assert(pa.rows.every(x => x.outcome.episodeNetPnl === null), "ongoing episode is not a completed win");
console.log("deep-add attribution tests passed: unchanged baseline, exact rung/partial accounting, unknown coverage, early TP and censoring, source prefix and S/R query cadence");
