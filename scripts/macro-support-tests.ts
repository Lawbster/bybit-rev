import assert from 'assert/strict';
import {MajorSupportGate,VARIANTS,gateAt,vetoEntry,nearestSupport,PERIOD,type Frame} from './macro-support-policy';
import type {MacroZone} from './macro-sr-observer';
import {auditGate,independentContext} from './macro-support-audit';
const T=Date.parse('2026-01-01T00:00:00Z');
const z=(id='a',upper=101,origin:'support'|'resistance'='resistance'):MacroZone=>({id,center:upper-1,lower:upper-2,upper,origin,role:'support',createdAt:T-PERIOD*10,firstKnownAt:T-PERIOD*5,
  touches:[{pivotAt:T-PERIOD*12,knownAt:T-PERIOD*8,price:upper-1,side:origin},{pivotAt:T-PERIOD*6,knownAt:T-PERIOD*2,price:upper-1,side:origin}],qualified:true,above:0,below:0,lastFlipAt:T-PERIOD,retestSinceFlip:false});
const frame=(i:number,close:number,zones=[z()],healthy=true,lag=0):Frame=>({at:T+i*PERIOD+lag,bar:{ts:T+(i-1)*PERIOD,endTs:T+i*PERIOD,minutes:240,open:close,high:close+1,low:close-1,close},healthy,zones,events:[]});
const failure=(i:number,close=98,lag=0):Frame=>{const f=frame(i,close,[{...z(),role:'resistance'}],true,lag);f.events=[{kind:'support_failed',at:f.at,barEnd:f.bar.endTs,healthy:true,zone:f.zones[0],close}];return f;};
const g=new MajorSupportGate(VARIANTS[0]);g.step(frame(0,102));assert.equal(g.watch?.zone.id,'a');
g.step(frame(1,98));assert(!g.block,'one close not a failure');const failureRow=g.step(failure(2));assert(failureRow.block);const id=failureRow.block.id;
assert(vetoEntry(1,gateAt(g.rows,T+2*PERIOD,0)));assert(!vetoEntry(2,gateAt(g.rows,T+2*PERIOD,0)),'existing adds untouched');
g.step(frame(3,102));assert(g.block,'one reclaim insufficient');g.step(frame(4,102));assert(!g.block);assert(g.events.some(e=>e.kind==='reclaim'&&e.blockId===id));
const gap=new MajorSupportGate(VARIANTS[0]);gap.step(frame(0,102));gap.step(frame(1,98));gap.step(frame(3,98));assert(!gap.block,'gap cannot complete two-close failure');
assert(!gateAt(g.rows,T+8*PERIOD,0).healthy,'missing source fails closed');assert(!gateAt(g.rows,T-1,0).healthy);
const fast=new MajorSupportGate(VARIANTS[2]);fast.step(frame(0,102));fast.step(frame(1,98));fast.step(failure(2));
for(let i=3;i<8;i++)fast.step(frame(i,98,[{...z(),role:'resistance'}]));assert(fast.block);
fast.step(frame(8,98,[{...z(),role:'resistance'}],false));assert(fast.block,'unhealthy source cannot release timeout');
fast.step(frame(9,98,[{...z(),role:'resistance'}]));assert(!fast.block);assert.equal(fast.watch,null,'timeout cannot rearm broken support');
const retired=new MajorSupportGate(VARIANTS[0]);retired.step(frame(0,102));retired.step(frame(1,98));retired.step(failure(2));retired.step(frame(3,98,[]));assert(!retired.block);assert(retired.events.some(e=>e.kind==='retired'));
assert.equal(nearestSupport(frame(0,102,[z('old',100),z('nearest',101)]),VARIANTS[0])?.id,'nearest');
assert.equal(nearestSupport(frame(0,102,[z('native',101,'support')]),VARIANTS[1]),null);
assert.equal(nearestSupport(frame(0,106),VARIANTS[0]),null,'not an arbitrary distant level');
const premature=new MajorSupportGate(VARIANTS[0]);premature.step(failure(2));assert(!premature.block,'no level selected retrospectively at failure');
const delayed=new MajorSupportGate(VARIANTS[0]);delayed.step(frame(0,102,[z()],true,60000));delayed.step(frame(1,98,[z()],true,60000));delayed.step(failure(2,98,60000));
assert(!gateAt(delayed.rows,T+2*PERIOD,60000).blocked);assert(gateAt(delayed.rows,T+2*PERIOD+60000,60000).blocked);
const prefix=new MajorSupportGate(VARIANTS[0]);prefix.step(frame(0,102));prefix.step(frame(1,98));const frozen=structuredClone(prefix.rows);prefix.step(failure(2));assert.deepEqual(prefix.rows.slice(0,2),frozen);
assert.throws(()=>prefix.step(frame(1,98)));
for(const variant of VARIANTS){
  const fs=[frame(0,102),frame(1,98),failure(2),...Array.from({length:7},(_,k)=>frame(k+3,98,[{...z(),role:'resistance'}])),frame(10,102),frame(11,102)];
  const tape=new MajorSupportGate(variant);fs.forEach(f=>tape.step(f));auditGate(fs,variant,tape);
  for(const at of [T-1,T,T+2*PERIOD,T+8*PERIOD,T+12*PERIOD])assert.deepEqual(independentContext(tape.rows,at,0),gateAt(tape.rows,at,0));
  const wrong=structuredClone({rows:tape.rows,events:tape.events});wrong.rows[2].block!.failedAt++;
  assert.throws(()=>auditGate(fs,variant,wrong),'independent checker rejects corrupted trigger time');
}
console.log('MS01 tests passed: prior selection, nearest/provenance, two closes/reclaims, timeout/retirement, unknown/gap, arrival delay, prefix and rung1-only veto.');
