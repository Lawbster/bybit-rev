import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gzipSync } from 'zlib';
import { atomicJson, fileHash, sha } from './research-workflow';
import { cachedCandles, ROOT } from './level-playbook-study';
import { journal } from './level-tpsl-report';
import { exitStats } from './level-tpsl-engine';
import { runCap, holdingStats } from './poc-exit-cap-engine';
import { csv } from './poc-bounce-study';
import type { Row, Action } from './poc-indicator-bias-engine';
const CARD = 'research-inputs/poc-exit-cap-lv03-2026-09-17.json';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const canon = (x: any) => JSON.parse(JSON.stringify(x));
export async function main() {
  const c = read(CARD), parentPlan = read(c.parent + '/plan.json');
  assert(read(c.parent + '/independent-verification.json').passed);
  for (const p of parentPlan.pins.filter((p: Row) => !['bot-config.json', 'hl-short-live-config.json', 'bot-state.json'].includes(p.file)))
    assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, 'Parent source changed: ' + p.file);
  // Verify exactly the parent artifacts consumed, not unrelated groups' large journals.
  const used = ['plan.json', 'results.json', 'groups.json', c.group + '.journals.gz'];
  const seal = read(c.parent + '/complete.json');
  for (const file of used) assert.equal(await fileHash(path.resolve(ROOT, c.parent, file)), seal.artifacts.find((a: Row) => a.file === file).sha256);
  const sources = [CARD, 'scripts/poc-exit-cap-study.ts', 'scripts/poc-exit-cap-engine.ts', 'scripts/poc-exit-cap-tests.ts', 'scripts/poc-exit-cap-verify.ts',
    'scripts/poc-exit-cap-audit.ts', 'scripts/poc-exit-cap-report.ts', 'scripts/level-tpsl-engine.ts', 'scripts/level-tpsl-report.ts',
    'scripts/poc-indicator-bias-engine.ts', 'scripts/level-playbook-study.ts', 'scripts/poc-bounce-study.ts', 'scripts/research-workflow.ts',
    c.cache + '/candles.f64', c.cache + '/schema.json', ...used.map(f => c.parent + '/' + f), c.parent + '/independent-verification.json',
    'bot-config.json', 'hl-short-live-config.json', 'bot-state.json'];
  const pins: Row[] = []; for (const file of sources) pins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  const key = sha(JSON.stringify({ c, pins, node: process.version })), dir = path.join(ROOT, 'backtests/poc-exit-cap', key);
  assert(!fs.existsSync(dir), 'Immutable job exists; read it'); fs.mkdirSync(dir, { recursive: true });
  const write = (f: string, v: any) => atomicJson(path.join(dir, f), v);
  write('plan.json', { key, card: c, pins, node: process.version, createdAt: Date.now() }); console.log('[LV03] ' + dir);
  const cs = cachedCandles(c.cache), signals: Action[] = read(c.parent + '/groups.json').find((g: Row) => g.id === c.group).signals;
  write('signals.json', signals);
  const oldRows: Row[] = read(c.parent + '/results.json').filter((r: Row) => r.group === c.group);
  const windows = [{ id: 'full', start: Date.parse(c.start), end: Date.parse(c.end) },
    { id: 'older', start: Date.parse(c.start), end: Date.parse(c.split) }, { id: 'recent', start: Date.parse(c.split), end: Date.parse(c.end) }];
  const defs: Row[] = c.timedHours.map((cap: number) => ({ id: `timed${cap}`, capHours: cap, tpPct: null, slPct: null }));
  for (const cap of c.capHours) for (const tp of c.tpPct) for (const sl of c.slPct)
    defs.push({ id: `cap${cap ?? 'none'}__tp${tp}_sl${sl}`, capHours: cap, tpPct: tp, slPct: sl });
  // All archived controls must pass before new economic definitions are run.
  defs.sort((a, b) => Number(b.capHours === 12) - Number(a.capHours === 12));
  write('definitions.json', defs); const rows: Row[] = [], months: Row[] = [], refs = new Map<string, any>(); let parity = 0;
  for (const def of defs) {
    for (const w of windows) for (const delay of c.delays) {
      const oldId = c.group + (def.tpPct === null ? '__timed' : `__tp${def.tpPct}_sl${def.slPct}`);
      const rk = `${oldId}:${w.id}:${delay}`; let ref = refs.get(rk);
      if (!ref) { const row = oldRows.find(r => r.id === oldId && r.window === w.id && r.delay === delay && !r.targetFirst)!;
        const run = journal(c.parent, row); ref = { row, monthly: run.monthly }; refs.set(rk, ref); }
      const o = { start: w.start, end: w.end, delay, notional: c.notional, equity: c.equity, fee: c.fee, targetFirst: false };
      let primary: ReturnType<typeof runCap> | undefined, primaryFile = '';
      for (const targetFirst of def.tpPct === null ? [false] : [false, true]) {
        const reused = targetFirst && primary!.stats.ambiguous === 0;
        const run = reused ? primary! : runCap(cs, signals, { ...o, targetFirst }, def.capHours, def.tpPct, def.slPct);
        if (!targetFirst) primary = run;
        if (def.capHours === 12) {
          const old = journal(c.parent, oldRows.find(r => r.id === oldId && r.window === w.id && r.delay === delay && r.targetFirst === targetFirst)!);
          for (const f of ['stats', 'trades', 'accepted', 'monthly', 'open', 'curve']) assert.deepEqual(canon((run as Row)[f]), old[f], oldId + '/' + f);
          parity++;
        } else assert.equal(parity, 594, 'All controls before new cap economics');
        const file = reused ? primaryFile : `${def.id}-${w.id}-${delay}-${targetFirst ? 'target' : 'stop'}.json.gz`;
        if (!reused) fs.writeFileSync(path.join(dir, file), gzipSync(JSON.stringify({ options: { ...o, targetFirst, capHours: def.capHours }, ...run }), { level: 1 }), { flag: 'wx' });
        if (!targetFirst) primaryFile = file;
        const row = { ...def, window: w.id, delay, targetFirst, ...run.stats, ...exitStats(run), ...holdingStats(run, w.end),
          stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * c.extraCostBpsPerSide / 10000,
          reference12Net: ref.row.net, reference12Dd: ref.row.maxAdverseDrawdownPct, delta12: run.stats.net - ref.row.net,
          worstMonth: Math.min(...run.monthly.map(m => m.markedNet)),
          worstMonthDelta12: Math.min(...run.monthly.map(m => m.markedNet - ref.monthly.find((b: Row) => b.month === m.month).markedNet)), journal: file };
        rows.push(row);
        months.push(...run.monthly.map(m => ({ id: def.id, window: w.id, delay, targetFirst, ...m,
          reference12Net: ref.monthly.find((b: Row) => b.month === m.month).markedNet,
          delta12: m.markedNet - ref.monthly.find((b: Row) => b.month === m.month).markedNet })));
      }
    }
    if (defs.indexOf(def) % 10 === 0 || def === defs.at(-1)) console.log(`[LV03] ${defs.indexOf(def) + 1}/${defs.length} definitions, ${rows.length} paths`);
  }
  assert.equal(parity, 594); assert.equal(rows.length, 1776);
  const ranks = defs.map(d => { const rs = rows.filter(r => r.id === d.id && !r.targetFirst), failures: string[] = [], relative: string[] = [];
    if (rs.some(r => r.net <= 0)) failures.push('nonpositive_partition');
    if (rs.some(r => r.stressNet <= 0)) failures.push('cost_stress');
    if (rs.some(r => r.trades < (r.window === 'full' ? 30 : 10))) failures.push('sample');
    if (rs.some(r => r.bankrupt)) failures.push('equity');
    if (rs.some(r => r.worstMonth < -250)) failures.push('monthly_vs_cash');
    if (rs.some(r => r.delta12 <= 0)) relative.push('net_regression');
    if (rs.some(r => r.maxAdverseDrawdownPct > r.reference12Dd + 1e-8)) relative.push('dd_regression');
    if (rs.some(r => r.worstMonthDelta12 < -250)) relative.push('monthly_regression');
    return { ...d, pass: !failures.length, failures, relativeFailures: relative, passesRelative: !failures.length && !relative.length,
      full: rs.find(r => r.window === 'full' && !r.delay), older: rs.find(r => r.window === 'older' && !r.delay), recent: rs.find(r => r.window === 'recent' && !r.delay) }; });
  write('baseline-parity.json', { passed: true, paths: parity, originalTimedNet: rows.find(r => r.id === 'timed12' && r.window === 'full' && !r.delay)!.net });
  write('results.json', rows); write('ranking.json', ranks.sort((a, b) => b.full!.net - a.full!.net));
  fs.writeFileSync(path.join(dir, 'results.csv'), csv(rows)); fs.writeFileSync(path.join(dir, 'monthly.csv'), csv(months));
  for (const p of pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, 'Changed during run:' + p.file);
  const artifacts: Row[] = []; for (const file of fs.readdirSync(dir).sort()) artifacts.push({ file, sha256: await fileHash(path.join(dir, file)) });
  write('complete.json', { key, paths: rows.length, definitions: defs.length, newDefinitions: 99, artifacts, independentVerificationRequired: true });
  atomicJson(path.join(ROOT, 'backtests/poc-exit-cap/latest.json'), { key, directory: path.relative(ROOT, dir).replace(/\\/g, '/'), accepted: false });
  console.log('[LV03] complete; independent verification pending');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
