/** P01: descriptive, closed-source features and labels. No execution imports. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
import { ClosedBarSeries } from "../src/research/closed-bars";
import { computeResearchFeatures } from "../src/research/indicator-features";
import { computeMacdValues } from "../src/research/macd-features";
import { computeBollingerValues } from "../src/research/bollinger-features";
import { computeAtrEfficiencyValues } from "../src/research/atr-efficiency-features";
import { computeVwapVolumeValues } from "../src/research/vwap-volume-features";
import { computeVolumeFlowValues } from "../src/research/volume-flow-features";
import { TpHlTape, reference, type Row } from "./tp-hl-event-features";
export const M=60000,H=60*M;
export function csv(rows:Row[]):string{const keys=[...new Set(rows.flatMap(Object.keys))];
  const cell=(x:any)=>`"${(x==null?"":typeof x==="object"?JSON.stringify(x):String(x)).replace(/"/g,'""')}"`;
  return [keys.map(cell).join(","),...rows.map(r=>keys.map(k=>cell(r[k])).join(","))].join("\n")+"\n";}
export function upper(xs:number[],t:number) { let lo=0,hi=xs.length;while(lo<hi){const m=(lo+hi)>>>1;if(xs[m]<=t)lo=m+1;else hi=m;}return lo; }
export function labelAt(cs:Candle[],at:number):Row {
  const i=(at-cs[0].endTs)/M;assert(Number.isInteger(i)&&cs[i]?.endTs===at);
  const p=cs[i].close,out:Row={};
  for(const h of [4,12,24]){
    if(i+h*60>=cs.length){out[`low${h}hPct`]=null;out[`close${h}hPct`]=null;continue;}
    let low=Infinity;for(let j=i+1;j<=i+h*60;j++)low=Math.min(low,cs[j].low);
    out[`low${h}hPct`]=100*(low/p-1);out[`close${h}hPct`]=100*(cs[i+h*60].close/p-1);
  }
  out.drop2in12=out.low12hPct===null?null:out.low12hPct<=-2;
  out.drop3in24=out.low24hPct===null?null:out.low24hPct<=-3;
  out.drop5in12=out.low12hPct===null?null:out.low12hPct<=-5;return out;
}
export function dropEvents(cs:Candle[],from:number):Row[]{
  const out:Row[]=[],q:number[]=[];let head=0,armed=true,recovered=0;
  for(let i=0;i<cs.length;i++){
    while(head<q.length&&q[head]<=i-720)head++;
    while(q.length>head&&cs[q.at(-1)!].high<=cs[i].high)q.pop();q.push(i);
    if(i<719)continue;
    const peak=q[head],dd=100*(cs[i].close/cs[peak].high-1);
    if(!armed){recovered=dd>=-1?recovered+1:0;if(recovered>=60){armed=true;recovered=0;}}
    if(armed&&dd<=-3){if(cs[i].endTs>=from)out.push({id:`drop-${cs[i].endTs}`,cohort:"market_drop",at:cs[i].endTs,
      rollingPeak:cs[peak].high,peakBarEnd:cs[peak].endTs,drawdownPct:dd,...labelAt(cs,cs[i].endTs)});armed=false;recovered=0;}
  }return out;
}
/** Computes each validated family once; returns only requested snapshots. */
export function indicatorSnapshots(cs:Candle[],times:number[],spec:Row):Map<number,Row>{
  const minutes=cs.filter(c=>c.ts>=Date.parse(spec.indicatorSeed)).map(c=>({timestamp:c.ts,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume,turnover:c.turnover}));
  const out=new Map<number,Row>(times.map(t=>[t,{at:t,values:{},sources:{},delayedValues:{},delayedSources:{}}]));
  for(const min of spec.timeframesMinutes){
    const tf=min*M,bs=ClosedBarSeries.fromHistorical(minutes,{sourceIntervalMs:M,targetIntervalMs:tf,publicationLagMs:0}).bars;
    const c=bs.map(b=>b.candle),ends=bs.map(b=>b.barEnd);
    const base=computeResearchFeatures(c,tf),macd=computeMacdValues(c,tf,12,26,9),bb=computeBollingerValues(c,tf,20,2);
    const atr=computeAtrEfficiencyValues(c,tf,"atr_move",14),er=computeAtrEfficiencyValues(c,tf,"efficiency",20),vw=computeVwapVolumeValues(c,tf);
    const obv=computeVolumeFlowValues(c,tf,"obv",20),mfi=computeVolumeFlowValues(c,tf,"mfi",14),cmf=computeVolumeFlowValues(c,tf,"cmf",20);
    for(const t of times)for(const lag of [0,60000]){
      const i=upper(ends,t-lag)-1;assert(i>=0);const b=bs[i],f=base[i],v=vw[i],a=atr[i],d=out.get(t)!;
      const values:Row={close:b.candle.close,volume:b.candle.volume,turnover:b.candle.turnover,
        rsi:f.rsi14,crsi:f.crsi,roc5:f.roc5,atr:f.atr14,atrPct:f.atrPct,adx:f.adx14,plusDI:f.plusDI14,minusDI:f.minusDI14,
        diSpread:f.plusDI14===null||f.minusDI14===null?null:f.plusDI14-f.minusDI14,
        ...macd[i],...bb[i],atrShock:a.aeSigned,efficiency:er[i].aeSigned,
        dayVwap:v.vvDay,weekVwap:v.vvWeek,dayVwapDistancePct:v.vvDayDistance,weekVwapDistancePct:v.vvWeekDistance,
        rvol20:v.vvRolling20,rvolSameTime20d:v.vvTime20,obv20:obv[i].vfValue,mfi14:mfi[i].vfValue,cmf20:cmf[i].vfValue};
      for(const [k,x] of Object.entries(values))d[lag?"delayedValues":"values"][`m${min}_${k}`]=x;
      d[lag?"delayedSources":"sources"][`m${min}`]={sourceStart:b.candle.timestamp,sourceEnd:b.barEnd,availableAt:b.barEnd+lag,ageMs:t-b.barEnd,
        vwapDayStart:v.vvDayStart,vwapWeekStart:v.vvWeekStart};assert(b.barEnd+lag<=t);
    }
  }return out;
}
export function hlSnapshot(tape:TpHlTape,at:number,lag:number):Row {
  const x=tape.snapshot(at,lag);
  for(const n of [60,240]){const f=tape.flow(at,n,lag);x.features[`takerRatio${n}`]=f.healthy?f.buySellRatio:null;
    x.features[`buyShare${n}`]=f.healthy?f.buyShare:null;x.features[`turnover${n}Usd`]=f.healthy?f.total:null;
    x.quality[`flow${n}Healthy`]=f.healthy;x.sources[`taker${n}`]={sources:f.sources,samples:f.samples,ambiguous:f.ambiguous,start:f.start,end:f.end};
    for(const kind of ["asset","oi"] as const){const a=tape.latest(kind,at,lag),b=tape.latest(kind,at-n*M,lag),max=tape.spec.freshnessMs[kind];
      const good=!!a&&!!b&&at-a.sourceAt<=max&&at-n*M-b.sourceAt<=max;
      x.sources[`${kind}_${n}m_anchor`]={...reference(b,lag),queryAt:at-n*M,fresh:good};
      for(const [name,field] of [["NativeOi","openInterest"],["MarkedOi","openInterestValue"],["Mark","markPrice"]]){
        const av=a?.data[field],bv=b?.data[field];x.features[`${kind}${name}Change${n}Pct`]=good&&av!==null&&bv!==null&&bv>0?100*(av/bv-1):null;
      }
    }
  }return x;
}
export type Bin={id:string;feature:string;op:"lt"|"le"|"gt"|"ge";value:number};
export function bins():Bin[]{
  const out:Bin[]=[];const add=(feature:string,op:Bin["op"],value:number)=>out.push({id:`${feature}_${op}_${value}`,feature,op,value});
  for(const tf of [5,15,30,60,240]){
    const p=`m${tf}_`;for(const [f,op,v] of [["rsi","le",30],["rsi","ge",70],["crsi","le",5],["crsi","ge",95],
      ["adx","ge",25],["diSpread","lt",0],["roc5","lt",0],["macdHist","lt",0],["bbPercentB","le",0],["bbPercentB","ge",1],
      ["atrShock","le",-1],["efficiency","le",-.3],["dayVwapDistancePct","lt",0],["weekVwapDistancePct","lt",0],
      ["rvol20","ge",1.5],["rvolSameTime20d","ge",1.5],["obv20","lt",0],["mfi14","le",20],["mfi14","ge",80],["cmf20","lt",0]] as const)add(p+f,op,v);
  }
  for(const [f,op,v] of [["hl_takerRatio15","le",.85],["hl_takerRatio60","le",.9],["hl_takerRatio15","ge",1.15],
    ["hl_assetNativeOiChange240Pct","gt",0],["hl_assetNativeOiChange60Pct","lt",0],["hl_bookMeanImbalance15","lt",-.05],
    ["hl_bookImbalance05Change15","lt",-.15],["hl_fundingPerHour","gt",0],["sr_resistanceDistancePct","le",1]] as const)add(f,op,v);
  return out;
}
export function flagged(values:Row,b:Bin):boolean|null{const v=values[b.feature];if(typeof v!=="number"||!Number.isFinite(v))return null;
  return b.op==="lt"?v<b.value:b.op==="le"?v<=b.value:b.op==="gt"?v>b.value:v>=b.value;}
