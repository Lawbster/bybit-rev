/** Independent receipt/causal audit. Does not call the new replay or daily-signal builder. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileHash, atomicJson } from './research-workflow';
import { loadMinutes } from './relative-reversion-study';
const ROOT = path.resolve(__dirname, '..'), M = 60000, H = 60 * M, D = 24 * H;
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
async function main() {
  const dir = path.resolve(ROOT, process.argv[2]), plan = read(path.join(dir, 'plan.json')), seal = read(path.join(dir, 'complete.json')), c = plan.card;
  assert.equal(plan.key, seal.key);
  for (const a of seal.artifacts) assert.equal(await fileHash(path.join(dir, a.file)), a.sha256);
  for (const p of plan.pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
  const start = Date.parse(c.start), end = Date.parse(c.end), loaded = await loadMinutes(ROOT, 'HYPEUSDT', end, c.repair);
  const cs = loaded.candles.filter(b => b.ts >= start), bar = (at: number) => { const b = cs[(at - start) / M]; assert(b && b.ts === at); return b; };
  // Direct minute-slice aggregation, independent of the producer's streaming bucket builder.
  const block = (at: number, length: number) => {
    const xs = cs.slice((at - start) / M, (at + length - start) / M);
    assert.equal(xs.length, length / M); assert.equal(xs[0].ts, at); assert.equal(xs.at(-1)!.endTs, at + length);
    return { high: Math.max(...xs.map(b => b.high)), low: Math.min(...xs.map(b => b.low)), close: xs.at(-1)!.close };
  };
  let receipts = 0, pathMinutes = 0, decisions = 0, clocks = 0;
  const defs = read(path.join(dir, 'signals.json')), results = read(path.join(dir, 'results.json'));
  for (const def of defs.filter((d: any) => d.family === 'daily_bias')) {
    const document = read(path.join(dir, `decisions-${def.id}.json`));
    for (const p of document.pivots) {
      const width = Number(def.id.split('_')[0].slice(1)), center = block(p.pivotAt, 4 * H);
      assert.equal(p.availableAt, p.pivotAt + (width + 1) * 4 * H + M);
      assert.equal(p.price, center[p.kind === 'high' ? 'high' : 'low']);
      for (let j = -width; j <= width; j++) if (j) {
        const other = block(p.pivotAt + j * 4 * H, 4 * H);
        assert(p.kind === 'high' ? p.price > other.high : p.price < other.low);
      }
    }
    for (const d of document.decisions) {
      decisions++; assert.equal(d.at, d.sessionAt + M); assert.equal(d.price, bar(d.sessionAt - M).close);
      for (const side of ['rangeHigh', 'rangeLow']) if (d[side]) {
        const kind = side === 'rangeHigh' ? 'high' : 'low';
        const eligible = document.pivots.filter((p: any) => p.kind === kind && p.availableAt <= d.at);
        assert.deepEqual(d[side], eligible.at(-1));
      }
      if (d.reason !== 'signal') continue;
      assert(d.priceAvailableAt <= d.at && d.priorDayAvailableAt <= d.at);
      assert(d.location > 0 && d.location < 1 && (d.location <= .4 || d.location >= .6));
      const prev = block(d.priorDayStart, D), long = d.side === 1;
      assert.equal(d.stop, long ? d.rangeLow.price : d.rangeHigh.price);
      assert.equal(d.target, d.targetMode === 'previous_day' ? long ? prev.high : prev.low : long ? d.rangeHigh.price : d.rangeLow.price);
    }
  }
  for (const lag of c.indicatorPublicationLagsMs) {
    const es = read(path.join(dir, `events-${lag}.json`)), parent = read(path.resolve(ROOT, c.parent, 'full-0-hold12.json'));
    assert.equal(es.length, 238);
    for (let i = 0; i < es.length; i++) {
      const e = es[i]; assert.equal(e.id, parent.trades[i].id); assert.equal(e.net, parent.trades[i].net);
      assert.equal(e.heavy, e.net <= -300);
      for (const snap of [e.snapshot, e.leadIn]) for (const s of snap.sources) {
        clocks++; assert.equal(s.availableAt, s.barEnd + lag); assert(s.availableAt <= snap.asOf);
        assert.equal(s.barEnd, Math.floor((snap.asOf - lag) / (s.timeframeMinutes * M)) * s.timeframeMinutes * M);
      }
      assert.equal(e.leadIn.asOf, e.signalAt - 15 * M);
    }
    for (const p of read(path.join(dir, `partitions-${lag}.json`))) {
      const yes = es.filter((e: any) => p.conditions.every(([k, op, v]: any[]) => e.features[k] !== null && Number.isFinite(e.features[k]) &&
        (op === '<' ? e.features[k] < v : op === '<=' ? e.features[k] <= v : op === '>=' ? e.features[k] >= v : e.features[k] > v)));
      assert.deepEqual(yes.map((e: any) => e.id), p.conditionIds);
      assert(Math.abs(yes.reduce((v: number, e: any) => v + e.net, 0) - p.condition.net) < 1e-7);
    }
  }
  for (const r of results) {
    const run = read(path.join(dir, r.file)), o = run.options, def = defs.find((d: any) => d.id === r.id);
    const byId = new Map(def.signals.map((s: any) => [s.id, s])) as Map<string, any>;
    let sum = 0;
    for (const t of run.trades) {
      receipts++; const s = byId.get(t.id); assert(s); assert.equal(t.entryAt, s.at + o.delay);
      assert.equal(t.entryPrice, bar(t.entryAt).open); assert.equal(t.qty, c.notional / t.entryPrice);
      const deadline = s.expiresAt === undefined ? t.entryAt + o.hold + o.delay : s.expiresAt + o.delay;
      const scheduled = Math.min(deadline, (s.failureAt ?? Infinity) + o.delay);
      const gross = t.side * t.qty * (t.exitPrice - t.entryPrice), fees = (c.notional + t.qty * t.exitPrice) * c.fee;
      assert(Math.abs(t.pricePnl - gross) < 1e-8); assert(Math.abs(t.fees - fees) < 1e-8); assert(Math.abs(t.net - gross + fees) < 1e-8);
      if (t.stop !== null) assert(Math.abs(t.r - t.net / (t.qty * Math.abs(t.entryPrice - t.stop))) < 1e-10);
      let firstHit: any = null;
      for (let at = t.entryAt; at <= t.exitAt; at += M) {
        pathMinutes++;
        if (at >= scheduled || t.stop === null) continue;
        const b = bar(at), long = t.side === 1;
        const gapStop = long ? b.open <= t.stop : b.open >= t.stop, gapTarget = long ? b.open >= t.target : b.open <= t.target;
        const stop = long ? b.low <= t.stop : b.high >= t.stop, target = long ? b.high >= t.target : b.low <= t.target;
        if (gapStop || gapTarget || stop || target) {
          const reason = gapStop ? 'stop' : gapTarget ? 'target' : stop && (!target || !o.targetFirst) ? 'stop' : 'target';
          firstHit = { at, reason, price: gapStop || gapTarget ? b.open : reason === 'stop' ? t.stop : t.target }; break;
        }
      }
      if (firstHit) { assert.equal(t.exitAt, firstHit.at); assert.equal(t.reason, firstHit.reason); assert.equal(t.exitPrice, firstHit.price); }
      else { assert.equal(t.exitAt, scheduled); assert.equal(t.exitPrice, bar(scheduled).open); }
      sum += t.net;
    }
    assert(Math.abs(sum - run.stats.closedNet) < 1e-7);
    assert(Math.abs(sum + (run.open?.net ?? 0) - run.stats.net) < 1e-6);
    assert(Math.abs(run.monthly.reduce((v: number, m: any) => v + m.markedNet, 0) - run.stats.net) < 1e-6);
    assert.equal(run.stats.wins, run.trades.filter((t: any) => t.net > 1e-8).length);
    assert.equal(run.stats.losses, run.trades.filter((t: any) => t.net < -1e-8).length);
    // Reconstruct occupancy and gap cancellations from every raw signal, not just retained fills.
    const got: string[] = []; let freeAt = o.start;
    const filled = new Map(run.trades.map((t: any) => [t.id, t])) as Map<string, any>;
    for (const s of def.signals) {
      if (s.at < o.start || s.at >= o.end || s.at < freeAt) continue;
      const entryAt = s.at + o.delay; if (entryAt >= o.end) break;
      const price = bar(entryAt).open;
      if (s.stop !== undefined && (s.side * (price - s.stop) <= 0 || s.side * (s.target - price) <= 0)) continue;
      got.push(s.id); const t = filled.get(s.id);
      if (t) freeAt = t.exitAt + (['target', 'stop'].includes(t.reason) ? M : 0);
      else { assert.equal(run.open?.id, s.id); freeAt = Infinity; }
    }
    assert.deepEqual(got, run.accepted.map((s: any) => s.id));
  }
  atomicJson(path.join(dir, 'independent-verification.json'), { passed: true, key: plan.key, paths: results.length,
    receipts, pathMinutes, decisions, featureClockReferences: clocks, note: 'Independent receipt, earliest-exit, occupancy, pivot and source-clock audit; feature math covered by existing reference suites and prefix tests. DD producer not independently recomputed here.' });
  console.log(JSON.stringify({ passed: true, paths: results.length, receipts, pathMinutes, decisions, clocks }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
