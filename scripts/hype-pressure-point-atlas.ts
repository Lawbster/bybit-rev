/** P01: archived current-stack pressure points + outcome-independent market grid. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, lines, prices, fileHash } from "./hype-failed-recovery-study";
import { priceFeatures } from "./failed-recovery-analysis";
import { attachSr } from "./indicator-hl-sr-context";
import { ReplaySrContext } from "./replay-sr-context";
import { SOURCES } from "./hype-tp-hl-event-atlas";
import { TpHlTape, normalize, stats, type Row, type Kind } from "./tp-hl-event-features";
import { M,H,upper,labelAt,dropEvents,indicatorSnapshots,hlSnapshot,bins,flagged,csv } from "./pressure-point-features";

export function distributions(xs:Row[],contexts:Map<number,Row>,label:string):Row[]{
  const keys=Object.keys(contexts.get(xs[0].at)!.values);
  return keys.map(feature=>({feature,all:stats(xs.map(x=>contexts.get(x.at)!.values[feature])),
    positive:stats(xs.filter(x=>x[label]===true).map(x=>contexts.get(x.at)!.values[feature])),
    negative:stats(xs.filter(x=>x[label]===false).map(x=>contexts.get(x.at)!.values[feature]))}));
}
export function rate(xs:Row[],label:string):Row{const known=xs.filter(x=>typeof x[label]==="boolean"),n=known.filter(x=>x[label]).length;
  return {n:xs.length,known:known.length,positive:n,rate:known.length?n/known.length:null};}
function money(xs:Row[]):Row{const done=xs.filter(x=>x.outcome),w=done.filter(x=>x.outcome.pnl>0),l=done.filter(x=>x.outcome.pnl<0);
  return {n:xs.length,closed:done.length,censored:xs.length-done.length,wins:w.length,losses:l.length,
    winningDollars:w.reduce((s,x)=>s+x.outcome.pnl,0),losingDollars:-l.reduce((s,x)=>s+x.outcome.pnl,0),
    remainingDownside:-done.reduce((s,x)=>s+Math.min(0,x.remainingValueChange),0),remainingRecovery:done.reduce((s,x)=>s+Math.max(0,x.remainingValueChange),0)};}
async function main(){
  const card="research-inputs/pressure-point-atlas-2026-09-09.json",spec=read(card),prior=read("research-inputs/failed-recovery-2026-09-08.json");
  const out=path.resolve(process.argv[2]??`backtests/hype/${spec.id}`),rel=path.relative(path.resolve("backtests"),out);
  assert(rel&&!rel.startsWith("..")&&!path.isAbsolute(rel)&&!fs.existsSync(out),"Fresh backtests output required");
  const pins=new Map<string,string>();const pin=async(f:string,expected?:string)=>{const h=await fileHash(f);if(expected)assert.equal(h,expected,f);pins.set(f,h);};
  for(const [f,h]of Object.entries(prior.archivePins))await pin(`${prior.archive}/${f}`,h as string);
  const lm=read(`${prior.archive}/manifest.json`),fv=read("backtests/hype/hype-failed-recovery-2026-09-08/verification.json");assert(fv.passed);
  for(const p of lm.inputs)await pin(p.file,p.sha256);
  for(const f of [card,spec.hlSpec,"scripts/pressure-point-features.ts","scripts/hype-pressure-point-atlas.ts","scripts/pressure-point-tests.ts",
    "scripts/tp-hl-event-features.ts","scripts/hype-failed-recovery-study.ts","scripts/failed-recovery-analysis.ts","scripts/replay-sr-context.ts","scripts/indicator-hl-sr-context.ts",
    "src/research/closed-bars.ts","src/research/indicator-features.ts","src/research/macd-features.ts","src/research/bollinger-features.ts",
    "src/research/atr-efficiency-features.ts","src/research/vwap-volume-features.ts","src/research/volume-flow-features.ts"])await pin(f);
  const protectedFiles=[];for(const file of ["bot-config.json","bot-state.json","hl-short-live-config.json","src/bot/index.ts","src/bot/state.ts","src/bot/strategy.ts"])
    protectedFiles.push({file,sha256:await fileHash(file)});
  const from=Date.parse(spec.from),cutoff=Date.parse(spec.cutoff),cs=await prices(cutoff,lm.spec.repairFile);
  const bases:Row[]=read(`${prior.archive}/results.json`).filter((b:Row)=>b.policy==="B17"&&b.window==="hl_extended");assert.equal(bases.length,2);
  const oldBaseFile="backtests/hype/hype-failed-recovery-2026-09-08/baseline.json";await pin(oldBaseFile,fv.artifacts.find((a:Row)=>a.file==="baseline.json").sha256);
  const accepted=read(oldBaseFile);for(const b of bases)assert.deepEqual(b,accepted.find((a:Row)=>a.model===b.model));
  const events:Row[]=dropEvents(cs,from),grid:Row[]=[];
  for(let at=Math.ceil(from/(4*H))*4*H;at+24*H<=cutoff;at+=4*H)grid.push({id:`grid-${at}`,cohort:"market_grid",at,...labelAt(cs,at)});
  for(const b of bases){const file=`${prior.archive}/${b.model}--B17-inventory.jsonl`;
    const fm=read("backtests/hype/hype-failed-recovery-2026-09-08/manifest.json");const p=fm.pins.find((x:Row)=>x.file===file);assert(p);await pin(file,p.sha256);
    let n=0;await lines(file,(r:Row)=>{if(r.event.kind!=="close"||["tp","stale_tp"].includes(r.event.reason))return;
      const outcome=b.metrics.episodes.find((e:Row)=>Date.parse(e.close)===r.event.fillAt);assert(outcome);n++;
      events.push({id:`${b.model}-${r.episode}`,cohort:"modeled_forced",model:b.model,episode:r.episode,
        at:r.event.decisionAt,fillAt:r.event.fillAt,outcome,depth:r.before.length,price:r.decisionPrice,...labelAt(cs,r.event.decisionAt)});
    });assert.equal(n,b.metrics.forcedCloses);}
  const humans="research-inputs/event-atlas/hype-local-tops-2026-08-14.json";await pin(humans);
  for(const [i,x]of read(humans).events.entries()){const at=Date.parse(x.at.replace(" ","T")+":00+02:00");events.push({id:`human-${i+1}`,cohort:"human_top",at,label:x.label,...labelAt(cs,at)});}
  const fobs="backtests/hype/hype-failed-recovery-2026-09-08/observations.json";await pin(fobs,fv.artifacts.find((a:Row)=>a.file==="observations.json").sha256);
  const pressure:Row[]=read(fobs).filter((x:Row)=>x.model.startsWith("hl_extended")&&x.threshold===-3).map((x:Row)=>({
    id:x.key,cohort:"ladder_pressure",model:x.model,episode:x.episode,landmarkMinutes:x.landmarkMinutes,at:x.at,entry:x.entry,
    outcome:x.outcome,remainingValueChange:x.remainingValueChange,netEpisodeMark:x.netEpisodeMark,grossPct:x.grossPct}));
  const queries:Row[]=[...grid.map(x=>({id:x.id,cohort:x.cohort,eventAt:x.at,offset:0,at:x.at})),...pressure.map(x=>({id:x.id,cohort:x.cohort,eventAt:x.at,offset:0,at:x.at})),
    ...events.flatMap(x=>spec.relativeMinutes.map((offset:number)=>({id:x.id,cohort:x.cohort,eventAt:x.at,offset,at:x.at+offset*M})))];
  const times=[...new Set<number>(queries.map(x=>x.at))].sort((a,b)=>a-b);assert(times.every(t=>t%M===0&&t<=cutoff));
  console.log(`[P01] ${grid.length} market boundaries, ${events.length} events, ${pressure.length} matched pressure landmarks; ${times.length} unique times`);
  const ind=indicatorSnapshots(cs,times,spec);console.log("[P01] all validated indicator families computed, primary and closed-bar+60s");
  const hs=read(spec.hlSpec);hs.windowCoverage={...hs.windowCoverage,...spec.additionalFlowCoverage};const tape=new TpHlTape(hs),sourceCounts:Row[]=[];
  // Keep only windows that a query can use, independently of its future label.
  const anchorTimes=[...new Set(times.flatMap(t=>[t,t-15*M,t-H,t-4*H]))].sort((a,b)=>a-b);
  for(const [kind,file]of SOURCES){await pin(file);let rows=0,retained=0;
    await lines(file,(r,line)=>{rows++;const o=normalize(kind,r,file,line),ts=o.sourceAt;if(ts>cutoff)return;
      const targets=kind==="asset"||kind==="oi"?anchorTimes:times;
      const lookback=kind==="taker"?4*H+3*M:kind==="asset"?3*M:kind==="oi"?4*M:kind==="vault"?31*M:20*M;
      const i=upper(targets,ts-1);if(i<targets.length&&ts>=targets[i]-lookback){tape.add(o);retained++;}});
    sourceCounts.push({kind,file,rows,retained});console.log(`[P01] ${kind} retained ${retained}/${rows}`);
  }tape.seal();
  fs.mkdirSync(out,{recursive:true});const json=(f:string,v:unknown)=>fs.writeFileSync(path.join(out,f),JSON.stringify(v,null,2)+"\n",{flag:"wx"});
  const fd=fs.openSync(path.join(out,"contexts.jsonl"),"wx"),contexts=new Map<number,Row>();const sr=new ReplaySrContext(cs,prior.srConfig);
  for(const [n,at]of times.entries()){
    const p=priceFeatures(cs,at),z=attachSr(cs,at,sr),h=hlSnapshot(tape,at,hs.legacyPublicationLagMs),hd=hlSnapshot(tape,at,hs.legacyPublicationLagMs+spec.additionalLegacyLagMs);
    const i=ind.get(at)!,values:Row={...i.values,...Object.fromEntries(Object.entries(h.features).map(([k,v])=>[`hl_${k}`,v])),
      price:p.price,roc15:p.roc15,roc60:p.roc60,roc240:p.roc240,roc720:p.roc720,rollingVwap60:p.vwap60,rollingVwapDistancePct:p.vwapDistancePct,
      ema200Distance4hPct:p.trend.distancePct,sr_supportDistancePct:z.nearestSupport?.distancePct??null,sr_resistanceDistancePct:z.nearestResistance?.distancePct??null};
    const row={at,iso:new Date(at).toISOString(),values,indicatorSources:i.sources,delayedIndicatorValues:i.delayedValues,delayedIndicatorSources:i.delayedSources,
      hl:h,hlDelayed:{features:hd.features,quality:hd.quality},priceContext:p,sr:{coverage:z.coverage,nearestSupport:z.nearestSupport,nearestResistance:z.nearestResistance}};
    fs.writeSync(fd,JSON.stringify(row)+"\n");contexts.set(at,{at,values,delayedIndicatorValues:i.delayedValues,hlDelayed:row.hlDelayed,quality:h.quality});
    if(n%300===0)console.log(`[P01] point-in-time context ${n}/${times.length}`);
  }fs.closeSync(fd);
  const checks=[];
  for(const at of [times[0],times[Math.floor(times.length/2)],times.at(-1)!]){
    const prefix=cs.filter(c=>c.endTs<=at);assert.deepEqual(indicatorSnapshots(prefix,[at],spec).get(at),ind.get(at));
    const t=new TpHlTape(hs);for(const rows of Object.values(tape.rows))rows.filter(r=>r.baseAvailableAt<=at&&r.sourceAt<=at).forEach(r=>t.add(r));t.seal();
    assert.deepEqual(hlSnapshot(t,at,60000),hlSnapshot(tape,at,60000));checks.push({at,indicatorPrefix:true,hlPrefix:true});
  }
  const flat=queries.map(q=>({...q,iso:new Date(q.at).toISOString(),...contexts.get(q.at)!.values}));
  json("events.json",events);json("grid.json",grid);json("pressure.json",pressure);json("baseline.json",bases);json("source-inventory.json",sourceCounts);
  fs.writeFileSync(path.join(out,"snapshots.csv"),csv(flat),{flag:"wx"});fs.writeFileSync(path.join(out,"events.csv"),csv(events),{flag:"wx"});
  const binRows:Row[]=[],pressureRows:Row[]=[],bs=bins();
  const groups=[{name:"all",xs:grid},{name:"early",xs:grid.filter(x=>x.at<Date.parse(spec.chronologyBoundary))},{name:"late",xs:grid.filter(x=>x.at>=Date.parse(spec.chronologyBoundary))},
    ...[...new Set(grid.map(x=>new Date(x.at).toISOString().slice(0,7)))].map(month=>({name:month,xs:grid.filter(x=>new Date(x.at).toISOString().startsWith(month))}))];
  for(const g of groups)for(const label of ["drop2in12","drop3in24","drop5in12"])for(const b of bs){
    const flag=(x:Row)=>flagged(contexts.get(x.at)!.values,b);const known=g.xs.filter(x=>flag(x)!==null);
    binRows.push({group:g.name,label,bin:b.id,baseline:rate(g.xs,label),known:rate(known,label),flagged:rate(g.xs.filter(x=>flag(x)===true),label),
      unflagged:rate(g.xs.filter(x=>flag(x)===false),label),unknown:rate(g.xs.filter(x=>flag(x)===null),label)});
  }
  for(const model of bases.map(b=>b.model))for(const lm of [0,60])for(const b of bs){
    const xs=pressure.filter(x=>x.model===model&&x.landmarkMinutes===lm),flag=(x:Row)=>flagged(contexts.get(x.at)!.values,b);
    pressureRows.push({model,landmarkMinutes:lm,bin:b.id,baseline:money(xs),flagged:money(xs.filter(x=>flag(x)===true)),unflagged:money(xs.filter(x=>flag(x)===false)),unknown:money(xs.filter(x=>flag(x)===null))});
  }
  const summaries:Row={grid:Object.fromEntries(["drop2in12","drop3in24","drop5in12"].map(k=>[k,rate(grid,k)])),
    cohorts:Object.fromEntries([...new Set(events.map(x=>x.cohort))].map(k=>[k,events.filter(x=>x.cohort===k).length])),
    sourceCoverage:Object.fromEntries(Object.keys(contexts.get(times[0])!.values).map(k=>[k,stats(grid.map(x=>contexts.get(x.at)!.values[k])).n])),
    sourceDelay:bs.map(b=>{let known=0,bothKnown=0,changed=0;for(const x of grid){const c=contexts.get(x.at)!,a=flagged(c.values,b);
      const dv={...c.delayedIndicatorValues,...Object.fromEntries(Object.entries(c.hlDelayed.features).map(([k,v])=>[`hl_${k}`,v]))};const d=flagged(dv,b);
      if(a!==null)known++;if(a!==null&&d!==null){bothKnown++;if(a!==d)changed++;}}
      return {bin:b.id,known,bothKnown,changed};})};
  json("summary.json",summaries);json("bins.json",bs);json("market-bin-comparisons.json",binRows);json("pressure-bin-comparisons.json",pressureRows);
  json("feature-distributions.json",distributions(grid,contexts,"drop2in12"));json("prefix-checks.json",checks);
  for(const [file,h]of pins)assert.equal(await fileHash(file),h,`Changed input ${file}`);
  for(const p of protectedFiles)assert.equal(await fileHash(p.file),p.sha256,`Protected file changed ${p.file}`);
  json("manifest.json",{at:new Date().toISOString(),spec,pins:[...pins].map(([file,sha256])=>({file,sha256})),protectedFiles,baselineDigests:bases.map(b=>({model:b.model,digest:b.digest})),archivedControlsExact:true,newTradingDefinitions:0,liveChanges:0});
  const artifacts=[];for(const file of fs.readdirSync(out))artifacts.push({file,sha256:await fileHash(path.join(out,file))});
  json("validation.json",{complete:true,events:events.length,grid:grid.length,pressure:pressure.length,contexts:times.length,queries:queries.length,features:Object.keys(contexts.get(times[0])!.values).length,bins:bs.length,artifacts});
  console.log(JSON.stringify(summaries.grid));console.log(`[P01] complete: ${out}`);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
