import assert from 'assert/strict';
import { buildActions } from './setup-replay';
import { replay } from './poc-indicator-bias-engine';
import { auditStructuralReplay } from './structural-replay-audit';
import { M,H,type SetupEvent } from './setup-scan-core';
const t=Date.UTC(2026,0,1),cfg={riskMinPct:.2,riskMaxPct:5,stopBufferPct:0,includeControls:false};
const ev=(id:string,side:1|-1,at=t+M,stop=side===1?98:102):SetupEvent=>({id,setup:'test',version:'v1',side,stage:'confirmed',formationAt:at-H,knownAt:at,
  stages:{reclaim:{at:at-H,knownAt:at,price:100}},reference:{},proxies:{entry:null,stop,target:side===1?106:94},notes:[]});
for(const side of [1,-1] as const){const events=[ev('one',side),ev('tie',side),ev('too_tight',side,t+2*M,side===1?99.9:100.1)];
  const variant={side,target:'r2',holdHours:24},a=buildActions(events,variant,cfg),b=buildActions(events,variant,{...cfg,exitStopPaddingPct:2});
  assert.deepEqual(buildActions(events,variant,{...cfg,exitStopPaddingPct:0}),a);
  assert.deepEqual(b.rejected,a.rejected);assert.deepEqual(b.discarded,a.discarded);
  assert.deepEqual(b.actions.map((x,i)=>({...x,stop:a.actions[i].stop})),a.actions);
  assert.equal(b.actions[0].stop,a.actions[0].stop!*(1-side*.02));assert.equal(b.actions[0].target,side===1?104:96);
  assert.deepEqual(buildActions(events.slice(0,2),variant,{...cfg,exitStopPaddingPct:2}).actions,b.actions,'future events cannot change prior padding');
}
for(const invalid of [-1,NaN,Infinity,100])assert.throws(()=>buildActions([ev('x',1)],{side:1,target:'r2',holdHours:24},{...cfg,exitStopPaddingPct:invalid}));
const cs=Array.from({length:90},(_,i)=>({ts:t+i*M,endTs:t+(i+1)*M,open:100,high:i===30?105:100.1,low:i===5?97.5:99.9,close:100,volume:1,turnover:100}));
const events=[ev('one',1),{...ev('next',1,t+6*M),stages:{reclaim:{at:t+5*M,knownAt:t+6*M,price:100}}}];
const a=buildActions(events,{side:1,target:'r2',holdHours:1},cfg).actions,b=buildActions(events,{side:1,target:'r2',holdHours:1},{...cfg,exitStopPaddingPct:2}).actions;
const o={start:t,end:t+90*M,delay:0,hold:H,notional:10000,equity:32000,fee:.00055};
const run=(candles=cs,actions=b,opts=o)=>{const r=replay(candles,actions,opts);auditStructuralReplay(candles,actions,opts,r);return r;};
assert.equal(run(cs,a).trades[0].reason,'stop');assert.equal(run().trades[0].reason,'target');assert.equal(run().stats.skippedOccupied,1);
const fall=cs.map(c=>({...c}));fall[5]={...fall[5],open:95,high:95.1,low:94.9,close:95};assert.equal(run(fall).trades[0].exitPrice,95,'gap below padded stop fills at adverse open');
const flat=cs.map(c=>({...c,high:100.1,low:99.9}));assert.equal(run(flat).trades[0].exitAt,t+M+H,'padding does not extend holding cap');
assert.equal(run(flat,b,{...o,delay:M}).trades[0].exitAt,t+2*M+H,'original delayed deadline');
assert(run(cs,b,{...o,end:t+20*M}).open,'wider stop leaves real cutoff inventory, not a credited future target');
const bad=run();bad.trades[0].stop=98;assert.throws(()=>auditStructuralReplay(cs,b,o,bad));
console.log('stop-padding tests passed: long/short, fixed target/eligibility, zero parity, prefix, ownership, gap, cap, cutoff and audit');
