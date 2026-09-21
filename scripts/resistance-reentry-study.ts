import fs from 'fs';import path from 'path';import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,sha,verifyPins,type Plan} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {POLICIES,config,AgeHighController} from './age10-gate-policy';
import {SoftStaleController} from './conditional-soft-stale-policy';
import {highFeature} from './near-high-policy';
import {exposureMetrics,exposureDelta} from './ladder-exposure-metrics';
import {auditFlowLedger} from './flow-response-audit';
import {componentAttribution} from './ladder-combination-accounting';
import {ReentryController,fiveMinuteBars,validate,type WaitMode} from './resistance-reentry-policy';
import {reconstruct,diagnosticSummary,auditWait} from './resistance-reentry-audit';
import type {ResearchInventoryEvent} from './replay-causal-engine';
type R=Record<string,any>;const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
export const CARD='research-inputs/resistance-reentry-srr01-2026-09-16.json';
async function archive(d:R){const old=read(`${d.archive}/plan.json`),state=read(`${d.archive}/state.json`),verification=read(`${d.archive}/verification.json`);
 assert.equal(state.status,'complete');assert(verification.passed);await verifyPins(process.cwd(),[...old.pins,...old.protectedPins,...state.artifacts]);
 assert.equal(sha(fs.readFileSync('scripts/resistance-tp-replay-verify.ts')),verification.checkerSha);assert.equal(sha(fs.readFileSync(`${d.archive}/review.json`)),verification.reviewSha);
 return{old,state,verification};}
async function preaudit(d:R){
 assert(!fs.existsSync(d.auditDirectory),'Never overwrite a completed/partial preaudit');await archive(d);fs.mkdirSync(d.auditDirectory,{recursive:true});
 const {s}=await buildSeries(d),rows:R[]=read(`${d.archive}/output/results.json`),ds=rows.filter(x=>x.mode==='sr_fixed1'&&!x.lag);assert.equal(ds.length,4);
 const summary:R[]=[];
 for(const x of ds){const load=(kind:string)=>read(`${d.archive}/output/${x.name}-${kind}.json`);
  const records=reconstruct(s.candles,x,load('inventory'),load('targets'),load('selections'),load('attempts'));
  atomicJson(`${d.auditDirectory}/${x.name}.json`,records);summary.push({name:x.name,window:x.window,tp:x.tp,...diagnosticSummary(records)});
 }
 atomicJson(`${d.auditDirectory}/summary.json`,summary);atomicJson(`${d.auditDirectory}/receipt.json`,{createdAt:new Date().toISOString(),cardSha:sha(fs.readFileSync(CARD)),auditSourceSha:sha(fs.readFileSync('scripts/resistance-reentry-audit.ts')),paths:4,rows:summary.reduce((n,x)=>n+x.all.n,0),variantEconomicsRun:false,
  interpretation:'D-path next entries and outcomes only. Blocked-entry totals are descriptive reach, not profits achievable by deleting trades. Outputs sealed before W/R economics.'});
 console.log(JSON.stringify(summary));
}
async function worker(plan:Plan,out:string){
 const d=plan.card.definition;validate(d);const olds:R[]=read(`${d.archive}/output/results.json`),controls=olds.filter(x=>!x.lag&&x.policy===d.parent&&(x.control||x.mode==='sr_fixed1'));assert.equal(controls.length,8);
 const {s,cfg,core,highs}=await buildSeries(d),{runCausalLongReplay}=await import('./replay-causal-engine'),bars=fiveMinuteBars(s.candles);
 const json=(n:string,v:unknown)=>atomicJson(path.join(out,n+'.json'),v),results:R[]=[],parity:R[]=[];
 const ds=controls.filter(x=>x.mode==='sr_fixed1'),jobs=[...controls.map(old=>({old,cell:old.mode?'D':'A',lag:0,control:true})),
  ...[0,60000].flatMap(lag=>ds.flatMap(old=>d.variants.map((cell:string)=>({old,cell,lag,control:false}))))];assert.equal(jobs.length,24);
 for(const job of jobs){const {old,cell,lag,control}=job;if(!control)assert.equal(parity.length,8);
  const spec=POLICIES.find(p=>p.id===d.parent)!;assert.deepEqual(spec,old.spec);const c=config(cfg,spec);assert.equal(sha(JSON.stringify(c)),old.configSha);
  const name=control?old.name:`${old.window}-${old.tp}-${cell}-lag${lag}`,mode=cell==='A'?null:'sr_fixed1',waitMode:WaitMode=control?'off':cell;
  const rawOld=read(`${d.archive}/output/${old.name}-engine.json`),ids=new Set<string>([...rawOld.closes,...rawOld.trims].map((x:R)=>x.variant));assert.equal(ids.size,1);
  const age=new SoftStaleController('age',10,0,()=>{throw Error('age only');}),high=new AgeHighController(spec,(i,at,p)=>highFeature(s.candles,highs,i,2,at,p,0));
  const ctl=mode?new ReentryController(waitMode,s.candles,c.srShadow!,lag,bars):null;
  const events:ResearchInventoryEvent[]=[],attempts:R[]=[],targets:R[]=[],aProbes:R[]=[];
  const startIdx=old.startIdx,endIdx=old.endIdx,began=Date.now();console.log(`[SRR01 ${results.length+1}/24] ${name}`);
  const result=runCausalLongReplay({id:[...ids][0],executionModel:'causal_next_open',tpExecutionModel:old.tp,maxPositions:11,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,
   {startIdx,endIdx,recordSnapshots:true,partialClockModel:'transactional',researchTpDeferral:age.decide,researchTpShade:ctl?.decide,
    researchTpObserver:t=>{ctl?.target(t);const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode||p.targetPrice!==t.targetPrice||p.pct!==t.pct)targets.push(t);},
    researchAddVeto:ctl?.veto??(a=>{aProbes.push({...a,blocked:false,waitEpisode:null});return false;}),
    researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},
    researchReduction:d=>{ctl?.advance(d.at);return high.reduce(d);},researchInventoryObserver:e=>{high.observe(e);ctl?.observe(e);events.push(e);}},c,32000);
  const raw={...result,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(result,32000),accounting=auditFlowLedger(s.candles,events,attempts,metrics,startIdx,endIdx);
  if(control){assert.equal(digest,old.digest,`CONTROL ${name}`);assert.deepEqual(metrics,old.metrics);parity.push({name,digest});}
  const row={name,cell,window:old.window,start:old.start,end:old.end,policy:d.parent,spec,tp:old.tp,mode,waitMode,lag,control,primary:lag===0,startIdx,endIdx,digest,metrics,accounting,
   pendingAtEnd:result.executionAudit!.pendingAtEnd,blocked:result.blocked,configSha:sha(JSON.stringify(c)),counts:ctl?.shade.counts??null,ageCounts:age.counts,
   selectedEpisodes:ctl?new Set(ctl.shade.selected.map(t=>t.episode)).size:0,elapsedMs:Date.now()-began};
  const probes=ctl?.probes??aProbes;const waitAudit=auditWait(s.candles,row,events,targets,ctl?.shade.selected??[],probes,ctl?.activations??[]);
  json(`${name}-engine`,raw);json(`${name}-inventory`,events);json(`${name}-attempts`,attempts);json(`${name}-targets`,targets);json(`${name}-probes`,probes);
  json(`${name}-selections`,ctl?.shade.selected??[]);json(`${name}-activations`,ctl?.activations??[]);json(`${name}-tp-observations`,age.observations);json(`${name}-high-reductions`,high.rows);
  results.push({...row,waitAudit});json('results',results);if(parity.length===8&&!fs.existsSync(path.join(out,'control-parity.json')))json('control-parity',{passed:true,controls:parity});
  console.log(JSON.stringify({name,net:metrics.totalPnl,dd:metrics.maxDrawdownPct,...waitAudit,seconds:row.elapsedMs/1000}));
 }
 json('comparisons',results.filter(x=>!x.control).map(x=>{const peers:Record<string,R>={};for(const cell of ['A','D','wait4h']){const b=results.find(y=>y.cell===cell&&y.tp===x.tp&&y.window===x.window&&y.lag===(cell==='wait4h'?x.lag:0))!;
   peers[cell]={baseline:b.name,delta:exposureDelta(x.metrics,b.metrics),attribution:componentAttribution(x.metrics,b.metrics)};}return{name:x.name,...peers,Aprimary:peers.A,baseline:peers.A.baseline,delta:peers.A.delta,attribution:peers.A.attribution};}));
 core.writeCsv(path.join(out,'overview.csv'),results.map(x=>({name:x.name,net:x.metrics.totalPnl,realized:x.metrics.realized,open:x.metrics.openPnl,wins:x.metrics.profitableEpisodes,winning:x.metrics.grossWin,
  losses:x.metrics.losingEpisodes,losing:-x.metrics.grossLoss,averageLoss:-x.metrics.grossLoss/x.metrics.losingEpisodes,dd:x.metrics.maxDrawdownPct,tpCycles:x.metrics.tpCycles,partials:x.metrics.partials,...x.waitAudit})));
 core.writeCsv(path.join(out,'monthly.csv'),results.flatMap(x=>x.accounting.monthly.map((m:R)=>({name:x.name,...m}))));
 json('validation',{passed:true,runs:24,exactControls:8,newTradingDefinitions:2,preauditReceipt:read(`${d.auditDirectory}/receipt.json`),independentVerificationRequired:true,liveChanges:0});
}
async function main(){const [cmd,key]=process.argv.slice(2),card=read(CARD),d=card.definition;validate(d);
 if(cmd==='audit')await preaudit(d);
 else if(cmd==='plan'){const {old,state}=await archive(d),receipt=read(`${d.auditDirectory}/receipt.json`);assert.equal(receipt.cardSha,sha(fs.readFileSync(CARD)));assert.equal(receipt.auditSourceSha,sha(fs.readFileSync('scripts/resistance-reentry-audit.ts')));
  const files=[...old.pins.map((p:R)=>p.file),...state.artifacts.map((p:R)=>p.file),`${d.archive}/plan.json`,`${d.archive}/verification.json`,`${d.archive}/review.json`,CARD,'docs/research/resistance-reentry-srr01.md',
   ...['policy','audit','study','tests','verify','report','dd'].map(n=>`scripts/resistance-reentry-${n}.ts`),...fs.readdirSync(d.auditDirectory).map(f=>`${d.auditDirectory}/${f}`)];
  console.log((await createPlan(process.cwd(),card,files,old.protectedPins.map((p:R)=>p.file))).key);
 }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
