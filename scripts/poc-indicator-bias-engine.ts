/** PI01/DB01: research only. No live/executor imports. */
import assert from 'assert/strict';
import type { Candle } from './hype-freerun-canonical-replay';
import type { Candle as Bar } from '../src/fetch-candles';
import { computeResearchFeatures } from '../src/research/indicator-features';
import { computeVwapVolumeValues } from '../src/research/vwap-volume-features';
import { computeVolumeFlowValues } from '../src/research/volume-flow-features';
import { computeMacdValues } from '../src/research/macd-features';
import { computeBollingerValues } from '../src/research/bollinger-features';
import { resolveLimitEntry, type LimitEntry, type LimitIntent } from './structural-limit-entry';
export const M = 60000, H = 60 * M, D = 24 * H;
export type Row = Record<string, any>;
export interface Action { id: string; at: number; side: 1 | -1; target?: number; stop?: number;
  expiresAt?: number; failureAt?: number; evidence?: Row; entry?: LimitEntry; }

/** Only complete contiguous UTC buckets; partial first/last buckets omitted. */
export function aggregate(cs: readonly Candle[], tf: number): Bar[] {
  assert(tf >= M && tf % M === 0 && D % tf === 0);
  const out: Bar[] = [];
  for (let i = 0; i < cs.length;) {
    const start = Math.floor(cs[i].ts / tf) * tf, begin = i;
    let high = -Infinity, low = Infinity, volume = 0, turnover = 0;
    while (i < cs.length && cs[i].ts < start + tf) {
      if (i > begin) assert.equal(cs[i].ts, cs[i - 1].endTs);
      high = Math.max(high, cs[i].high); low = Math.min(low, cs[i].low);
      volume += cs[i].volume; turnover += cs[i].turnover; i++;
    }
    if (cs[begin].ts !== start || i - begin !== tf / M) continue;
    out.push({ timestamp: start, open: cs[begin].open, close: cs[i - 1].close, high, low, volume, turnover });
  }
  return out;
}
export function indicatorTape(cs: readonly Candle[]) {
  const tables = new Map<number, Map<number, Row>>();
  for (const mins of [15, 60, 240]) {
    const bars = aggregate(cs, mins * M), base = computeResearchFeatures(bars, mins * M);
    const vv = computeVwapVolumeValues(bars, mins * M), mfi = computeVolumeFlowValues(bars, mins * M, 'mfi', 14);
    const cmf = computeVolumeFlowValues(bars, mins * M, 'cmf', 20), obv = computeVolumeFlowValues(bars, mins * M, 'obv', 20);
    const macd = computeMacdValues(bars, mins * M, 12, 26, 9), bb = computeBollingerValues(bars, mins * M, 20, 2);
    tables.set(mins, new Map(bars.map((b, i) => [b.timestamp + mins * M, {
      ...base[i], ...vv[i], mfi: mfi[i].vfValue, cmf: cmf[i].vfValue, obv: obv[i].vfValue,
      diSpread: base[i].plusDI14 === null || base[i].minusDI14 === null ? null : base[i].plusDI14! - base[i].minusDI14!,
      macdHistPct: macd[i].macdHist === null ? null : 100 * macd[i].macdHist! / b.close,
      bbPercentB: bb[i].bbPercentB, close: b.close,
    }])));
  }
  return { tables, at(at: number, lag = M) {
    const features: Row = {}, sources: Row[] = [];
    for (const [mins, table] of tables) {
      const end = Math.floor((at - lag) / (mins * M)) * mins * M, row = table.get(end);
      sources.push({ timeframeMinutes: mins, barEnd: end, availableAt: end + lag, present: !!row });
      assert(end + lag <= at);
      for (const field of ['rsi14', 'crsi', 'roc5', 'atrPct', 'adx14', 'diSpread', 'rvol20', 'vvDay', 'vvWeek',
        'vvDayDistance', 'vvWeekDistance', 'mfi', 'cmf', 'obv', 'macdHistPct', 'bbPercentB']) features[`${field}_${mins}`] = row?.[field] ?? null;
    }
    return { asOf: at, lag, features, sources };
  } };
}
export function compare(features: Row, conditions: any[]): boolean | null {
  if (conditions.some(([k]) => !Number.isFinite(features[k]) || features[k] === null)) return null;
  return conditions.every(([k, op, v]) => op === '<' ? features[k] < v : op === '<=' ? features[k] <= v : op === '>=' ? features[k] >= v : features[k] > v);
}
export function amounts(xs: Row[]) {
  const wins = xs.filter(x => x.net > 1e-8), losses = xs.filter(x => x.net < -1e-8);
  const sum = (rs: Row[]) => rs.reduce((s, r) => s + r.net, 0), win = sum(wins), loss = sum(losses);
  return { n: xs.length, wins: wins.length, losses: losses.length, winningDollars: win, losingDollars: loss, net: sum(xs),
    average: xs.length ? sum(xs) / xs.length : null, avgLoss: losses.length ? loss / losses.length : null,
    winRate: xs.length ? wins.length / xs.length : null, profitFactor: loss < 0 ? win / -loss : null,
    avgR: xs.length && xs.every(x => Number.isFinite(x.r) && x.r !== null) ? xs.reduce((s, r) => s + r.r, 0) / xs.length : null,
    heavy: xs.filter(x => x.net <= -300).length, heavyDollars: sum(xs.filter(x => x.net <= -300)),
    best: Math.max(0, ...xs.map(x => x.net)), worst: Math.min(0, ...xs.map(x => x.net)) };
}
export function partitions(events: Row[], definitions: any[], split: number) {
  const groups = (rs: Row[], def: any[]) => {
    const known = rs.filter(e => compare(e.features, def) !== null), yes = known.filter(e => compare(e.features, def)), no = known.filter(e => !compare(e.features, def));
    return { baseline: amounts(known), condition: amounts(yes), other: amounts(no), unknown: amounts(rs.filter(e => compare(e.features, def) === null)),
      conditionIds: yes.map(e => e.id), otherIds: no.map(e => e.id),
      heavyPrecision: yes.length ? yes.filter(e => e.heavy).length / yes.length : null,
      heavyRecall: known.some(e => e.heavy) ? yes.filter(e => e.heavy).length / known.filter(e => e.heavy).length : null,
      sacrificedWinners: amounts(yes.filter(e => e.net > 0)) };
  };
  return definitions.map(([id, conditions]) => ({ id, conditions, ...groups(events, conditions),
    early: groups(events.filter(e => e.signalAt < split), conditions), late: groups(events.filter(e => e.signalAt >= split), conditions),
    monthly: [...new Set(events.map(e => e.month))].sort().map(month => ({ month, ...groups(events.filter(e => e.month === month), conditions) })) }));
}
export function pivots(bars: readonly Bar[], width: number) {
  assert(Number.isInteger(width) && width >= 1);
  const out: Row[] = [];
  for (let j = width; j + width < bars.length; j++) {
    const neighbors = bars.slice(j - width, j + width + 1).filter((_, i) => i !== width);
    const availableAt = bars[j + width].timestamp + 4 * H + M;
    if (neighbors.every(b => bars[j].high > b.high)) out.push({ kind: 'high', price: bars[j].high, pivotAt: bars[j].timestamp, confirmationEnd: availableAt - M, availableAt });
    if (neighbors.every(b => bars[j].low < b.low)) out.push({ kind: 'low', price: bars[j].low, pivotAt: bars[j].timestamp, confirmationEnd: availableAt - M, availableAt });
  }
  return out.sort((a, b) => a.availableAt - b.availableAt || a.kind.localeCompare(b.kind));
}
export function dailySignals(cs: readonly Candle[], bars: readonly Bar[], daily: readonly Bar[], width: number, session: number, targetMode: string) {
  const ps = pivots(bars, width), days = new Map(daily.map(b => [b.timestamp, b]));
  const base = cs[0].ts, priceAt = (at: number) => cs[(at - base) / M];
  const signals: Action[] = [], decisions: Row[] = [];
  let pi = 0, hi: Row | null = null, lo: Row | null = null;
  for (let day = Math.ceil(base / D) * D; day + session * H + M < cs.at(-1)!.endTs; day += D) {
    const sessionAt = day + session * H, at = sessionAt + M;
    while (pi < ps.length && ps[pi].availableAt <= at) { const p = ps[pi++]; if (p.kind === 'high') hi = p; else lo = p; }
    const priorDay = days.get(day - D), price = priceAt(sessionAt - M)?.close;
    const row: Row = { at, sessionAt, width, session, targetMode, rangeHigh: hi, rangeLow: lo, priorDayStart: day - D,
      priorDayAvailableAt: day + M, priceSourceEnd: sessionAt, priceAvailableAt: sessionAt + M, price, reason: 'no_range' };
    decisions.push(row);
    if (!hi || !lo || hi.price <= lo.price || !price || !priorDay) continue;
    const location = (price - lo.price) / (hi.price - lo.price); row.location = location;
    if (location <= 0 || location >= 1) { row.reason = 'outside_range'; continue; }
    if (location > .4 && location < .6) { row.reason = 'middle'; continue; }
    const side: 1 | -1 = location <= .4 ? 1 : -1, stop = side === 1 ? lo.price : hi.price;
    const target = targetMode === 'previous_day' ? side === 1 ? priorDay.high : priorDay.low : side === 1 ? hi.price : lo.price;
    if (side * (target - price) <= 0) { row.reason = 'target_behind_price'; continue; }
    row.reason = 'signal'; row.side = side; row.target = target; row.stop = stop;
    row.bias = `${side === 1 ? 'Bull/discount' : 'Bear/premium'} ${(100 * location).toFixed(1)}% of confirmed 4H range; target ${targetMode} ${target}; invalidation ${stop}`;
    signals.push({ id: `db:${width}:${session}:${targetMode}:${at}`, at, side, target, stop, expiresAt: at + D, evidence: row });
  }
  return { signals, decisions, pivots: ps };
}
export function failureTriggers(signals: Row[], bars: readonly Bar[], count: number): Map<string, Row> {
  const table = new Map(bars.map(b => [b.timestamp, b])), out = new Map<string, Row>();
  for (const s of signals) {
    let streak = 0;
    for (let t = Math.ceil(s.signalAt / (15 * M)) * 15 * M; t + 15 * M <= s.signalAt + H; t += 15 * M) {
      const b = table.get(t); streak = b && b.close < s.lower ? streak + 1 : 0;
      if (streak >= count) { out.set(s.id, { at: t + 15 * M + M, barEnd: t + 15 * M,
        firstBarStart: t - (count - 1) * 15 * M, close: b!.close, lower: s.lower, signalAt: s.signalAt, count }); break; }
    }
  }
  return out;
}

export function replay(cs: readonly Candle[], signals: readonly Action[], o: { start: number; end: number; delay: number;
  hold: number; notional: number; equity: number; fee: number; targetFirst?: boolean }) {
  const base = cs[0].ts, bar = (at: number) => { const c = cs[(at - base) / M]; assert(c && c.ts === at); return c; };
  const monthly = new Map<string, Row>();
  for (let at = o.start; at < o.end;) { const d = new Date(at), month = d.toISOString().slice(0, 7);
    monthly.set(month, { month, wins: 0, losses: 0, winningDollars: 0, losingDollars: 0, closedNet: 0, markedNet: 0 });
    at = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
  let cash = o.equity, lastMark = cash, peak = cash, dd = 0, closeDd = 0, available = o.start, turnover = 0, feesPaid = 0;
  let exposure = 0, rawSignals = 0, skipped = 0, cancelled = 0, pending = false, bankrupt = false, ambiguous = 0;
  let monthEnd = -1, month: Row; const curves = new Map<number, Row>(), trades: Row[] = [], accepted: Row[] = [];
  let open: Row | null = null;
  const entryIntents: LimitIntent[] = []; let entryAmbiguous = 0;
  const observe = (at: number, value: number, adverse: number) => {
    if (at >= monthEnd) { const d = new Date(at); month = monthly.get(d.toISOString().slice(0, 7))!;
      monthEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
    dd = Math.max(dd, (peak - adverse) / peak * 100); peak = Math.max(peak, value);
    closeDd = Math.max(closeDd, (peak - value) / peak * 100); bankrupt ||= adverse <= 0;
    month.markedNet += value - lastMark; lastMark = value;
    curves.set(Math.floor(at / D), { at, equity: value, maxDrawdownPct: dd });
  };
  const times = new Set(signals.map(s => s.at));
  let previous = -1;
  for (const s of signals) {
    assert(s.at > previous); previous = s.at;
    if (s.at < o.start || s.at >= o.end) continue; rawSignals++;
    if (s.at < available) { skipped++; continue; }
    let intent: LimitIntent | null = null;
    if (s.entry) {
      intent = resolveLimitEntry(cs, s, o.delay, o.end); entryIntents.push(intent);
      if (intent.entryAt === null) { available = intent.endedAt; pending ||= intent.phase === 'cutoff'; continue; }
    }
    const entryAt = intent?.entryAt ?? s.at + o.delay;
    if (entryAt >= o.end) { pending = true; break; }
    const entryPrice = s.entry?.price ?? bar(entryAt).open;
    if (s.stop !== undefined && (s.side * (entryPrice - s.stop) <= 0 || s.side * (s.target! - entryPrice) <= 0)) { cancelled++; continue; }
    accepted.push({ at: s.at, id: s.id });
    const deadline = s.entry ? entryAt + (s.expiresAt! - s.at) : s.expiresAt !== undefined ? s.expiresAt + o.delay : entryAt + o.hold + o.delay;
    const planned = Math.min(deadline, (s.failureAt ?? Infinity) + o.delay);
    const qty = o.notional / entryPrice, feeIn = o.notional * o.fee;
    cash -= feeIn; turnover += o.notional; feesPaid += feeIn;
    const mark = (p: number) => cash + s.side * qty * (p - entryPrice) - qty * p * o.fee;
    let exitAt = planned, exitPrice: number | null = null, reason = s.failureAt !== undefined && planned < deadline ? 'poc_failure' : 'timeout';
    let exitAdverse = 0, touchedBoth = false;
    for (let t = entryAt; t < Math.min(planned, o.end); t += M) {
      const c = bar(t);
      if (s.stop !== undefined) {
        const intrabarEntry = t === entryAt && intent?.intrabar === true;
        const uncertainEntryTarget = intrabarEntry && c.high >= s.target! && c.close < s.target!;
        if (uncertainEntryTarget) entryAmbiguous++;
        const gapStop = !intrabarEntry && s.side * (c.open - s.stop) <= 0, gapTarget = !intrabarEntry && s.side * (c.open - s.target!) >= 0;
        const stop = s.side === 1 ? c.low <= s.stop : c.high >= s.stop;
        const target = intrabarEntry && !o.targetFirst ? c.close >= s.target! : s.side === 1 ? c.high >= s.target! : c.low <= s.target!;
        if (gapStop || gapTarget || stop || target) {
          exitAt = t; touchedBoth = !gapStop && !gapTarget && stop && target;
          if (touchedBoth) ambiguous++;
          reason = gapStop ? 'stop' : gapTarget ? 'target' : stop && (!target || !o.targetFirst) ? 'stop' : 'target';
          exitPrice = gapStop || gapTarget ? c.open : reason === 'stop' ? s.stop : s.target!;
          // Conservative target-minute adverse bound: low/high may precede target.
          const adversePrice = gapStop || gapTarget ? c.open : reason === 'stop' || touchedBoth ? s.stop : s.side === 1 ? c.low : c.high;
          exitAdverse = mark(adversePrice); exposure++; break;
        }
      }
      observe(t, mark(c.close), mark(s.side === 1 ? c.low : c.high)); exposure++;
    }
    if (exitAt < o.end) {
      exitPrice ??= bar(exitAt).open;
      const pricePnl = s.side * qty * (exitPrice - entryPrice), feeOut = qty * exitPrice * o.fee;
      const tr = { id: s.id, signalAt: s.at, entryAt, exitAt, entryPrice, exitPrice, side: s.side, qty,
        pricePnl, fees: feeIn + feeOut, net: pricePnl - feeIn - feeOut, reason, target: s.target ?? null, stop: s.stop ?? null,
        r: s.stop === undefined ? null : (pricePnl - feeIn - feeOut) / (qty * Math.abs(entryPrice - s.stop)), touchedBoth, evidence: s.evidence ?? null };
      trades.push(tr); cash += pricePnl - feeOut; turnover += qty * exitPrice; feesPaid += feeOut;
      if (!(o.delay === 0 && times.has(exitAt) && s.stop === undefined)) observe(exitAt, cash, s.stop === undefined ? cash : Math.min(cash, exitAdverse || cash));
      const m = monthly.get(new Date(exitAt).toISOString().slice(0, 7))!; m.closedNet += tr.net;
      if (tr.net > 1e-8) { m.wins++; m.winningDollars += tr.net; } else if (tr.net < -1e-8) { m.losses++; m.losingDollars += tr.net; }
      available = exitAt + (reason === 'target' || reason === 'stop' ? M : 0); // intrabar exits cannot free this minute's open
    } else {
      const markedPrice = bar(o.end - M).close;
      open = { id: s.id, signalAt: s.at, entryAt, entryPrice, qty, side: s.side, markedPrice,
        net: s.side * qty * (markedPrice - entryPrice) - feeIn - qty * markedPrice * o.fee };
      turnover += qty * markedPrice; available = planned; pending = planned - o.delay < o.end;
    }
  }
  const net = lastMark - o.equity, closedNet = trades.reduce((v, t) => v + t.net, 0);
  assert(Math.abs(net - closedNet - (open?.net ?? 0)) < 1e-6);
  assert(Math.abs([...monthly.values()].reduce((v, m) => v + m.markedNet, 0) - net) < 1e-6);
  return { trades, open, monthly: [...monthly.values()], accepted, curve: [...curves.values()], entryIntents, entryAmbiguous, stats: {
    ...amounts(trades), trades: trades.length, net, closedNet, openNet: open?.net ?? 0, maxAdverseDrawdownPct: dd,
    maxCloseDrawdownPct: closeDd, feesPaid, turnoverIncludingMarkedExit: turnover, exposureHours: exposure / 60,
    rawSignals, skippedOccupied: skipped, cancelled, pendingAtEnd: pending, bankrupt, ambiguous } };
}
