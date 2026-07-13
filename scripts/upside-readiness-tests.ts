import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { Candle } from "../src/fetch-candles";
import {
  buildGrindMidFeatures,
  evaluateUpsideMarketClamp,
  evaluateUpsideReadiness,
  GrindMidFeatures,
  readTrailingRealizedPnl,
  readUpsideOperationalHistory,
  UpsideMarketClamp,
  UpsideOperationalHistory,
  writeUpsideReadinessSnapshot,
} from "../src/bot/upside-readiness";

const DAY = 86_400_000;
const MINUTE = 60_000;
const NOW = Date.UTC(2026, 6, 13, 12, 0, 30);

function jsonl(filePath: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, rows.map(row => JSON.stringify(row)).join("\n") + "\n");
}

function healthyGrind(): GrindMidFeatures {
  return {
    observedAt: NOW,
    hlTaker1h: 1.25,
    hlAssetOi4hPct: 2,
    realizedVol30Pct: 0.1,
    takerMinuteSamples: 60,
    candleMinuteSamples: 31,
    dataHealthy: true,
    eligible: true,
  };
}

function healthyMarket(): UpsideMarketClamp {
  return {
    observedAt: NOW,
    price: 90,
    high14d: 110,
    distanceFromHigh14dPct: 18.18,
    lastCompleted4hClose: 90,
    ema2004h: 80,
    aboveEma200: true,
    euphoriaCapActive: false,
    dataHealthy: true,
  };
}

function healthyHistory(): UpsideOperationalHistory {
  return {
    windowStart: NOW - 30 * DAY,
    historyHealthy: true,
    tpCycles: 10,
    forcedCloses: 1,
    otherFullCloses: 0,
    unclassifiedFullCloses: 0,
    lastUnclassifiedFullCloseAt: null,
    srPartialExits: 2,
    lastForcedExitAt: NOW - 8 * DAY,
    lastForcedExitReason: "HARD FLATTEN: synthetic",
  };
}

async function main(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reverse-copy-upside-"));
  try {
    const logDir = path.join(root, "logs");
    const dataDir = path.join(root, "data");
    const cutoff = NOW - 30 * DAY;
    jsonl(path.join(logDir, `equity_${new Date(cutoff).toISOString().slice(0, 10)}.jsonl`), [{
      ts: new Date(cutoff - 5 * MINUTE).toISOString(),
      realizedPnl: 10_000,
    }]);
    const trailing = readTrailingRealizedPnl({ logDir, now: NOW, currentRealizedPnl: 14_000 });
    assert.equal(trailing.pnl, 4_000);
    assert.equal(trailing.healthy, true);
    assert.equal(readTrailingRealizedPnl({
      logDir,
      now: NOW,
      currentRealizedPnl: 14_000,
      maxAnchorLagMs: 4 * MINUTE,
    }).healthy, false, "readiness fails closed when the 30d PnL anchor is too far from cutoff");

    const symbol = "TESTUSDT";
    const tpAt = NOW - 60 * MINUTE;
    const forcedAt = NOW - 2 * DAY;
    jsonl(path.join(dataDir, `${symbol}_decisions.jsonl`), [
      { ts: cutoff - DAY, decision: "ladder_add" },
      { ts: forcedAt, decision: "flatten", reason: "HARD FLATTEN: synthetic", rungs: 3 },
      { ts: tpAt, decision: "tp_fill", reason: "TP", rungs: 2 },
    ]);
    const dayFile = path.join(logDir, `trades_${new Date(NOW).toISOString().slice(0, 10)}.jsonl`);
    jsonl(dayFile, [
      { ts: new Date(forcedAt + 5_000).toISOString(), action: "BATCH_CLOSE", positionsClosed: 3 },
      { ts: new Date(tpAt + 5_000).toISOString(), action: "BATCH_CLOSE", positionsClosed: 2 },
      { ts: new Date(NOW - 10 * MINUTE).toISOString(), action: "BATCH_CLOSE", positionsClosed: 1 },
    ]);
    jsonl(path.join(dataDir, `${symbol}_sr_partial_exit_actions.jsonl`), [
      { timestamp: NOW - DAY, event: "executed" },
      { timestamp: NOW - DAY, event: "candidate" },
    ]);
    const history = readUpsideOperationalHistory({ rootDir: root, logDir, symbol, now: NOW });
    assert.equal(history.historyHealthy, true);
    assert.equal(history.tpCycles, 1);
    assert.equal(history.forcedCloses, 1);
    assert.equal(history.unclassifiedFullCloses, 1);
    assert.equal(history.lastUnclassifiedFullCloseAt, NOW - 10 * MINUTE);
    assert.equal(history.srPartialExits, 1);
    assert.equal(history.lastForcedExitAt, forcedAt);

    const eligible = evaluateUpsideReadiness({
      symbol,
      now: NOW,
      configuredBaseUsdt: 800,
      equity: 37_000,
      trailingPnl: trailing,
      history: healthyHistory(),
      market: healthyMarket(),
      grindMid: healthyGrind(),
    });
    assert.equal(eligible.eligibility.eligible, true);
    assert.equal(eligible.eligibility.wouldUseBaseUsdt, 900);
    assert.deepEqual(eligible.eligibility.blockers, []);

    const capped = evaluateUpsideReadiness({
      symbol,
      now: NOW,
      configuredBaseUsdt: 800,
      equity: 37_000,
      trailingPnl: trailing,
      history: healthyHistory(),
      market: { ...healthyMarket(), euphoriaCapActive: true },
      grindMid: healthyGrind(),
    });
    assert.equal(capped.eligibility.eligible, false);
    assert.ok(capped.eligibility.blockers.includes("euphoria_cap_active"));

    const ambiguousRecentClose = evaluateUpsideReadiness({
      symbol,
      now: NOW,
      configuredBaseUsdt: 800,
      equity: 37_000,
      trailingPnl: trailing,
      history: { ...healthyHistory(), lastUnclassifiedFullCloseAt: NOW - DAY },
      market: healthyMarket(),
      grindMid: healthyGrind(),
    });
    assert.ok(ambiguousRecentClose.eligibility.blockers.includes("unclassified_full_close_within_7d"));

    const candles: Candle[] = [];
    const start = NOW - 40 * DAY;
    for (let ts = start; ts + 5 * MINUTE + 10_000 <= NOW; ts += 5 * MINUTE) {
      const progress = (ts - start) / (40 * DAY);
      const close = 70 + progress * 30;
      candles.push({ timestamp: ts, open: close, high: close * 1.001, low: close * 0.999, close, volume: 1, turnover: close });
    }
    candles.push({
      timestamp: Math.floor(NOW / (5 * MINUTE)) * 5 * MINUTE,
      open: 100,
      high: 1_000,
      low: 100,
      close: 1_000,
      volume: 1,
      turnover: 1_000,
    });
    const clamp = evaluateUpsideMarketClamp({ candles5m: candles, now: NOW, price: 100, contextHealthy: true });
    assert.equal(clamp.dataHealthy, true);
    assert.equal(clamp.aboveEma200, true);
    assert.equal(clamp.euphoriaCapActive, true);
    assert.ok((clamp.high14d ?? 0) < 1_000, "forming 5m candle is excluded from readiness context");

    const snapshotFile = path.join(dataDir, "readiness.json");
    assert.equal(writeUpsideReadinessSnapshot(snapshotFile, eligible).success, true);
    assert.equal(JSON.parse(fs.readFileSync(snapshotFile, "utf8")).shadowOnly, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  const pulseSymbol = `UPSIDE${process.pid}USDT`;
  const repoData = fs.mkdtempSync(path.join(os.tmpdir(), "reverse-copy-upside-pulse-"));
  const pulseFiles = [
    path.join(repoData, `${pulseSymbol}_taker_hyperliquid.jsonl`),
    path.join(repoData, `${pulseSymbol}_asset_ctx_hyperliquid.jsonl`),
    path.join(repoData, `${pulseSymbol}_1m.jsonl`),
  ];
  try {
    const minuteFloor = Math.floor(Date.now() / MINUTE) * MINUTE;
    const observedAt = minuteFloor + 30_000;
    jsonl(pulseFiles[0], Array.from({ length: 60 }, (_, index) => ({
      timestamp: minuteFloor - (59 - index) * MINUTE,
      buyNotional: 120,
      sellNotional: 100,
    })));
    jsonl(pulseFiles[1], [
      { timestamp: observedAt - 4 * 3_600_000 - 30_000, openInterestValue: 100 },
      { timestamp: observedAt - 30_000, openInterestValue: 102 },
    ]);
    jsonl(pulseFiles[2], Array.from({ length: 31 }, (_, index) => ({
      ts: minuteFloor - (31 - index) * MINUTE,
      c: 100,
    })));
    const grind = await buildGrindMidFeatures(pulseSymbol, observedAt, repoData);
    assert.equal(grind.dataHealthy, true);
    assert.equal(grind.eligible, true);
    assert.equal(grind.takerMinuteSamples, 60);
    assert.equal(grind.candleMinuteSamples, 31);
  } finally {
    for (const file of pulseFiles) {
      try { fs.unlinkSync(file); } catch { /* best effort */ }
    }
    fs.rmSync(repoData, { recursive: true, force: true });
  }

  console.log("upside readiness tests passed");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
