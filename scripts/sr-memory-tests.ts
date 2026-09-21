import assert from 'assert/strict';
import fs from 'fs';
import {ReplaySrContext} from './replay-sr-context';
import {validate,CARD} from './sr-memory-study';
const card=JSON.parse(fs.readFileSync(CARD,'utf8'));validate(card.definition);
const M=60000,T=Date.parse('2026-01-01T00:00:00Z');
const cs=Array.from({length:5*1440},(_,i)=>{const p=(i<3*1440?100:120)+Math.sin(i/80);return{ts:T+i*M,endTs:T+(i+1)*M,open:p,close:p,high:p+.1,low:p-.1,volume:1,turnover:p};});
const base={enabled:true,tfMin:30,pivotLeft:4,pivotRight:4,clusterPct:.0045,minTouches:2,bufferPct:1,recentDays:1};
const at=T+5*1440*M,short=new ReplaySrContext(cs,base).at(at),long=new ReplaySrContext(cs,{...base,recentDays:3}).at(at);
assert(short.coverage.healthy&&long.coverage.healthy);
assert(short.engine.getZones(at).length>0&&long.engine.getZones(at).length>0);
assert(!short.engine.getZones(at).some(z=>z.price<110));assert(long.engine.getZones(at).some(z=>z.price<110));
for(const days of [1,3])for(const n of [4*1440,4*1440+25,5*1440]){
  const cfg={...base,recentDays:days},t=T+n*M;
  const full=new ReplaySrContext(cs,cfg).at(t),prefix=new ReplaySrContext(cs.slice(0,n),cfg).at(t);
  assert.deepEqual(full.engine.getZones(t),prefix.engine.getZones(t));assert.deepEqual(full.coverage,prefix.coverage);
  const poison=cs.map((c,i)=>i<n?c:{...c,high:999999,low:.001,open:1000,close:1000});
  assert.deepEqual(new ReplaySrContext(poison,cfg).at(t).engine.getZones(t),prefix.engine.getZones(t));
  for(const z of full.engine.getZones(t))for(const x of z.touchData){assert(x.ts<=t);assert(x.ts>=t-days*86400000);}
}
assert(!new ReplaySrContext(cs.filter((_,i)=>i!==cs.length-10),base).at(at).coverage.healthy);
assert(!new ReplaySrContext(cs,{...base,recentDays:120}).at(at).coverage.healthy);
const context=new ReplaySrContext(cs,base);context.at(at);assert.throws(()=>context.at(at-M));
console.log('S/R retention tests passed: older-zone exclusion, nonempty prefix/future poison, gaps, warmup, monotonic clocks.');
