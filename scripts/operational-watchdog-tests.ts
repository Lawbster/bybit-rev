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

  fs.writeFileSync(path.join(dataDir, "HYPEUSDT_hl_short_breakdown_shadow_health.json"), JSON.stringify({
    version: 1,
    symbol: "HYPEUSDT",
    candidate: "hl_bid_pull_break",
    shadowOnly: true,
    processStartedAt: NOW - 600_000,
    writtenAt: NOW,
    status: "healthy",
    statusReasons: [],
    decision: { lastTs: NOW - 5 * 60_000, ready: true },
  }));
  const shortLiveHealthFile = path.join(dataDir, "HYPEUSDT_hl_short_live_health.json");
  fs.writeFileSync(shortLiveHealthFile, JSON.stringify({
    version: 1,
    symbol: "HYPEUSDT",
    executionOwner: true,
    enabled: false,
    status: "disabled",
    statusReasons: [],
    position: { active: false, qty: 0, protectionStatus: null },
    pending: { active: false, kind: null, orderLinkId: null, ageMs: null },
    recovery: { active: false, reason: null },
  }));

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

    const shadowHealthFile = path.join(dataDir, "HYPEUSDT_hl_short_breakdown_shadow_health.json");
    const degradedShadow = JSON.parse(fs.readFileSync(shadowHealthFile, "utf8"));
    degradedShadow.status = "degraded";
    degradedShadow.statusReasons = ["hl_ob_bands:stale"];
    fs.writeFileSync(shadowHealthFile, JSON.stringify(degradedShadow));
    assert.ok((await watchdog.poll({ dryRun: true })).incidents.some(row => row.key === "hl_short_shadow_degraded"));
    degradedShadow.status = "healthy";
    degradedShadow.statusReasons = [];
    fs.writeFileSync(shadowHealthFile, JSON.stringify(degradedShadow));

    const liveHealth = JSON.parse(fs.readFileSync(shortLiveHealthFile, "utf8"));
    liveHealth.enabled = true;
    liveHealth.status = "recovery";
    liveHealth.recovery = { active: true, reason: "synthetic_mismatch" };
    fs.writeFileSync(shortLiveHealthFile, JSON.stringify(liveHealth));
    assert.ok((await watchdog.poll({ dryRun: true })).incidents.some(row => row.key === "hl_short_live_recovery"));
    liveHealth.enabled = false;
    liveHealth.status = "disabled";
    liveHealth.recovery = { active: false, reason: null };
    fs.writeFileSync(shortLiveHealthFile, JSON.stringify(liveHealth));

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

    const minuteFloor = Math.floor(NOW / 60_000) * 60_000;
    fs.writeFileSync(path.join(dataDir, "HYPEUSDT_taker_hyperliquid.jsonl"), Array.from({ length: 60 }, (_, index) => JSON.stringify({
      timestamp: minuteFloor - (59 - index) * 60_000,
      buyNotional: 120,
      sellNotional: 100,
    })).join("\n") + "\n");
    fs.writeFileSync(path.join(dataDir, "HYPEUSDT_asset_ctx_hyperliquid.jsonl"), [
      { timestamp: NOW - 4 * 3600000 - 30_000, openInterestValue: 100 },
      { timestamp: NOW - 30_000, openInterestValue: 102 },
    ].map(row => JSON.stringify(row)).join("\n") + "\n");
    fs.writeFileSync(path.join(dataDir, "HYPEUSDT_1m.jsonl"), Array.from({ length: 31 }, (_, index) => JSON.stringify({
      ts: minuteFloor - (31 - index) * 60_000,
      c: 100,
    })).join("\n") + "\n");
    const logDir = path.join(root, "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const cutoff = NOW - 30 * 86400000;
    fs.writeFileSync(path.join(logDir, `equity_${new Date(cutoff).toISOString().slice(0, 10)}.jsonl`), JSON.stringify({
      ts: new Date(cutoff - 5 * 60_000).toISOString(),
      realizedPnl: 10_000,
    }) + "\n");
    fs.writeFileSync(path.join(dataDir, "HYPEUSDT_decisions.jsonl"), JSON.stringify({
      ts: NOW - 31 * 86400000,
      decision: "ladder_add",
    }) + "\n");

    const flatRuntime = runtime();
    flatRuntime.positions = { rungs: 0, localLongQty: 0 };
    flatRuntime.desiredLongTp = { present: false };
    flatRuntime.reconciliation = { ...flatRuntime.reconciliation, exchangeFlat: true, localLongQty: 0, exchangeLongQty: 0 };
    flatRuntime.upsideInputs = {
      configuredBaseUsdt: 800,
      equity: 37_000,
      realizedPnl: 14_000,
      market: {
        observedAt: NOW,
        price: 90,
        high14d: 110,
        distanceFromHigh14dPct: 18.18,
        lastCompleted4hClose: 90,
        ema2004h: 80,
        aboveEma200: true,
        euphoriaCapActive: false,
        dataHealthy: true,
      },
    };
    assert.equal(writeRuntimeHealthSnapshot(runtimeFile, flatRuntime).success, true);
    assert.deepEqual((await watchdog.poll({ dryRun: false })).incidents, []);
    assert.equal(fs.existsSync(path.join(dataDir, "HYPEUSDT_upside_readiness.json")), true);

    const openedRuntime = { ...flatRuntime, positions: { rungs: 1, localLongQty: 10 } };
    openedRuntime.desiredLongTp = runtime().desiredLongTp;
    assert.equal(writeRuntimeHealthSnapshot(runtimeFile, openedRuntime).success, true);
    assert.deepEqual((await watchdog.poll({ dryRun: false })).incidents, []);
    assert.equal(fs.existsSync(path.join(dataDir, "HYPEUSDT_upside_readiness_opens.jsonl")), true, "flat-to-open transition records readiness assessment");

    const restartedRuntime = { ...openedRuntime, processStartedAt: NOW + 1_000 };
    assert.equal(writeRuntimeHealthSnapshot(runtimeFile, restartedRuntime).success, true);
    const restartPoll = await watchdog.poll({ dryRun: false });
    assert.ok(restartPoll.incidents.some(row => row.key === "main_process_restarted"), "durable process identity detects restart");
    const durableState = JSON.parse(fs.readFileSync(path.join(dataDir, "HYPEUSDT_operational_watchdog_state.json"), "utf8"));
    assert.equal(durableState.lastRuntimeProcessStartedAt, restartedRuntime.processStartedAt);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log("operational watchdog tests passed");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
