import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { TimeStopRuntime, timedExitMutationAllowed } from "../src/bot/time-stop-runtime";
import { ExactMinuteHistory, referenceMinuteStart } from "../src/bot/time-stop-history";
import { TIME_STOP_LOOKBACK_MS } from "../src/bot/time-stop";
import { loadBotConfig } from "../src/bot/bot-config";
import { validateHighExitCooldownPolicy } from "../src/bot/close-cooldown";
import type { Candle } from "../src/fetch-candles";
import type { Aggressive10HighSnapshot } from "../src/bot/aggressive10-policy";

const T = Date.UTC(2026, 8, 25, 12), H = 3_600_000;
const positions = [{ entryTime: T - 41 * H, qty: 10, notional: 1000 }];
const high: Aggressive10HighSnapshot = { healthy: true, decisionReady: true, reason: "healthy", decisionAt: T,
  sourceStart: T - 48 * H, bars: 2880, high: 110, close: 99, distancePct: 10 };
async function main() {
  let calls = 0;
  const history = new ExactMinuteHistory(async (_s, _i, n, end) => {
    calls++; return Array.from({ length: n }, (_, i): Candle => ({ timestamp: end! + 1 - (n - i) * 60_000,
      open: 100, high: 100, low: 100, close: 100, volume: 1, turnover: 100 }));
  }, "HYPEUSDT", { now: () => T + 5000 });
  const off = new TimeStopRuntime("off", history);
  assert.equal(off.evaluate(true, positions, high, T + 5000), null); assert.equal(calls, 0);
  const runtime = new TimeStopRuntime("live", history);
  assert.equal(runtime.evaluate(false, positions, high, T + 5000), null); assert.equal(calls, 0, "legacy profile doesn't fetch");
  assert.equal(runtime.evaluate(true, positions, high, T + 5000), null, "I/O never awaited");
  assert.equal(runtime.snapshot().unavailableSince, T + 5000);
  await new Promise(r => setImmediate(r));
  const p = runtime.evaluate(true, positions, high, T + 6000)!;
  assert.equal(p.kind, "weak_week_time_stop"); validateHighExitCooldownPolicy(p);
  assert.equal(p.referenceAt, T - TIME_STOP_LOOKBACK_MS); assert.equal(runtime.snapshot().unavailableSince, null);
  const shadow = new TimeStopRuntime("shadow", history);
  assert.deepEqual(shadow.evaluate(true, positions, high, T + 6000), p, "identical metrics in shadow/live");
  assert.equal(runtime.evaluate(true, positions, { ...high, decisionReady: false }, T + 31_000), null);
  assert.equal(runtime.evaluate(true, positions, high, T + 31_000), null, "defensive freshness check");
  assert.equal(runtime.evaluate(true, positions, high, T - 1), null, "no future decisions");
  assert.equal(runtime.evaluate(true, [{ ...positions[0], entryTime: T - H }], high, T + 6000), null);
  assert.equal(runtime.evaluate(true, positions, { ...high, close: 101 }, T + 6000), null);
  const missing = new TimeStopRuntime("shadow", new ExactMinuteHistory(async () => [], "HYPEUSDT", { now: () => T }));
  missing.evaluate(true, positions, high, T + 1); await new Promise(r => setImmediate(r));
  assert.equal(missing.snapshot().unavailableSince, T + 1);
  missing.evaluate(true, [], high, T + 2); assert.equal(missing.snapshot().unavailableSince, null);
  assert.equal(referenceMinuteStart(T, TIME_STOP_LOOKBACK_MS) + 60_000, p.referenceAt);
  const base = { now: T + 5000, decisionAt: T, expectedInventory: "a", actualInventory: "a",
    pending: false, recovery: false, makerClosing: false, tpHit: false, stalePrice: false };
  assert(timedExitMutationAllowed(base));
  for (const key of ["pending", "recovery", "makerClosing", "tpHit", "stalePrice"] as const)
    assert(!timedExitMutationAllowed({ ...base, [key]: true }));
  for (const changes of [{ actualInventory: "b" }, { now: T + 30_001 }, { now: T - 1 }])
    assert(!timedExitMutationAllowed({ ...base, ...changes }));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "time-stop-config-"));
  try {
    const file = path.join(dir, "config.json");
    for (const mode of ["off", "shadow", "live"]) {
      fs.writeFileSync(file, JSON.stringify({ timeStop: { mode }, postFlattenSfpShadow: { enabled: false } }));
      assert.equal(loadBotConfig(file).timeStop?.mode, mode);
    }
    fs.writeFileSync(file, "{}"); assert.equal(loadBotConfig(file).timeStop?.mode, "off");
    for (const value of [null, { mode: "yes" }, { mode: "live", minAgeHours: 6 }]) {
      fs.writeFileSync(file, JSON.stringify({ timeStop: value })); assert.throws(() => loadBotConfig(file), /timeStop/);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  console.log("time-stop runtime/config/race guard tests passed");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
