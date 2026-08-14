import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { HlShortBidPullVolumeShadow } from "../src/bot/hl-short-bidpullvolume-shadow";
import { HL_SHORT_BIDPULLVOLUME_POLICY } from "../src/bot/hl-short-bidpullvolume-policy";
import {
  HL_SHORT_BREAKDOWN_CANDIDATE,
  HL_SHORT_BREAKDOWN_POLICY_VERSION,
} from "../src/bot/hl-short-breakdown-policy";

const MINUTE = 60_000;
const T = Date.UTC(2026, 4, 21, 1, 45);
const BASELINE_MINUTES = HL_SHORT_BIDPULLVOLUME_POLICY.volumeBaselineBars * 15;

function append(filePath: string, rows: unknown[]): void {
  fs.appendFileSync(filePath, rows.map(row => JSON.stringify(row)).join("\n") + "\n");
}

function seed(root: string): void {
  const data = path.join(root, "data");
  fs.mkdirSync(data, { recursive: true });
  const candles: unknown[] = [];
  for (let i = BASELINE_MINUTES + 15; i >= 16; i--) {
    candles.push({ ts: T - i * MINUTE, o: 100.05, h: 100.2, l: 99.7, c: 100, v: 100 });
  }
  for (let i = 15; i >= 1; i--) {
    const progress = (15 - i) / 14;
    const close = 100 - progress;
    candles.push({
      ts: T - i * MINUTE,
      o: i === 15 ? 100.2 : close + 0.05,
      h: close + 0.2,
      l: close - 0.2,
      c: close,
      v: 200,
    });
  }
  candles.push(
    { ts: T, o: 100, h: 100.2, l: 99.5, c: 99.8, v: 100 },
    { ts: T + MINUTE, o: 100, h: 100.2, l: 99.5, c: 99.8, v: 100 },
  );
  append(path.join(data, "HYPEUSDT_1m.jsonl"), candles);

  const taker = Array.from({ length: 15 }, (_, index) => ({
    timestamp: T - (15 - index) * MINUTE,
    buyNotional: 60,
    sellNotional: 100,
  }));
  taker.push(
    { timestamp: T, buyNotional: 1_000, sellNotional: 1 },
    { timestamp: T + MINUTE, buyNotional: 100, sellNotional: 100 },
  );
  append(path.join(data, "HYPEUSDT_taker_hyperliquid.jsonl"), taker);

  const book: unknown[] = [];
  for (let i = 15; i >= 1; i--) {
    book.push({ timestamp: T - i * MINUTE + 30_000, imbalance_0_5: i <= 5 ? -0.20 : 0.05 });
  }
  book.push(
    { timestamp: T + 30_000, imbalance_0_5: 1 },
    { timestamp: T + MINUTE + 30_000, imbalance_0_5: 0 },
  );
  append(path.join(data, "HYPEUSDT_ob_bands_hyperliquid.jsonl"), book);
  append(path.join(data, "HYPEUSDT_asset_ctx_hyperliquid.jsonl"), [
    { timestamp: T - 30_000, openInterestValue: 100 },
    { timestamp: T + MINUTE, openInterestValue: 100 },
  ]);
}

// Mirror of the live owner's validateSignalEvent predicate (src/bot/hl-short-live.ts).
// Every row this shadow writes must fail it: that is the isolation guarantee.
function acceptedByLiveOwner(event: any): boolean {
  return event.event === "signal"
    && event.symbol === "HYPEUSDT"
    && event.candidate === HL_SHORT_BREAKDOWN_CANDIDATE
    && event.policyVersion === HL_SHORT_BREAKDOWN_POLICY_VERSION
    && event.shadowOnly === true
    && typeof event.signalId === "string"
    && event.signalId.startsWith("hlbp-HYPEUSDT-")
    && !!event.features
    && event.features.candidate === HL_SHORT_BREAKDOWN_CANDIDATE
    && event.features.policyVersion === HL_SHORT_BREAKDOWN_POLICY_VERSION
    && event.features.ready === true
    && event.features.fired === true;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "hype-hl-short-bpv-shadow-"));
try {
  seed(root);
  const shadow = new HlShortBidPullVolumeShadow(root, T);
  const first = shadow.poll(T + 2 * MINUTE);
  assert.equal(first.status, "healthy", `status reasons: ${first.statusReasons.join(",")}`);
  assert.equal(first.candidate, "hl_bid_pull_volume");
  assert.equal(first.counters.decisions, 1);
  assert.equal(first.counters.rawSignals, 1);
  assert.equal(first.counters.openedRuns, 1);
  assert.equal(first.active.immediateOpenOrPending, 1);
  assert.equal(first.active.delayedOpenOrPending, 1);

  const stateFile = path.join(root, "data", "HYPEUSDT_hl_short_bidpullvolume_shadow_state.json");
  const healthFile = path.join(root, "data", "HYPEUSDT_hl_short_bidpullvolume_shadow_health.json");
  const eventFile = path.join(root, "data", "HYPEUSDT_hl_short_bidpullvolume_shadow.jsonl");
  const liveJournalFile = path.join(root, "data", "HYPEUSDT_hl_short_breakdown_shadow.jsonl");
  assert.ok(fs.existsSync(stateFile));
  assert.ok(fs.existsSync(healthFile));
  assert.ok(fs.existsSync(eventFile));
  assert.ok(!fs.existsSync(liveJournalFile), "the volume shadow must never write the live owner's journal file");

  const firstEvents = fs.readFileSync(eventFile, "utf8").trim().split(/\r?\n/).map(line => JSON.parse(line));
  assert.equal(new Set(firstEvents.map(row => row.eventId)).size, firstEvents.length, "journal rows have unique logical event IDs");
  const signals = firstEvents.filter(row => row.event === "signal");
  assert.equal(signals.length, 1);
  assert.equal(signals[0].candidate, "hl_bid_pull_volume");
  assert.ok(signals[0].signalId.startsWith("hlbpv-HYPEUSDT-"));
  assert.equal(signals[0].observationalContext.hlpVault.observationalOnly, true);
  assert.equal(signals[0].observationalContext.hlpVault.ready, false, "missing optional vault context never blocks the signal");
  assert.equal(firstEvents.filter(row => row.event === "open").length, 2);
  for (const event of firstEvents) {
    assert.ok(!acceptedByLiveOwner(event), `journal row must be rejected by the live owner filter: ${event.eventId}`);
  }

  append(path.join(root, "data", "HYPEUSDT_1m.jsonl"), [
    { ts: T + 2 * MINUTE, o: 99.8, h: 100, l: 97.5, c: 97.8, v: 100 },
  ]);
  append(path.join(root, "data", "HYPEUSDT_taker_hyperliquid.jsonl"), [
    { timestamp: T + 2 * MINUTE, buyNotional: 100, sellNotional: 100 },
  ]);
  append(path.join(root, "data", "HYPEUSDT_ob_bands_hyperliquid.jsonl"), [
    { timestamp: T + 2 * MINUTE + 30_000, imbalance_0_5: 0 },
  ]);
  append(path.join(root, "data", "HYPEUSDT_asset_ctx_hyperliquid.jsonl"), [
    { timestamp: T + 2 * MINUTE, openInterestValue: 100 },
  ]);
  const closed = shadow.poll(T + 3 * MINUTE);
  assert.equal(closed.counters.immediateCloses, 1);
  assert.equal(closed.counters.delayedCloses, 1);
  assert.equal(closed.active.runs, 0);
  assert.ok(Math.abs(closed.counters.immediatePnlPct - (1.5 - 0.11)) < 1e-9, `immediate pnl ${closed.counters.immediatePnlPct}`);

  const eventCount = fs.readFileSync(eventFile, "utf8").trim().split(/\r?\n/).length;
  const restarted = new HlShortBidPullVolumeShadow(root, T + 3 * MINUTE);
  const afterRestart = restarted.poll(T + 3 * MINUTE + 10_000);
  assert.equal(afterRestart.counters.decisions, 1, "restart must not replay an already committed decision");
  assert.equal(fs.readFileSync(eventFile, "utf8").trim().split(/\r?\n/).length, eventCount, "restart must not duplicate events");

  const future = T + 49 * 60 * MINUTE;
  append(path.join(root, "data", "HYPEUSDT_1m.jsonl"), [{ ts: future - MINUTE, o: 100, h: 100, l: 100, c: 100, v: 1 }]);
  append(path.join(root, "data", "HYPEUSDT_taker_hyperliquid.jsonl"), [{ timestamp: future - MINUTE, buyNotional: 1, sellNotional: 1 }]);
  append(path.join(root, "data", "HYPEUSDT_ob_bands_hyperliquid.jsonl"), [{ timestamp: future - 1_000, imbalance_0_5: 0 }]);
  append(path.join(root, "data", "HYPEUSDT_asset_ctx_hyperliquid.jsonl"), [{ timestamp: future - 1_000, openInterestValue: 100 }]);
  const gapHealth = restarted.poll(future);
  assert.equal(gapHealth.integrity.healthy, false, "gap beyond retained data invalidates the observation cohort");
  assert.ok(gapHealth.statusReasons.includes("catchup_gap_exceeded_retained_window"));
  const gapRestart = new HlShortBidPullVolumeShadow(root, future + 1);
  assert.equal(gapRestart.poll(future + 1).integrity.healthy, false, "catch-up integrity failure is durable across restart");

  console.log("hl-short-bidpullvolume-shadow-tests passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
