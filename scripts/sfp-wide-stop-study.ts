/** SF06: saved SF01 events + existing replay/audit; change only execution stop padding. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { ROOT,type SetupEvent } from './setup-scan-core';
import { buildActions,runReplay,type ReplayConfig } from './setup-replay';
import { parseCsv } from './setup-chart';
import { atomicJson,fileHash,sha } from './research-workflow';
import { distribution } from './sfp-pressure-features';
import type { Row } from './tp-hl-event-features';
const cardArg=process.argv.indexOf('--card');
const CARD=cardArg>=0?process.argv[cardArg+1]:'research-inputs/sfp-wide-stop-sf06-2026-09-20.json',CELL='long__r2__hold24h';
const read=(f:string)=>JSON.parse(fs.readFileSync(path.resolve(ROOT,f),'utf8'));
const primary=(r:Row)=>r.delay===0&&!r.targetFirst&&!r.stress;
const sum=(ts:Row[])=>ts.reduce((s,t)=>s+Number(t.net),0);
async function verify(dir:string){for(const a of read(path.join(dir,'complete.json')).artifacts)assert.equal(await fileHash(path.join(dir,a.file)),a.sha256);}
async function main(){
  const card=read(CARD),c=read(card.parentCard),pd=path.join(ROOT,card.parentStudy);await verify(pd);
  assert(['SF06','SF07'].includes(card.id));
  assert.deepEqual(card.exitStopPaddingPct,card.id==='SF06'?[0,.5,1,2,3]:[0,...Array.from({length:13},(_,i)=>3+i*.25)]);
  assert.equal(card.holdHours,24);assert.equal(card.target,'r2');
  const tag=card.id,outputRoot=card.id==='SF07'?'backtests/sfp-wide-stop-grid':'backtests/sfp-wide-stop';
  let previous:Row|null=null;
  if(card.priorWideStudy){await verify(path.join(ROOT,card.priorWideStudy));previous=read(`${card.priorWideStudy}/comparison.json`);}
  const parent=read(path.join(pd,'comparison.json')),parents=parent.runs.filter((r:Row)=>r.name===card.parentName);
  const sp=read(`backtests/setup-scans/${parents[0].scan}/plan.json`),cache=path.dirname(sp.tape.file),seal=read(`${cache}/complete.json`);
  const input=seal.artifacts.filter((a:Row)=>['candles.f64','schema.json'].includes(a.file)).map((a:Row)=>({...a,file:`${cache}/${a.file}`}));
  for(const a of input)assert.equal(await fileHash(path.join(ROOT,a.file)),a.sha256);
  const files=[CARD,card.parentCard,`${card.parentStudy}/complete.json`,'scripts/sfp-wide-stop-study.ts','scripts/setup-replay.ts','scripts/setup-scan-core.ts',
    'scripts/poc-indicator-bias-engine.ts','scripts/structural-replay-audit.ts','scripts/sfp-pressure-features.ts','scripts/setup-chart.ts'];
  if(card.priorWideStudy)files.push(`${card.priorWideStudy}/complete.json`);
  const pins=await Promise.all(files.map(async file=>({file,sha256:await fileHash(path.join(ROOT,file))})));
  const key=sha(JSON.stringify({card,input,pins})),out=path.join(ROOT,outputRoot,key);
  if(fs.existsSync(path.join(out,'complete.json'))){await verify(out);for(const r of read(path.join(out,'comparison.json')).runs)await verify(path.join(ROOT,'backtests/setup-replays',r.replay));console.log(`[${tag}] verified cache ${key}`);return;}
  fs.mkdirSync(out,{recursive:true});const j:Row={key,card,pins,input,parent:parent.key,createdAt:Date.now(),runs:[],parity:[],attribution:[],risk:[],traces:[],screens:[]};
  atomicJson(path.join(out,'plan.json'),{key,card,pins,input});
  for(const old of parents){
    const sd=path.join(ROOT,'backtests/setup-scans',old.scan),rd=path.join(ROOT,'backtests/setup-replays',old.replay);await verify(sd);await verify(rd);
    const events:SetupEvent[]=fs.readFileSync(path.join(sd,'events.jsonl'),'utf8').trim().split('\n').map(s=>JSON.parse(s));
    for(const e of events.filter(e=>e.stage==='confirmed')){assert(e.stages.level.knownAt<=e.stages.sweep.at);assert(e.stages.range.knownAt<=e.stages.sweep.at);assert(e.stages.sweep.knownAt<=e.knownAt);assert.equal(e.stages.reclaim.knownAt,e.knownAt);}
    const cfg:ReplayConfig={scanKey:old.scan,sides:[1],targets:[card.target],holds:[card.holdHours],delaysMs:c.delaysMs,notional:c.notional,equity:c.equity,
      fee:c.feePerSide,stressBpsPerSide:c.stressBpsPerSide,split:Date.parse(c.split),riskMinPct:c.riskMinPct,riskMaxPct:c.riskMaxPct,stopBufferPct:0,includeControls:false,rows:{stage:'confirmed'}};
    const original=buildActions(events,{side:1,target:card.target,holdHours:card.holdHours},cfg);
    let baseline:Row|null=null;let baseTrades:Row[]=[];
    for(const padding of card.exitStopPaddingPct){
      const cc={...cfg,exitStopPaddingPct:padding},changed=buildActions(events,{side:1,target:card.target,holdHours:card.holdHours},cc);
      assert.deepEqual(changed.rejected,original.rejected);assert.deepEqual(changed.discarded,original.discarded);
      assert.deepEqual(changed.actions.map((a,i)=>({...a,stop:original.actions[i].stop})),original.actions);
      for(let i=0;i<changed.actions.length;i++)assert.equal(changed.actions[i].stop,original.actions[i].stop!*(1-padding/100));
      const run=await runReplay(ROOT,cc);await verify(run.dir);
      const pack:Row={padding,lag:old.lag,scan:old.scan,replay:run.key,results:read(path.join(run.dir,'results.json')),monthly:read(path.join(run.dir,'monthly.json')),actions:read(path.join(run.dir,'actions.json'))};
      const ts=parseCsv(fs.readFileSync(path.join(run.dir,`trades-${CELL}.csv`),'utf8')) as Row[];
      const row=(r:Row)=>r.results.find((x:Row)=>primary(x)&&x.window==='full');
      const overlap=previous?.runs.find((r:Row)=>r.lag===old.lag&&r.padding===padding);
      if(overlap){const prevDir=path.join(ROOT,'backtests/setup-replays',overlap.replay);await verify(prevDir);
        assert.equal(run.key,overlap.replay,'overlap must reuse identical replay identity');
        assert.deepEqual(pack.results,overlap.results);assert.deepEqual(pack.monthly,overlap.monthly);
        assert.equal(await fileHash(path.join(run.dir,`trades-${CELL}.csv`)),await fileHash(path.join(prevDir,`trades-${CELL}.csv`)));
      }
      pack.reused=run.reused;pack.previousStudyParity=!!overlap;
      if(padding===0){
        assert.deepEqual(pack.results,old.results.filter((r:Row)=>r.cell===CELL),'exact archived baseline results');
        assert.deepEqual(pack.monthly,old.monthly.filter((r:Row)=>r.cell===CELL),'exact archived baseline months');
        assert.equal(await fileHash(path.join(run.dir,`trades-${CELL}.csv`)),await fileHash(path.join(rd,`trades-${CELL}.csv`)),'exact archived baseline trade bytes');
        baseline=pack;baseTrades=ts;j.parity.push({lag:old.lag,results:pack.results.length,months:pack.monthly.length,tradeBytesExact:true});
      }else{
        const am=new Map(baseTrades.map(t=>[t.id,t])),bm=new Map(ts.map(t=>[t.id,t]));
        const common=ts.filter(t=>am.has(t.id)),removed=baseTrades.filter(t=>!bm.has(t.id)),added=ts.filter(t=>!am.has(t.id));
        const pairs=common.map(t=>({id:t.id,entryAt:Number(t.entryAt),baselineNet:Number(am.get(t.id)!.net),candidateNet:Number(t.net),baselineReason:am.get(t.id)!.reason,candidateReason:t.reason,
          baselineExitAt:Number(am.get(t.id)!.exitAt),candidateExitAt:Number(t.exitAt),baselineStop:Number(am.get(t.id)!.stop),candidateStop:Number(t.stop)}));
        const commonDelta=pairs.reduce((s,t)=>s+t.candidateNet-t.baselineNet,0),openDelta=row(pack).openNet-row(baseline!).openNet,delta=row(pack).net-row(baseline!).net;
        assert(Math.abs(commonDelta+sum(added)-sum(removed)+openDelta-delta)<1e-6);
        j.attribution.push({padding,lag:old.lag,commonDelta,openDelta,delta,added,removed,addedNet:sum(added),removedNet:sum(removed),pairs,
          loserToWinner:pairs.filter(t=>t.baselineNet<0&&t.candidateNet>0).length,winnerToLoser:pairs.filter(t=>t.baselineNet>0&&t.candidateNet<0).length,
          worsenedLosers:pairs.filter(t=>t.baselineNet<0&&t.candidateNet<t.baselineNet).length,
          worsenedLoserDelta:pairs.filter(t=>t.baselineNet<0&&t.candidateNet<t.baselineNet).reduce((s,t)=>s+t.candidateNet-t.baselineNet,0),
          missedWinners:removed.filter(t=>Number(t.net)>0).length,missedWinningDollars:sum(removed.filter(t=>Number(t.net)>0))});
        const converted=pairs.find(t=>t.baselineNet<0&&t.candidateNet>0);
        if(converted)j.traces.push({padding,lag:old.lag,event:events.find(e=>e.id===converted.id),original:am.get(converted.id),candidate:bm.get(converted.id)});
      }
      const risks=ts.map(t=>100*(Number(t.entryPrice)-Number(t.stop))/Number(t.entryPrice));
      j.risk.push({padding,lag:old.lag,...distribution(risks),exceedsOriginal5Pct:risks.filter(r=>r>5).length,avgDollarRisk:row(pack).initialRiskAvg});
      j.runs.push(pack);console.log(`[${tag}] ${run.reused?'reused':'ran'} padding${padding}% lag${old.lag}: net=${row(pack).net.toFixed(2)} DD=${row(pack).maxAdverseDrawdownPct.toFixed(2)}%`);
    }
  }
  for(const padding of card.exitStopPaddingPct.filter((n:number)=>n>0)){
    const failures:string[]=[];
    for(const r of j.runs.filter((r:Row)=>r.padding===padding)){
      const a=j.runs.find((x:Row)=>x.padding===0&&x.lag===r.lag),tag=`lag${r.lag}`,row=(x:Row,w:string)=>x.results.find((y:Row)=>primary(y)&&y.window===w);
      for(const w of ['full','older','recent']){const b=row(a,w),v=row(r,w);
        if(v.net-b.net<c.screen.netDeltaEachWindowMin-1e-8)failures.push(`${tag}/${w}: net below baseline`);
        if(v.maxAdverseDrawdownPct-b.maxAdverseDrawdownPct>c.screen.ddDeltaEachWindowMax+1e-8)failures.push(`${tag}/${w}: DD above baseline`);
        if(v.n<(w==='full'?c.screen.tradesMin:c.screen.tradesPerSplitMin))failures.push(`${tag}/${w}: sample`);
      }
      for(const m of r.monthly.filter((m:Row)=>primary(m)&&m.window==='full')){const b=a.monthly.find((x:Row)=>primary(x)&&x.window==='full'&&x.month===m.month);
        if(m.markedNet-b.markedNet<c.screen.monthlyDeltaMin-1e-8)failures.push(`${tag}/${m.month}: monthly delta ${(m.markedNet-b.markedNet).toFixed(2)}`);}
      const f=row(r,'full');if(f.profitFactor===null||f.profitFactor<c.screen.profitFactorMin)failures.push(`${tag}: profit factor`);
      if(f.net-f.top5WinDollars<=c.screen.netExTop5Min)failures.push(`${tag}: winner concentration`);
      if(r.results.some((x:Row)=>!x.targetFirst&&(x.net<=0||x.bankrupt)))failures.push(`${tag}: nonpositive window/stress/delay or bankruptcy`);
    }
    j.screens.push({padding,passed:failures.length===0,failures});
  }
  const expectedRuns=card.exitStopPaddingPct.length*c.sourceLagsMs.length;
  assert.equal(j.runs.length,expectedRuns);assert.equal(j.runs.reduce((n:number,r:Row)=>n+r.results.length,0),expectedRuns*18);
  atomicJson(path.join(out,'comparison.json'),j);
  const artifacts=await Promise.all(fs.readdirSync(out).sort().map(async file=>({file,sha256:await fileHash(path.join(out,file))})));
  atomicJson(path.join(out,'complete.json'),{key,artifacts});atomicJson(path.join(ROOT,outputRoot,'latest.json'),{key,dir:out});
  console.log(JSON.stringify({key,paths:expectedRuns*18,passes:j.screens.filter((s:Row)=>s.passed).length,candidates:j.screens.length},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
