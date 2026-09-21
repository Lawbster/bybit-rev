/** Independent arithmetic, source reconstruction and ownership audit; no producer signal/replay calls. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileHash, atomicJson } from './research-workflow';
import { cachedAtlas, cachedCandles, ROOT } from './level-playbook-study';
import { M, H, D, FIELDS, COLUMN } from './level-playbook-map';
import { periodStart, periodEnd } from './poc-profile-engine';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const near = (a: number, b: number, label = '') => assert(Math.abs(a - b) <= 1e-6 + Math.abs(b) * 1e-10, `${label}: ${a} vs ${b}`);
async function main() {
  const latest = read('backtests/level-playbook/latest.json'), dir = process.argv[2] ?? latest.directory;
  const p = read(dir + '/plan.json'), c = p.card, seal = read(dir + '/complete.json'); assert.equal(seal.key, p.key);
  for (const pin of p.pins) assert.equal(await fileHash(path.resolve(ROOT, pin.file)), pin.sha256, pin.file);
  for (const item of seal.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, item.file)), item.sha256);
  const mapSeal = read(p.cache + '/complete.json');
  for (const item of mapSeal.artifacts) assert.equal(await fileHash(path.resolve(ROOT, p.cache, item.file)), item.sha256);
  const cs = cachedCandles(p.cache), a = cachedAtlas(p.cache), start = a.start;
  const atBar = (at: number) => { const b = cs[(at - start) / M]; assert(b && b.ts === at); return b; };
  let levelChecks = 0, signalChecks = 0, receipts = 0, pathMinutes = 0;
  // Independently rebuild complete period OHLCV from minute slices.
  for (const r of a.periods.filter(x => x.complete)) {
    const rows = cs.slice((r.start - start) / M, (r.end - start) / M);
    assert.equal(rows.length, (r.end - r.start) / M); assert.equal(r.availableAt, r.end + M);
    assert.equal(r.open, rows[0].open); assert.equal(r.close, rows.at(-1)!.close);
    let high = -Infinity, low = Infinity, volume = 0, turnover = 0, typical = 0, hl2 = 0;
    for (const b of rows) { high = Math.max(high, b.high); low = Math.min(low, b.low); volume += b.volume;
      turnover += b.turnover; typical += (b.high + b.low + b.close) / 3 * b.volume; hl2 += (b.high + b.low) / 2 * b.volume; }
    for (const [key, val] of Object.entries({ high, low, volume, turnover, typical, hl2 })) near((r as any)[key], val, 'period ' + key);
    levelChecks++;
  }
  // Deterministic samples spanning all months, plus each midnight +/-1minute boundary.
  const samples = new Set<number>();
  for (let i = 0; i < cs.length; i += 7919) samples.add(i);
  for (let i = 1; i < cs.length - 1; i++) if (cs[i].endTs % D === 0) for (const j of [i - 1, i, i + 1]) samples.add(j);
  const actual = (i: number, f: string) => a.values[i * FIELDS.length + COLUMN[f as keyof typeof COLUMN]];
  for (const i of samples) {
    const end = cs[i].endTs;
    const check = (f: string, expected: number) => { if (Number.isNaN(expected)) assert(Number.isNaN(actual(i, f)), f); else near(actual(i, f), expected, f); levelChecks++; };
    for (const [prefix, kind] of [['pd', 'day'], ['pw', 'week'], ['pm', 'month']] as const) {
      const anchor = periodStart(end, kind), prev = a.periods.find(p => p.period === kind && p.end === anchor && p.complete);
      for (const [suffix, key] of [['Open', 'open'], ['High', 'high'], ['Low', 'low']] as const) {
        const v = actual(i, prefix + suffix); if (prev) near(v, prev[key]); else assert(Number.isNaN(v)); levelChecks++;
      }
    }
    for (const [f, kind, hl] of [['vwapD', 'day', false], ['vwapW', 'week', false], ['vwapM', 'month', true]] as const) {
      const anchor = periodStart(end, kind), rows = anchor >= start ? cs.slice((anchor - start) / M, i + 1) : [];
      if (!rows.length || anchor < start) assert(Number.isNaN(actual(i, f)));
      else { let v = 0, pv = 0; for (const b of rows) { v += b.volume; pv += (hl ? (b.high + b.low) / 2 : (b.high + b.low + b.close) / 3) * b.volume; }
        if (v > 0) near(actual(i, f), pv / v); else assert(Number.isNaN(actual(i, f))); }
      const turn = rows.reduce((v, b) => v + b.turnover, 0), volume = rows.reduce((v, b) => v + b.volume, 0);
      check(f.replace('vwap', 'actual'), volume ? turn / volume : NaN);
      check(kind[0] + 'Open', rows.length ? rows[0].open : NaN);
      if (kind === 'day') { check('dHigh', rows.length ? Math.max(...rows.map(b => b.high)) : NaN); check('dLow', rows.length ? Math.min(...rows.map(b => b.low)) : NaN); }
      levelChecks++;
    }
    const pd = a.periods.find(p => p.period === 'day' && p.end === periodStart(end, 'day') && p.complete);
    const pw = a.periods.find(p => p.period === 'week' && p.end === periodStart(end, 'week') && p.complete);
    const dby = a.periods.find(p => p.period === 'day' && p.end === periodStart(end, 'day') - D && p.complete);
    check('pdMid', pd ? (pd.high + pd.low) / 2 : NaN); check('pwMid', pw ? (pw.high + pw.low) / 2 : NaN);
    check('dbyOpen', dby?.open ?? NaN); check('vwapPD', pd?.volume ? pd.typical / pd.volume : NaN); check('actualPD', pd?.volume ? pd.turnover / pd.volume : NaN);
    for (const [f, from] of [['vwap24', end - D], ['vwap2D', periodStart(end, 'day') - D]] as const) {
      const rows = from >= start ? cs.slice((from - start) / M, i + 1) : [];
      const volume = rows.reduce((v, b) => v + b.volume, 0), pv = rows.reduce((v, b) => v + (b.high + b.low + b.close) / 3 * b.volume, 0);
      check(f, volume ? pv / volume : NaN); check(f.replace('vwap', 'actual'), volume ? rows.reduce((v, b) => v + b.turnover, 0) / volume : NaN);
    }
    for (const [f, kind] of [['pocD', 'day'], ['pocW', 'week'], ['pocM', 'month']] as const) {
      const p = a.pocs.find(p => p.period === kind && p.end === periodStart(end, kind) && p.availableAt <= end + M);
      check(f, p ? Number(p.center) : NaN);
    }
  }
  const built = read(dir + '/signals.json'), defs = read(dir + '/definitions.json');
  const rawSignals = new Map<string, any>();
  for (const d of defs) {
    const used = new Set<string>(); let previous = -1;
    for (const s of built.signals[d.id]) {
      const e = s.evidence; assert(s.at > previous); previous = s.at; rawSignals.set(s.id, s);
      assert.equal(s.at, e.reactionEnd + c.publicationLagMs); assert.equal(e.reactionEnd, e.reactionStart + 15 * M);
      assert(e.referenceAvailableAt <= e.frozenAt); assert(e.frozenAt <= e.reactionStart);
      assert.equal(e.sourceEnd + c.publicationLagMs, e.referenceAvailableAt);
      const daySide = Math.floor(s.at / D) + ':' + s.side; assert(!used.has(daySide)); used.add(daySide);
      const rows = cs.slice((e.reactionStart - start) / M, (e.reactionEnd - start) / M);
      assert.equal(rows.length, 15); near(e.signalClose, rows.at(-1)!.close);
      const high = Math.max(...rows.map(x => x.high)), low = Math.min(...rows.map(x => x.low));
      near(e.reactionHigh, high); near(e.reactionLow, low); near(e.priorClose, atBar(e.reactionStart - M).close);
      if (d.poc) {
        const profile = a.pocs.find(x => x.id === e.referenceId)!; assert(profile && profile.availableAt <= e.frozenAt);
        near(e.level, Number(profile.center)); near(e.lower, Number(profile.lower)); near(e.upper, Number(profile.upper));
        if (d.poc === 'naked') { assert(profile.retestKnownAt! > e.frozenAt && profile.retestKnownAt! <= e.reactionEnd);
          assert(profile.firstObservedRetestAt! >= e.reactionStart && profile.firstObservedRetestAt! < e.reactionEnd);
          assert(profile.uncertainKnownAt === null || profile.uncertainKnownAt > profile.retestKnownAt!); }
      } else {
        const idx = Math.floor((e.frozenAt - start - M) / M) - 1;
        assert(idx >= 0); near(e.level, actual(idx, e.referenceId));
        assert.equal(e.referenceAvailableAt, start + (idx + 2) * M);
      }
      if (d.mechanism === 'retest') {
        assert(e.reactionStart >= e.breakoutAvailableAt && e.reactionEnd <= e.expiresAt);
        assert.equal(e.breakoutAvailableAt, e.breakoutEnd + M); assert.equal(e.frozenAt, e.breakoutEnd - 15 * M);
        near(e.breakoutClose, atBar(e.breakoutEnd - M).close);
        assert(s.side * (atBar(e.frozenAt - M).close / e.level - 1) <= 0);
        assert(s.side * (e.breakoutClose / e.level - 1) >= c.breakBufferPct / 100 - 1e-12);
        assert(low <= e.level * 1.001 && high >= e.level * .999);
        assert(s.side * (e.signalClose / e.level - 1) >= .001 - 1e-12);
        for (let t = e.breakoutEnd + 15 * M; t < e.reactionStart; t += 15 * M)
          assert(s.side * (atBar(t + 14 * M).close / e.level - 1) > -.001, 'No intervening invalidation');
      } else if (d.mechanism === 'stretch') {
        assert(s.side === 1 ? e.priorClose < e.level * .98 && e.signalClose >= e.level * .98 && e.signalClose < e.level
          : e.priorClose > e.level * 1.02 && e.signalClose <= e.level * 1.02 && e.signalClose > e.level);
      } else {
        const approach = s.side === 1 ? e.upper : e.lower;
        assert(s.side * (e.priorClose / approach - 1) > 0);
        assert(s.side === 1 ? low <= e.lower * .999 : high >= e.upper * 1.001);
        assert(s.side * (e.signalClose / approach - 1) >= .001 - 1e-12);
      }
      const stop = s.side === 1 ? Math.min(low, d.mechanism === 'stretch' ? low : e.lower) * .999 : Math.max(high, d.mechanism === 'stretch' ? high : e.upper) * 1.001;
      near(e.stop, stop); near(e.target, e.signalClose + 2 * s.side * Math.abs(e.signalClose - stop));
      near(e.riskPct, Math.abs(e.signalClose - stop) / e.signalClose * 100);
      assert.equal(e.bracketEligible, e.riskPct >= .2 && e.riskPct <= 5); signalChecks++;
    }
  }
  const results = read(dir + '/results.json');
  for (const r of results) {
    const run = read(dir + '/' + r.file), o = run.options;
    const signals = built.signals[r.id.replace(/__(timed|bracket)$/, '')].filter((s: any) => r.exit === 'timed' || s.evidence.bracketEligible);
    const filled = new Map(run.trades.map((t: any) => [t.id, t])) as Map<string, any>;
    let freeAt = o.start, closed = 0, cash = c.equity, peak = cash, lastMark = cash, dd = 0;
    const month = new Map<string, any>(run.monthly.map((m: any) => [m.month, { markedNet: 0, closedNet: 0, wins: 0, losses: 0, winningDollars: 0, losingDollars: 0 }]));
    const obs = (at: number, value: number, adverse: number) => {
      dd = Math.max(dd, (peak - adverse) / peak * 100); peak = Math.max(peak, value);
      month.get(new Date(at).toISOString().slice(0, 7)).markedNet += value - lastMark; lastMark = value;
    };
    const accepted: string[] = [], times = new Set(signals.map((s: any) => s.at));
    for (const s of signals) {
      if (s.at < o.start || s.at >= o.end || s.at < freeAt) continue;
      const entryAt = s.at + o.delay; if (entryAt >= o.end) break;
      const entry = atBar(entryAt).open, stop = r.exit === 'bracket' ? s.evidence.stop : null, target = r.exit === 'bracket' ? s.evidence.target : null;
      if (stop !== null && (s.side * (entry - stop) <= 0 || s.side * (target - entry) <= 0)) continue;
      accepted.push(s.id); const qty = c.notional / entry, feeIn = c.notional * c.fee;
      cash -= feeIn; const mark = (p: number) => cash + s.side * qty * (p - entry) - qty * p * c.fee;
      let exitAt = entryAt + o.hold + o.delay, exit = 0, reason = 'timeout', adverse = 0;
      for (let at = entryAt; at < Math.min(exitAt, o.end); at += M) {
        pathMinutes++; const b = atBar(at);
        if (stop !== null) {
          const gapStop = s.side * (b.open - stop) <= 0, gapTarget = s.side * (b.open - target) >= 0;
          const st = s.side === 1 ? b.low <= stop : b.high >= stop, tp = s.side === 1 ? b.high >= target : b.low <= target;
          if (gapStop || gapTarget || st || tp) {
            exitAt = at; reason = gapStop ? 'stop' : gapTarget ? 'target' : st && (!tp || !o.targetFirst) ? 'stop' : 'target';
            exit = gapStop || gapTarget ? b.open : reason === 'stop' ? stop : target;
            adverse = mark(gapStop || gapTarget ? b.open : reason === 'stop' || (st && tp) ? stop : s.side === 1 ? b.low : b.high);
            break;
          }
        }
        obs(at, mark(b.close), mark(s.side === 1 ? b.low : b.high));
      }
      if (exitAt < o.end) {
        if (!exit) exit = atBar(exitAt).open;
        const net = s.side * qty * (exit - entry) - feeIn - qty * exit * c.fee;
        const t = filled.get(s.id); assert(t); assert.equal(t.entryAt, entryAt); assert.equal(t.exitAt, exitAt);
        near(t.entryPrice, entry); near(t.exitPrice, exit); assert.equal(t.reason, reason); near(t.net, net); receipts++;
        cash += s.side * qty * (exit - entry) - qty * exit * c.fee; closed += net;
        if (!(o.delay === 0 && times.has(exitAt) && stop === null)) obs(exitAt, cash, stop === null ? cash : Math.min(cash, adverse || cash));
        const m = month.get(new Date(exitAt).toISOString().slice(0, 7)); m.closedNet += net;
        if (net > 1e-8) { m.wins++; m.winningDollars += net; } else if (net < -1e-8) { m.losses++; m.losingDollars += net; }
        freeAt = exitAt + (stop !== null && reason !== 'timeout' ? M : 0);
      } else { assert.equal(run.open.id, s.id); near(run.open.net, mark(atBar(o.end - M).close) - (c.equity + closed), r.id + ' cutoff inventory'); freeAt = exitAt; }
    }
    assert.deepEqual(accepted, run.accepted.map((s: any) => s.id)); near(closed, run.stats.closedNet); near(lastMark - c.equity, run.stats.net); near(dd, run.stats.maxAdverseDrawdownPct);
    for (const m of run.monthly) for (const [field, value] of Object.entries(month.get(m.month))) near(m[field], value as number, 'monthly ' + field);
  }
  atomicJson(path.resolve(ROOT, dir, 'independent-verification.json'), { passed: true, key: p.key, levelChecks, signalChecks, receipts, pathMinutes,
    paths: results.length, checks: 'period/VWAP reference slices; source availability; signal conditions; prefix tests; independent ownership, first exits, arithmetic, minute DD and monthly reconstruction' });
  if (latest.key === p.key) atomicJson(path.join(ROOT, 'backtests/level-playbook/latest.json'), { ...latest, accepted: true });
  console.log(JSON.stringify({ passed: true, levelChecks, signalChecks, receipts, pathMinutes, paths: results.length }));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
