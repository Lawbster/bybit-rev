/** Independent C02/T01 verifier (frozen C01 verifier unchanged): no combination/parent strategy engines imported.
 * Uses separate batch indicator math, opportunity scheduling, ledger accounting,
 * month-end inventory and full minute equity reconstruction.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { referenceFeatures, referenceCross, referenceGate } from "./indicator-entry-context-reference";
const root=path.resolve(__dirname,".."),M=60_000,H=60*M;
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const key=(r:any)=>`${r.window}|${r.delayMs}|${r.id}`;
const total=(xs:any[],f:(x:any)=>number)=>xs.reduce((s,x)=>s+f(x),0);
const near=(a:any,b:number,label:string,e=1e-6)=>assert(typeof a==="number"&&Number.isFinite(a)&&Math.abs(a-b)<=e,`${label}: ${a} != ${b}`);
async function sha(p:string){const h=crypto.createHash("sha256");for await(const b of fs.createReadStream(p))h.update(b);return h.digest("hex");}
async function lines(file:string){const out=new Map<string,any[]>();for await(const l of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})){
  if(!l.trim())continue;const r=JSON.parse(l),k=key(r);if(!out.has(k))out.set(k,[]);out.get(k)!.push(r);}return out;}
async function main(){
  assert.equal(process.argv.length,3,"Pass the C02/T01 artifact directory");const dir=path.resolve(root,process.argv[2]);
  const relative=path.relative(path.join(root,"backtests"),dir);assert(relative&&!relative.startsWith("..")&&!path.isAbsolute(relative));
  const destination=path.join(dir,"verification.json");assert(!fs.existsSync(destination),"Never overwrite accepted verification");
  const manifest=read(path.join(dir,"manifest.json")),spec=manifest.spec,counts=spec.expectedCounts;
  assert(["c02","t01"].includes(spec.study));
  const expectedCard="research-inputs/indicators/"+(spec.study==="c02"?"combinations-c02":"time-gating-t01")+"-2026-09-07.json";
  assert.equal(manifest.cardFile,expectedCard);assert.deepEqual(spec,read(path.join(root,expectedCard)));
  assert.equal(spec.combinations.length,counts.definitions);assert.equal(manifest.actualPrimaryCases,counts.primaryCases);assert.equal(manifest.availabilityLogicalCases,counts.readinessCases);
  for(const p of manifest.sources)assert.equal(await sha(path.join(root,p.file)),p.sha256,p.file);
  for(const p of manifest.inputRecovery){assert.equal(await sha(path.join(root,p.effectiveFile)),p.sha256,p.effectiveFile);assert.equal(fs.statSync(path.join(root,p.effectiveFile)).size,p.pinnedBytes);}
  const artifactNames=fs.readdirSync(dir).filter(f=>fs.statSync(path.join(dir,f)).isFile());
  const hashes=await Promise.all(artifactNames.map(async file=>({file,sha256:await sha(path.join(dir,file))})));
  const results:any[]=read(path.join(dir,"results.json")),monthly:any[]=read(path.join(dir,"monthly.json")),diagnostics:any[]=read(path.join(dir,"diagnostics.json"));
  assert.equal(results.length,counts.totalLogicalCases);assert.equal(diagnostics.length,counts.definitions*4);const rows=new Map(results.map(r=>[key(r),r]));assert.equal(rows.size,counts.totalLogicalCases);
  const ds=new Map(diagnostics.map(d=>[key(d),d])),ms=new Map(monthly.map(m=>[`${key(m)}|${m.month}`,m]));assert.equal(ms.size,monthly.length);
  const trades=await lines(path.join(dir,"trades.jsonl")),decisions=await lines(path.join(dir,"decisions.jsonl"));
  for(const k of [...trades.keys(),...decisions.keys()])assert(rows.has(k),`Unknown artifact case ${k}`);
  process.env.SIM_START=spec.indicatorSeedBarStart;process.env.SIM_END=spec.historyEnd;
  const {loadCandles1m}=await import("./hype-freerun-canonical-replay");
  const seed=Date.parse(spec.indicatorSeedBarStart),end=Date.parse(spec.historyEnd),inputDir=path.join(dir,"inputs");
  const cs=(await loadCandles1m(spec.symbol,inputDir,end,path.join(inputDir,path.basename(spec.repairFile)))).filter(c=>c.ts>=seed);
  assert.equal(cs.length,spec.expectedMinuteRows);cs.forEach((c,i)=>assert.equal(c.ts,seed+i*M));
  const candle=(t:number)=>{assert(Number.isSafeInteger(t)&&t%M===0);const c=cs[(t-seed)/M];assert(c&&c.ts===t);return c;};
  const refs=referenceFeatures(cs),ruleMap=new Map<string,any>(manifest.rules.map((r:any)=>[r.id,r]));
  const expectedIds=new Set([...manifest.rules.map((r:any)=>r.id),...spec.combinations.flatMap((c:any)=>[c.id,`ready_${c.id}`])]);assert.equal(expectedIds.size,counts.totalLogicalCases/4);
  const oppCache=new Map<string,number[]>();
  for(const r of manifest.rules){if(r.family==="clock")continue;const ref=refs.get(r),xs:number[]=[];
    for(const [t,b]of ref)if(referenceCross(r,ref.get(t-r.timeframeMs),b))xs.push(t+r.timeframeMs);oppCache.set(r.id,xs);
  }
  let checkedTrades=0,checkedMonths=0,checkedDecisions=0;
  const reconstructed=new Map<string,any>();
  function pathMetrics(r:any,ts:any[],scale:number){
    const start=Date.parse(r.start),stop=Date.parse(r.end),s=r.side==="long"?1:-1,ps=[...ts,...(r.open?[r.open]:[])];
    let cursor=0,closed=0,peak=spec.initialEquity,adverseDD=0,closeDD=0,exhausted=false,peakAt=start,ddAt:number|null=null,ddPeakAt=start,worst:any=null;
    for(let i=(start-seed)/M;i<(stop-seed)/M;i++){
      const c=cs[i];while(cursor<ps.length&&ps[cursor].exitAt!==undefined&&ps[cursor].exitAt<=c.ts){closed+=ps[cursor++].net;}
      const p=ps[cursor]?.entryAt<=c.ts?ps[cursor]:null;
      const at=(price:number)=>spec.initialEquity+scale*(closed+(p?s*p.qty*(price-p.entryPrice)-p.qty*(p.entryPrice+price)*spec.feeRatePerSide:0));
      const adversePrice=s===1?c.low:c.high,a=at(adversePrice),e=at(c.close),dd=100*(peak-a)/peak;
      if(dd>adverseDD){adverseDD=dd;ddAt=c.ts;ddPeakAt=peakAt;}if(e>peak){peak=e;peakAt=c.ts;}closeDD=Math.max(closeDD,100*(peak-e)/peak);exhausted ||= a<=0;
      if(p){const move=s*(adversePrice/p.entryPrice-1)*100;if(!worst||move<worst.grossMovePct)worst={signalAt:p.signalAt,entryAt:p.entryAt,at:c.ts,entryPrice:p.entryPrice,adversePrice,
        grossMovePct:move,grossDollars:scale*s*p.qty*(adversePrice-p.entryPrice),closedNet:p.exitAt===undefined?null:p.net*scale};}
    }
    return {maxAdverseDrawdownPct:adverseDD,maxCloseDrawdownPct:closeDD,bankrupt:exhausted,ddAt,ddPeakAt,worst};
  }
  for(const r of results){
    assert(expectedIds.has(r.id));assert(spec.windows.some((w:any)=>w.id===r.window&&w.start===r.start&&w.end===r.end));assert(spec.executionDelaysMs.includes(r.delayMs));
    const k=key(r),start=Date.parse(r.start),stop=Date.parse(r.end),s=r.side==="long"?1:-1,ts=trades.get(k)??[],dec=decisions.get(k)??[];
    const rule=ruleMap.get(r.sourceParentId??r.id);assert(rule);for(const f of ["family","side","exit","timeframeMs","upper","period","threshold","mode","reference","fastPeriod","slowPeriod","signalPeriod","lookbackBars","magnitudePct","multiplier"])assert.deepEqual(r[f],rule[f],`${k} rule ${f}`);
    if(r.kind==="combination"||r.kind==="availability_control"){
      const id=r.kind==="combination"?r.id:r.id.slice(6),def=spec.combinations.find((c:any)=>c.id===id);assert(def);
      assert.equal(r.conditionId,def.condition);assert.equal(r.anchorId,def.anchor);assert.equal(r.sourceParentId,spec.anchors.find((a:any)=>a.id===def.anchor).parentId);
    }
    let opportunities:number[];
    if(r.family==="clock"){
      const xs=new Set<number>();const first=Math.ceil(start/(12*H))*12*H;
      for(let t=first;t<stop;t+=12*H)xs.add(t);for(let t=first;t<stop;t+=spec.holdMs+2*r.delayMs)xs.add(t);opportunities=[...xs].sort((a,b)=>a-b);
    }else opportunities=oppCache.get(rule.id)!.filter(t=>t>=start&&t<stop);
    if(r.family!=="clock"){assert.deepEqual(dec.map(d=>d.at),opportunities,`${k} every independent A crossing`);}
    let freeAt=start,occupied=0,missing=0,blocked=0,pendingEntry=false;const accepted:number[]=[];
    for(const [i,t]of opportunities.entries()){
      const g=r.conditionId?referenceGate(r.conditionId,r.side,t,refs,spec.anchors.find((a:any)=>a.id===r.anchorId)!.role):null;
      let outcome="accepted";
      if(t<freeAt){occupied++;outcome="occupied";}else if(g&&!g.ready){missing++;outcome="missing_context";}
      else if(g&&r.kind==="combination"&&!g.pass){blocked++;outcome="condition_false";}
      else if(t+r.delayMs>=stop){pendingEntry=true;freeAt=Infinity;}else{accepted.push(t);freeAt=t+spec.holdMs+2*r.delayMs;}
      if(r.family!=="clock"){
        const d=dec[i];checkedDecisions++;assert.equal(d.outcome,outcome);assert.equal(d.acceptedEntryAt,outcome==="accepted"?t+r.delayMs:null);
        assert.equal(d.sourceStart,t-rule.timeframeMs);assert.equal(d.sourceEnd,t);assert.equal(d.availableAt,t);assert.equal(d.previousStart,t-2*rule.timeframeMs);
        assert.equal(d.feature.timestamp,d.sourceStart);const ref=refs.get(rule).get(d.sourceStart)!;
        for(const f of Object.keys(ref)){if(ref[f]===null)assert.equal(d.feature[f],null,`${k} ${f}`);else near(d.feature[f],ref[f],`${k} reference feature ${f}`,1e-8);}
        if(g){assert(d.gate);assert.equal(d.gate.sourceStart,g.start);assert.equal(d.gate.sourceEnd,g.end);assert.equal(d.gate.expectedEnd,g.end);assert.equal(d.gate.availableAt,g.end);
          assert.equal(d.gate.ready,g.ready);assert.equal(d.gate.pass,g.pass);assert.equal(d.gate.dayStart,g.dayStart);assert.equal(d.gate.condition,r.conditionId);
          assert.equal(d.gate.previousEnd,g.previousEnd);assert.equal(d.gate.evidenceKind,g.evidenceKind);
          for(const [f,x]of Object.entries(g.inputs)){if(x===null)assert.equal(d.gate.inputs[f],null);else near(d.gate.inputs[f],x as number,"gate input "+f,1e-8);}
          if(g.value===null)assert.equal(d.gate.value,null);else near(d.gate.value,g.value,`${k} B value`,1e-8);
        }else assert.equal(d.gate,null);
      }
    }
    assert.equal(r.rawSignals,opportunities.length);assert.equal(r.skippedOccupied,occupied);assert.equal(r.blockedMissing,missing);assert.equal(r.blockedCondition,blocked);
    assert.deepEqual([...ts.map(t=>t.signalAt),...(r.open?[r.open.signalAt]:[])],accepted,`${k} every eligible flat entry`);
    const expectedPendingExit=!!r.open&&r.open.entryAt+spec.holdMs<stop&&r.open.entryAt+spec.holdMs+r.delayMs>=stop;
    assert.equal(r.pendingAtEnd,pendingEntry||expectedPendingExit);
    for(const t of [...ts,...(r.open?[r.open]:[])]){
      assert.equal(t.entryAt,t.signalAt+r.delayMs);near(t.entryPrice,candle(t.entryAt).open,`${k} entry price`,1e-10);near(t.qty*t.entryPrice,spec.notionalUsdt,`${k} notional`);
      if(t.exitAt!==undefined){assert.equal(t.exitDecisionAt,t.entryAt+spec.holdMs);assert.equal(t.exitAt,t.exitDecisionAt+r.delayMs);assert(t.exitAt<stop);assert.equal(t.reason,"timeout");assert.equal(t.side,r.side);
        near(t.exitPrice,candle(t.exitAt).open,`${k} exit price`,1e-10);near(t.pricePnl,s*t.qty*(t.exitPrice-t.entryPrice),`${k} gross`);
        near(t.fees,t.qty*(t.entryPrice+t.exitPrice)*spec.feeRatePerSide,`${k} fees`);near(t.net,t.pricePnl-t.fees,`${k} trade net`);checkedTrades++;
        if(r.family!=="clock")assert.deepEqual(t.entryFeature,dec.find(d=>d.at===t.signalAt)!.feature);
      }else{near(t.markedPrice,candle(stop-M).close,`${k} cutoff mark`);near(t.net,s*t.qty*(t.markedPrice-t.entryPrice)-t.qty*(t.entryPrice+t.markedPrice)*spec.feeRatePerSide,`${k} open net`);assert(t.entryAt+spec.holdMs+r.delayMs>=stop);}
    }
    const closed=total(ts,t=>t.net),net=closed+(r.open?.net??0),wins=ts.filter(t=>t.net>1e-8),losses=ts.filter(t=>t.net < -1e-8);
    assert.equal(r.trades,ts.length);assert.equal(r.wins,wins.length);assert.equal(r.losses,losses.length);assert.equal(r.breakeven,ts.length-wins.length-losses.length);
    near(r.winningDollars,total(wins,t=>t.net),`${k} winning dollars`);near(r.losingDollars,total(losses,t=>t.net),`${k} losing dollars`);
    near(r.closedNet,closed,`${k} closed`);near(r.openNet,r.open?.net??0,`${k} open`);near(r.net,net,`${k} net`);
    const turnover=total(ts,t=>t.qty*(t.entryPrice+t.exitPrice))+(r.open?r.open.qty*(r.open.entryPrice+r.open.markedPrice):0);
    near(r.turnoverIncludingMarkedExit,turnover,`${k} turnover`);near(r.stressNet,net-turnover*spec.extraFixedPathCostBpsPerSide/10000,`${k} stress`);
    near(r.feesPaid,total(ts,t=>t.fees)+(r.open?r.open.qty*r.open.entryPrice*spec.feeRatePerSide:0),`${k} actual fees`);
    const exposure=total(ts,t=>(t.exitAt-t.entryAt)/H)+(r.open?(stop-r.open.entryAt)/H:0);near(r.exposureHours,exposure,`${k} exposure`);
    const pm=pathMetrics(r,ts,1);near(r.maxAdverseDrawdownPct,pm.maxAdverseDrawdownPct,`${k} minute adverse DD`,1e-8);near(r.maxCloseDrawdownPct,pm.maxCloseDrawdownPct,`${k} close DD`,1e-8);assert.equal(r.bankrupt,pm.bankrupt);
    let previous=0;
    for(let cursor=start;cursor<stop;){
      const date=new Date(cursor),month=date.toISOString().slice(0,7),boundary=Math.min(stop,Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1));
      const mark=candle(boundary-M).close,completed=ts.filter(t=>t.exitAt<boundary),held=ts.filter(t=>t.entryAt<boundary&&t.exitAt>=boundary);
      if(r.open?.entryAt<boundary)held.push(r.open);assert(held.length<=1);
      const cumulative=total(completed,t=>t.net)+total(held,t=>s*t.qty*(mark-t.entryPrice)-t.qty*(t.entryPrice+mark)*spec.feeRatePerSide);
      const m=ms.get(`${k}|${month}`);assert(m);checkedMonths++;near(m.markedNet,cumulative-previous,`${k} ${month} marked month`);
      const exits=ts.filter(t=>new Date(t.exitAt).toISOString().slice(0,7)===month),entries=[...ts,...(r.open?[r.open]:[])].filter(t=>new Date(t.entryAt).toISOString().slice(0,7)===month);
      assert.equal(m.trades,exits.length);assert.equal(m.wins,exits.filter(t=>t.net>1e-8).length);assert.equal(m.losses,exits.filter(t=>t.net < -1e-8).length);assert.equal(m.breakeven,m.trades-m.wins-m.losses);
      near(m.winningDollars,total(exits,t=>Math.max(0,t.net)),`${k} month wins`);near(m.losingDollars,total(exits,t=>Math.min(0,t.net)),`${k} month losses`);
      near(m.closedNet,total(exits,t=>t.net),`${k} month closed`);near(m.feesPaid,spec.feeRatePerSide*(total(exits,t=>t.qty*t.exitPrice)+total(entries,t=>t.qty*t.entryPrice)),`${k} month fees`);
      previous=cumulative;cursor=boundary;
    }
    near(previous,net,`${k} months sum`);
    if(r.kind==="combination"){
      const d=ds.get(k)!;for(const f of ["maxAdverseDrawdownPct","maxCloseDrawdownPct"])near(d[f],(pm as any)[f],`${k} diagnostic ${f}`,1e-8);
      assert.equal(d.ddAt,pm.ddAt);assert.equal(d.ddPeakAt,pm.ddPeakAt);assert.deepEqual(d.worst,pm.worst);
      const p=rows.get(key({...r,id:r.parentId}))!,a=rows.get(key({...r,id:r.availabilityId}))!,at=trades.get(key(a))??[];
      const ratio=a.exposureHours>0?exposure/a.exposureHours:null;
      if(ratio===null)assert.equal(d.scaledParent,null);else{
        near(d.scaledParent.scale,ratio,`${k} exposure scale`);const pp=pathMetrics(a,at,ratio);
        near(d.scaledParent.maxAdverseDrawdownPct,pp.maxAdverseDrawdownPct,`${k} rescaled DD`,1e-8);near(d.scaledParent.losingDollars,a.losingDollars*ratio,`${k} rescaled losses`);
      }
      const pt=trades.get(key(p))??[],pa=new Set(pt.map(t=>t.signalAt)),va=new Set(ts.map(t=>t.signalAt)),removed=pt.filter(t=>!va.has(t.signalAt)),added=ts.filter(t=>!pa.has(t.signalAt));
      assert.deepEqual(d.attribution.removedSignalAts,removed.map(t=>t.signalAt));assert.deepEqual(d.attribution.newlyEnabledSignalAts,added.map(t=>t.signalAt));
      near(d.attribution.sacrificedWinningDollars,total(removed,t=>Math.max(0,t.net)),`${k} sacrificed wins`);near(d.attribution.avoidedLosingDollars,-total(removed,t=>Math.min(0,t.net)),`${k} avoided losses`);
      near(d.attribution.newlyEnabledNet,total(added,t=>t.net),`${k} new occupancy net`);near(d.attribution.removedNet,total(removed,t=>t.net),`${k} removed net`);
      near(r.deltaVsParent,r.net-p.net,`${k} parent delta`);near(r.deltaVsAvailability,r.net-a.net,`${k} ready delta`);near(r.retention,Math.min(r.net/p.net,r.net/a.net),`${k} retention`);near(r.ddReductionPp,a.maxAdverseDrawdownPct-r.maxAdverseDrawdownPct,`${k} DD reduction`);
      near(ts.filter(t=>!pa.has(t.signalAt)).length,d.attribution.newlyEnabledCount,`${k} enabled count`);
      const top5=total(ts.filter(t=>t.net>0).sort((x,y)=>y.net-x.net).slice(0,5),t=>t.net);near(d.top5WinningDollars,top5,`${k} winner concentration`);
      if(closed>0)near(d.top5PctClosedNet,100*top5/closed,`${k} winner concentration percent`);
    }
    if(r.kind!=="clock")near(r.deltaVsClock,net-rows.get(key({...r,id:`clock_${r.side}`}))!.net,`${k} clock delta`);
    reconstructed.set(k,{net,pm});if(reconstructed.size%32===0)console.log(`[verify] ${reconstructed.size}/${counts.totalLogicalCases} cases; independent crossings/gates, ledgers and minute paths checked`);
  }
  assert.equal(checkedMonths,monthly.length);
  for(const m of monthly){
    near(m.markedDeltaClock,m.markedNet-ms.get(`${key({...m,id:`clock_${m.side}`})}|${m.month}`)!.markedNet,"monthly clock delta");
    if(m.kind==="combination"){
      near(m.parentMarkedNet,ms.get(`${key({...m,id:m.parentId})}|${m.month}`)!.markedNet,"parent month");near(m.markedDeltaParent,m.markedNet-m.parentMarkedNet,"parent month delta");
      near(m.availabilityMarkedNet,ms.get(`${key({...m,id:m.availabilityId})}|${m.month}`)!.markedNet,"ready month");near(m.markedDeltaAvailability,m.markedNet-m.availabilityMarkedNet,"ready month delta");
    }
  }
  // Independently apply approved numeric budgets; do not call ranking helper.
  const ranking=read(path.join(dir,"ranking.json")),shortlist=read(path.join(dir,"shortlist.json"));assert.equal(ranking.length,counts.definitions);
  for(const rank of ranking){
    const xs=results.filter(r=>r.id===rank.id),months=monthly.filter(m=>m.id===rank.id);assert.equal(xs.length,4);
    const common=xs.every(r=>r.trades>=(r.window==="full"?30:10)&&r.net>0&&r.stressNet>0&&!r.bankrupt)&&months.every(m=>m.markedDeltaParent>=-320-1e-8&&m.markedDeltaAvailability>=-320-1e-8);
    const profit=common&&xs.every(r=>Math.min(r.deltaVsParent,r.deltaVsAvailability)>=(r.window==="full"?500:200)-1e-8&&r.ddReductionPp>=-1e-8);
    const defense=common&&xs.every(r=>{
      const a=rows.get(key({...r,id:r.availabilityId}))!,p=rows.get(key({...r,id:r.parentId}))!,scaled=ds.get(key(r))!.scaledParent;
      return a.net>0&&p.net>0&&r.net>=.9*a.net-1e-8&&r.net>=.9*p.net-1e-8&&Math.abs(r.losingDollars)<Math.abs(a.losingDollars)-1e-8&&Math.abs(r.losingDollars)<Math.abs(p.losingDollars)-1e-8
        &&(r.window==="full"?r.maxAdverseDrawdownPct<=.8*a.maxAdverseDrawdownPct+1e-8&&r.ddReductionPp>=1-1e-8:r.ddReductionPp>=-1e-8)
        &&scaled&&r.maxAdverseDrawdownPct<scaled.maxAdverseDrawdownPct-1e-8&&Math.abs(r.losingDollars)<Math.abs(scaled.losingDollars)-1e-8;
    });
    const strict=xs.every(r=>r.trades>=(r.window==="full"?30:10)&&r.net>0&&r.deltaVsClock>0&&r.stressNet>0&&!r.bankrupt)&&months.every(m=>m.markedDeltaClock>=-1e-8);
    assert.equal(rank.profitPass,profit);assert.equal(rank.defensivePass,defense);assert.equal(rank.strictPass,strict);
    near(rank.profitRank,Math.min(...xs.filter(r=>r.window==="full").flatMap(r=>[r.deltaVsParent,r.deltaVsAvailability])),"profit rank");
    near(rank.defensiveRank,Math.min(...xs.filter(r=>r.window==="full").map(r=>r.ddReductionPp)),"defensive rank");
  }
  const pSort=(a:any,b:any)=>b.profitRank-a.profitRank||b.minRecentNet-a.minRecentNet||a.id.localeCompare(b.id),dSort=(a:any,b:any)=>b.defensiveRank-a.defensiveRank||b.minRecentNet-a.minRecentNet||a.id.localeCompare(b.id);
  assert.deepEqual(ranking,[...ranking].sort(pSort));assert.deepEqual(shortlist.profitIds,ranking.filter((r:any)=>r.profitPass).sort(pSort).map((r:any)=>r.id));
  assert.deepEqual(shortlist.defensiveIds,ranking.filter((r:any)=>r.defensivePass).sort(dSort).map((r:any)=>r.id));assert.deepEqual(shortlist.strictIds,ranking.filter((r:any)=>r.strictPass).map((r:any)=>r.id));
  const parity=read(path.join(dir,"overlap-parity.json"));assert.equal(parity.length,counts.repeatedCases);assert(parity.every((p:any)=>p.exactSavedLedgerStatsMonths));
  const availability=read(path.join(dir,"availability-controls.json"));assert.equal(availability.length,counts.readinessCases);
  for(const a of availability)if(a.reusedParent){const r=rows.get(key(a))!,p=rows.get(key({...a,id:a.reusedParent}))!;for(const f of ["net","trades","rawSignals","skippedOccupied","maxAdverseDrawdownPct","open","pendingAtEnd"])assert.deepEqual(r[f],p[f]);assert.equal(r.blockedMissing,0);}
  if(spec.calendarAudit){
    // Independently reconstruct calendar denominators from accepted inventory
    // and already independently enumerated A crossings; never call the report helper.
    const actual=read(path.join(dir,"calendar-descriptive.json")),expected=new Map<string,any>();
    function bucket(t:number){return["utc4h_"+Math.floor((t%(24*H))/(4*H)),[0,6].includes(new Date(t).getUTCDay())?"weekend":"weekday"];}
    for(const r of results.filter(r=>r.kind==="parent_or_component")){
      const k=key(r),ts=trades.get(k)??[],ps=[...ts,...(r.open?[r.open]:[])],start=Date.parse(r.start),stop=Date.parse(r.end);
      function group(t:number,fn:(x:any)=>void){
        for(const scope of ["all",new Date(t).toISOString().slice(0,7)])for(const b of bucket(t)){
          const id=k+"|"+scope+"|"+b;
          if(!expected.has(id))expected.set(id,{id:r.id,window:r.window,delayMs:r.delayMs,scope,bucket:b,marketHours:0,decisionSlots:0,
            opportunities:0,acceptedSignals:0,filledEntries:0,pendingEntries:0,occupiedSignals:0,completedTrades:0,wins:0,losses:0,
            winningDollars:0,losingDollars:0,closedNet:0,openNet:0,exitTrades:0,exitNet:0,exposureClockHours:0,exposureOriginHours:0});
          fn(expected.get(id));
        }
      }
      let cursor=0;
      for(let t=start;t<stop;t+=M){while(cursor<ps.length&&ps[cursor].exitAt!==undefined&&ps[cursor].exitAt<=t)cursor++;
        const held=ps[cursor]?.entryAt<=t;
        group(t,x=>{x.marketHours+=1/60;x.decisionSlots+=Number(t%r.timeframeMs===0);x.exposureClockHours+=held?1/60:0;});
      }
      let free=start;const entries=new Set(ps.map(p=>p.signalAt));
      for(const t of oppCache.get(r.id)!.filter(t=>t>=start&&t<stop)){
        const occupied=t<free;if(!occupied)free=t+r.delayMs>=stop?Infinity:t+spec.holdMs+2*r.delayMs;
        group(t,x=>{x.opportunities++;if(occupied)x.occupiedSignals++;else{x.acceptedSignals++;if(entries.has(t))x.filledEntries++;else x.pendingEntries++;}});
      }
      for(const p of ps){
        group(p.signalAt,x=>{x.exposureOriginHours+=((p.exitAt??stop)-p.entryAt)/H;
          if(p.exitAt===undefined)x.openNet+=p.net;else{x.completedTrades++;x.closedNet+=p.net;x.wins+=Number(p.net>1e-8);x.losses+=Number(p.net < -1e-8);
            x.winningDollars+=Math.max(0,p.net);x.losingDollars+=Math.min(0,p.net);}});
        if(p.exitAt!==undefined)group(p.exitAt,x=>{x.exitTrades++;x.exitNet+=p.net;});
      }
    }
    assert.equal(actual.length,expected.size);
    for(const a of actual){const e=expected.get(key(a)+"|"+a.scope+"|"+a.bucket);assert(e);
      for(const f of Object.keys(e))if(typeof e[f]==="number")near(a[f],e[f],"calendar "+f);else assert.equal(a[f],e[f]);
      near(a.signalOriginNet,e.closedNet+e.openNet,"calendar net");
      if(e.opportunities){near(a.entryAcceptanceRate,e.acceptedSignals/e.opportunities,"calendar acceptance");near(a.occupiedRate,e.occupiedSignals/e.opportunities,"calendar occupied");}
      else{assert.equal(a.entryAcceptanceRate,null);assert.equal(a.occupiedRate,null);}
    }
    console.log("[verify] "+actual.length+" independent calendar denominator/outcome rows passed");
  }
  for(const p of manifest.sources)assert.equal(await sha(path.join(root,p.file)),p.sha256);
  for(const p of hashes)assert.equal(await sha(path.join(dir,p.file)),p.sha256);
  fs.writeFileSync(destination,JSON.stringify({version:1,passed:true,verifiedAt:new Date().toISOString(),checkedCases:counts.totalLogicalCases,checkedTrades,checkedMonths,checkedDecisions,
    independentlyReconstructedFeatures:true,independentOpportunityEnumeration:true,independentMinuteAccounting:true,independentResearchScreens:true,
    verifier:{file:path.relative(root,__filename).replace(/\\/g,"/"),sha256:await sha(__filename)},artifacts:hashes,
    limitations:["Historical modeled publication; windows previously mined and overlapping","Before funding; no live/ladder/portfolio or liquidation certification","Archived parent engine parity reported separately; this verifier independently reconstructs their features/opportunities/accounting"]},null,2)+"\n",{flag:"wx"});
  console.log(`[verified] ${checkedTrades} trade rows, ${checkedDecisions} crossing rows, ${checkedMonths} month rows; all${counts.totalLogicalCases} cases passed`);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
