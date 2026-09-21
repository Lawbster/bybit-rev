/** Independent artifact, raw-time, flow/price arithmetic and cohort verification. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { prices } from "./hype-failed-recovery-study";
type R=Record<string,any>;
const M=60000,H=60*M,out=path.resolve(process.argv[2]??"backtests/hype/hype-pressure-point-atlas-2026-09-09-v2");
const read=(f:string)=>JSON.parse(fs.readFileSync(path.join(out,f),"utf8"));
async function hash(f:string){const h=crypto.createHash("sha256");for await(const b of fs.createReadStream(f))h.update(b);return h.digest("hex");}
async function lines(f:string,cb:(r:R,n:number)=>void){let n=0;for await(const s of readline.createInterface({input:fs.createReadStream(f),crlfDelay:Infinity})){n++;if(s.trim())cb(JSON.parse(s),n);}}
const epoch=(x:any)=>typeof x==="number"?x:/^\d+$/.test(x)?Number(x):Date.parse(x);
const near=(a:number,b:number)=>assert(Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
async function main(){
  const manifest=read("manifest.json"),v=read("validation.json");assert(v.complete);
  for(const p of v.artifacts)assert.equal(await hash(path.join(out,p.file)),p.sha256,p.file);
  for(const p of [...manifest.pins,...manifest.protectedFiles])assert.equal(await hash(p.file),p.sha256,p.file);
  const cs=await prices(Date.parse(manifest.spec.cutoff),"backtests/hype/candle-repair-2026-09-05/repair.json");
  const events:R[]=read("events.json"),grid:R[]=read("grid.json"),pressure:R[]=read("pressure.json"),contexts=new Map<number,R>();
  const needed=new Map<string,Map<number,R>>();let refCount=0;
  const walk=(x:any,at:number)=>{if(!x||typeof x!=="object")return;const query=x.queryAt??at;assert(query<=at);
    if(x.file&&x.line){assert(x.sourceAt<=query&&x.availableAt<=query);const m=needed.get(x.file)??new Map();
      const old=m.get(x.line);if(old)assert.deepEqual(old,x.availabilityBasis?{sampleAt:x.sampleAt,sourceAt:x.sourceAt,availableAt:x.availableAt,availabilityBasis:x.availabilityBasis}:old);
      else m.set(x.line,{sampleAt:x.sampleAt,sourceAt:x.sourceAt,availableAt:x.availableAt,availabilityBasis:x.availabilityBasis});needed.set(x.file,m);refCount++;}
    Object.values(x).forEach(y=>walk(y,query));};
  await lines(path.join(out,"contexts.jsonl"),r=>{
    assert(!contexts.has(r.at));contexts.set(r.at,r);walk(r.hl.sources,r.at);
    for(const name of ["indicatorSources","delayedIndicatorSources"]){const lag=name.startsWith("delayed")?M:0;
      for(const [tf,s]of Object.entries(r[name])as[string,R][]){const interval=Number(tf.slice(1))*M;
        assert.equal(s.sourceEnd,Math.floor((r.at-lag)/interval)*interval);assert.equal(s.availableAt,s.sourceEnd+lag);assert(s.availableAt<=r.at);}
    }
    const i=(r.at-cs[0].endTs)/M;assert.equal(cs[i].close,r.values.price);
    for(const n of [15,60,240,720])near(r.values[`roc${n}`],100*(cs[i].close/cs[i-n].close-1));
    let vol=0,turn=0;for(let j=i-59;j<=i;j++){vol+=cs[j].volume;turn+=cs[j].turnover;}near(r.values.rollingVwap60,turn/vol);
    const z=r.sr;assert(z.coverage.healthy);for(const key of ["nearestSupport","nearestResistance"]){const l=z[key];if(!l)continue;
      assert(l.zone.usableAt<=r.at&&l.zone.lastTouchKnownAt<=r.at);assert(l.zone.touchData.every((t:R)=>t.ts<=r.at));
      near(l.distancePct,Math.abs(l.zone.price/r.values.price-1)*100);}
  });assert.equal(contexts.size,v.contexts);
  const expectedTimes=new Set<number>();
  for(const e of events)for(const offset of manifest.spec.relativeMinutes){assert(contexts.has(e.at+offset*M));expectedTimes.add(e.at+offset*M);}
  [...grid,...pressure].forEach(e=>expectedTimes.add(e.at));assert.deepEqual([...expectedTimes].sort(),[...contexts.keys()].sort());
  for(const e of [...events,...grid]){
    const i=(e.at-cs[0].endTs)/M;assert(Number.isInteger(i));for(const h of [4,12,24]){
      if(i+h*60>=cs.length){assert.equal(e[`low${h}hPct`],null);continue;}
      const lows=cs.slice(i+1,i+h*60+1).map(c=>c.low);near(e[`low${h}hPct`],100*(Math.min(...lows)/cs[i].close-1));
      near(e[`close${h}hPct`],100*(cs[i+h*60].close/cs[i].close-1));}
  }
  const from=Date.parse(manifest.spec.from),end=Date.parse(manifest.spec.cutoff);
  const expectedGrid=[];for(let at=Math.ceil(from/(4*H))*4*H;at+24*H<=end;at+=4*H)expectedGrid.push(at);
  assert.deepEqual(grid.map(e=>e.at),expectedGrid);
  // Independent rolling-window peak implementation (no monotonic-queue reuse).
  const expectedDrops:number[]=[];let armed=true,recovery=0;
  for(let i=719;i<cs.length;i++){
    let high=0;for(let j=i-719;j<=i;j++)high=Math.max(high,cs[j].high);const dd=100*(cs[i].close/high-1);
    if(!armed){recovery=dd>=-1?recovery+1:0;if(recovery===60){armed=true;recovery=0;}}
    if(armed&&dd<=-3){if(cs[i].endTs>=from)expectedDrops.push(cs[i].endTs);armed=false;recovery=0;}
  }assert.deepEqual(events.filter(e=>e.cohort==="market_drop").map(e=>e.at),expectedDrops);
  const probes=[...contexts.values()].filter((_,i)=>i%170===0).map(c=>({c,best:{} as R}));
  const sourceInventory:R[]=read("source-inventory.json"),raw=new Map<string,Map<number,R>>();let rawVerified=0;
  for(const s of sourceInventory){const needs=needed.get(s.file)??new Map(),found=new Map<number,R>();
    await lines(s.file,(r,n)=>{const ref=needs.get(n);if(!ref&&!["book","asset","oi","funding","vault"].includes(s.kind))return;const sample=epoch(r.timestamp??r.ts),clocks=[r.receivedAt,r.observedAt,r.writtenAt,r.ingestedAt].filter(x=>x!=null).map(epoch);
      const bucket=s.kind==="taker"||s.kind.startsWith("candle"),source=s.kind==="taker"?epoch(r.windowEnd??sample):s.kind==="candle1m"?sample+M:s.kind==="candle5m"?sample+5*M:
        s.kind==="book"?epoch(r.exchangeTimestamp):s.kind==="asset"?Math.min(sample,r.receivedAt==null?sample:Number(r.receivedAt)):sample;
      const avail=Math.max(sample,source,...clocks,...(bucket&&!clocks.length?[source+M]:[]));
      if(!bucket)for(const p of probes){const old=p.best[s.kind];if(avail<=p.c.at&&source<=p.c.at&&(!old||source>old.source||source===old.source&&avail>=old.avail))p.best[s.kind]={source,avail,line:n};}
      if(!ref)return;
      assert.equal(ref.sampleAt,sample);assert.equal(ref.sourceAt,source);assert.equal(ref.availableAt,avail);
      if(s.kind==="taker")found.set(n,r);rawVerified++;
    });if(s.kind==="taker")raw.set(s.file,found);console.log(`[P01 check] ${s.kind}: ${needs.size} distinct references`);
  }
  const hs=JSON.parse(fs.readFileSync(manifest.spec.hlSpec,"utf8"));let selectionChecks=0;
  for(const p of probes)for(const kind of ["book","asset","oi","funding","vault"]){const raw=p.best[kind];
    if(raw&&p.c.at-raw.source<=hs.freshnessMs[kind]){assert.equal(p.c.hl.sources[kind].line,raw.line);selectionChecks++;}}
  assert.equal(rawVerified,[...needed.values()].reduce((s,m)=>s+m.size,0));let flows=0;
  for(const r of contexts.values())for(const [key,field]of [["taker15","takerRatio15"],["taker60","takerRatio60"],["taker240","takerRatio240"]]){
    const s=r.hl.sources[key],ratio=r.hl.features[field];if(ratio===null)continue;let buy=0,sell=0;const ends=new Set();
    for(const ref of s.sources){const x=raw.get(ref.file)!.get(ref.line)!;buy+=Number(x.buyNotional);sell+=Number(x.sellNotional);
      assert(ref.sourceAt>s.start&&ref.sourceAt<=s.end);assert(!ends.has(ref.sourceAt));ends.add(ref.sourceAt);}
    near(ratio,buy/sell);flows++;
  }
  // Recompute all market bin counts, including missingness, independently.
  const bins:R[]=read("bins.json"),comparisons:R[]=read("market-bin-comparisons.json");
  const flag=(x:R,b:R)=>{const v=contexts.get(x.at)!.values[b.feature];return typeof v!=="number"?null:b.op==="lt"?v<b.value:b.op==="le"?v<=b.value:b.op==="gt"?v>b.value:v>=b.value;};
  for(const r of comparisons){const b=bins.find(b=>b.id===r.bin)!,xs=grid.filter(x=>r.group==="all"||r.group==="early"&&x.at<Date.parse(manifest.spec.chronologyBoundary)||
    r.group==="late"&&x.at>=Date.parse(manifest.spec.chronologyBoundary)||new Date(x.at).toISOString().startsWith(r.group));
    for(const k of ["baseline","known","flagged","unflagged","unknown"]){const rows=xs.filter(x=>k==="baseline"||k==="known"&&flag(x,b)!==null||k==="flagged"&&flag(x,b)===true||k==="unflagged"&&flag(x,b)===false||k==="unknown"&&flag(x,b)===null);
      assert.equal(r[k].n,rows.length);assert.equal(r[k].positive,rows.filter(x=>x[r.label]).length);}
  }
  for(const r of read("pressure-bin-comparisons.json")){const b=bins.find(b=>b.id===r.bin)!;
    const xs=pressure.filter(x=>x.model===r.model&&x.landmarkMinutes===r.landmarkMinutes);
    for(const k of ["baseline","flagged","unflagged","unknown"]){const rows=xs.filter(x=>k==="baseline"||k==="flagged"&&flag(x,b)===true||k==="unflagged"&&flag(x,b)===false||k==="unknown"&&flag(x,b)===null),done=rows.filter(x=>x.outcome);
      assert.equal(r[k].n,rows.length);assert.equal(r[k].closed,done.length);assert.equal(r[k].wins,done.filter(x=>x.outcome.pnl>0).length);
      assert.equal(r[k].losses,done.filter(x=>x.outcome.pnl<0).length);
      near(r[k].winningDollars,done.reduce((s,x)=>s+Math.max(0,x.outcome.pnl),0));near(r[k].losingDollars,-done.reduce((s,x)=>s+Math.min(0,x.outcome.pnl),0));
      near(r[k].remainingDownside,-done.reduce((s,x)=>s+Math.min(0,x.remainingValueChange),0));near(r[k].remainingRecovery,done.reduce((s,x)=>s+Math.max(0,x.remainingValueChange),0));}
  }
  const archive="backtests/hype/hype-ladder-components-2026-09-08";
  for(const b of read("baseline.json")){
    const es:R[]=[];await lines(`${archive}/${b.model}--B17-inventory.jsonl`,r=>{if(r.event.kind==="close"&&!["tp","stale_tp"].includes(r.event.reason))es.push(r);});
    const got=events.filter(e=>e.model===b.model);assert.equal(got.length,b.metrics.forcedCloses);assert.equal(got.length,es.length);
    es.forEach(e=>assert(got.some(g=>g.episode===e.episode&&g.at===e.event.decisionAt&&g.fillAt===e.event.fillAt)));
    near(b.metrics.totalPnl,b.metrics.grossWin-b.metrics.grossLoss+b.metrics.openPnl);
  }
  const result={passed:true,at:new Date().toISOString(),contexts:contexts.size,events:events.length,marketBoundaries:grid.length,independentMarketDrops:expectedDrops.length,
    rawSourceReferences:refCount,rawSourceRowsVerified:rawVerified,flowWindowsRecomputed:flows,rawFullFileSelections:selectionChecks,marketBinComparisons:comparisons.length,baselineControlsExact:2,
    sourceSha256:await hash("scripts/pressure-point-check.ts"),economicReplay:false,liveChanges:0};
  fs.writeFileSync(path.join(out,"verification.json"),JSON.stringify(result,null,2)+"\n",{flag:"wx"});console.log(result);
}main().catch(e=>{console.error(e);process.exitCode=1;});
