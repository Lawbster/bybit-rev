/** SRT02 independent price/clock/cohort arithmetic. Never imports buffer worker helpers. */
import fs from 'fs';import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
import {candles,read} from './resistance-tp-opportunity-study';
import {auditFlowLedger} from './flow-response-audit';
type R=Record<string,any>;
const close=(a:number,b:number)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
async function main(){
  const dir=jobDirectory(process.cwd(),process.argv[2]),plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
  assert.equal(d.bufferPct,.3);assert.equal(d.minimumTpPct,1);assert.equal(d.newTradingDefinitions,0);
  assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`));
  const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
  const cs=await candles(d),oldPlan=read(`${d.archive}/plan.json`),base=oldPlan.card.definition.archive;
  const econ:R[]=read(`${base}/output/results.json`).filter((x:R)=>x.control),old:R[]=read(`${d.archive}/output/results.json`),rows:R[]=read(`${dir}/output/results.json`);
  assert.equal(econ.length,8);assert.equal(rows.length,8);let fills=0,anchors=0,scanned=0;
  const load=(p:string,n:string,f:string)=>read(`${p}/output/${n}-${f}.json`);
  for(const x of econ){const ev=load(base,x.name,'inventory');assert.equal(sha(JSON.stringify(load(base,x.name,'engine'))),x.digest);
    assert.deepEqual(auditFlowLedger(cs,ev,load(base,x.name,'attempts'),x.metrics,x.startIdx,x.endIdx),x.accounting);fills+=ev.length;}
  const isExact=(p:R)=>p.exact.hit!==null&&p.exact.fill!==null&&!p.exact.competing;
  const isFuture=(p:R)=>Boolean(p.buffered&&p.buffered.hit!==null&&p.buffered.fill!==null&&!p.buffered.competing);
  const isIntent=(p:R)=>Boolean(p.intent&&p.intent.observed),isUnion=(p:R)=>isFuture(p)||isIntent(p);
  const cohort=(ps:R[])=>{const ids=new Set<number>();let wins=0,losses=0,winDollars=0,lossDollars=0,open=0;
    for(const p of ps)if(!ids.has(p.episode)){ids.add(p.episode);const b=p.exact.baselineOutcome;if(!b)open++;else if(b.pnl>0){wins++;winDollars+=b.pnl;}else if(b.pnl<0){losses++;lossDollars+=b.pnl;}}
    return{ladders:ids.size,wins,winDollars,losses,lossDollars,open};};
  const quantile=(ns:number[],q:number)=>{if(!ns.length)return null;ns.sort((a,b)=>a-b);return ns[Math.floor((ns.length-1)*q)];};
  function checkSummary(s:R,ps:R[]){
    const exact=ps.filter(isExact),future=ps.filter(isFuture),intent=ps.filter(isIntent),union=ps.filter(isUnion),prior=new Set(exact.map(p=>p.episode));
    const values={anchors:ps.length,eligible:cohort(ps),floorClipped:ps.filter(p=>p.candidate.raw<p.candidate.floor).length,
      exactAnchors:exact.length,futureAnchors:future.length,intentAnchors:intent.length,unionAnchors:union.length,
      exact:cohort(exact),future:cohort(future),intent:cohort(intent),union:cohort(union),added:cohort(union.filter(p=>!prior.has(p.episode))),
      recoveredMissAnchors:union.filter(p=>!isExact(p)).length,competing:ps.filter(p=>p.buffered?.competing).length,
      sameBar:future.filter(p=>p.buffered.sameBar).length,shadeOnly:cohort(future.filter(p=>p.buffered.shadeOnly)),
      medianTpPct:quantile(ps.map(p=>p.candidate.tpPct),.5),medianOffsetPct:quantile(ps.map(p=>p.candidate.offsetPct),.5),
      medianExtraGiveUp:quantile(union.map(p=>p.candidate.extraGiveUp),.5),
      medianTotalGiveUp:quantile(union.map(p=>p.exact.targetGiveUp+p.candidate.extraGiveUp),.5),
      earlierAnchors:union.filter(p=>isExact(p)&&p.exact.hitAt>(isIntent(p)?p.at:p.buffered.hitAt)).length,
      medianEarlierMinutes:quantile(union.filter(isExact).map(p=>(p.exact.hitAt-(isIntent(p)?p.at:p.buffered.hitAt))/60000),.5)};
    assert.deepEqual(s,values);
  }
  const traces:R[]=[];
  for(const row of rows){
    const prior=old.find(x=>x.name===row.name)!;assert(prior);const x=econ.find(x=>x.name===prior.baseline)!;
    assert.deepEqual(row.baselineMetrics,x.metrics);for(const k of ['window','tp','lag','start','end'])assert.equal(row[k],prior[k]);
    const ev:R[]=load(base,x.name,'inventory'),ts:R[]=load(base,x.name,'targets'),aa:R[]=load(d.archive,row.name,'anchors'),ll:R[]=load(d.archive,row.name,'labels');
    const pp:R[]=load(dir,row.name,'pairs'),ff:R[]=load(dir,row.name,'features');assert.equal(pp.length,aa.length);assert.equal(ff.length,aa.length);
    const planned=new Set<number>();for(const e of ev)if(e.event.fillAt===cs[e.event.fillIndex].ts)planned.add(e.event.decisionIndex);if(x.pendingAtEnd)planned.add(x.pendingAtEnd.decisionIndex);
    for(let j=0;j<aa.length;j++){
      const a=aa[j],p=pp[j],e=ll[j],c=p.candidate;assert.deepEqual(p.exact,e);assert.equal(p.anchorIndex,a.index);assert.equal(p.at,a.at);assert.equal(p.episode,a.episode);
      assert.equal(a.targetPct,1.4);assert(a.sourceAt<=a.at);assert(!planned.has(a.index));
      const floor=a.avg*1.01,raw=a.shade-a.shade*.003,target=raw<floor?floor:raw;
      close(c.raw,raw);close(c.floor,floor);close(c.price,target);assert.equal(c.clipped,raw<floor);assert.equal(c.alreadyAtIntent,a.price>=target);
      close(c.tpPct,100*(target-a.avg)/a.avg);close(c.offsetPct,100*(a.shade-target)/a.shade);close(c.extraGiveUp,(a.shade-target)*a.qty*.99945);
      assert(target>=floor-1e-9&&target<=a.shade&&target<a.normalTarget);
      assert.deepEqual(ff[j],{anchorIndex:a.index,at:a.at,episode:a.episode,candidate:c});
      const nextTarget=ts.find(t=>t.index>a.index),nextEvent=ev.find(z=>z.event.fillIndex>a.index)?.event;
      const last=Math.min(x.endIdx-1,nextTarget?.index??Infinity,nextEvent?nextEvent.fillIndex-(nextEvent.fillAt===cs[nextEvent.fillIndex].ts?1:0):Infinity,
        ...[...planned].filter(i=>i>a.index));assert.equal(e.last,last);
      const checkLabel=(l:R,price:number)=>{let hit:number|null=null,normal:number|null=null;
        for(let i=a.index+1;i<=last;i++){assert.equal(cs[i].ts,cs[i-1].endTs);scanned++;const at=row.tp==='resting_touch'?cs[i].high:cs[i].close;
          if(hit===null&&at>=price)hit=i;if(normal===null&&at>=a.normalTarget)normal=i;}
        const fi=hit===null?null:hit+(row.tp==='resting_touch'?0:1),fill=fi===null||fi>=x.endIdx?null:row.tp==='resting_touch'?price:cs[fi].open;
        assert.equal(l.hit,hit);assert.equal(l.normal,normal);assert.equal(l.fillIndex,fi);assert.equal(l.fill,fill);
        assert.equal(l.hitAt,hit===null?null:cs[hit].endTs);assert.equal(l.sameBar,hit!==null&&hit===normal);
        assert.equal(l.competing,hit!==null&&row.tp!=='resting_touch'&&planned.has(hit));
        assert.equal(l.hitBeforeNormal,hit!==null&&(normal===null||hit<normal));assert.equal(l.shadeOnly,hit!==null&&normal===null);
        close(l.targetGiveUp,a.qty*(a.normalTarget-price)*.99945);
        if(fill===null)assert.equal(l.remainingNetAtProxy,null);else close(l.remainingNetAtProxy,a.qty*fill*.99945-a.cost*1.00055);
        for(const k of ['anchorIndex','episode','last','reason','baselineOutcome'])assert.deepEqual(l[k],e[k]);};
      checkLabel(e,a.shade);
      if(c.alreadyAtIntent){assert.equal(p.buffered,null);const i=a.index+1;assert.equal(p.intent.index,i);assert.equal(p.intent.observed,i<x.endIdx);
        assert.equal(p.intent.at,i<x.endIdx?cs[i].ts:null);assert.equal(p.intent.fill,i<x.endIdx?cs[i].open:null);
        if(i<x.endIdx)close(p.intent.proxyNet,a.qty*cs[i].open*.99945-a.cost*1.00055);else assert.equal(p.intent.proxyNet,null);
      }else{assert.equal(p.intent,null);checkLabel(p.buffered,target);}
      anchors++;
    }
    checkSummary(row.summary,pp);assert.equal(row.summary.exactAnchors,prior.summary.hitAnchors);assert.equal(row.summary.exact.ladders,prior.summary.hitLadders);
    assert.equal(row.monthly.length,prior.monthly.length);for(let k=0;k<row.monthly.length;k++){const m=row.monthly[k],{month,baselineNet,...s}=m;
      assert.equal(month,prior.monthly[k].month);assert.equal(baselineNet,x.metrics.monthly.find((z:R)=>z.month===month)?.mtmPnl??null);
      checkSummary(s,pp.filter(p=>new Date(p.at).toISOString().startsWith(month)));}
    const oldIds=new Set(pp.filter(isExact).map(p=>p.episode)),added=pp.filter(p=>isUnion(p)&&!oldIds.has(p.episode));
    const expected=[...new Map(added.map(p=>[p.episode,{episode:p.episode,at:p.at,kind:p.intent?'already_at_intent':'future',baselineOutcome:p.exact.baselineOutcome}])).values()];
    assert.deepEqual(row.addedEpisodes,expected);traces.push({name:row.name,first:pp[0],addedLosing:expected.filter(z=>z.baselineOutcome?.pnl<0)});
    console.log(`[SRT02 verify] ${row.name}: ${pp.length} matched anchors`);
  }
  await verifyPins(process.cwd(),pins);atomicJson(`${dir}/review.json`,{traces,economicQualification:'not_evaluated_diagnostic_only'});
  const receipt={passed:true,controls:8,fills,anchors,scanned,liveChanges:0,checkerSha:sha(fs.readFileSync(__filename)),reviewSha:sha(fs.readFileSync(`${dir}/review.json`))};
  atomicJson(`${dir}/verification.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
