import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { HlShortBreakdownShadow } from "../src/bot/hl-short-breakdown-shadow";

const MINUTE = 60_000;
const T = Date.UTC(2026, 4, 21, 1, 45);

function append(filePath: string, rows: unknown[]): void {
  fs.appendFileSync(filePath, rows.map(row => JSON.stringify(row)).join("\n") + "\n");
}

function seed(root: string): void {
  const data = path.join(root, "data");
  fs.mkdirSync(data, { recursive: true });
  const candles: unknown[] = [];
  for (let i = 30; i >= 1; i--) {
    const ts = T - i * MINUTE;
    const current = i <= 15;
    const progress = current ? (15 - i) / 14 : 0;
    const close = current ? 100 - progress : 100;
    candles.push({
      ts,
      o: current && i === 15 ? 100.2 : close + 0.05,
      h: close + 0.2,
      l: current ? close - 0.2 : 99.7,
      c: close,
      v: 100,
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

const root = fs.mkdtempSync(path.join(os.tmpdir(), "hype-hl-short-shadow-"));
try {
  seed(root);
  const shadow = new HlShortBreakdownShadow(root, T);
  const first = shadow.poll(T + 2 * MINUTE);
  assert.equal(first.status, "healthy");
  assert.equal(first.counters.decisions, 1);
  assert.equal(first.counters.rawSignals, 1);
  assert.equal(first.counters.openedRuns, 1);
  assert.equal(first.active.immediateOpenOrPending, 1);
  assert.equal(first.active.delayedOpenOrPending, 1);

  const stateFile = path.join(root, "data", "HYPEUSDT_hl_short_breakdown_shadow_state.json");
  const healthFile = path.join(root, "data", "HYPEUSDT_hl_short_breakdown_shadow_health.json");
  const eventFile = path.join(root, "data", "HYPEUSDT_hl_short_breakdown_shadow.jsonl");
  assert.ok(fs.existsSync(stateFile));
  assert.ok(fs.existsSync(healthFile));
  const firstEvents = fs.readFileSync(eventFile, "utf8").trim().split(/\r?\n/).map(line => JSON.parse(line));
  assert.equal(new Set(firstEvents.map(row => row.eventId)).size, firstEvents.length, "normal journal rows have unique logical event IDs");
  assert.equal(firstEvents.filter(row => row.event === "signal").length, 1);
  assert.equal(firstEvents.filter(row => row.event === "open").length, 2);

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
  assert.ok(Math.abs(closed.counters.immediatePnlPct - 1.89) < 1e-9);

  const eventCount = fs.readFileSync(eventFile, "utf8").trim().split(/\r?\n/).length;
  const restarted = new HlShortBreakdownShadow(root, T + 3 * MINUTE);
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
  const gapRestart = new HlShortBreakdownShadow(root, future + 1);
  assert.equal(gapRestart.poll(future + 1).integrity.healthy, false, "catch-up integrity failure is durable across restart");

  const dryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hype-hl-short-shadow-dry-"));
  try {
    seed(dryRoot);
    const dry = new HlShortBreakdownShadow(dryRoot, T);
    const dryHealth = dry.poll(T + 2 * MINUTE, { dryRun: true });
    assert.equal(dryHealth.counters.rawSignals, 1);
    assert.equal(fs.existsSync(path.join(dryRoot, "data", "HYPEUSDT_hl_short_breakdown_shadow_state.json")), false);
    assert.equal(fs.existsSync(path.join(dryRoot, "data", "HYPEUSDT_hl_short_breakdown_shadow.jsonl")), false);
  } finally {
    fs.rmSync(dryRoot, { recursive: true, force: true });
  }

  const source = fs.readFileSync(path.resolve(__dirname, "../src/bot/hl-short-breakdown-shadow.ts"), "utf8");
  for (const forbidden of ["LiveExecutor", "submitOrder", "setPendingOrder", "bot-flatten", "child_process", "pm2 restart"]) {
    assert.ok(!source.includes(forbidden), `shadow source must not contain ${forbidden}`);
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log("HL short breakdown shadow tests passed");
