import assert from 'assert/strict';import {nextMutation,corrected} from './resistance-add-skip-inspect';
const spell={episode:1,firstAt:100000},events=[{episode:1,event:{kind:'open',decisionAt:0,fillAt:1000}},
  {episode:1,event:{kind:'close',reason:'tp',decisionAt:2000,fillAt:200000,price:101}}];
assert.equal(nextMutation(spell,events),events[1],'Earlier armed resting TP is still the next actual mutation');
assert.equal(nextMutation({episode:2,firstAt:100000},events),null);
const probes=[{episode:1,at:100000,nextDepth:6,price:100,blocked:true},{episode:1,at:160000,nextDepth:6,price:100,blocked:true}];
const c=corrected(probes,events);assert.equal(c.spells,1);assert.equal(c.followedByReduction,1);assert.equal(c.censored,0);assert.equal(c.details[0].elapsedMinutes,100000/60000);
assert.equal(corrected(probes,events.slice(0,1)).censored,1);
console.log('SRK01 diagnostic tests passed: resting TP armed before veto, fill-time ordering and cutoff censoring');
