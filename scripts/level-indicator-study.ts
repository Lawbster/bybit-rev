/** LC01: frozen filters over saved opportunities. No live state or entry discovery. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gzipSync, gunzipSync } from 'zlib';
import { atomicJson, fileHash, sha } from './research-workflow';
import { ROOT, cachedCandles } from './level-playbook-study';
import { indicatorTape, type Action, type Row } from './poc-indicator-bias-engine';
import { runCap, holdingStats } from './poc-exit-cap-engine';
import { exitStats } from './level-tpsl-engine';
import { createReader, type Profile, type AsOfProfile } from './poc-profile-engine';
import { readAcceptedMap } from './poc-pine-export';
import { nearest, attribution } from './high-touch-poc-context';
import { csv } from './poc-bounce-study';
import type { Candle } from './hype-freerun-canonical-replay';
export { ROOT };
export const CARD = 'research-inputs/level-indicator-lc01-2026-09-18.json';
export const read = (f: string): any => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
export interface Group { id: string; entry: string; side: 1 | -1; signals: Action[] }
export function room(rows: AsOfProfile[], price: number, side: number, origin: string | null) {
  return nearest(rows.filter(p => p.status === 'untested' && p.id !== origin &&
    (side === 1 ? Number(p.upper) >= price : Number(p.lower) <= price)), price, side === -1);
}
export function passes(x: Row, filter: string): boolean {
  if (filter === 'baseline') return true;
  const f = x.features, ready = ['crsi_15', 'roc5_60', 'cmf_60'].every(k => f[k] !== null && Number.isFinite(f[k]));
  if (!ready) return false;
  const cmf = x.side === 1 ? f.cmf_60 >= .05 : f.cmf_60 <= -.05;
  const space = x.obstacle === null || x.obstacle.distancePct > 2;
  switch (filter) {
    case 'ready': return true;
    case 'crsi_extreme': return x.side === 1 ? f.crsi_15 <= 10 : f.crsi_15 >= 90;
    case 'roc_stretch': return x.side === 1 ? f.roc5_60 <= -2 : f.roc5_60 >= 2;
    case 'cmf_aligned': return cmf;
    case 'npoc_room': return space;
    case 'cmf_npoc_room': return cmf && space;
    default: throw new Error('Unknown filter ' + filter);
  }
}
/** The only map/indicator construction; contexts are shared by all economic paths. */
export function makeContexts(cs: Candle[], gs: Group[], profiles: Profile[], cutoff: number,
  origins: Map<string, string>, lags: number[]): Row[] {
  const tape = indicatorTape(cs), reader = createReader(profiles, cutoff), base = cs[0].ts;
  const out: Row[] = [];
  for (const g of gs) for (const s of g.signals) for (const lag of lags) {
    const priceSourceEnd = s.at - 60000, b = cs[(priceSourceEnd - 60000 - base) / 60000];
    assert(b && b.endTs === priceSourceEnd, 'Observed price source missing');
    const snapshotAt = s.at - lag, known = reader.at(snapshotAt, { venue: 'bybit', period: 'day', width: '0.1' });
    const snap = tape.at(s.at, lag), originProfileId = origins.get(s.id) ?? null;
    if (g.entry.includes('poc') || g.entry.includes('naked')) assert(originProfileId, 'Missing originating profile');
    out.push({ group: g.id, id: s.id, at: s.at, side: s.side, lag, originProfileId, price: b.close,
      priceSourceEnd, snapshotAt, features: Object.fromEntries(['crsi_15', 'roc5_60', 'cmf_60'].map(k => [k, snap.features[k]])),
      sources: snap.sources.filter(s => [15, 60].includes(s.timeframeMinutes)),
      coverage: { published: known.length, naked: known.filter(p => p.status === 'untested').length,
        uncertain: known.filter(p => p.status === 'uncertain').length, tested: known.filter(p => p.status === 'tested').length },
      obstacle: room(known, b.close, s.side, originProfileId) });
  }
  return out;
}
export function archived(dir: string, r: Row): Row {
  const fd = fs.openSync(path.resolve(ROOT, dir, r.journal), 'r'), bytes = Buffer.alloc(r.journalBytes);
  try { assert.equal(fs.readSync(fd, bytes, 0, bytes.length, r.journalOffset), bytes.length); }
  finally { fs.closeSync(fd); }
  return JSON.parse(gunzipSync(bytes).toString());
}
/** Recursively pin imported local math, not unrelated repository state. */
function dependencies(file: string, found = new Set<string>()): Set<string> {
  if (found.has(file)) return found; found.add(file);
  const text = fs.readFileSync(path.resolve(ROOT, file), 'utf8');
  for (const m of text.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
    const resolved = path.resolve(ROOT, path.dirname(file), m[1]) + '.ts';
    if (fs.existsSync(resolved)) dependencies(path.relative(ROOT, resolved).replace(/\\/g, '/'), found);
  }
  return found;
}
export async function main() {
  const c = read(CARD), gs: Group[] = read(c.parent + '/groups.json').filter((g: Group) => c.groups.includes(g.id));
  assert.equal(gs.length, 4);
  for (const g of gs) for (const s of g.signals) assert.deepEqual(Object.keys(s).sort(), ['at', 'id', 'side']);
  const oldRows: Row[] = read(c.parent + '/results.json').filter((r: Row) => c.groups.includes(r.group) &&
    (r.tpPct === null || (r.tpPct === 2 && r.slPct === 3.5)));
  const sources = dependencies('scripts/level-indicator-study.ts');
  for (const f of ['scripts/level-indicator-tests.ts', 'scripts/level-indicator-verify.ts'])
    if (fs.existsSync(path.resolve(ROOT, f))) dependencies(f, sources);
  sources.add(CARD);
  for (const f of ['bot-config.json', 'hl-short-live-config.json', 'bot-state.json']) sources.add(f);
  for (const dir of [c.parent, c.levelParent, c.pocParent, c.cache, c.pocMap]) {
    sources.add(dir + '/complete.json');
    const receipt = dir + '/independent-verification.json';
    if (fs.existsSync(path.resolve(ROOT, receipt))) { assert(read(receipt).passed); sources.add(receipt); }
  }
  for (const [dir, files] of [[c.parent, ['groups.json', 'results.json', ...new Set(oldRows.map(r => r.journal))]],
    [c.levelParent, ['signals.json']], [c.pocParent, ['signals.json']], [c.cache, ['candles.f64', 'schema.json']], [c.pocMap, ['map.json']]] as [string, string[]][]) {
    const seal = read(dir + '/complete.json');
    for (const file of files) { const p = dir + '/' + file, expected = seal.artifacts.find((a: Row) => a.file === file); assert(expected, p);
      assert.equal(await fileHash(path.resolve(ROOT, p)), expected.sha256, p); sources.add(p); }
  }
  const pins: Row[] = []; for (const file of [...sources].sort()) pins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  const key = sha(JSON.stringify({ c, pins, node: process.version })), dir = path.join(ROOT, 'backtests/level-indicator', key);
  assert(!fs.existsSync(dir), 'Immutable job exists; reuse it'); fs.mkdirSync(dir, { recursive: true });
  const json = (file: string, value: any) => atomicJson(path.join(dir, file), value);
  const gz = (file: string, value: any) => fs.writeFileSync(path.join(dir, file), gzipSync(JSON.stringify(value), { level: 1 }), { flag: 'wx' });
  json('plan.json', { key, card: c, pins, node: process.version, createdAt: Date.now() }); json('pins.json', pins); json('groups.json', gs);
  const cs = cachedCandles(c.cache), windows = [{ id: 'full', start: Date.parse(c.start), end: Date.parse(c.end) },
    { id: 'older', start: Date.parse(c.start), end: Date.parse(c.split) }, { id: 'recent', start: Date.parse(c.split), end: Date.parse(c.end) }];
  const options = (w: Row, delay: number, targetFirst: boolean) => ({ start: w.start, end: w.end, delay, targetFirst,
    notional: c.notional, equity: c.equity, fee: c.fee, capHours: c.capHours });
  const baselines = new Map<string, ReturnType<typeof runCap>>(); let parity = 0;
  for (const g of gs) for (const e of c.exits) for (const w of windows) for (const delay of c.delays)
    for (const targetFirst of e.tpPct === null ? [false] : [false, true]) {
      const old = oldRows.find(r => r.group === g.id && r.tpPct === e.tpPct && r.slPct === e.slPct && r.window === w.id && r.delay === delay && r.targetFirst === targetFirst);
      assert(old, 'Missing archived control'); const saved = archived(c.parent, old);
      const got = runCap(cs, g.signals, options(w, delay, targetFirst), c.capHours, e.tpPct, e.slPct);
      for (const field of ['stats', 'trades', 'accepted', 'monthly', 'open', 'curve'])
        assert.deepEqual(JSON.parse(JSON.stringify((got as Row)[field])), saved[field], g.id + '/' + field);
      baselines.set([g.id, e.id, w.id, delay, targetFirst].join('|'), got); parity++;
    }
  json('baseline-parity.json', { passed: true, exact: true, paths: parity, fields: ['stats', 'trades', 'accepted', 'monthly', 'open', 'curve'] });
  console.log('[LC01] exact archived parity ' + parity);
  const origins = new Map<string, string>();
  for (const s of read(c.pocParent + '/signals.json')) origins.set(s.id, s.profileId);
  for (const s of read(c.levelParent + '/signals.json').signals.poc_day_naked_reject) origins.set(s.id, s.evidence.referenceId);
  const { map } = readAcceptedMap(path.resolve(ROOT, c.pocMap, 'map.json'));
  const contexts = makeContexts(cs, gs, map.profiles, map.end, origins, c.featureLags); gz('contexts.json.gz', contexts);
  const definitions = gs.flatMap(g => c.exits.flatMap((e: Row) => c.filters.map((filter: string) => ({ id: `${g.id}__${e.id}__${filter}`,
    group: g.id, exit: e.id, filter, primary: c.primaryFilters.includes(filter), diagnostic: ['ready', 'npoc_room'].includes(filter) }))));
  json('definitions.json', definitions);
  const results: Row[] = [], monthly: Row[] = [];
  for (const g of gs) for (const e of c.exits) for (const lag of c.featureLags) for (const w of windows) for (const delay of c.delays)
    for (const targetFirst of e.tpPct === null ? [false] : [false, true]) {
      const baseline = baselines.get([g.id, e.id, w.id, delay, targetFirst].join('|'))!, runs = new Map<string, ReturnType<typeof runCap>>();
      for (const filter of c.filters) {
        const selected = new Set(contexts.filter(x => x.group === g.id && x.lag === lag && passes(x, filter)).map(x => x.id));
        const actions = g.signals.filter(s => selected.has(s.id)).map(({ id, at, side }) => ({ id, at, side }));
        const o = options(w, delay, targetFirst), run = filter === 'baseline' ? baseline : runCap(cs, actions, o, c.capHours, e.tpPct, e.slPct);
        runs.set(filter, run);
        const id = `${g.id}__${e.id}__${filter}`, journal = `${id}-${lag}-${w.id}-${delay}-${targetFirst ? 'target' : 'stop'}.json.gz`;
        const attr = attribution(baseline, run, new Set(g.signals.filter(s => !selected.has(s.id)).map(s => s.id)));
        gz(journal, { options: o, ...run, attribution: attr });
        const r: Row = { id, parent: `${g.id}__${e.id}__baseline`, group: g.id, side: g.side, filter, lag, tpPct: e.tpPct, slPct: e.slPct,
          capHours: c.capHours, window: w.id, delay, targetFirst, ...run.stats, ...exitStats(run), ...holdingStats(run, w.end),
          stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * c.extraCostBpsPerSide / 10000,
          baselineWins: baseline.stats.wins, baselineLosses: baseline.stats.losses,
          baselineWinningDollars: baseline.stats.winningDollars, baselineLosingDollars: baseline.stats.losingDollars,
          worstMonth: Math.min(...run.monthly.map(m => m.markedNet)), journal, opportunities: actions.filter(s => s.at >= w.start && s.at < w.end).length };
        for (const ref of ['baseline', 'ready', 'cmf_aligned', 'npoc_room']) {
          const b = runs.get(ref); if (!b) continue;
          r[ref + 'Net'] = b.stats.net; r[ref + 'Dd'] = b.stats.maxAdverseDrawdownPct; r[ref + 'Delta'] = run.stats.net - b.stats.net;
          r[ref + 'WorstMonthDelta'] = Math.min(...run.monthly.map(m => m.markedNet - b.monthly.find(x => x.month === m.month)!.markedNet));
        }
        r.deltaNet = r.baselineDelta; r.worstMonthDelta = r.baselineWorstMonthDelta;
        results.push(r);
        monthly.push(...run.monthly.map(m => ({ id, group: g.id, filter, lag, window: w.id, delay, targetFirst, ...m,
          baselineNet: baseline.monthly.find(x => x.month === m.month)!.markedNet,
          baselineDelta: m.markedNet - baseline.monthly.find(x => x.month === m.month)!.markedNet })));
      }
    }
  const rankings = definitions.filter(d => d.filter !== 'baseline').map(d => {
    const check = (lags: number[]) => {
      const rows = results.filter(r => r.id === d.id && lags.includes(r.lag) && !r.targetFirst), failures: string[] = [];
      if (rows.some(r => r.net <= 0)) failures.push('nonpositive_partition');
      if (rows.some(r => r.stressNet <= 0)) failures.push('cost_stress');
      if (rows.some(r => r.trades < (r.window === 'full' ? 30 : 10))) failures.push('sample');
      if (rows.some(r => r.bankrupt)) failures.push('equity');
      if (rows.some(r => r.worstMonth < -250)) failures.push('monthly_cash');
      for (const ref of ['baseline', ...(d.filter === 'ready' ? [] : ['ready']), ...(d.filter === 'cmf_npoc_room' ? ['cmf_aligned', 'npoc_room'] : [])]) {
        if (rows.some(r => r[ref + 'Delta'] <= 0)) failures.push(ref + '_net');
        if (rows.some(r => r.maxAdverseDrawdownPct > r[ref + 'Dd'] + 1e-8)) failures.push(ref + '_dd');
        if (rows.some(r => r[ref + 'WorstMonthDelta'] < -250)) failures.push(ref + '_monthly');
      }
      return { pass: failures.length === 0, failures };
    };
    const full = results.find(r => r.id === d.id && r.lag === 60000 && r.window === 'full' && !r.delay && !r.targetFirst)!;
    return { ...d, primaryScreen: check([60000]), survivalScreen: check(c.featureLags), full };
  }).sort((a, b) => b.full.baselineDelta - a.full.baselineDelta);
  json('results.json', results); json('ranking.json', rankings);
  fs.writeFileSync(path.join(dir, 'results.csv'), csv(results)); fs.writeFileSync(path.join(dir, 'monthly.csv'), csv(monthly));
  let review = '# LC01 — verification pending\n\nIndependent $10k accounts; do not sum. Before funding; no untouched holdout or queue certainty. No known NPOC veto is not proof of safe travel.\n\n';
  review += `32 primary / 16 diagnostic definitions; ${rankings.filter(r => r.primary && r.survivalScreen.pass).length} primary survival qualifiers. Ranked by full-period delta, not a new search.\n\n`;
  review += '|Definition|W/L (baseline)|Win$/Loss$ (baseline)|Net$|Baseline net$|DD% / baseline|Primary / survival|\n|---|---:|---:|---:|---:|---:|---|\n';
  for (const r of rankings) { const x = r.full; review += `|${r.id}|${x.wins}/${x.losses} (${x.baselineWins}/${x.baselineLosses})|${x.winningDollars.toFixed(0)}/${x.losingDollars.toFixed(0)} (${x.baselineWinningDollars.toFixed(0)}/${x.baselineLosingDollars.toFixed(0)})|${x.net.toFixed(0)}|${x.baselineNet.toFixed(0)}|${x.maxAdverseDrawdownPct.toFixed(2)}/${x.baselineDd.toFixed(2)}|${r.primaryScreen.pass}/${r.survivalScreen.pass}|\n`; }
  for (const r of rankings.filter(r => r.primary).slice(0, 5)) {
    const b = results.find(x => x.id === r.full.parent && x.lag === 60000 && x.window === 'full' && !x.delay && !x.targetFirst)!;
    review += `\n## ${r.id}\n\nBaseline W/L ${b.wins}/${b.losses}, win/loss dollars ${b.winningDollars.toFixed(0)}/${b.losingDollars.toFixed(0)}. Failures: ${r.survivalScreen.failures.join(', ') || 'none'}.\n\n|Month|Baseline$|Variant$|Delta$|\n|---|---:|---:|---:|\n`;
    for (const m of monthly.filter(m => m.id === r.id && m.lag === 60000 && m.window === 'full' && !m.delay && !m.targetFirst))
      review += `|${m.month}|${m.baselineNet.toFixed(0)}|${m.markedNet.toFixed(0)}|${m.baselineDelta.toFixed(0)}|\n`;
  }
  fs.writeFileSync(path.join(dir, 'review.md'), review);
  for (const p of pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, 'Changed during study ' + p.file);
  const artifacts: Row[] = []; for (const file of fs.readdirSync(dir).sort()) artifacts.push({ file, sha256: await fileHash(path.join(dir, file)) });
  json('complete.json', { key, paths: results.length, artifacts, primaryDefinitions: 32, diagnosticDefinitions: 16,
    cumulativeStandaloneBefore: c.cumulativeStandaloneBefore, cumulativeStandaloneAfter: c.cumulativeStandaloneAfter,
    cumulativeOverlays: c.cumulativeOverlays, independentVerificationRequired: true });
  atomicJson(path.join(ROOT, 'backtests/level-indicator/latest.json'), { key, directory: path.relative(ROOT, dir).replace(/\\/g, '/'), accepted: false });
  console.log('[LC01] complete, verification pending: ' + dir);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
