/** SM01 presentation only; reads accepted artifacts, never reruns economics. */
import fs from 'fs';import path from 'path';import assert from 'assert/strict';
import {jobDirectory} from './research-workflow';
type R=Record<string,any>;
const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
export function report(key:string){
 const dir=jobDirectory(process.cwd(),key),out=`${dir}/output`,receipt=read(`${dir}/verification.json`);assert(receipt.passed);
 const rows:R[]=read(`${out}/results.json`),cmp:R[]=read(`${out}/comparisons.json`),review=read(`${dir}/review.json`),d=read(`${dir}/plan.json`).card.definition;
 const lines:string[]=['# SM01 — S/R map substitution and combinations','',`Verified job: ${key}. Research only; no live changes.`,'',
  'Recent: May 17–September 15, 2026. Longer: July 1, 2025–August 19, 2026; exact UTC cutoffs in the frozen card.',
  '$32,000 flat start; $800 × 1.35, maximum 11 rungs; 0.055% entry/exit fees. Net includes remaining open mark and modeled closing fee. No funding cash or maker savings. Not a forecast for the current account.',
  'Wins/losses are completed ladder episodes, including their partials; dollars are after modeled fees. Monthly W/L assigns whole episodes to closing month, whereas MTM splits exposure over month boundaries. DD is intrabar equity drawdown over the entire stated window.',
  'The 30m local map retains 14 days; the independent 4H/1D maps retain 120 days of qualifying touches. Confirmed macro roles and fixed centres differ from local price-relative roles. This compares whole maps, not timeframe alone.',''];
 const money=(n:number)=>Math.round(n).toLocaleString('en-US'),label=(x:R)=>x.strategy==='none'?'No S/R action':`${x.strategy==='partial'?'Partial':'Partial + buffered TP'} / ${x.set}`;
 const table=(h:string[],rs:any[][])=>{lines.push('| '+h.join(' | ')+' |','|'+h.map(()=>'---').join('|')+'|',...rs.map(r=>'| '+r.join(' | ')+' |'),'');};
 for(const window of ['recent','published'])for(const tp of d.tpModels){
  const rs=rows.filter(x=>x.window===window&&x.tp===tp&&!x.lag),b=rs.find(x=>x.strategy==='partial'&&x.set==='local14d')!,others=rs.filter(x=>x!==b),ordered=[b,...others];
  lines.push(`## ${window} / ${tp}`,'','The first row is unchanged current Agg10 with local14d partials.','');
  table(['Setup','Wins','Winning $','Losses','Losing $','Avg loss $','Net $','Δ current $','DD','TPs','Partials','Open $'],ordered.map(x=>{const m=x.metrics;return[label(x),m.profitableEpisodes,money(m.grossWin),m.losingEpisodes,money(-m.grossLoss),money(m.losingEpisodes?-m.grossLoss/m.losingEpisodes:0),money(m.totalPnl),money(m.totalPnl-b.metrics.totalPnl),m.maxDrawdownPct.toFixed(2)+'%',m.tpCycles,m.partials,money(m.openPnl)];}));
  for(const strategy of d.strategies){const vs=rs.filter(x=>x.strategy===strategy&&x!==b);
   lines.push(`### Monthly MTM — ${strategy}`,'','Baseline column is actual dollars; others are changes versus that baseline.','');
   table(['Month','Current baseline $',...vs.map(label)],b.accounting.monthly.map((m:R)=>[m.month,money(m.mtmPnl),...vs.map(x=>money(x.accounting.monthly.find((v:R)=>v.month===m.month).mtmPnl-m.mtmPnl))]));
   lines.push('Monthly completed episodes: wins / winning dollars; losses / losing dollars.','');
   table(['Month','Current baseline',...vs.map(label)],b.accounting.monthly.map((m:R)=>[m.month,...[b,...vs].map(x=>{const v=x.accounting.monthly.find((z:R)=>z.month===m.month);return`${v.wins} / ${money(v.winDollars)}; ${v.losses} / ${money(v.lossDollars)}`;})]));
  }
  lines.push('### Incremental map and action effects','');
  table(['Setup','Δ same action/local14d $','Δ matching map/partial-only $','Shaded episodes','Partial signals by selected source'],rs.filter(x=>x.strategy!=='none').map(x=>{
   const c=cmp.find(c=>c.name===x.name)!,g:R[]=read(`${out}/${x.name}-partial-gates.json`),sources:R={};for(const e of g)if(e.fire)sources[e.source]=(sources[e.source]??0)+1;
   return[label(x),money(c.sameStrategyDelta.pnlDelta),c.partialDelta?money(c.partialDelta.pnlDelta):'—',x.selectedEpisodes,JSON.stringify(sources)];
  }));
 }
 lines.push('## One-minute geometry delay — recent','');
 table(['Setup','TP model','Net $','Δ unchanged current $','DD','Partials'],rows.filter(x=>x.lag).map(x=>[label(x),x.tp,money(x.metrics.totalPnl),money(cmp.find(c=>c.name===x.name)!.delta.pnlDelta),x.metrics.maxDrawdownPct.toFixed(2)+'%',x.metrics.partials]));
 lines.push('## Frozen screen','',`Qualified definitions: ${review.qualification.filter((x:R)=>x.passesScreen).length}/${review.qualification.length}. A research pass is not live deployment approval.`,'');
 for(const q of review.qualification)lines.push(`- ${q.id}: ${q.passesScreen?'PASS':q.failures.join('; ')}`);
 lines.push('','## Occupancy and concentration','');
 table(['Path','Changed episodes','Net Δ excluding largest beneficial component $','Net Δ excluding two $'],review.reviews.filter((x:R)=>!x.name.endsWith('lag60000')).map((x:R)=>[x.name,x.changedEpisodes,money(x.netDeltaExcludingLargest),money(x.netDeltaExcludingTwoLargest)]));
 lines.push('## Verification and limits','',JSON.stringify(receipt,null,2),'',
  'Two fill assumptions are sensitivity cases, not two independent samples. Archived macro maps and local closed-prefix cache are reused. Source geometry is as-of closed bars; historical repair is not original network-arrival certification. Older HL data is incomplete. The overlapping, repeatedly tested periods are not out-of-sample holdouts. No new threshold optimization occurred in this card.');
 const dest='backtests/hype/sr-multimap-sm01-2026-09-17';fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'report.md'),lines.join('\n')+'\n');
 console.log(JSON.stringify({report:`${dest}/report.md`,qualification:review.qualification,verifiedRuns:receipt.runs}));
}
if(require.main===module)report(process.argv[2]);
