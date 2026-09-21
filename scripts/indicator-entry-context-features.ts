/** C02/T01 adapters (new source; frozen C01 adapters unchanged) around already-validated, pinned indicator formulae. */
import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import { ClosedBarSeries } from "../src/research/closed-bars";
import { computeResearchFeatures } from "../src/research/indicator-features";
import { computeMacdValues } from "../src/research/macd-features";
import { computeAdxDmiValues } from "../src/research/adx-dmi-features";
import { computeAtrEfficiencyValues } from "../src/research/atr-efficiency-features";
import { computeVwapVolumeValues } from "../src/research/vwap-volume-features";
import { computeBollingerValues } from "../src/research/bollinger-features";
import { rsiEntrySignal, runRsiStandalone } from "./rsi-standalone-engine";
import { computeRocValues, rocEntrySignal, runRocStandalone } from "./roc-standalone-engine";
import { bollingerEntrySignal, runBollingerStandalone } from "./bollinger-standalone-engine";
import { computeVolumeFlowValues } from "../src/research/volume-flow-features";
import { MINUTE, HOUR, type FeatureBar, runStandalone } from "./indicator-standalone-engine";
import { crsiEntrySignal, runCrsiStandalone } from "./crsi-extremes-engine";
import { macdEntrySignal, runMacdStandalone } from "./macd-standalone-engine";
import { adxDmiEntrySignal, runAdxDmiStandalone } from "./adx-dmi-standalone-engine";
import { atrEfficiencyEntrySignal, runAtrEfficiencyStandalone } from "./atr-efficiency-standalone-engine";
import { vwapVolumeEntrySignal, runVwapVolumeStandalone } from "./vwap-volume-standalone-engine";
import { volumeFlowEntrySignal, runVolumeFlowStandalone } from "./volume-flow-standalone-engine";
import type { Opportunity } from "./indicator-combination-engine";

export function prepareFeatures(minutes:readonly Candle[]){
  const base=new Map<number,FeatureBar[]>(),cache=new Map<string,FeatureBar[]>();
  for(const tf of [5*MINUTE,15*MINUTE,30*MINUTE,HOUR,4*HOUR]){
    const b=ClosedBarSeries.fromHistorical(minutes,{sourceIntervalMs:MINUTE,targetIntervalMs:tf,publicationLagMs:0});
    const values=computeResearchFeatures(b.bars.map(x=>x.candle),tf);
    base.set(tf,b.bars.map((x,i)=>({...x,feature:values[i]})));
  }
  function rows(r:any):FeatureBar[]{
    const k=JSON.stringify([r.timeframeMs,r.family,r.period,r.lookbackBars,r.multiplier]);
    if(r.family==="clock"||r.family==="crsi_extreme"||r.family==="rsi_extreme")return base.get(r.timeframeMs??HOUR)!;
    if(cache.has(k))return cache.get(k)!;
    const original=base.get(r.timeframeMs)!;assert(original);
    const bars=original.map(b=>b.candle),tf=r.timeframeMs;
    let values:any[],extra:Record<string,number>;
    switch(r.family){
      case "roc": values=computeRocValues(bars,tf,r.lookbackBars).map(roc=>({roc}));extra={rocLookbackBars:r.lookbackBars};break;
      case "bollinger": values=computeBollingerValues(bars,tf,r.period,r.multiplier);extra={bbPeriod:r.period,bbMultiplier:r.multiplier};break;
      case "atr_move": values=computeAtrEfficiencyValues(bars,tf,"atr_move",14);extra={aePeriod:14,aeFamily:1};break;
      case "macd": values=computeMacdValues(bars,tf,12,26,9);extra={macdFastPeriod:12,macdSlowPeriod:26,macdSignalPeriod:9};break;
      case "adx_dmi": values=computeAdxDmiValues(bars,tf,14);extra={dmPeriod:14};break;
      case "efficiency": values=computeAtrEfficiencyValues(bars,tf,"efficiency",20);extra={aePeriod:20,aeFamily:2};break;
      case "vwap": values=computeVwapVolumeValues(bars,tf);extra={vvVersion:1};break;
      default: assert(["mfi","cmf","obv"].includes(r.family));values=computeVolumeFlowValues(bars,tf,r.family,r.period);extra={vfPeriod:r.period,vfFamily:r.family==="obv"?1:r.family==="mfi"?2:3};
    }
    const out=original.map((b,i)=>({...b,feature:{...b.feature,...values[i],...extra}}));cache.set(k,out);return out;
  }
  const byFamily:any={rsi_extreme:[rsiEntrySignal,runRsiStandalone],roc:[rocEntrySignal,runRocStandalone],bollinger:[bollingerEntrySignal,runBollingerStandalone],atr_move:[atrEfficiencyEntrySignal,runAtrEfficiencyStandalone],crsi_extreme:[crsiEntrySignal,runCrsiStandalone],macd:[macdEntrySignal,runMacdStandalone],
    adx_dmi:[adxDmiEntrySignal,runAdxDmiStandalone],efficiency:[atrEfficiencyEntrySignal,runAtrEfficiencyStandalone],
    vwap:[vwapVolumeEntrySignal,runVwapVolumeStandalone],mfi:[volumeFlowEntrySignal,runVolumeFlowStandalone],
    cmf:[volumeFlowEntrySignal,runVolumeFlowStandalone],obv:[volumeFlowEntrySignal,runVolumeFlowStandalone]};
  return {base,rows,
    opportunities(r:any):Opportunity[]{
      const bs=rows(r),signal=byFamily[r.family][0],out:Opportunity[]=[];
      bs.forEach((b,i)=>{if(signal(r,bs[i-1],b,bs[i-2]))out.push({at:b.barEnd,sourceStart:b.candle.timestamp,
        sourceEnd:b.barEnd,availableAt:b.availableAt,previousStart:bs[i-1].candle.timestamp,feature:b.feature});});
      return out;
    },
    original(r:any,o:any){return r.family==="clock"?runStandalone(minutes,base.get(HOUR)!,r,o):byFamily[r.family][1](minutes,rows(r),r,o);},
    conditionRows(id:string):Map<number,FeatureBar>{
      if(id.startsWith("UTC"))return new Map();
      const r=id==="Q1"?{family:"macd",timeframeMs:HOUR}:id==="Q2"?{family:"adx_dmi",period:14,timeframeMs:HOUR}:id==="Q3"?{family:"atr_move",period:14,timeframeMs:HOUR}:{family:"cmf",period:20,timeframeMs:HOUR};
      return new Map(rows(r).map(b=>[b.barEnd,b]));
    }
  };
}
