import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { StateManager } from "../src/bot/state";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "state-load-safety-"));
const file = path.join(dir, "state.json");
try {
  const base = new StateManager(file).get();
  assert(!fs.existsSync(file), "fresh offline state isn't implicitly persisted");
  assert.throws(() => new StateManager(file, { requireExisting: true }), /refusing to trade/);
  assert(!fs.existsSync(file));

  for (const invalid of ["{", "null", "[]", "{}", JSON.stringify({ ...base, positions: null }),
    JSON.stringify({ ...base, realizedPnl: "bad" }), JSON.stringify({ ...base, recoveryMode: "false" }),
    JSON.stringify({ ...base, pendingOrder: {} }), JSON.stringify({ ...base, makerTpOrder: {} }),
    JSON.stringify({ ...base, completedLongTransactions: {} }), JSON.stringify({ ...base, version: 999 }),
    JSON.stringify({ ...base, positions: [{ id: "p", qty: -1 }] }),
    JSON.stringify({ ...base, lastTrendCheck: null }), JSON.stringify({ ...base, aggressive10Ladder: false }),
    JSON.stringify({ ...base, hedgePosition: false }), JSON.stringify({ ...base, damagedRegimeLatch: { active: "false" } })]) {
    fs.writeFileSync(file, invalid);
    assert.throws(() => new StateManager(file), /refusing to trade/);
    assert.equal(fs.readFileSync(file, "utf8"), invalid, "corrupt evidence must not be overwritten");
    assert(!fs.existsSync(`${file}.tmp`));
  }
  const old = { version: 2, positions: [], realizedPnl: 12, totalFees: 1, pendingOrder: null, damagedRegimeLatch: null };
  fs.writeFileSync(file, JSON.stringify(old));
  const migrated = new StateManager(file, { requireExisting: true }).get();
  assert.equal(migrated.version, 6);
  assert.equal(migrated.realizedPnl, 12);
  assert.equal(migrated.damagedRegimeLatch.active, false, "legacy null latch retains its existing migration");
  assert.deepEqual(migrated.completedLongTransactions, []);
  assert.equal(fs.readFileSync(file, "utf8"), JSON.stringify(old), "loading never rewrites migration");

  const pending = { kind: "long_open", action: "open", orderLinkId: "test-open", symbol: "HYPEUSDT",
    createdAt: 1000, level: 0, requestedNotional: 800, preLocalQty: 0, preExchangeQty: 0,
    qtyStep: .01, lastObservedStatus: "unknown", lastCheckedAt: 1001 };
  fs.writeFileSync(file, JSON.stringify({ ...base, pendingOrder: pending, recoveryMode: true }));
  assert.deepEqual(new StateManager(file).getPendingOrder(), pending);
  assert.equal(new StateManager(file).isRecoveryMode(), true);

  // Version-1 maker intent remains migratable, including its durable touch deadline.
  const position = { id: "p", entryPrice: 100, entryTime: 1000, qty: 1, notional: 100, level: 0 };
  const maker = { version: 1, symbol: "HYPEUSDT", orderLinkId: "maker-legacy", orderId: "exchange-maker",
    phase: "fallback_required", closeReason: "TP", activeTpPct: 1.4, price: 101.4, requestedQty: 1, qtyStep: .01,
    allocation: { mode: "pro_rata", targets: [{ positionId: "p", preQty: 1, preNotional: 100 }], preTotalQty: 1 },
    prePositionCount: 1, preAvgEntry: 100, preOldestEntryTime: 1000, createdAt: 1001, updatedAt: 1004,
    touchedAt: 1002, fallbackDeadlineAt: 3002, lastObservedStatus: "New", lastCheckedAt: 1004,
    makerCumExecQty: 0, makerCumExecNotional: 0, appliedQty: 0, appliedExecNotional: 0, appliedPnl: 0, appliedFees: 0, executionIds: [] };
  const legacyMakerBytes = JSON.stringify({ ...base, version: 4, positions: [position], makerTpOrder: maker });
  fs.writeFileSync(file, legacyMakerBytes);
  const makerLoaded = new StateManager(file, { requireExisting: true }).getMakerTpOrder()!;
  assert.equal(makerLoaded.version, 2);
  assert.equal(makerLoaded.exchangePrice, null);
  assert.equal(makerLoaded.closeRequest!.requestedAt, 1002);
  assert.equal(makerLoaded.closeRequest!.fallbackAfterAt, 3002);
  assert.equal(makerLoaded.closeRequest!.source, "tp_touch");
  assert.equal(fs.readFileSync(file, "utf8"), legacyMakerBytes);

  // Simulate an unreadable existing file without OS-dependent chmod behavior.
  const read = fs.readFileSync;
  try {
    fs.readFileSync = ((p: fs.PathOrFileDescriptor, ...args: any[]) => {
      if (p === file) throw Object.assign(new Error("denied"), { code: "EACCES" });
      return (read as any)(p, ...args);
    }) as typeof fs.readFileSync;
    assert.throws(() => new StateManager(file), /refusing to trade: denied/);
  } finally { fs.readFileSync = read; }

  fs.writeFileSync(file, "{broken");
  const child = spawnSync(process.execPath, ["-r", "ts-node/register/transpile-only", "-e",
    "const {StateManager}=require('./src/bot/state'); new StateManager(process.argv[1],{requireExisting:true}); console.log('MUTATION_ALLOWED');", file],
    { encoding: "utf8", timeout: 10_000, windowsHide: true });
  assert.equal(child.status, 1);
  assert(!child.stdout.includes("MUTATION_ALLOWED"));
  assert(child.stderr.includes("refusing to trade"));
  assert.equal(fs.readFileSync(file, "utf8"), "{broken");
  console.log("state load safety tests passed (including fatal child-process startup)");
} finally {
  // Only the explicitly created fixture; no recursive deletion or live files.
  if (fs.existsSync(file)) fs.unlinkSync(file);
  fs.rmdirSync(dir);
}
