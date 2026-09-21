import assert from 'assert/strict';
import { contextIndicators, checkpoints, recoveryLabel, distribution, M,H } from './sfp-pressure-features';
const start=Date.parse('2026-01-01T00:00:00Z'),end=start+42*24*H;
const cs=Array.from({length:42*1440},(_,i)=>({ts:start+i*M,endTs:start+(i+1)*M,open:100,high:101,low:99,close:100,volume:10,turnover:1000}));
const card={indicatorSeed:'2026-01-01T00:00:00Z',timeframesMinutes:[15,60,240],emaPeriods:[20,50,200],entryOffsetsMinutes:[-60,-15,0,15,60],exitOffsetsMinutes:[-60,-15,0,15,60]};
const at=start+40*24*H+M,actual=contextIndicators(cs,[at],card).get(at)!;
assert.equal(actual.values.m240_ema200,100);assert.equal(actual.values.m240_ema200DistancePct,0);
assert.equal(actual.sources.m240.sourceEnd,at-M);assert(actual.sources.m240.availableAt<=at);
const future=cs.map(c=>({...c}));for(const c of future)if(c.ts>=at-M){c.open=150;c.high=151;c.low=149;c.close=150;c.turnover=1500;}
assert.deepEqual(contextIndicators(future,[at],card).get(at),actual,'forming/future bar leaks');
assert.deepEqual(contextIndicators(cs.filter(c=>c.endTs<=at-M),[at],card).get(at),actual,'prefix differs');
const t={id:'t',entryAt:start+H,exitAt:start+H+20*M,entryPrice:100,target:105,reason:'stop'};
const ps=checkpoints(t,end,card);assert(!ps.some(p=>p.anchor==='entry'&&p.offset===60));assert(!ps.some(p=>p.anchor==='exit'&&p.offset===-60));
assert.equal(recoveryLabel(cs,t,end).label,'not_recovered');
const changed=cs.map(c=>({...c}));changed[80].high=110;assert.equal(recoveryLabel(changed,t,end).label,'not_recovered','stop minute is ambiguous');
changed[81].high=110;assert.equal(recoveryLabel(changed,t,end).label,'recovered');
assert.equal(recoveryLabel(cs,{...t,entryAt:end-H,exitAt:end-30*M},end).label,'censored');
assert.deepEqual(distribution([1,2,3,null]),{n:3,missing:1,min:1,q25:1.5,median:2,q75:2.5,max:3});
console.log('SF04 tests passed: closed bar/EMA, future poisoning, prefix, phase eligibility, recovery and censoring');
