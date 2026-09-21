import assert from "assert/strict";
import fs from "fs";
import { runCausalLongReplay as original } from "./replay-causal-engine";
import { runCausalLongReplay as run, type CausalRunOptions } from "./aggressive10-release-maker-engine";
import { verifyMakerSource } from "./aggressive10-release-maker-source";
import { exposureMetrics } from "./ladder-exposure-metrics";
import { auditMaker } from "./aggressive10-release-maker-audit";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
import type { BotConfig } from "../src/bot/bot-config";
verifyMakerSource();
const T = Date.UTC(2026, 7, 20, 12), M = 60000;
const cfg: BotConfig = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
cfg.srPartialExitAction!.enabled = false; cfg.srSupportReopenAction!.enabled = false; cfg.srShadow = undefined;
cfg.exits.softStale = false; cfg.tpCooldown!.enabled = false;
const params: EngineParams = { id: "maker-test", maxPositions: 1, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "resting_touch" };
function bar(i: number, patch: Partial<Candle> = {}): Candle {
  return { ts: T + i * M, endTs: T + (i + 1) * M, open: 100, high: 100.1, low: 99.9, close: 100, volume: 1, turnover: 100, ...patch };
}
function series(candles: Candle[]): Series {
  const n = candles.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  return { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50), crsi4H: Array(n).fill(50), slope12h: zero(),
    riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(), ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
const cs = [bar(0), bar(1), bar(2, { high: 101.5 }), bar(3, { open: 99, high: 99.1, low: 98, close: 99 }), bar(4)];
const rates = { entry: .00055, marketExit: .00055, makerExit: .0002 };
let cases = 0;
function check(share: number, candles = cs, end = candles.length) {
  const ev: any[] = []; const options: CausalRunOptions = { startIdx: 0, endIdx: end, recordSnapshots: true,
    makerExecution: { share, makerFee: rates.makerExit, marketFee: rates.marketExit, tick: .01 },
    researchInventoryObserver: e => ev.push(e) };
  const result = run(params, series(candles), options, cfg, 32000);
  auditMaker(candles, ev, exposureMetrics(result, 32000), 0, end, 32000, rates, share); cases++;
  return result;
}
const full = check(1), half = check(.5), none = check(0);
const expected = (qty: number, price: number, fee: number) => qty * (price - 100) - qty * (100 * rates.entry + price * fee);
assert(Math.abs(full.realized - expected(8, 101.4, .0002)) < 1e-8);
assert(Math.abs(half.realized - expected(4, 101.4, .0002) - expected(4, 99, .00055)) < 1e-8);
assert(Math.abs(none.realized - expected(8, 99, .00055)) < 1e-8);
assert.equal(half.trims.length, 1); assert.equal(half.closes[0].exitPrice, 99);
assert.equal(half.executionAudit!.events.filter(e => e.kind === "open").length, 1, "no intervening add during fallback");
const pending = check(.5, cs, 3); assert.equal(pending.closes.length, 0); assert.equal(pending.openDepth, 1);
assert.equal(pending.executionAudit!.lastAddTime, T + M); assert.equal(pending.executionAudit!.srCooldownUntil, 0);
const appended = check(.5, [...cs, bar(5, { high: 200, close: 150 })]);
assert.deepEqual(pending.executionAudit!.events, appended.executionAudit!.events.filter(e => e.fillIndex! < 3));
const noEarlierTouch = check(1, [bar(0), bar(1, { high: 120 }), bar(2)]);
assert.equal(noEarlierTouch.closes.length, 0, "newly armed target cannot use earlier high in fill minute");
const roundedCfg = structuredClone(cfg); roundedCfg.tpPct = 1.405;
const rounded = run(params, series(cs), { startIdx: 0, recordSnapshots: true, makerExecution: { share: 1, makerFee: .0002, marketFee: .00055, tick: .01 } }, roundedCfg, 32000);
assert.equal(rounded.closes[0].exitPrice, 101.41); cases++;
assert.deepEqual(run(params, series(cs), { startIdx: 0, recordSnapshots: true }, cfg, 32000), original(params, series(cs), { startIdx: 0, recordSnapshots: true }, cfg, 32000)); cases++;
assert.throws(() => check(1.1), /Invalid frozen/); cases++;
const forced = run(params, series([bar(0), bar(1), bar(2, { low: 80, close: 80 }), bar(3, { open: 79, high: 80, low: 78, close: 79 })]),
  { startIdx: 0, recordSnapshots: true, makerExecution: { share: 1, makerFee: .0002, marketFee: .00055, tick: .01 } }, cfg, 32000);
assert.equal(forced.closes[0].reason, "emergency_kill"); assert(Math.abs(forced.realized - expected(8, 79, .00055)) < 1e-8); cases++;
console.log(`maker scenario tests passed (${cases} cases; independent ledger, adverse fallback, prefix conservation, future-prefix invariance, prior-target-only)`);
