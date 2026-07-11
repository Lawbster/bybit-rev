import assert from "assert";
import { LongSideGuard } from "../src/bot/long-side-guard";

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testRejectsConcurrentRun(): Promise<void> {
  const guard = new LongSideGuard();
  let release!: () => void;
  const first = guard.tryRun("first", async () => {
    await new Promise<void>(resolve => { release = resolve; });
    return 1;
  });

  await sleep(0);
  assert.equal(guard.isBusy, true);
  assert.equal(guard.label, "first");

  const second = await guard.tryRun("second", async () => 2);
  assert.equal(second.acquired, false);
  if (!second.acquired) assert.equal(second.activeLabel, "first");

  release();
  const firstResult = await first;
  assert.equal(firstResult.acquired, true);
  if (firstResult.acquired) assert.equal(firstResult.value, 1);
  assert.equal(guard.isBusy, false);
}

async function testReleasesAfterError(): Promise<void> {
  const guard = new LongSideGuard();
  await assert.rejects(
    () => guard.tryRun("throws", async () => {
      throw new Error("boom");
    }),
    /boom/,
  );
  assert.equal(guard.isBusy, false);

  const next = await guard.tryRun("next", async () => 3);
  assert.equal(next.acquired, true);
  if (next.acquired) assert.equal(next.value, 3);
}

async function main(): Promise<void> {
  await testRejectsConcurrentRun();
  await testReleasesAfterError();
  console.log("long-side guard tests passed");
}

void main();
