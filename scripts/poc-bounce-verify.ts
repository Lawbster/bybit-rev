/** Independent PB01 receipts/clock audit plus reference-engine reproduction of all strategy paths. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileHash, atomicJson, inside } from './research-workflow';
import { loadMinutes } from './relative-reversion-study';
import { openPocMap } from './poc-map-reader';
import { periodStart } from './poc-profile-engine';
import { runCappedEntry } from './entry-patience-standalone-engine';
const M = 60000, H = 60 * M;
const ROOT = path.resolve(__dirname, '..');
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
async function main() {
  const out = inside(ROOT, process.argv[2]), plan = read(path.join(out, 'plan.json')), seal = read(path.join(out, 'complete.json')), c = plan.card;
  assert.equal(plan.key, seal.key); assert(!fs.existsSync(path.join(out, 'independent-verification.json')), 'Already verified');
  for (const a of seal.artifacts) assert.equal(await fileHash(path.join(out, a.file)), a.sha256, a.file);
  for (const p of plan.pins) assert.equal(await fileHash(path.join(ROOT, p.file)), p.sha256, p.file);
  const reader = await openPocMap(path.join(ROOT, c.map, 'map.json'));
  const { candles } = await loadMinutes(ROOT, 'HYPEUSDT', Date.parse(c.end), c.repair);
  const minutes = candles.filter(x => x.ts >= Date.parse(c.start)), base = minutes[0].ts;
  const at = (t: number) => { const v = minutes[(t - base) / M]; assert(v && v.ts === t); return v; };
  const signals = read(path.join(out, 'signals.json')), encounters = read(path.join(out, 'encounters.json'));
  const bad = new Set(read(path.join(ROOT, c.map, 'quality-issues.json')).filter((r: any) => r.venue === 'bybit').map((r: any) => r.at));
  const seen = new Set<string>(); let queries = 0;
  for (const e of encounters) {
    assert(!seen.has(e.id)); seen.add(e.id);
    assert(e.availableAt <= e.touchStart && e.at === e.touchStart + M && !bad.has(e.touchStart));
    const prev = at(e.touchStart - M), touch = at(e.touchStart);
    assert.equal(e.priorClose, prev.close); assert(prev.close > e.upper && touch.low < e.upper && touch.high >= e.lower);
    const p = reader.at(e.touchStart, { venue: 'bybit', period: e.period, width: '0.10' }).find(x => x.id === e.profileId)!; assert(p); queries++;
    assert.equal(e.lower, Number(p.lower)); assert.equal(e.upper, Number(p.upper)); assert.equal(e.profileEnd, p.end); assert.equal(e.availableAt, p.availableAt);
    if (e.universe === 'latest') assert.equal(p.end, periodStart(e.touchStart - M, e.period));
    else {
      assert.equal(p.status, 'untested'); const after = reader.at(e.at, { venue: 'bybit', period: e.period, width: '0.10' }).find(x => x.id === p.id)!; queries++;
      assert.equal(after.status, 'tested'); assert.equal(after.retestEvidenceAt, e.at); assert.equal(after.firstRetestExact, true);
    }
  }
  const byEncounter = new Map(encounters.map((e: any) => [e.id, e])); const signalKeys = new Set<string>();
  for (const s of signals) {
    assert(byEncounter.has(s.id)); const key = s.rule + ':' + s.signalAt; assert(!signalKeys.has(key)); signalKeys.add(key);
    assert(s.signalAt >= s.at && s.signalAt <= s.at + H && s.signalAt <= reader.cutoff);
    if (!s.style) assert.equal(s.signalAt, s.at);
    else {
      assert.equal(s.signalAt % (s.style * M), 0); assert.equal(s.confirmationStart, s.signalAt - s.style * M); assert(s.confirmationStart >= s.availableAt);
      assert(at(s.signalAt - M).close > s.upper); assert(!bad.has(s.signalAt - M));
      for (let t = Math.ceil(s.at / (s.style * M)) * s.style * M; t < s.signalAt; t += s.style * M)
        assert(t - s.style * M < s.availableAt || bad.has(t - M) || at(t - M).close <= s.upper, 'Skipped earlier valid confirmation');
    }
  }
  console.log(`[PB01 verify] ${encounters.length} encounters / ${signals.length} decisions independently audited`);
  const results = read(path.join(out, 'results.json')); let referencePaths = 0, tradesChecked = 0;
  for (let ri = 0; ri < results.length; ri++) {
    const r = results[ri], run = read(path.join(out, r.file)), o = run.options;
    let schedule: { at: number; id: string }[];
    if (r.kind === 'clock') {
      schedule = []; for (let t = Math.ceil(o.start / (12 * H)) * 12 * H; t < o.end; t += 12 * H + 2 * o.delay) schedule.push({ at: t, id: 'clock:' + t });
    } else {
      const match = r.id.match(/_shift(\d+)d$/), days = match ? Number(match[1]) : 0, id = match ? r.id.slice(0, -match[0].length) : r.id;
      schedule = signals.filter((s: any) => s.rule === id && s.signalAt >= o.start && s.signalAt < o.end)
        .map((s: any) => ({ at: s.signalAt + days * 24 * H, id: s.id })).filter((s: any) => s.at < o.end);
    }
    let busyUntil = o.start; const accepted: any[] = [];
    for (const s of schedule) if (s.at >= busyUntil) { accepted.push(s); busyUntil = s.at + 2 * o.delay + o.hold; }
    assert.deepEqual(run.accepted.map((s: any) => ({ at: s.at, id: s.id })), accepted);
    const expectedClosed = accepted.filter(s => s.at + 2 * o.delay + o.hold < o.end);
    assert.equal(run.trades.length, expectedClosed.length);
    run.trades.forEach((t: any, i: number) => {
      const s = expectedClosed[i]; assert.equal(t.id, s.id); assert.equal(t.signalAt, s.at); assert.equal(t.entryAt, s.at + o.delay); assert.equal(t.exitAt, t.entryAt + o.hold + o.delay);
      assert.equal(t.entryPrice, at(t.entryAt).open); assert.equal(t.exitPrice, at(t.exitAt).open);
      const qty = o.notional / t.entryPrice, gross = qty * (t.exitPrice - t.entryPrice), fees = (o.notional + qty * t.exitPrice) * o.fee;
      assert(Math.abs(t.qty - qty) < 1e-8 && Math.abs(t.net - gross + fees) < 1e-7 && Math.abs(t.fees - fees) < 1e-7); tradesChecked++;
    });
    assert(Math.abs(run.monthly.reduce((s: number, x: any) => s + x.markedNet, 0) - run.stats.net) < 1e-6);
    for (const k of Object.keys(run.stats)) assert.equal(r[k], run.stats[k]);
    // All 180 economic strategy paths, not just favorable examples, use the old independent minute engine as the reference.
    if (r.kind === 'strategy' || r.kind === 'clock') {
      const cs = minutes.slice((o.start - base) / M, (o.end - base) / M);
      const ref = runCappedEntry(cs, schedule.map(s => ({ at: s.at, cap: 1 })), { start: o.start, end: o.end,
        delayMs: o.delay, holdMs: o.hold, notional: o.notional, equity: o.equity, feeRate: o.fee, expiryMinutes: null, penetrationBps: 0 });
      for (const key of ['net', 'closedNet', 'openNet', 'feesPaid', 'turnoverIncludingMarkedExit', 'exposureHours', 'maxAdverseDrawdownPct', 'maxCloseDrawdownPct', 'rawSignals', 'skippedOccupied'] as const)
        assert(Math.abs(ref.stats[key] - run.stats[key]) < 1e-6, `${r.file} ${key}: ${ref.stats[key]} vs ${run.stats[key]}`);
      run.monthly.forEach((x: any, i: number) => assert(Math.abs(x.markedNet - ref.monthly[i].markedNet) < 1e-6, 'Monthly MTM mismatch'));
      referencePaths++;
    }
    if (ri % 48 === 0) console.log(`[PB01 verify] ${ri + 1}/${results.length} paths; ${referencePaths} independent minute replays`);
  }
  for (const a of seal.artifacts) assert.equal(await fileHash(path.join(out, a.file)), a.sha256, a.file);
  atomicJson(path.join(out, 'independent-verification.json'), { passed: true, key: plan.key, decisions: signals.length, encounters: encounters.length,
    mapQueries: queries, referencePaths, economicPaths: results.length, tradesChecked, verifiedAt: Date.now(), verifierSha256: await fileHash(__filename) });
  console.log('[PB01 verify] passed');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
