/** SM01 independent ledger/decision chronology reconstruction. Does not run the
 * replay engine or import ShadeController/SoftStaleController. Shared frozen live
 * exit/partial predicates and zone geometry are deliberately retained. */
import './sr-multimap-bootstrap';
import fs from 'fs';import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {POLICIES,config} from './age10-gate-policy';
import {auditFlowLedger} from './flow-response-audit';
import {rawHighs} from './age-high-refinement-audit';
import {ReplaySrContext} from './replay-sr-context';
import {LocalTape,MacroTape,MultiContext,MEMBERS} from './sr-multimap-policy';
import {checkEmergencyKill,checkFundingSpike,checkHardFlatten} from '../src/bot/strategy';
import {evaluateSRShadowCandidates,canExecuteSRPartialAction} from '../src/bot/sr-shadow';
import {exposureDelta} from './ladder-exposure-metrics';
import {componentAttribution} from './ladder-combination-accounting';
import {cohort} from './sr-partial-audit-review';
type R=Record<string,any>;const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
// Independent maximum-cardinality spacing via dynamic programming, not selector's greedy walk.
function separated(ts:number[]){const a=ts.slice().sort((x,y)=>x-y),dp:number[]=[];let best=0;
 for(let i=0;i<a.length;i++){dp[i]=1;for(let j=0;j<i;j++)if(a[i]-a[j]>=21600000)dp[i]=Math.max(dp[i],dp[j]+1);best=Math.max(best,dp[i]);}return best;}
async function main(){
 const dir=jobDirectory(process.cwd(),process.argv[2]),out=`${dir}/output`,plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
 assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`),'Do not overwrite accepted verification');
 const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
 const {s,cfg}=await buildSeries(d),cs=s.candles,highs=rawHighs(cs,2),rows:R[]=read(`${out}/results.json`),comparisons:R[]=read(`${out}/comparisons.json`);
 const local=await LocalTape.load(`${out}/local14d-cache.jsonl`),macro={major4h:new MacroTape('major4h',d.macro4h),major1d:new MacroTape('major1d',d.macro1d)};
 const reference=new ReplaySrContext(cs,cfg.srShadow!);let cacheChecks=0;
 for(const f of local.frames){assert.deepEqual(f.levels,reference.at(f.at).engine.getZones(f.at));cacheChecks++;}
 for(const [at,f] of local.seeds){assert.deepEqual(f.levels,new ReplaySrContext(cs,cfg.srShadow!).at(at).engine.getZones(at));cacheChecks++;}
 const load=(name:string,kind:string)=>read(`${out}/${name}-${kind}.json`);
 const totals={runs:0,controls:0,minutes:0,fills:0,tpFills:0,targetTransitions:0,selected:0,partialChecks:0,highChecks:0,prefixChecks:0},reviews:R[]=[],traces:R[]=[];
 // Truncate the source itself: full-series cache must equal a replay with no
 // future candles present, including off-boundary initial rebuilds.
 for(const stamp of ['2025-07-01T00:00:00Z','2026-05-17T20:43:00Z','2026-06-05T12:00:00Z','2026-09-09T12:00:00Z','2026-09-15T20:00:00Z']){
  const at=Date.parse(stamp),prefix=cs.filter(c=>c.endTs<=at),initial=at%1800000!==0;
  const full=new ReplaySrContext(cs,cfg.srShadow!),truncated=new ReplaySrContext(prefix,cfg.srShadow!);
  if(!initial){for(let t=at-3600000;t<at;t+=1800000){full.at(t);truncated.at(t);}}
  const f=full.at(at),p=truncated.at(at);assert.deepEqual(p.engine.getZones(at),f.engine.getZones(at));assert.deepEqual(p.coverage,f.coverage);
  assert.deepEqual(local.at(at,at).levels,p.engine.getZones(at));totals.prefixChecks++;
 }
 for(const x of rows){console.log(`[SM01 verify] ${x.name}`);const shading=x.strategy==='partial_buffer';
  const raw=load(x.name,'engine'),events:R[]=load(x.name,'inventory'),attempts:R[]=load(x.name,'attempts'),targets:R[]=load(x.name,'targets'),selections:R[]=load(x.name,'selections');
  assert.equal(sha(JSON.stringify(raw)),x.digest);assert.deepEqual(raw.executionAudit.events,events.map(e=>e.event));
  assert.deepEqual(auditFlowLedger(cs,events as any,attempts,x.metrics,x.startIdx,x.endIdx),x.accounting);
  const spec=POLICIES.find(p=>p.id===x.policy)!;assert.deepEqual(spec,x.spec);const c=config(cfg,spec);if(x.strategy==='none')c.srPartialExitAction!.enabled=false;assert.equal(sha(JSON.stringify(c)),x.configSha);
  assert.equal(c.srShadow!.recentDays,14);
  const sr=new MultiContext(x.set,x.lag,cs[x.startIdx].endTs,c.srShadow!,local,macro);
  const action=new Map<number,R>();for(const e of events)if(e.event.fillAt===cs[e.event.fillIndex].ts){assert(!action.has(e.event.decisionIndex));action.set(e.event.decisionIndex,e.event);}
  if(x.pendingAtEnd)action.set(x.pendingAtEnd.decisionIndex,x.pendingAtEnd);
  const partialGates:R[]=load(x.name,'partial-gates'),gateMap=new Map(partialGates.map(g=>[g.index,g]));let seenGates=0;
  const permits=new Map(attempts.map(a=>[a.index,a])),chosen=new Map(selections.map(t=>[t.index,t]));assert.equal(chosen.size,selections.length);
  const highRows:R[]=load(x.name,'high-reductions'),hm=new Map<number,any>(highRows.map(r=>[r[0],r]));
  const expectedTargets:R[]=[],transitions:R[]=[];
  const ageCounts={checks:0,eligibleChecks:0,deferredChecks:0,unknownChecks:0};
  const counts={checks:0,selected:0,immediate:0};
  let ptr=0,inv:any[]=[],ep=0,stateEp=-1,phase:'unseen'|'extending'|'released'='unseen',active:R|null=null,held:R|null=null,srCooldown=0,prefix=0,cooldown=0;
  function logTarget(t:R){const p=expectedTargets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.episode!==t.episode||p.targetPrice!==t.targetPrice||p.pct!==t.pct)expectedTargets.push(t);}
  for(let i=x.startIdx;i<x.endIdx;i++){
   const bar=cs[i],at=bar.endTs,ct=sr.at(at);let closed=false;
   while(events[ptr]?.event.fillIndex===i){const z=events[ptr++],e=z.event;
    if(e.fillAt===at){assert.equal(x.tp,'resting_touch');assert(active&&active.armedIndex<i&&active.armedAt<=bar.ts);near(e.price,active.targetPrice);assert.equal(e.decisionIndex,active.armedIndex);assert.equal(e.reason,active.pct<1.4?'stale_tp':'tp');totals.tpFills++;}
    if(e.kind==='open')assert(e.decisionAt>=cooldown);
    if(e.kind==='close'){
     closed=true;if(!['tp','stale_tp'].includes(e.reason))cooldown=(Math.floor(e.fillAt/14400000)+2)*14400000;
     else if(c.tpCooldown?.enabled&&s.rsi1H[e.fillAt===bar.ts?e.decisionIndex:i-1]!>c.tpCooldown.rsi1hThreshold)cooldown=e.fillAt+c.tpCooldown.cooldownMin*60000;
    }
    if(e.reason==='sr_partial')srCooldown=e.decisionAt+c.srPartialExitAction!.cooldownMin*60000;
    inv=z.after;ep=z.episode;active=null;held=null;
   }
   if(inv.length&&active&&x.tp==='resting_touch'&&active.armedIndex<i&&bar.high>=active.targetPrice)assert.fail(`Missing resting TP ${x.name}/${i}`);
   const actual=action.get(i),permit=permits.get(i);let expectedReason:string|null=null,expectedKind:string|null=null;
   const pulse=s.marketInputs!.snapshot(at).pulse;pulse.fdByNow=pulse.fdByNow??s.bybitFunding[i];pulse.btc4hMovePct=s.btcRet4h?.[i]??null;
   if(inv.length){
    if(active&&bar.close>=active.targetPrice)expectedReason=active.pct<1.4?'stale_tp':'tp';
    else if(checkEmergencyKill(inv,bar.close,c).action==='flatten')expectedReason='emergency_kill';
    else if(checkFundingSpike(inv,pulse.fdByNow,c).action==='flatten')expectedReason='funding_spike';
    else if(checkHardFlatten(inv,bar.close,at,s.trendBlocked[i],c).action==='flatten')expectedReason='hard_flatten';
    if(expectedReason)expectedKind='close';
    if(!expectedReason){
     const qty=inv.reduce((n,p)=>n+p.qty,0),avg=inv.reduce((n,p)=>n+p.entryPrice*p.qty,0)/qty,costAvg=inv.reduce((n,p)=>n+p.notional,0)/qty;
     const oldest=Math.min(...inv.map(p=>p.entryTime)),age=(at-oldest)/3600000;
     const eligible=c.exits.softStale&&age>=c.exits.staleHours&&(bar.close-avg)/avg*100<c.exits.reducedTpPct;
     const base=eligible?c.exits.reducedTpPct:c.tpPct;let defer=false;
     if(spec.ageHours){
      ageCounts.checks++;if(eligible)ageCounts.eligibleChecks++;if(stateEp!==ep){stateEp=ep;phase='unseen';}
      if(phase!=='released'&&(phase==='extending'||eligible)){
       if(age<spec.ageHours){if(phase==='unseen'){transitions.push({status:'extended',at,episode:ep});phase='extending';}defer=true;}
       else{transitions.push({status:phase==='unseen'?'refused':'release_requested',at,episode:ep,...(phase==='extending'?{releaseAt:at}:{})});phase='released';}
      }
      if(defer)ageCounts.deferredChecks++;
     }
     const pct=defer?c.tpPct:base;if(held&&held.pct!==pct)held=null;
     const price=(held as R|null)?.price??avg*(1+pct/100);
     if(!active||active.targetPrice!==price||active.pct!==pct)active={targetPrice:price,pct,armedAt:at,armedIndex:i};
     const t={at,index:i,episode:ep,depth:inv.length,price:bar.close,qty,avgEntry:costAvg,oldestEntryTime:oldest,basePct:base,normalPct:c.tpPct,normalTarget:avg*(1+c.tpPct/100),pct,...active};
     logTarget(t);
     if(at>=srCooldown&&c.srPartialExitAction!.enabled){
      const q=evaluateSRShadowCandidates({symbol:c.symbol,nowMs:at,price:bar.close,positions:inv,pulse,config:c,zoneEngine:ct.engine,contextCoverage:ct.coverage,contextCoverageHorizonDays:14,
       addContext:{canAddTiming:false,timeGateOk:false,priceDropOk:false,atOldCap:false,tpPct:pct}}),p=q?.partialExitPlan,r=q?.levels.nearestResistance,a=c.srPartialExitAction!;
      const nonPulse=!!p&&!!r&&q!.firedCandidates.includes('zone30_partial_exit_resistance_deep6_profit_shadow')&&ct.coverage.healthy&&inv.length>=a.minDepth&&inv.length>a.keepRungs&&q!.ladder.pnlPct!==null&&q!.ladder.pnlPct>=a.minLadderPnlPct&&(!a.requirePlanProfit||p.estimatedNetPnl>0)&&r.distPct<=a.resistanceBufferPct&&p.keepRungs===a.keepRungs;
      if(nonPulse){const g=gateMap.get(i);assert(g);const hit=ct.engine.nearestResistance(at,bar.close)!.lv as R;seenGates++;
        assert.equal(g.source,hit.source);assert.equal(g.zoneId,hit.zoneId);assert.equal(g.sourceAt,at-x.lag);assert.equal(g.levelSourceAt,hit.sourceAt);assert(g.levelSourceAt<=g.sourceAt);
        assert.equal(g.fire,q!.firedCandidates.includes(a.requiredCandidate));assert.deepEqual([...g.closeIds].sort(),p!.closeIndices.map(j=>inv[j].id).sort());}
      if(p&&r&&canExecuteSRPartialAction({contextHealthy:ct.coverage.healthy,hasDecision:!!q,hasRequiredCandidate:q!.firedCandidates.includes(a.requiredCandidate),hasPlan:true,hasResistance:true,
       depthOk:inv.length>=a.minDepth,remainingDepthOk:inv.length>a.keepRungs,ladderPnlOk:q!.ladder.pnlPct!==null&&q!.ladder.pnlPct>=a.minLadderPnlPct,planProfitOk:!a.requirePlanProfit||p.estimatedNetPnl>0,resistanceOk:r.distPct<=a.resistanceBufferPct,keepOk:p.keepRungs===a.keepRungs})){
       expectedReason='sr_partial';expectedKind='partial';const e=events.find(e=>e.event.decisionIndex===i&&e.event.kind==='partial');
       if(e)assert.deepEqual(inv.filter(v=>!e.after.some((w:R)=>w.id===v.id)).map(v=>v.id).sort(),p.closeIndices.map(j=>inv[j].id).sort());totals.partialChecks++;
      }
     }
    }
   }
   if(spec.days&&inv.length){const row=hm.get(i);assert(row);const can:boolean=!expectedReason&&!closed,age=at-Math.min(...inv.map(p=>p.entryTime));
    const fire:boolean=can&&age>=spec.exitAgeHours*3600000&&highs[i]>0&&Math.max(0,100*(1-bar.close/highs[i]))<=spec.proximityPct+1e-10;
    assert.deepEqual(row,[i,ep,inv.length,can,fire]);if(fire){expectedReason=`research_exit:exit_${spec.days}d_${spec.proximityPct}pct`;expectedKind='close';}totals.highChecks++;
   }else assert(!hm.has(i));
   if(permit){assert(!expectedReason&&!closed);expectedReason=permit.priceDropOk?'price_drop':'time_add';expectedKind='open';}
   let expectedSelection:R|null=null;
   if(shading&&inv.length&&active&&!closed&&!expectedReason&&!held&&active.pct===1.4){
    counts.checks++;const qty=inv.reduce((n,p)=>n+p.qty,0),avg=inv.reduce((n,p)=>n+p.notional,0)/qty,normal=inv.reduce((n,p)=>n+p.entryPrice*p.qty,0)/qty*1.014;
    // Independent action composition: nearest per source first, then band/spacing;
    // never search a farther level within a source and never pool touches.
    const candidates=MEMBERS[x.set as keyof typeof MEMBERS].map(source=>{
      const levels=sr.levels.filter(l=>l.source===source&&(l.role==='relative'||l.role==='resistance')&&l.price>bar.close&&(l.price-bar.close)/bar.close<=c.srShadow!.bufferPct/100).sort((a,b)=>a.price-b.price);
      return levels[0];
    }).filter(l=>l&&l.price>=avg*1.01&&l.price<normal&&separated(l.touchData.map(t=>t.ts))>=3).sort((a,b)=>a.price-b.price);
    const hit=candidates[0];
    if(hit){const resistance=hit.price,touches=hit.touchData,price=Math.max(avg*1.01,resistance*.997),immediate=price<=bar.close,z=chosen.get(i);assert(z,`Missing selection ${x.name}/${i}`);
     assert.equal(z.index,i);assert.equal(z.at,at);assert.equal(z.episode,ep);assert.equal(z.depth,inv.length);near(z.avgEntry,avg);near(z.qty,qty);near(z.normalTarget,normal);near(z.selectedPrice,price);assert.equal(z.immediate,immediate);
     assert.equal(z.resistance,resistance);assert.deepEqual(z.touches,touches);assert.equal(z.sourceAt,at-x.lag);assert.equal(z.source,hit.source);assert.equal(z.zoneId,hit.zoneId);assert.equal(z.levelSourceAt,hit.sourceAt);
     assert.deepEqual(z.qualifyingSources,candidates.map(l=>l.source));assert.equal(z.spaced.length,separated(touches.map(t=>t.ts)));for(const t of touches)assert(t.ts<=at-x.lag);
     counts.selected++;if(immediate)counts.immediate++;held={price,pct:1.4};active={targetPrice:price,pct:1.4,armedAt:at,armedIndex:i};
     logTarget({...expectedTargets.at(-1),...z,targetPrice:price,armedAt:at,armedIndex:i});expectedSelection=z;
     if(immediate){expectedReason='tp';expectedKind='close';}
     if(traces.filter(v=>v.name===x.name).length<2)traces.push({name:x.name,at:new Date(at).toISOString(),...z,fill:events.find(e=>e.event.decisionIndex===i&&e.event.kind==='close')?.event??null});
    }
   }
   assert.equal(chosen.has(i),!!expectedSelection,`Unexpected selection ${x.name}/${i}`);
   assert.equal(actual?.reason??null,expectedReason,`action reason ${x.name}/${i}`);assert.equal(actual?.kind??null,expectedKind,`action kind ${x.name}/${i}`);
   if(expectedKind&&expectedKind!=='open')active=null;
  }
  assert.equal(seenGates,partialGates.length);assert.equal(ptr,events.length);assert.equal(expectedTargets.length,targets.length,`target journal ${x.name}`);
  const keys=['at','index','episode','depth','price','qty','avgEntry','oldestEntryTime','basePct','normalPct','normalTarget','pct','targetPrice','armedAt','armedIndex'];
  expectedTargets.forEach((t,j)=>keys.forEach(k=>{if(['qty','avgEntry','normalTarget','targetPrice'].includes(k))near(t[k],targets[j][k]);else assert.equal(t[k],targets[j][k],`${x.name}/target${j}/${k}`);}));
  const observations=load(x.name,'tp-observations');assert.deepEqual(transitions,observations.map((o:R)=>({status:o.status,at:o.at,episode:o.episode,...(o.status==='release_requested'?{releaseAt:o.releaseAt}:{})})));
  if(spec.ageHours)assert.deepEqual(ageCounts,x.ageCounts);if(shading)assert.deepEqual(counts,x.counts);else assert.equal(selections.length,0);
  if(x.control){const old=read(`${x.controlRef.archive}/output/results.json`).find((v:R)=>v.name===x.controlRef.name)!;assert.equal(x.digest,old.digest);assert.deepEqual(x.metrics,old.metrics);totals.controls++;}
  else{const b=rows.find(b=>b.strategy==='partial'&&b.set==='local14d'&&!b.lag&&b.window===x.window&&b.tp===x.tp)!,comparison=comparisons.find(q=>q.name===x.name)!;
   assert.deepEqual(exposureDelta(x.metrics,b.metrics),comparison.delta);assert.deepEqual(componentAttribution(x.metrics,b.metrics),comparison.attribution);
   const bm=new Map<string,R>(b.metrics.episodes.map((e:R)=>[e.entry,e])),xm=new Map<string,R>(x.metrics.episodes.map((e:R)=>[e.entry,e]));
   const changedMatched=x.metrics.episodes.filter((e:R)=>{const old=bm.get(e.entry);return old&&(e.close!==old.close||e.reason!==old.reason||Math.abs(e.pnl-old.pnl)>1e-7);}).length;
   const removed=b.metrics.episodes.filter((e:R)=>!xm.has(e.entry)).length,replacement=x.metrics.episodes.filter((e:R)=>!bm.has(e.entry)).length;
   reviews.push({name:x.name,changedEpisodes:changedMatched+removed+replacement,changedMatched,removedCount:removed,replacementCount:replacement,selectedEpisodes:x.selectedEpisodes,...cohort(x,b)});
  }
  totals.runs++;totals.minutes+=x.endIdx-x.startIdx;totals.fills+=events.length;totals.targetTransitions+=targets.length;totals.selected+=selections.length;
 }
 assert.equal(rows.length,72);assert.equal(totals.controls,12);
 const qualification=d.strategies.flatMap((strategy:string)=>d.maps.filter((set:string)=>set!=='local14d').map((set:string)=>{const failures:string[]=[];
  for(const x of rows.filter(x=>x.strategy===strategy&&x.set===set)){const q=comparisons.find(r=>r.name===x.name)!.delta,scr=d.screen,review=reviews.find(r=>r.name===x.name)!;
   if(x.lag){if(q.pnlDelta<scr.minimumLaggedNetDelta)failures.push(`${x.name}:lag_net`);continue;}
   if(q.pnlDelta<(x.window==='recent'?scr.minimumRecentNetDelta:scr.minimumPublishedNetDelta))failures.push(`${x.name}:net`);
   if(q.worstMonthDelta<scr.minimumMonthlyDelta)failures.push(`${x.name}:monthly`);if(q.ddReductionPp<-scr.maximumDrawdownIncreasePp-1e-9)failures.push(`${x.name}:drawdown`);
   if(review.changedEpisodes<scr.minimumChangedEpisodes)failures.push(`${x.name}:thin_changed_cohort`);if(x.accounting.firstNonpositive)failures.push(`${x.name}:nonpositive_equity`);
  }return{id:`${strategy}-${set}`,strategy,set,passesScreen:!failures.length,failures,deployable:false};}));
 await verifyPins(process.cwd(),pins);atomicJson(`${dir}/review.json`,{qualification,reviews,traces});
 const receipt={passed:true,...totals,cacheChecks,checkerSha:sha(fs.readFileSync(__filename)),reviewSha:sha(fs.readFileSync(`${dir}/review.json`)),liveChanges:0,
  scope:'Independent minute target/phase/priority/fill and cash/DD reconstruction; shares frozen live native exit/partial predicates and zone geometry, not shade or deferral controllers. Cached geometry is shared and independently checked against archived maps/local prefixes; source combination is independently reconstructed. Source-prefix checks. Not exchange tick/queue/arrival certification.'};
 atomicJson(`${dir}/verification.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
