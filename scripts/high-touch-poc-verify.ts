/** Independent HT02 raw-catalog projection and journal audit; no context/decision producer import. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gunzipSync } from 'zlib';
import { atomicJson, fileHash } from './research-workflow';
import { cachedCandles, ROOT } from './level-playbook-study';
import { auditShort, near } from './high-touch-short-audit';
type Row = Record<string, any>;
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
export async function main() {
  const latest = read('backtests/high-touch-poc/latest.json'), dir = process.argv[2] ?? latest.directory;
  const p = read(dir + '/plan.json'), c = p.card, seal = read(dir + '/complete.json');
  for (const x of p.pins) assert.equal(await fileHash(path.resolve(ROOT, x.file)), x.sha256, x.file);
  for (const x of seal.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, x.file)), x.sha256, x.file);
  assert.equal(read(dir + '/baseline-parity.json').paths, 36);
  const gs = read(c.parent + '/groups.json').find((g: Row) => g.id === 'exact_touch'), contexts: Row[] = read(dir + '/contexts.json');
  const sigs: Row[] = read(dir + '/signals.json'), profiles: Row[] = read(c.pocMap + '/map.json').profiles.filter((x: Row) => x.venue === 'bybit' && +x.width === .1 && x.eligible);
  assert.deepEqual(sigs, gs.signals); assert.equal(contexts.length, sigs.length);
  const decisions = read(dir + '/vetoes.json'), defs: Row[] = read(dir + '/filters.json');
  const expectedDefs: Row[] = [{ id: 'baseline', family: '', relation: '', threshold: null }];
  for (const family of c.families) for (const relation of c.relations) for (const threshold of c.thresholdsPct)
    expectedDefs.push({ id: `${family}_${relation}_${threshold}`, family, relation, threshold });
  assert.deepEqual(defs, expectedDefs);
  const expectedVetoes: Record<string, string[]> = Object.fromEntries(defs.map(d => [d.id, []]));
  const clockStart = (ts: number, period: string) => { const d = new Date(ts), day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return period === 'day' ? day : period === 'week' ? day - (d.getUTCDay() + 6) % 7 * 86400000 : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
  let contextChecks = 0, predicateChecks = 0;
  for (let i = 0; i < contexts.length; i++) {
    const x = contexts[i], e = gs.evidence[i], query = e.at - c.mapSnapshotLagMs, price = e.close;
    assert.equal(x.id, e.id); assert.equal(x.at, e.at); assert.equal(x.price, price); assert.equal(x.priceSourceEnd, e.observationEnd); assert.equal(x.snapshotAt, query);
    const visible = profiles.filter(r => r.availableAt <= query), lanes: Record<string, Row[]> = {};
    const status = (r: Row) => r.retestKnownAt !== null && r.retestKnownAt <= query ? 'tested' : r.uncertainKnownAt !== null && r.uncertainKnownAt <= query ? 'uncertain' : 'untested';
    for (const period of ['day', 'week', 'month']) {
      const all = visible.filter(r => r.period === period), end = clockStart(query - 60000, period);
      lanes['poc_' + period] = all.filter(r => r.end === end); lanes['npoc_' + period] = all.filter(r => status(r) === 'untested');
      assert.deepEqual(x.coverage[period], { expectedEnd: end, previousAvailable: lanes['poc_' + period].length > 0, published: all.length,
        naked: lanes['npoc_' + period].length, uncertain: all.filter(r => status(r) === 'uncertain').length, tested: all.filter(r => status(r) === 'tested').length });
    }
    lanes.poc_all = [...lanes.poc_day, ...lanes.poc_week, ...lanes.poc_month];
    lanes.npoc_all = [...lanes.npoc_day, ...lanes.npoc_week, ...lanes.npoc_month];
    for (const family of c.families) {
      assert.equal(x.levels[family].count, lanes[family].length);
      for (const relation of c.relations) {
        const candidates = lanes[family].filter(r => relation !== 'below' || +r.lower <= price).map(r => ({ id: r.id, period: r.period,
          start: r.start, end: r.end, availableAt: r.availableAt, lower: +r.lower, upper: +r.upper, center: +r.center, status: status(r),
          distancePct: (price < +r.lower ? +r.lower - price : price > +r.upper ? price - +r.upper : 0) / price * 100 }));
        candidates.sort((a, b) => a.distancePct - b.distancePct || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        const chosen = candidates[0] ?? null; assert.deepEqual(x.levels[family][relation], chosen); contextChecks++;
        for (const threshold of c.thresholdsPct) {
          if (chosen && chosen.distancePct - threshold <= 1e-10) expectedVetoes[`${family}_${relation}_${threshold}`].push(x.id); predicateChecks++;
        }
      }
    }
  }
  assert.deepEqual(decisions, expectedVetoes);
  const allowed = new Map<string, Row[]>(); for (const d of defs) { const deny = new Set(decisions[d.id]); allowed.set(d.id, sigs.filter(s => !deny.has(s.id))); }
  const cs = cachedCandles(c.cache), rows: Row[] = read(dir + '/results.json'), seen = new Set<string>(), bases = new Map<string, Row>();
  const load = (r: Row) => JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, dir, r.journal))).toString());
  const metric = (ts: Row[]) => ({ trades: ts.length, wins: ts.filter(t => t.net > 1e-8).length, losses: ts.filter(t => t.net < -1e-8).length,
    winningDollars: ts.reduce((s, t) => s + Math.max(0, t.net), 0), losingDollars: ts.reduce((s, t) => s + Math.min(0, t.net), 0), net: ts.reduce((s, t) => s + t.net, 0) });
  let paths = 0, receipts = 0, minutes = 0, monthRows = 0;
  for (const r of rows) {
    const bRow = rows.find(x => x.parent === r.parent && x.filter === 'baseline' && x.window === r.window && x.delay === r.delay && x.targetFirst === r.targetFirst)!;
    if (seen.has(r.journal)) {
      const prev = rows.find(x => x.journal === r.journal && !x.targetFirst)!; assert(r.targetFirst && !prev.ambiguous && !bRow.ambiguous);
      for (const k of Object.keys(r).filter(k => k !== 'targetFirst')) assert.deepEqual(r[k], prev[k]); paths++; continue;
    }
    seen.add(r.journal); const run = load(r);
    assert.equal(run.options.start, Date.parse(r.window === 'recent' ? c.split : c.start)); assert.equal(run.options.end, Date.parse(r.window === 'older' ? c.split : c.end));
    for (const k of ['notional', 'equity', 'fee']) assert.equal(run.options[k], c[k]);
    const a = auditShort(cs, allowed.get(r.filter)!, r, run, c); receipts += a.receipts; minutes += a.minutes; monthRows += a.monthRows; paths++;
    if (!bases.has(bRow.journal)) bases.set(bRow.journal, load(bRow)); const b = bases.get(bRow.journal)!;
    near(r.baselineNet, b.stats.net); near(r.baselineDd, b.stats.maxAdverseDrawdownPct); near(r.baselineWinRate, b.stats.winRate); near(r.baselineTrades, b.stats.trades);
    near(r.deltaNet, r.net - b.stats.net);
    if (r.winRate === null || b.stats.winRate === null) assert.equal(r.deltaWinRate, null); else near(r.deltaWinRate, r.winRate - b.stats.winRate);
    near(r.worstMonth, Math.min(...run.monthly.map((m: Row) => m.markedNet)));
    near(r.worstMonthDelta, Math.min(...run.monthly.map((m: Row) => m.markedNet - b.monthly.find((x: Row) => x.month === m.month).markedNet)));
    const deny: Set<string> = new Set<string>(decisions[r.filter]);
    const bm = new Map<string, Row>(b.trades.map((t: Row) => [t.id, t])), vm = new Map<string, Row>(run.trades.map((t: Row) => [t.id, t]));
    const removed: Row[] = b.trades.filter((t: Row) => !vm.has(t.id)), added: Row[] = run.trades.filter((t: Row) => !bm.has(t.id));
    const shared = run.trades.filter((t: Row) => bm.has(t.id)); for (const t of shared) assert.deepEqual(t, bm.get(t.id));
    const groups = { removed, added, direct: removed.filter(t => deny.has(t.id)), displaced: removed.filter(t => !deny.has(t.id)) };
    for (const [name, ts] of Object.entries(groups)) { assert.deepEqual(r[name], metric(ts)); assert.deepEqual(run.attribution[name], metric(ts)); }
    assert.deepEqual(run.attribution.removedIds, removed.map(t => t.id)); assert.deepEqual(run.attribution.addedIds, added.map(t => t.id)); assert.equal(run.attribution.shared, shared.length);
    const openDelta = (run.open?.net ?? 0) - (b.open?.net ?? 0); near(run.attribution.openDelta, openDelta);
    near(r.deltaNet, metric(added).net - metric(removed).net + openDelta); near(run.attribution.delta, r.deltaNet);
    near(r.deltaWithoutTwoLargestAvoidedLosses, r.deltaNet + removed.filter(t => t.net < 0).sort((a, b) => a.net - b.net).slice(0, 2).reduce((s, t) => s + t.net, 0));
    assert.equal(r.vetoedRawSignals, sigs.filter(s => s.at >= run.options.start && s.at < run.options.end && deny.has(s.id)).length);
    assert.equal(r.blockedBaselineFills, b.accepted.filter((s: Row) => deny.has(s.id)).length);
    if (seen.size % 150 === 0) console.log(`[HT02 audit] ${paths} paths / ${minutes} position-minutes`);
  }
  assert.equal(paths, seal.paths); assert.equal(paths, 2340);
  atomicJson(path.resolve(ROOT, dir, 'independent-verification.json'), { passed: true, key: p.key, paths, uniqueJournals: seen.size, receipts, minutes, monthRows, contextChecks, predicateChecks,
    note: 'Independent raw catalog as-of projection/nearest rows/all vetoes; all unique minute executions; attribution and monthly/DD/fees reconciled.' });
  if (latest.key === p.key) atomicJson(path.join(ROOT, 'backtests/high-touch-poc/latest.json'), { ...latest, accepted: true });
  console.log(JSON.stringify({ passed: true, paths, receipts, minutes, contextChecks, predicateChecks }));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
