import fs from "fs";
import assert from "assert/strict";
import { dropVeto, dropVariants, type DropSpec } from "./ladder-drop-pulse-policy";
import { runCausalLongReplay, type ResearchAddDecision } from "./replay-causal-engine";
import { ReplayMarketInputs } from "./replay-market-inputs";
import type { Candle, Series, EngineParams } from "./hype-freerun-canonical-replay";
import type { BotConfig } from "../src/bot/bot-config";
const spec: DropSpec = JSON.parse(fs.readFileSync("research-inputs/sr-pulse-encounters/ladder-drop-pulse-2026-09-05.json", "utf8"));
const variants = dropVariants(spec); assert.equal(variants.length, 12); assert.equal(new Set(variants.map(v => v.id)).size, 12);
const d: ResearchAddDecision = { at: 1783425600000, index: 80, episode: 1, nextDepth: 11, price: 61, priceDropOk: true,
  aboveEma200: true, ret12h: 2, ret15m: -.1, srHealthy: true, resistancePrice: 61.1, resistanceDistPct: .164,
  resistanceKnownAt: 1783422000000, taker15m: .8, taker1h: .8, samples15m: 14, samples1h: 59, takerAgeSec: 60 };
const test = (id: string, patch: Partial<ResearchAddDecision> = {}) => dropVeto(variants.find(v => v.id === id)!, { ...d, ...patch }, spec);
for (const v of variants) {
  assert(dropVeto(v, Object.freeze(d), spec).veto, v.id);
  assert(!dropVeto(v, { ...d, priceDropOk: false }, spec).veto, "timer-only untouched, even with bearish flow");
  assert(!dropVeto(v, { ...d, nextDepth: v.depth - 1 }, spec).veto, "depth scope");
  assert(!dropVeto(v, { ...d, taker15m: 1.2, taker1h: 1, ret15m: .001 }, spec).veto, "healthy confirmation releases");
}
assert(test("drop_sell15_d11", { taker15m: .85 }).veto);
assert(!test("drop_sell15_d11", { taker15m: .85001 }).veto);
assert(test("drop_sell_either_d11", { taker15m: 1.3, taker1h: .9 }).veto);
assert(!test("drop_sell_either_d11", { taker15m: .86, taker1h: .90001 }).veto);
assert(!test("drop_confirm15_d11", { taker15m: 1 }).veto);
assert(test("drop_confirm15_d11", { taker15m: .99999 }).veto);
assert(!test("drop_confirm_both_d11", { taker15m: 1.2, taker1h: 1, ret15m: -5 }).veto, "pure pulse confirmation doesn't require a rebound");
assert(test("drop_sr_confirm_d11", { taker15m: 1.2, taker1h: 1, ret15m: 0 }).veto);
assert(!test("drop_sr_sell15_d11", { resistanceDistPct: .30001 }).veto);
assert(test("drop_sr_sell15_d11", { resistanceDistPct: .3 + 1e-12 }).veto);
assert(test("drop_sr_sell15_d11", { srHealthy: false }).unknown);
assert(test("drop_sell15_d11", { srHealthy: false }).veto, "non-SR rules don't need zones");
for (const patch of [{ samples15m: 13 }, { taker15m: null }, { taker15m: NaN }, { takerAgeSec: null }, { takerAgeSec: -1 }, { takerAgeSec: 91 }]) {
  for (const v of variants) { const x = dropVeto(v, { ...d, ...patch }, spec); assert(!x.veto && x.unknown); }
}
for (const id of ["drop_sell_either_d11", "drop_confirm_both_d11", "drop_sr_confirm_d11"]) {
  assert(test(id, { samples1h: 54 }).unknown); assert(test(id, { taker1h: null }).unknown);
}
assert(test("drop_sell15_d11", { samples1h: 0, taker1h: null }).veto);
assert(test("drop_sr_confirm_d11", { ret15m: null }).unknown);

const cfg: BotConfig = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
cfg.srPartialExitAction!.enabled = false; cfg.srSupportReopenAction!.enabled = false;
cfg.deepAddStressGuard!.enabled = false; cfg.addThrottle!.enabled = false;
cfg.addIntervalMin = 20; cfg.priceTriggerPct = .3;
const T = Date.parse("2026-07-01T00:00Z"), M = 60000;
const candles: Candle[] = Array.from({ length: 45 }, (_, i) => {
  const price = i >= 40 ? 102 : 100 * .996 ** Math.min(i, 25);
  return { ts: T + i * M, endTs: T + (i + 1) * M, open: price, close: price, high: price + .01, low: price - .01, volume: 1, turnover: price };
});
function series(cs: Candle[], pulseTurn = 20): Series {
  const n = cs.length, no = () => Array(n).fill(false), nil = () => Array(n).fill(null), zero = () => Array(n).fill(0);
  const tape = new ReplayMarketInputs();
  for (let i = -65; i <= 60; i++) tape.add("hlTaker", { timestamp: T + i * M, windowEnd: T + i * M, writtenAt: T + i * M + 1,
    buyNotional: i >= pulseTurn ? 300 : 70, sellNotional: 100 });
  tape.seal();
  return { candles: cs, marketInputs: tape, trendBlocked: no(), aboveEma200: Array(n).fill(true), ret6h: zero(), bybitFunding: nil(), fundingStress: no(),
    rsi1H: Array(n).fill(50), crsi4H: Array(n).fill(50), slope12h: zero(), riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(),
    ret12h: nil(), ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
const p: EngineParams = { id: "drop-pulse-test", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "close_confirmed" };
const v = variants.find(v => v.id === "drop_confirm15_d9")!;
const observed: ResearchAddDecision[] = [];
const replay = (s: Series, seen: ResearchAddDecision[] = []) => runCausalLongReplay(p, s, { startIdx: 0, recordSnapshots: true, researchAddVeto: x => {
  assert(Object.isFrozen(x)); seen.push(x); return dropVeto(v, x, spec).veto;
} }, cfg, 32000);
const r = replay(series(candles), observed);
const first = observed.find(x => dropVeto(v, x, spec).veto)!;
assert(first && first.nextDepth === 9 && first.priceDropOk, "actual falling-price ninth add blocked above EMA200");
const permit = observed.find(x => x.index > first.index && x.nextDepth === 9 && !dropVeto(v, x, spec).veto)!;
assert(permit && permit.priceDropOk && permit.taker15m! >= 1, "genuine drop released by causal flow recovery");
const fill = r.executionAudit!.events.find(e => e.kind === "open" && e.decisionIndex === permit.index)!;
assert(fill && fill.fillIndex === permit.index + 1 && fill.price === candles[permit.index + 1].open, "release is next open, no backdating");
assert(r.closes.some(c => ["tp", "stale_tp"].includes(c.reason)), "TP still operates");
const seen: ResearchAddDecision[] = []; replay(series(candles.slice(0, 20), 999), seen);
assert.deepEqual(seen, observed.filter(x => x.index < 20), "future buy flow/candles cannot alter earlier decisions");
const noHook = runCausalLongReplay(p, series(candles), { startIdx: 0 }, cfg, 32000);
const inert = runCausalLongReplay(p, series(candles), { startIdx: 0, researchAddVeto: () => false }, cfg, 32000);
assert.deepEqual(noHook, inert);
const rebound = candles.map((c, i) => i >= 10 ? { ...c, open: 102, close: 102, high: 102.01, low: 101.99 } : c);
assert(replay(series(rebound, 999)).closes.length > 0, "persistent bearish veto never blocks protective exits");
const escape = candles.map((c, i) => i >= 18 ? { ...c, open: 94.5, close: 94.5, high: 94.51, low: 94.49 } : c);
const escapeSeen: ResearchAddDecision[] = []; const escaped = replay(series(escape, 999), escapeSeen);
const timer = escapeSeen.find(x => x.nextDepth === 9 && !x.priceDropOk)!;
assert(timer && timer.taker15m! < 1 && escaped.executionAudit!.events.some(e => e.kind === "open" && e.decisionIndex === timer.index && e.reason === "time_add"),
  "after rebound, original timer can release exposure without positive pulse; no hidden persistence");
console.log("drop-pulse tests passed: 12 fixed variants, genuine-drop/depth-only, boundaries, missingness, real pulse release at next open, future-prefix invariance, no-op identity and exits");
