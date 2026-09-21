import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { loadCandles1m, type Candle } from "./hype-freerun-canonical-replay";
import { MINUTE as M, REPAIR_PURPOSE, candleRequestUrl, sha256, missingMinutes, applyCandleRepair, validateCandleRepair, type CandleRepairBundle, type CandleResponse } from "./replay-candle-repair";
import { ReplaySrContext } from "./replay-sr-context";
import { DEFAULT_SR_MEMORY_ZONE_CONFIG } from "../src/bot/sr-memory-zones";

const T = Date.UTC(2026, 3, 20, 16, 20), fetched = Date.UTC(2026, 8, 5), symbol = "HYPEUSDT";
const all: Candle[] = Array.from({ length: 7 }, (_, i) => ({ ts: T + (i - 1) * M, endTs: T + i * M, open: 100, high: 102, low: 99, close: 101, volume: 10, turnover: 1000 }));
const target = T + 2 * M, base = all.filter(c => c.ts !== target);
function response(interval: "1" | "5", start: number, end: number, rows: Candle[]): CandleResponse {
  const body = JSON.stringify({ retCode: 0, result: { symbol, category: "linear", list: [...rows].reverse().map(c => [c.ts, c.open, c.high, c.low, c.close, c.volume, c.turnover].map(String)) } });
  return { url: candleRequestUrl(symbol, interval, start, end), body, sha256: sha256(body), requestedAt: fetched, receivedAt: fetched + 5 };
}
const bundle: CandleRepairBundle = { version: 1, purpose: REPAIR_PURPOSE, symbol, category: "linear", intervalMs: 60000, cutoff: T + 6 * M, retrievedAt: fetched + 10,
  originalInputs: [`data/${symbol}_1_full.json`, `data/${symbol}_1m.jsonl`].map(file => ({ file, bytes: 1, sha256: "0".repeat(64) })), generatorSha256: "fixture", evidence: [{ missingTs: target,
    minute: response("1", T - M, T + 6 * M - 1, all),
    fiveMinute: response("5", T, T + 5 * M - 1, [{ ...all[1], endTs: T + 5 * M, volume: 50, turnover: 5000 }]),
  }] };
const clone = structuredClone(base), merged = applyCandleRepair(base, bundle, symbol, T + 6 * M);
assert.deepEqual(merged, all); assert.deepEqual(base, clone, "never mutate the raw input array");
assert.deepEqual(missingMinutes(base), [target]); assert.deepEqual(missingMinutes(merged), []);
assert.equal(validateCandleRepair(bundle, base, symbol, T + 6 * M).neighboursChecked, 6);
assert.equal(validateCandleRepair(bundle, base, symbol, T + 6 * M).native5mChecks, 1);
const prefix = base.filter(c => c.endTs <= target);
assert.deepEqual(applyCandleRepair(prefix, bundle, symbol, target), prefix, "future repaired bar never enters a prior prefix");
assert.deepEqual(applyCandleRepair(base.filter(c => c.endTs <= target + M), bundle, symbol, target + M), all.filter(c => c.endTs <= target + M), "repair becomes available exactly at candle close even when it is the last minute of the requested prefix");
assert.throws(() => applyCandleRepair(merged, bundle, symbol, T + 6 * M), /overwrite/);
assert.throws(() => applyCandleRepair(base, bundle, "BTCUSDT", T + 6 * M), /identity/);
assert.throws(() => applyCandleRepair(base, { ...bundle, purpose: "recorded_live" as any }, symbol, T + 6 * M), /identity/);
assert.throws(() => applyCandleRepair(base, { ...bundle, originalInputs: [] }, symbol, T + 6 * M), /fingerprints/);
assert.throws(() => applyCandleRepair(base, { ...bundle, evidence: [bundle.evidence[0], bundle.evidence[0]] }, symbol, T + 6 * M), /duplicate/);
const corrupt = structuredClone(bundle); corrupt.evidence[0].minute.body += " ";
assert.throws(() => applyCandleRepair(base, corrupt, symbol, T + 6 * M), /hash mismatch/);
const neighbor = structuredClone(base); neighbor[0].close += .1;
assert.throws(() => applyCandleRepair(neighbor, bundle, symbol, T + 6 * M), /neighbour mismatch/);
const badAggregate = structuredClone(bundle), body = JSON.parse(badAggregate.evidence[0].fiveMinute.body);
body.result.list[0][5] = "51";
badAggregate.evidence[0].fiveMinute.body = JSON.stringify(body);
badAggregate.evidence[0].fiveMinute.sha256 = sha256(badAggregate.evidence[0].fiveMinute.body);
assert.throws(() => applyCandleRepair(base, badAggregate, symbol, T + 6 * M), /aggregate mismatch/);
const wrongWindow = structuredClone(bundle); wrongWindow.evidence[0].minute.url += "&spot=true";
assert.throws(() => applyCandleRepair(base, wrongWindow, symbol, T + 6 * M), /URL/);
const truncated = structuredClone(bundle), incomplete = JSON.parse(truncated.evidence[0].minute.body);
incomplete.result.list = incomplete.result.list.filter((r: string[]) => Number(r[0]) !== T);
truncated.evidence[0].minute.body = JSON.stringify(incomplete); truncated.evidence[0].minute.sha256 = sha256(truncated.evidence[0].minute.body);
assert.throws(() => applyCandleRepair(base, truncated, symbol, T + 6 * M), /complete five-minute/);

// Repair the missing minute, not the coverage rule: the live 14-day horizon
// stays at 4,032 complete bars and cannot use the current unclosed 5m candle.
const history = Array.from({ length: 14 * 1440 + 6 }, (_, i) => ({ ...all[0], ts: T + (i - 14 * 1440) * M, endTs: T + (i - 14 * 1440 + 1) * M }));
const gapped = history.filter(c => c.ts !== target), cfg = { ...DEFAULT_SR_MEMORY_ZONE_CONFIG, enabled: true };
const rawSr = new ReplaySrContext(gapped, cfg), repairedSr = new ReplaySrContext(applyCandleRepair(gapped, bundle, symbol, T + 6 * M), cfg);
assert.deepEqual(repairedSr.at(T + 4 * M).coverage, rawSr.at(T + 4 * M).coverage);
assert.equal(rawSr.at(T + 5 * M).coverage.healthy, false);
const restoredCoverage = repairedSr.at(T + 5 * M).coverage;
assert.equal(restoredCoverage.expectedBars, 4032); assert.equal(restoredCoverage.actualContinuousBars, 4032); assert.equal(restoredCoverage.healthy, true);

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "candle-repair-test-"));
  try {
    const rawFile = path.join(dir, `${symbol}_1_full.json`), repairFile = path.join(dir, "repair.json");
    fs.writeFileSync(rawFile, JSON.stringify(base)); fs.writeFileSync(repairFile, JSON.stringify(bundle));
    const originalHash = sha256(fs.readFileSync(rawFile));
    assert.deepEqual(await loadCandles1m(symbol, dir, T + 6 * M), base, "repair is opt-in, never implicit");
    assert.deepEqual(await loadCandles1m(symbol, dir, T + 6 * M, repairFile), all);
    assert.deepEqual(await loadCandles1m(symbol, dir, target, repairFile), all.filter(c => c.endTs <= target));
    assert.deepEqual(await loadCandles1m(symbol, dir, target + M, repairFile), all.filter(c => c.endTs <= target + M));
    assert.equal(sha256(fs.readFileSync(rawFile)), originalHash);
  } finally { for (const file of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, file)); fs.rmdirSync(dir); }
  console.log("candle repair tests passed: witnesses, aggregate/neighbor validation, opt-in merge, prefixes, duplicate/conflict rejection and raw immutability");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
