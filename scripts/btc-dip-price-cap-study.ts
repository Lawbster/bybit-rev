import fs from "fs";
import path from "path";
import readline from "readline";
import assert from "assert/strict";
import {runCappedEntry,H,type EntrySignal}from "./btc-dip-price-cap-engine";
import {read,features,signalTimes,data,type Spec}from "./btc-hype-threshold-study";
import {createPlan,executePlan,verifyPins,atomicJson,sha,type Plan}from "./research-workflow";
export const CARD="research-inputs/btc-dip-price-cap-2026-09-14.json";
type R=Record<string,any>;
export function parentDir(d:R){return `backtests/research-workflow/${d.parentJob}`;}
export function validate(d:R){assert.equal(d.parentRule,"btc_L1_T0.5_P-1_long_H12");assert.equal(d.clockRule,"clock_L1_T0_P0_long_H12");
  assert.deepEqual(d.expiryMinutes,[5,15,30,60]);assert.equal(d.holdHours,12);assert.equal(d.notional,10000);
  assert.equal(d.equity,32000);assert.equal(d.feeRate,.00055);assert.equal(d.runs,40);assert.equal(d.newTradingDefinitions,4);
  assert.deepEqual(d.executionDelaysMs,[0,60000]);assert.deepEqual(d.fillModels,[{id:"open_cap",penetrationBps:0},{id:"open_through5",penetrationBps:5}]);}
async function worker(plan:Plan,out:string){const d=plan.card.definition;validate(d);
  const old=parentDir(d),archived:R[]=read(`${old}/output/results.json`),archivedTrades=new Map<string,any[]>();
  const controls=archived.filter(x=>[d.parentRule,d.clockRule].includes(x.spec.id));assert.equal(controls.length,8);
  const needed=new Set(controls.map(x=>x.name));
  for await(const line of readline.createInterface({input:fs.createReadStream(`${old}/output/trades.jsonl`),crlfDelay:Infinity})){
    const r=JSON.parse(line);if(needed.has(r.name))archivedTrades.set(r.name,r.trades);}
  const {asset,market}=await data(d),start=Date.parse(d.windows[0].start),end=Date.parse(d.cutoff);
  const f=features(asset.candles,market.candles,start,end,1),savedSignals=read(`${old}/output/signals.json`);
  const rule:Spec={id:d.parentRule,family:"btc",lookbackHours:1,threshold:.5,polarity:-1,side:"long",holdHours:12};
  const times=signalTimes(f,rule),clock=signalTimes(f,{...rule,family:"clock",threshold:0,polarity:0});
  assert.deepEqual(times,savedSignals["btc_L1_T0.5_P-1"]);assert.deepEqual(clock,savedSignals.clock_L1_T0_P0);
  const byEnd=new Map(asset.candles.map(c=>[c.endTs,c.close]));
  const windows=d.windows.map((w:R)=>({...w,minutes:asset.candles.filter(c=>c.ts>=Date.parse(w.start)&&c.endTs<=Date.parse(w.end))}));
  atomicJson(path.join(out,"data-audit.json"),{asset:asset.audit,market:market.audit,signalsExact:true});
  atomicJson(path.join(out,"signals.json"),times.map(at=>({at,cap:byEnd.get(at)!})));
  const rows:R[]=[],parity:R[]=[];
  function run(w:R,delayMs:number,expiryMinutes:number|null,model:R,controlRule?:string){
    const name=`${w.id}_delay${delayMs}_${controlRule??`cap${expiryMinutes}_${model.id}`}`;
    const source=controlRule===d.clockRule?clock:times;
    const signals:EntrySignal[]=source.filter(t=>t>=Date.parse(w.start)&&t<Date.parse(w.end)).map(at=>({at,cap:byEnd.get(at)!}));
    const options={start:Date.parse(w.start),end:Date.parse(w.end),delayMs,holdMs:12*H,notional:d.notional,equity:d.equity,
      feeRate:d.feeRate,expiryMinutes,penetrationBps:model.penetrationBps};
    const r=runCappedEntry(w.minutes,signals,options);
    if(controlRule){const a=controls.find(x=>x.name===name)!;assert(a);
      for(const field of ["stats","monthly","open"]as const)assert.deepEqual(r[field],a[field],`BH01 parity ${name}/${field}`);
      assert.deepEqual(r.trades,archivedTrades.get(name),`BH01 exact trades ${name}`);
      parity.push({name,sha256:sha(JSON.stringify({stats:r.stats,monthly:r.monthly,open:r.open,trades:r.trades}))});}
    const row={name,window:w.id,start:w.start,end:w.end,delayMs,expiryMinutes,model:model.id,controlRule:controlRule??null,
      options,stats:r.stats,monthly:r.monthly,open:r.open,entryStats:r.entryStats,
      stressNet:r.stats.net-r.stats.turnoverIncludingMarkedExit*d.extraStressRatePerSide};
    atomicJson(path.join(out,`${name}.json`),{...row,trades:r.trades,intents:r.intents,occupiedSignals:r.occupiedSignals});rows.push(row);
    console.log(`[BH02 ${rows.length}/40] ${name} net=${r.stats.net.toFixed(2)} DD=${r.stats.maxAdverseDrawdownPct.toFixed(2)} fills=${r.entryStats.filled} expired=${r.entryStats.expired}`);
  }
  for(const w of windows)for(const lag of d.executionDelaysMs)for(const control of [d.parentRule,d.clockRule])run(w,lag,null,{id:"market",penetrationBps:0},control);
  assert.equal(parity.length,8);atomicJson(path.join(out,"control-parity.json"),{passed:true,cases:parity});
  for(const w of windows)for(const lag of d.executionDelaysMs)for(const model of d.fillModels)for(const expiry of d.expiryMinutes)run(w,lag,expiry,model);
  assert.equal(rows.length,40);atomicJson(path.join(out,"results.json"),rows);
  atomicJson(path.join(out,"validation.json"),{passed:true,cases:40,exactArchivedControls:8,newDefinitions:4,independentVerificationRequired:true,liveChanges:0});
}
async function main(){const [cmd,key]=process.argv.slice(2),card=read(CARD),d=card.definition;validate(d);
  if(cmd==="plan"){
    const dir=parentDir(d),old=read(`${dir}/plan.json`),state=read(`${dir}/state.json`);assert.equal(state.status,"complete");assert(read(`${dir}/verification.json`).passed);
    await verifyPins(process.cwd(),[...old.pins,...old.protectedPins,...state.artifacts]);
    const p=await createPlan(process.cwd(),card,[...old.pins.map((p:R)=>p.file),CARD,"docs/research/btc-dip-price-cap-bh02.md",
      "scripts/btc-dip-price-cap-engine.ts","scripts/btc-dip-price-cap-study.ts","scripts/btc-dip-price-cap-tests.ts","scripts/btc-dip-price-cap-verify.ts"],old.protectedPins.map((p:R)=>p.file));
    console.log(JSON.stringify({key:p.key,runs:40,definitions:4}));
  }else{assert.equal(cmd,"run");await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
