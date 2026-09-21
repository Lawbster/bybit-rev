import fs from 'fs';import path from 'path';import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,sha,verifyPins,type Plan} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {POLICIES,config,AgeHighController} from './age10-gate-policy';
import {SoftStaleController} from './conditional-soft-stale-policy';
import {highFeature} from './near-high-policy';
import {exposureMetrics,exposureDelta} from './ladder-exposure-metrics';
import {auditFlowLedger} from './flow-response-audit';
import {componentAttribution} from './ladder-combination-accounting';
import {ResistanceSkip,validate,type R} from './resistance-add-skip-policy';
import {archivedOpportunity,reachSummary,interventionSummary} from './resistance-add-skip-audit';
import type {ResearchInventoryEvent} from './replay-causal-engine';
export const CARD='research-inputs/resistance-add-skip-srk01-2026-09-16.json';
const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
async function archive(d:R){
  const old=read(`${d.archive}/plan.json`),state=read(`${d.archive}/state.json`),receipt=read(`${d.archive}/verification.json`);
  assert.equal(state.status,'complete');assert(receipt.passed);
  await verifyPins(process.cwd(),[...old.pins,...old.protectedPins,...state.artifacts]);
  assert.equal(sha(fs.readFileSync('scripts/resistance-reentry-review.ts')),receipt.checkerSha);
  assert.equal(sha(fs.readFileSync(`${d.archive}/review.json`)),receipt.reviewSha);return{old,state};
}
function controls(d:R):R[]{const rows=read(`${d.archive}/output/results.json`).filter((x:R)=>x.cell==='A');assert.equal(rows.length,4);return rows;}
async function audit(d:R){
  assert(!fs.existsSync(d.auditDirectory),'Never overwrite a sealed or partial audit');await archive(d);
  fs.mkdirSync(d.auditDirectory,{recursive:true});const {s,cfg}=await buildSeries(d),summary:R[]=[];
  for(const x of controls(d)){
    const c=config(cfg,POLICIES.find(p=>p.id===d.parent)!),load=(k:string)=>read(`${d.archive}/output/${x.name}-${k}.json`);
    assert.equal(sha(JSON.stringify(c)),x.configSha);const events=load('inventory');
    const rows=archivedOpportunity(s.candles,x,events,load('attempts'),load('probes'),c);
    atomicJson(`${d.auditDirectory}/${x.name}.json`,rows);summary.push({name:x.name,...reachSummary(rows,events,x)});
  }
  atomicJson(`${d.auditDirectory}/summary.json`,summary);
  atomicJson(`${d.auditDirectory}/receipt.json`,{createdAt:new Date().toISOString(),cardSha:sha(fs.readFileSync(CARD)),
    sourceHashes:Object.fromEntries(['policy','audit'].map(n=>[n,sha(fs.readFileSync(`scripts/resistance-add-skip-${n}.ts`))])),
    paths:4,variantEconomicsRun:false,scope:'Accepted independent gate-approved denominator, one-to-one attempt/fill/pending reconciliation, source-causal SR features. Outcome labels are descriptive only.'});
  console.log(JSON.stringify(summary.map(x=>({name:x.name,all:x.all,deepTimer:x.deepTimer,selected:x.selected}))));
}
async function worker(plan:Plan,out:string){
  const d=plan.card.definition;validate(d);const olds=controls(d),{s,cfg,core,highs}=await buildSeries(d);
  const {runCausalLongReplay}=await import('./replay-causal-engine');
  const json=(n:string,v:unknown)=>atomicJson(path.join(out,n+'.json'),v),rows:R[]=[],parity:R[]=[];
  const jobs=[...olds.map(old=>({old,lag:0,control:true})),...[0,60000].flatMap(lag=>olds.map(old=>({old,lag,control:false})))];
  for(const {old,lag,control} of jobs){
    if(!control)assert.equal(parity.length,4);const spec=POLICIES.find(p=>p.id===d.parent)!;assert.deepEqual(spec,old.spec);
    const c=config(cfg,spec);assert.equal(sha(JSON.stringify(c)),old.configSha);
    const name=control?old.name:`${old.window}-${old.tp}-timer_resistance_skip-lag${lag}`,rawOld=read(`${d.archive}/output/${old.name}-engine.json`);
    const ids=new Set<string>([...rawOld.closes,...rawOld.trims].map((v:R)=>v.variant));assert.equal(ids.size,1);
    const age=new SoftStaleController('age',10,0,()=>{throw Error('age only');}),ctl=new ResistanceSkip(s.candles,c.srShadow!,lag,!control);
    const high=new AgeHighController(spec,(i,at,p)=>highFeature(s.candles,highs,i,2,at,p,0));
    const events:ResearchInventoryEvent[]=[],attempts:R[]=[],targets:R[]=[],start=Date.now();console.log(`[SRK01 ${rows.length+1}/12] ${name}`);
    const result=runCausalLongReplay({id:[...ids][0],executionModel:'causal_next_open',tpExecutionModel:old.tp,maxPositions:11,
      hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,
      {startIdx:old.startIdx,endIdx:old.endIdx,recordSnapshots:true,partialClockModel:'transactional',researchTpDeferral:age.decide,
       researchTpObserver:t=>{const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode||p.targetPrice!==t.targetPrice||p.pct!==t.pct)targets.push(t);},
       researchReduction:d=>{ctl.advance(d.at);return high.reduce(d);},researchAddVeto:ctl.veto,
       researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},
       researchInventoryObserver:e=>{high.observe(e);events.push(e);}},c,32000);
    const raw={...result,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(result,32000);
    const accounting=auditFlowLedger(s.candles,events,attempts,metrics,old.startIdx,old.endIdx);
    if(control){assert.equal(digest,old.digest);assert.deepEqual(metrics,old.metrics);parity.push({name,digest});
      const reconstructed=archivedOpportunity(s.candles,{...old,pendingAtEnd:result.executionAudit!.pendingAtEnd},events,attempts,
        ctl.probes.map(({feature,wouldSkip,blocked,...a})=>({...a,blocked:false,waitEpisode:null})),c);
      assert.deepEqual(reconstructed,read(`${d.auditDirectory}/${name}.json`),'preaudit replay reproduction');
    }
    const row={name,cell:control?'A':'K',policy:d.parent,spec,control,lag,window:old.window,tp:old.tp,start:old.start,end:old.end,
      startIdx:old.startIdx,endIdx:old.endIdx,digest,metrics,accounting,pendingAtEnd:result.executionAudit!.pendingAtEnd,
      configSha:sha(JSON.stringify(c)),ageCounts:age.counts,blocked:result.blocked};
    const interventions=interventionSummary(ctl.probes,events,row);
    for(const [kind,data] of Object.entries({engine:raw,inventory:events,attempts,targets,probes:ctl.probes,'tp-observations':age.observations,'high-reductions':high.rows}))json(`${name}-${kind}`,data);
    rows.push({...row,interventions});json('results',rows);
    if(parity.length===4&&!fs.existsSync(path.join(out,'control-parity.json')))json('control-parity',{passed:true,controls:parity});
    console.log(JSON.stringify({name,net:metrics.totalPnl,dd:metrics.maxDrawdownPct,blocked:interventions.blockedChecks,episodes:interventions.affectedEpisodes,seconds:(Date.now()-start)/1000}));
  }
  json('comparisons',rows.filter(x=>!x.control).map(x=>{const b=rows.find(b=>b.control&&b.window===x.window&&b.tp===x.tp)!;
    return{name:x.name,baseline:b.name,delta:exposureDelta(x.metrics,b.metrics),attribution:componentAttribution(x.metrics,b.metrics)};}));
  core.writeCsv(path.join(out,'overview.csv'),rows.map(x=>({name:x.name,net:x.metrics.totalPnl,realized:x.metrics.realized,open:x.metrics.openPnl,
    wins:x.metrics.profitableEpisodes,winning:x.metrics.grossWin,losses:x.metrics.losingEpisodes,losing:-x.metrics.grossLoss,
    averageLoss:-x.metrics.grossLoss/x.metrics.losingEpisodes,dd:x.metrics.maxDrawdownPct,tpCycles:x.metrics.tpCycles,partials:x.metrics.partials,
    blocked:x.interventions.blockedChecks,affectedEpisodes:x.interventions.affectedEpisodes})));
  core.writeCsv(path.join(out,'monthly.csv'),rows.flatMap(x=>x.accounting.monthly.map((m:R)=>({name:x.name,...m}))));
  json('validation',{passed:true,runs:12,exactControls:4,newTradingDefinitions:1,independentVerificationRequired:true,liveChanges:0});
}
async function main(){const [cmd,key]=process.argv.slice(2),card=read(CARD),d=card.definition;validate(d);
  if(cmd==='audit')await audit(d);
  else if(cmd==='plan'){
    const {old,state}=await archive(d),receipt=read(`${d.auditDirectory}/receipt.json`);assert.equal(receipt.cardSha,sha(fs.readFileSync(CARD)));
    for(const [n,h] of Object.entries(receipt.sourceHashes))assert.equal(sha(fs.readFileSync(`scripts/resistance-add-skip-${n}.ts`)),h);
    const files=[...old.pins.map((p:R)=>p.file),...state.artifacts.map((p:R)=>p.file),`${d.archive}/plan.json`,`${d.archive}/verification.json`,`${d.archive}/review.json`,
      CARD,'docs/research/resistance-add-skip-srk01.md',...['policy','audit','study','tests','verify','report'].map(n=>`scripts/resistance-add-skip-${n}.ts`),
      ...fs.readdirSync(d.auditDirectory).map(f=>`${d.auditDirectory}/${f}`)];
    console.log((await createPlan(process.cwd(),card,files,old.protectedPins.map((p:R)=>p.file))).key);
  }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
