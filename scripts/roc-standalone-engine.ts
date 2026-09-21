/** I05 bounded standalone ROC expansion; old pinned I01 engine remains byte-for-byte intact.
 * Minute accounting follows I01, with explicit timeframe, crossing and neutral-exit definitions. No live mutation.
 * Historical closed bars model zero publication lag; this is not a live executor.
 */
import type { Candle } from "../src/fetch-candles";
import type { ResearchFeature } from "../src/research/indicator-features";
import type { FeatureBar, StandaloneOptions, StandaloneResult, SimpleTrade, MonthStats } from "./indicator-standalone-engine";
import { HOUR, MINUTE } from "./indicator-standalone-engine";

export interface RocRule {
  id: string; family: "roc" | "clock"; side: "long" | "short"; exit: "fixed12h" | "indicator_or12h";
  timeframeMs: number; lookbackBars: number; magnitudePct: number; mode: "momentum" | "into" | "back_out";
}
export type RocResult = Omit<StandaloneResult, "rule"> & { rule: RocRule };
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
export interface RocFeature extends ResearchFeature { roc: number | null; rocLookbackBars: number }
export type RocFeatureBar = Omit<FeatureBar, "feature"> & { feature: RocFeature };
/** Pure close-only math. Finite contiguous positive prices, never reseeded over a gap. */
export function computeRocValues(candles: readonly Pick<Candle, "timestamp" | "close">[], interval: number, period: number): Array<number | null> {
  if (![5 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 4 * HOUR].includes(interval)
    || ![1, 5, 12].includes(period)) throw new Error("Outside frozen ROC feature grid");
  return candles.map((c, i) => {
    if (!Number.isSafeInteger(c.timestamp) || c.timestamp < 0 || c.timestamp % interval
      || (i && c.timestamp !== candles[i - 1].timestamp + interval) || !finite(c.close) || c.close <= 0)
      throw new Error("Invalid or gapped ROC close tape");
    const value = i >= period ? 100 * (c.close / candles[i - period].close - 1) : null;
    if (value !== null && (!finite(value) || value <= -100)) throw new Error("Unrepresentable ROC");
    return value;
  });
}
function validateRule(rule: RocRule): void {
  if (!["roc", "clock"].includes(rule.family) || !["long", "short"].includes(rule.side)
    || !["momentum", "into", "back_out"].includes(rule.mode) || !["fixed12h", "indicator_or12h"].includes(rule.exit)
    || ![5 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 4 * HOUR].includes(rule.timeframeMs)
    || ![1, 5, 12].includes(rule.lookbackBars) || ![0, 1, 2, 4].includes(rule.magnitudePct)
    || (rule.magnitudePct === 0 && rule.mode !== "momentum")
    || (rule.family === "clock" && (rule.timeframeMs !== HOUR || rule.lookbackBars !== 5
      || rule.magnitudePct !== 0 || rule.mode !== "momentum" || rule.exit !== "fixed12h")))
    throw new Error("Outside frozen ROC grid");
}
function rocAt(rule: RocRule, bar: FeatureBar | undefined): number | null {
  if (!bar) return null;
  const f = bar.feature as Partial<RocFeature>;
  return f.rocLookbackBars === rule.lookbackBars && finite(f.roc) && f.roc > -100 ? f.roc : null;
}
export function rocEntrySignal(rule: RocRule, previous: FeatureBar | undefined, current: FeatureBar): boolean {
  validateRule(rule);
  if (rule.family === "clock") return current.barEnd % (12 * HOUR) === 0;
  if (!previous || previous.barEnd !== current.candle.timestamp
    || previous.barEnd !== previous.candle.timestamp + rule.timeframeMs
    || current.barEnd !== current.candle.timestamp + rule.timeframeMs
    || previous.availableAt !== previous.barEnd || current.availableAt !== current.barEnd) return false;
  const a = rocAt(rule, previous), b = rocAt(rule, current), m = rule.magnitudePct;
  if (a === null || b === null) return false;
  if (rule.mode === "momentum") return rule.side === "long" ? a <= m && b > m : a >= -m && b < -m;
  const level = rule.side === "long" ? -m : m;
  if (rule.mode === "into") return rule.side === "long" ? a > level && b <= level : a < level && b >= level;
  return rule.side === "long" ? a <= level && b > level : a >= level && b < level;
}
export function rocExitSignal(rule: RocRule, current: FeatureBar | undefined): boolean {
  if (rule.exit === "fixed12h" || rule.family === "clock") return false;
  const value = rocAt(rule, current); if (value === null) return false;
  if (rule.mode === "momentum") return rule.side === "long" ? value <= 0 : value >= 0;
  return rule.side === "long" ? value >= 0 : value <= 0;
}

/** One independent fixed-notional position; entry/timeout at subsequent minute opens. */
export function runRocStandalone(minutes: readonly Readonly<Candle>[], features: readonly FeatureBar[], rule: RocRule, o: StandaloneOptions): RocResult {
  validateRule(rule);
  const interval = rule.timeframeMs;
  if (![o.start, o.end, o.delayMs, o.holdMs].every(Number.isSafeInteger) || o.start < 0 || o.start >= o.end || o.delayMs < 0
      || o.delayMs % MINUTE || o.holdMs <= 0 || o.holdMs % MINUTE || o.notional <= 0 || o.equity <= 0
      || !Number.isFinite(o.notional + o.equity + o.feeRate) || o.feeRate < 0) throw new Error("Invalid standalone options");
  const byEnd = new Map<number, { previous: FeatureBar | undefined; current: FeatureBar }>();
  features.forEach((current, i) => {
    if (!Number.isSafeInteger(current.candle.timestamp) || current.candle.timestamp % interval
      || current.feature.timestamp !== current.candle.timestamp
      || current.barEnd !== current.candle.timestamp + interval || current.availableAt !== current.barEnd
      || (i && features[i - 1].barEnd !== current.candle.timestamp)) throw new Error("Study requires contiguous finalized selected-timeframe features, explicit zero publication lag");
    if (rule.family !== "clock" && (current.feature as Partial<RocFeature>).rocLookbackBars !== rule.lookbackBars) throw new Error("ROC lookback provenance mismatch");
    byEnd.set(current.barEnd, { previous: features[i - 1], current });
  });
  for (let i = 0; i < minutes.length; i++) {
    const c = minutes[i];
    if (!Number.isSafeInteger(c.timestamp) || c.timestamp % MINUTE || (i && c.timestamp !== minutes[i - 1].timestamp + MINUTE)
      || ![c.open, c.high, c.low, c.close].every(x => finite(x) && x > 0)
      || c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close)) throw new Error("Invalid/gapped minute tape");
  }
  const selected = minutes.filter(c => c.timestamp >= o.start && c.timestamp + MINUTE <= o.end);
  if (!selected.length || selected[0].timestamp !== o.start || selected.at(-1)!.timestamp + MINUTE !== o.end) throw new Error("Incomplete study window");
  const side = rule.side === "long" ? 1 : -1;
  type Position = { signalAt: number; entryAt: number; entryPrice: number; qty: number; entryFee: number; feature: ResearchFeature | null };
  let position: Position | null = null, entry: { decisionAt: number; due: number; feature: ResearchFeature | null } | null = null;
  let exit: { decisionAt: number; due: number; reason: string } | null = null;
  let cash = o.equity, peak = o.equity, previousMarked = o.equity, maxClose = 0, maxAdverse = 0;
  let feesPaid = 0, turnover = 0, rawSignals = 0, skippedOccupied = 0, exposureMinutes = 0, bankrupt = false;
  let lastClosedAt = -Infinity;
  const trades: SimpleTrade[] = [], months = new Map<string, MonthStats>();
  const monthAt = (ts: number) => {
    const month = new Date(ts).toISOString().slice(0, 7);
    if (!months.has(month)) months.set(month, { month, trades: 0, wins: 0, losses: 0, breakeven: 0,
      winningDollars: 0, losingDollars: 0, closedNet: 0, feesPaid: 0, markedNet: 0 });
    return months.get(month)!;
  };
  function openAt(c: Readonly<Candle>): void {
    if (!entry || position || c.timestamp !== entry.due) throw new Error("Invalid entry execution");
    const fee = o.notional * o.feeRate;
    position = { signalAt: entry.decisionAt, entryAt: c.timestamp, entryPrice: c.open,
      qty: o.notional / c.open, entryFee: fee, feature: entry.feature };
    cash -= fee; feesPaid += fee; turnover += o.notional; monthAt(c.timestamp).feesPaid += fee; entry = null;
  }
  function closeAt(c: Readonly<Candle>): void {
    if (!position || !exit || c.timestamp !== exit.due) throw new Error("Invalid exit execution");
    const p = position, pricePnl = side * p.qty * (c.open - p.entryPrice), fee = p.qty * c.open * o.feeRate;
    const trade: SimpleTrade = { signalAt: p.signalAt, entryAt: p.entryAt, exitDecisionAt: exit.decisionAt, exitAt: c.timestamp,
      side: rule.side, entryPrice: p.entryPrice, exitPrice: c.open, qty: p.qty, pricePnl, fees: p.entryFee + fee,
      net: pricePnl - p.entryFee - fee, reason: exit.reason, entryFeature: p.feature };
    cash += pricePnl - fee; feesPaid += fee; turnover += p.qty * c.open;
    trades.push(trade); const m = monthAt(c.timestamp); m.trades++; m.feesPaid += fee; m.closedNet += trade.net;
    if (trade.net > 1e-8) { m.wins++; m.winningDollars += trade.net; }
    else if (trade.net < -1e-8) { m.losses++; m.losingDollars += trade.net; } else m.breakeven++;
    position = null; exit = null; lastClosedAt = c.timestamp;
  }
  for (const c of selected) {
    const t = c.timestamp;
    if (exit && exit.due <= t) closeAt(c);
    if (entry && entry.due <= t) openAt(c);
    const context = byEnd.get(t);
    const p = position as Position | null;
    if (p && !exit) {
      const timedOut = t >= p.entryAt + o.holdMs;
      const neutral = t > p.entryAt && rocExitSignal(rule, context?.current);
      if (timedOut || neutral) {
        exit = { decisionAt: t, due: t + o.delayMs, reason: timedOut ? "timeout" : "indicator" };
        if (o.delayMs === 0) closeAt(c);
      }
    }
    const clockTrigger = rule.family === "clock" && (t % (12 * HOUR) === 0 || lastClosedAt === t);
    if (clockTrigger || (rule.family !== "clock" && context && rocEntrySignal(rule, context.previous, context.current))) {
      rawSignals++;
      if (position || entry || exit) skippedOccupied++;
      else { entry = { decisionAt: t, due: t + o.delayMs,
        feature: (context ?? byEnd.get(Math.floor(t / interval) * interval))?.current.feature ?? null }; if (o.delayMs === 0) openAt(c); }
    }
    const held = position as Position | null;
    const mark = (price: number) => cash + (held ? side * held.qty * (price - held.entryPrice) - held.qty * price * o.feeRate : 0);
    if (held) exposureMinutes++;
    const equity = mark(c.close), adverse = mark(side === 1 ? c.low : c.high);
    maxAdverse = Math.max(maxAdverse, (peak - adverse) / peak * 100);
    peak = Math.max(peak, equity); maxClose = Math.max(maxClose, (peak - equity) / peak * 100);
    bankrupt ||= adverse <= 0;
    monthAt(t).markedNet += equity - previousMarked; previousMarked = equity;
  }
  const held = position as Position | null, last = selected.at(-1)!;
  const open = held ? { signalAt: held.signalAt, entryAt: held.entryAt, entryPrice: held.entryPrice,
    qty: held.qty, markedPrice: last.close,
    net: side * held.qty * (last.close - held.entryPrice) - held.entryFee - held.qty * last.close * o.feeRate } : null;
  const closedNet = trades.reduce((a, t) => a + t.net, 0), net = previousMarked - o.equity;
  if (Math.abs(net - closedNet - (open?.net ?? 0)) > 1e-6) throw new Error("Standalone accounting mismatch");
  return { rule, trades, monthly: [...months.values()], open, stats: {
    trades: trades.length, wins: trades.filter(t => t.net > 1e-8).length, losses: trades.filter(t => t.net < -1e-8).length,
    breakeven: trades.filter(t => Math.abs(t.net) <= 1e-8).length,
    winningDollars: trades.reduce((s, t) => s + Math.max(0, t.net), 0), losingDollars: trades.reduce((s, t) => s + Math.min(0, t.net), 0),
    closedNet, openNet: open?.net ?? 0, net, feesPaid, turnoverIncludingMarkedExit: turnover + (held ? held.qty * last.close : 0),
    maxCloseDrawdownPct: maxClose, maxAdverseDrawdownPct: maxAdverse, exposureHours: exposureMinutes / 60,
    rawSignals, skippedOccupied, pendingAtEnd: !!entry || !!exit, bankrupt } };
}
