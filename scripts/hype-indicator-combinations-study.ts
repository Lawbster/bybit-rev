/** Approved C01 only. Local immutable artifacts; never imports live owners. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { pipeline } from "stream/promises";
import type { Candle } from "../src/fetch-candles";
import { MINUTE, HOUR } from "./indicator-standalone-engine";
import { conditionAt, runCombination, type Condition } from "./indicator-combination-engine";
import { prepareFeatures } from "./indicator-combination-features";
import { pathDiagnostics, attribution, screenCombinations } from "./indicator-combination-analysis";

const root=path.resolve(__dirname,".."),card="research-inputs/indicators/combinations-c01-2026-09-07.json";
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8"));
const json=(p:string,v:any)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+"\n",{flag:"wx"});
const key=(r:any)=>`${r.window}|${r.delayMs}|${r.id}`;
async function sha(file:string){const h=crypto.createHash("sha256");for await(const b of fs.createReadStream(file))h.update(b);return h.digest("hex");}
const rel=(file:string)=>path.relative(root,file).replace(/\\/g,"/");
function csv(file:string,rows:any[]){const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];const encode=(x:any)=>x==null?"":typeof x==="object"?JSON.stringify(JSON.stringify(x)):JSON.stringify(x);fs.writeFileSync(file,[keys.join(","),...rows.map(r=>keys.map(k=>encode(r[k])).join(","))].join("\n")+"\n",{flag:"wx"});}
function strip(t:any){const {id,window,delayMs,...rest}=t;return rest;}

async function main(){
  const spec=read(path.join(root,card)),args=process.argv.slice(2);
  assert(args.length===0||(args.length===2&&args[0]==="--out"));
  const out=path.resolve(root,args[1]??`backtests/hype/${spec.id}`),relative=path.relative(path.join(root,"backtests"),out);
  assert(relative&&!relative.startsWith("..")&&!path.isAbsolute(relative)&&!fs.existsSync(out),"Require a NEW local backtests directory");
  assert.equal(spec.combinations.length,32);assert.equal(spec.anchors.length,8);assert.equal(spec.conditions.length,4);
  assert.equal(spec.componentControls.length,6);assert.equal(new Set(spec.combinations.map((c:any)=>c.id)).size,32);
  spec.combinations.forEach((c:any,i:number)=>assert.deepEqual(c,{id:`C01-${String(i+1).padStart(2,"0")}`,anchor:`A${Math.floor(i/4)+1}`,condition:`B${i%4+1}`}));
  const priorDir=path.join(root,spec.priorArtifactDirectory),prior=read(path.join(priorDir,"manifest.json"));
  for(const k of ["indicatorSeedBarStart","historyEnd","repairFile","windows","notionalUsdt","initialEquity","feeRatePerSide","holdMs","executionDelaysMs","extraFixedPathCostBpsPerSide"])assert.deepEqual(spec[k],prior.spec[k],k);
  const originalPins=new Map<string,any>(),archive=new Map<string,any>(),selectedIds=new Set([...spec.anchors.map((r:any)=>r.parentId),...spec.componentControls.map((r:any)=>r.id),"clock_long","clock_short"]);
  const archivedRows=new Map<string,any>(),archivedTrades=new Map<string,any[]>(),archivedMonths=new Map<string,any[]>();
  const studies:any={I01:{directory:spec.priorArtifactDirectory},...spec.artifactStudies};
  // Validate every prior source and artifact. Recover ONLY a hash-proven raw prefix.
  for(const [name,study]of Object.entries(studies) as [string,any][]){
    const dir=path.join(root,study.directory),m=read(path.join(dir,"manifest.json")),v=read(path.join(dir,"verification.json"));assert.equal(v.passed,true);
    if(study.summarySha256)assert.equal(await sha(path.join(dir,"summary.csv")),study.summarySha256);
    for(const pin of [...m.sources,...m.inputs]){const previous=originalPins.get(pin.file);if(previous)assert.equal(previous.sha256,pin.sha256,pin.file);else originalPins.set(pin.file,pin);}
    for(const pin of v.artifacts)assert.equal(await sha(path.join(dir,pin.file)),pin.sha256,`${name}/${pin.file}`);
    for(const f of ["manifest.json","verification.json","results.json","monthly.json","trades.jsonl","summary.csv"]){const file=rel(path.join(dir,f));originalPins.set(file,{file,sha256:await sha(path.join(dir,f))});}
    const summaries=read(path.join(dir,"results.json")).filter((r:any)=>selectedIds.has(r.id));
    for(const r of summaries){if(archivedRows.has(key(r)))continue;archivedRows.set(key(r),r);archivedTrades.set(key(r),[]);archivedMonths.set(key(r),[]);}
    const relevant=new Set(summaries.filter((r:any)=>r.family!=="clock"||name==="I01").map(key));
    for(const m of read(path.join(dir,"monthly.json")))if(relevant.has(key(m)))archivedMonths.get(key(m))!.push(m);
    for await(const line of readline.createInterface({input:fs.createReadStream(path.join(dir,"trades.jsonl")),crlfDelay:Infinity})){
      if(!line.trim())continue;const t=JSON.parse(line);if(relevant.has(key(t)))archivedTrades.get(key(t))!.push(t);
    }
    archive.set(name,m);console.log(`[preflight] ${name} accepted artifacts checked; selected ledgers loaded`);
  }
  const recoverySource=`data/${spec.symbol}_1m.jsonl`,recoveryPin=prior.inputs.find((p:any)=>p.file===recoverySource);
  for(const pin of originalPins.values()){
    if(pin.file===recoverySource){const h=crypto.createHash("sha256");for await(const b of fs.createReadStream(path.join(root,pin.file),{start:0,end:recoveryPin.bytes-1}))h.update(b);assert.equal(h.digest("hex"),pin.sha256,"Cannot recover exact original minute snapshot");}
    else assert.equal(await sha(path.join(root,pin.file)),pin.sha256,`Historical source/input drift: ${pin.file}`);
  }
  fs.mkdirSync(path.join(out,"inputs"),{recursive:true});
  const inputDir=path.join(out,"inputs"),inputRecovery:any[]=[];
  for(const pin of prior.inputs){
    const source=path.join(root,pin.file),destination=path.join(inputDir,path.basename(pin.file));
    await pipeline(fs.createReadStream(source,{start:0,end:pin.bytes-1}),fs.createWriteStream(destination,{flags:"wx"}));
    assert.equal(await sha(destination),pin.sha256);inputRecovery.push({originalFile:pin.file,effectiveFile:rel(destination),pinnedBytes:pin.bytes,
      sha256:pin.sha256,currentSourceBytes:fs.statSync(source).size,recoveredExactPrefix:fs.statSync(source).size!==pin.bytes});
  }
  console.log("[inputs] original hash-matched snapshot recovered locally; current data untouched");
  const sources=[card,"scripts/hype-indicator-combinations-study.ts","scripts/indicator-combination-engine.ts","scripts/indicator-combination-features.ts",
    "scripts/indicator-combination-analysis.ts","scripts/indicator-combination-tests.ts","scripts/indicator-combination-results-check.ts",
    "scripts/indicator-combination-reference.ts",...originalPins.keys()].filter(f=>f!==recoverySource);
  const sourcePins=await Promise.all([...new Set(sources)].map(async file=>({file,sha256:await sha(path.join(root,file))})));
  process.env.SIM_START=spec.indicatorSeedBarStart;process.env.SIM_END=spec.historyEnd;
  const core=await import("./hype-freerun-canonical-replay");
  const seed=Date.parse(spec.indicatorSeedBarStart),end=Date.parse(spec.historyEnd);
  const minutes:Candle[]=(await core.loadCandles1m(spec.symbol,inputDir,end,path.join(inputDir,path.basename(spec.repairFile))))
    .filter(c=>c.ts>=seed).map(c=>({timestamp:c.ts,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume,turnover:c.turnover}));
  assert.equal(minutes.length,spec.expectedMinuteRows);minutes.forEach((c,i)=>assert.equal(c.timestamp,seed+i*MINUTE));
  assert.equal(minutes.at(-1)!.timestamp+MINUTE,end);
  const features=prepareFeatures(minutes),fields=["id","family","side","exit","timeframeMs","upper","period","threshold","mode","reference","fastPeriod","slowPeriod","signalPeriod"];
  const rules=[...selectedIds].map(id=>{
    const row=archivedRows.get(`full|0|${id}`);assert(row,id);return Object.fromEntries(fields.filter(k=>row[k]!==undefined).map(k=>[k,row[k]]));
  });
  const ruleById=new Map(rules.map(r=>[r.id,r]));
  const signals=new Map(rules.filter(r=>r.family!=="clock").map(r=>[r.id,features.opportunities(r)]));
  const bRows=new Map(spec.conditions.map((c:any)=>[c.id,features.conditionRows(c.id)])) as Map<string,Map<number,any>>;
  const prefixEnd=Date.UTC(2026,7,1),prefixTape=minutes.slice(0,(prefixEnd-seed)/MINUTE),prefixFeatures=prepareFeatures(prefixTape);
  let featurePrefixChecks=0;
  for(const r of rules.filter(r=>r.family!=="clock")){
    assert.deepEqual(features.rows(r).filter(b=>b.barEnd<=prefixEnd),prefixFeatures.rows(r));featurePrefixChecks++;
    assert.deepEqual(signals.get(r.id)!.filter(s=>s.at<=prefixEnd),prefixFeatures.opportunities(r));featurePrefixChecks++;
  }
  for(const b of spec.conditions){assert.deepEqual([...bRows.get(b.id)!].filter(([t])=>t<=prefixEnd),[...prefixFeatures.conditionRows(b.id)]);featurePrefixChecks++;}
  const options=(w:any,delayMs:number)=>({start:Date.parse(w.start),end:Date.parse(w.end),delayMs,notional:spec.notionalUsdt,equity:spec.initialEquity,feeRate:spec.feeRatePerSide,holdMs:spec.holdMs});
  const cache=new Map<string,any>(),parity:any[]=[],results:any[]=[],monthly:any[]=[],diagnostics:any[]=[],dedup:any[]=[],causalTraces:any[]=[];
  const ledger=fs.openSync(path.join(out,"trades.jsonl"),"wx"),decisionFile=fs.openSync(path.join(out,"decisions.jsonl"),"wx");
  function save(meta:any,run:any){
    const row={...meta,...run.stats,open:run.open,blockedMissing:run.blockedMissing??0,blockedCondition:run.blockedCondition??0,
      stressNet:run.stats.net-run.stats.turnoverIncludingMarkedExit*spec.extraFixedPathCostBpsPerSide/10000};
    results.push(row);cache.set(key(row),{row,run});
    monthly.push(...run.monthly.map((m:any)=>({...meta,...m})));
    if(run.trades.length)fs.writeSync(ledger,run.trades.map((t:any)=>JSON.stringify({window:meta.window,delayMs:meta.delayMs,id:meta.id,...t})).join("\n")+"\n");
    if(run.decisions?.length)fs.writeSync(decisionFile,run.decisions.map((d:any)=>JSON.stringify({window:meta.window,delayMs:meta.delayMs,id:meta.id,...d})).join("\n")+"\n");
    return row;
  }
  // All repeated controls BEFORE inspecting a new economic combination.
  for(const w of spec.windows)for(const delayMs of spec.executionDelaysMs)for(const r of rules){
    const o=options(w,delayMs),old=features.original(r,o),saved=archivedRows.get(key({window:w.id,delayMs,id:r.id}));
    for(const [f,value]of Object.entries(old.stats))assert.deepEqual(value,saved[f],`${r.id}/${w.id}/${delayMs} ${f}`);
    // JSON archives cannot retain JavaScript -0. Compare exact serialized values;
    // in-memory old/new engine parity below still uses deepStrictEqual unchanged.
    assert.deepEqual(JSON.parse(JSON.stringify(old.open)),saved.open);
    assert.deepEqual(JSON.parse(JSON.stringify(old.trades)),archivedTrades.get(key(saved))!.map(strip));
    const ms=archivedMonths.get(key(saved))!;assert.equal(old.monthly.length,ms.length);
    old.monthly.forEach((m:any,i:number)=>{for(const k of Object.keys(m))assert.deepEqual(m[k],ms[i][k]);});
    let run=old;
    if(r.family!=="clock"){
      run=runCombination(minutes,signals.get(r.id)!,r.side,o);
      for(const k of ["stats","open","trades","monthly"])assert.deepEqual(run[k],old[k],`All-true parent parity ${r.id} ${k}`);
    }
    save({window:w.id,start:w.start,end:w.end,delayMs,...r,kind:r.family==="clock"?"clock":"parent_or_component"},run);
    parity.push({window:w.id,delayMs,id:r.id,exactSavedLedgerStatsMonths:true,allTrueEngineMatched:r.family!=="clock"});
  }
  assert.equal(parity.length,64);console.log("[parity] all64 archived control cases exact;56 all-true cases match old engines");
  let enginePrefixChecks=0,readinessRuns=0;
  for(const c of spec.combinations){
    const anchor=spec.anchors.find((a:any)=>a.id===c.anchor),r=ruleById.get(anchor.parentId)!,os=signals.get(r.id)!;
    const gate=(t:number)=>conditionAt(c.condition as Condition,r.side,t,bRows.get(c.condition)!);
    const po={...options(spec.windows[0],MINUTE),end:prefixEnd};
    const a=runCombination(minutes,os,r.side,po,gate);
    const b=runCombination(prefixTape,prefixFeatures.opportunities(r),r.side,po,t=>conditionAt(c.condition,r.side,t,prefixFeatures.conditionRows(c.condition)));
    assert.deepEqual(a,b,`Full-path prefix ${c.id}`);enginePrefixChecks++;
    for(const w of spec.windows)for(const delayMs of spec.executionDelaysMs){
      const parent=cache.get(key({window:w.id,delayMs,id:r.id}))!,o=options(w,delayMs),availabilityId=`ready_${c.id}`;
      const relevant=os.filter(s=>s.at>=o.start&&s.at<o.end),allReady=relevant.every(s=>gate(s.at).ready);
      let ready:any;
      if(allReady){ready={...parent.run,decisions:parent.run.decisions.map((d:any)=>({...d,gate:gate(d.at)}))};}
      else {ready=runCombination(minutes,os,r.side,o,gate,true);readinessRuns++;}
      const readyMeta={window:w.id,start:w.start,end:w.end,delayMs,...r,id:availabilityId,kind:"availability_control",sourceParentId:r.id,anchorId:c.anchor,conditionId:c.condition};
      save(readyMeta,ready);dedup.push({window:w.id,delayMs,id:availabilityId,reusedParent:allReady? r.id:null,allRelevantCrossingsReady:allReady,rawSignals:relevant.length});
      if(allReady)for(const k of ["stats","trades","monthly","open"])assert.deepEqual(ready[k],parent.run[k]);
      const run=runCombination(minutes,os,r.side,o,gate),row=save({...readyMeta,id:c.id,kind:"combination",parentId:r.id,availabilityId},run);
      const ratio=ready.stats.exposureHours>0?row.exposureHours/ready.stats.exposureHours:null;
      diagnostics.push({window:w.id,delayMs,id:c.id,...pathDiagnostics(minutes,row,run.trades,spec),
        scaledParent:ratio===null?null:pathDiagnostics(minutes,cache.get(key({...row,id:availabilityId}))!.row,ready.trades,spec,ratio),
        attribution:attribution(parent.run.trades,run.trades,run.decisions)});
      if(w.id==="full"&&delayMs===0)causalTraces.push({id:c.id,firstAccepted:run.decisions.find(d=>d.outcome==="accepted")??null,
        firstGateRejection:run.decisions.find(d=>d.outcome==="condition_false"||d.outcome==="missing_context")??null});
    }
    console.log(`[C01] ${c.id} ${c.anchor}+${c.condition}: four cases and prefix passed`);
  }
  fs.closeSync(ledger);fs.closeSync(decisionFile);
  for(const r of results){
    const clock=cache.get(key({...r,id:`clock_${r.side}`}))!.row;
    r.baselineId=r.kind==="clock"?null:clock.id;r.deltaVsClock=r.kind==="clock"?null:r.net-clock.net;
    if(r.kind==="combination"){
      const p=cache.get(key({...r,id:r.parentId}))!.row,a=cache.get(key({...r,id:r.availabilityId}))!.row;
      r.deltaVsParent=r.net-p.net;r.deltaVsAvailability=r.net-a.net;r.retention=Math.min(r.net/p.net,r.net/a.net);
      r.ddReductionPp=a.maxAdverseDrawdownPct-r.maxAdverseDrawdownPct;
    }
  }
  const mm=new Map(monthly.map(m=>[`${key(m)}|${m.month}`,m]));
  for(const m of monthly){
    const clock=mm.get(`${key({...m,id:`clock_${m.side}`})}|${m.month}`)!;
    m.clockMarkedNet=clock.markedNet;m.markedDeltaClock=m.markedNet-clock.markedNet;
    if(m.kind==="combination"){
      const p=mm.get(`${key({...m,id:m.parentId})}|${m.month}`)!,a=mm.get(`${key({...m,id:m.availabilityId})}|${m.month}`)!;
      m.parentMarkedNet=p.markedNet;m.availabilityMarkedNet=a.markedNet;m.markedDeltaParent=m.markedNet-p.markedNet;m.markedDeltaAvailability=m.markedNet-a.markedNet;
    }
  }
  const screens=screenCombinations(spec,results,monthly,diagnostics);
  const overlaps:any[]=[];
  const combos=spec.combinations as any[];
  for(let i=0;i<combos.length;i++)for(let j=i+1;j<combos.length;j++){
    const x=cache.get(`full|0|${combos[i].id}`),y=cache.get(`full|0|${combos[j].id}`);if(x.row.side!==y.row.side)continue;
    const sx=new Set(x.run.decisions.filter((d:any)=>d.outcome==="accepted").map((d:any)=>d.at)),sy=new Set(y.run.decisions.filter((d:any)=>d.outcome==="accepted").map((d:any)=>d.at));
    const intersection=[...sx].filter(at=>sy.has(at)).length,union=new Set([...sx,...sy]).size;
    overlaps.push({first:combos[i].id,second:combos[j].id,window:"full",delayMs:0,firstEntries:sx.size,secondEntries:sy.size,intersection,jaccard:union?intersection/union:null,identical:sx.size===sy.size&&intersection===sx.size});
  }
  for(const p of sourcePins)assert.equal(await sha(path.join(root,p.file)),p.sha256,`Source changed during run ${p.file}`);
  for(const p of inputRecovery)assert.equal(await sha(path.join(root,p.effectiveFile)),p.sha256);
  const manifest={version:1,spec,executionAuthorization:"User approved card and requested execution September7,2026",node:process.version,
    sources:sourcePins,inputRecovery,seed,minuteRows:minutes.length,rules,featurePrefixChecks,enginePrefixChecks,
    actualPrimaryCases:192,availabilityLogicalCases:128,availabilityExecutedCases:readinessRuns,availabilityReusedCases:128-readinessRuns,
    outputDirectory:rel(out),createdAt:new Date().toISOString(),fundingIncluded:false};
  json(path.join(out,"manifest.json"),manifest);json(path.join(out,"results.json"),results);json(path.join(out,"monthly.json"),monthly);
  csv(path.join(out,"summary.csv"),results.map(({open,...r})=>r));csv(path.join(out,"monthly.csv"),monthly);
  json(path.join(out,"diagnostics.json"),diagnostics);json(path.join(out,"ranking.json"),screens.ranking);
  json(path.join(out,"shortlist.json"),{profitIds:screens.profitIds,defensiveIds:screens.defensiveIds,strictIds:screens.strictIds,forwardOrLiveApproved:false});
  json(path.join(out,"overlap-parity.json"),parity);json(path.join(out,"availability-controls.json"),dedup);json(path.join(out,"causal-traces.json"),causalTraces);json(path.join(out,"signal-overlaps.json"),overlaps);
  json(path.join(out,"validation.json"),{passed:true,combinationDefinitions:32,combinationCases:128,repeatedCases:64,
    availabilityLogicalCases:128,exactSavedParentCases:64,allTrueEngineCases:56,featurePrefixChecks,enginePrefixChecks,
    missingMinutes:0,inputAndSourceHashesUnchanged:true,liveChanges:0,independentVerificationPending:true});
  console.log(JSON.stringify({out:rel(out),profit:screens.profitIds,defensive:screens.defensiveIds,strict:screens.strictIds,independentVerificationPending:true}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
