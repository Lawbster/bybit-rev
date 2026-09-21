/** Independent C01 batch math; no production feature or strategy-engine calls. */
import assert from "assert/strict";
import { referenceVolumeFlow } from "./volume-flow-standalone-results-check";
const M=60_000,H=60*M,DAY=24*H;
export function aggregateReference(cs:any[],tf:number):any[]{
  const step=tf/M,out:any[]=[];assert(cs.length&&cs[0].ts%tf===0);
  for(let i=0;i+step<=cs.length;i+=step){
    const xs=cs.slice(i,i+step);xs.forEach((c,j)=>assert.equal(c.ts,cs[i].ts+j*M));
    out.push({ts:cs[i].ts,open:xs[0].open,close:xs.at(-1)!.close,high:Math.max(...xs.map(c=>c.high)),low:Math.min(...xs.map(c=>c.low)),
      volume:xs.reduce((s,c)=>s+c.volume,0),turnover:xs.reduce((s,c)=>s+c.turnover,0)});
  }
  return out;
}
function rsi(values:number[],n:number):(number|null)[]{
  const out:(number|null)[]=Array(values.length).fill(null),ds=values.slice(1).map((v,i)=>v-values[i]);
  let gain=ds.slice(0,n).reduce((s,x)=>s+Math.max(0,x),0)/n,loss=ds.slice(0,n).reduce((s,x)=>s+Math.max(0,-x),0)/n;
  for(let i=n;i<values.length;i++){if(i>n){gain=gain*(n-1)/n+Math.max(0,ds[i-1])/n;loss=loss*(n-1)/n+Math.max(0,-ds[i-1])/n;}
    out[i]=gain+loss===0?50:100*gain/(gain+loss);}
  return out;
}
function crsi(bs:any[]):any[]{
  const cs=bs.map(b=>b.close),streak=cs.map((v,i)=>{if(!i||v===cs[i-1])return 0;const sign=Math.sign(v-cs[i-1]);let n=0;for(let j=i;j>0&&Math.sign(cs[j]-cs[j-1])===sign;j--)n++;return sign*n;});
  const a=rsi(cs,3),b=rsi(streak,2),rs=cs.slice(1).map((v,i)=>v/cs[i]-1);
  return bs.map((_,i)=>({crsi:i<101?null:(a[i]!+b[i]!+rs.slice(i-101,i-1).filter(v=>v<rs[i-1]).length)/3}));
}
function ema(xs:(number|null)[],n:number):(number|null)[]{
  const out:(number|null)[]=Array(xs.length).fill(null);let values:number[]=[],last:number|null=null;
  xs.forEach((x,i)=>{if(x===null)return;if(last===null){values.push(x);if(values.length===n)last=values.reduce((s,v)=>s+v,0)/n;}
    else last=(1-2/(n+1))*last+2/(n+1)*x;out[i]=last;});return out;
}
function macd(bs:any[]):any[]{
  const cs=bs.map(b=>b.close),fast=ema(cs,12),slow=ema(cs,26),line=cs.map((_,i)=>fast[i]===null||slow[i]===null?null:fast[i]!-slow[i]!),sig=ema(line,9);
  return bs.map((_,i)=>({macdLine:line[i],macdHist:line[i]===null||sig[i]===null?null:line[i]!-sig[i]!}));
}
function dmi(bs:any[],n=14):any[]{
  const tr:number[]=[],plus:number[]=[],minus:number[]=[],dx:number[]=[];let atr:number|null=null,p:number|null=null,m:number|null=null,adx:number|null=null;
  return bs.map((b,i)=>{
    const out={dmSpread:null as number|null,dmAdx:null as number|null};if(!i)return out;
    const z=bs[i-1],up=b.high-z.high,down=z.low-b.low;
    tr.push(Math.max(b.high-b.low,Math.abs(b.high-z.close),Math.abs(b.low-z.close)));plus.push(up>0&&up>down?up:0);minus.push(down>0&&down>up?down:0);
    if(i<n)return out;
    const mean=(xs:number[],old:number|null)=>old===null?xs.slice(0,n).reduce((s,x)=>s+x,0)/n:old*(n-1)/n+xs.at(-1)!/n;
    atr=mean(tr,atr);p=mean(plus,p);m=mean(minus,m);const pd=atr===0?0:100*p/atr,md=atr===0?0:100*m/atr;
    out.dmSpread=pd-md;dx.push(pd+md===0?0:100*Math.abs(pd-md)/(pd+md));
    if(dx.length>=n)adx=mean(dx,adx);out.dmAdx=adx;return out;
  });
}
function er(bs:any[]):any[]{return bs.map((b,i)=>{if(i<20)return{aeSigned:null};let distance=0;for(let j=i-19;j<=i;j++)distance+=Math.abs(bs[j].close-bs[j-1].close);return{aeSigned:distance===0?0:(b.close-bs[i-20].close)/distance};});}
function vwap(bs:any[]):any[]{
  let day=-1,volume=0,quote=0,complete=false;
  return bs.map((b,i)=>{
    const anchor=Math.floor(b.ts/DAY)*DAY;if(anchor!==day){day=anchor;volume=0;quote=0;complete=b.ts===anchor;}
    volume+=b.volume;quote+=b.turnover;const vw=complete&&volume>0?quote/volume:null;
    const prior=i>=20?bs.slice(i-20,i).reduce((s,x)=>s+x.volume,0):0;
    return{vvDayStart:anchor,vvDayDistance:vw===null?null:100*(b.close-vw)/vw,vvRolling20:i>=20&&prior>0?b.volume/(prior/20):null};
  });
}
export function referenceFeatures(cs:any[]){
  const bars=new Map<number,any[]>(),cache=new Map<string,Map<number,any>>();
  for(const tf of [15*M,30*M,H,4*H])bars.set(tf,aggregateReference(cs,tf));
  function get(r:any):Map<number,any>{
    const tf=r.timeframeMs,k=`${tf}|${r.family}|${r.period??0}`;if(cache.has(k))return cache.get(k)!;
    const bs=bars.get(tf)!;let values:any[];
    if(["obv","mfi","cmf"].includes(r.family)){const ref=referenceVolumeFlow(cs,tf,r.family,r.period);cache.set(k,ref);return ref;}
    if(r.family==="crsi_extreme")values=crsi(bs);else if(r.family==="macd")values=macd(bs);else if(r.family==="adx_dmi")values=dmi(bs);
    else if(r.family==="efficiency")values=er(bs);else {assert.equal(r.family,"vwap");values=vwap(bs);}
    const out=new Map(bs.map((b,i)=>[b.ts,values[i]]));cache.set(k,out);return out;
  }
  return {get,bars};
}
export function referenceCross(r:any,p:any,c:any):boolean{
  if(!p||!c)return false;const s=r.side==="long"?1:-1;
  if(r.family==="crsi_extreme")return p.crsi!==null&&c.crsi!==null&&(r.mode==="into"?p.crsi>5&&c.crsi<=5:p.crsi<=5&&c.crsi>5);
  if(r.family==="macd")return p.macdHist!==null&&c.macdHist!==null&&s*p.macdHist<=0&&s*c.macdHist>0;
  if(r.family==="adx_dmi")return c.dmSpread!==null&&(r.mode==="adx_cross"?p.dmAdx!==null&&c.dmAdx!==null&&p.dmAdx<=40&&c.dmAdx>40&&s*c.dmSpread>0:p.dmSpread!==null&&s*p.dmSpread<=0&&s*c.dmSpread>0);
  if(r.family==="efficiency")return p.aeSigned!==null&&c.aeSigned!==null&&s*p.aeSigned<=-.5&&s*c.aeSigned>-.5;
  if(r.family==="vwap")return p.vvDayStart===c.vvDayStart&&p.vvDayDistance!==null&&c.vvDayDistance!==null&&s*p.vvDayDistance<=0&&s*c.vvDayDistance>0;
  assert(["mfi","cmf","obv"].includes(r.family));if(p.vfSigned===null||c.vfSigned===null)return false;
  return r.mode==="trend"?s*p.vfSigned<=r.threshold&&s*c.vfSigned>r.threshold:s*p.vfSigned>=-r.threshold&&s*c.vfSigned < -r.threshold;
}
export function referenceGate(id:string,side:string,t:number,refs:ReturnType<typeof referenceFeatures>){
  const tf=id==="B1"?4*H:H,start=Math.floor(t/tf)*tf-tf;
  const r=id==="B1"?{family:"adx_dmi",period:14,timeframeMs:tf}:id==="B2"?{family:"efficiency",period:20,timeframeMs:tf}:{family:"vwap",timeframeMs:tf};
  const f=refs.get(r).get(start),field=id==="B1"?"dmSpread":id==="B2"?"aeSigned":id==="B3"?"vvRolling20":"vvDayDistance",v=f?.[field];
  const ready=typeof v==="number"&&Number.isFinite(v),signed=(side==="long"?1:-1)*v;
  return {start,end:start+tf,value:ready?v:null,ready,pass:ready&&(id==="B2"?signed>-.5:id==="B3"?v>=1.5:signed>0),dayStart:id==="B4"&&f?f.vvDayStart:null};
}
