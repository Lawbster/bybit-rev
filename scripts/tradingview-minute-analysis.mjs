/** Offline source reconciliation and effective-availability bounds, never a strategy input. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { tvBars, nativeBars } from './tradingview-volume-verify.mjs';

export const MINUTE=60000;
const sha=b=>createHash('sha256').update(b).digest('hex');
const safe=s=>s.replace(/[^a-zA-Z0-9]/g,'_');
const iso=t=>new Date(t).toISOString();
export function match(a,b,plan) {
  if(!a||!b)return {price:false,volume:false,both:false};
  const price=['o','h','l','c'].every(k=>Math.abs(a[k]-b[k])<=plan.ohlcAbsoluteTolerance);
  const volume=Math.abs(a.v-b.v)<=Math.max(Math.abs(b.v),1e-12)*plan.volumeRelativeTolerance;
  return {price,volume,both:price&&volume};
}
export function index(rows) {
  const m=new Map();
  for(const b of rows){
    assert(Number.isSafeInteger(b.tMs)&&b.tMs%MINUTE===0,'Invalid minute timestamp');
    assert(!m.has(b.tMs),'Duplicate minute');
    assert(['o','h','l','c','v'].every(k=>Number.isFinite(b[k])),'Invalid number');
    assert(b.v>=0&&b.l>0&&b.h>=Math.max(b.o,b.c,b.l)&&b.l<=Math.min(b.o,b.c,b.h),'Invalid candle');
    m.set(b.tMs,b);
  }
  return m;
}
export function reconcile(a,b,start,end,plan) {
  const am=index(a),bm=index(b),rows=[];
  for(let t=start;t<end;t+=MINUTE){
    const tv=am.get(t),native=bm.get(t),same=match(tv,native,plan);
    rows.push({openMs:t,openUtc:iso(t),tv:tv??null,native:native??null,...same,
      volumeDelta:tv&&native?tv.v-native.v:null,
      relativeVolumeError:tv&&native?Math.abs(tv.v-native.v)/Math.max(Math.abs(native.v),1e-12):null});
  }
  return {expected:rows.length,overlap:rows.filter(r=>r.tv&&r.native).length,missingTv:rows.filter(r=>!r.tv).length,
    missingNative:rows.filter(r=>!r.native).length,priceMatches:rows.filter(r=>r.price).length,
    volumeMatches:rows.filter(r=>r.volume).length,fullMatches:rows.filter(r=>r.both).length,
    maxVolumeErrorPct:100*Math.max(0,...rows.map(r=>r.relativeVolumeError??0)),rows};
}
export function serverClock(r) {
  const serverMs=r.symbol==='BYBIT'?r.data?.time:r.data?.serverTime;
  assert(Number.isFinite(serverMs),'Missing exchange clock');
  return {symbol:r.symbol,requestedAtMs:r.requestedAtMs,observedAtMs:r.observedAtMs,serverMs,
    offsetLowMs:serverMs-r.observedAtMs,offsetHighMs:serverMs-r.requestedAtMs,
    midpointOffsetMs:serverMs-(r.requestedAtMs+r.observedAtMs)/2,
    rttMs:r.observedAtMs-r.requestedAtMs,elapsedMonotonicMs:r.elapsedMonotonicMs};
}
export function availability(observations,openMs,reference,plan,clock={lowMs:0,highMs:0}) {
  const closeMs=openMs+MINUTE;
  const ordered=[...observations].sort((a,b)=>a.observedAtMs-b.observedAtMs);
  // Exclude straddling requests: their payload may have been formed before close.
  const post=ordered.filter(r=>r.requestedAtMs+clock.lowMs>=closeMs);
  const valid=post.filter(r=>!r.error);
  const present=valid.filter(r=>r.rows.has(openMs));
  const firstPresent=present[0]??null;
  const firstMatch=reference?present.find(r=>match(r.rows.get(openMs),reference,plan).both)??null:null;
  const lastDifferent=firstMatch?[...valid].reverse().find(r=>r.observedAtMs<firstMatch.observedAtMs&&!match(r.rows.get(openMs),reference,plan).both):null;
  let revisions=0; const changes=[];
  for(let i=1;i<present.length;i++){
    const before=present[i-1].rows.get(openMs),after=present[i].rows.get(openMs);
    if(['o','h','l','c','v'].some(k=>before[k]!==after[k])){revisions++;changes.push({previousReceivedAtMs:present[i-1].observedAtMs,receivedAtMs:present[i].observedAtMs,before,after});}
  }
  const bound=r=>r?{receivedAtMs:r.observedAtMs,requestedAtMs:r.requestedAtMs,
    rawReceiveDelayMs:r.observedAtMs-closeMs,clockAdjustedReceiveDelayLowMs:r.observedAtMs+clock.lowMs-closeMs,
    clockAdjustedReceiveDelayHighMs:r.observedAtMs+clock.highMs-closeMs,
    requestDurationMs:r.observedAtMs-r.requestedAtMs}:null;
  const last=present.at(-1);
  return {openMs,closeMs,closeUtc:iso(closeMs),observations:post.length,successfulObservations:valid.length,
    straddlingRequests:ordered.filter(r=>r.requestedAtMs+clock.lowMs<closeMs&&r.observedAtMs+clock.highMs>=closeMs).length,
    firstPostClosePresent:bound(firstPresent),firstReferenceMatch:bound(firstMatch),
    publicationBracketMs:firstMatch?{
      low:Math.max(0,lastDifferent?lastDifferent.requestedAtMs+clock.lowMs-closeMs:0),
      high:firstMatch.observedAtMs+clock.highMs-closeMs,
    }:null,
    rightCensored:!firstMatch,censoredAfterMs:!firstMatch&&valid.length?Math.max(0,valid.at(-1).requestedAtMs+clock.lowMs-closeMs):null,
    referenceAvailable:!!reference,postCloseRevisions:revisions,changes,
    nonmatchingObservations:reference?valid.filter(r=>!match(r.rows.get(openMs),reference,plan).both).length:null,
    latestMatchesReference:!!last&&!!reference&&match(last.rows.get(openMs),reference,plan).both,
    observedThroughMs:valid.at(-1)?.observedAtMs??null,
  };
}
export const csv=rows=>{
  if(!rows.length)return '';
  const keys=Object.keys(rows[0]),cell=v=>v==null?'':'"'+String(v).replace(/"/g,'""')+'"';
  return keys.join(',')+'\n'+rows.map(r=>keys.map(k=>cell(r[k])).join(',')).join('\n')+'\n';
};
export function analyze(root,write=false) {
  assert(root.startsWith('backtests/tradingview-minute-verification/'));
  const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
  const plan=read('plan.json');
  const nativeRecord=p=>{
    const r=read(p);assert.equal(sha(r.rawText),r.rawSha256);if(r.data)assert.deepEqual(r.data,JSON.parse(r.rawText));return r;
  };
  const nativeObservation=(p,symbol)=>{
    const r=nativeRecord(p); let rows,error=r.error;
    try{assert.equal(r.status,200);rows=index(nativeBars(symbol,r.data,{}).map(b=>({...b,v:b.base})));}catch(e){error??=e.message;rows=new Map();}
    return {...r,rows,error};
  };
  const tvObservation=p=>{
    const r=read(p);let rows,error=r.error;
    try{rows=index(tvBars(r));}catch(e){error??=e.message;rows=new Map();}
    return {...r,rows,error};
  };
  const history=[],exceptions=[];
  for(const symbol of plan.symbols){
    const id=safe(symbol),tv=tvObservation(`tradingview/history/${id}.json`);assert(!tv.error,tv.error);
    const rows=[];
    for(const f of fs.readdirSync(path.join(root,'native/history/initial')).filter(f=>f.startsWith(id+'_'))){
      const o=nativeObservation(`native/history/initial/${f}`,symbol);assert(!o.error,o.error);rows.push(...o.rows.values());
    }
    const result=reconcile([...tv.rows.values()],rows,plan.historyEndExclusiveMs-plan.historyMinutes*MINUTE,plan.historyEndExclusiveMs,plan);
    history.push({symbol,...result});exceptions.push(...result.rows.filter(r=>!r.both).map(r=>({symbol,...r})));
  }
  const parent=JSON.parse(fs.readFileSync(path.join(plan.parent,'verification.json'),'utf8'));
  const crossTimeframe=[];
  for(const h of history){
    const hours=parent.results.find(r=>r.symbol===h.symbol).comparison.detail;
    for(let i=0;i<h.rows.length;i+=60){
      const minutes=h.rows.slice(i,i+60),hour=hours.find(r=>r.tMs===minutes[0].openMs);
      if(!hour||minutes.length!==60||minutes.some(r=>!r.tv||!r.native))continue;
      const tvMinuteSum=minutes.reduce((s,r)=>s+r.tv.v,0),nativeMinuteSum=minutes.reduce((s,r)=>s+r.native.v,0);
      crossTimeframe.push({symbol:h.symbol,openMs:hour.tMs,tvMinuteSum,nativeMinuteSum,tvHour:hour.tv.v,nativeHour:hour.native.base,
        tvSumMatches:Math.abs(tvMinuteSum-hour.tv.v)<1e-6,nativeSumMatches:Math.abs(nativeMinuteSum-hour.native.base)<1e-6});
    }
  }
  if(!fs.existsSync(path.join(root,'capture-complete.json'))) {
    assert(!write,'Capture incomplete');return {history,exceptions,crossTimeframe,captureComplete:false};
  }
  const clock=[];
  for(const label of ['initial','final'])for(const symbol of ['BYBIT','BINANCE'])clock.push(serverClock(nativeRecord(`native/clock/${label}/${symbol}_0.json`)));
  // Conservatively encompass start/end measurements on both independent clocks.
  const clockBounds={lowMs:Math.min(...clock.map(c=>c.offsetLowMs)),highMs:Math.max(...clock.map(c=>c.offsetHighMs))};
  const rounds=fs.readdirSync(path.join(root,'rounds')).filter(f=>f.endsWith('.json')).sort().map(f=>read('rounds/'+f));
  const live=[],pollSummary=[];
  for(const symbol of plan.symbols){
    const id=safe(symbol),tv=[],native=[];
    for(const round of rounds){
      const label=String(round.round).padStart(3,'0');
      tv.push(tvObservation(`tradingview/poll/${label}_${id}.json`));
      const p=`native/poll/${label}/${id}_0.json`;
      if(fs.existsSync(path.join(root,p)))native.push(nativeObservation(p,symbol));
    }
    const ref=nativeObservation(`native/reference/final/${id}_0.json`,symbol);assert(!ref.error,ref.error);
    assert(ref.requestedAtMs>=plan.normalStopMs,'Reference before observation window ends');
    for(let i=0;i<plan.trackedCloses;i++){
      const openMs=plan.firstTrackedCloseMs+(i-1)*MINUTE,reference=ref.rows.get(openMs);
      live.push({symbol,source:'tradingview',...availability(tv,openMs,reference,plan,clockBounds)});
      live.push({symbol,source:'native',...availability(native,openMs,reference,plan,clockBounds)});
    }
    for(const [source,observations] of [['tradingview',tv],['native',native]]){
      const durations=observations.map(o=>o.observedAtMs-o.requestedAtMs).sort((a,b)=>a-b);
      pollSummary.push({symbol,source,requests:observations.length,errors:observations.filter(o=>o.error).length,
        minRttMs:durations[0],medianRttMs:durations[Math.floor(durations.length/2)],maxRttMs:durations.at(-1)});
    }
  }
  const report={version:1,plan,capture:read('capture-complete.json'),clock,clockBounds,
    qualifications:['First received reference-matching value is an observed upper bound, not exact exchange publication time.',
      'Bounds include MCP transport and polling cadence; straddling requests excluded.',
      'Final means matching the later native snapshot, not proof of permanent immutability.',
      'Clock bracket assumes start/end exchange samples bound local UTC error during this short run; no HL-specific server clock.',
      'No original historical receipt times can be recovered from this audit.'],
    history,exceptions,crossTimeframe,live,pollSummary};
  const outputs={
    'analysis.json':JSON.stringify(report,null,2),
    'history-summary.csv':csv(history.map(({symbol,rows,...r})=>({symbol,...r}))),
    'history-exceptions.csv':csv(exceptions.map(r=>({symbol:r.symbol,openMs:r.openMs,openUtc:r.openUtc,priceMatch:r.price,volumeMatch:r.volume,tvVolume:r.tv?.v,nativeVolume:r.native?.v,volumeDelta:r.volumeDelta,relativeVolumeError:r.relativeVolumeError,tvOHLC:r.tv?JSON.stringify(r.tv):null,nativeOHLC:r.native?JSON.stringify(r.native):null}))),
    'publication.csv':csv(live.map(r=>({symbol:r.symbol,source:r.source,closeMs:r.closeMs,closeUtc:r.closeUtc,firstPresentDelayMs:r.firstPostClosePresent?.rawReceiveDelayMs,
      firstReferenceMatchDelayMs:r.firstReferenceMatch?.rawReceiveDelayMs,publicationLowMs:r.publicationBracketMs?.low,publicationHighMs:r.publicationBracketMs?.high,
      rightCensored:r.rightCensored,censoredAfterMs:r.censoredAfterMs,postCloseRevisions:r.postCloseRevisions,nonmatchingObservations:r.nonmatchingObservations,latestMatchesReference:r.latestMatchesReference}))),
  };
  if(write){
    for(const p of [...Object.keys(outputs),'receipt.json'])assert(!fs.existsSync(path.join(root,p)),`Refusing overwrite: ${p}`);
    for(const [p,body] of Object.entries(outputs))fs.writeFileSync(path.join(root,p),body,{flag:'wx'});
    const files=[];
    const walk=d=>{for(const entry of fs.readdirSync(path.join(root,d),{withFileTypes:true})){const p=path.join(d,entry.name);if(entry.isDirectory())walk(p);else files.push({path:p,sha256:sha(fs.readFileSync(path.join(root,p)))});}};
    walk('');
    const code=['scripts/tradingview-minute-native.mjs','scripts/tradingview-minute-analysis.mjs','scripts/tradingview-volume-verify.mjs'];
    fs.writeFileSync(path.join(root,'receipt.json'),JSON.stringify({files,code:code.map(p=>({path:p,sha256:sha(fs.readFileSync(p))})),parentReceiptSha256:sha(fs.readFileSync(path.join(plan.parent,'receipt.json')))},null,2),{flag:'wx'});
  }else if(fs.existsSync(path.join(root,'receipt.json'))){
    const receipt=read('receipt.json');
    for(const f of receipt.files)assert.equal(sha(fs.readFileSync(path.join(root,f.path))),f.sha256,`Artifact changed: ${f.path}`);
    for(const f of receipt.code)assert.equal(sha(fs.readFileSync(f.path)),f.sha256,`Code changed: ${f.path}`);
    assert.equal(receipt.parentReceiptSha256,sha(fs.readFileSync(path.join(plan.parent,'receipt.json'))));
    for(const [p,body] of Object.entries(outputs))assert.equal(fs.readFileSync(path.join(root,p),'utf8'),body,`Recompute mismatch: ${p}`);
  }
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const r=analyze(process.argv[2],process.argv.includes('--write'));
  console.log(JSON.stringify({...r,history:r.history.map(({rows,...a})=>a),exceptions:r.exceptions.length},null,2));
}
