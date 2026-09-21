import assert from "assert";
import fs from "fs";
import path from "path";
import ts from "typescript";
import { LiveCandleSource } from "../src/bot/live-candle-source";
import { evaluateOperationalHealth } from "../src/bot/operational-health";
import type { RuntimeHealthSnapshotV1 } from "../src/bot/runtime-health";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const candle = (timestamp: number) => ({ timestamp, open: 100, high: 101, low: 99, close: 100, volume: 1, turnover: 100 });
const rawRows = (at: number, period = HOUR, count = 5) =>
  Array.from({ length: count }, (_, i) => candle(Math.floor(at / period) * period - (count - 1 - i) * period));
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

// Execute the actual loop's maintenance prefix without importing/starting the bot.
// Position before all awaited work and early returns is part of the regression.
function productionMaintenance(): (sources: Record<string, LiveCandleSource>) => void {
  const filename = path.resolve(__dirname, "../src/bot/index.ts");
  const tree = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
  const candidates: ts.Statement[][] = [];
  function visit(node: ts.Node): void {
    if (ts.isWhileStatement(node) && ts.isBlock(node.statement)) {
      for (const statement of node.statement.statements) {
        if (!ts.isTryStatement(statement)) continue;
        const statements = [...statement.tryBlock.statements];
        const i = statements.findIndex(s => ts.isForOfStatement(s)
          && s.expression.getText(tree) === "Object.values(candleSources)"
          && s.statement.getText(tree) === "source.prefetch();");
        if (i < 0) continue;
        assert.equal(i, 3, "maintenance immediately follows the cycle heartbeat, before price/ownership/exit/pause/cooldown work");
        candidates.push(statements.slice(0, i + 1));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.equal(candidates.length, 1);
  const prefix = candidates[0].map(s => s.getText(tree)).join("\n");
  assert(!/\bawait\b|\bcontinue\b|\breturn\b/.test(prefix), "maintenance must not await or bypass exits");
  const code = ts.transpileModule(prefix, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function("candleSources", `let cycleCount = 0; let lastMainLoopCycleAt = 0; ${code}`) as (sources: Record<string, LiveCandleSource>) => void;
}

function candleAlert(sources: Record<string, LiveCandleSource>, now: number) {
  const runtime: RuntimeHealthSnapshotV1 = {
    version: 1, symbol: "HYPEUSDT", processStartedAt: now - DAY, writtenAt: now, mode: "LIVE",
    mainLoop: { lastCycleAt: now, cycleCount: 100 },
    websocket: { connected: true, lastPriceAt: now, ageMs: 0, stale: false },
    context: { healthy: true, horizonDays: 14, expectedBars: 4032, actualContinuousBars: 4032,
      earliestContinuousTs: now - 14 * DAY, latestClosedTs: now - 300_000 },
    reconciliation: { lastAttemptAt: now, lastSuccessAt: now, status: "synced", synced: true,
      exchangeFlat: true, localLongQty: 0, exchangeLongQty: 0, absDiff: 0, tolerance: 0.005 },
    transaction: { pending: false }, recovery: { active: false, ownerOrderLinkId: null },
    desiredLongTp: { present: false }, positions: { rungs: 0, localLongQty: 0 },
    candles: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, source.health(now)])),
  };
  return evaluateOperationalHealth({ now, watchdogStartedAt: now - DAY, runtime, runtimeFileAgeMs: 0,
    collectorHealthAgeMs: 0, sourceGroups: [], inputErrorAgeMs: null })
    .find(row => row.key === "candle_inputs_unavailable");
}

async function main() {
  const realNow = Date.now;
  let now = Date.parse("2026-09-17T08:03:10Z");
  Date.now = () => now;
  try {
    const maintain = productionMaintenance();
    const calls = { hype4h: 0, btc1h: 0, hype1h: 0, hype1d: 0 };
    const sources = {
      hype4h: new LiveCandleSource(async () => { calls.hype4h++; return rawRows(now, 4 * HOUR, 250); }, 4 * HOUR, 201),
      btc1h: new LiveCandleSource(async () => { calls.btc1h++; return rawRows(now); }, HOUR, 2),
      hype1h: new LiveCandleSource(async () => { calls.hype1h++; return rawRows(now, HOUR, 30); }, HOUR, 15),
      hype1d: new LiveCandleSource(async () => { calls.hype1d++; return rawRows(now, DAY); }, DAY, 2, 2_000, 0, HOUR),
    };
    // Reproduce the cooldown: no entry get() calls from 08:03 until 16:00.
    for (; now <= Date.parse("2026-09-17T16:00:10Z"); now += 10_000) {
      assert.equal(maintain(sources), undefined, "maintenance is fire-and-forget");
      await settle();
      for (const source of Object.values(sources)) assert(source.health().healthy);
      assert(!candleAlert(sources, now), "healthy cooldown never raises the stale-cache warning");
    }
    assert.deepEqual(calls, { hype4h: 3, btc1h: 9, hype1h: 9, hype1d: 8 }, "no per-tick REST polling; daily TTL retained");
    const before = { ...calls };
    await Promise.all(Object.values(sources).map(source => source.get()));
    assert.deepEqual(calls, before, "entry consumes the same maintained cache");

    // A longer manual pause also keeps daily candles current at UTC rollover.
    now = Date.parse("2026-09-18T00:00:00Z");
    maintain(sources); await settle();
    assert.equal(sources.hype1d.health().latestClosedTs, Date.parse("2026-09-17T00:00:00Z"));
    assert.equal(sources.btc1h.health().latestClosedTs, Date.parse("2026-09-17T22:00:00Z"));
    now += 9_999;
    maintain(sources); await settle();
    assert.equal(sources.btc1h.health().latestClosedTs, Date.parse("2026-09-17T22:00:00Z"));
    now += 1;
    maintain(sources); await settle();
    assert.equal(sources.btc1h.health().latestClosedTs, Date.parse("2026-09-17T23:00:00Z"));

    // Real failures are not hidden; backoff and watchdog escalation still apply.
    now = Date.parse("2026-09-17T08:00:10Z");
    let failed = false, attempts = 0;
    const failing = new LiveCandleSource(async () => {
      attempts++;
      if (failed) throw new Error("rate limited");
      return rawRows(now);
    }, HOUR, 2);
    maintain({ btc1h: failing }); await settle();
    failed = true;
    now += HOUR;
    maintain({ btc1h: failing }); await settle();
    assert.equal(attempts, 2);
    assert(!failing.health().healthy);
    assert.equal(failing.refresh.lastError, "rate limited");
    now += 9_999;
    for (let i = 0; i < 100; i++) maintain({ btc1h: failing });
    await assert.rejects(failing.get(), /latest finalized.*rate limited/);
    assert.equal(attempts, 2, "foreground and background share retry backoff");
    now += 1;
    maintain({ btc1h: failing }); await settle();
    assert.equal(attempts, 3);
    now += 180_001;
    maintain({ btc1h: failing }); await settle();
    assert.equal(candleAlert({ btc1h: failing }, now)?.severity, "warning");
    failed = false;
    now += 10_000;
    maintain({ btc1h: failing }); await settle();
    assert(failing.health().healthy);
    assert(!candleAlert({ btc1h: failing }, now));

    // Foreground readers join a background request; no competing fetch/cache.
    let deliver!: (rows: ReturnType<typeof candle>[]) => void;
    attempts = 0;
    const joined = new LiveCandleSource(() => {
      attempts++;
      return new Promise(resolve => { deliver = resolve; });
    }, HOUR, 2);
    maintain({ hype1h: joined });
    const foreground = joined.get();
    for (let i = 0; i < 100; i++) maintain({ hype1h: joined });
    await settle();
    assert.equal(attempts, 1);
    deliver(rawRows(now));
    assert.equal((await foreground).at(-1)?.timestamp, joined.health().requiredClosedTs);
    await settle();

    // Timeout doesn't block the loop, relinquish ownership, or create new waiters.
    attempts = 0;
    const hung = new LiveCandleSource(() => {
      attempts++;
      return new Promise(resolve => { deliver = resolve; });
    }, HOUR, 2, 15);
    let getCalls = 0;
    const originalGet = hung.get.bind(hung);
    hung.get = () => { getCalls++; return originalGet(); };
    maintain({ hype1h: hung });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.match(hung.refresh.lastError ?? "", /timeout/);
    now += 200_000;
    for (let i = 0; i < 100; i++) maintain({ hype1h: hung });
    assert(hung.refresh.pending);
    assert.equal(attempts, 1);
    assert.equal(getCalls, 1, "no background waiters accumulate while the original request is hung");
    assert(candleAlert({ hype1h: hung }, now));
    deliver(rawRows(now)); await settle();
    assert(hung.health().healthy, "same-hour late valid response is accepted");
    assert(!candleAlert({ hype1h: hung }, now));

    // Background responses cannot promote rows which closed after request start.
    now = Date.parse("2026-09-17T08:59:59Z");
    const crossing = new LiveCandleSource(() => new Promise(resolve => { deliver = resolve; }), HOUR, 2);
    maintain({ btc1h: crossing }); await settle();
    now = Date.parse("2026-09-17T09:00:10Z");
    deliver(rawRows(now)); await settle();
    assert(!crossing.health().healthy);
    assert.equal(crossing.health().latestClosedTs, Date.parse("2026-09-17T07:00:00Z"));

    // Missing rows/invalid OHLC remain fail-closed through the background path.
    const gap = new LiveCandleSource(async () => {
      const rows = rawRows(now); rows.splice(1, 1); return rows;
    }, HOUR, 2);
    const invalid = new LiveCandleSource(async () => [{ ...rawRows(now)[0], close: 0 }], HOUR, 2);
    maintain({ gap, invalid }); await settle();
    await assert.rejects(gap.get(), /candle history gap/);
    await assert.rejects(invalid.get(), /invalid candle OHLC/);
    console.log("live candle maintenance tests passed (production loop wiring, cooldown/pause, cadence, failures, ownership and causal finalization)");
  } finally { Date.now = realNow; }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
