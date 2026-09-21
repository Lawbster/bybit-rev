/** C02/T01 causal gates only. Never changes frozen C01 accounting or live code. */
import assert from "assert/strict";
import { runCombination, type Gate, type Opportunity, type Side } from "./indicator-combination-engine";
import type { FeatureBar, StandaloneOptions } from "./indicator-standalone-engine";
import type { Candle } from "../src/fetch-candles";
const H=3_600_000,DAY=24*H;
export interface ContextGate extends Omit<Gate,"condition"> {
  condition:string; previousEnd:number|null; inputs:Record<string,number|null>;
  evidenceKind:"closed_bar"|"calendar";
}
export function entryContextGate(id:string,side:Side,role:string,t:number,rows:ReadonlyMap<number,FeatureBar>):ContextGate {
  assert(Number.isSafeInteger(t)&&t>=0);
  const calendar=/^UTC[0-5]$/.test(id),end=calendar?t:Math.floor(t/H)*H,b=rows.get(end),p=rows.get(end-H);
  assert(calendar||["Q1","Q2","Q3","Q4"].includes(id));
  const g:ContextGate={condition:id,expectedEnd:end,sourceStart:calendar?t:b?.candle.timestamp??null,
    sourceEnd:calendar?t:b?.barEnd??null,availableAt:calendar?t:b?.availableAt??null,
    dayStart:calendar?Math.floor(t/DAY)*DAY:null,value:null,ready:false,pass:false,reason:"missing_bar",
    previousEnd:null,inputs:{},evidenceKind:calendar?"calendar":"closed_bar"};
  if(calendar){g.value=Math.floor((t%DAY)/(4*H));g.inputs={excludedBlock:Number(id.slice(3))};g.ready=true;g.pass=g.value!==g.inputs.excludedBlock;g.reason=null;return g;}
  const valid=(x:FeatureBar|undefined,expected:number)=>!!x&&x.barEnd===expected&&x.candle.timestamp===expected-H&&x.feature.timestamp===x.candle.timestamp
    &&Number.isSafeInteger(x.availableAt)&&x.availableAt>=x.barEnd&&x.availableAt<=t;
  if(!valid(b,end)){g.reason=b?"invalid_or_unavailable_source":"missing_bar";return g;}
  if((id==="Q1"||id==="Q3")&&!valid(p,end-H)){g.reason="missing_or_unavailable_previous";return g;}
  const f=b!.feature as any,z=p?.feature as any,s=side==="long"?1:-1;
  let value:number|null=null;
  if(id==="Q1"){
    g.previousEnd=p!.barEnd;g.inputs={histNow:f.macdHist??null,histPrevious:z.macdHist??null};
    if(f.macdHist!=null&&z.macdHist!=null)value=s*(f.macdHist-z.macdHist);
  }else if(id==="Q2"){
    assert(["reversion","continuation"].includes(role));value=f.dmAdx??null;g.inputs={adx:value};
  }else if(id==="Q3"){
    g.previousEnd=p!.barEnd;g.inputs={closeNow:b!.candle.close,closePrevious:p!.candle.close,previousAtr:z.aeAtr??null};
    if(z.aeAtr!=null&&Number.isFinite(z.aeAtr)&&z.aeAtr>0)value=Math.abs(b!.candle.close-p!.candle.close)/z.aeAtr;
  }else{g.inputs={cmf:f.vfSigned??null};if(f.vfSigned!=null)value=s*f.vfSigned;}
  if(value==null||!Number.isFinite(value)){g.reason="null_feature";return g;}
  g.value=value;g.ready=true;g.reason=null;
  g.pass=id==="Q2"?(role==="reversion"?value<25:value>=25):id==="Q3"?value<=1:value>0;
  return g;
}
/** The pinned engine reads only ready/pass and preserves the evidence object.
 * Widen its C01-only serialized condition label at this single adapter boundary;
 * do not map Q/calendar evidence to falsely labeled C01 B conditions.
 */
export function runEntryContext(minutes:readonly Candle[],opportunities:readonly Opportunity[],side:Side,o:StandaloneOptions,
  gate?:(at:number)=>ContextGate,readinessOnly=false){
  return runCombination(minutes,opportunities,side,o,gate as unknown as ((at:number)=>Gate)|undefined,readinessOnly);
}
