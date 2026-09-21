import assert from "assert/strict";
import { entryContextGate as gate,runEntryContext } from "./indicator-entry-context-policy";
import { prepareFeatures } from "./indicator-entry-context-features";
import { referenceFeatures,referenceCross } from "./indicator-entry-context-reference";
import { calendarAttribution,calendarBuckets } from "./indicator-calendar-attribution";
const M=60_000,H=60*M,D=24*H;
let passed=0;const test=(name:string,f:()=>void)=>{f();passed++;console.log("PASS "+name);};
const candle=(t:number,p=100)=>({timestamp:t,open:p,close:p,high:p+1,low:p-1,volume:1,turnover:p});
const bar=(end:number,values:any,p=100,lag=0):any=>({candle:candle(end-H,p),barEnd:end,availableAt:end+lag,feature:{timestamp:end-H,...values}});
const opp=(at:number):any=>({at,sourceStart:at-M,sourceEnd:at,availableAt:at,previousStart:at-2*M,feature:{timestamp:at-M}});
const options=(start:number,end:number,delayMs=0)=>({start,end,delayMs,notional:10000,equity:32000,feeRate:.00055,holdMs:10*M});
test("Q1 improves while still negative; direction and exact zero",()=>{
 const rows=new Map([[H,bar(H,{macdHist:-3})],[2*H,bar(2*H,{macdHist:-2})]]);
 assert(gate("Q1","long","reversion",2*H+15*M,rows).pass);
 assert(!gate("Q1","short","reversion",2*H,rows).pass);
 rows.set(2*H,bar(2*H,{macdHist:-3}));assert(!gate("Q1","long","reversion",2*H,rows).pass);
});
test("Q1 requires adjacent available source; no stale fallback or forming hour",()=>{
 const rows=new Map([[H,bar(H,{macdHist:-3})],[2*H,bar(2*H,{macdHist:-2})],[3*H,bar(3*H,{macdHist:99})]]);
 assert.equal(gate("Q1","long","reversion",2*H+59*M,rows).value,1);
 rows.delete(H);assert(!gate("Q1","long","reversion",2*H,rows).ready);
 rows.set(H,bar(H,{macdHist:-3},100,2*H));assert(!gate("Q1","long","reversion",2*H,rows).ready);
});
test("ADX 25 boundary, legitimate zero, missing and unknown role",()=>{
 for(const x of [0,24.99,25,26]){const rows=new Map([[H,bar(H,{dmAdx:x})]]);
 assert.equal(gate("Q2","long","reversion",H,rows).pass,x<25);
 assert.equal(gate("Q2","short","continuation",H,rows).pass,x>=25);}
 assert(!gate("Q2","long","reversion",H,new Map([[H,bar(H,{dmAdx:null})]])).ready);
 assert.throws(()=>gate("Q2","long","unknown",H,new Map([[H,bar(H,{dmAdx:10})]])));
});
test("shock uses preceding ATR, inclusive one, unavailable zero denominator",()=>{
 const rows=new Map([[H,bar(H,{aeAtr:2},100)],[2*H,bar(2*H,{aeAtr:999},102)]]);
 assert.equal(gate("Q3","long","reversion",2*H,rows).value,1);assert(gate("Q3","long","reversion",2*H,rows).pass);
 rows.set(2*H,bar(2*H,{aeAtr:999},103));assert(!gate("Q3","long","reversion",2*H,rows).pass);
 rows.set(H,bar(H,{aeAtr:0},100));assert(!gate("Q3","long","reversion",2*H,rows).ready);
});
test("CMF sign and zero/null distinction",()=>{
 for(const x of [-.1,0,.1]){const rows=new Map([[H,bar(H,{vfSigned:x})]]);assert.equal(gate("Q4","long","reversion",H,rows).pass,x>0);assert.equal(gate("Q4","short","continuation",H,rows).pass,x<0);}
 assert(!gate("Q4","long","reversion",H,new Map([[H,bar(H,{vfSigned:null})]])).ready);
});
test("UTC block boundaries and midnight do not use local timezone",()=>{
 for(let i=0;i<6;i++){assert(!gate("UTC"+i,"long","reversion",D+i*4*H,new Map()).pass);assert(gate("UTC"+i,"long","reversion",D+(i+1)*4*H,new Map()).pass);}
 assert.deepEqual(calendarBuckets(Date.UTC(2026,8,5,23)),["utc4h_5","weekend"]);
 assert.deepEqual(calendarBuckets(Date.UTC(2026,8,7,0)),["utc4h_0","weekday"]);
});
test("delay across a calendar boundary freezes signal eligibility and leaves exits free",()=>{
 const start=D+4*H-M,tape=Array.from({length:20},(_,i)=>candle(start+i*M,100+i));
 const r=runEntryContext(tape,[opp(start)],"long",options(start,start+20*M,M),t=>gate("UTC1","long","reversion",t,new Map()));
 assert.equal(r.trades[0].entryAt,D+4*H);assert.equal(r.trades[0].exitAt,start+12*M);assert.equal(r.decisions.length,1);
 const blocked=runEntryContext(tape,[opp(start)],"long",options(start,start+20*M,M),t=>gate("UTC0","long","reversion",t,new Map()));assert.equal(blocked.trades.length,0);
});
test("readiness ignores the economic gate, not missing source",()=>{
 const start=D,tape=Array.from({length:20},(_,i)=>candle(start+i*M)),o=options(start,start+20*M);
 assert.equal(runEntryContext(tape,[opp(start)],"long",o,t=>gate("UTC0","long","reversion",t,new Map()),true).trades.length,1);
 assert.equal(runEntryContext(tape,[opp(start)],"long",o,t=>gate("Q1","long","reversion",t,new Map()),true).blockedMissing,1);
});
test("calendar denominators conserve exposure, opportunities and W/L",()=>{
 const start=D+4*H-M,tape=Array.from({length:30},(_,i)=>candle(start+i*M,100+i));
 const r=runEntryContext(tape,[opp(start),opp(start+M),opp(start+12*M)],"long",options(start,start+30*M));
 const rows=calendarAttribution({id:"parent",window:"test",delayMs:0,start:new Date(start).toISOString(),end:new Date(start+30*M).toISOString(),timeframeMs:M},r);
 const all=rows.filter(x=>x.scope==="all"&&x.bucket.startsWith("utc4h"));
 const sum=(key:string)=>all.reduce((s,x)=>s+x[key],0);
 assert(Math.abs(sum("exposureClockHours")-r.stats.exposureHours)<1e-8);assert.equal(sum("opportunities"),3);assert.equal(sum("occupiedSignals"),1);
 assert.equal(sum("wins"),2);assert(Math.abs(sum("signalOriginNet")-r.stats.net)<1e-8);assert.equal(sum("decisionSlots"),30);
});
test("new adapters independently reproduce RSI/ROC/ATR/Bollinger and context formulas",()=>{
 const minutes=Array.from({length:7200},(_,i)=>{const p=100+5*Math.sin(i/53)+3*Math.cos(i/171);return{...candle(i*M,p),close:p+.1*Math.sin(i/3),volume:1+i%9,turnover:p*(1+i%9)};});
 const prod=prepareFeatures(minutes),ref=referenceFeatures(minutes.map(c=>({ts:c.timestamp,...c})));
 const rules:any[]=[
 {id:"rsi",family:"rsi_extreme",side:"long",exit:"fixed12h",timeframeMs:5*M,upper:70,mode:"into"},
 {id:"roc",family:"roc",side:"long",exit:"fixed12h",timeframeMs:H,lookbackBars:12,magnitudePct:1,mode:"into"},
 {id:"atr",family:"atr_move",side:"long",exit:"fixed12h",timeframeMs:30*M,period:14,threshold:.5,mode:"into"},
 {id:"bb",family:"bollinger",side:"short",exit:"fixed12h",timeframeMs:4*H,period:20,multiplier:2,mode:"breakout"}];
 for(const r of rules){const refs=ref.get(r),expected:number[]=[];for(const [t,x]of refs)if(referenceCross(r,refs.get(t-r.timeframeMs),x))expected.push(t+r.timeframeMs);
 assert.deepEqual(prod.opportunities(r).map(x=>x.at),expected);
 for(const b of prod.rows(r)){const x=refs.get(b.candle.timestamp)!;for(const [k,v]of Object.entries(x)){const actual=(b.feature as any)[k];if(v===null)assert.equal(actual,null);else assert(Math.abs(actual-(v as number))<1e-8,r.id+" "+k);}}}
 const prefix=prepareFeatures(minutes.slice(0,4800));
 for(const q of ["Q1","Q2","Q3","Q4"])assert.deepEqual([...prod.conditionRows(q)].filter(([t])=>t<=4800*M),[...prefix.conditionRows(q)]);
});
console.log(passed+" C02/T01 fixture groups passed");
