import assert from "assert/strict";
import { features,signalTimes,opportunities,specifications,read,CARD,H,M,GRID,type Spec } from "./btc-hype-threshold-study";
import {runCombination}from "./indicator-combination-engine";
import {checkLedger,near}from "./btc-hype-threshold-verify";
const make=(i:number,price:number)=>({ts:i*M,endTs:(i+1)*M,open:price,high:price*1.01,low:price*.99,close:price,volume:1,turnover:price});
const a=Array.from({length:400},(_,i)=>make(i,100+i*.03)),b=Array.from({length:400},(_,i)=>make(i,100+i*.01));
const spec:Spec={id:"test",family:"gap",lookbackHours:1,threshold:1,polarity:1,side:"long",holdHours:4};
const f=features(a,b,2*H,5*H,1);assert(f.every(x=>x.ready));
near(f[1].hype!,100*(a[119].close/a[59].close-1),"last CLOSED minute");
near(f[1].gap!,f[1].hype!-f[1].btc!,"gap percentage points");
// No entry minute or later mutation can alter earlier source features.
const altered=a.map(c=>c.ts>=3*H?{...c,close:c.close*10,high:c.high*10}:c);
assert.deepEqual(features(altered,b,2*H,3*H+M,1),features(a,b,2*H,3*H+M,1));
assert.deepEqual(features(a.slice(0,180),b.slice(0,180),2*H,3*H+M,1),features(a,b,2*H,3*H+M,1));
// A missing INTERIOR BTC minute invalidates the whole window, not just endpoints.
const broken=features(a,b.filter(c=>c.ts!==90*M),2*H,5*H,1);
assert(!broken.find(x=>x.at===2*H)!.ready);assert(broken.find(x=>x.at===3*H)!.ready);
const raw=[.8,1,1.4,.7,1.2].map((gap,i)=>({at:(i+1)*GRID,lookbackHours:1,ready:true,hype:gap,btc:0,gap}));
assert.deepEqual(signalTimes(raw,spec),[2*GRID,5*GRID]);
assert.deepEqual(signalTimes(raw.map(x=>({...x,gap:-x.gap})),{...spec,polarity:-1}),[2*GRID,5*GRID]);
assert.deepEqual(signalTimes(raw.map((x,i)=>({...x,ready:i!==0})),spec),[5*GRID]);
assert.deepEqual(signalTimes(raw.filter((_,i)=>i!==3),spec),[2*GRID]);
const d=read(CARD).definition;assert.equal(specifications(d).filter(x=>x.family!=="clock").length,216);
// Execution/order timing, occupied signals, end-boundary pending and monthly ledger.
for(const shift of [0,Date.parse("2026-01-31T21:00:00Z")])for(const side of ["long","short"]as const)for(const delayMs of [0,M])for(const length of [240*M,241*M,242*M,300*M]){
  const end=shift+length,candles=a.filter(c=>c.endTs<=length).map(c=>({...c,ts:c.ts+shift,endTs:c.endTs+shift}));
  const times=[0,GRID,240*M,255*M].filter(t=>t<length).map(t=>t+shift);
  const options={start:shift,end,delayMs,holdMs:4*H,notional:10000,equity:32000,feeRate:.00055};
  const r=runCombination(candles.map(c=>({timestamp:c.ts,...c})),opportunities(times),side,options);
  checkLedger({...r,start:new Date(shift).toISOString(),end:new Date(end).toISOString(),delayMs,spec:{...spec,side},
    stressNet:r.stats.net-r.stats.turnoverIncludingMarkedExit*.0005},r.trades,candles,times,d);
  assert.equal(r.stats.skippedOccupied>=1,true);
  if(r.trades.length){assert.equal(r.trades[0].entryAt,shift+delayMs);assert.equal(r.trades[0].exitAt,shift+4*H+2*delayMs);}
}
console.log("BH01 tests passed: closed-bar/prefix/future poison, interior gap, signed boundary crossing, occupancy, fees, delay, month boundary and cutoff ledger (32 cases)");
