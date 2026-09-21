import fs from 'fs';import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,sha,verifyPins,type Plan} from './research-workflow';
import {candles,read} from './resistance-tp-opportunity-study';
import {futureLabel,summarize,type R} from './resistance-tp-opportunity';
import {auditFlowLedger} from './flow-response-audit';
import {candidate,labelPair,stats,unionHit,exactHit} from './resistance-tp-buffer';
export const CARD='research-inputs/resistance-tp-buffer-srt02-2026-09-16.json';
export function validate(d:R){assert.equal(d.bufferPct,.3);assert.equal(d.minimumTpPct,1);assert.equal(d.newTradingDefinitions,0);}
async function worker(plan:Plan,out:string){
  const d=plan.card.definition;validate(d);const cs=await candles(d),prior=read(`${d.archive}/plan.json`),base=prior.card.definition.archive;
  const originals:R[]=read(`${d.archive}/output/results.json`),economic:R[]=read(`${base}/output/results.json`).filter((x:R)=>x.control);
  assert.equal(originals.length,8);assert.equal(economic.length,8);
  const load=(dir:string,n:string,f:string)=>read(`${dir}/output/${n}-${f}.json`),write=(n:string,v:unknown)=>atomicJson(`${out}/${n}.json`,v);
  let fills=0;for(const x of economic){const inv=load(base,x.name,'inventory');
    assert.equal(sha(JSON.stringify(load(base,x.name,'engine'))),x.digest);
    assert.deepEqual(auditFlowLedger(cs,inv,load(base,x.name,'attempts'),x.metrics,x.startIdx,x.endIdx),x.accounting);fills+=inv.length;}
  write('baseline-verification',{passed:true,controls:8,fills,source:base,kind:'archived digest and independent ledger reconstruction; no alternate strategy'});
  const results:R[]=[];
  for(const r of originals){
    const x=economic.find(x=>x.name===r.baseline)!;assert(x);const ev=load(base,x.name,'inventory'),ts=load(base,x.name,'targets');
    const features=load(d.archive,r.name,'features'),aa:R[]=load(d.archive,r.name,'anchors'),ll:R[]=load(d.archive,r.name,'labels');
    assert.deepEqual(summarize(features,aa,ll),r.summary);
    for(let i=0;i<aa.length;i++)assert.deepEqual(futureLabel(cs,x,ev,ts,aa[i]),ll[i]);
    // Persist targets/classification before scanning any new outcomes.
    write(`${r.name}-features`,aa.map(a=>({anchorIndex:a.index,at:a.at,episode:a.episode,candidate:candidate(a)})));
    const pairs=aa.map((a,i)=>labelPair(cs,x,ev,ts,a,ll[i]));write(`${r.name}-pairs`,pairs);
    const summary=stats(pairs),oldEpisodes=new Set(pairs.filter(exactHit).map(p=>p.episode));
    const monthly=r.monthly.map((m:R)=>({month:m.month,baselineNet:r.baselineMetrics.monthly.find((b:R)=>b.month===m.month)?.mtmPnl??null,
      ...stats(pairs.filter(p=>new Date(p.at).toISOString().startsWith(m.month)))}));
    const row={name:r.name,window:r.window,tp:r.tp,lag:r.lag,start:r.start,end:r.end,baselineMetrics:r.baselineMetrics,summary,monthly,
      addedEpisodes:[...new Map(pairs.filter(p=>unionHit(p)&&!oldEpisodes.has(p.episode)).map(p=>[p.episode,{episode:p.episode,
        at:p.at,kind:p.intent?'already_at_intent':'future',baselineOutcome:p.exact.baselineOutcome}])).values()]};
    results.push(row);write('results',results);console.log(JSON.stringify({name:r.name,summary}));
  }
  write('validation',{passed:true,independentCheckRequired:true,diagnosticPaths:8,economicVariants:0,liveChanges:0});
}
async function main(){const[cmd,key]=process.argv.slice(2);if(cmd==='plan'){
  const card=read(CARD),d=card.definition;validate(d);const old=read(`${d.archive}/plan.json`),state=read(`${d.archive}/state.json`);assert.equal(state.status,'complete');
  await verifyPins(process.cwd(),[...old.pins,...old.protectedPins,...state.artifacts]);const v=read(`${d.archive}/verification.json`);assert(v.passed);
  assert.equal(sha(fs.readFileSync('scripts/resistance-tp-opportunity-verify.ts')),v.checkerSha);assert.equal(sha(fs.readFileSync(`${d.archive}/review.json`)),v.reviewSha);
  const files=[...old.pins.map((p:R)=>p.file),...state.artifacts.map((p:R)=>p.file),`${d.archive}/verification.json`,`${d.archive}/review.json`,`${d.archive}/plan.json`,
    CARD,'docs/research/resistance-tp-buffer-srt02.md','scripts/resistance-tp-buffer.ts','scripts/resistance-tp-buffer-study.ts','scripts/resistance-tp-buffer-tests.ts','scripts/resistance-tp-buffer-verify.ts'];
  console.log((await createPlan(process.cwd(),card,files,old.protectedPins.map((p:R)=>p.file))).key);
}else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
