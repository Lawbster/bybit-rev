/** Research-only generic closed OHLC ADX/DMI. Does not replace live legacy features. */
export const ADX_DMI_FORMULA_VERSION = "adx-dmi-wilder-sma-seed-v1";
export interface AdxDmiValues {
  dmAtr: number|null; dmPlus: number|null; dmMinus: number|null;
  dmDx: number|null; dmAdx: number|null; dmSpread: number|null;
}
type Bar = {timestamp:number;open:number;high:number;low:number;close:number};
class Mean {
  private count=0; private sum=0; private value:number|null=null;
  constructor(private n:number){}
  next(x:number):number|null {
    if(this.value===null){this.sum+=x;if(++this.count===this.n)this.value=this.sum/this.n;}
    else this.value=(this.value*(this.n-1)+x)/this.n;
    return this.value;
  }
}
/** UTC source-start timestamps; caller must establish bar-end availability. */
export function computeAdxDmiValues(bars:readonly Readonly<Bar>[],tf:number,n:number):AdxDmiValues[] {
  if(!Number.isSafeInteger(tf)||tf<=0||86400000%tf||!Number.isSafeInteger(n)||n<2)
    throw Error("Invalid ADX/DMI interval/period");
  const trMean=new Mean(n),pMean=new Mean(n),mMean=new Mean(n),dxMean=new Mean(n);
  return bars.map((b,i)=>{
    if(!Number.isSafeInteger(b.timestamp)||b.timestamp<0||b.timestamp%tf||!Number.isSafeInteger(b.timestamp+tf)
      ||(i&&bars[i-1].timestamp+tf!==b.timestamp)
      ||![b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0)
      ||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close))
      throw Error("Invalid/gapped ADX/DMI OHLC tape");
    const empty:AdxDmiValues={dmAtr:null,dmPlus:null,dmMinus:null,dmDx:null,dmAdx:null,dmSpread:null};
    if(!i)return empty;
    const prev=bars[i-1],up=b.high-prev.high,down=prev.low-b.low;
    const atr=trMean.next(Math.max(b.high-b.low,Math.abs(b.high-prev.close),Math.abs(b.low-prev.close)));
    const p=pMean.next(up>0&&up>down?up:0),m=mMean.next(down>0&&down>up?down:0);
    if(atr===null||p===null||m===null)return empty;
    const plus=atr===0?0:100*p/atr,minus=atr===0?0:100*m/atr;
    const dx=plus+minus===0?0:100*Math.abs(plus-minus)/(plus+minus);
    const out={dmAtr:atr,dmPlus:plus,dmMinus:minus,dmDx:dx,dmAdx:dxMean.next(dx),dmSpread:plus-minus};
    if(Object.values(out).some(x=>x!==null&&!Number.isFinite(x)))throw Error("Non-finite ADX/DMI");
    return out;
  });
}
