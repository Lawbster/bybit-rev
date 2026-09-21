/** SRF01 frozen-path diagnostic. Does not execute an alternative trading strategy. */
import fs from 'fs';import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,sha,verifyPins,type Plan} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {buildFrames} from './macro-support-policy';
import {responseTape,rowAt,type Row} from './major-recovery-policy';
import {POLICIES,config} from './age10-gate-policy';
import {auditFlowLedger} from './flow-response-audit';
import {checkHardFlatten} from '../src/bot/strategy';
import {facts,classify,inventoryNet,partialNet,tally,H,type R} from './support-flatten-reach-policy';
export const CARD='research-inputs/support-flatten-reach-srf01-2026-09-16.json';
export const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
export function validate(d:R){assert.equal(d.phase,'reach_audit_only');assert.equal(d.newTradingDefinitions,0);assert.equal(d.economicRuns,0);
 assert.equal(d.exactArchivedControls,4);assert.deepEqual(d.sourceLagMs,[0,60000]);assert.deepEqual(d.ageHours,{current:12,diagnostic:6});assert.equal(d.pnlPct,-2);}
export function analyze(s:R,x:R,events:R[],rows:Row[],lag:number){
 const cs=s.candles,actions=new Map(events.filter(e=>e.event.fillAt===cs[e.event.fillIndex].ts).map(e=>[e.event.decisionIndex,e.event]));
 if(x.pendingAtEnd)actions.set(x.pendingAtEnd.decisionIndex,x.pendingAtEnd);
 let ptr=0,inv:R[]=[],ep=0,banked=0,entryAt:number|null=null,openMinutes=0,unknownMinutes=0,contextMinutes=0;
 const firsts=new Map<string,R>(),encounters=new Map<string,R>(),matrix=new Map<string,{minutes:number;episodes:Set<number>}>(),outcomes=new Map<number,R>();
 const episodeByClose=new Map(x.metrics.episodes.map((e:R)=>[Date.parse(e.close),e]));
 function decorate(z:R):R{const outcome=outcomes.get(z.episode)??null,c=cs[z.index+1];
  const mark=z.index+1<x.endIdx?{at:c.ts,price:c.open,banked:z.banked,remaining:inventoryNet(z.inventory,c.open),net:z.banked+inventoryNet(z.inventory,c.open)}:null;
  return{...z,outcome,mark,attributionDelta:outcome&&mark?mark.net-outcome.pnl:null};}
 for(let i=x.startIdx;i<x.endIdx;i++){
  const c=cs[i],at=c.endTs;
  while(events[ptr]?.event.fillIndex===i){const e=events[ptr++];assert.deepEqual(e.before,inv);
   if(e.event.kind==='open'&&!e.before.length){entryAt=e.event.fillAt;banked=0;}
   if(e.event.kind!=='open')banked+=partialNet(e.before,e.after,e.event.price);
   if(e.event.kind==='close'){const o=episodeByClose.get(e.event.fillAt) as R;assert(o);assert(Math.abs(o.pnl-banked)<1e-7);outcomes.set(e.episode,o);}
   inv=e.after;ep=e.episode;
  }
  if(!inv.length)continue;openMinutes++;
  const q=rowAt(rows,at,lag),spell=q.row?.spell??null,f=facts(inv,c.close,at,s.trendBlocked[i]),action=actions.get(i),full=action?.kind==='close';
  if(!q.healthy)unknownMinutes++;
  const z=classify(f,q.healthy,spell,c.close,full);
  const snap=()=>({index:i,at,episode:ep,entryAt,banked,inventory:inv.map(p=>({...p})),price:c.close,...f,
    sourceAt:q.row!.at,availableAt:q.row!.at+lag,zone:spell!.zone,spellId:spell!.id,failedAt:spell!.failedAt,
    context:z.context,baselineAction:action?{kind:action.kind,reason:action.reason}:null,
    trendBarEnd:Math.floor(at/(4*H))*4*H,entryDuringSpell:entryAt!>=spell!.failedAt});
  if(q.healthy&&spell){const key=`${ep}|${spell.id}`;let e=encounters.get(key);
   if(!e){e={...snap(),firstBelow:null,firstAge12:null,firstPnl:null,firstHostile:null,firstAll:null,lastObservedAt:at,minutes:0};encounters.set(key,e);}
   e.lastObservedAt=at;e.minutes++;
   for(const [k,yes] of Object.entries({firstBelow:z.context,firstAge12:f.ageOk,firstPnl:f.pnlOk,firstHostile:f.trendOk,firstAll:f.missing==='none'}))if(yes&&e[k]===null)e[k]=at;
  }
  if(!z.context)continue;contextMinutes++;
  const m=matrix.get(f.missing)??{minutes:0,episodes:new Set<number>()};m.minutes++;m.episodes.add(ep);matrix.set(f.missing,m);
  // Native hard-flatten is only behind existing TP/emergency/funding. Its age uses surviving inventory.
  if(f.missing==='none')assert(full&&['tp','stale_tp','emergency_kill','funding_spike','hard_flatten'].includes(action!.reason));
  if(action?.reason==='hard_flatten')assert.equal(f.missing,'none');
  for(const [kind,yes] of Object.entries({clock_raw:z.clockRaw,trend_raw:z.trendRaw,clock_reach:z.clockReach,trend_reach:z.trendReach})){
   const key=`${kind}|${ep}`;if(yes&&!firsts.has(key))firsts.set(key,{kind,...snap()});
  }
 }
 assert.equal(ptr,events.length);
 const first=[...firsts.values()].map(decorate),warnings=[...encounters.values()].map(decorate);
 const ms=[...matrix].map(([missing,m])=>({missing,minutes:m.minutes,episodes:[...m.episodes].sort((a,b)=>a-b)}));
 const summary=['clock_raw','trend_raw','clock_reach','trend_reach'].map(kind=>({kind,...tally(first.filter(z=>z.kind===kind))}));
 const monthly=summary.flatMap(g=>[...new Set(first.filter(z=>z.kind===g.kind).map(z=>new Date(z.at).toISOString().slice(0,7)))].sort().map(month=>({
  kind:g.kind,month,...tally(first.filter(z=>z.kind===g.kind&&new Date(z.at).toISOString().startsWith(month)))})));
 return{name:x.name,lag,openMinutes,unknownMinutes,contextMinutes,matrix:ms,first,warnings,summary,monthly,
  endingInventory:inv,endingPartial:inv.length?banked:0,baseline:x.metrics,baselineMonthly:x.accounting.monthly};
}
async function worker(plan:Plan,out:string){
 const d=plan.card.definition;validate(d);const {s,cfg,core}=await buildSeries(d);
 const json=(f:string,v:unknown)=>atomicJson(`${out}/${f}.json`,v),controls:R[]=read(`${d.archive}/output/results.json`).filter((x:R)=>x.control);
 assert.equal(controls.length,4);const source=responseTape(s.candles,buildFrames(s.candles));
 assert.deepEqual(source.rows,read(`${d.atlas}/output/rows.json`));assert.deepEqual(source.events,read(`${d.atlas}/output/events.json`));
 json('source-parity',{passed:true,rows:source.rows.length,events:source.events.length});
 const checked:R[]=[],ledgers=new Map<string,R[]>();
 for(const x of controls){const load=(k:string)=>read(`${d.archive}/output/${x.name}-${k}.json`),raw=load('engine');
  assert.equal(sha(JSON.stringify(raw)),x.digest);const c=config(cfg,POLICIES.find(p=>p.id===d.parent)!);assert.equal(sha(JSON.stringify(c)),x.configSha);
  assert(c.exits.hardFlatten&&c.exits.hardFlattenHours===12&&c.exits.hardFlattenPct===-2);
  const es:R[]=load('inventory');assert.deepEqual(auditFlowLedger(s.candles,es as any,load('attempts'),x.metrics,x.startIdx,x.endIdx),x.accounting);ledgers.set(x.name,es);
  // Check the factored predicate against the actual native function on every filled inventory transition.
  for(const e of es.filter(e=>e.after.length)){const i=e.event.fillIndex,f=facts(e.after,s.candles[i].close,s.candles[i].endTs,s.trendBlocked[i]);
   assert.equal(checkHardFlatten(e.after,s.candles[i].close,s.candles[i].endTs,s.trendBlocked[i],c).action==='flatten',f.missing==='none');}
  checked.push({name:x.name,digest:x.digest,metrics:x.metrics,accounting:x.accounting});
 }
 json('control-parity',{passed:true,rerun:false,scope:'Accepted causal engine digests, native config, and cash/inventory/monthly/DD reconstructed before diagnostic joins',controls:checked});
 const results:R[]=[];
 for(const lag of d.sourceLagMs)for(const x of controls){console.log(`[SRF01] ${x.name} / macro lag ${lag}`);
  const r=analyze(s,x,ledgers.get(x.name)!,source.rows,lag);json(`${x.name}-lag${lag}`,r);results.push(r);
 }
 json('summary',results.map(({first,warnings,matrix,endingInventory,baseline,...r})=>({...r,matrix,
  endingDepth:endingInventory.length,baseline:{...baseline,episodes:undefined}})));
 core.writeCsv(`${out}/reach-monthly.csv`,results.flatMap(x=>x.monthly.map((m:R)=>({name:x.name,lag:x.lag,...m}))));
 core.writeCsv(`${out}/baseline-monthly.csv`,controls.flatMap(x=>x.accounting.monthly.map((m:R)=>({name:x.name,...m}))));
 json('validation',{passed:true,archivedControls:4,diagnosticPaths:8,economicRuns:0,newTradingDefinitions:0,independentVerificationRequired:true,liveChanges:0});
 console.log(JSON.stringify(results.map(x=>({name:x.name,lag:x.lag,summary:x.summary}))));
}
async function main(){const [cmd,key]=process.argv.slice(2),card=read(CARD),d=card.definition;validate(d);
 if(cmd==='plan'){
  const sources:string[]=[];let protectedFiles:string[]=[];
  for(const base of [d.archive,d.atlas]){const p=read(`${base}/plan.json`),s=read(`${base}/state.json`);assert.equal(s.status,'complete');assert(read(`${base}/verification.json`).passed);
   // MA01 predates the later replay-only hooks. Its macro source/data must remain
   // identical; the unused old engine dependency is instead pinned by current SRK01.
   const usedPins=p.pins.filter((z:R)=>base!==d.atlas||z.file!=='scripts/replay-causal-engine.ts');
   await verifyPins(process.cwd(),[...usedPins,...p.protectedPins,...s.artifacts]);
   sources.push(...p.pins.map((p:R)=>p.file),...s.artifacts.map((p:R)=>p.file),`${base}/plan.json`,`${base}/verification.json`);
   protectedFiles.push(...p.protectedPins.map((p:R)=>p.file));
  }
  sources.push(CARD,'docs/research/support-flatten-reach-srf01.md',...['policy','study','verify','tests'].map(k=>`scripts/support-flatten-reach-${k}.ts`));
  console.log((await createPlan(process.cwd(),card,sources,protectedFiles)).key);
 }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
