/** Read-only independent artifact checks; never reruns strategy or modifies outputs. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import { dropVeto } from "./ladder-drop-pulse-policy";
import { createPersistentGate, persistentVariants, type PersistentSpec } from "./ladder-persistent-pulse-policy";
import { exposureDelta, qualifyExposure } from "./ladder-exposure-metrics";
async function main() {
  const dir = path.resolve(process.argv[2] ?? "backtests/hype/hype-ladder-persistent-pulse-2026-09-05");
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const rows = (f: string) => fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n").filter(Boolean).map(x => JSON.parse(x));
  const m = read("manifest.json"), spec: PersistentSpec = m.spec, results: any[] = read("results.json"), bases: any[] = read("baseline.json");
  const expected: any[] = JSON.parse(fs.readFileSync(path.join(spec.baselineDir, "summary.json"), "utf8"));
  const previous: any[] = JSON.parse(fs.readFileSync(path.join(spec.priorDropDir, "baseline.json"), "utf8"));
  const controls: any[] = JSON.parse(fs.readFileSync(path.join(spec.priorDropDir, "results.json"), "utf8"));
  const variants = persistentVariants(spec); assert.equal(results.length, variants.length * 4); assert.equal(bases.length, 4);
  assert.equal(new Set(results.map(r => `${r.model}:${r.variant}`)).size, results.length);
  const eq = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
  for (const base of bases) {
    assert.equal(base.digest, expected.find(x => x.id === base.model).digest);
    assert.deepEqual(base.metrics, previous.find(x => x.model === base.model).metrics);
  }
  let vetoes = 0, fills = 0, releases = 0, decisions = 0, armed = 0, held = 0;
  for (const r of results) {
    const base = bases.find(b => b.model === r.model); assert(base);
    const v = variants.find(v => v.id === r.variant)!; assert(v);
    eq(r.metrics.grossWin - r.metrics.grossLoss + r.metrics.unfinishedPartialPnl, r.metrics.realized);
    eq(r.metrics.realized + r.metrics.openPnl, r.metrics.totalPnl);
    eq(r.metrics.monthly.reduce((s: number, x: any) => s + x.mtmPnl, 0), r.metrics.totalPnl);
    eq(r.metrics.monthly.reduce((s: number, x: any) => s + x.realizedPnl, 0), r.metrics.realized);
    eq(r.delta.pnlDelta, r.metrics.totalPnl - base.metrics.totalPnl);
    eq(r.delta.ddReductionPp, base.metrics.maxDrawdownPct - r.metrics.maxDrawdownPct);
    eq(r.delta.monthly.reduce((s: number, x: any) => s + x.mtmDelta, 0), r.delta.pnlDelta);
    for (const x of r.delta.monthly) {
      const bm = base.metrics.monthly.find((b: any) => b.month === x.month);
      const vm = r.metrics.monthly.find((b: any) => b.month === x.month);
      eq(x.mtmDelta, vm.mtmPnl - bm.mtmPnl); eq(x.realizedDelta, vm.realizedPnl - bm.realizedPnl);
    }
    assert.deepEqual(r.versusNonpersistent, exposureDelta(r.metrics, controls.find(x => x.model === r.model && x.variant === v.controlId).metrics));
    const prefix = `${r.model}--${r.variant}`, traces = rows(`${prefix}-first-vetoes.jsonl`), outcomes = rows(`${prefix}-first-veto-releases.jsonl`);
    const executions = rows(`${prefix}-executions.jsonl`), keys = new Set<string>();
    const journal = rows(`${prefix}-gate-decisions.jsonl`), gate = createPersistentGate(v, spec), byIndex = new Map<number, any>();
    const countsTransitions: Record<string, number> = {}, countsPrevented: Record<string, number> = {};
    let lastIndex = -1, vetoMinutes = 0;
    for (const x of journal) {
      const d = x.decision, a = gate.evaluate(d);
      assert(d.index > lastIndex); lastIndex = d.index;
      assert.deepEqual(a, x.answer); byIndex.set(d.index, x); decisions++;
      countsTransitions[a.event] = (countsTransitions[a.event] ?? 0) + 1;
      if (a.reset) countsTransitions.resets = (countsTransitions.resets ?? 0) + 1;
      if (a.preventedRelease) countsPrevented[a.preventedRelease] = (countsPrevented[a.preventedRelease] ?? 0) + 1;
      if (a.event === "armed") { assert(d.priceDropOk && dropVeto(v, d, spec).veto); armed++; }
      if (a.event === "held") { assert(a.veto && a.active); held++; }
      if (a.event === "released") { assert(!a.unknown && !a.veto && !a.active && a.before); }
      if (a.veto) { vetoMinutes++; assert(d.nextDepth >= v.depth); }
      assert(d.resistanceKnownAt === null || d.resistanceKnownAt <= d.at);
    }
    assert.equal(vetoMinutes, r.vetoMinutes);
    assert.deepEqual(countsTransitions, r.transitions); assert.deepEqual(countsPrevented, r.prevented);
    assert.deepEqual(gate.state(), r.lastObservedHold);
    for (const e of executions) {
      assert(e.fillIndex > e.decisionIndex && e.fillAt >= e.decisionAt); fills++;
      if (e.kind === "open") { const x = byIndex.get(e.decisionIndex); assert(x && !x.answer.veto); assert.equal(e.fillIndex, e.decisionIndex + 1); }
    }
    for (const [i, t] of traces.entries()) {
      assert(t.priceDropOk && t.nextDepth >= v.depth && dropVeto(v, t, spec).veto);
      assert(t.resistanceKnownAt === null || t.resistanceKnownAt <= t.at);
      const key = `${t.episode}:${t.nextDepth}`; assert(!keys.has(key)); keys.add(key); vetoes++;
      const o = outcomes[i]; assert.deepEqual(o.veto, t);
      const next = executions.find(e => e.fillIndex > t.index);
      assert.deepEqual(o.nextExecution, next ?? null);
      if (o.outcome === "add_filled") {
        assert(next?.kind === "open" && o.release.decision.index === next.decisionIndex);
        assert(o.release.decision.episode === t.episode && o.release.decision.nextDepth === t.nextDepth);
        const logged = byIndex.get(o.release.decision.index); assert(logged);
        assert.deepEqual(logged.decision, o.release.decision);
        const answer = logged.answer;
        assert(!answer.veto && answer.reason === o.release.reason);
        eq(o.waitMinutes, (next.fillAt - t.at) / 60000); releases++;
      } else assert(o.release === null && o.waitMinutes === null);
    }
    assert.equal(outcomes.length, traces.length);
    assert.equal(new Set(traces.map(t => t.episode)).size, r.vetoEpisodes);
    const counts: Record<string, number> = {};
    for (const o of outcomes) { const k = o.outcome === "add_filled" ? o.release.reason : o.outcome; counts[k] = (counts[k] ?? 0) + 1; }
    assert.deepEqual(counts, r.releaseCounts);
  }
  const ranking = variants.map(v => ({ ...v, ...qualifyExposure(results.filter(r => r.variant === v.id), { ...spec, families: [] }) }))
    .sort((a, b) => b.minimumHlDdReductionPp - a.minimumHlDdReductionPp || b.minimumHlPnlDelta - a.minimumHlPnlDelta);
  assert.deepEqual(ranking, read("ranking.json"));
  for (const input of [...m.inputs, ...m.sources]) {
    const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(input.file)) h.update(b);
    assert.equal(h.digest("hex"), input.sha256, input.file);
  }
  assert(read("validation.json").genuineDropArmingOnly);
  console.log(JSON.stringify({ passed: true, baselineDigests: 4, cases: results.length, vetoes, fills, releases,
    decisions, armed, held, monthlyAndEpisodeAccounting: true, pairedControlsRecomputed: true, completeStateMachinesReplayed: true, opensNeverBypassVeto: true, firstExecutionAndReleaseChecked: true, rankingsRecomputed: true, hashesUnchanged: true }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
