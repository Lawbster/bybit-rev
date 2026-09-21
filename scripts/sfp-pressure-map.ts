/** SF04: bounded descriptive cohort, no new strategy or trade replay. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { ROOT, loadTape } from './setup-scan-core';
import { parseCsv } from './setup-chart';
import { atomicJson, fileHash, sha } from './research-workflow';
import { TpHlTape, normalize, type Row } from './tp-hl-event-features';
import { Inputs, SOURCES } from './hype-tp-hl-event-atlas';
import { hlSnapshot, csv, upper } from './pressure-point-features';
import { checkpoints, contextIndicators, compactSources, recoveryLabel, distribution, M, H } from './sfp-pressure-features';
const CARD='research-inputs/sfp-pressure-map-sf04-2026-09-20.json';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
async function verify(d:string){for(const a of read(path.join(d,'complete.json')).artifacts)assert.equal(await fileHash(path.join(d,a.file)),a.sha256);}
async function main(){
  const card=read(path.join(ROOT,CARD)),pd=path.join(ROOT,card.parentStudy);await verify(pd);
  const parent=read(path.join(pd,'comparison.json')),base=parent.runs.find((r:Row)=>r.name===card.parentName&&r.lag===card.parentLagMs);
  const rd=path.join(ROOT,'backtests/setup-replays',base.replay),sd=path.join(ROOT,'backtests/setup-scans',base.scan);await verify(rd);await verify(sd);
  const tradeFile=path.join(rd,`trades-${card.cell}.csv`), raw=parseCsv(fs.readFileSync(tradeFile,'utf8'));
  const all=raw.map((t:any)=>({...t,...Object.fromEntries(['entryAt','exitAt','entryPrice','exitPrice','signalAt','stop','target','net','fees','qty','r'].map(k=>[k,Number(t[k])]))}));
  const baseline=base.results.find((r:Row)=>r.cell===card.cell&&r.window==='full'&&r.delay===0&&!r.targetFirst&&!r.stress);
  assert.equal(all.length,baseline.n);assert(Math.abs(all.reduce((s:number,t:any)=>s+t.net,0)-baseline.closedNet)<1e-7);
  const from=Date.parse(card.from),end=Date.parse(card.end),census=all.filter((t:any)=>t.entryAt>=from);
  const events=fs.readFileSync(path.join(sd,'events.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
  const selected:Row[]=census.filter((t:any)=>t.reason==='stop'||t.net>0).map((t:any)=>({...t,group:t.reason==='stop'?'stop':'win',
    entryIso:new Date(t.entryAt).toISOString(),exitIso:new Date(t.exitAt).toISOString(),month:new Date(t.entryAt).toISOString().slice(0,7),
    riskPct:100*(t.entryPrice-t.stop)/t.entryPrice,holdHours:(t.exitAt-t.entryAt)/H,
    sweep:events.find((e:any)=>e.id===t.id).stages.sweep.price,range:events.find((e:any)=>e.id===t.id).reference.zone}));
  assert(selected.filter(t=>t.group==='win').length<=card.requestedPerGroup&&selected.filter(t=>t.group==='stop').length<=card.requestedPerGroup,
    'Cohort expanded: freeze a selection rule instead of silently taking extra trades');
  const plan=read(path.join(sd,'plan.json')),cache=path.dirname(plan.tape.file),seal=read(path.join(ROOT,cache,'complete.json'));
  const candlePins=seal.artifacts.filter((a:Row)=>['candles.f64','schema.json'].includes(a.file)).map((a:Row)=>({...a,file:`${cache}/${a.file}`}));
  for(const p of candlePins)assert.equal(await fileHash(path.join(ROOT,p.file)),p.sha256);
  const sources=SOURCES.filter(([kind])=>card.hlSources.includes(kind));
  const files=[CARD,card.hlSpec,'scripts/sfp-pressure-map.ts','scripts/sfp-pressure-features.ts','scripts/pressure-point-features.ts',
    'scripts/tp-hl-event-features.ts','scripts/hype-tp-hl-event-atlas.ts','scripts/setup-scan-core.ts','src/research/closed-bars.ts',
    'src/research/indicator-features.ts','src/research/vwap-volume-features.ts','src/research/volume-flow-features.ts',
    'src/research/macd-features.ts','src/research/bollinger-features.ts','src/research/atr-efficiency-features.ts',
    'node_modules/technicalindicators/lib/moving_averages/EMA.js',path.relative(ROOT,tradeFile),...sources.map(([,f])=>f)];
  const pins=await Promise.all(files.map(async file=>({file,sha256:await fileHash(path.join(ROOT,file))})));
  const key=sha(JSON.stringify({card,pins,candlePins,parent:parent.key})),out=path.join(ROOT,'backtests/sfp-pressure-map',key);
  if(fs.existsSync(path.join(out,'complete.json'))){await verify(out);console.log(`[SF04] verified cached map ${out}`);return;}
  fs.mkdirSync(out,{recursive:true});
  const selection={requestedPerGroup:card.requestedPerGroup,availableWins:selected.filter(t=>t.group==='win').length,
    availableStops:selected.filter(t=>t.group==='stop').length,excluded:census.filter((t:any)=>!selected.some(s=>s.id===t.id)).map((t:any)=>({id:t.id,reason:t.reason,net:t.net})),
    fullBaseline:baseline,cohortAtSelection:selected};
  atomicJson(path.join(out,'selection.json'),selection);const selectionHash=await fileHash(path.join(out,'selection.json'));
  console.log(`[SF04] sealed selection before features: ${selection.availableWins} wins / ${selection.availableStops} stops`);
  const requests=selected.flatMap(t=>checkpoints(t,end,card)),times=[...new Set<number>(requests.flatMap(r=>[r.at,r.at-M]))].sort((a,b)=>a-b);
  const schema=read(path.join(ROOT,cache,'schema.json'));
  const {minutes}=await loadTape(ROOT,'HYPEUSDT',schema.start,end,M,'sealed');
  const indicators=contextIndicators(minutes,times,card);
  console.log(`[SF04] closed-bar indicators/EMA computed once for ${times.length} distinct clocks`);
  const spec=read(path.join(ROOT,card.hlSpec)),tape=new TpHlTape(spec),inputs=new Inputs(),inventory:Row[]=[];
  const ranges:Array<[number,number]>=[];
  for(const at of times){const start=at-245*M,prev=ranges.at(-1);if(prev&&start<=prev[1])prev[1]=at;else ranges.push([start,at]);}
  const starts=ranges.map(r=>r[0]),retain=(at:number)=>{const i=upper(starts,at)-1;return i>=0&&at<=ranges[i][1];};
  for(const [kind,file] of sources){const inv:Row={kind,file,rows:0,retained:0,first:null,last:null};
    await inputs.rows(file,(r,line)=>{inv.rows++;const at=Number(r.timestamp??r.ts);inv.first=Math.min(inv.first??Infinity,at);inv.last=Math.max(inv.last??0,at);
      if(retain(at)){tape.add(normalize(kind,r,file,line));inv.retained++;}});
    inventory.push(inv);console.log(`[SF04] ${kind}: retained ${inv.retained}/${inv.rows}`);
  }
  for(const p of inputs.pins)assert.equal(p.sha256,pins.find(x=>x.file===p.file)!.sha256,'source changed');tape.seal();
  const snapshots=new Map<number,Row>();
  const price=(at:number)=>minutes[(at-2*M-minutes[0].ts)/M]?.close;
  for(const at of times){const h=hlSnapshot(tape,at,M),i=indicators.get(at)!,v:Row={...i.values};
    for(const [k,x] of Object.entries(h.features))v[`hl_${k}`]=x;
    v.hl_largeNetShare15=h.features.largeBuy15Usd!==null&&h.features.largeSell15Usd!==null&&h.features.turnover15Usd>0?
      (h.features.largeBuy15Usd-h.features.largeSell15Usd)/h.features.turnover15Usd:null;
    v.price=price(at);for(const n of [15,60,240])v[`priceReturn${n}Pct`]=100*(v.price/price(at-n*M)-1);
    snapshots.set(at,{at,values:v,quality:h.quality,sources:{candles:i.sources,hl:compactSources(h)},priceSource:{barStart:at-2*M,barEnd:at-M,availableAt:at}});
  }
  const rows:Row[]=requests.map(q=>{const t=selected.find(t=>t.id===q.id)!,s=snapshots.get(q.at)!,delayed=snapshots.get(q.at-M)!;
    return {...q,group:t.group,iso:new Date(q.at).toISOString(),...s,delayed:{at:delayed.at,values:delayed.values,quality:delayed.quality},
      rangePositionPct:100*(s.values.price-t.range.low)/(t.range.high-t.range.low),entryReturnPct:100*(s.values.price/t.entryPrice-1)};});
  for(const t of selected)t.recovery=recoveryLabel(minutes,t,end);
  const money=(ts:Row[])=>({n:ts.length,net:ts.reduce((s,t)=>s+t.net,0),winning:ts.filter(t=>t.net>0).reduce((s,t)=>s+t.net,0),losing:ts.filter(t=>t.net<0).reduce((s,t)=>s+t.net,0)});
  const fields=Object.keys(rows[0].values),summaries:Row[]=[];
  for(const anchor of ['entry','exit'])for(const offset of [-60,-15,0,15,60])for(const field of fields){
    const rs=rows.filter(r=>r.anchor===anchor&&r.offset===offset);
    const groups=Object.fromEntries(['win','stop'].map(g=>{const xs=rs.filter(r=>r.group===g);return[g,{values:distribution(xs.map(r=>r.values[field])),delayed:distribution(xs.map(r=>r.delayed.values[field]))}];}));
    summaries.push({anchor,offset,field,...groups});
  }
  const coverage=selected.map(t=>{const e=rows.find(r=>r.id===t.id&&r.anchor==='entry'&&r.offset===0)!;return{id:t.id,group:t.group,entryIso:t.entryIso,quality:e.quality,features:fields.filter(f=>e.values[f]!==null).length};});
  const summary={cohort:{wins:money(selected.filter(t=>t.group==='win')),stops:money(selected.filter(t=>t.group==='stop'))},
    recoveryCounts:Object.fromEntries(['recovered','not_recovered','censored'].map(g=>[g,selected.filter(t=>t.recovery.label===g).length])),
    snapshotRows:rows.length,distinctClocks:times.length,features:fields.length,coverage,baseline:baseline,sourceInventory:inventory,economicVariants:0};
  atomicJson(path.join(out,'plan.json'),{key,card,pins,candlePins,selectionHash,node:process.version});
  atomicJson(path.join(out,'trades.json'),selected);atomicJson(path.join(out,'snapshots.json'),rows);atomicJson(path.join(out,'feature-summary.json'),summaries);atomicJson(path.join(out,'summary.json'),summary);
  fs.writeFileSync(path.join(out,'features.csv'),csv(rows.map(r=>({id:r.id,group:r.group,anchor:r.anchor,offset:r.offset,at:r.at,iso:r.iso,phase:r.phase,...r.values,rangePositionPct:r.rangePositionPct,entryReturnPct:r.entryReturnPct}))));
  fs.writeFileSync(path.join(out,'trades.csv'),csv(selected.map(t=>({id:t.id,group:t.group,entryIso:t.entryIso,exitIso:t.exitIso,entryPrice:t.entryPrice,stop:t.stop,target:t.target,net:t.net,holdHours:t.holdHours,riskPct:t.riskPct,...t.recovery}))));
  assert.equal(await fileHash(path.join(out,'selection.json')),selectionHash,'selection mutated');
  const artifacts=await Promise.all(fs.readdirSync(out).filter(f=>f!=='complete.json').map(async file=>({file,sha256:await fileHash(path.join(out,file))})));
  atomicJson(path.join(out,'complete.json'),{key,artifacts,generationChecks:true,economicVariants:0});atomicJson(path.join(ROOT,'backtests/sfp-pressure-map/latest.json'),{key,dir:out});
  console.log(`[SF04] complete ${out}; ${rows.length} pressure snapshots, ${fields.length} feature columns`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
