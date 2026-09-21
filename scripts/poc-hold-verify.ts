/** PB02 independent minute-engine replay, archived-control and attribution audit. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileHash, atomicJson, inside } from './research-workflow';
import { loadMinutes } from './relative-reversion-study';
import { runCappedEntry } from './entry-patience-standalone-engine';
import { openPocMap } from './poc-map-reader';
import { assertEconomics } from './poc-bounce-study';
import { ROOT, readJson, loadParent } from './poc-hold-study';
const M = 60000, H = M * 60;
async function main() {
  const out = inside(ROOT, process.argv[2]), plan = readJson(path.join(out, 'plan.json')), seal = readJson(path.join(out, 'complete.json')), c = plan.card;
  assert.equal(plan.key, seal.key); assert(!fs.existsSync(path.join(out, 'independent-verification.json')), 'Already verified');
  for (const a of seal.artifacts) assert.equal(await fileHash(path.join(out, a.file)), a.sha256, 'Artifact changed: ' + a.file);
  for (const p of plan.pins) assert.equal(await fileHash(inside(ROOT, p.file)), p.sha256, 'Pin changed: ' + p.file);
  const parent = await loadParent(c), signals = readJson(path.join(out, 'signals.json'));
  assert.deepEqual(signals, parent.signals);
  const { candles } = await loadMinutes(ROOT, 'HYPEUSDT', Date.parse(c.end), parent.plan.card.repair);
  const cs = candles.filter(x => x.ts >= Date.parse(c.start)), base = cs[0].ts, at = (t: number) => { const x = cs[(t - base) / M]; assert(x && x.ts === t); return x; };
  const map = await openPocMap(path.join(ROOT, parent.plan.card.map, 'map.json'));
  for (const s of parent.signals) {
    assert.equal(s.signalAt, s.touchStart + M); assert.equal(s.style, 0); assert.equal(s.period, 'day'); assert.equal(s.universe, 'naked');
    const p = map.at(s.touchStart, { venue: 'bybit', period: 'day', width: '0.10' }).find(p => p.id === s.profileId)!;
    assert(p && p.availableAt <= s.touchStart && p.status === 'untested'); assert.equal(Number(p.lower), s.lower); assert.equal(Number(p.upper), s.upper);
    const touch = at(s.touchStart); assert(at(s.touchStart - M).close > s.upper && touch.low < s.upper && touch.high >= s.lower);
    const after = map.at(s.signalAt, { venue: 'bybit', period: 'day', width: '0.10' }).find(x => x.id === p.id)!;
    assert.equal(after.retestEvidenceAt, s.signalAt); assert.equal(after.firstRetestExact, true);
  }
  const results = readJson(path.join(out, 'results.json')), monthly = readJson(path.join(out, 'monthly.json')); assert.equal(results.length, 54);
  let verifiedPaths = 0, fills = 0, archivedParity = 0;
  for (const r of results) {
    const run = readJson(path.join(out, r.file)), o = run.options;
    assert(c.holdsHours.includes(r.hours)); assert.equal(o.hold, r.hours * H); assert.equal(o.delay, r.delay); assert.equal(o.fee, c.feeRate); assert.equal(o.notional, c.notional);
    const selected = cs.slice((o.start - base) / M, (o.end - base) / M), selectedSignals = parent.signals.filter(s => s.signalAt >= o.start && s.signalAt < o.end);
    const ref = runCappedEntry(selected, selectedSignals.map(s => ({ at: s.signalAt, cap: 1 })), { start: o.start, end: o.end,
      delayMs: o.delay, holdMs: o.hold, notional: o.notional, equity: o.equity, feeRate: o.fee, expiryMinutes: null, penetrationBps: 0 });
    assertEconomics(run, ref); assert.equal(run.stats.rawSignals, ref.stats.rawSignals); assert.equal(run.stats.skippedOccupied, ref.stats.skippedOccupied); fills += run.trades.length;
    const a = readJson(path.join(out, `${r.window}-${r.delay}-hold12.json`));
    if (r.hours === 12) {
      const old = readJson(path.join(parent.dir, `${r.window}-${r.delay}-${c.rule}.json`));
      for (const f of ['trades', 'open', 'monthly', 'accepted', 'stats']) assert.deepEqual(run[f], old[f]); archivedParity++;
    }
    const gross = run.trades.reduce((s: number, x: any) => s + x.net, 0), openNet = run.open?.net ?? 0;
    assert(Math.abs(gross + openNet - run.stats.net) < 1e-6); assert(Math.abs(r.delta - (run.stats.net - a.stats.net)) < 1e-6);
    const av = new Map([...a.trades, ...(a.open ? [a.open] : [])].map((t: any) => [t.id, t])), bv = new Map([...run.trades, ...(run.open ? [run.open] : [])].map((t: any) => [t.id, t]));
    let common = 0, added = 0, removed = 0; const expectedRows = [];
    for (const id of new Set([...av.keys(), ...bv.keys()])) {
      const x: any = av.get(id), y: any = bv.get(id);
      if (x && y) common += y.net - x.net; else if (y) added += y.net; else removed += x.net;
      expectedRows.push({ id, delta: (y?.net ?? 0) - (x?.net ?? 0) });
    }
    assert.equal(expectedRows.length, run.attribution.rows.length);
    for (const x of expectedRows) assert(Math.abs(x.delta - run.attribution.rows.find((y: any) => y.id === x.id).delta) < 1e-7);
    for (const [field, value] of [['commonExitDelta', common], ['variantOnlyNet', added], ['baselineOnlyNet', removed]] as const) assert(Math.abs(run.attribution.summary[field] - value) < 1e-6);
    assert(Math.abs(common + added - removed - r.delta) < 1e-6);
    const ms = monthly.filter((m: any) => m.hours === r.hours && m.window === r.window && m.delay === r.delay);
    run.monthly.forEach((m: any, i: number) => { for (const k of Object.keys(m)) assert.equal(ms[i][k], m[k]); assert(Math.abs(ms[i].delta - m.markedNet + a.monthly[i].markedNet) < 1e-7); });
    verifiedPaths++;
    if (verifiedPaths % 6 === 0) console.log(`[PB02 verify] ${verifiedPaths}/54 reference paths checked`);
  }
  // Recompute qualifications from paths, not the runner's labels.
  const ranking = readJson(path.join(out, 'ranking.json'));
  for (const q of ranking) {
    const rs = results.filter((r: any) => r.hours === q.hours), ms = monthly.filter((m: any) => m.hours === q.hours), failures = [];
    if (rs.some((r: any) => r.net <= 0)) failures.push('nonpositive_net'); if (rs.some((r: any) => r.delta <= 0)) failures.push('not_all_path_net_improvement');
    if (rs.some((r: any) => r.ddDelta > 1e-8)) failures.push('drawdown_regression'); if (ms.some((m: any) => m.delta < -1e-8)) failures.push('monthly_regression');
    if (rs.some((r: any) => r.stressNet <= 0)) failures.push('cost_stress'); if (rs.some((r: any) => r.trades < (r.window === 'full' ? 30 : 10))) failures.push('sample');
    if (rs.some((r: any) => r.bankrupt)) failures.push('equity'); assert.deepEqual(q.failures, failures); assert.equal(q.pass, !failures.length);
  }
  for (const a of seal.artifacts) assert.equal(await fileHash(path.join(out, a.file)), a.sha256);
  atomicJson(path.join(out, 'independent-verification.json'), { passed: true, key: plan.key, signalClockChecks: parent.signals.length,
    referencePaths: verifiedPaths, archivedParity, tradesChecked: fills, verifierSha256: await fileHash(__filename), verifiedAt: Date.now() });
  console.log('[PB02 verify] passed');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
