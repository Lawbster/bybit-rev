import assert from "assert/strict";
import { exclusionGate, replacementAttribution } from "./mfi-calendar-refinement";
import { runEntryContext } from "./indicator-entry-context-policy";
import { HOUR as H, MINUTE as M } from "./indicator-standalone-engine";
const day=Date.UTC(2026,8,1);
for(const [a,b]of [[15,19],[16,20],[17,21]]){
  assert(exclusionGate(day+a*H-1,a,b).pass);assert(!exclusionGate(day+a*H,a,b).pass);
  assert(!exclusionGate(day+b*H-1,a,b).pass);assert(exclusionGate(day+b*H,a,b).pass);
  assert(exclusionGate(day+24*H,a,b).pass);
}
assert.throws(()=>exclusionGate(day,14,18));assert.throws(()=>exclusionGate(NaN,16,20));
const tape=Array.from({length:3*24*60},(_,i)=>({timestamp:day+i*M,open:100+i/10000,high:102,low:99,close:100,volume:1,turnover:100}));
const signal=(at:number):any=>({at,sourceStart:at-15*M,sourceEnd:at,availableAt:at,previousStart:at-30*M,feature:{timestamp:at-15*M}});
const o={start:day,end:day+tape.length*M,delayMs:M,holdMs:12*H,notional:10000,equity:32000,feeRate:.00055};
// Pre-boundary signal keeps eligibility even when fill is inside the exclusion.
const run=runEntryContext(tape,[signal(day+16*H-M)],"long",o,t=>exclusionGate(t,16,20));
assert.equal(run.trades[0].entryAt,day+16*H);assert.equal(run.trades[0].exitAt,day+28*H+M);
const blocked=runEntryContext(tape,[signal(day+16*H)],"long",o,t=>exclusionGate(t,16,20));
assert.equal(blocked.trades.length,0);assert.equal(blocked.stats.pendingAtEnd,false);
for(const hold of [11,12,13])for(const delay of [0,M]){
  const x=runEntryContext(tape,[signal(day+H)],"long",{...o,delayMs:delay,holdMs:hold*H});
  assert.equal(x.trades[0].entryAt,day+H+delay);assert.equal(x.trades[0].exitAt,day+(hold+1)*H+2*delay);
  const cut=day+(hold+1)*H+2*delay;
  const y=runEntryContext(tape,[signal(day+H)],"long",{...o,end:cut,delayMs:delay,holdMs:hold*H});
  assert.equal(y.trades.length,0);assert(y.open);
}
const xs=[signal(day+H),signal(day+2*H),signal(day+13*H)];
const same=runEntryContext(tape,xs,"long",{...o,delayMs:0});
assert.equal(same.decisions[1].outcome,"occupied");assert.equal(same.decisions[2].outcome,"accepted");
const ready=runEntryContext(tape,xs,"long",{...o,delayMs:0},t=>exclusionGate(t,16,20),true);
assert.deepEqual(ready.stats,same.stats);
const prefix=tape.slice(0,30*60),end=prefix.at(-1)!.timestamp+M;
assert.deepEqual(runEntryContext(tape,xs,"long",{...o,end}),runEntryContext(prefix,xs,"long",{...o,end}));
const trade=(signalAt:number,exitAt:number,net:number)=>({signalAt,entryAt:signalAt,exitAt,qty:1,net});
const parent={trades:[trade(1,13,10),trade(14,26,-3)],decisions:[{at:1,outcome:"accepted"},{at:5,outcome:"occupied"},{at:14,outcome:"accepted"}],stats:{net:7},open:null};
const variant={trades:[trade(5,17,12)],decisions:[{at:1,outcome:"condition_false"},{at:5,outcome:"accepted"},{at:14,outcome:"occupied"}],stats:{net:12},open:null};
const a=replacementAttribution(parent,variant);assert.equal(a.totalDelta,5);assert.equal(a.episodes.length,1);
assert.equal(a.cohorts.removed_calendar.net,10);assert.equal(a.cohorts.removed_displaced.net,-3);assert.equal(a.rows[1].oppositeBlockingSignalAt,1);
assert.equal(a.cohorts.newly_enabled.net,12);assert.equal(a.withoutBestEpisodeDelta,0);
assert.equal(replacementAttribution(parent,parent).totalDelta,0);
console.log("T02 fixtures passed: boundaries, frozen delayed entry, discard not queue, 11/12/13h timeouts/cutoff, occupancy, readiness, prefix, and attribution conservation.");
