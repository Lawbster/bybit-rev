/** I11: completed-candle volume proxies. No live/exchange dependencies. */
import type { Candle } from "../fetch-candles";
export const VOLUME_FLOW_FORMULA_VERSION="obv-normalized-change-mfi-typical-cmf-v1";
export type VolumeFlowFamily="obv"|"mfi"|"cmf";
export interface VolumeFlowValues {
  vfRawObv:number|null; vfPositive:number|null; vfNegative:number|null; vfVolume:number|null;
  vfNumerator:number|null; vfDenominator:number|null; vfValue:number|null; vfSigned:number|null;
}
export function computeVolumeFlowValues(candles:readonly Readonly<Candle>[],interval:number,family:VolumeFlowFamily,n:number):VolumeFlowValues[]{
  if(!Number.isSafeInteger(interval)||interval<=0||!Number.isSafeInteger(n)||n<1
    ||!["obv","mfi","cmf"].includes(family))throw Error("Invalid volume-flow parameters");
  candles.forEach((b,i)=>{
    if(!Number.isSafeInteger(b.timestamp)||b.timestamp<0||b.timestamp%interval
      ||(i&&b.timestamp!==candles[i-1].timestamp+interval)
      ||![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)
      ||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)
      ||!Number.isFinite(b.volume)||b.volume<0)throw Error("Invalid/gapped volume-flow candles");
  });
  let obv=0;
  const signed=candles.map((b,i)=>i?Math.sign(b.close-candles[i-1].close)*b.volume:0);
  const typical=candles.map(b=>(b.high+b.low+b.close)/3);
  const raw=candles.map((b,i)=>b.volume*typical[i]);
  const positive=raw.map((v,i)=>i&&typical[i]>typical[i-1]?v:0);
  const negative=raw.map((v,i)=>i&&typical[i]<typical[i-1]?v:0);
  const money=candles.map(b=>b.high===b.low?0:((b.close-b.low)-(b.high-b.close))/(b.high-b.low)*b.volume);
  return candles.map((b,i)=>{
    if(i)obv+=signed[i];
    const x:VolumeFlowValues={vfRawObv:family==="obv"?obv:null,vfPositive:null,vfNegative:null,vfVolume:null,
      vfNumerator:null,vfDenominator:null,vfValue:null,vfSigned:null};
    if(i<(family==="cmf"?n-1:n))return x;
    let volume=0,num=0,pos=0,neg=0;
    for(let j=i-n+1;j<=i;j++){
      volume+=candles[j].volume;
      if(family==="obv")num+=signed[j];
      else if(family==="cmf")num+=money[j];
      else {pos+=positive[j];neg+=negative[j];}
    }
    x.vfVolume=volume;
    if(family==="mfi"){x.vfPositive=pos;x.vfNegative=neg;num=pos-neg;}
    x.vfNumerator=num;x.vfDenominator=family==="mfi"?pos+neg:volume;
    if(x.vfDenominator>0){x.vfSigned=num/x.vfDenominator;x.vfValue=family==="mfi"?100*pos/x.vfDenominator:x.vfSigned;}
    for(const v of Object.values(x))if(v!==null&&!Number.isFinite(v))throw Error("Nonfinite volume-flow output");
    return x;
  });
}
