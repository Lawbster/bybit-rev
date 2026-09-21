/** Research-only closed OHLC; ATR shock and efficiency are separate metrics, not a combined rule. */
export const ATR_EFFICIENCY_FORMULA_VERSION="atr14-prior-scale-er-signed-v1";
export type AeFamily="atr_move"|"efficiency";
export interface AtrEfficiencyValues {
  aeAtr:number|null; aePriorAtr:number|null; aeChange:number|null;
  aeTravel:number|null; aeUnsigned:number|null; aeSigned:number|null;
}
type Bar={timestamp:number;open:number;high:number;low:number;close:number};
/** UTC source starts; caller establishes bar-end availability. No gap bridge. */
export function computeAtrEfficiencyValues(bars:readonly Readonly<Bar>[],tf:number,family:AeFamily,n:number):AtrEfficiencyValues[]{
  if(!Number.isSafeInteger(tf)||tf<=0||86400000%tf||!Number.isSafeInteger(n)||n<2
    ||!["atr_move","efficiency"].includes(family)||(family==="atr_move"&&n!==14))throw Error("Invalid ATR/efficiency interval/family/period");
  let atr:number|null=null,sum=0;
  return bars.map((b,i)=>{
    if(!Number.isSafeInteger(b.timestamp)||b.timestamp<0||b.timestamp%tf||!Number.isSafeInteger(b.timestamp+tf)
      ||(i&&bars[i-1].timestamp+tf!==b.timestamp)||![b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0)
      ||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close))throw Error("Invalid/gapped ATR/efficiency OHLC");
    const out:AtrEfficiencyValues={aeAtr:null,aePriorAtr:null,aeChange:null,aeTravel:null,aeUnsigned:null,aeSigned:null};
    if(family==="atr_move"){
      if(!i)return out;
      const p=bars[i-1],priorAtr=atr,change=b.close-p.close;
      const tr=Math.max(b.high-b.low,Math.abs(b.high-p.close),Math.abs(b.low-p.close));
      if(i<=14){sum+=tr;if(i===14)atr=sum/14;}else atr=(atr!*13+tr)/14;
      out.aeAtr=atr;out.aePriorAtr=priorAtr;out.aeChange=change;
      if(priorAtr!==null&&priorAtr>0){out.aeSigned=change/priorAtr;out.aeUnsigned=Math.abs(out.aeSigned);}
    }else if(i>=n){
      const change=b.close-bars[i-n].close;
      let travel=0;for(let j=i-n+1;j<=i;j++)travel+=Math.abs(bars[j].close-bars[j-1].close);
      out.aeChange=change;out.aeTravel=travel;out.aeSigned=travel===0?0:change/travel;out.aeUnsigned=Math.abs(out.aeSigned);
    }
    if(Object.values(out).some(v=>v!==null&&!Number.isFinite(v)))throw Error("Non-finite ATR/efficiency");
    return out;
  });
}
