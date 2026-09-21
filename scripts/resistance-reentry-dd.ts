import assert from 'assert/strict';
import type {Candle} from './hype-freerun-canonical-replay';
type R=Record<string,any>;
export function drawdownTrace(cs:Candle[],row:R,events:R[]){
  let inv:R[]=[],ptr=0,realized=0,peak=32000,peakAt=cs[row.startIdx].ts,dd=0;let worst:R|null=null;
  const fill=(z:R)=>{if(z.event.kind!=='open')for(const p of inv){const q=p.qty-(z.after.find((a:R)=>a.id===p.id)?.qty??0);realized+=q*(z.event.price-p.entryPrice)-.00055*q*(z.event.price+p.entryPrice);}inv=z.after;};
  const mark=(price:number,at:number,phase:string)=>{const eq=32000+realized+inv.reduce((n,p)=>n+p.qty*(price-p.entryPrice)-.00055*p.qty*(price+p.entryPrice),0);
    if(eq>peak){peak=eq;peakAt=at;}const value=(peak-eq)/peak*100;
    if(value>dd){dd=value;worst={peakAt,peakIso:new Date(peakAt).toISOString(),peakEquity:peak,troughAt:at,troughIso:new Date(at).toISOString(),troughEquity:eq,phase,price,depth:inv.length,
      oldest:inv.length?Math.min(...inv.map(p=>p.entryTime)):null,entryCost:inv.reduce((n,p)=>n+p.notional,0),lastInventoryEpisode:events[Math.max(0,ptr-1)]?.episode??null};}};
  for(let i=row.startIdx;i<row.endIdx;i++){const b=cs[i];while(events[ptr]?.event.fillIndex===i&&events[ptr].event.fillAt===b.ts)fill(events[ptr++]);mark(b.low,b.endTs,'low_before_unknown_touch_order');
    while(events[ptr]?.event.fillIndex===i)fill(events[ptr++]);mark(b.close,b.endTs,'close');}
  assert(Math.abs(dd-row.metrics.maxDrawdownPct)<1e-7);return{maxDrawdownPct:dd,worst};
}
