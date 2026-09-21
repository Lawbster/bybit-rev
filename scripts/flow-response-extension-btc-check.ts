/** Verify the missing BTC minute cannot change the inherited hourly-close gate. */
import fs from "fs";
import assert from "assert/strict";
import { loadCandles1m } from "./hype-freerun-canonical-replay";
import { missingMinutes, candleRequestUrl, applyCandleRepair, REPAIR_PURPOSE, sha256, type CandleRepairBundle } from "./replay-candle-repair";
import { atomicJson, fileHash } from "./research-workflow";
async function main() {
  const cutoff = Date.parse("2026-09-14T15:27:00Z"), since = Date.parse("2026-09-10T05:08:00Z");
  const out = "backtests/hype/flow-response-extension-data-2026-09-14/btc-check.json";
  assert(!fs.existsSync(out));
  const cs = await loadCandles1m("BTCUSDT", undefined, cutoff), gaps = missingMinutes(cs.filter(c => c.endTs > since));
  assert.equal(gaps.length, 1); const ts = gaps[0], start = Math.floor(ts / 300000) * 300000;
  async function request(url: string) {
    const requestedAt = Date.now(), r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const body = await r.text(), receivedAt = Date.now(); assert(r.ok);
    return { url, requestedAt, receivedAt, body, sha256: sha256(body) };
  }
  const [minute, fiveMinute] = await Promise.all([
    request(candleRequestUrl("BTCUSDT", "1", start - 60000, start + 360000 - 1)),
    request(candleRequestUrl("BTCUSDT", "5", start, start + 300000 - 1)),
  ]);
  const originalInputs = [];
  for (const file of ["data/BTCUSDT_1_full.json", "data/BTCUSDT_1m.jsonl"]) originalInputs.push({ file, bytes: fs.statSync(file).size, sha256: await fileHash(file) });
  const bundle: CandleRepairBundle = { version: 1, purpose: REPAIR_PURPOSE, symbol: "BTCUSDT", category: "linear", intervalMs: 60000,
    cutoff, retrievedAt: Date.now(), generatorSha256: await fileHash(__filename), originalInputs, evidence: [{ missingTs: ts, minute, fiveMinute }] };
  const repaired = applyCandleRepair(cs, bundle, "BTCUSDT", cutoff);
  const hourly = (xs: typeof cs) => { const map = new Map<number, number>(); for (const c of xs) map.set(Math.floor(c.ts / 3600000), c.close); return [...map]; };
  assert.deepEqual(hourly(cs), hourly(repaired), "Hourly BTC close inputs changed");
  assert.equal(missingMinutes(repaired.filter(c => c.endTs > since)).length, 0);
  for (const p of originalInputs) assert.equal(await fileHash(p.file), p.sha256);
  atomicJson(out, { passed: true, originalMissingMinute: new Date(ts).toISOString(), hourlyClosesExactlyUnchanged: true,
    explanation: "Inherited buildRiskOffSeries consumes only consecutive completed hourly closes; gap at :44 cannot change that input. FR01 profiles do not use btcRet4h. No canonical loader modification needed.", bundle });
  console.log(`BTC hourly-close gate inputs verified unchanged: ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
