/** EQ01: read-only action atlas on eight exact archived economic controls. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,verifyPins,sha,type Plan} from './research-workflow';
import {read,specFor,WAIT,PARENT} from './entry-patience-high-study';
import {EntryPatience} from './entry-patience-policy';
import {verifySources} from './entry-patience-source';
import {buildSeries} from './flow-response-study';
import {config,AgeHighController} from './age10-gate-policy';
import {SoftStaleController} from './conditional-soft-stale-policy';
import {highFeature} from './near-high-policy';
import {exposureMetrics} from './ladder-exposure-metrics';
import {runCausalLongReplay} from './entry-patience-ladder-engine';
import {loadMinutes} from './relative-reversion-study';
import {applyBtcRepair} from './entry-quality-btc-repair';
import {hourly,EntryContext,categories,joint,type R} from './entry-quality-features';
import {priceLabels} from './entry-quality-labels';
import {analyze} from './entry-quality-analysis';
export const CARD='research-inputs/entry-quality-eq01-2026-09-15.json';
function selected(d:R):R[]{const rows=read(`${d.archive}/output/results.json`).filter((x:R)=>x.highEnabled&&x.model==='open');
  assert.equal(rows.length,8);for(const x of rows){assert.deepEqual(x.spec,specFor(true));assert.deepEqual(x.waitSpec,x.waiting?WAIT:null);
    const w=d.windows.find((w:R)=>w.id===x.window);assert(w);assert.equal(Date.parse(x.start),Date.parse(w.start));assert.equal(Date.parse(x.end),Date.parse(w.end));}
  return rows;}
function validate(d:R){assert.equal(d.parent,PARENT);assert.deepEqual(d.waitSpec,WAIT);assert.equal(d.runs,8);assert.equal(d.exactControls,8);
  assert.deepEqual(d.sourceLagMs,[0,60000]);assert.equal(d.newTradingDefinitions,0);}
async function worker(plan:Plan,out:string){const d=plan.card.definition;validate(d);const accepted=selected(d),json=(f:string,v:unknown)=>atomicJson(path.join(out,f),v);
  json('source-deltas.json',verifySources());const {s,core,cfg,highs}=await buildSeries(d),rows:R[]=[],parity:R[]=[];
  const rawBtc=(await loadMinutes(process.cwd(),'BTCUSDT',Date.parse(d.cutoff))).candles,repair=applyBtcRepair(rawBtc,read(d.btcRepair),Date.parse(d.cutoff));
  json('btc-repair-audit.json',repair.audit);const h=hourly(s.candles),b=hourly(repair.candles),rb=hourly(rawBtc);
  const contexts={repaired:new EntryContext(h,b),raw:new EntryContext(h,rb)};
  json('hourly-context.json',{hype:h,btc:b,rawBtc:rb});
  for(const old of accepted){const spec=specFor(true),c=config(cfg,spec),name=old.name;
    const startIdx=core.lowerBound(s.candles,Date.parse(old.start),(c:R)=>c.endTs),endIdx=core.lowerBound(s.candles,Date.parse(old.end)+1,(c:R)=>c.endTs);
    const age=new SoftStaleController('age',10,0,()=>{throw Error('age only');}),high=new AgeHighController(spec,(i,at,price)=>highFeature(s.candles,highs,i,2,at,price,0));
    const wait=old.waiting?new EntryPatience(WAIT,'open'):null,events:any[]=[],attempts:R[]=[],targets:R[]=[],decisions:R[]=[];
    console.log(`[EQ01 ${rows.length+1}/8] ${name}`);
    const r=runCausalLongReplay({id:old.engineId,executionModel:'causal_next_open',tpExecutionModel:old.tp,maxPositions:11,
      hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none'},s,{
      startIdx,endIdx,recordSnapshots:true,partialClockModel:'transactional',researchTpDeferral:age.decide,
      researchTpObserver:t=>{const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode)targets.push(t);},
      researchAddVeto:a=>{decisions.push({...a});return wait?wait.decide(a):false;},researchOpenFill:wait?.fill,researchMinuteEnd:wait?.end,
      researchAddSize:a=>{attempts.push({...a,approvedNotional:a.requestedNotional});return a.requestedNotional;},
      researchReduction:high.reduce,researchInventoryObserver:e=>{wait?.observe(e);high.observe(e);events.push(e);}
    },c,32000);
    const raw={...r,snapshots:[]},digest=sha(JSON.stringify(raw)),metrics=exposureMetrics(r,32000),window=wait?.finish(Date.parse(old.end))??{events:[],intents:[],checks:[]};
    assert.equal(digest,old.digest,`Exact archived economic digest ${name}`);assert.deepEqual(metrics,old.metrics);
    for(const [suffix,value] of [['events',events],['attempts',attempts],['targets',targets],['window',window],['tp-observations',age.observations],['high-reductions',high.rows]]as const){
      assert.deepEqual(value,read(`${d.archive}/output/${name}-${suffix}.json`),`${name}/${suffix}`);json(`${name}-${suffix}.json`,value);}
    json(`${name}-engine.json`,raw);json(`${name}-decisions.json`,decisions);parity.push({name,digest});
    const source:R[]=[],labels:R[]=[],first=new Set<number>(),entry=new Map<number,number>(),closes=new Map<number,R>();
    for(const e of events){if(e.event.kind==='open'&&!e.before.length)entry.set(e.episode,e.event.fillAt);if(e.event.kind==='close')closes.set(e.episode,e);}
    const observations:R[]=old.waiting?window.intents.map((i:R)=>{const a=decisions.find(a=>a.at===i.signalAt&&a.episode===i.episode);assert(a,'intent has an approved decision');return {...a,intent:i};}):decisions;
    for(const a of observations){const scope=old.waiting?'waiting_intent':a.nextDepth===1?'first_entry':a.nextDepth>=8?a.priceDropOk?'deep_drop':'deep_timer':null;if(!scope)continue;
      const firstDeep=scope==='deep_timer'&&!first.has(a.episode);if(firstDeep)first.add(a.episode);
      const features:R={};for(const [quality,ctx] of Object.entries(contexts))for(const lag of d.sourceLagMs){const f=ctx.at(a.at,lag);features[`${quality}_${lag}`]={...f,categories:categories(f),joint:joint(f)};}
      const id=`${name}:${source.length}`,entryAt=entry.get(a.episode)??null;assert(entryAt!==null,'episode entry exists');
      const {intent,...decision}=a;
      const intentAtDecision=intent?Object.fromEntries(['signalAt','index','episode','nextDepth','reference','cap','expiresAt','activeAt','retryAt'].map(k=>[k,intent[k]])):null;
      source.push({id,scope,firstDeep,entryAt,decision,intentAtDecision,features});
      const close=closes.get(a.episode)?.event,episode=metrics.episodes.find((e:R)=>Date.parse(e.entry)===entryAt);
      const nextMutation=events.find(e=>e.episode===a.episode&&e.event.fillAt>a.at)?.event;
      labels.push({id,intentOutcome:intent??null,prices:priceLabels(s.candles,a.index,Date.parse(old.end)),episode:episode??null,
        baselineCloseWithin15m:close&&close.fillAt>=a.at&&close.fillAt<a.at+15*60000?{at:close.fillAt,reason:close.reason}:null,
        nextMutation:nextMutation?{at:nextMutation.fillAt,kind:nextMutation.kind,reason:nextMutation.reason}:null});
    }
    json(`${name}-features.json`,source);json(`${name}-labels.json`,labels);
    rows.push({...old,decisionCount:decisions.length,observationCount:source.length});json('results.json',rows);
    console.log(JSON.stringify({net:metrics.totalPnl,DD:metrics.maxDrawdownPct,observations:source.length}));
  }
  assert.equal(parity.length,8);json('control-parity.json',{passed:true,cases:parity});
  json('analysis.json',analyze(out,rows));json('validation.json',{passed:true,runs:8,newTradingDefinitions:0,independentCheckRequired:true,liveChanges:0});
}
async function main(){const [cmd,key]=process.argv.slice(2),card=read(CARD),d=card.definition;validate(d);verifySources();
  if(cmd==='plan'){const p=read(`${d.archive}/plan.json`),state=read(`${d.archive}/state.json`);assert.equal(state.status,'complete');assert(read(`${d.archive}/verification.json`).passed);
    await verifyPins(process.cwd(),[...p.pins,...p.protectedPins]);const sources=new Set<string>(p.pins.map((x:R)=>x.file)),names=selected(d).map(x=>`/output/${x.name}-`);
    const artifacts=state.artifacts.filter((x:R)=>names.some(n=>x.file.includes(n))||x.file.endsWith('/results.json'));await verifyPins(process.cwd(),artifacts);
    for(const x of artifacts)sources.add(x.file);for(const f of [CARD,'docs/research/deep-timed-entry-quality-eq01.md',d.btcRepair,d.btcRepair.replace('bundle.json','verification.json'),`${d.archive}/verification.json`])sources.add(f);
    for(const f of fs.readdirSync('scripts').filter(f=>f.startsWith('entry-quality-')&&f.endsWith('.ts')))sources.add(`scripts/${f}`);
    const plan=await createPlan(process.cwd(),card,[...sources],p.protectedPins.map((x:R)=>x.file));console.log(JSON.stringify({key:plan.key,runs:8}));
  }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
