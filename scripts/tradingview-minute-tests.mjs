import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINUTE, match, index, reconcile, serverClock, availability, csv } from './tradingview-minute-analysis.mjs';
const open=Date.UTC(2026,8,17,18),close=open+MINUTE;
const p={ohlcAbsoluteTolerance:1e-6,volumeRelativeTolerance:1e-6};
const candle={tMs:open,o:80,h:81,l:79,c:80.5,v:10};
const obs=(start,end,bar=candle,error)=>({requestedAtMs:close+start,observedAtMs:close+end,rows:new Map(bar?[[open,bar]]:[]),error});

test('CSV escapes embedded JSON quotes using doubled quotes',()=>{
  assert.equal(csv([{a:'{"x":1}',b:null}]),'a,b\n"{""x"":1}",\n');
});

test('minute comparison is exact-time and excludes the end boundary',()=>{
  const r=reconcile([candle,{...candle,tMs:close}],[candle],open,close,p);
  assert.equal(r.expected,1);assert.equal(r.fullMatches,1);
});
test('missing candles are not filled with synthetic zero volume',()=>{
  const r=reconcile([], [candle],open,close,p);assert.equal(r.missingTv,1);assert.equal(r.fullMatches,0);
});
test('duplicates and unaligned timestamps fail closed',()=>{
  assert.throws(()=>index([candle,candle]));assert.throws(()=>index([{...candle,tMs:open+1}]));
});
test('invalid price shape, negative and nonfinite volume fail',()=>{
  for(const b of [{...candle,h:79},{...candle,v:-1},{...candle,v:NaN}])assert.throws(()=>index([b]));
});
test('price and volume matching are separate and no tolerance widens',()=>{
  assert.deepEqual(match({...candle,c:80.6},candle,p),{price:false,volume:true,both:false});
  assert.deepEqual(match({...candle,v:11},candle,p),{price:true,volume:false,both:false});
});
test('straddling request cannot establish post-close availability',()=>{
  const r=availability([obs(-500,500),obs(1000,2000)],open,candle,p);
  assert.equal(r.straddlingRequests,1);assert.equal(r.firstReferenceMatch.rawReceiveDelayMs,2000);
});
test('pre-close presence is not finalized publication',()=>{
  const r=availability([obs(-1000,-500)],open,candle,p);
  assert.equal(r.firstReferenceMatch,null);assert.equal(r.rightCensored,true);
});
test('presence is distinguished from reference-matching value',()=>{
  const r=availability([obs(100,300,{...candle,v:8}),obs(1100,1300)],open,candle,p);
  assert.equal(r.firstPostClosePresent.rawReceiveDelayMs,300);
  assert.equal(r.firstReferenceMatch.rawReceiveDelayMs,1300);
  assert.deepEqual(r.publicationBracketMs,{low:100,high:1300});assert.equal(r.postCloseRevisions,1);
});
test('later revision remains visible even after a matching observation',()=>{
  const r=availability([obs(100,300),obs(500,800,{...candle,v:9}),obs(1000,1300)],open,candle,p);
  assert.equal(r.postCloseRevisions,2);assert.equal(r.firstReferenceMatch.rawReceiveDelayMs,300);
  assert.equal(r.latestMatchesReference,true);
});
test('absent candle is right censored and API errors do not fake absence',()=>{
  const r=availability([obs(100,300,null),obs(500,800,null,'timeout')],open,candle,p);
  assert.equal(r.rightCensored,true);assert.equal(r.censoredAfterMs,100);assert.equal(r.successfulObservations,1);
});
test('unknown reference never produces a match',()=>{
  const r=availability([obs(100,300)],open,null,p);assert.equal(r.referenceAvailable,false);assert.equal(r.firstReferenceMatch,null);
});
test('clock uncertainty expands bounds instead of claiming exact latency',()=>{
  const r=availability([obs(100,300)],open,candle,p,{lowMs:1000,highMs:1500});
  assert.equal(r.publicationBracketMs.high,1800);
  const c=serverClock({symbol:'BINANCE',requestedAtMs:1000,observedAtMs:1200,data:{serverTime:2300}});
  assert.equal(c.offsetLowMs,1100);assert.equal(c.offsetHighMs,1300);
});
