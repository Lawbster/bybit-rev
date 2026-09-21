/** PB01: offline causal signal construction and fixed-notional execution. No bot imports. */
import assert from 'assert/strict';
import { periodStart, type Period, type AsOfProfile } from './poc-profile-engine';
import type { Candle } from './hype-freerun-canonical-replay';
export const M = 60000, H = 60 * M, D = 24 * H;
export type Universe = 'latest' | 'naked';
export type Style = 0 | 1 | 5 | 15 | 60;
export interface Reader { at: (at: number, filter?: { venue?: string; period?: Period; width?: string }) => AsOfProfile[];
  nakedAt: Reader['at']; }
export interface Encounter { id: string; universe: Universe; period: Period; profileId: string; profileEnd: number; availableAt: number;
  lower: number; upper: number; at: number; touchStart: number; priorClose: number; touchClose: number; exactNaked: boolean; }
export interface Signal extends Encounter { rule: string; style: Style; signalAt: number; confirmationStart: number | null; confirmationClose: number; }
export const periods: Period[] = ['day', 'week', 'month'], universes: Universe[] = ['latest', 'naked'], styles: Style[] = [0, 1, 5, 15, 60];
export const ruleId = (u: Universe, p: Period, s: Style) => `${u}_${p}_${s ? 'close' + s + 'm' : 'touch'}`;
export const ruleIds = universes.flatMap(u => periods.flatMap(p => styles.map(s => ruleId(u, p, s))));
export function validateTape(cs: readonly Candle[], start: number, end: number) {
  assert.equal(cs[0].ts, start); assert.equal(cs.at(-1)!.endTs, end);
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]; assert.equal(c.ts % M, 0); assert.equal(c.endTs, c.ts + M); if (i) assert.equal(cs[i - 1].endTs, c.ts);
    assert([c.open, c.high, c.low, c.close].every(x => Number.isFinite(x) && x > 0));
    assert(c.low <= Math.min(c.open, c.close) && c.high >= Math.max(c.open, c.close));
  }
}
export function buildBounceSignals(cs: readonly Candle[], reader: Reader, badMinutes = new Set<number>()) {
  const encounters: Encounter[] = [], raw: Signal[] = [];
  let candidates: AsOfProfile[] = [], latest: AsOfProfile[] = [], nextRefresh = -1;
  const armed = new Map<string, { ready: boolean; lastAt: number }>();
  const waiting: { e: Encounter; remaining: Style[] }[] = [];
  let expiredConfirmations = 0, incompleteConfirmations = 0;
  const emit = (e: Encounter, style: Style, c: Candle) => raw.push({ ...e, rule: ruleId(e.universe, e.period, style), style,
    signalAt: c.endTs, confirmationStart: style ? c.endTs - style * M : null, confirmationClose: c.close });
  for (let i = 1; i < cs.length; i++) {
    const c = cs[i], t = c.ts, prior = cs[i - 1]; assert.equal(prior.endTs, t);
    if (t >= nextRefresh) {
      candidates = reader.nakedAt(t, { venue: 'bybit', width: '0.10' });
      const known = reader.at(t, { venue: 'bybit', width: '0.10' });
      latest = periods.flatMap(period => known.filter(p => p.period === period && p.end === periodStart(t - M, period)));
      nextRefresh = Math.floor((t - M) / D) * D + D + M;
    }
    const states = new Map<Period, Map<string, AsOfProfile>>();
    const atEnd = (p: AsOfProfile) => {
      if (!states.has(p.period)) states.set(p.period, new Map(reader.at(c.endTs, { venue: 'bybit', period: p.period, width: '0.10' }).map(x => [x.id, x])));
      return states.get(p.period)!.get(p.id)!;
    };
    const make = (p: AsOfProfile, universe: Universe): Encounter => ({ id: `${universe}:${p.id}:${t}`, universe, period: p.period,
      profileId: p.id, profileEnd: p.end, availableAt: p.availableAt, lower: Number(p.lower), upper: Number(p.upper),
      at: c.endTs, touchStart: t, priorClose: prior.close, touchClose: c.close, exactNaked: universe === 'naked' });
    const register = (p: AsOfProfile, u: Universe) => {
      const e = make(p, u); encounters.push(e); emit(e, 0, c); waiting.push({ e, remaining: [1, 5, 15, 60] });
    };
    if (!badMinutes.has(t)) {
      for (const p of latest) {
        assert(p.availableAt <= t); const hi = Number(p.upper), lo = Number(p.lower);
        let a = armed.get(p.id); if (!a) { a = { ready: true, lastAt: -Infinity }; armed.set(p.id, a); }
        if (!a.ready && t >= a.lastAt + H && prior.close >= hi * 1.005) a.ready = true;
        if (a.ready && prior.close > hi && c.low < hi && c.high >= lo) {
          register(p, 'latest'); a.ready = false; a.lastAt = c.endTs;
        }
      }
      candidates = candidates.filter(p => {
        const hi = Number(p.upper), lo = Number(p.lower);
        if (!(c.low < hi && c.high >= lo)) return true;
        const now = atEnd(p);
        if (prior.close > hi && now.status === 'tested' && now.retestEvidenceAt === c.endTs && now.firstRetestExact) register(p, 'naked');
        return now.status === 'untested';
      });
    } else candidates = reader.nakedAt(c.endTs, { venue: 'bybit', width: '0.10' });
    for (let j = waiting.length - 1; j >= 0; j--) {
      const w = waiting[j];
      if (c.endTs > w.e.at + H) { expiredConfirmations += w.remaining.length; waiting.splice(j, 1); continue; }
      w.remaining = w.remaining.filter(s => {
        if (!badMinutes.has(t) && c.endTs % (s * M) === 0 && c.endTs - s * M >= w.e.availableAt && c.close > w.e.upper) {
          emit(w.e, s, c); return false;
        }
        return true;
      });
      if (!w.remaining.length) waiting.splice(j, 1);
    }
  }
  incompleteConfirmations = waiting.reduce((n, w) => n + w.remaining.length, 0);
  // Select only by information already known, not by excursion/return after touch.
  raw.sort((a, b) => a.signalAt - b.signalAt || a.rule.localeCompare(b.rule) || b.profileEnd - a.profileEnd || a.profileId.localeCompare(b.profileId) || a.at - b.at);
  const signals: Signal[] = []; let lastKey = '';
  for (const s of raw) { const k = `${s.rule}:${s.signalAt}`; if (k !== lastKey) signals.push(s); lastKey = k; }
  return { encounters, signals, duplicatesSuppressed: raw.length - signals.length, expiredConfirmations, incompleteConfirmations };
}
export interface Schedule { at: number; id: string; sourceAt?: number }
export interface RunOptions { start: number; end: number; delay: number; hold: number; equity: number; notional: number; fee: number }
export interface Trade { id: string; signalAt: number; entryAt: number; exitAt: number; entryPrice: number; exitPrice: number;
  qty: number; pricePnl: number; fees: number; net: number; reason: 'timeout' }
export interface Month { month: string; wins: number; losses: number; winningDollars: number; losingDollars: number; closedNet: number; markedNet: number }
/** Sparse event execution with full occupied-minute MTM. Fee/PnL conventions match existing standalone engine. */
export function runSchedule(cs: readonly Candle[], schedule: readonly Schedule[], o: RunOptions) {
  assert(o.start >= cs[0].ts && o.end <= cs.at(-1)!.endTs && o.start < o.end);
  assert([o.start, o.end, o.delay, o.hold].every(x => Number.isSafeInteger(x) && x % M === 0));
  assert(o.delay >= 0 && o.hold > 0 && o.notional > 0 && o.equity > 0 && o.fee >= 0);
  const base = cs[0].ts, candle = (at: number) => { const c = cs[(at - base) / M]; assert(c && c.ts === at); return c; };
  const months = new Map<string, Month>();
  for (let t = o.start; t < o.end;) { const key = new Date(t).toISOString().slice(0, 7); months.set(key, { month: key, wins: 0, losses: 0, winningDollars: 0, losingDollars: 0, closedNet: 0, markedNet: 0 }); const d = new Date(t); t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
  let currentMonth = '', monthEnd = -1; let month: Month;
  const monthAt = (at: number) => { if (at >= monthEnd || !currentMonth) { const d = new Date(at); currentMonth = d.toISOString().slice(0, 7); monthEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); month = months.get(currentMonth)!; } return month!; };
  let available = o.start, cash = o.equity, peak = cash, lastMark = cash, dd = 0, closeDd = 0, feesPaid = 0, turnover = 0, exposure = 0;
  let skipped = 0, pending = false, bankrupt = false, open: any = null, rawSignals = 0;
  const trades: Trade[] = [], accepted: Schedule[] = [];
  const observe = (at: number, value: number, adverse: number) => {
    dd = Math.max(dd, (peak - adverse) / peak * 100); peak = Math.max(peak, value); closeDd = Math.max(closeDd, (peak - value) / peak * 100);
    monthAt(at).markedNet += value - lastMark; lastMark = value; bankrupt ||= adverse <= 0;
  };
  let previousSignal = -1;
  const scheduledTimes = new Set(schedule.map(s => s.at));
  for (const s of schedule) {
    assert(s.at > previousSignal, 'Unique sorted signal clock required'); previousSignal = s.at;
    if (s.at < o.start || s.at >= o.end) continue; rawSignals++;
    if (s.at < available) { skipped++; continue; }
    const entryAt = s.at + o.delay, exitAt = entryAt + o.hold + o.delay; accepted.push(s); available = exitAt;
    if (entryAt >= o.end) { pending = true; continue; }
    const entryPrice = candle(entryAt).open, qty = o.notional / entryPrice, feeIn = o.notional * o.fee;
    cash -= feeIn; feesPaid += feeIn; turnover += o.notional;
    for (let t = entryAt; t < Math.min(exitAt, o.end); t += M) {
      const c = candle(t), mark = (price: number) => cash + qty * (price - entryPrice) - qty * price * o.fee;
      observe(t, mark(c.close), mark(c.low)); exposure++;
    }
    if (exitAt < o.end) {
      const exitPrice = candle(exitAt).open, pricePnl = qty * (exitPrice - entryPrice), feeOut = qty * exitPrice * o.fee;
      const tr: Trade = { id: s.id, signalAt: s.at, entryAt, exitAt, entryPrice, exitPrice, qty, pricePnl, fees: feeIn + feeOut, net: pricePnl - feeIn - feeOut, reason: 'timeout' };
      cash += pricePnl - feeOut; feesPaid += feeOut; turnover += qty * exitPrice; trades.push(tr);
      // Flat at exit open: do not peek at the exit minute's later extremes.
      if (!(o.delay === 0 && scheduledTimes.has(exitAt))) observe(exitAt, cash, cash);
      const m = monthAt(exitAt); m.closedNet += tr.net;
      if (tr.net > 1e-8) { m.wins++; m.winningDollars += tr.net; } else if (tr.net < -1e-8) { m.losses++; m.losingDollars += tr.net; }
    } else {
      const markedPrice = candle(o.end - M).close;
      open = { id: s.id, signalAt: s.at, entryAt, entryPrice, qty, markedPrice, net: qty * (markedPrice - entryPrice) - feeIn - qty * markedPrice * o.fee };
      turnover += qty * markedPrice; pending = exitAt - o.delay < o.end;
    }
  }
  const net = lastMark - o.equity, closedNet = trades.reduce((s, t) => s + t.net, 0);
  assert(Math.abs(net - closedNet - (open?.net ?? 0)) < 1e-6);
  assert(Math.abs([...months.values()].reduce((s, m) => s + m.markedNet, 0) - net) < 1e-6);
  return { trades, open, monthly: [...months.values()], accepted, stats: { trades: trades.length, wins: trades.filter(t => t.net > 1e-8).length,
    losses: trades.filter(t => t.net < -1e-8).length, winningDollars: trades.reduce((s, t) => s + Math.max(0, t.net), 0),
    losingDollars: trades.reduce((s, t) => s + Math.min(0, t.net), 0), net, closedNet, openNet: open?.net ?? 0,
    maxAdverseDrawdownPct: dd, maxCloseDrawdownPct: closeDd, feesPaid, turnoverIncludingMarkedExit: turnover,
    exposureHours: exposure / 60, rawSignals, skippedOccupied: skipped, pendingAtEnd: pending, bankrupt } };
}
export function clockSchedule(start: number, end: number, delay: number): Schedule[] {
  const out: Schedule[] = []; for (let at = Math.ceil(start / (12 * H)) * 12 * H; at < end; at += 12 * H + 2 * delay) out.push({ at, id: `clock:${at}` }); return out;
}
