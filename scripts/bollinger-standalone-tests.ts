import assert from "assert/strict";
import {BollingerBands} from "technicalindicators";
import {computeBollingerValues} from "../src/research/bollinger-features";
import {bollingerEntrySignal,bollingerExitSignal,runBollingerStandalone,type BollingerRule,type BollingerFeatureBar} from "./bollinger-standalone-engine";
import {runStandalone,type FeatureBar,type StandaloneOptions} from "./indicator-standalone-engine";
import type {Candle} from "../src/fetch-candles";
const M=60000,H=60*M,T=Date.UTC(2026,7,1),TF=[5*M,15*M,30*M,H,4*H],PAIRS=[[20,2],[20,3],[50,2],[50,3]];
let groups=0;const test=(s:string,f:()=>void)=>{f();groups++;console.log("PASS "+s);};
const near=(a:number,b:number,tol=1e-8)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
const rule=(mode:BollingerRule["mode"]="breakout",side:BollingerRule["side"]="long",exit:BollingerRule["exit"]="fixed12h",tf=H,p=[20,2]):BollingerRule=>
({id:"fixture",family:"bollinger",timeframeMs:tf,period:p[0],multiplier:p[1],mode,side,exit});
function features(values:Array<number|null>,tf=H,p=[20,2]):BollingerFeatureBar[]{
 return values.map((v,i)=>{const timestamp=T+(i-3)*tf,close=v===null?100:96+8*v;
 return {candle:{timestamp,open:close,high:close+1,low:close-1,close,volume:10,turnover:1000},barEnd:timestamp+tf,availableAt:timestamp+tf,
 feature:{timestamp,rsi14:null,crsi:null,roc5:v,atr14:null,atrPct:null,adx14:null,plusDI14:null,minusDI14:null,vwapUtcDay:null,rvol20:null,
 bbMiddle:v===null?null:100,bbSd:v===null?null:2,bbUpper:v===null?null:104,bbLower:v===null?null:96,bbPercentB:v,
 bbBandwidthPct:v===null?null:8,bbCloseMinusMiddle:v===null?null:close-100,bbPeriod:p[0],bbMultiplier:p[1]}};
 });
}
const tape=(n:number,f:(i:number)=>Partial<Candle>=()=>({})):Candle[]=>Array.from({length:n},(_,i)=>{const o=f(i),open=o.open??100,close=o.close??open;
return {timestamp:T+i*M,open,high:Math.max(open,close)+1,low:Math.min(open,close)-1,close,volume:10,turnover:1000,...o};});
const opts=(n:number,delayMs=0):StandaloneOptions=>({start:T,end:T+n*M,delayMs,holdMs:12*H,notional:1000,equity:10000,feeRate:.001});
const without=(f:any):FeatureBar["feature"]=>{const {bbMiddle,bbSd,bbUpper,bbLower,bbPercentB,bbBandwidthPct,bbCloseMinusMiddle,bbPeriod,bbMultiplier,...old}=f;return old;};

test("population SD, exact warmup, pairwise variance and installed library on all20 clock/parameter pairs",()=>{
 for(const tf of TF)for(const p of PAIRS){
  const cs=Array.from({length:180},(_,i)=>({timestamp:T+i*tf,close:70+.03*i+Math.sin(i*.47)*5+Math.cos(i*.1)*2}));
  const out=computeBollingerValues(cs,tf,p[0],p[1]),external=BollingerBands.calculate({values:cs.map(c=>c.close),period:p[0],stdDev:p[1]});
  out.forEach((x,i)=>{
   if(i<p[0]-1){Object.values(x).forEach(v=>assert.equal(v,null));return;}
   const xs=cs.slice(i-p[0]+1,i+1).map(c=>c.close),mean=xs.reduce((a,b)=>a+b,0)/p[0];let pairs=0;
   for(let a=0;a<xs.length;a++)for(let b=a+1;b<xs.length;b++)pairs+=(xs[a]-xs[b])**2;
   const sd=Math.sqrt(pairs/(p[0]*p[0])),e=external[i-p[0]+1];
   near(x.bbMiddle!,mean);near(x.bbSd!,sd);near(x.bbUpper!,mean+p[1]*sd);near(x.bbLower!,mean-p[1]*sd);
   near(x.bbMiddle!,e.middle);near(x.bbUpper!,e.upper);near(x.bbLower!,e.lower);near(x.bbPercentB!,e.pb);
   near(x.bbBandwidthPct!,100*(x.bbUpper!-x.bbLower!)/mean);near(x.bbCloseMinusMiddle!,cs[i].close-mean);
  });
  assert.deepEqual(computeBollingerValues(cs.slice(0,100),tf,p[0],p[1]),out.slice(0,100));
 }
 const v=computeBollingerValues([1,2,3,4].map((close,i)=>({timestamp:T+i*H,close})),H,4,2)[3];
 near(v.bbSd!,Math.sqrt(1.25));assert(Math.abs(v.bbSd!-Math.sqrt(5/3))>.1);
});
test("zero width is not a crossing; affine/scale behavior, bounded warmup and invalid tape rejection",()=>{
 const cs=Array.from({length:100},(_,i)=>({timestamp:T+i*H,close:100}));
 const flat=computeBollingerValues(cs,H,20,2)[19];
 assert.deepEqual(flat,{bbMiddle:100,bbSd:0,bbUpper:100,bbLower:100,bbPercentB:null,bbBandwidthPct:0,bbCloseMinusMiddle:0});
 const varying=cs.map((c,i)=>({...c,close:100+Math.sin(i)*5})),a=computeBollingerValues(varying,H,20,2);
 for(const [scale,shift]of [[10,0],[1,1e6]]){
  const b=computeBollingerValues(varying.map(c=>({...c,close:c.close*scale+shift})),H,20,2);
  a.forEach((x,i)=>{if(x.bbSd===null)return;near(b[i].bbSd!,x.bbSd*scale);near(b[i].bbMiddle!,x.bbMiddle!*scale+shift);near(b[i].bbPercentB!,x.bbPercentB!);
   if(!shift)near(b[i].bbBandwidthPct!,x.bbBandwidthPct!);
  });
 }
 assert.throws(()=>computeBollingerValues(cs.filter((_,i)=>i!==40),H,20,2));
 assert.throws(()=>computeBollingerValues([...cs,cs[99]],H,20,2));
 assert.throws(()=>computeBollingerValues(cs.map((c,i)=>({...c,close:i===30?0:c.close})),H,20,2));
 assert.throws(()=>computeBollingerValues(cs,H,1,2));assert.throws(()=>computeBollingerValues(cs,H,20,-1));
});
test("all240 grid boundaries: breakout versus fade versus reclaim, strict/equality and stale metadata",()=>{
 let count=0;
 for(const tf of TF)for(const p of PAIRS)for(const mode of ["breakout","into","reclaim"] as const)
 for(const side of ["long","short"] as const)for(const exit of ["fixed12h","indicator_or12h"] as const){
  const v=mode==="breakout"?(side==="long"?[.5,1,1.01]:[.5,0,-.01]):
   mode==="into"?(side==="long"?[.5,.01,0]:[.5,.99,1]):(side==="long"?[.5,0,.01]:[.5,1,.99]);
  const f=features(v,tf,p),r=rule(mode,side,exit,tf,p);
  assert(bollingerEntrySignal(r,f[1],f[2]));
  assert(!bollingerEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,bbPercentB:v[1]}} as BollingerFeatureBar));
  for(const bad of [null,NaN,Infinity])assert(!bollingerEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,bbPercentB:bad}} as BollingerFeatureBar));
  assert(!bollingerEntrySignal(r,f[1],{...f[2],availableAt:f[2].barEnd-1}));
  assert(!bollingerEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,bbPeriod:21}} as BollingerFeatureBar));
  assert(!bollingerEntrySignal(r,undefined,f[2]));count++;
 }assert.equal(count,240);
});
test("old clocks and forced-cross old ROC ledgers preserve complete accounting",()=>{
 const cs=tape(36*60+3,i=>({open:100+Math.sin(i/50)*5}));
 for(const side of ["long","short"] as const)for(const delay of [0,M])for(const exit of ["fixed12h","indicator_or12h"] as const){
  const f=features(Array.from({length:42},(_,i)=>i%3===0?-1:2)).map(x=>({...x,feature:{...x.feature,roc5:x.feature.bbPercentB!-(side==="long"?1:0)}}));
  const oldFs=f.map(x=>({...x,feature:without(x.feature)}));
  const a=runStandalone(cs,oldFs,{id:"old",family:"roc_cross",side,exit},opts(cs.length,delay));
  const b=runBollingerStandalone(cs,f,rule("breakout",side,exit),opts(cs.length,delay));
  assert.deepEqual(a.stats,b.stats);assert.deepEqual(a.monthly,b.monthly);assert.deepEqual(a.open,b.open);
  assert.deepEqual(a.trades,b.trades.map(t=>({...t,entryFeature:t.entryFeature?without(t.entryFeature):null})));
  if(exit==="fixed12h"){
   const x=runStandalone(cs,oldFs,{id:"old",family:"clock",side,exit},opts(cs.length,delay));
   const y=runBollingerStandalone(cs,oldFs,{...rule("breakout",side,exit),family:"clock"},opts(cs.length,delay));
   assert.deepEqual(x.stats,y.stats);assert.deepEqual(x.trades,y.trades);assert.deepEqual(x.monthly,y.monthly);
  }
 }
});
test("midpoint exits on subsequent bars, fees both sides and action delays",()=>{
 for(const tf of TF)for(const delay of [0,M])for(const mode of ["breakout","into","reclaim"] as const)for(const side of ["long","short"] as const){
  const v=mode==="breakout"?(side==="long"?[.5,1,1.2,.5]:[.5,0,-.2,.5]):
   mode==="into"?(side==="long"?[.5,.1,-.2,.5]:[.5,.9,1.2,.5]):(side==="long"?[.5,-.2,.1,.5]:[.5,1.2,.9,.5]);
  const f=features(v,tf),r=rule(mode,side,"indicator_or12h",tf),n=tf/M+3;
  const out=runBollingerStandalone(tape(n,i=>({open:i===tf/M+delay/M?110:100})),f,r,opts(n,delay));
  assert.equal(out.trades.length,1);const t=out.trades[0];assert.equal(t.entryAt,T+delay);assert.equal(t.exitAt,T+tf+delay);assert.equal(t.reason,"indicator");
  near(t.pricePnl,side==="long"?100:-100);near(t.fees,2.1);
 }
 const r=rule("into","long","indicator_or12h"),f=features([.5,.1,-.1,.5]);
 const zeroWidth={...f[3],feature:{...f[3].feature,bbPercentB:null,bbBandwidthPct:0,bbSd:0,bbUpper:100,bbLower:100,bbCloseMinusMiddle:0}} as BollingerFeatureBar;
 assert(bollingerExitSignal(r,zeroWidth));assert(!bollingerEntrySignal(r,f[2],zeroWidth));
});
test("timeout tie priority, rearm/occupied skipping and pending terminal cases",()=>{
 const f=features([.5,1,1.2,...Array(11).fill(1.2),.5]),r=rule("breakout","long","indicator_or12h");
 assert.equal(runBollingerStandalone(tape(12*60+3),f,r,opts(12*60+3)).trades[0].reason,"timeout");
 const g=features([.5,1,1.2,.5,1.2],5*M),r5=rule("breakout","long","indicator_or12h",5*M);
 const out=runBollingerStandalone(tape(11),g,r5,opts(11));assert.equal(out.trades[0].exitAt,T+5*M);assert.equal(out.open!.entryAt,T+10*M);
 const pe=runBollingerStandalone(tape(1),g,r5,opts(1,M));assert(pe.stats.pendingAtEnd);assert.equal(pe.open,null);
 const px=runBollingerStandalone(tape(6),g,r5,opts(6,M));assert(px.stats.pendingAtEnd);assert(px.open);
 const hold=runBollingerStandalone(tape(11),g,rule("breakout","long","fixed12h",5*M),opts(11));assert.equal(hold.stats.skippedOccupied,1);
});
test("future-prefix exclusion, immutable delayed exit and unrelated features cannot select a trade",()=>{
 const cs=tape(70),f=features([.5,1,1.2,-.2,1.2,-.2,1.2],15*M),r=rule("breakout","long","indicator_or12h",15*M);
 assert.deepEqual(runBollingerStandalone(cs,f,r,opts(31)),runBollingerStandalone(cs.slice(0,31),f.filter(x=>x.barEnd<=T+31*M),r,opts(31)));
 const a=runBollingerStandalone(cs,f,r,opts(70,M)),b=runBollingerStandalone(cs.map(c=>({...c,high:1000,low:1})),f.map(x=>({...x,feature:{...x.feature,roc5:999,crsi:0,rsi14:100}})),r,opts(70,M));
 assert.deepEqual(a.trades.map(({entryFeature,...t})=>t),b.trades.map(({entryFeature,...t})=>t));assert.deepEqual(a.open,b.open);
 assert.equal(a.trades[0].exitAt,T+16*M);
 assert.throws(()=>runBollingerStandalone(cs,f,{...r,period:21},opts(70)));
 assert.throws(()=>runBollingerStandalone(cs.filter((_,i)=>i!==9),f,r,opts(70)));
});
test("an actual band reclaim can occur while price continues falling; no hidden price-rebound condition",()=>{
 const cs=[...Array(25).fill(100),90,89,88,87,86,85,84,83,82].map((close,i)=>({timestamp:T+i*H,close}));
 const values=computeBollingerValues(cs,H,20,2);
 const i=values.findIndex((v,i)=>i>0&&v.bbPercentB!==null&&values[i-1].bbPercentB!==null&&values[i-1].bbPercentB!<=0&&v.bbPercentB>0);
 assert(i>0);assert(cs[i].close<cs[i-1].close);
 const f=features([values[i-1].bbPercentB,values[i].bbPercentB]);
 assert(bollingerEntrySignal(rule("reclaim"),f[0],f[1]));
});
console.log(`Bollinger tests passed (${groups} groups;240 boundaries, math, causal timing, old accounting)`);
