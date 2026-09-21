/** Independent T02 verifier. No candidate policy, replay engine or attribution helper imports. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { referenceVolumeFlow } from "./volume-flow-standalone-results-check";
const root=path.resolve(__dirname,".."),M=60_000,H=60*M;
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const key=(r:any)=>`${r.window}|${r.delayMs}|${r.id}`;
const sum=(xs:any[],f:(x:any)=>number)=>xs.reduce((s,x)=>s+f(x),0);
const near=(a:any,b:number,label:string,eps=1e-6)=>assert(typeof a==="number"&&Number.isFinite(a)&&Math.abs(a-b)<=eps,`${label}: ${a} != ${b}`);
async function sha(p:string){const h=crypto.createHash("sha256");for await(const b of fs.createReadStream(p))h.update(b);return h.digest("hex");}
async function lines(p:string){const out=new Map<string,any[]>();for await(const l of readline.createInterface({input:fs.createReadStream(p),crlfDelay:Infinity})){
  if(!l.trim())continue;const x=JSON.parse(l),k=key(x);if(!out.has(k))out.set(k,[]);out.get(k)!.push(x);}return out;}
function stats(xs:any[]){const sorted=xs.map(t=>t.net).sort((a,b)=>b-a),wins=sorted.filter(x=>x>1e-8),losses=sorted.filter(x=>x < -1e-8),total=sum(xs,t=>t.net);
  return {trades:xs.length,wins:wins.length,losses:losses.length,winningDollars:sum(wins,x=>x),losingDollars:sum(losses,x=>x),net:total,
    top1WinningDollars:sum(wins.slice(0,1),x=>x),top3WinningDollars:sum(wins.slice(0,3),x=>x),top5WinningDollars:sum(wins.slice(0,5),x=>x),
    withoutTop1WinnerNet:total-sum(wins.slice(0,1),x=>x),withoutTop3WinnersNet:total-sum(wins.slice(0,3),x=>x)};}
async function main(){
  assert.equal(process.argv.length,3);const dir=path.resolve(root,process.argv[2]),relative=path.relative(path.join(root,"backtests"),dir);
  assert(relative&&!relative.startsWith("..")&&!path.isAbsolute(relative));assert(!fs.existsSync(path.join(dir,"verification.json")));
  const manifest=read(path.join(dir,"manifest.json")),spec=manifest.spec;
  assert.equal(manifest.cardFile,"research-inputs/indicators/time-gating-t02-2026-09-07.json");assert.deepEqual(spec,read(path.join(root,manifest.cardFile)));
  assert.equal(spec.combinations.length,5);assert.equal(spec.expectedCounts.totalLogicalCases,64);
  for(const p of manifest.sources)assert.equal(await sha(path.join(root,p.file)),p.sha256,p.file);
  for(const p of manifest.inputs){assert.equal(await sha(path.join(root,p.file)),p.sha256);assert.equal(fs.statSync(path.join(root,p.file)).size,p.bytes);}
  const artifacts=await Promise.all(fs.readdirSync(dir).filter(f=>fs.statSync(path.join(dir,f)).isFile()).map(async file=>({file,sha256:await sha(path.join(dir,file))})));
  process.env.SIM_START=spec.indicatorSeedBarStart;process.env.SIM_END=spec.historyEnd;
  const {loadCandles1m}=await import("./hype-freerun-canonical-replay");const seed=Date.parse(spec.indicatorSeedBarStart),end=Date.parse(spec.historyEnd);
  const cs:any[]=(await loadCandles1m(spec.symbol,path.join(dir,"inputs"),end,path.join(dir,"inputs","repair.json"))).filter(c=>c.ts>=seed);
  assert.equal(cs.length,spec.expectedMinuteRows);cs.forEach((c,i)=>assert.equal(c.ts,seed+i*M));assert.equal(cs.at(-1).ts+M,end);
  const candle=(t:number)=>{const c=cs[(t-seed)/M];assert(c&&c.ts===t);return c;};
  const ref=referenceVolumeFlow(cs,15*M,"mfi",7),opportunities:number[]=[];
  for(const [t,b]of ref){const p=ref.get(t-15*M);if(p?.vfSigned!=null&&b.vfSigned!=null&&p.vfSigned>=-.8&&b.vfSigned < -.8)opportunities.push(t+15*M);}
  const results:any[]=read(path.join(dir,"results.json")),monthly:any[]=read(path.join(dir,"monthly.json")),diagnostics:any[]=read(path.join(dir,"diagnostics.json"));
  const rows=new Map<string,any>(results.map(r=>[key(r),r])),ms=new Map<string,any>(monthly.map(m=>[key(m)+"|"+m.month,m]));
  const trades=await lines(path.join(dir,"trades.jsonl")),decisions=await lines(path.join(dir,"decisions.jsonl"));assert.equal(results.length,64);assert.equal(rows.size,64);
  const ids=new Set<string>([...spec.parents.map((p:any)=>p.id),...spec.parents.map((p:any)=>`CLOCK${p.holdHours}`),...spec.combinations.flatMap((c:any)=>[c.id,`ready_${c.id}`])]);assert.equal(ids.size,16);
  let checkedTrades=0,checkedDecisions=0,checkedMonths=0;
  function metrics(r:any,ts:any[],scale=1){
    const ps=[...ts,...(r.open?[r.open]:[])],start=Date.parse(r.start),stop=Date.parse(r.end);let cursor=0,closed=0,peak=spec.initialEquity,dd=0,closeDD=0,bankrupt=false;
    for(let i=(start-seed)/M;i<(stop-seed)/M;i++){const c=cs[i];while(cursor<ps.length&&ps[cursor].exitAt!==undefined&&ps[cursor].exitAt<=c.ts)closed+=ps[cursor++].net;
      const p=ps[cursor]?.entryAt<=c.ts?ps[cursor]:null;
      const equity=(price:number)=>spec.initialEquity+scale*(closed+(p?p.qty*(price-p.entryPrice)-p.qty*(price+p.entryPrice)*spec.feeRatePerSide:0));
      const adverse=equity(c.low),e=equity(c.close);dd=Math.max(dd,100*(peak-adverse)/peak);peak=Math.max(peak,e);closeDD=Math.max(closeDD,100*(peak-e)/peak);bankrupt ||= adverse<=0;
    }return {dd,closeDD,bankrupt};
  }
  for(const r of results){
    assert(ids.has(r.id));assert(spec.windows.some((w:any)=>w.id===r.window&&w.start===r.start&&w.end===r.end));assert(spec.executionDelaysMs.includes(r.delayMs));assert.equal(r.side,"long");
    const definition=spec.combinations.find((c:any)=>c.id===(r.kind==="availability_control"?r.id.slice(6):r.id));
    if(definition){for(const f of ["holdHours","parentId","excludeStartHour","excludeEndHour"])assert.equal(r[f],definition[f]);}
    else {assert(["parent","clock"].includes(r.kind));assert.equal(r.id,`${r.kind==="clock"?"CLOCK":"MFI"}${r.holdHours}`);assert([11,12,13].includes(r.holdHours));}
    assert.equal(r.holdMs,r.holdHours*H);assert.equal(r.clockId,`CLOCK${r.holdHours}`);
    const k=key(r),ts=trades.get(k)??[],dec=decisions.get(k)??[],start=Date.parse(r.start),stop=Date.parse(r.end);
    let opp=opportunities.filter(t=>t>=start&&t<stop);
    if(r.family==="clock"){const first=Math.ceil(start/(12*H))*12*H,set=new Set<number>();for(let t=first;t<stop;t+=12*H)set.add(t);for(let t=first;t<stop;t+=r.holdMs+2*r.delayMs)set.add(t);opp=[...set].sort((a,b)=>a-b);}
    else assert.deepEqual(dec.map(d=>d.at),opp,"Independent MFI crossings");
    let free=start,occupied=0,blocked=0,pending=false;const accepted:number[]=[];
    for(const [i,t]of opp.entries()){
      const date=new Date(t),hour=date.getUTCHours()+date.getUTCMinutes()/60,pass=!definition||hour<definition.excludeStartHour||hour>=definition.excludeEndHour;
      let outcome="accepted";if(t<free){outcome="occupied";occupied++;}else if(!pass&&r.kind==="combination"){outcome="condition_false";blocked++;}
      else if(t+r.delayMs>=stop){pending=true;free=Infinity;}else {accepted.push(t);free=t+r.holdMs+2*r.delayMs;}
      if(r.family!=="clock"){const d=dec[i];checkedDecisions++;assert.equal(d.outcome,outcome);assert.equal(d.acceptedEntryAt,outcome==="accepted"?t+r.delayMs:null);
        assert.equal(d.sourceStart,t-15*M);assert.equal(d.sourceEnd,t);assert.equal(d.availableAt,t);assert.equal(d.previousStart,t-30*M);assert.equal(d.feature.timestamp,t-15*M);
        for(const [f,v]of Object.entries(ref.get(t-15*M)!)){if(v===null)assert.equal(d.feature[f],null);else near(d.feature[f],v as number,"Independent MFI "+f,1e-8);}
        if(definition){assert.equal(d.gate.pass,pass);assert.equal(d.gate.ready,true);assert.equal(d.gate.sourceStart,t);assert.equal(d.gate.sourceEnd,t);assert.equal(d.gate.availableAt,t);
          assert.equal(d.gate.expectedEnd,t);near(d.gate.value,hour,"UTC hour");assert.equal(d.gate.evidenceKind,"calendar");assert.equal(d.gate.condition,`UTC_${definition.excludeStartHour}_${definition.excludeEndHour}`);
          assert.deepEqual(d.gate.inputs,{excludeStartHour:definition.excludeStartHour,excludeEndHour:definition.excludeEndHour});}
        else assert.equal(d.gate,null);
      }
    }
    assert.deepEqual([...ts.map(t=>t.signalAt),...(r.open?[r.open.signalAt]:[])],accepted,"Independent occupancy schedule");
    assert.equal(r.rawSignals,opp.length);assert.equal(r.skippedOccupied,occupied);assert.equal(r.blockedCondition,blocked);assert.equal(r.blockedMissing,0);
    assert.equal(r.pendingAtEnd,pending||!!(r.open&&r.open.entryAt+r.holdMs<stop&&r.open.entryAt+r.holdMs+r.delayMs>=stop));
    for(const t of [...ts,...(r.open?[r.open]:[])]){
      assert.equal(t.entryAt,t.signalAt+r.delayMs);near(t.entryPrice,candle(t.entryAt).open,"Entry open",1e-10);near(t.qty*t.entryPrice,10000,"Notional");
      if(t.exitAt!==undefined){assert.equal(t.exitDecisionAt,t.entryAt+r.holdMs);assert.equal(t.exitAt,t.entryAt+r.holdMs+r.delayMs);assert(t.exitAt<stop);assert.equal(t.reason,"timeout");
        near(t.exitPrice,candle(t.exitAt).open,"Exit open",1e-10);near(t.pricePnl,t.qty*(t.exitPrice-t.entryPrice),"Gross");near(t.fees,t.qty*(t.entryPrice+t.exitPrice)*spec.feeRatePerSide,"Fees");near(t.net,t.pricePnl-t.fees,"Net");checkedTrades++;
        if(r.family!=="clock")assert.deepEqual(t.entryFeature,dec.find(d=>d.at===t.signalAt)!.feature);
      }else {near(t.markedPrice,candle(stop-M).close,"Cutoff");near(t.net,t.qty*(t.markedPrice-t.entryPrice)-t.qty*(t.markedPrice+t.entryPrice)*spec.feeRatePerSide,"Open mark");assert(t.entryAt+r.holdMs+r.delayMs>=stop);}
    }
    const st=stats(ts);for(const f of ["trades","wins","losses","winningDollars","losingDollars"])near(r[f],(st as any)[f],"Stats "+f);
    near(r.closedNet,st.net,"Closed total");near(r.net,st.net+(r.open?.net??0),"Total");near(r.openNet,r.open?.net??0,"Open net");
    const turnover=sum(ts,t=>t.qty*(t.entryPrice+t.exitPrice))+(r.open?r.open.qty*(r.open.entryPrice+r.open.markedPrice):0);
    near(r.turnoverIncludingMarkedExit,turnover,"Turnover");near(r.feesPaid,sum(ts,t=>t.fees)+(r.open?r.open.qty*r.open.entryPrice*spec.feeRatePerSide:0),"Paid fees");
    near(r.stressNet,r.net-turnover*spec.extraFixedPathCostBpsPerSide/10000,"Stress");
    near(r.exposureHours,sum(ts,t=>(t.exitAt-t.entryAt)/H)+(r.open?(stop-r.open.entryAt)/H:0),"Exposure");
    const pm=metrics(r,ts);near(r.maxAdverseDrawdownPct,pm.dd,"Minute adverse DD",1e-8);near(r.maxCloseDrawdownPct,pm.closeDD,"Close DD",1e-8);assert.equal(r.bankrupt,pm.bankrupt);
    let previous=0;
    for(let cursor=start;cursor<stop;){const date=new Date(cursor),month=date.toISOString().slice(0,7),boundary=Math.min(stop,Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1));
      const completed=ts.filter(t=>t.exitAt<boundary),held=ts.filter(t=>t.entryAt<boundary&&t.exitAt>=boundary);if(r.open?.entryAt<boundary)held.push(r.open);assert(held.length<=1);
      const mark=candle(boundary-M).close,cumulative=sum(completed,t=>t.net)+sum(held,t=>t.qty*(mark-t.entryPrice)-t.qty*(mark+t.entryPrice)*spec.feeRatePerSide);
      const m=ms.get(k+"|"+month);assert(m);near(m.markedNet,cumulative-previous,"Independent marked month");
      const exits=ts.filter(t=>new Date(t.exitAt).toISOString().slice(0,7)===month),es=stats(exits);
      for(const f of ["trades","wins","losses","winningDollars","losingDollars"])near(m[f],(es as any)[f],"Month "+f);near(m.closedNet,es.net,"Month completed net");
      previous=cumulative;cursor=boundary;checkedMonths++;
    }
    near(previous,r.net,"Months sum");near(r.deltaVsClock,r.net-rows.get(key({...r,id:r.clockId})).net,"Own-hold clock delta");
    if(r.kind==="combination"){const p=rows.get(key({...r,id:r.parentId})),a=rows.get(key({...r,id:r.availabilityId}));assert.equal(p.holdMs,r.holdMs);assert.equal(a.net,p.net);
      near(r.deltaVsParent,r.net-p.net,"Own hold delta");near(r.deltaVsAvailability,r.net-a.net,"Ready delta");near(r.ddReductionPp,p.maxAdverseDrawdownPct-r.maxAdverseDrawdownPct,"DD delta");near(r.retention,r.net/p.net,"Retention");
      const d=diagnostics.find(d=>key(d)===k),ratio=r.exposureHours/p.exposureHours,sp=metrics(p,trades.get(key(p))??[],ratio);assert(d);
      near(d.scaledParent.scale,ratio,"Scale");near(d.scaledParent.maxAdverseDrawdownPct,sp.dd,"Scaled DD");near(d.scaledParent.losingDollars,p.losingDollars*ratio,"Scaled losses");
    }
    if(checkedDecisions%100===0)console.log(`[verify] ${k}`);
  }
  assert.equal(checkedMonths,monthly.length);for(const m of monthly){near(m.markedDeltaClock,m.markedNet-ms.get(key({...m,id:m.clockId})+"|"+m.month).markedNet,"Month clock");
    if(m.kind==="combination"){near(m.markedDeltaParent,m.markedNet-ms.get(key({...m,id:m.parentId})+"|"+m.month).markedNet,"Month parent");near(m.markedDeltaAvailability,m.markedDeltaParent,"Month readiness");}}
  const attrs:any[]=read(path.join(dir,"replacement-attribution.json"));assert.equal(attrs.length,20);
  let checkedChangedTrades=0;
  for(const a of attrs){const r=rows.get(key(a)),p=rows.get(key({...a,id:r.parentId})),pt=trades.get(key(p))??[],vt=trades.get(key(r))??[],pd=decisions.get(key(p))!,vd=decisions.get(key(r))!;
    const removed=pt.filter(t=>!vt.some(x=>x.signalAt===t.signalAt)),added=vt.filter(t=>!pt.some(x=>x.signalAt===t.signalAt)),common=pt.filter(t=>vt.some(x=>x.signalAt===t.signalAt));
    const removedCalendar=removed.filter(t=>vd.find(d=>d.at===t.signalAt)!.outcome==="condition_false"),removedDisplaced=removed.filter(t=>!removedCalendar.includes(t));
    const groups:any={parent:pt,common,removed_all:removed,removed_calendar:removedCalendar,removed_displaced:removedDisplaced,newly_enabled:added,new_winners:added.filter(t=>t.net>1e-8),new_losers:added.filter(t=>t.net < -1e-8)};
    for(const [name,ts]of Object.entries(groups) as [string,any[]][])for(const [f,v]of Object.entries(stats(ts)))near(a.cohorts[name][f],v,"Cohort "+name+"/"+f);
    near(a.completedDelta,sum(added,t=>t.net)-sum(removed,t=>t.net),"Attribution completed");near(a.openDelta,(r.open?.net??0)-(p.open?.net??0),"Attribution open");near(a.totalDelta,r.net-p.net,"Attribution total");
    assert.equal(a.rows.length,removed.length+added.length);
    const contexts=new Map<number,any>();
    for(const t of [...pt,...vt]){const f=t.entryFeature,at=t.signalAt,c=candle(at-M),bars=cs.slice((at-seed)/M-15,(at-seed)/M),high=Math.max(...bars.map(x=>x.high)),low=Math.min(...bars.map(x=>x.low));
      contexts.set(at,{MFI7:ref.get(at-15*M)!.vfValue,RSI14_15m:f.rsi14,CRSI_15m:f.crsi,ADX14_15m:f.adx14,ATRpct_15m:f.atrPct,RVOL20_15m:f.rvol20,
        closed_return_15m:100*(c.close/candle(at-16*M).close-1),closed_return_1h:100*(c.close/candle(at-61*M).close-1),closed_return_4h:100*(c.close/candle(at-241*M).close-1),closed_15m_range_location:high>low?(c.close-low)/(high-low):null});}
    for(const x of a.rows){const t=(x.change==="new"?added:removed).find(t=>t.signalAt===x.signalAt);assert(t);near(x.net,t.net,"Changed net");near(x.contribution,(x.change==="new"?1:-1)*t.net,"Changed contribution");
      const opposite=x.change==="new"?p:r,os=x.change==="new"?pt:vt,ds=x.change==="new"?pd:vd,d=ds.find(d=>d.at===x.signalAt);assert(d);assert.equal(x.oppositeOutcome,d.outcome);
      const b=[...os,...(opposite.open?[opposite.open]:[])].find(t=>t.signalAt<x.signalAt&&(t.exitAt??Infinity)>x.signalAt);assert.equal(x.oppositeBlockingSignalAt,b?.signalAt??null);
      for(const [f,v]of Object.entries(contexts.get(x.signalAt)))if(v===null)assert.equal(x.entryContext[f],null);else near(x.entryContext[f],v as number,"Closed pre-entry descriptor");checkedChangedTrades++;
    }
    for(const [name,ts]of Object.entries(groups) as [string,any[]][])for(const [f,z]of Object.entries(a.descriptors[name]) as [string,any][]){const xs=ts.map(t=>contexts.get(t.signalAt)[f]).filter(v=>v!=null&&Number.isFinite(v)).sort((x,y)=>x-y);
      assert.equal(z.n,xs.length);assert.equal(z.missing,ts.length-xs.length);for(const [label,q]of [["p25",.25],["median",.5],["p75",.75]] as [string,number][]){if(!xs.length)assert.equal(z[label],null);else{const i=(xs.length-1)*q,j=Math.floor(i);near(z[label],xs[j]+(xs[Math.ceil(i)]-xs[j])*(i-j),"Descriptor distribution");}}}
    near(sum(a.episodes,e=>e.contribution),a.completedDelta,"Episode sum");assert.deepEqual(a.episodes.flatMap((e:any)=>e.signalAts).sort((x:number,y:number)=>x-y),a.rows.map((x:any)=>x.signalAt).sort((x:number,y:number)=>x-y));
    for(const e of a.episodes){const xs=a.rows.filter((x:any)=>x.episodeId===e.id).sort((x:any,y:any)=>x.signalAt-y.signalAt);assert(xs.length);let until=xs[0].exitAt;for(const x of xs.slice(1)){assert(x.signalAt<until,"Disconnected episode");until=Math.max(until,x.exitAt);}assert.equal(e.start,xs[0].signalAt);assert.equal(e.end,until);near(e.contribution,sum(xs,x=>x.contribution),"Episode contribution");}
    const best=[...a.episodes].sort((x,y)=>y.contribution-x.contribution);near(a.withoutBestEpisodeDelta,a.totalDelta-(best[0]?.contribution??0),"Without best episode");near(a.withoutBestThreeEpisodesDelta,a.totalDelta-sum(best.slice(0,3),x=>x.contribution),"Without best three episodes");
    near(a.withoutTopThreeNewWinnersDelta,a.totalDelta-a.cohorts.newly_enabled.top3WinningDollars,"Without new best three");
    for(const m of a.signalMonthContributions){const xs=a.rows.filter((x:any)=>new Date(x.signalAt).toISOString().slice(0,7)===m.month);near(m.contribution,sum(xs,x=>x.contribution),"Signal month attribution");}
    near(sum(a.signalMonthContributions,m=>m.contribution),a.completedDelta,"Signal months sum");
  }
  const ranking:any[]=read(path.join(dir,"ranking.json"));assert.equal(ranking.length,5);
  for(const rank of ranking){const xs=results.filter(r=>r.id===rank.id),ms=monthly.filter(m=>m.id===rank.id);assert.equal(xs.length,4);
    const common=xs.every(r=>r.trades>=(r.window==="full"?30:10)&&r.net>0&&r.stressNet>0&&!r.bankrupt)&&ms.every(m=>m.markedDeltaParent>=-320-1e-8&&m.markedDeltaAvailability>=-320-1e-8);
    const profit=common&&xs.every(r=>r.deltaVsParent>=(r.window==="full"?500:200)-1e-8&&r.ddReductionPp>=-1e-8);
    const defense=common&&xs.every(r=>{const p=rows.get(key({...r,id:r.parentId})),d=diagnostics.find(d=>key(d)===key(r));return p.net>0&&r.net>=.9*p.net-1e-8&&Math.abs(r.losingDollars)<Math.abs(p.losingDollars)-1e-8
      &&(r.window==="full"?r.maxAdverseDrawdownPct<=.8*p.maxAdverseDrawdownPct+1e-8&&r.ddReductionPp>=1-1e-8:r.ddReductionPp>=-1e-8)
      &&r.maxAdverseDrawdownPct<d.scaledParent.maxAdverseDrawdownPct-1e-8&&Math.abs(r.losingDollars)<Math.abs(d.scaledParent.losingDollars)-1e-8;});
    const strict=xs.every(r=>r.trades>=(r.window==="full"?30:10)&&r.net>0&&r.stressNet>0&&!r.bankrupt&&r.deltaVsClock>0)&&ms.every(m=>m.markedDeltaClock>=-1e-8);
    assert.equal(rank.profitPass,profit);assert.equal(rank.defensivePass,defense);assert.equal(rank.strictPass,strict);
    near(rank.profitRank,Math.min(...xs.filter(r=>r.window==="full").map(r=>r.deltaVsParent)),"Ranking");
  }
  const parity=read(path.join(dir,"overlap-parity.json"));assert.equal(parity.length,12);assert(parity.every((p:any)=>p.exact));
  const shortlist=read(path.join(dir,"shortlist.json"));for(const [field,pass]of [["profitIds","profitPass"],["defensiveIds","defensivePass"],["strictIds","strictPass"]])assert.deepEqual([...shortlist[field]].sort(),ranking.filter(r=>r[pass]).map(r=>r.id).sort());
  for(const p of artifacts)assert.equal(await sha(path.join(dir,p.file)),p.sha256);for(const p of manifest.sources)assert.equal(await sha(path.join(root,p.file)),p.sha256);
  fs.writeFileSync(path.join(dir,"verification.json"),JSON.stringify({passed:true,verifiedAt:new Date().toISOString(),checkedCases:64,checkedTrades,checkedDecisions,checkedMonths,checkedChangedTrades,
    independentMfiMath:true,independentSchedulingAndUtcBoundaries:true,independentMinuteDdFeesAndMonthlies:true,independentAttributionAndScreens:true,
    descriptorNote:"New closed-price descriptors and MFI independently rebuilt; other existing entry-feature descriptors reconciled to pinned archived feature implementation, not newly reimplemented here.",
    verifier:{file:path.relative(root,__filename).replace(/\\/g,"/"),sha256:await sha(__filename)},artifacts},null,2)+"\n",{flag:"wx"});
  console.log(`[verified] 64 cases; ${checkedTrades} trades; ${checkedDecisions} decisions; ${checkedMonths} month rows; ${checkedChangedTrades} changed trades`);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
