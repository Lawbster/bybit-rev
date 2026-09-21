import assert from "assert/strict";
import {runCappedEntry,M,H,type Options}from "./btc-dip-price-cap-engine";
import {verifyCase}from "./btc-dip-price-cap-verify";
import {runCombination}from "./indicator-combination-engine";
import {opportunities}from "./btc-hype-threshold-study";
const shift=Date.parse("2026-01-31T21:00:00Z");
const candle=(i:number,open:number,low=open-.1,close=open)=>({ts:shift+i*M,endTs:shift+(i+1)*M,open,high:Math.max(open,close)+.1,low:Math.min(low,close),close,volume:1,turnover:open});
const options=(n:number,changes:Partial<Options>={}):Options=>({start:shift,end:shift+n*M,delayMs:0,holdMs:12*H,notional:10000,equity:32000,feeRate:.00055,expiryMinutes:5,penetrationBps:0,...changes});
const signal=(i:number,cap=100)=>({at:shift+i*M,cap});
const d={extraStressRatePerSide:.0005};let checked=0;
function test(cs:ReturnType<typeof candle>[],signals:ReturnType<typeof signal>[],o:Options){
  const r=runCappedEntry(cs,signals,o);
  verifyCase({...r,options:o,stressNet:r.stats.net-r.stats.turnoverIncludingMarkedExit*.0005},cs,signals,d);checked++;return r;
}
// Deadline is exclusive: no fill when the first qualifying open is exactly expiry.
let r=test([101,101,100,99].map((p,i)=>candle(i,p)),[signal(0)],options(4,{expiryMinutes:2}));
assert.equal(r.entryStats.filled,0);assert.equal(r.entryStats.expired,1);
// Pre-activation low/open cannot fill; a later fresh signal is not the old intent.
r=test([99,101,101,99].map((p,i)=>candle(i,p)),[signal(0)],options(4,{delayMs:M,expiryMinutes:2}));assert.equal(r.entryStats.filled,0);
r=test([101,101,99,100].map((p,i)=>candle(i,p)),[signal(0),signal(1,105)],options(4));
assert.equal(r.intents.length,1);assert.equal(r.intents[0].cap,100);assert.equal(r.intents[0].entryAt,shift+2*M);assert.equal(r.open!.entryPrice,100);
// Touch-only wick is ignored; exact equality is accepted only in the lenient proxy.
r=test([candle(0,101,90),candle(1,101)],[signal(0)],options(2,{expiryMinutes:1}));assert.equal(r.entryStats.filled,0);assert.equal(r.entryStats.ignoredLowTouches,1);
r=test([candle(0,100),candle(1,99.9)],[signal(0)],options(2,{penetrationBps:5}));assert.equal(r.open!.entryAt,shift+M);assert.equal(r.open!.entryPrice,100);
r=test([candle(0,100),candle(1,99.9)],[signal(0)],options(2));assert.equal(r.open!.entryAt,shift);
// Hold starts at actual fill; later expiry signals can be accepted exactly at expiry.
r=test(Array.from({length:10},(_,i)=>candle(i,i<3?101:99)),[signal(0)],options(10,{holdMs:2*M,delayMs:M}));
assert.equal(r.trades[0].entryAt,shift+3*M);assert.equal(r.trades[0].exitAt,shift+6*M);
r=test([101,101,99,99].map((p,i)=>candle(i,p)),[signal(0),signal(2)],options(4,{expiryMinutes:2}));
assert.equal(r.intents[0].phase,"expired");assert.equal(r.intents[1].entryAt,shift+2*M);
// Deadline/cutoff boundary pending is censored, never called an observed expiry.
r=test([101,101].map((p,i)=>candle(i,p)),[signal(0)],options(2,{expiryMinutes:2}));assert.equal(r.entryStats.pendingAtCutoff,1);
// Exhaustive small matrix: month boundary, full/open trades, latency, expiry, strict fill.
const tape=Array.from({length:3000},(_,i)=>candle(i,100+Math.sin(i/11)*.5+i*.0002));
for(const n of [720,721,722,1500,3000])for(const delayMs of [0,M])for(const expiryMinutes of [null,5,15,30,60])for(const penetrationBps of expiryMinutes===null?[0]:[0,5]){
  const cs=tape.slice(0,n),signals=Array.from({length:Math.ceil(n/15)},(_,i)=>signal(i*15,i?cs[i*15-1].close:100));
  const o=options(n,{delayMs,expiryMinutes,penetrationBps}),r=test(cs,signals,o);
  if(expiryMinutes===null){const canonical=runCombination(cs.map(c=>({timestamp:c.ts,...c})),opportunities(signals.map(s=>s.at)),"long",o);
    assert.deepEqual(r.stats,canonical.stats);assert.deepEqual(r.monthly,canonical.monthly);assert.deepEqual(r.open,canonical.open);
    assert.deepEqual(r.trades,canonical.trades.map(({entryFeature,...t})=>t));}
}
// H/L/C poison cannot change filled entries if opens and frozen input signals stay fixed.
const cs=tape.slice(0,60),s=[signal(0),signal(15),signal(30)],o=options(60);
const first=runCappedEntry(cs,s,o),poisoned=runCappedEntry(cs.map(c=>({...c,high:c.high*5,low:c.low*.5,close:c.close*2})),s,o);
const entries=(x:typeof first)=>x.intents.filter(i=>i.phase==="filled").map(i=>[i.signalAt,i.entryAt,i.entryPrice]);assert.deepEqual(entries(first),entries(poisoned));
// Arbitrarily changing future opens cannot change earlier filled entries.
const future=runCappedEntry(cs.map((c,i)=>i<30?c:candle(i,200)),s,o);
assert.deepEqual(entries(first).filter(x=>x[1]!<shift+30*M),entries(future).filter(x=>x[1]!<shift+30*M));
console.log(`BH02 tests passed: ${checked} independently verified accounts; canonical market parity, expiry, activation, wick rejection, fixed cap, hold clock, occupancy, cutoff and future-poison checks`);
