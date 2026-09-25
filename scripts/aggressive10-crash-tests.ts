/** Offline child-process power-loss tests. All exchange effects are persisted fakes. */
import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { StateManager } from "../src/bot/state";
import type { Executor, LongExecutionResult, OrderExecutionState } from "../src/bot/executor";
import { executeFullCloseTransaction, resolvePendingLongTransaction, exactCloseExecutionTime } from "../src/bot/long-transaction-coordinator";
import { ensureMakerTpOrder, executeMakerTpMarketFallback, combineMakerTpFallbackResult } from "../src/bot/maker-tp-coordinator";
import { highExitCooldown, HighExitCooldownPolicy } from "../src/bot/close-cooldown";
import { AGGRESSIVE10_HIGH_REASON as HIGH_REASON } from "../src/bot/aggressive10-policy";

const T = Date.UTC(2026, 8, 10, 12), Q = 10;
const timeStopMode = process.argv.includes("--time-stop");
const observationMode = process.argv.includes("--observer");
const AGGRESSIVE10_HIGH_REASON = timeStopMode ? "TIME STOP: synthetic frozen predicate"
  : observationMode ? "HARD FLATTEN: synthetic observation" : HIGH_REASON;
const policy: HighExitCooldownPolicy = timeStopMode
  ? { kind: "weak_week_time_stop", requestedAt: T + 5000, decisionAt: T, decisionPrice: 9,
    referenceAt: T - 7 * 24 * 3_600_000, referencePrice: 10 }
  : { kind: "aggressive10_high", requestedAt: T + 5000, decisionAt: T, referenceHigh: 12, decisionPrice: 11.9 };
const base = { symbol: "HYPEUSDT", feeRate: .00055, entryFeeRate: .00055,
  makerExitFeeRate: .0002, touchGraceMs: 2000, now: T + 5000, observeForcedClose: observationMode };
type FakeOrder = { link: string; qty: number; price: number; filled: number; status: string; maker: boolean; time: number };
type ExchangeDisk = { qty: number; orders: FakeOrder[]; marketSubmits: number; native?: { qty: number; time: number }; };

class Exchange {
  disk: ExchangeDisk;
  partialOnCancel = 0;
  nativeOnCancel = false;
  rejectMarket = false;
  ambiguousCancel = false;
  missingEvidence = false;
  constructor(readonly file: string, readonly crash = "") {
    this.disk = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { qty: Q, orders: [], marketSubmits: 0 };
  }
  save() { fs.writeFileSync(this.file, JSON.stringify(this.disk)); }
  die(point: string) { if (this.crash === point) process.exit(86); }
  evidence(o?: FakeOrder): OrderExecutionState {
    if (!o || this.missingEvidence) return { found: false, orderId: "", orderLinkId: o?.link ?? "", status: "not_found", terminal: false,
      filledQty: 0, avgPrice: 0, cumExecQty: 0, cumExecNotional: null };
    return { found: true, orderId: `id-${o.link}`, orderLinkId: o.link, status: o.status, terminal: o.status !== "New",
      filledQty: o.filled, avgPrice: o.filled ? o.price : 0, cumExecQty: o.filled, cumExecNotional: o.filled ? o.filled * o.price : null,
      qty: o.qty, price: o.price, leavesQty: o.qty - o.filled, side: "Sell", positionIdx: 1,
      reduceOnly: true, timeInForce: o.maker ? "PostOnly" : "IOC", orderType: o.maker ? "Limit" : "Market" };
  }
  result(o: FakeOrder): LongExecutionResult {
    const evidence = this.evidence(o);
    return { outcome: o.status === "Rejected" ? "rejected" : o.status === "New" ? "accepted_unresolved" : "terminal",
      orderId: `id-${o.link}`, orderLinkId: o.link, status: o.status, terminal: o.status !== "New",
      submittedQty: o.qty, quotePrice: o.price, cumExecQty: o.filled, cumExecNotional: o.filled ? o.filled * o.price : null,
      avgPrice: o.filled ? o.price : null, remainingLongQty: this.disk.qty, qtyStep: .01,
      executionIds: o.filled ? [`exec-${o.link}`] : [], orderEvidence: evidence };
  }
  executor(): Executor {
    let nativeTp = 0;
    return {
      getInstrumentLotInfo: async () => ({ qtyStep: .01, minOrderQty: .01, qtyDecimals: 2, priceTick: .01 }),
      getLongPositionSize: async () => this.disk.qty,
      setPositionTp: async (_s: string, p: number) => { nativeTp = p; return { success: true, status: "confirmed" }; },
      clearPositionTp: async () => { nativeTp = 0; return { success: true, status: "confirmed" }; },
      getLongPositionProtection: async () => ({ size: this.disk.qty, takeProfit: nativeTp, stopLoss: 0, positionIdx: 1, updatedTime: T }),
      placeLongMakerTpDetailed: async (_s: string, qty: number, price: number, link: string) => {
        const o: FakeOrder = { link, qty, price, filled: 0, status: "New", maker: true, time: T };
        this.disk.orders.push(o); this.save(); return this.result(o);
      },
      cancelLongMakerTpDetailed: async (_s: string, link: string) => {
        const o = this.disk.orders.find(x => x.link === link)!;
        if (this.ambiguousCancel) return this.result(o);
        if (o.status === "New") {
          o.filled = Math.min(this.partialOnCancel, o.qty); o.time = T + 10_000;
          o.status = o.filled === o.qty ? "Filled" : "Cancelled";
          this.disk.qty -= o.filled;
          if (this.nativeOnCancel) { this.disk.native = { qty: this.disk.qty, time: T + 12_000 }; this.disk.qty = 0; }
        }
        this.save(); this.die("maker_cancel"); return this.result(o);
      },
      closeAllLongsDetailed: async (_s: string, link: string) => {
        assert(!this.disk.orders.some(o => o.link === link), "no duplicate order submission");
        const o: FakeOrder = { link, qty: this.disk.qty, filled: this.rejectMarket ? 0 : this.disk.qty,
          price: 11, status: this.rejectMarket ? "Rejected" : "Filled", maker: false, time: T + 20_000 };
        this.disk.marketSubmits++; this.disk.qty -= o.filled; this.disk.orders.push(o);
        this.save(); this.die("market_accept"); return this.result(o);
      },
      queryOrderExecution: async (_s: string, link: string) => this.evidence(this.disk.orders.find(o => o.link === link)),
      queryOrderExecutions: async (_s: string, link: string) => {
        const o = this.disk.orders.find(o => o.link === link);
        const found = !!o?.filled && !this.missingEvidence;
        return { found, orderId: o ? `id-${o.link}` : "", orderLinkId: link, identityConfirmed: found, executionIds: found ? [`exec-${link}`] : [],
          cumExecQty: found ? o!.filled : 0, cumExecNotional: found ? o!.filled * o!.price : null,
          avgPrice: found ? o!.price : null, ...(found ? { lastExecTime: o!.time } : {}) };
      },
      queryRecentLongCloseExecutions: async () => this.disk.native && !this.missingEvidence ? [{
        execId: "native-exec", orderId: "native-order", orderLinkId: "", execTime: this.disk.native.time,
        closedSize: this.disk.native.qty, execQty: this.disk.native.qty, execPrice: 12, createType: "CreateByTakeProfit", stopOrderType: "TakeProfit",
      }] : [],
      queryRecentClosedPnl: async () => [],
    } as unknown as Executor;
  }
}

function crashAfter(state: StateManager, method: string, point: string, crash: string) {
  if (crash !== point) return;
  const original = (state as any)[method].bind(state);
  (state as any)[method] = (...args: any[]) => { original(...args); process.exit(86); };
}

async function child(dir: string, crash: string, maker: boolean) {
  const state = new StateManager(path.join(dir, "state.json"));
  const ex = new Exchange(path.join(dir, "exchange.json"), crash);
  if (crash === "maker_partial_apply") ex.partialOnCancel = 4;
  if (crash === "maker_receipt") ex.partialOnCancel = Q;
  if (crash === "native_handoff") ex.nativeOnCancel = true;
  crashAfter(state, "beginFullClose", "intent", crash);
  crashAfter(state, "requestMakerTpClose", "maker_request", crash);
  crashAfter(state, "finalizeMakerTpOrder", "maker_receipt", crash);
  crashAfter(state, "applyObservedFullCloseFill", "market_apply", crash);
  crashAfter(state, "finalizePendingFullClose", "market_receipt", crash);
  crashAfter(state, "transitionMakerTpToFullClose", "maker_handoff", crash);
  crashAfter(state, "transitionMakerTpToFullClose", "native_handoff", crash);
  crashAfter(state, "applyObservedMakerTpFill", "maker_partial_apply", crash);
  if (maker) await executeMakerTpMarketFallback({ ...base, state, executor: ex.executor(), reason: AGGRESSIVE10_HIGH_REASON, closeCooldown: policy });
  else await executeFullCloseTransaction({ ...base, state, executor: ex.executor(), reason: AGGRESSIVE10_HIGH_REASON, closeCooldown: policy, orderLinkId: "market" });
  throw Error(`crash point not reached: ${crash}`);
}

export async function fixture(maker: boolean) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aggressive10-crash-"));
  const state = new StateManager(path.join(dir, "state.json")), ex = new Exchange(path.join(dir, "exchange.json"));
  state.prepareAggressive10Ladder(true);
  state.addPosition({ entryTime: T - 5 * 3_600_000, entryPrice: 10, qty: Q, notional: 100, level: 0 });
  ex.save();
  if (maker) {
    const r = await ensureMakerTpOrder({ ...base, now: T, state, executor: ex.executor(), price: 12, closeReason: "TP", activeTpPct: 1.4, orderLinkId: "maker" });
    assert.equal(r.outcome, "active");
  }
  return { dir, state, ex };
}

async function resume(dir: string) {
  const state = new StateManager(path.join(dir, "state.json")), ex = new Exchange(path.join(dir, "exchange.json"));
  const maker = state.getMakerTpOrder();
  const result = maker
    ? await executeMakerTpMarketFallback({ ...base, now: T + 60_000, state, executor: ex.executor(), reason: maker.closeRequest!.reason })
    : state.getPendingOrder()
      ? combineMakerTpFallbackResult(state, await resolvePendingLongTransaction({ ...base, now: T + 60_000, state, executor: ex.executor() }))
      : null;
  return { state, ex, result };
}

async function main() {
  let count = 0;
  for (const [point, maker] of [
    ["intent", false], ["market_accept", false], ["market_apply", false], ["market_receipt", false],
    ["maker_request", true], ["maker_cancel", true], ["maker_handoff", true], ["maker_partial_apply", true], ["native_handoff", true], ["maker_receipt", true],
  ] as const) {
    const f = await fixture(maker);
    try {
      const childResult = spawnSync(process.execPath, ["-r", "ts-node/register", __filename, "--child", f.dir, point, String(maker),
        ...(timeStopMode ? ["--time-stop"] : []), ...(observationMode ? ["--observer"] : [])], { encoding: "utf8", timeout: 30_000 });
      assert.equal(childResult.status, 86, `${point}: ${childResult.stdout}\n${childResult.stderr}`);
      const r = await resume(f.dir);
      if (point === "intent" || point === "maker_handoff") {
        assert.equal(r.result?.outcome, "pending");
        assert(r.state.getPendingOrder()); assert(r.state.isRecoveryMode());
        assert.equal(r.ex.disk.marketSubmits, 0, "missing order alone NEVER authorizes resubmit");
        assert.equal(r.state.get().positions[0].qty, Q);
        assert.equal(r.state.get().forcedExitCooldownUntil, 0);
      } else {
        assert.equal(r.state.get().positions.length, 0);
        assert.equal(r.state.getPendingOrder(), null);
        assert.equal(r.state.getMakerTpOrder(), null);
        const tpRace = timeStopMode && (point === "native_handoff" || point === "maker_receipt");
        assert.equal(r.state.get().forcedExitCooldownUntil, tpRace ? 0 : highExitCooldown(policy, T + 20_000, T + 60_000)!.until);
        assert.equal(r.state.get().aggressive10Ladder, null);
        const expected = point === "native_handoff" ? 20 - .055 - .066
          : point === "maker_receipt" ? 20 - .055 - .024
          : point === "maker_partial_apply" ? 14 - .055 - .0096 - .0363 : 10 - .055 - .0605;
        assert(Math.abs(r.state.get().realizedPnl - expected) < 1e-8, `${point}: PnL ${r.state.get().realizedPnl}/${expected}`);
        const before = JSON.stringify([r.state.get().realizedPnl, r.state.get().totalFees, r.state.get().totalBatchCloses, r.state.get().forcedExitCooldownUntil]);
        const again = await resume(f.dir);
        assert.equal(JSON.stringify([again.state.get().realizedPnl, again.state.get().totalFees, again.state.get().totalBatchCloses, again.state.get().forcedExitCooldownUntil]), before);
        assert.equal(r.ex.disk.marketSubmits, point === "native_handoff" || point === "maker_receipt" ? 0 : 1);
        if (observationMode && point !== "native_handoff" && point !== "maker_receipt") {
          const evidence = r.state.get().completedLongTransactions.at(-1)!.observation!;
          assert(evidence.fullFlat); assert.equal(evidence.cause, "owned_market");
          assert.equal(evidence.unscorable, null); assert.equal(evidence.finalExecTime, T + 20_000);
          assert.equal(evidence.filledQty, Q); assert.equal(evidence.intent.allocation.targets[0].preNotional, 100);
        }
      }
      count++;
    } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
  }

  for (const mode of ["cancel_ambiguous", "reject", "maker_full_race", "preexisting_native", "missing_timestamp", "existing_longer_cooldown"] as const) {
    const f = await fixture(mode === "cancel_ambiguous" || mode === "maker_full_race");
    try {
      f.ex.ambiguousCancel = mode === "cancel_ambiguous";
      f.ex.partialOnCancel = mode === "maker_full_race" ? 10 : 0;
      f.ex.rejectMarket = mode === "reject";
      if (mode === "preexisting_native") { f.ex.disk.qty = 0; f.ex.disk.native = { qty: Q, time: T + 1 }; }
      if (mode === "existing_longer_cooldown") f.state.setForcedExitCooldown(T + 24 * 3_600_000);
      const executor = f.ex.executor();
      if (mode === "missing_timestamp") {
        const original = executor.queryOrderExecutions;
        executor.queryOrderExecutions = async (...args) => { const e = await original(...args); delete e.lastExecTime; return e; };
      }
      const result = f.state.getMakerTpOrder()
        ? await executeMakerTpMarketFallback({ ...base, state: f.state, executor, reason: AGGRESSIVE10_HIGH_REASON, closeCooldown: policy })
        : await executeFullCloseTransaction({ ...base, state: f.state, executor, reason: AGGRESSIVE10_HIGH_REASON, closeCooldown: policy });
      if (mode === "cancel_ambiguous") {
        assert.equal(result.outcome, "pending"); assert.equal(f.ex.disk.marketSubmits, 0); assert(f.state.getMakerTpOrder()?.closeRequest?.closeCooldown);
      } else if (mode === "reject") {
        assert.equal(result.outcome, "rejected"); assert.equal(f.state.get().positions.length, 1); assert.equal(f.state.get().forcedExitCooldownUntil, 0);
      } else {
        assert.equal(result.outcome, "committed");
        if (mode === "preexisting_native") assert.equal(f.state.get().forcedExitCooldownUntil, 0);
        if (mode === "existing_longer_cooldown") assert.equal(f.state.get().forcedExitCooldownUntil, T + 24 * 3_600_000);
        if (mode === "missing_timestamp") {
          const receipt = f.state.get().completedLongTransactions.at(-1)!;
          assert.equal(receipt.closeCooldown?.anchorSource, "observation_fallback");
          assert(receipt.closeCooldown!.until >= highExitCooldown(policy, T + 20_000, T + 60_000)!.until);
        }
        if (mode === "maker_full_race") {
          assert.equal(f.ex.disk.marketSubmits, 0);
          const receipt = f.state.get().completedMakerTpOrders.at(-1)!;
          if (timeStopMode) { assert.equal(receipt.closeCooldown, undefined); assert.equal(receipt.closeReason, "TP"); }
          else assert(receipt.closeCooldown);
        }
      }
      count++;
    } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
  }
  for (const maker of [false, true]) {
    const f = await fixture(maker);
    try {
      const before = fs.readFileSync(path.join(f.dir, "state.json"), "utf8");
      const invalid = policy.kind === "aggressive10_high" ? { ...policy, referenceHigh: NaN } : { ...policy, referencePrice: NaN };
      await assert.rejects(() => maker
        ? executeMakerTpMarketFallback({ ...base, state: f.state, executor: f.ex.executor(), reason: AGGRESSIVE10_HIGH_REASON, closeCooldown: invalid })
        : executeFullCloseTransaction({ ...base, state: f.state, executor: f.ex.executor(), reason: AGGRESSIVE10_HIGH_REASON, closeCooldown: invalid }), /invalid/);
      assert.equal(f.ex.disk.marketSubmits, 0);
      assert.equal(fs.readFileSync(path.join(f.dir, "state.json"), "utf8"), before, "invalid policy must not mutate durable state");
      count++;
    } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
  }
  for (const evidence of [
    { cumExecQty: 4 }, { orderLinkId: "other" }, { identityConfirmed: false }, { executionIds: [] },
  ]) {
    const executor = { queryOrderExecutions: async (_symbol: string, _link: string, exact: boolean) => {
      assert.equal(exact, true);
      return { found: true, orderLinkId: "market", orderId: "order", identityConfirmed: true, executionIds: ["exec"],
        cumExecQty: Q, cumExecNotional: Q * 11, avgPrice: 11, lastExecTime: T + 20_000, ...evidence };
    } } as unknown as Executor;
    assert.equal(await exactCloseExecutionTime(executor, "HYPEUSDT", "market", Q), undefined);
  }
  console.log(`${timeStopMode ? "time-stop" : "aggressive10"} crash/race tests passed (${count} cases; 10 actual child-process exits; 4 timestamp-evidence rejection checks)`);
}

if (require.main === module) {
  if (process.argv[2] === "--child") child(process.argv[3], process.argv[4], process.argv[5] === "true").catch(e => { console.error(e); process.exitCode = 1; });
  else main().catch(e => { console.error(e); process.exitCode = 1; });
}
