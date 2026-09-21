import fs from 'fs';import path from 'path';import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,sha,verifyPins,type Plan} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {POLICIES,config,AgeHighController} from './age10-gate-policy';
import {SoftStaleController} from './conditional-soft-stale-policy';
import {highFeature} from './near-high-policy';
import {exposureMetrics,exposureDelta} from './ladder-exposure-metrics';
import {auditFlowLedger} from './flow-response-audit';
import {componentAttribution} from './ladder-combination-accounting';
import {ShadeController,VARIANTS,validate,type Mode,type R} from './resistance-tp-replay-policy';
import type {ResearchInventoryEvent} from './replay-causal-engine';
export const CARD='research-inputs/resistance-tp-replay-srt03-2026-09-16.json';
export const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
async function worker(plan:Plan,out:string){
  const d=plan.card.definition;validate(d);const controls:R[]=read(`${d.archive}/output/results.json`).filter((x:R)=>x.control);assert.equal(controls.length,8);
  const {s,cfg,core,highs}=await buildSeries(d),{runCausalLongReplay}=await import('./replay-causal-engine');
  const json=(name:string,x:unknown)=>atomicJson(path.join(out,name+'.json'),x),results:R[]=[],parity:R[]=[];
  const parents=controls.filter(x=>x.policy===d.parent);
  const jobs=[...controls.map(old=>({old,mode:null as Mode|null,lag:0})),...parents.flatMap(old=>VARIANTS.map(mode=>({old,mode,lag:0}))),
    ...parents.flatMap(old=>VARIANTS.filter(mode=>mode!=='all_fixed1').map(mode=>({old,mode,lag:60000})))];assert.equal(jobs.length,d.runs);
  json('engine-bridge',{old:read(`${d.archive}/plan.json`).pins.find((p:R)=>p.file==='scripts/replay-causal-engine.ts'),current:plan.pins.find(p=>p.file==='scripts/replay-causal-engine.ts'),description:d.bridge});
  for(const {old,mode,lag} of jobs){
    if(mode)assert.equal(parity.length,8);const spec=POLICIES.find(x=>x.id===old.policy)!;assert.deepEqual(spec,old.spec);
    const c=config(cfg,spec);assert.equal(sha(JSON.stringify(c)),old.configSha);
    const name=mode?`${old.window}-${old.tp}-${mode}-lag${lag}`:old.name;
    const rawOld=read(`${d.archive}/output/${old.name}-engine.json`),ids=new Set<string>([...rawOld.closes,...rawOld.trims].map((x:R)=>x.variant));assert.equal(ids.size,1);
    const age=spec.ageHours?new SoftStaleController('age',10,0,()=>{throw Error('age only');}):null;
    const high=spec.days?new AgeHighController(spec,(i,at,p)=>highFeature(s.candles,highs,i,2,at,p,0)):null;
    const shade=mode?new ShadeController(mode,s.candles,c.srShadow!,lag):null;
    const events:ResearchInventoryEvent[]=[],attempts:R[]=[],targets:R[]=[];
    const startIdx=core.lowerBound(s.candles,Date.parse(old.start),x=>x.endTs),endIdx=core.lowerBound(s.candles,Date.parse(old.end)+1,x=>x.endTs);
    console.log(`[SRT03 ${results.length+1}/${d.runs}] ${name}`);const began=Date.now();
    const r=runCausalLongReplay({id:[...ids][0],executionModel:'causal_next_open',tpExecutionModel:old.tp,maxPositions:11,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,
      {startIdx,endIdx,recordSnapshots:true,partialClockModel:'transactional',researchTpDeferral:age?.decide,researchTpShade:shade?.decide,
      researchTpObserver:t=>{const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode||p.targetPrice!==t.targetPrice||p.pct!==t.pct)targets.push(t);},
      researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},
      researchReduction:d=>{shade?.advance(d.at);return high?.reduce(d)??null;},researchInventoryObserver:e=>{high?.observe(e);events.push(e);}},c,32000);
    const raw={...r,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(r,32000),accounting=auditFlowLedger(s.candles,events,attempts,metrics,startIdx,endIdx);
    if(!mode){assert.equal(digest,old.digest,`CONTROL DIVERGENCE ${name}`);assert.deepEqual(metrics,old.metrics);parity.push({name,digest});}
    const row={name,window:old.window,start:old.start,end:old.end,policy:old.policy,spec,tp:old.tp,mode,lag,control:!mode,primary:lag===0,startIdx,endIdx,digest,metrics,accounting,
      pendingAtEnd:r.executionAudit!.pendingAtEnd,blocked:r.blocked,configSha:sha(JSON.stringify(c)),counts:shade?.counts??null,ageCounts:age?.counts??null,
      selectedEpisodes:shade?new Set(shade.selected.map(t=>t.episode)).size:0,elapsedMs:Date.now()-began};
    json(`${name}-engine`,raw);json(`${name}-inventory`,events);json(`${name}-attempts`,attempts);json(`${name}-targets`,targets);
    json(`${name}-selections`,shade?.selected??[]);json(`${name}-tp-observations`,age?.observations??[]);json(`${name}-high-reductions`,high?.rows??[]);
    results.push(row);json('results',results);if(parity.length===8&&!fs.existsSync(path.join(out,'control-parity.json')))json('control-parity',{passed:true,controls:parity});
    console.log(JSON.stringify({name,net:metrics.totalPnl,dd:metrics.maxDrawdownPct,selected:row.selectedEpisodes,seconds:row.elapsedMs/1000}));
  }
  json('comparisons',results.filter(x=>x.mode).map(x=>{const b=results.find(y=>y.control&&y.policy===d.parent&&y.tp===x.tp&&y.window===x.window)!;
    return{name:x.name,baseline:b.name,delta:exposureDelta(x.metrics,b.metrics),attribution:componentAttribution(x.metrics,b.metrics)};}));
  core.writeCsv(path.join(out,'overview.csv'),results.map(x=>({name:x.name,net:x.metrics.totalPnl,realized:x.metrics.realized,open:x.metrics.openPnl,wins:x.metrics.profitableEpisodes,winning:x.metrics.grossWin,
    losses:x.metrics.losingEpisodes,losing:-x.metrics.grossLoss,averageLoss:x.metrics.losingEpisodes?-x.metrics.grossLoss/x.metrics.losingEpisodes:0,dd:x.metrics.maxDrawdownPct,fees:x.accounting.modeledFees,
    tpCycles:x.metrics.tpCycles,partials:x.metrics.partials,selectedEpisodes:x.selectedEpisodes})));
  core.writeCsv(path.join(out,'monthly.csv'),results.flatMap(x=>x.accounting.monthly.map((m:R)=>({name:x.name,...m}))));
  json('validation',{passed:true,runs:36,exactControls:8,newTradingDefinitions:4,independentVerificationRequired:true,liveChanges:0});
}
async function main(){const[cmd,key]=process.argv.slice(2);if(cmd==='plan'){
  const card=read(CARD),d=card.definition;validate(d);const old=read(`${d.archive}/plan.json`),state=read(`${d.archive}/state.json`),review=read(`${d.archive}/verification.json`);assert.equal(state.status,'complete');assert(review.passed);
  const unchanged=old.pins.filter((p:R)=>p.file!=='scripts/replay-causal-engine.ts');await verifyPins(process.cwd(),[...unchanged,...old.protectedPins,...state.artifacts]);
  assert.equal(sha(fs.readFileSync('scripts/sr-partial-audit-review.ts')),review.checkerSha);assert.equal(sha(fs.readFileSync(`${d.archive}/review.json`)),review.reviewSha);
  const diag=read(`${d.diagnostic}/state.json`);assert.equal(diag.status,'complete');await verifyPins(process.cwd(),diag.artifacts);
  const files=[...old.pins.map((p:R)=>p.file),...state.artifacts.map((p:R)=>p.file),`${d.archive}/plan.json`,`${d.archive}/verification.json`,`${d.archive}/review.json`,'scripts/sr-partial-audit-review.ts',
    ...diag.artifacts.map((p:R)=>p.file),`${d.diagnostic}/plan.json`,`${d.diagnostic}/verification.json`,CARD,'docs/research/resistance-tp-replay-srt03.md',
    ...['policy','study','tests','verify','report'].map(n=>`scripts/resistance-tp-replay-${n}.ts`)];
  console.log((await createPlan(process.cwd(),card,files,old.protectedPins.map((p:R)=>p.file))).key);
}else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
