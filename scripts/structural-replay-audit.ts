/** Independent audit for PA07 structural brackets; deliberately imports no replay/producer. */
import assert from 'assert/strict';
import type { Candle } from './hype-freerun-canonical-replay';
import type { Action, Row } from './poc-indicator-bias-engine';
const M = 60_000, D = 24 * 60 * M, EPS = 1e-8;
const near = (a: number, b: number, label: string) => assert(Math.abs(a - b) <= 1e-6 + Math.abs(b) * 1e-10, `${label}: ${a} != ${b}`);
type Options = { start: number; end: number; delay: number; hold: number; notional: number; equity: number; fee: number; targetFirst?: boolean };

/** Validates a producer journal against structural actions. Explicit expiry is mandatory and is measured from actual entry only via its producer deadline. */
export function auditStructuralReplay(cs: readonly Candle[], actions: readonly Action[], o: Options, run: Row) {
  assert(cs.length); const base = cs[0].ts, bar = (at: number) => { const b = cs[(at - base) / M]; assert(b && b.ts === at, `missing minute ${at}`); return b; };
  let previous = -Infinity; for (const s of actions) { assert(s.at > previous, 'actions must be ordered'); previous = s.at; assert(s.side === 1 || s.side === -1, `${s.id}: side`); assert(Number.isFinite(s.stop) && Number.isFinite(s.target) && Number.isFinite(s.expiresAt) && s.expiresAt! > s.at, `${s.id}: structural bracket/proper expiry required`); if(s.failureAt!==undefined)assert(!s.entry&&Number.isFinite(s.failureAt)&&s.failureAt>=s.at&&s.failureAt%M===0,`${s.id}: scheduled market exit must be causal, aligned, market-entry only`); }
  const monthly = new Map<string, Row>(); for (let at = o.start; at < o.end;) { const d = new Date(at), month = d.toISOString().slice(0, 7); monthly.set(month, { month, wins: 0, losses: 0, winningDollars: 0, losingDollars: 0, closedNet: 0, markedNet: 0 }); at = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
  let cash = o.equity, last = cash, peak = cash, dd = 0, closeDd = 0, available = o.start, turnover = 0, fees = 0, exposure = 0, raw = 0, skipped = 0, cancelled = 0, pending = false, bankrupt = false, ambiguous = 0, monthEnd = -1, current: Row;
  const curve = new Map<number, Row>(), trades: Row[] = [], accepted: Row[] = []; let open: Row | null = null;
  const observe = (at: number, value: number, adverse: number) => { if (at >= monthEnd) { const d = new Date(at); current = monthly.get(d.toISOString().slice(0, 7))!; monthEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); } dd = Math.max(dd, 100 * (peak - adverse) / peak); peak = Math.max(peak, value); closeDd = Math.max(closeDd, 100 * (peak - value) / peak); bankrupt ||= adverse <= 0; current.markedNet += value - last; last = value; curve.set(Math.floor(at / D), { at, equity: value, maxDrawdownPct: dd }); };
  const times = new Set(actions.map(s => s.at));
  const intents: Row[] = []; let entryAmbiguous = 0;
  for (const s of actions) {
    if (s.at < o.start || s.at >= o.end) continue; raw++;
    if (s.at < available) { skipped++; continue; }
    let intent: Row | null = null;
    if (s.entry) {
      assert.equal(s.side, 1); const l = s.entry, active = s.at + o.delay;
      assert(l.price > s.stop! && l.price < s.target! && l.expiresAt > s.at);
      intent = { id: s.id, signalAt: s.at, activeAt: active, expiresAt: l.expiresAt, limit: l.price, phase: 'cutoff', endedAt: o.end, entryAt: null, intrabar: false, ignoredTouches: 0 };
      for (let t = active; t < Math.min(l.expiresAt, o.end); t += M) {
        const b = bar(t);
        if (b.open >= s.target! || (t === active && b.open <= s.stop!)) { intent.phase = 'invalidated'; intent.endedAt = t; break; }
        const touched = l.model === 'open' ? b.open <= l.price : b.low <= l.price;
        if (touched) { intent.phase = 'filled'; intent.endedAt = t; intent.entryAt = t; intent.intrabar = b.open > l.price; break; }
        if (b.low <= l.price) intent.ignoredTouches++;
      }
      if (intent.phase === 'cutoff' && l.expiresAt <= o.end) { intent.phase = 'expired'; intent.endedAt = l.expiresAt; }
      intents.push(intent);
      if (intent.entryAt === null) { available = intent.endedAt; pending ||= intent.phase === 'cutoff'; continue; }
    }
    const entryAt = intent?.entryAt ?? s.at + o.delay; if (entryAt >= o.end) { pending = true; break; }
    const entry = s.entry?.price ?? bar(entryAt).open, stop = s.stop!, target = s.target!;
    if (s.side * (entry - stop) <= 0 || s.side * (target - entry) <= 0) { cancelled++; continue; }
    accepted.push({ at: s.at, id: s.id }); const deadline = s.entry ? entryAt + s.expiresAt! - s.at : s.expiresAt! + o.delay;
    const planned = Math.min(deadline,(s.failureAt??Infinity)+o.delay);
    const qty = o.notional / entry, feeIn = o.notional * o.fee; cash -= feeIn; turnover += o.notional; fees += feeIn;
    const mark = (price: number) => cash + s.side * qty * (price - entry) - qty * price * o.fee;
    let exitAt = planned, exit: number | null = null, reason = s.failureAt!==undefined&&planned<deadline?'poc_failure':'timeout', adverse = 0, both = false;
    for (let at = entryAt; at < Math.min(planned, o.end); at += M) { const b = bar(at);
      const intrabar = at === entryAt && intent?.intrabar === true;
      if (intrabar && b.high >= target && b.close < target) entryAmbiguous++;
      const gapStop = !intrabar && s.side * (b.open - stop) <= 0, gapTarget = !intrabar && s.side * (b.open - target) >= 0,
        hitStop = s.side === 1 ? b.low <= stop : b.high >= stop,
        hitTarget = intrabar && !o.targetFirst ? b.close >= target : s.side === 1 ? b.high >= target : b.low <= target;
      if (gapStop || gapTarget || hitStop || hitTarget) { exitAt = at; both = !gapStop && !gapTarget && hitStop && hitTarget; if (both) ambiguous++; reason = gapStop ? 'stop' : gapTarget ? 'target' : hitStop && (!hitTarget || !o.targetFirst) ? 'stop' : 'target'; exit = gapStop || gapTarget ? b.open : reason === 'stop' ? stop : target; adverse = mark(gapStop || gapTarget ? b.open : reason === 'stop' || both ? stop : s.side === 1 ? b.low : b.high); exposure++; break; }
      observe(at, mark(b.close), mark(s.side === 1 ? b.low : b.high)); exposure++;
    }
    if (exitAt < o.end) { exit ??= bar(exitAt).open; const pnl = s.side * qty * (exit - entry), feeOut = qty * exit * o.fee, net = pnl - feeIn - feeOut; const expected = { id: s.id, signalAt: s.at, entryAt, exitAt, entryPrice: entry, exitPrice: exit, side: s.side, qty, pricePnl: pnl, fees: feeIn + feeOut, net, reason, target, stop, r: net / (qty * Math.abs(entry - stop)), touchedBoth: both, evidence: s.evidence ?? null };
      const actual = run.trades[trades.length]; assert(actual, 'missing trade'); for (const [key, value] of Object.entries(expected)) typeof value === 'number' ? near(actual[key], value, key) : assert.deepEqual(actual[key], value, key); trades.push(expected); cash += pnl - feeOut; turnover += qty * exit; fees += feeOut; if (!(o.delay === 0 && times.has(exitAt) && s.stop === undefined)) observe(exitAt, cash, Math.min(cash, adverse || cash)); const m = monthly.get(new Date(exitAt).toISOString().slice(0, 7))!; m.closedNet += net; if (net > EPS) { m.wins++; m.winningDollars += net; } else if (net < -EPS) { m.losses++; m.losingDollars += net; } available = exitAt + (reason === 'target' || reason === 'stop' ? M : 0);
    } else { const marked = bar(o.end - M).close; open = { id: s.id, signalAt: s.at, entryAt, entryPrice: entry, qty, side: s.side, markedPrice: marked, net: s.side * qty * (marked - entry) - feeIn - qty * marked * o.fee }; turnover += qty * marked; available = planned; pending = planned - o.delay < o.end; }
  }
  assert.deepEqual(run.accepted, accepted); assert.deepEqual(run.open, open); assert.equal(run.trades.length, trades.length); const wins = trades.filter(x => x.net > EPS), losses = trades.filter(x => x.net < -EPS), sum = (xs: Row[]) => xs.reduce((v, x) => v + x.net, 0), closedNet = sum(trades), win = sum(wins), loss = sum(losses);
  const rs = trades.map(x => x.r), stats = { n: trades.length, trades: trades.length, net: last - o.equity, closedNet, openNet: open?.net ?? 0, wins: wins.length, losses: losses.length, winningDollars: win, losingDollars: loss, average: trades.length ? closedNet / trades.length : null, avgLoss: losses.length ? loss / losses.length : null, winRate: trades.length ? wins.length / trades.length : null, profitFactor: loss < 0 ? win / -loss : null, avgR: trades.length ? rs.reduce((v, x) => v + x, 0) / trades.length : null, heavy: trades.filter(x => x.net <= -300).length, heavyDollars: sum(trades.filter(x => x.net <= -300)), best: Math.max(0, ...trades.map(x => x.net)), worst: Math.min(0, ...trades.map(x => x.net)), maxAdverseDrawdownPct: dd, maxCloseDrawdownPct: closeDd, feesPaid: fees, turnoverIncludingMarkedExit: turnover, exposureHours: exposure / 60, rawSignals: raw, skippedOccupied: skipped, cancelled, pendingAtEnd: pending, bankrupt, ambiguous };
  for (const [key, value] of Object.entries(stats)) typeof value === 'number' ? near(run.stats[key], value, `stats/${key}`) : assert.equal(run.stats[key], value, `stats/${key}`);
  const expectedMonths = [...monthly.values()]; assert.equal(run.monthly.length, expectedMonths.length); for (let i = 0; i < expectedMonths.length; i++) for (const [key, value] of Object.entries(expectedMonths[i])) typeof value === 'number' ? near(run.monthly[i][key], value, `monthly/${i}/${key}`) : assert.equal(run.monthly[i][key], value);
  const expectedCurve = [...curve.values()]; assert.equal(run.curve.length, expectedCurve.length); for (let i = 0; i < expectedCurve.length; i++) for (const [key, value] of Object.entries(expectedCurve[i])) typeof value === 'number' ? near(run.curve[i][key], value, `curve/${i}/${key}`) : assert.equal(run.curve[i][key], value);
  near(stats.net, stats.closedNet + stats.openNet, 'net reconciliation');
  assert.deepEqual(run.entryIntents ?? [], intents, 'limit intent lifecycle/occupancy');
  assert.equal(run.entryAmbiguous ?? 0, entryAmbiguous, 'limit fill-bar ambiguity');
  return { receipts: trades.length, minutes: exposure, accepted: accepted.length, cancelled, skippedOccupied: skipped, pending: Number(pending), ambiguous, monthRows: monthly.size };
}
