/** Read-only independent artifact checks; never reruns strategy or modifies outputs. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import { dropVariants, dropVeto, type DropSpec } from "./ladder-drop-pulse-policy";
import { qualifyExposure } from "./ladder-exposure-metrics";
async function main() {
  const dir = path.resolve(process.argv[2] ?? "backtests/hype/hype-ladder-drop-pulse-2026-09-05");
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const rows = (f: string) => fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n").filter(Boolean).map(x => JSON.parse(x));
  const m = read("manifest.json"), spec: DropSpec = m.spec, results: any[] = read("results.json"), bases: any[] = read("baseline.json");
  const expected: any[] = JSON.parse(fs.readFileSync(path.join(spec.baselineDir, "summary.json"), "utf8"));
  const previous: any[] = JSON.parse(fs.readFileSync(path.join(spec.priorExposureDir, "baseline.json"), "utf8"));
  const variants = dropVariants(spec); assert.equal(results.length, variants.length * 4); assert.equal(bases.length, 4);
  assert.equal(new Set(results.map(r => `${r.model}:${r.variant}`)).size, results.length);
  const eq = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
  for (const base of bases) {
    assert.equal(base.digest, expected.find(x => x.id === base.model).digest);
    assert.deepEqual(base.metrics, previous.find(x => x.model === base.model).metrics);
  }
  let vetoes = 0, fills = 0, releases = 0;
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
    const prefix = `${r.model}--${r.variant}`, traces = rows(`${prefix}-first-vetoes.jsonl`), outcomes = rows(`${prefix}-first-veto-releases.jsonl`);
    const executions = rows(`${prefix}-executions.jsonl`), keys = new Set<string>();
    for (const e of executions) { assert(e.fillIndex > e.decisionIndex && e.fillAt >= e.decisionAt); fills++; }
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
        const answer = dropVeto(v, o.release.decision, spec);
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
  assert(read("validation.json").genuineDropScopeOnly);
  console.log(JSON.stringify({ passed: true, baselineDigests: 4, cases: results.length, vetoes, fills, releases,
    monthlyAndEpisodeAccounting: true, firstExecutionAndReleaseChecked: true, rankingsRecomputed: true, hashesUnchanged: true }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
