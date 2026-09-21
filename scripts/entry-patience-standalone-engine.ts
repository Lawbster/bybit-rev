/** BH02 research only. Forward minute-open entry decisions, no live imports. */
import assert from "assert/strict";
import type {Candle}from "./hype-freerun-canonical-replay";
import type {MonthStats}from "./indicator-standalone-engine";
export const M=60000,H=60*M;
export interface EntrySignal {at:number;cap:number}
export interface Options {start:number;end:number;delayMs:number;holdMs:number;notional:number;equity:number;feeRate:number;
  expiryMinutes:number|null;penetrationBps:number; executionBps?:number}
export interface Intent {signalAt:number;activeAt:number;expiresAt:number|null;cap:number;
  phase:"waiting"|"filled"|"expired"|"cutoff";entryAt:number|null;entryPrice:number|null;observedOpen:number|null;
  ignoredLowTouches:number}
export interface Position {signalAt:number;entryAt:number;entryPrice:number;qty:number;entryFee:number}
export function runCappedEntry(minutes:readonly Candle[],signals:readonly EntrySignal[],o:Options){
  assert(o.start<o.end&&[o.start,o.end,o.delayMs,o.holdMs].every(Number.isSafeInteger));
  assert(o.delayMs>=0&&o.delayMs%M===0&&o.holdMs>0&&o.holdMs%M===0);
  assert(o.expiryMinutes===null||(Number.isSafeInteger(o.expiryMinutes)&&o.expiryMinutes>0));
  assert(o.penetrationBps>=0&&o.penetrationBps<10000&&o.notional>0&&o.equity>0&&o.feeRate>=0);
  assert.equal(minutes[0].ts,o.start);assert.equal(minutes.at(-1)!.endTs,o.end);
  minutes.forEach((c,i)=>{assert(!i||c.ts===minutes[i-1].endTs);assert.equal(c.endTs,c.ts+M);
    assert([c.open,c.high,c.low,c.close].every(v=>Number.isFinite(v)&&v>0)&&c.low<=Math.min(c.open,c.close)&&c.high>=Math.max(c.open,c.close));});
  const cost=(o.executionBps??0)/10000; assert(cost>=0&&cost<0.1);
  const byAt=new Map<number,EntrySignal>();
  for(const s of signals){assert(s.at>=o.start&&s.at<o.end&&s.at%M===0&&s.cap>0&&Number.isFinite(s.cap)&&!byAt.has(s.at));byAt.set(s.at,s);}
  let position:Position|null=null,pending:Intent|null=null,exit:{decisionAt:number;due:number}|null=null;
  let cash=o.equity,peak=o.equity,previousMarked=o.equity,maxClose=0,maxAdverse=0;
  let feesPaid=0,turnover=0,exposureMinutes=0,bankrupt=false;
  const trades:any[]=[],intents:Intent[]=[],occupiedSignals:number[]=[],months=new Map<string,MonthStats>();
  const monthAt=(t:number)=>{const month=new Date(t).toISOString().slice(0,7);
    if(!months.has(month))months.set(month,{month,trades:0,wins:0,losses:0,breakeven:0,winningDollars:0,losingDollars:0,closedNet:0,feesPaid:0,markedNet:0});
    return months.get(month)!;};
  function closeAt(c:Candle){assert(position&&exit&&exit.due===c.ts);
    const p=position,exitPrice=c.open*(1-cost),pricePnl=p.qty*(exitPrice-p.entryPrice),fee=p.qty*exitPrice*o.feeRate;
    const t={signalAt:p.signalAt,entryAt:p.entryAt,exitDecisionAt:exit.decisionAt,exitAt:c.ts,side:"long",
      entryPrice:p.entryPrice,exitPrice,qty:p.qty,pricePnl,fees:p.entryFee+fee,net:pricePnl-p.entryFee-fee,reason:"timeout"};
    cash+=pricePnl-fee;feesPaid+=fee;turnover+=p.qty*exitPrice;trades.push(t);
    const m=monthAt(c.ts);m.trades++;m.feesPaid+=fee;m.closedNet+=t.net;
    if(t.net>1e-8){m.wins++;m.winningDollars+=t.net;}else if(t.net< -1e-8){m.losses++;m.losingDollars+=t.net;}else m.breakeven++;
    position=null;exit=null;
  }
  for(const c of minutes){const t=c.ts;
    if(exit&&exit.due<=t)closeAt(c);
    const p=position as Position|null;
    if(p&&!exit&&t>=p.entryAt+o.holdMs){exit={decisionAt:t,due:t+o.delayMs};if(!o.delayMs)closeAt(c);}
    if(pending&&pending.expiresAt!==null&&t>=pending.expiresAt){pending.phase="expired";pending=null;}
    const signal=byAt.get(t);
    if(signal){if(position||pending||exit)occupiedSignals.push(t);
      else{pending={signalAt:t,activeAt:t+o.delayMs,expiresAt:o.expiryMinutes===null?null:t+o.expiryMinutes*M,cap:signal.cap,
        phase:"waiting",entryAt:null,entryPrice:null,observedOpen:null,ignoredLowTouches:0};intents.push(pending);}}
    if(pending&&t>=pending.activeAt){
      const level=pending.cap*(1-o.penetrationBps/10000);
      if(o.expiryMinutes===null||(c.open<=level&&(o.executionBps===undefined||c.open*(1+cost)<=pending.cap))){
        const price=o.executionBps===undefined?(o.expiryMinutes===null?c.open:pending.cap):c.open*(1+cost),fee=o.notional*o.feeRate;
        position={signalAt:pending.signalAt,entryAt:t,entryPrice:price,qty:o.notional/price,entryFee:fee};
        pending.phase="filled";pending.entryAt=t;pending.entryPrice=price;pending.observedOpen=c.open;pending=null;
        cash-=fee;feesPaid+=fee;turnover+=o.notional;monthAt(t).feesPaid+=fee;
      }else if(c.low<=level)pending.ignoredLowTouches++; // Diagnostics only; never used for decisions.
    }
    const held=position as Position|null;
    const mark=(price:number)=>cash+(held?held.qty*(price-held.entryPrice)-held.qty*price*o.feeRate:0);
    if(held)exposureMinutes++;
    const equity=mark(c.close),adverse=mark(c.low);
    maxAdverse=Math.max(maxAdverse,(peak-adverse)/peak*100);peak=Math.max(peak,equity);maxClose=Math.max(maxClose,(peak-equity)/peak*100);
    bankrupt ||=adverse<=0;monthAt(t).markedNet+=equity-previousMarked;previousMarked=equity;
  }
  if(pending)pending.phase="cutoff";
  const held=position as Position|null,last=minutes.at(-1)!;
  const open=held?{signalAt:held.signalAt,entryAt:held.entryAt,entryPrice:held.entryPrice,qty:held.qty,markedPrice:last.close,
    net:held.qty*(last.close-held.entryPrice)-held.entryFee-held.qty*last.close*o.feeRate}:null;
  const closedNet=trades.reduce((s,t)=>s+t.net,0),net=previousMarked-o.equity;
  assert(Math.abs(net-closedNet-(open?.net??0))<1e-6);
  const stats={trades:trades.length,wins:trades.filter(t=>t.net>1e-8).length,losses:trades.filter(t=>t.net< -1e-8).length,
    breakeven:trades.filter(t=>Math.abs(t.net)<=1e-8).length,winningDollars:trades.reduce((s,t)=>s+Math.max(0,t.net),0),
    losingDollars:trades.reduce((s,t)=>s+Math.min(0,t.net),0),closedNet,openNet:open?.net??0,net,feesPaid,
    turnoverIncludingMarkedExit:turnover+(held?held.qty*last.close:0),maxCloseDrawdownPct:maxClose,maxAdverseDrawdownPct:maxAdverse,
    exposureHours:exposureMinutes/60,rawSignals:signals.length,skippedOccupied:occupiedSignals.length,pendingAtEnd:!!pending||!!exit,bankrupt};
  return {trades,monthly:[...months.values()],open,stats,intents,occupiedSignals,
    entryStats:{submitted:intents.length,filled:intents.filter(i=>i.phase==="filled").length,expired:intents.filter(i=>i.phase==="expired").length,
      pendingAtCutoff:intents.filter(i=>i.phase==="cutoff").length,ignoredLowTouches:intents.reduce((s,i)=>s+i.ignoredLowTouches,0),
      delayedFills:intents.filter(i=>i.entryAt!==null&&i.entryAt>i.activeAt).length,
      totalWaitMinutes:intents.reduce((s,i)=>s+(i.entryAt===null?0:(i.entryAt-i.signalAt)/M),0)}};
}
