/** Independent scheduling and ledger audits; never imports the study policy. */
import fs from 'fs';
import assert from 'assert/strict';
import {verifyPins,atomicJson,sha}from './research-workflow';
import {loadMinutes}from './relative-reversion-study';
import {verifyCase}from './entry-patience-standalone-audit';
import {auditFlowLedger}from './entry-patience-ladder-audit';
import {auditAgeHighTargets,auditAgeHighExits,rawHighs}from './age-high-refinement-audit';
type R=Record<string,any>;const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
export function auditWindow(x:R,w:R,cs:R[],inventory:R[]){
  let pending:R|null=null,retry=0,seenAt=-1;const intents:R[]=[],prices=new Map<number,number|null>(),decisions:R[]=[];
  let proposal:R|null=null,eventPointer=0;let inv:R[]=[];
  function cancel(at:number,reason:string){if(pending){pending.phase=reason;pending.endedAt=at;pending=null;}}
  for(const e of w.events){
    if(e.type==='decision'){
      assert.equal(e.at,cs[e.index].endTs);assert.equal(e.price,cs[e.index].close);
      while(eventPointer<inventory.length&&inventory[eventPointer].event.fillIndex<=e.index)inv=inventory[eventPointer++].after;
      assert.equal(e.nextDepth,inv.length+1);assert.equal(e.priceDropOk,inv.length>0&&e.price<=inv.at(-1)!.entryPrice*.997);
      seenAt=e.at;if(pending&&e.at>=pending.expiresAt)cancel(e.at,'expired');
      let veto=false;
      if(e.priceDropOk)cancel(e.at,'price_drop_priority');
      else if(e.nextDepth>=x.waitSpec.minDepth){
        if(!pending&&e.at>=retry){pending={signalAt:e.at,index:e.index,episode:e.episode,nextDepth:e.nextDepth,reference:e.price,
          cap:e.price*(1-x.waitSpec.offsetPct/100),expiresAt:e.at+900000,activeAt:e.at+(x.model==='activation60'?60000:0),
          retryAt:e.at+e.intervalMinutes*60000,phase:'waiting',endedAt:null,fillAt:null,fillPrice:null};
          retry=pending.retryAt;intents.push(pending);}
        veto=!pending||e.at<pending.activeAt||e.price>pending.cap;
      }
      assert.equal(e.veto,veto);proposal=e;const {type,...d}=e;decisions.push(d);
    }else if(e.type==='fill'){
      assert.equal(e.at,cs[e.index].ts);assert.equal(e.index,e.decisionIndex+1);assert.equal(e.open,cs[e.index].open);
      let expected:number|null=e.open;
      if(e.reason==='time_add'&&proposal!==null&&proposal.index===e.decisionIndex&&proposal.nextDepth>=x.waitSpec.minDepth){
        assert.equal(proposal.veto,false);expected=pending&&e.at<pending.expiresAt&&e.at>=pending.activeAt&&e.open<=pending.cap?(x.model==='cap'?pending.cap:e.open):null;
        if(expected!==null){pending!.fillAt=e.at;pending!.fillPrice=expected;}
      }
      assert.equal(e.price,expected);assert(!prices.has(e.decisionIndex));prices.set(e.decisionIndex,expected);
    }else if(e.type==='inventory'){cancel(e.at,e.kind==='open'?'filled_or_other_open':'inventory_changed');retry=0;}
    else{assert.equal(e.type,'cancel');assert(e.gap||seenAt!==e.at);cancel(e.at,e.gap?'gap':'gate_or_exit');}
  }
  cancel(Date.parse(x.end),'cutoff');assert.deepEqual(intents,w.intents);assert.deepEqual(decisions,w.checks);
  assert.deepEqual(w.events.filter((e:R)=>e.type==='inventory').map((e:R)=>[e.at,e.kind]),inventory.map(e=>[e.event.fillAt,e.event.kind]));
  return prices;
}
async function main(){const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));const dir=`backtests/research-workflow/${key}`,out=`${dir}/output`;
  const p=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=p.card.definition;assert.equal(state.status,'complete');
  const pins=[...p.pins,...p.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
  const cs=(await loadMinutes(process.cwd(),'HYPEUSDT',Date.parse(d.cutoff),d.repairFile)).candles;
  const signals:R[]=read(`${d.bh02}/output/signals.json`),byEnd=new Map(cs.map(c=>[c.endTs,c.close]));for(const s of signals)assert.equal(s.cap,byEnd.get(s.at));
  let fills=0,minutes=0,windowChecks=0,targets=0,highChecks=0;const verified:R[]=[];
  for(const row of read(`${out}/standalone-results.json`)){
    const r=read(`${out}/${row.name}.json`);for(const k of Object.keys(row))assert.deepEqual(row[k],r[k]);
    r.stressNet=r.stats.net-r.stats.turnoverIncludingMarkedExit*.0005;
    const xs=cs.filter(c=>c.ts>=r.options.start&&c.endTs<=r.options.end),ss=signals.filter(s=>s.at>=r.options.start&&s.at<r.options.end);
    const a=verifyCase(r,xs,ss,{extraStressRatePerSide:.0005});fills+=a.fills;minutes+=a.marks;
    console.log(`[BH03 verified] ${r.name}`);
  }
  const hs=rawHighs(cs,2),cfg=read('bot-config.json');delete cfg.aggressive10;
  for(const x of read(`${out}/ladder-results.json`)){
    const raw=read(`${out}/${x.name}-engine.json`),events:R[]=read(`${out}/${x.name}-events.json`),attempts=read(`${out}/${x.name}-attempts.json`);
    assert.equal(sha(JSON.stringify(raw)),x.digest);assert.deepEqual(events.map(e=>e.event),raw.executionAudit.events);
    const w=read(`${out}/${x.name}-window.json`),prices=x.waitSpec?auditWindow(x,w,cs,events):new Map<number,number|null>();windowChecks+=w.checks.length;
    const accounting=auditFlowLedger(cs,events as any,attempts,x.metrics,x.startIdx,x.endIdx,prices);
    for(const e of events.filter(e=>e.event.kind==='open'))assert(prices.size===0||prices.get(e.event.decisionIndex)===e.event.price);
    const arms:R[]=[],ts=read(`${out}/${x.name}-targets.json`);
    targets+=auditAgeHighTargets(cs,events as any,ts,read(`${out}/${x.name}-tp-observations.json`),
      {...x,control:!x.spec.ageHours,policy:{id:'baseline',family:'age'},sensitivity:{sourceLagMs:0,releaseDelayMs:0}}, {},cfg,{},t=>arms.push(t)).checks;
    assert.equal(arms.length,ts.length);
    if(x.spec.days)highChecks+=auditAgeHighExits(cs,events as any,x,read(`${out}/${x.name}-high-reductions.json`),hs);
    fills+=events.length;minutes+=x.endIdx-x.startIdx;verified.push({name:x.name,accounting});
    console.log(`[L16 verified] ${x.name}`);
  }
  assert.equal(read(`${out}/standalone-results.json`).length,60);assert.equal(verified.length,56);
  await verifyPins(process.cwd(),pins);assert(!fs.existsSync(`${dir}/verification.json`));
  atomicJson(`${dir}/verification.json`,{passed:true,standaloneCases:60,ladderCases:56,fills,minutes,windowChecks,targets,highChecks,ladderAccounting:verified,
    exactControlCases:20,liveChanges:0});console.log(JSON.stringify({passed:true,fills,minutes,windowChecks,targets,highChecks}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
