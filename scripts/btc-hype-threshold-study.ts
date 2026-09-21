/** BH01: local research, canonical C01 execution, no exchange or live writes. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { loadMinutes } from "./relative-reversion-study";
import { runCombination, type Opportunity } from "./indicator-combination-engine";
import type { Candle } from "./hype-freerun-canonical-replay";
import { atomicJson, createPlan, executePlan, type Plan } from "./research-workflow";
export const CARD = "research-inputs/btc-hype-threshold-2026-09-14.json";
export const M = 60000, H = 60 * M, GRID = 15 * M;
type R = Record<string, any>;
export type Feature = { at:number; lookbackHours:number; ready:boolean; hype:number|null; btc:number|null; gap:number|null };
export type Spec = { id:string; family:"gap"|"btc"|"clock"; lookbackHours:number; threshold:number; polarity:number; side:"long"|"short"; holdHours:number };
export const read = (file:string):any => JSON.parse(fs.readFileSync(file,"utf8"));
export function specifications(d:R):Spec[] {
  const specs:Spec[]=[];
  for(const family of ["clock","gap","btc"] as const) for(const lookbackHours of d.lookbackHours)
    for(const threshold of family==="clock"?[0]:d.thresholds[family]) for(const polarity of family==="clock"?[0]:d.polarities)
      for(const side of d.sides) for(const holdHours of d.holdHours)
        specs.push({id:`${family}_L${lookbackHours}_T${threshold}_P${polarity}_${side}_H${holdHours}`,family,lookbackHours,threshold,polarity,side,holdHours});
  assert.equal(specs.length,234); return specs;
}
/** Index-distance test proves every minute exists: timestamps are sorted unique. */
export function features(asset:readonly Candle[], market:readonly Candle[], start:number, end:number, hours:number):Feature[] {
  const indices=(cs:readonly Candle[])=>new Map(cs.map((c,i)=>[c.endTs,i]));
  const ai=indices(asset),bi=indices(market),count=hours*60;
  function ret(cs:readonly Candle[], idx:Map<number,number>, t:number):number|null {
    const b=idx.get(t),a=idx.get(t-hours*H);
    return a===undefined||b===undefined||b-a!==count?null:100*(cs[b].close/cs[a].close-1);
  }
  const rows:Feature[]=[];
  for(let at=Math.ceil(start/GRID)*GRID-GRID;at<end;at+=GRID){
    const hype=ret(asset,ai,at),btc=ret(market,bi,at);
    rows.push({at,lookbackHours:hours,ready:hype!==null&&btc!==null,hype,btc,gap:hype===null||btc===null?null:hype-btc});
  }
  return rows;
}
export function signalTimes(rows:readonly Feature[], s:Spec):number[] {
  const out:number[]=[];
  for(let i=1;i<rows.length;i++){
    const p=rows[i-1],c=rows[i]; if(!p.ready||!c.ready||c.at-p.at!==GRID)continue;
    if(s.family==="clock" || (p[s.family]!*s.polarity<s.threshold && c[s.family]!*s.polarity>=s.threshold))out.push(c.at);
  }
  return out;
}
export function opportunities(times:readonly number[]):Opportunity[] {
  // C01's feature envelope only needs the source timestamp. No fake indicator values.
  return times.map(at=>({at,sourceStart:at-M,sourceEnd:at,availableAt:at,previousStart:at-GRID-M,
    feature:{timestamp:at-M} as Opportunity["feature"]}));
}
export async function data(d:R) {
  const end=Date.parse(d.cutoff);
  const asset=await loadMinutes(process.cwd(),"HYPEUSDT",end,d.repair);
  const market=await loadMinutes(process.cwd(),"BTCUSDT",end);
  assert.equal(asset.candles.at(-1)!.endTs,end); assert.equal(market.candles.at(-1)!.endTs,end);
  asset.candles.forEach((c,i)=>assert(!i||c.ts===asset.candles[i-1].endTs,"HYPE execution tape gap"));
  return {asset,market};
}
function validate(d:R) {
  assert.equal(d.newTradingDefinitions,216);assert.equal(d.runs,936);
  assert.deepEqual(d.lookbackHours,[1,4,24]);assert.deepEqual(d.holdHours,[4,12,24]);
  assert.deepEqual(d.thresholds,{gap:[1,2,4],btc:[.5,1,2]});assert.deepEqual(d.executionDelaysMs,[0,M]);
  assert.equal(d.gridMinutes,15);assert.equal(d.notional,10000);assert.equal(d.equity,32000);assert.equal(d.feeRate,.00055);
}
async function worker(plan:Plan,out:string) {
  const d=plan.card.definition;validate(d);console.log("[BH01] loading HYPE and BTC closed-minute histories");
  const {asset,market}=await data(d),specs=specifications(d);
  const start=Date.parse(d.windows[0].start),end=Date.parse(d.cutoff);
  const featureRows=new Map(d.lookbackHours.map((h:number)=>[h,features(asset.candles,market.candles,start,end,h)]));
  atomicJson(path.join(out,"data-audit.json"),{asset:asset.audit,market:market.audit,closedHypeRows:asset.candles.length,
    readiness:d.windows.flatMap((w:R)=>d.lookbackHours.map((h:number)=>{
      const rows=(featureRows.get(h) as Feature[]).filter(x=>x.at>=Date.parse(w.start)&&x.at<Date.parse(w.end));
      return {window:w.id,hours:h,clocks:rows.length,ready:rows.filter(x=>x.ready).length};
    }))});
  const signals=new Map<string,number[]>(),summary:R[]=[];
  const signalKey=(s:Spec)=>`${s.family}_L${s.lookbackHours}_T${s.threshold}_P${s.polarity}`;
  for(const s of specs)if(!signals.has(signalKey(s)))signals.set(signalKey(s),signalTimes(featureRows.get(s.lookbackHours) as Feature[],s));
  atomicJson(path.join(out,"signals.json"),Object.fromEntries(signals));
  atomicJson(path.join(out,"features.json"),Object.fromEntries(featureRows));
  const periods=d.windows.map((w:R)=>({...w,minutes:asset.candles.filter(c=>c.ts>=Date.parse(w.start)&&c.endTs<=Date.parse(w.end))
    .map(c=>({timestamp:c.ts,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume,turnover:c.turnover}))}));
  const fd=fs.openSync(path.join(out,"trades.jsonl"),"wx");
  try {
    // All 72 matched canonical controls first, then the frozen 864 variant cases.
    for(const spec of specs)for(const w of periods)for(const delayMs of d.executionDelaysMs){
      const name=`${w.id}_delay${delayMs}_${spec.id}`,ts=signals.get(signalKey(spec))!;
      const r=runCombination(w.minutes,opportunities(ts.filter(t=>t>=Date.parse(w.start)&&t<Date.parse(w.end))),spec.side,
        {start:Date.parse(w.start),end:Date.parse(w.end),delayMs,holdMs:spec.holdHours*H,notional:d.notional,equity:d.equity,feeRate:d.feeRate});
      const row={name,spec,window:w.id,start:w.start,end:w.end,delayMs,stats:r.stats,monthly:r.monthly,open:r.open,
        stressNet:r.stats.net-r.stats.turnoverIncludingMarkedExit*d.extraStressRatePerSide};
      fs.writeSync(fd,JSON.stringify({name,trades:r.trades.map(({entryFeature,...t})=>t)})+"\n");
      summary.push(row);
      if(summary.length%12===0){atomicJson(path.join(out,"results.json"),summary);console.log(`[BH01 ${summary.length}/936] ${name}`);}
    }
  }finally{fs.closeSync(fd);}
  assert.equal(summary.length,936);atomicJson(path.join(out,"results.json"),summary);
  atomicJson(path.join(out,"validation.json"),{passed:true,canonicalStandaloneEngine:"runCombination unchanged",controlCases:72,variantCases:864,newDefinitions:216,independentVerificationRequired:true});
}
/** Pin the full statically imported local source closure, including type imports. */
function sourceClosure(seeds:string[]):string[] {
  const seen=new Set<string>();
  function visit(file:string){if(seen.has(file))return;seen.add(file);const source=fs.readFileSync(file,"utf8");
    for(const match of source.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*["'](\.[^"']+)["']/g)){
      const base=path.resolve(path.dirname(file),match[1]);const found=[`${base}.ts`,`${base}.json`,path.join(base,"index.ts")].find(x=>fs.existsSync(x));
      assert(found,`Unresolved source dependency ${file}: ${match[1]}`);
      const rel=path.relative(process.cwd(),found).replace(/\\/g,"/");assert(!rel.startsWith(".."));
      if(rel.endsWith(".ts"))visit(rel);else seen.add(rel);
    }
  }
  seeds.forEach(visit);return [...seen];
}
async function main(){const [cmd,key]=process.argv.slice(2),card=read(CARD);validate(card.definition);
  if(cmd==="plan"){
    const sources=[CARD,"docs/research/btc-hype-threshold-bh01.md",...sourceClosure([
      "scripts/btc-hype-threshold-study.ts","scripts/btc-hype-threshold-tests.ts","scripts/btc-hype-threshold-verify.ts"])];
    const p=await createPlan(process.cwd(),card,sources,["bot-config.json","bot-state.json","hl-short-live-config.json",
      "src/bot/index.ts","src/bot/state.ts","src/hyperliquid-collector.ts"]);console.log(JSON.stringify({key:p.key,runs:936,newDefinitions:216}));
  }else{assert.equal(cmd,"run");await executePlan(process.cwd(),key,worker);}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
