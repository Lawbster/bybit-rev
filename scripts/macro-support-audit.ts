/** Independent MS01 source, gate-state and ledger attribution review. */
import assert from 'assert/strict';
import type {Candle} from './hype-freerun-canonical-replay';
import type {Frame,Variant,GateRow,Transition,Block,Watch} from './macro-support-policy';
type R=Record<string,any>;const P=14400000,DAY=86400000;
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
export function auditFrames(cs:Candle[],frames:Frame[],lag:number){
  const buckets=new Map<number,R>();for(const c of cs){const ts=Math.floor(c.ts/P)*P;let b=buckets.get(ts);if(!b){b={ts,first:c.ts,n:0,open:c.open,high:-Infinity,low:Infinity,close:c.close};buckets.set(ts,b);}
    assert.equal(c.ts,b.first+b.n*60000,'source bucket continuity');b.n++;b.high=Math.max(b.high,c.high);b.low=Math.min(b.low,c.low);b.close=c.close;
  }
  const complete=[...buckets.values()].filter(b=>b.n===240&&b.first===b.ts),get=(ts:number)=>{const b=buckets.get(ts);assert(b&&b.n===240&&b.first===b.ts);return b;};
  assert.equal(frames.length,complete.length);let previous:number|null=null,run=0,events=0,touches=0;
  const active=new Map<string,{role:string;known:number}>();
  for(let i=0;i<frames.length;i++){
    const f=frames[i],b=complete[i];assert.deepEqual(f.bar,{ts:b.ts,endTs:b.ts+P,open:b.open,high:b.high,low:b.low,close:b.close,minutes:240});assert.equal(f.at,f.bar.endTs+lag);
    run=previous===null||b.ts===previous?run+1:1;previous=b.ts+P;assert.equal(f.healthy,run>=720);
    for(const e of f.events){assert.equal(e.at,f.at);assert.equal(e.barEnd,f.bar.endTs);assert.equal(e.healthy,f.healthy);assert.equal(e.close,b.close);
      if(e.kind==='qualified'){assert.equal(e.zone.firstKnownAt,e.at);assert.equal(e.zone.touches.length,2);assert(!active.has(e.zone.id));active.set(e.zone.id,{role:e.zone.origin,known:e.at});}
      if(e.kind==='expired')active.delete(e.zone.id);
      if(['breakout_accepted','reclaimed','support_failed'].includes(e.kind)){
        const old=active.get(e.zone.id);assert(old);const failure=e.kind==='support_failed';assert.equal(old.role,failure?'support':'resistance');
        for(let k=1;k<=2;k++){const past=get(e.barEnd-k*P);assert(past.ts+lag>=old.known);assert(failure?past.close<e.zone.lower:past.close>e.zone.upper);}
        old.role=failure?'resistance':'support';
      }
      if(e.kind==='support_retest_held'){assert(b.low<=e.zone.upper&&b.high>=e.zone.lower&&b.close>e.zone.upper);assert(e.zone.lastFlipAt!==null&&e.at>e.zone.lastFlipAt);}
      events++;
    }
    assert.deepEqual(f.zones.map(z=>z.id).sort(),[...active.keys()].sort());
    for(const z of f.zones){const a=active.get(z.id)!;assert.equal(z.role,a.role);assert.equal(z.firstKnownAt,a.known);assert(z.firstKnownAt!<=f.at);assert(z.qualified&&z.touches.length>=2);
      const [,seedTs,side]=z.id.split(':'),seed=get(Number(seedTs));assert.equal(z.center,side==='resistance'?seed.high:seed.low);
      near(z.lower,z.center*.9925);near(z.upper,z.center*1.0075);assert.equal(z.createdAt,Number(seedTs)+4*P+lag);
      for(let j=0;j<z.touches.length;j++){const t=z.touches[j],pivot=get(t.pivotAt);assert.equal(t.knownAt,t.pivotAt+4*P+lag);assert(t.knownAt<=f.at&&t.knownAt>=f.at-120*DAY);
        assert.equal(t.price,t.side==='support'?pivot.low:pivot.high);assert(t.price>=z.lower&&t.price<=z.upper);
        for(let k=-3;k<=3;k++)if(k){const n=get(t.pivotAt+k*P);assert(t.side==='support'?n.low>t.price:n.high<t.price);}
        if(j)assert(t.pivotAt-z.touches[j-1].pivotAt>=DAY);touches++;
      }
    }
  }
  return{frames:frames.length,events,touches};
}
/** Independently reconstructs the watch/failure/release automaton, not its producer. */
export function auditGate(frames:Frame[],v:Variant,recorded:{rows:GateRow[];events:Transition[]}){
  let w:Watch|null=null,b:Block|null=null,previous:number|null=null;const transitions:Transition[]=[];assert.equal(frames.length,recorded.rows.length);
  const ref=(z:R)=>({id:z.id,lower:z.lower,upper:z.upper,origin:z.origin,firstKnownAt:z.firstKnownAt});
  for(let i=0;i<frames.length;i++){
    const f=frames[i],close=f.bar.close,emit=(kind:Transition['kind'],zone:any,blockId:string|null)=>transitions.push({kind,at:f.at,barEnd:f.bar.endTs,zone:{...zone},blockId,close});
    if(previous!==null&&f.bar.ts!==previous){if(w)w.below=0;if(b)b.above=0;}previous=f.bar.endTs;
    if(!f.healthy){if(w)w.below=0;if(b)b.above=0;}
    else{
      if(b){b.above=close>b.zone.upper?b.above+1:0;let release:Transition['kind']|null=null;
        if(!f.zones.find(z=>z.id===b!.zone.id))release='retired';else if(b.above===2)release='reclaim';else if(b.expiresAt!==null&&f.at>=b.expiresAt)release='timeout';
        if(release){emit(release,b.zone,b.id);w=null;b=null;}
      }
      if(!b){
        if(w&&!f.zones.find(z=>z.id===w!.zone.id))w=null;
        if(w){const held=w as Watch;assert(held.armedAt<f.at);held.below=close<held.zone.lower?held.below+1:0;
          if(held.below===2){const id:string=`${held.zone.id}@${f.at}`;assert(f.events.some(e=>e.kind==='support_failed'&&e.zone.id===held.zone.id));
            b={id,zone:{...held.zone},watchArmedAt:held.armedAt,failedAt:f.at,expiresAt:v.maxBlockHours===null?null:f.at+v.maxBlockHours*3600000,above:0};emit('failure',held.zone,id);w=null;}
        }
        if(!b&&(!w||close>w.zone.upper)){
          const candidates=f.zones.filter(z=>z.qualified&&z.role==='support'&&z.firstKnownAt!==null&&z.firstKnownAt<=f.at&&close>=z.upper&&close<=z.upper*(1.03+1e-12)
            &&(v.scope==='any_support'||z.origin==='resistance'&&z.lastFlipAt!==null));
          candidates.sort((a,z)=>z.upper-a.upper||z.touches.length-a.touches.length||a.firstKnownAt!-z.firstKnownAt!||a.id.localeCompare(z.id));
          const chosen=candidates[0];if(chosen?.id!==(w as Watch|null)?.zone.id){w=chosen?{zone:ref(chosen),armedAt:f.at,below:0}:null;if(w)emit('watch',w.zone,null);}
        }
      }
    }
    assert.deepEqual(recorded.rows[i],{at:f.at,barEnd:f.bar.endTs,close,healthy:f.healthy,watch:w,block:b},`gate row ${v.id}/${f.at}`);
  }
  assert.deepEqual(recorded.events,transitions);return{rows:frames.length,failures:transitions.filter(t=>t.kind==='failure').length};
}
export function independentContext(rows:GateRow[],at:number,lag:number){
  let left=0,right=rows.length;while(left<right){const middle=Math.floor((left+right)/2);if(rows[middle].at<=at)left=middle+1;else right=middle;}
  const f=rows[left-1],healthy=!!f?.healthy&&f.barEnd===Math.floor((at-lag)/P)*P;
  return{healthy,blocked:!healthy||!!f?.block,reason:!healthy?'macro_context_unknown':f?.block?'major_support_failed':'clear',frameAt:f?.at??null,barEnd:f?.barEnd??null,blockId:f?.block?.id??null,zoneId:f?.block?.zone.id??null};
}
export function auditEntries(cs:Candle[],x:R,events:R[],checks:R[],attempts:R[],gate:{rows:GateRow[]}|null){
  const attemptsByIndex=new Map(attempts.map(a=>[a.index,a])),opens=new Map(events.filter(e=>e.event.kind==='open').map(e=>[e.event.decisionIndex,e]));
  let pointer=0,inv:R[]=[],veto=0;const spellIds=new Set<string>();assert.equal(new Set(checks.map(c=>c.index)).size,checks.length);
  for(const c of checks){while(pointer<events.length&&events[pointer].event.fillIndex<=c.index)inv=events[pointer++].after;
    assert.equal(c.at,cs[c.index].endTs);assert.equal(c.nextDepth,inv.length+1);assert.equal(c.price,cs[c.index].close);
    const context=gate&&c.nextDepth===1?independentContext(gate.rows,c.at,x.lag):null,fire=context!==null&&context.blocked;
    assert.deepEqual(c.context,context);assert.equal(c.fire,fire);if(c.nextDepth>1)assert(!c.fire);
    if(fire){assert.equal(c.nextDepth,1);assert(!attemptsByIndex.has(c.index));assert(!opens.has(c.index));veto++;if(context!.blockId)spellIds.add(context!.blockId);}
    else{assert(attemptsByIndex.has(c.index));if(c.index+1<x.endIdx)assert(opens.has(c.index));}
  }
  for(const a of attempts)assert(checks.some(c=>c.index===a.index&&!c.fire));assert.equal(veto,x.counts.vetoMinutes);
  assert.deepEqual([...spellIds],x.counts.failureIds);assert.equal(spellIds.size,x.counts.affectedFailureEvents);
  pointer=0;inv=[];let flat=0,blocked=0,unknown=0;
  for(let i=x.startIdx;i<x.endIdx;i++){while(pointer<events.length&&events[pointer].event.fillIndex<=i)inv=events[pointer++].after;if(!inv.length){flat++;if(gate){const q=independentContext(gate.rows,cs[i].endTs,x.lag);if(q.blocked)blocked++;if(!q.healthy)unknown++;}}}
  assert.equal(flat,x.counts.flatMinutes);assert.equal(blocked,x.counts.blockedFlatMinutes);assert.equal(unknown,x.counts.unknownFlatMinutes);
  return{checks:checks.length,vetoMinutes:veto,flatMinutes:flat};
}
export function episodeAttribution(x:R,b:R,baselineEvents:R[],gate:{rows:GateRow[]}){
  const byEntry=new Map(x.metrics.episodes.map((e:R)=>[e.entry,e])),baseEntries=new Set(b.metrics.episodes.map((e:R)=>e.entry));
  const summarize=(es:R[])=>({count:es.length,wins:es.filter(e=>e.pnl>0).length,losses:es.filter(e=>e.pnl<0).length,
    winning:es.reduce((n,e)=>n+Math.max(0,e.pnl),0),losing:es.reduce((n,e)=>n+Math.min(0,e.pnl),0),net:es.reduce((n,e)=>n+e.pnl,0)});
  const removed=b.metrics.episodes.filter((e:R)=>!byEntry.has(e.entry)),replacement=x.metrics.episodes.filter((e:R)=>!baseEntries.has(e.entry));
  const first=new Map(baselineEvents.filter(e=>e.event.kind==='open'&&e.before.length===0).map(e=>[new Date(e.event.fillAt).toISOString(),e]));
  const direct=removed.filter((e:R)=>{const entry=first.get(e.entry);assert(entry);return independentContext(gate.rows,entry.event.decisionAt,x.lag).blocked;});
  // Disjoint overlapping-ladder components account for replacement occupancy, not selected baseline losses alone.
  const all=[...b.metrics.episodes.map((e:R)=>({...e,side:'baseline'})),...x.metrics.episodes.map((e:R)=>({...e,side:'variant'}))].sort((a,b)=>Date.parse(a.entry)-Date.parse(b.entry));
  const groups:R[]=[];for(const e of all){const start=Date.parse(e.entry),end=Date.parse(e.close);let g=groups.at(-1);
    if(!g||start>g.end){g={start,end,baseline:[],variant:[]};groups.push(g);}else g.end=Math.max(g.end,end);g[e.side].push(e);}
  const components=groups.map(g=>({start:g.start,end:g.end,startIso:new Date(g.start).toISOString(),endIso:new Date(g.end).toISOString(),baseline:summarize(g.baseline),variant:summarize(g.variant),
    delta:g.variant.reduce((n:number,e:R)=>n+e.pnl,0)-g.baseline.reduce((n:number,e:R)=>n+e.pnl,0)})).filter(g=>Math.abs(g.delta)>1e-6);
  const completedDelta=x.metrics.grossWin-x.metrics.grossLoss-b.metrics.grossWin+b.metrics.grossLoss;near(components.reduce((n,g)=>n+g.delta,0),completedDelta);
  const positive=components.filter(g=>g.delta>0).sort((a,b)=>b.delta-a.delta),netDelta=x.metrics.totalPnl-b.metrics.totalPnl;
  return{removed:summarize(removed),replacement:summarize(replacement),directlyBlockedRemoved:summarize(direct),
    matchedCount:x.metrics.episodes.length-replacement.length,components,largestPositiveComponents:positive.slice(0,5),
    netDeltaExcludingLargestPositive:netDelta-(positive[0]?.delta??0),netDeltaExcludingTwoLargestPositive:netDelta-positive.slice(0,2).reduce((n,g)=>n+g.delta,0),
    note:'Component exclusion is arithmetic concentration, not a rerun. Components include completed episodes; ending open/unfinished contribution remains separate.'};
}
