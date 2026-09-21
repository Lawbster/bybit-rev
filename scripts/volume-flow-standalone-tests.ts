import assert from "assert/strict";
import {OBV,MFI} from "technicalindicators";
import {referenceVolumeFlow} from "./volume-flow-standalone-results-check";
import {ClosedBarSeries} from "../src/research/closed-bars";
import {computeVolumeFlowValues,type VolumeFlowFamily} from "../src/research/volume-flow-features";
import {computeResearchFeatures} from "../src/research/indicator-features";
import {volumeFlowEntrySignal,volumeFlowExitSignal,runVolumeFlowStandalone,type VolumeFlowRule,type VolumeFlowFeatureBar} from "./volume-flow-standalone-engine";
import {runStandalone,type FeatureBar,type StandaloneOptions} from "./indicator-standalone-engine";
import type {Candle} from "../src/fetch-candles";
const M=60000,H=60*M,T=Date.UTC(2026,7,1),TF=[5*M,15*M,30*M,H,4*H];
const P=[{"family":"obv","period":10,"levels":[{"mode":"trend","thresholds":[0,0.25,0.5,0.75]},{"mode":"into","thresholds":[0.25,0.5,0.75]},{"mode":"recovery","thresholds":[0.25,0.5,0.75]}]},{"family":"obv","period":20,"levels":[{"mode":"trend","thresholds":[0,0.25,0.5,0.75]},{"mode":"into","thresholds":[0.25,0.5,0.75]},{"mode":"recovery","thresholds":[0.25,0.5,0.75]}]},{"family":"obv","period":40,"levels":[{"mode":"trend","thresholds":[0,0.25,0.5,0.75]},{"mode":"into","thresholds":[0.25,0.5,0.75]},{"mode":"recovery","thresholds":[0.25,0.5,0.75]}]},{"family":"mfi","period":7,"levels":[{"mode":"trend","thresholds":[0,0.2,0.6,0.8]},{"mode":"into","thresholds":[0.6,0.8,0.9]},{"mode":"recovery","thresholds":[0.6,0.8,0.9]}]},{"family":"mfi","period":14,"levels":[{"mode":"trend","thresholds":[0,0.2,0.6,0.8]},{"mode":"into","thresholds":[0.6,0.8,0.9]},{"mode":"recovery","thresholds":[0.6,0.8,0.9]}]},{"family":"mfi","period":28,"levels":[{"mode":"trend","thresholds":[0,0.2,0.6,0.8]},{"mode":"into","thresholds":[0.6,0.8,0.9]},{"mode":"recovery","thresholds":[0.6,0.8,0.9]}]},{"family":"cmf","period":10,"levels":[{"mode":"trend","thresholds":[0,0.05,0.2,0.5]},{"mode":"into","thresholds":[0.05,0.2,0.5]},{"mode":"recovery","thresholds":[0.05,0.2,0.5]}]},{"family":"cmf","period":20,"levels":[{"mode":"trend","thresholds":[0,0.05,0.2,0.5]},{"mode":"into","thresholds":[0.05,0.2,0.5]},{"mode":"recovery","thresholds":[0.05,0.2,0.5]}]},{"family":"cmf","period":40,"levels":[{"mode":"trend","thresholds":[0,0.05,0.2,0.5]},{"mode":"into","thresholds":[0.05,0.2,0.5]},{"mode":"recovery","thresholds":[0.05,0.2,0.5]}]}] as const;
let groups=0;const test=(s:string,f:()=>void)=>{f();groups++;console.log("PASS "+s);};
const near=(a:number,b:number,tol=1e-8)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
const rule=(mode:VolumeFlowRule["mode"]="trend",side:VolumeFlowRule["side"]="long",exit:VolumeFlowRule["exit"]="fixed12h",tf=H,n=20,threshold=0,family:VolumeFlowFamily="obv"):VolumeFlowRule=>
({id:"fixture",family,timeframeMs:tf,period:n,threshold,mode,side,exit});
function features(vals:Array<number|null>,tf=H,n=20,family:VolumeFlowFamily="obv"):VolumeFlowFeatureBar[]{
 return vals.map((v,i)=>{const timestamp=T+(i-3)*tf,close=100;
 return {candle:{timestamp,open:close,high:101,low:99,close,volume:10,turnover:1000},barEnd:timestamp+tf,availableAt:timestamp+tf,
 feature:{timestamp,rsi14:null,crsi:null,roc5:v,atr14:null,atrPct:null,adx14:null,plusDI14:null,minusDI14:null,vwapUtcDay:null,rvol20:null,
 vfRawObv:null,vfPositive:null,vfNegative:null,vfVolume:null,vfNumerator:null,vfDenominator:null,vfValue:v,vfSigned:v,vfPeriod:n,vfFamily:family==="obv"?1:family==="mfi"?2:3}};
 });
}
const tape=(n:number,f:(i:number)=>Partial<Candle>=()=>({})):Candle[]=>Array.from({length:n},(_,i)=>{const o=f(i),open=o.open??100,close=o.close??open;
return {timestamp:T+i*M,open,high:Math.max(open,close)+1,low:Math.min(open,close)-1,close,volume:10,turnover:1000,...o};});
const opts=(n:number,delayMs=0):StandaloneOptions=>({start:T,end:T+n*M,delayMs,holdMs:12*H,notional:1000,equity:10000,feeRate:.001});
const without=(f:any):FeatureBar["feature"]=>{const {vfRawObv,vfPositive,vfNegative,vfVolume,vfNumerator,vfDenominator,vfValue,vfSigned,vfPeriod,vfFamily,...old}=f;return old;};
function varying(tf:number,count=220):Candle[]{
 return Array.from({length:count},(_,i)=>{const close=80+.01*i+Math.sin(i*.47)*5+Math.cos(i*.1)*2;
 return {timestamp:T+i*tf,open:close,high:close+1+i%3*.1,low:close-1-i%2*.2,close,volume:10,turnover:10*close};});
}

test("hand OBV cumulative seed, ties, all-volume denominator, balanced zero and no-volume null",()=>{
 const cs=[10,11,11,10,12].map((c,i)=>({...tape(1)[0],timestamp:T+i*H,open:c,high:c,low:c,close:c,volume:[5,2,3,4,6][i]}));
 const x=computeVolumeFlowValues(cs,H,"obv",2);assert.deepEqual(x.map(v=>v.vfRawObv),[0,2,2,-2,4]);
 assert.equal(x[1].vfSigned,null);near(x[2].vfSigned!,2/5);near(x[3].vfSigned!,-4/7);near(x[4].vfSigned!,2/10);
 const equal=cs.map(c=>({...c,volume:2}));assert.equal(computeVolumeFlowValues(equal,H,"obv",4)[4].vfSigned,.25);
 const balanced=[10,11,10].map((c,i)=>({...cs[i],open:c,high:c,low:c,close:c,volume:2}));
 assert.equal(computeVolumeFlowValues(balanced,H,"obv",2)[2].vfSigned,0);
 assert.equal(computeVolumeFlowValues(cs.map(c=>({...c,volume:0})),H,"obv",2)[4].vfSigned,null);
});
test("MFI typical rather than close direction, unchanged typical excluded, 100/0/50/null",()=>{
 const build=(prices:number[],vols:number[])=>prices.map((c,i)=>({...tape(1)[0],timestamp:T+i*H,open:c,high:c,low:c,close:c,volume:vols[i]}));
 const cs=build([10,12,11,11],[1,2,3,100]),x=computeVolumeFlowValues(cs,H,"mfi",2);
 assert.equal(x[1].vfValue,null);near(x[2].vfPositive!,24);near(x[2].vfNegative!,33);near(x[2].vfValue!,100*24/57);
 assert.equal(x[3].vfValue,0);assert.equal(x[3].vfDenominator,33);assert.equal(x[3].vfVolume,103);
 assert.equal(computeVolumeFlowValues(build([10,11,12],[1,1,1]),H,"mfi",2)[2].vfValue,100);
 assert.equal(computeVolumeFlowValues(build([12,11,10],[1,1,1]),H,"mfi",2)[2].vfValue,0);
 const z=computeVolumeFlowValues(build([10,12,11],[1,11,12]),H,"mfi",2)[2];assert.equal(z.vfValue,50);assert.equal(z.vfSigned,0);
 assert.equal(computeVolumeFlowValues(build([10,10,10],[1,1,1]),H,"mfi",2)[2].vfValue,null);
 const opposite=build([10,11],[1,1]);opposite[0]={...opposite[0],high:20};
 assert(opposite[1].close>opposite[0].close);
 assert.equal(computeVolumeFlowValues(opposite,H,"mfi",1)[1].vfValue,0);
 for(const percent of [5,10,20,50,80,90,95]){
   const out=computeVolumeFlowValues(build([10,12,11],[1,percent/12,(100-percent)/11]),H,"mfi",2)[2];
   near(out.vfValue!,percent);near(out.vfSigned!,(2*percent-100)/100);
 }
});
test("CMF hand high/low/midpoint, zero range volume retained, gap down can still read positive",()=>{
 const c=(i:number,low:number,high:number,close:number,volume=1):Candle=>({timestamp:T+i*H,open:close,high,low,close,volume,turnover:close*volume});
 const cs=[c(0,10,12,12,2),c(1,10,12,10,1),c(2,10,12,11,1),c(3,11,11,11,6)];
 const out=computeVolumeFlowValues(cs,H,"cmf",4);assert.equal(out[2].vfValue,null);near(out[3].vfValue!,.1);
 assert.equal(computeVolumeFlowValues([c(0,10,10,10)],H,"cmf",1)[0].vfValue,0);
 assert.equal(computeVolumeFlowValues([c(0,10,10,10,0)],H,"cmf",1)[0].vfValue,null);
 assert.equal(computeVolumeFlowValues([c(0,100,101,101),c(1,80,81,81)],H,"cmf",1)[1].vfValue,1);
});
test("all nine parameter sets / five clocks independent OHLCV reference and external raw OBV",()=>{
 const minutes=tape(4*60*65,i=>{const close=80+Math.sin(i*.03)*3+Math.cos(i*.005);return{open:close,close,volume:1+i%17};});
 for(const tf of TF){
  const bars=ClosedBarSeries.fromHistorical(minutes,{sourceIntervalMs:M,targetIntervalMs:tf,publicationLagMs:0}).bars.map(b=>b.candle);
  for(const p of P){
   const out=computeVolumeFlowValues(bars,tf,p.family,p.period),ref=referenceVolumeFlow(minutes.map(c=>({...c,ts:c.timestamp})),tf,p.family,p.period);
   assert.equal(out.length,ref.size);
   out.forEach((x,i)=>{const expected=ref.get(bars[i].timestamp);for(const [k,v]of Object.entries(x)){if(v===null)assert.equal(expected[k],null);else near(v,expected[k],1e-7);}});
   assert.deepEqual(computeVolumeFlowValues(bars.slice(0,55),tf,p.family,p.period),out.slice(0,55));
   if(p.family==="obv")assert.deepEqual(out.slice(1).map(x=>x.vfRawObv),OBV.calculate({close:bars.map(b=>b.close),volume:bars.map(b=>b.volume)}));
  }
 }
});
test("MFI library convention differences explicit: later first output, ties negative and two-decimal rounding",()=>{
 const cs=varying(H).map((c,i)=>({...c,volume:10+i%7}));
 for(const n of [7,14,28]){
  const exact=computeVolumeFlowValues(cs,H,"mfi",n);
  const lib=MFI.calculate({high:cs.map(c=>c.high),low:cs.map(c=>c.low),close:cs.map(c=>c.close),volume:cs.map(c=>c.volume),period:n});
  assert.equal(lib.length,cs.length-n-1);
  lib.forEach((v,i)=>near(v,Number(exact[i+n+1].vfValue!.toFixed(2)),.000001));
 }
 const flat=tape(20).map((c,i)=>({...c,timestamp:T+i*H}));
 assert.equal(computeVolumeFlowValues(flat,H,"mfi",7)[10].vfValue,null);
 assert.equal(MFI.calculate({high:flat.map(c=>c.high),low:flat.map(c=>c.low),close:flat.map(c=>c.close),volume:flat.map(c=>c.volume),period:7})[0],0);
});
test("ratios scale invariant, OBV/CMF translate/mirror, OBV suffix seed independent; MFI not translation invariant",()=>{
 const cs=varying(H).map((c,i)=>({...c,volume:1+i%7}));
 for(const p of P){
  const a=computeVolumeFlowValues(cs,H,p.family,p.period);
  for(const [ps,vs]of [[10,1],[1,10]]){
   const b=computeVolumeFlowValues(cs.map(c=>({...c,open:c.open*ps,high:c.high*ps,low:c.low*ps,close:c.close*ps,volume:c.volume*vs})),H,p.family,p.period);
   a.forEach((x,i)=>{if(x.vfSigned!==null){near(x.vfSigned,b[i].vfSigned!);near(x.vfValue!,b[i].vfValue!);}});
  }
  if(p.family!=="mfi"){
   const shift=computeVolumeFlowValues(cs.map(c=>({...c,open:c.open+200,close:c.close+200,high:c.high+200,low:c.low+200})),H,p.family,p.period);
   const mirror=computeVolumeFlowValues(cs.map(c=>({...c,open:200-c.open,close:200-c.close,high:200-c.low,low:200-c.high})),H,p.family,p.period);
   a.forEach((x,i)=>{if(x.vfSigned!==null){near(x.vfSigned,shift[i].vfSigned!);near(x.vfSigned,-mirror[i].vfSigned!);}});
  }
  const suffix=computeVolumeFlowValues(cs.slice(50),H,p.family,p.period);
  for(let j=p.period;j<suffix.length;j++)near(suffix[j].vfSigned!,a[j+50].vfSigned!);
  assert.throws(()=>computeVolumeFlowValues(cs.filter((_,i)=>i!==40),H,p.family,p.period));
  for(const field of ["volume","close"])for(const value of [NaN,Infinity,-1])assert.throws(()=>computeVolumeFlowValues(cs.map((c,i)=>i===3?{...c,[field]:value}:c),H,p.family,p.period));
  assert.throws(()=>computeVolumeFlowValues(cs.map((c,i)=>i===3?{...c,low:c.high+1}:c),H,p.family,p.period));
 }
 const a=computeVolumeFlowValues(cs,H,"mfi",14),b=computeVolumeFlowValues(cs.map(c=>({...c,open:c.open+200,close:c.close+200,high:c.high+200,low:c.low+200})),H,"mfi",14);
 assert(a.some((x,i)=>x.vfSigned!==null&&Math.abs(x.vfSigned-b[i].vfSigned!)>1e-5));
 assert.throws(()=>computeVolumeFlowValues(cs,H,"obv",0));assert.throws(()=>computeVolumeFlowValues(cs,H,"obv",1.5));
});

test("all1800 rule boundaries: fresh crossing, equality, sign, null and stale parameter/availability",()=>{
 let count=0;
 for(const tf of TF)for(const p of P)for(const {mode,thresholds} of p.levels)for(const k of thresholds)for(const side of ["long","short"] as const)for(const exit of ["fixed12h","indicator_or12h"] as const){
  const sign=side==="long"?1:-1,prev=mode==="trend"?k:-k,cur=prev+(mode==="into"?-.01:.01);
  const f=features([prev,prev,cur].map(v=>v*sign),tf,p.period,p.family),r=rule(mode,side,exit,tf,p.period,k,p.family);
  assert(volumeFlowEntrySignal(r,f[1],f[2]));
  assert(!volumeFlowEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,vfSigned:prev*sign}} as VolumeFlowFeatureBar));
  assert(!volumeFlowEntrySignal(r,{...f[1],feature:{...f[1].feature,vfSigned:cur*sign}} as VolumeFlowFeatureBar,f[2]));
  for(const bad of [null,NaN,Infinity])assert(!volumeFlowEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,vfSigned:bad}} as VolumeFlowFeatureBar));
  assert(!volumeFlowEntrySignal(r,f[1],{...f[2],availableAt:f[2].barEnd-1}));
  assert(!volumeFlowEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,vfPeriod:99}} as VolumeFlowFeatureBar));
  assert(!volumeFlowEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,vfFamily:99}} as VolumeFlowFeatureBar));
  assert(!volumeFlowEntrySignal(r,undefined,f[2]));count++;
 }assert.equal(count,1800);
});
test("eight forced-ROC ledgers and four clock cases retain old exact accounting",()=>{
 const cs=tape(36*60+3,i=>({open:100+Math.sin(i/50)*5}));
 for(const side of ["long","short"] as const)for(const delay of [0,M])for(const exit of ["fixed12h","indicator_or12h"] as const){
  const f=features(Array.from({length:42},(_,i)=>i%3===0?-1:1)),oldFs=f.map(x=>({...x,feature:without(x.feature)}));
  const a=runStandalone(cs,oldFs,{id:"old",family:"roc_cross",side,exit},opts(cs.length,delay));
  const b=runVolumeFlowStandalone(cs,f,rule("trend",side,exit),opts(cs.length,delay));
  assert.deepEqual(a.stats,b.stats);assert.deepEqual(a.monthly,b.monthly);assert.deepEqual(a.open,b.open);
  assert.deepEqual(a.trades,b.trades.map(t=>({...t,entryFeature:t.entryFeature?without(t.entryFeature):null})));
  if(exit==="fixed12h"){
   const x=runStandalone(cs,oldFs,{id:"old",family:"clock",side,exit},opts(cs.length,delay));
   const y=runVolumeFlowStandalone(cs,oldFs,{...rule("trend",side,exit),family:"clock",period:14,threshold:0},opts(cs.length,delay));
   assert.deepEqual(x.stats,y.stats);assert.deepEqual(x.trades,y.trades);assert.deepEqual(x.monthly,y.monthly);
  }
 }
});
test("every definition zero exit and delays; actual-notional fees, timeout tie, pending cutoff and rearm",()=>{
 for(const tf of TF)for(const p of P)for(const {mode,thresholds} of p.levels)for(const k of thresholds)for(const side of ["long","short"] as const)for(const delay of [0,M]){
  const sign=side==="long"?1:-1,prev=mode==="trend"?k:-k,cur=prev+(mode==="into"?-.01:.01);
  const f=features([prev,prev,cur,0].map(v=>v*sign),tf,p.period,p.family),r=rule(mode,side,"indicator_or12h",tf,p.period,k,p.family),n=tf/M+3;
  const out=runVolumeFlowStandalone(tape(n,i=>({open:i===tf/M+delay/M?110:100})),f,r,opts(n,delay));
  assert.equal(out.trades.length,1);const t=out.trades[0];assert.equal(t.entryAt,T+delay);assert.equal(t.exitAt,T+tf+delay);near(t.pricePnl,sign*100);near(t.fees,2.1);
 }
 const r=rule("trend","long","indicator_or12h"),f=features([-1,0,1,...Array(11).fill(1),0]);
 assert.equal(runVolumeFlowStandalone(tape(723),f,r,opts(723)).trades[0].reason,"timeout");
 const g=features([-1,0,1,0,1],5*M),r5={...r,timeframeMs:5*M};
 const pe=runVolumeFlowStandalone(tape(1),g,r5,opts(1,M));assert(pe.stats.pendingAtEnd);assert.equal(pe.open,null);
 const px=runVolumeFlowStandalone(tape(6),g,r5,opts(6,M));assert(px.stats.pendingAtEnd);assert(px.open);
 const re=runVolumeFlowStandalone(tape(11),g,r5,opts(11));assert.equal(re.trades[0].exitAt,T+5*M);assert.equal(re.open!.entryAt,T+10*M);
 assert.equal(runVolumeFlowStandalone(tape(11),g,{...r5,exit:"fixed12h"},opts(11)).stats.skippedOccupied,1);
});
test("future exclusion, immutable pending exits, unrelated fields ignored and invalid tape rejected",()=>{
 const cs=tape(70),f=features([-1,0,1,-1,1,-1,1],15*M),r=rule("trend","long","indicator_or12h",15*M);
 assert.deepEqual(runVolumeFlowStandalone(cs,f,r,opts(31)),runVolumeFlowStandalone(cs.slice(0,31),f.filter(x=>x.barEnd<=T+31*M),r,opts(31)));
 const a=runVolumeFlowStandalone(cs,f,r,opts(70,M)),b=runVolumeFlowStandalone(cs.map(c=>({...c,high:1000,low:1})),f.map(x=>({...x,feature:{...x.feature,roc5:999,crsi:0,rsi14:100,adx14:0}})),r,opts(70,M));
 assert.deepEqual(a.trades.map(({entryFeature,...t})=>t),b.trades.map(({entryFeature,...t})=>t));assert.deepEqual(a.open,b.open);
 assert.equal(a.trades[0].exitAt,T+16*M);assert.throws(()=>runVolumeFlowStandalone(cs,f,{...r,period:15},opts(70)));
 assert.throws(()=>runVolumeFlowStandalone(cs.filter((_,i)=>i!==9),f,r,opts(70)));
});
console.log(`OBV/MFI/CMF tests passed (${groups} groups;1800 boundaries)`);
