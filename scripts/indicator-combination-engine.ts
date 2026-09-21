/** C01 research only. A supplied causal crossing plus ONE state gate.
 * Accounting/event ordering intentionally preserves the pinned fixed12h engines.
 * No live imports, API calls, file writes, or parameter searches.
 */
import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import type { ResearchFeature } from "../src/research/indicator-features";
import { MINUTE, type FeatureBar, type StandaloneOptions, type StandaloneResult,
  type SimpleTrade, type MonthStats } from "./indicator-standalone-engine";

export type Side = "long" | "short";
export type Condition = "B1" | "B2" | "B3" | "B4";
export interface Gate {
  condition: Condition; expectedEnd: number; sourceStart: number | null;
  sourceEnd: number | null; availableAt: number | null; dayStart: number | null;
  value: number | null; ready: boolean; pass: boolean; reason: string | null;
}
export interface Opportunity {
  at: number; sourceStart: number; sourceEnd: number; availableAt: number;
  previousStart: number; feature: ResearchFeature;
}
export interface Decision extends Opportunity {
  gate: Gate | null; outcome: "accepted" | "occupied" | "missing_context" | "condition_false";
  acceptedEntryAt: number | null;
}
export type CombinationResult = Omit<StandaloneResult, "rule"> & {
  decisions: Decision[]; blockedMissing: number; blockedCondition: number;
};

export function conditionAt(id: Condition, side: Side, t: number, rows: ReadonlyMap<number, FeatureBar>): Gate {
  const tf = id === "B1" ? 14_400_000 : 3_600_000;
  assert(Number.isSafeInteger(t) && t >= 0);
  const expectedEnd = Math.floor(t / tf) * tf, b = rows.get(expectedEnd);
  const out: Gate = { condition: id, expectedEnd, sourceStart: b?.candle.timestamp ?? null,
    sourceEnd: b?.barEnd ?? null, availableAt: b?.availableAt ?? null,
    dayStart: null, value: null, ready: false, pass: false, reason: "missing_bar" };
  if (!b) return out;
  if (b.barEnd !== expectedEnd || b.candle.timestamp !== expectedEnd - tf || b.feature.timestamp !== b.candle.timestamp) {
    out.reason = "invalid_source_clock"; return out;
  }
  if (!Number.isSafeInteger(b.availableAt) || b.availableAt < b.barEnd || b.availableAt > t) {
    out.reason = "bar_not_available"; return out;
  }
  const f = b.feature as ResearchFeature & Partial<Record<"dmSpread"|"aeSigned"|"vvRolling20"|"vvDayDistance"|"vvDayStart", number | null>>;
  const field = id === "B1" ? "dmSpread" : id === "B2" ? "aeSigned" : id === "B3" ? "vvRolling20" : "vvDayDistance";
  const value = f[field];
  if (value == null || !Number.isFinite(value)) { out.reason = "null_feature"; return out; }
  if (id === "B4") {
    const day = Math.floor(b.candle.timestamp / 86_400_000) * 86_400_000;
    if (f.vvDayStart !== day) { out.reason = "invalid_day_anchor"; return out; }
    out.dayStart = day;
  }
  out.value = value; out.ready = true; out.reason = null;
  const signed = (side === "long" ? 1 : -1) * value;
  out.pass = id === "B2" ? signed > -0.5 : id === "B3" ? value >= 1.5 : signed > 0;
  return out;
}

export function runCombination(minutes: readonly Readonly<Candle>[], opportunities: readonly Opportunity[],
  sideName: Side, o: StandaloneOptions, gate?: (at: number) => Gate, readinessOnly = false): CombinationResult {
  assert([o.start, o.end, o.delayMs, o.holdMs].every(Number.isSafeInteger));
  assert(o.start >= 0 && o.end > o.start && o.delayMs >= 0 && o.delayMs % MINUTE === 0 && o.holdMs > 0 && o.holdMs % MINUTE === 0);
  assert([o.notional, o.equity, o.feeRate].every(Number.isFinite) && o.notional > 0 && o.equity > 0 && o.feeRate >= 0);
  const byAt = new Map<number, Opportunity>();
  for (const s of opportunities) {
    assert(Number.isSafeInteger(s.at) && s.at % MINUTE === 0 && !byAt.has(s.at));
    assert(s.sourceEnd === s.at && s.availableAt === s.at && s.sourceStart < s.at && s.feature.timestamp === s.sourceStart);
    byAt.set(s.at, s);
  }
  minutes.forEach((c, i) => {
    assert(Number.isSafeInteger(c.timestamp) && c.timestamp % MINUTE === 0 && (!i || c.timestamp === minutes[i-1].timestamp + MINUTE));
    assert([c.open,c.high,c.low,c.close].every(x=>Number.isFinite(x)&&x>0));
    assert(c.low <= Math.min(c.open,c.close) && c.high >= Math.max(c.open,c.close));
  });
  const selected = minutes.filter(c => c.timestamp >= o.start && c.timestamp + MINUTE <= o.end);
  assert(selected.length && selected[0].timestamp === o.start && selected.at(-1)!.timestamp + MINUTE === o.end);
  const side = sideName === "long" ? 1 : -1;
  type Position = { signalAt:number; entryAt:number; entryPrice:number; qty:number; entryFee:number; feature:ResearchFeature };
  let position:Position|null=null, entry:{decisionAt:number;due:number;feature:ResearchFeature}|null=null;
  let exit:{decisionAt:number;due:number;reason:string}|null=null;
  let cash=o.equity, peak=o.equity, previousMarked=o.equity, maxClose=0, maxAdverse=0;
  let feesPaid=0,turnover=0,rawSignals=0,skippedOccupied=0,exposureMinutes=0,bankrupt=false,blockedMissing=0,blockedCondition=0;
  const trades:SimpleTrade[]=[],months=new Map<string,MonthStats>(),decisions:Decision[]=[];
  const monthAt=(ts:number)=>{
    const month=new Date(ts).toISOString().slice(0,7);
    if(!months.has(month))months.set(month,{month,trades:0,wins:0,losses:0,breakeven:0,winningDollars:0,losingDollars:0,closedNet:0,feesPaid:0,markedNet:0});
    return months.get(month)!;
  };
  function openAt(c:Readonly<Candle>):void {
    assert(entry && !position && c.timestamp===entry.due);
    const fee=o.notional*o.feeRate;
    position={signalAt:entry.decisionAt,entryAt:c.timestamp,entryPrice:c.open,qty:o.notional/c.open,entryFee:fee,feature:entry.feature};
    cash-=fee;feesPaid+=fee;turnover+=o.notional;monthAt(c.timestamp).feesPaid+=fee;entry=null;
  }
  function closeAt(c:Readonly<Candle>):void {
    assert(position && exit && c.timestamp===exit.due);
    const p=position,pricePnl=side*p.qty*(c.open-p.entryPrice),fee=p.qty*c.open*o.feeRate;
    const trade:SimpleTrade={signalAt:p.signalAt,entryAt:p.entryAt,exitDecisionAt:exit.decisionAt,exitAt:c.timestamp,
      side:sideName,entryPrice:p.entryPrice,exitPrice:c.open,qty:p.qty,pricePnl,fees:p.entryFee+fee,
      net:pricePnl-p.entryFee-fee,reason:exit.reason,entryFeature:p.feature};
    cash+=pricePnl-fee;feesPaid+=fee;turnover+=p.qty*c.open;
    trades.push(trade);const m=monthAt(c.timestamp);m.trades++;m.feesPaid+=fee;m.closedNet+=trade.net;
    if(trade.net>1e-8){m.wins++;m.winningDollars+=trade.net;}else if(trade.net < -1e-8){m.losses++;m.losingDollars+=trade.net;}else m.breakeven++;
    position=null;exit=null;
  }
  for(const c of selected){
    const t=c.timestamp;
    if(exit && exit.due<=t)closeAt(c);
    if(entry && entry.due<=t)openAt(c);
    const p=position as Position|null;
    if(p && !exit && t>=p.entryAt+o.holdMs){exit={decisionAt:t,due:t+o.delayMs,reason:"timeout"};if(o.delayMs===0)closeAt(c);}
    const s=byAt.get(t);
    if(s){
      rawSignals++; const g=gate?.(t)??null;
      const decision:Decision={...s,gate:g,outcome:"accepted",acceptedEntryAt:null};
      if(position || entry || exit){skippedOccupied++;decision.outcome="occupied";}
      else if(g && !g.ready){blockedMissing++;decision.outcome="missing_context";}
      else if(g && !readinessOnly && !g.pass){blockedCondition++;decision.outcome="condition_false";}
      else {entry={decisionAt:t,due:t+o.delayMs,feature:s.feature};decision.acceptedEntryAt=entry.due;if(o.delayMs===0)openAt(c);}
      decisions.push(decision);
    }
    const held=position as Position|null;
    const mark=(price:number)=>cash+(held?side*held.qty*(price-held.entryPrice)-held.qty*price*o.feeRate:0);
    if(held)exposureMinutes++;
    const equity=mark(c.close),adverse=mark(side===1?c.low:c.high);
    maxAdverse=Math.max(maxAdverse,(peak-adverse)/peak*100);peak=Math.max(peak,equity);maxClose=Math.max(maxClose,(peak-equity)/peak*100);
    bankrupt ||= adverse<=0;monthAt(t).markedNet+=equity-previousMarked;previousMarked=equity;
  }
  const held=position as Position|null,last=selected.at(-1)!;
  const open=held?{signalAt:held.signalAt,entryAt:held.entryAt,entryPrice:held.entryPrice,qty:held.qty,markedPrice:last.close,
    net:side*held.qty*(last.close-held.entryPrice)-held.entryFee-held.qty*last.close*o.feeRate}:null;
  const closedNet=trades.reduce((a,t)=>a+t.net,0),net=previousMarked-o.equity;
  assert(Math.abs(net-closedNet-(open?.net??0))<1e-6);
  return {trades,monthly:[...months.values()],open,decisions,blockedMissing,blockedCondition,stats:{
    trades:trades.length,wins:trades.filter(t=>t.net>1e-8).length,losses:trades.filter(t=>t.net < -1e-8).length,
    breakeven:trades.filter(t=>Math.abs(t.net)<=1e-8).length,winningDollars:trades.reduce((s,t)=>s+Math.max(0,t.net),0),
    losingDollars:trades.reduce((s,t)=>s+Math.min(0,t.net),0),closedNet,openNet:open?.net??0,net,feesPaid,
    turnoverIncludingMarkedExit:turnover+(held?held.qty*last.close:0),maxCloseDrawdownPct:maxClose,maxAdverseDrawdownPct:maxAdverse,
    exposureHours:exposureMinutes/60,rawSignals,skippedOccupied,pendingAtEnd:!!entry||!!exit,bankrupt}};
}
