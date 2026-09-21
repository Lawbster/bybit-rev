import fs from "fs";
import path from "path";
import assert from "assert/strict";
import {createPlan,executePlan,atomicJson,verifyPins,sha,type Plan} from "./research-workflow";
import {read} from "./btc-hype-threshold-study";
import {loadMinutes} from "./relative-reversion-study";
import {runCappedEntry} from "./entry-patience-standalone-engine";
import {verifySources} from "./entry-patience-source";
import {EntryPatience,SPECS,type R,type Spec} from "./entry-patience-policy";
import {controls,PARENT} from "./aggressive10-high-window-study";
import {buildSeries} from "./flow-response-study";
import {POLICIES,config,AgeHighController} from "./age10-gate-policy";
import {SoftStaleController} from "./conditional-soft-stale-policy";
import {highFeature} from "./near-high-policy";
import {exposureMetrics,exposureDelta} from "./ladder-exposure-metrics";
import {componentAttribution} from "./ladder-combination-accounting";
import {runCausalLongReplay} from "./entry-patience-ladder-engine";
import type {ResearchInventoryEvent} from "./replay-causal-engine";
export const CARD="research-inputs/entry-patience-2026-09-14.json";
export function validate(d:R){assert.equal(d.expiryMinutes,15);assert.deepEqual(d.costBps,[0,2,5,10]);assert.deepEqual(d.offsetPct,[0,.1,.3]);
  assert.deepEqual(d.minimumDepth,[2,8]);assert.equal(d.standaloneRuns,60);assert.equal(d.ladderRuns,56);assert.equal(d.equity,32000);assert.equal(d.feeRate,.00055);}
async function standalone(plan:Plan,out:string){const d=plan.card.definition,old:R[]=read(`${d.bh02}/output/results.json`);
  const selected=old.filter(x=>x.expiryMinutes===15||x.controlRule==='btc_L1_T0.5_P-1_long_H12');assert.equal(selected.length,12);
  const cs=(await loadMinutes(process.cwd(),'HYPEUSDT',Date.parse(d.cutoff),d.repairFile)).candles;
  const signals=read(`${d.bh02}/output/signals.json`),byEnd=new Map(cs.map(c=>[c.endTs,c.close]));
  for(const s of signals)assert.equal(s.cap,byEnd.get(s.at));
  const rows:R[]=[],parity:R[]=[];
  function run(a:R,bps:number|undefined){const minutes=cs.filter(c=>c.ts>=Date.parse(a.start)&&c.endTs<=Date.parse(a.end));
    const options={...a.options,...(bps===undefined?{}:{executionBps:bps})};
    const ss=signals.filter((s:R)=>s.at>=options.start&&s.at<options.end),r=runCappedEntry(minutes,ss,options);
    const name=`${a.name}__${bps===undefined?'control':`cost${bps}`}`;
    if(bps===undefined){const original=read(`${d.bh02}/output/${a.name}.json`);
      for(const k of ['stats','monthly','open','trades','intents','occupiedSignals','entryStats']as const)assert.deepEqual(r[k],original[k],`${name}/${k}`);
      parity.push({name,original:a.name,digest:sha(JSON.stringify(r))});}
    const row={name,original:a.name,window:a.window,start:a.start,end:a.end,delayMs:a.delayMs,model:a.model,expiryMinutes:a.expiryMinutes,
      control:bps===undefined,executionBps:bps??null,options,stats:r.stats,monthly:r.monthly,open:r.open,entryStats:r.entryStats};
    atomicJson(path.join(out,`${name}.json`),{...row,trades:r.trades,intents:r.intents,occupiedSignals:r.occupiedSignals});rows.push(row);
    console.log(`[BH03 ${rows.length}/60] ${name} net=${r.stats.net.toFixed(2)} DD=${r.stats.maxAdverseDrawdownPct.toFixed(2)}`);
  }
  for(const a of selected)run(a,undefined);atomicJson(path.join(out,'standalone-parity.json'),{passed:true,cases:parity});
  for(const a of selected)for(const bps of d.costBps)run(a,bps);
  assert.equal(rows.length,60);atomicJson(path.join(out,'standalone-results.json'),rows);
}
async function ladder(plan:Plan,out:string){const d=plan.card.definition,accepted=controls(d),{core,s,cfg,highs}=await buildSeries(d);
  const rows:R[]=[],parity:R[]=[];const json=(file:string,x:unknown)=>atomicJson(path.join(out,file),x);
  function run(old:R,spec:Spec|null,model:'open'|'cap'|'activation60'){
    const parent=POLICIES.find(p=>p.id===old.policy)!,c=config(cfg,parent),control=!spec;
    const name=`${old.window}-${old.tp}__${spec?.id??old.policy}__${model}`;
    let engineId=name;if(control){assert.deepEqual(parent,old.spec);const raw=read(`${old.archive}/output/${old.name}-engine.json`);
      const ids=new Set<string>([...raw.closes,...raw.trims].map((e:R)=>e.variant));assert.equal(ids.size,1);engineId=[...ids][0];}
    const startIdx=core.lowerBound(s.candles,Date.parse(old.start),c=>c.endTs),endIdx=core.lowerBound(s.candles,Date.parse(old.end)+1,c=>c.endTs);
    const age=parent.ageHours?new SoftStaleController('age',parent.ageHours,0,()=>{throw Error('age only');}):null;
    const high=parent.days?new AgeHighController(parent,(i,at,price)=>highFeature(s.candles,highs,i,2,at,price,0)):null;
    const wait=spec?new EntryPatience(spec,model):null,events:ResearchInventoryEvent[]=[],attempts:R[]=[],targets:R[]=[];
    console.log(`[L16 ${rows.length+1}/56] ${name}`);
    const r=runCausalLongReplay({id:engineId,executionModel:'causal_next_open',tpExecutionModel:old.tp,maxPositions:11,hardFlattenHours:12,
      hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,{startIdx,endIdx,recordSnapshots:true,partialClockModel:'transactional',
      researchTpDeferral:age?.decide,researchTpObserver:t=>{const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode)targets.push(t);},
      researchAddVeto:wait?.decide,researchOpenFill:wait?.fill,researchMinuteEnd:wait?.end,
      researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},researchReduction:high?.reduce,
      researchInventoryObserver:e=>{wait?.observe(e);high?.observe(e);events.push(e);}},c,32000);
    const raw={...r,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(r,32000);
    if(control){assert.equal(digest,old.digest,`Exact engine ${name}`);assert.deepEqual(metrics,old.metrics);parity.push({name,archive:old.archive,original:old.name,digest});}
    const window=wait?.finish(Date.parse(old.end))??{events:[],intents:[],checks:[]};
    const row={name,engineId,policy:spec?.id??old.policy,spec:parent,waitSpec:spec,model,control,window:old.window,tp:old.tp,start:old.start,end:old.end,
      startIdx,endIdx,digest,metrics,pendingAtEnd:r.executionAudit!.pendingAtEnd,highExits:high?.traces.length??0,
      counts:{opportunities:window.intents.length,filled:window.intents.filter((x:R)=>x.fillAt!==null).length,
        expired:window.intents.filter((x:R)=>x.phase==='expired').length,affectedEpisodes:new Set(window.checks.filter((x:R)=>x.veto).map((x:R)=>x.episode)).size}};
    json(`${name}-engine.json`,raw);json(`${name}-events.json`,events);json(`${name}-attempts.json`,attempts);json(`${name}-window.json`,window);
    json(`${name}-targets.json`,targets);json(`${name}-tp-observations.json`,age?.observations??[]);json(`${name}-high-reductions.json`,high?.rows??[]);
    rows.push(row);json('ladder-results.json',rows);console.log(JSON.stringify({net:metrics.totalPnl,dd:metrics.maxDrawdownPct,...row.counts}));
  }
  for(const old of accepted)run(old,null,'open');assert.equal(parity.length,8);json('ladder-parity.json',{passed:true,cases:parity});
  for(const old of accepted.filter(x=>x.policy===PARENT))for(const spec of SPECS)run(old,spec,'open');
  for(const model of ['cap','activation60']as const)for(const old of accepted.filter(x=>x.policy===PARENT&&x.window==='hl_extended'))for(const spec of SPECS)run(old,spec,model);
  assert.equal(rows.length,56);json('ladder-comparisons.json',rows.map(x=>{
    const peers=Object.fromEntries(['baseline',PARENT].map(p=>{const b=rows.find(b=>b.control&&b.window===x.window&&b.tp===x.tp&&b.policy===p)!;
      return[p,{delta:exposureDelta(x.metrics,b.metrics),attribution:componentAttribution(x.metrics,b.metrics)}];}));return {name:x.name,...peers};}));
}
async function worker(p:Plan,out:string){validate(p.card.definition);atomicJson(path.join(out,'source-deltas.json'),verifySources());
  await standalone(p,out);await ladder(p,out);atomicJson(path.join(out,'validation.json'),{passed:true,independentVerificationRequired:true,standalone:60,ladder:56,liveChanges:0});}
async function main(){const [cmd,key]=process.argv.slice(2),card=read(CARD),d=card.definition;validate(d);verifySources();
  if(cmd==='plan'){
    const sources=new Set<string>([CARD,'docs/research/entry-patience-bh03-l16.md']),protectedFiles=new Set<string>();
    for(const archive of [d.bh02,d.recentArchive,d.olderArchive]){const p=read(`${archive}/plan.json`),state=read(`${archive}/state.json`);
      assert.equal(state.status,'complete');assert(read(`${archive}/verification.json`).passed);
      // Accepted inputs must still match; inherited old controls are separately reproduced exactly.
      if(archive!==d.olderArchive)await verifyPins(process.cwd(),[...p.pins,...p.protectedPins]);
      for(const pin of p.pins)if(archive!==d.olderArchive)sources.add(pin.file);
      for(const pin of p.protectedPins)protectedFiles.add(pin.file);
      const selected=state.artifacts.filter((x:R)=>x.file.endsWith('/results.json')||archive===d.bh02&&(/cap15|btc_L1_T0.5_P-1_long_H12/.test(x.file)));
      await verifyPins(process.cwd(),selected);for(const pin of selected)sources.add(pin.file);
    }
    for(const name of fs.readdirSync('scripts').filter(f=>f.startsWith('entry-patience-')&&f.endsWith('.ts')))sources.add(`scripts/${name}`);
    for(const x of controls(d))sources.add(`${x.archive}/output/${x.name}-engine.json`);
    const p=await createPlan(process.cwd(),card,[...sources],[...protectedFiles]);console.log(JSON.stringify({key:p.key,runs:116}));
  }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
