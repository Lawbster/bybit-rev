import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { AddRetryBackoff, RuntimePositionCap, validPositionCapOverride } from "../src/bot/entry-availability";
import { loadRuntimePositionCap } from "../src/bot/bot-config";

const messages: string[] = [], cap = new RuntimePositionCap(11, m => messages.push(m));
const bad = () => { throw new Error("invalid JSON"); };
assert.equal(cap.refresh(bad, 0), 11);
assert.equal(cap.refresh(bad, 10_000), 11);
assert.equal(messages.length, 1);
assert.equal(cap.refresh(bad, 300_000), 11);
assert.equal(messages.length, 2);
assert.equal(cap.refresh(() => ({ maxPositions: 9 }), 310_000), 9);
assert.equal(cap.refresh(bad, 320_000), 9);
for (const value of [0, -1, 1.5, NaN, Infinity, "25", null]) {
  assert.equal(cap.refresh(() => ({ maxPositions: value as number }), 330_000), 9);
}
assert(validPositionCapOverride({ symbol: "HYPEUSDT", maxPositions: 15, oneShot: true }, "HYPEUSDT"));
assert(validPositionCapOverride({ symbol: "HYPEUSDT", maxPositions: 15, oneShot: false }, "HYPEUSDT"));
for (const value of [null, [], {}, { symbol: "SUIUSDT", maxPositions: 15, oneShot: true },
  { symbol: "HYPEUSDT", maxPositions: "15", oneShot: true },
  { symbol: "HYPEUSDT", maxPositions: 15 }, { symbol: "HYPEUSDT", maxPositions: 26, oneShot: true }]) {
  assert(!validPositionCapOverride(value, "HYPEUSDT"));
}
const backoff = new AddRetryBackoff();
assert(!backoff.recordFailure("network error", 10));
assert(!backoff.recordFailure(undefined, 10));
assert(backoff.recordFailure("position limit", 100));
assert(backoff.blocked(300_099));
assert(!backoff.blocked(300_100));
assert(backoff.recordFailure("leverage invalid", 200));
assert.equal(backoff.until, 300_200);
const throwingWarning = new RuntimePositionCap(11, () => { throw new Error("log unavailable"); });
assert.equal(throwingWarning.refresh(bad, 0), 11, "warning failure must remain non-fatal");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-cap-"));
const file = path.join(dir, "config.json");
try {
  const diskCap = new RuntimePositionCap(9, () => {});
  const reload = () => loadRuntimePositionCap(file);
  assert.throws(reload, /ENOENT/, "missing files must not import startup defaults");
  assert.equal(diskCap.refresh(reload, 0), 9);
  for (const body of ["{", "null", "[]", "{}", '{"maxPositions":"11"}', '{"maxPositions":0}',
    '{"maxPositions":11,"aggressive10":{"enabled":"true"}}']) {
    fs.writeFileSync(file, body);
    assert.throws(reload);
    assert.equal(diskCap.refresh(reload, 0), 9);
    assert.equal(fs.readFileSync(file, "utf8"), body);
  }
  fs.writeFileSync(file, '{"maxPositions":12}');
  assert.equal(diskCap.refresh(reload, 1), 12);
  fs.unlinkSync(file);
  assert.equal(diskCap.refresh(reload, 2), 12);
} finally {
  if (fs.existsSync(file)) fs.unlinkSync(file);
  fs.rmdirSync(dir);
}
console.log("entry availability tests passed");
