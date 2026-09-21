/** PA07 thin driver: reuse the sealed candle cache and structural replay kernel. */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import assert from 'assert/strict';
import { atomicJson, fileHash, sha } from './research-workflow';
import { cachedCandles } from './level-playbook-study';
import { validateTape } from './poc-bounce-engine';
import { replay, type Action, type Row, M, H } from './poc-indicator-bias-engine';
import { csv } from './poc-bounce-study';
import { buildPriceActionSignals } from './price-action-signals';
import { auditStructuralReplay } from './structural-replay-audit';
import { writePriceActionReport } from './price-action-report';
export const ROOT = path.resolve(__dirname, '..');
export const CARD = 'research-inputs/price-action-pa07-2026-09-18.json';
export const read = (file: string): any => JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
export const readGz = (file: string): any => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(ROOT, file))).toString());
export const writeGz = (file: string, value: any) => fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(value)));
const normalized = (x: any) => JSON.parse(JSON.stringify(x));
const relative = (file: string) => path.relative(ROOT, file).replace(/\\/g, '/');
const sideName = (side: number) => side === 1 ? 'long' : 'short';
export function definitionId(mechanism: string, side: number, target: string) { return `${mechanism}__${sideName(side)}__${target}`; }
export function economicActions(raw: readonly Action[], side: number, targetMode: string, c: Row) {
  const out: Action[] = [], rejected: Row[] = [];
  for (const s of raw.filter(s => s.side === side)) {
    const e = s.evidence!, stop = s.stop!, close = e.signalClose;
    const risk = Math.abs(close - stop) / close * 100;
    const target = targetMode === 'structural' ? s.target! : close + side * c.rewardR * Math.abs(close - stop);
    if (!(Number.isFinite(close + stop + target) && side * (close - stop) > 0 && side * (target - close) > 0
      && risk >= c.riskMinPct && risk <= c.riskMaxPct)) {
      rejected.push({ id: s.id, at: s.at, side, targetMode, reason: 'signal_bracket_or_risk', close, stop, target, risk }); continue;
    }
    out.push({ ...s, stop, target, expiresAt: s.at + c.holdHours * H,
      evidence: { ...e, targetMode, structuralTarget: s.target, target, riskPct: risk } });
  }
  out.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  for (let i = 1; i < out.length; i++) assert(out[i].at > out[i - 1].at, 'Producer must resolve same-side ties');
  return { actions: out, rejected };
}
async function sealed(dir: string, files?: string[]) {
  const seal = read(dir + '/complete.json');
  for (const f of files ?? seal.artifacts.map((a: Row) => a.file)) {
    const item = seal.artifacts.find((a: Row) => a.file === f); assert(item, 'Unsealed consumed file ' + f);
    assert.equal(await fileHash(path.resolve(ROOT, dir, f)), item.sha256, 'Seal mismatch ' + f);
  }
  return seal;
}
export async function main() {
  const c = read(CARD), start = Date.parse(c.start), end = Date.parse(c.end), split = Date.parse(c.split);
  assert.equal(c.mechanisms.length * c.sides.length * c.targets.length, c.controlDefinitions + c.candidateDefinitions);
  const parentPlan = read(c.parent + '/plan.json'), verification = read(c.parent + '/independent-verification.json');
  assert(verification.passed && verification.key === parentPlan.key);
  const signalParent = parentPlan.card.parent;
  await sealed(signalParent, ['signals.json']);
  const controlFiles = ['full', 'older', 'recent'].flatMap(w => c.delaysMs.map((d: number) => `control-poc12-${w}-${d}.json`));
  await sealed(c.parent, controlFiles); await sealed(c.cache, ['schema.json', 'candles.f64', 'coverage.json']);
  const sourceFiles = [CARD, c.method, 'scripts/price-action-study.ts', 'scripts/price-action-signals.ts', 'scripts/price-action-tests.ts',
    'scripts/price-action-report.ts', 'scripts/price-action-verify.ts', 'scripts/structural-replay-audit.ts', 'scripts/structural-replay-audit-tests.ts',
    'scripts/poc-indicator-bias-engine.ts', 'scripts/poc-bounce-engine.ts', 'scripts/level-playbook-study.ts',
    'scripts/poc-bounce-study.ts', 'scripts/research-workflow.ts', 'src/research/event-atlas-render.ts',
    ...['indicator-features', 'vwap-volume-features', 'volume-flow-features', 'macd-features', 'bollinger-features'].map(x => `src/research/${x}.ts`),
    c.cache + '/schema.json', c.cache + '/candles.f64', c.cache + '/complete.json', c.cache + '/coverage.json',
    c.parent + '/plan.json', c.parent + '/complete.json', c.parent + '/independent-verification.json', ...controlFiles.map(f => c.parent + '/' + f),
    signalParent + '/signals.json', signalParent + '/complete.json'];
  const pins: Row[] = [];
  for (const file of sourceFiles) pins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  // Protect deployed policy/ownership source independently of research identities.
  const protectedPins = [];
  for (const file of ['bot-config.json', 'hl-short-live-config.json', 'bot-state.json', 'src/bot/index.ts'])
    protectedPins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  const cs = cachedCandles(c.cache); validateTape(cs, start, end);
  const mapPins = pins.filter(p => [CARD, c.method, 'scripts/price-action-signals.ts', 'scripts/poc-indicator-bias-engine.ts',
    c.cache + '/schema.json', c.cache + '/candles.f64'].includes(p.file));
  const mapKey = sha(JSON.stringify({ c, mapPins })), mapDir = path.join(ROOT, 'backtests/price-action-events', mapKey);
  if (!fs.existsSync(mapDir)) {
    fs.mkdirSync(mapDir, { recursive: true });
    atomicJson(path.join(mapDir, 'plan.json'), { key: mapKey, card: c, pins: mapPins, createdAt: Date.now() });
    for (const lag of c.sourceLagsMs) {
      const built = buildPriceActionSignals(cs, c, lag);
      writeGz(path.join(mapDir, `events-${lag}.json.gz`), built);
      console.log(`[PA07 events] lag=${lag}, events=${built.events.length}, signals=${Object.values(built.signals).reduce((n, a) => n + a.length, 0)}`);
    }
    const artifacts = []; for (const file of fs.readdirSync(mapDir).sort()) artifacts.push({ file, sha256: await fileHash(path.join(mapDir, file)) });
    atomicJson(path.join(mapDir, 'complete.json'), { key: mapKey, artifacts });
  } else await sealed(relative(mapDir));
  if (process.argv.includes('--prepare')) {
    console.log(JSON.stringify({ phase: 'events_only', map: relative(mapDir), economicsRun: false })); return;
  }
  const key = sha(JSON.stringify({ c, pins, mapKey, node: process.version })), out = path.join(ROOT, 'backtests/price-action', key);
  if (fs.existsSync(out)) { await sealed(relative(out)); console.log(`[PA07] immutable job already exists: ${relative(out)}; not rerunning`); return; }
  fs.mkdirSync(out, { recursive: true }); const write = (file: string, x: any) => atomicJson(path.join(out, file), x);
  write('plan.json', { key, card: c, pins, protectedPins, map: relative(mapDir), node: process.version, createdAt: Date.now() });
  // Own-parent engine parity, not an economic comparison to unrelated NPOC trades.
  const controlActions: Action[] = read(signalParent + '/signals.json').map((s: Row) => ({ id: s.id, at: s.signalAt, side: 1 }));
  for (const file of controlFiles) {
    const prior = read(c.parent + '/' + file), replayed = replay(cs, controlActions, prior.options);
    for (const field of ['trades', 'open', 'monthly', 'accepted', 'curve', 'stats']) assert.deepEqual(normalized((replayed as Row)[field]), prior[field], `Engine parity ${file}/${field}`);
  }
  write('baseline-parity.json', { passed: true, paths: controlFiles.length,
    scope: 'Exact raw-opportunity engine fixtures: receipts, occupancy, monthly, curve, inventory and all stats.' });
  console.log('[PA07] six accepted-execution fixtures matched exactly');
  const windows = [{ id: 'full', start, end }, { id: 'older', start, end: split }, { id: 'recent', start: split, end }];
  const results: Row[] = [], months: Row[] = [], audits: Row[] = [], rejected: Row[] = [];
  for (const lag of c.sourceLagsMs) {
    const built = readGz(relative(mapDir) + `/events-${lag}.json.gz`);
    for (const mechanism of c.mechanisms) for (const side of c.sides) for (const target of c.targets) {
      const id = definitionId(mechanism, side, target), prepared = economicActions(built.signals[mechanism], side, target, c);
      rejected.push(...prepared.rejected.map(x => ({ ...x, lag, id })));
      for (const w of windows) for (const delay of c.delaysMs) for (const targetFirst of [false, true]) {
        const o = { start: w.start, end: w.end, delay, hold: c.holdHours * H, notional: c.notional, equity: c.equity, fee: c.fee, targetFirst };
        const run = replay(cs, prepared.actions, o);
        const audit = auditStructuralReplay(cs, prepared.actions, o, run);
        const file = `${id}-${w.id}-${lag}-${delay}-${targetFirst ? 'targetfirst' : 'stopfirst'}.json.gz`;
        writeGz(path.join(out, file), { id, mechanism, side, target, lag, window: w.id, options: o, ...run });
        audits.push({ file, ...audit });
        const ts = run.trades, top5 = [...ts].sort((a, b) => b.net - a.net).slice(0, 5).reduce((a, b) => a + Math.max(0, b.net), 0);
        results.push({ id, mechanism, side, target, window: w.id, lag, delay, targetFirst, file, ...run.stats,
          stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * c.costStressBpsPerSide / 10000,
          top5WinDollars: top5, initialRiskAvg: ts.length ? ts.reduce((a, t) => a + t.qty * Math.abs(t.entryPrice - t.stop), 0) / ts.length : null,
          targets: ts.filter(t => t.reason === 'target').length, stops: ts.filter(t => t.reason === 'stop').length,
          timeouts: ts.filter(t => t.reason === 'timeout').length });
        for (const m of run.monthly) months.push({ id, window: w.id, lag, delay, targetFirst, ...m });
        if (w.id === 'full' && lag === M && delay === 0 && !targetFirst) {
          fs.writeFileSync(path.join(out, `${id}-trades.csv`), csv(ts.map(t => ({ ...t, evidence: undefined,
            signalUtc: new Date(t.signalAt).toISOString(), entryUtc: new Date(t.entryAt).toISOString(), exitUtc: new Date(t.exitAt).toISOString() }))));
          console.log(`[PA07] ${id}: ${run.stats.wins}W/${run.stats.losses}L $${run.stats.net.toFixed(0)} DD${run.stats.maxAdverseDrawdownPct.toFixed(2)}`);
        }
      }
    }
  }
  write('results.json', results); write('monthly.json', months); write('bracket-rejections.json', rejected);
  write('receipt-verification.json', { passed: true, paths: audits.length, audits });
  fs.writeFileSync(path.join(out, 'results.csv'), csv(results)); fs.writeFileSync(path.join(out, 'monthly.csv'), csv(months));
  writePriceActionReport(out, c, results, months);
  for (const p of [...pins, ...protectedPins]) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, 'Changed during job ' + p.file);
  const artifacts = []; for (const file of fs.readdirSync(out).sort()) artifacts.push({ file, sha256: await fileHash(path.join(out, file)) });
  write('complete.json', { key, artifacts, paths: results.length, candidateDefinitions: c.candidateDefinitions,
    controlDefinitions: c.controlDefinitions, sourceVerificationRequired: true });
  atomicJson(path.join(ROOT, 'backtests/price-action/latest.json'), { key, directory: relative(out), map: relative(mapDir), accepted: false });
  console.log('[PA07] paths and receipts complete; source audit pending: ' + relative(out));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
