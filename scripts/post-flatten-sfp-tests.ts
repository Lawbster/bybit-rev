import assert from "assert/strict";
import fs from "fs";
import path from "path";
import { fixture } from "./aggressive10-crash-tests";
import { executeFullCloseTransaction } from "../src/bot/long-transaction-coordinator";
import { executeMakerTpMarketFallback } from "../src/bot/maker-tp-coordinator";
import { PostFlattenSfpShadow, postFlattenSfpSignal } from "../src/bot/post-flatten-sfp-shadow";
import type { Candle } from "../src/fetch-candles";

const T = Date.UTC(2026, 8, 10, 12), H = 3_600_000, M = 60_000;
const reason = "HARD FLATTEN: synthetic receipt provenance test";
const minutes = (end: number): Candle[] => Array.from({ length: (end - (T - 22 * H)) / M }, (_, i) => {
  const timestamp = T - 22 * H + i * M;
  return { timestamp, open: 11, high: 12, low: timestamp >= T && timestamp < T + H ? 9 : 10,
    close: 10.5, volume: 1, turnover: 11 };
});
function rows(dir: string): any[] {
  return fs.readdirSync(dir).filter(f => f.endsWith(".jsonl")).flatMap(f => fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n").filter(Boolean).map(x => JSON.parse(x)));
}
async function main() {
  assert.equal(postFlattenSfpSignal(minutes(T + H), T + H).signal, true);
  assert.equal(postFlattenSfpSignal(minutes(T + H), T + H - M).signal, false);
  assert.throws(() => postFlattenSfpSignal(minutes(T + H).filter(c => c.timestamp !== T - H), T + H), /continuous/);
  const future = minutes(T + 2 * H); future.at(-1)!.low = .1;
  assert.deepEqual(postFlattenSfpSignal(future, T + H), postFlattenSfpSignal(minutes(T + H), T + H));
  let cases = 0;
  for (const mode of ["market", "maker_zero", "maker_partial", "maker_full", "native", "missing_time", "missing_prefix", "restart", "gap", "abandon", "expiry", "corrupt", "live_reentered", "journal_retry", "late"] as const) {
    const maker = mode.startsWith("maker") || mode === "missing_prefix" || mode === "native";
    const f = await fixture(maker);
    try {
      if (mode === "maker_partial" || mode === "missing_prefix") f.ex.partialOnCancel = 4;
      if (mode === "maker_full") f.ex.partialOnCancel = 10;
      if (mode === "native") f.ex.nativeOnCancel = true;
      const file = path.join(f.dir, "observer.json");
      let observer = new PostFlattenSfpShadow(file, f.dir, "HYPEUSDT", T);
      const executor = f.ex.executor();
      if (mode === "missing_time") {
        const original = executor.queryOrderExecutions;
        executor.queryOrderExecutions = async (...args) => { const e = await original(...args); delete e.lastExecTime; return e; };
      }
      const base = { state: f.state, executor, symbol: "HYPEUSDT", feeRate: .00055, entryFeeRate: .00055,
        makerExitFeeRate: .0002, touchGraceMs: 2000, now: T + 5000, reason, observeForcedClose: true };
      const result = maker ? await executeMakerTpMarketFallback(base) : await executeFullCloseTransaction(base);
      assert.equal(result.outcome, "committed");
      if (mode === "missing_prefix") {
        // Receipt evidence is immutable in production; simulate corrupted/incomplete evidence, not a price guess.
        f.state.get().completedLongTransactions.at(-1)!.observation!.unscorable = "inventory_or_prefix_evidence_incomplete";
      }
      if (mode === "live_reentered") f.state.addPosition({ entryTime: T + M, entryPrice: 11, qty: 1, notional: 11, level: 0 });
      const tradingBefore = fs.readFileSync(path.join(f.dir, "state.json"), "utf8");
      if (mode === "journal_retry") {
        const original = fs.appendFileSync;
        // Crash/I/O failure after journal append but before outbox acknowledgement.
        (fs as any).appendFileSync = (...args: any[]) => { (original as any)(...args); throw new Error("simulated append acknowledgement failure"); };
        try { observer.tick(f.state.get(), minutes(T + M), T + M + 5000); }
        finally { fs.appendFileSync = original; }
        assert(observer.health().lastError);
        observer = new PostFlattenSfpShadow(file, f.dir, "HYPEUSDT", T + M + 6000);
      }
      observer.tick(f.state.get(), minutes(T + M), T + M + 5000);
      if (["native", "missing_time", "missing_prefix"].includes(mode)) {
        assert(!rows(f.dir).some(r => r.type === "armed"));
        assert(rows(f.dir).some(r => r.type === "unscorable_close"));
      } else if (mode === "maker_full") {
        assert(!rows(f.dir).some(r => r.type === "armed"));
      } else {
        const armed = rows(f.dir).find(r => r.type === "armed");
        assert(armed); assert.deepEqual(armed.notionals, [100], "surviving notional, not a fabricated $800 rung");
        assert.equal(armed.at, T + 20_000, "execution time, not receipt completion time");
        assert.equal(armed.price, mode === "maker_partial" ? 11.4 : 11);
        if (mode === "restart") observer = new PostFlattenSfpShadow(file, f.dir, "HYPEUSDT", T + 2 * M);
        let cs = minutes(T + H), now = T + H + 5000;
        if (mode === "late") now = T + H + 40_000;
        if (mode === "gap") cs = cs.filter(c => c.timestamp !== T + 3 * M);
        if (mode === "abandon") { cs[cs.findIndex(c => c.timestamp === T + 3 * M)].close = 12; }
        if (mode === "expiry") {
          cs = minutes(T + 25 * H).map(c => ({ ...c, low: 10, close: 11.01 })); now = T + 25 * H;
        }
        if (mode === "corrupt") {
          fs.writeFileSync(file, "broken"); observer = new PostFlattenSfpShadow(file, f.dir, "HYPEUSDT", now);
        }
        observer.tick(f.state.get(), cs, now); observer.tick(f.state.get(), cs, now);
        if (mode === "corrupt") { assert(observer.health().lastError); assert.equal(fs.readFileSync(file, "utf8"), "broken"); }
        else if (["gap", "abandon", "expiry"].includes(mode)) {
          assert(!rows(f.dir).some(r => r.type === "signal"));
          assert(rows(f.dir).some(r => r.type === ({ gap: "unscorable_gap", abandon: "abandoned_above_3pct", expiry: "expired" } as any)[mode]));
          if (mode === "expiry") assert.equal(rows(f.dir).find(r => r.type === "expired").decisionAt, T + 24 * H + M,
            "strict >24h from actual fill, not >=24h from intent");
        } else {
          const signals = rows(f.dir).filter(r => r.type === "signal"); assert.equal(signals.length, 1);
          assert.equal(signals[0].decisionAt, T + H); assert.equal(signals[0].timely, mode !== "late");
          assert.equal(signals[0].actualPositionOpen, mode === "live_reentered");
          if (mode === "journal_retry") {
            const armedRows = rows(f.dir).filter(r => r.type === "armed");
            assert.equal(armedRows.length, 2); assert.equal(new Set(armedRows.map(r => r.id)).size, 1);
          }
        }
      }
      assert.equal(fs.readFileSync(path.join(f.dir, "state.json"), "utf8"), tradingBefore, "observer never changes trading state");
      cases++;
    } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
  }
  console.log(`post-flatten SFP tests passed (${cases} receipt/restart/gap cases plus closed-bar causality checks)`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
