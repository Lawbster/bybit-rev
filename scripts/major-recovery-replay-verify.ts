/** MS02 independent entry, inventory, cashflow and unchanged-exit review. */
import fs from 'fs';import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {POLICIES,config} from './age10-gate-policy';
import {auditFlowLedger} from './flow-response-audit';
import {auditAgeHighTargets,auditAgeHighExits,rawHighs} from './age-high-refinement-audit';
import {exposureDelta} from './ladder-exposure-metrics';
import {componentAttribution} from './ladder-combination-accounting';
import {ReplaySrContext} from './replay-sr-context';
import {evaluateSRShadowCandidates} from '../src/bot/sr-shadow';
type R=Record<string,any>;const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8')),H=3600000;
// Does not use the producer's rowAt/context functions.
function context(rows:R[],at:number,lag:number,variant:string){let a=0,b=rows.length;while(a<b){const m=Math.floor((a+b)/2);if(rows[m].at<=at-lag)a=m+1;else b=m;}
 const r=rows[a-1],s=r?.spell,healthy=!!r?.healthy&&r.barEnd===Math.floor((at-lag)/H)*H;
 return{healthy,blocked:!healthy||!!s&&(variant==='accepted_base'||s.failedRetestAt!==null),frameAt:r?.at??null,blockId:s?.id??null,zoneId:s?.zone.id??null,failedAt:s?.failedAt??null,retestAt:s?.failedRetestAt??null};}
function cohort(x:R,b:R,events:R[],tape:R[]){
 const sum=(es:R[])=>({count:es.length,wins:es.filter(e=>e.pnl>0).length,winning:es.reduce((n,e)=>n+Math.max(0,e.pnl),0),losses:es.filter(e=>e.pnl<0).length,losing:es.reduce((n,e)=>n+Math.min(0,e.pnl),0),net:es.reduce((n,e)=>n+e.pnl,0)});
 const xe=new Set(x.metrics.episodes.map((e:R)=>e.entry)),be=new Set(b.metrics.episodes.map((e:R)=>e.entry));
 const removed=b.metrics.episodes.filter((e:R)=>!xe.has(e.entry)),replacement=x.metrics.episodes.filter((e:R)=>!be.has(e.entry));
 const first=new Map(events.filter(e=>e.event.kind==='open'&&!e.before.length).map(e=>[new Date(e.event.fillAt).toISOString(),e.event.decisionAt]));
 const direct=removed.filter((e:R)=>{const at=first.get(e.entry);assert(at!==undefined);return context(tape,at,x.lag,x.variant).blocked;});
 const all=[...b.metrics.episodes.map((e:R)=>({...e,side:'baseline'})),...x.metrics.episodes.map((e:R)=>({...e,side:'variant'}))].sort((a,b)=>Date.parse(a.entry)-Date.parse(b.entry)),groups:R[]=[];
 for(const e of all){const start=Date.parse(e.entry),end=Date.parse(e.close);let g=groups.at(-1);if(!g||start>g.end){g={start,end,baseline:[],variant:[]};groups.push(g);}else g.end=Math.max(g.end,end);g[e.side].push(e);}
 const components=groups.map(g=>({start:new Date(g.start).toISOString(),end:new Date(g.end).toISOString(),baseline:sum(g.baseline),variant:sum(g.variant),delta:sum(g.variant).net-sum(g.baseline).net})).filter(g=>Math.abs(g.delta)>1e-6);
 const total=x.metrics.totalPnl-b.metrics.totalPnl,positive=components.filter(g=>g.delta>0).sort((a,b)=>b.delta-a.delta);
 assert(Math.abs(components.reduce((n,g)=>n+g.delta,0)-(sum(x.metrics.episodes).net-sum(b.metrics.episodes).net))<1e-6);
 return{removed:sum(removed),replacement:sum(replacement),directlyBlockedRemoved:sum(direct),components,largestPositive:positive.slice(0,5),
  netDeltaExcludingLargest:total-(positive[0]?.delta??0),netDeltaExcludingTwoLargest:total-positive.slice(0,2).reduce((n,g)=>n+g.delta,0),note:'Concentration arithmetic, not a rerun; ending inventory separate.'};
}
async function main(){
 const dir=jobDirectory(process.cwd(),process.argv[2]),out=`${dir}/output`,plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
 assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`));const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
 assert(read(`${d.atlas}/verification.json`).passed);const tape:R[]=read(`${d.atlas}/output/rows.json`);
 const {s,cfg}=await buildSeries(d),cs=s.candles,highs=rawHighs(cs,2),rows:R[]=read(`${out}/results.json`),comparisons:R[]=read(`${out}/comparisons.json`);
 const load=(name:string,suffix:string)=>read(`${out}/${name}-${suffix}.json`);let fills=0,minutes=0,entries=0,targetsChecked=0,highChecks=0,partialsChecked=0,controls=0;const reviews:R[]=[];
 for(const x of rows){console.log(`[MS02 verify] ${x.name}`);const raw=load(x.name,'engine'),events:R[]=load(x.name,'inventory'),attempts:R[]=load(x.name,'attempts'),checks:R[]=load(x.name,'entry-checks');
  assert.equal(sha(JSON.stringify(raw)),x.digest);assert.deepEqual(raw.executionAudit.events,events.map(e=>e.event));assert.deepEqual(auditFlowLedger(cs,events as any,attempts,x.metrics,x.startIdx,x.endIdx),x.accounting);fills+=events.length;minutes+=x.endIdx-x.startIdx;
  const spec=POLICIES.find(p=>p.id===x.policy)!;assert.deepEqual(spec,x.spec);const c=config(cfg,spec);assert.equal(c.srShadow!.recentDays,14);assert.equal(sha(JSON.stringify(c)),x.configSha);
  const am=new Map(attempts.map(a=>[a.index,a])),opens=new Map(events.filter(e=>e.event.kind==='open').map(e=>[e.event.decisionIndex,e]));let ptr=0,inv:R[]=[],veto=0;const ids=new Set<string>();assert.equal(new Set(checks.map(q=>q.index)).size,checks.length);
  for(const q of checks){while(ptr<events.length&&events[ptr].event.fillIndex<=q.index)inv=events[ptr++].after;
   assert.equal(q.at,cs[q.index].endTs);assert.equal(q.price,cs[q.index].close);assert.equal(q.nextDepth,inv.length+1);
   const expected=x.variant&&q.nextDepth===1?context(tape,q.at,x.lag,x.variant):null,fire=expected!==null&&expected.blocked;
   assert.deepEqual(q.context,expected);assert.equal(q.fire,fire);if(q.nextDepth>1)assert(!q.fire);
   if(fire){assert.equal(inv.length,0);assert(!am.has(q.index)&&!opens.has(q.index));veto++;if(expected!.blockId)ids.add(expected!.blockId);}
   else{assert(am.has(q.index));if(q.index+1<x.endIdx)assert(opens.has(q.index));}entries++;
  }
  assert.equal(veto,x.counts.vetoMinutes);assert.deepEqual([...ids],x.counts.failureIds);
  const allowed=new Set(checks.filter(q=>!q.fire).map(q=>q.index));for(const a of attempts)assert(allowed.has(a.index));
  ptr=0;inv=[];let flat=0,blocked=0,unknown=0;for(let i=x.startIdx;i<x.endIdx;i++){while(ptr<events.length&&events[ptr].event.fillIndex<=i)inv=events[ptr++].after;if(!inv.length){flat++;if(x.variant){const q=context(tape,cs[i].endTs,x.lag,x.variant);if(q.blocked)blocked++;if(!q.healthy)unknown++;}}}
  assert.equal(flat,x.counts.flatMinutes);assert.equal(blocked,x.counts.blockedFlatMinutes);assert.equal(unknown,x.counts.unknownFlatMinutes);
  const targets=load(x.name,'targets'),arms:R[]=[];targetsChecked+=auditAgeHighTargets(cs,events as any,targets,load(x.name,'tp-observations'),{...x,control:!spec.ageHours,policy:{id:'baseline',family:'age'},sensitivity:{sourceLagMs:0,releaseDelayMs:0}},{},c,{},t=>arms.push(t)).checks;
  assert.equal(arms.length,targets.length);arms.forEach((a,i)=>{assert.equal(a.armedAt,targets[i].armedAt);assert(Math.abs(a.targetPrice-targets[i].targetPrice)<1e-6);});
  if(spec.days)highChecks+=auditAgeHighExits(cs,events,{...x,lag:0},load(x.name,'high-reductions'),highs);
  const sr=new ReplaySrContext(cs,c.srShadow!);let cooldown=0;for(const e of events.filter(e=>e.event.reason==='sr_partial')){
   const at=e.event.decisionAt,i=e.event.decisionIndex,boundary=Math.floor(at/1800000)*1800000,ct=sr.at(boundary);assert(ct.coverage.healthy&&at>=cooldown);cooldown=at+c.srPartialExitAction!.cooldownMin*60000;
   const pulse=s.marketInputs!.snapshot(at).pulse;pulse.fdByNow=pulse.fdByNow??s.bybitFunding[i];pulse.btc4hMovePct=s.btcRet4h?.[i]??null;
   const decision=evaluateSRShadowCandidates({symbol:c.symbol,nowMs:at,price:cs[i].close,positions:e.before,pulse,config:c,zoneEngine:ct.engine,contextCoverage:ct.coverage,contextCoverageHorizonDays:14,
     addContext:{canAddTiming:false,timeGateOk:false,priceDropOk:false,atOldCap:false,tpPct:1.4}});
   assert(decision?.firedCandidates.includes(c.srPartialExitAction!.requiredCandidate));const p=decision!.partialExitPlan;assert(p&&p.estimatedNetPnl>0);
   assert.deepEqual(p.closeIndices.map(j=>e.before[j].id).sort(),e.before.filter((q:R)=>!e.after.some((a:R)=>a.id===q.id)).map((q:R)=>q.id).sort());partialsChecked++;
  }
  if(x.control){const old=read(`${d.archive}/output/results.json`).find((r:R)=>r.name===x.name);assert.equal(old.digest,x.digest);assert.deepEqual(old.metrics,x.metrics);controls++;}
  else{const b=rows.find(r=>r.control&&r.policy===d.parent&&r.window===x.window&&r.tp===x.tp)!,comparison=comparisons.find(r=>r.name===x.name)!;
    assert.deepEqual(exposureDelta(x.metrics,b.metrics),comparison.delta);assert.deepEqual(componentAttribution(x.metrics,b.metrics),comparison.attribution);reviews.push({name:x.name,...cohort(x,b,load(b.name,'inventory'),tape)});}
 }
 assert.equal(rows.length,20);assert.equal(controls,8);
 const qualification=d.variants.map((v:string)=>{const failures:string[]=[];for(const x of rows.filter(x=>x.variant===v)){const q=comparisons.find(r=>r.name===x.name)!.delta,scr=d.screen;
  if(q.pnlDelta<(x.lag?scr.minimumLaggedNetDelta:x.window==='recent'?scr.minimumRecentNetDelta:scr.minimumPublishedNetDelta))failures.push(`${x.name}:net`);
  if(q.worstMonthDelta<scr.minimumMonthlyDelta)failures.push(`${x.name}:monthly`);if(q.ddReductionPp<-scr.maximumDrawdownIncreasePp-1e-9)failures.push(`${x.name}:drawdown`);
  if(x.window==='recent'&&!x.lag&&x.counts.affectedFailureEvents<scr.minimumAffectedFailureEvents)failures.push(`${x.name}:thin_failure_sample`);if(x.accounting.firstNonpositive)failures.push(`${x.name}:nonpositive_equity`);
 }return{id:v,passesScreen:!failures.length,failures,deployable:false};});
 await verifyPins(process.cwd(),pins);atomicJson(`${dir}/review.json`,{qualification,reviews});const receipt={passed:true,runs:20,exactControls:controls,fills,minutes,entries,targetsChecked,highChecks,partialsChecked,
  atlasVerificationSha:sha(fs.readFileSync(`${d.atlas}/verification.json`)),reviewSha:sha(fs.readFileSync(`${dir}/review.json`)),checkerSha:sha(fs.readFileSync(__filename)),liveChanges:0};atomicJson(`${dir}/verification.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
