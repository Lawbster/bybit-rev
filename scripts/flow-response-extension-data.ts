/** FR01 cutoff extension: audit local coverage; optional public GET-only gap recovery.
 * Writes a separate exchange-history witness, never edits synced data/arrival times.
 */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { loadCandles1m, streamJsonl } from "./hype-freerun-canonical-replay";
import { fileHash, atomicJson } from "./research-workflow";
import { missingMinutes, readCandleRepair, applyCandleRepair, candleRequestUrl, sha256, type CandleResponse, type CandleRepairBundle } from "./replay-candle-repair";
const CUTOFF = Date.parse("2026-09-14T15:27:00Z"), OLD = Date.parse("2026-09-10T05:08:00Z");
const REPAIR = "backtests/hype/candle-repair-2026-09-05/repair.json";
const OUT = "backtests/hype/flow-response-extension-data-2026-09-14";
async function request(url: string): Promise<CandleResponse> {
  const requestedAt = Date.now(); const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const body = await res.text(), receivedAt = Date.now(); assert(res.ok, `Public GET failed ${res.status}`);
  return { url, requestedAt, receivedAt, body, sha256: sha256(body) };
}
async function main() {
  const raw = await loadCandles1m("HYPEUSDT", path.resolve("data"), CUTOFF);
  const old = readCandleRepair(REPAIR), cs = applyCandleRepair(raw, old, "HYPEUSDT", CUTOFF);
  const gaps = missingMinutes(cs), btc = await loadCandles1m("BTCUSDT", path.resolve("data"), CUTOFF);
  const newBtc = btc.filter(c => c.endTs > OLD), flow = new Set<number>();
  let duplicates = 0, explicitReceipts = 0;
  await streamJsonl("data/HYPEUSDT_taker_hyperliquid.jsonl", r => {
    const t = Number(r.windowEnd ?? r.timestamp); if (t <= OLD || t > CUTOFF) return;
    if (flow.has(t)) duplicates++; flow.add(t);
    if ([r.receivedAt, r.writtenAt, r.observedAt, r.ingestedAt].some(x => x != null)) explicitReceipts++;
  });
  const missingFlow = []; for (let t = OLD + 60000; t <= CUTOFF; t += 60000) if (!flow.has(t)) missingFlow.push(new Date(t).toISOString());
  const audit = { oldCutoff: new Date(OLD).toISOString(), cutoff: new Date(CUTOFF).toISOString(),
    hypeLast: cs.at(-1), missingHypeMinutes: gaps.map(t => new Date(t).toISOString()), btcLast: newBtc.at(-1),
    missingBtcMinutes: missingMinutes(newBtc).map(t => new Date(t).toISOString()),
    addedFlowMinutes: flow.size, duplicates, explicitReceipts, missingFlow };
  console.log(JSON.stringify(audit, null, 2));
  if (!process.argv.includes("--recover")) return;
  assert(!fs.existsSync(OUT), "Never overwrite a data witness directory");
  assert.equal(cs.at(-1)!.endTs, CUTOFF); assert.equal(btc.at(-1)!.endTs, CUTOFF);
  const originalInputs = [];
  for (const file of ["data/HYPEUSDT_1_full.json", "data/HYPEUSDT_1m.jsonl"]) originalInputs.push({ file, bytes: fs.statSync(file).size, sha256: await fileHash(file) });
  const evidence = [...old.evidence];
  for (const missingTs of gaps) {
    const start = Math.floor(missingTs / 300000) * 300000;
    const [minute, fiveMinute] = await Promise.all([
      request(candleRequestUrl("HYPEUSDT", "1", start - 60000, start + 360000 - 1)),
      request(candleRequestUrl("HYPEUSDT", "5", start, start + 300000 - 1)),
    ]);
    evidence.push({ missingTs, minute, fiveMinute });
  }
  const bundle: CandleRepairBundle = { ...old, cutoff: CUTOFF, retrievedAt: Date.now(), originalInputs,
    generatorSha256: await fileHash(__filename), evidence };
  const repaired = applyCandleRepair(raw, bundle, "HYPEUSDT", CUTOFF);
  assert.equal(missingMinutes(repaired).length, 0);
  for (const p of originalInputs) assert.equal(await fileHash(p.file), p.sha256);
  fs.mkdirSync(OUT, { recursive: true });
  atomicJson(path.join(OUT, "repair.json"), bundle);
  atomicJson(path.join(OUT, "audit.json"), { ...audit, repairedMissingMinutes: gaps.length,
    historicalReceiptProven: false, purpose: "Corrected historical OHLC, not proof of collector arrival; HL gaps remain unknown.", remainingHypeGaps: 0 });
  console.log(`Validated separate gap witness: ${OUT}/repair.json`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
