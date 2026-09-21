/** Independent PH02 audit: no strategy/feature/replay engine imports. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileHash, atomicJson } from './research-workflow';
import { loadMinutes } from './relative-reversion-study';
import { Inputs } from './hype-tp-hl-event-atlas';
import { normalize } from './tp-hl-event-features';
type Row = Record<string, any>;
const ROOT = path.resolve(__dirname, '..'), M = 60000, DAY = 86400000;
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const near = (a: number, b: number, why: string, tolerance = 1e-7) => assert(Math.abs(a - b) < tolerance, `${why}: ${a} != ${b}`);
const avail = (r: Row, lag: number) => Math.max(r.baseAvailableAt, r.modeledLag ? r.sourceAt + lag : 0);
async function main() {
  const out = path.resolve(ROOT, process.argv[2]), plan = read(path.join(out, 'plan.json')), c = plan.card, spec = plan.hlSpec;
  const seal = read(path.join(out, 'complete.json')); assert.equal(seal.key, plan.key);
  for (const p of plan.pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, 'Changed pin ' + p.file);
  for (const a of seal.artifacts) assert.equal(await fileHash(path.join(out, a.file)), a.sha256, 'Changed artifact ' + a.file);
  const sources = read(path.join(out, 'retained-observations.json')), groups: Row[] = read(path.join(out, 'opportunities.json'));
  const signals: Row[] = read(path.join(out, 'signals.json')); assert.equal(signals.length, 264);
  // Source cache must reproduce the normalized original physical rows.
  const inputs = new Inputs(); let physical = 0;
  for (const kind of ['taker', 'book', 'asset'] as const) {
    const rs: Row[] = sources[kind], file = plan.pins.find((p: Row) => p.file === rs[0].file)!.file;
    const byLine = new Map(rs.map(r => [r.line, r]));
    await inputs.rows(file, (raw, line) => { const r = byLine.get(line); if (r) { assert.deepEqual(normalize(kind, raw, file, line), r); physical++; } });
    assert.equal(rs.length, byLine.size);
  }
  const loaded = await loadMinutes(ROOT, 'HYPEUSDT', Date.parse(c.end), c.repair), cs = loaded.candles;
  const baseTs = cs[0].ts;
  const bar = (at: number) => { const b = cs[(at - baseTs) / M]; assert(b && b.ts === at); return b; };
  const f = (q: number, span: number, end = q) => {
    const bins = new Map<number, Row[]>();
    for (const r of sources.taker) if (r.sourceAt > end - span * M && r.sourceAt <= end && avail(r, spec.legacyPublicationLagMs) <= q) {
      const a = bins.get(r.sourceAt) ?? []; a.push(r); bins.set(r.sourceAt, a);
    }
    let ambiguity = 0; const selected: Row[] = [];
    for (const rs of bins.values()) {
      if (new Set(rs.map(r => JSON.stringify(r.data))).size > 1 || !rs[0].data.valid) { ambiguity++; continue; }
      selected.push([...rs].sort((a, b) => avail(a, spec.legacyPublicationLagMs) - avail(b, spec.legacyPublicationLagMs))[0]);
    }
    const buy = selected.reduce((s, r) => s + r.data.buyNotional, 0), sell = selected.reduce((s, r) => s + r.data.sellNotional, 0);
    return { healthy: !ambiguity && selected.length >= (spec.windowCoverage[`flow${span}m`] ?? span - 1) && buy + sell > 0,
      share: buy + sell ? buy / (buy + sell) : null, selected };
  };
  const latest = (kind: string, q: number) => (sources[kind] as Row[]).filter(r => r.sourceAt <= q && avail(r, spec.legacyPublicationLagMs) <= q).at(-1);
  let references = 0;
  for (const group of groups) {
    assert.equal(group.rows.length, signals.length);
    for (const x of group.rows) {
      const s = signals.find(s => s.id === x.id)!; assert(s); assert.equal(x.signalAt, s.signalAt);
      assert(s.availableAt <= s.touchStart && s.signalAt === s.touchStart + M);
      const q = s.signalAt - group.sourceDelay; assert.equal(x.queryAt, q);
      const a = f(q, 5), b = f(q, 10, q - 5 * M), all = f(q, 15);
      const acceleration = a.healthy && b.healthy ? a.share! - b.share! : null;
      if (acceleration === null) assert.equal(x.acceleration, null); else near(x.acceleration, acceleration, 'acceleration');
      const book = latest('book', q), asset = latest('asset', q);
      const core = all.healthy && !!book && q - book.sourceAt <= spec.freshnessMs.book && book.data.band05.healthy === true
        && !!asset && q - asset.sourceAt <= spec.freshnessMs.asset;
      assert.equal(x.quality.coreHealthy, core);
      const end = Math.floor((q - M) / (15 * M)) * 15 * M;
      let distance: number | null = null;
      if (x.weekly) {
        assert.equal(x.weekly.barEnd, end); assert.equal(x.weekly.availableAt, end + M); assert(end + M <= q);
        const week = Math.floor((end - 15 * M + 3 * DAY) / (7 * DAY)) * 7 * DAY - 3 * DAY;
        assert.equal(x.weekly.weekStart, week); assert.equal(x.weekly.close, bar(end - M).close);
        if (week >= Date.parse(c.canonicalStart)) {
          let vol = 0, turnover = 0;
          for (let at = week; at < end; at += M) { const v = bar(at); vol += v.volume; turnover += v.turnover; }
          if (vol > 0) {
            const vwap = turnover / vol; distance = 100 * (bar(end - M).close - vwap) / vwap;
            near(x.weekly.vwap, vwap, 'weekly actual-turnover VWAP'); near(x.weekly.distancePct, distance, 'weekly distance');
          } else assert.equal(x.weekly.vwap, null);
        } else assert.equal(x.weekly.vwap, null);
      }
      const covered = core && acceleration !== null && distance !== null;
      assert.equal(x.covered, covered); assert.equal(x.warningB, covered ? acceleration! <= -.05 : null);
      assert.equal(x.warningC, covered ? acceleration! <= -.05 && distance! < 0 : null);
      for (const r of [...a.selected, ...b.selected, ...all.selected]) { assert(avail(r, spec.legacyPublicationLagMs) <= q && r.sourceAt <= q); references++; }
    }
  }
  const results: Row[] = read(path.join(out, 'results.json')); assert.equal(results.length, 36);
  let fills = 0, pathMinutes = 0; const curves: Row[] = [];
  for (const r of results) {
    const run = read(path.join(out, r.file)), o = run.options;
    const ops = groups.find(g => g.sourceDelay === r.sourceDelay)!.rows as Row[];
    const approved = ops.filter(x => x.covered && (r.rule === 'A' || !(r.rule === 'B' ? x.warningB : x.warningC)));
    const times = new Set(approved.map(s => s.signalAt));
    const expected: Row[] = []; let free = o.start;
    for (const s of approved) if (s.signalAt >= o.start && s.signalAt < o.end && s.signalAt >= free) {
      expected.push({ at: s.signalAt, id: s.id }); free = s.signalAt + o.hold + 2 * o.delay;
    }
    assert.deepEqual(run.accepted, expected);
    let cash = o.equity, priorMark = cash, peak = cash, dd = 0, closeDd = 0, net = 0, fees = 0, turnover = 0;
    const months = new Map<string, Row>(), daily = new Map<number, Row>();
    const month = (at: number) => {
      const key = new Date(at).toISOString().slice(0, 7);
      if (!months.has(key)) months.set(key, { markedNet: 0, closedNet: 0, wins: 0, losses: 0, winningDollars: 0, losingDollars: 0 });
      return months.get(key)!;
    };
    const record = (at: number, value: number, adverse: number) => {
      dd = Math.max(dd, 100 * (peak - adverse) / peak); peak = Math.max(peak, value); closeDd = Math.max(closeDd, 100 * (peak - value) / peak);
      month(at).markedNet += value - priorMark; priorMark = value;
      daily.set(Math.floor(at / DAY), { at, equity: value, dd });
    };
    for (const s of expected) {
      const entryAt = s.at + o.delay, exitAt = entryAt + o.hold + o.delay;
      if (entryAt >= o.end) continue;
      const entry = bar(entryAt).open, qty = o.notional / entry, feeIn = o.notional * o.fee;
      fees += feeIn; turnover += o.notional;
      const mark = (p: number) => cash + qty * (p - entry) - feeIn - qty * p * o.fee;
      for (let at = entryAt; at < Math.min(exitAt, o.end); at += M) { const b = bar(at); record(at, mark(b.close), mark(b.low)); pathMinutes++; }
      if (exitAt < o.end) {
        const t = run.trades.find((t: Row) => t.id === s.id); assert(t);
        const exit = bar(exitAt).open, feeOut = qty * exit * o.fee, pnl = qty * (exit - entry) - feeIn - feeOut;
        assert.equal(t.entryAt, entryAt); assert.equal(t.exitAt, exitAt); assert.equal(t.entryPrice, entry); assert.equal(t.exitPrice, exit);
        near(t.qty, qty, 'qty'); near(t.fees, feeIn + feeOut, 'fees'); near(t.net, pnl, 'pnl');
        net += pnl; cash += pnl; fees += feeOut; turnover += qty * exit; fills++;
        if (!(o.delay === 0 && times.has(exitAt))) record(exitAt, cash, cash);
        const m = month(exitAt); m.closedNet += pnl;
        if (pnl > 1e-8) { m.wins++; m.winningDollars += pnl; } else if (pnl < -1e-8) { m.losses++; m.losingDollars += pnl; }
      } else {
        assert.equal(run.open.id, s.id); near(run.open.net, mark(bar(o.end - M).close) - cash, 'open net');
        turnover += qty * bar(o.end - M).close;
      }
    }
    near(net, run.stats.closedNet, 'closed net'); near(priorMark - o.equity, r.net, 'marked net');
    near(dd, r.maxAdverseDrawdownPct, 'adverse DD'); near(closeDd, r.maxCloseDrawdownPct, 'close DD');
    near(fees, r.feesPaid, 'all fees'); near(turnover, r.turnoverIncludingMarkedExit, 'turnover');
    for (const m of run.monthly) for (const k of ['markedNet', 'closedNet', 'wins', 'losses', 'winningDollars', 'losingDollars']) near(m[k], months.get(m.month)?.[k] ?? 0, 'monthly ' + k);
    const baseline = read(path.join(out, `A-${r.window}-source${r.sourceDelay}-action${r.delay}.json`));
    const a = new Map([...baseline.trades, ...(baseline.open ? [baseline.open] : [])].map(t => [t.id, t])) as Map<string, Row>;
    const b = new Map([...run.trades, ...(run.open ? [run.open] : [])].map(t => [t.id, t])) as Map<string, Row>;
    const removed = [...a.values()].filter(t => !b.has(t.id)), added = [...b.values()].filter(t => !a.has(t.id));
    for (const [id, t] of a) if (b.has(id)) assert.deepEqual(t, b.get(id), 'Common entries must have identical exits');
    const sum = (ts: Row[]) => ts.reduce((s, t) => s + t.net, 0);
    near(sum(added) - sum(removed), r.delta, 'occupancy attribution');
    near(run.attribution.summary.delta, r.delta, 'saved attribution');
    near(run.attribution.sacrificedWinners.net, sum(removed.filter(t => t.net > 0 && t.exitAt !== undefined)), 'missed winners');
    if (r.window === 'pooled' && !r.sourceDelay && !r.delay) curves.push({ rule: r.rule, start: o.start, equity: o.equity, points: [...daily.values()] });
  }
  // Re-derive screens from sealed results rather than trusting the reported verdict.
  const allMonths: Row[] = read(path.join(out, 'monthly.json')), ranking: Row[] = read(path.join(out, 'ranking.json'));
  for (const z of ranking) {
    const rs = results.filter(r => r.rule === z.rule), ms = allMonths.filter(m => m.rule === z.rule), reasons: string[] = [];
    if (rs.some(r => r.delta <= 0)) reasons.push('not_all_path_net_improvement');
    if (rs.some(r => r.ddDelta > 1e-8)) reasons.push('drawdown_regression');
    if (ms.some(m => m.delta < -250 - 1e-8)) reasons.push('monthly_regression_over_250');
    if (rs.some(r => r.stressNet <= 0)) reasons.push('nonpositive_cost_stress');
    if (rs.some(r => r.trades < (r.window === 'pooled' ? 30 : 10))) reasons.push('insufficient_sample');
    if (rs.some(r => r.bankrupt)) reasons.push('equity_exhaustion');
    assert.deepEqual(z.failures, reasons); assert.equal(z.pass, !reasons.length);
  }
  atomicJson(path.join(out, 'equity-primary.json'), curves);
  for (const p of plan.pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256);
  atomicJson(path.join(out, 'independent-verification.json'), { passed: true, key: plan.key, paths: results.length, fills, pathMinutes,
    physical, references, verifierSha256: await fileHash(__filename), equitySha256: await fileHash(path.join(out, 'equity-primary.json')),
    note: 'Independent raw-source/cache, window-weighted flow, minute-summed UTC weekly VWAP, coverage/decisions, occupancy, fills, fees, DD, monthly and attribution audit.' });
  console.log(JSON.stringify({ passed: true, paths: results.length, fills, pathMinutes, physical, references }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
