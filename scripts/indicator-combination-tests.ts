import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import type { FeatureBar } from "./indicator-standalone-engine";
import { conditionAt, runCombination, type Gate, type Opportunity } from "./indicator-combination-engine";
import { computeVwapVolumeValues } from "../src/research/vwap-volume-features";
const M=60_000,H=60*M,D=24*H;
let passed=0;
function test(name:string,fn:()=>void){fn();passed++;console.log(`PASS ${name}`);}
const candle=(t:number,p=100):Candle=>({timestamp:t,open:p,high:p+1,low:p-1,close:p,volume:1,turnover:p});
const bar=(end:number,tf:number,values:any,lag=0):FeatureBar=>({candle:candle(end-tf),barEnd:end,availableAt:end+lag,feature:{timestamp:end-tf,...values} as any});
const opportunity=(at:number):Opportunity=>({at,sourceStart:at-M,sourceEnd:at,availableAt:at,previousStart:at-2*M,feature:{timestamp:at-M} as any});
const tape=Array.from({length:50},(_,i)=>candle(D+i*M,100+i));
const opts={start:D,end:D+50*M,delayMs:0,notional:10000,equity:32000,feeRate:.00055,holdMs:10*M};
const fixed=(pass:boolean,ready=true):Gate=>({condition:"B1",expectedEnd:D,sourceStart:D-4*H,sourceEnd:D,availableAt:D,dayStart:null,value:ready?1:null,ready,pass,reason:ready?null:"missing_bar"});
test("4h as-of cannot peek at the forming bar",()=>{
 const rows=new Map([[8*H,bar(8*H,4*H,{dmSpread:1})],[12*H,bar(12*H,4*H,{dmSpread:-1})]]);
 assert.equal(conditionAt("B1","long",10*H+15*M,rows).value,1);
 assert.equal(conditionAt("B1","long",12*H,rows).value,-1);
 rows.delete(12*H);assert.equal(conditionAt("B1","long",12*H,rows).ready,false);
});
test("missing or late expected source cannot use an older row",()=>{
 const rows=new Map([[8*H,bar(8*H,4*H,{dmSpread:1})],[12*H,bar(12*H,4*H,{dmSpread:2},M)]]);
 assert.equal(conditionAt("B1","long",12*H,rows).reason,"bar_not_available");
 assert.equal(conditionAt("B1","long",12*H+M,rows).pass,true);
});
test("null versus legitimate zeros and strict boundaries",()=>{
 for(const [id,field,value,long,short]of [["B1","dmSpread",0,false,false],["B2","aeSigned",0,true,true],
  ["B2","aeSigned",-.5,false,true],["B2","aeSigned",.5,true,false],["B3","vvRolling20",1.5,true,true],
  ["B3","vvRolling20",0,false,false]] as const){
  const tf=id==="B1"?4*H:H,rows=new Map([[D,bar(D,tf,{[field]:value})]]);
  assert.equal(conditionAt(id,"long",D,rows).pass,long);assert.equal(conditionAt(id,"short",D,rows).pass,short);
  rows.set(D,bar(D,tf,{[field]:null}));assert.equal(conditionAt(id,"long",D,rows).ready,false);
 }
});
test("midnight VWAP carries its source day rather than the new forming day",()=>{
 const rows=new Map([[D,bar(D,H,{vvDayStart:0,vvDayDistance:.1})]]);
 const result=conditionAt("B4","long",D+15*M,rows);assert.equal(result.pass,true);assert.equal(result.dayStart,0);
 rows.set(D,bar(D,H,{vvDayStart:D,vvDayDistance:.1}));assert.equal(conditionAt("B4","long",D+15*M,rows).ready,false);
});
test("RVOL denominator excludes current volume; zero denominator stays null",()=>{
 const bs=Array.from({length:21},(_,i)=>candle(i*H));bs[20]={...bs[20],volume:30,turnover:3000};
 assert.equal(computeVwapVolumeValues(bs,H)[20].vvRolling20,30);
 for(let i=0;i<20;i++)bs[i]={...bs[i],volume:0,turnover:0};assert.equal(computeVwapVolumeValues(bs,H)[20].vvRolling20,null);
});
test("false A-time gate does not queue a catch-up entry",()=>{
 const r=runCombination(tape,[opportunity(D)],"long",opts,at=>fixed(at>D));assert.equal(r.trades.length,0);assert.equal(r.blockedCondition,1);
});
test("gating can free occupancy for a later genuine crossing",()=>{
 const os=[opportunity(D),opportunity(D+M)],parent=runCombination(tape,os,"long",opts);
 const v=runCombination(tape,os,"long",opts,at=>fixed(at!==D));
 assert.equal(parent.trades[0].signalAt,D);assert.equal(parent.stats.skippedOccupied,1);assert.equal(v.trades[0].signalAt,D+M);
});
test("delayed fill freezes gate evidence and timeout starts at the actual fill",()=>{
 let calls=0;const o={...opts,delayMs:M};const r=runCombination(tape,[opportunity(D)],"short",o,()=>{calls++;return fixed(true);});
 assert.equal(calls,1);assert.equal(r.trades[0].entryAt,D+M);assert.equal(r.trades[0].exitAt,D+12*M);
 assert.equal(r.trades[0].entryPrice,tape[1].open);assert.equal(r.trades[0].exitPrice,tape[12].open);
});
test("same-timestamp timeout fill permits a new crossing only once flat",()=>{
 const r=runCombination(tape,[opportunity(D),opportunity(D+10*M)],"long",opts);
 assert.equal(r.trades.length,2);assert.equal(r.trades[1].entryAt,r.trades[0].exitAt);
 const d=runCombination(tape,[opportunity(D),opportunity(D+10*M)],"long",{...opts,delayMs:M});assert.equal(d.trades.length,1);
});
test("readiness control never applies the economic threshold",()=>{
 const os=[opportunity(D)];assert.equal(runCombination(tape,os,"long",opts,()=>fixed(false),true).trades.length,1);
 assert.equal(runCombination(tape,os,"long",opts,()=>fixed(false,false),true).blockedMissing,1);
});
test("cutoff open mark and pending exit are not a completed trade",()=>{
 const r=runCombination(tape,[opportunity(D)],"long",{...opts,end:D+11*M,delayMs:M});
 assert.equal(r.trades.length,0);assert(r.open);assert.equal(r.stats.pendingAtEnd,false);
 const p=runCombination(tape,[opportunity(D)],"long",{...opts,end:D+12*M,delayMs:M});assert.equal(p.stats.pendingAtEnd,true);assert.equal(p.trades.length,0);
 assert(Math.abs(r.stats.net-r.open.net)<1e-8);
});
test("an entry due at cutoff remains pending, not filled",()=>{
 const r=runCombination(tape,[opportunity(D+49*M)],"long",{...opts,delayMs:M});assert.equal(r.open,null);assert.equal(r.stats.pendingAtEnd,true);
});
test("prefix and future-price mutations leave earlier decisions/fills unchanged",()=>{
 const o={...opts,end:D+20*M},os=[opportunity(D),opportunity(D+25*M)];
 const a=runCombination(tape,os,"long",o),b=runCombination(tape.slice(0,20),os.filter(x=>x.at<o.end),"long",o);
 assert.deepEqual(a,b);
 const changed=tape.map((c,i)=>i>=20?candle(c.timestamp,1e6):c);assert.deepEqual(a,runCombination(changed,os,"long",o));
});
test("invalid source provenance and gaps are rejected",()=>{
 assert.throws(()=>runCombination(tape,[{...opportunity(D),availableAt:D+M}],"long",opts));
 assert.throws(()=>runCombination(tape.filter((_,i)=>i!==3),[],"long",opts));
});
console.log(`${passed} C01 timing/state/accounting fixture groups passed`);
