import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson, fileHash, sha } from './research-workflow';
import { loadMinutes } from './relative-reversion-study';
import { runSchedule, validateTape } from './poc-bounce-engine';
import { csv } from './poc-bounce-study';
import { M, H, D, aggregate, indicatorTape, partitions, dailySignals, failureTriggers, replay, amounts, type Action, type Row } from './poc-indicator-bias-engine';
export const ROOT = path.resolve(__dirname, '..'), CARD = 'research-inputs/poc-indicator-daily-bias-2026-09-17.json';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
async function accepted(dir: string) {
  const p = read(dir + '/plan.json'), s = read(dir + '/complete.json'), v = read(dir + '/independent-verification.json');
  assert(v.passed && p.key === s.key);
  for (const a of s.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, a.file)), a.sha256, 'Changed accepted artifact: ' + a.file);
  return p;
}
export async function main() {
  const c = read(CARD), start = Date.parse(c.start), split = Date.parse(c.split), end = Date.parse(c.end);
  const parentPlan = await accepted(c.parent); await accepted(c.hlParent);
  const files = [CARD, 'scripts/poc-indicator-bias-engine.ts', 'scripts/poc-indicator-bias-study.ts', 'scripts/poc-indicator-bias-tests.ts',
    'scripts/poc-indicator-bias-verify.ts', 'scripts/poc-bounce-engine.ts', 'scripts/relative-reversion-study.ts',
    'scripts/replay-candle-repair.ts', 'scripts/research-workflow.ts', 'scripts/poc-bounce-study.ts',
    ...['indicator', 'vwap-volume', 'volume-flow', 'macd', 'bollinger'].map(n => 'src/research/' + n + '-features.ts'),
    'data/HYPEUSDT_1_full.json', 'data/HYPEUSDT_1m.jsonl', c.repair,
    ...[c.parent, c.hlParent].flatMap(dir => ['plan.json', 'complete.json', 'independent-verification.json'].map(f => dir + '/' + f)),
    c.parent + '/signals.json', c.hlParent + '/events.json', 'bot-config.json', 'hl-short-live-config.json', 'bot-state.json'];
  const pins = []; for (const file of files) pins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  const key = sha(JSON.stringify({ c, pins, node: process.version })), out = path.join(ROOT, 'backtests/poc-indicator-bias', key);
  assert(!fs.existsSync(out), 'Immutable output already exists; reuse it'); fs.mkdirSync(out, { recursive: true });
  const write = (f: string, x: any) => atomicJson(path.join(out, f), x);
  write('plan.json', { key, card: c, pins, node: process.version, createdAt: Date.now(), parentKey: parentPlan.key });
  console.log('[PI01/DB01] ' + out);
  const loaded = await loadMinutes(ROOT, 'HYPEUSDT', end, c.repair), cs = loaded.candles.filter(b => b.ts >= start);
  validateTape(cs, start, end); write('coverage.json', loaded.audit);
  const signals: Row[] = read(c.parent + '/signals.json'); assert.equal(signals.length, 264);
  const windows = [{ id: 'full', start, end }, { id: 'older', start, end: split }, { id: 'recent', start: split, end }];
  const bases = new Map<string, any>();
  const options = (w: Row, delay: number, hold = 12 * H) => ({ start: w.start, end: w.end, delay, hold, notional: c.notional, equity: c.equity, fee: c.fee });
  const longSignals: Action[] = signals.map(s => ({ id: s.id, at: s.signalAt, side: 1 }));
  for (const w of windows) for (const delay of [0, M]) {
    const old = read(`${c.parent}/${w.id}-${delay}-hold12.json`), o = options(w, delay);
    const canonical = runSchedule(cs, longSignals.map(({ id, at }) => ({ id, at })), o), run = replay(cs, longSignals, o);
    for (const field of ['trades', 'open', 'stats', 'monthly', 'accepted']) assert.deepEqual((canonical as Row)[field], old[field], 'Parent parity: ' + field);
    for (const [k, v] of Object.entries(old.stats)) assert.deepEqual((run.stats as Row)[k], v, 'Generic baseline stats: ' + k);
    assert.deepEqual(run.monthly, old.monthly); assert.deepEqual(run.accepted, old.accepted);
    assert.equal(run.trades.length, old.trades.length);
    old.trades.forEach((t: Row, i: number) => { for (const [k, v] of Object.entries(t)) assert.deepEqual(run.trades[i][k], v, 'Generic fill: ' + k); });
    assert.equal(!!run.open, !!old.open); if (old.open) for (const [k, v] of Object.entries(old.open)) assert.deepEqual(run.open![k], v);
    bases.set(w.id + ':' + delay, run);
    console.log(`[control] ${w.id}/${delay} exactly reproduced $${run.stats.net.toFixed(2)}`);
  }
  write('baseline-parity.json', { passed: true, paths: 6, canonicalAndGenericExact: true });
  // The indicator and outcome join starts only after archived controls pass.
  const tape = indicatorTape(cs), byId = new Map(signals.map(s => [s.id, s])), hl = new Map(read(c.hlParent + '/events.json').map((e: Row) => [e.id, e])) as Map<string, Row>;
  const primary = bases.get('full:0'), eventSets: Row[][] = [];
  for (const lag of c.indicatorPublicationLagsMs) {
    const events = primary.trades.map((t: Row) => {
      const s = byId.get(t.id)!, x = tape.at(t.signalAt, lag), lead = tape.at(t.signalAt - 15 * M, lag), pulse = hl.get(t.id);
      const hlf = lag === M ? pulse?.features : pulse?.sourceDelayFeatures;
      const features = { ...x.features, hl_buyShareAcceleration: hlf?.buyShareAcceleration ?? null,
        hl_takerRatio15: hlf?.takerRatio15 ?? null, hl_takerRatio60: hlf?.takerRatio60 ?? null, hl_bookImbalance05: hlf?.bookImbalance05 ?? null };
      let low = t.entryPrice, high = t.entryPrice;
      for (let at = t.entryAt; at < t.exitAt; at += M) { const b = cs[(at - start) / M]; low = Math.min(low, b.low); high = Math.max(high, b.high); }
      return { ...t, entryIso: new Date(t.entryAt).toISOString(), exitIso: new Date(t.exitAt).toISOString(),
        month: new Date(t.entryAt).toISOString().slice(0, 7), heavy: t.net <= c.heavyLossNetUsd,
        outcomeMaePct: 100 * (low / t.entryPrice - 1), outcomeMfePct: 100 * (high / t.entryPrice - 1),
        pocLower: s.lower, pocUpper: s.upper, snapshot: x, leadIn: lead, features, hlCovered: pulse?.quality.coreHealthy ?? false };
    });
    eventSets.push(events); write(`events-${lag}.json`, events);
    write(`partitions-${lag}.json`, partitions(events, c.diagnostics, split));
    write(`hl-partitions-${lag}.json`, partitions(events.filter((e: Row) => e.hlCovered), c.diagnostics.slice(-2), Date.parse('2026-07-15T00:00:00Z')));
    fs.writeFileSync(path.join(out, `events-${lag}.csv`), csv(events.map((e: Row) => ({ id: e.id, entryUtc: e.entryIso, exitUtc: e.exitIso,
      net: e.net, heavy: e.heavy, pocLower: e.pocLower, pocUpper: e.pocUpper, ...e.features,
      outcomeMaePct: e.outcomeMaePct, outcomeMfePct: e.outcomeMfePct }))));
  }
  const distribution: Row[] = [], events = eventSets[0];
  const med = (xs: number[]) => { xs.sort((a, b) => a - b); return xs.length ? (xs[Math.floor((xs.length - 1) / 2)] + xs[Math.floor(xs.length / 2)]) / 2 : null; };
  for (const feature of Object.keys(events[0].features)) {
    const known = events.filter(e => e.features[feature] !== null && Number.isFinite(e.features[feature]));
    const stats = (rs: Row[]) => ({ n: rs.length, median: med(rs.map(e => e.features[feature])) });
    distribution.push({ feature, known: known.length, winners: stats(known.filter(e => e.net > 0)), losers: stats(known.filter(e => e.net < 0)),
      heavy: stats(known.filter(e => e.heavy)), missing: events.length - known.length });
  }
  write('feature-distributions.json', distribution);
  write('heaviest-losses.json', [...events].sort((a, b) => a.net - b.net).slice(0, 20));
  const definitions: { id: string; family: string; signals: Action[]; hold: number }[] = [{ id: 'poc12_baseline', family: 'poc_baseline', signals: longSignals, hold: 12 * H }];
  const bars15 = aggregate(cs, 15 * M), bars4h = aggregate(cs, 4 * H), daily = aggregate(cs, D);
  for (const count of c.pocActions.consecutiveCloses) {
    const failures = failureTriggers(signals, bars15, count); write(`poc-failures-${count}.json`, [...failures.entries()]);
    definitions.push({ id: `poc_exit${count}`, family: 'poc_exit', hold: 12 * H,
      signals: longSignals.map(s => ({ ...s, failureAt: failures.get(s.id)?.at, evidence: failures.get(s.id) })) });
    const shorts = signals.filter(s => failures.has(s.id)).map(s => ({ id: s.id, at: failures.get(s.id)!.at, side: -1 as const, evidence: failures.get(s.id) })).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    definitions.push({ id: `poc_short${count}`, family: 'poc_short', signals: shorts.filter((s, i) => !i || s.at !== shorts[i - 1].at), hold: 12 * H });
  }
  for (const width of c.dailyBias.swingWidths) for (const session of c.dailyBias.sessionsUtc) for (const target of c.dailyBias.targetModes) {
    const id = `w${width}_s${session}_${target}`, d = dailySignals(cs, bars4h, daily, width, session, target);
    write(`decisions-${id}.json`, d); definitions.push({ id, family: 'daily_bias', signals: d.signals, hold: D });
  }
  for (const session of c.dailyBias.sessionsUtc) for (const side of [1, -1] as const) {
    const clock: Action[] = [];
    for (let day = Math.ceil(start / D) * D; day + session * H + M < end; day += D) {
      const at = day + session * H + M; clock.push({ id: `clock:${session}:${side}:${at}`, at, side, expiresAt: at + D });
    }
    definitions.push({ id: `clock_s${session}_${side}`, family: 'clock', signals: clock, hold: D });
  }
  write('signals.json', definitions.map(({ id, family, signals, hold }) => ({ id, family, signals, hold })));
  const results: Row[] = [], months: Row[] = [], economics: Row[] = [];
  for (const d of definitions) for (const w of windows) for (const delay of [0, M]) for (const targetFirst of d.family === 'daily_bias' ? [false, true] : [false]) {
    const o = { ...options(w, delay, d.hold), targetFirst }, run = replay(cs, d.signals, o), baseline = bases.get(w.id + ':' + delay);
    const file = `${d.id}-${w.id}-${delay}-${targetFirst ? 'targetfirst' : 'primary'}.json`;
    write(file, { definition: d.id, family: d.family, options: o, ...run });
    results.push({ id: d.id, family: d.family, window: w.id, delay, targetFirst, ...run.stats,
      stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * c.extraCostBpsPerSide / 10000,
      baselineNet: baseline.stats.net, baselineDd: baseline.stats.maxAdverseDrawdownPct, delta: run.stats.net - baseline.stats.net,
      ddDelta: run.stats.maxAdverseDrawdownPct - baseline.stats.maxAdverseDrawdownPct, file });
    months.push(...run.monthly.map(m => ({ id: d.id, family: d.family, window: w.id, delay, targetFirst, ...m,
      baselineMarkedNet: baseline.monthly.find((b: Row) => b.month === m.month).markedNet,
      delta: m.markedNet - baseline.monthly.find((b: Row) => b.month === m.month).markedNet })));
    economics.push({ id: d.id, window: w.id, delay, targetFirst, bull: amounts(run.trades.filter(t => t.side === 1)), bear: amounts(run.trades.filter(t => t.side === -1)),
      reasons: Object.fromEntries(['target', 'stop', 'timeout', 'poc_failure'].map(reason => [reason, amounts(run.trades.filter(t => t.reason === reason))])),
      top5WinDollars: [...run.trades].sort((a, b) => b.net - a.net).slice(0, 5).reduce((v, t) => v + Math.max(0, t.net), 0),
      netWithoutBest: run.stats.net - run.stats.best });
    if (w.id === 'full' && !delay && !targetFirst) {
      console.log(`[replay] ${d.id} ${run.stats.wins}W/${run.stats.losses}L $${run.stats.net.toFixed(0)} DD${run.stats.maxAdverseDrawdownPct.toFixed(2)}`);
      fs.writeFileSync(path.join(out, `trades-${d.id}.csv`), csv(run.trades.map(t => ({ entryUtc: new Date(t.entryAt).toISOString(), exitUtc: new Date(t.exitAt).toISOString(),
        side: t.side === 1 ? 'long' : 'short', entry: t.entryPrice, exit: t.exitPrice, target: t.target, invalidation: t.stop, result: t.reason,
        net: t.net, r: t.r, bias: t.evidence?.bias ?? d.id, id: t.id }))));
    }
  }
  const rankings = definitions.filter(d => ['poc_exit', 'poc_short', 'daily_bias'].includes(d.family)).map(d => {
    const rs = results.filter(r => r.id === d.id && !r.targetFirst), ms = months.filter(r => r.id === d.id && !r.targetFirst), failures: string[] = [];
    if (rs.some(r => r.net <= 0)) failures.push('nonpositive_net');
    if (rs.some(r => r.stressNet <= 0)) failures.push('cost_stress');
    if (rs.some(r => r.trades < (r.window === 'full' ? 30 : 10))) failures.push('sample');
    if (rs.some(r => r.bankrupt)) failures.push('equity');
    if (d.family === 'poc_exit') { if (rs.some(r => r.delta <= 0)) failures.push('net_regression'); if (rs.some(r => r.ddDelta > 1e-8)) failures.push('dd_regression'); }
    if (ms.some(r => (d.family === 'poc_exit' ? r.delta : r.markedNet) < -250)) failures.push('monthly');
    return { id: d.id, family: d.family, pass: !failures.length, failures, fullNet: rs.find(r => r.window === 'full' && !r.delay)!.net,
      minNet: Math.min(...rs.map(r => r.net)), worstMonth: Math.min(...ms.map(r => d.family === 'poc_exit' ? r.delta : r.markedNet)) };
  }).sort((a, b) => b.fullNet - a.fullNet);
  write('results.json', results); write('monthly.json', months); write('economics.json', economics); write('ranking.json', rankings);
  fs.writeFileSync(path.join(out, 'results.csv'), csv(results)); fs.writeFileSync(path.join(out, 'monthly.csv'), csv(months));
  const fmt = (n: number | null) => n === null ? 'NA' : n.toFixed(0), dd = (r: Row) => r.maxAdverseDrawdownPct.toFixed(2);
  let report = '# PI01/DB01\n\n$10k fixed notional; DD on $32k. Fees0.055%/side; before funding. No ladder change.\n\n';
  report += `Period ${c.start} to ${c.end}; split ${c.split}. Same accepted POC map/signals, no regeneration.\n\n`;
  report += '## POC baseline and fixed failure probes\n\n| Window | Setup | W/L | Win$ | Loss$ | Avg loss$ | Net$ | Baseline net$ | Delta$ | DD% |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n';
  for (const r of results.filter(r => r.family.startsWith('poc') && !r.delay)) report += `|${r.window}|${r.id}|${r.wins}/${r.losses}|${fmt(r.winningDollars)}|${fmt(r.losingDollars)}|${fmt(r.avgLoss)}|${fmt(r.net)}|${fmt(r.baselineNet)}|${fmt(r.delta)}|${dd(r)}|\n`;
  report += '\nShort-probe delta is comparison of separate strategies, NOT overlay profit.\n\n## Indicator partitions (fixed original cohort, not a filter replay)\n\n| Condition | Known n/net$ | True W/L/net$ | False W/L/net$ | Heavy captured/total | Winners sacrificed$ | Early mean true/false$ | Later mean true/false$ |\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
  const ps = partitions(events, c.diagnostics, split);
  for (const p of ps) report += `|${p.id}|${p.baseline.n}/${fmt(p.baseline.net)}|${p.condition.wins}/${p.condition.losses}/${fmt(p.condition.net)}|${p.other.wins}/${p.other.losses}/${fmt(p.other.net)}|${p.condition.heavy}/${p.baseline.heavy}|${fmt(p.sacrificedWinners.net)}|${fmt(p.early.condition.average)}/${fmt(p.early.other.average)}|${fmt(p.late.condition.average)}/${fmt(p.late.other.average)}|\n`;
  report += '\n## Daily bias (primary execution)\n\n| Window | Setup | W/L | Win$ | Loss$ | Net$ | PF | Avg R | DD% |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n';
  for (const w of windows) for (const r of results.filter(r => r.family === 'daily_bias' && r.window === w.id && !r.delay && !r.targetFirst).sort((a, b) => b.net - a.net))
    report += `|${w.id}|${r.id}|${r.wins}/${r.losses}|${fmt(r.winningDollars)}|${fmt(r.losingDollars)}|${fmt(r.net)}|${r.profitFactor?.toFixed(2) ?? 'NA'}|${r.avgR?.toFixed(3) ?? 'NA'}|${dd(r)}|\n`;
  report += '\nFull results.csv includes session-matched long/short clocks, extra60s action delays, and target-first ambiguity. economics.json separates bull/bear and target/stop/timeout (ex-post labels).\n\n## Qualification\n\n';
  report += rankings.map(r => `- ${r.id}: ${r.pass ? 'PASS research screen only' : r.failures.join(', ')}; worst month${fmt(r.worstMonth)}.`).join('\n');
  report += '\n\nThese are correlated retrospective experiments, not out-of-sample proof. Heavy-loss associations cannot be substituted for executable short returns. No POC multiplier or ladder transfer tested.\n';
  fs.writeFileSync(path.join(out, 'report.md'), report);
  // Small offline equity chart: fixed daily-bias primary, best full-history cell, POC baseline/probes.
  const bestDaily = rankings.find(r => r.family === 'daily_bias')!;
  const ids = [...new Set(['poc12_baseline', 'poc_exit1', 'poc_exit2', c.dailyBias.primary, bestDaily.id])];
  const curves = ids.map(id => ({ id, rows: read(path.relative(ROOT, path.join(out, `${id}-full-0-primary.json`))).curve }));
  const points = curves.flatMap(x => x.rows), lo = Math.min(c.equity, ...points.map(x => x.equity)), hi = Math.max(c.equity, ...points.map(x => x.equity));
  const colors = ['#ccc', '#ffae42', '#e56bba', '#4caaff', '#69d394'];
  fs.writeFileSync(path.join(out, 'equity.html'), `<!doctype html><meta charset="utf-8"><title>PI01 DB01</title><style>body{background:#171b23;color:#eee;font:16px system-ui}svg{width:100%;max-width:1200px}p{max-width:1000px}</style><h1>Fixed-$10k research equity ($32k start)</h1><p>${c.start} to ${c.end}. Daily sampled MTM; fees included, funding excluded. Best daily cell is selected in-sample, not a recommendation. Range $${fmt(lo)}–$${fmt(hi)}.</p><svg viewBox="0 0 1100 420">${curves.map((x, i) => `<polyline fill="none" stroke="${colors[i]}" stroke-width="2" points="${x.rows.map((p: Row) => `${20 + 1060 * (p.at - start) / (end - start)},${400 - 380 * (p.equity - lo) / (hi - lo || 1)}`).join(' ')}"/>`).join('')}</svg>${curves.map((x, i) => `<p style="color:${colors[i]}">${x.id}</p>`).join('')}`);
  for (const p of pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, 'Input/source/live file changed during run: ' + p.file);
  const artifacts = []; for (const file of fs.readdirSync(out).sort()) artifacts.push({ file, sha256: await fileHash(path.join(out, file)) });
  write('complete.json', { key, artifacts, newEconomicDefinitions: 22, diagnosticComparisons: 24, paths: results.length, generationChecks: true });
  console.log(`[PI01/DB01] complete ${out}; ${rankings.filter(r => r.pass).length}/22 pass; independent verification required`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
