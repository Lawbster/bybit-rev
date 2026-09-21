/** RP02 descriptive BTC -> HYPE atlas. No portfolio policy changes. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,verifyPins,sha,type Plan} from './research-workflow';
import {loadMinutes} from './relative-reversion-study';
import {missingMinutes} from './replay-candle-repair';
import {contexts,flags,confirmations,future,summary,percentile,H,HORIZONS,type R} from './rally-pullback-features';
import {btcContexts,btcSignals,eligible,SPECS} from './btc-movement-features';
import {views,clipped} from './rally-pullback-study';
export const CARD='research-inputs/btc-movement-atlas-2026-09-15.json';
export const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
export function summarize(ys:R[],h:number):R{const s=summary(ys,h),done=ys.map(y=>y.horizons[h]).filter(Boolean);
  for(const n of [2,5,10]){s['rise'+n]=done.filter(y=>y.highPct>=n).length;s['rise'+n+'Rate']=done.length?100*s['rise'+n]/done.length:null;}return s;}
export function analyze(grid:R[],es:R[],conf:R[],labels:Map<number,R>,d:R){
  const byAt=new Map(grid.map(x=>[x.at,x])),get=(t:number,end:number)=>clipped(labels.get(t)??{at:t,horizons:{}},end);
  const a:R={coverage:[],summaries:[],monthly:[],flags:[],descriptors:[],delays:[],confirmations:[]};
  for(const v of views(d))for(const lag of d.sourceLagMs){
    const inView=(x:R)=>x.at+lag>=v.start&&x.at+lag<v.end;
    const all=grid.filter(inView);
    for(const hours of d.lookbackHours){const gs=all.filter(x=>eligible(x,byAt.get(x.at-4*H),hours));
      a.coverage.push({view:v.id,lag,hours,total:all.length,eligible:gs.length,unknown:all.length-gs.length});
      for(const h of HORIZONS)a.summaries.push({view:v.id,lag,h,hours,family:`reference_${hours}h`,...summarize(gs.map(x=>get(x.at+lag,v.end)),h)});
      for(const spec of SPECS.filter(s=>s.hours===hours)){const picked=es.filter(e=>e.family===spec.id&&inView(e));
        for(const h of HORIZONS){const ref=summarize(gs.map(x=>get(x.at+lag,v.end)),h),out=summarize(picked.map(e=>get(e.at+lag,v.end)),h);
          const strata=new Map<string,R>();for(const x of picked){const c=byAt.get(x.at)!,key=new Date(x.at).toISOString().slice(0,7)+'_'+c.atrBucket;
            if(!strata.has(key))strata.set(key,summarize(gs.filter(g=>new Date(g.at).toISOString().slice(0,7)+'_'+g.atrBucket===key).map(g=>get(g.at+lag,v.end)),h));}
          let n=0,down=0,up=0;for(const e of picked){if(!get(e.at+lag,v.end).horizons[h])continue;
            const c=byAt.get(e.at)!,b=strata.get(new Date(e.at).toISOString().slice(0,7)+'_'+c.atrBucket)!;
            assert(b.complete);n++;down+=b.drop5Rate;up+=b.rise5Rate;}
          a.summaries.push({view:v.id,lag,h,hours,family:spec.id,direction:spec.direction,threshold:spec.threshold,...out,
            referenceDrop5:ref.drop5Rate,referenceRise5:ref.rise5Rate,matchedDrop5:n?down/n:null,matchedRise5:n?up/n:null,matchedN:n});
        }
        for(const month of [...new Set(picked.map(e=>new Date(e.at).toISOString().slice(0,7)))]){
          const same=(x:R)=>new Date(x.at).toISOString().startsWith(month);
          a.monthly.push({view:v.id,lag,family:spec.id,month,...summarize(picked.filter(same).map(e=>get(e.at+lag,v.end)),24),
            reference:summarize(gs.filter(same).map(e=>get(e.at+lag,v.end)),24)});
        }
        for(const flag of Object.keys(flags(grid[0]))){const known=picked.filter(e=>flags(byAt.get(e.at)!)[flag]!==null),hit=known.filter(e=>flags(byAt.get(e.at)!)[flag]);
          a.flags.push({view:v.id,lag,family:spec.id,flag,...summarize(hit.map(e=>get(e.at+lag,v.end)),24),baseline:summarize(known.map(e=>get(e.at+lag,v.end)),24)});}
        for(const group of ['drop5','not_drop5']){const selected=picked.filter(e=>{const y=get(e.at+lag,v.end).horizons[24];return y&&(y.lowPct<=-5)===(group==='drop5');});
          const median=(f:(e:R)=>number|null)=>percentile(selected.map(f).filter((n):n is number=>n!==null),.5);
          a.descriptors.push({view:v.id,lag,family:spec.id,group,n:selected.length,
            ...Object.fromEntries(['rsi','crsi','adx','rvol','upperWick','priorAtrPct','distance48hPct'].map(k=>[k,median(e=>byAt.get(e.at)![k])])),
            btcReturn:median(e=>e.btcReturn),hypeReturn:median(e=>e.hypeReturn),gapPct:median(e=>e.gapPct)});
        }
        for(const waitHours of d.cooldownHours){const pairs=picked.map(e=>({initial:get(e.at+lag,v.end),later:get(e.at+lag+waitHours*H,v.end)}))
            .filter(x=>x.initial.horizons[24]&&x.later.horizons[24]),changes=pairs.map(x=>100*(x.later.entry/x.initial.entry-1));
          a.delays.push({view:v.id,lag,family:spec.id,waitHours,n:pairs.length,cheaper:changes.filter(x=>x<0).length,dearer:changes.filter(x=>x>0).length,
            medianEntryChange:percentile(changes,.5),meanEntryChange:changes.length?changes.reduce((a,b)=>a+b,0)/changes.length:null,
            earlyUpside2:pairs.filter(x=>x.initial.horizons[waitHours].highPct>=2).length,baseline:summarize(pairs.map(x=>x.initial),24),delayed:summarize(pairs.map(x=>x.later),24)});
        }
      }
    }
    for(const family of d.confirmationFamilies)for(const kind of d.confirmations){const anchors=es.filter(e=>e.family===family&&inView(e)),ids=new Set(anchors.map(e=>e.id));
      const picked=conf.filter(c=>ids.has(c.event)&&c.kind===kind&&get(c.at+lag,v.end).horizons[24]);let matched=0;const controls:R[]=[];
      for(const hours of [4,8,12]){const n=picked.filter(c=>c.delayHours===hours).length,b=summarize(anchors.map(e=>get(e.at+lag+hours*H,v.end)),24);
        controls.push({hours,weight:n,...b});if(n){assert(b.complete);matched+=n*b.drop5Rate;}}
      a.confirmations.push({view:v.id,lag,family,kind,anchors:anchors.length,...summarize(picked.map(c=>get(c.at+lag,v.end)),24),
        matchedDrop5:picked.length?matched/picked.length:null,medianAlreadyMoved:percentile(picked.map(c=>c.alreadyMovedPct),.5),controls});
    }
  }return a;
}
async function worker(p:Plan,out:string){const d=p.card.definition,save=(f:string,x:any)=>atomicJson(path.join(out,f),x);
  const hype=await loadMinutes(process.cwd(),'HYPEUSDT',Date.parse(d.cutoff),d.repairFile),cs=hype.candles;
  assert.equal(missingMinutes(cs).length,0);assert.equal(cs.at(-1)!.endTs,Date.parse(d.cutoff));
  console.log('[RP02] Reproducing HYPE reference contexts before introducing BTC triggers');
  const hc=contexts(cs),hgrid=hc.filter(x=>x.at>=Date.parse(d.start));assert.deepEqual(hgrid,read(`${d.parent}/output/contexts.json`));
  const btc=await loadMinutes(process.cwd(),'BTCUSDT',Date.parse(d.cutoff));
  const grid=btcContexts(btc.candles,hc),es=btcSignals(grid,Date.parse(d.start),Date.parse(d.cutoff)),byAt=new Map(grid.map(x=>[x.at,x]));
  const conf=es.filter(e=>d.confirmationFamilies.includes(e.family)).flatMap(e=>d.confirmations.map((kind:string)=>confirmations(e,byAt,kind)).filter(Boolean));
  save('data-audit.json',[hype.audit,btc.audit]);save('contexts.json',grid);save('signals.json',es);save('confirmations.json',conf);
  const times=new Set<number>();for(const x of hgrid)for(const lag of d.sourceLagMs)times.add(x.at+lag);
  for(const e of es)for(const lag of d.sourceLagMs)for(const h of [4,8,12,24])times.add(e.at+lag+h*H);
  const oldLabels=new Map<number,R>(read(`${d.parent}/output/outcomes.json`).map((y:R)=>[y.at,y]));let parity=0;
  const labels=new Map<number,R>();for(const at of [...times].sort((a,b)=>a-b)){const y=future(cs,at);if(oldLabels.has(at)){assert.deepEqual(y,oldLabels.get(at));parity++;}labels.set(at,y);}
  save('outcomes.json',[...labels.values()]);save('analysis.json',analyze(grid,es,conf,labels,d));
  console.log(`[RP02] ${es.length} BTC rule-events / ${new Set(es.map(e=>e.at)).size} distinct times; ${parity} exact RP01 outcome controls`);
  const baselines:R[]=read(`${d.parent}/output/baselines.json`),rows:R[]=[];
  for(const b of baselines){const old=read(`${d.archive}/output/results.json`).find((x:R)=>x.name===b.name),raw=read(`${d.archive}/output/${b.name}-engine.json`);
    assert.deepEqual(b.metrics,old.metrics);assert.equal(sha(JSON.stringify(raw)),b.digest);
    const inv:R[]=read(`${d.archive}/output/${b.name}-events.json`);assert.deepEqual(raw.executionAudit.events,inv.map(x=>x.event));
    const byEntry=new Map<string,R>(b.metrics.episodes.map((e:R)=>[e.entry,e])),ep=new Map<number,R|undefined>(inv.filter(e=>e.event.kind==='open'&&!e.before.length).map(e=>[e.episode,byEntry.get(new Date(e.event.fillAt).toISOString())]));
    for(const s of SPECS)for(const waitHours of d.cooldownHours){const sig=es.filter(e=>e.family===s.id&&e.at+waitHours*H>Date.parse(b.start)&&e.at<Date.parse(b.end));
      const hit=inv.filter(e=>e.event.kind==='open'&&sig.some(x=>e.event.decisionAt>=x.at&&e.event.decisionAt<x.at+waitHours*H));
      const outcomes=[...new Set(hit.map(e=>e.episode))].map(e=>ep.get(e));
      rows.push({baseline:b.name,window:b.window,tp:b.tp,family:s.id,waitHours,signals:sig.length,adds:hit.length,firstRungs:hit.filter(e=>!e.before.length).length,
        deepAdds:hit.filter(e=>e.after.length>=8).length,winsTouched:outcomes.filter(e=>e&&e.pnl>0).length,lossesTouched:outcomes.filter(e=>e&&e.pnl<0).length,
        unfinishedTouched:outcomes.filter(e=>!e).length,emptyIntervals:sig.filter(x=>!hit.some(e=>e.event.decisionAt>=x.at&&e.event.decisionAt<x.at+waitHours*H)).length,
        changedNet:null,changedDD:null});}
  }
  save('baselines.json',baselines);save('add-intersections.json',rows);
  save('validation.json',{passed:true,hypeContextParity:hgrid.length,hypeOutcomeParity:parity,baselineDigests:baselines.length,ruleEvents:es.length,
    newTradingDefinitions:0,liveChanges:0,independentCheckRequired:true});
}
async function main(){const [cmd,key]=process.argv.slice(2),card=read(CARD),d=card.definition;
  assert.deepEqual(d.lookbackHours,[4,12,24,48,72]);assert.deepEqual(d.movePct,[6,10]);assert.deepEqual(d.directions,['rise','fall']);
  assert.equal(d.gridHours,4);assert.equal(d.separationHours,72);assert.deepEqual(d.sourceLagMs,[0,60000]);assert.deepEqual(d.outcomeHours,HORIZONS);
  assert.deepEqual(d.cooldownHours,[4,8,12,24]);assert.equal(d.triggerSymbol,'BTCUSDT');assert.equal(d.outcomeSymbol,'HYPEUSDT');assert.equal(d.newTradingDefinitions,0);
  if(cmd==='plan'){const p=read(`${d.parent}/plan.json`),state=read(`${d.parent}/state.json`);assert.equal(state.status,'complete');assert(read(`${d.parent}/verification.json`).passed);
    await verifyPins(process.cwd(),[...p.pins,...p.protectedPins,...state.artifacts]);
    const sources=new Set<string>([...p.pins.map((x:R)=>x.file),...state.artifacts.map((x:R)=>x.file),`${d.parent}/verification.json`,CARD,'docs/research/btc-movement-atlas-rp02.md']);
    for(const f of fs.readdirSync('scripts').filter(f=>f.startsWith('btc-movement-')&&f.endsWith('.ts')))sources.add(`scripts/${f}`);
    const plan=await createPlan(process.cwd(),card,[...sources],p.protectedPins.map((x:R)=>x.file));console.log(JSON.stringify({key:plan.key}));
  }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
