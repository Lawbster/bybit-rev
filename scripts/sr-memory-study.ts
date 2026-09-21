/** SRM01: one-factor S/R retention; existing causal engine and live policies unchanged. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,sha,verifyPins,type Plan} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {POLICIES,config,AgeHighController} from './age10-gate-policy';
import {SoftStaleController} from './conditional-soft-stale-policy';
import {highFeature} from './near-high-policy';
import {exposureMetrics,exposureDelta} from './ladder-exposure-metrics';
import {auditFlowLedger} from './flow-response-audit';
import {componentAttribution} from './ladder-combination-accounting';
import type {ResearchInventoryEvent} from './replay-causal-engine';
type R=Record<string,any>;
export const CARD='research-inputs/sr-memory-macro-2026-09-16.json';
const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
export function validate(d:R){
  assert.deepEqual(d.memoryDays,[14,21,30,60,120]);assert.equal(d.runs,24);assert.equal(d.exactControls,8);
  assert.equal(d.initialEquity,32000);assert.equal(d.feeRate,.00055);assert.equal(d.newTradingDefinitions,4);
  assert.equal(d.parent,'age10__minus_deep_stress__minus_tp_cooldown');assert.equal(d.cutoff,'2026-09-15T20:20:00Z');
  assert.deepEqual(d.tpModels,['resting_touch','close_confirmed']);assert.equal(d.windows.length,2);
}
async function worker(plan:Plan,out:string){
  const d=plan.card.definition;validate(d);
  const controls:R[]=[];
  for(const w of d.windows){const archive=w.id==='recent'?d.archive:d.olderArchive;
    assert(read(`${archive}/verification.json`).passed);
    const old:R[]=read(`${archive}/output/results.json`);
    for(const tp of d.tpModels)for(const policy of ['baseline',d.parent]){
      const x=old.find(x=>x.primary&&x.tp===tp&&x.policy===policy&&Date.parse(x.start)===Date.parse(w.start)&&Date.parse(x.end)===Date.parse(w.end));
      assert(x,`Missing control ${w.id}/${tp}/${policy}`);controls.push({w,archive,old:x});
    }
  }
  const {s,core,cfg,highs}=await buildSeries(d),{runCausalLongReplay}=await import('./replay-causal-engine');
  const json=(p:string,x:unknown)=>atomicJson(path.join(out,p),x),results:R[]=[],parity:R[]=[];
  const jobs=[...controls.map(c=>({...c,days:14,control:true})),...controls.filter(x=>x.old.policy===d.parent).flatMap(c=>d.memoryDays.slice(1).map((days:number)=>({...c,days,control:false})))];
  assert.equal(jobs.length,24);
  for(const j of jobs){
    const {old,w,days,control,archive}=j,spec=POLICIES.find(x=>x.id===old.policy)!;assert(spec);assert.deepEqual(spec,old.spec);
    const c=config(cfg,spec);c.srShadow!.recentDays=days;
    const baselineConfig=config(cfg,spec),compare=structuredClone(c);compare.srShadow!.recentDays=14;assert.deepEqual(compare,baselineConfig);
    const name=`${w.id}-${old.tp}-${old.policy==='baseline'?'B17':'Agg10'}-${days}d`;
    const prior=read(`${archive}/output/${old.name}-engine.json`),ids=new Set<string>([...prior.closes,...prior.trims].map((x:R)=>x.variant));assert.equal(ids.size,1);
    const age=spec.ageHours?new SoftStaleController('age',10,0,()=>{throw Error('age only');}):null;
    const high=spec.days?new AgeHighController(spec,(i,at,p)=>highFeature(s.candles,highs,i,2,at,p,0)):null;
    const events:ResearchInventoryEvent[]=[],attempts:R[]=[],targets:R[]=[];
    const startIdx=core.lowerBound(s.candles,Date.parse(w.start),x=>x.endTs),endIdx=core.lowerBound(s.candles,Date.parse(w.end)+1,x=>x.endTs);
    console.log(`[SRM01 ${results.length+1}/24] ${name}`);const began=Date.now();
    const r=runCausalLongReplay({id:[...ids][0],executionModel:'causal_next_open',tpExecutionModel:old.tp,maxPositions:11,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,
      {startIdx,endIdx,recordSnapshots:true,partialClockModel:'transactional',researchTpDeferral:age?.decide,
        researchTpObserver:t=>{const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode)targets.push(t);},
        researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},
        researchReduction:high?.reduce,researchInventoryObserver:e=>{high?.observe(e);events.push(e);}},c,32000);
    const raw={...r,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(r,32000);
    const accounting=auditFlowLedger(s.candles,events,attempts,metrics,startIdx,endIdx);
    if(control){assert.equal(digest,old.digest,`Baseline digest ${name}`);assert.deepEqual(metrics,old.metrics);parity.push({name,digest,archive,original:old.name});}
    const row={name,window:w.id,start:w.start,end:w.end,days,control,primary:true,policy:old.policy,spec,tp:old.tp,lag:0,startIdx,endIdx,digest,metrics,accounting,
      pendingAtEnd:r.executionAudit!.pendingAtEnd,blocked:r.blocked,archive:control?archive:null,originalName:control?old.name:null,configSha:sha(JSON.stringify(c)),elapsedMs:Date.now()-began};
    json(`${name}-engine.json`,raw);json(`${name}-inventory.json`,events);json(`${name}-attempts.json`,attempts);json(`${name}-targets.json`,targets);
    json(`${name}-tp-observations.json`,age?.observations??[]);json(`${name}-high-reductions.json`,high?.rows??[]);
    results.push(row);json('results.json',results);
    console.log(JSON.stringify({name,net:metrics.totalPnl,dd:metrics.maxDrawdownPct,partials:metrics.partials,srUnhealthy:r.blocked.srContext,seconds:row.elapsedMs/1000}));
    if(parity.length===8&&!fs.existsSync(path.join(out,'control-parity.json')))json('control-parity.json',{passed:true,controls:parity});
  }
  json('comparisons.json',results.filter(x=>!x.control).map(x=>{const b=results.find(y=>y.control&&y.policy===d.parent&&y.tp===x.tp&&y.window===x.window)!;
    return{name:x.name,baseline:b.name,delta:exposureDelta(x.metrics,b.metrics),attribution:componentAttribution(x.metrics,b.metrics)};}));
  json('validation.json',{passed:true,runs:24,exactControls:8,newTradingDefinitions:4,independentVerificationRequired:true,liveChanges:0});
}
async function main(){const [cmd,key]=process.argv.slice(2),root=process.cwd();if(cmd==='plan'){
  const card=read(CARD);validate(card.definition);const old=read(`${card.definition.archive}/plan.json`),state=read(`${card.definition.archive}/state.json`);
  assert.equal(state.status,'complete');await verifyPins(root,[...old.pins.filter((p:R)=>!p.file.startsWith('data/')&&p.file!=='bot-state.json'),...state.artifacts]);
  const older=read(`${card.definition.olderArchive}/state.json`);assert.equal(older.status,'complete');await verifyPins(root,older.artifacts);
  const files=[...old.pins.map((p:R)=>p.file),...state.artifacts.map((p:R)=>p.file),...older.artifacts.map((p:R)=>p.file),CARD,
    'scripts/sr-memory-study.ts','scripts/sr-memory-verify.ts','scripts/sr-memory-tests.ts'];
  const plan=await createPlan(root,card,[...new Set<string>(files)],old.protectedPins.map((p:R)=>p.file));console.log(JSON.stringify({key:plan.key,runs:24}));
}else{assert.equal(cmd,'run');await executePlan(root,key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
