/** MS02: two frozen fresh-ladder vetoes; no change to the canonical replay. */
import fs from 'fs';import path from 'path';import assert from 'assert/strict';
import {executePlan,atomicJson,sha,verifyPins,type Plan} from './research-workflow';
import {makePlan,read} from './major-recovery-atlas';
import {rowAt,type Row} from './major-recovery-policy';
import {buildSeries} from './flow-response-study';
import {POLICIES,config,AgeHighController} from './age10-gate-policy';
import {SoftStaleController} from './conditional-soft-stale-policy';
import {highFeature} from './near-high-policy';
import {exposureMetrics,exposureDelta} from './ladder-exposure-metrics';
import {auditFlowLedger} from './flow-response-audit';
import {componentAttribution} from './ladder-combination-accounting';
import type {ResearchInventoryEvent} from './replay-causal-engine';
export const CARD='research-inputs/major-recovery-ms02-2026-09-16.json',VARIANTS=['accepted_base','retest_base'] as const;
export type Variant=typeof VARIANTS[number];type R=Record<string,any>;
export function context(rows:Row[],at:number,lag:number,v:Variant){const q=rowAt(rows,at,lag),s=q.row?.spell;
 return{healthy:q.healthy,blocked:!q.healthy||!!s&&(v==='accepted_base'||s.failedRetestAt!==null),frameAt:q.row?.at??null,
   blockId:s?.id??null,zoneId:s?.zone.id??null,failedAt:s?.failedAt??null,retestAt:s?.failedRetestAt??null};}
export function validate(d:R){assert.equal(d.runs,20);assert.equal(d.exactControls,8);assert.equal(d.newTradingDefinitions,2);assert.deepEqual(d.variants,VARIANTS);
 assert.deepEqual(d.sourceLagMs,[0,60000]);assert.equal(d.initialEquity,32000);assert.equal(d.feeRate,.00055);assert.equal(d.parent,'age10__minus_deep_stress__minus_tp_cooldown');}
async function worker(plan:Plan,out:string){
 const d=plan.card.definition;validate(d);assert(read(`${d.atlas}/verification.json`).passed);assert(read(`${d.archive}/verification.json`).passed);
 const controls:R[]=read(`${d.archive}/output/results.json`).filter((x:R)=>x.control);assert.equal(controls.length,8);
 const tape:Row[]=read(`${d.atlas}/output/rows.json`),{s,cfg,core,highs}=await buildSeries(d),{runCausalLongReplay}=await import('./replay-causal-engine');
 const json=(f:string,x:unknown)=>atomicJson(path.join(out,f),x),results:R[]=[],parity:R[]=[];
 const jobs=[...controls.map(old=>({old,v:null as Variant|null,lag:0,control:true})),
   ...controls.filter(x=>x.policy===d.parent).flatMap(old=>VARIANTS.map(v=>({old,v,lag:0,control:false}))),
   ...controls.filter(x=>x.policy===d.parent&&x.window==='recent').flatMap(old=>VARIANTS.map(v=>({old,v,lag:60000,control:false})))];assert.equal(jobs.length,d.runs);
 for(const {old,v,lag,control} of jobs){
   if(!control)assert.equal(parity.length,8);const spec=POLICIES.find(x=>x.id===old.policy)!;assert.deepEqual(spec,old.spec);
   const c=config(cfg,spec);assert.equal(c.srShadow!.recentDays,14);assert.equal(sha(JSON.stringify(c)),old.configSha);
   const name=control?old.name:`${old.window}-${old.tp}-${v}-lag${lag}`;
   const original=read(`${d.archive}/output/${old.name}-engine.json`),ids=new Set<string>([...original.closes,...original.trims].map((x:R)=>x.variant));assert.equal(ids.size,1);
   const age=spec.ageHours?new SoftStaleController('age',10,0,()=>{throw Error('age only');}):null;
   const high=spec.days?new AgeHighController(spec,(i,at,p)=>highFeature(s.candles,highs,i,2,at,p,0)):null;
   const events:ResearchInventoryEvent[]=[],attempts:R[]=[],targets:R[]=[],checks:R[]=[];
   const startIdx=core.lowerBound(s.candles,Date.parse(old.start),x=>x.endTs),endIdx=core.lowerBound(s.candles,Date.parse(old.end)+1,x=>x.endTs);
   console.log(`[MS02 ${results.length+1}/20] ${name}`);const began=Date.now();
   const r=runCausalLongReplay({id:control?[...ids][0]:name,executionModel:'causal_next_open',tpExecutionModel:old.tp,maxPositions:11,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,
    {startIdx,endIdx,recordSnapshots:true,partialClockModel:'transactional',researchTpDeferral:age?.decide,
     researchTpObserver:t=>{const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode)targets.push(t);},
     researchAddVeto:a=>{const q=v&&a.nextDepth===1?context(tape,a.at,lag,v):null,fire=q!==null&&q.blocked;
       checks.push({at:a.at,index:a.index,nextDepth:a.nextDepth,episode:a.episode,price:a.price,fire,context:q});return fire;},
     researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},
     researchReduction:high?.reduce,researchInventoryObserver:e=>{high?.observe(e);events.push(e);}},c,32000);
   const raw={...r,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(r,32000),accounting=auditFlowLedger(s.candles,events,attempts,metrics,startIdx,endIdx);
   if(control){assert.equal(digest,old.digest,`Control mismatch ${name}`);assert.deepEqual(metrics,old.metrics);parity.push({name,digest});}
   let flatMinutes=0,blockedFlatMinutes=0,unknownFlatMinutes=0;
   for(const snap of r.snapshots)if(!snap.depth){flatMinutes++;if(v){const q=context(tape,snap.ts,lag,v);if(q.blocked)blockedFlatMinutes++;if(!q.healthy)unknownFlatMinutes++;}}
   const vetoed=checks.filter(a=>a.fire),failureIds=[...new Set<string>(vetoed.map(a=>a.context.blockId).filter(Boolean))];
   const row={name,window:old.window,start:old.start,end:old.end,policy:old.policy,spec,tp:old.tp,lag,variant:v,control,primary:lag===0,startIdx,endIdx,digest,metrics,accounting,
     pendingAtEnd:r.executionAudit!.pendingAtEnd,blocked:r.blocked,audit:age?.counts??null,configSha:sha(JSON.stringify(c)),
     counts:{entryChecks:checks.filter(a=>a.nextDepth===1).length,deeperChecks:checks.filter(a=>a.nextDepth>1).length,vetoMinutes:vetoed.length,
      affectedFailureEvents:failureIds.length,failureIds,unknownVetoMinutes:vetoed.filter(a=>!a.context.healthy).length,flatMinutes,blockedFlatMinutes,unknownFlatMinutes},elapsedMs:Date.now()-began};
   json(`${name}-engine.json`,raw);json(`${name}-inventory.json`,events);json(`${name}-attempts.json`,attempts);json(`${name}-entry-checks.json`,checks);json(`${name}-targets.json`,targets);
   json(`${name}-tp-observations.json`,age?.observations??[]);json(`${name}-high-reductions.json`,high?.rows??[]);results.push(row);json('results.json',results);
   if(parity.length===8&&!fs.existsSync(path.join(out,'control-parity.json')))json('control-parity.json',{passed:true,controls:parity});
   console.log(JSON.stringify({name,net:metrics.totalPnl,dd:metrics.maxDrawdownPct,vetoMinutes:vetoed.length,failures:failureIds.length,seconds:row.elapsedMs/1000}));
 }
 json('comparisons.json',results.filter(x=>!x.control).map(x=>{const b=results.find(y=>y.control&&y.policy===d.parent&&y.tp===x.tp&&y.window===x.window)!;
   return{name:x.name,baseline:b.name,delta:exposureDelta(x.metrics,b.metrics),attribution:componentAttribution(x.metrics,b.metrics)};}));
 core.writeCsv(path.join(out,'overview.csv'),results.map(x=>({name:x.name,window:x.window,tp:x.tp,lag:x.lag,net:x.metrics.totalPnl,realized:x.metrics.realized,open:x.metrics.openPnl,
   wins:x.metrics.profitableEpisodes,winning:x.metrics.grossWin,losses:x.metrics.losingEpisodes,losing:-x.metrics.grossLoss,averageLoss:x.metrics.losingEpisodes?-x.metrics.grossLoss/x.metrics.losingEpisodes:0,
   dd:x.metrics.maxDrawdownPct,fees:x.accounting.modeledFees,tpCycles:x.metrics.tpCycles,...x.counts,failureIds:x.counts.failureIds.join(';')})));
 core.writeCsv(path.join(out,'monthly.csv'),results.flatMap(x=>x.accounting.monthly.map((m:R)=>({name:x.name,...m}))));
 json('validation.json',{passed:true,runs:20,exactControls:8,newTradingDefinitions:2,independentVerificationRequired:true,liveChanges:0});
}
async function main(){const [cmd,key]=process.argv.slice(2);if(cmd==='plan'){
 const d=read(CARD).definition;validate(d);assert(read(`${d.atlas}/verification.json`).passed);
 const a=read(`${d.atlas}/state.json`);assert.equal(a.status,'complete');await verifyPins(process.cwd(),a.artifacts);
 const sources=['scripts/major-recovery-policy.ts','scripts/major-recovery-tests.ts','scripts/major-recovery-atlas.ts','scripts/major-recovery-replay.ts','scripts/major-recovery-replay-verify.ts','scripts/major-recovery-replay-tests.ts',
  `${d.atlas}/verification.json`,...a.artifacts.map((p:R)=>p.file)];console.log((await makePlan(CARD,sources)).key);
 }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
