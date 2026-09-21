/** SRT01 price-only diagnostics. No orders and no alternative portfolio path. */
import assert from 'assert/strict';
import type {Candle} from './hype-freerun-canonical-replay';
import {ReplaySrContext} from './replay-sr-context';
import type {SRMemoryZoneLevel} from '../src/bot/sr-memory-zones';
export type R=Record<string,any>;
export const H=3600000,M=60000;
export function spaced(touches:Array<{ts:number}>,spacing=6*H):number[]{
  const picked:number[]=[];
  for(const t of touches.slice().sort((a,b)=>a.ts-b.ts))if(!picked.length||t.ts-picked.at(-1)!>=spacing)picked.push(t.ts);
  return picked;
}
export function eligibleLevel(level:SRMemoryZoneLevel|null,avg:number,price:number,target:R,d:R){
  if(!level||target.pct!==d.normalTpPct||!(level.price>price))return false;
  return level.price>=avg*(1+d.minimumTpPct/100)&&level.price<target.targetPrice&&spaced(level.touchData,d.touchSpacingMs).length>=d.minimumSpacedTouches;
}
export function mutationDecisions(cs:Candle[],events:R[],pending:R|null):Map<number,string>{
  const map=new Map<number,string>();
  for(const e of events)if(e.event.fillAt===cs[e.event.fillIndex].ts)map.set(e.event.decisionIndex,e.event.kind+':'+e.event.reason);
  if(pending)map.set(pending.decisionIndex,pending.kind+':'+pending.reason);
  return map;
}
export function featurePath(cs:Candle[],x:R,events:R[],targets:R[],cfg:R,d:R,lag:number){
  const sr=new ReplaySrContext(cs,cfg.srShadow),decisions=mutationDecisions(cs,events,x.pendingAtEnd),rows:R[]=[],anchors:R[]=[],seen=new Set<number>();
  const counts:R={occupied:0,free:0,ordinary:0,healthy:0,nearest:0,betweenAvgAndNormal:0,priceBand:0,qualified:0,staleExcluded:0,mutationExcluded:0};
  const monthly=new Map<string,R>();let ptr=0,tp=0,inv:R[]=[],ep=0;
  for(let i=x.startIdx;i<x.endIdx;i++){
    const at=cs[i].endTs,sourceAt=at-lag,ct=sr.at(sourceAt);
    while(ptr<events.length&&events[ptr].event.fillIndex<=i){inv=events[ptr].after;ep=events[ptr].episode;ptr++;}
    while(tp+1<targets.length&&targets[tp+1].index<=i)tp++;
    if(!inv.length)continue;
    const month=new Date(at).toISOString().slice(0,7);if(!monthly.has(month))monthly.set(month,{month,occupied:0,ordinary:0,qualified:0});const mo=monthly.get(month)!;
    counts.occupied++;mo.occupied++;
    if(decisions.has(i)){counts.mutationExcluded++;continue;}counts.free++; // no target need exist if a full close already has priority
    const t=targets[tp];assert(t&&t.index<=i&&t.episode===ep);
    if(t.pct!==d.normalTpPct){counts.staleExcluded++;continue;}counts.ordinary++;mo.ordinary++;
    if(!ct.coverage.healthy)continue;counts.healthy++;
    const qty=inv.reduce((n,p)=>n+p.qty,0),cost=inv.reduce((n,p)=>n+p.notional,0),avg=cost/qty;
    assert(Math.abs(t.targetPrice-avg*1.014)<1e-7);
    const hit=ct.engine.nearestResistance(sourceAt,cs[i].close);if(!hit)continue;counts.nearest++;
    if(hit.lv.price>avg&&hit.lv.price<t.targetPrice)counts.betweenAvgAndNormal++;
    if(!(hit.lv.price>=avg*1.01&&hit.lv.price<t.targetPrice))continue;counts.priceBand++;
    if(!eligibleLevel(hit.lv,avg,cs[i].close,t,d))continue;counts.qualified++;mo.qualified++;
    const f={index:i,at,sourceAt,episode:ep,armIndex:t.armedIndex,depth:inv.length,qty,cost,avg,price:cs[i].close,
      normalTarget:t.targetPrice,targetPct:t.pct,shade:hit.lv.price,shadePct:(hit.lv.price/avg-1)*100,
      touches:hit.lv.touchData,spaced:spaced(hit.lv.touchData,d.touchSpacingMs),highTouches:hit.lv.highTouches,lowTouches:hit.lv.lowTouches,
      oldestEntry:Math.min(...inv.map(p=>p.entryTime)),inventoryIds:inv.map(p=>p.id)};
    rows.push(f);if(!seen.has(t.armedIndex)){seen.add(t.armedIndex);anchors.push(f);}
  }
  return{counts,monthly:[...monthly.values()],features:rows,anchors};
}
export function lifetime(cs:Candle[],x:R,events:R[],targets:R[],anchor:R){
  let last=x.endIdx-1,reason='cutoff';
  const lower=(i:number,r:string)=>{if(i<last){last=i;reason=r;}};
  for(const t of targets)if(t.index>anchor.index){lower(t.index,'target_update');break;}
  for(const e of events){const v=e.event;
    if(v.fillIndex>anchor.index){lower(v.fillIndex-(v.fillAt===cs[v.fillIndex].ts?1:0),'inventory_'+v.kind);break;}
  }
  for(const [i,why] of mutationDecisions(cs,events,x.pendingAtEnd))if(i>anchor.index)lower(i,'decision_'+why);
  return{last,reason};
}
export function futureLabel(cs:Candle[],x:R,events:R[],targets:R[],anchor:R){
  const bound=lifetime(cs,x,events,targets,anchor);let hit:number|null=null,normal:number|null=null;
  for(let j=anchor.index+1;j<=bound.last;j++){
    assert.equal(cs[j].ts,cs[j-1].endTs,'SRT01 labels require continuous closed minutes');
    const p=x.tp==='resting_touch'?cs[j].high:cs[j].close;
    if(hit===null&&p>=anchor.shade)hit=j;if(normal===null&&p>=anchor.normalTarget)normal=j;
  }
  const fillIndex=hit===null?null:hit+(x.tp==='resting_touch'?0:1);
  const fill=fillIndex===null||fillIndex>=x.endIdx?null:x.tp==='resting_touch'?anchor.shade:cs[fillIndex].open;
  const competing=hit!==null&&x.tp!=='resting_touch'&&mutationDecisions(cs,events,x.pendingAtEnd).has(hit);
  const c=events.find(e=>e.episode===anchor.episode&&e.event.kind==='close');
  const original=x.metrics.episodes.find((e:R)=>Date.parse(e.close)===c?.event.fillAt);
  return{anchorIndex:anchor.index,episode:anchor.episode,...bound,hit,normal,hitAt:hit===null?null:cs[hit].endTs,
    sameBar:hit!==null&&hit===normal,fillIndex,fill,competing,hitBeforeNormal:hit!==null&&(normal===null||hit<normal),
    shadeOnly:hit!==null&&normal===null,remainingNetAtProxy:fill===null?null:anchor.qty*fill-anchor.cost-.00055*(anchor.qty*fill+anchor.cost),
    targetGiveUp:anchor.qty*(anchor.normalTarget-anchor.shade)*(1-.00055),
    baselineOutcome:original?{entry:original.entry,close:original.close,pnl:original.pnl,reason:original.reason}:null};
}
function quantile(a:number[],q:number){if(!a.length)return null;const s=a.slice().sort((a,b)=>a-b);return s[Math.floor((s.length-1)*q)];}
export function summarize(features:R[],anchors:R[],labels:R[]){
  const unique=(rs:R[])=>[...new Map(rs.map(r=>[r.episode,r])).values()];
  const outcomes=(rs:R[])=>{const a=unique(rs).filter(r=>r.baselineOutcome);return{n:a.length,wins:a.filter(r=>r.baselineOutcome.pnl>0).length,
    winDollars:a.reduce((n,r)=>n+Math.max(0,r.baselineOutcome.pnl),0),losses:a.filter(r=>r.baselineOutcome.pnl<0).length,
    lossDollars:a.reduce((n,r)=>n+Math.min(0,r.baselineOutcome.pnl),0),open:unique(rs).filter(r=>!r.baselineOutcome).length};};
  const hits=labels.filter(l=>l.hit!==null&&l.fill!==null&&!l.competing),only=hits.filter(l=>l.shadeOnly);
  return{eligibleLadders:unique(features).length,anchors:anchors.length,hitAnchors:hits.length,shadeOnlyAnchors:only.length,
    sameBar:hits.filter(l=>l.sameBar).length,beforeNormal:hits.filter(l=>l.hitBeforeNormal).length,
    noHit:labels.filter(l=>l.hit===null).length,competing:labels.filter(l=>l.competing).length,censoredFill:labels.filter(l=>l.hit!==null&&l.fill===null).length,
    hitLadders:unique(hits).length,shadeOnlyLadders:unique(only).length,baselineEligible:outcomes(labels),baselineHit:outcomes(hits),baselineShadeOnly:outcomes(only),
    medianGiveUp:quantile(hits.map(l=>l.targetGiveUp),.5),p90GiveUp:quantile(hits.map(l=>l.targetGiveUp),.9),
    medianShadePct:quantile(anchors.map(a=>a.shadePct),.5),medianDepth:quantile(anchors.map(a=>a.depth),.5)};
}
