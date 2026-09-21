/** Independent SRR01 chronology: no wait/shade controller or replay execution imports. */
import assert from 'assert/strict';
import type {Candle} from './hype-freerun-canonical-replay';
type R=Record<string,any>;const M=60000,H=3600000;
export function selectedCloses(events:R[],targets:R[],selections:R[]):R[]{
  const rows:R[]=[];let mutation=-1;
  for(const x of events){const e=x.event;
    if(e.kind==='close'&&e.reason==='tp'&&x.before.length&&!x.after.length){
      const sel=selections.filter(s=>s.episode===x.episode&&s.index>=mutation&&s.index<e.fillIndex).at(-1);
      const target=targets.filter(t=>t.episode===x.episode&&t.index<e.fillIndex&&t.index<=e.decisionIndex).at(-1);
      if(sel&&target&&target.pct===1.4&&Math.abs(target.targetPrice-sel.selectedPrice)<1e-8){
        assert(sel.resistance>0);rows.push({episode:x.episode,selectionIndex:sel.index,selectionAt:sel.at,resistance:sel.resistance,target:sel.selectedPrice,
          fillAt:e.fillAt,fillIndex:e.fillIndex,expiresAt:e.fillAt+4*H});
      }
    }mutation=e.fillIndex;
  }return rows;
}
// Direct minute lookup/contiguity check, independent of the worker's prebuilt5m aggregator.
export function releaseFor(cs:Candle[],byStart:Map<number,number>,q:R,mode:string,lag:number,endAt:number):R{
  if(mode==='off')return{releasedAt:q.fillAt,releaseReason:'off',releaseBar:null};
  let at=q.expiresAt,reason='cap',bar:R|null=null;
  if(mode==='breakout4h')for(let start=Math.ceil(q.fillAt/300000)*300000;start+300000+lag<q.expiresAt;start+=300000){
    const idx=byStart.get(start);if(idx===undefined)continue;const segment=cs.slice(idx,idx+5);
    if(segment.length!==5||segment.some((c,j)=>c.ts!==start+j*M||c.endTs!==start+(j+1)*M))continue;
    const close=segment[4].close,available=start+300000+lag;
    if(available>endAt)break;
    if(close>q.resistance*1.001){at=available;reason='breakout';bar={start,end:start+300000,close,availableAt:available};break;}
  }
  return at<=endAt?{releasedAt:at,releaseReason:reason,releaseBar:bar}:{releasedAt:null,releaseReason:null,releaseBar:null};
}
export function reconstruct(cs:Candle[],row:R,events:R[],targets:R[],selections:R[],probes:R[]){
  const starts=new Map(cs.map((c,i)=>[c.ts,i])),endAt=cs[row.endIdx-1].endTs,qualified=selectedCloses(events,targets,selections),episodes=row.metrics.episodes;
  return qualified.map(q=>{
    const next=events.find(e=>e.event.kind==='open'&&!e.before.length&&e.event.fillIndex>q.fillIndex),outcome=next?episodes.find((e:R)=>Date.parse(e.entry)===next.event.fillAt):null;
    const fresh=probes.filter(p=>p.nextDepth===1&&p.at>q.fillAt&&(!next||p.at<=next.event.decisionAt));
    const w=releaseFor(cs,starts,q,'wait4h',row.lag??0,endAt),r=releaseFor(cs,starts,q,'breakout4h',row.lag??0,endAt);
    const decision=next?.event.decisionAt??null;
    return{...q,fillIso:new Date(q.fillAt).toISOString(),month:new Date(q.fillAt).toISOString().slice(0,7),
      firstEligibleAt:fresh[0]?.at??null,nextEntryAt:next?.event.fillAt??null,nextEntryPrice:next?.event.price??null,nextEpisode:next?.episode??null,
      nextEntryDecisionAt:decision,nextClose:outcome?.close??null,nextPnl:outcome?.pnl??null,nextReason:outcome?.reason??null,censored:!outcome,
      nextEntryBelowFrozenResistance:next?next.event.price<q.resistance:null,waitRelease:w,breakoutRelease:r,
      firstEntryBlockedW:decision===null?null:w.releasedAt===null||decision<w.releasedAt,
      firstEntryBlockedR:decision===null?null:r.releasedAt===null||decision<r.releasedAt};
  });
}
export function auditWait(cs:Candle[],row:R,events:R[],targets:R[],selections:R[],probes:R[],actual:R[]){
  const q=selectedCloses(events,targets,selections),starts=new Map(cs.map((c,i)=>[c.ts,i])),endAt=cs[row.endIdx-1].endTs;
  assert.equal(q.length,actual.length,`qualification ${row.name}`);const mode=row.waitMode??'off';
  const expected:R[]=q.map(z=>{const release=releaseFor(cs,starts,z,mode,row.lag,endAt),next=events.find(e=>e.event.kind==='open'&&!e.before.length&&e.event.fillIndex>z.fillIndex);
    const pp=probes.filter(p=>p.nextDepth===1&&p.at>z.fillAt&&(!next||p.at<=next.event.decisionAt));
    const blocks=pp.filter(p=>release.releasedAt===null||p.at<release.releasedAt);
    for(const p of pp){assert.equal(p.waitEpisode,z.episode);assert.equal(p.blocked,blocks.includes(p));}
    if(next)assert(release.releasedAt!==null&&next.event.decisionAt>=release.releasedAt,'no early fresh fill');
    return{...z,...release,firstEligibleAt:pp[0]?.at??null,blockedChecks:blocks.length,lastBlockedAt:blocks.at(-1)?.at??null,
      entryDecisionAt:next?.event.decisionAt??null,entryAt:next?.event.fillAt??null,entryPrice:next?.event.price??null,nextEpisode:next?.episode??null};
  });assert.deepEqual(actual,expected,`wait state ${row.name}`);
  for(const p of probes){if(p.nextDepth>1)assert.equal(p.blocked,false,'existing ladder untouched');
    if(p.waitEpisode===null)assert.equal(p.blocked,false,'no unqualified wait');
    else assert(expected.some(q=>q.episode===p.waitEpisode&&p.at>q.fillAt&&(!q.entryDecisionAt||p.at<=q.entryDecisionAt)));}
  return{qualified:q.length,blockedChecks:probes.filter(p=>p.blocked).length,blockedEpisodes:actual.filter(q=>q.blockedChecks>0).length,
    breakoutReleases:actual.filter(q=>q.releaseReason==='breakout').length,capReleases:actual.filter(q=>q.releaseReason==='cap').length,
    waitHours:actual.reduce((n,q)=>n+((q.releasedAt??endAt)-q.fillAt)/H,0),unfinished:actual.filter(q=>q.entryAt===null).length};
}
export function diagnosticSummary(rows:R[]){
  const sum=(rs:R[])=>({n:rs.length,wins:rs.filter(q=>q.nextPnl>0).length,winDollars:rs.reduce((n,q)=>n+Math.max(0,q.nextPnl??0),0),
    losses:rs.filter(q=>q.nextPnl<0).length,lossDollars:rs.reduce((n,q)=>n+Math.min(0,q.nextPnl??0),0),censored:rs.filter(q=>q.censored).length});
  return{all:sum(rows),underResistance:sum(rows.filter(q=>q.nextEntryBelowFrozenResistance)),
    W:sum(rows.filter(q=>q.firstEntryBlockedW)),R:sum(rows.filter(q=>q.firstEntryBlockedR)),
    months:[...new Set(rows.map(q=>q.month))].map(month=>({month,all:sum(rows.filter(q=>q.month===month)),W:sum(rows.filter(q=>q.month===month&&q.firstEntryBlockedW)),R:sum(rows.filter(q=>q.month===month&&q.firstEntryBlockedR))}))};
}
