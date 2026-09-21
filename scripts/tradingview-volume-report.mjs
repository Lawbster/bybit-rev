/** Read-only by default. Rechecks saved source receipts without fetching again. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { HOUR, DAY, tvBars, nativeBars, instrument, compare, coverage } from './tradingview-volume-verify.mjs';

const root = process.argv[2];
assert(root?.startsWith('backtests/tradingview-volume-verification/'));
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash = b => createHash('sha256').update(b).digest('hex');
const receipt = read('receipt.json'), saved = read('verification.json'), plan = read('plan.json');
assert.deepEqual(saved.plan, plan);
assert.equal(receipt.codeSha256, hash(fs.readFileSync(new URL('./tradingview-volume-verify.mjs',import.meta.url))));
for(const f of receipt.files) {
  const bytes = fs.readFileSync(path.join(root,f.path));
  assert.equal(bytes.length,f.bytes); assert.equal(hash(bytes),f.sha256,`Changed evidence: ${f.path}`);
}
assert.equal(saved.results.length,plan.symbols.length);
const summary=[], exceptions=[];
for(const symbol of plan.symbols) {
  const id=symbol.replace(/[^a-zA-Z0-9]/g,'_'), prior=saved.results.find(x=>x.symbol===symbol);
  const tv=read(`tradingview/${id}_1h.json`), daily=read(`tradingview/${id}_1D.json`);
  const native=read(`native/${id}_1h.json`), meta=read(`native/${id}_meta.json`);
  for(const r of [native,meta]) {
    assert.equal(r.status,200); assert.equal(hash(r.rawText),r.rawSha256);
    assert.deepEqual(r.data,JSON.parse(r.rawText));
  }
  const a=tvBars(tv), b=nativeBars(symbol,native.data,meta.data), identity=instrument(symbol,meta.data);
  const result=compare(a,b,plan);
  assert.deepEqual(result,prior.comparison); assert.deepEqual(identity,prior.identity);
  assert.deepEqual(coverage(a,HOUR,tv.observedAtMs),prior.hourly);
  assert.deepEqual(coverage(tvBars(daily),DAY,daily.observedAtMs),prior.daily);
  assert(plan.comparisonEndExclusiveMs <= Math.min(tv.observedAtMs,native.observedAtMs)-HOUR);
  // Investigative hypotheses, not accepted normalizations for failing sources.
  const unit=symbol==='OKX:HYPEUSDT.P'?'quote':symbol==='MEXC:HYPEUSDT.P'?'contracts':'base';
  const metric=result.metrics[unit];
  let signedDelta=0, nativeSum=0;
  for(const d of result.detail) {
    signedDelta+=d.tv.v-d.native[unit]; nativeSum+=d.native[unit];
    if(!d.ohlcOk || !d.volumeMatches.includes(unit)) exceptions.push({
      symbol,openMs:d.tMs,openUtc:new Date(d.tMs).toISOString(),reason:'mismatch',
      testedUnit:unit,tvVolume:d.tv.v,nativeVolume:d.native[unit],
      signedVolumeErrorPct:100*(d.tv.v-d.native[unit])/Math.max(Math.abs(d.native[unit]),1e-12),
      maxPriceError:d.maxPriceError,
    });
  }
  for(let t=plan.comparisonEndExclusiveMs-plan.comparisonHours*HOUR;t<plan.comparisonEndExclusiveMs;t+=HOUR) {
    const x=a.find(r=>r.tMs===t), y=b.find(r=>r.tMs===t);
    if(!x || !y) exceptions.push({symbol,openMs:t,openUtc:new Date(t).toISOString(),reason:!x?'missing_tradingview':'missing_native',testedUnit:unit,tvVolume:x?.v??null,nativeVolume:y?.[unit]??null,signedVolumeErrorPct:null,maxPriceError:null});
  }
  summary.push({
    symbol,market:identity.market,quote:identity.quote,samplePassed:prior.samplePassed,
    testedUnit:unit,unitStatus:result.matchedUnits.includes(unit)?'sample_verified':metric.matched>0?'supported_with_mismatches':'scale_hypothesis_only',
    contractBaseMultiplier:identity.contractBaseMultiplier,expectedHours:result.expected,
    overlapHours:result.overlap,ohlcMatched:result.ohlcMatched,volumeMatched:metric.matched,
    maxVolumeErrorPct:metric.maxRelativeError*100,
    overlapTotalVolumeDeltaPct:nativeSum?100*signedDelta/nativeSum:null,
    firstDailyUtc:prior.daily.firstUtc,closedDailyBars:prior.daily.bars-prior.daily.unfinishedBars,
    missingDailyIntervals:prior.daily.missingIntervals,missingHourlyIntervals:prior.hourly.missingIntervals,
  });
}
const csv = rows => {
  const keys=Object.keys(rows[0]);
  const cell=v=>v==null?'':JSON.stringify(String(v));
  return keys.join(',')+'\n'+rows.map(r=>keys.map(k=>cell(r[k])).join(',')).join('\n')+'\n';
};
if(process.argv.includes('--write-summary')) {
  const files={ 'summary.csv':csv(summary), 'exceptions.csv':csv(exceptions) };
  for(const p of [...Object.keys(files),'summary-receipt.json']) assert(!fs.existsSync(path.join(root,p)),`Refusing overwrite: ${p}`);
  for(const [p,body] of Object.entries(files)) fs.writeFileSync(path.join(root,p),body,{flag:'wx'});
  fs.writeFileSync(path.join(root,'summary-receipt.json'),JSON.stringify({
    sourceReceiptSha256:hash(fs.readFileSync(path.join(root,'receipt.json'))),
    reportCodeSha256:hash(fs.readFileSync(new URL(import.meta.url))),
    files:Object.entries(files).map(([p,body])=>({path:p,sha256:hash(body)})),
  },null,2),{flag:'wx'});
}
if(fs.existsSync(path.join(root,'summary-receipt.json'))) {
  const r=read('summary-receipt.json');
  assert.equal(r.sourceReceiptSha256,hash(fs.readFileSync(path.join(root,'receipt.json'))));
  assert.equal(r.reportCodeSha256,hash(fs.readFileSync(new URL(import.meta.url))));
  for(const f of r.files) assert.equal(f.sha256,hash(fs.readFileSync(path.join(root,f.path))));
  assert.equal(fs.readFileSync(path.join(root,'summary.csv'),'utf8'),csv(summary));
  assert.equal(fs.readFileSync(path.join(root,'exceptions.csv'),'utf8'),csv(exceptions));
}
console.log(JSON.stringify({checkedSourceArtifacts:receipt.files.length,samplePasses:summary.filter(x=>x.samplePassed).length,feeds:summary.length,exceptions:exceptions.length,summary},null,2));
