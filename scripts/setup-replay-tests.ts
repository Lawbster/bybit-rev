/** Setup replay tests: action building, bracket rules, tie handling, and an end-to-end synthetic replay. */
import assert from 'assert/strict';
import { buildActions, cellId, parseRowFilter } from './setup-replay';
import { replay } from './poc-indicator-bias-engine';
import { auditStructuralReplay } from './structural-replay-audit';
import { H, M, type Minute, type SetupEvent } from './setup-scan-core';

const t0 = Date.UTC(2026, 0, 5);
const ev = (id: string, side: 1 | -1, knownAt: number, ref: number, stop: number | null, target: number | null, notes: string[] = []): SetupEvent => ({
  id, setup: 'T', version: 'v', side, stage: 'confirmed', formationAt: knownAt - H, knownAt,
  stages: { context: { at: knownAt - 5 * H, knownAt: knownAt - 4 * H }, retest: { at: knownAt - H - M, knownAt, price: ref } },
  reference: {}, proxies: { entry: null, stop, target }, notes,
});
const cfg = { riskMinPct: 0.2, riskMaxPct: 5, stopBufferPct: 0, includeControls: false };

// ── buildActions ──
{
  const events = [
    ev('a', 1, t0 + 10 * H, 100, 99, 104),
    ev('b', 1, t0 + 10 * H, 100, 99, 104),                 // same-minute tie: discarded
    ev('c', 1, t0 + 12 * H, 100, 99.9, 104),               // risk 0.1% < 0.2%: rejected
    ev('d', 1, t0 + 14 * H, 100, 99, null),                // no structural target
    ev('e', -1, t0 + 16 * H, 100, 101, 96),
    ev('f', 1, t0 + 18 * H, 100, 99, 104, ['pa07_control_row']), // control excluded by default
    ev('g', 1, t0 + 20 * H, 100, 101, 104),                // stop on the wrong side: invalid bracket
  ];
  const long = buildActions(events, { side: 1, target: 'structural', holdHours: 24 }, cfg);
  assert.deepEqual(long.actions.map(a => a.id), ['a']);
  assert.deepEqual(long.discarded.map(d => d.id), ['b']);
  assert.deepEqual(long.rejected.map(r => `${r.id}:${r.reason}`), ['c:risk_out_of_range', 'd:no_structural_target', 'g:invalid_bracket']);
  const r2 = buildActions(events, { side: 1, target: 'r2', holdHours: 24 }, cfg);
  assert.deepEqual(r2.actions.map(a => a.id), ['a', 'd'], 'rN targets do not need a structural target');
  assert.equal(r2.actions[1].target, 100 + 2 * 1); assert.equal(r2.actions[1].expiresAt, t0 + 14 * H + 24 * H);
  const withControls = buildActions(events, { side: 1, target: 'r2', holdHours: 24 }, { ...cfg, includeControls: true });
  assert(withControls.actions.some(a => a.id === 'f'));
  const short = buildActions(events, { side: -1, target: 'r1.5', holdHours: 24 }, cfg);
  assert.equal(short.actions.length, 1); assert.equal(short.actions[0].target, 100 - 1.5 * 1);
  const buffered = buildActions(events, { side: 1, target: 'structural', holdHours: 24 }, { ...cfg, stopBufferPct: 1 });
  assert.equal(buffered.actions[0].stop, 99 * 0.99);
  assert.equal(cellId({ side: -1, target: 'r2', holdHours: 72 }), 'short__r2__hold72h');
  // Row filter: replay a named rejected row set as a control instead of the confirmed setup.
  const control = { ...ev('h', 1, t0 + 22 * H, 100, 99, 104, ['generic_failed_zone_control']), stage: 'rejected' as const, reason: 'no_sweep_before_fail' };
  const ctl = buildActions([...events, control], { side: 1, target: 'r2', holdHours: 24 }, { ...cfg, rows: parseRowFilter('rejected:no_sweep_before_fail') });
  assert.deepEqual(ctl.actions.map(a => a.id), ['h'], 'row filter selects only the named rejected rows');
  assert.deepEqual(parseRowFilter(undefined), { stage: 'confirmed' });
  assert.throws(() => parseRowFilter('bogus:x'));
}

// ── percent brackets and reference-stage override ──
{
  const e1 = ev('p1', 1, t0 + 10 * H, 100, 99, 104); e1.stages.msb = { at: t0 + 9 * H, knownAt: t0 + 10 * H, price: 102 };
  const e2 = ev('p2', -1, t0 + 12 * H, 100, 101, 96); e2.stages.msb = { at: t0 + 11 * H, knownAt: t0 + 12 * H, price: 98 };
  const e3 = ev('p3', 1, t0 + 14 * H, 100, 99, 104);                               // no msb stage
  const tp = buildActions([e1, e2, e3], { side: 1, target: 'tp2.5', holdHours: 72 }, cfg);
  assert.deepEqual(tp.actions.map(a => [a.id, a.stop, +a.target!.toFixed(6)]), [['p1', 99, 102.5], ['p3', 99, 102.5]], 'tpN keeps the scan stop and targets N% from the reference');
  const tpsl = buildActions([e1, e2, e3], { side: 1, target: 'tp3sl4.25', holdHours: 72 }, { ...cfg, stopBufferPct: 1, riskMaxPct: 5 });
  assert.deepEqual(tpsl.actions.map(a => [a.id, +a.stop!.toFixed(6), +a.target!.toFixed(6)]), [['p1', 95.75, 103], ['p3', 95.75, 103]], 'tpNslM stops M% from the reference, ignoring the stop buffer');
  const tight = buildActions([e1, e2, e3], { side: 1, target: 'tp3sl6', holdHours: 72 }, cfg);
  assert.deepEqual(tight.rejected.map(r => `${r.id}:${r.reason}`), ['p1:risk_out_of_range', 'p3:risk_out_of_range'], 'the risk filter still applies to a percent stop');
  const shortSide = buildActions([e1, e2, e3], { side: -1, target: 'tp2sl3', holdHours: 72 }, cfg);
  assert.deepEqual(shortSide.actions.map(a => [a.id, +a.stop!.toFixed(6), +a.target!.toFixed(6)]), [['p2', 103, 98]]);
  const refd = buildActions([e1, e2, e3], { side: 1, target: 'tp2sl4', holdHours: 72 }, { ...cfg, refStage: 'msb' });
  assert.deepEqual(refd.actions.map(a => [a.id, +a.stop!.toFixed(6), +a.target!.toFixed(6)]), [['p1', 97.92, 104.04]], 'reference stage override measures from that stage price');
  assert.deepEqual(refd.rejected.map(r => `${r.id}:${r.reason}`), ['p3:no_reference_or_stop'], 'rows without the reference stage are rejected');
  const refR = buildActions([e1], { side: 1, target: 'r2', holdHours: 72 }, { ...cfg, refStage: 'msb' });
  assert.deepEqual(refR.actions.map(a => [a.id, a.stop, +a.target!.toFixed(6)]), [['p1', 99, 108]], 'rN with a reference override uses the scan stop and that reference');
  assert.throws(() => buildActions([e1], { side: 1, target: 'pct3', holdHours: 72 }, cfg), /unknown target mode/);
  assert.equal(cellId({ side: 1, target: 'tp2.5sl4.25', holdHours: 72 }), 'long__tp2.5sl4.25__hold72h');
}

// ── resting-limit entry: sweep offset (SF03) and detector proxy price (OB01) ──
{
  const sweepEv = (id: string, side: 1 | -1, knownAt: number, ref: number, stop: number, target: number, sweepPrice: number, entry: number | null): SetupEvent => {
    const e = ev(id, side, knownAt, ref, stop, target); e.stages.sweep = { at: knownAt - 3 * H, knownAt: knownAt - 2 * H, price: sweepPrice }; e.proxies.entry = entry; return e;
  };
  const events = [
    sweepEv('p', 1, t0 + 10 * H, 100, 98, 104, 98.5, 99.4),   // proxy 99.4 rests between stop and reference
    sweepEv('q', 1, t0 + 12 * H, 100, 98, 104, 98.5, null),   // no proxy price
    sweepEv('r', 1, t0 + 14 * H, 100, 98, 104, 98.5, 97.5),   // proxy below the stop
    sweepEv('s', -1, t0 + 16 * H, 100, 102, 96, 101.5, 100.6), // short: limit model is long only
    { ...ev('t', 1, t0 + 18 * H, 100, 98, 104), proxies: { entry: 99.2, stop: 98, target: 104 } }, // no sweep stage at all
  ];
  const v = { side: 1 as const, target: 'r2', holdHours: 24 };
  const proxy = buildActions(events, v, { ...cfg, entryLimit: { offsetPct: 0, expiryHours: 48, model: 'touch', source: 'proxy' } });
  assert.deepEqual(proxy.actions.map(a => a.id), ['p', 't']);
  assert.deepEqual(proxy.actions[0].entry, { price: 99.4, expiresAt: t0 + 10 * H + 48 * H, model: 'touch' });
  assert.equal(proxy.actions[1].entry!.price, 99.2, 'proxy source does not need a sweep stage');
  assert.deepEqual(proxy.rejected.map(r => `${r.id}:${r.reason}`), ['q:no_entry_proxy', 'r:limit_outside_bracket']);
  const sweep = buildActions(events, v, { ...cfg, entryLimit: { offsetPct: 0.5, expiryHours: 48, model: 'open' } });
  assert.deepEqual(sweep.actions.map(a => a.id), ['p', 'q', 'r'], 'sweep source ignores the proxy price');
  assert.ok(Math.abs(sweep.actions[0].entry!.price - 98.5 * 1.005) < 1e-9); assert.equal(sweep.actions[0].entry!.model, 'open');
  assert.deepEqual(sweep.rejected.map(r => `${r.id}:${r.reason}`), ['t:no_sweep_stage']);
  const shortSide = buildActions(events, { ...v, side: -1 }, { ...cfg, entryLimit: { offsetPct: 0, expiryHours: 48, model: 'touch', source: 'proxy' } });
  assert.deepEqual(shortSide.actions, []); assert.deepEqual(shortSide.rejected.map(r => `${r.id}:${r.reason}`), ['s:limit_entry_long_only']);
  const market = buildActions(events, v, cfg);
  assert.deepEqual(market.actions.map(a => a.id), ['p', 'q', 'r', 't']); assert(market.actions.every(a => a.entry === undefined), 'no limit without entryLimit');
}

// ── end-to-end synthetic replay through the accepted engine ──
{
  const minutes: Minute[] = [];
  const total = 4 * 24 * 60;
  for (let i = 0; i < total; i++) {
    const ts = t0 + i * M; let p = 100;
    if (i >= 10 * 60 && i < 12 * 60) p = 100 + (i - 10 * 60) / 30;          // rises to 104 by hour 12 (long target hit)
    else if (i >= 12 * 60 && i < 20 * 60) p = 104 - (i - 12 * 60) / 60;      // falls to 96 by hour 20
    else if (i >= 20 * 60) p = 96;
    minutes.push({ ts, endTs: ts + M, open: p, high: p + 0.05, low: p - 0.05, close: p, volume: 1, turnover: 1, availableAt: ts + M + M });
  }
  const events = [
    ev('win', 1, t0 + 10 * H, 100, 99, 103.5),        // long, target 103.5 hit around hour 11.75
    ev('stop', 1, t0 + 13 * H, 103, 102, 110),        // long at ~103, price falling: stop 102 hit
    ev('time', -1, t0 + 21 * H, 96, 97.5, 90),        // short at 96, flat afterwards: timeout after hold
  ];
  const longs = buildActions(events, { side: 1, target: 'structural', holdHours: 24 }, cfg).actions;
  const o = { start: t0, end: t0 + total * M, delay: 0, hold: 24 * H, notional: 10000, equity: 32000, fee: 0.00055, targetFirst: false };
  const run = replay(minutes as any, longs, o);
  auditStructuralReplay(minutes as any, longs, o, run);
  assert.deepEqual(run.trades.map((t: any) => [t.id, t.reason]), [['win', 'target'], ['stop', 'stop']]);
  assert(run.trades[0].net > 0 && run.trades[1].net < 0);
  assert.equal(run.trades[0].entryPrice, minutes[10 * 60].open, 'entry at the open of the minute starting at known-at');
  const shorts = buildActions(events, { side: -1, target: 'structural', holdHours: 12 }, cfg).actions;
  const run2 = replay(minutes as any, shorts, o);
  auditStructuralReplay(minutes as any, shorts, o, run2);
  assert.deepEqual(run2.trades.map((t: any) => [t.id, t.reason]), [['time', 'timeout']]);
  assert.equal(run2.trades[0].exitAt, t0 + 21 * H + 12 * H, 'time exit at expiresAt');
}

console.log('setup-replay tests passed');
