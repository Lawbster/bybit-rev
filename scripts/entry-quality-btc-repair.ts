/** Bounded research-only BTC gap recovery. Raw archives and replay gates unchanged. */
import fs from 'fs';
import assert from 'assert/strict';
import path from 'path';
import {loadMinutes} from './relative-reversion-study';
import {missingMinutes} from './replay-candle-repair';
import {atomicJson,fileHash,sha,verifyPins} from './research-workflow';
import type {Candle} from './hype-freerun-canonical-replay';
type R=Record<string,any>;const M=60000;
export const BTC_REPAIR='backtests/hype/entry-quality-btc-repair-2026-09-15/bundle.json';
const url=(interval:number,start:number,end:number)=>`https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=${interval}&start=${start}&end=${end}&limit=1000`;
function parse(p:R):Candle[]{assert.equal(p.url,url(p.interval,p.start,p.end));assert.equal(sha(p.body),p.sha256);
  assert(p.requestedAt<=p.receivedAt&&p.receivedAt>p.end);const j=JSON.parse(p.body);assert.equal(j.retCode,0);assert.equal(j.result.symbol,'BTCUSDT');assert.equal(j.result.category,'linear');
  const rows:Candle[]=j.result.list.map((r:any)=>{assert.equal(r.length,7);const [ts,open,high,low,close,volume,turnover]=r.map(Number);
    assert([ts,open,high,low,close,volume,turnover].every(Number.isFinite));assert(ts% (p.interval*M)===0&&ts>=p.start&&ts<=p.end&&ts+p.interval*M<=p.receivedAt);
    assert(Math.min(open,high,low,close)>0&&volume>=0&&turnover>=0&&low<=Math.min(open,close)&&high>=Math.max(open,close));return {ts,endTs:ts+p.interval*M,open,high,low,close,volume,turnover};});
  rows.sort((a,b)=>a.ts-b.ts);assert.equal(rows.length,Math.ceil((p.end-p.start+1)/(p.interval*M)));
  rows.forEach((c,i)=>assert.equal(c.ts,p.start+i*p.interval*M));return rows;
}
const equal=(a:number,b:number)=>assert(Math.abs(a-b)<=1e-7+1e-10*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);
export function applyBtcRepair(base:Candle[],bundle:R,cutoff:number){assert.equal(bundle.purpose,'corrected_exchange_history_not_recorded_arrival');
  assert.equal(bundle.symbol,'BTCUSDT');assert.equal(bundle.version,1);assert(bundle.cutoff>=cutoff);
  const minutes=new Map<number,Candle>(),fives=new Map<number,Candle>();
  for(const p of bundle.pages){assert([1,5].includes(p.interval));assert(p.receivedAt<=bundle.retrievedAt);const map=p.interval===1?minutes:fives;
    for(const c of parse(p)){if(map.has(c.ts))assert.deepEqual(c,map.get(c.ts));map.set(c.ts,c);}}
  let nativeChecks=0,neighbors=0;for(const [t,f] of fives){const rows=Array.from({length:5},(_,k)=>minutes.get(t+k*M));assert(rows.every(Boolean));const b=rows as Candle[];
    equal(f.open,b[0].open);equal(f.close,b[4].close);equal(f.high,Math.max(...b.map(c=>c.high)));equal(f.low,Math.min(...b.map(c=>c.low)));
    equal(f.volume,b.reduce((n,c)=>n+c.volume,0));equal(f.turnover,b.reduce((n,c)=>n+c.turnover,0));nativeChecks++;}
  const local=new Map(base.map(c=>[c.ts,c]));for(const c of minutes.values())if(local.has(c.ts)){assert.deepEqual(c,local.get(c.ts),`BTC neighbor ${c.ts}`);neighbors++;}
  assert.equal(new Set(bundle.missing).size,bundle.missing.length);assert(bundle.missing.length<=30000);
  const inserts:Candle[]=bundle.missing.filter((t:number)=>t+M<=cutoff).map((t:number)=>{assert(!local.has(t));const c=minutes.get(t);assert(c&&fives.has(Math.floor(t/(5*M))*5*M));return c;});
  const candles=[...base,...inserts].sort((a,b)=>a.ts-b.ts);return {candles,audit:{inserted:inserts.length,nativeChecks,neighbors,pages:bundle.pages.length}};
}
async function main(){const [cmd]=process.argv.slice(2);assert.equal(cmd,'fetch');assert(!fs.existsSync(BTC_REPAIR),'Do not overwrite accepted repair');
  const cutoff=Date.parse('2026-09-14T15:27:00Z'),base=await loadMinutes(process.cwd(),'BTCUSDT',cutoff),missing=missingMinutes(base.candles,30000);
  assert.equal(missing.length,28207,'Source gap count changed; review before fetch');
  const originalInputs=await Promise.all(['data/BTCUSDT_1_full.json','data/BTCUSDT_1m.jsonl'].map(async file=>({file,bytes:fs.statSync(file).size,sha256:await fileHash(file)})));
  const starts=[...new Set(missing.map(t=>Math.floor(t/(5*M))*5*M))].sort((a,b)=>a-b),ranges:R[]=[];
  for(const t of starts){const last=ranges.at(-1);if(last&&t===last.end)last.end=t+5*M;else ranges.push({start:t,end:t+5*M});}
  const dir=path.dirname(BTC_REPAIR);fs.mkdirSync(dir,{recursive:false});const pages:R[]=[];
  for(const r of ranges)for(const interval of [1,5])for(let start=r.start;start<r.end;start+=1000*interval*M){
    const end=Math.min(r.end,start+1000*interval*M)-1,requestedAt=Date.now(),u=url(interval,start,end);
    const response=await fetch(u,{signal:AbortSignal.timeout(15000)}),body=await response.text();assert(response.ok,`HTTP ${response.status}`);
    const p={interval,start,end,url:u,requestedAt,receivedAt:Date.now(),body,sha256:sha(body)};parse(p);pages.push(p);
    atomicJson(`${dir}/fetch-progress.json`,{status:'in_progress',pages});console.log(`[BTC repair] page ${pages.length}: ${interval}m ${new Date(start).toISOString()}`);
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  const bundle={version:1,symbol:'BTCUSDT',purpose:'corrected_exchange_history_not_recorded_arrival',cutoff,retrievedAt:Date.now(),originalInputs,
    generatorSha256:sha(fs.readFileSync(__filename)),missing,ranges,pages};
  const checked=applyBtcRepair(base.candles,bundle,cutoff);assert.equal(missingMinutes(checked.candles).length,0);
  await verifyPins(process.cwd(),originalInputs);atomicJson(BTC_REPAIR,bundle);atomicJson(`${dir}/verification.json`,{passed:true,...checked.audit,
    bundleSha256:sha(fs.readFileSync(BTC_REPAIR)),rawSourcesChanged:false,baselineGatesChanged:false});console.log(JSON.stringify(checked.audit));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
