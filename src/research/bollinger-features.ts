/** Research-only closed-window Bollinger math. No trading imports or forming bars. */
import type { Candle } from "../fetch-candles";
export const BOLLINGER_FORMULA_VERSION="bollinger-sma-population-sd-v1";
export interface BollingerValues {
  bbMiddle:number|null; bbSd:number|null; bbUpper:number|null; bbLower:number|null;
  bbPercentB:number|null; bbBandwidthPct:number|null; bbCloseMinusMiddle:number|null;
}
export function computeBollingerValues(cs:readonly Pick<Candle,"timestamp"|"close">[],interval:number,period:number,multiplier:number):BollingerValues[] {
  if(!Number.isSafeInteger(interval)||interval<=0||86400000%interval
    ||!Number.isSafeInteger(period)||period<2||!Number.isFinite(multiplier)||multiplier<=0)
    throw Error("Invalid Bollinger interval/parameters");
  return cs.map((c,i)=>{
    if(!Number.isSafeInteger(c.timestamp)||c.timestamp<0||c.timestamp%interval
      ||(i>0&&c.timestamp!==cs[i-1].timestamp+interval)||!Number.isFinite(c.close)||c.close<=0)
      throw Error("Invalid/gapped Bollinger close tape");
    if(i<period-1)return {bbMiddle:null,bbSd:null,bbUpper:null,bbLower:null,bbPercentB:null,bbBandwidthPct:null,bbCloseMinusMiddle:null};
    // Recompute each finite window: no drift from rolling sum-of-squares subtraction.
    let sum=0;for(let j=i-period+1;j<=i;j++)sum+=cs[j].close;
    const middle=sum/period;let square=0;
    for(let j=i-period+1;j<=i;j++)square+=(cs[j].close-middle)**2;
    const sd=Math.sqrt(square/period),upper=middle+multiplier*sd,lower=middle-multiplier*sd,width=upper-lower;
    const values={bbMiddle:middle,bbSd:sd,bbUpper:upper,bbLower:lower,
      bbPercentB:width===0?null:(c.close-lower)/width,bbBandwidthPct:100*width/middle,bbCloseMinusMiddle:c.close-middle};
    if(Object.values(values).some(v=>v!==null&&!Number.isFinite(v))||middle<=0||width<0)
      throw Error("Unrepresentable Bollinger window");
    return values;
  });
}
