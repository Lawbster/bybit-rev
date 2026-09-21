/** Independent R01 verifier: batch reference math, scheduling, accounting and screens. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { referenceFeatures, referenceCross } from "./indicator-entry-context-reference";
const root=path.resolve(__dirname,".."),M=60_000,H=60*M,D=24*H;
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8")),key=(r:any)=>`${r.window}|${r.delayMs}|${r.id}`;
const sum=(xs:any[],f:(x:any)=>number)=>xs.reduce((s,x)=>s+f(x),0);
const near=(x:any,y:number,label:string,eps=1e-6)=>assert(typeof x==="number"&&Number.isFinite(x)&&Math.abs(x-y)<=eps,`${label}: ${x} != ${y}`);
async function sha(p:string){const h=crypto.createHash("sha256");for await(const b of fs.createReadStream(p))h.update(b);return h.digest("hex");}
async function lines(p:string){const out=new Map<string,any[]>();for await(const l of readline.createInterface({input:fs.createReadStream(p),crlfDelay:Infinity})){
  if(!l.trim())continue;const r=JSON.parse(l),k=key(r);if(!out.has(k))out.set(k,[]);out.get(k)!.push(r);}return out;}
function wl(xs:any[]){return {trades:xs.length,wins:xs.filter(x=>x.net>1e-8).length,losses:xs.filter(x=>x.net < -1e-8).length,
  breakeven:xs.filter(x=>Math.abs(x.net)<=1e-8).length,winningDollars:sum(xs,x=>Math.max(0,x.net)),losingDollars:sum(xs,x=>Math.min(0,x.net)),closedNet:sum(xs,x=>x.net)};}
async function main(){
  assert.equal(process.argv.length,3);const dir=path.resolve(root,process.argv[2]),relative=path.relative(path.join(root,"backtests"),dir);assert(relative&&!relative.startsWith("..")&&!path.isAbsolute(relative));
  assert(!fs.existsSync(path.join(dir,"verification.json")));const man=read(path.join(dir,"manifest.json")),spec=man.spec;assert.deepEqual(spec,read(path.join(root,man.cardFile)));
  assert.equal(spec.id,"hype-indicator-refinement-r01-2026-09-07");assert.equal(spec.combinations.length,9);
  const artifacts=await Promise.all(fs.readdirSync(dir).filter(f=>fs.statSync(path.join(dir,f)).isFile()).map(async file=>({file,sha256:await sha(path.join(dir,file))})));
  for(const p of man.sources)assert.equal(await sha(path.join(root,p.file)),p.sha256);for(const p of man.inputs){assert.equal(await sha(path.join(root,p.file)),p.sha256);assert.equal(fs.statSync(path.join(root,p.file)).size,p.bytes);}
  process.env.SIM_START=spec.indicatorSeedBarStart;process.env.SIM_END=spec.historyEnd;const seed=Date.parse(spec.indicatorSeedBarStart),end=Date.parse(spec.historyEnd);
  const {loadCandles1m}=await import("./hype-freerun-canonical-replay");const cs:any[]=(await loadCandles1m(spec.symbol,path.join(dir,"inputs"),end,path.join(dir,"inputs","repair.json"))).filter(c=>c.ts>=seed);
  assert.equal(cs.length,spec.expectedMinuteRows);cs.forEach((c,i)=>assert.equal(c.ts,seed+i*M));assert.equal(cs.at(-1).ts+M,end);
  const candle=(t:number)=>{const c=cs[(t-seed)/M];assert(c&&c.ts===t);return c;},refs=referenceFeatures(cs);
  const definitions=[...spec.anchors.map((a:any)=>({...a,id:a.originalId})),...spec.combinations],rules=man.rules;
  const results:any[]=read(path.join(dir,"results.json")),monthly:any[]=read(path.join(dir,"monthly.json")),ds:any[]=read(path.join(dir,"diagnostics.json"));
  const rows=new Map<string,any>(results.map(r=>[key(r),r])),months=new Map<string,any>(monthly.map(m=>[key(m)+"|"+m.month,m]));
  const ts=await lines(path.join(dir,"trades.jsonl")),decisions=await lines(path.join(dir,"decisions.jsonl"));assert.equal(results.length,116);assert.equal(rows.size,116);
  const signalCache=new Map<string,number[]>();for(const r of rules.filter((r:any)=>r.family!=="clock")){const ref=refs.get(r),opps:number[]=[];
    for(const [t,c]of ref){const p=ref.get(t-r.timeframeMs);if(referenceCross(r,p,c))opps.push(t+r.timeframeMs);}signalCache.set(r.id,opps);}
  function refGate(c:any,t:number){const tf=c.timeframeMs,at=Math.floor(t/tf)*tf,start=at-tf;
    const family=c.family==="shock"?"atr_move":c.family,r={family,period:family==="cmf"?20:14,timeframeMs:tf},map=refs.get(r),f=map.get(start),p=map.get(start-tf);
    let value:number|null=null;const input:any={threshold:c.threshold,timeframeMs:tf};let previousEnd:number|null=null,dayStart:number|null=null;
    if(c.family==="vwap"){value=f?.vvDayDistance??null;dayStart=f?.vvDayStart??null;assert.equal(dayStart,Math.floor(start/D)*D);}
    else if(c.family==="cmf")value=f?.vfSigned??null;
    else{const bars=refs.bars.get(tf)!,i=(start-bars[0].ts)/tf;Object.assign(input,{closeNow:bars[i]?.close??null,closePrevious:bars[i-1]?.close??null,previousAtr:p?.aeAtr??null});previousEnd=start;
      if(input.previousAtr>0&&input.closeNow!=null&&input.closePrevious!=null)value=Math.abs(input.closeNow-input.closePrevious)/input.previousAtr;}
    const ready=value!=null&&Number.isFinite(value),pass=ready&&(c.family==="vwap"?value!>c.threshold:c.family==="shock"?value!<=c.threshold:value!<c.threshold);
    return {value,ready,pass,sourceStart:start,sourceEnd:at,availableAt:at,expectedEnd:at,previousEnd,dayStart,input};
  }
  function metrics(r:any,trades:any[],scale=1){const s=r.side==="long"?1:-1,ps=[...trades,...(r.open?[r.open]:[])];let cursor=0,closed=0,peak=spec.initialEquity,dd=0,closeDD=0,bankrupt=false;
    for(let i=(Date.parse(r.start)-seed)/M;i<(Date.parse(r.end)-seed)/M;i++){const c=cs[i];while(cursor<ps.length&&ps[cursor].exitAt!==undefined&&ps[cursor].exitAt<=c.ts)closed+=ps[cursor++].net;
      const p=ps[cursor]?.entryAt<=c.ts?ps[cursor]:null;
      const eq=(price:number)=>spec.initialEquity+scale*(closed+(p?s*p.qty*(price-p.entryPrice)-p.qty*(p.entryPrice+price)*spec.feeRatePerSide:0));
      const adverse=eq(s===1?c.low:c.high),e=eq(c.close);dd=Math.max(dd,100*(peak-adverse)/peak);peak=Math.max(peak,e);closeDD=Math.max(closeDD,100*(peak-e)/peak);bankrupt ||= adverse<=0;}
    return {dd,closeDD,bankrupt};}
  let checkedTrades=0,checkedDecisions=0,checkedMonths=0;
  for(const r of results){const isClock=r.kind==="clock",isReady=r.kind==="availability_control",c=definitions.find((c:any)=>c.id===(isReady?r.id.slice(6):r.id));
    const rule=rules.find((x:any)=>x.id===(c?c.parentId:r.id));assert(rule);assert.equal(r.side,rule.side);assert.equal(r.holdMs,12*H);
    assert(spec.windows.some((w:any)=>w.id===r.window&&w.start===r.start&&w.end===r.end));assert(spec.executionDelaysMs.includes(r.delayMs));
    if(c)for(const f of ["parentId","originalId","family","timeframeMs","threshold"])assert.equal(r[f],c[f]);
    const start=Date.parse(r.start),stop=Date.parse(r.end),s=r.side==="long"?1:-1,trades=ts.get(key(r))??[],dec=decisions.get(key(r))??[];
    let opps=(signalCache.get(rule.id)??[]).filter(t=>t>=start&&t<stop);
    if(isClock){const first=Math.ceil(start/(12*H))*12*H,set=new Set<number>();for(let t=first;t<stop;t+=12*H)set.add(t);for(let t=first;t<stop;t+=12*H+2*r.delayMs)set.add(t);opps=[...set].sort((a,b)=>a-b);}
    else assert.deepEqual(dec.map(d=>d.at),opps,"Independent entry crossings");
    let free=start,occupied=0,blocked=0,missing=0,pending=false;const accepted:number[]=[];
    for(const [i,t]of opps.entries()){const g=c?refGate(c,t):null;let outcome="accepted";
      if(t<free){outcome="occupied";occupied++;}else if(g&&!g.ready){outcome="missing_context";missing++;}else if(g&&!isReady&&!g.pass){outcome="condition_false";blocked++;}
      else if(t+r.delayMs>=stop){pending=true;free=Infinity;}else {accepted.push(t);free=t+12*H+2*r.delayMs;}
      if(!isClock){const d=dec[i];assert.equal(d.outcome,outcome);assert.equal(d.acceptedEntryAt,outcome==="accepted"?t+r.delayMs:null);
        assert.equal(d.sourceStart,t-rule.timeframeMs);assert.equal(d.sourceEnd,t);assert.equal(d.availableAt,t);assert.equal(d.previousStart,t-2*rule.timeframeMs);assert.equal(d.feature.timestamp,t-rule.timeframeMs);
        for(const [f,v]of Object.entries(refs.get(rule).get(t-rule.timeframeMs)!)){if(v==null)assert.equal(d.feature[f],v);else near(d.feature[f],v as number,"Independent entry feature",1e-8);}
        if(g){for(const f of ["ready","pass","sourceStart","sourceEnd","availableAt","expectedEnd","dayStart","previousEnd"])assert.deepEqual(d.gate[f],(g as any)[f]);
          if(g.value==null)assert.equal(d.gate.value,null);else near(d.gate.value,g.value,"Independent context value",1e-8);assert.equal(d.gate.condition,c.id);assert.equal(d.gate.evidenceKind,"closed_bar");
          for(const [f,v]of Object.entries(g.input))if(v==null)assert.equal(d.gate.inputs[f],v);else near(d.gate.inputs[f],v as number,"Context input",1e-8);
        }else assert.equal(d.gate,null);checkedDecisions++;}
    }
    assert.deepEqual([...trades.map(t=>t.signalAt),...(r.open?[r.open.signalAt]:[])],accepted,"Independent occupancy");
    assert.equal(r.rawSignals,opps.length);assert.equal(r.skippedOccupied,occupied);assert.equal(r.blockedCondition,blocked);assert.equal(r.blockedMissing,missing);
    assert.equal(r.pendingAtEnd,pending||!!(r.open&&r.open.entryAt+12*H<stop&&r.open.entryAt+12*H+r.delayMs>=stop));
    for(const t of [...trades,...(r.open?[r.open]:[])]){assert.equal(t.entryAt,t.signalAt+r.delayMs);near(t.entryPrice,candle(t.entryAt).open,"Entry",1e-10);near(t.qty*t.entryPrice,10000,"Notional");
      if(t.exitAt!==undefined){assert.equal(t.exitDecisionAt,t.entryAt+12*H);assert.equal(t.exitAt,t.entryAt+12*H+r.delayMs);assert(t.exitAt<stop);assert.equal(t.reason,"timeout");assert.equal(t.side,r.side);
        near(t.exitPrice,candle(t.exitAt).open,"Exit",1e-10);near(t.pricePnl,s*t.qty*(t.exitPrice-t.entryPrice),"Gross");near(t.fees,t.qty*(t.entryPrice+t.exitPrice)*spec.feeRatePerSide,"Fees");near(t.net,t.pricePnl-t.fees,"Net");
        if(!isClock)assert.deepEqual(t.entryFeature,dec.find(d=>d.at===t.signalAt)!.feature);checkedTrades++;
      }else{near(t.markedPrice,candle(stop-M).close,"Cutoff price");near(t.net,s*t.qty*(t.markedPrice-t.entryPrice)-t.qty*(t.markedPrice+t.entryPrice)*spec.feeRatePerSide,"Open mark");assert(t.entryAt+12*H+r.delayMs>=stop);}}
    for(const [f,v]of Object.entries(wl(trades)))near(r[f],v,"W/L "+f);near(r.net,sum(trades,t=>t.net)+(r.open?.net??0),"Total");near(r.openNet,r.open?.net??0,"Open net");
    const turnover=sum(trades,t=>t.qty*(t.entryPrice+t.exitPrice))+(r.open?r.open.qty*(r.open.entryPrice+r.open.markedPrice):0);
    near(r.turnoverIncludingMarkedExit,turnover,"Turnover");near(r.feesPaid,sum(trades,t=>t.fees)+(r.open?r.open.qty*r.open.entryPrice*spec.feeRatePerSide:0),"Fees paid");near(r.stressNet,r.net-turnover*.0005,"Cost stress");
    near(r.exposureHours,sum(trades,t=>(t.exitAt-t.entryAt)/H)+(r.open?(stop-r.open.entryAt)/H:0),"Exposure");
    const pm=metrics(r,trades);near(r.maxAdverseDrawdownPct,pm.dd,"Adverse DD",1e-8);near(r.maxCloseDrawdownPct,pm.closeDD,"Close DD",1e-8);assert.equal(r.bankrupt,pm.bankrupt);
    let previous=0;for(let cursor=start;cursor<stop;){const date=new Date(cursor),month=date.toISOString().slice(0,7),boundary=Math.min(stop,Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1));
      const done=trades.filter(t=>t.exitAt<boundary),held=trades.filter(t=>t.entryAt<boundary&&t.exitAt>=boundary);if(r.open?.entryAt<boundary)held.push(r.open);assert(held.length<=1);const mark=candle(boundary-M).close;
      const cumulative=sum(done,t=>t.net)+sum(held,t=>s*t.qty*(mark-t.entryPrice)-t.qty*(t.entryPrice+mark)*spec.feeRatePerSide),m=months.get(key(r)+"|"+month);assert(m);near(m.markedNet,cumulative-previous,"Marked month");
      const exits=trades.filter(t=>new Date(t.exitAt).toISOString().slice(0,7)===month);for(const [f,v]of Object.entries(wl(exits)))near(m[f],v,"Month W/L");
      const fees=sum(exits,t=>t.qty*t.exitPrice*spec.feeRatePerSide)+sum([...trades,...(r.open?[r.open]:[])].filter(t=>new Date(t.entryAt).toISOString().slice(0,7)===month),t=>t.qty*t.entryPrice*spec.feeRatePerSide);near(m.feesPaid,fees,"Monthly fees");
      cursor=boundary;previous=cumulative;checkedMonths++;}near(previous,r.net,"Month sum");
    near(r.deltaVsClock,r.net-rows.get(key({...r,id:r.clockId})).net,"Clock delta");
    if(r.kind==="combination"){const p=rows.get(key({...r,id:r.parentId})),a=rows.get(key({...r,id:r.availabilityId})),old=rows.get(key({...r,id:r.originalId}));
      near(r.deltaVsParent,r.net-p.net,"Parent delta");near(r.deltaVsAvailability,r.net-a.net,"Ready delta");near(r.deltaVsOriginal,r.net-old.net,"Original pair delta");near(r.retention,r.net/p.net,"Retention");near(r.ddReductionPp,p.maxAdverseDrawdownPct-r.maxAdverseDrawdownPct,"DD improvement");
      const d=ds.find(d=>key(d)===key(r)),scale=r.exposureHours/a.exposureHours,sp=metrics(a,ts.get(key(a))??[],scale);assert(d);near(d.scaledParent.scale,scale,"Scale");near(d.scaledParent.maxAdverseDrawdownPct,sp.dd,"Scaled DD");near(d.scaledParent.losingDollars,a.losingDollars*scale,"Scaled loss dollars");}
  }
  assert.equal(checkedMonths,monthly.length);
  for(const m of monthly){const value=(id:string)=>months.get(key({...m,id})+"|"+m.month).markedNet;near(m.markedDeltaClock,m.markedNet-value(m.clockId),"Monthly clock delta");
    if(m.kind==="combination")for(const [delta,id]of [["markedDeltaParent",m.parentId],["markedDeltaAvailability",m.availabilityId],["markedDeltaOriginal",m.originalId]])near(m[delta],m.markedNet-value(id),delta);}
  const attrs:any[]=read(path.join(dir,"trade-attribution.json"));assert.equal(attrs.length,48);
  for(const a of attrs){const r=rows.get(key(a)),v=ts.get(key(r))??[],dec=decisions.get(key(r))!;
    for(const [field,pid]of [["versusParent",r.parentId],["versusOriginal",r.originalId]]){const p=rows.get(key({...r,id:pid})),pt=ts.get(key(p))??[],x=a[field];const removed=pt.filter(t=>!v.some(z=>z.signalAt===t.signalAt)),added=v.filter(t=>!pt.some(z=>z.signalAt===t.signalAt)),common=pt.filter(t=>v.some(z=>z.signalAt===t.signalAt));
      for(const t of common){const z=v.find(z=>z.signalAt===t.signalAt);assert.equal(t.net,z.net);assert.equal(t.entryAt,z.entryAt);assert.equal(t.exitAt,z.exitAt);}
      assert.equal(x.common,common.length);assert.equal(x.removedCount,removed.length);assert.equal(x.newlyEnabledCount,added.length);near(x.removedNet,sum(removed,t=>t.net),"Removed net");near(x.newlyEnabledNet,sum(added,t=>t.net),"New net");
      near(x.sacrificedWinningDollars,sum(removed,t=>Math.max(0,t.net)),"Sacrificed winners");near(x.avoidedLosingDollars,-sum(removed,t=>Math.min(0,t.net)),"Avoided losers");near(x.addedWinningDollars,sum(added,t=>Math.max(0,t.net)),"New winners");near(x.addedLosingDollars,sum(added,t=>Math.min(0,t.net)),"New losers");
      near(r.net-p.net,x.newlyEnabledNet-x.removedNet+(r.open?.net??0)-(p.open?.net??0),"Attribution bridge");
      assert.deepEqual(x.removedSignalAts,removed.map(t=>t.signalAt));assert.deepEqual(x.newlyEnabledSignalAts,added.map(t=>t.signalAt));
      for(const b of x.removedByReason){const z=removed.filter(t=>dec.find(d=>d.at===t.signalAt).outcome===b.reason);assert.equal(b.count,z.length);near(b.winningDollars,sum(z,t=>Math.max(0,t.net)),"By reason wins");near(b.losingDollars,sum(z,t=>Math.min(0,t.net)),"By reason losses");}}
  }
  const rankings:any[]=read(path.join(dir,"ranking.json"));assert.equal(rankings.length,12);
  for(const rank of rankings){const xs=results.filter(r=>r.id===rank.id),mm=monthly.filter(m=>m.id===rank.id);assert.equal(xs.length,4);
    const common=xs.every(r=>r.trades>=(r.window==="full"?30:10)&&r.net>0&&r.stressNet>0&&!r.bankrupt)&&mm.every(m=>m.markedDeltaParent>=-320-1e-8&&m.markedDeltaAvailability>=-320-1e-8);
    const profit=common&&xs.every(r=>Math.min(r.deltaVsParent,r.deltaVsAvailability)>=(r.window==="full"?500:200)-1e-8&&r.maxAdverseDrawdownPct<=rows.get(key({...r,id:r.availabilityId})).maxAdverseDrawdownPct+1e-8);
    const defense=common&&xs.every(r=>{const p=rows.get(key({...r,id:r.parentId})),a=rows.get(key({...r,id:r.availabilityId})),d=ds.find(d=>key(d)===key(r));return p.net>0&&a.net>0&&r.net>=.9*p.net-1e-8&&r.net>=.9*a.net-1e-8&&Math.abs(r.losingDollars)<Math.abs(p.losingDollars)-1e-8&&Math.abs(r.losingDollars)<Math.abs(a.losingDollars)-1e-8
      &&(r.window==="full"?r.maxAdverseDrawdownPct<=.8*a.maxAdverseDrawdownPct+1e-8&&a.maxAdverseDrawdownPct-r.maxAdverseDrawdownPct>=1-1e-8:r.maxAdverseDrawdownPct<=a.maxAdverseDrawdownPct+1e-8)
      &&r.maxAdverseDrawdownPct<d.scaledParent.maxAdverseDrawdownPct-1e-8&&Math.abs(r.losingDollars)<Math.abs(d.scaledParent.losingDollars)-1e-8;});
    const strict=xs.every(r=>r.trades>=(r.window==="full"?30:10)&&r.net>0&&r.stressNet>0&&!r.bankrupt&&r.deltaVsClock>0)&&mm.every(m=>m.markedDeltaClock>=-1e-8);
    assert.equal(rank.profitPass,profit);assert.equal(rank.defensivePass,defense);assert.equal(rank.strictPass,strict);near(rank.profitRank,Math.min(...xs.filter(r=>r.window==="full").flatMap(r=>[r.deltaVsParent,r.deltaVsAvailability])),"Rank");}
  const shortlist=read(path.join(dir,"shortlist.json"));for(const [f,pass]of [["profitIds","profitPass"],["defensiveIds","defensivePass"],["strictIds","strictPass"]])assert.deepEqual([...shortlist[f]].sort(),rankings.filter(r=>r[pass]).map(r=>r.id).sort());
  const parity=read(path.join(dir,"overlap-parity.json"));assert.equal(parity.length,32);assert(parity.every((p:any)=>p.exact));
  for(const p of artifacts)assert.equal(await sha(path.join(dir,p.file)),p.sha256);for(const p of man.sources)assert.equal(await sha(path.join(root,p.file)),p.sha256);
  const verification={passed:true,verifiedAt:new Date().toISOString(),verifiedLogicalCases:116,checkedTrades,checkedDecisions,checkedMonths,attributionComparisons:96,
    independentEntryAndContextMath:true,independentScheduling:true,independentFeesDdAndMonthlies:true,independentAttributionAndScreens:true,artifacts,verifier:{file:path.relative(root,__filename).replace(/\\/g,"/"),sha256:await sha(__filename)}};
  fs.writeFileSync(path.join(dir,"verification.json"),JSON.stringify(verification,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify({...verification,artifacts:undefined}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
