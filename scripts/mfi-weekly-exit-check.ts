/** F04 independent raw-ledger, MFI and weekly-context verification. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, fileHash, lines, prices } from "./hype-failed-recovery-study";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import { auditDistress } from "./mfi-distress-exit-audit";
import { auditWeekly } from "./mfi-weekly-exit-audit";
import { exposureDelta } from "./ladder-exposure-metrics";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
type R = Record<string, any>;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
async function main() {
  const out = path.resolve(process.argv[2] ?? "backtests/hype/hype-mfi-weekly-exit-2026-09-09"), r = (f: string) => read(path.join(out, f));
  assert(!fs.existsSync(path.join(out, "verification.json")), "Do not overwrite verification");
  const manifest = r("manifest.json"), spec = manifest.spec, validation = r("validation.json"), parity = r("control-parity.json");
  assert(validation.passed && parity.passed); assert.equal(parity.cases.length, 16);
  for (const p of validation.artifacts) assert.equal(await fileHash(path.join(out, p.file)), p.sha256, p.file);
  for (const p of [...manifest.pins, ...manifest.protectedFiles]) assert.equal(await fileHash(p.file), p.sha256, p.file);
  const old: R[] = read(`${spec.archive}/results.json`), oldVerification = read(`${spec.archive}/verification.json`);
  assert(oldVerification.passed); const cs = await prices(Date.parse(spec.cutoff), manifest.repairFile);
  const results: R[] = r("results.json"), comparisons: R[] = r("comparisons.json"); assert.equal(results.length, spec.runCount);
  let fills = 0, marks = 0, mfiChecks = 0, weeklyChecks = 0, experimentalFills = 0, controlChecks = 0;
  const traces: R[] = [], accepted: R[] = [], caseChecks: R[] = [];
  for (const x of results) {
    const events: ResearchInventoryEvent[] = []; await lines(`${out}/${x.name}-inventory.jsonl`, e => events.push(e as ResearchInventoryEvent));
    const obs = r(`${x.name}-observations.json`);
    const accounting = auditComponentAccounting(cs, events, x.metrics, x.startIdx, x.endIdx, spec.initialEquity, spec.feeRate,
      { fraction: x.policy.fraction, fillDelayMs: x.sensitivity.fillDelayMs }); assert.deepEqual(accounting, x.accounting);
    const audit = auditDistress(cs, events, obs, x.policy, Date.parse(x.end), x.sensitivity.sourceLagMs, x.sensitivity.fillDelayMs); assert.deepEqual(audit, x.audit);
    if (x.policy.weeklyRequired) for (const o of obs) {
      if (o.mfi?.value != null && o.mfi.value <= 20 && o.status !== "ordinary_exit_priority") {
        assert(o.weekly && ["scheduled", "weekly_not_weak", "weekly_unknown"].includes(o.status), "Every eligible low-MFI checkpoint must evaluate weekly context");
      }
    }
    const contextAudit = auditWeekly(cs, obs, x.policy, x.sensitivity.sourceLagMs); assert.deepEqual(contextAudit, x.contextAudit);
    if (!x.policy.weeklyRequired) {
      const expected = old.find(o => o.name === x.name); assert(expected); assert.equal(x.digest, expected.digest);
      assert.deepEqual(x.metrics, expected.metrics); assert.deepEqual(x.accounting, expected.accounting);
      const file = `${x.name}-observations.json`, pin = oldVerification.artifacts.find((p: R) => p.file === file); assert(pin);
      assert.equal(await fileHash(`${spec.archive}/${file}`), pin.sha256); assert.deepEqual(obs, read(`${spec.archive}/${file}`)); controlChecks++;
    }
    const base = results.find(b => b.model === x.model && b.policy.id === "baseline")!;
    if (x.policy.id !== "baseline") {
      const cmp = comparisons.find(c => c.name === x.name)!; assert.deepEqual(cmp.delta, exposureDelta(x.metrics, base.metrics));
      assert.deepEqual(cmp.attribution, componentAttribution(x.metrics, base.metrics));
      const original = results.find(b => b.model === x.model && b.policy.id === "mfi_half" && b.sensitivity.id === x.sensitivity.id)!;
      assert.deepEqual(cmp.versusOriginal, exposureDelta(x.metrics, original.metrics));
      assert.deepEqual(cmp.versusOriginalAttribution, componentAttribution(x.metrics, original.metrics));
      const bm = new Map(base.metrics.episodes.map((e: R) => [e.entry, e]));
      for (const m of cmp.matched) { assert.deepEqual(m.before, bm.get(m.entry)); near(m.delta, m.after.pnl - m.before.pnl); }
      near(cmp.extra5bpsDelta, x.accounting.fixedPathExtra5bpsNet - base.accounting.fixedPathExtra5bpsNet);
    }
    const entries = new Map<number, number>(); events.filter(e => e.event.kind === "open" && !e.before.length).forEach(e => entries.set(e.episode, e.event.fillAt!));
    for (const e of events.filter(e => e.event.reason.startsWith("research_exit:"))) {
      const o = obs.find((o: R) => o.episode === e.episode && o.at === e.event.decisionAt); assert(o?.status === "scheduled");
      if (x.policy.weeklyRequired) assert(o.weekly.ready && o.weekly.passes && o.weekly.availableAt <= e.event.decisionAt);
      near(e.after.reduce((n, p) => n + p.qty, 0), e.before.reduce((n, p) => n + p.qty, 0) / 2);
      assert.equal(e.event.fillIndex, e.event.decisionIndex + 1 + x.sensitivity.fillDelayMs / 60000);
      const entry = new Date(entries.get(e.episode)!).toISOString(), outcome = x.metrics.episodes.find((o: R) => o.entry === entry) ?? null;
      const before = base.metrics.episodes.find((o: R) => o.entry === entry) ?? null;
      traces.push({ name: x.name, model: x.model, policy: x.policy.id, sensitivity: x.sensitivity.id, episode: e.episode, entry,
        event: e.event, decision: o, fillBar: cs[e.event.fillIndex!], beforeQty: e.before.reduce((n, p) => n + p.qty, 0), afterQty: e.after.reduce((n, p) => n + p.qty, 0),
        lastAddTime: e.lastAddTime, baselineOutcome: before, outcome, episodeDelta: before && outcome ? outcome.pnl - before.pnl : null });
    }
    accepted.push({ name: x.name, digest: x.digest }); caseChecks.push({ name: x.name, fills: events.length, ...contextAudit });
    fills += events.length; marks += accounting.independentMinutes; mfiChecks += audit.checkedMfi; weeklyChecks += contextAudit.checked; experimentalFills += audit.executed;
    console.log(`[F04 checked] ${x.name}`);
  }
  assert.equal(controlChecks, 16);
  for (const p of r("ranking.json")) {
    const failures: string[] = [];
    for (const x of results.filter(x => x.policy.id === p.policy && x.sensitivity.id === "primary")) {
      const b = results.find(b => b.model === x.model && b.policy.id === "baseline")!;
      if (x.metrics.totalPnl - b.metrics.totalPnl < (x.window === "hl_extended" ? spec.screen.minimumRecentNetDelta : spec.screen.minimumPublishedNetDelta)) failures.push(`${x.model}:net`);
      if (x.metrics.maxDrawdownPct - b.metrics.maxDrawdownPct > spec.screen.maximumDrawdownIncreasePp + 1e-9) failures.push(`${x.model}:drawdown`);
      if (x.metrics.monthly.some((m: R) => m.mtmPnl - b.metrics.monthly.find((a: R) => a.month === m.month).mtmPnl < spec.screen.minimumMonthlyDelta)) failures.push(`${x.model}:monthly`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:insolvency`);
    } assert.deepEqual(p.failures, failures); assert.equal(p.passesEconomicScreen, !failures.length); assert.equal(p.deployable, false);
  }
  const diagnostic: R[] = read(`${spec.diagnostic}/rows.json`);
  for (const p of r("diagnostic-versus-replay.json")) {
    const eligible = diagnostic.filter(x => x.model === p.model && x.selected && x.flags.primary.C3), actual = results.find(x => x.model === p.model && x.policy.weeklyRequired && x.sensitivity.id === "primary")!;
    near(p.predictedContribution, eligible.reduce((n, x) => n + x.delta, 0)); assert.equal(p.selectedF03, eligible.length);
    near(p.actualDelta, comparisons.find(x => x.name === actual.name)!.delta.pnlDelta); near(p.difference, p.actualDelta - p.predictedContribution);
  }
  for (const p of [...manifest.pins, ...manifest.protectedFiles]) assert.equal(await fileHash(p.file), p.sha256, p.file);
  const traceFile = path.join(out, "execution-traces.json"); fs.writeFileSync(traceFile, JSON.stringify(traces, null, 2) + "\n", { flag: "wx" });
  fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify({ passed: true, at: new Date().toISOString(), cases: results.length, controlChecks,
    fills, minuteMarks: marks, rawMfiChecks: mfiChecks, rawWeeklyChecks: weeklyChecks, experimentalFills, caseChecks, accepted,
    traceSha256: await fileHash(traceFile), validationSha256: await fileHash(path.join(out, "validation.json")), checkerSha256: await fileHash(__filename),
    newTradingDefinitions: 1, liveChanges: 0, exactLiveExecutionCertified: false }, null, 2) + "\n", { flag: "wx" });
  console.log({ passed: true, cases: results.length, controlChecks, fills, marks, mfiChecks, weeklyChecks, experimentalFills });
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
