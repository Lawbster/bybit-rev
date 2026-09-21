/** Descriptive groups and occupancy attribution, never a strategy selector. */
import fs from 'fs';
import assert from 'assert/strict';
import {componentAttribution} from './ladder-combination-accounting';
import {exposureDelta} from './ladder-exposure-metrics';
import type {R} from './entry-quality-features';
const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
const sum=(xs:R[],f:(x:R)=>number)=>xs.reduce((n,x)=>n+f(x),0);
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
function describe(xs:R[],variant:R){const completed=xs.filter(x=>x.label.episode),vm=new Map(variant.metrics.episodes.map((e:R)=>[e.entry,e]));
  const matched=completed.filter(x=>vm.has(x.label.episode.entry)),removed=completed.filter(x=>!vm.has(x.label.episode.entry));
  const delta=matched.map(x=>({at:x.decision.at,entry:x.label.episode.entry,baseline:x.label.episode.pnl,
    delta:(vm.get(x.label.episode.entry)as R).pnl-x.label.episode.pnl}));
  const price=xs.filter(x=>x.label.prices.ready&&x.label.prices.complete15),filled=price.filter(x=>x.label.prices.fillAt!==null);
  const changes=filled.map(x=>x.label.prices.entryChangeBps),phases:R={};
  for(const x of xs)if(x.label.intentOutcome){const i=x.label.intentOutcome,k=i.fillAt!==null?'filled':i.phase;phases[k]=(phases[k]??0)+1;}
  const monthly=Object.fromEntries([...new Set(delta.map(x=>new Date(x.at).toISOString().slice(0,7)))].map(m=>[m,
    delta.filter(x=>new Date(x.at).toISOString().startsWith(m)).reduce((n,x)=>n+x.delta,0)]));
  return {n:xs.length,episodes:new Set(xs.map(x=>x.entryAt)).size,completed:completed.length,
    wins:completed.filter(x=>x.label.episode.pnl>0).length,losses:completed.filter(x=>x.label.episode.pnl<0).length,
    winDollars:sum(completed,x=>Math.max(x.label.episode.pnl,0)),lossDollars:sum(completed,x=>Math.min(x.label.episode.pnl,0)),
    matched:matched.length,matchedDelta:sum(delta,x=>x.delta),matchedBetter:delta.filter(x=>x.delta>1e-6).length,matchedWorse:delta.filter(x=>x.delta< -1e-6).length,
    matchedLargestAbsolute:delta.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta))[0]??null,matchedDecisionMonthDelta:monthly,
    removed:removed.length,removedBaselineNet:sum(removed,x=>x.label.episode.pnl),
    complete15:price.length,censored:xs.length-price.length,capAvailable:filled.length,cheaper:changes.filter(x=>x< -1e-8).length,
    dearer:changes.filter(x=>x>1e-8).length,meanEntryChangeBps:mean(changes),
    meanLatencyMinutes:mean(filled.map(x=>x.label.prices.latencyMinutes)),
    upsideBeforeEntry05:price.filter(x=>x.label.prices.preEntryHighPct>=.5).length,
    upsideBeforeEntry14:price.filter(x=>x.label.prices.preEntryHighPct>=1.4).length,
    noCapButUp05:price.filter(x=>x.label.prices.fillAt===null&&x.label.prices.windows[15].hits.up05!==null).length,
    noCapButUp14:price.filter(x=>x.label.prices.fillAt===null&&x.label.prices.windows[15].hits.up14!==null).length,
    baselineTpWithin15:xs.filter(x=>['tp','stale_tp'].includes(x.label.baselineCloseWithin15m?.reason)).length,
    baselineOtherCloseWithin15:xs.filter(x=>x.label.baselineCloseWithin15m&&!['tp','stale_tp'].includes(x.label.baselineCloseWithin15m.reason)).length,
    mean1hClosePct:mean(xs.filter(x=>x.label.prices.windows?.[60]).map(x=>x.label.prices.windows[60].closePct)),
    mean4hClosePct:mean(xs.filter(x=>x.label.prices.windows?.[240]).map(x=>x.label.prices.windows[240].closePct)),actualWaitingPhases:phases};
}
export function analyze(out:string,rows:R[]){const cases:R[]=[],pairs:R[]=[];
  for(const row of rows){const source:R[]=read(`${out}/${row.name}-features.json`),labels:R[]=read(`${out}/${row.name}-labels.json`);
    assert.equal(source.length,labels.length);const xs:R[]=source.map((x,i)=>{assert.equal(x.id,labels[i].id);return {...x,label:labels[i]};});
    const variant=rows.find(x=>x.window===row.window&&x.tp===row.tp&&x.waiting)!;
    const groups:R[]=[];for(const [population,subset] of [
      ['first_deep_timer',xs.filter(x=>x.firstDeep)],['all_deep_timer',xs.filter(x=>x.scope==='deep_timer')],
      ['genuine_deep_drop',xs.filter(x=>x.scope==='deep_drop')],['first_entry',xs.filter(x=>x.scope==='first_entry')],
      ['waiting_intent',xs.filter(x=>x.scope==='waiting_intent')]]as const){if(!subset.length)continue;
      for(const clock of ['repaired_0','repaired_60000','raw_0','raw_60000']){
        const keys=['all',...Object.keys(subset[0].features[clock].categories),'joint'];
        for(const key of keys){const buckets=new Map<string,R[]>();for(const x of subset){const f=x.features[clock],v=key==='all'?'all':key==='joint'?f.joint:f.categories[key];
          if(!buckets.has(v))buckets.set(v,[]);buckets.get(v)!.push(x);}
          for(const [value,bucket] of buckets)groups.push({population,clock,key,value,...describe(bucket,variant)});}
      }
    }
    const sensitivity=Object.fromEntries(['raw_0','repaired_60000','raw_60000'].map(clock=>[clock,{
      n:xs.length,categoryChanges:xs.filter(x=>JSON.stringify(x.features.repaired_0.categories)!==JSON.stringify(x.features[clock].categories)).length,
      jointChanges:xs.filter(x=>x.features.repaired_0.joint!==x.features[clock].joint).length}]));
    cases.push({name:row.name,window:row.window,tp:row.tp,waiting:row.waiting,groups,sensitivity});
    if(!row.waiting)pairs.push({name:row.name,window:row.window,tp:row.tp,baseline:row.metrics,waiting:variant.metrics,
      delta:exposureDelta(variant.metrics,row.metrics),attribution:componentAttribution(variant.metrics,row.metrics)});
  }
  return {warning:'Descriptive association only. Repeated-decision dollar totals overlap; first_deep_timer counts once. Unknowns retained. No conditional strategy replay or qualification.',cases,pairs};
}
