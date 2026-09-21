import fs from "fs";
import assert from "assert/strict";
import { createPersistentGate, persistentVariants, type PersistentSpec } from "./ladder-persistent-pulse-policy";
import { dropVeto } from "./ladder-drop-pulse-policy";
import { runCausalLongReplay, type ResearchAddDecision } from "./replay-causal-engine";
import { ReplayMarketInputs } from "./replay-market-inputs";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
import type { BotConfig } from "../src/bot/bot-config";
const spec: PersistentSpec = JSON.parse(fs.readFileSync("research-inputs/sr-pulse-encounters/ladder-persistent-pulse-2026-09-05.json", "utf8"));
const vs = persistentVariants(spec); assert.equal(vs.length, 6); assert.equal(new Set(vs.map(v => v.id)).size, 6);
const d: ResearchAddDecision = { at: 1783425600000, index: 80, episode: 1, nextDepth: 11, price: 61, priceDropOk: true,
  aboveEma200: true, ret12h: 2, ret15m: -.1, srHealthy: true, resistancePrice: 61.1, resistanceDistPct: .164,
  resistanceKnownAt: 1783422000000, taker15m: .8, taker1h: .8, samples15m: 14, samples1h: 59, takerAgeSec: 60 };
const good = { taker15m: 1.2, taker1h: 1, ret15m: .01 };
for (const v of vs) {
  const g = createPersistentGate(v, spec);
  assert(!g.evaluate({ ...d, priceDropOk: false }).veto, "timer alone cannot arm");
  assert(g.evaluate(Object.freeze(d)).event === "armed");
  const timer = g.evaluate({ ...d, priceDropOk: false });
  assert(timer.veto && timer.event === "held" && timer.preventedRelease === "timer_only");
  const zone = g.evaluate({ ...d, resistanceDistPct: 3 }); assert(zone.veto);
  const missing = g.evaluate({ ...d, taker15m: null }); assert(missing.veto && missing.unknown && missing.active);
  const release = g.evaluate({ ...d, ...good, priceDropOk: false, srHealthy: false, resistanceDistPct: 3 });
  assert(!release.veto && release.event === "released" && !g.state(), "known pulse can clear without drop or SR re-entry");
  assert(g.evaluate(d).event === "armed", "later genuine drop can re-arm");
  const reset = g.evaluate({ ...d, nextDepth: 4, priceDropOk: false });
  assert(!reset.veto && reset.event === "inventory_reset" && !reset.active, "partial depth change cannot inherit old hold");
  g.evaluate(d); assert(!g.evaluate({ ...d, episode: 2, nextDepth: 1, priceDropOk: false }).veto, "new ladder resets hold");
  const unknown = createPersistentGate(v, spec).evaluate({ ...d, takerAgeSec: 91 });
  assert(!unknown.veto && !unknown.active && unknown.unknown, "unknown data cannot arm");
  const isolated = createPersistentGate(v, spec); assert.equal(isolated.state(), null, "separate variant/run state");
  // Initial arming exactly matches the old stateless rule across boundaries/missingness.
  for (const patch of [{}, { nextDepth: 8 }, { priceDropOk: false }, { taker15m: .85 }, { taker15m: .85001 }, good,
    { samples15m: 13 }, { samples1h: 54 }, { resistanceDistPct: .30001 }, { srHealthy: false }, { ret15m: null }]) {
    const x = { ...d, ...patch }; assert.equal(createPersistentGate(v, spec).evaluate(x).veto, dropVeto(v, x, spec).veto);
  }
}
const mild = createPersistentGate(vs.find(v => v.family === "drop_sell15")!, spec);
mild.evaluate(d); assert(mild.evaluate({ ...d, priceDropOk: false, taker15m: .85 }).veto);
assert(!mild.evaluate({ ...d, priceDropOk: false, taker15m: .85001, taker1h: null }).veto);
const strong = createPersistentGate(vs.find(v => v.family === "drop_sr_confirm")!, spec);
strong.evaluate(d); assert(strong.evaluate({ ...d, ...good, ret15m: 0 }).veto);
assert(strong.evaluate({ ...d, ...good, samples1h: 54 }).veto);

const cfg: BotConfig = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
cfg.srPartialExitAction!.enabled = false; cfg.srSupportReopenAction!.enabled = false;
cfg.deepAddStressGuard!.enabled = false; cfg.addThrottle!.enabled = false; cfg.addIntervalMin = 20; cfg.priceTriggerPct = .3;
const T = Date.parse("2026-07-01T00:00Z"), M = 60000;
const cs: Candle[] = Array.from({ length: 65 }, (_, i) => {
  const price = i >= 60 ? 102 : i >= 18 ? 94.5 : 100 * .996 ** i;
  return { ts: T + i * M, endTs: T + (i + 1) * M, open: price, close: price, high: price + .01, low: price - .01, volume: 1, turnover: price };
});
function series(candles: Candle[], pulseTurn = 40): Series {
  const n = candles.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0), tape = new ReplayMarketInputs();
  for (let i = -65; i <= 70; i++) tape.add("hlTaker", { timestamp: T + i * M, windowEnd: T + i * M, writtenAt: T + i * M + 1, buyNotional: i >= pulseTurn ? 300 : 70, sellNotional: 100 });
  tape.seal();
  return { candles, marketInputs: tape, trendBlocked: no(), aboveEma200: Array(n).fill(true), ret6h: zero(), bybitFunding: nil(), fundingStress: no(),
    rsi1H: Array(n).fill(50), crsi4H: Array(n).fill(50), slope12h: zero(), riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(),
    ret12h: nil(), ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
const p: EngineParams = { id: "persistent-test", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "close_confirmed" };
const v = vs.find(v => v.controlId === "drop_confirm_both_d9")!;
const run = (s: Series, persistent = true) => {
  const gate = createPersistentGate(v, spec), seen: any[] = [];
  const result = runCausalLongReplay(p, s, { startIdx: 0, recordSnapshots: true, researchAddVeto: d => {
    const a = persistent ? gate.evaluate(d) : dropVeto(v, d, spec); seen.push({ d, a }); return a.veto;
  } }, cfg, 32000);
  return { result, seen };
};
const held = run(series(cs)), stateless = run(series(cs), false);
const arm = held.seen.find(x => x.a.event === "armed"); assert(arm && arm.d.nextDepth === 9 && arm.d.priceDropOk);
const timerBlock = held.seen.find(x => x.a.preventedRelease === "timer_only"); assert(timerBlock && timerBlock.a.veto);
const release = held.seen.find(x => x.a.event === "released"); assert(release && !release.d.priceDropOk && release.d.taker15m >= 1.2 && release.d.taker1h >= 1);
const ninth = (r: typeof held.result) => r.executionAudit!.events.filter(e => e.kind === "open")[8];
assert(ninth(held.result).decisionIndex === release.d.index && ninth(held.result).fillIndex === release.d.index + 1);
assert(ninth(stateless.result).fillIndex! < ninth(held.result).fillIndex!, "timer escape is actually suppressed until known flow clears");
assert(held.result.closes.some(c => ["tp", "stale_tp"].includes(c.reason)), "TP remains active");
const prefix = run(series(cs.slice(0, 40), 999)); assert.deepEqual(prefix.seen, held.seen.filter(x => x.d.index < 40), "future flow/candles cannot change earlier persistent state");
const crashed = cs.map((c, i) => i >= 40 ? { ...c, open: 75, close: 75, high: 75.01, low: 74.99 } : c);
assert(run(series(crashed, 999)).result.closes.some(c => c.reason === "emergency_kill"), "holding an add never prevents emergency exit");
const outer = series(cs); outer.trendBlocked.fill(true);
runCausalLongReplay(p, outer, { startIdx: 0, researchAddVeto: () => { throw Error("outer gate bypassed"); } }, cfg, 32000);
console.log("persistent pulse tests passed: six frozen pairs, original arming equivalence, timer/zone hold, unknown hold, pulse release, inventory resets, next-open fills, fresh state, causal prefixes and exits");
