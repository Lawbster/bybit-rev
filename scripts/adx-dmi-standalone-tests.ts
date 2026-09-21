import assert from "assert/strict";
import {ADX} from "technicalindicators";
import {computeAdxDmiValues} from "../src/research/adx-dmi-features";
import {computeResearchFeatures} from "../src/research/indicator-features";
import {adxDmiEntrySignal,adxDmiExitSignal,runAdxDmiStandalone,type AdxDmiRule,type AdxDmiFeatureBar} from "./adx-dmi-standalone-engine";
import {runStandalone,type FeatureBar,type StandaloneOptions} from "./indicator-standalone-engine";
import type {Candle} from "../src/fetch-candles";
const M=60000,H=60*M,T=Date.UTC(2026,7,1),TF=[5*M,15*M,30*M,H,4*H],N=[7,14,28];
const defs:Array<{mode:AdxDmiRule["mode"];threshold:number}>=[{mode:"di_cross",threshold:0},...[20,25,40].map(threshold=>({mode:"di_strong" as const,threshold})),...[20,25,40].map(threshold=>({mode:"adx_cross" as const,threshold})),...[40,50].map(threshold=>({mode:"adx_peak_fade" as const,threshold}))];
let groups=0;const test=(s:string,f:()=>void)=>{f();groups++;console.log("PASS "+s);};
const near=(a:number,b:number,tol=1e-8)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
const rule=(mode:AdxDmiRule["mode"]="di_cross",side:AdxDmiRule["side"]="long",exit:AdxDmiRule["exit"]="fixed12h",tf=H,n=14,threshold=0):AdxDmiRule=>
({id:"fixture",family:"adx_dmi",timeframeMs:tf,period:n,threshold,mode,side,exit});
function features(spreads:Array<number|null>,adxs:Array<number|null>=spreads.map(()=>30),tf=H,n=14):AdxDmiFeatureBar[]{
 return spreads.map((v,i)=>{const timestamp=T+(i-3)*tf,close=100;
 return {candle:{timestamp,open:close,high:101,low:99,close,volume:10,turnover:1000},barEnd:timestamp+tf,availableAt:timestamp+tf,
 feature:{timestamp,rsi14:null,crsi:null,roc5:v,atr14:null,atrPct:null,adx14:null,plusDI14:null,minusDI14:null,vwapUtcDay:null,rvol20:null,
 dmAtr:v===null?null:2,dmPlus:v===null?null:20+v/2,dmMinus:v===null?null:20-v/2,dmSpread:v,dmDx:v===null?null:100*Math.abs(v)/40,dmAdx:adxs[i],dmPeriod:n}};
 });
}
const tape=(n:number,f:(i:number)=>Partial<Candle>=()=>({})):Candle[]=>Array.from({length:n},(_,i)=>{const o=f(i),open=o.open??100,close=o.close??open;
return {timestamp:T+i*M,open,high:Math.max(open,close)+1,low:Math.min(open,close)-1,close,volume:10,turnover:1000,...o};});
const opts=(n:number,delayMs=0):StandaloneOptions=>({start:T,end:T+n*M,delayMs,holdMs:12*H,notional:1000,equity:10000,feeRate:.001});
const without=(f:any):FeatureBar["feature"]=>{const {dmAtr,dmPlus,dmMinus,dmSpread,dmDx,dmAdx,dmPeriod,...old}=f;return old;};
function varying(tf:number,count=220):Candle[]{
 return Array.from({length:count},(_,i)=>{const close=80+.01*i+Math.sin(i*.47)*5+Math.cos(i*.1)*2;
 return {timestamp:T+i*tf,open:close,high:close+1+i%3*.1,low:close-1-i%2*.2,close,volume:10,turnover:10*close};});
}
test("all15 clock/period pairs match external Wilder ADX/DI; period14 exact prior shared features",()=>{
 for(const tf of TF)for(const n of N){
  const cs=varying(tf),out=computeAdxDmiValues(cs,tf,n),e=ADX.calculate({high:cs.map(c=>c.high),low:cs.map(c=>c.low),close:cs.map(c=>c.close),period:n});
  assert.equal(e.length,cs.length-(2*n-1));
  out.forEach((x,i)=>{
   if(i<n){Object.values(x).forEach(v=>assert.equal(v,null));return;}
   assert(x.dmPlus!==null&&x.dmMinus!==null);if(i<2*n-1)assert.equal(x.dmAdx,null);
   else{const ref=e[i-(2*n-1)];near(x.dmAdx!,ref.adx);near(x.dmPlus,ref.pdi);near(x.dmMinus,ref.mdi);}
   near(x.dmSpread!,x.dmPlus-x.dmMinus);
  });
  if(n===14){const old=computeResearchFeatures(cs,tf);out.forEach((v,i)=>{assert.equal(v.dmAtr,old[i].atr14);assert.equal(v.dmPlus,old[i].plusDI14);assert.equal(v.dmMinus,old[i].minusDI14);assert.equal(v.dmAdx,old[i].adx14);});}
  assert.deepEqual(computeAdxDmiValues(cs.slice(0,100),tf,n),out.slice(0,100));
 }
});
test("hand Wilder seed, tied/outside moves excluded, zero TR/DI and null warmup",()=>{
 const cs=[[11,9,10],[12,10,11],[13,11,12],[12,10,11],[13,9,10]].map(([high,low,close],i)=>({timestamp:T+i*H,open:close,high,low,close}));
 const x=computeAdxDmiValues(cs,H,2);assert.equal(x[2].dmAdx,null);near(x[2].dmPlus!,50);near(x[2].dmDx!,100);
 near(x[3].dmPlus!,25);near(x[3].dmMinus!,25);near(x[3].dmAdx!,50);
 near(x[4].dmAtr!,3);near(x[4].dmPlus!,100*.25/3);near(x[4].dmMinus!,100*.25/3);near(x[4].dmAdx!,25);
 for(const n of N){
  const flat=tape(100).map((c,i)=>({...c,timestamp:T+i*H,open:100,high:100,low:100,close:100}));
  const z=computeAdxDmiValues(flat,H,n);assert.deepEqual(z[2*n-1],{dmAtr:0,dmPlus:0,dmMinus:0,dmDx:0,dmAdx:0,dmSpread:0});
 }
});
test("scale/translation and mirrored direction invariants; gaps and invalid OHLC rejected",()=>{
 const cs=varying(H),a=computeAdxDmiValues(cs,H,14);
 for(const [scale,shift]of [[10,0],[1,100000]]){
  const b=computeAdxDmiValues(cs.map(c=>({...c,open:c.open*scale+shift,high:c.high*scale+shift,low:c.low*scale+shift,close:c.close*scale+shift})),H,14);
  a.forEach((x,i)=>{for(const k of Object.keys(x) as Array<keyof typeof x>){if(x[k]===null)assert.equal(b[i][k],null);else near(b[i][k]!,x[k]!*(k==="dmAtr"?scale:1),1e-7);}});
 }
 const mirror=computeAdxDmiValues(cs.map(c=>({...c,open:200-c.open,close:200-c.close,high:200-c.low,low:200-c.high})),H,14);
 a.forEach((x,i)=>{if(x.dmPlus===null)return;near(x.dmPlus,mirror[i].dmMinus!);near(x.dmMinus!,mirror[i].dmPlus!);if(x.dmAdx!==null)near(x.dmAdx,mirror[i].dmAdx!);});
 assert.throws(()=>computeAdxDmiValues(cs.filter((_,i)=>i!==40),H,14));
 assert.throws(()=>computeAdxDmiValues([...cs,cs.at(-1)!],H,14));
 assert.throws(()=>computeAdxDmiValues(cs.map((c,i)=>i===3?{...c,low:c.high+1}:c),H,14));
 assert.throws(()=>computeAdxDmiValues(cs,H,1));
});
test("all540 definitions: crossing/threshold equality, direction/strength, stale provenance and known ADX peak",()=>{
 let count=0;
 for(const tf of TF)for(const n of N)for(const {mode,threshold}of defs)for(const side of ["long","short"] as const)for(const exit of ["fixed12h","indicator_or12h"] as const){
  const sign=side==="long"?1:-1,spread=mode==="di_cross"||mode==="di_strong"?[-10,0,10].map(v=>v*sign):Array(3).fill(mode==="adx_peak_fade"?-10*sign:10*sign);
  const adx=mode==="adx_peak_fade"?[threshold-1,threshold,threshold-1]:mode==="adx_cross"?[threshold-1,threshold,threshold+1]:[null,null,mode==="di_cross"?null:threshold];
  const f=features(spread,adx,tf,n),r=rule(mode,side,exit,tf,n,threshold);
  assert(adxDmiEntrySignal(r,f[1],f[2],f[0]));
  const fail=structuredClone(f);
  if(mode==="di_cross"||mode==="di_strong")fail[2].feature.dmSpread=0;
  else if(mode==="adx_cross")fail[2].feature.dmAdx=threshold;
  else fail[2].feature.dmAdx=threshold;
  assert(!adxDmiEntrySignal(r,fail[1],fail[2],fail[0]));
  for(const bad of [null,NaN,Infinity])assert(!adxDmiEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,dmSpread:bad}} as AdxDmiFeatureBar,f[0]));
  assert(!adxDmiEntrySignal(r,f[1],{...f[2],availableAt:f[2].barEnd-1},f[0]));
  assert(!adxDmiEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,dmPeriod:15}} as AdxDmiFeatureBar,f[0]));
  if(mode==="adx_peak_fade"){assert(!adxDmiEntrySignal(r,f[1],f[2]));const z=structuredClone(f[0]);z.feature.dmAdx=threshold+1;assert(!adxDmiEntrySignal(r,f[1],f[2],z));}
  count++;
 }assert.equal(count,540);
});
test("strength gate cannot catch up after rejected DI crossing; falling ADX does not reverse DI",()=>{
 const r=rule("di_strong","long","fixed12h",H,14,25),f=features([-10,-1,10,15],[20,21,24,30]);
 assert(!adxDmiEntrySignal(r,f[1],f[2],f[0]));assert(!adxDmiEntrySignal(r,f[2],f[3],f[1]));
 const peak=features([20,21,22],[49,50,49]);const fade=rule("adx_peak_fade","short","fixed12h",H,14,50);
 assert(adxDmiEntrySignal(fade,peak[1],peak[2],peak[0]));assert(peak[2].feature.dmSpread!>0);
 assert(!adxDmiEntrySignal({...fade,side:"long"},peak[1],peak[2],peak[0]));
});
test("eight old ROC forced-DI-cross and four synthetic clock accounting cases remain exact",()=>{
 const cs=tape(36*60+3,i=>({open:100+Math.sin(i/50)*5}));
 for(const side of ["long","short"] as const)for(const delay of [0,M])for(const exit of ["fixed12h","indicator_or12h"] as const){
  const f=features(Array.from({length:42},(_,i)=>i%3===0?-10:10)),oldFs=f.map(x=>({...x,feature:without(x.feature)}));
  const a=runStandalone(cs,oldFs,{id:"old",family:"roc_cross",side,exit},opts(cs.length,delay));
  const b=runAdxDmiStandalone(cs,f,rule("di_cross",side,exit),opts(cs.length,delay));
  assert.deepEqual(a.stats,b.stats);assert.deepEqual(a.monthly,b.monthly);assert.deepEqual(a.open,b.open);
  assert.deepEqual(a.trades,b.trades.map(t=>({...t,entryFeature:t.entryFeature?without(t.entryFeature):null})));
  if(exit==="fixed12h"){const x=runStandalone(cs,oldFs,{id:"old",family:"clock",side,exit},opts(cs.length,delay)),y=runAdxDmiStandalone(cs,oldFs,{...rule("di_cross",side,exit),family:"clock"},opts(cs.length,delay));assert.deepEqual(x.stats,y.stats);assert.deepEqual(x.trades,y.trades);assert.deepEqual(x.monthly,y.monthly);}
 }
});
test("subsequent DI exits in both directions, fees and delays, timeout priority and pending cutoff",()=>{
 for(const tf of TF)for(const delay of [0,M])for(const side of ["long","short"] as const)for(const {mode,threshold}of defs){
  const sign=side==="long"?1:-1;
  const spread=mode==="di_cross"||mode==="di_strong"?[-10,0,10,0].map(v=>v*sign):[1,1,1,0].map(v=>v*(mode==="adx_peak_fade"?-10:10)*sign);
  const adx=mode==="adx_peak_fade"?[threshold-1,threshold,threshold-1,threshold-2]:mode==="adx_cross"?[threshold-1,threshold,threshold+1,threshold+2]:[30,30,threshold,threshold];
  const f=features(spread,adx,tf),r=rule(mode,side,"indicator_or12h",tf,14,threshold),n=tf/M+3;
  const out=runAdxDmiStandalone(tape(n,i=>({open:i===tf/M+delay/M?110:100})),f,r,opts(n,delay));
  assert.equal(out.trades.length,1);const t=out.trades[0];assert.equal(t.entryAt,T+delay);assert.equal(t.exitAt,T+tf+delay);near(t.pricePnl,sign*100);near(t.fees,2.1);
 }
 const r=rule("di_cross","long","indicator_or12h"),f=features([-10,0,10,...Array(11).fill(10),0]);
 assert.equal(runAdxDmiStandalone(tape(723),f,r,opts(723)).trades[0].reason,"timeout");
 const g=features([-10,0,10,0,10],undefined,5*M),r5={...r,timeframeMs:5*M};
 const pe=runAdxDmiStandalone(tape(1),g,r5,opts(1,M));assert(pe.stats.pendingAtEnd);assert.equal(pe.open,null);
 const px=runAdxDmiStandalone(tape(6),g,r5,opts(6,M));assert(px.stats.pendingAtEnd);assert(px.open);
 const re=runAdxDmiStandalone(tape(11),g,r5,opts(11));assert.equal(re.trades[0].exitAt,T+5*M);assert.equal(re.open!.entryAt,T+10*M);
 const hold=runAdxDmiStandalone(tape(11),g,{...r5,exit:"fixed12h"},opts(11));assert.equal(hold.stats.skippedOccupied,1);
});
test("future prefix, immutable delayed exits, unrelated indicator fields and invalid tape",()=>{
 const cs=tape(70),f=features([-10,0,10,-10,10,-10,10],undefined,15*M),r=rule("di_cross","long","indicator_or12h",15*M);
 assert.deepEqual(runAdxDmiStandalone(cs,f,r,opts(31)),runAdxDmiStandalone(cs.slice(0,31),f.filter(x=>x.barEnd<=T+31*M),r,opts(31)));
 const a=runAdxDmiStandalone(cs,f,r,opts(70,M)),b=runAdxDmiStandalone(cs.map(c=>({...c,high:1000,low:1})),f.map(x=>({...x,feature:{...x.feature,roc5:999,crsi:0,rsi14:100,adx14:0}})),r,opts(70,M));
 assert.deepEqual(a.trades.map(({entryFeature,...t})=>t),b.trades.map(({entryFeature,...t})=>t));assert.deepEqual(a.open,b.open);
 assert.equal(a.trades[0].exitAt,T+16*M);assert.throws(()=>runAdxDmiStandalone(cs,f,{...r,period:15},opts(70)));
 assert.throws(()=>runAdxDmiStandalone(cs.filter((_,i)=>i!==9),f,r,opts(70)));
});
console.log(`ADX/DMI tests passed (${groups} groups;540 rule boundaries)`);
