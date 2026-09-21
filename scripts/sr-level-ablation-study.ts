/** SRL01: remove only resistance from the profitable pulse partial. Local only. */
import fs from 'fs';import path from 'path';import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,sha,verifyPins,type Plan} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {POLICIES,config,AgeHighController} from './age10-gate-policy';
import {SoftStaleController} from './conditional-soft-stale-policy';
import {highFeature} from './near-high-policy';
import {exposureMetrics,exposureDelta} from './ladder-exposure-metrics';
import {auditFlowLedger} from './flow-response-audit';
import {componentAttribution} from './ladder-combination-accounting';
import {validate,type LevelMode as Mode} from './sr-level-ablation-policy';
import {pulseAt} from './sr-partial-audit-study';
import type {Series} from './hype-freerun-canonical-replay';
import type {ResearchInventoryEvent} from './replay-causal-engine';
type R=Record<string,any>;
export const CARD='research-inputs/sr-level-ablation-srl01-2026-09-16.json';
export const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
async function worker(plan:Plan,out:string){
 const d=plan.card.definition;validate(d);assert(read(`${d.archive}/verification.json`).passed);
 const archived:R[]=read(`${d.archive}/output/results.json`);
 const controls=archived.filter(x=>x.control||(x.mode==='current'&&x.lag===60000));assert.equal(controls.length,10);
 const {s,cfg,core,highs}=await buildSeries(d),{runCausalLongReplay}=await import('./replay-causal-engine');
 const json=(f:string,x:unknown)=>atomicJson(path.join(out,f),x),results:R[]=[],parity:R[]=[];
 const parents=controls.filter(x=>x.policy===d.parent&&!x.lag);
 const jobs=[...controls.map(old=>({old,mode:'current' as Mode,lag:old.lag,control:true})),
  ...parents.map(old=>({old,mode:'without_resistance' as Mode,lag:0,control:false})),
  ...parents.filter(x=>x.window==='recent').map(old=>({old,mode:'without_resistance' as Mode,lag:60000,control:false}))];
 assert.equal(jobs.length,d.runs);
 json('engine-bridge.json',{old:read(`${d.archive}/plan.json`).pins.find((p:R)=>p.file==='scripts/replay-causal-engine.ts'),
  current:plan.pins.find(p=>p.file==='scripts/replay-causal-engine.ts'),description:d.bridge});
 for(const {old,mode,lag,control} of jobs){
  if(!control)assert.equal(parity.length,10);const spec=POLICIES.find(x=>x.id===old.policy)!;assert.deepEqual(spec,old.spec);
  const c=config(cfg,spec);assert.equal(sha(JSON.stringify(c)),old.configSha);assert.equal(c.srShadow!.recentDays,14);
  const name=control?old.name:`${old.window}-${old.tp}-${mode}-lag${lag}`;
  const original=read(`${d.archive}/output/${old.name}-engine.json`),ids=new Set<string>([...original.closes,...original.trims].map((x:R)=>x.variant));assert.equal(ids.size,1);
  const age=spec.ageHours?new SoftStaleController('age',10,0,()=>{throw Error('age only');}):null;
  const high=spec.days?new AgeHighController(spec,(i,at,p)=>highFeature(s.candles,highs,i,2,at,p,0)):null;
  const events:ResearchInventoryEvent[]=[],attempts:R[]=[],targets:R[]=[],gates:R[]=[];
  const startIdx=core.lowerBound(s.candles,Date.parse(old.start),x=>x.endTs),endIdx=core.lowerBound(s.candles,Date.parse(old.end)+1,x=>x.endTs);
  console.log(`[SRL01 ${results.length+1}/${d.runs}] ${name}`);const began=Date.now();
  const r=runCausalLongReplay({id:[...ids][0],executionModel:'causal_next_open',tpExecutionModel:old.tp,maxPositions:11,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,
   {startIdx,endIdx,recordSnapshots:true,partialClockModel:'transactional',researchTpDeferral:age?.decide,
    researchTpObserver:t=>{const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode)targets.push(t);},
    researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},
    researchSrPartialLevelStudy:{mode,pulseGate:q=>{
     const evidence=pulseAt(s,q.index,lag);
     if(!lag){assert.equal(evidence.predicates.hostile,q.hostile);assert.equal(evidence.predicates.deteriorating,q.deteriorating);}
     return evidence.predicates.deteriorating;
    },observe:q=>{gates.push({...q,...pulseAt(s,q.index,lag)});}},
    researchReduction:high?.reduce,researchInventoryObserver:e=>{high?.observe(e);events.push(e);}},c,32000);
  const raw={...r,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(r,32000),accounting=auditFlowLedger(s.candles,events,attempts,metrics,startIdx,endIdx);
  if(control){assert.equal(digest,old.digest,`Control mismatch ${name}`);assert.deepEqual(metrics,old.metrics);parity.push({name,digest});}
  const row={name,window:old.window,start:old.start,end:old.end,policy:old.policy,spec,tp:old.tp,mode,lag,control,primary:lag===0,startIdx,endIdx,digest,metrics,accounting,
   pendingAtEnd:r.executionAudit!.pendingAtEnd,blocked:r.blocked,configSha:sha(JSON.stringify(c)),
   counts:{eligibleMinutes:gates.length,eligibleEpisodes:new Set(gates.map(x=>x.episode)).size,fired:gates.filter(x=>x.fire).length,
    firedEpisodes:new Set(gates.filter(x=>x.fire).map(x=>x.episode)).size,withHl:gates.filter(x=>x.predicates.hlAvailable).length,
    levelEligibleMinutes:gates.filter(x=>x.levelEligible).length,offLevelFires:gates.filter(x=>x.fire&&!x.levelEligible).length,
    changedEpisodes:new Set(gates.filter(x=>x.fire&&!x.levelEligible).map(x=>x.episode)).size,
    noPulseInputs:gates.filter(x=>!x.predicates.available).length,onlyBtcOrFunding:gates.filter(x=>x.pulse.oiBy4hPct===null&&x.pulse.oiBn4hPct===null&&x.pulse.oiHl4hPct===null&&x.pulse.taker4h===null).length},elapsedMs:Date.now()-began};
  json(`${name}-engine.json`,raw);json(`${name}-inventory.json`,events);json(`${name}-attempts.json`,attempts);json(`${name}-targets.json`,targets);
  json(`${name}-partial-gates.json`,gates);json(`${name}-tp-observations.json`,age?.observations??[]);json(`${name}-high-reductions.json`,high?.rows??[]);
  results.push(row);json('results.json',results);
  if(parity.length===10&&!fs.existsSync(path.join(out,'control-parity.json')))json('control-parity.json',{passed:true,controls:parity});
  console.log(JSON.stringify({name,net:metrics.totalPnl,dd:metrics.maxDrawdownPct,partials:metrics.partials,...row.counts,seconds:row.elapsedMs/1000}));
 }
 json('comparisons.json',results.filter(x=>!x.control).map(x=>{const b=results.find(y=>y.control&&y.policy===d.parent&&y.tp===x.tp&&y.window===x.window&&y.lag===x.lag)!;
  return {name:x.name,baseline:b.name,delta:exposureDelta(x.metrics,b.metrics),attribution:componentAttribution(x.metrics,b.metrics)};}));
 core.writeCsv(path.join(out,'overview.csv'),results.map(x=>({name:x.name,window:x.window,tp:x.tp,mode:x.mode,lag:x.lag,net:x.metrics.totalPnl,realized:x.metrics.realized,open:x.metrics.openPnl,
  wins:x.metrics.profitableEpisodes,winning:x.metrics.grossWin,losses:x.metrics.losingEpisodes,losing:-x.metrics.grossLoss,averageLoss:x.metrics.losingEpisodes?-x.metrics.grossLoss/x.metrics.losingEpisodes:0,
  dd:x.metrics.maxDrawdownPct,fees:x.accounting.modeledFees,tpCycles:x.metrics.tpCycles,partials:x.metrics.partials,...x.counts})));
 core.writeCsv(path.join(out,'monthly.csv'),results.flatMap(x=>x.accounting.monthly.map((m:R)=>({name:x.name,...m}))));
 json('validation.json',{passed:true,runs:d.runs,exactControls:10,newTradingDefinitions:1,independentVerificationRequired:true,liveChanges:0});
}
async function main(){const [cmd,key]=process.argv.slice(2);if(cmd==='plan'){
 const card=read(CARD);validate(card.definition);const old=read(`${card.definition.archive}/plan.json`),state=read(`${card.definition.archive}/state.json`);
 assert.equal(state.status,'complete');assert(read(`${card.definition.archive}/verification.json`).passed);
 // Explicit additive research-engine bridge. Every other inherited source must be unchanged.
 await verifyPins(process.cwd(),old.pins.filter((p:R)=>!p.file.startsWith('data/')&&p.file!=='bot-state.json'&&!p.file.startsWith('backtests/')&&p.file!=='scripts/replay-causal-engine.ts'));
 await verifyPins(process.cwd(),state.artifacts);
 const files=[...old.pins.filter((p:R)=>!p.file.startsWith('backtests/research-workflow/')).map((p:R)=>p.file),...state.artifacts.map((p:R)=>p.file),
  `${card.definition.archive}/verification.json`,CARD,'scripts/sr-level-ablation-policy.ts','scripts/sr-level-ablation-study.ts','scripts/sr-level-ablation-tests.ts','scripts/sr-level-ablation-verify.ts','scripts/sr-level-ablation-report.ts','docs/research/sr-level-ablation-srl01.md'];
 console.log((await createPlan(process.cwd(),card,[...new Set<string>(files)],old.protectedPins.map((p:R)=>p.file))).key);
 }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
