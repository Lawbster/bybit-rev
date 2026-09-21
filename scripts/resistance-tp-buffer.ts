/** SRT02 matched diagnostics, not orders or portfolio simulation. */
import assert from 'assert/strict';
import {futureLabel,type R} from './resistance-tp-opportunity';
import type {Candle} from './hype-freerun-canonical-replay';

export function candidate(a:R,bufferPct=.3,minimumTpPct=1){
  assert.equal(a.targetPct,1.4,'SRT02 never shades stale targets');
  const raw=a.shade*(1-bufferPct/100),floor=a.avg*(1+minimumTpPct/100),price=Math.max(raw,floor);
  assert(price<=a.shade+1e-9&&price<a.normalTarget);
  return{price,raw,floor,clipped:raw<floor,alreadyAtIntent:a.price>=price,
    tpPct:100*(price/a.avg-1),offsetPct:100*(1-price/a.shade),
    extraGiveUp:a.qty*(a.shade-price)*.99945};
}
export function labelPair(cs:Candle[],x:R,events:R[],targets:R[],a:R,exact:R){
  const c=candidate(a);
  const buffered=c.alreadyAtIntent?null:futureLabel(cs,x,events,targets,{...a,shade:c.price});
  const next=a.index+1;
  const intent=c.alreadyAtIntent?{index:next,observed:next<x.endIdx,
    at:next<x.endIdx?cs[next].ts:null,fill:next<x.endIdx?cs[next].open:null,
    proxyNet:next<x.endIdx?a.qty*cs[next].open-a.cost-.00055*(a.qty*cs[next].open+a.cost):null}:null;
  return{anchorIndex:a.index,at:a.at,episode:a.episode,candidate:c,exact,buffered,intent};
}
export const exactHit=(p:R)=>p.exact.hit!==null&&p.exact.fill!==null&&!p.exact.competing;
export const futureHit=(p:R)=>p.buffered&&p.buffered.hit!==null&&p.buffered.fill!==null&&!p.buffered.competing;
export const intentHit=(p:R)=>Boolean(p.intent?.observed);
export const unionHit=(p:R)=>Boolean(futureHit(p)||intentHit(p));
export function cohort(ps:R[]){
  const unique=[...new Map(ps.map(p=>[p.episode,p])).values()],closed=unique.filter(p=>p.exact.baselineOutcome);
  return{ladders:unique.length,wins:closed.filter(p=>p.exact.baselineOutcome.pnl>0).length,
    winDollars:closed.reduce((n,p)=>n+Math.max(0,p.exact.baselineOutcome.pnl),0),
    losses:closed.filter(p=>p.exact.baselineOutcome.pnl<0).length,
    lossDollars:closed.reduce((n,p)=>n+Math.min(0,p.exact.baselineOutcome.pnl),0),open:unique.length-closed.length};
}
export function stats(ps:R[]){
  const exact=ps.filter(exactHit),future=ps.filter(futureHit),intent=ps.filter(intentHit),union=ps.filter(unionHit);
  const old=new Set(exact.map(p=>p.episode)),added=union.filter(p=>!old.has(p.episode));
  const quantile=(vs:number[],q:number)=>vs.length?vs.slice().sort((a,b)=>a-b)[Math.floor((vs.length-1)*q)]:null;
  const savedTime=union.filter(exactHit).map(p=>p.exact.hitAt-(intentHit(p)?p.at:p.buffered.hitAt));
  return{anchors:ps.length,eligible:cohort(ps),floorClipped:ps.filter(p=>p.candidate.clipped).length,
    exactAnchors:exact.length,futureAnchors:future.length,intentAnchors:intent.length,unionAnchors:union.length,
    exact:cohort(exact),future:cohort(future),intent:cohort(intent),union:cohort(union),added:cohort(added),
    recoveredMissAnchors:union.filter(p=>!exactHit(p)).length,
    competing:ps.filter(p=>p.buffered?.competing).length,
    sameBar:future.filter(p=>p.buffered.sameBar).length,
    shadeOnly:cohort(future.filter(p=>p.buffered.shadeOnly)),
    medianTpPct:quantile(ps.map(p=>p.candidate.tpPct),.5),
    medianOffsetPct:quantile(ps.map(p=>p.candidate.offsetPct),.5),
    medianExtraGiveUp:quantile(union.map(p=>p.candidate.extraGiveUp),.5),
    medianTotalGiveUp:quantile(union.map(p=>p.exact.targetGiveUp+p.candidate.extraGiveUp),.5),
    earlierAnchors:savedTime.filter(n=>n>0).length,medianEarlierMinutes:quantile(savedTime.map(n=>n/60000),.5)};
}
