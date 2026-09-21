/** Post-hoc explanation of verified EQ01 results; no trading/replay changes. */
import fs from 'fs';
import assert from 'assert/strict';
import {atomicJson,sha,verifyPins,fileHash} from './research-workflow';
import {loadMinutes} from './relative-reversion-study';
type R=Record<string,any>;
const CARD='research-inputs/entry-wait-loss-concentration-2026-09-15.json';
const OUT='backtests/hype/entry-wait-loss-concentration-2026-09-15';
const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
const sum=(xs:R[])=>xs.reduce((n,e)=>n+e.pnl,0);
const average=(ps:R[])=>ps.reduce((n,p)=>n+p.notional,0)/ps.reduce((n,p)=>n+p.qty,0);
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
async function main(){const card=read(CARD),job=card.archive,dir=`${job}/output`,plan=read(`${job}/plan.json`),state=read(`${job}/state.json`);
  assert.equal(state.status,'complete');assert(read(`${job}/verification.json`).passed);
  // This reads archived features/ledgers, not today's pulse streams or bot state.
  // A later VPS sync is allowed, but the consumed minute history must still match.
  const mutable=(p:R)=>p.file==='bot-state.json'||p.file.startsWith('data/')&&p.file.endsWith('.jsonl');
  const pins=[...plan.pins.filter((p:R)=>!mutable(p)),...state.artifacts];
  const tapePin=plan.pins.find((p:R)=>p.file==='data/HYPEUSDT_1m.jsonl');assert(tapePin);
  const tape=fs.readFileSync(tapePin.file);assert(tape.length>=tapePin.bytes);
  assert.equal(sha(tape.subarray(0,tapePin.bytes)),tapePin.sha256,'Historical minute prefix changed');
  const added=tape.subarray(tapePin.bytes).toString('utf8').split('\n').filter(x=>x.trim()).map(x=>JSON.parse(x));
  assert(added.every((r:R)=>Number(r.timestamp??r.ts)+60000>Date.parse(plan.card.definition.cutoff)),'Appended candle revises study window');
  const protectedNow=await Promise.all(plan.protectedPins.map(async(p:R)=>({file:p.file,bytes:fs.statSync(p.file).size,sha256:await fileHash(p.file)})));
  pins.push(...protectedNow,{file:tapePin.file,bytes:tape.length,sha256:sha(tape)});
  const sourceAudit={archivedMinutePrefixMatches:true,excludedNewMinutes:added.length,protectedNow,
    notConsumedMutableInputs:plan.pins.filter((p:R)=>mutable(p)&&p.file!==tapePin.file).map((p:R)=>p.file)};
  await verifyPins(process.cwd(),pins);assert(!fs.existsSync(OUT),'Preserve prior evidence');fs.mkdirSync(OUT);
  atomicJson(`${OUT}/plan.json`,{card,sourceAudit,scriptSha256:sha(fs.readFileSync(__filename)),cardSha256:sha(fs.readFileSync(CARD)),sourceVerificationSha256:sha(fs.readFileSync(`${job}/verification.json`))});
  const d=plan.card.definition,cs=(await loadMinutes(process.cwd(),'HYPEUSDT',Date.parse(d.cutoff),d.repairFile)).candles;
  const rows:R[]=read(`${dir}/results.json`),get=(r:R,f:string)=>read(`${dir}/${r.name}-${f}.json`);
  for(const r of rows){assert.equal(sha(JSON.stringify(get(r,'engine'))),r.digest);near(sum(r.metrics.episodes)+r.metrics.unfinishedPartialPnl+r.metrics.openPnl,r.metrics.totalPnl);}
  const pairs=rows.filter(r=>!r.waiting).map(b=>{const v=rows.find(r=>r.waiting&&r.window===b.window&&r.tp===b.tp)!;
    const bm=new Map(b.metrics.episodes.map((e:R)=>[e.entry,e])),vm=new Map(v.metrics.episodes.map((e:R)=>[e.entry,e]));
    const matched:R[]=b.metrics.episodes.filter((e:R)=>vm.has(e.entry)).map((e:R)=>({entry:e.entry,baseline:e,waiting:vm.get(e.entry),delta:(vm.get(e.entry)as R).pnl-e.pnl}));
    const flips=matched.filter(e=>e.baseline.pnl<0&&e.waiting.pnl>0),reverse=matched.filter(e=>e.baseline.pnl>0&&e.waiting.pnl<0);
    const removed=b.metrics.episodes.filter((e:R)=>!vm.has(e.entry)),replacement=v.metrics.episodes.filter((e:R)=>!bm.has(e.entry));
    const lossCount=b.metrics.losingEpisodes-flips.length+reverse.length-removed.filter((e:R)=>e.pnl<0).length+replacement.filter((e:R)=>e.pnl<0).length;
    assert.equal(lossCount,v.metrics.losingEpisodes);const matchedDelta=matched.reduce((n,e)=>n+e.delta,0),delta=v.metrics.totalPnl-b.metrics.totalPnl;
    near(matchedDelta-sum(removed)+sum(replacement)+v.metrics.openPnl+v.metrics.unfinishedPartialPnl-b.metrics.openPnl-b.metrics.unfinishedPartialPnl,delta);
    return {window:b.window,tp:b.tp,baselineNet:b.metrics.totalPnl,waitingNet:v.metrics.totalPnl,delta,baselineDd:b.metrics.maxDrawdownPct,waitingDd:v.metrics.maxDrawdownPct,
      baselineLosses:b.metrics.losingEpisodes,waitingLosses:v.metrics.losingEpisodes,matched:matched.length,matchedBetter:matched.filter(e=>e.delta>1e-6).length,
      matchedWorse:matched.filter(e=>e.delta< -1e-6).length,matchedDelta,flips,reverse,removed,replacement,
      baselineHardFlattens:b.metrics.episodes.filter((e:R)=>e.reason==='hard_flatten').length,
      matchedHardToTp:matched.filter(e=>e.baseline.reason==='hard_flatten'&&['tp','stale_tp'].includes(e.waiting.reason)),topMatched:matched.sort((a,b)=>b.delta-a.delta).slice(0,10)};});
  const cases:R[]=[];
  for(const spec of card.cases){const b=rows.find(r=>!r.waiting&&r.window===spec.window&&r.tp==='resting_touch')!,v=rows.find(r=>r.waiting&&r.window===spec.window&&r.tp==='resting_touch')!;
    const be=b.metrics.episodes.find((e:R)=>e.entry===spec.entry),ve=v.metrics.episodes.find((e:R)=>e.entry===spec.entry);assert(be&&ve);
    const bv:R[]=get(b,'events'),vv:R[]=get(v,'events'),id=(es:R[])=>es.find(e=>e.event.kind==='open'&&!e.before.length&&e.event.fillAt===Date.parse(spec.entry))!.episode;
    const bid=id(bv),vid=id(vv),bes=bv.filter(e=>e.episode===bid),ves=vv.filter(e=>e.episode===vid),vt=get(v,'targets').filter((t:R)=>t.episode===vid),bt=get(b,'targets').filter((t:R)=>t.episode===bid);
    const asRows=(xs:R[])=>xs.map(x=>({at:x.event.fillAt,iso:new Date(x.event.fillAt).toISOString(),kind:x.event.kind,reason:x.event.reason,price:x.event.price,
      decisionAt:x.event.decisionAt,decisionIndex:x.event.decisionIndex,fillIndex:x.event.fillIndex,depth:x.after.length,average:x.after.length?average(x.after):null,
      notional:x.after.reduce((n:number,p:R)=>n+p.notional,0)}));
    const bar=cs[ves.at(-1)!.event.fillIndex],target=vt.filter((t:R)=>t.at<bar.endTs).at(-1),baselineTarget=bt.filter((t:R)=>t.at<bar.endTs).at(-1);
    assert(target&&baselineTarget);near(ve.pnl,get(v,'engine').closes.find((c:R)=>c.entryIso===spec.entry).pnl+get(v,'engine').closes.find((c:R)=>c.entryIso===spec.entry).trimPnlInEpisode);
    const after=cs.filter(c=>c.ts>=target.at&&c.endTs<=Date.parse(be.close));
    const crossings=after.filter(c=>c.high>=target.targetPrice).map(c=>({at:c.ts,open:c.open,high:c.high,close:c.close,volume:c.volume,turnover:c.turnover,
      clearanceBps:1e4*(c.high/target.targetPrice-1),closesAbove:c.close>=target.targetPrice}));
    const mutations=ves.filter(e=>e.event.kind==='partial').map(e=>{const a=cs[e.event.decisionIndex],baseInventory=bes.filter(x=>x.event.fillAt<=e.event.decisionAt).at(-1)!.after;
      const afterMap=new Map(e.after.map((p:R)=>[p.id,p.qty]));const pnl=e.before.reduce((n:number,p:R)=>{const qty=p.qty-Number(afterMap.get(p.id)??0);return n+qty*(e.event.price-p.entryPrice)-qty*(e.event.price+p.entryPrice)*.00055;},0);
      return {at:e.event.decisionAt,iso:new Date(e.event.decisionAt).toISOString(),decisionPrice:a.close,fillPrice:e.event.price,netPnl:pnl,
        baselinePricePnlPct:100*(a.close/average(baseInventory)-1),waitingPricePnlPct:100*(a.close/average(e.before)-1),
        thresholdPct:.25,clearancePrice:a.close-average(e.before)*1.0025,remainingNotional:e.after.reduce((n:number,p:R)=>n+p.notional,0)};});
    const entries=new Set(v.metrics.episodes.map((e:R)=>e.entry)),end=Math.max(Date.parse(be.close),Date.parse(ve.close));
    const next=b.metrics.episodes.find((e:R)=>Date.parse(e.entry)>end&&entries.has(e.entry));assert(next);
    const chain=(r:R)=>r.metrics.episodes.filter((e:R)=>e.entry>=spec.entry&&e.entry<next.entry);const bc=chain(b),vc=chain(v);assert([...bc,...vc].every(e=>e.close<next.entry));
    const context=get(b,'features').find((x:R)=>x.firstDeep&&x.entryAt===Date.parse(spec.entry));assert(context);
    const alternate=rows.filter(r=>r.window===spec.window&&r.tp==='close_confirmed').map(r=>({name:r.name,waiting:r.waiting,
      sameEntry:r.metrics.episodes.find((e:R)=>e.entry===spec.entry)??null,
      overlapping:r.metrics.episodes.filter((e:R)=>Date.parse(e.entry)<=Date.parse(spec.entry)&&Date.parse(e.close)>=Date.parse(spec.entry))}));
    const item={...spec,baseline:be,waiting:ve,matchedDelta:ve.pnl-be.pnl,context,baselineEvents:asRows(bes),waitingEvents:asRows(ves),
      baselineTargets:bt,waitingTargets:vt,waitingIntents:get(v,'window').intents.filter((x:R)=>x.episode===vid),partials:mutations,
      exitCandle:bar,exitTarget:target.targetPrice,baselineTargetAtExit:baselineTarget.targetPrice,firstTouchClearanceBps:1e4*(bar.high/target.targetPrice-1),
      fixedTargetWitness:{warning:'Prices after the recorded exit do not reconstruct hypothetical surviving inventory.',from:target.at,until:Date.parse(be.close),
        maxHigh:Math.max(...after.map(c=>c.high)),maxClose:Math.max(...after.map(c=>c.close)),crossings},
      chain:{untilCommonEntry:next.entry,baseline:bc,waiting:vc,baselineNet:sum(bc),waitingNet:sum(vc),delta:sum(vc)-sum(bc)},alternate};
    cases.push(item);atomicJson(`${OUT}/case-${spec.entry.slice(0,10)}.json`,item);
  }
  const recent=pairs.find(x=>x.window==='hl_extended'&&x.tp==='resting_touch')!,recentCases=cases.filter(x=>x.window==='hl_extended');
  const full=pairs.find(x=>x.window==='published_window'&&x.tp==='resting_touch')!;
  const concentration={warning:'Contribution subtraction only; not a new replay, probability estimate, or leave-out DD.',
    recent:{delta:recent.delta,topTwoMatched:recentCases.reduce((n,c)=>n+c.matchedDelta,0),afterTopTwoMatched:recent.delta-recentCases.reduce((n,c)=>n+c.matchedDelta,0),
      twoDisjointChains:recentCases.reduce((n,c)=>n+c.chain.delta,0),outsideTwoChains:recent.delta-recentCases.reduce((n,c)=>n+c.chain.delta,0)},
    longer:{delta:full.delta,marchAndJuneMatched:cases.filter(x=>!x.entry.startsWith('2026-08')).reduce((n,c)=>n+c.matchedDelta,0),
      marchAndJuneChains:cases.filter(x=>!x.entry.startsWith('2026-08')).reduce((n,c)=>n+c.chain.delta,0)}};
  atomicJson(`${OUT}/analysis.json`,{pairs,cases,concentration});await verifyPins(process.cwd(),pins);
  const files=fs.readdirSync(OUT).map(file=>({file,sha256:sha(fs.readFileSync(`${OUT}/${file}`))}));atomicJson(`${OUT}/verification.json`,{passed:true,archiveControls:8,
    cases:3,caseSelection:'posthoc',noNewReplay:true,sourceSha256:sha(fs.readFileSync(__filename)),files});
  console.log(JSON.stringify({concentration,cases:cases.map(c=>({entry:c.entry,matched:c.matchedDelta,chain:c.chain.delta,target:c.exitTarget,
    clearanceBps:c.firstTouchClearanceBps,wickMinutes:c.fixedTargetWitness.crossings.length,closedMinutes:c.fixedTargetWitness.crossings.filter((x:R)=>x.closesAbove).length,partials:c.partials})),
    frequencies:pairs.map(p=>({window:p.window,tp:p.tp,matched:p.matched,matchedBetter:p.matchedBetter,matchedWorse:p.matchedWorse,flips:p.flips.length,hardToTp:p.matchedHardToTp.length,hard:p.baselineHardFlattens}))}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
