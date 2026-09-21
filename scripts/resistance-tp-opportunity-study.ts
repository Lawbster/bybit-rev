/** SRT01 descriptive atlas over immutable baseline ledgers. Never runs an alternate policy. */
import fs from 'fs';import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,sha,verifyPins,type Plan} from './research-workflow';
import {loadCandles1m} from './hype-freerun-canonical-replay';
import {missingMinutes} from './replay-candle-repair';
import {auditFlowLedger} from './flow-response-audit';
import {config,POLICIES} from './age10-gate-policy';
import {featurePath,futureLabel,summarize,type R} from './resistance-tp-opportunity';
export const CARD='research-inputs/resistance-tp-opportunity-srt01-2026-09-16.json';
export const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
export function validate(d:R){assert.equal(d.newTradingDefinitions,0);assert.equal(d.minimumTpPct,1);assert.equal(d.normalTpPct,1.4);
  assert.equal(d.minimumSpacedTouches,3);assert.equal(d.touchSpacingMs,21600000);assert.deepEqual(d.sourceLagsMs,[0,60000]);}
export async function candles(d:R){const cs=await loadCandles1m('HYPEUSDT','data',Date.parse(d.cutoff),d.repairFile);
  assert.equal(missingMinutes(cs).length,0);assert.equal(cs.at(-1)!.endTs,Date.parse(d.cutoff));return cs;}
async function worker(plan:Plan,out:string){
  const d=plan.card.definition;validate(d);const cs=await candles(d),rows:R[]=read(`${d.archive}/output/results.json`).filter((x:R)=>x.control);assert.equal(rows.length,8);
  const prior=read(`${d.archive}/verification.json`);assert(prior.passed);const cfg=read('bot-config.json');delete cfg.aggressive10;
  const load=(x:R,f:string)=>read(`${d.archive}/output/${x.name}-${f}.json`),json=(name:string,v:unknown)=>atomicJson(`${out}/${name}.json`,v);
  const controls:R[]=[],results:R[]=[];
  for(const x of rows){const raw=load(x,'engine'),inv=load(x,'inventory'),attempts=load(x,'attempts');
    assert.equal(sha(JSON.stringify(raw)),x.digest);assert.deepEqual(raw.executionAudit.events,inv.map((e:R)=>e.event));
    assert.equal(cs[x.startIdx].endTs,Date.parse(x.start));assert.equal(cs[x.endIdx-1].endTs,Date.parse(x.end));
    assert.deepEqual(auditFlowLedger(cs,inv,attempts,x.metrics,x.startIdx,x.endIdx),x.accounting);
    controls.push({name:x.name,digest:x.digest,metrics:x.metrics});
  }
  json('baseline-verification',{passed:true,kind:'accepted engine digests plus independently reconstructed ledgers, not fresh economic reruns',controls});
  for(const x of rows.filter(x=>x.policy===d.parent))for(const lag of d.sourceLagsMs){
    const name=`${x.name}-source${lag}`,c=config(cfg,POLICIES.find(p=>p.id===x.policy)!);assert.equal(sha(JSON.stringify(c)),x.configSha);
    console.log(`[SRT01] ${name}`);const inv=load(x,'inventory'),targets=load(x,'targets');
    const path=featurePath(cs,x,inv,targets,c,d,lag);json(`${name}-features`,path.features);json(`${name}-anchors`,path.anchors);
    // Forward labels deliberately run only after all causal features have been persisted.
    const labels=path.anchors.map(a=>futureLabel(cs,x,inv,targets,a));json(`${name}-labels`,labels);
    const summary=summarize(path.features,path.anchors,labels);
    const monthly=path.monthly.map(m=>{const aa=path.anchors.filter(a=>new Date(a.at).toISOString().startsWith(m.month)),ids=new Set(aa.map(a=>a.index));
      return{...m,...summarize(path.features.filter(a=>new Date(a.at).toISOString().startsWith(m.month)),aa,labels.filter(l=>ids.has(l.anchorIndex)))};});
    const row={name,baseline:x.name,window:x.window,tp:x.tp,lag,start:x.start,end:x.end,counts:path.counts,summary,monthly,baselineMetrics:x.metrics};
    results.push(row);json('results',results);console.log(JSON.stringify({name,counts:path.counts,summary}));
  }
  json('validation',{passed:true,independentCheckRequired:true,baselineLedgers:8,diagnosticPaths:8,newTradingDefinitions:0,liveChanges:0});
}
async function main(){const[cmd,key]=process.argv.slice(2);if(cmd==='plan'){
  const card=read(CARD),d=card.definition;validate(d);const old=read(`${d.archive}/plan.json`),state=read(`${d.archive}/state.json`);
  assert.equal(state.status,'complete');await verifyPins(process.cwd(),[...old.pins,...old.protectedPins,...state.artifacts]);
  const receipt=read(`${d.archive}/verification.json`);assert(receipt.passed);assert.equal(sha(fs.readFileSync(`${d.archive}/review.json`)),receipt.reviewSha);
  assert.equal(sha(fs.readFileSync('scripts/sr-partial-audit-review.ts')),receipt.checkerSha);
  const files=[...old.pins.map((p:R)=>p.file),...state.artifacts.map((p:R)=>p.file),`${d.archive}/verification.json`,`${d.archive}/review.json`,'scripts/sr-partial-audit-review.ts',
    CARD,'docs/research/resistance-tp-opportunity-srt01.md','scripts/resistance-tp-opportunity.ts','scripts/resistance-tp-opportunity-study.ts',
    'scripts/resistance-tp-opportunity-tests.ts','scripts/resistance-tp-opportunity-verify.ts'];
  console.log((await createPlan(process.cwd(),card,files,old.protectedPins.map((p:R)=>p.file))).key);
 }else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
