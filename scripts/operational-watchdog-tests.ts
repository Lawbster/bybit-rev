import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { evaluateOperationalHealth } from "../src/bot/operational-health";
import {
  buildSourceGroups,
  OperationalWatchdog,
  readLastValidJsonLine,
} from "../src/bot/operational-watchdog";
import { RuntimeHealthSnapshotV1, writeRuntimeHealthSnapshot } from "../src/bot/runtime-health";
import { LadderAlerter } from "../src/bot/ladder-alerter";

const NOW = Date.now();

function runtime(): RuntimeHealthSnapshotV1 {
  return {
    version: 1,
    symbol: "HYPEUSDT",
    processStartedAt: NOW - 600_000,
    writtenAt: NOW,
    mode: "LIVE",
    mainLoop: { lastCycleAt: NOW, cycleCount: 100 },
    websocket: { connected: true, lastPriceAt: NOW, ageMs: 0, stale: false },
    context: {
      healthy: true,
      horizonDays: 14,
      expectedBars: 4032,
      actualContinuousBars: 4032,
      earliestContinuousTs: NOW - 14 * 86400000,
      latestClosedTs: NOW - 300000,
    },
    reconciliation: {
      lastAttemptAt: NOW,
      lastSuccessAt: NOW,
      status: "synced",
      synced: true,
      exchangeFlat: false,
      localLongQty: 10,
      exchangeLongQty: 10,
      absDiff: 0,
      tolerance: 0.005,
    },
    transaction: { pending: false },
    recovery: { active: false, ownerOrderLinkId: null },
    desiredLongTp: {
      present: true,
      price: 68,
      positionQtyBasis: 10,
      activeTpPct: 1.4,
      syncStatus: "confirmed",
      updatedAt: NOW,
      ageMs: 0,
    },
    positions: { rungs: 1, localLongQty: 10 },
  };
}

async function main(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reverse-copy-watchdog-"));
  const dataDir = path.join(root, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const requiredCollectorStreams = [
    "_market.jsonl",
    "_1m.jsonl",
    "_oi_live.jsonl",
    "_funding_live.jsonl",
    "_ob_bands.jsonl",
    "_oi_live_binance.jsonl",
    "_funding_live_binance.jsonl",
    "_taker_binance.jsonl",
  ];
  const streams = Object.fromEntries(requiredCollectorStreams.map(name => [name, {
    exists: true,
    mtimeMs: NOW,
    ageMinutes: 0,
  }]));
  const collectorRow = {
    timestamp: NOW,
    perSymbol: [{ symbol: "HYPEUSDT", streams }],
  };

  const collectorFile = path.join(dataDir, "collector_health.jsonl");
  fs.writeFileSync(collectorFile, JSON.stringify({ timestamp: NOW - 300000, perSymbol: [] }) + "\n");
  fs.appendFileSync(collectorFile, JSON.stringify(collectorRow) + "\n{truncated");
  assert.equal(readLastValidJsonLine<any>(collectorFile).timestamp, NOW);

  const hlFiles = [
    "HYPEUSDT_taker_hyperliquid.jsonl",
    "HYPEUSDT_oi_live_hyperliquid.jsonl",
    "HYPEUSDT_funding_live_hyperliquid.jsonl",
    "HYPEUSDT_ob_bands_hyperliquid.jsonl",
    "HYPEUSDT_asset_ctx_hyperliquid.jsonl",
  ];
  for (const name of hlFiles) fs.writeFileSync(path.join(dataDir, name), "{}\n");

  const runtimeFile = path.join(dataDir, "HYPEUSDT_runtime_health.json");
  assert.equal(writeRuntimeHealthSnapshot(runtimeFile, runtime()).success, true);

  const watchdogSource = fs.readFileSync(path.resolve(__dirname, "../src/bot/operational-watchdog.ts"), "utf8");
  for (const forbidden of ["LiveExecutor", "submitOrder", "bot-flatten", "child_process", "pm2 restart"]) {
    assert.ok(!watchdogSource.includes(forbidden), `watchdog source must not contain ${forbidden}`);
  }

  const watchdog = new OperationalWatchdog("HYPEUSDT", root, NOW - 600_000);
  try {
    const result = await watchdog.poll({ dryRun: true });
    assert.deepEqual(result.incidents, []);
    assert.equal(fs.existsSync(path.join(dataDir, "HYPEUSDT_operational_watchdog_state.json")), false);
    assert.equal(fs.existsSync(path.join(dataDir, "HYPEUSDT_operational_health_events.jsonl")), false);

    const taker = streams["_taker_binance.jsonl"];
    taker.mtimeMs = NOW - 11 * 60_000;
    let groups = buildSourceGroups({ now: NOW, symbol: "HYPEUSDT", dataDir, collector: collectorRow });
    let incidents = evaluateOperationalHealth({
      now: NOW,
      watchdogStartedAt: NOW - 600_000,
      runtime: runtime(),
      runtimeFileAgeMs: 0,
      collectorHealthAgeMs: 0,
      sourceGroups: groups,
      inputErrorAgeMs: null,
    });
    assert.ok(!incidents.some(row => row.key === "binance_pulse_stale"), "11m taker age remains inside loose 12m threshold");

    taker.mtimeMs = NOW - 13 * 60_000;
    groups = buildSourceGroups({ now: NOW, symbol: "HYPEUSDT", dataDir, collector: collectorRow });
    incidents = evaluateOperationalHealth({
      now: NOW,
      watchdogStartedAt: NOW - 600_000,
      runtime: runtime(),
      runtimeFileAgeMs: 0,
      collectorHealthAgeMs: 0,
      sourceGroups: groups,
      inputErrorAgeMs: null,
    });
    assert.ok(incidents.some(row => row.key === "binance_pulse_stale"));

    // Sparse/unsupported files are intentionally absent and must not be required.
    assert.ok(!groups.flatMap(group => group.files).some(file => file.name.includes("liquidations") || file.name.includes("basis") || file.name.includes("oi_hist")));
    delete process.env.DISCORD_WEBHOOK_WATCHDOGTEST;
    const disabledAlerter = new LadderAlerter("WATCHDOGTEST");
    assert.equal(await disabledAlerter.notifyOperationalIncident({
      key: "transport_contract",
      lifecycle: "active",
      severity: "warning",
      summary: "disabled transport",
      activeSince: NOW,
      durationMs: 0,
      evidence: [],
    }), false, "disabled operational transport reports unsuccessful delivery");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log("operational watchdog tests passed");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
