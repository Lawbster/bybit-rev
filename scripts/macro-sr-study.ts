/** Separate immutable observer job. No entries, exits, dollar outcomes or optimized levels. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,verifyPins,type Plan} from './research-workflow';
import {observe,completeBars} from './macro-sr-observer';
const CARD='research-inputs/sr-memory-macro-2026-09-16.json',read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
async function worker(plan:Plan,out:string){
  const d=plan.card.definition;assert.equal(d.mode,'macro-observer');assert.equal(d.runs,0);
  process.env.SIM_END=d.cutoff;const {loadCandles1m}=await import('./hype-freerun-canonical-replay');
  const cs=await loadCandles1m('HYPEUSDT',path.resolve('data'),Date.parse(d.cutoff),d.repairFile),summaries:any[]=[];let prefixChecks=0,clocks=0;
  const cutoff=Date.parse(d.cutoff),start=Date.parse('2026-05-17T20:43:00Z');
  for(const spec of d.macroObserver.timeframes){const bars=completeBars(cs,spec.minutes),o=observe(bars,spec),snap=o.snapshot();
    const checkpoints=['2026-06-05T00:00:00Z','2026-06-18T00:00:00Z','2026-08-21T16:00:00Z','2026-09-15T20:00:00Z'].map(Date.parse);
    const samples=checkpoints.map(at=>{const p=observe(bars.filter(b=>b.endTs<=at),spec);assert.deepEqual(p.events,o.events.filter(e=>e.at<=at));prefixChecks++;
      return{at,snapshot:p.snapshot(),nearUserReference:p.snapshot().zones.filter(z=>Math.abs(z.center/75.401-1)<=.05)};});
    const lag=observe(bars,spec,120,60000,cutoff);for(const e of lag.events){const original=o.events.find(x=>x.kind===e.kind&&x.zone.id===e.zone.id&&x.barEnd===e.barEnd);assert(original);assert.equal(e.at,original.at+60000);clocks++;}
    for(const e of o.events){assert(e.at<=cutoff);assert(e.zone.touches.every(t=>t.knownAt<=e.at));if(e.kind!=='expired'){assert(e.zone.firstKnownAt!==null);assert(e.zone.firstKnownAt<=e.at);}}
    const recent=o.events.filter(e=>e.at>=start),counts:Record<string,number>={};for(const e of recent)counts[e.kind]=(counts[e.kind]??0)+1;
    const lastClose=bars.at(-1)!.close;
    summaries.push({spec,lastClosedAt:bars.at(-1)!.endTs,lastClose,healthy:snap.healthy,activeZones:snap.zones.length,counts,
      nearestBelow:snap.zones.filter(z=>z.center<lastClose).sort((a,b)=>b.center-a.center).slice(0,4),nearestAbove:snap.zones.filter(z=>z.center>=lastClose).sort((a,b)=>a.center-b.center).slice(0,4),samples,
      userReferenceEvents:recent.filter(e=>Math.abs(e.zone.center/75.401-1)<=.05)});
    atomicJson(path.join(out,`${spec.minutes}m-events.json`),o.events);atomicJson(path.join(out,`${spec.minutes}m-final.json`),snap);
  }
  atomicJson(path.join(out,'summary.json'),{cutoff:d.cutoff,summaries,warning:'The user reference is a post-hoc reporting slice only. Zero strategy or profit evaluations; no $75.401 rule.'});
  atomicJson(path.join(out,'validation.json'),{passed:true,prefixChecks,delayedEventChecks:clocks,syntheticSuite:'scripts/macro-sr-tests.ts',liveChanges:0,tradingDefinitions:0});
}
async function main(){const [cmd,key]=process.argv.slice(2);if(cmd==='plan'){
  const original=read(CARD),old=read(`${original.definition.archive}/plan.json`);
  const card={...original,id:'macro-sr-observer-2026-09-16',definition:{...original.definition,mode:'macro-observer',runs:0,newTradingDefinitions:0}};
  const sources=[...old.pins.map((p:any)=>p.file),CARD,'scripts/macro-sr-observer.ts','scripts/macro-sr-study.ts','scripts/macro-sr-tests.ts'];
  const p=await createPlan(process.cwd(),card,[...new Set<string>(sources)],old.protectedPins.map((p:any)=>p.file));console.log(JSON.stringify({key:p.key}));
}else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);const dir=`backtests/research-workflow/${key}`,p=read(`${dir}/plan.json`),s=read(`${dir}/state.json`);await verifyPins(process.cwd(),[...p.pins,...p.protectedPins,...s.artifacts]);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
