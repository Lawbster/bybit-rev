import assert from "assert/strict";
import {computeVwapVolumeValues} from "../src/research/vwap-volume-features";
import {computeResearchFeatures} from "../src/research/indicator-features";
import {ClosedBarSeries} from "../src/research/closed-bars";
import {frozenVwapVolumeRules,vwapVolumeEntrySignal,vwapVolumeExitSignal,runVwapVolumeStandalone,fixedVwapVolumeId,unfilteredVwapVolumeId,type VwapVolumeRule,type VwapVolumeFeatureBar} from "./vwap-volume-standalone-engine";
import {runStandalone,type StandaloneOptions,type FeatureBar} from "./indicator-standalone-engine";
import type {Candle} from "../src/fetch-candles";
const M=60000,H=60*M,D=24*H,T=Date.UTC(2026,7,1),TF=[5*M,15*M,30*M,H,4*H],rules=frozenVwapVolumeRules();
let groups=0;function test(s:string,f:()=>void){f();groups++;console.log("PASS "+s);}
const near=(a:number,b:number,e=1e-8)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
function varying(tf:number,n:number,start=T):Candle[]{return Array.from({length:n},(_,i)=>{const close=80+.001*i+Math.sin(i*.43)*3,volume=10+(i%17)*2;
return{timestamp:start+i*tf,open:close,high:close+1,low:close-1,close,volume,turnover:volume*(close+.1*Math.sin(i))};});}
const without=(f:any)=>Object.fromEntries(Object.entries(f).filter(([k])=>!k.startsWith("vv")));
function ff(n:number,tf:number,patch:(i:number)=>Record<string,number|null>):VwapVolumeFeatureBar[]{
 return Array.from({length:n},(_,i)=>{const timestamp=T+(i-3)*tf,candle={timestamp,open:100,high:101,low:99,close:100,volume:10,turnover:1000};
 return{candle,barEnd:timestamp+tf,availableAt:timestamp+tf,feature:{timestamp,rsi14:null,crsi:null,roc5:null,atr14:null,atrPct:null,adx14:null,plusDI14:null,minusDI14:null,vwapUtcDay:null,rvol20:null,
 vvDayStart:T-D,vvWeekStart:T-5*D,vvDay:100,vvWeek:100,vvDayDistance:0,vvWeekDistance:0,vvRolling20:0,vvTime20:0,vvChange:0,vvVersion:1,...patch(i)}};});
}
function pair(r:VwapVolumeRule):VwapVolumeFeatureBar[]{
 const sign=r.side==="long"?1:-1,k=r.threshold,level=r.mode==="trend"?k:-k,next=level+(r.mode==="into"?-.01:.01);
 return ff(3,r.timeframeMs,i=>r.family==="vwap"?{vvDayDistance:sign*(i===2?next:level),vvWeekDistance:sign*(i===2?next:level),vvRolling20:0,vvTime20:0,vvChange:0}:
 {vvDayDistance:0,vvWeekDistance:0,vvRolling20:i===2?k+.1:k,vvTime20:i===2?k+.1:k,vvChange:sign*(r.mode==="follow"?1:-1)});
}
const opts=(n:number,delayMs=0):StandaloneOptions=>({start:T,end:T+n*M,delayMs,holdMs:12*H,notional:1000,equity:10000,feeRate:.001});
const tape=(n:number)=>Array.from({length:n},(_,i)=>{const open=100+i*.001;return{timestamp:T+i*M,open,high:open+1,low:open-1,close:open+.0001,volume:10,turnover:10*open};});

test("VWAP day / prior20 RVOL exactly match shared arrays on five clocks",()=>{
 for(const tf of TF){const cs=varying(tf,22*D/tf+3),a=computeVwapVolumeValues(cs,tf),base=computeResearchFeatures(cs,tf);
 a.forEach((v,i)=>{assert.equal(v.vvDay,base[i].vwapUtcDay);assert.equal(v.vvRolling20,base[i].rvol20);
   if(i<20*D/tf)assert.equal(v.vvTime20,null);});
 for(const i of [1,20,Math.floor(cs.length/2),cs.length-1]){
 const b=cs[i],d=Math.floor(b.timestamp/D)*D,date=new Date(b.timestamp),w=d-((date.getUTCDay()+6)%7)*D;
 for(const [at,field]of [[d,"vvDay"],[w,"vvWeek"]] as const){const window=cs.slice(0,i+1).filter(c=>c.timestamp>=at);
   if(window[0].timestamp!==at||!window.some(c=>c.volume>0))assert.equal(a[i][field],null);
   else near(a[i][field]!,window.reduce((q,c)=>q+c.turnover,0)/window.reduce((v,c)=>v+c.volume,0));}
 if(i>=20*D/tf){const slots=Array.from({length:20},(_,j)=>cs[i-(20-j)*D/tf].volume);near(a[i].vvTime20!,b.volume/(slots.reduce((a,c)=>a+c,0)/20));}
 }
 assert.deepEqual(computeVwapVolumeValues(cs.slice(0,130),tf),a.slice(0,130));
 }
});
test("hand turnover VWAP, Monday resets, incomplete anchors and zero volume",()=>{
 const cs=[{timestamp:T,open:100,high:102,low:98,close:101,volume:2,turnover:200},{timestamp:T+H,open:110,high:112,low:98,close:110,volume:1,turnover:110}];
 const a=computeVwapVolumeValues(cs,H);near(a[1].vvDay!,310/3);assert.equal(a[0].vvWeek,null);
 const monday=Date.UTC(2026,7,3),b=computeVwapVolumeValues(varying(H,26,monday),H);
 assert.equal(b[0].vvWeek,b[0].vvDay);assert.equal(b[24].vvDayStart,monday+D);assert.equal(b[24].vvWeekStart,monday);
 const partial=computeVwapVolumeValues(varying(H,26,monday+H),H);assert.equal(partial[22].vvDay,null);assert.equal(partial[23].vvWeek,null);assert(partial[23].vvDay!=null);
 const zero=varying(H,22*24+2,monday).map(c=>({...c,volume:0,turnover:0}));const z=computeVwapVolumeValues(zero,H);
 assert.equal(z.at(-1)!.vvDay,null);assert.equal(z.at(-1)!.vvRolling20,null);assert.equal(z.at(-1)!.vvTime20,null);
 const valid=varying(H,22*24+2,monday);valid[valid.length-1]={...valid.at(-1)!,volume:0,turnover:0};
 const q=computeVwapVolumeValues(valid,H).at(-1)!;assert.equal(q.vvRolling20,0);assert.equal(q.vvTime20,0);
 assert.throws(()=>computeVwapVolumeValues([{...cs[0],turnover:1}],H));assert.throws(()=>computeVwapVolumeValues([{...cs[0],volume:0}],H));
});
test("time-matched RVOL uses prior exact UTC slots, not current/day-cumulative or fallback",()=>{
 const tf=H,cs=varying(tf,22*24);cs.forEach((c,i)=>{c.volume=(1+i%24)*(1+Math.floor(i/24)%3);c.turnover=c.volume*c.close;});
 const i=21*24+7,x=computeVwapVolumeValues(cs,H),expected=cs[i].volume/(Array.from({length:20},(_,j)=>cs[i-(j+1)*24].volume).reduce((a,b)=>a+b,0)/20);
 near(x[i].vvTime20!,expected);assert.notEqual(x[i].vvTime20,x[i].vvRolling20);
 const changed=cs.map(c=>({...c}));changed[i].volume*=100;changed[i].turnover*=100;
 const y=computeVwapVolumeValues(changed,H);near(y[i].vvTime20!,100*x[i].vvTime20!);near(y[i].vvRolling20!,100*x[i].vvRolling20!);
 assert.deepEqual(y.slice(0,i),x.slice(0,i));assert.throws(()=>computeVwapVolumeValues(cs.filter((_,j)=>j!==50),H));
});
test("scale, volume-unit, translation and actual-turnover aggregation invariants",()=>{
 const cs=varying(M,22*D/M);
 for(const tf of TF){const agg=ClosedBarSeries.fromHistorical(cs,{sourceIntervalMs:M,targetIntervalMs:tf,publicationLagMs:0});
 const bars=agg.bars.map(b=>b.candle),x=computeVwapVolumeValues(bars,tf);
 const v=computeVwapVolumeValues(bars.map(c=>({...c,volume:c.volume*8,turnover:c.turnover*8})),tf);
 const p=computeVwapVolumeValues(bars.map(c=>({...c,open:c.open*8,high:c.high*8,low:c.low*8,close:c.close*8,turnover:c.turnover*8})),tf);
 for(const i of [20,800,bars.length-1].filter(i=>i<bars.length)){for(const k of Object.keys(x[i]) as Array<keyof typeof x[number]>){
 if(x[i][k]===null){assert.equal(v[i][k],null);assert.equal(p[i][k],null);}else{near(v[i][k]!,x[i][k]!);
 near(p[i][k]!,x[i][k]!*(["vvDay","vvWeek","vvChange"].includes(k)?8:1));}}
 const minuteIndex=(bars[i].timestamp+tf-T)/M-1;
 const prefix=cs.slice(0,minuteIndex+1).filter(c=>c.timestamp>=x[i].vvDayStart);
 near(x[i].vvDay!,prefix.reduce((a,c)=>a+c.turnover,0)/prefix.reduce((a,c)=>a+c.volume,0),1e-7);}
 }
 const short=varying(H,100),x=computeVwapVolumeValues(short,H),shift=1000;
 const y=computeVwapVolumeValues(short.map(c=>({...c,open:c.open+shift,high:c.high+shift,low:c.low+shift,close:c.close+shift,turnover:c.turnover+shift*c.volume})),H);
 x.forEach((f,i)=>{if(f.vvDay!=null)near(y[i].vvDay!,f.vvDay+shift);near(y[i].vvRolling20??0,f.vvRolling20??0);});
});
test("700 exact rule slots, fresh crossings, equality, direction, reset/null/provenance",()=>{
 assert.equal(rules.length,700);assert.equal(new Set(rules.map(r=>r.id)).size,700);assert.equal(rules.filter(r=>r.family==="bar_direction").length,60);
 for(const r of rules){const f=pair(r),a=f[1],b=f[2];assert(vwapVolumeEntrySignal(r,a,b));
 const mutate=(p:Record<string,number|null>)=>({...b,feature:{...b.feature,...p}} as VwapVolumeFeatureBar);
 if(r.family==="vwap"){
 const field=r.reference==="day"?"vvDayDistance":"vvWeekDistance",anchor=r.reference==="day"?"vvDayStart":"vvWeekStart";
 assert(!vwapVolumeEntrySignal(r,a,mutate({[field]:a.feature[field]})));
 assert(!vwapVolumeEntrySignal(r,a,mutate({[anchor]:a.feature[anchor]+D})));
 assert(!vwapVolumeEntrySignal(r,{...a,feature:{...a.feature,[field]:b.feature[field]}} as VwapVolumeFeatureBar,b));
 for(const invalid of [null,NaN,Infinity])assert(!vwapVolumeEntrySignal(r,a,mutate({[field]:invalid})));
 }else{
 assert(!vwapVolumeEntrySignal(r,a,mutate({vvChange:0})));assert(!vwapVolumeEntrySignal(r,a,mutate({vvChange:-b.feature.vvChange!})));
 if(r.family==="rvol"){const field=r.reference==="rolling20"?"vvRolling20":"vvTime20";
 assert(!vwapVolumeEntrySignal(r,a,mutate({[field]:r.threshold})));assert(!vwapVolumeEntrySignal(r,{...a,feature:{...a.feature,[field]:r.threshold+1}} as VwapVolumeFeatureBar,b));
 assert(!vwapVolumeEntrySignal(r,a,mutate({[field]:null})));
 assert(rules.some(x=>x.id===unfilteredVwapVolumeId(r)));}
 }
 assert(rules.some(x=>x.id===fixedVwapVolumeId(r)));
 assert(!vwapVolumeEntrySignal(r,a,mutate({vvVersion:99})));assert(!vwapVolumeEntrySignal(r,a,{...b,availableAt:b.availableAt-1}));
 assert(!vwapVolumeEntrySignal(r,undefined,b));
 }
});
test("each rule immutable entry/exit delay, fees, earliest neutral, timeout and rearm",()=>{
 const minutes=tape(13*60+3);
 for(const r of rules)for(const delayMs of [0,M]){
 const tf=r.timeframeMs,first=pair(r),n=Math.ceil(14*H/tf)+4;
 const rows=ff(n,tf,i=>i<3?Object.fromEntries(Object.entries(first[i].feature).filter(([k])=>k.startsWith("vv"))):
 {vvDayDistance:0,vvWeekDistance:0,vvRolling20:1,vvTime20:1,vvChange:0});
 const out=runVwapVolumeStandalone(minutes,rows,r,opts(minutes.length,delayMs));assert.equal(out.trades.length,1,r.id);
 const t=out.trades[0],decision=r.exit==="fixed12h"?T+delayMs+12*H:T+tf;
 assert.equal(t.entryAt,T+delayMs);assert.equal(t.exitDecisionAt,decision);assert.equal(t.exitAt,decision+delayMs);
 assert.equal(t.entryPrice,minutes[delayMs/M].open);assert.equal(t.exitPrice,minutes[(decision+delayMs-T)/M].open);
 near(t.fees,t.qty*(t.entryPrice+t.exitPrice)*.001);near(t.net,(r.side==="long"?1:-1)*t.qty*(t.exitPrice-t.entryPrice)-t.fees);
 assert.equal(out.stats.pendingAtEnd,false);assert.equal(out.open,null);
 const cut=T+tf;const o={...opts((cut-T)/M,delayMs)};
 const pre=runVwapVolumeStandalone(minutes.slice(0,(cut-T)/M),rows.filter(x=>x.barEnd<=cut),r,o);
 const full=runVwapVolumeStandalone(minutes,rows,r,o);assert.deepEqual(pre,full);
 }
});
test("I01 daily VWAP and clocks retain exact ledgers; unrelated features do not drive decisions",()=>{
 const minutes=varying(M,6*D/M),series=ClosedBarSeries.fromHistorical(minutes,{sourceIntervalMs:M,targetIntervalMs:H,publicationLagMs:0});
 const bars=series.bars.map(b=>b.candle),base=computeResearchFeatures(bars,H),vv=computeVwapVolumeValues(bars,H);
 const old=series.bars.map((b,i)=>({...b,feature:base[i]})),fresh=series.bars.map((b,i)=>({...b,feature:{...base[i],...vv[i],vvVersion:1}}));
 for(const r of rules.filter(r=>r.family==="vwap"&&r.timeframeMs===H&&r.reference==="day"&&r.threshold===0&&r.mode==="trend"))
 for(const delay of [0,M]){const o=opts(minutes.length,delay),a=runStandalone(minutes,old,{id:r.id,family:"vwap_cross",side:r.side,exit:r.exit},o),b=runVwapVolumeStandalone(minutes,fresh,r,o);
 assert.deepEqual(b.stats,a.stats);assert.deepEqual(b.monthly,a.monthly);assert.deepEqual(b.open,a.open);
 assert.deepEqual(b.trades.map(t=>({...t,entryFeature:without(t.entryFeature)})),a.trades);}
 for(const side of ["long","short"] as const)for(const delay of [0,M]){
 const r:VwapVolumeRule={id:"clock_"+side,family:"clock",reference:"day",timeframeMs:H,threshold:0,mode:"trend",side,exit:"fixed12h"};
 const a=runStandalone(minutes,old,{id:r.id,family:"clock",side,exit:"fixed12h"},opts(minutes.length,delay));
 const b=runVwapVolumeStandalone(minutes,old,r,opts(minutes.length,delay));assert.deepEqual(b.stats,a.stats);assert.deepEqual(b.trades,a.trades);assert.deepEqual(b.monthly,a.monthly);}
 const r=rules.find(r=>r.family==="rvol")!,f=pair(r);
 assert.equal(vwapVolumeEntrySignal(r,f[1],f[2]),vwapVolumeEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,rsi14:99,roc5:-999,vwapUtcDay:999}}));
});
test("invalid tape, prefix corruption and no volume catch-up",()=>{
 const r=rules.find(r=>r.family==="rvol")!,f=pair(r);
 const wrong={...f[2],feature:{...f[2].feature,vvChange:-f[2].feature.vvChange!}};
 assert(!vwapVolumeEntrySignal(r,f[1],wrong));
 const later={...f[2],candle:{...f[2].candle,timestamp:f[2].barEnd},barEnd:f[2].barEnd+r.timeframeMs,availableAt:f[2].barEnd+r.timeframeMs,
 feature:{...f[2].feature,timestamp:f[2].barEnd}};
 assert(!vwapVolumeEntrySignal(r,wrong,later)); // spike already crossed; no deferred acceptance
 assert.throws(()=>runVwapVolumeStandalone(tape(20).filter((_,i)=>i!==5),f,r,opts(20)));
 assert.throws(()=>computeVwapVolumeValues(varying(H,10).map((c,i)=>i===5?{...c,volume:-1}:c),H));
});
console.log(`VWAP/volume tests passed (${groups} groups;700 rule slots)`);
