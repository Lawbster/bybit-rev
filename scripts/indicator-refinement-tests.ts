import assert from "assert/strict";
import { refinementGate as gate, type Refinement } from "./indicator-refinement-policy";
import { runEntryContext } from "./indicator-entry-context-policy";
const H=3_600_000,M=60_000;
const b=(start:number,tf:number,fields:any={},close=100):any=>({candle:{timestamp:start,open:close,high:close+1,low:close-1,close,volume:1,turnover:close},
  barEnd:start+tf,availableAt:start+tf,feature:{timestamp:start,...fields}});
const r=(family:Refinement["family"],threshold:number,tf=H):Refinement=>({id:"fixture",family,timeframeMs:tf,threshold});
for(const tf of [H/2,H]){
  for(const threshold of [-.25,.25,0]){const bs=new Map([[tf,b(0,tf,{vvDayStart:0,vvDayDistance:threshold})]]);assert(!gate(r("vwap",threshold,tf),tf,bs).pass);
    bs.set(tf,b(0,tf,{vvDayStart:0,vvDayDistance:threshold+.00001}));assert(gate(r("vwap",threshold,tf),tf,bs).pass);}
  for(const threshold of [-.05,.05,0]){const bs=new Map([[tf,b(0,tf,{vfSigned:threshold})]]);assert(!gate(r("cmf",threshold,tf),tf,bs).pass);
    bs.set(tf,b(0,tf,{vfSigned:threshold-.00001}));assert(gate(r("cmf",threshold,tf),tf,bs).pass);}
  const bs=new Map([[tf,b(0,tf,{aeAtr:2},100)],[2*tf,b(tf,tf,{aeAtr:999},102)]]);
  assert(gate(r("shock",1,tf),2*tf,bs).pass);assert(!gate(r("shock",.75,tf),2*tf,bs).pass);assert(gate(r("shock",1.25,tf),2*tf,bs).pass);
  bs.set(tf,b(0,tf,{aeAtr:0},100));assert(!gate(r("shock",1,tf),2*tf,bs).ready);
  bs.set(tf,b(0,tf,{aeAtr:2},100));bs.set(2*tf,b(tf,tf,{},100));assert(gate(r("shock",.75,tf),2*tf,bs).pass);
}
const old=b(23*H,H,{vvDayStart:0,vvDayDistance:1}),future=b(24*H,H,{vvDayStart:24*H,vvDayDistance:-100});
const bs=new Map([[24*H,old],[25*H,future]]);assert.equal(gate(r("vwap",0),24*H+15*M,bs).dayStart,0);assert(gate(r("vwap",0),24*H+15*M,bs).pass);
old.availableAt=24*H+16*M;assert(!gate(r("vwap",0),24*H+15*M,bs).ready);old.availableAt=24*H;
bs.delete(24*H);assert(!gate(r("vwap",0),24*H+15*M,bs).ready);
const cs=Array.from({length:180},(_,i)=>({timestamp:i*M,open:100,high:101,low:99,close:100,volume:1,turnover:100}));
const opp=(at:number):any=>({at,sourceStart:at-M,sourceEnd:at,availableAt:at,previousStart:at-2*M,feature:{timestamp:at-M}});
const opts={start:0,end:180*M,delayMs:M,holdMs:20*M,notional:10000,equity:32000,feeRate:.00055};
const context=new Map([[H,b(0,H,{vfSigned:.1})],[2*H,b(H,H,{vfSigned:-.1})]]),fn=(t:number)=>gate(r("cmf",0),t,context);
const out=runEntryContext(cs,[opp(H),opp(2*H)],"short",opts,fn);assert.equal(out.trades.length,1);assert.equal(out.trades[0].signalAt,2*H);assert.equal(out.trades[0].entryAt,2*H+M);
assert.equal(out.trades[0].exitAt,2*H+22*M);assert.equal(out.decisions[0].outcome,"condition_false");
const ready=runEntryContext(cs,[opp(H),opp(2*H)],"short",opts,fn,true);assert.equal(ready.trades.length,2);
const prefix=runEntryContext(cs.slice(0,100),[opp(H),opp(2*H)],"short",{...opts,end:100*M},fn);
assert.deepEqual(prefix,runEntryContext(cs,[opp(H),opp(2*H)],"short",{...opts,end:100*M},fn));
console.log("R01 fixtures passed: strict/inclusive thresholds, 30m/1h source clocks, prior ATR, zero/null, midnight, late/missing source, discard, readiness, delayed entry/exit and prefix.");
