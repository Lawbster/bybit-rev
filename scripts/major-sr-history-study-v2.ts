import fs from 'fs';import path from 'path';import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,sha,verifyPins,type Plan} from './research-workflow';
import {MacroObserver,completeBars} from './macro-sr-observer';
import {projectZone,roleIntervals,loadHistoricalMajorMap,type HistoricalLevel,type MajorMap} from './major-sr-history-map';
import {levelTable,renderMap,iso} from './major-sr-history-render-v2';
const CARD='research-inputs/major-sr-history-daily-map02-2026-09-17.json';
const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
const csv=(rows:(string|number|null)[][])=>rows.map(row=>row.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\n')+'\n';
async function worker(plan:Plan,out:string){
 const d=plan.card.definition;assert.equal(d.runs,0);assert.equal(d.sourceLagMs,0);assert(read(`${d.archive}/verification.json`).passed);
 // Freeze the existing observer/data identity, not its old worker/reporting limitations.
 const old=read(`${d.archive}/plan.json`);await verifyPins(process.cwd(),old.pins.filter((p:any)=>[
   'scripts/macro-sr-observer.ts','data/HYPEUSDT_1_full.json',d.repairFile].includes(p.file)));
 // A later sync appended minutes after the frozen cutoff. Prove the archived
 // prefix byte-for-byte and reject historical edits/backfills in the append.
 const oldMinute=old.pins.find((p:any)=>p.file==='data/HYPEUSDT_1m.jsonl');assert(oldMinute);
 const raw=fs.readFileSync(oldMinute.file);assert(raw.length>=oldMinute.bytes);assert.equal(sha(raw.subarray(0,oldMinute.bytes)),oldMinute.sha256);
 const appended=raw.subarray(oldMinute.bytes).toString('utf8').trim();const extra=appended?appended.split(/\r?\n/).map(x=>JSON.parse(x)):[];
 for(const row of extra)assert(Number(row.ts??row.timestamp)+60000>Date.parse(d.cutoff),'Append changes the historical window');
 atomicJson(path.join(out,'source-append-proof.json'),{archivedPrefixUnchanged:true,archivedBytes:oldMinute.bytes,currentBytes:raw.length,excludedPostCutoffRows:extra.length,cutoff:d.cutoff});
 const {loadCandles1m}=await import('./hype-freerun-canonical-replay');
 const cutoff=Date.parse(d.cutoff),cs=await loadCandles1m(d.symbol,path.resolve('data'),cutoff,d.repairFile);
 const bars=completeBars(cs,d.spec.minutes),o=new MacroObserver(d.spec,d.memoryDays,d.confirmationCloses,d.minimumTouches);
 const levels=new Map<string,HistoricalLevel>(),frames:MajorMap['frames']=[];
 let cursor=0;
 for(const b of bars){o.step(b);const snap=o.snapshot();
   for(const z of snap.zones){let record=levels.get(z.id);if(!record){record={id:z.id,center:z.center,lower:z.lower,upper:z.upper,origin:z.origin,
     seedPivotAt:Number(z.id.split(':')[1]),createdAt:z.createdAt,qualifiedAt:z.firstKnownAt!,retiredAt:null,touches:[]};levels.set(z.id,record);}
     for(const t of z.touches)if(!record.touches.some(x=>x.knownAt===t.knownAt&&x.side===t.side&&x.pivotAt===t.pivotAt))record.touches.push({...t});}
   for(const e of o.events.slice(cursor))if(e.kind==='expired'&&levels.has(e.zone.id))levels.get(e.zone.id)!.retiredAt=e.at;
   cursor=o.events.length;frames.push({at:b.endTs,healthy:snap.healthy,close:b.close,levels:snap.zones.map(projectZone)});
 }
 assert.deepEqual(o.events,read(`${d.archive}/output/${d.spec.minutes}m-events.json`),'Historical event parity failed');
 assert.deepEqual(o.snapshot(),read(`${d.archive}/output/${d.spec.minutes}m-final.json`),'Final map parity failed');
 const map:MajorMap={version:1,key:plan.key,symbol:d.symbol,cutoff,sourceStart:cs[0].ts,sourceEnd:cs.at(-1)!.endTs,
   clock:'corrected_exchange_history_bar_close',spec:d.spec,memoryDays:d.memoryDays,frames,
   levels:[...levels.values()].sort((a,b)=>a.qualifiedAt-b.qualifiedAt||a.center-b.center),intervals:roleIntervals(o.events,cutoff),bars};
 const write=(name:string,x:unknown)=>atomicJson(path.join(out,name),x);
 write('map.json',map);write('events.json',o.events);
 fs.writeFileSync(path.join(out,'levels.md'),levelTable(map));fs.writeFileSync(path.join(out,'map.html'),renderMap(map));
 fs.writeFileSync(path.join(out,'levels.csv'),csv([['date_known','pricepoint','side_at_qualification','time_utc','lower','upper','zone_id','seed_pivot_at_utc','first_pivot_known_at_utc','qualified_at_utc','retired_at_utc'],
   ...map.levels.map(z=>[iso(z.qualifiedAt).slice(0,10),z.center,z.origin,iso(z.qualifiedAt).slice(11,16),z.lower,z.upper,z.id,iso(z.seedPivotAt),iso(z.createdAt),iso(z.qualifiedAt),iso(z.retiredAt)])]));
 fs.writeFileSync(path.join(out,'touches.csv'),csv([['zone_id','level_center','pivot_at_utc','pivot_price','pivot_side','confirmed_at_utc'],
   ...map.levels.flatMap(z=>z.touches.map(t=>[z.id,z.center,iso(t.pivotAt),t.price,t.side,iso(t.knownAt)]))]));
 fs.writeFileSync(path.join(out,'events.csv'),csv([['at_utc','event','zone_id','level_center','role_after','source_close','continuous_history_healthy'],
   ...o.events.filter(e=>levels.has(e.zone.id)).map(e=>[iso(e.at),e.kind,e.zone.id,e.zone.center,e.zone.role,e.close,String(e.healthy)])]));
 fs.writeFileSync(path.join(out,'role-intervals.csv'),csv([['zone_id','known_role_start_utc','role_end_exclusive_utc','role'],
   ...map.intervals.map(i=>[i.id,iso(i.start),iso(i.end),i.role])]));
 const months=[...new Set(frames.map(f=>iso(f.at).slice(0,7)))].map(month=>{const fs=frames.filter(f=>iso(f.at).startsWith(month));return{month,bars:fs.length,healthyBars:fs.filter(f=>f.healthy).length,
   firstQualified:map.levels.filter(z=>iso(z.qualifiedAt).startsWith(month)).length,activeAtLastBar:fs.at(-1)!.levels.length};});
 const missingBars=[];for(let t=bars[0].ts;t<bars.at(-1)!.endTs;t+=d.spec.minutes*60000)if(!bars.some(b=>b.ts===t))missingBars.push(t);
 write('summary.json',{key:plan.key,symbol:d.symbol,sourceStart:iso(map.sourceStart),sourceEnd:iso(map.sourceEnd),cutoff:d.cutoff,
   minuteBars:cs.length,timeframeMinutes:d.spec.minutes,completeBars:bars.length,lastCompleteBarEnd:iso(bars.at(-1)!.endTs),missingBars:missingBars.map(iso),
   qualifiedLevels:map.levels.length,activeAtCutoff:frames.at(-1)!.levels.length,expiredLevels:map.levels.filter(z=>z.retiredAt!==null).length,
   acceptedTouches:map.levels.reduce((n,z)=>n+z.touches.length,0),events:o.events.length,roleIntervals:map.intervals.length,
   firstQualifiedAt:iso(map.levels[0].qualifiedAt),firstHealthyAt:iso(frames.find(f=>f.healthy)?.at??null),months,
   exactArchivedEventParity:true,exactArchivedFinalParity:true,liveChanges:0,strategyExecutions:0});
 console.log(JSON.stringify({levels:map.levels.length,frames:frames.length,events:o.events.length,archiveParity:true}));
}
async function main(){const [cmd,arg,time]=process.argv.slice(2);
 if(cmd==='plan'){
   const card=read(CARD);const sources=['scripts/major-sr-history-study-v2.ts','scripts/major-sr-history-map.ts','scripts/major-sr-history-render-v2.ts',
     'scripts/major-sr-history-tests.ts','scripts/major-sr-daily-history-tests.ts','scripts/major-sr-history-verify-v2.ts','scripts/macro-sr-observer.ts','scripts/hype-freerun-canonical-replay.ts',
     'scripts/replay-candle-repair.ts','scripts/replay-causality.ts','scripts/research-workflow.ts','package-lock.json','docs/research/major-sr-history-daily-map02.md',`${card.definition.archive}/plan.json`];
   const protectedFiles=['bot-config.json','hl-short-live-config.json','bot-state.json','src/bot/index.ts','src/bot/sr-memory-zones.ts','scripts/replay-causal-engine.ts','scripts/replay-sr-context.ts'];
   console.log((await createPlan(process.cwd(),card,sources,protectedFiles)).key);
 }else if(cmd==='run'){await executePlan(process.cwd(),arg,worker);}
 else if(cmd==='query'){assert(time&&time.endsWith('Z'),'Provide explicit UTC ISO time ending Z');const dir=`backtests/research-workflow/${arg}`;
   console.log(JSON.stringify(loadHistoricalMajorMap(dir,arg).at(Date.parse(time)),null,2));}
 else throw Error('Usage: major-sr-history-study-v2.ts plan | run KEY | query KEY UTC_ISO');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
