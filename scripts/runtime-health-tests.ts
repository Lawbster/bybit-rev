import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  readRuntimeHealthSnapshot,
  RuntimeHealthSnapshotV1,
  writeRuntimeHealthSnapshot,
} from "../src/bot/runtime-health";

function snapshot(writtenAt: number): RuntimeHealthSnapshotV1 {
  return {
    version: 1,
    symbol: "TESTUSDT",
    processStartedAt: 1,
    writtenAt,
    mode: "LIVE",
    mainLoop: { lastCycleAt: writtenAt, cycleCount: 1 },
    websocket: { connected: true, lastPriceAt: writtenAt, ageMs: 0, stale: false },
    context: {
      healthy: true,
      horizonDays: 14,
      expectedBars: 4032,
      actualContinuousBars: 4032,
      earliestContinuousTs: 1,
      latestClosedTs: writtenAt,
    },
    reconciliation: {
      lastAttemptAt: writtenAt,
      lastSuccessAt: writtenAt,
      status: "synced",
      synced: true,
      exchangeFlat: false,
    },
    transaction: { pending: false },
    recovery: { active: false, ownerOrderLinkId: null },
    desiredLongTp: { present: false },
    positions: { rungs: 0, localLongQty: 0 },
  };
}

function main(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reverse-copy-runtime-health-"));
  try {
    const file = path.join(root, "data", "TESTUSDT_runtime_health.json");
    assert.deepEqual(writeRuntimeHealthSnapshot(file, snapshot(100)), { success: true });
    assert.equal(readRuntimeHealthSnapshot(file).writtenAt, 100);

    assert.deepEqual(writeRuntimeHealthSnapshot(file, snapshot(200)), { success: true });
    assert.equal(readRuntimeHealthSnapshot(file).writtenAt, 200);
    assert.equal(fs.readdirSync(path.dirname(file)).filter(name => name.endsWith(".tmp")).length, 0);

    const blockingFile = path.join(root, "blocking-file");
    fs.writeFileSync(blockingFile, "not a directory");
    const failed = writeRuntimeHealthSnapshot(path.join(blockingFile, "health.json"), snapshot(300));
    assert.equal(failed.success, false);

    fs.writeFileSync(file, JSON.stringify({ version: 2 }));
    assert.throws(() => readRuntimeHealthSnapshot(file), /unsupported runtime health version/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  console.log("runtime health tests passed");
}

main();
