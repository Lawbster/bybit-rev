/** PB01 frozen independent long diagnostic. Reuses accepted maps; never downloads/rebuilds tape. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson, fileHash, sha } from './research-workflow';
import { loadMinutes } from './relative-reversion-study';
import { openPocMap } from './poc-map-reader';
import { runStandalone } from './indicator-standalone-engine';
import { buildBounceSignals, runSchedule, clockSchedule, ruleIds, validateTape, M, H, D, type Signal, type Schedule } from './poc-bounce-engine';
import type { Candle } from './hype-freerun-canonical-replay';
export const ROOT = path.resolve(__dirname, '..'), CARD = 'research-inputs/poc-bounce-pb01-2026-09-17.json';
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
export const dollar = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
export function csv(rows: Record<string, any>[]) {
  if (!rows.length) return ''; const keys = Object.keys(rows[0]), value = (x: any) => '"' + String(x ?? '').replace(/"/g, '""') + '"';
  return keys.map(value).join(',') + '\n' + rows.map(r => keys.map(k => value(r[k])).join(',')).join('\n') + '\n';
}
export function assertEconomics(actual: any, reference: any) {
  for (const k of ['trades', 'wins', 'losses', 'winningDollars', 'losingDollars', 'closedNet', 'openNet', 'net', 'feesPaid', 'turnoverIncludingMarkedExit', 'exposureHours', 'maxAdverseDrawdownPct', 'maxCloseDrawdownPct'])
    assert(Math.abs(actual.stats[k] - reference.stats[k]) < 1e-6, `Control mismatch: ${k} ${actual.stats[k]} vs ${reference.stats[k]}`);
  assert.equal(actual.trades.length, reference.trades.length);
  actual.trades.forEach((t: any, i: number) => { const r = reference.trades[i]; for (const k of ['entryAt', 'exitAt', 'entryPrice', 'exitPrice', 'qty', 'net', 'fees']) assert(Math.abs(t[k] - r[k]) < 1e-7, `Control trade ${i}/${k}`); });
  actual.monthly.forEach((m: any, i: number) => assert(Math.abs(m.markedNet - reference.monthly[i].markedNet) < 1e-6, 'Control monthly mismatch'));
}
export function responses(cs: readonly Candle[], signals: readonly Signal[], start: number, end: number) {
  const output: any[] = [], base = cs[0].ts;
  for (const hours of [1, 4, 12, 24]) {
    let n = 0, censored = 0, total = 0, mae = 0, mfe = 0, wins = 0;
    for (const s of signals) {
      if (s.signalAt < start || s.signalAt >= end) continue;
      const exitAt = s.signalAt + hours * H; if (exitAt >= end) { censored++; continue; }
      const entry = cs[(s.signalAt - base) / M].open, exit = cs[(exitAt - base) / M].open;
      let low = Math.min(entry, exit), high = Math.max(entry, exit);
      for (let i = (s.signalAt - base) / M; i < (exitAt - base) / M; i++) { low = Math.min(low, cs[i].low); high = Math.max(high, cs[i].high); }
      const r = (exit / entry - 1 - 0.00055 * (1 + exit / entry)) * 100;
      n++; wins += r > 0 ? 1 : 0; total += r; mae += (low / entry - 1) * 100; mfe += (high / entry - 1) * 100;
    }
    output.push({ hours, n, censored, winRate: n ? wins / n * 100 : null, meanNetPct: n ? total / n : null, meanMaePct: n ? mae / n : null, meanMfePct: n ? mfe / n : null });
  }
  return output;
}
export async function main() {
  const c = read(CARD); assert.equal(c.newStrategyDefinitions, ruleIds.length);
  assert.equal(c.notional, 10000); assert.equal(c.width, '0.10'); assert.equal(c.venue, 'bybit');
  assert.deepEqual(c.confirmMinutes, [0, 1, 5, 15, 60]); assert.equal(c.confirmationExpiryMinutes, 60); assert.equal(c.rearmAbovePct, 0.5);
  const sources = [CARD, 'scripts/poc-bounce-engine.ts', 'scripts/poc-bounce-study.ts', 'scripts/poc-bounce-tests.ts', 'scripts/poc-bounce-verify.ts',
    'scripts/poc-map-reader.ts', 'scripts/poc-profile-engine.ts', 'scripts/poc-volume-source.ts', 'scripts/relative-reversion-study.ts',
    'scripts/replay-candle-repair.ts', 'scripts/research-workflow.ts', 'scripts/indicator-standalone-engine.ts',
    'scripts/entry-patience-standalone-engine.ts', c.repair, 'data/HYPEUSDT_1_full.json', 'data/HYPEUSDT_1m.jsonl',
    c.map + '/map.json', c.map + '/complete.json', c.map + '/independent-verification.json', c.map + '/quality-issues.json'];
  const pins = []; for (const file of sources) pins.push({ file, sha256: await fileHash(path.join(ROOT, file)) });
  const key = sha(JSON.stringify({ card: c, pins, node: process.version })), out = path.join(ROOT, 'backtests/poc-bounce', key);
  assert(!fs.existsSync(out), 'Immutable output exists; reuse it'); fs.mkdirSync(out, { recursive: true });
  atomicJson(path.join(out, 'plan.json'), { key, card: c, pins, node: process.version, createdAt: Date.now() });
  console.log('[PB01] output ' + out);
  const reader = await openPocMap(path.join(ROOT, c.map, 'map.json'));
  const start = Date.parse(c.start), end = Date.parse(c.end), split = Date.parse(c.split);
  assert.equal(reader.start, start); assert.equal(reader.cutoff, end);
  const loaded = await loadMinutes(ROOT, 'HYPEUSDT', end, c.repair), minutes = loaded.candles.filter(x => x.ts >= start);
  validateTape(minutes, start, end);
  atomicJson(path.join(out, 'coverage.json'), { ...loaded.audit, selectedMinutes: minutes.length, start, end, map: reader.identity, clock: reader.clock });
  const windows = [{ id: 'full', start, end }, { id: 'older', start, end: split }, { id: 'recent', start: split, end }];
  const controls: Record<string, any> = {}, results: any[] = [], monthly: any[] = [], responseRows: any[] = [];
  const json = (f: string, x: any) => atomicJson(path.join(out, f), x);
  const save = (id: string, kind: string, window: string, delay: number, run: ReturnType<typeof runSchedule>, options: any) => {
    const name = `${window}-${delay}-${id}`;
    json(name + '.json', { id, kind, window, delay, options, ...run });
    const b = controls[window + ':' + delay];
    const row = { id, kind, window, delay, ...run.stats, stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * c.extraFixedPathCostBpsPerSide / 10000,
      avgWin: run.stats.wins ? run.stats.winningDollars / run.stats.wins : null, avgLoss: run.stats.losses ? run.stats.losingDollars / run.stats.losses : null,
      expectancy: run.stats.trades ? run.stats.closedNet / run.stats.trades : null, deltaVsClock: b ? run.stats.net - b.stats.net : 0,
      top5Net: [...run.trades].sort((a, b) => b.net - a.net).slice(0, 5).reduce((s, t) => s + t.net, 0), file: name + '.json' };
    results.push(row);
    for (const m of run.monthly) {
      const bm = b?.monthly.find((x: any) => x.month === m.month);
      monthly.push({ id, kind, window, delay, ...m, deltaVsClock: bm ? m.markedNet - bm.markedNet : 0 });
    }
    return row;
  };
  // Reproduce canonical STANDALONE controls before reading strategy economics.
  for (const w of windows) for (const dm of c.executionDelayMinutes) {
    const delay = dm * M, options = { start: w.start, end: w.end, delay, hold: c.holdMinutes * M, equity: c.equity, notional: c.notional, fee: c.feeRate };
    const run = runSchedule(minutes, clockSchedule(w.start, w.end, delay), options);
    const reference = runStandalone(minutes.filter(x => x.ts >= w.start && x.endTs <= w.end).map(x => ({ timestamp: x.ts, ...x })), [],
      { id: 'clock', family: 'clock', side: 'long', exit: 'fixed12h' },
      { start: w.start, end: w.end, delayMs: delay, holdMs: c.holdMinutes * M, equity: c.equity, notional: c.notional, feeRate: c.feeRate });
    assertEconomics(run, reference); controls[w.id + ':' + delay] = run; save('clock', 'clock', w.id, delay, run, options);
    console.log(`[PB01] exact standalone control ${w.id} delay${dm}: $${run.stats.net.toFixed(2)}`);
  }
  json('control-parity.json', { passed: true, cases: 6, scope: 'existing standalone clock engine; NOT a ladder baseline', toleranceUsd: 0.000001 });
  console.log('[PB01] reconstructing causal encounters once from saved map');
  const bad = new Set<number>(read(c.map + '/quality-issues.json').filter((r: any) => r.venue === 'bybit').map((r: any) => r.at));
  const built = buildBounceSignals(minutes, reader, bad);
  json('encounters.json', built.encounters); json('signals.json', built.signals);
  json('signal-summary.json', { encounters: built.encounters.length, signals: built.signals.length, duplicatesSuppressed: built.duplicatesSuppressed,
    expiredConfirmations: built.expiredConfirmations, incompleteConfirmations: built.incompleteConfirmations,
    byRule: Object.fromEntries(ruleIds.map(id => [id, built.signals.filter(s => s.rule === id).length])) });
  // Prefix causality uses the same map, whose reader must hide future lifecycle evidence.
  const prefixEnd = Date.parse('2025-03-01T00:00:00Z');
  const prefix = buildBounceSignals(minutes.filter(x => x.endTs <= prefixEnd), reader, bad);
  assert.deepEqual(prefix.signals, built.signals.filter(s => s.signalAt <= prefixEnd));
  for (const id of ruleIds) {
    const selected = built.signals.filter(s => s.rule === id);
    for (const w of windows) {
      responseRows.push(...responses(minutes, selected, w.start, w.end).map(r => ({ id, window: w.id, ...r })));
      for (const dm of c.executionDelayMinutes) {
        const delay = dm * M, options = { start: w.start, end: w.end, delay, hold: c.holdMinutes * M, equity: c.equity, notional: c.notional, fee: c.feeRate };
        const signals = selected.filter(s => s.signalAt >= w.start && s.signalAt < w.end);
        save(id, 'strategy', w.id, delay, runSchedule(minutes, signals.map(s => ({ at: s.signalAt, id: s.id })), options), options);
        for (const days of c.calendarControlShiftsDays) {
          const schedule = signals.map(s => ({ at: s.signalAt + days * D, sourceAt: s.signalAt, id: s.id })).filter(s => s.at < w.end);
          save(id + `_shift${days}d`, 'calendar', w.id, delay, runSchedule(minutes, schedule, options), options);
        }
      }
    }
    console.log(`[PB01] ${id}: ${selected.length} raw signals; full/older/recent plus delayed calendar controls saved`);
  }
  const ranking = ruleIds.map(id => {
    const xs = results.filter(r => r.id === id), failures: string[] = [];
    if (xs.some(r => r.trades < (r.window === 'full' ? 30 : 10))) failures.push('sample');
    if (xs.some(r => r.net <= 0)) failures.push('net'); if (xs.some(r => r.deltaVsClock <= 0)) failures.push('clock');
    if (xs.some(r => r.stressNet <= 0)) failures.push('cost'); if (xs.some(r => r.bankrupt)) failures.push('equity');
    const ms = monthly.filter(r => r.id === id); if (ms.some(m => m.deltaVsClock < -1e-8)) failures.push('monthly');
    return { id, pass: failures.length === 0, failures, worstMonthlyDelta: Math.min(...ms.map(m => m.deltaVsClock)),
      fullNet: xs.find(x => x.window === 'full' && !x.delay).net, recentNet: xs.find(x => x.window === 'recent' && !x.delay).net,
      calendar: xs.map(r => ({ window: r.window, delay: r.delay, deltas: c.calendarControlShiftsDays.map((days: number) => {
        const b = results.find(x => x.window === r.window && x.delay === r.delay && x.id === id + `_shift${days}d`);
        return { days, netDelta: r.net - b.net, expectancyDelta: r.expectancy === null || b.expectancy === null ? null : r.expectancy - b.expectancy };
      }) })) };
  }).sort((a, b) => b.fullNet - a.fullNet);
  json('ranking.json', ranking); json('results.json', results); json('monthly.json', monthly); json('responses.json', responseRows);
  fs.writeFileSync(path.join(out, 'results.csv'), csv(results)); fs.writeFileSync(path.join(out, 'monthly.csv'), csv(monthly)); fs.writeFileSync(path.join(out, 'responses.csv'), csv(responseRows));
  const table = (rs: any[]) => '| Setup | W / L | Winning $ | Losing $ | Avg loss $ | Net incl open $ | DD% on $32k | Extra-cost net $ |\n|---|---:|---:|---:|---:|---:|---:|---:|\n' + rs.map(r => `| ${r.id} | ${r.wins}/${r.losses} | ${dollar(r.winningDollars)} | ${dollar(r.losingDollars)} | ${r.avgLoss === null ? '-' : dollar(r.avgLoss)} | ${dollar(r.net)} | ${r.maxAdverseDrawdownPct.toFixed(2)} | ${dollar(r.stressNet)} |`).join('\n');
  let report = '# PB01: fixed $10k POC bounce entries\n\n30 rules, three windows, two action delays. No ladder. Closed-minute touch observations buy next open, NOT resting-limit fills. No TP/SL; 12h exit. Fees 0.055%/side, before funding. DD on $32k. Cash baseline $0/0%DD.\n\n';
  for (const w of windows) for (const delay of [0, M]) {
    report += `## ${w.id}: ${new Date(w.start).toISOString()} to ${new Date(w.end).toISOString()}, extra delay ${delay / M}m\n\n`;
    const rs = results.filter(r => r.window === w.id && r.delay === delay && r.kind === 'strategy').sort((a, b) => b.net - a.net);
    report += table([results.find(r => r.id === 'clock' && r.window === w.id && r.delay === delay), ...rs]) + '\n\n';
  }
  report += '## Qualification\n\n' + ranking.map(r => `- ${r.id}: ${r.pass ? 'PASS' : r.failures.join(', ')}; worst monthly delta $${dollar(r.worstMonthlyDelta)}.`).join('\n') + '\n\n';
  report += '## Monthly marked dollars: full window, primary delay; clock beside top five\n\n';
  const top = ranking.slice(0, 5).map(r => r.id), months = monthly.filter(r => r.id === 'clock' && r.window === 'full' && !r.delay);
  report += '| Month | Clock $ | ' + top.map(id => id + ' $ / delta $').join(' | ') + ' |\n|---|' + Array(top.length + 1).fill('---:|').join('') + '\n';
  for (const m of months) report += `| ${m.month} | ${dollar(m.markedNet)} | ` + top.map(id => { const x = monthly.find(r => r.id === id && r.window === 'full' && !r.delay && r.month === m.month); return `${dollar(x.markedNet)} / ${dollar(x.deltaVsClock)}`; }).join(' | ') + ' |\n';
  report += '\nAll 30 monthly W/L and both delays are in monthly.csv. Shifted controls are in results.csv and ranking.json; these are not placebo price maps. Detailed accepted/skipped occupancy and trade receipts are saved per run.\n';
  fs.writeFileSync(path.join(out, 'report.md'), report);
  for (const p of pins) assert.equal(await fileHash(path.join(ROOT, p.file)), p.sha256, 'Pin changed during run: ' + p.file);
  const artifacts = []; for (const f of fs.readdirSync(out).sort()) artifacts.push({ file: f, sha256: await fileHash(path.join(out, f)) });
  json('complete.json', { key, passedGenerationChecks: true, strategyDefinitions: 30, calendarDefinitions: 90, executionPaths: results.length,
    controlParity: 6, prefixSignalChecks: prefix.signals.length, fundingIncluded: false, liveChanges: 0, artifacts });
  console.log(`[PB01] complete ${out}; ${ranking.filter(r => r.pass).length}/30 strict passes; run independent verifier`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
