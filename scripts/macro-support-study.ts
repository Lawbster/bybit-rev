/** MS01 explicit immutable local study. Canonical engine/config are unchanged. */
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
import {VARIANTS,buildFrames,gateTape,gateAt,vetoEntry,type Variant} from './macro-support-policy';
import type {ResearchInventoryEvent} from './replay-causal-engine';

type R=Record<string,any>;export const CARD='research-inputs/macro-support-entry-ms01-2026-09-16.json';
const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
export function validate(d:R){
  assert.equal(d.runs,32);assert.equal(d.exactControls,8);assert.equal(d.initialEquity,32000);assert.equal(d.feeRate,.00055);
  assert.equal(d.newTradingDefinitions,4);assert.deepEqual(d.variants,VARIANTS);assert.deepEqual(d.sourceLagMs,[0,60000]);
  assert.equal(d.cutoff,'2026-09-15T20:20:00Z');assert.equal(d.parent,'age10__minus_deep_stress__minus_tp_cooldown');
  assert.deepEqual(d.macro,{minutes:240,wing:3,halfWidthPct:.75,touchSpacingHours:24,memoryDays:120,confirmations:2,minimumTouches:2,watchDistancePct:3});
}
async function worker(plan:Plan,out:string){
  const d=plan.card.definition;validate(d);assert(read(`${d.archive}/verification.json`).passed);
  const controls:R[]=read(`${d.archive}/output/results.json`).filter((x:R)=>x.control);assert.equal(controls.length,8);
  const {s,cfg,core,highs}=await buildSeries(d),{runCausalLongReplay}=await import('./replay-causal-engine');
  const json=(f:string,x:unknown)=>atomicJson(path.join(out,f),x),results:R[]=[],parity:R[]=[];
  const tapes=new Map<string,ReturnType<typeof gateTape>>();
  for(const lag of d.sourceLagMs){
    const frames=buildFrames(s.candles,lag);json(`macro-frames-lag${lag}.json`,frames);
    for(const v of VARIANTS){const tape=gateTape(frames,v);tapes.set(`${v.id}:${lag}`,tape);json(`gate-${v.id}-lag${lag}.json`,{rows:tape.rows,events:tape.events});}
  }
  const jobs=[...controls.map(old=>({old,v:null as Variant|null,lag:0,control:true})),
    ...controls.filter(x=>x.policy===d.parent).flatMap(old=>VARIANTS.map(v=>({old,v,lag:0,control:false}))),
    ...controls.filter(x=>x.policy===d.parent&&x.window==='recent').flatMap(old=>VARIANTS.map(v=>({old,v,lag:60000,control:false})))];
  assert.equal(jobs.length,32);
  for(const j of jobs){
    const {old,v,lag,control}=j,spec=POLICIES.find(x=>x.id===old.policy)!;assert.deepEqual(spec,old.spec);
    const c=config(cfg,spec);assert.equal(c.srShadow!.recentDays,14);assert.equal(sha(JSON.stringify(c)),old.configSha);
    const name=control?old.name:`${old.window}-${old.tp}-${v!.id}-lag${lag}`,tape=v?tapes.get(`${v.id}:${lag}`)!:null;
    const baseRaw=read(`${d.archive}/output/${old.name}-engine.json`),ids=new Set<string>([...baseRaw.closes,...baseRaw.trims].map((x:R)=>x.variant));assert.equal(ids.size,1);
    const age=spec.ageHours?new SoftStaleController('age',10,0,()=>{throw Error('age only');}):null;
    const high=spec.days?new AgeHighController(spec,(i,at,p)=>highFeature(s.candles,highs,i,2,at,p,0)):null;
    const events:ResearchInventoryEvent[]=[],attempts:R[]=[],targets:R[]=[],checks:R[]=[];
    const startIdx=core.lowerBound(s.candles,Date.parse(old.start),x=>x.endTs),endIdx=core.lowerBound(s.candles,Date.parse(old.end)+1,x=>x.endTs);
    console.log(`[MS01 ${results.length+1}/32] ${name}`);const began=Date.now();
    const r=runCausalLongReplay({id:control?[...ids][0]:name,executionModel:'causal_next_open',tpExecutionModel:old.tp,maxPositions:11,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,
      {startIdx,endIdx,recordSnapshots:true,partialClockModel:'transactional',researchTpDeferral:age?.decide,
        researchTpObserver:t=>{const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode)targets.push(t);},
        researchAddVeto:a=>{const q=tape&&a.nextDepth===1?gateAt(tape.rows,a.at,lag):null,fire=q!==null&&vetoEntry(a.nextDepth,q);
          checks.push({at:a.at,index:a.index,nextDepth:a.nextDepth,episode:a.episode,price:a.price,fire,context:q});return fire;},
        researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},
        researchReduction:high?.reduce,researchInventoryObserver:e=>{high?.observe(e);events.push(e);}},c,32000);
    const raw={...r,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(r,32000),accounting=auditFlowLedger(s.candles,events,attempts,metrics,startIdx,endIdx);
    if(control){assert.equal(digest,old.digest,`Control mismatch ${name}`);assert.deepEqual(metrics,old.metrics);parity.push({name,digest,original:old.name});}
    let flatMinutes=0,blockedFlatMinutes=0,unknownFlatMinutes=0;
    for(const snap of r.snapshots)if(!snap.depth){flatMinutes++;if(tape){const q=gateAt(tape.rows,snap.ts,lag);if(q.blocked)blockedFlatMinutes++;if(!q.healthy)unknownFlatMinutes++;}}
    const vetoed=checks.filter(a=>a.fire),failureIds=[...new Set<string>(vetoed.map(a=>a.context.blockId).filter(Boolean))];
    const row={name,window:old.window,start:old.start,end:old.end,policy:old.policy,spec,tp:old.tp,lag,variant:v,control,primary:lag===0,startIdx,endIdx,digest,metrics,accounting,
      pendingAtEnd:r.executionAudit!.pendingAtEnd,blocked:r.blocked,audit:age?.counts??null,configSha:sha(JSON.stringify(c)),
      counts:{entryChecks:checks.filter(a=>a.nextDepth===1).length,deeperChecks:checks.filter(a=>a.nextDepth>1).length,vetoMinutes:vetoed.length,
        affectedFailureEvents:failureIds.length,failureIds,unknownVetoMinutes:vetoed.filter(a=>!a.context.healthy).length,flatMinutes,blockedFlatMinutes,unknownFlatMinutes},elapsedMs:Date.now()-began};
    json(`${name}-engine.json`,raw);json(`${name}-inventory.json`,events);json(`${name}-attempts.json`,attempts);json(`${name}-entry-checks.json`,checks);json(`${name}-targets.json`,targets);
    json(`${name}-tp-observations.json`,age?.observations??[]);json(`${name}-high-reductions.json`,high?.rows??[]);
    results.push(row);json('results.json',results);
    if(parity.length===8&&!fs.existsSync(path.join(out,'control-parity.json')))json('control-parity.json',{passed:true,controls:parity});
    console.log(JSON.stringify({name,net:metrics.totalPnl,dd:metrics.maxDrawdownPct,vetoMinutes:vetoed.length,failures:failureIds.length,seconds:row.elapsedMs/1000}));
  }
  const comparisons=results.filter(x=>!x.control).map(x=>{const b=results.find(y=>y.control&&y.policy===d.parent&&y.tp===x.tp&&y.window===x.window)!;
    return{name:x.name,baseline:b.name,delta:exposureDelta(x.metrics,b.metrics),attribution:componentAttribution(x.metrics,b.metrics)};});json('comparisons.json',comparisons);
  core.writeCsv(path.join(out,'overview.csv'),results.map(x=>({name:x.name,window:x.window,tp:x.tp,lag:x.lag,net:x.metrics.totalPnl,realized:x.metrics.realized,open:x.metrics.openPnl,
    wins:x.metrics.profitableEpisodes,winning:x.metrics.grossWin,losses:x.metrics.losingEpisodes,losing:-x.metrics.grossLoss,averageLoss:x.metrics.losingEpisodes?-x.metrics.grossLoss/x.metrics.losingEpisodes:0,
    dd:x.metrics.maxDrawdownPct,fees:x.accounting.modeledFees,tpCycles:x.metrics.tpCycles,...x.counts,failureIds:x.counts.failureIds.join(';')})));
  core.writeCsv(path.join(out,'monthly.csv'),results.flatMap(x=>x.accounting.monthly.map((m:R)=>({name:x.name,...m}))));
  json('validation.json',{passed:true,runs:32,exactControls:8,newTradingDefinitions:4,independentVerificationRequired:true,liveChanges:0});
}
async function main(){const [cmd,key]=process.argv.slice(2),root=process.cwd();if(cmd==='plan'){
  const card=read(CARD);validate(card.definition);const old=read(`${card.definition.archive}/plan.json`);
  const stable=old.pins.filter((p:R)=>!p.file.startsWith('data/')&&p.file!=='bot-state.json'&&!p.file.startsWith('backtests/research-workflow/'));
  await verifyPins(root,stable);
  const inherited=old.pins.filter((p:R)=>!p.file.startsWith('backtests/research-workflow/')).map((p:R)=>p.file);
  const controls:R[]=read(`${card.definition.archive}/output/results.json`).filter((x:R)=>x.control);
  const originals=controls.map(x=>`${card.definition.archive}/output/${x.name}-engine.json`);
  const files=[...inherited,...originals,`${card.definition.archive}/verification.json`,`${card.definition.macroArchive}/output/240m-events.json`,
    ...['policy','study','audit','verify','tests'].map(n=>`scripts/macro-support-${n}.ts`),'scripts/macro-sr-observer.ts',CARD];
  const p=await createPlan(root,card,[...new Set<string>(files)],old.protectedPins.map((p:R)=>p.file));console.log(JSON.stringify({key:p.key,runs:32}));
}else{assert.equal(cmd,'run');await executePlan(root,key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
