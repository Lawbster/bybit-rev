/** Independent accounting, target and closed-high validation for the September15 extension. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
import {auditFlowLedger} from './flow-response-audit';
import {auditAgeHighTargets,auditAgeHighExits,rawHighs} from './age-high-refinement-audit';
import {exposureDelta} from './ladder-exposure-metrics';
import {componentAttribution} from './ladder-combination-accounting';
import {reconstructDrop,checkDropAccountingFixtures} from './aggressive10-drop-extension-accounting';
type R=Record<string,any>;
const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
async function main(){
  checkDropAccountingFixtures();const dir=jobDirectory(process.cwd(),process.argv[2]),out=path.join(dir,'output');
  const plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
  assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`));assert(!fs.existsSync(`${dir}/drop-accounting.json`));
  const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
  process.env.SIM_END=d.cutoff;const {loadCandles1m}=await import('./hype-freerun-canonical-replay');
  const cs=await loadCandles1m('HYPEUSDT',path.resolve('data'),Date.parse(d.cutoff),d.repairFile),highs=rawHighs(cs,2);
  const load=(p:string)=>read(path.join(out,p)),rows:R[]=load('results.json'),old:R[]=read(`${d.archive}/output/results.json`),reports:R[]=[];
  const cfg=read('bot-config.json');delete cfg.aggressive10;assert.equal(rows.length,8);
  let controls=0,fills=0,minutes=0,targetChecks=0,highChecks=0;
  for(const x of rows){
    console.log(`[drop-extension verify] ${x.name}`);
    const raw=load(`${x.name}-engine.json`),events:R[]=load(`${x.name}-inventory.json`),attempts:R[]=load(`${x.name}-attempts.json`);
    assert.equal(sha(JSON.stringify(raw)),x.digest);assert.deepEqual(events.map(e=>e.event),raw.executionAudit.events);
    assert.deepEqual(auditFlowLedger(cs,events as any,attempts,x.metrics,x.startIdx,x.endIdx),x.accounting);
    fills+=events.length;minutes+=x.endIdx-x.startIdx;
    const targets:R[]=load(`${x.name}-targets.json`),arms:R[]=[];
    targetChecks+=auditAgeHighTargets(cs,events as any,targets,load(`${x.name}-tp-observations.json`),
      {...x,control:!x.spec.ageHours,policy:{id:'baseline',family:'age'},sensitivity:{sourceLagMs:0,releaseDelayMs:0}}, {},cfg,{},t=>arms.push(t)).checks;
    assert.equal(arms.length,targets.length);arms.forEach((t,i)=>{for(const k of ['episode','armedIndex','armedAt','pct'])assert.equal(t[k],targets[i][k]);near(t.targetPrice,targets[i].targetPrice);});
    if(x.spec.days)highChecks+=auditAgeHighExits(cs,events,{...x,lag:0},load(`${x.name}-high-reductions.json`),highs);
    for(const e of events.filter(e=>e.event.kind==='close'&&['tp','stale_tp'].includes(e.event.reason))){
      const v=e.event,arm=arms.filter(t=>t.episode===e.episode&&t.armedIndex<=v.decisionIndex).at(-1);assert(arm);
      assert.equal(v.reason,arm.pct<1.4?'stale_tp':'tp');
      if(v.fillAt===cs[v.fillIndex].endTs){assert.equal(v.decisionIndex,arm.armedIndex);assert(arm.armedIndex<v.fillIndex);near(v.price,arm.targetPrice);}
      else{assert(arm.armedIndex<v.decisionIndex);assert(cs[v.decisionIndex].close>=arm.targetPrice);}
    }
    const previous=old.find(o=>o.name===x.originalName);assert(previous);
    if(x.bridge){assert.equal(x.digest,previous.digest);assert.deepEqual(x.metrics,previous.metrics);controls++;}
    else{
      const prior=read(`${d.archive}/output/${previous.name}-engine.json`);
      assert.deepEqual(raw.executionAudit.events.filter((e:R)=>e.fillIndex<previous.endIdx),prior.executionAudit.events);
      reports.push(reconstructDrop(cs,events,x,Date.parse(d.oldCutoff)));
      if(x.policy!=='baseline'){
        const b=rows.find(y=>y.primary&&y.tp===x.tp&&y.policy==='baseline'),comp=load('comparisons.json').find((v:R)=>v.name===x.name);assert(b&&comp);
        assert.deepEqual(comp.delta,exposureDelta(x.metrics,b.metrics));assert.deepEqual(comp.attribution,componentAttribution(x.metrics,b.metrics));
      }
    }
  }
  assert.equal(controls,4);await verifyPins(process.cwd(),pins);
  atomicJson(`${dir}/drop-accounting.json`,{cutoff:d.cutoff,oldCutoff:d.oldCutoff,reports});
  const receipt={passed:true,runs:8,exactControls:4,fills,minutes,targetChecks,highChecks,newTradingDefinitions:0,liveChanges:0,
    dropAccountingSha256:sha(fs.readFileSync(`${dir}/drop-accounting.json`)),checkerSha256:sha(fs.readFileSync(__filename))};
  atomicJson(`${dir}/verification.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
