/** Independent arithmetic and source-clock audit of PH01; no outcome reclassification. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileHash, atomicJson } from './research-workflow';
const ROOT = path.resolve(__dirname, '..'), M = 60000;
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
async function main() {
  const out = path.resolve(ROOT, process.argv[2]), plan = read(path.join(out, 'plan.json')), c = plan.card, complete = read(path.join(out, 'complete.json'));
  assert.equal(plan.key, complete.key); assert(!fs.existsSync(path.join(out, 'independent-verification.json')), 'Already verified');
  for (const a of complete.artifacts) assert.equal(await fileHash(path.join(out, a.file)), a.sha256);
  for (const p of plan.pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256);
  const rows = read(path.join(out, 'events.json')), trajectories = read(path.join(out, 'pre-entry-trajectories.json')), observations = read(path.join(out, 'retained-observations.json'));
  const byRef = new Map<string, any>(); Object.values(observations).forEach((rs: any) => rs.forEach((r: any) => byRef.set(r.file + ':' + r.line, r)));
  const base = read(path.resolve(ROOT, c.parent, c.baselineFile)), summary = read(path.join(out, 'summary.json'));
  assert.equal(base.trades.length, 238); near(base.trades.reduce((s: number, t: any) => s + t.net, 0), summary.fullBaseline.net);
  let refs = 0, flowChecks = 0, bookChecks = 0;
  for (const s of trajectories) {
    for (const value of Object.values(s.sources) as any[]) {
      if (!value) continue;
      const rs = value.sources ?? [value], query = value.sources ? s.asOf : value.queryAt ?? s.asOf;
      for (const r of rs) {
        const raw = byRef.get(r.file + ':' + r.line); assert(raw); assert(r.availableAt <= query && r.sourceAt <= query);
        const availability = Math.max(raw.baseAvailableAt, raw.modeledLag ? raw.sourceAt + c.legacyPublicationLagMs : 0);
        assert.equal(r.availableAt, availability); refs++;
      }
    }
    for (const span of [15, 60]) {
      const selected = s.sources['taker' + span].sources.map((r: any) => byRef.get(r.file + ':' + r.line));
      assert.equal(new Set(selected.map((r: any) => r.sourceAt)).size, selected.length);
      const bs = selected.reduce((a: number, r: any) => a + r.data.buyNotional, 0), ss = selected.reduce((a: number, r: any) => a + r.data.sellNotional, 0);
      selected.forEach((r: any) => assert(r.sourceAt > s.asOf - span * M && r.sourceAt <= s.asOf));
      const measured = s.features['takerRatio' + span];
      if (measured !== null) { near(measured, bs / ss); assert(selected.length >= c.windowCoverage['flow' + span + 'm']); flowChecks++; }
    }
    const bookRef = s.sources.book, book = bookRef ? byRef.get(bookRef.file + ':' + bookRef.line) : null;
    if (s.features.bookImbalance05 !== null) {
      assert(book.data.band05.healthy && s.asOf - book.sourceAt <= c.freshnessMs.book);
      near(s.features.bookImbalance05, (book.data.band05.bid - book.data.band05.ask) / (book.data.band05.bid + book.data.band05.ask)); bookChecks++;
    }
  }
  for (const e of rows) {
    const b = base.trades.find((x: any) => x.id === e.id); assert(b);
    for (const k of Object.keys(b)) assert.deepEqual(e[k], b[k]);
    const snapshots = trajectories.filter((s: any) => s.eventId === e.id); assert.equal(snapshots.length, 16);
    snapshots.forEach((s: any) => assert.equal(s.asOf, e.signalAt + s.offset * M));
    assert.deepEqual(e.features, snapshots.find((s: any) => s.offset === 0).features);
    assert.deepEqual(e.sourceDelayFeatures, snapshots.find((s: any) => s.offset === -1).features);
    assert.equal(e.entryAt, e.signalAt); assert.equal(e.signalAt, e.touchStart + M);
    near(e.net, (e.exitPrice - e.entryPrice) * e.qty - e.fees);
    assert.equal(e.outcomePath.ralliedOnePct, e.outcomePath.mfePct >= 1);
  }
  function checkGroups(file: string, events: any[]) {
    for (const p of read(path.join(out, file))) {
      const def = c.diagnosticPredicates.find((d: any) => d.id === p.id);
      const known = events.filter(e => def.conditions.every(([k]: any) => typeof e.features[k] === 'number' && Number.isFinite(e.features[k])));
      const cond = (e: any) => def.conditions.every(([k, op, v]: any) => op === '<' ? e.features[k] < v : op === '<=' ? e.features[k] <= v : op === '>' ? e.features[k] > v : e.features[k] >= v);
      const yes = known.filter(cond), no = known.filter(e => !cond(e));
      assert.equal(p.condition.n, yes.length); assert.equal(p.other.n, no.length);
      near(p.condition.net, yes.reduce((s, e) => s + e.net, 0)); near(p.other.net, no.reduce((s, e) => s + e.net, 0));
      near(p.baselineKnown.net, p.condition.net + p.other.net);
      near(p.baselineKnown.net + p.missing.net, events.reduce((s, e) => s + e.net, 0));
      assert.equal(p.early.condition.n, yes.filter(e => e.signalAt < Date.parse(c.chronologicalSplit)).length);
      assert.equal(p.late.condition.n, yes.filter(e => e.signalAt >= Date.parse(c.chronologicalSplit)).length);
      near(p.monthly.reduce((s: number, x: any) => s + x.condition.net, 0), p.condition.net);
    }
  }
  checkGroups('partitions.json', rows);
  checkGroups('core-cohort-partitions.json', rows.filter((e: any) => e.quality.coreHealthy));
  checkGroups('source-delay-partitions.json', rows.map((e: any) => ({ ...e, features: e.sourceDelayFeatures })));
  const rec = { passed: true, key: plan.key, immutableBaselineTrades: 238, coveredEraEvents: rows.length, snapshots: trajectories.length,
    sourceClockReferences: refs, independentFlowChecks: flowChecks, independentBookChecks: bookChecks, partitionsChecked: 48,
    verifierSha256: await fileHash(__filename), verifiedAt: Date.now() };
  atomicJson(path.join(out, 'independent-verification.json'), rec); console.log(JSON.stringify(rec, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
