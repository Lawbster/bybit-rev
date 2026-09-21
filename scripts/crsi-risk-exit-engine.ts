/** I03 standalone CRSI risk/exit sensitivity. No orders or live imports.
 * Additive copy of pinned I02 minute accounting with only the frozen exits.
 */
import type { Candle } from "../src/fetch-candles";
import type { ResearchFeature } from "../src/research/indicator-features";
import type { FeatureBar, StandaloneOptions, SimpleTrade, MonthStats } from "./indicator-standalone-engine";
import { HOUR, MINUTE } from "./indicator-standalone-engine";
import { crsiEntrySignal, type CrsiRule, type CrsiResult } from "./crsi-extremes-engine";
export const EXIT_POLICIES = ["baseline12h", "stop3", "stop5", "stop8", "timeout6h", "crsi50", "crsi80"] as const;
export interface RiskExitRule {
  id: string; entryMode: "into" | "back_out"; exitPolicy: typeof EXIT_POLICIES[number];
}
export type RiskExitResult = Omit<CrsiResult, "rule"> & { rule: RiskExitRule };
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function runCrsiRiskExit(minutes: readonly Readonly<Candle>[], features: readonly FeatureBar[], rule: RiskExitRule, o: StandaloneOptions): RiskExitResult {
  if (!["into", "back_out"].includes(rule.entryMode) || !EXIT_POLICIES.includes(rule.exitPolicy)
    || o.holdMs !== 12 * HOUR) throw new Error("Outside frozen CRSI risk/exit study");
  const interval = 15 * MINUTE;
  const entryRule: CrsiRule = { id: rule.id, family: "crsi_extreme", side: "long",
    exit: "fixed12h", timeframeMs: interval, upper: 95, mode: rule.entryMode };
  const holdMs = rule.exitPolicy === "timeout6h" ? 6 * HOUR : o.holdMs;
  const stopPct = rule.exitPolicy.startsWith("stop") ? Number(rule.exitPolicy.slice(4)) : null;
  const exitCrsi = rule.exitPolicy.startsWith("crsi") ? Number(rule.exitPolicy.slice(4)) : null;
  if (![o.start, o.end, o.delayMs, o.holdMs].every(Number.isSafeInteger) || o.start < 0 || o.start >= o.end || o.delayMs < 0
      || o.delayMs % MINUTE || o.holdMs <= 0 || o.holdMs % MINUTE || o.notional <= 0 || o.equity <= 0
      || !Number.isFinite(o.notional + o.equity + o.feeRate) || o.feeRate < 0) throw new Error("Invalid standalone options");
  const byEnd = new Map<number, { previous: FeatureBar | undefined; current: FeatureBar }>();
  features.forEach((current, i) => {
    if (!Number.isSafeInteger(current.candle.timestamp) || current.candle.timestamp % interval
      || current.feature.timestamp !== current.candle.timestamp
      || current.barEnd !== current.candle.timestamp + interval || current.availableAt !== current.barEnd
      || (i && features[i - 1].barEnd !== current.candle.timestamp)) throw new Error("Study requires contiguous finalized selected-timeframe features, explicit zero publication lag");
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
  const side = 1; // This follow-up freezes only the two oversold-long entries.
  type Position = { signalAt: number; entryAt: number; entryPrice: number; qty: number; entryFee: number; feature: ResearchFeature | null };
  let position: Position | null = null, entry: { decisionAt: number; due: number; feature: ResearchFeature | null } | null = null;
  let exit: { decisionAt: number; due: number; reason: string } | null = null;
  let cash = o.equity, peak = o.equity, previousMarked = o.equity, maxClose = 0, maxAdverse = 0;
  let feesPaid = 0, turnover = 0, rawSignals = 0, skippedOccupied = 0, exposureMinutes = 0, bankrupt = false;
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
      side: "long", entryPrice: p.entryPrice, exitPrice: c.open, qty: p.qty, pricePnl, fees: p.entryFee + fee,
      net: pricePnl - p.entryFee - fee, reason: exit.reason, entryFeature: p.feature };
    cash += pricePnl - fee; feesPaid += fee; turnover += p.qty * c.open;
    trades.push(trade); const m = monthAt(c.timestamp); m.trades++; m.feesPaid += fee; m.closedNet += trade.net;
    if (trade.net > 1e-8) { m.wins++; m.winningDollars += trade.net; }
    else if (trade.net < -1e-8) { m.losses++; m.losingDollars += trade.net; } else m.breakeven++;
    position = null; exit = null;
  }
  for (let i = 0; i < selected.length; i++) {
    const c = selected[i], previous = selected[i - 1], t = c.timestamp;
    if (exit && exit.due <= t) closeAt(c);
    if (entry && entry.due <= t) openAt(c);
    const context = byEnd.get(t);
    const p = position as Position | null;
    if (p && !exit) {
      // A previous-minute wick is known only NOW, not at its bar start.
      // This is a completed-minute observed loss trigger, NOT an assumed
      // perfect fill at a resting stop. Actual fill may be much worse/better.
      const stopped = stopPct !== null && previous && p.entryAt <= previous.timestamp
        && previous.low <= p.entryPrice * (1 - stopPct / 100);
      const timedOut = t >= p.entryAt + holdMs;
      const crsi = context?.current.feature.crsi;
      const normalized = exitCrsi !== null && t > p.entryAt && finite(crsi) && crsi >= exitCrsi;
      if (stopped || timedOut || normalized) {
        exit = { decisionAt: t, due: t + o.delayMs,
          reason: stopped ? "observed_stop" : timedOut ? "timeout" : "crsi_exit" };
        if (o.delayMs === 0) closeAt(c);
      }
    }
    if (context && crsiEntrySignal(entryRule, context.previous, context.current)) {
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
