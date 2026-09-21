import './sr-multimap-bootstrap';
import fs from 'fs';import path from 'path';import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,sha,verifyPins,type Plan} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {POLICIES,config,AgeHighController} from './age10-gate-policy';
import {SoftStaleController} from './conditional-soft-stale-policy';
import {highFeature} from './near-high-policy';
import {exposureMetrics,exposureDelta} from './ladder-exposure-metrics';
import {auditFlowLedger} from './flow-response-audit';
import {componentAttribution} from './ladder-combination-accounting';
import {runCausalLongReplay,type ResearchInventoryEvent} from './replay-causal-engine-sm01';
import {MAPS,LocalTape,MacroTape,MultiContext,MultiShade,type MapSet,type Strategy,type R} from './sr-multimap-policy';
export const CARD='research-inputs/sr-multimap-sm01-2026-09-17.json';
export const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
async function worker(plan:Plan,out:string){
 const d=plan.card.definition;assert.equal(d.runs,72);assert.deepEqual(d.maps,[...MAPS]);assert.deepEqual(d.strategies,['partial','partial_buffer']);
 const archived:R[]=read(`${d.archive}/output/results.json`),priorPartials:R[]=read(`${d.partialArchive}/output/results.json`);
 const controls=archived.filter(x=>x.policy===d.parent&&!x.lag&&(x.mode===null||x.mode==='buffer03'));
 assert.equal(controls.length,8);const disabled=priorPartials.filter(x=>x.mode==='disabled'&&!x.lag);assert.equal(disabled.length,4);
 const parents=controls.filter(x=>x.mode===null),json=(name:string,x:unknown)=>atomicJson(path.join(out,name+'.json'),x);
 const {s,cfg,core,highs}=await buildSeries(d),spec=POLICIES.find(x=>x.id===d.parent)!;
 const starts=d.windows.flatMap((w:R)=>d.sourceLagsMs.map((lag:number)=>Date.parse(w.start)-lag));
 console.log('[SM01] Persist local14d tape once; read existing 4H/1D maps');
 const local=new LocalTape(s.candles,cfg.srShadow!,starts,path.join(out,'local14d-cache.jsonl'));
 const macro={major4h:new MacroTape('major4h',d.macro4h),major1d:new MacroTape('major1d',d.macro1d)};
 json('cache-summary',{localFrames:local.frames.length,initialSeeds:[...local.seeds.keys()],macro4h:d.macro4h,macro1d:d.macro1d,macroRebuilds:0});
 const jobs:Array<{old:R;strategy:Strategy;set:MapSet;lag:number;control:boolean;archive:string}>=[
  ...controls.map(old=>({old,strategy:(old.mode?'partial_buffer':'partial') as Strategy,set:'local14d' as MapSet,lag:0,control:true,archive:d.archive})),
  ...disabled.map(old=>({old,strategy:'none' as Strategy,set:'local14d' as MapSet,lag:0,control:true,archive:d.partialArchive})),
  ...[0,60000].flatMap(lag=>parents.filter(old=>!lag||old.window==='recent').flatMap(old=>d.strategies.flatMap((strategy:Strategy)=>MAPS.filter(set=>set!=='local14d').map(set=>({old,strategy,set,lag,control:false,archive:d.archive})))))
 ];assert.equal(jobs.length,72);
 const results:R[]=[],parity:R[]=[];
 for(const job of jobs){const {old,strategy,set,lag,control,archive}=job;
  if(!control)assert.equal(parity.length,12);const c=config(cfg,spec);assert.deepEqual(spec,old.spec);if(strategy==='none')c.srPartialExitAction!.enabled=false;
  if(control)assert.equal(sha(JSON.stringify(c)),old.configSha);
  const original=read(`${archive}/output/${old.name}-engine.json`),ids=new Set<string>([...original.closes,...original.trims].map((x:R)=>x.variant));assert.equal(ids.size,1);
  const name=`${old.window}-${old.tp}-${strategy}-${set}-lag${lag}`,startIdx=core.lowerBound(s.candles,Date.parse(old.start),x=>x.endTs),endIdx=core.lowerBound(s.candles,Date.parse(old.end)+1,x=>x.endTs);
  const ctx=new MultiContext(set,lag,s.candles[startIdx].endTs,c.srShadow!,local,macro);
  const shade=strategy==='partial_buffer'?new MultiShade(ctx):null;
  const age=new SoftStaleController('age',10,0,()=>{throw Error('age only');}),high=new AgeHighController(spec,(i,at,p)=>highFeature(s.candles,highs,i,2,at,p,0));
  const events:ResearchInventoryEvent[]=[],attempts:R[]=[],targets:R[]=[],gates:R[]=[];
  console.log(`[SM01 ${results.length+1}/72] ${name}`);const began=Date.now();
  const r=runCausalLongReplay({id:[...ids][0],executionModel:'causal_next_open',tpExecutionModel:old.tp,maxPositions:11,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,
   {startIdx,endIdx,recordSnapshots:true,partialClockModel:'transactional',researchSrContextFactory:()=>ctx,researchTpDeferral:age.decide,researchTpShade:shade?.decide,
    researchTpObserver:t=>{const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode||p.targetPrice!==t.targetPrice||p.pct!==t.pct)targets.push(t);},
    researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},
    researchSrPartialGate:q=>{if(q.nonPulseEligible&&q.baseCandidate){const hit=ctx.engine.nearestResistance(q.at,q.price),lv=hit?.lv as R|undefined;
      gates.push({...q,source:lv?.source,zoneId:lv?.zoneId,sourceAt:q.at-lag,levelSourceAt:lv?.sourceAt,fire:q.requiredCandidate});}return q.requiredCandidate;},
    researchReduction:high.reduce,researchInventoryObserver:e=>{high.observe(e);events.push(e);}},c,32000);
  const raw={...r,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(r,32000),accounting=auditFlowLedger(s.candles,events,attempts,metrics,startIdx,endIdx);
  if(control){assert.equal(digest,old.digest,`CONTROL DIVERGENCE ${name}`);assert.deepEqual(metrics,old.metrics);parity.push({name,archive,original:old.name,digest});}
  const row={name,window:old.window,start:old.start,end:old.end,policy:d.parent,spec,tp:old.tp,strategy,set,lag,control,primary:!lag,startIdx,endIdx,digest,metrics,accounting,
    pendingAtEnd:r.executionAudit!.pendingAtEnd,blocked:r.blocked,configSha:sha(JSON.stringify(c)),counts:shade?.counts??null,ageCounts:age.counts,sourceStats:ctx.stats,
    selectedEpisodes:shade?new Set(shade.selected.map(t=>t.episode)).size:0,partialCandidates:gates.length,controlRef:control?{archive,name:old.name}:null,elapsedMs:Date.now()-began};
  json(name+'-engine',raw);json(name+'-inventory',events);json(name+'-attempts',attempts);json(name+'-targets',targets);json(name+'-partial-gates',gates);
  json(name+'-selections',shade?.selected??[]);json(name+'-tp-observations',age.observations);json(name+'-high-reductions',high.rows);
  results.push(row);json('results',results);if(parity.length===12&&!fs.existsSync(path.join(out,'control-parity.json')))json('control-parity',{passed:true,controls:parity});
  console.log(JSON.stringify({name,net:metrics.totalPnl,dd:metrics.maxDrawdownPct,partials:metrics.partials,selected:row.selectedEpisodes,seconds:row.elapsedMs/1000}));
 }
 json('comparisons',results.map(x=>{
   const current=results.find(b=>b.strategy==='partial'&&b.set==='local14d'&&!b.lag&&b.window===x.window&&b.tp===x.tp)!;
   const same=results.find(b=>b.strategy===x.strategy&&b.set==='local14d'&&!b.lag&&b.window===x.window&&b.tp===x.tp)!;
   const partial=results.find(b=>b.strategy==='partial'&&b.set===x.set&&b.lag===x.lag&&b.window===x.window&&b.tp===x.tp);
   return{name:x.name,baseline:current.name,delta:exposureDelta(x.metrics,current.metrics),sameStrategy:same.name,sameStrategyDelta:exposureDelta(x.metrics,same.metrics),
     partialOnly:partial?.name??null,partialDelta:partial?exposureDelta(x.metrics,partial.metrics):null,attribution:componentAttribution(x.metrics,current.metrics)};
 }));
 core.writeCsv(path.join(out,'overview.csv'),results.map(x=>({name:x.name,window:x.window,tp:x.tp,strategy:x.strategy,maps:x.set,lag:x.lag,
   net:x.metrics.totalPnl,realized:x.metrics.realized,open:x.metrics.openPnl,wins:x.metrics.profitableEpisodes,winning:x.metrics.grossWin,losses:x.metrics.losingEpisodes,losing:-x.metrics.grossLoss,
   averageLoss:x.metrics.losingEpisodes?-x.metrics.grossLoss/x.metrics.losingEpisodes:0,dd:x.metrics.maxDrawdownPct,tpCycles:x.metrics.tpCycles,partials:x.metrics.partials,selectedEpisodes:x.selectedEpisodes})));
 core.writeCsv(path.join(out,'monthly.csv'),results.flatMap(x=>x.accounting.monthly.map((m:R)=>({name:x.name,...m}))));
 json('validation',{passed:true,runs:72,exactControls:12,newTradingDefinitions:10,independentVerificationRequired:true,liveChanges:0});
}
async function main(){const [cmd,key]=process.argv.slice(2);if(cmd==='plan'){
 const card=read(CARD),d=card.definition,old=read(`${d.archive}/plan.json`);
 const files=old.pins.filter((p:R)=>!p.file.startsWith('backtests/research-workflow/')).map((p:R)=>p.file);
 for(const archive of [d.archive,d.partialArchive]){
   assert(read(`${archive}/verification.json`).passed);files.push(`${archive}/output/results.json`,`${archive}/plan.json`,`${archive}/verification.json`);
   const rows:R[]=read(`${archive}/output/results.json`);for(const x of rows.filter(x=>x.policy===d.parent&&!x.lag&&(archive===d.archive?(x.mode===null||x.mode==='buffer03'):x.mode==='disabled')))files.push(`${archive}/output/${x.name}-engine.json`);
 }
 for(const k of [d.macro4h,d.macro1d]){const dir=`backtests/research-workflow/${k}`;files.push(`${dir}/output/map.json`,`${dir}/state.json`,`${dir}/verification.json`);}
 files.push(CARD,'docs/research/sr-multimap-sm01.md','scripts/replay-causal-engine-sm01.ts','scripts/sr-level-ablation-policy.ts','scripts/major-sr-history-map.ts',
   ...['bootstrap','policy','study','tests','verify','report'].map(n=>`scripts/sr-multimap-${n}.ts`));
 const protectedFiles=old.protectedPins.map((p:R)=>p.file);protectedFiles.push('scripts/replay-causal-engine.ts','scripts/replay-sr-context.ts','src/bot/sr-memory-zones.ts');
 const plan=await createPlan(process.cwd(),card,[...new Set<string>(files)],protectedFiles);
 const changes=old.pins.filter((p:R)=>plan.pins.some(q=>q.file===p.file&&q.sha256!==p.sha256)).map((p:R)=>({file:p.file,old:p.sha256,current:plan.pins.find(q=>q.file===p.file)!.sha256}));
 console.log(JSON.stringify({key:plan.key,sourceChanges:changes}));
 }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
