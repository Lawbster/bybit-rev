/** Local, public Bybit GETs only. Writes a new evidence bundle; never modifies raw pulls. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { loadCandles1m } from "./hype-freerun-canonical-replay";
import { MINUTE, REPAIR_PURPOSE, candleRequestUrl, sha256, missingMinutes, validateCandleRepair, applyCandleRepair, type CandleRepairBundle, type CandleResponse } from "./replay-candle-repair";

async function fileHash(file: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function request(url: string): Promise<CandleResponse> {
  const requestedAt = Date.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = await response.text(), receivedAt = Date.now();
  if (!response.ok) throw new Error(`Public candle request HTTP ${response.status}`);
  return { url, requestedAt, receivedAt, body, sha256: sha256(body) };
}
async function main() {
  const symbol = "HYPEUSDT", cutoff = Date.parse("2026-09-04T19:01:00Z"), root = path.resolve(__dirname, "..");
  const out = path.resolve(root, process.env.CANDLE_REPAIR_OUT ?? "backtests/hype/candle-repair-2026-09-05");
  const relative = path.relative(path.join(root, "backtests"), out);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || fs.existsSync(out)) throw new Error("Use a new output directory inside backtests/");
  const originalInputs = [];
  for (const file of [`data/${symbol}_1_full.json`, `data/${symbol}_1m.jsonl`]) originalInputs.push({ file, bytes: fs.statSync(path.join(root, file)).size, sha256: await fileHash(path.join(root, file)) });
  const base = await loadCandles1m(symbol, path.join(root, "data"), cutoff), missing = missingMinutes(base);
  if (!missing.length) throw new Error("No internal gaps to repair");
  const evidence: CandleRepairBundle["evidence"] = [];
  for (const missingTs of missing) {
    const start = Math.floor(missingTs / (5 * MINUTE)) * 5 * MINUTE;
    const [minute, fiveMinute] = await Promise.all([
      request(candleRequestUrl(symbol, "1", start - MINUTE, start + 6 * MINUTE - 1)),
      request(candleRequestUrl(symbol, "5", start, start + 5 * MINUTE - 1)),
    ]);
    evidence.push({ missingTs, minute, fiveMinute });
    console.log(`[recover] ${evidence.length}/${missing.length} ${new Date(missingTs).toISOString()}`);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const bundle: CandleRepairBundle = { version: 1, purpose: REPAIR_PURPOSE, symbol, category: "linear", intervalMs: 60000, cutoff, retrievedAt: Date.now(),
    originalInputs, generatorSha256: sha256(fs.readFileSync(__filename)), evidence };
  const checked = validateCandleRepair(bundle, base, symbol, cutoff), repaired = applyCandleRepair(base, bundle, symbol, cutoff);
  if (missingMinutes(repaired).length !== 0 || checked.inserts.length !== missing.length) throw new Error("Repair did not cover exactly the detected gaps");
  for (const input of originalInputs) if (await fileHash(path.join(root, input.file)) !== input.sha256) throw new Error(`Raw input changed: ${input.file}`);
  fs.mkdirSync(out, { recursive: true });
  const body = JSON.stringify(bundle, null, 2) + "\n";
  fs.writeFileSync(path.join(out, "repair.json"), body, { flag: "wx" });
  const summary = { symbol, cutoff, originalCandles: base.length, inserted: checked.inserts.length, repairedCandles: repaired.length, remainingGaps: 0,
    native5mChecks: checked.native5mChecks, neighboursChecked: checked.neighboursChecked, originalInputHashesUnchanged: true, repairSha256: sha256(body),
    missingMinutes: missing.map(ts => new Date(ts).toISOString()), historicalReceiptProven: false };
  fs.writeFileSync(path.join(out, "validation.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ output: path.join(out, "repair.json"), ...summary }, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
