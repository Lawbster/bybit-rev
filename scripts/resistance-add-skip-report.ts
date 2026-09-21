/** Read-only verified report; no new economics. */
import fs from 'fs';import assert from 'assert/strict';import {jobDirectory} from './research-workflow';
type R=Record<string,any>;const dir=jobDirectory(process.cwd(),process.argv[2]),read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
assert(read(`${dir}/verification.json`).passed);const rows:R[]=read(`${dir}/output/results.json`),review=read(`${dir}/review.json`);
const money=(n:number)=>Math.round(n).toLocaleString('en-US');
function table(h:string[],rs:any[][]){console.log('| '+h.join(' | ')+' |\n|'+h.map(()=>'---').join('|')+'|');for(const r of rs)console.log('| '+r.join(' | ')+' |');}
for(const window of ['recent','published'])for(const tp of ['resting_touch','close_confirmed']){
  const rs=rows.filter(x=>x.window===window&&x.tp===tp&&!x.lag),a=rs.find(x=>x.control)!;
  console.log(`\n## ${window} / ${tp}\n`);
  table(['Setup','Wins','Winning $','Losses','Losing $','Avg loss $','Net incl. open $','DD','TPs / partials','Open $'],rs.map(x=>{const m=x.metrics;
    return[x.cell,m.profitableEpisodes,money(m.grossWin),m.losingEpisodes,money(-m.grossLoss),money(-m.grossLoss/m.losingEpisodes),money(m.totalPnl),m.maxDrawdownPct.toFixed(2)+'%',`${m.tpCycles} / ${m.partials}`,money(m.openPnl)];}));
  console.log('\nMonthly MTM, variant delta versus A\n');table(['Month','A net $','K delta $'],a.accounting.monthly.map((m:R)=>[m.month,money(m.mtmPnl),money(rs.find(x=>!x.control)!.accounting.monthly.find((n:R)=>n.month===m.month).mtmPnl-m.mtmPnl)]));
  console.log('\nWhole-ladder W/L booked to close month, not calendar MTM\n');
  table(['Month','A wins / $; losses / $','K wins / $; losses / $'],a.accounting.monthly.map((m:R)=>[m.month,...rs.map(x=>{const n=x.accounting.monthly.find((n:R)=>n.month===m.month);return`${n.wins} / ${money(n.winDollars)}; ${n.losses} / ${money(n.lossDollars)}`;})]));
}
console.log('\nInterventions and lag sensitivity\n');table(['Path','Net','DD','Blocked checks','Ladders affected','Spells','Next timer / drop / reduction / censored'],rows.filter(x=>!x.control).map(x=>{const q=x.interventions;return[x.name,money(x.metrics.totalPnl),x.metrics.maxDrawdownPct.toFixed(2)+'%',q.blockedChecks,q.affectedEpisodes,q.spells,`${q.followedByTimer} / ${q.followedByDrop} / ${q.followedByReduction} / ${q.censored}`];}));
console.log(JSON.stringify({qualification:review.qualification,verification:read(`${dir}/verification.json`),concentration:review.reviews.map((r:R)=>({name:r.name,changedEpisodes:r.changedEpisodes,exLargest:r.netDeltaExcludingLargest,exTwo:r.netDeltaExcludingTwoLargest,largest:r.largestPositive}))},null,2));
