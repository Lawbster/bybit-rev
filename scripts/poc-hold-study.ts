/** PB02: frozen hold-only replays of saved daily NPOC touch signals. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson, fileHash, inside, sha } from './research-workflow';
import { loadMinutes } from './relative-reversion-study';
import { runSchedule, validateTape, M, H, type Signal } from './poc-bounce-engine';
import { csv, dollar } from './poc-bounce-study';
export const ROOT = path.resolve(__dirname, '..'), CARD = 'research-inputs/poc-hold-pb02-2026-09-17.json';
export const readJson = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
type Run = ReturnType<typeof runSchedule>;
export function attribute(base: Run, variant: Run) {
  const indexed = (run: Run) => new Map([...run.trades.map(t => ({ ...t, open: false })), ...(run.open ? [{ ...run.open, open: true }] : [])].map(t => [t.id, t]));
  const a = indexed(base), b = indexed(variant);
  const summarize = (xs: any[]) => ({ count: xs.length, wins: xs.filter(x => x.net > 1e-8).length, losses: xs.filter(x => x.net < -1e-8).length,
    winningDollars: xs.reduce((v, x) => v + Math.max(0, x.net), 0), losingDollars: xs.reduce((v, x) => v + Math.min(0, x.net), 0),
    net: xs.reduce((v, x) => v + x.net, 0), includesOpen: xs.filter(x => x.open).length });
  const ids = [...new Set([...a.keys(), ...b.keys()])];
  const rows = ids.map(id => { const x = a.get(id), y = b.get(id);
    if (x && y) { assert.equal(x.entryAt, y.entryAt); assert.equal(x.entryPrice, y.entryPrice); }
    return { id, kind: x && y ? 'common' : y ? 'variant_only' : 'baseline_only', entryAt: (x ?? y).entryAt,
      baselineNet: x?.net ?? 0, variantNet: y?.net ?? 0, delta: (y?.net ?? 0) - (x?.net ?? 0), baselineOpen: x?.open ?? false, variantOpen: y?.open ?? false };
  }).sort((x, y) => x.entryAt - y.entryAt);
  const common = rows.filter(x => x.kind === 'common'), added = rows.filter(x => x.kind === 'variant_only'), removed = rows.filter(x => x.kind === 'baseline_only');
  const sum = (xs: typeof rows, field: 'delta' | 'baselineNet' | 'variantNet') => xs.reduce((v, x) => v + x[field], 0);
  const summary = { common: common.length, commonBaseline: summarize(common.map(x => a.get(x.id))), commonVariant: summarize(common.map(x => b.get(x.id))),
    commonExitDelta: sum(common, 'delta'), added: summarize(added.map(x => b.get(x.id))), removed: summarize(removed.map(x => a.get(x.id))),
    variantOnlyNet: sum(added, 'variantNet'), baselineOnlyNet: sum(removed, 'baselineNet'),
    commonWinToLoss: common.filter(x => x.baselineNet > 1e-8 && x.variantNet < -1e-8).length,
    commonLossToWin: common.filter(x => x.baselineNet < -1e-8 && x.variantNet > 1e-8).length,
    commonPositiveToNonpositive: common.filter(x => x.baselineNet > 1e-8 && x.variantNet <= 1e-8).length,
    delta: sum(rows, 'delta'), largestPositiveContribution: Math.max(0, ...rows.map(x => x.delta)),
    topFivePositiveContribution: [...rows].sort((x, y) => y.delta - x.delta).slice(0, 5).reduce((v, x) => v + Math.max(0, x.delta), 0) };
  assert(Math.abs(summary.delta - (variant.stats.net - base.stats.net)) < 1e-6);
  return { summary, rows };
}
export async function loadParent(card: any) {
  const dir = inside(ROOT, card.parent), plan = readJson(path.join(dir, 'plan.json')), seal = readJson(path.join(dir, 'complete.json'));
  const receipt = readJson(path.join(dir, 'independent-verification.json'));
  assert(receipt.passed && receipt.key === plan.key && seal.key === plan.key, 'Accepted parent required');
  for (const a of seal.artifacts) assert.equal(await fileHash(path.join(dir, a.file)), a.sha256, 'Parent artifact changed: ' + a.file);
  for (const p of plan.pins) assert.equal(await fileHash(inside(ROOT, p.file)), p.sha256, 'Parent source/input changed: ' + p.file);
  assert.equal(card.rule, 'naked_day_touch'); assert.equal(card.start, plan.card.start); assert.equal(card.end, plan.card.end); assert.equal(card.split, plan.card.split);
  assert.equal(card.notional, plan.card.notional); assert.equal(card.equity, plan.card.equity); assert.equal(card.feeRate, plan.card.feeRate);
  const all: Signal[] = readJson(path.join(dir, 'signals.json')), signals = all.filter(s => s.rule === card.rule);
  assert.equal(signals.length, 264, 'PB01 cohort changed');
  return { dir, plan, seal, receipt, signals };
}
export async function main() {
  const c = readJson(path.join(ROOT, CARD)); assert.deepEqual(c.holdsHours, [1, 2, 3, 4, 5, 6, 8, 10, 12]);
  assert.deepEqual(c.delaysMinutes, [0, 1]); assert.equal(c.baselineHours, 12); assert.equal(c.newDefinitions, 8);
  const parent = await loadParent(c), pins = [...parent.plan.pins];
  for (const file of [CARD, 'scripts/poc-hold-study.ts', 'scripts/poc-hold-tests.ts', 'scripts/poc-hold-verify.ts',
    c.parent + '/plan.json', c.parent + '/complete.json', c.parent + '/independent-verification.json', c.parent + '/signals.json'])
    pins.push({ file, sha256: await fileHash(path.join(ROOT, file)) });
  const key = sha(JSON.stringify({ card: c, pins, node: process.version })), out = path.join(ROOT, 'backtests/poc-hold', key);
  assert(!fs.existsSync(out), 'Immutable result exists; reuse it'); fs.mkdirSync(out, { recursive: true });
  const json = (f: string, x: any) => atomicJson(path.join(out, f), x);
  json('plan.json', { key, card: c, pins, node: process.version, createdAt: Date.now() }); console.log('[PB02] ' + out);
  const start = Date.parse(c.start), end = Date.parse(c.end), split = Date.parse(c.split);
  const loaded = await loadMinutes(ROOT, 'HYPEUSDT', end, parent.plan.card.repair), minutes = loaded.candles.filter(x => x.ts >= start);
  validateTape(minutes, start, end); json('coverage.json', { ...loaded.audit, selected: minutes.length });
  json('signals.json', parent.signals);
  const windows = [{ id: 'full', start, end }, { id: 'older', start, end: split }, { id: 'recent', start: split, end }];
  const baselines = new Map<string, Run>(), results: any[] = [], monthly: any[] = [], attrs: any[] = [];
  const opts = (w: typeof windows[number], delay: number, hours: number) => ({ start: w.start, end: w.end, delay, hold: hours * H, notional: c.notional, equity: c.equity, fee: c.feeRate });
  // Baseline MUST pass before any additional horizon's economics.
  for (const w of windows) for (const dm of c.delaysMinutes) {
    const delay = dm * M, options = opts(w, delay, 12), schedule = parent.signals.filter(s => s.signalAt >= w.start && s.signalAt < w.end).map(s => ({ at: s.signalAt, id: s.id }));
    const run = runSchedule(minutes, schedule, options), old = readJson(path.join(parent.dir, `${w.id}-${delay}-${c.rule}.json`));
    for (const field of ['trades', 'open', 'monthly', 'accepted', 'stats'] as const) assert.deepEqual(run[field], old[field], 'Archived12h mismatch: ' + w.id + '/' + dm + '/' + field);
    baselines.set(w.id + ':' + delay, run); console.log(`[PB02] exact 12h ${w.id}/delay${dm} $${run.stats.net.toFixed(2)}`);
  }
  json('baseline-parity.json', { passed: true, paths: 6, exact: true, parent: parent.plan.key });
  for (const hours of [12, ...c.holdsHours.filter((h: number) => h !== 12)]) for (const w of windows) for (const dm of c.delaysMinutes) {
    const delay = dm * M, options = opts(w, delay, hours), base = baselines.get(w.id + ':' + delay)!;
    const schedule = parent.signals.filter(s => s.signalAt >= w.start && s.signalAt < w.end).map(s => ({ at: s.signalAt, id: s.id }));
    const run = hours === 12 ? base : runSchedule(minutes, schedule, options), attribution = attribute(base, run), file = `${w.id}-${delay}-hold${hours}.json`;
    json(file, { hours, window: w.id, delay, options, ...run, attribution });
    const rs = run.stats;
    results.push({ hours, window: w.id, delay, ...rs, delta: rs.net - base.stats.net, ddDelta: rs.maxAdverseDrawdownPct - base.stats.maxAdverseDrawdownPct,
      stressNet: rs.net - rs.turnoverIncludingMarkedExit * c.extraCostBpsPerSide / 10000,
      avgWin: rs.wins ? rs.winningDollars / rs.wins : null, avgLoss: rs.losses ? rs.losingDollars / rs.losses : null,
      worstLoss: Math.min(0, ...run.trades.map(t => t.net)), expectancy: rs.trades ? rs.closedNet / rs.trades : null,
      additionalTrades: rs.trades - base.stats.trades, file });
    monthly.push(...run.monthly.map(m => { const b = base.monthly.find(x => x.month === m.month)!; return { hours, window: w.id, delay, ...m, baselineMarked: b.markedNet, delta: m.markedNet - b.markedNet }; }));
    attrs.push({ hours, window: w.id, delay, ...attribution.summary });
    console.log(`[PB02] ${hours}h ${w.id} delay${dm}: ${rs.wins}W/${rs.losses}L $${rs.net.toFixed(2)} DD${rs.maxAdverseDrawdownPct.toFixed(2)}%`);
  }
  const rankings = c.holdsHours.filter((h: number) => h !== 12).map((hours: number) => {
    const rs = results.filter(r => r.hours === hours), ms = monthly.filter(r => r.hours === hours), failures: string[] = [];
    if (rs.some(r => r.net <= 0)) failures.push('nonpositive_net'); if (rs.some(r => r.delta <= 0)) failures.push('not_all_path_net_improvement');
    if (rs.some(r => r.ddDelta > 1e-8)) failures.push('drawdown_regression'); if (ms.some(r => r.delta < -1e-8)) failures.push('monthly_regression');
    if (rs.some(r => r.stressNet <= 0)) failures.push('cost_stress'); if (rs.some(r => r.trades < (r.window === 'full' ? 30 : 10))) failures.push('sample');
    if (rs.some(r => r.bankrupt)) failures.push('equity');
    return { hours, pass: !failures.length, failures, fullDelta: rs.find(r => r.window === 'full' && !r.delay).delta,
      worstMonthlyDelta: Math.min(...ms.map(m => m.delta)), minDelta: Math.min(...rs.map(r => r.delta)), maxDdRegression: Math.max(...rs.map(r => r.ddDelta)) };
  }).sort((a: any, b: any) => b.fullDelta - a.fullDelta);
  json('results.json', results); json('monthly.json', monthly); json('attribution.json', attrs); json('ranking.json', rankings);
  for (const [f, xs] of [['results', results], ['monthly', monthly]] as const) fs.writeFileSync(path.join(out, f + '.csv'), csv(xs));
  let report = '# PB02: daily NPOC touch holding time\n\nFixed $10k long,0.055%/side, before funding, no TP/SL. DD on$32k. Baseline12h reproduced exactly; occupancy recalculated.\n\n';
  for (const w of windows) for (const delay of [0, M]) {
    report += `## ${w.id}: ${new Date(w.start).toISOString()} to ${new Date(w.end).toISOString()}, extra delay${delay / M}m\n\n`;
    report += '| Hold | W/L | Win$ | Loss$ | Avg loss$ | Net$ | Delta$ | DD% | DD delta pp | Cost-stress net$ |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
    const rs = results.filter(r => r.window === w.id && r.delay === delay).sort((a, b) => (a.hours === 12 ? -1 : b.hours === 12 ? 1 : a.hours - b.hours));
    for (const r of rs) report += `| ${r.hours}h${r.hours === 12 ? ' baseline' : ''} | ${r.wins}/${r.losses} | ${dollar(r.winningDollars)} | ${dollar(r.losingDollars)} | ${dollar(r.avgLoss)} | ${dollar(r.net)} | ${dollar(r.delta)} | ${r.maxAdverseDrawdownPct.toFixed(2)} | ${r.ddDelta.toFixed(2)} | ${dollar(r.stressNet)} |\n`;
    report += '\n';
  }
  for (const delay of [0, M]) {
    report += `## Monthly marked net /delta versus12h: full window, extra${delay / M}m\n\n| Month | 12h baseline$ | ` + c.holdsHours.filter((h: number) => h !== 12).map((h: number) => h + 'h$/delta$').join(' | ') + ' |\n|---|' + Array(9).fill('---:|').join('') + '\n';
    for (const m of monthly.filter(r => r.hours === 12 && r.window === 'full' && r.delay === delay)) report += `| ${m.month} | ${dollar(m.markedNet)} | ` + c.holdsHours.filter((h: number) => h !== 12).map((h: number) => { const r = monthly.find(r => r.hours === h && r.window === 'full' && r.delay === delay && r.month === m.month); return dollar(r.markedNet) + '/' + dollar(r.delta); }).join(' | ') + ' |\n';
    report += '\n';
  }
  report += '## Strict qualification\n\n' + rankings.map((r: any) => `- ${r.hours}h: ${r.pass ? 'PASS' : r.failures.join(', ')}; worst monthly delta$${dollar(r.worstMonthlyDelta)}.`).join('\n') + '\n';
  fs.writeFileSync(path.join(out, 'report.md'), report);
  for (const p of pins) assert.equal(await fileHash(inside(ROOT, p.file)), p.sha256, 'Pin changed: ' + p.file);
  const artifacts = []; for (const f of fs.readdirSync(out).sort()) artifacts.push({ file: f, sha256: await fileHash(path.join(out, f)) });
  json('complete.json', { key, newDefinitions: 8, paths: results.length, passedGenerationChecks: true, artifacts });
  console.log(`[PB02] complete; ${rankings.filter((r: any) => r.pass).length}/8 strict improvements; verify before acceptance`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
