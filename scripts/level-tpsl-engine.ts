/** LV02: additive research adapter; fixed percentages anchored at actual execution. */
import assert from 'assert/strict';
import { replay, type Action } from './poc-indicator-bias-engine';
import type { Candle } from './hype-freerun-canonical-replay';
export type Options = Parameters<typeof replay>[2];
export function percentageActions(cs: readonly Candle[], signals: readonly Action[], delay: number, tpPct: number, slPct: number): Action[] {
  assert(tpPct > 0 && tpPct < 100 && slPct > 0 && slPct < 100 && Number.isFinite(tpPct + slPct));
  const start = cs[0].ts;
  return signals.map(s => {
    assert(s.stop === undefined && s.target === undefined && s.failureAt === undefined && s.expiresAt === undefined);
    const b = cs[(s.at + delay - start) / 60000];
    // A pending signal beyond the final minute has no executable price. Replay
    // records it as pending, without inspecting stop/target or inventing a fill.
    if (!b) { assert(s.at + delay >= cs.at(-1)!.endTs); return { id: s.id, at: s.at, side: s.side }; }
    assert.equal(b.ts, s.at + delay);
    // This is construction of the execution event, NOT an entry filter: the
    // future fill is never used in signal selection or pre-entry decisions.
    return { id: s.id, at: s.at, side: s.side,
      target: b.open * (1 + s.side * tpPct / 100), stop: b.open * (1 - s.side * slPct / 100) };
  });
}
export function runPercent(cs: readonly Candle[], signals: readonly Action[], options: Options, tpPct: number, slPct: number) {
  return replay(cs, percentageActions(cs, signals, options.delay, tpPct, slPct), options);
}
export function exitStats(run: ReturnType<typeof replay>) {
  const reason = (name: string) => { const ts = run.trades.filter(t => t.reason === name);
    return { count: ts.length, net: ts.reduce((v, t) => v + t.net, 0) }; };
  const target = reason('target'), stop = reason('stop'), timeout = reason('timeout');
  return { targets: target.count, stops: stop.count, timeouts: timeout.count,
    targetNet: target.net, stopNet: stop.net, timeoutNet: timeout.net,
    targetRate: run.trades.length ? target.count / run.trades.length : null,
    timeoutRate: run.trades.length ? timeout.count / run.trades.length : null };
}
