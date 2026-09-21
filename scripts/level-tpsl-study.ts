import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gzipSync } from 'zlib';
import { fileHash, sha, atomicJson } from './research-workflow';
import { cachedCandles, ROOT } from './level-playbook-study';
import { replay, type Action, type Row } from './poc-indicator-bias-engine';
import { runSchedule } from './poc-bounce-engine';
import { runPercent, exitStats, type Options } from './level-tpsl-engine';
import { csv } from './poc-bounce-study';
export const CARD = 'research-inputs/level-tpsl-lv02-2026-09-17.json';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const H = 3600000;
async function seal(dir: string) {
  const s = read(dir + '/complete.json');
  for (const x of s.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, x.file)), x.sha256, dir + '/' + x.file);
}
export interface Group { id: string; entry: string; side: 1 | -1; signals: Action[] }
export function groups(c: Row): Group[] {
  const raw = read(c.parent + '/signals.json').signals, defs = read(c.parent + '/definitions.json');
  const out: Group[] = defs.flatMap((d: Row) => [1, -1].map(side => ({ id: d.id + (side === 1 ? '__long' : '__short'), entry: d.id, side,
    signals: raw[d.id].filter((s: Action) => s.side === side).map((s: Action) => ({ id: s.id, at: s.at, side })) })));
  out.push({ id: 'pb02_daily_naked_touch__long', entry: 'pb02_daily_naked_touch', side: 1,
    signals: read(c.pocParent + '/signals.json').map((s: Row) => ({ id: s.id, at: s.signalAt, side: 1 })) });
  return out;
}
export async function main() {
  const c = read(CARD), gs = groups(c); assert.equal(gs.length, c.entryGroups);
  const sources = [CARD, 'scripts/level-tpsl-study.ts', 'scripts/level-tpsl-engine.ts', 'scripts/level-tpsl-tests.ts', 'scripts/level-tpsl-verify.ts',
    'scripts/poc-indicator-bias-engine.ts', 'scripts/poc-bounce-engine.ts', 'scripts/level-playbook-study.ts', 'scripts/research-workflow.ts', 'scripts/poc-bounce-study.ts',
    c.cache + '/complete.json', c.cache + '/candles.f64', c.cache + '/schema.json',
    c.parent + '/complete.json', c.parent + '/independent-verification.json', c.parent + '/signals.json', c.parent + '/definitions.json',
    c.pocParent + '/complete.json', c.pocParent + '/signals.json', 'bot-config.json', 'hl-short-live-config.json', 'bot-state.json'];
  const pins: Row[] = []; for (const file of sources) pins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  const key = sha(JSON.stringify({ c, pins, node: process.version })), dir = path.join(ROOT, 'backtests/level-tpsl', key);
  assert(!fs.existsSync(dir), 'Immutable job already exists; reuse it'); fs.mkdirSync(dir, { recursive: true });
  const write = (f: string, v: any) => atomicJson(path.join(dir, f), v);
  write('plan.json', { key, card: c, pins, createdAt: Date.now(), node: process.version });
  console.log('[LV02] ' + dir);
  await seal(c.parent); await seal(c.pocParent); await seal(c.cache); assert(read(c.parent + '/independent-verification.json').passed);
  const cs = cachedCandles(c.cache), start = Date.parse(c.start), end = Date.parse(c.end), split = Date.parse(c.split);
  const windows = [{ id: 'full', start, end }, { id: 'older', start, end: split }, { id: 'recent', start: split, end }];
  const opts = (w: Row, delay: number): Options => ({ start: w.start, end: w.end, delay, hold: c.holdHours * H,
    notional: c.notional, equity: c.equity, fee: c.fee, targetFirst: false });
  const raw = read(c.parent + '/signals.json').signals, defs = read(c.parent + '/definitions.json');
  let parity = 0;
  for (const d of defs) for (const w of windows) for (const delay of c.extraExecutionDelaysMs) {
    const old = read(`${c.parent}/${d.id}__timed-${w.id}-${delay}-primary.json`), got = replay(cs, raw[d.id], opts(w, delay));
    // Stored JSON canonically encodes IEEE -0 as 0. Compare the identical
    // serialization, without rounding or tolerances for other values.
    for (const f of ['stats', 'trades', 'accepted', 'monthly', 'open', 'curve']) assert.deepEqual(JSON.parse(JSON.stringify((got as Row)[f])), old[f], d.id + '/' + f);
    parity++;
  }
  const poc = gs.at(-1)!.signals;
  for (const w of windows) for (const delay of c.extraExecutionDelaysMs) {
    const old = read(`${c.pocParent}/${w.id}-${delay}-hold12.json`), o = opts(w, delay);
    const canonical = runSchedule(cs, poc.map(({ id, at }) => ({ id, at })), o), got = replay(cs, poc, o);
    for (const f of ['trades', 'open', 'stats', 'monthly', 'accepted']) assert.deepEqual((canonical as Row)[f], old[f]);
    for (const [f, v] of Object.entries(old.stats)) assert.deepEqual((got.stats as Row)[f], v);
    assert.deepEqual(got.monthly, old.monthly); assert.deepEqual(got.accepted, old.accepted); parity++;
  }
  write('baseline-parity.json', { passed: true, paths: parity, lv01Timed: 192, pb02: 6, mapsRebuilt: false, signalsRebuilt: false });
  console.log('[LV02] exact baseline parity: ' + parity + ' paths; saved candles/signals reused');
  write('groups.json', gs);
  const summary: Row[] = [], rankings: Row[] = [];
  const monthFd = fs.openSync(path.join(dir, 'monthly.csv'), 'wx'); let monthHeader = true;
  let paths = 0;
  for (const g of gs) {
    const jf = `${g.id}.journals.gz`, fd = fs.openSync(path.join(dir, jf), 'wx'); let offset = 0;
    const persist = (run: ReturnType<typeof replay>, options: Options) => {
      const bytes = gzipSync(JSON.stringify({ options, ...run }) + '\n', { level: 1 }), at = offset;
      let used = 0; while (used < bytes.length) used += fs.writeSync(fd, bytes, used, bytes.length - used); offset += bytes.length;
      return { journal: jf, journalOffset: at, journalBytes: bytes.length };
    };
    const timed = new Map<string, ReturnType<typeof replay>>(), reference = new Map<string, ReturnType<typeof replay>>();
    const groupRows: Row[] = [];
    const record = (run: ReturnType<typeof replay>, w: Row, delay: number, tp: number | null, sl: number | null, tf: boolean, journal: Row) => {
      const id = g.id + (tp === null ? '__timed' : `__tp${tp}_sl${sl}`), own = timed.get(w.id + ':' + delay) ?? run;
      const two = reference.get(w.id + ':' + delay) ?? run;
      const ownDelta = (m: Row) => m.markedNet - own.monthly.find(x => x.month === m.month)!.markedNet;
      const twoDelta = (m: Row) => m.markedNet - two.monthly.find(x => x.month === m.month)!.markedNet;
      const row = { id, group: g.id, entry: g.entry, side: g.side, tpPct: tp, slPct: sl, window: w.id, delay, targetFirst: tf,
        ...run.stats, ...exitStats(run), stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * c.extraCostBpsPerSide / 10000,
        timedNet: own.stats.net, timedDd: own.stats.maxAdverseDrawdownPct, deltaTimed: run.stats.net - own.stats.net,
        reference22Net: tp === null ? null : two.stats.net, reference22Dd: tp === null ? null : two.stats.maxAdverseDrawdownPct,
        delta22: tp === null ? null : run.stats.net - two.stats.net,
        worstMonth: Math.min(...run.monthly.map(m => m.markedNet)), worstMonthDeltaTimed: Math.min(...run.monthly.map(ownDelta)),
        worstMonthDelta22: tp === null ? null : Math.min(...run.monthly.map(twoDelta)), ...journal };
      summary.push(row); groupRows.push(row); paths++;
      const lines = run.monthly.map(m => ({ id, group: g.id, side: g.side, tpPct: tp, slPct: sl, window: w.id, delay, targetFirst: tf,
        ...m, timedNet: own.monthly.find(x => x.month === m.month)!.markedNet, deltaTimed: ownDelta(m),
        reference22Net: tp === null ? null : two.monthly.find(x => x.month === m.month)!.markedNet, delta22: tp === null ? null : twoDelta(m) }));
      const text = csv(lines), nl = text.indexOf('\n'); fs.writeSync(monthFd, monthHeader ? text : text.slice(nl + 1)); monthHeader = false;
    };
    for (const w of windows) for (const delay of c.extraExecutionDelaysMs) {
      const o = opts(w, delay), run = replay(cs, g.signals, o); timed.set(w.id + ':' + delay, run);
      record(run, w, delay, null, null, false, persist(run, o));
    }
    for (const tp of c.tpPct) for (const sl of c.slPct) for (const w of windows) for (const delay of c.extraExecutionDelaysMs) {
      const o = opts(w, delay), run = runPercent(cs, g.signals, o, tp, sl), journal = persist(run, o);
      if (tp === 2 && sl === 2) reference.set(w.id + ':' + delay, run);
      record(run, w, delay, tp, sl, false, journal);
      // If the stop-first ownership path never encounters both barriers in a
      // minute, target-first cannot diverge. Reuse bytes, not invented evidence.
      if (!run.stats.ambiguous) record(run, w, delay, tp, sl, true, journal);
      else { const alt = runPercent(cs, g.signals, { ...o, targetFirst: true }, tp, sl);
        record(alt, w, delay, tp, sl, true, persist(alt, { ...o, targetFirst: true })); }
    }
    fs.closeSync(fd);
    for (const id of [...new Set(groupRows.map(x => x.id))]) {
      const rows = groupRows.filter(x => x.id === id && !x.targetFirst), full = rows.find(r => r.window === 'full' && !r.delay)!;
      const failures: string[] = [], relativeFailures: string[] = [];
      if (rows.some(r => r.net <= 0)) failures.push('nonpositive_partition');
      if (rows.some(r => r.stressNet <= 0)) failures.push('cost_stress');
      if (rows.some(r => r.trades < (r.window === 'full' ? 30 : 10))) failures.push('sample');
      if (rows.some(r => r.bankrupt)) failures.push('equity');
      if (rows.some(r => r.worstMonth < -250)) failures.push('monthly_vs_cash');
      if (full.tpPct !== null) {
        if (rows.some(r => r.delta22 <= 0)) relativeFailures.push('reference_net_regression');
        if (rows.some(r => r.maxAdverseDrawdownPct > r.reference22Dd + 1e-8)) relativeFailures.push('reference_dd_regression');
        if (rows.some(r => r.worstMonthDelta22 < -250)) relativeFailures.push('reference_monthly_regression');
      }
      rankings.push({ id, group: g.id, side: g.side, tpPct: full.tpPct, slPct: full.slPct,
        pass: !failures.length, failures, relativeFailures, passesRelative: full.tpPct !== null && !failures.length && !relativeFailures.length,
        full, older: rows.find(r => r.window === 'older' && !r.delay), recent: rows.find(r => r.window === 'recent' && !r.delay),
        fullDelayed: rows.find(r => r.window === 'full' && r.delay), recentDelayed: rows.find(r => r.window === 'recent' && r.delay) });
    }
    const best = groupRows.filter(r => r.window === 'full' && !r.delay && !r.targetFirst && r.tpPct !== null).sort((a, b) => b.net - a.net)[0];
    console.log(`[LV02 ${gs.indexOf(g) + 1}/65] ${g.id}: best grid ${best.tpPct}/${best.slPct} $${best.net.toFixed(0)}; ${paths} paths saved`);
  }
  fs.closeSync(monthFd);
  write('results.json', summary); write('ranking.json', rankings.sort((a, b) => b.full.net - a.full.net));
  fs.writeFileSync(path.join(dir, 'results.csv'), csv(summary));
  for (const p of pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, 'Changed during job: ' + p.file);
  const artifacts: Row[] = []; for (const file of fs.readdirSync(dir).sort()) artifacts.push({ file, sha256: await fileHash(path.join(dir, file)) });
  write('complete.json', { key, paths, artifacts, gridDefinitions: 3185, newTimedDefinitions: 64, independentVerificationRequired: true });
  atomicJson(path.join(ROOT, 'backtests/level-tpsl/latest.json'), { key, directory: path.relative(ROOT, dir).replace(/\\/g, '/'), accepted: false });
  console.log('[LV02] complete; verification pending');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
