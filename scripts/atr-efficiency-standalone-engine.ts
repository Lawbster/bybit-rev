/** I09 separate ATR-normalized movement / signed ER. Prior pinned accounting unchanged. */
import type { Candle } from "../src/fetch-candles";
import type { ResearchFeature } from "../src/research/indicator-features";
import type { AtrEfficiencyValues } from "../src/research/atr-efficiency-features";
import type { FeatureBar, StandaloneOptions, StandaloneResult, SimpleTrade, MonthStats } from "./indicator-standalone-engine";
import { HOUR, MINUTE } from "./indicator-standalone-engine";
export interface AtrEfficiencyRule {
  id:string; family:"atr_move"|"efficiency"|"clock"; side:"long"|"short"; exit:"fixed12h"|"indicator_or12h";
  timeframeMs:number; period:number; threshold:number; mode:"trend"|"into"|"recovery";
}
export type AtrEfficiencyResult=Omit<StandaloneResult,"rule">&{rule:AtrEfficiencyRule};
export interface AtrEfficiencyFeature extends ResearchFeature,AtrEfficiencyValues {aePeriod:number;aeFamily:number}
export type AtrEfficiencyFeatureBar=Omit<FeatureBar,"feature">&{feature:AtrEfficiencyFeature};
const finite=(x:unknown):x is number=>typeof x==="number"&&Number.isFinite(x);
function validateRule(r:AtrEfficiencyRule):void {
  const validParams=r.family==="clock"?r.period===14&&r.threshold===0&&r.mode==="trend"&&r.exit==="fixed12h"&&r.timeframeMs===HOUR:
    r.family==="atr_move"?r.period===14&&[.5,1,2].includes(r.threshold):[10,20,40].includes(r.period)&&[.25,.5,.75].includes(r.threshold);
  if(!["atr_move","efficiency","clock"].includes(r.family)||!["long","short"].includes(r.side)||!["fixed12h","indicator_or12h"].includes(r.exit)
    ||!["trend","into","recovery"].includes(r.mode)||![5*MINUTE,15*MINUTE,30*MINUTE,HOUR,4*HOUR].includes(r.timeframeMs)||!validParams)
    throw Error("Outside frozen ATR/efficiency grid");
}
function at(r:AtrEfficiencyRule,b:FeatureBar|undefined):Partial<AtrEfficiencyFeature>|null {
  if(!b||b.barEnd!==b.candle.timestamp+r.timeframeMs||b.availableAt!==b.barEnd||b.feature.timestamp!==b.candle.timestamp)return null;
  const f=b.feature as Partial<AtrEfficiencyFeature>;
  return f.aePeriod===r.period&&f.aeFamily===(r.family==="atr_move"?1:2)?f:null;
}
export function atrEfficiencyEntrySignal(r:AtrEfficiencyRule,prev:FeatureBar|undefined,cur:FeatureBar,_older?:FeatureBar):boolean {
  validateRule(r);if(r.family==="clock")return cur.barEnd%(12*HOUR)===0;
  if(!prev||prev.barEnd!==cur.candle.timestamp)return false;
  const a=at(r,prev)?.aeSigned,b=at(r,cur)?.aeSigned,sign=r.side==="long"?1:-1;
  if(!finite(a)||!finite(b))return false;
  const before=sign*a,now=sign*b,k=r.threshold;
  return r.mode==="trend"?before<=k&&now>k:r.mode==="into"?before>=-k&&now<-k:before<=-k&&now>-k;
}
export function atrEfficiencyExitSignal(r:AtrEfficiencyRule,cur:FeatureBar|undefined):boolean {
  if(r.family==="clock"||r.exit==="fixed12h")return false;
  const v=at(r,cur)?.aeSigned;if(!finite(v))return false;
  const signed=(r.side==="long"?1:-1)*v;return r.mode==="trend"?signed<=0:signed>=0;
}

/** One independent fixed-notional position; entry/timeout at subsequent minute opens. */
export function runAtrEfficiencyStandalone(minutes: readonly Readonly<Candle>[], features: readonly FeatureBar[], rule: AtrEfficiencyRule, o: StandaloneOptions): AtrEfficiencyResult {
  validateRule(rule);
  const interval = rule.timeframeMs;
  if (![o.start, o.end, o.delayMs, o.holdMs].every(Number.isSafeInteger) || o.start < 0 || o.start >= o.end || o.delayMs < 0
      || o.delayMs % MINUTE || o.holdMs <= 0 || o.holdMs % MINUTE || o.notional <= 0 || o.equity <= 0
      || !Number.isFinite(o.notional + o.equity + o.feeRate) || o.feeRate < 0) throw new Error("Invalid standalone options");
  const byEnd = new Map<number, { previous: FeatureBar | undefined; current: FeatureBar; older: FeatureBar | undefined }>();
  features.forEach((current, i) => {
    if (!Number.isSafeInteger(current.candle.timestamp) || current.candle.timestamp % interval
      || current.feature.timestamp !== current.candle.timestamp
      || current.barEnd !== current.candle.timestamp + interval || current.availableAt !== current.barEnd
      || (i && features[i - 1].barEnd !== current.candle.timestamp)) throw new Error("Study requires contiguous finalized selected-timeframe features, explicit zero publication lag");
    if (rule.family !== "clock" && !at(rule, current)) throw new Error("AtrEfficiency parameter provenance mismatch");
    byEnd.set(current.barEnd, { previous: features[i - 1], current, older: features[i - 2] });
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
      const neutral = t > p.entryAt && atrEfficiencyExitSignal(rule, context?.current);
      if (timedOut || neutral) {
        exit = { decisionAt: t, due: t + o.delayMs, reason: timedOut ? "timeout" : "indicator" };
        if (o.delayMs === 0) closeAt(c);
      }
    }
    const clockTrigger = rule.family === "clock" && (t % (12 * HOUR) === 0 || lastClosedAt === t);
    if (clockTrigger || (rule.family !== "clock" && context && atrEfficiencyEntrySignal(rule, context.previous, context.current, context.older))) {
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
