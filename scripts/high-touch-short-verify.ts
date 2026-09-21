import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gunzipSync } from 'zlib';
import { atomicJson, fileHash } from './research-workflow';
import { cachedCandles, ROOT } from './level-playbook-study';
import { aggressive10HighSnapshot } from '../src/bot/aggressive10-policy';
import { auditShort, near } from './high-touch-short-audit';
type Row = Record<string, any>;
const M = 60000, read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
export async function main() {
  const latest = read('backtests/high-touch-short/latest.json'), dir = process.argv[2] ?? latest.directory;
  const plan = read(dir + '/plan.json'), seal = read(dir + '/complete.json'), c = plan.card;
  for (const p of plan.pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
  for (const a of seal.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, a.file)), a.sha256, a.file);
  assert.equal(read(dir + '/baseline-parity.json').paths, 30);
  const cs = cachedCandles(c.cache), gs = read(dir + '/groups.json'), n = cs.length, w = c.windowMinutes;
  // Independent O(n) block-prefix/suffix maximum, not producer's monotone deque.
  const prefix = new Float64Array(n), suffix = new Float64Array(n);
  for (let i = 0; i < n; i++) prefix[i] = i % w === 0 ? cs[i].high : Math.max(prefix[i - 1], cs[i].high);
  for (let i = n - 1; i >= 0; i--) suffix[i] = i === n - 1 || (i + 1) % w === 0 ? cs[i].high : Math.max(suffix[i + 1], cs[i].high);
  const maximum = (end: number) => Math.max(suffix[end - w + 1], prefix[end]);
  const bytes = fs.readFileSync(path.resolve(ROOT, dir, 'rolling-high.f64')), roll = new Float64Array(bytes.length / 8); Buffer.from(roll.buffer).set(bytes);
  assert.equal(roll.length, n); let rollingChecks = 0, liveChecks = 0;
  for (let i = 0; i < n; i++) {
    if (i < w - 1) { assert(Number.isNaN(roll[i])); continue; }
    assert.equal(roll[i], maximum(i)); rollingChecks++;
    if (i % 8192 === 0) {
      const bs = cs.slice(i - w + 1, i + 1); assert.equal(maximum(i), Math.max(...bs.map(b => b.high)));
      const snapshot = aggressive10HighSnapshot(bs.map(b => ({ timestamp: b.ts, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume, turnover: b.turnover })), cs[i].endTs);
      assert(snapshot.healthy && snapshot.decisionReady); assert.equal(snapshot.high, maximum(i)); liveChecks++;
    }
  }
  let evidenceChecks = 0;
  for (const g of gs) {
    let j = 0, episodes = 0, last = -Infinity;
    for (let i = w + 1; i < n; i++) {
      const b = cs[i], end = g.id === 'exact_touch' ? i - 2 : i, high = maximum(end), distancePct = Math.max(0, (1 - b.close / high) * 100);
      const fires = g.id === 'exact_touch' ? b.low <= high && b.high >= high : distancePct <= 1 + 1e-10;
      if (!fires) continue;
      const at = b.endTs + M, id = `${g.id}:${at}`, e = g.evidence[j];
      assert.deepEqual(g.signals[j], { id, at, side: -1 });
      assert.deepEqual(e, { id, kind: g.id, at, observationStart: b.ts, observationEnd: b.endTs,
        sourceStart: cs[end - w + 1].ts, sourceEnd: cs[end].endTs, referenceAvailableAt: cs[end].endTs + M,
        high, open: b.open, low: b.low, observedHigh: b.high, close: b.close, distancePct });
      assert(e.sourceEnd <= e.observationEnd && e.referenceAvailableAt <= e.at);
      if (g.id === 'exact_touch') assert.equal(e.referenceAvailableAt, e.observationStart);
      if (last !== b.ts - M) episodes++; last = b.ts; j++; evidenceChecks++;
    }
    assert.equal(j, g.signals.length); assert.equal(j, g.evidence.length); assert.equal(episodes, g.episodes);
  }
  const rows: Row[] = read(dir + '/results.json'), seen = new Set<string>(); let paths = 0, receipts = 0, minutes = 0, monthRows = 0;
  for (const r of rows) {
    if (seen.has(r.journal)) { const primary = rows.find(x => x.journal === r.journal && !x.targetFirst)!;
      assert(r.targetFirst && !primary.ambiguous); for (const k of Object.keys(r).filter(k => k !== 'targetFirst')) assert.deepEqual(r[k], primary[k]); paths++; continue; }
    seen.add(r.journal); const run = JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, dir, r.journal))).toString('utf8'));
    assert.equal(run.options.start, Date.parse(r.window === 'recent' ? c.split : c.start)); assert.equal(run.options.end, Date.parse(r.window === 'older' ? c.split : c.end));
    for (const k of ['notional', 'equity', 'fee']) assert.equal(run.options[k], c[k]);
    const g = gs.find((g: Row) => g.id === r.group), v = auditShort(cs, g.signals, r, run, c);
    receipts += v.receipts; minutes += v.minutes; monthRows += v.monthRows; paths++;
    const b = rows.find(x => x.group === r.group && x.tpPct === null && x.window === r.window && x.delay === r.delay)!;
    near(r.timedNet, b.net); near(r.timedDd, b.maxAdverseDrawdownPct); near(r.deltaTimed, r.net - b.net);
    if (r.tpPct !== null) { const two = rows.find(x => x.group === r.group && x.tpPct === 2 && x.slPct === 2 && x.window === r.window && x.delay === r.delay && !x.targetFirst)!;
      near(r.reference22Net, two.net); near(r.delta22, r.net - two.net); }
    const br = JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, dir, b.journal))).toString('utf8'));
    near(r.worstMonth, Math.min(...run.monthly.map((m: Row) => m.markedNet)));
    near(r.worstMonthDeltaTimed, Math.min(...run.monthly.map((m: Row) => m.markedNet - br.monthly.find((bm: Row) => bm.month === m.month).markedNet)));
    if (seen.size % 100 === 0) console.log(`[HT01 audit] ${paths} paths, ${minutes} position-minutes`);
  }
  assert.equal(paths, seal.paths); assert.equal(paths, 1188);
  atomicJson(path.resolve(ROOT, dir, 'independent-verification.json'), { passed: true, key: plan.key, paths, uniqueJournals: seen.size,
    receipts, minutes, monthRows, rollingChecks, liveChecks, evidenceChecks, checks: 'All rolling reference minutes; all qualifying and nonqualifying opportunities; independent short first-touch/gap/ownership/fee/monthly/DD on every unique path.' });
  if (latest.key === plan.key) atomicJson(path.join(ROOT, 'backtests/high-touch-short/latest.json'), { ...latest, accepted: true });
  console.log(JSON.stringify({ passed: true, paths, receipts, minutes, rollingChecks, liveChecks, evidenceChecks }));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
