/** SF05-HL: descriptive join of accepted SF05 trade attribution and SF04 HL map. No replay or raw-feed scan. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { ROOT } from './setup-scan-core';
import { atomicJson,fileHash,sha } from './research-workflow';
import { distribution } from './sfp-pressure-features';
import { csv } from './pressure-point-features';
import type { Row } from './tp-hl-event-features';
const SF05='backtests/sfp-rsi-ema/42e7c3a0ba432f2eb1abd9da7be2ec87e8a141a8c753369b0d45357c282ad4d9';
const SF04='backtests/sfp-pressure-map/0aa039e6bb818eab803e8ceba5b54c8b6f0fe242db24aa70fbcf46124d732207';
const read=(f:string)=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
async function main(){
  const pins:Row[]=[];
  for(const [dir,files] of [[SF05,['attribution.json','trades-60000-A_baseline-full.json']],[SF04,['trades.json','snapshots.json','summary.json']]] as const){
    const seal=read(`${dir}/complete.json`);
    for(const file of files){const actual=await fileHash(path.join(ROOT,dir,file));assert.equal(actual,seal.artifacts.find((a:Row)=>a.file===file).sha256);pins.push({file:`${dir}/${file}`,sha256:actual});}
  }
  for(const file of ['scripts/sfp-rsi-ema-hl-review.ts','scripts/sfp-pressure-features.ts','scripts/pressure-point-features.ts'])pins.push({file,sha256:await fileHash(path.join(ROOT,file))});
  const key=sha(JSON.stringify(pins)),out=path.join(ROOT,'backtests/sfp-rsi-ema-hl',key);
  if(fs.existsSync(path.join(out,'complete.json'))){for(const a of read(`${path.relative(ROOT,out)}/complete.json`).artifacts)assert.equal(await fileHash(path.join(out,a.file)),a.sha256);console.log(`[SF05-HL] verified cache ${key}`);return;}
  const attribution=read(`${SF05}/attribution.json`).find((r:Row)=>r.lag===60000&&r.window==='full'&&r.reference==='A_baseline'&&r.variant==='B_entry_block');
  const removed:Row[]=attribution.removed,base:Row[]=read(`${SF05}/trades-60000-A_baseline-full.json`).trades;
  const trades:Row[]=read(`${SF04}/trades.json`),snapshots:Row[]=read(`${SF04}/snapshots.json`),inventory=read(`${SF04}/summary.json`).sourceInventory;
  const ids=new Set(removed.map(t=>t.id));
  assert.equal(removed.filter(t=>t.net>0).length,5);assert.equal(removed.filter(t=>t.net<0).length,14);
  const sums=(xs:Row[])=>xs.reduce((v,t)=>v+t.net,0);
  assert(Math.abs(sums(removed.filter(t=>t.net>0))-attribution.removedWinningDollars)<1e-8);
  for(const t of trades){const b=base.find(b=>b.id===t.id)!;assert.equal(t.entryAt,b.entryAt);assert.equal(t.net,b.net);}
  const targetLedger=removed.map(t=>({...t,entryUtc:new Date(t.entryAt).toISOString(),hlMapped:trades.some(x=>x.id===t.id),
    missingReason:trades.some(x=>x.id===t.id)?null:inventory.every((s:Row)=>t.entryAt<s.first)?'predates_all_loaded_HL_sources':'not_in_saved_map'}));
  assert.equal(targetLedger.filter(t=>t.hlMapped).length,7);
  const groups:Record<string,Row[]>={blocked_winners:trades.filter(t=>ids.has(t.id)&&t.net>0),blocked_losers:trades.filter(t=>ids.has(t.id)&&t.net<0),
    other_stops:trades.filter(t=>!ids.has(t.id)&&t.group==='stop'),all_stops:trades.filter(t=>t.group==='stop'),other_winners:trades.filter(t=>!ids.has(t.id)&&t.net>0)};
  const rows=snapshots.filter(r=>r.anchor==='entry'&&r.offset<=0),fields=Object.keys(rows[0].values).filter(k=>k.startsWith('hl_'));
  let checks=0;
  for(const r of rows){const t=trades.find(t=>t.id===r.id)!;assert.equal(r.at,t.entryAt+r.offset*60000);assert(r.at<=t.entryAt&&r.delayed.at===r.at-60000);
    for(const s of Object.values(r.sources.hl) as Row[]){if(!s)continue;if(s.availableAt!=null){assert(s.availableAt<=(s.queryAt??r.at));assert(s.sourceAt<=(s.queryAt??r.at));checks++;}
      if(s.availableMax!=null){assert(s.availableMax<=r.at&&s.sourceMax<=r.at);checks++;}}
  }
  const stats:Row[]=[];
  for(const [group,ts] of Object.entries(groups))for(const offset of [-60,-15,0])for(const delayed of [false,true])for(const feature of fields){
    const rs=ts.map(t=>rows.find(r=>r.id===t.id&&r.offset===offset)!);assert(rs.every(Boolean));
    stats.push({group,offset,delayed,feature,...distribution(rs.map(r=>(delayed?r.delayed.values:r.values)[feature]))});
  }
  const trajectory=trades.map(t=>{const rs=rows.filter(r=>r.id===t.id&&r.offset>=-15);assert.equal(rs.length,16);
    const values=rs.map(r=>r.values.hl_takerRatio60).filter(v=>typeof v==='number'&&Number.isFinite(v));
    return {id:t.id,entryUtc:t.entryIso,outcome:t.group,blocked:ids.has(t.id),points:rs.length,healthy1hPoints:values.length,
      buying1hPoints:values.filter(v=>v>1).length,minTaker1h:Math.min(...values),maxTaker1h:Math.max(...values),
      firstTaker15:rs[0].values.hl_takerRatio15,lastTaker15:rs.at(-1)!.values.hl_takerRatio15};});
  const summary={key,kind:'descriptive_only',economicVariants:0,sourceRows:rows.length,checks,
    baseline:{closedTrades:base.length,wins:base.filter(t=>t.net>0).length,losses:base.filter(t=>t.net<0).length},
    groups:Object.fromEntries(Object.entries(groups).map(([g,ts])=>[g,{n:ts.length,net:sums(ts),months:Object.fromEntries([...new Set(ts.map(t=>t.month))].map(m=>[m,ts.filter(t=>t.month===m).length]))}])),
    unavailableTargetTrades:targetLedger.filter(t=>!t.hlMapped).length,
    baselineLossesNotInMap:base.filter(t=>t.net<0&&!trades.some(x=>x.id===t.id)).map(t=>({id:t.id,entryAt:t.entryAt,net:t.net,reason:t.reason,
      missingReason:inventory.every((s:Row)=>t.entryAt<s.first)?'predates_all_loaded_HL_sources':'not_in_saved_map'})),
    limitations:['Three HL-covered blocked winners, four blocked losers, not five versus fourteen.',
      'Broader comparator is ten mapped stops, not all losing trades; September11 losing timeout was excluded from SF04.',
      'Rolling lead-in snapshots are overlapping, not independent samples. June/August winners versus June/September losers confound time regime.',
      'No inferred historical receipts: saved availability uses conservative legacy models/proxies. No post-entry predictor.',
      'No fitted thresholds, rescue-rule earnings, replay, live config or new raw-data fetch.']};
  const rowsCsv=rows.map(r=>{const t=trades.find(t=>t.id===r.id)!;return {id:t.id,entryUtc:t.entryIso,outcome:t.group,blocked:ids.has(t.id),net:t.net,
    offset:r.offset,asOf:new Date(r.at).toISOString(),...Object.fromEntries(fields.map(f=>[f,r.values[f]])),quality:r.quality};});
  fs.mkdirSync(out,{recursive:true});const write=(f:string,x:unknown)=>atomicJson(path.join(out,f),x);
  write('plan.json',{key,pins,SF04,SF05,createdAt:Date.now(),scope:'Inspect SF05 blocked winners against blocked losers, other stops and other winners using saved pre-entry HL evidence only.'});
  write('summary.json',summary);write('target-trades.json',targetLedger);write('feature-summary.json',stats);write('trajectories.json',trajectory);
  write('snapshots.json',rows.map(r=>({id:r.id,offset:r.offset,at:r.at,values:Object.fromEntries(fields.map(f=>[f,r.values[f]])),quality:r.quality,sources:r.sources.hl,
    delayed:{at:r.delayed.at,values:Object.fromEntries(fields.map(f=>[f,r.delayed.values[f]])),quality:r.delayed.quality}})));
  fs.writeFileSync(path.join(out,'features.csv'),csv(rowsCsv));fs.writeFileSync(path.join(out,'feature-summary.csv'),csv(stats));
  const artifacts=await Promise.all(fs.readdirSync(out).sort().map(async file=>({file,sha256:await fileHash(path.join(out,file))})));
  write('complete.json',{key,artifacts});atomicJson(path.join(ROOT,'backtests/sfp-rsi-ema-hl/latest.json'),{key,dir:path.relative(ROOT,out)});
  console.log(JSON.stringify({key,checks,groups:summary.groups,unavailableTargetTrades:summary.unavailableTargetTrades},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
