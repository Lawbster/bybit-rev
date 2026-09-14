import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import { CollectorCandleRepair, availableCandleRepairs, parseRepairResponse, readCandleTail } from "../src/collector-candle-repair";
import { fetchCollectorRepair } from "../src/collector-repair-fetch";

const M = 60_000, SYMBOL = "HYPEUSDT";
let now = Date.UTC(2026, 8, 14, 12, 0, 20);
const row = (ts: number) => ({ ts, o: 100, h: 101, l: 99, c: 100.5, v: 10, t: 1000 });
const rest = (ts: number) => [ts, 100, 101, 99, 100.5, 10, 1000].map(String);
const response = (list: string[][], symbol = SYMBOL) => ({ retCode: 0, result: { category: "linear", symbol, list } });
const root = fs.mkdtempSync(path.join(os.tmpdir(), "candle-repair-tests-"));
let fixtureNumber = 0;
function fixture(missing: number[] = []) {
  const dir = path.join(root, String(++fixtureNumber)); fs.mkdirSync(dir);
  for (const interval of [1, 5]) {
    const span = interval * M, latest = Math.floor((now - 10_000) / span) * span - span;
    const rows = [];
    for (let ts = latest - 48 * 60 * M + span; ts <= latest; ts += span) if (!missing.includes(ts)) rows.push(row(ts));
    fs.writeFileSync(path.join(dir, `${SYMBOL}_${interval}m.jsonl`), rows.map(r => JSON.stringify(r)).join("\n") + "\n");
  }
  return dir;
}
const repairsFile = (dir: string, interval = 1) => path.join(dir, "candle-repairs", `${SYMBOL}_${interval}m.jsonl`);
const originalFile = (dir: string) => path.join(dir, `${SYMBOL}_1m.jsonl`);

async function main() {
  const missing = now - 20_000 - 7 * M, dir = fixture([missing]);
  const before = fs.readFileSync(originalFile(dir)); let calls = 0;
  const fetcher = async (_symbol: string, _interval: string, start: number, end: number) => {
    calls++; assert(end <= now - M); assert(start <= missing && end >= missing);
    now += 500; return response([rest(missing)]);
  };
  const repair = new CollectorCandleRepair(dir, [SYMBOL], fetcher, () => now);
  await repair.poll();
  assert.equal(calls, 1);
  assert.deepEqual(fs.readFileSync(originalFile(dir)), before, "original history is byte-for-byte untouched");
  const rows = await readCandleTail(repairsFile(dir), 0, M);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].timestamp, missing);
  assert.equal(rows[0].receivedAt, now);
  assert.equal(availableCandleRepairs(rows, SYMBOL, "1", now - 1).length, 0, "not available at old decisions");
  assert.equal(availableCandleRepairs(rows, SYMBOL, "1", now).length, 1);
  assert.equal(availableCandleRepairs(rows, "BTCUSDT", "1", now).length, 0);
  assert.equal(availableCandleRepairs(rows, SYMBOL, "5", now).length, 0);
  assert.equal(availableCandleRepairs([{ ...rows[0], availableAt: missing }], SYMBOL, "1", now).length, 0);
  assert.equal(availableCandleRepairs([{ ...rows[0], timestamp: String(missing) }], SYMBOL, "1", now).length, 0);
  const restarted = new CollectorCandleRepair(dir, [SYMBOL], fetcher, () => now);
  await restarted.poll(); assert.equal(calls, 1, "restart deduplicates published repairs");
  assert.equal(restarted.health().streams[0].remainingMissing, 0);

  const clean = new CollectorCandleRepair(fixture(), [SYMBOL], async () => { throw Error("must not fetch"); }, () => now);
  await clean.poll(); await clean.poll();
  assert(clean.health().streams.every(s => s.remainingMissing === 0));

  // Late websocket data wins; concurrent ticks cannot submit overlapping requests.
  const concurrent = fixture([missing]); let release!: (data: unknown) => void; let attempts = 0;
  const concurrentRepair = new CollectorCandleRepair(concurrent, [SYMBOL], async () => {
    attempts++; return new Promise(resolve => { release = resolve; });
  }, () => now);
  const inFlight = concurrentRepair.poll();
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  await concurrentRepair.poll(); assert.equal(attempts, 1);
  fs.appendFileSync(originalFile(concurrent), JSON.stringify(row(missing)) + "\n");
  release(response([rest(missing)])); await inFlight;
  assert(!fs.existsSync(repairsFile(concurrent)));
  assert.equal(concurrentRepair.health().streams[0].remainingMissing, 0);

  // Preserve a torn journal tail; completed records appended later remain parseable.
  const torn = fixture([missing]); fs.mkdirSync(path.dirname(repairsFile(torn)));
  fs.writeFileSync(repairsFile(torn), '{"timestamp":');
  const tornRepair = new CollectorCandleRepair(torn, [SYMBOL], fetcher, () => now);
  await tornRepair.poll();
  assert(fs.readFileSync(repairsFile(torn), "utf8").startsWith('{"timestamp":\n'));
  assert.equal((await readCandleTail(repairsFile(torn), 0, M)).length, 1);

  // A partial 5m bucket is NOT a complete candle; request native five-minute evidence.
  const partial = fixture(), fiveTs = Math.floor((now - 10_000) / (5 * M)) * 5 * M - 5 * M;
  const fiveFile = path.join(partial, `${SYMBOL}_5m.jsonl`);
  const fiveRows = fs.readFileSync(fiveFile, "utf8").trim().split("\n").map(s => JSON.parse(s));
  fiveRows.find(r => r.ts === fiveTs).n1m = 4;
  fs.writeFileSync(fiveFile, fiveRows.map(r => JSON.stringify(r)).join("\n") + "\n");
  const fiveRepair = new CollectorCandleRepair(partial, [SYMBOL], async (_s, interval) => {
    assert.equal(interval, "5"); return response([rest(fiveTs)]);
  }, () => now);
  await fiveRepair.poll(); await fiveRepair.poll();
  assert.equal((await readCandleTail(repairsFile(partial, 5), 0, 5 * M)).length, 1);
  assert.equal(JSON.parse(fs.readFileSync(fiveFile, "utf8").trim().split("\n").pop()!).n1m, 4);

  for (const invalid of [response([rest(missing)], "WRONG"), { retCode: 10006 }, response([rest(missing), rest(missing)]),
    response([rest(now - 20_000)]), response([[String(missing), "100", "90", "99", "100", "1", "100"]])]) {
    assert.throws(() => parseRepairResponse(invalid, SYMBOL, "1", missing, now, now));
  }
  const unavailable = new CollectorCandleRepair(fixture([missing]), [SYMBOL], async () => response([]), () => now);
  await unavailable.poll();
  assert.equal(unavailable.health().streams[0].remainingMissing, 1);
  assert(unavailable.health().streams[0].error?.includes("gaps remain"));
  const rejected = new CollectorCandleRepair(fixture([missing]), [SYMBOL], async () => { throw Error("rate limited"); }, () => now);
  await rejected.poll(); assert.equal(rejected.health().busy, false);
  assert.equal(rejected.health().streams[0].error, "rate limited");

  // A permanently unavailable recent candle cannot starve an older gap.
  const older = missing - 1500 * M, fair = fixture([older, missing]); let pageCalls = 0;
  const fairRepair = new CollectorCandleRepair(fair, [SYMBOL], async (_s, interval, start, end) => {
    assert.equal(interval, "1"); assert(end - start <= 999 * M); pageCalls++;
    return response(start <= older && end >= older ? [rest(older)] : []);
  }, () => now);
  await fairRepair.poll(); await fairRepair.poll();
  now += 30_000;
  await fairRepair.poll();
  assert.equal(pageCalls, 2);
  assert.equal((await readCandleTail(repairsFile(fair), 0, M))[0].timestamp, older);
  assert.equal(fairRepair.health().streams[0].remainingMissing, 1);

  // Actual process death during a journal append: restart recovers complete rows
  // and keeps the torn bytes instead of overwriting the diagnostic evidence.
  const interrupted = fixture([missing]);
  const source = `const fs = require('fs');
    const { CollectorCandleRepair } = require(${JSON.stringify(path.resolve("src/collector-candle-repair.ts"))});
    const write = fs.writeSync;
    fs.writeSync = function(fd, value, ...args) {
      if (Buffer.isBuffer(value) && value.toString().includes('rest_gap_repair')) {
        write(fd, value.subarray(0, 30)); process.exit(75);
      }
      return write(fd, value, ...args);
    };
    new CollectorCandleRepair(${JSON.stringify(interrupted)}, ['HYPEUSDT'], async () => (${JSON.stringify(response([rest(missing)]))}),
      () => ${now}).poll();`;
  const { spawnSync } = await import("child_process");
  const killed = spawnSync(process.execPath, ["-r", "ts-node/register/transpile-only", "-e", source], {
    cwd: process.cwd(), encoding: "utf8", timeout: 10_000,
  });
  assert.ifError(killed.error); assert.equal(killed.status, 75, killed.stderr);
  const tornBytes = fs.readFileSync(repairsFile(interrupted));
  assert.equal(tornBytes.length, 30);
  assert.equal((await readCandleTail(repairsFile(interrupted), 0, M)).length, 0);
  const resumed = new CollectorCandleRepair(interrupted, [SYMBOL], fetcher, () => now);
  await resumed.poll();
  assert(fs.readFileSync(repairsFile(interrupted)).subarray(0, 30).equals(tornBytes));
  assert.equal((await readCandleTail(repairsFile(interrupted), 0, M)).length, 1);

  // Real HTTP transport on loopback only: stalled body is bounded, not just headers.
  const server = http.createServer((req, res) => {
    if (req.url === "/no-headers") return;
    if (req.url === "/stall") { res.writeHead(200); res.write('{'); return; }
    if (req.url === "/large") { res.end(" ".repeat(2 * 1024 * 1024 + 1)); return; }
    if (req.url === "/error") { res.writeHead(429); res.end("limited"); return; }
    res.end(JSON.stringify(response([])));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as import("net").AddressInfo).port;
  const localFetch = (route: string): typeof fetch => (async (_url, init) => fetch(`http://127.0.0.1:${port}/${route}`, init)) as typeof fetch;
  try {
    assert.deepEqual(await fetchCollectorRepair(SYMBOL, "1", missing, missing, localFetch("ok")), response([]));
    const started = Date.now();
    await assert.rejects(fetchCollectorRepair(SYMBOL, "1", missing, missing, localFetch("stall"), 100));
    assert(Date.now() - started < 2000);
    await assert.rejects(fetchCollectorRepair(SYMBOL, "1", missing, missing, localFetch("no-headers"), 100));
    await assert.rejects(fetchCollectorRepair(SYMBOL, "1", missing, missing, localFetch("large")), /2 MiB/);
    await assert.rejects(fetchCollectorRepair(SYMBOL, "1", missing, missing, localFetch("error")), /429/);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  console.log("collector candle repair tests passed (as-of timing, startup/restart, concurrency, partial/torn rows, HTTP deadlines/limits)");
}
main().catch(err => { console.error(err); process.exitCode = 1; });
