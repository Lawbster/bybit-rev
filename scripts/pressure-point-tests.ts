import assert from "assert/strict";
import { M,H,labelAt,dropEvents,indicatorSnapshots,flagged,bins,hlSnapshot,csv } from "./pressure-point-features";
import { TpHlTape,normalize } from "./tp-hl-event-features";
import { read } from "./hype-failed-recovery-study";
const start=Date.parse("2025-06-01T00:00:00Z"),cs=Array.from({length:35*1440},(_,i)=>({ts:start+i*M,endTs:start+(i+1)*M,
  open:100,high:101,low:99,close:100,volume:10,turnover:1000}));
const t=start+30*24*H;
assert.equal(labelAt(cs,t).drop2in12,false);const future=structuredClone(cs);future[(t-start)/M+10].low=90;
assert.equal(labelAt(future,t).drop2in12,true);
const spec=read("research-inputs/pressure-point-atlas-2026-09-09.json");
assert.deepEqual(indicatorSnapshots(cs,[t],spec),indicatorSnapshots(future,[t],spec));
assert.deepEqual(indicatorSnapshots(cs.filter(c=>c.endTs<=t),[t],spec),indicatorSnapshots(cs,[t],spec));
const snap=indicatorSnapshots(cs,[t],spec).get(t)!;
assert.equal(snap.sources.m240.sourceEnd,t);assert.equal(snap.delayedSources.m240.sourceEnd,t-4*H);
assert.equal(labelAt(cs,cs.at(-1)!.endTs).drop2in12,null);
const drops=structuredClone(cs.slice(0,3000));for(let i=1000;i<1200;i++){drops[i].close=96;drops[i].low=95;}
for(let i=1300;i<1500;i++){drops[i].close=96;drops[i].low=95;}
assert.equal(dropEvents(drops,start).length,2);
assert.equal(flagged({x:null},{id:"x",feature:"x",op:"lt",value:0}),null);
assert.equal(flagged({x:0},{id:"x",feature:"x",op:"lt",value:0}),false);
assert.equal(new Set(bins().map(b=>b.id)).size,bins().length);
assert.equal(csv([{a:{reason:'hello "world"'},b:"a,b"}]),'"a","b"\n"{""reason"":""hello \\""world\\""""}","a,b"\n');
const hs=read(spec.hlSpec),tape=new TpHlTape(hs);
for(let n=16;n>=0;n--)tape.add(normalize("taker",{timestamp:t-n*M,windowStart:t-(n+1)*M,windowEnd:t-n*M,
  buyNotional:80,sellNotional:100,buyVol:1,sellVol:1,buyCount:1,sellCount:1},"fixture",17-n));
tape.seal();assert.equal(tape.flow(t,15,60000).samples,14);assert.equal(tape.flow(t,15,120000).samples,13);
assert.equal(hlSnapshot(tape,t,60000).features.takerRatio15,.8);assert.equal(hlSnapshot(tape,t,120000).features.takerRatio15,null);
const before=hlSnapshot(tape,t,60000);tape.add(normalize("asset",{timestamp:t+1,openInterest:100},"future",1));tape.seal();
assert.deepEqual(hlSnapshot(tape,t,60000),before);
console.log("P01 pressure-point tests passed: future isolation, prefix, boundary, unknowns, episode rearming and HL delay.");
