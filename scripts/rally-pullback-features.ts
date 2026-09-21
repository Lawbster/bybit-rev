/** RP01 pure features/signals. Future labels are in a separate function. */
import assert from 'assert/strict';
import {ClosedBarSeries} from '../src/research/closed-bars';
import {computeResearchFeatures} from '../src/research/indicator-features';
import type {Candle} from './hype-freerun-canonical-replay';
export type R=Record<string,any>;
export const M=60000,H=60*M,LOOKBACK=[4,12,24,48,72],HORIZONS=[4,8,12,24,48,72];
export const FAMILIES=LOOKBACK.flatMap(hours=>[6,10].map(threshold=>({id:`rise${hours}h_${threshold}pct`,hours,threshold})));
export function contexts(cs:Candle[]):R[]{
  const bars=ClosedBarSeries.fromHistorical(cs.map(c=>({timestamp:c.ts,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume,turnover:c.turnover})),
    {sourceIntervalMs:M,targetIntervalMs:4*H,publicationLagMs:0}).bars;
  const raw=bars.map(b=>b.candle),features=computeResearchFeatures(raw,4*H);
  function emas(n:number){let e:number|null=null,sum=0;return raw.map((b,i)=>{sum+=b.close;if(i===n-1)e=sum/n;else if(e!==null)e+=(b.close-e)*2/(n+1);return e;});}
  const e200=emas(200),e50=emas(50);const out:R[]=[];
  for(let i=200;i<bars.length;i++){const b=bars[i],c=b.candle,f=features[i],range=c.high-c.low;
    const returns=Object.fromEntries(LOOKBACK.map(h=>[h,100*(c.close/raw[i-h/4].close-1)]));
    const prior4=100*(raw[i-1].close/raw[i-2].close-1),atrPct=100*features[i-1].atr14!/raw[i-1].close;
    const high48=Math.max(...raw.slice(i-11,i+1).map(c=>c.high));
    out.push({at:b.barEnd,index:i,sourceStart:c.timestamp,sourceEnd:b.barEnd,sourceAvailableAt:b.availableAt,
      price:c.close,open:c.open,high:c.high,low:c.low,returns,prior4hReturn:prior4,
      priorAtrPct:atrPct,atrBucket:atrPct<1?'low':atrPct<2?'medium':'high',rsi:f.rsi14,crsi:f.crsi,adx:f.adx14,rvol:f.rvol20,
      upperWick:range?(c.high-Math.max(c.open,c.close))/range:0,closeLocation:range?(c.close-c.low)/range:.5,
      distance48hPct:100*(1-c.close/high48),high48,belowPreviousLow:c.close<raw[i-1].low,
      ema200:e200[i],ema50:e50[i],ema50Previous:e50[i-1],
      trend:c.close>=e200[i]!&&e50[i]!>=e50[i-1]!?'up':c.close<e200[i]!&&e50[i]!<e50[i-1]!?'down':'mixed'});
  }
  return out;
}
export function signals(grid:R[],from:number,to:number):R[]{const events:R[]=[];
  for(const spec of FAMILIES){let previous:number|null=null,nextAllowed=-Infinity;
    for(const x of grid){const value=x.returns[spec.hours],cross=previous!==null&&previous<spec.threshold&&value>=spec.threshold;
      previous=value;if(cross&&x.at>=nextAllowed){nextAllowed=x.at+72*H;
        if(x.at>=from&&x.at<=to)events.push({id:`${spec.id}_${x.at}`,family:spec.id,hours:spec.hours,threshold:spec.threshold,at:x.at,sourceAt:x.at});}}
  }return events.sort((a,b)=>a.at-b.at||a.family.localeCompare(b.family));
}
export function flags(x:R):R{return {rsi70:x.rsi===null?null:x.rsi>=70,crsi90:x.crsi===null?null:x.crsi>=90,
  adx25:x.adx===null?null:x.adx>=25,rvol2:x.rvol===null?null:x.rvol>=2,upperWick35:x.upperWick>=.35,
  lowerHalf:x.closeLocation<=.5,decelerating:x.returns[4]<x.prior4hReturn,near48hHigh:x.distance48hPct<=1,belowPreviousLow:x.belowPreviousLow};}
export function confirmations(event:R,gridByAt:Map<number,R>,kind:string):R|null{
  const first=gridByAt.get(event.at)!;let peak=first.price;
  for(const hours of [4,8,12]){const x=gridByAt.get(event.at+hours*H);if(!x)return null;peak=Math.max(peak,x.high);
    const fire=kind==='first_red_4h'?x.price<x.open:x.price<=peak*.98;
    if(fire)return {event:event.id,kind,at:x.at,sourceAt:x.at,delayHours:hours,peak,alreadyMovedPct:100*(x.price/first.price-1)};
  }return null;
}
export function future(cs:Candle[],at:number):R{
  const i=(at-cs[0].ts)/M;if(!Number.isInteger(i)||!cs[i])return {at,ready:false,reason:'no_entry_minute',horizons:{}};
  const entry=cs[i].open,result:R={at,ready:true,entry,horizons:{}};
  let low=entry,high=entry,priorPeak=entry,pullback=0,peakAt=at,pullbackPeakAt=at,pullbackLowAt=at;
  let up2:number|null=null,down2:number|null=null,down5:number|null=null,down10:number|null=null;
  const end=Math.min(cs.length,i+72*60);
  for(let j=i;j<end;j++){const c=cs[j];assert.equal(c.ts,at+(j-i)*M);
    low=Math.min(low,c.low);high=Math.max(high,c.high);
    const dd=100*(c.low/priorPeak-1);if(dd<pullback){pullback=dd;pullbackPeakAt=peakAt;pullbackLowAt=c.ts;}
    if(c.high>priorPeak){priorPeak=c.high;peakAt=c.endTs;}
    if(up2===null&&c.high>=entry*1.02)up2=c.ts;
    if(down2===null&&c.low<=entry*.98)down2=c.ts;
    if(down5===null&&c.low<=entry*.95)down5=c.ts;
    if(down10===null&&c.low<=entry*.9)down10=c.ts;
    const h=(j-i+1)/60;if(HORIZONS.includes(h))result.horizons[h]={hours:h,end:c.endTs,closePct:100*(c.close/entry-1),
      lowPct:100*(low/entry-1),highPct:100*(high/entry-1),pullbackPct:pullback,pullbackPeakAt,pullbackLowAt,
      up2Hours:up2===null?null:(up2-at)/H,down2Hours:down2===null?null:(down2-at)/H,
      down5Hours:down5===null?null:(down5-at)/H,down10Hours:down10===null?null:(down10-at)/H,
      firstBarrier:up2!==null&&down2!==null&&up2===down2?'ambiguous':up2!==null&&(down2===null||up2<down2)?'up2':down2!==null?'down2':'neither'};
  }
  result.censored=!result.horizons[72];return result;
}
export function percentile(xs:number[],p:number):number|null{if(!xs.length)return null;const v=[...xs].sort((a,b)=>a-b),i=(v.length-1)*p,l=Math.floor(i);return v[l]+(v[Math.ceil(i)]-v[l])*(i-l);}
export function wilson(k:number,n:number):number[]|null{if(!n)return null;const z=1.96,p=k/n,den=1+z*z/n,mid=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return [100*(mid-half),100*(mid+half)];}
export function summary(rows:R[],h:number):R{const ys=rows.map(x=>x.horizons[h]).filter(Boolean),n=ys.length;
  const count=(key:string,v:number)=>ys.filter(x=>x[key]<=v).length,avg=(key:string)=>n?ys.reduce((s,x)=>s+x[key],0)/n:null;
  const rate=(k:number)=>n?100*k/n:null;
  return {n:rows.length,complete:n,censored:rows.length-n,drop2:count('lowPct',-2),drop5:count('lowPct',-5),drop10:count('lowPct',-10),
    drop2Rate:rate(count('lowPct',-2)),drop5Rate:rate(count('lowPct',-5)),drop5Wilson:wilson(count('lowPct',-5),n),
    pullback5:count('pullbackPct',-5),pullback5Rate:rate(count('pullbackPct',-5)),
    medianClose:percentile(ys.map(x=>x.closePct),.5),meanClose:avg('closePct'),medianLow:percentile(ys.map(x=>x.lowPct),.5),
    medianHigh:percentile(ys.map(x=>x.highPct),.5),medianHoursTo2:percentile(ys.filter(x=>x.down2Hours!==null).map(x=>x.down2Hours),.5),
    medianHoursTo5:percentile(ys.filter(x=>x.down5Hours!==null).map(x=>x.down5Hours),.5),
    upFirst:ys.filter(x=>x.firstBarrier==='up2').length,downFirst:ys.filter(x=>x.firstBarrier==='down2').length,
    ambiguous:ys.filter(x=>x.firstBarrier==='ambiguous').length,neither:ys.filter(x=>x.firstBarrier==='neither').length,
    continuedWithout2Drop:ys.filter(x=>x.highPct>=2&&x.lowPct> -2).length};
}
