/** Independent BH02 intent-first scheduler and trade-ledger-to-equity audit. */
import fs from "fs";
import assert from "assert/strict";
import {loadMinutes}from "./relative-reversion-study";
import {read}from "./btc-hype-threshold-study";
import {near,checkLedger}from "./btc-hype-threshold-verify";
import {verifyPins,atomicJson,fileHash}from "./research-workflow";
type R=Record<string,any>;
const M=60000,H=60*M;
export function verifyCase(r:R,cs:R[],signals:R[],d:R){
  const o=r.options,start=o.start,end=o.end,at=(ts:number)=>{const c=cs[(ts-start)/M];assert(c&&c.ts===ts);return c;};
  const cost=(o.executionBps??0)/10000;
  let free=start;const expected:R[]=[],occupied:number[]=[];
  for(const s of signals){if(s.at<free){occupied.push(s.at);continue;}
    const active=s.at+o.delayMs,deadline=o.expiryMinutes===null?null:s.at+o.expiryMinutes*M;
    const terminal=deadline===null?end:Math.min(deadline,end),level=s.cap*(1-o.penetrationBps/10000);
    let entry:number|null=null,ignoredLowTouches=0;
    for(let t=active;t<terminal;t+=M){const c=at(t);
      if(o.expiryMinutes===null||(c.open<=level&&(o.executionBps===undefined||c.open*(1+cost)<=s.cap))){entry=t;break;}
      if(c.low<=level)ignoredLowTouches++;
    }
    const phase=entry!==null?"filled":deadline!==null&&deadline<end?"expired":"cutoff";
    const price=entry===null?null:o.executionBps===undefined?(o.expiryMinutes===null?at(entry).open:s.cap):at(entry).open*(1+cost);
    expected.push({signalAt:s.at,activeAt:active,expiresAt:deadline,cap:s.cap,phase,entryAt:entry,entryPrice:price,
      observedOpen:entry===null?null:at(entry).open,ignoredLowTouches});
    free=entry===null?(deadline??end):entry+o.holdMs+o.delayMs;
  }
  assert.deepEqual(r.intents,expected,"first eligible fill / expiry / no chasing / fixed cap");
  assert.deepEqual(r.occupiedSignals,occupied,"pending and held occupancy");
  const filled=expected.filter(x=>x.entryAt!==null),closed=filled.filter(x=>x.entryAt+o.holdMs+o.delayMs<end),held=filled.find(x=>x.entryAt+o.holdMs+o.delayMs>=end);
  assert.equal(r.trades.length,closed.length);assert.equal(!!r.open,!!held);
  let turnover=0,fees=0,exposure=0;
  for(let i=0;i<closed.length;i++){const e=closed[i],t=r.trades[i];assert.equal(t.signalAt,e.signalAt);assert.equal(t.entryAt,e.entryAt);
    assert.equal(t.exitDecisionAt,e.entryAt+o.holdMs);assert.equal(t.exitAt,t.exitDecisionAt+o.delayMs);
    assert.equal(t.entryPrice,e.entryPrice);assert.equal(t.exitPrice,at(t.exitAt).open*(1-cost));assert.equal(t.side,"long");assert.equal(t.reason,"timeout");
    const qty=o.notional/t.entryPrice,gross=qty*(t.exitPrice-t.entryPrice),fee=qty*(t.entryPrice+t.exitPrice)*o.feeRate;
    near(t.qty,qty,"qty");near(t.pricePnl,gross,"gross");near(t.fees,fee,"fee");near(t.net,gross-fee,"net");
    turnover+=qty*(t.entryPrice+t.exitPrice);fees+=fee;exposure+=(t.exitAt-t.entryAt)/H;
  }
  if(held){const p=r.open;assert.equal(p.signalAt,held.signalAt);assert.equal(p.entryAt,held.entryAt);assert.equal(p.entryPrice,held.entryPrice);
    near(p.qty,o.notional/p.entryPrice,"held qty");near(p.markedPrice,cs.at(-1)!.close,"held mark");
    near(p.net,p.qty*(p.markedPrice-p.entryPrice)-p.qty*(p.entryPrice+p.markedPrice)*o.feeRate,"held net");
    turnover+=o.notional+p.qty*p.markedPrice;fees+=o.notional*o.feeRate;exposure+=(end-p.entryAt)/H;
  }
  const s=r.stats,closedNet=r.trades.reduce((a:number,t:R)=>a+t.net,0),openNet=r.open?.net??0;
  near(s.net,closedNet+openNet,"total net");near(s.closedNet,closedNet,"closed net");near(s.openNet,openNet,"open net");
  near(s.feesPaid,fees,"paid fees");near(s.turnoverIncludingMarkedExit,turnover,"turnover");near(s.exposureHours,exposure,"exposure");
  near(r.stressNet,s.net-turnover*d.extraStressRatePerSide,"stress net");
  assert.equal(s.trades,r.trades.length);assert.equal(s.wins,r.trades.filter((t:R)=>t.net>1e-8).length);
  assert.equal(s.losses,r.trades.filter((t:R)=>t.net< -1e-8).length);assert.equal(s.breakeven,r.trades.filter((t:R)=>Math.abs(t.net)<=1e-8).length);
  near(s.winningDollars,r.trades.reduce((a:number,t:R)=>a+Math.max(0,t.net),0),"winning dollars");
  near(s.losingDollars,r.trades.reduce((a:number,t:R)=>a+Math.min(0,t.net),0),"losing dollars");
  assert.equal(s.rawSignals,signals.length);assert.equal(s.skippedOccupied,occupied.length);
  assert.equal(s.pendingAtEnd,expected.some(x=>x.phase==="cutoff")||!!(held&&held.entryAt+o.holdMs<end));
  // Equity derived from completed full-trade net, not the worker's cash-at-fill ledger.
  const ps=[...r.trades,...(r.open?[{...r.open,exitAt:Infinity}]:[])];let j=0,realized=0,peak=o.equity,dd=0,cdd=0,prev=o.equity,bankrupt=false;
  const monthly=new Map<string,number>();let month="",nextMonth=0;
  for(const c of cs){while(j<ps.length&&ps[j].exitAt<=c.ts){realized+=ps[j].net;j++;}
    const p=j<ps.length&&ps[j].entryAt<=c.ts?ps[j]:null;
    const mark=(px:number)=>o.equity+realized+(p?p.qty*(px-p.entryPrice)-p.qty*(px+p.entryPrice)*o.feeRate:0);
    const eq=mark(c.close),lo=mark(c.low);dd=Math.max(dd,100*(peak-lo)/peak);peak=Math.max(peak,eq);cdd=Math.max(cdd,100*(peak-eq)/peak);bankrupt ||=lo<=0;
    if(c.ts>=nextMonth){const dt=new Date(c.ts);month=dt.toISOString().slice(0,7);nextMonth=Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,1);}
    monthly.set(month,(monthly.get(month)??0)+eq-prev);prev=eq;
  }
  near(s.maxAdverseDrawdownPct,dd,"adverse DD");near(s.maxCloseDrawdownPct,cdd,"close DD");assert.equal(s.bankrupt,bankrupt);assert.equal(r.monthly.length,monthly.size);
  for(const m of r.monthly){const exits=r.trades.filter((t:R)=>new Date(t.exitAt).toISOString().startsWith(m.month)),entries=ps.filter(t=>new Date(t.entryAt).toISOString().startsWith(m.month));
    near(m.markedNet,monthly.get(m.month)!,"month equity");near(m.closedNet,exits.reduce((a:number,t:R)=>a+t.net,0),"month closed");
    assert.equal(m.trades,exits.length);assert.equal(m.wins,exits.filter((t:R)=>t.net>1e-8).length);assert.equal(m.losses,exits.filter((t:R)=>t.net< -1e-8).length);
    assert.equal(m.breakeven,exits.filter((t:R)=>Math.abs(t.net)<=1e-8).length);
    near(m.winningDollars,exits.reduce((a:number,t:R)=>a+Math.max(0,t.net),0),"month wins");near(m.losingDollars,exits.reduce((a:number,t:R)=>a+Math.min(0,t.net),0),"month losses");
    near(m.feesPaid,entries.length*o.notional*o.feeRate+exits.reduce((a:number,t:R)=>a+t.qty*t.exitPrice*o.feeRate,0),"month fees");
  }
  assert.deepEqual(r.entryStats,{submitted:expected.length,filled:filled.length,expired:expected.filter(x=>x.phase==="expired").length,
    pendingAtCutoff:expected.filter(x=>x.phase==="cutoff").length,ignoredLowTouches:expected.reduce((a,x)=>a+x.ignoredLowTouches,0),
    delayedFills:filled.filter(x=>x.entryAt>x.activeAt).length,totalWaitMinutes:filled.reduce((a,x)=>a+(x.entryAt-x.signalAt)/M,0)});
  return {fills:r.trades.length*2+(r.open?1:0),marks:cs.length,intents:expected.length};
}
