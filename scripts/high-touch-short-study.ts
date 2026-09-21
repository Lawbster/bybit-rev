import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gzipSync } from 'zlib';
import { atomicJson, fileHash, sha } from './research-workflow';
import { cachedCandles, ROOT } from './level-playbook-study';
import { journal } from './level-tpsl-report';
import { exitStats } from './level-tpsl-engine';
import { runCap, holdingStats } from './poc-exit-cap-engine';
import { highSignals } from './high-touch-short-signals';
import { csv } from './poc-bounce-study';
import type { Row } from './poc-indicator-bias-engine';
const CARD = 'research-inputs/high-touch-short-ht01-2026-09-17.json';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
export async function main() {
  const c = read(CARD), parent = read(c.parent + '/plan.json'); assert(read(c.parent + '/independent-verification.json').passed);
  const protectedFiles = ['bot-config.json', 'hl-short-live-config.json', 'bot-state.json'];
  for (const p of parent.pins.filter((p: Row) => !protectedFiles.includes(p.file))) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
  const consumed = ['results.json', 'groups.json', 'pdOpen_retest__short.journals.gz'];
  const oldSeal = read(c.parent + '/complete.json');
  for (const file of consumed) assert.equal(await fileHash(path.resolve(ROOT, c.parent, file)), oldSeal.artifacts.find((p: Row) => p.file === file).sha256);
  const sources = [CARD, 'scripts/high-touch-short-study.ts', 'scripts/high-touch-short-signals.ts', 'scripts/high-touch-short-tests.ts',
    'scripts/high-touch-short-verify.ts', 'scripts/high-touch-short-audit.ts', 'scripts/high-touch-short-report.ts',
    'scripts/level-tpsl-engine.ts', 'scripts/poc-exit-cap-engine.ts', 'scripts/poc-indicator-bias-engine.ts', 'scripts/level-playbook-study.ts',
    'scripts/level-tpsl-report.ts', 'scripts/poc-bounce-study.ts', 'scripts/research-workflow.ts', 'src/bot/aggressive10-policy.ts',
    c.cache + '/candles.f64', c.cache + '/schema.json', c.parent + '/complete.json', c.parent + '/independent-verification.json',
    ...consumed.map(f => c.parent + '/' + f), ...protectedFiles];
  const pins: Row[] = []; for (const file of sources) pins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  const key = sha(JSON.stringify({ c, pins, node: process.version })), dir = path.join(ROOT, 'backtests/high-touch-short', key);
  assert(!fs.existsSync(dir), 'Immutable job already exists'); fs.mkdirSync(dir, { recursive: true });
  const write = (f: string, v: any) => atomicJson(path.join(dir, f), v);
  write('plan.json', { key, card: c, pins, node: process.version, createdAt: Date.now() }); console.log('[HT01] ' + dir);
  const cs = cachedCandles(c.cache), windows = [{ id: 'full', start: Date.parse(c.start), end: Date.parse(c.end) },
    { id: 'older', start: Date.parse(c.start), end: Date.parse(c.split) }, { id: 'recent', start: Date.parse(c.split), end: Date.parse(c.end) }];
  const options = (w: Row, delay: number, targetFirst = false) => ({ start: w.start, end: w.end, delay, targetFirst,
    notional: c.notional, equity: c.equity, fee: c.fee });
  const oldRows: Row[] = read(c.parent + '/results.json');
  const control = read(c.parent + '/groups.json').find((g: Row) => g.id === 'pdOpen_retest__short'); let parity = 0;
  for (const pair of [[null, null], [2, 2], [3, 5]]) for (const w of windows) for (const delay of c.delays)
    for (const targetFirst of pair[0] === null ? [false] : [false, true]) {
      const id = control.id + (pair[0] === null ? '__timed' : `__tp${pair[0]}_sl${pair[1]}`);
      const old = journal(c.parent, oldRows.find(r => r.id === id && r.window === w.id && r.delay === delay && r.targetFirst === targetFirst)!);
      const got = runCap(cs, control.signals, options(w, delay, targetFirst), 12, pair[0], pair[1]);
      for (const k of ['stats', 'trades', 'accepted', 'monthly', 'open', 'curve']) assert.deepEqual(JSON.parse(JSON.stringify((got as Row)[k])), old[k], id + '/' + k); parity++;
    }
  assert.equal(parity, 30); write('baseline-parity.json', { passed: true, paths: parity, control: control.id, note: 'Engine regression controls, not strategy baseline' });
  const built = highSignals(cs, c.windowMinutes);
  fs.writeFileSync(path.join(dir, 'rolling-high.f64'), Buffer.from(built.rolling.buffer));
  write('groups.json', built.groups); write('signal-summary.json', built.groups.map(g => ({ id: g.id, rawSignals: g.signals.length, episodes: g.episodes,
    first: g.signals[0]?.at, last: g.signals.at(-1)?.at })));
  const rows: Row[] = [], months: Row[] = [], ranks: Row[] = [];
  for (const g of built.groups) {
    const defs = [{ id: g.id + '__timed', tpPct: null as number | null, slPct: null as number | null },
      ...c.tpPct.flatMap((tp: number) => c.slPct.map((sl: number) => ({ id: `${g.id}__tp${tp}_sl${sl}`, tpPct: tp, slPct: sl })))];
    const refs = new Map<string, any>(), twoRefs = new Map<string, any>();
    for (const def of defs) for (const w of windows) for (const delay of c.delays) {
      let primary: ReturnType<typeof runCap> | undefined, primaryFile = '';
      for (const targetFirst of def.tpPct === null ? [false] : [false, true]) {
        const reused = targetFirst && primary!.stats.ambiguous === 0;
        const run = reused ? primary! : runCap(cs, g.signals, options(w, delay, targetFirst), 12, def.tpPct, def.slPct);
        if (!targetFirst) primary = run;
        const k = `${w.id}:${delay}`;
        if (def.tpPct === null) refs.set(k, { stats: run.stats, monthly: run.monthly });
        if (def.tpPct === 2 && def.slPct === 2 && !targetFirst) twoRefs.set(k, { stats: run.stats, monthly: run.monthly });
        const b = refs.get(k), two = twoRefs.get(k), file = reused ? primaryFile : `${def.id}-${w.id}-${delay}-${targetFirst ? 'target' : 'stop'}.json.gz`;
        if (!reused) fs.writeFileSync(path.join(dir, file), gzipSync(JSON.stringify({ options: { ...options(w, delay, targetFirst), capHours: 12 }, ...run }), { level: 1 }), { flag: 'wx' });
        if (!targetFirst) primaryFile = file;
        const r = { ...def, group: g.id, capHours: 12, window: w.id, delay, targetFirst, ...run.stats, ...exitStats(run), ...holdingStats(run, w.end),
          stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * c.extraCostBpsPerSide / 10000,
          timedNet: b.stats.net, timedDd: b.stats.maxAdverseDrawdownPct, deltaTimed: run.stats.net - b.stats.net,
          reference22Net: def.tpPct === null ? null : two.stats.net, delta22: def.tpPct === null ? null : run.stats.net - two.stats.net,
          worstMonth: Math.min(...run.monthly.map(m => m.markedNet)), worstMonthDeltaTimed: Math.min(...run.monthly.map(m => m.markedNet - b.monthly.find((x: Row) => x.month === m.month).markedNet)), journal: file };
        rows.push(r); months.push(...run.monthly.map(m => ({ id: def.id, group: g.id, window: w.id, delay, targetFirst, ...m,
          timedNet: b.monthly.find((x: Row) => x.month === m.month).markedNet, deltaTimed: m.markedNet - b.monthly.find((x: Row) => x.month === m.month).markedNet })));
      }
    }
    for (const def of defs) { const rs = rows.filter(r => r.id === def.id && !r.targetFirst), failures: string[] = [], relative: string[] = [];
      if (rs.some(r => r.net <= 0)) failures.push('nonpositive_partition'); if (rs.some(r => r.stressNet <= 0)) failures.push('cost_stress');
      if (rs.some(r => r.trades < (r.window === 'full' ? 30 : 10))) failures.push('sample'); if (rs.some(r => r.bankrupt)) failures.push('equity');
      if (rs.some(r => r.worstMonth < -250)) failures.push('monthly_vs_cash');
      if (rs.some(r => r.deltaTimed <= 0)) relative.push('timed_net_regression'); if (rs.some(r => r.maxAdverseDrawdownPct > r.timedDd + 1e-8)) relative.push('timed_dd_regression');
      if (rs.some(r => r.worstMonthDeltaTimed < -250)) relative.push('timed_monthly_regression');
      ranks.push({ ...def, group: g.id, failures, relativeFailures: relative, pass: !failures.length,
        passesRelative: def.tpPct !== null && !failures.length && !relative.length,
        full: rs.find(r => r.window === 'full' && !r.delay), older: rs.find(r => r.window === 'older' && !r.delay), recent: rs.find(r => r.window === 'recent' && !r.delay) });
    }
    console.log(`[HT01] ${g.id}: ${g.signals.length} raw minutes/${g.episodes} episodes; ${rows.length} paths saved`);
  }
  assert.equal(rows.length, 1188); write('results.json', rows); write('ranking.json', ranks.sort((a, b) => b.full.net - a.full.net));
  fs.writeFileSync(path.join(dir, 'results.csv'), csv(rows)); fs.writeFileSync(path.join(dir, 'monthly.csv'), csv(months));
  for (const p of pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
  const artifacts: Row[] = []; for (const file of fs.readdirSync(dir).sort()) artifacts.push({ file, sha256: await fileHash(path.join(dir, file)) });
  write('complete.json', { key, paths: rows.length, newDefinitions: 100, artifacts, independentVerificationRequired: true });
  atomicJson(path.join(ROOT, 'backtests/high-touch-short/latest.json'), { key, directory: path.relative(ROOT, dir).replace(/\\/g, '/'), accepted: false });
  console.log('[HT01] complete; independent verification pending');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
