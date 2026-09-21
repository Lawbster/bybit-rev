/** Append-only SF08: existing detector, replay, independent audit and chart renderer. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { ROOT,M,H,readSealedMinutes,readLiveMinutes,gapsOf,buildContext,type Minute,type SetupEvent } from './setup-scan-core';
import { sf01RangeLow } from './setup-detectors/sf01-range-low';
import { buildActions } from './setup-replay';
import { replay } from './poc-indicator-bias-engine';
import { auditStructuralReplay } from './structural-replay-audit';
import { atomicJson,fileHash,sha } from './research-workflow';
import { candleRequestUrl,sha256,validateCandleRepair,type CandleResponse,type CandleRepairBundle } from './replay-candle-repair';
import { barsFor,toEventView,renderChartHtml,parseTimeframes,parseCsv } from './setup-chart';
import type { Row } from './tp-hl-event-features';
const CARD='research-inputs/sfp-latest-candles-sf08-2026-09-21.json';
const read=(f:string)=>JSON.parse(fs.readFileSync(path.resolve(ROOT,f),'utf8'));
const pri=(x:Row)=>x.delay===0&&!x.stress&&!x.targetFirst;
async function verify(d:string){for(const a of read(`${d}/complete.json`).artifacts)assert.equal(await fileHash(path.resolve(ROOT,d,a.file)),a.sha256);}
async function request(url:string):Promise<CandleResponse>{const requestedAt=Date.now(),r=await fetch(url,{signal:AbortSignal.timeout(15000)});assert(r.ok,`GET ${r.status}`);const body=await r.text();return {url,requestedAt,receivedAt:Date.now(),body,sha256:sha256(body)};}
async function main(){
  const card=read(CARD),c=read(card.parentCard),parent=read(`${card.parent}/comparison.json`),oldEnd=Date.parse(card.oldCutoff),end=Date.parse(card.cutoff),start=Date.parse(c.from);
  assert.equal(oldEnd,Date.parse(c.to));assert(end<=Math.floor(Date.now()/M)*M);await verify(card.parent);
  const seal=read(`${card.sealedPrefix}/complete.json`);
  for(const f of ['candles.f64','schema.json'])assert.equal(await fileHash(path.resolve(ROOT,card.sealedPrefix,f)),seal.artifacts.find((a:Row)=>a.file===f).sha256);
  const files=[CARD,card.parentCard,`${card.parent}/complete.json`,`${card.sealedPrefix}/schema.json`,`${card.sealedPrefix}/candles.f64`,card.extensionSource,'data/HYPEUSDT_1_full.json',
    'scripts/sfp-latest-candles.ts','scripts/setup-scan-core.ts','src/strategies/setup-context.ts','src/strategies/setup-actions.ts','src/strategies/sfp-detector.ts','scripts/setup-detectors/sf01-range-low.ts','scripts/setup-replay.ts','scripts/poc-indicator-bias-engine.ts','scripts/structural-replay-audit.ts','scripts/replay-candle-repair.ts','scripts/setup-chart.ts'];
  const pins=await Promise.all(files.map(async file=>({file,bytes:fs.statSync(path.resolve(ROOT,file)).size,sha256:await fileHash(path.resolve(ROOT,file))})));
  const key=sha(JSON.stringify({card,pins})),out=path.join(ROOT,'backtests/sfp-latest-candles',key);
  if(fs.existsSync(path.join(out,'complete.json'))){await verify(out);console.log(`[SF08] verified existing ${out}`);return;}
  fs.mkdirSync(out,{recursive:true});atomicJson(path.join(out,'plan.json'),{key,card,pins});
  const raw=await readLiveMinutes(path.resolve(ROOT,card.extensionSource),oldEnd,end,0);
  assert.equal(raw.conflicts,0);assert.equal(raw.minutes[0].ts,oldEnd);assert.equal(raw.minutes.at(-1)!.endTs,end);
  const gaps=gapsOf(raw.minutes);assert(gaps.reduce((s,g)=>s+g.minutes,0)<=1,'Review additional gaps before fetching');
  let repair:CandleRepairBundle|null=null,inserts:Minute[]=[];
  if(gaps.length){
    const file=path.join(out,'repair.json');
    if(fs.existsSync(file))repair=read(file);
    else {const evidence=[];for(const g of gaps){const s=Math.floor(g.start/(5*M))*5*M;const [minute,fiveMinute]=await Promise.all([request(candleRequestUrl(c.symbol,'1',s-M,s+6*M-1)),request(candleRequestUrl(c.symbol,'5',s,s+5*M-1))]);evidence.push({missingTs:g.start,minute,fiveMinute});}
      repair={version:1,purpose:'corrected_exchange_history_not_recorded_arrival',symbol:c.symbol,category:'linear',intervalMs:60000,cutoff:end,retrievedAt:Date.now(),originalInputs:pins.filter(p=>p.file===card.extensionSource||p.file==='data/HYPEUSDT_1_full.json'),generatorSha256:pins.find(p=>p.file==='scripts/sfp-latest-candles.ts')!.sha256,evidence};
      validateCandleRepair(repair,raw.minutes,c.symbol,end);atomicJson(file,repair);
    }
    const v=validateCandleRepair(repair!,raw.minutes,c.symbol,end);inserts=v.inserts.map(m=>({...m,availableAt:repair!.retrievedAt}));
    atomicJson(path.join(out,'repair-verification.json'),{...v,inserts:v.inserts.map(x=>x.ts),historicalReceiptProven:false});
  }
  const tail=[...raw.minutes,...inserts].sort((a,b)=>a.ts-b.ts);assert.equal(gapsOf(tail).length,0);
  atomicJson(path.join(out,'extension-candles.json'),tail);
  const allResults:Row[]=[],parity:Row[]=[],newCloses:Row[]=[],arrivalChecks:Row[]=[];let chartCells:Row[]=[],chartEvents:SetupEvent[]=[],chartMinutes:Minute[]=[];
  for(const lag of c.sourceLagsMs){
    const prior=parent.runs.find((r:Row)=>r.lag===lag&&r.padding===5),sd=`backtests/setup-scans/${prior.scan}`;await verify(sd);
    const oldEvents:SetupEvent[]=fs.readFileSync(path.resolve(ROOT,sd,'events.jsonl'),'utf8').trim().split('\n').map(s=>JSON.parse(s));
    const prefix=readSealedMinutes(ROOT,card.sealedPrefix,lag).minutes;assert.equal(prefix.at(-1)!.endTs,oldEnd);
    const modes:Record<string,Minute[]>={modeled:tail.map(m=>({...m,availableAt:m.endTs+lag})),observed:tail.map(m=>({...m,availableAt:Math.max(m.availableAt,m.endTs+lag)}))};
    const detections:Record<string,SetupEvent[]>={};
    for(const [mode,extension] of Object.entries(modes)){
      const minutes=[...prefix,...extension],ctx=buildContext({symbol:c.symbol,minutes,lagMs:lag,window:{start,end},params:{...c.detector,requireRange:1}});
      detections[mode]=sf01RangeLow.detect(ctx).filter(e=>e.knownAt>=start&&e.knownAt<end);
      const before=(xs:SetupEvent[])=>xs.filter(e=>e.stage==='confirmed'&&e.knownAt<oldEnd);
      assert.equal(sha(JSON.stringify(before(detections[mode]))),sha(JSON.stringify(before(oldEvents))),'Future tail changed serialized old confirmed events');
      if(lag===60000&&mode==='modeled'){chartEvents=detections[mode];chartMinutes=minutes;}
      fs.writeFileSync(path.join(out,`events-${mode}-${lag}.jsonl`),detections[mode].map(e=>JSON.stringify(e)).join('\n')+'\n');
    }
    const same=JSON.stringify(detections.modeled.filter(e=>e.stage==='confirmed'))===JSON.stringify(detections.observed.filter(e=>e.stage==='confirmed'));
    arrivalChecks.push({lag,sameConfirmed:same,modeledNew: detections.modeled.filter(e=>e.stage==='confirmed'&&e.knownAt>=oldEnd),observedNew:detections.observed.filter(e=>e.stage==='confirmed'&&e.knownAt>=oldEnd)});
    const prices=[...prefix,...modes.modeled];const cs=prices.filter(m=>m.ts>=start);
    for(const cell of card.cells){
      const old=parent.runs.find((r:Row)=>r.lag===lag&&r.padding===cell.padding);await verify(`backtests/setup-replays/${old.replay}`);
      const cfg={...read(`backtests/setup-replays/${old.replay}/plan.json`).cfg,notional:cell.notional};
      const variant={side:1 as const,target:'r2',holdHours:24},built=buildActions(detections.modeled,variant,cfg),oldBuilt=buildActions(oldEvents,variant,cfg);
      assert.deepEqual(built.actions.filter(a=>a.at<oldEnd),oldBuilt.actions,'Action prefix changed');
      const opts={start,end:oldEnd,delay:0,hold:24*H,notional:10000,equity:c.equity,fee:c.feePerSide,targetFirst:false};
      const bridge=replay(cs,built.actions,opts),base=old.results.find((x:Row)=>pri(x)&&x.window==='full');
      for(const [k,v] of Object.entries(bridge.stats))assert.deepEqual(v,base[k],`old cutoff ${k}`);
      const csv= parseCsv(fs.readFileSync(path.resolve(ROOT,`backtests/setup-replays/${old.replay}/trades-long__r2__hold24h.csv`),'utf8'));
      assert.equal(csv.length,bridge.trades.length);for(let i=0;i<csv.length;i++)for(const k of ['id','entryAt','exitAt','entryPrice','exitPrice','stop','target','net','fees','reason'])assert.equal(String(bridge.trades[i][k]),String(csv[i][k]),`bridge trade ${i}/${k}`);
      parity.push({lag,...cell,oldReplay:old.replay,statsExact:true,tradesExact:true});
      for(const w of [{id:'full',start},{id:'recent',start:Date.parse(c.split)}])for(const delay of c.delaysMs)for(const targetFirst of [false,true])for(const stress of [false,true]){
        if(targetFirst&&stress)continue;
        const o={start:w.start,end,delay,hold:24*H,notional:cell.notional,equity:c.equity,fee:c.feePerSide+(stress?c.stressBpsPerSide/10000:0),targetFirst};
        const run=replay(cs,built.actions,o),audit=auditStructuralReplay(cs,built.actions,o,run),name=`pad${cell.padding}-${cell.notional}-lag${lag}-${w.id}-delay${delay}-${targetFirst?'target':'stop'}-${stress?'stress':'normal'}`;
        allResults.push({name,...cell,lag,window:w.id,delay,targetFirst,stress,stats:run.stats,monthly:run.monthly,open:run.open,audit});
        if(w.id==='full'&&delay===0&&!targetFirst&&!stress){
          assert.deepEqual(run.trades.filter(t=>t.exitAt<oldEnd).map(t=>({...t,qty:t.qty/(cell.notional/10000),pricePnl:t.pricePnl/(cell.notional/10000),fees:t.fees/(cell.notional/10000),net:t.net/(cell.notional/10000)})),bridge.trades,'Closed history changed');
          atomicJson(path.join(out,`${name}-trades.json`),run.trades);atomicJson(path.join(out,`${name}-actions.json`),built);
          const extra=run.trades.filter(t=>t.exitAt>=oldEnd).map(t=>{const held=prices.filter(m=>m.ts>=t.entryAt&&m.ts<=t.exitAt),after=prices.find(m=>m.ts>t.exitAt&&m.high>=t.target!);return {...t,entryUtc:new Date(t.entryAt).toISOString(),exitUtc:new Date(t.exitAt).toISOString(),minimumWhileHeld:Math.min(...held.map(m=>m.low)),laterTargetTouch:after?new Date(after.ts).toISOString():null};});
          newCloses.push({lag,...cell,trades:extra,open:run.open});
          if(!same){const observedBuilt=buildActions(detections.observed,variant,cfg),observed=replay(cs,observedBuilt.actions,o);auditStructuralReplay(cs,observedBuilt.actions,o,observed);atomicJson(path.join(out,`${name}-observed.json`),{stats:observed.stats,trades:observed.trades,open:observed.open});arrivalChecks.push({lag,...cell,modeledNet:run.stats.net,observedNet:observed.stats.net,sameTradePath:JSON.stringify(observed.trades)===JSON.stringify(run.trades)});}
          if(lag===60000)chartCells.push({id:`padding${cell.padding}__notional${cell.notional}`,side:'long',target:'original r2',holdHours:24,summary:run.stats,trades:run.trades,rejected:built.rejected,discarded:built.discarded});
          console.log(JSON.stringify({lag,...cell,net:run.stats.net,dd:run.stats.maxAdverseDrawdownPct,w:run.stats.wins,l:run.stats.losses,newCloses:extra,open:run.open}));
        }
      }
    }
  }
  const model:any={mode:'replay',title:'SF08 latest candles: unchanged stop vs 5% padding',symbol:c.symbol,setup:'SF01',version:sf01RangeLow.version,window:{from:start,to:end},tape:'sealed prefix + verified synced extension',tapeNote:'Historical modeled availability; receipt-aware diagnostic saved separately. Original 2R target and 24h cap unchanged.',tapeSpan:{start:chartMinutes[0].ts,end,rows:chartMinutes.length,gaps:0},keys:{scan:key,replay:key},conventions:sf01RangeLow.conventions,generatedAt:Date.now(),rowsIncluded:'all',timeframes:parseTimeframes('4h,1h').map(t=>({...t,bars:barsFor(chartMinutes,t.ms)})),events:chartEvents.map(toEventView),cells:chartCells};
  fs.writeFileSync(path.join(out,'replay.html'),renderChartHtml(model));
  atomicJson(path.join(out,'comparison.json'),{key,card,parity,arrivalChecks,results:allResults,newCloses});
  for(const p of pins)assert.equal(await fileHash(path.resolve(ROOT,p.file)),p.sha256,'Input changed while running');
  const artifacts=await Promise.all(fs.readdirSync(out).filter(f=>f!=='complete.json').map(async file=>({file,sha256:await fileHash(path.join(out,file))})));
  atomicJson(path.join(out,'complete.json'),{key,artifacts});atomicJson(path.join(ROOT,'backtests/sfp-latest-candles/latest.json'),{key,dir:out});console.log(`[SF08] complete ${out}; ${allResults.length} audited paths`);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
