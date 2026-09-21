/** BTC-only closed-source triggers. HYPE outcomes live in a separate module. */
import type {Candle} from './hype-freerun-canonical-replay';
import {H,M,LOOKBACK,type R} from './rally-pullback-features';
export const SPECS=LOOKBACK.flatMap(hours=>[6,10].flatMap(threshold=>['rise','fall'].map(direction=>
  ({id:`btc_${direction}${hours}h_${threshold}pct`,hours,threshold,direction,sign:direction==='rise'?1:-1}))));
export function btcContexts(cs:Candle[],hype:R[]):R[]{
  const indices=new Map(cs.map((c,i)=>[c.ts,i])),run=new Int32Array(cs.length);
  for(let i=0;i<cs.length;i++)run[i]=i&&cs[i-1].endTs===cs[i].ts?run[i-1]+1:1;
  return hype.map(x=>{const i=indices.get(x.at-M),c=i===undefined?undefined:cs[i];
    const returns=Object.fromEntries(LOOKBACK.map(h=>[h,i!==undefined&&run[i]>=h*60+1?100*(cs[i].close/cs[i-h*60].close-1):null]));
    return {...x,btc:{sourceEnd:x.at,availableAt:x.at,price:c?.close??null,returns,
      contiguousMinutes:i===undefined?0:run[i]},gapPct:Object.fromEntries(LOOKBACK.map(h=>[h,returns[h]===null?null:x.returns[h]-returns[h]]))};
  });
}
export function eligible(x:R,previous:R|undefined,h:number):boolean{
  return x.btc.returns[h]!==null&&previous!==undefined&&previous.at===x.at-4*H&&previous.btc.returns[h]!==null;
}
export function btcSignals(grid:R[],from:number,to:number):R[]{const events:R[]=[];
  for(const s of SPECS){let next=-Infinity;
    for(let i=1;i<grid.length;i++){const x=grid[i],p=grid[i-1];if(!eligible(x,p,s.hours))continue;
      const v=x.btc.returns[s.hours]*s.sign,prev=p.btc.returns[s.hours]*s.sign;
      if(prev<s.threshold&&v>=s.threshold&&x.at>=next){next=x.at+72*H;
        if(x.at>=from&&x.at<to)events.push({id:`${s.id}_${x.at}`,family:s.id,at:x.at,sourceAt:x.at,
          hours:s.hours,threshold:s.threshold,direction:s.direction,btcReturn:x.btc.returns[s.hours],
          hypeReturn:x.returns[s.hours],gapPct:x.gapPct[s.hours]});}
    }
  }return events.sort((a,b)=>a.at-b.at||a.family.localeCompare(b.family));
}
