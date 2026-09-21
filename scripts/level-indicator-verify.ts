/** LC01 checks new context/selection independently; reuses established execution auditors. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gunzipSync } from 'zlib';
import { atomicJson, fileHash } from './research-workflow';
import { cachedCandles, ROOT } from './level-playbook-study';
import { aggregate, type Row } from './poc-indicator-bias-engine';
import { computeResearchFeatures } from '../src/research/indicator-features';
import { computeVolumeFlowValues } from '../src/research/volume-flow-features';
import { auditCap, near } from './poc-exit-cap-audit';
import { auditShort } from './high-touch-short-audit';
import { attribution } from './high-touch-poc-context';
const M = 60000;
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const unzip = (f: string) => JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, f))).toString());
const norm = (x: any) => JSON.parse(JSON.stringify(x));

function eligible(x: Row, filter: string): boolean {
  if (filter === 'baseline') return true;
  const f = x.features;
  if (![f.crsi_15, f.roc5_60, f.cmf_60].every(v => v !== null && Number.isFinite(v))) return false;
  if (filter === 'ready') return true;
  if (filter === 'crsi_extreme') return x.side === 1 ? f.crsi_15 <= 10 : f.crsi_15 >= 90;
  if (filter === 'roc_stretch') return x.side === 1 ? f.roc5_60 <= -2 : f.roc5_60 >= 2;
  const cmf = x.side * f.cmf_60 >= .05;
  const room = !x.obstacle || x.obstacle.distancePct > 2;
  if (filter === 'cmf_aligned') return cmf;
  if (filter === 'npoc_room') return room;
  assert.equal(filter, 'cmf_npoc_room'); return cmf && room;
}

export async function main() {
  const dir = process.argv[2] ?? read('backtests/level-indicator/latest.json').directory;
  const plan = read(dir + '/plan.json'), seal = read(dir + '/complete.json'), c = plan.card;
  assert.equal(plan.key, seal.key);
  const checkHashes = async () => {
    for (const x of plan.pins) assert.equal(await fileHash(path.resolve(ROOT, x.file)), x.sha256, x.file);
    for (const x of seal.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, x.file)), x.sha256, x.file);
  };
  await checkHashes();
  const cs = cachedCandles(c.cache), groups: Row[] = read(dir + '/groups.json');
  const originals: Row[] = read(c.parent + '/groups.json');
  assert.deepEqual(groups.map(g => g.id).sort(), [...c.groups].sort());
  for (const g of groups) assert.deepEqual(g.signals, originals.find(p => p.id === g.id)!.signals);
  const oldPoc: Row[] = read(c.pocParent + '/signals.json'), oldLv = read(c.levelParent + '/signals.json').signals;
  const pocIds = new Map(oldPoc.map(x => [x.id, x.profileId]));
  const contexts: Row[] = unzip(dir + '/contexts.json.gz'), map = read(c.pocMap + '/map.json');
  const tables = new Map<number, { bars: ReturnType<typeof aggregate>; base: ReturnType<typeof computeResearchFeatures>; flow: ReturnType<typeof computeVolumeFlowValues>; index: Map<number, number> }>();
  for (const tf of [15, 60]) {
    const bars = aggregate(cs, tf * M), base = computeResearchFeatures(bars, tf * M);
    const flow = computeVolumeFlowValues(bars, tf * M, 'cmf', 20);
    tables.set(tf, { bars, base, flow, index: new Map(bars.map((b, i) => [b.timestamp + tf * M, i])) });
  }
  const contextByKey = new Map<string, Row>(); let prefixChecks = 0;
  for (const x of contexts) {
    const g = groups.find(g => g.id === x.group)!; assert(g);
    const s = g.signals.find((s: Row) => s.id === x.id); assert(s);
    assert.equal(s.at, x.at); assert.equal(s.side, x.side); assert(c.featureLags.includes(x.lag));
    const key = `${x.group}:${x.lag}:${x.id}`; assert(!contextByKey.has(key)); contextByKey.set(key, x);
    assert.equal(x.snapshotAt, x.at - x.lag); assert.equal(x.priceSourceEnd, x.at - M);
    const bar = cs[(x.priceSourceEnd - M - cs[0].ts) / M]; assert.equal(bar.endTs, x.priceSourceEnd); near(x.price, bar.close);
    const origin = x.group === 'pb02_daily_naked_touch__long' ? pocIds.get(x.id)
      : x.group === 'poc_day_naked_reject__short' ? oldLv.poc_day_naked_reject.find((s: Row) => s.id === x.id).evidence.referenceId : null;
    assert.equal(x.originProfileId ?? null, origin ?? null);
    const expected: Row = {};
    for (const tf of [15, 60]) {
      const t = tables.get(tf)!, end = Math.floor((x.at - x.lag) / (tf * M)) * tf * M, i = t.index.get(end);
      const source = x.sources.find((s: Row) => s.timeframeMinutes === tf); assert(source);
      assert.equal(source.barEnd, end); assert.equal(source.availableAt, end + x.lag);
      assert(source.availableAt <= x.at); assert.equal(source.present, i !== undefined);
      if (tf === 15) expected.crsi_15 = i === undefined ? null : t.base[i].crsi;
      else { expected.roc5_60 = i === undefined ? null : t.base[i].roc5; expected.cmf_60 = i === undefined ? null : t.flow[i].vfValue; }
    }
    for (const k of Object.keys(expected)) assert.deepEqual(x.features[k], expected[k], `${key}:${k}`);
    const known = map.profiles.filter((p: Row) => p.eligible && p.venue === 'bybit' && p.period === 'day' && Number(p.width) === .1 && p.availableAt <= x.snapshotAt);
    const state = (p: Row) => p.retestKnownAt !== null && p.retestKnownAt <= x.snapshotAt ? 'tested'
      : p.uncertainKnownAt !== null && p.uncertainKnownAt <= x.snapshotAt ? 'uncertain' : 'naked';
    const naked = known.filter((p: Row) => state(p) === 'naked');
    assert.deepEqual(x.coverage, { published: known.length, naked: naked.length,
      uncertain: known.filter((p: Row) => state(p) === 'uncertain').length, tested: known.filter((p: Row) => state(p) === 'tested').length });
    const obstacles = naked.filter((p: Row) => p.id !== origin && (x.side === 1 ? Number(p.upper) >= x.price : Number(p.lower) <= x.price))
      .map((p: Row) => ({ id: p.id, lower: Number(p.lower), upper: Number(p.upper), distancePct: 100 * Math.max(Number(p.lower) - x.price, x.price - Number(p.upper), 0) / x.price }))
      .sort((a: Row, b: Row) => a.distancePct - b.distancePct || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (!obstacles.length) assert.equal(x.obstacle, null); else {
      assert(x.obstacle); for (const k of ['id', 'lower', 'upper']) assert.deepEqual(x.obstacle[k], obstacles[0][k], key + ':' + k);
      near(x.obstacle.distancePct, obstacles[0].distancePct);
    }
  }
  assert.equal(contexts.length, groups.reduce((n, g) => n + g.signals.length, 0) * c.featureLags.length);
  // Recompute selected feature prefixes: adding future bars must not change old features.
  for (const [tf, t] of tables) for (const i of [150, Math.floor(t.bars.length / 2), t.bars.length - 2]) {
    const prefix = t.bars.slice(0, i + 1), base = computeResearchFeatures(prefix, tf * M), flow = computeVolumeFlowValues(prefix, tf * M, 'cmf', 20);
    assert.deepEqual(base.at(-1), t.base[i]); assert.deepEqual(flow.at(-1), t.flow[i]); prefixChecks++;
    const raw = cs.filter(b => b.ts >= t.bars[i].timestamp && b.endTs <= t.bars[i].timestamp + tf * M);
    assert.equal(raw.length, tf); near(t.bars[i].high, Math.max(...raw.map(b => b.high)));
    near(t.bars[i].low, Math.min(...raw.map(b => b.low))); near(t.bars[i].close, raw.at(-1)!.close);
    near(t.bars[i].volume, raw.reduce((a, b) => a + b.volume, 0));
  }
  const rows: Row[] = read(dir + '/results.json'), oldRows: Row[] = read(c.parent + '/results.json');
  const runs = new Map<string, Row>(), keys = new Set<string>(); let receipts = 0, minutes = 0, monthRows = 0, baselineChecks = 0;
  const get = (r: Row) => { let v = runs.get(r.journal); if (!v) { v = unzip(dir + '/' + r.journal); runs.set(r.journal, v!); } return v!; };
  const windowFor = (r: Row) => ({ start: r.window === 'recent' ? Date.parse(c.split) : Date.parse(c.start), end: r.window === 'older' ? Date.parse(c.split) : Date.parse(c.end) });
  for (const r of rows) {
    const key = [r.group, r.tpPct, r.slPct, r.filter, r.lag, r.window, r.delay, r.targetFirst].join(':'); assert(!keys.has(key)); keys.add(key);
    assert(c.filters.includes(r.filter) && c.featureLags.includes(r.lag) && c.delays.includes(r.delay));
    assert(c.exits.some((x: Row) => x.tpPct === r.tpPct && x.slPct === r.slPct)); assert.equal(r.capHours, 12);
    const g = groups.find(g => g.id === r.group)!, run = get(r), w = windowFor(r);
    for (const [k, v] of Object.entries({ ...w, delay: r.delay, targetFirst: r.targetFirst, notional: c.notional, equity: c.equity, fee: c.fee, capHours: 12 })) assert.equal(run.options[k], v, k);
    const sigs = g.signals.filter((s: Row) => eligible(contextByKey.get(`${g.id}:${r.lag}:${s.id}`)!, r.filter));
    const result = (g.side === 1 ? auditCap : auditShort)(cs, sigs, r, run, c);
    receipts += result.receipts; minutes += result.minutes; monthRows += result.monthRows;
    if (r.filter === 'baseline') {
      const oldRow = oldRows.find(a => a.group === r.group && a.tpPct === r.tpPct && a.slPct === r.slPct && a.window === r.window && a.delay === r.delay && (r.tpPct === null || a.targetFirst === r.targetFirst)); assert(oldRow);
      const fd = fs.openSync(path.resolve(ROOT, c.parent, oldRow.journal), 'r'), bytes = Buffer.alloc(oldRow.journalBytes);
      try { assert.equal(fs.readSync(fd, bytes, 0, bytes.length, oldRow.journalOffset), bytes.length); } finally { fs.closeSync(fd); }
      const old = JSON.parse(gunzipSync(bytes).toString());
      for (const f of ['stats', 'trades', 'accepted', 'open', 'monthly', 'curve']) assert.deepEqual(norm(run[f]), old[f], key + ':' + f);
      baselineChecks++;
    }
    const b = rows.find(b => b.group === r.group && b.tpPct === r.tpPct && b.slPct === r.slPct && b.filter === 'baseline' && b.lag === r.lag && b.window === r.window && b.delay === r.delay && b.targetFirst === r.targetFirst)!;
    assert(b); near(r.deltaNet, r.net - b.net); near(r.baselineNet, b.net); near(r.baselineDd, b.maxAdverseDrawdownPct);
    const denied = new Set<string>(g.signals.filter((s: Row) => !eligible(contextByKey.get(`${g.id}:${r.lag}:${s.id}`)!, r.filter)).map((s: Row) => s.id));
    const a = attribution(get(b), run, denied); if (run.attribution) assert.deepEqual(run.attribution, a);
    for (const field of ['removed', 'added', 'direct', 'displaced']) if (r[field]) assert.deepEqual(r[field], a[field as keyof typeof a]);
    near(r.worstMonth, Math.min(...run.monthly.map((m: Row) => m.markedNet)));
    near(r.worstMonthDelta, Math.min(...run.monthly.map((m: Row) => m.markedNet - get(b).monthly.find((a: Row) => a.month === m.month).markedNet)));
    for (const ref of ['baseline', 'ready', 'cmf_aligned', 'npoc_room']) if (r[ref + 'Net'] !== undefined) {
      const control = rows.find(a => a.group === r.group && a.tpPct === r.tpPct && a.slPct === r.slPct && a.filter === ref &&
        a.lag === r.lag && a.window === r.window && a.delay === r.delay && a.targetFirst === r.targetFirst)!;
      assert(control); near(r[ref + 'Net'], control.net); near(r[ref + 'Delta'], r.net - control.net);
      near(r[ref + 'Dd'], control.maxAdverseDrawdownPct);
      near(r[ref + 'WorstMonthDelta'], Math.min(...run.monthly.map((m: Row) => m.markedNet - get(control).monthly.find((a: Row) => a.month === m.month).markedNet)));
    }
  }
  // Each configured clock/window/exit must be represented, not only successful cases.
  for (const g of groups) for (const ex of c.exits) for (const f of c.filters) for (const lag of c.featureLags)
    for (const w of ['full', 'older', 'recent']) for (const d of c.delays) for (const t of (ex.tpPct === null ? [false] : [false, true]))
      assert(keys.has([g.id, ex.tpPct, ex.slPct, f, lag, w, d, t].join(':')), 'Missing case');
  const rankings: Row[] = read(dir + '/ranking.json'); assert.equal(rankings.length, 48);
  assert.equal(rankings.filter(r => r.primary).length, 32);
  for (const r of rankings) for (const [field, lags] of [['primaryScreen', [60000]], ['survivalScreen', c.featureLags]] as [string, number[]][]) {
    const cases = rows.filter(x => x.id === r.id && lags.includes(x.lag) && !x.targetFirst);
    assert.equal(cases.length, 6 * lags.length);
    const pass = cases.every(x => x.net > 0 && x.stressNet > 0 && x.trades >= (x.window === 'full' ? 30 : 10) && !x.bankrupt && x.worstMonth >= -250 &&
      ['baseline', ...(r.filter === 'ready' ? [] : ['ready']), ...(r.filter === 'cmf_npoc_room' ? ['cmf_aligned', 'npoc_room'] : [])].every(ref =>
        x[ref + 'Delta'] > 0 && x.maxAdverseDrawdownPct <= x[ref + 'Dd'] + 1e-8 && x[ref + 'WorstMonthDelta'] >= -250));
    assert.equal(r[field].pass, pass, r.id + ':' + field);
    assert.deepEqual(r.full, rows.find(x => x.id === r.id && x.lag === 60000 && x.window === 'full' && !x.delay && !x.targetFirst));
  }
  await checkHashes();
  const report = { passed: true, key: plan.key, contexts: contexts.length, paths: rows.length, uniqueJournals: runs.size,
    baselineChecks, receipts, minutes, monthRows, prefixChecks, verifiedAt: Date.now(), verifier: 'existing long/short minute auditors + independent LC01 selection and clock checks' };
  atomicJson(path.resolve(ROOT, dir, 'independent-verification.json'), report);
  atomicJson(path.resolve(ROOT, 'backtests/level-indicator/latest.json'), { key: plan.key, directory: dir.replace(/\\/g, '/'), accepted: true });
  console.log(JSON.stringify(report));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
