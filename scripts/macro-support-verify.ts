/** Separate MS01 source/clock and complete economic verification, no live writes. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {POLICIES,config} from './age10-gate-policy';
import {auditFlowLedger} from './flow-response-audit';
import {auditAgeHighTargets,auditAgeHighExits,rawHighs} from './age-high-refinement-audit';
import {exposureDelta} from './ladder-exposure-metrics';
import {componentAttribution} from './ladder-combination-accounting';
import {VARIANTS,buildFrames,gateTape} from './macro-support-policy';
import {auditFrames,auditGate,auditEntries,episodeAttribution} from './macro-support-audit';
import {ReplaySrContext} from './replay-sr-context';
import {evaluateSRShadowCandidates} from '../src/bot/sr-shadow';
type R=Record<string,any>;const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
async function main(){
  const dir=jobDirectory(process.cwd(),process.argv[2]),out=path.join(dir,'output'),plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
  assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`));const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
  const {s,cfg}=await buildSeries(d),cs=s.candles,highs=rawHighs(cs,2),rows:R[]=read(`${out}/results.json`),comparisons:R[]=read(`${out}/comparisons.json`);
  const load=(name:string,suffix:string)=>read(`${out}/${name}-${suffix}.json`),gates=new Map<string,R>(),sourceChecks:R[]=[],gateChecks:R[]=[];
  let prefixChecks=0;
  for(const lag of d.sourceLagMs){
    const frames=read(`${out}/macro-frames-lag${lag}.json`);sourceChecks.push({lag,...auditFrames(cs,frames,lag)});
    if(!lag)assert.deepEqual(frames.flatMap((f:R)=>f.events),read(`${d.macroArchive}/output/240m-events.json`),'exact prior observer chronology');
    for(const v of VARIANTS){const tape=read(`${out}/gate-${v.id}-lag${lag}.json`);gates.set(`${v.id}:${lag}`,tape);gateChecks.push({id:v.id,lag,...auditGate(frames,v,tape)});}
    for(const at of ['2026-06-05T00:00:00Z','2026-08-22T12:00:00Z','2026-09-15T20:00:00Z'].map(Date.parse)){
      const prefix=buildFrames(cs.filter(c=>c.endTs<=at),lag).filter(f=>f.at<=at);assert.deepEqual(prefix,frames.filter((f:R)=>f.at<=at));
      for(const v of VARIANTS){const g=gateTape(prefix,v),saved=gates.get(`${v.id}:${lag}`)!;assert.deepEqual(g.rows,saved.rows.filter((r:R)=>r.at<=at));assert.deepEqual(g.events,saved.events.filter((e:R)=>e.at<=at));prefixChecks++;}
    }
  }
  let fills=0,minutes=0,targetsChecked=0,highChecks=0,entryChecks=0,partialsChecked=0,controls=0;const reviews:R[]=[];
  for(const x of rows){console.log(`[MS01 verify] ${x.name}`);
    const raw=load(x.name,'engine'),events:R[]=load(x.name,'inventory'),attempts=load(x.name,'attempts'),checks=load(x.name,'entry-checks');
    assert.equal(sha(JSON.stringify(raw)),x.digest);assert.deepEqual(raw.executionAudit.events,events.map(e=>e.event));
    assert.deepEqual(auditFlowLedger(cs,events as any,attempts,x.metrics,x.startIdx,x.endIdx),x.accounting);fills+=events.length;minutes+=x.endIdx-x.startIdx;
    const spec=POLICIES.find(p=>p.id===x.policy)!;assert.deepEqual(spec,x.spec);const c=config(cfg,spec);assert.equal(c.srShadow!.recentDays,14);assert.equal(sha(JSON.stringify(c)),x.configSha);
    const gate=x.variant?gates.get(`${x.variant.id}:${x.lag}`)!:null;entryChecks+=auditEntries(cs,x,events,checks,attempts,gate as any).checks;
    const targets=load(x.name,'targets'),arms:R[]=[];
    targetsChecked+=auditAgeHighTargets(cs,events as any,targets,load(x.name,'tp-observations'),{...x,control:!spec.ageHours,policy:{id:'baseline',family:'age'},sensitivity:{sourceLagMs:0,releaseDelayMs:0}},{},c,{},t=>arms.push(t)).checks;
    assert.equal(arms.length,targets.length);arms.forEach((a,i)=>{assert.equal(a.armedAt,targets[i].armedAt);assert(Math.abs(a.targetPrice-targets[i].targetPrice)<1e-6);});
    // Source-lag sensitivity applies only to the new entry gate, never Agg10's unchanged high exit.
    if(spec.days)highChecks+=auditAgeHighExits(cs,events,{...x,lag:0},load(x.name,'high-reductions'),highs);
    const sr=new ReplaySrContext(cs,c.srShadow!);let cooldown=0;
    for(const e of events.filter(e=>e.event.reason==='sr_partial')){
      const at=e.event.decisionAt,i=e.event.decisionIndex,boundary=Math.floor(at/1800000)*1800000,context=sr.at(boundary);assert(context.coverage.healthy);assert(at>=cooldown);cooldown=at+c.srPartialExitAction!.cooldownMin*60000;
      const pulse=s.marketInputs!.snapshot(at).pulse;pulse.fdByNow=pulse.fdByNow??s.bybitFunding[i];pulse.btc4hMovePct=s.btcRet4h?.[i]??null;
      const decision=evaluateSRShadowCandidates({symbol:c.symbol,nowMs:at,price:cs[i].close,positions:e.before,pulse,config:c,zoneEngine:context.engine,contextCoverage:context.coverage,
        contextCoverageHorizonDays:14,addContext:{canAddTiming:false,timeGateOk:false,priceDropOk:false,atOldCap:false,tpPct:1.4}});
      assert(decision?.firedCandidates.includes(c.srPartialExitAction!.requiredCandidate));const p=decision!.partialExitPlan;assert(p&&p.estimatedNetPnl>0);
      assert.deepEqual(p.closeIndices.map(j=>e.before[j].id).sort(),e.before.filter((q:R)=>!e.after.some((a:R)=>a.id===q.id)).map((q:R)=>q.id).sort());partialsChecked++;
    }
    if(x.control){const old=read(`${d.archive}/output/results.json`).find((r:R)=>r.name===x.name);assert.equal(old.digest,x.digest);assert.deepEqual(old.metrics,x.metrics);controls++;}
    else{const b=rows.find(r=>r.control&&r.policy===d.parent&&r.window===x.window&&r.tp===x.tp)!;const comparison=comparisons.find(r=>r.name===x.name)!;
      assert.deepEqual(exposureDelta(x.metrics,b.metrics),comparison.delta);assert.deepEqual(componentAttribution(x.metrics,b.metrics),comparison.attribution);
      reviews.push({name:x.name,cohorts:episodeAttribution(x,b,load(b.name,'inventory'),gate as any)});
    }
  }
  assert.equal(rows.length,32);assert.equal(controls,8);
  const qualification=VARIANTS.map(v=>{const cases=rows.filter(x=>x.variant?.id===v.id),failures:string[]=[];
    for(const x of cases){const q=comparisons.find(r=>r.name===x.name)!.delta,scr=d.screen;
      if(q.pnlDelta<(x.lag?scr.minimumLaggedNetDelta:x.window==='recent'?scr.minimumRecentNetDelta:scr.minimumPublishedNetDelta))failures.push(`${x.name}:net`);
      if(q.worstMonthDelta<scr.minimumMonthlyDelta)failures.push(`${x.name}:monthly`);if(q.ddReductionPp<-scr.maximumDrawdownIncreasePp-1e-9)failures.push(`${x.name}:drawdown`);
      if(x.window==='recent'&&!x.lag&&x.counts.affectedFailureEvents<scr.minimumAffectedFailureEvents)failures.push(`${x.name}:thin_independent_failures`);
      if(x.accounting.firstNonpositive)failures.push(`${x.name}:nonpositive_equity`);
    }return{id:v.id,passesScreen:failures.length===0,failures,deployable:false};});
  await verifyPins(process.cwd(),pins);atomicJson(`${dir}/review.json`,{qualification,reviews,sourceChecks,gateChecks});
  const receipt={passed:true,runs:32,exactControls:controls,fills,minutes,targetsChecked,highChecks,entryChecks,partialsChecked,prefixChecks,sourceChecks,gateChecks,
    reviewSha:sha(fs.readFileSync(`${dir}/review.json`)),checkerSha:sha(fs.readFileSync(__filename)),auditSha:sha(fs.readFileSync(path.join(__dirname,'macro-support-audit.ts'))),liveChanges:0};
  atomicJson(`${dir}/verification.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
