import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { StateManager } from "../src/bot/state";
import { buildSelectedIdsAllocation, type PartialCloseIntent } from "../src/bot/partial-close-transaction";
import { calcAddSize } from "../src/bot/strategy";
import { runCausalLongReplay, type ResearchSizeDecision } from "./replay-causal-engine";
import { sizedAdd, freshLadderCost, type SizingVariant } from "./ladder-sizing-policy";
import type { BotConfig } from "../src/bot/bot-config";
import type { Candle, EngineParams, Series } from "./hype-freerun-canonical-replay";
const cfg: BotConfig = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
const spec = JSON.parse(fs.readFileSync("research-inputs/sr-pulse-encounters/ladder-sizing-2026-09-05.json", "utf8"));
const vs: SizingVariant[] = spec.variants;
assert.equal(vs.length, 7); assert.equal(new Set(vs.map(v => v.id)).size, 7);
const d: ResearchSizeDecision = { at: 1, index: 2, episode: 1, nextDepth: 11, price: 100, priceDropOk: true,
  requestedNotional: calcAddSize(10, 800, 1.35), entryCostNotional: freshLadderCost(10, 800, 1.35), qty: 500, equity: 32000 };
for (const v of vs) for (const depth of [1, 8, 9, 10, 11]) for (const cost of [0, 20000, 60000, 80000]) {
  const x = { ...d, nextDepth: depth, entryCostNotional: cost, requestedNotional: calcAddSize(depth - 1, 800, 1.35) };
  const n = sizedAdd(v, x, 800, 1.35); assert(n >= 0 && n <= x.requestedNotional);
}
assert.equal(sizedAdd(vs[0], d, 800, 1.35), d.requestedNotional * .75);
assert.equal(sizedAdd(vs[4], d, 800, 1.35), 0);
assert(Math.abs(sizedAdd(vs[5], d, 800, 1.35) - d.requestedNotional * .5) < 1e-8);
const cap = freshLadderCost(10, 800, 1.35);
assert.equal(sizedAdd(vs[4], { ...d, nextDepth: 4, entryCostNotional: cap - 799 }, 800, 1.35), 0);
assert.equal(sizedAdd(vs[4], { ...d, nextDepth: 4, entryCostNotional: cap - 800 }, 800, 1.35), 800);
// The actual transactional state API differs from the legacy helper. Never touch bot-state.json.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sizing-parity-")), T = Date.UTC(2026, 5, 1), M = 60000;
try {
  const sm = new StateManager(path.join(dir, "state.json"));
  for (let i = 0; i < 6; i++) sm.addPosition({ entryPrice: 100, entryTime: T + i * M, qty: 1, notional: 100, level: i });
  const before = structuredClone(sm.get().positions), lastAdd = sm.get().lastAddTime;
  const allocation = buildSelectedIdsAllocation(before, before.slice(3).map(p => p.id));
  const intent: PartialCloseIntent = { kind: "partial_close", action: "close", orderLinkId: "test", symbol: "HYPEUSDT",
    strategy: "sr_memory", actionKey: "test", createdAt: T + 10 * M, preLocalQty: 6, preExchangeQty: 6,
    requestedQty: 3, submittedQty: 3, qtyStep: .01, allocation, appliedQty: 0, appliedExecNotional: 0,
    lastObservedStatus: "created", lastCheckedAt: 0, desiredPostCommit: { srCooldownUntil: T + 70 * M } };
  sm.beginPartialClose(intent);
  sm.applyObservedPartialFill("test", 1.5, 151.5, "PartiallyFilled", T + 11 * M, .00055);
  assert.equal(sm.get().lastAddTime, lastAdd, "fragment does not reanchor");
  sm.applyObservedPartialFill("test", 3, 303, "Filled", T + 12 * M, .00055);
  sm.finalizePartialClose("test", "Filled", T + 12 * M);
  assert.deepEqual(sm.get().positions, before.slice(0, 3));
  assert.equal(sm.get().lastAddTime, T + 5 * M, "transactional clock preserves newest actual add, even if removed");
  assert.notEqual(sm.get().lastAddTime, Math.max(...sm.get().positions.map(p => p.entryTime)));
  assert.equal(calcAddSize(sm.get().positions.length, 800, 1.35), 800 * 1.35 ** 3);
} finally { for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f)); fs.rmdirSync(dir); }
const config = structuredClone(cfg);
config.srPartialExitAction!.enabled = false; config.srSupportReopenAction!.enabled = false; config.deepAddStressGuard!.enabled = false;
config.addThrottle!.enabled = false; config.addIntervalMin = 1;
const cs: Candle[] = Array.from({ length: 18 }, (_, i) => ({ ts: T + i * M, endTs: T + (i + 1) * M,
  open: 100, close: 100, high: 100.01, low: 99.99, volume: 1, turnover: 100 }));
function series(candles: Candle[]): Series {
  const n = candles.length, nil = () => Array(n).fill(null), no = () => Array(n).fill(false), zero = () => Array(n).fill(0);
  return { candles, trendBlocked: no(), aboveEma200: no(), ret6h: zero(), bybitFunding: nil(), fundingStress: no(), rsi1H: Array(n).fill(50),
    crsi4H: Array(n).fill(50), slope12h: zero(), riskOffBlocked: no(), regimeFlat: no(), vwap24h: nil(), priorLow12h: nil(),
    ret12h: nil(), ret1h: nil(), ret2h: nil(), pbHasEnough: no(), hlScore: nil(), hlSellPressure: no(), high14d: nil() };
}
const p: EngineParams = { id: "test", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none", tpExecutionModel: "close_confirmed" };
const opts = { startIdx: 0, recordSnapshots: true };
const base = runCausalLongReplay(p, series(cs), opts, config, 32000), seen: ResearchSizeDecision[] = [];
const inert = runCausalLongReplay(p, series(cs), { ...opts, researchAddSize: x => { assert(Object.isFrozen(x)); seen.push(x); return x.requestedNotional; },
  researchInventoryObserver: x => { assert(Object.isFrozen(x.after)); assert(x.after.every(Object.isFrozen)); } }, config, 32000);
assert.deepEqual(inert, base);
const half = runCausalLongReplay(p, series(cs), { ...opts, researchAddSize: x => sizedAdd(vs[1], x, 800, 1.35) }, config, 32000);
assert.equal(half.openDepth, 11); assert(Math.abs(base.maxOpenNotional - half.maxOpenNotional - d.requestedNotional / 2) < 1e-8);
const bounded = runCausalLongReplay(p, series(cs), { ...opts, researchAddSize: x => sizedAdd(vs[4], x, 800, 1.35) }, config, 32000);
assert(bounded.maxOpenNotional <= cap + 1e-8);
for (const bad of [NaN, Infinity, -1, 1e9]) assert.throws(() => runCausalLongReplay(p, series(cs), { ...opts, researchAddSize: () => bad }, config, 32000), /sizing/);
const prefix: ResearchSizeDecision[] = [];
runCausalLongReplay(p, series(cs.slice(0, 8)), { ...opts, researchAddSize: x => { prefix.push(x); return x.requestedNotional; } }, config, 32000);
assert.deepEqual(prefix, seen.filter(x => x.index < 8));
const blocked = series(cs); blocked.trendBlocked.fill(true);
assert.equal(runCausalLongReplay(p, blocked, { ...opts, researchAddSize: () => { throw Error("outer bypass"); } }, config, 32000).openDepth, 0);
assert.equal(runCausalLongReplay(p, series(cs), { ...opts, researchAddSize: () => { throw Error("margin bypass"); } }, config, .01).openDepth, 0);
for (const price of [102, 80]) {
  const exitBars = cs.map((c, i) => i < 14 ? c : { ...c, open: price, high: price + .01, low: price - .01, close: price });
  const r = runCausalLongReplay(p, series(exitBars), { ...opts, researchAddSize: x => sizedAdd(vs[4], x, 800, 1.35) }, config, 32000);
  assert(r.closes.length > 0, "TP/emergency continue while cap blocks");
}
console.log("sizing tests passed: fixed fractions/caps, production transactional clock, allocator, immutable no-op, boundaries, prefixes, causal fills and independent exits");
