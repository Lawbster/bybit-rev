import assert from "assert/strict";
import {ATR} from "technicalindicators";
import {computeAtrEfficiencyValues,type AeFamily} from "../src/research/atr-efficiency-features";
import {computeResearchFeatures} from "../src/research/indicator-features";
import {atrEfficiencyEntrySignal,atrEfficiencyExitSignal,runAtrEfficiencyStandalone,type AtrEfficiencyRule,type AtrEfficiencyFeatureBar} from "./atr-efficiency-standalone-engine";
import {runStandalone,type FeatureBar,type StandaloneOptions} from "./indicator-standalone-engine";
import type {Candle} from "../src/fetch-candles";
const M=60000,H=60*M,T=Date.UTC(2026,7,1),TF=[5*M,15*M,30*M,H,4*H];
const P=[{family:"atr_move" as const,period:14,thresholds:[.5,1,2]},...[10,20,40].map(period=>({family:"efficiency" as const,period,thresholds:[.25,.5,.75]}))];
let groups=0;const test=(s:string,f:()=>void)=>{f();groups++;console.log("PASS "+s);};
const near=(a:number,b:number,tol=1e-8)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);
const rule=(mode:AtrEfficiencyRule["mode"]="trend",side:AtrEfficiencyRule["side"]="long",exit:AtrEfficiencyRule["exit"]="fixed12h",tf=H,n=14,threshold=.5,family:AeFamily="atr_move"):AtrEfficiencyRule=>
({id:"fixture",family,timeframeMs:tf,period:n,threshold,mode,side,exit});
function features(vals:Array<number|null>,tf=H,n=14,family:AeFamily="atr_move"):AtrEfficiencyFeatureBar[]{
 return vals.map((v,i)=>{const timestamp=T+(i-3)*tf,close=100;
 return {candle:{timestamp,open:close,high:101,low:99,close,volume:10,turnover:1000},barEnd:timestamp+tf,availableAt:timestamp+tf,
 feature:{timestamp,rsi14:null,crsi:null,roc5:v,atr14:null,atrPct:null,adx14:null,plusDI14:null,minusDI14:null,vwapUtcDay:null,rvol20:null,
 aeAtr:null,aePriorAtr:null,aeChange:v,aeTravel:null,aeUnsigned:v===null?null:Math.abs(v),aeSigned:v,aePeriod:n,aeFamily:family==="atr_move"?1:2}};
 });
}
const tape=(n:number,f:(i:number)=>Partial<Candle>=()=>({})):Candle[]=>Array.from({length:n},(_,i)=>{const o=f(i),open=o.open??100,close=o.close??open;
return {timestamp:T+i*M,open,high:Math.max(open,close)+1,low:Math.min(open,close)-1,close,volume:10,turnover:1000,...o};});
const opts=(n:number,delayMs=0):StandaloneOptions=>({start:T,end:T+n*M,delayMs,holdMs:12*H,notional:1000,equity:10000,feeRate:.001});
const without=(f:any):FeatureBar["feature"]=>{const {aeAtr,aePriorAtr,aeChange,aeTravel,aeUnsigned,aeSigned,aePeriod,aeFamily,...old}=f;return old;};
function varying(tf:number,count=220):Candle[]{
 return Array.from({length:count},(_,i)=>{const close=80+.01*i+Math.sin(i*.47)*5+Math.cos(i*.1)*2;
 return {timestamp:T+i*tf,open:close,high:close+1+i%3*.1,low:close-1-i%2*.2,close,volume:10,turnover:10*close};});
}
test("five ATR14 clocks match external Wilder ATR and exact shared arrays; preceding denominator only",()=>{
 for(const tf of TF){
  const cs=varying(tf),out=computeAtrEfficiencyValues(cs,tf,"atr_move",14),e=ATR.calculate({high:cs.map(c=>c.high),low:cs.map(c=>c.low),close:cs.map(c=>c.close),period:14});
  const old=computeResearchFeatures(cs,tf);assert.equal(e.length,cs.length-14);
  out.forEach((v,i)=>{assert.equal(v.aeAtr,old[i].atr14);
   if(i<15)assert.equal(v.aeSigned,null);else{near(v.aeSigned!,(cs[i].close-cs[i-1].close)/e[i-15]);near(v.aePriorAtr!,e[i-15]);}
   if(i>=14)near(v.aeAtr!,e[i-14]);
  });
 }
});
test("ER10/20/40 across five clocks matches direct independent displacement/travel, unsigned bounds and sign",()=>{
 for(const tf of TF)for(const n of [10,20,40]){
  const cs=varying(tf),out=computeAtrEfficiencyValues(cs,tf,"efficiency",n);
  out.forEach((v,i)=>{
   if(i<n){Object.values(v).forEach(x=>assert.equal(x,null));return;}
   const changes=cs.slice(i-n+1,i+1).map((c,j)=>c.close-cs[i-n+j].close);
   const gain=changes.filter(x=>x>0).reduce((a,b)=>a+b,0),loss=-changes.filter(x=>x<0).reduce((a,b)=>a+b,0);
   near(v.aeChange!,gain-loss);near(v.aeTravel!,gain+loss);
   near(v.aeSigned!,gain+loss===0?0:(gain-loss)/(gain+loss));
   assert(v.aeUnsigned!>=0&&v.aeUnsigned!<=1+1e-12);near(Math.abs(v.aeSigned!),v.aeUnsigned!);
  });
  assert.deepEqual(computeAtrEfficiencyValues(cs.slice(0,100),tf,"efficiency",n),out.slice(0,100));
 }
});
test("hand ER seed and monotone/chop/flat; ATR zero scale invalid and shocked bar not self-normalized",()=>{
 const cs=[10,12,11,13].map((close,i)=>({timestamp:T+i*H,open:close,high:close,low:close,close}));
 const er=computeAtrEfficiencyValues(cs,H,"efficiency",3);assert.equal(er[2].aeSigned,null);near(er[3].aeChange!,3);near(er[3].aeTravel!,5);near(er[3].aeSigned!,.6);
 for(const family of ["atr_move","efficiency"] as const){
  const n=family==="atr_move"?14:10,flat=tape(60).map((c,i)=>({...c,timestamp:T+i*H,open:100,high:100,low:100,close:100}));
  const x=computeAtrEfficiencyValues(flat,H,family,n);
  if(family==="atr_move"){assert.equal(x[15].aeAtr,0);assert.equal(x[15].aeSigned,null);}
  else{assert.equal(x[10].aeSigned,0);assert.equal(x[10].aeUnsigned,0);assert.equal(x[10].aeTravel,0);}
 }
 const mono=Array.from({length:50},(_,i)=>({timestamp:T+i*H,open:100+i,high:100+i,low:100+i,close:100+i}));
 assert.equal(computeAtrEfficiencyValues(mono,H,"efficiency",10)[10].aeSigned,1);
 const shock=Array.from({length:17},(_,i)=>{const close=i<15?100:i===15?90:89;return{timestamp:T+i*H,open:close,high:close+1,low:close-1,close};});
 const v=computeAtrEfficiencyValues(shock,H,"atr_move",14);assert.equal(v[15].aePriorAtr,2);assert.equal(v[15].aeSigned,-5);near(v[15].aeAtr!,37/14);
 // Price falls again while scaled one-bar momentum recovers above -0.5.
 assert(shock[16].close<shock[15].close);assert(v[16].aeSigned!>-.5);
 const base=computeResearchFeatures(shock.map(c=>({...c,volume:1,turnover:c.close})),H);
 const f=shock.map((c,i)=>({candle:{...c,volume:1,turnover:c.close},barEnd:c.timestamp+H,availableAt:c.timestamp+H,feature:{...base[i],...v[i],aePeriod:14,aeFamily:1}}));
 assert(atrEfficiencyEntrySignal(rule("recovery"),f[15],f[16]));
});
test("scale/translation/mirror invariants, prefix, invalid OHLC/gaps/parameters",()=>{
 const cs=varying(H);
 for(const p of P){
  const a=computeAtrEfficiencyValues(cs,H,p.family,p.period);
  for(const [scale,shift]of [[10,0],[1,100000]]){
   const b=computeAtrEfficiencyValues(cs.map(c=>({...c,open:c.open*scale+shift,high:c.high*scale+shift,low:c.low*scale+shift,close:c.close*scale+shift})),H,p.family,p.period);
   a.forEach((x,i)=>{for(const k of Object.keys(x) as Array<keyof typeof x>){if(x[k]===null)assert.equal(b[i][k],null);else near(b[i][k]!,x[k]!*([ "aeSigned","aeUnsigned"].includes(k)?1:scale),1e-7);}});
  }
  const mirror=computeAtrEfficiencyValues(cs.map(c=>({...c,open:200-c.open,close:200-c.close,high:200-c.low,low:200-c.high})),H,p.family,p.period);
  a.forEach((x,i)=>{if(x.aeSigned!==null){near(mirror[i].aeSigned!,-x.aeSigned);near(mirror[i].aeUnsigned!,x.aeUnsigned!);}});
  assert.deepEqual(computeAtrEfficiencyValues(cs.slice(0,100),H,p.family,p.period),a.slice(0,100));
  assert.throws(()=>computeAtrEfficiencyValues(cs.filter((_,i)=>i!==40),H,p.family,p.period));
  assert.throws(()=>computeAtrEfficiencyValues([...cs,cs.at(-1)!],H,p.family,p.period));
  assert.throws(()=>computeAtrEfficiencyValues(cs.map((c,i)=>i===3?{...c,low:c.high+1}:c),H,p.family,p.period));
 }
 assert.throws(()=>computeAtrEfficiencyValues(cs,H,"atr_move",7));
 assert.throws(()=>computeAtrEfficiencyValues(cs,H,"efficiency",1));
});
test("all720 rule boundaries: fresh crossing, equality, sign, null and stale parameter/availability",()=>{
 let count=0;
 for(const tf of TF)for(const p of P)for(const k of p.thresholds)for(const mode of ["trend","into","recovery"] as const)for(const side of ["long","short"] as const)for(const exit of ["fixed12h","indicator_or12h"] as const){
  const sign=side==="long"?1:-1,prev=mode==="trend"?k:-k,cur=prev+(mode==="into"?-.01:.01);
  const f=features([prev,prev,cur].map(v=>v*sign),tf,p.period,p.family),r=rule(mode,side,exit,tf,p.period,k,p.family);
  assert(atrEfficiencyEntrySignal(r,f[1],f[2]));
  assert(!atrEfficiencyEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,aeSigned:prev*sign}} as AtrEfficiencyFeatureBar));
  assert(!atrEfficiencyEntrySignal(r,{...f[1],feature:{...f[1].feature,aeSigned:cur*sign}} as AtrEfficiencyFeatureBar,f[2]));
  for(const bad of [null,NaN,Infinity])assert(!atrEfficiencyEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,aeSigned:bad}} as AtrEfficiencyFeatureBar));
  assert(!atrEfficiencyEntrySignal(r,f[1],{...f[2],availableAt:f[2].barEnd-1}));
  assert(!atrEfficiencyEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,aePeriod:99}} as AtrEfficiencyFeatureBar));
  assert(!atrEfficiencyEntrySignal(r,f[1],{...f[2],feature:{...f[2].feature,aeFamily:99}} as AtrEfficiencyFeatureBar));
  assert(!atrEfficiencyEntrySignal(r,undefined,f[2]));count++;
 }assert.equal(count,720);
});
test("eight forced-ROC ledgers and four clock cases retain old exact accounting",()=>{
 const cs=tape(36*60+3,i=>({open:100+Math.sin(i/50)*5}));
 for(const side of ["long","short"] as const)for(const delay of [0,M])for(const exit of ["fixed12h","indicator_or12h"] as const){
  const f=features(Array.from({length:42},(_,i)=>i%3===0?-1:1)),oldFs=f.map(x=>({...x,feature:without(x.feature)}));
  const a=runStandalone(cs,oldFs,{id:"old",family:"roc_cross",side,exit},opts(cs.length,delay));
  const b=runAtrEfficiencyStandalone(cs,f,rule("trend",side,exit),opts(cs.length,delay));
  assert.deepEqual(a.stats,b.stats);assert.deepEqual(a.monthly,b.monthly);assert.deepEqual(a.open,b.open);
  assert.deepEqual(a.trades,b.trades.map(t=>({...t,entryFeature:t.entryFeature?without(t.entryFeature):null})));
  if(exit==="fixed12h"){
   const x=runStandalone(cs,oldFs,{id:"old",family:"clock",side,exit},opts(cs.length,delay));
   const y=runAtrEfficiencyStandalone(cs,oldFs,{...rule("trend",side,exit),family:"clock",threshold:0},opts(cs.length,delay));
   assert.deepEqual(x.stats,y.stats);assert.deepEqual(x.trades,y.trades);assert.deepEqual(x.monthly,y.monthly);
  }
 }
});
test("every definition zero exit and delays; actual-notional fees, timeout tie, pending cutoff and rearm",()=>{
 for(const tf of TF)for(const p of P)for(const k of p.thresholds)for(const mode of ["trend","into","recovery"] as const)for(const side of ["long","short"] as const)for(const delay of [0,M]){
  const sign=side==="long"?1:-1,prev=mode==="trend"?k:-k,cur=prev+(mode==="into"?-.01:.01);
  const f=features([prev,prev,cur,0].map(v=>v*sign),tf,p.period,p.family),r=rule(mode,side,"indicator_or12h",tf,p.period,k,p.family),n=tf/M+3;
  const out=runAtrEfficiencyStandalone(tape(n,i=>({open:i===tf/M+delay/M?110:100})),f,r,opts(n,delay));
  assert.equal(out.trades.length,1);const t=out.trades[0];assert.equal(t.entryAt,T+delay);assert.equal(t.exitAt,T+tf+delay);near(t.pricePnl,sign*100);near(t.fees,2.1);
 }
 const r=rule("trend","long","indicator_or12h"),f=features([-1,.5,1,...Array(11).fill(1),0]);
 assert.equal(runAtrEfficiencyStandalone(tape(723),f,r,opts(723)).trades[0].reason,"timeout");
 const g=features([-1,.5,1,0,1],5*M),r5={...r,timeframeMs:5*M};
 const pe=runAtrEfficiencyStandalone(tape(1),g,r5,opts(1,M));assert(pe.stats.pendingAtEnd);assert.equal(pe.open,null);
 const px=runAtrEfficiencyStandalone(tape(6),g,r5,opts(6,M));assert(px.stats.pendingAtEnd);assert(px.open);
 const re=runAtrEfficiencyStandalone(tape(11),g,r5,opts(11));assert.equal(re.trades[0].exitAt,T+5*M);assert.equal(re.open!.entryAt,T+10*M);
 assert.equal(runAtrEfficiencyStandalone(tape(11),g,{...r5,exit:"fixed12h"},opts(11)).stats.skippedOccupied,1);
});
test("future exclusion, immutable pending exits, unrelated fields ignored and invalid tape rejected",()=>{
 const cs=tape(70),f=features([-1,.5,1,-1,1,-1,1],15*M),r=rule("trend","long","indicator_or12h",15*M);
 assert.deepEqual(runAtrEfficiencyStandalone(cs,f,r,opts(31)),runAtrEfficiencyStandalone(cs.slice(0,31),f.filter(x=>x.barEnd<=T+31*M),r,opts(31)));
 const a=runAtrEfficiencyStandalone(cs,f,r,opts(70,M)),b=runAtrEfficiencyStandalone(cs.map(c=>({...c,high:1000,low:1})),f.map(x=>({...x,feature:{...x.feature,roc5:999,crsi:0,rsi14:100,adx14:0}})),r,opts(70,M));
 assert.deepEqual(a.trades.map(({entryFeature,...t})=>t),b.trades.map(({entryFeature,...t})=>t));assert.deepEqual(a.open,b.open);
 assert.equal(a.trades[0].exitAt,T+16*M);assert.throws(()=>runAtrEfficiencyStandalone(cs,f,{...r,period:15},opts(70)));
 assert.throws(()=>runAtrEfficiencyStandalone(cs.filter((_,i)=>i!==9),f,r,opts(70)));
});
console.log(`ATR/efficiency tests passed (${groups} groups;720 boundaries)`);
