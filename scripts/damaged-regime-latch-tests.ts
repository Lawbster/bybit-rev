import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import type { Candle } from "../src/fetch-candles";
import {
  buildDamagedRegimeStructure,
  DamagedRegimeLatchConfig,
  DamagedRegimeLatchState,
  EMPTY_DAMAGED_REGIME_LATCH_STATE,
  evaluateDamagedRegimeLatch,
  type DamagedRegimeStructure,
} from "../src/bot/damaged-regime-latch";
import { StateManager } from "../src/bot/state";
import { loadBotConfig } from "../src/bot/bot-config";

const H4 = 4 * 60 * 60 * 1000;
const config: DamagedRegimeLatchConfig = {
  enabled: true,
  triggerEma200DistPct: -4,
  taker15mMax: 0.85,
  taker1hMax: 0.90,
  releaseEma200DistPct: -1,
  releaseBars: 2,
  minTaker15mSamples: 14,
  minTaker1hSamples: 55,
  maxTakerAgeSec: 90,
};

function structure(distPct: number, recent = [distPct, distPct], ts = 1_000): DamagedRegimeStructure {
  return { lastTimestamp: ts, lastClose: 100 + distPct, ema200: 100, distPct, recentDistPct: recent };
}

const healthyStress = {
  taker15m: 0.80,
  taker1h: 1.10,
  taker15mSamples: 15,
  taker1hSamples: 60,
  takerAgeSec: 5,
};

function initialized(): DamagedRegimeLatchState {
  return { ...EMPTY_DAMAGED_REGIME_LATCH_STATE, initialized: true };
}

function testCompletedCandleBoundary(): void {
  const candles: Candle[] = [];
  for (let i = 0; i < 202; i++) {
    const close = i === 201 ? 90 : 100;
    candles.push({ timestamp: i * H4, open: close, high: close, low: close, close, volume: 1, turnover: 1 });
  }
  candles.push({ timestamp: 202 * H4, open: 90, high: 200, low: 90, close: 200, volume: 1, turnover: 1 });
  const now = 202 * H4 + 2 * 60 * 60 * 1000;
  const value = buildDamagedRegimeStructure(candles, 200, 2, now);
  assert(value);
  assert.equal(value.lastTimestamp, 201 * H4);
  assert.equal(value.lastClose, 90, "active 4h candle must not influence structure");
  assert(value.distPct < -4);
}

function testMigrationBootstrapAndPersistence(): void {
  const decision = evaluateDamagedRegimeLatch({
    previous: { ...EMPTY_DAMAGED_REGIME_LATCH_STATE },
    config,
    structure: structure(-5),
    pulse: null,
    nowMs: 2_000,
  });
  assert.equal(decision.blocked, true);
  assert.equal(decision.transition, "triggered");
  assert.equal(decision.state.triggerReason, "bootstrap_deep_structure");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "damaged-regime-state-"));
  try {
    const file = path.join(root, "state.json");
    const state = new StateManager(file);
    state.updateDamagedRegimeLatch(decision.state);
    const reloaded = new StateManager(file);
    assert.equal(reloaded.get().damagedRegimeLatch.active, true);
    assert.equal(reloaded.get().damagedRegimeLatch.triggerReason, "bootstrap_deep_structure");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function testHealthyPulseTriggerAndIncompleteEvidence(): void {
  const fired = evaluateDamagedRegimeLatch({
    previous: initialized(), config, structure: structure(-4.1), pulse: healthyStress, nowMs: 3_000,
  });
  assert.equal(fired.blocked, true);
  assert.equal(fired.state.triggerReason, "hl_taker_15m");

  const incomplete = evaluateDamagedRegimeLatch({
    previous: initialized(),
    config,
    structure: structure(-5),
    pulse: { ...healthyStress, taker15mSamples: 5, taker1hSamples: 5 },
    nowMs: 3_000,
  });
  assert.equal(incomplete.blocked, false);
  assert.equal(incomplete.pulseStatus, "incomplete");
  assert.equal(incomplete.transition, "none");
}

function testStickyUntilTwoCompletedRecoveries(): void {
  const active = evaluateDamagedRegimeLatch({
    previous: initialized(), config, structure: structure(-5), pulse: healthyStress, nowMs: 4_000,
  }).state;
  const oneRecovery = evaluateDamagedRegimeLatch({
    previous: active, config, structure: structure(-0.5, [-2, -0.5], 2_000), pulse: null, nowMs: 5_000,
  });
  assert.equal(oneRecovery.blocked, true);
  assert.equal(oneRecovery.state.recoveryBars, 1);

  const failedRecovery = evaluateDamagedRegimeLatch({
    previous: oneRecovery.state, config, structure: structure(-2, [-0.5, -2], 3_000), pulse: null, nowMs: 6_000,
  });
  assert.equal(failedRecovery.blocked, true);
  assert.equal(failedRecovery.state.recoveryBars, 0);

  const released = evaluateDamagedRegimeLatch({
    previous: failedRecovery.state, config, structure: structure(-0.2, [-0.8, -0.2], 4_000), pulse: null, nowMs: 7_000,
  });
  assert.equal(released.blocked, false);
  assert.equal(released.transition, "released");
  assert.equal(released.state.active, false);
  assert.equal(released.state.initialized, true);
}

function testActiveStateFailsClosedWithoutData(): void {
  const active = { ...initialized(), active: true, triggeredAt: 1, triggerReason: "hl_taker_1h" };
  const decision = evaluateDamagedRegimeLatch({ previous: active, config, structure: null, pulse: null, nowMs: 2 });
  assert.equal(decision.blocked, true);
  assert.match(decision.reason, /fail-closed/);
}

function testConfigDeepMerge(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "damaged-regime-config-"));
  try {
    const file = path.join(root, "config.json");
    fs.writeFileSync(file, JSON.stringify({
      filters: { damagedRegimeLatch: { enabled: true, releaseBars: 3 } },
    }));
    const loaded = loadBotConfig(file).filters.damagedRegimeLatch!;
    assert.equal(loaded.enabled, true);
    assert.equal(loaded.releaseBars, 3);
    assert.equal(loaded.triggerEma200DistPct, -4);
    assert.equal(loaded.taker15mMax, 0.85);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

testCompletedCandleBoundary();
testMigrationBootstrapAndPersistence();
testHealthyPulseTriggerAndIncompleteEvidence();
testStickyUntilTwoCompletedRecoveries();
testActiveStateFailsClosedWithoutData();
testConfigDeepMerge();

console.log("damaged regime latch tests passed");
