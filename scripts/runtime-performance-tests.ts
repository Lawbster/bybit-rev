import assert from "assert";
import { RuntimePerformance } from "../src/bot/runtime-performance";
import { LongSideGuard } from "../src/bot/long-side-guard";

async function main() {
  const stats = new RuntimePerformance();
  stats.start();
  try {
    stats.beginCycle(); stats.finishCycle();
    const work = stats.snapshot()!.timings.cycleWork;
    await new Promise(resolve => setTimeout(resolve, 30));
    stats.finishCycle();
    assert.equal(stats.snapshot()!.timings.cycleWork.calls, 1);
    assert.equal(stats.snapshot()!.timings.cycleWork.totalMs, work.totalMs, "sleep excluded");
    assert.equal(await stats.measure("ok", async () => 123), 123);
    const error = new Error("original");
    await assert.rejects(stats.measure("bad", async () => { throw error; }), e => e === error);
    assert.equal(stats.snapshot()!.timings.bad.errors, 1);
    for (let i = 0; i < 100; i++) { stats.record(`metric${i}`, 1, false); stats.count(`counter${i}`, 1); }
    assert(Object.keys(stats.snapshot()!.timings).length <= 32);
    assert(Object.keys(stats.snapshot()!.counters).length <= 32);
    const memory = process.memoryUsage;
    try {
      process.memoryUsage = (() => { throw new Error("sample failed"); }) as any;
      assert.equal(stats.snapshot(), undefined);
    } finally { process.memoryUsage = memory; }
    const realNow = Date.now;
    try { Date.now = () => realNow() + 61_000; assert(stats.snapshot()!.eventLoopDelay); }
    finally { Date.now = realNow; }
    const guard = new LongSideGuard();
    assert.equal(guard.ageMs, null);
    await guard.tryRun("test", async () => { assert.equal(guard.label, "test"); assert(guard.ageMs! >= 0); });
    assert.equal(guard.ageMs, null);
  } finally { stats.stop(); }
  console.log("runtime performance tests passed");
}
main().catch(err => { console.error(err); process.exitCode = 1; });
