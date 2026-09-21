/** Research only: actual-turnover UTC VWAP and prior-only relative volume. */
import type { Candle } from "../fetch-candles";
export const VWAP_VOLUME_FORMULA_VERSION = "actual-utc-vwap-prior20-rvol-v1";
export interface VwapVolumeValues {
  vvDayStart:number; vvWeekStart:number;
  vvDay:number|null; vvWeek:number|null;
  vvDayDistance:number|null; vvWeekDistance:number|null;
  vvRolling20:number|null; vvTime20:number|null; vvChange:number|null;
}
const DAY=86400000,WEEK=7*DAY;
export function computeVwapVolumeValues(bars:readonly Readonly<Candle>[],tf:number):VwapVolumeValues[]{
  if(!Number.isSafeInteger(tf)||tf<=0||DAY%tf)throw Error("Invalid VWAP/volume interval");
  let ds=-Infinity,ws=-Infinity,dv=0,dt=0,wv=0,wt=0,dc=false,wc=false;
  return bars.map((b,i)=>{
    if(!Number.isSafeInteger(b.timestamp)||b.timestamp<0||b.timestamp%tf||!Number.isSafeInteger(b.timestamp+tf)
      ||(i&&bars[i-1].timestamp+tf!==b.timestamp)||![b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0)
      ||![b.volume,b.turnover].every(x=>Number.isFinite(x)&&x>=0)
      ||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close))throw Error("Invalid/gapped VWAP/volume OHLCV");
    if(b.volume===0?b.turnover!==0:b.turnover/b.volume<b.low-1e-5||b.turnover/b.volume>b.high+1e-5)
      throw Error("Turnover/base-volume price outside candle range");
    const day=Math.floor(b.timestamp/DAY)*DAY,week=Math.floor((b.timestamp+3*DAY)/WEEK)*WEEK-3*DAY;
    if(day!==ds){ds=day;dv=0;dt=0;dc=b.timestamp===day;}
    if(week!==ws){ws=week;wv=0;wt=0;wc=b.timestamp===week;}
    dv+=b.volume;dt+=b.turnover;wv+=b.volume;wt+=b.turnover;
    const d=dc&&dv>0?dt/dv:null,w=wc&&wv>0?wt/wv:null;
    let rolling:number|null=null,timed:number|null=null;
    if(i>=20){let v=0;for(let j=i-20;j<i;j++)v+=bars[j].volume;if(v>0)rolling=b.volume/(v/20);}
    const stride=DAY/tf;
    if(i>=20*stride){let v=0;for(let n=20;n>=1;n--)v+=bars[i-n*stride].volume;if(v>0)timed=b.volume/(v/20);}
    const out:VwapVolumeValues={vvDayStart:ds,vvWeekStart:ws,vvDay:d,vvWeek:w,
      vvDayDistance:d===null?null:100*(b.close-d)/d,vvWeekDistance:w===null?null:100*(b.close-w)/w,
      vvRolling20:rolling,vvTime20:timed,vvChange:i?b.close-bars[i-1].close:null};
    if(Object.values(out).some(v=>v!==null&&!Number.isFinite(v)))throw Error("Nonfinite VWAP/volume");
    return out;
  });
}

