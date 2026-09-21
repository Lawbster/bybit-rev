import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gzipSync, gunzipSync } from 'zlib';
import { atomicJson, fileHash, sha } from './research-workflow';
import { cachedCandles, ROOT } from './level-playbook-study';
import { readAcceptedMap } from './poc-pine-export';
import { runCap, holdingStats } from './poc-exit-cap-engine';
import { exitStats } from './level-tpsl-engine';
import { snapshot, filters, blocks, attribution, type Row } from './high-touch-poc-context';
import { csv } from './poc-bounce-study';
const CARD = 'research-inputs/high-touch-poc-ht02-2026-09-17.json';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
export async function main() {
  const c = read(CARD), pp = read(c.parent + '/plan.json'), seal = read(c.parent + '/complete.json');
  assert(read(c.parent + '/independent-verification.json').passed);
  const protectedFiles = ['bot-config.json', 'hl-short-live-config.json', 'bot-state.json'];
  for (const p of pp.pins.filter((p: Row) => !protectedFiles.includes(p.file))) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
  const consumed = ['ranking.json', 'groups.json', 'results.json', ...seal.artifacts.filter((a: Row) => c.parents.some((p: string) => a.file.startsWith(p + '-'))).map((a: Row) => a.file)];
  for (const file of consumed) assert.equal(await fileHash(path.resolve(ROOT, c.parent, file)), seal.artifacts.find((a: Row) => a.file === file).sha256, file);
  assert.deepEqual(read(c.parent + '/ranking.json').filter((r: Row) => r.tpPct !== null).slice(0, 3).map((r: Row) => r.id), c.parents);
  const sources = [CARD, 'scripts/high-touch-poc-study.ts', 'scripts/high-touch-poc-context.ts', 'scripts/high-touch-poc-tests.ts',
    'scripts/high-touch-poc-verify.ts', 'scripts/high-touch-poc-report.ts', 'scripts/high-touch-short-audit.ts',
    'scripts/poc-profile-engine.ts', 'scripts/poc-volume-source.ts', 'scripts/poc-pine-export.ts',
    'scripts/level-playbook-study.ts', 'scripts/level-tpsl-engine.ts', 'scripts/poc-exit-cap-engine.ts', 'scripts/poc-indicator-bias-engine.ts',
    'scripts/poc-bounce-study.ts', 'scripts/research-workflow.ts', c.cache + '/candles.f64', c.cache + '/schema.json',
    ...['map.json', 'complete.json', 'independent-verification.json'].map(f => c.pocMap + '/' + f),
    c.parent + '/complete.json', c.parent + '/independent-verification.json', ...consumed.map((f: string) => c.parent + '/' + f), ...protectedFiles];
  const pins: Row[] = []; for (const file of sources) pins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  const key = sha(JSON.stringify({ c, pins, node: process.version })), dir = path.join(ROOT, 'backtests/high-touch-poc', key);
  assert(!fs.existsSync(dir), 'Immutable job exists; reuse saved output'); fs.mkdirSync(dir, { recursive: true });
  const write = (f: string, v: any) => atomicJson(path.join(dir, f), v);
  write('plan.json', { key, card: c, pins, node: process.version, createdAt: Date.now() }); console.log('[HT02] ' + dir);
  const cs = cachedCandles(c.cache), g = read(c.parent + '/groups.json').find((g: Row) => g.id === 'exact_touch');
  const oldRows: Row[] = read(c.parent + '/results.json'), windows = [{ id: 'full', start: Date.parse(c.start), end: Date.parse(c.end) },
    { id: 'older', start: Date.parse(c.start), end: Date.parse(c.split) }, { id: 'recent', start: Date.parse(c.split), end: Date.parse(c.end) }];
  const o = (w: Row, delay: number, targetFirst: boolean) => ({ start: w.start, end: w.end, delay, targetFirst, notional: c.notional, equity: c.equity, fee: c.fee });
  const baseline = new Map<string, ReturnType<typeof runCap>>(), bKey = (id: string, w: string, d: number, t: boolean) => `${id}:${w}:${d}:${t}`;
  let parity = 0;
  for (const id of c.parents) for (const w of windows) for (const delay of c.delays) for (const targetFirst of [false, true]) {
    const oldRow = oldRows.find(r => r.id === id && r.window === w.id && r.delay === delay && r.targetFirst === targetFirst)!;
    const old = JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, c.parent, oldRow.journal))).toString());
    const got = runCap(cs, g.signals, o(w, delay, targetFirst), c.capHours, oldRow.tpPct, oldRow.slPct);
    for (const k of ['stats', 'trades', 'accepted', 'monthly', 'open', 'curve']) assert.deepEqual(JSON.parse(JSON.stringify((got as Row)[k])), old[k], id + '/' + k);
    baseline.set(bKey(id, w.id, delay, targetFirst), got); parity++;
  }
  assert.equal(parity, 36); write('baseline-parity.json', { passed: true, paths: parity, parents: c.parents }); console.log('[HT02] 36 exact parent controls passed');
  const { map } = readAcceptedMap(path.resolve(ROOT, c.pocMap, 'map.json'));
  const observe = snapshot(map.profiles, map.end, c.mapSnapshotLagMs), contexts = g.evidence.map((e: Row) => observe(e));
  assert.equal(contexts.length, 7475); write('contexts.json', contexts); write('signals.json', g.signals);
  const defs = [{ id: 'baseline', family: '', relation: '', threshold: null }, ...filters(c)];
  assert.equal((defs.length - 1) * c.parents.length, c.newDefinitions); write('filters.json', defs);
  const decisions: Record<string, string[]> = {}, signalSets = new Map<string, any[]>();
  for (const def of defs) {
    decisions[def.id] = def.id === 'baseline' ? [] : contexts.filter((x: Row) => blocks(x, def)).map((x: Row) => x.id);
    const denied = new Set(decisions[def.id]); signalSets.set(def.id, g.signals.filter((s: Row) => !denied.has(s.id)));
  }
  write('vetoes.json', decisions);
  write('coverage.json', { rawSignals: contexts.length, periods: ['day', 'week', 'month'].map(p => ({ period: p,
    precedingPocAvailable: contexts.filter((x: Row) => x.coverage[p].previousAvailable).length,
    hasKnownNaked: contexts.filter((x: Row) => x.coverage[p].naked > 0).length,
    hasUncertainHistory: contexts.filter((x: Row) => x.coverage[p].uncertain > 0).length })),
    filters: defs.map(f => ({ id: f.id, vetoedRawSignals: decisions[f.id].length })) });
  const rows: Row[] = [], months: Row[] = [];
  for (const parent of c.parents) {
    const old = oldRows.find(r => r.id === parent)!, tpPct = old.tpPct, slPct = old.slPct;
    for (const def of defs) for (const w of windows) for (const delay of c.delays) {
      let primary: ReturnType<typeof runCap> | undefined, primaryFile = '';
      const denied = new Set(decisions[def.id]), sigs = signalSets.get(def.id)!;
      for (const targetFirst of [false, true]) {
        const id = `${parent}__${def.id}`, reuse = targetFirst && primary!.stats.ambiguous === 0 && baseline.get(bKey(parent, w.id, delay, false))!.stats.ambiguous === 0;
        const run = reuse ? primary! : def.id === 'baseline' ? baseline.get(bKey(parent, w.id, delay, targetFirst))! : runCap(cs, sigs, o(w, delay, targetFirst), 12, tpPct, slPct);
        if (!targetFirst) primary = run;
        const b = baseline.get(bKey(parent, w.id, delay, targetFirst))!, attr = attribution(b, run, denied);
        const file = reuse ? primaryFile : `${id}-${w.id}-${delay}-${targetFirst ? 'target' : 'stop'}.json.gz`;
        if (!reuse) fs.writeFileSync(path.join(dir, file), gzipSync(JSON.stringify({ options: { ...o(w, delay, targetFirst), capHours: c.capHours }, ...run, attribution: attr }), { level: 1 }), { flag: 'wx' });
        if (!targetFirst) primaryFile = file;
        const r = { id, parent, filter: def.id, family: def.family, relation: def.relation, threshold: def.threshold,
          tpPct, slPct, capHours: c.capHours, window: w.id, delay, targetFirst, ...run.stats, ...exitStats(run), ...holdingStats(run, w.end),
          stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * c.extraCostBpsPerSide / 10000,
          baselineNet: b.stats.net, baselineDd: b.stats.maxAdverseDrawdownPct, baselineWinRate: b.stats.winRate, baselineTrades: b.stats.trades,
          deltaNet: run.stats.net - b.stats.net, deltaWinRate: run.stats.winRate === null || b.stats.winRate === null ? null : run.stats.winRate - b.stats.winRate,
          worstMonth: Math.min(...run.monthly.map(m => m.markedNet)),
          worstMonthDelta: Math.min(...run.monthly.map(m => m.markedNet - b.monthly.find(x => x.month === m.month)!.markedNet)),
          vetoedRawSignals: contexts.filter((x: Row) => x.at >= w.start && x.at < w.end && denied.has(x.id)).length,
          blockedBaselineFills: b.accepted.filter(x => denied.has(x.id)).length,
          removed: attr.removed, added: attr.added, direct: attr.direct, displaced: attr.displaced,
          deltaWithoutTwoLargestAvoidedLosses: attr.deltaWithoutTwoLargestAvoidedLosses, journal: file };
        rows.push(r); months.push(...run.monthly.map(m => ({ id, parent, filter: def.id, window: w.id, delay, targetFirst, ...m,
          baselineNet: b.monthly.find(x => x.month === m.month)!.markedNet, delta: m.markedNet - b.monthly.find(x => x.month === m.month)!.markedNet })));
      }
    }
    console.log(`[HT02] ${parent}: ${rows.length} saved paths`);
  }
  const ranks: Row[] = [];
  for (const parent of c.parents) for (const def of defs) {
    const rs = rows.filter(r => r.parent === parent && r.filter === def.id && !r.targetFirst), failures: string[] = [], relative: string[] = [];
    if (rs.some(r => r.net <= 0)) failures.push('nonpositive_partition'); if (rs.some(r => r.stressNet <= 0)) failures.push('cost_stress');
    if (rs.some(r => r.trades < (r.window === 'full' ? 30 : 10))) failures.push('sample'); if (rs.some(r => r.bankrupt)) failures.push('equity');
    if (rs.some(r => r.worstMonth < -250)) failures.push('monthly_vs_cash');
    if (rs.some(r => r.deltaNet <= 0)) relative.push('net_regression');
    if (rs.some(r => r.maxAdverseDrawdownPct > r.baselineDd + 1e-8)) relative.push('dd_regression');
    if (rs.some(r => r.worstMonthDelta < -250)) relative.push('monthly_regression');
    ranks.push({ id: `${parent}__${def.id}`, parent, filter: def.id, failures, relativeFailures: relative,
      pass: !failures.length, relativePass: def.id !== 'baseline' && !failures.length && !relative.length,
      winRateImprovesAllSix: def.id !== 'baseline' && rs.every(r => r.deltaWinRate !== null && r.deltaWinRate > 0),
      netImprovesAllSix: def.id !== 'baseline' && rs.every(r => r.deltaNet > 0),
      full: rs.find(r => r.window === 'full' && !r.delay), older: rs.find(r => r.window === 'older' && !r.delay), recent: rs.find(r => r.window === 'recent' && !r.delay) });
  }
  assert.equal(rows.length, 2340); write('results.json', rows); write('ranking.json', ranks.sort((a, b) => b.full.net - a.full.net));
  fs.writeFileSync(path.join(dir, 'results.csv'), csv(rows)); fs.writeFileSync(path.join(dir, 'monthly.csv'), csv(months));
  for (const p of pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
  const artifacts: Row[] = []; for (const file of fs.readdirSync(dir).sort()) artifacts.push({ file, sha256: await fileHash(path.join(dir, file)) });
  write('complete.json', { key, paths: rows.length, newDefinitions: c.newDefinitions, artifacts, independentVerificationRequired: true });
  atomicJson(path.join(ROOT, 'backtests/high-touch-poc/latest.json'), { key, directory: path.relative(ROOT, dir).replace(/\\/g, '/'), accepted: false });
  console.log('[HT02] economics saved; independent verification pending');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
