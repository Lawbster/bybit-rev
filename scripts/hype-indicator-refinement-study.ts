/** R01: nine frozen refinements, no live imports or configuration writes. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { prepareFeatures } from "./indicator-entry-context-features";
import { runEntryContext } from "./indicator-entry-context-policy";
import { refinementGate, contextRule } from "./indicator-refinement-policy";
import { pathDiagnostics, screenCombinations, attribution } from "./indicator-combination-analysis";
const root=path.resolve(__dirname,".."),cardFile="research-inputs/indicators/refinement-r01-2026-09-07.json",M=60_000,H=60*M;
const read=(p:string)=>JSON.parse(fs.readFileSync(p,"utf8")),norm=(x:any)=>JSON.parse(JSON.stringify(x));
const key=(r:any)=>`${r.window}|${r.delayMs}|${r.id}`,rel=(p:string)=>path.relative(root,p).replace(/\\/g,"/");
async function sha(p:string){const h=crypto.createHash("sha256");for await(const b of fs.createReadStream(p))h.update(b);return h.digest("hex");}
async function lines(p:string,ids:Set<string>){const out=new Map<string,any[]>();for await(const l of readline.createInterface({input:fs.createReadStream(p),crlfDelay:Infinity})){
  if(!l.trim())continue;const r=JSON.parse(l);if(!ids.has(r.id))continue;const k=key(r);if(!out.has(k))out.set(k,[]);out.get(k)!.push(r);}return out;}
async function main(){
  assert(process.argv.length===4&&process.argv[2]==="--out","Usage: --out NEW_BACKTEST_DIRECTORY");
  const out=path.resolve(root,process.argv[3]),relative=path.relative(path.join(root,"backtests"),out);assert(relative&&!relative.startsWith("..")&&!path.isAbsolute(relative)&&!fs.existsSync(out));
  const spec=read(path.join(root,cardFile));assert.equal(spec.combinations.length,9);
  assert.deepEqual(spec.combinations.map((c:any)=>[c.family,c.timeframeMs,c.threshold]),[
    ["vwap",H,-.25],["vwap",H,.25],["vwap",H/2,0],["shock",H,.75],["shock",H,1.25],["shock",H/2,1],["cmf",H,.05],["cmf",H,-.05],["cmf",H/2,0]]);
  const priorDir=path.join(root,spec.sourceBundle),prior=read(path.join(priorDir,"manifest.json"));
  assert.equal(await sha(path.join(priorDir,"manifest.json")),spec.sourceManifestSha256);assert.equal(await sha(path.join(priorDir,"verification.json")),spec.sourceVerificationSha256);
  assert(read(path.join(priorDir,"verification.json")).passed);
  for(const f of ["symbol","indicatorSeedBarStart","historyEnd","expectedMinuteRows","windows","notionalUsdt","initialEquity","feeRatePerSide","executionDelaysMs","extraFixedPathCostBpsPerSide"])assert.deepEqual(spec[f],prior.spec[f]);
  const pins=new Map<string,string>();for(const p of prior.sources){assert.equal(await sha(path.join(root,p.file)),p.sha256,p.file);pins.set(p.file,p.sha256);}
  const selected=new Set<string>([...spec.anchors.flatMap((a:any)=>[a.parentId,a.originalId]),"clock_long","clock_short"]),archives:any={};
  for(const [name,a]of Object.entries(spec.archives) as [string,any][]){const dir=path.join(root,a.directory);
    assert.equal(await sha(path.join(dir,"manifest.json")),a.manifestSha256);assert.equal(await sha(path.join(dir,"verification.json")),a.verificationSha256);
    const v=read(path.join(dir,"verification.json"));assert(v.passed);
    for(const f of ["manifest.json","verification.json"]){const file=path.join(dir,f);pins.set(rel(file),await sha(file));}
    for(const p of v.artifacts){const file=path.join(dir,p.file);assert.equal(await sha(file),p.sha256);pins.set(rel(file),p.sha256);}
    archives[name]={manifest:read(path.join(dir,"manifest.json")),results:read(path.join(dir,"results.json")),monthly:read(path.join(dir,"monthly.json")),
      trades:await lines(path.join(dir,"trades.jsonl"),selected),decisions:await lines(path.join(dir,"decisions.jsonl"),selected)};
  }
  for(const p of prior.inputs){assert.equal(await sha(path.join(root,p.file)),p.sha256);assert.equal(fs.statSync(path.join(root,p.file)).size,p.bytes);}
  console.log("[R01 preflight] archived sources/artifacts and frozen repaired tape intact");
  const protectedFiles=["bot-config.json","bot-state.json","hl-short-live-config.json","src/bot/index.ts","src/bot/strategy.ts","src/bot/shadow-logger.ts"];
  const protectedPins=await Promise.all(protectedFiles.map(async file=>({file,sha256:await sha(path.join(root,file))})));
  for(const file of [cardFile,"scripts/hype-indicator-refinement-study.ts","scripts/indicator-refinement-policy.ts","scripts/indicator-refinement-tests.ts","scripts/indicator-refinement-results-check.ts"])pins.set(file,await sha(path.join(root,file)));
  fs.mkdirSync(path.join(out,"inputs"),{recursive:true});const inputs=[];
  for(const p of prior.inputs){const target=path.join(out,"inputs",path.basename(p.file));fs.copyFileSync(path.join(root,p.file),target,fs.constants.COPYFILE_EXCL);assert.equal(await sha(target),p.sha256);inputs.push({...p,file:rel(target),originalFile:p.file});}
  process.env.SIM_START=spec.indicatorSeedBarStart;process.env.SIM_END=spec.historyEnd;
  const {loadCandles1m}=await import("./hype-freerun-canonical-replay");const seed=Date.parse(spec.indicatorSeedBarStart),end=Date.parse(spec.historyEnd);
  const raw=(await loadCandles1m(spec.symbol,path.join(out,"inputs"),end,path.join(out,"inputs","repair.json"))).filter(c=>c.ts>=seed);
  assert.equal(raw.length,spec.expectedMinuteRows);raw.forEach((c,i)=>assert.equal(c.ts,seed+i*M));assert.equal(raw.at(-1)!.ts+M,end);
  const minutes=raw.map(c=>({timestamp:c.ts,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume,turnover:c.turnover})),features=prepareFeatures(minutes);
  const rules=archives.C02.manifest.rules.filter((r:any)=>spec.anchors.some((a:any)=>a.parentId===r.id)||r.family==="clock");assert.equal(rules.length,5);
  const getRule=(id:string)=>{const r=rules.find((r:any)=>r.id===id);assert(r);return r;};
  const originals=spec.anchors.map((a:any)=>({...a,id:a.originalId,axis:"archived_original"})),definitions=[...originals,...spec.combinations];
  const opps=new Map<string,any[]>(spec.anchors.map((a:any)=>[a.parentId,features.opportunities(getRule(a.parentId))]));
  const contexts=new Map<string,Map<number,any>>();const ctx=(c:any)=>{const k=c.family+"|"+c.timeframeMs;if(!contexts.has(k))contexts.set(k,new Map(features.rows(contextRule(c)).map(b=>[b.barEnd,b])));return contexts.get(k)!;};
  const options=(w:any,delayMs:number)=>({start:Date.parse(w.start),end:Date.parse(w.end),delayMs,holdMs:spec.holdMs,notional:spec.notionalUsdt,equity:spec.initialEquity,feeRate:spec.feeRatePerSide});
  const results:any[]=[],monthly:any[]=[],diagnostics:any[]=[],attrs:any[]=[],parity:any[]=[],availability:any[]=[],cache=new Map<string,any>();
  const ledger=fs.openSync(path.join(out,"trades.jsonl"),"wx"),decisions=fs.openSync(path.join(out,"decisions.jsonl"),"wx");
  function save(meta:any,run:any){const row={...meta,...run.stats,open:run.open,blockedCondition:run.blockedCondition??0,blockedMissing:run.blockedMissing??0,
    stressNet:run.stats.net-run.stats.turnoverIncludingMarkedExit*spec.extraFixedPathCostBpsPerSide/10000};results.push(row);cache.set(key(row),{row,run});
    monthly.push(...run.monthly.map((m:any)=>({...meta,...m})));
    for(const t of run.trades)fs.writeSync(ledger,JSON.stringify({id:row.id,window:row.window,delayMs:row.delayMs,...t})+"\n");
    for(const d of run.decisions??[])fs.writeSync(decisions,JSON.stringify({id:row.id,window:row.window,delayMs:row.delayMs,...d})+"\n");return row;}
  function check(meta:any,run:any,study:string){const a=archives[study],old=a.results.find((r:any)=>key(r)===key(meta));assert(old);
    for(const [f,v]of Object.entries(run.stats))assert.deepEqual(v,old[f],`Archived ${key(meta)} ${f}`);assert.deepEqual(norm(run.open),old.open);
    assert.deepEqual(norm(run.trades),(a.trades.get(key(meta))??[]).map(({id,window,delayMs,...t}:any)=>t));
    const mm=a.monthly.filter((m:any)=>key(m)===key(meta));assert.equal(mm.length,run.monthly.length);run.monthly.forEach((m:any,i:number)=>Object.keys(m).forEach(f=>assert.deepEqual(m[f],mm[i][f])));
    if(run.decisions)assert.deepEqual(run.decisions.map((d:any)=>[d.at,d.outcome,d.acceptedEntryAt]),a.decisions.get(key(meta)).map((d:any)=>[d.at,d.outcome,d.acceptedEntryAt]));
    parity.push({id:meta.id,window:meta.window,delayMs:meta.delayMs,study,exact:true});}
  function meta(c:any,w:any,delayMs:number,kind:string){return {...c,kind,window:w.id,start:w.start,end:w.end,delayMs,holdMs:spec.holdMs,clockId:`clock_${c.side}`,
    availabilityId:kind==="combination"?`ready_${c.id}`:undefined};}
  for(const w of spec.windows)for(const delayMs of spec.executionDelaysMs){const o=options(w,delayMs);
    for(const r of rules){const run=r.family==="clock"?features.original(r,o):runEntryContext(minutes,opps.get(r.id)!,r.side,o);
      const old=features.original(r,o);for(const f of ["stats","trades","monthly","open"])assert.deepEqual(norm(run[f as keyof typeof run]),norm(old[f]));
      const m=meta(r,w,delayMs,r.family==="clock"?"clock":"parent");check(m,run,"C02");save(m,run);}
    for(const c of originals){const run=runEntryContext(minutes,opps.get(c.parentId)!,c.side,o,t=>refinementGate(c,t,ctx(c))),m=meta(c,w,delayMs,"combination");check(m,run,c.study);save(m,run);}
  }
  assert.equal(parity.length,32);console.log("[R01 parity] all 32 archived parent/pair/clock cases exact");
  const cut=Date.UTC(2026,7,1),prefix=minutes.slice(0,(cut-seed)/M),pf=prepareFeatures(prefix);let prefixChecks=0;
  for(const a of spec.anchors){assert.deepEqual(opps.get(a.parentId)!.filter(s=>s.at<=cut),pf.opportunities(getRule(a.parentId)));prefixChecks++;}
  for(const c of spec.combinations){const pctx=new Map(pf.rows(contextRule(c)).map(b=>[b.barEnd,b]));
    for(const s of opps.get(c.parentId)!.filter(s=>s.at<cut))assert.deepEqual(refinementGate(c,s.at,ctx(c)),refinementGate(c,s.at,pctx));
    const o={...options(spec.windows[0],60000),end:cut};assert.deepEqual(runEntryContext(minutes,opps.get(c.parentId)!,c.side,o,t=>refinementGate(c,t,ctx(c))),runEntryContext(prefix,pf.opportunities(getRule(c.parentId)),c.side,o,t=>refinementGate(c,t,pctx)));prefixChecks++;}
  for(const c of spec.combinations)for(const w of spec.windows)for(const delayMs of spec.executionDelaysMs){save(meta(c,w,delayMs,"combination"),runEntryContext(minutes,opps.get(c.parentId)!,c.side,options(w,delayMs),t=>refinementGate(c,t,ctx(c))));console.log(`[R01] ${c.id} ${w.id}/${delayMs} replay complete`);}
  assert.equal(results.length,68);
  for(const c of definitions)for(const w of spec.windows)for(const delayMs of spec.executionDelaysMs){const m=meta(c,w,delayMs,"combination"),v=cache.get(key(m)),p=cache.get(key({...m,id:c.parentId})),old=cache.get(key({...m,id:c.originalId}));
    const ready=runEntryContext(minutes,opps.get(c.parentId)!,c.side,options(w,delayMs),t=>refinementGate(c,t,ctx(c)),true);const equal=JSON.stringify(ready.trades)===JSON.stringify(p.run.trades)&&JSON.stringify(ready.stats)===JSON.stringify(p.run.stats);
    save({...meta(c,w,delayMs,"availability_control"),id:`ready_${c.id}`},ready);availability.push({id:c.id,window:w.id,delayMs,equalToParent:equal});
    const arow=cache.get(key({...m,id:`ready_${c.id}`})).row,scale=v.row.exposureHours/arow.exposureHours;
    diagnostics.push({id:c.id,window:w.id,delayMs,...pathDiagnostics(minutes,v.row,v.run.trades,spec),scaledParent:pathDiagnostics(minutes,arow,ready.trades,spec,scale)});
    attrs.push({id:c.id,window:w.id,delayMs,parentId:c.parentId,originalId:c.originalId,versusParent:attribution(p.run.trades,v.run.trades,v.run.decisions),versusOriginal:attribution(old.run.trades,v.run.trades,v.run.decisions)});
  }
  fs.closeSync(ledger);fs.closeSync(decisions);assert.equal(results.length,116);
  const mm=new Map(monthly.map(m=>[key(m)+"|"+m.month,m]));
  for(const r of results){r.deltaVsClock=r.net-cache.get(key({...r,id:r.clockId})).row.net;
    if(r.kind==="combination"){const p=cache.get(key({...r,id:r.parentId})).row,a=cache.get(key({...r,id:r.availabilityId})).row,old=cache.get(key({...r,id:r.originalId})).row;
      r.deltaVsParent=r.net-p.net;r.deltaVsAvailability=r.net-a.net;r.deltaVsOriginal=r.net-old.net;r.retention=r.net/p.net;r.ddReductionPp=p.maxAdverseDrawdownPct-r.maxAdverseDrawdownPct;}}
  for(const m of monthly){const net=(id:string)=>mm.get(key({...m,id})+"|"+m.month).markedNet;m.clockMarkedNet=net(m.clockId);m.markedDeltaClock=m.markedNet-m.clockMarkedNet;
    if(m.kind==="combination"){m.parentMarkedNet=net(m.parentId);m.availabilityMarkedNet=net(m.availabilityId);m.originalMarkedNet=net(m.originalId);m.markedDeltaParent=m.markedNet-m.parentMarkedNet;m.markedDeltaAvailability=m.markedNet-m.availabilityMarkedNet;m.markedDeltaOriginal=m.markedNet-m.originalMarkedNet;}}
  const screen=screenCombinations({...spec,combinations:definitions},results,monthly,diagnostics);
  const json=(f:string,x:any)=>fs.writeFileSync(path.join(out,f+".json"),JSON.stringify(x,null,2)+"\n",{flag:"wx"});
  const csv=(f:string,xs:any[])=>{const fields=[...new Set(xs.flatMap(x=>Object.keys(x)))];fs.writeFileSync(path.join(out,f+".csv"),[fields.join(","),...xs.map(x=>fields.map(f=>JSON.stringify(x[f]??"")).join(","))].join("\n")+"\n",{flag:"wx"});};
  csv("summary",results.map(({open,...r})=>r));csv("monthly",monthly);
  for(const [f,x]of Object.entries({results,monthly,diagnostics,"trade-attribution":attrs,"overlap-parity":parity,"availability-controls":availability,ranking:screen.ranking,shortlist:{profitIds:screen.profitIds,defensiveIds:screen.defensiveIds,strictIds:screen.strictIds,liveApproved:false}}))json(f,x);
  for(const [file,h]of pins)assert.equal(await sha(path.join(root,file)),h);for(const p of protectedPins)assert.equal(await sha(path.join(root,p.file)),p.sha256);for(const p of inputs)assert.equal(await sha(path.join(root,p.file)),p.sha256);
  json("manifest",{version:1,spec,cardFile,sources:[...pins].map(([file,sha256])=>({file,sha256})),inputs,protectedPins,rules,prefixChecks,minuteRows:minutes.length,node:process.version,createdAt:new Date().toISOString()});
  json("validation",{passed:true,archivedParityCases:32,primaryCases:68,readinessCases:48,prefixChecks,independentVerificationPending:true});
  console.log(JSON.stringify({profit:screen.profitIds,defensive:screen.defensiveIds,strict:screen.strictIds,independentVerificationPending:true}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
