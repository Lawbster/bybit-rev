/** HT01 independent short minute-path checker, derived from accepted LV03 arithmetic. No replay call. */
import assert from 'assert/strict';
import type { Candle } from './hype-freerun-canonical-replay';
type Row = Record<string, any>;
const M = 60000, H = 3600000;
export const near = (a: number, b: number, label = '') => assert(Math.abs(a - b) < 1e-6 + Math.abs(b) * 1e-10, `${label}: ${a} != ${b}`);
export function auditShort(cs: readonly Candle[], signals: readonly Row[], row: Row, run: Row, c: Row) {
  const o = run.options, base = cs[0].ts, bar = (t: number) => { const b = cs[(t - base) / M]; assert(b && b.ts === t); return b; };
  assert.equal(o.capHours, row.capHours); assert.equal(o.delay, row.delay); assert.equal(o.targetFirst, row.targetFirst);
  const months = new Map<string, Row>();
  for (let at = o.start; at < o.end;) { const d = new Date(at); months.set(d.toISOString().slice(0, 7), {
    wins: 0, losses: 0, winningDollars: 0, losingDollars: 0, closedNet: 0, markedNet: 0 }); at = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
  let cash = c.equity, last = cash, peak = cash, dd = 0, closeDd = 0, bankrupt = false, minutes = 0, monthEnd = 0, current: Row;
  const observe = (at: number, mark: number, adverse: number) => {
    if (at >= monthEnd) { const d = new Date(at); current = months.get(d.toISOString().slice(0, 7))!; monthEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
    dd = Math.max(dd, 100 * (peak - adverse) / peak); peak = Math.max(peak, mark);
    closeDd = Math.max(closeDd, 100 * (peak - mark) / peak); bankrupt ||= adverse <= 0;
    current.markedNet += mark - last; last = mark;
  };
  let free = o.start, raw = 0, skipped = 0, pending = false, turnover = 0, fees = 0, exposure = 0, ambiguities = 0;
  const accepted: Row[] = [], trades: Row[] = []; let open: Row | null = null;
  const times = new Set(signals.map(s => s.at)), timed = row.tpPct === null;
  for (const s of signals) {
    if (s.at < o.start || s.at >= o.end) continue; raw++;
    if (s.at < free) { skipped++; continue; }
    const entered = s.at + o.delay; if (entered >= o.end) { pending = true; break; }
    assert.equal(s.side, -1); const price = bar(entered).open, qty = c.notional / price, entryFee = c.notional * c.fee;
    const target = timed ? null : price * (1 - row.tpPct / 100), stop = timed ? null : price * (1 + row.slPct / 100);
    const timeout = row.capHours === null ? Infinity : entered + row.capHours * H + o.delay;
    accepted.push({ at: s.at, id: s.id }); cash -= entryFee; turnover += c.notional; fees += entryFee;
    const value = (p: number) => cash + qty * (price - p) - qty * p * c.fee;
    let exitAt = timeout, exit: number | null = null, reason = 'timeout', both = false, adverse: number | null = null;
    for (let t = entered; t < Math.min(timeout, o.end); t += M) {
      const b = bar(t); minutes++; exposure++;
      if (!timed && (b.high >= stop! || b.low <= target!)) {
        const gapSl = b.open >= stop!, gapTp = b.open <= target!;
        both = !gapSl && !gapTp && b.high >= stop! && b.low <= target!; if (both) ambiguities++;
        reason = gapSl ? 'stop' : gapTp ? 'target' : b.high >= stop! && (!both || !row.targetFirst) ? 'stop' : 'target';
        exitAt = t; exit = gapSl || gapTp ? b.open : reason === 'stop' ? stop : target;
        adverse = value(gapSl || gapTp ? b.open : reason === 'stop' || both ? stop! : b.high); break;
      }
      observe(t, value(b.close), value(b.high));
    }
    if (exitAt < o.end) {
      exit ??= bar(exitAt).open; const gross = qty * (price - exit), exitFee = qty * exit * c.fee, net = gross - entryFee - exitFee;
      cash += gross - exitFee; fees += exitFee; turnover += qty * exit;
      if (!(timed && !o.delay && times.has(exitAt))) observe(exitAt, cash, Math.min(cash, adverse ?? cash));
      const m = months.get(new Date(exitAt).toISOString().slice(0, 7))!; m.closedNet += net;
      if (net > 1e-8) { m.wins++; m.winningDollars += net; } else if (net < -1e-8) { m.losses++; m.losingDollars += net; }
      const expected = { id: s.id, signalAt: s.at, entryAt: entered, exitAt, entryPrice: price, exitPrice: exit, side: -1,
        qty, pricePnl: gross, fees: entryFee + exitFee, net, reason, target, stop, r: timed ? null : net / (qty * (stop! - price)), touchedBoth: both, evidence: null };
      const actual = run.trades[trades.length]; assert(actual, 'Missing receipt');
      for (const [k, v] of Object.entries(expected)) typeof v === 'number' ? near(actual[k], v, k) : assert.deepEqual(actual[k], v, k);
      trades.push(expected); free = exitAt + (reason === 'timeout' ? 0 : M);
    } else {
      const markedPrice = bar(o.end - M).close;
      open = { id: s.id, signalAt: s.at, entryAt: entered, entryPrice: price, qty, side: -1, markedPrice,
        net: qty * (price - markedPrice) - entryFee - qty * markedPrice * c.fee };
      turnover += qty * markedPrice; free = timeout; pending = timeout - o.delay < o.end;
    }
  }
  assert.deepEqual(run.accepted, accepted); assert.deepEqual(run.open, open); assert.equal(run.trades.length, trades.length);
  const wins = trades.filter(t => t.net > 1e-8), losses = trades.filter(t => t.net < -1e-8), sum = (xs: Row[]) => xs.reduce((s, t) => s + t.net, 0);
  for (const [k, v] of Object.entries({ net: last - c.equity, closedNet: sum(trades), openNet: open?.net ?? 0,
    wins: wins.length, losses: losses.length, trades: trades.length, winningDollars: sum(wins), losingDollars: sum(losses),
    maxAdverseDrawdownPct: dd, maxCloseDrawdownPct: closeDd, feesPaid: fees, turnoverIncludingMarkedExit: turnover,
    exposureHours: exposure / 60, rawSignals: raw, skippedOccupied: skipped, ambiguous: ambiguities })) near(run.stats[k], v, k);
  assert.equal(run.stats.pendingAtEnd, pending); assert.equal(run.stats.bankrupt, bankrupt); assert.equal(run.stats.cancelled, 0);
  for (const [k, v] of Object.entries(run.stats)) assert.deepEqual(row[k], v, k);
  for (const m of run.monthly) for (const [k, v] of Object.entries(months.get(m.month)!)) near(m[k], v, m.month + '/' + k);
  assert.equal(run.monthly.length, months.size); near([...months.values()].reduce((s, m) => s + m.markedNet, 0), row.net);
  for (const [reason, field] of [['target', 'targets'], ['stop', 'stops'], ['timeout', 'timeouts']]) {
    const ts = trades.filter(t => t.reason === reason); assert.equal(row[field], ts.length); near(row[reason + 'Net'], sum(ts)); }
  if (row.capHours === null) assert.equal(row.timeouts, 0);
  near(row.stressNet, row.net - turnover * c.extraCostBpsPerSide / 10000);
  const hs = trades.map(t => (t.exitAt - t.entryAt) / H).sort((a, b) => a - b);
  if (hs.length) { near(row.meanHoldHours, hs.reduce((a, b) => a + b, 0) / hs.length); near(row.medianHoldHours, hs[Math.ceil(hs.length / 2) - 1]);
    near(row.p95HoldHours, hs[Math.ceil(hs.length * .95) - 1]); near(row.maxHoldHours, hs.at(-1)!); }
  if (open) near(row.openAgeHours, (o.end - open.entryAt) / H); else assert.equal(row.openAgeHours, null);
  return { receipts: trades.length, minutes, monthRows: months.size };
}
