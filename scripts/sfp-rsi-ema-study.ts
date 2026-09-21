/** SF05: frozen user condition, saved SF01 signals, unchanged bracket replay. Research only. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { ROOT, loadTape } from './setup-scan-core';
import { buildActions } from './setup-replay';
import { replay, type Row } from './poc-indicator-bias-engine';
import { auditStructuralReplay } from './structural-replay-audit';
import { buildPolicyTape, adaptActions, warning, M, H } from './sfp-rsi-ema-policy';
import { atomicJson, fileHash, sha } from './research-workflow';
import { csv } from './poc-bounce-study';
const CARD='research-inputs/sfp-rsi-ema-sf05-2026-09-20.json';
const read=(file:string)=>JSON.parse(fs.readFileSync(path.resolve(ROOT,file),'utf8'));
const sum=(rows:Row[])=>rows.reduce((v,t)=>v+t.net,0);
const primary=(r:Row)=>r.delay===0&&!r.targetFirst&&!r.stress;
async function verify(dir:string){for(const a of read(path.join(dir,'complete.json')).artifacts)assert.equal(await fileHash(path.join(dir,a.file)),a.sha256);}
function attribution(a:Row,b:Row){
  const am=new Map<string,Row>(a.trades.map((t:Row)=>[t.id,t])),bm=new Map<string,Row>(b.trades.map((t:Row)=>[t.id,t]));
  const removed=a.trades.filter((t:Row)=>!bm.has(t.id)),added=b.trades.filter((t:Row)=>!am.has(t.id));
  const changed=b.trades.filter((t:Row)=>am.has(t.id)).map((t:Row)=>({id:t.id,entryAt:t.entryAt,oldReason:am.get(t.id)!.reason,newReason:t.reason,oldNet:am.get(t.id)!.net,newNet:t.net,delta:t.net-am.get(t.id)!.net}));
  const commonDelta=changed.reduce((v:number,t:Row)=>v+t.delta,0),openDelta=b.stats.openNet-a.stats.openNet,delta=b.stats.net-a.stats.net;
  assert(Math.abs(delta-(-sum(removed)+sum(added)+commonDelta+openDelta))<1e-6);
  return {delta,removedWins:removed.filter((t:Row)=>t.net>0).length,removedWinningDollars:sum(removed.filter((t:Row)=>t.net>0)),
    removedLosses:removed.filter((t:Row)=>t.net<0).length,removedLosingDollars:sum(removed.filter((t:Row)=>t.net<0)),
    addedWins:added.filter((t:Row)=>t.net>0).length,addedLosses:added.filter((t:Row)=>t.net<0).length,addedNet:sum(added),commonDelta,openDelta,removed,added,changed:changed.filter((t:Row)=>Math.abs(t.delta)>1e-8)};
}
async function main(){
  const card=read(CARD),p=read(card.parentCard),pd=path.join(ROOT,card.parentStudy);await verify(pd);
  assert.deepEqual([card.rsiTfMinutes,card.rsiPeriod,card.rsiBelow,card.emaTfMinutes,card.emaPeriod,card.distanceAbovePct],[15,14,52,240,200,6]);
  assert.deepEqual(card.cases,['A_baseline','B_entry_block','C_entry_block_and_exit']);
  const parent=read(path.join(pd,'comparison.json')),parents=parent.runs.filter((r:Row)=>r.name===card.parentName);
  assert.equal(parents.length,2);
  for(const r of parents){await verify(path.join(ROOT,'backtests/setup-scans',r.scan));await verify(path.join(ROOT,'backtests/setup-replays',r.replay));}
  const scanPlan=read(`backtests/setup-scans/${parents[0].scan}/plan.json`),cache=path.dirname(scanPlan.tape.file),schema=read(`${cache}/schema.json`);
  const sealed=read(`${cache}/complete.json`),candlePins=sealed.artifacts.filter((a:Row)=>['candles.f64','schema.json'].includes(a.file)).map((a:Row)=>({...a,file:`${cache}/${a.file}`}));
  for(const pin of candlePins)assert.equal(await fileHash(path.join(ROOT,pin.file)),pin.sha256);
  const sf04='backtests/sfp-pressure-map/0aa039e6bb818eab803e8ceba5b54c8b6f0fe242db24aa70fbcf46124d732207';
  const files=[CARD,card.parentCard,'scripts/sfp-rsi-ema-study.ts','scripts/sfp-rsi-ema-policy.ts','scripts/setup-replay.ts','scripts/setup-scan-core.ts',
    'scripts/poc-indicator-bias-engine.ts','scripts/structural-replay-audit.ts','scripts/pressure-point-features.ts','src/research/indicator-features.ts',
    'node_modules/technicalindicators/lib/moving_averages/EMA.js','node_modules/technicalindicators/lib/oscillators/RSI.js',`${card.parentStudy}/complete.json`,
    `${sf04}/trades.json`,`${sf04}/snapshots.json`,...parents.flatMap((r:Row)=>[`backtests/setup-scans/${r.scan}/events.jsonl`,`backtests/setup-replays/${r.replay}/complete.json`])];
  const pins=await Promise.all(files.map(async file=>({file,sha256:await fileHash(path.join(ROOT,file))})));
  const key=sha(JSON.stringify({card,pins,candlePins})),out=path.join(ROOT,'backtests/sfp-rsi-ema',key);
  if(fs.existsSync(path.join(out,'complete.json'))){await verify(out);console.log(`[SF05] verified cached ${key}`);return;}
  fs.mkdirSync(out,{recursive:true});const write=(file:string,value:unknown)=>atomicJson(path.join(out,file),value);
  write('plan.json',{key,card,parentCard:p,pins,candlePins,createdAt:Date.now(),node:process.version});
  const from=Date.parse(p.from),end=Date.parse(p.to),split=Date.parse(p.split);
  const {minutes}=await loadTape(ROOT,p.symbol,schema.start,end,M,'sealed');
  const windows=[{id:'full',start:from,end},{id:'older',start:from,end:split},{id:'recent',start:split,end}];
  const results:Row[]=[],months:Row[]=[],audits:Row[]=[],coverage:Row[]=[],attributes:Row[]=[],cohort:Row[]=[];
  const sample=read(`${sf04}/trades.json`),snapshots=read(`${sf04}/snapshots.json`).filter((s:Row)=>s.anchor==='entry'&&s.offset===0);
  for(const base of parents){
    const tape=buildPolicyTape(minutes,base.lag);
    for(const r of tape.rows){assert(r.rsiEnd+base.lag<=r.at);assert(r.emaEnd===null||r.emaEnd+base.lag<=r.at);}
    const events=fs.readFileSync(path.join(ROOT,'backtests/setup-scans',base.scan,'events.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
    const built=buildActions(events,{side:1,target:'r2',holdHours:24},{riskMinPct:p.riskMinPct,riskMaxPct:p.riskMaxPct,stopBufferPct:0,includeControls:false});
    const journals=new Map<string,Row>();
    for(const mode of card.cases){
      const adapted=adaptActions(built.actions,tape,mode);
      for(const d of adapted.decisions){
        assert(!d.entry||d.entry.at<=d.signalAt);
        if(d.exit){assert(d.exit.at>d.signalAt&&d.exit.warning);assert(!tape.rows.some(r=>r.at>d.signalAt&&r.at<d.exit.at&&r.warning));}
      }
      write(`decisions-${base.lag}-${mode}.json`,adapted);
      for(const w of windows){const ds=adapted.decisions.filter(d=>d.signalAt>=w.start&&d.signalAt<w.end);
        coverage.push({lag:base.lag,mode,window:w.id,signals:ds.length,unknown:ds.filter(d=>d.entry?.warning==null).length,vetoes:ds.filter(d=>d.veto).length,scheduledExits:ds.filter(d=>d.exit).length});
        for(const delay of p.delaysMs)for(const targetFirst of [false,true])for(const stress of [false,true]){
          if(stress&&targetFirst)continue;
          const o={start:w.start,end:w.end,delay,hold:24*H,notional:p.notional,equity:p.equity,fee:p.feePerSide+(stress?p.stressBpsPerSide/10000:0),targetFirst};
          const run=replay(minutes,adapted.actions,o),audit=auditStructuralReplay(minutes,adapted.actions,o,run),ts=run.trades as Row[];
          const meta={cell:'long__r2__hold24h',window:w.id,delay,targetFirst,stress};
          const row={cell:meta.cell,side:'long',target:'r2',holdHours:24,window:w.id,delay,targetFirst,stress,...run.stats,
            stressNet:stress?run.stats.net:run.stats.net-run.stats.turnoverIncludingMarkedExit*p.stressBpsPerSide/10000,
            targets:ts.filter(t=>t.reason==='target').length,stops:ts.filter(t=>t.reason==='stop').length,timeouts:ts.filter(t=>t.reason==='timeout').length,
            top5WinDollars:[...ts].sort((a,b)=>b.net-a.net).slice(0,5).reduce((v,t)=>v+Math.max(0,t.net),0),
            initialRiskAvg:ts.length?ts.reduce((v,t)=>v+t.qty*Math.abs(t.entryPrice-t.stop),0)/ts.length:null};
          if(mode==='A_baseline'){
            assert.deepEqual(row,base.results.find((r:Row)=>r.cell===meta.cell&&r.window===w.id&&r.delay===delay&&r.targetFirst===targetFirst&&r.stress===stress),'archived result parity');
            assert.deepEqual(run.monthly.map(m=>({...meta,...m})),base.monthly.filter((r:Row)=>r.cell===meta.cell&&r.window===w.id&&r.delay===delay&&r.targetFirst===targetFirst&&r.stress===stress),'archived monthly parity');
          }
          results.push({mode,lag:base.lag,...row,indicatorExits:ts.filter(t=>t.reason==='poc_failure').length});
          months.push(...run.monthly.map(m=>({mode,lag:base.lag,...meta,...m})));audits.push({mode,lag:base.lag,...meta,...audit});
          if(primary(meta)){
            journals.set(`${mode}/${w.id}`,run);write(`trades-${base.lag}-${mode}-${w.id}.json`,{trades:run.trades,open:run.open,accepted:run.accepted,stats:run.stats});
            if(w.id==='full'){
              const text=csv(ts.map(t=>({...t,evidence:JSON.stringify(t.evidence?.stages??{}),signalUtc:new Date(t.signalAt).toISOString(),entryUtc:new Date(t.entryAt).toISOString(),exitUtc:new Date(t.exitAt).toISOString()})));
              fs.writeFileSync(path.join(out,`trades-${base.lag}-${mode}.csv`),text);
              if(mode==='A_baseline')assert.equal(text,fs.readFileSync(path.join(ROOT,'backtests/setup-replays',base.replay,`trades-${meta.cell}.csv`),'utf8'),'archived trade-byte parity');
            }
          }
        }
      }
      console.log(`[SF05] lag${base.lag} ${mode} complete`);
    }
    for(const w of windows)for(const [a,b] of [['A_baseline','B_entry_block'],['A_baseline','C_entry_block_and_exit'],['B_entry_block','C_entry_block_and_exit']])
      attributes.push({lag:base.lag,window:w.id,reference:a,variant:b,...attribution(journals.get(`${a}/${w.id}`)!,journals.get(`${b}/${w.id}`)!)});
    if(base.lag===M)for(const t of sample){const r=tape.at(t.entryAt)!,s=snapshots.find((x:Row)=>x.id===t.id)!;
      assert.equal(r.warning,warning(s.values.m15_rsi,s.values.m240_ema200DistancePct),'SF04 entry predicate agreement');
      cohort.push({id:t.id,entryAt:t.entryAt,group:t.group,net:t.net,recovery:t.recovery,warning:r.warning,rsi:r.rsi,distance:r.distance});}
  }
  const screens=card.cases.slice(1).map((mode:string)=>{
    const reasons=new Set<string>();
    for(const r of results.filter(r=>r.mode===mode&&!r.targetFirst)){
      const a=results.find(x=>x.mode==='A_baseline'&&x.lag===r.lag&&x.window===r.window&&x.delay===r.delay&&x.stress===r.stress&&!x.targetFirst)!;
      if(r.net<=0)reasons.add('nonpositive_window_or_stress');if(r.bankrupt)reasons.add('bankrupt');
      if(primary(r)){
        if(r.net<a.net)reasons.add('net_worse_than_baseline');if(r.maxAdverseDrawdownPct>a.maxAdverseDrawdownPct)reasons.add('dd_worse_than_baseline');
        if(r.trades<(r.window==='full'?p.screen.tradesMin:p.screen.tradesPerSplitMin))reasons.add('sample');
        if(r.profitFactor===null||r.profitFactor<p.screen.profitFactorMin)reasons.add('profit_factor');
        if(r.net-r.top5WinDollars<=p.screen.netExTop5Min)reasons.add('top5_concentration');
        for(const m of months.filter(m=>m.mode===mode&&m.lag===r.lag&&m.window===r.window&&primary(m))){
          const b=months.find(x=>x.mode==='A_baseline'&&x.lag===r.lag&&x.window===r.window&&x.month===m.month&&primary(x))!;
          if(m.markedNet-b.markedNet<p.screen.monthlyDeltaMin)reasons.add('monthly_regression');
        }
      }
    }return {mode,pass:reasons.size===0,reasons:[...reasons]};
  });
  write('results.json',results);write('monthly.json',months);write('attribution.json',attributes);write('coverage.json',coverage);write('sample.json',cohort);write('screen.json',screens);
  write('audit.json',{passed:true,paths:audits.length,archivedResultsAndMonthlyAndTradeBytesExact:true,sourceClocks:true,sf04PredicateAgreement:true,receipts:audits});
  fs.writeFileSync(path.join(out,'results.csv'),csv(results));fs.writeFileSync(path.join(out,'monthly.csv'),csv(months));
  const artifacts=await Promise.all(fs.readdirSync(out).sort().map(async file=>({file,sha256:await fileHash(path.join(out,file))})));
  write('complete.json',{key,artifacts});atomicJson(path.join(ROOT,'backtests/sfp-rsi-ema/latest.json'),{key,dir:path.relative(ROOT,out)});
  console.log(JSON.stringify({key,primary:results.filter(r=>r.lag===M&&primary(r)).map(r=>({mode:r.mode,window:r.window,w:r.wins,l:r.losses,net:r.net,dd:r.maxAdverseDrawdownPct,exits:r.indicatorExits,avgLoss:r.avgLoss})),screens},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
