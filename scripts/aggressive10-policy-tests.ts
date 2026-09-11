import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { loadBotConfig, validateAggressive10Basis } from "../src/bot/bot-config";
import { StateManager } from "../src/bot/state";
import { checkSoftStale } from "../src/bot/strategy";
import { Aggressive10Context } from "../src/bot/aggressive10-context";
import { AGGRESSIVE10_ID, aggressive10HighSnapshot, aggressive10HighExit, aggressive10TpDecision } from "../src/bot/aggressive10-policy";
import { highExitCooldown, validateHighExitCooldownPolicy } from "../src/bot/close-cooldown";
import { buildProRataAllocation } from "../src/bot/partial-close-transaction";

const T = Date.UTC(2026, 8, 11, 12), M = 60_000;
const bars = Array.from({ length: 2880 }, (_, i) => ({ timestamp: T - (2880 - i) * M,
  open: 99, high: 100, low: 98, close: 99, volume: 1, turnover: 99 }));
const pos = [{ id: "rung", entryTime: T - 4 * 3_600_000, entryPrice: 105, qty: 1, notional: 105, level: 0 }];

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aggressive10-policy-"));
  try {
    const h = aggressive10HighSnapshot(bars, T + 5000);
    assert(h.healthy && h.decisionReady);
    assert(aggressive10HighExit(h, pos)); // no PnL floor: even an underwater ladder can exit
    assert(!aggressive10HighExit(h, [{ ...pos[0], entryTime: pos[0].entryTime + 1 }]));
    assert(!aggressive10HighExit(h, [...pos, { ...pos[0], id: "new", entryTime: T + 1 }]));
    assert(!aggressive10HighSnapshot(bars.slice(1), T + 5000).healthy);
    const gap = bars.map(c => ({ ...c })); gap[100].timestamp += M;
    assert(!aggressive10HighSnapshot(gap, T + 5000).healthy);
    const malformed = bars.map(c => ({ ...c })); malformed[20].high = NaN;
    assert(!aggressive10HighSnapshot(malformed, T + 5000).healthy);
    assert.deepEqual(aggressive10HighSnapshot([...bars, { ...bars[0], timestamp: T, high: 1e9 }], T + 5000), h);
    assert(!aggressive10HighSnapshot(bars, T + M).healthy);
    assert(aggressive10HighSnapshot(bars, T + 31_000).healthy);
    assert(!aggressive10HighExit(aggressive10HighSnapshot(bars, T + 31_000), pos));
    assert(!aggressive10HighExit({ ...h, distancePct: 1.00001 }, pos));
    assert(aggressive10HighExit({ ...h, distancePct: 0 }, pos));

    const cfg = loadBotConfig();
    assert.equal(typeof cfg.aggressive10?.enabled, "boolean");
    assert.equal(cfg.exits.staleHours, 4);
    assert.equal(cfg.deepAddStressGuard?.enabled, true);
    assert.equal(cfg.tpCooldown?.enabled, true);
    const file = path.join(dir, "config.json");
    const { aggressive10: _configuredProfile, ...withoutProfile } = cfg;
    fs.writeFileSync(file, JSON.stringify(withoutProfile));
    assert.equal(loadBotConfig(file).aggressive10?.enabled, false, "omitted flag remains opt-in");
    fs.writeFileSync(file, JSON.stringify({ ...cfg, aggressive10: { enabled: false } }));
    assert.equal(loadBotConfig(file).aggressive10?.enabled, false);
    fs.writeFileSync(file, JSON.stringify({ ...cfg, aggressive10: { enabled: "false" } }));
    assert.throws(() => loadBotConfig(file), /boolean/);
    fs.writeFileSync(file, JSON.stringify({ ...cfg, aggressive10: { enabled: true } }));
    assert.equal(loadBotConfig(file).aggressive10?.enabled, true);
    assert.throws(() => validateAggressive10Basis({ ...cfg, exits: { ...cfg.exits, staleHours: 10 } }), /frozen/);
    assert.throws(() => validateAggressive10Basis({ ...cfg, symbol: "SUIUSDT" }), /frozen/);

    // Exact age-only semantics: defer a BASELINE reduction, not a mandatory
    // 10h hold or unconditional 0.5% target after 10h.
    const start = T - 12 * 3_600_000;
    let phase: "unseen" | "extending" | "released" = "unseen";
    for (let minute = 0; minute <= 720; minute++) {
      const price = minute % 7 === 0 ? 101 : 99;
      const p = [{ ...pos[0], entryTime: start, entryPrice: 100, notional: 100 }];
      const stale = checkSoftStale(p, price, start + minute * M, cfg);
      const base = stale.action === "reduce_tp" ? stale.reducedTpPct! : cfg.tpPct;
      const d = aggressive10TpDecision(phase, start, start + minute * M, base, cfg.tpPct);
      const expected = minute < 600 ? cfg.tpPct : base;
      assert.equal(d.pct, expected, `minute ${minute}`);
      phase = d.phase;
    }
    assert.equal(phase, "released");
    assert.equal(aggressive10TpDecision(phase, T - 5 * 3_600_000, T, .5, 1.4).pct, .5,
      "removing oldest inventory cannot re-arm a released deferral");
    assert.equal(aggressive10TpDecision("extending", T - 10 * 3_600_000, T - 1, .5, 1.4).pct, 1.4);
    assert.equal(aggressive10TpDecision("extending", T - 10 * 3_600_000, T, .5, 1.4).pct, .5);

    const stateFile = path.join(dir, "state.json"), state = new StateManager(stateFile);
    state.prepareAggressive10Ladder(false);
    assert.equal(state.get().aggressive10Ladder, undefined);
    state.addPosition(pos[0]);
    state.prepareAggressive10Ladder(true);
    assert.equal(state.get().aggressive10Ladder, undefined, "do not adopt a carry-in ladder");
    state.closeAllPositions(99, T, cfg.feeRate);
    state.prepareAggressive10Ladder(true);
    state.addPosition(pos[0]);
    state.setAggressive10TpPhase("released");
    const reload = new StateManager(stateFile);
    reload.prepareAggressive10Ladder(false);
    assert.deepEqual(reload.get().aggressive10Ladder, { policyId: AGGRESSIVE10_ID, tpPhase: "released" });
    reload.closeAllPositions(99, T, cfg.feeRate);
    reload.prepareAggressive10Ladder(false);
    assert.equal(reload.get().aggressive10Ladder, null);

    // Activation while eleven baseline rungs have a live maker owner. Restart,
    // profile selection and partial maker fills must not adopt/reprice them.
    const carryFile = path.join(dir, "carry-in.json"), carry = new StateManager(carryFile);
    for (let level = 0; level < 11; level++) carry.addPosition({ ...pos[0], level, entryTime: T - 12 * 3_600_000 + level * M });
    const makerPrice = 105 * 1.005;
    carry.setDesiredLongTp({ price: makerPrice, positionQtyBasis: 11, activeTpPct: .5, syncStatus: "confirmed", updatedAt: T });
    carry.beginMakerTpOrder({
      version: 2, symbol: "HYPEUSDT", orderLinkId: "carry-maker", orderId: "exchange-carry", phase: "active",
      closeReason: "STALE_TP", activeTpPct: .5, price: makerPrice, exchangePrice: 105.53,
      requestedQty: 11, submittedQty: 11, qtyStep: .01, priceTick: .01,
      allocation: buildProRataAllocation(carry.get().positions), prePositionCount: 11, preAvgEntry: 105,
      preOldestEntryTime: T - 12 * 3_600_000, createdAt: T, updatedAt: T,
      touchedAt: null, fallbackDeadlineAt: null, closeRequest: null, lastObservedStatus: "New", lastCheckedAt: T,
      makerCumExecQty: 0, makerCumExecNotional: 0, appliedQty: 0, appliedExecNotional: 0,
      appliedPnl: 0, appliedFees: 0, executionIds: [],
    });
    const carryDisk = fs.readFileSync(carryFile, "utf8"), carried = new StateManager(carryFile);
    carried.prepareAggressive10Ladder(true);
    assert.equal(carried.get().positions.length, 11);
    assert.equal(carried.get().aggressive10Ladder, undefined);
    assert.equal(fs.readFileSync(carryFile, "utf8"), carryDisk, "enabling writes nothing to existing ladder/TP/owner");
    carried.applyObservedMakerTpFill("carry-maker", 2, 2 * 105.53, ["carry-part"], "PartiallyFilled", T + 1000, cfg.feeRate, .0002);
    const afterPartial = fs.readFileSync(carryFile, "utf8");
    carried.prepareAggressive10Ladder(true);
    assert.equal(fs.readFileSync(carryFile, "utf8"), afterPartial, "partial reduction does not adopt the profile");
    assert.equal(carried.getDesiredLongTp()?.activeTpPct, .5);
    carried.applyObservedMakerTpFill("carry-maker", 11, 11 * 105.53, ["carry-part", "carry-rest"], "Filled", T + 2000, cfg.feeRate, .0002);
    assert.equal(carried.get().positions.length, 0);
    carried.prepareAggressive10Ladder(true);
    assert.equal(carried.get().aggressive10Ladder, undefined, "flat inventory with unfinalized maker owner is not a fresh ladder");
    carried.finalizeMakerTpOrder("carry-maker", "full_committed", "Filled", T + 2000);
    carried.prepareAggressive10Ladder(true);
    assert.deepEqual(carried.get().aggressive10Ladder, { policyId: AGGRESSIVE10_ID, tpPhase: "unseen" });
    carried.addPosition({ ...pos[0], entryTime: T + 3000 });
    const nextLadder = new StateManager(carryFile);
    nextLadder.prepareAggressive10Ladder(false);
    assert.equal(nextLadder.get().aggressive10Ladder?.policyId, AGGRESSIVE10_ID, "rollback only selects future fresh ladders");

    const policy = { kind: "aggressive10_high" as const, requestedAt: T + 5000, decisionAt: T, referenceHigh: 100, decisionPrice: 99 };
    validateHighExitCooldownPolicy(policy);
    for (const invalid of [{ requestedAt: T - 1 }, { requestedAt: T + 30_001 }, { decisionAt: T + 1 }, { referenceHigh: NaN }]) {
      assert.throws(() => validateHighExitCooldownPolicy({ ...policy, ...invalid }), /invalid/);
    }
    assert.equal(highExitCooldown(policy, T + 10_000, T + M)?.until, T + 8 * 3_600_000);
    assert.equal(highExitCooldown(policy, T + 4 * 3_600_000 - 1, T + 4 * 3_600_000)?.until, T + 8 * 3_600_000);
    assert.equal(highExitCooldown(policy, T + 4 * 3_600_000, T + 4 * 3_600_000)?.until, T + 12 * 3_600_000);
    assert.equal(highExitCooldown(policy, T + 1, T + M), undefined, "pre-existing native close gets no high-exit cooldown");
    assert.equal(highExitCooldown(policy, undefined, T + M)?.anchorSource, "observation_fallback");

    let requests = 0;
    const context = new Aggressive10Context({ getCandles: async (_s, interval, limit, end) => {
      requests++; assert.equal(interval, "1");
      return bars.filter(c => c.timestamp <= end!).slice(-limit!);
    } }, "HYPEUSDT");
    assert.equal(requests, 0);
    await context.refresh(T + 5000);
    assert.equal(requests, 3);
    assert(context.snapshot(T + 6000).healthy);
    await context.refresh(T + 16_000);
    assert.equal(requests, 3, "do not repoll complete unchanged minute");
    const failing = new Aggressive10Context({ getCandles: async () => { throw Error("offline"); } }, "HYPEUSDT");
    await failing.refresh(T + 5000);
    assert.equal(failing.lastError, "offline");
    assert(!failing.snapshot(T + 6000).healthy);

    let lagRequests = 0;
    const lagging = new Aggressive10Context({ getCandles: async () => { lagRequests++; return bars.slice(1800, -1); } }, "HYPEUSDT");
    await lagging.refresh(T + 5000);
    assert.equal(lagRequests, 1, "missing latest candle must not cause repeated identical pages in one refresh");
    assert(!lagging.snapshot(T + 6000).healthy);

    let release!: () => void, pendingRequests = 0;
    const held = new Promise<void>(resolve => { release = resolve; });
    const slow = new Aggressive10Context({ getCandles: async () => { pendingRequests++; await held; return []; } }, "HYPEUSDT");
    const pending = slow.refresh(T + 5000);
    await slow.refresh(T + 20_000);
    assert.equal(pendingRequests, 1, "single flight during stalled public request");
    assert(!slow.snapshot(T + 20_000).healthy);
    release(); await pending;

    console.log("aggressive10 policy/context/profile tests passed");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
