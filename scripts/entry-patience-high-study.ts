/** Frozen 2x2 interaction. Reuses accepted engines; no production mutation. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,verifyPins,sha,type Plan} from './research-workflow';
import {EntryPatience,SPECS,type R} from './entry-patience-policy';
import {verifySources} from './entry-patience-source';
import {buildSeries} from './flow-response-study';
import {POLICIES,config,AgeHighController,type Policy} from './age10-gate-policy';
import {SoftStaleController} from './conditional-soft-stale-policy';
import {highFeature} from './near-high-policy';
import {exposureMetrics} from './ladder-exposure-metrics';
import {runCausalLongReplay} from './entry-patience-ladder-engine';
import type {ResearchInventoryEvent} from './replay-causal-engine';
export const CARD='research-inputs/entry-patience-high-interaction-2026-09-15.json';
export const PARENT='age10__minus_deep_stress__minus_tp_cooldown';
export const WAIT=SPECS.find(s=>s.id==='timer8_cap0.1')!;
export const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
export function specFor(highEnabled:boolean):Policy {
  const p=structuredClone(POLICIES.find(p=>p.id===PARENT)!);
  if(!highEnabled)p.days=null;
  return p;
}
export function validate(d:R){assert.equal(d.parent,PARENT);assert.deepEqual(d.waitSpec,WAIT);
  assert.equal(d.expiryMinutes,15);assert.equal(d.runs,20);assert.equal(d.exactControls,10);
  assert.deepEqual(d.highEnabled,[true,false]);assert.deepEqual(d.waitingEnabled,[false,true]);
  assert.deepEqual(d.models,['open','cap']);assert.deepEqual(d.tpModels,['resting_touch','close_confirmed']);
  assert.equal(d.equity,32000);assert.equal(d.feeRate,.00055);
}
export function selected(d:R):R[]{
  const rows:R[]=read(`${d.archive}/output/ladder-results.json`);
  const selected=rows.filter(x=>x.model==='open'&&[PARENT,WAIT.id].includes(x.policy)||
    x.window==='hl_extended'&&x.model==='cap'&&x.policy===WAIT.id);
  assert.equal(selected.length,10);assert.equal(selected.filter(x=>x.waitSpec).length,6);
  for(const x of selected){assert.deepEqual(x.spec,specFor(true));
    assert.deepEqual(x.waitSpec,x.policy===WAIT.id?WAIT:null);
    const w=d.windows.find((w:R)=>w.id===x.window);assert(w);assert.equal(Date.parse(x.start),Date.parse(w.start));assert.equal(Date.parse(x.end),Date.parse(w.end));
  }
  return selected;
}
async function worker(plan:Plan,out:string){const d=plan.card.definition;validate(d);
  const accepted=selected(d),json=(f:string,x:unknown)=>atomicJson(path.join(out,f),x);
  json('source-deltas.json',verifySources());
  const {s,core,cfg,highs}=await buildSeries(d),rows:R[]=[],parity:R[]=[];
  assert.deepEqual(config(cfg,specFor(true)),config(cfg,specFor(false)),'Only controller removed; config identical');
  function run(old:R,highEnabled:boolean){
    const waiting=!!old.waitSpec,spec=specFor(highEnabled),c=config(cfg,spec),model=old.model;
    const arm=`high_${highEnabled?'on':'off'}${waiting?'_wait':''}`;
    const name=`${old.window}-${old.tp}__${arm}__${model}`,engineId=highEnabled?old.engineId:name;
    const startIdx=core.lowerBound(s.candles,Date.parse(old.start),c=>c.endTs),endIdx=core.lowerBound(s.candles,Date.parse(old.end)+1,c=>c.endTs);
    const age=new SoftStaleController('age',10,0,()=>{throw Error('age only');});
    const high=highEnabled?new AgeHighController(spec,(i,at,price)=>highFeature(s.candles,highs,i,2,at,price,0)):null;
    const wait=waiting?new EntryPatience(WAIT,model):null,events:ResearchInventoryEvent[]=[],attempts:R[]=[],targets:R[]=[];
    console.log(`[L17 ${rows.length+1}/20] ${name}`);
    const r=runCausalLongReplay({id:engineId,executionModel:'causal_next_open',tpExecutionModel:old.tp,maxPositions:11,
      hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,{
      startIdx,endIdx,recordSnapshots:true,partialClockModel:'transactional',researchTpDeferral:age.decide,
      researchTpObserver:t=>{const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode)targets.push(t);},
      researchAddVeto:wait?.decide,researchOpenFill:wait?.fill,researchMinuteEnd:wait?.end,
      researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},
      researchReduction:high?.reduce,researchInventoryObserver:e=>{wait?.observe(e);high?.observe(e);events.push(e);}
    },c,32000);
    const raw={...r,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(r,32000);
    const window=wait?.finish(Date.parse(old.end))??{events:[],intents:[],checks:[]};
    if(highEnabled){assert.equal(digest,old.digest,`Archived digest ${name}`);assert.deepEqual(metrics,old.metrics);
      for(const [suffix,value] of [['events',events],['window',window],['attempts',attempts],['targets',targets],
        ['tp-observations',age.observations],['high-reductions',high!.rows]]as const)
        assert.deepEqual(value,read(`${d.archive}/output/${old.name}-${suffix}.json`),`${name}/${suffix}`);
      parity.push({name,original:old.name,digest});
    }else assert(!events.some(e=>e.event.reason.startsWith('research_exit:exit_2d_')));
    const row={name,engineId,arm,policy:arm,spec,waitSpec:waiting?WAIT:null,model,control:highEnabled,
      highEnabled,waiting,window:old.window,tp:old.tp,start:old.start,end:old.end,startIdx,endIdx,digest,metrics,
      configSha256:sha(JSON.stringify(c)),pendingAtEnd:r.executionAudit!.pendingAtEnd,highExits:high?.traces.length??0,
      counts:{opportunities:window.intents.length,filled:window.intents.filter((x:R)=>x.fillAt!==null).length,
        expired:window.intents.filter((x:R)=>x.phase==='expired').length,
        affectedEpisodes:new Set(window.checks.filter((x:R)=>x.veto).map((x:R)=>x.episode)).size}};
    json(`${name}-engine.json`,raw);json(`${name}-events.json`,events);json(`${name}-attempts.json`,attempts);
    json(`${name}-window.json`,window);json(`${name}-targets.json`,targets);json(`${name}-tp-observations.json`,age.observations);
    json(`${name}-high-reductions.json`,high?.rows??[]);rows.push(row);json('results.json',rows);
    console.log(JSON.stringify({net:metrics.totalPnl,DD:metrics.maxDrawdownPct,open:metrics.openPnl,...row.counts}));
  }
  for(const x of accepted)run(x,true);assert.equal(parity.length,10);json('control-parity.json',{passed:true,cases:parity});
  for(const x of accepted)run(x,false);assert.equal(rows.length,20);
  json('validation.json',{passed:true,exactControls:10,runs:20,independentCheckRequired:true,liveChanges:0});
}
async function main(){const [cmd,key]=process.argv.slice(2),card=read(CARD),d=card.definition;validate(d);verifySources();
  if(cmd==='plan'){
    const p=read(`${d.archive}/plan.json`),state=read(`${d.archive}/state.json`);assert.equal(state.status,'complete');
    assert(read(`${d.archive}/verification.json`).passed);await verifyPins(process.cwd(),[...p.pins,...p.protectedPins]);
    const sources=new Set<string>(p.pins.map((x:R)=>x.file));
    const names=selected(d).map(x=>`/output/${x.name}-`);
    const artifacts=state.artifacts.filter((x:R)=>names.some(n=>x.file.includes(n))||x.file.endsWith('/ladder-results.json'));
    await verifyPins(process.cwd(),artifacts);for(const x of artifacts)sources.add(x.file);
    for(const f of [CARD,'docs/research/entry-patience-high-interaction.md','scripts/entry-patience-review.ts','scripts/entry-patience-target-audit.ts'])sources.add(f);
    for(const f of fs.readdirSync('scripts').filter(f=>f.startsWith('entry-patience-high-')&&f.endsWith('.ts')))sources.add(`scripts/${f}`);
    const plan=await createPlan(process.cwd(),card,[...sources],p.protectedPins.map((x:R)=>x.file));console.log(JSON.stringify({key:plan.key,runs:20}));
  }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
