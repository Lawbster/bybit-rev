/** Independent batch math/conditions. No new production feature/strategy calls. */
import assert from "assert/strict";
import { aggregateReference, referenceFeatures as oldFeatures, referenceCross as oldCross } from "./indicator-combination-reference";
const M=60_000,H=60*M,D=24*H;
export function referenceFeatures(cs:any[]){
  const old=oldFeatures(cs),cache=new Map<string,Map<number,any>>(),bars=old.bars;
  bars.set(5*M,aggregateReference(cs,5*M));
  function get(r:any):Map<number,any>{
    if(!["rsi_extreme","roc","atr_move","bollinger"].includes(r.family))return old.get(r);
    const key=JSON.stringify([r.family,r.timeframeMs,r.period,r.lookbackBars,r.multiplier]);if(cache.has(key))return cache.get(key)!;
    const bs=bars.get(r.timeframeMs)!,values:any[]=[];let gain=0,loss=0,atr:number|null=null;
    for(let i=0;i<bs.length;i++){
      const b=bs[i],p=bs[i-1];
      if(r.family==="rsi_extreme"){
        if(i<=14&&i>0){gain+=Math.max(0,b.close-p.close)/14;loss+=Math.max(0,p.close-b.close)/14;}
        if(i>14){gain=(gain*13+Math.max(0,b.close-p.close))/14;loss=(loss*13+Math.max(0,p.close-b.close))/14;}
        values.push({rsi14:i<14?null:gain+loss===0?50:100*gain/(gain+loss)});
      }else if(r.family==="roc")values.push({roc:i<r.lookbackBars?null:100*(b.close/bs[i-r.lookbackBars].close-1)});
      else if(r.family==="atr_move"){
        const prior=atr,change=i?b.close-p.close:null;
        if(i===14){atr=0;for(let j=1;j<=14;j++){const q=bs[j],z=bs[j-1];atr+=Math.max(q.high-q.low,Math.abs(q.high-z.close),Math.abs(q.low-z.close));}atr/=14;}
        else if(i>14)atr=(13*atr!+Math.max(b.high-b.low,Math.abs(b.high-p.close),Math.abs(b.low-p.close)))/14;
        values.push({aeAtr:atr,aePriorAtr:prior,aeSigned:prior!==null&&prior>0?change!/prior:null});
      }else{
        if(i<r.period-1){values.push({bbPercentB:null});continue;}
        const xs=bs.slice(i-r.period+1,i+1).map(x=>x.close),mean=xs.reduce((a,v)=>a+v,0)/r.period;
        const sd=Math.sqrt(xs.reduce((a,v)=>a+(v-mean)**2,0)/r.period);
        values.push({bbPercentB:sd===0?null:(b.close-(mean-r.multiplier*sd))/(2*r.multiplier*sd)});
      }
    }
    const out=new Map(bs.map((b,i)=>[b.ts,values[i]]));cache.set(key,out);return out;
  }
  return {get,bars};
}
export function referenceCross(r:any,p:any,c:any):boolean{
  if(!p||!c)return false;
  if(r.family==="rsi_extreme")return p.rsi14!=null&&c.rsi14!=null&&p.rsi14>30&&c.rsi14<=30;
  if(r.family==="roc")return p.roc!=null&&c.roc!=null&&p.roc>-1&&c.roc<=-1;
  if(r.family==="atr_move")return p.aeSigned!=null&&c.aeSigned!=null&&p.aeSigned>=-.5&&c.aeSigned<-.5;
  if(r.family==="bollinger")return p.bbPercentB!=null&&c.bbPercentB!=null&&p.bbPercentB>=0&&c.bbPercentB<0;
  return oldCross(r,p,c);
}
export function referenceGate(id:string,side:string,t:number,refs:ReturnType<typeof referenceFeatures>,role:string){
  const s=side==="long"?1:-1,calendar=/^UTC[0-5]$/.test(id);
  if(calendar){const value=Math.floor(new Date(t).getUTCHours()/4);return{start:t,end:t,value,ready:true,pass:value!==Number(id.slice(3)),dayStart:Math.floor(t/D)*D,previousEnd:null,inputs:{excludedBlock:Number(id.slice(3))},evidenceKind:"calendar"};}
  assert(["Q1","Q2","Q3","Q4"].includes(id));
  const end=Math.floor(t/H)*H,start=end-H,rule=id==="Q1"?{family:"macd",timeframeMs:H}:id==="Q2"?{family:"adx_dmi",timeframeMs:H,period:14}:id==="Q3"?{family:"atr_move",timeframeMs:H,period:14}:{family:"cmf",timeframeMs:H,period:20};
  const map=refs.get(rule),f=map.get(start),p=map.get(start-H);let value:number|null=null,inputs:any={},previousEnd:number|null=null;
  if(id==="Q1"){inputs={histNow:f?.macdHist??null,histPrevious:p?.macdHist??null};previousEnd=start;
    if(inputs.histNow!=null&&inputs.histPrevious!=null)value=s*(inputs.histNow-inputs.histPrevious);}
  else if(id==="Q2"){value=f?.dmAdx??null;inputs={adx:value};}
  else if(id==="Q3"){
    const bs=refs.bars.get(H)!,i=(start-bs[0].ts)/H;inputs={closeNow:bs[i]?.close??null,closePrevious:bs[i-1]?.close??null,previousAtr:p?.aeAtr??null};previousEnd=start;
    if(inputs.previousAtr>0&&inputs.closeNow!=null&&inputs.closePrevious!=null)value=Math.abs(inputs.closeNow-inputs.closePrevious)/inputs.previousAtr;
  }else{inputs={cmf:f?.vfSigned??null};if(inputs.cmf!=null)value=s*inputs.cmf;}
  const ready=value!==null&&Number.isFinite(value);
  return{start,end,value:ready?value:null,ready,pass:ready&&(id==="Q2"?(role==="reversion"?value!<25:value!>=25):id==="Q3"?value!<=1:value!>0),dayStart:null,previousEnd,inputs,evidenceKind:"closed_bar"};
}
