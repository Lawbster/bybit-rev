import assert from "assert/strict";
import { MACD } from "technicalindicators";
import { computeMacdValues } from "../src/research/macd-features";
import { macdEntrySignal,macdExitSignal,runMacdStandalone,type MacdRule,type MacdFeatureBar } from "./macd-standalone-engine";
import {runStandalone,type FeatureBar,type StandaloneOptions} from "./indicator-standalone-engine";
import type {Candle} from "../src/fetch-candles";
const M=60000,H=60*M,T=Date.UTC(2026,7,1),TF=[5*M,15*M,30*M,H,4*H],PRESETS=[[6,13,5],[12,26,9],[24,52,18]];
let groups=0;const test=(name:string,f:()=>void)=>{f();groups++;console.log("PASS "+name);};
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const rule=(mode:MacdRule["mode"]="signal_cross",side:MacdRule["side"]="long",exit:MacdRule["exit"]="fixed12h",tf=H,p=[12,26,9]):MacdRule=>
({id:"fixture",family:"macd",mode,side,exit,timeframeMs:tf,fastPeriod:p[0],slowPeriod:p[1],signalPeriod:p[2]});
function features(hist:Array<number|null>,tf=H,p=[12,26,9],lines?:Array<number|null>):MacdFeatureBar[]{
 return hist.map((v,i)=>{const timestamp=T+(i-3)*tf,line=lines?lines[i]:v;
 return {candle:{timestamp,open:100,high:101,low:99,close:100,volume:10,turnover:1000},
  barEnd:timestamp+tf,availableAt:timestamp+tf,feature:{timestamp,rsi14:null,crsi:null,roc5:v,atr14:null,atrPct:null,
   adx14:null,plusDI14:null,minusDI14:null,vwapUtcDay:null,rvol20:null,
   macdLine:line,macdSignal:v===null||line===null?null:line-v,macdHist:v,
   macdFastEma:line===null?null:100+line/2,macdSlowEma:line===null?null:100-line/2,
   macdFastPeriod:p[0],macdSlowPeriod:p[1],macdSignalPeriod:p[2]}};
 });
}
const tape=(n:number,f:(i:number)=>Partial<Candle>=()=>({})):Candle[]=>Array.from({length:n},(_,i)=>{const o=f(i),open=o.open??100,close=o.close??open;
return {timestamp:T+i*M,open,high:Math.max(open,close)+1,low:Math.min(open,close)-1,close,volume:10,turnover:1000,...o};});
const opts=(n:number,delayMs=0):StandaloneOptions=>({start:T,end:T+n*M,delayMs,holdMs:12*H,notional:1000,equity:10000,feeRate:.001});
const withoutMacd=(feature:any):FeatureBar["feature"]=>{const {macdFastEma,macdSlowEma,macdLine,macdSignal,macdHist,macdFastPeriod,macdSlowPeriod,macdSignalPeriod,...old}=feature;return old;};
test("SMA seeds, exact warmup, independent weighted-sum EMA and library agreement",()=>{
 const weighted=(xs:number[],n:number):Array<number|null>=>xs.map((_,i)=>{
  if(i<n-1)return null;const seed=xs.slice(0,n).reduce((a,b)=>a+b,0)/n,alpha=2/(n+1);
  let v=seed*Math.pow(1-alpha,i-n+1);for(let j=n;j<=i;j++)v+=alpha*Math.pow(1-alpha,i-j)*xs[j];return v;
 });
 for(const tf of TF)for(const p of PRESETS){
  const cs=Array.from({length:240},(_,i)=>({timestamp:T+i*tf,close:70+.03*i+Math.sin(i*.47)*5+Math.cos(i*.1)*2}));
  const v=computeMacdValues(cs,tf,...p as [number,number,number]),f=weighted(cs.map(x=>x.close),p[0]),s=weighted(cs.map(x=>x.close),p[1]);
  const lines=cs.slice(p[1]-1).map((_,i)=>f[i+p[1]-1]!-s[i+p[1]-1]!),sig=weighted(lines,p[2]);
  const external=MACD.calculate({values:cs.map(x=>x.close),fastPeriod:p[0],slowPeriod:p[1],signalPeriod:p[2],SimpleMAOscillator:false,SimpleMASignal:false});
  v.forEach((x,i)=>{
   if(i<p[0]-1)assert.equal(x.macdFastEma,null);else near(x.macdFastEma!,f[i]!);
   if(i<p[1]-1){assert.equal(x.macdLine,null);assert.equal(x.macdSignal,null);return;}
   near(x.macdSlowEma!,s[i]!);near(x.macdLine!,lines[i-p[1]+1]);near(x.macdLine!,external[i-p[1]+1].MACD!);
   if(i<p[1]+p[2]-2){assert.equal(x.macdSignal,null);assert.equal(x.macdHist,null);}
   else {near(x.macdSignal!,sig[i-p[1]+1]!);near(x.macdSignal!,external[i-p[1]+1].signal!);near(x.macdHist!,x.macdLine!-x.macdSignal!);}
  });
  assert.deepEqual(computeMacdValues(cs.slice(0,100),tf,...p as [number,number,number]),v.slice(0,100));
 }
});
test("true zero, linear-ramp equilibrium, price-unit scaling and no silent gap reseed",()=>{
 const cs=Array.from({length:100},(_,i)=>({timestamp:T+i*H,close:100}));
 const zero=computeMacdValues(cs,H,12,26,9);assert.deepEqual(zero[33],{macdFastEma:100,macdSlowEma:100,macdLine:0,macdSignal:0,macdHist:0});
 const linear=computeMacdValues(cs.map((c,i)=>({...c,close:100+i})),H,12,26,9);
 near(linear[33].macdLine!,7);near(linear[33].macdSignal!,7);near(linear[33].macdHist!,0);
 const varying=cs.map((c,i)=>({...c,close:100+Math.sin(i)*5})),a=computeMacdValues(varying,H,12,26,9),b=computeMacdValues(varying.map(c=>({...c,close:c.close*10})),H,12,26,9);
 a.forEach((x,i)=>{if(x.macdHist!==null)near(b[i].macdHist!,10*x.macdHist);});
 assert.throws(()=>computeMacdValues(cs.filter((_,i)=>i!==40),H,12,26,9));
 assert.throws(()=>computeMacdValues([...cs,cs[99]],H,12,26,9));
 assert.throws(()=>computeMacdValues(cs.map((c,i)=>({...c,close:i===30?0:c.close})),H,12,26,9));
 assert.throws(()=>computeMacdValues(cs,H,26,12,9));
});
test("all300 rule boundaries; intrinsic trend signs and three-bar slope turns",()=>{
 let count=0;for(const tf of TF)for(const p of PRESETS)
 for(const mode of ["signal_cross","signal_trend","signal_counter","zero_cross","hist_turn"] as const)
 for(const side of ["long","short"] as const)for(const exit of ["fixed12h","indicator_or12h"] as const){
  const sign=side==="long"?1:-1,h=(mode==="hist_turn"?[-1,-2,-1]:[-1,0,1]).map(x=>x*sign);
  const lines=h.map(()=>sign*(mode==="signal_counter"?-1:1));if(mode==="zero_cross")lines.splice(0,3,...h);
  const f=features(h,tf,p,lines),r=rule(mode,side,exit,tf,p);assert(macdEntrySignal(r,f[1],f[2],f[0]));
  assert(!macdEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,macdHist:f[1].feature.macdHist,macdLine:f[1].feature.macdLine} as MacdFeatureBar["feature"]},f[0]));
  if(mode==="signal_trend"||mode==="signal_counter")assert(!macdEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,macdLine:0} as MacdFeatureBar["feature"]},f[0]));
  if(mode==="hist_turn")assert(!macdEntrySignal(r,f[1],f[2]));
  count++;
 }assert.equal(count,300);
});
test("warmup/null/stale provenance; zero-line does not need an unready signal EMA",()=>{
 const f=features([null,null,null],H,[12,26,9],[-1,0,1]);
 assert(macdEntrySignal(rule("zero_cross"),f[1],f[2],f[0]));assert(!macdEntrySignal(rule(),f[1],f[2],f[0]));
 const g=features([-1,0,1]);assert(!macdEntrySignal(rule(),g[1],{...g[2],availableAt:g[2].barEnd-1},g[0]));
 assert(!macdEntrySignal(rule(),g[1],{...g[2],feature:{...g[2].feature,macdFastPeriod:6} as MacdFeatureBar["feature"]},g[0]));
 for(const bad of [null,NaN,Infinity])assert(!macdEntrySignal(rule(),g[1],{...g[2],feature:{...g[2].feature,macdHist:bad} as MacdFeatureBar["feature"]},g[0]));
});
test("old clocks and synthetic forced-cross paths preserve complete minute accounting",()=>{
 const cs=tape(36*60+3,i=>({open:100+Math.sin(i/50)*5})),f=features(Array.from({length:42},(_,i)=>[-2,0,1,2,-1][i%5]));
 const oldFs=f.map(x=>({...x,feature:withoutMacd(x.feature)})) as FeatureBar[];
 for(const side of ["long","short"] as const)for(const delay of [0,M])for(const exit of ["fixed12h","indicator_or12h"] as const){
  const a=runStandalone(cs,oldFs,{id:"old",family:"roc_cross",side,exit},opts(cs.length,delay)),b=runMacdStandalone(cs,f,rule("signal_cross",side,exit),opts(cs.length,delay));
  assert.deepEqual(a.stats,b.stats);assert.deepEqual(a.monthly,b.monthly);assert.deepEqual(a.open,b.open);
  assert.deepEqual(a.trades,b.trades.map(t=>({...t,entryFeature:t.entryFeature?withoutMacd(t.entryFeature):null})));
  if(exit==="fixed12h"){const x=runStandalone(cs,oldFs,{id:"old",family:"clock",side,exit},opts(cs.length,delay)),y=runMacdStandalone(cs,oldFs,{...rule("signal_cross",side,exit),family:"clock"},opts(cs.length,delay));
   assert.deepEqual(x.stats,y.stats);assert.deepEqual(x.trades,y.trades);assert.deepEqual(x.monthly,y.monthly);}
 }
});
test("mode-specific exits, subsequent-bar requirement and action delays",()=>{
 for(const tf of TF)for(const delay of [0,M])for(const mode of ["signal_cross","zero_cross","hist_turn"] as const)
 for(const side of ["long","short"] as const){
  const sign=side==="long"?1:-1,values=(mode==="hist_turn"?[-1,-2,-1,0]:[-1,0,1,0]).map(x=>x*sign),f=features(values,tf);
  const r=rule(mode,side,"indicator_or12h",tf),n=tf/M+3,out=runMacdStandalone(tape(n,i=>({open:i===tf/M+delay/M?110:100})),f,r,opts(n,delay));
  assert.equal(out.trades.length,1);const t=out.trades[0];assert.equal(t.entryAt,T+delay);assert.equal(t.exitAt,T+tf+delay);assert.equal(t.reason,"indicator");near(t.pricePnl,sign*100);near(t.fees,2.1);
 }
});
test("timeout wins ties, occupied signals skipped, fresh cross and pending cutoff",()=>{
 const f=features([-1,0,1,...Array(11).fill(1),0]),r=rule("signal_cross","long","indicator_or12h");
 assert.equal(runMacdStandalone(tape(12*60+3),f,r,opts(12*60+3)).trades[0].reason,"timeout");
 const g=features([-1,0,1,0,1],5*M),r5=rule("signal_cross","long","indicator_or12h",5*M);
 const out=runMacdStandalone(tape(11),g,r5,opts(11));assert.equal(out.trades[0].exitAt,T+5*M);assert.equal(out.open!.entryAt,T+10*M);
 const pe=runMacdStandalone(tape(1),g,r5,opts(1,M));assert(pe.stats.pendingAtEnd);assert.equal(pe.open,null);
 const px=runMacdStandalone(tape(6),g,r5,opts(6,M));assert(px.stats.pendingAtEnd);assert(px.open);
});
test("prefix invariance, immutable delayed exit and independence from unrelated inputs",()=>{
 const cs=tape(70),f=features([-1,0,1,-1,1,-1,1],15*M),r=rule("signal_cross","long","indicator_or12h",15*M);
 assert.deepEqual(runMacdStandalone(cs,f,r,opts(31)),runMacdStandalone(cs.slice(0,31),f.filter(x=>x.barEnd<=T+31*M),r,opts(31)));
 const a=runMacdStandalone(cs,f,r,opts(70,M)),b=runMacdStandalone(cs.map(c=>({...c,high:1000,low:1})),f.map(x=>({...x,feature:{...x.feature,roc5:999,crsi:0,rsi14:100}})),r,opts(70,M));
 assert.deepEqual(a.trades.map(({entryFeature,...t})=>t),b.trades.map(({entryFeature,...t})=>t));assert.deepEqual(a.open,b.open);
 assert.equal(a.trades[0].exitAt,T+16*M);
 assert.throws(()=>runMacdStandalone(cs,f,{...r,fastPeriod:7},opts(70)));
 assert.throws(()=>runMacdStandalone(cs.filter((_,i)=>i!==9),f,r,opts(70)));
});
console.log(`MACD tests passed (${groups} groups;300 rule boundaries, independent math, timing and prior accounting)`);
