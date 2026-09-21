/** R01 research-only local refinements; closed source clocks and fixed definitions. */
import assert from "assert/strict";
import type { FeatureBar } from "./indicator-standalone-engine";
import type { ContextGate } from "./indicator-entry-context-policy";
export interface Refinement { id:string; family:"vwap"|"shock"|"cmf"; timeframeMs:number; threshold:number; }
export function refinementGate(r:Refinement,t:number,rows:ReadonlyMap<number,FeatureBar>):ContextGate {
  assert(Number.isSafeInteger(t)&&t>=0&&[1_800_000,3_600_000].includes(r.timeframeMs));
  assert(Number.isFinite(r.threshold));
  const tf=r.timeframeMs,end=Math.floor(t/tf)*tf,b=rows.get(end),p=rows.get(end-tf);
  const g:ContextGate={condition:r.id,expectedEnd:end,sourceStart:b?.candle.timestamp??null,sourceEnd:b?.barEnd??null,
    availableAt:b?.availableAt??null,dayStart:null,value:null,ready:false,pass:false,reason:"missing_bar",previousEnd:null,
    inputs:{threshold:r.threshold,timeframeMs:tf},evidenceKind:"closed_bar"};
  const valid=(x:FeatureBar|undefined,at:number)=>!!x&&x.barEnd===at&&x.candle.timestamp===at-tf&&x.feature.timestamp===at-tf
    &&Number.isSafeInteger(x.availableAt)&&x.availableAt>=at&&x.availableAt<=t;
  if(!valid(b,end)){g.reason=b?"invalid_or_unavailable_source":"missing_bar";return g;}
  const f=b!.feature as any;let value:number|null=null;
  if(r.family==="vwap"){
    const day=Math.floor(b!.candle.timestamp/86_400_000)*86_400_000;
    if(f.vvDayStart!==day){g.reason="invalid_day_anchor";return g;}
    g.dayStart=day;value=f.vvDayDistance??null;
  }else if(r.family==="shock"){
    if(!valid(p,end-tf)){g.reason="missing_or_unavailable_previous";return g;}
    const atr=(p!.feature as any).aeAtr;g.previousEnd=p!.barEnd;
    Object.assign(g.inputs,{closeNow:b!.candle.close,closePrevious:p!.candle.close,previousAtr:atr??null});
    if(atr!=null&&Number.isFinite(atr)&&atr>0)value=Math.abs(b!.candle.close-p!.candle.close)/atr;
  }else {assert.equal(r.family,"cmf");value=f.vfSigned??null;}
  if(value===null||!Number.isFinite(value)){g.reason="null_feature";return g;}
  g.value=value;g.ready=true;g.reason=null;
  g.pass=r.family==="vwap"?value>r.threshold:r.family==="shock"?value<=r.threshold:value<r.threshold;
  return g;
}
export function contextRule(r:Refinement){return {family:r.family==="shock"?"atr_move":r.family,period:r.family==="cmf"?20:14,timeframeMs:r.timeframeMs};}
