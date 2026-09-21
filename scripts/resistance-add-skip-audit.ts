/** Descriptive reach and intervention accounting, never a trading input. */
import assert from 'assert/strict';
import type {Candle} from './hype-freerun-canonical-replay';
import type {ResearchAddDecision} from './replay-causal-engine';
import {ResistanceSkip,type R} from './resistance-add-skip-policy';
export function archivedOpportunity(cs:Candle[],x:R,events:R[],attempts:R[],probes:R[],cfg:R){
  const ctl=new ResistanceSkip(cs,cfg.srShadow,0,false),lookup=new Map(probes.map(p=>[p.index,p]));
  const permits=new Map(attempts.map(p=>[p.index,p])),opens=new Map(events.filter(e=>e.event.kind==='open').map(e=>[e.event.decisionIndex,e]));
  assert.equal(lookup.size,probes.length);assert.equal(permits.size,attempts.length);assert.equal(lookup.size,permits.size);
  let ptr=0,inv:R[]=[],lastAdd=0;const rows:R[]=[];
  for(let i=x.startIdx;i<x.endIdx;i++){
    const at=cs[i].endTs;ctl.advance(at);
    while(events[ptr]?.event.fillIndex===i){inv=events[ptr].after;lastAdd=events[ptr].lastAddTime;ptr++;}
    const a=lookup.get(i);if(!a)continue;
    assert.equal(a.at,at);assert.equal(a.nextDepth,inv.length+1);assert.equal(a.price,cs[i].close);
    const drop=cfg.priceTriggerPct>0&&inv.length>0&&a.price<=inv.at(-1)!.entryPrice*(1-cfg.priceTriggerPct/100);
    assert.equal(a.priceDropOk,drop);assert(!a.blocked);assert(permits.has(i));assert.equal(ctl.veto(a as ResearchAddDecision),false);
    const filled=opens.get(i),pending=x.pendingAtEnd?.kind==='open'&&x.pendingAtEnd.decisionIndex===i;
    assert(filled||pending,'Every approved add must fill or remain pending at cutoff');
    if(filled){assert.equal(filled.event.fillIndex,i+1);assert.equal(filled.event.fillAt,cs[i+1].ts);assert.equal(filled.event.price,cs[i+1].open);assert.equal(filled.event.reason,drop?'price_drop':'time_add');}
    rows.push({...ctl.probes.at(-1),lastAddTime:lastAdd,existingDepth:inv.length,requestedNotional:permits.get(i)!.requestedNotional,
      fill:filled?.event??null,pending:!!pending});
  }
  assert.equal(rows.length,probes.length);assert.equal(opens.size+(x.pendingAtEnd?.kind==='open'?1:0),rows.length);
  return rows;
}
export function reachSummary(rows:R[],events:R[],x:R){
  const close=new Map(events.filter(e=>e.event.kind==='close').map(e=>[e.episode,e.event.fillAt]));
  const outcomes=new Map(x.metrics.episodes.map((e:R)=>[Date.parse(e.close),e]));
  const count=(rs:R[])=>{
    const ids=[...new Set(rs.map(r=>r.episode))],es=ids.map(id=>outcomes.get(close.get(id))).filter(Boolean) as R[];
    return{decisions:rs.length,fills:rs.filter(r=>r.fill).length,pending:rs.filter(r=>r.pending).length,ladders:ids.length,
      wins:es.filter(e=>e.pnl>0).length,winning:es.reduce((s,e)=>s+Math.max(0,e.pnl),0),losses:es.filter(e=>e.pnl<0).length,
      losing:es.reduce((s,e)=>s+Math.min(0,e.pnl),0),open:ids.length-es.length};
  };
  const selected=rows.filter(r=>r.wouldSkip);
  return{all:count(rows),timer:count(rows.filter(r=>!r.priceDropOk)),deepTimer:count(rows.filter(r=>!r.priceDropOk&&r.nextDepth>=6)),
    healthyDeepTimer:count(rows.filter(r=>!r.priceDropOk&&r.nextDepth>=6&&r.feature.healthy)),selected:count(selected),
    dropExempt:count(rows.filter(r=>r.priceDropOk)),byNextDepth:Array.from({length:11},(_,i)=>({nextDepth:i+1,all:count(rows.filter(r=>r.nextDepth===i+1)),selected:count(selected.filter(r=>r.nextDepth===i+1))})),
    monthly:[...new Set(rows.map(r=>new Date(r.at).toISOString().slice(0,7)))].map(month=>({month,all:count(rows.filter(r=>new Date(r.at).toISOString().startsWith(month))),selected:count(selected.filter(r=>new Date(r.at).toISOString().startsWith(month)))}))};
}
export function interventionSummary(probes:R[],events:R[],x:R){
  const blocked=probes.filter(p=>p.blocked),spells:R[]=[];let last:R|null=null;
  for(const p of blocked){
    if(last&&last.episode===p.episode&&last.nextDepth===p.nextDepth&&last.lastAt===p.at-60000){last.lastAt=p.at;last.checks++;}
    else{last={episode:p.episode,nextDepth:p.nextDepth,firstAt:p.at,lastAt:p.at,checks:1};spells.push(last);}
  }
  // Multiple spells can precede the same next action; report spells, not independent trades.
  for(const z of spells){const next=events.find(e=>e.episode===z.episode&&e.event.decisionAt>=z.firstAt&&e.event.fillAt>z.firstAt);
    Object.assign(z,{nextKind:next?.event.kind??null,nextReason:next?.event.reason??null,nextAt:next?.event.fillAt??null,
      elapsedMinutes:next?(next.event.fillAt-z.firstAt)/60000:null,censored:!next});}
  return{approvedChecks:probes.length,blockedChecks:blocked.length,affectedEpisodes:new Set(blocked.map(p=>p.episode)).size,
    priceDropBlocked:blocked.filter(p=>p.priceDropOk).length,spells:spells.length,
    followedByTimer:spells.filter(z=>z.nextKind==='open'&&z.nextReason==='time_add').length,
    followedByDrop:spells.filter(z=>z.nextKind==='open'&&z.nextReason==='price_drop').length,
    followedByReduction:spells.filter(z=>z.nextKind==='close'||z.nextKind==='partial').length,censored:spells.filter(z=>z.censored).length,details:spells};
}
