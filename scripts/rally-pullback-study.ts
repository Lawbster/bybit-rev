/** RP01: descriptive market atlas, NOT new trading economics. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,verifyPins,sha,type Plan} from './research-workflow';
import {loadMinutes} from './relative-reversion-study';
import {missingMinutes} from './replay-candle-repair';
import {contexts,signals,confirmations,flags,future,summary,percentile,FAMILIES,H,HORIZONS,type R} from './rally-pullback-features';
import {auditFlowLedger} from './entry-patience-ladder-audit';
export const CARD='research-inputs/rally-pullback-atlas-2026-09-15.json';
export const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
export function validate(d:R){assert.equal(d.gridHours,4);assert.deepEqual(d.lookbackHours,[4,12,24,48,72]);assert.deepEqual(d.risePct,[6,10]);
  assert.deepEqual(d.outcomeHours,HORIZONS);assert.deepEqual(d.cooldownHours,[4,8,12,24]);assert.equal(d.separationHours,72);
  assert.deepEqual(d.sourceLagMs,[0,60000]);assert.equal(d.referenceTrigger,'rise24h_6pct');assert.equal(d.newTradingDefinitions,0);}
export function views(d:R):R[]{return [{id:'full',start:Date.parse(d.start),end:Date.parse(d.cutoff)},
  {id:'pre_hl',start:Date.parse(d.start),end:Date.parse(d.recentStart)},
  {id:'hl_recent',start:Date.parse(d.recentStart),end:Date.parse(d.cutoff)},
  {id:'published',start:Date.parse(d.start),end:Date.parse(d.publishedEnd)}];}
export function clipped(o:R,end:number):R{return {...o,horizons:Object.fromEntries(Object.entries(o.horizons).filter(([,v])=>(v as R).end<=end))};}
export function analyze(grid:R[],events:R[],confirm:R[],outcomes:Map<number,R>,d:R){
  const byAt=new Map(grid.map(x=>[x.at,x])),get=(at:number,end:number)=>clipped(outcomes.get(at)??{at,ready:false,horizons:{}},end);
  const result:R={summaries:[],monthly:[],flags:[],descriptors:[],delays:[],confirmations:[]};
  for(const view of views(d))for(const lag of d.sourceLagMs){
    const gs=grid.filter(x=>x.at+lag>=view.start&&x.at+lag<view.end);
    for(const h of HORIZONS){const ref=summary(gs.map(x=>get(x.at+lag,view.end)),h);
      result.summaries.push({view:view.id,lag,h,family:'all_4h',...ref});
      const strata=new Map<string,R[]>();for(const x of gs){const key=new Date(x.at).toISOString().slice(0,7)+'_'+x.atrBucket;
        if(!strata.has(key))strata.set(key,[]);strata.get(key)!.push(get(x.at+lag,view.end));}
      for(const spec of FAMILIES){const es=events.filter(e=>e.family===spec.id&&e.at+lag>=view.start&&e.at+lag<view.end);
        const ys=es.map(e=>get(e.at+lag,view.end)),s=summary(ys,h),eligible=es.filter(e=>get(e.at+lag,view.end).horizons[h]);
        let matched2=0,matched5=0,matched=0;
        for(const e of eligible){const x=byAt.get(e.at)!,key=new Date(e.at).toISOString().slice(0,7)+'_'+x.atrBucket;
          const b=summary(strata.get(key)??[],h);if(b.complete){matched2+=b.drop2Rate;matched5+=b.drop5Rate;matched++;}}
        result.summaries.push({view:view.id,lag,h,family:spec.id,...s,referenceDrop2:ref.drop2Rate,referenceDrop5:ref.drop5Rate,
          matchedDrop2:matched?matched2/matched:null,matchedDrop5:matched?matched5/matched:null,matchedN:matched});
        if(h===24){for(const month of [...new Set(es.map(e=>new Date(e.at).toISOString().slice(0,7)))]){
          const ms=es.filter(e=>new Date(e.at).toISOString().startsWith(month)),rg=gs.filter(x=>new Date(x.at).toISOString().startsWith(month));
          result.monthly.push({view:view.id,lag,family:spec.id,month,...summary(ms.map(e=>get(e.at+lag,view.end)),24),
            reference:summary(rg.map(x=>get(x.at+lag,view.end)),24)});}
          for(const flag of Object.keys(flags(byAt.get(es[0]?.at)??grid[0]))){const known=es.filter(e=>flags(byAt.get(e.at)!)[flag]!==null),picked=known.filter(e=>flags(byAt.get(e.at)!)[flag]);
            result.flags.push({view:view.id,lag,family:spec.id,flag,...summary(picked.map(e=>get(e.at+lag,view.end)),24),
              baseline:summary(known.map(e=>get(e.at+lag,view.end)),24)});}
          for(const group of ['drop5','not_drop5']){const selected=es.filter(e=>{const y=get(e.at+lag,view.end).horizons[24];return y&&(y.lowPct<=-5)===(group==='drop5');});
            const median=(fn:(x:R)=>number|null)=>percentile(selected.map(e=>fn(byAt.get(e.at)!)).filter((n):n is number=>n!==null),.5);
            result.descriptors.push({view:view.id,lag,family:spec.id,group,n:selected.length,rsi:median(x=>x.rsi),crsi:median(x=>x.crsi),adx:median(x=>x.adx),
              rvol:median(x=>x.rvol),priorAtrPct:median(x=>x.priorAtrPct),upperWick:median(x=>x.upperWick),distance48hPct:median(x=>x.distance48hPct),
              ret4h:median(x=>x.returns[4]),ret24h:median(x=>x.returns[24]),uptrend:selected.filter(e=>byAt.get(e.at)!.trend==='up').length});}
        }
      }
    }
    for(const spec of FAMILIES){const es=events.filter(e=>e.family===spec.id&&e.at+lag>=view.start&&e.at+lag<view.end);
      for(const waitHours of d.cooldownHours){const pairs=es.map(e=>({at:e.at,initial:get(e.at+lag,view.end),later:get(e.at+lag+waitHours*H,view.end)}))
          .filter(x=>x.initial.horizons[24]&&x.later.horizons[24]);
        const changes=pairs.map(x=>100*(x.later.entry/x.initial.entry-1));
        result.delays.push({view:view.id,lag,family:spec.id,waitHours,n:pairs.length,cheaper:changes.filter(x=>x<0).length,dearer:changes.filter(x=>x>0).length,
          medianEntryChange:percentile(changes,.5),meanEntryChange:changes.length?changes.reduce((a,b)=>a+b,0)/changes.length:null,
          earlyUpside2:pairs.filter(x=>x.initial.horizons[waitHours].highPct>=2).length,
          baseline:summary(pairs.map(x=>x.initial),24),delayed:summary(pairs.map(x=>x.later),24)});
      }
    }
    const anchors=events.filter(e=>e.family===d.referenceTrigger&&e.at+lag>=view.start&&e.at+lag<view.end);
    for(const kind of d.confirmations){const selected=confirm.filter(c=>c.kind===kind&&anchors.some(e=>e.id===c.event)&&get(c.at+lag,view.end).horizons[24]);
      let matched2=0,matched5=0;const controls:R[]=[];
      for(const hours of [4,8,12]){const n=selected.filter(c=>c.delayHours===hours).length;
        const b=summary(anchors.map(e=>get(e.at+lag+hours*H,view.end)),24);controls.push({hours,weight:n,...b});
        if(n){assert(b.complete);matched2+=n*b.drop2Rate;matched5+=n*b.drop5Rate;}}
      result.confirmations.push({view:view.id,lag,kind,anchors:anchors.length,...summary(selected.map(c=>get(c.at+lag,view.end)),24),
        matchedDrop2:selected.length?matched2/selected.length:null,matchedDrop5:selected.length?matched5/selected.length:null,
        medianAlreadyMoved:percentile(selected.map(c=>c.alreadyMovedPct),.5),medianDelay:percentile(selected.map(c=>c.delayHours),.5),controls});
    }
  }return result;
}
async function worker(plan:Plan,out:string){const d=plan.card.definition;validate(d);const save=(n:string,x:unknown)=>atomicJson(path.join(out,n),x);
  const load=await loadMinutes(process.cwd(),'HYPEUSDT',Date.parse(d.cutoff),d.repairFile),cs=load.candles;
  assert.equal(missingMinutes(cs).length,0);assert.equal(cs.at(-1)!.endTs,Date.parse(d.cutoff));save('data-audit.json',load.audit);
  console.log('[RP01] Building closed 4h contexts');const all=contexts(cs),grid=all.filter(x=>x.at>=Date.parse(d.start)&&x.at<=Date.parse(d.cutoff));
  const events=signals(all,Date.parse(d.start),Date.parse(d.cutoff)),byAt=new Map(all.map(x=>[x.at,x]));
  const confirm=events.filter(e=>e.family===d.referenceTrigger).flatMap(e=>d.confirmations.map((kind:string)=>confirmations(e,byAt,kind)).filter(Boolean));
  save('contexts.json',grid);save('signals.json',events);save('confirmations.json',confirm);
  const times=new Set<number>();for(const x of grid)for(const lag of d.sourceLagMs)times.add(x.at+lag);
  for(const e of events)for(const lag of d.sourceLagMs)for(const h of [...d.cooldownHours,...d.confirmationHours])times.add(e.at+lag+h*H);
  const labels=new Map<number,R>();for(const at of [...times].sort((a,b)=>a-b))labels.set(at,future(cs,at));save('outcomes.json',[...labels.values()]);
  console.log(`[RP01] ${grid.length} references / ${events.length} rule-events / ${new Set(events.map(e=>e.at)).size} distinct signal times`);
  save('analysis.json',analyze(grid,events,confirm,labels,d));
  const archived:R[]=read(`${d.archive}/output/results.json`).filter((r:R)=>r.arm==='high_on'&&r.model==='open');assert.equal(archived.length,4);
  const baselines:R[]=[],intersections:R[]=[];
  for(const r of archived){const raw=read(`${d.archive}/output/${r.name}-engine.json`),inventory:R[]=read(`${d.archive}/output/${r.name}-events.json`);
    assert.equal(sha(JSON.stringify(raw)),r.digest);assert.deepEqual(raw.executionAudit.events,inventory.map(x=>x.event));
    const audit=auditFlowLedger(cs,inventory as any,read(`${d.archive}/output/${r.name}-attempts.json`),r.metrics,r.startIdx,r.endIdx);
    baselines.push({name:r.name,window:r.window,tp:r.tp,start:r.start,end:r.end,digest:r.digest,metrics:r.metrics,audit});
    const epOut=new Map<number,R>(),closedByEntry=new Map<string,R>(r.metrics.episodes.map((x:R)=>[x.entry,x]));
    for(const e of inventory.filter(e=>e.event.kind==='open'&&!e.before.length))epOut.set(e.episode,closedByEntry.get(new Date(e.event.fillAt).toISOString())??{reason:'unfinished',pnl:null});
    for(const spec of FAMILIES)for(const waitHours of d.cooldownHours){const es=events.filter(e=>e.family===spec.id&&e.at+waitHours*H>Date.parse(r.start)&&e.at<Date.parse(r.end));
      const hit=inventory.filter(e=>e.event.kind==='open'&&es.some(s=>e.event.decisionAt>=s.at&&e.event.decisionAt<s.at+waitHours*H));
      const touched=[...new Set(hit.map(e=>e.episode))].map(ep=>epOut.get(ep)!);
      intersections.push({baseline:r.name,window:r.window,tp:r.tp,family:spec.id,waitHours,signals:es.length,adds:hit.length,
        firstRungs:hit.filter(e=>!e.before.length).length,deepAdds:hit.filter(e=>e.after.length>=8).length,
        winsTouched:touched.filter(x=>x.pnl!==null&&x.pnl>0).length,lossesTouched:touched.filter(x=>x.pnl!==null&&x.pnl<0).length,
        unfinishedTouched:touched.filter(x=>x.pnl===null).length,
        emptyIntervals:es.filter(s=>!hit.some(e=>e.event.decisionAt>=s.at&&e.event.decisionAt<s.at+waitHours*H)).length,
        changedNet:null,changedDD:null,warning:'descriptive intersections only, not prevented fills or saved whole-episode PnL'});
    }
  }
  save('baselines.json',baselines);save('add-intersections.json',intersections);
  save('validation.json',{passed:true,referenceRows:grid.length,ruleEvents:events.length,distinctSignalTimes:new Set(events.map(e=>e.at)).size,
    outcomes:labels.size,baselineLedgers:4,baselineFills:baselines.reduce((n,r)=>n+r.audit.fills,0),newTradingDefinitions:0,liveChanges:0,independentCheckRequired:true});
}
async function main(){const [cmd,key]=process.argv.slice(2),card=read(CARD),d=card.definition;validate(d);
  if(cmd==='plan'){const p=read(`${d.archive}/plan.json`),state=read(`${d.archive}/state.json`);assert.equal(state.status,'complete');
    assert(read(`${d.archive}/verification.json`).passed);await verifyPins(process.cwd(),[...p.pins,...p.protectedPins]);
    const names=read(`${d.archive}/output/results.json`).filter((r:R)=>r.arm==='high_on'&&r.model==='open').map((r:R)=>`/output/${r.name}-`);
    const old=state.artifacts.filter((x:R)=>names.some((n:string)=>x.file.includes(n))||x.file.endsWith('/results.json'));
    await verifyPins(process.cwd(),old);const sources=new Set<string>([...p.pins.map((x:R)=>x.file),...old.map((x:R)=>x.file),CARD,'docs/research/rally-pullback-atlas-rp01.md']);
    for(const f of fs.readdirSync('scripts').filter(f=>f.startsWith('rally-pullback-')&&f.endsWith('.ts')))sources.add(`scripts/${f}`);
    for(const f of ['src/research/closed-bars.ts','src/research/indicator-features.ts'])sources.add(f);
    const plan=await createPlan(process.cwd(),card,[...sources],p.protectedPins.map((x:R)=>x.file));console.log(JSON.stringify({key:plan.key}));
  }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
