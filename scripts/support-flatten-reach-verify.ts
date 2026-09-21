/** SRF01 independent replay-ledger join. No imports from the new selector/study. */
import fs from 'fs';import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {buildFrames} from './macro-support-policy';
import {responseTape} from './major-recovery-policy';
type R=Record<string,any>;const H=3600000,read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
const near=(a:number,b:number)=>assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-7,`${a} != ${b}`);
async function main(){
 const dir=jobDirectory(process.cwd(),process.argv[2]),p=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=p.card.definition,out=`${dir}/output`;
 assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`));const pins=[...p.pins,...p.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
 const {s}=await buildSeries(d),cs=s.candles,rows:R[]=read(`${d.atlas}/output/rows.json`),eventsSource:R[]=read(`${d.atlas}/output/events.json`);
 const rebuilt=responseTape(cs,buildFrames(cs));assert.deepEqual(rebuilt.rows,rows);assert.deepEqual(rebuilt.events,eventsSource);
 const controls:R[]=read(`${d.archive}/output/results.json`).filter((x:R)=>x.control),parity=read(`${out}/control-parity.json`);assert.equal(controls.length,4);
 assert(parity.passed&&parity.rerun===false);let paths=0,minutes=0,openMinutes=0,recordChecks=0,labelChecks=0;
 for(const x of controls){assert.deepEqual(parity.controls.find((z:R)=>z.name===x.name).metrics,x.metrics);
  const es:R[]=read(`${d.archive}/output/${x.name}-inventory.json`),actions=new Map(es.filter(e=>e.event.fillAt===cs[e.event.fillIndex].ts).map(e=>[e.event.decisionIndex,e.event]));
  assert.equal(sha(JSON.stringify(read(`${d.archive}/output/${x.name}-engine.json`))),x.digest);
  if(x.pendingAtEnd)actions.set(x.pendingAtEnd.decisionIndex,x.pendingAtEnd);
  for(const lag of [0,60000]){console.log(`[SRF01 verify] ${x.name} / ${lag}`);const a=read(`${out}/${x.name}-lag${lag}.json`);
   const snapshots:R[]=[...a.first,...a.warnings],snapAt=new Map<number,R[]>();for(const z of snapshots)snapAt.set(z.index,[...(snapAt.get(z.index)??[]),z]);
   let ei=0,ri=-1,inv:R[]=[],ep=0,banked=0,entryAt:number|null=null,opens=0,unknown=0,contexts=0;
   const first=new Map<string,number>(),warn=new Map<string,R>(),masks=new Map<string,{minutes:number;episodes:Set<number>}>(),closed=new Map<number,R>();
   for(let i=x.startIdx;i<x.endIdx;i++){const c=cs[i],at=c.endTs;minutes++;
    while(es[ei]?.event.fillIndex===i){const e=es[ei++];assert.deepEqual(inv,e.before);
     if(e.event.kind==='open'&&!inv.length){entryAt=e.event.fillAt;banked=0;}
     if(e.event.kind!=='open')for(const q of inv){const qty=q.qty-(e.after.find((v:R)=>v.id===q.id)?.qty??0);banked+=qty*(e.event.price-q.entryPrice)-.00055*qty*(e.event.price+q.entryPrice);}
     if(e.event.kind==='close'){const outcome=x.metrics.episodes.find((v:R)=>Date.parse(v.close)===e.event.fillAt);assert(outcome);near(outcome.pnl,banked);closed.set(e.episode,outcome);}
     inv=e.after;ep=e.episode;
    }
    while(ri+1<rows.length&&rows[ri+1].at+lag<=at)ri++;
    if(!inv.length){assert(!snapAt.has(i));continue;}opens++;openMinutes++;
    const r=rows[ri],healthy=!!r?.healthy&&r.barEnd===Math.floor((at-lag)/H)*H,spell=r?.spell;
    if(!healthy)unknown++;
    const oldest=inv.reduce((n,q)=>Math.min(n,q.entryTime),Infinity),qty=inv.reduce((n,q)=>n+q.qty,0),avg=inv.reduce((n,q)=>n+q.qty*q.entryPrice,0)/qty;
    const age=(at-oldest)/H,pnl=(c.close-avg)*100/avg,ageOk=at-oldest>=12*H,pnlOk=pnl<=-2,hostile=s.trendBlocked[i];
    const mask=[...(!ageOk?['age']:[]),...(!pnlOk?['pnl']:[]),...(!hostile?['trend']:[])].join('+')||'none';
    const action=actions.get(i),full=action?.kind==='close',context=!!healthy&&!!spell&&c.close<spell.zone.lower;
    if(healthy&&spell){const key=`${ep}|${spell.id}`;let w=warn.get(key);
     if(!w){w={index:i,firstBelow:null,firstAge12:null,firstPnl:null,firstHostile:null,firstAll:null,lastObservedAt:at,minutes:0};warn.set(key,w);}
     w.lastObservedAt=at;w.minutes++;
     for(const [k,v] of Object.entries({firstBelow:context,firstAge12:ageOk,firstPnl:pnlOk,firstHostile:hostile,firstAll:ageOk&&pnlOk&&hostile}))if(v&&w[k]===null)w[k]=at;
    }
    if(context){contexts++;const m=masks.get(mask)??{minutes:0,episodes:new Set<number>()};m.minutes++;m.episodes.add(ep);masks.set(mask,m);
     const clock=at-oldest>=6*H&&!ageOk&&pnlOk&&hostile,trend=ageOk&&pnlOk&&!hostile;
     for(const [kind,yes] of Object.entries({clock_raw:clock,trend_raw:trend,clock_reach:clock&&!full,trend_reach:trend&&!full}))if(yes&&!first.has(`${kind}|${ep}`))first.set(`${kind}|${ep}`,i);
    }
    for(const z of snapAt.get(i)??[]){assert(healthy&&spell);assert.equal(z.at,at);assert.equal(z.episode,ep);assert.equal(z.entryAt,entryAt);
     near(z.banked,banked);assert.deepEqual(z.inventory,inv);near(z.price,c.close);near(z.qty,qty);near(z.avg,avg);near(z.pnl,pnl);near(z.age,age);
     assert.equal(z.oldest,oldest);assert.equal(z.depth,inv.length);assert.equal(z.missing,mask);assert.equal(z.trendOk,hostile);assert.equal(z.ageOk,ageOk);assert.equal(z.pnlOk,pnlOk);
     assert.equal(z.sourceAt,r.at);assert.equal(z.availableAt,r.at+lag);assert(z.availableAt<=at);assert.equal(z.spellId,spell.id);assert.equal(z.failedAt,spell.failedAt);
     assert.deepEqual(z.zone,spell.zone);assert.equal(z.context,context);assert.equal(z.trendBarEnd,Math.floor(at/(4*H))*4*H);
     assert.equal(z.entryDuringSpell,entryAt!>=spell.failedAt);assert.deepEqual(z.baselineAction,action?{kind:action.kind,reason:action.reason}:null);recordChecks++;
    }
   }
   assert.equal(ei,es.length);assert.equal(a.openMinutes,opens);assert.equal(a.unknownMinutes,unknown);assert.equal(a.contextMinutes,contexts);
   assert.deepEqual(a.matrix,[...masks].map(([missing,v])=>({missing,minutes:v.minutes,episodes:[...v.episodes].sort((a,b)=>a-b)})));
   assert.deepEqual(a.first.map((z:R)=>[`${z.kind}|${z.episode}`,z.index]),[...first]);
   assert.equal(a.warnings.length,warn.size);for(const z of a.warnings){const w=warn.get(`${z.episode}|${z.spellId}`);assert(w);for(const [k,v] of Object.entries(w))assert.equal(z[k],v);}
   for(const z of snapshots){const outcome=closed.get(z.episode)??null;assert.deepEqual(z.outcome,outcome);const next=cs[z.index+1];
    if(z.index+1>=x.endIdx){assert.equal(z.mark,null);assert.equal(z.attributionDelta,null);continue;}
    assert.equal(next.ts,z.at);assert.equal(z.mark.at,next.ts);assert.equal(z.mark.price,next.open);near(z.mark.banked,z.banked);
    const val=z.inventory.reduce((n:number,v:R)=>n+v.qty*(next.open-v.entryPrice)-.00055*v.qty*(v.entryPrice+next.open),0);
    near(z.mark.remaining,val);near(z.mark.net,z.banked+val);if(outcome)near(z.attributionDelta,z.banked+val-outcome.pnl);else assert.equal(z.attributionDelta,null);labelChecks++;
   }
   for(const g of a.summary){const zs=a.first.filter((z:R)=>z.kind===g.kind),fin=zs.filter((z:R)=>z.outcome),valid=fin.filter((z:R)=>z.mark);
    assert.equal(g.n,zs.length);assert.equal(g.open,zs.length-fin.length);assert.equal(g.complete,fin.length);assert.equal(g.wins,fin.filter((z:R)=>z.outcome.pnl>0).length);assert.equal(g.losses,fin.filter((z:R)=>z.outcome.pnl<0).length);
    near(g.winning,fin.reduce((n:number,z:R)=>n+Math.max(0,z.outcome.pnl),0));near(g.losing,fin.reduce((n:number,z:R)=>n+Math.min(0,z.outcome.pnl),0));
    near(g.baseline,valid.reduce((n:number,z:R)=>n+z.outcome.pnl,0));near(g.marks,valid.reduce((n:number,z:R)=>n+z.mark.net,0));near(g.delta,g.marks-g.baseline);
    near(g.winnerDelta,valid.filter((z:R)=>z.outcome.pnl>0).reduce((n:number,z:R)=>n+z.mark.net-z.outcome.pnl,0));near(g.loserDelta,g.delta-g.winnerDelta);
    const months=a.monthly.filter((m:R)=>m.kind===g.kind);near(months.reduce((n:number,m:R)=>n+m.delta,0),g.delta);assert.equal(months.reduce((n:number,m:R)=>n+m.n,0),g.n);
   }
   assert.deepEqual(a.endingInventory,inv);near(a.endingPartial,inv.length?banked:0);paths++;
  }
 }
 let prefixes=0;for(const at of ['2026-06-09T16:00:00Z','2026-06-23T08:00:00Z','2026-06-30T14:00:00Z','2026-09-09T23:00:00Z'].map(Date.parse)){
  const prefix=cs.filter(c=>c.endTs<=at),o=responseTape(prefix,buildFrames(prefix));assert.deepEqual(o.rows,rows.filter(r=>r.at<=at));prefixes++;
 }
 await verifyPins(process.cwd(),pins);const receipt={passed:true,paths,archivedControls:4,minutes,openMinutes,recordChecks,labelChecks,prefixes,
  economicRuns:0,newTradingDefinitions:0,liveChanges:0,checkerSha:sha(fs.readFileSync(__filename)),
  scope:'Independent minute inventory/source/predicate/cohort/next-open-label reconstruction. Shared archived trend series and unchanged macro geometry. No alternate portfolio, queue or live-arrival certification.'};
 atomicJson(`${dir}/verification.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
