import assert from "assert";
import { BoundedRefresh } from "../src/bot/bounded-refresh";
import { LiveCandleSource } from "../src/bot/live-candle-source";
import { LiveContextManager } from "../src/bot/context-manager";
import { checkTrendGate, dropIncompleteCandle } from "../src/bot/strategy";
import { DEFAULT_BOT_CONFIG } from "../src/bot/bot-config";

const candle = (timestamp: number, close = 100) => ({ timestamp, open: close, high: close, low: close, close, volume: 1, turnover: close });
async function main() {
  const realNow = Date.now;
  let now = 1_800_000_020_000;
  Date.now = () => now;
  try {
    const p = 14_400_000, boundary = Math.floor(now / p) * p;
    const raw = Array.from({ length: 250 }, (_, i) => candle(boundary - (249 - i) * p, 100 + Math.sin(i)));
    let calls = 0, fail = false;
    const source = new LiveCandleSource(async () => { calls++; if (fail) throw new Error("rate limited"); return raw; }, p, 201, 20);
    const rows = await source.get();
    assert.deepEqual(rows, dropIncompleteCandle(raw, p));
    assert.deepEqual(checkTrendGate(rows, DEFAULT_BOT_CONFIG), checkTrendGate(raw, DEFAULT_BOT_CONFIG), "healthy-path indicators identical");
    await source.get(); assert.equal(calls, 1);
    now = boundary + p + 10_000;
    fail = true;
    await assert.rejects(source.get(), /latest finalized/);
    assert.equal(calls, 2, "old forming snapshot was not promoted on the clock");
    assert(!source.health().healthy);

    // A response begun pre-close but delivered post-close cannot finalize that candle.
    let deliver!: (rows: ReturnType<typeof candle>[]) => void;
    now = boundary + p - 1;
    const cross = new LiveCandleSource(() => new Promise(resolve => { deliver = resolve; }), p, 2, 20);
    const crossing = cross.get(); await Promise.resolve();
    now = boundary + p + 10_000;
    deliver(raw);
    await assert.rejects(crossing, /latest finalized/);

    let attempts = 0;
    const hung = new BoundedRefresh<void>(15);
    const never = () => { attempts++; return new Promise<void>(() => {}); };
    await assert.rejects(hung.run(never), /timeout/);
    now += 20;
    await assert.rejects(hung.run(never), /outstanding/);
    assert.equal(attempts, 1); assert(hung.pending);
    const rejected = new BoundedRefresh<void>(20);
    const no = () => { attempts++; return Promise.reject(new Error("rate limited")); };
    await assert.rejects(rejected.run(no), /rate limited/);
    const prior = attempts;
    await assert.rejects(rejected.run(no), /rate limited/); assert.equal(attempts, prior);

    let finish!: (rows: ReturnType<typeof candle>[]) => void;
    const late = new LiveCandleSource(() => new Promise(resolve => { finish = resolve; }), p, 2, 15);
    const waiting = late.get(); await Promise.resolve();
    await assert.rejects(waiting);
    finish([candle(boundary - p), candle(boundary)]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal((await late.get()).length, 2, "late valid result becomes usable without duplicate request");

    const manager = new LiveContextManager({ getCandles: async () => [candle(boundary)] } as any, "TEST");
    now = boundary + 1;
    await manager.refresh();
    assert.equal(manager.getCandles().length, 1, "forming consumer still sees live snapshot");
    now = boundary + 300_001;
    assert.equal(manager.getCandles().length, 0, "failed refresh must not finalize the old forming row");
    assert(!manager.getClosedCoverageStatus(now, 300_000 / 86_400_000).healthy);
    await manager.refresh();
    assert(manager.getClosedCoverageStatus(now, 300_000 / 86_400_000).healthy);
    console.log("live candle source tests passed");
  } finally { Date.now = realNow; }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
