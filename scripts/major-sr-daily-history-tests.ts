import assert from 'assert/strict';
import vm from 'vm';
import {MacroObserver,completeBars,type MacroBar} from './macro-sr-observer';
import {HistoricalMajorMap,projectZone,roleIntervals,type MajorMap,type HistoricalLevel} from './major-sr-history-map';
import {levelTable,renderMap} from './major-sr-history-render-v2';

const D=86400000,T=Date.parse('2025-01-01T00:00:00Z');
const spec={minutes:1440,wing:3,halfWidthPct:1,touchSpacingHours:168};
const bar=(i:number,high=99,close=98,low=97):MacroBar=>({ts:T+i*D,endTs:T+(i+1)*D,open:close,high,low,close,minutes:1440});
const bars=Array.from({length:130},(_,i)=>i===3?bar(i,100):i===10?bar(i,100.2):i===14||i===15?bar(i,103,102,101):bar(i));
const o=new MacroObserver(spec,120,2,2),frames:MajorMap['frames']=[],catalog=new Map<string,HistoricalLevel>();
for(const b of bars){
  o.step(b);const snap=o.snapshot();
  for(const z of snap.zones){
    let r=catalog.get(z.id);
    if(!r){r={id:z.id,center:z.center,lower:z.lower,upper:z.upper,origin:z.origin,seedPivotAt:Number(z.id.split(':')[1]),createdAt:z.createdAt,qualifiedAt:z.firstKnownAt!,retiredAt:null,touches:[]};catalog.set(z.id,r);}
    for(const t of z.touches)if(!r.touches.some(x=>x.pivotAt===t.pivotAt&&x.side===t.side))r.touches.push({...t});
  }
  for(const e of o.events)if(e.kind==='expired'&&catalog.has(e.zone.id))catalog.get(e.zone.id)!.retiredAt=e.at;
  frames.push({at:b.endTs,close:b.close,healthy:snap.healthy,levels:snap.zones.map(projectZone)});
}
const cutoff=T+130*D+20*3600000;
const map:MajorMap={version:1,key:'d'.repeat(64),symbol:'TEST',cutoff,sourceStart:T,sourceEnd:cutoff,clock:'corrected_exchange_history_bar_close',spec,memoryDays:120,frames,levels:[...catalog.values()],intervals:roleIntervals(o.events,cutoff),bars};
const reader=new HistoricalMajorMap(map),q=o.events.find(e=>e.kind==='qualified')!;
assert(q);assert.equal(q.at,T+14*D);assert.equal(q.zone.createdAt,T+7*D);
assert.deepEqual(q.zone.touches.map(t=>t.pivotAt),[T+3*D,T+10*D]);
assert.deepEqual(q.zone.touches.map(t=>t.knownAt),[T+7*D,T+14*D]);
assert.equal(q.zone.center,100);assert.equal(q.zone.lower,99);assert.equal(q.zone.upper,101);
assert.equal(reader.at(q.at-1).levels.length,0);assert.equal(reader.at(q.at).levels.length,1);
assert.equal(reader.at(q.at,60000).levels.length,0);assert.equal(reader.at(q.at+60000,60000).levels.length,1);
assert.equal(reader.at(T+16*D-1).levels[0].role,'resistance');
assert.equal(reader.at(T+16*D).levels[0].role,'support');
assert.equal(reader.at(T+18*D).levels[0].role,'resistance');
assert.equal(reader.at(T+120*D-1).healthy,false);assert.equal(reader.at(T+120*D).healthy,true);
assert.equal(reader.at(T+120*D+20*3600000).healthy,true,'A daily frame stays current between UTC midnight updates');
assert.equal(reader.at(T+120*D+20*3600000).sourceAt,T+120*D);
assert.equal(reader.at(cutoff).healthy,true);assert.equal(reader.at(cutoff).levels.length,0);
assert.throws(()=>reader.at(cutoff+1));

// A valid pivot four days after another is not a second accepted touch.
const spaced=new MacroObserver(spec,120,2,2);
for(let i=0;i<18;i++)spaced.step(i===3?bar(i,100):i===7?bar(i,100.2):i===14?bar(i,100.4):bar(i));
const sq=spaced.events.find(e=>e.kind==='qualified')!;
assert(sq);assert.equal(sq.at,T+18*D);assert.deepEqual(sq.zone.touches.map(t=>t.pivotAt),[T+3*D,T+14*D]);

// Prefix reconstruction and deliberately changed future cannot rewrite known levels.
for(const n of [5,13,15,17,119]){
  const prefix=new MacroObserver(spec,120,2,2),poison=bars.map((b,i)=>i<=n?b:{...b,high:10000,low:.001});
  for(const b of poison){if(b.endTs>bars[n].endTs)break;prefix.step(b);}
  assert.deepEqual(prefix.snapshot().zones.map(projectZone),frames[n].levels);
  assert.deepEqual(prefix.events,o.events.filter(e=>e.at<=bars[n].endTs));
}
const gap=new MacroObserver(spec,120,2,2);
for(const b of bars.filter((_,i)=>i!==125))gap.step(b);
assert.equal(gap.snapshot().healthy,false);

// Complete days only: partial first day, missing interior minute, unfinished last day.
const minutes=Array.from({length:3*1440+720},(_,i)=>({ts:T+i*60000,endTs:T+(i+1)*60000,open:1,high:2,low:.5,close:1,volume:1,turnover:1}));
assert.deepEqual(completeBars(minutes.slice(60),1440).map(b=>b.ts),[T+D,T+2*D]);
assert.deepEqual(completeBars(minutes.filter((_,i)=>i!==1440+19),1440).map(b=>b.ts),[T,T+2*D]);
const missingMap=structuredClone(map);missingMap.frames=missingMap.frames.filter(f=>f.at!==T+120*D);
assert.equal(new HistoricalMajorMap(missingMap).at(T+120*D+3600000).reason,'missing_latest_closed_bar');

const html=renderMap(map),md=levelTable(map);
assert(html.includes('S/R, 1D'));assert(html.includes('closed 1D price'));assert(md.includes('TEST, 1D'));
assert(!/https?:\/\//.test(html));
for(const s of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(s[1]);
const embedded=JSON.parse(html.match(/<script id="map-data" type="application\/json">([\s\S]*?)<\/script>/)![1]);
assert.equal(embedded.timeframeMs,D);assert.equal(Math.floor((T+120*D+20*3600000)/embedded.timeframeMs)*embedded.timeframeMs,T+120*D);
assert(html.includes('Math.floor(at/D.timeframeMs)*D.timeframeMs'));assert(!html.includes('Math.floor(at/14400000)'));
assert.equal(md.split('\n').filter(l=>/^\| \d{4}-\d{2}-\d{2}/.test(l)).length,map.levels.length);
console.log('Daily major S/R tests passed: UTC closed-day aggregation, confirmation/spacing/flip/expiry clocks, prefix causality, delay, daily readiness/gaps and timeframe-aware offline rendering.');
