import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gunzipSync } from 'zlib';
import { atomicJson, fileHash } from './research-workflow';
import { cachedCandles, ROOT } from './level-playbook-study';
import { auditCap, near } from './poc-exit-cap-audit';
type Row = Record<string, any>;
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
export async function main() {
  const latest = read('backtests/poc-exit-cap/latest.json'), dir = process.argv[2] ?? latest.directory;
  const plan = read(dir + '/plan.json'), seal = read(dir + '/complete.json'), c = plan.card;
  for (const p of plan.pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
  for (const a of seal.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, a.file)), a.sha256, a.file);
  const cs = cachedCandles(c.cache), signals = read(dir + '/signals.json'), rows: Row[] = read(dir + '/results.json');
  assert.deepEqual(signals, read(c.parent + '/groups.json').find((g: Row) => g.id === c.group).signals);
  assert.equal(read(dir + '/baseline-parity.json').paths, 594);
  const seen = new Set<string>(); let paths = 0, receipts = 0, minutes = 0, monthRows = 0;
  for (const r of rows) {
    if (seen.has(r.journal)) {
      const primary = rows.find(x => x.journal === r.journal && !x.targetFirst)!; assert(r.targetFirst && !primary.ambiguous);
      for (const k of Object.keys(r).filter(k => k !== 'targetFirst')) assert.deepEqual(r[k], primary[k]); paths++; continue;
    }
    seen.add(r.journal); const run = JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, dir, r.journal))).toString('utf8'));
    assert.equal(run.options.start, Date.parse(r.window === 'recent' ? c.split : c.start));
    assert.equal(run.options.end, Date.parse(r.window === 'older' ? c.split : c.end));
    for (const k of ['notional', 'equity', 'fee']) assert.equal(run.options[k], c[k]);
    const found = auditCap(cs, signals, r, run, c); receipts += found.receipts; minutes += found.minutes; monthRows += found.monthRows; paths++;
    const refId = r.tpPct === null ? 'timed12' : `cap12__tp${r.tpPct}_sl${r.slPct}`;
    const b = rows.find(x => x.id === refId && x.window === r.window && x.delay === r.delay && !x.targetFirst)!;
    near(r.reference12Net, b.net); near(r.reference12Dd, b.maxAdverseDrawdownPct); near(r.delta12, r.net - b.net);
    const br = JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, dir, b.journal))).toString('utf8'));
    near(r.worstMonth, Math.min(...run.monthly.map((m: Row) => m.markedNet)));
    near(r.worstMonthDelta12, Math.min(...run.monthly.map((m: Row) => m.markedNet - br.monthly.find((bm: Row) => bm.month === m.month).markedNet)));
    if (seen.size % 100 === 0) console.log(`[LV03 audit] ${paths} paths, ${minutes} minutes`);
  }
  assert.equal(paths, seal.paths); assert.equal(paths, 1776);
  atomicJson(path.resolve(ROOT, dir, 'independent-verification.json'), { passed: true, key: plan.key, paths, uniqueJournals: seen.size,
    receipts, minutes, monthRows, checks: 'Every unique path: first barriers/gaps, no-cap ownership, actual fill/fees, all minute DD, monthly marks, cutoff inventory and durations; repeated target-first paths require zero ambiguity.' });
  if (latest.key === plan.key) atomicJson(path.join(ROOT, 'backtests/poc-exit-cap/latest.json'), { ...latest, accepted: true });
  console.log(JSON.stringify({ passed: true, paths, receipts, minutes, monthRows }));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
