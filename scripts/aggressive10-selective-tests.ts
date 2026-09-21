import assert from "assert/strict";
import fs from "fs";
import { CONTROLS, VARIANTS, config, validate, hourlyWeakness, selectiveBlock, SelectiveContext } from "./aggressive10-selective-policy";
import { PriceContext, M, H } from "./aggressive10-discriminator-context";
import { GateObserver } from "./age10-gate-observer";
import { runCausalLongReplay } from "./replay-causal-engine";
import { emptyReplayPulse } from "./replay-market-inputs";
import { exposureMetrics } from "./ladder-exposure-metrics";
import { auditCombinationAccounting } from "./ladder-combination-accounting";
import type { Candle, Series } from "./hype-freerun-canonical-replay";
const cfg = JSON.parse(fs.readFileSync("bot-config.json", "utf8")), before = JSON.stringify(cfg), T = Date.UTC(2026, 5, 1);
assert.equal(VARIANTS.length, 2); assert.equal(CONTROLS.length, 3);
for (const p of VARIANTS) assert.deepEqual(config(cfg, p), config(cfg, CONTROLS[2]));
assert.equal(JSON.stringify(cfg), before);
const weak = { hour: { high: 99, close: 98 }, previousHour: { high: 101, low: 99, close: 100 }, roc1h: -2, sessionVwap: 100 };
assert(hourlyWeakness("vwap_roc", weak)); assert(hourlyWeakness("hour_structure", weak));
assert(!hourlyWeakness("vwap_roc", { ...weak, sessionVwap: 98 }));
assert(!hourlyWeakness("vwap_roc", { ...weak, roc1h: 0 }));
assert(!hourlyWeakness("hour_structure", { ...weak, hour: { high: 101, close: 98 } }));
assert(!hourlyWeakness("hour_structure", { ...weak, hour: { high: 99, close: 99 } }));
assert.equal(hourlyWeakness("vwap_roc", { ...weak, sessionVwap: null }), null);
assert(selectiveBlock("vwap_roc", true, null), "Unknown restores only the original eligible guard");
assert(!selectiveBlock("vwap_roc", false, null)); assert(!selectiveBlock(undefined, true, true));
const cs: Candle[] = Array.from({ length: 6000 }, (_, i) => ({ ts: T + i * M, endTs: T + (i + 1) * M,
  open: 100, close: 100, low: 99.99, high: 100.01, volume: 1, turnover: 100 }));
const at = T + 73 * H + 17 * M, full = new SelectiveContext(new PriceContext(cs));
assert.equal(full.at(at, 0).hour.endTs, T + 73 * H);
assert.equal(full.at(T + 73 * H, M).hour.endTs, T + 72 * H);
assert.deepEqual(new SelectiveContext(new PriceContext(cs.filter(c => c.endTs <= at))).at(at, 0), full.at(at, 0));
const future = cs.map(c => c.endTs > at ? { ...c, close: 9999, high: 10000, turnover: 9999 } : c);
assert.deepEqual(new SelectiveContext(new PriceContext(future)).at(at, 0), full.at(at, 0));
assert.equal(full.at(T + 72 * H, 0).hour.ts, T + 71 * H, "Midnight uses last completed hour's prior session");
function series(bars: Candle[]): Series {
  const n = bars.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  return { candles: bars, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50),
    crsi4H: Array(n).fill(50), slope12h: zero(), riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(), ret12h: nil(),
    ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
const tape = series(cs), probe = structuredClone(cfg);
let funding = -.0001, supportEnabled = false;
const pulse = () => ({ ...emptyReplayPulse(), fdByNow: funding,
  hlTaker15m: 1.3, hlTaker1h: 1.1, hlTaker15mSamples: 15, hlTaker1hSamples: 60, hlTakerAgeSec: 10,
  hlObImbalance05: .3, hlObAgeSec: 10, hlAssetOi1hPct: .4, hlAssetOi4hPct: .8, hlAssetAgeSec: 10,
  hlAsset1hAnchorLagSec: 10, hlAsset4hAnchorLagSec: 10 });
tape.marketInputs = { snapshot: () => ({ pulse: pulse(), sources: {} }) } as any;
const o = new GateObserver(tape, probe), inv = Array.from({ length: 5 }, (_, level) => ({ id: String(level), level, entryTime: T, entryPrice: 100, notional: 100, qty: 1 }));
o.inventory = inv;
o.context = { coverage: { healthy: true }, engine: { nearestSupport: () => supportEnabled ? { dist: .005,
  lv: { price: 99.5, confirmTs: T, touches: 3, highTouches: 1, lowTouches: 2, touchData: [] } } : null } } as any;
const d: any = { at, index: 73 * 60 + 16, nextDepth: 6, episode: 1, priceDropOk: false, price: 100 };
const actual = config(cfg, CONTROLS[2]);
assert(o.entry(d, actual).deepWouldBlock);
assert(!o.entry({ ...d, priceDropOk: true }, actual).deepWouldBlock, "Price-drop permission bypasses restraint");
funding = 0; assert(!o.entry(d, actual).deepWouldBlock, "No negative funding, no new veto"); funding = -.0001;
supportEnabled = true; const supported = o.entry(d, actual); assert(supported.supportReopen); assert(!supported.deepWouldBlock);
assert(!selectiveBlock("vwap_roc", supported.deepWouldBlock, true), "Existing S/R exception remains authoritative");
supportEnabled = false; o.inventory = inv.slice(0, 4); assert(!o.entry({ ...d, nextDepth: 5 }, actual).deepWouldBlock);
function run(bars: Candle[]) {
  const c = config(cfg, VARIANTS[0]); c.srPartialExitAction!.enabled = false; c.srSupportReopenAction!.enabled = false;
  c.addThrottle!.enabled = false; c.addIntervalMin = 1;
  const s = series(bars); s.marketInputs = { snapshot: () => ({ pulse: { ...emptyReplayPulse(), fdByNow: -.0001 }, sources: {} }) } as any;
  const obs = new GateObserver(s, c), originalCfg = structuredClone(c); originalCfg.deepAddStressGuard!.enabled = true;
  const original = new GateObserver(s, originalCfg), events: any[] = [], attempts: any[] = [];
  const r = runCausalLongReplay({ id: "selective_synthetic", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2,
    cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "resting_touch" }, s, {
    startIdx: 0, recordSnapshots: true, partialClockModel: "transactional",
    researchReduction: x => { obs.clock(x.index); original.clock(x.index); return null; },
    researchInventoryObserver: e => { obs.observe(e); original.observe(e); events.push(e); },
    researchAddSize: x => {
      const gate = original.entry(x, c), block = selectiveBlock("vwap_roc", gate.deepWouldBlock, x.index < 8);
      attempts.push({ ...x, block }); return block ? 0 : x.requestedNotional;
    }
  }, c, 32000);
  auditCombinationAccounting(bars, events, exposureMetrics(r, 32000), 0, bars.length, 32000, .00055);
  return { r, events, attempts };
}
const short = cs.slice(0, 30).map(c => ({ ...c }));
// Genuine drop during an otherwise weak interval must remain possible.
short[7] = { ...short[7], close: 99.5, low: 99.49 };
const test = run(short), prefix = run(short.slice(0, 20));
assert(test.attempts.some(a => a.block)); assert(test.attempts.some(a => a.index === 7 && a.priceDropOk && !a.block));
assert(test.attempts.some(a => a.index >= 8 && a.nextDepth >= 6 && !a.block), "Reevaluate after each block, not permanent episode veto");
assert.deepEqual(prefix.events, test.events.filter(e => e.event.fillIndex < 20));
for (const e of test.events.filter(e => e.event.kind === "open")) assert.equal(e.event.fillIndex, e.event.decisionIndex + 1);
validate(JSON.parse(fs.readFileSync("research-inputs/aggressive10-selective-2026-09-11.json", "utf8")).definition);
console.log("AG10-E1 tests passed: two definitions, config isolation, strict thresholds, midnight/closed prefixes, source60, support/drop/shallow/funding bypass, repeat timing, next-open and fee accounting");
