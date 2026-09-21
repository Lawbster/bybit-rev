/** Post-run descriptive correction only. Never consumed by the economic runner.
 * A resting TP may be armed before the first veto; subsequent mutation is ordered
 * by its FILL timestamp, not by when that target was originally armed. */
import fs from 'fs';import assert from 'assert/strict';
import {jobDirectory,sha} from './research-workflow';
type R=Record<string,any>;
export function nextMutation(spell:R,events:R[]):R|null {
  return events.find(e=>e.episode===spell.episode&&e.event.fillAt>spell.firstAt)??null;
}
export function corrected(probes:R[],events:R[]){
  const spells:R[]=[];let current:R|null=null;
  for(const p of probes.filter(p=>p.blocked)){
    if(current&&current.episode===p.episode&&current.nextDepth===p.nextDepth&&current.lastAt===p.at-60000){current.lastAt=p.at;current.checks++;}
    else{current={episode:p.episode,nextDepth:p.nextDepth,firstAt:p.at,lastAt:p.at,firstPrice:p.price,checks:1};spells.push(current);}
  }
  for(const z of spells){const e=nextMutation(z,events);if(e)assert(e.event.fillAt>z.lastAt);
    Object.assign(z,{nextKind:e?.event.kind??null,nextReason:e?.event.reason??null,nextAt:e?.event.fillAt??null,
      nextPrice:e?.event.price??null,elapsedMinutes:e?(e.event.fillAt-z.firstAt)/60000:null,censored:!e});}
  return{blockedChecks:probes.filter(p=>p.blocked).length,affectedEpisodes:new Set(spells.map(z=>z.episode)).size,
    spells:spells.length,followedByTimer:spells.filter(z=>z.nextKind==='open'&&z.nextReason==='time_add').length,
    followedByDrop:spells.filter(z=>z.nextKind==='open'&&z.nextReason==='price_drop').length,
    followedByReduction:spells.filter(z=>z.nextKind==='close'||z.nextKind==='partial').length,censored:spells.filter(z=>z.censored).length,details:spells};
}
function main(){
  const [key,output]=process.argv.slice(2),dir=jobDirectory(process.cwd(),key),read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
  const verification=read(`${dir}/verification.json`);assert(verification.passed);
  const rows:R[]=read(`${dir}/output/results.json`),paths=rows.map(x=>{
    const load=(k:string)=>read(`${dir}/output/${x.name}-${k}.json`),probes=load('probes'),events=load('inventory'),actual=corrected(probes,events);
    assert.equal(actual.blockedChecks,x.interventions.blockedChecks);assert.equal(actual.affectedEpisodes,x.interventions.affectedEpisodes);assert.equal(actual.spells,x.interventions.spells);
    const changed=actual.details.filter((z:R,i:number)=>z.nextAt!==x.interventions.details[i].nextAt);
    const episodeRows=[...new Set(probes.filter((p:R)=>p.blocked).map((p:R)=>p.episode))].map(id=>{
      const first=events.find((e:R)=>e.episode===id&&e.event.kind==='open'&&!e.before.length),close=events.find((e:R)=>e.episode===id&&e.event.kind==='close');
      const outcome=x.metrics.episodes.find((e:R)=>Date.parse(e.close)===close?.event.fillAt);
      return{episode:id,entryAt:first?.event.fillAt??null,closeAt:close?.event.fillAt??null,outcome:outcome??null,
        skippedChecks:probes.filter((p:R)=>p.blocked&&p.episode===id).length};
    });
    return{name:x.name,correctedInterventions:actual,correctedNextMutationCount:changed.length,affectedLadders:episodeRows};
  });
  const report={job:key,verifiedEconomicReceipt:verification,sourceSha:sha(fs.readFileSync(__filename)),
    scope:'Post-verification diagnostic only; corrects next mutation by fill time. No changes to original immutable artifacts, rule, economic path, metrics or qualification.',paths};
  if(output){assert(!fs.existsSync(output),'Do not overwrite a descriptive report');fs.writeFileSync(output,JSON.stringify(report,null,2),'utf8');}
  console.log(JSON.stringify(paths.map(x=>({name:x.name,correctedNextMutationCount:x.correctedNextMutationCount,...x.correctedInterventions,details:undefined}))));
}
if(require.main===module)main();
