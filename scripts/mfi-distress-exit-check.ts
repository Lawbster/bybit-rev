/** Re-read raw candles and saved ledgers; no strategy engine invocation. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, fileHash, lines, prices } from "./hype-failed-recovery-study";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import { auditDistress } from "./mfi-distress-exit-audit";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
async function main() {
  const out = path.resolve(process.argv[2] ?? "backtests/hype/hype-mfi-distress-exit-2026-09-09"), manifest = read(`${out}/manifest.json`), spec = manifest.spec;
  assert(read(`${out}/validation.json`).passed); assert(read(`${out}/baseline-parity.json`).passed);
  for (const p of manifest.pins) assert.equal(await fileHash(p.file), p.sha256, p.file);
  const rows = read(`${out}/results.json`); assert.equal(rows.length, 44);
  const cs = await prices(Date.parse(spec.cutoff), read(`${spec.archive}/manifest.json`).spec.repairFile);
  let fills = 0, marks = 0, mfiChecks = 0, experimentalFills = 0;
  const trace: any[] = [], artifacts: any[] = [];
  for (const r of rows) {
    const ledger = `${out}/${r.name}-inventory.jsonl`, obsFile = `${out}/${r.name}-observations.json`, events: ResearchInventoryEvent[] = [];
    await lines(ledger, e => events.push(e as ResearchInventoryEvent)); const obs = read(obsFile);
    const accounting = auditComponentAccounting(cs, events, r.metrics, r.startIdx, r.endIdx, spec.initialEquity, spec.feeRate,
      { fraction: r.policy.fraction, fillDelayMs: r.sensitivity.fillDelayMs }); assert.deepEqual(accounting, r.accounting);
    const audit = auditDistress(cs, events, obs, r.policy, Date.parse(r.end), r.sensitivity.sourceLagMs, r.sensitivity.fillDelayMs); assert.deepEqual(audit, r.audit);
    const b = rows.find((b: any) => b.model === r.model && b.policy.id === "baseline"); componentAttribution(r.metrics, b.metrics);
    for (const e of events.filter(e => e.event.reason.startsWith("research_exit:"))) {
      const decision = obs.find((o: any) => o.at === e.event.decisionAt && o.episode === e.episode);
      trace.push({ model: r.model, policy: r.policy.id, sensitivity: r.sensitivity.id, event: e.event, decision,
        fillBar: cs[e.event.fillIndex!], beforeQty: e.before.reduce((n, p) => n + p.qty, 0), afterQty: e.after.reduce((n, p) => n + p.qty, 0), lastAddTime: e.lastAddTime });
    }
    fills += events.length; marks += accounting.independentMinutes; mfiChecks += audit.checkedMfi; experimentalFills += audit.executed;
    for (const file of [ledger, obsFile, `${out}/${r.name}-summary.json`]) artifacts.push({ file: path.basename(file), sha256: await fileHash(file) });
    console.log(`[F02 checked] ${r.name}`);
  }
  for (const p of manifest.pins) assert.equal(await fileHash(p.file), p.sha256, p.file);
  for (const file of ["results.json", "comparisons.json", "ranking.json", "overview.csv", "monthly.csv", "manifest.json", "validation.json", "baseline-parity.json"])
    artifacts.push({ file, sha256: await fileHash(`${out}/${file}`) });
  fs.writeFileSync(`${out}/execution-traces.json`, JSON.stringify(trace, null, 2) + "\n");
  fs.writeFileSync(`${out}/verification.json`, JSON.stringify({ passed: true, at: new Date().toISOString(), cases: rows.length, controlsExact: 4,
    fills, independentMinuteMarks: marks, rawMfiChecks: mfiChecks, experimentalFills, artifacts, sourceHashesMatch: true, liveChanges: 0,
    checkerSha256: await fileHash(__filename), boundary: "Independent ledger/price/MFI checks re-run from separately loaded raw candles; not independent strategy implementation, maker fill, funding settlement or liquidation certification." }, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, cases: rows.length, fills, independentMinuteMarks: marks, rawMfiChecks: mfiChecks, experimentalFills }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
