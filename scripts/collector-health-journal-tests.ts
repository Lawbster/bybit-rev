import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { publishCollectorHealth, collectorHealthHistoryFiles, writeCollectorSnapshot } from "../src/collector-health-journal";
import { readCollectorHealth, OperationalWatchdog } from "../src/bot/operational-watchdog";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "collector-health-tests-"));
const dir = path.join(root, "data"); fs.mkdirSync(dir);
const now = Date.now(), journal = path.join(dir, "collector_health.jsonl"), snapshot = path.join(dir, "collector_health.json");
const row = (timestamp: number) => ({ timestamp, perSymbol: [{ symbol: "HYPEUSDT", streams: {} }] });
const old = JSON.stringify(row(now - 600_000)) + '\n{"torn":';
fs.writeFileSync(journal, old);
const result = publishCollectorHealth(dir, row(now), 1);
assert(result.archive);
assert.deepEqual(result.errors, []);
assert.equal(fs.readFileSync(result.archive, "utf8"), old, "archived bytes and clocks exactly preserved");
assert.equal(readCollectorHealth(dir, now).timestamp, now);
assert.equal(collectorHealthHistoryFiles(dir).length, 2);

// A fresh file mtime is NOT fresh collector health. Prefer a newer valid journal.
writeCollectorSnapshot(snapshot, row(now - 600_000));
assert.equal(readCollectorHealth(dir, now).timestamp, now);
fs.writeFileSync(journal, JSON.stringify(row(now - 600_000)) + "\n");
const watchdog = new OperationalWatchdog("HYPEUSDT", root, now - 1000);
assert.equal(watchdog.collectInputs(now).collectorHealthAgeMs, 600_000);
fs.writeFileSync(snapshot, '{"timestamp":');
assert.equal(readCollectorHealth(dir, now).timestamp, now - 600_000);
writeCollectorSnapshot(snapshot, row(now + 600_000));
assert.equal(readCollectorHealth(dir, now).timestamp, now - 600_000, "future snapshots cannot mask a dead collector");

// Real process termination after rename but BEFORE appending the new journal.
const crashRoot = path.join(root, "crash"); fs.mkdirSync(crashRoot);
const crashJournal = path.join(crashRoot, "collector_health.jsonl");
fs.writeFileSync(crashJournal, old);
const code = `const fs = require('fs');
  const { publishCollectorHealth } = require(${JSON.stringify(path.resolve("src/collector-health-journal.ts"))});
  const rename = fs.renameSync;
  fs.renameSync = function(from, to) { rename(from, to); if (from === ${JSON.stringify(crashJournal)}) process.exit(74); };
  publishCollectorHealth(${JSON.stringify(crashRoot)}, ${JSON.stringify(row(now))}, 1);`;
const crash = spawnSync(process.execPath, ["-r", "ts-node/register/transpile-only", "-e", code], {
  cwd: process.cwd(), encoding: "utf8", timeout: 10000,
});
assert.ifError(crash.error); assert.equal(crash.status, 74, crash.stderr);
assert(!fs.existsSync(crashJournal));
assert.equal(readCollectorHealth(crashRoot, now).timestamp, now, "snapshot survives rename crash");
const crashArchive = collectorHealthHistoryFiles(crashRoot);
assert.equal(crashArchive.length, 1);
assert.equal(fs.readFileSync(crashArchive[0], "utf8"), old);
publishCollectorHealth(crashRoot, row(now + 1), 1);
assert.equal(readCollectorHealth(crashRoot, now + 1).timestamp, now + 1);
const firstArchiveBytes = fs.readFileSync(crashArchive[0]);
publishCollectorHealth(crashRoot, row(now + 2), 1);
assert.equal(collectorHealthHistoryFiles(crashRoot).length, 3);
assert.deepEqual(fs.readFileSync(crashArchive[0]), firstArchiveBytes, "repeat rotation never overwrites earlier archives");

// Disk failure on snapshot: do not rotate; keep appending original journal.
const failureDir = path.join(root, "failure"); fs.mkdirSync(failureDir);
fs.mkdirSync(path.join(failureDir, "collector_health.json")); // cannot rename file onto directory
const failureJournal = path.join(failureDir, "collector_health.jsonl");
fs.writeFileSync(failureJournal, old);
const failure = publishCollectorHealth(failureDir, row(now), 1);
assert.equal(failure.archive, null); assert.equal(failure.errors.length, 1);
assert(fs.readFileSync(failureJournal, "utf8").startsWith(old + "\n"));
assert.equal(readCollectorHealth(failureDir, now).timestamp, now);
assert.equal(collectorHealthHistoryFiles(failureDir).length, 1);

// No snapshot on legacy deployment: original journal still works.
const legacy = path.join(root, "legacy"); fs.mkdirSync(legacy);
fs.writeFileSync(path.join(legacy, "collector_health.jsonl"), JSON.stringify(row(now)) + "\n");
assert.equal(readCollectorHealth(legacy, now).timestamp, now);
fs.writeFileSync(path.join(legacy, "collector_health.jsonl"), '{}\n');
assert.throws(() => readCollectorHealth(legacy, now), /no valid/);
assert.equal(new OperationalWatchdog("HYPEUSDT", path.join(root, "missing"), now).collectInputs(now).collectorHealthAgeMs, null);

const sync = fs.readFileSync("scripts/pull-vps-data.sh", "utf8");
const smallPass = sync.slice(sync.indexOf("rsync \"${rsync_arguments[@]}\" --ignore-times"), sync.indexOf("[3/5]"));
assert(smallPass.includes("--include='collector_health.json'"));
assert(smallPass.includes("--include='collector_candle_repair_health.json'"));
console.log("collector health journal tests passed (real rename-crash, snapshots, legacy fallback, byte preservation, stale/future rejection)");
