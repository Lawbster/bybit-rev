/** HT03 economics runner.  Deliberately does not execute during review. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gzipSync, gunzipSync } from 'zlib';
import { atomicJson, fileHash, sha } from './research-workflow';
import { cachedCandles, ROOT } from './level-playbook-study';
import { runCap, holdingStats } from './poc-exit-cap-engine';
import { exitStats } from './level-tpsl-engine';
import { buildRejectionGroups } from './high-touch-rejection-signals';
import { csv } from './poc-bounce-study';
import type { Row } from './poc-indicator-bias-engine';

const CARD = 'research-inputs/high-touch-rejection-ht03-2026-09-18.json';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const keys = ['stats', 'trades', 'accepted', 'monthly', 'open', 'curve'];
const k = (t: Row) => JSON.stringify([t.id, t.entryAt]);
const EPS = 1e-8;
const cohort = (xs: Row[]) => ({ count: xs.length, wins: xs.filter(x => x.net > EPS).length, losses: xs.filter(x => x.net < -EPS).length,
  winningDollars: xs.filter(x => x.net > EPS).reduce((s, x) => s + x.net, 0), losingDollars: xs.filter(x => x.net < -EPS).reduce((s, x) => s + x.net, 0), net: xs.reduce((s, x) => s + x.net, 0) });
/** Identity is receipt anchor plus actual fill time: an ID-only comparison is invalid for delayed paths. */
export function rejectionAttribution(base: Row, run: Row) {
  const b = new Map(base.trades.map((x: Row) => [k(x), x])), r = new Map(run.trades.map((x: Row) => [k(x), x]));
  for (const [receipt, trade] of b) if (r.has(receipt)) assert.deepEqual(r.get(receipt), trade, `shared receipt drift ${receipt}`);
  const removed = base.trades.filter((x: Row) => !r.has(k(x))), added = run.trades.filter((x: Row) => !b.has(k(x)));
  const removedIds = new Set(removed.map((x: Row) => x.id));
  const openDelta = (run.open?.net ?? 0) - (base.open?.net ?? 0), delta = cohort(added).net - cohort(removed).net + openDelta;
  const two = removed.map((x: Row) => x.net).filter((x: number) => x < -EPS).sort((a: number, b: number) => a - b).slice(0, 2).reduce((s: number, x: number) => s + x, 0);
  return { shared: [...b.keys()].filter(x => r.has(x)).length, removed: cohort(removed), added: cohort(added),
    changedTimeSameAnchor: added.filter((x: Row) => removedIds.has(x.id)).length, openDelta, delta, deltaWithoutTwoLargestAvoidedLosses: delta + two };
}
export async function main() {
  const c = read(CARD), pp = read(c.parent + '/plan.json'), seal = read(c.parent + '/complete.json'), verification = read(c.parent + '/independent-verification.json');
  assert.equal(seal.key, pp.key, 'parent seal key'); assert.equal(verification.key, pp.key, 'parent verification key'); assert(verification.passed, 'HT01 parent is not accepted');
  const protectedFiles = ['bot-config.json', 'hl-short-live-config.json', 'bot-state.json'];
  for (const p of pp.pins.filter((x: Row) => !protectedFiles.includes(x.file))) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
  const oldRows: Row[] = read(c.parent + '/results.json'), parentRows = oldRows.filter(x => c.parents.includes(x.id) && x.tpPct !== null);
  assert.equal(parentRows.length, 36, 'expected every archived HT01 parent path');
  const consumed = ['groups.json', 'results.json', 'ranking.json', ...parentRows.map(x => x.journal)];
  for (const file of consumed) { const a = seal.artifacts.find((x: Row) => x.file === file); assert(a, `unsealed ${file}`); assert.equal(await fileHash(path.resolve(ROOT, c.parent, file)), a.sha256, file); }
  const inherited = pp.pins.filter((x: Row) => !protectedFiles.includes(x.file)).map((x: Row) => x.file);
  const sources = [CARD, 'scripts/high-touch-rejection-study.ts', 'scripts/high-touch-rejection-signals.ts', 'scripts/high-touch-rejection-tests.ts', 'scripts/high-touch-rejection-verify.ts', 'scripts/high-touch-rejection-report.ts', 'scripts/high-touch-short-audit.ts', 'scripts/high-touch-short-signals.ts', 'scripts/poc-indicator-bias-engine.ts', 'scripts/poc-exit-cap-engine.ts', 'scripts/level-tpsl-engine.ts', 'scripts/level-playbook-study.ts', 'scripts/poc-bounce-study.ts', 'scripts/research-workflow.ts', c.cache + '/candles.f64', c.cache + '/schema.json', c.parent + '/plan.json', c.parent + '/complete.json', c.parent + '/independent-verification.json', ...inherited, ...consumed.map((x: string) => c.parent + '/' + x), ...protectedFiles];
  sources.push('scripts/high-touch-rejection-audit-tests.ts');
  const pins: Row[] = []; for (const file of [...new Set(sources)]) pins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  const key = sha(JSON.stringify({ c, pins, node: process.version })), dir = path.join(ROOT, 'backtests/high-touch-rejection', key);
  assert(!fs.existsSync(dir), 'Immutable job already exists'); fs.mkdirSync(dir, { recursive: true });
  const write = (f: string, v: unknown) => atomicJson(path.join(dir, f), v);
  write('plan.json', { key, card: c, pins, node: process.version, createdAt: Date.now() });
  console.log('[HT03] ' + key);
  const cs = cachedCandles(c.cache), anchors = read(c.parent + '/groups.json').find((x: Row) => x.id === 'exact_touch'); assert(anchors && Array.isArray(anchors.evidence) && anchors.evidence.length === 7475);
  const windows = [{ id: 'full', start: Date.parse(c.start), end: Date.parse(c.end) }, { id: 'older', start: Date.parse(c.start), end: Date.parse(c.split) }, { id: 'recent', start: Date.parse(c.split), end: Date.parse(c.end) }];
  const options = (w: Row, delay: number, targetFirst: boolean) => ({ start: w.start, end: w.end, delay, targetFirst, notional: c.notional, equity: c.equity, fee: c.fee });
  const baseline = new Map<string, ReturnType<typeof runCap>>(), bk = (id: string, w: string, d: number, t: boolean) => `${id}/${w}/${d}/${t}`;
  let parity = 0;
  for (const parent of c.parents) for (const w of windows) for (const delay of c.delays) for (const targetFirst of [false, true]) {
    const old = parentRows.find(x => x.id === parent && x.window === w.id && x.delay === delay && x.targetFirst === targetFirst)!;
    const archived = JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, c.parent, old.journal))).toString());
    const got = runCap(cs, anchors.signals, options(w, delay, targetFirst), c.capHours, old.tpPct, old.slPct);
    for (const field of keys) assert.deepEqual(JSON.parse(JSON.stringify((got as Row)[field])), archived[field], `${parent}/${w.id}/${delay}/${targetFirst}/${field}`);
    baseline.set(bk(parent, w.id, delay, targetFirst), got); parity++;
  }
  assert.equal(parity, 36); write('baseline-parity.json', { passed: true, paths: parity, parents: c.parents });
  console.log('[HT03] all36 exact parent controls passed');
  const groups = buildRejectionGroups(cs, anchors.evidence);
  assert.equal(groups.length, c.groups.length); assert.deepEqual(groups.map((g: Row) => ({ id: g.id, candidate: g.candidate, control: g.control })), c.groups.map((g: Row) => ({ id: g.id, candidate: g.candidate, control: g.control })));
  assert.equal(groups.filter((g: Row) => g.candidate).length * c.parents.length, c.candidateDefinitions); assert.equal(groups.filter((g: Row) => !g.candidate && g.id !== 'baseline').length * c.parents.length, c.diagnosticDefinitions);
  fs.writeFileSync(path.join(dir, 'groups.json.gz'), gzipSync(JSON.stringify(groups), { level: 1 }), { flag: 'wx' });
  const rows: Row[] = [], months: Row[] = [];
  for (const parent of c.parents) {
    const canonical = parentRows.find(x => x.id === parent)!;
    for (const g of groups) for (const w of windows) for (const delay of c.delays) for (const targetFirst of [false, true]) {
      const run = g.id === 'baseline' ? baseline.get(bk(parent, w.id, delay, targetFirst))! : runCap(cs, g.signals, options(w, delay, targetFirst), c.capHours, canonical.tpPct, canonical.slPct);
      const b: Row = baseline.get(bk(parent, w.id, delay, targetFirst))!, attr = rejectionAttribution(b, run);
      assert(Math.abs(attr.delta - (run.stats.net - b.stats.net)) < 1e-6, 'attribution reconciliation');
      const id = `${parent}__${g.id}`, journal = `${id}-${w.id}-${delay}-${targetFirst ? 'target' : 'stop'}.json.gz`;
      fs.writeFileSync(path.join(dir, journal), gzipSync(JSON.stringify({ options: { ...options(w, delay, targetFirst), capHours: c.capHours }, ...run, attribution: attr }), { level: 1 }), { flag: 'wx' });
      const bm = (m: Row) => b.monthly.find((x: Row) => x.month === m.month)!;
      rows.push({ id, group: g.id, candidate: g.candidate, control: g.control, parent, tpPct: canonical.tpPct, slPct: canonical.slPct, capHours: c.capHours, window: w.id, delay, targetFirst, ...run.stats, ...exitStats(run), ...holdingStats(run, w.end), stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * c.extraCostBpsPerSide / 10000, baselineNet: b.stats.net, baselineDd: b.stats.maxAdverseDrawdownPct, baselineWinRate: b.stats.winRate, baselineTrades: b.stats.trades, deltaNet: run.stats.net - b.stats.net, deltaWinRate: run.stats.winRate === null || b.stats.winRate === null ? null : run.stats.winRate - b.stats.winRate, worstMonth: Math.min(...run.monthly.map((m: Row) => m.markedNet)), worstMonthDelta: Math.min(...run.monthly.map((m: Row) => m.markedNet - bm(m).markedNet)), ...attr, journal });
      months.push(...run.monthly.map((m: Row) => ({ id, group: g.id, candidate: g.candidate, control: g.control, parent, window: w.id, delay, targetFirst, ...m, baselineNet: bm(m).markedNet, delta: m.markedNet - bm(m).markedNet })));
    }
  }
  assert.equal(rows.length, 360); write('results.json', rows); fs.writeFileSync(path.join(dir, 'results.csv'), csv(rows)); fs.writeFileSync(path.join(dir, 'monthly.csv'), csv(months));
  const ranking: Row[] = [];
  for (const parent of c.parents) for (const g of groups) { const rs = rows.filter(x => x.parent === parent && x.group === g.id && !x.targetFirst), fail: string[] = [], relative: string[] = [];
    if (rs.some(x => x.net <= 0)) fail.push('nonpositive_partition'); if (rs.some(x => x.stressNet <= 0)) fail.push('cost_stress'); if (rs.some(x => x.trades < (x.window === 'full' ? 30 : 10))) fail.push('sample'); if (rs.some(x => x.bankrupt)) fail.push('equity'); if (rs.some(x => x.worstMonth < -250)) fail.push('monthly_vs_cash');
    if (rs.some(x => x.deltaNet <= 0)) relative.push('net_regression'); if (rs.some(x => x.maxAdverseDrawdownPct > x.baselineDd + 1e-8)) relative.push('dd_regression'); if (rs.some(x => x.worstMonthDelta < -250)) relative.push('monthly_regression');
    ranking.push({ id: `${parent}__${g.id}`, parent, group: g.id, candidate: g.candidate, control: g.control, failures: fail, relativeFailures: relative, pass: !fail.length, relativePass: g.candidate && !fail.length && !relative.length, full: rs.find(x => x.window === 'full' && !x.delay), older: rs.find(x => x.window === 'older' && !x.delay), recent: rs.find(x => x.window === 'recent' && !x.delay) }); }
  write('ranking.json', ranking.sort((a, b) => b.full.net - a.full.net));
  for (const p of pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
  const artifacts: Row[] = []; for (const file of fs.readdirSync(dir).sort()) artifacts.push({ file, sha256: await fileHash(path.join(dir, file)) });
  write('complete.json', { key, paths: rows.length, parentParity: parity, newDefinitions: c.newDefinitions, candidateDefinitions: c.candidateDefinitions, diagnosticDefinitions: c.diagnosticDefinitions, artifacts, independentVerificationRequired: true });
  atomicJson(path.join(ROOT, 'backtests/high-touch-rejection/latest.json'), { key, directory: path.relative(ROOT, dir).replace(/\\/g, '/'), accepted: false });
  console.log('[HT03] 360 paths saved; independent verification pending');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
