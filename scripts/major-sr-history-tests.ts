import assert from 'assert/strict';import fs from 'fs';import os from 'os';import path from 'path';import crypto from 'crypto';
import {MacroObserver,completeBars,type MacroBar} from './macro-sr-observer';
import {HistoricalMajorMap,loadHistoricalMajorMap,projectZone,roleIntervals,type MajorMap,type HistoricalLevel} from './major-sr-history-map';
import {renderMap,levelTable} from './major-sr-history-render';
import vm from 'vm';
const H=3600000,T=Date.parse('2026-01-01T00:00:00Z'),spec={minutes:60,wing:1,halfWidthPct:.75,touchSpacingHours:3};
const bar=(i:number,high=99,close=98,low=97):MacroBar=>({ts:T+i*H,endTs:T+(i+1)*H,open:close,high,low,close,minutes:60});
const bars=[bar(0),bar(1,100),bar(2),bar(3),bar(4,100.2),bar(5),bar(6,103,102),bar(7,103,102),bar(8,102,101,100),bar(9,99,98),bar(10,99,98)];
const o=new MacroObserver(spec,1,2,2),frames:MajorMap['frames']=[];const catalog=new Map<string,HistoricalLevel>();
for(const b of [...bars,bar(50)]){o.step(b);const snap=o.snapshot();for(const z of snap.zones){let r=catalog.get(z.id);if(!r){r={id:z.id,center:z.center,lower:z.lower,upper:z.upper,origin:z.origin,seedPivotAt:+z.id.split(':')[1],createdAt:z.createdAt,qualifiedAt:z.firstKnownAt!,retiredAt:null,touches:z.touches};catalog.set(z.id,r);}}
 for(const e of o.events)if(e.kind==='expired'&&catalog.has(e.zone.id))catalog.get(e.zone.id)!.retiredAt=e.at;
 frames.push({at:b.endTs,close:b.close,healthy:snap.healthy,levels:snap.zones.map(projectZone)});}
const cutoff=T+51*H,key='a'.repeat(64),map:MajorMap={version:1,key,symbol:'TEST',cutoff,sourceStart:T,sourceEnd:cutoff,clock:'corrected_exchange_history_bar_close',spec,memoryDays:1,frames,levels:[...catalog.values()],bars,intervals:roleIntervals(o.events,cutoff)};
const reader=new HistoricalMajorMap(map),q=o.events.find(e=>e.kind==='qualified')!,id=q.zone.id;
assert(!reader.at(q.at-1).levels.some(z=>z.id===id));assert(reader.at(q.at).levels.some(z=>z.id===id));
assert(!reader.at(q.at,60000).levels.some(z=>z.id===id));assert(reader.at(q.at+60000,60000).levels.some(z=>z.id===id));
assert.equal(reader.at(T+8*H-1).levels.find(z=>z.id===id)!.role,'resistance');
assert.equal(reader.at(T+8*H).levels.find(z=>z.id===id)!.role,'support');
assert.equal(reader.at(T+11*H).levels.find(z=>z.id===id)!.role,'resistance');
assert(!reader.at(cutoff).levels.some(z=>z.id===id));assert.equal(reader.at(T+12*H).reason,'missing_latest_closed_bar');
assert.equal(reader.at(T).levels.length,0);assert.equal(reader.at(T+6*H).healthy,false);
assert.throws(()=>reader.at(cutoff+1));assert.throws(()=>reader.at(T,-1));
const observed=reader.at(q.at).levels.find(z=>z.id===id)!;assert(!('retiredAt' in observed));assert(!('seedPivotAt' in observed));assert(!('touchData' in observed));
observed.role='support';assert.equal(reader.at(q.at).levels.find(z=>z.id===id)!.role,'resistance');
for(const t of [q.at,T+8*H,T+11*H]){const prefix=new MacroObserver(spec,1,2,2);for(const b of bars.filter(b=>b.endTs<=t))prefix.step(b);
 assert.deepEqual(reader.at(t).levels.map(z=>({id:z.id,role:z.role,touches:z.touches})),prefix.snapshot().zones.map(z=>({id:z.id,role:z.role,touches:z.touches.length})));}
const bad=structuredClone(map);bad.frames[0].levels=[{...frames.find(f=>f.levels.length)!.levels[0]}];assert.throws(()=>new HistoricalMajorMap(bad));
const minutes=Array.from({length:120},(_,i)=>({ts:T+i*60000,endTs:T+(i+1)*60000,open:1,high:2,low:.5,close:1,volume:1,turnover:1}));assert.equal(completeBars(minutes.filter((_,i)=>i!==3),60).length,1);
assert(map.intervals.every(i=>i.start>=catalog.get(i.id)!.qualifiedAt&&i.end<=catalog.get(i.id)!.retiredAt!));
const html=renderMap(map);assert(!/https?:\/\//.test(html));for(const s of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(s[1]);
assert(levelTable(map).includes('Price point'));assert(levelTable(map).includes('2026-01-01'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'major-sr-cache-')),out=path.join(tmp,'output');fs.mkdirSync(out);
try{const raw=JSON.stringify(map),hash=crypto.createHash('sha256').update(raw).digest('hex');fs.writeFileSync(path.join(out,'map.json'),raw);
 fs.writeFileSync(path.join(tmp,'state.json'),JSON.stringify({status:'complete',key,artifacts:[{file:'fixture/output/map.json',bytes:Buffer.byteLength(raw),sha256:hash}]}));
 fs.writeFileSync(path.join(tmp,'verification.json'),JSON.stringify({passed:true,key,mapSha256:hash}));
 assert.equal(loadHistoricalMajorMap(tmp,key).at(q.at).levels.length,reader.at(q.at).levels.length);
 assert.throws(()=>loadHistoricalMajorMap(tmp,'b'.repeat(64)));fs.appendFileSync(path.join(out,'map.json'),' ');assert.throws(()=>loadHistoricalMajorMap(tmp,key));
}finally{for(const f of ['map.json'])fs.unlinkSync(path.join(out,f));fs.rmdirSync(out);for(const f of ['state.json','verification.json'])fs.unlinkSync(path.join(tmp,f));fs.rmdirSync(tmp);}
console.log('Major historical S/R map tests passed: as-of boundaries, delay, role/expiry, gap readiness, mutation isolation, future-field exclusion, prefix equality, corruption rejection and offline chart syntax.');
