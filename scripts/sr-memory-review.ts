// Audit-only v2: S/R cooldown begins at decisionAt, matching the unchanged engine.
/** Independent economic ledger and exact live-zone evidence audit; no alternate trading path. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {POLICIES,config} from './age10-gate-policy';
import {auditFlowLedger} from './flow-response-audit';
import {auditAgeHighExits,rawHighs} from './age-high-refinement-audit';
import type {Candle} from './hype-freerun-canonical-replay';
import type {ResearchInventoryEvent} from './replay-causal-engine';
import {ReplaySrContext} from './replay-sr-context';
import {evaluateSRShadowCandidates} from '../src/bot/sr-shadow';
import {exposureDelta} from './ladder-exposure-metrics';
type R=Record<string,any>;const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
function last(xs:R[],at:number){let l=0,h=xs.length;while(l<h){const m=(l+h)>>>1;if(xs[m].endTs<=at)l=m+1;else h=m;}return xs[l-1]??null;}
function auditSavedTargets(cs: Candle[], events: ResearchInventoryEvent[], targets: R[], observations: R[], x: R, spec: R, cfg: R, tape: R, onArm?: (t: R) => void) {
  const scheduledClose = new Set(events.filter(e => e.event.kind === "close" && !e.event.reason.startsWith("research_exit:") && e.event.fillAt === cs[e.event.fillIndex!].ts).map(e => e.event.decisionIndex));
  if (x.pendingAtEnd?.kind === "close" && !x.pendingAtEnd.reason.startsWith("research_exit:")) scheduledClose.add(x.pendingAtEnd.decisionIndex);
  const afterArmQuiesce = new Set(events.filter(e => e.event.kind === "partial" || e.event.kind === "close" && e.event.reason.startsWith("research_exit:")).map(e => e.event.decisionIndex));
  if (x.pendingAtEnd?.kind === "partial" || x.pendingAtEnd?.kind === "close" && x.pendingAtEnd.reason.startsWith("research_exit:")) afterArmQuiesce.add(x.pendingAtEnd.decisionIndex);
  let activeArm: R | null = null;
  const sr = x.policy.family === "resistance" ? new ReplaySrContext(cs, cfg.srShadow) : null;
  let boundary = -Infinity, eventAt = 0, targetAt = 0, inv: ResearchInventoryEvent["after"] = [], ep = -1, stateEp = -1;
  let phase: "unseen" | "extending" | "releasing" | "released" = "unseen", releaseAt = Infinity;
  const transitions: R[] = [], counts = { checks: 0, eligibleChecks: 0, deferredChecks: 0, unknownChecks: 0 };
  function context(at: number, price: number, normalTarget: number) {
    if (x.policy.family === "age") return { healthy: true, allowed: true };
    const sourceAt = at - x.sensitivity.sourceLagMs;
    if (x.policy.family === "structure") {
      const f = last(tape.structure, sourceAt), healthy = !!f?.healthy && sourceAt - f.endTs < 14400000;
      return { healthy, allowed: healthy && f.close >= f.ema200 && f.ema50 >= f.ema50Prev };
    }
    if (x.policy.family === "vwap") {
      const f = last(tape.vwap, sourceAt), healthy = !!f?.healthy && sourceAt - f.endTs < 3600000;
      return { healthy, allowed: healthy && f.close > f.vwap && f.roc5 > 0 };
    }
    const grid = Math.floor(sourceAt / 1800000) * 1800000;
    if (grid > boundary) { sr!.at(grid); boundary = grid; }
    const c = sr!.at(sourceAt), levels = c.engine.getZones(sourceAt).filter(l => l.price > price);
    let nearest = Infinity; for (const l of levels) nearest = Math.min(nearest, l.price);
    const healthy = c.coverage.healthy && Number.isFinite(nearest);
    return { healthy, allowed: healthy && nearest >= normalTarget * 1.001 };
  }
  for (let i = x.startIdx; i < x.endIdx; i++) {
    const c = cs[i], at = c.endTs;
    while (eventAt < events.length && events[eventAt].event.fillIndex! <= i) { inv = events[eventAt].after; ep = events[eventAt].episode; activeArm = null; eventAt++; }
    if (!inv.length || scheduledClose.has(i)) { activeArm = null; continue; }
    while (targetAt + 1 < targets.length && targets[targetAt + 1].index <= i) targetAt++;
    const actual = targets[targetAt]; assert(actual && actual.index <= i && actual.episode === ep, `missing active target at ${at}`);
    const qty = inv.reduce((n, p) => n + p.qty, 0), avg = inv.reduce((n, p) => n + p.entryPrice * p.qty, 0) / qty;
    const age = (at - Math.min(...inv.map(p => p.entryTime))) / 3600000;
    const eligible = x.policy.id !== "minus_soft_stale" && age >= 4 && (c.close - avg) / avg * 100 < .5;
    const base = eligible ? .5 : 1.4;
    let defer = false;
    if (!x.control) {
      counts.checks++; if (eligible) counts.eligibleChecks++;
      if (stateEp !== ep) { stateEp = ep; phase = "unseen"; releaseAt = Infinity; }
      const log = (status: string, release?: number) => transitions.push({ status, at, episode: ep, ...(release === undefined ? {} : { releaseAt: release }) });
      if (phase === "releasing") {
        if (at < releaseAt) defer = true;
        else { phase = "released"; log("released", releaseAt); }
      } else if (phase !== "released" && (phase === "extending" || eligible)) {
        const q = age >= x.spec.ageHours ? { healthy: true, allowed: false } : context(at, c.close, avg * 1.014);
        if (!q.healthy) counts.unknownChecks++;
        if (q.healthy && q.allowed) {
          if (phase === "unseen") { log("extended"); phase = "extending"; }
          defer = true;
        } else if (phase === "unseen") { log("refused"); phase = "released"; }
        else {
          releaseAt = at + x.sensitivity.releaseDelayMs; log("release_requested", releaseAt);
          phase = at < releaseAt ? "releasing" : "released"; defer = at < releaseAt;
        }
      }
      if (defer) counts.deferredChecks++;
    }
    const expectedPct = defer ? 1.4 : base;
    assert.equal(actual.pct, expectedPct, `target policy at ${at}/${x.name}`);
    assert(Math.abs(actual.targetPrice - avg * (1 + expectedPct / 100)) < 1e-8, `inventory target at ${at}`);
    const price = avg * (1 + expectedPct / 100);
    if (!activeArm || activeArm.episode !== ep || activeArm.pct !== expectedPct || activeArm.targetPrice !== price) {
      activeArm = { episode: ep, pct: expectedPct, targetPrice: price, armedAt: at, armedIndex: i };
      onArm?.(activeArm);
    }
    if (afterArmQuiesce.has(i)) activeArm = null;
  }
  const projected = observations.map(o => ({ status: o.status, at: o.at, episode: o.episode, ...(["released", "release_requested"].includes(o.status) ? { releaseAt: o.releaseAt } : {}) }));
  assert.deepEqual(transitions, projected, "first eligibility and first release must match the complete minute path");
  // SRM01 did not persist controller counters. Validate every target/transition above,
  // return independently reconstructed counts, and do not claim counter parity.
  return counts;
}
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
async function main(){
  const dir=jobDirectory(process.cwd(),process.argv[2]),out=path.join(dir,'output'),plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
  assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`));
  const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
  const {s,cfg}=await buildSeries(d),cs=s.candles,highs=rawHighs(cs,2),rows:R[]=read(`${out}/results.json`),comparisons:R[]=read(`${out}/comparisons.json`);
  const load=(name:string,suffix:string)=>read(`${out}/${name}-${suffix}.json`),summaries:R[]=[],zoneEvidence:R[]=[];
  let controls=0,fills=0,targetChecks=0,highChecks=0,prefixChecks=0;
  for(const x of rows){
    console.log(`[SRM01 verify] ${x.name}`);const raw=load(x.name,'engine'),events:R[]=load(x.name,'inventory'),attempts=load(x.name,'attempts');
    assert.equal(sha(JSON.stringify(raw)),x.digest);assert.deepEqual(events.map(e=>e.event),raw.executionAudit.events);
    assert.deepEqual(auditFlowLedger(cs,events as any,attempts,x.metrics,x.startIdx,x.endIdx),x.accounting);fills+=events.length;
    const spec=POLICIES.find(p=>p.id===x.policy)!;assert.deepEqual(spec,x.spec);const c=config(cfg,spec);c.srShadow!.recentDays=x.days;assert.equal(sha(JSON.stringify(c)),x.configSha);
    const targets=load(x.name,'targets'),arms:R[]=[];
    const targetAudit=auditSavedTargets(cs,events as any,targets,load(x.name,'tp-observations'),{...x,control:!x.spec.ageHours,policy:{id:'baseline',family:'age'},sensitivity:{sourceLagMs:0,releaseDelayMs:0}},{},c,{},t=>arms.push(t));targetChecks+=targetAudit.checks;
    assert.equal(arms.length,targets.length);arms.forEach((a,i)=>{assert.equal(a.armedAt,targets[i].armedAt);near(a.targetPrice,targets[i].targetPrice);});
    if(spec.days)highChecks+=auditAgeHighExits(cs,events,x,load(x.name,'high-reductions'),highs);
    const sr=new ReplaySrContext(cs,c.srShadow!),srRows:R[]=[];let cooldown=0;
    for(const e of events.filter(e=>e.event.reason==='sr_partial')){
      const at=e.event.decisionAt,i=e.event.decisionIndex,boundary=Math.floor(at/1800000)*1800000,ctx=sr.at(boundary);
      assert(ctx.coverage.healthy);assert(at>=cooldown);cooldown=at+c.srPartialExitAction!.cooldownMin*60000;
      const pulse=s.marketInputs!.snapshot(at).pulse;pulse.fdByNow=pulse.fdByNow??s.bybitFunding[i];pulse.btc4hMovePct=s.btcRet4h?.[i]??null;
      const decision=evaluateSRShadowCandidates({symbol:c.symbol,nowMs:at,price:cs[i].close,positions:e.before,pulse,config:c,zoneEngine:ctx.engine,
        contextCoverage:ctx.coverage,contextCoverageHorizonDays:x.days,addContext:{canAddTiming:false,timeGateOk:false,priceDropOk:false,atOldCap:false,tpPct:1.4}});
      assert(decision?.firedCandidates.includes(c.srPartialExitAction!.requiredCandidate));const p=decision!.partialExitPlan;assert(p);
      assert.deepEqual(p.closeIndices.map(j=>e.before[j].id).sort(),e.before.filter((q:R)=>!e.after.some((a:R)=>a.id===q.id)).map((q:R)=>q.id).sort());
      const hit=ctx.engine.nearestResistance(at,cs[i].close);assert(hit);assert(hit.dist*100<=c.srPartialExitAction!.resistanceBufferPct);assert(p.estimatedNetPnl>0);
      for(const t of hit.lv.touchData){assert(t.ts<=boundary);assert(t.ts>=boundary-x.days*86400000);}
      if(srRows.length<2){const prefix=new ReplaySrContext(cs.filter(c=>c.endTs<=boundary),c.srShadow!).at(boundary);assert.deepEqual(ctx.engine.getZones(boundary),prefix.engine.getZones(boundary));prefixChecks++;}
      srRows.push({at,episode:e.episode,level:hit.lv.price,oldestTouch:Math.min(...hit.lv.touchData.map(t=>t.ts)),newestTouch:Math.max(...hit.lv.touchData.map(t=>t.ts)),touches:hit.lv.touches,qty:e.event.qty});
    }
    if(x.control){const previous=read(`${x.archive}/output/results.json`).find((a:R)=>a.name===x.originalName);assert(previous);assert.equal(previous.digest,x.digest);assert.deepEqual(previous.metrics,x.metrics);controls++;}
    const parent=rows.find(y=>y.control&&y.policy===d.parent&&y.tp===x.tp&&y.window===x.window)!;
    const delta=exposureDelta(x.metrics,parent.metrics);if(!x.control){const comparison=comparisons.find(y=>y.name===x.name);assert(comparison);assert.deepEqual(comparison.delta,delta);}
    const pe:R[]=load(parent.name,'inventory').filter((e:R)=>e.event.reason==='sr_partial'),signatures=new Set(pe.map(e=>`${e.event.decisionAt}|${e.event.qty}`));
    const changed=new Set(srRows.filter(e=>!signatures.has(`${e.at}|${e.qty}`)).map(e=>e.episode));
    summaries.push({name:x.name,window:x.window,tp:x.tp,days:x.days,policy:x.policy,control:x.control,metrics:x.metrics,monthly:x.accounting.monthly,delta,changedPartialEpisodes:changed.size,
      targetAudit,changedPartialFills:srRows.filter(e=>!signatures.has(`${e.at}|${e.qty}`)).length,unhealthyMinutes:x.blocked.srContext});zoneEvidence.push({name:x.name,partials:srRows});
  }
  assert.equal(controls,8);assert.equal(rows.length,24);
  const screen=d.screen,qualification=d.memoryDays.slice(1).map((days:number)=>{const cases=summaries.filter(x=>x.days===days),recent=cases.filter(x=>x.window==='recent'),older=cases.filter(x=>x.window==='published');const reasons:string[]=[];
    if(recent.some(x=>x.delta.pnlDelta<screen.minimumRecentNetDelta))reasons.push('recent_net');if(older.some(x=>x.delta.pnlDelta<screen.minimumPublishedNetDelta))reasons.push('older_net');
    if(cases.some(x=>x.delta.worstMonthDelta<screen.minimumMonthlyDelta))reasons.push('monthly');if(cases.some(x=>x.delta.ddReductionPp<-screen.maximumDrawdownIncreasePp-1e-9))reasons.push('drawdown');
    if(recent.some(x=>x.changedPartialEpisodes<screen.minimumChangedPartialEpisodes))reasons.push('thin_changed_partial_cohort');return{days,passesScreen:!reasons.length,reasons,deployable:false};});
  await verifyPins(process.cwd(),pins);atomicJson(`${dir}/review.json`,{summaries,qualification,zoneEvidence});
  const receipt={passed:true,runs:24,exactControls:controls,fills,targetChecks,highChecks,prefixChecks,reviewSha:sha(fs.readFileSync(`${dir}/review.json`)),checkerSha256:sha(fs.readFileSync(__filename)),auditCorrection:'SR cooldown starts at decisionAt, not fillAt; saved target values and transition chronology verified without unavailable controller-counter parity; pinned original checker retained',liveChanges:0};atomicJson(`${dir}/verification.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
