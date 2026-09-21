/** Extend frozen B17/Agg10 controls only; no runtime changes or parameter search. */
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
const CARD='research-inputs/aggressive10-drop-extension-2026-09-15.json';
const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
const PARENT='age10__minus_deep_stress__minus_tp_cooldown';
function validate(d:R){
  assert.equal(d.start,'2026-05-17T20:43:00Z');assert.equal(d.oldCutoff,'2026-09-14T15:27:00Z');assert.equal(d.cutoff,'2026-09-15T20:20:00Z');
  assert.equal(d.initialEquity,32000);assert.equal(d.feeRate,.00055);assert.equal(d.runs,8);assert.equal(d.newTradingDefinitions,0);
  assert.deepEqual(d.policies,['baseline',PARENT]);assert.deepEqual(d.tpModels,['resting_touch','close_confirmed']);
}
async function run(plan:Plan,out:string){
  const d=plan.card.definition;validate(d);const oldRows:R[]=read(`${d.archive}/output/results.json`);
  const controls=oldRows.filter(x=>x.primary&&d.policies.includes(x.policy));assert.equal(controls.length,4);
  assert(read(`${d.archive}/verification.json`).passed);
  const {core,s,cfg,highs}=await buildSeries(d),{runCausalLongReplay}=await import('./replay-causal-engine');
  assert.equal(cfg.aggressive10,undefined);assert(read('bot-config.json').aggressive10.enabled);
  const json=(p:string,x:unknown)=>atomicJson(path.join(out,p),x);
  const results:R[]=[],parity:R[]=[];
  json('source-window.json',{first:s.candles[0].ts,last:s.candles.at(-1)!.endTs,minutes:s.candles.length,
    policy:'Corrected historical OHLC and inherited modeled availability; not literal live arrival/queue reconstruction.'});
  for(const bridge of [true,false])for(const old of controls){
    const spec=POLICIES.find(x=>x.id===old.policy)!;assert(spec);assert.deepEqual(spec,old.spec);
    const prior=read(`${d.archive}/output/${old.name}-engine.json`),ids=new Set<string>([...prior.closes,...prior.trims].map((e:R)=>e.variant));assert.equal(ids.size,1);
    const name=`${bridge?'bridge':'extended'}-${old.tp}--${old.policy}`,c=config(cfg,spec);
    const age=spec.ageHours?new SoftStaleController('age',10,0,()=>{throw Error('age only');}):null;
    const high=spec.days?new AgeHighController(spec,(i,at,price)=>highFeature(s.candles,highs,i,2,at,price,0)):null;
    const events:ResearchInventoryEvent[]=[],attempts:R[]=[],targets:R[]=[];
    const startIdx=core.lowerBound(s.candles,Date.parse(d.start),x=>x.endTs),end=bridge?d.oldCutoff:d.cutoff;
    const endIdx=core.lowerBound(s.candles,Date.parse(end)+1,x=>x.endTs);
    console.log(`[drop-extension ${results.length+1}/8] ${name}`);
    const r=runCausalLongReplay({id:[...ids][0],executionModel:'causal_next_open',tpExecutionModel:old.tp,
      maxPositions:11,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,
      {startIdx,endIdx,recordSnapshots:true,partialClockModel:'transactional',researchTpDeferral:age?.decide,
        researchTpObserver:t=>{const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode)targets.push(t);},
        researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},
        researchReduction:high?.reduce,researchInventoryObserver:e=>{high?.observe(e);events.push(e);}},c,32000);
    const raw={...r,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(r,32000);
    const accounting=auditFlowLedger(s.candles,events,attempts,metrics,startIdx,endIdx);
    if(bridge){assert.equal(digest,old.digest,`Old endpoint digest ${name}`);assert.deepEqual(metrics,old.metrics);parity.push({name,original:old.name,digest});}
    else{
      assert.deepEqual(r.executionAudit!.events.filter(e=>e.fillIndex!<old.endIdx),prior.executionAudit.events,'Future extension changes old execution');
      const boundary=r.snapshots.find(x=>x.ts===Date.parse(d.oldCutoff));assert(boundary);assert(Math.abs(boundary.equity-32000-old.metrics.totalPnl)<1e-6);
    }
    const row={name,originalName:old.name,bridge,primary:!bridge,window:bridge?'bridge':'hl_extended',policy:old.policy,spec,tp:old.tp,lag:0,
      start:d.start,end,startIdx,endIdx,digest,metrics,accounting,audit:age?.counts??null,pendingAtEnd:r.executionAudit!.pendingAtEnd,blocked:r.blocked,
      extension:{cutoffSnapshot:r.snapshots.find(x=>x.ts===Date.parse(d.oldCutoff)),finalSnapshot:r.snapshots.at(-1),
        events:events.filter(x=>x.event.fillAt!>Date.parse(d.oldCutoff)),attempts:attempts.filter(x=>x.at>Date.parse(d.oldCutoff)),
        lastHighDecisions:high?.traces.filter(x=>x.decision.at>Date.parse(d.oldCutoff))??[]}};
    json(`${name}-engine.json`,raw);json(`${name}-inventory.json`,events);json(`${name}-attempts.json`,attempts);
    json(`${name}-targets.json`,targets);json(`${name}-tp-observations.json`,age?.observations??[]);json(`${name}-high-reductions.json`,high?.rows??[]);
    results.push(row);json('results.json',results);
    console.log(JSON.stringify({name,net:metrics.totalPnl,dd:metrics.maxDrawdownPct,open:metrics.openPnl,depth:metrics.openDepth,
      addedNet:!bridge?metrics.totalPnl-old.metrics.totalPnl:null}));
    if(parity.length===4&&!fs.existsSync(path.join(out,'control-parity.json')))json('control-parity.json',{passed:true,controls:parity});
  }
  json('comparisons.json',results.filter(x=>x.primary&&x.policy===PARENT).map(x=>{
    const b=results.find(y=>y.primary&&y.tp===x.tp&&y.policy==='baseline')!;
    return {name:x.name,baseline:b.name,delta:exposureDelta(x.metrics,b.metrics),attribution:componentAttribution(x.metrics,b.metrics)};}));
  json('validation.json',{passed:true,runs:8,exactControls:4,newTradingDefinitions:0,independentVerificationRequired:true,liveChanges:0});
}
async function main(){
  const [cmd,key]=process.argv.slice(2),root=process.cwd();
  if(cmd==='plan'){
    const card=read(CARD);validate(card.definition);const old=read(`${card.definition.archive}/plan.json`),state=read(`${card.definition.archive}/state.json`);
    assert.equal(state.status,'complete');
    // Sources/config and accepted outputs must not change; synced mutable data is newly pinned.
    await verifyPins(root,[...old.pins.filter((p:R)=>!p.file.startsWith('data/')&&p.file!=='bot-state.json'),...state.artifacts]);
    const files=[...old.pins.map((p:R)=>p.file),...state.artifacts.map((p:R)=>p.file),CARD,
      'scripts/aggressive10-drop-extension.ts','scripts/aggressive10-drop-extension-check.ts','scripts/aggressive10-drop-extension-accounting.ts'];
    const plan=await createPlan(root,card,[...new Set<string>(files)],old.protectedPins.map((p:R)=>p.file));
    console.log(JSON.stringify({key:plan.key,cutoff:card.definition.cutoff,runs:8}));
  }else{assert.equal(cmd,'run');await executePlan(root,key,run);}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
