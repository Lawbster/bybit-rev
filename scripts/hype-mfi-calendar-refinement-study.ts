/** Approved T02 only. Reuses frozen engines; writes a new local artifact bundle. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { prepareFeatures } from "./indicator-entry-context-features";
import { runEntryContext } from "./indicator-entry-context-policy";
import { HOUR as H, MINUTE as M } from "./indicator-standalone-engine";
import { pathDiagnostics, screenCombinations } from "./indicator-combination-analysis";
import { exclusionGate, replacementAttribution } from "./mfi-calendar-refinement";
const root=path.resolve(__dirname,".."),card="research-inputs/indicators/time-gating-t02-2026-09-07.json";
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const json=(p:string,x:any)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+"\n",{flag:"wx"});
const rel=(p:string)=>path.relative(root,p).replace(/\\/g,"/");
const key=(r:any)=>`${r.window}|${r.delayMs}|${r.id}`;
async function sha(p:string){const h=crypto.createHash("sha256");for await(const b of fs.createReadStream(p))h.update(b);return h.digest("hex");}
async function lines(p:string,ids:Set<string>){const out=new Map<string,any[]>();for await(const l of readline.createInterface({input:fs.createReadStream(p),crlfDelay:Infinity})){
  if(!l.trim())continue;const x=JSON.parse(l);if(!ids.has(x.id))continue;const k=key(x);if(!out.has(k))out.set(k,[]);out.get(k)!.push(x);}return out;}
const canonical=(x:any)=>JSON.parse(JSON.stringify(x));
async function main(){
  assert(process.argv.length===4&&process.argv[2]==="--out","Usage: --out NEW_BACKTEST_DIRECTORY");
  const out=path.resolve(root,process.argv[3]),rr=path.relative(path.join(root,"backtests"),out);
  assert(rr&&!rr.startsWith("..")&&!path.isAbsolute(rr)&&!fs.existsSync(out),"Require new local backtests directory");
  const spec=read(path.join(root,card));assert.equal(spec.combinations.length,5);
  assert.deepEqual(spec.combinations.map((x:any)=>[x.id,x.holdHours,x.excludeStartHour,x.excludeEndHour]),[
    ["T01-05",12,16,20],["T02-01",12,15,19],["T02-02",12,17,21],["T02-03",11,16,20],["T02-04",13,16,20]]);
  const priorDir=path.join(root,spec.priorDirectory),prior=read(path.join(priorDir,"manifest.json")),pv=read(path.join(priorDir,"verification.json"));
  assert.equal(pv.passed,true);assert.equal(await sha(path.join(priorDir,"manifest.json")),spec.priorManifestSha256);
  assert.equal(await sha(path.join(priorDir,"verification.json")),spec.priorVerificationSha256);
  for(const k of ["symbol","indicatorSeedBarStart","historyEnd","expectedMinuteRows","windows","notionalUsdt","initialEquity","feeRatePerSide","executionDelaysMs","extraFixedPathCostBpsPerSide"])assert.deepEqual(spec[k],prior.spec[k]);
  const pins=new Map<string,string>();
  for(const p of prior.sources){assert.equal(await sha(path.join(root,p.file)),p.sha256,`Pinned source/artifact drift: ${p.file}`);pins.set(p.file,p.sha256);}
  for(const p of pv.artifacts){const file=path.join(priorDir,p.file);assert.equal(await sha(file),p.sha256,p.file);pins.set(rel(file),p.sha256);}
  for(const f of ["manifest.json","verification.json"])pins.set(rel(path.join(priorDir,f)),await sha(path.join(priorDir,f)));
  for(const p of prior.inputRecovery){assert.equal(await sha(path.join(root,p.effectiveFile)),p.sha256);assert.equal(fs.statSync(path.join(root,p.effectiveFile)).size,p.pinnedBytes);}
  console.log("[preflight] accepted T01 source/artifact/input hashes intact; no latest-data rebaseline");
  fs.mkdirSync(path.join(out,"inputs"),{recursive:true});const inputs:any[]=[];
  for(const p of prior.inputRecovery){const target=path.join(out,"inputs",path.basename(p.effectiveFile));fs.copyFileSync(path.join(root,p.effectiveFile),target,fs.constants.COPYFILE_EXCL);
    inputs.push({file:rel(target),bytes:p.pinnedBytes,sha256:await sha(target),originalFile:p.effectiveFile});assert.equal(inputs.at(-1).sha256,p.sha256);}
  const owned=[card,"scripts/hype-mfi-calendar-refinement-study.ts","scripts/mfi-calendar-refinement.ts","scripts/mfi-calendar-refinement-tests.ts","scripts/mfi-calendar-refinement-results-check.ts"];
  for(const f of owned)pins.set(f,await sha(path.join(root,f)));
  const protectedFiles=["bot-config.json","bot-state.json","hl-short-live-config.json","src/bot/index.ts","src/bot/strategy.ts","src/bot/shadow-logger.ts"];
  const protectedPins=await Promise.all(protectedFiles.map(async file=>({file,sha256:await sha(path.join(root,file))})));
  process.env.SIM_START=spec.indicatorSeedBarStart;process.env.SIM_END=spec.historyEnd;
  const {loadCandles1m}=await import("./hype-freerun-canonical-replay");const seed=Date.parse(spec.indicatorSeedBarStart),end=Date.parse(spec.historyEnd);
  const raw=(await loadCandles1m(spec.symbol,path.join(out,"inputs"),end,path.join(out,"inputs","repair.json"))).filter(c=>c.ts>=seed);
  assert.equal(raw.length,spec.expectedMinuteRows);raw.forEach((c,i)=>assert.equal(c.ts,seed+i*M));assert.equal(raw.at(-1)!.ts+M,end);
  const minutes=raw.map(c=>({timestamp:c.ts,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume,turnover:c.turnover}));
  const feature=prepareFeatures(minutes),rule=prior.rules.find((r:any)=>r.id===spec.parentId),clock=prior.rules.find((r:any)=>r.id==="clock_long");
  assert(rule&&clock);const opportunities=feature.opportunities(rule),results:any[]=[],monthly:any[]=[],diagnostics:any[]=[],attribution:any[]=[],parity:any[]=[];
  const cache=new Map<string,any>(),ledger=fs.openSync(path.join(out,"trades.jsonl"),"wx"),decisions=fs.openSync(path.join(out,"decisions.jsonl"),"wx");
  const selectedIds=new Set<string>([spec.parentId,"clock_long","T01-05"]),archived=read(path.join(priorDir,"results.json")),am=read(path.join(priorDir,"monthly.json"));
  const at=await lines(path.join(priorDir,"trades.jsonl"),selectedIds),ad=await lines(path.join(priorDir,"decisions.jsonl"),selectedIds);
  const options=(w:any,delayMs:number,holdHours:number)=>({start:Date.parse(w.start),end:Date.parse(w.end),delayMs,holdMs:holdHours*H,notional:spec.notionalUsdt,equity:spec.initialEquity,feeRate:spec.feeRatePerSide});
  function save(meta:any,run:any){
    const row={...meta,...run.stats,open:run.open,blockedCondition:run.blockedCondition??0,blockedMissing:run.blockedMissing??0,
      stressNet:run.stats.net-run.stats.turnoverIncludingMarkedExit*spec.extraFixedPathCostBpsPerSide/10000};
    results.push(row);cache.set(key(row),{row,run});monthly.push(...run.monthly.map((m:any)=>({...meta,...m})));
    for(const t of run.trades)fs.writeSync(ledger,JSON.stringify({id:row.id,window:row.window,delayMs:row.delayMs,...t})+"\n");
    for(const d of run.decisions??[])fs.writeSync(decisions,JSON.stringify({id:row.id,window:row.window,delayMs:row.delayMs,...d})+"\n");
    return row;
  }
  function checkArchive(meta:any,run:any,id:string){
    const old=archived.find((r:any)=>key(r)===key({...meta,id}));assert(old);
    for(const [f,v]of Object.entries(run.stats))assert.deepEqual(v,old[f],`Archived stat ${id}/${meta.window}/${meta.delayMs}/${f}`);
    assert.deepEqual(canonical(run.open),old.open);
    assert.deepEqual(canonical(run.trades),(at.get(key(old))??[]).map(({id,window,delayMs,...x}:any)=>x));
    const oldMonths=am.filter((r:any)=>key(r)===key(old));assert.equal(oldMonths.length,run.monthly.length);
    run.monthly.forEach((m:any,i:number)=>Object.keys(m).forEach(f=>assert.deepEqual(m[f],oldMonths[i][f])));
    if(run.decisions)assert.deepEqual(run.decisions.map((d:any)=>[d.at,d.outcome,d.acceptedEntryAt]),ad.get(key(old))!.map((d:any)=>[d.at,d.outcome,d.acceptedEntryAt]));
    parity.push({window:meta.window,delayMs:meta.delayMs,id:meta.id,archivedId:id,exact:true});
  }
  // All parents/hold-specific clock controls and archived reference BEFORE new exclusions.
  for(const w of spec.windows)for(const delayMs of spec.executionDelaysMs){
    for(const p of spec.parents){const o=options(w,delayMs,p.holdHours),run=runEntryContext(minutes,opportunities,"long",o),old=feature.original(rule,o);
      for(const k of ["stats","trades","monthly","open"])assert.deepEqual(canonical(run[k as keyof typeof run]),canonical(old[k]));
      const meta={...p,window:w.id,start:w.start,end:w.end,delayMs,holdMs:o.holdMs,side:"long",family:"mfi",kind:"parent",clockId:`CLOCK${p.holdHours}`};
      if(p.holdHours===12)checkArchive(meta,run,spec.parentId);save(meta,run);
      const cr=feature.original(clock,o),cm={...meta,id:`CLOCK${p.holdHours}`,family:"clock",kind:"clock"};
      if(p.holdHours===12)checkArchive(cm,cr,"clock_long");save(cm,cr);
    }
    const c=spec.combinations[0],o=options(w,delayMs,12),run=runEntryContext(minutes,opportunities,"long",o,t=>exclusionGate(t,16,20));
    const meta={...c,window:w.id,start:w.start,end:w.end,delayMs,holdMs:o.holdMs,side:"long",family:"mfi",kind:"combination",availabilityId:"ready_T01-05",clockId:"CLOCK12"};
    checkArchive(meta,run,"T01-05");save(meta,run);
  }
  assert.equal(parity.length,12);console.log("[parity] all 12 archived MFI/clock/T01-05 cases exact; three own-hold parents match old indicator engine");
  const prefixEnd=Date.UTC(2026,7,1),prefix=minutes.slice(0,(prefixEnd-seed)/M),pf=prepareFeatures(prefix),po=pf.opportunities(rule);
  assert.deepEqual(opportunities.filter(s=>s.at<=prefixEnd),po);
  let prefixChecks=1;
  for(const c of spec.combinations)for(const delay of spec.executionDelaysMs){const o={...options(spec.windows[0],delay,c.holdHours),end:prefixEnd},g=(t:number)=>exclusionGate(t,c.excludeStartHour,c.excludeEndHour);
    assert.deepEqual(runEntryContext(minutes,opportunities,"long",o,g),runEntryContext(prefix,po,"long",o,g));prefixChecks++;}
  for(const c of spec.combinations.slice(1))for(const w of spec.windows)for(const delayMs of spec.executionDelaysMs){
    const o=options(w,delayMs,c.holdHours),run=runEntryContext(minutes,opportunities,"long",o,t=>exclusionGate(t,c.excludeStartHour,c.excludeEndHour));
    save({...c,window:w.id,start:w.start,end:w.end,delayMs,holdMs:o.holdMs,side:"long",family:"mfi",kind:"combination",availabilityId:`ready_${c.id}`,clockId:`CLOCK${c.holdHours}`},run);
    console.log(`[T02] ${c.id} ${w.id}/${delayMs}: replay complete`);
  }
  assert.equal(results.length,44);
  function describe(t:any){const i=(t.signalAt-seed)/M-1,c=minutes[i],bars=minutes.slice(i-14,i+1),high=Math.max(...bars.map(b=>b.high)),low=Math.min(...bars.map(b=>b.low)),f=t.entryFeature;
    const ret=(n:number)=>i>=n?100*(c.close/minutes[i-n].close-1):null;
    return {MFI7:f.vfValue,RSI14_15m:f.rsi14,CRSI_15m:f.crsi,ADX14_15m:f.adx14,ATRpct_15m:f.atrPct,RVOL20_15m:f.rvol20,
      closed_return_15m:ret(15),closed_return_1h:ret(60),closed_return_4h:ret(240),closed_15m_range_location:high>low?(c.close-low)/(high-low):null};}
  const availability:any[]=[];
  for(const c of spec.combinations)for(const w of spec.windows)for(const delayMs of spec.executionDelaysMs){
    const k=key({id:c.id,window:w.id,delayMs}),v=cache.get(k),p=cache.get(key({...v.row,id:c.parentId}));
    const ready={...p.run,decisions:p.run.decisions.map((d:any)=>({...d,gate:exclusionGate(d.at,c.excludeStartHour,c.excludeEndHour)}))};
    save({...v.row,id:`ready_${c.id}`,kind:"availability_control"},ready);
    availability.push({id:`ready_${c.id}`,window:w.id,delayMs,reusedParent:c.parentId,allRelevantSignalsReady:true});
    const scale=v.row.exposureHours/p.row.exposureHours;
    diagnostics.push({id:c.id,window:w.id,delayMs,...pathDiagnostics(minutes,v.row,v.run.trades,spec),scaledParent:pathDiagnostics(minutes,p.row,p.run.trades,spec,scale)});
    const a=replacementAttribution(p.run,v.run,describe);attribution.push({id:c.id,window:w.id,delayMs,parentId:c.parentId,...a});
  }
  fs.closeSync(ledger);fs.closeSync(decisions);assert.equal(results.length,spec.expectedCounts.totalLogicalCases);
  const mm=new Map(monthly.map(m=>[key(m)+"|"+m.month,m]));
  for(const r of results){const cl=cache.get(key({...r,id:r.clockId})).row;r.deltaVsClock=r.net-cl.net;
    if(r.kind==="combination"){const p=cache.get(key({...r,id:r.parentId})).row;r.deltaVsParent=r.net-p.net;r.deltaVsAvailability=r.deltaVsParent;r.retention=r.net/p.net;r.ddReductionPp=p.maxAdverseDrawdownPct-r.maxAdverseDrawdownPct;}}
  for(const m of monthly){m.clockMarkedNet=mm.get(key({...m,id:m.clockId})+"|"+m.month).markedNet;m.markedDeltaClock=m.markedNet-m.clockMarkedNet;
    if(m.kind==="combination"){m.parentMarkedNet=mm.get(key({...m,id:m.parentId})+"|"+m.month).markedNet;m.markedDeltaParent=m.markedNet-m.parentMarkedNet;m.availabilityMarkedNet=m.parentMarkedNet;m.markedDeltaAvailability=m.markedDeltaParent;}}
  const screen=screenCombinations(spec,results,monthly,diagnostics);
  const csv=(file:string,xs:any[])=>{const keys=[...new Set(xs.flatMap(x=>Object.keys(x)))];fs.writeFileSync(path.join(out,file),[keys.join(","),...xs.map(x=>keys.map(k=>JSON.stringify(x[k]??"")).join(","))].join("\n")+"\n",{flag:"wx"});};
  csv("summary.csv",results.map(({open,...x})=>x));csv("monthly.csv",monthly);
  csv("changed-trades.csv",attribution.filter(a=>a.id==="T01-05").flatMap(a=>a.rows.map(({entryFeature,entryContext,...r}:any)=>({window:a.window,delayMs:a.delayMs,...r,...entryContext}))));
  const traces=spec.combinations.map((c:any)=>{const run=cache.get(`full|0|${c.id}`).run;return{id:c.id,accepted:run.decisions.find((d:any)=>d.outcome==="accepted"),blocked:run.decisions.find((d:any)=>d.outcome==="condition_false")};});
  for(const [f,x]of Object.entries({results,monthly,diagnostics,"replacement-attribution":attribution,"overlap-parity":parity,"availability-controls":availability,
    "causal-traces":traces,ranking:screen.ranking,shortlist:{profitIds:screen.profitIds,defensiveIds:screen.defensiveIds,strictIds:screen.strictIds,liveApproved:false}}))json(path.join(out,f+".json"),x);
  for(const [file,hash]of pins)assert.equal(await sha(path.join(root,file)),hash,`Source changed ${file}`);
  for(const p of protectedPins)assert.equal(await sha(path.join(root,p.file)),p.sha256,`Protected file changed ${p.file}`);
  for(const p of inputs)assert.equal(await sha(path.join(root,p.file)),p.sha256);
  json(path.join(out,"manifest.json"),{version:1,spec,cardFile:card,sources:[...pins].map(([file,sha256])=>({file,sha256})),inputs,protectedPins,
    minuteRows:minutes.length,rule,clockRule:clock,outputDirectory:rel(out),prefixChecks,createdAt:new Date().toISOString(),node:process.version});
  json(path.join(out,"validation.json"),{passed:true,archivedParityCases:parity.length,prefixChecks,ownHoldEngineParityCases:12,primaryCases:44,readinessLogicalCases:20,independentVerificationPending:true});
  console.log(JSON.stringify({out:rel(out),profit:screen.profitIds,defensive:screen.defensiveIds,strict:screen.strictIds,independentVerificationPending:true}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
