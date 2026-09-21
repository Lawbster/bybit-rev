/** Accept synchronized tails only after proving they cannot revise the study window. */
import fs from "fs";
import readline from "readline";
import assert from "assert/strict";
import { verifyPins, type Plan } from "./research-workflow";
type R = Record<string, any>;
export async function acceptedSourceProof(plan: Plan) {
  const { verifyPrefixes } = await import("./aggressive10-discriminator-study");
  const root = process.cwd(), d = plan.card.definition, old = JSON.parse(fs.readFileSync(`${d.acceptedResults}/plan.json`, "utf8"));
  const state = JSON.parse(fs.readFileSync(`${d.acceptedResults}/state.json`, "utf8"));
  const verified = JSON.parse(fs.readFileSync(`${d.acceptedResults}/verification.json`, "utf8"));
  assert.equal(state.status, "complete"); assert(verified.passed);
  const prefixes: R[] = old.pins.filter((p: R) => p.file.startsWith("data/") && p.file.endsWith(".jsonl"));
  const names = new Set(prefixes.map(p => p.file));
  // Runtime state was pinned by old jobs for protection, never used for flat-start
  // economics. A later VPS sync may change it; the NEW plan protects its current hash.
  const immutable = old.pins.filter((p: R) => !names.has(p.file) && p.file !== "bot-state.json");
  await verifyPins(root, [...immutable, ...state.artifacts]);
  await verifyPrefixes(prefixes);
  const tails: R[] = [], cutoff = Date.parse(d.cutoff);
  for (const p of prefixes) {
    let rows = 0, earliest = Infinity;
    if (fs.statSync(p.file).size > p.bytes) {
      for await (const line of readline.createInterface({ input: fs.createReadStream(p.file, { start: p.bytes }), crlfDelay: Infinity })) {
        if (!line.trim()) continue;
        const r = JSON.parse(line), at = Number(r.timestamp ?? r.ts ?? r.windowEnd) + (p.file.endsWith("_1m.jsonl") ? 60000 : 0);
        assert(Number.isSafeInteger(at) && at > cutoff, `Synced tail revises frozen window: ${p.file}`);
        rows++; earliest = Math.min(earliest, at);
      }
    }
    tails.push({ file: p.file, acceptedBytes: p.bytes, extraRows: rows, firstExtraAt: rows ? earliest : null });
  }
  for (const p of immutable) assert.equal(plan.pins.find(q => q.file === p.file)?.sha256, p.sha256);
  return { passed: true, prefixCount: prefixes.length, tails, originalEconomicCutoff: d.cutoff, newHistoricalRows: 0,
    currentRuntimeStateProtectedByNewPlan: true, runtimeStateUsedForEconomics: false };
}
