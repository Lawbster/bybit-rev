/** Source/clock verification and direct-observer/cache parity; no strategy PnL claim. */
import fs from 'fs';import path from 'path';import assert from 'assert/strict';import vm from 'vm';
import {jobDirectory,verifyPins,atomicJson,sha,type Plan} from './research-workflow';
import {MacroObserver} from './macro-sr-observer';
import {HistoricalMajorMap,projectZone,type MajorMap} from './major-sr-history-map';
const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
async function main(){const key=process.argv[2],dir=jobDirectory(process.cwd(),key),plan:Plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
 assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`),'Verification already saved');await verifyPins(process.cwd(),[...plan.pins,...plan.protectedPins,...state.artifacts]);
 const map:MajorMap=read(`${dir}/output/map.json`),events=read(`${dir}/output/events.json`),reader=new HistoricalMajorMap(map);
 assert.equal(map.key,key);assert.deepEqual(map.spec,d.spec);assert.equal(map.cutoff,Date.parse(d.cutoff));assert.equal(map.memoryDays,d.memoryDays);assert.deepEqual(events,read(`${d.archive}/output/${d.spec.minutes}m-events.json`));
 const {loadCandles1m}=await import('./hype-freerun-canonical-replay');const cs=await loadCandles1m(d.symbol,path.resolve('data'),map.cutoff,d.repairFile);
 // Independent source aggregation, not the builder's completeBars function.
 const ms=d.spec.minutes*60000,buckets=new Map<number,any>();
 for(const c of cs){const ts=Math.floor(c.ts/ms)*ms;let b=buckets.get(ts);if(!b){b={ts,endTs:ts+ms,open:c.open,close:c.close,high:c.high,low:c.low,n:0,contiguous:true,last:ts-60000};buckets.set(ts,b);}b.contiguous&&=c.ts===b.last+60000&&c.endTs===c.ts+60000;b.last=c.ts;b.n++;b.close=c.close;b.high=Math.max(b.high,c.high);b.low=Math.min(b.low,c.low);}
 const good=[...buckets.values()].filter(b=>b.n===d.spec.minutes&&b.contiguous),get=(ts:number)=>{const b=buckets.get(ts);assert(b&&b.n===d.spec.minutes&&b.contiguous);return b;};
 assert.equal(map.bars.length,good.length);assert.equal(map.frames.length,map.bars.length);
 const direct=new MacroObserver(d.spec,d.memoryDays,d.confirmationCloses,d.minimumTouches);let frameChecks=0,touchChecks=0,clockChecks=0;
 for(let i=0;i<map.bars.length;i++){const b=map.bars[i],s=good[i];assert.deepEqual(b,{ts:s.ts,endTs:s.endTs,open:s.open,high:s.high,low:s.low,close:s.close,minutes:d.spec.minutes});direct.step(b);const snap=direct.snapshot(),f=map.frames[i];
  assert.deepEqual(f,{at:b.endTs,healthy:snap.healthy,close:b.close,levels:snap.zones.map(projectZone)});const q=reader.at(f.at);
  assert.equal(q.healthy,snap.healthy);assert.deepEqual(q.levels.map(z=>({id:z.id,center:z.center,role:z.role,touches:z.touches})),snap.zones.map(z=>({id:z.id,center:z.center,role:z.role,touches:z.touches.length})));frameChecks++;
 }
 assert.deepEqual(direct.events,events);assert.deepEqual(direct.snapshot(),read(`${d.archive}/output/${d.spec.minutes}m-final.json`));
 assert.equal(map.levels.length,new Set(events.filter((e:any)=>e.kind==='qualified').map((e:any)=>e.zone.id)).size);
 for(const z of map.levels){const seed=get(z.seedPivotAt);assert.equal(z.center,z.origin==='resistance'?seed.high:seed.low);assert.equal(z.lower,z.center*(1-d.spec.halfWidthPct/100));assert.equal(z.upper,z.center*(1+d.spec.halfWidthPct/100));
  const qual=events.find((e:any)=>e.kind==='qualified'&&e.zone.id===z.id);assert(qual);assert.equal(z.qualifiedAt,qual.at);assert(!reader.at(z.qualifiedAt-1).levels.some(x=>x.id===z.id));assert(reader.at(z.qualifiedAt).levels.some(x=>x.id===z.id));
  const expired=events.find((e:any)=>e.kind==='expired'&&e.zone.id===z.id);assert.equal(z.retiredAt,expired?.at??null);if(z.retiredAt!==null)assert(!reader.at(z.retiredAt).levels.some(x=>x.id===z.id));
  for(let i=0;i<z.touches.length;i++){const t=z.touches[i],p=get(t.pivotAt);assert.equal(t.knownAt,t.pivotAt+(d.spec.wing+1)*ms);assert.equal(t.price,t.side==='resistance'?p.high:p.low);assert(t.price>=z.lower&&t.price<=z.upper);
   for(let j=-d.spec.wing;j<=d.spec.wing;j++)if(j){const n=get(t.pivotAt+j*ms);assert(t.side==='resistance'?n.high<t.price:n.low>t.price);}if(i)assert(t.pivotAt-z.touches[i-1].pivotAt>=d.spec.touchSpacingHours*3600000);touchChecks++;}
  clockChecks++;
 }
 for(const e of events)if(['support_failed','breakout_accepted','reclaimed'].includes(e.kind)){for(let k=1;k<=d.confirmationCloses;k++){const b=get(e.barEnd-k*ms);assert(b.ts>=e.zone.firstKnownAt);assert(e.kind==='support_failed'?b.close<e.zone.lower:b.close>e.zone.upper);}clockChecks++;}
 // Fresh prefixes + arbitrary future poison cannot change the observer or cache at these times.
 let prefixChecks=0;for(const part of [.1,.3,.5,.7,.9]){const n=Math.floor(map.bars.length*part),at=map.bars[n].endTs;const prefix=new MacroObserver(d.spec,d.memoryDays,d.confirmationCloses,d.minimumTouches);
  const poison=map.bars.map((b,i)=>i<=n?b:{...b,high:b.high*100,low:b.low/100});for(const b of poison){if(b.endTs>at)break;prefix.step(b);}
  assert.deepEqual(prefix.snapshot().zones.map(projectZone),map.frames[n].levels);assert.deepEqual(prefix.events,events.filter((e:any)=>e.at<=at));
  assert.deepEqual(reader.at(at+60000,60000).levels,reader.at(at).levels);prefixChecks++;
 }
 const intervals=new Map<string,typeof map.intervals>();for(const i of map.intervals){const rows=intervals.get(i.id)??[];rows.push(i);intervals.set(i.id,rows);}
 for(const f of map.frames)for(const z of f.levels){if(f.at===map.cutoff)continue;const segments=(intervals.get(z.id)??[]).filter(i=>i.start<=f.at&&i.end>f.at);assert.equal(segments.length,1);assert.equal(segments[0].role,z.role);}
 const csv=fs.readFileSync(`${dir}/output/levels.csv`,'utf8').trim().split(/\r?\n/);assert.equal(csv.length,map.levels.length+1);
 const md=fs.readFileSync(`${dir}/output/levels.md`,'utf8');assert.equal(md.split(/\r?\n/).filter(l=>/^\| \d{4}-\d{2}-\d{2}/.test(l)).length,map.levels.length);
 const html=fs.readFileSync(`${dir}/output/map.html`,'utf8');assert(!/https?:\/\//.test(html));for(const s of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(s[1]);
 const embedded=JSON.parse(html.match(/<script id="map-data" type="application\/json">([\s\S]*?)<\/script>/)![1]);assert.deepEqual(embedded.levels,map.levels);assert.deepEqual(embedded.frames,map.frames);assert.equal(embedded.timeframeMs,ms);assert(map.frames.every(f=>f.at%ms===0));
 await verifyPins(process.cwd(),[...plan.pins,...plan.protectedPins,...state.artifacts]);
 const receipt={passed:true,key,frameChecks,touchChecks,clockChecks,prefixChecks,exactArchivedEvents:events.length,mapSha256:sha(fs.readFileSync(`${dir}/output/map.json`)),checkerSha256:sha(fs.readFileSync(__filename)),liveChanges:0,strategyExecutions:0};
 atomicJson(`${dir}/verification.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
