/** Independent replay ledger and timing verification, reusing accepted audit primitives. */
import fs from 'fs';
import assert from 'assert/strict';
import {verifyPins,atomicJson,sha} from './research-workflow';
import {loadMinutes} from './relative-reversion-study';
import {auditWindow} from './entry-patience-review';
import {auditFlowLedger} from './entry-patience-ladder-audit';
import {auditAgeHighTargets,auditAgeHighExits,rawHighs} from './entry-patience-target-audit';
type R=Record<string,any>;const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
async function main(){const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));
  const dir=`backtests/research-workflow/${key}`,out=`${dir}/output`,p=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=p.card.definition;
  assert.equal(state.status,'complete');const pins=[...p.pins,...p.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
  const cs=(await loadMinutes(process.cwd(),'HYPEUSDT',Date.parse(d.cutoff),d.repairFile)).candles;
  const highs=rawHighs(cs,2),cfg=read('bot-config.json');delete cfg.aggressive10;
  const rows:R[]=read(`${out}/results.json`),verified:R[]=[];assert.equal(rows.length,20);
  assert.equal(rows.filter(x=>x.control).length,10);assert.equal(new Set(rows.map(x=>x.configSha256)).size,1);
  let fills=0,minutes=0,windowChecks=0,targets=0,highChecks=0;
  for(const x of rows){const get=(suffix:string)=>read(`${out}/${x.name}-${suffix}.json`),raw=get('engine'),events:R[]=get('events');
    assert.equal(sha(JSON.stringify(raw)),x.digest);assert.deepEqual(events.map(e=>e.event),raw.executionAudit.events);
    assert.equal(x.spec.days,x.highEnabled?2:null);assert.equal(x.spec.ageHours,10);
    const w=get('window'),prices=x.waiting?auditWindow(x,w,cs,events):new Map<number,number|null>();
    if(!x.waiting)assert.deepEqual(w,{events:[],intents:[],checks:[]});windowChecks+=w.checks.length;
    const accounting=auditFlowLedger(cs,events as any,get('attempts'),x.metrics,x.startIdx,x.endIdx,prices);
    for(const e of events.filter(e=>e.event.kind==='open'))assert(!x.waiting||prices.get(e.event.decisionIndex)===e.event.price);
    const ts=get('targets'),arms:R[]=[];
    targets+=auditAgeHighTargets(cs,events as any,ts,get('tp-observations'),
      {...x,control:false,policy:{id:'baseline',family:'age'},sensitivity:{sourceLagMs:0,releaseDelayMs:0}}, {},cfg,{},t=>arms.push(t)).checks;
    assert.equal(arms.length,ts.length);
    if(x.highEnabled)highChecks+=auditAgeHighExits(cs,events as any,{...x,lag:0},get('high-reductions'),highs);
    else{assert.deepEqual(get('high-reductions'),[]);assert.equal(x.highExits,0);
      assert(!events.some(e=>e.event.reason.startsWith('research_exit:')));}
    if(x.control){const old:R[]=read(`${d.archive}/output/ladder-results.json`),o=old.find(a=>a.window===x.window&&a.tp===x.tp&&a.model===x.model&&a.policy===(x.waiting?d.waitSpec.id:d.parent));
      assert(o);assert.equal(x.digest,o.digest);assert.deepEqual(x.metrics,o.metrics);}
    fills+=events.length;minutes+=x.endIdx-x.startIdx;verified.push({name:x.name,accounting});console.log(`[L17 verified] ${x.name}`);
  }
  assert(read(`${out}/control-parity.json`).passed);assert.equal(read(`${out}/control-parity.json`).cases.length,10);
  await verifyPins(process.cwd(),pins);assert(!fs.existsSync(`${dir}/verification.json`));
  atomicJson(`${dir}/verification.json`,{passed:true,cases:20,exactControls:10,fills,minutes,windowChecks,targets,highChecks,
    accounting:verified,checkerSha256:sha(fs.readFileSync(__filename)),liveChanges:0});
  console.log(JSON.stringify({passed:true,cases:20,fills,minutes,windowChecks,targets,highChecks}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
