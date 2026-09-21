import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import os from 'os';
import { atomicJson, fileHash, sha } from './research-workflow';
import { loadMinutes } from './relative-reversion-study';
import { runSchedule, validateTape, clockSchedule } from './poc-bounce-engine';
import { replay, amounts, type Action, type Row } from './poc-indicator-bias-engine';
import { readAcceptedMap } from './poc-pine-export';
import { buildAtlas, M, H, D, FIELDS, type Atlas } from './level-playbook-map';
import { buildSignals, DEFINITIONS } from './level-playbook-signals';
import { csv } from './poc-bounce-study';
import type { Candle } from './hype-freerun-canonical-replay';
export const ROOT = path.resolve(__dirname, '..'), CARD = 'research-inputs/level-playbook-lv01-2026-09-17.json';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
async function verifySeal(dir: string) {
  const seal = read(dir + '/complete.json');
  for (const a of seal.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, a.file)), a.sha256, a.file);
  return seal;
}
function bufferOf(xs: Float64Array) { assert.equal(os.endianness(), 'LE'); return Buffer.from(xs.buffer, xs.byteOffset, xs.byteLength); }
function floats(file: string) { const bytes = fs.readFileSync(file); const xs = new Float64Array(bytes.length / 8); Buffer.from(xs.buffer).set(bytes); return xs; }
export function cachedCandles(dir: string): Candle[] {
  const schema = read(dir + '/schema.json'), x = floats(path.resolve(ROOT, dir, 'candles.f64'));
  assert.equal(x.length, schema.rows * 6);
  return Array.from({ length: schema.rows }, (_, i) => ({ ts: schema.start + i * M, endTs: schema.start + (i + 1) * M,
    open: x[i * 6], high: x[i * 6 + 1], low: x[i * 6 + 2], close: x[i * 6 + 3], volume: x[i * 6 + 4], turnover: x[i * 6 + 5] }));
}
export function cachedAtlas(dir: string): Atlas {
  const schema = read(dir + '/schema.json'); assert.deepEqual(schema.fields, FIELDS);
  const values = floats(path.resolve(ROOT, dir, 'levels.f64')); assert.equal(values.length, schema.rows * FIELDS.length);
  return { ...schema, values, periods: read(dir + '/periods.json'), pocs: read(dir + '/pocs.json') };
}
export async function main() {
  const c = read(CARD), start = Date.parse(c.start), split = Date.parse(c.split), end = Date.parse(c.end);
  assert.equal(DEFINITIONS.length, c.definitionCount); assert.equal(c.economicDefinitionCount, 2 * DEFINITIONS.length);
  const mapFiles = ['scripts/level-playbook-map.ts', 'scripts/relative-reversion-study.ts', 'scripts/replay-candle-repair.ts',
    'scripts/poc-profile-engine.ts', 'scripts/poc-volume-source.ts', 'data/HYPEUSDT_1_full.json', 'data/HYPEUSDT_1m.jsonl', c.repair,
    c.pocMap + '/map.json', c.pocMap + '/complete.json', c.pocMap + '/independent-verification.json'];
  const sources = [...new Set([CARD, ...mapFiles, 'scripts/level-playbook-study.ts', 'scripts/level-playbook-signals.ts',
    'scripts/level-playbook-tests.ts', 'scripts/level-playbook-verify.ts', 'scripts/poc-indicator-bias-engine.ts', 'scripts/poc-bounce-engine.ts',
    'scripts/poc-pine-export.ts', 'scripts/research-workflow.ts', 'scripts/poc-bounce-study.ts', c.parent + '/plan.json',
    c.parent + '/complete.json', c.parent + '/independent-verification.json', c.parent + '/signals.json',
    'bot-config.json', 'hl-short-live-config.json', 'bot-state.json'])];
  const pins: Row[] = []; for (const file of sources) pins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  const key = sha(JSON.stringify({ c, pins, node: process.version })), out = path.join(ROOT, 'backtests/level-playbook', key);
  assert(!fs.existsSync(out), 'Immutable job exists; reuse it'); fs.mkdirSync(out, { recursive: true });
  const write = (f: string, x: any) => atomicJson(path.join(out, f), x);
  const mapKey = sha(JSON.stringify({ start, end, fields: FIELDS, pins: pins.filter(p => mapFiles.includes(p.file)) }));
  const cache = path.join(ROOT, 'backtests/level-atlas', mapKey), cacheRelative = path.relative(ROOT, cache).replace(/\\/g, '/');
  write('plan.json', { key, card: c, pins, node: process.version, cache: cacheRelative, createdAt: Date.now() });
  console.log('[LV01] ' + out);
  await verifySeal(c.parent); assert(read(c.parent + '/independent-verification.json').passed);
  let cs: Candle[], atlas: Atlas;
  if (fs.existsSync(cache)) {
    await verifySeal(cacheRelative); cs = cachedCandles(cacheRelative); atlas = cachedAtlas(cacheRelative);
    console.log('[atlas] reusing ' + cacheRelative);
  } else {
    const loaded = await loadMinutes(ROOT, 'HYPEUSDT', end, c.repair); cs = loaded.candles.filter(b => b.ts >= start);
    validateTape(cs, start, end);
    const { map } = readAcceptedMap(path.resolve(ROOT, c.pocMap, 'map.json'));
    atlas = buildAtlas(cs, map.profiles);
    fs.mkdirSync(cache, { recursive: true });
    const cw = (f: string, x: any) => atomicJson(path.join(cache, f), x);
    cw('schema.json', { version: 1, mapKey, start, end, rows: cs.length, fields: FIELDS, encoding: 'little-endian float64 row-major, NaN=unavailable',
      clock: 'row i sourceEnd=start+(i+1)*60000; availableAt=sourceEnd+60000; corrected history, not original arrivals',
      candleFields: ['open', 'high', 'low', 'close', 'volume', 'turnover'], pins: pins.filter(p => mapFiles.includes(p.file)) });
    cw('coverage.json', loaded.audit); cw('periods.json', atlas.periods);
    cw('pocs.json', atlas.pocs.map(({ distribution, ...p }) => p));
    fs.writeFileSync(path.join(cache, 'levels.f64'), bufferOf(atlas.values));
    const packed = new Float64Array(cs.length * 6);
    cs.forEach((b, i) => packed.set([b.open, b.high, b.low, b.close, b.volume, b.turnover], i * 6));
    fs.writeFileSync(path.join(cache, 'candles.f64'), bufferOf(packed));
    fs.writeFileSync(path.join(cache, 'period-register.csv'), csv(atlas.periods.map(p => ({ period: p.period,
      startUtc: new Date(p.start).toISOString(), endUtc: new Date(p.end).toISOString(), knownUtc: new Date(p.availableAt).toISOString(),
      complete: p.complete, open: p.open, high: p.high, low: p.low, midpoint: (p.high + p.low) / 2, close: p.close,
      vwapTypical: p.volume ? (p.period === 'month' ? p.hl2 : p.typical) / p.volume : null, vwapActual: p.volume ? p.turnover / p.volume : null }))));
    const rows: Row[] = [];
    for (let i = 0; i < cs.length; i++) if (cs[i].endTs % (15 * M) === 0) {
      const r: Row = { sourceEndUtc: new Date(cs[i].endTs).toISOString(), availableUtc: new Date(cs[i].endTs + M).toISOString() };
      FIELDS.forEach((f, j) => { const v = atlas.values[i * FIELDS.length + j]; r[f] = Number.isFinite(v) ? v : null; }); rows.push(r);
    }
    fs.writeFileSync(path.join(cache, 'levels-15m.csv'), csv(rows));
    const artifacts = []; for (const file of fs.readdirSync(cache).sort()) artifacts.push({ file, sha256: await fileHash(path.join(cache, file)) });
    cw('complete.json', { key: mapKey, artifacts });
    console.log('[atlas] saved ' + cs.length + ' minute rows, ' + FIELDS.length + ' fields: ' + cacheRelative);
  }
  validateTape(cs, start, end);
  const windows = [{ id: 'full', start, end }, { id: 'older', start, end: split }, { id: 'recent', start: split, end }];
  const options = (w: Row, delay: number) => ({ start: w.start, end: w.end, delay, hold: c.holdHours * H, notional: c.notional, equity: c.equity, fee: c.fee });
  const parentSignals = read(c.parent + '/signals.json').map((s: Row) => ({ id: s.id, at: s.signalAt, side: 1 as const }));
  const baselines = new Map<string, ReturnType<typeof replay>>();
  for (const w of windows) for (const delay of c.extraExecutionDelaysMs) {
    const old = read(`${c.parent}/${w.id}-${delay}-hold12.json`), o = options(w, delay), canonical = runSchedule(cs, parentSignals.map(({ id, at }: Action) => ({ id, at })), o), run = replay(cs, parentSignals, o);
    for (const field of ['trades', 'open', 'stats', 'monthly', 'accepted']) assert.deepEqual((canonical as Row)[field], old[field], 'PB02 parity: ' + field);
    for (const [field, value] of Object.entries(old.stats)) assert.deepEqual((run.stats as Row)[field], value, 'Generic parity: ' + field);
    assert.deepEqual(run.monthly, old.monthly); assert.deepEqual(run.accepted, old.accepted);
    for (let i = 0; i < old.trades.length; i++) for (const [field, value] of Object.entries(old.trades[i])) assert.deepEqual(run.trades[i][field], value);
    baselines.set(w.id + ':' + delay, run);
    write(`control-poc12-${w.id}-${delay}.json`, { options: o, ...run });
    console.log(`[control] ${w.id}/${delay}: exact $${run.stats.net.toFixed(2)}`);
  }
  write('baseline-parity.json', { passed: true, exactPaths: 6, mapsRebuilt: false });
  const built = buildSignals(cs, atlas, c); write('signals.json', built); write('definitions.json', DEFINITIONS);
  const allDefs = DEFINITIONS.flatMap(d => [
    { id: d.id + '__timed', parent: d.id, exit: 'timed', family: d.family, signals: built.signals[d.id] as Action[] },
    { id: d.id + '__bracket', parent: d.id, exit: 'bracket', family: d.family, signals: built.signals[d.id].filter(s => s.evidence.bracketEligible)
      .map(s => ({ ...s, stop: s.evidence.stop, target: s.evidence.target })) as Action[] },
  ]);
  const results: Row[] = [], months: Row[] = [], sideStats: Row[] = [], own = new Map<string, ReturnType<typeof replay>>();
  for (const d of allDefs) for (const w of windows) for (const delay of c.extraExecutionDelaysMs) for (const targetFirst of d.exit === 'bracket' ? [false, true] : [false]) {
    const o = { ...options(w, delay), targetFirst }, run = replay(cs, d.signals, o), base = baselines.get(w.id + ':' + delay)!;
    const reference = d.exit === 'timed' ? run : own.get(`${d.parent}:${w.id}:${delay}`)!;
    if (d.exit === 'timed') own.set(`${d.parent}:${w.id}:${delay}`, run);
    const file = `${d.id}-${w.id}-${delay}-${targetFirst ? 'targetfirst' : 'primary'}.json`;
    write(file, { id: d.id, options: o, ...run });
    results.push({ id: d.id, family: d.family, exit: d.exit, window: w.id, delay, targetFirst, ...run.stats,
      stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * c.extraCostBpsPerSide / 10000,
      pocBaselineNet: base.stats.net, pocBaselineDd: base.stats.maxAdverseDrawdownPct,
      ownTimedNet: reference.stats.net, ownTimedDd: reference.stats.maxAdverseDrawdownPct, delta: run.stats.net - reference.stats.net,
      ddDelta: run.stats.maxAdverseDrawdownPct - reference.stats.maxAdverseDrawdownPct, file });
    for (const m of run.monthly) months.push({ id: d.id, exit: d.exit, window: w.id, delay, targetFirst, ...m,
      ownTimedMarked: reference.monthly.find(x => x.month === m.month)!.markedNet,
      ownDelta: m.markedNet - reference.monthly.find(x => x.month === m.month)!.markedNet });
    sideStats.push({ id: d.id, window: w.id, delay, targetFirst, long: amounts(run.trades.filter(t => t.side === 1)), short: amounts(run.trades.filter(t => t.side === -1)),
      reasons: Object.fromEntries(['target', 'stop', 'timeout'].map(reason => [reason, amounts(run.trades.filter(t => t.reason === reason))])),
      top5WinDollars: [...run.trades].sort((a, b) => b.net - a.net).slice(0, 5).reduce((v, t) => v + Math.max(0, t.net), 0) });
    if (w.id === 'full' && !delay && !targetFirst) {
      fs.writeFileSync(path.join(out, `trades-${d.id}.csv`), csv(run.trades.map(t => ({ id: t.id, signalUtc: new Date(t.signalAt).toISOString(),
        entryUtc: new Date(t.entryAt).toISOString(), exitUtc: new Date(t.exitAt).toISOString(), side: t.side === 1 ? 'long' : 'short', entry: t.entryPrice,
        exit: t.exitPrice, reference: t.evidence.level, stop: t.stop, target: t.target, reason: t.reason, fees: t.fees, net: t.net, r: t.r }))));
      console.log(`[LV01] ${d.id}: ${run.stats.wins}W/${run.stats.losses}L $${run.stats.net.toFixed(0)} DD${run.stats.maxAdverseDrawdownPct.toFixed(2)}`);
    }
  }
  const clocks: Row[] = [];
  for (const w of windows) for (const delay of c.extraExecutionDelaysMs) for (const side of [1, -1] as const) {
    const schedule = clockSchedule(w.start, w.end, delay).map(s => ({ ...s, side }));
    const o = options(w, delay), run = replay(cs, schedule, o);
    const file = `clock-${side}-${w.id}-${delay}.json`; write(file, { options: o, ...run });
    clocks.push({ side, window: w.id, delay, ...run.stats, file });
  }
  const ranks = allDefs.map(d => {
    const rs = results.filter(r => r.id === d.id && !r.targetFirst), ms = months.filter(r => r.id === d.id && !r.targetFirst), failures: string[] = [];
    if (rs.some(r => r.net <= 0)) failures.push('nonpositive_partition');
    if (rs.some(r => r.stressNet <= 0)) failures.push('cost_stress');
    if (rs.some(r => r.trades < (r.window === 'full' ? 30 : 10))) failures.push('sample');
    if (rs.some(r => r.bankrupt)) failures.push('equity');
    if (ms.some(r => r.markedNet < -250)) failures.push('monthly_vs_cash');
    const upgradeFailures: string[] = [];
    if (d.exit === 'bracket') {
      if (rs.some(r => r.delta <= 0)) upgradeFailures.push('own_net_regression');
      if (rs.some(r => r.ddDelta > 1e-8)) upgradeFailures.push('own_dd_regression');
      if (ms.some(r => r.ownDelta < -250)) upgradeFailures.push('own_monthly_regression');
    }
    return { id: d.id, family: d.family, exit: d.exit, pass: !failures.length, failures, upgradeFailures,
      passesUpgrade: d.exit === 'bracket' && !failures.length && !upgradeFailures.length,
      full: rs.find(r => r.window === 'full' && !r.delay)!, recent: rs.find(r => r.window === 'recent' && !r.delay)!,
      older: rs.find(r => r.window === 'older' && !r.delay)!, worstMonth: Math.min(...ms.map(r => r.markedNet)) };
  }).sort((a, b) => b.full.net - a.full.net);
  write('results.json', results); write('monthly.json', months); write('side-stats.json', sideStats); write('clocks.json', clocks); write('ranking.json', ranks);
  fs.writeFileSync(path.join(out, 'results.csv'), csv(results)); fs.writeFileSync(path.join(out, 'monthly.csv'), csv(months));
  const f = (n: number) => Number.isFinite(n) ? n.toFixed(0) : 'NA';
  const line = (label: string, r: Row) => `|${label}|${r.wins}/${r.losses}|${f(r.winningDollars)}|${f(r.losingDollars)}|${f(r.avgLoss ?? r.losingDollars / r.losses)}|${f(r.net)}|${r.maxAdverseDrawdownPct.toFixed(2)}|\n`;
  let report = `# LV01 results\n\n${c.start} to ${c.end}; older/recent split ${c.split}. $10k independent trades, $32k starting equity. Fees0.055%/side, BEFORE FUNDING. No maker or ladder claims.\n\n`;
  for (const w of windows) {
    report += `## ${w.id}: controls and all setups, primary timing\n\n|Setup|W/L|Winning $|Losing $|Avg loss $|Marked net $|DD %|\n|---|---:|---:|---:|---:|---:|---:|\n`;
    report += '|Cash|0/0|0|0|NA|0|0|\n'; report += line('POC12 accepted baseline', baselines.get(w.id + ':0')!.stats);
    for (const r of clocks.filter(r => r.window === w.id && !r.delay)) report += line(r.side === 1 ? '12h long clock' : '12h short clock', r);
    for (const r of results.filter(r => r.window === w.id && !r.delay && !r.targetFirst).sort((a, b) => b.net - a.net)) report += line(r.id, r);
  }
  report += '\n## Frozen screen\n\n' + ranks.map(r => `- ${r.id}: ${r.pass ? 'PASS standalone screen only' : r.failures.join(', ')}; bracket versus own control: ${r.upgradeFailures.join(', ') || 'not failed/not applicable'}; worst month $${f(r.worstMonth)}.`).join('\n');
  report += '\n\nSee monthly.csv for EVERY setup/month and side-stats.json for directional attribution. Cash/clock/POC baselines are not matching-exposure causal controls. Do not add strategy nets. Entry and exit variants are correlated retrospective trials.\n';
  fs.writeFileSync(path.join(out, 'report.md'), report);
  for (const p of pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, 'Changed while running: ' + p.file);
  const artifacts = []; for (const file of fs.readdirSync(out).sort()) artifacts.push({ file, sha256: await fileHash(path.join(out, file)) });
  write('complete.json', { key, artifacts, paths: results.length, newDefinitions: c.economicDefinitionCount, independentVerificationRequired: true });
  atomicJson(path.join(ROOT, 'backtests/level-playbook/latest.json'), { key, directory: path.relative(ROOT, out).replace(/\\/g, '/'), cache: cacheRelative, accepted: false });
  console.log(`[LV01] complete; ${ranks.filter(r => r.pass).length}/64 standalone passes; independent check pending`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
