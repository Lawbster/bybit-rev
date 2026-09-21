import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson, fileHash, sha } from './research-workflow';
import { loadMinutes } from './relative-reversion-study';
import { runSchedule, validateTape, H, M } from './poc-bounce-engine';
import { csv } from './poc-bounce-study';
import { TpHlTape, normalize, type Row } from './tp-hl-event-features';
import { Inputs, SOURCES } from './hype-tp-hl-event-atlas';
import { weeklyTable, opportunity, execute, comparison, RULES } from './poc-hl-filter-engine';
import { amounts } from './poc-indicator-bias-engine';

export const ROOT = path.resolve(__dirname, '..'), CARD = 'research-inputs/poc-hl-filter-ph02-2026-09-17.json';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
async function accepted(dir: string) {
  const p = read(dir + '/plan.json'), seal = read(dir + '/complete.json'), receipt = read(dir + '/independent-verification.json');
  assert(receipt.passed && seal.key === p.key && receipt.key === p.key);
  for (const a of seal.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, a.file)), a.sha256, 'Parent artifact changed ' + a.file);
  return p;
}
export async function main() {
  const c = read(CARD); assert.deepEqual(c.rules, RULES); assert.equal(c.accelerationThreshold, -.05);
  const parentPlan = await accepted(c.parent); await accepted(c.hlParent); await accepted(c.indicatorParent);
  const start = Date.parse(c.start), split = Date.parse(c.split), end = Date.parse(c.end), canonicalStart = Date.parse(c.canonicalStart);
  const spec = read(c.hlParent + '/plan.json').card;
  const files = [CARD, 'scripts/poc-hl-filter-engine.ts', 'scripts/poc-hl-filter-study.ts', 'scripts/poc-hl-filter-tests.ts',
    'scripts/poc-hl-filter-verify.ts', 'scripts/poc-bounce-engine.ts', 'scripts/poc-hold-study.ts', 'scripts/poc-bounce-study.ts',
    'scripts/poc-indicator-bias-engine.ts', 'src/research/vwap-volume-features.ts', 'scripts/tp-hl-event-features.ts',
    'scripts/hype-tp-hl-event-atlas.ts', 'scripts/relative-reversion-study.ts', 'scripts/replay-candle-repair.ts',
    'scripts/research-workflow.ts', 'data/HYPEUSDT_1_full.json', 'data/HYPEUSDT_1m.jsonl', c.repair,
    ...[c.parent, c.hlParent, c.indicatorParent].flatMap(d => ['plan.json', 'complete.json', 'independent-verification.json'].map(f => d + '/' + f)),
    c.parent + '/signals.json', c.hlParent + '/events.json', c.indicatorParent + '/events-60000.json',
    'bot-config.json', 'hl-short-live-config.json', 'bot-state.json'];
  const pins: Row[] = []; for (const file of files) pins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  const loaded = await loadMinutes(ROOT, 'HYPEUSDT', end, c.repair), cs = loaded.candles.filter(b => b.ts >= canonicalStart);
  validateTape(cs, canonicalStart, end);
  const signals: Row[] = read(c.parent + '/signals.json'); assert.equal(signals.length, 264);
  const options = (a: number, b: number, delay: number) => ({ start: a, end: b, delay, hold: c.holdHours * H, notional: c.notional, equity: c.equity, fee: c.fee });
  const parity: Row[] = [];
  for (const [id, a, b] of [['full', canonicalStart, end], ['older', canonicalStart, Date.parse(c.canonicalSplit)], ['recent', Date.parse(c.canonicalSplit), end]] as const) {
    for (const delay of c.actionDelaysMs) {
      const old = read(`${c.parent}/${id}-${delay}-hold12.json`);
      const run = runSchedule(cs, signals.map(s => ({ id: s.id, at: s.signalAt })), options(a, b, delay));
      for (const k of ['trades', 'open', 'accepted', 'stats', 'monthly']) assert.deepEqual((run as Row)[k], old[k], 'PB02 parity ' + k);
      parity.push({ window: id, delay, ...run.stats });
    }
  }
  console.log('[PH02] six archived PB02 paths reproduced exactly');
  const relevant = signals.filter(s => s.signalAt >= start && s.signalAt < end);
  const ranges = relevant.map(s => [s.signalAt - 22 * M, s.signalAt]);
  const retain = (at: number) => ranges.some(([a, b]) => at >= a && at <= b);
  const inputs = new Inputs(), tape = new TpHlTape(spec), inventory: Row[] = [];
  // One scan per required stream; persist the complete reusable opportunity cache.
  for (const [kind, file] of SOURCES.filter(([k]) => ['taker', 'book', 'asset'].includes(k))) {
    let count = 0, retained = 0;
    await inputs.rows(file, (raw, line) => {
      count++; const at = Number(kind === 'book' ? raw.exchangeTimestamp : raw.timestamp ?? raw.ts);
      if (!retain(at)) return;
      const o = normalize(kind, raw, file, line);
      if (retain(o.sourceAt)) { tape.add(o); retained++; }
    });
    inventory.push({ kind, file, rows: count, retained }); console.log(`[PH02] ${kind}: retained ${retained}/${count}`);
  }
  tape.seal(); pins.push(...inputs.pins);
  const weekly = weeklyTable(cs);
  const opportunities = c.sourceDelaysMs.map((sourceDelay: number) => ({ sourceDelay,
    rows: signals.map(s => opportunity(s, tape, weekly, sourceDelay)) }));
  // Bridge descriptive PH01/PI01 evidence before any filter outcomes are read.
  const previous: Row[] = read(c.hlParent + '/events.json'), indicators: Row[] = read(c.indicatorParent + '/events-60000.json');
  const bridge: Row[] = [];
  for (const e of previous) {
    const x = opportunities[0].rows.find((r: Row) => r.id === e.id)!;
    assert.equal(x.acceleration, e.features.buyShareAcceleration);
    assert.equal(x.quality.coreHealthy, e.quality.coreHealthy);
    assert.equal(x.weekly?.distancePct ?? null, indicators.find(r => r.id === e.id)!.features.vvWeekDistance_15);
    if (e.quality.coreHealthy) bridge.push({ id: e.id, net: e.net, heavy: e.net <= -300, warningB: x.warningB, warningC: x.warningC });
  }
  assert.equal(bridge.length, 42); assert.equal(bridge.filter(e => e.warningC).length, 17);
  const key = sha(JSON.stringify({ c, pins, node: process.version })), out = path.join(ROOT, 'backtests/poc-hl-filter', key);
  assert(!fs.existsSync(out), 'Immutable job exists; reuse saved results'); fs.mkdirSync(out, { recursive: true });
  const write = (f: string, v: any) => atomicJson(path.join(out, f), v);
  write('plan.json', { key, card: c, pins, node: process.version, createdAt: Date.now(), parentKey: parentPlan.key, hlSpec: spec });
  console.log('[PH02] ' + out);
  write('baseline-parity.json', { passed: true, paths: parity }); write('coverage.json', { ...loaded.audit, inventory });
  write('signals.json', signals); write('retained-observations.json', tape.rows); write('opportunities.json', opportunities);
  write('attribution-bridge.json', { events: bridge, baseline: amounts(bridge), B: amounts(bridge.filter(e => e.warningB)), C: amounts(bridge.filter(e => e.warningC)) });
  write('coverage-comparison.json', opportunities.map((g: Row) => ({ sourceDelay: g.sourceDelay, raw: relevant.length,
    covered: g.rows.filter((r: Row) => r.signalAt >= start && r.covered).length,
    addedVersusPrimary: g.rows.filter((r: Row) => r.covered && !opportunities[0].rows.find((p: Row) => p.id === r.id).covered).map((r: Row) => r.id),
    removedVersusPrimary: g.rows.filter((r: Row) => !r.covered && opportunities[0].rows.find((p: Row) => p.id === r.id).covered).map((r: Row) => r.id) })));
  const windows = [{ id: 'pooled', start, end }, { id: 'early', start, end: split }, { id: 'late', start: split, end }];
  const results: Row[] = [], months: Row[] = [], attributions: Row[] = [];
  for (const group of opportunities) for (const delay of c.actionDelaysMs) for (const w of windows) {
    const o = options(w.start, w.end, delay), base = execute(cs, group.rows, 'A', o), runs = new Map();
    for (const rule of RULES) {
      const run = rule === 'A' ? base : execute(cs, group.rows, rule, o); runs.set(rule, run);
      const attr = comparison(base, run), file = `${rule}-${w.id}-source${group.sourceDelay}-action${delay}.json`;
      write(file, { rule, window: w.id, sourceDelay: group.sourceDelay, options: o, ...run, attribution: attr });
      const stats = run.stats, am = amounts(run.trades);
      results.push({ rule, window: w.id, sourceDelay: group.sourceDelay, delay, ...stats, avgLoss: am.avgLoss,
        heavy: am.heavy, heavyDollars: am.heavyDollars, worst: am.worst, profitFactor: am.profitFactor,
        delta: stats.net - base.stats.net, ddDelta: stats.maxAdverseDrawdownPct - base.stats.maxAdverseDrawdownPct,
        stressNet: stats.net - stats.turnoverIncludingMarkedExit * c.extraCostBpsPerSide / 10000,
        vetoes: run.decisions.filter(r => r.status === 'veto').length,
        actionableVetoes: run.decisions.filter(r => r.status === 'veto' && !r.occupiedBefore).length, file });
      months.push(...run.monthly.map(m => ({ rule, window: w.id, sourceDelay: group.sourceDelay, delay, ...m,
        baseline: base.monthly.find(b => b.month === m.month)!.markedNet,
        delta: m.markedNet - base.monthly.find(b => b.month === m.month)!.markedNet })));
      attributions.push({ rule, window: w.id, sourceDelay: group.sourceDelay, delay, ...attr });
      if (w.id === 'pooled' && !group.sourceDelay && !delay)
        fs.writeFileSync(path.join(out, `trades-${rule}.csv`), csv(run.trades.map(t => ({ ...t, entryUtc: new Date(t.entryAt).toISOString(), exitUtc: new Date(t.exitAt).toISOString() }))));
      console.log(`[PH02] ${rule}/${w.id}/source${group.sourceDelay}/action${delay}: ${stats.wins}W/${stats.losses}L $${stats.net.toFixed(2)} DD${stats.maxAdverseDrawdownPct.toFixed(2)}`);
    }
    write(`C-versus-B-${w.id}-source${group.sourceDelay}-action${delay}.json`, comparison(runs.get('B'), runs.get('C')));
  }
  const ranking = ['B', 'C'].map(rule => {
    const rs = results.filter(r => r.rule === rule), ms = months.filter(r => r.rule === rule), failures: string[] = [];
    if (rs.some(r => r.delta <= 0)) failures.push('not_all_path_net_improvement');
    if (rs.some(r => r.ddDelta > 1e-8)) failures.push('drawdown_regression');
    if (ms.some(m => m.delta < -250 - 1e-8)) failures.push('monthly_regression_over_250');
    if (rs.some(r => r.stressNet <= 0)) failures.push('nonpositive_cost_stress');
    if (rs.some(r => r.trades < (r.window === 'pooled' ? 30 : 10))) failures.push('insufficient_sample');
    if (rs.some(r => r.bankrupt)) failures.push('equity_exhaustion');
    return { rule, pass: failures.length === 0, failures, strictNoMonthlyRegression: ms.every(m => m.delta >= -1e-8),
      fullDelta: rs.find(r => r.window === 'pooled' && !r.sourceDelay && !r.delay)!.delta,
      minDelta: Math.min(...rs.map(r => r.delta)), worstMonthlyDelta: Math.min(...ms.map(m => m.delta)) };
  }).sort((a, b) => b.fullDelta - a.fullDelta);
  write('results.json', results); write('monthly.json', months); write('attribution.json', attributions); write('ranking.json', ranking);
  for (const [name, rows] of [['results', results], ['monthly', months]] as const) fs.writeFileSync(path.join(out, name + '.csv'), csv(rows));
  fs.writeFileSync(path.join(out, 'opportunities.csv'), csv(opportunities.flatMap((g: Row) => g.rows.filter((r: Row) => r.signalAt >= start).map((r: Row) => ({
    id: r.id, decisionUtc: new Date(r.signalAt).toISOString(), sourceDelay: r.sourceDelay, covered: r.covered,
    acceleration: r.acceleration, weeklyDistance: r.weekly?.distancePct ?? null, warningB: r.warningB, warningC: r.warningC, reasons: r.reasons.join('|') })))));
  const fmt = (n: number) => n.toFixed(2);
  let report = '# PH02: actual-ownership HL/weekly-VWAP POC entry vetoes\n\n$10k standalone long, fixed12h, taker fees0.055% each side, no funding. DD on$32k. No live changes.\n\n';
  for (const w of windows) {
    report += `## ${w.id}: primary source/action timing\n\n|Rule|W/L|Winning$|Losing$|Avg loss$|Net$|Delta$|DD%|Heavy losses|\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
    for (const r of results.filter(r => r.window === w.id && !r.sourceDelay && !r.delay))
      report += `|${r.rule}|${r.wins}/${r.losses}|${fmt(r.winningDollars)}|${fmt(r.losingDollars)}|${fmt(r.avgLoss ?? 0)}|${fmt(r.net)}|${fmt(r.delta)}|${fmt(r.maxAdverseDrawdownPct)}|${r.heavy}|\n`;
  }
  report += '\n## Primary monthly MTM, pooled path\n\n|Month|A baseline$|B$|B delta$|C$|C delta$|\n|---|---:|---:|---:|---:|---:|\n';
  for (const a of months.filter(m => m.rule === 'A' && m.window === 'pooled' && !m.sourceDelay && !m.delay)) {
    const get = (rule: string) => months.find(m => m.rule === rule && m.window === 'pooled' && !m.sourceDelay && !m.delay && m.month === a.month)!;
    const b = get('B'), d = get('C'); report += `|${a.month}|${fmt(a.markedNet)}|${fmt(b.markedNet)}|${fmt(b.delta)}|${fmt(d.markedNet)}|${fmt(d.delta)}|\n`;
  }
  report += '\n## All timing paths, pooled\n\n|Source delay|Action delay|A net / DD|B net / DD|C net / DD|\n|---|---|---:|---:|---:|\n';
  for (const src of c.sourceDelaysMs) for (const delay of c.actionDelaysMs) report += `|${src}|${delay}|` + RULES.map(rule => {
    const r = results.find(r => r.rule === rule && r.window === 'pooled' && r.sourceDelay === src && r.delay === delay)!;
    return fmt(r.net) + ' / ' + fmt(r.maxAdverseDrawdownPct);
  }).join('|') + '|\n';
  report += '\n## Qualification\n\n' + ranking.map(r => `- ${r.rule}: ${r.pass ? 'PASS' : r.failures.join(', ')}; worst monthly delta $${fmt(r.worstMonthlyDelta)}.`).join('\n');
  fs.writeFileSync(path.join(out, 'report.md'), report + '\n');
  for (const p of pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, 'Input changed: ' + p.file);
  const artifacts = []; for (const f of fs.readdirSync(out).sort()) artifacts.push({ file: f, sha256: await fileHash(path.join(out, f)) });
  write('complete.json', { key, newEconomicDefinitions: 2, paths: results.length, artifacts, generationChecks: true });
  console.log(`[PH02] complete ${ranking.filter(r => r.pass).length}/2; independent verification pending`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
