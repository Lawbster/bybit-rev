/** SRP01 independent ledger, opportunity, predicate and unchanged-exit verification. */
import fs from 'fs';import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {POLICIES,config} from './age10-gate-policy';
import {auditFlowLedger} from './flow-response-audit';
import {auditAgeHighTargets,auditAgeHighExits,rawHighs} from './age-high-refinement-audit';
import {ReplaySrContext} from './replay-sr-context';
import {exposureDelta} from './ladder-exposure-metrics';
import {componentAttribution} from './ladder-combination-accounting';
type R=Record<string,any>;const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function summarize(es:R[]){return {n:es.length,wins:es.filter(e=>e.pnl>0).length,winning:es.reduce((n,e)=>n+Math.max(e.pnl,0),0),
 losses:es.filter(e=>e.pnl<0).length,losing:es.reduce((n,e)=>n+Math.min(e.pnl,0),0),net:es.reduce((n,e)=>n+e.pnl,0)};}
export function cohort(x:R,b:R){
 const xm=new Map(x.metrics.episodes.map((e:R)=>[e.entry,e])),bm=new Map(b.metrics.episodes.map((e:R)=>[e.entry,e]));
 const groups:R[]=[];
 for(const e of [...b.metrics.episodes.map((e:R)=>({...e,side:'baseline'})),...x.metrics.episodes.map((e:R)=>({...e,side:'variant'}))].sort((a,b)=>Date.parse(a.entry)-Date.parse(b.entry))){
  const start=Date.parse(e.entry),end=Date.parse(e.close);let g=groups.at(-1);if(!g||start>g.end){g={start,end,baseline:[],variant:[]};groups.push(g);}else g.end=Math.max(g.end,end);g[e.side].push(e);
 }
 const components=groups.map(g=>({start:new Date(g.start).toISOString(),end:new Date(g.end).toISOString(),baseline:summarize(g.baseline),variant:summarize(g.variant),delta:summarize(g.variant).net-summarize(g.baseline).net})).filter(g=>Math.abs(g.delta)>1e-6);
 near(components.reduce((n,g)=>n+g.delta,0),summarize(x.metrics.episodes).net-summarize(b.metrics.episodes).net);
 const positive=components.filter(g=>g.delta>0).sort((a,b)=>b.delta-a.delta),total=x.metrics.totalPnl-b.metrics.totalPnl;
 return {removed:summarize(b.metrics.episodes.filter((e:R)=>!xm.has(e.entry))),replacement:summarize(x.metrics.episodes.filter((e:R)=>!bm.has(e.entry))),
  components,largestPositive:positive.slice(0,5),netDeltaExcludingLargest:total-(positive[0]?.delta??0),netDeltaExcludingTwoLargest:total-positive.slice(0,2).reduce((n,g)=>n+g.delta,0),
  note:'Overlapping occupancy-component arithmetic, not reruns. Open/unfinished inventory accounted separately.'};
}
async function main(){
 const dir=jobDirectory(process.cwd(),process.argv[2]),out=`${dir}/output`,plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
 assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`));const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
 const {s,cfg}=await buildSeries(d),cs=s.candles,highs=rawHighs(cs,2),rows:R[]=read(`${out}/results.json`),comparisons:R[]=read(`${out}/comparisons.json`);
 const load=(name:string,suffix:string)=>read(`${out}/${name}-${suffix}.json`);let fills=0,minutes=0,targetsChecked=0,highChecks=0,gateChecks=0,partialChecks=0,prefixChecks=0,controls=0;
 const reviews:R[]=[],traces:R[]=[];
 for(const x of rows){console.log(`[SRP01 verify] ${x.name}`);
  const raw=load(x.name,'engine'),events:R[]=load(x.name,'inventory'),attempts:R[]=load(x.name,'attempts'),gates:R[]=load(x.name,'partial-gates');
  assert.equal(sha(JSON.stringify(raw)),x.digest);assert.deepEqual(raw.executionAudit.events,events.map(e=>e.event));
  assert.deepEqual(auditFlowLedger(cs,events as any,attempts,x.metrics,x.startIdx,x.endIdx),x.accounting);fills+=events.length;minutes+=x.endIdx-x.startIdx;
  const spec=POLICIES.find(p=>p.id===x.policy)!;assert.deepEqual(spec,x.spec);const c=config(cfg,spec);if(x.mode==='disabled')c.srPartialExitAction!.enabled=false;
  assert.equal(sha(JSON.stringify(c)),x.configSha);assert.equal(c.srShadow!.recentDays,14);
  const targets=load(x.name,'targets'),arms:R[]=[];
  targetsChecked+=auditAgeHighTargets(cs,events as any,targets,load(x.name,'tp-observations'),{...x,control:!spec.ageHours,policy:{id:'baseline',family:'age'},sensitivity:{sourceLagMs:0,releaseDelayMs:0}},{},c,{},t=>arms.push(t)).checks;
  assert.equal(arms.length,targets.length);arms.forEach((a,i)=>{assert.equal(a.armedAt,targets[i].armedAt);near(a.targetPrice,targets[i].targetPrice);});
  if(spec.days)highChecks+=auditAgeHighExits(cs,events,{...x,lag:0},load(x.name,'high-reductions'),highs);
  const gateMap=new Map(gates.map(g=>[g.index,g]));assert.equal(gateMap.size,gates.length);
  const partials=events.filter(e=>e.event.reason==='sr_partial'),partMap=new Map(partials.map(e=>[e.event.decisionIndex,e]));
  if(x.pendingAtEnd?.reason==='sr_partial')partMap.set(x.pendingAtEnd.decisionIndex,{pending:true,intent:x.pendingAtEnd});
  const ordinary=new Set(events.filter(e=>e.event.kind==='close'&&!e.event.reason.startsWith('research_exit:')&&e.event.fillAt===cs[e.event.fillIndex].ts).map(e=>e.event.decisionIndex));
  if(x.pendingAtEnd?.kind==='close'&&!x.pendingAtEnd.reason.startsWith('research_exit:'))ordinary.add(x.pendingAtEnd.decisionIndex);
  const sr=new ReplaySrContext(cs,c.srShadow!);let ptr=0,inv:R[]=[],cooldown=0,eligible=0,fireCount=0,prefix=0;
  for(let i=x.startIdx;i<x.endIdx;i++){
   while(ptr<events.length&&events[ptr].event.fillIndex<=i){const e=events[ptr++];inv=e.after;if(e.event.reason==='sr_partial')cooldown=e.event.decisionAt+3600000;}
   const at=cs[i].endTs;if(inv.length<6||at<cooldown||ordinary.has(i))continue;
   const qty=inv.reduce((n,p)=>n+p.qty,0),avg=inv.reduce((n,p)=>n+p.notional,0)/qty,pct=(cs[i].close/avg-1)*100;
   if(pct<.25)continue;
   const boundary=Math.floor(at/1800000)*1800000,ct=sr.at(boundary);if(!ct.coverage.healthy)continue;
   const hit=ct.engine.nearestResistance(at,cs[i].close);if(!hit||hit.dist*100>.3)continue;
   const selected=inv.map((p,j)=>({p,j,profit:(cs[i].close-p.entryPrice)*p.qty})).sort((a,b)=>b.profit-a.profit).slice(0,inv.length-3);
   const planNet=selected.reduce((n,z)=>n+z.profit-.00055*(z.p.notional+z.p.qty*cs[i].close),0);if(planNet<=0)continue;
   if(x.mode==='disabled'){assert(!partMap.has(i));continue;}eligible++;
   const sourceAt=at-x.lag,j=i-x.lag/60000;assert.equal(cs[j].endTs,sourceAt);const snap=s.marketInputs!.snapshot(sourceAt),p=snap.pulse;
   const pulse={oiBy4hPct:p.oiBy4hPct,oiBn4hPct:p.oiBn4hPct,oiHl4hPct:p.oiHl4hPct,taker4h:p.taker4h,
    fdByNow:p.fdByNow??s.bybitFunding[j],fdBnNow:p.fdBnNow,fdHlNow:p.fdHlNow,btc4hMovePct:s.btcRet4h?.[j]??null};
   const oi=[pulse.oiBy4hPct,pulse.oiBn4hPct,pulse.oiHl4hPct].filter((z):z is number=>z!==null),mean=oi.length?oi.reduce((a,b)=>a+b,0)/oi.length:null;
   const negative=[pulse.fdByNow,pulse.fdBnNow,pulse.fdHlNow].some(z=>z!==null&&z<0);
   const hostile=(mean!==null&&mean<0)||(pulse.taker4h!==null&&pulse.taker4h<1)||negative;
   const deteriorating=(mean!==null&&mean<=-.25)||(pulse.taker4h!==null&&pulse.taker4h<=.98)||(pulse.btc4hMovePct!==null&&pulse.btc4hMovePct<=-.25)||negative&&((mean!==null&&mean<=0)||(pulse.taker4h!==null&&pulse.taker4h<=1.05));
   const fire=x.mode==='pulse_free'||(x.mode==='current'?deteriorating:hostile),g=gateMap.get(i);assert(g,`Missing eligible minute ${x.name}/${i}`);
   assert.equal(g.at,at);assert.equal(g.sourceAt,sourceAt);assert.equal(g.depth,inv.length);near(g.price,cs[i].close);near(g.pnlPct,pct);near(g.planNet,planNet);
   assert.deepEqual(g.pulse,pulse);assert.equal(g.predicates.hostile,hostile);assert.equal(g.predicates.deteriorating,deteriorating);assert(g.baseCandidate&&g.nonPulseEligible);
   near(g.resistancePrice,hit.lv.price);near(g.resistanceDistPct,hit.dist*100);assert.equal(g.fire,fire);assert.equal(partMap.has(i),fire);
   assert.deepEqual(g.closeIds,selected.map(z=>z.p.id));for(const t of hit.lv.touchData)assert(t.ts<=boundary&&t.ts>=boundary-14*86400000);
   if(fire){const e=partMap.get(i)!;if(!e.pending){assert.deepEqual(inv.filter(p=>!e.after.some((a:R)=>a.id===p.id)).map(p=>p.id).sort(),g.closeIds.slice().sort());partialChecks++;}fireCount++;}
   if(prefix<2){const pre=new ReplaySrContext(cs.filter(z=>z.endTs<=boundary),c.srShadow!).at(boundary);assert.deepEqual(pre.engine.getZones(boundary),ct.engine.getZones(boundary));prefix++;prefixChecks++;}
   if(traces.filter(t=>t.name===x.name).length<2)traces.push({name:x.name,at:new Date(at).toISOString(),sourceAt:new Date(sourceAt).toISOString(),price:cs[i].close,depth:inv.length,
    resistance:hit.lv.price,touches:hit.lv.touchData,pct,planNet,pulse,hostile,deteriorating,fire,fill:partMap.get(i)?.event??null});gateChecks++;
  }
  assert.equal(eligible,gates.length);assert.equal(fireCount,partMap.size);if(x.mode==='disabled')assert.equal(partials.length,0);
  if(x.control){const old=read(`${d.archive}/output/results.json`).find((r:R)=>r.name===x.name);assert.equal(old.digest,x.digest);assert.deepEqual(old.metrics,x.metrics);controls++;}
  else{const b=rows.find(r=>r.control&&r.policy===d.parent&&r.window===x.window&&r.tp===x.tp)!,comparison=comparisons.find(r=>r.name===x.name)!;
   assert.deepEqual(exposureDelta(x.metrics,b.metrics),comparison.delta);assert.deepEqual(componentAttribution(x.metrics,b.metrics),comparison.attribution);
   const changed=x.mode==='disabled'?b.counts.firedEpisodes:new Set(gates.filter(g=>g.fire!==g.requiredCandidate).map(g=>g.episode)).size;
   reviews.push({name:x.name,changedEpisodes:changed,...cohort(x,b)});
  }
 }
 assert.equal(rows.length,24);assert.equal(controls,8);
 const qualification=d.variants.map((v:string)=>{const failures:string[]=[];
  for(const x of rows.filter(x=>x.mode===v&&!x.lag)){const q=comparisons.find(r=>r.name===x.name)!.delta,scr=d.screen,review=reviews.find(r=>r.name===x.name)!;
   if(q.pnlDelta<(x.window==='recent'?scr.minimumRecentNetDelta:scr.minimumPublishedNetDelta))failures.push(`${x.name}:net`);
   if(q.worstMonthDelta<scr.minimumMonthlyDelta)failures.push(`${x.name}:monthly`);if(q.ddReductionPp<-scr.maximumDrawdownIncreasePp-1e-9)failures.push(`${x.name}:drawdown`);
   if(x.window==='recent'&&review.changedEpisodes<scr.minimumChangedEpisodes)failures.push(`${x.name}:thin_changed_cohort`);if(x.accounting.firstNonpositive)failures.push(`${x.name}:nonpositive_equity`);
  }
  for(const tp of d.tpModels){const b=rows.find(x=>x.mode==='current'&&x.window==='recent'&&x.tp===tp&&x.lag===60000)!,x=rows.find(x=>x.mode===v&&x.window==='recent'&&x.tp===tp&&x.lag===(v==='hostile'?60000:0))!,q=exposureDelta(x.metrics,b.metrics);
   if(q.pnlDelta<d.screen.minimumLaggedNetDelta)failures.push(`${tp}:pulse60_net`);
   if(q.worstMonthDelta<d.screen.minimumMonthlyDelta)failures.push(`${tp}:pulse60_monthly`);if(q.ddReductionPp<-1e-9)failures.push(`${tp}:pulse60_drawdown`);
  }
  return{id:v,passesScreen:!failures.length,failures,deployable:false};
 });
 await verifyPins(process.cwd(),pins);atomicJson(`${dir}/review.json`,{qualification,reviews,traces});
 const receipt={passed:true,runs:24,exactControls:controls,fills,minutes,targetsChecked,highChecks,gateChecks,partialChecks,prefixChecks,
  reviewSha:sha(fs.readFileSync(`${dir}/review.json`)),checkerSha:sha(fs.readFileSync(__filename)),liveChanges:0};atomicJson(`${dir}/verification.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
