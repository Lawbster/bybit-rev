import type { Candle } from "../src/fetch-candles";
import type { ResearchFeature } from "../src/research/indicator-features";

export const HOUR = 3_600_000, MINUTE = 60_000;
export type Family = "rsi_recovery" | "crsi_recovery" | "roc_cross" | "vwap_cross" | "clock";
export interface StandaloneRule { id: string; family: Family; side: "long" | "short"; exit: "fixed12h" | "indicator_or12h" }
export interface FeatureBar { candle: Readonly<Candle>; feature: ResearchFeature; barEnd: number; availableAt: number }
export interface StandaloneOptions { start: number; end: number; delayMs: number; notional: number; equity: number; feeRate: number; holdMs: number }
export interface SimpleTrade {
  signalAt: number; entryAt: number; exitDecisionAt: number; exitAt: number; side: string;
  entryPrice: number; exitPrice: number; qty: number; pricePnl: number; fees: number; net: number;
  reason: string; entryFeature: ResearchFeature | null;
}
export interface MonthStats { month: string; trades: number; wins: number; losses: number; breakeven: number;
  winningDollars: number; losingDollars: number; closedNet: number; feesPaid: number; markedNet: number }
export interface StandaloneResult {
  rule: StandaloneRule; trades: SimpleTrade[]; monthly: MonthStats[];
  stats: { trades: number; wins: number; losses: number; breakeven: number; winningDollars: number; losingDollars: number;
    closedNet: number; openNet: number; net: number; feesPaid: number; turnoverIncludingMarkedExit: number;
    maxCloseDrawdownPct: number; maxAdverseDrawdownPct: number; exposureHours: number; rawSignals: number;
    skippedOccupied: number; pendingAtEnd: boolean; bankrupt: boolean };
  open: { signalAt: number; entryAt: number; entryPrice: number; qty: number; markedPrice: number; net: number } | null;
}
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
export function entrySignal(rule: StandaloneRule, previous: FeatureBar | undefined, current: FeatureBar): boolean {
  if (rule.family === "clock") return current.barEnd % (12 * HOUR) === 0;
  if (!previous || previous.barEnd !== current.candle.timestamp) return false;
  let a: number | null, b: number | null, threshold = 0;
  switch (rule.family) {
    case "rsi_recovery": a = previous.feature.rsi14; b = current.feature.rsi14; threshold = rule.side === "long" ? 30 : 70; break;
    case "crsi_recovery": a = previous.feature.crsi; b = current.feature.crsi; threshold = rule.side === "long" ? 20 : 80; break;
    case "roc_cross": a = previous.feature.roc5; b = current.feature.roc5; break;
    case "vwap_cross":
      if (Math.floor(previous.candle.timestamp / 86_400_000) !== Math.floor(current.candle.timestamp / 86_400_000)) return false;
      a = previous.feature.vwapUtcDay === null ? null : previous.candle.close - previous.feature.vwapUtcDay;
      b = current.feature.vwapUtcDay === null ? null : current.candle.close - current.feature.vwapUtcDay;
  }
  if (!finite(a) || !finite(b)) return false;
  return rule.side === "long" ? a <= threshold && b > threshold : a >= threshold && b < threshold;
}
export function exitSignal(rule: StandaloneRule, current: FeatureBar): boolean {
  if (rule.exit === "fixed12h" || rule.family === "clock") return false;
  const f = current.feature;
  const value = rule.family === "rsi_recovery" ? f.rsi14 : rule.family === "crsi_recovery" ? f.crsi
    : rule.family === "roc_cross" ? f.roc5 : f.vwapUtcDay === null ? null : current.candle.close - f.vwapUtcDay;
  if (!finite(value)) return false;
  if (rule.family === "rsi_recovery" || rule.family === "crsi_recovery") return rule.side === "long" ? value >= 50 : value <= 50;
  return rule.side === "long" ? value <= 0 : value >= 0;
}

/** Standalone minute execution, not the long ladder. Signals see only completed
 * hourly features; open fills never consult this execution minute's H/L/C.
 */
export function runStandalone(minutes: readonly Readonly<Candle>[], features: readonly FeatureBar[], rule: StandaloneRule, o: StandaloneOptions): StandaloneResult {
  if (![o.start, o.end, o.delayMs, o.holdMs].every(Number.isSafeInteger) || o.start >= o.end || o.delayMs < 0
      || o.delayMs % MINUTE || o.holdMs <= 0 || o.holdMs % MINUTE || o.notional <= 0 || o.equity <= 0
      || !Number.isFinite(o.notional + o.equity + o.feeRate) || o.feeRate < 0) throw new Error("Invalid standalone options");
  const byEnd = new Map<number, { previous: FeatureBar | undefined; current: FeatureBar }>();
  features.forEach((current, i) => {
    if (!Number.isSafeInteger(current.candle.timestamp) || current.candle.timestamp % HOUR
      || current.feature.timestamp !== current.candle.timestamp
      || current.barEnd !== current.candle.timestamp + HOUR || current.availableAt !== current.barEnd
      || (i && features[i - 1].barEnd !== current.candle.timestamp)) throw new Error("Study requires contiguous finalized hourly features, explicit zero publication lag");
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
      if (timedOut || (t > p.entryAt && context && exitSignal(rule, context.current))) {
        exit = { decisionAt: t, due: t + o.delayMs, reason: timedOut ? "timeout" : "indicator" };
        if (o.delayMs === 0) closeAt(c);
      }
    }
    const clockTrigger = rule.family === "clock" && (t % (12 * HOUR) === 0 || lastClosedAt === t);
    if (clockTrigger || (rule.family !== "clock" && context && entrySignal(rule, context.previous, context.current))) {
      rawSignals++;
      if (position || entry || exit) skippedOccupied++;
      else { entry = { decisionAt: t, due: t + o.delayMs,
        feature: (context ?? byEnd.get(Math.floor(t / HOUR) * HOUR))?.current.feature ?? null }; if (o.delayMs === 0) openAt(c); }
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
